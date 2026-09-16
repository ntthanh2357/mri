# 🧭 DevBrain - Bản Đồ Phân Rã Kiểm Toán Hệ Thống Y Tế (NeuroScan AI)
## HƯỚNG DẪN KẾT NỐI & TRA CỨU TRÊN GOOGLE NOTEBOOKLM

> **Kho lưu trữ tri thức**: `G:\My Drive\DevBrain\audit_modules\`  
> **Mục tiêu**: Băm nhỏ toàn bộ kiến trúc và mã nguồn dự án thành 7 phân hệ độc lập (Domain-Driven Modules). Mỗi file chứa đầy đủ bối cảnh kỹ thuật, file mã nguồn, checklist lỗ hổng, prompt kiểm tra chuyên sâu và test case xác minh để Google NotebookLM có thể trả lời chính xác, sắc bén cho từng miền nghiệp vụ.

---

## 📚 Danh Mục 7 Phân Hệ Kiểm Toán Chuyên Sâu

| STT | Tên File Module | Phân Hệ Nghiệp Vụ | Trọng Tâm Rà Soát | Lỗi Liên Quan |
| :---: | :--- | :--- | :--- | :---: |
| **01** | [`01_auth_rbac_tenancy_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/01_auth_rbac_tenancy_audit.md) | **Xác Thực, Phân Quyền & Multi-Tenant** | JWT, Refresh Token, AsyncLocalStorage, Tenancy Leak, Cô lập B2C | BUG-03, BUG-04, BUG-14 |
| **02** | [`02_emr_ehr_compliance_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/02_emr_ehr_compliance_audit.md) | **Hồ Sơ Bệnh Án Điện Tử (EMR/EHR)** | BOLA liên viện, ReDoS search, Chữ ký cam đoan, Soft Delete (TT 46/2018) | BUG-02, BUG-09, BUG-15, BUG-17 |
| **03** | [`03_reception_visits_fsm_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/03_reception_visits_fsm_audit.md) | **Tiếp Đón, Hàng Đợi & FSM Ca Khám** | Finite State Machine, Múi giờ Asia/Ho_Chi_Minh (+07:00), Hạn mức ngày | BUG-10, BUG-16 |
| **04** | [`04_hospital_beds_transfers_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/04_hospital_beds_transfers_audit.md) | **Buồng Bệnh, Giường & Chuyển Viện** | Race condition tranh chấp giường, Giữ chỗ 4h, Duyệt chuyển viện, Crypto | BUG-04, BUG-05, BUG-07 |
| **05** | [`05_imaging_pacs_mri_ai_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/05_imaging_pacs_mri_ai_audit.md) | **Chẩn Đoán Hình Ảnh PACS & AI** | Slot chụp MRI, Cấp cứu chèn slot, Ký duyệt phim MRI, Path Traversal | PACS, Imaging isolation |
| **06** | [`06_billing_payos_pharmacy_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/06_billing_payos_pharmacy_audit.md) | **Tài Chính, Viện Phí, Dược & PayOS** | Payment Bypass, Webhook HMAC, Hoàn kho thuốc khi refund, Âm kho | BUG-01, BUG-08 |
| **07** | [`07_frontend_ux_state_audit.md`](file:///c:/Users/Administrator/OneDrive/Desktop/team5/docs/audit_modules/07_frontend_ux_state_audit.md) | **Frontend Mobile/Web & UX Lâm Sàng** | Silent Refresh 401, Sơ đồ giường 4h, Chuyển viện 7d EMR token, BHYT Copay, Ký số TT46 | BUG-11, BUG-12 |

---

## 🎯 Cách Sử Dụng Với Google NotebookLM

1. **Nạp Dữ Liệu Vào NotebookLM**:
   - Mở Google NotebookLM (notebooklm.google.com).
   - Chọn **Add Sources** ➔ Chọn **Google Drive**.
   - Trỏ tới thư mục `DevBrain` hoặc `DevBrain/audit_modules`.
   - Chọn toàn bộ 7 file module này cùng với `DEEP_AUDIT_REPORT_HIS_EMR.md` và `logic_bugs_postmortem.md`.

2. **Cách Đặt Câu Hỏi (Querying)**:
   - *Hỏi theo miền nghiệp vụ*: "Theo module 01, cơ chế bảo vệ bệnh nhân tự do B2C khỏi IDOR hoạt động như thế nào?"
   - *Hỏi về quy chuẩn pháp lý*: "Theo module 02, hệ thống làm thế nào để đáp ứng quy định không được xóa cứng bệnh án theo Thông tư 46/2018/TT-BYT?"
   - *Hỏi về xử lý đồng thời*: "Theo module 04, giải pháp chống cướp giường bệnh khi 2 bác sĩ cùng giữ chỗ được thực thi bằng toán tử nào trong MongoDB?"
   - *Hỏi về thanh toán y tế*: "Theo module 06, giải thích lỗ hổng Payment Bypass cũ và cách vá tại Webhook PayOS?"
