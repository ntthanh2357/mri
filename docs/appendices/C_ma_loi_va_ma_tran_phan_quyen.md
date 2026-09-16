# PHỤ LỤC C: MA TRẬN PHÂN QUYỀN RBAC VÀ TỪ ĐIỂN MÃ LỖI HỆ THỐNG

---

## C.1. MA TRẬN PHÂN QUYỀN TRUY CẬP (ROLE-BASED ACCESS CONTROL MATRIX)

Hệ thống thiết lập ma trận phân quyền nghiêm ngặt theo 5 vai trò nghiệp vụ y tế:

| Chức năng / Nhóm API | Admin Viện (`admin`) | Bác sĩ Khám (`doctor`) | KTV Hình ảnh (`technician`) | Điều dưỡng (`nurse`) | Bệnh nhân (`patient`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Quản lý danh mục khoa phòng & bảng giá** | Full (CRUD) | Chỉ xem | Chỉ xem | Chỉ xem | Không |
| **Tiếp đón & Đăng ký ca khám mới** | Có | Có | Không | Có | Tự đăng ký |
| **Chỉ định cận lâm sàng (Ra y lệnh MRI)** | Không | **Có** | Không | Không | Không |
| **Thực hiện Bảng kiểm An toàn MRI** | Không | Có | **Có (Chính)** | Không | Không |
| **Yêu cầu Chụp lại (Rescan) & Hủy ca MRI** | Không | Có | **Có (Chính)** | Không | Không |
| **Upload Lát cắt MRI & Series DICOM** | Không | Không | **Có (Chính)** | Không | Không |
| **Ký số Điện tử Phiếu Kết Quả CĐHA** | Không | **Chỉ BS CĐHA** | Không | Không | Không |
| **Xem Phiếu Kết Quả MRI đã ký** | Có | Có | Có | Có | **Xem ca của mình** |
| **Giữ chỗ & Xếp giường bệnh nội trú** | Có | Có | Không | **Có (Chính)** | Không |
| **Thanh toán viện phí / Tạo VietQR** | Có | Không | Không | Có | **Có (Chính)** |

---

## C.2. BẢNG MÃ LỖI HỆ THỐNG VÀ NGUYÊN TẮC XỬ LÝ (ERROR CODES DICTIONARY)

| Mã Lỗi (Code) | HTTP Status | Thông điệp Lâm sàng | Nguyên nhân Kỹ thuật | Hướng khắc phục chuẩn |
| :--- | :---: | :--- | :--- | :--- |
| `ERR_AUTH_EXPIRED` | 401 | Phiên làm việc đã hết hạn. | JWT Access Token quá thời hạn 24 giờ. | Hệ thống tự động kích hoạt Refresh Token hoặc điều hướng về Login. |
| `ERR_FORBIDDEN_ROLE` | 403 | Bạn không có thẩm quyền thực hiện thao tác này. | Role người dùng không nằm trong danh sách cho phép của Route. | Thông báo người dùng sử dụng đúng tài khoản chuyên môn (ví dụ: Bác sĩ CĐHA). |
| `ERR_TENANT_MISMATCH`| 403 | Cảnh báo truy cập trái phép cơ sở y tế khác! | `hospitalId` trong Token khác với bản ghi yêu cầu truy cập. | Chặn truy vấn ngay tại tầng Middleware, ghi nhật ký an ninh bảo mật. |
| `ERR_MRI_CONTRAINDICATION` | 400 | Chống chỉ định tuyệt đối: Bệnh nhân mang máy tạo nhịp tim hoặc dị vật kim loại! | KTV tích chọn `hasPacemakerOrMetal: true` trong bảng kiểm. | Hủy ca chụp MRI ngay lập tức và chuyển bác sĩ lâm sàng đổi phương án chẩn đoán. |
| `ERR_BED_CONFLICT` | 409 | Giường bệnh này vừa được nhân viên khác tiếp nhận! | 2 nhân viên gửi đồng thời yêu cầu giữ chỗ cùng 1 `bedId`. | Nhấn nút "Tải lại danh sách giường" và chọn giường trống kế cận. |
| `ERR_INVOICE_NOT_PAID` | 402 | Ca chụp chưa hoàn thành đóng viện phí! | Ca bệnh không phải diện Cấp cứu hoặc BHYT và hóa đơn đang `pending`. | Hướng dẫn bệnh nhân qua quầy thu ngân hoặc quét mã VietQR để thanh toán. |
| `ERR_AI_SERVICE_UNAVAILABLE` | 503 | Dịch vụ AI đang bảo trì. Vui lòng đọc phim thủ công. | FastAPI AI Engine quá tải hoặc ngắt kết nối. | Hệ thống kích hoạt fallback an toàn, chuyển ca sang bác sĩ đọc trực tiếp không qua AI. |
