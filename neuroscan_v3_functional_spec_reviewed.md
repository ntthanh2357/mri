# NeuroScan AI v3.0 — Đặc tả Chức năng (Bản Review & Hoàn thiện)

**Phiên bản:** 3.2 (hoàn chỉnh) &nbsp;|&nbsp; **Ngày:** 07/08/2026 &nbsp;|&nbsp; **Dựa trên:** bản đặc tả v3.1 (70 chức năng, module A–T) + đối chiếu codebase thực tế

> Tài liệu v3.2 giữ nguyên toàn bộ nội dung v3.1, bổ sung thêm: (1) **Phần 0 — Kiến trúc tổng thể & Stack công nghệ** đối chiếu với code thực tế, (2) **Module U — Quản lý Premium & Thanh toán Online**, (3) **Module V — Sổ sức khoẻ cá nhân (nâng cao)**, (4) **Module W — Báo cáo & Thống kê vận hành**, (5) **Phụ lục — Sơ đồ luồng xử lý chính**, (6) Bổ sung chi tiết còn thiếu trong các module cũ (đặc biệt M, D, I), (7) Mapping chức năng ↔ file code thực tế.

---

## Tóm tắt đánh giá (cập nhật v3.2)

| Hạng mục | Nhận xét |
|---|---|
| Độ bao phủ so với codebase thực tế | **Cao** — hầu hết model đã có; còn thiếu model cho module P (PeerReview), Q (Bed), S.2 (ContrastConsent riêng) |
| Rủi ro lớn nhất | Phạm vi AI đa chuỗi (Module C) lớn hơn nhiều so với năng lực một đồ án thông thường — xem mục 1.1 |
| Cần sửa trước khi code | Thứ tự ưu tiên: viewer (G) phải đi cùng AI (C), không thể tách sau — xem mục 1.2 |
| Phát hiện mới từ code | Module M đã có thanh toán PayOS (VietQR) — cần cập nhật đặc tả. Module U (Premium) đã có logic nhưng chưa được đặc tả chính thức |
| Còn thiếu đặc tả | Module U (Premium), Module V (Sổ sức khoẻ nâng cao), Module W (Báo cáo vận hành) — đã bổ sung |

---

## Ghi chú kỹ thuật quan trọng — đọc trước khi triển khai

### 1.1 Phạm vi AI (Module C) là rủi ro lớn nhất

Bản gốc dùng ensemble classification (ResNet50/EfficientNetV2/DenseNet) + YOLOv8 detection trên 1 ảnh — bài toán đã có nhiều dataset công khai, khả thi cho đồ án. Module C đưa lên một tầm hoàn toàn khác:

- **C.1** (phân đoạn u pixel-level + thể tích + midline shift): cần dataset có mask phân đoạn từng lát. BraTS là dataset công khai tốt nhất cho phân đoạn u não, nhưng không có nhãn midline shift kèm theo — phần này gần như phải tự gán nhãn hoặc tự xây thuật toán đo đạc hình học sau khi có mask.
- **C.2** (ngưỡng ADC phân loại ác tính): khả thi hơn vì là phép tính trực tiếp trên giá trị pixel trong vùng đã phân đoạn, không cần model riêng. Ngưỡng cố định 800 chỉ nên là gợi ý ban đầu — giữ đúng cách gọi "mức độ nghi ngờ" như bản gốc đã làm, không nâng thành "kết luận chẩn đoán".
- **C.3** (phát hiện xâm lấn mạch từ TOF MRA): khó nhất trong Module C — phân biệt "chèn ép", "xâm lấn", "không liên quan" bằng hình học 3D là bài toán nghiên cứu, gần như không có dataset công khai chuyên cho việc này.

**Khuyến nghị thứ tự làm:** C.1 → C.6/C.7 (chọn slice) → C.4 (gộp báo cáo) → C.5 (3D model) trước — hệ thống chạy đầy đủ vòng đời với riêng nhánh này. C.2 và C.3 nên xem là 2 cụm tính năng nâng cao, tách khỏi lộ trình lõi.

### 1.2 Thứ tự ưu tiên: Module G phải đi cùng Module C

Bảng ưu tiên gốc xếp C ở nhóm 1, G ở nhóm 3. Nhưng đầu ra của C (mask, slice nguy hiểm, mô hình 3D, midline shift...) vô nghĩa nếu bác sĩ không có nơi xem. Tối thiểu **G.1 (viewer cơ bản) và G.3 (trang báo cáo)** cần lên nhóm 1 cùng C — có thể tách G.2 (overlay), G.4 (3D tương tác), G.5 (active learning UI) sang nhóm sau để giảm tải. Đã điều chỉnh trong lộ trình ở cuối tài liệu.

### 1.3 B.2 — nên dùng DICOM metadata thay vì tên thư mục

Tên thư mục (VD `Ax_T2_FLAIR_FS_3`) phụ thuộc quy ước đặt tên của từng máy/kỹ thuật viên, không chuẩn hoá giữa các hãng máy hay bệnh viện. File `.dcm` luôn mang metadata chuẩn (tag `SeriesDescription`, `Modality`, `ScanningSequence`...) — nên đọc các tag này làm nguồn chính để phân loại series, dùng tên thư mục làm gợi ý dự phòng khi metadata thiếu hoặc lỗi.

### 1.4 Google Drive làm PACS storage — đánh đổi cần biết

Dùng Drive tiết kiệm chi phí, triển khai nhanh cho đồ án, nhưng có 3 điều cần lưu ý nếu tiến tới triển khai thật:

- **Giới hạn API**: Drive API có rate limit theo số request/100 giây — upload hàng loạt file `.dcm` riêng lẻ cho nhiều study cùng lúc có thể bị nghẽn; nên nén theo từng series trước khi upload thay vì đẩy từng file rời.
- **Không hỗ trợ giao thức DICOM gốc**: nếu sau này nhận ảnh trực tiếp từ máy MRI thật (không upload tay), cần thêm một DICOM gateway đứng trước để nhận C-STORE rồi mới đẩy dữ liệu sang Drive.
- **Phân quyền**: bảng phân quyền ở phần cấu trúc Drive vừa cho "Service Account toàn quyền" vừa liệt kê quyền riêng từng vai trò trực tiếp trên Drive — nên chọn một trong hai mô hình. Khuyến nghị: chỉ Service Account có quyền trên Drive, mọi truy cập của bác sĩ/KTV/bệnh nhân đi qua backend (backend kiểm tra RBAC rồi mới cấp URL tạm thời) — vừa dễ audit (khớp với thư mục `Audit_Logs` đã thiết kế sẵn), vừa không phải quản lý ACL rời rạc trên hàng nghìn thư mục con.

### 1.5 A.4 (Emergency Override) — nên có xác nhận của lễ tân

Tự động dời lịch bệnh nhân thường sang slot khác hoàn toàn im lặng (không ai duyệt) có rủi ro trải nghiệm: bệnh nhân đó có thể đã sắp xếp công việc/đi lại theo giờ cũ. Đề xuất: hệ thống **tìm** slot thay thế và soạn sẵn thông báo, nhưng cần lễ tân bấm xác nhận trước khi gửi cho bệnh nhân bị dời — vẫn tự động hoá phần khó (tìm slot), giữ con ┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                               │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  React Native App    │    │     Web Hospital Dashboard   │   │
│  │  (CHỈ BỆNH NHÂN)     │    │  (Bác sĩ, KTV, Điều dưỡng,    │   │
│  │                      │    │   Lễ tân, Admin)             │   │
│  └──────────┬───────────┘    └──────────────┬───────────────┘   │
└─────────────┼────────────────────────────────┼───────────────────┘
              │ HTTPS / FCM                    │ HTTPS / WebSocket
┌─────────────┼────────────────────────────────┼───────────────────┐
│                      BACKEND LAYER (Node.js/Express)             │
│  ┌──────────▼──────────────────────────────▼──────────────────┐  │
│  │               REST API (Express.js)                         │  │
│  │   Auth (JWT) | RBAC | Rate Limit | Tenancy Plugin          │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Controllers: auth | admin | visit | imaging | emr          │  │
│  │              invoice | patient | schedule | drug | lis      │  │
│  │              notification | support | hospital              │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │              WebSocket Server (Socket.IO)                    │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │              BullMQ (Job Queue — AI jobs, email, backup)    │  │
│  └────────────┬──────────────────────────────┬─────────────────┘  │
└───────────────┼──────────────────────────────┼────────────────────┘
                │                              │
   ┌────────────▼──────────┐    ┌─────────────▼──────────────┐
   │    MongoDB Atlas       │    │   Google Drive API (PACS)  │
   │   (Primary Database)   │    │   Service Account Auth     │
   └───────────────────────┘    └────────────────────────────┘
                │
   ┌────────────▼──────────┐    ┌────────────────────────────┐
   │  AI Service (Python)   │    │  External Services         │
   │  FastAPI/Flask         │    │  - PayOS (thanh toán)      │
   │  - U-Net / YOLO        │    │  - SMTP / SendGrid (email) │
   │  - BraTS pipeline      │    │  - FCM Push (Bệnh nhân)    │
   └───────────────────────┘    └────────────────────────────┘
```

### 0.2 — Stack công nghệ thực tế

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| **Frontend Mobile** | React Native (Expo) | **Dành riêng cho Bệnh nhân** (đặt lịch, xem kết quả, sổ sức khỏe, QR chia sẻ, FCM Push) |
| **Frontend Web** | React.js | **Dành cho Nhân viên y tế** (Bác sĩ, KTV, Điều dưỡng, Lễ tân, Admin) |
| **Backend** | Node.js + Express.js | REST API, WebSocket (Socket.IO cho Web) |��────────────────────────────┼───────────────────┐
│                      BACKEND LAYER (Node.js/Express)             │
│  ┌──────────▼──────────────────────────────▼──────────────────┐  │
│  │               REST API (Express.js)                         │  │
│  │   Auth (JWT) | RBAC | Rate Limit | Tenancy Plugin          │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │  Controllers: auth | admin | visit | imaging | emr          │  │
│  │              invoice | patient | schedule | drug | lis      │  │
│  │              notification | support | hospital              │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │              WebSocket Server (Socket.IO)                    │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │              BullMQ (Job Queue — AI jobs, email, backup)    │  │
│  └────────────┬──────────────────────────────┬─────────────────┘  │
└───────────────┼──────────────────────────────┼────────────────────┘
                │                              │
   ┌────────────▼──────────┐    ┌─────────────▼──────────────┐
   │    MongoDB Atlas       │    │   Google Drive API (PACS)  │
   │   (Primary Database)   │    │   Service Account Auth     │
   └───────────────────────┘    └────────────────────────────┘
                │
   ┌────────────▼──────────┐    ┌────────────────────────────┐
   │  AI Service (Python)   │    │  External Services         │
   │  FastAPI/Flask         │    │  - PayOS (thanh toán)      │
   │  - U-Net / YOLO        │    │  - SMTP / SendGrid (email) │
   │  - BraTS pipeline      │    │  - SMS Gateway (tuỳ chọn) │
   └───────────────────────┘    └────────────────────────────┘
```

### 0.2 — Stack công nghệ thực tế

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| **Frontend Mobile** | React Native (Expo) | App cho bệnh nhân, KTV, bác sĩ |
| **Frontend Web** | React.js | Dashboard bác sĩ, admin |
| **Backend** | Node.js + Express.js | REST API, WebSocket |
| **Database** | MongoDB + Mongoose | Multi-tenant với `tenancyPlugin` |
| **Job Queue** | BullMQ + Redis | AI jobs, email, backup |
| **Authentication** | JWT (access + refresh token) | `tokenVersion` chống token cũ |
| **Storage** | Google Drive API (Service Account) | PACS storage, backup |
| **Payment** | PayOS (VietQR) | `orderCode` trong Invoice model |
| **Email** | SMTP / SendGrid | Thông báo bệnh nhân |
| **AI Pipeline** | Python (FastAPI/Flask) | U-Net, YOLOv8, OpenCV |
| **Real-time** | Socket.IO | Emergency alert, task update |

### 0.3 — Mô hình phân quyền (RBAC) thực tế

| Role (trong DB) | Tên hiển thị | Chức năng chính |
|---|---|---|
| `patient` | Bệnh nhân | H module (B2C), đặt lịch, xem kết quả |
| `doctor` | Bác sĩ (Neuroradiologist / Neurosurgeon) | Phân loại bằng `specialty` trong profile |
| `technician` | Kỹ thuật viên MRI | Upload DICOM, vận hành máy |
| `nurse` | Điều dưỡng | Phiếu chăm sóc, tạo hóa đơn chờ |
| `receptionist` | Lễ tân | Đặt lịch, thanh toán, hồ sơ bệnh nhân |
| `hospital_admin` | Admin bệnh viện | Quản lý nhân sự, cấu hình |
| `admin` | Super Admin | Onboarding bệnh viện, toàn quyền |

> 📌 `doctor` dùng `specialty` field để phân biệt `neuroradiologist` (đọc phim) và `neurosurgeon` (điều trị). Không cần tạo role riêng — tránh tăng độ phức tạp RBAC.

### 0.4 — Luồng dữ liệu chính (Happy Path)

```
Bệnh nhân đến → Lễ tân tạo Visit → Bác sĩ khám → Chỉ định MRI
    → KTV upload DICOM → AI xử lý (BullMQ job) → Bác sĩ đọc kết quả
    → Ký duyệt → Lễ tân thanh toán → Bệnh nhân nhận kết quả
```

**Trạng thái Visit tương ứng:**
`đang chờ → đang khám → chờ chụp → đang chụp → chờ kết quả AI → chờ bác sĩ đọc → hoàn tất → đã đóng`

---

## A. MODULE QUẢN LÝ PHÒNG CHỤP & LỊCH HẸN (Resource Scheduler)

**A.1 — Quản lý danh sách phòng MRI**<br>
*Mô tả:* Cho phép admin thêm/sửa/xóa các phòng máy MRI não trong bệnh viện. Mỗi phòng có: tên, model máy, trạng thái hoạt động, số ca tối đa mỗi ngày, thời lượng mỗi ca (mặc định 30 phút).<br>
*Đầu vào:* Admin nhập thông tin phòng.<br>
*Đầu ra:* Danh sách phòng trên giao diện quản lý.<br>
*Model DB:* Cần tạo `MriRoom` model (chưa có trong codebase).

**A.2 — Đặt lịch chụp tự động**<br>
*Mô tả:* Khi bác sĩ chỉ định MRI, hệ thống tự động tìm phòng trống và đặt lịch. Nếu có nhiều phòng, chọn phòng ít ca nhất.<br>
*Đầu vào:* ID bệnh nhân, ngày mong muốn (có thể để trống), mức ưu tiên (normal/emergency).<br>
*Đầu ra:* Slot được đặt (phòng, giờ bắt đầu/kết thúc), thông báo cho KTV và bác sĩ.<br>
*Liên kết:* Tạo slot trong `WorkSchedule` hoặc model mới `MriSlot`.

**A.3 — Xem lịch phòng MRI dạng tuần**<br>
*Mô tả:* Lịch dạng bảng tuần, mỗi phòng một cột, mỗi giờ một hàng. Tô đỏ slot cấp cứu (priority=1). Kéo thả để dời lịch thủ công, có xác nhận.<br>
*Đầu vào:* Tuần cần xem, bộ lọc theo phòng.<br>
*Đầu ra:* Bảng lịch trực quan.

**A.4 — Xử lý cấp cứu (Emergency Override)** 📌 *xem mục 1.5*<br>
*Mô tả:* Khi có bệnh nhân cấp cứu (priority=1), hệ thống tìm slot trống gần nhất. Nếu không có, chọn slot của bệnh nhân thường gần nhất và tự động dời sang slot trống khác. **Soạn sẵn thông báo và chờ lễ tân xác nhận** trước khi gửi cho bệnh nhân bị dời.<br>
*Đầu vào:* ID bệnh nhân cấp cứu.<br>
*Đầu ra:* Slot mới cho cấp cứu, bản nháp thông báo dời lịch cho lễ tân duyệt.

**A.5 — Giải phóng phòng sau khi chụp**<br>
*Mô tả:* Khi KTV xác nhận đã chụp xong (hoặc hủy ca), phòng được giải phóng. Cập nhật `Visit.status` → `chờ kết quả AI`.<br>
*Đầu vào:* ID slot.<br>
*Đầu ra:* Cập nhật trạng thái phòng và Visit.

**A.6 — [MỚI v3.2] Nhắc lịch bệnh nhân tự động**<br>
*Mô tả:* 24 giờ trước giờ chụp, hệ thống tự động gửi email/SMS nhắc lịch cho bệnh nhân (tên, ngày giờ, phòng, hướng dẫn chuẩn bị). Dùng BullMQ scheduled job.<br>
*Đầu vào:* Slot lịch hẹn.<br>
*Đầu ra:* Email/SMS đã gửi, ghi log.

---

## B. MODULE UPLOAD & XỬ LÝ DICOM ĐA CHUỖI

**B.1 — Upload thư mục DICOM (kéo thả / chọn thư mục)**<br>
*Mô tả:* KTV kéo thả toàn bộ thư mục chứa các series hoặc file `.zip`. Hỗ trợ upload file lớn (>1GB) với cơ chế tạm dừng/tiếp tục (giao thức TUS).<br>
*Đầu vào:* Thư mục hoặc file zip.<br>
*Đầu ra:* Tiến trình upload, thông báo hoàn tất.

**B.2 — Tự động nhận diện và phân loại series** 📌 *xem mục 1.3*<br>
*Mô tả:* Sau upload, backend phân tích **DICOM metadata** (tag `SeriesDescription`, `Modality`, `ScanningSequence`) làm nguồn chính, tên thư mục là gợi ý dự phòng. Nhận diện: T2 FLAIR, DWI, ADC, TOF MRA, T1 FLAIR, T2 coronal. Series không xác định gắn nhãn "OTHER" nhưng vẫn lưu.<br>
*Đầu vào:* Danh sách file `.dcm` đã upload.<br>
*Đầu ra:* Gán nhãn từng series, cập nhật `ImagingResult.dicomMetadata`.

**B.3 — Upload toàn bộ file `.dcm` lên Google Drive, giữ nguyên cấu trúc**<br>
*Mô tả:* Với mỗi series, backend tạo thư mục tương ứng trên Drive và upload toàn bộ file `.dcm` (giữ nguyên tên). Lưu metadata (số slice, series UID, mô tả) vào database.<br>
*Đầu vào:* Dữ liệu DICOM đã parse.<br>
*Đầu ra:* Đường dẫn Drive cho từng series, ID file/folder trên Drive. Cập nhật `ImagingResult.dicomMetadata.dicomFileUrls`.

**B.4 — Tạo bản ghi Study và Series trong database**<br>
*Mô tả:* Tạo hoặc cập nhật `ImagingResult`, liên kết `Visit` (`Visit.mriOrder.imagingResultId`), ghi nhận ngày chụp, thông tin kỹ thuật (số slice, loại chuỗi), bác sĩ chỉ định, KTV thực hiện.<br>
*Đầu ra:* Bản ghi `ImagingResult` được lưu. Cập nhật `Visit.status` → `chờ kết quả AI`, kích hoạt AI job.

**B.5 — [MỚI v3.2] Kiểm tra tính hợp lệ DICOM trước khi xử lý**<br>
*Mô tả:* Trước khi gửi vào pipeline AI, kiểm tra: (1) file `.dcm` đọc được không bị corrupt, (2) đủ series tối thiểu (ít nhất T2 FLAIR), (3) số slice đủ lớn (>= 10 slice). Nếu thiếu, báo lỗi cụ thể cho KTV và không kích hoạt AI job.<br>
*Đầu ra:* Danh sách lỗi/cảnh báo cho KTV, trạng thái validation.

---

## C. MODULE XỬ LÝ AI ĐA CHUỖI (BRAIN AI PIPELINE) 📌 *xem mục 1.1*

**C.1 — Xử lý T2 FLAIR: phân đoạn u, tính thể tích, lệch đường giữa**<br>
*Mô tả:* AI đọc toàn bộ slice T2 FLAIR, chạy U-Net/YOLO segmentation xác định ranh giới u trên từng slice, tính thể tích u (cm³) bằng tổng voxel × thể tích 1 voxel, phát hiện đường giữa (falx) và đo độ lệch (midline shift, mm).<br>
*Đầu vào:* Thư mục series T2 FLAIR.<br>
*Đầu ra:* Mask phân đoạn (NIfTI/PNG), thể tích u, midline shift, vị trí u, confidence score.

> 📌 Gợi ý kỹ thuật thêm: vì đã có mask 3D đầy đủ (không chỉ vài lát rời rạc), tính thể tích bằng tổng voxel dương tính × thể tích 1 voxel sẽ đơn giản và chính xác hơn tích phân Simpson — Simpson phù hợp hơn khi chỉ có vài lát cắt thưa (như trong siêu âm tim), không phải trường hợp này.

**C.2 — Xử lý DWI & ADC: đánh giá ác tính**<br>
*Mô tả:* AI đọc series DWI (b1000) và ADC map, tính ADC trung bình trong vùng u đã phân đoạn. Ngưỡng ADC (<800 xem là ác tính) cho điểm nghi ngờ (low/moderate/high). Có thể dùng CNN phân loại glioma, meningioma...<br>
*Đầu vào:* Series DWI và ADC.<br>
*Đầu ra:* ADC trung bình trong u, mức nghi ngờ ác tính, ảnh heatmap ADC.

**C.3 — Xử lý 3D TOF MRA: phát hiện xâm lấn mạch máu**<br>
*Mô tả:* AI chạy trên chuỗi 3D TOF để phát hiện mạch máu lân cận, xác định khối u có xâm lấn/chèn ép mạch không (YOLO hoặc phân đoạn mạch).<br>
*Đầu vào:* Series TOF MRA.<br>
*Đầu ra:* Kết luận có/không xâm lấn mạch, vị trí mạch liên quan.

**C.4 — Hợp nhất báo cáo đa chuỗi**<br>
*Mô tả:* Tổng hợp kết quả C.1–C.3 thành báo cáo JSON thống nhất: thể tích u, lệch đường giữa, mức ác tính, xâm lấn mạch, vị trí giải phẫu, khuyến cáo sơ bộ. Lưu vào `AI_Results/Combined/full_report.json` trên Drive.<br>
*Đầu ra:* Báo cáo JSON đầy đủ. Cập nhật `Visit.status` → `chờ bác sĩ đọc`. Kích hoạt Module D (phân công).

**C.5 — Tạo mô hình 3D khối u não (GLTF/OBJ)**<br>
*Mô tả:* Từ mask phân đoạn T2 FLAIR, dựng mesh 3D khối u và nền não, xuất `.gltf`/`.obj` để hiển thị web. Lưu tại `AI_Results/Combined/tumor_3d_model.gltf`.<br>
*Đầu vào:* Mask phân đoạn 3D.<br>
*Đầu ra:* File 3D model lưu trên Drive + link hiển thị.

**C.6 — Chọn 5 slice "nguy hiểm nhất"**<br>
*Mô tả:* Từ toàn bộ slice T2 FLAIR, chọn 5 slice có diện tích u lớn nhất hoặc lệch đường giữa lớn nhất. Vẽ bounding box, chú thích, lưu JPEG vào `AI_Results/T2_FLAIR/top_slices/`.<br>
*Đầu vào:* Volume T2 FLAIR, mask phân đoạn.<br>
*Đầu ra:* 5 ảnh JPEG kèm metadata (số slice, diện tích u, confidence).

**C.7 — Chọn 1 ảnh đại diện cho bệnh nhân**<br>
*Mô tả:* Từ 5 slice đã chọn, chọn slice có u rõ nhất (diện tích lớn, vị trí trung tâm, độ tin cậy cao) làm ảnh đại diện, lưu vào `Patient_View/result_image.jpg`.<br>
*Đầu ra:* 1 ảnh JPEG. Lưu URL vào `ImagingResult`.

**C.8 — [MỚI v3.2] Theo dõi tiến trình AI job (Progress Tracking)**<br>
*Mô tả:* Mỗi bước trong pipeline AI (C.1 → C.7) cập nhật tiến trình (%) lên Redis/BullMQ. Frontend polling hoặc WebSocket nhận cập nhật, hiển thị progress bar cho KTV và bác sĩ trực.<br>
*Đầu ra:* `{ jobId, progress: 0-100, currentStep: "C.1 T2 FLAIR segmentation", estimatedTime }`.

**C.9 — [MỚI v3.2] Xử lý lỗi & retry AI pipeline**<br>
*Mô tả:* Nếu một bước AI thất bại (lỗi model, hết RAM, timeout), BullMQ tự retry tối đa 3 lần với exponential backoff. Sau 3 lần vẫn lỗi, gửi cảnh báo cho admin + KTV, ghi log chi tiết, đặt `Visit.status` → `lỗi AI` (cần thêm vào enum).<br>
*Đầu ra:* Thông báo lỗi có mô tả kỹ thuật, trạng thái job, log retry.

---

## D. MODULE TỰ ĐỘNG PHÂN CÔNG BÁC SĨ (SMART ASSIGNMENT)

**D.1 — Phân công Neuroradiologist đọc phim**<br>
*Mô tả:* Khi AI xử lý xong (C.4), hệ thống tìm bác sĩ có `specialty = "neuroradiologist"` đang trực, `currentCaseload` thấp nhất, gán task "Đọc kết quả MRI não" trong bảng Kanban. Thông báo qua WebSocket + email.<br>
*Đầu vào:* ID kết quả AI (`ImagingResult`).<br>
*Đầu ra:* Task được gán, cập nhật `currentCaseload`.

> 📌 `specialty` chưa có trong `user.model.js` hiện tại — cần thêm trường `specialty: { type: String, default: "" }` vào `profile` object. Không cần tạo role riêng.

**D.2 — Phân công Neurosurgeon điều trị**<br>
*Mô tả:* Khi bệnh nhân được tạo (hoặc có kết quả AI), gán Neurosurgeon đã chỉ định từ lịch hẹn; nếu cấp cứu, gán Neurosurgeon trực (`isOnCall = true`). Cân bằng theo `currentCaseload`.<br>
*Đầu vào:* ID bệnh nhân/visit.<br>
*Đầu ra:* Bác sĩ được gán, ghi log.

**D.3 — Điều chỉnh phân công thủ công (Override)**<br>
*Mô tả:* Admin/trưởng khoa can thiệp thủ công, đổi bác sĩ được phân công, ghi log lý do (bắt buộc điền lý do khi override).<br>
*Đầu vào:* ID task, ID bác sĩ mới, lý do override.<br>
*Đầu ra:* Cập nhật task, ghi `AuditLog`.

**D.4 — [MỚI v3.2] Theo dõi caseload bác sĩ real-time**<br>
*Mô tả:* Dashboard trưởng khoa hiển thị số ca đang xử lý của từng bác sĩ theo ca trực. Cảnh báo khi bác sĩ vượt ngưỡng `maxCaseload` (VD >10 ca/ca trực). Hỗ trợ tự động hoặc thủ công cân bằng lại.<br>
*Đầu ra:* Bảng caseload real-time, cảnh báo vượt ngưỡng.

---

## E. MODULE CẤP CỨU (EMERGENCY PROTOCOL)

**E.1 — Tự động kích hoạt cấp cứu từ AI**<br>
*Mô tả:* Nếu `midline_shift > 5mm` hoặc `tumor_volume > 50cm³` (ngưỡng cấu hình trong K.4), hệ thống tự chuyển visit sang EMERGENCY (priority=1), tạo `emergency_alert` mức RED. Ngưỡng mặc định có thể điều chỉnh từ K.4.<br>
*Đầu vào:* Kết quả AI từ C.4.<br>
*Đầu ra:* Cập nhật `Visit.priority`, tạo alert, kích hoạt E.3.

**E.2 — Kích hoạt cấp cứu thủ công**<br>
*Mô tả:* Bác sĩ nhấn nút "Cấp cứu" để kích hoạt quy trình tương tự E.1, dù AI chưa kích hoạt. Ghi log người kích hoạt và lý do.<br>
*Đầu ra:* Giống E.1, kèm log thủ công.

**E.3 — WebSocket Alert toàn hệ thống**<br>
*Mô tả:* Khi có emergency, gửi WebSocket event đến toàn bộ bác sĩ trực (Neuroradiologist + Neurosurgeon đang online), hiển thị pop-up toàn màn hình kèm âm thanh, đẩy push notification di động (nếu có FCM token).<br>
*Đầu ra:* Hiển thị cảnh báo trên các client. Ghi nhận ai đã "acknowledge" cảnh báo và thời điểm.

**E.4 — Bảng điều khiển cấp cứu (Emergency Dashboard)**<br>
*Mô tả:* Trang riêng cho bác sĩ trực, hiển thị các ca đỏ đang hoạt động, thời gian trôi qua (đếm ngược từ lúc phát hiện), tình trạng chụp/AI/đọc phim, countdown theo dõi tiến độ. Cảnh báo màu cam nếu quá 30 phút chưa có bác sĩ acknowledge.<br>
*Đầu ra:* Dashboard real-time.

**E.5 — Ưu tiên xử lý AI cho ca cấp cứu**<br>
*Mô tả:* Job AI của ca đỏ được đẩy lên đầu hàng đợi BullMQ (`priority: 1`), không xếp sau job thường, đảm bảo có kết quả trong vòng 5 phút (SLA mục tiêu).<br>
*Đầu ra:* Job được ưu tiên, thời gian xử lý được ghi log để theo dõi SLA.

---

## F. MODULE CHUYỂN VIỆN THÔNG MINH

**F.1 — Đề xuất chuyển viện dựa trên vị trí u**<br>
*Mô tả:* Nếu AI xác định u ở vùng nguy hiểm (thân não, vùng chức năng) hoặc vượt khả năng phẫu thuật của viện (do admin cấu hình năng lực), hệ thống hiển thị popup đề xuất chuyển viện kèm danh sách viện tuyến trên đã cấu hình.<br>
*Đầu vào:* Kết quả AI, danh sách viện đích.<br>
*Đầu ra:* Gợi ý chuyển viện, bác sĩ xác nhận/từ chối.

**F.2 — Tạo gói dữ liệu chuyển viện (Export Package)**<br>
*Mô tả:* Khi bác sĩ xác nhận chuyển viện, đóng gói: báo cáo AI (full_report.json), 3D model (.gltf), 5 slice quan trọng (.jpg), tóm tắt bệnh án (từ `MedicalRecord`), thông tin bệnh nhân, DICOM nén (.zip), phiếu đồng thuận. Mã hoá gói, tạo link tải có thời hạn 48 giờ. Lưu `TransferForm`.<br>
*Đầu vào:* ID bệnh nhân, ID viện đích.<br>
*Đầu ra:* Link tải package, `TransferForm` với status `pending`.

**F.3 — Gửi package sang viện đích (API/SFTP)**<br>
*Mô tả:* Nếu viện đích có hệ thống tương thích (cùng nền tảng NeuroScan), gửi qua API tự động; nếu không, gửi email chứa link tải đến địa chỉ liên hệ của viện đích.<br>
*Đầu vào:* Package, thông tin viện đích (từ danh sách admin cấu hình).<br>
*Đầu ra:* Xác nhận gửi thành công, cập nhật `TransferForm.status` → `sent`.

**F.4 — Theo dõi trạng thái chuyển viện**<br>
*Mô tả:* Cập nhật trạng thái (`pending → sent → received → accepted/rejected`). Bác sĩ xem lịch sử trong `TransferForm`. Nếu từ chối, hệ thống gợi ý viện đích khác.<br>
*Đầu ra:* Trạng thái hiện tại, lịch sử.

> 📌 Nên gọi Q.2 (giữ chỗ giường) ngay khi viện đích chuyển trạng thái "đã nhận" — tránh trường hợp duyệt chuyển viện xong mới phát hiện hết giường.

**F.5 — [MỚI v3.2] Quyền xem bệnh án liên viện**<br>
*Mô tả:* Sau khi gói dữ liệu được gửi và viện đích xác nhận nhận (`status = received`), hệ thống cấp quyền xem tạm thời (`cross-hospital view`) cho bác sĩ của viện đích truy cập `ImagingResult` và `MedicalRecord` của bệnh nhân qua API công khai có token. Token hết hạn sau 7 ngày hoặc khi bệnh nhân xuất viện bên viện đích.<br>
*Đầu ra:* Token truy cập tạm thời, ghi `AuditLog` mỗi lần truy cập.

> 📌 `emr.controller.js` đã có comment `// Cho phép xem bệnh án liên viện` — điểm hook sẵn để triển khai F.5.

---

## G. MODULE HIỂN THỊ & TƯƠNG TÁC VỚI BÁC SĨ (CLINICAL VIEW) 📌 *xem mục 1.2 — G.1 và G.3 nên làm cùng đợt với Module C*

**G.1 — Trình xem DICOM đa chuỗi (OHIF/CornerstoneJS)**<br>
*Mô tả:* Tích hợp trình xem DICOM (OHIF Viewer hoặc CornerstoneJS) cho bác sĩ xem từng series, chuyển đổi giữa các chuỗi, chỉnh window/level, zoom, pan, đo khoảng cách/góc — chạy trên web. Tải ảnh từ URL Drive (signed URL do backend cấp, không expose trực tiếp).<br>
*Đầu vào:* `ImagingResult._id` hoặc `studyInstanceUID`.<br>
*Đầu ra:* Giao diện xem ảnh tương tác.

**G.2 — Hiển thị kết quả AI overlay trên viewer**<br>
*Mô tả:* Hiển thị bounding box (từ C.6), mask phân đoạn (từ C.1), heatmap ADC (từ C.2) overlay trên ảnh DICOM trong viewer. Nút bật/tắt từng lớp overlay.<br>
*Đầu ra:* Overlay trực quan, bác sĩ có thể tắt từng lớp riêng.

**G.3 — Hiển thị báo cáo AI tổng hợp kèm số liệu**<br>
*Mô tả:* Trang chi tiết hiển thị đầy đủ: thể tích u (cm³), lệch đường giữa (mm), mức ác tính (low/moderate/high), có/không xâm lấn mạch, vị trí giải phẫu (thùy não), ADC trung bình, confidence score. Kèm biểu đồ xu hướng nếu bệnh nhân có nhiều lần chụp.<br>
*Đầu ra:* Trang báo cáo với số liệu và biểu đồ.

**G.4 — Hiển thị mô hình 3D tương tác**<br>
*Mô tả:* Dùng Three.js/Babylon.js hiển thị mô hình 3D não và khối u (từ C.5), cho phép xoay/zoom/cắt lớp theo trục axial/sagittal/coronal, có thể kết hợp mạch máu từ TOF MRA.<br>
*Đầu vào:* File `tumor_3d_model.gltf` từ Drive.<br>
*Đầu ra:* Mô hình 3D tương tác.

**G.5 — Bác sĩ hiệu chỉnh kết quả AI (Active Learning)**<br>
*Mô tả:* Bác sĩ chỉnh sửa bounding box (kéo thả), vẽ lại mask trên viewer nếu AI sai. Dữ liệu hiệu chỉnh lưu vào `AI_Results/Feedback/feedback_{timestamp}.json`, gắn nhãn `is_correction = true`, dùng cho retraining (K.5).<br>
*Đầu ra:* Lưu bản sửa, ghi log. Cập nhật badge "Đã hiệu chỉnh" trên case.

**G.6 — [MỚI v3.2] So sánh nhiều lần chụp (Follow-up Comparison)**<br>
*Mô tả:* Khi bệnh nhân có ≥2 lần chụp MRI, hiển thị side-by-side viewer cho phép bác sĩ so sánh ảnh, kèm biểu đồ thay đổi thể tích u và midline shift theo thời gian (từ `Doctor_View/Measurements/tumor_volume_history.json`).<br>
*Đầu ra:* Giao diện so sánh song song, biểu đồ trend.

---

## H. MODULE DÀNH CHO BỆNH NHÂN (B2C) — SỔ SỨC KHỎE CÁ NHÂN

**H.1 — Xem ảnh kết quả MRI đại diện**<br>
*Mô tả:* Bệnh nhân xem 1 ảnh đại diện (có bounding box, chú thích đời thường — không dùng thuật ngữ y học chuyên sâu) cùng báo cáo ngôn ngữ bình thường. Không xem được toàn bộ DICOM.<br>
*Đầu ra:* Ảnh từ `Patient_View/result_image.jpg` và báo cáo từ `patient_report.html`.

**H.2 — Tải báo cáo kết quả dạng PDF**<br>
*Mô tả:* Bệnh nhân tải báo cáo PDF gồm ảnh đại diện, số liệu (thể tích u, ngày chụp, bác sĩ đọc) và nội dung giải thích bằng ngôn ngữ đời thường. PDF được tạo server-side (Puppeteer/PDFKit).<br>
*Đầu ra:* File PDF từ `Patient_View/patient_report.pdf`.

**H.3 — Chia sẻ kết quả qua QR code**<br>
*Mô tả:* Tạo link chia sẻ có thời hạn (30 ngày) và QR code, cho phép bác sĩ khác xem kết quả mà không cần tài khoản hệ thống. Link lưu tại `Patient_View/share_link.txt`.<br>
*Đầu ra:* Link + QR code (PNG), ghi log truy cập vào `AuditLog`.

**H.4 — Đặt lịch tái khám / chụp lại**<br>
*Mô tả:* Bệnh nhân tự đặt lịch tái khám/chụp định kỳ. Hệ thống kiểm tra lịch trống của bác sĩ và phòng máy (Module A). Gửi xác nhận qua email.<br>
*Đầu ra:* Xác nhận lịch, email/notification.

**H.5 — [MỚI v3.2] Lịch sử các lần khám**<br>
*Mô tả:* Bệnh nhân xem danh sách tất cả lần khám/chụp, trạng thái (chờ kết quả / có kết quả / đã thanh toán), ngày tháng, bác sĩ phụ trách.<br>
*Đầu ra:* Danh sách Visit theo thứ tự thời gian giảm dần.

**H.6 — [MỚI v3.2] Nhận thông báo khi kết quả sẵn sàng**<br>
*Mô tả:* Sau khi bác sĩ ký duyệt kết quả, hệ thống tự động gửi push notification (nếu dùng mobile app) và email thông báo kết quả MRI đã sẵn sàng, kèm link xem trực tiếp.<br>
*Đầu ra:* Notification + email với deep link vào H.1.

---

## I. MODULE QUẢN LÝ WORKFLOW & TASK (CHO NHÂN VIÊN)

**I.1 — Kanban Board theo vai trò**<br>
*Mô tả:* Mỗi nhân viên có bảng Kanban riêng: "Chờ xử lý" / "Đang xử lý" / "Hoàn thành". Kéo thả để cập nhật trạng thái task. Bộ lọc theo ngày, bệnh nhân, mức ưu tiên.<br>
*Đầu ra:* Board theo vai trò, cập nhật real-time qua WebSocket.

**I.2 — Tự động tạo task theo quy trình (Workflow Engine)**<br>
*Mô tả:* Khi visit được tạo, tự động tạo chuỗi task:

| STT | Task | Vai trò | Trigger |
|---|---|---|---|
| 1 | Tiếp nhận bệnh nhân | Lễ tân | Tạo Visit |
| 2 | Khám lâm sàng ban đầu | Bác sĩ | Bước 1 hoàn thành |
| 3 | Chỉ định MRI | Bác sĩ | Sau khám |
| 4 | Chụp MRI | KTV | Sau chỉ định |
| 5 | Xử lý AI | Auto | DICOM upload xong |
| 6 | Đọc & phân tích kết quả | Bác sĩ (Neuroradiologist) | AI xử lý xong |
| 7 | Ký duyệt báo cáo | Bác sĩ | Sau đọc phim |
| 8 | Thanh toán | Lễ tân | Sau ký duyệt |

*Đầu ra:* Các task được tạo tự động, gán đúng vai trò.

**I.3 — Cảnh báo quá hạn (Deadline Alert)**<br>
*Mô tả:* Nếu task không hoàn thành trong thời gian quy định (VD đọc phim quá 4 giờ, ký duyệt quá 2 giờ sau đọc phim), gửi nhắc nhở đến người phụ trách qua WebSocket + email, cc cấp quản lý.<br>
*Cấu hình:* Thời hạn từng task do admin cấu hình (K.4).<br>
*Đầu ra:* Thông báo nhắc nhở, badge đỏ trên task quá hạn.

**I.4 — [MỚI v3.2] Dashboard tổng quan ca trực (Shift Overview)**<br>
*Mô tả:* Trưởng khoa/bác sĩ trực xem tổng quan ca hiện tại: số ca đang xử lý, ca cấp cứu, ca quá hạn, phân bổ tải theo bác sĩ. Cập nhật mỗi 30 giây.<br>
*Đầu ra:* Dashboard tổng quan với số liệu thực tế.

---

## J. MODULE THÔNG BÁO & REAL-TIME

**J.1 — WebSocket cho thông báo nội bộ**<br>
*Mô tả:* Toàn bộ thông báo nội bộ (task mới, emergency, deadline, kết quả AI xong) gửi qua Socket.IO, hỗ trợ đa tab/đa thiết bị. Room phân theo `hospitalId` đảm bảo multi-tenant an toàn.<br>
*Events:* `task:new`, `task:update`, `emergency:alert`, `ai:completed`, `deadline:warning`.

**J.2 — Thông báo qua email (bệnh nhân)**<br>
*Mô tả:* Gửi email xác nhận lịch hẹn (kèm thông tin chuẩn bị), nhắc lịch 24h trước, thông báo kết quả sẵn sàng kèm link xem, xác nhận thanh toán. Template HTML đẹp, responsive. Dùng `email.service.js` đã có sẵn.<br>
*Trigger:* Từ BullMQ job (không block API response).

**J.3 — Thông báo qua SMS (tuỳ chọn)**<br>
*Mô tả:* Tích hợp dịch vụ SMS (ViettelSMS/Twilio) để nhắc lịch trước 2 giờ và cảnh báo cấp cứu cho bác sĩ không online. Fallback nếu WebSocket không tới được thiết bị.<br>
*Kích hoạt:* Admin bật/tắt per bệnh viện.

**J.4 — [MỚI v3.2] Push Notification Mobile (FCM)**<br>
*Mô tả:* Tích hợp Firebase Cloud Messaging (FCM) để gửi push notification đến app React Native. Ưu tiên cho: cảnh báo cấp cứu (E.3), kết quả MRI sẵn sàng (H.6), task mới được gán (D.1).<br>
*Cài đặt:* Lưu `fcmToken` trong `User` model. Token được cập nhật mỗi lần app mở.

---

## K. MODULE QUẢN TRỊ HỆ THỐNG (ADMIN)

**K.1 — Quản lý bệnh viện (onboarding)**<br>
*Mô tả:* Admin thêm bệnh viện mới, cấu hình subscription (`trial/basic/pro`), tạo thư mục Drive theo cấu trúc chuẩn, tạo tài khoản `hospital_admin` đầu tiên. Bệnh viện mới bắt đầu với `status: "provisioned"`, chuyển sang `active` sau khi hoàn tất onboarding.<br>
*Model:* `Hospital` (đã có), bổ sung `Hospital.aiThresholds` cho K.4.

**K.2 — Quản lý nhân viên (CRUD)**<br>
*Mô tả:* `hospital_admin` thêm/sửa/xóa (deactivate) tài khoản nhân viên, gán role và specialty, đặt `isOnCall`, `maxCaseload`. Không xóa vật lý — dùng `isLocked = true`.<br>
*Đầu ra:* Cập nhật `User` model.

**K.3 — Xem audit log & nhật ký hệ thống**<br>
*Mô tả:* Xem hành động nhân viên (đăng nhập, chỉnh bệnh án, override phân công), log AI (feedback, lỗi, retry), log thanh toán. Lọc theo ngày/người dùng/hành động. Export CSV.<br>
*Model:* `AuditLog` (đã có tại `auditLog.model.js`).

**K.4 — Cấu hình tham số AI & hệ thống**<br>
*Mô tả:* Admin điều chỉnh: ngưỡng midline shift (mặc định 5mm), thể tích u kích hoạt cấp cứu (50cm³), thời hạn task từng bước, tỷ lệ QA bình duyệt (mặc định 5%), giá dịch vụ (exam/MRI/AI fee). Lưu trong `Hospital.aiThresholds`.<br>
*Đầu ra:* Cấu hình áp dụng ngay không cần restart.

**K.5 — Kích hoạt retrain AI (Active Learning)**<br>
*Mô tả:* Admin xem danh sách feedback từ G.5 (bản sửa của bác sĩ), lọc các case chất lượng cao, kích hoạt retrain job. Theo dõi tiến trình training, so sánh metrics trước/sau.<br>
*Đầu ra:* Retrain job được đẩy vào hàng đợi AI service.

**K.6 — [MỚI v3.2] Quản lý subscription & giới hạn**<br>
*Mô tả:* Hiển thị subscription hiện tại (`trial/basic/pro`), ngày hết hạn, số bệnh nhân đã dùng / giới hạn (`maxPatients`). Cảnh báo khi sắp hết hạn (< 7 ngày) hoặc sắp đạt giới hạn (>90%).<br>
*Đầu ra:* Dashboard subscription, email cảnh báo tự động.

---

## L. MODULE TÍCH HỢP GOOGLE DRIVE — DUNG LƯỢNG & BACKUP 📌 *xem mục 1.4*

**L.1 — Tự động tạo cấu trúc thư mục cho bệnh nhân mới**<br>
*Mô tả:* Khi bệnh nhân lần đầu có study, tự động tạo cây thư mục `Hospitals/{hospitalId}/{patientId}/Studies/{date_UID}/...` theo cấu trúc chuẩn (xem phần Cấu trúc Drive). Lưu ID từng thư mục vào DB.

**L.2 — Tự động backup dữ liệu hàng ngày & hàng tuần**<br>
*Mô tả:* Hàng đêm (02:00) nén toàn bộ thư mục metadata của bệnh viện, upload bản backup daily. Cuối tuần (Chủ nhật) tạo bản weekly. Giữ 7 bản daily và 4 bản weekly gần nhất.<br>
*Đầu ra:* File `backup_YYYY-MM-DD.zip` tại thư mục `Backups/daily/`.

**L.3 — Cảnh báo dung lượng Drive sắp đầy**<br>
*Mô tả:* Kiểm tra dung lượng hàng ngày, gửi cảnh báo email cho admin khi >80% và >95%. Đề xuất hành động (xóa backup cũ, nâng cấp Drive).<br>
*Đầu ra:* Email cảnh báo, ghi log dung lượng theo ngày.

**L.4 — Tạo link chia sẻ có thời hạn cho Patient_View**<br>
*Mô tả:* Tự động tạo Google Drive signed URL (hoặc link public với hạn expire) cho `Patient_View/result_image.jpg` và PDF, lưu URL và thời hạn vào DB. Không expose URL Drive trực tiếp — phải qua backend proxy.<br>
*Đầu ra:* Signed URL lưu trong DB, hết hạn sau 30 ngày (cấu hình được).

> 📌 Backup 7 bản gần nhất là backup **vận hành** (chống lỗi/xóa nhầm gần đây), không phải lưu trữ **dài hạn** theo yêu cầu lưu hồ sơ y tế nếu triển khai thật — cần chính sách lưu trữ dài hạn riêng khi ra khỏi phạm vi đồ án.

**L.5 — [MỚI v3.2] Dọn dẹp file tạm & orphan**<br>
*Mô tả:* Job hàng tuần quét các file tạm (upload thất bại, file chưa link vào DB sau 24h) và xóa để tránh rác Drive. Ghi log hành động dọn dẹp.<br>
*Đầu ra:* Báo cáo file đã xóa, dung lượng giải phóng.

---

## M. MODULE TÀI CHÍNH & THANH TOÁN

> 📌 **[Cập nhật v3.2]** Codebase thực tế đã tích hợp PayOS (VietQR). Module M cần đặc tả đầy đủ flow thanh toán online, không chỉ tiền mặt.

**M.1 — Tạo hóa đơn tự động sau khi hoàn thành visit**<br>
*Mô tả:* Khi `Visit.status` = `hoàn tất` (bác sĩ ký duyệt xong), lễ tân có thể tạo hóa đơn một click. Hóa đơn tự động tính:
- Phí khám (`Hospital.pricing.examFee`, mặc định 150,000đ)
- Phí MRI (`mriFee`, mặc định 1,500,000đ) nếu có lệnh chụp
- Phí AI (`aiFee`, mặc định 200,000đ) nếu `requestAiAnalysis = true`
- Tiền thuốc (từ `Prescription` chưa billed)

*Model:* `Invoice` (đã có). Tham chiếu `Visit.mriOrder.requestAiAnalysis`.

**M.2 — Theo dõi thanh toán & cập nhật trạng thái**<br>
*Mô tả:* Lễ tân xem danh sách hóa đơn, cập nhật trạng thái thanh toán. In hóa đơn (PDF có logo bệnh viện). Lọc theo ngày, trạng thái, bệnh nhân.<br>
*Đầu ra:* Danh sách hóa đơn, PDF in được.

**M.3 — Thanh toán tiền mặt / chuyển khoản thủ công**<br>
*Mô tả:* Lễ tân xác nhận thanh toán tiền mặt hoặc chuyển khoản. Đặt `Invoice.status = "đã thanh toán"`, `paymentMethod = "tiền mặt"|"chuyển khoản"`, `paidAt`. Ghi `EMRVersion` (audit trail thanh toán).<br>
*Đầu ra:* Hóa đơn đã thanh toán, `Visit.status` → `đã đóng`.

**M.4 — [MỚI v3.2] Thanh toán online VietQR (PayOS)**<br>
*Mô tả:* Lễ tân hoặc bệnh nhân tạo link thanh toán QR PayOS. Hệ thống gọi PayOS API tạo `checkoutUrl`, gán `orderCode` vào hóa đơn. Bệnh nhân quét QR thanh toán. PayOS gọi webhook confirm → hóa đơn tự động chuyển sang "đã thanh toán".<br>
*Flow:* Lễ tân → POST `/invoices/visit/:visitId/payos` → nhận `checkoutUrl` → hiện QR → bệnh nhân quét → PayOS webhook → `Invoice.status = "đã thanh toán"`.

**M.5 — [MỚI v3.2] Hoàn tiền hóa đơn**<br>
*Mô tả:* Trong trường hợp hủy ca/sai thu, admin/lễ tân thực hiện hoàn tiền: ghi nhận lý do hoàn tiền, đặt `Invoice.status = "hoàn tiền"`, cập nhật `AuditLog`.<br>
*Đầu ra:* Hóa đơn hoàn tiền, ghi log.

> 📌 Module R (bên dưới) mở rộng M để hỗ trợ bệnh nhân có BHYT — hiện M chỉ đúng cho mô hình thanh toán tiền mặt/tự chi trả.

---

## N. MODULE KHÁC (KHÔNG BẮT BUỘC)

**N.1 — Chat nội bộ giữa bác sĩ (hội chẩn)**<br>
*Mô tả:* Trò chuyện real-time giữa bác sĩ về ca bệnh cụ thể. Gửi ảnh (slice MRI), bình luận, tag người dùng. Lưu lịch sử. Liên kết với `Consultation` model đã có.<br>
*Model:* Có thể tái dùng `Consultation.model.js`, thêm trường `messages[]`.

**N.2 — Tích hợp HIS hiện tại (HL7/FHIR)**<br>
*Mô tả:* Connector đồng bộ dữ liệu bệnh nhân/dịch vụ/kết quả nếu bệnh viện đã có HIS (hệ thống thông tin bệnh viện). Hỗ trợ HL7 v2.x và FHIR R4.<br>
*Độ phức tạp:* Cao — chỉ làm khi bệnh viện cụ thể yêu cầu.

**N.3 — Phân tích thống kê vận hành**<br>
*Mô tả:* Báo cáo hàng tháng/quý: số lượng u, loại u (glioma/meningioma/...), tỷ lệ ác tính, kết quả điều trị, thời gian xử lý trung bình từng bước. Export Excel/PDF.<br>
*Liên kết:* Module W bên dưới mở rộng chi tiết hơn.

---

## O. BỔ SUNG VÀO CHỨC NĂNG HIỆN CÓ (CẦN SỬA ĐỔI)

| Chức năng cũ | Cần sửa đổi / bổ sung |
|---|---|
| Đăng nhập / RBAC | Thêm kiểm tra `specialty` trong profile khi phân quyền xem phim vs. xem bệnh nhân |
| Tạo bệnh nhân | Bổ sung trường `brain_region` (vùng não) và `priority` (mặc định 5) vào `Visit` |
| Upload ảnh đơn | Giữ lại nhưng đánh dấu ảnh lẻ (không thuộc study DICOM), không qua xử lý volume |
| Chatbot RAG | Cập nhật context bằng tài liệu về u não (guidelines WHO 2021, phân loại WHO CNS) |
| Báo cáo EMR | Tích hợp kết quả AI volume vào `MedicalRecord` (hiển thị thể tích u, lệch đường giữa) |
| `Visit.status` enum | Thêm trạng thái `lỗi AI` vào enum cho trường hợp C.9 xảy ra |
| `User.profile` | Thêm `specialty`, `isOnCall`, `maxCaseload`, `fcmToken` |
| `Hospital` model | Thêm `aiThresholds` (midline/volume/taskDeadlines) và bổ sung `subFolders` IDs |
| `ImagingResult` | Thêm trường AI: `aiReport` (JSON), `segmentationUrl`, `top5SlicesUrls`, `representativeSliceUrl` |

---

## P. MODULE BÌNH DUYỆT LẦN 2 (PEER REVIEW) — MỚI

**P.1 — Gắn cờ ca cần bình duyệt**<br>
*Mô tả:* Khi bác sĩ ký kết quả nhưng feedback không khớp chẩn đoán AI (`is_conflict = true`, VD AI nói high malignancy nhưng bác sĩ kết luận benign), hoặc bác sĩ tự chọn "yêu cầu ý kiến thứ 2", hệ thống gắn cờ ca cần một bác sĩ cùng chuyên khoa khác xem lại độc lập.<br>
*Đầu vào:* ID kết quả, cờ conflict hoặc yêu cầu thủ công.<br>
*Đầu ra:* Task bình duyệt được tạo, gán cho bác sĩ thứ 2 (khác người đọc ca đầu).<br>
*Model DB:* Cần tạo `PeerReview` model.

**P.2 — Lấy mẫu ngẫu nhiên để QA định kỳ**<br>
*Mô tả:* Ngoài ca có conflict, tự động chọn ngẫu nhiên X% (mặc định 5%, admin cấu hình qua K.4) ca đã ký mỗi tuần. Đưa vào hàng chờ bình duyệt phục vụ kiểm soát chất lượng định kỳ. Job chạy mỗi Thứ 2 đầu tuần.<br>
*Đầu ra:* Danh sách ca được chọn ngẫu nhiên, tạo task bình duyệt.

**P.3 — Giao diện so sánh 2 kết quả đọc**<br>
*Mô tả:* Hiển thị song song kết luận của bác sĩ 1 và bác sĩ 2. Nếu khác nhau, trưởng khoa hoặc bác sĩ thứ 3 đưa kết luận cuối cùng. Lưu lịch sử cả 2 (hoặc 3) lượt đọc riêng biệt — không ghi đè lịch sử.<br>
*Đầu vào:* 2 bản đọc.<br>
*Đầu ra:* Kết luận cuối, lưu `PeerReview.finalConclusion`, cập nhật `AuditLog`.

---

## Q. MODULE QUẢN LÝ GIƯỜNG BỆNH — MỚI

**Q.1 — Quản lý danh sách giường theo khoa**<br>
*Mô tả:* Admin cấu hình giường theo từng khoa (VD Khoa Ngoại thần kinh — K.Ngoại), mỗi giường có: số giường, khoa, tầng/phòng, trạng thái (`available/occupied/reserved`), loại phòng (thường/VIP).<br>
*Model DB:* Cần tạo `HospitalBed` model.<br>
*Đầu ra:* Danh sách giường với trạng thái theo thời gian thực.

**Q.2 — Kiểm tra & giữ chỗ giường khi nhập viện hoặc nhận chuyển viện**<br>
*Mô tả:* Khi tạo hồ sơ nhập viện (`MedicalRecord.admissionType = "Nội trú"`), hoặc viện nhận duyệt yêu cầu chuyển viện (Module F), kiểm tra giường trống theo khoa phù hợp. **Giữ chỗ tạm thời 4 giờ** (cấu hình) — nếu bệnh nhân không đến, tự động giải phóng.<br>
*Đầu vào:* Khoa cần (`departmentId`), thời điểm dự kiến nhập viện.<br>
*Đầu ra:* Giường được giữ (`status = "reserved"`) hoặc thông báo hết giường (gợi ý khoa/viện khác).

**Q.3 — Cập nhật trạng thái khi xuất viện**<br>
*Mô tả:* Khi `MedicalRecord.status = "Xuất viện"` (cập nhật `dischargeDate`), giường tự động chuyển về `available`. Kích hoạt job dọn dẹp thông báo đến hộ lý.<br>
*Đầu ra:* Giường giải phóng, thông báo hộ lý vệ sinh phòng.

**Q.4 — [MỚI v3.2] Bản đồ giường trực quan**<br>
*Mô tả:* Giao diện dạng bản đồ phòng bệnh, hiển thị từng giường với màu sắc trạng thái (xanh=trống, đỏ=đang dùng, vàng=giữ chỗ). Cập nhật real-time. Điều dưỡng trưởng xem toàn bộ khoa.<br>
*Đầu ra:* Bản đồ giường tương tác.

---

## R. MODULE TÍCH HỢP BẢO HIỂM Y TẾ (BHYT) — MỚI

**R.1 — Lưu thông tin thẻ BHYT (tách riêng, mã hoá)**<br>
*Mô tả:* Khi tạo hồ sơ, nhập mã thẻ BHYT, mức hưởng (80%/95%/100%), ngày hết hạn thẻ. Lưu mã hoá (AES-256) tách biệt khỏi thông tin y tế chính, chỉ dùng khi lập hồ sơ giám định.<br>
*Model DB:* Thêm `bhytInfo` vào `MedicalRecord` hoặc tạo model riêng.

**R.2 — Tính mức hưởng & đồng chi trả**<br>
*Mô tả:* Khi tạo hóa đơn (M.1), nếu bệnh nhân có BHYT, tự động tính: phần BHYT chi trả và phần bệnh nhân đồng chi trả theo tỷ lệ. Hiển thị 2 dòng riêng trên hóa đơn. Mở rộng `Invoice.items` thêm trường `bhytAmount`.<br>
*Đầu ra:* Hóa đơn chi tiết BHYT + đồng chi trả.

**R.3 — Xuất hồ sơ giám định điện tử**<br>
*Mô tả:* Định kỳ (cuối tháng), xuất dữ liệu khám chữa bệnh có BHYT sang XML theo chuẩn giám định của BHXH Việt Nam (chuẩn 4210/QĐ-BHXH hoặc tương đương hiện hành), gửi tới cổng tiếp nhận.<br>
*Đầu ra:* File XML giám định, biên nhận gửi thành công.

> 📌 Độ phức tạp nghiệp vụ/pháp lý cao — khuyến nghị để giai đoạn sau, sau khi các module lõi đã ổn định. Nghiệp vụ BHYT thay đổi thường xuyên theo thông tư mới của Bộ Y tế.

---

## S. MODULE ĐỒNG THUẬN SỬ DỤNG THUỐC CẢN QUANG — MỚI

**S.1 — Sàng lọc dị ứng trước khi tiêm thuốc**<br>
*Mô tả:* Trước khi KTV thực hiện chụp MRI có tiêm thuốc cản quang Gadolinium, hiển thị checklist bắt buộc điền:
- Tiền sử dị ứng thuốc cản quang (có/không/không rõ)
- Chức năng thận (GFR, eGFR — nếu có xét nghiệm gần đây trong `LabOrder`)
- Đang mang thai hoặc nghi ngờ mang thai
- Đang cho con bú
- Tiền sử bệnh thận mạn, hen phế quản nặng

Nếu có yếu tố nguy cơ, chặn tiến hành và cảnh báo bác sĩ chỉ định. Bác sĩ có thể override với xác nhận lý do.<br>
*Đầu ra:* Cho phép/chặn tiếp tục, cảnh báo bác sĩ, ghi log.

**S.2 — Lưu phiếu đồng thuận điện tử**<br>
*Mô tả:* Bệnh nhân (hoặc người giám hộ) xác nhận đồng thuận tại chỗ — nhập họ tên và tick checkbox xác nhận trên màn hình tablet/phone. Lưu vào `ConsentForm` model (đã có) với `procedureName = "Tiêm thuốc cản quang Gadolinium"`. Ghi timestamp xác nhận.<br>
*Model:* `ConsentForm` model (đã có tại `consentForm.model.js`).<br>
*Đầu ra:* Phiếu đồng thuận với tên bệnh nhân + timestamp, gắn vào `Visit`.

---

## T. MODULE KHẢ NĂNG HOẠT ĐỘNG KHI MẤT MẠNG — MỚI

**T.1 — Cache dữ liệu cần thiết trong ngày (offline-first cho FE)**<br>
*Mô tả:* Ứng dụng React Native (Expo) dùng AsyncStorage/SQLite cache trước: lịch làm việc ca hôm nay, danh sách bệnh nhân đang chờ/đang điều trị, form vitals, care sheet template. Cache làm mới mỗi 15 phút khi có mạng.<br>
*Áp dụng:* KTV (lịch chụp), điều dưỡng (phiếu chăm sóc), lễ tân (danh sách bệnh nhân hôm nay).

**T.2 — Hàng đợi đồng bộ khi có mạng trở lại**<br>
*Mô tả:* Thao tác ghi dữ liệu khi offline (tạo CareSheet, cập nhật vitals, ghi chú) được xếp vào hàng đợi local (React Native Queue). Khi mạng phục hồi, tự động gửi theo thứ tự. Xử lý xung đột: nếu record đã bị thay đổi từ thiết bị khác, hiển thị merge conflict UI cho nhân viên giải quyết.<br>
*Đầu ra:* Dữ liệu đồng bộ an toàn, thông báo rõ nếu có xung đột.

> 📌 Không áp dụng cho các bước cần AI (luôn cần server), upload DICOM, thanh toán — chỉ áp dụng thao tác ghi dữ liệu vận hành (vitals, check-in, ghi chú chăm sóc).

---

## U. MODULE PREMIUM & ĐĂNG KÝ DỊCH VỤ — MỚI (đặc tả từ code thực tế)

> 📌 Module này đã được implement một phần trong `invoice.controller.js` (createPremiumPayment, handlePayOSWebhook) và `user.model.js` (`isPremium`, `premiumUntil`, `autoRenew`). Đặc tả chính thức để làm cơ sở cho FE và test.

**U.1 — Gói Premium cho bệnh nhân cá nhân**<br>
*Mô tả:* Bệnh nhân nâng cấp tài khoản Premium (99,000đ/năm) để mở khoá: xem báo cáo chi tiết hơn, tải báo cáo PDF không giới hạn, chia sẻ QR code, đặt lịch ưu tiên.<br>
*Flow:* Bệnh nhân → POST `/invoices/premium-payment` → nhận `checkoutUrl` PayOS → quét QR → PayOS webhook → `User.isPremium = true`, `premiumUntil = +1 năm`.<br>
*Model:* `PremiumOrder` (đã có), `User.isPremium/premiumUntil/autoRenew`.

**U.2 — Gia hạn Premium tự động (Auto-Renew)**<br>
*Mô tả:* Nếu `User.autoRenew = true`, 7 ngày trước `premiumUntil`, hệ thống gửi email nhắc gia hạn. Nếu bệnh nhân không huỷ, tự tạo link thanh toán mới và gửi qua email.<br>
*Đầu ra:* Email gia hạn, link thanh toán, `autoRenew` có thể tắt bất kỳ lúc nào.

**U.3 — Quản lý subscription bệnh viện**<br>
*Mô tả:* Bệnh viện đăng ký gói (`trial/basic/pro`) từ Super Admin. Mỗi gói giới hạn số bệnh nhân (`maxPatients`), số phòng MRI, tính năng AI. Hết hạn trial hiển thị thông báo nâng cấp, không khoá đột ngột (grace period 7 ngày).<br>
*Model:* `Hospital.subscriptionPlan`, `subscriptionExpiresAt` (đã có).

**U.4 — [MỚI v3.2] Trang thanh toán thành công / hủy (đã có HTML)**<br>
*Mô tả:* Sau khi PayOS redirect, backend trả trang HTML đẹp (đã implement trong `paymentSuccess/paymentCancel`). Trang tự động kích hoạt Premium nếu webhook chưa về kịp (safety mechanism). Button "Quay lại ứng dụng" dẫn về app mobile (deep link: `neuroscan://`).

---

## V. MODULE SỔ SỨC KHỎE CÁ NHÂN (NÂNG CAO) — MỚI

**V.1 — Theo dõi sinh hiệu theo thời gian**<br>
*Mô tả:* Bệnh nhân xem lịch sử sinh hiệu (mạch, huyết áp, SpO2, nhiệt độ) được đồng bộ từ phiếu chăm sóc (`CareSheet`). Hiển thị biểu đồ xu hướng theo tuần/tháng. Cảnh báo nếu chỉ số bất thường (so với ngưỡng bình thường theo tuổi/giới).<br>
*Model:* `VitalSign` (đã có), dữ liệu sync từ `CareSheet` (đã implement trong `emr.controller.js`).

**V.2 — Đơn thuốc và nhắc nhở uống thuốc**<br>
*Mô tả:* Bệnh nhân xem đơn thuốc được kê (`Prescription`), nhận nhắc nhở uống thuốc theo lịch (VD: 8h-12h-18h). Dùng `MedicineReminder` model (đã có). Gửi notification mobile và email tóm tắt hàng ngày.<br>
*Model:* `Prescription`, `MedicineReminder` (đã có).

**V.3 — Kết quả xét nghiệm cận lâm sàng**<br>
*Mô tả:* Bệnh nhân xem kết quả xét nghiệm (công thức máu, sinh hoá) từ `LabOrder`. Giải thích ngôn ngữ đời thường (VD: "Creatinine cao hơn bình thường — nói chuyện với bác sĩ về chức năng thận").<br>
*Model:* `LabOrder` (đã có).

**V.4 — Hồ sơ bệnh án tóm tắt (EMR Summary)**<br>
*Mô tả:* Bệnh nhân (Premium) xem tóm tắt bệnh án: chẩn đoán, kế hoạch điều trị, ngày nhập/xuất viện. Phiên bản đời thường, không expose toàn bộ chi tiết lâm sàng phức tạp.<br>
*Model:* `MedicalRecord` (đã có). Lọc trường hiển thị theo role `patient`.

---

## W. MODULE BÁO CÁO & THỐNG KÊ VẬN HÀNH — MỚI

**W.1 — Báo cáo doanh thu theo ngày/tuần/tháng**<br>
*Mô tả:* `hospital_admin` xem doanh thu tổng hợp từ `Invoice`: tổng thu theo loại dịch vụ (khám/MRI/AI/thuốc), phân tích theo phương thức thanh toán. Biểu đồ cột và đường xu hướng.<br>
*Model:* Aggregate trên `Invoice`. `RevenueReport` model (đã có) để lưu cache báo cáo định kỳ.

**W.2 — Báo cáo hoạt động AI**<br>
*Mô tả:* Thống kê hiệu suất AI: số ca xử lý, thời gian xử lý trung bình (target <5 phút), tỷ lệ thành công vs. lỗi, phân bố loại u phát hiện, tỷ lệ bác sĩ hiệu chỉnh kết quả AI.<br>
*Mục đích:* Đánh giá chất lượng model và phát hiện dấu hiệu degradation.

**W.3 — Báo cáo vận hành khoa**<br>
*Mô tả:* Thống kê: số ca/ngày theo phòng MRI, thời gian chờ trung bình từng bước, tỷ lệ ca cấp cứu, tỷ lệ hoàn thành đúng hạn, hiệu suất từng bác sĩ (số ca đọc/ngày).<br>
*Export:* Excel/PDF, gửi email tự động cuối tháng cho trưởng khoa.

**W.4 — Dashboard thống kê lâm sàng tổng hợp**<br>
*Mô tả:* Thống kê y khoa: tỷ lệ u ác tính vs lành tính, phân bố theo vùng não (temporal/frontal/parietal/occipital/brainstem), tỷ lệ cần phẫu thuật, kết quả theo dõi 3/6/12 tháng (nếu có tái khám). Dành cho nghiên cứu và cải tiến quy trình.<br>
*Truy cập:* `hospital_admin`, Trưởng khoa.

---

## TÓM TẮT SỐ LƯỢNG CHỨC NĂNG (CẬP NHẬT v3.2)

| Module | Số chức năng | Trạng thái |
|---|---|---|
| A. Quản lý phòng & lịch hẹn | 6 | Cần xây mới |
| B. Upload & xử lý DICOM đa chuỗi | 5 | Cần xây mới |
| C. Xử lý AI đa chuỗi | 9 | Cần xây mới |
| D. Tự động phân công bác sĩ | 4 | Cần xây mới |
| E. Cấp cứu | 5 | Cần xây mới |
| F. Chuyển viện thông minh | 5 | Có `TransferForm` model |
| G. Hiển thị & tương tác bác sĩ | 6 | Cần xây mới |
| H. Bệnh nhân | 6 | Một phần đã có |
| I. Workflow & Task | 4 | Cần xây mới |
| J. Thông báo real-time | 4 | `Notification` model có sẵn |
| K. Quản trị | 6 | `admin.controller.js` có sẵn |
| L. Google Drive | 5 | Có Drive config trong Hospital |
| M. Tài chính | 5 | `invoice.controller.js` có sẵn |
| N. Khác (tùy chọn) | 3 | — |
| **O. Sửa đổi** | **5** | **Cần patch** |
| **P. Bình duyệt lần 2 (mới)** | **3** | **Cần xây mới** |
| **Q. Quản lý giường bệnh (mới)** | **4** | **Cần xây mới** |
| **R. Tích hợp BHYT (mới)** | **3** | **Cần xây mới** |
| **S. Đồng thuận thuốc cản quang (mới)** | **2** | **ConsentForm model có sẵn** |
| **T. Khả năng chịu lỗi mất mạng (mới)** | **2** | **Cần xây mới** |
| **U. Premium & Thanh toán online** | **4** | **Đã có logic, cần đặc tả hoàn chỉnh** |
| **V. Sổ sức khoẻ nâng cao** | **4** | **Models đã có (VitalSign, Prescription...)** |
| **W. Báo cáo & Thống kê** | **4** | **RevenueReport model có sẵn** |
| **Tổng cộng** | **~114 chức năng** | |

---

## CẤU TRÚC THƯ MỤC GOOGLE DRIVE

```text
📂 NeuroScan_PACS (Shared Drive root)
│
├── 📂 _System
│   ├── 📂 Configs (cấu hình hệ thống, ngưỡng AI, v.v.)
│   ├── 📂 Models (các file model AI đã train)
│   └── 📂 Logs (log hệ thống, không thuộc bệnh viện)
│
├── 📂 Hospitals
│   └── 📂 {hospitalId} (ví dụ: BV_108)
│       ├── 📂 Backups
│       │   ├── 📂 daily
│       │   │   └── backup_YYYY-MM-DD.zip
│       │   └── 📂 weekly
│       │       └── backup_week_YYYY-WW.zip
│       │
│       ├── 📂 Audit_Logs
│       │   └── audit_YYYY-MM-DD.json
│       │
│       ├── 📂 Shared (chia sẻ tạm thời khi chuyển viện)
│       │   └── 📂 {transferId}
│       │       ├── package.zip
│       │       └── metadata.json
│       │
│       └── 📂 Patients
│           └── 📂 {patientId}
│               ├── 📂 Profile
│               │   ├── avatar.jpg
│               │   └── personal_info.json
│               │
│               └── 📂 Studies
│                   └── 📂 {studyDate}_{studyUID}
│                       ├── 📂 DICOM
│                       │   ├── 📂 Ax_T2_FLAIR_FS_3
│                       │   ├── 📂 Ax_DWI_ALL_b1000_5
│                       │   ├── 📂 ADC_(10_6_mm+__s)_550
│                       │   ├── 📂 3D_Ax_TOF_SPGR_FS_8
│                       │   ├── 📂 Sag_T1_FLAIR_6
│                       │   ├── 📂 COR_T2_7
│                       │   ├── 📂 AX_T1_FLAIR_9
│                       │   └── 📂 OTHER (series không xác định)
│                       │
│                       ├── 📂 AI_Results
│                       │   ├── 📂 T2_FLAIR
│                       │   │   ├── segmentation_mask.nii.gz
│                       │   │   ├── segmentation_mask.png
│                       │   │   ├── volume_report.json
│                       │   │   └── top_slices/ (5 ảnh JPEG annotate)
│                       │   ├── 📂 DWI_ADC
│                       │   │   ├── adc_heatmap.jpg
│                       │   │   ├── adc_values.json
│                       │   │   └── malignancy_score.json
│                       │   ├── 📂 TOF_MRA
│                       │   │   ├── vessel_segmentation.nii.gz
│                       │   │   ├── vessel_invasion.json
│                       │   │   └── mip_image.jpg
│                       │   ├── 📂 Combined
│                       │   │   ├── tumor_3d_model.gltf
│                       │   │   ├── full_report.json
│                       │   │   └── visualization.jpg
│                       │   └── 📂 Feedback
│                       │       └── feedback_{timestamp}.json
│                       │
│                       ├── 📂 Doctor_View
│                       │   ├── 📂 Annotated_Slices
│                       │   ├── 📂 Reports
│                       │   │   ├── clinical_report.docx
│                       │   │   ├── clinical_report.json
│                       │   │   └── signed_report.pdf
│                       │   └── 📂 Measurements
│                       │       ├── tumor_volume_history.json
│                       │       └── midline_shift_trend.json
│                       │
│                       └── 📂 Patient_View
│                           ├── result_image.jpg
│                           ├── patient_report.pdf
│                           ├── patient_report.html
│                           └── share_link.txt
```

### Giải thích các thành phần chính

1. **`_System`**: cấu hình toàn cục, model AI đã train, log hệ thống không gắn với bệnh viện cụ thể.
2. **`Backups`**: sao lưu toàn bộ dữ liệu bệnh viện, chia daily/weekly, tên file có timestamp để dễ khôi phục.
3. **`Audit_Logs`**: nhật ký truy cập/chỉnh sửa/xóa dữ liệu, phục vụ kiểm tra và tuân thủ.
4. **`Shared`**: lưu tạm gói dữ liệu chuyển viện trước/sau khi gửi, mỗi lần chuyển tạo 1 thư mục con theo `transferId`.
5. **`Profile`**: thông tin cá nhân không nhạy cảm của bệnh nhân, dùng cho B2C.
6. **`DICOM`**: giữ nguyên toàn bộ file `.dcm`, có thư mục `OTHER` cho series không xác định được qua B.2.
7. **`AI_Results`**: tách theo từng chuỗi xử lý (T2_FLAIR, DWI_ADC, TOF_MRA), có `Combined` cho báo cáo/3D tổng hợp và `Feedback` cho active learning.
8. **`Doctor_View`**: slice đã annotate, báo cáo lâm sàng (có thể ký số), lịch sử đo lường theo thời gian nếu có nhiều lần chụp.
9. **`Patient_View`**: chỉ 1 ảnh đại diện + báo cáo đã dịch ngôn ngữ đời thường, có bản HTML để xem trực tiếp trên web.

### Quản lý quyền truy cập

| Vai trò | Quyền truy cập |
|---|---|
| Service Account (backend) | Toàn quyền trên toàn bộ Shared Drive |
| Bác sĩ (Neuroradiologist) | Xem DICOM, AI_Results, Doctor_View — không xóa |
| Bác sĩ (Neurosurgeon) | Xem Doctor_View, Patient_View, AI_Results |
| Technician | Xem/ghi DICOM (upload), xem AI_Results |
| Lễ tân | Xem Patient_View (gửi bệnh nhân), xem Doctor_View (in báo cáo) |
| Bệnh nhân | Chỉ xem Patient_View qua link công khai có hạn |
| Admin | Toàn quyền |

> 📌 Xem mục 1.4 — khuyến nghị chuyển toàn bộ hàng trong bảng trên (trừ Service Account) từ "quyền Drive trực tiếp" sang "quyền qua backend API", để dễ audit và không phải quản lý ACL rời rạc.

### Lưu ý triển khai

- **Tạo thư mục tự động**: khi bệnh nhân mới được tạo, backend tự động tạo cây thư mục tương ứng.
- **Tên thư mục series**: dùng tên từ DICOM tag `SeriesDescription` làm chuẩn (xem mục 1.3).
- **Nén backup**: dùng `adm-zip` hoặc `archiver` để nén thư mục bệnh viện hàng ngày.
- **Mã hóa**: AES-256 cho file nhạy cảm (gói chuyển viện, thông tin BHYT) trước khi upload.
- **Rate limit Drive API**: nén thành 1 file `.zip` mỗi series trước khi upload, không upload từng file `.dcm` rời (xem mục 1.4).

---

## PHỤ LỤC — SƠ ĐỒ LUỒNG XỬ LÝ CHÍNH

### Sơ đồ 1: Luồng xử lý MRI từ upload đến kết quả

```
KTV upload DICOM
      │
      ▼
B.1 Upload + B.5 Validate
      │ OK
      ▼
B.2 Phân loại series (DICOM metadata)
B.3 Upload lên Drive
B.4 Tạo ImagingResult → Visit.status = "chờ kết quả AI"
      │
      ▼
BullMQ: Tạo AI Job (priority theo Visit.priority)
      │
      ├─── Ca cấp cứu ──► E.5 Đẩy lên đầu hàng
      │
      ▼
C.8 Progress Tracking (0% → 100%)
      │
      ├── C.1 T2 FLAIR: Segmentation + Volume + Midline
      ├── C.6 Chọn 5 slice nguy hiểm nhất
      ├── C.7 Chọn 1 ảnh đại diện
      ├── C.2 DWI/ADC: Malignancy score
      ├── C.3 TOF MRA: Vessel invasion
      └── C.4 Merge → full_report.json
           C.5 Dựng 3D model GLTF
      │
      ▼
E.1 Kiểm tra ngưỡng cấp cứu (midline>5mm || volume>50cm³)
      │                    │
      │ Bình thường         │ Cấp cứu
      ▼                    ▼
D.1 Phân công           E.3 Alert toàn hệ thống
Neuroradiologist         E.4 Emergency Dashboard
      │
      ▼
Visit.status = "chờ bác sĩ đọc"
Gửi notification bác sĩ (WebSocket + Email + FCM)
      │
      ▼
Bác sĩ mở G.1 Viewer + G.3 Báo cáo AI
Tùy chọn: G.2 Overlay, G.4 3D Model
      │
      ├── Hiệu chỉnh AI? → G.5 Active Learning → K.5
      │
      ▼
Bác sĩ ký duyệt → Visit.status = "hoàn tất"
Gửi notification bệnh nhân (H.6)
      │
      ▼
Lễ tân M.1/M.3/M.4 Thanh toán
Visit.status = "đã đóng"
```

### Sơ đồ 2: Luồng cấp cứu

```
AI phát hiện ngưỡng cấp cứu / Bác sĩ nhấn nút cấp cứu
      │
      ▼
E.1/E.2 Cập nhật Visit.priority = 1 (EMERGENCY)
E.3 WebSocket Alert → Tất cả bác sĩ trực
      │
      ▼
E.5 AI Job → Đẩy lên đầu hàng BullMQ
E.4 Emergency Dashboard hiển thị countdown
      │
      ▼
A.4 Tìm phòng MRI trống (nếu chưa chụp)
      │ Nếu không có phòng trống
      ▼
Tìm slot bệnh nhân thường → Soạn thông báo dời lịch
→ Lễ tân xác nhận → Gửi SMS/email cho bệnh nhân bị dời
      │
      ▼
F.1 Kiểm tra khả năng phẫu thuật
      │ Nếu vượt khả năng
      ▼
F.2/F.3 Chuyển viện + Q.2 Giữ chỗ giường viện đích
```

### Sơ đồ 3: Luồng thanh toán

```
Bác sĩ ký duyệt → Visit.status = "hoàn tất"
      │
      ▼
M.1 Tạo hóa đơn tự động (exam + MRI + AI + thuốc)
      │
      ├── Có BHYT? → R.2 Tính đồng chi trả
      │
      ├── Tiền mặt / Chuyển khoản → M.3 Lễ tân xác nhận
      │                              Invoice.status = "đã thanh toán"
      │
      └── VietQR PayOS → M.4 Tạo link PayOS
                          Bệnh nhân quét QR
                          PayOS Webhook → Invoice.status = "đã thanh toán"
                              │
                              ▼
                          Visit.status = "đã đóng"
                          EMRVersion (audit trail)
```

---

## MAPPING CHỨC NĂNG ↔ FILE CODE THỰC TẾ

| Module/Chức năng | File controller | File model | Trạng thái |
|---|---|---|---|
| Auth & RBAC | `auth.controller.js` | `user.model.js` | ✅ Có |
| Quản trị (K) | `admin.controller.js` | `hospital.model.js` | ✅ Có |
| Visit & Workflow (I) | `visit.controller.js` | `visit.model.js` | ✅ Có |
| Upload ảnh (B - đơn giản) | `imaging.controller.js` | `imagingResult.model.js` | ✅ Có |
| EMR / Bệnh án (O) | `emr.controller.js` | `medicalRecord.model.js`, `careSheet.model.js`, `consultation.model.js`, `consentForm.model.js`, `emrVersion.model.js` | ✅ Có |
| Hóa đơn & PayOS (M, U) | `invoice.controller.js` | `invoice.model.js`, `premiumOrder.model.js` | ✅ Có |
| Thuốc (dược) | `drug.controller.js` | `drug.model.js`, `prescription.model.js` | ✅ Có |
| Lịch làm việc (A - sơ bộ) | `schedule.controller.js` | `workSchedule.model.js` | ⚠️ Cần mở rộng |
| Thông báo (J) | `notification.controller.js` | `notification.model.js` | ✅ Có |
| Chuyển viện (F) | Trong `admin.controller.js` | `transferForm.model.js` | ⚠️ Cần tách controller riêng |
| Bệnh nhân profile (H, V) | `patient.controller.js`, `patientRecord.controller.js` | `patientProfile.model.js`, `vitalSign.model.js` | ✅ Có |
| Xét nghiệm (V.3) | `lis.controller.js` | `labOrder.model.js` | ✅ Có |
| Support ticket (N) | `support.controller.js` | `supportTicket.model.js` | ✅ Có |
| **Upload DICOM đa chuỗi (B)** | ❌ Chưa có | ❌ Cần tạo `Study`, `Series` | 🔴 Cần xây |
| **AI Pipeline (C)** | ❌ Chưa có (Python service riêng) | ❌ Mở rộng `imagingResult` | 🔴 Cần xây |
| **Phân công thông minh (D)** | ❌ Chưa có | ❌ Cần `Assignment` model | 🔴 Cần xây |
| **Emergency Protocol (E)** | ❌ Chưa có | ❌ Cần `EmergencyAlert` model | 🔴 Cần xây |
| **Phòng MRI (A)** | ❌ Chưa có | ❌ Cần `MriRoom`, `MriSlot` | 🔴 Cần xây |
| **Peer Review (P)** | ❌ Chưa có | ❌ Cần `PeerReview` model | 🔴 Cần xây |
| **Giường bệnh (Q)** | ❌ Chưa có | ❌ Cần `HospitalBed` model | 🔴 Cần xây |
| **Báo cáo vận hành (W)** | Một phần trong `admin.controller.js` | `revenueReport.model.js`, `drugReport.model.js` | ⚠️ Cần mở rộng |

---

## LỘ TRÌNH ƯU TIÊN — ĐÃ ĐIỀU CHỈNH (v3.2)

| Giai đoạn | Nội dung | Vì sao xếp ở đây |
|---|---|---|
| **1 — Nền tảng lõi** | B (upload DICOM đa chuỗi + validate), C.1/C.4/C.5/C.6/C.7 (AI lõi — bỏ C.2/C.3), C.8/C.9 (progress + retry), D (phân công), G.1/G.3 (viewer + báo cáo) | Vòng đời tối thiểu để hệ thống "chạy được" từ upload đến bác sĩ xem kết quả |
| **2 — Vận hành & an toàn** | A (lịch phòng MRI + A.6 nhắc lịch), E (cấp cứu + countdown), I (workflow/task + I.4 dashboard), J (thông báo đầy đủ + FCM), S (đồng thuận cản quang), P (bình duyệt) | Tính năng an toàn người bệnh (S, P, E) nên đi sớm; A cần thiết để lên lịch chụp |
| **3 — Trải nghiệm & mở rộng** | C.2/C.3 (AI nâng cao), G.2/G.4/G.5/G.6 (overlay, 3D, active learning, follow-up), H đầy đủ (bệnh nhân + H.5/H.6), F (chuyển viện + F.5 cross-hospital), Q (giường bệnh), K.6 (subscription), L (Drive đầy đủ), M.4/M.5 (PayOS + hoàn tiền), T (chịu lỗi mạng), U (Premium), V (Sổ sức khoẻ), W (Báo cáo) | Nâng cao trải nghiệm và mở rộng nghiệp vụ sau khi lõi ổn định |
| **4 — Mở rộng dài hạn** | R (BHYT), N.2 (HL7/FHIR), N.1 (chat hội chẩn nâng cao), K.5 (active learning retrain) | Độ phức tạp pháp lý/tích hợp cao, không cấp thiết cho giai đoạn đồ án |

---

## CÁC MODEL CẦN TẠO MỚI (DANH SÁCH ĐỦ)

| Model | Dùng cho | Trường quan trọng |
|---|---|---|
| `MriRoom` | A.1 | `hospitalId`, `name`, `model`, `status`, `maxSlotsPerDay`, `slotDuration` |
| `MriSlot` | A.2, A.3 | `roomId`, `patientId`, `visitId`, `startTime`, `endTime`, `status`, `priority` |
| `DicomStudy` | B.4 | `hospitalId`, `patientId`, `visitId`, `studyDate`, `studyUID`, `series[]`, `driveStudyFolderId` |
| `DicomSeries` | B.2 | `studyId`, `seriesType` (T2_FLAIR/DWI/ADC/TOF/OTHER), `driveSeriesFolderId`, `sliceCount`, `dicomMetadata` |
| `AiJob` | C.8, C.9 | `visitId`, `imagingResultId`, `status`, `progress`, `currentStep`, `retryCount`, `startedAt`, `completedAt`, `errorLog` |
| `Assignment` | D.1, D.2 | `visitId`, `doctorId`, `type` (read/treat), `assignedAt`, `acknowledgedAt`, `currentCaseload` |
| `EmergencyAlert` | E.1, E.3 | `visitId`, `level` (RED/ORANGE), `triggeredBy`, `triggeredAt`, `acknowledgedBy[]`, `resolvedAt` |
| `PeerReview` | P.1, P.2, P.3 | `imagingResultId`, `reviewerIds[]`, `readings[]`, `conflictReason`, `finalConclusion`, `finalBy` |
| `HospitalBed` | Q.1, Q.2 | `hospitalId`, `departmentId`, `bedNumber`, `roomNumber`, `floor`, `type`, `status`, `reservedUntil`, `patientId` |

---

## KẾT LUẬN (v3.2)

Bản v3.2 bổ sung 3 module mới (U — Premium, V — Sổ sức khoẻ nâng cao, W — Báo cáo vận hành) và hoàn thiện đặc tả cho tất cả module cũ dựa trên đối chiếu code thực tế. Tổng số chức năng từ ~70 (v3.1) lên ~114 (v3.2), nhưng khoảng 40 chức năng mới là **mở rộng logic** trên model đã có — chi phí xây thực tế không tăng gấp đôi.

**Ba điều chỉnh quan trọng nhất từ v3.1 vẫn giữ nguyên:**
1. Giảm phạm vi AI đa chuỗi về mức khả thi theo giai đoạn (C.2/C.3 vào giai đoạn 3)
2. Đưa viewer (G.1, G.3) lên cùng đợt với AI
3. Dùng DICOM metadata thay vì tên thư mục để phân loại series

**Thêm từ v3.2:**
4. Đặc tả chính thức Module U (Premium đã có trong code)
5. Mapping rõ ràng chức năng ↔ file code → dễ phân công task cho team
6. Danh sách đầy đủ model cần tạo mới → không bỏ sót khi thiết kế DB
7. Sơ đồ luồng xử lý trực quan → dễ trace khi debug

File này có thể dùng trực tiếp làm tài liệu yêu cầu cho các Sprint tiếp theo và làm cơ sở viết API contract giữa FE và BE.
