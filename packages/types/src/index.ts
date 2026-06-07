// Auth Types
export type UserRole = 'patient' | 'doctor' | 'admin' | 'partner';

export interface User {
  _id: string;
  email?: string;
  phone: string;
  name: string;
  role: UserRole;
  password?: string;
  isVerified: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}

// Patient Types
export interface MedicalRecord {
  _id: string;
  patientId: string;
  images: string[];
  ocrText?: string;
  translatedText?: string;
  aiBoundingBox?: any;
  doctorReport?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  _id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  _id: string;
  patientId: string;
  medicationId?: string;
  title: string;
  time: Date;
  isDone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Doctor & Clinic Types
export interface Clinic {
  _id: string;
  ownerId: string;
  name: string;
  address: string;
  phone: string;
  businessLicense: string;
  isVerified: boolean;
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Doctor {
  id: string;
  name: string;
  avatarUrl: string;
  specialty: string;
  experience: string;
  phone: string;
  email: string;
  status: 'Available' | 'On Leave' | 'Busy';
  schedule: string;
}

export interface AIInferenceResult {
  _id: string;
  recordId: string;
  doctorId: string;
  imageUrl: string;
  boundingBox?: any;
  confidenceScore: number;
  draftReport?: string;
  isCorrected: boolean;
  correctedBoundingBox?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Partner Types
export interface Partner {
  _id: string;
  userId: string;
  name: string;
  address: string;
  phone: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerUpload {
  _id: string;
  partnerId: string;
  patientPhone: string;
  files: string[];
  passcode: string;
  status: 'pending' | 'sent' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

// Billing Types
export type PaymentProvider = 'vnpay' | 'momo';
export type PackageType = 'b2c_yearly' | 'b2b_monthly';

export interface Payment {
  _id: string;
  userId: string;
  amount: number;
  provider: PaymentProvider;
  status: 'pending' | 'success' | 'failed';
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  _id: string;
  userId: string;
  type: PackageType;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  _id: string;
  clinicId: string;
  amount: number;
  type: 'topup' | 'debit';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

// Admin Types
export interface Agent {
  _id: string;
  name: string;
  prompt: string;
  temperature: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RAGDocument {
  _id: string;
  title: string;
  fileUrl: string;
  fileType: string;
  createdAt: Date;
}

export interface HardExample {
  _id: string;
  inferenceId: string;
  originalBoundingBox: any;
  correctedBoundingBox: any;
  imageUrl: string;
  reviewed: boolean;
  createdAt: Date;
}

// Notification Types
export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'sos';
  isRead: boolean;
  createdAt: Date;
}

// Additional types from mockDataEMR
export interface Patient {
  id: string;
  name: string;
  avatarUrl: string;
  email: string;
  phone: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  bloodGroup: string;
  address: string;
  lastVisit: string;
  medicalHistory: string;
  status: 'Active' | 'Inactive';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
}

export interface Prescription {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: 'Nam' | 'Nữ';
  doctorName: string;
  date: string;
  diagnosis: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    note: string;
  }[];
  notes: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  discount: number;
  totalAmount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface SystemLog {
  id: string;
  action: string;
  user: string;
  role: string;
  module: 'Dashboard' | 'Patients' | 'Doctors' | 'Appointments' | 'Prescriptions' | 'Invoices' | 'System';
  timestamp: string;
  ipAddress: string;
  status: 'Success' | 'Failed' | 'Warning';
  details: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  sampleCount: number;
  priceVND: number;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  status: 'published' | 'draft' | 'archived';
  tags: string[];
  salesCount: number;
  thumbnail: string;
}

export interface BackofficeDoctor {
  id: string;
  name: string;
  avatarUrl: string;
  specialty: string;
  experience: string;
  hospital: string;
  email: string;
  phone: string;
  cchnNumber: string;
  cchnType: string;
  issuedBy: string;
  issuedDate: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  clinicName?: string;
  clinicAddress?: string;
  registeredAt?: string;
  yearsExp?: number;
  documents?: { id: string; name: string; status: 'verified' | 'pending' | 'rejected' }[];
}
