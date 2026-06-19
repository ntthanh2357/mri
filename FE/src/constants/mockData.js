export const initialPatients = [
  {
    id: 'PT-8821',
    name: 'Nguyễn Văn An',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60',
    email: 'van.an@gmail.com',
    phone: '0912345678',
    age: 46,
    gender: 'Nam',
    bloodGroup: 'O+',
    address: '12 Cầu Giấy, Dịch Vọng, Hà Nội',
    lastVisit: '2026-06-03',
    medicalHistory: 'Từng có tiền sử đau đầu mãn tính, theo dõi u màng não nhẹ',
    status: 'Active'
  },
  {
    id: 'PT-9110',
    name: 'Trương Thị Ngọc Bích',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60',
    email: 'ngocbich@outlook.com',
    phone: '0987654321',
    age: 38,
    gender: 'Nữ',
    bloodGroup: 'A-',
    address: '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    lastVisit: '2026-06-01',
    medicalHistory: 'Cân bằng hoóc-môn nội tiết, u tuyến yên kích thước siêu nhỏ',
    status: 'Active'
  }
];

export const initialDoctors = [
  {
    id: 'DOC-01',
    name: 'BS. CKII Lê Mạnh Minh',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&auto=format&fit=crop&q=60',
    specialty: 'Khoa Ngoại Thần Kinh',
    experience: '18 năm kinh nghiệm',
    phone: '0903334445',
    email: 'minh.le@dreamsemr.com',
    status: 'Available',
    schedule: 'Thứ 2 - Thứ 6 (08:00 - 17:00)'
  },
  {
    id: 'DOC-03',
    name: 'PGS. TS Hoàng Thị Thanh',
    avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?w=100&auto=format&fit=crop&q=60',
    specialty: 'Khoa Nội Tuyến Yên & Nội Tiết',
    experience: '25 năm kinh nghiệm',
    phone: '0988887776',
    email: 'thanh.hoang@dreamsemr.com',
    status: 'Busy',
    schedule: 'Thứ 3 - Thứ 5 - Thứ 7 (13:00 - 18:00)'
  },
  {
    id: 'DOC-04',
    name: 'BS. Nguyễn Văn Phước',
    avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&auto=format&fit=crop&q=60',
    specialty: 'Chẩn Đoán Hình Ảnh',
    experience: '7 năm kinh nghiệm',
    phone: '0944445556',
    email: 'phuoc.nguyen@dreamsemr.com',
    status: 'Available',
    schedule: 'Thứ 2 - Thứ Bảy (08:00 - 12:00)'
  }
];

export const initialBackofficeDoctors = [
  {
    id: 'DOC-BO-01',
    name: 'BS. CKII Lê Mạnh Minh',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&auto=format&fit=crop&q=60',
    specialty: 'Khoa Ngoại Thần Kinh',
    experience: '18 năm kinh nghiệm',
    hospital: 'Bệnh viện Việt Đức',
    email: 'minh.le@dreamsemr.com',
    phone: '0903334445',
    cchnNumber: 'CCHN-2023-00128',
    cchnType: 'Chuyên khoa cấp II',
    issuedBy: 'Bộ Y Tế Việt Nam',
    issuedDate: '2023-04-15',
    status: 'Verified'
  },
  {
    id: 'DOC-BO-03',
    name: 'PGS. TS Hoàng Thị Thanh',
    avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?w=100&auto=format&fit=crop&q=60',
    specialty: 'Khoa Nội Tuyến Yên & Nội Tiết',
    experience: '25 năm kinh nghiệm',
    hospital: 'Bệnh viện Nội tiết Trung ương',
    email: 'thanh.hoang@dreamsemr.com',
    phone: '0988887776',
    cchnNumber: 'CCHN-2015-01024',
    cchnType: 'Phó giáo sư Tiến sĩ',
    issuedBy: 'Viện Hàn lâm Khoa học Việt Nam',
    issuedDate: '2015-09-01',
    status: 'Verified'
  },
  {
    id: 'DOC-BO-04',
    name: 'BS. Nguyễn Văn Phước',
    avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&auto=format&fit=crop&q=60',
    specialty: 'Chẩn Đoán Hình Ảnh',
    experience: '7 năm kinh nghiệm',
    hospital: 'Bệnh viện 108 Quân đội',
    email: 'phuoc.nguyen@dreamsemr.com',
    phone: '0944445556',
    cchnNumber: 'CCHN-2024-00078',
    cchnType: 'Chuyên khoa cấp I',
    issuedBy: 'Bộ Y Tế Việt Nam',
    issuedDate: '2024-01-05',
    status: 'Verified'
  }
];

export const initialAppointments = [
  {
    id: 'APT-1001',
    patientId: 'PT-8821',
    patientName: 'Nguyễn Văn An',
    doctorId: 'DOC-01',
    doctorName: 'BS. CKII Lê Mạnh Minh',
    doctorSpecialty: 'Khoa Ngoại Thần Kinh',
    date: '2026-06-08',
    time: '09:30',
    reason: 'Tái khám chụp cộng hưởng từ kiểm tra kích thước khối u màng não',
    status: 'Approved'
  },
  {
    id: 'APT-1002',
    patientId: 'PT-9110',
    patientName: 'Trương Thị Ngọc Bích',
    doctorId: 'DOC-03',
    doctorName: 'PGS. TS Hoàng Thị Thanh',
    doctorSpecialty: 'Khoa Nội Tuyến Yên & Nội Tiết',
    date: '2026-06-08',
    time: '14:15',
    reason: 'Đánh giá chỉ số Prolactin máu và điều chỉnh liều Dostinex',
    status: 'Pending'
  }
];

export const initialPrescriptions = [
  {
    id: 'RX-2026-001',
    patientName: 'Nguyễn Văn An',
    patientAge: 46,
    patientGender: 'Nam',
    doctorName: 'BS. CKII Lê Mạnh Minh',
    date: '2026-06-03',
    diagnosis: 'Đau đầu chưa phân loại, theo dõi u màng não thùy trán phải lành tính T1W',
    medications: [
      {
        name: 'Donepezil Hydrochloride 5mg',
        dosage: '1 viên',
        frequency: '1 lần/ngày',
        duration: '30 ngày',
        note: 'Uống lúc 08:00 sáng sau khi ăn no'
      },
      {
        name: 'Keppra 500mg (Levetiracetam)',
        dosage: '1 viên',
        frequency: '2 lần/ngày',
        duration: '30 ngày',
        note: 'Uống sáng 08:00 và tối 20:00 để dự phòng cơn co giật do u màng não kích ứng'
      },
      {
        name: 'Paracetamol 500mg (Sủi)',
        dosage: '1 viên',
        frequency: 'Khi có cơn đau đầu kịch phát',
        duration: '10 ngày',
        note: 'Không uống quá 3 viên/ngày, cách nhau tối thiểu 4 - 6 tiếng'
      }
    ],
    notes: 'Tránh các chất kích thích có cồn, giảm ăn quá mặn, nghỉ ngơi hợp lý, chụp lại MRI não kiểm soát sau 6 tháng tiếp.'
  },
  {
    id: 'RX-2026-002',
    patientName: 'Trương Thị Ngọc Bích',
    patientAge: 38,
    patientGender: 'Nữ',
    doctorName: 'PGS. TS Hoàng Thị Thanh',
    date: '2026-06-01',
    diagnosis: 'U tuyến yên kích thước siêu nhỏ, tăng nhẹ Prolactin máu nội tiết',
    medications: [
      {
        name: 'Dostinex 0.5mg (Cabergoline)',
        dosage: '1/2 viên',
        frequency: '2 lần/tuần',
        duration: '6 tuần',
        note: 'Uống cố định vào Thứ hai và Thứ năm vào tối lúc 20:00'
      }
    ],
    notes: 'Xét nghiệm lại định lượng Prolactin huyết thanh sau 4 tuần để cân đối lại phác đồ điều trị'
  }
];

export const initialInvoices = [
  {
    id: 'INV-2026-01',
    patientId: 'PT-8821',
    patientName: 'Nguyễn Văn An',
    patientPhone: '0912345678',
    date: '2026-06-03',
    dueDate: '2026-06-10',
    items: [
      { name: 'Khám lâm sàng ngoại sọ não thần kinh', quantity: 1, price: 300000 },
      { name: 'Phí chụp cộng hưởng từ MRI sọ não 1.5 Tesla', quantity: 1, price: 2200000 },
      { name: 'Tiêm thuốc tương phản cản từ Gadolinium', quantity: 1, price: 800000 }
    ],
    taxRate: 5,
    discount: 100000,
    totalAmount: 3150000,
    status: 'Paid'
  },
  {
    id: 'INV-2026-02',
    patientId: 'PT-9110',
    patientName: 'Trương Thị Ngọc Bích',
    patientPhone: '0987654321',
    date: '2026-06-01',
    dueDate: '2026-06-08',
    items: [
      { name: 'Khám chuyên môn giáo sư nội tiết thần kinh', quantity: 1, price: 500000 },
      { name: 'Xét nghiệm hormone Prolactin trong máu', quantity: 1, price: 250000 },
      { name: 'Xét nghiệm sinh hóa máu tổng quát', quantity: 1, price: 450000 }
    ],
    taxRate: 5,
    discount: 0,
    totalAmount: 1260000,
    status: 'Pending'
  }
];

export const initialSystemLogs = [
  {
    id: 'LOG-001',
    action: 'Xem Bệnh Án',
    user: 'BS. CKII Lê Mạnh Minh',
    role: 'Doctor',
    module: 'Patients',
    timestamp: '2026-06-07 11:24',
    ipAddress: '192.168.10.45',
    status: 'Success',
    details: 'Mở xem hồ sơ bệnh án mã hóa dữ liệu số của bệnh nhân Nguyễn Văn An (PT-8821)'
  },
  {
    id: 'LOG-002',
    action: 'Tạo Toa Thuốc Điện Tử',
    user: 'ThS. BS Trần Sĩ Nguyên',
    role: 'Doctor',
    module: 'Prescriptions',
    timestamp: '2026-06-07 10:15',
    ipAddress: '115.75.122.90',
    status: 'Success',
    details: 'Đã xuất dược bản điện tử toa RX-2026-001 cho bệnh nhân Nguyễn Văn An'
  },
  {
    id: 'LOG-003',
    action: 'Duyệt Lịch Hẹn Khám',
    user: 'Hệ thống Quản Trị',
    role: 'Admin',
    module: 'Appointments',
    timestamp: '2026-06-07 09:40',
    ipAddress: '127.0.0.1',
    status: 'Success',
    details: 'Hệ thống tự động duyệt đặt lịch hẹn số mã APT-1001 sang trạng thái Approved'
  },
  {
    id: 'LOG-004',
    action: 'Mã Hóa Ẩn Danh Bệnh Án (HIPAA)',
    user: 'Hệ thống Quản Trị',
    role: 'Admin',
    module: 'System',
    timestamp: '2026-06-07 09:00',
    ipAddress: 'Pipeline-Runner',
    status: 'Success',
    details: 'Đã hoàn tất dọn rác và che lấp 1200 bản ghi MRI chuẩn HIPAA quốc tế phục vụ AI Lab'
  }
];

export const initialDatasets = [
  {
    id: 'DS-001',
    name: 'MRI Brain Tumor Segmentation (BRATS 2025)',
    description: '1200 ca phim MRI não có khối u, đã được gán nhãn chuyên sâu bởi các bác sĩ hình ảnh thần kinh hàng đầu Việt Nam',
    sampleCount: 1200,
    priceVND: 8500000,
    createdBy: 'NeuroScan AI Team',
    createdAt: '2025-08-12',
    isPublic: true,
    status: 'published',
    tags: ['MRI', 'Brain', 'Tumor', 'Segmentation'],
    salesCount: 124,
    thumbnail: 'https://images.unsplash.com/photo-1559757175-5700dde6751e?w=200&auto=format&fit=crop&q=60'
  }
];
