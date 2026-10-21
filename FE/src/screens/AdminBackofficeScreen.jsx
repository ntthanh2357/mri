import React, { useState, useEffect } from 'react';
import { Platform, View, Text, ScrollView, StyleSheet } from 'react-native';
import '../tailwind-built.css';

import ResponsiveLayout from '../components/ResponsiveLayout';
import PageContainer from '../components/layout/PageContainer';
import { StaffBanner, RECEPTION_IMAGES, LiveClock, PillTabs } from '../components/reception/ReceptionUI';
import { LayoutDashboard, Users, Building2, Database, ClipboardList, Sliders, Brain } from 'lucide-react';

// Banner từng mục quản trị: ảnh & tông màu riêng, cùng phong cách các trang nhân viên
const ADMIN_BANNER = {
  metrics: { image: 'office', tone: 'navy', eyebrow: 'Quản trị hệ thống', icon: LayoutDashboard, short: 'Tổng quan' },
  users: { image: 'lobby', tone: 'indigo', eyebrow: 'Tài khoản', icon: Users, short: 'Người dùng' },
  hospitals: { image: 'corridor', tone: 'ocean', eyebrow: 'Mạng lưới bệnh viện', icon: Building2, short: 'Bệnh viện' },
  datasets: { image: 'mriFilms', tone: 'teal', eyebrow: 'Dữ liệu huấn luyện', icon: Database, short: 'Dataset' },
  'audit-logs': { image: 'doctorDesk', tone: 'plum', eyebrow: 'Kiểm toán', icon: ClipboardList, short: 'Nhật ký' },
  'saas-suite': { image: 'support', tone: 'amber', eyebrow: 'Vận hành SaaS', icon: Sliders, short: 'SaaS Suite' },
  'ai-config': { image: 'mriDiscuss', tone: 'indigo', eyebrow: 'Trí tuệ nhân tạo', icon: Brain, short: 'AI & Chatbot' },
};
import AdminMetricsView from '../components/AdminMetricsView';
import AdminUsersView from '../components/AdminUsersView';
import AdminDatasetsView from '../components/AdminDatasetsView';
import AdminAuditLogsView from '../components/AdminAuditLogsView';
import AdminAIConfigView from '../components/AdminAIConfigView';
import AdminHospitalsView from '../components/AdminHospitalsView';
import AdminSaaSSuiteView from '../components/AdminSaaSSuiteView';

// Các mục quản trị nằm trong menu chung (ResponsiveLayout) dưới dạng AdminBackoffice?tab=…
const ADMIN_TABS = ['metrics', 'users', 'hospitals', 'datasets', 'audit-logs', 'saas-suite', 'ai-config'];
const ADMIN_HEADERS = {
  metrics: ['Tổng quan hệ thống', 'Người dùng, bệnh viện, lượt quét AI và doanh thu trên toàn hệ thống.'],
  users: ['Người dùng', 'Tra cứu tài khoản, xem chi tiết và khóa hoặc mở khóa đăng nhập.'],
  hospitals: ['Bệnh viện', 'Cấp tài khoản tạm, theo dõi onboarding và xác thực bệnh viện.'],
  datasets: ['Dataset', 'Tạo, định giá và quản lý dữ liệu huấn luyện.'],
  'audit-logs': ['Nhật ký hệ thống', 'Theo dõi hoạt động trên hệ thống và ẩn danh dữ liệu.'],
  'saas-suite': ['SaaS Suite', 'Gói dịch vụ, giám sát SLA, sao lưu, phiên bản mô hình AI và thông báo hệ thống.'],
  'ai-config': ['Huấn luyện & Chatbot AI', 'Thống kê ca AI đúng/sai, kích hoạt học lại và cấu hình trợ lý AI.'],
};

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

  // [FIX 0022] Phòng thủ crash trắng màn: nếu activeTab nhận giá trị ngoài
  // ADMIN_TABS (do shortcut truyền sai tên tab) thì ADMIN_HEADERS[tab] là undefined
  // → TypeError khi đọc [0] → React unmount toàn bộ app không error boundary.
  const safeTab = ADMIN_TABS.includes(activeTab) ? activeTab : 'metrics';

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeContainer}>
        <Text style={styles.nativeText}>Bảng điều khiển Admin Console chỉ được tối ưu hóa cho giao diện Web.</Text>
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute={`AdminBackoffice_${safeTab}`}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          <View style={styles.header}>
            <StaffBanner
              compact={safeTab !== 'metrics'}
              image={RECEPTION_IMAGES[ADMIN_BANNER[safeTab].image]}
              tone={ADMIN_BANNER[safeTab].tone}
              eyebrow={ADMIN_BANNER[safeTab].eyebrow}
              title={ADMIN_HEADERS[safeTab][0]}
              subtitle={ADMIN_HEADERS[safeTab][1]}
              right={safeTab === 'metrics' ? <LiveClock label="Hệ thống đang chạy" shift={false} /> : null}
            >
              <View style={{ height: 34 }} />
            </StaffBanner>
            <PillTabs
              tabs={ADMIN_TABS.map((k) => ({ key: k, label: ADMIN_BANNER[k].short, icon: ADMIN_BANNER[k].icon }))}
              value={safeTab}
              onChange={selectTab}
            />
          </View>
          {safeTab === 'metrics' && <AdminMetricsView onSelectTab={selectTab} />}
          {safeTab === 'users' && <AdminUsersView />}
          {safeTab === 'hospitals' && <AdminHospitalsView />}
          {safeTab === 'datasets' && <AdminDatasetsView />}
          {safeTab === 'audit-logs' && <AdminAuditLogsView />}
          {safeTab === 'saas-suite' && <AdminSaaSSuiteView />}
          {safeTab === 'ai-config' && <AdminAIConfigView />}
        </PageContainer>
      </ScrollView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { paddingTop: 24, paddingBottom: 40 },
  header: { marginBottom: 20 },
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
