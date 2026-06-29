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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    padding: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#15803D',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  metricsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricEmoji: {
    fontSize: 18,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 9,
    color: '#166534',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
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
  txDate: {
    fontSize: 11,
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
  btnCreate: {
    backgroundColor: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnCreateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportLeft: {
    flex: 1.5,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  reportSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  reportRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  reportValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 4,
  },
  reportDetailLink: {
    fontSize: 11,
    color: '#64748B',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  formCloseText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formInputGroup: {
    flex: 1,
  },
  formInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  formSectionSubtitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 10,
  },
  btnAddRow: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnAddRowText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  gridTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gridTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  gridTh: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  gridTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  gridTd: {
    fontSize: 12,
    color: '#0F172A',
  },
  gridTdInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginRight: 4,
    textAlign: 'center',
  },
  btnDeleteRow: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  btnDeleteRowText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  btnPrimary: {
    backgroundColor: '#15803D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#15803D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
  },
  modalCloseBtn: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginLeft: 10,
  },
  modalBody: {
    padding: 16,
  },
  modalMeta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  modalSummaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D',
    marginVertical: 10,
  },
  detailTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  detailTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  detailTh: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  detailTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailTd: {
    fontSize: 11,
    color: '#0F172A',
  },
});

export default FinancialsScreen;
