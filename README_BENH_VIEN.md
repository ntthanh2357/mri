# Luồng Bệnh Viện — Hệ Thống EMR Lưu Trữ Hồ Sơ Bệnh Án

## Mục đích

Hệ thống lưu trữ điện tử (EMR — Electronic Medical Record) phục vụ **vận hành khám chữa bệnh** tại Bệnh viện Đa khoa Đà Nẵng. Tích hợp với phần mềm quản lý bệnh viện FPT.eHospital.

Hệ thống lưu **toàn bộ hồ sơ bệnh án (HSBA)** của mọi bệnh nhân đến khám/điều trị, phục vụ tra cứu, tái khám, quyết toán BHYT và thống kê y tế theo quy định của Bộ Y tế.

---

## Khóa định danh

Mỗi HSBA gắn với:

- **Mã y tế** (do BV cấp)
- **Số hồ sơ** / **Số bệnh án (SBA)**
- **Số BHYT** (nếu có)
- **Họ tên · Ngày sinh · Giới tính · Địa chỉ · Số điện thoại**

Mỗi lần BN đến viện = **một lượt khám/điều trị**, liên kết với HSBA qua:

- Mã y tế + SBA + thời gian
- Loại lượt (ngoại trú / nội trú / cấp cứu)
- Khoa tiếp nhận / khoa điều trị
- Đối tượng thanh toán (BHYT / thu phí)

---

## Cấu trúc tài liệu lưu trữ

EMR lưu **14 loại tài liệu** thuộc 5 nhóm. Bao gồm tất cả tài liệu BN nhận được **cộng với** các tài liệu nội bộ phục vụ vận hành.

### Nhóm 1 — Hành chính & tài chính

Phòng kế hoạch tổng hợp · Phòng tài vụ lưu trữ.

| Tài liệu | Tên file mẫu | Tạo bởi |
|---|---|---|
| Phiếu thông tin khám bệnh | `mẫu_khám_bệnh` | Tiếp tân |
| Phiếu thu viện phí | `phieu_thu_viện_phí` | Phòng tài vụ |
| Tóm tắt hồ sơ bệnh án | `tóm_tắt_hồ_sơ_bệnh_án` | Phòng kế hoạch tổng hợp (khi BN xin) |

### Nhóm 2 — Lâm sàng (do bác sĩ tạo)

Khoa khám / khoa điều trị lưu trữ.

| Tài liệu | Tên file mẫu | Tạo bởi |
|---|---|---|
| Phiếu chỉ định dịch vụ | `phiếu_chỉ_định_dịch_vụ` | Bác sĩ khám |
| Toa thuốc (ngoại trú & nội trú) | `toa_thuốc` | Bác sĩ điều trị |
| Giấy ra viện | `mẫu_giấy_ra_viện` | Bác sĩ điều trị + Trưởng khoa |
| Phiếu chuyển tuyến TT01 | `chuyển_tuyến_TT01` | Bác sĩ điều trị + Ban giám đốc |

### Nhóm 3 — Cận lâm sàng

Khoa xét nghiệm + khoa CĐHA tạo, gửi vào EMR.

| Tài liệu | Tên file mẫu | Tạo bởi |
|---|---|---|
| Phiếu kết quả XN huyết học | `phiếu_kết_quả_xét_nghiệm_máu` | KTV xét nghiệm + BS đọc |
| Phiếu hóa sinh máu | `hóa_sinh` | KTV xét nghiệm + BS đọc |
| Kết quả CT-Scan | `CT-Scan_` | KTV CĐHA + BS chuyên khoa CĐHA |
| Kết quả MRI | `mri` | KTV CĐHA + BS chuyên khoa CĐHA |

Hình ảnh CT/MRI lưu dưới dạng DICOM trong hệ PACS, liên kết với EMR qua mã y tế.

### Nhóm 4 — Điều dưỡng (chỉ áp dụng nội trú)

Khoa điều trị lưu, điều dưỡng ghi nhận liên tục.

| Tài liệu | Tên file mẫu | Tạo bởi |
|---|---|---|
| Phiếu theo dõi và chăm sóc cấp 1/2/3 | `phiếu_chăm_sóc_cấp_1_2_3` | Điều dưỡng phụ trách |

Nội dung: theo dõi sinh hiệu (mạch, HA, nhiệt độ, SpO₂) theo ca, ghi nhập/xuất nước, dấu hiệu lâm sàng, vận động, vệ sinh, tinh thần.

### Nhóm 5 — Pháp lý / chuyên môn

Lưu riêng, có chữ ký các bên.

| Tài liệu | Tên file mẫu | Tạo bởi |
|---|---|---|
| Giấy cam kết chấp thuận phẫu thuật | `cam_đoan_phẫu_thuật` | BS phẫu thuật + BS gây mê + BN/thân nhân ký |
| Trích biên bản hội chẩn | `hội_chẩn` | Chủ tọa + thư ký + thành viên tham gia |

---

## Quy trình lưu trữ

```
Bệnh nhân tiếp nhận
   ↓
Tạo HSBA (nếu mới) hoặc gắn lượt mới vào HSBA cũ
   ↓
Mỗi bước trong quy trình khám/điều trị → sinh tài liệu tương ứng
   ↓
Tài liệu được tạo trong phần mềm FPT.eHospital,
gắn metadata (BS tạo, ngày, khoa, lượt khám)
   ↓
Tự động đẩy vào EMR theo nhóm 1/2/3/4/5
   ↓
HSBA hoàn chỉnh khi kết thúc lượt điều trị (ra viện/chuyển tuyến)
   ↓
Lưu trữ theo quy định Bộ Y tế (tối thiểu 15 năm với HSBA)
```

### Mỗi tài liệu khi lưu cần có

- Dữ liệu gốc (cấu trúc bảng) + bản in PDF có chữ ký số
- Mã y tế + SBA + lượt điều trị
- Bác sĩ / điều dưỡng / KTV tạo (mã nhân viên)
- Khoa phát hành
- Thời gian tạo
- Trạng thái ký số (đã ký / chưa ký / cần phê duyệt)
- Liên kết với chẩn đoán ICD-10 (nếu có)

---

## Phân quyền truy cập

| Vai trò | Quyền |
|---|---|
| Bác sĩ điều trị | Đọc/ghi HSBA của BN mình phụ trách |
| Bác sĩ trưởng khoa | Đọc HSBA toàn khoa, phê duyệt giấy ra viện |
| Điều dưỡng | Đọc HSBA + ghi phiếu chăm sóc |
| KTV xét nghiệm/CĐHA | Ghi kết quả, đọc phiếu chỉ định |
| Phòng kế hoạch tổng hợp | Đọc/cấp tóm tắt HSBA |
| Phòng tài vụ | Ghi phiếu thu, đọc thông tin BN |
| Tiếp tân | Tạo lượt, ghi phiếu khám |
| Ban giám đốc | Đọc toàn bộ, ký chuyển tuyến |

---

## Liên kết với hệ thống khác

- **PACS** — lưu file ảnh CT/MRI (DICOM)
- **LIS** — phòng xét nghiệm gửi kết quả vào EMR
- **HIS / FPT.eHospital** — phần mềm quản lý chính, sinh tài liệu in
- **BHYT** — gửi dữ liệu quyết toán hằng tháng
- **Hệ thống tóm tắt HSBA cho BN** — cấp khi BN yêu cầu, có thể đồng bộ sang kho cá nhân của BN

---

## Khác biệt so với kho cá nhân BN

| Tiêu chí | EMR bệnh viện | Kho cá nhân BN |
|---|---|---|
| Mục đích | Vận hành khám chữa bệnh | Theo dõi sức khỏe cá nhân |
| Khóa chính | Mã y tế + SBA | CCCD + Mã y tế |
| Phạm vi | Tất cả BN tại BV | Một cá nhân, nhiều BV |
| Tài liệu nội bộ | Có (nhóm 4 + hội chẩn) | Không có |
| Định dạng | Dữ liệu gốc có cấu trúc | Bản scan/PDF |
| Thời hạn lưu trữ | Theo quy định Bộ Y tế (≥15 năm) | Tùy người dùng |
| Pháp lý | Là HSBA chính thức | Bản sao tham khảo |
