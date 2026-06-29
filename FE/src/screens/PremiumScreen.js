import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './PremiumScreen.styles';
import { get, post } from '../services/api.service';

const PremiumScreen = ({ navigation }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: 'confirm', // 'confirm' | 'alert'
    severity: 'info', // 'success' | 'error' | 'info' | 'warning'
    title: '',
    message: '',
    onConfirm: null,
    onClose: null,
  });

  const showConfirm = (title, message, onConfirm) => {
    setPopup({
      visible: true,
      type: 'confirm',
      severity: 'warning',
      title,
      message,
      onConfirm,
    });
  };

  const showAlertPopup = (severity, title, message, onClose = null) => {
    setPopup({
      visible: true,
      type: 'alert',
      severity,
      title,
      message,
      onClose,
    });
  };

  const freeFeatures = [
    { text: 'Lưu trữ hồ sơ 30 ngày', included: true },
    { text: 'Phân tích AI cơ bản', included: true },
    { text: 'Không có hỗ trợ 24/7', included: false },
  ];

  const premiumFeatures = [
    { text: 'Lưu trữ vĩnh viễn' },
    { text: 'AI chuyên sâu & Lịch sử' },
    { text: 'Chat AI Trợ lý 24/7' },
    { text: 'Ưu tiên từ bác sĩ' },
    { text: 'Báo cáo PDF chuyên sâu' },
    { text: 'Cảnh báo sớm rủi ro' },
  ];

  const faqs = [
    {
      q: 'Tôi có thể hủy gói Premium bất cứ lúc nào không?',
      a: 'Có, bạn có thể hủy gói Premium bất cứ lúc nào. Sau khi hủy, bạn vẫn được sử dụng dịch vụ đến hết chu kỳ đã thanh toán.',
    },
    {
      q: 'Phân tích AI chuyên sâu khác gì với phân tích cơ bản?',
      a: 'Phân tích AI chuyên sâu sử dụng mô hình v4.2 với độ chính xác 98%+, phân tích đa chiều và so sánh với 1.2 triệu ca lâm sàng tương tự.',
    },
  ];

  const fetchProfile = async () => {
    try {
      const data = await get('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Fetch profile in PremiumScreen error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let intervalId = null;
    if (user && user.isPremium) {
      intervalId = setInterval(async () => {
        try {
          const data = await get('/auth/me');
          // Nếu trước đó là premium mà giờ get profile về không còn premium (hết hạn)
          if (data && data.user && !data.user.isPremium) {
            clearInterval(intervalId);
            setUser(data.user);

            showConfirm(
              'Gói đã hết hạn',
              'Gói Premium của bạn đã hết hạn. Bạn có muốn gia hạn gói mới không?',
              () => {
                handleUpgrade();
              }
            );
          } else if (data && data.user) {
            setUser(data.user);
          }
        } catch (err) {
          console.error('Expiration check error:', err);
        }
      }, 3000); // Check every 3 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      const res = await post('/api/v1/invoices/premium-payment');
      if (res && res.checkoutUrl) {
        if (Platform.OS === 'web') {
          // Trên môi trường Web, chuyển hướng trực tiếp tab hiện tại để tránh bị popup blocker của trình duyệt chặn
          window.location.href = res.checkoutUrl;
        } else {
          // Trên môi trường giả lập/thiết bị di động thật, dùng Linking
          await Linking.openURL(res.checkoutUrl);
          showAlertPopup(
            'info',
            'Thanh toán',
            'Hệ thống đã mở trang thanh toán PayOS. Sau khi thanh toán thành công, trạng thái hội viên của bạn sẽ tự động được kích hoạt.'
          );
        }
      } else {
        showAlertPopup('error', 'Lỗi', 'Không nhận được link thanh toán từ cổng PayOS.');
      }
    } catch (err) {
      showAlertPopup('error', 'Lỗi', err.message || 'Không thể khởi tạo giao dịch thanh toán Premium.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelRenew = () => {
    showConfirm(
      'Xác nhận hủy gia hạn',
      'Bạn có chắc chắn muốn hủy tự động gia hạn cho Gói Premium không? Bạn vẫn sẽ giữ đầy đủ quyền lợi Premium cho đến khi gói hết hạn.',
      async () => {
        setProcessing(true);
        try {
          await post('/auth/premium/cancel-renew');
          showAlertPopup('success', 'Thành công', 'Đã hủy tự động gia hạn thành công.');
          fetchProfile();
        } catch (err) {
          showAlertPopup('error', 'Lỗi', err.message || 'Không thể hủy tự động gia hạn.');
        } finally {
          setProcessing(false);
        }
      }
    );
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="Premium"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hội viên Premium</Text>
          </View>
        )}

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <ActivityIndicator size="large" color="#166534" />
            <Text style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>Đang tải thông tin gói...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Banner Section */}
            <View style={styles.bannerContainer}>
              <View style={[styles.badge, user?.isPremium && { backgroundColor: '#BBF7D0' }]}>
                <Text style={[styles.badgeText, user?.isPremium && { color: '#166534' }]}>
                  {user?.isPremium ? 'GÓI PREMIUM' : 'GÓI HỘI VIÊN'}
                </Text>
              </View>
              <Text style={styles.title}>Nâng cấp trải nghiệm chăm sóc sức khỏe với Premium</Text>
              <Text style={styles.subtitle}>
                Tiếp cận các công cụ phân tích não bộ tiên tiến nhất, lưu trữ không giới hạn và sự hỗ trợ ưu tiên từ các chuyên gia hàng đầu.
              </Text>
            </View>

            {/* Pricing Cards */}
            <View style={styles.plansContainer}>
              {/* Free Plan Card */}
              <View style={styles.planCardFree}>
                <Text style={styles.planNameFree}>Gói Cơ bản</Text>
                <Text style={styles.planDescFree}>Dành cho theo dõi sức khỏe cơ bản</Text>
                <Text style={styles.planPriceFree}>Miễn phí</Text>

                <View style={styles.featuresList}>
                  {freeFeatures.map((f, i) => (
                    <View key={i} style={styles.featureItem}>
                      <Text style={[styles.featureIcon, !f.included && styles.featureIconDisabled]}>
                        {f.included ? '✓' : '✗'}
                      </Text>
                      <Text style={[styles.featureText, !f.included && styles.featureTextDisabled]}>
                        {f.text}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.freeBtn}
                  disabled={true}
                >
                  <Text style={styles.freeBtnText}>
                    {user?.isPremium ? 'Sử dụng Gói Cơ bản' : 'Đang sử dụng'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Premium Plan Card */}
              <View style={styles.planCardPremium}>
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>PHỔ BIẾN NHẤT</Text>
                </View>
                <Text style={styles.planNamePremium}>Gói Premium</Text>
                <Text style={styles.planDescPremium}>Gói thử nghiệm Premium 1 phút để test tính năng gia hạn</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPricePremium}>2.000đ</Text>
                  <Text style={styles.planPeriodPremium}>/phút (Gói test)</Text>
                </View>

                <View style={styles.featuresList}>
                  {premiumFeatures.map((f, i) => (
                    <View key={i} style={styles.featureItem}>
                      <Text style={styles.featureIconPremium}>✓</Text>
                      <Text style={styles.featureTextPremium}>{f.text}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.premiumBtn, user?.isPremium && { backgroundColor: '#22C55E' }]}
                  onPress={user?.isPremium ? null : handleUpgrade}
                  disabled={user?.isPremium || processing}
                >
                  <Text style={[styles.premiumBtnText, user?.isPremium && { color: '#FFFFFF' }]}>
                    {processing ? 'Đang xử lý...' : user?.isPremium ? '✓ Đang sử dụng' : 'Nâng cấp ngay'}
                  </Text>
                </TouchableOpacity>

                {user?.isPremium && user?.autoRenew && (
                  <TouchableOpacity
                    style={[styles.cancelRenewBtn, { marginTop: 12 }]}
                    onPress={handleCancelRenew}
                    disabled={processing}
                  >
                    <Text style={styles.cancelRenewBtnText}>Hủy tự động gia hạn</Text>
                  </TouchableOpacity>
                )}

                {user?.isPremium && !user?.autoRenew && (
                  <Text style={styles.expireNoticeText}>
                    Gói sẽ hết hiệu lực lúc: {formatTime(user?.premiumUntil)} (Đã hủy gia hạn)
                  </Text>
                )}
              </View>
            </View>

            {/* Trust Badges */}
            <View style={styles.trustContainer}>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>🛡️</Text>
                <Text style={styles.trustText}>BẢO MẬT DỮ LIỆU</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>📋</Text>
                <Text style={styles.trustText}>CHỨNG NHẬN Y KHOA</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustIcon}>⚡</Text>
                <Text style={styles.trustText}>KẾT QUẢ TỨC THÌ</Text>
              </View>
            </View>

            {/* FAQs */}
            <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
            <View style={styles.faqList}>
              {faqs.map((faq, i) => {
                const isOpened = openFaq === i;
                return (
                  <View key={i} style={styles.faqCard}>
                    <TouchableOpacity style={styles.faqQuestionRow} onPress={() => toggleFaq(i)}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Text style={styles.faqArrow}>{isOpened ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isOpened && (
                      <View style={styles.faqAnswerContainer}>
                        <Text style={styles.faqAnswer}>{faq.a}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Custom Popup Modal */}
        <Modal visible={popup.visible} transparent animationType="fade">
          <View style={styles.popupOverlay}>
            <View style={styles.popupCard}>
              <View style={[
                styles.popupIconCircle,
                popup.severity === 'success' && { backgroundColor: '#F0FDF4' },
                popup.severity === 'error' && { backgroundColor: '#FEF2F2' },
                popup.severity === 'warning' && { backgroundColor: '#FFFBEB' },
                popup.severity === 'info' && { backgroundColor: '#EFF6FF' },
              ]}>
                {popup.severity === 'success' && <Text style={[styles.popupIconText, { color: '#16A34A' }]}>✓</Text>}
                {popup.severity === 'error' && <Text style={[styles.popupIconText, { color: '#DC2626' }]}>✕</Text>}
                {popup.severity === 'warning' && <Text style={[styles.popupIconText, { color: '#D97706' }]}>⚠️</Text>}
                {popup.severity === 'info' && <Text style={[styles.popupIconText, { color: '#2563EB' }]}>ℹ</Text>}
              </View>
              <Text style={styles.popupTitle}>{popup.title}</Text>
              <Text style={styles.popupMessage}>{popup.message}</Text>

              {popup.type === 'confirm' ? (
                <View style={styles.popupButtonsRow}>
                  <TouchableOpacity
                    style={[styles.popupButton, styles.popupCancelButton]}
                    onPress={() => setPopup(prev => ({ ...prev, visible: false }))}
                  >
                    <Text style={styles.popupCancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.popupButton,
                      popup.severity === 'warning' ? { backgroundColor: '#D97706' } : { backgroundColor: '#15803D' }
                    ]}
                    onPress={() => {
                      setPopup(prev => ({ ...prev, visible: false }));
                      if (popup.onConfirm) popup.onConfirm();
                    }}
                  >
                    <Text style={styles.popupButtonText}>Đồng ý</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.popupSingleButton,
                    popup.severity === 'success' && { backgroundColor: '#15803D' },
                    popup.severity === 'error' && { backgroundColor: '#DC2626' },
                    popup.severity === 'info' && { backgroundColor: '#2563EB' },
                  ]}
                  onPress={() => {
                    setPopup(prev => ({ ...prev, visible: false }));
                    if (popup.onClose) popup.onClose();
                  }}
                >
                  <Text style={styles.popupButtonText}>Tiếp tục</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    paddingVertical: 20,
  },
  bannerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 24,
  },
  planCardFree: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 20,
  },
  planNameFree: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  planDescFree: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  planPriceFree: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 16,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: 'bold',
  },
  featureIconDisabled: {
    color: '#CBD5E1',
  },
  featureText: {
    fontSize: 13,
    color: '#334155',
  },
  featureTextDisabled: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  freeBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  freeBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  planCardPremium: {
    backgroundColor: '#166534',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  planNamePremium: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  planDescPremium: {
    fontSize: 11,
    color: '#BBF7D0',
    marginTop: 2,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPricePremium: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  planPeriodPremium: {
    fontSize: 13,
    color: '#BBF7D0',
    marginLeft: 4,
  },
  featureIconPremium: {
    fontSize: 14,
    color: '#86EFAC',
    fontWeight: 'bold',
  },
  featureTextPremium: {
    fontSize: 13,
    color: '#F0FDF4',
  },
  premiumBtn: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBtnText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelRenewBtn: {
    height: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRenewBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expireNoticeText: {
    color: '#BBF7D0',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  popupIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  popupIconText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  popupMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  popupButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  popupButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupCancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  popupCancelButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  popupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  popupSingleButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trustIcon: {
    fontSize: 16,
  },
  trustText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94A3B8',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  faqList: {
    gap: 10,
    marginBottom: 20,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    paddingRight: 10,
  },
  faqArrow: {
    fontSize: 10,
    color: '#94A3B8',
  },
  faqAnswerContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});

export default PremiumScreen;
