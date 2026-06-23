# 🎮 GBA Vault

Emulator Game Boy Advance berbasis web — ringan, tanpa instalasi, langsung jalan di browser.

## Stack

- **EmulatorJS** (via CDN) — emulator GBA/GBC/GB berbasis WebAssembly
- **Vanilla HTML + CSS + JS** — tanpa framework, tanpa build step
- **LocalStorage** — menyimpan library game
- **Node.js server** — serve lokal di `localhost` atau IP LAN

## 🚀 Menjalankan Server Lokal

> Server menggunakan **PowerShell + .NET HttpListener** — tanpa install apapun!

### Cara Cepat (Windows)
Double-click file **`start.bat`** → akan minta izin Administrator → browser terbuka otomatis.

### Lewat PowerShell (manual)
```powershell
# Jalankan di folder GBA/
PowerShell -ExecutionPolicy Bypass -File server.ps1 -OpenBrowser
```

### Ganti Port
```powershell
PowerShell -ExecutionPolicy Bypass -File server.ps1 -Port 8080
```

Setelah server berjalan, buka di browser:
- **Lokal:** `http://localhost:3000`
- **Jaringan/LAN:** `http://<IP-LAN>:3000` (IP tampil di terminal)

> **Kenapa perlu server?** EmulatorJS membutuhkan header `Cross-Origin-Embedder-Policy` dan `Cross-Origin-Opener-Policy` agar WebAssembly bisa berjalan dengan SharedArrayBuffer. Header ini hanya bisa di-set lewat HTTP server, bukan buka file langsung (file://).

> **Kenapa perlu Administrator?** Windows membutuhkan hak Admin untuk membuka port di bawah 1024, dan untuk `HttpListener` agar bisa diakses dari jaringan LAN.

## Cara Pakai

### Buka Langsung di Browser
Cukup buka `index.html` di browser modern (Chrome/Edge/Firefox).

> **Catatan:** Karena menggunakan `URL.createObjectURL`, file ROM lokal hanya bertahan selama sesi browser. Gunakan URL eksternal agar game tersimpan permanen di library.

### Menambah ROM

**Cara 1 — Drag & Drop:**
Seret file `.gba` / `.gbc` / `.gb` ke area drop di halaman utama.

**Cara 2 — Browse File:**
Klik tombol "Pilih File ROM".

**Cara 3 — Dari URL:**
Klik "+ Add ROM" di navbar, masukkan URL langsung ke file `.gba`.

### Tombol Keyboard (saat bermain)

| Tombol GBA     | Keyboard      |
|----------------|---------------|
| D-Pad          | Arrow Keys    |
| A              | X             |
| B              | Z             |
| L Trigger      | A             |
| R Trigger      | S             |
| Start          | Enter         |
| Select         | Shift         |
| Save State     | F2            |
| Load State     | F4            |
| Fullscreen     | F             |

## Struktur File

```
GBA/
├── index.html    # Library / halaman utama
├── play.html     # Player (EmulatorJS)
├── style.css     # Styling premium dark-theme
├── app.js        # Logic library & ROM management
├── server.js     # HTTP server (Node.js built-in, tanpa npm)
├── start.bat     # Launcher Windows (double-click)
└── README.md
```

## Catatan ROM

- Proyek ini **tidak menyertakan ROM apapun**. Kamu harus menyediakan file ROM sendiri.
- Pastikan kamu memiliki hak legal atas ROM yang kamu mainkan.
- File `.gba` bisa diletakkan di folder `roms/` lalu diakses via URL `http://localhost:3000/roms/game.gba`.
