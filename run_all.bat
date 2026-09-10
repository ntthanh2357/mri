@echo off
chcp 65001 >nul
title NeuroScan AI - Trình Khởi Động Đa Dịch Vụ 1-Click

echo ==============================================================================
echo        HỆ THỐNG HỖ TRỢ CHẨN ĐOÁN HÌNH ẢNH MRI NÃO & QUẢN LÝ BỆNH VIỆN
echo                              NEUROSCAN AI
echo ==============================================================================
echo.

set ROOT_DIR=%~dp0

:: 1. Kiểm tra CSDL MongoDB
echo [1/3] Đang kiểm tra cổng kết nối CSDL MongoDB (Port 27017)...
netstat -ano | findstr 27017 >nul
if %errorlevel% neq 0 (
    echo [THÔNG BÁO] CSDL MongoDB chưa chạy. Đang tự động kích hoạt máy chủ mongod...
    start "NeuroScan - MongoDB 7.0 Server" cmd /k "mongod --dbpath ^"%ROOT_DIR%BE\scratch\data\db^" --port 27017"
    timeout /t 3 >nul
) else (
    echo [OK] CSDL MongoDB đang hoạt động trên cổng 27017.
)

:: 2. Khởi động AI Engine (Python FastAPI YOLOv8)
echo.
echo [2/3] Đang khởi động AI Engine (Python FastAPI YOLOv8 - Port 8000)...
start "NeuroScan - AI Engine (FastAPI YOLOv8)" cmd /k "cd /d ^"%ROOT_DIR%MRIteam_team5\MRIteam^" && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: 3. Khởi động Backend Node.js
echo.
echo [3/3] Đang khởi động Core Backend (Node.js Express - Port 3000)...
start "NeuroScan - Core Backend (Node.js)" cmd /k "cd /d ^"%ROOT_DIR%BE^" && npm run dev"

:: 4. Khởi động Frontend Expo Web
echo.
echo ==============================================================================
echo [HOÀN TẤT] Các dịch vụ nền đã được khởi chạy thành công!
echo Hệ thống đang mở giao diện Web tại địa chỉ http://localhost:8083 ...
echo ==============================================================================
echo.

cd /d "%ROOT_DIR%FE"
npm run web
