// Turns a meeting transcript into minutes: either with Claude (needs an API key
// and internet) or with a basic on-device summariser that works offline.

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';
const MODEL = 'claude-opus-5-5';

export function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function transcriptToText(segments) {
  return segments
    .map((s) => `[${fmtClock(s.t)}] ${s.note ? 'NOTE' : s.speaker || 'Speaker'}: ${s.text}`)
    .join('\n');
}

// Parses the editable transcript text back into segments.
export function textToTranscript(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[(\d+):(\d{2})(?::(\d{2}))?\]\s*([^:]{1,40}):\s*(.*)$/);
    if (m) {
      const t = m[3] !== undefined ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 : (+m[1] * 60 + +m[2]) * 1000;
      const who = m[4].trim();
      out.push(who === 'NOTE' ? { t, note: true, text: m[5] } : { t, speaker: who === 'Speaker' ? '' : who, text: m[5] });
    } else {
      out.push({ t: out.length ? out[out.length - 1].t : 0, speaker: '', text: line });
    }
  }
  return out;
}

function header(meeting) {
  const d = new Date(meeting.createdAt);
  const lines = [`# ${meeting.title || 'Meeting'}`, ''];
  lines.push(`**Date:** ${d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}  `);
  lines.push(`**Time:** ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}  `);
  if (meeting.durationMs) lines.push(`**Duration:** ${fmtClock(meeting.durationMs)}  `);
  if (meeting.location) lines.push(`**Location:** ${meeting.location}  `);
  lines.push(`**Attendees:** ${meeting.attendees.length ? meeting.attendees.join(', ') : 'Not recorded'}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are an experienced executive assistant who writes clear, accurate, professional meeting minutes.

You will receive meeting details and a transcript produced by automatic speech recognition. The transcript has mistakes: misheard words, missing punctuation, and speaker labels that may be missing or wrong. Lines marked NOTE were typed by the minute-taker during the meeting and are reliable — give them priority.

Write the minutes in Markdown using exactly this structure, omitting a section only if there is truly nothing for it:

## Summary
Two to four sentences on the purpose and outcome of the meeting.

## Discussion
One "### " sub-heading per topic (follow the agenda order when an agenda is given, and add any extra topics that came up). Under each, concise bullet points of the key points, views and reasons. Attribute points to people only when the transcript makes it clear who said them.

## Decisions
Bullet list of what was decided or agreed.

## Action Items
A Markdown table with columns: # | Action | Owner | Due. Use "TBC" when the owner or due date was not stated. Start each action with a verb.

## Open Questions
Bullet list of unresolved issues or items to revisit.

## Next Meeting
Date/time or plans for the next meeting, if mentioned.

Rules:
- Record only what is supported by the transcript. Never invent names, numbers, dates or decisions.
- Fix obvious speech-recognition errors from context, but don't guess at unclear content; leave it out instead.
- Be concise and neutral: minutes record outcomes, not every word.
- Write in the same language as the transcript.
- Output only the Markdown sections above, starting with "## Summary". Do not add a title or meeting details; those are added separately.`;

function buildUserPrompt(meeting) {
  const parts = [
    `Meeting title: ${meeting.title || 'Untitled'}`,
    `Date: ${new Date(meeting.createdAt).toString()}`,
    `Attendees: ${meeting.attendees.join(', ') || 'not listed'}`,
  ];
  if (meeting.location) parts.push(`Location: ${meeting.location}`);
  if (meeting.agenda.length) parts.push(`Agenda:\n${meeting.agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
  parts.push(`<transcript>\n${transcriptToText(meeting.segments)}\n</transcript>`);
  return parts.join('\n\n');
}

export async function generateWithClaude(meeting, apiKey, onProgress) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import(SDK_URL));
  } catch {
    throw new Error('Could not load the Claude library. Check your internet connection.');
  }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const head = header(meeting);

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // If a safety classifier declines the request, the API retries it on a
      // suitable fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(meeting) }],
    });
    let body = '';
    stream.on('text', (delta) => {
      body += delta;
      onProgress?.(`${head}\n\n${body}`);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error('Claude declined to write minutes for this transcript. Try the basic minutes instead.');
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text.trim()) throw new Error('Claude returned an empty response. Please try again.');
    return `${head}\n\n${text.trim()}\n`;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Your Claude API key was rejected. Check it in Settings.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Too many requests right now. Wait a minute and try again.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Could not reach Claude. Check your internet connection.');
    if (err instanceof Anthropic.APIError) throw new Error(`Claude API error: ${err.message}`);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Offline summariser                                                  */
/* ------------------------------------------------------------------ */

const STOP = new Set(`a about above after again all also am an and any are as at be because been before being
below between both but by can could did do does doing done down during each few for from further get got had
has have having he her here hers him his how i if in into is it its itself just know like me more most my no
nor not now of off on once only or other our ours out over own really right same she should so some such than
that the their them then there these they this those through to too under until up us very was we well were
what when where which while who whom why will with would yeah yes you your okay ok um uh so going think thing
things gonna want one two lot maybe kind sort mean actually basically`.split(/\s+/));

const DECISION_RE = /\b(decided|decision|agreed|we agree|agree that|approved|go with|going with|settled on|resolved|confirmed|final answer|conclusion|let'?s go ahead)\b/i;
const ACTION_RE = /\b(i'?ll|we'?ll|you'?ll|he'?ll|she'?ll|they'?ll|will (?:send|prepare|draft|share|update|check|call|email|follow|look|organi[sz]e|book|arrange|review|finish|complete|write|create|schedule|contact|set up|sort)|need(?:s)? to|have to|has to|must|action item|to-?do|follow[- ]up|take care of|responsible for|in charge of|assigned?|deadline)\b/i;
const QUESTION_RE = /(\?\s*$)|\b(not sure|unclear|open question|tbd|to be decided|to be confirmed|pending|revisit|come back to|park (?:this|that)|still need to decide)\b/i;
const NEXT_RE = /\b(next meeting|meet again|follow-?up meeting|reconvene|catch up next|see you (?:next|on))\b/i;
const DUE_RE = /\b(by|before|until|due|on)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|tomorrow|today|tonight|end of (?:the )?(?:day|week|month|quarter|year))|\d{1,2}(?:st|nd|rd|th)?(?:\s+\w+)?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})\b/i;

function sentences(meeting) {
  const out = [];
  for (const seg of meeting.segments) {
    const pieces = seg.note ? [seg.text] : seg.text.split(/(?<=[.!?])\s+/);
    for (const p of pieces) {
      const text = p.trim();
      if (!text) continue;
      out.push({ text: text[0].toUpperCase() + text.slice(1), speaker: seg.speaker, note: !!seg.note, t: seg.t });
    }
  }
  return out;
}

const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
const contentWords = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));
const tidy = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

function findOwner(sentence, attendees) {
  const lower = sentence.text.toLowerCase();
  const named = attendees.find((a) => a && new RegExp(`\\b${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
  if (named) return named;
  if (/\b(i'?ll|i will|i need to|i have to|i can)\b/i.test(sentence.text) && sentence.speaker) return sentence.speaker;
  return 'TBC';
}

export function generateBasic(meeting) {
  const all = sentences(meeting);
  const head = header(meeting);
  if (!all.length) return `${head}\n\n## Summary\nNo discussion was captured for this meeting.\n`;

  // Score sentences by how many frequent content words they contain.
  const freq = new Map();
  for (const s of all) for (const w of new Set(contentWords(s.text))) freq.set(w, (freq.get(w) || 0) + 1);
  const score = (s) => {
    const cw = contentWords(s.text);
    if (cw.length < 3) return s.note ? 1 : 0;
    return cw.reduce((sum, w) => sum + (freq.get(w) || 0), 0) / Math.sqrt(cw.length) + (s.note ? 5 : 0);
  };

  // Typed notes can be tagged, e.g. "Decision: …" or "Action: …".
  const tagged = (s, tag) => s.note && new RegExp(`^${tag}s?\\s*[:\\-]`, 'i').test(s.text);
  const untag = (s) => (s.note ? { ...s, text: s.text.replace(/^(decision|action|todo|to-do)s?\s*[:\-]\s*/i, '') } : s);
  const decisions = all.filter((s) => tagged(s, 'decision')
    || (!tagged(s, 'action') && DECISION_RE.test(s.text) && words(s.text).length >= 4 && !QUESTION_RE.test(s.text)));
  const actions = all.filter((s) => tagged(s, 'action') || tagged(s, 'to-?do')
    || (ACTION_RE.test(s.text) && !decisions.includes(s) && !QUESTION_RE.test(s.text)));
  const questions = all.filter((s) => QUESTION_RE.test(s.text) && !decisions.includes(s) && words(s.text).length > 3);
  const next = all.filter((s) => NEXT_RE.test(s.text));
  const used = new Set([...decisions, ...actions]);

  const keyCount = Math.min(12, Math.max(4, Math.round(all.length / 8)));
  const pick = (pool, n) => pool
    .map((s, i) => ({ s, i, sc: score(s) }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  const bullet = (s) => `- ${s.speaker && !s.note ? `**${s.speaker}:** ` : ''}${tidy(s.text)}`;

  const md = [head, ''];

  if (meeting.agenda.length) {
    md.push('## Agenda', ...meeting.agenda.map((a, i) => `${i + 1}. ${a}`), '');
  }

  const top = pick(all.filter((s) => !used.has(s)), keyCount);
  md.push('## Summary');
  md.push(`Meeting "${meeting.title || 'Untitled'}" with ${meeting.attendees.length || 'unrecorded'} attendee${meeting.attendees.length === 1 ? '' : 's'}` +
    `${meeting.durationMs ? `, lasting ${fmtClock(meeting.durationMs)}` : ''}. ` +
    `${decisions.length} decision${decisions.length === 1 ? '' : 's'} and ${actions.length} action item${actions.length === 1 ? '' : 's'} were identified.`, '');

  md.push('## Discussion');
  if (meeting.agenda.length) {
    const taken = new Set();
    for (const item of meeting.agenda) {
      const keys = new Set(contentWords(item));
      const related = all.filter((s) => !taken.has(s) && !used.has(s) && contentWords(s.text).some((w) => keys.has(w)));
      const chosen = pick(related, 4);
      chosen.forEach((s) => taken.add(s));
      md.push(`### ${item}`, ...(chosen.length ? chosen.map(bullet) : ['- No specific discussion captured.']), '');
    }
    const other = pick(top.filter((s) => !taken.has(s)), 6);
    if (other.length) md.push('### Other points', ...other.map(bullet), '');
  } else {
    md.push('### Key points', ...top.map(bullet), '');
  }

  if (decisions.length) md.push('## Decisions', ...decisions.map((s) => `- ${tidy(untag(s).text)}`), '');

  if (actions.length) {
    md.push('## Action Items', '| # | Action | Owner | Due |', '|---|---|---|---|');
    actions.map(untag).forEach((s, i) => {
      const due = s.text.match(DUE_RE);
      // "I will prepare…" reads better as "Sara will prepare…".
      const text = s.speaker ? s.text.replace(/^(I'?ll|I will)\b/i, `${s.speaker} will`) : s.text;
      md.push(`| ${i + 1} | ${tidy(text).replace(/\|/g, '/')} | ${findOwner(s, meeting.attendees)} | ${due ? due[2] : 'TBC'} |`);
    });
    md.push('');
  }

  if (questions.length) md.push('## Open Questions', ...questions.slice(0, 10).map((s) => `- ${tidy(s.text)}`), '');
  if (next.length) md.push('## Next Meeting', ...next.map((s) => `- ${tidy(s.text)}`), '');

  md.push('---', '_Basic minutes generated on this device. Add a Claude API key in Settings for fuller, AI-written minutes._');
  return md.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* Markdown → HTML (small subset: headings, lists, tables, emphasis)    */
/* ------------------------------------------------------------------ */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
  .replace(/(^|\W)_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

export function renderMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const html = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { html.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (!line.trim()) { flushPara(); closeList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara(); closeList();
      html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara(); closeList(); html.push('<hr>');
    } else if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flushPara(); closeList();
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      i--;
      html.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      const type = /^\s*\d/.test(line) ? 'ol' : 'ul';
      if (list !== type) { closeList(); html.push(`<${type}>`); list = type; }
      const task = m[1].match(/^\[( |x|X)\]\s+(.*)$/);
      html.push(task
        ? `<li class="task">${task[1] === ' ' ? '&#9744;' : '&#9745;'} ${inline(task[2])}</li>`
        : `<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      para.push(line.replace(/\s{2,}$/, ''));
    }
  }
  flushPara(); closeList();
  return html.join('\n');
}
