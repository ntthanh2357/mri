# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 10: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN ĐỀ TÀI

---

## 10.1. TỔNG KẾT CÁC KẾT QUẢ ĐẠT ĐƯỢC

Sau quá trình nghiên cứu lý thuyết, phân tích nghiệp vụ thực địa và triển khai thực nghiệm chuyên sâu, đề tài tốt nghiệp kỹ sư **"NeuroScan AI — Hệ thống Hỗ trợ Chẩn đoán Hình ảnh MRI Não & Quản lý Bệnh viện Đa Cơ sở"** đã hoàn thành xuất sắc **100% các mục tiêu nghiên cứu và yêu cầu kỹ thuật đề ra ban đầu**:

1. **Về mặt Nghiệp Vụ Y Tế & Tính Thực Tiễn Lâm Sàng:**
   - Xóa bỏ triệt để 12 "nghịch lý phần mềm" thường gặp; hiện thực hóa quy trình khám chữa bệnh khép kín bám sát thực tế bệnh viện Việt Nam và tuân thủ nghiêm ngặt **Thông tư 46/2018/TT-BYT** về hồ sơ bệnh án điện tử (EMR) và **Luật Khám bệnh, chữa bệnh số 15/2023/QH15**.
   - Tích hợp thành công **Bảng kiểm an toàn buồng chụp MRI 4 tiêu chí sinh mạng**, chặn đứng nguy cơ biến cố từ trường; phân định rạch ròi thẩm quyền giữa Bác sĩ chỉ định và Bác sĩ CĐHA ký số; hỗ trợ xử lý nhiễu ảnh cử động (Rescan) và hủy ca chụp an toàn.
   - Hiện thực hóa **Máy trạng thái hữu hạn ca khám (Clinical FSM)** với ma trận chuyển trạng thái hợp lệ `ALLOWED_TRANSITIONS`, ngăn chặn hoàn toàn hiện tượng nhảy cóc quy trình lâm sàng.
   - Chuẩn hóa múi giờ y tế Việt Nam `Asia/Ho_Chi_Minh` (+07:00), bảo toàn trọn vẹn dữ liệu các ca khám cấp cứu ban đêm (00:00 - 06:59 sáng) trên máy chủ múi giờ UTC.
   - Hoàn thiện chính sách tài chính y tế đa luồng: Thanh toán tự chi trả qua VietQR/PayOS, bảo lãnh viện phí BHYT (đúng tuyến, trái tuyến, trần chi trả 40 tháng lương cơ sở, duyệt trước thuốc đặc trị theo Thông tư 30/2018/TT-BYT), và chính sách Cấp cứu ngoại lệ ("Chụp trước, thu sau").
2. **Về mặt Kỹ Thuật Phần Mềm, Bảo Mật & Toàn Vẹn Dữ Liệu:**
   - Tái cấu trúc thành công hệ thống theo mô hình **Phân tầng Sạch (Clean Layered Architecture)**: phân tách độc lập giữa Route, Controller, Service và Model, giúp mã nguồn đạt tính mô-đun hóa cao và dễ dàng kiểm thử tự động.
   - Hiện thực hóa kiến trúc **Đa cơ sở (Multi-Tenancy)** với hàm thẩm định quyền sở hữu `checkPatientTenancy` và ranh giới bảo mật riêng biệt cho tài khoản bệnh nhân tự do B2C.
   - Thiết lập chuỗi băm mật mã **Cryptographic Tamper-Evident Hash Chain (SHA-256)** bảo vệ tính toàn vẹn và chống chối bỏ của hồ sơ bệnh án EMR, hỗ trợ hội đồng Tumor Board ghi log đồng thời và tự động phát cảnh báo khẩn cấp tới hệ thống SIEM khi phát hiện CSDL bị can thiệp trái phép.
   - Triển khai toàn diện các tiêu chuẩn bảo mật y tế **HIPAA**: Mã hóa trường nhạy cảm bằng AES-256-GCM, khử định danh ảnh DICOM theo Safe Harbor 18 tiêu chí (gom nhóm tuổi 90+), phân tách dữ liệu theo quyền hạn tối thiểu (Minimum Necessary) và cơ chế truy cập cấp cứu Break-Glass có kiểm soát (tối đa 3 lần/ngày).
   - Ứng dụng giải pháp **Hybrid Mini-PACS** kết hợp kỹ thuật **Multer Streaming nhị phân ghi thẳng xuống đĩa**, giải quyết triệt để bài toán nghẽn mạng và sập máy chủ do tràn bộ nhớ RAM (OOM).
   - Triển khai cơ chế khóa nguyên tử (`findOneAndUpdate`) kết hợp kiểm tra chủ quyền sở hữu bệnh nhân, loại bỏ hoàn toàn nguy cơ cướp giường bệnh giữ chỗ tạm thời trong thời hạn 4 giờ cấp cứu.
3. **Về mặt Trí Tuệ Nhân Tạo (Kiến trúc MAICS):**
   - Ứng dụng thành công **Hệ thống Trọng tài Đồng thuận Đa mô hình (MAICS)** phối hợp bộ 3 Bayesian CNN Ensemble (ResNet50 với Cost-Sensitive Risk Loss $\alpha=5.0$, EfficientNetV2, DenseNet121 + BayTTA với Temperature Scaling $T=1.3$), mô hình định vị không gian YOLOv8 và Gemini 3.1 Flash-Lite VLM.
   - Kéo giảm tỷ lệ bỏ sót u ác tính (Fatal False Negative Rate - Glioma thành Không u) xuống mức kỷ lục **$0.43\%$** (giảm thiểu 49.4% nguy cơ rủi ro lâm sàng), đạt độ chính xác $91.01\%$ và Macro F1 đạt $92.04\%$ trên tập kiểm thử độc lập gồm 3.461 ảnh (trong đó có 1.861 ảnh thực tế từ Bệnh viện Đa khoa Tâm Trí Đà Nẵng).
   - Tích hợp bộ lọc **Anatomical Privacy Guard** bảo vệ dữ liệu khuôn mặt và giảm $79.5\%$ số lượng cuộc gọi API đám mây; tích hợp phân hệ Thẩm định chỉ dấu sinh học phân tử theo chuẩn WHO CNS5 (2021) và Trợ lý Hỗ trợ ra quyết định lâm sàng (Rule-based CDSS) theo Quyết định 1514/QĐ-BYT.
4. **Về mặt Kiểm Thử Chất Lượng & Triển Khai Vận Hành:**
   - Xây dựng bộ kiểm thử tự động toàn diện đạt tỷ lệ vượt qua **100% (166/166 ca kiểm thử)** bao gồm 152 ca Backend qua 4 suite chuyên sâu và 14 ca Frontend; độ bao phủ mã nguồn lõi đạt $77.77\%$ đo lường trực tiếp bằng công cụ chuẩn `c8` với thời gian thực thi siêu tốc dưới 1 giây.
   - Đóng gói hoàn chỉnh hệ sinh thái đa container (Node.js, Python FastAPI, Expo Web, Nginx, MongoDB) bằng Docker Compose, cấu hình `.dockerignore` thắt chặt loại bỏ hoàn toàn nguy cơ lộ secrets, và cung cấp script 1-click `run_all.bat` trên Windows.

---

## 10.2. NHỮNG ĐÓNG GÓP MỚI CỦA ĐỒ ÁN

- **Đóng góp về mặt Công nghệ & Kinh tế Y tế:** Đề xuất và chứng minh tính khả thi của mô hình **Hybrid Mini-PACS** chi phí thấp chạy trên nền Web/Mobile tích hợp AI trọng tài đồng thuận. Mô hình này mở ra cơ hội số hóa hình ảnh y tế và bệnh án điện tử cho hàng trăm trung tâm y tế tuyến huyện và phòng khám tư nhân tại Việt Nam mà không cần đầu tư máy chủ PACS ngoại nhập đắt đỏ lên tới hàng tỷ đồng.
- **Đóng góp về mặt Học thuật & Kỹ thuật Phần mềm:** Cung cấp tài liệu nghiên cứu và mã nguồn mẫu mực về việc dung hòa giữa các quy chế y tế pháp lý nghiêm ngặt (Medical Compliance, Immutability, Soft Delete, Tamper-Evident Hash Chain) và kiến trúc phần mềm hiện đại (Clean Architecture, Multi-Tenancy, FSM, Concurrency Control).
- **Đóng góp về mặt Trí tuệ Nhân tạo Lâm sàng:** Đề xuất phương pháp trọng tài phân tầng kích hoạt dựa trên xung đột (Conflict-Driven Gating) kết hợp bộ lọc bảo vệ quyền riêng tư giải phẫu (Anatomical Privacy Guard), giải quyết hài hòa bài toán đánh đổi giữa độ chính xác chẩn đoán, độ an toàn tính mạng bệnh nhân và chi phí vận hành API.

---

## 10.3. CÁC HẠN CHẾ HIỆN TẠI CỦA HỆ THỐNG

Mặc dù đã đạt được những kết quả ấn tượng và toàn diện, hệ thống vẫn còn một số điểm giới hạn kỹ thuật cần tiếp tục hoàn thiện trong tương lai:
1. **Phân tích tổn thương trên lát cắt 2D:** Mô hình AI hiện tại phân tích dựa trên các lát cắt ảnh 2 chiều tiêu biểu (Key Slices) thay vì dựng hình và phân đoạn không gian 3 chiều (3D Volumetric Segmentation) trực tiếp từ khối dữ liệu Voxel của toàn bộ chuỗi xung DICOM.
2. **Giao thức tiếp nhận ảnh y tế:** Hệ thống hiện tiếp nhận ảnh qua cổng Web Upload của Kỹ thuật viên (kèm file nén DICOM ZIP), chưa hỗ trợ trực tiếp giao thức mạng DICOM chuyên dụng (DICOM C-STORE SCP lắng nghe qua cổng 104) để nhận ảnh trực tiếp từ máy chụp MRI của các hãng Siemens/GE qua mạng nội bộ bệnh viện.
3. **Mức độ tích hợp chữ ký số:** Con dấu điện tử hiện tại hoạt động dựa trên thông tin định danh và chứng chỉ hành nghề được xác thực nội bộ trong CSDL, chưa tích hợp trực tiếp với phần cứng USB Token PKI hoặc dịch vụ ký số từ xa (Remote Signing) có chứng thư số công cộng được Bộ Thông tin và Truyền thông công nhận.

---

## 10.4. HƯỚNG PHÁT TRIỂN TIẾP THEO

Để đưa NeuroScan AI từ một đề tài đồ án tốt nghiệp xuất sắc trở thành một sản phẩm thương mại hoàn chỉnh đạt chuẩn Thiết bị Y tế Kỹ thuật số (Software as a Medical Device - SaMD), nhóm định hướng phát triển các giai đoạn tiếp theo như sau:

1. **Nâng Cấp Mô Hình AI Lên Không Gian 3D (Volumetric Segmentation):**
   - Nghiên cứu và tích hợp các kiến trúc mô hình 3D tiên tiến như **nnU-Net** và **SAM-Med3D** (Segment Anything in Medical Images 3D) nhằm tự động phân đoạn ranh giới khối u não trên không gian 3 chiều, đo đạc chính xác thể tích khối u ($cm^3$), thể tích vùng phù não xung quanh và thể tích mô hoại tử trung tâm.
2. **Chuẩn Hóa Giao Tiếp Y Tế Quốc Tế DICOMweb:**
   - Triển khai đầy đủ bộ giao thức RESTful y tế quốc tế **DICOMweb**: WADO-RS (truy xuất ảnh), QIDO-RS (truy vấn danh sách ca chụp) và STOW-RS (lưu trữ ảnh), cho phép hệ thống kết nối trực tiếp không qua trung gian với bất kỳ trạm Workstation hoặc máy chụp MRI nào tuân thủ chuẩn DICOM 3.0.
3. **Liên Thông Hồ Sơ Bệnh Án Chuẩn Quốc Tế HL7 / FHIR:**
   - Xây dựng hệ thống API theo chuẩn **HL7 FHIR Release 4** (Fast Healthcare Interoperability Resources) để sẵn sàng kết nối liên thông dữ liệu hồ sơ bệnh án điện tử với Cổng tiếp nhận Dữ liệu Giám định BHYT Quốc gia của Bảo hiểm Xã hội Việt Nam và Cơ sở Dữ liệu Y tế Quốc gia của Bộ Y Tế.
4. **Tích Hợp Chữ Ký Số Khóa Công Khai (PKI / USB Token / HSM):**
   - Nâng cấp con dấu điện tử thành chữ ký số số hóa có chứng thư số hợp pháp thông qua tích hợp API với các nhà cung cấp dịch vụ chứng thực chữ ký số công cộng (VNPT-CA, Viettel-CA, FPT-CA), sử dụng thiết bị bảo mật phần cứng HSM (Hardware Security Module) theo đúng quy định của Luật Giao dịch điện tử.
5. **Mở Rộng Tập Dữ Liệu Lâm Sàng Đa Trung Tâm (Multi-Center Clinical Trial):**
   - Hợp tác mở rộng thử nghiệm lâm sàng tại các bệnh viện chuyên khoa thần kinh và ung bướu trên cả nước để tiếp tục làm giàu tập dữ liệu huấn luyện, nâng cao độ bền vững của mô hình trước các dòng máy chụp và thế hệ phần cứng khác nhau.
