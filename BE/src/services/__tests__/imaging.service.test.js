import mongoose from 'mongoose';
import {
  createImagingResultService,
  signAndFinalizeResultService
} from '../imaging.service.js';
import { ImagingResult } from '../../models/imagingResult.model.js';
import { Visit } from '../../models/visit.model.js';

describe('Unit Tests: Imaging Service (imaging.service.js)', () => {
  let mockHospitalIdA;
  let mockHospitalIdB;
  let mockRadiologistUser;
  let mockDoctorHospitalB;

  beforeAll(async () => {
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    mockHospitalIdA = new mongoose.Types.ObjectId();
    mockHospitalIdB = new mongoose.Types.ObjectId();

    mockRadiologistUser = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: mockHospitalIdA.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. CĐHA Hoàng Minh Tuấn' }
    };

    mockDoctorHospitalB = {
      id: new mongoose.Types.ObjectId().toString(),
      hospitalId: mockHospitalIdB.toString(),
      role: 'doctor',
      profile: { fullName: 'BS. Bệnh Viện Khác' }
    };
  });

  afterAll(async () => {
    await ImagingResult.deleteMany({ hospitalId: { $in: [mockHospitalIdA, mockHospitalIdB] } });
    await Visit.deleteMany({ hospitalId: { $in: [mockHospitalIdA, mockHospitalIdB] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test('1. Tạo kết quả chẩn đoán hình ảnh và tự động liên kết trạng thái ca khám', async () => {
    const visit = new Visit({
      hospitalId: mockHospitalIdA,
      patientId: new mongoose.Types.ObjectId(),
      doctorId: new mongoose.Types.ObjectId(),
      status: 'đang chụp',
      mriOrder: { requestAiAnalysis: true }
    });
    await visit.save();

    const body = {
      medicalId: 'BN-998811',
      patientName: 'Phạm Nhật Huy',
      birthYear: 1985,
      gender: 'Nam',
      address: 'Hà Nội',
      orderDate: new Date().toISOString(),
      orderingDoctor: 'BS. Khám Lâm Sàng',
      orderingDepartment: 'Khoa Thần Kinh',
      diagnosis: 'Nghi ngờ u bao dây thần kinh thính giác',
      procedure: 'Chụp MRI sọ não có tiêm đối quang từ',
      findings: 'Không thấy bất thường nhu mô não',
      conclusion: 'Hình ảnh bình thường',
      radiologist: 'Chờ duyệt',
      reportDate: new Date().toISOString(),
      imagingType: 'MRI',
      visitId: visit._id.toString()
    };

    const result = await createImagingResultService({
      hospitalId: mockHospitalIdA,
      user: mockRadiologistUser,
      body
    });

    expect(result).toBeDefined();
    expect(result.medicalId).toBe('BN-998811');
    expect(result.isSigned).toBe(false);

    // Kiểm tra Visit được cập nhật sang "chờ kết quả AI" do requestAiAnalysis = true
    const updatedVisit = await Visit.findById(visit._id);
    expect(updatedVisit.status).toBe('chờ kết quả AI');
    expect(updatedVisit.mriOrder.imagingResultId.toString()).toBe(result._id.toString());
  });

  test('2. Chặn bác sĩ bệnh viện B ký duyệt phim của bệnh viện A (Multi-tenant Isolation)', async () => {
    const result = new ImagingResult({
      hospitalId: mockHospitalIdA,
      medicalId: 'BN-112233',
      patientName: 'Nguyễn Văn Test',
      gender: 'Nam',
      orderDate: new Date(),
      procedure: 'MRI Brain',
      findings: 'Tổn thương thùy trán',
      conclusion: 'Nghi u não',
      radiologist: 'BS. Sơ bộ',
      reportDate: new Date(),
      imagingType: 'MRI'
    });
    await result.save();

    await expect(
      signAndFinalizeResultService({
        resultId: result._id,
        hospitalId: mockHospitalIdB,
        user: mockDoctorHospitalB,
        updateData: { conclusion: 'Kết luận sửa đổi' }
      })
    ).rejects.toThrow('Bạn không có quyền chỉnh sửa kết quả phim chụp của bệnh viện khác');
  });

  test('3. Bác sĩ CĐHA ký duyệt số thành công và chuyển trạng thái ca khám sang "hoàn tất"', async () => {
    const result = new ImagingResult({
      hospitalId: mockHospitalIdA,
      medicalId: 'BN-445566',
      patientName: 'Lê Hoàng Yến',
      gender: 'Nữ',
      orderDate: new Date(),
      procedure: 'MRI Sọ Não Xung FLAIR',
      findings: 'Khối choán chỗ thùy đỉnh kích thước 15x20mm',
      conclusion: 'U màng não thùy đỉnh T',
      radiologist: 'Chờ thẩm định',
      reportDate: new Date(),
      imagingType: 'MRI'
    });
    await result.save();

    const visit = new Visit({
      hospitalId: mockHospitalIdA,
      patientId: new mongoose.Types.ObjectId(),
      doctorId: new mongoose.Types.ObjectId(),
      status: 'chờ bác sĩ đọc',
      mriOrder: { imagingResultId: result._id }
    });
    await visit.save();

    const signedResult = await signAndFinalizeResultService({
      resultId: result._id,
      hospitalId: mockHospitalIdA,
      user: mockRadiologistUser,
      updateData: {
        conclusion: 'Xác nhận: U màng não thùy đỉnh T (Meningioma Grade I)'
      }
    });

    expect(signedResult.isSigned).toBe(true);
    expect(signedResult.radiologist).toBe('BS. CĐHA Hoàng Minh Tuấn');
    expect(signedResult.signedByDoctorId.toString()).toBe(mockRadiologistUser.id.toString());
    expect(signedResult.signedAt).toBeDefined();

    // Ca khám liên kết được chuyển sang "hoàn tất"
    const finishedVisit = await Visit.findById(visit._id);
    expect(finishedVisit.status).toBe('hoàn tất');
  });
});
