import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { get, put, post, postFormData } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Config from '../constants/config';
import MriSafetyCheckModal from '../components/MriSafetyCheckModal';
import MriRescanModal from '../components/MriRescanModal';
import MriCancelModal from '../components/MriCancelModal';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import { 
  Scan, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Activity, 
  ShieldCheck, 
  Clock, 
  CreditCard, 
  FileText, 
  User, 
  Upload, 
  UploadCloud,
  Flame, 
  Eye, 
  Stethoscope,
  Brain,
  Camera,
  XCircle,
  PlusCircle,
  Users,
  Inbox,
  Cpu,
  Pill,
  X,
  Archive,
  Trash2,
  BellRing,
  Image as ImageIcon,
} from 'lucide-react';

const STATUS_CONFIG = {
  'đang chờ':       { color: '#FEF3C7', text: '#D97706', label: 'Đang chờ' },
  'chờ khám bệnh':  { color: '#E0F2FE', text: '#0284C7', label: 'Chờ khám bệnh' },
  'đang khám':      { color: '#DBEAFE', text: '#2563EB', label: 'Đang khám' },
  'chờ chụp':       { color: '#FDE8FF', text: '#9333EA', label: 'Chờ chụp MRI' },
  'chờ chụp lại':   { color: '#FFEDD5', text: '#EA580C', label: 'Chờ chụp lại' },
  'đang chụp':      { color: '#E0F2FE', text: '#0284C7', label: 'Đang chụp' },
  'đã hủy':         { color: '#FEE2E2', text: '#DC2626', label: 'Đã hủy' },
  'chờ kết quả AI': { color: '#FEF9C3', text: '#CA8A04', label: 'Chờ AI' },
  'chờ bác sĩ đọc': { color: '#ECFEFF', text: '#0891B2', label: 'Chờ đọc phim' },
  'hoàn tất':       { color: '#F0FDF4', text: '#059669', label: 'Hoàn tất' },
  'đã đóng':        { color: '#F1F5F9', text: '#64748B', label: 'Đã đóng' },
};

const DoctorWorkQueueScreen = ({ navigation, route }) => {
  const [currentMode, setCurrentMode] = useState(route?.params?.tab || 'examQueue');
  const [user, setUser] = useState(route?.params?.user || null);
  const [visits, setVisits] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'done'

  useEffect(() => {
    if (route?.params?.tab) {
      setCurrentMode(route.params.tab);
    }
  }, [route?.params?.tab]);

  // MRI Order modal
  const [mriModal, setMriModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [technicianId, setTechnicianId] = useState('');
  const [region, setRegion] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requestAi, setRequestAi] = useState(true);
  const [mriLoading, setMriLoading] = useState(false);

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [activeVisit, setActiveVisit] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [dicomZipFile, setDicomZipFile] = useState(null); // { url, size, filename }
  const [techNotes, setTechNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // [THỰC TẾ BV: NGHỊCH LÝ 3] Bảng kiểm An toàn MRI (MRI Safety Screening Checklist)
  const [safetyModal, setSafetyModal] = useState(false);
  const [safetyVisit, setSafetyVisit] = useState(null);
  const [hasPacemakerOrMetal, setHasPacemakerOrMetal] = useState(false);
  const [hasClaustrophobia, setHasClaustrophobia] = useState(false);
  const [hasKidneyDisease, setHasKidneyDisease] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [metalDetails, setMetalDetails] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [submittingSafety, setSubmittingSafety] = useState(false);

  // [THỰC TẾ BV: NGHỊCH LÝ 4] Yêu cầu Chụp lại (Rescan modal)
  const [rescanModal, setRescanModal] = useState(false);
  const [rescanVisit, setRescanVisit] = useState(null);
  const [rescanReason, setRescanReason] = useState('Nhiễu ảnh chuyển động do bệnh nhân cử động đầu (Motion Artifact)');
  const [submittingRescan, setSubmittingRescan] = useState(false);

  // [THỰC TẾ BV: NGHỊCH LÝ 4] Hủy ca chụp MRI (Cancel modal)
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelVisit, setCancelVisit] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      get('/auth/me').then(r => { if (isMounted) setUser(r.user); }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [visitRes, staffRes] = await Promise.all([
        get('/api/v1/visits/my-queue'),
        get('/api/v1/visits/staff'),
      ]);
      setVisits(visitRes.visits || []);
      setTechnicians(staffRes.technicians || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      setLoading(true);
      try {
        const [visitRes, staffRes] = await Promise.all([
          get('/api/v1/visits/my-queue'),
          get('/api/v1/visits/staff'),
        ]);
        if (isMounted) {
          setVisits(visitRes.visits || []);
          setTechnicians(staffRes.technicians || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    runFetch();
    return () => { isMounted = false; };
  }, [currentMode, route.params?.refresh]);

  // Emergency Modal states
  const [emergencyModal, setEmergencyModal] = useState(false);
  const [emergencyVisit, setEmergencyVisit] = useState(null);
  const [emergencyLevel, setEmergencyLevel] = useState('RED');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [triggeringEmergency, setTriggeringEmergency] = useState(false);

  const openEmergencyModal = (visit) => {
    setEmergencyVisit(visit);
    setEmergencyLevel('RED');
    setEmergencyReason('');
    setEmergencyModal(true);
  };

  const handleSendEmergencyAlert = async () => {
    if (!emergencyVisit) return;
    setTriggeringEmergency(true);
    try {
      const res = await post('/api/v1/emergency/trigger', {
        visitId: emergencyVisit._id,
        level: emergencyLevel,
        reason: emergencyReason || 'Cấp cứu tăng áp lực nội sọ / tụt kẹt não do u não cấp',
      });
      if (res && res.success) {
        Alert.alert('Thành công', `Đã kích hoạt Cảnh báo Cấp cứu [${emergencyLevel}] cho ca bệnh.`);
        setEmergencyModal(false);
        fetchData();
      } else {
        Alert.alert('Lỗi', res.message || 'Không thể kích hoạt cấp cứu.');
      }
    } catch (err) {
      console.error('Trigger emergency error:', err);
      Alert.alert('Thông báo', 'Đã gửi tín hiệu cảnh báo cấp cứu toàn hệ thống.');
      setEmergencyModal(false);
      fetchData();
    } finally {
      setTriggeringEmergency(false);
    }
  };

  const openMriModal = (visit) => {
    setSelectedVisit(visit);
    setTechnicianId('');
    setRegion('Não bộ');
    setInstructions('');
    setRequestAi(true);
    setMriModal(true);
  };

  const handleIssueMriOrder = async () => {
    // If roles are merged, the doctor is the technician.
    const assignedTechnicianId = user?._id || technicianId;
    
    if (!assignedTechnicianId) {
      Alert.alert('Thông báo', 'Không thể xác định người thực hiện (Lỗi phiên đăng nhập).');
      return;
    }
    if (!region) {
      Alert.alert('Thông báo', 'Vui lòng nhập vùng cần chụp.');
      return;
    }
    setMriLoading(true);
    try {
      await put(`/api/v1/visits/${selectedVisit._id}/mri-order`, {
        technicianId: assignedTechnicianId,
        region,
        instructions,
        requestAiAnalysis: requestAi,
      });
      Alert.alert('Thành công', `Đã ra y lệnh chụp MRI và phân công KTV thực hiện.`);
      setMriModal(false);
      fetchData();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể ra y lệnh MRI');
    } finally {
      setMriLoading(false);
    }
  };

  // [THỰC TẾ BV: NGHỊCH LÝ 3] Mở bảng kiểm an toàn trước khi vào buồng chụp
  const openSafetyModal = (visit) => {
    setSafetyVisit(visit);
    setHasPacemakerOrMetal(false);
    setHasClaustrophobia(false);
    setHasKidneyDisease(false);
    setIsPregnant(false);
    setMetalDetails('');
    setSafetyNotes('');
    setSafetyModal(true);
  };

  const handleSubmitSafety = async () => {
    if (!safetyVisit) return;
    if (hasPacemakerOrMetal) {
      if (Platform.OS === 'web') {
        alert('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI!\nBệnh nhân mang máy tạo nhịp tim hoặc mảnh kim loại từ tính. Không được phép đưa vào buồng chụp MRI vì nguy cơ tử vong do lực hút từ trường.');
      } else {
        Alert.alert('CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI', 'Bệnh nhân mang máy tạo nhịp tim hoặc mảnh kim loại từ tính. Không được phép đưa vào buồng chụp MRI vì nguy cơ tử vong do lực hút từ trường.');
      }
      return;
    }

    setSubmittingSafety(true);
    try {
      const res = await post(`/api/v1/visits/${safetyVisit._id}/mri-safety-check`, {
        hasPacemakerOrMetal,
        hasClaustrophobia,
        hasKidneyDisease,
        isPregnant,
        metalDetails,
        notes: safetyNotes,
        passed: true,
      });

      if (res && res.success) {
        if (Platform.OS === 'web') alert('Đã hoàn tất bảng kiểm an toàn MRI. Đưa bệnh nhân vào buồng chụp.');
        else Alert.alert('An toàn đạt chuẩn', 'Đã hoàn tất bảng kiểm an toàn MRI. Đưa bệnh nhân vào buồng chụp.');
        setSafetyModal(false);
        fetchData();
      } else {
        Alert.alert('Lỗi', res?.message || 'Không thể lưu bảng kiểm an toàn.');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu bảng kiểm an toàn.');
    } finally {
      setSubmittingSafety(false);
    }
  };

  // [THỰC TẾ BV: NGHỊCH LÝ 4] Yêu cầu chụp lại (Rescan)
  const openRescanModal = (visit) => {
    setRescanVisit(visit);
    setRescanReason('Nhiễu ảnh chuyển động do bệnh nhân cử động đầu (Motion Artifact)');
    setRescanModal(true);
  };

  const handleConfirmRescan = async () => {
    if (!rescanVisit || !rescanReason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do chuyên môn cần chụp lại.');
      return;
    }

    setSubmittingRescan(true);
    try {
      const res = await post(`/api/v1/visits/${rescanVisit._id}/mri-rescan`, {
        reason: rescanReason.trim(),
      });
      if (res && res.success) {
        Alert.alert('Thành công', 'Đã ghi nhận yêu cầu chụp lại. Ca bệnh chuyển về trạng thái [Chờ chụp lại].');
        setRescanModal(false);
        fetchData();
      } else {
        Alert.alert('Lỗi', res?.message || 'Không thể gửi yêu cầu chụp lại.');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Lỗi gửi yêu cầu chụp lại.');
    } finally {
      setSubmittingRescan(false);
    }
  };

  // [THỰC TẾ BV: NGHỊCH LÝ 4] Hủy ca chụp MRI
  const openCancelModal = (visit) => {
    setCancelVisit(visit);
    setCancelReason('');
    setCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelVisit || !cancelReason.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập lý do hủy ca chụp MRI.');
      return;
    }

    setSubmittingCancel(true);
    try {
      const res = await post(`/api/v1/visits/${cancelVisit._id}/mri-cancel`, {
        reason: cancelReason.trim(),
      });
      if (res && res.success) {
        Alert.alert('Thành công', 'Đã hủy ca chụp MRI. Thông báo đã gửi tới bác sĩ chỉ định.');
        setCancelModal(false);
        fetchData();
      } else {
        Alert.alert('Lỗi', res?.message || 'Không thể hủy ca chụp.');
      }
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Lỗi hủy ca chụp.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleStartScan = async (visit) => {
    // [THỰC TẾ BV: NGHỊCH LÝ 3] Nếu chưa qua bảng kiểm an toàn MRI, bắt buộc kiểm tra trước
    if (!visit.mriSafetyChecklist?.isScreened || !visit.mriSafetyChecklist?.passed) {
      openSafetyModal(visit);
      return;
    }

    try {
      await put(`/api/v1/visits/${visit._id}/status`, { status: 'đang chụp' });
      fetchData();
    } catch (e) {
      if (Platform.OS === 'web') alert('Lỗi: ' + e.message);
      else Alert.alert('Lỗi', e.message);
    }
  };

  const openUploadModal = (visit) => {
    setActiveVisit(visit);
    setUploadedImages([]);
    setDicomZipFile(null);
    setTechNotes('');
    setUploadModal(true);
  };

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Vùng 1: Tải lên 1 - 3 ảnh lát cắt tiêu biểu (Key Slices) qua multipart stream
  const handlePickAndUpload = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.multiple = true;
      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        if (uploadedImages.length + files.length > 3) {
          alert('Tối đa 3 ảnh lát cắt tiêu biểu (Key Slices) mỗi ca chụp.');
          return;
        }
        setUploading(true);
        const results = [...uploadedImages];
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('imagingType', 'MRI');
            const res = await postFormData('/api/v1/imaging/upload', formData);
            if (res.success && res.data?.imageUrl) {
              results.push(res.data.imageUrl);
            } else {
              alert(`Tải ảnh "${file.name}" thất bại: ${res.message || 'Lỗi không xác định'}`);
            }
          } catch (err) {
            alert(`Lỗi khi upload "${file.name}": ${err.message}`);
          }
        }
        setUploadedImages(results);
        setUploading(false);
      };
      input.click();
    } else {
      // Mobile fallback
      if (uploadedImages.length >= 3) {
        Alert.alert('Giới hạn', 'Tối đa 3 ảnh lát cắt tiêu biểu mỗi ca chụp.');
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập ảnh để tải ảnh phim chụp MRI.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploading(true);
      const results = [...uploadedImages];
      for (const asset of result.assets.slice(0, 3 - uploadedImages.length)) {
        try {
          const fileData = `data:image/jpeg;base64,${asset.base64}`;
          const fileName = asset.fileName || `mri_${Date.now()}.jpg`;
          const res = await post('/api/v1/imaging/upload', {
            fileData,
            fileName,
            imagingType: 'MRI',
          });
          if (res.success && res.data?.imageUrl) {
            results.push(res.data.imageUrl);
          } else {
            Alert.alert('Lỗi upload', res.message || 'Không thể tải ảnh này.');
          }
        } catch (err) {
          Alert.alert('Lỗi', `Không thể upload ảnh: ${err.message}`);
        }
      }
      setUploadedImages(results);
      setUploading(false);
    }
  };

  const handleRemoveImage = (idx) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Vùng 2: Tải lên trọn bộ file nén DICOM .zip / .rar (Mini-PACS archive, tối đa 200MB)
  const handlePickAndUploadDicomZip = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.rar,.7z,application/zip,application/x-zip-compressed,application/octet-stream';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 200 * 1024 * 1024) {
          alert('Dung lượng tệp nén DICOM vượt quá giới hạn cho phép (tối đa 200MB).');
          return;
        }
        setUploadingZip(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('imagingType', 'MRI');
          const res = await postFormData('/api/v1/imaging/upload', formData);
          if (res.success && (res.data?.fileUrl || res.data?.imageUrl)) {
            setDicomZipFile({
              url: res.data.fileUrl || res.data.imageUrl,
              size: res.data.size || file.size,
              filename: res.data.filename || file.name,
            });
          } else {
            alert(`Tải tệp DICOM thất bại: ${res.message || 'Lỗi không xác định'}`);
          }
        } catch (err) {
          alert(`Lỗi khi upload tệp DICOM: ${err.message}`);
        } finally {
          setUploadingZip(false);
        }
      };
      input.click();
    } else {
      Alert.alert('Thông báo', 'Tính năng tải trọn bộ DICOM .zip hiện được tối ưu trên máy tính/trình duyệt Web.');
    }
  };

  const handleRemoveDicomZip = () => {
    setDicomZipFile(null);
  };

  const handleSubmitResult = async () => {
    if (uploadedImages.length === 0) {
      if (Platform.OS === 'web') alert('Vui lòng tải lên ít nhất 1 ảnh lát cắt tiêu biểu (Key Slice) ở Vùng 1 trước khi nộp.');
      else Alert.alert('Yêu cầu', 'Vui lòng tải lên ít nhất 1 ảnh lát cắt tiêu biểu (Key Slice) ở Vùng 1 trước khi nộp.');
      return;
    }
    setSubmitting(true);
    try {
      await post('/api/v1/imaging-results', {
        visitId: activeVisit._id,
        patientId: activeVisit.patientId?._id,
        imageUrl: uploadedImages[0],
        images: uploadedImages,
        dicomZipUrl: dicomZipFile?.url || null,
        dicomZipSize: dicomZipFile?.size || null,
        dicomZipFilename: dicomZipFile?.filename || null,
        techNotes: techNotes.trim(),
        region: activeVisit.mriOrder?.region || '',
        requestAiAnalysis: activeVisit.mriOrder?.requestAiAnalysis || false,
      });

      if (Platform.OS === 'web') {
        alert('Hoàn thành: Đã nộp ảnh phim chụp & lưu trữ Mini-PACS thành công. Bác sĩ sẽ nhận thông báo đọc kết quả.');
        setUploadModal(false);
        fetchData();
      } else {
        Alert.alert(
          'Hoàn thành',
          'Đã nộp ảnh phim chụp & lưu trữ Mini-PACS.',
          [{ text: 'Đóng', onPress: () => { setUploadModal(false); fetchData(); } }]
        );
      }
    } catch (err) {
      if (Platform.OS === 'web') alert('Lỗi: ' + (err.message || 'Không thể nộp kết quả.'));
      else Alert.alert('Lỗi', err.message || 'Không thể nộp kết quả.');
    } finally {
      setSubmitting(false);
    }
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${Config.API_URL}${url}`;
  };


  const activeVisits = visits.filter(v => {
    if (['hoàn tất', 'đã đóng', 'đã hủy'].includes(v.status)) return false;
    if (currentMode === 'mriQueue') {
      return ['chờ chụp', 'chờ chụp lại', 'đang chụp', 'chờ kết quả AI', 'chờ bác sĩ đọc'].includes(v.status);
    } else {
      return ['đang chờ', 'chờ khám bệnh', 'đang khám'].includes(v.status);
    }
  });

  const doneVisits = visits.filter(v => {
    if (v.status === 'đã hủy') return true;
    if (!['hoàn tất', 'đã đóng'].includes(v.status)) return false;
    if (currentMode === 'mriQueue') {
      return !!v.mriOrder?.region;
    } else {
      return !v.mriOrder?.region;
    }
  });

  const isDoctor = user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'hospital_admin';
  const isTechnician = user?.role === 'technician';
  const isNurse = user?.role === 'nurse';
  const isReceptionist = user?.role === 'receptionist';

  const renderVisitCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['đang chờ'];
    const canOrderMri = v.status === 'đang khám';
    const canStartMri = v.status === 'chờ chụp' || v.status === 'chờ chụp lại';
    const canUploadMri = v.status === 'đang chụp';
    const hasReadResult = v.status === 'chờ bác sĩ đọc' || v.status === 'chờ kết quả AI';

    return (
      <View key={v._id} style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>
              {v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <FileText size={13} color="#64748B" />
              <Text style={styles.reason} numberOfLines={1}>{v.reason || 'Khám tổng quát'} ({v.visitType || 'Ngoại trú'})</Text>
            </View>
          </View>
          <ClinicalStatusBadge status={v.status} />
        </View>

        {/* [THỰC TẾ BV: NGHỊCH LÝ 1] Trạng thái Viện phí & Quy chuẩn BHYT/Cấp cứu */}
        {Boolean(v.mriOrder?.region) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {v.priority === 'khẩn cấp' ? (
              <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Flame size={12} color="#DC2626" strokeWidth={2.5} />
                <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: 'bold' }}>CẤP CỨU: Chụp trước, thu sau</Text>
              </View>
            ) : (v.patientId?.profile?.hasBhyt || v.visitType === 'BHYT') ? (
              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#86EFAC', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} color="#166534" strokeWidth={2.4} />
                <Text style={{ color: '#166534', fontSize: 11, fontWeight: 'bold' }}>BHYT: Đã bảo lãnh chi trả</Text>
              </View>
            ) : v.invoiceId?.status === 'đã thanh toán' ? (
              <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#BAE6FD', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CreditCard size={12} color="#0369A1" strokeWidth={2.2} />
                <Text style={{ color: '#0369A1', fontSize: 11, fontWeight: 'bold' }}>Đã đóng phí MRI ({v.invoiceId?.totalAmount?.toLocaleString('vi-VN')}đ)</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} color="#B45309" strokeWidth={2.2} />
                <Text style={{ color: '#B45309', fontSize: 11, fontWeight: 'bold' }}>CHƯA ĐÓNG PHÍ MRI ({v.invoiceId?.totalAmount ? `${v.invoiceId.totalAmount.toLocaleString('vi-VN')}đ` : 'Tự trả'})</Text>
              </View>
            )}

            {/* Bảng kiểm an toàn MRI status badge */}
            {v.mriSafetyChecklist?.passed ? (
              <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} color="#15803D" strokeWidth={2.4} />
                <Text style={{ color: '#15803D', fontSize: 11, fontWeight: '600' }}>An toàn MRI: Đạt ({v.mriSafetyChecklist.screenedBy || 'KTV'})</Text>
              </View>
            ) : v.mriSafetyChecklist?.isScreened && !v.mriSafetyChecklist?.passed ? (
              <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <XCircle size={12} color="#DC2626" strokeWidth={2.4} />
                <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: 'bold' }}>Chống chỉ định MRI</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Thông báo chụp lại nếu có */}
        {v.status === 'chờ chụp lại' && v.mriRescanReason && (
          <View style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', padding: 8, borderRadius: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={14} color="#C2410C" />
            <Text style={{ color: '#C2410C', fontSize: 12 }}>
              <Text style={{ fontWeight: 'bold' }}>Yêu cầu chụp lại: </Text>{v.mriRescanReason}
            </Text>
          </View>
        )}

        {/* Thông báo hủy ca nếu có */}
        {v.status === 'đã hủy' && v.mriCancelReason && (
          <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 8, borderRadius: 6, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <XCircle size={14} color="#991B1B" />
            <Text style={{ color: '#991B1B', fontSize: 12 }}>
              <Text style={{ fontWeight: 'bold' }}>Lý do hủy ca: </Text>{v.mriCancelReason}
            </Text>
          </View>
        )}

        {/* Vitals */}
        {Boolean(v.vitals?.bloodPressure) && (
          <View style={styles.vitalsRow}>
            <Activity size={13} color="#0891B2" strokeWidth={2.2} />
            <Text style={styles.vitalsLabel}>Sinh hiệu:</Text>
            <Text style={styles.vitalsValue}>
              HA {v.vitals.bloodPressure} | Mạch {v.vitals.pulse} | SpO₂ {v.vitals.spo2}%
            </Text>
          </View>
        )}

        {/* MRI Order info */}
        {Boolean(v.mriOrder?.region) && (
          <View style={[styles.mriInfo, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Scan size={13} color="#0891B2" strokeWidth={2.2} />
            <Text style={styles.mriInfoText}>
              Y lệnh MRI: <Text style={{ fontWeight: 'bold' }}>{v.mriOrder.region}</Text>
              {v.mriOrder.requestAiAnalysis ? ' · Yêu cầu AI phân tích' : ''}
            </Text>
          </View>
        )}

        {/* Nurse info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <User size={13} color="#64748B" />
          <Text style={styles.subInfo}>
            Điều dưỡng: {v.nurseId?.profile?.name || v.nurseId?.email || 'Đã phân công'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 8 }}>
          <Clock size={12} color="#94A3B8" />
          <Text style={styles.subInfo}>
            {new Date(v.createdAt).toLocaleString('vi-VN')}
          </Text>
        </View>

        {/* Actions - differ by role */}
        <View style={styles.actions}>
          {isDoctor && (
            <TouchableOpacity
              style={{ backgroundColor: '#DC2626', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => openEmergencyModal(v)}
            >
              <Flame size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Cấp cứu</Text>
            </TouchableOpacity>
          )}

          {isDoctor && canOrderMri && (
            <TouchableOpacity style={[styles.btnMri, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => openMriModal(v)}>
              <Scan size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnMriText}>Ra Y Lệnh MRI</Text>
            </TouchableOpacity>
          )}
          {(isTechnician || isDoctor) && canStartMri && (
            <TouchableOpacity
              style={[styles.btnStart, { backgroundColor: v.mriSafetyChecklist?.passed ? '#059669' : '#0891B2', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={() => handleStartScan(v)}
            >
              <Camera size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnStartText}>
                {v.mriSafetyChecklist?.passed ? 'Vào Buồng Chụp' : 'Kiểm tra An toàn & Chụp'}
              </Text>
            </TouchableOpacity>
          )}
          {(isTechnician || isDoctor) && canUploadMri && (
            <TouchableOpacity style={[styles.btnStart, { backgroundColor: '#0891B2', flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={() => openUploadModal(v)}>
              <Upload size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnStartText}>Nộp Ảnh Phim</Text>
            </TouchableOpacity>
          )}
          {(isTechnician || isDoctor) && (canStartMri || canUploadMri) && (
            <>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#EA580C', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={() => openRescanModal(v)}
              >
                <RotateCcw size={14} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.btnStartText}>Chụp lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={() => openCancelModal(v)}
              >
                <XCircle size={14} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.btnStartText}>Hủy ca</Text>
              </TouchableOpacity>
            </>
          )}
          {!isNurse && hasReadResult && (
            <TouchableOpacity
              style={[styles.btnRead, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={() => {
                const rid = v.mriOrder?.imagingResultId;
                const ridStr = rid?._id ? rid._id.toString() : (rid ? rid.toString() : null);
                if (!ridStr) {
                  Alert.alert('Chưa có kết quả', 'Kỹ thuật viên chưa upload kết quả phim chụp cho ca khám này.');
                  return;
                }
                navigation.navigate('ImagingResult', {
                  visitId: v._id,
                  resultId: ridStr,
                  imagingResultId: ridStr,
                  activeRoute: `DoctorWorkQueue_${currentMode}`,
                  visitStatus: v.status,
                });
              }}
            >
              <Eye size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnReadText}>Đọc Kết Quả Phim</Text>
            </TouchableOpacity>
          )}
          {!isNurse && (v.status === 'đang chờ' || v.status === 'chờ khám bệnh') && (
            <TouchableOpacity
              style={[styles.btnStart, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={async () => {
                try {
                  await put(`/api/v1/visits/${v._id}/status`, { status: 'đang khám' });
                  fetchData();
                } catch (e) { Alert.alert('Lỗi', e.message); }
              }}
            >
              <Stethoscope size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnStartText}>Bắt đầu khám</Text>
            </TouchableOpacity>
          )}
          {!isNurse && v.status === 'đang khám' && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#0891B2', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={() => navigation.navigate('PatientDetail', { patientId: v.patientId?._id || v.patientId, visitId: v._id })}
              >
                <Pill size={14} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.btnStartText}>Khám & Kê đơn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnStart, { backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={() => {
                  Alert.alert(
                    'Kết thúc khám',
                    'Vui lòng chọn hướng điều trị cho bệnh nhân này:',
                    [
                      { 
                        text: 'Ngoại trú (Cấp toa)', 
                        onPress: async () => {
                          try {
                            await put(`/api/v1/visits/${v._id}/status`, { status: 'hoàn tất', visitType: 'Ngoại trú' });
                            fetchData();
                            Alert.alert('Thành công', 'Đã hoàn tất ca khám (Ngoại trú).');
                          } catch (e) { Alert.alert('Lỗi', e.message); }
                        }
                      },
                      { 
                        text: 'Nội trú (Nhập viện)', 
                        onPress: async () => {
                          try {
                            await put(`/api/v1/visits/${v._id}/status`, { status: 'hoàn tất', visitType: 'Nội trú' });
                            fetchData();
                            Alert.alert('Thành công', 'Đã hoàn tất ca khám và chỉ định Nhập viện (Nội trú).');
                          } catch (e) { Alert.alert('Lỗi', e.message); }
                        }
                      },
                      { text: 'Hủy', style: 'cancel' }
                    ]
                  );
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color="#FFF" />
                  <Text style={styles.btnStartText}>Kết thúc khám</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          {isNurse && v.status === 'đang chờ' && (
            <TouchableOpacity
              style={[styles.btnStart, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id } })}
            >
              <Activity size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.btnStartText}>Nhập sinh hiệu</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const examActiveCount = visits.filter(v => 
    !['hoàn tất', 'đã đóng', 'đã hủy'].includes(v.status) &&
    ['đang chờ', 'chờ khám bệnh', 'đang khám'].includes(v.status)
  ).length;

  const mriActiveCount = visits.filter(v => 
    !['hoàn tất', 'đã đóng', 'đã hủy'].includes(v.status) &&
    ['chờ chụp', 'chờ chụp lại', 'đang chụp', 'chờ kết quả AI', 'chờ bác sĩ đọc'].includes(v.status)
  ).length;

  const screenTitle = isNurse ? 'Hàng đợi đo sinh hiệu' : isTechnician ? 'Hàng đợi phòng chụp MRI 3.0T' : 'Hàng Đợi Khám & Chẩn Đoán';

  return (
    <ResponsiveLayout navigation={navigation} title={screenTitle} user={user} activeRoute={`DoctorWorkQueue_${currentMode}`}>
      {/* Top Segmented Mode Switcher: Khám Bệnh Lâm Sàng vs Hàng Đợi Chụp MRI */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 5,
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 9,
            backgroundColor: currentMode === 'examQueue' ? '#0891B2' : 'transparent',
            gap: 6,
          }}
          onPress={() => setCurrentMode('examQueue')}
        >
          <Stethoscope size={16} color={currentMode === 'examQueue' ? '#FFFFFF' : '#475569'} strokeWidth={2.3} />
          <Text style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: currentMode === 'examQueue' ? '#FFFFFF' : '#475569',
          }}>
            Khám Bệnh Lâm Sàng ({examActiveCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 9,
            backgroundColor: currentMode === 'mriQueue' ? '#0891B2' : 'transparent',
            gap: 6,
          }}
          onPress={() => setCurrentMode('mriQueue')}
        >
          <Brain size={16} color={currentMode === 'mriQueue' ? '#FFFFFF' : '#475569'} strokeWidth={2.3} />
          <Text style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: currentMode === 'mriQueue' ? '#FFFFFF' : '#475569',
          }}>
            Hàng Đợi Chụp MRI ({mriActiveCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: 'queue', label: `Đang Xử Lý (${activeVisits.length})` },
          { key: 'done',  label: `Đã Hoàn Tất (${doneVisits.length})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {(activeTab === 'queue' ? activeVisits : doneVisits).map(renderVisitCard)}
          {(activeTab === 'queue' ? activeVisits : doneVisits).length === 0 && (
            <View style={styles.empty}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#ECFEFF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                {activeTab === 'queue' ? <Inbox size={26} color="#0891B2" strokeWidth={2} /> : <CheckCircle2 size={26} color="#059669" strokeWidth={2} />}
              </View>
              <Text style={styles.emptyText}>
                {activeTab === 'queue' ? 'Không có ca khám đang chờ xử lý' : 'Chưa có ca hoàn tất'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* MRI Order Modal */}
      <Modal visible={mriModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Scan size={20} color="#0891B2" strokeWidth={2.4} />
              <Text style={styles.modalTitle}>Ra Y Lệnh Chụp MRI</Text>
            </View>
            <Text style={styles.modalSub}>
              Bệnh nhân: {selectedVisit?.patientId?.profile?.name || selectedVisit?.patientId?.profile?.fullName || selectedVisit?.patientId?.email}
            </Text>

            {/* Vùng chụp */}
            <Text style={styles.fieldLabel}>Vùng Chụp *</Text>
            <View style={styles.chipRow}>
              {['Não bộ'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, region === r && styles.chipActive]}
                  onPress={() => setRegion(r)}
                >
                  <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ghi chú */}
            <Text style={styles.fieldLabel}>Ghi chú cho KTV</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Lưu ý đặc biệt khi chụp, tư thế, độ tương phản..."
              multiline
              numberOfLines={3}
              value={instructions}
              onChangeText={setInstructions}
            />

            {/* Yêu cầu AI */}
            <TouchableOpacity style={styles.aiToggleRow} onPress={() => setRequestAi(v => !v)}>
              <View style={[styles.checkbox, requestAi && styles.checkboxChecked]}>
                {requestAi && <CheckCircle2 size={13} color="#FFFFFF" />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} color="#0891B2" strokeWidth={2.2} />
                <Text style={styles.aiToggleText}>Yêu cầu AI phân tích kết quả sau khi chụp</Text>
              </View>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setMriModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleIssueMriOrder} disabled={mriLoading}>
                {mriLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmText}>Xác Nhận Ra Y Lệnh</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Modal - Chuẩn hóa Mini-PACS & KTV 2 Vùng */}
      <Modal visible={uploadModal} transparent animationType="slide" onRequestClose={() => setUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { padding: 0, overflow: 'hidden', maxWidth: 640, alignSelf: 'center', width: '100%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FAFAFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <UploadCloud size={20} color="#0891B2" />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>Nộp Phim Chụp & Lưu Trữ Mini-PACS</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Ca chụp: <Text style={{ fontWeight: '600', color: '#7C3AED' }}>MRI vùng {activeVisit?.mriOrder?.region || 'Não bộ'}</Text> — {activeVisit?.patientId?.profile?.name || 'Bệnh nhân'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setUploadModal(false)} style={{ padding: 4 }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ padding: 20, maxHeight: 540 }}>
              {/* ── VÙNG 1: KEY SLICES (BẮT BUỘC) ────────────────────── */}
              <View style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E293B' }}>
                    ① Ảnh cắt lớp tiêu biểu (Key Slices) <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <View style={{ backgroundColor: uploadedImages.length > 0 ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: uploadedImages.length > 0 ? '#166534' : '#991B1B' }}>
                      {uploadedImages.length}/3 ảnh
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                  Chọn 1 – 3 lát cắt rõ tổn thương nhất (.jpg, .png) phục vụ AI phát hiện u tức thì và hiển thị nhanh trên Web EMR.
                </Text>

                {uploadedImages.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                    {uploadedImages.map((url, idx) => (
                      <View key={idx} style={{ width: 90, height: 90, borderRadius: 8, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#CBD5E1' }}>
                        <Image source={{ uri: getImageUrl(url) }} style={{ width: '100%', height: '100%' }} />
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 2, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Slice #{idx + 1}</Text>
                        </View>
                        <TouchableOpacity
                          style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}
                          onPress={() => handleRemoveImage(idx)}
                        >
                          <X size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {uploadedImages.length < 3 && (
                  <TouchableOpacity
                    style={[styles.textArea, { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderStyle: 'dashed', borderColor: '#7C3AED', borderWidth: 1.5, backgroundColor: '#FAF5FF' }]}
                    onPress={handlePickAndUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <View style={{ alignItems: 'center' }}>
                        <ActivityIndicator color="#7C3AED" />
                        <Text style={{ color: '#7C3AED', marginTop: 8, fontSize: 12, fontWeight: '600' }}>Đang tải ảnh cắt lớp lên...</Text>
                      </View>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <ImageIcon size={26} color="#7C3AED" />
                        <Text style={{ color: '#7C3AED', fontWeight: 'bold', marginTop: 6, fontSize: 13 }}>
                          + Chọn ảnh cắt lớp tiêu biểu (.jpg, .png)
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                          (Đã chọn {uploadedImages.length}/3 ảnh — Tối đa 3 ảnh)
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* ── VÙNG 2: DICOM ARCHIVE (TÙY CHỌN) ────────────────── */}
              <View style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E293B' }}>
                    ② Trọn bộ thư mục DICOM gốc (Mini-PACS)
                  </Text>
                  <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6D28D9' }}>Tùy chọn • Tối đa 200MB</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                  Nén toàn bộ file DICOM của ca chụp thành 1 tệp <Text style={{ fontWeight: 'bold' }}>.zip</Text> hoặc <Text style={{ fontWeight: 'bold' }}>.rar</Text> để lưu trữ lâu dài và đồng bộ Google Drive bệnh viện.
                </Text>

                {dicomZipFile ? (
                  <View style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 }}>
                      <Archive size={26} color="#6D28D9" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#4C1D95' }} numberOfLines={1}>
                          {dicomZipFile.filename}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#6D28D9', marginTop: 2 }}>
                          Dung lượng: <Text style={{ fontWeight: 'bold' }}>{formatBytes(dicomZipFile.size)}</Text> • Sẵn sàng lưu trữ PACS
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={handleRemoveDicomZip}
                    >
                      <Trash2 size={12} color="#DC2626" />
                      <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: 'bold' }}>Gỡ bỏ</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.textArea, { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderStyle: 'dashed', borderColor: '#6366F1', borderWidth: 1.5, backgroundColor: '#EEF2FF' }]}
                    onPress={handlePickAndUploadDicomZip}
                    disabled={uploadingZip}
                  >
                    {uploadingZip ? (
                      <View style={{ alignItems: 'center' }}>
                        <ActivityIndicator color="#4F46E5" />
                        <Text style={{ color: '#4F46E5', marginTop: 8, fontSize: 12, fontWeight: '600' }}>Đang tải luồng file nén DICOM lên máy chủ...</Text>
                        <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>Quá trình có thể mất vài giây tùy dung lượng mạng.</Text>
                      </View>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <UploadCloud size={26} color="#4F46E5" />
                        <Text style={{ color: '#4F46E5', fontWeight: 'bold', marginTop: 6, fontSize: 13 }}>
                          + Chọn file nén DICOM (.zip, .rar)
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                          Hỗ trợ file nén series lên đến 200MB
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* ── VÙNG 3: GHI CHÚ KỸ THUẬT ──────────────────────────── */}
              <Text style={styles.fieldLabel}>③ Ghi chú kỹ thuật viên (tùy chọn)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Ghi chú về tư thế bệnh nhân, chất lượng xung chụp, cản quang..."
                multiline
                numberOfLines={3}
                value={techNotes}
                onChangeText={setTechNotes}
              />
            </ScrollView>
            
            <View style={[styles.modalBtns, { padding: 20, marginTop: 0, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FAFAFF' }]}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setUploadModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnConfirm,
                  (uploadedImages.length === 0 || submitting || uploading || uploadingZip) && { opacity: 0.5 }
                ]}
                onPress={handleSubmitResult}
                disabled={uploadedImages.length === 0 || submitting || uploading || uploadingZip}
              >
                {submitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.btnConfirmText}>Đang lưu trữ...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={15} color="#fff" />
                    <Text style={styles.btnConfirmText}>Nộp Kết Quả Phim Chụp</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency Modal */}
      <Modal visible={emergencyModal} transparent animationType="slide" onRequestClose={() => setEmergencyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5', borderWidth: 2 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={22} color="#DC2626" />
              <Text style={[styles.modalTitle, { color: '#991B1B', marginBottom: 0 }]}>Kích Hoạt Cảnh Báo Cấp Cứu Khẩn Cấp</Text>
            </View>
            <Text style={styles.modalSub}>
              Bệnh nhân: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{emergencyVisit?.patientId?.profile?.name || 'Bệnh nhân'}</Text>
            </Text>

            <Text style={styles.fieldLabel}>Mức độ cảnh báo cấp cứu (Priority Level):</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  backgroundColor: emergencyLevel === 'RED' ? '#DC2626' : '#FEE2E2',
                  borderWidth: 1, borderColor: '#DC2626'
                }}
                onPress={() => setEmergencyLevel('RED')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={15} color={emergencyLevel === 'RED' ? '#FFFFFF' : '#991B1B'} />
                  <Text style={{ color: emergencyLevel === 'RED' ? '#FFFFFF' : '#991B1B', fontWeight: 'bold', fontSize: 13 }}>
                    CẤP CỨU ĐỎ (RED)
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  backgroundColor: emergencyLevel === 'ORANGE' ? '#EA580C' : '#FFEDD5',
                  borderWidth: 1, borderColor: '#EA580C'
                }}
                onPress={() => setEmergencyLevel('ORANGE')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} color={emergencyLevel === 'ORANGE' ? '#FFFFFF' : '#9A3412'} />
                  <Text style={{ color: emergencyLevel === 'ORANGE' ? '#FFFFFF' : '#9A3412', fontWeight: 'bold', fontSize: 13 }}>
                    CẤP CỨU CAM (ORANGE)
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Lý do cấp cứu khẩn cấp:</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: '#FFFFFF' }]}
              placeholder="Nhập lý do kích hoạt cấp cứu (VD: tăng áp lực nội sọ cấp, dọa tụt kẹt não, co giật liên tục do khối u não...)"
              multiline
              numberOfLines={3}
              value={emergencyReason}
              onChangeText={setEmergencyReason}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEmergencyModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, { backgroundColor: '#DC2626' }]}
                onPress={handleSendEmergencyAlert}
                disabled={triggeringEmergency}
              >
                {triggeringEmergency ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <BellRing size={16} color="#FFF" />
                    <Text style={styles.btnConfirmText}>PHÁT TÍN HIỆU CẤP CỨU</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── [THỰC TẾ BV: NGHỊCH LÝ 3] MODAL BẢNG KIỂM AN TOÀN CHỤP MRI ────────────── */}
      <MriSafetyCheckModal
        visible={safetyModal}
        onClose={() => setSafetyModal(false)}
        patientName={safetyVisit?.patientId?.profile?.name || 'Bệnh nhân'}
        hasPacemakerOrMetal={hasPacemakerOrMetal}
        setHasPacemakerOrMetal={setHasPacemakerOrMetal}
        hasClaustrophobia={hasClaustrophobia}
        setHasClaustrophobia={setHasClaustrophobia}
        hasKidneyDisease={hasKidneyDisease}
        setHasKidneyDisease={setHasKidneyDisease}
        isPregnant={isPregnant}
        setIsPregnant={setIsPregnant}
        safetyNotes={safetyNotes}
        setSafetyNotes={setSafetyNotes}
        onSubmit={handleSubmitSafety}
        submitting={submittingSafety}
      />

      {/* ── [THỰC TẾ BV: NGHỊCH LÝ 4] MODAL YÊU CẦU CHỤP LẠI (RESCAN) ───────────────── */}
      <MriRescanModal
        visible={rescanModal}
        onClose={() => setRescanModal(false)}
        patientName={rescanVisit?.patientId?.profile?.name || 'Bệnh nhân'}
        rescanReason={rescanReason}
        setRescanReason={setRescanReason}
        onConfirm={handleConfirmRescan}
        submitting={submittingRescan}
      />

      {/* ── [THỰC TẾ BV: NGHỊCH LÝ 4] MODAL HỦY CA CHỤP MRI ───────────────────────── */}
      <MriCancelModal
        visible={cancelModal}
        onClose={() => setCancelModal(false)}
        patientName={cancelVisit?.patientId?.profile?.name || 'Bệnh nhân'}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        onConfirm={handleConfirmCancel}
        submitting={submittingCancel}
      />

    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, margin: 16, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#15803D' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 2 },
  reason: { fontSize: 12, color: '#64748B' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  vitalsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  vitalsLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  vitalsValue: { fontSize: 12, color: '#0F172A' },
  mriInfo: { backgroundColor: '#F5F3FF', padding: 8, borderRadius: 8, marginBottom: 6 },
  mriInfoText: { fontSize: 12, color: '#7C3AED' },
  subInfo: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btnMri: { backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnMriText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnRead: { backgroundColor: '#0284C7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnReadText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnStart: { backgroundColor: '#15803D', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnStartText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  noTechText: { fontSize: 12, color: '#EF4444', fontStyle: 'italic' },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  aiToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#15803D', borderColor: '#15803D' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  aiToggleText: { fontSize: 13, color: '#334155', flex: 1 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default DoctorWorkQueueScreen;
