# Checklist 3: An ninh mạng & lưu trữ dữ liệu

**Văn bản áp dụng:**
- Luật An ninh mạng 2025: Luật số 116/2025/QH15, thông qua 10/12/2025, hiệu lực 01/07/2026 ([thuvienphapluat](https://thuvienphapluat.vn/van-ban/cong-nghe-thong-tin/Luat-An-ninh-mang-2025-so-116-2025-QH15-666020.aspx)). Luật này kế thừa và hợp nhất Luật An ninh mạng 2018 và Luật An toàn thông tin mạng 2015. Hai luật cũ (Luật An ninh mạng 24/2018/QH14, Luật An toàn thông tin mạng 86/2015/QH13) hết hiệu lực từ 01/07/2026 theo Điều 44 khoản 2 ([trích theo điều](https://hethongphapluat.com/luat-an-ninh-mang-2025/dieu-44), [Apolat](https://apolatlegal.com/vi/laws/luat-an-ninh-mang-2025-so-116-2025-qh15/)).
- **Nghị định 333/2026/NĐ-CP**: hướng dẫn Luật An ninh mạng 2025, ban hành và có hiệu lực 19/08/2026 ([tóm tắt](https://hethongphapluat.com/nghi-dinh-333-2026-nd-cp-huong-dan-luat-an-ninh-mang.html), [Công báo PDF](https://congbaocdn.chinhphu.vn/180507251028987904/2026/9/4/470335-1787890927_v1_1788486330_signed.pdf)). Điều 16, 18 đã đối chiếu Công báo. Điều 19-31 theo trang tóm tắt và [bản tin EY](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-vn/technical/tax/documents/ey-en-decree-333-providing-detailed-guidance-on-a-number-of-articles-of-the-law-on-cybersecurity.pdf), chưa đối chiếu toàn văn.
- Nghị định 53/2022/NĐ-CP (hướng dẫn luật cũ): theo Điều 31 NĐ 333, hồ sơ đã tiếp nhận trước 19/08/2026 tiếp tục giải quyết theo NĐ 53. Trên thực tế NĐ 53 đã được NĐ 333 thay thế. Điều khoản bãi bỏ chính thức: CHƯA XÁC MINH.
- Nghị định 330/2026/NĐ-CP: xử phạt lĩnh vực an ninh mạng và bảo vệ dữ liệu cá nhân (xem checklist 08).

## A. Lưu trữ dữ liệu tại Việt Nam
- [ ] Xác định doanh nghiệp có thuộc diện phải lưu dữ liệu tại Việt Nam và có chi nhánh/văn phòng đại diện không (Điều 25 khoản 3 Luật 116/2025): lưu tại Việt Nam trong thời gian theo quy định của Chính phủ; doanh nghiệp nước ngoài thuộc diện này phải đặt chi nhánh hoặc văn phòng đại diện. Diện này là doanh nghiệp cung cấp dịch vụ trên mạng viễn thông/Internet/dịch vụ gia tăng, có thu thập, khai thác, phân tích, xử lý dữ liệu người dùng tại Việt Nam.
- [ ] Các loại dữ liệu phải lưu tại Việt Nam: theo Điều 19 NĐ 333/2026.
- [ ] **Doanh nghiệp nước ngoài: nghĩa vụ này có điều kiện, không phải mặc định** (Điều 19 khoản 3, khoản 6 NĐ 333/2026, theo bản tin EY). Chỉ áp dụng khi dịch vụ bị dùng để vi phạm pháp luật, doanh nghiệp không chấp hành yêu cầu (theo tóm tắt: 3 lần trong 6 tháng) và có Quyết định của Bộ trưởng Bộ Công an. Có 12 tháng kể từ Quyết định để lưu dữ liệu và đặt hiện diện tại Việt Nam; lưu tối thiểu 24 tháng (Điều 20 khoản 1).

## B. Nhật ký hệ thống (log)
- [ ] Lưu nhật ký hệ thống tối thiểu 12 tháng để phục vụ điều tra, xử lý vi phạm (Điều 16 khoản 6 điểm c NĐ 333/2026, đã đối chiếu Công báo; Điều 20 khoản 3 theo bản tin EY).
- [ ] Nếu là doanh nghiệp viễn thông, Internet cấp địa chỉ IP cho người dùng: lưu nhật ký cấp IP đầy đủ, liên tục tối thiểu 12 tháng (Điều 22 khoản 3 NĐ 333/2026, theo bản tin EY).
- [ ] Cung cấp được log cho cơ quan chuyên trách khi có yêu cầu hợp lệ.

## C. Biện pháp bảo vệ & sự cố
- [ ] Có biện pháp bảo mật tương xứng với dữ liệu đang xử lý: mã hóa dữ liệu nhạy cảm, kiểm soát truy cập, sao lưu, giám sát xâm nhập.
- [ ] Có quy trình ứng phó và báo cáo sự cố an ninh mạng (Điều 40 khoản 1 điểm c và Điều 41 khoản 3 Luật 116/2025).

## D. Nghĩa vụ của doanh nghiệp cung cấp dịch vụ trên không gian mạng (Điều 41, Điều 25 khoản 2 Luật 116/2025)
- [ ] Có quy trình xử lý yêu cầu xác minh, điều tra, phối hợp xử lý vi phạm từ cơ quan chuyên trách.

## E. Nội dung vi phạm trên nền tảng (site có nội dung người dùng đăng: bình luận, bài viết, livestream)
- [ ] Có cơ chế kiểm duyệt nội dung thuộc các hành vi bị cấm (Điều 7 Luật 116/2025).
- [ ] Gỡ nội dung vi phạm trong **24 giờ** kể từ khi lực lượng chuyên trách Bộ Công an yêu cầu, trường hợp khẩn cấp chậm nhất **06 giờ** (Điều 25 khoản 2 điểm b Luật 116/2025). Doanh nghiệp hosting, trung tâm dữ liệu cũng phải gỡ trong 24 giờ (Điều 18 khoản 2 NĐ 333/2026).

> Ngoài phạm vi checklist này: Điều 43 khoản 2 Luật 116/2025 chỉ sửa câu chữ ở Luật Bảo vệ quyền lợi người tiêu dùng ("an toàn, an ninh thông tin" thành "an ninh mạng"), không thêm nghĩa vụ mới ([trích theo điều](https://hethongphapluat.com/luat-an-ninh-mang-2025/dieu-43)).
