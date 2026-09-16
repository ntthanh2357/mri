import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  User,
  ArrowRightLeft,
  ShieldAlert,
  Building2,
  X,
  Lock,
  Sparkles,
} from 'lucide-react';
import { get, post, put } from '../services/api.service';

const STATUS_MAP = {
  available: { label: 'Trống', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  reserved: { label: 'Đang giữ chỗ', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  occupied: { label: 'Đang điều trị', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  cleaning: { label: 'Đang khử khuẩn', bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
};

const BED_TYPES = {
  standard: 'Tiêu chuẩn',
  icu: 'Hồi sức cấp cứu (ICU)',
  isolation: 'Cách ly',
  vip: 'Theo yêu cầu (VIP)',
};

export default function HospitalBedManagementView({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [bedMapData, setBedMapData] = useState({ summary: {}, departments: [] });
  const [icuAlert, setIcuAlert] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'reserve' | 'occupy' | 'release' | 'transfer' | 'create'
  const [selectedBed, setSelectedBed] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [patients, setPatients] = useState([]);

  // Form states
  const [formPatientId, setFormPatientId] = useState('');
  const [formHoldHours, setFormHoldHours] = useState(4);
  const [formReason, setFormReason] = useState('');
  const [formDiagnosis, setFormDiagnosis] = useState('');
  const [formTargetBedId, setFormTargetBedId] = useState('');

  // Create bed form (Admin only)
  const [newBedDept, setNewBedDept] = useState('ICU');
  const [newBedNumber, setNewBedNumber] = useState('');
  const [newBedRoom, setNewBedRoom] = useState('');
  const [newBedFloor, setNewBedFloor] = useState('Tầng 3');
  const [newBedType, setNewBedType] = useState('icu');

  // Fetch bed map data
  const fetchBedData = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, icuRes] = await Promise.all([
        get('/api/v1/hospital-beds/map-summary'),
        get('/api/v1/hospital-beds/neuro-icu-capacity').catch(() => null),
      ]);
      if (mapRes && mapRes.success) {
        setBedMapData(mapRes.data || { summary: {}, departments: [] });
      }
      if (icuRes && icuRes.success) {
        setIcuAlert(icuRes.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu buồng giường:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch patients list for dropdowns
  const fetchPatients = async () => {
    try {
      const res = await get('/api/patients?all=true');
      if (res && res.success) {
        setPatients(res.data || []);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách bệnh nhân:', err);
    }
  };

  useEffect(() => {
    fetchBedData();
    fetchPatients();
  }, [fetchBedData]);

  // Open action modal
  const handleOpenModal = (type, bed) => {
    setSelectedBed(bed);
    setActiveModal(type);
    setFormPatientId(bed?.reservedForPatientId?._id || bed?.currentPatientId?._id || '');
    setFormHoldHours(4);
    setFormReason('');
    setFormDiagnosis('');
    setFormTargetBedId('');
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedBed(null);
  };

  // 1. Giữ chỗ giường bệnh (4 giờ)
  const handleReserve = async () => {
    if (!formPatientId) {
      alert('Vui lòng chọn bệnh nhân cần giữ chỗ.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await post(`/api/v1/hospital-beds/${selectedBed._id}/reserve`, {
        patientId: formPatientId,
        holdHours: Number(formHoldHours) || 4,
        reason: formReason || 'Chờ tiếp nhận nhập viện',
      });
      if (res && res.success) {
        alert(res.message || 'Giữ chỗ giường bệnh thành công!');
        handleCloseModal();
        fetchBedData();
      } else {
        alert(res.message || 'Không thể giữ chỗ giường.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi giữ chỗ giường bệnh.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Nhập viện vào giường
  const handleOccupy = async () => {
    if (!formPatientId) {
      alert('Vui lòng chọn bệnh nhân nhập giường.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await put(`/api/v1/hospital-beds/${selectedBed._id}/occupy`, {
        patientId: formPatientId,
        diagnosis: formDiagnosis || 'Điều trị nội trú',
      });
      if (res && res.success) {
        alert(res.message || 'Bệnh nhân đã nhập giường điều trị thành công!');
        handleCloseModal();
        fetchBedData();
      } else {
        alert(res.message || 'Không thể nhập giường.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi nhập giường.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Giải phóng giường khi xuất viện
  const handleRelease = async () => {
    setActionLoading(true);
    try {
      const res = await put(`/api/v1/hospital-beds/${selectedBed._id}/release`, {
        dischargeNotes: formReason || 'Bệnh nhân xuất viện / chuyển khoa',
      });
      if (res && res.success) {
        alert('Đã giải phóng giường. Giường bệnh được chuyển sang trạng thái "Đang khử khuẩn".');
        handleCloseModal();
        fetchBedData();
      } else {
        alert(res.message || 'Không thể giải phóng giường.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi giải phóng giường.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Hoàn tất khử khuẩn
  const handleCompleteCleaning = async (bedId) => {
    try {
      const res = await put(`/api/v1/hospital-beds/${bedId}/cleaning-complete`, {});
      if (res && res.success) {
        alert('Đã hoàn tất khử khuẩn. Giường sẵn sàng đón bệnh nhân mới!');
        fetchBedData();
      } else {
        alert(res.message || 'Thất bại.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật trạng thái khử khuẩn.');
    }
  };

  // 5. Chuyển giường nội bộ viện
  const handleInternalTransfer = async () => {
    if (!formTargetBedId) {
      alert('Vui lòng chọn giường đích còn trống.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await post('/api/v1/hospital-beds/transfer-internal', {
        fromBedId: selectedBed._id,
        toBedId: formTargetBedId,
        patientId: selectedBed?.currentPatientId?._id || formPatientId,
        reason: formReason || 'Chuyển buồng điều trị theo chỉ định chuyên môn',
        diagnosis: formDiagnosis || 'Theo dõi chuyên khoa',
      });
      if (res && res.success) {
        alert('Điều chuyển giường nội bộ thành công!');
        handleCloseModal();
        fetchBedData();
      } else {
        alert(res.message || 'Không thể chuyển giường.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi điều chuyển giường.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Thêm giường mới (Admin)
  const handleCreateBed = async () => {
    if (!newBedNumber.trim()) {
      alert('Vui lòng nhập số giường.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await post('/api/v1/hospital-beds', {
        departmentId: newBedDept,
        departmentName: newBedDept === 'ICU' ? 'Hồi sức cấp cứu Ngoại Thần Kinh (Neuro-ICU)' :
                        newBedDept === 'KNT' ? 'Khoa Ngoại Thần Kinh' : 'Khoa Nội Thần Kinh',
        bedNumber: newBedNumber.trim(),
        roomNumber: newBedRoom.trim() || 'Phòng 101',
        floor: newBedFloor,
        type: newBedType,
      });
      if (res && res.success) {
        alert('Tạo giường bệnh mới thành công!');
        handleCloseModal();
        setNewBedNumber('');
        fetchBedData();
      } else {
        alert(res.message || 'Không thể tạo giường.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi tạo giường bệnh.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter beds
  const allBeds = (bedMapData.departments || []).flatMap(dept => 
    Object.values(dept.rooms || {}).flat()
  );

  const availableBedsList = allBeds.filter(b => b.status === 'available');

  const filteredDepartments = (bedMapData.departments || []).filter(dept => {
    if (selectedDepartment !== 'all' && dept.departmentId !== selectedDepartment) return false;
    return true;
  });

  const isHospitalAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hospital_admin';

  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto space-y-6">
      
      {/* ── HEADER & CAPACITY ALERT ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-50 rounded-xl text-cyan-700 border border-cyan-100">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                Sơ Đồ Buồng Giường Bệnh (Real-Time Bed Map)
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Quản lý phân bổ giường nội trú, điều chuyển nội bộ và khóa giữ chỗ cấp cứu 4h
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isHospitalAdmin && (
            <button
              onClick={() => handleOpenModal('create', null)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Thêm Giường Bệnh
            </button>
          )}
          <button
            onClick={fetchBedData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-semibold rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── NEURO-ICU CAPACITY ALERT WIDGET ─────────────────────────────── */}
      {icuAlert && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
          icuAlert.isCritical ? 'bg-rose-50 border-rose-200 text-rose-900' :
          icuAlert.isWarning ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-3">
            <ShieldAlert className={`w-5 h-5 shrink-0 ${
              icuAlert.isCritical ? 'text-rose-600 animate-pulse' :
              icuAlert.isWarning ? 'text-amber-600' : 'text-emerald-600'
            }`} />
            <div>
              <p className="text-sm font-bold">
                Công suất Giường Hồi sức U não (Neuro-ICU): {icuAlert.occupancyRate}% ({icuAlert.occupiedBeds}/{icuAlert.totalBeds} giường)
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {icuAlert.alertMessage || `Khoa ICU còn ${icuAlert.availableBeds} giường trống sẵn sàng tiếp nhận cấp cứu.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/80 border border-current shadow-2xs">
              Trống: {icuAlert.availableBeds} | Giữ chỗ: {icuAlert.reservedBeds || 0}
            </span>
          </div>
        </div>
      )}

      {/* ── STATS BAR ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">Tổng số giường</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{bedMapData.summary?.totalBeds || 0}</p>
          <div className="mt-2 text-[11px] text-slate-400">Toàn viện</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <p className="text-xs text-emerald-700 font-medium">Giường trống</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{bedMapData.summary?.availableCount || 0}</p>
          <div className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sẵn sàng tiếp nhận
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs">
          <p className="text-xs text-amber-700 font-medium">Đang giữ chỗ (4h)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{bedMapData.summary?.reservedCount || 0}</p>
          <div className="mt-2 text-[11px] text-amber-600 flex items-center gap-1 font-semibold">
            <Clock className="w-3 h-3" /> Đang khóa chỗ
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-2xs">
          <p className="text-xs text-rose-700 font-medium">Đang điều trị</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{bedMapData.summary?.occupiedCount || 0}</p>
          <div className="mt-2 text-[11px] text-rose-600 flex items-center gap-1 font-semibold">
            <User className="w-3 h-3" /> Có người nằm
          </div>
        </div>
      </div>

      {/* ── FILTERS ────────────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Khoa:</span>
          <button
            onClick={() => setSelectedDepartment('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedDepartment === 'all' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả khoa
          </button>
          <button
            onClick={() => setSelectedDepartment('ICU')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedDepartment === 'ICU' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Neuro-ICU
          </button>
          <button
            onClick={() => setSelectedDepartment('KNT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedDepartment === 'KNT' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ngoại Thần Kinh
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo số giường, phòng..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium text-slate-700"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Trống</option>
            <option value="reserved">Đang giữ chỗ</option>
            <option value="occupied">Đang điều trị</option>
            <option value="cleaning">Đang khử khuẩn</option>
          </select>
        </div>
      </div>

      {/* ── VISUAL BED GRID ────────────────────────────────────────────── */}
      <div className="space-y-6">
        {filteredDepartments.map((dept) => {
          const rooms = dept.rooms || {};
          return (
            <div key={dept.departmentId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
                  <h2 className="text-base md:text-lg font-bold text-slate-800">{dept.departmentName}</h2>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
                    {dept.total} giường
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 font-medium">Trống: <b>{dept.available || 0}</b></span>
                  <span className="text-amber-600 font-medium">Giữ chỗ: <b>{dept.reserved || 0}</b></span>
                  <span className="text-rose-600 font-medium">Có người: <b>{dept.occupied || 0}</b></span>
                </div>
              </div>

              {/* Rooms inside department */}
              <div className="space-y-4">
                {Object.entries(rooms).map(([roomNumber, beds]) => {
                  const filteredBeds = beds.filter((b) => {
                    if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
                    if (searchKeyword.trim()) {
                      const kw = searchKeyword.toLowerCase();
                      const matchNumber = b.bedNumber?.toLowerCase().includes(kw);
                      const matchRoom = b.roomNumber?.toLowerCase().includes(kw);
                      const matchPt = (b.currentPatientId?.profile?.name || b.currentPatientId?.profile?.fullName || '').toLowerCase().includes(kw);
                      return matchNumber || matchRoom || matchPt;
                    }
                    return true;
                  });

                  if (filteredBeds.length === 0) return null;

                  return (
                    <div key={roomNumber} className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          {roomNumber} {filteredBeds[0]?.floor ? `(${filteredBeds[0].floor})` : ''}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{filteredBeds.length} giường</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredBeds.map((bed) => {
                          const statusConfig = STATUS_MAP[bed.status] || STATUS_MAP.available;
                          const patientName = bed.currentPatientId?.profile?.name ||
                                              bed.currentPatientId?.profile?.fullName ||
                                              bed.reservedForPatientId?.profile?.name ||
                                              bed.reservedForPatientId?.profile?.fullName ||
                                              null;

                          return (
                            <div
                              key={bed._id}
                              className={`p-3.5 bg-white rounded-xl border transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between ${
                                bed.status === 'available' ? 'border-emerald-200 hover:border-emerald-400' :
                                bed.status === 'reserved' ? 'border-amber-200 hover:border-amber-400' :
                                bed.status === 'occupied' ? 'border-rose-200 hover:border-rose-400' :
                                'border-purple-200 hover:border-purple-400'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-bold text-slate-800">
                                    Giường {bed.bedNumber}
                                  </span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${statusConfig.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                    {statusConfig.label}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-500">
                                  Loại: <span className="font-semibold text-slate-700">{BED_TYPES[bed.type] || bed.type}</span>
                                </p>

                                {patientName && (
                                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[11px] text-slate-400 font-medium">Bệnh nhân:</p>
                                    <p className="text-xs font-bold text-slate-800 truncate">{patientName}</p>
                                    {bed.reservedUntil && bed.status === 'reserved' && (
                                      <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Hết hạn giữ chỗ: {new Date(bed.reservedUntil).toLocaleTimeString('vi-VN')}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Clinical Action Buttons */}
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                {bed.status === 'available' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenModal('reserve', bed)}
                                      className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all border border-amber-200"
                                    >
                                      Giữ chỗ 4h
                                    </button>
                                    <button
                                      onClick={() => handleOpenModal('occupy', bed)}
                                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                                    >
                                      Nhập giường
                                    </button>
                                  </>
                                )}

                                {bed.status === 'reserved' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenModal('occupy', bed)}
                                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                                    >
                                      Vào giường
                                    </button>
                                    <button
                                      onClick={() => handleOpenModal('release', bed)}
                                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                                    >
                                      Hủy chỗ
                                    </button>
                                  </>
                                )}

                                {bed.status === 'occupied' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenModal('transfer', bed)}
                                      className="flex-1 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg text-xs font-bold border border-cyan-200 flex items-center justify-center gap-1"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" /> Chuyển
                                    </button>
                                    <button
                                      onClick={() => handleOpenModal('release', bed)}
                                      className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200"
                                    >
                                      Trả giường
                                    </button>
                                  </>
                                )}

                                {bed.status === 'cleaning' && (
                                  <button
                                    onClick={() => handleCompleteCleaning(bed._id)}
                                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã khử khuẩn xong
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODALS FOR ACTIONS ─────────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {activeModal === 'reserve' && `Giữ Chỗ Giường ${selectedBed?.bedNumber} (Khóa 4h)`}
                {activeModal === 'occupy' && `Nhập Viện Vào Giường ${selectedBed?.bedNumber}`}
                {activeModal === 'release' && `Giải Phóng Giường ${selectedBed?.bedNumber}`}
                {activeModal === 'transfer' && `Điều Chuyển Bệnh Nhân (Giường ${selectedBed?.bedNumber})`}
                {activeModal === 'create' && 'Thêm Giường Bệnh Mới Vào Hệ Thống'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content for Reserve */}
            {activeModal === 'reserve' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Cơ chế khóa giữ chỗ ngăn ngừa 2 bác sĩ cùng chỉ định 1 giường tại cùng thời điểm (Chống Race Condition - TT 46/2018).
                </p>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Chọn bệnh nhân giữ chỗ:</label>
                  <select
                    value={formPatientId}
                    onChange={(e) => setFormPatientId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="">-- Chọn bệnh nhân --</option>
                    {patients.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.profile?.name || p.profile?.fullName || p.email} ({p.profile?.medicalId || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Thời gian giữ chỗ tối đa:</label>
                  <select
                    value={formHoldHours}
                    onChange={(e) => setFormHoldHours(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value={2}>2 giờ</option>
                    <option value={4}>4 giờ (Mặc định chuẩn BV)</option>
                    <option value={8}>8 giờ (Ca phẫu thuật dài)</option>
                    <option value={12}>12 giờ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Lý do giữ chỗ:</label>
                  <textarea
                    rows={2}
                    placeholder="VD: Cấp cứu chấn thương sọ não, đang làm xét nghiệm tiền phẫu..."
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                    Hủy
                  </button>
                  <button
                    onClick={handleReserve}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    {actionLoading ? 'Đang khóa giường...' : 'Xác Nhận Giữ Chỗ'}
                  </button>
                </div>
              </div>
            )}

            {/* Content for Occupy */}
            {activeModal === 'occupy' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Chọn bệnh nhân nhập giường:</label>
                  <select
                    value={formPatientId}
                    onChange={(e) => setFormPatientId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="">-- Chọn bệnh nhân --</option>
                    {patients.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.profile?.name || p.profile?.fullName || p.email} ({p.profile?.medicalId || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Chẩn đoán nhập khoa:</label>
                  <input
                    type="text"
                    placeholder="VD: U thần kinh đệm độ III (Glioblastoma)..."
                    value={formDiagnosis}
                    onChange={(e) => setFormDiagnosis(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                    Hủy
                  </button>
                  <button
                    onClick={handleOccupy}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    {actionLoading ? 'Đang lưu...' : 'Xác Nhận Nhập Giường'}
                  </button>
                </div>
              </div>
            )}

            {/* Content for Release */}
            {activeModal === 'release' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Khi xác nhận xuất viện hoặc trả giường, giường sẽ tự động chuyển sang trạng thái <b>Đang khử khuẩn</b> để hộ lý/điều dưỡng vệ sinh trước khi đón bệnh nhân mới.
                </p>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Ghi chú xuất viện / Trả giường:</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú diễn tiến xuất viện hoặc lý do trả giường..."
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                    Hủy
                  </button>
                  <button
                    onClick={handleRelease}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Giải Phóng Giường'}
                  </button>
                </div>
              </div>
            )}

            {/* Content for Transfer Internal */}
            {activeModal === 'transfer' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Chọn giường đích chuyển đến (Đang trống):</label>
                  <select
                    value={formTargetBedId}
                    onChange={(e) => setFormTargetBedId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="">-- Chọn giường trống đích --</option>
                    {availableBedsList.map((b) => (
                      <option key={b._id} value={b._id}>
                        Giường {b.bedNumber} - {b.roomNumber} ({b.departmentName || b.departmentId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Lý do điều chuyển nội bộ:</label>
                  <textarea
                    rows={2}
                    placeholder="VD: Chuyển từ ICU sang phòng bệnh thường sau mổ 48h..."
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                    Hủy
                  </button>
                  <button
                    onClick={handleInternalTransfer}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    {actionLoading ? 'Đang điều chuyển...' : 'Xác Nhận Chuyển Giường'}
                  </button>
                </div>
              </div>
            )}

            {/* Content for Create Bed (Admin only) */}
            {activeModal === 'create' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Khoa phòng:</label>
                  <select
                    value={newBedDept}
                    onChange={(e) => setNewBedDept(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="ICU">Khoa Hồi sức cấp cứu Ngoại Thần Kinh (Neuro-ICU)</option>
                    <option value="KNT">Khoa Ngoại Thần Kinh (Phẫu thuật não)</option>
                    <option value="KNoiTK">Khoa Nội Thần Kinh</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Số giường:</label>
                    <input
                      type="text"
                      placeholder="VD: G-305"
                      value={newBedNumber}
                      onChange={(e) => setNewBedNumber(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Phòng:</label>
                    <input
                      type="text"
                      placeholder="VD: Phòng 301"
                      value={newBedRoom}
                      onChange={(e) => setNewBedRoom(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Tầng:</label>
                    <input
                      type="text"
                      placeholder="VD: Tầng 3"
                      value={newBedFloor}
                      onChange={(e) => setNewBedFloor(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Phân loại:</label>
                    <select
                      value={newBedType}
                      onChange={(e) => setNewBedType(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value="icu">Hồi sức ICU</option>
                      <option value="standard">Tiêu chuẩn</option>
                      <option value="vip">Theo yêu cầu (VIP)</option>
                      <option value="isolation">Cách ly</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button onClick={handleCloseModal} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                    Hủy
                  </button>
                  <button
                    onClick={handleCreateBed}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    {actionLoading ? 'Đang tạo...' : 'Tạo Giường Mới'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
