import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import { decryptBuffer, encryptBuffer } from "./cryptoStorage.util.js";
import { verifyLocalTestDatabase } from "./seedGuard.util.js";

const { EJSON } = mongoose.mongo.BSON;

export const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const collectDatabaseCollections = async (db) => {
  const collections = await db.listCollections().toArray();
  const dump = { collections: [] };

  for (const { name, type, options = {} } of collections) {
    if (name.startsWith("system.")) continue;
    const isView = type === "view";
    const documents = isView ? [] : await db.collection(name).find({}).toArray();
    const indexes = isView ? [] : await db.collection(name).listIndexes().toArray();
    dump.collections.push({ name, type, options, documents, indexes });
  }

  return dump.collections;
};

const createBackupEnvelope = (databaseName, collections, encryptionKey, createdAt) => {
  const dump = { collections };
  const collectionCounts = Object.fromEntries(
    collections.map(({ name, documents }) => [name, documents.length]),
  );
  const collectionIndexCounts = Object.fromEntries(
    collections.map(({ name, indexes }) => [name, indexes.length]),
  );
  const plaintext = Buffer.from(EJSON.stringify(dump, { relaxed: false }), "utf8");
  const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(plaintext, encryptionKey);
  return {
    formatVersion: 3,
    createdAt,
    database: databaseName,
    collectionCounts,
    collectionIndexCounts,
    sizeOriginal: plaintext.length,
    plaintextSha256: sha256(plaintext),
    encryptedSha256: sha256(encryptedBuffer),
    ivHex,
    authTagHex,
    data: encryptedBuffer.toString("base64"),
  };
};

export const createDatabaseBackup = async (db, encryptionKey) => {
  const collections = await collectDatabaseCollections(db);
  return createBackupEnvelope(db.databaseName, collections, encryptionKey, new Date().toISOString());
};

export const createDatabaseBackupArtifacts = async (db, encryptionKey) => {
  const collections = await collectDatabaseCollections(db);
  const createdAt = new Date().toISOString();
  return {
    backup: createBackupEnvelope(db.databaseName, collections, encryptionKey, createdAt),
    collectionBackups: collections.map((collection, index) => ({
      name: collection.name,
      fileName: `collection-${String(index + 1).padStart(4, "0")}-${Buffer.from(collection.name).toString("hex")}.enc.json`,
      backup: createBackupEnvelope(db.databaseName, [collection], encryptionKey, createdAt),
    })),
  };
};

export const verifyDatabaseBackup = async ({
  filePath,
  expectedDatabase,
  expectedSha256,
  encryptionKey,
}) => {
  if (!encryptionKey) throw new Error("FILE_ENCRYPTION_KEY is required to verify the backup.");
  if (!filePath || !expectedSha256) {
    throw new Error("A backup file path and its expected SHA-256 are required.");
  }

  const fileBuffer = await fs.readFile(filePath);
  const actualFileSha256 = sha256(fileBuffer);
  if (actualFileSha256 !== expectedSha256.toLowerCase()) {
    throw new Error("The backup file SHA-256 does not match the supplied value.");
  }

  const envelope = JSON.parse(fileBuffer.toString("utf8"));
  if (
    envelope.formatVersion !== 3 ||
    !envelope.database ||
    !envelope.createdAt ||
    !envelope.ivHex ||
    !envelope.authTagHex ||
    !envelope.data ||
    !envelope.collectionCounts ||
    !envelope.collectionIndexCounts ||
    !Number.isInteger(envelope.sizeOriginal)
  ) {
    throw new Error("The file is not a supported, complete database backup.");
  }
  if (expectedDatabase && envelope.database !== expectedDatabase) {
    throw new Error("The backup database does not match the cleanup target.");
  }

  const encrypted = Buffer.from(envelope.data, "base64");
  if (encrypted.toString("base64") !== envelope.data) {
    throw new Error("The backup data is not valid base64.");
  }
  if (sha256(encrypted) !== envelope.encryptedSha256) {
    throw new Error("The encrypted backup data failed its SHA-256 check.");
  }

  const plaintext = decryptBuffer(
    encrypted,
    envelope.ivHex,
    envelope.authTagHex,
    encryptionKey
  );
  if (plaintext.length !== envelope.sizeOriginal || sha256(plaintext) !== envelope.plaintextSha256) {
    throw new Error("The decrypted backup failed its size or SHA-256 check.");
  }

  const dump = EJSON.parse(plaintext.toString("utf8"));
  if (!Array.isArray(dump.collections)) {
    throw new Error("Backup collection metadata is missing.");
  }
  const dumpCollections = dump.collections.map(({ name }) => name).sort();
  const countCollections = Object.keys(envelope.collectionCounts).sort();
  if (JSON.stringify(dumpCollections) !== JSON.stringify(countCollections)) {
    throw new Error("Backup collection metadata does not match the backup contents.");
  }
  for (const collection of dump.collections) {
    const { name, documents, indexes } = collection;
    if (
      !Array.isArray(documents) ||
      documents.length !== envelope.collectionCounts[name] ||
      !Array.isArray(indexes) ||
      indexes.length !== envelope.collectionIndexCounts[name]
    ) {
      throw new Error(`Backup document count validation failed for collection "${name}".`);
    }
  }

  return {
    fileSha256: actualFileSha256,
    database: envelope.database,
    createdAt: envelope.createdAt,
    collectionCounts: envelope.collectionCounts,
    collectionIndexCounts: envelope.collectionIndexCounts,
  };
};

const indexOptionsFromSpec = ({ ns, v, background, ready, buildUUID, ...index }) => index;
const indexSpecFromOptions = ({ ns, v, background, ready, buildUUID, ...index }) => index;

export const restoreDatabaseBackup = async ({
  filePath,
  expectedSha256,
  encryptionKey,
  targetDb,
}) => {
  const verified = await verifyDatabaseBackup({
    filePath,
    expectedSha256,
    encryptionKey,
  });
  if (!targetDb?.databaseName) throw new Error("A connected, isolated restore database is required.");
  await verifyLocalTestDatabase(targetDb);
  if (targetDb.databaseName === verified.database) {
    throw new Error("Restore target must be a different database from the backup source.");
  }

  const fileBuffer = await fs.readFile(filePath);
  const envelope = JSON.parse(fileBuffer.toString("utf8"));
  const encrypted = Buffer.from(envelope.data, "base64");
  const plaintext = decryptBuffer(encrypted, envelope.ivHex, envelope.authTagHex, encryptionKey);
  const dump = EJSON.parse(plaintext.toString("utf8"));
  const baseCollections = dump.collections.filter(({ type }) => type !== "view");
  const views = dump.collections.filter(({ type }) => type === "view");
  const existingCollections = new Map(
    (await targetDb.listCollections().toArray())
      .filter(({ name }) => !name.startsWith("system."))
      .map((collection) => [collection.name, collection]),
  );
  const progress = Object.fromEntries(
    dump.collections.map(({ name }) => [
      name,
      { restored: 0, skipped: 0, failed: 0 },
    ]),
  );
  let currentCollection = "preflight";
  let currentOperation = "checking collection/document/index conflicts";

  const sameEjson = (left, right) =>
    EJSON.stringify(left, { relaxed: false }) ===
    EJSON.stringify(right, { relaxed: false });

  try {
    for (const entry of dump.collections) {
      currentCollection = entry.name;
      const existing = existingCollections.get(entry.name);
      if (!existing) continue;
      if ((existing.type === "view") !== (entry.type === "view")) {
        throw new Error(`Collection type conflict for "${entry.name}".`);
      }
      if (entry.type === "view") {
        const expectedView = {
          viewOn: entry.options?.viewOn,
          pipeline: entry.options?.pipeline || [],
        };
        const currentView = {
          viewOn: existing.options?.viewOn,
          pipeline: existing.options?.pipeline || [],
        };
        if (!sameEjson(currentView, expectedView)) {
          throw new Error(`View definition conflict for "${entry.name}".`);
        }
        progress[entry.name].skipped = 1;
        continue;
      }
      for (const option of ["validator", "validationLevel", "validationAction", "collation", "capped", "size", "max", "timeseries"]) {
        if (
          entry.options?.[option] !== undefined &&
          !sameEjson(existing.options?.[option], entry.options[option])
        ) {
          throw new Error(`Collection option conflict for "${entry.name}" (${option}).`);
        }
      }

      const documents = entry.documents;
      for (let start = 0; start < documents.length; start += 500) {
        const batch = documents.slice(start, start + 500);
        const current = await targetDb.collection(entry.name)
          .find({ _id: { $in: batch.map(({ _id }) => _id) } })
          .toArray();
        const existingById = new Map(current.map((document) => [
          EJSON.stringify(document._id, { relaxed: false }),
          document,
        ]));
        for (const document of batch) {
          const existingDocument = existingById.get(
            EJSON.stringify(document._id, { relaxed: false }),
          );
          if (!existingDocument) continue;
          if (!sameEjson(existingDocument, document)) {
            throw new Error(
              `Document _id conflict in "${entry.name}"; existing document was preserved.`,
            );
          }
          progress[entry.name].skipped += 1;
        }
      }

      const existingIndexes = await targetDb.collection(entry.name).listIndexes().toArray();
      for (const sourceIndex of entry.indexes) {
        const existingIndex = existingIndexes.find(({ name }) => name === sourceIndex.name);
        if (existingIndex && !sameEjson(
          indexSpecFromOptions(existingIndex),
          indexSpecFromOptions(sourceIndex),
        )) {
          throw new Error(`Index conflict in "${entry.name}" (${sourceIndex.name}).`);
        }
        const sameKeyIndex = existingIndexes.find(({ key }) =>
          sameEjson(key, sourceIndex.key),
        );
        if (sameKeyIndex && sameKeyIndex.name !== sourceIndex.name) {
          throw new Error(
            `Index key conflict in "${entry.name}" (${sameKeyIndex.name} vs ${sourceIndex.name}).`,
          );
        }
      }
    }

    currentOperation = "creating missing collections";
    for (const entry of baseCollections) {
      currentCollection = entry.name;
      if (!existingCollections.has(entry.name)) {
        await targetDb.createCollection(entry.name, entry.options);
        existingCollections.set(entry.name, { name: entry.name, type: "collection", options: entry.options });
      }
    }

    currentOperation = "inserting missing documents";
    for (const entry of baseCollections) {
      currentCollection = entry.name;
      const collection = targetDb.collection(entry.name);
      for (let start = 0; start < entry.documents.length; start += 500) {
        const batch = entry.documents.slice(start, start + 500);
        const current = await collection
          .find({ _id: { $in: batch.map(({ _id }) => _id) } })
          .toArray();
        const existingIds = new Set(current.map(({ _id }) => EJSON.stringify(_id, { relaxed: false })));
        const missing = batch.filter(({ _id }) => !existingIds.has(EJSON.stringify(_id, { relaxed: false })));
        if (!missing.length) continue;
        try {
          const result = await collection.insertMany(missing, { ordered: true });
          progress[entry.name].restored += result.insertedCount;
        } catch (error) {
          progress[entry.name].restored +=
            error.result?.insertedCount || error.result?.result?.nInserted || 0;
          throw error;
        }
      }
    }

    currentOperation = "creating missing indexes";
    for (const entry of baseCollections) {
      currentCollection = entry.name;
      const actualIndexes = await targetDb.collection(entry.name).listIndexes().toArray();
      const actualNames = new Set(actualIndexes.map(({ name }) => name));
      const missingIndexes = entry.indexes
        .filter(({ name }) => !actualNames.has(name) && name !== "_id_")
        .map(indexOptionsFromSpec);
      if (missingIndexes.length) {
        await targetDb.collection(entry.name).createIndexes(missingIndexes);
      }
    }

    currentOperation = "creating missing views";
    for (const entry of views) {
      currentCollection = entry.name;
      if (existingCollections.has(entry.name)) continue;
      await targetDb.createCollection(entry.name, entry.options);
      existingCollections.set(entry.name, { name: entry.name, type: "view", options: entry.options });
      progress[entry.name].restored = 1;
    }

    currentOperation = "verifying restored documents and indexes";
    for (const entry of dump.collections) {
      currentCollection = entry.name;
      if (entry.type === "view") continue;
      const collection = targetDb.collection(entry.name);
      const expectedDocuments = entry.documents;
      for (let start = 0; start < expectedDocuments.length; start += 500) {
        const batch = expectedDocuments.slice(start, start + 500);
        const actual = await collection
          .find({ _id: { $in: batch.map(({ _id }) => _id) } })
          .toArray();
        const actualById = new Map(actual.map((document) => [
          EJSON.stringify(document._id, { relaxed: false }),
          document,
        ]));
        for (const expected of batch) {
          const value = actualById.get(EJSON.stringify(expected._id, { relaxed: false }));
          if (!value || !sameEjson(value, expected)) {
            throw new Error(`Restore verification failed for document _id in "${entry.name}".`);
          }
        }
      }
      const actualIndexes = await collection.listIndexes().toArray();
      const expectedIndexes = entry.indexes.map(indexSpecFromOptions).sort((a, b) => a.name.localeCompare(b.name));
      const actualIndexSpecs = actualIndexes.map(indexSpecFromOptions).sort((a, b) => a.name.localeCompare(b.name));
      for (const index of expectedIndexes) {
        const actual = actualIndexSpecs.find(({ name }) => name === index.name);
        if (!actual || !sameEjson(actual, index)) {
          throw new Error(`Restore verification failed for index "${index.name}" in "${entry.name}".`);
        }
      }
    }
  } catch (cause) {
    if (progress[currentCollection]) progress[currentCollection].failed += 1;
    const error = new Error(
      `Restore failed during ${currentOperation} for collection "${currentCollection}". ` +
      `Progress: ${JSON.stringify(progress)}. Existing documents were not overwritten. ${cause.message}`,
      { cause },
    );
    error.restoreProgress = progress;
    error.collection = currentCollection;
    error.operation = currentOperation;
    throw error;
  }

  return {
    sourceDatabase: verified.database,
    targetDatabase: targetDb.databaseName,
    collections: progress,
    collectionCounts: verified.collectionCounts,
    collectionIndexCounts: verified.collectionIndexCounts,
  };
};
