# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 5: ĐẶC TẢ KỸ THUẬT API RESTFUL VÀ CƠ CHẾ TÍCH HỢP

---

## 5.1. QUY CHUẨN THIẾT KẾ VÀ XÁC THỰC BẢO MẬT (API STANDARDS & SECURITY)

Toàn bộ hệ thống API của **NeuroScan AI** được thiết kế tuân theo kiến trúc RESTful cấp độ 2 (Richardson Maturity Model Level 2) kết hợp các cơ chế bảo mật cấp độ doanh nghiệp:

1. **Giao thức và Định dạng dữ liệu:** Mọi kết nối đều bắt buộc sử dụng HTTPS mã hóa TLS 1.3, payload trao đổi dạng JSON (UTF-8), ngoại trừ luồng truyền tải ảnh y tế sử dụng `multipart/form-data` qua Multer Stream.
2. **Cơ chế Xác thực & Ngữ cảnh Đa Cơ sở (Authentication & Tenant Binding):**
   - Người dùng đăng nhập nhận được cặp `accessToken` (thời hạn 1 giờ) và `refreshToken` (thời hạn 7 ngày).
   - Header bắt buộc cho mọi yêu cầu nghiệp vụ: `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
   - Cấu trúc Payload của JWT Token chứa định danh tài khoản, vai trò và mã cơ sở y tế:
     ```json
     {
       "id": "6640abcde123456789012345",
       "email": "dr.hoang@bachmai.vn",
       "role": "doctor",
       "hospitalId": "664011112222333344445555",
       "iat": 1715424000,
       "exp": 1715427600
     }
     ```
3. **Phân quyền người dùng (Role-Based Access Control - RBAC):**
   - Middleware `checkRole(['admin', 'doctor', 'technician', 'nurse', 'patient'])` kiểm soát chặt chẽ thẩm quyền tại từng Endpoint.
   - Tuyệt đối không đọc vai trò từ `req.body` hay `req.query`, toàn bộ phân quyền dựa trên `req.user.role` từ Token hợp lệ.
4. **Phòng chống tấn công Algorithm Confusion:** Chặn đứng các token giả mạo khai báo `alg: "none"` hoặc tấn công hoán đổi khóa đối xứng/bất đối xứng.

---

## 5.2. ĐẶC TẢ CHI TIẾT CÁC NHÓM API NGHIỆP VỤ Y TẾ CỐT LÕI

### 5.2.1. Nhóm API Quản lý Ca khám & Máy trạng thái FSM (`/api/v1/visits`)

#### 1. Lấy Hàng đợi Chụp cho Kỹ thuật viên (Technician Work Queue)
- **Endpoint:** `GET /api/v1/visits/queue`
- **Quyền hạn:** `technician`, `doctor`, `admin`
- **Mô tả:** Trả về danh sách bệnh nhân đang chờ chụp MRI (`cho_chup`, `cho_chup_lai`), đã tự động chuẩn hóa ngày theo giờ Việt Nam `Asia/Ho_Chi_Minh` (+07:00), populate thông tin bệnh nhân, bác sĩ chỉ định và trạng thái viện phí.
- **Phản hồi thành công (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "664022223333444455556666",
        "status": "cho_chup",
        "priority": "khẩn cấp",
        "patientId": {
          "fullName": "Nguyễn Văn An",
          "insuranceNumber": "DN4010123456789",
          "gender": "Nam",
          "dateOfBirth": "1980-05-12T00:00:00.000Z"
        },
        "doctorId": {
          "profile": { "fullName": "BS. CKI Trần Hoàng" }
        },
        "invoiceId": {
          "status": "paid",
          "totalAmount": 1500000
        },
        "mriSafetyChecklist": {
          "isScreened": false,
          "passed": false
        }
      }
    ]
  }
  ```

#### 2. Nộp Bảng kiểm An toàn buồng chụp MRI (Submit Safety Checklist)
- **Endpoint:** `POST /api/v1/visits/:id/mri-safety-check`
- **Quyền hạn:** `technician`, `doctor`
- **Mô tả:** Thẩm định 4 tiêu chí an toàn trước buồng máy. Nếu có kim loại hoặc máy tạo nhịp tim, hệ thống từ chối ngay lập tức với cảnh báo chống chỉ định tuyệt đối.
- **Request Body mẫu:**
  ```json
  {
    "hasPacemakerOrMetal": false,
    "hasClaustrophobia": false,
    "hasKidneyDisease": false,
    "isPregnant": false,
    "metalDetails": "",
    "notes": "Bệnh nhân tỉnh táo, tiếp xúc tốt, không có dị vật từ tính"
  }
  ```
- **Phản hồi thành công (200 OK):** Chuyển trạng thái sang `dang_chup`, lưu vết người kiểm tra.
- **Phản hồi khi có chống chỉ định (400 Bad Request):**
  ```json
  {
    "success": false,
    "message": "CẢNH BÁO CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI: Bệnh nhân mang máy tạo nhịp tim hoặc dị vật kim loại từ tính! Không được phép cho vào buồng chụp MRI."
  }
  ```

#### 3. Chuyển Đổi Trạng Thái Ca Khám Tuân Thủ FSM
- **Endpoint:** `PUT /api/v1/visits/:id/status`
- **Quyền hạn:** `doctor`, `technician`, `nurse`, `admin`
- **Request Body:** `{ "status": "cho_bac_si_doc" }`
- **Xử lý FSM:** Kiểm tra `ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)`. Nếu vi phạm (nhảy cóc trạng thái), trả về `400 Bad Request` kèm thông điệp giải thích ma trận hợp lệ.

---

### 5.2.2. Nhóm API Hồ sơ Bệnh án EMR & Tuân Thủ TT46/2018 (`/api/v1/emr`)

#### 1. Xem Chi Tiết Bệnh Án Có Thẩm Định Sở Hữu Đa Cơ Sở
- **Endpoint:** `GET /api/v1/emr/records/:id`
- **Quyền hạn:** `doctor`, `nurse`, `admin`, `patient`
- **Bảo mật:** Thực thi hàm `checkPatientTenancy`. Từ chối `403 Forbidden` nếu bác sĩ bệnh viện A cố tình xem bệnh án bệnh viện B mà không có phiếu chuyển viện hợp lệ, hoặc xem trộm bệnh nhân tự do B2C.

#### 2. Ký Cam Đoan Phẫu Thuật / Thủ Thuật (Sign Surgical Consent)
- **Endpoint:** `POST /api/v1/emr/consents/:id/sign`
- **Bảo vệ chống mạo danh:** Không chấp nhận tham số `role` từ request body. Bác sĩ phẫu thuật viên chính ký duyệt dựa trên `req.user.role === 'doctor'`. Bệnh nhân ký xác nhận khi `req.user.id === record.patientId`.

#### 3. Bổ Sung Phụ Lục Bệnh Án Bất Biến (Append-Only Addendum)
- **Endpoint:** `POST /api/v1/emr/records/:id/addendum`
- **Mô tả:** Khi hồ sơ bệnh án EMR đã ở trạng thái "Đã ký số" hoặc bệnh nhân đã "Xuất viện", hệ thống nghiêm cấm chỉnh sửa bản ghi gốc. Mọi thông tin bổ sung bắt buộc phải tạo bản ghi Addendum có đóng dấu thời gian và danh tính người bổ sung.

#### 4. Giao Thức Truy Cập Cấp Cứu Khẩn Cấp (Break-Glass Protocol)
- **Endpoint:** `POST /api/v1/emr/records/:id/break-glass`
- **Quyền hạn:** `doctor`
- **Mô tả:** Cho phép bác sĩ cấp cứu mở khóa xem nhanh tiền sử dị ứng và phác đồ nội sọ trong tình huống nguy kịch. Giới hạn tối đa 3 lần/ngày/bác sĩ, tự động phát sinh bản ghi kiểm toán trên chuỗi băm Tamper-Evident Hash Chain.

---

### 5.2.3. Nhóm API Mini-PACS & Chẩn Đoán Hình Ảnh (`/api/v1/imaging`)

#### 1. Kỹ Thuật Viên Nộp Ảnh Cắt Lớp & File DICOM (Upload via Binary Stream)
- **Endpoint:** `POST /api/v1/imaging/results`
- **Content-Type:** `multipart/form-data`
- **Payload:**
  - `visitId`: ObjectId
  - `requestAiAnalysis`: `"true"` hoặc `"false"`
  - `keySlices`: 1 - 3 file ảnh lát cắt tiêu biểu (`.png`, `.jpg`)
  - `dicomArchive`: 1 file nén series DICOM gốc (`.zip`)
- **Cơ chế xử lý:** Multer Stream ghi trực tiếp xuống ổ đĩa máy chủ (Zero RAM Buffering), kích hoạt ngầm tác vụ phân tích MAICS AI Engine.

#### 2. Bác Sĩ CĐHA Ký Số Điện Tử Duyệt Kết Quả (Sign & Finalize Result)
- **Endpoint:** `PUT /api/v1/imaging/results/:id`
- **Quyền hạn:** `doctor` (Bác sĩ chuyên khoa Chẩn đoán hình ảnh)
- **Request Body mẫu:**
  ```json
  {
    "clinicalDescription": "Khối choán chỗ vùng thùy trán phải, ranh giới rõ, kích thước 28x32mm, ngấm thuốc đối quang từ viền không đều. Có phù não nhẹ xung quanh.",
    "clinicalConclusion": "Theo dõi U màng não (Meningioma) thùy trán phải độ I (WHO Grade I)."
  }
  ```
- **Xử lý:**
  - Gán `radiologist = req.user.profile.fullName`.
  - Đóng dấu điện tử: `isSigned = true`, `signedAt = new Date()`, `signedByDoctorId = req.user.id`.
  - Chuyển trạng thái ca khám sang `hoan_tat`, khóa hồ sơ bệnh án EMR.

---

### 5.2.4. Nhóm API Quản lý Buồng Giường & Chuyển Viện (`/api/v1/hospital-beds` & `/api/v1/transfers`)

#### 1. Khóa Nguyên Tử Giữ Chỗ Giường Bệnh (Atomic Bed Reservation)
- **Endpoint:** `POST /api/v1/hospital-beds/:id/reserve`
- **Quyền hạn:** `doctor`, `nurse`, `admin`
- **Payload:** `{ "patientId": "664033334444555566667777" }`
- **Cơ chế:** Cập nhật nguyên tử với thời hạn giữ chỗ 4 giờ. Nếu giường đã có nhân viên khác giữ chỗ, trả về mã lỗi `409 Conflict`.

#### 2. Tiếp Nhận Giường Bệnh Chống Cướp Giường (Occupy Bed with Anti-Hijacking)
- **Endpoint:** `POST /api/v1/hospital-beds/:id/occupy`
- **Payload:** `{ "patientId": "664033334444555566667777" }`
- **Điều kiện:** Giường đang trống (`available`) HOẶC đang giữ chỗ nhưng `reservedForPatientId` phải trùng khớp với `patientId`.

#### 3. Cấp Quyền Xem Bệnh Án Liên Viện Có Thời Hạn (Grant Cross-Hospital View)
- **Endpoint:** `POST /api/v1/transfers/:id/grant-cross-view`
- **Quyền hạn:** `doctor`, `admin`
- **Mô tả:** Phát hành token mã hóa cho phép cơ sở tiếp nhận xem trọn vẹn bệnh án và ảnh MRI trong thời hạn 7 ngày (`crossViewExpiresAt`).

---

### 5.2.5. Nhóm API Tài Chính, Viện Phí & PayOS Webhook (`/api/v1/invoices`)

#### 1. Khởi Tạo Giao Dịch Thanh Toán VietQR
- **Endpoint:** `POST /api/v1/invoices/:id/create-payment-link`
- **Quyền hạn:** `patient`, `nurse`, `admin`
- **Mô tả:** Kết nối PayOS tạo mã thanh toán VietQR động chuẩn NAPAS 24/7 với số tiền viện phí đã trừ phần BHYT bảo lãnh.

#### 2. Xử Lý Webhook Đối Soát PayOS (PayOS HMAC Webhook Handler)
- **Endpoint:** `POST /api/v1/invoices/payos-webhook` (Public - Thẩm định chữ ký)
- **Xác thực:** Kiểm tra mã băm HMAC-SHA256 checksum từ Header của PayOS.
- **Xử lý Idempotent:** Cập nhật trạng thái `invoice.status = 'paid'`, chuyển cờ viện phí sang `Đã thanh toán`, đẩy ca khám vào hàng đợi KTV phòng chụp.

#### 3. Hoàn Tiền Viện Phí & Hồi Vị Kho Thuốc Đối Ứng
- **Endpoint:** `POST /api/v1/invoices/:id/refund`
- **Quyền hạn:** `admin`, `hospital_admin`
- **Xử lý đối ứng:** Cập nhật trạng thái hóa đơn thành `'hoàn tiền'`, đồng thời tự động thực thi lệnh Mongoose `$inc` để hoàn trả số lượng thuốc vào kho dược (`Drug.stock.quantity`).

---

### 5.2.6. Nhóm API Kiểm Định Chuỗi Băm Mật Mã (`/api/v1/audit`)

#### Xác Thực Tính Toàn Vẹn Chuỗi Băm (Verify Tamper-Evident Hash Chain)
- **Endpoint:** `GET /api/v1/audit/hash-chain-verify`
- **Quyền hạn:** `admin`, `hospital_admin`
- **Mô tả:** Rà soát toàn bộ chuỗi băm từ khối Genesis (#0) đến khối hiện tại. Nếu phát hiện sai lệch băm (CSDL bị can thiệp trái phép), lập tức kích hoạt cảnh báo SIEM mức độ `HIGH/CRITICAL`.
- **Phản hồi thành công (200 OK):**
  ```json
  {
    "success": true,
    "status": "VERIFIED_INTEGRITY",
    "totalRecords": 1584,
    "latestSequenceNumber": 1583,
    "tamperDetected": false
  }
  ```
