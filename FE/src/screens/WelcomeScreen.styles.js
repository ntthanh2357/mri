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
  rightColumn: {
    flex: 0.9,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
    ...Platform.select({
      web: {
        height: '100vh',
      }
    }),
  },
  mobileScrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
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
    paddingHorizontal: 20,
    width: '100%',
    marginTop: -28, // thẻ đăng nhập đè nhẹ lên mép ảnh hero
  },

  // INTEGRATED AUTH CARD STYLES
  authCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 40,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.05,
        shadowRadius: 30,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.08), 0 4px 12px -4px rgba(15, 23, 42, 0.04)',
      }
    }),
  },
  authForm: {
    width: '100%',
  },
  authCardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.brandNavy,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  authCardSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  forgotPasswordLink: {
    color: Colors.brandGreen,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    ...Platform.select({
      web: {
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }
    }),
  },
  formInputFocused: {
    borderColor: Colors.brandGreen,
    borderWidth: 2,
    ...Platform.select({
      web: {
        outlineStyle: 'none', // react-native-web không nhận shorthand `outline`; vòng focus thay bằng boxShadow bên dưới
        boxShadow: '0 0 0 3px rgba(6, 122, 94, 0.18)',
      }
    }),
  },
  passwordInputContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordVisibilityBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordVisibilityText: {
    fontSize: 16,
    color: '#64748B',
  },
  formInputError: {
    borderColor: '#C2410C',
    backgroundColor: '#FFF7ED',
  },
  inlineErrorText: {
    color: '#C2410C',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
    fontWeight: '500',
  },
  roleTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
      }
    }),
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: Colors.brandGreen,
  },
  rememberRow: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
  formButton: {
    backgroundColor: Colors.brandGreen,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
        boxShadow: '0 8px 16px -6px rgba(6, 122, 94, 0.40)',
      }
    }),
  },
  formButtonHover: {
    backgroundColor: Colors.brandGreenPressed,
  },
  buttonFocus: {
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 5px rgba(6, 122, 94, 0.55)',
      },
    }),
  },
  formButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        cursor: 'pointer',
      }
    }),
  },
  googleBtnHover: {
    backgroundColor: '#F8FAFC',
    borderColor: '#94A3B8',
  },
  googleBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  formFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formFooterText: {
    fontSize: 13,
    color: '#64748B',
  },
  formFooterLink: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.brandGreen,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendLink: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.brandGreen,
  },
  backButtonInline: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonInlineText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  twoFactorEmailHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
  },
  resendOtpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 4,
  },
  resendOtpText: {
    color: Colors.brandGreen,
    fontSize: 12.5,
    fontWeight: '600',
  },
  formSeparator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 28,
    width: '100%',
  },
  supportContainerInline: {
    alignItems: 'center',
    gap: 6,
  },
  supportTextInline: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  supportLink: {
    fontWeight: 'bold',
    color: Colors.brandGreen,
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
