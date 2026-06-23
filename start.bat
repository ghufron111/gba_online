@echo off
title GBA Vault Server

:: ── Minta Administrator jika belum ──────────────────────────────
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Meminta hak Administrator...
    PowerShell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ── Sudah Admin — jalankan server ───────────────────────────────
color 0D
cls
echo.
echo  ==========================================
echo   GBA Vault - Local Server (PowerShell)
echo  ==========================================
echo.
echo  Memulai server di http://localhost:3000
echo  Tutup jendela ini untuk menghentikan.
echo.

PowerShell -ExecutionPolicy Bypass -File "%~dp0server.ps1" -OpenBrowser
pause
