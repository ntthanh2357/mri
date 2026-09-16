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
import {
  FlaskConical,
  Activity,
  Pill,
  FileText,
  Share2,
  Scan,
  ChevronLeft,
  Edit2,
  Save,
  Plus,
  Printer,
  ShieldAlert,
  AlertTriangle,
  FolderArchive,
  Heart,
  Wind,
  Scale,
  Sparkles,
  Droplets,
} from 'lucide-react';
import ImagingTab from '../components/patientDetail/ImagingTab';
import VitalsTab from '../components/patientDetail/VitalsTab';
import LabOrdersTab from '../components/patientDetail/LabOrdersTab';
import PrescriptionTab from '../components/patientDetail/PrescriptionTab';
import DischargeTransferTab from '../components/patientDetail/DischargeTransferTab';

const calculateAge = (dob, birthYear) => {
  if (dob) {
    const birthDate = new Date(dob);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    return isNaN(age) ? (birthYear ? new Date().getFullYear() - birthYear : 30) : age;
  }
  if (birthYear) {
    return new Date().getFullYear() - birthYear;
  }
  return 30;
};

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
  const [drugTimesPerDay, setDrugTimesPerDay] = useState('2');
  const [drugDurationDays, setDrugDurationDays] = useState('7');
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

      // 2. Lấy chi tiết bệnh nhân (cho phép xuyên viện để phục vụ chuyển tuyến)
      let foundPatient = null;
      if (meData.user.role === 'patient' && meData.user._id === targetPatientId) {
        foundPatient = meData.user;
        setPatient(foundPatient);
      } else {
        try {
          const patientRes = await get(`/api/patients/${targetPatientId}`);
          foundPatient = patientRes.data;
          setPatient(foundPatient);
        } catch (err) {
          Alert.alert('Lỗi', err.message || 'Không tìm thấy thông tin bệnh nhân trong hệ thống.');
          navigation.navigate('Home');
          return;
        }
      }

      // 3. Lấy lịch sử sinh hiệu
      const vitalsData = await get(`/api/patients/${targetPatientId}/vitals`);
      setVitals(vitalsData.data || []);

      // 4. Lấy danh sách phiếu xét nghiệm
      const ordersData = await get(`/api/patients/${targetPatientId}/lab-orders`);
      setLabOrders(ordersData.data || []);
      
      // 5. Lấy danh sách phim MRI/CT — thử cả 2 cách: theo medicalId và theo patientId
      try {
        const medId = foundPatient?.profile?.medicalId;
        let allImaging = [];

        if (medId) {
          // Query chính: tìm theo medicalId (chuỗi mã y tế)
          const imagingByMedId = await get(`/api/v1/imaging/patient/${medId}`);
          if (imagingByMedId?.success) {
            allImaging = imagingByMedId.data || [];
          }
        }

        // Fallback/bổ sung: tìm theo patientId (ObjectId) — dùng cho KTV tạo phim mà bệnh nhân chưa có medicalId
        try {
          const imagingByPatient = await get(`/api/v1/imaging/by-patient/${targetPatientId}`);
          if (imagingByPatient?.success && imagingByPatient.data?.length > 0) {
            // Merge: chỉ thêm các bản ghi chưa có trong allImaging
            const existingIds = new Set(allImaging.map(r => r._id));
            const extras = imagingByPatient.data.filter(r => !existingIds.has(r._id));
            allImaging = [...allImaging, ...extras];
          }
        } catch (_) { /* endpoint này có thể chưa tồn tại */ }

        setImagingResults(allImaging);
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
      usage: drugUsage,
      timesPerDay: Math.min(Math.max(Number(drugTimesPerDay) || 2, 1), 4),
      durationDays: Math.max(Number(drugDurationDays) || 7, 1)
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
    return '!'; // Fallback nếu không xác định được hướng
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Edit2 size={15} color="#0891B2" />
            <Text style={styles.manualFormTitle}>
              {selectedOrder.status === 'COMPLETED' ? 'Chỉnh sửa kết quả xét nghiệm' : 'Nhập kết quả xét nghiệm'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.autofillBtn}
            onPress={handleAutoFillNormalLab}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} color="#0891B2" />
              <Text style={styles.autofillBtnText}>Tự động điền giá trị chuẩn</Text>
            </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Save size={14} color="#FFF" />
                <Text style={styles.saveManualBtnText}>Lưu kết quả xét nghiệm</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Ghi chú kiến trúc: Các tab Toa thuốc, Giấy ra viện, Phiếu chuyển tuyến, Sinh hiệu,
  // Xét nghiệm LIS và Hình ảnh đã được module hóa thành các subcomponents chuyên biệt
  // tại src/components/patientDetail/ để tuân thủ kiến trúc Single Responsibility.


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
              <ChevronLeft size={18} color="#0891B2" />
              <Text style={styles.backButtonText}>Danh sách BN</Text>
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
                <FlaskConical size={16} color={activeTab === 'lab' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'lab' && styles.activeTabButtonText]}>
                  Xét nghiệm LIS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'vitals' && styles.activeTabButton]}
                onPress={() => setActiveTab('vitals')}
              >
                <Activity size={16} color={activeTab === 'vitals' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'vitals' && styles.activeTabButtonText]}>
                  Sinh hiệu
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'prescription' && styles.activeTabButton]}
                onPress={() => setActiveTab('prescription')}
              >
                <Pill size={16} color={activeTab === 'prescription' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'prescription' && styles.activeTabButtonText]}>
                  Toa thuốc
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'discharge' && styles.activeTabButton]}
                onPress={() => setActiveTab('discharge')}
              >
                <FileText size={16} color={activeTab === 'discharge' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'discharge' && styles.activeTabButtonText]}>
                  Giấy ra viện
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'transfer' && styles.activeTabButton]}
                onPress={() => setActiveTab('transfer')}
              >
                <Share2 size={16} color={activeTab === 'transfer' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'transfer' && styles.activeTabButtonText]}>
                  Chuyển tuyến
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'imaging' && styles.activeTabButton]}
                onPress={() => setActiveTab('imaging')}
              >
                <Scan size={16} color={activeTab === 'imaging' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.tabButtonText, activeTab === 'imaging' && styles.activeTabButtonText]}>
                  Phim MRI/CT
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* 3. Nội dung TAB 1: SINH HIỆU */}
          {activeTab === 'vitals' && (
            <VitalsTab
              isDesktop={isDesktop}
              latestVital={latestVital}
              renderSvgLineChart={renderSvgLineChart}
              currentUser={currentUser}
              pulseInput={pulseInput}
              setPulseInput={setPulseInput}
              systolicInput={systolicInput}
              setSystolicInput={setSystolicInput}
              diastolicInput={diastolicInput}
              setDiastolicInput={setDiastolicInput}
              spo2Input={spo2Input}
              setSpo2Input={setSpo2Input}
              heightInput={heightInput}
              setHeightInput={setHeightInput}
              weightInput={weightInput}
              setWeightInput={setWeightInput}
              handleAddVitals={handleAddVitals}
              isSubmittingVital={isSubmittingVital}
              styles={styles}
            />
          )}

          {/* 4. Nội dung TAB 2: PHIẾU XÉT NGHIỆM LIS */}
          {activeTab === 'lab' && (
            <LabOrdersTab
              isDesktop={isDesktop}
              labOrders={labOrders}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
              currentUser={currentUser}
              handleCreateLabOrder={handleCreateLabOrder}
              patient={patient}
              isEditingLab={isEditingLab}
              setIsEditingLab={setIsEditingLab}
              getAbnormalDirection={getAbnormalDirection}
              renderManualLabForm={renderManualLabForm}
              styles={styles}
            />
          )}

          {/* Nội dung TAB: TOA THUỐC */}
          {activeTab === 'prescription' && (
            <PrescriptionTab
              isDesktop={isDesktop}
              currentUser={currentUser}
              patient={patient}
              prescriptions={prescriptions}
              prescriptionDiagnosis={prescriptionDiagnosis}
              setPrescriptionDiagnosis={setPrescriptionDiagnosis}
              selectedPredefinedDrug={selectedPredefinedDrug}
              setSelectedPredefinedDrug={setSelectedPredefinedDrug}
              availableDrugs={availableDrugs}
              drugQuantity={drugQuantity}
              setDrugQuantity={setDrugQuantity}
              drugUnit={drugUnit}
              setDrugUnit={setDrugUnit}
              drugUsage={drugUsage}
              setDrugUsage={setDrugUsage}
              drugTimesPerDay={drugTimesPerDay}
              setDrugTimesPerDay={setDrugTimesPerDay}
              drugDurationDays={drugDurationDays}
              setDrugDurationDays={setDrugDurationDays}
              handleAddDrugToPrescription={handleAddDrugToPrescription}
              prescriptionDrugs={prescriptionDrugs}
              handleRemoveDrugFromPrescription={handleRemoveDrugFromPrescription}
              clinicalWarnings={clinicalWarnings}
              clinicalClassifications={clinicalClassifications}
              prescriptionNote={prescriptionNote}
              setPrescriptionNote={setPrescriptionNote}
              handleSavePrescription={handleSavePrescription}
              isSavingPrescription={isSavingPrescription}
              calculateAge={calculateAge}
            />
          )}

          {/* Nội dung TAB: GIẤY RA VIỆN & CHUYỂN TUYẾN */}
          {(activeTab === 'discharge' || activeTab === 'transfer') && (
            <DischargeTransferTab
              activeTab={activeTab}
              isDesktop={isDesktop}
              currentUser={currentUser}
              patient={patient}
              calculateAge={calculateAge}
              dischargePapers={dischargePapers}
              dischargeNo={dischargeNo}
              setDischargeNo={setDischargeNo}
              hospitalNo={hospitalNo}
              setHospitalNo={setHospitalNo}
              dischargeDiagnosis={dischargeDiagnosis}
              setDischargeDiagnosis={setDischargeDiagnosis}
              dischargeTreatment={dischargeTreatment}
              setDischargeTreatment={setDischargeTreatment}
              dischargeNote={dischargeNote}
              setDischargeNote={setDischargeNote}
              handleSaveDischargePaper={handleSaveDischargePaper}
              isSavingDischarge={isSavingDischarge}
              transferForms={transferForms}
              transferNo={transferNo}
              setTransferNo={setTransferNo}
              transferHospitalNo={transferHospitalNo}
              setTransferHospitalNo={setTransferHospitalNo}
              transferTo={transferTo}
              setTransferTo={setTransferTo}
              transferClinicalSummary={transferClinicalSummary}
              setTransferClinicalSummary={setTransferClinicalSummary}
              transferLabSummary={transferLabSummary}
              setTransferLabSummary={setTransferLabSummary}
              transferDiagnosis={transferDiagnosis}
              setTransferDiagnosis={setTransferDiagnosis}
              transferTreatment={transferTreatment}
              setTransferTreatment={setTransferTreatment}
              transferDrugsUsed={transferDrugsUsed}
              setTransferDrugsUsed={setTransferDrugsUsed}
              transferPatientStatus={transferPatientStatus}
              setTransferPatientStatus={setTransferPatientStatus}
              transferReason={transferReason}
              setTransferReason={setTransferReason}
              transferReasonDetail={transferReasonDetail}
              setTransferReasonDetail={setTransferReasonDetail}
              transferDirection={transferDirection}
              setTransferDirection={setTransferDirection}
              transferTransportation={transferTransportation}
              setTransferTransportation={setTransferTransportation}
              transferEscort={transferEscort}
              setTransferEscort={setTransferEscort}
              transferOneYearValid={transferOneYearValid}
              setTransferOneYearValid={setTransferOneYearValid}
              handleSaveTransferForm={handleSaveTransferForm}
              isSavingTransfer={isSavingTransfer}
              labOrders={labOrders}
            />
          )}

          {/* 5. Nội dung TAB 3: HÌNH ẢNH PHIM MRI/CT */}
          {activeTab === 'imaging' && (
            <ImagingTab
              imagingResults={imagingResults}
              navigation={navigation}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#0891B2',
    fontWeight: '600',
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
    backgroundColor: '#ECFEFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#CFFAFE',
  },
  avatarBigText: {
    color: '#0891B2',
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
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  genderBadgeText: {
    fontSize: 11,
    color: '#0891B2',
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
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeTabButton: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
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
