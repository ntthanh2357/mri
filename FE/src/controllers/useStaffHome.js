import { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api.service';
import { buildStaffTasks, nextUpVisits, nextUpPrescriptions } from '../utils/staffTasks';

/** Dữ liệu trang chủ nhân viên: hàng đợi, bệnh án, hóa đơn (lễ tân), ca trực hôm nay.
 *  [P1-PharmacyQueue] Dược sĩ load hàng đợi Khoa Dược (GET /api/drugs/queue)
 *  thay vì my-queue — đúng nghiệp vụ "tiếp nhận đơn thuốc điện tử" (UC-PHA-01). */
const useStaffHome = (user) => {
  const [data, setData] = useState({ loading: true, visits: [], emr: [], invoices: [], prescriptions: [], schedule: null });

  const load = useCallback(async () => {
    if (!user) return;
    setData(d => ({ ...d, loading: true }));
    const isPharmacist = user.role === 'pharmacist';
    const [queueRes, pharmRes, emrRes, schedRes, invRes] = await Promise.all([
      isPharmacist ? null : get('/api/v1/visits/my-queue').catch(() => null),
      isPharmacist ? get('/api/drugs/queue').catch(() => null) : null,
      get('/emr/records').catch(() => null),
      get('/api/v1/schedules/my-schedule').catch(() => null),
      user.role === 'receptionist' ? get('/api/v1/invoices').catch(() => null) : null,
    ]);
    const schedules = schedRes?.data?.schedules;
    const today = new Date().toDateString();
    setData({
      loading: false,
      visits: queueRes?.visits || [],
      prescriptions: pharmRes?.data?.prescriptions || [],
      emr: emrRes?.status === 'success' && Array.isArray(emrRes.data) ? emrRes.data : [],
      invoices: invRes?.invoices || [],
      schedule: Array.isArray(schedules) ? schedules.find(s => new Date(s.date).toDateString() === today) || null : null,
    });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return {
    ...data,
    tasks: buildStaffTasks(user?.role, data),
    nextUp: user?.role === 'pharmacist'
      ? nextUpPrescriptions(data.prescriptions)
      : nextUpVisits(user?.role, data.visits),
    reload: load,
  };
};

export default useStaffHome;
