import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import { buildCleanupPlan, calculatePlanDigest, deleteCleanupPlan, runCleanup, validateCleanupArguments, validateCleanupConfirmation } from "../cleanupSeedDemoData.js";
import { restoreDatabaseToIsolatedTarget } from "../../../scripts/restoreDatabaseBackup.js";
import { createDatabaseBackup, createDatabaseBackupArtifacts, restoreDatabaseBackup, sha256, verifyDatabaseBackup } from "../../utils/databaseBackup.util.js";

const demoAccount = {
  email: "patient@neuroscan.com",
  role: "patient",
  profile: { name: "Bệnh nhân Tuấn Thành (U Màng Não)", medicalId: "BN001" },
};
const realAccountWithDemoEmail = {
  email: "patient@neuroscan.com",
  role: "patient",
  profile: { name: "Bệnh nhân thật", medicalId: "REAL-0001" },
};
const demoEncryptionKey = crypto.randomBytes(32).toString("hex");
const withDatabaseName = (mongoUri, databaseName) => {
  const url = new URL(mongoUri);
  url.pathname = `/${databaseName}`;
  return url.href;
};

test("cleanup plan matches fixture identity exactly and leaves lookalike patients reviewable", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());

  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("cleanup_plan_test");

  const { insertedId: demoUserId } = await db.collection("users").insertOne(demoAccount);
  const { insertedId: realUserId } = await db.collection("users").insertOne(realAccountWithDemoEmail);
  const { insertedId: similarUserId } = await db.collection("users").insertOne({
    email: "unrelated@example.test",
    role: "patient",
    profile: { name: demoAccount.profile.name, medicalId: demoAccount.profile.medicalId },
  });
  const { insertedId: demoVisitId } = await db.collection("visits").insertOne({ patientId: demoUserId });
  const { insertedId: realVisitId } = await db.collection("visits").insertOne({ patientId: realUserId });
  await db.collection("lab_orders").insertOne({ patient_id: demoUserId });
  const { insertedId: realLabOrderId } = await db.collection("lab_orders").insertOne({ patient_id: realUserId });
  await db.collection("medicalrecords").insertOne({
    patientId: "BN001",
    patientName: "Bệnh nhân Tuấn Thành (U Màng Não)",
  });

  const plan = await buildCleanupPlan(db);
  const users = plan.collections.find(({ name }) => name === "users");
  const visits = plan.collections.find(({ name }) => name === "visits");
  const labs = plan.collections.find(({ name }) => name === "lab_orders");

  assert.deepEqual(users.ids, [demoUserId.toHexString()]);
  assert.equal(visits.count, 1);
  assert.deepEqual(visits.ids, [demoVisitId.toHexString()]);
  assert.equal(labs.count, 1);
  assert.ok(!users.ids.includes(realUserId.toHexString()));
  assert.ok(!users.ids.includes(similarUserId.toHexString()));
  assert.ok(plan.manualReview.some(({ collection, ids }) =>
    collection === "users" && ids.includes(realUserId.toHexString())
  ));
  assert.ok(plan.manualReview.some(({ collection, ids }) =>
    collection === "visits" && ids.includes(realVisitId.toHexString())
  ));
  assert.ok(plan.manualReview.some(({ collection, ids }) =>
    collection === "lab_orders" && ids.includes(realLabOrderId.toHexString())
  ));
  assert.ok(plan.manualReview.some(({ collection, ids }) =>
    collection === "users" && ids.includes(similarUserId.toHexString())
  ));
  assert.equal(plan.collections.some(({ name }) => name === "medicalrecords"), false);
  const reviewedMedicalRecords = plan.manualReview.find(({ collection }) => collection === "medicalrecords");
  assert.ok(reviewedMedicalRecords);
  assert.deepEqual(reviewedMedicalRecords.ids, [
    (await db.collection("medicalrecords").findOne({ patientId: "BN001" }))._id.toHexString(),
  ]);
});

test("explicit test marker selects patient; legacy default false does not modify existing users", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("explicit_marker_test");
  const marked = await db.collection("users").insertOne({
    email: "new-patient@example.test",
    role: "patient",
    isTestAccount: true,
  });
  const legacy = await db.collection("users").insertOne({
    email: "patient@neuroscan.com",
    role: "patient",
    profile: { name: "Unrelated", medicalId: "REAL-009" },
  });

  const plan = await buildCleanupPlan(db);
  const users = plan.collections.find(({ name }) => name === "users");
  assert.deepEqual(users.ids, [marked.insertedId.toHexString()]);
  assert.ok(!users.ids.includes(legacy.insertedId.toHexString()));
  assert.equal((await db.collection("users").findOne({ _id: legacy.insertedId })).isTestAccount, undefined);
});

test("orphaned seed-reason visits and demo-film markers are review-only", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("orphan_fixture_review_test");
  const orphanPatientId = new mongoose.mongo.ObjectId();
  const orphanVisitId = new mongoose.mongo.ObjectId();
  const orphanImagingId = new mongoose.mongo.ObjectId();
  const orphanStudyId = new mongoose.mongo.ObjectId();
  await db.collection("visits").insertOne({
    _id: orphanVisitId,
    patientId: orphanPatientId,
    reason: "Chỉ định chụp MRI sọ não cản từ đánh giá u tuyến yên",
  });
  await db.collection("tasks").insertOne({
    visitId: orphanVisitId,
    title: "MRI processing",
  });
  await db.collection("dicomseries").insertOne({ studyId: orphanStudyId });
  await db.collection("vital_signs").insertOne({ patient_id: orphanPatientId });
  await db.collection("imagingresults").insertOne({
    _id: orphanImagingId,
    medicalId: "UNKNOWN-1",
    patientName: "Không rõ bệnh nhân",
    procedure: "[Phim thử nghiệm AI]",
  });
  await db.collection("dicomstudies").insertOne({
    _id: orphanStudyId,
    visitId: orphanVisitId,
    description: "Study [Phim thử nghiệm AI]",
  });

  const plan = await buildCleanupPlan(db);
  const reviewItems = (collection) => plan.manualReview.filter((item) => item.collection === collection);
  assert.ok(reviewItems("visits").some((item) => item.ids.includes(orphanVisitId.toHexString())));
  assert.ok(reviewItems("tasks").some((item) => item.ids.length === 1));
  assert.ok(reviewItems("dicomseries").some((item) => item.ids.length === 1));
  assert.ok(reviewItems("vital_signs").some((item) => item.ids.length === 1));
  assert.ok(reviewItems("imagingresults").some((item) => item.ids.includes(orphanImagingId.toHexString())));
  assert.ok(reviewItems("dicomstudies").some((item) => item.ids.includes(orphanStudyId.toHexString())));
  assert.equal(plan.collections.find(({ name }) => name === "users").count, 0);
  assert.equal(plan.collections.find(({ name }) => name === "visits").count, 0);
  assert.equal(plan.collections.find(({ name }) => name === "tasks").count, 0);
  assert.equal(plan.collections.find(({ name }) => name === "vital_signs").count, 0);
});

test("dry-run performs no writes", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("cleanup_dry_run_test");
  await db.collection("users").insertOne(demoAccount);

  const before = await db.collection("users").countDocuments({});
  const result = await runCleanup({
    mongoUri: withDatabaseName(server.getUri(), "cleanup_dry_run_test"),
    env: { SEED_CLEANUP_APPLY: "false" },
    log: { log() {} },
  });
  const after = await db.collection("users").countDocuments({});

  assert.equal(result.applied, false);
  assert.equal(before, after);
});

test("scanner failure is propagated before any cleanup write", async () => {
  let deleteCalls = 0;
  const db = {
    collection() {
      return {
        find() {
          return {
            project() {
              return {
                async toArray() {
                  throw new Error("simulated collection scan failure");
                },
              };
            },
          };
        },
        async deleteMany() {
          deleteCalls += 1;
        },
      };
    },
  };

  await assert.rejects(buildCleanupPlan(db), /simulated collection scan failure/);
  assert.equal(deleteCalls, 0);
});

test("apply stops on backup verification failure without deleting selected data", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const databaseName = "backup_failure_cleanup_test";
  const mongoUri = withDatabaseName(server.getUri(), databaseName);
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db(databaseName);
  await db.collection("users").insertOne(demoAccount);
  const plan = await buildCleanupPlan(db);
  const planDigest = calculatePlanDigest(databaseName, plan);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "neuroscan-backup-failure-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "invalid-backup.enc.json");
  const invalidBackup = Buffer.from("not a valid backup");
  await fs.writeFile(filePath, invalidBackup);

  await assert.rejects(
    runCleanup({
      mongoUri,
      env: {
        NODE_ENV: "test",
        SEED_CLEANUP_APPLY: "true",
        SEED_CLEANUP_CONFIRM_DB: databaseName,
        SEED_CLEANUP_CONFIRMATION: `DELETE_SEED_DEMO_DATA:${planDigest}`,
        SEED_CLEANUP_BACKUP_FILE: filePath,
        SEED_CLEANUP_BACKUP_SHA256: sha256(invalidBackup),
        SEED_CLEANUP_RESTORE_TEST_CONFIRMED: "true",
        FILE_ENCRYPTION_KEY: demoEncryptionKey,
      },
      log: { log() {} },
      confirm: async () => {},
    }),
    /backup|JSON|decrypt/i,
  );

  assert.equal(await db.collection("users").countDocuments({}), 1);
});

test("cleanup delete failure reports collection and staged progress", async () => {
  const db = {
    collection(name) {
      return {
        async deleteMany() {
          if (name === "visits") throw new Error("simulated write failure");
          return { deletedCount: 2 };
        },
      };
    },
  };
  const plan = {
    collections: [
      { name: "users", filter: {}, count: 2 },
      { name: "visits", filter: {}, count: 1 },
    ],
  };
  await assert.rejects(
    deleteCleanupPlan(db, plan, {}),
    /collection "visits" after staged deletes \[\{"name":"users","count":2\}\].*simulated write failure/,
  );
});

test("apply confirmation rejects a wrong database, changed plan, or missing verified backup and restore check", () => {
  const planDigest = "a".repeat(64);
  assert.throws(
    () => validateCleanupConfirmation({ databaseName: "expected", planDigest, env: {} }),
    /exact target database/
  );
  const confirmed = {
    SEED_CLEANUP_CONFIRM_DB: "expected",
    SEED_CLEANUP_CONFIRMATION: `DELETE_SEED_DEMO_DATA:${planDigest}`,
    SEED_CLEANUP_BACKUP_FILE: "C:\\backup\\verified.enc.json",
    SEED_CLEANUP_BACKUP_SHA256: "b".repeat(64),
    SEED_CLEANUP_RESTORE_TEST_CONFIRMED: "true",
  };
  assert.throws(
    () => validateCleanupConfirmation({ databaseName: "wrong", planDigest, env: confirmed }),
    /exact target database/
  );
  assert.throws(
    () => validateCleanupConfirmation({
      databaseName: "expected",
      planDigest: "c".repeat(64),
      env: confirmed,
    }),
    /target list changed/
  );
  const withoutBackup = { ...confirmed, SEED_CLEANUP_BACKUP_FILE: "" };
  assert.throws(
    () => validateCleanupConfirmation({ databaseName: "expected", planDigest, env: withoutBackup }),
    /verified backup/
  );
  const withoutRestore = { ...confirmed, SEED_CLEANUP_RESTORE_TEST_CONFIRMED: "false" };
  assert.throws(
    () => validateCleanupConfirmation({ databaseName: "expected", planDigest, env: withoutRestore }),
    /restored to an isolated database/
  );
});

test("purge-seed is refused because legacy seed data has no trustworthy marker", () => {
  assert.doesNotThrow(() => validateCleanupArguments([]));
  assert.throws(
    () => validateCleanupArguments(["--purge-seed"]),
    /no trustworthy marker identifies all legacy seed data/,
  );
});

test("backup verification preserves collection counts and rejects wrong database or hash", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("backup_verify_test");
  await db.collection("typed_documents").insertOne({
    _id: new mongoose.mongo.ObjectId(),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    count: 3,
  });
  const backup = await createDatabaseBackup(db, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "neuroscan-backup-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const file = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, file);
  const fileSha256 = sha256(file);

  const verified = await verifyDatabaseBackup({
    filePath,
    expectedDatabase: "backup_verify_test",
    expectedSha256: fileSha256,
    encryptionKey: demoEncryptionKey,
  });
  assert.equal(verified.collectionCounts.typed_documents, 1);
  assert.equal(verified.collectionIndexCounts.typed_documents, 1);
  await assert.rejects(
    verifyDatabaseBackup({
      filePath,
      expectedDatabase: "wrong_database",
      expectedSha256: fileSha256,
      encryptionKey: demoEncryptionKey,
    }),
    /does not match/
  );
  await assert.rejects(
    verifyDatabaseBackup({
      filePath,
      expectedDatabase: "backup_verify_test",
      expectedSha256: "0".repeat(64),
      encryptionKey: demoEncryptionKey,
    }),
    /SHA-256 does not match/
  );
});

test("backup artifacts include a verifiable encrypted file for each collection", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("backup_collection_files_test");
  await db.collection("patients").insertOne({ record: "patient-fixture" });
  await db.collection("visits").insertMany([{ record: "visit-1" }, { record: "visit-2" }]);
  const artifacts = await createDatabaseBackupArtifacts(db, demoEncryptionKey);

  assert.equal(artifacts.backup.database, "backup_collection_files_test");
  assert.deepEqual(
    artifacts.collectionBackups.map(({ name }) => name).sort(),
    ["patients", "visits"],
  );
  assert.equal(new Set(artifacts.collectionBackups.map(({ fileName }) => fileName)).size, 2);
  assert.equal(
    artifacts.collectionBackups.find(({ name }) => name === "patients").backup.collectionCounts.patients,
    1,
  );
  assert.equal(
    artifacts.collectionBackups.find(({ name }) => name === "visits").backup.collectionCounts.visits,
    2,
  );
  assert.equal(
    JSON.stringify(artifacts.collectionBackups).includes("patient-fixture"),
    false,
  );
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "backup-collection-files-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const entry of artifacts.collectionBackups) {
    const filePath = path.join(dir, entry.fileName);
    const contents = Buffer.from(JSON.stringify(entry.backup));
    await fs.writeFile(filePath, contents);
    const verified = await verifyDatabaseBackup({
      filePath,
      expectedDatabase: db.databaseName,
      expectedSha256: sha256(contents),
      encryptionKey: demoEncryptionKey,
    });
    assert.equal(verified.collectionCounts[entry.name], entry.backup.collectionCounts[entry.name]);
  }
});

test("backup restores documents, collection metadata, and indexes only into a distinct empty database", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());

  const source = client.db("restore_source_test");
  await source.createCollection("records", { validator: { level: { $gte: 0 } } });
  await source.collection("records").createIndex({ externalId: 1 }, { unique: true, name: "external_id_unique" });
  await source.collection("records").insertOne({
    externalId: "fixture-1",
    level: 1,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    nested: { amount: 4 },
  });
  await source.collection("records").insertOne({
    externalId: "fixture-2",
    level: 2,
  });
  await source.createCollection("record_view", {
    viewOn: "records",
    pipeline: [{ $match: { externalId: "fixture-1" } }],
  });

  const backup = await createDatabaseBackup(source, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "neuroscan-restore-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const file = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, file);

  const result = await restoreDatabaseBackup({
    filePath,
    expectedSha256: sha256(file),
    encryptionKey: demoEncryptionKey,
    targetDb: client.db("restore_target_test"),
  });
  assert.equal(result.sourceDatabase, "restore_source_test");
  assert.equal(result.targetDatabase, "restore_target_test");
  assert.equal(result.collectionCounts.records, 2);
  assert.equal(result.collectionIndexCounts.records, 2);
  assert.equal(result.collectionCounts.record_view, 0);
  assert.deepEqual(
    await client.db("restore_target_test").collection("records").findOne({ externalId: "fixture-1" }),
    await source.collection("records").findOne({ externalId: "fixture-1" })
  );
  assert.deepEqual(
    (await client.db("restore_target_test").collection("records").listIndexes().toArray()).map(({ name }) => name).sort(),
    ["_id_", "external_id_unique"]
  );
  assert.deepEqual(
    (await client.db("restore_target_test").listCollections({ name: "record_view" }).toArray())[0].options,
    (await source.listCollections({ name: "record_view" }).toArray())[0].options
  );

  const commandResult = await restoreDatabaseToIsolatedTarget({
    targetUri: withDatabaseName(server.getUri(), "restore_command_target_test"),
    backupFile: filePath,
    expectedSha256: sha256(file),
    encryptionKey: demoEncryptionKey,
    isolatedTargetConfirmed: "true",
  });
  assert.equal(commandResult.targetDatabase, "restore_command_target_test");
  assert.equal(commandResult.collectionCounts.records, 2);

  const occupiedTarget = client.db("occupied_restore_target_test");
  const retained = await occupiedTarget.collection("existing").insertOne({ keep: true });
  await occupiedTarget.createCollection("records", {
    validator: { level: { $gte: 0 } },
  });
  const matchingBackupDocument = await source.collection("records").findOne({ externalId: "fixture-1" });
  await occupiedTarget.collection("records").insertOne(matchingBackupDocument);
  const mergeResult = await restoreDatabaseBackup({
    filePath,
    expectedSha256: sha256(file),
    encryptionKey: demoEncryptionKey,
    targetDb: occupiedTarget,
  });
  assert.deepEqual(await occupiedTarget.collection("existing").findOne({ _id: retained.insertedId }), {
    _id: retained.insertedId,
    keep: true,
  });
  assert.equal(mergeResult.collections.records.restored, 1);
  assert.equal(mergeResult.collections.records.skipped, 1);
  assert.equal(mergeResult.collections.records.failed, 0);
  assert.equal(
    await occupiedTarget.collection("records").countDocuments({}),
    2,
  );
  assert.equal(
    await occupiedTarget.collection("records").countDocuments({ externalId: "fixture-1" }),
    1,
  );
  await assert.rejects(
    restoreDatabaseBackup({
      filePath,
      expectedSha256: sha256(file),
      encryptionKey: demoEncryptionKey,
      targetDb: source,
    }),
    /different database/
  );
  assert.equal(await occupiedTarget.collection("existing").countDocuments({}), 1);
});

test("restore reports a mid-operation failure with the collection and completed progress", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const source = client.db("restore_progress_source_test");
  await source.collection("records").createIndex({ externalId: 1 }, { name: "external_id_1" });
  await source.collection("records").insertMany([
    { externalId: "fixture-1" },
    { externalId: "fixture-2" },
  ]);
  const backup = await createDatabaseBackup(source, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "restore-progress-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const file = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, file);

  const target = client.db("restore_progress_target_test");
  const failingTarget = new Proxy(target, {
    get(database, property) {
      if (property === "collection") {
        return (name) => {
          const collection = database.collection(name);
          if (name !== "records") return collection;
          return new Proxy(collection, {
            get(value, member) {
              if (member === "createIndexes") {
                return async () => { throw new Error("simulated index creation failure"); };
              }
              const result = Reflect.get(value, member, value);
              return typeof result === "function" ? result.bind(value) : result;
            },
          });
        };
      }
      const result = Reflect.get(database, property, database);
      return typeof result === "function" ? result.bind(database) : result;
    },
  });

  await assert.rejects(
    restoreDatabaseBackup({
      filePath,
      expectedSha256: sha256(file),
      encryptionKey: demoEncryptionKey,
      targetDb: failingTarget,
    }),
    (error) => {
      assert.match(error.message, /Restore failed during creating missing indexes for collection "records"/);
      assert.equal(error.collection, "records");
      assert.equal(error.operation, "creating missing indexes");
      assert.equal(error.restoreProgress.records.restored, 2);
      assert.equal(error.restoreProgress.records.failed, 1);
      return true;
    },
  );
  assert.equal(await target.collection("records").countDocuments({}), 2);
});

test("restore preserves identical existing documents and rejects conflicting _id without writes", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const source = client.db("restore_conflict_source_test");
  await source.collection("records").insertOne({ _id: "fixture-id", value: "backup" });
  const backup = await createDatabaseBackup(source, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "restore-conflict-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const file = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, file);

  const target = client.db("restore_conflict_target_test");
  await target.collection("records").insertOne({ _id: "fixture-id", value: "already present" });
  await assert.rejects(
    restoreDatabaseBackup({
      filePath,
      expectedSha256: sha256(file),
      encryptionKey: demoEncryptionKey,
      targetDb: target,
    }),
    /Document _id conflict.*existing document was preserved/,
  );
  assert.deepEqual(await target.collection("records").findOne({ _id: "fixture-id" }), {
    _id: "fixture-id",
    value: "already present",
  });
  assert.equal(await target.collection("records").countDocuments({}), 1);
});

test("restore command requires explicit confirmation of the isolated target", async () => {
  await assert.rejects(
    restoreDatabaseToIsolatedTarget({
      targetUri: "mongodb://127.0.0.1:27017/restore_target_test",
      backupFile: "C:\\backup\\verified.enc.json",
      expectedSha256: "a".repeat(64),
      encryptionKey: demoEncryptionKey,
      isolatedTargetConfirmed: "false",
    }),
    /isolated, non-production target/
  );
});

test("cleanup refuses standalone MongoDB transactions without deleting records", async (t) => {
  const server = await MongoMemoryServer.create();
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("standalone_cleanup_test");
  await db.collection("users").insertOne(demoAccount);

  const plan = await buildCleanupPlan(db);
  const planDigest = calculatePlanDigest("standalone_cleanup_test", plan);
  const backup = await createDatabaseBackup(db, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "neuroscan-cleanup-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const backupFile = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, backupFile);

  await assert.rejects(
    runCleanup({
      mongoUri: withDatabaseName(server.getUri(), "standalone_cleanup_test"),
      env: {
        NODE_ENV: "test",
        SEED_CLEANUP_APPLY: "true",
        SEED_CLEANUP_CONFIRM_DB: "standalone_cleanup_test",
        SEED_CLEANUP_CONFIRMATION: `DELETE_SEED_DEMO_DATA:${planDigest}`,
        SEED_CLEANUP_BACKUP_FILE: filePath,
        SEED_CLEANUP_BACKUP_SHA256: sha256(backupFile),
        SEED_CLEANUP_RESTORE_TEST_CONFIRMED: "true",
        FILE_ENCRYPTION_KEY: demoEncryptionKey,
      },
      log: { log() {} },
      confirm: async (name) => name === "standalone_cleanup_test",
    }),
    /requires a replica set or sharded MongoDB/
  );
  assert.equal(await db.collection("users").countDocuments({}), 1);
});

test("cleanup commits only confirmed fixture-linked records in a test replica set", async (t) => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  t.after(() => server.stop());
  const client = new mongoose.mongo.MongoClient(server.getUri());
  await client.connect();
  t.after(() => client.close());
  const db = client.db("replica_cleanup_test");
  const { insertedId: demoUserId } = await db.collection("users").insertOne(demoAccount);
  const { insertedId: realUserId } = await db.collection("users").insertOne(realAccountWithDemoEmail);
  const { insertedId: demoVisitId } = await db.collection("visits").insertOne({ patientId: demoUserId });
  const { insertedId: realVisitId } = await db.collection("visits").insertOne({ patientId: realUserId });

  const plan = await buildCleanupPlan(db);
  const planDigest = calculatePlanDigest("replica_cleanup_test", plan);
  const backup = await createDatabaseBackup(db, demoEncryptionKey);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "neuroscan-cleanup-replset-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "backup.enc.json");
  const backupFile = Buffer.from(JSON.stringify(backup));
  await fs.writeFile(filePath, backupFile);

  const result = await runCleanup({
    mongoUri: withDatabaseName(server.getUri(), "replica_cleanup_test"),
    env: {
      NODE_ENV: "test",
      SEED_CLEANUP_APPLY: "true",
      SEED_CLEANUP_CONFIRM_DB: "replica_cleanup_test",
      SEED_CLEANUP_CONFIRMATION: `DELETE_SEED_DEMO_DATA:${planDigest}`,
      SEED_CLEANUP_BACKUP_FILE: filePath,
      SEED_CLEANUP_BACKUP_SHA256: sha256(backupFile),
      SEED_CLEANUP_RESTORE_TEST_CONFIRMED: "true",
      FILE_ENCRYPTION_KEY: demoEncryptionKey,
    },
    log: { log() {} },
    confirm: async (name) => name === "replica_cleanup_test",
  });

  assert.equal(result.applied, true);
  assert.equal(await db.collection("users").countDocuments({ _id: demoUserId }), 0);
  assert.equal(await db.collection("visits").countDocuments({ _id: demoVisitId }), 0);
  assert.equal(await db.collection("users").countDocuments({ _id: realUserId }), 1);
  assert.equal(await db.collection("visits").countDocuments({ _id: realVisitId }), 1);
});
