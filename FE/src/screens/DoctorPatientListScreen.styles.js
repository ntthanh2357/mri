import { StyleSheet, Platform } from 'react-native';
import Colors from '../constants/colors';

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { fontSize: 14, color: Colors.slateMuted },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.brandNavy },
  
  statsSummaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(11, 42, 85, 0.06)' },
      default: { elevation: 1 },
    }),
  },
  summaryVal: { fontSize: 18, fontWeight: 'bold', color: Colors.brandNavy },
  summaryLbl: { fontSize: 12, color: Colors.slateMuted, marginTop: 2, fontWeight: '500', textAlign: 'center' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10,
    marginTop: 8,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.brandNavy },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: Colors.brandGreen,
    borderColor: Colors.brandGreen,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },

  list: { paddingHorizontal: 16, paddingBottom: 36, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
      default: { elevation: 2 },
    }),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.brandNavy,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, color: '#FFF', fontWeight: '700', letterSpacing: 0.5 },
  cardInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: Colors.brandNavy },
  patientMeta: { fontSize: 12, color: Colors.slateMuted, marginTop: 2 },
  patientPhone: { fontSize: 12, color: Colors.slateMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
  },
  diagnosisLabel: { fontSize: 12, color: Colors.slateMuted, fontWeight: '600' },
  diagnosisValue: { fontSize: 12, color: '#1E293B', fontWeight: '500', flex: 1 },
  lastScan: { fontSize: 12, color: Colors.slateMuted, marginLeft: 8, fontWeight: '500' },
  
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justify: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: Colors.brandGreen,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  actionBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionBtnSecondaryText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
});
