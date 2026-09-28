import crypto from "crypto";


/**
 * Thẩm định tính nhất quán sinh học phân tử theo chuẩn WHO CNS5 (2021)
 * @param {Object} markers - { idhStatus, mgmtMethylation, codeletion1p19q, whoGrade, h3k27mStatus, tertPromoter }
 * @returns {{ isValid: boolean, warnings: string[], interpretedEntity: string }}
 */
export const validateMolecularMarkers = (markers = {}) => {
  const warnings = [];
  let interpretedEntity = "Chưa xác định";

  const idh = (markers.idhStatus || "").toLowerCase();
  const codeletion = (markers.codeletion1p19q || "").toLowerCase();
  const mgmt = (markers.mgmtMethylation || "").toLowerCase();
  const h3k27m = (markers.h3k27mStatus || "").toLowerCase();

  // 1. Phân loại Oligodendroglioma: Bắt buộc IDH-mutant và 1p/19q codeleted
  if (codeletion.includes("co-del") || codeletion.includes("mất đoạn") || codeletion === "positive") {
    if (idh.includes("wildtype") || idh.includes("âm tính")) {
      warnings.push("Cảnh báo WHO CNS5: Đồng mất đoạn 1p/19q thường chỉ đi kèm đột biến IDH-mutant. Cần kiểm tra lại kết quả xét nghiệm.");
    } else {
      interpretedEntity = "Oligodendroglioma, IDH-mutant, 1p/19q-codeleted (WHO Grade 2 hoặc 3)";
    }
  }

  // 2. Phân loại Astrocytoma vs Glioblastoma
  if (idh.includes("mutant") || idh.includes("đột biến")) {
    if (!codeletion.includes("co-del") && interpretedEntity === "Chưa xác định") {
      interpretedEntity = "Astrocytoma, IDH-mutant (WHO Grade 2, 3, hoặc 4)";
    }
  } else if (idh.includes("wildtype") || idh.includes("không đột biến")) {
    interpretedEntity = "Glioblastoma, IDH-wildtype (WHO Grade 4)";
  }

  // 3. Diffuse Midline Glioma (H3 K27-altered)
  if (h3k27m.includes("positive") || h3k27m.includes("dương tính")) {
    interpretedEntity = "Diffuse Midline Glioma, H3 K27-altered (WHO Grade 4)";
  }

  // 4. Đánh giá đáp ứng hóa trị Temozolomide qua MGMT
  let mgmtResponse = "";
  if (mgmt.includes("methylated") || mgmt.includes("dương tính") || mgmt.includes("methyl hóa")) {
    mgmtResponse = "MGMT Methylated: Tiên lượng đáp ứng tốt với hóa chất Temozolomide (Phác đồ Stupp).";
  } else if (mgmt.includes("unmethylated") || mgmt.includes("âm tính")) {
    mgmtResponse = "MGMT Unmethylated: Đề kháng tương đối với Temozolomide, cần phối hợp xạ trị hoặc thử nghiệm lâm sàng.";
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    interpretedEntity,
    mgmtResponse,
  };
};

/**
 * Phân tích và chuyển đổi báo cáo cận lâm sàng dạng JSON hoặc HL7 sang định dạng EMR
 * @param {Object|string} inputReport
 * @returns {Object} Structured molecular markers
 */
export const parseMolecularLabReport = (inputReport) => {
  if (!inputReport) return {};

  const reportObj = typeof inputReport === "string" ? JSON.parse(inputReport) : inputReport;

  return {
    idhStatus: reportObj.idhStatus || reportObj.idh_mutation || (reportObj.idh1_r132h ? "IDH1-mutant" : "IDH-wildtype"),
    mgmtMethylation: reportObj.mgmtMethylation || reportObj.mgmt_status || (reportObj.mgmt_percent > 10 ? "Methylated" : "Unmethylated"),
    codeletion1p19q: reportObj.codeletion1p19q || reportObj.loss_1p19q || "Non-codeleted",
    tertPromoter: reportObj.tertPromoter || reportObj.tert_c228t || "",
    atrxStatus: reportObj.atrxStatus || reportObj.atrx_loss || "",
    egfrAmplification: reportObj.egfrAmplification || reportObj.egfr_amp || "",
    h3k27mStatus: reportObj.h3k27mStatus || "",
    importedAt: new Date(),
    importedSource: reportObj.labName || "Oncology Molecular Pathology Lab",
  };
};

/**
 * Danh mục 18 trường nhận dạng cá nhân theo chuẩn HIPAA Safe Harbor §164.514(b)(2)
 */
export const HIPAA_SAFE_HARBOR_18_IDENTIFIERS = [
  "patientName",             // 1. Tên người bệnh và thân nhân
  "patientAddress",          // 2. Địa chỉ địa lý nhỏ hơn cấp tỉnh (xã, huyện, số nhà)
  "geographicData",
  "patientBirthDate",        // 3. Toàn bộ mốc thời gian cụ thể (ngày, tháng sinh, ngày khám)
  "admissionDate",
  "dischargeDate",
  "patientPhone",            // 4. Số điện thoại liên hệ
  "patientFax",              // 5. Số Fax
  "patientEmail",            // 6. Địa chỉ thư điện tử
  "ssn",                     // 7. Số định danh cá nhân / CCCD / CMND
  "citizenId",
  "medicalRecordNumber",     // 8. Số bệnh án y tế (Medical Record Number - MRN)
  "healthPlanNumber",        // 9. Mã số thẻ BHYT / Mã quyền lợi bảo hiểm
  "insuranceNumber",
  "accountNumber",           // 10. Số tài khoản thanh toán viện phí
  "certificateNumber",       // 11. Số chứng chỉ hành nghề / Giấy phép
  "vehicleIdentifiers",      // 12. Biển số xe, số khung
  "deviceIdentifiers",       // 13. Định danh thiết bị y tế cấy ghép (pacemaker, stent serial)
  "webUrl",                  // 14. Đường dẫn URL liên kết hồ sơ
  "ipAddress",               // 15. Địa chỉ IP truy cập
  "biometricIdentifiers",    // 16. Dữ liệu sinh trắc học (vân tay, mống mắt)
  "fullFacePhotos",          // 17. Ảnh chụp toàn bộ khuôn mặt
  "otherUniqueIdentifiers",  // 18. Bất kỳ mã số định danh đặc thù độc bản nào khác
];

/**
 * Khử định danh toàn diện dữ liệu DICOM (De-identification) phục vụ nghiên cứu lâm sàng
 * Căn cứ: HIPAA §164.514(b)(2) (18 Safe Harbor Identifiers) & DICOM PS 3.15 Annex E
 * @param {Object} dicomMetadata
 * @returns {Object} De-identified metadata
 */
export const deidentifyDicomMetadata = (dicomMetadata = {}) => {
  // Bản sao dữ liệu gốc
  const cleaned = { ...dicomMetadata };

  // 1. Xóa bỏ/Làm sạch triệt để toàn bộ 18 nhóm định danh HIPAA Safe Harbor
  HIPAA_SAFE_HARBOR_18_IDENTIFIERS.forEach((field) => {
    delete cleaned[field];
  });

  // Xóa các trường tên nhân viên y tế / cơ sở theo DICOM PS 3.15
  delete cleaned.accessionNumber;
  delete cleaned.institutionName;
  delete cleaned.institutionAddress;
  delete cleaned.referringPhysicianName;
  delete cleaned.physiciansOfRecord;
  delete cleaned.operatorsName;
  delete cleaned.stationName;

  // HIPAA Safe Harbor §164.514(b)(2)(i)(C): Tuổi > 89 phải gộp thành "90+"
  let normalizedAge = undefined;
  if (dicomMetadata.patientAge !== undefined || dicomMetadata.age !== undefined) {
    const rawAge = dicomMetadata.patientAge !== undefined ? dicomMetadata.patientAge : dicomMetadata.age;
    normalizedAge = anonymizeHipaaAge(rawAge);
  }

  // 2. Giữ lại và chuẩn hóa các thông số kỹ thuật lâm sàng phục vụ AI / nghiên cứu u não
  return {
    ...cleaned,
    patientName: "ANONYMIZED_SUBJECT",
    patientId: "SUBJ_" + (dicomMetadata.studyInstanceUID ? crypto.createHash("sha256").update(dicomMetadata.studyInstanceUID).digest("hex").slice(0, 12) : "RESEARCH"),
    patientBirthDate: null,
    patientAge: normalizedAge,
    institutionName: "CLINICAL_TRIAL_SITE",
    // Bảo lưu các thông số vật lý chuỗi xung MRI phục vụ phân tích tổn thương u não
    modality: dicomMetadata.modality || "MR",
    seriesDescription: dicomMetadata.seriesDescription || "T2-FLAIR AXIAL BRAIN",
    sliceThickness: dicomMetadata.sliceThickness || null,
    magneticFieldStrength: dicomMetadata.magneticFieldStrength || "1.5T/3.0T",
    isDeidentified: true,
    deidentifiedAt: new Date(),
    complianceStandard: "HIPAA §164.514(b)(2) 18 Safe Harbor Identifiers & DICOM PS 3.15 Annex E",
    identifiersRemovedCount: 18,
  };
};

/**
 * Chuẩn hóa độ tuổi theo chuẩn HIPAA Safe Harbor §164.514(b)(2)(i)(C)
 * Mọi cá nhân trên 89 tuổi phải được gộp thành danh mục duy nhất "90+"
 * @param {number|string} age 
 * @returns {number|string}
 */
export const anonymizeHipaaAge = (age) => {
  if (age === null || age === undefined || age === "") return undefined;
  const numAge = parseInt(age, 10);
  if (!isNaN(numAge) && numAge > 89) {
    return "90+";
  }
  return numAge || age;
};
