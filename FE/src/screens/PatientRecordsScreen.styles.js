import { StyleSheet, Platform, Dimensions } from 'react-native';
import Colors from '../constants/colors';

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  centerText: { fontSize: 14, color: Colors.secondary, textAlign: 'center' },
  errorIcon: { fontSize: 36 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: Colors.white, fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { paddingVertical: 4, marginRight: 16 },
  backButtonText: { fontSize: 14, color: Colors.secondary, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.slateDark },
  scrollContainer: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },

  pageTitleBlock: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: Colors.slateDark, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: Colors.secondary, lineHeight: 19 },

  // ── Sổ sức khỏe (hero) ──────────────────────────────────────────────────
  passportCard: {
    backgroundColor: Colors.slateDark,
    borderRadius: 18,
    padding: 20,
    marginBottom: 22,
    overflow: 'hidden',
  },
  passportSpine: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
    backgroundColor: Colors.primary,
  },
  passportEyebrow: { fontSize: 11, color: Colors.radiologyMuted, marginBottom: 6, letterSpacing: 0.2 },
  passportName: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  passportDob: { fontSize: 13, color: Colors.radiologyMuted, marginBottom: 16 },
  passportDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 14 },
  passportSummaryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  passportSummaryText: { fontSize: 13, color: '#CBD5E1' },
  passportSummaryStrong: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  passportSummaryDot: { fontSize: 13, color: Colors.radiologyMuted },
  passportEditHint: { fontSize: 12, color: '#7DD3FC', marginTop: 14 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 12, height: 46, marginBottom: 26,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.slateDark },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.slateDark, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: Colors.secondary, marginBottom: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.borderStrong, textAlign: 'center', lineHeight: 20 },

  // ── Timeline ────────────────────────────────────────────────────────────
  timelineContainer: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineBar: { width: 20, alignItems: 'center', paddingTop: 22 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.surface },
  dotInpatient: { backgroundColor: Colors.error },
  dotOutpatient: { backgroundColor: Colors.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: 4 },
  timelineCard: { flex: 1, paddingBottom: 18 },

  visitCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  visitHeaderLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  visitTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeInpatient: { backgroundColor: Colors.errorBg },
  badgeOutpatient: { backgroundColor: Colors.primaryMuted },
  visitTypeText: { fontSize: 10, fontWeight: 'bold' },
  badgeInpatientText: { color: Colors.error },
  badgeOutpatientText: { color: Colors.primary },
  visitMeta: { flex: 1 },
  visitDate: { fontSize: 14, fontWeight: '700', color: Colors.slateDark },
  visitFacility: { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  visitDiagnosis: { fontSize: 12, color: Colors.borderStrong, marginTop: 2 },
  visitHeaderRight: { alignItems: 'flex-end', minWidth: 56 },
  visitDocCount: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  visitDocCountLabel: { fontSize: 10, color: Colors.secondary },
  visitBody: { borderTopWidth: 1, borderTopColor: Colors.background, padding: 16, gap: 14 },
  visitInfoRow: { flexDirection: 'row', gap: 12 },
  visitInfoItem: { flex: 1 },
  visitInfoLabel: { fontSize: 11, color: Colors.borderStrong, marginBottom: 2 },
  visitInfoValue: { fontSize: 13, color: Colors.slateMuted, fontWeight: '600' },

  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 4, backgroundColor: Colors.background, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.secondary, minWidth: 70, textAlign: 'right' },

  // ── Nhóm tài liệu: viền trái thay cho badge nền màu ────────────────────
  groupCard: {
    borderLeftWidth: 3,
    backgroundColor: Colors.surface,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, gap: 8 },
  groupLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.slateMuted },
  groupCount: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  docList: { paddingLeft: 12, paddingTop: 4, paddingBottom: 8, gap: 8 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  docCardHas: { backgroundColor: Colors.background, borderColor: Colors.border },
  docCardMissing: { backgroundColor: Colors.surface, borderColor: Colors.border, borderStyle: 'dashed' },
  docCardLeft: { flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' },
  docInfo: { flex: 1 },
  docLabel: { fontSize: 13, color: Colors.slateMuted, fontWeight: '500' },
  docLabelMissing: { color: Colors.borderStrong },
  docStatusHas: { fontSize: 11, color: Colors.primary, marginTop: 2 },
  docStatusMissing: { fontSize: 11, color: Colors.borderStrong, marginTop: 2 },
  countBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginRight: 6,
  },
  countBadgeText: { fontSize: 11, color: Colors.white, fontWeight: 'bold' },

  infoNote: { flexDirection: 'row', gap: 10, paddingTop: 18, marginTop: 4 },
  infoNoteText: { flex: 1, fontSize: 12, color: Colors.borderStrong, lineHeight: 18 },
});
