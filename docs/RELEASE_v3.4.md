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
4. **Phạm vi đồ án:** BHYT và giường bệnh nằm ngoài phạm vi, API `/api/v1/bhyt` và `/api/v1/hospital-beds` trả 404. Muốn bật lại phải đặt **cùng lúc** `ENABLE_OUT_OF_SCOPE=true` (backend) và `EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE=true` (khi build frontend).
   Từ bản này các cờ (`ENABLE_OUT_OF_SCOPE`, `ENABLE_*`, `STORAGE_MODE`…) đặt trong `BE/.env` có hiệu lực cả khi chạy `npm start`. Trước đây `.env` được nạp sau khi các module đã đọc cờ, nên chỉ biến môi trường hệ thống hoặc `env_file` của docker mới có tác dụng.
5. **Môi trường dev:** mã OTP `123456` và trả OTP trong response chỉ hoạt động khi đặt `ENABLE_DEBUG_OTP=true`. AI service chạy không có khóa cần `ALLOW_INSECURE_AI=true`.

### Khóa mã hóa tệp (bắt buộc từ bản này)

- Production phải đặt cả `FIELD_ENCRYPTION_KEY` (mã hóa CCCD, số thẻ BHYT) và `FILE_ENCRYPTION_KEY`. Thiếu một trong hai thì backend dừng ngay lúc khởi động, log ghi tên biến thiếu (không in giá trị khóa). `BE/.env` hiện tại **chưa có** `FIELD_ENCRYPTION_KEY`, nên chạy `docker compose` (ép `NODE_ENV=production`) sẽ không lên tới khi thêm khóa.
- [THIẾU DỮ LIỆU] Chưa biết CCCD/BHYT trên DB thật đang mã hóa bằng khóa DEV hay khóa thật. Nếu là khóa DEV thì phải giải mã và mã hóa lại bằng khóa mới trước khi đặt khóa, nếu không sẽ không đọc lại được. Cần một lượt kiểm chỉ đọc trên DB thật (được cấp phép riêng) để biết.
- Production phải đặt `FILE_ENCRYPTION_KEY` (64 ký tự hex) trong `BE/.env`; thiếu khóa thì mã hóa tệp và sao lưu báo lỗi dừng (trước đây âm thầm dùng khóa dev công khai `0123…cdef`).
- Nếu máy chủ thật đã từng chạy thiếu khóa, các bản sao lưu Drive và tệp PACS mã hóa trước đó dùng khóa dev: giải mã bằng khóa dev rồi mã hóa lại bằng khóa mới trước khi đổi, nếu không sẽ không đọc lại được.
- Bản sao lưu theo viện và cron sao lưu CSDL giờ là tệp mã hóa AES-256-GCM; khôi phục cần đúng khóa. Tệp sao lưu JSON bản rõ đời cũ vẫn đọc được để khôi phục, nên xóa sau khi đã có bản mã hóa.

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
10. **Cần quyết định: phiếu chăm sóc cũ có GCS và đồng tử tự điền.** Trước bản sửa, mọi phiếu chăm sóc không đánh giá thần kinh đều lưu GCS 15 "Tỉnh táo / Tri giác tốt", đồng tử 2,5 mm "Tròn đều 2 bên", chân ống dẫn lưu "khô ráo, cố định tốt". Không phân biệt được với phiếu đánh giá thật. Chạy thử `node BE/scripts/repairDataV34.js` (chỉ đếm, không in dữ liệu bệnh nhân) để biết số phiếu có GCS 15 và số phiếu có đủ 3 khối mặc định cùng lúc, cùng số đơn thuốc, giấy ra viện ghi tên chung "Bác sĩ điều trị", phiếu chuyển viện có nơi đến tự điền, nhật ký thiếu email. Hội đồng chuyên môn quyết định cách ghi chú các bản ghi này; script không tự sửa.
11. **Cần xác minh pháp lý: đồng ý xử lý dữ liệu cá nhân.** Mục đích đồng ý (AI hỗ trợ phân tích, sao lưu đám mây, nghiên cứu) và việc rút đồng ý hiện chỉ được ghi nhận, chưa chặn AI hay sao lưu; form bật sẵn mục AI và đám mây. Theo quyết định giữ nguyên phần AI, bản này không đổi luồng AI. [CẦN XÁC MINH PHÁP LÝ] theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 trước khi phát hành cho bệnh viện thật.

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
- `admin`, `system_admin` không còn thu tiền, hoàn tiền, duyệt nợ, ra y lệnh, đọc dữ liệu CĐHA, đọc, sửa, ký bệnh án, duyệt Hội đồng U não, xem hay thu hồi cam kết dữ liệu cá nhân, hay xem sự kiện cấp cứu. Màn Bệnh án điện tử chỉ hiện thông báo không truy cập dữ liệu lâm sàng.
- Kết quả xét nghiệm do máy LIS hoặc KTV xét nghiệm nhập; bác sĩ vẫn nhập tay được khi máy không gửi. Chỉ Bác sĩ hoặc Trưởng khoa duyệt kết quả. KTV CĐHA không nhập kết quả xét nghiệm.
- Giải trừ báo động, đề xuất chèn lịch MRI, giữ giường Neuro-ICU, đóng sự kiện và đóng cảnh báo cấp cứu chỉ còn Bác sĩ hoặc Trưởng khoa. Ban Giám đốc vẫn kích hoạt và xác nhận cảnh báo được.
- Bệnh án điều dưỡng mở lúc đo sinh hiệu để trống tuổi, chẩn đoán, bác sĩ phụ trách khi chưa có. Bệnh án chưa có chẩn đoán thì không ký số được.
- Ký bệnh án chỉ ghi mã băm toàn vẹn SHA-256 và tài khoản người ký, không ghi số chứng thư hay nhà cung cấp CA, vì hệ thống chưa tích hợp tổ chức chứng thực. Trưởng khoa ký được bệnh án.
- Sửa bệnh án chỉ nhận nội dung lâm sàng. Viện, mã bệnh nhân, trạng thái ký, chữ ký, phiên bản, hạn lưu trữ, phong tỏa pháp lý, phụ lục, y lệnh miệng không đổi được qua màn sửa.
- Người nhập tay kết quả xét nghiệm không tự duyệt được, cần bác sĩ khác duyệt. Kết quả máy LIS gửi thì bác sĩ nào cũng duyệt được.
- Tạo phụ lục bệnh án phải nhập lý do bổ sung.
- Menu quản trị nền tảng bỏ mục "Báo cáo tài chính" (số liệu của từng viện, tài khoản nền tảng không gắn viện).
- `admin`, `system_admin` không còn xem danh sách hay chi tiết bệnh nhân, lượt khám, hồ sơ chuyển viện, đồng thuận cản quang, bình duyệt phim, phân công ca, đơn thuốc. Menu quản trị bỏ mục Chuyển viện và Giường bệnh. Báo cáo tổng hợp (số liệu không định danh) vẫn xem được.
- Trưởng khoa, Bác sĩ CĐHA, KTV xét nghiệm, Dược sĩ xem được nội dung bệnh án theo phạm vi nghiệp vụ (trước đây thẻ bệnh án hiện trống). Trưởng khoa xem được hồ sơ chuyển viện và quét mã chia sẻ bệnh án.
- Nút ký, lập phụ lục, thêm hồ sơ, thêm phiếu chăm sóc, các tab bệnh án chỉ hiện với vai trò có quyền. Điều dưỡng không còn thấy tab Thu ngân.
- Bỏ nút "Tự động điền giá trị chuẩn" ở form nhập kết quả xét nghiệm (điền trung bình khoảng tham chiếu như kết quả thật). Số giấy ra viện, giấy chuyển tuyến, số bệnh án không còn sinh ngẫu nhiên: chưa có thì để trống điền tay. Mã vạch xét nghiệm dài hơn để không trùng.
- Bác sĩ kê đơn từ bệnh án điện tử theo mã y tế (BN...) đã lưu và xem lại được (trước đây báo lỗi dữ liệu không hợp lệ).
- Bỏ các nút "Giả lập OCR" điền dữ liệu mẫu. Màn KTV tạo kết quả CĐHA chỉ điền thông tin hành chính có thật từ lượt khám; mô tả, kết luận, tên bác sĩ CĐHA phải nhập.
- Đăng xuất xóa bản nháp bệnh án và thông tin người dùng lưu trên máy (máy dùng chung). Kho giấy tờ trên máy tách riêng theo tài khoản.
- Phiếu chăm sóc không còn tự ghi GCS 15, đồng tử 2,5 mm, thể tích dịch 0 hoặc 500 ml khi điều dưỡng chưa đánh giá. Nhập GCS phải đủ 3 thành phần; đồng tử phải đủ 2 bên; có vị trí dẫn lưu hoặc dịch truyền thì phải có thể tích; form bắt buộc cấp chăm sóc.
- Đo sinh hiệu ở màn điều dưỡng bắt buộc nhịp thở (trước đây bỏ trống thì lưu 18 lần/phút). Tab Chỉ định không còn chọn sẵn "Chụp MRI", "Xét nghiệm máu"; đơn giá trên phiếu chỉ định lấy từ bảng giá viện. Biểu đồ sinh hiệu chỉ vẽ số đo có thật.
- Tên bác sĩ trên đơn thuốc, giấy ra viện, giấy chuyển viện và người ghi đè cảnh báo thuốc lấy theo tài khoản đăng nhập, không theo tên gửi kèm. Nhật ký ghi đúng email người thao tác (trước đây ghi "undefined").
- Gói chuyển viện bắt buộc nơi chuyển đến, không tự sinh số bệnh án, chỉ đính kèm phim của đúng bệnh nhân (trước đây có thể lấy phim của người trùng tên).
- Thông tin định danh, dị ứng, liên hệ khẩn cấp, lượt khám, lịch uống thuốc của bệnh nhân: nhân viên vệ sinh và tài khoản nền tảng không truy cập được; chỉ Bác sĩ, Trưởng khoa, Điều dưỡng, Lễ tân, Ban Giám đốc sửa được. Lễ tân không xem kết quả sàng lọc trước khám.
- Nút chỉ hiện khi có quyền: bước công việc giao cho người khác, xếp lịch MRI cấp cứu (điều dưỡng chỉ thấy trạng thái; lễ tân chỉ xếp ca đã có chỉ định MRI của bác sĩ), Phim MRI/CT và Nhập phim ở danh sách bệnh nhân (KTV xét nghiệm không thấy), khóa tài khoản quản trị, lịch trực của nhân viên vệ sinh.
- Ảnh đại diện trong quản lý người dùng là chữ viết tắt tạo trên máy; không còn gửi tên, email người dùng sang ui-avatars.com. Hotline, email, giờ hỗ trợ lấy từ một chỗ (`FE/src/constants/supportContact.js`): 0236 3650 676, 8:00–17:00 các ngày làm việc; không còn ghi "trực 24/7". Bỏ kênh "Chat trực tiếp" chưa có. Nhóm vận hành xác nhận số, email, giờ thật rồi sửa ở file này.
- Mã OTP (kích hoạt, quên mật khẩu, đăng nhập SĐT, 2FA) lưu dạng băm HMAC và không còn trả về trong danh sách người dùng của quản trị (trước đây admin đọc được mã đang hiệu lực). Mã gửi trước khi cập nhật hết hiệu lực: người dùng bấm gửi lại mã. Chạy `repairDataV34.js` để vô hiệu mã chữ thường còn trong DB.
- Mật khẩu tự đặt (đăng ký, đổi, đặt lại, quản trị tạo tài khoản) phải có 8–128 ký tự, gồm cả chữ và số. Mật khẩu đang dùng không bị bắt đổi.
- "Hủy và hoàn tiền" ở mục Hóa đơn kẹt trừ kho chỉ lập yêu cầu hoàn; người khác phê duyệt theo quy trình hoàn tiền chung (từ 50 triệu Ban Giám đốc duyệt, có bước OTP). Bị từ chối thì hóa đơn vẫn chờ trừ kho lại. Hoàn toàn bộ sau khi đã hoàn một phần chỉ hoàn số còn lại.
- Đường dẫn tệp gửi lên máy chủ phải là link hệ thống cấp còn hạn (12 giờ). Trang mở quá lâu sẽ báo "Liên kết tệp không hợp lệ hoặc đã hết hạn": tải lại trang.
- Đặt lịch tái khám, lịch sử khám, FCM của cổng bệnh nhân chỉ dành cho tài khoản bệnh nhân; bác sĩ chọn phải thuộc đúng cơ sở.
- Giấy chuyển tuyến (`POST /api/patients/:id/transfer-forms`) chỉ nhận nội dung giấy; bệnh nhân, viện, viện nhận, trạng thái, người lập do máy chủ đặt theo tài khoản đăng nhập. Lượt khám gắn kèm phải thuộc đúng bệnh nhân.
- Tài khoản nền tảng không tải được tệp y tế trong kho lưu trữ (trước đây `admin` đọc được mọi tệp).
- Ký báo cáo CĐHA ở màn kết quả (clinical-view) ghi mã băm toàn vẹn như khi ký ở màn sửa báo cáo.
- Chỉ định MRI khi hóa đơn khám đã thu: hệ thống lập hóa đơn MRI riêng chờ thanh toán, cổng viện phí chặn tới khi đóng phí MRI (trừ các trường hợp miễn như cũ). Không lập được hóa đơn thì y lệnh báo lỗi, không lưu.
- Gói chuyển viện chỉ tạo cho bệnh nhân của viện mình; viện nhận phải khác viện gửi; chỉ viện nhận chấp nhận hoặc từ chối (trước đây viện gửi tự chấp nhận, mở quyền xem hồ sơ xuyên viện). Viện gửi của phiếu không còn bị đổi khi viện nhận cập nhật.
- Bị đăng xuất do hết phiên hoặc tài khoản/viện bị khóa cũng xóa bản nháp bệnh án lưu trên máy như đăng xuất thường; các thao tác đang chờ báo lỗi thay vì treo.
- Nút thu tiền mặt khóa trong lúc xử lý (không gửi 2 lần).
- BHYT (khi bật lại phạm vi): áp BHYT có khóa theo hóa đơn, áp đồng thời nhiều lần cho cùng hóa đơn không còn cộng trùng lũy kế thẻ (QA C6); thao tác trùng lúc nhận thông báo "đang áp BHYT, thử lại sau vài giây", quầy thu ngân không thu khi BHYT đang được áp.
- Viện nhận xem được danh sách phiếu chuyển viện gửi tới mình (`GET /api/v1/transfers?type=incoming`) và chi tiết phiếu kèm ca chụp. Trước đây danh sách luôn rỗng và chi tiết báo không tìm thấy. FE chưa có màn hình cho viện nhận.
- Ký đồng thuận cản quang thay bệnh nhân (`POST /api/v1/contrast-consents/:id/sign-patient`): chỉ bệnh nhân ký phiếu của chính mình, hoặc KTV, điều dưỡng, bác sĩ, CĐHA, trưởng khoa ghi nhận chữ ký tại phòng chụp. Phiếu đã ký không ký đè được.
- Kết luận cuối bình duyệt phim: chỉ Bác sĩ, Bác sĩ CĐHA, Trưởng khoa; phải có ít nhất một lần đọc độc lập; bác sĩ đọc ban đầu không tự kết luận ca của mình; Ban Giám đốc không còn ra kết luận chuyên môn. Ca chưa có người đọc thì không kết luận được.
- Sao lưu, dọn tệp, tạo thư mục trên Google Drive (`/api/v1/drive-storage/*`) trả "Chưa hỗ trợ" (501) vì chưa tích hợp Drive thật. Trước đây các nút này báo thành công với dữ liệu mô phỏng. Màn Tuân thủ bỏ 2 nút này. Dung lượng Drive của Ban Giám đốc chỉ tính tệp của viện mình.
- Phạm vi thu hẹp: tạm không tạo mới tài khoản Nhân viên vệ sinh (chỉ dùng cho dọn giường) và Dược sĩ (phân hệ Dược). Máy chủ từ chối, form cấp tài khoản bỏ tab Dược sĩ, số nhân sự trên thống kê không tính 2 vai trò này. Tài khoản đã có vẫn đăng nhập được, trang chủ báo chức năng ngoài phạm vi. Bật lại cùng cờ `ENABLE_OUT_OF_SCOPE=true` / `EXPO_PUBLIC_ENABLE_OUT_OF_SCOPE=true` với BHYT và giường.
- Form cấp tài khoản của Ban Giám đốc hiện đúng tên tab Trưởng khoa, BS CĐHA, KTV xét nghiệm (trước đây đều hiện "Lễ tân").
- Kiểm tra an toàn kê đơn nhận ra thuốc trong danh mục viện khi tên có ngoặc đơn, dấu cộng, % (ví dụ "Mannitol 20% (250ml)"). Trước đây các thuốc này bị tính là "chưa đánh giá".
- Màn thống kê SLA ghi "Phân bố kết quả gợi ý sàng lọc"; trang tài liệu API của dịch vụ AI đổi tên thành "NeuroScan AI – Brain MRI Tumor Screening Support API" (chỉ đổi tên hiển thị, không đổi luồng AI).
- Chưa đổi: lễ tân vẫn nhập sinh hiệu và lập giấy chuyển tuyến được (BUG-RBAC-001), chờ quyết định của bệnh viện.

## Kiểm thử tay theo vai trò

| Vai trò | Mục cần thử |
|---|---|
| Bác sĩ | Ra y lệnh miệng trong sự kiện cấp cứu, chọn điều dưỡng; ký bổ sung ở "Y lệnh miệng chờ xử lý"; "Xác nhận đã đọc báo cáo" và phụ lục lâm sàng ở màn kết quả; không thấy form ký khi viện có Bác sĩ CĐHA; yêu cầu bình duyệt; xem diễn tiến khối u; ghi nhận lấy mẫu, duyệt xét nghiệm; mở chi tiết bệnh nhân từ danh sách (6 tab); chọn bệnh án rồi "+ Thêm đơn thuốc" ở tab Kê đơn |
| Điều dưỡng | "Y lệnh miệng chờ đọc lại": xác nhận, từ chối, nhập mã OTP email; không thấy tab ra y lệnh trong modal cấp cứu; công việc ca trực; ghi nhận lấy mẫu |
| Bác sĩ CĐHA | Ký báo cáo; đính chính sau ký; đọc độc lập ở "Bình duyệt phim lần 2"; lịch MRI tuần; thẻ bệnh án có tên, chẩn đoán, không có nút ký bệnh án |
| Trưởng khoa | Ký thay có nhập lý do; tab Hội chẩn và nút duyệt Hội đồng U não; báo cáo vận hành và lâm sàng; lấy mẫu QA; đóng cảnh báo cấp cứu; thẻ bệnh án có đủ tên, chẩn đoán; tab Chuyển viện có dữ liệu; Quét mã bệnh án |
| KTV CĐHA | Bảng kiểm an toàn rồi bắt đầu chụp; giải phóng phòng ở "Phòng máy MRI"; công việc ca trực |
| Lễ tân | Lập yêu cầu hoàn tiền; duyệt khoản 10 đến dưới 50 triệu của người khác, có bước nhập OTP; xếp lịch MRI cấp cứu; ca thường bị từ chối |
| Dược sĩ | "Hậu kiểm dược"; "Hóa đơn kẹt trừ kho" |
| Ban Giám đốc | Duyệt hoàn tiền; kiểm tra khoản lớn; bảo lãnh viện phí; chính sách viện; thêm, sửa phòng MRI; "Tuân thủ và dữ liệu"; cấp quyền ký CĐHA |
| Quản trị nền tảng | Không còn mục Chuyển viện, Giường bệnh trong menu; mở `/staff/emr-dashboard` chỉ thấy thông báo không truy cập dữ liệu lâm sàng; "Yêu cầu hỗ trợ"; "Tuân thủ và dữ liệu": kiểm tra toàn vẹn nhật ký; danh sách người dùng không có nút khóa tài khoản quản trị, ảnh đại diện là chữ viết tắt |
| Bệnh nhân | Xem phim đã ký; Phân tích AI; "Dữ liệu cá nhân của tôi": tạo, rút đồng ý |
| Nhân viên vệ sinh | Banner cấp cứu chỉ có vị trí và mức độ, không có nút xử lý |

## API còn chưa có màn hình, có chủ đích

| API | Lý do |
|---|---|
| `PUT /transfers/:id/accept`, `reject`, `grant-cross-view` | Luồng cũ: hồ sơ chuyển viện nay gửi qua email, route xem chéo đã trả 410 |
| `POST /patient-b2c/imaging/:id/share-qr`, `GET /shared/:token` | Đã có "Chia sẻ bệnh án" thay thế |
| `POST /visits/check-vitals`, `PUT /visits/:id/start-exam`, `POST /bhyt/calculate-copay`, `POST /assignments/auto-assign` | Chưa nối vào màn hình và chưa rà soát nhu cầu. Luồng khám hiện đi qua route khác; `auto-assign` là chức năng thật nếu viện muốn tự phân công |
| `GET /clinical-view/imaging/:id/*` (DICOM, AI, 3D) | Chưa nối vào màn hình. Trình xem phim hiện dùng `/dicom/studies/:id/viewer-manifest` |
