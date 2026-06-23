# ═══════════════════════════════════════════════════════════════
#  GBA Vault — server.ps1
#  HTTP server menggunakan .NET HttpListener (PowerShell built-in)
#  Jalankan: .\server.ps1
#  Akses   : http://localhost:3000
# ═══════════════════════════════════════════════════════════════

param(
    [int]    $Port    = 3000,
    [string] $Root    = $PSScriptRoot,
    [switch] $OpenBrowser
)

# ── MIME Types ────────────────────────────────────────────────────
$MimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json'
    '.wasm' = 'application/wasm'
    '.gba'  = 'application/octet-stream'
    '.gbc'  = 'application/octet-stream'
    '.gb'   = 'application/octet-stream'
    '.zip'  = 'application/zip'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.map'  = 'application/json'
}

# ── Dapatkan IP LAN ───────────────────────────────────────────────
function Get-LanIPs {
    $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
           Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.ToString() -ne '127.0.0.1' } |
           ForEach-Object { $_.ToString() }
    return $ips
}

# ── Banner ────────────────────────────────────────────────────────
Clear-Host
$lanIPs = Get-LanIPs

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor DarkMagenta
Write-Host "  ║          🎮  GBA Vault — Local Server            ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor DarkMagenta
Write-Host ""
Write-Host "  ✅  Server berjalan!" -ForegroundColor Green
Write-Host ""
Write-Host "  📍  Lokal    → " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:$Port" -ForegroundColor Cyan
foreach ($ip in $lanIPs) {
    Write-Host "  🌐  Jaringan → " -NoNewline -ForegroundColor Gray
    Write-Host "http://${ip}:$Port" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Tekan Ctrl+C untuk menghentikan." -ForegroundColor DarkGray
Write-Host "  ──────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Setup Listener ────────────────────────────────────────────────
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "  ❌  Gagal membuka port $Port. Coba:" -ForegroundColor Red
    Write-Host "      .\server.ps1 -Port 8080" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Atau jalankan PowerShell sebagai Administrator." -ForegroundColor DarkGray
    exit 1
}

# Buka browser otomatis
if ($OpenBrowser) {
    Start-Process "http://localhost:$Port"
}

# ── Helper: kirim response ────────────────────────────────────────
function Send-Response {
    param($ctx, $StatusCode, $ContentType, $Body)
    $ctx.Response.StatusCode  = $StatusCode
    $ctx.Response.ContentType = $ContentType
    if ($Body -is [byte[]]) {
        $ctx.Response.ContentLength64 = $Body.Length
        $ctx.Response.OutputStream.Write($Body, 0, $Body.Length)
    } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $ctx.Response.OutputStream.Close()
}

function Get-404Html($path) {
    return @"
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>404 - GBA Vault</title>
<style>
  body{font-family:system-ui,sans-serif;background:#07070f;color:#f1f0ff;
       display:flex;flex-direction:column;align-items:center;justify-content:center;
       min-height:100vh;gap:1rem;text-align:center;margin:0}
  h1{font-size:5rem;margin:0;color:#7c3aed;line-height:1}
  p{color:#8b8aaa;max-width:400px}
  code{background:rgba(255,255,255,0.08);padding:0.2em 0.5em;border-radius:4px;font-size:0.9em}
  a{color:#a855f7}
</style></head>
<body>
  <h1>404</h1>
  <p>File tidak ditemukan: <code>$path</code></p>
  <a href="/">← Kembali ke Library</a>
</body></html>
"@
}

# ── Main Loop ─────────────────────────────────────────────────────
Write-Host "  Menunggu request..." -ForegroundColor DarkGray

try {
    while ($listener.IsListening) {
        # Tunggu request (blocking tapi bisa di-Ctrl+C)
        $asyncResult = $listener.BeginGetContext($null, $null)
        while (-not $asyncResult.IsCompleted) {
            Start-Sleep -Milliseconds 100
            # Cek Ctrl+C
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                if ($key.Key -eq 'C' -and $key.Modifiers -eq 'Control') {
                    throw [System.OperationCanceledException]::new("Dihentikan oleh pengguna")
                }
            }
        }

        $ctx = $listener.EndGetContext($asyncResult)
        $req = $ctx.Request
        $res = $ctx.Response

        # Tambahkan header CORS & COEP (wajib untuk EmulatorJS / SharedArrayBuffer)
        $res.AddHeader('Access-Control-Allow-Origin',   '*')
        # $res.AddHeader('Cross-Origin-Opener-Policy',    'same-origin')
        # $res.AddHeader('Cross-Origin-Embedder-Policy', 'credentialless')
        $res.AddHeader('X-Content-Type-Options',        'nosniff')

        # Parse URL
        $rawUrl = $req.Url.AbsolutePath
        try { $rawUrl = [System.Uri]::UnescapeDataString($rawUrl) } catch {}

        # Default → index.html
        if ($rawUrl -eq '/' -or $rawUrl -eq '') { $rawUrl = '/index.html' }

        # Resolve path — cegah traversal
        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $rawUrl.TrimStart('/')))
        if (-not $filePath.StartsWith($Root)) {
            Send-Response $ctx 403 'text/plain' '403 Forbidden'
            continue
        }

        # Jika directory → coba index.html di dalamnya
        if ([System.IO.Directory]::Exists($filePath)) {
            $filePath = [System.IO.Path]::Combine($filePath, 'index.html')
        }

        # Cek file ada
        if (-not [System.IO.File]::Exists($filePath)) {
            $body404 = Get-404Html $rawUrl
            Send-Response $ctx 404 'text/html; charset=utf-8' $body404
            $time = Get-Date -Format "HH:mm:ss"
            Write-Host "  [$time] 404  $rawUrl" -ForegroundColor DarkRed
            continue
        }

        # MIME type
        $ext      = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mimeType = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { 'application/octet-stream' }

        # Baca & kirim file
        try {
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.StatusCode     = 200
            $res.ContentType    = $mimeType
            $res.ContentLength64 = $fileBytes.Length

            # Cache: HTML tidak di-cache, lainnya 1 jam
            if ($ext -eq '.html') {
                $res.AddHeader('Cache-Control', 'no-cache')
            } else {
                $res.AddHeader('Cache-Control', 'public, max-age=3600')
            }

            $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            $res.OutputStream.Close()

            $time = Get-Date -Format "HH:mm:ss"
            $size = if ($fileBytes.Length -lt 1024) { "$($fileBytes.Length) B" }
                    elseif ($fileBytes.Length -lt 1MB) { "$([math]::Round($fileBytes.Length/1KB,1)) KB" }
                    else { "$([math]::Round($fileBytes.Length/1MB,2)) MB" }

            Write-Host "  [$time] 200  $rawUrl  ($size)" -ForegroundColor DarkGreen
        } catch {
            Send-Response $ctx 500 'text/plain' "Server error: $_"
        }
    }
} catch [System.OperationCanceledException] {
    Write-Host ""
    Write-Host "  Server dihentikan." -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "  Error: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    Write-Host "  Sampai jumpa! 🎮" -ForegroundColor Magenta
    Write-Host ""
}
