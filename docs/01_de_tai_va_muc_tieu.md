# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI VÀ MỤC TIÊU NGHIÊN CỨU

---

## 1.1. ĐẶT VẤN ĐỀ VÀ BỐI CẢNH THỰC TIỄN

### 1.1.1. Thực trạng chẩn đoán và điều trị u não tại Việt Nam
Tại Việt Nam, các bệnh lý thần kinh sọ não — đặc biệt là các khối u nội sọ (Brain Tumors như U thần kinh đệm - Glioma, U màng não - Meningioma, U tuyến yên - Pituitary Adenoma) và tai biến mạch máu não — đang có xu hướng gia tăng nhanh chóng với mức độ nguy hiểm rất cao đến tính mạng người bệnh. Chụp cộng hưởng từ (Magnetic Resonance Imaging - MRI) là phương pháp chẩn đoán hình ảnh tiêu chuẩn vàng (Gold Standard) để phát hiện sớm, định vị không gian 3 chiều và đánh giá mức độ thâm nhiễm mô mềm của các tổn thương nội sọ mà các kỹ thuật khác (như chụp cắt lớp vi tính CT hay X-quang) không thể hiện rõ nét.

Tuy nhiên, thực tế lâm sàng tại các cơ sở y tế Việt Nam hiện nay đang đối mặt với nhiều rào cản mang tính hệ thống:
1. **Sự quá tải trầm trọng tại các bệnh viện tuyến trung ương:** Bệnh nhân từ khắp các tỉnh thành dồn về các bệnh viện hạng đặc biệt (Bạch Mai, Hữu Nghị Việt Đức, Chợ Rẫy, Quân Y 108), dẫn đến tình trạng thời gian chờ chụp MRI và chờ trả kết quả kéo dài từ nhiều giờ đến nhiều ngày, gây chậm trễ thời gian vàng can thiệp phẫu thuật và điều trị.
2. **Thiếu hụt bác sĩ Chẩn đoán hình ảnh (CĐHA) chuyên sâu tại tuyến cơ sở:** Tại các bệnh viện tuyến tỉnh và tuyến quận/huyện, số lượng bác sĩ CĐHA chuyên sâu về thần kinh học rất hạn chế. Bác sĩ khám lâm sàng thường phải tự đọc phim hoặc chuyển tuyến người bệnh lên tuyến trên, gây lãng phí chi phí đi lại, quá tải tuyến trên và làm gia tăng gánh nặng kinh tế - xã hội.
3. **Hiện tượng "đảo dữ liệu" (Data Silos) và thiếu liên thông y tế:** Đa số các bệnh viện sử dụng hệ thống thông tin bệnh viện (HIS) rời rạc. Hình ảnh MRI thường chỉ được in ra phim nhựa truyền thống đắt tiền (gây ô nhiễm môi trường và suy giảm chất lượng hình ảnh theo thời gian) hoặc lưu trữ cục bộ trên máy trạm (Workstation) của hãng máy chụp (Siemens, GE, Philips), không thể liên thông hồ sơ bệnh án giữa các cơ sở y tế khi chuyển tuyến.
4. **Nguy cơ sai sót và bỏ sót tổn thương ác tính:** Dưới áp lực đọc hàng trăm ca chụp mỗi ngày trong điều kiện phòng đọc thiếu sáng, bác sĩ CĐHA đối mặt với nguy cơ mỏi mắt và áp lực nhận thức (Cognitive Fatigue), dễ dẫn đến sai sót lâm sàng, đặc biệt là hiện tượng bỏ sót u thần kinh đệm ác tính thâm nhiễm nhòe (False Negative).

### 1.1.2. Sự trỗi dậy của Trí tuệ nhân tạo (AI) trong Y tế và Cơ hội Chuyển đổi số
Các tiến bộ vượt bậc gần đây trong thị giác máy tính (Computer Vision), học sâu (Deep Learning) và mô hình đa mô thức (Multimodal Vision-Language Models - VLM) đã mở ra cơ hội to lớn để phát triển các Hệ thống Hỗ trợ Ra Quyết định Lâm sàng (Clinical Decision Support Systems - CDSS). Một hệ thống AI có khả năng:
- Sàng lọc trước lát cắt MRI sọ não trong vài giây.
- Tự động khoanh vùng tổn thương không gian (Bounding Box) và tính toán độ tin cậy được hiệu chuẩn lâm sàng (Risk-Calibrated Confidence).
- Đóng vai trò như một "trọng tài đồng thuận" và trợ lý ảo độc lập giúp giảm tải 60 - 80% áp lực sàng lọc cho bác sĩ CĐHA, đồng thời giảm thiểu tối đa tỷ lệ bỏ sót u ác tính chết người.

---

## 1.2. TÍNH CẤP THIẾT CỦA ĐỀ TÀI

Việc nghiên cứu, thiết kế và xây dựng hệ thống **NeuroScan AI** xuất phát từ những đòi hỏi cấp bách cả về y tế công cộng, chính sách pháp lý và giải pháp công nghệ:
- **Cấp thiết về mặt y tế công cộng:** Cải thiện tốc độ tiếp cận dịch vụ chẩn đoán hình ảnh thần kinh chất lượng cao cho người dân tại tuyến cơ sở, giảm thiểu tỷ lệ biến chứng tàn tật và tử vong do phát hiện muộn u não.
- **Cấp thiết về mặt chính sách y tế quốc gia:** Phù hợp với định hướng Chuyển đổi số Y tế của Chính phủ và Bộ Y Tế Việt Nam:
  - **Thông tư số 46/2018/TT-BYT:** Quy định về hồ sơ bệnh án điện tử (EMR), hướng tới mô hình bệnh viện không in phim (Filmless Hospital) và không sử dụng bệnh án giấy.
  - **Thông tư số 54/2017/TT-BYT:** Quy định bộ tiêu chí ứng dụng công nghệ thông tin tại các cơ sở khám bệnh, chữa bệnh (tiêu chí HIS, RIS, PACS cấp độ cao).
  - **Luật Khám bệnh, chữa bệnh số 15/2023/QH15:** Đòi hỏi nâng cao trách nhiệm pháp lý, tính minh bạch, quyền riêng tư người bệnh và nguyên tắc ưu tiên cấp cứu y khoa.
- **Cấp thiết về mặt công nghệ & kinh tế:** Cung cấp giải pháp **Hybrid Mini-PACS** trên nền tảng Web/Mobile với chi phí đầu tư hạ tầng hợp lý, thích ứng với điều kiện ngân sách của các bệnh viện công lập và phòng khám đa khoa tại Việt Nam, thay vì phải mua sắm các hệ thống PACS ngoại nhập đắt đỏ lên tới hàng trăm ngàn USD.

---

## 1.3. MỤC TIÊU CỦA ĐỀ TÀI

### 1.3.1. Mục tiêu tổng quát
Thiết kế, xây dựng và đánh giá thực nghiệm hệ thống phần mềm hoàn chỉnh **NeuroScan AI** phục vụ quản lý bệnh viện đa cơ sở (Multi-Tenant HIS/RIS/EMR/Mini-PACS) tích hợp Hệ thống Trọng tài Đồng thuận Đa mô hình (**MAICS**: Bayesian CNN Ensemble + YOLOv8 Spatial Localization + Gemini 3.1 Flash-Lite VLM Arbitration) hỗ trợ chẩn đoán chính xác u não trên phim chụp cộng hưởng từ MRI sọ não, đáp ứng toàn diện các tiêu chuẩn pháp lý y tế Việt Nam và quốc tế.

### 1.3.2. Mục tiêu cụ thể
1. **Về mặt nghiệp vụ y tế & quy trình khám chữa bệnh lâm sàng:**
   - Chuẩn hóa luồng quy trình khép kín 10 bước lâm sàng: Tiếp đón bệnh nhân $\rightarrow$ Khám lâm sàng $\rightarrow$ Bảng kiểm an toàn buồng chụp MRI $\rightarrow$ Kỹ thuật viên chụp & truyền ảnh qua luồng nhị phân $\rightarrow$ AI tiền chẩn đoán $\rightarrow$ Bác sĩ CĐHA thẩm định & Ký số điện tử $\rightarrow$ Bác sĩ lâm sàng ra phác đồ & Xếp buồng giường nội trú $\rightarrow$ Hội chẩn đa chuyên khoa Tumor Board $\rightarrow$ Người bệnh tra cứu hồ sơ bệnh án điện tử.
   - Hiện thực hóa Máy trạng thái hữu hạn (Clinical Finite State Machine - FSM) với ma trận chuyển trạng thái hợp lệ `ALLOWED_TRANSITIONS`, ngăn chặn tình trạng nhảy cóc quy trình.
   - Xử lý chuẩn xác múi giờ y tế Việt Nam `Asia/Ho_Chi_Minh` (+07:00), đảm bảo các ca khám cấp cứu ban đêm (00:00 - 06:59) không bị trôi dữ liệu trên máy chủ UTC.
   - Tuân thủ chính sách tài chính y tế Việt Nam: Phân loại viện phí tự chi trả (VietQR / PayOS), bảo lãnh thanh toán BHYT (đúng tuyến, trái tuyến, trần chi trả 40 tháng lương cơ sở, duyệt trước thuốc đặc trị theo Thông tư 30/2018/TT-BYT), và chính sách Cấp cứu ngoại lệ ("Chụp trước, thu sau").
2. **Về mặt công nghệ, kiến trúc phần mềm & bảo mật dữ liệu:**
   - Xây dựng kiến trúc phân tầng sạch (**Layered Clean Architecture**: Route $\rightarrow$ Controller $\rightarrow$ Service $\rightarrow$ Model) đảm bảo tính độc lập, dễ bảo trì và khả năng kiểm thử tự động toàn diện.
   - Hiện thực hóa mô hình **Đa cơ sở thuê bao (Multi-Tenancy)** với cơ chế cô lập dữ liệu tuyệt đối (`hospitalId`), hàm thẩm định `checkPatientTenancy` và ranh giới bảo mật riêng cho bệnh nhân tự do B2C.
   - Tối ưu hóa hiệu năng truyền tải ảnh y tế bằng kỹ thuật **Multer Streaming nhị phân ghi trực tiếp xuống đĩa**, loại bỏ hoàn toàn nguy cơ tràn RAM (Out-Of-Memory) khi tải các tập ảnh dung lượng lớn.
   - Triển khai cơ chế kiểm soát tranh chấp tài nguyên đồng thời (**Concurrency Control**) bằng thao tác khóa nguyên tử trên MongoDB (`findOneAndUpdate`), loại bỏ hoàn toàn hiện tượng cướp giường bệnh giữ chỗ tạm thời (Bed Reservation Hijacking).
   - Thiết lập chuỗi băm mật mã **Cryptographic Tamper-Evident Hash Chain** (SHA-256) bảo vệ tính toàn vẹn hồ sơ bệnh án EMR, phát hiện can thiệp CSDL trái phép và kết nối cảnh báo SIEM.
   - Áp dụng tiêu chuẩn bảo mật y tế **HIPAA**: Khử định danh hình ảnh DICOM theo Safe Harbor 18 tiêu chí, mã hóa trường nhạy cảm bằng AES-256-GCM, và cơ chế truy cập cấp cứu Break-Glass Protocol có kiểm toán.
3. **Về mặt Trí tuệ nhân tạo (AI Engine - Kiến trúc MAICS):**
   - Xây dựng hệ thống trọng tài đồng thuận đa tầng MAICS kết hợp bộ 3 Bayesian CNN Ensemble (ResNet50 với Cost-Sensitive Risk Loss $\alpha=5.0$, EfficientNetV2, DenseNet121 + BayTTA với Temperature Scaling $T=1.3$), mô hình định vị không gian YOLOv8 và Gemini 3.1 Flash-Lite VLM.
   - Tích hợp bộ lọc **Anatomical Privacy Guard** nhận diện mặt cắt giải phẫu Axial vs Coronal/Sagittal, chặn gửi dữ liệu lộ khuôn mặt lên đám mây, giảm $79.5\%$ chi phí gọi API ngoài.
   - Đạt độ chính xác tổng thể $\ge 91\%$ và kéo giảm tỷ lệ bỏ sót u ác tính (Fatal False Negative Rate - Glioma thành Không u) xuống mức kỷ lục **$0.43\%$** (giảm thiểu 49.4% nguy cơ lâm sàng) trên tập kiểm thử độc lập gồm 3.461 ảnh (trong đó có 1.861 ảnh thực tế từ Bệnh viện Đa khoa Tâm Trí Đà Nẵng).
   - Tích hợp phân hệ Hỗ trợ ra quyết định lâm sàng (Rule-based CDSS) theo Quyết định 1514/QĐ-BYT của Bộ Y Tế và hướng dẫn WHO CNS 2021.
4. **Về mặt kiểm thử, chất lượng phần mềm & triển khai:**
   - Xây dựng bộ kiểm thử tự động toàn diện đạt tỷ lệ vượt qua **100% (166/166 ca kiểm thử)** bao gồm:
     - **152 ca Backend** (30 ca Clinical Unit/Workflow, 35 ca OWASP Top 10 Security, 53 ca Audit Remediation, 34 ca Comprehensive Compliance & Neuro-Oncology).
     - **14 ca Frontend** (Định dạng dữ liệu lâm sàng, cấu trúc EMR và kho 12 biểu mẫu Bộ Y Tế).
   - Đo lường độ bao phủ mã nguồn thực tế đạt **~78%** trên các module lõi bằng công cụ chuẩn `c8` của V8 Engine.
   - Đóng gói toàn bộ hệ thống (Node.js Backend, FastAPI AI Engine, Expo Web Frontend, Nginx Gateway, MongoDB) dưới dạng Docker Compose và script 1-click `run_all.bat`.

---

## 1.4. ĐỐI TƯỢNG VÀ PHẠM VI NGHIÊN CỨU

### 1.4.1. Đối tượng nghiên cứu
- Quy trình chuyên môn, quy chế chẩn đoán hình ảnh và quy chuẩn hồ sơ bệnh án tại các bệnh viện Việt Nam.
- Dữ liệu hình ảnh y tế cộng hưởng từ sọ não (MRI các chuỗi xung T1, T2, FLAIR, T1-contrast).
- Mô hình thị giác máy tính phát hiện tổn thương (YOLOv8) kết hợp mạng nơ-ron tích chập (CNN) và mô hình ngôn ngữ - thị giác lớn (VLM).
- Kiến trúc phần mềm phân tán, RESTful API bảo mật, Single Page Application (SPA) đa nền tảng và cơ chế an toàn CSDL Multi-Tenant.
- Các tiêu chuẩn pháp lý y tế: Thông tư 46/2018/TT-BYT, Thông tư 54/2017/TT-BYT, Luật Khám bệnh, chữa bệnh 15/2023/QH15, HIPAA và Hướng dẫn phân loại u hệ thần kinh trung ương WHO CNS5 (2021).

### 1.4.2. Phạm vi nghiên cứu
- **Phạm vi chức năng:** Hệ thống tập trung vào 6 phân hệ người dùng chính:
  1. *Phân hệ Bác sĩ Khám lâm sàng (Doctor Workstation)*
  2. *Phân hệ Kỹ thuật viên Hình ảnh (Technician Imaging Console)*
  3. *Phân hệ Bác sĩ Chẩn đoán hình ảnh (Radiologist Workstation)*
  4. *Phân hệ Điều dưỡng & Tiếp đón (Nurse Reception & Bed Management Console)*
  5. *Phân hệ Người bệnh (Patient Portal)*
  6. *Phân hệ Quản trị Bệnh viện (Hospital Admin Dashboard)*
- **Phạm vi chẩn đoán AI:** Tập trung phát hiện và phân loại 3 nhóm u não phổ biến nhất: U thần kinh đệm (Glioma), U màng não (Meningioma), U tuyến yên (Pituitary Adenoma) và trường hợp nhu mô não bình thường (No Tumor).
- **Phạm vi pháp lý & bảo mật:** Áp dụng nghiêm ngặt các quy định về lưu trữ bệnh án tối thiểu 10 - 30 năm (cấm xóa cứng vật lý), bảo mật định danh PII/BHYT/CCCD và kiểm soát phiên làm việc liên tục cho nhân viên y tế.

---

## 1.5. CẤU TRÚC CỦA BÁO CÁO ĐỒ ÁN
Báo cáo đồ án tốt nghiệp được tổ chức thành 10 chương chuyên sâu và 3 phần phụ lục:
- **Chương 1:** Tổng quan Đề tài và Mục tiêu Nghiên cứu
- **Chương 2:** Phân tích Nghiệp vụ và Quy trình Bệnh viện
- **Chương 3:** Thiết kế Kiến trúc Hệ thống (System Architecture)
- **Chương 4:** Thiết kế Cơ sở Dữ liệu (Database Design)
- **Chương 5:** Đặc tả Kỹ thuật API RESTful và Cơ chế Tích hợp
- **Chương 6:** Hệ thống Trọng tài Đồng thuận Đa mô hình (MAICS) và Thị giác Máy tính trong Chẩn đoán U não MRI
- **Chương 7:** Thiết kế Trải nghiệm Người dùng và Giao diện Đa nền tảng (UI/UX Design)
- **Chương 8:** Kiểm thử Chất lượng Phần mềm và Thẩm định Lâm sàng
- **Chương 9:** Đóng gói, Triển khai và Vận hành Hệ thống (DevOps & Deployment)
- **Chương 10:** Kết luận và Hướng phát triển Đề tài
- **Phụ lục A, B, C:** 12 Biểu mẫu Bộ Y Tế, Từ điển thuật ngữ y khoa chuyên ngành, Ma trận phân quyền RBAC và Bảng mã lỗi hệ thống.
