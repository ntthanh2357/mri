import { StyleSheet, Platform, Dimensions } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontWeight: 'bold',
  },
  scrollContainer: {
    padding: 16,
  },
  headerRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  desktopRow: {
    flexDirection: 'row',
    gap: 20,
  },
  mobileColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1.2,
  },
  fullWidth: {
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  viewerContainer: {
    height: 300,
    backgroundColor: '#090D16',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brainImage: {
    width: '90%',
    height: '90%',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4ADE80',
    width: '42%',
    height: '35%',
    top: '30%',
    left: '29%',
  },
  boxTag: {
    position: 'absolute',
    top: -18,
    left: -2,
    backgroundColor: '#15803D',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 40,
    color: '#475569',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnUpload: {
    backgroundColor: '#0F172A',
  },
  btnAi: {
    backgroundColor: '#2563EB',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  aiResultCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  aiResultHeader: {
    fontWeight: 'bold',
    color: '#1E3A8A',
    fontSize: 14,
    marginBottom: 6,
  },
  aiResultClass: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 2,
    fontWeight: '600',
  },
  aiResultConf: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 8,
  },
  aiDisclaimer: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    color: '#334155',
  },
  inputReadonly: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  textArea: {
    height: 50,
    textAlignVertical: 'top',
    paddingVertical: 6,
  },
  btnSave: {
    backgroundColor: '#15803D',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
