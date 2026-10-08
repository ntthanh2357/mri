import { encryptField, decryptField, maskTail } from "./fieldCrypto.service.js";

/**
 * UC-PAT-02 — Hồ sơ cá nhân & BHYT bệnh nhân tự khai: chuẩn hoá/kiểm tra đầu vào và dữ liệu trả ra.
 * Hàm thuần (không truy cập DB) để test được; service hồ sơ dùng kết quả `update` cho $set.
 */

const CITIZEN_ID = /^\d{12}$/;            // CCCD gắn chip: 12 chữ số
const BHYT_CARD = /^[A-Z]{2}\d{13}$/;     // Mã thẻ BHYT: 2 chữ cái + 13 chữ số (15 ký tự)
const PHONE = /^\+?\d{9,12}$/;
const MAX_ALLERGIES = 20;

const clean = (v) => (typeof v === "string" ? v.trim() : v);

/** @returns {{ update: object, errors: object }} update dùng trực tiếp cho $set (khóa dạng "a.b") */
export const normalizeIdentityUpdate = (data = {}) => {
  const update = {};
  const errors = {};

  for (const key of ["phone", "address"]) {
    if (data[key] !== undefined) update[key] = String(clean(data[key]) || "");
  }
  if (data.gender !== undefined) {
    if (["nam", "nu", "khac", ""].includes(data.gender)) update.gender = data.gender;
    else errors.gender = "Giới tính không hợp lệ.";
  }
  if (data.dateOfBirth !== undefined) {
    const d = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (d && (isNaN(d) || d > new Date())) errors.dateOfBirth = "Ngày sinh không hợp lệ.";
    else update.dateOfBirth = d;
  }

  if (data.citizenId !== undefined) {
    const v = String(clean(data.citizenId) || "");
    if (v && !CITIZEN_ID.test(v)) errors.citizenId = "Số CCCD gồm đúng 12 chữ số.";
    else update.citizenIdEnc = encryptField(v);
  }

  // Thẻ BHYT tự khai → luôn quay về "chờ xác nhận" khi thông tin thẻ thay đổi
  const touchesCard = ["bhytCardNumber", "bhytExpiresAt", "bhytRegistrationPlace"].some((k) => data[k] !== undefined);
  if (data.bhytCardNumber !== undefined) {
    const v = String(clean(data.bhytCardNumber) || "").toUpperCase().replace(/\s+/g, "");
    if (v && !BHYT_CARD.test(v)) errors.bhytCardNumber = "Mã thẻ BHYT gồm 15 ký tự: 2 chữ cái và 13 chữ số (vd. HS4010123456789).";
    else update["bhytDeclared.cardNumberEnc"] = encryptField(v);
  }
  if (data.bhytExpiresAt !== undefined) {
    const d = data.bhytExpiresAt ? new Date(data.bhytExpiresAt) : null;
    if (d && isNaN(d)) errors.bhytExpiresAt = "Ngày hết hạn thẻ không hợp lệ.";
    else update["bhytDeclared.expiresAt"] = d;
  }
  if (data.bhytRegistrationPlace !== undefined) update["bhytDeclared.registrationPlace"] = String(clean(data.bhytRegistrationPlace) || "");
  if (touchesCard && !errors.bhytCardNumber) {
    update["bhytDeclared.status"] = "pending";
    update["bhytDeclared.declaredAt"] = new Date();
    update["bhytDeclared.verifiedAt"] = null;
    update["bhytDeclared.verifiedBy"] = null;
  }

  if (data.emergencyContact !== undefined) {
    const c = data.emergencyContact || {};
    const phone = String(clean(c.phone) || "").replace(/[\s.-]/g, "");
    if (phone && !PHONE.test(phone)) errors.emergencyContactPhone = "Số điện thoại người liên hệ không hợp lệ.";
    else {
      update["emergencyContact.name"] = String(clean(c.name) || "");
      update["emergencyContact.relation"] = String(clean(c.relation) || "");
      update["emergencyContact.phone"] = phone;
    }
  }

  if (data.drugAllergies !== undefined) {
    const seen = new Set();
    const list = [];
    for (const item of Array.isArray(data.drugAllergies) ? data.drugAllergies : []) {
      const v = String(item || "").trim().slice(0, 80);
      if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); list.push(v); }
    }
    update.drugAllergies = list.slice(0, MAX_ALLERGIES);
  }

  return { update, errors };
};

/** Dữ liệu trả ra ngoài — không bao giờ kèm bản mã; số thẻ đầy đủ chỉ khi nhân viên cần đối chiếu. */
export const toPublicIdentity = (profile = {}, { revealCard = false } = {}) => {
  const p = typeof profile.toObject === "function" ? profile.toObject() : profile;
  let citizenId = "", card = "";
  try { citizenId = decryptField(p.citizenIdEnc); } catch { citizenId = ""; }
  try { card = decryptField(p.bhytDeclared?.cardNumberEnc); } catch { card = ""; }
  const bhyt = {
    cardNumberMasked: maskTail(card),
    expiresAt: p.bhytDeclared?.expiresAt || null,
    registrationPlace: p.bhytDeclared?.registrationPlace || "",
    status: p.bhytDeclared?.status || "",
    declaredAt: p.bhytDeclared?.declaredAt || null,
    verifiedAt: p.bhytDeclared?.verifiedAt || null,
  };
  if (revealCard) bhyt.cardNumber = card;
  return {
    _id: p._id,
    userId: p.userId,
    dateOfBirth: p.dateOfBirth || null,
    gender: p.gender || "",
    phone: p.phone || "",
    address: p.address || "",
    citizenIdMasked: maskTail(citizenId),
    hasCitizenId: Boolean(citizenId),
    bhyt,
    emergencyContact: {
      name: p.emergencyContact?.name || "",
      relation: p.emergencyContact?.relation || "",
      phone: p.emergencyContact?.phone || "",
    },
    drugAllergies: Array.isArray(p.drugAllergies) ? p.drugAllergies : [],
  };
};
