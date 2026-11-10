# Checklist 7: Minh bạch AI (site có chatbot hoặc nội dung do AI tạo)

**Văn bản áp dụng:**
- Luật Trí tuệ nhân tạo: Luật số 134/2025/QH15, thông qua 10/12/2025, hiệu lực 01/03/2026 (Điều 34) ([thuvienphapluat](https://thuvienphapluat.vn/van-ban/Cong-nghe-thong-tin/Luat-Tri-tue-nhan-tao-2025-so-134-2025-QH15-679013.aspx), [bản tiếng Anh](https://english.luatvietnam.vn/law-no-134-2025-qh15-dated-december-10-2025-of-the-national-assembly-on-artificial-intelligence-422299-doc1.html))
- Nghị định 142/2026/NĐ-CP: hướng dẫn Luật Trí tuệ nhân tạo, hiệu lực 01/05/2026. Cách thông báo và gắn nhãn ở Điều 18 ([lsvn](https://lsvn.vn/thong-bao-va-gan-nhan-nhan-biet-noi-dung-do-ai-tao-ra-the-nao-a172678.html))

## A. Xác định vai trò của website
Luật chia 2 vai trò, mỗi vai trò có nghĩa vụ khác nhau:
- [ ] **Nhà cung cấp:** tự phát triển hệ thống AI, hoặc đưa hệ thống AI ra thị trường dưới tên mình.
- [ ] **Bên triển khai:** dùng hệ thống AI trong phạm vi mình kiểm soát, cho mục đích nghề nghiệp, thương mại hoặc dịch vụ. Website doanh nghiệp nhúng chatbot (gọi API OpenAI/Anthropic/Gemini...) hoặc đăng nội dung AI thường thuộc nhóm này.
- [ ] Không thuộc diện điều chỉnh: dùng cho mục đích cá nhân, phi thương mại. Ví dụ blog cá nhân không kinh doanh.

## B. Chatbot và hệ thống AI tương tác với người dùng (Điều 11 khoản 1)
- [ ] Người dùng biết mình đang nói chuyện với AI. Ví dụ: ghi "Trợ lý AI" ở đầu khung chat, không đặt tên hay ảnh đại diện khiến người dùng tưởng là nhân viên thật.
- [ ] Nghĩa vụ này giao cho **nhà cung cấp** (thiết kế hệ thống). Bên triển khai nên kiểm tra giao diện mình nhúng có thể hiện điều này không.
- [ ] Tin nhắn người dùng gõ vào chatbot có thể chứa dữ liệu cá nhân và được gửi tới bên thứ ba (thường ở nước ngoài) → kiểm tra thêm checklist 01 mục B (đồng ý) và D (chuyển dữ liệu xuyên biên giới).

## C. Nội dung do AI tạo (Điều 11 khoản 2, 3, 4)
- [ ] Văn bản, ảnh, âm thanh, video do AI tạo hoặc chỉnh sửa, nếu có thể gây nhầm lẫn về tính xác thực, phải được thông báo rõ (khoản 3, nghĩa vụ của bên triển khai). Mốc **trước hoặc tại thời điểm** người xem tiếp cận nội dung đến từ Điều 18 NĐ 142/2026.
- [ ] Ảnh, âm thanh, video mô phỏng người thật hoặc tái hiện sự kiện có thật (deepfake) phải có **nhãn dễ nhận biết** (khoản 4). Với tác phẩm điện ảnh, nghệ thuật, sáng tạo, nhãn không được cản trở việc thưởng thức tác phẩm.
- [ ] Âm thanh, hình ảnh, video do AI tạo được đánh dấu ở **định dạng máy đọc được** (ví dụ metadata, watermark kỹ thuật). Đây là nghĩa vụ của nhà cung cấp (khoản 2).
- [ ] Vị trí đặt nhãn (Điều 18 NĐ 142/2026): trên chính nội dung, ở tiêu đề hoặc chú thích, trên giao diện nền tảng, hoặc bằng thông báo âm thanh. Bộ Khoa học và Công nghệ sẽ ban hành hướng dẫn kỹ thuật.
- [ ] Thông tin minh bạch được duy trì suốt thời gian cung cấp hệ thống hoặc nội dung (khoản 5). Đánh số khoản 4-6 Điều 11 giữa các nguồn chưa thống nhất: cần tra cứu lại.

**Không cần gắn nhãn** khi (Điều 18 khoản 4 NĐ 142/2026, theo nguồn thứ cấp):
- chỉ chỉnh sửa kỹ thuật, không đổi bản chất nội dung
- sửa chính tả, dịch thuật, tóm tắt, diễn giải mà không làm sai lệch nội dung cơ bản
- dùng nội bộ, không cung cấp ra công cộng
- nội dung nghiên cứu trong môi trường kiểm soát, chưa công bố

## D. Phân loại rủi ro (Điều 9)
- [ ] Xác định mức rủi ro của hệ thống AI (Điều 9 khoản 1, theo nguồn thứ cấp): **cao** là có thể gây thiệt hại đáng kể tới tính mạng, sức khỏe, quyền lợi hợp pháp; **trung bình** là có thể gây nhầm lẫn, thao túng do người dùng không biết đang tương tác với AI; **thấp** là phần còn lại. Căn cứ phân loại: tác động tới quyền con người, an toàn, an ninh; lĩnh vực sử dụng; quy mô người dùng (khoản 2). Chatbot không cho người dùng biết là AI có thể rơi vào mức trung bình.
- [ ] Hệ thống rủi ro cao (ví dụ AI ra quyết định trong tín dụng, tuyển dụng, y tế): phải đánh giá sự phù hợp trước khi đưa vào sử dụng (Điều 13 khoản 1). Chỉ hệ thống thuộc danh mục bắt buộc do Thủ tướng ban hành mới phải do tổ chức được đăng ký đánh giá; còn lại nhà cung cấp tự đánh giá hoặc thuê đánh giá (khoản 2, 4).
- [ ] Cung cấp cho người bị ảnh hưởng thông tin về chức năng, cách vận hành, cảnh báo rủi ro (Điều 14 khoản 1 điểm e, khoản 2 điểm đ, theo nguồn thứ cấp). Quyền khiếu nại, yêu cầu con người xem xét lại: CHƯA XÁC MINH.

## E. Thời hạn chuyển tiếp (Điều 35)
- [ ] Hệ thống AI đã vận hành trước 01/03/2026 có thời hạn để tuân thủ: **18 tháng** với y tế, giáo dục, tài chính (tức đến khoảng 01/09/2027); **12 tháng** với lĩnh vực khác (khoảng 01/03/2027). Trong thời gian này vẫn được hoạt động, trừ khi bị đánh giá là có nguy cơ gây thiệt hại nghiêm trọng.
- [ ] Hệ thống đưa vào sau 01/03/2026: áp dụng ngay.

## Mức phạt
Điều 29 khoản 5 Luật 134/2025 giao Chính phủ quy định xử phạt hành chính. Chưa thấy nghị định xử phạt riêng về AI tại thời điểm cập nhật. Không dùng con số "2 tỷ đồng" báo chí hay nhắc: đó là con số trong dự thảo luật, không phải luật đã ban hành.
