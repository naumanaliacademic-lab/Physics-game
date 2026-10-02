import * as store from './store.js';
import {
  fmtClock, transcriptToText, textToTranscript, generateWithClaude, generateBasic, renderMarkdown,
} from './minutes.js';

const $ = (id) => document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const LANGUAGES = [
  ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-IN', 'English (India)'], ['en-AU', 'English (Australia)'],
  ['ur-PK', 'Urdu'], ['hi-IN', 'Hindi'], ['ar-SA', 'Arabic'], ['bn-BD', 'Bengali'], ['zh-CN', 'Chinese (Mandarin)'],
  ['nl-NL', 'Dutch'], ['fr-FR', 'French'], ['de-DE', 'German'], ['id-ID', 'Indonesian'], ['it-IT', 'Italian'],
  ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['ms-MY', 'Malay'], ['pt-BR', 'Portuguese (Brazil)'],
  ['ru-RU', 'Russian'], ['es-ES', 'Spanish'], ['tr-TR', 'Turkish'],
];

/* ---------------- settings ---------------- */

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('mm-settings') || '{}'); } catch { /* private mode */ }
  const nav = navigator.language || 'en-US';
  const lang = LANGUAGES.find(([c]) => c === nav)?.[0] || LANGUAGES.find(([c]) => c.startsWith(nav.slice(0, 2)))?.[0] || 'en-US';
  return { lang, apiKey: '', saveAudio: false, ...saved };
}
let settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem('mm-settings', JSON.stringify(settings)); } catch { /* ignore */ }
}

/* ---------------- ui helpers ---------------- */

let toastTimer;
function toast(msg, ms = 3000) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// In-app confirmation (native confirm() is blocked in some app views).
function askConfirm(message, okLabel = 'OK') {
  const dlg = $('confirmDialog');
  $('confirmText').textContent = message;
  $('confirmOk').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showView(name, title) {
  for (const v of ['homeView', 'setupView', 'recordView', 'meetingView']) $(v).hidden = v !== name;
  $('viewTitle').textContent = title;
  $('backBtn').hidden = name === 'homeView';
  window.scrollTo(0, 0);
}

/* ---------------- routing (hash based so the phone's back button works) ---------------- */

let current = null; // meeting being viewed or recorded

async function route() {
  const hash = location.hash || '#/';
  if (recorder && !hash.startsWith('#/record/')) {
    // Leaving the recording screen finishes the recording first.
    await finishRecording(false);
  }
  if (hash === '#/new') return showSetup();
  let m;
  if ((m = hash.match(/^#\/record\/(.+)$/))) return showRecord(m[1]);
  if ((m = hash.match(/^#\/m\/(.+)$/))) return showMeeting(m[1]);
  return showHome();
}
window.addEventListener('hashchange', route);
$('backBtn').onclick = () => {
  if (location.hash.startsWith('#/record/')) return $('stopBtn').click();
  location.hash = '#/';
};

/* ---------------- home ---------------- */

async function showHome() {
  showView('homeView', 'Minutes');
  const list = await store.listMeetings();
  $('emptyList').hidden = list.length > 0;
  $('meetingList').innerHTML = list.map((m) => `
    <li class="card" data-id="${m.id}">
      <div class="m-title">${esc(m.title || 'Untitled meeting')}${m.minutes ? `<span class="badge">minutes</span>` : ''}</div>
      <div class="m-meta">${new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        · ${fmtClock(m.durationMs || 0)} · ${m.segments.length} lines</div>
    </li>`).join('');
  if (!SpeechRecognition) {
    $('supportHint').hidden = false;
    $('supportHint').textContent = 'Live listening isn\'t supported in this browser. Open the app in Chrome (Android) or Safari (iPhone). You can still paste or type a transcript.';
  }
}
$('meetingList').onclick = (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) location.hash = `#/m/${li.dataset.id}`;
};
$('newMeetingBtn').onclick = () => { location.hash = '#/new'; };
$('sampleBtn').onclick = async () => {
  const m = sampleMeeting();
  await store.saveMeeting(m);
  location.hash = `#/m/${m.id}`;
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
    id: crypto.randomUUID?.() || String(Date.now()),
    title: 'Marketing weekly (example)',
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

/* ---------------- setup ---------------- */

function showSetup() {
  showView('setupView', 'New meeting');
  const form = $('setupForm');
  form.reset();
  form.title.value = `Meeting ${new Date().toLocaleDateString()}`;
  form.querySelector('[type=submit]').disabled = !SpeechRecognition;
}

function meetingFromForm() {
  const f = $('setupForm');
  return {
    id: (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)),
    title: f.title.value.trim(),
    attendees: f.attendees.value.split(',').map((s) => s.trim()).filter(Boolean),
    agenda: f.agenda.value.split('\n').map((s) => s.trim()).filter(Boolean),
    location: f.location.value.trim(),
    createdAt: Date.now(),
    durationMs: 0,
    segments: [],
    minutes: '',
    minutesSource: '',
    hasAudio: false,
  };
}

$('setupForm').onsubmit = async (e) => {
  e.preventDefault();
  const m = meetingFromForm();
  await store.saveMeeting(m);
  location.hash = `#/record/${m.id}`;
};
$('pasteInsteadBtn').onclick = async () => {
  if (!$('setupForm').reportValidity()) return;
  const m = meetingFromForm();
  await store.saveMeeting(m);
  location.hash = `#/m/${m.id}`;
  setTimeout(() => { switchTab('transcript'); $('transcriptEditor').focus(); }, 50);
};

/* ---------------- recording ---------------- */

class Recorder {
  constructor(meeting, { onUpdate, onState }) {
    this.meeting = meeting;
    this.onUpdate = onUpdate;
    this.onState = onState;
    this.speaker = '';
    this.interim = '';
    this.running = false;
    this.offset = meeting.durationMs || 0;
    this.startedAt = 0;
    this.audioChunks = [];
  }

  elapsed() { return this.offset + (this.running ? Date.now() - this.startedAt : 0); }

  async start() {
    this.rec = new SpeechRecognition();
    this.rec.lang = settings.lang;
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          if (text) this.addSegment({ speaker: this.speaker, text });
        } else {
          interim += `${r[0].transcript} `;
        }
      }
      this.interim = interim.trim();
      this.onUpdate();
    };
    this.rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.fatal = true;
        toast('Microphone access was blocked. Allow the microphone for this site and try again.', 6000);
        this.pause();
      } else if (e.error === 'network') {
        toast('Speech recognition needs an internet connection on this phone. Retrying…');
      } else if (e.error === 'language-not-supported') {
        this.fatal = true;
        toast('This language isn\'t supported for speech on this phone. Pick another in Settings.', 6000);
        this.pause();
      }
      // 'no-speech' and 'aborted' are normal; recognition restarts on 'end'.
    };
    // Mobile browsers stop recognition after silences or ~1 minute; keep it going.
    this.rec.onend = () => {
      if (this.interim) { this.addSegment({ speaker: this.speaker, text: this.interim }); this.interim = ''; }
      if (this.running && !this.fatal) setTimeout(() => { try { this.rec.start(); } catch { /* already started */ } }, 250);
    };
    this.resume();
    if (settings.saveAudio) this.startAudio();
  }

  async startAudio() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.media = new MediaRecorder(this.stream);
      this.media.ondataavailable = (e) => { if (e.data.size) this.audioChunks.push(e.data); };
      this.media.start(10000);
    } catch {
      toast('Audio recording isn\'t available; transcription continues.');
    }
  }

  addSegment(seg) {
    this.meeting.segments.push({ t: this.elapsed(), ...seg });
    this.meeting.durationMs = this.elapsed();
    this.save();
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => store.saveMeeting(this.meeting), 800);
  }

  resume() {
    this.fatal = false;
    this.running = true;
    this.startedAt = Date.now();
    try { this.rec.start(); } catch { /* already started */ }
    if (this.media?.state === 'paused') this.media.resume();
    acquireWakeLock();
    this.onState();
  }

  pause() {
    if (!this.running) return;
    this.offset = this.elapsed();
    this.running = false;
    try { this.rec.stop(); } catch { /* not started */ }
    if (this.media?.state === 'recording') this.media.pause();
    releaseWakeLock();
    this.onState();
  }

  async stop() {
    this.pause();
    this.rec.onend = null;
    try { this.rec.abort(); } catch { /* ignore */ }
    if (this.interim) { this.meeting.segments.push({ t: this.offset, speaker: this.speaker, text: this.interim }); this.interim = ''; }
    this.meeting.durationMs = this.offset;
    clearTimeout(this.saveTimer);
    if (this.media && this.media.state !== 'inactive') {
      await new Promise((resolve) => { this.media.onstop = resolve; this.media.stop(); });
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioChunks.length) {
      const blob = new Blob(this.audioChunks, { type: this.media.mimeType || 'audio/webm' });
      const previous = (await store.getAudio(this.meeting.id)) || [];
      await store.saveAudio(this.meeting.id, [...previous, blob]);
      this.meeting.hasAudio = true;
    }
    await store.saveMeeting(this.meeting);
  }
}

let recorder = null;
let timerInterval = null;
let wakeLock = null;

async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
}
function releaseWakeLock() { wakeLock?.release().catch(() => {}); wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && recorder?.running) acquireWakeLock();
});

async function showRecord(id) {
  if (recorder) return;
  const m = await store.getMeeting(id);
  if (!m) { location.hash = '#/'; return; }
  if (!SpeechRecognition) { toast('Live listening isn\'t supported in this browser.'); location.hash = `#/m/${id}`; return; }
  current = m;
  showView('recordView', m.title || 'Recording');

  const names = m.attendees.length ? m.attendees : [];
  $('speakerChips').innerHTML = ['Unknown', ...names]
    .map((n, i) => `<button class="chip${i === 0 ? ' active' : ''}" data-name="${i === 0 ? '' : esc(n)}">${esc(n)}</button>`).join('');
  $('speakerChips').parentElement.querySelector('.hint').hidden = !names.length;

  recorder = new Recorder(m, { onUpdate: renderLive, onState: renderRecState });
  renderLive();
  await recorder.start();
  timerInterval = setInterval(() => { $('timer').textContent = fmtClock(recorder.elapsed()); }, 500);
}

function renderLive() {
  if (!recorder) return;
  const el = $('liveTranscript');
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  const segs = recorder.meeting.segments;
  el.innerHTML = segs.map((s) => `<p class="seg${s.note ? ' note' : ''}"><span class="ts">${fmtClock(s.t)}</span>${
    s.note ? '<span class="who">Note:</span>' : s.speaker ? `<span class="who">${esc(s.speaker)}:</span>` : ''}${esc(s.text)}</p>`).join('')
    + (recorder.interim ? `<p class="seg interim">${esc(recorder.interim)}</p>` : '')
    + (!segs.length && !recorder.interim ? '<p class="hint">Listening… start talking. Put the phone in the middle of the table for best results.</p>' : '');
  if (nearBottom) el.scrollTop = el.scrollHeight;
}

function renderRecState() {
  if (!recorder) return;
  const on = recorder.running;
  $('recDot').classList.toggle('paused', !on);
  $('recState').textContent = on ? 'Listening' : 'Paused';
  $('pauseBtn').innerHTML = on ? '&#10074;&#10074; Pause' : '&#9654; Resume';
}

$('speakerChips').onclick = (e) => {
  const chip = e.target.closest('.chip');
  if (!chip || !recorder) return;
  // Flush what has been heard so far under the previous speaker.
  if (recorder.interim) { recorder.addSegment({ speaker: recorder.speaker, text: recorder.interim }); recorder.interim = ''; }
  // abort() drops the pending result we just saved; recognition restarts on 'end'.
  try { recorder.rec.abort(); } catch { /* not started */ }
  recorder.speaker = chip.dataset.name;
  $('speakerChips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
};

$('pauseBtn').onclick = () => (recorder.running ? recorder.pause() : recorder.resume());
$('addNoteBtn').onclick = () => {
  const text = $('noteInput').value.trim();
  if (!text || !recorder) return;
  recorder.addSegment({ note: true, text });
  $('noteInput').value = '';
  renderLive();
};
$('noteInput').onkeydown = (e) => { if (e.key === 'Enter') $('addNoteBtn').click(); };

async function finishRecording(navigate = true) {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  clearInterval(timerInterval);
  await r.stop();
  if (navigate) location.hash = `#/m/${r.meeting.id}`;
}
$('stopBtn').onclick = () => finishRecording(true);

window.addEventListener('beforeunload', (e) => {
  if (recorder) { store.saveMeeting(recorder.meeting); e.preventDefault(); }
});

/* ---------------- meeting / minutes ---------------- */

async function showMeeting(id) {
  const m = await store.getMeeting(id);
  if (!m) { location.hash = '#/'; return; }
  current = m;
  showView('meetingView', m.title || 'Meeting');
  switchTab('minutes');
  setEditing(false);
  renderMinutes();
  $('transcriptEditor').value = transcriptToText(m.segments);
  $('audioBtn').hidden = !m.hasAudio;
  $('resumeBtn').hidden = !SpeechRecognition;
  $('genHint').textContent = settings.apiKey ? 'Written by Claude' : 'Basic, on-device (add a Claude key in Settings for AI minutes)';
}

function renderMinutes() {
  const has = !!current.minutes;
  $('minutesPreview').innerHTML = has
    ? renderMarkdown(current.minutes)
    : `<p class="hint">${current.segments.length
      ? 'Tap <b>Generate minutes</b> to turn the transcript into meeting minutes.'
      : 'No transcript yet. Record the meeting, or paste/type the discussion in the Transcript tab.'}</p>`;
  $('exportRow').hidden = !has;
  $('generateBtn').innerHTML = has ? '&#10227; Regenerate minutes' : '&#10024; Generate minutes';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('minutesTab').hidden = name !== 'minutes';
  $('transcriptTab').hidden = name !== 'transcript';
}
document.querySelector('.tabs').onclick = async (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  if (tab.dataset.tab === 'minutes') await saveTranscriptEdits(false);
  switchTab(tab.dataset.tab);
};

async function saveTranscriptEdits(notify = true) {
  const text = $('transcriptEditor').value;
  if (text === transcriptToText(current.segments)) return;
  current.segments = textToTranscript(text);
  await store.saveMeeting(current);
  renderMinutes();
  if (notify) toast('Transcript saved');
}
$('saveTranscriptBtn').onclick = () => saveTranscriptEdits(true);

$('generateBtn').onclick = async () => {
  if (!current.segments.length) { toast('There is no transcript to summarise yet.'); return; }
  if (current.minutes && !(await askConfirm('Replace the current minutes, including any edits?', 'Replace'))) return;
  setEditing(false);
  const btn = $('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Writing minutes…';
  try {
    if (settings.apiKey && navigator.onLine !== false) {
      current.minutes = await generateWithClaude(current, settings.apiKey, (partial) => {
        $('minutesPreview').innerHTML = renderMarkdown(partial);
      });
      current.minutesSource = 'claude';
    } else {
      if (settings.apiKey) toast('You\'re offline, so basic minutes were written on the phone.');
      current.minutes = generateBasic(current);
      current.minutesSource = 'basic';
    }
    await store.saveMeeting(current);
  } catch (err) {
    toast(err.message || String(err), 7000);
    if (!current.minutes && await askConfirm(`${err.message} Write basic minutes on the phone instead?`, 'Write basic minutes')) {
      current.minutes = generateBasic(current);
      current.minutesSource = 'basic';
      await store.saveMeeting(current);
    }
  } finally {
    btn.disabled = false;
    renderMinutes();
  }
};

function setEditing(on) {
  $('minutesEditor').hidden = !on;
  $('minutesPreview').hidden = on;
  $('editBtn').innerHTML = on ? '&#10003; Done' : '&#9998; Edit';
  if (on) $('minutesEditor').value = current.minutes;
}
$('editBtn').onclick = async () => {
  if ($('minutesEditor').hidden) return setEditing(true);
  current.minutes = $('minutesEditor').value;
  await store.saveMeeting(current);
  setEditing(false);
  renderMinutes();
};

const minutesText = () => ($('minutesEditor').hidden ? current.minutes : $('minutesEditor').value);
const fileName = (ext) => `${(current.title || 'meeting').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')}-minutes.${ext}`;

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$('shareBtn').onclick = async () => {
  const text = minutesText();
  try {
    const file = new File([text], fileName('md'), { type: 'text/markdown' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: current.title, text, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: current.title, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast('Sharing isn\'t available; minutes copied instead.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Could not share the minutes.');
  }
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(minutesText()); toast('Minutes copied'); } catch { toast('Copy failed'); }
};
$('downloadBtn').onclick = () => {
  // An HTML document saved as .doc opens in Word, Google Docs and most phone office apps.
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(current.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;line-height:1.4;color:#1b2430}
h2{color:#1f4e79;border-bottom:1px solid #dde3ea}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef2f7}</style></head>
<body>${renderMarkdown(minutesText())}</body></html>`;
  download(new Blob(['\ufeff', html], { type: 'application/msword' }), fileName('doc'));
};
$('emailBtn').onclick = () => {
  const body = minutesText().replace(/\*\*/g, '');
  location.href = `mailto:?subject=${encodeURIComponent(`Minutes: ${current.title}`)}&body=${encodeURIComponent(body)}`;
};
$('printBtn').onclick = () => { setEditing(false); renderMinutes(); window.print(); };

$('resumeBtn').onclick = async () => {
  await saveTranscriptEdits(false);
  location.hash = `#/record/${current.id}`;
};
$('audioBtn').onclick = async () => {
  const parts = (await store.getAudio(current.id)) || [];
  parts.forEach((blob, i) => {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    download(blob, fileName(ext).replace('-minutes', parts.length > 1 ? `-audio-part${i + 1}` : '-audio'));
  });
};
$('deleteBtn').onclick = async () => {
  if (!(await askConfirm('Delete this meeting, its transcript and minutes? This cannot be undone.', 'Delete'))) return;
  await store.deleteMeeting(current.id);
  location.hash = '#/';
};

/* ---------------- settings dialog ---------------- */

$('langSelect').innerHTML = LANGUAGES.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
$('settingsBtn').onclick = () => {
  const f = $('settingsForm');
  f.lang.value = settings.lang;
  f.apiKey.value = settings.apiKey;
  f.saveAudio.checked = settings.saveAudio;
  $('settingsDialog').showModal();
};
$('settingsDialog').addEventListener('close', () => {
  if ($('settingsDialog').returnValue !== 'save') return;
  const f = $('settingsForm');
  settings = { ...settings, lang: f.lang.value, apiKey: f.apiKey.value.trim(), saveAudio: f.saveAudio.checked };
  saveSettings();
  if (recorder) recorder.rec.lang = settings.lang;
  if (current && !$('meetingView').hidden) {
    $('genHint').textContent = settings.apiKey ? 'Written by Claude' : 'Basic, on-device (add a Claude key in Settings for AI minutes)';
  }
  toast('Settings saved');
});

/* ---------------- start ---------------- */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
}
navigator.storage?.persist?.();
route();
