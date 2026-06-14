import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { Patient, Doctor } from '../types';

// Define a unified User model for Backoffice
interface BackofficeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Bệnh nhân' | 'Bác sĩ' | 'Kỹ thuật viên' | 'Nhà nghiên cứu';
  avatarUrl: string;
  status: 'Active' | 'Locked';
  gender?: 'Nam' | 'Nữ';
  age?: number;
  bloodGroup?: string;
  address?: string;
  medicalHistory?: string;
  specialty?: string;
  experience?: string;
  lastActive: string;
  ipAddress: string;
}

interface AdminUsersViewProps {
  patients: Patient[];
  doctors: Doctor[];
  addSystemLog: (action: string, moduleName: string, details: string) => void;
}

export default function AdminUsersView({ patients, doctors, addSystemLog }: AdminUsersViewProps) {
  // Synthesize our unified list of users
  const [usersList, setUsersList] = useState<BackofficeUser[]>(() => {
    const list: BackofficeUser[] = [];
    
    // Convert patients to BackofficeUsers
    patients.forEach((p, idx) => {
      // Nguyễn Văn An should remain standard active, but let's have some other locked/active users
      list.push({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: 'Bệnh nhân',
        avatarUrl: p.avatarUrl,
        status: p.id === 'PT-4432' ? 'Locked' : 'Active', // Let card PT-4432 be initially locked
        gender: p.gender,
        age: p.age,
        bloodGroup: p.bloodGroup,
        address: p.address,
        medicalHistory: p.medicalHistory,
        lastActive: p.lastVisit,
        ipAddress: `192.168.1.${10 + idx}`
      });
    });

    // Convert doctors to BackofficeUsers
    doctors.forEach((d, idx) => {
      list.push({
        id: d.id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        role: 'Bác sĩ',
        avatarUrl: d.avatarUrl,
        status: 'Active',
        specialty: d.specialty,
        experience: d.experience,
        lastActive: '2026-06-07',
        ipAddress: `192.168.1.${50 + idx}`
      });
    });

    // Add researcher bonus
    list.push({
      id: 'RES-049',
      name: 'TS. Nguyễn Văn Khải',
      email: 'khai.nguyen@neuroscan.vn',
      phone: '0933221155',
      role: 'Nhà nghiên cứu',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      status: 'Active',
      specialty: 'Y sinh học nano',
      experience: '12 năm nghiên cứu',
      lastActive: '2026-06-05',
      ipAddress: '192.168.1.99'
    });

    return list;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<BackofficeUser | null>(null);

  // Lock user handler (ADM-04)
  const handleLockUser = (userId: string) => {
    setUsersList(prev => 
      prev.map(u => {
        if (u.id === userId) {
          addSystemLog(
            'Khóa tài khoản',
            'System',
            `Đã khóa truy cập của người dùng ${u.name} (ID: ${u.id}) do vi phạm chính sách.`
          );
          
          const updated = { ...u, status: 'Locked' as const };
          if (selectedUser?.id === userId) {
            setSelectedUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
  };

  // Unlock user handler (ADM-05)
  const handleUnlockUser = (userId: string) => {
    setUsersList(prev => 
      prev.map(u => {
        if (u.id === userId) {
          addSystemLog(
            'Mở khóa tài khoản',
            'System',
            `Đã phục hồi quyền đăng nhập cho người dùng ${u.name} (ID: ${u.id}).`
          );
          
          const updated = { ...u, status: 'Active' as const };
          if (selectedUser?.id === userId) {
            setSelectedUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
  };

  // Filter accounts
  const filteredUsers = usersList.filter(u => {
    const query = searchQuery.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(query) || 
                        u.email.toLowerCase().includes(query) || 
                        u.id.toLowerCase().includes(query) || 
                        u.phone.includes(query);
    const matchRole = roleFilter === '' || u.role === roleFilter;
    const matchStatus = statusFilter === '' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs flex justify-between items-center">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Quản lý Tài Khoản & Khóa User</h2>
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
          <option value="Bệnh nhân">Bệnh nhân</option>
          <option value="Bác sĩ">Bác sĩ</option>
          <option value="Nhà nghiên cứu">Nhà nghiên cứu</option>
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">Không tìm thấy người dùng nào phù hợp.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className={`hover:bg-blue-50/20 cursor-pointer transition-colors ${
                        selectedUser?.id === user.id ? 'bg-blue-50/50' : ''
                      } ${user.status === 'Locked' ? 'bg-red-50/20 opacity-80' : ''}`}
                    >
                      {/* ID */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700">
                        {user.id}
                      </td>

                      {/* Avatar & Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={user.avatarUrl} 
                            alt={user.name} 
                            referrerPolicy="no-referrer"
                            className="w-8.5 h-8.5 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <span className="font-extrabold text-slate-800 hover:text-blue-600 transition-colors block">{user.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">IP: {user.ipAddress}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold ${
                          user.role === 'Bác sĩ' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          user.role === 'Bệnh nhân' ? 'bg-blue-50 text-blue-700 border border-blue-105' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {user.role}
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
                            {user.phone}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          user.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
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
            {selectedUser && (
              <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold text-[9.5px]">
                {selectedUser.id}
              </span>
            )}
          </div>

          {selectedUser ? (
            <div className="space-y-5" id="user-details-pane">
              {/* Header card with avatar */}
              <div className="flex items-center gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <img 
                  src={selectedUser.avatarUrl} 
                  alt={selectedUser.name} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <div>
                  <h4 className="text-sm font-extrabold text-slate-850 leading-tight">{selectedUser.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{selectedUser.role}</p>
                </div>
              </div>

              {/* Specific detail tables */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Email liên hệ</span>
                  <span className="text-slate-700 font-bold">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Số điện thoại</span>
                  <span className="text-slate-700 font-bold">{selectedUser.phone}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Trạng thái bảo mật</span>
                  <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${
                    selectedUser.status === 'Active' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                  }`}>
                    {selectedUser.status}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Địa chỉ IP đăng nhập</span>
                  <span className="text-slate-700 font-mono font-bold">{selectedUser.ipAddress}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Hoạt động lần cuối</span>
                  <span className="text-slate-600 font-semibold">{selectedUser.lastActive}</span>
                </div>

                {/* Patient-specific specs */}
                {selectedUser.role === 'Bệnh nhân' && (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Giới tính / Tuổi</span>
                      <span className="text-slate-700 font-bold">{selectedUser.gender} • {selectedUser.age} tuổi</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Nhóm máu</span>
                      <span className="text-slate-700 font-bold">{selectedUser.bloodGroup || 'Không có dữ liệu'}</span>
                    </div>
                    <div className="space-y-1 py-1.5 border-b border-dashed border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Địa chỉ liên hệ</span>
                      <span className="text-slate-650 font-medium block leading-normal">{selectedUser.address}</span>
                    </div>
                    <div className="space-y-1 py-1.5">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">Tiền sử lâm sàng</span>
                      <p className="text-slate-650 font-medium leading-relaxed bg-blue-50/30 p-2.5 rounded-lg border border-blue-105/50 italic">
                        "{selectedUser.medicalHistory || 'Chưa cập nhật sơ đồ bệnh sử.'}"
                      </p>
                    </div>
                  </>
                )}

                {/* Doctor-specific specs */}
                {selectedUser.role === 'Bác sĩ' && (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Phân khoa chính</span>
                      <span className="text-[#0d9488] font-bold">{selectedUser.specialty}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Thâm niên lâm nghiệp</span>
                      <span className="text-slate-755 font-bold">{selectedUser.experience}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Actions inside detailed card */}
              <div className="pt-4 border-t border-slate-100 flex gap-2">
                {selectedUser.status === 'Active' ? (
                  <button 
                    onClick={() => handleLockUser(selectedUser.id)}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Khóa Tài Khoản</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleUnlockUser(selectedUser.id)}
                    className="flex-1 bg-emerald-55 text-white hover:bg-emerald-600 py-2 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10"
                  >
                    <Unlock className="w-4 h-4 shrink-0" />
                    <span>Mở Khóa Quy Thư</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center p-4">
              <User className="w-10 h-10 text-slate-350 stroke-[1.5] mb-2" />
              <p className="text-xs font-bold text-slate-500">Chưa Chọn Hồ sơ</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Click chọn bất kỳ người dùng nào bên bảng danh sách để tra cứu sâu thông tin bảo mật chuẩn HIPAA.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
