import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './FinancialsScreen.styles';

const FinancialsScreen = ({ navigation }) => {
  const services = [];
  const transactions = [];

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="Financials"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tài chính Bệnh viện</Text>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Metric Grid Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricRow}>
            {/* Card 1 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>💵</Text>
              </View>
              <Text style={styles.metricLabel}>Doanh thu tháng này</Text>
              <Text style={styles.metricVal}>0đ</Text>
            </View>

            {/* Card 2 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>💳</Text>
              </View>
              <Text style={styles.metricLabel}>Số giao dịch</Text>
              <Text style={styles.metricVal}>0</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Card 3 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>📈</Text>
              </View>
              <Text style={styles.metricLabel}>Trung bình / GD</Text>
              <Text style={styles.metricVal}>0đ</Text>
            </View>

            {/* Card 4 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>📉</Text>
              </View>
              <Text style={styles.metricLabel}>Hoàn tiền</Text>
              <Text style={styles.metricVal}>0đ</Text>
            </View>
          </View>
        </View>

        {/* Popular Services Chart */}
        <Text style={styles.sectionTitle}>Dịch vụ phổ biến (Tháng này)</Text>
        <View style={styles.chartCard}>
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có dữ liệu thống kê dịch vụ.</Text>
          </View>
        </View>

        {/* Transactions list */}
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
          <TouchableOpacity onPress={() => Alert.alert('Thông báo', 'Hiện tại chưa có giao dịch nào phát sinh.')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsCard}>
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có dữ liệu giao dịch thực tế.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

;

export default FinancialsScreen;
