import { StyleSheet, Platform, Dimensions } from 'react-native';
import Colors from '../constants/colors';

export default StyleSheet.create({
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
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#004080',
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
    backgroundColor: '#004080',
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

  // SPLIT SCREEN DESKTOP & MOBILE WRAPPERS
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  leftColumn: {
    flex: 1.1,
    position: 'relative',
    overflow: 'hidden', // ảnh hero phóng to (Ken Burns) không tràn sang cột form
    padding: 48,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        height: '100vh',
      }
    }),
  },
  leftColumnBg: {
    backgroundColor: Colors.brandNavy, // màu nền khi ảnh chưa tải xong
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  leftColumnContent: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  brandContainerWhite: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircleWhite: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoInnerGreen: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#004080',
  },
  logoImage: {
    width: 57,
    height: 57,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
      }
    }),
  },
  brandNameWhite: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandNameAccentOnDark: {
    color: Colors.brandGreenOnDark, // "Scan" — khớp wordmark logo, bản trên nền tối
  },
  brandSubWhite: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.brandMint,
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBottom: {
    gap: 32,
  },
  sloganContainer: {
    maxWidth: 520,
  },
  sloganAccent: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brandGreenOnDark,
    marginBottom: 20,
  },
  sloganTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sloganTitleAccent: {
    color: Colors.brandMint,
  },
  sloganSub: {
    fontSize: 17,
    color: '#E2E8F0',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featureList: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(164, 251, 229, 0.10)', // brandMint mờ
    borderWidth: 1,
    borderColor: 'rgba(164, 251, 229, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F1F5F9',
    lineHeight: 20,
    flex: 1,
  },
  // Cột phải: nền xanh nhạt của hệ thống + lưới chấm mờ + quầng màu (FloatingOrb trong JSX)
  rightColumn: {
    flex: 0.9,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F3F7FC',
    ...Platform.select({
      web: {
        height: '100vh',
        boxShadow: 'inset 14px 0 28px -22px rgba(11, 42, 85, 0.45)', // mép tiếp giáp cột ảnh có chiều sâu
      }
    }),
  },
  // Nút "Về trang chủ" — góc trên phải cột form (máy tính)
  homeButton: {
    position: 'absolute',
    top: 24,
    right: 28,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { cursor: 'pointer', boxShadow: '0 8px 20px -12px rgba(11, 42, 85, 0.35)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' },
    }),
  },
  homeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandNavy,
  },
  rightDots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...Platform.select({
      web: {
        backgroundImage: 'radial-gradient(rgba(11, 42, 85, 0.10) 1px, transparent 1.4px)',
        backgroundSize: '22px 22px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, #000 35%, transparent 100%)',
      }
    }),
  },
  rightScroll: {
    flex: 1,
    width: '100%',
  },
  rightScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 76, // chừa chỗ cho nút 'Về trang chủ' ở góc trên phải
    paddingBottom: 24,
  },
  mobileScrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F3F7FC',
    paddingBottom: 40,
  },
  // Hero điện thoại: ảnh máy MRI, đáy ảnh phủ navy sẵn để đặt logo + slogan
  mobileHero: {
    height: 260,
    overflow: 'hidden',
    backgroundColor: Colors.brandNavy,
    justifyContent: 'flex-end',
  },
  mobileHeroContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 14,
  },
  mobileHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  mobileFormContainer: {
    paddingHorizontal: 16,
    width: '100%',
    marginTop: -28, // thẻ đăng nhập đè nhẹ lên mép ảnh hero
  },

  // ===== THẺ ĐĂNG NHẬP (navy + xanh bạc hà như các trang đã làm mới) =====
  authStack: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  authCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(11, 42, 85, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#0B2A55',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.16,
        shadowRadius: 32,
      },
      android: {
        elevation: 10,
      },
      web: {
        overflow: 'hidden',
        boxShadow: '0 40px 80px -40px rgba(11, 42, 85, 0.50), 0 18px 36px -24px rgba(11, 42, 85, 0.25)',
      }
    }),
  },
  authForm: {
    width: '100%',
  },

  // Đầu thẻ
  cardHeader: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 22,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
  },
  cardHeaderDark: {
    backgroundColor: Colors.brandNavy,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #071E3D 0%, #0B2A55 50%, #0E4A6B 100%)',
      }
    }),
  },
  cardHeaderLight: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 4,
  },
  cardHeaderCompact: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  cardHeaderGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -150,
    right: -70,
    backgroundColor: 'rgba(111, 221, 178, 0.24)',
    ...Platform.select({
      web: { filter: 'blur(42px)' }
    }),
  },
  // Vòng tròn mảnh gợi hình lát cắt MRI
  cardHeaderRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -64,
    bottom: -120,
    borderWidth: 1,
    borderColor: 'rgba(164, 251, 229, 0.16)',
    ...Platform.select({
      web: { boxShadow: '0 0 0 26px rgba(164, 251, 229, 0.03), 0 0 0 27px rgba(164, 251, 229, 0.10)' }
    }),
  },
  cardTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#0E8A7A',
    ...Platform.select({
      web: { backgroundImage: 'linear-gradient(90deg, #0B2A55 0%, #0E8A7A 55%, #6FDDB2 100%)' }
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E6F7F0',
    borderWidth: 1,
    borderColor: '#CDEBDF',
    marginBottom: 12,
  },
  eyebrowChipDark: {
    backgroundColor: 'rgba(111, 221, 178, 0.12)',
    borderColor: 'rgba(111, 221, 178, 0.30)',
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0E8A7A',
  },
  eyebrowDotDark: {
    backgroundColor: '#6FDDB2',
    ...Platform.select({
      web: { boxShadow: '0 0 0 3px rgba(111, 221, 178, 0.20)' }
    }),
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B6E62',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eyebrowTextDark: {
    color: Colors.brandMint,
  },
  authCardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.brandNavy,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  authCardTitleDark: {
    color: '#FFFFFF',
  },
  authCardSub: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
    marginTop: 6,
  },
  authCardSubDark: {
    color: Colors.onDarkMuted,
  },
  headerMedallion: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandNavy,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(140deg, #0B2A55 0%, #0E8A7A 100%)',
        boxShadow: '0 12px 24px -12px rgba(11, 42, 85, 0.65)',
      }
    }),
  },
  headerMedallionDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(164, 251, 229, 0.28)',
    ...Platform.select({
      web: {
        backgroundImage: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.10), 0 12px 24px -14px rgba(0, 0, 0, 0.55)',
      }
    }),
  },

  // Thân thẻ
  cardBody: {
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 20,
  },
  cardBodyCompact: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  formLabelInline: {
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  forgotPasswordLink: {
    color: '#0B6E62',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 50,
    borderRadius: 14,
    paddingLeft: 16,
    paddingRight: 6,
    backgroundColor: '#F7FAFD',
    borderWidth: 1,
    borderColor: '#DCE4EF',
    marginBottom: 14,
    ...Platform.select({
      web: {
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
      }
    }),
  },
  fieldShellFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0E8A7A',
    ...Platform.select({
      web: { boxShadow: '0 0 0 4px rgba(14, 138, 122, 0.13)' }
    }),
  },
  fieldShellError: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
    ...Platform.select({
      web: { boxShadow: '0 0 0 4px rgba(234, 88, 12, 0.10)' }
    }),
  },
  fieldShellOnTint: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 15,
    color: '#0F172A',
    paddingRight: 10,
    ...Platform.select({
      web: { outlineStyle: 'none' } // vòng focus nằm ở khung ngoài (fieldShellFocused)
    }),
  },
  otpInputFilled: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 6,
    color: Colors.brandNavy,
    ...Platform.select({
      web: { fontFamily: "'JetBrains Mono', monospace" }
    }),
  },
  passwordVisibilityBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -6,
    marginBottom: 12,
  },
  inlineErrorText: {
    flex: 1,
    color: '#C2410C',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Mã OTP kích hoạt (bệnh nhân chưa kích hoạt) — khối nền bạc hà
  activationBox: {
    backgroundColor: '#F0FAF6',
    borderWidth: 1,
    borderColor: '#CDEBDF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 12.5,
    color: '#64748B',
  },
  resendLink: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0B6E62',
  },
  devOtpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#F3C77A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: -4,
    marginBottom: 16,
  },
  devOtpTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#B45309',
    letterSpacing: 0.8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  devOtpText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#92400E',
  },
  devOtpCode: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    ...Platform.select({
      web: { fontFamily: "'JetBrains Mono', monospace" }
    }),
  },

  // Vai trò (chỉ app di động) — dạng viên như tab cổng bệnh nhân
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF3F9',
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
  },
  roleTabActive: {
    backgroundColor: '#0E8A7A',
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
  },

  rememberRow: {
    marginTop: 2,
    marginBottom: 18,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#B8C5D6',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { transition: 'background-color 0.15s ease, border-color 0.15s ease' }
    }),
  },
  checkboxChecked: {
    backgroundColor: '#0E8A7A',
    borderColor: '#0E8A7A',
  },
  rememberText: {
    flex: 1,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 1,
  },

  // Nút chính: viên, nền chuyển navy → xanh ngọc (web), rê chuột thì dải màu trượt sang xanh
  formButton: {
    height: 52,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#0E8A7A',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(110deg, #0B2A55 0%, #0D4F6E 45%, #0E8A7A 100%)',
        backgroundSize: '180% 100%',
        backgroundPosition: 'left',
        transition: 'background-position 0.5s ease, box-shadow 0.25s ease',
        cursor: 'pointer',
        boxShadow: '0 16px 30px -16px rgba(11, 42, 85, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
      }
    }),
  },
  formButtonHover: {
    ...Platform.select({
      web: {
        backgroundPosition: 'right',
        boxShadow: '0 20px 36px -16px rgba(14, 138, 122, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
      },
      default: { backgroundColor: '#0B6E62' },
    }),
  },
  buttonFocus: {
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(14, 138, 122, 0.55)',
      },
    }),
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE4EF',
    height: 50,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    ...Platform.select({
      web: {
        transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer',
        boxShadow: '0 6px 14px -10px rgba(11, 42, 85, 0.25)',
      }
    }),
  },
  googleBtnHover: {
    backgroundColor: '#F7FAFD',
    borderColor: '#B8C5D6',
    ...Platform.select({
      web: { boxShadow: '0 10px 20px -12px rgba(11, 42, 85, 0.35)' }
    }),
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 14.5,
    fontWeight: '600',
  },
  formFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formFooterText: {
    fontSize: 13.5,
    color: '#64748B',
  },
  formFooterLink: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0B6E62',
  },

  // Xác thực 2 lớp
  otpSentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FAF6',
    borderWidth: 1,
    borderColor: '#CDEBDF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 18,
  },
  otpSentText: {
    flex: 1,
    fontSize: 12.5,
    color: '#335B57',
    lineHeight: 18,
  },
  otpSentEmail: {
    fontWeight: '800',
    color: Colors.brandNavy,
  },
  resendOtpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  resendOtpText: {
    color: '#0B6E62',
    fontSize: 13,
    fontWeight: '700',
  },
  backButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 2,
  },
  backButtonInlineText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },

  // Dải cam kết bảo mật cuối thẻ
  cardTrust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    backgroundColor: '#F6FAFD',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    borderBottomLeftRadius: 27,
    borderBottomRightRadius: 27,
  },
  cardTrustText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#526179',
    textAlign: 'center',
  },

  // Hỗ trợ dưới thẻ
  supportOutside: {
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  supportChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  supportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportChipText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  supportChipStrong: {
    color: Colors.brandNavy,
    fontWeight: '800',
  },
  footerCopyrightInline: {
    fontSize: 12,
    color: Colors.secondary,
  },

  // ALERT MODAL STYLES
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertIconText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  alertButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
