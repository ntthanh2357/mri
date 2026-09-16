import { ImagingResult } from "./models/imagingResult.model.js";
import { User } from "../auth/models/user.model.js";
import { Visit } from "../../models/visit.model.js";
import { Hospital } from "../../models/hospital.model.js";
import { successResponse, errorResponse } from "../../utils/response.util.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bucket } from "../../config/firebase.js";
import { uploadMetadataBackup, uploadToDrive } from "../../config/googleDrive.js";
import { createNotificationInternal } from "../../controllers/notification.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all imaging results for the logged in patient
// @route   GET /api/v1/imaging/my-results
// @access  Private
export const getPatientResults = async (req, res) => {
  try {
    // 1. Fetch user to get the medicalId
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, "Người dùng không tồn tại.", 404);
    }

    const medicalId = user.profile?.medicalId;
    if (!medicalId) {
      return successResponse(res, [], "Tài khoản chưa được liên kết với Mã y tế (Medical ID) nào.");
    }

    // 2. Query results matching medicalId
    const results = await ImagingResult.find({ medicalId }).sort({ reportDate: -1 });
    return successResponse(res, results, "Lấy danh sách kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy danh sách kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};

// @desc    Get detailed imaging result by ID
// @route   GET /api/v1/imaging/:id
// @access  Private
export const getResultById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ImagingResult.findById(id);
    if (!result) {
      return errorResponse(res, "Không tìm thấy kết quả chẩn đoán hình ảnh.", 404);
    }

    // Authorization check: Bệnh nhân chỉ xem kết quả của chính mình; Nhân viên chỉ xem trong cùng viện
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== result.medicalId) {
        return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán này.", 403);
      }
    } else if (req.user.role !== "admin") {
      if (req.user.hospitalId && result.hospitalId && req.user.hospitalId.toString() !== result.hospitalId.toString()) {
        return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán của cơ sở y tế khác.", 403);
      }
    }

    return successResponse(res, result, "Lấy chi tiết kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};

// @desc    Create a new imaging result
// @route   POST /api/v1/imaging
// @access  Private (Doctor, Admin only)
export const createImagingResult = async (req, res) => {
  try {
    // [BUG-08 FIX] Destructure req.body TRƯỜC khi dùng medicalId trong role check
    const {
      medicalId,
      patientName,
      birthYear,
      gender,
      address,
      orderDate,
      orderingDoctor,
      orderingDepartment,
      medicalRecordNumber,
      diagnosis,
      procedure,
      technique,
      findings,
      conclusion,
      radiologist,
      reportDate,
      images,
      dicomMetadata,
      dicomZipUrl,
      dicomZipSize,
      dicomZipFilename,
      imagingType,
      visitId,
    } = req.body;

    // 1. Check roles
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== medicalId) {
        return errorResponse(res, "Bạn chỉ có thể tự lưu trữ kết quả cho chính mình.", 403);
      }
    } else if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    // 2. Validate required fields
    if (!medicalId || !patientName || !gender || !orderDate || !procedure || !findings || !conclusion || !radiologist || !reportDate || !imagingType) {
      return errorResponse(res, "Vui lòng nhập đầy đủ các trường bắt buộc.", 400);
    }

    // 3. Create record
    const newResult = new ImagingResult({
      hospitalId: req.user.hospitalId,
      medicalId,
      patientName,
      birthYear,
      gender,
      address,
      orderDate,
      orderingDoctor,
      orderingDepartment,
      medicalRecordNumber,
      diagnosis,
      procedure,
      technique,
      findings,
      conclusion,
      radiologist,
      reportDate,
      images: images || [],
      dicomMetadata: dicomMetadata || {},
      dicomZipUrl: dicomZipUrl || null,
      dicomZipSize: dicomZipSize || null,
      dicomZipFilename: dicomZipFilename || null,
      imagingType,
    });

    await newResult.save();

    if (visitId) {
      const visit = await Visit.findById(visitId);
      if (visit) {
        visit.mriOrder.imagingResultId = newResult._id;
        visit.status = visit.mriOrder.requestAiAnalysis ? "chờ kết quả AI" : "chờ bác sĩ đọc";
        await visit.save();
      }
    }

    return successResponse(res, newResult, "Tạo kết quả chẩn đoán hình ảnh mới thành công.", 201);
  } catch (error) {
    console.error("Lỗi khi tạo kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tạo dữ liệu.", 500);
  }
};

// @desc    Get imaging results by patient User ID (ObjectId) — fallback for patients without medicalId
// @route   GET /api/v1/imaging/by-patient/:patientId
// @access  Private (Doctor, Admin, Technician, Nurse)
export const getResultsByPatientUserId = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician" && req.user.role !== "nurse" && req.user.role !== "receptionist") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }
    const { patientId } = req.params;
    if (!patientId) {
      return errorResponse(res, "Thiếu ID bệnh nhân.", 400);
    }

    // 1. Tìm tất cả visits của bệnh nhân này có imagingResultId
    const visits = await Visit.find({
      patientId,
      "mriOrder.imagingResultId": { $exists: true, $ne: null }
    }).select("mriOrder.imagingResultId").lean();

    if (!visits || visits.length === 0) {
      return successResponse(res, [], "Bệnh nhân chưa có phim chụp nào.");
    }

    const resultIds = visits
      .map(v => v.mriOrder?.imagingResultId)
      .filter(Boolean);

    // 2. Lấy các ImagingResult tương ứng
    const results = await ImagingResult.find({ _id: { $in: resultIds } }).sort({ reportDate: -1 });
    return successResponse(res, results, `Lấy danh sách phim chụp theo patientId thành công.`);
  } catch (error) {
    console.error("Lỗi khi lấy phim theo patientId:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};

// @desc    Get all imaging results for a specific patient by medical ID
// @route   GET /api/v1/imaging/patient/:medicalId
// @access  Private (Doctor, Admin only)
export const getPatientResultsByMedicalId = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }
    const { medicalId } = req.params;
    if (!medicalId) {
      return errorResponse(res, "Thiếu Mã y tế bệnh nhân.", 400);
    }
    const results = await ImagingResult.find({ medicalId }).sort({ reportDate: -1 });
    return successResponse(res, results, `Lấy danh sách phim chụp của bệnh nhân mã ${medicalId} thành công.`);
  } catch (error) {
    console.error("Lỗi khi lấy phim của bệnh nhân theo medicalId:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};

// @desc    Upload imaging scan image or DICOM archive (Multipart stream or Base64)
// @route   POST /api/v1/imaging/upload
// @access  Private
export const uploadImagingImage = async (req, res) => {
  try {
    let publicUrl = null;
    let originalName = null;
    let fileSize = 0;
    let isArchive = false;
    let ext = "";
    let streamOrBuffer = null;
    let mimeType = "";

    // ── 1. Check if uploaded via Multer (multipart/form-data) ──────────
    if (req.file) {
      originalName = req.file.originalname;
      fileSize = req.file.size;
      ext = path.extname(originalName).toLowerCase();
      isArchive = [".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext);
      publicUrl = `/uploads/${req.file.filename}`;
      streamOrBuffer = fs.createReadStream(req.file.path);
      mimeType = isArchive
        ? (req.file.mimetype || "application/zip")
        : (ext === ".png" ? "image/png" : "image/jpeg");
    } else {
      // ── 2. Fallback: Base64 JSON (req.body.fileData) ───────────────────
      const { fileData, fileName, imagingType } = req.body;
      if (!fileData) {
        return errorResponse(res, "Thiếu dữ liệu tệp tin. Vui lòng tải lên tệp tin hợp lệ.", 400);
      }

      // Expect base64 format like "data:image/png;base64,iVBORw0KGgo..."
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return errorResponse(res, "Định dạng ảnh Base64 không hợp lệ.", 400);
      }

      const imageBuffer = Buffer.from(matches[2], 'base64');
      originalName = fileName || "scan.png";
      fileSize = imageBuffer.length;
      ext = fileName ? path.extname(fileName).toLowerCase() : ".png";
      isArchive = [".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext);
      mimeType = isArchive ? "application/zip" : (ext === ".png" ? "image/png" : "image/jpeg");
      streamOrBuffer = imageBuffer;

      // Try uploading to Firebase Storage if configured
      if (bucket && !isArchive) {
        try {
          const folder = (imagingType && imagingType.toUpperCase().includes('CT')) ? 'CT' : 'MRI';
          const uniqueFileName = `${folder}/scans_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
          const file = bucket.file(uniqueFileName);
          
          await file.save(imageBuffer, {
            metadata: {
              contentType: `image/${ext.replace(".", "") || "png"}`
            }
          });
          
          await file.makePublic();
          publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
        } catch (fbError) {
          console.warn("Tải lên Firebase Storage thất bại, chuyển sang lưu trữ cục bộ:", fbError);
        }
      }

      if (!publicUrl) {
        // Fallback to Local Storage
        const uploadsDir = path.join(__dirname, "../../../uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const newFileName = `uploaded_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
        const filePath = path.join(uploadsDir, newFileName);
        fs.writeFileSync(filePath, imageBuffer);
        publicUrl = `/uploads/${newFileName}`;
      }
    }

    // ── 3. Backup scan image / DICOM archive to hospital's Google Drive (01_Original_Scans folder) ──
    let driveViewLink = null;
    try {
      // Resolve hospitalId: from JWT, or from User DB (in case JWT is old)
      let resolvedHospitalId = req.user?.hospitalId;
      if (!resolvedHospitalId) {
        const { User: UserModel } = await import("../../models/user.model.js");
        const freshUser = await UserModel.findById(req.user?.id).select("hospitalId").lean();
        resolvedHospitalId = freshUser?.hospitalId;
        if (resolvedHospitalId) {
          console.log(`[Drive] Resolved hospitalId from DB: ${resolvedHospitalId}`);
        }
      }

      if (!resolvedHospitalId) {
        console.warn(`⚠️ [Drive] Bỏ qua backup: user ${req.user?.id} (role=${req.user?.role}) không có hospitalId.`);
      } else {
        const { Hospital } = await import("../../models/hospital.model.js");
        const hospital = await Hospital.findById(resolvedHospitalId).lean();
        const scansFolderId = hospital?.subFolders?.originalScansId;
        if (!scansFolderId) {
          console.warn(`⚠️ [Drive] Bệnh viện "${hospital?.name}" chưa cấu hình thư mục 01_Original_Scans.`);
        } else if (streamOrBuffer) {
          const driveResult = await uploadToDrive(streamOrBuffer, originalName, mimeType, scansFolderId);
          driveViewLink = driveResult.webViewLink;
          console.log(`✅ [Drive] Tệp ${originalName} đã lưu vào 01_Original_Scans: ${driveResult.webViewLink}`);
        }
      }
    } catch (driveErr) {
      console.warn("⚠️ [Drive] Không thể backup lên Google Drive:", driveErr.message);
      // Non-blocking: don't fail the upload if Drive is unavailable
    }

    return successResponse(
      res,
      {
        imageUrl: publicUrl,
        fileUrl: publicUrl,
        filename: originalName,
        size: fileSize,
        isArchive,
        driveUrl: driveViewLink,
      },
      isArchive ? "Tải tệp nén DICOM lên thành công." : "Tải ảnh cắt lớp lên thành công."
    );
  } catch (error) {
    console.error("Lỗi khi tải ảnh/tệp lên:", error);
    return errorResponse(res, "Có lỗi xảy ra khi lưu tệp tin.", 500);
  }
};

// @desc    Helper to execute AI prediction on an image
export const executeAiPredictionInternal = async (imageUrl, user, visitId) => {
  let fileBuffer;
  let fileName = "scan.jpg";

  // 1. Resolve image source (Local path vs Firebase vs external URL)
  if (imageUrl.startsWith("/uploads/")) {
    const absolutePath = path.join(__dirname, "../../..", imageUrl);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Không tìm thấy tệp ảnh tại đường dẫn cục bộ: ${imageUrl}`);
    }
    fileBuffer = fs.readFileSync(absolutePath);
    fileName = path.basename(absolutePath);
  } else if (imageUrl.startsWith("http")) {
    const downloadRes = await fetch(imageUrl);
    if (!downloadRes.ok) {
      throw new Error(`Tải ảnh từ URL thất bại với mã trạng thái ${downloadRes.status}`);
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    fileName = path.basename(new URL(imageUrl).pathname) || "scan.jpg";
  } else {
    throw new Error("Đường dẫn hình ảnh không hợp lệ.");
  }

  // Determine mime-type
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  // 2. Forward to Python FastAPI server using native fetch and FormData
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("file", blob, fileName);

  const rawAiUrl = process.env.AI_SERVER_URL || "http://localhost:8000";
  const aiPredictUrl = rawAiUrl.endsWith("/predict") ? rawAiUrl : `${rawAiUrl.replace(/\/+$/, '')}/predict`;

  console.log(`📡 Đang gửi ảnh tới AI server (${aiPredictUrl}) ...`);

  const aiResponse = await fetch(aiPredictUrl, {
    method: "POST",
    body: formData,
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("Lỗi từ AI Server:", errorText);
    throw new Error(`AI Server trả về lỗi ${aiResponse.status}: ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`);
  }

  const aiData = await aiResponse.json();

  // ── Upload annotated heatmap image to Firebase (base64 → public URL) ──
  if (aiData.annotated_image && aiData.annotated_image.startsWith('data:image')) {
    try {
      const base64Match = aiData.annotated_image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (base64Match && base64Match.length === 3) {
        const imageBuffer = Buffer.from(base64Match[2], 'base64');
        const heatmapFileName = `MRI/heatmap_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;

        if (bucket) {
          const file = bucket.file(heatmapFileName);
          await file.save(imageBuffer, { metadata: { contentType: 'image/jpeg' } });
          await file.makePublic();
          aiData.annotated_image = `https://storage.googleapis.com/${bucket.name}/${heatmapFileName}`;
          console.log(`✅ Heatmap uploaded to Firebase: ${aiData.annotated_image}`);
        } else {
          const uploadsDir = path.join(__dirname, '../../../uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          const localName = `heatmap_${Date.now()}.jpg`;
          fs.writeFileSync(path.join(uploadsDir, localName), imageBuffer);
          aiData.annotated_image = `/uploads/${localName}`;
          console.log(`✅ Heatmap saved locally: ${aiData.annotated_image}`);
        }

        // [DRIVE] Lưu ảnh AI heatmap vào thư mục 02_AI_Predictions
        try {
          let resolvedHospId = user?.hospitalId;
          if (!resolvedHospId && user?.id) {
            const freshUser = await User.findById(user.id).select("hospitalId").lean();
            resolvedHospId = freshUser?.hospitalId;
          }

          if (resolvedHospId) {
            const hosp = await Hospital.findById(resolvedHospId).lean();
            const aiPredFolderId = hosp?.subFolders?.aiPredictionsId;
            if (aiPredFolderId) {
              await uploadToDrive(
                imageBuffer,
                `ai_heatmap_${aiData.class_name || 'unknown'}_${Date.now()}.jpg`,
                'image/jpeg',
                aiPredFolderId
              );
              console.log(`✅ [Drive] Heatmap AI đã lưu vào 02_AI_Predictions (${hosp?.name})`);
            }
          }
        } catch (driveErr) {
          console.warn('⚠️ [Drive] Không thể lưu heatmap vào 02_AI_Predictions:', driveErr.message);
        }
      }
    } catch (uploadErr) {
      console.warn('⚠️ Không thể upload heatmap, giữ nguyên base64:', uploadErr.message);
    }
  }

  // Gọi thêm dịch vụ sinh báo cáo lâm sàng để mô tả chi tiết kích thước, vị trí và lý thuyết u
  if (aiData.class_name && aiData.class_name !== 'notumor') {
    try {
      const aiReportUrl = `${rawAiUrl.replace(/\/predict\/?$/, '').replace(/\/+$/, '')}/generate_clinical_report`;
      const reportResponse = await fetch(aiReportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resnet_data: {
            class_name: aiData.class_name,
            confidence: aiData.confidence,
            tumor_location: aiData.tumor_location,
            consensus_message: aiData.consensus_message
          }
        })
      });
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        aiData.clinical_report = reportData.draft_report || "";
        console.log("✅ Đã sinh báo cáo chi tiết vị trí/kích thước/lý thuyết thành công từ FastAPI.");
      }
    } catch (reportErr) {
      console.warn("⚠️ Lỗi sinh báo cáo chi tiết từ FastAPI:", reportErr.message);
    }
  }

  if (visitId && user?.hospitalId) {
    const visit = await Visit.findById(visitId);
    if (visit && visit.hospitalId.toString() === user.hospitalId.toString()) {
      visit.status = "chờ bác sĩ đọc";
      await visit.save();
    }
  }

  return aiData;
};

// @desc    Analyze imaging scan using AI (FastAPI microservice proxy)
// @route   POST /api/v1/imaging/analyze-ai
// @access  Private (Doctor, Technician, Admin only)
export const analyzeImagingResultAI = async (req, res) => {
  try {
    // 1. Check roles
    if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician" && req.user.role !== "patient") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const { imageUrl, visitId } = req.body;
    if (!imageUrl) {
      return errorResponse(res, "Thiếu đường dẫn hình ảnh cần phân tích.", 400);
    }

    const aiData = await executeAiPredictionInternal(imageUrl, req.user, visitId);
    return successResponse(res, aiData, "Phân tích AI hoàn tất thành công.");
  } catch (error) {
    console.error("Lỗi khi phân tích AI:", error);
    return errorResponse(
      res,
      `Không thể hoàn thành chẩn đoán AI: ${error.message}. Hãy đảm bảo dịch vụ AI FastAPI đã được khởi chạy trên cổng 8000.`,
      500
    );
  }
};

// @desc    Submit doctor feedback on AI results (glioma, meningioma, pituitary, no_tumor)
// @route   POST /api/v1/imaging/feedback-ai
// @access  Private (Doctor, Technician, Admin only)
export const feedbackImagingResultAI = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const { imageUrl, correct_class, x, y, w, h } = req.body;
    if (!imageUrl || !correct_class) {
      return errorResponse(res, "Thiếu thông tin hình ảnh hoặc kết quả chẩn đoán điều chỉnh.", 400);
    }

    let fileBuffer;
    let fileName = "scan.jpg";

    if (imageUrl.startsWith("/uploads/")) {
      const absolutePath = path.join(__dirname, "../../..", imageUrl);
      if (!fs.existsSync(absolutePath)) {
        return errorResponse(res, `Không tìm thấy tệp ảnh tại đường dẫn cục bộ: ${imageUrl}`, 404);
      }
      fileBuffer = fs.readFileSync(absolutePath);
      fileName = path.basename(absolutePath);
    } else if (imageUrl.startsWith("http")) {
      try {
        const downloadRes = await fetch(imageUrl);
        if (!downloadRes.ok) {
          throw new Error(`Tải ảnh từ URL thất bại với mã trạng thái ${downloadRes.status}`);
        }
        const arrayBuffer = await downloadRes.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        fileName = path.basename(new URL(imageUrl).pathname) || "scan.jpg";
      } catch (err) {
        console.error("Lỗi khi tải ảnh từ URL:", err);
        return errorResponse(res, `Không thể tải ảnh từ URL cung cấp: ${err.message}`, 400);
      }
    } else {
      return errorResponse(res, "Đường dẫn hình ảnh không hợp lệ.", 400);
    }

    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("correct_class", correct_class);
    formData.append("x", String(x || 0));
    formData.append("y", String(y || 0));
    formData.append("w", String(w || 0));
    formData.append("h", String(h || 0));

    console.log(`📡 Đang gửi feedback tới AI server (http://localhost:8000/feedback) ...`);
    const aiFeedbackUrl = (process.env.AI_SERVER_URL ? process.env.AI_SERVER_URL.replace("/predict", "/feedback") : "http://localhost:8000/feedback");

    const aiResponse = await fetch(aiFeedbackUrl, {
      method: "POST",
      body: formData,
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi gửi feedback tới AI Server:", errorText);
      return errorResponse(
        res,
        `AI Server trả về lỗi: ${aiResponse.status} - ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`,
        500
      );
    }

    const aiData = await aiResponse.json();

    // [DRIVE] Lưu ảnh hiệu chỉnh của bác sĩ vào thư mục 03_Doctor_Revisions
    try {
      if (req.user?.hospitalId) {
        const { Hospital } = await import("../../models/hospital.model.js");
        const hosp = await Hospital.findById(req.user.hospitalId).lean();
        const docRevFolderId = hosp?.subFolders?.doctorRevisionsId;
        if (docRevFolderId) {
          const corrMime = ext === '.png' ? 'image/png' : 'image/jpeg';
          await uploadToDrive(
            fileBuffer,
            `doctor_correction_${correct_class}_${Date.now()}${ext}`,
            corrMime,
            docRevFolderId
          );
          console.log(`✅ [Drive] Correction image saved to 03_Doctor_Revisions (class: ${correct_class})`);
        }
      }
    } catch (driveErr) {
      console.warn('⚠️ [Drive] Không thể lưu ảnh hiệu chỉnh vào 03_Doctor_Revisions:', driveErr.message);
    }

    // Sao lưu metadata tọa độ vẽ vào thư mục 05_Metadata_Backups
    try {
      const metadata = {
        correctClass: correct_class,
        coordinates: { x, y, w, h },
        originalImageUrl: imageUrl,
        doctorEmail: req.user.email,
        doctorId: req.user.id,
        timestamp: new Date().toISOString()
      };
      await uploadMetadataBackup(metadata, req.user.hospitalId, `feedback_coords_${correct_class}`);
    } catch (backupError) {
      console.warn("⚠️ Không thể sao lưu metadata vẽ lên 05_Metadata_Backups:", backupError.message);
    }

    return successResponse(res, aiData, "Ghi nhận phản hồi và lưu ca bệnh thành công.");
  } catch (error) {
    console.error("Lỗi khi gửi phản hồi AI:", error);
    return errorResponse(
      res,
      `Không thể gửi phản hồi tới AI: ${error.message}`,
      500
    );
  }
};

// @desc    Doctor approves AI result as correct (no correction needed)
// @route   POST /api/v1/imaging/approve-ai
// @access  Private (Doctor, Technician, Admin only)
export const approveImagingResultAI = async (req, res) => {
  try {
    if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

    const { filename, predicted_class, confidence } = req.body;
    if (!filename || !predicted_class) {
      return errorResponse(res, "Thiếu thông tin tên file hoặc kết quả phân loại AI.", 400);
    }

    const AI_BASE = process.env.AI_SERVER_URL
      ? process.env.AI_SERVER_URL.replace("/predict", "")
      : "http://localhost:8000";

    const formData = new FormData();
    formData.append("filename", filename);
    formData.append("predicted_class", predicted_class);
    formData.append("confidence", String(confidence ?? 0));

    console.log(`✅ Gửi xác nhận đúng tới AI server (${AI_BASE}/approve) ...`);
    const aiResponse = await fetch(`${AI_BASE}/approve`, {
      method: "POST",
      body: formData,
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi gửi approve tới AI Server:", errorText);
      return errorResponse(
        res,
        `AI Server trả về lỗi: ${aiResponse.status} - ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`,
        500
      );
    }

    const aiData = await aiResponse.json();
    return successResponse(res, aiData, "Ghi nhận xác nhận kết quả AI đúng thành công.");
  } catch (error) {
    console.error("Lỗi khi gửi xác nhận approve AI:", error);
    return errorResponse(
      res,
      `Không thể gửi xác nhận tới AI: ${error.message}`,
      500
    );
  }
};

// @desc    Explain imaging result in simple, Hippocratic terms for patient
// @route   POST /api/v1/imaging/:id/explain-ai
// @access  Private (Patient, Doctor, Admin)
export const explainImagingResultAI = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ImagingResult.findById(id);
    if (!result) {
      return errorResponse(res, "Không tìm thấy kết quả chẩn đoán.", 404);
    }

    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== result.medicalId) {
        return errorResponse(res, "Bạn không có quyền truy cập hồ sơ này.", 403);
      }
    } else {
      // Nhân viên y tế phải cùng bệnh viện
      if (result.hospitalId && result.hospitalId.toString() !== req.user.hospitalId?.toString()) {
        return errorResponse(res, "Bạn không có quyền giải thích kết quả phim chụp của bệnh viện khác.", 403);
      }
    }

    const clinicalText = `
      Loại phim chụp: ${result.imagingType}
      Chỉ định dịch vụ: ${result.procedure}
      Mô tả hình ảnh (Findings): ${result.findings}
      Kết luận chẩn đoán (Conclusion): ${result.conclusion}
    `;

    console.log(`📡 Đang gọi AI Server dịch báo cáo y khoa (http://localhost:8000/translate_for_patient) ...`);
    const aiTranslateUrl = (process.env.AI_SERVER_URL ? process.env.AI_SERVER_URL.replace("/predict", "/translate_for_patient") : "http://localhost:8000/translate_for_patient");

    const aiResponse = await fetch(aiTranslateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        clinical_report: clinicalText
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi từ AI Translate Server:", errorText);
      return errorResponse(res, `Không thể dịch kết quả: AI Server phản hồi lỗi ${aiResponse.status}`, 500);
    }

    const aiData = await aiResponse.json();
    return successResponse(res, { explanation: aiData.translated_report }, "Giải thích kết quả AI thành công.");
  } catch (error) {
    console.error("Lỗi giải thích kết quả AI:", error);
    return errorResponse(res, `Không thể phân tích hồ sơ: ${error.message}`, 500);
  }
};

// @desc    Get all imaging results for dashboard
// @route   GET /api/v1/imaging
// @access  Private (Doctor, Admin, Nurse, Technician, Receptionist)
export const getAllImagingResults = async (req, res) => {
  try {
    if (req.user.role === "patient") {
      return errorResponse(res, "Bạn không có quyền truy cập thông tin này.", 403);
    }
    // [BUG-07 FIX] Lọc theo hospitalId — không trả kết quả của bệnh viện khác
    if (!req.user.hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào.", 403);
    }
    const results = await ImagingResult.find({ hospitalId: req.user.hospitalId }).sort({ reportDate: -1 });
    return successResponse(res, results, "Lấy tất cả kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy tất cả kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};

// @desc    Kỹ thuật viên upload kết quả phim chụp (tạo bản ghi phim chụp và liên kết visit)
// @route   POST /api/v1/imaging-results
// @access  Private (Technician, Admin)
export const createKtvImagingResult = async (req, res) => {
  try {
    const {
      visitId,
      patientId,
      imageUrl,
      images,
      techNotes,
      region,
      requestAiAnalysis,
      dicomZipUrl,
      dicomZipSize,
      dicomZipFilename,
    } = req.body;

    const imageList = Array.isArray(images) && images.length > 0
      ? images
      : (imageUrl ? [imageUrl] : []);

    if (!visitId || !patientId || imageList.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin lượt khám, bệnh nhân hoặc đường dẫn hình ảnh." });
    }

    // Lấy thông tin lượt khám
    const visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({ message: "Không tìm thấy lượt khám tương ứng." });
    }

    // Lấy thông tin bệnh nhân
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: "Không tìm thấy bệnh nhân." });
    }

    // Lấy thông tin bác sĩ chỉ định từ visit
    const doctor = await User.findById(visit.doctorId);
    const doctorName = doctor?.profile?.fullName || doctor?.profile?.name || doctor?.email || "Bác sĩ chỉ định";

    // [FIX-BUG3] Ưu tiên medicalId từ profile, chỉ tự sinh khi thực sự không có
    const patientMedicalId = patient.profile?.medicalId
      || `BN${patient._id.toString().slice(-6).toUpperCase()}`;

    // Tạo bản ghi ImagingResult mới với các trường bắt buộc
    const imagingResult = new ImagingResult({
      hospitalId: req.user.hospitalId || visit.hospitalId,
      medicalId: patientMedicalId,
      patientName: patient.profile?.fullName || patient.profile?.name || patient.email,
      birthYear: patient.profile?.birthYear || 1990,
      gender: patient.profile?.gender === "Nữ" ? "Nữ" : patient.profile?.gender === "Khác" ? "Khác" : "Nam",
      address: patient.profile?.address || "Đà Nẵng",
      orderDate: visit.mriOrder?.orderedAt || new Date(),
      orderingDoctor: doctorName,
      orderingDepartment: "Chẩn đoán hình ảnh",
      medicalRecordNumber: "BA" + visit._id.toString().substring(18),
      diagnosis: visit.reason || "Theo dõi u não",
      procedure: "Chụp MRI vùng " + (region || visit.mriOrder?.region || "Não bộ"),
      technique: "Cộng hưởng từ (MRI) " + (region || visit.mriOrder?.region || "Não bộ") + " không thuốc cản quang.",
      findings: techNotes ? `Kỹ thuật viên ghi chú: ${techNotes}` : "Chờ bác sĩ đọc mô tả hình ảnh.",
      conclusion: "Chờ kết quả chẩn đoán từ bác sĩ.",
      radiologist: "Chờ bác sĩ CĐHA đọc & ký duyệt",
      isSigned: false,
      reportDate: new Date(),
      images: imageList,
      dicomZipUrl: dicomZipUrl || null,
      dicomZipSize: dicomZipSize || null,
      dicomZipFilename: dicomZipFilename || null,
      imagingType: "MRI"
    });

    await imagingResult.save();

    // Liên kết với visit và cập nhật trạng thái
    visit.mriOrder.imagingResultId = imagingResult._id;
    visit.status = requestAiAnalysis ? "chờ kết quả AI" : "chờ bác sĩ đọc";
    await visit.save();

    // ── Gửi thông báo tới Bác sĩ chỉ định ─────────────────────────────────────
    try {
      const patientName = patient.profile?.name || patient.profile?.fullName || "Bệnh nhân";
      await createNotificationInternal({
        hospitalId: visit.hospitalId,
        recipientId: visit.doctorId,
        senderId: req.user.id,
        type: "ai_ready",
        title: "📸 Phim chụp MRI sẵn sàng",
        message: `Phim chụp MRI vùng ${region || "Não bộ"} của bệnh nhân ${patientName} đã được tải lên (${imageList.length} ảnh). ${requestAiAnalysis ? 'Đang chạy phân tích AI...' : 'Sẵn sàng để bác sĩ đọc kết quả.'}`,
        relatedId: visit._id,
      });
    } catch (notifErr) {
      console.warn("⚠️ Không thể gửi thông báo cho Bác sĩ khi KTV hoàn tất scan:", notifErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Tự động chạy phân tích AI ngầm nếu KTV yêu cầu
    if (requestAiAnalysis && imageList.length > 0) {
      (async () => {
        try {
          console.log(`🤖 [Auto AI] Kích hoạt phân tích AI ngầm cho kết quả ${imagingResult._id}...`);
          const aiData = await executeAiPredictionInternal(imageList[0], req.user, visit._id);
          if (aiData) {
            const tumorLabel = aiData.class_name === "notumor"
              ? "Không phát hiện khối u"
              : `Nghi ngờ ${aiData.class_name.toUpperCase()}`;
            const aiText = `[AI Tự Động Phân Tích]: ${tumorLabel} (Độ tin cậy: ${aiData.confidence}%).`;

            await ImagingResult.findByIdAndUpdate(imagingResult._id, {
              aiReport: aiData,
              representativeSliceUrl: aiData.annotated_image || imageList[0],
              findings: techNotes ? `KTV: ${techNotes}\n${aiText}\n${aiData.clinical_report || ''}`.trim() : `${aiText}\n${aiData.clinical_report || ''}`.trim(),
              conclusion: `AI gợi ý: ${tumorLabel}. Chờ bác sĩ xác nhận.`,
            });
            await Visit.findByIdAndUpdate(visit._id, { status: "chờ bác sĩ đọc" });
            console.log(`✅ [Auto AI] Phân tích hoàn tất cho ca ${visit._id}. Trạng thái đã chuyển 'chờ bác sĩ đọc'.`);
          } else {
            console.warn(`⚠️ [Auto AI] AI không trả về dữ liệu hợp lệ cho ca ${visit._id}. Chuyển trạng thái để Bác sĩ đọc.`);
            await Visit.findByIdAndUpdate(visit._id, { status: "chờ bác sĩ đọc" });
          }
        } catch (autoAiErr) {
          console.warn(`⚠️ [Auto AI] Phân tích ngầm không thành công (${autoAiErr.message}). Chuyển trạng thái để Bác sĩ đọc trực tiếp.`);
          await Visit.findByIdAndUpdate(visit._id, { status: "chờ bác sĩ đọc" });
        }
      })();
    }

    res.status(201).json({
      success: true,
      message: "Tạo kết quả phim chụp thành công",
      data: imagingResult
    });
  } catch (error) {
    console.error("Lỗi khi KTV tạo kết quả chụp:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

// @desc    Cập nhật kết quả chẩn đoán phim chụp (Bác sĩ đọc phim)
// @route   PUT /api/v1/imaging/:id
// @access  Private (Doctor, Admin)
export const updateImagingResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { findings, conclusion, radiologist, technique, images } = req.body;

    const result = await ImagingResult.findById(id);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy kết quả phim chụp." });
    }

    // Tenancy Check
    if (result.hospitalId && req.user.hospitalId && result.hospitalId.toString() !== req.user.hospitalId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền sửa đổi kết quả chụp này." });
    }

    const signingDoctorName = req.user.profile?.fullName || req.user.profile?.name || req.user.email || "Bác sĩ CĐHA";
    if (findings !== undefined) result.findings = findings;
    if (conclusion !== undefined) result.conclusion = conclusion;
    if (radiologist !== undefined && radiologist.trim() && radiologist !== "Chờ bác sĩ CĐHA đọc & ký duyệt") {
      result.radiologist = radiologist;
    } else if (!result.radiologist || result.radiologist === "Chờ bác sĩ CĐHA đọc & ký duyệt") {
      result.radiologist = signingDoctorName;
    }
    if (technique !== undefined) result.technique = technique;
    if (images !== undefined) result.images = images;
    result.reportDate = new Date();
    // [THỰC TẾ BV: NGHỊCH LÝ 2] Đóng dấu ký số điện tử của Bác sĩ CĐHA
    result.isSigned = true;
    result.signedBy = req.user.id;
    result.signedByDoctorId = req.user.id;
    result.signedAt = new Date();

    await result.save();

    // [DRIVE] Lưu báo cáo chẩn đoán vào thư mục 04_Patient_Reports + 05_Metadata_Backups
    try {
      const reportBackup = {
        imagingResultId: result._id,
        medicalId: result.medicalId,
        patientName: result.patientName,
        findings: result.findings,
        conclusion: result.conclusion,
        technique: result.technique,
        radiologist: result.radiologist,
        reportDate: result.reportDate.toISOString(),
        updatedBy: req.user.id,
        updatedByEmail: req.user.email
      };
      const targetHospitalId = req.user.hospitalId || result.hospitalId;

      // Lưu báo cáo đã hoàn chỉnh vào 04_Patient_Reports
      try {
        const { Hospital } = await import("../../models/hospital.model.js");
        const hosp = await Hospital.findById(targetHospitalId).lean();
        const reportsFolderId = hosp?.subFolders?.patientReportsId;
        if (reportsFolderId) {
          const reportJson = Buffer.from(JSON.stringify(reportBackup, null, 2), 'utf-8');
          await uploadToDrive(
            reportJson,
            `report_${result.medicalId}_${Date.now()}.json`,
            'application/json',
            reportsFolderId
          );
          console.log(`✅ [Drive] Report saved to 04_Patient_Reports (patient: ${result.medicalId})`);
        }
      } catch (rptErr) {
        console.warn('⚠️ [Drive] Không thể lưu báo cáo vào 04_Patient_Reports:', rptErr.message);
      }

      // Cũng lưu bản sao vào 05_Metadata_Backups
      await uploadMetadataBackup(reportBackup, targetHospitalId, `report_backup_${result.medicalId}`);
    } catch (backupError) {
      console.warn("⚠️ Không thể sao lưu bản ghi chẩn đoán lên Google Drive:", backupError.message);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật kết quả phim chụp thành công",
      data: result
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật kết quả phim chụp:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};



