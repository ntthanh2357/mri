import { MedicalRecord } from "../models/medicalRecord.model.js";
import { CareSheet } from "../models/careSheet.model.js";
import { Consultation } from "../models/consultation.model.js";
import { ConsentForm } from "../models/consentForm.model.js";
import { EMRVersion } from "../models/emrVersion.model.js";

// --- Medical Record (HSBA) Controllers ---

export const getRecords = async (req, res) => {
  try {
    const { search } = req.query;
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Không thể xác định bệnh viện của người dùng." });
    }

    let query = { hospitalId };
    
    if (search) {
      query.$and = [
        { hospitalId },
        {
          $or: [
            { patientName: { $regex: search, $options: "i" } },
            { patientId: { $regex: search, $options: "i" } },
            { diagnosis: { $regex: search, $options: "i" } },
          ]
        }
      ];
    }

    const records = await MedicalRecord.find(query).sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: records });
  } catch (error) {
    console.error("Lỗi lấy danh sách bệnh án:", error);
    res.status(500).json({ message: "Không thể lấy danh sách bệnh án." });
  }
};

export const createRecord = async (req, res) => {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Không thể xác định bệnh viện của người dùng." });
    }

    const {
      patientId,
      patientName,
      gender,
      age,
      admissionType,
      department,
      paymentMethod,
      diagnosis,
      treatmentPlan,
      doctorInCharge,
    } = req.body;

    if (!patientId || !patientName || !age || !diagnosis || !doctorInCharge) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin bắt buộc." });
    }

    const newRecord = new MedicalRecord({
      hospitalId,
      patientId,
      patientName,
      gender,
      age,
      admissionType,
      department,
      paymentMethod,
      diagnosis,
      treatmentPlan,
      doctorInCharge,
      status: "Đang điều trị",
      signStatus: "Chưa duyệt",
    });

    await newRecord.save();
    res.status(201).json({ status: "success", data: newRecord });
  } catch (error) {
    console.error("Lỗi tạo bệnh án:", error);
    res.status(500).json({ message: "Không thể tạo bệnh án mới." });
  }
};

export const getRecordById = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    // Cho phép xem bệnh án liên viện. Quyền sửa đổi vẫn được bảo vệ trong updateRecord.

    res.status(200).json({ status: "success", data: record });
  } catch (error) {
    console.error("Lỗi chi tiết bệnh án:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi lấy chi tiết bệnh án." });
  }
};

export const updateRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }

    // Tenancy Check
    if (record.hospitalId && record.hospitalId.toString() !== req.user?.hospitalId?.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật hồ sơ bệnh án này." });
    }

    const updates = req.body;
    
    // So sánh sự khác biệt để ghi nhận phiên bản EMR
    const changes = {};
    let hasChanges = false;
    
    // Các trường quan trọng cần lưu vết
    const trackedFields = ["diagnosis", "treatmentPlan", "status", "admissionType", "paymentMethod", "doctorInCharge", "department"];
    
    trackedFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== record[field]) {
        changes[field] = {
          old: record[field] || "",
          new: updates[field] || ""
        };
        hasChanges = true;
      }
    });

    // Ghi nhận phiên bản nếu phát hiện thay đổi
    if (hasChanges) {
      const nextVersion = (record.currentVersion || 1) + 1;
      const emrVersion = new EMRVersion({
        medicalRecordId: record._id,
        version: record.currentVersion || 1, // Lưu trạng thái hiện tại trước khi lên ver mới
        modifiedBy: req.user?.profile?.name || "Bác sĩ điều trị",
        changes,
      });
      await emrVersion.save();
      
      updates.currentVersion = nextVersion;
    }

    // If setting to discharge, record discharge date
    if (updates.status === "Xuất viện" && record.status !== "Xuất viện") {
      updates.dischargeDate = new Date();
    }

    const updatedRecord = await MedicalRecord.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.status(200).json({ status: "success", data: updatedRecord });
  } catch (error) {
    console.error("Lỗi cập nhật bệnh án:", error);
    res.status(500).json({ message: "Không thể cập nhật bệnh án." });
  }
};

export const getRecordVersions = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    // Cho phép xem lịch sử bệnh án liên viện.
    const versions = await EMRVersion.find({ medicalRecordId: req.params.id }).sort({ version: -1 });
    res.status(200).json({ status: "success", data: versions });
  } catch (error) {
    console.error("Lỗi lấy danh sách lịch sử sửa đổi bệnh án:", error);
    res.status(500).json({ message: "Không thể lấy lịch sử sửa đổi bệnh án." });
  }
};

// --- Care Sheet (Phiếu chăm sóc) Controllers ---

export const getCareSheets = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    // Cho phép xem danh sách phiếu chăm sóc liên viện.

    const careSheets = await CareSheet.find({ medicalRecordId: req.params.id }).sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: careSheets });
  } catch (error) {
    console.error("Lỗi lấy danh sách phiếu chăm sóc:", error);
    res.status(500).json({ message: "Không thể lấy danh sách phiếu chăm sóc." });
  }
};

export const createCareSheet = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    if (record.hospitalId && record.hospitalId.toString() !== req.user?.hospitalId?.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const { careLevel, pulse, bloodPressure, temperature, respiratoryRate, spo2, progressNotes, careActions, nurse } = req.body;

    if (!pulse || !bloodPressure || !temperature || !respiratoryRate || !spo2 || !progressNotes || !nurse) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ các chỉ số sinh hiệu và diễn biến bệnh." });
    }

    const newCareSheet = new CareSheet({
      medicalRecordId: req.params.id,
      careLevel,
      pulse,
      bloodPressure,
      temperature,
      respiratoryRate,
      spo2,
      progressNotes,
      careActions,
      nurse,
    });

    await newCareSheet.save();

    // Đồng bộ sinh hiệu sang VitalSign
    try {
      if (record) {
        let query = {};
        if (/^[0-9a-fA-F]{24}$/.test(record.patientId)) {
          query = { $or: [{ _id: record.patientId }, { "profile.medicalId": record.patientId }] };
        } else {
          query = { "profile.medicalId": record.patientId };
        }

        const { User } = await import("../models/user.model.js");
        const { VitalSign } = await import("../models/vitalSign.model.js");

        const patientUser = await User.findOne(query);
        if (patientUser) {
          const bpStr = bloodPressure || "";
          const bpParts = bpStr.split("/");
          const systolic = bpParts[0] ? Number(bpParts[0].trim()) : null;
          const diastolic = bpParts[1] ? Number(bpParts[1].trim()) : null;

          if (systolic && diastolic && !isNaN(systolic) && !isNaN(diastolic)) {
            const latestVital = await VitalSign.findOne({ patient_id: patientUser._id }).sort({ recorded_at: -1 });
            const height = latestVital?.height || null;
            const weight = latestVital?.weight || null;
            let bmi = null;
            if (weight && height) {
              bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
            }

            const newVital = new VitalSign({
              patient_id: patientUser._id,
              pulse: Number(pulse),
              blood_pressure: { systolic, diastolic },
              spo2: Number(spo2),
              weight: weight || undefined,
              height: height || undefined,
              bmi: bmi || undefined,
              recorded_at: new Date(),
            });
            await newVital.save();
            console.log("Automatically synced VitalSign from EMR CareSheet.");
          }
        }
      }
    } catch (err) {
      console.warn("Lỗi đồng bộ sinh hiệu từ CareSheet:", err);
    }

    res.status(201).json({ status: "success", data: newCareSheet });
  } catch (error) {
    console.error("Lỗi tạo phiếu chăm sóc:", error);
    res.status(500).json({ message: "Không thể lưu phiếu chăm sóc." });
  }
};

// --- Consultation (Hội chẩn) Controllers ---

export const getConsultations = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    // Cho phép xem danh sách hội chẩn liên viện.

    const consultations = await Consultation.find({ medicalRecordId: req.params.id }).sort({ meetingDate: -1 });
    res.status(200).json({ status: "success", data: consultations });
  } catch (error) {
    console.error("Lỗi lấy danh sách hội chẩn:", error);
    res.status(500).json({ message: "Không thể lấy danh sách biên bản hội chẩn." });
  }
};

export const createConsultation = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    if (record.hospitalId && record.hospitalId.toString() !== req.user?.hospitalId?.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const { meetingDate, participants, clinicalSummary, diagnosis, treatmentConclusion } = req.body;

    if (!participants || participants.length === 0 || !clinicalSummary || !diagnosis || !treatmentConclusion) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin hội chẩn." });
    }

    const newConsultation = new Consultation({
      medicalRecordId: req.params.id,
      meetingDate: meetingDate || new Date(),
      participants,
      clinicalSummary,
      diagnosis,
      treatmentConclusion,
    });

    await newConsultation.save();
    res.status(201).json({ status: "success", data: newConsultation });
  } catch (error) {
    console.error("Lỗi tạo biên bản hội chẩn:", error);
    res.status(500).json({ message: "Không thể lưu biên bản hội chẩn." });
  }
};

// --- Consent Form (Cam đoan) Controllers ---

export const getConsents = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    // Cho phép xem danh sách giấy cam đoan liên viện.

    const consents = await ConsentForm.find({ medicalRecordId: req.params.id }).sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: consents });
  } catch (error) {
    console.error("Lỗi lấy giấy cam đoan:", error);
    res.status(500).json({ message: "Không thể lấy danh sách giấy cam đoan." });
  }
};

export const createConsent = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
    }
    if (record.hospitalId && record.hospitalId.toString() !== req.user?.hospitalId?.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập hồ sơ bệnh án này." });
    }

    const { procedureName, risks, doctorExplanation } = req.body;

    if (!procedureName || !risks || !doctorExplanation) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên thủ thuật, nguy cơ và giải thích của bác sĩ." });
    }

    const newConsent = new ConsentForm({
      medicalRecordId: req.params.id,
      procedureName,
      risks,
      doctorExplanation,
      doctorSigned: false,
      patientSigned: false,
    });

    await newConsent.save();
    res.status(201).json({ status: "success", data: newConsent });
  } catch (error) {
    console.error("Lỗi tạo giấy cam đoan:", error);
    res.status(500).json({ message: "Không thể tạo giấy cam đoan." });
  }
};

export const signConsent = async (req, res) => {
  try {
    const { role, signature } = req.body; // role: "doctor" | "patient", signature: Tên người ký
    const consent = await ConsentForm.findById(req.params.consentId);
    if (!consent) {
      return res.status(404).json({ message: "Không tìm thấy giấy cam đoan." });
    }

    const record = await MedicalRecord.findById(consent.medicalRecordId);
    if (!record || (record.hospitalId && record.hospitalId.toString() !== req.user?.hospitalId?.toString())) {
      return res.status(403).json({ message: "Bạn không có quyền thao tác trên giấy cam đoan này." });
    }

    if (role === "doctor") {
      consent.doctorSigned = true;
      consent.doctorSignature = signature || "Bs. Phụ trách";
    } else if (role === "patient") {
      consent.patientSigned = true;
      consent.patientSignature = signature || "Người bệnh/Đại diện";
    } else {
      return res.status(400).json({ message: "Vai trò ký không hợp lệ." });
    }

    await consent.save();
    res.status(200).json({ status: "success", data: consent });
  } catch (error) {
    console.error("Lỗi ký giấy cam đoan:", error);
    res.status(500).json({ message: "Không thể thực hiện ký duyệt." });
  }
};
