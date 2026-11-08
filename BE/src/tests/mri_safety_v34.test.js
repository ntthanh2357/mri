// Hồi quy cho các lỗi đã sửa ở module an toàn MRI (Pha 2). Mỗi test ghi rõ số lỗi tương ứng trong báo cáo Pha 1.
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Visit } from "../models/visit.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Notification } from "../models/notification.model.js";
import { ConsentForm } from "../models/consentForm.model.js";
import { submitMriSafetyCheckService, parseEgfrInput } from "../services/visit.service.js";
import { ensureContrastConsentForVisit, contrastRiskBlockMessage } from "../services/contrastConsent.service.js";
import { submitMriSafetyCheck, createMriOrder, updateStatus } from "../controllers/visit.controller.js";
import { submitScreeningChecklist, overrideChecklistRisk } from "../controllers/contrastConsent.controller.js";
import { uploadMriConditionalDoc, getMyQueue } from "../controllers/visit.controller.js";
import { putFile } from "../services/storage/storageService.js";
import visitRoutes from "../routes/visit.routes.js";
import contrastRoutes from "../routes/contrastConsent.routes.js";

const oid = () => new mongoose.Types.ObjectId();
const SAFE = { hasPacemakerOrMetal: false, hasClaustrophobia: false, hasKidneyDisease: false, isPregnant: false };

const makeRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.payload = body; return this; },
});
const call = async (handler, req) => {
  const res = makeRes();
  await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
  return res;
};
// Chạy các middleware checkRole của đúng route với vai trò cho trước, không gọi handler
const routeAllows = (router, method, path, role) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) return null;
  const guards = [...router.stack.filter((l) => !l.route).map((l) => l.handle), ...layer.route.stack.map((s) => s.handle)];
  let blocked = false;
  const res = { status() { blocked = true; return this; }, json() { return this; } };
  for (const handle of guards) {
    if (!/allowedRoles/.test(handle.toString())) continue;
    handle({ user: { role } }, res, () => {});
    if (blocked) return false;
  }
  return true;
};
const rejectMessage = async (promise) => {
  try { await promise; return null; } catch (err) { return { status: err.statusCode, message: err.message }; }
};

describe("Module an toàn MRI: hồi quy sau sửa lỗi", () => {
  let hospitalId, doctor, tech, patient, radiologist, head;
  const userOf = (u) => ({ id: String(u._id), _id: u._id, role: u.role, hospitalId: String(hospitalId), profile: u.profile });
  const newVisit = (extra = {}, status = "chờ chụp") => Visit.create({
    hospitalId, patientId: patient._id, patientName: "BN", doctorId: doctor._id, status, reason: "khám",
    mriOrder: { orderedAt: new Date(), region: "Não", mriStatus: "ordered", ...extra },
  });
  const signConsent = async (visit) => {
    const c = await ensureContrastConsentForVisit(visit);
    c.patientSigned = true;
    c.patientChecklistAt = new Date();
    c.allergyChecklist = { contrastAllergy: "no" };
    await c.save();
    return c;
  };
  const check = (user, visit, data) => submitMriSafetyCheckService({ visitId: visit._id, hospitalId, user: userOf(user), checklistData: data });
  const statusOf = async (visit) => (await Visit.findOne({ _id: visit._id, hospitalId }).lean()).status;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.TEST_MONGO_URI);
    hospitalId = (await Hospital.create({ name: "BV An toàn MRI", code: `MRI-${oid()}` }))._id;
    const mk = (role) => User.create({ email: `mri_${role}_${oid()}@neuroscan.vn`, passwordHash: "x", role, hospitalId, profile: { name: role, fullName: role } });
    doctor = await mk("doctor");
    tech = await mk("technician");
    patient = await mk("patient");
    radiologist = await mk("radiologist");
    head = await mk("department_head");
  });
  const mrDoc = (visit, hid = hospitalId) => putFile({ category: "report", studyId: String(visit._id), fileName: "mr_conditional.pdf", buffer: Buffer.from(`%PDF-1.4 ${oid()}`), mimeType: "application/pdf", hospitalId: hid, syncToDrive: false });

  test("#1, #16: bảng kiểm thiếu câu hoặc sai kiểu bị từ chối, không được coi là đạt", async () => {
    const v = await newVisit();
    for (const data of [{}, { hasPacemakerOrMetal: false }, { ...SAFE, hasPacemakerOrMetal: "false" }, { ...SAFE, isPregnant: null }]) {
      const err = await rejectMessage(check(tech, v, data));
      expect(err.status).toBe(400);
      expect(err.message).toContain("chưa trả lời đủ 4 câu");
    }
    expect(await statusOf(v)).toBe("chờ chụp");
  });

  test("#1 đối chứng: trả lời đủ 4 câu thì vào buồng chụp", async () => {
    const v = await newVisit();
    const res = await check(tech, v, SAFE);
    expect(res.checklist.passed).toBe(true);
    expect(await statusOf(v)).toBe("đang chụp");
  });

  test("#3: eGFR không phải số bị từ chối; số hợp lệ vẫn nhận", async () => {
    for (const bad of ["abc", "", { a: 1 }, [1], Number.NaN]) {
      let status = null;
      try { parseEgfrInput(bad); } catch (err) { status = err.statusCode; }
      expect(status).toBe(400);
    }
    expect(parseEgfrInput(undefined)).toBeNull();
    expect(parseEgfrInput("45")).toBe(45);
    expect(parseEgfrInput(29)).toBe(29);
    const v = await newVisit({ withContrast: true });
    await signConsent(v);
    expect((await rejectMessage(check(tech, v, { ...SAFE, creatinineEgfr: "abc" }))).status).toBe(400);
    expect(await statusOf(v)).toBe("chờ chụp");
  });

  test("#2: sàng lọc lại thấy dị ứng sau khi bệnh nhân đã ký thì không vào được buồng chụp", async () => {
    const v = await newVisit({ withContrast: true });
    await signConsent(v);
    const screen = await call(submitScreeningChecklist, { user: userOf(tech), body: { visitId: String(v._id), contrastAllergy: "yes" } });
    expect(screen.payload.data.isBlocked).toBe(true);
    expect(Boolean(await contrastRiskBlockMessage(v))).toBe(true);
    const res = await check(tech, v, SAFE);
    expect(res.contrastBlocked).toBe(true);
    expect(await statusOf(v)).toBe("chờ chụp");
    const start = await call(updateStatus, { params: { id: String(v._id) }, user: userOf(tech), body: { status: "đang chụp" } });
    expect(start.statusCode).toBe(409);
  });

  test("#2 đối chứng: bác sĩ xác nhận có lý do thì mở chặn, đổi câu trả lời thì phải xác nhận lại", async () => {
    const v = await newVisit({ withContrast: true });
    const c = await signConsent(v);
    await call(submitScreeningChecklist, { user: userOf(tech), body: { visitId: String(v._id), contrastAllergy: "yes" } });
    const ok = await call(overrideChecklistRisk, { params: { id: String(c._id) }, user: userOf(doctor), body: { overrideReason: "Đã dùng thuốc dự phòng dị ứng" } });
    expect(ok.statusCode).toBe(200);
    expect(await contrastRiskBlockMessage(v)).toBeNull();
    await call(submitScreeningChecklist, { user: userOf(tech), body: { visitId: String(v._id), contrastAllergy: "yes", severeAsthma: true } });
    expect(Boolean(await contrastRiskBlockMessage(v))).toBe(true);
  });

  test("#4: đổi chỉ định sau khi bảng kiểm đạt thì phải làm lại bảng kiểm", async () => {
    const v = await newVisit({}, "đang khám");
    await Visit.updateOne({ _id: v._id, hospitalId }, { $set: { status: "chờ chụp" } });
    await check(tech, v, SAFE);
    await Visit.updateOne({ _id: v._id, hospitalId }, { $set: { status: "chờ chụp" } });
    const order = await call(createMriOrder, { params: { id: String(v._id) }, user: userOf(doctor), body: { region: "Não", withContrast: true, creatinineEgfr: 20 } });
    expect(order.statusCode).toBe(200);
    const after = await Visit.findOne({ _id: v._id, hospitalId }).lean();
    expect(after.mriSafetyChecklist.passed).toBe(false);
    expect(after.mriSafetyChecklist.isScreened).toBe(false);
  });

  test("#12: không ra lại chỉ định MRI cho lượt đã hoàn tất; lượt đang khám vẫn ra được", async () => {
    const done = await newVisit({}, "hoàn tất");
    const blocked = await call(createMriOrder, { params: { id: String(done._id) }, user: userOf(doctor), body: { region: "Não" } });
    expect(blocked.statusCode).toBe(400);
    expect(await statusOf(done)).toBe("hoàn tất");
    const open = await newVisit({}, "đang khám");
    const ok = await call(createMriOrder, { params: { id: String(open._id) }, user: userOf(doctor), body: { region: "Não" } });
    expect(ok.statusCode).toBe(200);
    expect(await statusOf(open)).toBe("chờ chụp");
    const badEgfr = await call(createMriOrder, { params: { id: String(open._id) }, user: userOf(doctor), body: { region: "Não", withContrast: true, creatinineEgfr: "abc" } });
    expect(badEgfr.statusCode).toBe(400);
  });

  test("#5 (phần kiểu dữ liệu): lý do xác nhận dạng object bị từ chối", async () => {
    const v = await newVisit();
    const err = await rejectMessage(check(doctor, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: { a: 1 } }));
    expect(err.status).toBe(400);
  });

  test("#6: bác sĩ tự làm bảng kiểm ca mang thai có cản quang phải ghi lý do", async () => {
    const v = await newVisit({ withContrast: true });
    await signConsent(v);
    const noReason = await check(doctor, v, { ...SAFE, isPregnant: true });
    expect(noReason.requiresDoctorReview).toBe(true);
    expect(noReason.reviewReasonRequired).toBe(true);
    expect(await statusOf(v)).toBe("chờ chụp");
    const withReason = await check(doctor, v, { ...SAFE, isPregnant: true, overrideReason: "Lợi ích chẩn đoán u vượt nguy cơ thai kỳ" });
    expect(withReason.checklist.passed).toBe(true);
    expect(withReason.checklist.overrideReason).toContain("Lợi ích chẩn đoán");
    expect(await statusOf(v)).toBe("đang chụp");
  });

  test("#7: chống chỉ định đã ghi nhận không xóa được bằng cách gửi lại 'không'; bác sĩ vẫn xác nhận được", async () => {
    const v = await newVisit();
    expect((await rejectMessage(check(tech, v, { ...SAFE, hasPacemakerOrMetal: true }))).status).toBe(400);
    const again = await rejectMessage(check(tech, v, SAFE));
    expect(again.status).toBe(409);
    expect(await statusOf(v)).toBe("chờ chụp");
    const doc = await mrDoc(v);
    const override = await check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: "Thiết bị MR-conditional đã xác minh", mrConditionalDocFileId: doc.fileId });
    expect(override.checklist.passed).toBe(true);
  });

  test("#5: chỉ Bác sĩ CĐHA ghi đè kim loại, bắt buộc giấy MR-conditional của đúng ca, báo Trưởng khoa", async () => {
    const reason = "Nẹp vít titan, nhà sản xuất xác nhận an toàn 1.5T";
    for (const actor of [doctor, head]) {
      const v = await newVisit();
      const doc = await mrDoc(v);
      const err = await rejectMessage(check(actor, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: reason, mrConditionalDocFileId: doc.fileId }));
      expect(err.status).toBe(400);
      expect(err.message).toContain("CHỐNG CHỈ ĐỊNH");
    }
    const v = await newVisit();
    expect((await rejectMessage(check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: reason }))).message).toContain("giấy xác nhận");
    const otherVisitDoc = await mrDoc(await newVisit());
    expect((await rejectMessage(check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: reason, mrConditionalDocFileId: otherVisitDoc.fileId }))).status).toBe(400);
    const otherHospitalDoc = await mrDoc(v, oid());
    expect((await rejectMessage(check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: reason, mrConditionalDocFileId: otherHospitalDoc.fileId }))).status).toBe(400);
    expect(await statusOf(v)).toBe("chờ chụp");

    const before = await Notification.countDocuments({ recipientId: head._id });
    const doc = await mrDoc(v);
    const ok = await check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, overrideReason: reason, mrConditionalDocFileId: doc.fileId });
    expect(ok.checklist.passed).toBe(true);
    expect(ok.checklist.mrConditionalDocFileId).toBe(doc.fileId);
    expect(await statusOf(v)).toBe("đang chụp");
    expect((await Notification.countDocuments({ recipientId: head._id })) - before).toBe(1);
    const logs = await AuditLog.find({ action: "MRI_SAFETY_CHECKLIST_SUBMITTED", entityId: String(v._id) }).lean();
    expect(logs.some((l) => String(l.details).includes(doc.fileId))).toBe(true);
  });

  test("#5: máy tạo nhịp bệnh nhân tự khai không có ngoại lệ, kể cả Bác sĩ CĐHA có giấy", async () => {
    const declaredAt = new Date();
    const v = await newVisit();
    await Visit.updateOne({ _id: v._id, hospitalId }, { $set: { patientMriScreening: { answers: { pacemaker: "yes" }, level: "danger", declaredAt } } });
    const doc = await mrDoc(v);
    const err = await rejectMessage(check(radiologist, v, { ...SAFE, hasPacemakerOrMetal: true, screeningDeclaredAt: declaredAt.toISOString(), overrideReason: "Bác sĩ CĐHA muốn chụp", mrConditionalDocFileId: doc.fileId }));
    expect(err.status).toBe(400);
    expect(await statusOf(v)).toBe("chờ chụp");
  });

  test("#5: tải giấy MR-conditional chỉ cho Bác sĩ CĐHA, ca đang chờ chụp, có tệp", async () => {
    for (const role of ["doctor", "department_head", "technician", "nurse", "hospital_admin", "admin"]) expect(routeAllows(visitRoutes, "post", "/:id/mri-conditional-doc", role)).toBe(false);
    expect(routeAllows(visitRoutes, "post", "/:id/mri-conditional-doc", "radiologist")).toBe(true);
    const v = await newVisit();
    const file = { buffer: Buffer.from("%PDF-1.4 test"), mimetype: "application/pdf", originalname: "giay.pdf" };
    const ok = await call(uploadMriConditionalDoc, { params: { id: String(v._id) }, user: userOf(radiologist), file });
    expect(ok.statusCode).toBe(201);
    expect(typeof ok.payload.data.fileId).toBe("string");
    expect((await call(uploadMriConditionalDoc, { params: { id: String(v._id) }, user: userOf(radiologist) })).statusCode).toBe(400);
    expect((await call(uploadMriConditionalDoc, { params: { id: "abc" }, user: userOf(radiologist), file })).statusCode).toBe(400);
    const done = await newVisit({}, "hoàn tất");
    expect((await call(uploadMriConditionalDoc, { params: { id: String(done._id) }, user: userOf(radiologist), file })).statusCode).toBe(409);
  });

  test("Hàng đợi Bác sĩ CĐHA có ca chờ chụp cần xác nhận an toàn, không có ca chờ chụp thường", async () => {
    const flagged = await newVisit();
    await rejectMessage(check(tech, flagged, { ...SAFE, hasPacemakerOrMetal: true }));
    const plain = await newVisit();
    const res = await call(getMyQueue, { user: userOf(radiologist), query: {} });
    const list = res.payload?.data || res.payload?.visits || res.payload || [];
    const ids = (Array.isArray(list) ? list : []).map((x) => String(x._id));
    expect(ids.includes(String(flagged._id))).toBe(true);
    expect(ids.includes(String(plain._id))).toBe(false);
    // ?today=true không được nới giới hạn của Bác sĩ CĐHA
    const today = await call(getMyQueue, { user: userOf(radiologist), query: { today: "true" } });
    const todayIds = (today.payload?.visits || []).map((x) => String(x._id));
    expect(todayIds.includes(String(plain._id))).toBe(false);
  });

  test("#8: phiếu cản quang luôn thuộc bệnh nhân của lượt khám", async () => {
    const other = await User.create({ email: `mri_other_${oid()}@neuroscan.vn`, passwordHash: "x", role: "patient", hospitalId, profile: { name: "Khac" } });
    const v = await newVisit({ withContrast: true });
    await call(submitScreeningChecklist, { user: userOf(tech), body: { visitId: String(v._id), patientId: String(other._id), contrastAllergy: "no" } });
    const c = await ConsentForm.findOne({ visitId: v._id, hospitalId }).lean();
    expect(String(c.patientId)).toBe(String(patient._id));
  });

  test("#9: chỉ bác sĩ override nguy cơ cản quang, lý do không được rỗng", async () => {
    for (const role of ["hospital_admin", "admin", "system_admin", "technician", "nurse"]) expect(routeAllows(contrastRoutes, "post", "/:id/override", role)).toBe(false);
    for (const role of ["doctor", "radiologist", "department_head"]) expect(routeAllows(contrastRoutes, "post", "/:id/override", role)).toBe(true);
    const v = await newVisit({ withContrast: true });
    const c = await ensureContrastConsentForVisit(v);
    const admin = await call(overrideChecklistRisk, { params: { id: String(c._id) }, user: { id: String(oid()), role: "hospital_admin", hospitalId: String(hospitalId) }, body: { overrideReason: "Đồng ý" } });
    expect(admin.statusCode).toBe(403);
    for (const overrideReason of ["   ", { a: 1 }, ""]) {
      const r = await call(overrideChecklistRisk, { params: { id: String(c._id) }, user: userOf(doctor), body: { overrideReason } });
      expect(r.statusCode).toBe(400);
    }
  });

  test("#10: chỉ KTV và bác sĩ làm bảng kiểm an toàn MRI", () => {
    for (const role of ["nurse", "hospital_admin", "admin", "system_admin", "receptionist", "patient"]) expect(routeAllows(visitRoutes, "post", "/:id/mri-safety-check", role)).toBe(false);
    for (const role of ["technician", "doctor", "radiologist", "department_head"]) expect(routeAllows(visitRoutes, "post", "/:id/mri-safety-check", role)).toBe(true);
  });

  test("#11: ghi nhật ký bảng kiểm, sàng lọc, override và báo bác sĩ chỉ định khi cần xác nhận", async () => {
    const v = await newVisit({ withContrast: true });
    const c = await signConsent(v);
    const before = await Notification.countDocuments({ recipientId: doctor._id });
    await check(tech, v, { ...SAFE, isPregnant: true });
    await call(submitScreeningChecklist, { user: userOf(tech), body: { visitId: String(v._id), contrastAllergy: "yes" } });
    await call(overrideChecklistRisk, { params: { id: String(c._id) }, user: userOf(doctor), body: { overrideReason: "Đã dùng thuốc dự phòng dị ứng" } });
    expect(await AuditLog.countDocuments({ action: "MRI_SAFETY_CHECKLIST_SUBMITTED", entityId: String(v._id) })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "CONTRAST_SCREENING_SUBMITTED", entityId: String(c._id) })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "CONTRAST_RISK_OVERRIDDEN", entityId: String(c._id) })).toBe(1);
    expect((await Notification.countDocuments({ recipientId: doctor._id })) - before).toBe(2);
  });

  test("S-1: hai người gửi bảng kiểm cùng lúc không làm trạng thái lệch với bảng kiểm", async () => {
    let inconsistent = 0, conflicts = 0;
    for (let i = 0; i < 20; i += 1) {
      const v = await newVisit();
      const rs = await Promise.allSettled([check(tech, v, { ...SAFE, hasPacemakerOrMetal: true }), check(tech, v, SAFE)]);
      conflicts += rs.filter((r) => r.status === "rejected" && r.reason?.statusCode === 409).length;
      const a = await Visit.findOne({ _id: v._id, hospitalId }).lean();
      if (a.status === "đang chụp" && (a.mriSafetyChecklist?.hasPacemakerOrMetal || !a.mriSafetyChecklist?.passed)) inconsistent += 1;
    }
    expect(inconsistent).toBe(0);
    expect(conflicts >= 0).toBe(true);
  });

  test("#15: mã lượt khám sai trả 400, lỗi máy chủ không lộ thông báo nội bộ", async () => {
    const bad = await call(submitMriSafetyCheck, { params: { id: "abc" }, user: userOf(tech), body: SAFE });
    expect(bad.statusCode).toBe(400);
    const v = await newVisit();
    const crash = await call(submitMriSafetyCheck, { params: { id: String(v._id) }, user: { id: String(oid()), role: "technician", hospitalId: null }, body: SAFE });
    expect(crash.statusCode).toBe(500);
    expect(crash.payload.message).toBe("Lỗi máy chủ");
    expect(crash.payload.error === undefined).toBe(true);
  });
});
