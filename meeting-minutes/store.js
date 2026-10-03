// Tiny IndexedDB wrapper. Meetings and audio recordings stay on the device.
const DB_NAME = 'meeting-minutes';
const DB_VERSION = 2;

let dbPromise;
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
      req.onblocked = () => { dbPromise = null; reject(new Error('Close Minutes in your other tabs, then try again.')); };
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

// Restores meetings from a backup in one transaction.
export const importMeetings = (list) => run('meetings', 'readwrite', (s) => {
  for (const m of list) s.put(m);
});

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
