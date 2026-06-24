import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { uploadToGCS } from "../config/gcs.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /api/v1/hospital/me — hospital_admin xem thông tin bệnh viện của mình
export const getMyHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.user.hospitalId).lean();
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }
    res.status(200).json({ success: true, hospital });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/v1/hospital/onboarding — hospital_admin điền thông tin Step 3
export const submitOnboardingInfo = async (req, res) => {
  try {
    const {
      nameShort, taxCode, loginEmail,
      addressStreet, addressWard, addressDistrict, addressProvince,
      phone, contactEmail, website, fax,
      legalRepName, legalRepPosition, legalRepPhone, legalRepEmail,
      itName, itPhone, itEmail,
    } = req.body;

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Tài khoản không gắn với bệnh viện nào." });
    }

    // Validate required fields
    const missing = [];
    if (!loginEmail) missing.push("Email đăng nhập chính thức");
    if (!phone) missing.push("Số điện thoại liên hệ");
    if (!contactEmail) missing.push("Email liên hệ");
    if (!addressStreet || !addressDistrict || !addressProvince) missing.push("Địa chỉ trụ sở");
    if (!legalRepName || !legalRepPosition || !legalRepPhone || !legalRepEmail) missing.push("Thông tin người đại diện");
    if (!itName || !itPhone || !itEmail) missing.push("Thông tin IT phụ trách");
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Thiếu các trường bắt buộc: ${missing.join(", ")}` });
    }

    // Check loginEmail uniqueness across all users (excluding current temp user)
    const emailConflict = await User.findOne({ email: loginEmail.toLowerCase(), _id: { $ne: req.user.id } });
    if (emailConflict) {
      return res.status(409).json({ success: false, message: "Email đăng nhập đã được sử dụng bởi tài khoản khác." });
    }

    const updated = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        nameShort: nameShort || '',
        taxCode: taxCode || '',
        loginEmail: loginEmail.toLowerCase(),
        address: {
          street: addressStreet || '',
          ward: addressWard || '',
          district: addressDistrict || '',
          province: addressProvince || '',
        },
        phone,
        contactEmail: contactEmail.toLowerCase(),
        website: website || '',
        fax: fax || '',
        legalRep: {
          name: legalRepName,
          position: legalRepPosition,
          phone: legalRepPhone,
          email: legalRepEmail,
        },
        itContact: {
          name: itName,
          phone: itPhone,
          email: itEmail,
        },
        status: 'submitted',
      },
      { new: true }
    ).lean();

    res.status(200).json({ success: true, hospital: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/v1/hospital/onboarding/license — upload GPKD
export const uploadLicenseFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn file GPKD (PDF hoặc ảnh)." });
    }

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Tài khoản không gắn với bệnh viện nào." });
    }

    let fileUrl;
    try {
      fileUrl = await uploadToGCS(req.file.buffer, req.file.originalname, req.file.mimetype, "licenses");
    } catch {
      // Fallback: save locally
      const uploadsDir = path.resolve(__dirname, "../../uploads/licenses");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const filename = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      fileUrl = `/uploads/licenses/${filename}`;
    }

    await Hospital.findByIdAndUpdate(hospitalId, { licenseFile: fileUrl });
    res.status(200).json({ success: true, licenseFile: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
