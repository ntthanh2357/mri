// Chuẩn hóa & kiểm tra trường hồ sơ tài khoản dùng chung giữa ResponsiveLayout và HomeScreen.

export const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác'];

/** Định dạng chuỗi nhập ngày sinh thành DD/MM/YYYY khi người dùng gõ số. */
export const formatDobDigits = (text) => {
  const digits = String(text || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/** Chuyển Date/ISO string sang DD/MM/YYYY (theo UTC để tránh lệch múi giờ). */
export const formatDobDisplay = (dob) => {
  if (!dob) return '';
  const dt = new Date(dob);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const computeAgeFromDob = (dob, birthYear) => {
  const now = new Date();
  if (dob) {
    const dt = new Date(dob);
    if (!Number.isNaN(dt.getTime())) {
      let age = now.getFullYear() - dt.getUTCFullYear();
      const monthDiff = (now.getMonth() + 1) - (dt.getUTCMonth() + 1);
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dt.getUTCDate())) {
        age -= 1;
      }
      return age >= 0 ? age : 0;
    }
  }
  const yr = Number(birthYear);
  if (Number.isInteger(yr) && yr >= 1900 && yr <= now.getFullYear()) {
    return now.getFullYear() - yr;
  }
  return null;
};

/**
 * Kiểm tra & phân tích chuỗi ngày sinh (DD/MM/YYYY hoặc YYYY-MM-DD).
 * Trả về { ok: true, iso, display, birthYear, age } hoặc { ok: false, message }.
 */
export const parseDobInput = (raw) => {
  const s = String(raw || '').trim();
  if (!s) {
    return { ok: true, iso: null, display: '', birthYear: null, age: null };
  }

  let day;
  let month;
  let year;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return { ok: false, message: 'Ngày sinh phải theo định dạng DD/MM/YYYY (ví dụ 15/08/1995).' };
  }

  const curYear = new Date().getFullYear();
  if (year < 1900 || year > curYear || month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, message: 'Ngày tháng năm sinh không hợp lệ.' };
  }

  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { ok: false, message: 'Ngày sinh không tồn tại trong lịch.' };
  }

  const todayNoon = new Date();
  const todayUtc = Date.UTC(todayNoon.getFullYear(), todayNoon.getMonth(), todayNoon.getDate(), 23, 59, 59);
  if (dt.getTime() > todayUtc) {
    return { ok: false, message: 'Ngày sinh không được lớn hơn ngày hiện tại.' };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    ok: true,
    iso: `${year}-${mm}-${dd}`,
    display: `${dd}/${mm}/${year}`,
    birthYear: year,
    age: computeAgeFromDob(dt),
  };
};

export const formatDobSummary = (profile) => {
  const dobText = formatDobDisplay(profile?.dob);
  const age = computeAgeFromDob(profile?.dob, profile?.birthYear);
  if (dobText) {
    return age != null ? `${dobText} (${age} tuổi)` : dobText;
  }
  if (profile?.birthYear) {
    return age != null ? `Năm sinh ${profile.birthYear} (${age} tuổi)` : `Năm sinh ${profile.birthYear}`;
  }
  return 'Chưa cập nhật';
};

export const buildProfilePayload = ({ name, phone, address, gender, dobText }) => {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return { ok: false, error: 'Vui lòng nhập họ và tên.' };
  }

  const cleanGender = String(gender || '').trim();
  if (cleanGender && !GENDER_OPTIONS.includes(cleanGender)) {
    return { ok: false, error: 'Giới tính không hợp lệ (chỉ chọn Nam, Nữ hoặc Khác).' };
  }

  const dobParsed = parseDobInput(dobText);
  if (!dobParsed.ok) {
    return { ok: false, error: dobParsed.message };
  }

  const cleanPhone = String(phone || '').trim();
  if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 9) {
    return { ok: false, error: 'Số điện thoại không hợp lệ (cần tối thiểu 9 chữ số).' };
  }

  return {
    ok: true,
    payload: {
      name: cleanName,
      gender: cleanGender,
      dob: dobParsed.iso,
      phone: cleanPhone || undefined,
      address: String(address || '').trim(),
    },
  };
};

