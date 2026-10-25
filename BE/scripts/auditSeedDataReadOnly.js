import "dotenv/config";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import mongoose from "mongoose";
import { connectLocalTestMongo } from "../src/utils/seedGuard.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const MAX_RECORDS = 5000;
const seedSourceFiles = [
  "src/seed.js",
  "src/seedAll.js",
  "seed_mock_data.js",
];
const fixtureAccounts = [
  {
    email: "admin@neuroscan.com",
    role: "admin",
    names: [
      "Huy Hoàng Admin",
      "KS. Huy Hoàng (Quản trị Hệ thống HIS/PACS)",
    ],
    medicalIds: [],
    sources: ["seed.js", "seedAll.js"],
  },
  {
    email: "doctor@neuroscan.com",
    role: "doctor",
    names: [
      "Bác sĩ Gia Huy",
      "TS.BS.CKII Nguyễn Gia Huy (Bác sĩ Khám Lâm Sàng & Đọc Phim CĐHA)",
    ],
    medicalIds: ["BS-001"],
    sources: ["seed.js", "seedAll.js"],
  },
  {
    email: "patient@neuroscan.com",
    role: "patient",
    names: [
      "Bệnh nhân Tuấn Thành",
      "Bệnh nhân Tuấn Thành (U Màng Não)",
    ],
    medicalIds: ["26025699", "BN001"],
    sources: ["seed.js", "seedAll.js"],
  },
  {
    email: "patient2@neuroscan.com",
    role: "patient",
    names: ["Bệnh nhân Minh Hằng (Glioblastoma Phù Não)"],
    medicalIds: ["BN002"],
    sources: ["seedAll.js"],
  },
  {
    email: "patient3@neuroscan.com",
    role: "patient",
    names: ["Bệnh nhân Quốc Bảo (U Tuyến Yên)"],
    medicalIds: ["BN003"],
    sources: ["seedAll.js"],
  },
  {
    email: "benhnhan1@gmail.com",
    role: "patient",
    names: ["Bệnh nhân Nguyễn Văn Một"],
    medicalIds: ["BN001"],
    sources: ["seed_mock_data.js"],
  },
  {
    email: "benhnhan2@gmail.com",
    role: "patient",
    names: ["Bệnh nhân Trần Thị Hai"],
    medicalIds: ["BN002"],
    sources: ["seed_mock_data.js"],
  },
  {
    email: "benhnhan3@gmail.com",
    role: "patient",
    names: ["Bệnh nhân Lê Văn Ba"],
    medicalIds: ["BN003"],
    sources: ["seed_mock_data.js"],
  },
];

const collectionNames = {
  users: "users",
  profiles: "patientprofiles",
  legacyPatientRecords: "patientrecords",
  visits: "visits",
  imagingResults: "imagingresults",
  dicomStudies: "dicomstudies",
  dicomSeries: "dicomseries",
  aiJobs: "aijobs",
  storedMedicalFiles: "storedmedicalfiles",
  auditLogs: "auditlogs",
};

const relevantCollections = [
  "users",
  "patientprofiles",
  "patientrecords",
  "visits",
  "imagingresults",
  "dicomstudies",
  "dicomseries",
  "aijobs",
  "storedmedicalfiles",
  "auditlogs",
];

const migrationCollectionNames = [
  "migrations",
  "migration",
  "schema_migrations",
  "__migrations",
];

const shaId = (id) =>
  crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 12);

const hasCollection = (names, name) => names.has(name);

const referenceExists = async (db, targetCollection, targetField, reference) => {
  const query = targetField
    ? { [targetField]: reference }
    : { _id: reference };
  if (await db.collection(targetCollection).countDocuments(query, { limit: 1 })) {
    return true;
  }
  if (
    !targetField &&
    typeof reference === "string" &&
    /^[\da-f]{24}$/i.test(reference)
  ) {
    return Boolean(await db.collection(targetCollection).countDocuments({
      _id: new mongoose.Types.ObjectId(reference),
    }, { limit: 1 }));
  }
  return false;
};

const readSeedEmails = async () => {
  const emails = new Set();
  for (const relativePath of seedSourceFiles) {
    const source = await fs.readFile(path.join(backendDir, relativePath), "utf8");
    for (const match of source.matchAll(/email\s*:\s*["']([^"']+)["']/g)) {
      emails.add(match[1].toLowerCase());
    }
  }
  return [...emails];
};

const count = async (db, names, collectionName, filter = {}) => {
  if (!hasCollection(names, collectionName)) return null;
  return db.collection(collectionName).countDocuments(filter);
};

const readIndexes = async (db, names, collectionName) => {
  if (!hasCollection(names, collectionName)) return null;
  const indexes = await db.collection(collectionName).listIndexes().toArray();
  return indexes.map(({ name, key, unique, sparse, expireAfterSeconds }) => ({
    name,
    key,
    ...(unique ? { unique: true } : {}),
    ...(sparse ? { sparse: true } : {}),
    ...(expireAfterSeconds !== undefined ? { expireAfterSeconds } : {}),
  }));
};

const findFixtureAccounts = async (db, names, sourceEmails) => {
  if (!hasCollection(names, collectionNames.users)) return [];
  const fixturesByEmail = new Map(fixtureAccounts.map((fixture) => [fixture.email, fixture]));
  const users = await db
    .collection(collectionNames.users)
    .find({ email: { $in: sourceEmails } })
    .project({
      _id: 1,
      role: 1,
      email: 1,
      createdAt: 1,
      "profile.name": 1,
      "profile.fullName": 1,
      "profile.medicalId": 1,
    })
    .limit(MAX_RECORDS)
    .toArray();

  const results = [];
  for (const user of users) {
    const fixture = fixturesByEmail.get(user.email);
    const profile = user.profile || {};
    const nameMatches = fixture
      ? fixture.names.includes(profile.name) || fixture.names.includes(profile.fullName)
      : null;
    const medicalIdMatches = fixture
      ? fixture.medicalIds.length === 0 || fixture.medicalIds.includes(profile.medicalId)
      : null;
    const roleMatches = fixture ? user.role === fixture.role : null;
    const exactMatch = Boolean(fixture && roleMatches && nameMatches && medicalIdMatches);
    const visits = hasCollection(names, collectionNames.visits)
      ? await db
          .collection(collectionNames.visits)
          .find({
            $or: [
              { patientId: user._id },
              { userId: user._id },
              { doctorId: user._id },
              { nurseId: user._id },
              { technicianId: user._id },
            ],
          })
          .project({ _id: 1, status: 1 })
          .limit(MAX_RECORDS)
          .toArray()
      : [];
    const visitIds = visits.map(({ _id }) => _id);
    const linkedCounts = {};

    if (fixture?.role === "patient") {
      linkedCounts.patientProfiles = await count(
        db,
        names,
        collectionNames.profiles,
        { userId: user._id }
      );
      linkedCounts.legacyPatientRecords = await count(
        db,
        names,
        collectionNames.legacyPatientRecords,
        { patientId: user._id }
      );
      linkedCounts.vitalSigns = await count(db, names, "vital_signs", { patient_id: user._id });
      linkedCounts.labOrders = await count(db, names, "lab_orders", { patient_id: user._id });
      linkedCounts.consentForms = await count(db, names, "consentforms", { patientId: user._id });
      linkedCounts.notifications = await count(db, names, "notifications", { recipientId: user._id });
      linkedCounts.imagingResults = visitIds.length
        ? await count(db, names, collectionNames.imagingResults, { visitId: { $in: visitIds } })
        : 0;
      linkedCounts.dicomStudies = visitIds.length
        ? await count(db, names, collectionNames.dicomStudies, {
            $or: [{ patientId: user._id }, { visitId: { $in: visitIds } }],
          })
        : 0;
      linkedCounts.aiJobs = visitIds.length
        ? await count(db, names, collectionNames.aiJobs, { visitId: { $in: visitIds } })
        : 0;
      linkedCounts.storedMedicalFiles = await count(
        db,
        names,
        collectionNames.storedMedicalFiles,
        { patientId: user._id }
      );
    }

    const auditLogs = hasCollection(names, collectionNames.auditLogs)
      ? await db
          .collection(collectionNames.auditLogs)
          .find({
            entity: "User",
            entityId: { $in: [String(user._id), user._id] },
          })
          .project({ action: 1, performedBy: 1, createdAt: 1 })
          .limit(MAX_RECORDS)
          .toArray()
      : [];
    const auditActionCounts = {};
    for (const log of auditLogs) {
      const action = typeof log.action === "string" ? log.action : "(action missing)";
      auditActionCounts[action] = (auditActionCounts[action] || 0) + 1;
    }

    results.push({
      id: shaId(user._id),
      classification: "UNRESOLVED",
      fixtureIdentityMatch: fixture
        ? exactMatch ? "exact" : "partial"
        : "email-only; fixture role/name mapping unavailable",
      fixtureSources: fixture?.sources || seedSourceFiles.filter((source) => sourceEmails.includes(user.email)),
      roleMatches,
      nameMatches,
      medicalIdMatches: fixture
        ? fixture.medicalIds.length ? medicalIdMatches : "not applicable"
        : null,
      createdAt: user.createdAt || null,
      visits: {
        count: visits.length,
        statuses: visits.reduce((statuses, visit) => {
          const status = visit.status || "(status missing)";
          statuses[status] = (statuses[status] || 0) + 1;
          return statuses;
        }, {}),
      },
      linkedCounts,
      audit: {
        count: auditLogs.length,
        actionCounts: auditActionCounts,
        actorIsSameUserCount: auditLogs.filter(
          (log) => String(log.performedBy || "") === String(user._id)
        ).length,
      },
    });
  }
  return results;
};

const inspectLegacyPatientRecords = async (db, names, fixtureUserIds) => {
  const collectionName = collectionNames.legacyPatientRecords;
  if (!hasCollection(names, collectionName)) {
    return { exists: false, count: null, records: [], orphanCounts: null };
  }

  const totalCount = await db.collection(collectionName).countDocuments({});
  const records = await db
    .collection(collectionName)
    .find({})
    .project({
      _id: 1,
      patientId: 1,
      doctorId: 1,
      medicalId: 1,
      files: 1,
      visitId: 1,
      imagingResultId: 1,
      studyId: 1,
      aiJobId: 1,
      createdAt: 1,
      isDeleted: 1,
    })
    .limit(MAX_RECORDS)
    .toArray();
  const userIds = new Set(fixtureUserIds.map(String));
  const resultRecords = [];
  let orphanPatientCount = 0;
  let orphanDoctorCount = 0;

  for (const record of records) {
    const usersExist = hasCollection(names, collectionNames.users);
    const patientExists = usersExist && record.patientId
      ? await referenceExists(db, collectionNames.users, null, record.patientId)
      : false;
    const doctorExists = usersExist && record.doctorId
      ? await referenceExists(db, collectionNames.users, null, record.doctorId)
      : false;
    const patientInFixtureSet = userIds.has(String(record.patientId));
    const doctorInFixtureSet = userIds.has(String(record.doctorId));
    const visitIdPresent = record.visitId !== undefined && record.visitId !== null;
    const imagingIdPresent = record.imagingResultId !== undefined && record.imagingResultId !== null;
    const studyIdPresent = record.studyId !== undefined && record.studyId !== null;
    const aiJobIdPresent = record.aiJobId !== undefined && record.aiJobId !== null;
    const files = Array.isArray(record.files) ? record.files : [];
    const hasFileReference = files.some((file) =>
      file && typeof file === "object" && (
        file.fileId ||
        file.storageFileId ||
        file.storedMedicalFileId
      )
    );
    const fileReferenceValues = files.flatMap((file) => (
      file && typeof file === "object"
        ? [file.fileId, file.storageFileId, file.storedMedicalFileId].filter(Boolean)
        : []
    ));

    if (usersExist && !patientExists) orphanPatientCount += 1;
    if (usersExist && !doctorExists) orphanDoctorCount += 1;

    let imagingMatchCount = null;
    if (hasCollection(names, collectionNames.imagingResults) && record.medicalId) {
      imagingMatchCount = await db
        .collection(collectionNames.imagingResults)
        .countDocuments({ medicalId: record.medicalId });
    }
    const linkedVisitCount =
      visitIdPresent && hasCollection(names, collectionNames.visits)
        ? await db.collection(collectionNames.visits).countDocuments({ _id: record.visitId })
        : null;
    const linkedImagingResultCount =
      imagingIdPresent && hasCollection(names, collectionNames.imagingResults)
        ? await db.collection(collectionNames.imagingResults).countDocuments({ _id: record.imagingResultId })
        : null;
    const linkedStudyCount =
      studyIdPresent && hasCollection(names, collectionNames.dicomStudies)
        ? await db.collection(collectionNames.dicomStudies).countDocuments({ _id: record.studyId })
        : null;
    const linkedAiJobCount =
      aiJobIdPresent && hasCollection(names, collectionNames.aiJobs)
        ? await db.collection(collectionNames.aiJobs).countDocuments({ _id: record.aiJobId })
        : null;
    const matchedStoredFileReferenceCount = hasCollection(names, collectionNames.storedMedicalFiles)
      ? fileReferenceValues.length
        ? await db.collection(collectionNames.storedMedicalFiles).countDocuments({
            fileId: { $in: fileReferenceValues.map(String) },
          })
        : 0
      : null;

    resultRecords.push({
      id: shaId(record._id),
      classification: usersExist && (!patientExists || !doctorExists)
        ? "ORPHAN_CANDIDATE"
        : "UNRESOLVED",
      patientReferenceValid: usersExist ? patientExists : null,
      doctorReferenceValid: usersExist ? doctorExists : null,
      patientBelongsToFixtureAccount: patientInFixtureSet,
      doctorBelongsToFixtureAccount: doctorInFixtureSet,
      visitReference: !visitIdPresent
        ? "absent"
        : hasCollection(names, collectionNames.visits)
          ? linkedVisitCount
          : "target-collection-unavailable",
      imagingResultReference: !imagingIdPresent
        ? "absent"
        : hasCollection(names, collectionNames.imagingResults)
          ? linkedImagingResultCount
          : "target-collection-unavailable",
      dicomStudyReference: !studyIdPresent
        ? "absent"
        : hasCollection(names, collectionNames.dicomStudies)
          ? linkedStudyCount
          : "target-collection-unavailable",
      aiJobReference: !aiJobIdPresent
        ? "absent"
        : hasCollection(names, collectionNames.aiJobs)
          ? linkedAiJobCount
          : "target-collection-unavailable",
      fileEntryCount: files.length,
      hasRecognizableStoredFileIdReference: hasFileReference,
      storedFileReferenceValueCount: fileReferenceValues.length,
      matchedStoredFileReferenceCount,
      imagingResultsMatchingInternalMedicalId: imagingMatchCount,
      createdAt: record.createdAt || null,
      softDeleted: record.isDeleted === true,
    });
  }

  const linkedFixturePatientCount = resultRecords.filter(
    (record) => record.patientBelongsToFixtureAccount
  ).length;
  return {
    exists: true,
    count: totalCount,
    listedCount: resultRecords.length,
    truncated: totalCount > resultRecords.length,
    linkedToFixturePatientCount: linkedFixturePatientCount,
    orphanCounts: {
      missingPatientUser: orphanPatientCount,
      missingDoctorUser: orphanDoctorCount,
    },
    records: resultRecords,
  };
};

const inspectImaging = async (db, names) => {
  const phrase = /Phim thử nghiệm AI/i;
  const phraseFields = {
    [collectionNames.imagingResults]: [
      "patientName",
      "medicalId",
      "medicalRecordNumber",
      "diagnosis",
      "procedure",
      "findings",
      "conclusion",
    ],
    [collectionNames.dicomStudies]: ["description", "accessionNumber", "studyUID"],
    [collectionNames.dicomSeries]: ["seriesDescription", "seriesUID"],
    [collectionNames.aiJobs]: ["currentStep", "bullJobId", "errorLog.message"],
    [collectionNames.storedMedicalFiles]: ["fileName", "logicalPath", "studyId"],
  };
  const phraseMatches = {};
  for (const [collectionName, fields] of Object.entries(phraseFields)) {
    if (!hasCollection(names, collectionName)) {
      phraseMatches[collectionName] = null;
      continue;
    }
    const query = { $or: fields.map((field) => ({ [field]: phrase })) };
    phraseMatches[collectionName] = await db.collection(collectionName).countDocuments(query);
  }

  const knownFixtureMarkers = {
    [collectionNames.imagingResults]: {
      medicalRecordNumber: { $in: ["MRN-2026-9901", "SBA-2026-99123"] },
    },
  };
  const fixtureMarkerMatches = {};
  for (const [collectionName, query] of Object.entries(knownFixtureMarkers)) {
    fixtureMarkerMatches[collectionName] = await count(db, names, collectionName, query);
  }

  return { phraseMatches, knownFixtureMarkerMatches: fixtureMarkerMatches };
};

const inspectOrphans = async (db, names) => {
  const checks = [
    ["patientprofiles", "userId", "users"],
    ["patientrecords", "patientId", "users"],
    ["patientrecords", "doctorId", "users"],
    ["patientrecords", "visitId", "visits"],
    ["patientrecords", "imagingResultId", "imagingresults"],
    ["patientrecords", "studyId", "dicomstudies"],
    ["patientrecords", "aiJobId", "aijobs"],
    ["visits", "patientId", "users"],
    ["visits", "userId", "users"],
    ["visits", "doctorId", "users"],
    ["imagingresults", "visitId", "visits"],
    ["imagingresults", "studyId", "dicomstudies"],
    ["imagingresults", "aiJobId", "aijobs"],
    ["imagingresults", "signedBy", "users"],
    ["imagingresults", "signedByDoctorId", "users"],
    ["imagingresults", "storageFileId", "storedmedicalfiles:fileId"],
    ["imagingresults", "storageReportFileId", "storedmedicalfiles:fileId"],
    ["dicomstudies", "patientId", "users"],
    ["dicomstudies", "visitId", "visits"],
    ["dicomstudies", "imagingResultId", "imagingresults"],
    ["dicomstudies", "uploadedBy", "users"],
    ["dicomstudies", "rawZipFileId", "storedmedicalfiles:fileId"],
    ["dicomstudies", "keySliceFileId", "storedmedicalfiles:fileId"],
    ["dicomseries", "studyId", "dicomstudies"],
    ["dicomseries", "sliceFileIds", "storedmedicalfiles:fileId"],
    ["aijobs", "visitId", "visits"],
    ["aijobs", "imagingResultId", "imagingresults"],
    ["aijobs", "studyId", "dicomstudies"],
    ["aijobs", "triggeredBy", "users"],
    ["storedmedicalfiles", "patientId", "users"],
    ["storedmedicalfiles", "uploadedBy", "users"],
    ["storedmedicalfiles", "studyId", "dicomstudies"],
  ];
  const results = [];
  for (const [collectionName, field, target] of checks) {
    if (!hasCollection(names, collectionName)) {
      results.push({ collection: collectionName, field, target, collectionExists: false });
      continue;
    }
    const docs = await db
      .collection(collectionName)
      .find({ [field]: { $exists: true, $ne: null } })
      .project({ _id: 1, [field]: 1 })
      .limit(MAX_RECORDS)
      .toArray();
    const [targetCollection, targetField] = target.split(":");
    let orphanDocumentCount = 0;
    let orphanReferenceCount = 0;
    let checkedReferenceCount = 0;
    for (const document of docs) {
      if (!hasCollection(names, targetCollection)) continue;
      const references = Array.isArray(document[field])
        ? document[field]
        : [document[field]];
      let hasMissingReference = false;
      for (const reference of references) {
        if (reference === undefined || reference === null || reference === "") continue;
        checkedReferenceCount += 1;
        if (!(await referenceExists(db, targetCollection, targetField, reference))) {
          orphanReferenceCount += 1;
          hasMissingReference = true;
        }
      }
      if (hasMissingReference) orphanDocumentCount += 1;
    }
    if (!hasCollection(names, targetCollection)) {
      results.push({
        collection: collectionName,
        field,
        target,
        collectionExists: true,
        targetCollectionExists: false,
        checkedCount: docs.length,
        orphanCandidateCount: null,
      });
      continue;
    }
    results.push({
      collection: collectionName,
      field,
      target,
      collectionExists: true,
      targetCollectionExists: true,
      checkedCount: docs.length,
      truncated: docs.length === MAX_RECORDS,
      checkedReferenceCount,
      orphanCandidateDocumentCount: orphanDocumentCount,
      orphanCandidateReferenceCount: orphanReferenceCount,
    });
  }
  return results;
};

const inspectSourceMigrations = async () => {
  const scriptsDir = path.join(backendDir, "src", "scripts");
  const entries = await fs.readdir(scriptsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^migrat/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
};

export const runReadOnlySeedAudit = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required; audit did not connect to a database.");
  }

  await connectLocalTestMongo(mongoose, mongoUri);
  try {
    const db = mongoose.connection.db;

    const names = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name)
    );
    const sourceEmails = await readSeedEmails();
    const fixtureUsers = await findFixtureAccounts(db, names, sourceEmails);
    const accountRows = hasCollection(names, collectionNames.users)
      ? await db
          .collection(collectionNames.users)
          .find({ email: { $in: sourceEmails } })
          .project({ _id: 1 })
          .limit(MAX_RECORDS)
          .toArray()
      : [];
    const userObjectIds = accountRows.map(({ _id }) => _id);
    const fixtureUserIds = new Set(userObjectIds.map(String));
    const legacyPatientRecords = await inspectLegacyPatientRecords(
      db,
      names,
      accountRows.map(({ _id }) => _id)
    );
    const imaging = await inspectImaging(db, names);
    const indexes = {};
    for (const collectionName of relevantCollections) {
      indexes[collectionName] = await readIndexes(db, names, collectionName);
    }
    const migrationCollections = migrationCollectionNames.filter((name) => names.has(name));
    const sourceMigrations = await inspectSourceMigrations();
    const allCurrentProfileCounts = {
      patients: await count(db, names, collectionNames.profiles),
      visits: await count(db, names, collectionNames.visits),
      imagingResults: await count(db, names, collectionNames.imagingResults),
    };
    const report = {
      auditAt: new Date().toISOString(),
      mode: "read-only; no write/delete/apply path",
      database: db.databaseName,
      sourceMigrationFiles: sourceMigrations,
      migrationRegistryCollections: migrationCollections,
      collections: await Promise.all(relevantCollections.map(async (name) => ({
        name,
        exists: names.has(name),
        count: names.has(name) ? await db.collection(name).countDocuments({}) : null,
      }))),
      indexes,
      fixtureAccounts: {
        sourceFiles: seedSourceFiles,
        distinctSourceFixtureEmails: sourceEmails.length,
        matchedDatabaseRows: fixtureUsers.length,
        exactFixtureMatches: fixtureUsers.filter((user) =>
          user.fixtureIdentityMatch === "exact"
        ).length,
        records: fixtureUsers.map((user) => ({
          ...user,
          classification: "UNRESOLVED",
          cleanupEligible: false,
        })),
      },
      legacyPatientRecords: {
        ...legacyPatientRecords,
        records: legacyPatientRecords.records.map((record) => ({
          ...record,
          classification: "UNRESOLVED",
          cleanupEligible: false,
        })),
      },
      imaging,
      orphanChecks: await inspectOrphans(db, names),
      allPatientProfileVisitImagingCounts: allCurrentProfileCounts,
      conclusion: {
        confirmedTestCount: 0,
        confirmedProductionCount: 0,
        unresolvedFixtureAccountCount: fixtureUsers.length,
        unresolvedLegacyPatientRecordCount: legacyPatientRecords.count || 0,
        cleanupEligibleCount: 0,
      },
    };
    return report;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runReadOnlySeedAudit()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(`Read-only seed audit failed: ${error.message}`);
      process.exitCode = 1;
    });
}
