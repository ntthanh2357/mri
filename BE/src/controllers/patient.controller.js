import { User } from "../models/user.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { LabOrder } from "../models/labOrder.model.js";
import { Prescription } from "../models/prescription.model.js";
import { DischargePaper } from "../models/dischargePaper.model.js";
import { TransferForm } from "../models/transferForm.model.js";
import { Drug } from "../models/drug.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

const checkPatientTenancy = async (patientId, userHospitalId) => {
  if (!userHospitalId) return null;
  const patient = await User.findById(patientId);
  if (!patient || patient.role !== "patient") return null;
  // Cho phép mọi nhân viên y tế từ bất kỳ bệnh viện nào xem hồ sơ để phục vụ chuyển tuyến
  return patient;
};

// Lấy danh sách bệnh nhân kèm thống kê (số phiếu XN, lần đo sinh hiệu gần nhất)
export const getPatients = async (req, res) => {
  try {
    // [BUG-06 FIX] Bắt buộc phải có hospitalId — không cho phép query toàn hệ thống
    if (!req.user?.hospitalId) {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào. Không thể truy xuất danh sách bệnh nhân.", 403);
    }
    const query = { role: "patient", hospitalId: req.user.hospitalId };
    
    // [BUG FIX] Hỗ trợ tìm kiếm liên viện để chuyển tuyến
    if (req.query.search) {
      delete query.hospitalId; // Bỏ giới hạn bệnh viện nếu đang search (chuyển tuyến)
      query.$or = [
        { "profile.medicalId": new RegExp(req.query.search, "i") },
        { email: new RegExp(req.query.search, "i") },
        { "profile.phone": new RegExp(req.query.search, "i") },
        { "profile.name": new RegExp(req.query.search, "i") },
        { "profile.fullName": new RegExp(req.query.search, "i") }
      ];
    }

    const patients = await User.find(query).select("-passwordHash").lean();

    // Với mỗi bệnh nhân, lấy thêm: tổng số phiếu XN, số phiếu đã có KQ, sinh hiệu gần nhất
    const enrichedPatients = await Promise.all(
      patients.map(async (patient) => {
        const [totalOrders, completedOrders, latestVital] = await Promise.all([
          LabOrder.countDocuments({ patient_id: patient._id }),
          LabOrder.countDocuments({ patient_id: patient._id, status: "COMPLETED" }),
          VitalSign.findOne({ patient_id: patient._id })
            .sort({ recorded_at: -1 })
            .select("pulse blood_pressure spo2 recorded_at")
            .lean()
        ]);

        return {
          ...patient,
          stats: {
            total_lab_orders: totalOrders,
            completed_lab_orders: completedOrders,
            last_vital: latestVital || null,
          }
        };
      })
    );

    return successResponse(res, enrichedPatients, "Lấy danh sách bệnh nhân thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh nhân:", error);
    return errorResponse(res, "Lỗi lấy danh sách bệnh nhân.", 500);
  }
};


// Lấy lịch sử sinh hiệu bệnh nhân (sắp xếp tăng dần theo thời gian)
export const getPatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const vitals = await VitalSign.find({ patient_id: patientId }).sort({ recorded_at: 1 });
    return successResponse(res, vitals, "Lấy lịch sử sinh hiệu thành công.");
  } catch (error) {
    console.error("Lỗi lấy lịch sử sinh hiệu:", error);
    return errorResponse(res, "Lỗi lấy lịch sử sinh hiệu.", 500);
  }
};

// Ghi nhận chỉ số sinh hiệu mới
export const addPatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { pulse, blood_pressure, spo2, weight, height, recorded_at } = req.body;

    if (!pulse || !blood_pressure || !spo2) {
      return errorResponse(res, "Thiếu thông tin mạch, huyết áp hoặc SpO2.", 400);
    }

    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    // Tự động tính chỉ số BMI nếu có cân nặng và chiều cao
    let bmi = null;
    if (weight && height) {
      bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
    }

    const newVital = new VitalSign({
      patient_id: patientId,
      pulse,
      blood_pressure,
      spo2,
      weight,
      height,
      bmi,
      recorded_at: recorded_at || new Date()
    });

    await newVital.save();
    return successResponse(res, newVital, "Ghi nhận sinh hiệu mới thành công.", 201);
  } catch (error) {
    console.error("Lỗi thêm sinh hiệu mới:", error);
    return errorResponse(res, "Lỗi thêm sinh hiệu mới.", 500);
  }
};

// Lấy danh sách phiếu xét nghiệm của bệnh nhân (sắp xếp giảm dần theo ngày tạo)
export const getPatientLabOrders = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const orders = await LabOrder.find({ patient_id: patientId }).sort({ ordered_at: -1 });
    return successResponse(res, orders, "Lấy danh sách phiếu xét nghiệm thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh sách phiếu xét nghiệm:", error);
    return errorResponse(res, "Lỗi lấy danh sách phiếu xét nghiệm.", 500);
  }
};

// Tạo phiếu chỉ định xét nghiệm mới
export const createPatientLabOrder = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { category, barcode, patient_gender } = req.body;

    if (!category || !barcode) {
      return errorResponse(res, "Thiếu thông tin phân loại xét nghiệm hoặc mã vạch barcode.", 400);
    }

    // Xác thực bệnh nhân có tồn tại và thuộc cùng bệnh viện
    const patient = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    // Kiểm tra barcode trùng lặp
    const existingOrder = await LabOrder.findOne({ barcode });
    if (existingOrder) {
      return errorResponse(res, "Mã vạch barcode đã được sử dụng cho một phiếu khác.", 400);
    }

    // Xác định giới tính từ body hoặc mặc định Nam/Nữ
    const genderToUse = patient_gender || "Nam";

    const newOrder = new LabOrder({
      patient_id: patientId,
      patient_gender: genderToUse,
      barcode,
      category,
      status: "PENDING",
      results: []
    });

    await newOrder.save();
    return successResponse(res, newOrder, "Tạo chỉ định xét nghiệm mới thành công.", 201);
  } catch (error) {
    console.error("Lỗi tạo chỉ định xét nghiệm:", error);
    return errorResponse(res, "Lỗi tạo chỉ định xét nghiệm.", 500);
  }
};

// Lấy danh sách đơn thuốc của bệnh nhân
export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const items = await Prescription.find({ patient_id: patientId }).sort({ recorded_at: -1 });
    return successResponse(res, items, "Lấy danh sách đơn thuốc thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn thuốc:", error);
    return errorResponse(res, "Lỗi lấy danh sách đơn thuốc.", 500);
  }
};

// Thêm đơn thuốc mới
export const addPatientPrescription = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctor_name, diagnosis, drugs, note } = req.body;

    if (!diagnosis || !drugs || !Array.isArray(drugs) || drugs.length === 0) {
      return errorResponse(res, "Thiếu thông tin chẩn đoán hoặc danh sách thuốc.", 400);
    }

    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const newItem = new Prescription({
      patient_id: patientId,
      doctor_name: doctor_name || "Bác sĩ điều trị",
      diagnosis,
      drugs,
      note: note || ""
    });

    await newItem.save();

    // Việc khấu trừ kho thuốc sẽ được thực hiện khi thanh toán hóa đơn thực tế (ở invoice.controller.js)

    return successResponse(res, newItem, "Thêm đơn thuốc mới thành công.", 201);
  } catch (error) {
    console.error("Lỗi thêm đơn thuốc:", error);
    return errorResponse(res, "Lỗi thêm đơn thuốc.", 500);
  }
};

// Lấy danh sách giấy ra viện của bệnh nhân
export const getPatientDischargePapers = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const items = await DischargePaper.find({ patient_id: patientId }).sort({ recorded_at: -1 });
    return successResponse(res, items, "Lấy danh sách giấy ra viện thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh sách giấy ra viện:", error);
    return errorResponse(res, "Lỗi lấy danh sách giấy ra viện.", 500);
  }
};

// Thêm giấy ra viện mới
export const addPatientDischargePaper = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctor_name, dischargeNo, hospitalNo, dateIn, dateOut, diagnosis, treatment, note } = req.body;

    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const newItem = new DischargePaper({
      patient_id: patientId,
      doctor_name: doctor_name || "Bác sĩ điều trị",
      dischargeNo: dischargeNo || "",
      hospitalNo: hospitalNo || "",
      dateIn: dateIn || new Date(),
      dateOut: dateOut || new Date(),
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      note: note || ""
    });

    await newItem.save();
    return successResponse(res, newItem, "Thêm giấy ra viện thành công.", 201);
  } catch (error) {
    console.error("Lỗi thêm giấy ra viện:", error);
    return errorResponse(res, "Lỗi thêm giấy ra viện.", 500);
  }
};

// Lấy danh sách phiếu chuyển tuyến của bệnh nhân
export const getPatientTransferForms = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const items = await TransferForm.find({ patient_id: patientId }).sort({ recorded_at: -1 });
    return successResponse(res, items, "Lấy danh sách phiếu chuyển tuyến thành công.");
  } catch (error) {
    console.error("Lỗi lấy danh sách phiếu chuyển tuyến:", error);
    return errorResponse(res, "Lỗi lấy danh sách phiếu chuyển tuyến.", 500);
  }
};

// Thêm phiếu chuyển tuyến mới
export const addPatientTransferForm = async (req, res) => {
  try {
    const { patientId } = req.params;
    const fields = req.body;

    const patientExists = await checkPatientTenancy(patientId, req.user?.hospitalId);
    if (!patientExists) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc không có quyền truy cập.", 403);
    }

    const newItem = new TransferForm({
      patient_id: patientId,
      ...fields
    });

    await newItem.save();
    return successResponse(res, newItem, "Thêm phiếu chuyển tuyến thành công.", 201);
  } catch (error) {
    console.error("Lỗi thêm phiếu chuyển tuyến:", error);
    return errorResponse(res, "Lỗi thêm phiếu chuyển tuyến.", 500);
  }
};
