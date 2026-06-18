import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  useWindowDimensions,
  Platform
} from 'react-native';
import { get, post } from '../services/api.service';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';

const PatientDetailScreen = ({ route, navigation }) => {
  const patientId = route.params?.patientId;
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('vitals'); // 'vitals' hoặc 'lab'

  // State cho form ghi nhận sinh hiệu mới
  const [pulseInput, setPulseInput] = useState('');
  const [systolicInput, setSystolicInput] = useState('');
  const [diastolicInput, setDiastolicInput] = useState('');
  const [spo2Input, setSpo2Input] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [isSubmittingVital, setIsSubmittingVital] = useState(false);

  // State cho LIS Simulator
  const [biomarkerList, setBiomarkerList] = useState([]);
  const [selectedBiomarkerCode, setSelectedBiomarkerCode] = useState('');
  const [customLisValue, setCustomLisValue] = useState('');
  const [customValidation, setCustomValidation] = useState(null); // { isAbnormal, direction, range }
  const [isSendingLis, setIsSendingLis] = useState(false);
  // Legacy - kept for backward compat
  const [customLisCode, setCustomLisCode] = useState('GLU');

  // Fetch dữ liệu từ backend
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Lấy thông tin tài khoản hiện tại
      const meData = await get('/auth/me');
      setCurrentUser(meData.user);

      // Xác định ID bệnh nhân cần lấy
      const targetPatientId = patientId || (meData.user.role === 'patient' ? meData.user._id : null);

      if (!targetPatientId) {
        Alert.alert('Lỗi', 'Không tìm thấy ID bệnh nhân.');
        navigation.navigate('Home');
        return;
      }

      // 2. Lấy chi tiết bệnh nhân
      const patientsData = await get('/api/patients');
      const foundPatient = patientsData.data.find(p => p._id === targetPatientId);
      
      // Nếu không tìm thấy (ví dụ trường hợp bệnh nhân tự xem, danh sách /api/patients chỉ trả về cho bác sĩ)
      // ta dùng chính profile của currentUser làm thông tin hiển thị
      if (foundPatient) {
        setPatient(foundPatient);
      } else if (meData.user.role === 'patient' && meData.user._id === targetPatientId) {
        setPatient(meData.user);
      } else {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin bệnh nhân trong hệ thống.');
        navigation.navigate('Home');
        return;
      }

      // 3. Lấy lịch sử sinh hiệu
      const vitalsData = await get(`/api/patients/${targetPatientId}/vitals`);
      setVitals(vitalsData.data || []);

      // 4. Lấy danh sách phiếu xét nghiệm
      const ordersData = await get(`/api/patients/${targetPatientId}/lab-orders`);
      setLabOrders(ordersData.data || []);
      
      // Chọn mặc định phiếu đầu tiên để hiển thị chi tiết
      if (ordersData.data && ordersData.data.length > 0) {
        setSelectedOrder(ordersData.data[0]);
      } else {
        setSelectedOrder(null);
      }

    } catch (error) {
      console.error('Lỗi tải dữ liệu chi tiết bệnh nhân:', error);
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ để tải hồ sơ bệnh nhân.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [patientId]);

  // Fetch danh sách biomarkers khi có phiếu XN được chọn
  useEffect(() => {
    if (!selectedOrder) return;
    const loadBiomarkers = async () => {
      try {
        const resp = await get(`/api/lis/biomarkers?category=${selectedOrder.category}`);
        const list = resp.data || [];
        setBiomarkerList(list);
        // Đặt mặc định chỉ số đầu tiên
        if (list.length > 0 && !selectedBiomarkerCode) {
          setSelectedBiomarkerCode(list[0].code);
        }
      } catch (e) {
        console.warn('Không tải được danh sách biomarkers:', e);
      }
    };
    loadBiomarkers();
  }, [selectedOrder?._id, selectedOrder?.category]);

  // Validate giá trị tùy biến mỗi khi thay đổi
  useEffect(() => {
    if (!selectedBiomarkerCode || !customLisValue || !selectedOrder) {
      setCustomValidation(null);
      return;
    }
    const numVal = Number(customLisValue);
    if (isNaN(numVal) || customLisValue.trim() === '') {
      setCustomValidation(null);
      return;
    }
    const biomarker = biomarkerList.find(b => b.code === selectedBiomarkerCode);
    if (!biomarker || !biomarker.reference_range) {
      setCustomValidation(null);
      return;
    }
    const range = selectedOrder.patient_gender === 'Nam'
      ? biomarker.reference_range.male
      : biomarker.reference_range.female;
    if (!range) {
      setCustomValidation(null);
      return;
    }
    let isAbnormal = false;
    let direction = '';
    const hasMin = range.min !== null && range.min !== undefined;
    const hasMax = range.max !== null && range.max !== undefined;
    if (hasMin && numVal < range.min) { isAbnormal = true; direction = 'LOW'; }
    if (hasMax && numVal > range.max) { isAbnormal = true; direction = 'HIGH'; }
    setCustomValidation({ isAbnormal, direction, range, biomarker });
  }, [selectedBiomarkerCode, customLisValue, biomarkerList, selectedOrder]);

  // Xử lý thêm sinh hiệu mới
  const handleAddVitals = async () => {
    if (!pulseInput || !systolicInput || !diastolicInput || !spo2Input) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Mạch, Huyết áp và SpO2.');
      return;
    }

    const targetPatientId = patient?._id;
    if (!targetPatientId) return;

    setIsSubmittingVital(true);
    try {
      const body = {
        pulse: Number(pulseInput),
        blood_pressure: {
          systolic: Number(systolicInput),
          diastolic: Number(diastolicInput),
        },
        spo2: Number(spo2Input),
        weight: weightInput ? Number(weightInput) : undefined,
        height: heightInput ? Number(heightInput) : undefined,
      };

      await post(`/api/patients/${targetPatientId}/vitals`, body);
      Alert.alert('Thành công', 'Đã ghi nhận chỉ số sinh hiệu mới.');
      
      // Reset form
      setPulseInput('');
      setSystolicInput('');
      setDiastolicInput('');
      setSpo2Input('');
      setWeightInput('');
      setHeightInput('');

      // Reload vitals
      const vitalsData = await get(`/api/patients/${targetPatientId}/vitals`);
      setVitals(vitalsData.data || []);
    } catch (error) {
      console.error('Lỗi thêm sinh hiệu:', error);
      Alert.alert('Thất bại', error.message || 'Không thể thêm sinh hiệu mới.');
    } finally {
      setIsSubmittingVital(false);
    }
  };

  // Giả lập gửi dữ liệu từ máy LIS
  const handleSimulateLis = async (mode) => {
    if (!selectedOrder) {
      Alert.alert('Thông báo', 'Không có phiếu xét nghiệm nào được chọn để giả lập.');
      return;
    }

    setIsSendingLis(true);
    try {
      let results = [];

      if (mode === 'NORMAL_HUYET_HOC') {
        // Bộ chỉ số Huyết học BÌNH THƯỜNG - theo phiếu FPT eHospital (M4)
        results = [
          { code: 'WBC',      value: 6.8  },  // Bạch cầu
          { code: 'NEU_PCT',  value: 62.5 },  // Trung tính %
          { code: 'NEU_ABS',  value: 4.25 },  // Trung tính #
          { code: 'LYM_PCT',  value: 28.3 },  // Lympho %
          { code: 'LYM_ABS',  value: 1.92 },  // Lympho #
          { code: 'MONO_PCT', value: 6.2  },  // Mono %
          { code: 'EOS_PCT',  value: 2.4  },  // ƪa acid %
          { code: 'BASO_PCT', value: 0.6  },  // ƪa base %
          { code: 'RBC',      value: 4.6  },  // Hồng cầu
          { code: 'HGB',      value: 142  },  // Hemoglobin
          { code: 'HCT',      value: 44.2 },  // Hematocrit
          { code: 'MCV',      value: 88.5 },  // Thể tích TB HC
          { code: 'MCH',      value: 29.1 },  // Lượng HGB TB
          { code: 'MCHC',     value: 340  },  // Nồng độ HGB
          { code: 'RDW',      value: 12.8 },  // Phân bố HC
          { code: 'PLT',      value: 245  },  // Tiểu cầu
          { code: 'MPV',      value: 8.5  },  // Thể tích TB TC
        ];
      } else if (mode === 'ABNORMAL_HUYET_HOC') {
        // Bộ chỉ số Huyết học BẤT THƯỜNG - thiếu máu + tăng bạch cầu
        results = [
          { code: 'WBC',      value: 12.5 },  // ↑ Tăng bạch cầu (> 10.0)
          { code: 'NEU_PCT',  value: 82.0 },  // ↑ Trung tính tăng (> 75%)
          { code: 'NEU_ABS',  value: 10.25},  // ↑ Trung tính # tăng
          { code: 'LYM_PCT',  value: 12.5 },  // ↓ Lympho giảm (< 20%)
          { code: 'LYM_ABS',  value: 1.56 },
          { code: 'MONO_PCT', value: 4.5  },
          { code: 'EOS_PCT',  value: 1.0  },
          { code: 'BASO_PCT', value: 0.3  },
          { code: 'RBC',      value: 3.1  },  // ↓ Hồng cầu giảm (thiếu máu)
          { code: 'HGB',      value: 95   },  // ↓ HGB giảm nặng
          { code: 'HCT',      value: 28.5 },  // ↓ Hematocrit giảm
          { code: 'MCV',      value: 68.0 },  // ↓ HC nhỏ (thiếu sắt)
          { code: 'MCH',      value: 21.5 },  // ↓ Lượng HGB giảm
          { code: 'MCHC',     value: 295  },  // ↓ Nồng độ HGB giảm
          { code: 'RDW',      value: 18.5 },  // ↑ Phân bố HC không đều (> 15%)
          { code: 'PLT',      value: 520  },  // ↑ Tiểu cầu tăng (> 450)
          { code: 'MPV',      value: 12.5 },  // ↑ Thể tích TC tăng (> 11)
        ];
      } else if (mode === 'ABNORMAL_HOA_SINH') {
        // Bộ chỉ số Hóa sinh BẤT THƯỜNG - ĐTĐ type 2 + Rối loạn lipid + Suy gan nhẹ
        results = [
          { code: 'UREA',       value: 3.1  },  // Bình thường (2.5-7.5)
          { code: 'GLU',        value: 9.8  },  // ↑ Đường huyết cao (> 6.4)
          { code: 'CRE',        value: 108  },  // Bình thường (62-120)
          { code: 'ACID_URIC',  value: 455  },  // ↑ Acid Uric cao (> 420 Nam)
          { code: 'BILI_TP',    value: 12.5 },  // Bình thường (< 17)
          { code: 'CHOL',       value: 6.4  },  // ↑ Cholesterol cao (> 5.2)
          { code: 'TRIG',       value: 3.2  },  // ↑ Triglycerid cao (> 1.88)
          { code: 'HDL',        value: 0.75 },  // ↓ HDL thấp (< 0.9)
          { code: 'LDL',        value: 4.2  },  // ↑ LDL cao (> 3.4)
          { code: 'NA',         value: 142  },  // Bình thường (135-145)
          { code: 'K',          value: 3.2  },  // ↓ Kali thấp (< 3.5)
          { code: 'CL',         value: 102  },  // Bình thường (98-106)
          { code: 'CA',         value: 2.35 },  // Bình thường (2.15-2.6)
          { code: 'AST',        value: 68.5 },  // ↑ AST tăng (> 37)
          { code: 'ALT',        value: 92.0 },  // ↑ ALT tăng (> 40)
          { code: 'GGT',        value: 78.0 },  // ↑ GGT tăng (> 50 Nam)
          { code: 'PROTEIN_TP', value: 70.0 },  // Bình thường (65-82)
          { code: 'ALBUMIN',    value: 38.0 },  // Bình thường (35-50)
        ];
      } else if (mode === 'CUSTOM') {
        if (!selectedBiomarkerCode || !customLisValue) {
          Alert.alert('Lỗi', 'Vui lòng chọn chỉ số và nhập giá trị.');
          setIsSendingLis(false);
          return;
        }
        // MERGE MODE: Giữ nguyên tất cả kết quả cũ, chỉ cập nhật chỉ số được chọn
        const existingResults = (selectedOrder.results || []).map(r => ({
          code: r.biomarker_code,
          value: r.value_result
        }));
        results = [
          ...existingResults.filter(r => r.code !== selectedBiomarkerCode),
          { code: selectedBiomarkerCode, value: Number(customLisValue) }
        ];
      }

      await post('/api/lis/receiver', {
        barcode: selectedOrder.barcode,
        results
      });

      const msgMode = mode === 'CUSTOM'
        ? `Đã cập nhật chỉ số ${selectedBiomarkerCode} = ${customLisValue}${customValidation?.biomarker?.unit ? ' ' + customValidation.biomarker.unit : ''}`
        : `Đã truyền ${results.length} chỉ số xét nghiệm thành công!`;

      Alert.alert('✅ LIS Simulator', msgMode);
      
      // Reset giá trị custom sau khi gửi thành công
      if (mode === 'CUSTOM') {
        setCustomLisValue('');
        setCustomValidation(null);
      }

      // Reload danh sách phiếu xét nghiệm
      const targetPatientId = patient?._id;
      const ordersData = await get(`/api/patients/${targetPatientId}/lab-orders`);
      setLabOrders(ordersData.data || []);
      
      // Cập nhật lại phiếu đang hiển thị
      const updated = ordersData.data.find(o => o._id === selectedOrder._id);
      if (updated) {
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error('Lỗi gửi dữ liệu LIS:', error);
      Alert.alert('LIS Simulator Thất bại', error.message || 'Lỗi khi máy LIS truyền dữ liệu.');
    } finally {
      setIsSendingLis(false);
    }
  };

  // Tạo chỉ định xét nghiệm mới từ UI
  const handleCreateLabOrder = async (category) => {
    const targetPatientId = patient?._id;
    if (!targetPatientId) return;

    try {
      const barcode = `LIS-${category === 'HOA_SINH' ? 'HS' : 'HH'}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      await post(`/api/patients/${targetPatientId}/lab-orders`, {
        category,
        barcode,
        patient_gender: patient.profile?.bhytNumber?.startsWith('GD') || Math.random() > 0.5 ? 'Nữ' : 'Nam' // Đoán giới tính
      });

      Alert.alert('Thành công', `Đã tạo phiếu xét nghiệm mới (${category}) với mã Barcode: ${barcode}`);
      
      // Reload orders
      const ordersData = await get(`/api/patients/${targetPatientId}/lab-orders`);
      setLabOrders(ordersData.data || []);
      if (ordersData.data.length > 0) {
        setSelectedOrder(ordersData.data[0]);
      }
    } catch (error) {
      console.error('Lỗi tạo phiếu xét nghiệm:', error);
      Alert.alert('Thất bại', error.message || 'Không thể tạo phiếu xét nghiệm.');
    }
  };

  // Trả về mũi tên ↑ hoặc ↓ dựa theo abnormal_direction từ server
  const getAbnormalDirection = (result) => {
    if (!result.is_abnormal) return '';
    // Dùng trường abnormal_direction từ server (HIGH/LOW) nếu có
    if (result.abnormal_direction === 'HIGH') return '↑';
    if (result.abnormal_direction === 'LOW') return '↓';
    return '⚠️'; // Fallback nếu không xác định được hướng
  };

  // Hàm vẽ SVG Line Chart cho Web
  const renderSvgLineChart = () => {
    if (vitals.length === 0) {
      return (
        <View style={styles.chartFallback}>
          <Text style={styles.fallbackText}>Chưa có dữ liệu sinh hiệu để vẽ đồ thị.</Text>
        </View>
      );
    }

    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const chartHeight = 240;
    const chartWidth = 550;

    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    // Y-Axis limits: Unified 40 - 200
    const minY = 40;
    const maxY = 200;

    // Tính toán pixel coordinates
    const getCoords = (val, idx) => {
      const x = paddingLeft + (idx / (vitals.length - 1 || 1)) * plotWidth;
      const yRatio = Math.max(0, Math.min(1, (val - minY) / (maxY - minY)));
      const y = paddingTop + (1 - yRatio) * plotHeight;
      return { x, y };
    };

    // Chuỗi điểm cho polyline
    const systolicPoints = vitals.map((v, i) => {
      const val = v.blood_pressure?.systolic || 120;
      const { x, y } = getCoords(val, i);
      return `${x},${y}`;
    }).join(' ');

    const diastolicPoints = vitals.map((v, i) => {
      const val = v.blood_pressure?.diastolic || 80;
      const { x, y } = getCoords(val, i);
      return `${x},${y}`;
    }).join(' ');

    const pulsePoints = vitals.map((v, i) => {
      const val = v.pulse || 70;
      const { x, y } = getCoords(val, i);
      return `${x},${y}`;
    }).join(' ');

    // Vẽ Grid Lines ngang (40, 80, 120, 160, 200)
    const gridValues = [40, 80, 120, 160, 200];
    const gridLines = gridValues.map((val) => {
      const yRatio = (val - minY) / (maxY - minY);
      const y = paddingTop + (1 - yRatio) * plotHeight;
      return (
        <React.Fragment key={val}>
          <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
          <text x={paddingLeft - 10} y={y + 4} fill="#64748B" fontSize="10" textAnchor="end" fontFamily="monospace">
            {val}
          </text>
        </React.Fragment>
      );
    });

    // Vẽ nhãn mốc thời gian X-Axis
    const xLabels = vitals.map((v, i) => {
      const x = paddingLeft + (i / (vitals.length - 1 || 1)) * plotWidth;
      const date = new Date(v.recorded_at);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      const dayLabel = `${date.getDate()}/${date.getMonth() + 1}`;
      
      return (
        <g key={i} transform={`translate(${x}, ${chartHeight - paddingBottom + 14})`}>
          <text fill="#64748B" fontSize="9" textAnchor="middle" fontWeight="bold">
            {label}
          </text>
          <text fill="#94A3B8" fontSize="8" textAnchor="middle" y="10">
            {dayLabel}
          </text>
        </g>
      );
    });

    if (Platform.OS !== 'web') {
      // Fallback cho môi trường mobile nếu react-native-svg chưa cài đặt
      return (
        <View style={styles.mobileChartFallback}>
          <Text style={styles.mobileChartFallbackTitle}>Lịch sử số đo gần nhất</Text>
          <View style={styles.fallbackMetricsTable}>
            <View style={styles.fallbackTableHeader}>
              <Text style={styles.tableHeaderCol}>Thời điểm</Text>
              <Text style={styles.tableHeaderCol}>H.Áp Tâm Thu</Text>
              <Text style={styles.tableHeaderCol}>H.Áp Tâm Trương</Text>
              <Text style={styles.tableHeaderCol}>Mạch (BPM)</Text>
            </View>
            {vitals.map((v, i) => {
              const d = new Date(v.recorded_at);
              return (
                <View key={i} style={styles.fallbackTableRow}>
                  <Text style={styles.tableRowCol}>{`${d.getHours()}:${d.getMinutes()} - ${d.getDate()}/${d.getMonth()+1}`}</Text>
                  <Text style={[styles.tableRowCol, {color: '#EF4444', fontWeight: 'bold'}]}>{v.blood_pressure?.systolic} mmHg</Text>
                  <Text style={[styles.tableRowCol, {color: '#F59E0B', fontWeight: 'bold'}]}>{v.blood_pressure?.diastolic} mmHg</Text>
                  <Text style={[styles.tableRowCol, {color: '#10B981', fontWeight: 'bold'}]}>{v.pulse} bpm</Text>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // JSX SVG vẽ hoàn chỉnh
    return (
      <View style={styles.chartContainer}>
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          {gridLines}

          {/* Lines */}
          <polyline fill="none" stroke="#EF4444" strokeWidth="3" points={systolicPoints} strokeLinecap="round" strokeLinejoin="round" />
          <polyline fill="none" stroke="#F59E0B" strokeWidth="3" points={diastolicPoints} strokeLinecap="round" strokeLinejoin="round" />
          <polyline fill="none" stroke="#10B981" strokeWidth="3" points={pulsePoints} strokeLinecap="round" strokeLinejoin="round" />

          {/* Dots */}
          {vitals.map((v, i) => {
            const sys = v.blood_pressure?.systolic || 120;
            const dia = v.blood_pressure?.diastolic || 80;
            const pul = v.pulse || 70;
            const sysC = getCoords(sys, i);
            const diaC = getCoords(dia, i);
            const pulC = getCoords(pul, i);

            return (
              <g key={i}>
                <circle cx={sysC.x} cy={sysC.y} r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx={diaC.x} cy={diaC.y} r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx={pulC.x} cy={pulC.y} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
              </g>
            );
          })}

          {/* X Axis labels */}
          {xLabels}
        </svg>

        {/* Legend */}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Huyết áp tâm thu (Systolic)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Huyết áp tâm trương (Diastolic)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Mạch (Pulse)</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang tải hồ sơ bệnh án...</Text>
      </View>
    );
  }

  const latestVital = vitals.length > 0 ? vitals[vitals.length - 1] : null;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="PatientRecords"
    >
      <SafeAreaView style={styles.container}>
        {/* Header điều hướng back */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('PatientRecords')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Danh sách BN</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết bệnh án</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* 1. Thẻ thông tin cá nhân bệnh nhân */}
          <View style={styles.patientProfileCard}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>{patient?.profile?.name?.charAt(0) || 'BN'}</Text>
            </View>
            
            <View style={styles.patientProfileDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.patientNameText}>{patient?.profile?.name || 'Chưa rõ họ tên'}</Text>
                <View style={styles.genderBadge}>
                  <Text style={styles.genderBadgeText}>
                    {patient?.profile?.bhytNumber?.startsWith('GD') || Math.random() > 0.5 ? 'Nữ' : 'Nam'}
                  </Text>
                </View>
              </View>
              <Text style={styles.patientSubText}>Email: {patient?.email} • SĐT: {patient?.phone || 'Chưa cập nhật'}</Text>
              
              <View style={styles.metadataGrid}>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>MÃ BỆNH NHÂN</Text>
                  <Text style={styles.metaValue}>NS-{patient?._id?.substring(18).toUpperCase() || 'N/A'}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>SỐ THẺ BHYT</Text>
                  <Text style={styles.metaValue}>{patient?.profile?.bhytNumber || 'Chưa liên kết'}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>VAI TRÒ</Text>
                  <Text style={[styles.metaValue, { color: Colors.success, fontWeight: 'bold' }]}>Bệnh nhân</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Bộ Tab chuyển màn hình */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'vitals' && styles.activeTabButton]}
              onPress={() => setActiveTab('vitals')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'vitals' && styles.activeTabButtonText]}>
                📈 Theo dõi Sinh hiệu
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'lab' && styles.activeTabButton]}
              onPress={() => setActiveTab('lab')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'lab' && styles.activeTabButtonText]}>
                🔬 Kết quả Xét nghiệm (LIS)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3. Nội dung TAB 1: SINH HIỆU */}
          {activeTab === 'vitals' && (
            <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
              
              {/* Cột trái: Đồ thị và Chỉ số hiện tại */}
              <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
                {/* 4 Chỉ số nhanh */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>❤️</Text>
                    <View>
                      <Text style={styles.metricLabelText}>Mạch</Text>
                      <Text style={styles.metricValueText}>
                        {latestVital?.pulse || '--'} <Text style={styles.metricUnitText}>bpm</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>🩸</Text>
                    <View>
                      <Text style={styles.metricLabelText}>Huyết áp</Text>
                      <Text style={styles.metricValueText}>
                        {latestVital ? `${latestVital.blood_pressure?.systolic}/${latestVital.blood_pressure?.diastolic}` : '--'} 
                        <Text style={styles.metricUnitText}> mmHg</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>🌬️</Text>
                    <View>
                      <Text style={styles.metricLabelText}>SpO2</Text>
                      <Text style={styles.metricValueText}>
                        {latestVital?.spo2 || '--'} <Text style={styles.metricUnitText}>%</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>⚖️</Text>
                    <View>
                      <Text style={styles.metricLabelText}>Chỉ số BMI</Text>
                      <Text style={styles.metricValueText}>
                        {latestVital?.bmi || '--'} <Text style={styles.metricUnitText}>kg/m²</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Khung biểu đồ Line Chart */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitleText}>Biểu đồ diễn tiến Mạch & Huyết áp</Text>
                    <Text style={styles.cardSubtitleText}>Hệ trục tọa độ hợp nhất (40 - 200)</Text>
                  </View>
                  {renderSvgLineChart()}
                </View>
              </View>

              {/* Cột phải: Form nhập sinh hiệu mới */}
              {currentUser?.role !== 'patient' && (
                <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitleText}>Ghi nhận sinh hiệu mới</Text>
                    <Text style={styles.cardSubtitleText}>Cập nhật lập tức số đo khám của bệnh nhân</Text>
                    
                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Mạch (lần/phút) *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="VD: 75"
                        value={pulseInput}
                        onChangeText={setPulseInput}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>HA Tâm thu (mmHg) *</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="VD: 120"
                          value={systolicInput}
                          onChangeText={(v) => setSystolicInput(v)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>HA Tâm trương *</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="VD: 80"
                          value={diastolicInput}
                          onChangeText={(v) => setDiastolicInput(v)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>SpO2 (%) *</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="VD: 98"
                        value={spo2Input}
                        onChangeText={setSpo2Input}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Chiều cao (cm)</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="VD: 172"
                          value={heightInput}
                          onChangeText={setHeightInput}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
                        <TextInput
                          style={styles.textInput}
                          placeholder="VD: 68"
                          value={weightInput}
                          onChangeText={setWeightInput}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleAddVitals}
                      disabled={isSubmittingVital}
                    >
                      {isSubmittingVital ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>💾 Lưu thông số sinh hiệu</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          )}

          {/* 4. Nội dung TAB 2: PHIẾU XÉT NGHIỆM LIS */}
          {activeTab === 'lab' && (
            <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
              
              {/* Cột trái: Danh sách phiếu xét nghiệm & Tạo phiếu mới */}
              <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
                <View style={styles.card}>
                  <Text style={styles.cardTitleText}>Phiếu chỉ định ({labOrders.length})</Text>
                  <Text style={styles.cardSubtitleText}>Chọn phiếu xét nghiệm để xem kết quả chi tiết</Text>
                  
                  <View style={styles.labOrdersList}>
                    {labOrders.map((order) => {
                      const isSelected = selectedOrder?._id === order._id;
                      const date = new Date(order.ordered_at);
                      return (
                        <TouchableOpacity
                          key={order._id}
                          style={[styles.orderItem, isSelected && styles.selectedOrderItem]}
                          onPress={() => setSelectedOrder(order)}
                        >
                          <View style={styles.orderItemHeader}>
                            <Text style={[styles.orderCategoryText, isSelected && styles.selectedOrderText]}>
                              {order.category === 'HOA_SINH' ? '🧪 Hóa sinh máu' : '🩸 Huyết học'}
                            </Text>
                            <View style={[styles.statusBadgeSmall, order.status === 'COMPLETED' ? styles.badgeSuccess : styles.badgePending]}>
                              <Text style={styles.badgeTextSmall}>
                                {order.status === 'COMPLETED' ? 'Đã trả KQ' : 'Chờ KQ'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.orderBarcodeText}>Mã vạch: {order.barcode}</Text>
                          <Text style={styles.orderDateText}>
                            Yêu cầu: {date.getHours()}:{date.getMinutes()} - {date.getDate()}/{date.getMonth() + 1}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {labOrders.length === 0 && (
                      <Text style={styles.emptyText}>Chưa có chỉ định xét nghiệm nào.</Text>
                    )}
                  </View>

                  {/* Bác sĩ/Admin có quyền chỉ định xét nghiệm mới */}
                  {currentUser?.role !== 'patient' && (
                    <View style={styles.createOrderActions}>
                      <Text style={styles.actionSectionTitle}>Yêu cầu xét nghiệm mới</Text>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity
                          style={[styles.actionBtnOutline, { flex: 1 }]}
                          onPress={() => handleCreateLabOrder('HOA_SINH')}
                        >
                          <Text style={styles.actionBtnOutlineText}>🧪 Hóa Sinh</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.actionBtnOutline, { flex: 1 }]}
                          onPress={() => handleCreateLabOrder('HUYET_HOC')}
                        >
                          <Text style={styles.actionBtnOutlineText}>🩸 Huyết Học</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Cột phải: Chi tiết phiếu kết quả & LIS Simulator */}
              <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
                {selectedOrder ? (
                  <View>
                    {/* Bảng kết quả xét nghiệm chuẩn Y tế */}
                    <View style={styles.labReportSheet}>
                      {/* Tiêu đề biểu mẫu */}
                      <View style={styles.reportHeader}>
                        <View style={styles.reportHeaderLeft}>
                          <Text style={styles.hospitalName}>SỞ Y TẾ HÀ NỘI</Text>
                          <Text style={styles.hospitalSub}>BỆNH VIỆN ĐA KHOA NEUROSCAN AI</Text>
                        </View>
                        <View style={styles.reportHeaderRight}>
                          <Text style={styles.departmentName}>KHOA XÉT NGHIỆM CHI NHÁNH 1</Text>
                          <Text style={styles.barcodeLabel}>Barcode: {selectedOrder.barcode}</Text>
                        </View>
                      </View>

                      <Text style={styles.reportTitle}>PHIẾU KẾT QUẢ XÉT NGHIỆM</Text>
                      <Text style={styles.reportSubtitle}>
                        Chuyên khoa: {selectedOrder.category === 'HOA_SINH' ? 'Hóa sinh máu' : 'Huyết học tế bào'}
                      </Text>

                      {/* Thông tin hành chính bệnh nhân trên phiếu */}
                      <View style={styles.reportDemographics}>
                        <View style={styles.demoRow}>
                          <Text style={styles.demoLabel}>Họ tên bệnh nhân:</Text>
                          <Text style={styles.demoVal}>{patient?.profile?.name || 'N/A'}</Text>
                          
                          <Text style={styles.demoLabel}>Giới tính:</Text>
                          <Text style={styles.demoVal}>{selectedOrder.patient_gender}</Text>
                        </View>
                        <View style={styles.demoRow}>
                          <Text style={styles.demoLabel}>Số thẻ BHYT:</Text>
                          <Text style={styles.demoVal}>{patient?.profile?.bhytNumber || 'Không có BHYT'}</Text>

                          <Text style={styles.demoLabel}>Thời gian chỉ định:</Text>
                          <Text style={styles.demoVal}>
                            {new Date(selectedOrder.ordered_at).toLocaleString('vi-VN')}
                          </Text>
                        </View>
                        {selectedOrder.resulted_at && (
                          <View style={styles.demoRow}>
                            <Text style={styles.demoLabel}>Thời gian trả kết quả:</Text>
                            <Text style={[styles.demoVal, { color: Colors.success, fontWeight: 'bold' }]}>
                              {new Date(selectedOrder.resulted_at).toLocaleString('vi-VN')}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Bảng kết quả chi tiết */}
                      {selectedOrder.status === 'COMPLETED' ? (
                        <View style={styles.tableContainer}>
                          <View style={styles.tableRowHeader}>
                            <Text style={[styles.colHeader, { flex: 2.2 }]}>Tên chỉ số xét nghiệm</Text>
                            <Text style={[styles.colHeader, { flex: 1.2 }]}>Trị số kết quả</Text>
                            <Text style={[styles.colHeader, { flex: 0.8 }]}>Đơn vị</Text>
                            <Text style={[styles.colHeader, { flex: 1.8 }]}>Khoảng tham chiếu</Text>
                            <Text style={[styles.colHeader, { flex: 0.8, textAlign: 'center' }]}>Cảnh báo</Text>
                          </View>
                          
                          {selectedOrder.results.map((res, index) => {
                            const direction = getAbnormalDirection(res);
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.tableRow,
                                  res.is_abnormal && styles.tableRowAbnormal,
                                  index === selectedOrder.results.length - 1 && styles.lastTableRow
                                ]}
                              >
                                <Text style={[styles.colCell, { flex: 2.2 }, res.is_abnormal && styles.textAbnormalBold]}>
                                  {res.biomarker_name} ({res.biomarker_code})
                                </Text>
                                <Text style={[styles.colCell, { flex: 1.2 }, res.is_abnormal && styles.textAbnormalBold]}>
                                  {res.value_result}
                                </Text>
                                <Text style={[styles.colCell, { flex: 0.8 }, res.is_abnormal && styles.textAbnormalBold]}>
                                  {res.unit}
                                </Text>
                                <Text style={[styles.colCell, { flex: 1.8 }, styles.textMuted]}>
                                  {/* Khoảng tham chiếu lấy trực tiếp từ server (dynamic, theo giới tính) */}
                                  {res.reference_range_display || '—'}
                                </Text>
                                <View style={[styles.colCell, { flex: 0.8, alignItems: 'center', justifyContent: 'center' }]}>
                                  {res.is_abnormal && (
                                    <View style={styles.alertIndicator}>
                                      <Text style={styles.alertIndicatorText}>{direction}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.pendingReportBox}>
                          <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 12 }} />
                          <Text style={styles.pendingReportText}>Đang chờ truyền kết quả xét nghiệm...</Text>
                          <Text style={styles.pendingReportSubText}>
                            Sử dụng bảng điều khiển LIS Simulator bên dưới để truyền kết quả kiểm tra giả lập vào cổng kết nối.
                          </Text>
                        </View>
                      )}

                      <View style={styles.signatureRow}>
                        <Text style={styles.signatureTitle}>TRƯỞNG KHOA XÉT NGHIỆM</Text>
                        <Text style={styles.signatureSigned}>Đã phê duyệt điện tử</Text>
                      </View>
                    </View>

                    {/* BẢNG ĐIỀU KHIỂN LIS SIMULATOR (Dành cho việc giả lập máy xét nghiệm) */}
                    {currentUser?.role !== 'patient' && (
                      <View style={[styles.card, { marginTop: 20, borderColor: Colors.primary, borderWidth: 1 }]}>
                        <View style={styles.simHeader}>
                          <Text style={[styles.cardTitleText, { color: Colors.primary }]}>⚙️ Bảng giả lập máy xét nghiệm LIS</Text>
                          <View style={styles.badgeSim}>
                            <Text style={styles.badgeSimText}>LIS SIMULATOR</Text>
                          </View>
                        </View>
                        <Text style={styles.cardSubtitleText}>
                          Truyền tải chuỗi kết quả thô qua API POST `/api/lis/receiver` để cập nhật phiếu có mã vạch: <Text style={{ fontWeight: 'bold' }}>{selectedOrder.barcode}</Text>
                        </Text>

                        {/* Các chế độ truyền nhanh */}
                        <View style={styles.simActionsRow}>
                          {selectedOrder.category === 'HUYET_HOC' ? (
                            <>
                              <TouchableOpacity
                                style={[styles.simButton, { backgroundColor: '#10B981', flex: 1, marginRight: 8 }]}
                                onPress={() => handleSimulateLis('NORMAL_HUYET_HOC')}
                                disabled={isSendingLis}
                              >
                                <Text style={styles.simButtonText}>🩸 Huyết học Bình thường (17 chỉ số)</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.simButton, { backgroundColor: '#EF4444', flex: 1 }]}
                                onPress={() => handleSimulateLis('ABNORMAL_HUYET_HOC')}
                                disabled={isSendingLis}
                              >
                                <Text style={styles.simButtonText}>⚠️ Thiếu máu + Tăng BC (17 chỉ số)</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              style={[styles.simButton, { backgroundColor: '#EF4444' }]}
                              onPress={() => handleSimulateLis('ABNORMAL_HOA_SINH')}
                              disabled={isSendingLis}
                            >
                              <Text style={styles.simButtonText}>🧪 ĐTĐ + Rối loạn Lipid + Men gan (18 chỉ số)</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Truyền tùy biến chỉ số đơn lẻ - với Select Dropdown & Validate */}
                        <View style={styles.customSimSection}>
                          <Text style={styles.customSimTitle}>Chỉnh sửa một chỉ số tùy biến</Text>
                          <Text style={styles.customSimHint}>
                            Chọn chỉ số → nhập giá trị → Gửi. Các chỉ số khác giữ nguyên.
                          </Text>

                          {/* Row 1: Dropdown chọn chỉ số */}
                          <View style={styles.customSimRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.smallLabel}>Chọn chỉ số xét nghiệm</Text>
                              {Platform.OS === 'web' ? (
                                <select
                                  value={selectedBiomarkerCode}
                                  onChange={(e) => {
                                    setSelectedBiomarkerCode(e.target.value);
                                    setCustomLisValue('');
                                    setCustomValidation(null);
                                  }}
                                  style={{
                                    height: 38,
                                    borderRadius: 8,
                                    border: '1px solid #CBD5E1',
                                    paddingLeft: 10,
                                    paddingRight: 10,
                                    fontSize: 13,
                                    backgroundColor: '#FFFFFF',
                                    color: '#0F172A',
                                    cursor: 'pointer',
                                    width: '100%',
                                  }}
                                >
                                  {biomarkerList.map(b => (
                                    <option key={b.code} value={b.code}>
                                      {b.name} ({b.code}) {b.unit ? `[${b.unit}]` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <TextInput
                                  style={styles.smallTextInput}
                                  placeholder="Nhập mã: GLU, WBC..."
                                  value={selectedBiomarkerCode}
                                  onChangeText={setSelectedBiomarkerCode}
                                  autoCapitalize="characters"
                                />
                              )}
                            </View>
                          </View>

                          {/* Row 2: Input giá trị + Validation + Nút Gửi */}
                          <View style={[styles.customSimRow, { marginTop: 10, alignItems: 'flex-end' }]}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.smallLabel}>
                                Giá trị đo
                                {biomarkerList.find(b => b.code === selectedBiomarkerCode)?.unit
                                  ? ` (${biomarkerList.find(b => b.code === selectedBiomarkerCode).unit})`
                                  : ''
                                }
                              </Text>
                              <TextInput
                                style={[
                                  styles.smallTextInput,
                                  customValidation?.isAbnormal && { borderColor: '#EF4444', borderWidth: 2, color: '#EF4444' },
                                  customValidation && !customValidation.isAbnormal && { borderColor: '#10B981', borderWidth: 2, color: '#15803D' },
                                ]}
                                placeholder="Nhập giá trị..."
                                value={customLisValue}
                                onChangeText={setCustomLisValue}
                                keyboardType="decimal-pad"
                              />

                              {/* Validation feedback */}
                              {customValidation && (
                                <View style={[
                                  styles.validationBadge,
                                  { backgroundColor: customValidation.isAbnormal ? '#FEF2F2' : '#F0FDF4' }
                                ]}>
                                  <Text style={[
                                    styles.validationText,
                                    { color: customValidation.isAbnormal ? '#EF4444' : '#15803D' }
                                  ]}>
                                    {customValidation.isAbnormal
                                      ? `${customValidation.direction === 'HIGH' ? '↑ Cao' : '↓ Thấp'} hơn ngưỡng — `
                                      : '✓ Trong khoảng bình thường — '
                                    }
                                    {customValidation.biomarker?.reference_range
                                      ? (() => {
                                          const r = selectedOrder.patient_gender === 'Nam'
                                            ? customValidation.biomarker.reference_range.male
                                            : customValidation.biomarker.reference_range.female;
                                          const hasMin = r?.min !== null && r?.min !== undefined;
                                          const hasMax = r?.max !== null && r?.max !== undefined;
                                          if (hasMin && hasMax) return `CSBT: ${r.min} - ${r.max}`;
                                          if (hasMax) return `CSBT: ≤ ${r.max}`;
                                          if (hasMin) return `CSBT: ≥ ${r.min}`;
                                          return '';
                                        })()
                                      : ''
                                    }
                                  </Text>
                                </View>
                              )}
                            </View>

                            <TouchableOpacity
                              style={[
                                styles.customSendBtn,
                                { marginBottom: customValidation ? 30 : 0 }
                              ]}
                              onPress={() => handleSimulateLis('CUSTOM')}
                              disabled={isSendingLis || !customLisValue}
                            >
                              {isSendingLis
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Text style={styles.customSendBtnText}>⚡ Gửi</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        </View>


                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.noOrderSelectedCard}>
                    <Text style={styles.noOrderSelectedText}>Chọn phiếu xét nghiệm ở menu bên trái để xem báo cáo chi tiết.</Text>
                  </View>
                )}
              </View>

            </View>
          )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 14,
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
  patientProfileCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  avatarBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarBigText: {
    color: '#15803D',
    fontWeight: 'bold',
    fontSize: 24,
  },
  patientProfileDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginRight: 8,
  },
  genderBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  genderBadgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  patientSubText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  metadataGrid: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#15803D',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 'bold',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
  },
  mobileColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  mainCol: {
    flex: 2.2,
  },
  sideCol: {
    flex: 1,
  },
  fullWidth: {
    width: '100%',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricEmoji: {
    fontSize: 24,
  },
  metricLabelText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  metricUnitText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: 'normal',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chartFallback: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
  },
  mobileChartFallback: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mobileChartFallbackTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 10,
  },
  fallbackMetricsTable: {
    gap: 6,
  },
  fallbackTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 4,
  },
  tableHeaderCol: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
  },
  fallbackTableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowCol: {
    flex: 1,
    fontSize: 10,
    color: '#334155',
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  submitButton: {
    height: 42,
    backgroundColor: '#15803D',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  labOrdersList: {
    gap: 10,
    marginBottom: 16,
  },
  orderItem: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  selectedOrderItem: {
    borderColor: '#15803D',
    backgroundColor: '#F0FDF4',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderCategoryText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  selectedOrderText: {
    color: '#166534',
  },
  orderBarcodeText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  orderDateText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#166534',
  },
  createOrderActions: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnOutline: {
    height: 38,
    borderWidth: 1,
    borderColor: '#15803D',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: 'bold',
  },
  labReportSheet: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
    marginBottom: 14,
  },
  reportHeaderLeft: {
    flex: 1.2,
  },
  reportHeaderRight: {
    flex: 0.8,
    alignItems: 'flex-end',
  },
  hospitalName: {
    fontSize: 11,
    color: '#475569',
  },
  hospitalSub: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  departmentName: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: 'bold',
  },
  barcodeLabel: {
    fontSize: 11,
    color: '#000000',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop: 4,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0F172A',
  },
  reportSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#475569',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  reportDemographics: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 6,
  },
  demoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  demoLabel: {
    fontSize: 11,
    color: '#64748B',
    width: '28%',
  },
  demoVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
    width: '22%',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#94A3B8',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  colHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  tableRowAbnormal: {
    backgroundColor: '#FEF2F2',
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  colCell: {
    fontSize: 11,
    color: '#334155',
  },
  textAbnormalBold: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  textMuted: {
    color: '#64748B',
  },
  alertIndicator: {
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pendingReportBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  pendingReportText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D97706',
    textAlign: 'center',
  },
  pendingReportSubText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  signatureRow: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
  signatureTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'center',
    width: 180,
  },
  signatureSigned: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: 'bold',
    fontStyle: 'italic',
    textAlign: 'center',
    width: 180,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
  noOrderSelectedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  noOrderSelectedText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  simHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeSim: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeSimText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  simActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  simButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  customSimSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  customSimTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  customSimHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  validationBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  validationText: {
    fontSize: 10,
    fontWeight: '600',
  },
  customSimRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  smallLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  smallTextInput: {
    height: 34,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  customSendBtn: {
    height: 34,
    backgroundColor: '#2563EB',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  customSendBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 12,
  },
});

export default PatientDetailScreen;
