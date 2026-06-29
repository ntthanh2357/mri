import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post, put } from '../services/api.service';
import styles from './FinancialsScreen.styles';

const DRUG_SUGGESTIONS = [
  { name: 'Keppra', unit: 'Viên' },
  { name: 'Depakine', unit: 'Viên' },
  { name: 'Tegretol', unit: 'Viên' },
  { name: 'Phenobarbital', unit: 'Viên' },
  { name: 'Diazepam', unit: 'Viên' },
  { name: 'Dexamethasone', unit: 'Viên' },
  { name: 'Donepezil', unit: 'Viên' },
];

const FinancialsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'revenue' | 'drugs'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Statistics & Transactions
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    transactionCount: 0,
    averageTransaction: 0,
    refunds: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Reports lists
  const [revenueReports, setRevenueReports] = useState([]);
  const [drugReports, setDrugReports] = useState([]);

  // Selected details modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsType, setDetailsType] = useState('revenue'); // 'revenue' | 'drug'

  // New Revenue Report Form State
  const [showRevenueForm, setShowRevenueForm] = useState(false);
  const [revMonth, setRevMonth] = useState(String(new Date().getMonth() + 1));
  const [revYear, setRevYear] = useState(String(new Date().getFullYear()));
  const [dailyRecords, setDailyRecords] = useState(
    Array.from({ length: 31 }, (_, i) => ({
      day: i + 1,
      patientCount: '0',
      revenue: '0',
      percentage: 0,
    }))
  );
  const [totalRevenue, setTotalRevenue] = useState(0);

  // New Drug Report Form State
  const [showDrugForm, setShowDrugForm] = useState(false);
  const [drugMonth, setDrugMonth] = useState(String(new Date().getMonth() + 1));
  const [drugYear, setDrugYear] = useState(String(new Date().getFullYear()));
  const [drugItems, setDrugItems] = useState([
    { drugName: 'Keppra', unit: 'Viên', quantity: '100', usedCount: '10' }
  ]);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'revenue') {
      fetchRevenueReports();
    } else if (activeTab === 'drugs') {
      fetchDrugReports();
    }
  }, [activeTab]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Fetch unpaid or paid invoices from the hospital to compute statistics
      const res = await get('/api/v1/invoices');
      if (res && res.invoices) {
        const invoices = res.invoices;
        const paid = invoices.filter(inv => inv.status === 'đã thanh toán');
        const totalPaid = paid.reduce((sum, inv) => sum + inv.totalAmount, 0);

        setStats({
          monthlyRevenue: totalPaid,
          transactionCount: paid.length,
          averageTransaction: paid.length > 0 ? Math.round(totalPaid / paid.length) : 0,
          refunds: 0,
        });

        // Format recent transactions
        const txs = invoices.slice(0, 10).map(inv => {
          const formattedDate = new Date(inv.updatedAt || inv.createdAt);
          const dateStr = `${formattedDate.getDate()}/${formattedDate.getMonth() + 1}/${formattedDate.getFullYear()}`;
          return {
            id: inv._id.toString().substring(18).toUpperCase(),
            patientName: inv.patientId?.profile?.name || 'Bệnh nhân',
            amount: inv.totalAmount,
            status: inv.status === 'đã thanh toán' ? 'success' : 'pending',
            date: dateStr,
          };
        });
        setRecentTransactions(txs);
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueReports = async () => {
    setLoading(true);
    try {
      const res = await get('/admin/reports/revenue');
      if (res && res.success) {
        setRevenueReports(res.reports || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrugReports = async () => {
    setLoading(true);
    try {
      const res = await get('/admin/reports/drugs');
      if (res && res.success) {
        setDrugReports(res.reports || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate percentages for revenue report
  const calculatePercentages = () => {
    let sum = 0;
    const updated = dailyRecords.map(rec => {
      const revVal = Number(rec.revenue) || 0;
      sum += revVal;
      return { ...rec, revenue: String(revVal), patientCount: String(Number(rec.patientCount) || 0) };
    });

    const finalRecords = updated.map(rec => {
      const revVal = Number(rec.revenue) || 0;
      const percentage = sum > 0 ? Number(((revVal / sum) * 100).toFixed(2)) : 0;
      return { ...rec, percentage };
    });

    setDailyRecords(finalRecords);
    setTotalRevenue(sum);
    Alert.alert('Thành công', `Đã tính toán xong tỷ lệ. Tổng doanh thu: ${sum.toLocaleString('vi-VN')}đ`);
  };

  const handleCreateRevenueReport = async () => {
    if (!revMonth || !revYear) {
      Alert.alert('Lỗi', 'Vui lòng nhập tháng và năm.');
      return;
    }

    setSubmitting(true);
    try {
      // Calculate total amount
      const total = dailyRecords.reduce((sum, rec) => sum + (Number(rec.revenue) || 0), 0);

      const payload = {
        month: Number(revMonth),
        year: Number(revYear),
        totalAmount: total,
        dailyRecords: dailyRecords.map(rec => ({
          day: rec.day,
          patientCount: Number(rec.patientCount) || 0,
          revenue: Number(rec.revenue) || 0,
          percentage: rec.percentage
        }))
      };

      const res = await post('/admin/reports/revenue', payload);
      if (res && res.success) {
        Alert.alert('Thành công', 'Đã lưu báo cáo doanh thu thành công!');
        setShowRevenueForm(false);
        fetchRevenueReports();
        fetchFinancialData();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể lưu báo cáo.');
      }
    } catch (err) {
      Alert.alert('Lỗi kết nối', err.message || 'Không thể kết nối máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDrugReport = async () => {
    if (!drugMonth || !drugYear) {
      Alert.alert('Lỗi', 'Vui lòng nhập tháng và năm.');
      return;
    }

    if (drugItems.length === 0) {
      Alert.alert('Lỗi', 'Cần thêm ít nhất một thuốc vào báo cáo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        month: Number(drugMonth),
        year: Number(drugYear),
        items: drugItems.map(item => ({
          drugName: item.drugName,
          unit: item.unit,
          quantity: Number(item.quantity) || 0,
          usedCount: Number(item.usedCount) || 0
        }))
      };

      const res = await post('/admin/reports/drugs', payload);
      if (res && res.success) {
        Alert.alert('Thành công', 'Đã lưu báo cáo sử dụng thuốc thành công!');
        setShowDrugForm(false);
        fetchDrugReports();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể lưu báo cáo.');
      }
    } catch (err) {
      Alert.alert('Lỗi kết nối', err.message || 'Không thể kết nối máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDrugRow = () => {
    setDrugItems([...drugItems, { drugName: 'Keppra', unit: 'Viên', quantity: '0', usedCount: '0' }]);
  };

  const removeDrugRow = (index) => {
    const updated = drugItems.filter((_, idx) => idx !== index);
    setDrugItems(updated);
  };

  const updateDrugItem = (index, key, val) => {
    const updated = [...drugItems];
    updated[index][key] = val;

    // Auto-fill unit if drug is chosen from default suggestions
    if (key === 'drugName') {
      const matched = DRUG_SUGGESTIONS.find(d => d.name.toLowerCase() === val.toLowerCase());
      if (matched) {
        updated[index]['unit'] = matched.unit;
      }
    }
    setDrugItems(updated);
  };

  const viewReportDetails = (report, type) => {
    setSelectedReport(report);
    setDetailsType(type);
    setDetailsModalVisible(true);
  };

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="ClinicDashboard"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {!isDesktop && (
            <TouchableOpacity onPress={() => navigation.navigate('ClinicDashboard')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Bảng điều khiển</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Báo cáo & Tài chính Phòng khám</Text>
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Tổng quan chung</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'revenue' && styles.activeTab]}
            onPress={() => setActiveTab('revenue')}
          >
            <Text style={[styles.tabText, activeTab === 'revenue' && styles.activeTabText]}>Báo cáo doanh thu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'drugs' && styles.activeTab]}
            onPress={() => setActiveTab('drugs')}
          >
            <Text style={[styles.tabText, activeTab === 'drugs' && styles.activeTabText]}>Báo cáo thuốc</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#15803D" style={{ marginVertical: 30 }} />}

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View>
              {/* Metric Grid Cards */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricRow}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricEmoji}>💵</Text>
                      <View style={styles.badgeGreen}>
                        <Text style={styles.badgeGreenText}>Hoạt động</Text>
                      </View>
                    </View>
                    <Text style={styles.metricLabel}>Doanh thu tháng này (lũy kế)</Text>
                    <Text style={styles.metricVal}>{stats.monthlyRevenue.toLocaleString('vi-VN')}đ</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricEmoji}>💳</Text>
                    </View>
                    <Text style={styles.metricLabel}>Giao dịch đã thanh toán</Text>
                    <Text style={styles.metricVal}>{stats.transactionCount}</Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricEmoji}>📈</Text>
                    </View>
                    <Text style={styles.metricLabel}>Giá trị trung bình / GD</Text>
                    <Text style={styles.metricVal}>{stats.averageTransaction.toLocaleString('vi-VN')}đ</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricEmoji}>📉</Text>
                    </View>
                    <Text style={styles.metricLabel}>Giao dịch hoàn trả</Text>
                    <Text style={styles.metricVal}>{stats.refunds.toLocaleString('vi-VN')}đ</Text>
                  </View>
                </View>
              </View>

              {/* Transactions List */}
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionTitle}>Các hóa đơn phát sinh gần đây</Text>
                <TouchableOpacity onPress={fetchFinancialData}>
                  <Text style={styles.viewAllText}>🔄 Làm mới</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.transactionsCard}>
                {recentTransactions.length === 0 ? (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Chưa có giao dịch thực tế nào được thực hiện hôm nay.</Text>
                  </View>
                ) : (
                  recentTransactions.map((tx, idx) => (
                    <View key={tx.id} style={[styles.txRow, idx === recentTransactions.length - 1 && styles.lastTxRow]}>
                      <View style={styles.txLeft}>
                        <Text style={styles.txId}>Hóa đơn #{tx.id} - {tx.patientName}</Text>
                        <Text style={styles.txDate}>{tx.date}</Text>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={styles.txAmount}>{tx.amount.toLocaleString('vi-VN')}đ</Text>
                        <View style={[styles.statusBadge, tx.status === 'success' ? styles.statusSuccess : styles.statusPending]}>
                          <Text style={[styles.statusText, tx.status === 'success' ? styles.statusSuccessText : styles.statusPendingText]}>
                            {tx.status === 'success' ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB 2: REVENUE REPORTS */}
          {activeTab === 'revenue' && !showRevenueForm && (
            <View>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionTitle}>Danh sách báo cáo doanh thu tháng</Text>
                <TouchableOpacity style={styles.btnCreate} onPress={() => setShowRevenueForm(true)}>
                  <Text style={styles.btnCreateText}>➕ Lập báo cáo mới</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reportsCard}>
                {revenueReports.length === 0 ? (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có dữ liệu báo cáo trước đây.</Text>
                  </View>
                ) : (
                  revenueReports.map((report) => (
                    <TouchableOpacity
                      key={report._id}
                      style={styles.reportRow}
                      onPress={() => viewReportDetails(report, 'revenue')}
                    >
                      <View style={styles.reportLeft}>
                        <Text style={styles.reportTitle}>Báo cáo doanh thu tháng {report.month}/{report.year}</Text>
                        <Text style={styles.reportSub}>Người lập: {report.author?.profile?.name || report.author?.email || 'N/A'}</Text>
                        <Text style={styles.reportDate}>Lập lúc: {new Date(report.createdAt).toLocaleString()}</Text>
                      </View>
                      <View style={styles.reportRight}>
                        <Text style={styles.reportValue}>{report.totalAmount.toLocaleString('vi-VN')}đ</Text>
                        <Text style={styles.reportDetailLink}>Xem chi tiết ➔</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB 2 FORM: CREATE REVENUE REPORT */}
          {activeTab === 'revenue' && showRevenueForm && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Lập báo cáo doanh thu tháng</Text>
                <TouchableOpacity onPress={() => setShowRevenueForm(false)}>
                  <Text style={styles.formCloseText}>✕ Đóng</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formInputsRow}>
                <View style={styles.formInputGroup}>
                  <Text style={styles.formInputLabel}>Tháng</Text>
                  <TextInput
                    style={styles.formInput}
                    value={revMonth}
                    onChangeText={setRevMonth}
                    keyboardType="numeric"
                    placeholder="1-12"
                  />
                </View>
                <View style={styles.formInputGroup}>
                  <Text style={styles.formInputLabel}>Năm</Text>
                  <TextInput
                    style={styles.formInput}
                    value={revYear}
                    onChangeText={setRevYear}
                    keyboardType="numeric"
                    placeholder="VD: 2026"
                  />
                </View>
              </View>

              <Text style={styles.formSectionSubtitle}>Nhập số liệu chi tiết từng ngày (1 - 31)</Text>

              <View style={styles.gridTable}>
                <View style={styles.gridTableHeader}>
                  <Text style={[styles.gridTh, { flex: 1 }]}>Ngày</Text>
                  <Text style={[styles.gridTh, { flex: 2 }]}>Số bệnh nhân</Text>
                  <Text style={[styles.gridTh, { flex: 3 }]}>Doanh thu (đ)</Text>
                  <Text style={[styles.gridTh, { flex: 2 }]}>Tỉ lệ (%)</Text>
                </View>

                {dailyRecords.map((rec, index) => (
                  <View key={rec.day} style={styles.gridTableRow}>
                    <Text style={[styles.gridTd, { flex: 1, fontWeight: 'bold' }]}>Ngày {rec.day}</Text>
                    <TextInput
                      style={[styles.gridTdInput, { flex: 2 }]}
                      value={rec.patientCount}
                      onChangeText={(val) => {
                        const updated = [...dailyRecords];
                        updated[index].patientCount = val;
                        setDailyRecords(updated);
                      }}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.gridTdInput, { flex: 3 }]}
                      value={rec.revenue}
                      onChangeText={(val) => {
                        const updated = [...dailyRecords];
                        updated[index].revenue = val;
                        setDailyRecords(updated);
                      }}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.gridTd, { flex: 2, textAlign: 'center' }]}>{rec.percentage}%</Text>
                  </View>
                ))}
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.btnSecondary} onPress={calculatePercentages}>
                  <Text style={styles.btnSecondaryText}>📊 Tính tỉ lệ & Tổng</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateRevenueReport} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnPrimaryText}>💾 Gửi báo cáo</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 3: DRUG REPORTS */}
          {activeTab === 'drugs' && !showDrugForm && (
            <View>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionTitle}>Danh sách báo cáo sử dụng thuốc</Text>
                <TouchableOpacity style={styles.btnCreate} onPress={() => setShowDrugForm(true)}>
                  <Text style={styles.btnCreateText}>➕ Lập báo cáo mới</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reportsCard}>
                {drugReports.length === 0 ? (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Không có dữ liệu báo cáo trước đây.</Text>
                  </View>
                ) : (
                  drugReports.map((report) => (
                    <TouchableOpacity
                      key={report._id}
                      style={styles.reportRow}
                      onPress={() => viewReportDetails(report, 'drug')}
                    >
                      <View style={styles.reportLeft}>
                        <Text style={styles.reportTitle}>Báo cáo sử dụng thuốc tháng {report.month}/{report.year}</Text>
                        <Text style={styles.reportSub}>Người lập: {report.author?.profile?.name || report.author?.email || 'N/A'}</Text>
                        <Text style={styles.reportDate}>Lập lúc: {new Date(report.createdAt).toLocaleString()}</Text>
                      </View>
                      <View style={styles.reportRight}>
                        <Text style={styles.reportValue}>{report.items?.length || 0} loại thuốc</Text>
                        <Text style={styles.reportDetailLink}>Xem chi tiết ➔</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB 3 FORM: CREATE DRUG REPORT */}
          {activeTab === 'drugs' && showDrugForm && (
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Lập báo cáo sử dụng thuốc</Text>
                <TouchableOpacity onPress={() => setShowDrugForm(false)}>
                  <Text style={styles.formCloseText}>✕ Đóng</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formInputsRow}>
                <View style={styles.formInputGroup}>
                  <Text style={styles.formInputLabel}>Tháng</Text>
                  <TextInput
                    style={styles.formInput}
                    value={drugMonth}
                    onChangeText={setDrugMonth}
                    keyboardType="numeric"
                    placeholder="1-12"
                  />
                </View>
                <View style={styles.formInputGroup}>
                  <Text style={styles.formInputLabel}>Năm</Text>
                  <TextInput
                    style={styles.formInput}
                    value={drugYear}
                    onChangeText={setDrugYear}
                    keyboardType="numeric"
                    placeholder="VD: 2026"
                  />
                </View>
              </View>

              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionSubtitle}>Danh sách thuốc sử dụng</Text>
                <TouchableOpacity style={styles.btnAddRow} onPress={addDrugRow}>
                  <Text style={styles.btnAddRowText}>➕ Thêm thuốc</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.gridTable}>
                <View style={styles.gridTableHeader}>
                  <Text style={[styles.gridTh, { flex: 3 }]}>Thuốc</Text>
                  <Text style={[styles.gridTh, { flex: 2 }]}>Đơn vị</Text>
                  <Text style={[styles.gridTh, { flex: 2 }]}>Số lượng</Text>
                  <Text style={[styles.gridTh, { flex: 2 }]}>Số lần dùng</Text>
                  <Text style={[styles.gridTh, { flex: 1 }]}></Text>
                </View>

                {drugItems.map((item, idx) => (
                  <View key={idx} style={styles.gridTableRow}>
                    <TextInput
                      style={[styles.gridTdInput, { flex: 3 }]}
                      value={item.drugName}
                      onChangeText={(val) => updateDrugItem(idx, 'drugName', val)}
                      placeholder="Tên thuốc"
                    />
                    <TextInput
                      style={[styles.gridTdInput, { flex: 2 }]}
                      value={item.unit}
                      onChangeText={(val) => updateDrugItem(idx, 'unit', val)}
                      placeholder="VD: Viên"
                    />
                    <TextInput
                      style={[styles.gridTdInput, { flex: 2 }]}
                      value={item.quantity}
                      onChangeText={(val) => updateDrugItem(idx, 'quantity', val)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.gridTdInput, { flex: 2 }]}
                      value={item.usedCount}
                      onChangeText={(val) => updateDrugItem(idx, 'usedCount', val)}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.btnDeleteRow} onPress={() => removeDrugRow(idx)}>
                      <Text style={styles.btnDeleteRowText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateDrugReport} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnPrimaryText}>💾 Gửi báo cáo</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* DETAILS MODAL */}
        <Modal
          visible={detailsModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {detailsType === 'revenue'
                    ? `Chi tiết báo cáo doanh thu - Tháng ${selectedReport?.month}/${selectedReport?.year}`
                    : `Chi tiết báo cáo sử dụng thuốc - Tháng ${selectedReport?.month}/${selectedReport?.year}`
                  }
                </Text>
                <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                  <Text style={styles.modalCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalMeta}>Người lập: {selectedReport?.author?.profile?.name || selectedReport?.author?.email}</Text>
                <Text style={styles.modalMeta}>Thời gian lập: {selectedReport ? new Date(selectedReport.createdAt).toLocaleString() : ''}</Text>

                {detailsType === 'revenue' && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSummaryText}>Tổng doanh thu: {selectedReport?.totalAmount?.toLocaleString('vi-VN')}đ</Text>

                    <View style={styles.detailTable}>
                      <View style={styles.detailTableHeader}>
                        <Text style={[styles.detailTh, { flex: 1 }]}>Ngày</Text>
                        <Text style={[styles.detailTh, { flex: 2, textAlign: 'center' }]}>Số BN</Text>
                        <Text style={[styles.detailTh, { flex: 3, textAlign: 'right' }]}>Doanh thu</Text>
                        <Text style={[styles.detailTh, { flex: 2, textAlign: 'right' }]}>Tỉ lệ</Text>
                      </View>

                      {selectedReport?.dailyRecords?.map((rec) => (
                        <View key={rec.day} style={styles.detailTableRow}>
                          <Text style={[styles.detailTd, { flex: 1, fontWeight: 'bold' }]}>Ngày {rec.day}</Text>
                          <Text style={[styles.detailTd, { flex: 2, textAlign: 'center' }]}>{rec.patientCount}</Text>
                          <Text style={[styles.detailTd, { flex: 3, textAlign: 'right' }]}>{rec.revenue.toLocaleString('vi-VN')}đ</Text>
                          <Text style={[styles.detailTd, { flex: 2, textAlign: 'right' }]}>{rec.percentage}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {detailsType === 'drug' && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.detailTable}>
                      <View style={styles.detailTableHeader}>
                        <Text style={[styles.detailTh, { flex: 3 }]}>Thuốc</Text>
                        <Text style={[styles.detailTh, { flex: 2, textAlign: 'center' }]}>Đơn vị</Text>
                        <Text style={[styles.detailTh, { flex: 2, textAlign: 'center' }]}>Số lượng</Text>
                        <Text style={[styles.detailTh, { flex: 2, textAlign: 'center' }]}>Số lần dùng</Text>
                      </View>

                      {selectedReport?.items?.map((item, idx) => (
                        <View key={idx} style={styles.detailTableRow}>
                          <Text style={[styles.detailTd, { flex: 3, fontWeight: 'bold' }]}>{item.drugName}</Text>
                          <Text style={[styles.detailTd, { flex: 2, textAlign: 'center' }]}>{item.unit}</Text>
                          <Text style={[styles.detailTd, { flex: 2, textAlign: 'center' }]}>{item.quantity}</Text>
                          <Text style={[styles.detailTd, { flex: 2, textAlign: 'center' }]}>{item.usedCount}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};



export default FinancialsScreen;
