/**
 * ============================================================================
 * STAFF PORTAL — Không gian làm việc nội bộ (B2B) · NeuroScan AI
 * ============================================================================
 * Navigator riêng cho cổng nội bộ, gắn tại tiền tố URL /staff:
 *   /staff            → StaffLogin (đăng nhập nội bộ, 2 lớp bắt buộc)
 *   /staff/home       → Bảng điều khiển nhân viên (theo vai trò)
 *   /staff/...        → Các phân hệ lâm sàng nội bộ
 *
 * Tách khỏi AppNavigator (cổng bệnh nhân /) nhằm:
 *  - Không lộ giao diện nội bộ trên đường link phổ thông.
 *  - URL namespace độc lập, dễ áp đặt chính sách (WAF / VPN / IP allowlist
 *    cho /staff ở tầng hạ tầng khi triển khai thật).
 *  - Phiên nội bộ tự đóng sau 15 phút không tương tác.
 * ============================================================================
 */
import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef, resetTo } from '../utils/navigationRef';
import { get, setAuthToken } from '../services/api.service';
import performLogout from '../utils/logout';

import StaffLoginScreen from '../screens/StaffLoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ClinicDashboardScreen from '../screens/ClinicDashboardScreen';
import EMRDashboardScreen from '../screens/EMRDashboardScreen';
import AIAnalysisScreen from '../screens/AIAnalysisScreen';
import PremiumScreen from '../screens/PremiumScreen';
import SystemAdminScreen from '../screens/SystemAdminScreen';
import AdminBackofficeScreen from '../screens/AdminBackofficeScreen';
import PatientRecordsScreen from '../screens/PatientRecordsScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import FinancialsScreen from '../screens/FinancialsScreen';
import SupportScreen from '../screens/SupportScreen';
import MedicalRecordFormScreen from '../screens/MedicalRecordFormScreen';
import DocumentDetailScreen from '../screens/DocumentDetailScreen';
import RecordVaultScreen from '../screens/RecordVaultScreen';
import DocumentFormScreen from '../screens/DocumentFormScreen';
import ImagingHistoryScreen from '../screens/ImagingHistoryScreen';
import ImagingResultScreen from '../screens/ImagingResultScreen';
import CreateImagingResultScreen from '../screens/CreateImagingResultScreen';
import DoctorPatientListScreen from '../screens/DoctorPatientListScreen';
import NurseReceptionScreen from '../screens/NurseReceptionScreen';
import ActivateAccountScreen from '../screens/ActivateAccountScreen';
import DoctorWorkQueueScreen from '../screens/DoctorWorkQueueScreen';
import HospitalOnboardingScreen from '../screens/HospitalOnboardingScreen';
import StaffManagementScreen from '../screens/StaffManagementScreen';
import NursePatientDetailScreen from '../screens/NursePatientDetailScreen';
import DrugManagementScreen from '../screens/DrugManagementScreen';
import StaffSchedulingScreen from '../screens/StaffSchedulingScreen';

export const staffLinkingConfig = {
  prefixes: ['/'],
  config: {
    screens: {
      // Tiền tố 'staff/' nhúng trực tiếp vào path để React Navigation GHI đúng
      // URL /staff/* khi điều hướng (prefixes chỉ có tác dụng khi ĐỌC URL).
      StaffLogin: 'staff',
      Home: 'staff/home',
      ClinicDashboard: 'staff/clinic-dashboard',
      EMRDashboard: 'staff/emr-dashboard',
      AIAnalysis: 'staff/ai-analysis',
      Premium: 'staff/premium',
      SystemAdmin: 'staff/system-admin',
      AdminBackoffice: 'staff/admin-backoffice',
      PatientRecords: 'staff/patient-records',
      PatientDetail: 'staff/patient-detail',
      Financials: 'staff/financials',
      Support: 'staff/support',
      MedicalRecordForm: 'staff/medical-record-form',
      DocumentDetail: 'staff/document-detail',
      RecordVault: 'staff/record-vault',
      DocumentForm: 'staff/document-form',
      ImagingHistory: 'staff/imaging-history',
      ImagingResult: 'staff/imaging-result',
      CreateImagingResult: 'staff/create-imaging-result',
      DoctorPatientList: 'staff/doctor-patient-list',
      NurseReception: 'staff/nurse-reception',
      ActivateAccount: 'staff/activate-account',
      DoctorWorkQueue: 'staff/doctor-work-queue',
      HospitalOnboarding: 'staff/hospital-onboarding',
      StaffManagement: 'staff/staff-management',
      NursePatientDetail: 'staff/nurse-patient-detail',
      DrugManagement: 'staff/drug-management',
      StaffScheduling: 'staff/staff-scheduling',
    },
  },
};

const Stack = createNativeStackNavigator();

const StaffPortalNavigator = () => {
  // LỚP GIÁM SÁT CỔNG NỘI BỘ:
  // Token bệnh nhân (nếu deep-link /staff/* khi đang đăng nhập cổng phổ thông)
  // sẽ bị tước ngay và đẩy về màn đăng nhập nội bộ — nhân viên mới được vào.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await get('/auth/me');
        const role = (data && (data.user?.role || data.role)) || null;
        if (!cancelled && role === 'patient') {
          // Tước phiên bệnh nhân khỏi cổng nội bộ: hủy cả phía BE (cookie
          // HttpOnly) lẫn token local, không chỉ xóa local.
          await performLogout();
          resetTo('StaffLogin');
          Alert.alert(
            'Truy cập bị từ chối',
            'Tài khoản Bệnh nhân không thể truy cập Cổng nội bộ. Vui lòng đăng nhập bằng tài khoản Nhân viên Y tế.',
            [{ text: 'Đã hiểu' }]
          );
        }
      } catch (e) {
        // Chưa đăng nhập / token hết hạn → StaffLogin sẽ hướng dẫn đăng nhập nội bộ
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Phiên nội bộ: tự đóng sau 15 phút không tương tác (chung chuẩn với cổng bệnh nhân)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let timeoutId;
    const TIMEOUT_MS = 15 * 60 * 1000;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleSessionTimeout, TIMEOUT_MS);
    };

    const handleSessionTimeout = async () => {
      try { await performLogout(); } catch (e) { /* bỏ qua */ }
      resetTo('StaffLogin');
      Alert.alert(
        'Phiên nội bộ đã đóng',
        'Phiên làm việc của bạn đã tự động đóng sau 15 phút không tương tác để bảo mật dữ liệu bệnh án.',
        [{ text: 'Đăng nhập lại' }]
      );
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'popstate'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef} linking={staffLinkingConfig}>
      <Stack.Navigator
        initialRouteName="StaffLogin"
        screenOptions={{
          headerStyle: { backgroundColor: '#0B0F17' },
          headerTintColor: '#22D3EE',
          headerTitleStyle: { fontWeight: 'bold' },
          headerBackTitle: 'Quay lại',
        }}
      >
        <Stack.Screen name="StaffLogin" component={StaffLoginScreen} options={{ headerShown: false, title: 'NeuroScan AI — Cổng Nội Bộ' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NeuroScan AI — Nội bộ', headerShown: false }} />
        <Stack.Screen name="ClinicDashboard" component={ClinicDashboardScreen} options={{ title: 'Phòng khám', headerShown: false }} />
        <Stack.Screen name="EMRDashboard" component={EMRDashboardScreen} options={{ title: 'EMR Management', headerShown: false }} />
        <Stack.Screen name="AIAnalysis" component={AIAnalysisScreen} options={{ title: 'Phân tích AI', headerShown: false }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: 'Hội viên Premium', headerShown: false }} />
        <Stack.Screen name="SystemAdmin" component={SystemAdminScreen} options={{ title: 'Hệ thống Quản trị', headerShown: false }} />
        <Stack.Screen name="AdminBackoffice" component={AdminBackofficeScreen} options={{ title: 'Admin Backoffice', headerShown: false }} />
        <Stack.Screen name="PatientRecords" component={PatientRecordsScreen} options={{ title: 'Hồ sơ bệnh nhân', headerShown: false }} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: 'Chi tiết bệnh án', headerShown: false }} />
        <Stack.Screen name="Financials" component={FinancialsScreen} options={{ title: 'Tài chính', headerShown: false }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Hỗ trợ kỹ thuật', headerShown: false }} />
        <Stack.Screen name="MedicalRecordForm" component={MedicalRecordFormScreen} options={{ title: 'Bệnh án Ung thư Não', headerShown: false }} />
        <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RecordVault" component={RecordVaultScreen} options={{ title: 'Khai báo bệnh án', headerShown: false }} />
        <Stack.Screen name="DocumentForm" component={DocumentFormScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ImagingHistory" component={ImagingHistoryScreen} options={{ title: 'Lịch sử phim chụp', headerShown: false }} />
        <Stack.Screen name="ImagingResult" component={ImagingResultScreen} options={{ title: 'Chi tiết phim chụp', headerShown: false }} />
        <Stack.Screen name="CreateImagingResult" component={CreateImagingResultScreen} options={{ title: 'Nhập kết quả phim chụp', headerShown: false }} />
        <Stack.Screen name="DoctorPatientList" component={DoctorPatientListScreen} options={{ title: 'Danh sách bệnh nhân', headerShown: false }} />
        <Stack.Screen name="NurseReception" component={NurseReceptionScreen} options={{ title: 'Điều dưỡng & Tiếp đón', headerShown: false }} />
        <Stack.Screen name="ActivateAccount" component={ActivateAccountScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DoctorWorkQueue" component={DoctorWorkQueueScreen} options={{ headerShown: false }} />
        <Stack.Screen name="HospitalOnboarding" component={HospitalOnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="StaffManagement" component={StaffManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NursePatientDetail" component={NursePatientDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DrugManagement" component={DrugManagementScreen} options={{ title: 'Quản lý kho thuốc', headerShown: false }} />
        <Stack.Screen name="StaffScheduling" component={StaffSchedulingScreen} options={{ title: 'Lịch làm việc nhân sự', headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default StaffPortalNavigator;
