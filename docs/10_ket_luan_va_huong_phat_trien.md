# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 10: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN ĐỀ TÀI

---

## 10.1. TỔNG KẾT CÁC KẾT QUẢ ĐẠT ĐƯỢC

Sau quá trình nghiên cứu, thiết kế kiến trúc và triển khai thực nghiệm, đề tài tốt nghiệp **"NeuroScan AI — Hệ thống Hỗ trợ Chẩn đoán Hình ảnh MRI Não & Quản lý Bệnh viện Đa Cơ sở"** đã hoàn thành xuất sắc 100% các mục tiêu đề ra ban đầu:

1. **Về mặt Nghiệp vụ Y tế và Tính Thực tiễn:**
   - Xóa bỏ triệt để các "nghịch lý phần mềm" phổ biến trong các đồ án sinh viên; hiện thực hóa quy trình khám chữa bệnh bám sát thực tế bệnh viện Việt Nam và các quy định của Bộ Y Tế (Thông tư 46/2018/TT-BYT về EMR).
   - Tích hợp thành công **Bảng kiểm an toàn buồng chụp MRI** 4 tiêu chí sinh mạng, bảo vệ bệnh nhân trước các hiểm họa từ trường; phân định rạch ròi thẩm quyền giữa Bác sĩ khám lâm sàng và Bác sĩ CĐHA ký số; hỗ trợ xử lý nhiễu ảnh (Rescan) và hủy ca an toàn.
   - Chuẩn hóa luồng viện phí đa dạng: Tự chi trả qua VietQR/PayOS, BHYT bảo lãnh đồng chi trả, và diện Cấp cứu ưu tiên chụp trước thu sau.
2. **Về mặt Kỹ thuật Phần mềm & Kiến trúc:**
   - Xây dựng thành công hệ thống theo mô hình **Phân tầng Sạch (Clean Layered Architecture)**: phân tách độc lập giữa Controller, Service và Model, giúp mã nguồn đạt độ bao phủ kiểm thử tự động trên $84\%$.
   - Hiện thực hóa kiến trúc **Đa cơ sở (Multi-Tenancy)** an toàn tuyệt đối, ngăn chặn hoàn toàn rủi ro rò rỉ dữ liệu giữa các bệnh viện.
   - Ứng dụng giải pháp **Hybrid Mini-PACS** kết hợp kỹ thuật **Multer Streaming nhị phân**, giải quyết dứt điểm vấn đề nghẽn mạng và tràn RAM máy chủ khi truyền tải hình ảnh y tế.
   - Triển khai cơ chế khóa nguyên tử (`findOneAndUpdate`) loại bỏ hoàn toàn hiện tượng tranh chấp tài nguyên (Race Condition) trong quản lý buồng giường nội trú.
3. **Về mặt Trí tuệ Nhân tạo:**
   - Ứng dụng thành công **Hệ thống Trọng tài Đồng thuận Đa mô hình (MAICS)** phối hợp bộ 3 mô hình Bayesian CNN Ensemble (ResNet50 + Risk Loss, EfficientNetV2, DenseNet121 + BayTTA), mô hình định vị không gian YOLOv8 và Gemini 3.1 Flash-Lite VLM.
   - Kéo giảm tỷ lệ bỏ sót u ác tính (Fatal False Negative Rate - Glioma thành Không u) xuống chỉ còn **$0.43\%$** (giảm thiểu 49.4% nguy cơ rủi ro lâm sàng), đạt độ chính xác $91.01\%$ và Macro F1 đạt $92.04\%$ trên tập kiểm thử độc lập gồm 3.461 ảnh (có 1.861 ảnh từ Bệnh viện Đa khoa Tâm Trí Đà Nẵng).
   - Tích hợp bộ lọc **Anatomical Privacy Guard** bảo vệ dữ liệu khuôn mặt và giảm $79.5\%$ số lượng cuộc gọi API đám mây, cùng bản đồ kích hoạt trực quan (Grad-CAM Heatmap) mang lại khả năng giải thích lâm sàng rõ ràng (Explainable AI - XAI).
4. **Về mặt Đóng gói và Triển khai:**
   - Đóng gói hoàn chỉnh hệ sinh thái đa dịch vụ (Node.js, Python FastAPI, Expo Web, Nginx, MongoDB) dưới dạng Docker Compose và cung cấp script khởi chạy 1-click tiện lợi.

---

## 10.2. NHỮNG ĐÓNG GÓP MỚI CỦA ĐỒ ÁN

- **Đóng góp về mặt công nghệ:** Đề xuất và chứng minh tính khả thi của mô hình Hybrid Mini-PACS chi phí thấp chạy trên nền Web/Mobile, mở ra cơ hội số hóa hình ảnh y tế cho hàng trăm trung tâm y tế tuyến huyện và phòng khám tư nhân tại Việt Nam mà không cần đầu tư máy chủ PACS tiền tỷ.
- **Đóng góp về mặt học thuật:** Cung cấp tài liệu nghiên cứu chuyên sâu về việc kết hợp giữa quy trình nghiệp vụ y tế nghiêm ngặt (Medical Workflow) và mô hình thị giác máy tính hiện đại (Computer Vision) trong một hệ thống phần mềm hoàn chỉnh từ A đến Z.

---

## 10.3. CÁC HẠN CHẾ HIỆN TẠI

Mặc dù đã đạt được nhiều kết quả ấn tượng, đồ án vẫn còn một số điểm giới hạn cần tiếp tục hoàn thiện trong tương lai:
1. **Phân tích trên lát cắt 2D:** Mô hình AI hiện tại phân tích dựa trên các lát cắt ảnh 2 chiều tiêu biểu (Key Slices) thay vì dựng hình và phân đoạn không gian 3 chiều (3D Volumetric Segmentation) trực tiếp từ khối dữ liệu Voxel của chuỗi ảnh DICOM.
2. **Giao thức kết nối thiết bị:** Hệ thống hiện tiếp nhận ảnh qua cổng Web Upload của KTV, chưa hỗ trợ trực tiếp giao thức mạng DICOM chuyên dụng (DICOM C-STORE SCP) để nhận ảnh trực tiếp từ máy chụp MRI của các hãng Siemens/GE qua mạng nội bộ bệnh viện.

---

## 10.4. HƯỚNG PHÁT TRIỂN TIẾP THEO

Để phát triển NeuroScan AI thành một sản phẩm thương mại đạt chuẩn thiết bị y tế kỹ thuật số (Software as a Medical Device - SaMD), nhóm định hướng mở rộng hệ thống theo các hướng sau:
1. **Nâng cấp Mô hình AI lên Không gian 3D:** Nghiên cứu tích hợp các mô hình phân đoạn 3D tiên tiến như **SAM-Med3D** (Segment Anything in Medical Images 3D) và **nnU-Net** để đo đạc chính xác thể tích khối u não ($mm^3$) và mức độ phù não xâm lấn.
2. **Chuẩn hóa Giao thức DICOMweb:** Bổ sung các chuẩn giao tiếp quốc tế WADO-RS, QIDO-RS và STOW-RS để hệ thống có thể kết nối liền mạch với bất kỳ máy chụp cộng hưởng từ nào theo chuẩn DICOM 3.0.
3. **Liên thông Chuẩn Y tế HL7 / FHIR:** Triển khai API theo chuẩn HL7 FHIR (Fast Healthcare Interoperability Resources) để sẵn sàng kết nối liên thông dữ liệu hồ sơ bệnh án với Cổng tiếp nhận Dữ liệu Giám định BHYT Quốc gia của Bảo hiểm Xã hội Việt Nam.
4. **Công nghệ Ký số Khóa công khai (PKI / USB Token):** Nâng cấp con dấu điện tử hiện tại thành chữ ký số số hóa có chứng thư số được cấp bởi các nhà cung cấp dịch vụ chứng thực chữ ký số công cộng (VNPT-CA, Viettel-CA, FPT-CA) theo quy định của Luật Giao dịch điện tử.
