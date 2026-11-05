# 10. Soạn chính sách bảo mật và form đồng ý từ kết quả audit

Dùng khi người dùng yêu cầu: "tạo/soạn/viết lại chính sách bảo mật", "làm form đồng ý", "sửa các mục 🔴 về dữ liệu cá nhân", hoặc khi audit phát hiện site thiếu chính sách (checklist 01-A) hay xin đồng ý sai cách (01-B, 01-C) và người dùng bảo sửa.

Mục tiêu: một bản **nháp** chính sách khớp với những gì site thật sự đang làm, cộng với code xin đồng ý đúng cách. Không phải văn bản copy chung chung.

## Nguyên tắc

1. **Chỉ viết những gì tìm được bằng chứng trong code.** Mỗi loại dữ liệu, mỗi bên thứ ba ghi trong chính sách phải truy được về một dòng code (form, script, SDK, API call). Không thêm "cho chắc" những thứ site không làm.
2. **Không bịa thông tin pháp nhân.** Tên đơn vị, mã số thuế/đăng ký kinh doanh, địa chỉ, email tiếp nhận yêu cầu, thời gian lưu trữ cụ thể: tìm trong site (footer, trang giới thiệu). Không tìm được thì để `[ĐIỀN: ...]`, không tự nghĩ ra.
3. **Không dẫn văn bản cũ.** Không dùng Nghị định 13/2023 (hết hiệu lực từ 01/01/2026). Căn cứ là Luật 91/2025/QH15 và NĐ 356/2025/NĐ-CP.
4. **Không cam kết thay chủ site.** Không viết "chúng tôi tuân thủ đầy đủ pháp luật", không hứa biện pháp bảo mật mà code không có (ví dụ "mã hóa đầu cuối" khi không thấy).
5. **Ghi rõ đây là bản nháp** ở đầu file và trong câu trả lời, khuyến nghị người dùng nhờ người làm luật xem lại trước khi đăng.
6. Thời hạn xử lý yêu cầu ghi trong chính sách phải đúng Điều 5 NĐ 356/2025 (xem checklist 01-A). Không rút ngắn hay kéo dài tùy ý.

## Bước 1: lập bảng dữ liệu từ code

Dựa vào output `scan.sh` và đọc thêm code, lập bảng trước khi viết (đưa bảng này cho người dùng xem cùng bản nháp):

| Dữ liệu | Thu ở đâu (file:dòng) | Mục đích | Gửi cho ai | Lưu ở đâu |
|---|---|---|---|---|
| Họ tên, SĐT, email | `form đặt hàng`, file:dòng | Giao hàng, liên hệ | [hãng vận chuyển nếu có] | [database/dịch vụ] |
| Hành vi duyệt web | Google Analytics, file:dòng | Thống kê | Google | Nước ngoài |

Nguồn để điền:
- **Loại dữ liệu:** các trường input của form (name, type, placeholder, label), field trong API/database schema, quyền app xin (camera, vị trí, danh bạ...).
- **Bên thứ ba:** script tracking (GA, Pixel, TikTok, Hotjar...), SDK (Firebase, AdMob, Sentry...), API gọi ra ngoài (OpenAI, Anthropic, Mailchimp, cổng thanh toán, vận chuyển), hosting.
- **Nơi lưu và chuyển ra nước ngoài:** host/database/dịch vụ đặt ở nước ngoài thì là chuyển dữ liệu xuyên biên giới theo Điều 20 khoản 1 Luật 91/2025. Ghi rõ trong chính sách và nhắc người dùng xem checklist 01-D về hồ sơ.
- **Dữ liệu nhạy cảm:** đối chiếu danh mục trong NĐ 356/2025 (vị trí, sinh trắc học, sức khỏe, tài chính/thẻ ngân hàng, hành vi trực tuyến...). Có thì tách mục riêng.
- **Trẻ em:** chỉ thêm mục trẻ em (Điều 24 Luật 91/2025) khi có dấu hiệu cụ thể: sản phẩm dành cho trẻ em (giáo dục, game, đồ chơi), form hỏi tuổi/ngày sinh, hoặc có cổng xác nhận độ tuổi. Site bán hàng thông thường thì bỏ mục này.

Mục đích mà code không cho thấy rõ (ví dụ thu SĐT để làm gì) thì suy từ ngữ cảnh form và ghi `[KIỂM TRA: mục đích suy ra từ form đặt hàng]` để người dùng xác nhận.

## Bước 2: soạn chính sách

Dùng khung `examples/privacy-policy-template.md`. Xóa các mục không áp dụng (không có tracking thì bỏ mục cookie; không chuyển ra nước ngoài thì bỏ mục đó), không để mục rỗng. Các dòng ví dụ trong bảng của khung (đơn vị vận chuyển, giỏ hàng, đăng nhập...) chỉ là ví dụ: thay bằng dữ liệu thật tìm được, không giữ dòng nào không có bằng chứng.

Ghi chú căn cứ (`> Căn cứ: ...`) giữ lại dưới dạng comment (HTML `<!-- -->` hoặc comment JSX) để người xem lại đối chiếu được; nhắc chủ site xóa khi đăng chính thức.

Viết bằng tiếng Việt dễ hiểu, câu ngắn. Người dùng cuối phải đọc hiểu được, không phải văn bản để đối phó.

Lưu file theo cấu trúc sẵn có của project (ví dụ `app/chinh-sach-bao-mat/page.tsx`, `pages/privacy.vue`, `chinh-sach-bao-mat.html`) và thêm link ở footer cùng tại các form thu thập dữ liệu. Nếu không rõ cấu trúc thì xuất file markdown và nói người dùng nơi nên đặt.

## Bước 3: sửa cách xin đồng ý

Chính sách đăng lên chưa đủ. Sửa luôn chỗ xin đồng ý theo mẫu phần "Form đồng ý" và "Banner cookie" trong `examples/privacy-policy-template.md`:

- **Form thu thập:** ô đồng ý không tích sẵn (khoản 3 Điều 6 NĐ 356/2025), có link tới chính sách (khoản 2 Điều 9 Luật 91/2025).
  - Form có nhiều mục đích (ví dụ đặt hàng + nhận khuyến mãi): ô bắt buộc cho mục đích chính, ô **riêng, không bắt buộc** cho marketing (Điều 9 khoản 4 điểm a, b; khoản 8 Điều 28 nếu dùng cho quảng cáo nhắm mục tiêu).
  - Form chỉ có một mục đích (ví dụ form đăng ký nhận tin): một ô đồng ý bắt buộc nêu rõ mục đích đó là đủ, vì đăng ký chính là đồng ý nhận tin.
  - Form chỉ thu thêm trường không cần cho mục đích (ví dụ form nhận tin qua email mà hỏi cả SĐT): gợi ý bỏ trường đó thay vì viết thêm mục đích.
- **Bỏ câu kiểu "tiếp tục sử dụng là đồng ý"** (Điều 9 khoản 4 điểm d).
- **Script tracking/quảng cáo:** chỉ nạp sau khi người dùng bấm đồng ý. Từ chối vẫn dùng được site.
- **Lưu bằng chứng đồng ý:** thời điểm, nội dung/phiên bản chính sách, mục đích đã đồng ý (khoản 1, 2 Điều 6 NĐ 356/2025: kiểm chứng được ai đồng ý, thời điểm và nội dung; bên kiểm soát phải chứng minh khi có tranh chấp). Với form: lưu ở server cùng bản ghi. Với banner cookie: lưu trong trình duyệt là tối thiểu; nếu site có backend thì gửi thêm một bản ghi ẩn danh (mã ngẫu nhiên, thời điểm, lựa chọn, phiên bản) về server. Không có backend thì ghi rõ giới hạn này trong báo cáo cho người dùng.
- **Rút lại đồng ý:** có cách rút dễ như lúc đồng ý (nút cài đặt cookie, link hủy đăng ký email, trang tài khoản) (Điều 10 Luật 91/2025). Link hủy đăng ký email phải kèm mã riêng cho từng người nhận, không làm endpoint hủy chỉ cần nhập email (ai cũng hủy được của người khác). Code chưa có phần gửi email thì chỉ ghi vào danh sách việc cần làm.
- **Chatbot AI:** nếu site có chatbot, áp dụng thêm checklist 07: báo rõ người dùng đang nói chuyện với AI, không để bot xưng là nhân viên thật, và nêu trong chính sách nội dung chat được gửi cho nhà cung cấp AI nào.

## Bước 4: báo lại cho người dùng

Trả lời ngắn gọn:
1. Đã tạo/sửa những file nào.
2. Bảng dữ liệu ở bước 1.
3. Danh sách chỗ `[ĐIỀN: ...]` và `[KIỂM TRA: ...]` người dùng phải tự hoàn thiện.
4. Những việc chính sách không giải quyết được: hồ sơ chuyển dữ liệu xuyên biên giới (checklist 01-D, áp dụng cả với hộ kinh doanh) và hồ sơ đánh giá tác động, nhân sự bảo vệ dữ liệu (01-E, trừ khi thuộc diện miễn trừ khoản 3 Điều 38).
5. Nhắc: đây là bản nháp, nên nhờ người làm luật xem lại trước khi đăng.
