import mongoose from "mongoose";
import { Visit } from "../models/visit.model.js";
import { PatientProfile } from "../models/patientProfile.model.js";
import { uploadToGCS, deleteFromGCS } from "../config/gcs.js";

// ── Patient Identity ──────────────────────────────────────────────────────────

export const getOrCreateProfile = async (userId) => {
  let profile = await PatientProfile.findOne({ userId });
  if (!profile) {
    profile = await PatientProfile.create({ userId });
  }
  return profile;
};

export const updateProfile = async (userId, data) => {
  const allowed = ["dateOfBirth", "gender", "phone", "address"];
  const update = {};
  allowed.forEach((key) => {
    if (data[key] !== undefined) update[key] = data[key];
  });

  const profile = await PatientProfile.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true }
  );
  return profile;
};

// ── Visits ────────────────────────────────────────────────────────────────────

export const listVisits = async (userId) => {
  // 1. Fetch user to get their medicalId
  const { User } = await import("../models/user.model.js");
  const user = await User.findById(userId).lean();
  const medicalId = user?.profile?.medicalId;

  // 2. Fetch all visits related to this patient (both manual and system)
  const visits = await Visit.find({
    $or: [
      { userId: userId },
      { patientId: userId }
    ]
  })
  .populate("hospitalId", "name")
  .populate("doctorId", "profile.name")
  .sort({ createdAt: -1 })
  .lean();

  // 3. Fetch related clinical entities to dynamically assign them to system visits
  const [prescriptions, dischargePapers, transferForms, labOrders, EMRRecords] = await Promise.all([
    mongoose.model("Prescription").find({ patient_id: userId }).lean(),
    mongoose.model("DischargePaper").find({ patient_id: userId }).lean(),
    mongoose.model("TransferForm").find({ patient_id: userId }).lean(),
    mongoose.model("LabOrder").find({ patient_id: userId }).lean(),
    medicalId ? mongoose.model("MedicalRecord").find({ patientId: medicalId }).lean() : []
  ]);

  const compiledVisits = await Promise.all(visits.map(async (visit) => {
    // If it's a manual visit, it already has documents array in DB
    if (visit.userId && !visit.patientId) {
      return {
        ...visit,
        date: visit.date || visit.createdAt,
        facility: visit.facility || "Cơ sở y tế",
        visitType: visit.visitType || "ngoai_tru"
      };
    }

    // It's a system visit (created by receptionist/hospital)
    const docList = [];

    // Check Vitals
    if (visit.vitals && (visit.vitals.pulse || visit.vitals.bloodPressure || visit.vitals.temperature || visit.vitals.spo2)) {
      docList.push({
        _id: "vital-" + visit._id,
        docKey: "mau_kham_benh",
        groupKey: "nhom1",
        label: "Phiếu thông tin khám bệnh",
        storageType: "manual",
        manualData: {
          mach: visit.vitals.pulse ? String(visit.vitals.pulse) : "",
          huyetAp: visit.vitals.bloodPressure || "",
          nhietDo: visit.vitals.temperature ? String(visit.vitals.temperature) : "",
          nhipTho: visit.vitals.respiratoryRate ? String(visit.vitals.respiratoryRate) : "",
          spo2: visit.vitals.spo2 ? String(visit.vitals.spo2) : ""
        },
        uploadedAt: visit.vitals.measuredAt || visit.updatedAt || visit.createdAt
      });
    }

    // Check Invoice
    if (visit.invoiceId) {
      try {
        const invoice = await mongoose.model("Invoice").findById(visit.invoiceId).lean();
        if (invoice) {
          docList.push({
            _id: invoice._id,
            docKey: "phieu_thu_vien_phi",
            groupKey: "nhom1",
            label: "Phiếu thu viện phí",
            storageType: "manual",
            manualData: {
              invoiceNumber: invoice.invoiceNumber || `HD-${invoice._id.toString().substring(18)}`,
              totalAmount: invoice.totalAmount || invoice.amount,
              status: invoice.status === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
              paymentMethod: invoice.paymentMethod || "Tiền mặt"
            },
            uploadedAt: invoice.paidAt || invoice.createdAt
          });
        }
      } catch (err) {
        console.error("Lỗi tải hóa đơn cho patient visit list:", err);
      }
    }

    // Check MRI Order / PACS
    if (visit.mriOrder && visit.mriOrder.region) {
      docList.push({
        _id: "order-" + visit._id,
        docKey: "phieu_chi_dinh",
        groupKey: "nhom2",
        label: "Phiếu chỉ định dịch vụ",
        storageType: "manual",
        manualData: {
          serviceName: `Chụp MRI ${visit.mriOrder.region}`,
          instructions: visit.mriOrder.instructions || "Không có",
          requestAi: visit.mriOrder.requestAiAnalysis ? "Có" : "Không"
        },
        uploadedAt: visit.mriOrder.orderedAt || visit.createdAt
      });

      if (visit.mriOrder.imagingResultId) {
        try {
          const imagingResult = await mongoose.model("ImagingResult").findById(visit.mriOrder.imagingResultId).lean();
          if (imagingResult) {
            docList.push({
              _id: imagingResult._id,
              docKey: "mri",
              groupKey: "nhom3",
              label: `Kết quả MRI ${imagingResult.imagingType || "Não"}`,
              storageType: "manual",
              manualData: {
                procedure: imagingResult.procedure,
                technique: imagingResult.technique,
                findings: imagingResult.findings,
                conclusion: imagingResult.conclusion,
                radiologist: imagingResult.radiologist,
                images: imagingResult.images
              },
              uploadedAt: imagingResult.reportDate
            });
          }
        } catch (err) {
          console.error("Lỗi tải kết quả MRI cho patient visit list:", err);
        }
      }
    }

    // Helper: check if two dates are close (within 24 hours)
    const isCloseDate = (d1, d2) => {
      if (!d1 || !d2) return false;
      const diffMs = Math.abs(new Date(d1).getTime() - new Date(d2).getTime());
      return diffMs <= 24 * 60 * 60 * 1000;
    };

    // Find Prescriptions created on the same day
    const matchingPrescriptions = prescriptions.filter(p => isCloseDate(p.createdAt, visit.createdAt));
    matchingPrescriptions.forEach(p => {
      docList.push({
        _id: p._id,
        docKey: "toa_thuoc",
        groupKey: "nhom2",
        label: "Toa thuốc",
        storageType: "manual",
        manualData: {
          diagnosis: p.diagnosis,
          doctorName: p.doctor_name,
          drugs: p.drugs.map(d => `${d.name} (${d.quantity} ${d.unit}) - ${d.usage}`).join('\n'),
          note: p.note
        },
        uploadedAt: p.recorded_at || p.createdAt
      });
    });

    // Find Discharge Papers created on the same day
    const matchingDischarges = dischargePapers.filter(d => isCloseDate(d.createdAt, visit.createdAt));
    matchingDischarges.forEach(d => {
      docList.push({
        _id: d._id,
        docKey: "giay_ra_vien",
        groupKey: "nhom2",
        label: "Giấy ra viện",
        storageType: "manual",
        manualData: {
          dischargeNo: d.dischargeNo,
          hospitalNo: d.hospitalNo,
          dateIn: d.dateIn ? new Date(d.dateIn).toLocaleDateString('vi-VN') : "",
          dateOut: d.dateOut ? new Date(d.dateOut).toLocaleDateString('vi-VN') : "",
          diagnosis: d.diagnosis,
          treatment: d.treatment,
          note: d.note
        },
        uploadedAt: d.recorded_at || d.createdAt
      });
    });

    // Find Transfer Forms created on the same day
    const matchingTransfers = transferForms.filter(t => isCloseDate(t.createdAt, visit.createdAt));
    matchingTransfers.forEach(t => {
      docList.push({
        _id: t._id,
        docKey: "chuyen_tuyen",
        groupKey: "nhom2",
        label: "Phiếu chuyển tuyến TT01",
        storageType: "manual",
        manualData: {
          transferNo: t.transferNo,
          transferTo: t.transferTo,
          diagnosis: t.diagnosis,
          treatment: t.treatment,
          patientStatus: t.patientStatus
        },
        uploadedAt: t.recorded_at || t.createdAt
      });
    });

    // Find Lab Orders created on the same day
    const matchingLabOrders = labOrders.filter(l => isCloseDate(l.ordered_at, visit.createdAt));
    matchingLabOrders.forEach(l => {
      docList.push({
        _id: l._id,
        docKey: l.category === "HUYET_HOC" ? "xet_nghiem_mau" : "hoa_sinh",
        groupKey: "nhom3",
        label: l.category === "HUYET_HOC" ? "Kết quả XN huyết học" : "Kết quả hóa sinh máu",
        storageType: "manual",
        manualData: {
          barcode: l.barcode,
          category: l.category,
          status: l.status === "COMPLETED" ? "Đã có kết quả" : "Chờ kết quả",
          results: l.results.map(r => `${r.biomarker_name} (${r.biomarker_code}): ${r.value_result} ${r.unit} [KTC: ${r.reference_range_display}] ${r.is_abnormal ? '(Bất thường)' : ''}`).join('\n')
        },
        uploadedAt: l.resulted_at || l.ordered_at
      });
    });

    // Find EMR Medical Records created on the same day
    const matchingEMR = EMRRecords.filter(e => isCloseDate(e.createdAt, visit.createdAt));
    for (const emr of matchingEMR) {
      docList.push({
        _id: emr._id,
        docKey: "tom_tat_hsba",
        groupKey: "nhom1",
        label: "Tóm tắt hồ sơ bệnh án",
        storageType: "manual",
        manualData: {
          diagnosis: emr.diagnosis,
          treatmentPlan: emr.treatmentPlan,
          status: emr.status,
          doctorInCharge: emr.doctorInCharge,
          signStatus: emr.signStatus
        },
        uploadedAt: emr.createdAt
      });

      // Find Consents linked to this MedicalRecord
      try {
        const consents = await mongoose.model("ConsentForm").find({ medicalRecordId: emr._id }).lean();
        consents.forEach(c => {
          docList.push({
            _id: c._id,
            docKey: "cam_ket_phau_thuat",
            groupKey: "nhom5",
            label: "Cam kết chấp thuận phẫu thuật",
            storageType: "manual",
            manualData: {
              procedureName: c.procedureName,
              risks: c.risks,
              doctorExplanation: c.doctorExplanation,
              doctorSigned: c.doctorSigned ? `Đã ký (${c.doctorSignature})` : "Chưa ký",
              patientSigned: c.patientSigned ? `Đã ký (${c.patientSignature})` : "Chưa ký"
            },
            uploadedAt: c.createdAt
          });
        });
      } catch (err) {
        console.error("Lỗi tải giấy cam đoan cho patient visit list:", err);
      }
    }

    return {
      ...visit,
      date: visit.createdAt,
      facility: visit.hospitalId?.name || "Bệnh viện đa khoa NeuroScan",
      visitType: "ngoai_tru",
      diagnosis: visit.reason || "Khám thần kinh",
      medicalId: medicalId || "Chưa có",
      doctor: visit.doctorId?.profile?.name || "Bác sĩ phụ trách",
      documents: docList
    };
  }));

  return compiledVisits;
};

export const createVisit = async (userId, data) => {
  const { date, facility, visitType, diagnosis, medicalId, doctor } = data;
  const visit = await Visit.create({
    userId,
    date: date ? new Date(date) : new Date(),
    facility,
    visitType,
    diagnosis: diagnosis || "",
    medicalId: medicalId || "",
    doctor: doctor || "",
    documents: [],
  });
  return visit;
};

export const getVisit = async (userId, visitId) => {
  const visit = await Visit.findOne({ _id: visitId, $or: [{ userId }, { patientId: userId }] }).lean();
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });
  return visit;
};

export const updateVisit = async (userId, visitId, data) => {
  const allowed = ["date", "facility", "visitType", "diagnosis", "medicalId", "doctor"];
  const update = {};
  allowed.forEach((key) => {
    if (data[key] !== undefined) {
      update[key] = key === "date" ? new Date(data[key]) : data[key];
    }
  });

  const visit = await Visit.findOneAndUpdate(
    { _id: visitId, $or: [{ userId }, { patientId: userId }] },
    { $set: update },
    { new: true }
  );
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });
  return visit;
};

export const deleteVisit = async (userId, visitId) => {
  const visit = await Visit.findOne({ _id: visitId, $or: [{ userId }, { patientId: userId }] });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  // Delete all uploaded files from GCS
  for (const doc of visit.documents) {
    if (doc.fileUrl) await deleteFromGCS(doc.fileUrl);
  }

  await visit.deleteOne();
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const addDocumentUpload = async (userId, visitId, { docKey, groupKey, label, fileBuffer, originalName, mimeType }) => {
  const visit = await Visit.findOne({ _id: visitId, $or: [{ userId }, { patientId: userId }] });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  const fileUrl = await uploadToGCS(fileBuffer, originalName, mimeType, `patient-records/${userId}`);

  visit.documents.push({
    docKey,
    groupKey,
    label,
    storageType: "upload",
    fileUrl,
    fileName: originalName,
    fileType: mimeType,
    uploadedAt: new Date(),
  });

  await visit.save();
  return visit;
};

export const addDocumentManual = async (userId, visitId, { docKey, groupKey, label, manualData }) => {
  const visit = await Visit.findOne({ _id: visitId, $or: [{ userId }, { patientId: userId }] });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  const existing = visit.documents.find((d) => d.docKey === docKey);
  if (existing) {
    existing.manualData = manualData;
    existing.storageType = "manual";
    existing.uploadedAt = new Date();
  } else {
    visit.documents.push({
      docKey,
      groupKey,
      label,
      storageType: "manual",
      manualData,
      uploadedAt: new Date(),
    });
  }

  // Đồng bộ sinh hiệu sang VitalSign nếu tài liệu là phiếu khám bệnh
  if (docKey === "mau_kham_benh") {
    try {
      const pulse = Number(manualData.mach);
      const bpStr = manualData.huyetAp || "";
      const bpParts = bpStr.split("/");
      const systolic = bpParts[0] ? Number(bpParts[0].trim()) : null;
      const diastolic = bpParts[1] ? Number(bpParts[1].trim()) : null;
      const spo2 = Number(manualData.spo2);
      const weight = manualData.canNang ? Number(manualData.canNang) : null;
      const height = manualData.chieuCao ? Number(manualData.chieuCao) : null;

      if (!isNaN(pulse) && pulse > 0 && !isNaN(systolic) && systolic > 0 && !isNaN(diastolic) && diastolic > 0 && !isNaN(spo2) && spo2 > 0) {
        let bmi = null;
        if (weight && height && !isNaN(weight) && !isNaN(height)) {
          bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
        }

        const { VitalSign } = await import("../models/vitalSign.model.js");
        const newVital = new VitalSign({
          patient_id: userId,
          pulse,
          blood_pressure: { systolic, diastolic },
          spo2,
          weight: weight || undefined,
          height: height || undefined,
          bmi: bmi || undefined,
          recorded_at: new Date(),
        });
        await newVital.save();
        console.log("Automatically synced VitalSign from mau_kham_benh Patient document.");
      }
    } catch (e) {
      console.warn("Lỗi đồng bộ sinh hiệu từ mau_kham_benh:", e);
    }
  }

  await visit.save();
  return visit;
};

export const deleteDocument = async (userId, visitId, docId) => {
  const visit = await Visit.findOne({ _id: visitId, $or: [{ userId }, { patientId: userId }] });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  const doc = visit.documents.id(docId);
  if (!doc) throw Object.assign(new Error("Không tìm thấy tài liệu."), { status: 404 });

  if (doc.fileUrl) await deleteFromGCS(doc.fileUrl);
  visit.documents.pull({ _id: docId });

  await visit.save();
  return visit;
};
