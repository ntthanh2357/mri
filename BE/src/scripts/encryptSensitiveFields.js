/**
 * [P1-9] Migration: mã hoá dữ liệu định danh nhạy cảm đang lưu plaintext.
 *
 *   1. BhytInfo.cardNumber  → AES-256-GCM + cardNumberHash (HMAC) + cardLast4
 *   2. DataPrivacyConsent.signerNationalId → AES-256-GCM + signerNationalIdLast4
 *
 * An toàn khi chạy lại nhiều lần: bản ghi đã mã hoá được bỏ qua (chỉ bổ sung
 * hash/last4 nếu thiếu).
 *
 * Cách chạy:
 *   node src/scripts/encryptSensitiveFields.js --dry   # xem trước
 *   node src/scripts/encryptSensitiveFields.js         # ghi thật
 *
 * Yêu cầu FIELD_ENCRYPTION_KEY đúng với môi trường đã dùng để mã hoá trước đó;
 * nếu không, script sẽ dừng ngay (fieldCrypto fail-fast ở production).
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { BhytInfo } from "../modules/billing/models/bhytInfo.model.js";
import { DataPrivacyConsent } from "../modules/emr/models/dataPrivacyConsent.model.js";
import {
  encryptField,
  decryptField,
  isEncrypted,
  hashField,
} from "../services/fieldCrypto.service.js";

dotenv.config();

const DRY = process.argv.includes("--dry");
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/neuroscan";

const normalize = (raw) => String(raw || "").replace(/\s/g, "").toUpperCase();

async function migrateBhytCards() {
  const docs = await BhytInfo.find({}).select("cardNumber cardNumberHash cardLast4").lean();
  let encrypted = 0;
  let enriched = 0;
  let unchanged = 0;

  for (const doc of docs) {
    if (!doc.cardNumber) continue;

    if (!isEncrypted(doc.cardNumber)) {
      const plain = normalize(doc.cardNumber);
      const update = {
        cardNumber: encryptField(plain),
        cardNumberHash: hashField(plain, "bhyt-card"),
        cardLast4: plain.slice(-4),
      };
      if (!DRY) await BhytInfo.updateOne({ _id: doc._id }, { $set: update });
      encrypted++;
      continue;
    }

    if (!doc.cardNumberHash || !doc.cardLast4) {
      let plain = "";
      try {
        plain = normalize(decryptField(doc.cardNumber));
      } catch {
        console.warn(`[encryptSensitiveFields] Không giải mã được thẻ ${doc._id} — bỏ qua, cần kiểm tra khoá.`);
        continue;
      }
      const update = {
        cardNumberHash: doc.cardNumberHash || hashField(plain, "bhyt-card"),
        cardLast4: doc.cardLast4 || plain.slice(-4),
      };
      if (!DRY) await BhytInfo.updateOne({ _id: doc._id }, { $set: update });
      enriched++;
      continue;
    }

    unchanged++;
  }

  return { total: docs.length, encrypted, enriched, unchanged };
}

async function migratePrivacyConsents() {
  const docs = await DataPrivacyConsent.find({})
    .select("signerNationalId signerNationalIdLast4")
    .lean();
  let encrypted = 0;
  let enriched = 0;
  let unchanged = 0;

  for (const doc of docs) {
    const raw = String(doc.signerNationalId || "").trim();
    if (!raw) {
      unchanged++;
      continue;
    }

    if (!isEncrypted(raw)) {
      const update = {
        signerNationalId: encryptField(raw),
        signerNationalIdLast4: raw.slice(-4),
      };
      if (!DRY) await DataPrivacyConsent.updateOne({ _id: doc._id }, { $set: update });
      encrypted++;
      continue;
    }

    if (!doc.signerNationalIdLast4) {
      let plain = "";
      try {
        plain = decryptField(raw);
      } catch {
        console.warn(`[encryptSensitiveFields] Không giải mã được CCCD consent ${doc._id} — bỏ qua.`);
        continue;
      }
      if (!DRY) {
        await DataPrivacyConsent.updateOne(
          { _id: doc._id },
          { $set: { signerNationalIdLast4: plain.slice(-4) } }
        );
      }
      enriched++;
      continue;
    }

    unchanged++;
  }

  return { total: docs.length, encrypted, enriched, unchanged };
}

async function main() {
  console.log(`\n[encryptSensitiveFields] Kết nối ${MONGO_URI} ...`);
  await mongoose.connect(MONGO_URI);
  console.log(`[encryptSensitiveFields] Đã kết nối. Chế độ: ${DRY ? "DRY-RUN (không ghi)" : "GHI THẬT"}.\n`);

  const bhyt = await migrateBhytCards();
  console.log("[BhytInfo]", bhyt);

  const consent = await migratePrivacyConsents();
  console.log("[DataPrivacyConsent]", consent);

  if (DRY) {
    console.log("\n[encryptSensitiveFields] DRY-RUN: chưa ghi thay đổi nào. Bỏ --dry để áp dụng.");
  } else {
    console.log("\n[encryptSensitiveFields] Hoàn tất. Nên kiểm tra: không còn bản ghi plaintext trong 2 collection trên.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[encryptSensitiveFields] LỖI:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
