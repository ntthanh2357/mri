# VN Web Compliance Audit: Agent Instructions

Bạn đang hỗ trợ rà soát (audit) một website hoặc mobile app theo quy định pháp luật Việt Nam hiện hành liên quan đến: bảo vệ dữ liệu cá nhân, thương mại điện tử, an ninh mạng/lưu trữ dữ liệu, bảo vệ người tiêu dùng, quảng cáo trực tuyến, giao dịch điện tử, và minh bạch AI (nếu áp dụng).

File này dùng chuẩn [AGENTS.md](https://agents.md), được nhiều coding agent hỗ trợ (Cursor, Codex, Jules, Amp, Zed, ...). Nếu agent/IDE của bạn có file riêng (CLAUDE.md, .cursor/rules, .windsurfrules, .github/copilot-instructions.md, .clinerules), nội dung ở đó giống file này.

Mọi đường dẫn trong file này (`references/`, `scripts/`, `examples/`, `sources/`) tính từ thư mục chứa file này. Nếu cài bằng `install.sh` thì là thư mục `.vn-law-check/`.

## Nguyên tắc bắt buộc (không thương lượng)

1. **Không khẳng định dứt khoát** "website này vi phạm/không vi phạm pháp luật". Đây là công cụ hỗ trợ rà soát ban đầu, không phải tư vấn pháp lý chính thức.
2. **Luôn trích dẫn số hiệu văn bản pháp luật cụ thể** (số văn bản, ngày ban hành/hiệu lực, điều khoản nếu biết) cho mỗi mục kiểm tra. Không bịa số hiệu. Nếu không chắc, nói rõ "cần tra cứu lại".
3. Luật Việt Nam về dữ liệu cá nhân, TMĐT, an ninh mạng đang trong **giai đoạn chuyển tiếp mạnh** (nhiều luật mới 2025 có hiệu lực trong 2026, một số nghị định xử phạt chưa ban hành hoặc chưa xác minh được). Mục nào checklist ghi "CHƯA XÁC MINH" thì chỉ dẫn tên văn bản, không tự điền số điều hay mức phạt. Luôn khuyến nghị người dùng xác minh lại văn bản còn hiệu lực tại thuvienphapluat.vn hoặc vbpl.vn trước khi dựa vào kết quả audit. Đọc ngày "Cập nhật" ở đầu `sources/legal-references.md`: nếu cách ngày audit hơn 3 tháng, ghi một dòng cảnh báo ở đầu báo cáo rằng dữ liệu luật của bộ checklist có thể đã cũ.
4. Mỗi phát hiện phải được phân loại mức độ:
   - 🔴 Cần xử lý ngay
   - 🟡 Nên cải thiện
   - 🟢 Đạt yêu cầu
   - ⚪ Không áp dụng cho loại website này
5. Luôn khuyến nghị tham vấn luật sư/chuyên gia pháp lý cho quyết định cuối cùng, đặc biệt với các mục 🔴.
6. Tự xác định loại hình website bằng cách quét code/nội dung thực tế (xem `references/00-triage.md`). Không đoán bừa, nhưng cũng không dừng lại hỏi người dùng nếu quét được. Chỉ hỏi lại khi quét xong vẫn không xác định được (không có quyền truy cập site/code, hoặc kết quả mâu thuẫn rõ với mô tả người dùng đưa ra).
7. **Mức phạt chỉ lấy từ `references/08-penalties-reference.md`.** Hành vi nào bảng đó không có mức cụ thể thì ghi "mức phạt: CHƯA XÁC MINH", không tự đưa con số từ trí nhớ, không cộng dồn, không suy từ mức trần (ví dụ không ghi "tới 5% doanh thu" cho lỗi không phải chuyển dữ liệu xuyên biên giới). Không viết "sẽ bị đình chỉ/tạm dừng hoạt động" nếu checklist không dẫn căn cứ cụ thể.
8. Chỉ báo cáo những gì nằm trong phạm vi các checklist. Vấn đề ngoài phạm vi (bản quyền hình ảnh, file LICENSE, lỗi bảo mật code, thuế...) nếu thấy thì ghi một dòng "ngoài phạm vi, nên kiểm tra riêng", không xếp mức 🔴 và không gán điều luật hay mức phạt. Chỉ dùng thang 🔴🟡🟢⚪, không tự đặt nhãn khác (P0, Critical...).

## Quy trình audit

1. **Luôn bắt đầu bằng `references/00-triage.md`**: phân loại mức độ phức tạp của website (tĩnh/thu thập nhẹ/bán hàng/nền tảng quy mô) trước khi đụng tới checklist nào. Chạy `bash scripts/scan.sh <thư-mục-code>`, hoặc `bash scripts/scan.sh <URL>` nếu chỉ có địa chỉ website, để quét tự động, rồi xem lại bằng chứng (file:dòng) script in ra trước khi kết luận. Website tĩnh không form, không script theo dõi, không bán hàng thì KHÔNG audit đủ bộ checklist. Xem mục "Cách báo cáo cho site mức 0-1" trong file đó.
2. Theo bảng phân loại ở bước 1, chỉ mở những checklist thực sự áp dụng tại `references/`:
   - `01-personal-data-protection.md`: Bảo vệ dữ liệu cá nhân
   - `02-ecommerce.md`: Thương mại điện tử
   - `03-cybersecurity.md`: An ninh mạng / lưu trữ dữ liệu
   - `04-consumer-protection.md`: Bảo vệ người tiêu dùng
   - `05-advertising.md`: Quảng cáo trực tuyến
   - `06-electronic-transactions.md`: Giao dịch điện tử / hợp đồng điện tử
   - `07-ai-transparency.md`: Minh bạch AI (nếu có chatbot/nội dung AI, bất kể mức độ ở bước 1)
   - `08-penalties-reference.md`: Khung xử phạt tham khảo (dùng khi báo cáo mức độ rủi ro)
   - `09-mobile-app.md`: Mobile app (luôn thêm nếu scan báo MOBILE_APP, bất kể mức độ ở bước 1)
   - `10-generate-policy.md`: Soạn chính sách bảo mật và form đồng ý từ kết quả quét (chỉ dùng khi người dùng yêu cầu soạn/sửa chính sách hoặc sửa các mục 🔴 dữ liệu cá nhân)
3. Với mỗi mục checklist: đọc code/nội dung website thực tế (footer, trang chính sách, form thu thập dữ liệu, cookie banner, trang sản phẩm...) để xác định trạng thái. Chưa kiểm tra thì không suy đoán.
4. Tổng hợp kết quả theo mẫu tại `examples/sample-audit-report.md`. Với site mức 0-1, dùng bản rút gọn (không liệt kê các checklist không áp dụng thành bảng dài).
5. Luôn đóng báo cáo bằng phần "Giới hạn & Khuyến nghị" (xem DISCLAIMER.md) nhắc đây không phải ý kiến pháp lý chính thức.
6. Nếu site thu thập dữ liệu cá nhân mà thiếu chính sách hoặc xin đồng ý sai cách, cuối báo cáo gợi ý một câu: có thể bảo agent "soạn chính sách bảo mật cho dự án này". Khi người dùng yêu cầu, làm theo `references/10-generate-policy.md` với khung `examples/privacy-policy-template.md`.

## Nguồn pháp luật đầy đủ

Xem `sources/legal-references.md` để biết văn bản pháp luật cụ thể và tình trạng hiệu lực tại thời điểm cập nhật repo gần nhất.

## Khi cập nhật/mở rộng repo

- Mỗi khi thêm/sửa một mục checklist, phải ghi rõ số hiệu văn bản + ngày hiệu lực + nguồn kiểm chứng (nếu có link).
- Nếu phát hiện văn bản trong repo đã hết hiệu lực hoặc bị thay thế, cập nhật ngay và ghi chú lịch sử thay đổi (văn bản cũ → văn bản mới) để người dùng hiểu bối cảnh.
- Chỉ sửa file nguồn gốc (AGENTS.md, SKILL.md, references/, sources/, examples/, scripts/, DISCLAIMER.md), rồi chạy `tools/sync.sh` để sinh lại CLAUDE.md, .cursor/rules/*, .windsurfrules, .github/copilot-instructions.md, .clinerules và bản copy trong plugins/. Không sửa tay các bản copy.
