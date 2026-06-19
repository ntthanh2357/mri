import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  ShieldAlert,
  Mail,
  Phone,
  MapPin,
  FileText,
  X,
  User,
  Activity,
  Calendar,
  Lock,
  Unlock,
  Plus,
  Loader2,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

// Map an API user to the BackofficeUser list row shape
function mapApiUser(u) {
  return {
    id: u._id,
    name: u.profile?.name || u.email,
    email: u.email,
    phone: u.profile?.phone || u.phone || '',
    role: u.role,
    avatarUrl:
      u.profile?.photoUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(u.profile?.name || u.email)}&background=e2e8f0&color=475569&bold=true`,
    status: u.isLocked ? 'Locked' : 'Active',
    lastActive: u.createdAt,
  };
}

// Map an API user to the ApiUserDetail shape used by the detail panel
function mapApiUserDetail(u) {
  return {
    _id: u._id,
    email: u.email,
    phone: u.profile?.phone || u.phone || '',
    role: u.role,
    isVerified: u.isVerified,
    isLocked: u.isLocked,
    profile: u.profile,
    createdAt: u.createdAt,
  };
}

// Human-readable role label
function roleLabel(role) {
  switch (role) {
    case 'patient':
      return 'Bệnh nhân';
    case 'doctor':
      return 'Bác sĩ';
    case 'admin':
      return 'Quản trị viên';
    default:
      return role;
  }
}

export default function AdminUsersView() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [actionError, setActionError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ─── 8.1  Fetch user list on mount ────────────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest('/admin/users');
        setUsersList((data.users ?? []).map(mapApiUser));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách người dùng.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // ─── 8.2  Fetch user detail when a row is clicked ─────────────────────────
  const handleSelectUser = async (userId) => {
    setSelectedUserId(userId);
    setSelectedUserDetail(null);
    setDetailError(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      const data = await apiRequest(`/admin/users/${userId}`);
      setSelectedUserDetail(mapApiUserDetail(data.user));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Không thể tải chi tiết người dùng.');
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── 8.3  Lock action ─────────────────────────────────────────────────────
  const handleLockUser = async (userId) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/lock`, {
        method: 'PUT',
      });
      const updatedStatus = data.user.isLocked ? 'Locked' : 'Active';

      // Update list row
      setUsersList(prev =>
        prev.map(u => (u.id === userId ? { ...u, status: updatedStatus } : u))
      );

      // Update detail panel if it shows the same user
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isLocked: data.user.isLocked });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể khóa tài khoản.');
    }
  };

  // ─── 8.3  Unlock action ───────────────────────────────────────────────────
  const handleUnlockUser = async (userId) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/unlock`, {
        method: 'PUT',
      });
      const updatedStatus = data.user.isLocked ? 'Locked' : 'Active';

      // Update list row
      setUsersList(prev =>
        prev.map(u => (u.id === userId ? { ...u, status: updatedStatus } : u))
      );

      // Update detail panel if it shows the same user
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isLocked: data.user.isLocked });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể mở khóa tài khoản.');
    }
  };

  // ─── Verify action for admin ────────────────────────────────────────────────
  const handleVerifyUser = async (userId, verified) => {
    setActionError(null);
    try {
      const data = await apiRequest(`/admin/users/${userId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });

      // Update detail panel if it shows the same user
      if (selectedUserId === userId && selectedUserDetail) {
        setSelectedUserDetail({ ...selectedUserDetail, isVerified: data.user.isVerified });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái xác thực.');
    }
  };

  // ─── Filtered rows ────────────────────────────────────────────────────────
  const filteredUsers = usersList.filter(u => {
    const query = searchQuery.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.id.toLowerCase().includes(query) ||
      u.phone.includes(query);
    const matchRole = roleFilter === '' || u.role === roleFilter;
    const matchStatus = statusFilter === '' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs flex justify-between items-center">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Quản lý Tài Khoản &amp; Khóa User</h2>
          <p className="text-slate-400 text-xs">Phân hệ hiển thị, can thiệp khóa/mở quyền đăng nhập của y bác sĩ lẫn bệnh án B2C (ADM-01, ADM-02, ADM-04, ADM-05)</p>
        </div>
        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-bold px-3 py-1 rounded-lg">
          Tổng danh mục: {usersList.length} tài khoản
        </span>
      </div>

      {/* Control filters & search query */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 text-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm theo Mã ID, Tên, Số điện thoại, Email tài khoản..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
          />
        </div>

        {/* Filter Role */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 w-full lg:w-48"
        >
          <option value="">Tất cả các Role</option>
          <option value="patient">Bệnh nhân</option>
          <option value="doctor">Bác sĩ</option>
          <option value="admin">Quản trị viên</option>
        </select>

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 w-full lg:w-44"
        >
          <option value="">Tất cả Trạng thái</option>
          <option value="Active">Đang hoạt động (Active)</option>
          <option value="Locked">Đã bị Khóa (Locked)</option>
        </select>
      </div>

      {/* Main table and details flex */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Users Roster List Table (Covers ADM-01) */}
        <div className="xl:col-span-2 bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
          <h3 className="text-sm font-bold text-slate-850 mb-4 font-sans">Danh sách Người dùng Hệ thống</h3>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-250 text-slate-400 font-bold text-[10px] uppercase">
                  <th className="py-2.5 px-3">Mã số tài khoản</th>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Vai trò (Role)</th>
                  <th className="py-2.5 px-3">Thông tin liên lạc</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Tương tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-semibold">Đang tải danh sách người dùng…</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <p className="text-xs font-bold text-rose-500">{error}</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                      Không tìm thấy người dùng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => handleSelectUser(user.id)}
                      className={`hover:bg-blue-50/20 cursor-pointer transition-colors ${
                        selectedUserId === user.id ? 'bg-blue-50/50' : ''
                      } ${user.status === 'Locked' ? 'bg-red-50/20 opacity-80' : ''}`}
                    >
                      {/* ID */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700">
                        <span className="truncate max-w-[100px] block" title={user.id}>{user.id}</span>
                      </td>

                      {/* Avatar & Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <span className="font-extrabold text-slate-800 hover:text-blue-600 transition-colors block">{user.name}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold ${
                          user.role === 'doctor'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : user.role === 'patient'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : user.role === 'admin'
                            ? 'bg-violet-50 text-violet-700 border border-violet-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-3 text-slate-500 font-sans">
                        <div className="flex flex-col text-[11px] leading-tight">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {user.email}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {user.phone || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          user.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border border-rose-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {user.status}
                        </span>
                      </td>

                      {/* Interactive Buttons (ADM-04, ADM-05) */}
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1.5">
                          {user.status === 'Active' ? (
                            <button
                              onClick={() => handleLockUser(user.id)}
                              title="Khóa tài khoản này"
                              className="w-7 h-7 hover:bg-rose-50 text-slate-400 hover:text-rose-600 bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center shadow-3xs"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnlockUser(user.id)}
                              title="Mở khóa tài khoản"
                              className="w-7 h-7 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center shadow-3xs"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed User Panel / Information (Covers ADM-02) */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-800 font-sans">Chi tiết Hồ sơ Quản trị</h3>
            {selectedUserId && (
              <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold text-[9.5px] truncate max-w-[120px]" title={selectedUserId}>
                {selectedUserId}
              </span>
            )}
          </div>

          {/* Loading state for detail panel */}
          {detailLoading && (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-semibold">Đang tải thông tin…</span>
            </div>
          )}

          {/* Error state for detail panel */}
          {!detailLoading && detailError && (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-rose-200 rounded-xl bg-rose-50/30 text-center p-4">
              <p className="text-xs font-bold text-rose-500">{detailError}</p>
            </div>
          )}

          {/* No user selected yet */}
          {!detailLoading && !detailError && !selectedUserDetail && !selectedUserId && (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center p-4">
              <User className="w-10 h-10 text-slate-350 stroke-[1.5] mb-2" />
              <p className="text-xs font-bold text-slate-500">Chưa Chọn Hồ sơ</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Click chọn bất kỳ người dùng nào bên bảng danh sách để tra cứu sâu thông tin bảo mật chuẩn HIPAA.</p>
            </div>
          )}

          {/* Detail content */}
          {!detailLoading && !detailError && selectedUserDetail && (
            <div className="space-y-5" id="user-details-pane">

              {/* Inline action error */}
              {actionError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-rose-600">{actionError}</p>
                </div>
              )}

              {/* Header card with avatar */}
              <div className="flex items-center gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <img
                  src={
                    selectedUserDetail.profile?.photoUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      selectedUserDetail.profile?.name || selectedUserDetail.email
                    )}&background=e2e8f0&color=475569&bold=true`
                  }
                  alt={selectedUserDetail.profile?.name || selectedUserDetail.email}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <div>
                  <h4 className="text-sm font-extrabold text-slate-850 leading-tight">
                    {selectedUserDetail.profile?.name || selectedUserDetail.email}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {roleLabel(selectedUserDetail.role)}
                  </p>
                </div>
              </div>

              {/* Detail rows */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Email liên hệ</span>
                  <span className="text-slate-700 font-bold truncate max-w-[160px]" title={selectedUserDetail.email}>{selectedUserDetail.email}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Số điện thoại</span>
                  <span className="text-slate-700 font-bold">{selectedUserDetail.phone || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Địa chỉ</span>
                  <span className="text-slate-700 font-bold truncate max-w-[160px]" title={selectedUserDetail.profile?.address || '—'}>
                    {selectedUserDetail.profile?.address || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Trạng thái khóa</span>
                  <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${
                    selectedUserDetail.isLocked
                      ? 'text-rose-600 bg-rose-50 border border-rose-100'
                      : 'text-emerald-600 bg-emerald-50 border border-emerald-100'
                  }`}>
                    {selectedUserDetail.isLocked ? 'Locked' : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Xác minh danh tính</span>
                  <span className={`inline-flex items-center gap-1 font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${
                    selectedUserDetail.isVerified
                      ? 'text-blue-600 bg-blue-50 border border-blue-100'
                      : 'text-slate-500 bg-slate-50 border border-slate-200'
                  }`}>
                    {selectedUserDetail.isVerified
                      ? <><ShieldCheck className="w-3 h-3" /> Verified</>
                      : <><ShieldX className="w-3 h-3" /> Unverified</>
                    }
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Ngày tạo tài khoản</span>
                  <span className="text-slate-600 font-semibold">
                    {new Date(selectedUserDetail.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Bottom Actions inside detailed card */}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex gap-2">
                  {selectedUserDetail.isLocked ? (
                    <button
                      onClick={() => handleUnlockUser(selectedUserDetail._id)}
                      className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10"
                    >
                      <Unlock className="w-4 h-4 shrink-0" />
                      <span>Mở Khóa Tài Khoản</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLockUser(selectedUserDetail._id)}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Khóa Tài Khoản</span>
                    </button>
                  )}
                </div>

                {selectedUserDetail.role === 'admin' && (
                  <div className="flex">
                    {selectedUserDetail.isVerified ? (
                      <button
                        onClick={() => handleVerifyUser(selectedUserDetail._id, false)}
                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                      >
                        <ShieldX className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Hủy duyệt Quản lý bệnh viện</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyUser(selectedUserDetail._id, true)}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/10"
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0 text-white" />
                        <span>Duyệt Quản lý bệnh viện</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
