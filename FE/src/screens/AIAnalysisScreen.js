import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post } from '../services/api.service';
import Config from '../constants/config';

const AIAnalysisScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Profile data
  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Scan & AI state
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields (matching the standard document schema)
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [procedure, setProcedure] = useState('Chụp cộng hưởng từ sọ não (MRI Tự kiểm tra)');
  const [technique, setTechnique] = useState('Dữ liệu phim chụp MRI do bệnh nhân tự tải lên và phân tích qua hệ thống NeuroScan AI.');
  const [radiologist, setRadiologist] = useState('NeuroScan AI (Tự động phân tích)');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await get('/auth/me');
        setUser(res.user);
      } catch (err) {
        console.error('Error fetching profile:', err);
        showAlert('Lỗi', 'Không thể lấy thông tin tài khoản. Vui lòng đăng nhập lại.');
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

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

  const handlePickImage = () => {
    if (Platform.OS !== 'web') {
      showAlert('Hỗ trợ', 'Tính năng chọn tệp hiện chỉ hỗ trợ trên giao diện Web.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setUploading(true);
      try {
        const file = files[0];
        const fileData = await readFileAsBase64(file);
        const response = await post('/api/v1/imaging/upload', {
          fileData,
          fileName: file.name,
          imagingType: 'MRI'
        });

        if (response.success && response.data?.imageUrl) {
          setImages([response.data.imageUrl]);
          setAiResult(null); // Reset AI result for new image
        } else {
          showAlert('Lỗi', `Tải ảnh thất bại: ${response.message || 'Không có phản hồi'}`);
        }
      } catch (err) {
        console.error('Upload error:', err);
        showAlert('Lỗi', 'Không thể tải tệp lên máy chủ.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleAiAnalysis = async () => {
    if (images.length === 0) {
      showAlert('Yêu cầu', 'Vui lòng tải lên ảnh chụp MRI của bạn trước.');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await post('/api/v1/imaging/analyze-ai', { imageUrl: images[0] });

      if (response.success && response.data) {
        const { class_name, confidence, consensus_message } = response.data;
        setAiResult(response.data);

        // Autofill findings and conclusions according to standard form
        setFindings(`Phân tích hình ảnh phát hiện vùng tổn thương bất thường gợi ý u não loại: ${class_name.toUpperCase()}.`);
        setConclusion(
          consensus_message || 
          (class_name === 'notumor'
            ? `Hệ thống AI không phát hiện khối u não bất thường nào (Độ tự tin: ${confidence}%).`
            : `Phát hiện nghi vấn khối u loại ${class_name.toUpperCase()} với độ tin cậy ${confidence}%. Khuyên dùng: Bệnh nhân hãy mang kết quả này đến gặp bác sĩ chuyên khoa để được tư vấn chính xác nhất.`)
        );
        showAlert('Phân tích xong', `AI chẩn đoán gợi ý: ${class_name.toUpperCase()} (Độ tự tin: ${confidence}%).`);
      } else {
        showAlert('Lỗi', response.message || 'Phân tích AI thất bại.');
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      showAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ AI.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelfStore = async () => {
    if (images.length === 0) {
      showAlert('Yêu cầu', 'Vui lòng nạp hình ảnh trước khi lưu trữ.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        medicalId: user?.profile?.medicalId || '26025699',
        patientName: user?.profile?.name || 'Bệnh nhân tự upload',
        birthYear: user?.profile?.birthYear || 1995,
        gender: user?.profile?.gender || 'Nam',
        address: user?.profile?.address || 'Việt Nam',
        orderDate: new Date(),
        orderingDoctor: 'Tự kiểm tra (AI)',
        orderingDepartment: 'NeuroScan AI Portal',
        medicalRecordNumber: `SBA-SELF-${Date.now().toString().slice(-6)}`,
        diagnosis: aiResult ? `Nghi ngờ u ${aiResult.class_name?.toUpperCase()}` : 'Chưa phân tích AI',
        procedure,
        technique,
        findings,
        conclusion,
        radiologist,
        reportDate: new Date(),
        images,
        imagingType: 'MRI'
      };

      const response = await post('/api/v1/imaging', payload);
      if (response.success) {
        showAlert('Thành công', 'Đã lưu trữ kết quả phân tích MRI vào hồ sơ cá nhân của bạn!', () => {
          navigation.navigate('Home');
        });
      } else {
        showAlert('Lỗi', response.message || 'Không thể lưu hồ sơ.');
      }
    } catch (err) {
      console.error('Store error:', err);
      showAlert('Lỗi kết nối', 'Không thể lưu hồ sơ lên máy chủ.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#15803D" />
        <Text style={styles.loadingText}>Đang khởi tạo cổng chẩn đoán...</Text>
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="AIAnalysis" user={user}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Cổng Phân Tích & Tự Lưu Trữ MRI (Dành cho Bệnh nhân)</Text>
            <Text style={styles.subtitle}>
              Tự tải ảnh phim MRI sọ não, phân tích nhanh bằng AI và lưu trữ vào hồ sơ cá nhân theo đúng biểu mẫu y khoa chuẩn.
            </Text>
          </View>

          <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
            {/* Left Column: Image upload & AI visualization */}
            <View style={isDesktop ? styles.leftColumn : styles.fullWidth}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>1. Tải lên & Phân tích phim chụp</Text>
                
                <View style={styles.viewerContainer}>
                  {images.length > 0 ? (
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{ uri: images[0].startsWith('http') ? images[0] : `${Config.API_URL}${images[0]}` }}
                        style={styles.brainImage}
                        resizeMode="contain"
                      />
                      {aiResult && aiResult.class_name !== 'notumor' && (
                        <View style={styles.boundingBox}>
                          <View style={styles.boxTag}>
                            <Text style={styles.boxTagText}>AI_DETECT: {aiResult.confidence}%</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <Text style={styles.placeholderIcon}>📷</Text>
                      <Text style={styles.placeholderText}>Chưa có hình ảnh phim chụp</Text>
                    </View>
                  )}
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnUpload, uploading && styles.btnDisabled]}
                    onPress={handlePickImage}
                    disabled={uploading}
                  >
                    <Text style={styles.btnText}>
                      {uploading ? 'Đang tải ảnh...' : '➕ Chọn ảnh phim MRI'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnAi, (images.length === 0 || analyzing) && styles.btnDisabled]}
                    onPress={handleAiAnalysis}
                    disabled={images.length === 0 || analyzing}
                  >
                    <Text style={styles.btnText}>
                      {analyzing ? 'Đang phân tích...' : '🤖 Chẩn đoán AI'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {aiResult && (
                <View style={[styles.card, styles.aiResultCard]}>
                  <Text style={styles.aiResultHeader}>Kết quả chẩn đoán AI</Text>
                  <Text style={styles.aiResultClass}>
                    Phát hiện u: <Text style={{ color: '#EF4444' }}>{aiResult.class_name?.toUpperCase()}</Text>
                  </Text>
                  <Text style={styles.aiResultConf}>
                    Độ tin cậy: <Text style={{ fontWeight: 'bold' }}>{aiResult.confidence}%</Text>
                  </Text>
                  <Text style={styles.aiDisclaimer}>
                    ⚠️ Lưu ý: Kết quả AI chỉ mang tính chất tham khảo cá nhân, không thay thế cho kết luận của bác sĩ điều trị.
                  </Text>
                </View>
              )}
            </View>

            {/* Right Column: Standard Document Form */}
            <View style={isDesktop ? styles.rightColumn : styles.fullWidth}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>2. Thông tin lưu trữ (Biểu mẫu chuẩn y khoa)</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mã y tế (Medical ID)</Text>
                  <TextInput
                    style={[styles.input, styles.inputReadonly]}
                    value={user?.profile?.medicalId || 'Chưa liên kết'}
                    editable={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Họ tên bệnh nhân</Text>
                  <TextInput
                    style={[styles.input, styles.inputReadonly]}
                    value={user?.profile?.name || 'Chưa cập nhật'}
                    editable={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Dịch vụ chỉ định</Text>
                  <TextInput
                    style={styles.input}
                    value={procedure}
                    onChangeText={setProcedure}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Kỹ thuật thực hiện</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={technique}
                    onChangeText={setTechnique}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mô tả hình ảnh (Findings) *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { height: 80 }]}
                    placeholder="Mô tả các bất thường quan sát thấy..."
                    value={findings}
                    onChangeText={setFindings}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Kết luận chẩn đoán (Conclusion) *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { height: 80 }]}
                    placeholder="Kết luận tổng quan của phim chụp..."
                    value={conclusion}
                    onChangeText={setConclusion}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Người đọc phim / Xác nhận</Text>
                  <TextInput
                    style={styles.input}
                    value={radiologist}
                    onChangeText={setRadiologist}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btnSave, saving && styles.btnDisabled]}
                  onPress={handleSelfStore}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.btnSaveText}>💾 Lưu trữ phim & Báo cáo vào EMR</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontWeight: 'bold',
  },
  scrollContainer: {
    padding: 16,
  },
  headerRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
  },
  mobileColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1.2,
  },
  fullWidth: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  viewerContainer: {
    height: 300,
    backgroundColor: '#090D16',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brainImage: {
    width: '90%',
    height: '90%',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4ADE80',
    width: '42%',
    height: '35%',
    top: '30%',
    left: '29%',
  },
  boxTag: {
    position: 'absolute',
    top: -18,
    left: -2,
    backgroundColor: '#15803D',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 40,
    color: '#475569',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnUpload: {
    backgroundColor: '#0F172A',
  },
  btnAi: {
    backgroundColor: '#2563EB',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  aiResultCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  aiResultHeader: {
    fontWeight: 'bold',
    color: '#1E3A8A',
    fontSize: 14,
    marginBottom: 6,
  },
  aiResultClass: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 2,
    fontWeight: '600',
  },
  aiResultConf: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 8,
  },
  aiDisclaimer: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    color: '#334155',
  },
  inputReadonly: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  textArea: {
    height: 50,
    textAlignVertical: 'top',
    paddingVertical: 6,
  },
  btnSave: {
    backgroundColor: '#15803D',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default AIAnalysisScreen;
