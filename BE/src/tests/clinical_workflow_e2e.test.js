import mongoose from 'mongoose';
import { Visit } from '../models/visit.model.js';
import { User } from '../models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import { HospitalBed } from '../models/hospitalBed.model.js';
import { ImagingResult } from '../models/imagingResult.model.js';
import { Invoice } from '../models/invoice.model.js';

import {
  createMriOrderService,
  submitMriSafetyCheckService,
  requestMriRescanService
} from '../services/visit.service.js';

import {
  createImagingResultService,
  signAndFinalizeResultService
} from '../services/imaging.service.js';

import {
  reserveBedAtomicService,
  occupyBedAtomicService,
  releaseBedService
} from '../services/hospitalBed.service.js';

describe('E2E Clinical Workflow Test: Quy Trình Bệnh Viện Toàn Diện 10 Bước (NeuroScan AI)', () => {
  let hospitalId;
  let clinicDoctor;
  let radiologistDoctor;
  let technician;
  let patientDoc;
  let bedDoc;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    hospitalId = new mongoose.Types.ObjectId();

    clinicDoctor = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: hospitalId.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. Lâm Sàng Vũ Hoàng Long', department: 'Khoa Ngoại Thần Kinh' }
    };

    radiologistDoctor = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: hospitalId.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. CĐHA Đỗ Thúy Hằng', department: 'Khoa Chẩn Đoán Hình Ảnh' }
    };

    technician = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: hospitalId.toString(),
      role: 'technician',
      profile: { fullName: 'KTV. Nguyễn Đức Trung' }
    };
  });

  afterAll(async () => {
    await User.deleteMany({ hospitalId });
    await Visit.deleteMany({ hospitalId });
    await HospitalBed.deleteMany({ hospitalId });
    await ImagingResult.deleteMany({ hospitalId });
    await Invoice.deleteMany({ hospitalId });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('Kịch bản luồng lâm sàng 10 bước khép kín từ tiếp đón, chỉ định MRI, ký số CĐHA đến nhập viện giường bệnh', async () => {
    // -------------------------------------------------------------
    // BƯỚC 1: Tiếp đón bệnh nhân & Khởi tạo hồ sơ bệnh án
    // -------------------------------------------------------------
    patientDoc = new User({
      hospitalId,
      role: 'patient',
      email: 'toan.nguyen.e2e@neuroscan.vn',
      passwordHash: 'dummy_hash_123',
      profile: {
        medicalId: 'BN-E2E-2026',
        fullName: 'Nguyễn Văn Toàn',
        name: 'Nguyễn Văn Toàn',
        gender: 'Nam',
        birthYear: 1990,
        phone: '0988776655',
        address: 'Hà Nội'
      }
    });
    await patientDoc.save();
    expect(patientDoc._id).toBeDefined();

    const visit = new Visit({
      hospitalId,
      patientId: patientDoc._id,
      doctorId: clinicDoctor.id,
      status: 'đang khám',
      reason: 'Đau đầu dữ dội kèm buồn nôn kéo dài'
    });
    await visit.save();
    expect(visit.status).toBe('đang khám');

    // -------------------------------------------------------------
    // BƯỚC 2: Khám lâm sàng & Bác sĩ lâm sàng chỉ định chụp MRI
    // -------------------------------------------------------------
    const updatedVisit = await createMriOrderService({
      visitId: visit._id,
      hospitalId,
      userId: clinicDoctor.id,
      region: 'Sọ não đa xung T1W, T2W, FLAIR',
      instructions: 'Nghi ngờ khối u choán chỗ nội sọ',
      requestAiAnalysis: true
    });

    expect(updatedVisit.status).toBe('chờ chụp');
    expect(updatedVisit.mriOrder.requestAiAnalysis).toBe(true);
    expect(updatedVisit.invoiceId).toBeDefined();

    const invoice = await Invoice.findById(updatedVisit.invoiceId);
    expect(invoice).toBeDefined();
    expect(invoice.totalAmount).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // BƯỚC 3: KTV thực hiện Checklist an toàn MRI (An toàn phòng từ trường)
    // -------------------------------------------------------------
    const safetyCheck = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId,
      user: technician,
      checklistData: {
        hasPacemakerOrMetal: false,
        hasClaustrophobia: false,
        hasKidneyDisease: false,
        isPregnant: false,
        passed: true,
        notes: 'Đã tháo toàn bộ vật dụng kim loại tư trang'
      }
    });

    expect(safetyCheck.visit.status).toBe('đang chụp');
    expect(safetyCheck.checklist.isScreened).toBe(true);
    expect(safetyCheck.checklist.screenedBy).toBe(technician.profile.fullName);

    // -------------------------------------------------------------
    // BƯỚC 4: Xử lý ngoại lệ lâm sàng - Bệnh nhân cử động gây nhòe -> Yêu cầu chụp lại
    // -------------------------------------------------------------
    const rescanVisit = await requestMriRescanService({
      visitId: visit._id,
      hospitalId,
      user: technician,
      reason: 'Cử động nhẹ ở xung FLAIR cần chụp bổ sung'
    });
    expect(rescanVisit.status).toBe('chờ chụp lại');

    // KTV cho chụp lại hoàn tất -> chuyển lại sang đang chụp
    rescanVisit.status = 'đang chụp';
    await rescanVisit.save();

    // -------------------------------------------------------------
    // BƯỚC 5: KTV đẩy ảnh lát cắt và Dicom Zip lên hệ thống (Tạo ImagingResult)
    // -------------------------------------------------------------
    const imagingResult = await createImagingResultService({
      hospitalId,
      user: technician,
      body: {
        medicalId: patientDoc.profile.medicalId,
        patientName: patientDoc.profile.fullName,
        birthYear: 1990,
        gender: 'Nam',
        address: 'Hà Nội',
        orderDate: new Date().toISOString(),
        orderingDoctor: clinicDoctor.profile.fullName,
        orderingDepartment: clinicDoctor.profile.department,
        diagnosis: 'Nghi khối choán chỗ nội sọ',
        procedure: 'Chụp MRI Sọ Não Đa Xung',
        findings: 'Tổn thương tăng tín hiệu trên T2/FLAIR tại vùng thùy trán phải kích thước 22x28mm',
        conclusion: 'Nghi ngờ Glioma độ thấp',
        radiologist: 'Chờ BS CĐHA thẩm định',
        reportDate: new Date().toISOString(),
        imagingType: 'MRI',
        images: ['https://storage.neuroscan.vn/slices/slice_12.jpg'],
        dicomZipUrl: 'https://storage.neuroscan.vn/dicom/series_001.zip',
        visitId: visit._id.toString()
      }
    });

    expect(imagingResult.isSigned).toBe(false);
    expect(imagingResult.dicomZipUrl).toBeDefined();

    // Ca khám chuyển sang "chờ kết quả AI"
    const aiPendingVisit = await Visit.findById(visit._id);
    expect(aiPendingVisit.status).toBe('chờ kết quả AI');

    // -------------------------------------------------------------
    // BƯỚC 6: AI FastAPI phát hiện vùng u não (Cập nhật kết quả AI)
    // -------------------------------------------------------------
    imagingResult.aiResult = {
      detected: true,
      tumorType: 'Glioma',
      confidence: 0.94,
      boundingBoxes: [{ x: 120, y: 80, width: 45, height: 50, label: 'Glioma' }],
      heatmapUrl: 'https://storage.neuroscan.vn/heatmaps/heatmap_12.png',
      analyzedAt: new Date()
    };
    await imagingResult.save();

    aiPendingVisit.status = 'chờ bác sĩ đọc';
    await aiPendingVisit.save();

    // -------------------------------------------------------------
    // BƯỚC 7: Bác sĩ CĐHA thẩm định độc lập & Đóng dấu KÝ SỐ ĐIỆN TỬ
    // -------------------------------------------------------------
    const signedResult = await signAndFinalizeResultService({
      resultId: imagingResult._id,
      hospitalId,
      user: radiologistDoctor,
      updateData: {
        technique: 'MRI 1.5 Tesla không tiêm thuốc đối quang',
        conclusion: 'Hình ảnh u tế bào thần kinh đệm (Low-grade Glioma) thùy trán phải - Ký số xác nhận'
      }
    });

    expect(signedResult.isSigned).toBe(true);
    expect(signedResult.radiologist).toBe(radiologistDoctor.profile.fullName);
    expect(signedResult.signedByDoctorId.toString()).toBe(radiologistDoctor.id.toString());
    expect(signedResult.signedAt).toBeDefined();

    // Ca khám hoàn tất đọc kết quả
    const finalizedVisit = await Visit.findById(visit._id);
    expect(finalizedVisit.status).toBe('hoàn tất');

    // -------------------------------------------------------------
    // BƯỚC 8: Bác sĩ lâm sàng chỉ định nhập viện & Giữ chỗ giường nguyên tử
    // -------------------------------------------------------------
    bedDoc = new HospitalBed({
      hospitalId,
      departmentId: 'KHOA_NGOAI_TK',
      departmentName: 'Khoa Ngoại Thần Kinh',
      bedNumber: 'GIUONG-VIP-01',
      roomNumber: 'PHONG-302',
      status: 'available'
    });
    await bedDoc.save();

    const reservedBed = await reserveBedAtomicService({
      bedId: bedDoc._id,
      hospitalId,
      user: clinicDoctor,
      reserveData: {
        visitId: visit._id,
        patientId: patientDoc._id,
        holdHours: 4
      }
    });

    expect(reservedBed.status).toBe('reserved');
    expect(reservedBed.reservedForPatientId.toString()).toBe(patientDoc._id.toString());

    // -------------------------------------------------------------
    // BƯỚC 9: Bệnh nhân nhận giường (Atomic Occupy)
    // -------------------------------------------------------------
    const occupiedBed = await occupyBedAtomicService({
      bedId: bedDoc._id,
      hospitalId,
      user: clinicDoctor,
      occupyData: {
        visitId: visit._id,
        patientId: patientDoc._id,
        diagnosis: 'U não thùy trán P chờ phẫu thuật'
      }
    });

    expect(occupiedBed.status).toBe('occupied');
    expect(occupiedBed.currentPatientId.toString()).toBe(patientDoc._id.toString());

    // -------------------------------------------------------------
    // BƯỚC 10: Ra viện & Giải phóng giường chuyển sang trạng thái Khử khuẩn
    // -------------------------------------------------------------
    const releasedBed = await releaseBedService({
      bedId: bedDoc._id,
      hospitalId,
      user: clinicDoctor,
      releaseData: { toCleaning: true }
    });

    expect(releasedBed.status).toBe('cleaning');
    expect(releasedBed.currentPatientId).toBeNull();
    expect(releasedBed.occupiedAt).toBeNull();
  });
});
