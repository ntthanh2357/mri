import { Hospital } from "../models/hospital.model.js";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
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
      name, nameShort, taxCode, loginEmail,
      addressStreet, addressWard, addressDistrict, addressProvince,
      phone, contactEmail, website, fax,
      legalRepName, legalRepPosition, legalRepPhone, legalRepEmail,
      itName, itPhone, itEmail,
    } = req.body;

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Tài khoản không gắn với bệnh viện nào." });
    }

    // Load hospital record to check for license file upload
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bệnh viện." });
    }
    if (!hospital.licenseFile) {
      return res.status(400).json({ success: false, message: "Vui lòng tải lên Giấy phép hoạt động (ảnh hoặc file PDF) trước khi gửi thông tin." });
    }

    // Validate required fields
    const missing = [];
    if (!name) missing.push("Tên bệnh viện (đầy đủ)");
    if (!loginEmail) missing.push("Email đăng nhập chính thức");
    if (!phone) missing.push("Số điện thoại liên hệ");
    if (!contactEmail) missing.push("Email liên hệ");
    if (!addressStreet || !addressWard || !addressDistrict || !addressProvince) missing.push("Địa chỉ trụ sở");
    if (!legalRepName || !legalRepPosition || !legalRepPhone || !legalRepEmail) missing.push("Thông tin người đại diện");
    if (!itName || !itPhone || !itEmail) missing.push("Thông tin IT phụ trách");

    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Thiếu các trường bắt buộc: ${missing.join(", ")}` });
    }

    // 1. Accents validation for hospital name
    const hasVietnameseTones = (str) => {
      return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(str);
    };
    if (!hasVietnameseTones(name)) {
      return res.status(400).json({ success: false, message: "Tên bệnh viện bắt buộc phải viết bằng tiếng Việt có dấu." });
    }

    // 2. Tax code validation
    if (!taxCode) {
      return res.status(400).json({ success: false, message: "Thiếu Mã số thuế." });
    } else if (!/^\d+$/.test(taxCode.toString().trim())) {
      return res.status(400).json({ success: false, message: "Mã số thuế phải là định dạng số." });
    } else {
      const taxConflict = await Hospital.findOne({ taxCode: taxCode.toString().trim(), _id: { $ne: hospitalId } });
      if (taxConflict) {
        return res.status(409).json({ success: false, message: "Mã số thuế này đã được đăng ký bởi bệnh viện khác." });
      }
    }

    // 3. Email validations
    const validateEmail = (email) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };
    if (!validateEmail(loginEmail)) {
      return res.status(400).json({ success: false, message: "Email đăng nhập chính thức không đúng định dạng." });
    }
    if (!validateEmail(contactEmail)) {
      return res.status(400).json({ success: false, message: "Email liên hệ không đúng định dạng." });
    }
    if (!validateEmail(legalRepEmail)) {
      return res.status(400).json({ success: false, message: "Email người đại diện không đúng định dạng." });
    }
    if (!validateEmail(itEmail)) {
      return res.status(400).json({ success: false, message: "Email IT không đúng định dạng." });
    }

    // Check overlaps
    if (loginEmail.toLowerCase() === contactEmail.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Email đăng nhập chính thức không được trùng với Email liên hệ chung." });
    }
    if (loginEmail.toLowerCase() === itEmail.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Email đăng nhập chính thức không được trùng với Email IT phụ trách." });
    }

    // Check loginEmail uniqueness across all users (excluding current temp user)
    const emailConflict = await User.findOne({ email: loginEmail.toLowerCase(), _id: { $ne: req.user.id } });
    if (emailConflict) {
      return res.status(409).json({ success: false, message: "Email đăng nhập đã được sử dụng bởi tài khoản khác." });
    }

    // 4. Vietnamese phone validation
    const validateVNPhone = (p) => {
      if (!p) return false;
      const cleaned = p.toString().replace(/[\s.-]/g, '');
      return /^(0|\+84)(3|5|7|8|9|2)\d{8,9}$/.test(cleaned);
    };
    if (!validateVNPhone(phone)) {
      return res.status(400).json({ success: false, message: "Số điện thoại liên hệ không hợp lệ (định dạng Việt Nam)." });
    }
    if (!validateVNPhone(legalRepPhone)) {
      return res.status(400).json({ success: false, message: "Số điện thoại người đại diện không hợp lệ (định dạng Việt Nam)." });
    }
    if (!validateVNPhone(itPhone)) {
      return res.status(400).json({ success: false, message: "Số điện thoại IT không hợp lệ (định dạng Việt Nam)." });
    }

    // 5. Website validation (optional)
    const validateURL = (url) => {
      if (!url) return true;
      try {
        const checkUrl = url.includes('://') ? url : 'http://' + url;
        const parsed = new URL(checkUrl);
        return parsed.hostname.includes('.');
      } catch {
        return false;
      }
    };
    if (website && !validateURL(website)) {
      return res.status(400).json({ success: false, message: "Website không đúng định dạng URL." });
    }

    const updated = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        name: name.trim(),
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

    // Log the change
    await AuditLog.create({
      action: "update-hospital-info",
      entity: "Hospital",
      entityId: hospitalId,
      performedBy: req.user.id,
      hospitalId: hospitalId,
      details: `Bệnh viện ${name} cập nhật thông tin chi tiết.`,
    });

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

// GET /api/v1/hospital/staff — Lấy danh sách nhân viên của bệnh viện hiện tại
export const getHospitalStaff = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Tài khoản không gắn với bệnh viện nào." });
    }

    const staff = await User.find({ hospitalId, role: { $ne: "patient" } })
      .select("email role profile.name isActive isLocked isVerified createdAt phone")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/v1/hospital/staff/:id/toggle-lock — Khóa/mở khóa tài khoản nhân viên của bệnh viện
export const toggleStaffLock = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Tài khoản không gắn với bệnh viện nào." });
    }

    const staffMember = await User.findOne({ _id: id, hospitalId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên thuộc bệnh viện này." });
    }

    if (staffMember.role === "hospital_admin") {
      return res.status(400).json({ success: false, message: "Không thể khóa tài khoản quản trị bệnh viện." });
    }

    staffMember.isLocked = !staffMember.isLocked;
    await staffMember.save();

    // Log the change
    await AuditLog.create({
      action: "toggle-staff-lock",
      entity: "User",
      entityId: staffMember._id,
      performedBy: req.user.id,
      hospitalId: hospitalId,
      details: `Hospital Admin ${req.user.email} đã ${staffMember.isLocked ? "KHÓA" : "MỞ KHÓA"} tài khoản nhân sự ${staffMember.email}`,
    });

    res.status(200).json({ success: true, message: `Đã ${staffMember.isLocked ? "khóa" : "mở khóa"} tài khoản thành công.`, staffMember });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
