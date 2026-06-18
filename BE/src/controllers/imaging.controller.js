import { ImagingResult } from "../models/imagingResult.model.js";
import { User } from "../models/user.model.js";
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
    if (req.user.role !== "doctor" && req.user.role !== "admin") {
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
    if (req.user.role !== "doctor" && req.user.role !== "admin") {
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
