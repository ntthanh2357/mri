// Các lỗi bảo mật P1, P2 của đợt audit v4.0: phiên đăng nhập, chuỗi audit, dedup, /uploads, route lỗi 500.
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { AuditChainAnchor } from "../models/auditChainAnchor.model.js";
import { Hospital } from "../models/hospital.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { StoredMedicalFile } from "../models/storedMedicalFile.model.js";
import { logout, refresh } from "../modules/auth/auth.controller.js";
import { recordAuditLog, verifyAuditChainIntegrity } from "../services/auditLog.service.js";
import { anonymizeAuditLogs } from "../services/audit.service.js";
import { findExistingBySha256, putFile } from "../services/storage/storageService.js";
import {
  signUploadPath,
  signUploadUrlsInResponse,
  stripUploadSignatures,
  requireSignedUpload,
  allowSignedStorageFile,
  resolveClientImageUrl,
  UPLOAD_LINK_TTL_MS,
} from "../middlewares/uploadSignature.middleware.js";
import { getWeeklySchedule } from "../modules/hospital/mriRoom.controller.js";
import { getShiftOverviewDashboard } from "../controllers/task.controller.js";
import { AI_DOCTOR_READ_FROM_STATUSES, analyzeImagingResultAI, getResultById } from "../modules/imaging/imaging.controller.js";
import { ALLOWED_TRANSITIONS } from "../controllers/visit.controller.js";
import { Visit } from "../models/visit.model.js";
import { loadImageBuffer } from "../utils/imageSource.util.js";
import { buildLogicalPath } from "../services/storage/localAdapter.js";
import { enqueueAiTask } from "../services/storage/pacsQueue.service.js";
import { checkDriveCapacity } from "../controllers/driveStorage.controller.js";
import { lockUser, addDataset } from "../modules/hospital/admin.controller.js";
import { getMriClassificationStatsService } from "../services/adminReport.service.js";
import { extractClientIp, resolveIpLocation } from "../utils/geoIp.util.js";
import { runWithJobLock } from "../utils/jobLock.util.js";
import { aiFetch } from "../utils/aiClient.util.js";
import { getOrCreateProfile, updateProfile } from "../services/patientRecord.service.js";
import { tenantStorage } from "../middlewares/tenant.middleware.js";
import driveRoutes from "../routes/driveStorage.routes.js";
import supportRoutes from "../routes/support.routes.js";
import invoiceRoutes from "../modules/billing/invoice.routes.js";
import imagingRoutes from "../modules/imaging/imaging.routes.js";
import { getJwtSecret, getRefreshSecret } from "../config/jwt.config.js";

const oid = () => new mongoose.Types.ObjectId();

const makeRes = () => ({
  statusCode: 200,
  payload: null,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  clearCookie() {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.payload = body; return this; },
});
const call = async (handler, req) => {
  const res = makeRes();
  await handler({ params: {}, body: {}, query: {}, headers: {}, cookies: {}, ...req }, res);
  return res;
};

const routeAllows = (router, method, path, role) => {
  const handlers = [];
  let found = false;
  for (const layer of router.stack) {
    if (!layer.route) handlers.push(layer.handle);
    else if (layer.route.path === path && layer.route.methods[method]) {
      handlers.push(...layer.route.stack.map((s) => s.handle));
      found = true;
      break;
    }
  }
  if (!found) return null;
  let blocked = false;
  const res = { status() { blocked = true; return this; }, json() { return this; } };
  for (const handle of handlers) {
    if (!/allowedRoles/.test(handle.toString())) continue;
    handle({ user: { role } }, res, () => {});
    if (blocked) return false;
  }
  return true;
};

const makeUser = (extra = {}) => User.create({
  email: `v34h_${oid()}@neuroscan.vn`,
  passwordHash: "hashed",
  role: "doctor",
  profile: { name: "BS", fullName: "BS" },
  ...extra,
});

const refreshTokenFor = (user, overrides = {}) =>
  jwt.sign({ id: String(user._id), role: user.role, tokenVersion: user.tokenVersion || 0, hospitalId: user.hospitalId, ...overrides }, getRefreshSecret(), { algorithm: "HS256", expiresIn: "7d" });

describe("v3.4 Vá lỗi bảo mật còn lại", () => {
  let hospitalId;

  // Mỗi kịch bản giả mạo cần một chuỗi riêng để không ảnh hưởng các test khác
  const freshChain = async (count = 4) => {
    await AuditLog.deleteMany({ sequenceNumber: { $exists: true } });
    await AuditChainAnchor.deleteMany({});
    for (let i = 0; i < count; i += 1) {
      await recordAuditLog({ action: "TEST_ACTION", entity: "Test", entityId: String(i), performedBy: "tester", hospitalId, details: `chi tiết ${i}`, ipAddress: "10.1.1.1", location: "HN" });
    }
    return AuditLog.find({ sequenceNumber: { $exists: true } }).sort({ sequenceNumber: 1 }).lean();
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.TEST_MONGO_URI);
    const hospital = await Hospital.create({ name: "BV Bảo Mật", code: `V34S-${oid()}` });
    hospitalId = hospital._id;
  });

  // Các kịch bản giả mạo cố tình làm hỏng chuỗi: xóa cả chuỗi và mốc để không ảnh hưởng bộ test chạy sau
  afterAll(async () => {
    await AuditLog.deleteMany({ sequenceNumber: { $exists: true } });
    await AuditChainAnchor.deleteMany({});
  });

  // ── Luồng AI với dữ liệu đúng dạng DB thật ────────────────────────────────────────────────
  // Đường dẫn tệp chưa ký / hết hạn bị chặn ngay ở middleware (chống signing oracle) hoặc ở resolveClientImageUrl:
  // middlewareStatus ghi mã từ chối của middleware (null nếu cho qua)
  const signedRequest = (imageUrl, extra = {}) => {
    const req = { body: { imageUrl, ...extra } };
    const res = { statusCode: null, status(code) { this.statusCode = code; return this; }, json() { return this; } };
    let passed = false;
    stripUploadSignatures(req, res, () => { passed = true; });
    req.middlewareStatus = passed ? null : res.statusCode;
    return req;
  };

  test("Ảnh client gửi: chỉ nhận link đã ký còn hạn của đúng tệp đó", () => {
    const file = "/api/v1/storage/files/abc";
    const other = "/uploads/x.png";
    const reject = (value) => {
      const req = signedRequest(value);
      let status = req.middlewareStatus;
      if (status === null) {
        try { resolveClientImageUrl(req, req.body.imageUrl); } catch (err) { status = err.statusCode; }
      }
      expect(status).toBe(403);
    };

    let req = signedRequest(signUploadPath(file));
    expect(resolveClientImageUrl(req, req.body.imageUrl)).toBe(file);
    req = signedRequest(`https://bv.example.vn${signUploadPath(file)}`);
    expect(resolveClientImageUrl(req, req.body.imageUrl)).toBe(file);

    reject(file);
    reject(other);
    reject(signUploadPath(other, Date.now() - UPLOAD_LINK_TTL_MS - 1000));
    const signed = signUploadPath(other);
    reject(`${file}${signed.slice(signed.indexOf("?"))}`);
    expect(resolveClientImageUrl(signedRequest("https://cdn.example.vn/a.png"), "https://cdn.example.vn/a.png")).toBe("https://cdn.example.vn/a.png");
  });

  test("AI đọc được ảnh trong kho lưu trữ, từ chối tệp không phải ảnh", async () => {
    const png = Buffer.from("v34-stored-image");
    const image = await putFile({ category: "pacs", studyId: "V34_AI", fileName: "a.jpg", buffer: png, mimeType: "image/jpeg", hospitalId });
    const loaded = await loadImageBuffer(`/api/v1/storage/files/${image.fileId}`);
    expect(loaded.buffer.equals(png)).toBe(true);
    expect(loaded.mimeType).toBe("image/jpeg");

    const zip = await putFile({ category: "pacs", studyId: "V34_AI", fileName: "a.zip", buffer: Buffer.from("PK-v34"), mimeType: "application/zip", hospitalId });
    let status = null;
    try { await loadImageBuffer(`/api/v1/storage/files/${zip.fileId}`); } catch (err) { status = err.statusCode; }
    expect(status).toBe(400);
  });

  test("studyId từ client không thoát khỏi thư mục ca bệnh", () => {
    const logical = buildLogicalPath({ category: "pacs", studyId: "../../../../../../../evil", fileName: "a.jpg" });
    expect(/^pacs\/\d{4}\/\d{2}\/study_[^/]+\/a\.jpg$/.test(logical)).toBe(true);
    expect(/^ai-temp\/[^/]+\/a\.jpg$/.test(buildLogicalPath({ category: "ai_temp", studyId: "../../evil", fileName: "a.jpg" }))).toBe(true);
    expect(buildLogicalPath({ category: "pacs", studyId: "TAMTRI_997", fileName: "a.jpg" })).toContain("study_TAMTRI_997/a.jpg");
  });

  test("Tác vụ AI chờ trong hàng đợi giữ đúng ngữ cảnh viện của người tạo", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const blockers = tenantStorage.run({ hospitalId: "A" }, () => Array.from({ length: 6 }, () => enqueueAiTask({ taskFn: () => gate })));
    let seen = null;
    const target = tenantStorage.run({ hospitalId: "B" }, () => enqueueAiTask({ taskFn: async () => { seen = tenantStorage.getStore()?.hospitalId; } }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    release();
    await Promise.all([...blockers, target]);
    expect(seen).toBe("B");
  });

  test("Danh sách chuyển sang chờ bác sĩ đọc khớp ma trận trạng thái lượt khám", () => {
    const fromFsm = Object.keys(ALLOWED_TRANSITIONS).filter((status) => ALLOWED_TRANSITIONS[status].includes("chờ bác sĩ đọc"));
    expect([...AI_DOCTOR_READ_FROM_STATUSES].sort()).toEqual(fromFsm.sort());
  });

  test("Phân tích AI: lượt đã xong không bị lùi, bệnh nhân không đổi được trạng thái, visitId sai bị từ chối", async () => {
    const image = await putFile({ category: "pacs", studyId: "V34_AI", fileName: "b.jpg", buffer: Buffer.from("v34-visit-image"), mimeType: "image/jpeg", hospitalId });
    const link = signUploadPath(`/api/v1/storage/files/${image.fileId}`);
    const patientId = oid();
    const newVisit = (status) => Visit.create({ hospitalId, patientId, patientName: "BN", doctorId: oid(), status, reason: "khám" });
    const statusOf = async (visit) => (await Visit.findOne({ _id: visit._id, hospitalId }).lean()).status;
    const analyze = (role, visitId) => {
      const req = signedRequest(link, visitId ? { visitId: String(visitId) } : {});
      return call(analyzeImagingResultAI, { ...req, user: { id: String(oid()), role, hospitalId } });
    };

    const realFetch = global.fetch;
    const savedKey = process.env.INTERNAL_AI_API_KEY;
    process.env.INTERNAL_AI_API_KEY = "test-key";
    global.fetch = async () => ({ ok: true, json: async () => ({ class_name: "notumor", confidence: 90 }) });
    try {
      const done = await newVisit("hoàn tất");
      expect((await analyze("technician", done._id)).statusCode).toBe(200);
      expect(await statusOf(done)).toBe("hoàn tất");

      const scanning = await newVisit("đang chụp");
      expect((await analyze("patient", scanning._id)).statusCode).toBe(200);
      expect(await statusOf(scanning)).toBe("đang chụp");

      expect((await analyze("technician", scanning._id)).statusCode).toBe(200);
      expect(await statusOf(scanning)).toBe("chờ bác sĩ đọc");

      expect((await analyze("technician", "../../../evi")).statusCode).toBe(400);
    } finally {
      global.fetch = realFetch;
      if (savedKey === undefined) delete process.env.INTERNAL_AI_API_KEY;
      else process.env.INTERNAL_AI_API_KEY = savedKey;
    }
  });

  // ── OPEN-07 ───────────────────────────────────────────────────────────────────────────────
  test("OPEN-07: logout thu hồi cả refresh token và access token", async () => {
    const user = await makeUser();
    const token = refreshTokenFor(user);
    expect((await call(refresh, { body: { refreshToken: token } })).statusCode).toBe(200);
    expect((await call(logout, { body: { refreshToken: token } })).statusCode).toBe(200);
    expect((await User.findById(user._id)).tokenVersion).toBe(1);
    expect((await call(refresh, { body: { refreshToken: token } })).statusCode).toBe(401);
  });

  test("OPEN-07: logout bằng token giả không thu hồi được phiên của người khác", async () => {
    const user = await makeUser();
    const forged = jwt.sign({ id: String(user._id), tokenVersion: 0 }, "khoa-sai", { algorithm: "HS256" });
    expect((await call(logout, { body: { refreshToken: forged } })).statusCode).toBe(200);
    expect((await User.findById(user._id)).tokenVersion || 0).toBe(0);
  });

  test("OPEN-07: logout bằng access token trong header cũng thu hồi phiên", async () => {
    const user = await makeUser();
    const access = jwt.sign({ id: String(user._id), tokenVersion: 0 }, getJwtSecret(), { algorithm: "HS256" });
    await call(logout, { headers: { authorization: `Bearer ${access}` } });
    expect((await User.findById(user._id)).tokenVersion).toBe(1);
  });

  test("OPEN-07: refresh từ chối tài khoản bị khóa, và lấy vai trò mới từ DB", async () => {
    const locked = await makeUser({ isLocked: true });
    expect((await call(refresh, { body: { refreshToken: refreshTokenFor(locked) } })).statusCode).toBe(403);

    const user = await makeUser({ role: "nurse" });
    const res = await call(refresh, { body: { refreshToken: refreshTokenFor(user, { role: "hospital_admin" }) } });
    expect(jwt.decode(res.payload.accessToken).role).toBe("nurse");
  });

  // ── OPEN-08 ───────────────────────────────────────────────────────────────────────────────
  test("OPEN-08: chuỗi nguyên vẹn thì hợp lệ và có kiểm tra mốc đầu chuỗi", async () => {
    await freshChain();
    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(true);
    expect(result.anchorChecked).toBe(true);
    expect(result.verifiedCount).toBe(4);
  });

  test("OPEN-08: xóa hashedTimestamp rồi sửa nội dung vẫn bị phát hiện", async () => {
    const logs = await freshChain();
    await AuditLog.collection.updateOne({ _id: logs[1]._id }, { $unset: { hashedTimestamp: "" }, $set: { details: "đã sửa" } });
    expect((await verifyAuditChainIntegrity()).valid).toBe(false);
  });

  test("OPEN-08: xóa bản ghi cuối chuỗi bị phát hiện", async () => {
    const logs = await freshChain();
    await AuditLog.collection.deleteOne({ _id: logs[3]._id });
    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("bị cắt");
  });

  test("OPEN-08: sửa IP, hospitalId, vị trí đều bị phát hiện", async () => {
    for (const change of [{ ipAddress: "1.2.3.4" }, { hospitalId: oid() }, { location: "Nơi khác" }]) {
      const logs = await freshChain();
      await AuditLog.collection.updateOne({ _id: logs[2]._id }, { $set: change });
      expect((await verifyAuditChainIntegrity()).valid).toBe(false);
    }
  });

  test("OPEN-08: giả mạo mốc đầu chuỗi bị phát hiện", async () => {
    await freshChain();
    await AuditChainAnchor.collection.updateOne({ _id: "head" }, { $set: { sequenceNumber: 1, signature: "gia-mao" } });
    expect((await verifyAuditChainIntegrity()).valid).toBe(false);
  });

  test("DB thật: log cũ thiếu hashedTimestamp không bị báo giả mạo, nhưng log mới không được hạ về dạng cũ", async () => {
    await AuditLog.deleteMany({ sequenceNumber: { $exists: true } });
    await AuditChainAnchor.deleteMany({});
    let prev = "0".repeat(64);
    for (let seq = 1; seq <= 3; seq += 1) {
      const currentHash = String(seq).repeat(64);
      await AuditLog.collection.insertOne({ action: "LEGACY", entity: "E", entityId: "", performedBy: "seed", details: "cũ", sequenceNumber: seq, previousHash: prev, currentHash });
      prev = currentHash;
    }
    const legacyOnly = await verifyAuditChainIntegrity();
    expect(legacyOnly.valid).toBe(true);
    expect(legacyOnly.legacyUnverifiedCount).toBe(3);

    await recordAuditLog({ action: "TEST_ACTION", entity: "Test", performedBy: "tester", hospitalId, details: "mới" });
    await recordAuditLog({ action: "TEST_ACTION", entity: "Test", performedBy: "tester", hospitalId, details: "mới 2" });
    expect((await verifyAuditChainIntegrity()).valid).toBe(true);

    await AuditLog.collection.updateOne({ sequenceNumber: 4 }, { $unset: { hashVersion: "", hashedTimestamp: "" }, $set: { details: "đã sửa" } });
    expect((await verifyAuditChainIntegrity()).valid).toBe(false);
  });

  test("OPEN-08: mặc định xét toàn bộ chuỗi, không dừng ở 1000 bản ghi", async () => {
    const logs = await freshChain(3);
    const last = logs[2];
    // Dựng chuỗi dài bằng cách chèn trực tiếp sẽ tốn thời gian: kiểm tra qua tham số giới hạn
    await AuditLog.collection.updateOne({ _id: last._id }, { $set: { details: "đã sửa" } });
    const partial = await verifyAuditChainIntegrity(2);
    expect(partial.valid).toBe(true);
    expect(partial.partial).toBe(true);
    expect((await verifyAuditChainIntegrity()).valid).toBe(false);
  });

  test("OPEN-08: ẩn danh theo HIPAA không làm đứt chuỗi", async () => {
    await freshChain(2);
    await recordAuditLog({ action: "TEST_ACTION", entity: "Patient", entityId: "x", performedBy: "bac-si-a", hospitalId, details: "xem hồ sơ" });
    const { modifiedCount } = await anonymizeAuditLogs("admin-test");
    expect(modifiedCount).toBeGreaterThan(0);
    const redacted = await AuditLog.findOne({ action: "TEST_ACTION", entity: "Patient" }).lean();
    expect(redacted.performedBy).toBe("REDACTED-HIPAA");
    expect((await verifyAuditChainIntegrity()).valid).toBe(true);
  });

  // ── OPEN-09 ───────────────────────────────────────────────────────────────────────────────
  test("OPEN-09: dedup không khớp sang tệp của viện khác hay người khác", async () => {
    const content = Buffer.from(`noi-dung-${oid()}`);
    const viewerA = oid();
    const first = await putFile({ category: "pacs", fileName: "a.dcm", buffer: content, hospitalId, uploadedBy: viewerA, syncToDrive: false });
    const noTenant = await putFile({ category: "pacs", fileName: "b.dcm", buffer: content, uploadedBy: oid(), syncToDrive: false });
    expect(noTenant.localPath === first.localPath).toBe(false);

    const stored = await StoredMedicalFile.findOne({ fileId: first.fileId }).lean();
    expect(await findExistingBySha256(stored.sha256)).toBeNull();
    expect(await findExistingBySha256(stored.sha256, { hospitalId: oid() })).toBeNull();
    const sameHospital = await findExistingBySha256(stored.sha256, { hospitalId });
    expect(String(sameHospital.fileId)).toBe(String(first.fileId));
  });

  // ── NEW-04 ────────────────────────────────────────────────────────────────────────────────
  test("NEW-04: /uploads từ chối link không có chữ ký, sai chữ ký, hết hạn, hoặc dùng cho tệp khác", () => {
    const check = (url, query) => {
      const res = makeRes();
      let passed = false;
      requireSignedUpload({ path: url, query }, res, () => { passed = true; });
      return { passed, status: res.statusCode };
    };
    expect(check("/x.png", {}).status).toBe(401);
    expect(check("/x.png", { exp: String(Date.now() + 1000), sig: "sai" }).status).toBe(401);

    const signed = new URL(`http://h${signUploadPath("/uploads/x.png")}`);
    const query = Object.fromEntries(signed.searchParams);
    expect(check("/x.png", query).passed).toBe(true);
    expect(check("/khac.png", query).status).toBe(401);

    const old = new URL(`http://h${signUploadPath("/uploads/x.png", Date.now() - UPLOAD_LINK_TTL_MS - 1000)}`);
    const expired = check("/x.png", Object.fromEntries(old.searchParams));
    expect(expired.passed).toBe(false);
    expect(expired.status).toBe(401);
  });

  test("NEW-04: API tự ký link trong response; dữ liệu gửi lên được bỏ chữ ký trước khi lưu", () => {
    // Mô phỏng res của Express: middleware gửi chuỗi JSON đã ký qua res.send
    const mockRes = () => ({ headers: {}, get(k) { return this.headers[k]; }, set(k, v) { this.headers[k] = v; }, send(text) { this.sent = JSON.parse(text); return this; }, json(body) { this.sent = body; return this; } });
    const res = mockRes();
    signUploadUrlsInResponse({}, res, () => {});
    res.json({ data: { images: ["/uploads/a.png"], note: "xem /uploads/a.png trong hồ sơ", abs: "http://h:5000/uploads/b.pdf" } });
    expect(res.sent.data.images[0].startsWith("/uploads/a.png?exp=")).toBe(true);
    expect(res.sent.data.abs.startsWith("http://h:5000/uploads/b.pdf?exp=")).toBe(true);
    expect(res.sent.data.note).toBe("xem /uploads/a.png trong hồ sơ");

    const stored = mockRes();
    signUploadUrlsInResponse({}, stored, () => {});
    stored.json({ url: "/api/v1/storage/files/abc-123", meta: "/api/v1/storage/files/abc-123/metadata" });
    expect(stored.sent.url.includes("sig=")).toBe(true);
    expect(stored.sent.meta.includes("sig=")).toBe(false);
    const inbound = { body: { images: [stored.sent.url] } };
    stripUploadSignatures(inbound, {}, () => {});
    expect(inbound.body.images[0]).toBe("/api/v1/storage/files/abc-123");

    const noLogin = () => { throw new Error("không được gọi đăng nhập khi có link ký"); };
    const query = Object.fromEntries(new URL(`http://h${stored.sent.url}`).searchParams);
    const okReq = { params: { fileId: "abc-123" }, query };
    let passed = false;
    allowSignedStorageFile(noLogin)(okReq, makeRes(), () => { passed = true; });
    expect(passed && okReq.signedFileAccess).toBe(true);
    const otherRes = makeRes();
    allowSignedStorageFile(noLogin)({ params: { fileId: "file-khac" }, query }, otherRes, () => {});
    expect(otherRes.statusCode).toBe(401);
    let usedLogin = false;
    allowSignedStorageFile(() => { usedLogin = true; })({ params: { fileId: "abc-123" }, query: {} }, makeRes(), () => {});
    expect(usedLogin).toBe(true);

    const req = { body: { images: [res.sent.data.images[0]], imageUrl: res.sent.data.abs, other: "giữ nguyên" } };
    stripUploadSignatures(req, {}, () => {});
    expect(req.body.images[0]).toBe("/uploads/a.png");
    expect(req.body.imageUrl).toBe("http://h:5000/uploads/b.pdf");
    expect(req.body.other).toBe("giữ nguyên");
  });

  // ── NEW-06 ────────────────────────────────────────────────────────────────────────────────
  test("NEW-06: không gửi IP người dùng ra ngoài nếu viện chưa cấu hình dịch vụ HTTPS", async () => {
    const realFetch = global.fetch;
    const saved = process.env.GEOIP_LOOKUP_URL;
    delete process.env.GEOIP_LOOKUP_URL;
    let called = 0;
    global.fetch = async () => { called += 1; return { ok: false }; };
    try {
      await resolveIpLocation("203.0.113.55");
      process.env.GEOIP_LOOKUP_URL = "http://ip-api.com/json/{ip}";
      await resolveIpLocation("203.0.113.56");
      expect(called).toBe(0);
    } finally {
      global.fetch = realFetch;
      if (saved === undefined) delete process.env.GEOIP_LOOKUP_URL;
      else process.env.GEOIP_LOOKUP_URL = saved;
    }
  });

  test("Đổi X-Forwarded-For không giả được IP ghi nhật ký khi có req.ip", () => {
    expect(extractClientIp({ ip: "198.51.100.9", headers: { "x-forwarded-for": "8.8.8.8" } })).toBe("198.51.100.9");
  });

  // ── NEW-07, NEW-08, NEW-09, NEW-10, OPEN-11 ───────────────────────────────────────────────
  test("NEW-07: lịch MRI theo tuần hoạt động và kiểm tra ngày", async () => {
    const user = { id: String(oid()), role: "technician", hospitalId: String(hospitalId) };
    expect((await call(getWeeklySchedule, { user })).statusCode).toBe(200);
    expect((await call(getWeeklySchedule, { user, query: { weekStart: "2026-11-02" } })).statusCode).toBe(200);
    expect((await call(getWeeklySchedule, { user, query: { weekStart: "không-phải-ngày" } })).statusCode).toBe(400);
  });

  test("NEW-10: các route trước đây 500 nay trả đúng mã", async () => {
    const user = { id: String(oid()), role: "doctor", hospitalId: String(hospitalId) };
    expect((await call(getShiftOverviewDashboard, { user })).statusCode).toBe(200);
    const admin = { id: String(oid()), role: "system_admin" };
    expect((await call(lockUser, { user: admin, body: {} })).statusCode).toBe(400);
    expect((await call(addDataset, { user: admin, body: {} })).statusCode).toBe(400);
  });

  test("NEW-08, NEW-09: route Drive và số liệu hệ thống có phân quyền; bỏ link chia sẻ giả", () => {
    expect(routeAllows(driveRoutes, "get", "/share-link/:fileId", "patient")).toBeNull();
    for (const role of ["patient", "cleaner", "pharmacist"]) {
      expect(routeAllows(driveRoutes, "post", "/run-backup", role)).toBe(false);
      expect(routeAllows(driveRoutes, "get", "/capacity-check", role)).toBe(false);
      expect(routeAllows(supportRoutes, "get", "/system-metrics", role)).toBe(false);
    }
    expect(routeAllows(supportRoutes, "get", "/system-metrics", "hospital_admin")).toBe(true);
  });

  test("Dung lượng Drive tính từ dữ liệu thật", async () => {
    const res = await call(checkDriveCapacity, { user: { role: "hospital_admin", hospitalId } });
    expect(res.statusCode).toBe(200);
    // hospital_admin chưa gán viện không xem được dung lượng (trước đây trả tổng mọi viện)
    expect((await call(checkDriveCapacity, { user: { role: "hospital_admin" } })).statusCode).toBe(403);
    expect(res.payload.data.usedCapacityMb === 1680000).toBe(false);
  });

  test("OPEN-11: thống kê phân loại nhận hospitalId dạng chuỗi", async () => {
    const rows = await getMriClassificationStatsService(String(hospitalId));
    expect(Boolean(rows)).toBe(true);
  });

  // ── Quyền còn rộng ────────────────────────────────────────────────────────────────────────
  test("Quản trị nền tảng không thu tiền thay viện và không đọc dữ liệu CĐHA", () => {
    for (const role of ["admin", "system_admin"]) {
      expect(routeAllows(invoiceRoutes, "put", "/:id/pay", role)).toBe(false);
      expect(routeAllows(invoiceRoutes, "post", "/:id/bank-transfer", role)).toBe(false);
      expect(routeAllows(imagingRoutes, "get", "/", role)).toBe(false);
      expect(routeAllows(imagingRoutes, "get", "/:id", role)).toBe(false);
    }
    expect(routeAllows(invoiceRoutes, "put", "/:id/pay", "receptionist")).toBe(true);
  });

  test("Lễ tân thấy trạng thái ca nhưng không đọc được nội dung chẩn đoán", async () => {
    const image = await ImagingResult.create({
      hospitalId, medicalId: `BN-${oid()}`, patientName: "BN", birthYear: 1985, gender: "Nam", address: "HN",
      orderDate: new Date().toISOString(), orderingDoctor: "BS", orderingDepartment: "K", diagnosis: "Chẩn đoán mật",
      procedure: "MRI", findings: "Mô tả mật", conclusion: "Kết luận mật", radiologist: "BS", reportDate: new Date().toISOString(),
      imagingType: "MRI", isSigned: true,
    });
    const res = await call(getResultById, { user: { id: String(oid()), role: "receptionist", hospitalId: String(hospitalId) }, params: { id: String(image._id) } });
    expect(res.statusCode).toBe(200);
    const text = JSON.stringify(res.payload);
    expect(text.includes("Kết luận mật")).toBe(false);
    expect(text.includes("Mô tả mật")).toBe(false);
    expect(res.payload.data.isSigned).toBe(true);
  });

  test("Bệnh nhân đăng ký cá nhân, không gắn viện, vẫn có hồ sơ định danh và cập nhật được", async () => {
    const patient = await makeUser({ role: "patient", hospitalId: null });
    const asPatient = (fn) => tenantStorage.run({ role: "patient", userId: String(patient._id) }, fn);
    const created = await asPatient(() => getOrCreateProfile(patient._id));
    expect(String(created.userId)).toBe(String(patient._id));
    const updated = await asPatient(() => updateProfile(patient._id, { address: "Hà Nội" }));
    expect(updated.address).toBe("Hà Nội");
  });

  // ── Hạ tầng ───────────────────────────────────────────────────────────────────────────────
  test("Khóa job: 2 instance cùng lúc thì chỉ một lần chạy", async () => {
    const name = `test-lock-${oid()}`;
    let runs = 0;
    await Promise.all([1, 2, 3].map(() => runWithJobLock(name, 60000, async () => { runs += 1; })));
    expect(runs).toBe(1);
    await runWithJobLock(name, 60000, async () => { runs += 1; });
    expect(runs).toBe(1);
  });

  test("Lời gọi AI luôn kèm khóa nội bộ", async () => {
    const realFetch = global.fetch;
    const saved = process.env.INTERNAL_AI_API_KEY;
    process.env.INTERNAL_AI_API_KEY = "khoa-noi-bo";
    let headers = null;
    global.fetch = async (_url, options) => { headers = options.headers; return { ok: true }; };
    try {
      await aiFetch("http://ai/predict", { method: "POST", headers: { "Content-Type": "application/json" } });
      expect(headers["X-Internal-Api-Key"]).toBe("khoa-noi-bo");
      expect(headers["Content-Type"]).toBe("application/json");
    } finally {
      global.fetch = realFetch;
      if (saved === undefined) delete process.env.INTERNAL_AI_API_KEY;
      else process.env.INTERNAL_AI_API_KEY = saved;
    }
  });
});
