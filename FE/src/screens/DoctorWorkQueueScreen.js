import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Alert, Image, Platform, Pressable, useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { get, put, post, postFormData } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Config from '../constants/config';
import Colors from '../constants/colors';
import MriSafetyCheckModal from '../components/MriSafetyCheckModal';
import MriRescanModal from '../components/MriRescanModal';
import MriCancelModal from '../components/MriCancelModal';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageTabs from '../components/layout/PageTabs';
import PageContainer from '../components/layout/PageContainer';
import Layout from '../constants/layout';
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
  MoreHorizontal,
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
  'chờ bác sĩ đọc': { color: Colors.brandGreenSoft, text: Colors.brandGreen, label: 'Chờ đọc phim' },
  'hoàn tất':       { color: '#F0FDF4', text: '#059669', label: 'Hoàn tất' },
  'đã đóng':        { color: '#F1F5F9', text: '#64748B', label: 'Đã đóng' },
};

// Cờ trạng thái nhỏ: luôn icon + chữ, màu chữ đạt AA trên nền nhạt
const FLAG_TONES = {
  danger: { bg: Colors.errorBg, fg: Colors.errorText },
  warning: { bg: Colors.warningBg, fg: Colors.warningText },
  success: { bg: Colors.successBg, fg: Colors.successText },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
};
const Flag = ({ tone, icon: Icon, label }) => {
  const t = FLAG_TONES[tone];
  return (
    <View style={[styles.flag, { backgroundColor: t.bg }]}>
      <Icon size={12} color={t.fg} strokeWidth={2.4} />
      <Text style={[styles.flagText, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const DoctorWorkQueueScreen = ({ navigation, route }) => {
  const [currentMode, setCurrentMode] = useState(route?.params?.tab || 'examQueue');
  const [user, setUser] = useState(route?.params?.user || null);
  const [visits, setVisits] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'done'
  const { width: winWidth } = useWindowDimensions();
  const tableLayout = winWidth >= Layout.wide;
  const [menuFor, setMenuFor] = useState(null); // id ca đang mở menu "⋯"

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

  const patientNameOf = (v) => v.patientId?.profile?.name || v.patientId?.profile?.fullName || v.patientId?.email || 'Bệnh nhân';
  const isEmergency = (v) => v.priority === 'khẩn cấp';
  // Ca cấp cứu lên đầu, còn lại giữ nguyên thứ tự tiếp nhận
  const queueList = [...activeVisits].sort((a, b) => isEmergency(b) - isEmergency(a));
  const shownList = activeTab === 'queue' ? queueList : doneVisits;
  const emergencyCount = activeVisits.filter(isEmergency).length;

  // [THỰC TẾ BV: NGHỊCH LÝ 1] Viện phí & BHYT/Cấp cứu trước khi chụp MRI
  const feeFlagOf = (v) => {
    if (isEmergency(v)) return { tone: 'danger', icon: Flame, label: 'Cấp cứu · thu phí sau' };
    if (v.patientId?.profile?.hasBhyt || v.visitType === 'BHYT') return { tone: 'success', icon: ShieldCheck, label: 'BHYT bảo lãnh' };
    if (v.invoiceId?.status === 'đã thanh toán') return { tone: 'info', icon: CreditCard, label: 'Đã đóng phí MRI' };
    return { tone: 'warning', icon: AlertTriangle, label: 'Chưa đóng phí MRI' };
  };
  const safetyFlagOf = (v) => {
    if (v.mriSafetyChecklist?.passed) return { tone: 'success', icon: CheckCircle2, label: 'An toàn MRI: đạt' };
    if (v.mriSafetyChecklist?.isScreened) return { tone: 'danger', icon: XCircle, label: 'Chống chỉ định MRI' };
    return null;
  };
  const fmtWhen = (d) => {
    const t = new Date(d);
    const sameDay = t.toDateString() === new Date().toDateString();
    return t.toLocaleString('vi-VN', sameDay ? { hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };
  const waitLabel = (d) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
    if (m < 60) return `chờ ${m} phút`;
    if (m < 1440) return `chờ ${Math.floor(m / 60)} giờ ${m % 60} phút`;
    return `chờ ${Math.floor(m / 1440)} ngày`;
  };

  const openReadResult = (v) => {
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
  };

  const startExam = async (v) => {
    try {
      await put(`/api/v1/visits/${v._id}/status`, { status: 'đang khám' });
      fetchData();
    } catch (e) { Alert.alert('Lỗi', e.message); }
  };

  const finishExam = (v) => {
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
  };

  // Thao tác theo role — 1 nguồn dùng chung cho thẻ (điện thoại) và dòng bảng (desktop).
  const actionsOf = (v) => {
    const canOrderMri = v.status === 'đang khám';
    const canStartMri = v.status === 'chờ chụp' || v.status === 'chờ chụp lại';
    const canUploadMri = v.status === 'đang chụp';
    const hasReadResult = v.status === 'chờ bác sĩ đọc' || v.status === 'chờ kết quả AI';
    const list = [];
    if (!isNurse && (v.status === 'đang chờ' || v.status === 'chờ khám bệnh')) list.push({ key: 'start', variant: 'primary', icon: Stethoscope, label: 'Bắt đầu khám', onPress: () => startExam(v) });
    if (!isNurse && v.status === 'đang khám') list.push({ key: 'exam', variant: 'primary', icon: Pill, label: 'Khám & kê đơn', onPress: () => navigation.navigate('PatientDetail', { patientId: v.patientId?._id || v.patientId, visitId: v._id }) });
    if (isDoctor && canOrderMri) list.push({ key: 'mri', variant: 'secondary', icon: Scan, label: 'Ra y lệnh MRI', onPress: () => openMriModal(v) });
    if (!isNurse && v.status === 'đang khám') list.push({ key: 'finish', variant: 'secondary', icon: CheckCircle2, label: 'Kết thúc khám', onPress: () => finishExam(v) });
    if ((isTechnician || isDoctor) && canStartMri) list.push({ key: 'scan', variant: 'primary', icon: Camera, label: v.mriSafetyChecklist?.passed ? 'Vào buồng chụp' : 'Kiểm tra an toàn & chụp', onPress: () => handleStartScan(v) });
    if ((isTechnician || isDoctor) && canUploadMri) list.push({ key: 'upload', variant: 'primary', icon: Upload, label: 'Nộp ảnh phim', onPress: () => openUploadModal(v) });
    if (!isNurse && hasReadResult) list.push({ key: 'read', variant: 'primary', icon: Eye, label: 'Đọc kết quả phim', onPress: () => openReadResult(v) });
    if (isNurse && v.status === 'đang chờ') list.push({ key: 'vitals', variant: 'primary', icon: Activity, label: 'Nhập sinh hiệu', onPress: () => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id } }) });
    if ((isTechnician || isDoctor) && (canStartMri || canUploadMri)) {
      list.push({ key: 'rescan', variant: 'secondary', icon: RotateCcw, label: 'Chụp lại', onPress: () => openRescanModal(v) });
      list.push({ key: 'cancel', variant: 'danger', icon: XCircle, label: 'Hủy ca', onPress: () => openCancelModal(v) });
    }
    if (isDoctor) list.push({ key: 'emergency', variant: 'danger', icon: Flame, label: 'Chuyển cấp cứu', onPress: () => openEmergencyModal(v) });
    return list;
  };

  const btnStyleOf = (variant) => ({
    primary: { box: styles.btnPrimary, text: styles.btnPrimaryText, icon: '#FFFFFF' },
    secondary: { box: styles.btnSecondary, text: styles.btnSecondaryText, icon: Colors.brandGreen },
    danger: { box: styles.btnDangerOutline, text: styles.btnDangerOutlineText, icon: Colors.errorText },
  })[variant];

  const renderActionButton = (a) => {
    const s = btnStyleOf(a.variant);
    const Icon = a.icon;
    return (
      <TouchableOpacity key={a.key} style={[styles.btnBase, s.box]} onPress={a.onPress} accessibilityRole="button">
        <Icon size={14} color={s.icon} strokeWidth={2.2} />
        <Text style={s.text}>{a.label}</Text>
      </TouchableOpacity>
    );
  };

  // Thẻ (điện thoại): hiện đủ nút
  const renderActions = (v) => actionsOf(v).map(renderActionButton);

  // Dòng bảng (desktop): nút chính + menu "⋯" cho thao tác phụ
  const renderRowActions = (v) => {
    const all = actionsOf(v);
    const main = all.filter(a => a.variant === 'primary');
    const more = all.filter(a => a.variant !== 'primary');
    const open = menuFor === v._id;
    return (
      <View style={[styles.colActions, styles.rowActions]}>
        {main.map(renderActionButton)}
        {more.length > 0 ? (
          <View>
            <Pressable
              onPress={() => setMenuFor(open ? null : v._id)}
              accessibilityRole="button"
              accessibilityLabel="Thao tác khác"
              accessibilityState={{ expanded: open }}
              style={({ hovered }) => [styles.moreBtn, (hovered || open) && styles.moreBtnActive]}
            >
              <MoreHorizontal size={18} color={Colors.slateMuted} strokeWidth={2.2} />
            </Pressable>
            {open ? (
              <>
                <Pressable style={styles.menuBackdrop} onPress={() => setMenuFor(null)} accessibilityLabel="Đóng menu" />
                <View style={styles.menu}>
                  {more.map(a => {
                    const Icon = a.icon;
                    const danger = a.variant === 'danger';
                    return (
                      <Pressable
                        key={a.key}
                        accessibilityRole="menuitem"
                        onPress={() => { setMenuFor(null); a.onPress(); }}
                        style={({ hovered }) => [styles.menuItem, hovered && styles.menuItemHover]}
                      >
                        <Icon size={15} color={danger ? Colors.errorText : Colors.slateMuted} strokeWidth={2.2} />
                        <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  // Desktop: mỗi ca 1 dòng — đọc lướt theo cột, thao tác ở cuối dòng
  const renderVisitRow = (v, i) => {
    const mri = Boolean(v.mriOrder?.region);
    const fee = mri ? feeFlagOf(v) : isEmergency(v) ? { tone: 'danger', icon: Flame, label: 'Cấp cứu' } : null;
    const safety = mri ? safetyFlagOf(v) : null;
    return (
      <View key={v._id} style={[styles.tr, styles.trBody, activeTab === 'queue' && isEmergency(v) && styles.trUrgent, menuFor === v._id && styles.trMenuOpen]}>
        <Text style={[styles.cellNo, styles.colNo]}>{i + 1}</Text>
        <View style={styles.colPatient}>
          <Text style={styles.cellName} numberOfLines={1}>{patientNameOf(v)}</Text>
          <Text style={styles.cellSub} numberOfLines={1}>{v.reason || 'Khám tổng quát'} · {v.visitType || 'Ngoại trú'}</Text>
        </View>
        <View style={[styles.colStatus, styles.cellStack]}>
          <ClinicalStatusBadge status={v.status} />
          {fee ? <Flag {...fee} /> : null}
          {safety ? <Flag {...safety} /> : null}
        </View>
        <View style={[styles.colInfo, styles.cellStack]}>
          {mri ? (
            <Text style={styles.cellText}>MRI {v.mriOrder.region}{v.mriOrder.requestAiAnalysis ? ' · có AI phân tích' : ''}</Text>
          ) : v.vitals?.bloodPressure ? (
            <Text style={styles.cellNum}>HA {v.vitals.bloodPressure} · Mạch {v.vitals.pulse} · SpO₂ {v.vitals.spo2}%</Text>
          ) : (
            <Text style={styles.cellMuted}>Chưa đo sinh hiệu</Text>
          )}
          {v.status === 'chờ chụp lại' && v.mriRescanReason ? (
            <Text style={[styles.cellNote, styles.cellNoteWarn]}>Chụp lại: {v.mriRescanReason}</Text>
          ) : null}
          {v.status === 'đã hủy' && v.mriCancelReason ? (
            <Text style={[styles.cellNote, styles.cellNoteDanger]}>Lý do hủy: {v.mriCancelReason}</Text>
          ) : null}
        </View>
        <View style={styles.colTime}>
          <Text style={styles.cellNum}>{fmtWhen(v.createdAt)}</Text>
          {activeTab === 'queue' ? <Text style={styles.cellSub}>{waitLabel(v.createdAt)}</Text> : null}
          <Text style={styles.cellSub} numberOfLines={1}>Điều dưỡng: {v.nurseId?.profile?.name || v.nurseId?.email || 'Đã phân công'}</Text>
        </View>
        {renderRowActions(v)}
      </View>
    );
  };

  const renderVisitCard = (v) => {
    const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG['đang chờ'];

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
        {isEmergency(v) && !v.mriOrder?.region ? <View style={styles.cardFlags}><Flag tone="danger" icon={Flame} label="Cấp cứu" /></View> : null}

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
            <Activity size={13} color={Colors.brandGreen} strokeWidth={2.2} />
            <Text style={styles.vitalsLabel}>Sinh hiệu:</Text>
            <Text style={styles.vitalsValue}>
              HA {v.vitals.bloodPressure} | Mạch {v.vitals.pulse} | SpO₂ {v.vitals.spo2}%
            </Text>
          </View>
        )}

        {/* MRI Order info */}
        {Boolean(v.mriOrder?.region) && (
          <View style={[styles.mriInfo, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Scan size={13} color={Colors.brandGreen} strokeWidth={2.2} />
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
        <View style={styles.actions}>{renderActions(v)}</View>
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

  const screenTitle = isNurse ? 'Hàng đợi đo sinh hiệu' : isTechnician ? 'Hàng đợi phòng chụp MRI 3.0T' : 'Hàng đợi khám & chẩn đoán';

  return (
    <ResponsiveLayout navigation={navigation} title={screenTitle} user={user} activeRoute={`DoctorWorkQueue_${currentMode}`}>
      <PageHeader
        bar
        title={screenTitle}
        subtitle="Ca cấp cứu luôn nằm đầu danh sách."
        actions={<HeaderAction icon="refresh-cw" label="Làm mới" onPress={fetchData} />}
        below={
          <PageTabs
            tabs={[
              { key: 'examQueue', label: 'Khám lâm sàng', count: examActiveCount },
              { key: 'mriQueue', label: 'Chụp MRI', count: mriActiveCount },
            ]}
            value={currentMode}
            onChange={(k) => { setMenuFor(null); setCurrentMode(k); }}
          />
        }
      />

      <ScrollView>
        <PageContainer style={styles.page}>
          <View style={styles.toolbar}>
            <View style={styles.seg}>
              {[
                { key: 'queue', label: 'Đang xử lý', count: activeVisits.length },
                { key: 'done', label: 'Đã xong', count: doneVisits.length },
              ].map(t => (
                <Pressable
                  key={t.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === t.key }}
                  onPress={() => { setMenuFor(null); setActiveTab(t.key); }}
                  style={({ hovered }) => [styles.segBtn, activeTab === t.key && styles.segBtnActive, hovered && activeTab !== t.key && styles.segBtnHover]}
                >
                  <Text style={[styles.segText, activeTab === t.key && styles.segTextActive]}>{t.label} · {t.count}</Text>
                </Pressable>
              ))}
            </View>
            {activeTab === 'queue' && emergencyCount > 0 ? (
              <Flag tone="danger" icon={Flame} label={`${emergencyCount} ca cấp cứu`} />
            ) : null}
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={Colors.brandGreen} />
              <Text style={styles.emptyText}>Đang tải…</Text>
            </View>
          ) : shownList.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                {activeTab === 'queue' ? <Inbox size={26} color={Colors.brandGreen} strokeWidth={2} /> : <CheckCircle2 size={26} color={Colors.brandGreen} strokeWidth={2} />}
              </View>
              <Text style={styles.emptyText}>
                {activeTab === 'queue' ? 'Không có ca nào đang chờ xử lý' : 'Chưa có ca hoàn tất'}
              </Text>
              <Text style={styles.emptyHint}>
                {activeTab === 'queue' ? 'Ca mới do điều dưỡng/lễ tân tiếp nhận sẽ hiện ở đây. Bấm "Làm mới" để cập nhật.' : 'Ca đã kết thúc trong hàng đợi này sẽ được lưu ở đây.'}
              </Text>
            </View>
          ) : tableLayout ? (
            <View style={styles.table}>
              <View style={[styles.tr, styles.thead]}>
                <Text style={[styles.th, styles.colNo]}>STT</Text>
                <Text style={[styles.th, styles.colPatient]}>Bệnh nhân</Text>
                <Text style={[styles.th, styles.colStatus]}>Trạng thái</Text>
                <Text style={[styles.th, styles.colInfo]}>{currentMode === 'mriQueue' ? 'Y lệnh chụp' : 'Sinh hiệu'}</Text>
                <Text style={[styles.th, styles.colTime]}>Tiếp nhận</Text>
                <Text style={[styles.th, styles.colActions, styles.thRight]}>Thao tác</Text>
              </View>
              {shownList.map(renderVisitRow)}
            </View>
          ) : (
            <View style={styles.list}>{shownList.map(renderVisitCard)}</View>
          )}
        </PageContainer>
      </ScrollView>

      {/* MRI Order Modal */}
      <Modal visible={mriModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Scan size={20} color={Colors.brandGreen} strokeWidth={2.4} />
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
                <Cpu size={14} color={Colors.brandGreen} strokeWidth={2.2} />
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
                  <UploadCloud size={20} color={Colors.brandGreen} />
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A' }}>Nộp Phim Chụp & Lưu Trữ Mini-PACS</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Ca chụp: <Text style={{ fontWeight: '600', color: Colors.brandNavy }}>MRI vùng {activeVisit?.mriOrder?.region || 'Não bộ'}</Text> — {activeVisit?.patientId?.profile?.name || 'Bệnh nhân'}
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
                        <ActivityIndicator color={Colors.brandGreen} />
                        <Text style={{ color: Colors.brandGreen, marginTop: 8, fontSize: 13, fontWeight: '600' }}>Đang tải ảnh cắt lớp lên...</Text>
                      </View>
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <ImageIcon size={26} color={Colors.brandGreen} />
                        <Text style={{ color: Colors.brandGreen, fontWeight: 'bold', marginTop: 6, fontSize: 13 }}>
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
  page: { paddingTop: 20, paddingBottom: 32 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  seg: { flexDirection: 'row', backgroundColor: '#EEF2F7', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { height: 34, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: Colors.surface, boxShadow: '0 1px 2px rgba(11, 42, 85, 0.12)' },
  segBtnHover: { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  segText: { fontSize: 13, fontWeight: '600', color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  segTextActive: { color: Colors.brandNavy, fontWeight: '700' },
  flag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  flagText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  cardFlags: { flexDirection: 'row', marginBottom: 8 },
  // Bảng hàng đợi (desktop)
  table: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  thead: { backgroundColor: Colors.background, paddingVertical: 10, borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  th: { fontSize: 12, fontWeight: '600', color: Colors.slateMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  thRight: { textAlign: 'right' },
  trBody: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  trUrgent: { backgroundColor: Colors.errorBg },
  trMenuOpen: { zIndex: 20 },
  colNo: { width: 32 },
  colPatient: { flex: 2.2, minWidth: 0 },
  colStatus: { flex: 1.5, minWidth: 0 },
  colInfo: { flex: 1.8, minWidth: 0 },
  colTime: { flex: 1.3, minWidth: 0 },
  colActions: { width: 280 },
  cellStack: { gap: 6, alignItems: 'flex-start' },
  cellNo: { fontSize: 14, fontWeight: '600', color: Colors.secondary, fontVariant: ['tabular-nums'] },
  cellName: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy },
  cellSub: { fontSize: 13, color: Colors.secondary, marginTop: 2 },
  cellText: { fontSize: 14, color: Colors.slateDark },
  cellNum: { fontSize: 14, color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  cellMuted: { fontSize: 14, color: Colors.secondary },
  cellNote: { fontSize: 13, lineHeight: 18 },
  cellNoteWarn: { color: Colors.warningText },
  cellNoteDanger: { color: Colors.errorText },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  moreBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  moreBtnActive: { backgroundColor: Colors.background },
  menuBackdrop: { position: Platform.OS === 'web' ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  menu: { position: 'absolute', top: 42, right: 0, zIndex: 2, minWidth: 200, paddingVertical: 6, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, boxShadow: '0 4px 12px rgba(11, 42, 85, 0.10)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 14 },
  menuItemHover: { backgroundColor: Colors.background },
  menuText: { fontSize: 14, color: Colors.slateDark },
  menuTextDanger: { color: Colors.errorText, fontWeight: '600' },
  list: { gap: 12 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
    boxShadow: '0 1px 2px rgba(11, 42, 85, 0.05)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  patientName: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy, marginBottom: 2 },
  reason: { fontSize: 13, color: Colors.slateMuted, lineHeight: 18 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  vitalsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  vitalsLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  vitalsValue: { fontSize: 12, color: '#0F172A' },
  mriInfo: { backgroundColor: '#EEF3FA', padding: 8, borderRadius: 8, marginBottom: 6 },
  mriInfoText: { fontSize: 13, color: Colors.brandNavy },
  subInfo: { fontSize: 12, color: Colors.secondary, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btnBase: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8 },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderStrong },
  btnSecondaryText: { color: Colors.slateDark, fontSize: 13, fontWeight: '600' },
  btnDangerOutline: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#FCA5A5' },
  btnDangerOutlineText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  btnMri: { backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnMriText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 8 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.brandGreenSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: Colors.secondary, textAlign: 'center', maxWidth: 420, lineHeight: 20 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.secondary, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 42, 85, 0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.brandNavy, marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chipActive: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  noTechText: { fontSize: 12, color: '#EF4444', fontStyle: 'italic' },
  textArea: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 13, color: '#0F172A', minHeight: 70, textAlignVertical: 'top', backgroundColor: '#F8FAFC' },
  aiToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  aiToggleText: { fontSize: 13, color: '#334155', flex: 1 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  btnCancelText: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  btnConfirm: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.brandGreen, justifyContent: 'center', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, color: '#fff', fontWeight: 'bold' },
});

export default DoctorWorkQueueScreen;
