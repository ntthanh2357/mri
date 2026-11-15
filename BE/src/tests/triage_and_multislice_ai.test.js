import mongoose from "mongoose";
import fs from "fs";
import zlib from "zlib";
import { putFile } from "../services/storage/storageService.js";
import storageService from "../services/storage/storageService.js";
import os from "os";
import path from "path";
import StoredMedicalFile from "../models/storedMedicalFile.model.js";
import { User } from "../models/user.model.js";
import { Hospital } from "../models/hospital.model.js";
import { ImagingResult } from "../modules/imaging/models/imagingResult.model.js";
import {
  buildStoredZipBuffer,
  extractImagesFromZipBuffer,
  sanitizeStudyRelativePath,
  isIgnoredStudyPath,
} from "../modules/imaging/zipArchive.util.js";
import {
  normalizeNormalizedBox,
  buildMultiSliceAiReport,
  applyMultiSliceAiResultToImaging,
  applyDoctorSliceOverride,
  computeEffectiveSliceOverlay,
} from "../modules/imaging/multiSliceAi.util.js";
import {
  initTriageSession,
  appendZipToTriageSession,
  finalizeTriageSession,
  cancelTriageSession,
} from "../modules/imaging/triageStaging.service.js";
import { feedbackImagingResultAI } from "../modules/imaging/imaging.controller.js";
import { getViewerManifest } from "../modules/imaging/dicom.controller.js";
import { signUploadPath, stripUploadSignatures } from "../middlewares/uploadSignature.middleware.js";

const makePngBuffer = (width = 256, height = 256) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const rawScanline = Buffer.alloc(1 + width * 3, 128);
  const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: 4 }, () => rawScanline)));
  return Buffer.concat([sig, chunk("IHDR", ihdrData), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
};

const makeMockRes = () => ({
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
  setHeader(k, v) {
    this.headers[k] = v;
    return this;
  },
});

describe("KTV Smart Study Triage, Multi-Slice AI & Doctor ROI Editing Suite", () => {
  let hospitalId;
  let otherHospitalId;
  let ktvId;
  let otherKtvId;
  let doctorId;
  let patientId;
  const tempFilesToClean = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan_test_logic"
      );
    }

    hospitalId = new mongoose.Types.ObjectId();
    otherHospitalId = new mongoose.Types.ObjectId();
    ktvId = new mongoose.Types.ObjectId();
    otherKtvId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();

    const suffix = Date.now().toString().slice(-5);
    await Hospital.create([
      { _id: hospitalId, name: "BV Triage Test 1", code: `TRG1-${suffix}`, isActive: true },
      { _id: otherHospitalId, name: "BV Triage Test 2", code: `TRG2-${suffix}`, isActive: true },
    ]);

    await User.create([
      {
        _id: ktvId,
        hospitalId,
        email: `ktv1_${suffix}@test.vn`,
        passwordHash: "dummy_pw_hash",
        role: "technician",
        profile: { name: "KTV Triage 1", medicalId: "KTV01" },
      },
      {
        _id: otherKtvId,
        hospitalId,
        email: `ktv2_${suffix}@test.vn`,
        passwordHash: "dummy_pw_hash",
        role: "technician",
        profile: { name: "KTV Triage 2", medicalId: "KTV02" },
      },
      {
        _id: doctorId,
        hospitalId,
        email: `doc_${suffix}@test.vn`,
        passwordHash: "dummy_pw_hash",
        role: "doctor",
        profile: { name: "BS. Chỉnh ROI", medicalId: "BS99" },
      },
      {
        _id: patientId,
        hospitalId,
        email: `pat_${suffix}@test.vn`,
        passwordHash: "dummy_pw_hash",
        role: "patient",
        profile: { name: "Bệnh nhân Multi-Slice", medicalId: "BN99" },
      },
    ]);
  });

  afterAll(async () => {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // Ignore cleanup failures
      }
    }
  });

  test("1. zipArchive.util: đóng gói & giải nén Store ZIP, lọc Localizers và chặn path traversal", () => {
    const validPng = makePngBuffer(256, 256);
    const badBytes = Buffer.from("NOT_AN_IMAGE_PAYLOAD_123456");

    expect(sanitizeStudyRelativePath("..\\..\\etc\\Ax_T2_FLAIR_FS_3\\IM001.png")).toBe(
      "etc/Ax_T2_FLAIR_FS_3/IM001.png"
    );
    expect(isIgnoredStudyPath("Study1/Localizers_1/IM001.png")).toBe(true);
    expect(isIgnoredStudyPath("Study1/Ax_T2_FLAIR_FS_3/IM001.png")).toBe(false);

    const zipBuf = buildStoredZipBuffer([
      { relativePath: "Localizers_1/IM001.png", buffer: validPng },
      { relativePath: "Ax_T2_FLAIR_FS_3/IM001.png", buffer: validPng },
      { relativePath: "Sag_T1_FLAIR_7/IM002.png", buffer: validPng },
      { relativePath: "COR_T2_6/corrupt.png", buffer: badBytes },
      { relativePath: "docs/readme.txt", buffer: Buffer.from("readme") },
    ]);

    const { images, stats } = extractImagesFromZipBuffer(zipBuf, { skipIgnoredFolders: true });
    expect(stats.ignoredCount).toBe(1);
    expect(stats.nonImageCount).toBe(2); // docs/readme.txt + corrupt.png magic bytes rejected
    expect(images.length).toBe(2);
    expect(images.map((i) => i.relativePath)).toEqual([
      "Ax_T2_FLAIR_FS_3/IM001.png",
      "Sag_T1_FLAIR_7/IM002.png",
    ]);
  });

  test("2. triageStaging.service: phân quyền theo bệnh viện/chủ phiên, promote Top-K vào AES-GCM PACS & xóa staging", async () => {
    const validPng = makePngBuffer(256, 256);
    const ktvUser = { id: String(ktvId), hospitalId: String(hospitalId), role: "technician" };
    const otherUserSameHosp = { id: String(otherKtvId), hospitalId: String(hospitalId), role: "technician" };
    const otherHospUser = { id: String(ktvId), hospitalId: String(otherHospitalId), role: "technician" };

    const sessionInfo = await initTriageSession({
      user: ktvUser,
      patientId: String(patientId),
      protocolCode: "BRAIN_ROUTINE",
    });
    expect(typeof sessionInfo.sessionId).toBe("string");

    const zipBuf = buildStoredZipBuffer([
      { relativePath: "Localizers_1/loc.png", buffer: validPng },
      { relativePath: "Ax_T2_FLAIR_FS_3/IM001.png", buffer: validPng },
      { relativePath: "Sag_T1_FLAIR_7/IM002.png", buffer: validPng },
      { relativePath: "AX_T1_FLAIR_9/IM003.png", buffer: validPng },
    ]);

    // Cross-hospital and non-owner KTV MUST be rejected with 403
    let crossHospErr = null;
    try {
      await appendZipToTriageSession({ sessionId: sessionInfo.sessionId, user: otherHospUser, zipBuffer: zipBuf });
    } catch (e) {
      crossHospErr = e;
    }
    expect(crossHospErr?.statusCode).toBe(403);

    let otherOwnerErr = null;
    try {
      await appendZipToTriageSession({ sessionId: sessionInfo.sessionId, user: otherUserSameHosp, zipBuffer: zipBuf });
    } catch (e) {
      otherOwnerErr = e;
    }
    expect(otherOwnerErr?.statusCode).toBe(403);

    const zipRes = await appendZipToTriageSession({
      sessionId: sessionInfo.sessionId,
      user: ktvUser,
      zipBuffer: zipBuf,
    });
    expect(zipRes.ignoredSequencesInZip).toBe(1);
    expect(zipRes.totalKeptSlices).toBe(3);

    // Finalize 2 slices into encrypted PACS storage (should reject >15 slices first)
    const sliceKeys = Array.from({ length: 16 }, (_, i) => `k${i}`);
    let overCapErr = null;
    try {
      await finalizeTriageSession({
        sessionId: sessionInfo.sessionId,
        user: ktvUser,
        selectedSliceKeys: sliceKeys,
      });
    } catch (e) {
      overCapErr = e;
    }
    expect(overCapErr?.statusCode).toBe(400);

    // Promote 2 slices by rebuilding a small session so we have exact keys from batch or cancel cleanly
    await cancelTriageSession({ sessionId: sessionInfo.sessionId, user: ktvUser });

    const session2 = await initTriageSession({ user: ktvUser, patientId: String(patientId) });
    const resAppend = await appendZipToTriageSession({
      sessionId: session2.sessionId,
      user: ktvUser,
      zipBuffer: zipBuf,
    });
    expect(resAppend.addedSlices).toBe(3);

    // Use internal batch keys via cancel check or appendBatch? Test appendBatchToTriageSession directly via dynamic import
    const { appendBatchToTriageSession } = await import("../modules/imaging/triageStaging.service.js");
    await cancelTriageSession({ sessionId: session2.sessionId, user: ktvUser });

    const session3 = await initTriageSession({ user: ktvUser, patientId: String(patientId) });
    await appendBatchToTriageSession({
      sessionId: session3.sessionId,
      user: ktvUser,
      files: [
        { originalname: "IM001.png", buffer: validPng, mimetype: "image/png" },
        { originalname: "IM002.png", buffer: validPng, mimetype: "image/png" },
      ],
      relativePaths: ["Ax_T2_FLAIR_FS_3/IM001.png", "Sag_T1_FLAIR_7/IM002.png"],
    });
    // Keys for first 2 files are slice_1 and slice_2 (or pull stored file records directly after finalize)
    // Verify via a quick finalize attempt or test helper: run cancel cleanly if no runTriage hit, OR promote using keys from slice list:
    // Verify default export alias putFileFromPath works without TypeError during PACS promotion
    expect(typeof storageService.putFileFromPath).toBe("function");
    const tmpSlicePath = path.join(os.tmpdir(), `triage_test_${Date.now()}.png`);
    fs.writeFileSync(tmpSlicePath, validPng);
    tempFilesToClean.push(tmpSlicePath);
    const promoted = await storageService.putFileFromPath({
      category: "pacs",
      studyId: `triage_${Date.now()}`,
      sequenceName: "Ax_T2_FLAIR_FS_3",
      fileName: "IM001.png",
      sourceFilePath: tmpSlicePath,
      moveFile: false,
      mimeType: "image/png",
      patientId: String(patientId),
      uploadedBy: String(ktvId),
      hospitalId: String(hospitalId),
      syncToDrive: false,
    });
    expect(Boolean(promoted.fileId)).toBe(true);
    expect(promoted.localEncrypted).toBe(true);
    tempFilesToClean.push(promoted.localPath);

    // Note runTriageSessionAnalysis hits Python AI; verify cancel clears staging cleanly.
    const cancelRes = await cancelTriageSession({ sessionId: session3.sessionId, user: ktvUser });
    expect(cancelRes.cleared).toBe(true);
  });

  test("3. multiSliceAi.util & DICOM viewer manifest: tổng hợp đa lát cắt, hiệu chỉnh ROI từng lát & khóa isSigned (409)", async () => {
    expect(normalizeNormalizedBox({ x: 0.2, y: 0.3, w: 0.4, h: 0.25 })).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.25,
    });
    expect(normalizeNormalizedBox({ x: 0.2, y: 0.3, width: 0.4, height: 0.25 })).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.25,
    });
    expect(normalizeNormalizedBox({ x: 0.1, y: 0.1, w: 0, h: 0.2 })).toBe(null);

    const pngBuf = makePngBuffer(256, 256);
    const f1 = await putFile({
      buffer: pngBuf,
      fileName: "ax_t2_1.png",
      category: "pacs",
      patientId: String(patientId),
      uploadedBy: String(ktvId),
      hospitalId: String(hospitalId),
      mimeType: "image/png",
    });
    const f2 = await putFile({
      buffer: pngBuf,
      fileName: "sag_t1_2.png",
      category: "pacs",
      patientId: String(patientId),
      uploadedBy: String(ktvId),
      hospitalId: String(hospitalId),
      mimeType: "image/png",
    });
    tempFilesToClean.push(f1.localPath, f2.localPath);

    const url1 = `/api/v1/storage/files/${f1.fileId}`;
    const url2 = `/api/v1/storage/files/${f2.fileId}`;

    const aggregated = buildMultiSliceAiReport(
      [
        {
          sliceIndex: 0,
          imageUrl: url1,
          seriesName: "Ax_T2_FLAIR_FS_3",
          sequenceType: "T2_FLAIR",
          plane: "axial",
          clarityScore: 0.88,
          aiData: {
            class_name: "notumor",
            confidence: 96,
            probabilities: { notumor: 96, glioma: 2, meningioma: 1, pituitary: 1 },
            bounding_box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }, // MUST be stripped for notumor!
          },
        },
        {
          sliceIndex: 1,
          imageUrl: url2,
          seriesName: "Sag_T1_FLAIR_7",
          sequenceType: "T1_FLAIR",
          plane: "sagittal",
          clarityScore: 0.92,
          aiData: {
            class_name: "meningioma",
            confidence: 91,
            probabilities: { meningioma: 91, glioma: 5, pituitary: 2, notumor: 2 },
            bounding_box: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
            tumor_location: { x: 77, y: 77, width: 51, height: 51 },
          },
        },
      ],
      { source: "ktv_batch", analyzedBy: String(ktvId) }
    );

    expect(aggregated.sliceResults.length).toBe(2);
    expect(aggregated.sliceResults[0].bounding_box).toBe(null); // No fake box on notumor
    expect(aggregated.representativeSliceIndex).toBe(1); // Tumor slice promoted to primary
    expect(aggregated.class_name).toBe("meningioma");

    const record = await ImagingResult.create({
      hospitalId,
      patientId,
      medicalId: "BN99",
      patientName: "Bệnh nhân Multi-Slice",
      imagingType: "MRI",
      procedure: "MRI sọ não",
      radiologist: "BS. Chỉnh ROI",
      findings: "Chờ đọc.",
      conclusion: "Chờ kết luận.",
      orderDate: new Date(),
      reportDate: new Date(),
      status: "chờ duyệt",
      isSigned: false,
      images: [url1, url2],
      representativeSliceUrl: url2,
    });
    await applyMultiSliceAiResultToImaging({
      imagingResultId: record._id,
      hospitalId,
      multiReport: aggregated,
    });

    // Doctor edits SLICE #1 via feedbackImagingResultAI using signed URL + normalizedBox
    const reqEdit = {
      user: { id: String(doctorId), hospitalId: String(hospitalId), role: "doctor" },
      body: {
        imageUrl: signUploadPath(url2),
        imagingResultId: String(record._id),
        sliceIndex: 1,
        correct_class: "glioma",
        normalizedBox: { x: 0.42, y: 0.35, w: 0.22, h: 0.19 },
        note: "Khối u ở lát sagittal thuộc nhóm Glioma",
        agreementStatus: "modified",
      },
    };
    const resEdit = makeMockRes();
    let passedSig = false;
    stripUploadSignatures(reqEdit, resEdit, () => {
      passedSig = true;
    });
    expect(passedSig).toBe(true);
    await feedbackImagingResultAI(reqEdit, resEdit);
    expect(resEdit.statusCode).toBe(200);
    expect(resEdit.body.data.persisted).toBe(true);
    expect(resEdit.body.data.sliceIndex).toBe(1);
    expect(resEdit.body.data.doctorOverride.correctedClass).toBe("glioma");

    // Slice 0 remains untouched, Slice 1 reflects Doctor override in viewer-manifest
    const reqManifest = {
      params: { id: String(record._id) },
      user: { id: String(doctorId), hospitalId: String(hospitalId), role: "doctor" },
    };
    const resManifest = makeMockRes();
    await getViewerManifest(reqManifest, resManifest);
    expect(resManifest.statusCode).toBe(200);
    expect(resManifest.body.data.series.length).toBe(2); // Grouped by 2 distinct seriesNames
    const ov1 = resManifest.body.data.aiOverlay.sliceOverlays.find((s) => s.sliceIndex === 1);
    expect(ov1.isDoctorEdited).toBe(true);
    expect(ov1.className).toBe("glioma");
    expect(ov1.aiClassName).toBe("meningioma");
    expect(ov1.boundingBox.x).toBe(0.42);
    expect(ov1.aiBoundingBox.x).toBe(0.3);

    // Lock report isSigned=true -> feedbackImagingResultAI MUST return 409 and NOT overwrite
    await ImagingResult.updateOne({ _id: record._id }, { $set: { isSigned: true } }).setOptions({
      bypassTenancy: true,
    });
    const reqLocked = {
      user: reqEdit.user,
      body: { ...reqEdit.body, imageUrl: signUploadPath(url2) },
    };
    const resLocked = makeMockRes();
    stripUploadSignatures(reqLocked, resLocked, () => {});
    await feedbackImagingResultAI(reqLocked, resLocked);
    expect(resLocked.statusCode).toBe(409);

    // Verify applyDoctorSliceOverride + computeEffectiveSliceOverlay directly on unit edge case
    const { updatedReport } = applyDoctorSliceOverride({
      existingReport: aggregated,
      sliceIndex: 0,
      imageUrl: url1,
      correctClass: "pituitary",
      correctedBox: { x: 0.45, y: 0.65, w: 0.12, h: 0.12 },
      userId: String(doctorId),
    });
    const eff0 = computeEffectiveSliceOverlay(updatedReport.sliceResults[0]);
    expect(eff0.isDoctorEdited).toBe(true);
    expect(eff0.className).toBe("pituitary");
    expect(eff0.boundingBox.x).toBe(0.45);
  });

  test("4. finalizeTriageSession & createImagingResult giu lai phan loai khoi u & boundingBox AI tung lat", async () => {
    const {
      initTriageSession,
      appendBatchToTriageSession,
      finalizeTriageSession,
    } = await import("../modules/imaging/triageStaging.service.js");
    const { triageSessions } = await import("../modules/imaging/triageStaging.service.js");
    const { createImagingResult } = await import("../modules/imaging/imaging.controller.js");

    const ktvUser = { id: String(ktvId), hospitalId: String(hospitalId), role: "technician" };
    const sess = await initTriageSession({ user: ktvUser, patientId: String(patientId) });
    const pngBuf = makePngBuffer(128, 128);
    const added = await appendBatchToTriageSession({
      sessionId: sess.sessionId,
      user: ktvUser,
      files: [{ originalname: "IM0049.png", buffer: pngBuf, mimetype: "image/png" }],
      relativePaths: ["Ax_DWI_ALL/IM0049.png"],
    });
    expect(added.keptInBatch).toBe(1);

    const internalSess = triageSessions.get(sess.sessionId);
    const sliceKey = Array.from(internalSess.slices.keys())[0];
    internalSess.lastTriageResult = {
      studyDiagnosisSummary: {
        totalAnalyzed: 60,
        detectedTumorSlicesCount: 50,
        tumorRatePct: 83.3,
        dominantClass: "meningioma",
        dominantCount: 50,
        dominantPctOfTotal: 83.3,
        dominantPctOfTumors: 100.0,
        dominantAvgConfidence: 94.5,
        dominantMaxConfidence: 96.2,
        majorityOverallClass: "meningioma",
        aiMode: "3-cnn-ensemble-yolo-bounded-vlm",
        conflictSlicesCount: 4,
        geminiArbitratedCount: 4,
      },
      candidates: [
        {
          sliceKey,
          seriesName: "Ax_DWI_ALL",
          sequenceType: "DWI",
          plane: "axial",
          sliceNumber: 49,
          lesionClarityScore: 0.95,
          predictedClass: "meningioma",
          confidence: 94.5,
          yoloDetected: true,
          yoloClass: "meningioma",
          yoloConf: 0.91,
          boundingBox: { x: 0.25, y: 0.3, w: 0.22, h: 0.18 },
        },
      ],
    };

    const fin = await finalizeTriageSession({
      sessionId: sess.sessionId,
      user: ktvUser,
      selectedSliceKeys: [sliceKey],
      primarySliceKey: sliceKey,
    });
    expect(fin.sliceSeriesMeta.length).toBe(1);
    expect(fin.sliceSeriesMeta[0].predictedClass).toBe("meningioma");
    expect(fin.sliceSeriesMeta[0].yoloDetected).toBe(true);
    expect(fin.sliceSeriesMeta[0].boundingBox.x).toBe(0.25);
    expect(fin.triageAiPreview.class_name).toBe("meningioma");
    expect(fin.triageAiPreview.tumorSliceCount).toBe(1);
    expect(fin.triageAiPreview.sliceResults[0].bounding_box.w).toBe(0.22);
    expect(fin.triageAiPreview.studyDiagnosisSummary.dominantClass).toBe("meningioma");
    expect(fin.triageAiPreview.studyDiagnosisSummary.dominantCount).toBe(50);
    expect(fin.triageAiPreview.totalAnalyzedInFolder).toBe(60);

    const reqCreate = {
      user: ktvUser,
      body: {
        medicalId: "BN_TRIAGE_01",
        patientName: "Benh nhan Triage Test",
        orderDate: new Date().toISOString(),
        procedure: "Chup MRI So nao",
        findings: "Cho bac si doc",
        conclusion: "Cho ket luan",
        radiologist: "Cho ky",
        reportDate: new Date().toISOString(),
        imagingType: "MRI",
        images: fin.rawImageUrls,
        dicomMetadata: { sliceSeriesMeta: fin.sliceSeriesMeta, primarySliceIndex: 0 },
        triageAiPreview: fin.triageAiPreview,
      },
    };
    const resCreate = makeMockRes();
    await createImagingResult(reqCreate, resCreate);
    expect(resCreate.statusCode).toBe(201);
    expect(resCreate.body.data.aiReport.class_name).toBe("meningioma");
    expect(resCreate.body.data.aiReport.sliceResults[0].bounding_box.x).toBe(0.25);
    expect(resCreate.body.data.aiReport.studyDiagnosisSummary.dominantClass).toBe("meningioma");
    expect(resCreate.body.data.aiReport.totalAnalyzedInFolder).toBe(60);
    expect(resCreate.body.data.dicomMetadata.sliceSeriesMeta[0].predictedClass).toBe("meningioma");

    if (resCreate.body.data?._id) {
      await ImagingResult.deleteOne({ _id: resCreate.body.data._id }).setOptions({ bypassTenancy: true });
    }
    if (fin.files?.[0]?.fileId) {
      await StoredMedicalFile?.deleteOne?.({ fileId: fin.files[0].fileId })?.catch?.(() => {});
    }
  });
});
