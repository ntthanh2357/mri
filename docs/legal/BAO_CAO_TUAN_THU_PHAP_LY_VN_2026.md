# BÁO CÁO RÀ SOÁT TUÂN THỦ PHÁP LÝ VIỆT NAM (2026)
### DỰ ÁN: HỆ THỐNG Y TẾ SỐ & CHẨN ĐOÁN HÌNH ẢNH U NÃO (NEUROSCAN AI)

*Cơ sở phương pháp: Bộ công cụ mã nguồn mở [vn-law-check](https://github.com/mhfed/vn-law-check)*  
*Ngày thực hiện: 04/11/2026 · Phiên bản: 1.0 · Cấp độ rủi ro: Mức 3 (Nền tảng quy mô / Dữ liệu cá nhân nhạy cảm y tế)*

---

## 1. TỔNG QUAN PHÂN LOẠI & PHẠM VI ÁP DỤNG

Dựa trên kết quả quét mã nguồn tự động (`scan.sh`), hệ thống NeuroScan AI được xác định ở **Mức 3 — Nền tảng y tế quy mô lớn** với các đặc điểm:
- **Xử lý Dữ liệu cá nhân nhạy cảm:** Thông tin sức khỏe, tiền sử bệnh án, hồ sơ bệnh án điện tử (EMR), ảnh chụp sọ não DICOM, thông tin sinh hiệu, kết quả xét nghiệm máu (eGFR, chỉ số ung thư), số CCCD và mã thẻ BHYT.
- **Có giao dịch tài chính & thanh toán:** Cổng thanh toán viện phí trực tuyến (PayOS, VietQR, Chuyển khoản, tiền mặt), bù trừ quyền lợi BHYT.
- **Tích hợp Trí tuệ nhân tạo (AI):** Pipeline phân vùng u não tự động (Brain Tumor Segmentation) và gợi ý báo cáo có cấu trúc (RANO Criteria).
- **Hệ thống xác thực đa vai trò:** Phân quyền kiểm soát truy cập (RBAC) 8 vai trò bệnh viện: Bác sĩ điều trị, Bác sĩ CĐHA, Kỹ thuật viên, Điều dưỡng, Dược sĩ, Thu ngân/Lễ tân, Quản trị bệnh viện, Quản trị hệ thống.

### Văn bản quy phạm pháp luật áp dụng đối chiếu:
1. **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** (Hiệu lực 01/01/2026) & **Nghị định 356/2025/NĐ-CP** (Thay thế Nghị định 13/2023/NĐ-CP).
2. **Luật Khám bệnh, chữa bệnh số 15/2023/QH15** & **Thông tư 46/2018/TT-BYT** của Bộ Y tế quy định về Hồ sơ bệnh án điện tử.
3. **Luật Trí tuệ nhân tạo số 134/2025/QH15** (Hiệu lực 01/03/2026) & **Nghị định 142/2026/NĐ-CP** về minh bạch AI và hệ thống AI rủi ro cao trong y tế.
4. **Luật An ninh mạng số 24/2018/QH15** & **Nghị định 53/2022/NĐ-CP** quy định chi tiết về lưu trữ dữ liệu tại Việt Nam.
5. **Luật Giao dịch điện tử số 20/2023/QH15** quy định về chữ ký số, chứng từ điện tử y tế.
6. **Luật Thương mại điện tử 2025** & Quy định về cổng thanh toán trung gian.

---

## 2. BẢNG TỔNG HỢP KẾT QUẢ ĐỐI CHIẾU THEO CHECKLIST

*Quy ước đánh giá: 🔴 Cần xử lý ngay · 🟡 Nên cải thiện · 🟢 Đạt yêu cầu · ⚪ Không áp dụng*

| Lĩnh vực kiểm tra | 🔴 | 🟡 | 🟢 | Đánh giá chung |
| :--- | :---: | :---: | :---: | :--- |
| **1. Bảo vệ dữ liệu cá nhân (PDPL 2025 / NĐ 356)** | 0 | 1 | 6 | Hệ thống đã có mã hóa AES-256-GCM cho CCCD/BHYT, có bảng kiểm đồng ý (Consent Form). Cần bổ sung trang điều khoản rút lại đồng ý (DSAR) ở Cổng bệnh nhân. |
| **2. Bệnh án điện tử & Khám chữa bệnh (TT 46/2018)** | 0 | 0 | 5 | Đạt xuất sắc: Có Audit Log Hash-chain chống chối bỏ, khóa EMR sau khi xuất viện, chữ ký số PAdES chuẩn y khoa, phân quyền SoD chặt chẽ. |
| **3. Minh bạch Trí tuệ nhân tạo (AI Law 2025)** | 0 | 0 | 4 | Đạt chuẩn: Có nhãn "Phân tích hỗ trợ bởi NeuroScan AI", miễn trừ trách nhiệm y khoa rõ ràng, bắt buộc bác sĩ CĐHA xác nhận lại trước khi ký. |
| **4. An ninh mạng & Lưu trữ dữ liệu (NĐ 53/2022)** | 0 | 1 | 3 | Kiến trúc Hybrid PACS lưu trữ tệp gốc tại máy chủ cục bộ (On-premise / Local Hospital Server). Cần rà soát các dịch vụ cloud ngoại vi (nếu có). |
| **5. Giao dịch điện tử & Viện phí (E-Transactions)** | 0 | 0 | 4 | Tích hợp PayOS Webhook xác thực chữ ký HMAC-SHA256, tự động gạch nợ viện phí, chống thu trùng, hoàn tiền minh bạch theo đúng số thực trả. |

---

## 3. CHI TIẾT CÁC MỤC KIỂM TRA

### 3.1. Bảo vệ Dữ liệu Cá nhân Y tế Nhạy cảm
- **🟢 Mã hóa trường định danh nhạy cảm (Điều 26 Luật 91/2025 & NĐ 356/2025):**
  - Số CCCD và Mã số thẻ BHYT của bệnh nhân đã được mã hóa ở mức lưu trữ bằng thuật toán **AES-256-GCM** kèm IV ngẫu nhiên và Auth Tag (`fieldCrypto.service.js`).
  - Giao diện người dùng áp dụng kỹ thuật che số đuôi (`maskTail`), chỉ hiển thị 4 số cuối trừ khi người dùng có thẩm quyền yêu cầu xem bản rõ phục vụ khám chữa bệnh.
- **🟢 Cơ chế lấy ý kiến đồng ý (Consent Management - Điều 9 Luật 91/2025):**
  - Đã có mô hình `DataPrivacyConsent` lưu vết cụ thể: Ai đồng ý, vào thời điểm nào, nội dung đồng ý gì (Chụp MRI, xét nghiệm, hội chẩn từ xa).
  - Không sử dụng ô tích sẵn (pre-ticked checkbox), đảm bảo sự tự nguyện và minh bạch.
- **🟡 Đề xuất cải thiện (Quyền của chủ thể dữ liệu - Điều 4 Luật 91/2025):**
  - Cần hiển thị rõ ràng hơn chức năng "Yêu cầu trích xuất dữ liệu cá nhân" (Data Portability) và "Rút lại sự đồng ý chia sẻ" trên Cổng thông tin bệnh nhân (Patient Portal) với thời hạn phản hồi tuân thủ Điều 5 Nghị định 356/2025 (2 ngày làm việc cho phản hồi, tối đa 15-20 ngày cho xử lý rút đồng ý).

### 3.2. Tính Toàn Vẹn Hồ Sơ Bệnh Án Điện Tử (TT 46/2018/TT-BYT)
- **🟢 Toàn vẹn & Chống sửa đổi sau khi chốt bệnh án:**
  - Lượt khám sau khi hoàn tất hoặc xuất viện được chuyển sang trạng thái đóng/khóa.
  - Mọi thao tác nghiệp vụ đều được ghi nhận vào `AuditLog` có liên kết mã băm cryptographic (Hash-chain) ghi nhận danh tính nhân viên, địa chỉ IP, hành động và thời gian thực hiện.
- **🟢 Chữ ký số chuẩn PAdES:**
  - Báo cáo chẩn đoán hình ảnh và phiếu chuyển viện được xuất định dạng PDF tích hợp chữ ký số điện tử của bác sĩ CĐHA, đáp ứng quy định giá trị pháp lý văn bản điện tử theo Luật Giao dịch điện tử 2023.

### 3.3. Minh Bạch Trí Tuệ Nhân Tạo (Luật Trí Tuệ Nhân Tạo 2025)
- **🟢 Phân định vai trò & Cảnh báo rủi ro cao (High-Risk AI System):**
  - Thuật toán phân vùng khối u sọ não thuộc nhóm hệ thống AI rủi ro cao trong y tế (Điều 9 & 13 Luật 134/2025/QH15).
  - Hệ thống tuân thủ nguyên tắc: **AI chỉ đóng vai trò Trợ lý Hỗ trợ Chẩn đoán (Diagnostic Decision Support)**, không có quyền tự động chốt kết luận bệnh lý.
  - Trên giao diện `ImagingResultScreen.js` và bản in PDF luôn có nhãn rõ ràng:  
    *“Kết quả phân tích hình ảnh được hỗ trợ bởi hệ thống Trí tuệ nhân tạo NeuroScan AI. Kết quả chỉ mang tính chất tham khảo chuyên môn và bắt buộc phải được Bác sĩ Chẩn đoán hình ảnh thẩm định, kết luận và ký duyệt số.”*

### 3.4. Lưu Trữ Dữ Liệu An Ninh Mạng (Nghị định 53/2022/NĐ-CP)
- **🟢 Lưu trữ dữ liệu y tế tại chỗ (On-Premise / Local Storage First):**
  - Hệ thống sử dụng kiến trúc `localAdapter.js` và `pacsQueue.service.js`: tệp DICOM và ảnh chụp được lưu trữ vật lý tại ổ đĩa máy chủ nội bộ bệnh viện (Local Storage), áp dụng cơ chế băm chống trùng lặp SHA-256.
- **🟡 Dịch vụ Cloud đồng bộ phụ trợ (Google Drive Mirror):**
  - Tính năng Drive Mirror chỉ đóng vai trò bản sao lưu ngoại vi (Backup Mirror) được mã hóa. Đơn vị vận hành cần đảm bảo thỏa thuận xử lý dữ liệu và lưu trữ tuân thủ các quy định về an ninh mạng khi kích hoạt backup đám mây.

---

## 4. HƯỚNG DẪN DUY TRÌ & KIỂM TRA ĐỊNH KỲ

Để kiểm tra nhanh tính tuân thủ pháp lý của mã nguồn trong quá trình phát triển tiếp theo, các lập trình viên có thể thực hiện:

```bash
# Di chuyển vào thư mục backend và chạy lệnh audit
cd BE
npm run audit:legal
```

Bộ checklist đầy đủ được lưu tại thư mục:  
- `.vn-law-check/references/01-personal-data-protection.md`
- `.vn-law-check/references/07-ai-transparency.md`
- `.vn-law-check/sources/legal-references.md`

---

> [!NOTE]
> **Giới hạn trách nhiệm:** Báo cáo này là kết quả rà soát kỹ thuật sơ bộ dựa trên các quy định pháp luật hiện hành và bộ checklist `vn-law-check`. Báo cáo không thay thế cho văn bản tư vấn pháp lý chính thức từ cơ quan quản lý nhà nước hoặc luật sư có chứng chỉ hành nghề.

