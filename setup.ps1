<#
.SYNOPSIS
  AGY Video Studio v2 — 1-Click Environment Setup for Windows
.EXAMPLE
  .\setup.ps1
  .\setup.ps1 -InstallVieNeu -BuildPortable
#>
param(
  [switch]$BuildPortable,
  [switch]$InstallVieNeu
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  AGY Video Studio v2 — Automated Setup" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

function Require-Tool {
  param(
    [string]$Cmd,
    [string]$Label,
    [string]$InstallHint
  )
  $found = Get-Command $Cmd -ErrorAction SilentlyContinue
  if (-not $found) {
    Write-Host "[ERROR] Missing required tool: $Label" -ForegroundColor Red
    Write-Host "        Install with: $InstallHint" -ForegroundColor Yellow
    exit 1
  }
}

Require-Tool -Cmd "node" -Label "Node.js 20+" -InstallHint "winget install OpenJS.NodeJS.LTS"
Require-Tool -Cmd "python" -Label "Python 3.10+" -InstallHint "winget install Python.Python.3.12"
Require-Tool -Cmd "ffmpeg" -Label "FFmpeg" -InstallHint "winget install Gyan.FFmpeg"

$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) {
  Write-Host "[ERROR] Node.js 20+ required (found $(node -v)). Update via: winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
  exit 1
}

Write-Host "[1/6] Installing Node.js dependencies..." -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[2/6] Installing Python dependencies (requirements.txt)..." -ForegroundColor Green
python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($InstallVieNeu) {
  Write-Host "[2b] Installing optional VieNeu-TTS offline Vietnamese engine..." -ForegroundColor Green
  if (-not (Get-Command "espeak-ng" -ErrorAction SilentlyContinue) -and -not (Test-Path "C:\Program Files\eSpeak NG\espeak-ng.exe")) {
    Write-Host "[WARN] eSpeak NG not found. Installing via winget..." -ForegroundColor Yellow
    winget install eSpeak-NG.eSpeak-NG
  }
  python scripts/setup-vieneu-tts.py --install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  python scripts/setup-vieneu-tts.py | Out-Null
}

Write-Host "[3/6] Creating .env from .env.example (if missing)..." -ForegroundColor Green
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "      Created .env — add optional API keys in App Settings or .env." -ForegroundColor Gray
}

Write-Host "[4/6] Installing / syncing /agy-video-studio AI skill..." -ForegroundColor Green
npm run install:skill
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($BuildPortable) {
  Write-Host "[5/6] Building Portable Desktop App (release/AGY-Video-Studio/)..." -ForegroundColor Green
  npm run build:portable
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm run install:skill
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "[5/6] Skipping portable .exe build (pass -BuildPortable to build release/AGY-Video-Studio/)." -ForegroundColor Gray
}

Write-Host "[6/6] Checking toolchain & GPU status..." -ForegroundColor Green
node cli/agy-studio.mjs info | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Cyan
Write-Host "  - Run Desktop Dev App:   npm run dev" -ForegroundColor White
Write-Host "  - Build Portable (.exe): npm run build:portable" -ForegroundColor White
Write-Host "  - Optional VieNeu-TTS:   .\setup.ps1 -InstallVieNeu" -ForegroundColor White
Write-Host "  - Or invoke /agy-video-studio in your AI assistant!" -ForegroundColor White
Write-Host ""
