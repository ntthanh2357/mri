# 📋 MODULE 02: HỒ SƠ BỆNH ÁN ĐIỆN TỬ & PHÁP LÝ Y TẾ (EMR / EHR / BOLA / SOFT DELETE)
## DỰ ÁN: NEUROSCAN AI (HEALTHCARE ENTERPRISE PLATFORM)

> **Mục tiêu**: Kiểm toán phân hệ Bệnh án điện tử (EMR/EHR) theo tiêu chuẩn **Thông tư 46/2018/TT-BYT**, **Luật Khám bệnh, chữa bệnh 15/2023/QH15** và **OWASP API Security Top 10**. Đảm bảo tính toàn vẹn lâm sàng, tính bất biến của hồ sơ y tế, ngăn chặn BOLA liên viện và chống mạo danh chữ ký phẫu thuật.

---

## 1. 📂 Danh Mục Mã Nguồn & Vị Trí Trọng Yếu
* **Controllers & Services**:
  - `BE/src/modules/emr/emr.controller.js` (Bệnh án HSBA, Tờ chăm sóc, Biên bản hội chẩn, Giấy cam đoan)
  - `BE/src/controllers/patientRecord.controller.js` (Hồ sơ khám ngoại trú, tải tài liệu y khoa)
  - `BE/src/services/patientRecord.service.js` (Logic nghiệp vụ EMR, lưu vết xóa mềm)
* **Routes**:
  - `BE/src/modules/emr/emr.routes.js`
  - `BE/src/routes/patientRecord.routes.js`
* **Data Models & Pháp Lý**:
  - `BE/src/modules/emr/models/medicalRecord.model.js` (Hồ sơ bệnh án)
  - `BE/src/modules/emr/models/careSheet.model.js` (Tờ chăm sóc điều dưỡng)
  - `BE/src/modules/emr/models/consultation.model.js` (Biên bản hội chẩn)
  - `BE/src/modules/emr/models/consentForm.model.js` (Giấy cam đoan phẫu thuật/thủ thuật)
  - `BE/src/models/visit.model.js` (Schema ca khám gắn cờ Soft Delete)

---

## 2. 🛡️ Deep Audit Checklist & Các Lỗ Hổng Trọng Điểm

### 2.1. Rò rỉ Bệnh Án Ung Thư Não Chéo Viện (BOLA / IDOR - BUG-02)
- **Vấn đề**: Các hàm `getRecordById`, `getCareSheets`, `getConsultations` trong `emr.controller.js` có ghi chú "Cho phép xem bệnh án liên viện" nên đã bỏ qua kiểm tra ranh giới bệnh viện (`hospitalId`).
- **Rủi ro**: Bác sĩ ở cơ sở y tế tư nhân A có thể xem trọn vẹn chẩn đoán U não (Glioblastoma), phác đồ xạ trị và sinh hiệu của bệnh nhân Bệnh viện B chỉ bằng cách đoán số ID tăng tuần tự hoặc UUID trên URL.
- **Giải pháp đã thực hiện**: Tích hợp `checkPatientTenancy(record.patientId, req.user)` trước khi trả dữ liệu. Chỉ cho phép xem nếu:
  1. Cùng bệnh viện sở tại, HOẶC:
  2. Có Phiếu chuyển viện hợp lệ (`TransferForm`) đã được duyệt, HOẶC:
  3. Bác sĩ được cấp token xem chéo viện (`grantCrossHospitalView`).

### 2.2. Tấn Công Từ Chối Dịch Vụ ReDoS (Catastrophic Backtracking - BUG-09)
- **Vấn đề**: Tuyến `GET /api/v1/emr/records?search=...` đưa trực tiếp chuỗi tìm kiếm vào toán tử `$regex` của MongoDB:
  ```javascript
  // LỖ HỔNG CŨ:
  { patientName: { $regex: search, $options: "i" } }
  ```
- **Hậu quả**: Kẻ xấu truyền chuỗi regex lồng nhau (như `((a+)+)+$`), Event Loop của Node.js bị đơ, máy chủ tê liệt 100% CPU.
- **Giải pháp đã thực hiện**:
  ```javascript
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  ```

### 2.3. Mạo Danh Chữ Ký Cam Đoan Phẫu Thuật (signConsent - BUG-17)
- **Vấn đề**: Tuyến `POST /api/v1/emr/consents/:consentId/sign` đọc `const { role, signature } = req.body;`.
- **Rủi ro**: Bệnh nhân hoặc người dùng bất kỳ có thể gửi `role: "doctor"` để tự ý ký duyệt cam kết phẫu thuật thay cho bác sĩ mổ chính.
- **Giải pháp đã thực hiện**:
  - Bắt buộc lấy vai trò từ JWT đã định danh: `const userRole = req.user?.role;`.
  - Chỉ cho phép ký với vai trò `doctor` nếu `["doctor", "admin", "hospital_admin"].includes(userRole)`.
  - Nếu `userRole === "patient"`, bắt buộc phải trùng khớp với bệnh nhân của bệnh án (`record.patientId.toString() === req.user.id.toString()`).

### 2.4. Bất Biến Dữ Liệu Y Tế (Soft Delete vs Hard Delete - BUG-15)
- **Quy chuẩn Bộ Y Tế**: Hồ sơ bệnh án điện tử và chứng từ cận lâm sàng phải lưu trữ tối thiểu **10 năm** (ngoại trú) và **20 năm** (nội trú). Tuyệt đối không được phép xóa vật lý (Hard Delete).
- **Giải pháp đã thực hiện**:
  - Bổ sung `isDeleted: Boolean`, `deletedAt: Date`, `deletedBy: ObjectId` vào schema `Visit` và `documents`.
  - Chặn đứng không cho hủy ca khám đã `'hoàn tất'` hoặc `'đã đóng'` (đã thanh toán).
  - Loại bỏ hoàn toàn lệnh `deleteOne()` và `deleteFromGCS()`.

---

## 3. 📋 Copy-Paste Prompt Dành Cho Module 02

```markdown
Bạn là Chuyên gia Đánh giá Bảo mật Hệ thống Bệnh án Điện tử (EMR/EHR) theo chuẩn HIPAA và Thông tư 46/2018/TT-BYT.
Hãy kiểm toán toàn bộ Phân hệ EMR và Quản lý Bệnh án của dự án NeuroScan AI dựa trên file 02_emr_ehr_compliance_audit.md.

Tập trung vào:
1. File BE/src/modules/emr/emr.controller.js: Kiểm tra tất cả các hàm getRecordById, getCareSheets, getConsultations, signConsent xem có khả năng bị vượt quyền BOLA/IDOR hoặc mạo danh chữ ký không.
2. File BE/src/services/patientRecord.service.js: Rà soát hàm deleteVisit và deleteDocument xem có đảm bảo 100% là Soft Delete, lưu vết kiểm toán (Audit Trail) và chặn xóa các ca khám đã hoàn tất hay không.
3. Rà soát ô tìm kiếm hồ sơ bệnh án chống tấn công ReDoS.
4. Đưa ra các khuyến nghị nâng cấp chuẩn chữ ký số PKI / HSM / SmartCard cho bác sĩ phẫu thuật.
```

---

## 4. 🧪 Kịch Bản Kiểm Thử Xác Minh (Automated Verification)
* **File test**: `BE/src/tests/audit_remediation.test.js`
* **Các ca kiểm thử đã pass**:
  - ✔ `SUITE 5`: Escape thành công chuỗi regex nguy hiểm `((a+)+)+$` thành `\(\(a\+\)\+\)\+\$`.
  - ✔ `SUITE 6`: Chặn đứng mạo danh `req.body.role = "doctor"` khi đăng nhập tài khoản bệnh nhân.
  - ✔ `SUITE 7`: Chặn xóa ca khám đã hoàn tất; xóa mềm lưu đầy đủ `deletedBy` và `deletedAt`.
