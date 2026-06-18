# Luồng Bệnh Nhân B2C — Sổ Sức Khỏe Đám Mây Di Động NeuroScan AI

## 1. Mục đích
Phân hệ B2C của **NeuroScan AI** đóng vai trò là một "sổ sức khỏe hình ảnh đám mây di động" dành riêng cho bệnh nhân. Hệ thống này giúp bệnh nhân **lưu trữ dài hạn và số hóa thông tin từ các tài liệu/phim chụp bản cứng** nhận được từ các cơ sở khám chữa bệnh khác nhau để theo dõi tiến triển bệnh lý cá nhân và chia sẻ liên viện dễ dàng.

> [!NOTE]
> Phân hệ này hoạt động song song với hệ thống bệnh án điện tử (EMR) của phòng khám/bệnh viện. Dữ liệu y tế ở đây do bệnh nhân tự chủ và tự quản lý, không thay thế trực tiếp quy trình chẩn đoán y khoa chính thức.

---

## 2. Bảo mật & Định danh an toàn (Không dùng CCCD & BHYT)
Để đảm bảo an toàn tuyệt đối thông tin nhạy cảm của người bệnh và tuân thủ các quy định về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP):
* **Định danh chính**: Tài khoản bệnh nhân liên kết qua **Số điện thoại (đã mã hóa hash trong database)**, **Email** và **Họ tên**.
* **Định danh y khoa**: Liên kết hồ sơ khám chữa bệnh thông qua **Mã y tế (Medical ID)** được cấp bởi mỗi cơ sở y tế khi khám bệnh.
* **Loại bỏ dữ liệu nhạy cảm**: Hệ thống hoàn toàn không lưu trữ số CCCD/CMND hay số thẻ BHYT để loại bỏ rủi ro pháp lý.

---

## 3. Cấu trúc 12 loại tài liệu B2C (Kho cá nhân Bệnh nhân)
Bệnh nhân có quyền upload và quản lý **12 loại giấy tờ** thuộc 4 nhóm chính, tương ứng với biểu mẫu `.docx` thực tế trong dự án:

### Nhóm 1 — Hành chính & tài chính
| Tài liệu | Tên file mẫu .docx tương ứng | Chức năng lưu trữ |
|---|---|---|
| Phiếu thông tin khám bệnh | `mẫu-khám-bệnh.docx` | Lưu lại thông tin phòng khám ban đầu, thời gian tiếp nhận. |
| Phiếu thu viện phí | `phieu-thu-viện-phí.docx` | Lưu hóa đơn/biên lai thanh toán số để theo dõi chi phí điều trị. |
| Tóm tắt hồ sơ bệnh án | `tóm tắt hồ sơ bệnh án.docx` | Giấy đề nghị/bản tóm tắt bệnh án do bệnh viện cung cấp khi kết thúc đợt điều trị. |

### Nhóm 2 — Lâm sàng (Do bác sĩ cung cấp)
| Tài liệu | Tên file mẫu .docx tương ứng | Chức năng lưu trữ |
|---|---|---|
| Phiếu chỉ định dịch vụ | `phiếu-chỉ-định-dịch-vụ.docx` | Lưu phiếu yêu cầu xét nghiệm máu hoặc chẩn đoán hình ảnh (MRI/CT). |
| Toa thuốc điều trị | `toa-thuốc.docx` | Đơn thuốc ngoại trú hoặc nội trú, dùng để đối chiếu liều lượng uống. |
| Giấy ra viện | `mẫu giấy ra viện.docx` | Ghi nhận thời gian nằm viện, chẩn đoán ra viện và hướng dẫn điều trị. |
| Phiếu chuyển tuyến | `chuyển_tuyến_TT01.docx` | Giấy giới thiệu chuyển viện bảo hiểm y tế phục vụ chuyển tuyến. |

### Nhóm 3 — Cận lâm sàng (Kết quả xét nghiệm & hình ảnh)
| Tài liệu | Tên file mẫu .docx tương ứng | Chức năng lưu trữ |
|---|---|---|
| Phiếu xét nghiệm máu | `phiếu-kết-quả-xét-nghiệm-máu.docx` | Lưu các chỉ số tế bào máu ngoại vi (Huyết học). |
| Kết quả hóa sinh máu | `hóa sinh.docx` | Lưu các chỉ số hóa sinh (Glucose, AST, ALT, Creatinin, Urê...). |
| Kết quả CT-Scan | `CT-Scan .docx` | Lưu ảnh chụp cắt lớp sọ não kèm theo mô tả và kết luận của bác sĩ. |
| Kết quả MRI | `mri.docx` | Lưu ảnh chụp cộng hưởng từ sọ não kèm theo mô tả và kết luận của bác sĩ. |

### Nhóm 5 — Pháp lý & Đồng thuận
| Tài liệu | Tên file mẫu .docx tương ứng | Chức năng lưu trữ |
|---|---|---|
| Cam kết phẫu thuật | `cam đoan phẫu thuật.docx` | Bản giấy cam kết chấp thuận phẫu thuật, thủ thuật và gây mê hồi sức đã ký. |

> [!WARNING]
> Hai biểu mẫu nội bộ phục vụ chuyên môn của bệnh viện là **Phiếu chăm sóc điều dưỡng** (`phiếu chăm sóc cấp 1, 2, 3.docx`) và **Biên bản hội chẩn** (`hội chẩn.docx`) sẽ không hiển thị tại phân hệ B2C của bệnh nhân.

---

## 4. Quy trình số hóa tự động & Nhập liệu song song

Để tạo lập một lượt khám mới (`Visit`), bệnh nhân thực hiện qua luồng sau:

```
[Chọn Tạo lượt khám] ──► [Nhập: Bệnh viện, Ngày khám, Bác sĩ khám]
                                     │
                                     ▼
        ┌────────────────────────────┴───────────────────────────┐
        ▼                                                        ▼
[Cách 1: Quét tự động (OCR)]                             [Cách 2: Nhập thủ công]
  - Tải ảnh chụp/PDF giấy tờ.                             - Tự gõ thông tin đơn thuốc,
  - OCR đọc text & tự điền trường dữ liệu.                 chỉ số xét nghiệm vào biểu mẫu.
  - Tự động lọc bỏ các trường CCCD/BHYT.                         │
        │                                                        │
        └────────────────────────────┬───────────────────────────┘
                                     ▼
                        [Bệnh nhân duyệt & Lưu kho]
```

### 4.1 Quét tự động (OCR & Form Parser)
1. Bệnh nhân tải ảnh chụp phim/giấy kết quả hoặc tệp PDF lên phân hệ di động.
2. Hệ thống chạy công cụ quét OCR để bóc tách văn bản thô.
3. Bộ lọc dữ liệu (Parser) tự động tìm kiếm các chỉ số xét nghiệm, chẩn đoán, toa thuốc để điền (Auto-fill) vào form:
   - *Ví dụ*: Bóc tách chỉ số `Glucose: 5.2 mmol/L` điền vào bảng kết quả hóa sinh máu; bóc tách `Meningioma` điền vào chẩn đoán hình ảnh.
4. Hệ thống tự động phát hiện và xóa bỏ (strip) các thông tin nhạy cảm như CCCD/BHYT trước khi hiển thị form xác nhận.

### 4.2 Nhập thủ công (Manual Input)
Trường hợp ảnh chụp mờ hoặc bệnh nhân muốn tự cập nhật, ứng dụng cung cấp giao diện nhập tay trực quan để điền chẩn đoán, toa thuốc và các chỉ số sinh hiệu.

---

## 5. Cơ chế chia sẻ QR liên viện
* Khi bệnh nhân đến tái khám hoặc chuyển sang cơ sở y tế mới, bệnh nhân chỉ cần nhấn **"Tạo mã QR chia sẻ"**.
* Bác sĩ tại cơ sở y tế mới quét mã QR này bằng điện thoại/máy tính để truy xuất toàn bộ 12 tài liệu y tế đã được số hóa rõ nét và sắp xếp khoa học, giúp tiết kiệm thời gian và loại bỏ rủi ro thất lạc phim ảnh.
