import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import mongoose from "mongoose";
import { createDatabaseBackupArtifacts, sha256, verifyDatabaseBackup } from "../src/utils/databaseBackup.util.js";
import { connectLocalTestMongo } from "../src/utils/seedGuard.util.js";
import { uploadEncryptedFile } from "../src/services/storage/driveMirrorAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backupDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;
  const encryptionKey = process.env.FILE_ENCRYPTION_KEY;
  if (!mongoUri) throw new Error("MONGO_URI is required; backup will not fall back to another database.");
  if (!encryptionKey) throw new Error("FILE_ENCRYPTION_KEY is required; refusing to create a backup with a default key.");

  try {
    await connectLocalTestMongo(mongoose, mongoUri);
    const db = mongoose.connection.db;
    const artifacts = await createDatabaseBackupArtifacts(db, encryptionKey);
    const backupRoot = process.env.STORAGE_BACKUP_DIR
      ? path.resolve(process.env.STORAGE_BACKUP_DIR)
      : path.resolve(__dirname, "../secure_backups");
    await fs.mkdir(backupRoot, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runDir = await fs.mkdtemp(path.join(backupRoot, `db_backup_${timestamp}-`));
    const writeVerifiedBackup = async (filePath, backup) => {
      const contents = Buffer.from(JSON.stringify(backup), "utf8");
      const handle = await fs.open(filePath, "wx");
      try {
        await handle.writeFile(contents);
        await handle.sync();
      } finally {
        await handle.close();
      }

      const writtenContents = await fs.readFile(filePath);
      if (!writtenContents.equals(contents)) {
        throw new Error(`Backup file verification failed after writing "${filePath}".`);
      }
      const fileSha256 = sha256(writtenContents);
      const verification = await verifyDatabaseBackup({
        filePath,
        expectedDatabase: db.databaseName,
        expectedSha256: fileSha256,
        encryptionKey,
      });
      return { contents: writtenContents, fileSha256, verification };
    };

    console.log(`Backup run directory: ${runDir}`);
    console.log("Writing and verifying a separate encrypted file for each collection...");
    for (const collectionBackup of artifacts.collectionBackups) {
      const collectionPath = path.join(runDir, collectionBackup.fileName);
      let verification;
      try {
        ({ verification } = await writeVerifiedBackup(collectionPath, collectionBackup.backup));
      } catch (cause) {
        throw new Error(
          `Backup failed for collection "${collectionBackup.name}" at "${collectionPath}": ${cause.message}`,
          { cause },
        );
      }
      console.log(
        `  ${collectionBackup.name}: ${verification.collectionCounts[collectionBackup.name]} documents -> ${collectionPath}`,
      );
    }

    const fileName = "database-full.enc.json";
    const backupPath = path.join(runDir, fileName);
    const { contents, fileSha256, verification } = await writeVerifiedBackup(
      backupPath,
      artifacts.backup,
    );
    console.log(`Verified encrypted backup for database "${verification.database}".`);
    console.log(`File: ${backupPath}`);
    console.log(`SHA-256: ${verification.fileSha256}`);
    console.log("Collections and document counts:");
    for (const [name, count] of Object.entries(verification.collectionCounts)) {
      console.log(`  ${name}: ${count}`);
    }

    try {
      const now = new Date();
      await uploadEncryptedFile(
        contents,
        `backups/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`,
        fileName,
        "application/json"
      );
      console.log("Encrypted backup mirror upload completed.");
    } catch (error) {
      console.warn(`Encrypted backup is verified locally; cloud mirror upload failed: ${error.message}`);
    }
    return verification;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  backupDatabase().catch((error) => {
    console.error(`Database backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
