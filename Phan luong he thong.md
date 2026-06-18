# Module

**1\. Module Quản lý Định danh và Phân quyền (Auth & Identity)**

Module này đóng vai trò "xương sống" để xác định ai đang truy cập và họ có quyền làm gì.

* **Quản lý đối tượng:** Thiết lập hệ thống khóa định danh. Với bệnh nhân là **CCCD**; với bệnh viện là **Mã y tế** và **Số bệnh án**.  
* **Phân quyền truy cập (RBAC):** Cài đặt quyền Đọc/Ghi cho từng vai trò:  
  * **Bác sĩ:** Đọc/ghi hồ sơ bệnh nhân mình phụ trách.  
  * **Điều dưỡng:** Ghi phiếu chăm sóc, theo dõi sinh hiệu.  
  * **Kế hoạch tổng hợp:** Cấp tóm tắt hồ sơ bệnh án.  
  * **Bệnh nhân:** Chỉ có quyền quản lý kho cá nhân của mình.

**2\. Module Phân hệ Bệnh viện (EMR Management)**

Tập trung vào quy trình vận hành và lưu trữ tài liệu nội bộ của cơ sở y tế.

* **Quản lý Lượt điều trị:** Lưu trữ thông tin theo lượt khám (Ngoại trú, Nội trú, Cấp cứu), Khoa điều trị và Đối tượng thanh toán.  
* **Lưu trữ hồ sơ nội bộ:** Xây dựng form và database cho các loại giấy tờ không phát cho bệnh nhân như:  
  * **Phiếu chăm sóc (Cấp 1, 2, 3):** Theo dõi sinh hiệu, chăm sóc hàng ngày.  
  * **Biên bản hội chẩn:** Lưu kết luận và hướng điều trị của hội đồng chuyên môn.  
* **Quy trình phê duyệt:** Quản lý trạng thái ký số và phê duyệt của Trưởng khoa hoặc Ban giám đốc đối với Giấy ra viện hoặc Phiếu chuyển tuyến.

**3\. Module Kho hồ sơ Bệnh nhân (PHR Management)**

Xây dựng giao diện và tính năng cho người dùng cá nhân tự quản lý sức khỏe.

* **Phân loại tài liệu:** Chia kho lưu trữ thành 4 nhóm chính: Hành chính, Lâm sàng, Cận lâm sàng và Pháp lý (tổng cộng 12 loại tài liệu).  
* **Bộ lọc tìm kiếm:** Cho phép bệnh nhân tìm kiếm hồ sơ theo **Ngày khám**, **Cơ sở y tế** hoặc **Loại lượt** (nội/ngoại trú).  
* **Tính năng tải lên:** Hỗ trợ bệnh nhân tải lên bản scan hoặc ảnh chụp các giấy tờ như Toa thuốc, Giấy ra viện, hoặc Phiếu thu viện phí.

**4\. Module Xử lý Dữ liệu và Tài liệu (Document Engine)**

Module kỹ thuật để xử lý các định dạng file và cấu trúc dữ liệu y tế.

* **Quản lý Metadata:** Mỗi tài liệu khi lưu phải đi kèm: Ngày phát hành, Cơ sở y tế, Bác sĩ ký và liên kết với Lượt khám tương ứng.  
* **Xử lý hình ảnh chuyên sâu:** Kết nối với hệ thống **PACS** để lưu trữ và hiển thị ảnh **DICOM** từ các kết quả CT-Scan và MRI.  
* **Quản lý kết quả Xét nghiệm:** Tiếp nhận dữ liệu từ hệ thống LIS để đổ vào các mẫu Phiếu kết quả xét nghiệm huyết học và hóa sinh.

**5\. Module Tương tác và Đồng bộ (Integration & Interaction)**

Giúp luồng thông tin giữa Bệnh viện và Bệnh nhân được thông suốt.

* **Yêu cầu hồ sơ:** Xây dựng tính năng gửi "Giấy đề nghị cung cấp bản tóm tắt hồ sơ bệnh án" từ phía bệnh nhân.  
* **Đồng bộ dữ liệu:** Thiết lập cơ chế đẩy dữ liệu từ hệ thống EMR của bệnh viện sang kho PHR của bệnh nhân khi có yêu cầu được phê duyệt.  
* **Xuất bản tài liệu:** Tính năng xuất file PDF có chữ ký số cho các loại giấy tờ như Giấy chuyển tuyến hay Giấy ra viện để bệnh nhân sử dụng cho mục đích bảo hiểm hoặc chuyển viện.

**Gợi ý phân chia nhóm:**

* **Nhóm Back-end:** Module 1, Module 4, Module 5\.  
* **Nhóm Front-end (Web):** Module 2 (Dashboard cho nhân viên y tế), Module 3 (Dashboard cho bệnh nhân).  
* **Nhóm Database/Data Engineer:** Thiết kế cấu trúc cho 14 loại tài liệu y tế và Metadata đi kèm.

 

# Phân luồng

**1\. Luồng Hoạt động tại Bệnh viện (Hệ thống EMR)**

Luồng này phục vụ việc vận hành, quản lý chuyên môn và lưu trữ hồ sơ bệnh án chính thức.

* **Bước 1: Tiếp nhận và Đăng ký:**  
  * Nhân viên tiếp tân tiếp nhận bệnh nhân, tạo lượt khám và cấp **Mã y tế (ID)** cùng **Số bệnh án (SBA)**.  
  * Ghi nhận thông tin hành chính và sinh hiệu ban đầu (Mạch, HA, SpO2...) vào **Phiếu thông tin khám bệnh**.  
* **Bước 2: Khám bệnh và Chỉ định:**  
  * Bác sĩ khám lâm sàng và thực hiện y lệnh thông qua **Phiếu chỉ định dịch vụ** (Xét nghiệm, X-quang, CT/MRI) trên phần mềm.  
* **Bước 3: Thanh toán viện phí:**  
  * Đối với bệnh nhân thu phí, thực hiện đóng tiền tại phòng tài vụ và nhận **Phiếu thu viện phí** trước khi thực hiện dịch vụ.  
* **Bước 4: Thực hiện Cận lâm sàng:**  
  * Kỹ thuật viên thực hiện xét nghiệm hoặc chẩn đoán hình ảnh. Kết quả (như **Phiếu kết quả xét nghiệm máu**, **Kết quả CT-Scan/MRI**) được đẩy tự động từ hệ thống LIS/PACS vào hồ sơ EMR.  
* **Bước 5: Điều trị và Chăm sóc nội bộ:**  
  * **Nội trú:** Điều dưỡng ghi nhận diễn biến hàng ngày vào **Phiếu theo dõi và chăm sóc (Cấp 1/2/3)**.  
  * **Chuyên môn phức tạp:** Thực hiện **Hội chẩn** và lưu biên bản vào hệ thống.  
  * **Can thiệp:** Bác sĩ tư vấn và ký **Giấy cam kết chấp thuận phẫu thuật/thủ thuật** cùng bệnh nhân.  
* **Bước 6: Kết thúc điều trị:**  
  * Bác sĩ cấp **Giấy ra viện**, **Toa thuốc** hoặc **Phiếu chuyển tuyến** (nếu cần chuyển viện).  
  * Hồ sơ được ký số và lưu trữ dài hạn (≥15 năm) theo quy định.

**2\. Luồng Hoạt động của Bệnh nhân (Kho Hồ sơ cá nhân \- PHR)**

Luồng này là kho lưu trữ cá nhân giúp bệnh nhân tự quản lý dữ liệu sức khỏe của mình từ nhiều bệnh viện khác nhau.

* **Bước 1: Định danh người dùng:** Bệnh nhân sử dụng **CCCD** làm khóa chính để quản lý toàn bộ hồ sơ cá nhân.  
* **Bước 2: Thu thập tài liệu:** Bệnh nhân nhận các bản sao tài liệu (12 loại được phép) sau mỗi lượt khám.  
* **Bước 3: Lưu trữ và Số hóa:**  
  * Người dùng tải lên ảnh chụp hoặc file PDF của các giấy tờ nhận được.  
  * Mỗi tài liệu được gắn kèm **Metadata** (Ngày phát hành, Cơ sở y tế, Bác sĩ ký) và liên kết với lượt khám tương ứng.  
* **Bước 4: Yêu cầu cung cấp dữ liệu (Tùy chọn):** Nếu cần hồ sơ chi tiết hơn, bệnh nhân gửi **Giấy đề nghị cung cấp bản tóm tắt hồ sơ bệnh án** để bệnh viện phê duyệt và cấp bản tóm tắt.  
* **Bước 5: Tra cứu và Tái sử dụng:** Bệnh nhân sử dụng kho dữ liệu này để phục vụ tái khám, chuyển viện hoặc làm thủ tục bảo hiểm.

Điểm khác biệt quan trọng giữa hai luồng:

| Tiêu chí | Luồng Bệnh viện (EMR) | Luồng Bệnh nhân (PHR) |
| :---- | :---- | :---- |
| **Khóa định danh** | Mã y tế \+ Số bệnh án | CCCD \+ Mã y tế |
| **Dữ liệu nội bộ** | Lưu đầy đủ (Phiếu chăm sóc, Hội chẩn) | **Không lưu trữ** các tài liệu nội bộ |
| **Tính pháp lý** | Là hồ sơ gốc chính thức | Là bản sao phục vụ tham khảo |
| **Cơ chế đồng bộ** | Gửi dữ liệu ra khi có yêu cầu | Nhận dữ liệu từ bệnh viện hoặc tự nhập |

 

# Liên kết tài liệu

**1\. Module Quản lý Định danh (Auth & Identity)**

Module này không chứa các file văn bản mẫu mà sử dụng logic định danh từ các tài liệu hướng dẫn:

* **Logic định danh bệnh nhân:** Dựa trên thông tin từ README\_BENH\_NHAN.md (sử dụng CCCD làm khóa chính).  
* **Logic định danh bệnh viện:** Dựa trên README\_BENH\_VIEN.md (sử dụng Mã y tế và Số bệnh án).

**2\. Module Phân hệ Bệnh viện (EMR Management)**

Module này lưu trữ **tất cả 16 tài liệu**, nhưng quan trọng nhất là các **tài liệu nội bộ** mà chỉ phía bệnh viện mới có quyền ghi/đọc:

* **Tài liệu nội bộ (Chỉ dành cho Module 2):**  
  * phiếu chăm sóc cấp 1, 2,3.docx.  
  * hội chẩn.docx (Trích biên bản hội chẩn).  
* **Tài liệu vận hành khác:** Tất cả các loại phiếu thu, phiếu chỉ định và kết quả chuyên môn được tạo ra trong quá trình điều trị tại viện.

**3\. Module Kho hồ sơ Bệnh nhân (PHR Management)**

Module này chỉ lưu trữ **12 loại tài liệu** mà bệnh nhân được phép nhận (Bản scan hoặc PDF). **Tuyệt đối không lưu** phiếu chăm sóc và biên bản hội chẩn.

* **Nhóm Hành chính & Tài chính:**  
  * mẫu-khám-bệnh.docx (Phiếu thông tin khám bệnh).  
  * phieu-thu-viện-phí.docx.  
* **Nhóm Lâm sàng:**  
  * phiếu-chỉ-định-dịch-vụ.docx.  
  * toa-thuốc.docx.  
  * mẫu giấy ra viện.docx.  
  * chuyển tuyến TT01.docx.  
* **Nhóm Cận lâm sàng:**  
  * phiếu-kết-quả-xét-nghiệm-máu.docx (Huyết học).  
  * hóa sinh.docx.  
  * CT-Scan .docx.  
  * mri.docx.  
* **Nhóm Pháp lý:**  
  * cam đoan phẫu thuật.docx.

**4\. Module Xử lý Dữ liệu (Document Engine)**

Module này tập trung vào việc bóc tách dữ liệu và xử lý định dạng cho các tài liệu kỹ thuật:

* **Xử lý LIS (Xét nghiệm):** phiếu-kết-quả-xét-nghiệm-máu.docx và hóa sinh.docx.  
* **Xử lý PACS/DICOM (Chẩn đoán hình ảnh):** CT-Scan .docx và mri.docx.  
* **Quản lý Metadata:** Sử dụng logic từ mục "Quy trình lưu trữ" trong README\_BENH\_VIEN.md để gắn Mã y tế, SBA và Bác sĩ ký vào từng file.

**5\. Module Tương tác và Đồng bộ (Integration)**

Module này chứa các tài liệu phục vụ việc luân chuyển thông tin giữa Bệnh viện và Bệnh nhân:

* **Tài liệu yêu cầu:** tóm tắt hồ sơ bệnh án.docx (Bao gồm **Giấy đề nghị** cung cấp tài liệu và **Giấy hẹn trả** kết quả).  
* **Tài liệu chuyển viện:** chuyển tuyến TT01.docx (Dùng để đồng bộ dữ liệu khi bệnh nhân chuyển cơ sở KCB).

**Lưu ý quan trọng cho nhóm phát triển:** Khi thiết kế Database, các bạn cần phân biệt rõ tài liệu nào thuộc "Nhóm nội bộ" (chỉ xuất hiện ở Module 2\) và tài liệu nào là "Nhóm công khai" (xuất hiện ở cả Module 2 và 3\) để cài đặt phân quyền (ACL) chính xác.

 

# Chia việc

**1\. Thành viên 1: Quản lý Định danh & Bảo mật (Auth & Identity Expert) (King)**

Thành viên này chịu trách nhiệm xây dựng nền tảng kết nối và phân quyền cho toàn hệ thống.

* **Task chính:**  
  * Xây dựng cơ chế định danh kép: **Sử dụng CCCD làm khóa chính cho luồng (sau cùng)** bệnh nhân và **Mã y tế/Số bệnh án** cho luồng bệnh viện.  
  * Thiết lập hệ thống phân quyền (RBAC) chi tiết cho các vai trò: Bác sĩ điều trị, Điều dưỡng, Kỹ thuật viên, Phòng tài vụ và Bệnh nhân.  
  * Đảm bảo tính bảo mật và trạng thái **Ký số** cho các văn bản pháp lý.

**2\. Thành viên 2: Quản lý Luồng Bệnh viện & Nội trú (Internal EMR Developer)(Minh)**

Tập trung vào các quy trình nội bộ và các tài liệu chuyên môn mà bệnh nhân không được phép tự quản lý.

* **Task chính:**  
  * Xây dựng module lưu trữ **Hồ sơ bệnh án (HSBA)** đầy đủ cho mọi bệnh nhân đến khám.  
  * Xử lý các tài liệu nội bộ: **Phiếu theo dõi và chăm sóc (Cấp 1, 2, 3\)** và **Biên bản hội chẩn**.  
  * Quản lý quy trình **Cam kết phẫu thuật/thủ thuật** có chữ ký xác nhận của bác sĩ và bệnh nhân.

**3\. Thành viên 3: Phát triển Kho Hồ sơ Cá nhân (PHR Portal Developer) (thanh)**

Xây dựng giao diện và tính năng cho bệnh nhân tự quản lý sức khỏe cá nhân.

* **Task chính:**  
  * Thiết kế giao diện kho lưu trữ cá nhân gom nhóm theo **Ngày khám**, **Cơ sở y tế** và **Loại lượt** (nội/ngoại trú).  
  * Phát triển tính năng cho phép bệnh nhân lưu trữ **12 loại tài liệu** thuộc 4 nhóm chính (Hành chính, Lâm sàng, Cận lâm sàng, Pháp lý).  
  * Xử lý việc tải lên và hiển thị bản scan/PDF từ phía người dùng.

**4\. Thành viên 4: Chuyên gia Hình ảnh MRI & CT (Imaging Specialist \- MRI/PACS Focus)(huyle)**

Thành viên này phụ trách riêng phần xử lý hình ảnh y khoa theo yêu cầu của bạn.

* **Task chính:**  
  * Tích hợp và quản lý dữ liệu hình ảnh từ hệ thống **PACS**, lưu trữ dưới dạng **DICOM**.  
  * Xử lý luồng dữ liệu cho **Kết quả MRI** và **Kết quả CT-Scan**.  
  * Gắn metadata cho mỗi kết quả chẩn đoán hình ảnh bao gồm: Phim, mô tả hình ảnh, kết luận và bác sĩ chuyên khoa ký tên.  
  * Đảm bảo liên kết giữa hình ảnh trong PACS và hồ sơ bệnh nhân qua **Mã y tế**.

**5\. Thành viên 5: Quản lý Xét nghiệm & Dữ liệu Sinh hiệu (LIS & Data Specialist)(Nam)**

Xử lý các loại dữ liệu có cấu trúc từ phòng xét nghiệm và các chỉ số sinh tồn.

* **Task chính:**  
  * Kết nối với hệ thống **LIS** để tiếp nhận và hiển thị **Phiếu kết quả xét nghiệm máu (Huyết học)** và **Hoá sinh máu**.  
  * Xây dựng module ghi nhận **Sinh hiệu** (Mạch, Huyết áp, SpO2, BMI...) từ **Phiếu thông tin khám bệnh** và phiếu chăm sóc.  
  * Quản lý danh mục các chỉ số xét nghiệm và trị số bình thường để cảnh báo khi có bất thường.

**6\. Thành viên 6: Công cụ Tài liệu & Tương tác (Document Engine & Integration)(?)**

Xử lý việc xuất bản tài liệu và sự tương tác giữa Bệnh viện \- Bệnh nhân.

* **Task chính:**  
  * Phát triển bộ máy tạo file PDF/In ấn cho các tài liệu: **Toa thuốc**, **Giấy ra viện**, và **Phiếu thu viện phí**.  
  * Xây dựng quy trình xử lý **Phiếu chuyển tuyến TT01** kết nối với dữ liệu BHYT.  
  * Xử lý yêu cầu cung cấp **Tóm tắt hồ sơ bệnh án** (Giấy đề nghị và Giấy hẹn trả kết quả) để đồng bộ dữ liệu sang kho cá nhân.

**Sơ đồ tóm tắt phân bổ tài liệu:**

* **Member 2 (Nội bộ):** Phiếu chăm sóc, Biên bản hội chẩn, Cam kết phẫu thuật.  
* **Member 4 (Hình ảnh):** MRI, CT-Scan (DICOM).  
* **Member 5 (Xét nghiệm):** XN Huyết học, Hoá sinh, Sinh hiệu.  
* **Member 6 (Đầu ra):** Toa thuốc, Giấy ra viện, Phiếu chuyển tuyến, Tóm tắt HSBA.

