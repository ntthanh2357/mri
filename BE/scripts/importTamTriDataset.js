import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import { Hospital } from "../src/models/hospital.model.js";
import { User } from "../src/models/user.model.js";
import { DicomStudy } from "../src/modules/imaging/models/dicomStudy.model.js";
import { DicomSeries } from "../src/modules/imaging/models/dicomSeries.model.js";
import { ImagingResult } from "../src/modules/imaging/models/imagingResult.model.js";
import storageService from "../src/services/storage/storageService.js";
import { cleanSequenceName } from "../src/utils/cryptoStorage.util.js";
import { cleanPatientSlug } from "../src/services/storage/localAdapter.js";

/**
 * Script Ingest bộ dữ liệu MRI thực tế từ Bệnh viện Đa khoa Tâm Trí (dataTAMTRI)
 * Chuẩn hóa lưu trữ Local-First PACS + Encrypted Drive Mirror
 *
 * Cấu trúc thư mục được tạo:
 *   D:\neuroscan_storage\pacs\{yyyy}\{mm}\study_{Accession}_{Patient_Name}\
 *     ├── key_slice_tumor.jpg     (Ảnh cắt lớp thật 100%, mở được ngay trên Windows Photo)
 *     ├── patient_info.json       (Hồ sơ chi tiết ca bệnh & chẩn đoán)
 *     ├── dicom_raw.zip           (Bản nén toàn bộ chuỗi xung thô)
 *     └── sequences\              (Các chuỗi xung MRI thực tế với các lát cắt thật)
 *           ├── T2_FLAIR_axial\
 *           ├── DWI_b1000\
 *           ├── ADC_map\
 *           └── TOF_MRA_axial\
 */

const findTamTriDataDir = () => {
  const possiblePaths = [
    process.env.DATA_TAMTRI_DIR,
    path.resolve(process.cwd(), "../dataTAMTRI/dataTAMTRI"),
    path.resolve(process.cwd(), "../dataTAMTRI"),
    path.resolve(process.cwd(), "dataTAMTRI/dataTAMTRI"),
    path.resolve(process.cwd(), "dataTAMTRI"),
    "C:/Users/Administrator/OneDrive/Desktop/team5/dataTAMTRI/dataTAMTRI",
    "C:/Users/Administrator/OneDrive/Desktop/team5/dataTAMTRI",
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      const items = fs.readdirSync(p);
      if (items.some((i) => /u mang nao|u nao di can|u than kinh dem/i.test(i))) {
        return p;
      }
      if (items.includes("dataTAMTRI")) {
        const nested = path.join(p, "dataTAMTRI");
        if (fs.existsSync(nested)) return nested;
      }
    }
  }
  return null;
};

const mapFolderToDiagnosis = (folderName) => {
  const lower = folderName.toLowerCase();
  if (lower.includes("mang nao")) {
    return {
      vietnameseName: "U màng não",
      englishName: "Meningioma",
      finding: "Ghi nhận khối tổn thương ngoài trục vùng màng não, ngấm thuốc đối quang từ mạnh, có dấu hiệu dural tail (đuôi màng cứng).",
      conclusion: "Hình ảnh điển hình U màng não (Meningioma). Đề nghị hội chẩn Phẫu thuật Thần kinh.",
    };
  }
  if (lower.includes("di can")) {
    return {
      vietnameseName: "U não di căn",
      englishName: "Brain Metastasis",
      finding: "Ghi nhận nhiều nốt ngấm thuốc rải rác vùng ranh giới chất xám - chất trắng, phù não rộng quanh tổn thương.",
      conclusion: "Nhiều ổ tổn thương thứ phát vùng bán cầu não, gợi ý U não di căn (Metastasis).",
    };
  }
  if (lower.includes("than kinh dem")) {
    return {
      vietnameseName: "U thần kinh đệm",
      englishName: "Glioma",
      finding: "Khối choán chỗ trong trục xâm lấn chất trắng, giảm tín hiệu trên T1, tăng tín hiệu không đồng nhất trên T2/FLAIR.",
      conclusion: "Tổn thương u trong trục bán cầu não nghĩ nhiều đến U thần kinh đệm (Glioma).",
    };
  }
  if (lower.includes("tuyen uyen") || lower.includes("tuyen yen")) {
    return {
      vietnameseName: "U tuyến yên",
      englishName: "Pituitary Adenoma",
      finding: "Hố yên giãn rộng, khối tổn thương tuyến yên phát triển chèn ép giao thoa thị giác phía trên.",
      conclusion: "U tuyến yên (Pituitary Adenoma). Cần làm thêm bilan nội tiết.",
    };
  }
  return {
    vietnameseName: "Khối u não",
    englishName: "Brain Tumor",
    finding: "Khối tổn thương choán chỗ vùng sọ não.",
    conclusion: "Theo dõi tổn thương choán chỗ sọ não.",
  };
};

const mapSequenceToSeriesType = (cleanSeq) => {
  if (cleanSeq.includes("FLAIR")) return "T2_FLAIR";
  if (cleanSeq.includes("DWI")) return "DWI";
  if (cleanSeq.includes("ADC")) return "ADC";
  if (cleanSeq.includes("TOF")) return "TOF_MRA";
  if (cleanSeq.includes("coronal")) return "T2_CORONAL";
  if (cleanSeq.includes("T1")) return "AX_T1_FLAIR";
  return "OTHER";
};

async function getOrCreateHospital() {
  let hospital = await Hospital.findOne({ name: /Tâm Trí/i });
  if (!hospital) {
    hospital = await Hospital.create({
      name: "Bệnh viện Đa khoa Tâm Trí Đà Nẵng",
      code: "TAMTRI_DANANG",
      address: "64 Cách Mạng Tháng 8, P. Khuê Trung, Q. Cẩm Lệ, TP. Đà Nẵng",
      phone: "02363679555",
      email: "contact.dn@tamtrangroup.vn",
      subFolders: {
        originalScansId: "tamtri_drive_scans",
        aiPredictionsId: "tamtri_drive_ai",
        doctorRevisionsId: "tamtri_drive_revisions",
        patientReportsId: "tamtri_drive_reports",
        metadataBackupsId: "tamtri_drive_backups",
      },
    });
    console.log(`🏥 Đã khởi tạo bản ghi Bệnh viện: ${hospital.name}`);
  }
  return hospital;
}

async function getOrCreatePatientUser(patientName, hospitalId) {
  const cleanName = patientName.trim();
  const slug = cleanPatientSlug(cleanName).toLowerCase();
  const email = `patient.${slug}@tamtri.vn`;

  let user = await User.findOne({ "profile.name": cleanName });
  if (!user) {
    const passwordHash = await bcrypt.hash("TamTri@2026!", 10);
    user = await User.create({
      email,
      passwordHash,
      role: "patient",
      hospitalId,
      profile: {
        name: cleanName,
        phone: "090" + Math.floor(1000000 + Math.random() * 9000000),
        gender: "Nữ",
        medicalId: `TT-${Math.floor(100000 + Math.random() * 900000)}`,
        address: "Đà Nẵng",
      },
    });
  }
  return user;
}

// Kiểm tra xem Buffer có phải là ảnh JPEG hoặc PNG hợp lệ không
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 100) return false;
  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  return false;
}

async function main() {
  console.log("===============================================================================");
  console.log("🏥 BẮT ĐẦU INGESTION DỮ LIỆU MRI TỪ BỆNH VIỆN ĐA KHOA TÂM TRÍ VÀO PACS LOCAL ");
  console.log("===============================================================================\n");

  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const isAll = args.includes("--all");
  // Mặc định nạp 5 ca tiêu biểu (bao gồm Nguyễn Thị Đậu, Lê Thị Diện, Bùi Thị Mỹ Nga, Huỳnh Thị Nga, Bùi Thị Diệu My)
  const limit = isAll ? 9999 : limitArg ? parseInt(limitArg.split("=")[1], 10) : 5;

  const datasetRoot = findTamTriDataDir();
  if (!datasetRoot) {
    console.error("❌ Không tìm thấy thư mục dataTAMTRI trên máy chủ!");
    process.exit(1);
  }

  console.log(`📁 Thư mục nguồn dữ liệu: ${datasetRoot}`);
  console.log(`⚙️ Cấu hình: Limit=${limit}, DryRun=${isDryRun ? "BẬT" : "TẮT"}\n`);

  await connectDB();
  const hospital = await getOrCreateHospital();

  // 1. Quét các danh mục bệnh u (4 nhóm u lâm sàng chuẩn xác, loại trừ folder Archive trùng lặp)
  const priorityFolders = ["u mang nao", "u than kinh dem", "u nao di can", "u tuyen uyen"];
  const categories = fs
    .readdirSync(datasetRoot)
    .filter((f) => fs.statSync(path.join(datasetRoot, f)).isDirectory() && !f.startsWith(".") && !f.toLowerCase().includes("archive"))
    .sort((a, b) => {
      const aP = priorityFolders.findIndex((p) => a.toLowerCase().includes(p));
      const bP = priorityFolders.findIndex((p) => b.toLowerCase().includes(p));
      if (aP !== -1 && bP !== -1) return aP - bP;
      if (aP !== -1) return -1;
      if (bP !== -1) return 1;
      return 0;
    });

  let totalImportedStudies = 0;
  const maxPerCat = isAll ? 999 : 2; // Mỗi nhóm bệnh lấy 2 ca tiêu biểu để bao phủ toàn bộ 4 loại u

  for (const catName of categories) {
    const catPath = path.join(datasetRoot, catName);
    const diagnosisInfo = mapFolderToDiagnosis(catName);

    console.log(`\n📂 ─────────────────────────────────────────────────────────────────────────`);
    console.log(`🔬 Phân loại bệnh: ${diagnosisInfo.vietnameseName} (${diagnosisInfo.englishName})`);
    console.log(`   Đường dẫn: ${catPath}`);

    // Sắp xếp bệnh nhân: ưu tiên Nguyễn Thị Đậu lên đầu trong nhóm u màng não
    const patientFolders = fs
      .readdirSync(catPath)
      .filter((f) => fs.statSync(path.join(catPath, f)).isDirectory() && !f.startsWith("."))
      .sort((a, b) => {
        if (/Nguyen Thi Dau/i.test(a)) return -1;
        if (/Nguyen Thi Dau/i.test(b)) return 1;
        return a.localeCompare(b);
      });

    let catCount = 0;
    for (const patFolder of patientFolders) {
      if (catCount >= maxPerCat) break;

      const patPath = path.join(catPath, patFolder);
      const patientName = patFolder.trim();

      // Quét các ca chụp (Study / So__997 hoặc Chup_MRI__9924)
      const studyFolders = fs
        .readdirSync(patPath)
        .filter((f) => fs.statSync(path.join(patPath, f)).isDirectory() && !f.startsWith("."));

      for (const stFolder of studyFolders) {
        if (catCount >= maxPerCat) break;

        const studyPath = path.join(patPath, stFolder);
        const matchDigits = stFolder.match(/\d+$/);
        const rawAccession = matchDigits ? matchDigits[0] : stFolder.replace(/^So_+/i, "");
        const studyId = `TAMTRI_${rawAccession}`;

        // Kiểm tra nếu Study đã được import trước đó thì bỏ qua để tiết kiệm thời gian
        const alreadyExists = await DicomStudy.findOne({ accessionNumber: studyId });
        if (alreadyExists) {
          console.log(`  ℹ️ Study ${studyId} (${patientName}) đã tồn tại trong CSDL PACS, bỏ qua.`);
          catCount++;
          totalImportedStudies++;
          continue;
        }

        console.log(`\n  👤 Bệnh nhân: ${patientName}`);
        console.log(`  🆔 Study ID: ${studyId} (Thư mục gốc: ${stFolder})`);

        // Tìm tất cả các sequence folders
        const seqFolders = fs
          .readdirSync(studyPath)
          .filter((f) => fs.statSync(path.join(studyPath, f)).isDirectory());

        console.log(`  📊 Tìm thấy ${seqFolders.length} chuỗi xung MRI thực tế:`);

        let bestKeySliceBuffer = null;
        let bestKeySliceName = null;
        const processedSeriesList = [];

        for (const seqFolder of seqFolders) {
          const rawSeqPath = path.join(studyPath, seqFolder);
          const cleanSeq = cleanSequenceName(seqFolder);
          const sliceFiles = fs
            .readdirSync(rawSeqPath)
            .filter((f) => /\.(jpg|jpeg|png|dcm)$/i.test(f))
            .sort();

          console.log(`     • [${cleanSeq}] (${sliceFiles.length} lát cắt) ← ${seqFolder}`);

          // Chọn key slice từ chuỗi T2 FLAIR hoặc DWI (chọn slice ở giữa ca chụp để thấy u rõ nhất)
          if (
            (!bestKeySliceBuffer || cleanSeq.includes("FLAIR")) &&
            sliceFiles.length > 0 &&
            (cleanSeq.includes("FLAIR") || cleanSeq.includes("DWI") || cleanSeq.includes("T2"))
          ) {
            const midIndex = Math.floor(sliceFiles.length / 2);
            const candidateFile = sliceFiles[midIndex] || sliceFiles[0];
            const candidatePath = path.join(rawSeqPath, candidateFile);
            const candidateBuf = fs.readFileSync(candidatePath);

            // Xác thực buffer là ảnh JPEG/PNG thật 100%
            if (isValidImageBuffer(candidateBuf)) {
              bestKeySliceBuffer = candidateBuf;
              bestKeySliceName = candidateFile;
            }
          }

          processedSeriesList.push({
            rawFolder: seqFolder,
            cleanSeq,
            sliceFiles,
            rawSeqPath,
          });
        }

        // Nếu chưa tìm thấy key slice từ FLAIR thì lấy bất kỳ ảnh đầu tiên hợp lệ
        if (!bestKeySliceBuffer) {
          for (const s of processedSeriesList) {
            for (const f of s.sliceFiles) {
              const buf = fs.readFileSync(path.join(s.rawSeqPath, f));
              if (isValidImageBuffer(buf)) {
                bestKeySliceBuffer = buf;
                bestKeySliceName = f;
                break;
              }
            }
            if (bestKeySliceBuffer) break;
          }
        }

        if (isDryRun) {
          console.log(`  [DRY RUN] Đã phân tích xong Study ${studyId}, bỏ qua bước ghi.`);
          totalImportedStudies++;
          continue;
        }

        // 2. Thực hiện Import thực tế
        console.log(`  ⚡ Đang chuẩn hóa và lưu trữ vào Hệ thống PACS Local-First (kèm Tên Bệnh Nhân)...`);

        const patientUser = await getOrCreatePatientUser(patientName, hospital._id);

        // a) Lưu file thông tin ca bệnh patient_info.json ngay trong thư mục study
        const patientMetadata = {
          hospital: hospital.name,
          studyId,
          accessionNumber: rawAccession,
          patientName,
          gender: patientUser.profile?.gender || "Nữ",
          birthYear: 1968,
          diagnosisGroup: `${diagnosisInfo.vietnameseName} (${diagnosisInfo.englishName})`,
          procedure: "Chụp cộng hưởng từ sọ não có tiêm đối quang từ (MRI Não)",
          findings: diagnosisInfo.finding,
          conclusion: diagnosisInfo.conclusion,
          radiologist: "BS. CKI Bệnh viện Tâm Trí",
          studyDate: new Date().toISOString().split("T")[0],
          totalSequences: processedSeriesList.length,
          totalSlices: processedSeriesList.reduce((acc, s) => acc + s.sliceFiles.length, 0),
          sequences: processedSeriesList.map((s) => ({
            name: s.cleanSeq,
            originalFolder: s.rawFolder,
            slicesCount: s.sliceFiles.length,
          })),
        };

        await storageService.put({
          category: "pacs",
          studyId,
          patientName,
          fileName: "patient_info.json",
          buffer: Buffer.from(JSON.stringify(patientMetadata, null, 2), "utf-8"),
          mimeType: "application/json",
          patientId: patientUser._id,
        });

        // b) Lưu Key Slice đại diện (Ảnh JPEG THẬT 100%, mở trực tiếp trên Windows)
        let savedKeySlice = null;
        if (bestKeySliceBuffer) {
          savedKeySlice = await storageService.put({
            category: "pacs",
            studyId,
            patientName,
            fileName: "key_slice_tumor.jpg",
            buffer: bestKeySliceBuffer,
            mimeType: "image/jpeg",
            patientId: patientUser._id,
            uploadedBy: null,
          });
          console.log(`  ✅ Đã lưu Key Slice THẬT: ${savedKeySlice.logicalPath} (${(savedKeySlice.sizeBytes / 1024).toFixed(1)} KB)`);
        }

        // c) Đóng gói nén dicom_raw.zip (Bản sao lưu nén toàn bộ chuỗi xung)
        let savedRawZip = null;
        try {
          const tempZipPath = path.join(os.tmpdir(), `dicom_raw_${studyId}_${Date.now()}.zip`);
          const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${studyPath}/*' -DestinationPath '${tempZipPath}' -Force"`;
          execSync(psCommand, { stdio: "ignore" });

          if (fs.existsSync(tempZipPath)) {
            const zipBuffer = fs.readFileSync(tempZipPath);
            savedRawZip = await storageService.put({
              category: "pacs",
              studyId,
              patientName,
              fileName: "dicom_raw.zip",
              buffer: zipBuffer,
              mimeType: "application/zip",
              patientId: patientUser._id,
            });
            fs.unlinkSync(tempZipPath);
            console.log(`  ✅ Đã nén và lưu trữ dicom_raw.zip (${(savedRawZip.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
          }
        } catch (zipErr) {
          console.warn(`  ⚠️ Không thể nén dicom_raw.zip tự động:`, zipErr.message);
        }

        // d) Lưu các lát cắt thực tế vào thư mục sequences/
        const pacsStudyFolderPath = path.dirname(savedKeySlice ? savedKeySlice.logicalPath : `pacs/2026/10/study_${studyId}_${cleanPatientSlug(patientName)}/key_slice_tumor.jpg`);

        const dicomStudy = await DicomStudy.create({
          hospitalId: hospital._id,
          patientId: patientUser._id,
          visitId: new mongoose.Types.ObjectId(),
          studyDate: new Date(),
          studyUID: `1.2.840.113619.2.TAMTRI.${rawAccession}`,
          accessionNumber: studyId,
          imagingType: "MRI",
          description: `MRI Sọ não (${diagnosisInfo.vietnameseName}) - ${patientName}`,
          seriesCount: processedSeriesList.length,
          totalSlices: processedSeriesList.reduce((acc, s) => acc + s.sliceFiles.length, 0),
          pacsFolderPath: pacsStudyFolderPath,
          keySliceFileId: savedKeySlice?.fileId || null,
          rawZipFileId: savedRawZip?.fileId || null,
          status: "upload_complete",
          validatedAt: new Date(),
        });

        for (const seriesItem of processedSeriesList) {
          const seriesRecord = await DicomSeries.create({
            studyId: dicomStudy._id,
            hospitalId: hospital._id,
            seriesType: mapSequenceToSeriesType(seriesItem.cleanSeq),
            seriesUID: `1.2.840.113619.2.TAMTRI.${rawAccession}.${seriesItem.cleanSeq}`,
            seriesDescription: seriesItem.rawFolder,
            sliceCount: seriesItem.sliceFiles.length,
            storageFolder: `${pacsStudyFolderPath}/sequences/${seriesItem.cleanSeq}`,
            uploadStatus: "completed",
          });

          // Lưu tối đa 3 lát cắt thật để kiểm thử và mở xem trên Windows
          const sampleSlices = seriesItem.sliceFiles.slice(0, 3);
          for (const sliceFile of sampleSlices) {
            const sliceBuf = fs.readFileSync(path.join(seriesItem.rawSeqPath, sliceFile));
            const savedSlice = await storageService.put({
              category: "sequence_slice",
              studyId,
              patientName,
              sequenceName: seriesItem.cleanSeq,
              fileName: sliceFile,
              buffer: sliceBuf,
              mimeType: sliceFile.endsWith(".png") ? "image/png" : "image/jpeg",
              syncToDrive: false,
            });
            seriesRecord.sliceFileIds.push(savedSlice.fileId);
          }
          await seriesRecord.save();
        }

        // e) Tạo bản ghi ImagingResult kết nối kết quả khám
        const imagingResult = await ImagingResult.create({
          hospitalId: hospital._id,
          medicalId: studyId,
          patientName,
          birthYear: 1968,
          gender: "Nữ",
          address: "Đà Nẵng",
          orderDate: new Date(),
          orderingDoctor: "BS. CKI Bệnh viện Tâm Trí",
          orderingDepartment: "Khoa Chẩn đoán Hình ảnh",
          procedure: "Chụp cộng hưởng từ sọ não có tiêm đối quang từ (MRI Não)",
          technique: "Khảo sát trên các chuỗi xung T1, T2, T2 FLAIR, DWI, ADC, TOF-MRA sọ não.",
          findings: diagnosisInfo.finding,
          conclusion: diagnosisInfo.conclusion,
          radiologist: "BS. CKI Bệnh viện Tâm Trí",
          reportDate: new Date(),
          imagingType: "MRI",
          studyId: dicomStudy._id,
          storageFileId: savedKeySlice?.fileId || null,
          dicomZipFilename: "dicom_raw.zip",
          dicomZipSize: savedRawZip?.sizeBytes || null,
          images: savedKeySlice ? [`/api/v1/storage/files/${savedKeySlice.fileId}`] : [],
        });

        dicomStudy.imagingResultId = imagingResult._id;
        await dicomStudy.save();

        console.log(`  🎉 Ingest thành công Study cho bệnh nhân: "${patientName}".`);
        console.log(`     📁 Thư mục Local: D:\\neuroscan_storage\\${pacsStudyFolderPath.replace(/\//g, "\\")}`);
        console.log(`     🖼️ Key Slice THẬT: /api/v1/storage/files/${savedKeySlice?.fileId}\n`);

        totalImportedStudies++;
        catCount++;
      }
    }
  }

  console.log(`===============================================================================`);
  console.log(`✅ HOÀN TẤT INGESTION: Đã nhập ${totalImportedStudies} ca chụp MRI vào PACS Local!`);
  console.log(`===============================================================================\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Lỗi trong quá trình Ingest bộ dữ liệu Tâm Trí:", err);
  process.exit(1);
});
