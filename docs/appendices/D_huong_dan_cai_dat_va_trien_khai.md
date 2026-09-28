# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# PHỤ LỤC D: HƯỚNG DẪN CÀI ĐẶT VÀ TRIỂN KHAI HỆ THỐNG (INSTALLATION & DEPLOYMENT GUIDE)

---

## D.1. TỔNG QUAN VỀ PHƯƠNG ÁN TRIỂN KHAI

Hệ thống **NeuroScan AI** được thiết kế linh hoạt nhằm đáp ứng tối đa hai nhu cầu sử dụng thực tế:
1. **Môi trường Trình diễn & Sản xuất (Production / Demo với Hội đồng):** Sử dụng công nghệ Container hóa **Docker & Docker Compose** để đóng gói toàn bộ hệ sinh thái (Frontend, Backend, AI Engine, Database, Nginx Gateway) vào một môi trường cô lập, chỉ cần **1 câu lệnh duy nhất** là toàn bộ hệ thống hoạt động đồng bộ.
2. **Môi trường Phát triển & Kiểm thử Cục bộ (Local Development / Không dùng Docker):** Dành cho các máy tính cá nhân chưa cài đặt Docker hoặc sinh viên muốn can thiệp trực tiếp vào mã nguồn từng dịch vụ. Hệ thống cung cấp tệp thực thi [run_all.bat](file:///c:/Users/Administrator/OneDrive/Desktop/team5/run_all.bat) để tự động hóa việc khởi động đồng thời 3 dịch vụ trên nền tảng Windows.

---

## D.2. BẢNG SO SÁNH HAI PHƯƠNG THỨC KHỞI CHẠY

| Tiêu chí so sánh | Phương án 1: Dùng Docker Compose | Phương án 2: Chạy Thủ Công (run_all.bat) |
| :--- | :--- | :--- |
| **Yêu cầu cài đặt máy chủ** | Chỉ cần cài đặt duy nhất **Docker Desktop** | Cài đặt Node.js 20, Python 3.10, MongoDB 7.0 |
| **Độ phức tạp khởi chạy** | Cực kỳ đơn giản: `docker-compose up -d` | Khởi chạy 1-click qua `run_all.bat` (hoặc mở 3 terminal) |
| **Mức độ phụ thuộc môi trường** | $0\%$ (Chạy nhất quán trên mọi HĐH Windows/Mac/Linux) | Phụ thuộc vào phiên bản Python, Node và Path biến môi trường |
| **Tốc độ Hot-Reload khi sửa code** | Chậm hơn (phải cấu hình volume mount) | Nhanh tức thì (Nodemon, Uvicorn --reload, Expo Metro) |
| **Khuyến nghị sử dụng** | **Dành cho buổi chấm bảo vệ đồ án tốt nghiệp** | **Dành cho quá trình phát triển mã nguồn hàng ngày** |

---

## D.3. PHƯƠNG ÁN 1: TRIỂN KHAI 1-CLICK BẰNG DOCKER COMPOSE

### Bước 1: Yêu cầu phần cứng & phần mềm
- Máy tính cài đặt hệ điều hành Windows 10/11 (64-bit), macOS hoặc Ubuntu Linux.
- Đã cài đặt **Docker Desktop** (bản 4.20 trở lên) và bật tính năng WSL2 backend trên Windows.
- Tối thiểu 8GB RAM (khuyến nghị 16GB để đảm bảo AI Engine suy luận mượt mà).

### Bước 2: Chuẩn bị tệp cấu hình môi trường
Tại thư mục gốc dự án `team5/`, sao chép tệp cấu hình mẫu:
```bash
# Trên Windows PowerShell hoặc CMD:
copy .env.example .env
```

### Bước 3: Khởi chạy toàn bộ hệ sinh thái dịch vụ
Mở terminal tại thư mục gốc dự án và thực thi:
```bash
docker-compose up --build -d
```

> **Giải thích cơ chế vận hành của Docker Compose:**
> Lệnh trên sẽ tự động kích hoạt 5 container phối hợp nhịp nhàng:
> 1. `neuroscan-mongodb`: Khởi động MongoDB 7.0 với volume lưu trữ bền vững `mongo_data`.
> 2. `neuroscan-backend`: Build image Node.js Express, cài đặt runtime dependencies, kết nối đến MongoDB và lắng nghe cổng 5000.
> 3. `neuroscan-ai`: Build image Python 3.10, nạp mô hình YOLOv8 (`yolov8n.pt`), nạp bộ tiền xử lý ảnh và lắng nghe cổng 8000.
> 4. `neuroscan-frontend`: Build bản phân phối tĩnh Expo Web (`dist/`) và đưa vào Nginx container siêu nhẹ.
> 5. `neuroscan-gateway`: Nginx Reverse Proxy làm cổng điều phối trung tâm tại cổng 80, tự động định tuyến traffic:
>    - `http://localhost/` $\rightarrow$ Frontend UI
>    - `http://localhost/api/*` $\rightarrow$ Backend REST API
>    - `http://localhost/ai/*` $\rightarrow$ AI Inference Engine

### Bước 4: Kiểm tra trạng thái và nạp dữ liệu mẫu (Seed Data)
1. Kiểm tra trạng thái các container:
   ```bash
   docker ps
   ```
2. Khởi tạo dữ liệu mẫu bệnh viện, bác sĩ, bảng giá và giường bệnh:
   ```bash
   docker exec -it neuroscan-backend node src/seedAll.js
   ```
3. Truy cập các địa chỉ dịch vụ:
   - **Cổng thông tin Bệnh viện (Web EMR):** `http://localhost`
   - **Tài liệu kiểm thử API Backend:** `http://localhost:5000`
   - **Tài liệu Swagger AI Engine:** `http://localhost:8000/docs`

### Bước 5: Dừng hệ thống khi kết thúc
```bash
docker-compose down
```

---

## D.4. PHƯƠNG ÁN 2: TRIỂN KHAI CỤC BỘ THỦ CÔNG (MANUAL / RUN_ALL.BAT)

Phương án này phù hợp cho quá trình lập trình sửa đổi mã nguồn hoặc máy tính không cài đặt Docker.

### Bước 1: Cài đặt các phần mềm nền tảng bắt buộc
1. **Node.js:** Tải và cài đặt Node.js phiên bản **v20.x LTS** từ [nodejs.org](https://nodejs.org).
2. **Python:** Tải và cài đặt **Python 3.10.x** từ [python.org](https://python.org) (Lưu ý tích chọn ô *"Add Python to PATH"*).
3. **MongoDB Community Server:** Cài đặt **MongoDB 7.0** và **MongoDB Compass** từ [mongodb.com](https://www.mongodb.com). Đảm bảo dịch vụ MongoDB service đang chạy ở cổng mặc định `27017`.

---

### Bước 2: Cài đặt & Khởi tạo Backend (`BE/`)
Mở cửa sổ dòng lệnh tại thư mục `BE/`:
```bash
cd BE

# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Cấu hình biến môi trường
# Tạo file .env nếu chưa có với nội dung tối thiểu:
# PORT=5000
# MONGO_URI=mongodb://localhost:27017/neuroscan
# JWT_SECRET=neuroscan_secret_dev_key_2026
# AI_SERVER_URL=http://localhost:8000/predict

# 3. Nạp dữ liệu mẫu ban đầu (bắt buộc cho lần đầu tiên)
node src/seedAll.js

# 4. Chạy kiểm thử tự động xác nhận hệ thống
npm test
```

---

### Bước 3: Cài đặt & Khởi tạo AI Engine (`MRIteam_team5/MRIteam/`)
Mở cửa sổ dòng lệnh thứ hai tại thư mục `MRIteam_team5/MRIteam/`:
```bash
cd MRIteam_team5/MRIteam

# 1. Tạo môi trường ảo Python (khuyến nghị)
python -m venv venv
.\venv\Scripts\activate

# 2. Cài đặt các thư viện thị giác máy tính và AI
pip install fastapi uvicorn pydantic python-dotenv opencv-python pillow ultralytics tensorflow google-genai numpy

# 3. Kiểm tra tệp trọng số mô hình YOLOv8
# Đảm bảo tệp yolov8n.pt đã có sẵn trong thư mục

# 4. Khởi động AI Microservice
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Bước 4: Cài đặt & Khởi tạo Frontend (`FE/`)
Mở cửa sổ dòng lệnh thứ ba tại thư mục `FE/`:
```bash
cd FE

# 1. Cài đặt các gói giao diện người dùng
npm install

# 2. Khởi chạy giao diện Expo Web
npx expo start --web
```
Trình duyệt sẽ tự động mở trang web bệnh viện tại địa chỉ: `http://localhost:8081`.

---

### Bước 5: Khởi động Nhanh Bằng Kịch Bản 1-Click ([run_all.bat](file:///c:/Users/Administrator/OneDrive/Desktop/team5/run_all.bat))
Sau khi đã cài đặt dependencies cho cả 3 thư mục, bạn không cần phải mở từng terminal thủ công. Chỉ cần:
1. Mở thư mục gốc `team5/`.
2. **Nhấp đúp chuột (Double click)** vào tệp [run_all.bat](file:///c:/Users/Administrator/OneDrive/Desktop/team5/run_all.bat).
3. Script sẽ tự động chia thành 3 cửa sổ console độc lập chạy song song, hiển thị trực quan nhật ký (logs) của từng dịch vụ.

---

## D.5. HƯỚNG DẪN XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Lỗi xung đột cổng mạng (Port Already in Use)
- **Hiện tượng:** Backend báo lỗi `EADDRINUSE: address already in use :::5000` hoặc AI Service báo lỗi cổng `8000`.
- **Nguyên nhân:** Tiến trình cũ chưa tắt hẳn hoặc có ứng dụng khác đang chiếm dụng cổng.
- **Cách khắc phục trên Windows:**
  ```powershell
  # Tìm PID đang chiếm cổng 5000:
  netstat -ano | findstr :5000
  # Tiêu diệt tiến trình (thay PID bằng số thực tế):
  taskkill /PID <PID_NUMBER> /F
  ```

### 2. Lỗi kết nối Cơ sở dữ liệu MongoDB (`ECONNREFUSED 127.0.0.1:27017`)
- **Hiện tượng:** Backend crash ngay khi khởi động với thông báo *"Database connection failed"*.
- **Cách khắc phục:**
  1. Mở menu Start gõ `services.msc`.
  2. Tìm dịch vụ có tên **MongoDB Server**.
  3. Nhấp chuột phải chọn **Start** (hoặc **Restart**).

### 3. Lỗi chặn tên miền chéo (CORS blocked) trên Trình duyệt
- **Hiện tượng:** Frontend không gọi được API, console trình duyệt báo đỏ *"Access to XMLHttpRequest blocked by CORS policy"*.
- **Cách khắc phục:**
  - Kiểm tra file `BE/src/index.js`. Danh sách `corsOrigins` đã được cấu hình tự động chấp nhận `http://localhost:8081` và `http://localhost:3000`. Hãy đảm bảo bạn truy cập đúng cổng đã được cấp phép trong danh sách whitelist.

### 4. Lỗi thiếu thư viện Visual C++ khi import OpenCV trên Windows
- **Hiện tượng:** Python báo lỗi `ImportError: DLL load failed while importing cv2`.
- **Cách khắc phục:** Tải và cài đặt gói bổ trợ chính thức của Microsoft: **Visual C++ Redistributable 2015-2022 (x64)** từ trang chủ Microsoft và khởi động lại máy tính.

---

## D.6. TÀI KHOẢN TRẢI NGHIỆM HỆ THỐNG MẪU (DEMO ACCOUNTS)

Sau khi chạy lệnh nạp dữ liệu mẫu (`seedAll.js`), hệ thống cung cấp sẵn các tài khoản sau:

| Vai trò lâm sàng | Tên đăng nhập | Mật khẩu | Chức năng kiểm thử chính |
| :--- | :--- | :---: | :--- |
| **Bác sĩ Khám Lâm sàng** | `doctor.noithankinh@hospital.com` | `123456` | Khám bệnh, kê đơn, chỉ định chụp MRI não, bảng kiểm an toàn MRI |
| **Kỹ thuật viên CĐHA** | `ktv.hinhanh@hospital.com` | `123456` | Hàng chờ chụp, duyệt bảng kiểm, tải lát cắt MRI + DICOM zip |
| **Bác sĩ Chẩn đoán hình ảnh** | `radiologist.khoacda@hospital.com` | `123456` | Xem AI Heatmap/Bounding box, ký duyệt số điện tử kết quả |
| **Điều dưỡng / Tiếp đón** | `nurse.tiepdon@hospital.com` | `123456` | Tiếp đón bệnh nhân, kiểm tra BHYT, xếp buồng giường nội trú |
| **Quản trị viên Bệnh viện** | `admin.bv@hospital.com` | `123456` | Quản trị nhân sự khoa phòng, phân quyền người dùng, báo cáo viện phí |
| **Bệnh nhân tra cứu** | `benhnhan.test@gmail.com` | `123456` | Xem hồ sơ bệnh án EMR cá nhân, tải hình ảnh MRI và đơn thuốc |
