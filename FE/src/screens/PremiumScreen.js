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
import styles from './PremiumScreen.styles';

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

;

export default PremiumScreen;
