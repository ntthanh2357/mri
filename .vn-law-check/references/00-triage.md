# Bước 0: Phân loại mức độ trước khi audit

Làm bước này trước khi mở bất kỳ checklist nào. Mục tiêu: không áp đủ 8 checklist lên một trang blog cá nhân không có gì để audit, và không bỏ sót website thực sự có rủi ro.

**Tự quét để xác định, không hỏi người dùng những câu này.**

Có source code: chạy `bash scripts/scan.sh <thư-mục-code>`. Chỉ có URL: chạy `bash scripts/scan.sh https://ten-mien.vn`. Script sẽ tải trang chủ, các trang chính sách/liên hệ/giỏ hàng được link từ trang chủ, và file JS cùng tên miền về thư mục tạm rồi quét. Sau đó đọc trang chính sách trong thư mục đó để audit nội dung.

Script in ra từng tín hiệu kèm bằng chứng (file:dòng:đoạn khớp) và gợi ý mức. Xem lại bằng chứng, vì script chỉ grep nên có thể bắt nhầm (ví dụ chữ "thanh toán" trong một bài blog). Quét qua URL không thấy code phía server: chatbot gọi AI qua server, dữ liệu lưu ở đâu. Những điểm đó cần xem trực tiếp trên trang hoặc hỏi chủ site.

Các câu hỏi script đang trả lời (dùng để kiểm tra lại bằng tay khi cần):

- Trang có form nào thu thập thông tin không (liên hệ, đăng ký, bình luận, newsletter)? → tìm thẻ `<form>`, input type email/tel, hoặc tích hợp form (Formspree, Google Form nhúng...).
- Trang có gắn Google Analytics, Facebook Pixel, hay script theo dõi nào không? → grep `gtag`, `ga(`, `fbq(`, `analytics`, hoặc các domain tracking phổ biến trong HTML/JS.
- Trang có giỏ hàng/thanh toán/bán sản phẩm, dịch vụ không? → tìm trang `/cart`, `/checkout`, tích hợp cổng thanh toán (VNPay, Momo, Stripe...), nút "Thêm vào giỏ"/"Mua ngay".
- Trang có tài khoản người dùng (đăng ký/đăng nhập) không? → tìm route `/login`, `/register`, `/account`, cơ chế session/auth trong code.
- Trang có chatbot AI hoặc nội dung do AI tạo không? → tìm widget chat, tích hợp API AI (OpenAI, Anthropic...), ghi chú "AI-generated" trong nội dung.
- Trang host ở đâu: Việt Nam hay nước ngoài? → xem cấu hình deploy (Vercel/Netlify/AWS region/Cloudflare), DNS, hoặc file cấu hình hosting trong repo.

Chỉ hỏi ngược lại người dùng khi quét xong vẫn không xác định được (ví dụ: không có quyền truy cập code/site, hoặc kết quả quét mâu thuẫn rõ ràng với mô tả người dùng đưa ra). Không hỏi để xác nhận những gì đã tự kiểm tra được.

## Mức độ áp dụng

| Mức | Đặc điểm | Checklist cần áp dụng |
|---|---|---|
| 0: Tĩnh hoàn toàn | Không form, không script theo dõi, không tài khoản, chỉ là trang giới thiệu/blog/CV/portfolio tĩnh | Không audit đầy đủ. Báo 1 dòng: "Site tĩnh, không phát sinh nghĩa vụ pháp lý đáng kể theo luật hiện hành. Có thể bỏ qua audit chi tiết, nhưng nên rà lại nếu sau này thêm form hoặc script theo dõi." |
| 1: Thu thập nhẹ | Có form liên hệ/newsletter/bình luận, hoặc gắn analytics/pixel, nhưng không bán hàng | `01-personal-data-protection.md`, chỉ mục A, B, C (chính sách, consent, cookie). Bỏ qua mục D, E (chuyển dữ liệu xuyên biên giới, DPIA, chỉ định DPO) trừ khi có lưu hoặc gửi dữ liệu cá nhân qua dịch vụ ở nước ngoài. |
| 2: Bán hàng/TMĐT | Có giỏ hàng, thanh toán, bán sản phẩm/dịch vụ | `01` (đầy đủ) + `02-ecommerce.md` + `04-consumer-protection.md`. Thêm `05-advertising.md` nếu có quảng cáo/KOL, `06-electronic-transactions.md` nếu có hợp đồng điện tử. |
| 3: Nền tảng/SaaS quy mô | Có tài khoản người dùng, xử lý dữ liệu lớn, hoặc là nền tảng cho bên thứ ba | Toàn bộ `01`-`08`. |

Bất kể mức nào ở trên: nếu có chatbot AI hoặc nội dung AI-generated, luôn thêm `07-ai-transparency.md`. Chatbot nhận tin nhắn tự do của người dùng rồi gửi sang bên thứ ba (OpenAI, Anthropic...) thì tính tối thiểu mức 1, vì người dùng có thể gõ thông tin cá nhân vào.

## Tracking chạy trước hay sau khi đồng ý

Khi có TRACKING, `scan.sh` in thêm `TRACKING_CONSENT`:
- `static`: script theo dõi viết thẳng trong HTML (`TRACKING_PRELOAD`), chạy ngay khi tải trang. Dấu hiệu khá chắc chắn cho mục 01-C 🔴, trừ khi site dùng thư viện đồng ý có chế độ tự chặn script (script sẽ in kèm ghi chú nếu thấy thư viện như vậy).
- `gated`: có dấu hiệu chỉ nạp tracking sau khi đồng ý (thư viện quản lý đồng ý, Google Consent Mode, banner tự viết). Đây chỉ là dấu hiệu, không đủ để chấm 🟢: đọc code nạp script hoặc mở trình duyệt xem có request tới Google/Facebook trước khi bấm đồng ý không.
- `unknown`: có tracking nhưng không thấy cơ chế xin đồng ý nào. Thường do tracking được nạp qua JS bundle hoặc Tag Manager; kiểm tra thủ công.

## Mobile app

`scan.sh` tự nhận ra mobile app (Flutter, React Native, Expo, Android, iOS) qua `pubspec.yaml`, `package.json`, `AndroidManifest.xml`, `Info.plist`. Với app, script liệt kê thêm:
- **PERMISSIONS:** quyền app xin (vị trí, danh bạ, camera, micro, SMS...)
- **SDK_TRACKING:** SDK analytics, attribution (Firebase Analytics, Facebook SDK, AppsFlyer...)
- **ADS_SDK:** SDK quảng cáo (AdMob, AppLovin...)
- **ACCOUNT_DELETE:** app có đăng nhập thì có chức năng xóa tài khoản không

Mức độ xếp như website. App xin quyền truy cập hoặc có SDK tracking/quảng cáo thì tối thiểu là mức 1, vì đã thu dữ liệu cá nhân dù không có form nào. Luôn thêm `09-mobile-app.md` cho app.

## Quy mô chủ site

Site của hộ kinh doanh hoặc doanh nghiệp siêu nhỏ được miễn một phần nghĩa vụ dữ liệu cá nhân theo khoản 3 Điều 38 Luật 91/2025 (doanh nghiệp nhỏ, khởi nghiệp được hoãn 5 năm theo khoản 2; Điều 38 không nhắc tới cá nhân. Luật áp dụng cả với cá nhân (điểm a khoản 2 Điều 1) và không thấy điều nào loại trừ việc xử lý vì mục đích cá nhân, nên site cá nhân có thu dữ liệu vẫn thuộc diện điều chỉnh; khi kết luận cho site cá nhân, nhắc nên hỏi người làm luật):
- miễn lập hồ sơ đánh giá tác động xử lý dữ liệu (DPIA, Điều 21)
- miễn cập nhật hồ sơ (Điều 22)
- miễn chỉ định nhân sự bảo vệ dữ liệu (khoản 2 Điều 33)

Không miễn hồ sơ chuyển dữ liệu xuyên biên giới (khoản 2 Điều 20): site dùng hosting, database, API ở nước ngoài vẫn phải xét mục D checklist 01.

Không được miễn nếu trực tiếp xử lý dữ liệu nhạy cảm, xử lý dữ liệu của số lượng lớn chủ thể, hoặc kinh doanh dịch vụ xử lý dữ liệu. Xem đầu checklist 01.

Đoán quy mô từ chính site (trang giới thiệu, footer, thông tin đăng ký kinh doanh). Không đoán được thì ghi rõ trong báo cáo là mục D, E checklist 01 "mục E áp dụng nếu không thuộc diện miễn trừ khoản 3 Điều 38", thay vì dừng lại hỏi.

## Cách báo cáo cho site mức 0-1

- Không liệt kê đủ 8 bảng checklist với hàng loạt ⚪. Báo cáo sẽ loãng và không ai đọc hết.
- Chỉ nêu phần áp dụng được, kèm 1 dòng tóm tắt lý do các phần còn lại không áp dụng (ví dụ: "Không áp dụng TMĐT/an ninh mạng/quảng cáo vì site không bán hàng, không thu thập dữ liệu quy mô, không host ở nước ngoài").
- Nếu người dùng muốn xem đầy đủ cả 8 checklist cho chắc (ví dụ để đối chiếu thủ công), hỏi lại trước khi xuất báo cáo đầy đủ thay vì tự động liệt kê hết.
