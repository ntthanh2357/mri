# 🧠 DevBrain - Nhật Ký Lỗi Logic, Lỗ Hổng & Postmortem Dự Án (NeuroScan AI)

> Kho dữ liệu lỗi logic, bẫy code và kinh nghiệm fix bug của dự án (kết nối trực tiếp với Google NotebookLM để truy vấn và hỗ trợ chẩn đoán nguyên nhân nhanh chóng).

---

## 📋 Hướng dẫn cấu trúc ghi chép (Schema)
Mỗi khi gặp một bug logic phức tạp hoặc đáng nhớ, hãy ghi lại theo định dạng sau:

```markdown
### [BUG-YYYYMMDD-01] Tiêu đề ngắn gọn về lỗi
- **Dự án/Module**: (VD: BE - hospital.controller.js / FE - DoctorWorkQueueScreen.js)
- **Mức độ nghiêm trọng**: (Thấp / Trung bình / Cao / Nghiêm trọng)
- **Triệu chứng (Symptoms)**: Mô tả lỗi biểu hiện ra sao? Lỗi hiển thị gì hoặc behavior sai thế nào?
- **Nguyên nhân gốc rễ (Root Cause)**: Tại sao lại bị lỗi này? (Logic ngầm, async/await, race condition, stale state, null pointer...)
- **Giải pháp (Fix)**: Code trước vs sau khi sửa hoặc tóm tắt cách xử lý.
- **Bài học rút ra (Lessons Learned / Rules)**: Cần lưu ý gì để tránh tái diễn về sau?
```

---

## 📚 Danh Sách Postmortem / Bẫy Code Đã Ghi Nhận

### [BUG-20260911-01] Khởi tạo hệ thống DevBrain
- **Dự án/Module**: System / DevBrain
- **Mức độ nghiêm trọng**: Thông tin
- **Triệu chứng**: Cần một nguồn tri thức tập trung để lưu trữ các case bug logic khó, tránh lặp lại sai lầm trong quá trình code và review.
- **Nguyên nhân gốc rễ**: Các lỗi thường bị trôi qua chat log hoặc commit history mà không được tổng hợp lại thành pattern cho AI/Dev tra cứu.
- **Giải pháp**: Tạo file logic_bugs_postmortem.md đồng bộ trực tiếp lên Google Drive và kết nối vào Google NotebookLM.
- **Bài học rút ra**: Luôn ghi chép lại postmortem ngay sau khi giải quyết xong các bug logic hóc búa.

---

### [BUG-20260911-02] Bỏ qua xác thực thanh toán qua returnUrl công khai (Unauthenticated Payment Bypass)
- **Dự án/Module**: BE - `src/modules/billing/invoice.controller.js` & `invoice.routes.js`
- **Mức độ nghiêm trọng**: Nghiêm trọng (CRITICAL - CVSS 9.8)
- **Triệu chứng**: Người dùng hoặc kẻ xấu có thể đổi trạng thái hóa đơn viện phí sang "đã thanh toán" hoặc kích hoạt Premium 1 năm miễn phí mà không cần trả tiền qua PayOS.
- **Nguyên nhân gốc rễ**: Tuyến `GET /api/v1/invoices/payment/success` là route public nhưng lại chứa logic nghiệp vụ tự cập nhật CSDL khi có `?invoiceId=...` hoặc `?orderCode=...` (do developer để lại logic kích hoạt nhanh khi test local).
- **Giải pháp**: Xóa bỏ toàn bộ logic ghi CSDL tại `paymentSuccess`. Mọi cập nhật trạng thái thanh toán bắt buộc phải diễn ra tại Webhook PayOS (`handlePayOSWebhook`) có thẩm định chữ ký HMAC checksum.
- **Bài học rút ra**: Tuyệt đối không thực thi thay đổi dữ liệu nhạy cảm (State Mutation) tại các tuyến GET công khai dùng làm redirect URL.

---

### [BUG-20260911-03] Lộ bệnh án lâm sàng liên viện do thiếu Tenancy Check trong EMR Controller
- **Dự án/Module**: BE - `src/modules/emr/emr.controller.js`
- **Mức độ nghiêm trọng**: Nghiêm trọng (CRITICAL)
- **Triệu chứng**: Bác sĩ hoặc nhân viên tại Bệnh viện A có thể xem trọn vẹn bệnh án ung thư não, phác đồ điều trị, sinh hiệu và biên bản hội chẩn của bệnh nhân Bệnh viện B chỉ bằng cách truyền `id` trên URL.
- **Nguyên nhân gốc rễ**: Các hàm `getRecordById`, `getCareSheets`, `getConsultations` ghi chú "Cho phép xem bệnh án liên viện" nên đã bỏ qua hoàn toàn việc kiểm tra `hospitalId` và không xác thực xem có Phiếu chuyển viện (`TransferForm`) hợp lệ hay không.
- **Giải pháp**: Tích hợp hàm thẩm định `checkPatientTenancy(record.patientId, req.user)` để chặn đứng BOLA/IDOR chéo viện.
- **Bài học rút ra**: Trong hệ thống đa cơ sở (Multi-Tenant HIS), xem dữ liệu chéo viện bắt buộc phải có chứng từ pháp lý liên kết (phiếu chuyển viện hoặc quyền hội chẩn liên viện).

---

### [BUG-20260911-04] Lọt quyền IDOR đối với bệnh nhân tự do B2C
- **Dự án/Module**: BE - `src/controllers/patientRecord.controller.js`
- **Mức độ nghiêm trọng**: Nghiêm trọng (CRITICAL)
- **Triệu chứng**: Nhân viên của bất kỳ bệnh viện nào cũng có thể đọc, cập nhật hoặc xóa lịch sử khám của tài khoản bệnh nhân B2C.
- **Nguyên nhân gốc rễ**: Hàm `getTargetPatientId` kiểm tra:
  `if (!patient || (patient.hospitalId && patient.hospitalId.toString() !== req.user.hospitalId.toString()))`
  Khi bệnh nhân B2C có `patient.hospitalId === null`, vế sau trả về `false`, làm cho câu lệnh kiểm tra quyền bị lọt qua hoàn toàn.
- **Giải pháp**: Sử dụng hàm chuẩn hóa `checkPatientTenancy` đã có sẵn cơ chế bảo vệ bệnh nhân B2C.
- **Bài học rút ra**: Cẩn trọng với các biểu thức logic dạng `a && a !== b` khi `a` có thể nhận giá trị `null` hoặc `undefined`.

---

### [BUG-20260911-05] Cướp giường giữ chỗ tạm thời trong quản lý buồng bệnh (Bed Reservation Hijacking)
- **Dự án/Module**: BE - `src/services/hospitalBed.service.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Giường bệnh đã được bác sĩ giữ chỗ riêng cho bệnh nhân cấp cứu trong 4 tiếng bị nhân viên khác xếp đè một bệnh nhân khác vào.
- **Nguyên nhân gốc rễ**: `occupyBedAtomicService` cho phép cập nhật nếu `status: { $in: ['available', 'reserved'] }` mà quên không kiểm tra nếu là `reserved` thì `reservedForPatientId` phải trùng khớp với bệnh nhân đang nhận giường.
- **Giải pháp**: Bổ sung điều kiện `$or: [ { status: 'available' }, { status: 'reserved', reservedForPatientId: patientId, reservedUntil: { $gte: new Date() } } ]`.
- **Bài học rút ra**: Giữ chỗ (Reservation) phải gắn liền với định danh chủ thể được giữ chỗ (Subject Ownership).

---

### [BUG-20260911-06] Crash 500 khi bệnh nhân B2C đặt lịch tái khám do thiếu `hospitalId`
- **Dự án/Module**: BE - `src/modules/patient-portal/patientB2c.controller.js` & `src/models/visit.model.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Bệnh nhân dùng app bấm đặt lịch tái khám bị báo lỗi máy chủ 500.
- **Nguyên nhân gốc rễ**: Schema `Visit` yêu cầu `hospitalId: { required: true }`, nhưng controller lại lấy `hospitalId: req.user.hospitalId` (vốn là `undefined` đối với bệnh nhân B2C chưa liên kết viện).
- **Giải pháp**: Cho phép truyền `hospitalId` của bệnh viện muốn đến khám từ request body và validate trước khi tạo bản ghi.
- **Bài học rút ra**: Khi thiết kế schema đa viện có phân hệ B2C, các trường tham chiếu cơ sở phải có chiến lược fallback rõ ràng.

---

### [BUG-20260911-07] Crash lỗi cú pháp khi gọi dynamic import crypto
- **Dự án/Module**: BE - `src/controllers/transfer.controller.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Gọi API cấp token xem bệnh án liên viện `POST /api/v1/transfers/:id/grant-cross-view` luôn bị crash 500.
- **Nguyên nhân gốc rễ**: Lệnh `const { crypto } = await import("crypto");` khiến biến `crypto` bị `undefined` vì module Node.js không có named export `crypto`.
- **Giải pháp**: Import tĩnh `import crypto from "crypto";` ở đầu file.
- **Bài học rút ra**: Tránh dynamic import không cần thiết đối với các built-in module cốt lõi của Node.js.

---

### [BUG-20260911-08] Thất thoát kho dược khi hoàn tiền hóa đơn
- **Dự án/Module**: BE - `src/modules/billing/invoice.controller.js`
- **Mức độ nghiêm trọng**: Trung bình (MEDIUM)
- **Triệu chứng**: Khi hóa đơn bị hủy hoặc hoàn tiền, tiền viện phí được ghi nhận hoàn lại nhưng số lượng thuốc trong kho không tăng trở lại, gây lệch số lượng tồn thực tế.
- **Nguyên nhân gốc rễ**: `refundInvoice` chỉ cập nhật `invoice.status = 'hoàn tiền'` mà không thực thi `Drug.bulkWrite` để hồi vị số lượng tồn kho.
- **Giải pháp**: Tự động duyệt qua các item có `type: "drug"` trong hóa đơn và gửi lệnh `$inc: { "stock.quantity": qty }`.
- **Bài học rút ra**: Mọi giao dịch tài chính liên quan đến vật tư/kho phải có chu trình đối ứng (Reverse / Compensating Transaction) đối xứng khi hủy hoặc hoàn tiền.

---

### [BUG-20260911-09] Lễ tân không thấy bệnh nhân thứ 21 trở đi và ô tìm kiếm bị tê liệt
- **Dự án/Module**: FE - `src/screens/NurseReceptionScreen.js`
- **Mức độ nghiêm trọng**: Trung bình (MEDIUM)
- **Triệu chứng**: Tại quầy tiếp đón, lễ tân chỉ nhìn thấy tối đa 20 bệnh nhân. Bệnh nhân mới đăng ký thứ 21 không xuất hiện trong dropdown. Nhập tên vào ô tìm kiếm không lọc được gì.
- **Nguyên nhân gốc rễ**: Gọi `get('/api/patients')` mà không truyền tham số phân trang (backend mặc định cắt ở 20 bản ghi). State `searchPatient` được khai báo nhưng không gắn vào sự kiện tìm kiếm gọi API.
- **Giải pháp**: Thêm `?all=true` hoặc gắn debounce gọi `GET /api/patients?search=...` khi người dùng nhập vào ô tìm kiếm.
- **Bài học rút ra**: Luôn kiểm tra giao ước phân trang giữa FE và BE đối với các danh mục hiển thị trên giao diện người dùng.

---

### [BUG-20260911-10] Token Refresh bị chết trên FE khiến bác sĩ bị văng khỏi hệ thống sau 1 giờ
- **Dự án/Module**: FE - `src/api/client.js`
- **Mức độ nghiêm trọng**: Trung bình (MEDIUM)
- **Triệu chứng**: Bác sĩ đang nhập dở hồ sơ bệnh án hoặc đang đo sinh hiệu thì màn hình đột ngột bị văng về trang Welcome, toàn bộ nội dung chưa lưu bị mất sạch.
- **Nguyên nhân gốc rễ**: Backend cấp Access Token (1h) và Refresh Token (7d). Tuy nhiên FE không hề lưu `refreshToken` và hàm `request` khi gặp mã lỗi 401 thì lập tức `setToken(null)` và `navigateTo('Welcome')` thay vì gọi API `/auth/refresh` để xin token mới.
- **Giải pháp**: Lưu `refreshToken` vào Storage. Viết Interceptor tự động làm mới token ngầm (Silent Refresh) khi gặp 401 và thực hiện lại request ban đầu.
- **Bài học rút ra**: Hệ thống y tế yêu cầu tính liên tục cao của phiên làm việc. Phải triển khai cơ chế Silent Token Refresh và cảnh báo hết phiên trước khi đăng xuất cưỡng bức.

---

### [BUG-20260911-11] Tuyến quản lý Giường bệnh & Chuyển viện thiếu Role Guard (BUG-04 trong Audit)
- **Dự án/Module**: BE - `src/modules/hospital/hospitalBed.routes.js` & `src/routes/transfer.routes.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Bất kỳ người dùng nào có JWT hợp lệ (bao gồm bệnh nhân, kỹ thuật viên, kế toán) đều có thể gọi các API nhạy cảm: tự tạo thêm giường bệnh, giữ chỗ giường bệnh ngoại khoa, chiếm dụng giường hoặc tự duyệt/từ chối phiếu chuyển viện giữa các bệnh viện.
- **Nguyên nhân gốc rễ**: File routes chỉ khai báo middleware xác thực danh tính `router.use(protect)` mà quên không gắn middleware phân quyền vai trò `checkRole([...])` trước các handler nghiệp vụ.
- **Giải pháp**:
  - Tại `hospitalBed.routes.js`: Bổ sung `checkRole(["admin", "hospital_admin"])` cho tuyến `POST /` tạo giường; gắn `checkRole(["doctor", "nurse", "admin", "hospital_admin"])` cho các tuyến `/:id/reserve`, `/:id/occupy`, `/:id/release`.
  - Tại `transfer.routes.js`: Gắn `checkRole(["doctor", "admin", "hospital_admin"])` cho `POST /`, `PUT /:id/accept`, `PUT /:id/reject`, `POST /:id/grant-cross-view`, và `checkRole(["doctor", "nurse", "admin", "hospital_admin"])` cho `POST /check-capacity`.
- **Bài học rút ra**: Luôn áp dụng nguyên tắc đặc quyền tối thiểu (Least Privilege). Tuyệt đối không dừng lại ở việc kiểm tra "Đã đăng nhập hay chưa" (`protect`) mà phải luôn kiểm tra "Có thẩm quyền thực hiện hành động này hay không" (`checkRole`).

---

### [BUG-20260911-12] Tấn công từ chối dịch vụ ReDoS qua ô tìm kiếm hồ sơ bệnh án EMR (BUG-09 trong Audit)
- **Dự án/Module**: BE - `src/modules/emr/emr.controller.js` & `src/modules/pharmacy/drug.controller.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Kẻ tấn công hoặc người dùng nhập vào ô tìm kiếm bệnh án/thuốc các chuỗi chứa ký tự regex lồng nhau (VD: `((a+)+)+$`, `.*.*.*.*.*.*a`) làm Event Loop của Node.js bị nghẽn (Catastrophic Backtracking), CPU máy chủ tăng vọt lên 100%, toàn bộ hệ thống bệnh viện ngừng phản hồi (DDoS).
- **Nguyên nhân gốc rễ**: Controller nhận trực tiếp tham số `req.query.search` từ client và đưa thẳng vào toán tử Mongoose `$regex` mà không qua bước chuẩn hóa hoặc escape các ký tự đặc biệt của Biểu thức chính quy.
- **Giải pháp**: Bổ sung cơ chế làm sạch chuỗi Regex trước khi truy vấn:
  ```javascript
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ```
  Áp dụng cho mọi câu truy vấn `$regex` trong `emr.controller.js`, `drug.controller.js`, `patient.controller.js`.
- **Bài học rút ra**: Tuyệt đối không đưa chuỗi nhập liệu tự do của người dùng trực tiếp vào Regular Expression Engine. Nếu chỉ tìm kiếm chuỗi con (Substring Match), hãy luôn escape tất cả ký tự meta-characters.

---

### [BUG-20260911-13] Nhảy cóc trạng thái ca khám do thiếu State Machine Finite Transitions (BUG-10 trong Audit)
- **Dự án/Module**: BE - `src/controllers/visit.controller.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Một ca khám vừa mới tiếp đón ở trạng thái "đang chờ" có thể bị một request API bất thường đổi thẳng sang trạng thái "hoàn tất", bỏ qua hoàn toàn các bước khám lâm sàng, chỉ định chụp MRI, phân tích AI và ký số của bác sĩ. Hóa đơn và hồ sơ y tế bị tạo sai quy trình pháp lý.
- **Nguyên nhân gốc rễ**: Hàm `updateStatus` chỉ kiểm tra `if (status) visit.status = status;` mà không có ma trận kiểm soát chuyển trạng thái hữu hạn (Finite State Machine).
- **Giải pháp**: Cài đặt bảng ma trận `ALLOWED_TRANSITIONS`:
  ```javascript
  const ALLOWED_TRANSITIONS = {
    'đang chờ': ['đang khám', 'đã hủy'],
    'đang khám': ['chờ chụp', 'hoàn tất', 'đã hủy'],
    'chờ chụp': ['đang chụp', 'chờ chụp lại', 'đã hủy'],
    'đang chụp': ['chờ kết quả AI', 'chờ chụp lại', 'lỗi AI', 'đã hủy'],
    'chờ kết quả AI': ['chờ bác sĩ đọc', 'chờ chụp lại', 'lỗi AI'],
    'lỗi AI': ['chờ bác sĩ đọc', 'chờ chụp lại'],
    'chờ chụp lại': ['đang chụp', 'đã hủy'],
    'chờ bác sĩ đọc': ['hoàn tất', 'chờ chụp lại'],
    'hoàn tất': ['đã đóng'],
    'đã đóng': [],
    'đã hủy': []
  };
  ```
  Nếu trạng thái mới không nằm trong `ALLOWED_TRANSITIONS[visit.status]`, từ chối ngay với mã lỗi 400 Bad Request.
- **Bài học rút ra**: Các quy trình lâm sàng có tính tuần tự bắt buộc phải được mô hình hóa bằng Máy trạng thái hữu hạn (FSM) ở tầng backend, không bao giờ tin tưởng luồng điều hướng của giao diện client.

---

### [BUG-20260911-14] Rò rỉ Secret & Private Key vào các tầng của Docker Image
- **Dự án/Module**: BE - `BE/.dockerignore` & `BE/Dockerfile`
- **Mức độ nghiêm trọng**: Nghiêm trọng (CRITICAL)
- **Triệu chứng**: Khi build Docker image để triển khai lên máy chủ, file `credentials.json` (Google Cloud / Drive Service Account) và `firebase-service-account.json` bị đóng gói trực tiếp vào Docker image layer, bất kỳ ai có quyền pull image từ Container Registry đều có thể trích xuất toàn bộ Private Key của hệ thống.
- **Nguyên nhân gốc rễ**: File `.dockerignore` trước đây có dòng whitelist `!credentials.json` và `Dockerfile` có lệnh `COPY credentials.json* ./` sao chép file nhạy cảm vào layer runner.
- **Giải pháp**:
  - Tại `BE/.dockerignore`: Xóa bỏ hoàn toàn ngoại lệ `!credentials.json`, bổ sung danh sách đen chặn triệt để: `credentials.json`, `firebase-service-account.json`, `*-service-account.json`, `.env*`, `*.json.key`.
  - Tại `BE/Dockerfile`: Xóa bỏ lệnh sao chép `credentials.json`, chỉ sao chép `node_modules`, `src` và `package.json`. Dữ liệu cấu hình production được truyền qua Docker Environment Secrets hoặc Kubernetes Secrets.
- **Bài học rút ra**: Không bao giờ đưa file credential/secret vào ngữ cảnh build của Docker (`COPY`). Whitelist trong `.dockerignore` là con dao hai lưỡi cần được rà soát cực kỳ cẩn trọng.

---

### [BUG-20260911-15] Xóa cứng dữ liệu bệnh án lâm sàng vi phạm Thông tư 46/2018/TT-BYT
- **Dự án/Module**: BE - `src/controllers/patientRecord.controller.js`, `src/services/patientRecord.service.js`, `src/models/visit.model.js`
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Người dùng hoặc nhân viên y tế bấm xóa lượt khám hoặc tài liệu y khoa thì bản ghi trong MongoDB và file lưu trữ trên Google Drive / GCS bị xóa vĩnh viễn (`deleteOne()` / `deleteFromGCS()`). Dẫn đến mất dấu vết pháp lý, vi phạm quy định lưu trữ hồ sơ bệnh án tối thiểu 10 - 20 năm của Bộ Y Tế.
- **Nguyên nhân gốc rễ**: Endpoint `DELETE /api/patient-records/visits/:visitId` và `DELETE /api/patient-records/visits/:visitId/documents/:docId` ban đầu được triển khai theo tư duy CRUD thông thường (Hard Delete vật lý).
- **Giải pháp**:
  - Chuyển toàn bộ cơ chế xóa sang Soft Delete: Bổ sung các trường `isDeleted: Boolean`, `deletedAt: Date`, `deletedBy: ObjectId` vào schema `Visit` và `documents`.
  - Chặn tuyệt đối không cho hủy/xóa các ca khám đã có trạng thái `'hoàn tất'` hoặc `'đã đóng'` (đã thanh toán viện phí).
  - Khi xem danh sách, tự động áp dụng bộ lọc `{ isDeleted: { $ne: true } }` nhưng vẫn bảo lưu dữ liệu gốc và file trên storage để phục vụ thanh tra y tế và kiểm toán tư pháp.
- **Bài học rút ra**: Trong phần mềm Y tế (HIS/EMR/EHR), dữ liệu lâm sàng và tài chính là Bất biến (Immutable). Tuyệt đối không dùng lệnh Hard Delete vật lý.

---

### [BUG-20260911-16] Lệch múi giờ UTC/GMT+7 làm trôi các ca khám đêm (00:00 - 06:59) sang ngày hôm trước
- **Dự án/Module**: BE - `src/utils/date.util.js`, `src/services/visit.service.js`, `src/controllers/visit.controller.js`, `src/modules/hospital/mriRoom.controller.js`
- **Mức độ nghiêm trọng**: Trung bình (MEDIUM)
- **Triệu chứng**: Tại các ca trực cấp cứu ban đêm (từ 00:00 đến 06:59 sáng giờ Việt Nam), điều dưỡng tiếp đón bệnh nhân hoặc bác sĩ xem hàng đợi khám trong ngày không thấy ca khám nào hiển thị, hoặc hệ thống tính sai hạn mức tiếp đón tối đa trong ngày (`maxPatients`).
- **Nguyên nhân gốc rễ**: Máy chủ Node.js / Docker chạy theo giờ chuẩn UTC (`TZ=UTC`). Khi lập trình viên gọi `new Date().setHours(0, 0, 0, 0)`, mốc thời gian được tạo ra là 00:00:00 UTC (tương đương 07:00:00 sáng tại Việt Nam). Các ca khám diễn ra trong khoảng từ 00:00 đến 06:59 sáng GMT+7 có timestamp nhỏ hơn mốc này, nên bị bộ lọc `{ createdAt: { $gte: startOfDay } }` loại bỏ khỏi hàng đợi "ngày hôm nay".
- **Giải pháp**: Xây dựng module tiện ích chuẩn `src/utils/date.util.js` với hàm `getDayRangeVN(dateInput)`:
  Sử dụng `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"` để trích xuất chính xác ngày YYYY-MM-DD theo giờ Việt Nam, sau đó gán mốc `+07:00` rõ ràng:
  - `startOfDay`: `${formattedDate}T00:00:00.000+07:00`
  - `endOfDay`: `${formattedDate}T23:59:59.999+07:00`
  Áp dụng cho toàn bộ các query lọc theo ngày trong `visit.controller.js`, `visit.service.js` và `mriRoom.controller.js`.
- **Bài học rút ra**: Đối với các ứng dụng y tế hoạt động 24/7 theo ca kíp, tuyệt đối không sử dụng `setHours(0, 0, 0, 0)` của máy chủ mà phải chuẩn hóa toàn bộ các phép tính ngày về múi giờ hoạt động thực tế của cơ sở y tế (Việt Nam GMT+7).

---

### [BUG-20260911-17] Mạo danh chữ ký cam đoan phẫu thuật/thủ thuật do tin tưởng req.body.role
- **Dự án/Module**: BE - `src/modules/emr/emr.controller.js` (`signConsent`)
- **Mức độ nghiêm trọng**: Cao (HIGH)
- **Triệu chứng**: Bệnh nhân hoặc người dùng bất kỳ có thể gửi kèm trường `role: "doctor"` trong request body của API `POST /api/v1/emr/consents/:consentId/sign` để tự ý ký duyệt cam kết phẫu thuật thay cho bác sĩ phẫu thuật viên chính, hoặc ngược lại.
- **Nguyên nhân gốc rễ**: Controller trước đây lấy trực tiếp thuộc tính `const { role, signature } = req.body;` và dựa vào giá trị này để quyết định gán cờ `doctorSigned = true` hay `patientSigned = true`. Kẻ tấn công có thể giả mạo chữ ký số/chữ ký điện tử của bác sĩ điều trị.
- **Giải pháp**:
  - Loại bỏ hoàn toàn việc đọc `role` từ `req.body`.
  - Bắt buộc lấy vai trò từ Token xác thực đã được định danh `const userRole = req.user?.role;`.
  - Phân tách quyền ký nghiêm ngặt:
    - Nếu `userRole` là `doctor`, `admin`, `hospital_admin`: Gán `consent.doctorSigned = true`.
    - Nếu `userRole` là `patient`: Kiểm tra quyền sở hữu hồ sơ bệnh án (`record.patientId.toString() === req.user.id.toString()`), nếu đúng mới gán `consent.patientSigned = true`. Nếu cố tình ký thay bệnh nhân khác thì trả về 403 Forbidden.
    - Các vai trò khác (dược sĩ, kế toán, kỹ thuật viên) không có thẩm quyền ký cam đoan phẫu thuật thì từ chối ngay lập tức (403 Forbidden).
- **Bài học rút ra**: Không bao giờ tin tưởng quyền hạn hoặc vai trò người dùng được truyền từ Body hoặc Query parameter của Client. Mọi quyết định phân quyền và ký duyệt pháp lý phải xuất phát từ Context xác thực tin cậy của JWT (`req.user`).

---

## 🏆 TỔNG KẾT TRẠNG THÁI KHẮC PHỤC
- **Ngày hoàn tất**: 11/09/2026
- **Tổng số lỗi đã giải quyết**: 17/17 lỗi bảo mật, logic lâm sàng, crash runtime và trải nghiệm FE.
- **Kiểm thử xác minh**: 76/76 bài test tự động vượt qua (100% Passed).
- **Trạng thái hệ thống**: Sẵn sàng kiểm thử chấp nhận (UAT) và tích hợp Production.


