/* ════════════════════════════════════════════════════════════
   idb.js — IndexedDB helper untuk menyimpan file ROM
   ROM file tersimpan permanen di browser (tidak hilang setelah
   refresh / navigasi halaman seperti blob URL).
   ════════════════════════════════════════════════════════════ */

'use strict';

const IDB_NAME    = 'GBAVault';
const IDB_VERSION = 1;
const IDB_STORE   = 'roms';

/** Buka / upgrade database */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

/** Simpan ArrayBuffer ROM ke IndexedDB (key = game id) */
async function idbSaveROM(id, arrayBuffer) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(arrayBuffer, id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Baca ArrayBuffer ROM dari IndexedDB (return null jika tidak ada) */
async function idbLoadROM(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/** Hapus ROM dari IndexedDB */
async function idbDeleteROM(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
