/**
 * Deep Linking & Browser History Configuration for React Navigation (Web & Mobile)
 * Đảm bảo:
 * 1. Các nút Back/Forward trên trình duyệt hoạt động chuẩn xác (đồng bộ window.history qua pushState/popstate)
 * 2. URL trên thanh địa chỉ phản ánh chính xác màn hình đang hiển thị
 * 3. Tránh việc bấm nút Back trên trình duyệt bị out hẳn khỏi web ra ngoài
 */

export const linkingConfig = {
  prefixes: ['/'],
  config: {
    screens: {
      Welcome: '',
      Login: 'login',
      Register: 'register',
      Home: 'home',
      ClinicDashboard: 'clinic-dashboard',
      EMRDashboard: 'emr-dashboard',
      AIAnalysis: 'ai-analysis',
      Premium: 'premium',
      SystemAdmin: 'system-admin',
      AdminBackoffice: 'admin-backoffice',
      PatientRecords: 'patient-records',
      PatientDetail: 'patient-detail',
      Financials: 'financials',
      Support: 'support',
      MedicalRecordForm: 'medical-record-form',
      DocumentDetail: 'document-detail',
      RecordVault: 'record-vault',
      DocumentForm: 'document-form',
      ImagingHistory: 'imaging-history',
      ImagingResult: 'imaging-result',
      CreateImagingResult: 'create-imaging-result',
      DoctorPatientList: 'doctor-patient-list',
      NurseReception: 'nurse-reception',
      ActivateAccount: 'activate-account',
      DoctorWorkQueue: 'doctor-work-queue',
      HospitalOnboarding: 'hospital-onboarding',
      StaffManagement: 'staff-management',
      NursePatientDetail: 'nurse-patient-detail',
      DrugManagement: 'drug-management',
      StaffScheduling: 'staff-scheduling',
    },
  },
};

export default linkingConfig;
