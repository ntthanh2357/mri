import React, { useState, useEffect } from 'react';
import { get, post, put, del } from '../services/api.service';
import Config from '../constants/config';

const STATUS_LABEL = {
  provisioned: { text: 'Chờ điền thông tin', color: 'bg-yellow-100 text-yellow-700' },
  submitted:   { text: 'Chờ duyệt',          color: 'bg-blue-100 text-blue-700' },
  active:      { text: 'Đã kích hoạt',        color: 'bg-green-100 text-green-700' },
  rejected:    { text: 'Từ chối',             color: 'bg-red-100 text-red-700' },
};

export default function AdminHospitalsView() {
  const [hospitals, setHospitals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Provision modal state
  const [showProvision, setShowProvision] = useState(false);
  const [provHospitalName, setProvHospitalName] = useState('');
  const [provItEmail, setProvItEmail] = useState('');
  const [provLoading, setProvLoading] = useState(false);
  const [provResult, setProvResult] = useState(null);
  const [provError, setProvError] = useState('');

  // Activate state
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState('');

  // Lock/Unlock & Delete state
  const [locking, setLocking] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await get('/admin/hospitals');
      setHospitals(res.hospitals || []);
    } catch {
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHospitals(); }, []);

  const fetchDetail = async (id) => {
    try {
      const res = await get(`/admin/hospitals/${id}`);
      setSelected(res.hospital || null);
      setActivateMsg('');
    } catch {
      setSelected(null);
    }
  };

  const handleProvision = async () => {
    if (!provHospitalName.trim() || !provItEmail.trim()) {
      setProvError('Vui lòng nhập đầy đủ tên bệnh viện và email IT.');
      return;
    }
    setProvLoading(true);
    setProvError('');
    try {
      const res = await post('/admin/hospitals/provision', {
        hospitalName: provHospitalName.trim(),
        itEmail: provItEmail.trim(),
      });
      setProvResult(res.credentials);
      await fetchHospitals();
    } catch (err) {
      setProvError(err?.message || 'Tạo tài khoản thất bại.');
    } finally {
      setProvLoading(false);
    }
  };

  const [resetResult, setResetResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    if (!selected) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await post(`/admin/hospitals/${selected._id}/reset-password`, {});
      setResetResult(res.credentials);
    } catch (err) {
      setResetResult({ error: err?.message || 'Reset thất bại.' });
    } finally {
      setResetting(false);
    }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setActivating(true);
    setActivateMsg('');
    try {
      await put(`/admin/hospitals/${selected._id}/activate`, {});
      setActivateMsg('success');
      await fetchDetail(selected._id);
      await fetchHospitals();
    } catch (err) {
      setActivateMsg(err?.message || 'Kích hoạt thất bại.');
    } finally {
      setActivating(false);
    }
  };

  const handleToggleLock = async () => {
    if (!selected) return;
    setLocking(true);
    try {
      await put(`/admin/hospitals/${selected._id}/toggle-lock`, {});
      await fetchDetail(selected._id);
      await fetchHospitals();
    } catch (err) {
      alert(err?.message || 'Thao tác khoá/mở khoá thất bại.');
    } finally {
      setLocking(false);
    }
  };

  const handleDeleteHospital = async () => {
    if (!selected) return;
    if (deleteConfirmName !== selected.code) {
      setDeleteError('Mã xác nhận không khớp.');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await del(`/admin/hospitals/${selected._id}`);
      setSelected(null);
      setShowDeleteConfirm(false);
      await fetchHospitals();
    } catch (err) {
      setDeleteError(err?.message || 'Xoá bệnh viện thất bại.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = hospitals.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.name?.toLowerCase().includes(q) || h.code?.toLowerCase().includes(q) || h.loginEmail?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || (filterStatus === 'locked' ? h.isActive === false : h.status === filterStatus);
    return matchSearch && matchStatus;
  });

  const pendingCount = hospitals.filter(h => h.status === 'submitted').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Quản lý Bệnh viện & Onboarding</h2>
          <p className="text-slate-400 text-xs mt-0.5">Cấp tài khoản tạm, theo dõi quá trình điền thông tin và xác thực bệnh viện</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-3 py-1.5 rounded-lg">
              Chờ duyệt: {pendingCount}
            </span>
          )}
          <button
            onClick={() => { setShowProvision(true); setProvResult(null); setProvError(''); setProvHospitalName(''); setProvItEmail(''); }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold py-2 px-4 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            + Cấp tài khoản tạm
          </button>
          <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-bold px-3 py-2 rounded-lg">
            Tổng: {hospitals.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, mã BV, email..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="provisioned">Chờ điền thông tin</option>
          <option value="submitted">Chờ duyệt</option>
          <option value="active">Đã kích hoạt</option>
          <option value="rejected">Từ chối</option>
          <option value="locked">🔒 Đang bị khoá</option>
        </select>
      </div>

      {/* Main layout */}
      <div className="flex gap-4" style={{ minHeight: 480 }}>
        {/* List */}
        <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Danh sách Bệnh viện</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
              <span className="text-2xl">🏥</span>
              <span>Chưa có bệnh viện nào</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(h => {
                const s = STATUS_LABEL[h.status] || STATUS_LABEL.provisioned;
                const isActive = selected?._id === h._id;
                return (
                  <button
                    key={h._id}
                    onClick={() => fetchDetail(h._id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-base font-bold text-slate-500 shrink-0">
                      {h.name?.charAt(0) || 'B'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{h.name}</p>
                      <p className="text-xs text-slate-400 truncate">{h.code} · {h.loginEmail || h.tempUsername + '@temp'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {h.isActive === false && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔒 Khoá</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.color}`}>{s.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-96 border border-slate-200 rounded-2xl overflow-auto">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Chi tiết Bệnh viện</p>
          </div>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400 text-sm gap-2">
              <span className="text-3xl">🏥</span>
              <span>Chọn một bệnh viện để xem chi tiết</span>
            </div>
          ) : (
            <div className="p-4 space-y-4 text-sm">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${(STATUS_LABEL[selected.status] || STATUS_LABEL.provisioned).color}`}>
                    {(STATUS_LABEL[selected.status] || STATUS_LABEL.provisioned).text}
                  </span>
                  {selected.isActive === false && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                      🔒 Đang bị khoá
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{selected.code}</span>
              </div>

              <DetailRow label="Tên bệnh viện" value={selected.name} />
              {selected.nameShort && <DetailRow label="Tên viết tắt" value={selected.nameShort} />}
              {selected.taxCode && <DetailRow label="Mã số thuế" value={selected.taxCode} />}
              {selected.loginEmail && <DetailRow label="Email đăng nhập" value={selected.loginEmail} highlight />}
              {selected.contactEmail && <DetailRow label="Email liên hệ" value={selected.contactEmail} />}
              {selected.phone && <DetailRow label="Điện thoại" value={selected.phone} />}
              {selected.website && <DetailRow label="Website" value={selected.website} />}
              {selected.fax && <DetailRow label="Fax" value={selected.fax} />}

              {/* Address */}
              {selected.address && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Địa chỉ</p>
                  <p className="text-slate-700 font-medium">
                    {typeof selected.address === 'string'
                      ? selected.address
                      : [selected.address.street, selected.address.ward, selected.address.district, selected.address.province].filter(Boolean).join(', ')
                    }
                  </p>
                </div>
              )}

              {/* Legal rep */}
              {selected.legalRep?.name && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Người đại diện pháp luật</p>
                  <DetailRow label="Họ tên" value={`${selected.legalRep.name} — ${selected.legalRep.position}`} />
                  <DetailRow label="Điện thoại" value={selected.legalRep.phone} />
                  <DetailRow label="Email" value={selected.legalRep.email} />
                </div>
              )}

              {/* IT contact */}
              {selected.itContact?.name && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">IT phụ trách</p>
                  <DetailRow label="Họ tên" value={selected.itContact.name} />
                  <DetailRow label="Điện thoại" value={selected.itContact.phone} />
                  <DetailRow label="Email" value={selected.itContact.email} />
                </div>
              )}

              {/* License file */}
              {selected.licenseFile && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">Giấy phép hoạt động</p>
                  <a href={selected.licenseFile.startsWith('http') ? selected.licenseFile : `${Config.API_URL}${selected.licenseFile}`} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline block">
                    Xem Giấy phép hoạt động
                  </a>
                  {/\.(jpg|jpeg|png|webp|gif)$/i.test(selected.licenseFile) && (
                    <img 
                      src={selected.licenseFile.startsWith('http') ? selected.licenseFile : `${Config.API_URL}${selected.licenseFile}`}
                      alt="Giấy phép hoạt động"
                      className="w-full max-h-48 object-contain rounded-lg border border-slate-200 mt-2"
                    />
                  )}
                </div>
              )}

              {/* Reset password (only for non-active) */}
              {selected.status !== 'active' && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Tài khoản tạm</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Email đăng nhập: <code className="bg-slate-100 px-1 rounded text-slate-700">{selected.code?.toLowerCase()}@temp.neuroscan.internal</code>
                  </p>
                  {resetResult && !resetResult.error && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 text-xs space-y-1">
                      <p className="font-bold text-amber-700">Mật khẩu mới:</p>
                      <p className="font-mono text-slate-800">{resetResult.tempPassword}</p>
                    </div>
                  )}
                  {resetResult?.error && <p className="text-red-500 text-xs mb-2">{resetResult.error}</p>}
                  <button
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="w-full border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 rounded-xl text-xs font-bold py-2 transition-all cursor-pointer"
                  >
                    {resetting ? 'Đang reset...' : '🔑 Reset mật khẩu tạm'}
                  </button>
                </div>
              )}

              {/* Activate button (only when submitted) */}
              {selected.status === 'submitted' && (
                <div className="border-t border-slate-100 pt-4">
                  {activateMsg === 'success' ? (
                    <div className="text-center text-green-600 font-semibold text-sm py-2">✓ Đã kích hoạt thành công!</div>
                  ) : (
                    <>
                      {activateMsg && <p className="text-red-500 text-xs mb-2">{activateMsg}</p>}
                      <button
                        onClick={handleActivate}
                        disabled={activating}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold py-2.5 transition-all active:scale-95 cursor-pointer"
                      >
                        {activating ? 'Đang xác thực...' : '✓ Xác thực tài khoản'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Actions Section */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Hành động quản trị</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleLock}
                    disabled={locking}
                    className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-all cursor-pointer ${
                      selected.isActive === false
                        ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                        : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {locking ? 'Đang xử lý...' : (selected.isActive === false ? '🔓 Mở khoá' : '🔒 Khoá')}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmName('');
                      setShowDeleteConfirm(true);
                      setDeleteError('');
                    }}
                    className="flex-1 border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold py-2.5 transition-all cursor-pointer"
                  >
                    ❌ Xoá bệnh viện
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Provision modal */}
      {showProvision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1">Cấp tài khoản tạm cho Bệnh viện</h3>
            <p className="text-xs text-slate-400 mb-5">Hệ thống sẽ tạo mã đăng nhập tạm <strong>BV_XXX</strong> và gửi về email IT.</p>

            {provResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-green-700">✓ Tạo thành công! Lưu lại thông tin sau:</p>
                  <div className="bg-white rounded-lg p-3 space-y-1.5 text-sm">
                    <p><span className="text-slate-400 text-xs">Tên đăng nhập:</span><br />
                      <strong className="font-mono text-slate-800">{provResult.tempUsername}</strong></p>
                    <p><span className="text-slate-400 text-xs">Mật khẩu tạm:</span><br />
                      <strong className="font-mono text-slate-800">{provResult.tempPassword}</strong></p>
                    <p><span className="text-slate-400 text-xs">Đã gửi email đến:</span><br />
                      <span className="text-slate-700">{provResult.itEmail}</span></p>
                  </div>
                </div>
                <button onClick={() => { setShowProvision(false); setProvResult(null); }}
                  className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer hover:bg-slate-700">
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tên bệnh viện <span className="text-red-500">*</span></label>
                  <input
                    value={provHospitalName}
                    onChange={e => setProvHospitalName(e.target.value)}
                    placeholder="VD: Bệnh viện Bạch Mai"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email IT nhận thông tin đăng nhập <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={provItEmail}
                    onChange={e => setProvItEmail(e.target.value)}
                    placeholder="it@benhvien.com"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                {provError && <p className="text-red-500 text-xs">{provError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowProvision(false)}
                    className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold cursor-pointer hover:bg-slate-50">
                    Hủy
                  </button>
                  <button onClick={handleProvision} disabled={provLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer">
                    {provLoading ? 'Đang tạo...' : 'Tạo tài khoản tạm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-extrabold">Xác nhận xoá Bệnh viện vĩnh viễn</h3>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed font-sans">
              Cảnh báo: Hành động này sẽ <strong className="text-red-600 font-bold">xoá vĩnh viễn</strong> bệnh viện <strong>{selected?.name}</strong> cùng tất cả các tài khoản nhân sự (Bác sĩ, Điều dưỡng, Kỹ thuật viên) trực thuộc. Dữ liệu sau khi xoá không thể khôi phục.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 font-sans">
                  Nhập mã bệnh viện <strong className="font-mono text-red-600 select-all bg-red-50 px-1.5 py-0.5 rounded">{selected?.code}</strong> để xác nhận:
                </label>
                <input
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={`Nhập ${selected?.code || ''}`}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 font-mono"
                />
              </div>
              
              {deleteError && <p className="text-red-500 text-xs font-semibold font-sans">{deleteError}</p>}
              
              <div className="flex gap-2 pt-1 font-sans">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmName('');
                    setDeleteError('');
                  }}
                  disabled={deleting}
                  className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteHospital}
                  disabled={deleting || deleteConfirmName !== selected?.code}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer transition-colors"
                >
                  {deleting ? 'Đang xoá...' : 'Xác nhận xoá'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className={`text-xs text-right font-medium truncate ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}
