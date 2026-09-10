# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# PHỤ LỤC E: HƯỚNG DẪN SỬ DỤNG 5 PHÂN HỆ NGƯỜI DÙNG (USER MANUAL)
## CẨM NANG VẬN HÀNH LUỒNG LÂM SÀNG KHÉP KÍN TRÊN HỆ THỐNG NEUROSCAN AI

---

## E.1. SƠ ĐỒ PHỐI HỢP TÁC VỤ GIỮA 5 PHÂN HỆ

Hệ thống **NeuroScan AI** số hóa toàn diện quy trình tiếp nhận và chẩn đoán hình ảnh thần kinh sọ não theo chuẩn Bộ Y Tế, liên kết chặt chẽ giữa 5 vai trò người dùng trong bệnh viện:

```
[ BỆNH NHÂN ] 
      │ 1. Đến đăng ký
      ▼
[ 1. TIẾP ĐÓN & BHYT ] ──── Tạo lượt khám ────► [ 2. BÁC SĨ LÂM SÀNG ]
                                                      │
                                                      │ 2. Chỉ định MRI sọ não
                                                      ▼
[ 4. BÁC SĨ CĐHA ] ◄── Duyệt ảnh & Ký số ◄─── [ 3. KỸ THUẬT VIÊN CĐHA ]
      │                                       (Chụp ảnh, nạp Mini-PACS, chạy AI)
      │ 5. Trả kết quả đã ký số
      ▼
[ 2. BÁC SĨ LÂM SÀNG ] ──── Xếp giường nội trú ───► [ KHOA ĐIỀU TRỊ ]
      │
      │ 6. Cấp đơn thuốc / Bệnh án điện tử
      ▼
[ 5. BỆNH NHÂN PORTAL ] (Tra cứu kết quả trực tuyến qua CCCD / QR Code)
```

---

## E.2. PHÂN HỆ 1: TIẾP ĐÓN, ĐĂNG KÝ VÀ KIỂM TRA BHYT
- **Đối tượng sử dụng:** Nhân viên tiếp đón, Điều dưỡng quầy lễ tân bệnh viện.
- **Tài khoản mẫu:** `nurse.tiepdon@hospital.com` (Mật khẩu: `123456`).
- **Màn hình chính:** Giao diện Tiếp đón bệnh nhân (`NurseReceptionScreen`).

### Các bước thao tác chuẩn:
1. **Đăng nhập:** Truy cập `http://localhost:8081`, chọn vai trò *"Tiếp đón / Điều dưỡng"* và đăng nhập.
2. **Tìm kiếm hoặc Đăng ký bệnh nhân mới:**
   - Nhập số Căn cước công dân (CCCD) hoặc Số điện thoại của bệnh nhân vào ô tìm kiếm.
   - Nếu bệnh nhân khám lần đầu: Nhấp **"Đăng ký bệnh nhân mới"**, điền đầy đủ Họ tên, Ngày sinh, Giới tính, Địa chỉ và Số thẻ BHYT (nếu có).
3. **Kiểm tra quyền lợi BHYT:**
   - Hệ thống tự động nhận diện mã đầu thẻ BHYT (ví dụ: `HT2`, `GD4`, `QN1`) để tính mức hưởng BHYT đúng tuyến ($80\%$ hoặc $100\%$).
4. **Tạo Lượt khám bệnh (Visit):**
   - Chọn lý do vào viện (ví dụ: *"Đau đầu kéo dài kèm mờ mắt nghi u nội sọ"*).
   - Chọn Phòng khám lâm sàng đích (ví dụ: *Phòng khám Chuyên khoa Ngoại Thần kinh - PK 201*).
   - Nhấp **"Tiếp nhận bệnh nhân"** $\rightarrow$ Hệ thống tự động sinh Mã lượt khám (ví dụ: `KB-20260908-001`) và đưa bệnh nhân vào danh sách chờ khám của Bác sĩ.

---

## E.3. PHÂN HỆ 2: BÁC SĨ KHÁM LÂM SÀNG
- **Đối tượng sử dụng:** Bác sĩ Chuyên khoa Thần kinh, Bác sĩ Đa khoa.
- **Tài khoản mẫu:** `doctor.noithankinh@hospital.com` (Mật khẩu: `123456`).
- **Màn hình chính:** Hàng đợi khám bệnh (`DoctorWorkQueueScreen`).

### Các bước thao tác chuẩn:
1. **Tiếp nhận ca khám:**
   - Tại màn hình Hàng đợi, bác sĩ thấy danh sách bệnh nhân đang chờ theo thứ tự ưu tiên. Nhấp vào bệnh nhân để mở hồ sơ lâm sàng.
2. **Khám lâm sàng & Ghi nhận triệu chứng:**
   - Khai thác tiền sử bệnh tật, đo dấu hiệu sinh tồn, khám phản xạ thần kinh khu trú.
   - Nhập chẩn đoán sơ bộ ban đầu (ví dụ: *"Theo dõi tổn thương choán chỗ vùng đỉnh thái dương"*).
3. **Chỉ định chụp Cộng hưởng từ (MRI Sọ não):**
   - Nhấp nút **"Chỉ định Chẩn đoán hình ảnh"**, chọn dịch vụ: *"Chụp MRI Sọ não có tiêm thuốc đối quang từ (hoặc không tiêm)"*.
   - Hệ thống tự động sinh hóa đơn viện phí tạm tính:
     * Nếu bệnh nhân BHYT đúng tuyến: Được bảo lãnh thanh toán tự động.
     * Nếu bệnh nhân Viện phí: Sinh trạng thái `chờ thu phí` để bộ phận kế toán xử lý.
4. **Đánh giá Bảng kiểm An toàn MRI sơ bộ:**
   - Bác sĩ phỏng vấn bệnh nhân các câu hỏi sàng lọc ban đầu: Có mang máy tạo nhịp tim không? Có mảnh đạn hoặc van tim kim loại không? Có hội chứng sợ buồng kín (Claustrophobia) không?
   - Nhấp **"Gửi chỉ định sang Khoa CĐHA"** $\rightarrow$ Hồ sơ lập tức chuyển sang máy trạm Kỹ thuật viên chụp.

---

## E.4. PHÂN HỆ 3: KỸ THUẬT VIÊN CHẨN ĐOÁN HÌNH ẢNH (KTV PHÒNG MRI)
- **Đối tượng sử dụng:** Kỹ thuật viên hình ảnh y học tại buồng máy MRI.
- **Tài khoản mẫu:** `ktv.hinhanh@hospital.com` (Mật khẩu: `123456`).
- **Màn hình chính:** Bảng điều khiển Chẩn đoán hình ảnh (`CreateImagingResultScreen`).

### Các bước thao tác chuẩn:
1. **Kiểm tra Hàng chờ chụp & Tình trạng Viện phí:**
   - KTV quan sát danh sách bệnh nhân được chỉ định MRI.
   - Mỗi bệnh nhân hiển thị một trong 4 huy hiệu tài chính rõ ràng:
     * `🚨 CẤP CỨU`: Ưu tiên chụp ngay lập tức (Chế độ chụp trước, thu phí sau).
     * `🟢 BHYT`: Đã được bảo hiểm y tế phê duyệt bảo lãnh.
     * `💳 ĐÃ ĐÓNG PHÍ`: Bệnh nhân tự trả đã hoàn tất nộp tiền tại quầy thu ngân.
     * `⚠️ CHƯA ĐÓNG PHÍ`: Cần hướng dẫn bệnh nhân nộp viện phí trước khi đưa vào buồng chụp.
2. **Duyệt Bảng kiểm An toàn buồng chụp MRI (Bắt buộc):**
   - KTV kiểm tra 4 tiêu chí an toàn trước cửa phòng máy từ lực cao 1.5T / 3.0T:
     * Tiêu chí 1: Không mang máy tạo nhịp tim (Pacemaker) hoặc cấy ghép ốc tai điện tử.
     * Tiêu chí 2: Không có dị vật kim loại từ tính trong sọ hoặc ổ mắt.
     * Tiêu chí 3: Chức năng thận eGFR $\ge 30\,\text{ml/phút}$ (đối với ca có tiêm chất đối quang từ Gadolinium).
     * Tiêu chí 4: Tháo bỏ toàn bộ đồ trang sức, điện thoại, thẻ từ ngân hàng.
   - > **LƯU Ý NGUYÊN TẮC AN TOÀN:** Nếu KTV tích chọn *"Bệnh nhân có máy tạo nhịp tim"*, hệ thống sẽ **CHẶN TUYỆT ĐỐI (HTTP 400)** không cho chuyển trạng thái sang chụp, ngăn ngừa nguy cơ tử vong do từ trường mạnh.
3. **Thực hiện chụp & Tải dữ liệu lên Mini-PACS:**
   - KTV chọn file ảnh tải lên theo mô hình Hybrid:
     * **Vùng 1 (Bắt buộc):** 1 – 3 ảnh lát cắt MRI tiêu biểu định dạng `.jpg` hoặc `.png`. Hệ thống truyền trực tiếp qua Multer Stream để AI phân tích tức thì.
     * **Vùng 2 (Tùy chọn):** 1 file nén trọn bộ DICOM `.zip` (dung lượng tối đa 200MB) để lưu trữ dài hạn phục vụ hội đồng chuyên môn.
4. **Theo dõi AI Tiền chẩn đoán (AI Inference):**
   - Ngay sau khi ảnh được tải lên, AI Engine (YOLOv8) tự động chạy suy luận ngầm trong vòng 2 giây:
     * Tự động khoanh vùng tổn thương (Bounding Box màu đỏ/cam).
     * Phân loại tổn thương: Glioma, Meningioma, Pituitary hoặc No Tumor.
     * Tính toán chỉ số tin cậy (Confidence Score, ví dụ: $94.8\%$).
5. **Xử lý các tình huống ngoại lệ:**
   - *Nếu ảnh bị nhòe do bệnh nhân cử động đầu:* KTV nhấp **"Yêu cầu Chụp lại (Rescan)"**, nhập lý do lâm sàng $\rightarrow$ Ca khám chuyển sang trạng thái `cho_chup_lai`.
   - *Nếu bệnh nhân hoảng loạn buồng kín:* Nhấp **"Hủy ca chụp"**, nhập lý do lâm sàng $\rightarrow$ Ca khám chuyển sang trạng thái `da_huy`, giải phóng máy chụp cho ca tiếp theo.

---

## E.5. PHÂN HỆ 4: BÁC SĨ CHẨN ĐOÁN HÌNH ẢNH (ĐỌC DUYỆT & KÝ SỐ)
- **Đối tượng sử dụng:** Bác sĩ Chẩn đoán hình ảnh chuyên sâu về Thần kinh sọ não.
- **Tài khoản mẫu:** `radiologist.khoacda@hospital.com` (Mật khẩu: `123456`).
- **Màn hình chính:** Trạm duyệt phim và kết quả CĐHA (`ImagingResultScreen`).

### Các bước thao tác chuẩn:
1. **Mở phim chụp và Soi chiếu AI:**
   - Bác sĩ CĐHA mở ca chụp đang ở trạng thái `chờ duyệt kết quả`.
   - Màn hình hiển thị song song ảnh chụp gốc và ảnh có lớp phủ Bounding Box / Heatmap của AI.
   - Có thể nhấp nút **"Tải trọn bộ DICOM gốc (.zip)"** để mở trên các phần mềm máy trạm chuyên dụng (RadiAnt DICOM Viewer, Horos, 3D Slicer) khi cần dựng hình 3D.
2. **Hiệu chỉnh mô tả và Đưa ra kết luận chuyên môn:**
   - Bác sĩ đọc kỹ mô tả tự động do Gemini AI gợi ý, chỉnh sửa lại các thông số kích thước khối u (dài x rộng x cao tính theo mm), mức độ phù não xung quanh và hiệu ứng choán chỗ đường giữa.
   - Nhập chẩn đoán xác định của Bác sĩ CĐHA.
3. **Thực hiện KÝ DUYỆT SỐ ĐIỆN TỬ (Digital Signature):**
   - Nhấp nút **"Xác nhận & Ký duyệt số điện tử"**.
   - Hệ thống tự động đóng dấu số điện tử:
     * Gắn nhãn chứng thực: **✓ ĐÃ KÝ SỐ ĐIỆN TỬ BỞI BÁC SĨ CĐHA**.
     * Ghi nhận định danh Bác sĩ, mã chứng thư và thời gian ký chính xác đến từng giây.
     * Khóa vĩnh viễn kết quả hình ảnh để chống chỉnh sửa trái phép theo quy định Bệnh án điện tử của Bộ Y Tế.
     * Tự động đồng bộ kết quả về hồ sơ của Bác sĩ Lâm sàng và Cổng bệnh nhân.

---

## E.6. PHÂN HỆ 5: BÁC SĨ LÂM SÀNG RA PHÁC ĐỒ & XẾP GIƯỜNG NỘI TRÚ
- **Đối tượng sử dụng:** Bác sĩ điều trị.
- **Màn hình chính:** Hồ sơ bệnh án điện tử (`EMRDashboardScreen`, `PatientDetailScreen`).

### Các bước thao tác chuẩn:
1. **Tiếp nhận kết quả:** Bác sĩ nhận thông báo ca khám đã có kết quả CĐHA kèm con dấu ký số điện tử hợp lệ.
2. **Kê đơn thuốc điều trị ngoại trú:**
   - Nếu bệnh nhân không cần phẫu thuật/nằm viện: Nhấp **"Kê đơn thuốc"**, chọn thuốc từ danh mục dược quốc gia, nhập liều lượng, cách dùng và in đơn thuốc điện tử có mã QR.
3. **Quyết định Nhập viện & Xếp giường nội trú (Atomic Bed Allocation):**
   - Nếu phát hiện u não cần theo dõi phẫu thuật: Nhấp **"Chỉ định Nhập viện"**.
   - Chọn Khoa phòng điều trị (ví dụ: *Khoa Phẫu thuật Thần kinh - Tầng 4*).
   - Chọn Buồng bệnh và Giường bệnh trống trong danh sách sơ đồ trực quan.
   - Nhấp **"Xác nhận giữ giường & Nhập viện"**:
     * Hệ thống áp dụng cơ chế khóa nguyên tử trên MongoDB (`findOneAndUpdate`), đảm bảo nếu có bác sĩ khác cùng thao tác giữ giường đó trong cùng 1 tích tắc, người bấm sau sẽ nhận thông báo lỗi xung đột `409 Conflict: Giường này vừa được đồng nghiệp giữ chỗ`. Hoàn toàn loại bỏ $100\%$ nguy cơ tranh chấp giường bệnh nội trú.

---

## E.7. PHÂN HỆ 6: BỆNH NHÂN TRA CỨU HỒ SƠ TRỰC TUYẾN (PATIENT PORTAL)
- **Đối tượng sử dụng:** Bệnh nhân hoặc người nhà bệnh nhân.
- **Tài khoản mẫu:** `benhnhan.test@gmail.com` (Mật khẩu: `123456`).
- **Màn hình chính:** Tra cứu hồ sơ bệnh án (`PatientRecordsScreen`, `WelcomeScreen`).

### Các bước thao tác chuẩn:
1. **Tra cứu nhanh:**
   - Trên màn hình chào đón, người bệnh có thể chọn phương thức:
     * Nhập số CCCD / Mã số định danh y tế cá nhân.
     * Hoặc quét mã QR trên phiếu tiếp nhận khám bệnh.
2. **Xem Hồ sơ Sức khỏe:**
   - Xem toàn bộ lịch sử các lần khám chữa bệnh tại các cơ sở liên thông.
   - Xem ảnh chụp MRI não trực quan ngay trên điện thoại hoặc trình duyệt máy tính.
   - Đọc kết luận chẩn đoán đã ký số của Bác sĩ Chẩn đoán hình ảnh.
   - Xem hướng dẫn dùng thuốc và lịch hẹn tái khám.
3. **Tải dữ liệu:** Người bệnh có thể nhấp **"Tải kết quả chẩn đoán (.pdf)"** hoặc tải ảnh MRI về lưu trữ trên hồ sơ sức khỏe cá nhân.
