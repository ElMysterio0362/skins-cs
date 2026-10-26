// Chave/valor mínimo em IndexedDB. Usado só para o cache do catálogo,
// que é grande demais para o localStorage (~2 MB).
const DB_NAME = 'skins-cs';
const STORE = 'kv';
let dbPromise = null;

function open() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB indisponível'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const idbGet = (key) => tx('readonly', (s) => s.get(key));
export const idbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const idbDel = (key) => tx('readwrite', (s) => s.delete(key));
