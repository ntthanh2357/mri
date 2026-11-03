import mongoose from 'mongoose';
import { User } from '../modules/auth/models/user.model.js';
import { Hospital } from '../models/hospital.model.js';
import { Visit } from '../models/visit.model.js';
import { Invoice } from '../models/invoice.model.js';
import { LabOrder } from '../modules/laboratory/models/labOrder.model.js';
import { ImagingResult } from '../modules/imaging/models/imagingResult.model.js';
import { MedicalRecord } from '../modules/emr/models/medicalRecord.model.js';
import { Consultation } from '../modules/emr/models/consultation.model.js';
import {
  createMriOrderService,
  submitMriSafetyCheckService,
  cancelMriOrderService,
  getMyQueueService,
} from '../services/visit.service.js';
import {
  updateImagingResult,
  acknowledgeCriticalFinding,
  addImagingAddendum,
  getPatientRanoTimeline,
  computeRanoEvaluation,
} from '../modules/imaging/imaging.controller.js';
import { getViewerManifest } from '../modules/imaging/dicom.controller.js';
import { approveTumorBoard } from '../modules/emr/emr.controller.js';

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe('Quy trình Khép kín Khoa Ung thư Não & Mini-PACS Web DICOM AI (Neuro-Oncology PACS Workflow)', () => {
  let hospital;
  let patient;
  let doctor;
  let radiologist;
  let deptHead;
  let technician;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/neuroscan_test_logic'
      );
    }

    hospital = await Hospital.create({
      name: 'Bệnh viện Ung thư Não Mini-PACS Test',
      code: `KUTN_${Date.now()}`,
      status: 'active',
      isActive: true,
      pricing: { examFee: 100000, mriFee: 1800000, aiFee: 250000, maxPatients: 200 },
    });

    const suffix = Date.now();
    patient = await User.create({
      email: `bn.kutn.${suffix}@test.vn`,
      passwordHash: 'hash',
      role: 'patient',
      hospitalId: hospital._id,
      isVerified: true,
      profile: { name: 'Nguyễn Văn U Não', medicalId: `BN-KUTN-${suffix}` },
    });

    doctor = await User.create({
      email: `bs.kutn.${suffix}@test.vn`,
      passwordHash: 'hash',
      role: 'doctor',
      hospitalId: hospital._id,
      departmentId: 'KUTN',
      isVerified: true,
      profile: { name: 'BS.CKII Lâm sàng U Não' },
    });

    radiologist = await User.create({
      email: `bs.cdha.${suffix}@test.vn`,
      passwordHash: 'hash',
      role: 'radiologist',
      hospitalId: hospital._id,
      departmentId: 'KCDHA',
      isVerified: true,
      profile: { name: 'BS.CKI Chẩn đoán hình ảnh PACS' },
    });

    deptHead = await User.create({
      email: `truongkhoa.kutn.${suffix}@test.vn`,
      passwordHash: 'hash',
      role: 'department_head',
      hospitalId: hospital._id,
      departmentId: 'KUTN',
      isVerified: true,
      profile: { name: 'PGS.TS Trưởng khoa Ung thư Não' },
    });

    technician = await User.create({
      email: `ktv.mri.${suffix}@test.vn`,
      passwordHash: 'hash',
      role: 'technician',
      hospitalId: hospital._id,
      departmentId: 'KCDHA',
      isVerified: true,
      profile: { name: 'KTV Chụp MRI' },
    });
  });

  afterAll(async () => {
    if (hospital?._id) {
      await Promise.all([
        Visit.deleteMany({ hospitalId: hospital._id }),
        Invoice.deleteMany({ hospitalId: hospital._id }),
        LabOrder.deleteMany({ hospitalId: hospital._id }),
        ImagingResult.deleteMany({ hospitalId: hospital._id }),
        MedicalRecord.deleteMany({ hospitalId: hospital._id }),
        Consultation.deleteMany({ hospitalId: hospital._id }),
        User.deleteMany({ hospitalId: hospital._id }),
        Hospital.deleteOne({ _id: hospital._id }),
      ]);
    }
  });

  it('1. Phân quyền role mới: radiologist (KCDHA) và department_head (KUTN) hoạt động đúng trong hàng đợi', async () => {
    const visit = await Visit.create({
      hospitalId: hospital._id,
      patientId: patient._id,
      doctorId: doctor._id,
      technicianId: technician._id,
      status: 'chờ bác sĩ đọc',
      mriOrder: {
        region: 'Sọ não',
        clinicalScenario: 'initial_diagnosis',
        protocolCode: 'BRAIN_TUMOR_STANDARD',
        mriStatus: 'uploaded',
        orderedAt: new Date(),
      },
    });

    const radQueue = await getMyQueueService({
      role: 'radiologist',
      id: radiologist._id,
      hospitalId: hospital._id,
    });
    expect(radQueue.some((v) => String(v._id) === String(visit._id))).toBe(true);

    const headQueue = await getMyQueueService({
      role: 'department_head',
      id: deptHead._id,
      hospitalId: hospital._id,
    });
    expect(headQueue.some((v) => String(v._id) === String(visit._id))).toBe(true);
  });

  it('2. Cổng Viện phí (Payment Gate) & Tự động kiểm tra eGFR từ LIS trước khi chụp MRI có tiêm Gadolinium', async () => {
    // Tạo kết quả xét nghiệm LIS eGFR = 24 (< 30 mL/phút -> nguy cơ NSF)
    await LabOrder.create({
      hospitalId: hospital._id,
      patient_id: patient._id,
      patient_gender: 'Nam',
      barcode: `LIS-EGFR-${Date.now()}`,
      category: 'HOA_SINH',
      status: 'VERIFIED',
      specimenStatus: 'VERIFIED',
      results: [
        {
          biomarker_code: 'EGFR',
          biomarker_name: 'Độ lọc cầu thận eGFR',
          value_result: 24,
          unit: 'mL/min/1.73m2',
          is_abnormal: true,
          abnormal_direction: 'LOW',
        },
      ],
    });

    const visit = await Visit.create({
      hospitalId: hospital._id,
      patientId: patient._id,
      doctorId: doctor._id,
      status: 'đang khám',
      priority: 'trung bình',
    });

    // Bác sĩ ra y lệnh chụp MRI Tiền phẫu có tiêm cản quang
    const orderedVisit = await createMriOrderService({
      visitId: visit._id,
      hospitalId: hospital._id,
      userId: doctor._id,
      technicianId: technician._id,
      region: 'Sọ não định vị Navigation',
      clinicalScenario: 'pre_op',
      protocolCode: 'PRE_OP_NAVIGATION',
      requestAiAnalysis: true,
      withContrast: true,
    });

    expect(orderedVisit.mriOrder.clinicalScenario).toBe('pre_op');
    expect(orderedVisit.mriOrder.protocolCode).toBe('PRE_OP_NAVIGATION');
    expect(orderedVisit.mriOrder.mriStatus).toBe('ordered');
    expect(orderedVisit.mriOrder.creatinineEgfr).toBe(24);
    expect(orderedVisit.invoiceId).toBeDefined();

    // KTV bấm thẩm định an toàn khi hóa đơn chưa thanh toán (enforcePaymentGate = true) -> Chặn 402
    let blockedError = null;
    try {
      await submitMriSafetyCheckService({
        visitId: visit._id,
        hospitalId: hospital._id,
        user: { id: technician._id, role: 'technician', profile: { name: 'KTV MRI' } },
        checklistData: {
          hasPacemakerOrMetal: false,
          enforcePaymentGate: true,
        },
      });
    } catch (err) {
      blockedError = err;
    }
    expect(blockedError).toBeDefined();
    expect(blockedError.statusCode).toBe(402);
    expect(blockedError.code).toBe('ERR_INVOICE_NOT_PAID');

    // Thu ngân xác nhận đã thanh toán hóa đơn tạm tính
    await Invoice.findByIdAndUpdate(orderedVisit.invoiceId, {
      status: 'đã thanh toán',
      paidAt: new Date(),
    });

    // KTV thẩm định lại: qua cổng viện phí, nhưng tự động phát hiện eGFR = 24 < 30 -> requiresDoctorReview = true
    const safetyRes = await submitMriSafetyCheckService({
      visitId: visit._id,
      hospitalId: hospital._id,
      user: { id: technician._id, role: 'technician', profile: { name: 'KTV MRI' } },
      checklistData: {
        hasPacemakerOrMetal: false,
        enforcePaymentGate: true,
      },
    });
    expect(safetyRes.paymentPending).toBe(false);
    expect(safetyRes.checklist.hasKidneyDisease).toBe(true);
    expect(safetyRes.requiresDoctorReview).toBe(true);
  });

  it('3. Hủy chỉ định chụp MRI an toàn (returnToDoctor = true): trả bệnh nhân về buồng khám & tự động gỡ phí MRI/AI khỏi hóa đơn', async () => {
    const visit = await Visit.create({
      hospitalId: hospital._id,
      patientId: patient._id,
      doctorId: doctor._id,
      status: 'đang khám',
    });

    const ordered = await createMriOrderService({
      visitId: visit._id,
      hospitalId: hospital._id,
      userId: doctor._id,
      technicianId: technician._id,
      region: 'Não bộ',
      requestAiAnalysis: true,
    });

    const beforeInvoice = await Invoice.findById(ordered.invoiceId).lean();
    expect(beforeInvoice.items.length).toBe(3); // exam + mri + ai
    expect(beforeInvoice.totalAmount).toBe(2150000);

    const cancelledVisit = await cancelMriOrderService({
      visitId: visit._id,
      hospitalId: hospital._id,
      user: { id: technician._id, role: 'technician' },
      reason: 'Bệnh nhân sợ buồng kín nặng, trả về BS lâm sàng đổi chỉ định CT-Scan',
      returnToDoctor: true,
    });

    expect(cancelledVisit.status).toBe('đang khám');
    expect(cancelledVisit.mriOrder.mriStatus).toBe('cancelled');

    const afterInvoice = await Invoice.findById(ordered.invoiceId).lean();
    expect(afterInvoice.items.length).toBe(1); // chỉ còn phí khám lâm sàng
    expect(afterInvoice.items[0].type).toBe('exam');
    expect(afterInvoice.totalAmount).toBe(100000);
  });

  it('4. BS CĐHA (radiologist) ký báo cáo Structured Report + RANO, kích hoạt Critical Finding, BS lâm sàng Acknowledge & tạo Addendum', async () => {
    // 1. Tạo kết quả MRI kỳ trước (Baseline: 20 x 20 mm = 400 mm²)
    const priorResult = await ImagingResult.create({
      hospitalId: hospital._id,
      medicalId: patient.profile.medicalId,
      patientName: patient.profile.name,
      gender: 'Nam',
      orderDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      procedure: 'MRI sọ não lần 1',
      imagingType: 'MRI',
      findings: 'Khối u thùy trán phải 20x20mm',
      conclusion: 'Glioma độ cao',
      radiologist: 'BS.CKI CĐHA',
      reportDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      isSigned: true,
      structuredReport: {
        hemisphere: 'right',
        lobe: 'frontal',
        measurements: { d1Mm: 20, d2Mm: 20, d3Mm: 18, crossProductMm2: 400 },
      },
    });

    // 2. Tạo kết quả MRI kỳ này (Chưa ký): đo trên Web Viewer được 30 x 20 mm = 600 mm² (+50% -> PD), đẩy lệch đường giữa 7mm
    const currentDraft = await ImagingResult.create({
      hospitalId: hospital._id,
      medicalId: patient.profile.medicalId,
      patientName: patient.profile.name,
      gender: 'Nam',
      orderDate: new Date(),
      procedure: 'MRI sọ não theo dõi RANO',
      imagingType: 'MRI',
      findings: 'Bản nháp KTV',
      conclusion: 'Chờ BS CĐHA đọc',
      radiologist: 'Chờ ký',
      reportDate: new Date(),
      images: ['/uploads/slice1.jpg', '/uploads/slice2.jpg'],
      isSigned: false,
    });

    // Kiểm tra Viewer Manifest trả về đầy đủ series, presets & priorStudy
    const manifestRes = makeRes();
    await getViewerManifest(
      {
        params: { id: currentDraft._id.toString() },
        user: { id: radiologist._id.toString(), role: 'radiologist', hospitalId: hospital._id.toString() },
      },
      manifestRes
    );
    expect(manifestRes.statusCode).toBe(200);
    expect(manifestRes.body.data.series.length).toBeGreaterThanOrEqual(2);
    expect(String(manifestRes.body.data.priorStudy.imagingResultId)).toBe(String(priorResult._id));

    // 3. BS CĐHA (radiologist) ký duyệt báo cáo có cấu trúc + RANO + kết thúc xạ trị cách đây 30 ngày (<= 84 ngày -> nghi ngờ Pseudoprogression)
    const signRes = makeRes();
    const rtEndDate = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    await updateImagingResult(
      {
        params: { id: currentDraft._id.toString() },
        user: {
          id: radiologist._id.toString(),
          role: 'radiologist',
          hospitalId: hospital._id.toString(),
          profile: { name: 'BS.CKI Chẩn đoán hình ảnh PACS' },
        },
        body: {
          findings: 'Khối choán chỗ thùy trán phải ngấm thuốc dạng vòng 30x20mm, đẩy lệch đường giữa 7mm.',
          conclusion: 'Theo dõi tiến triển RANO-PD (cần phân biệt giả tiến triển sau xạ trị).',
          structuredReport: {
            hemisphere: 'right',
            lobe: 'frontal',
            axialLocation: 'intra_axial',
            measurements: { d1Mm: 30, d2Mm: 20, d3Mm: 22, sliceIndex: 1, seriesType: 'T1C+' },
            enhancement: 'ring_enhancing',
            peritumoralEdema: 'severe',
            midlineShiftMm: 7,
            herniation: 'subfalcine',
            rano: {
              radiotherapyEndDate: rtEndDate,
            },
          },
          aiAgreement: { status: 'agreed', note: 'Đồng thuận vùng khoanh u của AI' },
        },
      },
      signRes
    );

    expect(signRes.statusCode).toBe(200);
    const signedDoc = signRes.body.data;
    expect(signedDoc.isSigned).toBe(true);
    expect(signedDoc.structuredReport.measurements.crossProductMm2).toBe(600);
    expect(signedDoc.structuredReport.rano.category).toBe('PD');
    expect(signedDoc.structuredReport.rano.changePercent).toBe(50);
    expect(signedDoc.structuredReport.rano.isPseudoprogressionSuspected).toBe(true);
    // Midline shift 7mm >= 5mm -> Tự động kích hoạt Cảnh báo Đỏ CĐHA
    expect(signedDoc.criticalFinding.isCritical).toBe(true);

    // 4. Trưởng khoa (department_head) xác nhận đã đọc Cảnh báo Đỏ (Acknowledge Critical Finding)
    const ackRes = makeRes();
    await acknowledgeCriticalFinding(
      {
        params: { id: currentDraft._id.toString() },
        user: {
          id: deptHead._id.toString(),
          role: 'department_head',
          hospitalId: hospital._id.toString(),
          profile: { name: 'PGS.TS Trưởng khoa Ung thư Não' },
        },
      },
      ackRes
    );
    expect(ackRes.statusCode).toBe(200);
    expect(ackRes.body.criticalFinding.acknowledgedByName).toBe('PGS.TS Trưởng khoa Ung thư Não');

    // 5. BS CĐHA phát hành Bản đính chính (Addendum) mà không làm thay đổi bản gốc đã ký
    const addRes = makeRes();
    await addImagingAddendum(
      {
        params: { id: currentDraft._id.toString() },
        user: {
          id: radiologist._id.toString(),
          role: 'radiologist',
          hospitalId: hospital._id.toString(),
          profile: { name: 'BS.CKI Chẩn đoán hình ảnh PACS' },
        },
        body: {
          content: 'Bổ sung nhận định chuỗi tưới máu DSC-Perfusion: rCBV không tăng cao, ủng hộ giả tiến triển (Pseudoprogression).',
          reason: 'Bổ sung chuỗi xung Perfusion sau hội chẩn',
        },
      },
      addRes
    );
    expect(addRes.statusCode).toBe(201);
    expect(addRes.body.addenda.length).toBe(1);
    expect(addRes.body.data.conclusion).toBe(
      'Theo dõi tiến triển RANO-PD (cần phân biệt giả tiến triển sau xạ trị).'
    );

    // 6. Truy vấn chuỗi RANO Timeline của bệnh nhân
    const timelineRes = makeRes();
    await getPatientRanoTimeline(
      {
        params: { medicalId: patient.profile.medicalId },
        user: { id: doctor._id.toString(), role: 'doctor', hospitalId: hospital._id.toString() },
      },
      timelineRes
    );
    expect(timelineRes.statusCode).toBe(200);
    expect(timelineRes.body.totalStudies).toBe(2);
    expect(timelineRes.body.baselineCrossProductMm2).toBe(400);
  });

  it('5. Trưởng khoa (department_head) phê duyệt Hội đồng U não (Tumor Board) & tự động kích hoạt y lệnh MRI hậu phẫu <= 72h', async () => {
    const visit = await Visit.create({
      hospitalId: hospital._id,
      patientId: patient._id,
      doctorId: doctor._id,
      status: 'chờ hội chẩn',
    });

    const record = await MedicalRecord.create({
      hospitalId: hospital._id,
      patientId: patient._id.toString(),
      patientName: patient.profile.name,
      age: 52,
      gender: 'Nam',
      diagnosis: 'U nguyên bào thần kinh đệm (Glioblastoma IDH-wildtype)',
      icd10Code: 'C71.1',
      doctorInCharge: doctor.profile.name,
      doctorName: doctor.profile.name,
    });

    const consultation = await Consultation.create({
      hospitalId: hospital._id,
      medicalRecordId: record._id,
      participants: [doctor.profile.name, radiologist.profile.name, deptHead.profile.name],
      clinicalSummary: 'Khối u thùy trán phải kích thước 30x20mm, gây phù não và đẩy lệch đường giữa 7mm.',
      diagnosis: 'Glioblastoma WHO CNS Grade 4',
      treatmentConclusion: 'Vi phẫu thuật lấy tối đa khối u dưới hướng dẫn Navigation + Hóa xạ trị đồng thời Stupp.',
      consultationType: 'tumor_board',
    });

    const surgeryDate = new Date('2026-11-05T08:00:00.000Z');
    const approveRes = makeRes();
    await approveTumorBoard(
      {
        params: { id: consultation._id.toString() },
        user: {
          id: deptHead._id.toString(),
          role: 'department_head',
          hospitalId: hospital._id.toString(),
          profile: { name: 'PGS.TS Trưởng khoa Ung thư Não' },
        },
        body: {
          consensusDecision: 'Đồng thuận mổ vi phẫu lấy u tối đa an toàn + chụp MRI hậu phẫu sớm trong 72h.',
          scheduledSurgeryDate: surgeryDate.toISOString(),
          visitId: visit._id.toString(),
        },
      },
      approveRes
    );

    expect(approveRes.statusCode).toBe(200);
    const updatedTb = approveRes.body.data.tumorBoardDetails;
    expect(updatedTb.isLocked).toBe(true);
    expect(updatedTb.chairApprovedByName).toBe('PGS.TS Trưởng khoa Ung thư Não');
    // Hạn chụp MRI hậu phẫu = đúng 72 giờ sau thời điểm phẫu thuật
    expect(new Date(updatedTb.postOpMriDueAt).getTime() - surgeryDate.getTime()).toBe(
      72 * 60 * 60 * 1000
    );

    const updatedVisit = await Visit.findById(visit._id).lean();
    expect(updatedVisit.status).toBe('chờ chụp sau phẫu thuật');
    expect(updatedVisit.mriOrder.clinicalScenario).toBe('post_op_72h');
    expect(updatedVisit.mriOrder.protocolCode).toBe('POST_OP_72H');
  });
});
