import { StyleSheet, Platform, Dimensions } from 'react-native';

export default StyleSheet.create({
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
    paddingVertical: 16,
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricEmoji: {
    fontSize: 16,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 9,
    color: '#166534',
    fontWeight: 'bold',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeRedText: {
    fontSize: 9,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  chartRow: {
    gap: 6,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 5,
  },
  barValue: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    minWidth: 24,
    textAlign: 'right',
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
  },
  transactionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastTxRow: {
    borderBottomWidth: 0,
  },
  txLeft: {
    flex: 1,
  },
  txId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  txSub: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 4,
  },
  txDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusSuccessText: {
    color: '#166534',
  },
  statusPendingText: {
    color: '#B45309',
  },
});
