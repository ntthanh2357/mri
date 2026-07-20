import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Colors from '../constants/colors';
import { setAuthToken } from '../services/api.service';
import { apiRequest } from '../utils/apiClient';

import AdminMetricsView from '../components/AdminMetricsView';
import AdminUsersView from '../components/AdminUsersView';
import AdminHospitalsView from '../components/AdminHospitalsView';
import AdminDatasetsView from '../components/AdminDatasetsView';
import AdminAuditLogsView from '../components/AdminAuditLogsView';
import AdminSaaSSuiteView from '../components/AdminSaaSSuiteView';
import AdminAIConfigView from '../components/AdminAIConfigView';

const TABS = [
  { key: 'metrics', label: 'Dashboard', icon: '📊' },
  { key: 'users', label: 'Người dùng', icon: '👥' },
  { key: 'hospitals', label: 'Bệnh viện', icon: '🏥' },
  { key: 'datasets', label: 'Dataset', icon: '🗄️' },
  { key: 'audit-logs', label: 'Audit Logs', icon: '📋' },
  { key: 'saas-suite', label: 'SaaS Suite', icon: '⚙️' },
  { key: 'ai-config', label: 'AI Config', icon: '🧠' },
];

const AdminBackofficeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('metrics');
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => {
        if (data && data.user) {
          setAdminUser(data.user);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch admin profile:', err);
      });
  }, []);

  const handleLogout = async () => {
    await setAuthToken('');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'metrics':
        return <AdminMetricsView onSelectTab={(tab) => setActiveTab(tab)} />;
      case 'users':
        return <AdminUsersView />;
      case 'hospitals':
        return <AdminHospitalsView />;
      case 'datasets':
        return <AdminDatasetsView />;
      case 'audit-logs':
        return <AdminAuditLogsView />;
      case 'saas-suite':
        return <AdminSaaSSuiteView />;
      case 'ai-config':
        return <AdminAIConfigView />;
      default:
        return null;
    }
  };

  const initials = adminUser?.profile?.name
    ? adminUser.profile.name.split(' ').filter(Boolean).map((w) => w[0]).join('').substring(0, 2).toUpperCase()
    : adminUser?.email
      ? adminUser.email.substring(0, 2).toUpperCase()
      : 'AD';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>🛡️</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>NeuroScan AI</Text>
            <Text style={styles.headerSubtitle}>Admin Console</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Thoát</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderActiveView()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.black,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    fontSize: 16,
  },
  headerTitle: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.black,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexGrow: 0,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBarContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
  },
  tabIcon: {
    fontSize: 12,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
});

export default AdminBackofficeScreen;
