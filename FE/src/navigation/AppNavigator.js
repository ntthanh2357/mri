import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { navigationRef, navigateTo } from '../utils/navigationRef';
import { setAuthToken } from '../services/api.service';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ClinicDashboardScreen from '../screens/ClinicDashboardScreen';
import AIAnalysisScreen from '../screens/AIAnalysisScreen';
import PremiumScreen from '../screens/PremiumScreen';
import SystemAdminScreen from '../screens/SystemAdminScreen';
import PatientRecordsScreen from '../screens/PatientRecordsScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import FinancialsScreen from '../screens/FinancialsScreen';
import SupportScreen from '../screens/SupportScreen';
import MedicalRecordFormScreen from '../screens/MedicalRecordFormScreen';
import DocumentDetailScreen from '../screens/DocumentDetailScreen';
import Colors from '../constants/colors';
import AdminBackofficeScreen from '../screens/AdminBackofficeScreen';
import EMRDashboardScreen from '../screens/EMRDashboardScreen';
import ImagingHistoryScreen from '../screens/ImagingHistoryScreen';
import ImagingResultScreen from '../screens/ImagingResultScreen';
import CreateImagingResultScreen from '../screens/CreateImagingResultScreen';
import DoctorPatientListScreen from '../screens/DoctorPatientListScreen';
import ReceptionistDashboardScreen from '../screens/ReceptionistDashboardScreen';
import ActivateAccountScreen from '../screens/ActivateAccountScreen';
import DoctorWorkQueueScreen from '../screens/DoctorWorkQueueScreen';
import TechnicianQueueScreen from '../screens/TechnicianQueueScreen';
import HospitalOnboardingScreen from '../screens/HospitalOnboardingScreen';

import StaffManagementScreen from '../screens/StaffManagementScreen';
import NursePatientDetailScreen from '../screens/NursePatientDetailScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let timeoutId;
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 phút

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleSessionTimeout, TIMEOUT_MS);
    };

    const handleSessionTimeout = async () => {
      console.log('Session timed out due to inactivity.');
      await setAuthToken('');
      navigateTo('Login');
      alert('Phiên làm việc của bạn đã tự động đóng sau 15 phút không tương tác để bảo mật thông tin bệnh án.');
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: { backgroundColor: '#15803D' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NeuroScan AI' }} />
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
        <Stack.Screen name="ImagingHistory" component={ImagingHistoryScreen} options={{ title: 'Lịch sử phim chụp', headerShown: false }} />
        <Stack.Screen name="ImagingResult" component={ImagingResultScreen} options={{ title: 'Chi tiết phim chụp', headerShown: false }} />
        <Stack.Screen name="CreateImagingResult" component={CreateImagingResultScreen} options={{ title: 'Nhập kết quả phim chụp', headerShown: false }} />
        <Stack.Screen name="DoctorPatientList" component={DoctorPatientListScreen} options={{ title: 'Danh sách bệnh nhân', headerShown: false }} />
        <Stack.Screen name="ReceptionistDashboard" component={ReceptionistDashboardScreen} options={{ title: 'Lễ tân', headerShown: false }} />
        <Stack.Screen name="ActivateAccount" component={ActivateAccountScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DoctorWorkQueue" component={DoctorWorkQueueScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TechnicianQueue" component={TechnicianQueueScreen} options={{ headerShown: false }} />
        <Stack.Screen name="HospitalOnboarding" component={HospitalOnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="StaffManagement" component={StaffManagementScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NursePatientDetail" component={NursePatientDetailScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
