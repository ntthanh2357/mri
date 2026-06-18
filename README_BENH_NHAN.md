# Luồng Bệnh Nhân — Kho Hồ Sơ Sức Khỏe Cá Nhân

## Mục đích

Kho lưu trữ cá nhân để bệnh nhân **giữ các bản sao tài liệu nhận được từ bệnh viện** sau mỗi lần khám hoặc điều trị. Hệ thống này **song song** với EMR của bệnh viện, **không thay thế** quy trình khám chữa bệnh.

Giá trị chính: gộp dữ liệu từ **nhiều cơ sở y tế** vào một nơi duy nhất, phục vụ tái khám, chuyển viện, làm thủ tục BHXH/BHYT và theo dõi sức khỏe dài hạn.

---

## Khóa định danh

Mỗi bệnh nhân có một hồ sơ gốc gắn với:

- **CCCD** (khóa chính cho phía người dùng)
- **Mã y tế** (do từng BV cấp — có thể có nhiều mã ở nhiều BV)
- **Số BHYT**
- **Họ tên · Ngày sinh · Giới tính · Địa chỉ · Số điện thoại**

Mỗi lần đến viện = **một lượt khám/điều trị**, được gom nhóm theo:

- Ngày khám
- Cơ sở y tế
- Loại lượt (ngoại trú / nội trú)

---

## Cấu trúc tài liệu lưu trữ

Bệnh nhân lưu **12 loại tài liệu** thuộc 4 nhóm. Hai loại tài liệu nội bộ của BV (phiếu chăm sóc, biên bản hội chẩn) không được phát cho bệnh nhân và không có trong kho cá nhân.

### Nhóm 1 — Hành chính & tài chính

Bệnh nhân giữ bản gốc hoặc bản scan.

| Tài liệu | Tên file mẫu | Khi nào nhận |
|---|---|---|
| Phiếu thông tin khám bệnh | `mẫu_khám_bệnh` | Khi đăng ký khám |
| Phiếu thu viện phí | `phieu_thu_viện_phí` | Mỗi lần thanh toán |
| Tóm tắt hồ sơ bệnh án | `tóm_tắt_hồ_sơ_bệnh_án` | Khi BN làm đơn xin |

### Nhóm 2 — Lâm sàng (nhận từ bác sĩ)

Bản BN giữ — phục vụ tái khám, chuyển viện.

| Tài liệu | Tên file mẫu | Khi nào nhận |
|---|---|---|
| Phiếu chỉ định dịch vụ | `phiếu_chỉ_định_dịch_vụ` | Khi BS chỉ định XN/CĐHA |
| Toa thuốc | `toa_thuốc` | Khi kết thúc khám/điều trị (cả ngoại trú và nội trú) |
| Giấy ra viện | `mẫu_giấy_ra_viện` | Khi xuất viện |
| Phiếu chuyển tuyến TT01 | `chuyển_tuyến_TT01` | Khi được chuyển sang BV khác |

### Nhóm 3 — Cận lâm sàng

BN nhận bản in / phim / file PDF.

| Tài liệu | Tên file mẫu | Định dạng |
|---|---|---|
| Kết quả xét nghiệm huyết học | `phiếu_kết_quả_xét_nghiệm_máu` | PDF / bản in |
| Kết quả hóa sinh máu | `hóa_sinh` | PDF / bản in |
| Kết quả CT-Scan | `CT-Scan_` | Phim + kết luận |
| Kết quả MRI | `mri` | Phim + kết luận |

### Nhóm 5 — Pháp lý / có chữ ký

BN giữ bản đã ký.

| Tài liệu | Tên file mẫu | Khi nào nhận |
|---|---|---|
| Giấy cam kết chấp thuận phẫu thuật | `cam_đoan_phẫu_thuật` | Trước khi mổ |

---

## Quy trình lưu trữ

```
Bệnh nhân đến viện
   ↓
Nhận tài liệu (theo từng bước khám/điều trị)
   ↓
Mỗi tài liệu → gắn metadata (ngày, BV, loại, lượt khám)
   ↓
Lưu vào kho cá nhân (theo nhóm 1/2/3/5)
   ↓
Tra cứu khi cần (tái khám, chuyển viện, BHYT, theo dõi)
```

### Mỗi tài liệu khi lưu cần có

- Ảnh chụp / file PDF của bản gốc
- Ngày phát hành
- Cơ sở y tế phát hành
- Loại tài liệu (nhóm + tên)
- Mã y tế / số bệnh án (nếu có)
- Bác sĩ ký (nếu có)
- Liên kết với lượt khám/điều trị tương ứng

---

## Khác biệt so với EMR của bệnh viện

| Tiêu chí | Kho cá nhân BN | EMR bệnh viện |
|---|---|---|
| Mục đích | Theo dõi sức khỏe cá nhân | Vận hành khám chữa bệnh |
| Khóa chính | CCCD + Mã y tế | Mã y tế + SBA |
| Phạm vi | Một cá nhân, nhiều BV | Tất cả BN tại một BV |
| Tài liệu nội bộ BV | Không có | Có (phiếu chăm sóc, hội chẩn) |
| Định dạng | Bản scan/PDF người dùng tải lên | Dữ liệu gốc nhập từ phần mềm |

---

## Phạm vi không hỗ trợ

- Không thay thế EMR của bệnh viện
- Không kê toa, không chẩn đoán
- Không lưu phiếu chăm sóc điều dưỡng (`phiếu_chăm_sóc_cấp_1_2_3`) — đây là tài liệu nội bộ BV
- Không lưu biên bản hội chẩn (`hội_chẩn`) — đây là tài liệu nội bộ BV. BN có thể xin tóm tắt HSBA nếu cần
