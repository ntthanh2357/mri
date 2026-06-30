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
  const [imagingResults, setImagingResults] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState(route.params?.defaultTab || 'lab'); // 'vitals', 'lab', 'imaging', 'prescription', 'discharge', 'transfer'

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
  const [customLisCode, setCustomLisCode] = useState('GLU');

  const [labInputValues, setLabInputValues] = useState({});
  const [savingManualLab, setSavingManualLab] = useState(false);
  const [isEditingLab, setIsEditingLab] = useState(false);

  // State cho Đơn thuốc (Toa thuốc)
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState('');
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [prescriptionDrugs, setPrescriptionDrugs] = useState([]); // [{ name: '', quantity: 1, unit: 'viên', usage: '' }]
  const [selectedPredefinedDrug, setSelectedPredefinedDrug] = useState('');
  const [drugQuantity, setDrugQuantity] = useState('10');
  const [drugUnit, setDrugUnit] = useState('viên');
  const [drugUsage, setDrugUsage] = useState('Ngày uống 2 lần, mỗi lần 1 viên sau ăn');
  const [clinicalWarnings, setClinicalWarnings] = useState([]);
  const [clinicalClassifications, setClinicalClassifications] = useState([]);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [availableDrugs, setAvailableDrugs] = useState([]); // Kho thuốc của bệnh viện

  // State cho Giấy ra viện
  const [dischargePapers, setDischargePapers] = useState([]);
  const [dischargeNo, setDischargeNo] = useState('');
  const [hospitalNo, setHospitalNo] = useState('');
  const [dischargeDiagnosis, setDischargeDiagnosis] = useState('');
  const [dischargeTreatment, setDischargeTreatment] = useState('');
  const [dischargeNote, setDischargeNote] = useState('');
  const [dateIn, setDateIn] = useState(new Date());
  const [dateOut, setDateOut] = useState(new Date());
  const [isSavingDischarge, setIsSavingDischarge] = useState(false);

  // State cho Phiếu chuyển tuyến
  const [transferForms, setTransferForms] = useState([]);
  const [transferNo, setTransferNo] = useState('');
  const [transferHospitalNo, setTransferHospitalNo] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferClinicalSummary, setTransferClinicalSummary] = useState('');
  const [transferLabSummary, setTransferLabSummary] = useState('');
  const [transferDiagnosis, setTransferDiagnosis] = useState('');
  const [transferTreatment, setTransferTreatment] = useState('');
  const [transferDrugsUsed, setTransferDrugsUsed] = useState('');
  const [transferPatientStatus, setTransferPatientStatus] = useState('');
  const [transferReason, setTransferReason] = useState('1'); // '1' or '2'
  const [transferReasonDetail, setTransferReasonDetail] = useState('Phù hợp với quy định chuyển cấp chuyên môn kỹ thuật (**)');
  const [transferDirection, setTransferDirection] = useState('');
  const [transferOneYearValid, setTransferOneYearValid] = useState('Không');
  const [transferTransportation, setTransferTransportation] = useState('Xe cấp cứu');
  const [transferEscort, setTransferEscort] = useState('');
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);

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
      
      // 5. Lấy danh sách phim MRI/CT
      try {
        const pId = foundPatient?.profile?.medicalId || targetPatientId;
        const imagingData = await get(`/api/v1/imaging/patient/${pId}`);
        if (imagingData && imagingData.success) {
          setImagingResults(imagingData.data || []);
        }
      } catch (err) {
        console.warn('Lỗi tải phim MRI:', err);
      }

      // 6. Lấy danh sách đơn thuốc
      try {
        const presRes = await get(`/api/patients/${targetPatientId}/prescriptions`);
        setPrescriptions(presRes.data || []);
      } catch (err) {
        console.warn('Lỗi tải đơn thuốc:', err);
      }

      // 7. Lấy danh sách giấy ra viện
      try {
        const discRes = await get(`/api/patients/${targetPatientId}/discharge-papers`);
        setDischargePapers(discRes.data || []);
      } catch (err) {
        console.warn('Lỗi tải giấy ra viện:', err);
      }

      // 8. Lấy danh sách phiếu chuyển tuyến
      try {
        const transRes = await get(`/api/patients/${targetPatientId}/transfer-forms`);
        setTransferForms(transRes.data || []);
      } catch (err) {
        console.warn('Lỗi tải phiếu chuyển tuyến:', err);
      }

      // Chọn mặc định phiếu đầu tiên để hiển thị chi tiết
      if (ordersData.data && ordersData.data.length > 0) {
        setSelectedOrder(ordersData.data[0]);
      } else {
        setSelectedOrder(null);
      }

      // 9. Lấy kho thuốc của bệnh viện
      try {
        const drugsRes = await get('/api/drugs');
        if (drugsRes && drugsRes.success) {
          setAvailableDrugs(drugsRes.data?.drugs || []);
        }
      } catch (err) {
        console.warn('Lỗi tải danh mục thuốc:', err);
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

  // Khởi tạo các giá trị nhập kết quả xét nghiệm khi chọn phiếu hoặc đổi danh sách biomarkers
  useEffect(() => {
    if (!selectedOrder) {
      setLabInputValues({});
      return;
    }
    const initialValues = {};
    if (selectedOrder.results && selectedOrder.results.length > 0) {
      selectedOrder.results.forEach(res => {
        initialValues[res.biomarker_code] = String(res.value_result);
      });
    } else {
      biomarkerList.forEach(b => {
        initialValues[b.code] = '';
      });
    }
    setLabInputValues(initialValues);
  }, [selectedOrder?._id, biomarkerList]);

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

  // Kiểm tra an toàn thuốc lâm sàng (Real-time Clinical DSS)
  const checkMedicationSafety = async (drugsList) => {
    if (!drugsList || drugsList.length === 0 || !patient) {
      setClinicalWarnings([]);
      setClinicalClassifications([]);
      return;
    }
    try {
      const response = await post('/api/drugs/check-prescription', {
        patientId: patient._id,
        medications: drugsList.map(d => ({ name: d.name }))
      });
      if (response && response.success && response.data) {
        setClinicalWarnings(response.data.warnings || []);
        setClinicalClassifications(response.data.classifications || []);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra dược lâm sàng:', e);
    }
  };

  const handleAddDrugToPrescription = () => {
    if (!selectedPredefinedDrug || !drugQuantity || !drugUnit) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin thuốc.');
      return;
    }

    // Kiểm tra tồn kho
    const drugObj = availableDrugs.find(d => d.name === selectedPredefinedDrug);
    if (drugObj && Number(drugQuantity) > (drugObj.stock?.quantity || 0)) {
      Alert.alert('Cảnh báo Tồn Kho', `Thuốc ${drugObj.name} hiện chỉ còn ${drugObj.stock?.quantity || 0} ${drugObj.stock?.unit || 'viên'} trong kho. Hãy nhập số lượng nhỏ hơn hoặc bằng tồn kho.`);
      return;
    }

    const newDrug = {
      name: selectedPredefinedDrug,
      quantity: Number(drugQuantity),
      unit: drugUnit,
      usage: drugUsage
    };
    const updated = [...prescriptionDrugs, newDrug];
    setPrescriptionDrugs(updated);
    checkMedicationSafety(updated);
  };

  const handleRemoveDrugFromPrescription = (index) => {
    const updated = prescriptionDrugs.filter((_, i) => i !== index);
    setPrescriptionDrugs(updated);
    checkMedicationSafety(updated);
  };

  const handleSavePrescription = async () => {
    if (!prescriptionDiagnosis) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập chẩn đoán cho đơn thuốc.');
      return;
    }
    if (prescriptionDrugs.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng thêm ít nhất một loại thuốc.');
      return;
    }

    setIsSavingPrescription(true);
    try {
      const targetPatientId = patient?._id;
      const body = {
        doctor_name: currentUser?.profile?.name || "Bác sĩ điều trị",
        diagnosis: prescriptionDiagnosis,
        drugs: prescriptionDrugs,
        note: prescriptionNote
      };

      await post(`/api/patients/${targetPatientId}/prescriptions`, body);
      Alert.alert('Thành công', 'Đã kê đơn thuốc thành công.');
      
      // Reset form
      setPrescriptionDiagnosis('');
      setPrescriptionNote('');
      setPrescriptionDrugs([]);
      setClinicalWarnings([]);
      setClinicalClassifications([]);

      // Reload prescriptions list
      const presRes = await get(`/api/patients/${targetPatientId}/prescriptions`);
      setPrescriptions(presRes.data || []);
    } catch (error) {
      console.error('Lỗi lưu đơn thuốc:', error);
      Alert.alert('Thất bại', error.message || 'Không thể kê đơn thuốc.');
    } finally {
      setIsSavingPrescription(false);
    }
  };

  const handleSaveDischargePaper = async () => {
    if (!dischargeDiagnosis || !dischargeTreatment) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Chẩn đoán và Phương pháp điều trị.');
      return;
    }

    setIsSavingDischarge(true);
    try {
      const targetPatientId = patient?._id;
      const body = {
        doctor_name: currentUser?.profile?.name || "Bác sĩ điều trị",
        dischargeNo: dischargeNo || `GV-${Math.floor(1000 + Math.random() * 9000)}`,
        hospitalNo: hospitalNo || `BA-${Math.floor(10000 + Math.random() * 90000)}`,
        dateIn: dateIn,
        dateOut: dateOut,
        diagnosis: dischargeDiagnosis,
        treatment: dischargeTreatment,
        note: dischargeNote
      };

      await post(`/api/patients/${targetPatientId}/discharge-papers`, body);
      Alert.alert('Thành công', 'Đã cấp giấy ra viện thành công.');
      
      // Reset form
      setDischargeNo('');
      setHospitalNo('');
      setDischargeDiagnosis('');
      setDischargeTreatment('');
      setDischargeNote('');

      // Reload discharge papers list
      const discRes = await get(`/api/patients/${targetPatientId}/discharge-papers`);
      setDischargePapers(discRes.data || []);
    } catch (error) {
      console.error('Lỗi lưu giấy ra viện:', error);
      Alert.alert('Thất bại', error.message || 'Không thể cấp giấy ra viện.');
    } finally {
      setIsSavingDischarge(false);
    }
  };

  const handleSaveTransferForm = async () => {
    if (!transferTo || !transferDiagnosis) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nơi chuyển tuyến đến và chẩn đoán bệnh.');
      return;
    }

    setIsSavingTransfer(true);
    try {
      const targetPatientId = patient?._id;
      const body = {
        doctor_name: currentUser?.profile?.name || "Bác sĩ điều trị",
        transferNo: transferNo || `CT-${Math.floor(1000 + Math.random() * 9000)}`,
        hospitalNo: transferHospitalNo || `BA-${Math.floor(10000 + Math.random() * 90000)}`,
        transferTo,
        dateIn,
        dateOut,
        clinicalSummary: transferClinicalSummary,
        labSummary: transferLabSummary,
        diagnosis: transferDiagnosis,
        treatment: transferTreatment,
        drugsUsed: transferDrugsUsed,
        patientStatus: transferPatientStatus,
        reason: transferReason,
        reasonDetail: transferReasonDetail,
        treatmentDirection: transferDirection,
        transferTime: new Date(),
        isOneYearValid: transferOneYearValid,
        transportation: transferTransportation,
        escort: transferEscort
      };

      await post(`/api/patients/${targetPatientId}/transfer-forms`, body);
      Alert.alert('Thành công', 'Đã lập phiếu chuyển tuyến thành công.');
      
      // Reset form
      setTransferNo('');
      setTransferHospitalNo('');
      setTransferTo('');
      setTransferClinicalSummary('');
      setTransferLabSummary('');
      setTransferDiagnosis('');
      setTransferTreatment('');
      setTransferDrugsUsed('');
      setTransferPatientStatus('');
      setTransferDirection('');
      setTransferEscort('');

      // Reload transfer list
      const transRes = await get(`/api/patients/${targetPatientId}/transfer-forms`);
      setTransferForms(transRes.data || []);
    } catch (error) {
      console.error('Lỗi lưu phiếu chuyển tuyến:', error);
      Alert.alert('Thất bại', error.message || 'Không thể lập phiếu chuyển tuyến.');
    } finally {
      setIsSavingTransfer(false);
    }
  };

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

  // Tự động điền các trị số bình thường theo giới tính
  const handleAutoFillNormalLab = () => {
    if (!selectedOrder || biomarkerList.length === 0) return;
    const filled = { ...labInputValues };
    biomarkerList.forEach(b => {
      const ref = selectedOrder.patient_gender === 'Nam' ? b.reference_range?.male : b.reference_range?.female;
      if (ref) {
        let normalVal = 0;
        const hasMin = ref.min !== null && ref.min !== undefined;
        const hasMax = ref.max !== null && ref.max !== undefined;
        if (hasMin && hasMax) {
          normalVal = (ref.min + ref.max) / 2;
        } else if (hasMax) {
          normalVal = ref.max;
        } else if (hasMin) {
          normalVal = ref.min;
        }
        filled[b.code] = String(Number(normalVal.toFixed(2)));
      }
    });
    setLabInputValues(filled);
  };

  // Lưu kết quả xét nghiệm điền tay của bác sĩ
  const handleSaveManualLab = async () => {
    if (!selectedOrder) return;
    
    const results = Object.keys(labInputValues)
      .filter(code => labInputValues[code] !== undefined && labInputValues[code].trim() !== '')
      .map(code => ({
        code,
        value: Number(labInputValues[code])
      }));

    if (results.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập ít nhất một kết quả xét nghiệm.');
      return;
    }

    const hasInvalidVal = results.some(r => isNaN(r.value));
    if (hasInvalidVal) {
      Alert.alert('Lỗi', 'Giá trị kết quả nhập vào phải là số.');
      return;
    }

    setSavingManualLab(true);
    try {
      await post('/api/lis/receiver', {
        barcode: selectedOrder.barcode,
        results
      });
      Alert.alert('Thành công', 'Đã lưu kết quả xét nghiệm.');
      setIsEditingLab(false);
      
      const targetPatientId = patient?._id;
      const ordersData = await get(`/api/patients/${targetPatientId}/lab-orders`);
      setLabOrders(ordersData.data || []);
      
      const updated = ordersData.data.find(o => o._id === selectedOrder._id);
      if (updated) {
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error('Lỗi lưu kết quả xét nghiệm:', error);
      Alert.alert('Thất bại', error.message || 'Không thể lưu kết quả xét nghiệm.');
    } finally {
      setSavingManualLab(false);
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
        patient_gender: patient.profile?.gender || (Math.random() > 0.5 ? 'Nữ' : 'Nam')
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

  const renderManualLabForm = () => {
    if (!selectedOrder) return null;
    return (
      <View style={styles.manualLabFormContainer}>
        <View style={styles.manualFormHeader}>
          <Text style={styles.manualFormTitle}>
            {selectedOrder.status === 'COMPLETED' ? '✏️ Chỉnh sửa kết quả xét nghiệm' : '✍️ Nhập kết quả xét nghiệm'}
          </Text>
          <TouchableOpacity
            style={styles.autofillBtn}
            onPress={handleAutoFillNormalLab}
          >
            <Text style={styles.autofillBtnText}>⚡ Tự động điền giá trị chuẩn</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.manualLabGrid}>
          {biomarkerList.map((biomarker) => {
            const range = selectedOrder.patient_gender === 'Nam'
              ? biomarker.reference_range?.male
              : biomarker.reference_range?.female;

            let rangeStr = '';
            if (range) {
              const hasMin = range.min !== null && range.min !== undefined;
              const hasMax = range.max !== null && range.max !== undefined;
              if (hasMin && hasMax) rangeStr = `${range.min} - ${range.max}`;
              else if (hasMax) rangeStr = `≤ ${range.max}`;
              else if (hasMin) rangeStr = `≥ ${range.min}`;
            }

            return (
              <View key={biomarker.code} style={styles.manualLabField}>
                <Text style={styles.manualLabFieldLabel}>
                  {biomarker.name} ({biomarker.code}) {biomarker.unit ? `[${biomarker.unit}]` : ''}
                </Text>
                <TextInput
                  style={styles.manualLabInput}
                  placeholder="Nhập trị số..."
                  placeholderTextColor="#94A3B8"
                  value={labInputValues[biomarker.code] || ''}
                  onChangeText={(val) => setLabInputValues(prev => ({ ...prev, [biomarker.code]: val }))}
                  keyboardType="decimal-pad"
                />
                {rangeStr ? (
                  <Text style={styles.manualLabRangeHint}>
                    Khoảng chuẩn: {rangeStr}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.manualFormFooter}>
          {selectedOrder.status === 'COMPLETED' && (
            <TouchableOpacity
              style={styles.cancelManualBtn}
              onPress={() => setIsEditingLab(false)}
              disabled={savingManualLab}
            >
              <Text style={styles.cancelManualBtnText}>Hủy</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.saveManualBtn}
            onPress={handleSaveManualLab}
            disabled={savingManualLab}
          >
            {savingManualLab ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveManualBtnText}>💾 Lưu kết quả xét nghiệm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ==========================================
  // TAB 3: TOA THUỐC (PRESCRIPTION)
  // ==========================================
  const renderPrescriptionTab = () => {
    const activePres = prescriptions.length > 0 ? prescriptions[0] : null;

    return (
      <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
        {/* Cột trái: Form kê đơn thuốc mới (Chỉ dành cho Bác sĩ) */}
        {currentUser?.role !== 'patient' && (
          <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
            <View style={styles.card}>
              <Text style={styles.cardTitleText}>✍️ Kê đơn thuốc mới</Text>
              <Text style={styles.cardSubtitleText}>Thiết lập danh mục và kiểm tra tương tác chéo</Text>

              <View style={[styles.formGroup, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>Chẩn đoán bệnh *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: U não thái dương..."
                  value={prescriptionDiagnosis}
                  onChangeText={setPrescriptionDiagnosis}
                />
              </View>

              {/* Form thêm từng loại thuốc */}
              <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>Thêm thuốc vào đơn</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Tên thuốc điều trị *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập tên thuốc (VD: Keppra, Depakine...)"
                    value={selectedPredefinedDrug}
                    onChangeText={setSelectedPredefinedDrug}
                  />
                  {(() => {
                    const showSuggestions = selectedPredefinedDrug.trim().length > 0 && 
                      !availableDrugs.find(d => d.name === selectedPredefinedDrug);
                    
                    const filtered = availableDrugs.filter(d => 
                      d.name.toLowerCase().includes(selectedPredefinedDrug.toLowerCase())
                    );
                    
                    if (showSuggestions && filtered.length > 0) {
                      return (
                        <View style={styles.suggestionsContainer}>
                          {filtered.map((drug) => (
                            <TouchableOpacity
                              key={drug._id}
                              style={styles.suggestionItem}
                              onPress={() => {
                                setSelectedPredefinedDrug(drug.name);
                                setDrugUnit(drug.stock?.unit || 'viên');
                              }}
                            >
                              <Text style={styles.suggestionText}>
                                💊 {drug.name} (Tồn: {drug.stock?.quantity || 0} {drug.stock?.unit || 'viên'})
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1.2 }]}>
                    <Text style={styles.inputLabel}>Số lượng *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="VD: 10"
                      value={drugQuantity}
                      onChangeText={setDrugQuantity}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Đơn vị</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="VD: viên"
                      value={drugUnit}
                      onChangeText={setDrugUnit}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Cách dùng / Liều lượng</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Ngày uống 2 lần, mỗi lần 1 viên sau ăn..."
                    value={drugUsage}
                    onChangeText={setDrugUsage}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: Colors.primary, height: 36, marginTop: 4 }]}
                  onPress={handleAddDrugToPrescription}
                >
                  <Text style={styles.submitButtonText}>➕ Thêm vào đơn</Text>
                </TouchableOpacity>
              </View>

              {/* Danh sách thuốc đang kê nháp */}
              {prescriptionDrugs.length > 0 && (
                <View style={{ marginVertical: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 6 }}>Danh sách thuốc đã chọn:</Text>
                  {prescriptionDrugs.map((d, index) => (
                    <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 8, borderRadius: 6, marginBottom: 6 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E3A8A' }}>{index + 1}. {d.name} ({d.quantity} {d.unit})</Text>
                        <Text style={{ fontSize: 11, color: '#1E40AF' }}>HD: {d.usage}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveDrugFromPrescription(index)} style={{ padding: 4, backgroundColor: '#FECACA', borderRadius: 4 }}>
                        <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: 'bold' }}>Xóa</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Cảnh báo tương tác lâm sàng real-time */}
              {(clinicalWarnings.length > 0 || clinicalClassifications.length > 0) && (
                <View style={{ marginVertical: 12, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FCD34D' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#B45309', marginBottom: 6 }}>🛡️ CẢNH BÁO DƯỢC LÂM SÀNG (REAL-TIME DSS):</Text>
                  
                  {clinicalWarnings.map((w, i) => (
                    <Text key={i} style={{ fontSize: 11, color: w.severity === 'CRITICAL' ? '#DC2626' : '#D97706', fontWeight: w.severity === 'CRITICAL' ? 'bold' : 'normal', marginBottom: 4 }}>
                      ⚠️ [{w.severity}] {w.message}
                    </Text>
                  ))}

                  {clinicalClassifications.map((c, i) => (
                    <Text key={i} style={{ fontSize: 11, color: '#4B5563', fontStyle: 'italic', marginBottom: 2 }}>
                      ℹ️ {c.name}: {c.warning}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Lời dặn / Ghi chú đơn thuốc</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Tái khám sau 1 tháng mang theo đơn này..."
                  value={prescriptionNote}
                  onChangeText={setPrescriptionNote}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#16A34A' }]}
                onPress={handleSavePrescription}
                disabled={isSavingPrescription}
              >
                {isSavingPrescription ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>💾 Lưu đơn thuốc & Ký số</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cột phải: Bản xem đơn thuốc chính thức (Print view) */}
        <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
          {activePres ? (
            <View style={{ gap: 16 }}>
              {/* Nút tác vụ in ấn */}
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => window.print()}
                >
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>🖨️ In đơn thuốc (PDF)</Text>
                </TouchableOpacity>
              )}

              {/* Bản in đơn thuốc */}
              <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: Colors.primary }]}>
                {/* Header bệnh viện */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 12, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>Hotline: 1900 571 563 - ĐT Cấp cứu: 0236 3615 115</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, color: '#475569', fontWeight: '500' }}>Mã y tế: <Text style={{ fontWeight: 'bold' }}>PT-003</Text></Text>
                    <Text style={{ fontSize: 10, color: '#475569', fontWeight: '500' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>NS-{patient?._id?.substring(18).toUpperCase()}</Text></Text>
                  </View>
                </View>

                {/* Tiêu đề */}
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 16 }}>ĐƠN THUỐC (TOA THUỐC)</Text>

                {/* Thông tin bệnh nhân */}
                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#3B82F6' }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>Họ tên người bệnh: <Text style={{ fontWeight: 'bold' }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 0.8 }}>Tuổi: <Text style={{ fontWeight: 'bold' }}>31</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 0.8 }}>Giới tính: <Text style={{ fontWeight: 'bold' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Chẩn đoán lâm sàng: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activePres.diagnosis}</Text></Text>
                </View>

                {/* Bảng danh sách thuốc */}
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 }}>CHỈ ĐỊNH THUỐC ĐIỀU TRỊ:</Text>
                <View style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  {/* Header hàng */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#CBD5E1' }}>
                    <Text style={{ flex: 0.4, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>STT</Text>
                    <Text style={{ flex: 2.2, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Tên thuốc / Hàm lượng</Text>
                    <Text style={{ flex: 0.8, fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>S.Lượng</Text>
                    <Text style={{ flex: 0.8, fontSize: 11, fontWeight: 'bold', color: '#475569' }}>Đơn vị</Text>
                  </View>
                  
                  {/* Body hàng */}
                  {activePres.drugs.map((drug, idx) => (
                    <View key={idx} style={{ borderBottomWidth: idx === activePres.drugs.length - 1 ? 0 : 1, borderBottomColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 12 }}>
                      <View style={{ flexDirection: 'row' }}>
                        <Text style={{ flex: 0.4, fontSize: 12, color: '#334155', fontWeight: '500' }}>{idx + 1}</Text>
                        <Text style={{ flex: 2.2, fontSize: 12, color: '#1E3A8A', fontWeight: 'bold' }}>{drug.name}</Text>
                        <Text style={{ flex: 0.8, fontSize: 12, color: '#334155', fontWeight: 'bold', textAlign: 'center' }}>{drug.quantity}</Text>
                        <Text style={{ flex: 0.8, fontSize: 12, color: '#475569' }}>{drug.unit}</Text>
                      </View>
                      {drug.usage ? (
                        <Text style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 4, marginLeft: 20 }}>Cách dùng: {drug.usage}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>

                {/* Cộng khoản và lời dặn */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500', marginBottom: 8 }}>Cộng khoản: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{activePres.drugs.length} loại thuốc.</Text></Text>
                  {activePres.note ? (
                    <View style={{ padding: 10, backgroundColor: '#FFFBEB', borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400E' }}>Lời dặn bác sĩ:</Text>
                      <Text style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>{activePres.note}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Phần ký tên */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Khám ngày: {new Date(activePres.recorded_at).toLocaleDateString('vi-VN')}</Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Đã ghi nhận trên hệ thống</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>BÁC SĨ KHÁM BỆNH</Text>
                    <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 25 }}>{activePres.doctor_name}</Text>
                    <View style={styles.signatureSigned}>
                      <Text style={styles.badgeTextSmall}>Đã ký số điện tử</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noOrderSelectedCard}>
              <Text style={styles.noOrderSelectedText}>Bệnh án này chưa được kê đơn thuốc lâm sàng.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ==========================================
  // TAB 4: GIẤY RA VIỆN (DISCHARGE PAPER)
  // ==========================================
  const renderDischargeTab = () => {
    const activeDisc = dischargePapers.length > 0 ? dischargePapers[0] : null;

    return (
      <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
        {/* Cột trái: Lập Giấy ra viện mới (Bác sĩ) */}
        {currentUser?.role !== 'patient' && (
          <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
            <View style={styles.card}>
              <Text style={styles.cardTitleText}>📄 Lập Giấy ra viện</Text>
              <Text style={styles.cardSubtitleText}>Hoàn tất thủ tục xuất viện cho người bệnh</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số giấy ra viện</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh hoặc nhập..."
                    value={dischargeNo}
                    onChangeText={setDischargeNo}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số hồ sơ / Số BA</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh hoặc nhập..."
                    value={hospitalNo}
                    onChangeText={setHospitalNo}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Chẩn đoán ra viện *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: U não thái dương đã phẫu thuật..."
                  value={dischargeDiagnosis}
                  onChangeText={setDischargeDiagnosis}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Phương pháp điều trị *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Phẫu thuật bóc tách u + Điều trị nội khoa hậu phẫu..."
                  value={dischargeTreatment}
                  onChangeText={setDischargeTreatment}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Ghi chú ra viện / Lời dặn</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Tránh vận động mạnh, tái khám theo hẹn..."
                  value={dischargeNote}
                  onChangeText={setDischargeNote}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#16A34A' }]}
                onPress={handleSaveDischargePaper}
                disabled={isSavingDischarge}
              >
                {isSavingDischarge ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>💾 Cấp giấy ra viện & Ký duyệt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cột phải: Bản xem Giấy ra viện chính thức */}
        <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
          {activeDisc ? (
            <View style={{ gap: 16 }}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => window.print()}
                >
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>🖨️ In giấy ra viện (PDF)</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: '#10B981' }]}>
                {/* Header quốc hiệu quốc ngữ */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 12, marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>Số: {activeDisc.dischargeNo}/GV</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Độc lập - Tự do - Hạnh phúc</Text>
                    <Text style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>--------------------</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Mẫu số: <Text style={{ fontWeight: 'bold' }}>02-GV</Text></Text>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>{activeDisc.hospitalNo}</Text></Text>
                  </View>
                </View>

                {/* Tiêu đề */}
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 20 }}>GIẤY RA VIỆN</Text>

                {/* Nội dung chi tiết */}
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Họ tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>Ngày sinh: <Text style={{ fontWeight: '500' }}>15/05/1995</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Tuổi: <Text style={{ fontWeight: '500' }}>31</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Giới tính: <Text style={{ fontWeight: '500' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Dân tộc: <Text style={{ fontWeight: '500' }}>Kinh</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>Nghề nghiệp: <Text style={{ fontWeight: '500' }}>Kỹ sư</Text></Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#334155' }}>Mã số BHXH / Thẻ BHYT số: <Text style={{ fontWeight: '500' }}>GD4797921800244</Text></Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                  
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 8 }}>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Vào viện lúc: <Text style={{ fontWeight: '600' }}>08:30 ngày {new Date(activeDisc.dateIn).toLocaleDateString('vi-VN')}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Ra viện lúc: <Text style={{ fontWeight: '600' }}>16:00 ngày {new Date(activeDisc.dateOut).toLocaleDateString('vi-VN')}</Text></Text>
                    
                    <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>• Chẩn đoán ra viện: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activeDisc.diagnosis}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>• Phương pháp điều trị: <Text style={{ fontWeight: '500', color: '#1E3A8A' }}>{activeDisc.treatment}</Text></Text>
                    
                    {activeDisc.note ? (
                      <Text style={{ fontSize: 13, color: '#334155' }}>• Lời dặn bác sĩ / Ghi chú: <Text style={{ fontWeight: '500', fontStyle: 'italic' }}>{activeDisc.note}</Text></Text>
                    ) : null}
                  </View>
                </View>

                {/* Chữ ký phê duyệt */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>NGƯỜI HÀNH NGHỀ KCB</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
                    <Text style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 'bold', marginTop: 25 }}>{activeDisc.doctor_name}</Text>
                  </View>
                  
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Ngày {new Date(activeDisc.recorded_at).getDate()} tháng {new Date(activeDisc.recorded_at).getMonth() + 1} năm {new Date(activeDisc.recorded_at).getFullYear()}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', marginTop: 2 }}>ĐẠI DIỆN ĐƠN VỊ KCB</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký tên, đóng dấu)</Text>
                    <View style={[styles.signatureSigned, { marginTop: 15 }]}>
                      <Text style={styles.badgeTextSmall}>Đã đóng dấu điện tử</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noOrderSelectedCard}>
              <Text style={styles.noOrderSelectedText}>Bệnh nhân chưa được lập giấy ra viện.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ==========================================
  // TAB 5: PHIẾU CHUYỂN TUYẾN (TRANSFER FORM)
  // ==========================================
  const renderTransferTab = () => {
    const activeTrans = transferForms.length > 0 ? transferForms[0] : null;

    // Tự động trích xuất cận lâm sàng (Lab summary) từ phiếu xét nghiệm gần nhất để điền tự động
    const handleAutofillLabResults = () => {
      const completedOrder = labOrders.find(o => o.status === 'COMPLETED');
      if (!completedOrder || !completedOrder.results) {
        Alert.alert('Thông báo', 'Không tìm thấy kết quả xét nghiệm đã hoàn thành để trích xuất.');
        return;
      }
      
      const summaryText = completedOrder.results.map(r => {
        return `${r.biomarker_name} (${r.biomarker_code}): ${r.value_result} ${r.unit}${r.is_abnormal ? ' (Lệch chuẩn)' : ''}`;
      }).join('\n');
      
      setTransferLabSummary(summaryText);
      Alert.alert('Thành công', 'Đã trích xuất thành công kết quả xét nghiệm LIS gần nhất vào phiếu chuyển tuyến!');
    };

    return (
      <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
        {/* Cột trái: Lập Phiếu chuyển tuyến mới (Bác sĩ) */}
        {currentUser?.role !== 'patient' && (
          <View style={isDesktop ? styles.sideCol : styles.fullWidth}>
            <View style={styles.card}>
              <Text style={styles.cardTitleText}>✈️ Lập Phiếu chuyển tuyến BHYT</Text>
              <Text style={styles.cardSubtitleText}>Chuyển bệnh nhân lên tuyến trên hoặc bệnh viện khác</Text>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số phiếu chuyển</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh..."
                    value={transferNo}
                    onChangeText={setTransferNo}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Số hồ sơ chuyển</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tự động sinh..."
                    value={transferHospitalNo}
                    onChangeText={setTransferHospitalNo}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Kính gửi (Nơi chuyển đến) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Bệnh viện Trung ương Huế..."
                  value={transferTo}
                  onChangeText={setTransferTo}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Tóm tắt dấu hiệu lâm sàng</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Nhức đầu nhiều, nôn mửa, yếu liệt nửa người nhẹ..."
                  value={transferClinicalSummary}
                  onChangeText={setTransferClinicalSummary}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Tóm tắt cận lâm sàng chính</Text>
                  <TouchableOpacity onPress={handleAutofillLabResults} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#3B82F6' }}>
                    <Text style={{ fontSize: 10, color: Colors.primary, fontWeight: 'bold' }}>⚡ Trích LIS Lab gần nhất</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  multiline
                  placeholder="VD: MRI cho thấy khối u não thái dương kích thước lớn..."
                  value={transferLabSummary}
                  onChangeText={setTransferLabSummary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Chẩn đoán chính khi chuyển tuyến *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: U não thái dương..."
                  value={transferDiagnosis}
                  onChangeText={setTransferDiagnosis}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Phương pháp, thủ thuật đã thực hiện</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Điều trị nâng đỡ, giảm phù não..."
                  value={transferTreatment}
                  onChangeText={setTransferTreatment}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Kỹ thuật, thuốc điều trị chính đã sử dụng</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Keppra 500mg, Dexamethasone kháng viêm..."
                  value={transferDrugsUsed}
                  onChangeText={setTransferDrugsUsed}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Tình trạng người bệnh lúc chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Tỉnh táo, sinh hiệu tạm ổn, đau đầu nhẹ..."
                  value={transferPatientStatus}
                  onChangeText={setTransferPatientStatus}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Lý do chuyển tuyến</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={transferReason}
                    onChange={(e) => {
                      setTransferReason(e.target.value);
                      if (e.target.value === '1') setTransferReasonDetail('Phù hợp với quy định chuyển cấp chuyên môn kỹ thuật (**)');
                      else setTransferReasonDetail('Theo yêu cầu của người bệnh hoặc đại diện hợp pháp');
                    }}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'solid',
                      paddingLeft: 10,
                      fontSize: 13,
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      width: '100%'
                    }}
                  >
                    <option value="1">1. Đủ điều kiện chuyển tuyến chuyên môn</option>
                    <option value="2">2. Theo yêu cầu của người bệnh / người nhà</option>
                  </select>
                ) : (
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: 1 hoặc 2"
                    value={transferReason}
                    onChangeText={setTransferReason}
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Chi tiết lý do chuyển</Text>
                <TextInput
                  style={styles.textInput}
                  value={transferReasonDetail}
                  onChangeText={setTransferReasonDetail}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Hướng điều trị tiếp theo</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="VD: Phẫu thuật chuyên sâu, xạ trị..."
                  value={transferDirection}
                  onChangeText={setTransferDirection}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.inputLabel}>Phương tiện vận chuyển</Text>
                  <TextInput
                    style={styles.textInput}
                    value={transferTransportation}
                    onChangeText={setTransferTransportation}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Hộ tống (nếu có)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="VD: Điều dưỡng A"
                    value={transferEscort}
                    onChangeText={setTransferEscort}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Có giá trị trong 01 năm?</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={transferOneYearValid}
                    onChange={(e) => setTransferOneYearValid(e.target.value)}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'solid',
                      paddingLeft: 10,
                      fontSize: 13,
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      width: '100%'
                    }}
                  >
                    <option value="Không">Không</option>
                    <option value="Có">Có</option>
                  </select>
                ) : (
                  <TextInput
                    style={styles.textInput}
                    value={transferOneYearValid}
                    onChangeText={setTransferOneYearValid}
                  />
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#16A34A' }]}
                onPress={handleSaveTransferForm}
                disabled={isSavingTransfer}
              >
                {isSavingTransfer ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>💾 Lập phiếu chuyển & Ký duyệt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cột phải: Bản xem Phiếu chuyển tuyến chính thức */}
        <View style={isDesktop ? styles.mainCol : styles.fullWidth}>
          {activeTrans ? (
            <View style={{ gap: 16 }}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#475569', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => window.print()}
                >
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>🖨️ In phiếu chuyển tuyến (PDF)</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.labReportSheet, { borderTopWidth: 6, borderTopColor: '#F59E0B' }]}>
                {/* Quốc hiệu quốc ngữ */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#CBD5E1', paddingBottom: 12, marginBottom: 16 }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>SỞ Y TẾ TP ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'extrabold', color: '#1E3A8A' }}>BỆNH VIỆN ĐA KHOA TÂM TRÍ ĐÀ NẴNG</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>Số: {activeTrans.transferNo}/GCT</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1E293B' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569' }}>Độc lập - Tự do - Hạnh phúc</Text>
                    <Text style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>--------------------</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Số hồ sơ: <Text style={{ fontWeight: 'bold' }}>{activeTrans.hospitalNo}</Text></Text>
                    <Text style={{ fontSize: 9, color: '#475569' }}>Vào sổ chuyển số: <Text style={{ fontWeight: 'bold' }}>{activeTrans.transferNo}</Text></Text>
                  </View>
                </View>

                {/* Tiêu đề */}
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 6 }}>PHIẾU CHUYỂN CƠ SỞ KHÁM BỆNH, CHỮA BỆNH BẢO HIỂM Y TẾ</Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E3A8A', textAlign: 'center', marginBottom: 20 }}>Kính gửi: {activeTrans.transferTo}</Text>

                {/* Nội dung chi tiết chuyển tuyến */}
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <Text style={{ fontSize: 13, color: '#334155' }}>Cơ sở khám bệnh, chữa bệnh: <Text style={{ fontWeight: 'bold' }}>Bệnh viện Đa khoa Tâm Trí Đà Nẵng</Text> trân trọng giới thiệu:</Text>
                  <Text style={{ fontSize: 13, color: '#334155' }}>- Họ và tên người bệnh: <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{patient?.profile?.name || 'N/A'}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>- Giới tính: <Text style={{ fontWeight: '500' }}>{patient?.profile?.gender || 'Nam'}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Năm sinh: <Text style={{ fontWeight: '500' }}>1995</Text></Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#334155' }}>- Địa chỉ: <Text style={{ fontWeight: '500' }}>{patient?.profile?.address || 'Liên Chiểu, Đà Nẵng'}</Text></Text>
                  
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.2 }}>- Dân tộc: <Text style={{ fontWeight: '500' }}>Kinh</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Quốc tịch: <Text style={{ fontWeight: '500' }}>Việt Nam</Text></Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1.2 }}>- Nghề nghiệp: <Text style={{ fontWeight: '500' }}>Kỹ sư</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Nơi làm việc: <Text style={{ fontWeight: '500' }}>N/A</Text></Text>
                  </View>

                  <Text style={{ fontSize: 13, color: '#334155' }}>- Số thẻ Bảo hiểm y tế: <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>GD4797921800244</Text></Text>
                  
                  {/* Tóm tắt bệnh án */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 }}>TÓM TẮT BỆNH ÁN:</Text>
                    
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>1. Tóm tắt dấu hiệu lâm sàng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.clinicalSummary || 'N/A'}</Text></Text>
                    
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>2. Tóm tắt kết quả xét nghiệm, cận lâm sàng chính: </Text>
                    <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginLeft: 12, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', lineHeight: 16 }}>{activeTrans.labSummary || 'N/A'}</Text>
                    </View>

                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>3. Chẩn đoán bệnh chính: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{activeTrans.diagnosis}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>4. Phương pháp, thủ thuật đã thực hiện: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.treatment || 'Chưa thực hiện thủ thuật'}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>5. Thuốc điều trị chính đã sử dụng: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.drugsUsed || 'N/A'}</Text></Text>
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>6. Tình trạng bệnh nhân khi chuyển tuyến: <Text style={{ fontWeight: '500', color: '#0F172A' }}>{activeTrans.patientStatus || 'Ổn định'}</Text></Text>
                  </View>

                  {/* Lý do chuyển tuyến & Hướng điều trị */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10, marginTop: 4, gap: 4 }}>
                    <Text style={{ fontSize: 13, color: '#334155' }}>- Lý do chuyển tuyến: <Text style={{ fontWeight: 'bold', color: '#D97706' }}>Mục [{activeTrans.reason}] — {activeTrans.reasonDetail}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>- Hướng điều trị tiếp theo: <Text style={{ fontWeight: '500', color: '#1E3A8A' }}>{activeTrans.treatmentDirection || 'Theo chỉ định của tuyến trên'}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>- Thời gian chuyển tuyến: <Text style={{ fontWeight: '500' }}>{new Date(activeTrans.transferTime).toLocaleTimeString('vi-VN')} ngày {new Date(activeTrans.transferTime).toLocaleDateString('vi-VN')}</Text></Text>
                    <Text style={{ fontSize: 13, color: '#334155' }}>- Trường hợp chuyển tuyến có giá trị trong 01 năm: <Text style={{ fontWeight: 'bold' }}>{activeTrans.isOneYearValid}</Text></Text>
                    
                    <View style={{ flexDirection: 'row', gap: 20, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: '#334155', flex: 1.5 }}>- Phương tiện vận chuyển: <Text style={{ fontWeight: '500' }}>{activeTrans.transportation}</Text></Text>
                      {activeTrans.escort ? (
                        <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>- Người hộ tống: <Text style={{ fontWeight: '500' }}>{activeTrans.escort}</Text></Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Ký tên phê duyệt */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>Y BÁC SĨ ĐIỀU TRỊ</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
                    <Text style={{ fontSize: 11, color: '#1E3A8A', fontWeight: 'bold', marginTop: 25 }}>{activeTrans.doctor_name}</Text>
                  </View>
                  
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>Ngày {new Date(activeTrans.recorded_at).getDate()} tháng {new Date(activeTrans.recorded_at).getMonth() + 1} năm {new Date(activeTrans.recorded_at).getFullYear()}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155', marginTop: 2 }}>ĐẠI DIỆN CƠ SỞ KCB</Text>
                    <Text style={{ fontSize: 9, color: '#64748B', fontStyle: 'italic' }}>(Ký tên, đóng dấu)</Text>
                    <View style={[styles.signatureSigned, { marginTop: 15 }]}>
                      <Text style={styles.badgeTextSmall}>Đã ký số phê duyệt</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noOrderSelectedCard}>
              <Text style={styles.noOrderSelectedText}>Bệnh nhân chưa được cấp phiếu chuyển tuyến.</Text>
            </View>
          )}
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
                    {patient?.profile?.gender || 'Nam'}
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
                  <Text style={styles.metaLabel}>EMAIL</Text>
                  <Text style={styles.metaValue}>{patient?.email || 'N/A'}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>VAI TRÒ</Text>
                  <Text style={[styles.metaValue, { color: Colors.success, fontWeight: 'bold' }]}>Bệnh nhân</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Bộ Tab chuyển màn hình */}
          {/* 2. Bộ Tab chuyển màn hình */}
          <View style={styles.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScrollContent}
            >
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'lab' && styles.activeTabButton]}
                onPress={() => setActiveTab('lab')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'lab' && styles.activeTabButtonText]}>
                  🔬 Xét nghiệm LIS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'vitals' && styles.activeTabButton]}
                onPress={() => setActiveTab('vitals')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'vitals' && styles.activeTabButtonText]}>
                  📈 Sinh hiệu
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'prescription' && styles.activeTabButton]}
                onPress={() => setActiveTab('prescription')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'prescription' && styles.activeTabButtonText]}>
                  💊 Toa thuốc
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'discharge' && styles.activeTabButton]}
                onPress={() => setActiveTab('discharge')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'discharge' && styles.activeTabButtonText]}>
                  📄 Giấy ra viện
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'transfer' && styles.activeTabButton]}
                onPress={() => setActiveTab('transfer')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'transfer' && styles.activeTabButtonText]}>
                  ✈️ Chuyển tuyến
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'imaging' && styles.activeTabButton]}
                onPress={() => setActiveTab('imaging')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'imaging' && styles.activeTabButtonText]}>
                  🧠 Phim MRI/CT
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
                          <Text style={styles.demoLabel}>Số điện thoại:</Text>
                          <Text style={styles.demoVal}>{patient?.phone || 'Chưa cập nhật'}</Text>

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

                      {selectedOrder.status === 'COMPLETED' && !isEditingLab && currentUser?.role !== 'patient' && (
                        <TouchableOpacity
                          style={styles.editLabResultsBtn}
                          onPress={() => setIsEditingLab(true)}
                        >
                          <Text style={styles.editLabResultsBtnText}>✏️ Chỉnh sửa kết quả xét nghiệm</Text>
                        </TouchableOpacity>
                      )}

                      {/* Bảng kết quả chi tiết */}
                      {selectedOrder.status === 'COMPLETED' && !isEditingLab ? (
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
                      ) : currentUser?.role !== 'patient' ? (
                        renderManualLabForm()
                      ) : (
                        <View style={styles.pendingReportBox}>
                          <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 12 }} />
                          <Text style={styles.pendingReportText}>Đang chờ kết quả từ phòng xét nghiệm LIS...</Text>
                          <Text style={styles.pendingReportSubText}>
                            Hệ thống sẽ tự động cập nhật ngay khi phòng xét nghiệm trả kết quả.
                          </Text>
                        </View>
                      )}

                      <View style={styles.signatureRow}>
                        <Text style={styles.signatureTitle}>TRƯỞNG KHOA XÉT NGHIỆM</Text>
                        <Text style={styles.signatureSigned}>Đã phê duyệt điện tử</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noOrderSelectedCard}>
                    <Text style={styles.noOrderSelectedText}>Chọn phiếu xét nghiệm ở menu bên trái để xem báo cáo chi tiết.</Text>
                  </View>
                )}
              </View>

            </View>
          )}

          {/* Nội dung TAB: TOA THUỐC */}
          {activeTab === 'prescription' && renderPrescriptionTab()}

          {/* Nội dung TAB: GIẤY RA VIỆN */}
          {activeTab === 'discharge' && renderDischargeTab()}

          {/* Nội dung TAB: CHUYỂN TUYẾN */}
          {activeTab === 'transfer' && renderTransferTab()}

          {/* 5. Nội dung TAB 3: HÌNH ẢNH PHIM MRI/CT */}
          {activeTab === 'imaging' && (
            <View style={{ marginTop: 16 }}>
              {imagingResults.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📂</Text>
                  <Text style={{ color: '#64748B', fontSize: 14 }}>Chưa có phim chụp nào được ghi nhận cho bệnh án này.</Text>
                </View>
              ) : (
                imagingResults.map((item) => {
                  const date = new Date(item.reportDate);
                  const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                  
                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                      onPress={() => navigation.navigate('ImagingResult', { resultId: item._id })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ backgroundColor: item.imagingType === 'MRI' ? '#EFF6FF' : '#FDF4FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 }}>
                          <Text style={{ color: item.imagingType === 'MRI' ? Colors.info : '#C026D3', fontWeight: 'bold' }}>{item.imagingType}</Text>
                        </View>
                        <Text style={{ color: '#64748B', fontSize: 13 }}>{dateStr}</Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 }}>{item.procedure}</Text>
                      <Text style={{ color: '#475569', fontSize: 14, marginBottom: 4 }}>Bác sĩ: <Text style={{ fontWeight: '500', color: '#1E293B' }}>{item.radiologist}</Text></Text>
                      <Text style={{ color: '#475569', fontSize: 14, marginBottom: 12 }}>Chẩn đoán: <Text style={{ fontWeight: '500', color: '#1E293B' }}>{item.diagnosis}</Text></Text>
                      <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 12 }} />
                      <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>Kết luận:</Text>
                      <Text style={{ color: '#334155', fontSize: 14 }} numberOfLines={2}>{item.conclusion}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
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
    color: Colors.primary,
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
    color: Colors.primary,
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
  tabsWrapper: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    gap: 10,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primary,
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
    borderColor: Colors.primary,
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
    borderColor: Colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    color: Colors.primary,
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
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
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
  manualLabFormContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    marginBottom: 10,
  },
  manualFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  manualFormTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  autofillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  autofillBtnText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  manualLabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  manualLabField: {
    width: Platform.OS === 'web' ? '48%' : '100%',
    minWidth: 200,
    marginBottom: 12,
  },
  manualLabFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  manualLabInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  manualLabRangeHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  manualFormFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  cancelManualBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelManualBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  saveManualBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveManualBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  editLabResultsBtn: {
    marginVertical: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editLabResultsBtnText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 150,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 999,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
});

export default PatientDetailScreen;
