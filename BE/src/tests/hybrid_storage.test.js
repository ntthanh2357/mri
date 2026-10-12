import "dotenv/config";
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  encryptBuffer,
  decryptBuffer,
  computeSha256,
  cleanSequenceName,
} from "../utils/cryptoStorage.util.js";
import {
  buildLogicalPath,
  writeLocalFile,
  createLocalReadStream,
  readLocalBuffer,
  existsOnLocal,
  deleteLocalFile,
  getLocalRoot,
} from "../services/storage/localAdapter.js";

async function runHybridStorageTests() {
  console.log("======================================================================");
  console.log("   HYBRID PACS STORAGE ARCHITECTURE & ENCRYPTION UNIT TESTS           ");
  console.log("======================================================================\n");

  let passed = 0;

  // Test 1: AES-256-GCM Encryption & Decryption
  try {
    const rawData = Buffer.from("Clinical DICOM Study Image - Patient MRN #12345");
    const { encryptedBuffer, ivHex, authTagHex } = encryptBuffer(rawData);

    assert(encryptedBuffer.length > 0, "Dữ liệu mã hóa không được rỗng");
    assert.strictEqual(ivHex.length, 24, "IV phải có độ dài 12 bytes (24 ký tự hex)");
    assert.strictEqual(authTagHex.length, 32, "AuthTag phải có độ dài 16 bytes (32 ký tự hex)");

    // Giải mã
    const decrypted = decryptBuffer(encryptedBuffer, ivHex, authTagHex);
    assert.strictEqual(decrypted.toString(), rawData.toString(), "Dữ liệu sau giải mã phải nguyên vẹn");

    // Thử làm giả 1 byte để kiểm tra phát hiện giả mạo
    const tampered = Buffer.from(encryptedBuffer);
    tampered[0] ^= 0xff; // Đảo bit

    assert.throws(
      () => decryptBuffer(tampered, ivHex, authTagHex),
      /Lỗi giải mã hoặc tệp tin đã bị giả mạo/,
      "Phải phát hiện và từ chối giải mã khi dữ liệu bị sửa đổi"
    );

    console.log("  ✔ PASS 1. Mã hóa AES-256-GCM, giải mã bảo toàn và phát hiện giả mạo toàn vẹn");
    passed++;
  } catch (err) {
    console.error("  ✖ FAIL 1. Mã hóa AES-256-GCM:", err);
  }

  // Test 2: SHA-256 Computation
  try {
    const data = Buffer.from("Hello NeuroScan");
    const hash = computeSha256(data);
    assert.strictEqual(hash.length, 64, "Mã băm SHA-256 phải là 64 ký tự hex");
    console.log("  ✔ PASS 2. Tính toán mã băm SHA-256 đối soát toàn vẹn");
    passed++;
  } catch (err) {
    console.error("  ✖ FAIL 2. Tính SHA-256:", err);
  }

  // Test 3: cleanSequenceName Helper
  try {
    const name1 = cleanSequenceName("3D_Ax_T1_MPRAGE_C+_12");
    assert.strictEqual(name1, "T1_MPRAGE_C+_axial");

    const name2 = cleanSequenceName("Ax_T2_FLAIR_FS_2");
    assert.strictEqual(name2, "T2_FLAIR_axial");

    const name3 = cleanSequenceName("ADC_(10_6_mm┬▓s)_750");
    assert.strictEqual(name3, "ADC_map");

    const name4 = cleanSequenceName("Ax_DWI_ALL_b1000_7");
    assert.strictEqual(name4, "DWI_b1000");

    console.log("  ✔ PASS 3. Chuẩn hóa tên chuỗi xung lâm sàng thực tế (loại bỏ ký tự lỗi font)");
    passed++;
  } catch (err) {
    console.error("  ✖ FAIL 3. Chuẩn hóa tên chuỗi xung:", err);
  }

  // Test 4: Logical Path Generation
  try {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");

    const p1 = buildLogicalPath({
      category: "pacs",
      studyId: "000997",
      fileName: "key_slice.png",
    });
    assert.strictEqual(p1, `pacs/${yyyy}/${mm}/study_000997/key_slice.png`);

    const p2 = buildLogicalPath({
      category: "sequence_slice",
      studyId: "000997",
      sequenceName: "T2_FLAIR_axial",
      fileName: "IM-0001.jpg",
    });
    assert.strictEqual(p2, `pacs/${yyyy}/${mm}/study_000997/sequences/T2_FLAIR_axial/IM-0001.jpg`);

    const p3 = buildLogicalPath({
      category: "report",
      fileName: "report_000997.pdf",
    });
    assert.strictEqual(p3, `reports/${yyyy}/${mm}/report_000997.pdf`);

    console.log("  ✔ PASS 4. Sinh cấu trúc đường dẫn vô danh Study-Centric & Thời gian chuẩn xác");
    passed++;
  } catch (err) {
    console.error("  ✖ FAIL 4. Sinh cấu trúc đường dẫn:", err);
  }

  // Test 5: Local File Lifecycle (Write, Read, Exists, Delete)
  try {
    const testPath = `ai-temp/test_job_123/slice_sample.png`;
    // 1x1 pixel PNG binary hợp lệ
    const payload = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const { localPath, sizeBytes } = await writeLocalFile(testPath, payload);
    assert(existsOnLocal(localPath), "File phải tồn tại sau khi ghi");
    assert.strictEqual(sizeBytes, payload.length);

    const readBack = await readLocalBuffer(localPath);
    assert.strictEqual(readBack.toString(), payload.toString());

    await deleteLocalFile(localPath);
    assert(!existsOnLocal(localPath), "File phải bị xóa hoàn toàn");

    console.log("  ✔ PASS 5. Vòng đời tệp tin cục bộ Local Storage (Ghi, Đọc, Kiểm tra, Xóa) 100% an toàn");
    passed++;
  } catch (err) {
    console.error("  ✖ FAIL 5. Vòng đời tệp tin local:", err);
  }

  console.log("\n======================================================================");
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed}/5 PASSED`);
  console.log("======================================================================\n");

  if (passed === 5) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runHybridStorageTests();
