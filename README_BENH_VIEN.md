# Luồng Bác Sĩ B2B — Hệ Thống EMR & Cloud PACS NeuroScan AI

## 1. Mục đích
Phân hệ B2B của **NeuroScan AI** cung cấp giải pháp Bệnh án điện tử (EMR) và lưu trữ hình ảnh y tế đám mây (Cloud PACS) dành cho các phòng khám, trung tâm y khoa vừa và nhỏ. Hệ thống giúp tối ưu hóa việc quản lý hồ sơ lâm sàng, cận lâm sàng, theo dõi sinh hiệu và chẩn đoán hình ảnh một cách thống nhất và khoa học.

---

## 2. Bảo mật thông tin bệnh nhân (Không lưu CCCD & BHYT)
Tuân thủ nghiêm ngặt các quy định về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP):
* **Định danh hồ sơ**: Hệ thống quản lý bệnh án dựa hoàn toàn vào khóa chính **Mã y tế (Medical ID)** kết hợp với **Họ và tên**, **Năm sinh** và **Số điện thoại**.
* **Loại bỏ dữ liệu nhạy cảm**: Biểu mẫu số hóa trong EMR hoàn toàn loại bỏ các trường thông tin số định danh CCCD/CMND và số thẻ BHYT để phòng ngừa nguy cơ rò rỉ dữ liệu cá nhân y tế nhạy cảm.

---

## 3. Hệ thống vai trò & Cơ chế phân công chống lộn xộn dữ liệu
Để đảm bảo vận hành nhịp nhàng và tránh việc các tài liệu bị chồng chéo hoặc hiển thị lộn xộn, hệ thống áp dụng cơ chế phân quyền và phân công cụ thể:

### 3.1 Bảng phân vai nhiệm vụ trong B2B
| Vai trò | Nhiệm vụ chính | Phạm vi quyền hạn |
|---|---|---|
| **Bác sĩ phụ trách lâm sàng** | Khám bệnh, chẩn đoán, kê đơn, hội chẩn | Toàn quyền đọc/ghi hồ sơ bệnh án của bệnh nhân được phân công; ký duyệt trạng thái hồ sơ. |
| **Bác sĩ chẩn đoán hình ảnh** | Đọc kết quả phim chụp MRI/CT | Đọc/ghi kết luận hình ảnh y khoa, tải phim ảnh lên hệ thống PACS. |
| **Kỹ thuật viên phòng máy** | Thực hiện xét nghiệm máu, chụp phim | Ghi nhận các chỉ số xét nghiệm huyết học/hóa sinh và kết quả hình ảnh thô từ máy. |
| **Điều dưỡng** | Chăm sóc bệnh nhân nội trú, theo dõi sinh hiệu | Ghi phiếu chăm sóc điều dưỡng, cập nhật các chỉ số sinh hiệu mạch, HA, nhiệt độ, SpO₂. |
| **Tiếp tân** | Tiếp đón, khởi tạo lượt khám, phân phòng | Tạo mới bệnh án EMR, cập nhật thông tin hành chính cơ bản và phân công bác sĩ phụ trách. |
| **Quản trị viên (Admin)** | Quản lý hệ thống, phê duyệt tài khoản bác sĩ | Duyệt CCHN của bác sĩ đăng ký mới thông qua `licenseUrl`; kiểm soát nhật ký bảo mật Audit Log. |

### 3.2 Luồng phân công công việc tuần tự
1. **Tiếp tiếp nhận & Phân phòng (Tiếp tân thực hiện)**:
   - Tiếp tân tạo phiếu khám bệnh (`mẫu-khám-bệnh.docx`), điền thông tin hành chính cơ bản (Họ tên, SĐT, Tuổi, Giới tính).
   - Tiếp tân thực hiện **Chỉ định Bác sĩ phụ trách lâm sàng (Doctor In Charge)** cho bệnh nhân: `MedicalRecord.doctorInCharge = doctorId`.
   - **Chống lộn xộn**: Bệnh nhân này sẽ chỉ xuất hiện trên danh sách công việc của Bác sĩ được phân công phụ trách. Các bác sĩ phòng khám khác sẽ không thấy bệnh nhân này hiển thị ở hàng chờ của họ.
2. **Chỉ định cận lâm sàng (Bác sĩ phụ trách thực hiện)**:
   - Bác sĩ điều trị khám lâm sàng và phát hành Phiếu chỉ định dịch vụ (`phiếu-chỉ-định-dịch-vụ.docx`).
   - Chỉ định phòng chụp MRI/CT hoặc phòng xét nghiệm máu. Yêu cầu tự động xuất hiện trên hàng chờ công việc của Kỹ thuật viên/Bác sĩ CĐHA phụ trách phòng đó.
3. **Phân công chăm sóc nội trú (Điều dưỡng trưởng thực hiện)**:
   - Khi bệnh nhân nhập viện điều trị nội trú, Điều dưỡng trưởng phân công cụ thể **Điều dưỡng phụ trách (Assigned Nurse)** chịu trách nhiệm theo dõi.
   - Điều dưỡng được phân công sẽ thực hiện cập nhật diễn biến chăm sóc vào `CareSheet.nurse = nurseId`.

---

## 4. Cấu trúc lưu trữ 14 loại tài liệu EMR bệnh viện
EMR lưu trữ đầy đủ **14 loại tài liệu** thuộc 5 nhóm y khoa, bao gồm 12 tài liệu của bệnh nhân cộng với 2 tài liệu nghiệp vụ nội bộ phòng khám:

### Nhóm 1 — Hành chính & tài chính
* **Phiếu thông tin khám bệnh** (`mẫu-khám-bệnh.docx`): Khởi tạo bệnh án hành chính.
* **Phiếu thu viện phí** (`phieu-thu-viện-phí.docx`): Quản lý thanh toán viện phí của ca bệnh.
* **Tóm tắt hồ sơ bệnh án** (`tóm tắt hồ sơ bệnh án.docx`): Bản tóm tắt diễn biến lâm sàng cung cấp cho bệnh nhân.

### Nhóm 2 — Lâm sàng (Do bác sĩ tạo)
* **Phiếu chỉ định dịch vụ** (`phiếu-chỉ-định-dịch-vụ.docx`): Chỉ định cận lâm sàng.
* **Toa thuốc điều trị** (`toa-thuốc.docx`): Đơn thuốc điều trị ngoại trú/nội trú của bệnh nhân.
* **Giấy ra viện** (`mẫu giấy ra viện.docx`): Xác nhận hoàn thành đợt điều trị và xuất viện.
* **Phiếu chuyển tuyến** (`chuyển_tuyến_TT01.docx`): Hồ sơ chuyển viện.

### Nhóm 3 — Cận lâm sàng (Từ kỹ thuật viên/bác sĩ phòng máy)
* **Phiếu kết quả xét nghiệm huyết học** (`phiếu-kết-quả-xét-nghiệm-máu.docx`): Các chỉ số tế bào máu.
* **Phiếu xét nghiệm hóa sinh máu** (`hóa sinh.docx`): Chỉ số Glucose, AST, ALT, Creatinin, Urê...
* **Kết quả hình ảnh CT-Scan** (`CT-Scan .docx`): Kết luận chụp CT-Scan kèm hình ảnh.
* **Kết quả hình ảnh MRI** (`mri.docx`): Kết luận chụp cộng hưởng từ kèm hình ảnh.

### Nhóm 4 — Điều dưỡng (Nội bộ B2B)
* **Phiếu theo dõi và chăm sóc cấp 1/2/3** (`phiếu chăm sóc cấp 1, 2, 3.docx`): Ghi nhận diễn biến chăm sóc, sinh hiệu (mạch, HA, nhiệt độ, SpO₂) theo ca của điều dưỡng phụ trách.

### Nhóm 5 — Pháp lý & Chuyên môn
* **Giấy cam kết chấp thuận phẫu thuật** (`cam đoan phẫu thuật.docx`): Bản cam kết phẫu thuật/thủ thuật có chữ ký xác thực điện tử của bác sĩ phẫu thuật, bác sĩ gây mê và bệnh nhân/người nhà.
* **Biên bản hội chẩn** (`hội chẩn.docx` - Nội bộ B2B): Biên bản thảo luận, kết luận điều trị của hội đồng bác sĩ chuyên khoa.

---

## 5. Quy trình nhập liệu song song: Quét tự động & Nhập thủ công
Nhân viên y tế có thể đẩy dữ liệu biểu mẫu lên hệ thống bằng hai cách độc lập hoặc bổ trợ nhau trên giao diện EMR:

### 5.1 Quét tự động (OCR & Form Parser)
* Nhân viên tải ảnh chụp giấy tờ lâm sàng hoặc kết quả xét nghiệm máu/phim chụp lên.
* Bộ OCR quét hình ảnh, tự động trích xuất các chỉ số xét nghiệm và kết luận y khoa điền vào biểu mẫu điện tử. Các số CCCD/BHYT nếu hiển thị trên phiếu gốc sẽ bị hệ thống tự động lọc bỏ (strip), không lưu trữ.
* Nhân viên y tế kiểm tra lại độ chính xác trên màn hình trước khi nhấn lưu.

### 5.2 Nhập thủ công (Manual Input Form)
* Nhân viên y tế trực tiếp gõ thông tin chẩn đoán, toa thuốc, chỉ số sinh hiệu vào các trường của biểu mẫu y tế trên màn hình Portal.
* Phương thức này đảm bảo dữ liệu luôn được ghi nhận chính xác và linh hoạt khi không có sẵn tệp ảnh quét sạch nét.

---

## 6. Trạng thái phê duyệt bệnh án (signStatus)
Bệnh án điện tử được kiểm soát vòng đời nghiêm ngặt thông qua trường trạng thái ký duyệt trong database:
1. `Chưa duyệt` (Draft): Bệnh án đang trong quá trình khám và điều trị, bác sĩ điều trị liên tục cập nhật.
2. `Đã duyệt` (Approved): Bác sĩ hoàn thành bệnh án và xác nhận thông tin chẩn đoán khoa học.
3. `Đã ký số` (Signed): Hồ sơ được đóng băng, ký xác nhận bằng chữ ký số chuyên môn của bác sĩ phụ trách và Trưởng khoa/Ban giám đốc để lưu trữ hồ sơ chính thức.
