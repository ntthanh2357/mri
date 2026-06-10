import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';

const PremiumScreen = ({ navigation }) => {
  const [openFaq, setOpenFaq] = useState(null);

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

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleUpgrade = () => {
    Alert.alert('Thành toán', 'Đang chuyển hướng bạn đến cổng thanh toán VNPAY/MOMO để nâng cấp Premium (99.000đ/năm)...');
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

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GÓI HỘI VIÊN</Text>
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

            <TouchableOpacity style={styles.freeBtn} disabled>
              <Text style={styles.freeBtnText}>Đang sử dụng</Text>
            </TouchableOpacity>
          </View>

          {/* Premium Plan Card */}
          <View style={styles.planCardPremium}>
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>PHỔ BIẾN NHẤT</Text>
            </View>
            <Text style={styles.planNamePremium}>Gói Premium</Text>
            <Text style={styles.planDescPremium}>Giải pháp toàn diện cho sức khỏe thần kinh</Text>
            <View style={styles.priceRow}>
              <Text style={styles.planPricePremium}>99.000đ</Text>
              <Text style={styles.planPeriodPremium}>/năm</Text>
            </View>

            <View style={styles.featuresList}>
              {premiumFeatures.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <Text style={styles.featureIconPremium}>✓</Text>
                  <Text style={styles.featureTextPremium}>{f.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.premiumBtn} onPress={handleUpgrade}>
              <Text style={styles.premiumBtnText}>Nâng cấp ngay</Text>
            </TouchableOpacity>
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
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

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
