import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import Config from '../constants/config';
import { get } from '../services/api.service';
import styles from './WelcomeScreen.styles';

// Mock Data for the medical portal - Exclusively focused on Brain Cancer and MRI
const servicesData = [
  { id: 1, title: 'Chụp cộng hưởng từ MRI Não', icon: '🧠' },
  { id: 2, title: 'Phân tích & Tầm soát U não AI', icon: '🤖' },
  { id: 3, title: 'Chẩn đoán hình ảnh Ung thư Não', icon: '🔬' },
];

const packagesData = [
  {
    id: 1,
    title: 'Gói tầm soát sớm U não & Ung thư não MRI',
    desc: 'Tầm soát toàn diện các khối u sọ não, dị dạng mạch máu và ung thư não bằng công nghệ chụp cộng hưởng từ MRI kết hợp trợ lý chẩn đoán AI.',
    tag: 'Khuyên dùng',
    image: require('../../assets/nero3.png'),
  }
];

const doctorsData = [
  {
    id: 1,
    name: 'TS.BS. Văn Trung Nghĩa',
    role: 'Trưởng khoa Ung bướu Thần kinh',
    image: null,
  },
  {
    id: 2,
    name: 'ThS.BSNT. Lê Quốc Tuấn',
    role: 'Phó khoa Chẩn đoán hình ảnh MRI',
    image: null,
  },
];

const WelcomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await get('/auth/me');
        if (data && data.user) {
          const destination = data.user.role === 'admin' ? 'AdminBackoffice' : 'Home';
          navigation.replace(destination, { user: data.user });
          return;
        }
      } catch (err) {
        console.log('Welcome auto-login check failed or no token:', err.message);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color="#15803D" />
        <Text style={{ marginTop: 12, color: '#475569', fontSize: 14, fontWeight: '500' }}>
          Đang xác thực phiên làm việc...
        </Text>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.footerLink}>Nội thần kinh & U não</Text>
              <Text style={styles.footerLink}>Chẩn đoán hình ảnh MRI</Text>
              <Text style={styles.footerLink}>Ngoại khoa sọ não</Text>
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

;

export default WelcomeScreen;
