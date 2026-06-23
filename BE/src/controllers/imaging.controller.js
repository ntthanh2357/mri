import { ImagingResult } from "../models/imagingResult.model.js";
import { User } from "../models/user.model.js";
import { Visit } from "../models/visit.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { bucket } from "../config/firebase.js";

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

    // Authorization check: Patients can only view their own results
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== result.medicalId) {
        return errorResponse(res, "Bạn không có quyền xem kết quả chẩn đoán này.", 403);
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
    // 1. Check roles
    if (req.user.role === "patient") {
      const user = await User.findById(req.user.id);
      if (!user || user.profile?.medicalId !== medicalId) {
        return errorResponse(res, "Bạn chỉ có thể tự lưu trữ kết quả cho chính mình.", 403);
      }
    } else if (req.user.role !== "doctor" && req.user.role !== "admin" && req.user.role !== "technician") {
      return errorResponse(res, "Bạn không có quyền thực hiện hành động này.", 403);
    }

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
      imagingType,
      visitId,
    } = req.body;

    // 2. Validate required fields
    if (!medicalId || !patientName || !gender || !orderDate || !procedure || !findings || !conclusion || !radiologist || !reportDate || !imagingType) {
      return errorResponse(res, "Vui lòng nhập đầy đủ các trường bắt buộc.", 400);
    }

    // 3. Create record
    const newResult = new ImagingResult({
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

// @desc    Upload imaging scan image (Base64)
// @route   POST /api/v1/imaging/upload
// @access  Private
export const uploadImagingImage = async (req, res) => {
  try {
    const { fileData, fileName, imagingType } = req.body;
    if (!fileData) {
      return errorResponse(res, "Thiếu dữ liệu tệp tin.", 400);
    }

    // Expect base64 format like "data:image/png;base64,iVBORw0KGgo..."
    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return errorResponse(res, "Định dạng ảnh Base64 không hợp lệ.", 400);
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    const ext = fileName ? path.extname(fileName) : ".png";

    // 1. Try uploading to Firebase Storage if configured
    if (bucket) {
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
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
        
        return successResponse(res, { imageUrl: publicUrl }, "Tải ảnh lên Firebase Storage thành công.");
      } catch (fbError) {
        console.warn("Tải lên Firebase Storage thất bại, chuyển sang lưu trữ cục bộ:", fbError);
      }
    }

    // 2. Fallback to Local Storage
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const newFileName = `uploaded_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    const filePath = path.join(uploadsDir, newFileName);

    fs.writeFileSync(filePath, imageBuffer);

    const relativeUrl = `/uploads/${newFileName}`;
    return successResponse(res, { imageUrl: relativeUrl }, "Tải ảnh lên thành công (lưu trữ cục bộ).");
  } catch (error) {
    console.error("Lỗi khi tải ảnh lên:", error);
    return errorResponse(res, "Có lỗi xảy ra khi lưu ảnh.", 500);
  }
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

    let fileBuffer;
    let fileName = "scan.jpg";

    // 2. Resolve image source (Local path vs Firebase vs external URL)
    if (imageUrl.startsWith("/uploads/")) {
      // Local path
      const absolutePath = path.join(__dirname, "../..", imageUrl);
      if (!fs.existsSync(absolutePath)) {
        return errorResponse(res, `Không tìm thấy tệp ảnh tại đường dẫn cục bộ: ${imageUrl}`, 404);
      }
      fileBuffer = fs.readFileSync(absolutePath);
      fileName = path.basename(absolutePath);
    } else if (imageUrl.startsWith("http")) {
      // External URL or Firebase Storage URL
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

    // Determine mime-type
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

    // 3. Forward to Python FastAPI server using native fetch and FormData
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append("file", blob, fileName);

    console.log(`📡 Đang gửi ảnh tới AI server (http://localhost:8000/predict) ...`);
    const aiServerUrl = process.env.AI_SERVER_URL || "http://localhost:8000/predict";

    const aiResponse = await fetch(aiServerUrl, {
      method: "POST",
      body: formData,
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lỗi từ AI Server:", errorText);
      return errorResponse(
        res,
        `AI Server trả về lỗi: ${aiResponse.status} - ${errorText || "Mất kết nối hoặc dịch vụ AI chưa chạy."}`,
        500
      );
    }

    const aiData = await aiResponse.json();

    if (visitId) {
      const visit = await Visit.findById(visitId);
      if (visit) {
        visit.status = "chờ bác sĩ đọc";
        await visit.save();
      }
    }

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
      const absolutePath = path.join(__dirname, "../..", imageUrl);
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
    const results = await ImagingResult.find({}).sort({ reportDate: -1 });
    return successResponse(res, results, "Lấy tất cả kết quả chẩn đoán hình ảnh thành công.");
  } catch (error) {
    console.error("Lỗi khi lấy tất cả kết quả chẩn đoán hình ảnh:", error);
    return errorResponse(res, "Có lỗi xảy ra khi tải dữ liệu.", 500);
  }
};


