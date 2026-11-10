// E2E 5 luồng critical (MEGA AUDIT v6): chạy tiến trình `node src/index.js` thật (đủ middleware, router, process guard),
// gọi HTTP thật, dữ liệu trên Mongo LOCAL. Từ chối chạy nếu DB không phải localhost (BE/.env có thể trỏ Atlas).
// Mọi tích hợp ngoài (email, Drive, PayOS, Firebase, webhook, AI) bị đặt rỗng để dotenv không nạp cấu hình thật.
import { spawn } from "child_process";
import net from "net";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Visit } from "../models/visit.model.js";
import { Invoice } from "../models/invoice.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Notification } from "../models/notification.model.js";
import { EmergencyAlert } from "../models/emergencyAlert.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { MedicalRecord } from "../modules/emr/models/medicalRecord.model.js";
import { Consultation } from "../modules/emr/models/consultation.model.js";
import { DataPrivacyConsent } from "../modules/emr/models/dataPrivacyConsent.model.js";
import { VitalSign } from "../modules/emr/models/vitalSign.model.js";
import { TransferForm } from "../models/transferForm.model.js";
import { checkPatientTenancy } from "../utils/tenancy.util.js";
import { buildMedicalRecordPayload } from "../../../FE/src/utils/medicalRecordPayload.js";
import { LabOrder } from "../modules/laboratory/models/labOrder.model.js";
import { Biomarker } from "../modules/laboratory/models/biomarker.model.js";
import { getJwtSecret } from "../config/jwt.config.js";

const BE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/;
const LIS_KEY = `e2e-lis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const EXTERNAL_BLANK = [
  "EMAIL_USER", "EMAIL_PASS", "FIREBASE_API_KEY", "FIREBASE_STORAGE_BUCKET", "FIREBASE_SERVICE_ACCOUNT", "FIREBASE_SERVICE_ACCOUNT_PATH",
  "GCS_BUCKET_NAME", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REDIRECT_URI",
  "GOOGLE_DRIVE_REFRESH_TOKEN", "DRIVE_ROOT_FOLDER_ID", "PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY",
  "SECURITY_SIEM_WEBHOOK_URL", "SLACK_SECURITY_WEBHOOK_URL", "OPS_ALERT_WEBHOOK_URL", "GEOIP_LOOKUP_URL", "DB_RESTORE_URI",
];

const oid = () => new mongoose.Types.ObjectId();
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

describe("E2E 5 luồng critical trên server thật (Mongo local)", () => {
  let child, base, H, otherH;
  const logs = [];
  const A = {};
  const dbUri = () => process.env.TEST_MONGO_URI || process.env.MONGO_URI || "";

  const token = (u) => jwt.sign({ id: String(u._id), role: u.role, tokenVersion: 0, hospitalId: u.hospitalId ? String(u.hospitalId) : null }, getJwtSecret(), { algorithm: "HS256", expiresIn: "2h" });
  const api = async (actor, method, url, body, headers = {}) => {
    const h = { "Content-Type": "application/json", ...headers };
    if (actor) h.Authorization = `Bearer ${actor.token}`;
    const res = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* không phải JSON */ }
    return { status: res.status, json, text };
  };
  const mk = async (role, hospitalId = H, name = role) => {
    const u = await User.create({ email: `e2e_${role}_${oid()}@e2e.local`, passwordHash: "x", role, hospitalId, isVerified: true, profile: { name, fullName: name } });
    return { ...u.toObject(), token: token(u) };
  };
  const expectStatus = (r, code, label) => {
    if (r.status !== code) throw new Error(`${label}: mong đợi ${code}, nhận ${r.status} — ${r.text.slice(0, 300)}`);
  };

  beforeAll(async () => {
    if (!LOCAL_DB.test(dbUri())) throw new Error("E2E chỉ chạy trên MongoDB localhost (TEST_MONGO_URI). Từ chối chạy để không ghi vào DB thật.");
    if (mongoose.connection.readyState === 0) await mongoose.connect(dbUri());
    H = (await Hospital.create({ name: "BV E2E", code: `E2E-${oid()}` }))._id;
    otherH = (await Hospital.create({ name: "BV E2E khác", code: `E2E2-${oid()}` }))._id;
    for (const r of ["doctor", "department_head", "radiologist", "nurse", "technician", "receptionist", "pharmacist", "lab_technician", "cleaner", "patient"]) A[r] = await mk(r);
    A.doctor2 = await mk("doctor", H, "BS thứ hai");
    A.nurse2 = await mk("nurse", H, "ĐD thứ hai");
    A.receptionist2 = await mk("receptionist", H, "Lễ tân thứ hai");
    A.hospital_admin = await mk("hospital_admin", H, "BGĐ A");
    A.hospital_admin2 = await mk("hospital_admin", H, "BGĐ B");
    A.admin = await mk("admin", null, "Admin nền tảng");
    A.system_admin = await mk("system_admin", null, "System admin");
    A.doctorOther = await mk("doctor", otherH, "BS viện khác");

    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const env = { ...process.env, PORT: String(port), MONGO_URI: dbUri(), NODE_ENV: "test", ENABLE_DEBUG_OTP: "true", STORAGE_MODE: "local",
      STORAGE_LOCAL_DIR: path.join(os.tmpdir(), `neuroscan_e2e_${process.pid}`), LIS_API_KEY: LIS_KEY, LIS_HOSPITAL_ID: String(H),
      AI_SERVER_URL: "http://127.0.0.1:9", ENABLE_RATE_LIMIT: "false" };
    for (const k of EXTERNAL_BLANK) env[k] = "";
    child = spawn(process.execPath, ["src/index.js"], { cwd: BE_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
    const keep = (d) => { logs.push(String(d)); if (logs.length > 400) logs.shift(); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode !== null) break;
      try { const r = await fetch(`${base}/api/v1/__e2e_ready__`, { signal: AbortSignal.timeout(1000) }); if (r.status === 404) return; } catch { /* chưa lên */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Server E2E không khởi động được:\n${logs.join("").slice(-2000)}`);
  });

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((r) => { const t = setTimeout(r, 10000); child.once("exit", () => { clearTimeout(t); r(); }); });
    }
  });

  test("E2E-1 Cấp cứu Code Red: ca chưa trả tiền bị chặn; kích hoạt cấp cứu thì được miễn cổng viện phí, đóng được cảnh báo", async () => {
    const visit = await Visit.create({ hospitalId: H, patientId: A.patient._id, patientName: "BN Code Red", doctorId: A.doctor._id, status: "chờ chụp", reason: "Đau đầu dữ dội",
      mriOrder: { orderedAt: new Date(), region: "Não", mriStatus: "ordered" } });
    const draft = await Invoice.create({ hospitalId: H, patientId: A.patient._id, visitId: visit._id, totalAmount: 3_000_000, patientPayAmount: 3_000_000, status: "chờ thanh toán",
      items: [{ description: "Chụp MRI sọ não", amount: 3_000_000, quantity: 1 }] });
    await Visit.updateOne({ _id: visit._id }, { $set: { invoiceId: draft._id } }); // như luồng chỉ định MRI tạo hóa đơn tạm tính
    const SAFE = { hasPacemakerOrMetal: false, hasClaustrophobia: false, hasKidneyDisease: false, isPregnant: false };

    expectStatus(await api(A.technician, "POST", `/api/v1/visits/${visit._id}/mri-safety-check`, SAFE), 402, "ngoại trú chưa trả tiền");
    expectStatus(await api(null, "POST", "/api/v1/emergency/trigger", { visitId: String(visit._id) }), 401, "chưa đăng nhập kích hoạt");
    expectStatus(await api(A.patient, "POST", "/api/v1/emergency/trigger", { visitId: String(visit._id) }), 403, "bệnh nhân kích hoạt");
    expectStatus(await api(A.cleaner, "POST", "/api/v1/emergency/trigger", { visitId: String(visit._id) }), 403, "vệ sinh kích hoạt");

    const trig = await api(A.doctor, "POST", "/api/v1/emergency/trigger", { visitId: String(visit._id), reason: "Lệch đường giữa 8mm" });
    expectStatus(trig, 201, "bác sĩ kích hoạt");
    const alertId = trig.json.data.alert._id;
    expect(trig.json.data.alert.level).toBe("RED");
    expect((await Visit.findById(visit._id).lean()).priority).toBe("khẩn cấp");

    const seen = await api(A.nurse, "GET", "/api/v1/emergency/alerts");
    expectStatus(seen, 200, "điều dưỡng xem cảnh báo");
    expect(JSON.stringify(seen.json).includes(alertId)).toBe(true);
    expectStatus(await api(A.doctorOther, "PUT", `/api/v1/emergency/alerts/${alertId}/acknowledge`, {}), 404, "bác sĩ viện khác xác nhận");

    expectStatus(await api(A.technician, "POST", `/api/v1/visits/${visit._id}/mri-safety-check`, SAFE), 200, "cấp cứu được miễn cổng viện phí");
    expect((await AuditLog.countDocuments({ action: "PAYMENT_GATE_BYPASSED", entityId: String(visit._id) })) >= 1).toBe(true);

    expectStatus(await api(A.nurse, "PUT", `/api/v1/emergency/alerts/${alertId}/acknowledge`, {}), 200, "điều dưỡng xác nhận");
    expectStatus(await api(A.nurse, "PUT", `/api/v1/emergency/alerts/${alertId}/resolve`, {}), 403, "điều dưỡng đóng cảnh báo");
    expectStatus(await api(A.doctor, "PUT", `/api/v1/emergency/alerts/${alertId}/resolve`, { note: "Đã chuyển phẫu thuật" }), 200, "bác sĩ đóng cảnh báo");
    expect(["resolved", "closed"].includes((await EmergencyAlert.findById(alertId).lean()).status)).toBe(true);
  });

  test("E2E-2 Ký báo cáo CĐHA: bác sĩ lâm sàng không ký được, CĐHA ký một lần, lâm sàng xác nhận đã đọc có lịch sử", async () => {
    const img = await ImagingResult.create({ hospitalId: H, medicalId: "BN-E2E-1", patientName: "BN CĐHA", birthYear: 1980, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "Ngoại thần kinh", diagnosis: "U não", procedure: "MRI", findings: "Khối choán chỗ thùy trán", conclusion: "Chờ kết luận", radiologist: "Chưa ký", reportDate: new Date().toISOString(), imagingType: "MRI", isSigned: false });
    const sign = (actor, body) => api(actor, "POST", `/api/v1/clinical-view/imaging/${img._id}/sign`, body);
    const ack = (actor) => api(actor, "POST", `/api/v1/imaging/${img._id}/acknowledge`, { clinicalNote: "Đã đọc, lên kế hoạch mổ" });

    expectStatus(await sign(A.doctor, { finalConclusion: "U thần kinh đệm" }), 403, "bác sĩ lâm sàng ký (viện có CĐHA)");
    expectStatus(await sign(A.nurse, { finalConclusion: "x" }), 403, "điều dưỡng ký");
    expectStatus(await ack(A.doctor), 409, "xác nhận đọc khi chưa ký");
    expectStatus(await sign(A.radiologist, {}), 400, "CĐHA ký thiếu kết luận");
    expectStatus(await sign(A.radiologist, { finalConclusion: "U thần kinh đệm bậc cao, đề nghị sinh thiết" }), 200, "CĐHA ký");
    expectStatus(await sign(A.radiologist, { finalConclusion: "ghi đè" }), 409, "ký đè báo cáo đã khóa");
    expect((await ImagingResult.findById(img._id).lean()).isSigned).toBe(true);

    expectStatus(await ack(A.admin), 403, "admin nền tảng xác nhận đọc");
    expectStatus(await ack(A.radiologist), 403, "CĐHA tự xác nhận đọc");
    const otherAck = await ack(A.doctorOther);
    expect([403, 404].includes(otherAck.status)).toBe(true); // viện khác: chặn, không lộ bản ghi
    expectStatus(await ack(A.doctor), 200, "bác sĩ lâm sàng xác nhận đọc");
    expectStatus(await ack(A.department_head), 200, "trưởng khoa xác nhận đọc");
    const after = await ImagingResult.findById(img._id).lean();
    expect(after.acknowledgmentHistory.length).toBe(1);
    expect(String(after.attendingAcknowledgment.acknowledgedBy)).toBe(String(A.department_head._id));
  });

  test("E2E-2b Cảnh báo Đỏ CĐHA: chỉ bác sĩ (lâm sàng, CĐHA, trưởng khoa) cùng viện được xác nhận tiếp nhận", async () => {
    const img = await ImagingResult.create({ hospitalId: H, medicalId: "BN-E2E-2", patientName: "BN Cảnh báo đỏ", birthYear: 1975, gender: "Nữ", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "Cấp cứu", diagnosis: "Xuất huyết", procedure: "MRI", findings: "Thoát vị não", conclusion: "Thoát vị não", radiologist: "BS CĐHA", reportDate: new Date().toISOString(), imagingType: "MRI",
      isSigned: true, signedAt: new Date(), criticalFinding: { isCritical: true } });
    const ackCrit = (actor) => api(actor, "POST", `/api/v1/imaging/${img._id}/acknowledge-critical`, {});
    expectStatus(await ackCrit(A.admin), 403, "admin nền tảng (không gắn viện) xác nhận cảnh báo đỏ");
    expectStatus(await ackCrit(A.hospital_admin), 403, "BGĐ (không phải bác sĩ) xác nhận cảnh báo đỏ");
    expect([403, 404].includes((await ackCrit(A.doctorOther)).status)).toBe(true); // viện khác: chặn, không lộ bản ghi
    expect((await ImagingResult.findById(img._id).lean()).criticalFinding.acknowledgedAt == null).toBe(true);
    expectStatus(await ackCrit(A.doctor), 200, "bác sĩ cùng viện xác nhận cảnh báo đỏ");
    expect(String((await ImagingResult.findById(img._id).lean()).criticalFinding.acknowledgedBy)).toBe(String(A.doctor._id));
  });

  test("IT1-07 Dữ liệu CĐHA qua clinical-view: admin/system_admin không đọc được (RELEASE v3.4); viện khác bị chặn; bác sĩ cùng viện đọc được", async () => {
    const medicalId = `BN-CV-${String(oid()).slice(-6)}`;
    await User.updateOne({ _id: A.patient._id }, { $set: { "profile.medicalId": medicalId } });
    const img = await ImagingResult.create({ hospitalId: H, medicalId, patientName: "BN clinical-view", birthYear: 1970, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "K", diagnosis: "U não", procedure: "MRI", findings: "Khối u", conclusion: "U thần kinh đệm", radiologist: "BS CĐHA", reportDate: new Date().toISOString(),
      imagingType: "MRI", isSigned: true, signedAt: new Date() });
    const urls = ["dicom-viewer", "ai-overlays", "ai-report", "3d-model"].map((p) => `/api/v1/clinical-view/imaging/${img._id}/${p}`);
    urls.push(`/api/v1/clinical-view/patients/${A.patient._id}/followup-comparison`);
    for (const who of ["admin", "system_admin"]) {
      for (const u of urls) expectStatus(await api(A[who], "GET", u), 403, `${who} ${u}`);
    }
    for (const u of urls.slice(0, 4)) {
      const r = await api(A.doctorOther, "GET", u);
      expect([403, 404].includes(r.status)).toBe(true);
    }
    const other = await api(A.doctorOther, "GET", urls[4]);
    expect(other.status === 403 || JSON.stringify(other.json).includes(String(img._id)) === false).toBe(true);
    for (const u of urls.slice(0, 3)) expectStatus(await api(A.doctor, "GET", u), 200, `bác sĩ cùng viện ${u}`);
    expectStatus(await api(A.doctor, "GET", urls[4]), 200, "bác sĩ cùng viện xem so sánh theo dõi");
  });

  test("IT1-07/08 Tạo kết quả CĐHA từ ca KTV: admin không tạo được; thiếu năm sinh/địa chỉ/chẩn đoán thì để trống, không ghi cứng 'không cản quang'", async () => {
    const bare = await User.create({ email: `e2e_bare_${oid()}@e2e.local`, passwordHash: "x", role: "patient", hospitalId: H, profile: { name: "BN thiếu hồ sơ" } });
    const visit = await Visit.create({ hospitalId: H, patientId: bare._id, doctorId: A.doctor._id, status: "đang chụp", mriOrder: { orderedAt: new Date(), region: "Não", mriStatus: "ordered" } });
    const body = { visitId: String(visit._id), imageUrl: "/uploads/e2e_slice.png", requestAiAnalysis: false };
    expectStatus(await api(A.admin, "POST", "/api/v1/imaging-results", body), 403, "admin tạo kết quả CĐHA");
    expectStatus(await api(A.system_admin, "POST", "/api/v1/imaging-results", body), 403, "system_admin tạo kết quả CĐHA");
    const created = await api(A.technician, "POST", "/api/v1/imaging-results", body);
    expect([200, 201].includes(created.status)).toBe(true);
    const saved = await ImagingResult.findById(created.json?.data?._id).lean();
    if (!saved) throw new Error(`không thấy bản ghi; phản hồi ${created.status}: ${created.text.slice(0, 400)}`);
    expect(saved.birthYear == null).toBe(true);
    expect([saved.address, saved.diagnosis, saved.orderingDepartment, saved.gender]).toEqual(["", "", "", ""]);
    expect(saved.technique.includes("không thuốc cản quang")).toBe(false);
    // kết quả gắn đúng lượt khám (tra thẳng collection, không qua plugin tenant của tiến trình test)
    const raw = await ImagingResult.collection.findOne({ visitId: visit._id });
    expect(String(raw && raw._id)).toBe(String(saved._id));
    expect(String((await Visit.findById(visit._id).lean()).mriOrder.imagingResultId)).toBe(String(saved._id));
  });

  test("IT1-08 Tiếp nhận cấp cứu: thiếu tuổi/điện thoại/đánh giá thì để trống, không tự gán tuổi 40, SĐT 0000000000, chẩn đoán u não", async () => {
    const name = `BN ED ${String(oid()).slice(-6)}`;
    const r = await api(A.doctor, "POST", "/api/v1/emergency/ed-handoff", { patientName: name, situation: "Đau đầu đột ngột" });
    expect([200, 201].includes(r.status)).toBe(true);
    const p = await User.findOne({ hospitalId: H, role: "patient", "profile.name": name }).lean();
    expect([p.profile.age == null, p.profile.phone || "", p.profile.gender]).toEqual([true, "", ""]);
    const v = await Visit.findOne({ hospitalId: H, patientId: p._id }).lean();
    expect(v.diagnosis || "").toBe("");
    expect(v.priority).toBe("khẩn cấp");
  });

  test("E2E-3 Y lệnh miệng thuốc gây nghiện: đọc lại bởi đúng điều dưỡng, chỉ người ra lệnh ký bổ sung, bắt buộc người chứng kiến", async () => {
    const record = await MedicalRecord.create({ hospitalId: H, patientId: String(A.patient._id), userId: A.patient._id, patientName: "BN Y lệnh", age: 55, birthYear: 1971, gender: "Nam",
      doctorInCharge: "BS", diagnosis: "Đau sau mổ", status: "Cấp cứu" });
    const trig = await api(A.doctor, "POST", "/api/v1/emergency/trigger", { patientId: String(A.patient._id), reason: "Đau dữ dội sau mổ" });
    expectStatus(trig, 201, "mở sự kiện cấp cứu");
    const eventId = trig.json.data.alert._id;
    const body = { emergencyEventId: eventId, medicalRecordId: String(record._id), orderText: "Morphin 5mg tiêm tĩnh mạch chậm", isControlledSubstance: true, nurseReceivedId: String(A.nurse._id) };

    expectStatus(await api(A.admin, "POST", "/api/v1/emergency/verbal-order", body), 403, "admin ra y lệnh");
    expectStatus(await api(A.nurse, "POST", "/api/v1/emergency/verbal-order", body), 403, "điều dưỡng ra y lệnh");
    const created = await api(A.doctor, "POST", "/api/v1/emergency/verbal-order", body);
    expectStatus(created, 201, "bác sĩ ra y lệnh miệng");
    const orderId = String((await MedicalRecord.findById(record._id).lean()).verbalOrders.at(-1)._id);
    const status = async () => (await MedicalRecord.findById(record._id).lean()).verbalOrders.find((o) => String(o._id) === orderId);
    expect((await status()).status).toBe("pending_readback");

    expectStatus(await api(A.doctor, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, { witnessUserId: String(A.pharmacist._id) }), 400, "ký trước khi đọc lại");
    const wrongNurse = await api(A.nurse2, "POST", `/api/v1/emergency/verbal-order/${orderId}/readback-confirm`, {});
    expect([403, 404].includes(wrongNurse.status)).toBe(true);
    expectStatus(await api(A.nurse, "POST", `/api/v1/emergency/verbal-order/${orderId}/readback-confirm`, {}), 200, "đúng điều dưỡng đọc lại");
    expect((await status()).status).toBe("readback_confirmed");

    expectStatus(await api(A.doctor2, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, { witnessUserId: String(A.pharmacist._id) }), 403, "bác sĩ khác ký bổ sung");
    expectStatus(await api(A.doctor, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, {}), 400, "thuốc gây nghiện không có người chứng kiến");
    expectStatus(await api(A.doctor, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, { witnessUserId: String(A.doctor._id) }), 400, "tự làm người chứng kiến");
    expectStatus(await api(A.doctor, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, { witnessUserId: String(A.pharmacist._id), notes: "Đã đối chiếu" }), 200, "ký bổ sung có người chứng kiến");
    const done = await status();
    expect(done.status).toBe("fully_signed");
    expect(String(done.witnessUserId)).toBe(String(A.pharmacist._id));
    expectStatus(await api(A.doctor, "POST", `/api/v1/emergency/verbal-order/${orderId}/countersign`, { witnessUserId: String(A.pharmacist._id) }), 409, "ký lại y lệnh đã ký đủ");
  });

  test("E2E-4 Hoàn tiền ≥ 10 triệu: người lập không tự duyệt, BGĐ phải xác thực bước 2; ≥ 300 triệu cần 3 người khác nhau; admin không tham gia", async () => {
    const paid = (amount) => Invoice.create({ hospitalId: H, patientId: A.patient._id, totalAmount: amount, patientPayAmount: amount, status: "đã thanh toán", paidAt: new Date(), paymentMethod: "tiền mặt",
      items: [{ description: "Gói phẫu thuật", amount, quantity: 1 }] });
    const stepUp = async (actor) => {
      const req = await api(actor, "POST", "/auth/step-up/request", {});
      expectStatus(req, 200, "xin mã step-up");
      expectStatus(await api(actor, "POST", "/auth/step-up/verify", { otp: req.json.debugOtp }), 200, "xác thực step-up");
    };

    const inv = await paid(60_000_000);
    for (const who of ["admin", "system_admin"]) {
      expectStatus(await api(A[who], "POST", `/api/v1/invoices/${inv._id}/refund/request`, { refundReason: "Bệnh nhân chuyển viện", requestedAmount: 60_000_000 }), 403, `${who} lập yêu cầu hoàn`);
    }
    expectStatus(await api(A.receptionist, "POST", `/api/v1/invoices/${inv._id}/refund/request`, { refundReason: "Bệnh nhân chuyển viện", requestedAmount: 60_000_000 }), 202, "lễ tân lập yêu cầu hoàn 60tr");
    expectStatus(await api(A.receptionist, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {}), 403, "người lập tự duyệt");
    expectStatus(await api(A.receptionist2, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {}), 403, "lễ tân duyệt khoản ≥ 50tr");
    const noStep = await api(A.hospital_admin, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {});
    expectStatus(noStep, 403, "BGĐ duyệt khi chưa step-up");
    expect(noStep.json.code).toBe("STEP_UP_REQUIRED");
    await stepUp(A.hospital_admin);
    expectStatus(await api(A.hospital_admin, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {}), 200, "BGĐ duyệt sau step-up");
    const refunded = await Invoice.findById(inv._id).lean();
    expect(refunded.status).toBe("hoàn trả");
    expect(refunded.refundApproval.approvalStatus).toBe("completed");

    const big = await paid(400_000_000);
    expectStatus(await api(A.receptionist, "POST", `/api/v1/invoices/${big._id}/refund/request`, { refundReason: "Hủy ca phẫu thuật", requestedAmount: 400_000_000 }), 202, "lập yêu cầu 400tr");
    await stepUp(A.hospital_admin2);
    const noReview = await api(A.hospital_admin2, "POST", `/api/v1/invoices/${big._id}/refund/approve`, {});
    expectStatus(noReview, 403, "duyệt 400tr khi chưa có người kiểm tra");
    expect(noReview.json.code).toBe("LARGE_REFUND_REVIEW_REQUIRED");
    expectStatus(await api(A.hospital_admin, "PUT", `/api/v1/invoices/${big._id}/refund/large-review`, { note: "Đã đối chiếu hồ sơ hủy ca" }), 200, "BGĐ A kiểm tra khoản lớn");
    // step-up của BGĐ A còn hiệu lực 5 phút (STEP_UP_VALID_MS) — xin lại trong 60 giây sẽ bị chặn 429 theo đúng chính sách
    const sameReviewer = await api(A.hospital_admin, "POST", `/api/v1/invoices/${big._id}/refund/approve`, {});
    expectStatus(sameReviewer, 403, "người kiểm tra tự duyệt");
    expectStatus(await api(A.hospital_admin2, "POST", `/api/v1/invoices/${big._id}/refund/approve`, {}), 200, "BGĐ B duyệt");
    expect((await Invoice.findById(big._id).lean()).status).toBe("hoàn trả");
  });

  test("E2E-5 Cảnh báo xét nghiệm nguy kịch: máy LIS gửi kết quả bằng API key, bác sĩ nhận thông báo, duyệt một lần", async () => {
    const code = `E2E${String(oid()).slice(-6).toUpperCase()}`;
    await Biomarker.collection.insertOne({ code, name: "Kali máu", category: "HOA_SINH", unit: "mmol/L", critical_low: 2.5, critical_high: 6.5, reference_range: { male: { min: 3.5, max: 5 }, female: { min: 3.5, max: 5 } } });
    const order = await LabOrder.create({ hospitalId: H, patient_id: A.patient._id, doctor_id: A.doctor._id, barcode: `E2E-${oid()}`, category: "HOA_SINH", patient_gender: "Nam", status: "PENDING" });
    const payload = { barcode: order.barcode, results: [{ code, value: 7.8 }] };

    expectStatus(await api(null, "POST", "/api/lis/receiver", payload), 401, "không khóa, không đăng nhập");
    expectStatus(await api(null, "POST", "/api/lis/receiver", payload, { "x-lis-api-key": "sai-khoa" }), 401, "sai khóa LIS");
    const recv = await api(null, "POST", "/api/lis/receiver", payload, { "x-lis-api-key": LIS_KEY });
    expectStatus(recv, 200, "máy LIS gửi kết quả");
    const stored = await LabOrder.findById(order._id).lean();
    expect(stored.hasCriticalValue).toBe(true);
    expect(Boolean(stored.criticalNotifiedAt)).toBe(true);

    const inbox = await api(A.doctor, "GET", "/api/v1/notifications");
    expectStatus(inbox, 200, "bác sĩ xem thông báo");
    const list = inbox.json?.data?.notifications || inbox.json?.notifications || inbox.json?.data || [];
    expect(list.some((n) => n.type === "critical_lab_value" && String(n.relatedId) === String(order._id))).toBe(true);
    expect((await Notification.countDocuments({ hospitalId: H, type: "critical_lab_value", relatedId: order._id, recipientId: A.doctor._id })) >= 1).toBe(true);

    expectStatus(await api(A.doctorOther, "POST", `/api/lis/orders/${order._id}/verify`, {}), 404, "bác sĩ viện khác duyệt");
    expectStatus(await api(A.doctor, "POST", `/api/lis/orders/${order._id}/verify`, {}), 200, "bác sĩ duyệt");
    expect((await LabOrder.findById(order._id).lean()).status).toBe("VERIFIED");
    const again = await api(A.department_head, "POST", `/api/lis/orders/${order._id}/verify`, {});
    expectStatus(again, 200, "duyệt lại phiếu đã duyệt trả trạng thái cũ");
    expect(String((await LabOrder.findById(order._id).lean()).verified_by)).toBe(String(A.doctor._id));
  });

  test("IT2-01 Bệnh án điện tử: admin/system_admin không đọc, ghi, duyệt Hội đồng u (RELEASE v3.4); BGĐ cùng viện vẫn đọc được", async () => {
    const record = await MedicalRecord.create({ hospitalId: H, patientId: `BN-EMR-${String(oid()).slice(-6)}`, patientName: "BN EMR", age: 48, gender: "Nữ", diagnosis: "U màng não", doctorInCharge: "BS" });
    const consult = await Consultation.create({ hospitalId: H, medicalRecordId: record._id, meetingDate: new Date(), participants: ["BS A", "BS B"], clinicalSummary: "Khối u màng não 25mm",
      diagnosis: "U màng não", treatmentConclusion: "Phẫu thuật", consultationType: "tumor_board" });
    const approve = { consensusDecision: "Đồng thuận phẫu thuật", scheduledSurgeryDate: new Date(Date.now() + 86_400_000).toISOString() };
    for (const who of ["admin", "system_admin"]) {
      expectStatus(await api(A[who], "GET", "/emr/records"), 403, `${who} xem danh sách bệnh án`);
      expectStatus(await api(A[who], "GET", `/emr/records/${record._id}`), 403, `${who} xem bệnh án`);
      expectStatus(await api(A[who], "POST", "/emr/records", { patientId: "BN-X", patientName: "BN X" }), 403, `${who} tạo bệnh án`);
      expectStatus(await api(A[who], "PUT", `/emr/records/${record._id}`, { diagnosis: "ghi đè" }), 403, `${who} sửa bệnh án`);
      expectStatus(await api(A[who], "PUT", `/emr/records/${record._id}/sign`, {}), 403, `${who} ký bệnh án`);
      expectStatus(await api(A[who], "GET", `/emr/records/${record._id}/consultations`), 403, `${who} xem hội chẩn`);
      expectStatus(await api(A[who], "POST", `/emr/consultations/${consult._id}/approve-tumor-board`, approve), 403, `${who} duyệt Hội đồng u`);
    }
    const after = await MedicalRecord.findById(record._id).lean();
    expect([after.diagnosis, after.signStatus]).toEqual(["U màng não", "Chưa duyệt"]);
    const board = (await Consultation.findById(consult._id).lean()).tumorBoardDetails || {};
    expect([board.chairApprovedBy ?? null, Boolean(board.isLocked)]).toEqual([null, false]);
    const listed = await api(A.hospital_admin, "GET", "/emr/records");
    expectStatus(listed, 200, "BGĐ cùng viện xem danh sách");
    expect(JSON.stringify(listed.json).includes(String(record._id))).toBe(true);
    expect([403, 404].includes((await api(A.doctorOther, "GET", `/emr/records/${record._id}`)).status)).toBe(true); // viện khác: chặn, không lộ bản ghi
  });

  test("IT2-02 Điều dưỡng mở bệnh án khi đo sinh hiệu: thiếu tuổi/chẩn đoán/bác sĩ thì để trống, không tự điền; chưa có chẩn đoán thì không ký được", async () => {
    const patientId = `BN-DD-${String(oid()).slice(-6)}`;
    expectStatus(await api(A.nurse, "POST", "/emr/records", { patientId, patientName: "  " }), 400, "thiếu họ tên");
    expectStatus(await api(A.nurse, "POST", "/emr/records", { patientId, patientName: "BN ĐD", age: "abc" }), 400, "tuổi không phải số");
    expectStatus(await api(A.nurse, "POST", "/emr/records", { patientId, patientName: "BN ĐD", age: 200 }), 400, "tuổi vượt 150");
    const created = await api(A.nurse, "POST", "/emr/records", { patientId, patientName: "BN ĐD", gender: "", admissionType: "Ngoại trú", diagnosis: "", doctorInCharge: "" });
    expectStatus(created, 201, "điều dưỡng mở bệnh án chưa có tuổi/chẩn đoán");
    const saved = await MedicalRecord.findById(created.json.data._id).lean();
    expect([saved.age, saved.diagnosis, saved.doctorInCharge, saved.gender]).toEqual([null, "", "", ""]);
    const infant = await api(A.nurse, "POST", "/emr/records", { patientId: `${patientId}-SS`, patientName: "BN sơ sinh", age: 0 });
    expectStatus(infant, 201, "trẻ dưới 1 tuổi");
    expect((await MedicalRecord.findById(infant.json.data._id).lean()).age).toBe(0);

    expectStatus(await api(A.doctor, "PUT", `/emr/records/${saved._id}/sign`, {}), 400, "ký bệnh án chưa có chẩn đoán");
    expect((await MedicalRecord.findById(saved._id).lean()).signStatus).toBe("Chưa duyệt");
    await MedicalRecord.updateOne({ _id: saved._id }, { $set: { diagnosis: "Theo dõi u não thùy thái dương" } });
    expectStatus(await api(A.doctor, "PUT", `/emr/records/${saved._id}/sign`, {}), 200, "ký sau khi bác sĩ ghi chẩn đoán");
    expect((await MedicalRecord.findById(saved._id).lean()).signStatus).toBe("Đã ký số");
  });

  test("IT1-03 Xét nghiệm: máy LIS/KTV xét nghiệm nhập kết quả, chỉ bác sĩ duyệt; KTV CĐHA và tài khoản nền tảng bị chặn", async () => {
    const code = `IT13${String(oid()).slice(-6).toUpperCase()}`;
    await Biomarker.collection.insertOne({ code, name: "Glucose", category: "HOA_SINH", unit: "mmol/L", critical_low: 2.2, critical_high: 25, reference_range: { male: { min: 3.9, max: 6.4 }, female: { min: 3.9, max: 6.4 } } });
    const newOrder = (status = "PENDING") => LabOrder.create({ hospitalId: H, patient_id: A.patient._id, doctor_id: A.doctor._id, barcode: `IT13-${oid()}`, category: "HOA_SINH", patient_gender: "Nữ", status });
    const order = await newOrder();
    const payload = { barcode: order.barcode, results: [{ code, value: 5.2 }] };
    for (const who of ["technician", "admin", "system_admin", "nurse"]) {
      expectStatus(await api(A[who], "POST", "/api/lis/receiver", payload), 403, `${who} nhập kết quả xét nghiệm`);
    }
    expect((await LabOrder.findById(order._id).lean()).status).toBe("PENDING");
    expectStatus(await api(A.lab_technician, "POST", "/api/lis/receiver", payload), 200, "KTV xét nghiệm nhập kết quả");
    expect((await LabOrder.findById(order._id).lean()).status).toBe("RESULTED");

    for (const who of ["lab_technician", "technician", "hospital_admin", "admin", "system_admin"]) {
      expectStatus(await api(A[who], "POST", `/api/lis/orders/${order._id}/verify`, {}), 403, `${who} duyệt kết quả`);
    }
    expect((await LabOrder.findById(order._id).lean()).status).toBe("RESULTED");
    expectStatus(await api(A.doctor, "POST", `/api/lis/orders/${order._id}/verify`, {}), 200, "bác sĩ duyệt");
    expect((await LabOrder.findById(order._id).lean()).status).toBe("VERIFIED");

    const pending = await newOrder();
    expectStatus(await api(A.admin, "POST", `/api/lis/orders/${pending._id}/collect`, {}), 403, "admin ghi nhận lấy mẫu");
    expectStatus(await api(A.nurse, "POST", `/api/lis/orders/${pending._id}/collect`, {}), 200, "điều dưỡng ghi nhận lấy mẫu");
    // bác sĩ vẫn nhập tay được khi máy LIS không gửi (màn PatientDetail)
    const manual = await newOrder();
    expectStatus(await api(A.doctor, "POST", "/api/lis/receiver", { barcode: manual.barcode, results: [{ code, value: 4.8 }] }), 200, "bác sĩ nhập tay");
  });

  test("IT1-04 Cấp cứu: giải trừ báo động, chèn lịch MRI, giữ giường, đóng sự kiện/cảnh báo chỉ Bác sĩ hoặc Trưởng khoa", async () => {
    const pt = await mk("patient", H, "BN co giật");
    const trig = await api(A.doctor, "POST", "/api/v1/emergency/trigger", { patientId: String(pt._id), reason: "Co giật liên tục" });
    expectStatus(trig, 201, "bác sĩ kích hoạt cấp cứu");
    const alertId = trig.json.data.alert._id;
    const fake = String(oid());
    const leadCalls = (actor) => [
      api(actor, "PUT", `/api/v1/emergency/alerts/${alertId}/resolve`, { note: "x" }),
      api(actor, "POST", `/api/v1/emergency/cancel-stand-down/${fake}`, { cancelReason: "Báo nhầm" }),
      api(actor, "POST", "/api/v1/emergency/request-mri-override", { emergencyEventId: fake }),
      api(actor, "POST", "/api/v1/emergency/request-icu-bed", { emergencyEventId: fake }),
      api(actor, "POST", `/api/v1/emergency/close-event/${fake}`, {}),
      api(actor, "PUT", `/api/v1/emergency/ed-accept/${fake}`, {}),
    ];
    for (const who of ["hospital_admin", "admin", "system_admin", "nurse"]) {
      const results = await Promise.all(leadCalls(A[who]));
      results.forEach((r, i) => expectStatus(r, 403, `${who} thao tác chỉ huy cấp cứu #${i}`));
    }
    expect(["resolved", "closed"].includes((await EmergencyAlert.findById(alertId).lean()).status)).toBe(false);
    // Bác sĩ/Trưởng khoa qua được cổng vai trò (id giả thì 4xx khác 403)
    const docResults = await Promise.all(leadCalls(A.department_head).slice(1));
    docResults.forEach((r, i) => {
      if (r.status === 403 || r.status >= 500) throw new Error(`trưởng khoa thao tác #${i + 1}: nhận ${r.status} — ${r.text.slice(0, 200)}`);
    });
    expectStatus(await api(A.department_head, "PUT", `/api/v1/emergency/alerts/${alertId}/resolve`, { note: "Đã ổn định, chuyển mổ" }), 200, "trưởng khoa đóng cảnh báo");
  });

  test("IT3-01 Ký bệnh án: không ghi chứng thư/CA giả (bỏ qua thông tin client tự khai), Trưởng khoa ký được", async () => {
    const mkRec = () => MedicalRecord.create({ hospitalId: H, patientId: `BN-KY-${String(oid()).slice(-6)}`, patientName: "BN ký", diagnosis: "U thần kinh đệm", doctorInCharge: "BS" });
    const r1 = await mkRec();
    const fakeCert = { certificateSerial: "FAKE-123", caProvider: "VNPT-CA", timestampToken: "RFC3161_TSA_VERIFIED", signatureType: "cloud_hsm", signingAlgorithm: "SHA256withRSA" };
    expectStatus(await api(A.doctor, "PUT", `/emr/records/${r1._id}/sign`, fakeCert), 200, "bác sĩ ký");
    const m = (await MedicalRecord.findById(r1._id).lean()).digitalSignatureMetadata;
    expect([m.signatureType, m.certificateSerial, m.caProvider, m.timestampToken, m.signingAlgorithm]).toEqual(["internal_hash", "", "", "", "SHA-256"]);
    expect(/^[a-f0-9]{64}$/.test(m.signedHash)).toBe(true);
    expect(m.signedBy).toBe("doctor");
    const r2 = await mkRec();
    expectStatus(await api(A.department_head, "PUT", `/emr/records/${r2._id}/sign`, {}), 200, "trưởng khoa ký");
    expect((await MedicalRecord.findById(r2._id).lean()).signStatus).toBe("Đã ký số");
    expectStatus(await api(A.nurse, "PUT", `/emr/records/${(await mkRec())._id}/sign`, {}), 403, "điều dưỡng ký");
    // bệnh án mới chưa ký không mang tên CA/thuật toán mặc định
    const fresh = (await mkRec()).toObject().digitalSignatureMetadata || {};
    expect([fresh.caProvider || "", fresh.signingAlgorithm || ""]).toEqual(["", ""]);
    const img = await ImagingResult.create({ hospitalId: H, medicalId: "BN-CA", patientName: "BN CA", birthYear: 1980, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "K", diagnosis: "U não", procedure: "MRI", findings: "x", conclusion: "x", radiologist: "x", reportDate: new Date().toISOString(), imagingType: "MRI", isSigned: false });
    expect(((await ImagingResult.findById(img._id).lean()).digitalSignatureMetadata || {}).caProvider || "").toBe("");
  });

  test("IT3-02 Sửa bệnh án: không đổi được trường hệ thống (viện, trạng thái ký, chữ ký, hạn lưu trữ, phong tỏa, y lệnh miệng) qua PUT", async () => {
    const rec = await MedicalRecord.create({ hospitalId: H, patientId: `BN-PUT-${String(oid()).slice(-6)}`, patientName: "BN sửa", diagnosis: "Cũ", doctorInCharge: "BS" });
    const before = await MedicalRecord.findById(rec._id).lean();
    const r = await api(A.nurse, "PUT", `/emr/records/${rec._id}`, {
      diagnosis: "Mới", hospitalId: String(otherH), signStatus: "Đã ký số", patientId: "BN-KHAC",
      digitalSignatureMetadata: { signatureType: "cloud_hsm", caProvider: "VNPT-CA", certificateSerial: "GIA" },
      retentionExpiresAt: "2000-01-01T00:00:00.000Z", legalHold: { isHeld: true, reason: "x" }, verbalOrders: [], addendums: [], currentVersion: 99,
    });
    expectStatus(r, 200, "điều dưỡng sửa chẩn đoán");
    const after = await MedicalRecord.collection.findOne({ _id: rec._id });
    expect(after.diagnosis).toBe("Mới");
    expect([String(after.hospitalId), after.signStatus, after.patientId, after.digitalSignatureMetadata?.caProvider || ""]).toEqual([String(H), "Chưa duyệt", before.patientId, ""]);
    expect(String(after.retentionExpiresAt)).toBe(String(before.retentionExpiresAt));
    expect(Boolean(after.legalHold?.isHeld)).toBe(false);
    expect(after.currentVersion).toBe((before.currentVersion || 1) + 1);
    // form "Bệnh án Ung thư Não" (FE) gửi dữ liệu hợp lệ với schema
    const formPayload = buildMedicalRecordPayload({ hanhChinh: { hoTen: "BN form", tuoi: "52", gioiTinh: "Nam" }, chanDoan: { xacDinh: "U tuyến yên" }, huongDieuTri: { chuyenKhoa: "Theo dõi" } }, `BN-FORM-${String(oid()).slice(-6)}`);
    const created = await api(A.doctor, "POST", "/emr/records", formPayload);
    expectStatus(created, 201, "lưu form bệnh án lên server");
    const saved = await MedicalRecord.findById(created.json.data._id).lean();
    expect([saved.admissionType, saved.paymentMethod, saved.age, saved.diagnosis]).toEqual(["Ngoại trú", "Viện phí", 52, "U tuyến yên"]);
    expectStatus(await api(A.doctor, "PUT", `/emr/records/${saved._id}`, buildMedicalRecordPayload({ hanhChinh: { hoTen: "BN form" }, chanDoan: { xacDinh: "U tuyến yên, đã sinh thiết" } }, saved.patientId)), 200, "sửa từ form");
    const edited = await MedicalRecord.findById(saved._id).lean();
    expect([edited.age, edited.gender, edited.treatmentPlan, edited.diagnosis]).toEqual([52, "Nam", "Theo dõi", "U tuyến yên, đã sinh thiết"]); // ô trống không ghi đè
  });

  test("IT3-03 Xét nghiệm: người nhập tay không tự duyệt được, bác sĩ khác duyệt; kết quả máy LIS ghi đúng nguồn", async () => {
    const code = `IT33${String(oid()).slice(-6).toUpperCase()}`;
    await Biomarker.collection.insertOne({ code, name: "Natri", category: "HOA_SINH", unit: "mmol/L", critical_low: 120, critical_high: 160, reference_range: { male: { min: 135, max: 145 }, female: { min: 135, max: 145 } } });
    const newOrder = () => LabOrder.create({ hospitalId: H, patient_id: A.patient._id, doctor_id: A.doctor._id, barcode: `IT33-${oid()}`, category: "HOA_SINH", patient_gender: "Nam", status: "PENDING" });
    const manual = await newOrder();
    expectStatus(await api(A.doctor, "POST", "/api/lis/receiver", { barcode: manual.barcode, results: [{ code, value: 139 }] }), 200, "bác sĩ nhập tay");
    let o = await LabOrder.findById(manual._id).lean();
    expect([String(o.resulted_by), o.resulted_source]).toEqual([String(A.doctor._id), "manual"]);
    const self = await api(A.doctor, "POST", `/api/lis/orders/${manual._id}/verify`, {});
    expectStatus(self, 403, "người nhập tự duyệt");
    expect((await LabOrder.findById(manual._id).lean()).status).toBe("RESULTED");
    expectStatus(await api(A.doctor2, "POST", `/api/lis/orders/${manual._id}/verify`, {}), 200, "bác sĩ khác duyệt");
    o = await LabOrder.findById(manual._id).lean();
    expect([o.status, String(o.verified_by)]).toEqual(["VERIFIED", String(A.doctor2._id)]);

    const byLab = await newOrder();
    expectStatus(await api(A.lab_technician, "POST", "/api/lis/receiver", { barcode: byLab.barcode, results: [{ code, value: 141 }] }), 200, "KTV xét nghiệm nhập");
    expectStatus(await api(A.doctor, "POST", `/api/lis/orders/${byLab._id}/verify`, {}), 200, "bác sĩ duyệt kết quả KTV nhập");

    const machine = await newOrder();
    expectStatus(await api(null, "POST", "/api/lis/receiver", { barcode: machine.barcode, results: [{ code, value: 140 }] }, { "x-lis-api-key": LIS_KEY }), 200, "máy LIS gửi");
    o = await LabOrder.findById(machine._id).lean();
    expect([o.resulted_by ?? null, o.resulted_source]).toEqual([null, "lis_machine"]);
    expectStatus(await api(A.doctor, "POST", `/api/lis/orders/${machine._id}/verify`, {}), 200, "bác sĩ duyệt kết quả máy");
  });

  test("IT3-04 Tài khoản nền tảng không xem/lập/thu hồi cam kết dữ liệu cá nhân và không xem sự kiện cấp cứu; nhân viên chỉ thấy viện mình", async () => {
    const mine = await DataPrivacyConsent.create({ hospitalId: H, patientId: A.patient._id, signerName: "BN A", signedAt: new Date() });
    const other = await DataPrivacyConsent.create({ hospitalId: otherH, patientId: oid(), signerName: "BN viện khác", signedAt: new Date() });
    for (const who of ["admin", "system_admin"]) {
      expectStatus(await api(A[who], "GET", "/emr/privacy-consents"), 403, `${who} xem cam kết`);
      expectStatus(await api(A[who], "POST", "/emr/privacy-consents", { patientId: String(A.patient._id), signerName: "X", hospitalId: String(H) }), 403, `${who} lập cam kết`);
      expectStatus(await api(A[who], "POST", `/emr/privacy-consents/${mine._id}/revoke`, { revokeType: "fully", reason: "x" }), 403, `${who} thu hồi cam kết`);
      for (const url of ["/api/v1/emergency/alerts", "/api/v1/emergency/active-events", "/api/v1/emergency/history", "/api/v1/emergency/alerts/history"]) {
        expectStatus(await api(A[who], "GET", url), 403, `${who} ${url}`);
      }
      expectStatus(await api(A[who], "POST", "/api/v1/emergency/trigger", { patientId: String(A.patient._id), reason: "x" }), 403, `${who} kích hoạt cấp cứu`);
    }
    expect((await DataPrivacyConsent.findById(mine._id).lean()).consentStatus === "fully_revoked").toBe(false);
    const listed = await api(A.doctor, "GET", "/emr/privacy-consents");
    expectStatus(listed, 200, "bác sĩ xem cam kết viện mình");
    const ids = (listed.json.data || []).map((c) => String(c._id));
    expect([ids.includes(String(mine._id)), ids.includes(String(other._id))]).toEqual([true, false]);
    expect([403, 404].includes((await api(A.doctor, "POST", `/emr/privacy-consents/${other._id}/revoke`, { revokeType: "fully", reason: "x" })).status)).toBe(true); // viện khác
    expect((await DataPrivacyConsent.findById(other._id).lean()).consentStatus === "fully_revoked").toBe(false);
    expectStatus(await api(A.hospital_admin, "GET", "/api/v1/emergency/alerts"), 200, "BGĐ xem banner cấp cứu");
    expectStatus(await api(A.nurse, "GET", "/api/v1/emergency/history"), 200, "điều dưỡng xem lịch sử cấp cứu");
  });

  test("IT4-01 Tài khoản nền tảng không đọc dữ liệu bệnh nhân qua module lâm sàng (bệnh nhân, lượt khám, chuyển viện, đồng thuận, bình duyệt, phân công, thuốc)", async () => {
    const visit = await Visit.create({ hospitalId: H, patientId: A.patient._id, doctorId: A.doctor._id, status: "đang chờ", reason: "Đau đầu" });
    const tf = await TransferForm.create({ hospitalId: H, patient_id: A.patient._id, doctor_name: "BS", transferNo: `CV-${String(oid()).slice(-6)}`, status: "draft" });
    const urls = ["/api/patients/", `/api/patients/${A.patient._id}`, `/api/v1/visits/${visit._id}`, "/api/v1/transfers/", `/api/v1/transfers/${tf._id}`,
      `/api/v1/contrast-consents/visit/${visit._id}`, "/api/v1/peer-reviews/", "/api/v1/assignments/", "/api/drugs/"];
    for (const who of ["admin", "system_admin"]) {
      for (const url of urls) {
        const r = await api(A[who], "GET", url);
        expectStatus(r, 403, `${who} ${url}`);
        expect(r.text.includes(String(A.patient._id)) || r.text.includes("patient")).toBe(false);
      }
      expectStatus(await api(A[who], "PUT", `/api/v1/visits/${visit._id}/service-order`, { services: ["Chụp MRI sọ não"], diagnosis: "x" }), 403, `${who} chỉ định dịch vụ`);
    }
    // gốc rò rỉ: hàm kiểm tra quyền với bệnh nhân không còn ngoại lệ cho tài khoản nền tảng
    expect(await checkPatientTenancy(String(A.patient._id), { role: "admin", hospitalId: null, id: String(A.admin._id) })).toBe(null);
    expect(Boolean(await checkPatientTenancy(String(A.patient._id), { role: "doctor", hospitalId: String(H), id: String(A.doctor._id) }))).toBe(true);
    // nhân viên cùng viện vẫn dùng bình thường
    expectStatus(await api(A.doctor, "GET", `/api/patients/${A.patient._id}`), 200, "bác sĩ xem bệnh nhân viện mình");
    expectStatus(await api(A.doctor, "GET", `/api/v1/visits/${visit._id}`), 200, "bác sĩ xem lượt khám");
  });

  test("IT4-02 BHYT và giường bệnh ngoài phạm vi đồ án: API tắt (404) với mọi vai trò", async () => {
    for (const who of ["receptionist", "hospital_admin", "admin"]) {
      expectStatus(await api(A[who], "GET", "/api/v1/bhyt/active-cards"), 404, `${who} BHYT`);
      expectStatus(await api(A[who], "GET", `/api/v1/bhyt/${A.patient._id}`), 404, `${who} BHYT bệnh nhân`);
      expectStatus(await api(A[who], "GET", "/api/v1/hospital-beds/"), 404, `${who} giường bệnh`);
    }
  });

  test("IT4-03 Chuyển viện: trưởng khoa, CĐHA xem được danh sách viện mình (trước đây 403 bị nuốt); KTV XN không; viện khác không thấy theo id", async () => {
    const tf = await TransferForm.create({ hospitalId: H, patient_id: A.patient._id, doctor_name: "BS", transferNo: `CV-${String(oid()).slice(-6)}`, status: "draft" });
    for (const who of ["department_head", "radiologist", "doctor", "nurse", "receptionist", "hospital_admin"]) {
      const r = await api(A[who], "GET", "/api/v1/transfers/");
      expectStatus(r, 200, `${who} xem chuyển viện`);
      expect(r.text.includes(String(tf._id))).toBe(true);
    }
    expectStatus(await api(A.lab_technician, "GET", "/api/v1/transfers/"), 403, "KTV xét nghiệm xem chuyển viện");
    expect([403, 404].includes((await api(A.doctorOther, "GET", `/api/v1/transfers/${tf._id}`)).status)).toBe(true);
    expectStatus(await api(A.doctor, "GET", `/api/v1/transfers/${tf._id}`), 200, "bác sĩ cùng viện xem chi tiết");
  });

  test("IT4-04 Bệnh án: trưởng khoa thấy đủ, CĐHA/KTV XN/dược sĩ thấy phần cần cho nghiệp vụ (trước đây nhận object rỗng)", async () => {
    const rec = await MedicalRecord.create({ hospitalId: H, patientId: `BN-SEG-${String(oid()).slice(-6)}`, patientName: "BN lọc trường", age: 50, diagnosis: "U màng não",
      treatmentPlan: "Phẫu thuật", doctorInCharge: "BS", psychiatricNotes: "ghi chú tâm thần", allergies: ["Iod"] });
    const read = async (who) => (await api(A[who], "GET", `/emr/records/${rec._id}`)).json?.data || {};
    const dh = await read("department_head");
    expect([dh.patientName, dh.diagnosis, dh.treatmentPlan, dh.psychiatricNotes]).toEqual(["BN lọc trường", "U màng não", "Phẫu thuật", "ghi chú tâm thần"]);
    const rad = await read("radiologist");
    expect([rad.patientName, rad.diagnosis, rad.psychiatricNotes === undefined, Array.isArray(rad.allergies)]).toEqual(["BN lọc trường", "U màng não", true, true]);
    const lab = await read("lab_technician");
    expect([lab.patientName, lab.diagnosis, lab.treatmentPlan === undefined]).toEqual(["BN lọc trường", "U màng não", true]);
    const ph = await read("pharmacist");
    expect([ph.patientName, Array.isArray(ph.allergies), ph.psychiatricNotes === undefined]).toEqual(["BN lọc trường", true, true]);
  });

  test("IT4-06 Kê đơn từ bệnh án điện tử bằng mã y tế (BN...) như màn EMR gọi: tạo được và xem lại được (trước đây 400)", async () => {
    const medicalId = `BN-RX-${String(oid()).slice(-6)}`;
    const pt = await mk("patient", H, "BN kê đơn");
    await User.updateOne({ _id: pt._id }, { $set: { "profile.medicalId": medicalId } });
    const body = { diagnosis: "U màng não", drugs: [{ name: "Paracetamol 500mg", quantity: 10, unit: "Viên", dosage: "1 viên khi đau" }], aiConsultation: "Không dùng AI" };
    const created = await api(A.doctor, "POST", `/api/patients/${medicalId}/prescriptions`, body);
    if (![200, 201].includes(created.status)) throw new Error(`kê đơn bằng mã y tế: ${created.status} — ${created.text.slice(0, 300)}`);
    const list = await api(A.doctor, "GET", `/api/patients/${medicalId}/prescriptions`);
    expectStatus(list, 200, "xem đơn thuốc bằng mã y tế");
    expect((list.json.data || []).some((p) => String(p.patient_id) === String(pt._id) && p.diagnosis === "U màng não")).toBe(true);
    expectStatus(await api(A.doctorOther, "GET", `/api/patients/${medicalId}/prescriptions`), 403, "bác sĩ viện khác xem đơn thuốc");
  });

  test("IT4-05 Trưởng khoa quét được mã chia sẻ bệnh án; danh mục chia sẻ ghi huyết áp dạng tâm thu/tâm trương", async () => {
    const redeem = await api(A.department_head, "POST", "/api/v1/shared-records/redeem-staff", { qrToken: "khong-hop-le" });
    expect(redeem.status !== 403).toBe(true);
    await VitalSign.create({ hospitalId: H, patient_id: A.patient._id, pulse: 76, blood_pressure: { systolic: 128, diastolic: 82 }, spo2: 98, recorded_at: new Date() });
    const cat = await api(A.patient, "GET", "/api/v1/patient/record-shares/catalog");
    expectStatus(cat, 200, "bệnh nhân xem danh mục chia sẻ");
    expect(cat.text.includes("[object Object]")).toBe(false);
    expect(cat.text.includes("huyết áp 128/82")).toBe(true);
  });
});
