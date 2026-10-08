import { MedicineReminder } from "../models/medicineReminder.model.js";
import { PatientProfile } from "../models/patientProfile.model.js";
import { getDayRangeVN } from "../utils/date.util.js";

/**
 * UC-PAT-13 — Giờ nhắc uống thuốc theo 4 khung Sáng/Trưa/Chiều/Tối do bệnh nhân tự đặt.
 * Chưa đặt giờ riêng thì giữ nguyên giờ cố định cũ (08:00, 13:00, 20:00…).
 * Không dùng $or trong truy vấn: tenancyPlugin chèn $or (patientId/userId) cho phiên bệnh nhân và sẽ đè lên.
 */

export const REMINDER_SLOTS = ["morning", "noon", "afternoon", "evening"];

const LEGACY_TIMES = {
  1: ["08:00"],
  2: ["08:00", "20:00"],
  3: ["08:00", "13:00", "20:00"],
  4: ["08:00", "12:00", "17:00", "21:00"],
};
const SLOTS_BY_COUNT = {
  1: ["morning"],
  2: ["morning", "evening"],
  3: ["morning", "noon", "evening"],
  4: ["morning", "noon", "afternoon", "evening"],
};
// Ranh giới suy ra khung cho lịch nhắc cũ chưa lưu khung: [từ, đến)
const SLOT_RANGES = { morning: ["00:00", "11:00"], noon: ["11:00", "15:00"], afternoon: ["15:00", "19:00"], evening: ["19:00", "24:00"] };

const HHMM = /^(\d{1,2}):(\d{2})$/;
const httpError = (status, message) => Object.assign(new Error(message), { status });

export const slotOfTime = (time) => REMINDER_SLOTS.find((s) => time >= SLOT_RANGES[s][0] && time < SLOT_RANGES[s][1]) || "evening";

/** Các lần nhắc trong ngày [{slot, time}] theo số lần/ngày; prefs null → giờ cố định cũ. */
export const scheduleFor = (timesPerDay, prefs) => {
  const n = Math.min(Math.max(Number(timesPerDay) || 2, 1), 4);
  return SLOTS_BY_COUNT[n].map((slot, i) => ({ slot, time: prefs ? prefs[slot] : LEGACY_TIMES[n][i] }));
};

/** Kiểm tra 4 giờ HH:MM, chuẩn hoá 2 chữ số, bắt buộc tăng dần Sáng < Trưa < Chiều < Tối. */
export const normalizeReminderTimes = (body = {}) => {
  const times = {};
  for (const slot of REMINDER_SLOTS) {
    const m = String(body[slot] || "").trim().match(HHMM);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { times: null, error: "Giờ nhắc phải có dạng giờ:phút, ví dụ 07:30." };
    times[slot] = `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  for (let i = 1; i < REMINDER_SLOTS.length; i++) {
    if (times[REMINDER_SLOTS[i]] <= times[REMINDER_SLOTS[i - 1]]) {
      return { times: null, error: "Giờ nhắc phải theo thứ tự Sáng, Trưa, Chiều, Tối (giờ sau muộn hơn giờ trước)." };
    }
  }
  return { times, error: null };
};

export const getReminderTimes = async (patientId) => {
  const profile = await PatientProfile.findOne({ userId: patientId }).select("reminderTimes").lean();
  const t = profile?.reminderTimes;
  return t && REMINDER_SLOTS.every((s) => t[s]) ? { morning: t.morning, noon: t.noon, afternoon: t.afternoon, evening: t.evening } : null;
};

/** Lưu giờ nhắc và dời các lần nhắc từ hôm nay trở đi còn chưa uống. Trả số lần nhắc đã đổi giờ. */
export const saveReminderTimes = async (patientId, body, hospitalId) => {
  const { times, error } = normalizeReminderTimes(body);
  if (error) throw httpError(400, error);

  // Không upsert: tenancyPlugin chèn $or vào bộ lọc của phiên bệnh nhân, upsert sẽ lỗi
  const profile = (await PatientProfile.findOne({ userId: patientId })) || new PatientProfile({ userId: patientId, hospitalId });
  profile.reminderTimes = { ...times, updatedAt: new Date() };
  await profile.save();

  // Lịch nhắc cũ chưa có khung: gán khung theo giờ hiện tại của nó
  for (const slot of REMINDER_SLOTS) {
    const [from, to] = SLOT_RANGES[slot];
    await MedicineReminder.updateMany({ patientId, slot: { $in: [null, ""] }, time: { $gte: from, $lt: to } }, { $set: { slot } });
  }

  const { startOfDay } = getDayRangeVN();
  let updated = 0;
  for (const slot of REMINDER_SLOTS) {
    const res = await MedicineReminder.updateMany(
      { patientId, slot, status: "pending", date: { $gte: startOfDay } },
      { $set: { time: times[slot] } }
    );
    updated += res.modifiedCount || 0;
  }
  return updated;
};
