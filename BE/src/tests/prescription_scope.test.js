import { buildVisitPrescriptionFilter } from '../utils/prescriptionScope.util.js';

describe('Scope đơn thuốc theo lượt khám (P1-7)', () => {
  const visit = {
    _id: 'visit-2',
    patientId: 'patient-1',
    createdAt: new Date('2026-10-20T08:00:00Z'),
  };

  it('luôn lọc theo bệnh nhân và chỉ lấy đơn chưa tính tiền', () => {
    const filter = buildVisitPrescriptionFilter(visit);
    expect(filter.patient_id).toBe('patient-1');
    expect(filter.isBilled.$ne).toBe(true);
  });

  it('ưu tiên đơn đúng visitId của ca hiện tại', () => {
    const filter = buildVisitPrescriptionFilter(visit);
    expect(filter.$or[0].visitId).toBe('visit-2');
  });

  it('chỉ fallback đơn cũ chưa gắn ca (visitId null) tạo sau khi ca bắt đầu', () => {
    const fallback = buildVisitPrescriptionFilter(visit).$or[1];
    expect(fallback.visitId).toBeNull();
    expect(fallback.createdAt.$gte).toBe(visit.createdAt);
  });

  it('không còn điều kiện createdAt trần (nguồn gốc hút nhầm đơn của ca trước)', () => {
    const filter = buildVisitPrescriptionFilter(visit);
    expect(filter.createdAt === undefined).toBe(true);
  });

  it('ca thiếu createdAt thì KHÔNG fallback (tránh hút đơn của ca trước)', () => {
    const filter = buildVisitPrescriptionFilter({ _id: 'v', patientId: 'p' });
    expect(filter.$or.length).toBe(1);
    expect(filter.$or[0].visitId).toBe('v');
  });
});
