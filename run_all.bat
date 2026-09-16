@echo off
chcp 65001 >nul
title NeuroScan AI - Trinh Khoi Dong Da Dich Vu 1-Click

echo ==============================================================================
echo        HE THONG HO TRO CHAN DOAN HINH ANH MRI NAO VA QUAN LY BENH VIEN
echo                              NEUROSCAN AI
echo ==============================================================================
echo.

set "ROOT_DIR=%~dp0"

:: 1. Thong tin CSDL MongoDB
echo [1/3] Kiem tra ket noi CSDL MongoDB...
netstat -ano | findstr 27017 >nul
if %errorlevel% equ 0 (
    echo [OK] Phat hien MongoDB local dang chay tren cong 27017.
) else (
    echo [INFO] Backend mac dinh su dung MongoDB Atlas Cloud tu BE\.env.
)

:: 2. Khoi dong AI Engine (Python FastAPI YOLOv8)
echo.
echo [2/3] Dang khoi dong AI Engine (Python FastAPI YOLOv8 - Port 8000)...
start "NeuroScan - AI Engine (FastAPI YOLOv8)" cmd /k "cd /d "%ROOT_DIR%MRIteam_team5\MRIteam" && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: 3. Khoi dong Backend Node.js
echo.
echo [3/3] Dang khoi dong Core Backend (Node.js Express - Port 3000)...
start "NeuroScan - Core Backend (Node.js)" cmd /k "cd /d "%ROOT_DIR%BE" && npm run dev"

:: 4. Khoi dong Frontend Expo Web
echo.
echo ==============================================================================
echo [HOAN TAT] Cac dich vu nen da duoc khoi chay trong cac cua so rieng!
echo Dang mo giao dien Web tai dia chi http://localhost:8083 ...
echo ==============================================================================
echo.

cd /d "%ROOT_DIR%FE"
npm run web
