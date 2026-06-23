/* ════════════════════════════════════════════════════════════
   GBA Vault — app.js
   Library management, drag-and-drop, ROM loader
   ════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ───────────────────────────────────────────────────
const STORAGE_KEY = 'gba_library';

/** Map file extension → EmulatorJS core name */
const EXT_CORE_MAP = {
  gba: 'gba',
  gbc: 'gambatte',
  gb:  'gambatte',
};

/** Random colorful emoji per game slot */
const GAME_EMOJIS = ['🎮','⚔️','🌟','🏆','🐉','🚀','🎯','🌺','🦁','🔮',
                     '🏰','🎪','🎲','🌈','🦊','🎵','🧙','🌊','🦋','💎'];

// ── State ────────────────────────────────────────────────────────
let library  = [];
let filtered = [];

// ── DOM Refs ─────────────────────────────────────────────────────
const gameGrid      = document.getElementById('game-grid');
const emptyState    = document.getElementById('empty-state');
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('rom-file-input');
const browseBtn     = document.getElementById('browse-btn');
const searchInput   = document.getElementById('search-input');
const romCountEl    = document.getElementById('rom-count');
const addRomBtn     = document.getElementById('add-rom-btn');
const urlModal      = document.getElementById('url-modal');
const closeUrlModal = document.getElementById('close-url-modal');
const cancelUrl     = document.getElementById('cancel-url');
const confirmUrl    = document.getElementById('confirm-url');
const romUrlInput   = document.getElementById('rom-url-input');
const romNameInput  = document.getElementById('rom-name-input');
const toast         = document.getElementById('toast');

// ── Helpers ──────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function emojiFor(id) {
  return GAME_EMOJIS[id % GAME_EMOJIS.length];
}

function coreFromExt(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return EXT_CORE_MAP[ext] || 'gba';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

let toastTimer;
function showToast(msg, type = 'info') {
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function relTime(iso) {
  if (!iso) return 'Belum pernah';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Baru saja';
  if (mins < 60)  return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

// ── LocalStorage ─────────────────────────────────────────────────

function loadLibrary() {
  try {
    library = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    library = [];
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

// ── Render ───────────────────────────────────────────────────────

function renderLibrary(list) {
  gameGrid.querySelectorAll('.game-card').forEach(el => el.remove());
  emptyState.style.display = list.length === 0 ? 'flex' : 'none';
  list.forEach((game, i) => gameGrid.appendChild(buildCard(game, i)));
  romCountEl.textContent = library.length;
}

function buildCard(game, i) {
  const card  = document.createElement('div');
  card.className = 'game-card';
  card.dataset.id = game.id;

  const emoji = emojiFor(parseInt(game.id, 36) || i);
  const core  = (game.core || 'gba').toUpperCase();

  card.innerHTML = `
    <div class="game-art"><span style="position:relative;z-index:1">${emoji}</span></div>
    <div class="game-card-body">
      <div class="game-card-name" title="${game.name}">${game.name}</div>
      <div class="game-card-meta">
        <span class="game-badge">${core}</span>
        <span>${formatBytes(game.size)}</span>
        <span>·</span>
        <span>${relTime(game.lastPlayed)}</span>
      </div>
      <div class="game-card-actions">
        <button class="game-play-btn" data-id="${game.id}">▶ Mainkan</button>
        <button class="btn-icon danger" data-delete="${game.id}" title="Hapus">🗑</button>
      </div>
    </div>`;

  card.querySelector('.game-play-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    launchGame(game);
  });

  card.querySelector('[data-delete]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteGame(game.id);
  });

  card.querySelector('.game-art').addEventListener('click', () => launchGame(game));

  return card;
}

// ── Navigation ───────────────────────────────────────────────────

function launchGame(game) {
  const params = new URLSearchParams({
    name: game.name,
    size: formatBytes(game.size),
    core: game.core || 'gba',
  });

  if (game.source === 'file') {
    // ROM disimpan di IndexedDB — kirim ID saja
    params.set('id', game.id);
  } else {
    // ROM dari URL eksternal
    params.set('rom', game.url);
  }

  window.location.href = `play.html?${params}`;
}

// ── Adding Games ─────────────────────────────────────────────────

/** Tambah ROM dari File object (drag/browse) → simpan ke IndexedDB */
async function addFromFile(file) {
  const name = file.name.replace(/\.\w+$/, '');
  const core = coreFromExt(file.name);
  const id   = uid();

  // Tampilkan loading state
  showToast('⏳ Menyimpan ROM...', 'info');

  try {
    // Baca file sebagai ArrayBuffer & simpan ke IndexedDB
    const buf = await file.arrayBuffer();
    await idbSaveROM(id, buf);

    const game = {
      id,
      name,
      url:        null,   // tidak pakai blob URL
      core,
      size:       file.size,
      addedAt:    new Date().toISOString(),
      lastPlayed: null,
      source:     'file', // marker: tersimpan di IndexedDB
    };

    library.unshift(game);
    saveLibrary();
    applyFilter();
    showToast(`✅ "${name}" disimpan ke library!`, 'success');
  } catch (err) {
    console.error('Gagal menyimpan ROM:', err);
    showToast(`❌ Gagal menyimpan "${name}"`, 'error');
  }
}

/** Tambah ROM dari URL eksternal */
function addFromUrl(url, name) {
  if (!url) { showToast('URL tidak valid.', 'error'); return; }
  const guessedName = name || url.split('/').pop().replace(/\.\w+$/, '') || 'Unknown Game';
  const core = coreFromExt(url);
  const game = {
    id:         uid(),
    name:       guessedName,
    url,
    core,
    size:       null,
    addedAt:    new Date().toISOString(),
    lastPlayed: null,
    source:     'url',
  };
  library.unshift(game);
  saveLibrary();
  applyFilter();
  showToast(`✅ "${guessedName}" ditambahkan!`, 'success');
}

async function deleteGame(id) {
  const idx = library.findIndex(g => g.id === id);
  if (idx === -1) return;
  const { name, source } = library[idx];

  library.splice(idx, 1);
  saveLibrary();
  applyFilter();

  // Hapus dari IndexedDB jika file lokal
  if (source === 'file') {
    try { await idbDeleteROM(id); } catch (_) {}
  }

  showToast(`🗑 "${name}" dihapus.`, 'info');
}

// ── Search / Filter ──────────────────────────────────────────────

function applyFilter() {
  const q = searchInput.value.trim().toLowerCase();
  filtered = q ? library.filter(g => g.name.toLowerCase().includes(q)) : [...library];
  renderLibrary(filtered);
}

// ── Drag & Drop ──────────────────────────────────────────────────

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files)
    .filter(f => /\.(gba|gbc|gb|zip)$/i.test(f.name));
  if (files.length === 0) {
    showToast('⚠️ Hanya file .gba / .gbc / .gb yang didukung.', 'error');
    return;
  }
  files.forEach(addFromFile);
}

dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',      handleDrop);
dropZone.addEventListener('click',     () => fileInput.click());
browseBtn.addEventListener('click',    (e) => { e.stopPropagation(); fileInput.click(); });

fileInput.addEventListener('change', () => {
  Array.from(fileInput.files).forEach(addFromFile);
  fileInput.value = '';
});

// ── URL Modal ────────────────────────────────────────────────────

addRomBtn.addEventListener('click', () => urlModal.classList.add('open'));

function closeModal() {
  urlModal.classList.remove('open');
  romUrlInput.value  = '';
  romNameInput.value = '';
}

closeUrlModal.addEventListener('click', closeModal);
cancelUrl.addEventListener('click', closeModal);
urlModal.addEventListener('click', (e) => { if (e.target === urlModal) closeModal(); });

confirmUrl.addEventListener('click', () => {
  const url  = romUrlInput.value.trim();
  const name = romNameInput.value.trim();
  if (!url) { showToast('Masukkan URL ROM terlebih dahulu.', 'error'); return; }
  addFromUrl(url, name);
  closeModal();
});

romUrlInput.addEventListener('keydown',  (e) => { if (e.key === 'Enter') confirmUrl.click(); });
romNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmUrl.click(); });

// ── Search ───────────────────────────────────────────────────────

searchInput.addEventListener('input', applyFilter);

// ── Keyboard global ──────────────────────────────────────────────

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Init ─────────────────────────────────────────────────────────

loadLibrary();

// Migrasi: hapus entry lama yang masih pakai blob URL (tidak bisa digunakan)
const hadOldBlobs = library.some(g => g.url && g.url.startsWith('blob:'));
if (hadOldBlobs) {
  library = library.filter(g => !(g.url && g.url.startsWith('blob:')));
  saveLibrary();
  showToast('ℹ️ Beberapa ROM lokal lama dihapus. Silakan upload ulang.', 'info');
}

applyFilter();
