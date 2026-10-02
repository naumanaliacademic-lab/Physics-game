// Tiny IndexedDB wrapper. Meetings and audio recordings stay on the device.
const DB_NAME = 'meeting-minutes';
const DB_VERSION = 1;

let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('meetings')) d.createObjectStore('meetings', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, mode);
    const result = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const saveMeeting = (m) => run('meetings', 'readwrite', (s) => s.put(m));
export const getMeeting = (id) => run('meetings', 'readonly', (s) => s.get(id));
export const listMeetings = async () =>
  ((await run('meetings', 'readonly', (s) => s.getAll())) || []).sort((a, b) => b.createdAt - a.createdAt);
export const deleteMeeting = async (id) => {
  await run('meetings', 'readwrite', (s) => s.delete(id));
  await run('audio', 'readwrite', (s) => s.delete(id));
};

// Audio is stored as a list of Blob chunks so a long meeting can be resumed.
export const getAudio = (id) => run('audio', 'readonly', (s) => s.get(id));
export const saveAudio = (id, blobs) => run('audio', 'readwrite', (s) => s.put(blobs, id));
