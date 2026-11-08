// Hồi quy cho các lỗi còn tồn ngoài module MRI (báo cáo QA: QA-03 → QA-26). Mỗi test ghi số lỗi tương ứng.
import http from "http";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Prescription } from "../models/prescription.model.js";
import { Drug } from "../modules/pharmacy/models/drug.model.js";
import { LabOrder } from "../modules/laboratory/models/labOrder.model.js";
import { Biomarker } from "../modules/laboratory/models/biomarker.model.js";
import { BhytInfo } from "../modules/billing/models/bhytInfo.model.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { requireJwtBeforeLargeBody } from "../middlewares/largeBodyGuard.middleware.js";
import { sanitizeServerErrors } from "../middlewares/sanitizeServerErrors.middleware.js";
import { aiFetch } from "../utils/aiClient.util.js";
import { UPLOADS_DIR } from "../utils/imageSource.util.js";
import { getInvoices, createAndPayInvoice, requestInvoiceRefund } from "../modules/billing/invoice.controller.js";
import { calculateCopay } from "../modules/billing/bhyt.controller.js";
import { applyBhytCore } from "../modules/billing/bhytApply.service.js";
import { dispensePrescription, updateStock } from "../modules/pharmacy/drug.controller.js";
import { receiveLisResults, verifyLisResults } from "../modules/laboratory/lis.controller.js";
import { addPatientPrescription, addPatientDischargePaper, addPatientTransferForm } from "../controllers/patient.controller.js";
import { exportRevenueCSV } from "../modules/hospital/admin.controller.js";
import { forgotPassword } from "../modules/auth/auth.controller.js";
import { grantCrossHospitalView, revokeCrossHospitalView } from "../controllers/transfer.controller.js";
import { executeAiPredictionInternal } from "../modules/imaging/imaging.controller.js";
import { putFile, resolveStoredLocalPath } from "../services/storage/storageService.js";
import b2cRoutes from "../modules/patient-portal/patientB2c.routes.js";
import imagingRoutes from "../modules/imaging/imaging.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { VitalSign } from "../modules/emr/models/vitalSign.model.js";
import { Task } from "../models/task.model.js";
import { getRecordById, createCareSheet } from "../modules/emr/emr.controller.js";
import { createDrug, checkPrescription, rejectPrescription } from "../modules/pharmacy/drug.controller.js";
import { createTicket } from "../controllers/support.controller.js";
import { registerSchedule } from "../controllers/schedule.controller.js";
import { cancelStandDown } from "../controllers/emergency.controller.js";
import { getKanbanBoard } from "../controllers/task.controller.js";
import { requestMriRescanService, cancelMriOrderService } from "../services/visit.service.js";
import { EventEmitter } from "events";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import { installProcessGuards, postOpsAlert } from "../utils/processGuards.js";
import { sanitizeNoSql } from "../middlewares/noSqlSanitize.middleware.js";
import { inputErrorStatus } from "../utils/inputError.util.js";
import { Notification } from "../models/notification.model.js";
import { createNotificationInternal, getNotifications } from "../controllers/notification.controller.js";

const oid = () => new mongoose.Types.ObjectId();
const makeRes = () => ({
  statusCode: 200,
  payload: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.payload = body; return this; },
  send(body) { this.payload = body; return this; },
  setHeader(k, v) { this.headers[k] = v; },
});
const call = async (handler, req) => {
  const res = makeRes();
  await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
  return res;
};
const routeAllows = (router, method, routePath, role) => {
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
  if (!layer) return null;
  let blocked = false;
  const res = { status() { blocked = true; return this; }, json() { return this; } };
  for (const s of layer.route.stack) {
    if (!/allowedRoles/.test(s.handle.toString())) continue;
    s.handle({ user: { role } }, res, () => {});
    if (blocked) return false;
  }
  return true;
};

describe("Lỗi còn tồn v3.4: hồi quy sau sửa", () => {
  let hospitalId, doctor, pharm, rec, lab, patient;
  const userOf = (u) => ({ id: String(u._id), _id: u._id, role: u.role, hospitalId: String(hospitalId), profile: u.profile, email: u.email });
  const mk = (role) => User.create({ email: `rb_${role}_${oid()}@neuroscan.vn`, passwordHash: "x", role, hospitalId, profile: { name: role, fullName: role } });
  const newDrug = (qty) => Drug.create({ hospitalId, name: `Thuoc${String(oid()).slice(-8)}`, category: "other", unit: "ống", price: 1000, stock: { quantity: qty }, batches: [{ batchNumber: "L1", quantity: qty, expiryDate: new Date(Date.now() + 864e5 * 300) }] });
  const stockOf = async (d) => (await Drug.findOne({ _id: d._id, hospitalId }).lean()).stock.quantity;
  const newInvoice = (extra = {}, p = patient) => Invoice.create({ hospitalId, patientId: p._id, totalAmount: 1000000, patientPayAmount: 1000000, status: "chờ thanh toán", items: [{ description: "Dịch vụ", amount: 1000000, quantity: 1 }], ...extra });
  const newLab = () => LabOrder.create({ hospitalId, patient_id: patient._id, doctor_id: doctor._id, barcode: `B-${oid()}`, category: "HOA_SINH", patient_gender: "Nam", status: "PENDING" });
  const receive = (order, results) => call(receiveLisResults, { body: { barcode: order.barcode, results }, user: userOf(lab) });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.TEST_MONGO_URI);
    hospitalId = (await Hospital.create({ name: "BV Lỗi còn tồn", code: `RB-${oid()}` }))._id;
    doctor = await mk("doctor");
    pharm = await mk("pharmacist");
    rec = await mk("receptionist");
    lab = await mk("lab_technician");
    patient = await mk("patient");
  });

  test("QA-03: danh sách hóa đơn có phân trang tùy chọn, mặc định giữ nguyên", async () => {
    await newInvoice();
    await newInvoice();
    const page = await call(getInvoices, { user: userOf(rec), query: { limit: "1" } });
    expect(page.payload.invoices.length).toBe(1);
    expect(page.payload.limit).toBe(1);
    expect(page.payload.total >= 2).toBe(true);
    const all = await call(getInvoices, { user: userOf(rec) });
    expect(all.payload.invoices.length >= 2).toBe(true);
    expect(all.payload.limit === undefined).toBe(true);
  });

  test("QA-04: gọi AI bị treo thì hết hạn, không giữ worker", async () => {
    const sockets = new Set();
    const server = http.createServer(() => {});
    server.on("connection", (s) => sockets.add(s));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const started = Date.now();
    let failed = false;
    try { await aiFetch(`http://127.0.0.1:${server.address().port}/predict`, { method: "POST", body: "x", timeoutMs: 300 }); } catch { failed = true; }
    for (const s of sockets) s.destroy();
    await new Promise((r) => server.close(r));
    expect(failed).toBe(true);
    expect(Date.now() - started < 3000).toBe(true);
  });

  test("QA-05: cổng bệnh nhân và giải thích AI không mở cho vai trò ngoài nhóm đọc kết quả", () => {
    for (const role of ["cleaner", "receptionist", "pharmacist", "lab_technician"]) {
      expect(routeAllows(b2cRoutes, "get", "/imaging/:imagingResultId", role)).toBe(false);
      expect(routeAllows(b2cRoutes, "get", "/imaging/:imagingResultId/report-pdf", role)).toBe(false);
      expect(routeAllows(imagingRoutes, "post", "/:id/explain-ai", role)).toBe(false);
    }
    for (const role of ["patient", "doctor", "radiologist", "nurse"]) expect(routeAllows(b2cRoutes, "get", "/imaging/:imagingResultId", role)).toBe(true);
    expect(routeAllows(b2cRoutes, "post", "/imaging/:imagingResultId/share-qr", "patient")).toBe(true);
    expect(routeAllows(b2cRoutes, "post", "/imaging/:imagingResultId/share-qr", "doctor")).toBe(false);
  });

  test("QA-06: phát thuốc cấp cứu bấm 5 lần cùng lúc chỉ trừ kho một lần", async () => {
    const d = await newDrug(100);
    const rx = await Prescription.create({ hospitalId, patient_id: patient._id, doctorId: doctor._id, diagnosis: "x", doctor_name: "BS", drugs: [{ name: d.name, quantity: 2, unit: "ống", usage: "tiêm", timesPerDay: 1, durationDays: 1 }], clinicalSafety: { overrideCategory: "ACUTE_EMERGENCY" } });
    const rs = await Promise.all(Array.from({ length: 5 }, () => call(dispensePrescription, { params: { id: String(rx._id) }, user: userOf(pharm) })));
    expect(rs.filter((r) => r.statusCode === 200).length).toBe(1);
    expect(await stockOf(d)).toBe(98);
  });

  test("QA-07: hóa đơn thuốc cũ không mở khóa đơn mới; hóa đơn đúng lượt khám thì được", async () => {
    const d = await newDrug(10);
    await newInvoice({ status: "đã thanh toán", items: [{ type: "drug", description: "Thuốc cũ", amount: 1000, quantity: 1 }] });
    const orphan = await Prescription.create({ hospitalId, patient_id: patient._id, doctorId: doctor._id, diagnosis: "x", doctor_name: "BS", drugs: [{ name: d.name, quantity: 1, unit: "ống", usage: "uống", timesPerDay: 1, durationDays: 1 }] });
    expect((await call(dispensePrescription, { params: { id: String(orphan._id) }, user: userOf(pharm) })).statusCode).toBe(400);
    const visit = await Visit.create({ hospitalId, patientId: patient._id, patientName: "BN", doctorId: doctor._id, status: "đang khám", reason: "k" });
    await newInvoice({ status: "đã thanh toán", visitId: visit._id, items: [{ type: "drug", description: d.name, amount: 1000, quantity: 1 }] });
    const linked = await Prescription.create({ hospitalId, patient_id: patient._id, visitId: visit._id, doctorId: doctor._id, diagnosis: "x", doctor_name: "BS", drugs: [{ name: d.name, quantity: 1, unit: "ống", usage: "uống", timesPerDay: 1, durationDays: 1 }] });
    expect((await call(dispensePrescription, { params: { id: String(linked._id) }, user: userOf(pharm) })).statusCode).toBe(200);
  });

  test("QA-08, QA-20: kết quả xét nghiệm phải là số", async () => {
    for (const value of ["", "abc", { a: 1 }, [1]]) {
      const o = await newLab();
      const r = await receive(o, [{ code: "GLU", value }]);
      expect(r.statusCode).toBe(400);
      expect((await LabOrder.findOne({ _id: o._id, hospitalId }).lean()).status).toBe("PENDING");
    }
    const o = await newLab();
    expect((await receive(o, [{ code: "GLU", value: "5.5" }])).statusCode).toBe(200);
    expect((await LabOrder.findOne({ _id: o._id, hospitalId }).lean()).results[0].value_result).toBe(5.5);
  });

  test("QA-09: kết quả gửi lại không xóa dấu vết giá trị nguy kịch chưa duyệt", async () => {
    const code = `RB${String(oid()).slice(-6).toUpperCase()}`;
    await Biomarker.collection.insertOne({ code, name: "RB", category: "HOA_SINH", unit: "x", critical_low: 2, critical_high: 20, reference_range: { male: { min: 3, max: 10 }, female: { min: 3, max: 10 } } });
    const o = await newLab();
    await receive(o, [{ code, value: 99 }]);
    await receive(o, [{ code, value: 5 }]);
    const after = await LabOrder.findOne({ _id: o._id, hospitalId }).lean();
    expect(after.results[0].value_result).toBe(5);
    expect(after.hasCriticalValue).toBe(true);
    expect(after.resultHistory.length).toBe(1);
    expect(after.criticalValues.some((v) => v.startsWith("Lần gửi trước: "))).toBe(true);
  });

  test("QA-30: cảnh báo xét nghiệm nguy kịch thật sự tới bác sĩ; loại thông báo lạ không bị mất", async () => {
    const code = `RC${String(oid()).slice(-6).toUpperCase()}`;
    await Biomarker.collection.insertOne({ code, name: "RC", category: "HOA_SINH", unit: "x", critical_low: 2, critical_high: 20, reference_range: { male: { min: 3, max: 10 }, female: { min: 3, max: 10 } } });
    const o = await newLab();
    await receive(o, [{ code, value: 99 }]);
    const notes = await Notification.find({ hospitalId, recipientId: doctor._id, relatedId: o._id }).lean();
    expect(notes.length).toBe(1);
    expect(notes[0].type).toBe("critical_lab_value");
    expect(Boolean((await LabOrder.findOne({ _id: o._id, hospitalId }).lean()).criticalNotifiedAt)).toBe(true);
    for (const type of ["prescription_rejected", "deadline_warning", "mri_scheduled", "slot_rescheduled", "emergency_slot_override", "dicom_uploaded"]) {
      const n = await createNotificationInternal({ hospitalId, recipientId: doctor._id, type, title: "t", message: "m" });
      expect(n && n.type).toBe(type);
    }
    const unknown = await createNotificationInternal({ hospitalId, recipientId: doctor._id, type: "loai_chua_khai_bao", title: "t", message: "m" });
    expect(unknown && unknown.type).toBe("other");
  });

  test("QA-24: nhiều người duyệt cùng một phiếu chỉ ghi nhận một lần", async () => {
    const o = await newLab();
    await receive(o, [{ code: "GLU", value: 5 }]);
    await Promise.all(Array.from({ length: 5 }, () => call(verifyLisResults, { params: { id: String(o._id) }, user: userOf(doctor) })));
    expect(await AuditLog.countDocuments({ action: "LIS_RESULT_VERIFIED", entityId: String(o._id) })).toBe(1);
  });

  test("QA-10: chưa đăng nhập bị chặn trước khi đọc body lớn", () => {
    let passed = false;
    const res = makeRes();
    requireJwtBeforeLargeBody({ method: "POST", headers: {} }, res, () => { passed = true; });
    expect(passed).toBe(false);
    expect(res.statusCode).toBe(401);
    const token = jwt.sign({ id: String(oid()), role: "technician" }, getJwtSecret(), { algorithm: "HS256" });
    requireJwtBeforeLargeBody({ method: "POST", headers: { authorization: `Bearer ${token}` } }, makeRes(), () => { passed = true; });
    expect(passed).toBe(true);
  });

  test("QA-11: lỗi sai định dạng trả 400, lỗi 5xx không lộ chi tiết nội bộ", () => {
    const run = (status, body) => { const res = makeRes(); sanitizeServerErrors({}, res, () => {}); res.status(status).json(body); return res; };
    const cast = run(500, { message: "Lỗi máy chủ", error: 'Cast to ObjectId failed for value "abc" (type string) at path "_id"' });
    expect(cast.statusCode).toBe(400);
    expect(JSON.stringify(cast.payload).includes("Cast to")).toBe(false);
    const typeErr = run(500, { message: "Lỗi máy chủ: reason.trim is not a function" });
    expect(typeErr.statusCode).toBe(500);
    expect(typeErr.payload.message).toBe("Lỗi máy chủ. Vui lòng thử lại sau.");
    const withError = run(500, { message: "Không kết nối được AI", error: "fetch failed" });
    expect(withError.payload.error === undefined).toBe(true);
    expect(withError.payload.message).toBe("Không kết nối được AI");
    expect(run(200, { ok: true, error: "giữ nguyên" }).payload.error).toBe("giữ nguyên");
  });

  test("QA-12: tạo và thu tiền bắt buộc phương thức; bấm nhiều lần chỉ tạo một hóa đơn", async () => {
    const visit = await Visit.create({ hospitalId, patientId: patient._id, patientName: "BN", doctorId: doctor._id, status: "đang khám", reason: "k" });
    expect((await call(createAndPayInvoice, { params: { visitId: String(visit._id) }, user: userOf(rec), body: {} })).statusCode).toBe(400);
    await Promise.all(Array.from({ length: 5 }, () => call(createAndPayInvoice, { params: { visitId: String(visit._id) }, user: userOf(rec), body: { paymentMethod: "tiền mặt" } })));
    expect(await Invoice.countDocuments({ hospitalId, visitId: visit._id })).toBe(1);
  });

  test("QA-13: hai hóa đơn cùng lúc không vượt trần BHYT còn lại", async () => {
    const p = await mk("patient");
    const ins = await BhytInfo.collection.insertOne({ hospitalId, patientId: p._id, cardNumber: "enc", coverageRate: 80, isValid: true, isActive: true, manuallyVerified: true, expiresAt: new Date(Date.now() + 864e5 * 100), usedThisYear: 71500000, annualCap: 72000000, createdAt: new Date(), updatedAt: new Date() });
    const a = await newInvoice({}, p), b = await newInvoice({}, p);
    await Promise.all([a, b].map(async (inv) => applyBhytCore(inv, { bhyt: await BhytInfo.findById(ins.insertedId) })));
    const x = await Invoice.findOne({ _id: a._id, hospitalId }).lean(), y = await Invoice.findOne({ _id: b._id, hospitalId }).lean();
    expect((x.bhytInfo?.bhytAmount || 0) + (y.bhytInfo?.bhytAmount || 0) <= 500000).toBe(true);
    expect((await BhytInfo.collection.findOne({ _id: ins.insertedId })).usedThisYear <= 72000000).toBe(true);
  });

  test("QA-14: số tiền hoàn khác toàn bộ mà không chọn dòng thì bị từ chối", async () => {
    const inv = await newInvoice({ status: "đã thanh toán", paidAmount: 1000000 });
    const r = await call(requestInvoiceRefund, { params: { id: String(inv._id) }, user: userOf(rec), body: { requestedAmount: 100000, refundReason: "Hoàn một phần dịch vụ chưa thực hiện" } });
    expect(r.statusCode).toBe(400);
    expect((await Invoice.findOne({ _id: inv._id, hospitalId }).lean()).status).toBe("đã thanh toán");
  });

  test("QA-15, QA-16: đơn thuốc số lượng không dương, giấy tờ thiếu nội dung bị từ chối", async () => {
    const pid = String(patient._id);
    for (const quantity of [-3, 0, "abc"]) {
      expect((await call(addPatientPrescription, { params: { patientId: pid }, user: userOf(doctor), body: { diagnosis: "x", drugs: [{ name: "A", quantity }] } })).statusCode).toBe(400);
    }
    expect((await call(addPatientDischargePaper, { params: { patientId: pid }, user: userOf(doctor), body: {} })).statusCode).toBe(400);
    expect((await call(addPatientTransferForm, { params: { patientId: pid }, user: userOf(doctor), body: {} })).statusCode).toBe(400);
  });

  test("QA-17: xuất doanh thu vô hiệu hóa ô công thức", async () => {
    const p = await User.create({ email: `rb_csv_${oid()}@neuroscan.vn`, passwordHash: "x", role: "patient", hospitalId, profile: { name: "=HYPERLINK(1)", fullName: "=HYPERLINK(1)" } });
    await newInvoice({ status: "đã thanh toán", paidAt: new Date() }, p);
    const r = await call(exportRevenueCSV, { user: { id: String(oid()), role: "hospital_admin", hospitalId: String(hospitalId) } });
    expect(String(r.payload).includes(`"'=HYPERLINK(1)"`)).toBe(true);
    expect(/(^|,)=HYPERLINK/m.test(String(r.payload))).toBe(false);
  });

  test("QA-18: quên mật khẩu trả cùng phản hồi dù email có hay không", async () => {
    const known = await call(forgotPassword, { body: { email: patient.email } });
    const unknown = await call(forgotPassword, { body: { email: `khong_co_${oid()}@neuroscan.vn` } });
    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.payload.message).toBe(known.payload.message);
  });

  test("QA-19: không nhập lô đã hết hạn, số lượng phải là số nguyên", async () => {
    const d = await newDrug(10);
    const expired = await call(updateStock, { params: { id: String(d._id) }, user: userOf(pharm), body: { action: "import", quantity: 5, batchNumber: "L8", expiryDate: "2000-01-01" } });
    expect(expired.statusCode).toBe(400);
    const half = await call(updateStock, { params: { id: String(d._id) }, user: userOf(pharm), body: { action: "add", quantity: 0.5 } });
    expect(half.statusCode).toBe(400);
    expect(await stockOf(d)).toBe(10);
  });

  test("QA-23: tính thử BHYT kiểm tra số tiền và không ghi nhật ký yêu cầu thanh toán", async () => {
    const before = await AuditLog.countDocuments({ action: { $in: ["BHYT_CLAIM_SUBMITTED", "BHYT_CLAIM_REJECTED"] } });
    for (const totalAmount of ["abc", -1, { a: 1 }]) {
      expect((await call(calculateCopay, { user: userOf(rec), body: { patientId: String(patient._id), totalAmount } })).statusCode).toBe(400);
    }
    expect((await call(calculateCopay, { user: userOf(rec), body: { patientId: String(patient._id), totalAmount: 1000000 } })).statusCode).toBe(200);
    expect(await AuditLog.countDocuments({ action: { $in: ["BHYT_CLAIM_SUBMITTED", "BHYT_CLAIM_REJECTED"] } })).toBe(before);
  });

  test("QA-25: AI trả thiếu nhóm phân loại thì báo lỗi 502", async () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const name = `rb_${oid()}.png`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), Buffer.from("iVBORw0KGgo=", "base64"));
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => ({ confidence: 1 }) });
    let status = null;
    try { await executeAiPredictionInternal(`/uploads/${name}`, userOf(doctor), null); } catch (err) { status = err.statusCode; } finally { global.fetch = realFetch; fs.rmSync(path.join(UPLOADS_DIR, name), { force: true }); }
    expect(status).toBe(502);
  });

  test("QA-26: route xem chéo cũ báo đã ngừng (410)", async () => {
    expect((await call(grantCrossHospitalView, { params: { id: String(oid()) }, user: userOf(doctor) })).statusCode).toBe(410);
    expect((await call(revokeCrossHospitalView, { params: { id: String(oid()) }, user: userOf(doctor) })).statusCode).toBe(410);
  });

  test("Đường dẫn tệp tuyệt đối của máy khác vẫn đọc được theo logicalPath", async () => {
    const saved = await putFile({ category: "report", studyId: "RB_PATH", fileName: "a.pdf", buffer: Buffer.from(`%PDF-1.4 ${oid()}`), mimeType: "application/pdf", hospitalId, syncToDrive: false });
    const resolved = resolveStoredLocalPath({ localPath: "C:\\khong-ton-tai\\a.pdf", logicalPath: saved.logicalPath });
    expect(fs.existsSync(resolved)).toBe(true);
  });
});

describe("Lỗi còn tồn v3.4 (đợt 2): dữ liệu sai kiểu không còn thành 500, đồng bộ sinh hiệu, phạm vi kanban", () => {
  let hospitalId, doctor, nurse, pharm, patient;
  const userOf = (u) => ({ id: String(u._id), _id: u._id, role: u.role, hospitalId: String(hospitalId), profile: u.profile, email: u.email });
  const mk = (role) => User.create({ email: `rb2_${role}_${oid()}@neuroscan.vn`, passwordHash: "x", role, hospitalId, profile: { name: role, fullName: role } });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.TEST_MONGO_URI);
    hospitalId = (await Hospital.create({ name: "BV Lỗi còn tồn 2", code: `RB2-${oid()}` }))._id;
    doctor = await mk("doctor");
    nurse = await mk("nurse");
    pharm = await mk("pharmacist");
    patient = await mk("patient");
  });

  test("QA-11: lỗi CastError/ValidationError trong catch → 400 với thông báo chung, lỗi khác vẫn 500", async () => {
    const res = await call(getRecordById, { params: { id: "abc" }, user: userOf(doctor) });
    expect(res.statusCode).toBe(400);
    const locals = { locals: {} };
    expect(inputErrorStatus(locals, new mongoose.Error.CastError("ObjectId", "abc", "_id"))).toBe(400);
    expect(locals.locals.inputError).toBe(true);
    expect(inputErrorStatus({ locals: {} }, new TypeError("x is not a function"))).toBe(500);

    let sent = null;
    const r = { statusCode: 400, locals: { inputError: true }, status(c) { this.statusCode = c; return this; }, json(b) { sent = b; return this; } };
    sanitizeServerErrors({}, r, () => {});
    r.json({ message: "Lỗi hệ thống khi lấy chi tiết bệnh án.", error: "Cast to ObjectId failed for value \"abc\"" });
    expect(sent).toEqual({ success: false, message: "Dữ liệu gửi lên không hợp lệ (sai định dạng mã hoặc kiểu dữ liệu)." });
  });

  test("QA-11: tham số truy vấn chỉ có toán tử ($ne, $gt) bị bỏ, tham số hợp lệ giữ nguyên", () => {
    const req = { query: { status: { $ne: "x" }, patientId: { $gt: "" }, page: "2" }, body: {}, params: {} };
    sanitizeNoSql(req, {}, () => {});
    expect(req.query).toEqual({ page: "2" });
  });

  test("QA-11: auth chặn trường định danh không phải chuỗi trước controller", () => {
    const guard = authRoutes.stack.find((l) => !l.route).handle;
    const run = (body) => { let code = null, passed = false; guard({ body }, { status(c) { code = c; return this; }, json() { return this; } }, () => { passed = true; }); return { code, passed }; };
    expect(run({ email: {}, password: "x" }).code).toBe(400);
    expect(run({ email: "a@b.vn", password: 123 }).code).toBe(400);
    expect(run({ phone: ["0900"] }).code).toBe(400);
    expect(run({ email: "a@b.vn", password: "abc" }).passed).toBe(true);
  });

  test("QA-11: dược, hỗ trợ, lịch, cấp cứu, kanban từ chối dữ liệu sai kiểu bằng 400", async () => {
    const id = String(oid());
    for (const medications of [{ a: 1 }, 5, [{ a: 1 }]]) {
      expect((await call(checkPrescription, { user: userOf(pharm), body: { patientId: String(patient._id), medications } })).statusCode).toBe(400);
    }
    expect((await call(rejectPrescription, { params: { id }, user: userOf(pharm), body: { reason: 12345678901 } })).statusCode).toBe(400);
    expect((await call(createDrug, { user: userOf(pharm), body: { name: true, price: 1 } })).statusCode).toBe(400);
    expect((await call(createTicket, { user: userOf(doctor), body: { topic: { a: 1 }, message: "abc" } })).statusCode).toBe(400);
    expect((await call(registerSchedule, { user: userOf(doctor), body: { date: "x", shift: "morning" } })).statusCode).toBe(400);
    expect((await call(cancelStandDown, { params: { id }, user: userOf(doctor), body: { cancelReason: 1 } })).statusCode).toBe(400);
    expect((await call(getKanbanBoard, { user: userOf(doctor), query: { date: "x" } })).statusCode).toBe(400);
  });

  test("QA-28: lưu phiếu chăm sóc đồng bộ sinh hiệu sang VitalSign của bệnh nhân", async () => {
    const record = await MedicalRecord.create({ hospitalId, patientId: String(patient._id), userId: patient._id, patientName: "BN đồng bộ", age: 40, birthYear: 1986, gender: "Nam", doctorInCharge: "BS", diagnosis: "Theo dõi", status: "Đang điều trị" });
    const before = await VitalSign.countDocuments({ patient_id: patient._id, hospitalId });
    const res = await call(createCareSheet, { params: { id: String(record._id) }, user: userOf(nurse), body: { pulse: 82, bloodPressure: "121/79", temperature: 37, respiratoryRate: 18, spo2: 98, progressNotes: "Ổn định", careActions: "Theo dõi sinh hiệu", nurse: "ĐD Test" } });
    expect(res.statusCode).toBe(201);
    const vitals = await VitalSign.find({ patient_id: patient._id, hospitalId }).sort({ recorded_at: -1 }).lean();
    expect(vitals.length).toBe(before + 1);
    expect([vitals[0].pulse, vitals[0].spo2, vitals[0].blood_pressure.systolic, vitals[0].blood_pressure.diastolic]).toEqual([82, 98, 121, 79]);
  });

  test("QA-11: tài khoản không gắn viện thao tác ca MRI bị từ chối 403, không còn lỗi 500", async () => {
    for (const fn of [requestMriRescanService, cancelMriOrderService]) {
      const v = await Visit.create({ hospitalId, patientId: patient._id, status: "chờ chụp" });
      let status = null;
      try { await fn({ visitId: v._id, hospitalId: null, user: { id: String(oid()), role: "admin" }, reason: "Bệnh nhân cử động" }); } catch (err) { status = err.statusCode; }
      expect(status).toBe(403);
      expect((await Visit.findById(v._id).lean()).status).toBe("chờ chụp");
    }
  });

  test("QA-30: loại thông báo chưa khai báo vẫn tới người nhận dưới loại \"other\", có cảnh báo trong log", async () => {
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...a) => { warns.push(a.join(" ")); };
    let saved;
    try {
      saved = await createNotificationInternal({ hospitalId, recipientId: doctor._id, type: "loai_moi_chua_co", title: "Tiêu đề QA30", message: "Nội dung QA30" });
    } finally { console.warn = origWarn; }
    expect(saved && saved.type).toBe("other");
    expect(warns.some((w) => w.includes("loai_moi_chua_co"))).toBe(true);
    const inDb = await Notification.findById(saved._id).lean();
    expect([inDb.type, inDb.title, inDb.message, String(inDb.recipientId)]).toEqual(["other", "Tiêu đề QA30", "Nội dung QA30", String(doctor._id)]);
    const list = await call(getNotifications, { user: userOf(doctor), query: {} });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.payload).includes("Tiêu đề QA30")).toBe(true);
    // Loại hợp lệ giữ nguyên, không bị ép về "other"
    const known = await createNotificationInternal({ hospitalId, recipientId: doctor._id, type: "critical_lab_value", title: "t", message: "m" });
    expect(known.type).toBe("critical_lab_value");
  });

  test("QA-29: ?role= không nâng phạm vi kanban cho người không thuộc nhóm quản lý", async () => {
    const visitId = oid();
    await Task.create([
      { hospitalId, visitId, stepNumber: 1, title: "Việc của điều dưỡng", roleRequired: "nurse" },
      { hospitalId, visitId, stepNumber: 2, title: "Việc của bác sĩ", roleRequired: "doctor" },
    ]);
    const titles = (res) => Object.values(res.payload.data).flat().map((t) => t.title);
    const asDoctor = await call(getKanbanBoard, { user: userOf(doctor), query: { role: "hospital_admin" } });
    expect(asDoctor.statusCode).toBe(200);
    expect(titles(asDoctor)).toContain("Việc của bác sĩ");
    expect(titles(asDoctor).includes("Việc của điều dưỡng")).toBe(false);
    const admin = await mk("hospital_admin");
    const asAdmin = await call(getKanbanBoard, { user: userOf(admin), query: { role: "nurse" } });
    expect(titles(asAdmin)).toEqual(["Việc của điều dưỡng"]);
  });
});

describe("QA-21: lỗi cấp tiến trình không làm sập server", () => {
  const fake = () => {
    const proc = new EventEmitter();
    const calls = { exit: [], alert: 0, log: 0, closed: 0, db: 0 };
    const server = { close: (cb) => { calls.closed += 1; cb(); } };
    const handlers = installProcessGuards({
      proc, exit: (c) => calls.exit.push(c), getServer: () => server, closeDb: async () => { calls.db += 1; },
      alert: async () => { calls.alert += 1; return true; }, log: () => { calls.log += 1; }, timeoutMs: 200,
    });
    return { proc, calls, handlers, server };
  };

  test("unhandledRejection: ghi log + cảnh báo, không thoát; cảnh báo trùng trong 60s chỉ gửi một lần", async () => {
    const { calls, handlers } = fake();
    await handlers.onUnhandledRejection(new Error("quên catch"));
    await handlers.onUnhandledRejection(new Error("quên catch"));
    await handlers.onUnhandledRejection(new Error("lỗi khác"));
    expect(calls.exit.length).toBe(0);
    expect(calls.log).toBe(3);
    expect(calls.alert).toBe(2);
  });

  test("uncaughtException: đóng server + DB rồi exit(1), chỉ xử lý một lần", async () => {
    const { calls, handlers } = fake();
    await handlers.onUncaughtException(new Error("hỏng trạng thái"));
    await handlers.onUncaughtException(new Error("lần hai"));
    expect([calls.closed, calls.db, calls.alert]).toEqual([1, 1, 1]);
    expect(calls.exit).toEqual([1]);
  });

  test("uncaughtException: server đóng không xong vẫn bị buộc exit(1) sau thời hạn", async () => {
    const exits = [];
    const { onUncaughtException } = installProcessGuards({
      proc: new EventEmitter(), exit: (c) => exits.push(c), getServer: () => ({ close: () => {} }),
      closeDb: async () => {}, alert: async () => true, log: () => {}, timeoutMs: 50,
    });
    onUncaughtException(new Error("treo khi đóng"));
    await new Promise((r) => setTimeout(r, 150));
    expect(exits).toEqual([1]);
  });

  test("cảnh báo webhook chỉ gửi tên + thông điệp rút gọn, không gửi stack; không cấu hình thì bỏ qua", async () => {
    const saved = { ops: process.env.OPS_ALERT_WEBHOOK_URL, slack: process.env.SLACK_SECURITY_WEBHOOK_URL };
    const realFetch = global.fetch;
    let body = null;
    try {
      delete process.env.OPS_ALERT_WEBHOOK_URL; delete process.env.SLACK_SECURITY_WEBHOOK_URL;
      expect(await postOpsAlert({ kind: "unhandledRejection", error: { name: "Error", message: "m" } })).toBe(false);
      process.env.OPS_ALERT_WEBHOOK_URL = "http://127.0.0.1:9/hook";
      global.fetch = async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true }; };
      expect(await postOpsAlert({ kind: "uncaughtException", error: { name: "TypeError", message: "x".repeat(10) } })).toBe(true);
      expect(Object.keys(body).includes("stack")).toBe(false);
      expect(body.kind).toBe("uncaughtException");
    } finally {
      global.fetch = realFetch;
      if (saved.ops === undefined) delete process.env.OPS_ALERT_WEBHOOK_URL; else process.env.OPS_ALERT_WEBHOOK_URL = saved.ops;
      if (saved.slack === undefined) delete process.env.SLACK_SECURITY_WEBHOOK_URL; else process.env.SLACK_SECURITY_WEBHOOK_URL = saved.slack;
    }
  });

  test("SIGTERM/SIGINT: đóng server + DB rồi exit(0); tín hiệu lặp bị bỏ qua; dọn dẹp lỗi → exit(1)", async () => {
    const { calls, handlers } = fake();
    await handlers.onSignal("SIGTERM");
    await handlers.onSignal("SIGINT");
    expect([calls.closed, calls.db]).toEqual([1, 1]);
    expect(calls.exit).toEqual([0]);
    const exits = [];
    const g = installProcessGuards({ proc: new EventEmitter(), exit: (c) => exits.push(c), getServer: () => null,
      closeDb: async () => { throw new Error("db close lỗi"); }, alert: async () => true, log: () => {}, signalTimeoutMs: 200 });
    await g.onSignal("SIGTERM");
    expect(exits).toEqual([1]);
  });

  test("tiến trình thật: SIGTERM khi đang có request → request đó vẫn trả 200, tiến trình thoát mã 0", () => {
    const guards = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "utils", "processGuards.js")).href;
    const env = { ...process.env, OPS_ALERT_WEBHOOK_URL: "", SLACK_SECURITY_WEBHOOK_URL: "" };
    const body = [
      `const http = await import("http");`,
      `const { installProcessGuards, setGuardedServer } = await import(${JSON.stringify(guards)});`,
      `installProcessGuards({ closeDb: async () => { console.log("DB_CLOSED"); } });`,
      `const server = http.createServer((req, res) => { res.on("finish", () => console.log("INFLIGHT_" + res.statusCode)); setTimeout(() => res.end("ok"), 400); });`,
      `setGuardedServer(server);`,
      `server.listen(0, "127.0.0.1", () => {`,
      `  const { port } = server.address();`,
      `  http.get({ host: "127.0.0.1", port, agent: false }, (res) => res.resume());`,
      `  setTimeout(() => process.emit("SIGTERM", "SIGTERM"), 100);`,
      `  setTimeout(() => console.log("KHONG_DUOC_IN"), 6000);`,
      `});`,
    ].join(String.fromCharCode(10));
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", body], { env, encoding: "utf8", timeout: 20000 });
    expect(r.status).toBe(0);
    expect(r.stdout.includes("INFLIGHT_200")).toBe(true);
    expect(r.stdout.includes("DB_CLOSED")).toBe(true);
    expect(r.stdout.includes("KHONG_DUOC_IN")).toBe(false);
  });

  test("tiến trình thật: promise bị reject không bắt → vẫn sống; exception không bắt → thoát mã 1", () => {
    const guards = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "utils", "processGuards.js")).href;
    const env = { ...process.env, OPS_ALERT_WEBHOOK_URL: "", SLACK_SECURITY_WEBHOOK_URL: "" };
    const run = (body) => spawnSync(process.execPath, ["--input-type=module", "-e", `const { installProcessGuards } = await import(${JSON.stringify(guards)}); installProcessGuards({ closeDb: async () => {} }); ${body}`], { env, encoding: "utf8", timeout: 20000 });
    const alive = run(`Promise.reject(new Error("quen catch")); setTimeout(() => { console.log("VAN_SONG"); process.exit(0); }, 300);`);
    expect(alive.status).toBe(0);
    expect(alive.stdout.includes("VAN_SONG")).toBe(true);
    const crash = run(`setTimeout(() => { throw new Error("hong"); }, 10); setTimeout(() => console.log("KHONG_DUOC_IN"), 5000);`);
    expect(crash.status).toBe(1);
    expect(crash.stdout.includes("KHONG_DUOC_IN")).toBe(false);
    expect(crash.stderr.includes("uncaughtException")).toBe(true);
  });
});
