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
  const allowed = ["cccd", "dateOfBirth", "gender", "phone", "address"];
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
  return Visit.find({ userId }).sort({ date: -1 }).lean();
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
  const visit = await Visit.findOne({ _id: visitId, userId }).lean();
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
    { _id: visitId, userId },
    { $set: update },
    { new: true }
  );
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });
  return visit;
};

export const deleteVisit = async (userId, visitId) => {
  const visit = await Visit.findOne({ _id: visitId, userId });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  // Delete all uploaded files from GCS
  for (const doc of visit.documents) {
    if (doc.fileUrl) await deleteFromGCS(doc.fileUrl);
  }

  await visit.deleteOne();
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const addDocumentUpload = async (userId, visitId, { docKey, groupKey, label, fileBuffer, originalName, mimeType }) => {
  const visit = await Visit.findOne({ _id: visitId, userId });
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
  const visit = await Visit.findOne({ _id: visitId, userId });
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

  await visit.save();
  return visit;
};

export const deleteDocument = async (userId, visitId, docId) => {
  const visit = await Visit.findOne({ _id: visitId, userId });
  if (!visit) throw Object.assign(new Error("Không tìm thấy lượt khám."), { status: 404 });

  const doc = visit.documents.id(docId);
  if (!doc) throw Object.assign(new Error("Không tìm thấy tài liệu."), { status: 404 });

  if (doc.fileUrl) await deleteFromGCS(doc.fileUrl);
  visit.documents.pull({ _id: docId });

  await visit.save();
  return visit;
};
