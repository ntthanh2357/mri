/**
 * Câu hỏi thường gặp (FAQ) theo từng vai trò cho màn hình Hỗ trợ kỹ thuật.
 * Mỗi role gồm các nhóm chủ đề { category, items: [{ q, a }] }.
 * Nhóm "Câu hỏi chung" luôn được nối vào cuối danh sách của mọi role.
 */

const COMMON_FAQS = {
  category: 'Câu hỏi chung',
  items: [
    {
      q: 'Đăng nhập nhân viên cần mã 2FA. Không nhận được mã thì làm sao?',
      a: 'Sau khi nhập đúng email và mật khẩu ở tab "Bác sĩ / Nhân viên", hệ thống gửi mã OTP 6 chữ số về email tài khoản. Mã chỉ có hiệu lực 5 phút. Hãy kiểm tra cả thư mục Spam/Quảng cáo, bấm "Gửi lại mã" nếu mã đã hết hạn. Nếu vẫn không nhận được, liên hệ Admin bệnh viện để kiểm tra lại địa chỉ email của tài khoản hoặc gửi ticket hỗ trợ.',
    },
    {
      q: 'Tôi bị đăng xuất liên tục hoặc thấy báo "phiên hết hạn". Vì sao?',
      a: 'Phiên đăng nhập được tự động gia hạn trong 7 ngày. Bạn sẽ bị đăng xuất khi: quá 7 ngày chưa đăng nhập lại, bạn vừa đổi mật khẩu hoặc chọn đăng xuất khỏi mọi thiết bị, tài khoản bị khóa, hoặc gói dịch vụ của bệnh viện hết hạn. Nhập sai mật khẩu 5 lần liên tiếp cũng khiến tài khoản bị khóa tạm thời 15 phút.',
    },
    {
      q: 'Thời gian phản hồi của ticket hỗ trợ là bao lâu? Theo dõi trạng thái ticket ở đâu?',
      a: 'Đội kỹ thuật phản hồi trong vòng 2 giờ (trường hợp khẩn cấp gọi Hotline 1800 1234, hoạt động 24/7). Trạng thái ticket hiển thị ở mục "Yêu cầu hỗ trợ của tôi (Ticket)" ngay trên trang này: Đang mở → Đang xử lý → Đã giải quyết / Đã đóng. Bấm "Làm mới" để cập nhật trạng thái mới nhất.',
    },
  ],
};

const PATIENT_FAQS = [
  {
    category: 'Tài khoản & đăng nhập',
    items: [
      {
        q: 'Tôi không nhận được mã OTP khi đăng ký hoặc đăng nhập thì làm sao?',
        a: 'Mã OTP được gửi về email bạn đã đăng ký và có hiệu lực trong 5 phút. Hãy kiểm tra thư mục Spam/Quảng cáo, bấm "Gửi lại mã" nếu mã đã hết hạn và đảm bảo bạn đang đăng nhập ở tab "Dành cho Bệnh nhân". Nếu email bị nhập sai khi đăng ký, vui lòng gửi ticket để được hỗ trợ cập nhật.',
      },
      {
        q: 'Bệnh viện đã tạo hồ sơ cho tôi. Làm sao để kích hoạt tài khoản và xem hồ sơ đó?',
        a: 'Đăng nhập ở tab "Dành cho Bệnh nhân" bằng email bạn đã cung cấp cho bệnh viện. Lần đầu đăng nhập, hệ thống gửi mã OTP kích hoạt về email; nhập mã để kích hoạt tài khoản. Nếu không biết mật khẩu, bấm "Quên mật khẩu?" để đặt lại. Hồ sơ và phim chụp được liên kết theo Mã y tế (Medical ID) do bệnh viện cấp, hiển thị trong mục "Kho Hồ Sơ Sức Khỏe".',
      },
    ],
  },
  {
    category: 'Xem kết quả',
    items: [
      {
        q: 'Vì sao tôi chưa thấy kết quả MRI sau khi chụp xong?',
        a: 'Phim chụp chỉ xuất hiện trong mục "Phim MRI & CT" sau khi kỹ thuật viên nộp phim lên hệ thống. Phần kết luận chẩn đoán, nút "Tải Báo cáo PDF" và "Tạo mã QR chia sẻ" chỉ mở khi bác sĩ đã ký duyệt kết quả. Nếu sau vài ngày vẫn chưa thấy, hãy kiểm tra Mã y tế trong hồ sơ của bạn có khớp với mã trên phiếu khám không.',
      },
      {
        q: 'Kết quả "Phân tích AI" có phải là chẩn đoán cuối cùng không?',
        a: 'Không. Kết quả AI chỉ là công cụ hỗ trợ bác sĩ sàng lọc (phân loại Glioma, Meningioma, Pituitary hoặc Không có u). Kết luận chính thức là kết luận đã được bác sĩ đọc, đối chiếu và ký số. Vui lòng không tự điều trị dựa trên kết quả AI và hãy trao đổi với bác sĩ điều trị.',
      },
      {
        q: 'Làm sao tải kết quả chẩn đoán (PDF) hoặc ảnh MRI về máy?',
        a: 'Vào "Phim MRI & CT" → chọn lần chụp → "Xem chi tiết bệnh án & phim". Bấm "Tải Báo cáo PDF" để tải báo cáo, hoặc "Tạo mã QR chia sẻ (30 ngày)" để gửi kết quả cho bác sĩ ở cơ sở khác. Hai nút này chỉ khả dụng khi kết quả đã được bác sĩ ký duyệt.',
      },
    ],
  },
  {
    category: 'Khai báo & Premium',
    items: [
      {
        q: 'Mục "Khai báo bệnh án" dùng để làm gì? Tôi nên tải lên những giấy tờ nào?',
        a: 'Đây là sổ sức khỏe cá nhân để bạn lưu giấy tờ khám chữa bệnh (kể cả ở cơ sở khác). Bạn có thể "Tải ảnh lên" (chụp hoặc chọn ảnh/PDF) hoặc "Điền thủ công" theo mẫu. Nên lưu: phiếu khám bệnh, toa thuốc, kết quả xét nghiệm, kết quả MRI/CT, giấy ra viện, phiếu chuyển tuyến. Bác sĩ sẽ có thêm thông tin tiền sử khi bạn đến khám.',
      },
      {
        q: 'Gói Premium có những quyền lợi gì? Tôi đã thanh toán bằng VietQR nhưng gói chưa kích hoạt thì làm sao?',
        a: 'Gói Premium (99.000đ/năm) gồm: lưu trữ hồ sơ vĩnh viễn, AI chuyên sâu & lịch sử, Chat AI Trợ lý 24/7, ưu tiên từ bác sĩ, báo cáo PDF chuyên sâu và cảnh báo sớm rủi ro. Gói được kích hoạt tự động ngay khi cổng PayOS xác nhận giao dịch. Nếu sau vài phút vẫn chưa kích hoạt, hãy đăng xuất rồi đăng nhập lại; nếu vẫn chưa được, gửi ticket chủ đề "Thanh toán & Nâng cấp Premium" kèm ảnh chụp giao dịch.',
      },
      {
        q: 'Dữ liệu sức khỏe của tôi có bị chia sẻ cho người khác không? Ai được xem hồ sơ của tôi?',
        a: 'Không. Chỉ nhân viên y tế của bệnh viện nơi bạn khám mới xem được hồ sơ, và mỗi vai trò chỉ thấy phần thông tin phục vụ công việc của mình. Nhân viên bệnh viện khác không thể xem hồ sơ của bạn, trừ khi bạn chủ động gửi mã QR chia sẻ (tự hết hạn sau 30 ngày) hoặc bệnh viện lập hồ sơ chuyển viện. Mọi lượt truy cập đều được ghi nhật ký kiểm toán.',
      },
    ],
  },
];

const RECEPTIONIST_FAQS = [
  {
    category: 'Tiếp đón bệnh nhân',
    items: [
      {
        q: 'Làm sao tìm một bệnh nhân cũ? Nếu bệnh nhân đó chưa có trong hệ thống thì làm gì?',
        a: 'Vào "Tiếp nhận Bệnh nhân" → mục "1. Chọn Bệnh Nhân", tìm theo tên, email hoặc mã y tế. Nếu không tìm thấy, bệnh nhân cần đăng ký tài khoản ở mục "Dành cho Bệnh nhân" (có thể đăng ký ngay tại quầy bằng điện thoại của bệnh nhân) rồi bạn tìm lại để tạo lượt khám.',
      },
      {
        q: 'Tôi tạo nhầm lượt khám hoặc chọn sai phòng khám. Có sửa hoặc hủy được không?',
        a: 'Hiện màn hình tiếp đón chưa có nút sửa hoặc hủy lượt khám. Nếu tạo nhầm, hãy gửi ticket chủ đề "Lỗi kỹ thuật phần mềm" kèm tên bệnh nhân và giờ tạo lượt khám, rồi tạo lại lượt khám đúng; đồng thời báo bác sĩ bị phân công nhầm để bỏ qua ca đó. Lượt khám đã hoàn tất hoặc đã đóng viện phí thì không được hủy theo quy chế hồ sơ bệnh án.',
      },
      {
        q: 'Xem danh sách các lượt tiếp đón trong ngày ở đâu?',
        a: 'Vào menu "Lượt tiếp đón hôm nay" (tab "Lượt Khám Hôm Nay"). Mỗi lượt khám hiển thị tên bệnh nhân, trạng thái, lý do khám, bác sĩ và điều dưỡng phụ trách cùng giờ tạo. Bấm vào một lượt khám để xem chi tiết.',
      },
    ],
  },
  {
    category: 'BHYT & thu ngân',
    items: [
      {
        q: 'Hệ thống tính mức hưởng BHYT (80%, 95% hoặc 100%) như thế nào? Khi thẻ báo không hợp lệ thì xử lý ra sao?',
        a: 'Khi tạo lượt khám, bấm "+ Khai Báo Thẻ BHYT", nhập mã số thẻ 15 ký tự, chọn mức hưởng 80%, 95% hoặc 100% ghi trên thẻ và nơi đăng ký KCB ban đầu. Ở tab "Thu Ngân & BHYT", bấm "Áp Dụng BHYT" để trừ phần BHYT chi trả vào hóa đơn. Báo "Thẻ BHYT không hợp lệ hoặc đã hết hạn" nghĩa là thẻ đã quá hạn sử dụng; khi đó bệnh nhân tự chi trả toàn bộ hoặc cập nhật thẻ mới. Lưu ý: khám ngoại trú trái tuyến không có giấy chuyển tuyến thì BHYT chi trả 0%.',
      },
      {
        q: 'Bệnh nhân không có BHYT: thu viện phí và xác nhận "Đã đóng phí" thế nào?',
        a: 'Vào "Khai báo BHYT & Thu ngân" → danh sách "Chờ Thanh Toán". Với hóa đơn của bệnh nhân, bấm "Tiền Mặt" khi thu tiền mặt, hoặc "PayOS QR" để bệnh nhân quét mã chuyển khoản. Khi thanh toán xong, hóa đơn chuyển sang đã thanh toán và kỹ thuật viên sẽ thấy nhãn "Đã đóng phí".',
      },
      {
        q: 'Bệnh nhân quét VietQR thanh toán rồi nhưng hóa đơn vẫn báo "Chưa đóng phí" thì làm sao?',
        a: 'Hóa đơn được cập nhật tự động khi PayOS xác nhận giao dịch, thường chỉ mất vài giây đến vài phút. Hãy tải lại danh sách hóa đơn. Nếu vẫn chưa cập nhật, kiểm tra giao dịch trên ứng dụng ngân hàng của bệnh nhân (đúng số tiền, đúng nội dung chuyển khoản). Không thu tiền lần hai; hãy gửi ticket chủ đề "Thanh toán" kèm mã hóa đơn và ảnh chụp giao dịch.',
      },
      {
        q: 'Trường hợp cấp cứu có phải thu tiền trước không?',
        a: 'Không. Ca cấp cứu áp dụng cơ chế "Chụp trước, thu sau": bệnh nhân được ưu tiên khám và chụp ngay, hóa đơn được tạo và thu sau khi tình trạng ổn định. Ca này được gắn nhãn "CẤP CỨU" trong hàng chờ.',
      },
    ],
  },
];

const NURSE_FAQS = [
  {
    category: 'Sinh hiệu & chăm sóc',
    items: [
      {
        q: 'Nhập 5 chỉ số sinh hiệu ở đâu? Nếu nhập sai thì sửa thế nào?',
        a: 'Vào "Nhập sinh hiệu" → chọn bệnh nhân trong danh sách lượt khám → điền mạch, huyết áp, nhiệt độ, SpO2 và nhịp thở trong "Phiếu Thông Tin Khám Bệnh" → bấm "Xác nhận & Lưu phiếu khám". Nếu nhập sai, bấm "Sửa lại phiếu" để chỉnh và lưu lại.',
      },
      {
        q: 'Vì sao màn hình hiện cảnh báo đỏ "CẢNH BÁO CẤP CỨU"?',
        a: 'Banner đỏ xuất hiện khi có nhân viên kích hoạt báo động cấp cứu cho một bệnh nhân (ví dụ nút "Báo Động Cấp Cứu Tại Giường" hoặc nút "Cấp cứu" trong hàng chờ). Việc nhập sinh hiệu không tự bật cảnh báo này. Nếu bạn đo thấy chỉ số bất thường (SpO2 thấp, huyết áp tụt...), hãy báo ngay bác sĩ trực và kích hoạt báo động cấp cứu nếu cần.',
      },
      {
        q: 'Lập phiếu chăm sóc (care sheet) như thế nào?',
        a: 'Vào "Bệnh án & EMR" → chọn hồ sơ bệnh án → tab "Phiếu chăm sóc" → "+ Thêm phiếu". Điền cấp chăm sóc (1–3), mạch, huyết áp, nhiệt độ, nhịp thở, SpO2, tên điều dưỡng và diễn biến, rồi lưu phiếu.',
      },
      {
        q: 'Điều dưỡng xem được những phần nào của bệnh án?',
        a: 'Điều dưỡng xem được thông tin hành chính, hồ sơ bệnh án, sinh hiệu và phiếu chăm sóc của bệnh nhân thuộc bệnh viện mình. Các chức năng Hội chẩn, Giấy cam đoan và Kê đơn thuốc chỉ dành cho bác sĩ.',
      },
    ],
  },
  {
    category: 'Giường bệnh',
    items: [
      {
        q: 'Làm sao xếp giường hoặc chuyển giường cho bệnh nhân nội trú?',
        a: 'Vào "Sơ đồ Giường bệnh". Với giường trống, bấm "Giữ chỗ 4h" để giữ trước hoặc "Nhập giường" để xếp bệnh nhân vào ngay. Với giường đang có bệnh nhân, bấm "Chuyển" để điều chuyển sang giường khác hoặc "Trả giường" khi bệnh nhân ra viện. Giường sau khi trả sẽ chuyển sang trạng thái "Đang khử khuẩn" cho đến khi được xác nhận hoàn tất vệ sinh.',
      },
      {
        q: 'Khi xếp giường tôi nhận lỗi giường "vừa được giữ chỗ bởi nhân viên khác". Nghĩa là gì?',
        a: 'Có đồng nghiệp đã giữ chỗ hoặc xếp bệnh nhân vào giường đó ngay trước bạn. Hệ thống khóa để một giường không bị xếp cho hai bệnh nhân cùng lúc. Hãy tải lại sơ đồ giường và chọn một giường trống khác.',
      },
    ],
  },
  {
    category: 'Lịch làm việc',
    items: [
      {
        q: 'Đăng ký hoặc đổi ca trực thế nào?',
        a: 'Vào "Lịch làm việc Điều dưỡng". Bấm "Đăng ký ca làm" (hoặc "+ Đăng ký ca trực ngày này" trên lịch), chọn ngày và ca (Sáng, Chiều, Đêm, Trực 24 giờ); ca sẽ ở trạng thái "Chờ duyệt" đến khi Admin bệnh viện phê duyệt. Để đổi ca, tạo "Yêu cầu đổi ca": chọn ngày muốn đổi, người đổi chéo (để trống nếu muốn nhường ca) và lý do.',
      },
    ],
  },
];

const DOCTOR_FAQS = [
  {
    category: 'Khám & chỉ định',
    items: [
      {
        q: 'Hàng chờ khám được sắp xếp theo thứ tự nào? Làm sao nhận một ca?',
        a: 'Hàng chờ hiển thị các lượt khám được phân công cho bạn, lượt mới nhất ở trên cùng. Ca cấp cứu được gắn nhãn đỏ "Cấp cứu" và cần ưu tiên xử lý trước. Bấm "Bắt đầu khám" để nhận ca, sau đó dùng "Khám & Kê đơn" và "Kết thúc khám" khi hoàn tất.',
      },
      {
        q: 'Làm sao chỉ định chụp MRI sọ não? Khi nào phải làm bảng kiểm an toàn và giấy cam đoan tiêm thuốc cản quang?',
        a: 'Trong ca đang khám, bấm "Ra Y Lệnh MRI" → chọn vùng chụp, ghi chú cho KTV, tick "Yêu cầu AI phân tích kết quả sau khi chụp" nếu cần → "Xác Nhận Ra Y Lệnh". Bảng kiểm an toàn MRI bắt buộc trước khi bệnh nhân vào buồng máy và do KTV thực hiện. Nếu chụp có tiêm thuốc đối quang từ (Gadolinium), bác sĩ lập giấy cam đoan trong tab "Giấy cam đoan" của bệnh án (bấm "+ Tạo giấy cam đoan") trước khi chụp.',
      },
      {
        q: 'Theo dõi tiến độ chụp MRI của bệnh nhân ở đâu?',
        a: 'Vào menu "Hàng đợi chụp MRI". Mỗi ca hiển thị trạng thái hiện tại: Chờ chụp → Đang chụp → Chờ kết quả AI → Chờ bác sĩ đọc, kèm lý do nếu ca bị yêu cầu chụp lại hoặc bị hủy. Khi ca ở trạng thái "Chờ bác sĩ đọc", bấm "Đọc Kết Quả Phim" để xem phim.',
      },
    ],
  },
  {
    category: 'AI & kết quả',
    items: [
      {
        q: 'Kết quả AI gồm những gì? Nên tin đến mức nào?',
        a: 'Kết quả gồm: loại tổn thương dự đoán (Glioma, Meningioma, Pituitary hoặc Bình thường), độ tin cậy (%), phân phối xác suất của cả 4 nhóm, bản đồ nhiệt Grad-CAM kèm khung khoanh vùng YOLO, và thông điệp đồng thuận giữa các mô hình. AI chỉ là công cụ hỗ trợ: cần thận trọng hơn khi độ tin cậy dưới 80% hoặc có xung đột mô hình. Bác sĩ luôn là người kết luận: chọn "AI đúng — Duyệt chẩn đoán" hoặc "AI sai" để chọn chẩn đoán đúng; phản hồi này được dùng để huấn luyện lại AI.',
      },
      {
        q: '"AI đồng thuận" và "AI xung đột" khác nhau thế nào? Gặp trường hợp xung đột thì nên làm gì?',
        a: 'Đồng thuận: nhóm 3 mô hình phân loại (Ensemble) và mô hình khoanh vùng YOLO cho cùng kết quả. Xung đột: hai bên bất đồng, ví dụ Ensemble báo không có u nhưng YOLO thấy tổn thương, hoặc Ensemble thấy u nhưng độ tin cậy thấp. Khi xung đột, hệ thống có thể dùng Gemini để phân xử. Bác sĩ nên đọc kỹ phim gốc, xem thêm các chuỗi xung khác và cân nhắc hội chẩn trước khi kết luận.',
      },
    ],
  },
  {
    category: 'Bệnh án, thuốc & cấp cứu',
    items: [
      {
        q: 'Vì sao bệnh án đã ký thì không sửa được? Nếu cần bổ sung thì làm thế nào?',
        a: 'Theo Thông tư 46/2018/TT-BYT, hồ sơ đã "Ký Số EMR" hoặc bệnh nhân đã xuất viện sẽ bị khóa để chống chỉnh sửa. Muốn bổ sung, bấm "+ Lập Phụ Lục (TT 46)" trên hồ sơ, nhập tiêu đề, lý do và nội dung bổ sung. Trước khi ký, mỗi lần cập nhật hồ sơ đều được lưu thành một phiên bản mới để truy vết.',
      },
      {
        q: 'Khi kê đơn, hệ thống cảnh báo tương tác thuốc hoặc chống chỉ định. Xử lý thế nào?',
        a: 'Ở tab "Toa thuốc", hệ thống tự kiểm tra tương tác chéo giữa các thuốc và chống chỉ định với bệnh nhân, kèm nhận định của Dược sĩ AI. Hãy đổi thuốc hoặc điều chỉnh liều theo khuyến nghị. Nếu vẫn cần kê theo chỉ định chuyên môn, với cảnh báo mức nghiêm trọng bắt buộc phải nhập lý do vẫn kê (ví dụ: đã hội chẩn, sẽ theo dõi sát chức năng gan thận); lý do này được lưu vào hồ sơ.',
      },
      {
        q: 'Nhận được thông báo Cảnh báo cấp cứu [RED] thì phải làm gì?',
        a: 'Banner đỏ ghi tên bệnh nhân, mã y tế và lý do cấp cứu. Bấm "Xử lý ngay" để mở "Hàng đợi chụp MRI", nơi ca cấp cứu được ưu tiên với cơ chế "Chụp trước, thu sau". Đến giường bệnh nhân ngay, đánh giá và xử trí theo quy trình cấp cứu thần kinh. Với bệnh nhân nội trú, dùng "Báo Động Cấp Cứu Tại Giường" trên sơ đồ giường để cập nhật và đóng sự kiện khi đã ổn định.',
      },
      {
        q: 'Làm thủ tục chuyển viện liên viện như thế nào?',
        a: 'Mở hồ sơ bệnh nhân → tab "Chuyển tuyến" → "Lập Phiếu chuyển tuyến BHYT", điền chẩn đoán chính và lý do chuyển tuyến, lưu và "In phiếu chuyển tuyến (PDF)". Theo dõi các yêu cầu gửi đi hoặc nhận về trong menu "Chuyển viện Liên viện" (Chờ tiếp nhận / Đã chấp nhận / Từ chối tiếp nhận). Khi bệnh viện nhận chấp nhận, hệ thống tự động giữ chỗ một giường.',
      },
      {
        q: 'Xem lịch trực và đăng ký đổi ca ở đâu?',
        a: 'Vào "Lịch trực Bác sĩ" để xem lịch tuần (Tuần trước / Tuần này / Tuần sau). Bấm "Đăng ký ca làm" để đăng ký ca, hoặc tạo "Yêu cầu đổi ca" với ngày muốn đổi, người đổi chéo và lý do. Yêu cầu sẽ chờ Admin bệnh viện phê duyệt.',
      },
    ],
  },
];

const TECHNICIAN_FAQS = [
  {
    category: 'Chụp phim MRI',
    items: [
      {
        q: 'Vì sao tôi không chuyển được ca sang trạng thái chụp?',
        a: 'Trước khi chụp, bệnh nhân bắt buộc phải qua "Bảng Kiểm An Toàn MRI Trước Buồng Máy" (bấm "Kiểm tra An toàn & Chụp"). Nếu tick bệnh nhân có máy tạo nhịp tim hoặc kim loại từ tính, hệ thống chặn tuyệt đối vì nguy hiểm trong từ trường 1.5T/3T. Khi đó hãy báo bác sĩ chỉ định để đổi phương pháp chẩn đoán, và hủy ca với lý do tương ứng.',
      },
    ],
  },
  {
    category: 'Tải phim & AI',
    items: [
      {
        q: 'Tải file DICOM lên bị lỗi hoặc quá chậm thì làm sao?',
        a: 'Mỗi ca chụp nộp tối đa 3 ảnh lát cắt tiêu biểu (JPG/PNG) và một file nén DICOM (.zip hoặc .rar) tối đa 200MB. Nếu bị lỗi, hãy kiểm tra định dạng và dung lượng file, nén lại bộ DICOM nếu cần, và dùng mạng nội bộ ổn định; file lớn có thể mất vài phút để tải lên. File nén DICOM là tùy chọn: bạn vẫn nộp được kết quả chỉ với ảnh lát cắt rồi bổ sung sau.',
      },
      {
        q: 'AI phân tích mất bao lâu? Tôi đợi mà không thấy kết quả thì xử lý thế nào?',
        a: 'Thông thường AI trả kết quả trong vài giây sau khi nộp phim; ca có xung đột giữa các mô hình cần thêm thời gian để phân xử. Ca cấp cứu được ưu tiên xử lý trước. Nếu ca bị chuyển sang trạng thái "Lỗi AI" hoặc chờ quá lâu, bác sĩ vẫn có thể đọc phim bình thường; hãy gửi ticket chủ đề "Lỗi kỹ thuật phần mềm" kèm mã bệnh nhân để đội kỹ thuật kiểm tra.',
      },
    ],
  },
];

const HOSPITAL_ADMIN_FAQS = [
  {
    category: 'Nhân sự & lịch làm việc',
    items: [
      {
        q: 'Làm sao thêm nhân viên (bác sĩ, điều dưỡng, KTV, lễ tân) và phân quyền cho họ?',
        a: 'Vào "Quản lý Nhân sự", điền họ tên, email, mật khẩu ban đầu, khoa phòng và chức vụ rồi lưu. Quyền truy cập được cấp tự động theo chức vụ. Tài khoản mới ở trạng thái "Chờ kích hoạt"; ở lần đăng nhập đầu tiên, nhân viên phải cập nhật email chính thức và đặt mật khẩu mới.',
      },
      {
        q: 'Nhân viên nghỉ việc: khóa tài khoản thế nào mà vẫn giữ lịch sử?',
        a: 'Trong "Quản lý Nhân sự", tìm nhân viên và bấm "Khóa". Tài khoản chuyển sang "Đã khóa" và không thể đăng nhập, nhưng toàn bộ bệnh án, chữ ký và nhật ký thao tác do người đó thực hiện vẫn được giữ nguyên. Có thể bấm "Mở khóa" nếu nhân viên quay lại làm việc.',
      },
      {
        q: 'Xếp lịch làm việc và duyệt yêu cầu đổi ca ở đâu?',
        a: 'Vào "Lịch làm việc". Bạn có thể xếp ca trực tiếp cho nhân viên, duyệt các phiếu đăng ký ca ("Phê duyệt" / "Từ chối" kèm lý do gửi thông báo tới nhân viên) và xử lý yêu cầu đổi ca ở mục "Phê Duyệt Đổi Ca Trực".',
      },
    ],
  },
  {
    category: 'Cơ sở vật chất & kho thuốc',
    items: [
      {
        q: 'Làm sao cấu hình phòng chụp MRI, khoa phòng và sơ đồ giường?',
        a: 'Giường bệnh: vào "Sơ đồ Giường bệnh" → "Thêm Giường U Não" để thêm giường theo khoa/phân khu. Bảng giá dịch vụ và số bệnh nhân tối đa mỗi ngày: vào "Báo cáo Tài chính" → mục "Bảng giá dịch vụ & Giới hạn tiếp đón". Danh mục phòng chụp MRI và khoa phòng được khởi tạo khi bệnh viện được kích hoạt; nếu cần thêm hoặc chỉnh sửa, vui lòng gửi ticket cho đội kỹ thuật.',
      },
      {
        q: 'Quản lý kho thuốc: nhập thuốc và nhận cảnh báo khi thuốc sắp hết thế nào?',
        a: 'Vào "Quản lý kho thuốc" để thêm thuốc vào danh mục (kèm hạn dùng và mức tồn kho tối thiểu) và cập nhật số lượng tồn kho. Tab "Cảnh báo hết" liệt kê các thuốc có tồn kho dưới mức tối thiểu; bấm "Nhập kho ngay" để bổ sung. Hạn dùng được lưu trong thông tin từng thuốc, bạn nên kiểm tra định kỳ.',
      },
      {
        q: 'Cập nhật thông tin và giấy phép hoạt động của bệnh viện ở đâu?',
        a: 'Vào "Thông tin bệnh viện" để khai báo thông tin bệnh viện và tải lên giấy phép hoạt động (PDF hoặc ảnh). Sau khi gửi, hồ sơ sẽ được Quản trị hệ thống thẩm định và xác thực.',
      },
    ],
  },
  {
    category: 'Tài chính & bảo mật',
    items: [
      {
        q: 'Báo cáo tài chính và BHYT xem hoặc xuất như thế nào?',
        a: 'Vào "Báo cáo Tài chính": tab "Tổng quan chung" xem doanh thu, giao dịch và cơ cấu nguồn thu; tab "Báo cáo doanh thu" để "Lập báo cáo mới" theo tháng hoặc "Xuất kiểm toán CSV". Để gửi dữ liệu giám định BHYT, bấm "Xuất BHYT XML 4210".',
      },
      {
        q: 'Dữ liệu của bệnh viện tôi có bị bệnh viện khác nhìn thấy không?',
        a: 'Không. Dữ liệu được tách riêng theo từng bệnh viện: nhân viên chỉ truy cập được bệnh nhân, bệnh án và phim chụp của bệnh viện mình. Dữ liệu chỉ được chia sẻ ra ngoài khi lập hồ sơ chuyển viện hoặc khi bệnh nhân tự tạo mã QR chia sẻ, và mọi truy cập đều được ghi nhật ký kiểm toán.',
      },
    ],
  },
];

const SYSTEM_ADMIN_FAQS = [
  {
    category: 'Quản trị bệnh viện & tuân thủ',
    items: [
      {
        q: 'Làm sao duyệt một bệnh viện mới đăng ký?',
        a: 'Vào Admin Console → tab "Bệnh viện". Lọc trạng thái "Chờ duyệt", chọn bệnh viện để xem chi tiết (địa chỉ, người đại diện, IT phụ trách, giấy phép hoạt động), sau đó bấm "Xác thực tài khoản". Có thể "Khoá" hoặc "Mở khoá" bệnh viện và "Reset mật khẩu tạm" khi cần.',
      },
      {
        q: 'Xem nhật ký hệ thống (audit log) ở đâu, và lọc những thao tác nhạy cảm thế nào?',
        a: 'Vào tab "Audit Logs". Tìm theo hành động, entity hoặc người thực hiện, và lọc theo bệnh viện hoặc entity (ví dụ User, MedicalRecord). Mỗi dòng ghi thời gian, người thực hiện, bệnh viện, hành động và chi tiết thay đổi.',
      },
    ],
  },
  {
    category: 'Mô hình AI & dữ liệu',
    items: [
      {
        q: 'Làm sao theo dõi độ chính xác của mô hình AI, huấn luyện lại, triển khai và rollback?',
        a: 'Vào tab "Huấn luyện & Chatbot". Mục "Thống kê Phản hồi Bác sĩ" cho biết số ca AI đúng và số ca bác sĩ đã sửa. Bấm nút huấn luyện lại để chạy vòng Active Learning (nên có từ 50 ca phản hồi trở lên). Xem "Kết quả Kiểm chuẩn tự động" so sánh độ chính xác cũ và mới, rồi bấm "Phê duyệt & Áp dụng ngay (Hot-Reload)". Nếu mô hình mới hoạt động kém, bấm "Hoàn tác (Rollback)" để quay về mô hình trước.',
      },
      {
        q: 'Quản lý các bộ dữ liệu (dataset) phản hồi từ bác sĩ như thế nào?',
        a: 'Vào tab "Dataset" để tạo dataset, đặt mô tả, giá bán và chế độ công khai; lọc theo trạng thái Nháp / Chờ duyệt / Đã xuất bản / Đã archive. Các ca bác sĩ sửa kết quả AI (kèm vùng khoanh) được tích lũy trong nhật ký phản hồi ở tab "Huấn luyện & Chatbot".',
      },
      {
        q: 'AI Engine không phản hồi: kiểm tra những gì trước?',
        a: 'Kiểm tra lần lượt: (1) dịch vụ FastAPI đang chạy ở cổng 8000 (mở http://<máy chủ>:8000/docs); (2) biến AI_SERVER_URL trong cấu hình Backend trỏ đúng địa chỉ; (3) log khởi động của AI xem các mô hình ResNet/EfficientNet/DenseNet và YOLOv8 đã tải thành công chưa; (4) GEMINI_API_KEY còn hiệu lực (chỉ ảnh hưởng phần phân xử và sinh báo cáo). Các ca lỗi sẽ ở trạng thái "Lỗi AI"; bác sĩ vẫn đọc phim thủ công được trong lúc khắc phục.',
      },
    ],
  },
];

const FAQS_BY_ROLE = {
  patient: PATIENT_FAQS,
  receptionist: RECEPTIONIST_FAQS,
  nurse: NURSE_FAQS,
  doctor: DOCTOR_FAQS,
  technician: TECHNICIAN_FAQS,
  hospital_admin: HOSPITAL_ADMIN_FAQS,
  admin: SYSTEM_ADMIN_FAQS,
  system_admin: SYSTEM_ADMIN_FAQS,
};

export const getFaqsForRole = (role) => [...(FAQS_BY_ROLE[role] || []), COMMON_FAQS];
