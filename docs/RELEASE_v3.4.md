# Phát hành v3.4: việc cần làm và cách kiểm thử

## Trước khi triển khai

1. **Sao lưu DB**, rồi chạy thử migration y lệnh miệng, xem số liệu, sau đó mới ghi:
   ```
   node BE/scripts/migrateVerbalOrdersV34.js
   node BE/scripts/migrateVerbalOrdersV34.js --apply
   ```
   Khôi phục khi cần: `node BE/scripts/migrateVerbalOrdersV34.js --rollback`.
2. **Biến môi trường bắt buộc**
   - `INTERNAL_AI_API_KEY`: đặt cùng một giá trị cho backend và AI service. Thiếu thì AI service không khởi động.
   - `TRUST_PROXY_HOPS`: chạy sau nginx là `1`; chạy trực tiếp không qua proxy là `0`.
   - SMTP (`EMAIL_USER`, `EMAIL_PASS`): bắt buộc, vì MFA duyệt hoàn tiền gửi mã qua email.
3. **Biến môi trường tùy chọn:** `UPLOAD_URL_SECRET`, `AUDIT_ANCHOR_SECRET`, `GEOIP_LOOKUP_URL`, `DRIVE_TOTAL_CAPACITY_MB`. Xem `BE/.env.example`.
4. **Môi trường dev:** mã OTP `123456` và trả OTP trong response chỉ hoạt động khi đặt `ENABLE_DEBUG_OTP=true`. AI service chạy không có khóa cần `ALLOW_INSECURE_AI=true`.

## Phát hiện từ rà soát DB thật (chỉ đọc, 06/11/2026), cần xử lý trước khi phát hành

1. **Đổi tài khoản DB của ứng dụng:** chuỗi kết nối đang dùng quyền `atlasAdmin`. Tạo tài khoản chỉ có `readWrite` trên DB của ứng dụng, đổi mật khẩu cũ. Không để `TEST_MONGO_URI` trỏ cùng cluster.
2. **Cấp lại token Google Drive:** toàn bộ 351 tệp ở trạng thái `FAILED` (270 tệp lỗi `invalid_grant`), nên hiện chưa có bản sao ngoài.
3. **Đường dẫn tệp:** `localPath` đang là đường dẫn tuyệt đối Windows, sẽ không đọc được khi chạy trong Docker Linux.
4. **Nhân sự CĐHA:** không viện nào có Bác sĩ CĐHA. Tạo tài khoản hoặc bật chính sách bác sĩ chỉ định, nếu không sẽ không ai ký được báo cáo.
5. **Tài khoản thử nghiệm:** toàn bộ nhân viên và admin là tài khoản `isTestAccount`. Phải thay trước khi dùng thật.
6. **Sửa dữ liệu cũ:** chạy thử `node BE/scripts/repairDataV34.js`, sao lưu, rồi thêm `--apply`. Script mã hóa CCCD và số thẻ BHYT còn dạng chữ thường, khôi phục bình duyệt thiếu người đọc.
7. **Đóng sự kiện còn treo:** 4 cảnh báo cấp cứu mở 39 ngày, 2 lịch MRI giữ 40 ngày không có lượt khám.
8. **Cần quyết định: tên bệnh nhân trong đường dẫn tệp.** Cả 351 tệp có đường dẫn dạng `study_<mã>_<Họ_Tên>`, và đường dẫn này dùng làm tên thư mục trên Google Drive. Nội dung tệp được mã hóa, nhưng tên thư mục thì không.
9. **Lưu ý khi bật Firebase Admin:** `executeAiPredictionInternal` gọi `makePublic()` cho heatmap AI. Hiện chưa có heatmap nào trên bucket công khai và cấu hình chỉ có `FIREBASE_API_KEY`; phải bỏ lệnh này trước khi cấp service account.

## Sau khi triển khai

- **Cấp quyền ký CĐHA cho Trưởng khoa:** Quản lý nhân sự, chọn Trưởng khoa, Cấp quyền ký CĐHA. Chưa cấp thì Trưởng khoa không ký được.
- **Viện không có Bác sĩ CĐHA:** Duyệt hoàn tiền và bảo lãnh, tab Chính sách viện, bật "Bác sĩ chỉ định được ký kết quả CĐHA".
- **Khoản hoàn từ 300 triệu đồng:** cần 2 tài khoản `hospital_admin` khác nhau, một người kiểm tra và một người duyệt.

## Thay đổi hành vi cần báo người dùng

- Link ảnh và tệp `/uploads` có hạn 12 giờ. Trang mở quá lâu thì tải lại để có link mới.
- Đăng xuất thu hồi phiên ngay, trên mọi thiết bị của tài khoản.
- Xin mã OTP mới phải cách 60 giây; nhập sai 5 lần thì mã bị hủy.
- Bệnh nhân chỉ xem được báo cáo CĐHA đã ký và kết quả xét nghiệm đã duyệt.
- Phân tích AI chỉ nhận ảnh qua link hệ thống cấp. Trang mở quá 12 giờ sẽ báo liên kết hết hạn, tải lại trang là dùng được.
- Bệnh nhân tự phân tích AI không làm đổi trạng thái lượt khám. Phân tích AI không đưa lượt đã xong quay lại "chờ bác sĩ đọc".
- `admin`, `system_admin` không còn thu tiền, hoàn tiền, duyệt nợ, ra y lệnh, hay đọc dữ liệu CĐHA.

## Kiểm thử tay theo vai trò

| Vai trò | Mục cần thử |
|---|---|
| Bác sĩ | Ra y lệnh miệng trong sự kiện cấp cứu, chọn điều dưỡng; ký bổ sung ở "Y lệnh miệng chờ xử lý"; "Xác nhận đã đọc báo cáo" và phụ lục lâm sàng ở màn kết quả; không thấy form ký khi viện có Bác sĩ CĐHA; yêu cầu bình duyệt; xem diễn tiến khối u; ghi nhận lấy mẫu, duyệt xét nghiệm |
| Điều dưỡng | "Y lệnh miệng chờ đọc lại": xác nhận, từ chối, nhập mã OTP email; không thấy tab ra y lệnh trong modal cấp cứu; công việc ca trực; ghi nhận lấy mẫu |
| Bác sĩ CĐHA | Ký báo cáo; đính chính sau ký; đọc độc lập ở "Bình duyệt phim lần 2"; lịch MRI tuần |
| Trưởng khoa | Ký thay có nhập lý do; tab Hội chẩn và nút duyệt Hội đồng U não; báo cáo vận hành và lâm sàng; lấy mẫu QA |
| KTV CĐHA | Bảng kiểm an toàn rồi bắt đầu chụp; giải phóng phòng ở "Phòng máy MRI"; công việc ca trực |
| Lễ tân | Lập yêu cầu hoàn tiền; duyệt khoản 10 đến dưới 50 triệu của người khác, có bước nhập OTP; xếp lịch MRI cấp cứu; ca thường bị từ chối |
| Dược sĩ | "Hậu kiểm dược"; "Hóa đơn kẹt trừ kho" |
| Ban Giám đốc | Duyệt hoàn tiền; kiểm tra khoản lớn; bảo lãnh viện phí; chính sách viện; thêm, sửa phòng MRI; "Tuân thủ và dữ liệu"; cấp quyền ký CĐHA |
| Quản trị nền tảng | "Yêu cầu hỗ trợ"; "Tuân thủ và dữ liệu": kiểm tra toàn vẹn nhật ký |
| Bệnh nhân | Xem phim đã ký; Phân tích AI; "Dữ liệu cá nhân của tôi": tạo, rút đồng ý |
| Nhân viên vệ sinh | Banner cấp cứu chỉ có vị trí và mức độ, không có nút xử lý |

## API còn chưa có màn hình, có chủ đích

| API | Lý do |
|---|---|
| `PUT /transfers/:id/accept`, `reject`, `grant-cross-view` | Luồng cũ: hồ sơ chuyển viện nay gửi qua email, route xem chéo đã trả 410 |
| `POST /patient-b2c/imaging/:id/share-qr`, `GET /shared/:token` | Đã có "Chia sẻ bệnh án" thay thế |
| `POST /visits/check-vitals`, `PUT /visits/:id/start-exam`, `POST /bhyt/calculate-copay`, `POST /assignments/auto-assign` | Chưa nối vào màn hình và chưa rà soát nhu cầu. Luồng khám hiện đi qua route khác; `auto-assign` là chức năng thật nếu viện muốn tự phân công |
| `GET /clinical-view/imaging/:id/*` (DICOM, AI, 3D) | Chưa nối vào màn hình. Trình xem phim hiện dùng `/dicom/studies/:id/viewer-manifest` |
