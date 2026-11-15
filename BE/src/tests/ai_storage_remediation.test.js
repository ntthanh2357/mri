import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import StoredMedicalFile from "../models/storedMedicalFile.model.js";
import { putFile, getFileBuffer } from "../services/storage/storageService.js";
import { getLocalRoot } from "../services/storage/localAdapter.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Notification } from "../models/notification.model.js";
import { applyAiResultToImaging, markAiAnalysisFailed, buildAiReport } from "../modules/imaging/aiResult.util.js";
import { getViewerManifest } from "../modules/imaging/dicom.controller.js";
import { explainImagingResultAI } from "../modules/imaging/imaging.controller.js";
import { getMyQueue } from "../controllers/visit.controller.js";
import {
  initChunkedUpload,
  uploadChunkPart,
  completeChunkedUpload
} from "../modules/storage/storage.controller.js";

const makeMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    }
  };
  return res;
};

describe("AI Screening & Medical Storage Flow Remediation Suite (P1-P9 Verification)", () => {
  let hospitalId;
  let doctorId;
  let patientId;
  let otherPatientId;
  let otherUserId;
  const tempFilesToClean = [];

  const makeImagingPayload = (overrides = {}) => ({
    hospitalId,
    patientId,
    medicalId: "BN001",
    patientName: "Bệnh nhân Một",
    imagingType: "MRI",
    procedure: "Chụp cộng hưởng từ sọ não có tiêm thuốc cản quang",
    radiologist: "BS. Nguyễn Văn A",
    findings: "Chờ bác sĩ đọc mô tả hình ảnh.",
    conclusion: "Chờ kết quả chẩn đoán từ bác sĩ.",
    orderDate: new Date(),
    reportDate: new Date(),
    status: "chờ duyệt",
    isSigned: false,
    images: ["/uploads/real_slice_1.jpg"],
    ...overrides,
  });

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan_test_logic"
      );
    }

    hospitalId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    otherPatientId = new mongoose.Types.ObjectId();
    otherUserId = new mongoose.Types.ObjectId();

    await Hospital.create({
      _id: hospitalId,
      name: "Bệnh viện Thần Kinh Kiểm Thử",
      code: "BV-TEST-" + Date.now().toString().slice(-4),
      isActive: true
    });

    await User.create([
      {
        _id: doctorId,
        hospitalId,
        email: `doc_${Date.now()}@test.vn`,
        passwordHash: "dummy_hashed_pw_123",
        role: "doctor",
        profile: { name: "BS. Nguyễn Văn A", medicalId: "BS001" }
      },
      {
        _id: patientId,
        hospitalId,
        email: `pat_${Date.now()}@test.vn`,
        passwordHash: "dummy_hashed_pw_123",
        role: "patient",
        profile: { name: "Bệnh nhân Một", medicalId: "BN001" }
      },
      {
        _id: otherPatientId,
        hospitalId,
        email: `pat2_${Date.now()}@test.vn`,
        passwordHash: "dummy_hashed_pw_123",
        role: "patient",
        profile: { name: "Bệnh nhân Hai", medicalId: "BN002" }
      },
      {
        _id: otherUserId,
        hospitalId,
        email: `other_${Date.now()}@test.vn`,
        passwordHash: "dummy_hashed_pw_123",
        role: "doctor",
        profile: { name: "BS. Người Lạ", medicalId: "BS002" }
      }
    ]);
  });

  afterAll(async () => {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (e) {}
    }
  });

  // ─── TEST 1: File name collision prevention ─────────────────────────────
  test("1. Ngăn chặn ghi đè tập tin y tế khi trùng tên giữa các bệnh nhân/ca chụp khác nhau", async () => {
    const fileName = "mri_brain_t2.dcm";
    const content1 = Buffer.from("PATIENT_1_MRI_SCAN_DATA_ABC_123");
    const content2 = Buffer.from("PATIENT_2_MRI_SCAN_DATA_XYZ_789");

    const fileRec1 = await putFile({
      buffer: content1,
      fileName,
      category: "pacs",
      patientId: String(patientId),
      uploadedBy: String(doctorId)
    });

    const fileRec2 = await putFile({
      buffer: content2,
      fileName,
      category: "pacs",
      patientId: String(otherPatientId),
      uploadedBy: String(doctorId)
    });

    expect(fileRec1._id.toString() !== fileRec2._id.toString()).toBe(true);
    expect(fileRec1.logicalPath !== fileRec2.logicalPath).toBe(true);
    expect(fileRec1.localPath !== fileRec2.localPath).toBe(true);

    tempFilesToClean.push(fileRec1.localPath, fileRec2.localPath);

    expect(fs.existsSync(fileRec1.localPath)).toBe(true);
    expect(fs.existsSync(fileRec2.localPath)).toBe(true);

    // Xác nhận nội dung đọc ngược lại độc lập, không bị ghi đè
    const { buffer: readBuf1 } = await getFileBuffer(fileRec1.fileId);
    const { buffer: readBuf2 } = await getFileBuffer(fileRec2.fileId);
    expect(readBuf1.toString()).toBe(content1.toString());
    expect(readBuf2.toString()).toBe(content2.toString());
  });

  // ─── TEST 2: Local AES-256-GCM encryption at rest & backward compatibility ─
  test("2. Mã hóa cục bộ AES-256-GCM ở trạng thái nghỉ và đọc tương thích ngược với file cũ", async () => {
    const rawPlaintext = Buffer.from("SENSITIVE_MEDICAL_MRI_SCAN_PAYLOAD_TOP_SECRET");
    const newEncryptedFile = await putFile({
      buffer: rawPlaintext,
      fileName: "brain_secret.dcm",
      category: "pacs",
      patientId: String(patientId),
      uploadedBy: String(doctorId)
    });

    expect(newEncryptedFile.localEncrypted).toBe(true);

    const onDiskPath = newEncryptedFile.localPath;
    tempFilesToClean.push(onDiskPath);
    const rawDiskBytes = fs.readFileSync(onDiskPath);

    // Xác nhận dữ liệu trên ổ đĩa vật lý KHÔNG phải là văn bản thô (đã được mã hóa)
    expect(rawDiskBytes.includes(rawPlaintext)).toBe(false);

    // Đọc qua getFileBuffer tự động giải mã trong suốt
    const { buffer: decryptedBuffer } = await getFileBuffer(newEncryptedFile.fileId);
    expect(decryptedBuffer.equals(rawPlaintext)).toBe(true);

    // Kiểm tra tương thích ngược: file cũ (localEncrypted: false, lưu trực tiếp plaintext)
    const legacyPlaintext = Buffer.from("LEGACY_UNENCRYPTED_FILE_FROM_V1");
    const legacySubpath = `legacy_${Date.now()}_test.bin`;
    const legacyDiskPath = path.join(getLocalRoot(), legacySubpath);
    fs.writeFileSync(legacyDiskPath, legacyPlaintext);
    tempFilesToClean.push(legacyDiskPath);

    const legacyDoc = await StoredMedicalFile.create({
      fileId: crypto.randomUUID(),
      fileName: "legacy_file.bin",
      fileSize: legacyPlaintext.length,
      sizeBytes: legacyPlaintext.length,
      mimeType: "application/octet-stream",
      category: "pacs",
      sha256: crypto.createHash("sha256").update(legacyPlaintext).digest("hex"),
      storageEngine: "local",
      logicalPath: legacySubpath,
      localPath: legacyDiskPath,
      localEncrypted: false,
      isEncrypted: false,
      patientId,
      uploadedBy: doctorId
    });

    const { buffer: legacyReadBuf } = await getFileBuffer(legacyDoc.fileId);
    expect(legacyReadBuf.equals(legacyPlaintext)).toBe(true);
  });

  // ─── TEST 3: AI background completion refuses to overwrite signed reports ──
  test("3. Quy trình AI hoàn tất KHÔNG được ghi đè báo cáo chẩn đoán đã ký duyệt", async () => {
    const signedDoctorFindings = "Khối tổn thương choán chỗ vùng đỉnh phải 34x28mm, nghĩ nhiều U màng não (Meningioma) WHO độ I.";
    const signedDoctorConclusion = "U màng não vùng đỉnh phải độ I theo WHO - Đề nghị hội chẩn ngoại khoa";

    const imagingDoc = await ImagingResult.create(makeImagingPayload({
      status: "đã duyệt",
      isSigned: true,
      findings: signedDoctorFindings,
      conclusion: signedDoctorConclusion,
      signedAt: new Date(),
      signedBy: doctorId
    }));

    const aiReport = buildAiReport({
      class_name: "glioma",
      confidence: 98.7,
      box: { x: 0.25, y: 0.35, width: 0.4, height: 0.4 }
    });

    // Gọi hàm applyAiResultToImaging
    const applyRes = await applyAiResultToImaging({
      imagingResultId: imagingDoc._id,
      hospitalId,
      aiReport,
      fillDraft: {
        findings: "AI phát hiện glioma",
        expectedFindings: "Chờ bác sĩ đọc mô tả hình ảnh.",
        conclusion: "AI chẩn đoán glioma"
      }
    });

    expect(applyRes.applied).toBe(false);
    expect(applyRes.reason).toBe("signed");

    // Xác nhận kết luận và mô tả của bác sĩ KHÔNG bị AI ghi đè
    const reloaded = await ImagingResult.findById(imagingDoc._id);
    expect(reloaded.findings).toBe(signedDoctorFindings);
    expect(reloaded.conclusion).toBe(signedDoctorConclusion);
    expect(reloaded.isSigned).toBe(true);
  });

  // ─── TEST 4: Manifest & Viewer do NOT output fake bounding boxes or fake multi-series
  test("4. Viewer Manifest không trả bounding box giả {0.56, 0.38...} và không nhân bản chuỗi xung giả", async () => {
    const cleanImaging = await ImagingResult.create(makeImagingPayload({
      status: "đã duyệt",
      isSigned: true,
      images: ["/uploads/real_slice_1.jpg", "/uploads/real_slice_2.jpg"],
      aiReport: {
        class_name: "notumor",
        confidence: 96.5,
        bounding_box: null // Không có tọa độ u
      }
    }));

    const req = {
      params: { id: cleanImaging._id.toString() },
      user: { id: doctorId.toString(), role: "doctor", hospitalId: hospitalId.toString() }
    };
    const res = makeMockRes();

    await getViewerManifest(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const manifest = res.body.data;

    // Không được trả về khung u giả
    expect(manifest.aiOverlay.boundingBox).toBeNull();

    // Không được tự ý nhân bản chuỗi T1C+ ngấm thuốc giả nếu dữ liệu chỉ có 1 chuỗi ảnh
    expect(manifest.series.length).toBe(1);
    expect(manifest.series[0].seriesId).toBe("series-default");
  });

  // ─── TEST 5: AI failure transitions visit to 'lỗi AI' and notifies doctor ──
  test("5. Lỗi phân tích AI chuyển lượt khám sang 'lỗi AI' và gửi thông báo ai_failed cho bác sĩ", async () => {
    const visitDoc = await Visit.create({
      hospitalId,
      patientId,
      doctorId,
      status: "chờ kết quả AI",
      mriOrder: {
        imagingType: "MRI_BRAIN",
        orderedAt: new Date()
      }
    });

    const failedImaging = await ImagingResult.create(makeImagingPayload({
      visitId: visitDoc._id,
      images: ["/uploads/corrupt_scan.jpg"]
    }));

    // Mô phỏng AI pipeline thất bại
    await markAiAnalysisFailed({
      imagingResultId: failedImaging._id,
      hospitalId,
      visitId: visitDoc._id,
      doctorId,
      reason: "GPU inference timeout / connection refused"
    });

    const updatedVisit = await Visit.findById(visitDoc._id);
    expect(updatedVisit.status).toBe("lỗi AI");

    const updatedImaging = await ImagingResult.findById(failedImaging._id);
    expect(updatedImaging.aiStatus).toBe("failed");
    expect(updatedImaging.aiError).toContain("GPU inference timeout");

    // Xác nhận đã tạo thông báo loại 'ai_failed' cho bác sĩ
    const notif = await Notification.findOne({
      recipientId: doctorId,
      type: "ai_failed"
    }).sort({ createdAt: -1 });

    expect(notif).toBeDefined();
    expect(notif.type).toBe("ai_failed");

    // Xác nhận bộ lọc hàng đợi getMyQueue của bác sĩ bao gồm lượt khám 'lỗi AI'
    const queueReq = {
      user: { id: doctorId.toString(), role: "doctor", hospitalId: hospitalId.toString() },
      query: {}
    };
    const queueRes = makeMockRes();
    await getMyQueue(queueReq, queueRes);

    expect(queueRes.statusCode).toBe(200);
    const inQueue = queueRes.body.visits.some(v => v._id.toString() === visitDoc._id.toString());
    expect(inQueue).toBe(true);
  });

  // ─── TEST 6: explain-ai returns 403 for patient on unsigned reports ───────
  test("6. Bệnh nhân bị từ chối 403 khi gọi explain-ai trên báo cáo chưa ký duyệt", async () => {
    const unsignedImaging = await ImagingResult.create(makeImagingPayload({
      status: "chờ duyệt",
      isSigned: false,
      aiReport: {
        class_name: "meningioma",
        confidence: 94.2
      }
    }));

    const req = {
      params: { id: unsignedImaging._id.toString() },
      user: { id: patientId.toString(), role: "patient", hospitalId: hospitalId.toString() }
    };
    const res = makeMockRes();

    await explainImagingResultAI(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("ký");
  });

  // ─── TEST 7: Chunked upload session ownership and file size enforcement ───
  test("7. Kiểm soát bảo mật tải lên theo phân đoạn (Chunked Upload Ownership & Quota)", async () => {
    // 7a. Từ chối tệp quá giới hạn 600MB
    const oversizeReq = {
      body: {
        fileName: "massive_dataset.zip",
        totalSizeBytes: 700 * 1024 * 1024, // 700MB > 600MB
        totalChunks: 60,
        patientId: String(patientId)
      },
      user: { id: doctorId.toString(), role: "doctor", hospitalId: hospitalId.toString() }
    };
    const oversizeRes = makeMockRes();
    await initChunkedUpload(oversizeReq, oversizeRes);
    expect(oversizeRes.statusCode).toBe(400);
    expect(oversizeRes.body.message).toContain("600MB");

    // 7b. Từ chối số lượng chunk vượt quá 1200
    const tooManyChunksReq = {
      body: {
        fileName: "fragmented.dcm",
        totalSizeBytes: 50 * 1024 * 1024,
        totalChunks: 1300,
        patientId: String(patientId)
      },
      user: { id: doctorId.toString(), role: "doctor", hospitalId: hospitalId.toString() }
    };
    const tooManyChunksRes = makeMockRes();
    await initChunkedUpload(tooManyChunksReq, tooManyChunksRes);
    expect(tooManyChunksRes.statusCode).toBe(400);

    // 7c. Tạo phiên hợp lệ cho BS A
    const validInitReq = {
      body: {
        fileName: "mri_series_valid.zip",
        totalSizeBytes: 20 * 1024 * 1024,
        totalChunks: 2,
        patientId: String(patientId)
      },
      user: { id: doctorId.toString(), role: "doctor", hospitalId: hospitalId.toString() }
    };
    const validInitRes = makeMockRes();
    await initChunkedUpload(validInitReq, validInitRes);
    expect(validInitRes.statusCode).toBe(201);
    const sessionId = validInitRes.body.data.uploadSessionId;
    expect(sessionId).toBeDefined();

    // 7d. Người dùng khác (otherUserId) cố tình ghi vào session của BS A -> 404 (fail-closed, không rò rỉ phiên)
    const hijackReq = {
      body: {
        uploadSessionId: sessionId,
        chunkIndex: 0,
        chunkBase64: Buffer.from("MALICIOUS_CHUNK_DATA").toString("base64")
      },
      user: { id: otherUserId.toString(), role: "doctor", hospitalId: hospitalId.toString() }
    };
    const hijackRes = makeMockRes();
    await uploadChunkPart(hijackReq, hijackRes);
    expect(hijackRes.statusCode).toBe(404);
  });
});
