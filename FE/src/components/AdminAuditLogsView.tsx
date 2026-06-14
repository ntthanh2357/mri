import React, { useState } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  ShieldAlert,
  RefreshCw,
  Lock,
  Eye,
  Users,
  FileText,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { initialSystemLogs } from '../constants/mockData';
import { SystemLog } from '../types';

interface AdminAuditLogsViewProps {
  logs: SystemLog[];
  onTriggerAnonymization: () => void;
  onResetAnonymization: () => void;
  isPipelineRunning: boolean;
  setIsPipelineRunning: (running: boolean) => void;
}

export default function AdminAuditLogsView({ logs: propLogs, onTriggerAnonymization, onResetAnonymization, isPipelineRunning, setIsPipelineRunning }: AdminAuditLogsViewProps) {
  const [logs, setLogs] = useState<SystemLog[]>(initialSystemLogs as any); // use local log copy to allow adding
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Success' | 'Warning' | 'Error'>('all');
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [showAnonymizeModal, setShowAnonymizeModal] = useState(false);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesModule && matchesStatus;
  });

  const modulesAvailable = Array.from(new Set(logs.map(l => l.module)));

  // Icon helper for modules
  const getModuleIcon = (mod: string) => {
    switch (mod) {
      case 'Users':
        return <Users className="w-3.5 h-3.5" />;
      case 'Doctors':
        return <FileText className="w-3.5 h-3.5" />;
      case 'Datasets':
        return <Database className="w-3.5 h-3.5" />;
      case 'System':
        return <ShieldAlert className="w-3.5 h-3.5" />;
      default:
        return <Eye className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Success':
        return 'text-emerald-600 bg-emerald-50';
      case 'Warning':
        return 'text-amber-600 bg-amber-50';
      case 'Error':
        return 'text-rose-600 bg-rose-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  // Trigger anonymization pipeline with a fake loading state
  const handleStartPipeline = () => {
    setShowAnonymizeModal(true);
    setIsPipelineRunning(true);
    setTimeout(() => {
      onTriggerAnonymization();
      setIsPipelineRunning(false);
      setShowAnonymizeModal(false);

      // Add a system log entry
      const newLog: SystemLog = {
        id: `LOG-0${logs.length + 1}`,
        user: 'Admin Console',
        role: 'System',
        module: 'System',
        action: 'Anonymization Pipeline Executed',
        details: 'Đã chạy toàn bộ pipeline ẩn danh HIPAA cho toàn bộ hồ sơ bệnh nhân.',
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        ipAddress: '127.0.0.1',
        status: 'Success'
      };
      setLogs([newLog, ...logs]);
    }, 2000);
  };

  const handleResetData = () => {
    onResetAnonymization();
    const newLog: SystemLog = {
      id: `LOG-0${logs.length + 1}`,
      user: 'Admin Console',
      role: 'System',
      module: 'System',
      action: 'Data Restoration',
      details: 'Đã khôi phục dữ liệu về trạng thái gốc từ bản backup.',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      ipAddress: '127.0.0.1',
      status: 'Success'
    };
    setLogs([newLog, ...logs]);
  };

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
            <p className="text-slate-500 text-xs font-medium mt-0.5">Theo dõi hoạt động hệ thống và quản lý ẩn danh dữ liệu</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetData}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Khôi phục dữ liệu
          </button>
          <button
            onClick={handleStartPipeline}
            disabled={isPipelineRunning}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            {isPipelineRunning ? 'Đang chạy...' : 'Ẩn danh dữ liệu (HIPAA)'}
          </button>
        </div>
      </div>

      {/* Compliance Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quy trình ẩn danh dữ liệu (HIPAA)</h3>
                <p className="text-xs text-slate-300">Loại bỏ các thông tin nhận dạng cá nhân (PII) khỏi hồ sơ bệnh án</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">Ẩn Họ Tên</span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">Masking SĐT</span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">Redact Email</span>
              <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-700/50 text-slate-200 border border-slate-600/60">Giấu địa chỉ</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Trạng thái</p>
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
            placeholder="Tìm kiếm log theo hành động, chi tiết, người dùng..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Tất cả module</option>
            {modulesAvailable.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Success">Thành công</option>
            <option value="Warning">Cảnh báo</option>
            <option value="Error">Lỗi</option>
          </select>

          <button className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-[#f8fafc]">
              <tr className="text-[11px] text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">Thời gian</th>
                <th className="text-left px-4 py-3 font-semibold">Người dùng</th>
                <th className="text-left px-4 py-3 font-semibold">Module</th>
                <th className="text-left px-4 py-3 font-semibold">Hành động</th>
                <th className="text-left px-4 py-3 font-semibold">Trạng thái</th>
                <th className="text-right px-5 py-3 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8edf5]">
              {filteredLogs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-[#f8fafc]/60 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4 text-[10.5px] text-slate-400 font-mono">
                    {log.timestamp}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">{log.user}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{log.role}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-700 text-[10.5px] font-bold">
                      {getModuleIcon(log.module)}
                      {log.module}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-xs font-medium text-slate-800">{log.action}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-xs">{log.details}</p>
                  </td>

                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(log.status)}`}>
                      {log.status === 'Success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {log.status}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right text-[10.5px] text-slate-400 font-mono">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-xs">
                    Không tìm thấy log nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedLog.id}</h3>
                <p className="text-xs text-slate-400 font-medium">{selectedLog.timestamp}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Người dùng</span>
                  <p className="text-slate-800 font-bold">{selectedLog.user}</p>
                  <p className="text-slate-500">{selectedLog.role}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Địa chỉ IP</span>
                  <p className="text-slate-800 font-bold font-mono">{selectedLog.ipAddress}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Module</span>
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  {getModuleIcon(selectedLog.module)}
                  {selectedLog.module}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Hành động</span>
                <p className="text-slate-800 font-medium">{selectedLog.action}</p>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Chi tiết</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedLog.details}
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

      {/* Anonymization Pipeline Modal */}
      {showAnonymizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
              {isPipelineRunning ? (
                <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {isPipelineRunning ? 'Đang chạy pipeline ẩn danh...' : 'Hoàn thành!'}
            </h3>
            <p className="text-xs text-slate-500">
              {isPipelineRunning ? 'Vui lòng đợi trong giây lát, hệ thống đang xử lý các hồ sơ bệnh án...' : 'Đã ẩn danh toàn bộ dữ liệu PII theo chuẩn HIPAA.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
