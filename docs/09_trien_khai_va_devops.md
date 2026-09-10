# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 9: ĐÓNG GÓI, TRIỂN KHAI VÀ VẬN HÀNH HỆ THỐNG (DEVOPS & DEPLOYMENT)

---

## 9.1. KIẾN TRÚC TRIỂN KHAI ĐA DỊCH VỤ (DEPLOYMENT ARCHITECTURE)

Hệ thống **NeuroScan AI** được thiết kế để có thể triển khai linh hoạt trên cả môi trường On-Premises tại trung tâm dữ liệu bệnh viện lẫn môi trường Điện toán Đám mây (Cloud Infrastructure) thông qua công nghệ Container hóa (Docker) và Bộ điều phối (Docker Compose):

```
+-----------------------------------------------------------------------+
|                    MÁY CHỦ BỆNH VIỆN / CLOUD SERVER                  |
+-----------------------------------------------------------------------+
|                                                                       |
|  [Port 80 / 443] ---> [ NGINX REVERSE PROXY & GATEWAY CONTAINER ]     |
|                             |               |            |            |
|               /api/*        |         /ai/* |            | /* (SPA)   |
|                 v           |           v   |            v            |
|       +-------------------+ | +-----------+ | +---------------------+ |
|       | Node.js Core BE   | | | FastAPI AI| | | Expo Web Nginx App  | |
|       | Port: 5000        | | | Port: 8000| | | Port: 80 (Internal)| |
|       +-------------------+ | +-----------+ | +---------------------+ |
|                 |           |       |                                 |
|                 v           |       v                                 |
|       +------------------------------------+                          |
|       | MongoDB 7.0 Multi-Tenant Database  |                          |
|       | Data Volume: ./data/mongo_data     |                          |
|       +------------------------------------+                          |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 9.2. CẤU HÌNH DOCKER VÀ MULTI-STAGE BUILDS

Nhằm tối ưu hóa dung lượng hình ảnh Docker và gia tăng tính bảo mật, tất cả các thành phần đều được đóng gói bằng kỹ thuật **Multi-stage Build**:

1. **Frontend (Expo React Native Web):**
   - *Stage 1 (Builder):* Sử dụng Node.js 20 để cài đặt dependencies và chạy `npx expo export --platform web`.
   - *Stage 2 (Production):* Sao chép thư mục build tĩnh `dist/` sang máy chủ Nginx Alpine siêu nhẹ (Dung lượng image chỉ $\approx 25\text{MB}$, không chứa mã nguồn gốc).
2. **Backend (Node.js Express):**
   - Sử dụng Node.js 20 Alpine, chỉ cài đặt `dependencies` phục vụ runtime (bỏ qua `devDependencies`), cấu hình chạy dưới quyền người dùng không có đặc quyền root (`USER node`).
3. **AI Engine (Python FastAPI YOLOv8):**
   - Sử dụng base image `python:3.10-slim`, cài đặt PyTorch phiên bản CPU-optimized để tiết kiệm tài nguyên bộ nhớ, cấu hình Uvicorn worker đa luồng.
4. **Cơ sở dữ liệu MongoDB:**
   - Sử dụng bản dựng chính thức `mongo:7.0`, ánh xạ dữ liệu ra ổ đĩa máy chủ qua Docker Volume để đảm bảo dữ liệu bệnh nhân không bị mất khi khởi động lại container.

---

## 9.3. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG 1-CLICK (QUICK START GUIDE)

Hệ thống cung cấp 2 phương thức khởi chạy nhanh chóng và tiện lợi:

### Cách 1: Triển khai Tự động bằng Docker Compose (Khuyến nghị cho Sản xuất)
1. **Chuẩn bị cấu hình môi trường:**
   Sao chép file `.env.example` thành `.env` và điền các tham số kết nối.
2. **Khởi chạy toàn bộ hệ sinh thái:**
   ```bash
   docker-compose up --build -d
   ```
3. **Truy cập các dịch vụ:**
   - Cổng thông tin Bệnh viện (Web UI): `http://localhost`
   - Tài liệu API Backend Swagger/REST: `http://localhost:5000`
   - Cổng kiểm thử AI Engine Swagger: `http://localhost:8000/docs`

### Cách 2: Khởi chạy Cục bộ Bằng Script 1-Click (`run_all.bat` trên Windows)
Dành cho môi trường phát triển và hội đồng chấm thi chạy trực tiếp không qua Docker:
1. Mở thư mục gốc đồ án `team5/`.
2. Nhấp đúp chuột vào tệp [run_all.bat](file:///c:/Users/Administrator/OneDrive/Desktop/team5/run_all.bat).
3. Script sẽ tự động mở 3 cửa sổ dòng lệnh riêng biệt:
   - Cửa sổ 1: Khởi động Backend Node.js (`npm run dev` trên port 5000).
   - Cửa sổ 2: Khởi động AI Engine Python (`uvicorn main:app --reload` trên port 8000).
   - Cửa sổ 3: Khởi động Frontend Expo Web (`npx expo start --web` trên port 8081).
4. Mở trình duyệt Web tại địa chỉ `http://localhost:8081` để bắt đầu trải nghiệm hệ thống.

---

## 9.4. CHIẾN LƯỢC SAO LƯU DỮ LIỆU VÀ PHỤC HỒI THẢM HỌA (DISASTER RECOVERY)

1. **Sao lưu CSDL tự động (Automated Mongo Dump):**
   - Thiết lập cron job chạy hằng ngày lúc 00:00:
     ```bash
     mongodump --uri="mongodb://localhost:27017/neuroscan" --out=/backups/$(date +%Y%m%d)
     ```
2. **Lưu trữ ảnh DICOM an toàn:**
   - Thư mục `uploads/dicom-archives/` được cấu hình phân quyền ghi chỉ cho dịch vụ Backend, hỗ trợ đồng bộ bất đồng bộ lên kho lưu trữ đám mây S3/Google Cloud Storage để phục vụ lưu trữ bệnh án 10 năm theo quy định của Luật Khám bệnh, chữa bệnh.
