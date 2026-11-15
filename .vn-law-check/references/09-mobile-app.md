# Checklist 9: Mobile app (Android, iOS, React Native, Flutter)

Dùng kèm các checklist khác, không thay thế. App thu email/SĐT vẫn áp dụng checklist 01 như website. App bán hàng vẫn áp dụng 02 và 04. File này chỉ gom các nghĩa vụ riêng hoặc đặc biệt quan trọng với app.

**Văn bản áp dụng:**
- Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 ([thuvienphapluat](https://thuvienphapluat.vn/van-ban/Bo-may-hanh-chinh/Luat-Bao-ve-du-lieu-ca-nhan-2025-so-91-2025-QH15-625628.aspx)) và Nghị định 356/2025/NĐ-CP ([toàn văn](https://thuvienphapluat.vn/van-ban/Quyen-dan-su/Nghi-dinh-356-2025-ND-CP-huong-dan-Luat-Bao-ve-du-lieu-ca-nhan-687428.aspx))
- Văn bản hợp nhất 42/VBHN-BCT ngày 04/06/2026, hợp nhất Thông tư 59/2015/TT-BCT về TMĐT qua ứng dụng di động với các lần sửa (mới nhất TT 26/2026) ([luatvietnam](https://luatvietnam.vn/thuong-mai/van-ban-hop-nhat-42-vbhn-bct-2026-quan-ly-thuong-mai-dien-tu-qua-ung-dung-di-dong-437088-d5.html)). Thay bản hợp nhất cũ 08/VBHN-BCT (03/02/2026). Thông tư này hướng dẫn NĐ 52/2013, đã hết hiệu lực từ 01/07/2026, nên có thể không còn là căn cứ chính: cần tra cứu lại. Ưu tiên checklist 02 theo Luật 122/2025.
- Nghị định 147/2024/NĐ-CP, quản lý dịch vụ Internet và thông tin trên mạng, hiệu lực 25/12/2024 ([tóm tắt](https://luatvietan.vn/nghi-dinh-147-2024-nd-cp-quan-ly-cung-cap-su-dung-dich-vu-internet-va-thong-tin-tren-mang.html))
- Nghị định 342/2025/NĐ-CP, hướng dẫn Luật Quảng cáo ([Điều 17](https://hethongphapluat.com/nghi-dinh-342-2025-nd-cp-huong-dan-luat-quang-cao/dieu-17))
- Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 ([Điều 10 khoản 3](https://hethongphapluat.com/luat-bao-ve-quyen-loi-nguoi-tieu-dung-2023/khoan-3-dieu-10))

## A. Phân loại app trước khi audit

Một app có thể thuộc nhiều nhóm. Nhóm quyết định mục nào bên dưới áp dụng:
- [ ] **Mọi app thu thập dữ liệu cá nhân** (có đăng ký, form, quyền truy cập, SDK tracking): mục B, C, D
- [ ] **App mạng xã hội hoặc truyền thông trực tuyến** (chat, video, OTT, cộng đồng): thêm mục E
- [ ] **App bán hàng hoặc sàn TMĐT:** thêm mục F
- [ ] **App có quảng cáo:** thêm mục G
- [ ] **App có người dùng là trẻ em, hoặc là game:** thêm mục H

## B. Xin quyền truy cập và công bố dữ liệu thu thập

Luật không có điều riêng cho từng loại quyền camera, danh bạ, vị trí: CHƯA XÁC MINH. Căn cứ chung là Điều 9 Luật 91/2025: đồng ý phải tự nguyện, rõ ràng, tách theo từng mục đích.

- [ ] App chỉ xin quyền thật sự cần cho tính năng. Ví dụ: app đọc tin tức mà xin quyền danh bạ là dấu hiệu thu thập vượt mục đích.
- [ ] Xin quyền đúng lúc dùng tính năng và nói rõ lý do, không xin hết một lượt khi vừa mở app. Trên iOS, câu giải thích trong `Info.plist` (các key `NS...UsageDescription`) phải nói đúng mục đích thật, không ghi chung chung.
- [ ] Quyền vị trí chạy nền (`ACCESS_BACKGROUND_LOCATION`, `NSLocationAlwaysUsageDescription`) có lý do rõ ràng. Theo NĐ 356/2025, vị trí có được xếp là dữ liệu nhạy cảm hay không: CHƯA XÁC MINH. Vẫn nên xử lý như dữ liệu nhạy cảm cho an toàn.
- [ ] Từ chối một quyền thì app vẫn dùng được các tính năng không cần quyền đó.
- [ ] Chính sách bảo mật liệt kê dữ liệu app thu thập **khi cài đặt và khi sử dụng**. Với app bán hàng, đây là yêu cầu ở Điều 5 khoản 3 của 42/VBHN-BCT. Với app mạng xã hội, xem mục E.
- [ ] Link chính sách bảo mật mở được từ bên trong app, không chỉ để trên store.

## C. Xóa tài khoản và xóa dữ liệu
- [ ] App có tài khoản thì có cách yêu cầu xóa tài khoản và dữ liệu, tốt nhất là ngay trong app. Căn cứ: quyền yêu cầu xóa, Điều 14 Luật 91/2025. Các trường hợp được từ chối xóa ở khoản 2: xử lý không cần đồng ý theo Điều 19, hoặc trái nguyên tắc ở khoản 3 Điều 4. Khi từ chối phải thông báo cho người dùng.
- [ ] Xử lý yêu cầu xóa trong **20 ngày**, hoặc 30 ngày nếu cần phối hợp bên xử lý/bên thứ ba. Được gia hạn 1 lần tối đa 20 ngày. Phản hồi đã nhận yêu cầu trong 2 ngày làm việc (Điều 5 NĐ 356/2025).
- [ ] Xóa luôn dữ liệu đã gửi sang dịch vụ bên thứ ba (Firebase, CRM, SDK analytics) khi xóa tài khoản, hoặc nói rõ phần nào được giữ lại và vì sao.

## D. SDK tracking, quảng cáo cá nhân hóa
- [ ] Liệt kê các SDK thu dữ liệu: analytics (Firebase Analytics, Mixpanel, Amplitude), attribution (AppsFlyer, Adjust, Branch), Facebook SDK, SDK quảng cáo. Ghi tên các SDK này trong chính sách bảo mật.
- [ ] Dùng dữ liệu cho quảng cáo, kể cả thu qua theo dõi trong ứng dụng, phải có đồng ý. Phải cho người dùng từ chối nhận quảng cáo và từ chối chia sẻ dữ liệu (Điều 28 Luật 91/2025, số khoản CHƯA XÁC MINH).
- [ ] Advertising ID (IDFA/GAID) chỉ được đọc sau khi người dùng đồng ý. Luật không nhắc tên Advertising ID, đây là áp dụng Điều 28 cho trường hợp theo dõi qua ứng dụng. Trên iOS, việc này trùng với yêu cầu App Tracking Transparency của Apple.
- [ ] SDK không tự chạy và gửi dữ liệu trước khi người dùng đồng ý. Nhiều SDK mặc định bật thu thập ngay khi khởi động, phải tắt rồi bật lại sau khi có đồng ý.

## E. App mạng xã hội, truyền thông trực tuyến (Điều 29 Luật 91/2025)

Áp dụng cho app mạng xã hội và app truyền thông trực tuyến (chat, video, OTT), không áp dụng cho mọi app. Nguồn: [hoatieu.vn](https://hoatieu.vn/phap-luat/mang-xa-hoi-bi-cam-nghe-len-ghi-am-doc-tin-nhan-nguoi-dung-235850), [luatvietnam](https://luatvietnam.vn/tin-van-ban-moi/mang-xa-hoi-khong-duoc-nghe-len-doc-tin-nhan-nguoi-dung-neu-khong-duoc-phep-186-103020-article.html).
- [ ] Thông báo rõ dữ liệu cá nhân thu thập khi người dùng **cài đặt và sử dụng** app. Không thu thập ngoài phạm vi đã thỏa thuận (khoản 1).
- [ ] **Không yêu cầu ảnh hoặc video chứa giấy tờ tùy thân** (CCCD, hộ chiếu...) làm yếu tố xác thực tài khoản (khoản 2). Ảnh CCCD cũng là dữ liệu nhạy cảm theo NĐ 356/2025.
- [ ] Cho người dùng từ chối thu thập và chia sẻ cookie (khoản 3).
- [ ] Có lựa chọn "không theo dõi", hoặc chỉ theo dõi hoạt động khi người dùng đồng ý (khoản 4).
- [ ] Không nghe lén, ghi âm cuộc gọi, đọc tin nhắn khi chưa có đồng ý, trừ trường hợp luật quy định khác (khoản 5). Kiểm tra lý do app xin quyền micro, đọc SMS.
- [ ] Công khai chính sách bảo mật. Có cơ chế cho người dùng truy cập, chỉnh sửa, xóa dữ liệu, thiết lập quyền riêng tư (khoản 6).
- [ ] Xác thực tài khoản bằng số điện thoại di động Việt Nam. Chỉ tài khoản đã xác thực mới được đăng bài, bình luận, livestream (NĐ 147/2024/NĐ-CP). Số điều: CHƯA XÁC MINH, vì các nguồn dẫn Điều 23 và Điều 27 không thống nhất. Mạng xã hội nước ngoài chỉ thuộc diện áp dụng khi thuê lưu trữ tại Việt Nam, hoặc có từ 100.000 lượt truy cập/tháng từ Việt Nam liên tục 6 tháng.
- [ ] Gỡ nội dung vi phạm trong 24 giờ khi cơ quan có thẩm quyền yêu cầu, 48 giờ với khiếu nại có căn cứ của người dùng (khoản 7 Điều 36 NĐ 147/2024, theo bản tóm tắt).

## F. App bán hàng, sàn TMĐT (42/VBHN-BCT)

Điều 41 khoản 1 Luật 122/2025 nhắc rõ "ứng dụng thương mại điện tử" trong quy định chuyển tiếp, nên app bán hàng nằm trong khung luật mới: audit theo checklist 02 trước. Các mục dưới đây theo Thông tư 59/2015 (khung cũ), dùng tham khảo; hiệu lực sau 01/07/2026: cần tra cứu lại.
- [ ] App bán hàng có chức năng đặt hàng đã **thông báo** với Bộ Công Thương: tên app, địa chỉ tải, thông tin chủ sở hữu (Điều 5 khoản 1, Điều 11). Một lần thông báo dùng chung cho mọi phiên bản app (Điều 4 khoản 2).
- [ ] App sàn hoặc trung gian TMĐT đã **đăng ký** với Bộ Công Thương. App công bố quy chế, chính sách bảo mật, cơ chế giải quyết tranh chấp (Điều 6, Điều 14-17).
- [ ] Hiển thị tên chủ sở hữu, địa chỉ, điện thoại hoặc email trong app (Điều 5 khoản 2).
- [ ] Trước khi xác nhận đơn, người dùng xem được tổng giá và phương thức thanh toán, và có thể hủy. Áp dụng cả với nội dung số và dịch vụ online (Điều 5 khoản 4, Điều 8, Điều 9). Gói gia hạn tự động và mua trong app chưa có quy định riêng (CHƯA XÁC MINH). Ít nhất phải cho thấy rõ giá, chu kỳ trừ tiền và cách hủy.
- [ ] Hàng hóa kinh doanh có điều kiện hiển thị số giấy phép (Điều 5 khoản 7).
- [ ] Thông tin đã thông báo thay đổi thì cập nhật với Bộ Công Thương trong 7 ngày làm việc (Điều 12).
- [ ] App vận hành nền tảng số, siêu ứng dụng hoặc app cài sẵn: không ngăn người dùng gỡ app cài sẵn (trừ khi ảnh hưởng tính năng kỹ thuật cơ bản), không buộc cài app đi kèm (Điều 10 khoản 3 điểm đ Luật 19/2023).

## G. Quảng cáo trong app (Điều 17 NĐ 342/2025)

Điều 17 quy định cho quảng cáo không ở vùng cố định trên "giao diện dịch vụ trực tuyến". Điều này không nhắc riêng chữ "ứng dụng", nhưng phạm vi đủ rộng để bao gồm app. Quảng cáo có thưởng (rewarded ads): CHƯA XÁC MINH.
- [ ] Quảng cáo toàn màn hình, popup, overlay tắt được bằng **một lần chạm**. Không có nút tắt giả hoặc khó phân biệt (khoản 2).
- [ ] Ảnh tĩnh tắt được ngay. Video hoặc ảnh động chờ tối đa **5 giây** là phải tắt được (khoản 3).
- [ ] Có biểu tượng để báo cáo hoặc từ chối quảng cáo (khoản 4).
- [ ] Quảng cáo cá nhân hóa theo hành vi: xem mục D.

## H. Trẻ em và game
- [ ] App có người dùng là trẻ em: cha mẹ hoặc người giám hộ đồng ý thay trẻ. Trẻ từ đủ 7 tuổi phải cùng đồng ý khi công bố/tiết lộ đời sống riêng tư. Phải ngừng xử lý khi người đại diện rút đồng ý (Điều 24 Luật 91/2025, số khoản CHƯA XÁC MINH). Luật không bắt buộc cơ chế xác minh tuổi.
- [ ] Mạng xã hội có người dùng dưới 16 tuổi: cha mẹ đăng ký tài khoản bằng thông tin của mình và giám sát nội dung trẻ đăng, xem (NĐ 147/2024, nguồn dẫn Điều 27, số khoản CHƯA XÁC MINH).
- [ ] App game đã có giấy phép/giấy chứng nhận đúng loại G1-G4 (Điều 37 NĐ 147/2024) và phân loại độ tuổi 18+/16+/12+/00+ (Điều 38).
- [ ] Game có hệ thống giới hạn thời gian cho người dưới 18 tuổi: tối đa 60 phút mỗi game mỗi ngày, tổng 180 phút mỗi ngày. Có cảnh báo chơi quá 180 phút/ngày có hại. Người chơi xác thực bằng số điện thoại Việt Nam, người dưới 16 tuổi do cha mẹ đăng ký (Điều 39 NĐ 147/2024, số khoản CHƯA XÁC MINH).

## I. Lưu trữ dữ liệu, nhật ký (app có lượng người dùng lớn)
- [ ] Xác thực người dùng khi đăng ký bằng số điện thoại, số định danh hoặc tài khoản định danh điện tử. Gỡ thông tin hoặc ứng dụng vi phạm trong 24 giờ, 06 giờ nếu liên quan an ninh quốc gia (Điều 16 NĐ 333/2026, theo bản tóm tắt). Áp dụng cho doanh nghiệp cung cấp dịch vụ trên mạng, xem checklist 03.
- [ ] Lưu nhật ký hệ thống tối thiểu 12 tháng (Điều 16, 20 NĐ 333/2026).
