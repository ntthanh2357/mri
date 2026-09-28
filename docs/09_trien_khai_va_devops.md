# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 9: ĐÓNG GÓI, TRIỂN KHAI VÀ VẬN HÀNH HỆ THỐNG (DEVOPS & DEPLOYMENT)

---

## 9.1. KIẾN TRÚC TRIỂN KHAI ĐA DỊCH VỤ (DEPLOYMENT ARCHITECTURE)

Hệ thống **NeuroScan AI** được thiết kế để có thể triển khai linh hoạt trên cả hai mô hình hạ tầng: Mô hình On-Premises tại Trung tâm dữ liệu nội bộ của bệnh viện (nhằm tối đa hóa tốc độ mạng LAN và bảo vệ dữ liệu theo Luật An ninh mạng) và Mô hình Điện toán Đám mây (Cloud Hybrid) thông qua công nghệ Container hóa (Docker) và Bộ điều phối (Docker Compose):

```
+-------------------------------------------------------------------------------+
|                      MÁY CHỦ BỆNH VIỆN / CLOUD SERVER                         |
+-------------------------------------------------------------------------------+
|                                                                               |
|  [Port 80 / 443] ---> [ NGINX REVERSE PROXY & GATEWAY CONTAINER ]             |
|                             |                 |                 |             |
|               /api/*        |           /ai/* |                 | /* (SPA)    |
|                 │           |             │   |                 │             |
|                 ▼           |             ▼   |                 ▼             |
|       +-------------------+ |   +-----------+ |   +---------------------+     |
|       | Node.js Core BE   | |   | FastAPI AI| |   | Expo Web Nginx App  |     |
|       | Port: 5000        | |   | Port: 8000| |   | Port: 80 (Internal) |     |
|       +-------------------+ |   +-----------+ |   +---------------------+     |
|                 │           |         │                                       |
|                 ▼           |         ▼                                       |
|       +------------------------------------+                                  |
|       | MongoDB 7.0 Multi-Tenant Database  |                                  |
|       | Persistent Volume: ./data/mongo    |                                  |
|       +------------------------------------+                                  |
|                 │                                                             |
|                 ▼                                                             |
|       +------------------------------------+                                  |
|       | Shared Volume: /uploads/           |                                  |
|       | (imaging-results / dicom-archives) |                                  |
|       +------------------------------------+                                  |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

## 9.2. CẤU HÌNH DOCKER MULTI-STAGE BUILDS VÀ BẢO MẬT CONTAINER IMAGE

Nhằm tối ưu hóa dung lượng hình ảnh Docker và triệt tiêu nguy cơ rò rỉ khóa bảo mật (Secrets Leakage), tất cả các thành phần đều được đóng gói bằng kỹ thuật **Multi-stage Build** kết hợp với danh sách đen `.dockerignore` nghiêm ngặt:

### 9.2.1. Thắt Chặt Bảo Mật `.dockerignore` (Khắc Phục Lỗ Hổng Rò Rỉ Private Key)
Trong quá trình kiểm toán an ninh ([BUG-20260911-14](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/logic_bugs_postmortem.md)), nhóm phát hiện nguy cơ file Service Account của Google Cloud / Firebase bị đóng gói vào các tầng (layers) của Docker image. Hệ thống đã được tái cấu trúc bảo vệ tuyệt đối:
- **Xóa bỏ toàn bộ ngoại lệ whitelist:** Nghiêm cấm sử dụng cú pháp whitelist `!credentials.json`.
- **Danh sách đen chặn bắt buộc trong `.dockerignore`:**
  ```text
  credentials.json
  firebase-service-account.json
  *-service-account.json
  .env*
  *.json.key
  node_modules
  npm-debug.log
  .git
  ```
- **Xóa bỏ lệnh sao chép nhạy cảm trong `Dockerfile`:** Tuyệt đối không sử dụng `COPY credentials.json* ./`. Mọi tham số kết nối và chứng chỉ bảo mật trên môi trường sản xuất đều được nạp thông qua biến môi trường (Docker Secrets / Kubernetes Secrets / Vault).

### 9.2.2. Chi Tiết Đóng Gói Từng Thành Phần
1. **Frontend (Expo React Native Web App):**
   - *Stage 1 (Builder):* Sử dụng Node.js 20 Alpine cài đặt dependencies và thực thi lệnh tối ưu `npx expo export --platform web`.
   - *Stage 2 (Production Server):* Sao chép các tệp tĩnh đã tối ưu từ thư mục `dist/` sang base image Nginx Alpine siêu nhẹ. Dung lượng image thành phẩm chỉ $\approx 25\text{MB}$, không chứa mã nguồn Javascript gốc.
2. **Backend (Node.js Express Core):**
   - Sử dụng `node:20-alpine`, chỉ cài đặt `dependencies` phục vụ runtime (bỏ qua `devDependencies` như `fast-check`, `mongodb-memory-server`), cấu hình chạy dưới quyền người dùng không có đặc quyền root (`USER node`).
3. **AI Engine (Python FastAPI YOLOv8 + MAICS):**
   - Sử dụng `python:3.10-slim`, cài đặt PyTorch phiên bản CPU/GPU phù hợp với phần cứng bệnh viện, cấu hình worker Uvicorn đa luồng và giới hạn vùng nhớ đệm tạm.
4. **Cơ Sở Dữ Liệu MongoDB:**
   - Sử dụng bản dựng chính thức `mongo:7.0`, ánh xạ dữ liệu qua Docker Volume (`./data/mongo`) nhằm bảo đảm dữ liệu bệnh án không bị ảnh hưởng khi container được cập nhật hoặc khởi động lại.

---

## 9.3. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG (QUICK START GUIDE)

Hệ thống hỗ trợ 2 phương thức vận hành nhanh chóng và linh hoạt:

### Cách 1: Triển Khai Tự Động Bằng Docker Compose (Khuyến nghị Môi trường Sản xuất)
1. **Chuẩn bị file cấu hình môi trường:**
   Sao chép `.env.example` thành `.env` và thiết lập các biến kết nối (JWT Secret, MongoDB URI, PayOS API Key).
2. **Khởi chạy toàn bộ hệ sinh thái đa container:**
   ```bash
   docker-compose up --build -d
   ```
3. **Kiểm tra trạng thái các container:**
   ```bash
   docker-compose ps
   ```
4. **Địa chỉ truy cập dịch vụ:**
   - Cổng thông tin Bệnh viện (Web UI): `http://localhost`
   - Tài liệu API RESTful Backend: `http://localhost:5000/api`
   - Cổng Swagger kiểm thử AI Engine: `http://localhost:8000/docs`

### Cách 2: Khởi Chạy Cục Bộ Bằng Script 1-Click (`run_all.bat` trên Windows)
Dành cho môi trường phát triển (Dev) và Hội đồng đánh giá đồ án chạy trực tiếp trên máy tính cá nhân mà không cần cài đặt Docker:
1. Mở thư mục gốc của dự án `team5/`.
2. Nhấp đúp chuột vào tệp script [run_all.bat](file:///c:/Users/Administrator/OneDrive/Desktop/team5/run_all.bat).
3. Script sẽ tự động mở 3 cửa sổ dòng lệnh riêng biệt:
   - Cửa sổ 1: Khởi động Backend Node.js (`npm run dev` trên cổng 5000).
   - Cửa sổ 2: Khởi động AI Engine Python (`uvicorn main:app --reload` trên cổng 8000).
   - Cửa sổ 3: Khởi động Frontend Expo Web (`npx expo start --web` trên cổng 8081).
4. Trình duyệt tự động mở địa chỉ `http://localhost:8081` để bắt đầu trải nghiệm toàn diện hệ thống.

---

## 9.4. CHIẾN LƯỢC SAO LƯU DỮ LIỆU VÀ PHỤC HỒI THẢM HỌA (DISASTER RECOVERY)

1. **Sao Lưu Cơ Sở Dữ Liệu Tự Động (Automated Mongo Dump):**
   - Thiết lập lịch trình Cron Job chạy tự động hàng ngày vào lúc 00:00:
     ```bash
     mongodump --uri="mongodb://localhost:27017/neuroscan" --gzip --out=/backups/mongo_$(date +%Y%m%d)
     ```
   - Dữ liệu sao lưu được nén Gzip và đẩy lên kho lưu trữ đám mây biệt lập (Cold Storage).
2. **Tuân Thủ Thời Hạn Lưu Trữ Bệnh Án Theo Luật Định:**
   - Tuân thủ Điều 15 Thông tư 46/2018/TT-BYT và Luật Khám bệnh, chữa bệnh 15/2023:
     - Hồ sơ bệnh án thông thường: Lưu trữ tối thiểu **10 năm**.
     - Bệnh án nội trú thần kinh: Lưu trữ tối thiểu **20 năm**.
     - Bệnh án ung thư não (Glioma): Lưu trữ tối thiểu **30 năm**.
     - Dữ liệu thử nghiệm lâm sàng: Lưu trữ **25 năm** theo chuẩn ICH-GCP E6(R2).
   - Thiết lập **Lệnh giữ pháp lý (Legal Hold)**: Tự động phong tỏa không cho phép tiêu hủy các hồ sơ bệnh án đang có tranh chấp y khoa hoặc kiểm toán bảo hiểm.
3. **Định Kỳ Kiểm Định Toàn Vẹn Chuỗi Băm (Automated Hash Chain Verification):**
   - Thiết lập tác vụ kiểm toán tự động chạy mỗi tuần một lần, rà soát toàn bộ chuỗi băm Cryptographic Hash Chain. Bất kỳ sự sai khác nào do can thiệp cơ sở dữ liệu đều phát sinh cảnh báo SIEM khẩn cấp và gửi thông báo tới Ban Giám đốc Bệnh viện.
