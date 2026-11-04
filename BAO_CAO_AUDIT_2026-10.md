# BÁO CÁO AUDIT KỸ THUẬT & NGHIỆP VỤ — NEUROSCAN AI

**Ngày audit:** 25/10/2026 · **Nhánh:** `Huyle_MRI/CT` · **Phạm vi:** toàn bộ `BE/` (326 file JS) + `FE/src/` (63 màn hình) + `MRIteam_team5/MRIteam` + `docker-compose.yml`

## 0. TL;DR

| Hạng mục | Điểm | Nhận xét ngắn |
| :--- | :---: | :--- |
| Bảo mật / phân quyền | **4.5/10** | Nhiều route nhạy cảm chỉ có `protect`, thiếu `checkRole`; có 5 lỗi có thể khai thác trực tiếp |
| An toàn người bệnh | **5/10** | Chống chỉ định MRI tuyệt đối bị bypass được bằng 1 field trong body |
| Tính toàn vẹn hồ sơ | **5.5/10** | Có khóa EMR + audit hash-chain tốt, nhưng báo cáo CĐHA không khóa sau khi ký |
| Nghiệp vụ vs thực tế BV | **6.5/10** | Luồng 8 bước khá sát; thiếu lịch hẹn, kiểm soát BHYT thực, xét nghiệm, hậu phẫu, DSAR |
| Phân quyền theo vai trò | **5/10** | 8 role phẳng, thiếu bác sĩ CĐHA / thu ngân / kế toán / KTV xét nghiệm / điều dưỡng trưởng; SoD bị phá |
| Kiểm thử | **6/10** | 256 test BE + 64 test FE đều pass, nhưng **không có test nào bắt được các lỗi P0 dưới đây** |

**Kết luận:** Hệ thống đã đi rất xa so với đồ án mẫu (kiến trúc module, tenancy plugin, audit hash-chain, FEFO, PayOS webhook verify, PAdES PDF). Tuy nhiên còn **6 lỗi P0 nên sửa trước khi demo/bảo vệ**, trong đó nặng nhất là **bypass chống chỉ định MRI** và **bất kỳ nhân viên nào cũng sửa/ký được báo cáo CĐHA**.

---

## 1. Phương pháp & bằng chứng

- Đọc trực tiếp: `BE/src/routes/*`, `BE/src/modules/*/*.routes.js` (31 file route), controller/service/model liên quan, `index.js`, 10 middleware.
- Đối chiếu chéo route → controller → model → FE screen.
- Chạy thử:
  - `cd BE && npm test` → **256/256 PASS, 53/53 suite** (49.6s).
  - `cd FE && npm test` → **64/64 PASS** (3 file test).
- Test hiện tại là unit/integration in-memory, **không** kiểm tra các nhánh phân quyền còn thiếu và **không** test đồng thời (race).
- Các kết luận dưới đây ghi rõ `file#Lx` để đối chiếu; không có thay đổi mã nguồn nào được thực hiện.

> Quy ước mức độ: **P0** = phải sửa trước khi demo (an toàn BN / pháp lý / khai thác được) · **P1** = sửa trong sprint tới · **P2** = nợ kỹ thuật/nghiệp vụ · **P3** = vận hành/UX.

---

## 2. LỖI P0 — PHẢI SỬA TRƯỚC KHI DEMO

### P0-1. Bypass chống chỉ định tuyệt đối của MRI bằng `passed: true`

- **Vị trí:** [visit.service.js:335](BE/src/services/visit.service.js#L335), [visit.service.js:352](BE/src/services/visit.service.js#L352), [DoctorWorkQueueScreen.js:330](FE/src/screens/DoctorWorkQueueScreen.js#L330)
- **Hiện trạng:**
  ```js
  const isSafe = passed !== undefined ? Boolean(passed) : (!hasPacemakerOrMetal);
  if (hasPacemakerOrMetal && !isSafe) { /* chặn 400 */ }
  ```
  Client chỉ cần gửi `{ hasPacemakerOrMetal: true, passed: true }` là `isSafe = true` → **không chặn**, ca chuyển thẳng `đang chụp`. FE hiện luôn gửi `passed: true` (dòng 330) và chỉ chặn ở phía trình duyệt.
- **Tác động:** bệnh nhân mang máy tạo nhịp/ dị vật kim loại vẫn được đưa vào buồng từ trường → nguy cơ tử vong; trái với README mục 6.1 (“Chặn tuyệt đối HTTP 400”). Đây là lỗi an toàn người bệnh + pháp lý nặng nhất của dự án.
- **Cách sửa:** bỏ hoàn toàn việc tin `passed` từ client. Server tự tính:
  ```js
  const isSafe = !hasPacemakerOrMetal && !isPregnant && !hasKidneyDisease /* + rule cản quang */;
  ```
  Chỉ cho phép override khi có bác sĩ CĐHA/trưởng khoa + lý do, lưu audit. Thêm test: gửi `passed:true + pacemaker:true` phải trả 400.

### P0-2. Bất kỳ nhân viên nào cũng sửa/ký được báo cáo CĐHA; báo cáo đã ký vẫn ghi đè được

- **Vị trí:** [imaging.routes.js:56](BE/src/modules/imaging/imaging.routes.js#L56) (chỉ `protect`), [imaging.controller.js:995](BE/src/modules/imaging/imaging.controller.js#L995), [imaging.controller.js:1013](BE/src/modules/imaging/imaging.controller.js#L1013), [imaging.controller.js:1022](BE/src/modules/imaging/imaging.controller.js#L1022), [imaging.controller.js:1029](BE/src/modules/imaging/imaging.controller.js#L1029)
- **Hiện trạng:**
  - Route `PUT /api/v1/imaging/:id` không có `checkRole` → **nurse, receptionist, pharmacist, technician, hospital_admin** đều gọi được.
  - Controller luôn đặt `result.isSigned = true`, `signedBy = req.user.id` mà **không kiểm tra đã ký trước đó** → sửa/“ký lại” báo cáo đã ký.
  - `radiologist` lấy từ `req.body` → gõ tên bất kỳ, không đối chiếu tài khoản.
  - `certificateSerial`, `caProvider`, `signatureType`, `timestampToken` lấy từ body → **giả mạo nhà cung cấp CA**.
  - “Chữ ký số” chỉ là SHA-256 nội bộ, không phải chữ ký PKI/PAdES.
- **Tác động:** sửa kết luận u não sau khi đã ký, đổ tên bác sĩ khác, vô hiệu hóa giá trị pháp lý của bệnh án điện tử (TT 46/2018, Luật GDĐT 20/2023).
- **Cách sửa:** `checkRole(["doctor"])`; bắt buộc `specialty` thuộc CĐHA (xem mục 5); chặn nếu `isSigned` (dùng `findOneAndUpdate({_id, isSigned:false})`); lấy tên từ `req.user.profile`, không nhận từ body; chỉ nhận metadata chữ ký từ service ký thật (PKCS#12/HSM) và verify chữ ký; lưu version + addendum thay vì ghi đè. Route `POST /clinical-view/imaging/:id/sign` đã làm đúng phần chặn ký lại — cần hợp nhất 2 luồng.

### P0-3. Bệnh nhân tự tạo kết quả CĐHA cho chính mình

- **Vị trí:** [imaging.controller.js:88-92](BE/src/modules/imaging/imaging.controller.js#L88-L92), route [imaging.routes.js:59](BE/src/modules/imaging/imaging.routes.js#L59)
- **Hiện trạng:** nhánh role `patient` được phép `POST /api/v1/imaging` nếu `medicalId` trùng hồ sơ của mình; toàn bộ `findings`, `conclusion`, `radiologist`, `reportDate`, `images` do client gửi.
- **Tác động:** bệnh nhân chèn “kết quả MRI” giả vào hồ sơ, có thể lừa bác sĩ ở lần khám sau, tạo hồ sơ pháp lý sai. Đây là **giả mạo tài liệu y khoa**.
- **Cách sửa:** chỉ `technician`/`doctor` được tạo; `hospitalId` + `visitId` phải thuộc bệnh viện và ca đang chờ chụp; bệnh nhân chỉ được upload tài liệu cá nhân qua module `scanned-documents` riêng.

### P0-4. Upload 600MB không giới hạn vai trò, không quota, file lưu plaintext và public

- **Vị trí:** [imaging.routes.js:32](BE/src/modules/imaging/imaging.routes.js#L32) (chỉ `protect`), [imagingUpload.middleware.js:102](BE/src/middlewares/imagingUpload.middleware.js#L102) (600MB), [index.js:44-48](BE/src/index.js#L44-L48) (JSON 700MB), [index.js:89](BE/src/index.js#L89) (`/uploads` static công khai)
- **Hiện trạng:** bất kỳ tài khoản nào — kể cả bệnh nhân tự đăng ký công khai qua `/auth/register` — có thể upload liên tục file 600MB. File ghi vào `BE/uploads` và trả URL `/uploads/...` **không cần xác thực**; bản sao không mã hóa dù `STORAGE_MODE` có encryption cho bản Hybrid PACS.
- **Tác động:** đầy đĩa/DoS, tốn băng thông, lộ ảnh y tế nếu đoán/ lộ URL; vi phạm yêu cầu mã hóa dữ liệu y tế.
- **Cách sửa:** `checkRole(["technician","doctor"])`; quota theo user/bệnh viện; giới hạn 1 file/lần, tổng dung lượng; lưu qua `storageService` (mã hóa) thay vì `/uploads`; phục vụ file qua route có auth + kiểm tra tenant; bỏ static public.

### P0-5. SSRF + path traversal qua `imageUrl` ở các API AI

- **Vị trí:** [imaging.controller.js:401-407](BE/src/modules/imaging/imaging.controller.js#L401-L407), [imaging.controller.js:599-603](BE/src/modules/imaging/imaging.controller.js#L599-L603), [aiPipeline.controller.js:247-255](BE/src/modules/imaging/aiPipeline.controller.js#L247-L255)
- **Hiện trạng:** `imageUrl` do client gửi; nếu bắt đầu bằng `http` server gọi `fetch` tùy ý (SSRF vào `localhost`, `169.254.169.254`, mạng nội bộ). Nếu bắt đầu `/uploads/`, `path.join(__dirname,"../../..", imageUrl)` cho phép `"/uploads/../../../etc/passwd"` → đọc file ngoài thư mục (đã kiểm chứng bằng `path.join`).
- **Tác động:** dò mạng nội bộ, đọc file hệ thống, gửi nội dung file sang AI service; kết hợp P0-4 thành kênh exfil.
- **Cách sửa:** allowlist domain (`storage.googleapis.com`, host nội bộ AI); resolve path và kiểm tra `abs.startsWith(uploadsDir)` như [reportPdf.service.js:62](BE/src/services/reportPdf.service.js#L62); chặn IP private/link-local; không nhận URL tùy ý từ client (nhận `fileId`).

### P0-6. AI microservice mở cổng 8000 không xác thực

- **Vị trí:** [docker-compose.yml:58-60](docker-compose.yml#L58-L60), [main.py](MRIteam_team5/MRIteam/main.py) (`/retrain/start`, `/retrain/deploy`, `/chat`, `/generate_clinical_report` không auth)
- **Hiện trạng:** `ports: "8000:8000"` publish ra mọi interface; toàn bộ endpoint AI không có API key/JWT. Backend cũng publish `5000:5000` bỏ qua Nginx.
- **Tác động:** người ngoài gọi được retrain/rollback model, đọc/ sinh báo cáo lâm sàng, spam Gemini (tốn phí), tấn công model.
- **Cách sửa:** không publish 8000/5000 ra host (chỉ `expose` trong network); thêm `X-Internal-Api-Key`/mTLS giữa BE↔AI; chỉ Nginx publish 80/443.

---

## 3. LỖI P1 — SỬA TRONG SPRINT TỚI

### P1-1. Không chặn chụp MRI khi chưa thanh toán; hủy ca không điều chỉnh hóa đơn

- **Vị trí:** [visit.service.js:301-373](BE/src/services/visit.service.js#L301-L373), [visit.service.js:456](BE/src/services/visit.service.js#L456), [visit.controller.js:615-650](BE/src/controllers/visit.controller.js#L615-L650)
- **Hiện trạng:** `submitMriSafetyCheckService` chỉ kiểm tra chống chỉ định, **không kiểm tra trạng thái hóa đơn** dù Phụ lục C ghi `ERR_INVOICE_NOT_PAID` và README nói KTV thấy badge “Chưa đóng phí”. `cancelMriOrderService` đặt `status = 'đã hủy'` cho **toàn bộ lượt khám** nhưng không xóa/ giảm dòng “Chụp MRI” trong hóa đơn nháp → bệnh nhân bị tính tiền ca đã hủy; nếu đã thanh toán thì không có luồng hoàn.
- **Cách sửa:** thêm cổng “đã thanh toán/ BHYT/ cấp cứu” trước khi chuyển `đang chụp`; khi hủy chỉ chuyển trạng thái đơn MRI + điều chỉnh invoice (xóa item MRI, tạo credit note/refund); nhả slot phòng máy.

### P1-2. Race cấp số thứ tự tiếp đón

- **Vị trí:** [visit.controller.js:143-145](BE/src/controllers/visit.controller.js#L143-L145)
- **Hiện trạng:** `lastTicket.queueNumber + 1` là read-then-write, không atomic. Hai lễ tân bấm cùng lúc → **trùng số**. Model `queueCounter` có sẵn nhưng không dùng ở đây (chỉ dùng cho queue-ticket online).
- **Cách sửa:** dùng `QueueCounter.findOneAndUpdate({hospitalId, date}, {$inc:{seq:1}}, {upsert:true,new:true})` hoặc unique index `{hospitalId, date, queueNumber}` + retry.

### P1-3. `mri-order` không kiểm tra trạng thái lượt khám

- **Vị trí:** [visit.controller.js:592-615](BE/src/controllers/visit.controller.js#L592-L615)
- **Hiện trạng:** bác sĩ có thể ra y lệnh MRI cho ca `đã đóng`/`đã hủy`; hàm đặt `status = 'chờ chụp'` bất kể FSM, và chỉ tạo hóa đơn nếu `!visit.invoiceId` → nếu đã có hóa đơn đã thanh toán thì phí MRI mới **không được tính**.
- **Cách sửa:** chỉ cho phép từ `đang khám`/`tái khám định kỳ`; dùng `ALLOWED_TRANSITIONS`; nếu đã có invoice thì thêm item + reconcile BHYT, không tạo mới.

### P1-4. `updateStatus` cho phép lễ tân/KTV đóng ca khám

- **Vị trí:** route [visit.routes.js:34](BE/src/routes/visit.routes.js#L34), FSM [visit.controller.js:640-660](BE/src/controllers/visit.controller.js#L640-L660)
- **Hiện trạng:** 6 role cùng gọi một endpoint; không có kiểm tra “ai được chuyển trạng thái nào”. Lễ tân có thể `đang khám → hoàn tất` (bỏ qua bác sĩ đọc/ ký), KTV có thể `hoàn tất` ca chưa đọc kết quả.
- **Cách sửa:** bảng `TRANSITION_ROLES` (ví dụ `đang chụp` chỉ technician, `chờ bác sĩ đọc → hoàn tất` chỉ doctor, `đã đóng` chỉ receptionist sau khi đã thanh toán).

### P1-5. Mass-assignment khi cập nhật EMR

- **Vị trí:** [emr.controller.js:292](BE/src/modules/emr/emr.controller.js#L292), [emr.controller.js:345-350](BE/src/modules/emr/emr.controller.js#L345-L350)
- **Hiện trạng:** `const updates = req.body` rồi `findOneAndUpdate(lockFilter, updates)` → client có thể đổi `patientId`, `hospitalId`, `signStatus: "Đã ký số"`, `currentVersion`, `retentionExpiresAt`, `doctorInCharge`… Khóa bất biến chỉ chặn khi bản ghi **đã** ký, không chặn việc tự đánh dấu đã ký.
- **Cách sửa:** whitelist field (`diagnosis`, `treatmentPlan`, `status`…); `signStatus` chỉ qua endpoint ký; chặn `patientId`/`hospitalId` sau khi tạo.

### P1-6. `createAndPayInvoice` bỏ qua BHYT và để lại `bhytInfo` cũ

- **Vị trí:** [invoice.controller.js:142-150](BE/src/modules/billing/invoice.controller.js#L142-L150), [invoice.controller.js:178-186](BE/src/modules/billing/invoice.controller.js#L178-L186)
- **Hiện trạng:** hàm tự dựng lại `items`/`totalAmount` từ bảng giá gốc, **không gọi** `autoApplyBhytIfEligible`; nếu hóa đơn nháp đã được áp BHYT thì `bhytInfo`/`patientPayAmount` vẫn còn nhưng `totalAmount` đã đổi → bệnh nhân bị thu đủ 100% trong khi hồ sơ ghi có BHYT. Ngược lại `payInvoice` (thu tiền) xử lý BHYT rất kỹ → **hai luồng thu tiền cho kết quả khác nhau**.
- **Cách sửa:** dùng chung một service `buildInvoiceForVisit()` + `autoApplyBhytIfEligible()` cho cả 3 luồng (`createAndPayInvoice`, `createPendingInvoice`, `payInvoice`).

### P1-7. Hoàn tất ca khám có thể gán đơn thuốc của ca khác

- **Vị trí:** [visit.controller.js:779-783](BE/src/controllers/visit.controller.js#L779-L783)
- **Hiện trạng:** `Prescription.findOne({ patient_id, createdAt: { $gte: visit.createdAt }, isBilled: { $ne: true } })` không lọc `visitId` → đơn của lần khám trước/ lần khám khác bị tính vào ca này và bị đánh `isBilled = true`. (Hàm `createAndPayInvoice` đã fix đúng bằng `$or: [{visitId}, {visitId: null,...}]` — nhưng `updateStatus` thì chưa.)
- **Cách sửa:** scope theo `visitId`; chỉ fallback đơn cũ khi `visitId == null` và `createdAt` trong khoảng của ca.

### P1-8. IDOR tệp y tế trong `/api/v1/storage/files/:fileId`

- **Vị trí:** [storage.controller.js:14-20](BE/src/modules/storage/storage.controller.js#L14-L20), [storage.routes.js:9](BE/src/modules/storage/storage.routes.js#L9)
- **Hiện trạng:** chỉ kiểm tra nếu `file.patientId` tồn tại; **không kiểm tra `hospitalId`**, không kiểm tra role. Nhân viên viện A đọc được file của viện B nếu biết `fileId`; bệnh nhân đọc được mọi file có `patientId = null` (báo cáo PDF, metadata).
- **Cách sửa:** kiểm tra `file.hospitalId === req.user.hospitalId`; bệnh nhân chỉ đọc file có `patientId` của mình; không trả file khi thiếu chủ sở hữu (fail-closed).

### P1-9. Dữ liệu định danh nhạy cảm lưu plaintext

- **Vị trí:** [bhytInfo.model.js:15](BE/src/modules/billing/models/bhytInfo.model.js#L15) (`cardNumber` plaintext), [emr.controller.js:920](BE/src/modules/emr/emr.controller.js#L920) (`signerNationalId`), `privacy-consents`
- **Hiện trạng:** module BHYT ghi rõ “mã hóa trong thực tế (MVP)” nhưng lưu thô; consent lưu số CCCD người ký dạng thô — **mâu thuẫn trực tiếp** với tuyên bố “tuyệt đối không lưu CCCD” trong README và với Luật 91/2025/NĐ 13/2023. Trong khi đó `patientIdentity.service` đã có `encryptField` — hạ tầng có sẵn nhưng không dùng.
- **Cách sửa:** dùng `FIELD_ENCRYPTION_KEY` + `encryptField` cho `cardNumber`/`signerNationalId`; migration dữ liệu cũ; chỉ trả về `****last4`; thêm test không có plaintext trong DB.

### P1-10. Chính sách mật khẩu & refresh token yếu

- **Vị trí:** [auth.controller.js:35-130](BE/src/modules/auth/auth.controller.js#L35-L130) (register), [auth.controller.js:952-1050](BE/src/modules/auth/auth.controller.js#L952-L1050) (changePassword), [auth.service.js:23-31](BE/src/modules/auth/auth.service.js#L23-L31)
- **Hiện trạng:** **không có** kiểm tra độ mạnh mật khẩu (chỉ cần khác rỗng); refresh token 7 ngày, **không xoay vòng**, không phát hiện reuse, không có danh sách phiên/ thiết bị để thu hồi riêng; access token 1h.
- **Cách sửa:** tối thiểu 12 ký tự + blacklist mật khẩu phổ biến; refresh rotation + `jti` + reuse detection (thu hồi toàn bộ khi phát hiện); màn hình “phiên đang đăng nhập”.

### P1-11. Rate limit bị bypass bằng `X-Forwarded-For` và mặc định tắt ngoài production

- **Vị trí:** [rateLimiter.middleware.js:69](BE/src/middlewares/rateLimiter.middleware.js#L69), [rateLimiter.middleware.js:76-78](BE/src/middlewares/rateLimiter.middleware.js#L76-L78)
- **Hiện trạng:** khoá đếm lấy `x-forwarded-for` do **client tự gửi** (chỉ cần đổi header mỗi request là không bao giờ bị chặn); limiter chỉ hoạt động khi `NODE_ENV=production` hoặc `ENABLE_RATE_LIMIT=true`; lưu in-memory theo từng instance → scale nhiều container là vô hiệu.
- **Cách sửa:** chỉ tin `req.ip` khi `app.set('trust proxy', 1)` và Nginx ghi đè `X-Real-IP`; dùng Redis store; bật mặc định ở mọi môi trường.

### P1-12. Tạo/ thu hồi cam kết dữ liệu cá nhân thay bệnh nhân

- **Vị trí:** route [emr.routes.js:78-82](BE/src/modules/emr/emr.routes.js#L78-L82) (không `checkRole`), [emr.controller.js:897-924](BE/src/modules/emr/emr.controller.js#L897-L924)
- **Hiện trạng:** bất kỳ user đăng nhập nào cũng gọi `POST /api/v1/emr/privacy-consents` với `patientId` tùy ý → tạo consent “granted” nhân danh người khác; `revoke` cũng không kiểm tra tenant ngoài bệnh nhân.
- **Cách sửa:** chỉ `patient` tạo cho chính mình; nhân viên chỉ được tạo bản giấy (scan) có đính kèm; audit + OTP xác nhận.

### P1-13. `hospital_admin`/`admin` đọc toàn bộ bệnh án; break-glass mở cho cả quản trị

- **Vị trí:** [emr.controller.js:172-197](BE/src/modules/emr/emr.controller.js#L172-L197), [emr.routes.js:30-60](BE/src/modules/emr/emr.routes.js#L30-L60)
- **Hiện trạng:** `canAccessMedicalRecord` trả `true` cho mọi nhân viên cùng bệnh viện (không theo khoa/ bác sĩ điều trị); `admin` trả `true` tuyệt đối; break-glass cho cả `hospital_admin` (không có chứng chỉ hành nghề); không có hậu kiểm 72h dù audit ghi `requiresPostHocReview`.
- **Cách sửa:** scope theo `doctorId`/`departmentId`/`nurseId` của ca; admin chỉ xem metadata/thống kê; break-glass chỉ `doctor` + hậu kiểm thật (task cho trưởng khoa).

---

## 4. LỖI P2 / P3

### 4.1 P2 — Nợ kỹ thuật & nghiệp vụ

| # | Vị trí | Vấn đề | Đề xuất |
| :-- | :--- | :--- | :--- |
| P2-1 | [patientB2c.controller.js:241-265](BE/src/modules/patient-portal/patientB2c.controller.js#L241-L265) | Đặt tái khám tạo `Visit` `status:'đang chờ'` ngay, không `nurseId`/`queueNumber`, không kiểm tra `doctorId`/`hospitalId`; không chống trùng và **bỏ qua** quy tắc “1 lượt mở” của `createVisit` → bệnh nhân đặt lịch tháng sau làm bẩn hàng đợi hôm nay, khi đến khám bị 409 `PATIENT_ALREADY_IN_QUEUE` | Thêm trạng thái `đã đặt lịch` (không vào hàng đợi) + chuyển sang `đang chờ` khi đến; validate bác sĩ/viện; unique index chống trùng |
| P2-2 | [scheduler.js:11-20](BE/src/jobs/scheduler.js#L11-L20) | Job nhắc MRI 24h lọc `visit.date`, nhưng `createVisit` **không bao giờ set `date`** → chỉ chạy cho visit tự đặt qua B2C; lễ tân đặt ca MRI không bao giờ được nhắc | Set `date` khi tạo/ dời lịch; bổ sung nhắc trước 24h/2h; test job |
| P2-3 | [DoctorWorkQueueScreen.js:303](FE/src/screens/DoctorWorkQueueScreen.js#L303) | Mở lại bảng kiểm luôn `setHasKidneyDisease(false)` (bỏ qua `pre.hasKidneyDisease`) → **mất tiền sử suy thận**, đặc biệt nguy hiểm với thuốc cản quang | Giữ nguyên giá trị đã lưu; highlight thay đổi |
| P2-4 | [admin.controller.js:247](BE/src/modules/hospital/admin.controller.js#L247) | `deleteUser` xóa cứng, để lại Visit/Invoice/Prescription/ImagingResult mồ côi → sai báo cáo, mất dấu vết pháp lý | Soft-delete + ẩn danh hóa theo Luật 91/2025; chặn xóa nếu còn hồ sơ đang hoạt động |
| P2-5 | [user.model.js:26](BE/src/modules/auth/models/user.model.js#L26) vs [hospitalBed.routes.js:28](BE/src/modules/hospital/hospitalBed.routes.js#L28), [admin.routes.js:71](BE/src/modules/hospital/admin.routes.js#L71) | Enum role thiếu `system_admin` và `cleaner` → 2 role này **không thể tồn tại** nhưng vẫn nằm trong `checkRole`/`requireSystemAdmin` (quyền chết); `admin` vừa là SaaS admin vừa có thể gắn `hospitalId` → nhập nhằng siêu quyền | Tách `system_admin` (không hospitalId) khỏi `admin`; thêm `cleaner` nếu dùng; migration + seed |
| P2-6 | [task.controller.js:120-160](BE/src/controllers/task.controller.js#L120-L160), route `/api/v1/tasks/:id/status` | Bất kỳ nhân viên nào cũng tick hoàn tất task của bước khác (lễ tân tick “Đọc & ký báo cáo”), không kiểm tra `roleRequired`/`assignedToUserId` | Chỉ role tương ứng hoặc người được giao; ghi audit |
| P2-7 | [lis.controller.js](BE/src/modules/laboratory/lis.controller.js) | LIS nhận kết quả → `COMPLETED` ngay, không có bước duyệt của bác sĩ xét nghiệm, không cảnh báo **critical value**, không quản lý mẫu/barcode, không xác thực máy LIS (dùng JWT người) | Thêm `resulted → verified`, critical callback, API key/mTLS cho LIS, specimen lifecycle |
| P2-8 | [retention.util.js](BE/src/utils/retention.util.js), [scheduler.js](BE/src/jobs/scheduler.js) | Có tính `retentionExpiresAt` nhưng **không có job** xóa/ ẩn danh; không có luồng DSAR (xuất/ xóa dữ liệu theo yêu cầu) dù tuyên bố tuân thủ Luật 91/2025 | Job retention + legal hold; API DSAR có xác thực danh tính + audit |
| P2-9 | [imaging.controller.js:1028-1040](BE/src/modules/imaging/imaging.controller.js#L1028-L1040) | “Ký số” báo cáo CĐHA chỉ là hash SHA-256 nội bộ, không có private key/ chứng thư; trong khi PDF đã dùng PAdES thật ([pdfSignature.service.js](BE/src/services/pdfSignature.service.js)) → không đồng nhất, không đủ giá trị pháp lý | Dùng cùng service PKCS#12/HSM cho JSON report; lưu signature + verify khi đọc |
| P2-10 | [bhytApply.service.js:57-64](BE/src/modules/billing/bhytApply.service.js#L57-L64) | Áp **một tỷ lệ** lên toàn bộ tổng hóa đơn, gồm cả dịch vụ không thuộc danh mục BHYT, phí AI, giường tự chọn; không có tuyến/ đối tượng/ giá trần/ cùng chi trả; `usedThisYear` read-modify-write không atomic | Bảng danh mục + `insuranceCoverage` theo từng item; tuyến/ đối tượng; cập nhật lũy kế bằng `$inc` có điều kiện |
| P2-11 | [visit.controller.js:84-110](BE/src/controllers/visit.controller.js#L84-L110) | `createVisit` không kiểm tra `doctorId`/`nurseId` có đúng role, đúng bệnh viện, đang trực/ còn ca; `nurseId` bắt buộc dù thực tế có thể phân sau | Validate tenant+role+schedule; cho phép `nurseId` null và phân công sau |
| P2-12 | [visit.controller.js:483](BE/src/controllers/visit.controller.js#L483) | Ghi sinh hiệu tự đổi `đang chờ → đang khám` (bước của bác sĩ) → bác sĩ không bao giờ “bắt đầu khám”, KPI/ hàng đợi sai | Đo sinh hiệu xong giữ `đang chờ`; chỉ bác sĩ bấm bắt đầu khám |
| P2-13 | [visit.model.js:22](BE/src/models/visit.model.js#L22), `mriRoom/slot` | Không có lịch hẹn theo khung giờ/ slot; `visit.date` bỏ trống; `mriSlot` tách rời visit; không chống overbooking | Gắn `slotId` bắt buộc khi đặt MRI; kiểm tra capacity phòng máy |
| P2-14 | [recordShare.service.js](BE/src/services/recordShare.service.js), [storage.service](BE/src/services/storage/storageService.js) | Chia sẻ QR tốt nhưng **không** có nhật ký ai xem gì/ bao lâu; không giới hạn theo từng tài liệu (chỉ section) | Audit view + watermark + thông báo cho bệnh nhân |
| P2-15 | `Notification`, `Drug`, `WorkSchedule`, `SupportTicket`, `Announcement`, `EMRVersion`, `Biomarker`, `RevenueReport`, `Dataset`… | Không gắn `tenancyPlugin` → mọi truy vấn phải tự lọc `hospitalId`; chỉ cần một chỗ quên là rò rỉ | Gắn plugin + test đa viện cho từng model |
| P2-16 | [bhyt.routes.js:19-33](BE/src/modules/billing/bhyt.routes.js#L19-L33) | Toàn bộ route BHYT chỉ `protect`; `getBhytInfo` cho mọi role đọc thông tin thẻ của bất kỳ bệnh nhân cùng viện | `checkRole` + ownership/need-to-know |
| P2-17 | [admin.controller.js:341](BE/src/modules/hospital/admin.controller.js#L341) | `createUser` của admin thiếu `pharmacist` (khác `/auth/register`) → không tạo được dược sĩ từ backoffice | Hợp nhất danh sách role + validation |
| P2-18 | [auth.controller.js:35-130](BE/src/modules/auth/auth.controller.js#L35-L130) | Tạo tài khoản `doctor` chỉ cần `name/email/password`; `licenseUrl`, `specialty` tùy chọn; không xác minh chứng chỉ hành nghề (Luật KCB 2023) | Bắt buộc số CCHN + ngày hết hạn + upload; trạng thái `pending_verification` |

### 4.2 P3 — Vận hành / UX / hardening

| # | Vấn đề | Đề xuất |
| :-- | :--- | :--- |
| P3-1 | [nginx.conf:39-42](docker/nginx.conf#L39-L42): redirect `http → https` nhưng server chỉ listen 80 → **vòng lặp redirect**; không có TLS thật | Tách server 80 (ACME) và 443 (TLS); HSTS chỉ trên HTTPS |
| P3-2 | Backend publish `5000:5000`, AI `8000:8000` ra host; MongoDB không auth nếu dùng init script sai | Chỉ Nginx publish; `expose` nội bộ; bật auth MongoDB + network policy |
| P3-3 | `/uploads` static công khai, không auth, không `Content-Disposition` | Bỏ static; phục vụ qua controller có auth + signed URL ngắn hạn |
| P3-4 | Đăng nhập trả “còn X lần thử” khi email tồn tại, “Email hoặc mật khẩu không chính xác” khi không tồn tại → **liệt kê tài khoản** | Trả cùng một thông báo, chỉ ghi audit |
| P3-5 | Nhiều controller trả `error.message` ra client (lộ stack/ tên collection) | Chuẩn hóa `errorHandler`, che chi tiết ở production |
| P3-6 | CORS mở `NODE_ENV !== 'production'` cho mọi origin; cookie `sameSite: strict` tốt nhưng thiếu CSP | Cấu hình CSP, CSRF token cho form, CORS theo env |
| P3-7 | FE không có route guard theo role (deep-link `/staff/admin-backoffice` vẫn mở màn) | Guard theo `user.role` + ẩn menu (BE vẫn là chốt cuối) |
| P3-8 | Thiếu healthcheck backend, resource limit, log tập trung, `pino` request-id | Thêm `/healthz` (DB+AI), limits, structured log |
| P3-9 | `queueCounter` có model nhưng visit dùng cách khác; `swapRequest` không kiểm tra trùng ca | Hợp nhất cơ chế cấp số; validate overlap ca trực |

---

## 5. NGHIỆP VỤ ĐÃ BÁM SÁT THỰC TẾ CHƯA?

### 5.1 Bảng điểm theo phân hệ

| Phân hệ | Điểm | Đã có | Còn thiếu so với bệnh viện thật |
| :--- | :---: | :--- | :--- |
| Tiếp đón / hành chính | **7/10** | Tìm BN theo `medicalId`, BHYT, số thứ tự, phân phòng, email xác nhận, chặn 1 lượt mở | Định danh CCCD/ VNeID, ảnh chân dung, người đại diện/ trẻ em, đặt lịch theo giờ, hàng đợi ưu tiên theo đối tượng |
| Lịch hẹn & điều phối | **4/10** | Có `mriSlot`, lịch trực, đặt tái khám B2C | Không có appointment thực sự (slot/ giờ/ bác sĩ), overbooking, confirm/ hủy/ dời có thông báo, phòng khám theo khoa |
| Viện phí & BHYT | **6/10** | Hóa đơn, tạm ứng, PayOS/VietQR, hoàn tiền, chặn thu trùng, trần BHYT, trái tuyến cơ bản | Danh mục BHYT theo item, tuyến/ đối tượng/ giấy chuyển tuyến, XML giám định 4210/4750, HĐĐT (NĐ 123/2020), tạm ứng/ công nợ nội trú, bảng giá theo phiên bản |
| EMR | **7.5/10** | Version, addendum, khóa sau ký, audit hash-chain, break-glass có rate limit, consent, phân quyền đọc | Vòng đời bệnh án (mở/ đóng/ lưu trữ), ký số thật cho JSON, mẫu bệnh án theo chuyên khoa, đính kèm hình ảnh có cấu trúc |
| RIS / MRI / PACS | **6.5/10** | Hàng đợi, bảng kiểm, rescan/ cancel, key slice, ZIP DICOM, Drive/ Hybrid storage, viewer 2D | DICOMweb/WADO-RS, quản lý series, so sánh ca cũ có measurement, structured report, critical result call-back, treo/ in phim |
| AI/CDSS | **7/10** | YOLOv8 + ensemble, Grad-CAM, feedback active learning, version/ retrain, human-in-the-loop | Model registry theo ca, ngưỡng confidence + escalation, drift monitoring, SaMD/ hồ sơ thiết bị y tế, audit “AI bị bỏ qua” |
| Dược | **7.5/10** | FEFO, hạn dùng, dual-sign, cảnh báo liều/ tương tác, cấp cứu xuất trước, hậu kiểm 24h | Đơn thuốc điện tử quốc gia, pha chế (chemo), thuốc kiểm soát đặc biệt, hoàn trả, tư vấn dược lâm sàng có ghi nhận |
| Xét nghiệm (LIS) | **3/10** | Tiếp nhận kết quả mô phỏng, khoảng tham chiếu theo giới | Quản lý mẫu/ barcode, duyệt kết quả 2 cấp, critical value, HIS–LIS 2 chiều, giao diện nhập tay, kết nối máy thật |
| Điều dưỡng / nội trú | **6/10** | Sinh hiệu, Glasgow, phiếu chăm sóc, giường atomic, chuyển giường | Bàn giao ca (handover), đánh giá té ngã/ loét, kế hoạch chăm sóc, quản lý vật tư tại giường, y lệnh điều dưỡng |
| Cấp cứu | **8/10** | Code Red/Orange, ISBAR, verbal order 24h, pre-MRI safety, stand-down | Crash cart/ defibrillator check, code team roster, thời gian vàng đo lường, báo cáo sự kiện |
| Phẫu thuật / hậu phẫu | **2/10** | Chỉ có trạng thái “chờ chụp sau phẫu thuật” | Lịch mổ, tiền phẫu (gây mê, xét nghiệm, imaging), consent mổ, implant traceability, hậu phẫu 72h, GPB |
| Xuất viện / chuyển tuyến | **5/10** | TransferForm, email, discharge paper, PDF | Tiêu chuẩn xuất viện, tóm tắt điều trị, đơn thuốc ra viện, hẹn tái khám tự động, giấy chuyển tuyến BHYT, xác nhận tuyến nhận |
| Quản lý chất lượng | **4/10** | Peer review, SLA, audit log | Báo cáo sự cố y khoa (incident), kiểm soát nhiễm khuẩn, mortality & morbidity, chỉ số chất lượng theo khoa |
| Nhân sự / ca trực | **6/10** | WorkSchedule, swap, khóa tài khoản, audit | CCHN & hạn, CME, phân quyền theo khoa/ chức danh, chấm công, trực online |
| Cổng bệnh nhân B2C | **7/10** | Lịch sử khám, QR chia sẻ, bản sao bệnh án, chat, nhắc thuốc, hóa đơn | Người đại diện, DSAR, tải toàn bộ hồ sơ (FHIR/PDF), đặt lịch có slot, thanh toán trực tuyến an toàn |
| Hạ tầng / tuân thủ | **5/10** | Multi-tenant, mã hóa một phần, audit, PAdES | TLS thật, mã hóa toàn bộ, backup/ DR có diễn tập, DSAR, retention job, SLA 99.9 |

### 5.2 Năm khoảng trống nghiệp vụ lớn nhất (nên bổ sung)

1. **Lịch hẹn thực sự (appointment)**: hiện chỉ có “lượt khám” và “số thứ tự”. Bệnh viện thật cần đặt theo khung giờ + bác sĩ + phòng, xác nhận/ dời/ hủy, nhắc trước 24h/ 2h, chống overbooking, và slot MRI gắn với visit. Đây là điều kiện để mở rộng B2C.
2. **BHYT theo danh mục & tuyến**: cần `insuranceCoverage` ở từng dòng hóa đơn (dịch vụ/ thuốc/ vật tư), giá trần, tỷ lệ theo tuyến/ đối tượng/ giấy chuyển tuyến, và kết nối cổng giám định (XML). Hiện tại một tỷ lệ áp lên toàn bộ tổng là **không đúng thực tế** và dễ bị hội đồng chất vấn.
3. **Xét nghiệm**: thêm vòng đời mẫu (order → lấy mẫu → nhận → kết quả → duyệt → trả), cảnh báo critical value gọi bác sĩ, và giao diện nhập/ duyệt kết quả. Đây là mắt xích còn yếu nhất trong chuỗi chẩn đoán u não.
4. **Phẫu thuật & hậu phẫu**: với chuyên khoa u não, thiếu hoàn toàn lịch mổ/ tiền phẫu/ GPB/ hậu phẫu 72h. Nên bổ sung tối thiểu: chỉ định mổ, consent, checklist an toàn phẫu thuật (WHO), lịch mổ, ghi nhận implant, và mốc MRI hậu phẫu.
5. **Xuất viện & quản trị dữ liệu**: thêm tiêu chuẩn xuất viện, tóm tắt điều trị có ký số, đơn thuốc ra viện, hẹn tái khám; song song là job retention + DSAR + legal hold để đúng Luật 91/2025.

### 5.3 Đối chiếu luồng 8 bước (README) với mã nguồn

| Bước | README mô tả | Thực tế trong code | Đánh giá |
| :-- | :--- | :--- | :---: |
| 1 | Tiếp đón, BHYT, gợi ý bác sĩ ít hàng chờ | Có tạo visit, BHYT, `getStaff` trả `queueSize`; **không** gợi ý/ xếp tự động | Đạt một phần |
| 2 | Đo sinh hiệu, bác sĩ bắt đầu khám | Đo sinh hiệu **tự** chuyển `đang khám`; bác sĩ không có thao tác bắt đầu | Sai thứ tự nghiệp vụ |
| 3 | Ra y lệnh MRI, sinh hóa đơn tạm ứng | Có, nhưng không kiểm tra trạng thái, không chặn khi đã đóng | Cần siết |
| 4 | Bảng kiểm an toàn, chặn tuyệt đối | **Bị bypass** bằng `passed:true`; không chặn chưa thanh toán | **Không đạt** |
| 5 | AI chạy ngầm, fallback | Có, có fallback `chờ bác sĩ đọc` | Đạt |
| 6 | Bác sĩ CĐHA thẩm định, ký số | Không có role CĐHA; mọi bác sĩ/ nhân viên sửa được; không khóa sau ký | **Không đạt** |
| 7 | Phân giường, phiếu chăm sóc | Có atomic bed + care sheet | Đạt |
| 8 | Quyết toán, VietQR, PDF, đóng ca | Có PayOS/webhook/refund; thiếu HĐĐT và công nợ nội trú | Đạt một phần |

---

## 6. PHÂN TÍCH VAI TRÒ & ĐỀ XUẤT BỔ SUNG CHỨC NĂNG

### 6.1 Mô hình vai trò hiện tại

Enum trong [user.model.js:26](BE/src/modules/auth/models/user.model.js#L26): `patient`, `doctor`, `admin`, `hospital_admin`, `technician`, `nurse`, `receptionist`, `pharmacist` — **8 role phẳng**, không có cấp bậc, không có phạm vi khoa.

| Role | Số endpoint có guard | Màn hình FE chính | Vấn đề cốt lõi |
| :--- | :---: | :--- | :--- |
| `patient` | 23 | 11 màn | Chỉ xem; thiếu người đại diện, DSAR |
| `receptionist` | 38 | Tiếp nhận, thu ngân, BHYT, chuyển viện | Ôm quá nhiều quyền tài chính |
| `nurse` | 44 | Tiếp nhận, sinh hiệu, giường, EMR | Thiếu bàn giao ca/ kế hoạch chăm sóc |
| `doctor` | 54 | Hàng đợi khám + đọc MRI, EMR, thuốc | **Gộp bác sĩ lâm sàng và bác sĩ CĐHA** |
| `technician` | 18 | Hàng đợi MRI, upload phim | Thiếu lịch máy, QC ảnh, vật tư |
| `pharmacist` | 18 | Hàng đợi dược, danh mục, hạn dùng | **Không xem được dị ứng/ xét nghiệm** |
| `hospital_admin` | 84 | Dashboard, nhân sự, tài chính, audit | Đọc được toàn bộ bệnh án; tự đặt giá + tự duyệt |
| `admin` | 79 | Backoffice SaaS | Trùng vai trò với `hospital_admin`, có thể gắn `hospitalId` |
| `system_admin` | 3 | — | **Không tồn tại trong enum** (quyền chết) |
| `cleaner` | 1 | — | **Không tồn tại trong enum** (quyền chết) |

### 6.2 Sáu vấn đề của mô hình phân quyền hiện tại

1. **Thiếu vai trò bác sĩ CĐHA (`radiologist`).** `doctor` vừa khám lâm sàng vừa đọc/ ký phim. Trong bệnh viện thật, chỉ bác sĩ có phạm vi hành nghề CĐHA mới được ký báo cáo hình ảnh. Hiện `specialty` có trong model nhưng **không được dùng để phân quyền**.
2. **Không có phân tách nhiệm vụ (SoD) trong tài chính.** Cùng một `receptionist` có thể: tạo hóa đơn → thu tiền → hoàn tiền → ghi nhận chuyển khoản → đóng ca. Không có ngưỡng phê duyệt, không có người thứ hai.
3. **`hospital_admin` vừa đặt giá vừa duyệt báo cáo vừa xem audit.** Có thể tự sửa giá, tự duyệt giảm giá/hoàn tiền và tự kiểm tra dấu vết của mình.
4. **Không có phạm vi khoa/ tổ.** `departmentId` **không được dùng ở bất kỳ controller nào** (đã grep toàn bộ): điều dưỡng khoa A xem/ sửa được bệnh án khoa B; bác sĩ không phụ trách ca vẫn ký được.
5. **Không có ràng buộc theo ca trực/ thời gian.** `isOnCall`, `emergencyDuty` chỉ dùng để gợi ý phân công, không dùng để cấp/ chặn quyền ký ngoài giờ.
6. **Không có quyền theo tài nguyên (ownership).** Nhiều nơi chỉ kiểm tra `hospitalId`, không kiểm tra “có phải bác sĩ điều trị/ người tạo/ người được giao không”. Đây là gốc của P0-2, P1-8, P2-6.

### 6.3 Chức năng còn thiếu theo từng role (đề xuất bổ sung)

#### Bệnh nhân (`patient`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Lịch sử khám, phim + PDF, QR chia sẻ, bản sao bệnh án, chat, nhắc thuốc, hóa đơn, lấy số online | **Người đại diện/ người giám hộ** (xem & ký thay trẻ em/ người mất năng lực); **đặt lịch theo slot**; **DSAR** (tải/xóa dữ liệu); **tải toàn bộ hồ sơ**; theo dõi hàng đợi realtime; xác nhận/ từ chối chia sẻ; nhật ký ai đã xem hồ sơ | P0/P1 |
| — | Đồng thuận theo từng mục đích (AI, nghiên cứu, chia sẻ) có thể thu hồi | P1 |

#### Lễ tân / thu ngân (`receptionist`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Tạo lượt, BHYT, thu tiền, PayOS, hoàn tiền, chuyển viện, bản sao bệnh án | **Tách quyền thu/ hoàn**: hoàn tiền và giảm giá phải có người duyệt (kế toán/ trưởng bộ phận); **đặt lịch hẹn theo giờ**; **in hóa đơn/ HĐĐT**; **quản lý tạm ứng – công nợ nội trú**; **báo cáo ca thu/ bàn giao két**; tra cứu lịch sử thẻ BHYT | P1 |
| — | Không được sửa sinh hiệu/ y lệnh (hiện route cho phép) | P1 |

#### Điều dưỡng (`nurse`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Tiếp nhận, sàng lọc, sinh hiệu, Glasgow, giường, phiếu chăm sóc, gọi bệnh nhân | **Bàn giao ca (SBAR/ISBAR)**, **kế hoạch chăm sóc**, **đánh giá té ngã/ loét/ đau**, **theo dõi I/O – cân nặng**, **y lệnh điều dưỡng**, **quản lý vật tư tại giường**, **phát thuốc tại giường (5 đúng)** | P1/P2 |
| — | Không được ghi sinh hiệu thay đổi trạng thái sang `đang khám` (P2-12) | P1 |

#### Bác sĩ lâm sàng (`doctor`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Hàng đợi khám, y lệnh MRI, đơn thuốc, EMR, hội chẩn, chuyển viện, đọc kết quả | **Tách màn “đọc phim CĐHA”** khỏi khám lâm sàng; **Tumor Board** (hội chẩn đa chuyên khoa có biên bản); **chỉ định xét nghiệm có bộ xét nghiệm**; **kê đơn có kiểm tra liều/ tương tác** (đã có service, cần hiển thị); **tóm tắt xuất viện + hẹn tái khám**; **báo cáo sự cố y khoa**; **so sánh follow-up có đo đạc** | P0/P1 |
| — | Không được ký báo cáo CĐHA nếu không có `specialty` CĐHA | P0 |

#### Bác sĩ CĐHA (`radiologist` — **cần thêm role mới**)

| Cần có | Chi tiết |
| :--- | :--- |
| Hàng đợi đọc phim riêng | Chỉ ca đã có ảnh/ AI xong; ưu tiên theo SLA/ cấp cứu |
| Ký & khóa báo cáo | Ký PKI/PAdES, khóa vĩnh viễn, chỉ bổ sung addendum |
| Hiệu chỉnh AI | Chấp nhận/ bác bỏ + lưu feedback, ghi lý do |
| Critical result | Gọi/ thông báo bác sĩ chỉ định trong X phút, ghi nhận đã đọc |
| So sánh ca cũ | Đo kích thước, đối chiếu 2 lần chụp, template structured report |
| Peer review | Tự động lấy mẫu 5% ca đã ký (đã có job) |

#### Kỹ thuật viên (`technician`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Hàng đợi MRI, bảng kiểm, upload key slice/ ZIP, rescan/ cancel | **Lịch máy theo slot** (đặt/ dời/ chiếm dụng), **QC ảnh** (motion/ nhiễu, chấm điểm), **treo/ in phim**, **quản lý vật tư cản quang**, **bàn giao ca kỹ thuật**, **nhật ký máy MRI** (bảo trì/ sự cố) | P1/P2 |
| — | **Không được ký/ sửa báo cáo CĐHA** (hiện có thể qua P0-2) | P0 |

#### Dược sĩ (`pharmacist`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Duyệt/ từ chối/ phát thuốc, FEFO, hạn dùng, kiểm kê, audit override | **Xem dị ứng – sàng lọc – chức năng thận – kết quả xét nghiệm** của bệnh nhân (hiện bị chặn); **ghi tư vấn dược lâm sàng**; **pha chế thuốc (chemo)**, **thuốc kiểm soát đặc biệt**, **báo cáo ADR**, **hoàn trả thuốc**, **cảnh báo tương tác thuốc–thuốc/thuốc–bệnh** trên màn hình kê đơn | P1 |

#### Quản trị bệnh viện (`hospital_admin`)

| Đã có | Cần bổ sung | Ưu tiên |
| :--- | :--- | :---: |
| Dashboard, nhân sự, lịch trực, bảng giá, kho thuốc, báo cáo, audit, bản sao bệnh án | **Phê duyệt giảm giá/ hoàn tiền** (SoD); **quản lý khoa/ phòng/ giường theo khoa**; **bảng giá có version + hiệu lực**; **quản lý CCHN & hạn**; **báo cáo chất lượng/ sự cố**; **chính sách truy cập bệnh án**; không đọc nội dung lâm sàng chi tiết nếu không được giao | P1/P2 |

### 6.4 Danh sách role cần bổ sung

| Role mới | Vì sao cần | Quyền chính | Ghi chú triển khai |
| :--- | :--- | :--- | :--- |
| `radiologist` | Tách bác sĩ CĐHA khỏi bác sĩ lâm sàng; chỉ role này được ký báo cáo hình ảnh | đọc phim, ký/ khóa báo cáo, hiệu chỉnh AI, critical result | Thêm vào enum + seed; backfill các bác sĩ có `specialty = neuroradiologist` |
| `cashier` | Tách thu ngân khỏi lễ tân để giảm rủi ro tham ô | thu tiền, in hóa đơn, đóng ca thu; **không** tạo/ sửa giá, **không** hoàn tiền | Có thể dùng permission thay role nếu không muốn thêm |
| `accountant` | Đối soát BHYT/ doanh thu, duyệt hoàn tiền & giảm giá | duyệt refund, đối soát PayOS, báo cáo tài chính, xuất XML giám định | Bắt buộc cho SoD tài chính |
| `lab_technician` | Vận hành LIS: nhận mẫu, nhập/ trả kết quả | nhập kết quả, in phiếu, quản lý mẫu – không duyệt | Tách khỏi `technician` (CĐHA) |
| `lab_doctor` | Duyệt kết quả xét nghiệm, critical value | verify/ release kết quả, gọi báo critical | Có thể gộp `doctor` + `specialty` nếu muốn gọn |
| `head_nurse` | Điều dưỡng trưởng: duyệt kế hoạch chăm sóc, phân giường, chấm công tổ | duyệt care plan, điều phối giường, duyệt đổi ca | Gắn `departmentId` |
| `department_head` | Trưởng khoa: duyệt chuyển viện/ mổ/ ngoài giờ, chủ trì hội chẩn | duyệt y lệnh đặc biệt, peer review, ký biên bản hội chẩn | Bắt buộc cho break-glass hậu kiểm |
| `clinical_pharmacist` | Dược lâm sàng: tư vấn, dual-sign, theo dõi ADR | xem xét nghiệm/ dị ứng, duyệt đơn nguy cơ, tư vấn | Tách khỏi `pharmacist` cấp phát |
| `quality_manager` | Quản lý chất lượng/ kiểm soát nhiễm khuẩn | báo cáo sự cố, audit, chỉ số chất lượng, peer review | Có thể kiêm `hospital_admin` nhưng nên tách quyền |
| `dpo` | Người phụ trách bảo vệ dữ liệu (Luật 91/2025) | DSAR, consent, retention, audit truy cập | Bắt buộc nếu xử lý dữ liệu sức khỏe quy mô lớn |
| `guardian` | Người đại diện hợp pháp của bệnh nhân | xem/ ký thay theo `patientId` được ủy quyền | Quan hệ 1–n, có thời hạn + giấy tờ |
| `cleaner` | Đã xuất hiện trong route giường bệnh | xác nhận khử khuẩn buồng/ giường | Thêm enum hoặc bỏ khỏi route |
| `system_admin` | Tách SaaS admin khỏi `admin` | quản trị đa viện, cấu hình hệ thống | **Đang là quyền chết** — phải thêm enum |

> Khuyến nghị: **không thêm role tràn lan**. Chỉ thêm khi phạm vi hành nghề/ trách nhiệm pháp lý khác nhau (CĐHA, dược lâm sàng, kế toán, DPO). Các khác biệt nhỏ nên giải quyết bằng **permission + điều kiện**, không tạo role mới.

### 6.5 Từ RBAC phẳng sang RBAC + ABAC (khuyến nghị kiến trúc)

Hiện tại mọi thứ là `checkRole([...])` — danh sách chuỗi cứng, không thể diễn đạt “bác sĩ CĐHA được ký ca mình phụ trách trong 24h”. Đề xuất:

1. **Permission catalog** (hằng số, seed vào DB):
   ```js
   'visit.create', 'visit.vitals.write', 'visit.transition.start_exam',
   'imaging.upload', 'imaging.report.write', 'imaging.report.sign',
   'invoice.create', 'invoice.collect', 'invoice.refund.approve',
   'emr.record.read', 'emr.record.write', 'emr.record.sign',
   'pharmacy.prescription.verify', 'pharmacy.prescription.dispense',
   'admin.user.manage', 'audit.read'
   ```
2. **Role → permission** (bảng `role_permissions`, có thể cấu hình theo bệnh viện).
3. **Policy engine** cho điều kiện tài nguyên:
   ```js
   can(user, 'imaging.report.sign', { study })
   // = role.radiologist
   //   && study.hospitalId === user.hospitalId
   //   && (study.radiologistId === user.id || user.departmentId === study.departmentId)
   //   && !study.isSigned
   ```
4. **Scope mặc định** trong query (tenancy plugin đã có `hospitalId`, bổ sung `departmentId`).
5. **Middleware** `requirePermission('imaging.report.sign')` + `authorizeResource()` thay cho `checkRole` ở các route mới; giữ `checkRole` để tương thích trong giai đoạn chuyển đổi.
6. **Audit bắt buộc** cho mọi hành động `*.sign`, `*.approve`, `*.refund`, `*.override`, `emr.record.read` (đã có `recordAuditLog`, cần gọi đủ).

Lợi ích: sửa P0-2/ P1-4/ P1-13 bằng **một** cơ chế; thêm role mới không phải sửa 30 file route; bệnh viện có thể tự cấu hình ai được làm gì.

### 6.6 Xung đột nhiệm vụ (Segregation of Duties) cần chặn

| Cặp quyền không được cùng một người | Hiện trạng | Cách chặn |
| :--- | :--- | :--- |
| Tạo hóa đơn + thu tiền + hoàn tiền | `receptionist` làm tất cả | Hoàn tiền > ngưỡng cần `accountant`/`hospital_admin` duyệt; lưu người yêu cầu ≠ người duyệt |
| Đặt giá + duyệt giảm giá/ hoàn tiền | `hospital_admin` làm cả hai | Tách `accountant` hoặc yêu cầu 2 người duyệt |
| Chỉ định MRI + đọc/ ký kết quả | `doctor` làm cả hai | Thêm `radiologist`; nếu cùng người thì cảnh báo/ cần second read |
| Thực hiện chụp + sửa báo cáo | `technician` có `PUT /imaging/:id` | Bỏ quyền sửa báo cáo khỏi technician |
| Duyệt đơn + phát thuốc + điều chỉnh kho | `pharmacist` làm cả ba | Tách `clinical_pharmacist`; điều chỉnh kho cần chứng từ + audit |
| Tạo user + khóa user + xem audit | `hospital_admin` | Audit read-only cho `dpo`/`quality_manager`; không cho người thao tác tự xóa log |

---

## 7. LỘ TRÌNH SỬA (ĐỀ XUẤT)

> Kế hoạch chi tiết theo giai đoạn, mô hình dữ liệu đích, migration và kịch bản demo nằm tại [KE_HOACH_NGHIEP_VU_THUC_TE.md](KE_HOACH_NGHIEP_VU_THUC_TE.md).

### Sprint 0 — “chặn máu” (1–2 ngày, trước mọi buổi demo)

| # | Việc | Tiêu chí nghiệm thu |
| :-- | :--- | :--- |
| 1 | Server tự tính `isSafe` của bảng kiểm MRI; bỏ tin `passed` | POST `passed:true + pacemaker:true` → **400**, visit không đổi trạng thái |
| 2 | `PUT /imaging/:id` → `checkRole(['radiologist','doctor'])` + chặn `isSigned` + lấy tên từ `req.user` | Nurse/ lễ tân gọi → 403; ký lần 2 → 409; không sửa được báo cáo đã ký |
| 3 | Bỏ nhánh `patient` trong `createImagingResult` | Bệnh nhân POST `/imaging` → 403 |
| 4 | `POST /imaging/upload` → `checkRole(['technician','doctor'])` + quota | Bệnh nhân upload → 403; vượt quota → 429 |
| 5 | Chặn SSRF/ traversal: allowlist host + `startsWith(uploadsDir)` | `imageUrl = http://169.254.169.254/...` và `/uploads/../../etc/passwd` → 400 |
| 6 | Không publish 8000/5000; thêm API key nội bộ BE↔AI | Từ ngoài `curl :8000/predict` → connection refused/401 |

### Sprint 1 — toàn vẹn tài chính & trạng thái (1 tuần)

- Cổng thanh toán trước `đang chụp` + điều chỉnh hóa đơn khi cancel/ rescan (P1-1).
- Cấp số thứ tự atomic (P1-2).
- `mri-order` chỉ từ trạng thái hợp lệ (P1-3).
- Bảng `TRANSITION_ROLES` (P1-4).
- Whitelist field EMR (P1-5).
- Hợp nhất service tính hóa đơn + BHYT cho 3 luồng (P1-6).
- Scope đơn thuốc theo `visitId` (P1-7).
- Storage check `hospitalId` (P1-8).

### Sprint 2 — bảo mật dữ liệu & phân quyền (1–2 tuần)

- Mã hóa `cardNumber`, `signerNationalId`; migration + test không còn plaintext (P1-9).
- Password policy + refresh rotation + phiên thiết bị (P1-10).
- Rate limit dùng `req.ip` sau trust proxy + Redis (P1-11).
- Siết consent & break-glass (P1-12, P1-13).
- Bắt đầu permission catalog + `requirePermission` cho imaging/ invoice/ EMR (mục 6.5).
- Thêm role `radiologist` + backfill; tách quyền ký.

### Sprint 3 — nghiệp vụ còn thiếu (2–3 tuần)

- Appointment + slot MRI gắn visit; nhắc lịch 24h/ 2h. (P2-1, P2-2, P2-13)
- BHYT theo item + tuyến/ đối tượng + XML giám định. (P2-10)
- LIS: mẫu, duyệt 2 cấp, critical value. (P2-7)
- Xuất viện: tóm tắt + đơn ra viện + hẹn tái khám; DSAR + retention job. (P2-8)
- Phẫu thuật/ hậu phẫu mức tối thiểu (nếu hội đồng hỏi).

### Quick wins (< 1 ngày, làm ngay)

- `setHasKidneyDisease(pre.hasKidneyDisease)` (P2-3).
- `createUser` thêm `pharmacist` (P2-17).
- Đổi thông báo đăng nhập để không liệt kê tài khoản (P3-4).
- `checkRole` cho `GET /bhyt/:patientId` và `privacy-consents` (P1-12, P2-16).
- Bỏ `cleaner` khỏi route hoặc thêm enum (P2-5) — 5 phút, tránh hội đồng hỏi “role này ở đâu ra”.

---

## 8. TEST CẦN BỔ SUNG (để các lỗi trên không tái diễn)

| Test | Kỳ vọng |
| :--- | :--- |
| MRI safety — pacemaker + `passed:true` | 400, `status` không đổi, audit ghi nhận |
| MRI safety — pregnant/ kidney + contrast | chặn hoặc yêu cầu override có lý do |
| Imaging sign — nurse/ receptionist/ technician | 403 |
| Imaging sign — ký lần 2 | 409, nội dung không đổi |
| Imaging sign — `radiologist` từ body khác tên tài khoản | bị bỏ qua/ 400 |
| Patient POST `/imaging` | 403 |
| Upload 600MB/ vượt quota | 413/429; không ghi đĩa |
| SSRF `imageUrl` private IP/ metadata | 400 |
| Path traversal `/uploads/../../etc/passwd` | 400 |
| Queue number — 50 request đồng thời | 50 số duy nhất, không lỗi |
| `createMriOrder` trên visit `đã đóng` | 400 |
| Receptionist `đang khám → hoàn tất` | 403 |
| EMR update có `signStatus`/`patientId` | field bị bỏ qua/ 400 |
| `createAndPayInvoice` khi có thẻ BHYT | số thu = `patientPayAmount`, `bhytInfo` khớp |
| Hoàn tất ca có 2 đơn thuốc khác visit | chỉ đơn đúng `visitId` bị bill |
| Storage file của viện khác | 403 |
| Cancel MRI sau khi đã tạo hóa đơn | item MRI bị gỡ/ credit note, không thu |
| Consent của bệnh nhân khác | 403 |
| Refresh token reuse | thu hồi toàn bộ phiên |

---

## 9. PHỤ LỤC

### 9.1 Endpoint chỉ có `protect` cần rà lại ngay (top ưu tiên)

| Endpoint | Rủi ro |
| :--- | :--- |
| `PUT /api/v1/imaging/:id` | P0-2 — sửa/ ký báo cáo |
| `POST /api/v1/imaging/upload` | P0-4 — upload 600MB |
| `POST /api/v1/imaging/analyze-ai`, `/feedback-ai`, `/:id/explain-ai` | P0-5/ P1-13 — SSRF, tốn phí AI |
| `POST /api/v1/imaging` | P0-3 — bệnh nhân tạo kết quả |
| `POST /api/v1/emr/privacy-consents`, `/:id/revoke` | P1-12 |
| `GET /api/v1/bhyt/:patientId` | P2-16 |
| `POST /api/v1/contrast-consents/screening`, `/:id/override` | Thiếu role, override không kiểm tra bác sĩ |
| `PUT /api/v1/tasks/:id/status` | P2-6 |
| `GET /api/v1/storage/files/:fileId` | P1-8 |
| `GET /api/v1/admin/dashboard` | Đã có `checkRole` nhưng cho cả nurse/ tech — cân nhắc |
| `POST /api/v1/drive-storage/run-backup`, `/cleanup-orphans` | Có check trong controller, nên chuyển lên route |
| `GET /api/v1/assignment/*` | Có check trong controller, nên chuyển lên route |
| `POST /api/v1/emergency/*` | Có check một phần; nên khai báo rõ role |
| `GET /api/v1/report/*` | Có check trong controller; thống nhất middleware |
| `GET /api/v1/support/system-metrics` | Mọi nhân viên xem KPI viện |

### 9.2 Model chưa gắn `tenancyPlugin`

`notification`, `drug`, `drugReport`, `workSchedule`, `swapRequest`, `supportTicket`, `announcement`, `auditLog`, `emrVersion`, `biomarker`, `dataset`, `revenueReport`, `storedMedicalFile`, `otp`, `chatUsage`, `systemLock`, `hospital` (không cần), `user` (không cần).

→ Ít nhất `notification`, `drug`, `workSchedule`, `supportTicket`, `storedMedicalFile` nên được bảo vệ bằng plugin hoặc test tenancy bắt buộc.

### 9.3 Điểm mạnh nên giữ & nhấn khi bảo vệ

- Tenancy plugin + `AsyncLocalStorage` (fail-closed) ở các model lõi.
- EMR: version, addendum, khóa bất biến, hash-chain audit, break-glass có rate limit.
- Kho dược: FEFO theo lô, chặn thuốc hết hạn, dual-sign, cấp cứu xuất trước + hậu kiểm.
- PayOS: verify webhook (`await payos.webhooks.verify`), chống thu trùng, đối soát định kỳ, hoàn tiền.
- PDF: ký PAdES thật bằng PKCS#12, có cache theo `signedAt/updatedAt`.
- Chia sẻ bệnh án qua QR: token ngắn hạn + thu hồi + rate limit theo `uid`.
- Có bộ test tự động lớn (256 + 64) — nền tảng tốt để bổ sung test hồi quy cho P0.

### 9.4 Cách tái hiện nhanh các lỗi P0 (bằng curl, sau khi seed)

```bash
# 1) Bypass chống chỉ định MRI (thay <visitId>/<token>)
curl -X POST http://localhost:3000/api/v1/visits/<visitId>/mri-safety-check \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"hasPacemakerOrMetal":true,"passed":true}'

# 2) Nurse ký báo cáo CĐHA
curl -X PUT http://localhost:3000/api/v1/imaging/<imagingId> \
  -H "Authorization: Bearer <nurse_token>" -H "Content-Type: application/json" \
  -d '{"findings":"x","conclusion":"u ác tính","radiologist":"BS. Giả"}'

# 3) SSRF
curl -X POST http://localhost:3000/api/v1/imaging/analyze-ai \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"imageUrl":"http://169.254.169.254/latest/meta-data/"}'
```

> Lưu ý: các lệnh trên chỉ dùng cho môi trường dev/ test nội bộ, không chạy trên production.

---

*Báo cáo được lập bằng cách đọc mã nguồn + chạy test; không sửa file nào. Các đường dẫn `#Lx` là vị trí tại thời điểm audit (25/10/2026).*

