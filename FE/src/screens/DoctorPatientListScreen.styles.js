import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { fontSize: 14, color: '#64748B' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, padding: 14, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  patientMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  patientPhone: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  diagnosisLabel: { fontSize: 12, color: '#94A3B8' },
  diagnosisValue: { fontSize: 12, color: '#334155', fontWeight: '500', flex: 1 },
  lastScan: { fontSize: 11, color: '#94A3B8', marginLeft: 8 },
});
