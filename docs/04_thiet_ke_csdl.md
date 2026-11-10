# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 4: THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)

> **Đề tài:** NeuroScan AI – Nền tảng hỗ trợ sàng lọc u não trên ảnh MRI và quản lý hồ sơ bệnh án điện tử

---

## 4.1. SƠ ĐỒ MỐI QUAN HỆ THỰC THỂ (ENTITY RELATIONSHIP DIAGRAM - ERD)

Cơ sở dữ liệu của hệ thống **NeuroScan AI** được thiết kế trên nền tảng MongoDB 7.0, kết hợp linh hoạt giữa mô hình Document NoSQL hiệu năng cao và các ràng buộc toàn vẹn quan hệ (Referential Integrity) phục vụ môi trường y tế đa cơ sở, đáp ứng các tiêu chuẩn khắt khe của Thông tư 46/2018/TT-BYT và HIPAA:

```mermaid
erDiagram
    Hospital ||--o{ User : "quản lý nhân sự"
    Hospital ||--o{ Patient : "quản lý bệnh nhân"
    Hospital ||--o{ Visit : "tiếp nhận khám"
    Hospital ||--o{ Invoice : "phát hành hóa đơn"
    Hospital ||--o{ Drug : "danh mục thuốc phục vụ kê đơn"
    Hospital ||--o{ HashChainAuditLog : "lưu vết kiểm toán"

    Patient ||--o{ Visit : "thực hiện lượt khám"
    User ||--o{ Visit : "bác sĩ chỉ định khám"
    
    Visit ||--o| ImagingResult : "chỉ định chụp MRI"
    Visit ||--o| Invoice : "phát sinh chi phí"

    ImagingResult ||--o| User : "bác sĩ CĐHA ký duyệt"

    Hospital ||--o{ TransferForm : "chuyển viện đi/đến"
    Patient ||--o{ TransferForm : "được chuyển viện"

    Hospital {
        ObjectId _id PK
        string name "Tên bệnh viện"
        string code UK "Mã định danh viện"
        object pricing "Bảng giá khám & chụp MRI"
        object settings "Cấu hình khám bệnh & hạn mức ngày"
    }

    User {
        ObjectId _id PK
        ObjectId hospitalId FK "Cơ sở trực thuộc"
        string email UK
        string passwordHash
        string role "admin/doctor/technician/nurse/patient"
        object profile "Họ tên, CCHN, Chuyên khoa"
    }

    Patient {
        ObjectId _id PK
        ObjectId hospitalId FK "Null nếu là bệnh nhân tự do B2C"
        string fullName
        string identityCard "CCCD / Định danh cá nhân"
        date dateOfBirth
        string gender "Nam / Nữ / Khác"
        string phone "Số điện thoại liên lạc"
        boolean isB2C "Cờ bệnh nhân tự do"
    }

    Visit {
        ObjectId _id PK
        ObjectId hospitalId FK "Cô lập đa cơ sở"
        ObjectId patientId FK
        ObjectId doctorId FK "Bác sĩ khám lâm sàng"
        string status "đang chờ/đang khám/chờ chụp/dang_chup/cho_bac_si_doc/hoan_tat/..."
        string priority "thường/ưu tiên/khẩn cấp"
        object mriSafetyChecklist "Bảng kiểm an toàn 4 câu hỏi"
        string mriCancelReason "Lý do hủy chụp"
        string mriRescanReason "Lý do chụp lại do nhiễu ảnh"
        ObjectId invoiceId FK "Hóa đơn viện phí"
        boolean isDeleted "Cờ xóa mềm Soft Delete"
        date deletedAt "Thời điểm xóa mềm"
        ObjectId deletedBy FK "Người thực hiện xóa mềm"
    }

    ImagingResult {
        ObjectId _id PK
        ObjectId hospitalId FK
        ObjectId visitId FK
        string orderingDoctor "Bác sĩ lâm sàng chỉ định"
        string radiologist "Bác sĩ CĐHA đọc & thẩm định"
        boolean isSigned "Trạng thái ký số điện tử"
        date signedAt "Thời điểm ký số"
        ObjectId signedByDoctorId FK "Tài khoản bác sĩ CĐHA"
        array imageUrls "1-3 lát cắt tiêu biểu PNG/JPG"
        string dicomZipUrl "Tệp nén DICOM gốc"
        object aiDiagnosis "Kết quả MAICS AI Consensus"
        string clinicalDescription "Mô tả hình ảnh học"
        string clinicalConclusion "Kết luận chẩn đoán xác định"
    }

    Invoice {
        ObjectId _id PK
        ObjectId hospitalId FK
        ObjectId visitId FK
        ObjectId patientId FK
        number totalAmount "Tổng chi phí viện phí"
        number patientCoPay "Số tiền người bệnh phải trả"
        string status "chờ thanh toán/đã thanh toán/hoàn tiền/đã hủy"
        string paymentMethod "tiền mặt/vietqr/payos"
        number payosOrderCode "Mã đơn hàng PayOS"
        string payosPaymentLinkId "Đường dẫn thanh toán"
        array items "Danh mục dịch vụ và thuốc"
    }

    Drug {
        ObjectId _id PK
        ObjectId hospitalId FK
        string name "Tên thuốc / Biệt dược"
        string activeIngredient "Hoạt chất"
        string unit "Đơn vị tính (Viên/Lọ)"
        number price "Đơn giá"
    }

    TransferForm {
        ObjectId _id PK
        ObjectId hospitalId FK "Bệnh viện chuyển đi"
        ObjectId targetHospitalId FK "Bệnh viện tiếp nhận (nếu có trong hệ thống)"
        ObjectId patient_id FK
        string transferTo "Nơi chuyển đến"
        string reason "Lý do chuyển tuyến (1 hoặc 2)"
        string recipientEmail "Email người nhận hồ sơ"
        date sentAt "Thời điểm gửi hồ sơ"
        string status "draft/sent/failed/pending/accepted/rejected/completed/cancelled"
    }

    HashChainAuditLog {
        ObjectId _id PK
        number sequenceNumber UK "Số thứ tự tuần tự"
        string previousHash "Mã băm bản ghi trước"
        string currentHash "Mã băm SHA-256 bản ghi hiện tại"
        string action "CREATE_VISIT/SIGN_EMR/..."
        ObjectId entityId "ID bản ghi nghiệp vụ"
        string entityType "Visit/ImagingResult/Invoice/..."
        ObjectId performedBy FK "Người dùng thực hiện"
        ObjectId hospitalId FK
        date timestamp "Thời điểm thực hiện chính xác"
    }
```

---

## 4.2. TỪ ĐIỂN DỮ LIỆU CHI TIẾT (DATA DICTIONARY)

### 4.2.1. Bộ Sưu Tập `visits` (Hồ sơ Ca khám & Y lệnh Cận lâm sàng)
Thực thể trung tâm điều phối luồng quy trình khám chữa bệnh, chẩn đoán hình ảnh và FSM:

| Tên trường (Field) | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc nghiệp vụ |
| :--- | :--- | :---: | :--- |
| `_id` | ObjectId | Có | Khóa chính duy nhất của ca khám. |
| `hospitalId` | ObjectId | Có | Mã định danh cơ sở y tế (Tenant Isolation). |
| `patientId` | ObjectId | Có | Tham chiếu thực thể `Patient`. |
| `doctorId` | ObjectId | Có | Tham chiếu `User` (Bác sĩ chỉ định khám ban đầu). |
| `status` | String (Enum) | Có | Quản lý bởi FSM: `'đang chờ'`, `'đang khám'`, `'chờ chụp'`, `'dang_chup'`, `'cho_ket_qua_ai'`, `'cho_bac_si_doc'`, `'hoan_tat'`, `'da_dong'`, `'cho_chup_lai'`, `'da_huy'`, `'loi_ai'`. |
| `priority` | String (Enum) | Có | `'thường'`, `'ưu tiên'`, `'khẩn cấp'` (Cấp cứu: Chụp trước, thu sau). |
| `mriSafetyChecklist` | Object | Không | Nhúng bảng kiểm an toàn buồng MRI 4 tiêu chí sinh mạng: |
| `├─ hasPacemakerOrMetal`| Boolean | - | `true` nếu có máy tạo nhịp tim hoặc kim loại từ tính (Chống chỉ định tuyệt đối). |
| `├─ hasClaustrophobia` | Boolean | - | `true` nếu có hội chứng sợ buồng kín. |
| `├─ hasKidneyDisease`  | Boolean | - | `true` nếu có suy thận (cân nhắc tiêm thuốc đối quang từ Gadolinium). |
| `├─ isPregnant`        | Boolean | - | `true` nếu phụ nữ có thai 3 tháng đầu. |
| `├─ isScreened`        | Boolean | - | Đã hoàn thành sàng lọc trước buồng máy. |
| `├─ passed`            | Boolean | - | Cho phép chụp (`true` nếu không có chống chỉ định). |
| `├─ screenedBy`        | String | - | Họ tên KTV thực hiện sàng lọc an toàn. |
| `└─ screenedAt`        | Date | - | Thời điểm xác nhận an toàn buồng chụp. |
| `mriCancelReason` | String | Không | Lý do hủy ca chụp (ví dụ: "Phát hiện mảnh đạn kim loại trong hốc mắt"). |
| `mriRescanReason` | String | Không | Lý do yêu cầu chụp lại (ví dụ: "Nhiễu ảnh cử động đầu - Motion Artifact"). |
| `invoiceId` | ObjectId | Không | Tham chiếu `Invoice` tương ứng để theo dõi viện phí. |
| `isDeleted` | Boolean | Có | Cờ xóa mềm Soft Delete theo TT 46/2018 (Mặc định: `false`). |
| `deletedAt` | Date | Không | Thời điểm thực hiện xóa mềm. |
| `deletedBy` | ObjectId | Không | Tài khoản nhân viên y tế thực hiện xóa mềm (Bảo lưu vết pháp lý). |

---

### 4.2.2. Bộ Sưu Tập `imagingresults` (Kết Quả Chẩn Đoán Hình Ảnh & Mini-PACS)
Thực thể quản trị kết quả đọc phim, gợi ý của trí tuệ nhân tạo và chữ ký số điện tử:

| Tên trường (Field) | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc nghiệp vụ |
| :--- | :--- | :---: | :--- |
| `_id` | ObjectId | Có | Khóa chính của phiếu kết quả chẩn đoán hình ảnh. |
| `hospitalId` | ObjectId | Có | Mã cơ sở y tế thực hiện kỹ thuật. |
| `visitId` | ObjectId | Có | Tham chiếu ca khám tương ứng (`Visit`). |
| `orderingDoctor` | String | Có | Họ tên Bác sĩ lâm sàng chỉ định chụp. |
| `radiologist` | String | Có | Họ tên Bác sĩ CĐHA đọc và thẩm định kết quả. |
| `isSigned` | Boolean | Có | Đóng dấu ký số (`true`: Đã ký số, `false`: Chờ duyệt). |
| `signedAt` | Date | Không | Thời điểm bấm ký số hoàn tất hồ sơ. |
| `signedByDoctorId` | ObjectId | Không | Tham chiếu tài khoản Bác sĩ CĐHA ký duyệt. |
| `imageUrls` | Array[String]| Có | Danh sách 1 - 3 lát cắt tiêu biểu (.PNG/.JPG) xem nhanh trên Web EMR. |
| `dicomZipUrl` | String | Không | Đường dẫn file nén `.zip` chứa trọn vẹn chuỗi ảnh DICOM gốc. |
| `aiDiagnosis` | Object | Không | Kết quả phân tích từ Hệ thống trọng tài MAICS: |
| `├─ label` | String | - | Nhãn phân loại (`glioma`, `meningioma`, `pituitary`, `no_tumor`). |
| `├─ confidence` | Number | - | Độ tin cậy dự đoán (0.00 - 1.00). |
| `├─ boundingBoxes` | Array[Object]| - | Tọa độ hộp bao tổn thương `[x1, y1, x2, y2]`. |
| `├─ heatmapUrl` | String | - | Đường dẫn ảnh bản đồ nhiệt kích hoạt thị giác Grad-CAM. |
| `└─ vlmExplanation` | String | - | Lập luận giải phẫu từ mô hình Gemini 3.1 Flash-Lite (khi có xung đột). |
| `clinicalDescription`| String | Không | Mô tả đặc điểm hình ảnh học của Bác sĩ CĐHA. |
| `clinicalConclusion` | String | Không | Kết luận chẩn đoán xác định của Bác sĩ CĐHA. |

---

### 4.2.3. Bộ Sưu Tập `hospitalbeds` — Ngoài phạm vi đồ án
Collection quản lý buồng giường nội trú còn trong mã nguồn từ giai đoạn trước nhưng không thuộc phạm vi đồ án (mục 1.4.3), nên không trình bày thiết kế chi tiết ở đây.

---

### 4.2.4. Bộ Sưu Tập `hashchainauditlogs` (Nhật Ký Chuỗi Băm Mật Mã Tamper-Evident)
Thực thể bảo vệ tính toàn vẹn và chống giả mạo hồ sơ y tế theo Thông tư 46/2018 và HIPAA:

| Tên trường (Field) | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc nghiệp vụ |
| :--- | :--- | :---: | :--- |
| `_id` | ObjectId | Có | Khóa chính bản ghi kiểm toán. |
| `sequenceNumber` | Number | Có | Số thứ tự tuần tự không gián đoạn (0, 1, 2, ...), đánh chỉ mục `unique`. |
| `previousHash` | String | Có | Chuỗi băm SHA-256 của bản ghi $L_{i-1}$ (Genesis = 64 ký tự '0'). |
| `currentHash` | String | Có | Chuỗi băm SHA-256 của bản ghi hiện tại $L_i$. |
| `action` | String | Có | Hành động nghiệp vụ: `'CREATE_VISIT'`, `'SUBMIT_SAFETY_CHECK'`, `'SIGN_EMR'`, `'PAYOS_PAYMENT_SUCCESS'`. |
| `entityId` | ObjectId | Có | Khóa ngoại tới thực thể bị tác động. |
| `entityType` | String | Có | Tên thực thể (`'Visit'`, `'ImagingResult'`, `'Invoice'`). |
| `performedBy` | ObjectId | Có | Tham chiếu `User` thực hiện thao tác. |
| `hospitalId` | ObjectId | Có | Cơ sở y tế phát sinh sự kiện kiểm toán. |
| `timestamp` | Date | Có | Thời điểm chính xác phát sinh sự kiện. |

---

## 4.3. CHIẾN LƯỢC ĐÁNH CHỈ MỤC HIỆU NĂNG CAO (COMPOUND INDEXING STRATEGY)

Để tối ưu hóa thời gian phản hồi truy vấn dưới $15\text{ms}$ trên tập dữ liệu hàng triệu lượt khám, đồng thời bảo đảm an toàn dữ liệu đa cơ sở:

```javascript
// 1. Chỉ mục Hàng đợi Lâm sàng & Hàng đợi KTV (Tenant Queue Index)
db.visits.createIndex(
  { hospitalId: 1, status: 1, priority: 1, createdAt: 1 },
  { name: "idx_tenant_clinical_queue" }
);

// 2. Chỉ mục định danh duy nhất Bệnh nhân theo CCCD trong từng Cơ sở
db.patients.createIndex(
  { hospitalId: 1, identityCard: 1 },
  { unique: true, sparse: true, name: "idx_unique_patient_cccd" }
);

// 3. Chỉ mục Chuỗi băm Mật mã học (Bảo đảm tuần tự không phân nhánh)
db.hashchainauditlogs.createIndex(
  { sequenceNumber: 1 },
  { unique: true, name: "idx_unique_hash_chain_seq" }
);

// 4. Chỉ mục truy vấn Lịch sử Chẩn đoán Hình ảnh Mini-PACS
db.imagingresults.createIndex(
  { hospitalId: 1, visitId: 1, isSigned: 1, createdAt: -1 },
  { name: "idx_tenant_pacs_history" }
);

// 5. Chỉ mục Đối soát Hóa đơn Viện phí PayOS
db.invoices.createIndex(
  { hospitalId: 1, payosOrderCode: 1, status: 1 },
  { name: "idx_tenant_payos_reconcile" }
);
```
Các chỉ mục phức hợp trên tránh quét toàn bảng (Table Scan), giúp toàn bộ các thao tác nghiệp vụ lâm sàng đạt hiệu năng tối ưu ngay cả khi hệ thống chịu tải cao điểm.
