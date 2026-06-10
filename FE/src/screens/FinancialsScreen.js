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

const FinancialsScreen = ({ navigation }) => {
  const services = [
    { name: 'Báo cáo PDF', value: 420, maxVal: 500 },
    { name: 'MRI Não', value: 340, maxVal: 500 },
    { name: 'Tư vấn AI', value: 290, maxVal: 500 },
    { name: 'CT Đầu', value: 210, maxVal: 500 },
    { name: 'MRI Cột sống', value: 180, maxVal: 500 },
  ];

  const transactions = [
    { id: 'TX-8821', name: 'Nguyễn Văn A', service: 'Phân tích MRI AI', amount: '850.000đ', date: '01/06/2026', method: 'Chuyển khoản', isSuccess: true },
    { id: 'TX-8820', name: 'Trần Thị B', service: 'Báo cáo PDF chuyên sâu', amount: '320.000đ', date: '01/06/2026', method: 'Thẻ tín dụng', isSuccess: true },
    { id: 'TX-8819', name: 'Lê Minh C', service: 'Gói Premium năm', amount: '99.000đ', date: '31/05/2026', method: 'Ví điện tử', isSuccess: true },
    { id: 'TX-8818', name: 'Phạm Thị D', service: 'Tư vấn AI 24/7', amount: '150.000đ', date: '31/05/2026', method: 'Tiền mặt', isSuccess: false },
  ];

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
            <Text style={styles.headerTitle}>Tài chính Phòng khám</Text>
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
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>+34%</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>Doanh thu tháng 6</Text>
              <Text style={styles.metricVal}>89Mđ</Text>
            </View>

            {/* Card 2 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>💳</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>+12%</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>Số giao dịch</Text>
              <Text style={styles.metricVal}>1,042</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            {/* Card 3 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>📈</Text>
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>+8%</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>Trung bình / GD</Text>
              <Text style={styles.metricVal}>85,000đ</Text>
            </View>

            {/* Card 4 */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricEmoji}>📉</Text>
                <View style={styles.badgeRed}>
                  <Text style={styles.badgeRedText}>-2%</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>Hoàn tiền</Text>
              <Text style={styles.metricVal}>3.2Mđ</Text>
            </View>
          </View>
        </View>

        {/* Popular Services Chart */}
        <Text style={styles.sectionTitle}>Dịch vụ phổ biến (Tháng này)</Text>
        <View style={styles.chartCard}>
          {services.map((item, index) => {
            const pct = (item.value / item.maxVal) * 100;
            return (
              <View key={index} style={styles.chartRow}>
                <Text style={styles.chartLabel}>{item.name}</Text>
                <View style={styles.barContainer}>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{item.value}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Transactions list */}
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
          <TouchableOpacity onPress={() => Alert.alert('Tất cả giao dịch', 'Lịch sử giao dịch chi tiết đang tải...')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsCard}>
          {transactions.map((tx, idx) => (
            <View key={tx.id} style={[styles.txRow, idx === transactions.length - 1 && styles.lastTxRow]}>
              <View style={styles.txLeft}>
                <Text style={styles.txId}>{tx.id} • {tx.name}</Text>
                <Text style={styles.txSub}>{tx.service} ({tx.method})</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>{tx.amount}</Text>
                <View style={[styles.statusBadge, tx.isSuccess ? styles.statusSuccess : styles.statusPending]}>
                  <Text style={[styles.statusText, tx.isSuccess ? styles.statusSuccessText : styles.statusPendingText]}>
                    {tx.isSuccess ? 'Thành công' : 'Đang xử lý'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricEmoji: {
    fontSize: 16,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 9,
    color: '#166534',
    fontWeight: 'bold',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeRedText: {
    fontSize: 9,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  chartRow: {
    gap: 6,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 5,
  },
  barValue: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    minWidth: 24,
    textAlign: 'right',
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastTxRow: {
    borderBottomWidth: 0,
  },
  txLeft: {
    flex: 1,
  },
  txId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  txSub: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 4,
  },
  txDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusSuccessText: {
    color: '#166534',
  },
  statusPendingText: {
    color: '#B45309',
  },
});

export default FinancialsScreen;
