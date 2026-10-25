import crypto from "crypto";
import path from "path";
import readline from "node:readline/promises";
import { pathToFileURL } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { verifyDatabaseBackup } from "../utils/databaseBackup.util.js";
import { connectLocalTestMongo } from "../utils/seedGuard.util.js";

dotenv.config();

export const scriptName = "cleanupSeedDemoData.js";
export const CLEANUP_CONFIRMATION_PREFIX = "DELETE_SEED_DEMO_DATA:";

export const validateCleanupArguments = (args = []) => {
  if (args.includes("--purge-seed")) {
    throw new Error("--purge-seed is disabled because no trustworthy marker identifies all legacy seed data.");
  }
  if (args.length) {
    throw new Error(`Unsupported cleanup argument(s): ${args.join(" ")}.`);
  }
};

const demoPatientFixtures = [
  {
    email: "patient@neuroscan.com",
    name: "Bệnh nhân Tuấn Thành",
    medicalId: "26025699",
  },
  {
    email: "patient@neuroscan.com",
    name: "Bệnh nhân Tuấn Thành (U Màng Não)",
    medicalId: "BN001",
  },
  {
    email: "patient2@neuroscan.com",
    name: "Bệnh nhân Minh Hằng (Glioblastoma Phù Não)",
    medicalId: "BN002",
  },
  {
    email: "patient3@neuroscan.com",
    name: "Bệnh nhân Quốc Bảo (U Tuyến Yên)",
    medicalId: "BN003",
  },
  {
    email: "benhnhan1@gmail.com",
    name: "Bệnh nhân Nguyễn Văn Một",
    medicalId: "BN001",
  },
  {
    email: "benhnhan2@gmail.com",
    name: "Bệnh nhân Trần Thị Hai",
    medicalId: "BN002",
  },
  {
    email: "benhnhan3@gmail.com",
    name: "Bệnh nhân Lê Văn Ba",
    medicalId: "BN003",
  },
];

const unlinkedMedicalRecordFixtures = [
  { patientId: "BN001", patientName: "Bệnh nhân Tuấn Thành (U Màng Não)" },
  { patientId: "BN002", patientName: "Bệnh nhân Minh Hằng (Glioblastoma Phù Não)" },
  { patientId: "BN003", patientName: "Bệnh nhân Quốc Bảo (U Tuyến Yên)" },
  { patientId: "PT-001", patientName: "Nguyễn Văn An" },
  { patientId: "PT-002", patientName: "Trần Thị Mai" },
  { patientId: "PT-003", patientName: "Lê Quốc Hùng" },
];

const unlinkedImagingFixtures = [
  {
    medicalId: "BN001",
    medicalRecordNumber: "MRN-2026-9901",
    patientName: "Bệnh nhân Tuấn Thành (U Màng Não)",
  },
  { medicalId: "BN003", patientName: "Bệnh nhân Lê Văn Ba" },
  { medicalId: "PT-001", medicalRecordNumber: "SBA-2026-99123", patientName: "Nguyễn Văn An" },
];

const seededVisitReasons = [
  "Tái khám kiểm tra sau đợt uống thuốc giảm đau đầu",
  "Đau đầu dữ dội kèm buồn nôn, yếu nhẹ tay phải",
  "Chỉ định chụp MRI sọ não cản từ đánh giá u tuyến yên",
  "Khảo sát cấp cứu phù não và thể tích khối u u nguyên bào",
  "Khảo sát u màng não thái dương",
  "Đã hoàn tất khám và kê đơn ngoại trú",
  "Tái khám định kỳ u màng não — đã hoàn tất toàn bộ hành trình",
  "Khám cấp cứu đau đầu dữ dội — đã hoàn tất toàn bộ hành trình",
  "Đau đầu kéo dài",
  "Chóng mặt, buồn nôn",
  "Kiểm tra định kỳ",
];

const inIds = (field, ids) => (ids.length ? { [field]: { $in: ids } } : null);
const matchesAny = (...filters) => {
  const present = filters.filter(Boolean);
  if (present.length === 0) return null;
  return present.length === 1 ? present[0] : { $or: present };
};

const objectIdString = (value) => (value?.toHexString ? value.toHexString() : String(value));

const findDocuments = async (db, collectionName, filter, session) => {
  if (!filter) return [];
  const options = session ? { session } : {};
  return db.collection(collectionName).find(filter, options).project({ _id: 1 }).toArray();
};

const countMatches = async (db, collectionName, filter, session) => {
  if (!filter) return 0;
  const options = session ? { session } : {};
  const collections = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  if (collections.length === 0) return 0;
  return db.collection(collectionName).countDocuments(filter, options);
};

const exactFixtureUserFilter = {
  $or: [
    { isTestAccount: true, role: "patient" },
    ...demoPatientFixtures.map(({ email, name, medicalId }) => ({
      email,
      role: "patient",
      "profile.name": name,
      "profile.medicalId": medicalId,
    })),
  ],
};

export const buildCleanupPlan = async (db, session = null) => {
  const users = await findDocuments(db, "users", exactFixtureUserFilter, session);
  const userIds = users.map(({ _id }) => _id);
  const visitsFilter = inIds("patientId", userIds);
  const visits = await findDocuments(db, "visits", visitsFilter, session);
  const visitIds = visits.map(({ _id }) => _id);
  const imagingFilter = inIds("visitId", visitIds);
  const imagingResults = await findDocuments(db, "imagingresults", imagingFilter, session);
  const imagingResultIds = imagingResults.map(({ _id }) => _id);
  const dicomStudyFilter = matchesAny(inIds("patientId", userIds), inIds("visitId", visitIds));
  const dicomStudies = await findDocuments(db, "dicomstudies", dicomStudyFilter, session);
  const dicomStudyIds = dicomStudies.map(({ _id }) => _id);

  const patientId = inIds("patientId", userIds);
  const patientIdSnake = inIds("patient_id", userIds);
  const visitId = inIds("visitId", visitIds);
  const imagingResultId = inIds("imagingResultId", imagingResultIds);
  const dicomStudyId = inIds("studyId", dicomStudyIds);
  const criteriaByCollection = [
    ["patientprofiles", inIds("userId", userIds), "userId references an exact demo patient account"],
    ["visits", visitsFilter, "patientId references an exact demo patient account"],
    ["vital_signs", patientIdSnake, "patient_id references an exact demo patient account"],
    ["lab_orders", patientIdSnake, "patient_id references an exact demo patient account"],
    ["bhytinfos", matchesAny(patientId, visitId), "patientId or visitId references exact demo account data"],
    ["dataprivacyconsents", patientId, "patientId references an exact demo patient account"],
    ["consentforms", matchesAny(patientId, visitId, imagingResultId), "patientId, visitId, or imagingResultId references exact demo account data"],
    ["transfer_forms", matchesAny(patientIdSnake, visitId, imagingResultId), "patient_id, visitId, or imagingResultId references exact demo account data"],
    ["discharge_papers", patientIdSnake, "patient_id references an exact demo patient account"],
    ["imagingresults", imagingFilter, "visitId references a visit of an exact demo patient account"],
    ["tasks", matchesAny(patientId, visitId), "patientId or visitId references exact demo account data"],
    ["assignments", visitId, "visitId references a visit of an exact demo patient account"],
    ["peerreviews", visitId, "visitId references a visit of an exact demo patient account"],
    ["emergencyalerts", matchesAny(patientId, visitId), "patientId or visitId references exact demo account data"],
    ["prescriptions", patientIdSnake, "patient_id references an exact demo patient account"],
    ["medicine_reminders", patientId, "patientId references an exact demo patient account"],
    ["invoices", matchesAny(patientId, visitId), "patientId or visitId references exact demo account data"],
    ["mrislots", matchesAny(patientId, visitId), "patientId or visitId references exact demo account data"],
    ["dicomstudies", dicomStudyFilter, "patientId or visitId references exact demo account data"],
    ["dicomseries", dicomStudyId, "studyId references a DICOM study of an exact demo patient account"],
    ["aijobs", visitId, "visitId references a visit of an exact demo patient account"],
    ["storedmedicalfiles", patientId, "patientId references an exact demo patient account"],
    ["queue_tickets", patientId, "patientId references an exact demo patient account"],
    ["notifications", inIds("recipientId", userIds), "recipientId references an exact demo patient account"],
    ["users", exactFixtureUserFilter, "explicit isTestAccount=true patient marker or exact legacy seed fixture identity"],
  ];

  const collections = await Promise.all(
    criteriaByCollection.map(async ([name, filter, criteria]) => {
      const [count, documents] = await Promise.all([
        countMatches(db, name, filter, session),
        findDocuments(db, name, filter, session),
      ]);
      return {
        name,
        filter,
        criteria,
        count,
        ids: documents.map(({ _id }) => objectIdString(_id)).sort(),
      };
    })
  );

  const manualReview = [];
  const addManualReview = (collection, criteria, documents) => {
    if (!documents.length) return;
    const existing = manualReview.find((item) => item.collection === collection);
    const ids = documents.map(({ _id }) => objectIdString(_id));
    if (existing) {
      existing.criteria = `${[...new Set([existing.criteria.replace("; never auto-deleted", ""), criteria])]
        .join("; ")}; never auto-deleted`;
      existing.ids = [...new Set([...existing.ids, ...ids])].sort();
      return;
    }
    manualReview.push({ collection, criteria: `${criteria}; never auto-deleted`, ids: [...new Set(ids)].sort() });
  };

  const partialFixtureUserFilter = {
    $or: demoPatientFixtures.flatMap(({ email, name, medicalId }) => [
      { email },
      { "profile.name": name },
      { "profile.medicalId": medicalId },
    ]),
  };
  const partialFixtureUsers = await db
    .collection("users")
    .find({ ...partialFixtureUserFilter, _id: { $nin: userIds } }, session ? { session } : {})
    .project({ _id: 1 })
    .toArray();
  const partialFixtureUserIds = partialFixtureUsers.map(({ _id }) => _id);
  addManualReview(
    "users",
    "matches at least one fixture email, profile name, or medicalId but not the full exact account identity; human review only",
    partialFixtureUsers
  );
  const partialFixtureVisits = await findDocuments(
    db,
    "visits",
    inIds("patientId", partialFixtureUserIds),
    session
  );
  addManualReview(
    "visits",
    "patientId references an account that partially matches a demo fixture; human review only",
    partialFixtureVisits
  );

  const seededReasonVisits = await db
    .collection("visits")
    .find({ reason: { $in: seededVisitReasons }, patientId: { $nin: userIds } }, session ? { session } : {})
    .project({ _id: 1, patientId: 1 })
    .toArray();
  addManualReview(
    "visits",
    "exact reason text copied from seedAll.js or seed_mock_data.js; may be coincidental and requires human verification",
    seededReasonVisits
  );
  const seededReasonVisitIds = [...new Map(
    [...seededReasonVisits, ...partialFixtureVisits].map(({ _id }) => [objectIdString(_id), _id])
  ).values()];
  const orphanPatientIds = [...new Map(
    [...seededReasonVisits, ...partialFixtureVisits]
      .map(({ patientId }) => patientId)
      .filter(Boolean)
      .map((patientId) => [objectIdString(patientId), patientId])
  ).values()];
  for (const [collection, field, criteria] of [
    ["patientprofiles", "userId", "userId references an account that partially matches a demo fixture"],
    ["vital_signs", "patient_id", "patient_id references an account that partially matches a demo fixture"],
    ["lab_orders", "patient_id", "patient_id references an account that partially matches a demo fixture"],
    ["bhytinfos", "patientId", "patientId references an account that partially matches a demo fixture"],
    ["dataprivacyconsents", "patientId", "patientId references an account that partially matches a demo fixture"],
    ["prescriptions", "patient_id", "patient_id references an account that partially matches a demo fixture"],
    ["discharge_papers", "patient_id", "patient_id references an account that partially matches a demo fixture"],
    ["storedmedicalfiles", "patientId", "patientId references an account that partially matches a demo fixture"],
    ["medicine_reminders", "patientId", "patientId references an account that partially matches a demo fixture"],
    ["queue_tickets", "patientId", "patientId references an account that partially matches a demo fixture"],
    ["notifications", "recipientId", "recipientId references an account that partially matches a demo fixture"],
  ]) {
    addManualReview(
      collection,
      criteria,
      await findDocuments(db, collection, inIds(field, partialFixtureUserIds), session)
    );
  }
  const orphanVisitDependents = [
    ["tasks", "visitId references a visit with an exact seed reason"],
    ["assignments", "visitId references a visit with an exact seed reason"],
    ["peerreviews", "visitId references a visit with an exact seed reason"],
    ["imagingresults", "visitId references a visit with an exact seed reason"],
    ["dicomstudies", "visitId references a visit with an exact seed reason"],
    ["aijobs", "visitId references a visit with an exact seed reason"],
    ["emergencyalerts", "visitId references a visit with an exact seed reason"],
    ["invoices", "visitId references a visit with an exact seed reason"],
    ["mrislots", "visitId references a visit with an exact seed reason"],
    ["consentforms", "visitId references a visit with an exact seed reason"],
    ["bhytinfos", "visitId references a visit with an exact seed reason"],
    ["transfer_forms", "visitId references a visit with an exact seed reason"],
  ];
  for (const [collection, criteria] of orphanVisitDependents) {
    const candidates = await findDocuments(
      db,
      collection,
      inIds("visitId", seededReasonVisitIds),
      session
    );
    addManualReview(collection, criteria, candidates);
  }
  const orphanStudyDocuments = await findDocuments(
    db,
    "dicomstudies",
    inIds("visitId", seededReasonVisitIds),
    session
  );
  const orphanStudyIds = orphanStudyDocuments.map(({ _id }) => _id);
  addManualReview(
    "dicomseries",
    "studyId references a DICOM study linked to a visit with an exact seed reason",
    await findDocuments(db, "dicomseries", inIds("studyId", orphanStudyIds), session)
  );
  for (const [collection, field, criteria] of [
    ["vital_signs", "patient_id", "patient_id references the account ID of a visit with an exact seed reason"],
    ["lab_orders", "patient_id", "patient_id references the account ID of a visit with an exact seed reason"],
    ["prescriptions", "patient_id", "patient_id references the account ID of a visit with an exact seed reason"],
    ["discharge_papers", "patient_id", "patient_id references the account ID of a visit with an exact seed reason"],
    ["patientprofiles", "userId", "userId references the account ID of a visit with an exact seed reason"],
    ["storedmedicalfiles", "patientId", "patientId references the account ID of a visit with an exact seed reason"],
    ["medicine_reminders", "patientId", "patientId references the account ID of a visit with an exact seed reason"],
    ["queue_tickets", "patientId", "patientId references the account ID of a visit with an exact seed reason"],
  ]) {
    addManualReview(
      collection,
      criteria,
      await findDocuments(db, collection, inIds(field, orphanPatientIds), session)
    );
  }

  const medicalRecordFilter = {
    $or: unlinkedMedicalRecordFixtures.map(({ patientId, patientName }) => ({ patientId, patientName })),
  };
  const medicalRecordCandidates = await findDocuments(db, "medicalrecords", medicalRecordFilter, session);
  addManualReview(
    "medicalrecords",
    "exact fixture patientId + patientName; no user-account foreign key",
    medicalRecordCandidates
  );
  const medicalRecordIds = medicalRecordCandidates.map(({ _id }) => _id);
  if (medicalRecordIds.length) {
    for (const [collection, criteria] of [
      ["caresheets", "medicalRecordId references a review-only seed medical record"],
      ["emrversions", "medicalRecordId references a review-only seed medical record"],
      ["consultations", "medicalRecordId references a review-only seed medical record"],
      ["consentforms", "medicalRecordId references a review-only seed medical record"],
    ]) {
      const candidates = await findDocuments(db, collection, inIds("medicalRecordId", medicalRecordIds), session);
      addManualReview(collection, criteria, candidates);
    }
  }

  const linkedImagingIds = new Set(imagingResultIds.map(objectIdString));
  const imagingCandidateFilter = { $or: unlinkedImagingFixtures };
  const imagingCandidates = await findDocuments(db, "imagingresults", imagingCandidateFilter, session);
  const unlinkedCandidates = imagingCandidates
    .map(({ _id }) => objectIdString(_id))
    .filter((id) => !linkedImagingIds.has(id))
    .sort();
  if (unlinkedCandidates.length) {
    manualReview.push({
      collection: "imagingresults",
      criteria: "exact seed imaging identifiers without a visit linked to an exact demo account; never auto-deleted",
      ids: unlinkedCandidates,
    });
  }

  const demoFilmPhrase = /Phim thử nghiệm AI/i;
  const filmPhraseCandidates = await findDocuments(
    db,
    "imagingresults",
    {
      $or: ["patientName", "medicalId", "medicalRecordNumber", "diagnosis", "procedure", "findings", "conclusion"]
        .map((field) => ({ [field]: demoFilmPhrase })),
    },
    session
  );
  addManualReview(
    "imagingresults",
    "exact demo-film phrase in a known imaging-result text field; title alone is not proof of demo data",
    filmPhraseCandidates
  );
  const dicomFilmCandidates = await findDocuments(
    db,
    "dicomstudies",
    { description: demoFilmPhrase },
    session
  );
  addManualReview(
    "dicomstudies",
    "exact demo-film phrase in DICOM study description; title alone is not proof of demo data",
    dicomFilmCandidates
  );
  const demoFilmImagingIds = filmPhraseCandidates.map(({ _id }) => _id);
  const demoFilmStudyIds = dicomFilmCandidates.map(({ _id }) => _id);
  for (const [collection, field, ids, criteria] of [
    ["dicomstudies", "imagingResultId", demoFilmImagingIds, "imagingResultId references an imaging result containing the demo-film phrase"],
    ["dicomseries", "studyId", demoFilmStudyIds, "studyId references a DICOM study containing the demo-film phrase"],
    ["aijobs", "imagingResultId", demoFilmImagingIds, "imagingResultId references an imaging result containing the demo-film phrase"],
  ]) {
    const candidates = await findDocuments(db, collection, inIds(field, ids), session);
    addManualReview(collection, criteria, candidates);
  }

  return { collections, manualReview };
};

export const calculatePlanDigest = (databaseName, plan) => {
  const contents = plan.collections
    .map(({ name, ids }) => `${name}:${ids.join(",")}`)
    .join("\n");
  return crypto.createHash("sha256").update(`${databaseName}\n${contents}`).digest("hex");
};

export const validateCleanupConfirmation = ({ databaseName, planDigest, env = process.env }) => {
  if (env.SEED_CLEANUP_CONFIRM_DB !== databaseName) {
    throw new Error(`Set SEED_CLEANUP_CONFIRM_DB to the exact target database "${databaseName}".`);
  }
  if (env.SEED_CLEANUP_CONFIRMATION !== `${CLEANUP_CONFIRMATION_PREFIX}${planDigest}`) {
    throw new Error(`The target list changed or was not confirmed. Set SEED_CLEANUP_CONFIRMATION=${CLEANUP_CONFIRMATION_PREFIX}${planDigest} after reviewing the dry-run.`);
  }
  if (!env.SEED_CLEANUP_BACKUP_FILE || !path.isAbsolute(env.SEED_CLEANUP_BACKUP_FILE)) {
    throw new Error("An absolute SEED_CLEANUP_BACKUP_FILE path to a verified backup is required.");
  }
  if (!/^[a-f0-9]{64}$/i.test(env.SEED_CLEANUP_BACKUP_SHA256 || "")) {
    throw new Error("A verified SEED_CLEANUP_BACKUP_SHA256 is required.");
  }
  if (env.SEED_CLEANUP_RESTORE_TEST_CONFIRMED !== "true") {
    throw new Error("Verify that the backup can be restored to an isolated database, then set SEED_CLEANUP_RESTORE_TEST_CONFIRMED=true.");
  }
};

const ensureTransactionSupport = async (db) => {
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.logicalSessionTimeoutMinutes || (!hello.setName && hello.msg !== "isdbgrid")) {
    throw new Error("Cleanup requires a replica set or sharded MongoDB deployment with transaction support; no changes were made.");
  }
};

const confirmCleanupDatabase = async (databaseName) => {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive database-name confirmation is required before cleanup.");
  }
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await prompt.question(
      `Type "DELETE ${databaseName}" to confirm the exact cleanup target: `,
    );
    if (answer !== `DELETE ${databaseName}`) {
      throw new Error("Database-name confirmation did not match; no data was changed.");
    }
  } finally {
    prompt.close();
  }
};

const printPlan = (databaseName, plan, digest, log) => {
  log.log(`Database: ${databaseName}`);
  log.log("Cleanup targets (only exact fixture matches and their foreign-key dependents):");
  for (const { name, count, criteria, ids } of plan.collections) {
    log.log(`  ${name}: ${count}; criteria: ${criteria}`);
    if (ids.length) log.log(`    matched _id: ${ids.join(", ")}`);
  }
  log.log("Review-only candidates (not deleted):");
  if (plan.manualReview.length === 0) log.log("  none");
  for (const { collection, criteria, ids } of plan.manualReview) {
    log.log(`  ${collection}: ${ids.length}; criteria: ${criteria}`);
    log.log(`    matched _id: ${ids.join(", ")}`);
  }
  log.log(`Plan SHA-256: ${digest}`);
};

export const deleteCleanupPlan = async (db, plan, session) => {
  const deletedCounts = [];
  for (const { name, filter, count } of plan.collections) {
    if (!count) continue;
    try {
      const result = await db.collection(name).deleteMany(filter, { session });
      if (result.deletedCount !== count) {
        throw new Error(`Expected to delete ${count}, MongoDB reported ${result.deletedCount}.`);
      }
      deletedCounts.push({ name, count: result.deletedCount });
    } catch (cause) {
      throw new Error(
        `Cleanup failed at collection "${name}" after staged deletes ` +
        `${JSON.stringify(deletedCounts)}. The enclosing transaction must abort; ` +
        `verify transaction status before retrying. ${cause.message}`,
        { cause },
      );
    }
  }
  return deletedCounts;
};

export const runCleanup = async ({
  mongoUri = process.env.MONGO_URI,
  env = process.env,
  log = console,
  confirm = confirmCleanupDatabase,
} = {}) => {
  if (!mongoUri) throw new Error("MONGO_URI is required; cleanup will not fall back to another database.");
  await connectLocalTestMongo(mongoose, mongoUri, { env, logger: log });

  try {
    const db = mongoose.connection.db;
    const databaseName = db.databaseName;
    const apply = env.SEED_CLEANUP_APPLY === "true";
    const plan = await buildCleanupPlan(db);
    const planDigest = calculatePlanDigest(databaseName, plan);
    printPlan(databaseName, plan, planDigest, log);

    if (!apply) {
      log.log("Dry-run only: database was not modified.");
      log.log(`Apply only after reviewing the IDs and verifying a backup. Confirmation: ${CLEANUP_CONFIRMATION_PREFIX}${planDigest}`);
      return { applied: false, databaseName, plan, planDigest };
    }

    validateCleanupConfirmation({ databaseName, planDigest, env });
    const backup = await verifyDatabaseBackup({
      filePath: env.SEED_CLEANUP_BACKUP_FILE,
      expectedDatabase: databaseName,
      expectedSha256: env.SEED_CLEANUP_BACKUP_SHA256,
      encryptionKey: env.FILE_ENCRYPTION_KEY,
    });
    const backupAgeMs = Date.now() - Date.parse(backup.createdAt);
    if (!Number.isFinite(backupAgeMs) || backupAgeMs < 0 || backupAgeMs > 24 * 60 * 60 * 1000) {
      throw new Error("The verified backup must be no more than 24 hours old.");
    }
    log.log(`Verified backup artifact for database "${backup.database}" (${Object.keys(backup.collectionCounts).length} collections; SHA-256 ${backup.fileSha256}).`);

    await ensureTransactionSupport(db);
    await confirm(databaseName);
    const session = await mongoose.startSession();
    try {
      let deletedCounts;
      try {
        await session.withTransaction(async () => {
          const transactionPlan = await buildCleanupPlan(db, session);
          const transactionDigest = calculatePlanDigest(databaseName, transactionPlan);
          if (transactionDigest !== planDigest) {
            throw new Error("Cleanup targets changed after preview; transaction aborted without changes.");
          }
          deletedCounts = await deleteCleanupPlan(db, transactionPlan, session);
        });
      } catch (cause) {
        throw new Error(
          `Cleanup transaction failed after staged deletes ${JSON.stringify(deletedCounts || [])}. ` +
          `Transaction outcome may be unknown; verify before retrying. ${cause.message}`,
          { cause },
        );
      }
      log.log("Cleanup transaction committed.");
      for (const { name, count } of deletedCounts || []) log.log(`  ${name}: deleted ${count}`);
      return { applied: true, databaseName, plan, planDigest, deletedCounts };
    } finally {
      await session.endSession();
    }
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  Promise.resolve()
    .then(() => validateCleanupArguments(process.argv.slice(2)))
    .then(() => runCleanup())
    .catch((error) => {
      console.error(`[${scriptName}] ${error.message}`);
      process.exitCode = 1;
    });
}
