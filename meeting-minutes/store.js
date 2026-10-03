// Tiny IndexedDB wrapper. Meetings and audio recordings stay on the device.
const DB_NAME = 'meeting-minutes';
const DB_VERSION = 2;

let dbPromise;
let onBlocked = () => {};
// Called when an older copy of the app in another tab stops the database upgrading.
export function setBlockedHandler(fn) { onBlocked = fn; }

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('meetings')) d.createObjectStore('meetings', { keyPath: 'id' });
        // v1 kept each meeting's audio as one array of blobs, written only on Finish.
        if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
        // v2 stores every recorder chunk as it arrives, keyed [meetingId, session, seq].
        if (!d.objectStoreNames.contains('chunks')) d.createObjectStore('chunks');
      };
      req.onsuccess = () => {
        const d = req.result;
        // Let a newer version of the app (in another tab) upgrade the database.
        d.onversionchange = () => { d.close(); dbPromise = null; };
        resolve(d);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      // Keep waiting: the upgrade continues by itself once the other tab closes.
      // (Starting a new request instead would queue silently behind this one.)
      req.onblocked = () => onBlocked();
    });
  }
  return dbPromise;
}

// Runs fn inside one transaction and settles when it completes, errors or aborts
// (an abort, e.g. from a full disk, must not leave the caller waiting forever).
async function run(storeNames, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = d.transaction(storeNames, mode);
    } catch (err) {
      reject(err);
      return;
    }
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const stores = names.map((n) => tx.objectStore(n));
    const req = fn(...stores);
    tx.oncomplete = () => resolve(req && typeof req === 'object' && 'result' in req ? req.result : undefined);
    tx.onerror = () => reject(tx.error || req?.error);
    tx.onabort = () => reject(tx.error || new DOMException('The save was cancelled.', 'AbortError'));
  });
}

const chunkRange = (id) => IDBKeyRange.bound([id], [id, []]);

export const saveMeeting = (m) => run('meetings', 'readwrite', (s) => s.put(m));
export const getMeeting = (id) => run('meetings', 'readonly', (s) => s.get(id));
export const listMeetings = async () =>
  ((await run('meetings', 'readonly', (s) => s.getAll())) || []).sort((a, b) => b.createdAt - a.createdAt);

export const deleteMeeting = (id) => run(['meetings', 'audio', 'chunks'], 'readwrite', (meetings, audio, chunks) => {
  meetings.delete(id);
  audio.delete(id);
  chunks.delete(chunkRange(id));
});

// Restores meetings from a backup in one transaction. Audio isn't in backups,
// so a meeting keeps any audio still stored on this device, and its session
// count never goes backwards (a new recording must not overwrite old chunks).
export const importMeetings = (list) => run(['meetings', 'audio', 'chunks'], 'readwrite', (meetings, audio, chunks) => {
  for (const m of list) {
    const existing = meetings.get(m.id);
    existing.onsuccess = () => {
      const legacy = audio.getKey(m.id);
      legacy.onsuccess = () => {
        const last = chunks.openCursor(chunkRange(m.id), 'prev');
        last.onsuccess = () => {
          const lastSession = last.result ? last.result.key[1] : 0;
          meetings.put({
            ...m,
            hasAudio: legacy.result !== undefined || !!last.result,
            audioSessions: Math.max(existing.result?.audioSessions || 0, m.audioSessions || 0, lastSession),
          });
        };
      };
    };
  }
});

// The next free audio session number for a meeting, read from what is stored.
export async function nextAudioSession(id) {
  let last = 0;
  await run('chunks', 'readonly', (s) => {
    const req = s.openCursor(chunkRange(id), 'prev');
    req.onsuccess = () => { if (req.result) last = req.result.key[1]; };
  });
  return last + 1;
}

export const addAudioChunk = (id, session, seq, blob) =>
  run('chunks', 'readwrite', (s) => s.put({ session, blob }, [id, session, seq]));

// Returns one playable Blob per recording session (each session starts with
// its own file header, so sessions cannot be joined into one file).
export async function getAudioParts(id) {
  const legacy = (await run('audio', 'readonly', (s) => s.get(id))) || [];
  const chunks = (await run('chunks', 'readonly', (s) => s.getAll(chunkRange(id)))) || [];
  const sessions = new Map();
  for (const c of chunks) {
    if (!sessions.has(c.session)) sessions.set(c.session, []);
    sessions.get(c.session).push(c.blob);
  }
  const parts = [...sessions.values()].map((blobs) => new Blob(blobs, { type: blobs[0].type || 'audio/webm' }));
  return [...legacy, ...parts];
}
