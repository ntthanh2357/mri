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
import { signUploadPath } from "../middlewares/uploadSignature.middleware.js";
import { CareSheet } from "../modules/emr/models/careSheet.model.js";
import { Task } from "../models/task.model.js";
import { PatientProfile } from "../models/patientProfile.model.js";

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
    // đường dẫn tệp trong body phải là link đã ký do máy chủ cấp (chống signing oracle)
    const body = { visitId: String(visit._id), imageUrl: signUploadPath("/uploads/e2e_slice.png"), requestAiAnalysis: false };
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
  test("IT5-01 Phiếu chăm sóc: không tự ghi GCS 15/đồng tử 2.5mm/thể tích khi điều dưỡng chưa đánh giá; GCS thiếu thành phần bị từ chối", async () => {
    const record = await MedicalRecord.create({ hospitalId: H, patientId: `BN-CS-${String(oid()).slice(-6)}`, patientName: "BN Chăm sóc", gender: "Nam", diagnosis: "U não" });
    const vitals = { pulse: 88, bloodPressure: "130/85", temperature: 37.2, respiratoryRate: 20, spo2: 96, progressNotes: "Lơ mơ nhẹ", careActions: "Theo dõi", nurse: "ĐD A" };
    const url = `/emr/records/${record._id}/care-sheets`;
    const only = await api(A.nurse, "POST", url, vitals);
    if (![200, 201].includes(only.status)) throw new Error(`phiếu chỉ sinh hiệu: ${only.status} — ${only.text.slice(0, 200)}`);
    const saved = await CareSheet.findOne({ medicalRecordId: record._id }).setOptions({ bypassTenancy: true }).lean();
    expect(saved.glasgow?.totalScore === undefined && saved.glasgow?.classification === undefined).toBe(true);
    expect(saved.pupils?.leftSize === undefined && saved.pupils?.shape === undefined).toBe(true);
    expect(saved.surgicalDrainage?.condition === undefined && saved.surgicalDrainage?.volume === undefined).toBe(true);
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, glasgow: { eye: 1 } }), 400, "GCS chỉ có mở mắt");
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, glasgow: { eye: 4, verbal: 5 } }), 400, "GCS thiếu vận động (không được coi là đủ)");
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, pupils: { leftSize: 3 } }), 400, "đồng tử một bên");
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, surgicalDrainage: { site: "EVD" } }), 400, "dẫn lưu không thể tích");
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, fluidInfusions: [{ fluidName: "Mannitol 20%" }] }), 400, "dịch truyền không thể tích");
    expectStatus(await api(A.nurse, "POST", url, { ...vitals, careLevel: 7 }), 400, "cấp chăm sóc ngoài 1-3");
    const full = await api(A.nurse, "POST", url, { ...vitals, careLevel: 1, glasgow: { eye: 3, verbal: 4, motor: 5 }, pupils: { leftSize: 3, rightSize: 4, leftLightReflex: "chậm", rightLightReflex: "+" } });
    if (![200, 201].includes(full.status)) throw new Error(`phiếu đủ GCS: ${full.status} — ${full.text.slice(0, 200)}`);
    const last = await CareSheet.findOne({ medicalRecordId: record._id, careLevel: 1 }).setOptions({ bypassTenancy: true }).lean();
    expect(last.glasgow.totalScore).toBe(12);
    expect(last.glasgow.classification).toBe("Hôn mê vừa");
    expect(last.pupils.rightSize).toBe(4);
  });

  test("IT5-02 Điều dưỡng mở bệnh nhân từ bệnh án (mã y tế BN...): xem được dị ứng/liên hệ khẩn cấp, không tạo hồ sơ theo mã y tế", async () => {
    const medicalId = `BN-ID-${String(oid()).slice(-6)}`;
    const pt = await mk("patient", H, "BN dị ứng");
    await User.updateOne({ _id: pt._id }, { $set: { "profile.medicalId": medicalId } });
    const r = await api(A.nurse, "GET", `/api/v1/patient/profile/identity?patientId=${medicalId}`);
    expectStatus(r, 200, "điều dưỡng xem thông tin an toàn bằng mã y tế");
    expect(String(r.json.data.userId)).toBe(String(pt._id));
    expect(await PatientProfile.countDocuments({ userId: medicalId }).setOptions({ bypassTenancy: true }).catch(() => 0)).toBe(0);
    expectStatus(await api(A.doctorOther, "GET", `/api/v1/patient/profile/identity?patientId=${medicalId}`), 403, "viện khác bằng mã y tế");
    expectStatus(await api(A.nurse, "GET", `/api/v1/visits/pre-screening/latest?patientId=${medicalId}`), 200, "điều dưỡng xem sàng lọc trước khám bằng mã y tế");
    expectStatus(await api(A.doctorOther, "GET", `/api/v1/visits/pre-screening/latest?patientId=${medicalId}`), 404, "viện khác xem sàng lọc bằng mã y tế");
  });

  test("IT5-03 Công việc ca trực: bước đã giao cho bác sĩ khác bị từ chối với lý do dễ hiểu (FE không hiện nút)", async () => {
    const visit = await Visit.create({ hospitalId: H, patientId: A.patient._id, doctorId: A.doctor2._id, status: "đang chờ", reason: "Khám" });
    const task = await Task.create({ hospitalId: H, visitId: visit._id, patientId: A.patient._id, stepNumber: 6, title: "Đọc phim", roleRequired: "doctor", status: "pending", assignedToUserId: A.doctor2._id });
    const r = await api(A.doctor, "PUT", `/api/v1/tasks/${task._id}/status`, { status: "in_progress" });
    expectStatus(r, 403, "bác sĩ cập nhật bước của bác sĩ khác");
    expect(/giao cho người khác/.test(r.json.message)).toBe(true);
    expectStatus(await api(A.doctor2, "PUT", `/api/v1/tasks/${task._id}/status`, { status: "in_progress" }), 200, "bác sĩ được giao");
  });

  test("IT5-04 Tạo bệnh án không gửi loại nhập viện: lưu Ngoại trú và hạn lưu trữ theo ngoại trú (trước đây phân loại nội trú)", async () => {
    const r = await api(A.nurse, "POST", "/emr/records", { patientId: `BN-RT-${String(oid()).slice(-6)}`, patientName: "BN lưu trữ" });
    if (![200, 201].includes(r.status)) throw new Error(`tạo bệnh án: ${r.status} — ${r.text.slice(0, 200)}`);
    const rec = await MedicalRecord.findById(r.json.data._id).setOptions({ bypassTenancy: true }).lean();
    expect(rec.admissionType).toBe("Ngoại trú");
    expect(rec.retentionCategory).toBe("ngoai_tru");
  });
  test("IT5-05 Hồ sơ bệnh nhân (định danh, dị ứng, lượt khám, nhắc thuốc): nhân viên vệ sinh/KTV xét nghiệm/dược sĩ không ghi đè được; vệ sinh, tài khoản nền tảng không đọc được", async () => {
    const pid = String(A.patient._id);
    const q = `?patientId=${pid}`;
    for (const r of ["cleaner", "admin", "system_admin"]) {
      expectStatus(await api(A[r], "GET", `/api/v1/patient/profile/identity${q}`), 403, `${r} đọc định danh bệnh nhân`);
      expectStatus(await api(A[r], "GET", `/api/v1/patient/records${q}`), 403, `${r} đọc lượt khám bệnh nhân`);
      expectStatus(await api(A[r], "GET", `/api/v1/patient/reminders/today${q}`), 403, `${r} đọc lịch uống thuốc`);
    }
    for (const r of ["cleaner", "lab_technician", "pharmacist", "technician", "radiologist"]) {
      expectStatus(await api(A[r], "PUT", `/api/v1/patient/profile/identity${q}`, { patientId: pid, drugAllergies: [] }), 403, `${r} ghi đè dị ứng/định danh`);
    }
    expectStatus(await api(A.pharmacist, "GET", `/api/v1/patient/profile/identity${q}`), 200, "dược sĩ xem dị ứng");
    expectStatus(await api(A.nurse, "PUT", `/api/v1/patient/profile/identity${q}`, { patientId: pid }), 200, "điều dưỡng cập nhật định danh");
    expectStatus(await api(A.patient, "GET", "/api/v1/patient/profile/identity"), 200, "bệnh nhân xem hồ sơ của mình");
  });
  test("IT5-06 Tên trên đơn thuốc / ghi đè cảnh báo lấy từ tài khoản đăng nhập (không theo tên client gửi); route xác thực tùy chọn không làm mất hồ sơ trong cache", async () => {
    const doc = await mk("doctor", H, "BS Thật Sự");
    // /auth/register dùng optionalProtect: trước đây ghi bản người dùng rút gọn (mất profile, email) vào cache dùng chung
    await api(doc, "POST", "/auth/register", {});
    const medicalId = `BN-NM-${String(oid()).slice(-6)}`;
    const pt = await mk("patient", H, "BN tên bác sĩ");
    await User.updateOne({ _id: pt._id }, { $set: { "profile.medicalId": medicalId } });
    const r = await api(doc, "POST", `/api/patients/${medicalId}/prescriptions`, { doctor_name: "BS Giả Mạo", diagnosis: "U màng não", drugs: [{ name: "Paracetamol 500mg", quantity: 5, unit: "Viên", dosage: "1 viên" }], aiConsultation: "Không dùng AI" });
    if (![200, 201].includes(r.status)) throw new Error(`kê đơn: ${r.status} — ${r.text.slice(0, 200)}`);
    expect(r.json.data.doctor_name).toBe("BS Thật Sự");
    const lock = await api(A.hospital_admin, "PUT", `/api/v1/hospital/staff/${A.cleaner._id}/toggle-lock`, {});
    expectStatus(lock, 200, "BGĐ khóa tài khoản nhân sự");
    const log = await AuditLog.findOne({ entityId: { $in: [String(A.cleaner._id), A.cleaner._id] }, details: /tài khoản nhân sự/ }).sort({ createdAt: -1 }).setOptions({ bypassTenancy: true }).lean();
    expect(Boolean(log)).toBe(true);
    expect(String(log.details).includes("undefined")).toBe(false);
    expect(String(log.details).includes(A.hospital_admin.email)).toBe(true);
    await api(A.hospital_admin, "PUT", `/api/v1/hospital/staff/${A.cleaner._id}/toggle-lock`, {});
  });

  test("IT5-07 Gói chuyển viện: chỉ đính kèm phim của đúng bệnh nhân (không lấy phim người trùng tên), bắt buộc nơi chuyển đến, không sinh số bệnh án", async () => {
    const same = "Nguyễn Văn Trùng Tên";
    const a = await mk("patient", H, same);
    const b = await mk("patient", H, same);
    await User.updateOne({ _id: a._id }, { $set: { "profile.fullName": same } });
    const imgB = await ImagingResult.create({ hospitalId: H, patientId: b._id, medicalId: `BN-B-${String(oid()).slice(-6)}`, patientName: same, birthYear: 1970, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "Ngoại thần kinh", diagnosis: "U não", procedure: "MRI", findings: "x", conclusion: "y", radiologist: "z", reportDate: new Date().toISOString(), imagingType: "MRI", isSigned: false });
    const body = { patient_id: String(a._id), diagnosis: "U não", transferTo: "BV Trung ương Huế" };
    expectStatus(await api(A.doctor, "POST", "/api/v1/transfers", { ...body, imagingResultId: String(imgB._id) }), 400, "đính kèm phim của bệnh nhân khác");
    expectStatus(await api(A.doctor, "POST", "/api/v1/transfers", { patient_id: String(a._id), diagnosis: "U não" }), 400, "không có nơi chuyển đến");
    const ok = await api(A.doctor, "POST", "/api/v1/transfers", body);
    if (![200, 201].includes(ok.status)) throw new Error(`tạo gói chuyển viện: ${ok.status} — ${ok.text.slice(0, 200)}`);
    const tf = await TransferForm.findOne({ patient_id: a._id }).setOptions({ bypassTenancy: true }).lean();
    expect(tf.imagingResultId == null).toBe(true);
    expect(tf.hospitalNo).toBe("");
    expect(tf.transferTo).toBe("BV Trung ương Huế");
  });
  test("IT6-01 OTP lưu dạng HMAC, không lộ qua GET /admin/users; mã đúng vẫn đặt lại được mật khẩu", async () => {
    const u = await mk("patient", H, "BN quên mật khẩu");
    const fp = await api(null, "POST", "/auth/forgot-password", { email: u.email });
    expectStatus(fp, 200, "xin OTP quên mật khẩu");
    const code = fp.json.debugOtp;
    expect(/^\d{6}$/.test(String(code))).toBe(true);
    const raw = await User.collection.findOne({ _id: u._id });
    expect(raw.otpCode !== code && /^[a-f0-9]{64}$/.test(raw.otpCode)).toBe(true);
    for (const r of ["admin", "system_admin"]) {
      const list = await api(A[r], "GET", "/admin/users");
      expectStatus(list, 200, `${r} xem danh sách người dùng`);
      expect(list.text.includes(code) || list.text.includes(raw.otpCode) || list.text.includes("otpCode") || list.text.includes("otp2FACode")).toBe(false);
    }
    expectStatus(await api(null, "POST", "/auth/verify-otp", { email: u.email, otp: "000000", newPassword: "MatKhau2026" }), 400, "OTP sai");
    expectStatus(await api(null, "POST", "/auth/verify-otp", { email: u.email, otp: code, newPassword: "MatKhau2026" }), 200, "OTP đúng đặt lại mật khẩu");
  });

  test("IT6-02 Mật khẩu tự đặt: ≥ 8 ký tự, có chữ và số (đăng ký, đổi, đặt lại, quản trị tạo tài khoản)", async () => {
    const base = { name: "BN Mật khẩu", role: "patient" };
    for (const pw of ["abc123", "abcdefgh", "12345678"]) {
      const r = await api(null, "POST", "/auth/register", { ...base, email: `e2e_pw_${oid()}@e2e.local`, password: pw });
      expectStatus(r, 400, `đăng ký mật khẩu yếu ${pw}`);
      expect(/8.*ký tự.*chữ và số/.test(r.json.message)).toBe(true);
    }
    expect([200, 201].includes((await api(null, "POST", "/auth/register", { ...base, email: `e2e_pw_${oid()}@e2e.local`, password: "Benhnhan2026" })).status)).toBe(true);
    expectStatus(await api(A.nurse, "PUT", "/auth/password", { currentPassword: "x", newPassword: "short1" }), 400, "đổi sang mật khẩu yếu");
    const u = await mk("patient", H, "BN đặt lại yếu");
    const fp = await api(null, "POST", "/auth/forgot-password", { email: u.email });
    expectStatus(await api(null, "POST", "/auth/verify-otp", { email: u.email, otp: fp.json.debugOtp, newPassword: "khongcoso" }), 400, "đặt lại mật khẩu không có số");
    expectStatus(await api(A.admin, "POST", "/admin/users", { email: `e2e_adm_${oid()}@e2e.local`, password: "1234", name: "NV", role: "patient" }), 400, "quản trị tạo tài khoản mật khẩu yếu");
  });

  test("IT6-03 Hóa đơn kẹt trừ kho: 'hủy và hoàn' chỉ mở yêu cầu, người khác duyệt, ghi đúng số tiền; không trừ kho lại khi đang chờ", async () => {
    const inv = await Invoice.create({ hospitalId: H, patientId: A.patient._id, totalAmount: 50_000_000, patientPayAmount: 50_000_000, status: "đang xử lý", paidAt: new Date(), paymentMethod: "vietqr",
      stockDeductionStatus: "SHORTAGE_FLAGGED", items: [{ description: "Thuốc hóa trị", amount: 50_000_000, quantity: 1, type: "drug" }] });
    const r = await api(A.pharmacist, "POST", `/api/v1/invoices/${inv._id}/resolve-processing`, { action: "cancel_refund", note: "Kho không cấp được" });
    expectStatus(r, 202, "dược sĩ lập yêu cầu hoàn");
    let d = await Invoice.findById(inv._id).setOptions({ bypassTenancy: true }).lean();
    expect(d.status).toBe("đang xử lý");
    expect(d.refundApproval.approvalStatus).toBe("pending_second_approval");
    expectStatus(await api(A.pharmacist, "POST", `/api/v1/invoices/${inv._id}/resolve-processing`, { action: "retry_deduct" }), 409, "trừ kho lại khi đang chờ duyệt hoàn");
    const pending = await api(A.hospital_admin, "GET", "/api/v1/invoices/refund-requests/pending");
    expect((pending.json.requests || []).some((x) => String(x._id) === String(inv._id))).toBe(true);
    expectStatus(await api(A.receptionist, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {}), 403, "lễ tân duyệt khoản 50tr");
    const director = await mk("hospital_admin", H, "BGĐ duyệt hoàn kẹt kho"); // tài khoản riêng: không vướng giãn cách xin mã step-up của test khác
    const q = await api(director, "POST", "/auth/step-up/request", {});
    expectStatus(q, 200, "xin mã step-up");
    expectStatus(await api(director, "POST", "/auth/step-up/verify", { otp: q.json.debugOtp }), 200, "step-up");
    expectStatus(await api(director, "POST", `/api/v1/invoices/${inv._id}/refund/approve`, {}), 200, "BGĐ duyệt hoàn");
    d = await Invoice.findById(inv._id).setOptions({ bypassTenancy: true }).lean();
    expect(d.status).toBe("hoàn trả");
    expect(d.refundAmount).toBe(50_000_000);
  });

  test("IT6-04 Hoàn một phần rồi hoàn toàn bộ: chỉ hoàn phần còn lại, refundAmount cộng dồn (không hoàn trùng)", async () => {
    const inv = await Invoice.create({ hospitalId: H, patientId: A.patient._id, totalAmount: 500_000, patientPayAmount: 500_000, status: "đã thanh toán", paidAt: new Date(), paymentMethod: "tiền mặt",
      items: [{ description: "Khám A", amount: 300_000, quantity: 1, type: "exam" }, { description: "Khám B", amount: 200_000, quantity: 1, type: "exam" }] });
    expectStatus(await api(A.receptionist, "PUT", `/api/v1/invoices/${inv._id}/refund`, { refundReason: "Hủy khám A", itemsToRefund: [{ itemIndex: 0 }] }), 200, "hoàn một phần");
    expectStatus(await api(A.receptionist, "PUT", `/api/v1/invoices/${inv._id}/refund`, { refundReason: "Hủy nốt" }), 200, "hoàn toàn bộ phần còn lại");
    const d = await Invoice.findById(inv._id).setOptions({ bypassTenancy: true }).lean();
    expect(d.refundAmount).toBe(500_000);
    expect(d.status).toBe("hoàn trả");
    expect(String(d.notes).includes("200.000")).toBe(true);
  });

  test("IT6-05 Chống signing oracle: đường dẫn tệp chưa ký trong body bị từ chối (hồ sơ, kết quả chụp); link đã ký vẫn dùng được", async () => {
    const p = await api(A.patient, "PUT", "/auth/profile", { name: "/uploads/tep_cua_nguoi_khac.png" });
    expectStatus(p, 403, "đặt tên hồ sơ là đường dẫn tệp");
    expect(p.json.code).toBe("UPLOAD_LINK_INVALID");
    const visit = await Visit.create({ hospitalId: H, patientId: A.patient._id, doctorId: A.doctor._id, status: "đang chụp", mriOrder: { orderedAt: new Date(), region: "Não", mriStatus: "ordered" } });
    expectStatus(await api(A.technician, "POST", "/api/v1/imaging-results", { visitId: String(visit._id), images: ["/uploads/tep_cua_nguoi_khac.png"] }), 403, "KTV gửi ảnh chưa ký");
    expectStatus(await api(A.technician, "POST", "/api/v1/imaging-results", { visitId: String(visit._id), images: ["/uploads/a.png?exp=1&sig=abc"] }), 403, "link hết hạn/giả");
    const ok = await api(A.technician, "POST", "/api/v1/imaging-results", { visitId: String(visit._id), images: [signUploadPath("/uploads/e2e_signed.png")] });
    expect([200, 201].includes(ok.status)).toBe(true);
  });

  test("IT6-06 Đặt lịch tái khám B2C chỉ cho bệnh nhân; bác sĩ phải thuộc đúng cơ sở", async () => {
    for (const r of ["doctor", "admin", "system_admin", "receptionist"]) {
      expectStatus(await api(A[r], "POST", "/api/v1/patient-b2c/book-followup", { reason: "thử", hospitalId: String(H) }), 403, `${r} đặt lịch tái khám`);
    }
    expectStatus(await api(A.doctor, "GET", "/api/v1/patient-b2c/my-visits"), 403, "bác sĩ xem lịch sử khám B2C");
    expectStatus(await api(A.patient, "POST", "/api/v1/patient-b2c/book-followup", { reason: "thử", hospitalId: String(H), doctorId: String(A.doctorOther._id) }), 400, "chọn bác sĩ viện khác");
    // hospitalId trong body chỉ dùng cho bệnh nhân B2C chưa gắn viện (BUG-06): bệnh nhân gắn viện luôn đặt lịch tại viện của mình
    const b2c = await mk("patient", null, "BN B2C");
    expectStatus(await api(b2c, "POST", "/api/v1/patient-b2c/book-followup", { reason: "thử", hospitalId: String(oid()) }), 400, "cơ sở không tồn tại");
    expectStatus(await api(b2c, "POST", "/api/v1/patient-b2c/book-followup", { reason: "thử", hospitalId: "khong-phai-id" }), 400, "mã cơ sở sai định dạng");
    const ok = await api(A.patient, "POST", "/api/v1/patient-b2c/book-followup", { reason: "Tái khám sau mổ", hospitalId: String(H), doctorId: String(A.doctor._id) });
    expectStatus(ok, 201, "bệnh nhân đặt lịch đúng");
  });
  test("IT7-01 Giấy chuyển tuyến chỉ nhận trường nội dung; bệnh nhân, viện, viện nhận, trạng thái, người lập do máy chủ đặt", async () => {
    const pt = await mk("patient", H, "BN chuyển tuyến");
    const r = await api(A.doctor, "POST", `/api/patients/${pt._id}/transfer-forms`, {
      transferTo: "BV Trung ương Huế", diagnosis: "U màng não", clinicalSummary: "Tóm tắt",
      patient_id: String(A.patient._id), hospitalId: String(otherH), targetHospitalId: String(otherH),
      status: "accepted", acceptedByUserId: String(A.doctorOther._id), doctor_name: "Tên tự khai",
    });
    if (![200, 201].includes(r.status)) throw new Error(`lập giấy chuyển tuyến: ${r.status} — ${r.text.slice(0, 200)}`);
    const tf = await TransferForm.findById(r.json.data._id).setOptions({ bypassTenancy: true }).lean();
    expect(String(tf.patient_id)).toBe(String(pt._id));
    expect(String(tf.hospitalId)).toBe(String(H));
    expect(tf.targetHospitalId == null).toBe(true);
    expect(tf.status === "accepted").toBe(false);
    expect(tf.acceptedByUserId == null).toBe(true);
    expect(tf.doctor_name).toBe(A.doctor.profile.fullName);
    expect(tf.clinicalSummary).toBe("Tóm tắt");
    expectStatus(await api(A.doctor, "POST", `/api/patients/${pt._id}/transfer-forms`, { transferTo: "BV", diagnosis: "U", visitId: String(oid()) }), 400, "lượt khám không thuộc bệnh nhân");
  });

  test("IT7-02 Ký báo cáo CĐHA qua clinical-view ghi mã băm toàn vẹn như PUT /imaging/:id", async () => {
    const img = await ImagingResult.create({ hospitalId: H, medicalId: `BN-SIG-${String(oid()).slice(-6)}`, patientName: "BN ký", birthYear: 1980, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "Ngoại thần kinh", diagnosis: "U não", procedure: "MRI", findings: "Khối thùy trán", conclusion: "Chờ", radiologist: "Chưa ký", reportDate: new Date().toISOString(), imagingType: "MRI", isSigned: false });
    expectStatus(await api(A.radiologist, "POST", `/api/v1/clinical-view/imaging/${img._id}/sign`, { finalConclusion: "U thần kinh đệm độ II" }), 200, "CĐHA ký");
    const saved = await ImagingResult.findById(img._id).setOptions({ bypassTenancy: true }).lean();
    expect(saved.isSigned).toBe(true);
    expect(/^[a-f0-9]{64}$/.test(saved.digitalSignatureMetadata?.signedHash || "")).toBe(true);
    expect(saved.digitalSignatureMetadata.signatureType).toBe("internal_hash");
  });

  test("IT7-03 Chỉ định MRI khi hóa đơn khám đã thu: lập hóa đơn MRI riêng, cổng viện phí chặn tới khi đóng phí MRI", async () => {
    const { assertPaymentGateOpen } = await import("../services/visit.service.js");
    const pt = await mk("patient", H, "BN MRI sau khám");
    const visit = await Visit.create({ hospitalId: H, patientId: pt._id, doctorId: A.doctor._id, status: "đang khám", reason: "Đau đầu" });
    const exam = await Invoice.create({ hospitalId: H, patientId: pt._id, visitId: visit._id, totalAmount: 50_000, patientPayAmount: 50_000, status: "đã thanh toán", paidAt: new Date(), paymentMethod: "tiền mặt",
      items: [{ description: "Khám bệnh", amount: 50_000, quantity: 1, type: "exam" }] });
    await Visit.updateOne({ _id: visit._id }, { $set: { invoiceId: exam._id } });
    const order = await api(A.doctor, "PUT", `/api/v1/visits/${visit._id}/mri-order`, { region: "Não" });
    if (order.status !== 200) throw new Error(`chỉ định MRI: ${order.status} — ${order.text.slice(0, 200)}`);
    const mriInv = await Invoice.findOne({ visitId: visit._id, "items.type": "mri" }).setOptions({ bypassTenancy: true }).lean();
    expect(Boolean(mriInv)).toBe(true);
    expect(mriInv.status).toBe("chờ thanh toán");
    expect(String(mriInv._id) !== String(exam._id)).toBe(true);
    const fresh = await Visit.findById(visit._id).setOptions({ bypassTenancy: true });
    let gate = null;
    try { await assertPaymentGateOpen(fresh, { id: String(A.technician._id), role: "technician" }); } catch (err) { gate = err.statusCode; }
    expect(gate).toBe(402);
    await Invoice.updateOne({ _id: mriInv._id }, { $set: { status: "đã thanh toán", paidAt: new Date() } }).setOptions({ bypassTenancy: true });
    gate = null;
    try { await assertPaymentGateOpen(fresh, { id: String(A.technician._id), role: "technician" }); } catch (err) { gate = err.statusCode; }
    expect(gate).toBe(null);
    const again = await api(A.doctor, "PUT", `/api/v1/visits/${visit._id}/mri-order`, { region: "Não" });
    expect([200, 400, 409].includes(again.status)).toBe(true);
    expect(await Invoice.countDocuments({ visitId: visit._id, "items.type": "mri" }).setOptions({ bypassTenancy: true })).toBe(1);
  });
  test("IT8-01 Chuyển viện: chỉ tạo cho bệnh nhân viện mình; viện nhận phải khác viện gửi; chỉ viện nhận chấp nhận/từ chối", async () => {
    const foreign = await mk("patient", otherH, "BN viện khác");
    const own = await mk("patient", H, "BN viện mình");
    const base = { diagnosis: "U não", transferTo: "BV tuyến trên" };
    expectStatus(await api(A.doctor, "POST", "/api/v1/transfers", { ...base, patient_id: String(foreign._id), targetHospitalId: String(otherH) }), 404, "tạo phiếu cho bệnh nhân viện khác");
    expectStatus(await api(A.doctor, "POST", "/api/v1/transfers", { ...base, patient_id: String(own._id), targetHospitalId: String(H) }), 400, "viện nhận trùng viện gửi");
    const created = await api(A.doctor, "POST", "/api/v1/transfers", { ...base, patient_id: String(own._id), targetHospitalId: String(otherH) });
    expectStatus(created, 201, "tạo phiếu chuyển viện hợp lệ");
    const id = String(created.json.data.transferForm._id);
    expectStatus(await api(A.doctor, "PUT", `/api/v1/transfers/${id}/accept`, {}), 403, "viện gửi tự chấp nhận");
    expectStatus(await api(A.hospital_admin, "PUT", `/api/v1/transfers/${id}/reject`, {}), 403, "viện gửi tự từ chối");
    expectStatus(await api(A.doctorOther, "PUT", `/api/v1/transfers/${id}/accept`, {}), 200, "viện nhận chấp nhận");
    const after = await TransferForm.findById(id).setOptions({ bypassTenancy: true }).lean();
    expect(String(after.hospitalId)).toBe(String(H)); // viện gửi giữ nguyên (tenancy plugin trước đây ghi đè khi viện nhận lưu)
    expect(after.status).toBe("accepted");
    expectStatus(await api(A.doctorOther, "PUT", `/api/v1/transfers/${id}/reject`, {}), 409, "xử lý lại phiếu đã chấp nhận");
  });

  test("IT8-02 Sao lưu theo viện ghi tệp mã hóa AES-256-GCM (không còn JSON bản rõ); giải mã lại đúng, sửa tệp thì phát hiện", async () => {
    const fs = await import("fs");
    const { readEncryptedBackup } = await import("../utils/encryptedBackup.util.js");
    const marker = `BN-Sao-Luu-${String(oid()).slice(-6)}`;
    const pt = await mk("patient", H, marker);
    await Visit.create({ hospitalId: H, patientId: pt._id, doctorId: A.doctor._id, status: "đang chờ", reason: `Khám ${marker}` });
    const r = await api(A.system_admin, "POST", `/admin/hospitals/${H}/backup`, {});
    expectStatus(r, 200, "sao lưu viện");
    const file = path.join(BE_DIR, "src", "secure_backups", r.json.fileName) // admin.controller: __dirname/../../secure_backups;
    const raw = fs.readFileSync(file, "utf8");
    try {
      expect(raw.includes(marker)).toBe(false);
      expect(JSON.parse(raw).format).toBe("neuroscan-encrypted-backup-v1");
      expect(JSON.parse(raw).meta.hospitalId).toBe(String(H));
      const { payload } = readEncryptedBackup(file);
      expect(payload.visits.some((v) => String(v.reason).includes(marker))).toBe(true);
      const env = JSON.parse(raw);
      const flipped = Buffer.from(env.data, "base64"); flipped[0] ^= 1;
      fs.writeFileSync(file, JSON.stringify({ ...env, data: flipped.toString("base64") }));
      let tampered = false;
      try { readEncryptedBackup(file); } catch { tampered = true; }
      expect(tampered).toBe(true);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  test("IT8-03 Khóa mã hóa tệp: production thiếu FILE_ENCRYPTION_KEY thì dừng, không dùng khóa công khai", async () => {
    const { getEncryptionKey } = await import("../utils/cryptoStorage.util.js");
    const saved = { env: process.env.NODE_ENV, key: process.env.FILE_ENCRYPTION_KEY };
    try {
      process.env.NODE_ENV = "production";
      delete process.env.FILE_ENCRYPTION_KEY;
      let threw = false;
      try { getEncryptionKey(); } catch { threw = true; }
      expect(threw).toBe(true);
      process.env.FILE_ENCRYPTION_KEY = "ab".repeat(32);
      expect(getEncryptionKey().length).toBe(32);
    } finally {
      process.env.NODE_ENV = saved.env;
      if (saved.key === undefined) delete process.env.FILE_ENCRYPTION_KEY; else process.env.FILE_ENCRYPTION_KEY = saved.key;
    }
  });
  test("IT8-04 Tenancy plugin: lưu bản ghi đã có trong phiên của viện khác không đổi viện của bản ghi; bản ghi mới vẫn nhận viện theo phiên", async () => {
    const { tenantStorage } = await import("../middlewares/tenant.middleware.js");
    const tf = await TransferForm.create({ hospitalId: H, patient_id: A.patient._id, transferTo: "BV khác", diagnosis: "U", targetHospitalId: otherH });
    await tenantStorage.run({ hospitalId: String(otherH), role: "doctor", userId: String(A.doctorOther._id) }, async () => {
      const doc = await TransferForm.findById(tf._id).setOptions({ bypassTenancy: true });
      doc.clinicalSummary = "Viện nhận ghi chú";
      await doc.save();
      const fresh = await TransferForm.create({ patient_id: A.patient._id, transferTo: "BV", diagnosis: "U" });
      expect(String(fresh.hospitalId)).toBe(String(otherH));
    });
    const saved = await TransferForm.findById(tf._id).setOptions({ bypassTenancy: true }).lean();
    expect(String(saved.hospitalId)).toBe(String(H));
    expect(saved.clinicalSummary).toBe("Viện nhận ghi chú");
  });
  test("IT8-05 BHYT: 10 lần áp cùng một thẻ cho một hóa đơn chạy song song không cộng trùng lũy kế (QA C6)", async () => {
    const { applyBhytCore } = await import("../modules/billing/bhytApply.service.js");
    const { BhytInfo } = await import("../modules/billing/models/bhytInfo.model.js");
    const pt = await mk("patient", H, "BN BHYT song song");
    const card = await BhytInfo.collection.insertOne({ hospitalId: H, patientId: pt._id, cardNumber: "enc", coverageRate: 80, isValid: true, isActive: true, manuallyVerified: true,
      expiresAt: new Date(Date.now() + 86400000 * 100), usedThisYear: 0, annualCap: 72000000, createdAt: new Date(), updatedAt: new Date() });
    const inv = await Invoice.create({ hospitalId: H, patientId: pt._id, totalAmount: 1_000_000, status: "chờ thanh toán", items: [{ description: "Chụp MRI", amount: 1_000_000, quantity: 1, type: "mri" }] });
    const results = await Promise.all(Array.from({ length: 10 }, async () => {
      const doc = await Invoice.findById(inv._id).setOptions({ bypassTenancy: true });
      const c = await BhytInfo.findById(card.insertedId).setOptions({ bypassTenancy: true });
      return applyBhytCore(doc, { bhyt: c, treatmentType: "outpatient" });
    }));
    const saved = await BhytInfo.collection.findOne({ _id: card.insertedId });
    const savedInv = await Invoice.findById(inv._id).setOptions({ bypassTenancy: true }).lean();
    expect(saved.usedThisYear).toBe(800_000); // 80% × 1.000.000 đúng một lần
    expect(savedInv.bhytInfo.bhytAmount).toBe(800_000);
    expect(results.filter((r) => r.ok).length >= 1).toBe(true);
    expect(results.every((r) => r.ok || ["APPLY_IN_PROGRESS", "CAP_CHANGED"].includes(r.code))).toBe(true);
    // Tái hiện đúng khe hở của C6: request B đọc hóa đơn TRƯỚC khi A lưu, đọc thẻ SAU khi A đã cộng lũy kế
    const pt2 = await mk("patient", H, "BN BHYT khe hở");
    const card2 = await BhytInfo.collection.insertOne({ hospitalId: H, patientId: pt2._id, cardNumber: "enc", coverageRate: 80, isValid: true, isActive: true, manuallyVerified: true,
      expiresAt: new Date(Date.now() + 86400000 * 100), usedThisYear: 0, annualCap: 72000000, createdAt: new Date(), updatedAt: new Date() });
    const inv2 = await Invoice.create({ hospitalId: H, patientId: pt2._id, totalAmount: 1_000_000, status: "chờ thanh toán", items: [{ description: "Chụp MRI", amount: 1_000_000, quantity: 1, type: "mri" }] });
    const staleInvoice = await Invoice.findById(inv2._id).setOptions({ bypassTenancy: true }); // đọc trước, chưa có BHYT
    const first = await applyBhytCore(await Invoice.findById(inv2._id).setOptions({ bypassTenancy: true }), { bhyt: await BhytInfo.findById(card2.insertedId).setOptions({ bypassTenancy: true }) });
    expect(first.ok).toBe(true);
    await applyBhytCore(staleInvoice, { bhyt: await BhytInfo.findById(card2.insertedId).setOptions({ bypassTenancy: true }) });
    expect((await BhytInfo.collection.findOne({ _id: card2.insertedId })).usedThisYear).toBe(800_000);
    // áp lại tuần tự cho cùng hóa đơn vẫn không cộng dồn
    const again = await applyBhytCore(await Invoice.findById(inv._id).setOptions({ bypassTenancy: true }), { bhyt: await BhytInfo.findById(card.insertedId).setOptions({ bypassTenancy: true }) });
    expect(again.ok).toBe(true);
    expect((await BhytInfo.collection.findOne({ _id: card.insertedId })).usedThisYear).toBe(800_000);
  });

  test("IT9-01 Chuyển viện: viện nhận thấy phiếu gửi tới mình (danh sách incoming + chi tiết kèm ca chụp); viện thứ ba không thấy", async () => {
    const pt = await mk("patient", H, "BN chuyển tới viện nhận");
    const medicalId = `BN-TR-${String(oid()).slice(-6)}`; // ca chụp gắn bệnh nhân qua mã bệnh nhân
    await User.updateOne({ _id: pt._id }, { $set: { "profile.medicalId": medicalId } });
    const img = await ImagingResult.create({ hospitalId: H, medicalId, patientName: "BN chuyển", birthYear: 1970, gender: "Nam", address: "HN", orderDate: new Date().toISOString(),
      orderingDoctor: "BS", orderingDepartment: "Ngoại thần kinh", diagnosis: "U não", procedure: "MRI", findings: "Khối thùy thái dương", conclusion: "Theo dõi u", radiologist: "BS CĐHA", reportDate: new Date().toISOString(), imagingType: "MRI", isSigned: true });
    const created = await api(A.doctor, "POST", "/api/v1/transfers", { patient_id: String(pt._id), targetHospitalId: String(otherH), diagnosis: "U não", transferTo: "BV E2E khác", imagingResultId: String(img._id) });
    expectStatus(created, 201, "tạo phiếu chuyển viện");
    const id = String(created.json.data.transferForm._id);
    const ids = (r) => (Array.isArray(r.json?.data) ? r.json.data : []).map((t) => String(t._id));

    const incoming = await api(A.doctorOther, "GET", "/api/v1/transfers?type=incoming");
    expectStatus(incoming, 200, "viện nhận xem danh sách incoming");
    expect(ids(incoming).includes(id)).toBe(true);
    const detail = await api(A.doctorOther, "GET", `/api/v1/transfers/${id}`);
    expectStatus(detail, 200, "viện nhận xem chi tiết phiếu");
    expect(String(detail.json.data.imagingResultId?._id)).toBe(String(img._id));

    // viện gửi: phiếu nằm ở outgoing, không lẫn vào incoming của chính mình
    expect(ids(await api(A.doctor, "GET", "/api/v1/transfers")).includes(id)).toBe(true);
    expect(ids(await api(A.doctor, "GET", "/api/v1/transfers?type=incoming")).includes(id)).toBe(false);
    expectStatus(await api(A.doctor, "GET", `/api/v1/transfers/${id}`), 200, "viện gửi xem chi tiết");

    // viện thứ ba: không thấy ở đâu cả
    const thirdH = (await Hospital.create({ name: "BV E2E thứ ba", code: `E2E3-${oid()}` }))._id;
    const third = await mk("doctor", thirdH, "BS viện thứ ba");
    expect(ids(await api(third, "GET", "/api/v1/transfers?type=incoming")).includes(id)).toBe(false);
    expectStatus(await api(third, "GET", `/api/v1/transfers/${id}`), 404, "viện thứ ba xem chi tiết");
    expectStatus(await api(A.doctorOther, "GET", "/api/v1/transfers/khong-phai-id"), 404, "mã phiếu sai định dạng");
  });

  test("IT9-02 Đồng thuận cản quang: chỉ bệnh nhân chủ phiếu hoặc nhân viên lâm sàng ghi nhận chữ ký; không ký đè", async () => {
    const { ConsentForm } = await import("../modules/emr/models/consentForm.model.js");
    const owner = await mk("patient", H, "BN chủ phiếu");
    const form = (patientId) => ConsentForm.create({ hospitalId: H, medicalRecordId: oid(), patientId, visitId: oid(), procedureName: "Tiêm thuốc cản quang Gadolinium",
      risks: "Dị ứng thuốc cản quang", doctorExplanation: "Đã giải thích" });
    const f1 = await form(owner._id);
    const sign = (actor, id, name = "Nguyễn Văn Chủ") => api(actor, "POST", `/api/v1/contrast-consents/${id}/sign-patient`, { patientName: name });
    for (const role of ["receptionist", "pharmacist", "hospital_admin", "lab_technician"]) expectStatus(await sign(A[role], f1._id), 403, `${role} ký thay bệnh nhân`);
    expectStatus(await sign(A.patient, f1._id, "Người khác"), 404, "bệnh nhân khác cùng viện ký phiếu không phải của mình");
    expect((await ConsentForm.findById(f1._id).setOptions({ bypassTenancy: true }).lean()).patientSigned).toBe(false);
    expectStatus(await sign(owner, f1._id), 200, "bệnh nhân chủ phiếu tự ký");
    expectStatus(await sign(A.nurse, f1._id, "Ghi đè"), 409, "ký đè phiếu đã ký");
    expect((await ConsentForm.findById(f1._id).setOptions({ bypassTenancy: true }).lean()).patientSignature).toBe("Nguyễn Văn Chủ");
    const f2 = await form(owner._id);
    expectStatus(await sign(A.technician, f2._id, "Đại diện gia đình"), 200, "KTV ghi nhận chữ ký tại phòng chụp");
    const f3 = await form(owner._id);
    const both = await Promise.all([sign(A.nurse, f3._id, "Lần A"), sign(A.technician, f3._id, "Lần B")]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  test("IT9-03 Bình duyệt: kết luận cuối cần ≥1 lần đọc, chỉ bác sĩ, không phải bác sĩ đọc ban đầu, chỉ một kết luận", async () => {
    const { PeerReview } = await import("../models/peerReview.model.js");
    const review = () => PeerReview.create({ hospitalId: H, imagingResultId: oid(), requestType: "conflict", primaryDoctorId: A.doctor._id, reviewerIds: [A.radiologist._id], status: "in_review" });
    const fin = (actor, id, text = "Kết luận thống nhất: u thần kinh đệm") => api(actor, "PUT", `/api/v1/peer-reviews/${id}/finalize`, { finalConclusion: text });
    const r1 = await review();
    expectStatus(await fin(A.department_head, r1._id), 409, "kết luận khi chưa có lần đọc nào");
    expectStatus(await api(A.radiologist, "POST", `/api/v1/peer-reviews/${r1._id}/submit-reading`, { conclusion: "Nghi u bậc cao", malignancyLevel: "high" }), 200, "đọc độc lập");
    expectStatus(await fin(A.hospital_admin, r1._id), 403, "BGĐ ra kết luận chuyên môn");
    expectStatus(await fin(A.doctor, r1._id), 403, "bác sĩ đọc ban đầu tự kết luận");
    expectStatus(await fin(A.department_head, r1._id), 200, "trưởng khoa kết luận");
    expectStatus(await fin(A.doctor2, r1._id), 400, "kết luận lần hai");
    const saved = await PeerReview.findById(r1._id).setOptions({ bypassTenancy: true }).lean();
    expect(saved.status).toBe("completed");
    expect(String(saved.finalBy)).toBe(String(A.department_head._id));

    const r2 = await review();
    await PeerReview.updateOne({ _id: r2._id }, { $set: { status: "cancelled", readings: [{ reviewerId: A.radiologist._id, conclusion: "U", malignancyLevel: "high", submittedAt: new Date() }] } }).setOptions({ bypassTenancy: true });
    expectStatus(await fin(A.department_head, r2._id), 400, "kết luận phiếu đã hủy");

    const r3 = await review();
    await PeerReview.updateOne({ _id: r3._id }, { $set: { status: "awaiting_final", readings: [{ reviewerId: A.radiologist._id, conclusion: "U", malignancyLevel: "high", submittedAt: new Date() }] } }).setOptions({ bypassTenancy: true });
    const both = await Promise.all([fin(A.department_head, r3._id, "KL A"), fin(A.doctor2, r3._id, "KL B")]);
    expect(both.filter((r) => r.status === 200).length).toBe(1);
  });

  test("IT9-04 Drive: sao lưu/dọn tệp/tạo thư mục trả 501 (không báo thành công giả); dung lượng chỉ tính tệp của viện mình", async () => {
    for (const [actor, url] of [[A.hospital_admin, "/api/v1/drive-storage/run-backup"], [A.system_admin, "/api/v1/drive-storage/run-backup"],
      [A.hospital_admin, "/api/v1/drive-storage/cleanup-orphans"], [A.doctor, "/api/v1/drive-storage/patient-folders"]]) {
      const r = await api(actor, "POST", url, { backupType: "daily", patientId: String(A.patient._id) });
      expectStatus(r, 501, `${url} (${actor.role})`);
      expect(r.json.code).toBe("DRIVE_NOT_INTEGRATED");
    }
    const { StoredMedicalFile } = await import("../models/storedMedicalFile.model.js");
    const used = async () => {
      const r = await api(A.hospital_admin, "GET", "/api/v1/drive-storage/capacity-check");
      expectStatus(r, 200, "BGĐ xem dung lượng");
      return r.json.data.usedCapacityMb;
    };
    const before = await used();
    const MB = 1024 * 1024;
    await StoredMedicalFile.collection.insertMany([
      { hospitalId: H, fileId: `f-${oid()}`, driveFileId: `drv-${oid()}`, sizeBytes: 10 * MB },
      { hospitalId: otherH, fileId: `f-${oid()}`, driveFileId: `drv-${oid()}`, sizeBytes: 500 * MB },
    ]);
    expect((await used()) - before).toBe(10);
  });

  test("IT9-05 Khởi động production thiếu khóa mã hóa: dừng ngay, nêu tên biến, không in giá trị khóa", async () => {
    const boot = (extra) => new Promise((resolve) => {
      const env = { ...process.env, NODE_ENV: "production", MONGO_URI: dbUri(), PORT: "0", JWT_SECRET: "x".repeat(40), JWT_REFRESH_SECRET: "y".repeat(40), ...extra };
      for (const k of EXTERNAL_BLANK) env[k] = "";
      const p = spawn(process.execPath, ["src/index.js"], { cwd: BE_DIR, env, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stdout.on("data", (d) => { out += d; });
      p.stderr.on("data", (d) => { out += d; });
      const t = setTimeout(() => { p.kill("SIGTERM"); }, 20000);
      p.on("exit", (code) => { clearTimeout(t); resolve({ code, out }); });
    });
    const FILE_KEY = "ab".repeat(32);
    const noField = await boot({ FIELD_ENCRYPTION_KEY: "", FILE_ENCRYPTION_KEY: FILE_KEY });
    expect(noField.code).toBe(1);
    expect(noField.out).toContain("[startup] FIELD_ENCRYPTION_KEY");
    expect(noField.out.includes(FILE_KEY)).toBe(false);
    const noFile = await boot({ FIELD_ENCRYPTION_KEY: "cd".repeat(32), FILE_ENCRYPTION_KEY: "" });
    expect(noFile.code).toBe(1);
    expect(noFile.out).toContain("[startup] FILE_ENCRYPTION_KEY");
    expect(noFile.out.includes("cd".repeat(32))).toBe(false);
    const { checkRequiredSecrets } = await import("../config/requiredSecrets.js");
    expect(checkRequiredSecrets()).toEqual([]); // ngoài production không chặn (dev dùng khóa DEV kèm cảnh báo)
  }, 60000);

  test("IT9-06 Phạm vi thu hẹp: không tạo mới tài khoản vệ sinh/dược sĩ, không tính vào số nhân sự; tài khoản cũ vẫn đăng nhập", async () => {
    expect(process.env.ENABLE_OUT_OF_SCOPE === "true").toBe(false);
    const pw = "Nhanvien2026";
    const reg = (role) => api(A.hospital_admin, "POST", "/auth/register", { email: `e2e_scope_${role}_${oid()}@e2e.local`, password: pw, name: `NV ${role}`, role });
    for (const role of ["pharmacist", "cleaner"]) {
      const r = await reg(role);
      expectStatus(r, 400, `BGĐ tạo tài khoản ${role}`);
      if (role === "pharmacist") expect(r.text.includes("ngoài phạm vi")).toBe(true); // vệ sinh vốn không đăng ký được qua /auth/register
      const a = await api(A.system_admin, "POST", "/admin/users", { email: `e2e_scope_adm_${role}_${oid()}@e2e.local`, password: pw, name: `NV ${role}`, role, hospitalName: "BV E2E" });
      expectStatus(a, 400, `quản trị nền tảng tạo tài khoản ${role}`);
      expect(a.text.includes("ngoài phạm vi")).toBe(true);
    }
    expect([200, 201].includes((await reg("nurse")).status)).toBe(true); // vai trò trong phạm vi vẫn tạo được

    // tài khoản vệ sinh/dược sĩ đã có vẫn đăng nhập được (trang chủ báo ngoài phạm vi)
    expectStatus(await api(A.pharmacist, "GET", "/auth/me"), 200, "dược sĩ cũ đăng nhập");

    const { getSystemStats } = await import("../services/user.service.js");
    const staff = async () => (await getSystemStats()).userDistribution.staff;
    const before = await staff();
    await mk("cleaner", H, "Vệ sinh mới");
    await mk("pharmacist", H, "Dược sĩ mới");
    expect(await staff()).toBe(before);
    await mk("nurse", H, "Điều dưỡng mới");
    expect(await staff()).toBe(before + 1);
  });

  test("IT9-07 Kiểm tra an toàn kê đơn nhận ra thuốc trong danh mục viện có ký tự đặc biệt trong tên (ngoặc, dấu cộng)", async () => {
    const { Drug } = await import("../modules/pharmacy/models/drug.model.js");
    const tag = String(oid()).slice(-6);
    const names = [`Thuốc thử ${tag} 20% (250ml)`, `Thuốc phối hợp ${tag} + Clavulanat`, `Thuốc lẻ ${tag} (`];
    await Drug.collection.insertMany(names.map((name) => ({ hospitalId: H, name, category: "other", createdAt: new Date(), updatedAt: new Date() })));
    const r = await api(A.doctor, "POST", "/api/drugs/check-prescription", { patientId: String(A.patient._id), medications: names.map((name) => ({ name })) });
    expectStatus(r, 200, "kiểm tra an toàn kê đơn");
    const cov = r.json.data.evaluationCoverage;
    expect(cov.total).toBe(3);
    expect(cov.unassessed.length).toBe(0); // trước đây cả 3 rơi vào "chưa đánh giá" do regex không khớp/ném lỗi
    expect(cov.evaluated).toBe(3);
  });

  test("IT9-08 Cờ đặt trong .env có hiệu lực khi chạy `node src/index.js` (nạp .env trước các module đọc cờ lúc import)", async () => {
    const fs = await import("fs");
    const indexSrc = fs.readFileSync(path.join(BE_DIR, "src", "index.js"), "utf8");
    expect(/^import "\.\/config\/env\.js";/.test(indexSrc.split(/\r?\n/).find((l) => l.startsWith("import")))).toBe(true);
    // chạy server thật trong thư mục tạm có .env riêng (dotenv đọc .env theo thư mục chạy); biến hệ thống không có cờ
    const boot = async (envFileText) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neuroscan_envtest_"));
      if (envFileText) fs.writeFileSync(path.join(dir, ".env"), envFileText);
      const port = await freePort();
      const env = { ...process.env, PORT: String(port), MONGO_URI: dbUri(), NODE_ENV: "test", STORAGE_MODE: "local",
        STORAGE_LOCAL_DIR: path.join(dir, "storage"), AI_SERVER_URL: "http://127.0.0.1:9", ENABLE_RATE_LIMIT: "false" };
      for (const k of EXTERNAL_BLANK) env[k] = "";
      delete env.ENABLE_OUT_OF_SCOPE;
      const p = spawn(process.execPath, [path.join(BE_DIR, "src", "index.js")], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stdout.on("data", (d) => { out += d; });
      p.stderr.on("data", (d) => { out += d; });
      const url = `http://127.0.0.1:${port}`;
      try {
        for (let i = 0; i < 120; i += 1) {
          if (p.exitCode !== null) throw new Error(`server dừng: ${out.slice(-800)}`);
          try { if ((await fetch(`${url}/api/v1/__e2e_ready__`, { signal: AbortSignal.timeout(1000) })).status === 404) break; } catch { /* chưa lên */ }
          await new Promise((r) => setTimeout(r, 500));
        }
        const r = await fetch(`${url}/api/v1/hospital-beds`, { signal: AbortSignal.timeout(5000) });
        return { status: r.status, text: await r.text() };
      } finally {
        p.kill("SIGTERM");
        await new Promise((r) => { const t = setTimeout(r, 8000); p.once("exit", () => { clearTimeout(t); r(); }); });
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };
    const off = await boot(null);
    expect(off.status).toBe(404);
    expect(off.text.includes("ngoài phạm vi")).toBe(true);
    const on = await boot("ENABLE_OUT_OF_SCOPE=true\n");
    expect(on.text.includes("ngoài phạm vi")).toBe(false); // route giường đã bật (tới bước xác thực)
    expect(on.status).toBe(401);
  }, 120000);
});

