# Thiết Kế Chi Tiết: Hệ Thống Lưu Trữ Hybrid PACS (Local-First & Encrypted Drive Mirror)

> **Mục tiêu:** Xây dựng hệ thống lưu trữ y tế chuẩn hóa cho 1 Bệnh viện duy nhất:
> - **Local Storage làm bản chính (Primary/Hot-Storage):** 100% nghiệp vụ xem ảnh, AI, duyệt kết quả không phụ thuộc mạng internet hay Google Drive.
> - **Google Drive làm bản sao lưu ngầm (Secondary/Cold-Backup):** Khử định danh, mã hóa AES-256-GCM, lưu trữ phòng ngừa thảm họa (Disaster Recovery).
> - **Adapter Pattern:** Dễ dàng thay thế Drive bằng PACS Orthanc hoặc S3/MinIO sau này mà không sửa code nghiệp vụ.

---

## PHẦN 1: THIẾT KẾ CỤ THỂ CHO BẢN CHÍNH (LOCAL STORAGE)

### 1.1 Vị trí và Cấu hình Thư mục Local
- Thư mục được đặt tách biệt hoàn toàn khỏi project code và **ngoài thư mục đồng bộ OneDrive**:
  - `STORAGE_LOCAL_DIR=D:/neuroscan_storage` (cấu hình trong `.env`).
  - Fallback an toàn (nếu chưa cấu hình ổ D): Tự động tạo `C:/neuroscan_storage`.

### 1.2 Cấu trúc Cây Thư mục Trên Ổ Cứng
```text
D:/neuroscan_storage/
│
├── 📂 pacs/                                        <-- Phân hệ Chẩn đoán hình ảnh
│   └── 2026/
│       └── 10/                                     <-- Phân cấp Năm / Tháng
│           └── study_000997/                       <-- Thư mục Ca chụp (theo studyId / Accession No)
│               ├── dicom_raw.zip                   <-- Gói file nén toàn bộ lát cắt thô từ máy chụp
│               ├── key_slice.png                   <-- Lát cắt tiêu biểu nhất (phục vụ app mobile & xem nhanh)
│               ├── ai_heatmap.jpg                  <-- Ảnh Heatmap Grad-CAM vùng u do AI sinh ra
│               ├── doctor_revision.png             <-- Ảnh khoanh vùng hiệu chỉnh của Bác sĩ CĐHA
│               └── 📂 sequences/                   <-- Các chuỗi xung đã bóc tách
│                   ├── T2_FLAIR_axial/             (Chứa các file lát cắt IM-0001-xxxx.jpg)
│                   ├── T1_MPRAGE_C+_axial/
│                   └── DWI_b1000/
│
├── 📂 reports/                                     <-- Báo cáo kết quả chẩn đoán đã ký duyệt
│   └── 2026/
│       └── 10/
│           └── report_000997.pdf                   <-- Báo cáo PDF hoàn chỉnh có chữ ký số PKI/HSM
│
├── 📂 patient-uploads/                             <-- Hồ sơ, đơn thuốc, giấy tờ do bệnh nhân nộp
│   ├── quarantine/
│   │   └── up_8a9f2c_don_thuoc.pdf                 <-- Tệp chờ nhân viên y tế duyệt / kiểm tra mã độc
│   └── accepted/
│       └── doc_8a9f2c_don_thuoc.pdf                <-- Đã duyệt, gắn chính thức vào bệnh án điện tử (EMR)
│
├── 📂 ai-temp/                                     <-- Vùng đệm xử lý AI (Tạm thời & Khử định danh)
│   └── job_7f8a9b1c/                               <-- Chứa ảnh tạm để gửi infer; XÓA SẠCH sau khi AI xong
│       └── anonymized_slice.png
│
└── 📂 backups/                                     <-- Sao lưu định kỳ cơ sở dữ liệu
    └── 2026/
        └── 10/
            └── db_backup_20261002.tar.gz.enc       <-- File dump CSDL đã nén và mã hóa AES-256
```

### 1.3 Luồng Xử Lý Ghi File Cục Bộ (Local Write Flow)
```
Input (Buffer/Stream)
   │
   ├─► 1. Tạo tự động thư mục con nếu chưa có (fs.mkdir recursive: true)
   ├─► 2. Ghi file nguyên bản vào đĩa cứng (fs.promises.writeFile)
   ├─► 3. Tính mã băm SHA-256 của file local: crypto.createHash('sha256').update(buffer).digest('hex')
   └─► 4. Trả về kết quả: { localPath, sha256, sizeBytes }
```

---

## PHẦN 2: THIẾT KẾ CỤ THỂ CHO BẢN SAO LƯU (GOOGLE DRIVE MIRROR)

### 2.1 Chính Sách Bảo Mật Trên Google Drive
1. **Chế độ Riêng tư Tuyệt đối (Strictly Private):**
   - Loại bỏ hoàn toàn quyền `role: "reader", type: "anyone"`.
   - Chỉ tài khoản Service Account / Admin Bệnh viện có quyền đọc ghi vào Drive này.
2. **Mã Hóa Đối Xứng AES-256-GCM Trước Khi Upload:**
   - Mỗi file khi đẩy lên Drive đều được mã hóa bằng `FILE_ENCRYPTION_KEY` (32 bytes).
   - Mỗi lần mã hóa sinh ngẫu nhiên 1 Vector khởi tạo `IV` (12 bytes) và 1 thẻ xác thực `AuthTag` (16 bytes).
   - Dù tài khoản Google Drive có bị rò rỉ hoặc nhân viên Google xem trộm, toàn bộ file y tế trên Drive chỉ là các byte vô nghĩa không thể giải mã.
3. **Cây Thư Mục Khử Định Danh (De-identified Drive Structure):**
   - Đồng bộ cấu trúc giống hệt Local: `pacs/2026/10/study_000997/key_slice.png.enc`.
   - Không chứa bất kỳ thông tin nào về họ tên, ngày sinh, số CCCD bệnh nhân.

### 2.2 Thuật Toán Quản Lý & Cache Thư Mục Drive (Folder Cache Strategy)
Việc gọi API Google Drive để tạo từng thư mục (`pacs` ➔ `2026` ➔ `10` ➔ `study_000997`) sẽ rất chậm và dễ bị dính Rate Limit (Google Quota 429).
- **Giải pháp:** Xây dựng cơ chế **Path Cache**:
  - Dùng 1 bảng MongoDB hoặc in-memory Map lưu: `path -> driveFolderId` (ví dụ: `pacs/2026/10/study_000997` ➔ `1AbCdEf...`).
  - Khi cần tải file:
    - Nếu `driveFolderId` đã có trong Cache ➔ Upload trực tiếp vào thư mục đó trong 1 request duy nhất.
    - Nếu chưa có ➔ Backend tạo đệ quy từ gốc và lưu ID vào Cache cho các lần sau.

### 2.3 Luồng Tải Lên Drive Ngầm (Background Drive Push)
```
Local Buffer
   │
   ├─► 1. Mã hóa: { encryptedBuffer, iv, authTag } = encryptBuffer(buffer, KEY)
   ├─► 2. Lấy Target Folder ID từ Drive Cache (hoặc tạo mới nếu chưa có)
   ├─► 3. Upload encryptedBuffer lên Google Drive API (drive.files.create)
   ├─► 4. Nhận về driveFileId và md5Checksum từ Google
   └─► 5. Cập nhật DB: syncStatus = 'SYNCED', driveFileId, encryptionIv, encryptionAuthTag
```

---

## PHẦN 3: CƠ CHẾ ĐỒNG BỘ & TỰ PHỤC HỒI (BACKGROUND SYNC & DISASTER RECOVERY)

### 3.1 Bảng Metadata Cơ Sở Dữ Liệu (`MedicalFile`)
File: `BE/src/models/storedMedicalFile.model.js`

```javascript
{
  fileId: { type: String, required: true, unique: true, index: true }, // UUID v4
  category: { 
    type: String, 
    enum: ['pacs', 'sequence_slice', 'report', 'patient_upload', 'ai_temp', 'backup'], 
    required: true,
    index: true 
  },
  studyId: { type: String, index: true, default: null }, // vd: "000997"
  sequenceName: { type: String, default: null },         // vd: "T2_FLAIR_axial"
  fileName: { type: String, required: true },
  
  // Thông tin Local (Bản chính)
  localPath: { type: String, required: true },
  sha256: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  mimeType: { type: String, required: true },
  
  // Thông tin Google Drive (Bản sao lưu)
  driveFileId: { type: String, default: null },
  driveFolderId: { type: String, default: null },
  syncStatus: { 
    type: String, 
    enum: ['PENDING', 'SYNCED', 'FAILED'], 
    default: 'PENDING', 
    index: true 
  },
  syncRetries: { type: Number, default: 0 },
  syncError: { type: String, default: null },
  lastSyncAttemptAt: { type: Date, default: null },
  
  // Khóa giải mã AES-256-GCM cho bản trên Drive
  isEncrypted: { type: Boolean, default: true },
  encryptionIv: { type: String, default: null },        // Hex 12 bytes
  encryptionAuthTag: { type: String, default: null },   // Hex 16 bytes
  
  // Khóa ngoại nghiệp vụ
  patientId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 3.2 Background Worker Tự Động Retry (`driveSyncWorker.js`)
- Chạy định kỳ mỗi **3 - 5 phút**:
  - Tìm tối đa **10 tệp tin** có trạng thái: `syncStatus === 'PENDING'` hoặc (`syncStatus === 'FAILED'` và `syncRetries < 5`).
  - Đọc file từ đĩa cục bộ ➔ Mã hóa AES-256-GCM ➔ Đẩy lên Drive.
  - Nếu thành công ➔ Đổi trạng thái sang `SYNCED`.
  - Nếu thất bại (mất mạng, Drive rate-limit) ➔ Tăng `syncRetries += 1`, ghi log `syncError`.
  - **Cam kết:** Bác sĩ khám chữa bệnh trên máy không bao giờ bị đứng hình hay chậm trễ vì Worker này chạy hoàn toàn tách biệt.

### 3.3 Cơ Chế Khôi Phục Thảm Họa (Disaster Recovery / Self-Healing)
Nếu máy chủ cục bộ bị cháy ổ cứng hoặc file local bị xóa nhầm:
1. Khi có yêu cầu truy cập file, `storageService.get(fileId)` phát hiện file trên Local không còn (`fs.existsSync === false`).
2. Hệ thống tự động tra cứu `driveFileId` trong DB.
3. Kéo `encryptedBuffer` từ Google Drive về máy.
4. Dùng `encryptionIv` và `encryptionAuthTag` giải mã AES-256-GCM.
5. **Ghi phục hồi lại vào Local Storage** và stream trả về cho Client.
➔ **Hệ thống tự động chữa lành (Self-Healing) mà người dùng không hề hay biết.**

---

## PHẦN 4: THIẾT KẾ CÁC MODULE CODE CỤ THỂ

### 4.1 Module Tiện Ích Mã Hóa (`BE/src/utils/cryptoStorage.util.js`)
- `encryptBuffer(buffer, keyHex)`:
  - Sinh `iv = crypto.randomBytes(12)`
  - Thuật toán `aes-256-gcm`
  - Trả về: `{ encryptedBuffer, ivHex, authTagHex }`
- `decryptBuffer(encryptedBuffer, keyHex, ivHex, authTagHex)`:
  - Set `decipher.setAuthTag(authTag)`
  - Giải mã và kiểm tra tính toàn vẹn (tự văng lỗi nếu file bị can thiệp)
  - Trả về: `decryptedBuffer`
- `computeSha256(buffer)`: Trả về mã băm hex SHA-256.

### 4.2 Module Lưu Trữ Cục Bộ (`BE/src/services/storage/localAdapter.js`)
- `write(subPath, buffer)`: Ghi file và tự động tạo thư mục con.
- `readStream(localPath)`: Mở stream phục vụ tải/xem.
- `readBuffer(localPath)`: Đọc nhị phân.
- `exists(localPath)`: Kiểm tra file tồn tại.
- `delete(localPath)`: Xóa file vật lý.

### 4.3 Module Lưu Trữ Đám Mây (`BE/src/services/storage/driveMirrorAdapter.js`)
- `getOrCreateFolderPath(relativePath)`: Tìm hoặc tạo thư mục dạng `pacs/2026/10/study_000997` trên Drive (có cache).
- `uploadEncryptedFile(buffer, targetFolderId, fileName)`: Đẩy file mã hóa lên Drive.
- `downloadEncryptedFile(driveFileId)`: Kéo file mã hóa từ Drive về.
- `deleteFile(driveFileId)`: Xóa file trên Drive.

### 4.4 Module Điều Phối Thống Nhất (`BE/src/services/storage/storageService.js`)
Cung cấp giao diện sạch duy nhất cho toàn bộ Controller:
- `put({ category, studyId, sequenceName, fileName, buffer, mimeType, patientId, uploadedBy })`
- `get(fileId)` ➔ `{ stream, mimeType, sizeBytes, fileName }`
- `delete(fileId)`

### 4.5 API Streaming Bảo Mật (`BE/src/modules/storage/storage.routes.js`)
- Route: `GET /api/v1/storage/files/:fileId`:
  - Middleware `protect`: Bắt buộc đăng nhập.
  - Phân quyền:
    - Bệnh nhân chỉ xem được file của chính mình (`patientId === req.user.id`).
    - Bác sĩ/KTV/Admin xem theo chức năng.
  - Trả về HTTP Stream: Hỗ trợ Header `Content-Type`, `Content-Length`, `Content-Disposition`.
  - Hỗ trợ Range Request (HTTP 206) để Bác sĩ tua nhanh các lát cắt DICOM mượt mà.

---

## PHẦN 5: BỘ SCRIPT KIỂM TOÁN & SAO LƯU

1. **Script Kiểm toán Toàn vẹn: `BE/scripts/verifyStorage.js`**
   - Lệnh chạy: `npm run storage:verify`
   - Quét qua toàn bộ bản ghi `MedicalFile`:
     - Kiểm tra file Local còn nguyên vẹn và so khớp SHA-256.
     - Kiểm tra file Drive còn tồn tại và thử giải mã mẫu.
   - Xuất bảng nghiệm thu:
     ```text
     ┌────────────────────────────┬───────────┐
     │ Tiêu chí kiểm định         │ Kết quả   │
     ├────────────────────────────┼───────────┤
     │ Tổng số tệp tin quản lý    │ 240       │
     │ Tệp tin toàn vẹn Local     │ 240 (100%)│
     │ Tệp tin đã đồng bộ Drive   │ 238 (99%) │
     │ Tệp tin đang chờ đồng bộ   │ 2         │
     │ Tệp tin lỗi tính toàn vẹn  │ 0 (ĐẠT)   │
     └────────────────────────────┴───────────┘
     ```
2. **Script Sao lưu Cơ sở dữ liệu: `BE/scripts/backupDatabase.js`**
   - Lệnh chạy: `npm run db:backup`
   - Chạy `mongodump` ➔ Nén gzip ➔ Mã hóa AES-256 ➔ Lưu vào `STORAGE_BACKUP_DIR` ➔ Đẩy 1 bản lên Drive `backups/`.

---

## PHẦN 6: LỘ TRÌNH THỰC HIỆN THEO CHECKLIST

- [ ] **Bước 1:** Tạo tiện ích mã hóa `cryptoStorage.util.js`.
- [ ] **Bước 2:** Tạo Mongoose Model `storedMedicalFile.model.js`.
- [ ] **Bước 3:** Viết `localAdapter.js` và `driveMirrorAdapter.js`.
- [ ] **Bước 4:** Hoàn thiện Facade `storageService.js`.
- [ ] **Bước 5:** Xây dựng Worker đồng bộ bù `driveSyncWorker.js`.
- [ ] **Bước 6:** Tạo API Streaming `GET /api/v1/storage/files/:fileId` và phân quyền.
- [ ] **Bước 7:** Tích hợp vào `imaging.controller.js` (Upload ca chụp, AI inference, ký duyệt).
- [ ] **Bước 8:** Viết 2 script `verifyStorage.js` và `backupDatabase.js`.
