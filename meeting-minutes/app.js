import * as store from './store.js';
import {
  fmtClock, transcriptToText, textToTranscript, generateWithClaude, generateBasic, renderMarkdown, checkApiKey,
  buildClaudeAppPrompt, minutesFromPastedReply, toPlainText, TEMPLATES, LENGTHS,
} from './minutes.js';

const $ = (id) => document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Safari's major version (on iPhone it matches iOS from iOS 26, whose user agent freezes the OS number).
const safariVersion = +(navigator.userAgent.match(/Version\/(\d+)/)?.[1] || 0);
const canDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;

const LANGUAGES = [
  ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-IN', 'English (India)'], ['en-AU', 'English (Australia)'],
  ['ur-PK', 'Urdu'], ['hi-IN', 'Hindi'], ['ar-SA', 'Arabic'], ['bn-BD', 'Bengali'], ['zh-CN', 'Chinese (Mandarin)'],
  ['nl-NL', 'Dutch'], ['fr-FR', 'French'], ['de-DE', 'German'], ['id-ID', 'Indonesian'], ['it-IT', 'Italian'],
  ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['ms-MY', 'Malay'], ['pt-BR', 'Portuguese (Brazil)'],
  ['ru-RU', 'Russian'], ['es-ES', 'Spanish'], ['tr-TR', 'Turkish'],
];
const MINUTES_LANGUAGES = ['English', 'Urdu', 'Hindi', 'Arabic', 'Bengali', 'Chinese', 'Dutch', 'French', 'German',
  'Indonesian', 'Italian', 'Japanese', 'Korean', 'Malay', 'Portuguese', 'Russian', 'Spanish', 'Turkish'];

/* ---------------- settings ---------------- */

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('mm-settings') || '{}'); } catch { /* private mode */ }
  const nav = navigator.language || 'en-US';
  const lang = LANGUAGES.find(([c]) => c === nav)?.[0] || LANGUAGES.find(([c]) => c.startsWith(nav.slice(0, 2)))?.[0] || 'en-US';
  return { lang, apiKey: '', saveAudio: false, minutesLang: '', glossary: '', ...saved };
}
let settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem('mm-settings', JSON.stringify(settings)); } catch { /* ignore */ }
}
const minutesOptions = (m) => ({
  template: m.type || 'general',
  length: m.length || 'standard',
  language: settings.minutesLang,
  glossary: settings.glossary,
});

/* ---------------- ui helpers ---------------- */

let toastTimer;
// The toast region stays in the page (only faded out) so screen readers announce
// it. An open dialog makes the rest of the page inert and covers it, so the
// toast moves into the dialog while one is open.
function toast(msg, ms = 3500) {
  const el = $('toast');
  const host = document.querySelector('dialog[open]') || document.body;
  if (el.parentElement !== host) host.appendChild(el);
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, ms);
}
const shownOnce = new Set();
function toastOnce(key, msg, ms) {
  if (shownOnce.has(key)) return;
  shownOnce.add(key);
  toast(msg, ms);
}

// Safari before 15.4 (iOS 14.5-15.3) has no <dialog> support.
function openDialog(dlg) {
  if (canDialog) { dlg.showModal(); return true; }
  toast('This needs a newer browser (iOS 15.4 or later). Update in Settings → General → Software Update.', 7000);
  return false;
}

// In-app confirmation (native confirm() is blocked in some app views).
function askConfirm(message, okLabel = 'OK') {
  const dlg = $('confirmDialog');
  // Another question is already on screen: never swap its text or share its answer.
  if (dlg.open || !canDialog) return Promise.resolve(false);
  $('confirmText').textContent = message;
  $('confirmOk').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newId = () => crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function showView(name, title) {
  for (const v of ['homeView', 'setupView', 'recordView', 'meetingView']) $(v).hidden = v !== name;
  $('viewTitle').textContent = title;
  $('backBtn').hidden = name === 'homeView';
  window.scrollTo(0, 0);
}

// Keeps the screen on while recording or while Claude is writing.
const wakeHolders = new Set();
let wakeLock = null;
let wakeRequest = null;
async function holdWake(reason) {
  wakeHolders.add(reason);
  // One request at a time, so a second call can't leak a lock that is never released.
  if (wakeLock || wakeRequest || !navigator.wakeLock) return;
  try {
    wakeRequest = navigator.wakeLock.request('screen');
    const lock = await wakeRequest;
    if (wakeHolders.size && !wakeLock) {
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } else {
      lock.release().catch(() => {});
    }
  } catch { /* not allowed right now */ } finally {
    wakeRequest = null;
  }
}
function releaseWake(reason) {
  wakeHolders.delete(reason);
  if (!wakeHolders.size && wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    lock.release().catch(() => {});
  }
}

/* ---------------- routing (hash based so the phone's back button works) ---------------- */

let current = null; // meeting being viewed or recorded
let pendingRecord = null; // only an explicit Start/Continue tap may open the recorder
let pushedFromHome = false; // whether Back can simply go back in history

function go(hash, { replace = false } = {}) {
  if (replace) location.replace(hash);
  else {
    if ((location.hash || '#/') === '#/') pushedFromHome = true;
    location.hash = hash;
  }
}

async function route() {
  const hash = location.hash || '#/';
  // A dialog belongs to the screen it was opened on (iPhone swipe-back can leave one open).
  document.querySelectorAll('dialog[open]').forEach((d) => d.close('cancel'));
  await flushEdits();
  if (recorder && !hash.startsWith('#/record/')) {
    // Leaving the recording screen finishes the recording first.
    await finishRecording(false);
  }
  if (hash === '#/' || hash === '#') pushedFromHome = false;
  if (hash === '#/new') return showSetup();
  let m;
  if ((m = hash.match(/^#\/record\/(.+)$/))) return showRecord(m[1]);
  if ((m = hash.match(/^#\/m\/(.+)$/))) return showMeeting(m[1]);
  return showHome();
}
window.addEventListener('hashchange', route);
$('backBtn').onclick = () => {
  if (location.hash.startsWith('#/record/')) return finishRecording(true);
  if (pushedFromHome) history.back();
  else go('#/', { replace: true });
};

/* ---------------- home ---------------- */

let allMeetings = [];

async function showHome() {
  showView('homeView', 'Minutes');
  current = null;
  try {
    allMeetings = await store.listMeetings();
  } catch (err) {
    allMeetings = [];
    toast(`Couldn't open this phone's storage: ${err.message}`, 8000);
  }
  // Searchable text is prepared once here, not on every keystroke.
  searchIndex = new Map(allMeetings.map((m) => {
    const body = `${(m.segments || []).map((x) => x.text).join(' ')} ${m.minutes || ''}`.normalize('NFC');
    return [m.id, { title: norm(m.title || ''), all: norm(`${m.title} ${(m.attendees || []).join(' ')} ${body}`), body, bodyNorm: norm(body) }];
  }));
  if (!allMeetings.length) $('searchInput').value = '';
  renderMeetingList();
  renderSupportHint();
  renderInstallCard();
  renderBackupCard();
}

// Case-insensitive matching that ignores accents on Latin, Greek and Cyrillic
// letters ("resume" finds "résumé") but keeps the vowel signs of scripts such
// as Hindi and Bengali, where they change the word. Text keeps its length.
const norm = (s) => String(s).normalize('NFD')
  .replace(/([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu, '$1').normalize('NFC').toLowerCase();
let searchIndex = new Map();

function snippet(entry, q) {
  const i = entry.bodyNorm.indexOf(q);
  if (i < 0) return '';
  const start = Math.max(0, i - 40);
  const end = i + q.length + 60;
  return `${start ? '…' : ''}${entry.body.slice(start, end)}${end < entry.body.length ? '…' : ''}`;
}

function renderMeetingList() {
  const q = norm($('searchInput').value.trim());
  const list = q ? allMeetings.filter((m) => searchIndex.get(m.id)?.all.includes(q)) : allMeetings;
  $('emptyList').hidden = list.length > 0;
  $('emptyList').innerHTML = q && allMeetings.length ? 'No meetings match your search.' : 'No meetings yet. Tap <b>New meeting</b> to start.';
  $('sampleBtn').hidden = allMeetings.length > 0;
  document.querySelector('.list-head').hidden = !allMeetings.length;
  $('meetingList').innerHTML = list.map((m) => {
    const entry = searchIndex.get(m.id);
    const hit = q && entry && !entry.title.includes(q) ? snippet(entry, q) : '';
    return `<li><button class="card meeting-card" data-id="${esc(m.id)}">
      <span class="m-title">${esc(m.title || 'Untitled meeting')}${m.minutes ? '<span class="badge">minutes</span>' : ''}</span>
      <span class="m-meta">${new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        · ${fmtClock(m.durationMs || 0)} · ${m.segments.length} lines</span>
      ${hit ? `<span class="m-snippet">${esc(hit)}</span>` : ''}
    </button></li>`;
  }).join('');
}
let searchTimer;
$('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderMeetingList, 150);
});

function renderSupportHint() {
  const el = $('supportHint');
  el.hidden = !!SpeechRecognition;
  if (SpeechRecognition) return;
  el.textContent = isIOS && isStandalone()
    ? `On iPhone, live listening works in Safari but not in apps opened from the Home Screen. Open ${location.href.split('#')[0]} in Safari to record. You can still paste a transcript here.`
    : 'Live listening isn\'t supported in this browser. Use Chrome (Android, Windows, Mac) or Safari (iPhone, Mac). You can still paste or type a transcript.';
}

$('meetingList').onclick = (e) => {
  const card = e.target.closest('[data-id]');
  if (card) go(`#/m/${card.dataset.id}`);
};
$('newMeetingBtn').onclick = () => go('#/new');
$('sampleBtn').onclick = async () => {
  const m = sampleMeeting();
  await store.saveMeeting(m);
  go(`#/m/${m.id}`);
};

// A realistic example meeting so the app can be tried without recording.
function sampleMeeting() {
  const lines = [
    ['Sara', "Good morning everyone, let's start with the budget review."],
    ['Sara', 'We have spent about 80 percent of the marketing budget this quarter.'],
    ['Ali', 'I think we should cut the print advertising, it is not bringing many leads.'],
    ['John', 'Agreed. Online ads gave us three times more sign-ups last month.'],
    ['Sara', 'So we agreed to move ten thousand dollars from print to online ads.'],
    ['Sara', 'I will prepare the revised budget by Friday.'],
    ['Ali', 'Next item, the project timeline. The website launch is slipping by two weeks.'],
    ['John', 'The developers are waiting on the payment provider to approve our account.'],
    ['Ali', 'John needs to call the payment provider tomorrow and push for approval.'],
    ['Sara', 'We decided to keep the launch date of March 15 for now and review it next week.'],
    ['John', 'Is the testing team ready for the launch? Not sure, we should revisit that next time.'],
    ['Sara', 'Next meeting is on Monday at 10am. Thanks everyone.'],
  ];
  const segments = lines.map(([speaker, text], i) => ({ t: i * 41000 + 5000, speaker, text }));
  segments.splice(6, 0, { t: 240000, note: true, text: 'Action: Ali to share the updated media plan with the team' });
  return {
    id: newId(),
    title: 'Marketing weekly (example)',
    type: 'general',
    attendees: ['Sara', 'Ali', 'John'],
    agenda: ['Budget review', 'Project timeline'],
    location: 'Room 4',
    createdAt: Date.now(),
    durationMs: 9 * 60000 + 12000,
    segments,
    minutes: '',
    minutesSource: '',
    hasAudio: false,
  };
}

/* ---------------- install ---------------- */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (!$('homeView').hidden) renderInstallCard();
});
window.addEventListener('appinstalled', () => { installPrompt = null; $('installCard').hidden = true; });

function renderInstallCard() {
  let dismissed = false;
  try { dismissed = localStorage.getItem('mm-install-dismissed') === '1'; } catch { /* ignore */ }
  const card = $('installCard');
  if (dismissed || isStandalone()) { card.hidden = true; return; }
  if (installPrompt) {
    $('installText').textContent = 'Install Minutes on this device. It opens like an app, works offline, and keeps your meetings safer.';
    $('installBtn').hidden = false;
    card.hidden = false;
  } else if (isIOS) {
    // On iPhone the speech service only works in Safari, so the Home Screen
    // icon should open Safari rather than a separate web app. Only iOS 26 and
    // later let you choose that when adding the icon.
    $('installText').innerHTML = safariVersion >= 26
      ? 'Add Minutes to your Home Screen: tap <b>Share</b> → <b>Add to Home Screen</b>, and switch <b>off</b> "Open as Web App" so live listening keeps working.'
      : 'On this iPhone, keep using Minutes in Safari, where live listening works: tap <b>Share</b> → <b>Add to Favourites</b>. A Home Screen icon would open without speech recognition.';
    $('installBtn').hidden = true;
    card.hidden = false;
  } else {
    card.hidden = true;
  }
}
$('installBtn').onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  renderInstallCard();
};
$('installDismiss').onclick = () => {
  try { localStorage.setItem('mm-install-dismissed', '1'); } catch { /* ignore */ }
  $('installCard').hidden = true;
};

/* Meetings live only on this device (and Safari clears sites that aren't used
   for a while), so remind people to save a backup now and then. */
const BACKUP_EVERY = 14 * 24 * 3600 * 1000;
function renderBackupCard() {
  const last = Math.max(settings.lastBackupAt || 0, settings.backupSnoozedAt || 0);
  const due = allMeetings.length >= 3 && Date.now() - last > BACKUP_EVERY;
  $('backupCard').hidden = !due;
  if (due) {
    $('backupText').textContent = `Your ${allMeetings.length} meetings are stored only on this device. Save a backup file so they're safe if the device is lost or the browser clears its storage.`;
  }
}
$('backupNowBtn').onclick = () => saveBackup();
$('backupLater').onclick = () => {
  settings.backupSnoozedAt = Date.now() - BACKUP_EVERY / 2; // ask again in a week
  saveSettings();
  $('backupCard').hidden = true;
};

/* ---------------- setup ---------------- */

const templateOptions = Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join('');
$('setupType').innerHTML = templateOptions;
$('typeSelect').innerHTML = templateOptions;
$('lengthSelect').innerHTML = Object.entries(LENGTHS).map(([k, l]) => `<option value="${k}">${esc(l.label)}</option>`).join('');

function showSetup() {
  showView('setupView', 'New meeting');
  const form = $('setupForm');
  form.reset();
  $('setupTitle').value = `Meeting ${new Date().toLocaleDateString()}`;
  $('setupType').value = settings.lastType || 'general';
  $('startBtn').disabled = !SpeechRecognition;
  $('noSpeechHint').hidden = !!SpeechRecognition;
  if (!SpeechRecognition) {
    $('noSpeechHint').textContent = isIOS && isStandalone()
      ? 'On iPhone, live listening only works in Safari. Open this page in Safari to record, or paste a transcript below.'
      : 'This browser can\'t listen to meetings. Use Chrome or Safari to record, or paste a transcript below.';
  }
}

function meetingFromForm() {
  return {
    id: newId(),
    title: $('setupTitle').value.trim(),
    type: $('setupType').value,
    // A ':' in a name would break the "Name: text" transcript lines.
    attendees: $('setupAttendees').value.split(',').map((s) => s.replace(/:/g, '').trim()).filter(Boolean),
    agenda: $('setupAgenda').value.split('\n').map((s) => s.trim()).filter(Boolean),
    location: $('setupLocation').value.trim(),
    createdAt: Date.now(),
    durationMs: 0,
    segments: [],
    minutes: '',
    minutesSource: '',
    hasAudio: false,
  };
}

async function createMeeting() {
  const m = meetingFromForm();
  settings.lastType = m.type;
  saveSettings();
  try {
    await store.saveMeeting(m);
    return m;
  } catch (err) {
    toast(`Couldn't save the meeting: ${err.message}`, 7000);
    return null;
  }
}

let creating = false;
$('setupForm').onsubmit = async (e) => {
  e.preventDefault();
  if (creating) return; // a double tap must not start two recordings
  creating = true;
  try {
    const m = await createMeeting();
    // Saving can wait (e.g. on another tab); only start if the user is still here.
    if (!m || location.hash !== '#/new') return;
    pendingRecord = m.id;
    go(`#/record/${m.id}`, { replace: true });
  } finally {
    creating = false;
  }
};
$('pasteInsteadBtn').onclick = async () => {
  if (!$('setupForm').reportValidity()) return;
  const m = await createMeeting();
  if (!m) return;
  go(`#/m/${m.id}`, { replace: true });
  setTimeout(() => { switchTab('transcript'); $('transcriptEditor').focus(); }, 80);
};

/* ---------------- recording ---------------- */

const RETRY_DELAYS = [0, 1000, 3000, 8000, 15000];
const speechLanguage = () => LANGUAGES.find(([c]) => c === settings.lang)?.[1] || settings.lang;
const PROBLEMS = {
  'audio-capture': () => 'The microphone is busy or missing. Close other apps that use it; Minutes keeps trying.',
  network: () => 'Speech recognition needs the internet on this device. Waiting for a connection…',
  'not-allowed': () => 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then tap Resume.',
  'service-not-allowed': (e) => {
    if (!isIOS) return 'This browser doesn\'t allow speech recognition here. Try Chrome or Safari, or paste a transcript instead.';
    // WebKit also uses this error when the chosen language can't be recognised.
    if (/not available|unavailable|language/i.test(e?.message || '')) {
      return `iPhone speech recognition isn't available for ${speechLanguage()} right now. Check your internet connection or pick another speech language in Settings. You can also paste a transcript instead.`;
    }
    return `Speech recognition is off. On iPhone, turn on Dictation (Settings → General → Keyboard → Enable Dictation), use Minutes in Safari rather than a Home Screen web app, and check that ${speechLanguage()} is supported. You can also paste a transcript instead.`;
  },
  'language-not-supported': () => `${speechLanguage()} isn't available for speech on this device. Pick another speech language in Settings.`,
  'keeps-stopping': () => 'Listening keeps stopping. If Minutes is open in another tab or window, close it there.',
};
const normText = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

class Recorder {
  constructor(meeting, { onUpdate, onState }) {
    this.meeting = meeting;
    this.onUpdate = onUpdate;
    this.onState = onState;
    this.speaker = '';
    this.sessionSpeaker = '';
    this.interim = '';
    this.running = false;
    this.stopped = false;
    this.suspended = false;
    this.fatal = false;
    this.failures = 0;
    this.problem = '';
    this.offset = meeting.durationMs || 0;
    this.startedAt = 0;
    this.committed = 0;
    this.lastFinal = '';
    this.chunkWrites = Promise.resolve();
  }

  elapsed() { return this.offset + (this.running ? Date.now() - this.startedAt : 0); }

  start() {
    const rec = new SpeechRecognition();
    this.rec = rec;
    rec.lang = settings.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      this.failures = 0;
      this.heard = true;
      if (this.problem && !this.fatal) this.setProblem('');
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          // Chrome on Android can deliver the same finished phrase more than once
          // in a session; both checks only look within the current session.
          if (i < this.committed) continue;
          this.committed = i + 1;
          if (text && normText(text) !== normText(this.lastFinal)) {
            this.addSegment({ speaker: this.sessionSpeaker, text });
            this.lastFinal = text;
          }
        } else {
          interim += `${r[0].transcript} `;
        }
      }
      this.interim = interim.trim();
      this.onUpdate();
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') { this.aborted = true; return; }
      if (e.error === 'no-speech') return; // silence; restarts on 'end'
      // Follow-up errors from a session the browser refused while hidden.
      if (this.suspended) return;
      // Phones refuse to listen in the background ('not-allowed'), and iPhones
      // mute the microphone then ('audio-capture'). That isn't a real failure.
      if ((e.error === 'not-allowed' || e.error === 'audio-capture') && document.visibilityState === 'hidden') {
        this.suspendListening();
        return;
      }
      const message = (PROBLEMS[e.error] || (() => `Speech recognition stopped (${e.error}). Minutes keeps trying.`))(e);
      if (['not-allowed', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
        this.fatal = true;
        this.setProblem(message);
        this.pause();
        return;
      }
      this.failures++;
      this.counted = true;
      if (e.error === 'audio-capture' && this.media && this.media.state !== 'inactive' && this.failures >= 2) {
        // Audio recording can starve recognition on some phones; transcription matters more.
        this.stopAudio();
        this.setProblem('Audio recording was turned off so live transcription can use the microphone.');
        return;
      }
      if (this.failures >= 2 || e.error === 'network') this.setProblem(message);
    };

    // Phones end recognition after every pause in speech (Chrome on Android
    // ignores `continuous`), so restart straight away to avoid gaps.
    rec.onend = () => {
      if (this.stopped) return;
      if (this.interim) {
        this.addSegment({ speaker: this.sessionSpeaker, text: this.interim });
        this.interim = '';
        this.onUpdate();
        // The app may be killed in the background before the debounced save.
        if (document.visibilityState === 'hidden') this.saveNow();
      }
      if (!this.running || this.fatal || this.suspended) return;
      // A session cut off at once without hearing anything (e.g. Minutes open in
      // two tabs, fighting over the microphone) counts as a failure, so the
      // restarts back off instead of looping. Deliberate restarts don't count.
      if (!this.heard && !this.intentional && !this.counted && Date.now() - this.sessionAt < 1500) {
        this.failures++;
        if (this.failures >= 3 && !this.problem) this.setProblem(PROBLEMS['keeps-stopping']());
      }
      const delay = this.intentional ? 0 : RETRY_DELAYS[Math.min(this.failures, RETRY_DELAYS.length - 1)];
      clearTimeout(this.restartTimer);
      if (delay) this.restartTimer = setTimeout(() => this.listen(), delay);
      else this.listen();
    };

    this.resume();
    if (settings.saveAudio) this.startAudio();
  }

  // Starts one recognition session, unless the recorder has since been paused or stopped.
  listen() {
    if (!this.running || this.fatal || this.stopped || this.suspended || recorder !== this) return;
    try {
      this.rec.start();
    } catch (err) {
      // Still ending the previous session: its 'end' will call listen() again.
      if (err.name !== 'InvalidStateError') {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => this.listen(), 500);
      }
      return;
    }
    // Only now does a new session exist, so the old phrase keeps its speaker.
    this.sessionSpeaker = this.speaker;
    this.committed = 0;
    this.lastFinal = '';
    this.heard = false;
    this.aborted = false;
    this.counted = false;
    this.intentional = false;
    this.sessionAt = Date.now();
  }

  // Ends the session on purpose (speaker or language change); restarts at once.
  restartNow() {
    if (!this.running || this.suspended) return;
    this.intentional = true;
    try { this.rec.stop(); } catch { /* not started */ }
  }

  suspendListening() {
    if (this.suspended) return;
    this.suspended = true;
    this.stoppedAt = this.elapsed();
  }

  setProblem(text) {
    this.problem = text;
    this.onState();
  }

  async startAudio() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.stopped) { this.stream.getTracks().forEach((t) => t.stop()); return; }
      this.media = new MediaRecorder(this.stream);
      // Each recording session becomes its own audio file, numbered after what is
      // already stored so old audio is never overwritten.
      const next = await store.nextAudioSession(this.meeting.id).catch(() => 1);
      this.audioSession = Math.max((this.meeting.audioSessions || 0) + 1, next);
      this.meeting.audioSessions = this.audioSession;
      this.audioSeq = 0;
      this.media.ondataavailable = (e) => {
        if (!e.data.size) return;
        const seq = this.audioSeq++;
        this.chunkWrites = this.chunkWrites
          .then(() => store.addAudioChunk(this.meeting.id, this.audioSession, seq, e.data))
          .then(() => {
            if (!this.meeting.hasAudio) { this.meeting.hasAudio = true; this.save(); }
          })
          .catch(() => toastOnce('audio-save', 'Audio couldn\'t be saved (storage may be full). Transcription continues.', 6000));
      };
      if (this.stopped) { this.stream.getTracks().forEach((t) => t.stop()); return; }
      this.media.start(10000);
      if (!this.running) this.media.pause();
    } catch {
      toastOnce('audio-start', 'Audio recording isn\'t available here. Transcription continues.');
    }
  }

  stopAudio() {
    if (this.media && this.media.state !== 'inactive') {
      try { this.media.stop(); } catch { /* already stopped */ }
    }
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  addSegment(seg) {
    if (this.stopped) return;
    this.meeting.segments.push({ t: this.elapsed(), ...seg });
    this.meeting.durationMs = this.elapsed();
    this.save();
  }

  save() {
    if (this.stopped) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 800);
  }

  saveNow(snapshot = this.meeting) {
    clearTimeout(this.saveTimer);
    this.meeting.durationMs = this.elapsed();
    return store.saveMeeting(snapshot).catch(() => toastOnce('save', 'Couldn\'t save to this device\'s storage. Free up some space and keep the app open.', 8000));
  }

  setSpeaker(name) {
    this.speaker = name;
    // Nothing being recognised: the next words simply belong to the new
    // speaker. Restarting would leave the microphone deaf for a moment.
    if (!this.interim) { this.sessionSpeaker = name; return; }
    // A phrase is in progress: ending the session makes the browser finish it
    // for the previous speaker, and the next session starts with the new one.
    this.restartNow();
  }

  setLanguage(lang) {
    this.rec.lang = lang;
    this.restartNow();
  }

  resume() {
    this.fatal = false;
    this.suspended = false;
    this.failures = 0;
    this.problem = '';
    this.running = true;
    this.startedAt = Date.now();
    this.listen();
    if (this.media?.state === 'paused') this.media.resume();
    holdWake('recording');
    if (!navigator.wakeLock) toastOnce('wake', 'Keep the screen on during the meeting: listening stops when the screen locks.', 6000);
    this.onState();
  }

  pause() {
    if (!this.running) return;
    this.offset = this.elapsed();
    this.running = false;
    clearTimeout(this.restartTimer);
    try { this.rec.stop(); } catch { /* not started */ }
    if (this.media?.state === 'recording') this.media.pause();
    releaseWake('recording');
    this.saveNow();
    this.onState();
  }

  // Called when the app goes to the background. Phones stop listening then;
  // laptops may carry on. Save everything now, because a phone may close the
  // app in the background without warning.
  suspend() {
    if (!this.running) return;
    this.hiddenAt = this.elapsed();
    if (this.media?.state === 'recording') { try { this.media.requestData(); } catch { /* inactive */ } }
    // The words being recognised right now are saved as a provisional last line
    // (they stay out of the live list, since a laptop may still finish them).
    this.saveNow(this.interim
      ? { ...this.meeting, segments: [...this.meeting.segments, { t: this.elapsed(), speaker: this.sessionSpeaker, text: this.interim }] }
      : this.meeting);
  }

  // Called when the app comes back: if listening stopped, restart it and note the gap.
  wake() {
    const hiddenAt = this.hiddenAt;
    this.hiddenAt = null;
    if (!this.running || this.fatal) return;
    if (!this.suspended) {
      // Still listening (laptops) or backing off after errors: retry at once now the app is visible.
      if (this.failures) {
        this.failures = 0;
        if (this.problem) this.setProblem('');
        clearTimeout(this.restartTimer);
        this.listen();
      }
      return;
    }
    this.suspended = false;
    const gapFrom = this.stoppedAt ?? hiddenAt ?? this.elapsed();
    this.stoppedAt = null;
    if (this.elapsed() - gapFrom > 3000) {
      this.addSegment({ note: true, text: `Listening paused while the app was in the background (${fmtClock(gapFrom)}–${fmtClock(this.elapsed())})` });
      this.onUpdate();
    }
    this.failures = 0;
    if (this.problem && !this.fatal) this.setProblem('');
    this.listen();
    holdWake('recording');
    toast('Listening again');
  }

  // Returns whether the meeting reached the device's storage.
  async stop() {
    this.offset = this.elapsed();
    this.running = false;
    this.stopped = true;
    clearTimeout(this.restartTimer);
    clearTimeout(this.saveTimer);
    // Detach first so no late result is added twice or after the final save.
    if (this.rec) {
      this.rec.onresult = null;
      this.rec.onend = null;
      this.rec.onerror = null;
      try { this.rec.abort(); } catch { /* ignore */ }
    }
    if (this.interim) {
      this.meeting.segments.push({ t: this.offset, speaker: this.sessionSpeaker, text: this.interim });
      this.interim = '';
    }
    this.meeting.durationMs = this.offset;
    releaseWake('recording');
    // Save the transcript before anything that could fail or take time.
    let saved = true;
    try { await store.saveMeeting(this.meeting); } catch { saved = false; }
    if (this.media && this.media.state !== 'inactive') {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        this.media.onstop = () => { clearTimeout(timer); resolve(); };
        try { this.media.stop(); } catch { clearTimeout(timer); resolve(); }
      });
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.chunkWrites;
    try { await store.saveMeeting(this.meeting); saved = true; } catch { /* reported below */ }
    if (!saved) toast('Couldn\'t save this meeting to the device\'s storage. Free up some space and keep Minutes open; it will try again.', 9000);
    return saved;
  }
}

let recorder = null;
let timerInterval = null;

async function showRecord(id) {
  if (recorder) return;
  if (pendingRecord !== id) {
    // Reached through Back/Forward rather than a Start tap: never reopen the microphone.
    go(`#/m/${id}`, { replace: true });
    return;
  }
  pendingRecord = null;
  const m = await store.getMeeting(id);
  if (!m) { go('#/', { replace: true }); return; }
  if (!SpeechRecognition) { toast('Live listening isn\'t supported in this browser.'); go(`#/m/${id}`, { replace: true }); return; }
  current = m;
  showView('recordView', m.title || 'Recording');

  const names = m.attendees.length ? m.attendees : [];
  $('speakerChips').innerHTML = ['Unknown', ...names]
    .map((n, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-name="${i === 0 ? '' : esc(n)}" aria-pressed="${i === 0}">${esc(n)}</button>`).join('');
  $('speakerChips').hidden = !names.length;
  $('speakerHint').hidden = !names.length;

  recorder = new Recorder(m, { onUpdate: scheduleLiveRender, onState: renderRecState });
  resetLiveView();
  recorder.start();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => { if (recorder) $('timer').textContent = fmtClock(recorder.elapsed()); }, 500);
}

// The live transcript is updated incrementally: re-rendering hundreds of lines
// on every interim result would freeze phones in long meetings.
const LIVE_MAX_LINES = 300;
let renderedCount = 0;
let interimEl = null;
let renderPending = false;

function resetLiveView() {
  const el = $('liveTranscript');
  el.innerHTML = '';
  renderedCount = 0;
  interimEl = document.createElement('p');
  interimEl.className = 'seg interim';
  // Half-recognised words change several times a second; screen readers skip them.
  interimEl.setAttribute('aria-hidden', 'true');
  el.appendChild(interimEl);
  renderLive();
}

function segmentEl(s) {
  const p = document.createElement('p');
  p.className = `seg${s.note ? ' note' : ''}`;
  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = fmtClock(s.t);
  p.appendChild(ts);
  if (s.note || s.speaker) {
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = s.note ? 'Note:' : `${s.speaker}:`;
    p.appendChild(who);
  }
  p.appendChild(document.createTextNode(s.text));
  return p;
}

function scheduleLiveRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending = false; renderLive(); });
}

function renderLive() {
  if (!recorder) return;
  const el = $('liveTranscript');
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  const segs = recorder.meeting.segments;
  const frag = document.createDocumentFragment();
  for (; renderedCount < segs.length; renderedCount++) frag.appendChild(segmentEl(segs[renderedCount]));
  el.insertBefore(frag, interimEl);
  // Keep the screen light: older lines stay in the saved transcript.
  let lines = el.querySelectorAll('.seg:not(.interim)');
  if (lines.length > LIVE_MAX_LINES) {
    for (let i = 0; i < lines.length - LIVE_MAX_LINES; i++) lines[i].remove();
    if (!el.querySelector('.older')) {
      const older = document.createElement('p');
      older.className = 'hint small older';
      older.textContent = 'Earlier lines are saved. You can see them all in the Transcript tab after you finish.';
      el.prepend(older);
    }
  }
  const placeholder = !segs.length && !recorder.interim;
  interimEl.textContent = placeholder
    ? 'Listening… start talking. Put the phone in the middle of the table for best results.'
    : recorder.interim;
  interimEl.classList.toggle('placeholder', placeholder);
  if (nearBottom) el.scrollTop = el.scrollHeight;
}

function renderRecState() {
  if (!recorder) return;
  const on = recorder.running;
  const trouble = on && !!recorder.problem;
  $('recDot').classList.toggle('paused', !on);
  $('recDot').classList.toggle('trouble', trouble);
  $('recState').textContent = !on ? 'Paused' : trouble ? 'Not hearing anything' : 'Listening';
  $('pauseBtn').innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Resume';
  $('recProblem').hidden = !recorder.problem;
  $('recProblem').textContent = recorder.problem;
}

$('speakerChips').onclick = (e) => {
  const chip = e.target.closest('.chip');
  if (!chip || !recorder) return;
  recorder.setSpeaker(chip.dataset.name);
  $('speakerChips').querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('active', c === chip);
    c.setAttribute('aria-pressed', String(c === chip));
  });
};

$('pauseBtn').onclick = () => {
  if (!recorder) return;
  if (recorder.running) recorder.pause();
  else recorder.resume();
};

function addNote(text) {
  if (!text || !recorder) return;
  recorder.addSegment({ note: true, text });
  scheduleLiveRender();
}
$('addNoteBtn').onclick = () => {
  addNote($('noteInput').value.trim());
  $('noteInput').value = '';
};
$('noteInput').onkeydown = (e) => { if (e.key === 'Enter') $('addNoteBtn').click(); };

// Quick capture: one tap turns what was just said (or the typed note) into a tagged note.
document.querySelector('.quick-row').onclick = (e) => {
  const btn = e.target.closest('[data-quick]');
  if (!btn || !recorder) return;
  const typed = $('noteInput').value.trim();
  const segs = recorder.meeting.segments;
  const lastSpoken = [...segs].reverse().find((s) => !s.note)?.text || '';
  const text = typed || [lastSpoken, recorder.interim].filter(Boolean).join(' ');
  if (!text) { toast('Nothing to mark yet. Say something or type a note first.'); return; }
  const tag = btn.dataset.quick;
  addNote(tag === '★' ? `★ ${text}` : `${tag}: ${text}`);
  $('noteInput').value = '';
  toast(tag === '★' ? 'Marked as important' : `Saved as ${tag.toLowerCase()}`, 1800);
};

// Meetings whose last save failed stay in memory, so the transcript isn't lost
// before storage frees up; showMeeting uses this copy and saves it again.
const unsaved = new Map();

async function finishRecording(navigate = true) {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  clearInterval(timerInterval);
  let saved = false;
  try {
    saved = await r.stop();
  } finally {
    if (!saved) unsaved.set(r.meeting.id, r.meeting);
    if (navigate) go(`#/m/${r.meeting.id}`, { replace: true });
  }
}
$('stopBtn').onclick = () => finishRecording(true);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    recorder?.suspend();
    flushEdits();
  } else {
    if (wakeHolders.size) holdWake([...wakeHolders][0]);
    recorder?.wake();
  }
});
// pagehide fires more reliably than beforeunload on phones.
window.addEventListener('pagehide', () => {
  if (!recorder) return;
  if (recorder.interim) {
    recorder.addSegment({ speaker: recorder.sessionSpeaker, text: recorder.interim });
    recorder.interim = '';
  }
  recorder.saveNow();
});
window.addEventListener('beforeunload', (e) => {
  if (recorder) e.preventDefault();
});

/* ---------------- meeting / minutes ---------------- */

// Meetings whose minutes are being written, with the text streamed so far.
const generating = new Map();

async function showMeeting(id) {
  let m = unsaved.get(id);
  if (m) {
    try {
      await store.saveMeeting(m);
      unsaved.delete(id);
    } catch {
      toast('This meeting isn\'t saved yet because the device\'s storage is full. Free up space, or copy the transcript now.', 9000);
    }
  } else {
    try { m = await store.getMeeting(id); } catch { m = null; }
  }
  if (!m) { go('#/', { replace: true }); return; }
  current = m;
  showView('meetingView', m.title || 'Meeting');
  switchTab('minutes');
  setEditing(false);
  $('typeSelect').value = m.type || 'general';
  $('lengthSelect').value = m.length || 'standard';
  renderMinutes();
  $('transcriptEditor').value = transcriptToText(m.segments);
  $('audioBtn').hidden = !m.hasAudio;
  $('audioParts').hidden = true;
  $('resumeBtn').hidden = !SpeechRecognition;
  updateGenHint();
}

function updateGenHint() {
  const broken = settings.apiKey && settings.keyOk === false;
  $('genHint').textContent = !settings.apiKey ? 'Generate writes basic minutes on the phone. For AI minutes, use your Claude app.'
    : broken ? 'Your Claude key isn\'t working.' : 'Generate uses Claude with your API key.';
  $('addKeyBtn').textContent = broken ? 'Fix Claude key' : 'Add Claude key';
  $('addKeyBtn').hidden = !!settings.apiKey && !broken;
}
$('addKeyBtn').onclick = () => { openSettings(); setTimeout(() => $('apiKeyInput').focus(), 50); };

for (const [id, field] of [['typeSelect', 'type'], ['lengthSelect', 'length']]) {
  $(id).addEventListener('change', async () => {
    if (!current) return;
    current[field] = $(id).value;
    try { await store.saveMeeting(current); } catch { /* minor: used next time */ }
  });
}

function renderMinutes() {
  if (!current) return;
  const busy = generating.has(current.id);
  const has = !!current.minutes;
  if (busy) {
    // Always this meeting's own text: never leave another meeting's minutes on screen.
    const partial = generating.get(current.id);
    $('minutesPreview').innerHTML = partial ? renderMarkdown(partial) : '<p class="hint">Writing the minutes…</p>';
  } else {
    $('minutesPreview').innerHTML = has
      ? renderMarkdown(current.minutes)
      : `<p class="hint">${current.segments.length
        ? 'Tap <b>Generate minutes</b>, or <b>Use my Claude app</b> for AI minutes without an API key.'
        : 'No transcript yet. Record the meeting, or paste or type the discussion in the Transcript tab.'}</p>`;
  }
  $('exportRow').hidden = !has || busy;
  $('generateBtn').disabled = busy;
  $('claudeAppBtn').disabled = busy;
  // Recording now would save an old copy of the meeting over the new minutes.
  $('resumeBtn').disabled = busy;
  $('generateBtn').innerHTML = busy ? '<span class="spinner"></span> Writing minutes…'
    : has ? '&#10227; Regenerate minutes' : '&#10024; Generate minutes';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
    t.setAttribute('aria-selected', String(t.dataset.tab === name));
  });
  $('minutesTab').hidden = name !== 'minutes';
  $('transcriptTab').hidden = name !== 'transcript';
}
document.querySelector('.tabs').onclick = async (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  await flushEdits();
  switchTab(tab.dataset.tab);
};

/* Edits to the minutes and the transcript save automatically. */

let editTimer = null;
let pendingEdit = null; // () => Promise, the save waiting to run

function queueEdit(fn) {
  pendingEdit = fn;
  clearTimeout(editTimer);
  editTimer = setTimeout(flushEdits, 700);
}
async function flushEdits() {
  clearTimeout(editTimer);
  const fn = pendingEdit;
  pendingEdit = null;
  if (fn) await fn();
}

$('transcriptEditor').addEventListener('input', () => {
  const m = current;
  const text = $('transcriptEditor').value;
  queueEdit(async () => {
    if (text === transcriptToText(m.segments)) return;
    m.segments = textToTranscript(text);
    try { await store.saveMeeting(m); } catch { toastOnce('save-edit', 'Couldn\'t save your edits to this device\'s storage.'); }
    if (current === m) renderMinutes();
  });
});
$('minutesEditor').addEventListener('input', () => {
  const m = current;
  const text = $('minutesEditor').value;
  queueEdit(async () => {
    m.minutes = text;
    try { await store.saveMeeting(m); } catch { toastOnce('save-edit', 'Couldn\'t save your edits to this device\'s storage.'); }
  });
});

function setEditing(on) {
  $('minutesEditor').hidden = !on;
  $('minutesPreview').hidden = on;
  $('editBtn').innerHTML = on ? '&#10003; Done' : '&#9998; Edit';
  if (on) $('minutesEditor').value = current.minutes;
}
$('editBtn').onclick = async () => {
  if ($('minutesEditor').hidden) return setEditing(true);
  await flushEdits();
  setEditing(false);
  renderMinutes();
};

$('generateBtn').onclick = async () => {
  const m = current;
  if (!m || generating.has(m.id)) return;
  await flushEdits();
  if (!m.segments.length) { toast('There is no transcript to summarise yet.'); return; }
  if (m.minutes && !(await askConfirm('Replace the current minutes, including any edits?', 'Replace'))) return;
  setEditing(false);
  const opts = minutesOptions(m);
  const useClaude = settings.apiKey && navigator.onLine !== false;
  const showing = () => current?.id === m.id && !$('meetingView').hidden;
  generating.set(m.id, '');
  renderMinutes();
  holdWake('generating');
  let minutes = null;
  let source = '';
  try {
    if (useClaude) {
      minutes = await generateWithClaude(m, settings.apiKey, opts, (partial) => {
        generating.set(m.id, partial);
        if (showing()) $('minutesPreview').innerHTML = renderMarkdown(partial);
      });
      source = 'claude';
      if (settings.keyOk !== true) { settings.keyOk = true; saveSettings(); }
    } else {
      if (settings.apiKey) toast('You\'re offline, so basic minutes were written on the phone.');
      minutes = generateBasic(m, opts);
      source = 'basic';
    }
  } catch (err) {
    if (err.kind === 'key') { settings.keyOk = false; saveSettings(); updateGenHint(); }
    toast(err.message || String(err), 8000);
    if (!m.minutes && showing() && await askConfirm(`${err.message}\n\nWrite basic minutes on the phone instead?`, 'Write basic minutes')) {
      minutes = generateBasic(m, opts);
      source = 'basic';
    }
  } finally {
    generating.delete(m.id);
    releaseWake('generating');
  }
  if (minutes) {
    // Every copy of this meeting in memory gets the new minutes, so a later save
    // of any of them (a recording, a queued edit) can't put the old ones back.
    for (const copy of [m, current, recorder?.meeting, unsaved.get(m.id)]) {
      if (copy?.id === m.id) { copy.minutes = minutes; copy.minutesSource = source; }
    }
    // A transcript edit typed while Claude was writing is saved first, then the
    // minutes go onto the latest copy (the meeting may also have been deleted).
    await flushEdits();
    const fresh = await store.getMeeting(m.id).catch(() => null);
    if (fresh) {
      fresh.minutes = minutes;
      fresh.minutesSource = source;
      try {
        await store.saveMeeting(fresh);
      } catch {
        toast('Couldn\'t save the minutes to this device\'s storage. Copy them now so they aren\'t lost.', 9000);
      }
      if (current?.id === m.id) current = fresh;
      if (!showing()) toast(`Minutes are ready for "${fresh.title || 'your meeting'}".`);
    }
  }
  if (showing()) { setEditing(false); renderMinutes(); }
};

/* ---------------- Claude app (no API key) ---------------- */

// Copies text, falling back to a hidden textarea where the async clipboard API is missing.
// Call it before any other await in a tap handler: browsers only allow copying
// straight after a tap.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    // Outside an open dialog the page is inert, and nothing could be selected.
    (document.querySelector('dialog[open]') || document.body).appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS needs an explicit range
    let ok = false;
    try { ok = document.execCommand('copy') && ta.selectionEnd - ta.selectionStart === text.length; } catch { /* not supported */ }
    ta.remove();
    return ok;
  }
}

let caMeeting = null; // the meeting the Claude-app dialog was opened for

$('claudeAppBtn').onclick = async () => {
  await flushEdits();
  if (!current.segments.length) { toast('There is no transcript yet. Record the meeting or paste a transcript first.'); return; }
  const dlg = $('claudeAppDialog');
  dlg.returnValue = '';
  $('caReply').value = '';
  $('caCopyStatus').textContent = '';
  $('caShareBtn').hidden = !navigator.share;
  caMeeting = current;
  openDialog(dlg);
};

$('caCopyBtn').onclick = async () => {
  const m = caMeeting;
  if (!m) return;
  const ok = await copyText(buildClaudeAppPrompt(m, minutesOptions(m)));
  $('caCopyStatus').textContent = ok
    ? 'Copied. Now open Claude, paste it into a new chat and send.'
    : 'Copying isn\'t allowed here. Try Share to Claude app instead.';
};

$('caShareBtn').onclick = async () => {
  const m = caMeeting;
  if (!m) return;
  try {
    await navigator.share({ title: m.title, text: buildClaudeAppPrompt(m, minutesOptions(m)) });
    $('caCopyStatus').textContent = 'Shared. Send it in Claude, then copy Claude\'s reply.';
  } catch (err) {
    if (err.name !== 'AbortError') toast('Sharing didn\'t work. Use Copy for Claude instead.');
  }
};

$('caPasteBtn').onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) $('caReply').value = text;
    else toast('The clipboard is empty. Copy Claude\'s reply first.');
  } catch {
    toast('Long-press the box below and choose Paste.');
    $('caReply').focus();
  }
};

$('claudeAppForm').addEventListener('submit', (e) => {
  const reply = $('caReply').value.trim();
  if (!reply) {
    e.preventDefault();
    toast('Paste Claude\'s reply into the box first.');
  } else if (reply.includes('<transcript>')) {
    e.preventDefault();
    toast('That\'s the text for Claude. Send it in Claude, then copy Claude\'s reply.', 6000);
  }
});

$('claudeAppDialog').addEventListener('close', async () => {
  const m = caMeeting;
  caMeeting = null;
  if ($('claudeAppDialog').returnValue !== 'ok') return;
  const reply = $('caReply').value.trim();
  if (!reply || !m) return;
  if (m.minutes && !(await askConfirm('Replace the current minutes with Claude\'s reply?', 'Replace'))) return;
  m.minutes = minutesFromPastedReply(m, reply);
  m.minutesSource = 'claude-app';
  try {
    await store.saveMeeting(m);
    toast('Minutes saved');
  } catch {
    toast('Couldn\'t save the minutes to this device\'s storage.', 7000);
  }
  if (current === m) { setEditing(false); renderMinutes(); }
});

/* ---------------- export ---------------- */

const minutesText = () => ($('minutesEditor').hidden ? current.minutes : $('minutesEditor').value);
const fileName = (ext, suffix = 'minutes') => `${(current.title || 'meeting').replace(/[^\p{L}\p{M}\p{N}\- ]+/gu, '').trim().replace(/\s+/g, '-') || 'meeting'}-${suffix}.${ext}`;

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Leave time for a slow "save file?" confirmation before freeing the file.
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

function needMinutes() {
  if (minutesText().trim()) return true;
  toast('There are no minutes yet. Tap Generate minutes first.');
  return false;
}

$('shareBtn').onclick = async () => {
  if (!needMinutes()) return;
  // Share straight after the tap (Safari requires it); the editor's text is read directly.
  const text = toPlainText(minutesText());
  flushEdits();
  try {
    if (navigator.share) {
      // Plain text shares everywhere; Chrome on Android refuses Markdown files.
      await navigator.share({ title: current.title, text });
    } else if (await copyText(text)) {
      toast('Sharing isn\'t available here, so the minutes were copied instead.');
    } else {
      toast('Sharing isn\'t available here. Use Word file or Email instead.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      toast(await copyText(text) ? 'Sharing didn\'t work, so the minutes were copied instead.' : 'Sharing didn\'t work.');
    }
  }
};
$('copyBtn').onclick = async () => {
  if (!needMinutes()) return;
  toast(await copyText(toPlainText(minutesText())) ? 'Minutes copied' : 'Copying isn\'t allowed here.');
};
$('downloadBtn').onclick = async () => {
  if (!needMinutes()) return;
  flushEdits();
  // An HTML document saved as .doc opens in Word, Google Docs and most phone office apps.
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(current.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;line-height:1.4;color:#1b2430}
h2{color:#1f4e79;border-bottom:1px solid #dde3ea}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef2f7}</style></head>
<body>${renderMarkdown(minutesText())}</body></html>`;
  download(new Blob(['﻿', html], { type: 'application/msword' }), fileName('doc'));
};
$('emailBtn').onclick = async () => {
  if (!needMinutes()) return;
  // Read and copy before any other wait, so copying still counts as part of the tap.
  const text = toPlainText(minutesText());
  const subject = encodeURIComponent(`Minutes: ${current.title}`.slice(0, 150));
  const link = (body) => `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  flushEdits();
  // Mail apps cut off or refuse very long links, so long minutes go via the clipboard.
  if (link(text).length <= 1900) { location.href = link(text); return; }
  if (await copyText(text)) {
    toast('The minutes are copied. Paste them into the email.', 7000);
    location.href = link('The minutes are on your clipboard: paste them here.\n\n');
  } else {
    toast('The minutes are too long for an email link. Use Word file or Share instead.', 7000);
  }
};
$('printBtn').onclick = async () => {
  if (!needMinutes()) return;
  await flushEdits();
  setEditing(false);
  renderMinutes();
  window.print();
};

$('resumeBtn').onclick = async () => {
  if (generating.has(current.id)) { toast('Wait until the minutes are written, then continue recording.'); return; }
  await flushEdits();
  pendingRecord = current.id;
  go(`#/record/${current.id}`, { replace: true });
};

async function audioParts() {
  try { return await store.getAudioParts(current.id); } catch { return []; }
}
const audioExt = (blob) => (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm');
$('audioBtn').onclick = async () => {
  const parts = await audioParts();
  if (!parts.length) { toast('No audio was saved for this meeting.'); return; }
  if (parts.length === 1) { download(parts[0], fileName(audioExt(parts[0]), 'audio')); return; }
  // Browsers block several downloads at once, so offer one button per recording.
  const box = $('audioParts');
  box.innerHTML = parts.map((p, i) => `<button class="btn small-btn" data-part="${i}">Audio part ${i + 1}</button>`).join('');
  box.hidden = false;
  box.onclick = (e) => {
    const b = e.target.closest('[data-part]');
    if (b) download(parts[+b.dataset.part], fileName(audioExt(parts[+b.dataset.part]), `audio-part${+b.dataset.part + 1}`));
  };
};
$('deleteBtn').onclick = async () => {
  if (!(await askConfirm('Delete this meeting, its transcript, minutes and audio? This cannot be undone.', 'Delete'))) return;
  pendingEdit = null;
  try {
    await store.deleteMeeting(current.id);
  } catch (err) {
    toast(`Couldn't delete the meeting: ${err.message}`);
    return;
  }
  go('#/', { replace: true });
};

/* ---------------- settings dialog ---------------- */

$('langSelect').innerHTML = LANGUAGES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
$('minutesLangSelect').innerHTML = '<option value="">Same as the meeting</option>'
  + MINUTES_LANGUAGES.map((l) => `<option value="${l}">${l}</option>`).join('');
// Cancel buttons close their dialog without submitting, so pressing Enter or
// Go on the phone keyboard always means Save / OK.
document.querySelectorAll('[data-close]').forEach((b) => {
  b.onclick = () => b.closest('dialog').close('cancel');
});

function renderKeyStatus() {
  const el = $('keyStatus');
  el.className = 'key-status small';
  if (!settings.apiKey) {
    el.textContent = 'No key saved.';
  } else if (settings.keyOk === false) {
    el.textContent = `Key ending …${settings.apiKey.slice(-4)} didn't work last time it was checked.`;
    el.classList.add('bad');
  } else {
    el.textContent = `✓ Key saved (ending …${settings.apiKey.slice(-4)})`;
    el.classList.add('ok');
  }
}

function openSettings() {
  $('langSelect').value = settings.lang;
  $('minutesLangSelect').value = settings.minutesLang || '';
  $('glossaryInput').value = settings.glossary || '';
  $('apiKeyInput').value = settings.apiKey;
  $('saveAudioInput').checked = settings.saveAudio;
  renderKeyStatus();
  $('settingsDialog').returnValue = '';
  openDialog($('settingsDialog'));
}
$('settingsBtn').onclick = openSettings;

async function verifyKey(key) {
  toast('Checking your Claude key…', 10000);
  try {
    await checkApiKey(key);
    if (settings.apiKey !== key) return;
    settings.keyOk = true;
    toast('Claude key works. Generate will now write minutes with Claude.', 4500);
  } catch (err) {
    if (settings.apiKey !== key) return;
    // Only a rejected key marks it as broken; connection, busy and account
    // problems say nothing about the key itself.
    if (err.kind !== 'key') {
      toast(`Key saved. ${err.message}`, 8000);
      return;
    }
    settings.keyOk = false;
    toast(err.message, 9000);
  }
  saveSettings();
  if (current && !$('meetingView').hidden) updateGenHint();
}

$('settingsDialog').addEventListener('close', () => {
  if ($('settingsDialog').returnValue !== 'save') return;
  // Pasted keys often pick up spaces or line breaks.
  const apiKey = $('apiKeyInput').value.replace(/\s+/g, '');
  const keyChanged = apiKey !== settings.apiKey;
  const langChanged = $('langSelect').value !== settings.lang;
  settings = {
    ...settings,
    lang: $('langSelect').value,
    minutesLang: $('minutesLangSelect').value,
    glossary: $('glossaryInput').value.trim(),
    apiKey,
    saveAudio: $('saveAudioInput').checked,
  };
  if (keyChanged) delete settings.keyOk;
  saveSettings();
  if (recorder && langChanged) recorder.setLanguage(settings.lang);
  if (current && !$('meetingView').hidden) updateGenHint();
  if (apiKey && !apiKey.startsWith('sk-ant-')) {
    toast('Saved, but this doesn\'t look like a Claude API key. Keys start with "sk-ant-".', 7000);
  } else if (apiKey && keyChanged) {
    verifyKey(apiKey);
  } else {
    toast('Settings saved');
  }
});

/* Backup and restore */

async function saveBackup() {
  try {
    const meetings = await store.listMeetings();
    const json = JSON.stringify({ app: 'minutes', version: 1, exportedAt: new Date().toISOString(), meetings }, null, 1);
    const date = new Date().toISOString().slice(0, 10);
    download(new Blob([json], { type: 'application/json' }), `minutes-backup-${date}.json`);
    settings.lastBackupAt = Date.now();
    saveSettings();
    $('backupCard').hidden = true;
    toast(`Backup of ${meetings.length} meeting${meetings.length === 1 ? '' : 's'} saved to your downloads.`, 5000);
  } catch (err) {
    toast(`Couldn't make a backup: ${err.message}`, 7000);
  }
}
$('backupBtn').onclick = saveBackup;

// Checks and repairs one meeting from a backup file; returns null if it can't be used.
function repairMeeting(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id.trim() || /[\s/#]/.test(m.id)) return null;
  const strings = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  const text = (x) => (typeof x === 'string' ? x : '');
  const segments = (Array.isArray(m.segments) ? m.segments : [])
    .filter((x) => x && typeof x.text === 'string')
    .map((x) => ({ t: Number.isFinite(x.t) ? x.t : 0, text: x.text, ...(x.note ? { note: true } : { speaker: text(x.speaker) }) }));
  return {
    id: m.id,
    title: text(m.title) || 'Restored meeting',
    type: TEMPLATES[m.type] ? m.type : 'general',
    length: LENGTHS[m.length] ? m.length : 'standard',
    attendees: strings(m.attendees),
    agenda: strings(m.agenda),
    location: text(m.location),
    createdAt: Number.isFinite(m.createdAt) ? m.createdAt : Date.now(),
    durationMs: Number.isFinite(m.durationMs) ? m.durationMs : 0,
    segments,
    minutes: text(m.minutes),
    minutesSource: text(m.minutesSource),
    audioSessions: Number.isFinite(m.audioSessions) ? m.audioSessions : 0,
  };
}

$('restoreBtn').onclick = () => $('restoreInput').click();
$('restoreInput').onchange = async () => {
  const file = $('restoreInput').files[0];
  $('restoreInput').value = '';
  if (!file) return;
  let items = [];
  try {
    const data = JSON.parse(await file.text());
    if (data?.app === 'minutes' && Array.isArray(data.meetings)) items = data.meetings;
  } catch { /* not JSON */ }
  const meetings = items.map(repairMeeting).filter(Boolean);
  if (!meetings.length) { toast('That file isn\'t a Minutes backup.', 6000); return; }
  const skipped = items.length - meetings.length;
  $('settingsDialog').close('cancel');
  if (!(await askConfirm(`Restore ${meetings.length} meeting${meetings.length === 1 ? '' : 's'} from the backup?${skipped ? ` ${skipped} damaged item${skipped === 1 ? ' is' : 's are'} skipped.` : ''} If a meeting is already on this device, it's replaced by the backup copy.`, 'Restore'))) return;
  try {
    await store.importMeetings(meetings);
    toast(`Restored ${meetings.length} meeting${meetings.length === 1 ? '' : 's'}.`);
    if ((location.hash || '#/') === '#/') showHome();
    else go('#/');
  } catch (err) {
    toast(`Couldn't restore the backup: ${err.message}`, 7000);
  }
};

/* ---------------- start ---------------- */

// An older copy of Minutes open in another tab blocks the storage upgrade until it closes.
store.setBlockedHandler(() => toast('Close Minutes in your other tabs or windows to continue.', 15000));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // A new release installs in the background and is used from the next launch.
    const announce = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        toastOnce('update', 'An update to Minutes is ready. Close the app and open it again to use it.', 7000);
      }
    };
    announce();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', announce);
    });
    // Apps left open for days still check for updates when they come back to the screen.
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3600 * 1000) {
        lastCheck = Date.now();
        reg.update().catch(() => {});
      }
    });
  }).catch(() => { /* offline support unavailable */ });
}
// Ask the browser not to clear the meetings when storage runs low.
navigator.storage?.persist?.().catch(() => {});
route();
