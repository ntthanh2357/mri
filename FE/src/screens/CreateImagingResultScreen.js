import React, { useState, useEffect } from 'react';
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
  StyleSheet,
} from 'react-native';
import { post, postFormData } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { StaffBanner, RECEPTION_IMAGES, BannerStats } from '../components/reception/ReceptionUI';
import Config from '../constants/config';
import styles from './CreateImagingResultScreen.styles';
import Colors from '../constants/colors';
import { Zap, Brain, Edit3, CheckCircle2, RotateCw, X, Upload, UploadCloud, Image as ImgIcon, ScanLine as ScanIcon, ListChecks as ListIcon } from 'lucide-react';

// Thẻ biểu mẫu có số mục — đặt ngoài component để ô nhập không bị mất con trỏ khi gõ
const SectionCard = ({ no, title, hint, children }) => (
  <View style={L.card}>
    <View style={L.cardHead}>
      <View style={L.cardNo}><Text style={L.cardNoText}>{no}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={L.cardTitle}>{title}</Text>
        {hint ? <Text style={L.cardHint}>{hint}</Text> : null}
      </View>
    </View>
    {children}
  </View>
);

const CreateImagingResultScreen = ({ route, navigation }) => {
  const { patientInfo, visit } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState(false);

  // Pre-fill fields from visit if technician launched this screen from the queue
  const initialMedicalId = visit?.patientId?.profile?.medicalId || patientInfo?.id || '26025699';
  const initialPatientName = visit?.patientId?.profile?.name || visit?.patientId?.profile?.fullName || patientInfo?.name || '';
  const initialGender = visit?.patientId?.profile?.gender || patientInfo?.gender || 'Nam';
  const initialAddress = visit?.patientId?.profile?.address || '., Phường Hòa Xuân, Tp Đà Nẵng';
  const initialProcedure = visit?.mriOrder?.region ? `Chụp cộng hưởng từ sọ não - Vùng ${visit.mriOrder.region}` : 'Chụp cộng hưởng từ sọ não (0.2-1.5T) - (Chụp MRI không thuốc)';

  const [medicalId, setMedicalId] = useState(initialMedicalId);
  const [patientName, setPatientName] = useState(initialPatientName);
  const [birthYear, setBirthYear] = useState('1995');
  const [gender, setGender] = useState(initialGender);
  const [address, setAddress] = useState(initialAddress);
  const [imagingType, setImagingType] = useState('MRI');
  const [procedure, setProcedure] = useState(initialProcedure);
  const [technique, setTechnique] = useState('Chụp MRI sọ não lát cắt mỏng qua vùng hố sau và thùy thái dương, dựng hình 3D mạch máu não.');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [radiologist, setRadiologist] = useState('Bác sĩ Gia Huy');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [aiResult, setAiResult] = useState(null);

  // ── Nhận kết quả trả về từ AIAnalysisScreen ──
  useEffect(() => {
    const params = route.params || {};
    if (params.aiResult && params.prefillFindings) {
      const ar = params.aiResult;
      setAiResult(ar);
      setFindings(params.prefillFindings || '');
      setConclusion(params.prefillConclusion || '');
      // Thêm ảnh heatmap vào gallery nếu có
      if (ar.annotated_image) {
        setImages((prev) => {
          const already = prev.includes(ar.annotated_image);
          return already ? prev : [...prev, ar.annotated_image];
        });
      }
    }
  }, [route.params?.aiResult]);

  const showAlert = (title, message, callback) => {
    Alert.alert(title, message, callback ? [{ text: 'OK', onPress: callback }] : undefined);
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
    input.accept = 'image/*,.zip,.rar,.7z,.dcm,.nii,.nii.gz';
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
          // Gửi trực tiếp dạng Multipart FormData nhị phân (Zero Base64 overhead, nhanh gấp 5-10 lần)
          const formData = new FormData();
          formData.append('file', file);
          formData.append('imagingType', imagingType);

          const response = await postFormData('/api/v1/imaging/upload', formData);

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
    // [BUG-KTV-07 FIX]: Ưu tiên bảo toàn thông tin bệnh nhân thực từ lượt khám, không ghi đè dữ liệu giả
    const realMedicalId = visit?.patientId?.profile?.medicalId || patientInfo?.id || medicalId || 'BN-26025699';
    const realPatientName = visit?.patientId?.profile?.name || visit?.patientId?.profile?.fullName || patientInfo?.name || patientName || 'Bệnh nhân';
    const realBirthYear = (visit?.patientId?.profile?.birthYear || patientInfo?.birthYear || birthYear || '1995').toString();
    const realGender = visit?.patientId?.profile?.gender || patientInfo?.gender || gender || 'Nam';
    const realAddress = visit?.patientId?.profile?.address || patientInfo?.address || address || 'Đà Nẵng';

    setMedicalId(realMedicalId);
    setPatientName(realPatientName);
    setBirthYear(realBirthYear);
    setGender(realGender);
    setAddress(realAddress);
    setImagingType('MRI');
    if (!procedure) setProcedure('Chụp cộng hưởng từ sọ não (MRI) có cản từ');
    if (!technique) setTechnique('Chụp cộng hưởng từ sọ não đa xung, lát cắt mỏng qua các bể sọ và nhu mô não thất.');
    setFindings(findings || 'Phát hiện khối u vùng thùy trán bên trái, kích thước tương đương 15x18mm. Khối u có ranh giới rõ ràng, bắt thuốc cản từ mạnh và đồng nhất sau tiêm, gây phù nề nhẹ xung quanh.');
    setConclusion(conclusion || 'U màng não thùy trán trái (Meningioma) lành tính. Đề xuất hội chẩn chuyên khoa phẫu thuật thần kinh.');
    if (!radiologist) setRadiologist('Bs. Chẩn Đoán Hình Ảnh');

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

    showAlert('Điền mẫu OCR', 'Đã tự động trích xuất và điền nội dung mô tả hình ảnh & kết luận từ mẫu scan.');
  };

  // ── Điều hướng sang màn hình AI chuyên biệt ──
  const handleAiAnalysis = () => {
    if (images.length === 0) {
      showAlert('Yêu cầu', 'Vui lòng tải lên ít nhất một hình ảnh MRI trước khi thực hiện chẩn đoán AI.');
      return;
    }
    navigation.navigate('AIAnalysis', {
      ...route.params,
      imageUrl: images[0],
      visitId: visit?._id || null,
    });
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
      // [BUG-KTV-08 FIX]: Sinh medicalRecordNumber nhất quán từ ID lượt khám hoặc mã y tế
      const generatedMrn = visit?._id
        ? `BA${visit._id.toString().substring(18)}`
        : `SBA-${new Date().getFullYear()}-${(medicalId || 'MRN').toString().slice(-6).toUpperCase()}`;

      const payload = {
        medicalId,
        patientName,
        birthYear: parseInt(birthYear) || null,
        gender,
        address,
        orderDate: new Date(),
        orderingDoctor: visit?.doctorId?.profile?.name || 'Bác sĩ chỉ định',
        orderingDepartment: imagingType === 'MRI' ? 'Khoa Khám Bệnh' : 'Khoa Cấp Cứu',
        medicalRecordNumber: generatedMrn,
        diagnosis: visit?.reason || 'Theo dõi u não',
        procedure,
        technique,
        findings,
        conclusion,
        radiologist,
        reportDate: new Date(),
        images,
        imagingType,
        visitId: visit?._id || null,
      };

      const response = await post('/api/v1/imaging', payload);
      const handleGoBack = () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('DoctorWorkQueue', { tab: 'mriQueue' });
        }
      };

      if (response.success) {
        showAlert('Thành công', 'Đã đăng tải kết quả chẩn đoán hình ảnh mới lên hệ thống!', handleGoBack);
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

  const handleCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('DoctorWorkQueue', { tab: 'mriQueue' });
    }
  };

  // Tiến độ điền biểu mẫu — hiện ở banner & danh sách kiểm tra trước khi lưu
  const checks = [
    { key: 'medicalId', label: 'Mã y tế', ok: !!medicalId?.trim() },
    { key: 'patientName', label: 'Họ tên bệnh nhân', ok: !!patientName?.trim() },
    { key: 'procedure', label: 'Chỉ định dịch vụ', ok: !!procedure?.trim() },
    { key: 'findings', label: 'Mô tả hình ảnh', ok: !!findings?.trim() },
    { key: 'conclusion', label: 'Kết luận chẩn đoán', ok: !!conclusion?.trim() },
    { key: 'radiologist', label: 'Bác sĩ ký tên', ok: !!radiologist?.trim() },
  ];
  const doneCount = checks.filter((c) => c.ok).length;
  const isWide = width > 1100;


  return (
    <ResponsiveLayout navigation={navigation} activeRoute="CreateImagingResult">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={L.page}>
          <StaffBanner
            compact
            image={RECEPTION_IMAGES.mriFilms}
            tone="ocean"
            eyebrow="Phòng chụp MRI 3.0T"
            title="Nhập kết quả chụp MRI / CT"
            subtitle="Điền thông tin bệnh nhân và chỉ định, tải ảnh phim lên. Có ảnh rồi thì có thể chạy AI phân tích."
            right={(
              <BannerStats items={[
                { icon: ImgIcon, value: images.length, label: 'Ảnh đã nạp' },
                { icon: ScanIcon, value: imagingType, label: 'Loại chụp' },
                { icon: ListIcon, value: `${doneCount}/${checks.length}`, label: 'Trường bắt buộc' },
              ]} />
            )}
          >
            <View style={L.bannerBtns}>
              <TouchableOpacity style={L.bannerBtn} onPress={handleSaveResult} disabled={loading} dataSet={{ hover: 'glow' }}>
                {loading ? <ActivityIndicator size="small" color="#082F49" /> : <UploadCloud size={16} color="#082F49" />}
                <Text style={L.bannerBtnText}>{loading ? 'Đang lưu…' : 'Lưu và đăng kết quả'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={L.bannerGhost} onPress={handleCancel}>
                <X size={15} color="#FFFFFF" />
                <Text style={L.bannerGhostText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </StaffBanner>

          <View style={[L.columns, isWide && L.columnsWide]}>
            {/* ── Cột trái: biểu mẫu ── */}
            <View style={[L.mainCol, isWide && { flex: 1.55 }]}>
              <SectionCard no="I" title="Thông tin hành chính bệnh nhân" hint="Tự điền khi mở từ hàng đợi phòng chụp">
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

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Địa chỉ</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập địa chỉ bệnh nhân"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </SectionCard>

              <SectionCard no="II" title="Chỉ định lâm sàng & kỹ thuật">
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

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
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
              </SectionCard>

              <SectionCard no="III" title="Nội dung mô tả & kết luận" hint="Có thể điền tự động từ kết quả phân tích AI">
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

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
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
              </SectionCard>
            </View>

            {/* ── Cột phải: ảnh phim, công cụ, kiểm tra ── */}
            <View style={[L.sideCol, isWide && { flex: 1 }]}>
              <SectionCard no="IV" title="Ảnh phim chụp" hint={`${images.length}/10 ảnh · PNG, JPG, DICOM, NIfTI, ZIP`}>
                <TouchableOpacity style={[L.drop, uploading && { opacity: 0.6 }]} onPress={handlePickImages} disabled={uploading} dataSet={{ hover: 'tint' }}>
                  {uploading ? (
                    <ActivityIndicator size="large" color="#0369A1" />
                  ) : (
                    <>
                      <View style={L.dropIcon}><Upload size={24} color="#0369A1" /></View>
                      <Text style={L.dropTitle}>Bấm để tải ảnh phim lên</Text>
                      <Text style={L.dropHint}>Chọn nhiều tệp cùng lúc, tối đa 10 ảnh</Text>
                    </>
                  )}
                </TouchableOpacity>
                {images.length > 0 && (
                  <View style={L.thumbGrid}>
                    {images.map((img, idx) => {
                      const fullUri = img.startsWith('http') ? img : `${Config.API_URL}${img}`;
                      return (
                        <View key={idx} style={L.thumb}>
                          <Image source={{ uri: fullUri }} style={L.thumbImg} resizeMode="cover" />
                          <TouchableOpacity style={styles.removeBadge} onPress={() => handleRemoveImage(idx)}>
                            <X size={12} color="#B91C1C" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </SectionCard>

              <View style={L.toolCard}>
                <Text style={L.toolTitle}>Công cụ hỗ trợ</Text>
                <TouchableOpacity style={L.toolBtn} onPress={handleOcrFill} dataSet={{ hover: 'tint' }}>
                  <View style={[L.toolIcon, { backgroundColor: 'rgba(111,221,178,0.16)' }]}><Zap size={16} color="#6FDDB2" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={L.toolBtnTitle}>Điền thử bằng OCR</Text>
                    <Text style={L.toolBtnHint}>Giả lập trích xuất từ phiếu scan</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[L.toolBtn, images.length === 0 && { opacity: 0.5 }]} onPress={handleAiAnalysis} disabled={images.length === 0} dataSet={{ hover: 'tint' }}>
                  <View style={[L.toolIcon, { backgroundColor: 'rgba(165,180,252,0.18)' }]}><Brain size={16} color="#A5B4FC" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={L.toolBtnTitle}>{images.length === 0 ? 'Phân tích AI' : 'Mở phân tích AI'}</Text>
                    <Text style={L.toolBtnHint}>{images.length === 0 ? 'Cần tải ít nhất 1 ảnh trước' : `Dùng ảnh đầu tiên trong ${images.length} ảnh`}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Kết quả AI trả về (sau khi bác sĩ xác nhận từ AIAnalysisScreen) */}
              {aiResult && (
                <View style={[L.aiBox, { borderColor: aiResult.isWrong ? '#FCA5A5' : '#6EE7B7' }]}>
                  <View style={{ backgroundColor: aiResult.isWrong ? '#B91C1C' : Colors.brandGreen, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {aiResult.isWrong ? <Edit3 size={15} color="#fff" /> : <CheckCircle2 size={15} color="#fff" />}
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                      {aiResult.isWrong ? 'AI đã được điều chỉnh bởi bác sĩ' : 'Kết quả AI đã được bác sĩ xác nhận'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: aiResult.isWrong ? '#FEF2F2' : '#ECFDF5', padding: 14 }}>
                    <Text style={{ fontSize: 13, color: '#1E293B', marginBottom: 4 }}>
                      Loại khối u: <Text style={{ fontWeight: 'bold', color: aiResult.isWrong ? '#B91C1C' : Colors.brandGreen }}>{aiResult.class_name?.toUpperCase()}</Text>
                      {aiResult.isWrong && aiResult.originalClass && (
                        <Text style={{ color: '#9CA3AF', fontSize: 12 }}> (AI gốc: {aiResult.originalClass?.toUpperCase()})</Text>
                      )}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#1E293B' }}>Độ tự tin AI: <Text style={{ fontWeight: 'bold' }}>{aiResult.confidence}%</Text></Text>
                    {aiResult.isWrong && (
                      <View style={{ marginTop: 10, backgroundColor: '#FEE2E2', borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: '#B91C1C' }}>
                        <Text style={{ fontSize: 11, color: '#991B1B', lineHeight: 17 }}>{aiResult.warningNote}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#6366F1', borderRadius: 999, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={handleAiAnalysis}
                    >
                      <RotateCw size={13} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Quét AI lại</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={L.checkCard}>
                <View style={L.checkHead}>
                  <Text style={L.checkTitle}>Kiểm tra trước khi lưu</Text>
                  <Text style={[L.checkCount, doneCount === checks.length && { color: '#0F9D6B' }]}>{doneCount}/{checks.length}</Text>
                </View>
                <View style={L.progress}><View style={[L.progressFill, { width: `${(doneCount / checks.length) * 100}%` }]} /></View>
                {checks.map((c) => (
                  <View key={c.key} style={L.checkRow}>
                    {c.ok ? <CheckCircle2 size={15} color="#0F9D6B" /> : <View style={L.checkDot} />}
                    <Text style={[L.checkLabel, c.ok && { color: '#64748B' }]}>{c.label}</Text>
                  </View>
                ))}
                <TouchableOpacity style={[L.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSaveResult} disabled={loading} dataSet={{ hover: 'glow' }}>
                  {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <UploadCloud size={16} color="#FFFFFF" />}
                  <Text style={L.saveBtnText}>{loading ? 'Đang lưu…' : 'Lưu và đăng kết quả'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const isWebL = Platform.OS === 'web';
const shadowL = isWebL ? { boxShadow: '0 10px 30px -18px rgba(8,47,73,0.35)' } : { elevation: 2 };
const L = StyleSheet.create({
  page: { padding: 28, paddingBottom: 56, maxWidth: 1360, width: '100%', alignSelf: 'center', gap: 20 },
  bannerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  bannerBtnText: { color: '#082F49', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { gap: 18 },
  sideCol: { gap: 18 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#E2E8F0', ...shadowL },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  cardNo: { minWidth: 34, height: 34, borderRadius: 10, paddingHorizontal: 8, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  cardNoText: { color: '#0369A1', fontWeight: '900', fontSize: 13 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardHint: { fontSize: 12, color: '#64748B', marginTop: 2 },

  drop: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 28, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#7DD3FC', backgroundColor: '#F0F9FF' },
  dropIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dropTitle: { fontSize: 14, fontWeight: '800', color: '#0369A1' },
  dropHint: { fontSize: 12, color: '#64748B' },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  thumb: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#E2E8F0' },
  thumbImg: { width: '100%', height: '100%' },

  toolCard: { backgroundColor: '#082F49', borderRadius: 20, padding: 20, gap: 10, ...shadowL },
  toolTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  toolIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toolBtnTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  toolBtnHint: { color: '#94A3B8', fontSize: 12, marginTop: 2 },

  aiBox: { borderRadius: 16, overflow: 'hidden', borderWidth: 1.5 },

  checkCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 10, borderWidth: 1, borderColor: '#E2E8F0', ...shadowL },
  checkHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  checkCount: { fontSize: 15, fontWeight: '800', color: '#D97706', fontVariant: ['tabular-nums'] },
  progress: { height: 8, borderRadius: 4, backgroundColor: '#EEF2F7', overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#0F9D6B' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#F59E0B' },
  checkLabel: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, height: 46, borderRadius: 999, backgroundColor: '#0369A1' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});

export default CreateImagingResultScreen;
