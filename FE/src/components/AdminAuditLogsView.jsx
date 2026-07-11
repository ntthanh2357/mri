import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  Download,
  ShieldAlert,
  Lock,
  Eye,
  Users,
  FileText,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

// No props needed — component self-fetches
export default function AdminAuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [anonymizing, setAnonymizing] = useState(false);
  const [anonymizeError, setAnonymizeError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const [hospitals, setHospitals] = useState([]);
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch current user and hospitals list
  useEffect(() => {
    apiRequest('/auth/me')
      .then((data) => {
        if (data && data.user) {
          const isUserAdmin = data.user.role === 'admin';
          setIsAdmin(isUserAdmin);
          if (isUserAdmin) {
            apiRequest('/admin/hospitals')
              .then((res) => setHospitals(res.hospitals ?? []))
              .catch(err => console.error('Failed to load hospitals:', err));
          }
        }
      })
      .catch(err => console.error('Failed to load profile:', err));
  }, []);

  // ─── Fetch logs ────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = hospitalFilter !== 'all' ? `/admin/audit-logs?hospitalId=${hospitalFilter}` : '/admin/audit-logs';
      const data = await apiRequest(url);
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tải audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ─── Anonymize ─────────────────────────────────────────────────────────────
  const handleAnonymize = async () => {
    setAnonymizing(true);
    setAnonymizeError(null);
    try {
      await apiRequest('/admin/anonymize', {
        method: 'POST',
      });
      // Reload log list on success
      await fetchLogs();
    } catch (err) {
      setAnonymizeError(err.message || 'Ẩn danh dữ liệu thất bại');
    } finally {
      setAnonymizing(false);
    }
  };

  // ─── Derived / filter ──────────────────────────────────────────────────────
  const entitiesAvailable = Array.from(new Set(logs.map((l) => l.entity)));

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      log.performedBy.toLowerCase().includes(q) ||
      (log.details ?? '').toLowerCase().includes(q);

    const matchesEntity = entityFilter === 'all' || log.entity === entityFilter;

    return matchesSearch && matchesEntity;
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getEntityIcon = (entity) => {
    switch (entity) {
      case 'User':
        return <Users className="w-3.5 h-3.5" />;
      case 'Dataset':
        return <Database className="w-3.5 h-3.5" />;
      case 'AuditLog':
        return <ClipboardList className="w-3.5 h-3.5" />;
      case 'Patient':
      case 'MedicalRecord':
        return <FileText className="w-3.5 h-3.5" />;
      default:
        return <Eye className="w-3.5 h-3.5" />;
    }
  };

  const formatDate = (value) => {
    try {
      return new Date(value).toLocaleString('vi-VN');
    } catch {
      return String(value);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-md shadow-slate-500/20">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Audit Logs & Tuân thủ</h2>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Theo dõi hoạt động hệ thống và quản lý ẩn danh dữ liệu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAnonymize}
            disabled={anonymizing || loading}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {anonymizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            {anonymizing ? 'Đang xử lý...' : 'Ẩn danh dữ liệu (HIPAA)'}
          </button>
        </div>
      </div>

      {/* Anonymize error banner */}
      {anonymizeError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {anonymizeError}
        </div>
      )}

      {/* Compliance Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Quy trình ẩn danh dữ liệu (HIPAA)
                </h3>
                <p className="text-xs text-slate-300">
                  Loại bỏ các thông tin nhận dạng cá nhân (PII) khỏi hồ sơ bệnh án
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">
                Ẩn Họ Tên
              </span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">
                Masking SĐT
              </span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">
                Redact Email
              </span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">
                Giấu địa chỉ
              </span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
              Trạng thái
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-bold text-emerald-400">Sẵn sàng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm log theo hành động, entity, người thực hiện..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium"
          />
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="all">Tất cả bệnh viện</option>
              {hospitals.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Tất cả entity</option>
            {entitiesAvailable.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <button className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs overflow-hidden">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang tải audit logs...
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-sm font-semibold text-slate-700">Không thể tải logs</p>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchLogs}
              className="mt-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#f8fafc]">
                <tr className="text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Thời gian</th>
                  <th className="text-left px-4 py-3 font-semibold">Người thực hiện</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-semibold">Bệnh viện</th>}
                  <th className="text-left px-4 py-3 font-semibold">Entity</th>
                  <th className="text-left px-4 py-3 font-semibold">Hành động</th>
                  <th className="text-left px-4 py-3 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf5]">
                {filteredLogs.map((log) => (
                  <tr
                    key={log._id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[#f8fafc]/60 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4 text-[10.5px] text-slate-400 font-mono whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {log.performedByName || log.performedBy}
                        </span>
                        {log.performedByEmail && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.performedByEmail}
                          </span>
                        )}
                      </div>
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-4">
                        <span className="text-xs font-semibold text-slate-700">
                          {log.hospitalName || "Hệ thống"}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-700 text-[10.5px] font-bold">
                        {getEntityIcon(log.entity)}
                        {log.entity}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-xs font-medium text-slate-800">{log.action}</p>
                    </td>

                    <td className="px-4 py-4 max-w-xs">
                      <p className="text-[10px] text-slate-400 truncate">{log.details}</p>
                    </td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ClipboardList className="w-8 h-8 opacity-40" />
                        <p className="text-xs font-medium">
                          {searchQuery || entityFilter !== 'all'
                            ? 'Không tìm thấy log nào phù hợp với bộ lọc.'
                            : 'Chưa có log nào.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono text-sm">
                  {selectedLog._id}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {formatDate(selectedLog.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                    Người thực hiện
                  </span>
                  <p className="text-slate-800 font-bold font-mono break-all">
                    {selectedLog.performedBy}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                    Entity ID
                  </span>
                  <p className="text-slate-800 font-bold font-mono break-all">
                    {selectedLog.entityId}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                  Entity
                </span>
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  {getEntityIcon(selectedLog.entity)}
                  {selectedLog.entity}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                  Hành động
                </span>
                <p className="text-slate-800 font-medium">{selectedLog.action}</p>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">
                  Chi tiết
                </span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedLog.details || '—'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
