import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Check,
  X,
  FileText,
  Search,
  ShieldCheck,
  AlertCircle,
  Award,
  ExternalLink,
  ChevronDown,
  Building,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDoctorsView() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Per-doctor action error (keyed by doctor _id)
  const [actionErrors, setActionErrors] = useState({});
  // Per-doctor action in-progress flag
  const [actionLoading, setActionLoading] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);

  // -------------------------------------------------------------------------
  // Fetch doctors on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/doctors');
      setDoctors(data.doctors);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải danh sách bác sĩ');
      // Ensure no stale list is shown on error
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Verify / Unverify
  // -------------------------------------------------------------------------
  const handleVerify = async (doctor, verified) => {
    const id = doctor._id;

    setActionLoading(prev => ({ ...prev, [id]: true }));
    setActionErrors(prev => ({ ...prev, [id]: '' }));

    try {
      const data = await apiRequest(
        `/admin/doctors/${id}/verify`,
        {
          method: 'PUT',
          body: JSON.stringify({ verified }),
        },
      );

      // Update in-place — no full page reload
      setDoctors(prev =>
        prev.map(d => (d._id === id ? { ...d, isVerified: data.doctor.isVerified } : d)),
      );

      // Keep the detail pane in sync
      setSelectedDoc(prev =>
        prev?._id === id ? { ...prev, isVerified: data.doctor.isVerified } : prev,
      );
    } catch (err) {
      setActionErrors(prev => ({
        ...prev,
        [id]: err.message || 'Đã xảy ra lỗi khi cập nhật trạng thái xác minh',
      }));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // -------------------------------------------------------------------------
  // Derived / helpers
  // -------------------------------------------------------------------------
  const filteredDocs = doctors.filter(d => {
    const query = searchQuery.toLowerCase();
    const name = d.profile?.name?.toLowerCase() ?? '';
    const email = d.email.toLowerCase();
    const matchSearch = name.includes(query) || email.includes(query);
    const matchStatus =
      statusFilter === '' ||
      (statusFilter === 'Verified' && d.isVerified) ||
      (statusFilter === 'Pending' && !d.isVerified);
    return matchSearch && matchStatus;
  });

  const pendingCount = doctors.filter(d => !d.isVerified).length;

  const avatarFallback =
    'https://ui-avatars.com/api/?background=e2e8f0&color=475569&name=Dr&size=120';

  const avatarSrc = (doc) => doc.profile?.photoUrl || avatarFallback;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* View Header */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs flex justify-between items-center">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">
            Duyệt Chứng Chỉ Hành Nghề (CCHN) Bác Sĩ
          </h2>
          <p className="text-slate-405 text-xs">
            Cơ sở dữ liệu xem xét, xác thực danh tính lâm sàng &amp; cấp mã chuyên môn khám chữa
            bệnh trước khi cho phép khai thác AI (Mã Task: ADM-03)
          </p>
        </div>
        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 font-bold px-3 py-1 rounded-lg shrink-0">
          Chờ duyệt CCHN: {pendingCount} trường hợp
        </span>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 text-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm theo tên bác sĩ, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 w-full sm:w-48"
        >
          <option value="">Tất cả Trạng thái duyệt</option>
          <option value="Pending">Chờ duyệt (Pending)</option>
          <option value="Verified">Đã duyệt (Verified)</option>
        </select>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left — Doctors list */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
            <h3 className="text-sm font-bold text-slate-850 mb-4 font-sans">
              Yêu Cầu Xét Phê Duyệt CCHN
            </h3>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-bold">Đang tải danh sách bác sĩ...</span>
              </div>
            )}

            {/* Fetch error */}
            {!loading && error && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">Không thể tải danh sách bác sĩ</p>
                  <p className="text-[11px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && filteredDocs.length === 0 && doctors.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-bold text-xs">
                Chưa có bác sĩ nào
              </div>
            )}

            {/* No results after filter */}
            {!loading && !error && doctors.length > 0 && filteredDocs.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-bold text-xs">
                Không có hồ sơ nào khớp với bộ lọc.
              </div>
            )}

            {/* Doctor cards */}
            {!loading && !error && filteredDocs.length > 0 && (
              <div className="space-y-3">
                {filteredDocs.map(doc => (
                  <div
                    key={doc._id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-xs ${
                      selectedDoc?._id === doc._id
                        ? 'border-blue-500 bg-blue-50/10'
                        : 'border-slate-150 bg-[#fbfcfd]/40'
                    } ${doc.isVerified ? 'border-emerald-100' : ''}`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <img
                          src={avatarSrc(doc)}
                          alt={doc.profile?.name || doc.email}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-3xs"
                          onError={e => {
                            e.currentTarget.src = avatarFallback;
                          }}
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                            doc.isVerified ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                          }`}
                        >
                          {doc.isVerified ? '✓' : '?'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-800 leading-none">
                            {doc.profile?.name || '(Chưa cập nhật tên)'}
                          </h4>
                        </div>
                        <p className="text-slate-450 text-xs font-semibold">{doc.email}</p>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span
                            className={`text-[9.5px] px-2 py-0.5 rounded font-bold uppercase border ${
                              doc.isVerified
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                          >
                            {doc.isVerified ? 'Verified' : 'Pending'}
                          </span>
                          {doc.profile?.licenseUrl && (
                            <a
                              href={doc.profile.licenseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[9.5px] text-blue-600 flex items-center gap-0.5 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Xem CCHN
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      className="mt-3 sm:mt-0 flex sm:flex-col items-end gap-2 shrink-0 border-t sm:border-0 pt-2.5 sm:pt-0 border-slate-100"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Per-doctor action error */}
                      {actionErrors[doc._id] && (
                        <p className="text-[10px] text-rose-600 font-bold max-w-[160px] text-right">
                          {actionErrors[doc._id]}
                        </p>
                      )}

                      {actionLoading[doc._id] ? (
                        <span className="flex items-center gap-1 text-xs text-slate-400 font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Đang xử lý...
                        </span>
                      ) : doc.isVerified ? (
                        <button
                          onClick={() => handleVerify(doc, false)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Hủy duyệt</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(doc, true)}
                          className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Phê Duyệt</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Detail pane */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-800 font-sans">Chi Tiết Bác Sĩ</h3>
            <Award className="w-4.5 h-4.5 text-blue-500" />
          </div>

          {selectedDoc ? (
            <div className="space-y-5">

              {/* Doctor header */}
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                <img
                  src={avatarSrc(selectedDoc)}
                  alt={selectedDoc.profile?.name || selectedDoc.email}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                  onError={e => {
                    e.currentTarget.src = avatarFallback;
                  }}
                />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-850 leading-tight">
                    {selectedDoc.profile?.name || '(Chưa cập nhật tên)'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{selectedDoc.email}</p>
                </div>
              </div>

              {/* Detail fields */}
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Trạng thái</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      selectedDoc.isVerified
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {selectedDoc.isVerified ? 'Đã xác minh' : 'Chờ duyệt'}
                  </span>
                </div>
                {selectedDoc.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Điện thoại</span>
                    <span className="text-slate-700 font-semibold">{selectedDoc.phone}</span>
                  </div>
                )}
                {selectedDoc.profile?.licenseUrl && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold">Tài liệu CCHN</span>
                    <a
                      href={selectedDoc.profile.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold flex items-center gap-1 hover:underline text-[10px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Xem tài liệu
                    </a>
                  </div>
                )}
                {selectedDoc.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Ngày tạo</span>
                    <span className="text-slate-700 font-semibold">
                      {new Date(selectedDoc.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Per-doctor action error shown in detail pane too */}
              {actionErrors[selectedDoc._id] && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold">{actionErrors[selectedDoc._id]}</p>
                </div>
              )}

              {/* Verify / Unverify action */}
              <div className="pt-3 border-t border-slate-100">
                {actionLoading[selectedDoc._id] ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-bold">Đang xử lý...</span>
                  </div>
                ) : selectedDoc.isVerified ? (
                  <button
                    onClick={() => handleVerify(selectedDoc, false)}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Hủy duyệt (Unverify)
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerify(selectedDoc, true)}
                    className="w-full bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Phê Duyệt
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center p-4">
              <FileText className="w-10 h-10 text-slate-350 stroke-[1.5] mb-2" />
              <p className="text-xs font-bold text-slate-500">Chưa Chọn Bác Sĩ</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                Hãy click chọn một bác sĩ bên bảng danh sách để xem chi tiết và thực hiện xét duyệt.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
