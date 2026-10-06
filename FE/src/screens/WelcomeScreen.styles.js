import { StyleSheet, Platform, Dimensions } from 'react-native';

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
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A5FD0',
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
  brandNameAccentDark: {
    color: '#0090D0', // "Scan" hai tông như wordmark logo
  },
  brandSub: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1A5FD0',
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
    backgroundColor: '#1A5FD0',
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

  // TRANG ĐĂNG NHẬP RIÊNG (UI refresh)
  authSplit: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  authVisual: {
    flex: 1.05,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0B2A5B',
  },
  authVisualImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  authVisualOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,42,91,0.8)',
  },
  authVisualContent: {
    flex: 1,
    padding: 48,
    justifyContent: 'space-between',
  },
  backHome: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  backHomeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  authBrandSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6FDDB2',
    letterSpacing: 0.8,
  },
  authVisualTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 48,
    fontWeight: '700',
    maxWidth: 520,
    marginTop: 28,
    marginBottom: 24,
  },
  authCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
    maxWidth: 480,
  },
  authCheckText: {
    color: '#DBEAFE',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  authVisualFoot: {
    color: '#93C5FD',
    fontSize: 12,
  },
  authFormCol: {
    flex: 0.95,
    backgroundColor: '#F5F8FC',
  },
  authFormScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
  },
  mobileHero: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0B2A5B',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 84,
    gap: 24,
  },
  mobileFormOverlap: {
    marginTop: -48,
    marginBottom: 32,
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
    padding: 48,
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        height: '100vh',
      }
    }),
  },
  leftColumnBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  leftColumnOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 45, 95, 0.90)', // Deep medical navy overlay (logo NeuroScan)
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
    width: 46,
    height: 46,
    borderRadius: 14,
    marginRight: 14,
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
  brandNameAccentCyan: {
    color: '#00AEEF', // "Scan" — khớp wordmark logo (Neuro navy + Scan cyan)
  },
  brandSubWhite: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#CFF2FF',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sloganContainer: {
    marginVertical: 36,
    maxWidth: 480,
  },
  sloganAccent: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00AEEF',
    marginBottom: 20,
  },
  sloganTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 42,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  sloganSub: {
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 24,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#FFFFFF',
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
  mobileHeader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  mobileFormContainer: {
    paddingHorizontal: 20,
    width: '100%',
  },

  // INTEGRATED AUTH CARD STYLES
  authCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
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
        boxShadow: '0 30px 60px -20px rgba(11, 42, 91, 0.45), 0 12px 24px -12px rgba(11, 42, 91, 0.25)',
      }
    }),
  },
  authForm: {
    width: '100%',
  },
  authCardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#1A5FD0',
    fontSize: 12,
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
        transition: 'all 0.2s ease',
      }
    }),
  },
  formInputFocused: {
    borderColor: '#004080',
    borderWidth: 2,
    ...Platform.select({
      web: {
        outline: 'none',
        boxShadow: '0 0 0 3px rgba(0, 64, 128, 0.15)',
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
    fontSize: 11,
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
    color: '#004080',
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
    backgroundColor: '#1A5FD0',
    borderColor: '#1A5FD0',
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
    backgroundColor: '#1A5FD0',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
        boxShadow: '0 8px 16px -6px rgba(0, 64, 128, 0.45)',
      }
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
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }
    }),
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
    color: '#1A5FD0',
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
    color: '#1A5FD0',
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
    fontSize: 11.5,
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
    color: '#004080',
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
  },
  supportTextInline: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
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
