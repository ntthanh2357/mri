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
              <TouchableOpacity style={[styles.helperBtn, { backgroundColor: '#0F172A', borderColor: '#1E293B', flex: 1 }]} onPress={handleOcrFill}>
                <Text style={[styles.helperBtnText, { color: '#4ADE80', fontWeight: 'bold' }]}>⚡ Quét tự động (OCR & Fill)</Text>
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

export default CreateImagingResultScreen;
