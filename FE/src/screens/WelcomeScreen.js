import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Image,
  Platform,
  Alert,
} from 'react-native';
import Config from '../constants/config';

// Mock Data for the medical portal
const servicesData = [
  { id: 1, title: 'Chăm sóc ngoại trú', icon: '🏥' },
  { id: 2, title: 'Chăm sóc nội trú', icon: '🛌' },
  { id: 3, title: 'Xét nghiệm chẩn đoán', icon: '🔬' },
  { id: 4, title: 'Khám sức khỏe tổng quát', icon: '🩺' },
  { id: 5, title: 'Dịch vụ cấp cứu 24/7', icon: '🚑' },
  { id: 6, title: 'Dịch vụ Bảo hiểm Y tế', icon: '🛡️' },
  { id: 7, title: 'Chăm sóc tại nhà', icon: '🏠' },
];

const packagesData = [
  {
    id: 1,
    title: 'Gói khám Thần kinh - Tiết niệu',
    desc: 'Tầm soát chuyên sâu hệ thần kinh và hệ bài tiết bằng hệ thống chụp chiếu hiện đại.',
    tag: 'Bệnh viện NeuroScan',
    image: require('../../assets/nero3.png'),
  },
  {
    id: 2,
    title: 'Gói khám Phổi - Lồng ngực',
    desc: 'Phát hiện sớm các bệnh lý hô hấp, tổn thương nhu mô phổi bằng AI hỗ trợ.',
    tag: 'Bệnh viện NeuroScan',
    image: require('../../assets/nero4.png'),
  },
  {
    id: 3,
    title: 'Gói khám Ung thư Vú - Phụ khoa',
    desc: 'Khám và tầm soát sớm các bệnh lý ung thư phụ khoa phổ biến ở phụ nữ.',
    tag: 'Bệnh viện NeuroScan',
    image: require('../../assets/nero.png'),
  },
  {
    id: 4,
    title: 'Gói khám Gan - Mật - Tụy',
    desc: 'Siêu âm và xét nghiệm sinh hóa hỗ trợ chẩn đoán chính xác chức năng gan mật.',
    tag: 'Bệnh viện NeuroScan',
    image: require('../../assets/nero2.png'),
  },
];

const doctorsData = [
  {
    id: 1,
    name: 'BS.CKII. Nguyễn Hoàng Nam',
    role: 'Giám đốc Điều hành',
    image: null, // Placeholder to be added by user
  },
  {
    id: 2,
    name: 'ThS.BS. Trần Minh Nghĩa',
    role: 'Phó Giám đốc Chuyên môn',
    image: null,
  },
  {
    id: 3,
    name: 'TS.BS. Văn Trung Nghĩa',
    role: 'Trưởng khoa Cấp cứu & Thần kinh',
    image: null,
  },
  {
    id: 4,
    name: 'ThS.BSNT. Lê Quốc Tuấn',
    role: 'Trưởng khoa Hồi sức tích cực',
    image: null,
  },
];

const WelcomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleBooking = () => {
    Alert.alert('Đặt lịch hẹn', 'Tính năng đăng ký khám trực tuyến đang được đồng bộ. Vui lòng đăng nhập hoặc liên hệ hotline.');
  };

  const handleScrollToSection = (sectionName) => {
    Alert.alert('Điều hướng', `Hệ thống đang cuộn tới mục: ${sectionName}`);
    setMobileMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP HEADER (Navigation Bar) */}
      <View style={styles.navbar}>
        <View style={styles.navbarContainer}>
          {/* Logo & Brand */}
          <View style={styles.brandContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.logoInner} />
            </View>
            <View>
              <Text style={styles.brandName}>NeuroScan AI</Text>
              <Text style={styles.brandSub}>ĐỘ CHÍNH XÁC LÂM SÀNG</Text>
            </View>
          </View>

          {/* Desktop Navigation Links */}
          {isDesktop && (
            <View style={styles.navLinks}>
              <TouchableOpacity onPress={() => handleScrollToSection('Trang chủ')}>
                <Text style={styles.navLinkText}>Trang chủ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('Chuyên khoa')}>
                <Text style={styles.navLinkText}>Chuyên khoa</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('Gói khám')}>
                <Text style={styles.navLinkText}>Gói khám</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('Bác sĩ')}>
                <Text style={styles.navLinkText}>Bác sĩ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleScrollToSection('Liên hệ')}>
                <Text style={styles.navLinkText}>Liên hệ</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header Action Buttons */}
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.bookingBtn} onPress={handleBooking}>
              <Text style={styles.bookingBtnText}>Đặt lịch hẹn ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginBtnText}>Đăng nhập</Text>
            </TouchableOpacity>

            {/* Mobile Menu Icon */}
            {!isDesktop && (
              <TouchableOpacity
                style={styles.mobileMenuBtn}
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Text style={styles.menuIconText}>{mobileMenuOpen ? '✕' : '☰'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Mobile Dropdown Navigation Menu */}
        {!isDesktop && mobileMenuOpen && (
          <View style={styles.mobileDropdown}>
            <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleScrollToSection('Trang chủ')}>
              <Text style={styles.mobileNavLinkText}>Trang chủ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleScrollToSection('Chuyên khoa')}>
              <Text style={styles.mobileNavLinkText}>Chuyên khoa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleScrollToSection('Gói khám')}>
              <Text style={styles.mobileNavLinkText}>Gói khám</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleScrollToSection('Bác sĩ')}>
              <Text style={styles.mobileNavLinkText}>Bác sĩ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavLink} onPress={() => handleScrollToSection('Liên hệ')}>
              <Text style={styles.mobileNavLinkText}>Liên hệ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mobileNavLink, { borderBottomWidth: 0, backgroundColor: '#F0FDF4' }]}
              onPress={() => {
                setMobileMenuOpen(false);
                navigation.navigate('Login');
              }}
            >
              <Text style={[styles.mobileNavLinkText, { color: '#15803D', fontWeight: 'bold' }]}>Đăng nhập tài khoản ➔</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={true}>
        
        {/* 2. HERO SECTION */}
        <View style={isDesktop ? styles.heroDesktop : styles.heroMobile}>
          <View style={isDesktop ? styles.heroLeft : styles.heroFullWidth}>
            <Text style={styles.heroPreTitle}>HỆ THỐNG Y TẾ SỐ 1 ĐÀ NẴNG</Text>
            <Text style={styles.heroTitle}>NeuroScan AI{'\n'}Đà Nẵng</Text>
            <Text style={styles.heroDesc}>
              Bệnh viện tiên phong ứng dụng công nghệ trí tuệ nhân tạo (AI) giúp tối ưu hóa chẩn đoán hình ảnh, mang lại giải pháp điều trị chuyên sâu và chuẩn xác nhất cho bệnh nhân.
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.ctaPrimaryText}>Đăng ký ngay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={handleBooking}>
                <Text style={styles.ctaSecondaryText}>Tìm chuyên khoa</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={isDesktop ? styles.heroRight : styles.heroImageContainerMobile}>
            <Image
              source={require('../../assets/nero4.png')}
              style={styles.heroBgImage}
              resizeMode="cover"
            />
            <View style={styles.heroImgOverlay} />
            {isDesktop && (
              <View style={styles.floatingStats}>
                <Text style={styles.floatingStatsVal}>99.8%</Text>
                <Text style={styles.floatingStatsLabel}>Độ chính xác chẩn đoán</Text>
              </View>
            )}
          </View>
        </View>

        {/* 3. FLOATING QUICK ACCESS BAR */}
        <View style={styles.quickAccessWrapper}>
          <View style={[styles.quickAccessBar, isDesktop ? styles.rowBar : styles.colBar]}>
            <TouchableOpacity style={styles.quickAccessItem} onPress={handleBooking}>
              <Text style={styles.quickAccessIcon}>🧬</Text>
              <Text style={styles.quickAccessLabel}>Chuyên khoa</Text>
            </TouchableOpacity>
            <View style={isDesktop ? styles.vDivider : styles.hDivider} />
            <TouchableOpacity style={styles.quickAccessItem} onPress={handleBooking}>
              <Text style={styles.quickAccessIcon}>👨‍⚕️</Text>
              <Text style={styles.quickAccessLabel}>Tìm bác sĩ</Text>
            </TouchableOpacity>
            <View style={isDesktop ? styles.vDivider : styles.hDivider} />
            <TouchableOpacity style={styles.quickAccessItem} onPress={handleBooking}>
              <Text style={styles.quickAccessIcon}>📅</Text>
              <Text style={styles.quickAccessLabel}>Đặt lịch hẹn</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. HOSPITAL INTRODUCTION SECTION */}
        <View style={styles.sectionContainer}>
          <View style={[styles.introRow, isDesktop ? styles.rowLayout : styles.columnLayout]}>
            <View style={styles.introLeftText}>
              <Text style={styles.sectionHeading}>Giới thiệu về NeuroScan AI Đà Nẵng</Text>
              <Text style={styles.introText}>
                Hệ thống Y khoa NeuroScan AI Đà Nẵng được thành lập với mục tiêu kết hợp tinh hoa y học lâm sàng cùng công nghệ số hóa hiện đại. Chúng tôi tự hào là đơn vị y tế tại khu vực miền Trung triển khai đồng bộ trí tuệ nhân tạo trong phân tích kết quả MRI sọ não, tầm soát các bệnh lý mạch máu não, u não và suy giảm nhận thức.
              </Text>
              <Text style={styles.introText}>
                Với không gian phòng khám chuẩn quốc tế, trang thiết bị tối tân cùng đội ngũ y bác sĩ giàu tâm huyết, chúng tôi cam kết mang lại sự an tâm tuyệt đối cho khách hàng trong từng ca chẩn đoán.
              </Text>
            </View>

            {/* Fast Contact Card */}
            <View style={styles.contactCard}>
              <Text style={styles.contactCardTitle}>Thông tin liên hệ</Text>
              <View style={styles.contactCardItem}>
                <Text style={styles.contactCardIcon}>📞</Text>
                <View>
                  <Text style={styles.contactCardLabel}>Hotline cấp cứu:</Text>
                  <Text style={styles.contactCardValue}>0236 3650 676</Text>
                </View>
              </View>
              <View style={styles.contactCardItem}>
                <Text style={styles.contactCardIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactCardLabel}>Địa chỉ bệnh viện:</Text>
                  <Text style={styles.contactCardValue}>291 Nguyễn Văn Linh, Quận Thanh Khê, TP. Đà Nẵng</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 5. SERVICES GRID SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: '#F8FAFC' }]}>
          <Text style={[styles.sectionCenterTitle, { marginTop: 10 }]}>Dịch vụ của chúng tôi</Text>
          <Text style={styles.sectionCenterSub}>Đầy đủ các gói chăm sóc y tế toàn diện chất lượng cao</Text>
          
          <View style={styles.servicesGrid}>
            {servicesData.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceIconCircle}>
                  <Text style={styles.serviceCardIcon}>{service.icon}</Text>
                </View>
                <Text style={styles.serviceCardTitle}>{service.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 6. PROMOTION CHECKUP PACKAGES */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionCenterTitle}>Gói khám ưu đãi</Text>
          <Text style={styles.sectionCenterSub}>Lựa chọn chăm sóc sức khỏe thông minh với dịch vụ chuyên sâu tại NeuroScan</Text>
          
          <View style={[styles.packagesContainer, isDesktop ? styles.rowLayout : styles.columnLayout]}>
            {packagesData.map((pkg) => (
              <View key={pkg.id} style={styles.packageCard}>
                <View style={styles.packageImageContainer}>
                  <Image source={pkg.image} style={styles.packageImage} resizeMode="cover" />
                  <View style={styles.packageTagContainer}>
                    <Text style={styles.packageTagText}>{pkg.tag}</Text>
                  </View>
                </View>
                <View style={styles.packageContent}>
                  <Text style={styles.packageTitle}>{pkg.title}</Text>
                  <Text style={styles.packageDesc} numberOfLines={3}>{pkg.desc}</Text>
                  <TouchableOpacity style={styles.pkgBtn} onPress={handleBooking}>
                    <Text style={styles.pkgBtnText}>Xem chi tiết ➔</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 7. DOCTOR TEAM SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: '#F8FAFC' }]}>
          <Text style={styles.sectionCenterTitle}>Đội ngũ bác sĩ chuyên khoa</Text>
          <Text style={styles.sectionCenterSub}>Tận tâm - Giàu kinh nghiệm - Hết lòng vì sức khỏe người bệnh</Text>
          
          <View style={[styles.doctorsContainer, isDesktop ? styles.rowLayout : styles.columnLayout]}>
            {doctorsData.map((doc) => (
              <View key={doc.id} style={styles.doctorCard}>
                {/* Image Placeholder */}
                <View style={styles.doctorImagePlaceholder}>
                  <Text style={styles.doctorPlaceHolderText}>👨‍⚕️</Text>
                  <Text style={styles.doctorImageLabel}>Ảnh bác sĩ</Text>
                </View>
                <View style={styles.doctorContent}>
                  <Text style={styles.doctorName}>{doc.name}</Text>
                  <Text style={styles.doctorRole}>{doc.role}</Text>
                  <Text style={styles.doctorDesc}>Chuyên khoa sâu về Nội thần kinh, Đột quỵ & Phẫu thuật sọ não.</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 8. FOOTER SECTION */}
        <View style={styles.footer}>
          <View style={[styles.footerContainer, isDesktop ? styles.rowLayout : styles.columnLayout]}>
            {/* Column 1: Intro */}
            <View style={styles.footerCol}>
              <View style={[styles.brandContainer, { paddingBottom: 12 }]}>
                <View style={[styles.logoCircle, { backgroundColor: '#FFFFFF' }]}>
                  <View style={[styles.logoInner, { borderColor: '#15803D' }]} />
                </View>
                <Text style={[styles.brandName, { color: '#FFFFFF' }]}>NeuroScan AI</Text>
              </View>
              <Text style={styles.footerIntroText}>
                Hệ thống y tế thông minh tích hợp trí tuệ nhân tạo, nâng cao chất lượng khám chữa bệnh chuyên khoa Thần kinh hàng đầu tại Việt Nam.
              </Text>
            </View>

            {/* Column 2: Quick Links */}
            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Chuyên khoa</Text>
              <Text style={styles.footerLink}>Cấp cứu & Hồi sức</Text>
              <Text style={styles.footerLink}>Nội thần kinh & Đột quỵ</Text>
              <Text style={styles.footerLink}>Chẩn đoán hình ảnh</Text>
              <Text style={styles.footerLink}>Ngoại thần kinh</Text>
            </View>

            {/* Column 3: Contact */}
            <View style={[styles.footerCol, { flex: 1.2 }]}>
              <Text style={styles.footerColTitle}>Thông tin liên hệ</Text>
              <Text style={styles.footerContactText}>📍 291 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng</Text>
              <Text style={styles.footerContactText}>📞 Hotline: 0236 3650 676</Text>
              <Text style={styles.footerContactText}>✉ Email: contactus.danang@hoanmy.com</Text>
            </View>
          </View>

          <View style={styles.footerBottom}>
            <Text style={styles.footerBottomText}>
              © 2026 NeuroScan AI & Bệnh viện Hoàn Mỹ Đà Nẵng. Bản quyền được bảo lưu.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // NAVBAR STYLES
  navbar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        position: 'sticky',
        top: 0,
      }
    }),
  },
  navbarContainer: {
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  brandName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    lineHeight: 18,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#15803D',
  },
  navLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    paddingVertical: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookingBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bookingBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loginBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mobileMenuBtn: {
    padding: 8,
    marginLeft: 4,
  },
  menuIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
  mobileDropdown: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mobileNavLink: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  mobileNavLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },

  // HERO STYLES
  scrollContainer: {
    alignItems: 'stretch',
  },
  heroDesktop: {
    flexDirection: 'row',
    minHeight: 480,
    backgroundColor: '#F8FAFC',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 40,
    paddingVertical: 40,
  },
  heroMobile: {
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  heroLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  heroFullWidth: {
    width: '100%',
  },
  heroRight: {
    flex: 1.1,
    height: 400,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  heroImageContainerMobile: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBgImage: {
    width: '100%',
    height: '100%',
  },
  heroImgOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(21, 128, 61, 0.15)', // transparent medical green tint
  },
  heroPreTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0284C7',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 52,
    marginBottom: 16,
  },
  heroDesc: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 28,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 16,
  },
  ctaPrimary: {
    backgroundColor: '#15803D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    elevation: 2,
  },
  ctaPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  ctaSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#15803D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  ctaSecondaryText: {
    color: '#15803D',
    fontWeight: 'bold',
    fontSize: 14,
  },
  floatingStats: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  floatingStatsVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803D',
  },
  floatingStatsLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },

  // FLOATING QUICK ACCESS BAR
  quickAccessWrapper: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    marginTop: -30,
    zIndex: 5,
  },
  quickAccessBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  rowBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colBar: {
    flexDirection: 'column',
    gap: 16,
  },
  quickAccessItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quickAccessIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quickAccessLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  vDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  hDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },

  // INTRO & SECTIONS
  sectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 56,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  rowLayout: {
    flexDirection: 'row',
    gap: 32,
  },
  columnLayout: {
    flexDirection: 'column',
    gap: 24,
  },
  introRow: {
    alignItems: 'stretch',
  },
  introLeftText: {
    flex: 1.6,
  },
  sectionHeading: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 20,
  },
  introText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 14,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
  },
  contactCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#DCFCE7',
    paddingBottom: 8,
  },
  contactCardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  contactCardIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  contactCardLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 2,
  },
  contactCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },

  // SERVICES GRID SECTION
  sectionCenterTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionCenterSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  serviceCard: {
    width: '45%',
    maxWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    marginBottom: 8,
  },
  serviceIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceCardIcon: {
    fontSize: 24,
  },
  serviceCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 16,
  },

  // PACKAGES SECTION
  packagesContainer: {
    alignItems: 'stretch',
  },
  packageCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  packageImageContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  packageImage: {
    width: '100%',
    height: '100%',
  },
  packageTagContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#0284C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  packageTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  packageContent: {
    padding: 16,
    flex: 1,
  },
  packageTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 20,
    minHeight: 40,
  },
  packageDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
    flex: 1,
  },
  pkgBtn: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    alignItems: 'flex-start',
  },
  pkgBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // DOCTORS SECTION
  doctorsContainer: {
    alignItems: 'stretch',
  },
  doctorCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  doctorImagePlaceholder: {
    height: 200,
    width: '100%',
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  doctorPlaceHolderText: {
    fontSize: 48,
  },
  doctorImageLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 'bold',
    marginTop: 8,
  },
  doctorContent: {
    padding: 16,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  doctorRole: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 8,
  },
  doctorDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  // FOOTER SECTION
  footer: {
    backgroundColor: '#0F172A',
    paddingTop: 56,
  },
  footerContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  footerCol: {
    flex: 1,
    marginBottom: 28,
  },
  footerIntroText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 20,
    maxWidth: 260,
  },
  footerColTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  footerLink: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
  },
  footerContactText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 18,
  },
  footerBottom: {
    paddingVertical: 24,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  footerBottomText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default WelcomeScreen;
