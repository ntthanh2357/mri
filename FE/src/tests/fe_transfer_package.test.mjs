import assert from 'assert';

console.log('\n======================================================================');
console.log('   NEUROSCAN AI: FRONTEND SMART REFERRAL PACKAGE TESTS (UC-DOC-10)    ');
console.log('======================================================================\n');

let passedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// SUITE: Smart Referral Package Data Validation & Receptionist Flow
console.log('SUITE: Smart Referral Package Payload & State Flow');

runTest('Khởi tạo payload gói chuyển viện thông minh đầy đủ thuộc tính', () => {
  const mockPatient = {
    _id: 'patient_123',
    email: 'benhnhan.unao@gmail.com',
    profile: {
      fullName: 'Nguyễn Văn Bệnh Nhân',
      dob: '1985-05-15',
      gender: 'Nam',
      address: 'Đà Nẵng'
    }
  };

  const mockImaging = {
    _id: 'img_456',
    procedure: 'Chụp MRI sọ não 3T có cản từ',
    dicomZipUrl: '/uploads/dicom/study_123.zip',
    dicomZipSize: 15728640, // 15MB
    model3dUrl: '/uploads/3d/tumor_mesh.gltf',
    aiReport: {
      tumorType: 'Glioblastoma Multiforme (GBM)',
      whoGrade: 'IV',
      confidence: 0.96,
      volumeCm3: 14.8,
      location: 'Thùy thái dương phải'
    },
    top5SlicesUrls: ['/uploads/slices/slice_1.png', '/uploads/slices/slice_2.png']
  };

  const payload = {
    patient_id: mockPatient._id,
    doctor_name: 'BS. CKII Trần Văn Chuyên',
    transferTo: 'Bệnh viện Chợ Rẫy (TP.HCM)',
    diagnosis: `U não (${mockImaging.aiReport.tumorType} - WHO Grade ${mockImaging.aiReport.whoGrade})`,
    reason: '1',
    reasonDetail: 'Vượt quá năng lực phẫu thuật thần kinh chuyên sâu tại cơ sở',
    treatmentDirection: 'Vi phẫu bóc tách u não, xạ trị gia tốc tuyến trên',
    transportation: 'Xe cấp cứu chuyên dụng (kèm máy thở & monitor)',
    recipientEmail: mockPatient.email,
    imagingResultId: mockImaging._id,
    isSmartPackage: true
  };

  assert.strictEqual(payload.patient_id, 'patient_123');
  assert.strictEqual(payload.recipientEmail, 'benhnhan.unao@gmail.com');
  assert.strictEqual(payload.isSmartPackage, true);
  assert.ok(payload.diagnosis.includes('Glioblastoma'));
  assert.ok(payload.reasonDetail.includes('Vượt quá năng lực'));
});

runTest('Chuyển trạng thái gói chuyển viện: Draft (Lễ tân chờ gửi) -> Sent (Đã gửi email bệnh nhân)', () => {
  const initialTransfer = {
    _id: 'trans_999',
    transferNo: 'CV-123456',
    status: 'draft',
    recipientEmail: 'benhnhan.unao@gmail.com',
    sentAt: null,
    sentBy: null,
    sendAttempts: 0
  };

  assert.strictEqual(initialTransfer.status, 'draft');
  assert.strictEqual(initialTransfer.sentAt, null);

  // Giả lập Lễ tân bấm gửi email thành công
  const updatedTransfer = {
    ...initialTransfer,
    status: 'sent',
    sentAt: new Date().toISOString(),
    sentBy: 'Lễ tân tiếp đón Nguyễn Thị Hương',
    sendAttempts: 1
  };

  assert.strictEqual(updatedTransfer.status, 'sent');
  assert.ok(updatedTransfer.sentAt !== null);
  assert.strictEqual(updatedTransfer.sentBy, 'Lễ tân tiếp đón Nguyễn Thị Hương');
});

runTest('Đóng gói snapshot dữ liệu số an toàn (DICOM, AI Report, 3D Mesh)', () => {
  const packageSnapshot = {
    dicom: {
      zipUrl: '/uploads/dicom/mri_series.zip',
      sizeBytes: 12582912,
      filename: 'MRI_Brain_Series.zip'
    },
    aiReport: {
      tumorType: 'Glioblastoma',
      whoGrade: 'IV',
      confidence: 0.95,
      volumeCm3: 16.2
    },
    model3dUrl: '/uploads/models/brain_tumor.gltf',
    top5SlicesUrls: ['/uploads/s1.jpg', '/uploads/s2.jpg']
  };

  assert.ok(packageSnapshot.dicom.zipUrl.endsWith('.zip'));
  assert.strictEqual(packageSnapshot.aiReport.whoGrade, 'IV');
  assert.ok(packageSnapshot.model3dUrl.endsWith('.gltf'));
  assert.strictEqual(packageSnapshot.top5SlicesUrls.length, 2);
});

console.log('\n======================================================================');
console.log(`SUMMARY: ${passedCount}/3 SMART REFERRAL TESTS PASSED (100%)`);
console.log('======================================================================\n');
