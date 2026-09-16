# NeuroScan AI - Multi-service Startup Script for PowerShell
$Host.UI.RawUI.WindowTitle = "NeuroScan AI - System Launcher"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "       HE THONG HO TRO CHAN DOAN HINH ANH MRI NAO VA QUAN LY BENH VIEN       " -ForegroundColor Yellow
Write-Host "                             NEUROSCAN AI                             " -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$ROOT_DIR = $PSScriptRoot

# 1. Kiem tra CSDL MongoDB
Write-Host "[1/3] Kiem tra ket noi CSDL MongoDB..." -ForegroundColor Green
$mongoPort = Get-NetTCPConnection -LocalPort 27017 -ErrorAction SilentlyContinue
if ($mongoPort) {
    Write-Host "[OK] Phat hien MongoDB local dang chay tren cong 27017." -ForegroundColor Green
} else {
    Write-Host "[INFO] Backend mac dinh su dung MongoDB Atlas Cloud tu BE\.env." -ForegroundColor Cyan
}

# 2. Khoi dong AI Engine (Python FastAPI YOLOv8)
Write-Host ""
Write-Host "[2/3] Dang khoi dong AI Engine (Python FastAPI YOLOv8 - Port 8000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$ROOT_DIR\MRIteam_team5\MRIteam`" && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

# 3. Khoi dong Backend Node.js
Write-Host ""
Write-Host "[3/3] Dang khoi dong Core Backend (Node.js Express - Port 3000)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k cd /d `"$ROOT_DIR\BE`" && npm run dev"

# 4. Khoi dong Frontend Expo Web
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "[HOAN TAT] Cac dich vu nen da duoc khoi chay trong cac cua so rieng!" -ForegroundColor Yellow
Write-Host "Dang mo giao dien Web tai dia chi http://localhost:8083 ..." -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "$ROOT_DIR\FE"
npm run web
