# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 7: THIẾT KẾ TRẢI NGHIỆM NGƯỜI DÙNG VÀ GIAO DIỆN ĐA NỀN TẢNG (UI/UX DESIGN)

---

## 7.1. NGUYÊN TẮC CÔNG THÁI HỌC VÀ THIẾT KẾ GIAO DIỆN Y TẾ

Thiết kế giao diện phần mềm trong môi trường y tế (Healthcare UX) có những đòi hỏi khắt khe vượt trội so với các ứng dụng thương mại thông thường:
1. **Giảm tải nhận thức (Cognitive Load Reduction):** Bác sĩ và điều dưỡng làm việc dưới áp lực cao và thời gian gấp rút. Mọi thông tin quan trọng (Dị ứng, Chống chỉ định MRI, Tiền sử bệnh, Dấu hiệu sinh tồn) phải được hiển thị nổi bật với màu sắc cảnh báo chuẩn quốc tế (Đỏ: Khẩn cấp/Chống chỉ định, Vàng: Cảnh báo/Chưa thanh toán, Xanh lá: An toàn/Đã duyệt).
2. **Khả năng quan sát hình ảnh tối ưu (Visual Contrast):** Phân hệ đọc phim chẩn đoán hình ảnh hỗ trợ nền tối (Dark Theme / Medical Gray #1e293b) giúp giảm mỏi mắt cho bác sĩ CĐHA khi làm việc trong phòng đọc phim thiếu sáng, tăng độ tương phản của các lát cắt MRI xám trắng.
3. **Thiết kế Đa nền tảng (Universal Cross-Platform):** Xây dựng trên nền **Expo React Native**, hệ thống tự động co giãn thích ứng mượt mà trên cả trình duyệt Web Desktop màn hình lớn của bệnh viện lẫn máy tính bảng iPad/Android của bác sĩ khi đi buồng thăm khám.

---

## 7.2. CHI TIẾT 5 PHÂN HỆ GIAO DIỆN NGƯỜI DÙNG

```
+-------------------------------------------------------------------------+
|                  CỔNG THÔNG TIN Y TẾ NEUROSCAN AI                       |
+-------------------------------------------------------------------------+
| [1. Bác sĩ Khám]    | [2. Kỹ thuật viên]   | [3. Bác sĩ CĐHA]           |
| - Hàng đợi khám     | - Hàng đợi chụp      | - Trạm đọc phim DICOM      |
| - Ra y lệnh MRI     | - Bảng kiểm an toàn  | - Xem kết quả AI gợi ý     |
| - Xếp giường bệnh   | - Tải ảnh cắt lớp    | - Ký số điện tử            |
+---------------------+----------------------+----------------------------+
| [4. Người Bệnh]                            | [5. Quản Trị Viện]         |
| - Xem hồ sơ bệnh án điện tử                | - Quản lý nhân sự & khoa   |
| - Quét mã VietQR thanh toán                | - Cấu hình bảng giá viện   |
+-------------------------------------------------------------------------+
```

### 7.2.1. Phân hệ Bàn làm việc Bác sĩ Khám Lâm sàng (`DoctorWorkQueueScreen.js`)
- **Hàng đợi khám trực quan:** Danh sách bệnh nhân được phân luồng tự động theo thứ tự ưu tiên (`Khẩn cấp` $\rightarrow$ `Ưu tiên` $\rightarrow$ `Thường`).
- **Huy hiệu viện phí đa năng:** Bác sĩ nhận biết tức thì bệnh nhân nào thuộc diện `🟢 BHYT: Đã bảo lãnh` hoặc `🚨 CẤP CỨU: Chụp trước, thu sau`.
- **Ra y lệnh cận lâm sàng 1 chạm:** Chọn gói chụp MRI não, hệ thống tự động tạo hồ sơ ca khám (`cho_chup`) và phát hành hóa đơn viện phí tương ứng.
- **Tiếp nhận kết quả & Xếp giường:** Khi ca chụp hoàn tất và có chữ ký số của Bác sĩ CĐHA, hệ thống hiển thị nút "🛏️ Xếp giường nội trú" mở danh sách buồng giường trống theo khoa để điều chuyển bệnh nhân.

### 7.2.2. Phân hệ Bàn điều khiển Kỹ thuật viên MRI
- **Hàng đợi phòng chụp chuyên dụng:** Hiển thị danh sách các ca chỉ định chụp MRI não trong ngày của cơ sở.
- **Modal Bảng kiểm An toàn MRI (`MriSafetyCheckModal.js`):**
  - Khi KTV nhấn "📸 Bắt đầu Chụp", hệ thống bật modal bắt buộc kiểm tra 4 tiêu chí sinh mạng.
  - Nếu KTV đánh dấu có máy tạo nhịp tim hoặc kim loại: Nút xác nhận lập tức bị vô hiệu hóa, hiển thị cảnh báo chữ đỏ in đậm: *"CẢNH BÁO CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI"*.
  - Chỉ khi xác nhận an toàn, ca khám mới chuyển sang `dang_chup`.
- **Vùng Tải ảnh Chuẩn hóa:**
  - 1 Vùng chọn 1 - 3 ảnh cắt lớp tiêu biểu (.PNG/.JPG) để AI phân tích và xem nhanh Web.
  - 1 Vùng đính kèm gói nén file DICOM gốc (.ZIP) để lưu trữ Mini-PACS dài hạn.
- **Modal Chụp lại (`MriRescanModal.js`) & Hủy ca (`MriCancelModal.js`):** Cho phép KTV xử lý linh hoạt các tình huống bệnh nhân cử động đầu hoặc hoảng loạn buồng kín.

### 7.2.3. Phân hệ Trạm đọc phim Bác sĩ CĐHA (`ImagingResultScreen.js`)
- **Trình xem phim đa chế độ (Dual Viewer):**
  - Cửa sổ trái: Lát cắt MRI sọ não gốc độ phân giải cao.
  - Cửa sổ phải: Kết quả AI YOLOv8 vẽ Bounding Box màu đỏ quanh khối u não, hiển thị nhãn phân loại (`Glioma`, `Meningioma`, `Pituitary`) và độ tin cậy phần trăm kèm Heatmap phân bổ mật độ.
- **Phân định rõ 2 Bác sĩ:** Hiển thị rạch ròi tên Bác sĩ lâm sàng chỉ định khám và vị trí Bác sĩ CĐHA đọc duyệt.
- **Khu vực Con Dấu Ký Số (`DigitalSignatureBadge.js`):**
  - Trạng thái chưa ký: Viền vàng cam `⏳ Đang chờ Bác sĩ CĐHA đọc và ký số`.
  - Sau khi bác sĩ nhập mô tả hình ảnh, kết luận và nhấn "💾 Ký Số & Duyệt Kết Quả": Hệ thống đóng dấu mộc điện tử màu xanh lá:
    ```
    +-----------------------------------------------+
    |  ✓ ĐÃ KÝ SỐ ĐIỆN TỬ BỞI BÁC SĨ CĐHA           |
    |  Người ký: BS. CKI. Nguyễn Văn Quang          |
    |  Thời gian ký: 08/09/2026 09:30:15            |
    |  Chứng chỉ hành nghề: 012345/BYT-CCHN         |
    +-----------------------------------------------+
    ```

### 7.2.4. Phân hệ Cổng thông tin Bệnh nhân (Patient Portal)
- **Hồ sơ sức khỏe cá nhân (PHR):** Bệnh nhân đăng nhập bằng số điện thoại/CCCD để xem toàn bộ lịch sử các lần khám bệnh.
- **Thanh toán Viện phí VietQR:** Quét mã QR động hiển thị trực tiếp trên màn hình, tự động điền số tiền và nội dung chuyển khoản, kích hoạt gạch nợ tức thì qua PayOS Webhook.
- **Xem phim và kết quả trực tuyến:** Xem trực tiếp ảnh MRI đã được AI phân tích và kết luận có dấu ký số của bác sĩ, dễ dàng tải về hoặc chia sẻ khi đi khám tại bệnh viện tuyến trên.

### 7.2.5. Phân hệ Bảng điều khiển Quản trị Bệnh viện (Admin Dashboard)
- Quản lý danh mục nhân viên y tế, tài khoản, chứng chỉ hành nghề.
- Quản lý sơ đồ buồng giường bệnh nội trú theo từng khoa chuyên môn.
- Cấu hình bảng giá dịch vụ khám bệnh, giá chụp MRI và mức đồng chi trả BHYT cho từng cơ sở thuê bao.
