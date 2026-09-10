# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI VÀ MỤC TIÊU NGHIÊN CỨU

---

## 1.1. ĐẶT VẤN ĐỀ VÀ BỐI CẢNH THỰC TIỄN

### 1.1.1. Thực trạng chẩn đoán u não tại Việt Nam
Tại Việt Nam, các bệnh lý thần kinh sọ não — đặc biệt là u não (Brain Tumors như Glioma, Meningioma, Pituitary Adenoma) và tai biến mạch máu não — đang có xu hướng gia tăng nhanh chóng. Chụp cộng hưởng từ (Magnetic Resonance Imaging - MRI) là phương pháp chẩn đoán hình ảnh tiêu chuẩn vàng (Gold Standard) để phát hiện sớm, định vị không gian 3 chiều và đánh giá mức độ xâm lấn mô mềm của các tổn thương nội sọ.

Tuy nhiên, thực tế lâm sàng tại các bệnh viện Việt Nam hiện nay đang đối mặt với nhiều rào cản nghiêm trọng:
1. **Sự quá tải tại các bệnh viện tuyến trung ương:** Bệnh nhân từ khắp các tỉnh thành dồn về các bệnh viện hạng đặc biệt (Bạch Mai, Việt Đức, Chợ Rẫy, Quân Y 108), dẫn đến thời gian chờ chụp MRI và chờ trả kết quả kéo dài từ nhiều giờ đến nhiều ngày.
2. **Thiếu hụt bác sĩ Chẩn đoán hình ảnh (CĐHA) chuyên sâu tại tuyến cơ sở:** Tại các bệnh viện tuyến tỉnh và tuyến quận/huyện, số lượng bác sĩ CĐHA chuyên sâu về thần kinh học rất hạn chế. Bác sĩ lâm sàng thường phải tự đọc phim hoặc chuyển bệnh nhân lên tuyến trên, gây lãng phí chi phí và bỏ lỡ thời gian vàng điều trị.
3. **Hiện tượng "đảo dữ liệu" (Data Silos) và thiếu liên thông:** Đa số các bệnh viện sử dụng hệ thống thông tin bệnh viện (HIS) rời rạc. Hình ảnh MRI thường chỉ được in ra phim nhựa truyền thống hoặc lưu trữ cục bộ trên máy trạm (Workstation) của hãng máy chụp (Siemens, GE, Philips), không liên thông được hồ sơ bệnh án giữa các viện.

### 1.1.2. Sự trỗi dậy của Trí tuệ nhân tạo (AI) trong Y tế
Các tiến bộ gần đây trong thị giác máy tính (Computer Vision) và học sâu (Deep Learning) — tiêu biểu là các kiến trúc CNN và YOLOv8 — đã mở ra cơ hội to lớn để phát triển các hệ thống hỗ trợ ra quyết định lâm sàng (Clinical Decision Support Systems - CDSS). Một hệ thống AI có khả năng sàng lọc trước ảnh cắt lớp MRI sọ não, tự động khoanh vùng tổn thương (Bounding Box / Heatmap) và tính toán độ tin cậy trong vài giây sẽ đóng vai trò như một "trợ lý ảo" đắc lực, giúp giảm tải công việc cho bác sĩ CĐHA và giảm thiểu tối đa tỷ lệ bỏ sót tổn thương.

---

## 1.2. TÍNH CẤP THIẾT CỦA ĐỀ TÀI

Việc nghiên cứu và xây dựng hệ thống **NeuroScan AI** xuất phát từ những yêu cầu cấp bách sau:
- **Cấp thiết về mặt y tế công cộng:** Cải thiện tốc độ tiếp cận dịch vụ chẩn đoán chất lượng cao cho bệnh nhân tuyến cơ sở, giảm thiểu tỷ lệ biến chứng và tử vong do phát hiện muộn u não.
- **Cấp thiết về mặt chính sách y tế quốc gia:** Phù hợp với định hướng Chuyển đổi số Y tế của Bộ Y Tế theo **Thông tư 46/2018/TT-BYT** (Quy định về bệnh án điện tử EMR, hướng tới bệnh viện không in phim) và **Thông tư 54/2017/TT-BYT** (Bộ tiêu chí ứng dụng CNTT tại các cơ sở khám chữa bệnh).
- **Cấp thiết về mặt công nghệ:** Cung cấp giải pháp **Hybrid Mini-PACS** trên nền tảng Web/Mobile với chi phí đầu tư hạ tầng thấp, phù hợp với điều kiện ngân sách của các bệnh viện công lập và phòng khám đa khoa tại Việt Nam, thay vì phải mua sắm các hệ thống PACS ngoại nhập đắt đỏ lên tới hàng trăm ngàn USD.

---

## 1.3. MỤC TIÊU CỦA ĐỀ TÀI

### 1.3.1. Mục tiêu tổng quát
Thiết kế, xây dựng và đánh giá thực nghiệm hệ thống phần mềm hoàn chỉnh **NeuroScan AI** phục vụ quản lý bệnh viện đa cơ sở (Multi-Tenant RIS/PACS/HIS) tích hợp Hệ thống Trọng tài Đồng thuận Đa mô hình (**MAICS**: Bayesian CNN Ensemble + YOLOv8 Spatial Localization + Gemini VLM Arbitration) hỗ trợ chẩn đoán chính xác u não trên phim chụp cộng hưởng từ MRI sọ não.

### 1.3.2. Mục tiêu cụ thể
1. **Về mặt nghiệp vụ y tế & quy trình khám chữa bệnh:**
   - Chuẩn hóa luồng quy trình khép kín từ khâu Tiếp đón bệnh nhân $\rightarrow$ Khám lâm sàng $\rightarrow$ Bảng kiểm an toàn MRI $\rightarrow$ Kỹ thuật viên chụp & truyền ảnh $\rightarrow$ AI tiền chẩn đoán $\rightarrow$ Bác sĩ CĐHA đọc duyệt & Ký số điện tử $\rightarrow$ Bác sĩ lâm sàng ra phác đồ & Xếp giường nội trú $\rightarrow$ Bệnh nhân tra cứu hồ sơ.
   - Tuân thủ quy định tài chính y tế Việt Nam: Phân loại viện phí tự trả, BHYT bảo lãnh, và chế độ Cấp cứu ngoại lệ ("Chụp trước, thu sau").
2. **Về mặt công nghệ & kiến trúc phần mềm:**
   - Xây dựng kiến trúc phân tầng chuẩn (**Layered Clean Architecture**: Controller $\rightarrow$ Service $\rightarrow$ Model/Repository) đảm bảo tính mở rộng, bảo trì và kiểm thử tự động.
   - Hiện thực hóa mô hình **Đa cơ sở thuê bao (Multi-Tenancy)** với cơ chế cô lập dữ liệu tuyệt đối theo từng bệnh viện (`hospitalId`).
   - Tối ưu hóa hiệu năng truyền tải ảnh y tế bằng kỹ thuật **Multer Streaming nhị phân**, giải quyết triệt để bài toán nghẽn mạng và tràn bộ nhớ RAM (OOM) khi upload file ảnh dung lượng lớn.
   - Triển khai cơ chế kiểm soát tranh chấp tài nguyên đồng thời (**Concurrency Control**) bằng thao tác khóa nguyên tử trên MongoDB (`findOneAndUpdate`), chống trùng lặp giữ chỗ buồng giường bệnh nội trú.
3. **Về mặt Trí tuệ nhân tạo (AI Engine - Kiến trúc MAICS):**
   - Xây dựng và đánh giá hệ thống trọng tài đồng thuận đa tầng MAICS kết hợp bộ 3 CNN Ensemble (ResNet50 với Cost-Sensitive Risk Loss, EfficientNetV2, DenseNet121 + BayTTA), mô hình định vị không gian YOLOv8 và Gemini 3.1 Flash-Lite VLM.
   - Tích hợp bộ lọc **Anatomical Privacy Guard** nhận diện mặt cắt giải phẫu, chặn gửi dữ liệu ảnh nhạy cảm lên đám mây, giảm 79.5% yêu cầu API ngoài.
   - Đạt độ chính xác tổng thể $\ge 91\%$ và kéo giảm tỷ lệ bỏ sót u ác tính (Fatal False Negative Rate - Glioma thành Không u) xuống mức kỷ lục $0.43\%$ trên tập kiểm thử độc lập bệnh nhân gồm 3.461 ảnh (có 1.861 ảnh lâm sàng từ BV Đa khoa Tâm Trí Đà Nẵng).
4. **Về mặt kiểm thử & triển khai:**
   - Xây dựng bộ kiểm thử tự động toàn diện (Unit Tests, Clinical Workflow E2E Tests, OWASP Security Tests & Frontend Model Tests) đạt tỷ lệ vượt qua 100% (58/58 ca kiểm thử) và độ bao phủ mã nguồn lõi đạt ~78% (đo lường trực tiếp bằng công cụ chuẩn `c8`).
   - Đóng gói toàn bộ hệ sinh thái (Node.js Backend, FastAPI AI Engine, Expo React Native Web Frontend, Nginx Reverse Proxy, MongoDB) dưới dạng Docker Compose hỗ trợ khởi chạy 1-click script.

---

## 1.4. ĐỐI TƯỢNG VÀ PHẠM VI NGHIÊN CỨU

### 1.4.1. Đối tượng nghiên cứu
- Quy trình chuyên môn và quy chế chẩn đoán hình ảnh tại các bệnh viện Việt Nam.
- Dữ liệu hình ảnh y tế cộng hưởng từ sọ não (MRI T1-weighted, T2-weighted, FLAIR, T1-contrast).
- Mô hình thị giác máy tính phát hiện đối tượng thời gian thực (You Only Look Once - YOLOv8).
- Kiến trúc phần mềm phân tán, RESTful API, Single Page Application (SPA), và cơ chế Multi-Tenant NoSQL.

### 1.4.2. Phạm vi nghiên cứu
- **Phạm vi chức năng:** Hệ thống tập trung vào 5 phân hệ người dùng chính:
  1. *Phân hệ Bác sĩ Khám lâm sàng (Clinical Doctor Workstation)*
  2. *Phân hệ Kỹ thuật viên Hình ảnh (Technician Imaging Console)*
  3. *Phân hệ Bác sĩ Chẩn đoán hình ảnh (Radiologist Diagnostic Workstation)*
  4. *Phân hệ Bệnh nhân (Patient Portal)*
  5. *Phân hệ Quản trị Bệnh viện (Hospital Admin Dashboard)*
- **Phạm vi chẩn đoán AI:** Hỗ trợ phát hiện 3 loại u não phổ biến nhất (U thần kinh đệm - Glioma, U màng não - Meningioma, U tuyến yên - Pituitary Adenoma) và trường hợp mô não bình thường (No Tumor).
- **Phạm vi pháp lý:** Áp dụng các quy định hiện hành của Bộ Y Tế Việt Nam về Hồ sơ bệnh án điện tử, Tiêu chuẩn an toàn buồng chụp MRI và Luật Khám bệnh, chữa bệnh số 15/2023/QH15.

---

## 1.5. CẤU TRÚC CỦA BÁO CÁO ĐỒ ÁN
Báo cáo đồ án tốt nghiệp được tổ chức thành 10 chương chuyên sâu và 3 phần phụ lục:
- **Chương 1:** Tổng quan Đề tài và Mục tiêu Nghiên cứu
- **Chương 2:** Phân tích Nghiệp vụ và Quy trình Bệnh viện
- **Chương 3:** Thiết kế Kiến trúc Hệ thống
- **Chương 4:** Thiết kế Cơ sở Dữ liệu
- **Chương 5:** Đặc tả Kỹ thuật API RESTful và Cơ chế Tích hợp
- **Chương 6:** Nghiên cứu và Ứng dụng Mô hình Thị giác Máy tính YOLOv8
- **Chương 7:** Thiết kế Trải nghiệm Người dùng và Giao diện Đa nền tảng
- **Chương 8:** Kiểm thử Chất lượng Phần mềm và Thẩm định Lâm sàng
- **Chương 9:** Đóng gói, Triển khai và Vận hành Hệ thống
- **Chương 10:** Kết luận và Hướng phát triển Đề tài
- **Phụ lục A, B, C:** Biểu mẫu Bộ Y Tế, Từ điển thuật ngữ y khoa, Ma trận phân quyền RBAC và Bảng mã lỗi.
