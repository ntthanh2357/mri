import { User } from "../models/user.model.js";
import { Visit } from "../models/visit.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { LabOrder } from "../models/labOrder.model.js";
import { Prescription } from "../models/prescription.model.js";
import { DischargePaper } from "../models/dischargePaper.model.js";
import { TransferForm } from "../models/transferForm.model.js";
import { Drug } from "../models/drug.model.js";
import { MedicineReminder } from "../models/medicineReminder.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { checkPatientTenancy } from "../utils/tenancy.util.js";
import { getDayRangeVN } from "../utils/date.util.js";
export { checkPatientTenancy };

// Khung giờ nhắc uống thuốc cố định theo số lần/ngày
const REMINDER_TIME_SLOTS = {
  1: ["08:00"],
  2: ["08:00", "20:00"],
  3: ["08:00", "13:00", "20:00"],
  4: ["08:00", "12:00", "17:00", "21:00"],
};

const generateRemindersForPrescription = async (prescription) => {
  const reminders = [];
  const { startOfDay: today } = getDayRangeVN();

  for (const drug of prescription.drugs) {
    const timesPerDay = Math.min(Math.max(drug.timesPerDay || 2, 1), 4);
    const durationDays = Math.max(drug.durationDays || 7, 1);
    const slots = REMINDER_TIME_SLOTS[timesPerDay];
    const dosageText = `${drug.quantity} ${drug.unit}${drug.usage ? ` — ${drug.usage}` : ""}`;

    for (let day = 0; day < durationDays; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      for (const time of slots) {
        reminders.push({
          hospitalId: prescription.hospitalId,
          patientId: prescription.patient_id,
          prescriptionId: prescription._id,
          drugName: drug.name,
          dosageText,
          date,
          time,
        });
      }
    }
  }

  if (reminders.length > 0) {
    await MedicineReminder.insertMany(reminders);
  }
};

// checkPatientTenancy đã được chuẩn hóa và tách vào src/utils/tenancy.util.js

// Lấy danh sách bệnh nhân kèm thống kê (đã tối ưu hóa O(1) truy vấn, chống N+1 và hỗ trợ phân trang)
export const getPatients = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userHospitalId = req.user?.hospitalId;

    // Bắt buộc phải có hospitalId (trừ Admin cấp cao)
    if (!userHospitalId && userRole !== "admin") {
      return errorResponse(res, "Bạn chưa được gán vào bệnh viện nào. Không thể truy xuất danh sách bệnh nhân.", 403);
    }

    // [BẢO MẬT ĐA CƠ SỞ & BẢO VỆ DỮ LIỆU B2C]:
    // - Bác sĩ/Điều dưỡng/Lễ tân CHỈ ĐƯỢC XEM bệnh nhân thuộc bệnh viện của mình (hospitalId: req.user.hospitalId).
    // - Bệnh nhân B2C tự do (hospitalId == null) được bảo vệ quyền riêng tư tuyệt đối,
    //   không hiển thị tràn lan ra danh sách bệnh nhân của các bệnh viện khác.
    // - Chỉ Admin hệ thống mới có thể xem toàn bộ hoặc lọc riêng bệnh nhân B2C (req.query.b2cOnly).
    const query = { role: "patient" };

    if (userRole === "admin" || userRole === "system_admin") {
      if (req.query.b2cOnly === "true") {
        query.$or = [{ hospitalId: null }, { hospitalId: { $exists: false } }];
      } else if (userHospitalId && req.query.allHospitals !== "true") {
        query.hospitalId = userHospitalId;
      }
    } else {
      // Nhân viên y tế thông thường: Ép buộc 100% cô lập theo hospitalId của bệnh viện
      query.hospitalId = userHospitalId;
    }
    
    // [SECURITY FIX] Khắc phục ReDoS & bảo vệ triệt để ranh giới bệnh viện (Cross-tenant Isolation)
    if (req.query.search && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, "i");
      const searchConditions = [
        { "profile.medicalId": searchRegex },
        { email: searchRegex },
        { "profile.phone": searchRegex },
        { "profile.name": searchRegex },
        { "profile.fullName": searchRegex }
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Phân trang: Mặc định lấy trang 1, 20 bản ghi (hỗ trợ all=true cho các màn hình tổng hợp)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.all === "true" ? 100 : Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [totalPatients, patients] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    if (patients.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Lấy danh sách bệnh nhân thành công.",
        data: [],
        pagination: { total: totalPatients, page, limit, totalPages: Math.ceil(totalPatients / limit) || 1 }
      });
    }

    const patientIds = patients.map((p) => p._id);

    // TỐI ƯU HÓA N+1: Gom toàn bộ thống kê bằng Aggregate Bulk Group O(1)
    const [totalOrdersAgg, completedOrdersAgg, latestVitalsAgg] = await Promise.all([
      LabOrder.aggregate([
        { $match: { patient_id: { $in: patientIds } } },
        { $group: { _id: "$patient_id", count: { $sum: 1 } } }
      ]),
      LabOrder.aggregate([
        { $match: { patient_id: { $in: patientIds }, status: "COMPLETED" } },
        { $group: { _id: "$patient_id", count: { $sum: 1 } } }
      ]),
      VitalSign.aggregate([
        { $match: { patient_id: { $in: patientIds } } },
        { $sort: { recorded_at: -1 } },
        {
          $group: {
            _id: "$patient_id",
            pulse: { $first: "$pulse" },
            blood_pressure: { $first: "$blood_pressure" },
            spo2: { $first: "$spo2" },
            recorded_at: { $first: "$recorded_at" }
          }
        }
      ])
    ]);

    // Tạo bảng tra cứu Map O(1)
    const totalOrdersMap = new Map(totalOrdersAgg.map(item => [item._id.toString(), item.count]));
    const completedOrdersMap = new Map(completedOrdersAgg.map(item => [item._id.toString(), item.count]));
    const latestVitalsMap = new Map(latestVitalsAgg.map(item => [item._id.toString(), item]));

    const enrichedPatients = patients.map((patient) => {
      const pIdStr = patient._id.toString();
      return {
        ...patient,
        stats: {
          total_lab_orders: totalOrdersMap.get(pIdStr) || 0,
          completed_lab_orders: completedOrdersMap.get(pIdStr) || 0,
          last_vital: latestVitalsMap.get(pIdStr) || null,
        }
      };
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách bệnh nhân thành công.",
      data: enrichedPatients,
      pagination: {
        total: totalPatients,
        page,
        limit,
        totalPages: Math.ceil(totalPatients / limit) || 1
      }
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh nhân:", error);
    return errorResponse(res, "Lỗi lấy danh sách bệnh nhân.", 500);
  }
};

// Lấy chi tiết 1 bệnh nhân theo ID — chỉ cho phép khi cùng viện hoặc có phiếu chuyển viện hợp lệ
export const getPatientById = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await checkPatientTenancy(patientId, req.user);
    if (!patient) {
      return errorResponse(res, "Không tìm thấy bệnh nhân hoặc bạn không có quyền truy cập hồ sơ (vi phạm ranh giới bệnh viện và chưa có phiếu chuyển tuyến).", 403);
    }
    const { passwordHash, ...safePatient } = patient.toObject();
    return successResponse(res, safePatient, "Lấy thông tin bệnh nhân thành công.");
  } catch (error) {
    console.error("Lỗi lấy chi tiết bệnh nhân:", error);
    return errorResponse(res, "Lỗi lấy chi tiết bệnh nhân.", 500);
  }
};


// Lấy lịch sử sinh hiệu bệnh nhân (sắp xếp tăng dần theo thời gian)
export const getPatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientExists = await checkPatientTenancy(patientId, req.user);
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

    const patientExists = await checkPatientTenancy(patientId, req.user);
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
    const patientExists = await checkPatientTenancy(patientId, req.user);
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
    const patient = await checkPatientTenancy(patientId, req.user);
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
    const patientExists = await checkPatientTenancy(patientId, req.user);
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

    const patientExists = await checkPatientTenancy(patientId, req.user);
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

    // Tự động sinh lịch nhắc uống thuốc cho bệnh nhân dựa trên số lần/ngày và số ngày uống
    await generateRemindersForPrescription(newItem);

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
    const patientExists = await checkPatientTenancy(patientId, req.user);
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

    const patientExists = await checkPatientTenancy(patientId, req.user);
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
    const patientExists = await checkPatientTenancy(patientId, req.user);
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

    const patientExists = await checkPatientTenancy(patientId, req.user);
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
