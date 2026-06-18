import React, { useState } from 'react';
import {
  StyleSheet,
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
  const [errors, setErrors] = useState({});

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

  // Auto-fill template docx data based on modality
  const handleAutoFillTemplate = () => {
    if (imagingType === 'MRI') {
      setProcedure('Chụp cộng hưởng từ sọ não (0.2-1.5T) - (Chụp MRI không thuốc)');
      setTechnique('Chụp MRI sọ não lát cắt mỏng qua vùng hố sau và thùy thái dương, dựng hình 3D mạch máu não.');
      setFindings('Phát hiện một cấu trúc dạng khối u chiếm chỗ tại thùy thái dương bên trái, kích thước khoảng 22x24mm. Khối u có ranh giới tương đối rõ, gây phù nề nhẹ nhu mô não xung quanh nhưng chưa đè ép đáng kể đường giữa và não thất bên.');
      setConclusion('Hình ảnh khối u thùy thái dương trái, hướng tới u màng não (Meningioma) lành tính.');
    } else {
      setProcedure('Chụp cắt lớp vi tính sọ não (CT-Scan không thuốc)');
      setTechnique('Chụp cắt lớp vi tính đầu không tiêm chất cản quang với các lát cắt song song với mặt phẳng obito-meatal, bề dày lát cắt 5mm.');
      setFindings('Hình ảnh vùng giảm tỷ trọng nhẹ dạng khối tại thùy thái dương trái, kích thước tương đương 20x22mm. Hệ thống não thất và các bể não chưa thấy bất thường lớn.');
      setConclusion('Hình ảnh giảm tỷ trọng thùy thái dương trái (phù hợp với chẩn đoán u não vùng thái dương đã phát hiện trên MRI).');
    }
    
    // Clear validation errors when template fields are filled
    setErrors(prev => ({
      ...prev,
      procedure: null,
      findings: null,
      conclusion: null,
    }));
  };

  // Helper to pre-fill the 10 mock tumor images we created
  const handleLoadMockImages = () => {
    const mockImages = [
      '/uploads/tumor_01.png',
      '/uploads/tumor_02.png',
      '/uploads/tumor_03.png',
      '/uploads/tumor_04.png',
      '/uploads/tumor_05.png',
      '/uploads/tumor_06.png',
      '/uploads/tumor_07.png',
      '/uploads/tumor_08.png',
      '/uploads/tumor_09.png',
      '/uploads/tumor_10.png'
    ];
    setImages(mockImages);
    showAlert('Thành công', 'Đã nạp 10 đường dẫn ảnh khối u mẫu vào bệnh án.');
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
            <View style={styles.helperRow}>
              <TouchableOpacity style={styles.helperBtn} onPress={handleAutoFillTemplate}>
                <Text style={styles.helperBtnText}>📝 Nạp mẫu theo file .docx</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.helperBtn, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]} onPress={handleLoadMockImages}>
                <Text style={[styles.helperBtnText, { color: '#4F46E5' }]}>🖼️ Nạp 10 ảnh khối u mẫu</Text>
              </TouchableOpacity>
            </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  saveBtnDisabled: {
    backgroundColor: '#86EFAC',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollContainer: {
    padding: 16,
  },
  scrollContainerDesktop: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  formSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  helperRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  helperBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    marginBottom: 16,
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 60,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 6,
  },
  genderBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeGenderBtn: {
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  genderBtnText: {
    fontSize: 13,
    color: '#475569',
  },
  activeGenderBtnText: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTypeBtn: {
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  typeBtnText: {
    fontSize: 14,
    color: '#475569',
  },
  activeTypeBtnText: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  imageCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16A34A',
    height: 40,
    lineHeight: 40,
  },
  uploadAreaContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#000000',
  },
  uploadedThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  removeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  uploadButton: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#15803D',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
  },
  uploadButtonText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: 'bold',
  },
  uploadTipText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default CreateImagingResultScreen;
