# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

# Load the workbook
wb = openpyxl.load_workbook('Template1_Project Tracking.xlsx')

# Define standard styles
font_data = Font(name='Arial', size=10, bold=False, color='000000')
font_bold = Font(name='Arial', size=10, bold=True, color='000000')

thin_side = Side(border_style='thin', color='D9D9D9')
border_box = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

align_left = Alignment(horizontal='left', vertical='top', wrap_text=True)
align_center = Alignment(horizontal='center', vertical='top', wrap_text=True)

# 40 tasks definition (8 per member, 10 per iteration)
# Each task item:
# (screen_function, feature, actor, description, in_charge, status_proj, actual_iter, updated_iter, update_details, srs, sds, notes)

TASKS_BY_ITERATION = {
    'Iter1': [
        # Le Tran Gia Huy
        (
            "Tiền xử lý & Chuẩn hóa ảnh MRI (MRI Preprocessing Pipeline)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Hệ thống / AI Engine",
            "Xây dựng pipeline tiền xử lý ảnh cắt lớp sọ não: chuẩn hóa kích thước 224x224, cân bằng độ tương phản CLAHE, khử nhiễu viền sọ và trích xuất đặc trưng đa chuỗi xung (T1, T2, FLAIR).",
            "Lê Trần Gia Huy",
            "Done",
            "iter1",
            "none",
            "Đạt chuẩn hóa 100% tập ảnh đầu vào, loại bỏ nhiễu và viền sọ hiệu quả.",
            "SRS-AI-01",
            "SDS-AI-01",
            "Hoàn thành đúng tiến độ; tích hợp vào pipeline tiền xử lý chung."
        ),
        (
            "Bộ dữ liệu Huấn luyện & Data Augmentation",
            "Trí tuệ nhân tạo (AI Engine)",
            "Kỹ sư AI (AI Engineer)",
            "Thu thập, làm sạch và gán nhãn tập dữ liệu u não (BraTS, Figshare, BV Tâm Trí Đà Nẵng); áp dụng kỹ thuật Bayesian Data Augmentation chống overfitting và mất cân bằng mẫu.",
            "Lê Trần Gia Huy",
            "Updated",
            "iter1",
            "iter2",
            "Bổ sung 1.861 ảnh thực tế từ BV Tâm Trí Đà Nẵng trong sprint 2 để tăng tính khái quát.",
            "SRS-AI-02",
            "SDS-AI-02",
            "Hoàn tất thu thập bộ dữ liệu ban đầu gồm 7.023 ảnh Kaggle & BraTS."
        ),
        # Dinh Huy Hoang
        (
            "Đăng nhập & Cấp phát JWT (Login & JWT Authentication)",
            "Xác thực & Bảo mật (Auth & Security)",
            "Toàn bộ người dùng (All Users)",
            "Xây dựng màn hình và API đăng nhập hệ thống hỗ trợ Email/SĐT, cấp phát JWT Access Token và Refresh Token, tích hợp mã hóa mật khẩu Bcrypt và chống tấn công Brute-force.",
            "Đinh Huy Hoàng",
            "Updated",
            "iter1",
            "iter2",
            "Cập nhật bổ sung đăng nhập bằng SĐT song song với Email và cơ chế auto session timeout.",
            "SRS-AUTH-01",
            "SDS-AUTH-01",
            "Xác thực JWT an toàn theo chuẩn RFC 7519."
        ),
        (
            "Đăng ký Tài khoản & Xác thực OTP (Register & OTP Verification)",
            "Xác thực & Bảo mật (Auth & Security)",
            "Bệnh nhân, Nhân viên y tế",
            "Giao diện và luồng đăng ký tài khoản người dùng mới; tích hợp dịch vụ gửi mã OTP xác thực qua SMS/Email và kích hoạt tài khoản định danh cá nhân.",
            "Đinh Huy Hoàng",
            "Done",
            "iter1",
            "none",
            "Đã kiểm thử gửi mã OTP tự động qua Nodemailer/Twilio thành công.",
            "SRS-AUTH-02",
            "SDS-AUTH-02",
            "Hoàn thành xác thực OTP đa kênh."
        ),
        # Le Van Minh
        (
            "Kiến trúc CSDL Đa cơ sở & Plugin Cô lập Dữ liệu (Multi-Tenancy Architecture)",
            "Quản trị Hệ thống (System Architecture)",
            "Quản trị viên Hệ thống (System Admin)",
            "Thiết kế Schema Mongoose và Mongoose Plugin cô lập dữ liệu theo từng bệnh viện (hospitalId); tự động gán tenant context trong mọi câu truy vấn, ngăn rò rỉ dữ liệu chéo.",
            "Lê Văn Minh",
            "Done",
            "iter1",
            "none",
            "Vượt qua 100% bài kiểm thử bảo mật chống rò rỉ dữ liệu đa cơ sở (OWASP Multi-Tenancy).",
            "SRS-SYS-01",
            "SDS-SYS-01",
            "Hiện thực tenancy plugin ở mức CSDL Mongoose."
        ),
        (
            "Ma trận Phân quyền 6 Vai trò Lâm sàng (RBAC Middleware & Permissions)",
            "Quản trị Hệ thống (System Architecture)",
            "Quản trị viên Hệ thống (System Admin)",
            "Xây dựng Middleware kiểm tra quyền truy cập (RBAC) cho 6 vai trò lâm sàng: Lễ tân, Điều dưỡng, Bác sĩ khám, KTV CĐHA, Bác sĩ đọc phim và Quản trị viên viện.",
            "Lê Văn Minh",
            "Updated",
            "iter1",
            "iter2",
            "Bổ sung phân quyền chi tiết cho vai trò Kỹ thuật viên CĐHA và Bác sĩ Đọc phim (Radiologist).",
            "SRS-SYS-02",
            "SDS-SYS-02",
            "Khung phân quyền RBAC 6 vai trò lâm sàng chuẩn hóa."
        ),
        # Le Hai Nam
        (
            "Tiếp đón Bệnh nhân & Cấp mã Lượt khám (Visit Registration & Check-in)",
            "Tiếp đón & Phân luồng (Reception & Triage)",
            "Lễ tân (Receptionist)",
            "Giao diện tiếp nhận bệnh nhân tại quầy đăng ký: tìm kiếm bệnh nhân cũ qua CCCD/SĐT hoặc tạo mới hồ sơ bệnh nhân, tạo lượt khám (Visit) và cấp số thứ tự tự động.",
            "Lê Hải Nam",
            "Updated",
            "iter1",
            "iter2",
            "Cải tiến giao diện tìm kiếm bệnh nhân theo CCCD gắn chip và tự động điền thông tin.",
            "SRS-REC-01",
            "SDS-REC-01",
            "Cấp mã lượt khám theo định dạng tiêu chuẩn y tế."
        ),
        (
            "Điều phối Luồng Bệnh nhân theo Bác sĩ (Doctor Smart Queue Allocation)",
            "Tiếp đón & Phân luồng (Reception & Triage)",
            "Lễ tân, Điều dưỡng trưởng",
            "Thuật toán phân bổ lượt khám thông minh vào phòng khám chuyên khoa dựa trên số lượng bệnh nhân đang chờ và trạng thái làm việc trực tuyến của từng bác sĩ.",
            "Lê Hải Nam",
            "Done",
            "iter1",
            "none",
            "Cân bằng tải bệnh nhân tối ưu giữa các phòng khám, giảm thời gian chờ đợi.",
            "SRS-REC-02",
            "SDS-REC-02",
            "Thuật toán xếp hàng thông minh vận hành ổn định."
        ),
        # Nguyen Tien Thanh
        (
            "Hồ sơ Bệnh nhân Điện tử & Lịch sử Khám (Electronic Patient Medical File)",
            "Bệnh án Điện tử (EMR Core)",
            "Bác sĩ, Bệnh nhân, Lễ tân",
            "Thiết kế cấu trúc hồ sơ bệnh nhân định danh duy nhất (Patient ID/CCCD), lưu trữ tiền sử bệnh gia đình, tiền sử dị ứng kim loại và toàn bộ lịch sử các đợt khám bệnh.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter1",
            "none",
            "Cấu trúc EMR chuẩn hóa theo quy định Thông tư 46/2018/TT-BYT của Bộ Y Tế.",
            "SRS-EMR-01",
            "SDS-EMR-01",
            "Hồ sơ bệnh án điện tử định danh duy nhất."
        ),
        (
            "Hàng đợi Khám Bác sĩ Lâm sàng (Doctor Work Queue Screen)",
            "Khám chữa bệnh Lâm sàng (Clinical Examination)",
            "Bác sĩ Khám Lâm Sàng (Doctor)",
            "Màn hình hàng đợi khám bệnh ngoại trú: tiếp nhận bệnh nhân theo thứ tự ưu tiên (Thường / Cấp cứu), xem chỉ số sinh hiệu đo trước bởi điều dưỡng và bắt đầu phiên khám.",
            "Nguyễn Tiến Thành",
            "Updated",
            "iter1",
            "iter2",
            "Thêm nhãn cảnh báo phân loại ưu tiên cấp cứu màu đỏ và huy hiệu trạng thái chờ khám.",
            "SRS-DOC-01",
            "SDS-DOC-01",
            "Giao diện hàng đợi khám bệnh ngoại trú trực quan."
        )
    ],
    'Iter2': [
        # Le Tran Gia Huy
        (
            "Mô hình Định vị Vùng tổn thương YOLOv8 (YOLOv8 Tumor Localization)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Bác sĩ CĐHA, KTV",
            "Huấn luyện và tối ưu mô hình YOLOv8x phát hiện tọa độ Bounding Box vùng tổn thương u não trên lát cắt 2D, đạt mAP50 trên 92% với độ trễ suy luận dưới 50ms.",
            "Lê Trần Gia Huy",
            "Done",
            "iter2",
            "none",
            "Mô hình định vị không gian chính xác cao, trích xuất tọa độ Bounding Box tức thì.",
            "SRS-AI-03",
            "SDS-AI-03",
            "Đạt mAP50=92.4% trên tập validation; xuất file trọng số best.pt."
        ),
        (
            "Bộ 3 Mô hình Phân loại CNN Ensemble (Bayesian CNN Ensemble Classifier)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Bác sĩ CĐHA (Radiologist)",
            "Xây dựng kiến trúc phân loại đa lớp u não (Glioma, Meningioma, Pituitary, Normal) kết hợp ResNet50, EfficientNetV2 và DenseNet121 với cơ chế bỏ phiếu mềm Soft-Voting.",
            "Lê Trần Gia Huy",
            "Updated",
            "iter2",
            "iter3",
            "Bổ sung Cost-Sensitive Loss và Bayesian Test-Time Augmentation (BayTTA) để giảm FNR.",
            "SRS-AI-04",
            "SDS-AI-04",
            "Đạt Accuracy 89.6% ở bản baseline ban đầu."
        ),
        # Dinh Huy Hoang
        (
            "Khung Điều hướng Đáp ứng & Header Phân quyền (Responsive Layout & Navigation)",
            "Giao diện & Trải nghiệm (UI/UX Foundation)",
            "Toàn bộ người dùng (All Users)",
            "Thiết kế thanh điều hướng đa tầng đáp ứng (Responsive Layout) hỗ trợ chuyển đổi mượt mà giữa Web Desktop và Tablet buồng bệnh, tự động lọc menu theo vai trò người dùng.",
            "Đinh Huy Hoàng",
            "Done",
            "iter2",
            "none",
            "Tương thích công thái học y tế trên cả màn hình máy trạm PC và tablet di động.",
            "SRS-UI-01",
            "SDS-UI-01",
            "Khung layout dùng chung cho toàn bộ 45 màn hình ứng dụng."
        ),
        (
            "Đăng nhập Một lần Google SSO (Google Single Sign-On)",
            "Xác thực & Bảo mật (Auth & Security)",
            "Bệnh nhân, Bác sĩ",
            "Tích hợp Google OAuth 2.0 / Firebase Authentication cho phép người dùng đăng nhập tức thì bằng tài khoản Google, tự động đồng bộ hồ sơ thông tin cá nhân.",
            "Đinh Huy Hoàng",
            "Updated",
            "iter2",
            "iter3",
            "Tối ưu hóa cơ chế tự động liên kết tài khoản Google với hồ sơ bệnh nhân đã tồn tại.",
            "SRS-AUTH-03",
            "SDS-AUTH-03",
            "Hỗ trợ đăng nhập tiện lợi cho người dùng phân hệ Bệnh nhân."
        ),
        # Le Van Minh
        (
            "Đăng ký & Khởi tạo Cơ sở Bệnh viện Mới (Hospital Onboarding Screen)",
            "Quản lý Bệnh viện (Hospital Management)",
            "Quản trị viên Hệ thống (System Admin)",
            "Giao diện thiết lập thông tin bệnh viện mới: tên viện, mã cơ sở KCB Bộ Y Tế, địa chỉ, hotline, logo thương hiệu và hạn mức số lượng bệnh nhân tiếp nhận mỗi ngày.",
            "Lê Văn Minh",
            "Done",
            "iter2",
            "none",
            "Hỗ trợ đa cơ sở thuê bao (SaaS B2B) với đầy đủ thông tin nhận diện thương hiệu.",
            "SRS-HOS-01",
            "SDS-HOS-01",
            "Tạo lập tenant thành công trên môi trường thử nghiệm đa viện."
        ),
        (
            "Quản lý Nhân sự & Khóa/Mở Tài khoản (Staff Management & Account Lock)",
            "Quản lý Bệnh viện (Hospital Management)",
            "Quản trị viên Bệnh viện (Hospital Admin)",
            "Màn hình quản trị danh sách nhân viên y tế theo từng khoa phòng; hỗ trợ phân công vai trò, cập nhật chứng chỉ hành nghề và chức năng khóa/mở tài khoản khẩn cấp.",
            "Lê Văn Minh",
            "Updated",
            "iter2",
            "iter3",
            "Bổ sung chức năng xác thực giấy phép hành nghề và giới hạn quyền truy cập theo ca trực.",
            "SRS-STAFF-01",
            "SDS-STAFF-01",
            "Quản lý nhân sự y tế theo phòng ban khoa phòng."
        ),
        # Le Hai Nam
        (
            "Phiếu Đo Sinh hiệu & Khám sàng lọc Điều dưỡng (Vital Signs Entry Screen)",
            "Chăm sóc Điều dưỡng (Nursing Care)",
            "Điều dưỡng viên (Nurse)",
            "Màn hình nhập 5 chỉ số sinh hiệu chuẩn y tế: Huyết áp (mmHg), Mạch (bpm), Thân nhiệt (°C), SpO₂ (%) và Nhịp thở; tự động cảnh báo chỉ số nguy kịch màu đỏ.",
            "Lê Hải Nam",
            "Done",
            "iter2",
            "none",
            "Đầy đủ 5 chỉ số sinh tồn và tự động cảnh báo màu theo ngưỡng lâm sàng Bộ Y Tế.",
            "SRS-NURSE-01",
            "SDS-NURSE-01",
            "Phát hiện sớm bệnh nhân có dấu hiệu sinh tồn bất thường."
        ),
        (
            "Phiếu Chăm sóc Điều dưỡng & Theo dõi Diễn tiến (Nursing Care Sheet & Monitoring)",
            "Chăm sóc Điều dưỡng (Nursing Care)",
            "Điều dưỡng viên (Nurse)",
            "Giao diện lập phiếu theo dõi chăm sóc bệnh nhân nội trú theo mẫu Bộ Y Tế, ghi nhận diễn biến lâm sàng từng ca trực và nhắc giờ dùng thuốc cho bệnh nhân.",
            "Lê Hải Nam",
            "Updated",
            "iter2",
            "iter3",
            "Tích hợp đồng bộ dữ liệu chăm sóc trực tiếp vào hồ sơ bệnh án điện tử tập trung.",
            "SRS-NURSE-02",
            "SDS-NURSE-02",
            "Số hóa phiếu chăm sóc thay thế hồ sơ giấy tờ truyền thống."
        ),
        # Nguyen Tien Thanh
        (
            "Phiếu Bệnh án Lâm sàng & Kê Đơn Thuốc (EMR Form & Prescription Management)",
            "Khám chữa bệnh Lâm sàng (Clinical Examination)",
            "Bác sĩ Khám Lâm Sàng (Doctor)",
            "Màn hình chẩn đoán bệnh theo mã ICD-10, nhập lý do vào viện, bệnh sử, kê đơn thuốc ngoại trú kèm liều dùng chi tiết và ra y lệnh chụp cắt lớp MRI sọ não.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter2",
            "none",
            "Hỗ trợ tra cứu nhanh danh mục mã bệnh ICD-10 quốc tế và gợi ý liều dùng thuốc.",
            "SRS-DOC-02",
            "SDS-DOC-02",
            "Bác sĩ hoàn thành phiên khám và chỉ định chụp MRI."
        ),
        (
            "Bảng kiểm An toàn Buồng chụp MRI (MRI Safety Checklist Form)",
            "Chẩn đoán Hình ảnh & PACS (RIS/PACS Console)",
            "Kỹ thuật viên Hình ảnh (Technician)",
            "Màn hình thẩm định 4 tiêu chí an toàn bắt buộc trước khi đưa bệnh nhân vào phòng máy MRI: máy tạo nhịp tim, van tim kim loại, dị vật mắt và phản ứng thuốc đối quang từ.",
            "Nguyễn Tiến Thành",
            "Updated",
            "iter2",
            "iter3",
            "Bổ sung cam kết tiêm thuốc đối quang từ (Contrast Consent) và chữ ký số xác nhận của KTV.",
            "SRS-TECH-01",
            "SDS-TECH-01",
            "Bảo vệ an toàn tuyệt đối cho bệnh nhân trước từ trường cao 1.5T/3.0T."
        )
    ],
    'Iter3': [
        # Le Tran Gia Huy
        (
            "Bản đồ Nhiệt Kích hoạt Vùng u Grad-CAM (Grad-CAM Heatmap Visualization)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Bác sĩ CĐHA (Radiologist)",
            "Hiện thực thuật toán Grad-CAM trích xuất bản đồ kích hoạt trực quan vùng não nghi ngờ tổn thương u, phục vụ tính giải thích lâm sàng (Explainable AI - XAI) cho bác sĩ.",
            "Lê Trần Gia Huy",
            "Done",
            "iter3",
            "none",
            "Hiển thị Heatmap độ phân giải cao đè trực tiếp lên ảnh giải phẫu não gốc.",
            "SRS-AI-05",
            "SDS-AI-05",
            "Tăng tính thuyết phục và độ tin cậy của mô hình AI đối với bác sĩ CĐHA."
        ),
        (
            "Dịch vụ Vi mô AI FastAPI (AI Diagnostic Microservice API)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Backend Gateway, Kỹ sư AI",
            "Đóng gói toàn bộ mô hình Deep Learning thành dịch vụ FastAPI (Port 8000), xử lý suy luận bất đồng bộ, trả về xác suất phân loại, tọa độ hộp định vị và Heatmap Base64.",
            "Lê Trần Gia Huy",
            "Done",
            "iter3",
            "none",
            "Đạt thời gian phản hồi dưới 1.2 giây/ca phân tích trên hạ tầng GPU/CPU tiêu chuẩn.",
            "SRS-AI-06",
            "SDS-AI-06",
            "REST API chuẩn hóa kết nối thông suốt với Express Backend."
        ),
        # Dinh Huy Hoang
        (
            "Tạo & Quản lý Hóa đơn Viện phí (Invoice Generation & Billing)",
            "Tài chính & Viện phí (Billing & Invoices)",
            "Thu ngân, Bệnh nhân",
            "Màn hình và API khởi tạo hóa đơn viện phí từ y lệnh khám và chụp MRI; phân tách chi phí khám, xét nghiệm, thuốc và dịch vụ kỹ thuật cao.",
            "Đinh Huy Hoàng",
            "Done",
            "iter3",
            "none",
            "Tính toán viện phí tự động, phân tích chi tiết từng khoản mục viện phí rõ ràng.",
            "SRS-BILL-01",
            "SDS-BILL-01",
            "Quản lý hóa đơn viện phí chính xác, minh bạch."
        ),
        (
            "Xử lý Bảo hiểm Y tế & Miễn giảm Cấp cứu (BHYT & Emergency Exemption)",
            "Tài chính & Viện phí (Billing & Invoices)",
            "Thu ngân, Bác sĩ Cấp cứu",
            "Xử lý nghiệp vụ khấu trừ tỷ lệ đồng chi trả BHYT (80%, 95%, 100%) và cơ chế cấp cứu ngoại lệ cho phép thực hiện chụp chiếu khẩn cấp trước khi thu phí.",
            "Đinh Huy Hoàng",
            "Done",
            "iter3",
            "none",
            "Hiện thực chuẩn xác luồng Chụp trước, thu sau cho các ca bệnh cấp cứu nguy kịch.",
            "SRS-BILL-02",
            "SDS-BILL-02",
            "Tuân thủ quy định pháp luật khám chữa bệnh của Bộ Y Tế."
        ),
        # Le Van Minh
        (
            "Quản trị Máy chụp MRI & Phòng Kỹ thuật (MRI Scanner & Room Management)",
            "Quản trị Thiết bị (Medical Device Management)",
            "Quản trị viên Bệnh viện, Trưởng khoa CĐHA",
            "Quản lý cấu hình danh mục máy chụp MRI (Tesla 1.5T/3.0T), thiết lập phòng máy chụp, trạng thái bảo trì máy và lịch vận hành ca chụp kỹ thuật.",
            "Lê Văn Minh",
            "Done",
            "iter3",
            "none",
            "Theo dõi trạng thái sẵn sàng của từng phòng chụp và cảnh báo khi máy bảo trì.",
            "SRS-DEV-01",
            "SDS-DEV-01",
            "Tối ưu hóa công suất vận hành buồng chụp MRI."
        ),
        (
            "Quản lý Danh mục Thuốc & Giá viện phí (Drug & Price Catalog Management)",
            "Quản lý Nghiệp vụ Dược (Pharmacy & Pricing)",
            "Dược sĩ, Kế toán Viện",
            "Màn hình cập nhật danh mục thuốc biệt dược, định lượng tồn kho, giá bảo hiểm và bảng giá quy định các dịch vụ chụp cắt lớp MRI theo thông tư Bộ Y Tế.",
            "Lê Văn Minh",
            "Done",
            "iter3",
            "none",
            "Quản lý tập trung hơn 500 mặt hàng thuốc thiết yếu và biểu giá dịch vụ kỹ thuật.",
            "SRS-PHARM-01",
            "SDS-PHARM-01",
            "Đồng bộ giá tự động với phân hệ hóa đơn viện phí."
        ),
        # Le Hai Nam
        (
            "Sơ đồ Buồng Giường Bệnh Trực quan (Hospital Bed Layout & Allocation)",
            "Quản lý Nội trú & Buồng giường (Inpatient Bed Management)",
            "Điều dưỡng trưởng, Bác sĩ điều trị",
            "Giao diện sơ đồ mặt bằng buồng bệnh trực quan, hiển thị trạng thái giường (Trống, Đang nằm, Khử khuẩn, Hỏng); hỗ trợ gán giường và chuyển giường linh hoạt.",
            "Lê Hải Nam",
            "Done",
            "iter3",
            "none",
            "Hiển thị trực quan theo tầng khoa phòng, thao tác xếp giường chỉ với 1 thao tác click.",
            "SRS-BED-01",
            "SDS-BED-01",
            "Tối ưu hóa quản lý giường bệnh nội trú thần kinh."
        ),
        (
            "Khóa Nguyên tử Chống Tranh chấp Giữ chỗ Giường (Atomic Bed Concurrency Control)",
            "Quản lý Nội trú & Buồng giường (Inpatient Bed Management)",
            "Hệ thống Backend (System Backend)",
            "Cơ chế kiểm soát tranh chấp đồng thời sử dụng toán tử nguyên tử MongoDB findOneAndUpdate, triệt tiêu hoàn toàn lỗi 2 điều dưỡng xếp trùng 1 giường bệnh.",
            "Lê Hải Nam",
            "Done",
            "iter3",
            "none",
            "Vượt qua 100% ca kiểm thử đồng thời (Concurrency Test) với 50 requests song song.",
            "SRS-BED-02",
            "SDS-BED-02",
            "Bảo toàn tính toàn vẹn dữ liệu trong môi trường nhiều ca trực song song."
        ),
        # Nguyen Tien Thanh
        (
            "Tải lên Ảnh Lát cắt & File Nén DICOM (Multer Binary DICOM Upload Console)",
            "Chẩn đoán Hình ảnh & PACS (RIS/PACS Console)",
            "Kỹ thuật viên Hình ảnh (Technician)",
            "Giao diện tải lên lát cắt tiêu biểu (Key Slices) và file nén chuỗi ảnh DICOM (.zip tối đa 200MB); áp dụng kỹ thuật Multer Stream nhị phân chống tràn RAM và lưu trữ Google Drive.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter3",
            "none",
            "Xử lý luồng stream trực tiếp lên Google Drive, triệt tiêu rủi ro OOM máy chủ.",
            "SRS-PACS-01",
            "SDS-PACS-01",
            "Giải pháp Mini-PACS Hybrid chi phí tối ưu trên nền tảng Web."
        ),
        (
            "Màn hình Duyệt Kết quả CĐHA & Ký số Điện tử (Imaging Result & Digital Signing)",
            "Chẩn đoán Hình ảnh & PACS (RIS/PACS Console)",
            "Bác sĩ Chẩn đoán Hình ảnh (Radiologist)",
            "Màn hình đọc duyệt phim y khoa: so sánh ảnh gốc với gợi ý AI (Bounding Box, Heatmap), hiệu chỉnh kết luận chẩn đoán u não và ký số điện tử ban hành phiếu kết quả CĐHA.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter3",
            "none",
            "Quy trình ký số điện tử phân định rõ trách nhiệm chuyên môn của Bác sĩ CĐHA.",
            "SRS-PACS-02",
            "SDS-PACS-02",
            "Đóng dấu điện tử bảo mật không thể giả mạo kết quả chẩn đoán."
        )
    ],
    'Iter4': [
        # Le Tran Gia Huy
        (
            "Bộ lọc Bảo vệ Riêng tư Giải phẫu (Anatomical Privacy Guard)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Hệ thống (System) / AI Engine",
            "Xây dựng bộ lọc nhận diện mặt cắt giải phẫu sọ não, tự động che mờ và chặn gửi ảnh chứa khuôn mặt bệnh nhân lên đám mây, giảm 79.5% chi phí API ngoài và bảo vệ quyền riêng tư.",
            "Lê Trần Gia Huy",
            "Done",
            "iter4",
            "none",
            "Bảo vệ dữ liệu y tế nhạy cảm theo chuẩn HIPAA và Nghị định 13/2023/NĐ-CP.",
            "SRS-AI-07",
            "SDS-AI-07",
            "Tự động loại bỏ ảnh quét cắt ngang khuôn mặt trước khi phân tích."
        ),
        (
            "Trọng tài Đa mô hình MAICS & Gemini VLM (MAICS Consensus & Gemini Arbitration)",
            "Trí tuệ nhân tạo (AI Engine)",
            "Bác sĩ CĐHA (Radiologist)",
            "Tích hợp cơ chế trọng tài đồng thuận MAICS kết hợp Gemini 3.1 Flash-Lite VLM khi Tier 1 và Tier 2 xung đột, giảm tỷ lệ bỏ sót u ác tính (Glioma FNR) xuống mức kỷ lục 0.43%.",
            "Lê Trần Gia Huy",
            "Done",
            "iter4",
            "none",
            "Đạt Accuracy 91.01% và Macro F1 92.04% trên tập 3.461 ảnh độc lập (BV Tâm Trí Đà Nẵng).",
            "SRS-AI-08",
            "SDS-AI-08",
            "Cơ chế trọng tài đồng thuận đa tầng đột phá trong chẩn đoán y tế."
        ),
        # Dinh Huy Hoang
        (
            "Cổng Thanh toán Trực tuyến VietQR & PayOS (VietQR & PayOS Payment Gateway)",
            "Tài chính & Viện phí (Billing & Invoices)",
            "Bệnh nhân, Thu ngân",
            "Tích hợp cổng thanh toán Napas 247 tạo mã QR động VietQR qua PayOS; xử lý Webhook xác thực giao dịch tức thì và tự động cập nhật trạng thái hóa đơn Đã thanh toán.",
            "Đinh Huy Hoàng",
            "Done",
            "iter4",
            "none",
            "Khớp lệnh thanh toán tức thì trong 1 giây qua Webhook an toàn kèm mã HMAC SHA256.",
            "SRS-PAY-01",
            "SDS-PAY-01",
            "Trải nghiệm thanh toán viện phí không tiền mặt thuận tiện cho bệnh nhân."
        ),
        (
            "Báo cáo Doanh thu & Quản lý Gói dịch vụ VIP (Financials & Premium Subscriptions)",
            "Tài chính & Viện phí (Billing & Invoices)",
            "Giám đốc bệnh viện, Bệnh nhân",
            "Màn hình thống kê doanh thu viện phí theo ngày/tháng và quản lý đăng ký các gói hội viên VIP (NeuroScan Premium) hỗ trợ lưu trữ hồ sơ trọn đời.",
            "Đinh Huy Hoàng",
            "Done",
            "iter4",
            "none",
            "Biểu đồ phân tích doanh thu trực quan theo khoa phòng và gói dịch vụ nâng cao.",
            "SRS-FIN-01",
            "SDS-FIN-01",
            "Báo cáo tài chính chi tiết phục vụ điều hành viện phí."
        ),
        # Le Van Minh
        (
            "Bảng Điều khiển Tổng Giám đốc Viện (Admin Backoffice & KPI Dashboard)",
            "Báo cáo & Giám sát (Analytics & KPI Dashboard)",
            "Ban Giám đốc Bệnh viện (Hospital Director)",
            "Giao diện trực quan hóa dữ liệu thống kê tổng thể viện: số ca khám, lượt chụp MRI, tỷ lệ phát hiện u não của AI, thời gian chờ trung bình và doanh thu theo thời gian thực.",
            "Lê Văn Minh",
            "Done",
            "iter4",
            "none",
            "Cập nhật dữ liệu thời gian thực giúp lãnh đạo viện ra quyết định điều phối kịp thời.",
            "SRS-KPI-01",
            "SDS-KPI-01",
            "Bảng thông tin chỉ huy bệnh viện số hóa toàn diện."
        ),
        (
            "Nhật ký Kiểm toán & Bảo mật Đa viện (Security Audit Trail & Compliance)",
            "Quản trị Hệ thống (System Architecture)",
            "Quản trị viên Bảo mật (Security Admin)",
            "Xây dựng hệ thống ghi vết nhật ký kiểm toán (Audit Trail) cho toàn bộ thao tác xem, sửa, ký số hồ sơ bệnh án; ngăn ngừa xâm phạm dữ liệu theo chuẩn HIPAA & Bộ Y Tế.",
            "Lê Văn Minh",
            "Done",
            "iter4",
            "none",
            "Ghi vết đầy đủ IP, thiết bị, thời điểm và nội dung thay đổi trên từng hồ sơ EMR.",
            "SRS-AUDIT-01",
            "SDS-AUDIT-01",
            "Đáp ứng tiêu chí bảo mật cấp độ 3 của Bộ Y Tế (Thông tư 54/2017/TT-BYT)."
        ),
        # Le Hai Nam
        (
            "Quản lý & Nhập Kết quả Xét nghiệm LIS (LIS Laboratory Result Entry)",
            "Cận lâm sàng & Xét nghiệm (LIS Integration)",
            "Kỹ thuật viên Xét nghiệm (Lab Tech)",
            "Màn hình nhập và tra cứu kết quả xét nghiệm huyết học, sinh hóa máu, đông máu và chức năng thận (Creatinine/eGFR) nhằm đánh giá điều kiện tiêm thuốc đối quang từ MRI.",
            "Lê Hải Nam",
            "Done",
            "iter4",
            "none",
            "Tự động tính mức lọc cầu thận eGFR cảnh báo nguy cơ suy thận trước khi tiêm Gadolinium.",
            "SRS-LIS-01",
            "SDS-LIS-01",
            "Liên thông kết quả cận lâm sàng phục vụ chỉ định an toàn thuốc cản từ."
        ),
        (
            "Đồng bộ Tự động Sinh hiệu & Cảnh báo Tương tác Thuốc (Vitals Sync & Alert System)",
            "Chăm sóc Điều dưỡng (Nursing Care)",
            "Bác sĩ khám, Điều dưỡng",
            "Dịch vụ đồng bộ dữ liệu sinh hiệu tự động vào tờ bệnh án điện tử EMR và kích hoạt chuông cảnh báo tương tác dị ứng thuốc khi bác sĩ ra đơn thuốc.",
            "Lê Hải Nam",
            "Done",
            "iter4",
            "none",
            "Cảnh báo tức thì nếu bệnh nhân có tiền sử sốc phản vệ hoặc chống chỉ định thuốc.",
            "SRS-ALERT-01",
            "SDS-ALERT-01",
            "Tăng cường an toàn người bệnh trong suốt quá trình điều trị nội trú."
        ),
        # Nguyen Tien Thanh
        (
            "Xuất Phiếu Kết quả PDF Chuẩn Bộ Y Tế (Ministry of Health PDF Report Export)",
            "Chẩn đoán Hình ảnh & PACS (RIS/PACS Console)",
            "Bác sĩ CĐHA, Bệnh nhân",
            "Chức năng kết xuất phiếu kết quả chẩn đoán hình ảnh ra định dạng PDF chuẩn biểu mẫu Thông tư Bộ Y Tế, tích hợp hình ảnh MRI đại diện, con dấu bệnh viện và chữ ký bác sĩ.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter4",
            "none",
            "Xuất tệp PDF chuẩn hóa có mã QR tra cứu tính xác thực trực tuyến.",
            "SRS-REP-01",
            "SDS-REP-01",
            "Hoàn thiện mẫu phiếu trả kết quả chẩn đoán hình ảnh theo Phụ lục A Bộ Y Tế."
        ),
        (
            "Cổng Thông tin Bệnh nhân & Kho Bệnh án Cá nhân (Patient Portal & Record Vault)",
            "Cổng Bệnh nhân (Patient Portal)",
            "Bệnh nhân & Thân nhân (Patient & Family)",
            "Giao diện bệnh nhân trực tuyến tra cứu toàn bộ hồ sơ khám bệnh, xem hình ảnh chụp MRI, đọc kết quả chẩn đoán và khuyến nghị theo dõi sức khỏe đã ký duyệt.",
            "Nguyễn Tiến Thành",
            "Done",
            "iter4",
            "none",
            "Tra cứu thuận tiện trên cả điện thoại di động và máy tính, bảo mật mã PIN cá nhân.",
            "SRS-PAT-01",
            "SDS-PAT-01",
            "Bệnh nhân chủ động theo dõi tình trạng bệnh án và phác đồ điều trị."
        )
    ]
}

# Assemble all 40 tasks for the Project sheet in sequential order
ALL_TASKS_PROJECT = []
for iter_key in ['Iter1', 'Iter2', 'Iter3', 'Iter4']:
    ALL_TASKS_PROJECT.extend(TASKS_BY_ITERATION[iter_key])

print(f"Total tasks prepared: {len(ALL_TASKS_PROJECT)}")

# --- 1. POPULATE SHEET: Project ---
ws_proj = wb['Project']

# Clear old rows below row 3
if ws_proj.max_row > 3:
    ws_proj.delete_rows(4, ws_proj.max_row - 3 + 1)

# Write 40 rows
for i, task in enumerate(ALL_TASKS_PROJECT, start=4):
    screen_func, feature, actor, desc, in_charge, status, actual, updated, details = task[0:9]
    
    ws_proj.cell(i, 1, value=f"=ROW()-3")
    ws_proj.cell(i, 2, value=screen_func)
    ws_proj.cell(i, 3, value=feature)
    ws_proj.cell(i, 4, value=actor)
    ws_proj.cell(i, 5, value=desc)
    ws_proj.cell(i, 6, value=in_charge)
    ws_proj.cell(i, 7, value=status)
    ws_proj.cell(i, 8, value=actual)
    ws_proj.cell(i, 9, value=updated)
    ws_proj.cell(i, 10, value=details)

    # Styling
    ws_proj.cell(i, 1).alignment = align_center
    ws_proj.cell(i, 2).alignment = align_left
    ws_proj.cell(i, 3).alignment = align_left
    ws_proj.cell(i, 4).alignment = align_left
    ws_proj.cell(i, 5).alignment = align_left
    ws_proj.cell(i, 6).alignment = align_left
    ws_proj.cell(i, 7).alignment = align_center
    ws_proj.cell(i, 8).alignment = align_center
    ws_proj.cell(i, 9).alignment = align_center
    ws_proj.cell(i, 10).alignment = align_left

    for col in range(1, 11):
        cell = ws_proj.cell(i, col)
        cell.font = font_data
        cell.border = border_box
    
    ws_proj.row_dimensions[i].height = 40

# Adjust column widths for Project sheet
ws_proj.column_dimensions['A'].width = 6.0
ws_proj.column_dimensions['B'].width = 30.0
ws_proj.column_dimensions['C'].width = 24.0
ws_proj.column_dimensions['D'].width = 20.0
ws_proj.column_dimensions['E'].width = 58.0
ws_proj.column_dimensions['F'].width = 18.0
ws_proj.column_dimensions['G'].width = 11.0
ws_proj.column_dimensions['H'].width = 10.0
ws_proj.column_dimensions['I'].width = 11.0
ws_proj.column_dimensions['J'].width = 45.0

print("Populated Project sheet successfully.")

# --- 2. POPULATE ITERATION SHEETS: Iter1, Iter2, Iter3, Iter4 ---
for iter_name in ['Iter1', 'Iter2', 'Iter3', 'Iter4']:
    ws = wb[iter_name]
    
    # Clear old rows below row 5
    if ws.max_row > 5:
        ws.delete_rows(6, ws.max_row - 5 + 1)
        
    iter_tasks = TASKS_BY_ITERATION[iter_name]
    
    for i, task in enumerate(iter_tasks, start=6):
        screen_func = task[0]
        feature = task[1]
        desc = task[3]
        in_charge = task[4]
        status = task[5]
        srs = task[9]
        sds = task[10]
        notes = task[11]

        ws.cell(i, 1, value=f"=ROW()-5")
        ws.cell(i, 2, value=screen_func)
        ws.cell(i, 3, value=feature)
        ws.cell(i, 4, value=desc)
        ws.cell(i, 5, value=in_charge)
        ws.cell(i, 6, value=status)
        ws.cell(i, 7, value=srs)
        ws.cell(i, 8, value=sds)
        ws.cell(i, 9, value=notes)

        # Styling
        ws.cell(i, 1).alignment = align_center
        ws.cell(i, 2).alignment = align_left
        ws.cell(i, 3).alignment = align_left
        ws.cell(i, 4).alignment = align_left
        ws.cell(i, 5).alignment = align_left
        ws.cell(i, 6).alignment = align_center
        ws.cell(i, 7).alignment = align_center
        ws.cell(i, 8).alignment = align_center
        ws.cell(i, 9).alignment = align_left

        for col in range(1, 10):
            cell = ws.cell(i, col)
            cell.font = font_data
            cell.border = border_box

        ws.row_dimensions[i].height = 42

    # Column widths for Iteration sheet
    ws.column_dimensions['A'].width = 6.0
    ws.column_dimensions['B'].width = 30.0
    ws.column_dimensions['C'].width = 24.0
    ws.column_dimensions['D'].width = 58.0
    ws.column_dimensions['E'].width = 18.0
    ws.column_dimensions['F'].width = 11.0
    ws.column_dimensions['G'].width = 14.0
    ws.column_dimensions['H'].width = 14.0
    ws.column_dimensions['I'].width = 45.0

    print(f"Populated {iter_name} sheet successfully.")

# Save workbook
wb.save('Template1_Project Tracking.xlsx')
print("Successfully saved Template1_Project Tracking.xlsx")
