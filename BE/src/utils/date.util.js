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

/**
 * Tính toán chính xác khoảng thời gian cả tuần (từ Thứ Hai 00:00:00.000 đến Chủ Nhật 23:59:59.999)
 * theo múi giờ Việt Nam (GMT+7), bảo đảm không bị lệch ngày khi chuyển đổi ISO string hoặc máy chủ UTC.
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {{ start: Date, end: Date, mondayDateStr: string, sundayDateStr: string }}
 */
export const getWeekRangeVN = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  
  const formattedDate = formatter.format(isNaN(date.getTime()) ? new Date() : date); // "YYYY-MM-DD"
  const [yearStr, monthStr, dayStr] = formattedDate.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  // Tạo Date cục bộ tính theo năm tháng ngày tại VN (dùng 12:00 trưa UTC để không bao giờ bị lệch múi giờ)
  const localVN = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dayOfWeek = localVN.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayLocal = new Date(localVN);
  mondayLocal.setUTCDate(localVN.getUTCDate() + diffToMonday);

  const mY = mondayLocal.getUTCFullYear();
  const mM = String(mondayLocal.getUTCMonth() + 1).padStart(2, "0");
  const mD = String(mondayLocal.getUTCDate()).padStart(2, "0");
  const mondayDateStr = `${mY}-${mM}-${mD}`;

  const sundayLocal = new Date(mondayLocal);
  sundayLocal.setUTCDate(mondayLocal.getUTCDate() + 6);
  const sY = sundayLocal.getUTCFullYear();
  const sM = String(sundayLocal.getUTCMonth() + 1).padStart(2, "0");
  const sD = String(sundayLocal.getUTCDate()).padStart(2, "0");
  const sundayDateStr = `${sY}-${sM}-${sD}`;

  const start = new Date(`${mondayDateStr}T00:00:00.000+07:00`);
  const end = new Date(`${sundayDateStr}T23:59:59.999+07:00`);

  return { start, end, mondayDateStr, sundayDateStr };
};

