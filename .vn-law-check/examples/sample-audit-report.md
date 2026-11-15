# Mẫu báo cáo audit pháp lý website

Có 2 mẫu. Chọn theo mức ở bước triage (`references/00-triage.md`):

- **Mẫu A: rút gọn**: site mức 0-1 (tĩnh, hoặc chỉ có form liên hệ/analytics/chatbot).
- **Mẫu B: đầy đủ**: site mức 2-3 (bán hàng, nền tảng).

Ở cả 2 mẫu, chỉ liệt kê lĩnh vực có áp dụng. Các lĩnh vực không áp dụng gom vào 1 dòng, không kẻ bảng ⚪.

---

## Mẫu A: rút gọn (site mức 0-1)

### Ví dụ mức 0: blog cá nhân tĩnh

> **Rà soát pháp lý: minh.dev** (02/11/2026)
>
> **Kết quả quét:** mức 0, site tĩnh. Không có form, không có script theo dõi, không bán hàng, không có tài khoản người dùng, không có chatbot.
>
> **Kết luận:** site không thu thập dữ liệu cá nhân và không kinh doanh, nên theo khung pháp luật hiện hành không phát sinh nghĩa vụ đáng kể về dữ liệu cá nhân, TMĐT, an ninh mạng hay bảo vệ người tiêu dùng. Không cần audit chi tiết.
>
> **Khi nào cần rà lại:** khi thêm form liên hệ/đăng ký email, gắn Google Analytics/Facebook Pixel, mở bán hàng, hoặc thêm chatbot.
>
> *Đây là rà soát sơ bộ do AI thực hiện, không phải tư vấn pháp lý.*

### Ví dụ mức 1: landing page có form liên hệ và Google Analytics

> **Rà soát pháp lý: studio-an.vn** (02/11/2026)
>
> **Kết quả quét:** mức 1. Có form liên hệ (`index.html:14`, gửi qua Formspree) và Google Analytics (`index.html:5`). Không bán hàng, không có tài khoản người dùng.
>
> **Áp dụng:** Bảo vệ dữ liệu cá nhân, mục A, B, C (`references/01-personal-data-protection.md`).
>
> | Mức | Mục | Phát hiện | Căn cứ | Đề xuất |
> |---|---|---|---|---|
> | 🔴 | B. Consent | Form thu thập họ tên, email nhưng không có thông báo mục đích xử lý hay ô đồng ý | Luật BVDLCN 91/2025/QH15, NĐ 356/2025/NĐ-CP | Thêm 1 dòng nêu mục đích + ô đồng ý (không tích sẵn) cạnh nút Gửi, lưu lại thời điểm đồng ý |
> | 🔴 | C. Cookie | Google Analytics chạy ngay khi tải trang, trước khi người dùng đồng ý | Luật BVDLCN 91/2025/QH15 | Thêm banner cookie, chỉ nạp GA sau khi người dùng đồng ý |
> | 🟡 | A. Chính sách | Không có trang chính sách bảo vệ dữ liệu cá nhân | Luật BVDLCN 91/2025/QH15 | Thêm trang chính sách ngắn, link ở footer |
>
> **Không áp dụng:** TMĐT, bảo vệ người tiêu dùng, giao dịch điện tử (không bán hàng); an ninh mạng (không xử lý dữ liệu quy mô lớn); quảng cáo (không có nội dung quảng cáo); AI (không có chatbot). Formspree đặt server ở nước ngoài → nếu lượng liên hệ lớn, xem thêm mục D (chuyển dữ liệu xuyên biên giới).
>
> *Đây là rà soát sơ bộ do AI thực hiện, không phải tư vấn pháp lý. Xác minh lại văn bản tại thuvienphapluat.vn/vbpl.vn và tham vấn luật sư trước khi quyết định.*

---

## Mẫu B: đầy đủ (site mức 2-3)

### Rà soát pháp lý: [Tên website]

**Ngày audit:** [ngày]
**Kết quả quét:** mức [2/3]. [tóm tắt tín hiệu kèm file:dòng, ví dụ: giỏ hàng ở `pages/product.html:7`, cổng VNPay ở `checkout.js:2`]
**Phạm vi rà soát:** [chỉ liệt kê checklist có áp dụng]

#### Tổng quan

Chỉ ghi các lĩnh vực có áp dụng.

| Lĩnh vực | 🔴 | 🟡 | 🟢 |
|---|---|---|---|
| Bảo vệ dữ liệu cá nhân | | | |
| Thương mại điện tử | | | |
| Bảo vệ người tiêu dùng | | | |
| [lĩnh vực khác nếu áp dụng] | | | |

**Không áp dụng:** [gom 1 dòng kèm lý do, ví dụ: "Minh bạch AI: không có chatbot hay nội dung AI"]

#### 🔴 Cần xử lý ngay
- **[Mục checklist]**: [vấn đề, kèm file:dòng hoặc URL trang]. Căn cứ: [số hiệu văn bản, Điều/khoản nếu có]. Đề xuất: [việc cụ thể cần làm]

#### 🟡 Nên cải thiện
- ...

#### 🟢 Đạt yêu cầu
- ...

#### Mức phạt tham khảo
[Chỉ nêu với các mục 🔴, theo `references/08-penalties-reference.md`. Ghi "mức tối đa theo quy định tham khảo được", không khẳng định site sẽ bị phạt bao nhiêu.]

#### Giới hạn & khuyến nghị

> Báo cáo này do AI tạo dựa trên bộ checklist tổng hợp từ văn bản pháp luật công khai, **không phải ý kiến tư vấn pháp lý chính thức**. Khung pháp lý Việt Nam về dữ liệu cá nhân, TMĐT và an ninh mạng vừa thay đổi lớn trong 2025-2026. Trước khi quyết định, hãy xác minh lại từng văn bản tại thuvienphapluat.vn/vbpl.vn và tham vấn luật sư.
