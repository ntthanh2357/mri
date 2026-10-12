import mongoose from 'mongoose';
import { TransferForm } from '../models/transferForm.model.js';
import { User } from '../models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import { ImagingResult } from '../models/imagingResult.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { Notification } from '../models/notification.model.js';
import {
  createTransferRequest,
  sendTransferEmail,
  getTransfers,
  getTransferById
} from '../controllers/transfer.controller.js';

describe('Unit & Integration Tests: Gói Chuyển Viện Thông Minh & Gửi Email Bệnh Nhân (UC-DOC-10)', () => {
  let hospital;
  let doctorUser;
  let receptionistUser;
  let nurseUser;
  let patientUser;
  let imagingResult;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // 1. Tạo bệnh viện test
    hospital = await Hospital.create({
      name: 'Bệnh Viện Chuyên Khoa Ung Thư Não NeuroScan',
      code: 'HOSP_TRANSFER_TEST_' + Date.now(),
      address: '123 Hải Phòng, Đà Nẵng',
      isActive: true,
    });

    // 2. Tạo Bác sĩ
    doctorUser = await User.create({
      email: `doctor_${Date.now()}@hospital.vn`,
      passwordHash: '$2a$10$abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      role: 'doctor',
      hospitalId: hospital._id,
      profile: { name: 'BS. Lê Văn Trọng', specialty: 'Ngoại thần kinh' }
    });

    // 3. Tạo Lễ tân
    receptionistUser = await User.create({
      email: `receptionist_${Date.now()}@hospital.vn`,
      passwordHash: '$2a$10$abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      role: 'receptionist',
      hospitalId: hospital._id,
      profile: { name: 'Nguyễn Thị Thu Lễ Tân' }
    });

    // 4. Tạo Điều dưỡng (không có quyền tạo gói)
    nurseUser = await User.create({
      email: `nurse_${Date.now()}@hospital.vn`,
      passwordHash: '$2a$10$abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      role: 'nurse',
      hospitalId: hospital._id,
      profile: { name: 'Điều dưỡng Mai' }
    });

    // 5. Tạo Bệnh nhân
    patientUser = await User.create({
      email: 'benhnhan.unao.test@gmail.com',
      passwordHash: '$2a$10$abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      role: 'patient',
      hospitalId: hospital._id,
      profile: {
        name: 'Hoàng Văn Bệnh Nhân',
        fullName: 'Hoàng Văn Bệnh Nhân',
        medicalId: 'BN-TEST-' + Date.now().toString().slice(-4),
        phone: '0905123456',
        gender: 'Nam',
        dob: new Date('1985-05-15')
      }
    });

    // 6. Tạo kết quả chụp MRI có đầy đủ DICOM, AI Report, 3D model
    imagingResult = await ImagingResult.create({
      hospitalId: hospital._id,
      medicalId: patientUser.profile.medicalId,
      patientName: patientUser.profile.fullName,
      gender: 'Nam',
      orderDate: new Date(),
      reportDate: new Date(),
      procedure: 'Chụp cộng hưởng từ sọ não có tiêm đối quang từ',
      findings: 'Khối choán chỗ vùng thái dương trái kích thước 4.2 x 3.8 cm, phù não diện rộng.',
      conclusion: 'U tế bào thần kinh đệm độ cao (High-grade Glioblastoma). Vượt quá khả năng phẫu thuật bảo tồn tại viện.',
      radiologist: 'BS. CĐHA Phan Văn An',
      imagingType: 'MRI',
      dicomZipUrl: '/uploads/pacs/dicom_study_test.zip',
      dicomZipSize: 12500000,
      dicomZipFilename: 'mri_braintumor_study.zip',
      model3dUrl: '/uploads/models/tumor_3d_mesh.gltf',
      segmentationUrl: '/uploads/masks/tumor_seg_mask.png',
      representativeSliceUrl: '/uploads/slices/tumor_key_slice.png',
      top5SlicesUrls: [
        '/uploads/slices/slice_1.png',
        '/uploads/slices/slice_2.png',
        '/uploads/slices/slice_3.png'
      ],
      aiReport: {
        tumorVolumeCm3: 38.6,
        midlineShiftMm: 7.2,
        malignancyLevel: 'high',
        anatomicalLocation: 'Thái dương trái (Left Temporal)',
        confidenceScore: 0.94
      },
      isSigned: true
    });
  });

  afterAll(async () => {
    await TransferForm.deleteMany({ hospitalId: hospital._id });
    await ImagingResult.deleteMany({ hospitalId: hospital._id });
    await User.deleteMany({ hospitalId: hospital._id });
    await Hospital.findByIdAndDelete(hospital._id);
    await Notification.deleteMany({ hospitalId: hospital._id });
    await AuditLog.deleteMany({ hospitalId: hospital._id });
  });

  let createdTransferId = null;

  test('1. Bác sĩ tạo gói chuyển viện: Tự động đóng gói DICOM, Báo cáo AI, 3D model và lưu trạng thái draft', async () => {
    let responseStatus = 0;
    let responseData = null;

    const mockReq = {
      user: {
        id: doctorUser._id.toString(),
        role: 'doctor',
        hospitalId: hospital._id.toString(),
        name: doctorUser.profile.name
      },
      body: {
        patient_id: patientUser._id.toString(),
        imagingResultId: imagingResult._id.toString(),
        transferTo: 'Bệnh viện Trung Ương Huế',
        diagnosis: 'U não ác tính vùng thái dương trái T4N0M0',
        clinicalSummary: 'Đau đầu dữ dội, nôn vọt, yếu nửa người phải nhẹ.',
        labSummary: 'WBC: 9.8, Glucose: 5.4. LIS kết quả hoàn chỉnh.',
        reason: '1',
        reasonDetail: 'Vượt quá năng lực phẫu thuật vi phẫu thần kinh và xạ trị chuyên sâu tại cơ sở',
        treatmentDirection: 'Phẫu thuật vi phẫu bóc u thần kinh đệm và xạ phẫu Gamma Knife'
      }
    };

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await createTransferRequest(mockReq, mockRes);

    expect(responseStatus).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.data.transferForm).toBeDefined();

    const tf = responseData.data.transferForm;
    createdTransferId = tf._id.toString();

    // Xác thực các thuộc tính của gói chuyển viện
    expect(tf.status).toBe('draft');
    expect(tf.transferNo.startsWith('CV-')).toBe(true);
    expect(tf.transferTo).toBe('Bệnh viện Trung Ương Huế');
    expect(tf.recipientEmail).toBe('benhnhan.unao.test@gmail.com');

    // Xác thực tự động đóng gói Snapshot: DICOM, Báo cáo AI, 3D model
    expect(tf.packageSnapshot).toBeDefined();
    expect(tf.packageSnapshot.dicom.zipUrl).toBe('/uploads/pacs/dicom_study_test.zip');
    expect(tf.packageSnapshot.model3dUrl).toBe('/uploads/models/tumor_3d_mesh.gltf');
    expect(tf.packageSnapshot.aiReport.tumorVolumeCm3).toBe(38.6);
    expect(tf.packageSnapshot.aiReport.malignancyLevel).toBe('high');

    // Xác thực đã phát thông báo nội bộ cho nhân viên Lễ tân
    const notif = await Notification.findOne({
      recipientId: receptionistUser._id,
      relatedId: tf._id
    });
    expect(notif).toBeDefined();
    expect(notif.type).toBe('transfer_draft');

    // Xác thực đã ghi Audit Log
    const audit = await AuditLog.findOne({
      entityId: tf._id.toString(),
      action: 'REFERRAL_PACKAGE_CREATED'
    });
    expect(audit).toBeDefined();
  });

  test('2. Chặn vai trò không có thẩm quyền tạo gói chuyển viện (Ví dụ Điều dưỡng)', async () => {
    let responseStatus = 0;
    let responseData = null;

    const mockReq = {
      user: {
        id: nurseUser._id.toString(),
        role: 'nurse',
        hospitalId: hospital._id.toString()
      },
      body: {
        patient_id: patientUser._id.toString(),
        diagnosis: 'U não'
      }
    };

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await createTransferRequest(mockReq, mockRes);
    expect(responseStatus).toBe(403);
    expect(responseData.success).toBe(false);
  });

  test('3. Lễ tân xem danh sách các gói chuyển viện chờ gửi email (status: draft)', async () => {
    let responseStatus = 0;
    let responseData = null;

    const mockReq = {
      user: {
        id: receptionistUser._id.toString(),
        role: 'receptionist',
        hospitalId: hospital._id.toString()
      },
      query: {
        status: 'draft'
      }
    };

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await getTransfers(mockReq, mockRes);
    expect(responseStatus).toBe(200);
    expect(responseData.success).toBe(true);
    expect(Array.isArray(responseData.data)).toBe(true);
    expect(responseData.data.length).toBeGreaterThanOrEqual(1);

    const item = responseData.data.find(t => t._id.toString() === createdTransferId);
    expect(item).toBeDefined();
    expect(item.status).toBe('draft');
    expect(item.patient_id.profile.fullName).toBe('Hoàng Văn Bệnh Nhân');
  });

  test('4. Lễ tân gửi email hồ sơ chuyển viện cho bệnh nhân: Cập nhật status sent, ghi vết người gửi', async () => {
    let responseStatus = 0;
    let responseData = null;

    const mockReq = {
      user: {
        id: receptionistUser._id.toString(),
        role: 'receptionist',
        hospitalId: hospital._id.toString(),
        name: receptionistUser.profile.name
      },
      params: {
        id: createdTransferId
      },
      body: {
        overrideEmail: 'benhnhan.chuyenkhoa@gmail.com'
      }
    };

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await sendTransferEmail(mockReq, mockRes);
    expect(responseStatus).toBe(200);
    expect(responseData.success).toBe(true);

    // Kiểm tra DB cập nhật trạng thái
    const updated = await TransferForm.findById(createdTransferId);
    expect(updated.status).toBe('sent');
    expect(updated.sentBy.toString()).toBe(receptionistUser._id.toString());
    expect(updated.recipientEmail).toBe('benhnhan.chuyenkhoa@gmail.com');
    expect(updated.sentAt).toBeDefined();

    // Kiểm tra Audit Log gửi email
    const audit = await AuditLog.findOne({
      entityId: createdTransferId,
      action: 'REFERRAL_PACKAGE_EMAILED'
    });
    expect(audit).toBeDefined();
  });

  test('5. Bác sĩ/Lễ tân xem chi tiết gói chuyển viện đã gửi kèm thông tin delivery', async () => {
    let responseStatus = 0;
    let responseData = null;

    const mockReq = {
      user: {
        id: doctorUser._id.toString(),
        role: 'doctor',
        hospitalId: hospital._id.toString()
      },
      params: {
        id: createdTransferId
      }
    };

    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await getTransferById(mockReq, mockRes);
    expect(responseStatus).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.data.status).toBe('sent');
    expect(responseData.data.packageSnapshot.aiReport).toBeDefined();
    expect(responseData.data.sentBy).toBeDefined();
  });
});
