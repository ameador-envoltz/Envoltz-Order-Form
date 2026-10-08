// Draft autosave (ORDER_FORM_SCOPE.md §4.6): form fields and lines in localStorage, attached
// files in IndexedDB, keyed by host + the link's stamp so a new link starts fresh.
// Every storage call is guarded: with storage blocked (private browsing, etc.) the form
// still works, just without autosave.

const DB_NAME = 'fab-order-form';
const STORE = 'files';

export function draftKey(stamp) {
  return `fab-order:${location.host}:${stamp || 'nostamp'}`;
}

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveDraft(key, order) {
  try { localStorage.setItem(key, JSON.stringify(order)); return true; } catch { return false; }
}

function openDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveFile(key, lineKey, blob) {
  try { await withStore('readwrite', s => s.put(blob, `${key}|${lineKey}`)); return true; } catch { return false; }
}

export async function removeFile(key, lineKey) {
  try { await withStore('readwrite', s => s.delete(`${key}|${lineKey}`)); } catch { /* ignore */ }
}

export async function loadFile(key, lineKey) {
  try { return (await withStore('readonly', s => s.get(`${key}|${lineKey}`))) || null; } catch { return null; }
}

export async function clearDraft(key, lineKeys) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  for (const k of lineKeys) await removeFile(key, k);
}
