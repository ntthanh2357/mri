// Khung bố cục dùng chung (2026-10-05). Mọi màn mới/được làm lại dùng các hằng số này
// thay vì tự đặt maxWidth/padding riêng (trước đây 836 / 948 / 1040 / 1240 / tràn màn hình).
const Layout = {
  // width > tablet → bố cục desktop (sidebar cố định, 2 cột)
  tablet: 768,
  // width > wide → được phép chia 2 cột nội dung (danh sách + panel chi tiết)
  wide: 1100,
  maxWidth: {
    reading: 880, // màn đọc: hồ sơ, giấy tờ, hỗ trợ
    default: 1240, // màn làm việc / tổng quan
  },
  gutter: { mobile: 16, desktop: 28 },
  sectionGap: { mobile: 20, desktop: 24 },
};

export default Layout;
