import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef } from '../utils/navigationRef';
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
const Stack = createNativeStackNavigator();

const AppNavigator = () => {
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
