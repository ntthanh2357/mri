import React, { useState, useEffect } from 'react';
import { Platform, View, Text, ScrollView, StyleSheet } from 'react-native';
import '../tailwind-built.css';

import ResponsiveLayout from '../components/ResponsiveLayout';
import PageContainer from '../components/layout/PageContainer';
import AdminMetricsView from '../components/AdminMetricsView';
import AdminUsersView from '../components/AdminUsersView';
import AdminDatasetsView from '../components/AdminDatasetsView';
import AdminAuditLogsView from '../components/AdminAuditLogsView';
import AdminAIConfigView from '../components/AdminAIConfigView';
import AdminHospitalsView from '../components/AdminHospitalsView';
import AdminSaaSSuiteView from '../components/AdminSaaSSuiteView';

// Các mục quản trị nằm trong menu chung (ResponsiveLayout) dưới dạng AdminBackoffice?tab=…
const ADMIN_TABS = ['metrics', 'users', 'hospitals', 'datasets', 'audit-logs', 'saas-suite', 'ai-config'];

const AdminBackofficeScreen = ({ navigation, route }) => {
  const paramTab = route?.params?.tab;
  const [activeTab, setActiveTab] = useState(ADMIN_TABS.includes(paramTab) ? paramTab : 'metrics');

  // Bấm mục trong menu chung → params đổi → đổi view
  useEffect(() => {
    if (ADMIN_TABS.includes(paramTab)) setActiveTab(paramTab);
  }, [paramTab]);

  // Lối tắt từ Dashboard sang mục khác: giữ URL khớp mục đang xem
  const selectTab = (tab) => {
    setActiveTab(tab);
    navigation.setParams({ tab });
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeContainer}>
        <Text style={styles.nativeText}>Bảng điều khiển Admin Console chỉ được tối ưu hóa cho giao diện Web.</Text>
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute={`AdminBackoffice_${activeTab}`}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          {activeTab === 'metrics' && <AdminMetricsView onSelectTab={selectTab} />}
          {activeTab === 'users' && <AdminUsersView />}
          {activeTab === 'hospitals' && <AdminHospitalsView />}
          {activeTab === 'datasets' && <AdminDatasetsView />}
          {activeTab === 'audit-logs' && <AdminAuditLogsView />}
          {activeTab === 'saas-suite' && <AdminSaaSSuiteView />}
          {activeTab === 'ai-config' && <AdminAIConfigView />}
        </PageContainer>
      </ScrollView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { paddingTop: 24, paddingBottom: 40 },
  nativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  nativeText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  }
});

export default AdminBackofficeScreen;
