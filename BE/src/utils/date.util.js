/**
 * Tiện ích xử lý múi giờ y tế Việt Nam (GMT+7 - Asia/Ho_Chi_Minh)
 * Giải quyết triệt để lỗi lệch múi giờ giữa máy chủ Cloud (UTC) và giờ khám chữa bệnh tại Việt Nam.
 */

/**
 * Trả về mốc thời gian bắt đầu ngày (00:00:00.000) và kết thúc ngày (23:59:59.999) theo múi giờ Việt Nam.
 * @param {Date|string|number} [dateInput=new Date()] 
 * @returns {{ startOfDay: Date, endOfDay: Date }}
 */
export const getDayRangeVN = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  
  // Format theo múi giờ Việt Nam thành chuỗi YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  
  const formattedDate = formatter.format(date); // Output: "YYYY-MM-DD"
  
  // Tạo Date object với offset rõ ràng +07:00
  const startOfDay = new Date(`${formattedDate}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${formattedDate}T23:59:59.999+07:00`);
  
  return { startOfDay, endOfDay };
};

/**
 * Định dạng thời gian hiển thị theo chuẩn y khoa Việt Nam (DD/MM/YYYY HH:mm:ss)
 * @param {Date|string|number} dateInput 
 * @returns {string}
 */
export const formatDateTimeVN = (dateInput = new Date()) => {
  if (!dateInput) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(dateInput));
};
