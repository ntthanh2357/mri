import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { post } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Config from '../constants/config';
import styles from './CreateImagingResultScreen.styles';

const CreateImagingResultScreen = ({ route, navigation }) => {
  const { patientInfo } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState(false);
  const [medicalId, setMedicalId] = useState(patientInfo?.id || '26025699');
  const [patientName, setPatientName] = useState(patientInfo?.name || '');
  const [birthYear, setBirthYear] = useState('1995');
  const [gender, setGender] = useState(patientInfo?.gender || 'Nam');
  const [address, setAddress] = useState('., Phường Hòa Xuân, Tp Đà Nẵng');
  const [imagingType, setImagingType] = useState('MRI');
  const [procedure, setProcedure] = useState('Chụp cộng hưởng từ sọ não (0.2-1.5T) - (Chụp MRI không thuốc)');
  const [technique, setTechnique] = useState('Chụp MRI sọ não lát cắt mỏng qua vùng hố sau và thùy thái dương, dựng hình 3D mạch máu não.');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [radiologist, setRadiologist] = useState('Bác sĩ Gia Huy');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errors, setErrors] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [correctClass, setCorrectClass] = useState('notumor');
  const [coordX, setCoordX] = useState('120');
  const [coordY, setCoordY] = useState('120');
  const [coordW, setCoordW] = useState('100');
  const [coordH, setCoordH] = useState('100');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [approvingAI, setApprovingAI] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);

  const showAlert = (title, message, callback) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
      if (callback) callback();
    } else {
      Alert.alert(title, message, callback ? [{ text: 'OK', onPress: callback }] : undefined);
    }
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handlePickImages = () => {
    if (Platform.OS !== 'web') {
      showAlert('Hỗ trợ', 'Tính năng chọn tệp hiện chỉ hỗ trợ trên trình duyệt Web.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (images.length + files.length > 10) {
        showAlert('Giới hạn', 'Bạn chỉ được chọn tối đa 10 hình ảnh.');
        return;
      }

      setUploading(true);
      const uploadedUrls = [...images];

      for (let file of files) {
        try {
          const fileData = await readFileAsBase64(file);
          const response = await post('/api/v1/imaging/upload', {
            fileData,
            fileName: file.name,
            imagingType
          });

          if (response.success && response.data?.imageUrl) {
            uploadedUrls.push(response.data.imageUrl);
          } else {
            showAlert('Lỗi', `Tải ảnh ${file.name} thất bại: ${response.message || 'Không có phản hồi'}`);
          }
        } catch (err) {
          console.error('Upload error:', err);
          showAlert('Lỗi', `Không thể tải tệp ${file.name} lên server.`);
        }
      }

      setImages(uploadedUrls);
      setUploading(false);
    };
    input.click();
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  // Simulated OCR & Fill function
  const handleOcrFill = () => {
    setMedicalId('26025699');
    setPatientName('Bệnh nhân Tuấn Thành');
    setBirthYear('1995');
    setGender('Nam');
    setAddress('291 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng');
    setImagingType('MRI');
    setProcedure('Chụp cộng hưởng từ sọ não (MRI) có cản từ');
    setTechnique('Chụp cộng hưởng từ sọ não đa xung, lát cắt mỏng qua các bể sọ và nhu mô não thất.');
    setFindings('Phát hiện khối u vùng thùy trán bên trái, kích thước tương đương 15x18mm. Khối u có ranh giới rõ ràng, bắt thuốc cản từ mạnh và đồng nhất sau tiêm, gây phù nề nhẹ xung quanh.');
    setConclusion('U màng não thùy trán trái (Meningioma) lành tính. Đề xuất hội chẩn chuyên khoa phẫu thuật thần kinh.');
    setRadiologist('Bs. Lê Quốc Tuấn');

    // Clear validation errors when template fields are filled
    setErrors(prev => ({
      ...prev,
      medicalId: null,
      patientName: null,
      procedure: null,
      findings: null,
      conclusion: null,
      radiologist: null,
    }));

    showAlert('Xác thực OCR', 'Đã tự động trích xuất và điền thông tin hành chính & chẩn đoán hình ảnh từ phim chụp giấy!');
  };

  const handleAiAnalysis = async () => {
    if (images.length === 0) {
      showAlert('Yêu cầu', 'Vui lòng tải lên ít nhất một hình ảnh MRI trước khi thực hiện chẩn đoán AI.');
      return;
    }

    setAnalyzing(true);
    try {
      const payload = { imageUrl: images[0] };
      const response = await post('/api/v1/imaging/analyze-ai', payload);

      if (response.success && response.data) {
        const { class_name, confidence, annotated_image, consensus_message } = response.data;

        // Auto-fill findings and conclusion
        setFindings(consensus_message || `Phân tích AI phát hiện khối u loại ${class_name.toUpperCase()}.`);
        
        let conclusionText = '';
        if (class_name === 'notumor') {
          conclusionText = `Không phát hiện bất thường sọ não trên hình ảnh MRI (Độ tự tin của AI: ${confidence}%).`;
        } else {
          conclusionText = `Hình ảnh gợi ý khối u loại ${class_name.toUpperCase()} (Độ tự tin của AI: ${confidence}%). Đề xuất hội chẩn chuyên khoa phẫu thuật thần kinh.`;
        }
        setConclusion(conclusionText);

        // If an annotated image is returned, add it to the image gallery
        if (annotated_image) {
          setImages((prev) => [...prev, annotated_image]);
        }

        setAiResult(response.data);
        setCorrectClass(class_name);
        setCoordX('120');
        setCoordY('120');
        setCoordW('100');
        setCoordH('100');

        // Clear validation errors
        setErrors((prev) => ({
          ...prev,
          findings: null,
          conclusion: null,
        }));

        showAlert('Chẩn đoán AI', `Hoàn tất phân tích MRI! Phát hiện: ${class_name.toUpperCase()} (Tin cậy: ${confidence}%).`);
      } else {
        showAlert('Lỗi phân tích AI', response.message || 'Không thể chẩn đoán ảnh chụp.');
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      showAlert('Lỗi kết nối', 'Không thể kết nối đến AI server. Đảm bảo Backend và FastAPI microservice đã khởi động.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (images.length === 0) {
      showAlert('Yêu cầu', 'Cần có ít nhất một hình ảnh phim chụp để gửi phản hồi.');
      return;
    }
    setSendingFeedback(true);
    try {
      const payload = {
        imageUrl: images[0],
        correct_class: correctClass,
        x: parseInt(coordX) || 0,
        y: parseInt(coordY) || 0,
        w: parseInt(coordW) || 0,
        h: parseInt(coordH) || 0
      };

      const response = await post('/api/v1/imaging/feedback-ai', payload);
      if (response.success) {
        showAlert('Đóng góp thành công', 'Ý kiến hiệu chỉnh khối u đã được ghi nhận. Hệ thống sẽ sử dụng dữ liệu này để tự động huấn luyện lại AI.');
        setShowFeedbackForm(false);
      } else {
        showAlert('Lỗi', response.message || 'Không thể gửi phản hồi.');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      showAlert('Lỗi kết nối', 'Không thể gửi phản hồi đến máy chủ.');
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleApproveAI = async () => {
    if (!aiResult) return;
    setApprovingAI(true);
    setApproveSuccess(false);
    try {
      // Extract filename from imageUrl
      const imageUrl = images[0] || '';
      const filename = imageUrl.split('/').pop() || 'scan.jpg';
      const payload = {
        filename,
        predicted_class: aiResult.class_name,
        confidence: aiResult.confidence ?? 0,
      };
      const response = await post('/api/v1/imaging/approve-ai', payload);
      if (response.success) {
        setApproveSuccess(true);
        showAlert('Xác nhận thành công', `Đã ghi nhận kết quả AI (${aiResult.class_name?.toUpperCase()}) là ĐÚNG. Hệ thống cảm ơn bác sĩ đã xác nhận!`);
      } else {
        showAlert('Lỗi', response.message || 'Không thể ghi nhận xác nhận.');
      }
    } catch (err) {
      console.error('Approve AI error:', err);
      showAlert('Lỗi kết nối', 'Không thể gửi xác nhận đến máy chủ. Vui lòng thử lại.');
    } finally {
      setApprovingAI(false);
    }
  };

  const handleSaveResult = async () => {
    // Validate required fields
    const newErrors = {};
    if (!medicalId || !medicalId.trim()) newErrors.medicalId = 'Mã y tế là trường bắt buộc.';
    if (!patientName || !patientName.trim()) newErrors.patientName = 'Họ tên bệnh nhân là trường bắt buộc.';
    if (!procedure || !procedure.trim()) newErrors.procedure = 'Chỉ định dịch vụ là trường bắt buộc.';
    if (!findings || !findings.trim()) newErrors.findings = 'Mô tả hình ảnh y khoa là trường bắt buộc.';
    if (!conclusion || !conclusion.trim()) newErrors.conclusion = 'Kết luận chẩn đoán là trường bắt buộc.';
    if (!radiologist || !radiologist.trim()) newErrors.radiologist = 'Bác sĩ ký tên là trường bắt buộc.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showAlert('Lỗi', 'Vui lòng điền đầy đủ các thông tin bắt buộc được đánh dấu đỏ.');
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const payload = {
        medicalId,
        patientName,
        birthYear: parseInt(birthYear) || null,
        gender,
        address,
        orderDate: new Date(),
        orderingDoctor: 'Bác sĩ Nguyễn Văn A',
        orderingDepartment: imagingType === 'MRI' ? 'Khoa Khám Bệnh' : 'Khoa Cấp Cứu',
        medicalRecordNumber: `SBA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        diagnosis: imagingType === 'MRI' ? 'U não thái dương' : 'Theo dõi u não',
        procedure,
        technique,
        findings,
        conclusion,
        radiologist,
        reportDate: new Date(),
        images,
        imagingType,
      };

      const response = await post('/api/v1/imaging', payload);
      if (response.success) {
        showAlert('Thành công', 'Đã đăng tải kết quả chẩn đoán hình ảnh mới lên hệ thống!', () => {
          navigation.goBack();
        });
      } else {
        showAlert('Lỗi', response.message || 'Không thể lưu kết quả chụp.');
      }
    } catch (error) {
      console.error('Save imaging result error:', error);
      showAlert('Lỗi', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại Backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PatientRecords">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nhập Kết quả MRI / CT-Scan</Text>
          <TouchableOpacity 
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]} 
            onPress={handleSaveResult}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Lưu & Đăng</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]}>
          <View style={styles.formSheet}>
            
            {/* Auto Fill Buttons */}
            <View style={[styles.helperRow, { gap: 10 }]}>
              <TouchableOpacity style={[styles.helperBtn, { backgroundColor: '#0F172A', borderColor: '#1E293B', flex: 1 }]} onPress={handleOcrFill}>
                <Text style={[styles.helperBtnText, { color: '#4ADE80', fontWeight: 'bold' }]}>⚡ Quét tự động (OCR & Fill)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.helperBtn, 
                  { 
                    backgroundColor: '#1E1B4B', 
                    borderColor: '#312E81', 
                    flex: 1,
                    opacity: images.length === 0 ? 0.6 : 1 
                  }
                ]} 
                onPress={handleAiAnalysis}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#818CF8" />
                ) : (
                  <Text style={[styles.helperBtnText, { color: '#818CF8', fontWeight: 'bold' }]}>
                    🤖 Phân tích AI ({images.length === 0 ? 'Chưa nạp ảnh' : 'Đọc phim & Vẽ Heatmap'})
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {aiResult && (
              <View style={{ backgroundColor: '#EEF2F6', borderLeftWidth: 4, borderLeftColor: '#3B82F6', padding: 16, borderRadius: 8, marginVertical: 12 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1E3A8A', marginBottom: 4 }}>🤖 Kết quả chẩn đoán AI (Chỉ dùng tham khảo)</Text>
                <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                  - Loại khối u phát hiện: <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>{aiResult.class_name?.toUpperCase()}</Text>
                </Text>
                <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 8 }}>
                  - Độ tự tin: <Text style={{ fontWeight: 'bold' }}>{aiResult.confidence}%</Text>
                </Text>
                {aiResult.consensus_message ? (
                  <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 10 }}>
                    {aiResult.consensus_message}
                  </Text>
                ) : null}

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {/* APPROVE button - AI was correct */}
                  {!approveSuccess ? (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        backgroundColor: approvingAI ? '#D1FAE5' : '#10B981',
                        borderRadius: 6,
                        opacity: approvingAI ? 0.7 : 1,
                      }}
                      onPress={handleApproveAI}
                      disabled={approvingAI}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                        {approvingAI ? '⏳ Đang ghi nhận...' : '✅ AI đúng — Xác nhận'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#D1FAE5', borderRadius: 6, borderWidth: 1, borderColor: '#6EE7B7' }}>
                      <Text style={{ color: '#065F46', fontSize: 12, fontWeight: 'bold' }}>✅ Đã xác nhận AI đúng</Text>
                    </View>
                  )}

                  {/* FEEDBACK button - AI was wrong */}
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#3B82F6', borderRadius: 6 }}
                    onPress={() => setShowFeedbackForm(!showFeedbackForm)}
                    disabled={approveSuccess}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', opacity: approveSuccess ? 0.5 : 1 }}>
                      {showFeedbackForm ? '✕ Đóng Hiệu chỉnh' : '✍️ AI sai — Hiệu chỉnh lại'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showFeedbackForm && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#475569', marginBottom: 8 }}>
                      ĐIỀU CHỈNH KẾT QUẢ AI SAI:
                    </Text>

                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>Loại khối u thực tế (Phân loại):</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {['glioma', 'meningioma', 'pituitary', 'notumor'].map((cls) => (
                        <TouchableOpacity
                          key={cls}
                          style={{
                            paddingVertical: 5,
                            paddingHorizontal: 10,
                            backgroundColor: correctClass === cls ? '#B91C1C' : '#F1F5F9',
                            borderRadius: 4
                          }}
                          onPress={() => setCorrectClass(cls)}
                        >
                          <Text style={{ color: correctClass === cls ? '#FFFFFF' : '#334155', fontSize: 11, fontWeight: 'bold' }}>
                            {cls.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>
                      Tọa độ vùng khối u (Khoanh vùng/Segmentation):
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>X</Text>
                        <TextInput style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 6, borderRadius: 4, fontSize: 11 }} value={coordX} onChangeText={setCoordX} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>Y</Text>
                        <TextInput style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 6, borderRadius: 4, fontSize: 11 }} value={coordY} onChangeText={setCoordY} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>W</Text>
                        <TextInput style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 6, borderRadius: 4, fontSize: 11 }} value={coordW} onChangeText={setCoordW} keyboardType="numeric" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>H</Text>
                        <TextInput style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 6, borderRadius: 4, fontSize: 11 }} value={coordH} onChangeText={setCoordH} keyboardType="numeric" />
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={{ paddingVertical: 8, backgroundColor: '#10B981', borderRadius: 6, alignItems: 'center', opacity: sendingFeedback ? 0.7 : 1 }}
                      onPress={handleSubmitFeedback}
                      disabled={sendingFeedback}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                        {sendingFeedback ? 'Đang gửi phản hồi...' : '✓ Xác nhận & Gửi phản hồi AI học lại'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Section 1: Administrative Info */}
            <Text style={styles.sectionHeading}>I. Thông tin hành chính bệnh nhân</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={styles.inputLabel}>Mã y tế (Medical ID) *</Text>
                <TextInput
                  style={[styles.input, errors.medicalId && styles.inputError]}
                  placeholder="Nhập mã y tế y khoa"
                  value={medicalId}
                  onChangeText={(text) => {
                    setMedicalId(text);
                    if (errors.medicalId) setErrors(prev => ({ ...prev, medicalId: null }));
                  }}
                />
                {errors.medicalId && <Text style={styles.errorText}>{errors.medicalId}</Text>}
              </View>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>Họ và tên bệnh nhân *</Text>
                <TextInput
                  style={[styles.input, errors.patientName && styles.inputError]}
                  placeholder="Nhập họ và tên"
                  value={patientName}
                  onChangeText={(text) => {
                    setPatientName(text);
                    if (errors.patientName) setErrors(prev => ({ ...prev, patientName: null }));
                  }}
                />
                {errors.patientName && <Text style={styles.errorText}>{errors.patientName}</Text>}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Năm sinh</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 1995"
                  keyboardType="numeric"
                  value={birthYear}
                  onChangeText={setBirthYear}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Giới tính *</Text>
                <View style={styles.genderRow}>
                  {['Nam', 'Nữ', 'Khác'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderBtn, gender === g && styles.activeGenderBtn]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderBtnText, gender === g && styles.activeGenderBtnText]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Địa chỉ</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập địa chỉ bệnh nhân"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.divider} />

            {/* Section 2: Clinical scan configs */}
            <Text style={styles.sectionHeading}>II. Chỉ định lâm sàng & Kỹ thuật</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Loại chẩn đoán hình ảnh *</Text>
              <View style={styles.typeRow}>
                {['MRI', 'CT'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, imagingType === type && styles.activeTypeBtn]}
                    onPress={() => setImagingType(type)}
                  >
                    <Text style={[styles.typeBtnText, imagingType === type && styles.activeTypeBtnText]}>
                      Chụp {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Chỉ định dịch vụ (Tên phim chụp) *</Text>
              <TextInput
                style={[styles.input, errors.procedure && styles.inputError]}
                placeholder="Ví dụ: Chụp cộng hưởng từ sọ não..."
                value={procedure}
                onChangeText={(text) => {
                  setProcedure(text);
                  if (errors.procedure) setErrors(prev => ({ ...prev, procedure: null }));
                }}
              />
              {errors.procedure && <Text style={styles.errorText}>{errors.procedure}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kỹ thuật thực hiện</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={2}
                placeholder="Mô tả kỹ thuật lát cắt..."
                value={technique}
                onChangeText={setTechnique}
              />
            </View>

            <View style={styles.divider} />

            {/* Section 3: Diagnostic findings */}
            <Text style={styles.sectionHeading}>III. Nội dung mô tả & Kết luận</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mô tả hình ảnh y khoa *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { height: 120 }, errors.findings && styles.inputError]}
                multiline
                numberOfLines={6}
                placeholder="Nhập mô tả phim chụp chi tiết (ví dụ: phát hiện khối u thái dương kích thước 22x24mm...)"
                value={findings}
                onChangeText={(text) => {
                  setFindings(text);
                  if (errors.findings) setErrors(prev => ({ ...prev, findings: null }));
                }}
              />
              {errors.findings && <Text style={styles.errorText}>{errors.findings}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kết luận chẩn đoán *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { height: 80 }, errors.conclusion && styles.inputError]}
                multiline
                numberOfLines={4}
                placeholder="Nhập kết luận chính của Bác sĩ chuyên khoa..."
                value={conclusion}
                onChangeText={(text) => {
                  setConclusion(text);
                  if (errors.conclusion) setErrors(prev => ({ ...prev, conclusion: null }));
                }}
              />
              {errors.conclusion && <Text style={styles.errorText}>{errors.conclusion}</Text>}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>Bác sĩ chuyên khoa ký tên *</Text>
                <TextInput
                  style={[styles.input, errors.radiologist && styles.inputError]}
                  placeholder="Nhập tên bác sĩ đọc phim"
                  value={radiologist}
                  onChangeText={(text) => {
                    setRadiologist(text);
                    if (errors.radiologist) setErrors(prev => ({ ...prev, radiologist: null }));
                  }}
                />
                {errors.radiologist && <Text style={styles.errorText}>{errors.radiologist}</Text>}
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Số lượng ảnh u</Text>
                <Text style={styles.imageCountText}>
                  {images.length > 0 ? `${images.length} ảnh đã nạp` : 'Chưa nạp ảnh'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Section IV: Upload Scan Images */}
            <Text style={styles.sectionHeading}>IV. Tải lên hình ảnh phim chụp (Tối đa 10 ảnh)</Text>
            
            <View style={styles.uploadAreaContainer}>
              {images.length > 0 && (
                <View style={styles.thumbnailGrid}>
                  {images.map((img, idx) => {
                    const fullUri = img.startsWith('http') ? img : `${Config.API_URL}${img}`;
                    return (
                      <View key={idx} style={styles.thumbnailContainer}>
                        <Image
                           source={{ uri: fullUri }}
                          style={styles.uploadedThumbnail}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeBadge}
                          onPress={() => handleRemoveImage(idx)}
                        >
                          <Text style={styles.removeBadgeText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                onPress={handlePickImages}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#15803D" />
                ) : (
                  <Text style={styles.uploadButtonText}>➕ Tải ảnh lên từ thiết bị</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.uploadTipText}>Hỗ trợ các định dạng PNG, JPG, JPEG (tối đa 10 ảnh).</Text>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default CreateImagingResultScreen;
