import { canAccessStoredFile } from '../utils/storageAccess.util.js';

describe('Quyền đọc tệp y tế /api/v1/storage/files (P1-8)', () => {
  it('bệnh nhân đọc được tệp của chính mình', () => {
    const file = { patientId: 'patient-1' };
    expect(canAccessStoredFile(file, { id: 'patient-1', role: 'patient' })).toBe(true);
  });

  it('bệnh nhân KHÔNG đọc được tệp của bệnh nhân khác', () => {
    const file = { patientId: 'patient-2' };
    expect(canAccessStoredFile(file, { id: 'patient-1', role: 'patient' })).toBe(false);
  });

  it('bệnh nhân KHÔNG đọc được tệp không có chủ sở hữu (báo cáo PDF, metadata)', () => {
    const file = { patientId: null };
    expect(canAccessStoredFile(file, { id: 'patient-1', role: 'patient' })).toBe(false);
  });

  it('nhân viên cùng bệnh viện với bệnh nhân được đọc', () => {
    const file = { patientId: 'patient-1' };
    const user = { id: 'doctor-1', role: 'doctor', hospitalId: 'hospital-A' };
    expect(canAccessStoredFile(file, user, ['hospital-A'])).toBe(true);
  });

  it('nhân viên viện A KHÔNG đọc được tệp của bệnh nhân viện B dù biết fileId', () => {
    const file = { patientId: 'patient-1' };
    const user = { id: 'doctor-1', role: 'doctor', hospitalId: 'hospital-A' };
    expect(canAccessStoredFile(file, user, ['hospital-B'])).toBe(false);
  });

  it('nhân viên không được gán bệnh viện bị từ chối', () => {
    const file = { patientId: 'patient-1' };
    expect(canAccessStoredFile(file, { id: 'doctor-1', role: 'doctor', hospitalId: null }, ['hospital-A'])).toBe(false);
  });

  it('tệp do chính nhân viên cùng viện tải lên vẫn đọc được (qua uploadedBy)', () => {
    const file = { patientId: null, uploadedBy: 'nurse-1' };
    const user = { id: 'doctor-1', role: 'doctor', hospitalId: 'hospital-A' };
    expect(canAccessStoredFile(file, user, ['hospital-A'])).toBe(true);
  });

  it('thiếu chủ sở hữu thì từ chối kể cả nhân viên (fail-closed)', () => {
    const file = { patientId: null, uploadedBy: null };
    const user = { id: 'doctor-1', role: 'doctor', hospitalId: 'hospital-A' };
    expect(canAccessStoredFile(file, user, [])).toBe(false);
  });

  it('request không có user bị từ chối', () => {
    expect(canAccessStoredFile({ patientId: 'p' }, null, ['hospital-A'])).toBe(false);
  });
});
