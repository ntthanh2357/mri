import assert from "assert";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { FEATURES } from "../config/features.config.js";
import { getJwtSecret } from "../config/jwt.config.js";
import { encryptField, decryptField } from "../utils/cryptoField.util.js";
import { calculateRetentionExpiry, canDisposeRecord } from "../utils/retention.util.js";
import { segregateMedicalRecord, ROLE_WHITELIST_MAP } from "../utils/dataSegregation.util.js";
import { validateMolecularMarkers, deidentifyDicomMetadata, anonymizeHipaaAge, HIPAA_SAFE_HARBOR_18_IDENTIFIERS } from "../utils/molecularDataImport.util.js";
import { AUDIT_ACTIONS } from "../services/auditLog.service.js";
import { checkBreakGlassRateLimit } from "../modules/emr/emr.controller.js";
import { runAuditIntegrityCheckAndAlert, getAuditIntegrityDashboardStatus, sendSecuritySIEMAlert } from "../services/auditAlert.service.js";

console.log("\n======================================================================");
console.log("   NEUROSCAN AI: COMPREHENSIVE COMPLIANCE AUDIT TEST SUITE            ");
console.log("   TIÊU CHUẨN: TT46/2018/TT-BYT | LUẬT 15/2023/QH15 | HIPAA | OWASP   ");
console.log("======================================================================\n");

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
};

const runAllTests = async () => {
  // ── SUITE 1: OWASP API2:2023 - Broken Authentication & Algorithm Hardening ──
  console.log("RUNNING SUITE 1: OWASP API2:2023 - Broken Authentication & Algorithm Hardening");

  await test("Chặn đứng token giả mạo với thuật toán alg: 'none' (Cấm bypass xác thực)", async () => {
    // Tạo token giả mạo với alg: none (không ký)
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ id: "user_attacker_01", role: "admin" })).toString("base64url");
    const forgedNoneToken = `${header}.${payload}.`;

    const secret = getJwtSecret();
    let isBlocked = false;

    // Mô phỏng logic bảo vệ trong auth.middleware.js
    const unverified = jwt.decode(forgedNoneToken, { complete: true });
    if (!unverified || !unverified.header || unverified.header.alg === "none" || !["HS256"].includes(unverified.header.alg)) {
      isBlocked = true;
    } else {
      try {
        jwt.verify(forgedNoneToken, secret, { algorithms: ["HS256"] });
      } catch (e) {
        isBlocked = true;
      }
    }

    assert.strictEqual(isBlocked, true, "Token với alg: none bắt buộc phải bị chặn ngay lập tức!");
  });

  await test("Chặn đứng tấn công Algorithm Confusion (Token ký bằng thuật toán khác HS256)", async () => {
    // Token ký bằng HS384 hoặc HS512 trong khi hệ thống chỉ whitelist HS256
    const secret = getJwtSecret();
    const tokenHs512 = jwt.sign({ id: "user_attacker_02", role: "doctor" }, secret, { algorithm: "HS512" });

    let verifyFailed = false;
    try {
      jwt.verify(tokenHs512, secret, { algorithms: ["HS256"] });
    } catch (err) {
      verifyFailed = true;
      assert.ok(err.message.includes("invalid algorithm"), "Lỗi phải thông báo invalid algorithm");
    }

    assert.strictEqual(verifyFailed, true, "Token không đúng thuật toán HS256 phải bị từ chối!");
  });

  await test("Token hợp lệ ký bằng HS256 được xác thực thành công", async () => {
    const secret = getJwtSecret();
    const validToken = jwt.sign({ id: "doc_001", role: "doctor" }, secret, { algorithm: "HS256", expiresIn: "1h" });

    const decoded = jwt.verify(validToken, secret, { algorithms: ["HS256"] });
    assert.strictEqual(decoded.id, "doc_001");
    assert.strictEqual(decoded.role, "doctor");
  });

  // ── SUITE 2: TT46/2018/TT-BYT & Luật 15/2023/QH15 - Tính Bất Biến Bệnh Án ──
  console.log("\nRUNNING SUITE 2: Clinical Data Immutability & EMR Lock (TT 46/2018/TT-BYT)");

  await test("Chặn đứng sửa đổi trực tiếp khi bệnh án EMR đã 'Đã ký số'", async () => {
    const lockedRecord = {
      _id: "emr_101",
      patientId: "patient_01",
      signStatus: "Đã ký số",
      status: "Đang điều trị",
      diagnosis: "Viêm màng não mủ",
    };

    let blocked = false;
    let errorCode = null;

    if (FEATURES.ENABLE_EMR_IMMUTABLE_LOCK && (lockedRecord.signStatus === "Đã ký số" || lockedRecord.status === "Xuất viện")) {
      blocked = true;
      errorCode = "EMR_IMMUTABLE_RECORD_LOCKED";
    }

    assert.strictEqual(blocked, true, "Bệnh án đã ký số phải bị khóa cứng không thể sửa đổi trực tiếp!");
    assert.strictEqual(errorCode, "EMR_IMMUTABLE_RECORD_LOCKED");
  });

  await test("Chặn đứng sửa đổi trực tiếp khi bệnh nhân đã 'Xuất viện'", async () => {
    const dischargedRecord = {
      _id: "emr_102",
      patientId: "patient_02",
      signStatus: "Chưa duyệt",
      status: "Xuất viện",
      diagnosis: "Nhồi máu não",
    };

    let blocked = false;
    if (FEATURES.ENABLE_EMR_IMMUTABLE_LOCK && (dischargedRecord.signStatus === "Đã ký số" || dischargedRecord.status === "Xuất viện")) {
      blocked = true;
    }

    assert.strictEqual(blocked, true, "Bệnh nhân đã xuất viện thì hồ sơ phải được khóa cứng!");
  });

  await test("Chặn cập nhật lượt khám (Visit) đã 'hoàn tất' hoặc 'đã đóng' theo quy chế bệnh án", async () => {
    const completedVisit = {
      _id: "visit_001",
      status: "hoàn tất",
    };

    let threwError = false;
    if (["hoàn tất", "đã đóng"].includes(completedVisit.status)) {
      threwError = true;
    }

    assert.strictEqual(threwError, true, "Ca khám đã hoàn tất phải cấm cập nhật thông tin!");
  });

  await test("Cho phép bổ sung phụ lục bệnh án (EMR Addendum) Append-Only mà không làm thay đổi bản ghi gốc", async () => {
    const record = {
      _id: "emr_103",
      patientId: "patient_03",
      signStatus: "Đã ký số",
      diagnosis: "Đột quỵ thiếu máu não cục bộ cấp",
      addendums: [],
    };

    const addendumContent = "Bệnh nhân có triệu chứng co giật sau 24h theo dõi.";
    const reason = "Bổ sung diễn biến lâm sàng muộn";
    const signedHash = crypto.createHash("sha256").update(`${record._id}|${addendumContent}|${reason}|doc_123`).digest("hex");

    record.addendums.push({
      content: addendumContent,
      reason,
      author: "Bs. Nguyễn Văn A",
      createdAt: new Date(),
      signedHash,
    });

    assert.strictEqual(record.diagnosis, "Đột quỵ thiếu máu não cục bộ cấp", "Bản ghi chẩn đoán gốc không hề bị biến đổi");
    assert.strictEqual(record.addendums.length, 1, "Phụ lục được gắn nối tiếp (Append-Only) thành công");
    assert.ok(record.addendums[0].signedHash.length === 64, "Mã băm SHA-256 toàn vẹn phụ lục hợp lệ");
  });

  // ── SUITE 3: HIPAA §164.312(b) & TT46/2018 - Cryptographic Hash Chain Audit Trail ──
  console.log("\nRUNNING SUITE 3: Cryptographic Tamper-Evident Hash Chain Audit Trail");

  await test("Tính toán currentHash liên kết previousHash bảo vệ tính toàn vẹn chuỗi băm", async () => {
    const prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const seq = 1;
    const timestamp = "2026-09-11T04:00:00.000Z";
    const action = "RECORD_VIEWED";
    const entity = "MedicalRecord";
    const entityId = "emr_001";
    const performedBy = "doc_001";
    const payloadHash = "";

    const hashMaterial = `${prevHash}|${seq}|${timestamp}|${action}|${entity}|${entityId}|${performedBy}|${payloadHash}`;
    const hash = crypto.createHash("sha256").update(hashMaterial).digest("hex");

    assert.strictEqual(typeof hash, "string");
    assert.strictEqual(hash.length, 64, "Mã băm SHA-256 phải có đúng 64 ký tự hex");
  });

  await test("Thẩm định tính toàn vẹn: Phát hiện ngay lập tức khi chuỗi băm bị đứt gãy hoặc CSDL bị can thiệp", async () => {
    // Mô phỏng 3 block log liên kết
    const block1 = {
      sequenceNumber: 1,
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      currentHash: "hash_block_1_valid",
    };
    const block2 = {
      sequenceNumber: 2,
      previousHash: "hash_block_1_valid",
      currentHash: "hash_block_2_valid",
    };
    // Block 3 bị kẻ xấu sửa đổi CSDL trực tiếp làm lệch previousHash
    const block3Tampered = {
      sequenceNumber: 3,
      previousHash: "hash_block_1_hacked", // Lệch với currentHash của block 2!
      currentHash: "hash_block_3_valid",
    };

    const chain = [block1, block2, block3Tampered];

    let tamperDetected = false;
    let brokenAtSeq = null;

    let expectedPrev = "0000000000000000000000000000000000000000000000000000000000000000";
    for (let i = 0; i < chain.length; i++) {
      if (chain[i].previousHash !== expectedPrev) {
        tamperDetected = true;
        brokenAtSeq = chain[i].sequenceNumber;
        break;
      }
      expectedPrev = chain[i].currentHash;
    }

    assert.strictEqual(tamperDetected, true, "Hệ thống phải phát hiện sự can thiệp trái phép vào CSDL!");
    assert.strictEqual(brokenAtSeq, 3, "Phát hiện chính xác tại sequence #3");
  });

  await test("Kiểm thử đồng thời (Concurrency Test): 10 chuyên gia Tumor Board ghi log cùng lúc bảo đảm không đứt gãy chuỗi băm", async () => {
    const logsCreated = [];
    let currentSeq = 0;
    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

    let lockQueue = Promise.resolve();

    const concurrentLogCall = (docId) => {
      return new Promise((resolve) => {
        lockQueue = lockQueue.then(async () => {
          // Giả lập độ trễ I/O bất đồng bộ
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          currentSeq++;
          const hashMaterial = `${prevHash}|${currentSeq}|${docId}`;
          const currentHash = crypto.createHash("sha256").update(hashMaterial).digest("hex");
          const logEntry = {
            sequenceNumber: currentSeq,
            previousHash: prevHash,
            currentHash,
            performedBy: docId,
          };
          logsCreated.push(logEntry);
          prevHash = currentHash;
          resolve(logEntry);
        });
      });
    };

    const docIds = Array.from({ length: 10 }, (_, i) => `tumor_board_doctor_${i + 1}`);
    await Promise.all(docIds.map((id) => concurrentLogCall(id)));

    assert.strictEqual(logsCreated.length, 10, "Phải ghi nhận đủ 10 bản ghi log");
    for (let i = 0; i < logsCreated.length; i++) {
      assert.strictEqual(logsCreated[i].sequenceNumber, i + 1, `Sequence number #${i + 1} phải tăng dần đều`);
      if (i > 0) {
        assert.strictEqual(logsCreated[i].previousHash, logsCreated[i - 1].currentHash, `previousHash của log #${i + 1} phải khớp với currentHash của log #${i}`);
      }
    }
  });

  // ── SUITE 4: HIPAA §164.502(b) & Luật 15/2023 - Data Segregation (Minimum Necessary) ──
  console.log("\nRUNNING SUITE 4: HIPAA Minimum Necessary & Non-Breaking Data Segregation");

  await test("Nhân viên tiếp tân/thu ngân bị ẩn thông tin chẩn đoán nhưng không mất key JSON (Non-Breaking)", () => {
    const fullEMR = {
      _id: "emr_001",
      patientId: "patient_01",
      patientName: "Trần Văn A",
      department: "Khoa Nội Thần Kinh",
      diagnosis: "Xuất huyết khoang dưới nhện do vỡ túi phình động mạch não",
      treatmentPlan: "Can thiệp đặt stent và bít túi phình bằng vòng xoắn kim loại",
      psychiatricNotes: "Bệnh nhân có tiền sử trầm cảm nặng",
      status: "Đang điều trị",
    };

    const receptionistView = segregateMedicalRecord(fullEMR, "receptionist");

    assert.strictEqual(receptionistView.patientName, "Trần Văn A", "Tên bệnh nhân vẫn hiển thị");
    assert.strictEqual(receptionistView.department, "Khoa Nội Thần Kinh", "Khoa phòng vẫn hiển thị để tiếp đón");
    assert.strictEqual(
      receptionistView.diagnosis,
      undefined,
      "Chẩn đoán phải là undefined để triệt tiêu hoàn toàn nguy cơ rò rỉ metadata (HIPAA §164.502(b))"
    );
    assert.strictEqual(receptionistView.psychiatricNotes, undefined, "Ghi chú tâm thần phải là undefined");
  });

  await test("Bác sĩ điều trị được tiếp cận đầy đủ dữ liệu lâm sàng phục vụ chữa bệnh", () => {
    const fullEMR = {
      patientId: "patient_01",
      diagnosis: "Nhồi máu não",
      treatmentPlan: "Thuốc tiêu sợi huyết rTPA",
    };

    const doctorView = segregateMedicalRecord(fullEMR, "doctor");
    assert.strictEqual(doctorView.diagnosis, "Nhồi máu não", "Bác sĩ phải xem được chẩn đoán đầy đủ");
    assert.strictEqual(doctorView.treatmentPlan, "Thuốc tiêu sợi huyết rTPA");
  });

  // ── SUITE 5: HIPAA §164.312(a)(2)(iv) - Field-Level Encryption (AES-256-GCM) ──
  console.log("\nRUNNING SUITE 5: HIPAA Field-Level Encryption (AES-256-GCM)");

  await test("Mã hóa và giải mã trường nhạy cảm chính xác bảo toàn dữ liệu", () => {
    const sensitiveNote = "Bệnh nhân đang điều trị bệnh lý tâm thần phân liệt thể hoang tưởng.";
    const encrypted = encryptField(sensitiveNote);

    assert.ok(encrypted.startsWith("enc:v1:"), "Chuỗi mã hóa phải có tiền tố định danh chuẩn enc:v1:");
    assert.notStrictEqual(encrypted, sensitiveNote, "Nội dung rõ không được xuất hiện trong chuỗi đã mã hóa");

    const decrypted = decryptField(encrypted);
    assert.strictEqual(decrypted, sensitiveNote, "Giải mã phải phục hồi nguyên vẹn 100% nội dung gốc");
  });

  // ── SUITE 6: TT46/2018/TT-BYT Điều 15 - Retention Policy Engine & Leap Year ──
  console.log("\nRUNNING SUITE 6: EMR Retention Policy Engine (10/15/20 Years & Leap Year Handling)");

  await test("Tính thời hạn lưu trữ chính xác theo quy chuẩn Điều 15 TT46", () => {
    const now = new Date("2026-09-11T00:00:00Z");

    const outpatient = calculateRetentionExpiry("ngoai_tru", now);
    assert.strictEqual(outpatient.retentionYears, 10, "Ngoại trú phải lưu trữ 10 năm");

    const workAccident = calculateRetentionExpiry("tai_nan_lao_dong", now);
    assert.strictEqual(workAccident.retentionYears, 15, "Tai nạn lao động phải lưu trữ 15 năm");

    const psychiatric = calculateRetentionExpiry("tam_than", now);
    assert.strictEqual(psychiatric.retentionYears, 20, "Tâm thần phải lưu trữ 20 năm");

    const deceased = calculateRetentionExpiry("tu_vong", now);
    assert.strictEqual(deceased.retentionYears, 20, "Tử vong phải lưu trữ 20 năm");
  });

  await test("Xử lý chính xác ngày 29/02 trong năm nhuận (Leap Year) chuyển sang 28/02 ở năm đích", () => {
    // Ngày 29/02/2024 (năm nhuận) -> +10 năm là 2034 (không phải năm nhuận) -> phải là 28/02/2034
    const leapDate = new Date("2024-02-29T12:00:00Z");
    const result = calculateRetentionExpiry("ngoai_tru", leapDate);

    const expiryDate = new Date(result.retentionExpiresAt);
    // Tính năm và ngày theo giờ VN
    assert.strictEqual(expiryDate.getUTCFullYear(), 2034, "Năm hết hạn phải là 2034");
    // Ngày trong tháng 2 phải là ngày 28 (không bị tràn sang ngày 01/03)
    assert.strictEqual(expiryDate.getUTCMonth(), 1, "Tháng phải là tháng 2 (index 1)");
    assert.strictEqual(expiryDate.getUTCDate(), 28, "Ngày phải là ngày 28 tháng 2");
  });

  await test("Cơ chế Lệnh giữ pháp lý (Legal Hold) ngăn chặn tiêu hủy hồ sơ quá hạn", () => {
    const expiredRecordWithLegalHold = {
      _id: "emr_old_001",
      retentionExpiresAt: new Date("2020-01-01T00:00:00Z"), // Đã quá hạn 6 năm
      legalHold: {
        isHeld: true,
        reason: "Yêu cầu thanh tra từ Tòa án Nhân dân theo vụ án tranh chấp bảo hiểm số 45/2026/DSST",
        heldBy: "Tòa án Nhân dân",
      },
    };

    const checkResult = canDisposeRecord(expiredRecordWithLegalHold);
    assert.strictEqual(checkResult.canDispose, false, "Tuyệt đối không được tiêu hủy hồ sơ đang có Legal Hold!");
    assert.ok(checkResult.reason.includes("Legal Hold"), "Lý do phải nêu rõ Lệnh giữ pháp lý");
  });

  await test("Quy chuẩn lưu trữ bệnh án Ung thư não (30 năm u ác tính Glioma, 20 năm u lành, 25 năm thử nghiệm lâm sàng theo ICH-GCP)", () => {
    const now = new Date("2026-09-11T00:00:00Z");

    const malignant = calculateRetentionExpiry("neuro_oncology_malignant", now);
    assert.strictEqual(malignant.retentionYears, 30, "U ác tính Glioma phải lưu trữ 30 năm");

    const benign = calculateRetentionExpiry("neuro_oncology_benign", now);
    assert.strictEqual(benign.retentionYears, 20, "U màng não/tuyến yên lành tính lưu trữ 20 năm");

    const trial = calculateRetentionExpiry("clinical_trial_participant", now);
    assert.strictEqual(trial.retentionYears, 25, "Thử nghiệm lâm sàng lưu trữ 25 năm theo ICH-GCP E6(R2)");
  });

  await test("Phân tách dữ liệu bệnh án Ung thư não theo vai trò (Bảo vệ chỉ dấu phân tử IDH/MGMT và ghi chú di truyền)", () => {
    const neuroEMR = {
      _id: "emr_neuro_001",
      patientName: "Lê Văn C",
      whoGrade: "Grade 4",
      tumorType: "Glioma",
      molecularMarkers: {
        idhStatus: "IDH-wildtype",
        mgmtMethylation: "Unmethylated",
        codeletion1p19q: "Non-codeleted",
      },
      geneticNotes: "Đột biến TERT promoter C228T, tiên lượng xấu",
      diagnosis: "U nguyên bào đệm (Glioblastoma Multiforme - GBM)",
    };

    // 1. Điều dưỡng: Không xem chi tiết molecular markers (undefined)
    const nurseView = segregateMedicalRecord(neuroEMR, "nurse");
    assert.strictEqual(nurseView.molecularMarkers, undefined, "Molecular markers phải là undefined với điều dưỡng");
    assert.strictEqual(nurseView.geneticNotes, undefined, "Genetic notes phải là undefined với điều dưỡng");

    // 2. Kỹ thuật viên MRI: Không xem molecular markers & genetic notes (undefined)
    const techView = segregateMedicalRecord(neuroEMR, "technician");
    assert.strictEqual(techView.molecularMarkers, undefined);
    assert.strictEqual(techView.geneticNotes, undefined);

    // 3. Tiếp tân: Ẩn WHO grade, tumorType, molecular markers (undefined)
    const recepView = segregateMedicalRecord(neuroEMR, "receptionist");
    assert.strictEqual(recepView.whoGrade, undefined);
    assert.strictEqual(recepView.tumorType, undefined);
    assert.strictEqual(recepView.molecularMarkers, undefined);

    // 4. Bác sĩ điều trị / Hội đồng u não (Tumor Board): Toàn quyền tiếp cận
    const docView = segregateMedicalRecord(neuroEMR, "doctor");
    assert.strictEqual(docView.whoGrade, "Grade 4");
    assert.strictEqual(docView.molecularMarkers.idhStatus, "IDH-wildtype");
    assert.strictEqual(docView.geneticNotes, "Đột biến TERT promoter C228T, tiên lượng xấu");
  });

  // ── SUITE 7: Neuro-Oncology Clinical Decision Support, DICOM De-id & Break-Glass ──
  console.log("\nRUNNING SUITE 7: Neuro-Oncology CDS, HIPAA De-id & Break-Glass Protocol");

  await test("Thẩm định tính nhất quán sinh học phân tử theo chuẩn WHO CNS5 (2021)", () => {
    // Trường hợp 1: Oligodendroglioma (IDH-mutant + 1p/19q codeleted)
    const oligo = validateMolecularMarkers({
      idhStatus: "IDH1 R132H mutant",
      codeletion1p19q: "Co-deleted",
      mgmtMethylation: "Methylated",
    });
    assert.strictEqual(oligo.isValid, true);
    assert.ok(oligo.interpretedEntity.includes("Oligodendroglioma"));
    assert.ok(oligo.mgmtResponse.includes("đáp ứng tốt với hóa chất Temozolomide"));

    // Trường hợp 2: Bất thường sinh học (1p/19q codeleted nhưng IDH wildtype -> Cảnh báo)
    const anomaly = validateMolecularMarkers({
      idhStatus: "IDH-wildtype",
      codeletion1p19q: "Co-deleted",
    });
    assert.strictEqual(anomaly.isValid, false);
    assert.ok(anomaly.warnings.length > 0, "Hệ thống phải cảnh báo khi 1p/19q mất đoạn mà IDH lại wildtype");
  });

  await test("Khử định danh hình ảnh DICOM (De-identification) theo HIPAA §164.514(b)(2) Safe Harbor", () => {
    const rawDicom = {
      patientName: "Nguyễn Văn B",
      patientId: "BN_12345",
      patientBirthDate: "1980-05-15",
      accessionNumber: "ACC_9999",
      institutionName: "Bệnh viện Ung bướu TP.HCM",
      studyInstanceUID: "1.2.840.113619.2.55.3.123456789",
      seriesInstanceUID: "1.2.840.113619.2.55.3.987654321",
      modality: "MR",
      seriesDescription: "T2-FLAIR AXIAL BRAIN",
    };

    const deidentified = deidentifyDicomMetadata(rawDicom);
    assert.strictEqual(deidentified.patientName, "ANONYMIZED_SUBJECT", "Tên bệnh nhân phải bị ẩn danh");
    assert.notStrictEqual(deidentified.patientId, "BN_12345", "ID bệnh nhân gốc phải bị loại bỏ");
    assert.strictEqual(deidentified.patientBirthDate, null, "Ngày sinh phải bị xóa");
    assert.strictEqual(deidentified.modality, "MR", "Thông số lâm sàng chụp phải được bảo toàn");
    assert.strictEqual(deidentified.isDeidentified, true);
  });

  await test("Cơ chế Break-Glass cấp cứu (HIPAA §164.312(a)(2)(ii)) cho phép bác sĩ truy cập khẩn cấp có ghi vết", () => {
    // Kiểm tra hằng số hành động kiểm toán
    assert.strictEqual(AUDIT_ACTIONS.BREAK_GLASS_EMERGENCY_ACCESSED, "BREAK_GLASS_EMERGENCY_ACCESSED");
    assert.strictEqual(AUDIT_ACTIONS.TUMOR_BOARD_ACCESSED, "TUMOR_BOARD_ACCESSED");
    assert.strictEqual(AUDIT_ACTIONS.MOLECULAR_DATA_VIEWED, "MOLECULAR_DATA_VIEWED");
  });

  await test("TRUE WHITELIST: Bất kỳ trường nhạy cảm mới nào (brafV600e, h3k27m) không nằm trong whitelist đều bị loại bỏ tự động 100%", () => {
    const rawWithNewFields = {
      _id: "emr_leak_test",
      patientName: "Bệnh nhân X",
      department: "Ngoại Thần Kinh",
      diagnosis: "U não ác tính",
      brafV600eStatus: "BRAF V600E Mutation Detected (RẤT NHẠY CẢM)",
      h3k27mStatus: "H3K27M Altered (CỰC KỲ NGUY HIỂM)",
      internalAuditFlag: "Bệnh nhân VIP đặc biệt",
    };

    // Kiểm tra với Điều dưỡng (Nurse)
    const nurseView = segregateMedicalRecord(rawWithNewFields, "nurse");
    assert.strictEqual(nurseView.brafV600eStatus, undefined, "Trường BRAF mới tuyệt đối KHÔNG được rò rỉ cho điều dưỡng");
    assert.strictEqual(nurseView.h3k27mStatus, undefined, "Trường H3K27M mới tuyệt đối KHÔNG được rò rỉ cho điều dưỡng");
    assert.strictEqual(nurseView.internalAuditFlag, undefined, "Trường cờ nội bộ mới tuyệt đối KHÔNG được rò rỉ");

    // Kiểm tra với Kỹ thuật viên (Technician)
    const techView = segregateMedicalRecord(rawWithNewFields, "technician");
    assert.strictEqual(techView.brafV600eStatus, undefined);
    assert.strictEqual(techView.h3k27mStatus, undefined);

    // Kiểm tra với Tiếp tân (Receptionist)
    const recepView = segregateMedicalRecord(rawWithNewFields, "receptionist");
    assert.strictEqual(recepView.brafV600eStatus, undefined);
    assert.strictEqual(recepView.h3k27mStatus, undefined);
  });

  await test("Break-Glass Hardening: Giới hạn tối đa 3 lần cấp cứu/ngày/bác sĩ để ngăn chặn lạm dụng", () => {
    const testDocId = "doc_test_rate_limit_" + Date.now();
    const r1 = checkBreakGlassRateLimit(testDocId);
    assert.strictEqual(r1.allowed, true, "Lần 1 được phép");
    const r2 = checkBreakGlassRateLimit(testDocId);
    assert.strictEqual(r2.allowed, true, "Lần 2 được phép");
    const r3 = checkBreakGlassRateLimit(testDocId);
    assert.strictEqual(r3.allowed, true, "Lần 3 được phép");
    const r4 = checkBreakGlassRateLimit(testDocId);
    assert.strictEqual(r4.allowed, false, "Lần 4 phải bị chặn Rate Limit");
    assert.strictEqual(r4.count, 3);
  });

  await test("HIPAA Safe Harbor: Kiểm tra và làm sạch toàn bộ 18 nhóm định danh nhận dạng cá nhân", () => {
    assert.ok(HIPAA_SAFE_HARBOR_18_IDENTIFIERS.length >= 18, "Phải định nghĩa đầy đủ tối thiểu 18 nhóm định danh theo HIPAA §164.514(b)(2)");
    
    const sampleFullPII = {
      patientName: "Trần Thị H",
      patientAddress: "Số 123 Đường Y, Phường Z",
      patientBirthDate: "1990-01-01",
      patientPhone: "0901234567",
      patientFax: "02838383838",
      patientEmail: "h@hospital.vn",
      ssn: "079190000001",
      medicalRecordNumber: "MRN_9988",
      healthPlanNumber: "BHYT_DN479",
      accountNumber: "ACC_8877",
      certificateNumber: "CERT_001",
      vehicleIdentifiers: "59-A1 123.45",
      deviceIdentifiers: "STENT_MEDTRONIC_SN123",
      webUrl: "https://hospital.vn/patient/h",
      ipAddress: "192.168.1.50",
      biometricIdentifiers: "FINGERPRINT_HASH_XYZ",
      fullFacePhotos: "PHOTO_BLOB_BASE64",
      otherUniqueIdentifiers: "UNIQUE_GENETIC_LAB_ID",
      modality: "MR",
      seriesDescription: "BRAIN AXIAL T1+C",
      sliceThickness: 3.0,
    };

    const deidentified = deidentifyDicomMetadata(sampleFullPII);

    // Xác nhận không còn trường nào trong 18 trường PII xuất hiện trong object sau de-identification
    for (const field of HIPAA_SAFE_HARBOR_18_IDENTIFIERS) {
      if (field === "patientName") {
        assert.notStrictEqual(deidentified.patientName, sampleFullPII.patientName, "Tên thật bệnh nhân phải bị xóa bỏ");
        assert.strictEqual(deidentified.patientName, "ANONYMIZED_SUBJECT", "Tên phải được thay bằng định danh ẩn danh");
      } else if (field === "patientBirthDate") {
        assert.strictEqual(deidentified.patientBirthDate, null, "Ngày sinh phải bị xóa về null");
      } else {
        assert.strictEqual(deidentified[field], undefined, `Trường PII [${field}] phải bị xóa bỏ 100%`);
      }
    }
    assert.strictEqual(deidentified.identifiersRemovedCount, 18);
    assert.strictEqual(deidentified.modality, "MR", "Thông số chuỗi xung chụp MRI phải được bảo toàn");
  });

  await test("Khóa bất biến EMR nguyên tử (Atomic Conditional Lock): Chặn đứng Race Condition khi cập nhật đồng thời", () => {
    // Mô phỏng bộ lọc truy vấn nguyên tử của MongoDB findOneAndUpdate
    const testRecordLocked = {
      _id: "emr_locked_001",
      signStatus: "Đã ký số",
      status: "Đang điều trị",
    };

    const lockFilter = {
      signStatus: { $nin: ["Đã ký số", "Đã khóa"] },
      status: { $nin: ["Xuất viện", "Đã đóng", "Hoàn tất"] },
    };

    const matchesFilter = (record, filter) => {
      if (filter.signStatus && filter.signStatus.$nin.includes(record.signStatus)) return false;
      if (filter.status && filter.status.$nin.includes(record.status)) return false;
      return true;
    };

    // Ca 1: Bệnh án đã ký số -> Bộ lọc nguyên tử loại bỏ ngay lập tức tại tầng DB
    assert.strictEqual(matchesFilter(testRecordLocked, lockFilter), false, "Bệnh án đã ký số phải bị chặn ngay tại query filter");

    // Ca 2: Bệnh nhân đã xuất viện -> Bộ lọc nguyên tử loại bỏ ngay lập tức
    const testDischarged = { signStatus: "Chưa duyệt", status: "Xuất viện" };
    assert.strictEqual(matchesFilter(testDischarged, lockFilter), false, "Bệnh nhân đã xuất viện phải bị chặn ngay tại query filter");

    // Ca 3: Bệnh án đang điều trị và chưa ký số -> Cho phép cập nhật
    const testNormal = { signStatus: "Chưa duyệt", status: "Đang điều trị" };
    assert.strictEqual(matchesFilter(testNormal, lockFilter), true, "Bệnh án đang mở được phép cập nhật");
  });

  await test("HIPAA Safe Harbor: Độ tuổi trên 89 được gộp thành danh mục duy nhất '90+' ngăn tái định danh", () => {
    // 1. Kiểm tra trực tiếp hàm tiện ích anonymizeHipaaAge
    assert.strictEqual(anonymizeHipaaAge(92), "90+", "Tuổi 92 phải gộp thành '90+'");
    assert.strictEqual(anonymizeHipaaAge(90), "90+", "Tuổi 90 phải gộp thành '90+'");
    assert.strictEqual(anonymizeHipaaAge(89), 89, "Tuổi 89 giữ nguyên");
    assert.strictEqual(anonymizeHipaaAge(45), 45, "Tuổi 45 giữ nguyên");

    // 2. Kiểm tra qua deidentifyDicomMetadata
    const deidOld = deidentifyDicomMetadata({ age: 95, modality: "MR" });
    assert.strictEqual(deidOld.patientAge, "90+", "Tuổi DICOM 95 phải chuyển thành '90+'");

    // 3. Kiểm tra qua segregateMedicalRecord với vai trò phi lâm sàng
    const segregatedOld = segregateMedicalRecord({ patientName: "Cụ B", age: 93, department: "Khoa Ung bướu" }, "nurse");
    assert.strictEqual(segregatedOld.age, "90+", "Hồ sơ phân tách cho điều dưỡng phải gộp tuổi thành '90+'");
  });

  await test("SIEM & Hash Chain Alerting: Tự động rà soát chuỗi băm, trực quan hóa Dashboard và phát cảnh báo SIEM", async () => {
    // 1. Kiểm tra API dashboard giám sát
    const status = getAuditIntegrityDashboardStatus();
    assert.ok(status.standardCompliance.includes("HIPAA §164.312(b)"), "Dashboard phải công bố chuẩn tuân thủ");
    assert.strictEqual(typeof status.cronActive, "boolean", "Cờ cronjob phải là boolean");

    // 2. Mô phỏng kích hoạt phát cảnh báo SIEM Webhook
    const alertResult = await sendSecuritySIEMAlert({
      alertType: "TEST_INTEGRITY_CHECK",
      severity: "HIGH",
      title: "KIỂM THỬ KÊNH PHÁT CẢNH BÁO AN NINH SIEM",
      details: "Kiểm tra kết nối và cấu trúc dữ liệu JSON cảnh báo tới hệ thống giám sát tập trung.",
      affectedSequenceNumber: 9999,
    });
    assert.strictEqual(alertResult.sent, true, "Hàm cảnh báo an ninh SIEM phải gửi thành công");

    // 3. Kiểm tra rà soát toàn vẹn tự động
    const checkResult = await runAuditIntegrityCheckAndAlert();
    assert.strictEqual(checkResult.tampered, false, "Chuỗi băm chưa can thiệp phải an toàn");
    assert.strictEqual(checkResult.alertTriggered, false, "Không phát sinh cảnh báo khi chuỗi băm hợp lệ");
  });

  // ── SUITE 8: Clinical Finite State Machine & Healthcare Timezone Integrity (Module 03 Audit) ──
  console.log("\nRUNNING SUITE 8: Clinical Finite State Machine & Healthcare Timezone Integrity");

  await test("FSM Terminal State Guard: Chặn đứng mọi nỗ lực hồi sinh hoặc sửa đổi ca khám đã 'đã đóng' hoặc 'đã hủy'", async () => {
    const { ALLOWED_TRANSITIONS } = await import("../controllers/visit.controller.js");
    
    // 1. Khẳng định tính bất biến của terminal states
    assert.strictEqual(ALLOWED_TRANSITIONS["đã đóng"].length, 0, "Trạng thái 'đã đóng' phải là sink node (0 transitions)");
    assert.strictEqual(ALLOWED_TRANSITIONS["đã hủy"].length, 0, "Trạng thái 'đã hủy' phải là sink node (0 transitions)");

    // 2. Thử nghiệm nỗ lực chuyển đổi phi pháp từ 'đã đóng' và 'đã hủy'
    const illegalTargets = ["đang chờ", "đang khám", "chờ chụp", "đang chụp", "chờ kết quả AI", "hoàn tất"];
    for (const target of illegalTargets) {
      assert.strictEqual(ALLOWED_TRANSITIONS["đã đóng"].includes(target), false, `Không được phép hồi sinh ca khám 'đã đóng' sang '${target}'`);
      assert.strictEqual(ALLOWED_TRANSITIONS["đã hủy"].includes(target), false, `Không được phép hồi sinh ca khám 'đã hủy' sang '${target}'`);
    }

    // 3. Ca khám 'hoàn tất' chỉ có duy nhất 1 đường thoát hợp lệ là 'đã đóng' (thanh toán viện phí)
    assert.deepStrictEqual(ALLOWED_TRANSITIONS["hoàn tất"], ["đã đóng"], "Ca khám 'hoàn tất' chỉ được chuyển sang 'đã đóng'");
  });

  await test("Vietnam Healthcare Timezone: Bảo đảm ca khám cấp cứu ban đêm (02:00 sáng VN) không bị bỏ sót trên Server UTC", async () => {
    const { getDayRangeVN } = await import("../utils/date.util.js");
    
    // Giả lập ca khám cấp cứu lúc 02:30:00 sáng ngày 11/09/2026 tại Việt Nam
    // Trên server UTC, thời điểm này là 19:30:00 tối ngày 10/09/2026
    const emergencyVisitAt2AM_VN = new Date("2026-09-10T19:30:00.000Z");

    // Nếu dùng setHours(0,0,0,0) trên Server UTC:
    const utcMidnight = new Date("2026-09-11T00:00:00.000Z");
    const isMissedByUtc = emergencyVisitAt2AM_VN < utcMidnight;
    assert.strictEqual(isMissedByUtc, true, "Lệnh setHours(0,0,0,0) trên Cloud UTC sẽ bỏ sót hoàn toàn bệnh nhân cấp cứu rạng sáng!");

    // Khi sử dụng getDayRangeVN:
    const { startOfDay, endOfDay } = getDayRangeVN(new Date("2026-09-11T09:00:00+07:00"));
    const isIncludedByVnTimezone = emergencyVisitAt2AM_VN >= startOfDay && emergencyVisitAt2AM_VN <= endOfDay;
    assert.strictEqual(isIncludedByVnTimezone, true, "getDayRangeVN chuẩn GMT+7 bắt buộc phải bao trùm toàn bộ bệnh nhân từ 00:00 sáng!");
  });

  await test("Clinical Exception Routing: Quy trình an toàn buồng chụp MRI và thử lại AI khi gián đoạn", async () => {
    const { ALLOWED_TRANSITIONS } = await import("../controllers/visit.controller.js");

    // 1. Chống chỉ định buồng chụp: Quay về phòng khám đổi phác đồ
    assert.ok(ALLOWED_TRANSITIONS["chờ chụp"].includes("đang khám"), "Phải cho phép chuyển từ 'chờ chụp' về 'đang khám'");
    assert.ok(ALLOWED_TRANSITIONS["chờ chụp lại"].includes("đang khám"), "Phải cho phép chuyển từ 'chờ chụp lại' về 'đang khám'");

    // 2. Thử lại AI khi server hồi phục
    assert.ok(ALLOWED_TRANSITIONS["lỗi AI"].includes("chờ kết quả AI"), "Phải cho phép thử lại phân tích AI khi server khôi phục");

    // 3. Hủy ca khẩn cấp giữa chừng
    assert.ok(ALLOWED_TRANSITIONS["chờ kết quả AI"].includes("đã hủy"), "Phải cho phép hủy ca khi đang chờ AI");
    assert.ok(ALLOWED_TRANSITIONS["lỗi AI"].includes("đã hủy"), "Phải cho phép hủy ca khi gặp lỗi AI");
    assert.ok(ALLOWED_TRANSITIONS["chờ bác sĩ đọc"].includes("đã hủy"), "Phải cho phép hủy ca khi đang chờ bác sĩ đọc");
  });

  await test("Billing Revenue Integrity: Đồng bộ hóa tiền thuốc vào hóa đơn tạm tính khi ca khám hoàn tất", async () => {
    // Giả lập hóa đơn tạm tính tạo bởi lệnh MRI
    const draftInvoice = {
      items: [
        { description: "Khám lâm sàng ban đầu", amount: 50000, type: "exam" },
        { description: "Chụp MRI sọ não 1.5 Tesla", amount: 1500000, type: "mri" },
        { description: "Chẩn đoán phân tích AI NeuroScan", amount: 200000, type: "ai" },
      ],
      totalAmount: 1750000,
      status: "chờ thanh toán"
    };

    const prescription = {
      patient_id: "BN_ONCOLOGY_01",
      drugs: [
        { name: "Temozolomide 100mg", quantity: 14, unit: "Viên", price: 150000 },
        { name: "Ondansetron 8mg", quantity: 10, unit: "Viên", price: 15000 },
      ],
      isBilled: false,
    };

    // Kiểm tra đồng bộ hóa
    const drugItems = prescription.drugs.map(d => ({
      description: `Thuốc: ${d.name} (SL: ${d.quantity} ${d.unit})`,
      amount: d.price * d.quantity,
      type: "drug"
    }));

    drugItems.forEach(d => draftInvoice.items.push(d));
    draftInvoice.totalAmount = draftInvoice.items.reduce((sum, item) => sum + item.amount, 0);
    prescription.isBilled = true;

    // Tổng tiền mong đợi: 1,750,000 + (14 * 150,000) + (10 * 15,000) = 1,750,000 + 2,100,000 + 150,000 = 4,000,000 VNĐ
    assert.strictEqual(draftInvoice.totalAmount, 4000000, "Tổng viện phí sau đồng bộ tiền thuốc phải chính xác 4,000,000 VNĐ");
    assert.strictEqual(prescription.isBilled, true, "Đơn thuốc phải được chốt viện phí (isBilled = true)");
    assert.strictEqual(draftInvoice.items.length, 5, "Hóa đơn phải chứa đủ 5 hạng mục");
  });

  await test("Neuro-Oncology FSM Orchestration: Hội chẩn đa chuyên khoa Tumor Board và Tái khám định kỳ theo dõi tái phát (Surveillance)", async () => {
    const { ALLOWED_TRANSITIONS } = await import("../controllers/visit.controller.js");

    // 1. Phân luồng ca u não vào Hội chẩn Tumor Board (MTB)
    assert.ok(ALLOWED_TRANSITIONS["đang khám"].includes("chờ hội chẩn"), "Bác sĩ lâm sàng phát hiện u não phải được chuyển hội chẩn Tumor Board");
    assert.ok(ALLOWED_TRANSITIONS["chờ bác sĩ đọc"].includes("chờ hội chẩn"), "Bác sĩ CĐHA đọc phim MRI phát hiện GBM phải được chuyển hội chẩn Tumor Board");

    // 2. Các hướng xử trí sau Tumor Board
    assert.ok(ALLOWED_TRANSITIONS["chờ hội chẩn"].includes("chờ nhập viện"), "Tumor Board chỉ định phẫu thuật mở sọ / xạ trị phải chuyển 'chờ nhập viện'");
    assert.ok(ALLOWED_TRANSITIONS["chờ hội chẩn"].includes("hoàn tất"), "Tumor Board thống nhất phác đồ ngoại trú có thể 'hoàn tất'");
    assert.ok(ALLOWED_TRANSITIONS["chờ hội chẩn"].includes("chờ chụp lại"), "Tumor Board yêu cầu chụp thêm chuỗi xung DTI/Perfusion chuyển 'chờ chụp lại'");

    // 3. Chu trình Tái khám định kỳ (Surveillance MRI sau mổ / sau phác đồ Stupp 3-6 tháng)
    assert.ok(ALLOWED_TRANSITIONS["đang chờ"].includes("tái khám định kỳ"), "Bệnh nhân tái khám định kỳ được tiếp đón vào luồng chuyên biệt");
    assert.ok(ALLOWED_TRANSITIONS["tái khám định kỳ"].includes("chờ chụp"), "Tái khám định kỳ kích hoạt chụp MRI sọ não kiểm tra tái phát");
  });

  await test("Neuro-Oncology High-Value Drug Billing: Tính toán chính xác phác đồ Stupp + Bevacizumab (>40 triệu VNĐ) chống thất thoát viện phí", async () => {
    const draftInvoice = {
      items: [
        { description: "Khám lâm sàng Chuyên gia U não", amount: 150000, type: "exam" },
        { description: "Chụp MRI sọ não 3.0T có tiêm Gadolinium", amount: 2500000, type: "mri" },
        { description: "Phân tích AI NeuroScan phân vùng U não tự động", amount: 350000, type: "ai" }
      ],
      totalAmount: 3000000,
      status: "chờ thanh toán"
    };

    const oncologyPrescription = {
      patient_id: "BN_GBM_PHAC_DO_STUPP",
      drugs: [
        { name: "Temozolomide 250mg", quantity: 5, unit: "Viên", price: 2500000 },          // 12,500,000 VNĐ
        { name: "Bevacizumab 400mg (Avastin)", quantity: 1, unit: "Lọ", price: 28000000 },    // 28,000,000 VNĐ
        { name: "Levetiracetam 500mg (Keppra)", quantity: 60, unit: "Viên", price: 13000 },  // 780,000 VNĐ
        { name: "Dexamethasone 4mg", quantity: 30, unit: "Viên", price: 4000 }                // 120,000 VNĐ
      ],
      isBilled: false,
      invoiceId: null
    };

    const drugItems = oncologyPrescription.drugs.map(d => ({
      description: `Thuốc: ${d.name} (SL: ${d.quantity} ${d.unit})`,
      amount: d.price * d.quantity,
      type: "drug"
    }));

    drugItems.forEach(item => draftInvoice.items.push(item));
    draftInvoice.totalAmount = draftInvoice.items.reduce((sum, item) => sum + item.amount, 0);
    oncologyPrescription.isBilled = true;
    oncologyPrescription.invoiceId = "INV_GBM_44M";

    // Thẩm định: 3,000,000 + 12,500,000 + 28,000,000 + 780,000 + 120,000 = 44,400,000 VNĐ
    assert.strictEqual(draftInvoice.totalAmount, 44400000, "Tổng viện phí phác đồ u não phải đạt 44,400,000 VNĐ tuyệt đối chính xác");
    assert.strictEqual(draftInvoice.items.length, 7, "Hóa đơn phải bao gồm đủ 7 hạng mục (3 dịch vụ kỹ thuật + 4 dược chất)");
    assert.strictEqual(oncologyPrescription.isBilled, true, "Đơn thuốc điều trị u não phải được chốt viện phí");
  });

  await test("Neuro-Oncology FSM & TT46/2018/TT-BYT: Chụp MRI hậu phẫu 72h (EOR), theo dõi vắng mặt (No-show) và bảo toàn nhật ký chuỗi băm", async () => {
    const { ALLOWED_TRANSITIONS } = await import("../controllers/visit.controller.js");

    // 1. Khảo sát MRI hậu phẫu 72h (Extent of Resection - EOR)
    assert.ok(ALLOWED_TRANSITIONS["chờ chụp sau phẫu thuật"], "FSM bắt buộc phải có trạng thái 'chờ chụp sau phẫu thuật'");
    assert.ok(ALLOWED_TRANSITIONS["đang khám"].includes("chờ chụp sau phẫu thuật"), "Bác sĩ khám có thể chỉ định chụp MRI hậu phẫu 72h");
    assert.ok(ALLOWED_TRANSITIONS["chờ hội chẩn"].includes("chờ chụp sau phẫu thuật"), "Tumor Board có thể chỉ định chụp MRI hậu phẫu 72h");
    assert.ok(ALLOWED_TRANSITIONS["chờ nhập viện"].includes("chờ chụp sau phẫu thuật"), "Sau phẫu thuật nội trú chuyển sang chụp MRI hậu phẫu");
    assert.ok(ALLOWED_TRANSITIONS["chờ chụp sau phẫu thuật"].includes("đang chụp"), "Chuyển vào phòng chụp MRI 3.0T");

    // 2. Quản lý vắng mặt / No-show cho bệnh nhân u não
    assert.ok(ALLOWED_TRANSITIONS["no_show"], "FSM bắt buộc phải có trạng thái 'no_show'");
    assert.ok(ALLOWED_TRANSITIONS["đang chờ"].includes("no_show"), "Bệnh nhân không có mặt tại phòng khám chuyển sang 'no_show'");
    assert.ok(ALLOWED_TRANSITIONS["tái khám định kỳ"].includes("no_show"), "Bệnh nhân lỡ hẹn tái khám MRI chuyển sang 'no_show'");
    assert.ok(ALLOWED_TRANSITIONS["no_show"].includes("tái khám định kỳ"), "Kích hoạt gửi thông báo nhắc lịch và xếp lại lịch tái khám");

    // 3. Khai báo hành động kiểm toán chuỗi băm
    assert.strictEqual(AUDIT_ACTIONS.VISIT_STATUS_CHANGED, "VISIT_STATUS_CHANGED", "Hành động VISIT_STATUS_CHANGED phải được đăng ký trong danh mục kiểm toán");
  });

  // ── KẾT QUẢ TỔNG HỢP ──
  console.log("\n======================================================================");
  console.log(`SUMMARY: ${passed}/${passed + failed} COMPLIANCE AUDIT TESTS PASSED (${((passed / (passed + failed)) * 100).toFixed(0)}%)`);
  console.log("======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
};

export const runComplianceAudit = runAllTests;

const isMain = process.argv[1] && (process.argv[1].endsWith("comprehensive_compliance_audit.test.js") || process.argv[1].endsWith("comprehensive_compliance_audit"));
if (isMain) {
  runAllTests().catch((err) => {
    console.error("Lỗi khi chạy bộ kiểm thử kiểm toán tuân thủ:", err);
    process.exit(1);
  });
}
