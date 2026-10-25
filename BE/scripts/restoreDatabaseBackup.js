import "dotenv/config";
import path from "path";
import { pathToFileURL } from "url";
import mongoose from "mongoose";
import { restoreDatabaseBackup } from "../src/utils/databaseBackup.util.js";
import { connectLocalTestMongo } from "../src/utils/seedGuard.util.js";

export const restoreDatabaseToIsolatedTarget = async ({
  targetUri = process.env.DB_RESTORE_URI,
  backupFile = process.env.DB_BACKUP_FILE,
  expectedSha256 = process.env.DB_BACKUP_SHA256,
  encryptionKey = process.env.FILE_ENCRYPTION_KEY,
  isolatedTargetConfirmed = process.env.DB_RESTORE_CONFIRM_ISOLATED,
} = {}) => {
  if (!targetUri) throw new Error("DB_RESTORE_URI is required for the isolated restore target.");
  if (!backupFile || !path.isAbsolute(backupFile)) {
    throw new Error("DB_BACKUP_FILE must be an absolute path to the encrypted backup.");
  }
  if (!expectedSha256 || !encryptionKey) {
    throw new Error("DB_BACKUP_SHA256 and FILE_ENCRYPTION_KEY are required.");
  }
  if (isolatedTargetConfirmed !== "true") {
    throw new Error("Confirm that DB_RESTORE_URI is an isolated, non-production target by setting DB_RESTORE_CONFIRM_ISOLATED=true.");
  }

  try {
    await connectLocalTestMongo(mongoose, targetUri);
    const result = await restoreDatabaseBackup({
      filePath: backupFile,
      expectedSha256,
      encryptionKey,
      targetDb: mongoose.connection.db,
    });
    console.log(`Restore verified from "${result.sourceDatabase}" into isolated database "${result.targetDatabase}".`);
    console.log("Collections, document counts, and indexes verified:");
    for (const [name, count] of Object.entries(result.collectionCounts)) {
      const progress = result.collections[name];
      console.log(
        `  ${name}: restored ${progress.restored}, skipped ${progress.skipped}, failed ${progress.failed}; ` +
        `${count} backup documents; ${result.collectionIndexCounts[name]} indexes`,
      );
    }
    return result;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  restoreDatabaseToIsolatedTarget().catch((error) => {
    console.error(error.message);
    console.error("Isolated database restore failed; inspect the reported collection progress before retrying.");
    process.exitCode = 1;
  });
}
