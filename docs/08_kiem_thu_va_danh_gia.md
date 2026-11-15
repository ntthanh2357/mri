# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 8: KIỂM THỬ CHẤT LƯỢNG PHẦN MỀM VÀ THẨM ĐỊNH LÂM SÀNG

> **Đề tài:** NeuroScan AI – Nền tảng hỗ trợ sàng lọc u não trên ảnh MRI và quản lý hồ sơ bệnh án điện tử

---

## 8.1. CHIẾN LƯỢC KIỂM THỬ TOÀN DIỆN (COMPREHENSIVE TESTING STRATEGY)

Hệ thống y tế **NeuroScan AI** xử lý các dữ liệu sinh mạng của bệnh nhân và hồ sơ pháp lý bất biến, do đó quy trình kiểm định chất lượng phần mềm được áp dụng theo mô hình Kim tự tháp kiểm thử (Testing Pyramid) mở rộng, kết hợp giữa kiểm định tự động đa tầng (Automated Testing) và thẩm định chuyên môn lâm sàng thực tế:

```
                  / \
                 /   \
                / E2E \       -> Kiểm thử Toàn trình Lâm sàng (10 bước khép kín)
               /-------\
              / Compli. \     -> Kiểm thử Tuân thủ Pháp lý Y tế (TT46, HIPAA, Hash Chain)
             /-----------\
            / Remediation \   -> Kiểm định Khắc phục Lỗ hổng & Logic Lâm sàng (17 lỗi)
           /---------------\
          /  OWASP Security \ -> Kiểm thử Thâm nhập & An ninh Mạng (OWASP Top 10)
         /-------------------\
        /  Unit & Service Test\ -> Kiểm thử Đơn vị & Tầng Nghiệp vụ Lâm sàng
       /-----------------------\
```

### Các Tiêu Chí Đánh Giá Bắt Buộc:
1. **Kiểm định Nghiệp Vụ Toàn Trình (Clinical E2E Tests):** Đạt 100% tỷ lệ vượt qua trên toàn bộ các tầng nghiệp vụ cốt lõi (`BE/src/services/`) và quy trình 10 bước lâm sàng.
2. **Kiểm thử Biên & An Toàn Lâm Sàng (Clinical Safety Edge Cases):** 100% các tình huống chống chỉ định buồng chụp (máy tạo nhịp tim), nhiễu ảnh di chuyển, ký trùng báo cáo CĐHA và lạm dụng cấp cứu đều phải được xử lý an toàn (Fail-Safe).
3. **An Toàn Bảo Mật & Pháp Lý (OWASP & Regulatory Compliance):** Vượt qua 100% các bài kiểm tra về khóa EMR bất biến, chuỗi băm mật mã học SHA-256, khử định danh HIPAA Safe Harbor, phòng chống tấn công ReDoS và NoSQL Injection.

---

## 8.2. TỔNG HỢP KẾT QUẢ KIỂM THỬ TỰ ĐỘNG THỰC TẾ

Số liệu dưới đây được đo ngày **09/11/2026** trên mã nguồn nhánh `fix/v3.4-p0-remediation`, chạy đúng các bước CI (`.github/workflows/ci.yml`) trên MongoDB tạm, không dùng dữ liệu thật. Có thể chạy lại bằng các lệnh ghi ở từng mục.

### 8.2.1. Phân Hệ Backend
Thực thi tại thư mục `BE/`: `node src/tests/test_runner.js`, `node src/tests/run_all_tests.js`, `npm run test:seed-safety`.

| Bộ kiểm thử | Số ca | Nội dung chính | Kết quả |
| :--- | :---: | :--- | :---: |
| `test_runner.js` (73 nhóm) | 510 | Quy trình lâm sàng, an toàn buồng chụp MRI, phân quyền và cô lập dữ liệu giữa các bệnh viện, hoàn tiền, y lệnh miệng, cảnh báo nguy kịch, bảo vệ phiên đăng nhập; gồm 6 ca E2E chạy trên server thật cho 5 luồng trọng yếu | 510/510 |
| OWASP Top 10 Security Audit | 35 | Header bảo mật HTTP, chống NoSQL Injection, giới hạn tần suất, tải tệp an toàn, che dữ liệu cá nhân | 35/35 |
| Audit Remediation | 51 | Kiểm chứng các lỗi đã khắc phục sau các đợt kiểm toán | 51/51 |
| Compliance Audit | 34 | Khóa bất biến bệnh án, chuỗi băm chống sửa đổi, nguyên tắc tối thiểu cần thiết (HIPAA Minimum Necessary) | 34/34 |
| Seed safety (`node --test`) | 28 | Chặn chạy dữ liệu mẫu trên cơ sở dữ liệu thật | 28/28 |

Ngoài các bộ kiểm thử trên, hệ thống được kiểm bằng harness tự động: gọi 400 endpoint với 13 vai trò và người chưa đăng nhập (0 phản hồi HTTP 500), và gửi 18.024 request dữ liệu sai kiểu (0 phản hồi lộ chi tiết nội bộ; 8 route trả 5xx do môi trường kiểm thử không có máy chủ AI và cổng PayOS).

> **Ghi chú phạm vi:** Một số ca thuộc các chức năng đã đưa ra ngoài phạm vi đồ án (quản lý giường bệnh, BHYT, phân hệ Dược — mục 1.4.3) vẫn được chạy trong bộ hồi quy vì mã nguồn còn tồn tại, nhưng **không được tính vào phần đánh giá đồ án**.

### 8.2.2. Phân Hệ Frontend
Thực thi tại thư mục `FE/`: `npm test`; kiểm tra bản build web: `npx expo export --platform web`.

| Bộ kiểm thử | Số ca | Nội dung chính | Kết quả |
| :--- | :---: | :--- | :---: |
| `fe_models_utils` | 76 | Định dạng dữ liệu lâm sàng, mô hình bệnh án, biểu mẫu và tiện ích | 76/76 |
| `fe_navigation_linking` | 73 | Điều hướng và liên kết sâu (deep link) theo vai trò | 73/73 |
| `fe_transfer_package` | 3 | Gói hồ sơ chuyển viện | 3/3 |
| `fe_auth_cookie` | 9 | Refresh token qua cookie HttpOnly trên web, luồng cũ trên mobile | 9/9 |
| `fe_feature_scope` | 8 | Ẩn/bật các phần ngoài phạm vi đồ án | 8/8 |
| `fe_paper_fields` | 3 | Giấy tờ y tế không điền dữ liệu giả | 3/3 |
| **Tổng Frontend** | **172** | | **172/172** |

Bản build web (`expo export`) biên dịch thành công. **Hạn chế:** chưa có kiểm thử giao diện tự động trên trình duyệt; kiểm thử E2E hiện ở mức API.

---

## 8.3. BÁO CÁO ĐỘ BAO PHỦ MÃ NGUỒN THỰC TẾ (CODE COVERAGE REPORT)

> **Lưu ý:** Số liệu độ bao phủ trong mục này được đo ở phiên bản v3.2 và **chưa được đo lại** sau các đợt sửa lỗi v3.4.

Nhóm tuân thủ nguyên tắc minh bạch học thuật, đo lường trực tiếp độ phủ mã nguồn bằng công cụ **`c8` (V8 Native Coverage Engine)** tích hợp trong Node.js (`npm run test:coverage`):

| Phân hệ / Module Nghiệp Vụ | Tệp Mã Nguồn Đo Đạc | % Dòng lệnh (Lines) | % Câu lệnh (Stmts) | % Phân nhánh (Branches) | % Hàm số (Funcs) | Đánh giá |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Middlewares An Ninh & Bảo Vệ** | `secureUploads.middleware.js` | **100%** | **100%** | 83.33% | 100% | ✅ Xuất sắc |
| | `securityHeaders.middleware.js` | **93.54%** | **93.54%** | 66.66% | 100% | ✅ Xuất sắc |
| | `noSqlSanitize.middleware.js` | **91.66%** | **91.66%** | 81.81% | 100% | ✅ Xuất sắc |
| | `rateLimiter.middleware.js` | **91.74%** | **91.74%** | 73.68% | 87.50% | ✅ Xuất sắc |
| | `tenant.middleware.js` | **75.00%** | **75.00%** | 100% | 50.00% | ✅ Đạt |
| **Tầng Mô Hình Dữ Liệu (Models)** | `hospital.model.js`, `user.model.js`, `visit.model.js`, `hospitalBed.model.js`, `imagingResult.model.js`, `invoice.model.js` | **100%** | **100%** | 100% | 100% | ✅ Tuyệt đối |
| **Plugin Đa Cơ Sở (Multi-Tenancy)** | `tenancy.plugin.js` | **86.84%** | **86.84%** | 50.00% | 100% | ✅ Rất tốt |
| **Dịch Vụ Lâm Sàng Cốt Lõi** | `imaging.service.js` | **87.23%** | **87.23%** | 53.84% | 100% | ✅ Rất tốt |
| | `hospitalBed.service.js` | **71.57%** | **71.57%** | 42.85% | 80.00% | ✅ Đạt |
| | `visit.service.js` | **50.20%** | **50.20%** | 38.50% | 55.00% | ✅ Luồng chính |
| **Tiện Ích Lâm Sàng & Mã Hóa** | `masking.util.js` (Làm mờ PII BHYT/CCCD/SĐT) | **100%** | **100%** | 50.00% | 100% | ✅ Tuyệt đối |
| **TOÀN BỘ CÁC MODULE ĐƯỢC KIỂM THỬ** | **Tổng thể hệ thống** | **77.77%** | **77.77%** | **55.76%** | **66.66%** | ✅ **Chuẩn công nghiệp** |

---

## 8.4. TRÍCH XUẤT NHẬT KÝ THỰC THI KIỂM THỬ THỰC TẾ (TELEMETRY LOGS)

> **Lưu ý:** Nhật ký dưới đây là của lần chạy ở phiên bản v3.2 (152 ca Backend). Số liệu hiện tại xem mục 8.2.

Dưới đây là trích xuất trực tiếp kết quả chạy thực nghiệm từ terminal máy chủ đồ án:

```text
======================================================================
   NEUROSCAN AI: EXECUTING COMPREHENSIVE AUTOMATED TEST SUITE        
   TIÊU CHUẨN: TT46/2018/TT-BYT | LUẬT 15/2023/QH15 | HIPAA | OWASP   
======================================================================

>> STEP 1/4: Running Clinical Workflow & Service Unit Tests (30 tests)...
  ✔ PASS: Visit Service - Chặn chống chỉ định máy tạo nhịp tim
  ✔ PASS: Visit Service - Duyệt an toàn buồng MRI
  ✔ PASS: Visit Service - Rescan do cử động nhòe ảnh
  ✔ PASS: Visit Service - Hủy ca chụp MRI kèm lý do lâm sàng
  ✔ PASS: Hospital Bed Service - Tạo và chống trùng số giường
  ✔ PASS: Hospital Bed Service - Giữ chỗ giường nguyên tử
  ✔ PASS: Hospital Bed Service - Chặn Race Condition tranh chấp giường (409 Conflict)
  ✔ PASS: Hospital Bed Service - Bệnh nhân nhận giường và giải phóng buồng khử khuẩn
  ✔ PASS: Imaging Service - Tạo kết quả CĐHA liên kết ca khám
  ✔ PASS: Imaging Service - Chặn bác sĩ liên viện ký duyệt (Multi-tenant Isolation)
  ✔ PASS: Imaging Service - Bác sĩ CĐHA ký duyệt số hoàn tất ca khám
  ✔ PASS: E2E Clinical Workflow - Luồng 10 bước lâm sàng khép kín

>> STEP 2/4: Running OWASP Top 10 Security Audit Suite (35 tests)...
  ✔ PASS: 5/5 HTTP Security Headers (nosniff, SAMEORIGIN, XSS, Referrer, Permissions)
  ✔ PASS: 7/7 Khử độc NoSQL Injection ($ne, $gt, dot-notation, $where)
  ✔ PASS: 8/8 Sliding Window Rate Limiting (chặn vượt ngưỡng 429 Too Many Requests)
  ✔ PASS: 4/4 Secure Uploads (chặn Path Traversal, chặn truy cập /backups/, chặn leak .json)
  ✔ PASS: 4/4 Personal Identifiable Information Masking (SĐT, CCCD, BHYT, Email)
  ✔ PASS: 3/3 Multi-Tenant Isolation & B2C Privacy Protection

>> STEP 3/4: Running Audit Remediation Verification Suite (53 tests)...
  ✔ PASS: Payment Security: Bỏ qua hoàn toàn logic ghi CSDL tại route GET public payment/success
  ✔ PASS: Payment Security: PayOS Webhook HMAC-SHA256 cập nhật viện phí Idempotent
  ✔ PASS: Pharmacy Integrity: Tự động hoàn kho thuốc khi hóa đơn bị hủy hoặc hoàn tiền
  ✔ PASS: Hospital Bed Integrity: Chống cướp giường đang giữ chỗ tạm thời (Bed Reservation Hijacking)
  ✔ PASS: Patient Tenancy: Chặn đứng rò rỉ bệnh án chéo viện và bảo vệ bệnh nhân tự do B2C
  ✔ PASS: FSM Integrity: Chặn đứng nhảy cóc trạng thái ca khám bất thường (ALLOWED_TRANSITIONS)
  ✔ PASS: Data Compliance: Chuyển toàn bộ sang Soft Delete theo TT 46/2018/TT-BYT
  ✔ PASS: Timezone Integrity: Chuẩn hóa múi giờ Asia/Ho_Chi_Minh (+07:00) bảo toàn ca khám đêm
  ✔ PASS: Legal Integrity: Chặn mạo danh chữ ký cam đoan phẫu thuật (dựa trên req.user.role)
  ✔ PASS: BHYT Edge Case: Trái tuyến ngoại trú (0% - Không giấy chuyển viện) & Trái tuyến nội trú (100%)
  ✔ PASS: BHYT Edge Case: Chạm trần thanh toán 40 tháng lương cơ sở (~72 triệu VNĐ/năm)
  ✔ PASS: AML STR Compliance: Báo cáo STR gửi NHNN trong 48h và lưu trữ hồ sơ 5 năm

>> STEP 4/4: Running Comprehensive Compliance Audit Suite (34 tests)...
  ✔ PASS: OWASP API2:2023: Chặn token giả mạo alg: 'none' và Algorithm Confusion
  ✔ PASS: TT 46/2018: Khóa bất biến EMR khi đã Ký số hoặc Xuất viện, cho phép Append-Only Addendum
  ✔ PASS: Cryptographic Hash Chain: Tính toán currentHash liên kết previousHash, phát hiện can thiệp
  ✔ PASS: Cryptographic Hash Chain Concurrency: 10 chuyên gia Tumor Board ghi log đồng thời bảo toàn chuỗi
  ✔ PASS: HIPAA Minimum Necessary: Nhân viên tiếp tân bị ẩn thông tin chẩn đoán nhưng không mất key JSON
  ✔ PASS: HIPAA Field-Level Encryption: Mã hóa AES-256-GCM bảo vệ chỉ dấu phân tử ung thư
  ✔ PASS: EMR Retention Policy: Tính thời hạn lưu trữ 10/20/30 năm, xử lý năm nhuận 29/02, Legal Hold
  ✔ PASS: Neuro-Oncology CDS: Thẩm định tính nhất quán sinh học phân tử theo chuẩn WHO CNS5
  ✔ PASS: HIPAA Safe Harbor: Khử định danh ảnh DICOM 18 nhóm và gom nhóm tuổi 90+
  ✔ PASS: HIPAA Break-Glass: Truy cập cấp cứu khẩn cấp giới hạn tối đa 3 lần/ngày có ghi vết
  ✔ PASS: SIEM Alerting: Phát hiện can thiệp băm và phát cảnh báo SIEM mức độ HIGH/CRITICAL

>> SUMMARY TIMING TELEMETRY:
  • Suite 1: Clinical Workflow & Unit Tests         : 778.3 ms (30 tests)
  • Suite 2: OWASP Top 10 Security Audit            :   3.8 ms (35 tests)
  • Suite 3: Audit Remediation Verification         :  24.2 ms (53 tests)
  • Suite 4: Comprehensive Compliance & Neuro-Onc   : 178.7 ms (34 tests)
  --------------------------------------------------------------------
  • TOTAL EXECUTION DURATION: 0.98s across all 152 automated tests
>> STATUS: ✅ 100% PASSED (152/152 TESTS)
```

> **Ghi chú phạm vi:** Nhật ký trên được giữ nguyên như khi thực thi. Các dòng `Hospital Bed …`, `Pharmacy Integrity …`, `BHYT Edge Case …` thuộc chức năng ngoài phạm vi đồ án (mục 1.4.3), chỉ đóng vai trò kiểm thử hồi quy.

> **Kết luận chương:**
> Tại thời điểm đo (09/11/2026), bộ kiểm thử tự động gồm 510 ca (`test_runner`) và 148 ca bổ sung ở Backend, 172 ca ở Frontend, tất cả đều đạt; trong đó có 6 ca E2E cho 5 luồng trọng yếu. Hạn chế còn lại: chưa có kiểm thử giao diện tự động trên trình duyệt, độ bao phủ mã nguồn chưa đo lại cho v3.4, và chưa thử nghiệm với dữ liệu, người dùng thật tại bệnh viện. Vì vậy hệ thống hiện phù hợp ở mức **thử nghiệm**, chưa sẵn sàng vận hành thực tế.
