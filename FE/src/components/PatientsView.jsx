import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Heart, 
  History, 
  Activity,
  Edit,
  Trash2,
  Calendar,
  DollarSign
} from 'lucide-react';

const PatientsView = ({
  patients,
  appointments,
  prescriptions,
  invoices,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  editingPatient,
  onSetEditingPatient
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPatientEHR, setSelectedPatientEHR] = useState(null);
  const [activeEHRSubTab, setActiveEHRSubTab] = useState('info');

  // Add Patient Form State
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    email: '',
    age: 30,
    gender: 'Nam',
    bloodGroup: 'O+',
    address: '',
    medicalHistory: '',
    status: 'Active'
  });

  // Edit Patient handles
  const handleUpdatePatientSubmit = (e) => {
    e.preventDefault();
    if (editingPatient) {
      onEditPatient(editingPatient);
      onSetEditingPatient(null);
    }
  };

  const handleCreatePatientSubmit = (e) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone) {
      alert('Vui lòng điền Tên và Số điện thoại!');
      return;
    }
    const created = {
      id: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newPatient.name,
      avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60`,
      email: newPatient.email || `${newPatient.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      phone: newPatient.phone,
      age: Number(newPatient.age),
      gender: newPatient.gender,
      bloodGroup: newPatient.bloodGroup,
      address: newPatient.address || 'Chưa cập nhật địa chỉ',
      lastVisit: new Date().toISOString().substring(0, 10),
      medicalHistory: newPatient.medicalHistory || 'Chưa ghi nhận tiền sử bệnh lý trọng yếu',
      status: newPatient.status
    };
    onAddPatient(created);
    setShowAddForm(false);
    setNewPatient({
      name: '',
      phone: '',
      email: '',
      age: 30,
      gender: 'Nam',
      bloodGroup: 'O+',
      address: '',
      medicalHistory: '',
      status: 'Active'
    });
  };

  const filteredPatients = patients.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      p.email.toLowerCase().includes(query)
    );
  });

  // Extract medical relations of selected patient
  const patientAppointments = selectedPatientEHR 
    ? appointments.filter(a => a.patientId === selectedPatientEHR.id)
    : [];

  const patientPrescriptions = selectedPatientEHR
    ? prescriptions.filter(p => p.patientName === selectedPatientEHR.name)
    : [];

  const patientInvoices = selectedPatientEHR
    ? invoices.filter(i => i.patientId === selectedPatientEHR.id)
    : [];

  return (
    <div className="space-y-6 relative">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-3xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Quản lý Hồ Sơ Bệnh Nhân (EMR)</h2>
          <p className="text-slate-400 text-xs">Thêm mới bệnh án, theo dõi tiền sử lâm sàng tích hợp chuẩn y tế</p>
        </div>
        <button 
          onClick={() => {
            setShowAddForm(true);
            onSetEditingPatient(null);
          }}
          className="bg-[#0d9488] hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Bệnh Nhân</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Tìm bệnh nhân bằng Tên, Mã định danh PT, Số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-150 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 transition-all font-medium"
          />
        </div>
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-3xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold text-[10px] uppercase">
                <th className="py-3 px-4">Mã Bệnh Nhân</th>
                <th className="py-3 px-4">Thông tin cơ bản</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4 text-center">Giới tính & Tuổi</th>
                <th className="py-3 px-4 text-center">Máu</th>
                <th className="py-3 px-4">Lần khám cuối</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Hồ sơ</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không tìm thấy bệnh nhân nào khớp với từ khóa tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-teal-600 font-mono">
                      {p.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={p.avatarUrl} 
                          alt={p.name} 
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200" 
                        />
                        <div>
                          <div className="font-extrabold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-400">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {p.phone}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div>{p.age} tuổi</div>
                      <div className={`text-[10px] font-bold ${p.gender === 'Nam' ? 'text-blue-500' : 'text-pink-500'}`}>
                        {p.gender}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-rose-50 text-rose-600 border border-rose-100 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono">
                        {p.bloodGroup}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {p.lastVisit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'Active' ? 'bg-teal-50 text-teal-600' : 'bg-slate-150 text-slate-500'
                      }`}>
                        {p.status === 'Active' ? 'Đang khám điều trị' : 'Tạm thời ngừng'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedPatientEHR(p);
                          setActiveEHRSubTab('info');
                        }}
                        className="bg-teal-50 hover:bg-teal-100 text-[#0d9488] font-bold px-3 py-1 rounded-lg text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Xem EMR</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => {
                            onSetEditingPatient(p);
                            setShowAddForm(false);
                          }}
                          className="p-1.5 hover:bg-teal-50 hover:text-[#0d9488] rounded-md transition-colors text-slate-400"
                          title="Sửa thông tin"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân ${p.name} không?`)) {
                              onDeletePatient(p.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-colors text-slate-400"
                          title="Xóa bệnh nhân"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over EHR Dossier Detail Dialog */}
      {selectedPatientEHR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-3xs z-50 flex justify-right animate-fade-in">
          <div className="w-full max-w-3xl bg-slate-50 h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200">
            {/* EHR Header */}
            <div className="bg-[#0d9488] text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img 
                  src={selectedPatientEHR.avatarUrl} 
                  alt={selectedPatientEHR.name} 
                  className="w-12 h-12 rounded-full border-2 border-white/50 object-cover" 
                />
                <div>
                  <div className="text-xs bg-teal-800 text-teal-100 px-2 py-0.5 rounded font-mono font-bold w-fit mb-0.5">
                    HỒ SƠ BỆNH ÁN ĐIỆN TỬ {selectedPatientEHR.id}
                  </div>
                  <h3 className="text-base font-extrabold">{selectedPatientEHR.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPatientEHR(null)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* EHR Dossier Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 px-4 flex gap-1.5">
              <button 
                onClick={() => setActiveEHRSubTab('info')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 ${
                  activeEHRSubTab === 'info' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Hành chính & Tiền sử
              </button>
              <button 
                onClick={() => setActiveEHRSubTab('appointments')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 ${
                  activeEHRSubTab === 'appointments' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Sổ tay Lịch hẹn ({patientAppointments.length})
              </button>
              <button 
                onClick={() => setActiveEHRSubTab('prescriptions')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 ${
                  activeEHRSubTab === 'prescriptions' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Toa thuốc điện tử ({patientPrescriptions.length})
              </button>
              <button 
                onClick={() => setActiveEHRSubTab('billing')}
                className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 ${
                  activeEHRSubTab === 'billing' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Hóa đơn viện phí ({patientInvoices.length})
              </button>
            </div>

            {/* EHR Dossier Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {activeEHRSubTab === 'info' && (
                <div className="space-y-4">
                  {/* Bio details Grid */}
                  <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Họ và Tên</span>
                        <span className="font-bold text-slate-800">{selectedPatientEHR.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Số điện thoại liên hệ</span>
                        <span className="font-bold text-slate-800">{selectedPatientEHR.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Hòm thư điện tử</span>
                        <span className="font-bold text-slate-850 truncate">{selectedPatientEHR.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Địa chỉ cư trú</span>
                        <span className="font-bold text-slate-800">{selectedPatientEHR.address}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Nhóm máu</span>
                        <span className="font-extrabold text-rose-600 font-mono">{selectedPatientEHR.bloodGroup}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Trạng thái điều mạch</span>
                        <span className="font-bold">{selectedPatientEHR.status === 'Active' ? 'Đang khám điều trị nội bộ' : 'Tạm thời kết thúc hồ sơ'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Medical History */}
                  <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-3xs space-y-2">
                    <h4 className="text-xs font-extrabold text-[#0d9488] flex items-center gap-1.5 border-b border-slate-50 pb-2">
                      <History className="w-4 h-4" />
                      <span>Chi tiết Bệnh lý & Tiền sử Lâm sàng</span>
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold bg-teal-50/20 p-3 rounded-lg border border-teal-500/10">
                      {selectedPatientEHR.medicalHistory}
                    </p>
                  </div>
                </div>
              )}

              {activeEHRSubTab === 'appointments' && (
                <div className="space-y-3">
                  {patientAppointments.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">Không tìm thấy lịch sử hẹn khám nào của bệnh nhân này.</div>
                  ) : (
                    patientAppointments.map((apt) => (
                      <div key={apt.id} className="bg-white border border-slate-150 p-3.5 rounded-xl shadow-3xs">
                        <div className="flex justify-between items-center mb-2">
                          <span className="bg-teal-50 text-[#0d9488] px-2.5 py-0.5 rounded font-bold font-mono text-[9px]">
                            {apt.date} | {apt.time}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            apt.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : apt.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {apt.status === 'Approved' ? 'Đã duyệt' : apt.status === 'Pending' ? 'Đang chờ' : 'Đã hủy'}
                          </span>
                        </div>
                        <div className="text-xs">
                          <div className="font-bold text-slate-800">{apt.doctorName}</div>
                          <div className="text-slate-400 text-[10px]">{apt.doctorSpecialty}</div>
                          <p className="text-slate-500 italic mt-1.5 font-medium">" {apt.reason} "</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeEHRSubTab === 'prescriptions' && (
                <div className="space-y-4">
                  {patientPrescriptions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">Chưa có toa thuốc điện tử nào được lập cho bệnh nhân này.</div>
                  ) : (
                    patientPrescriptions.map((rx) => (
                      <div key={rx.id} className="bg-white border border-slate-150 p-4 rounded-xl shadow-3xs space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">ĐƠN THUỐC ĐIỆN TỬ</span>
                            <span className="font-bold text-slate-850 text-xs">{rx.id}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold block">Ngày kê đơn</span>
                            <span className="font-bold text-slate-800 text-xs">{rx.date}</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600">
                          <div className="font-bold text-purple-600">Chẩn đoán lâm sàng:</div>
                          <p className="italic">{rx.diagnosis}</p>
                        </div>

                        <div className="space-y-1.5 border-t border-slate-50 pt-2">
                          <div className="text-xs font-bold text-slate-800">Dược chất chỉ định:</div>
                          <div className="space-y-2">
                            {rx.medications.map((med, idx) => (
                              <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex justify-between gap-4 text-xs">
                                <div>
                                  <div className="font-extrabold text-slate-800">{med.name}</div>
                                  <div className="text-slate-400 text-[10px]">Chỉ dẫn: {med.note}</div>
                                </div>
                                <div className="text-right text-[10px] font-bold text-teal-700">
                                  <div>{med.dosage} ({med.frequency})</div>
                                  <div>Dùng trong: {med.duration}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeEHRSubTab === 'billing' && (
                <div className="space-y-3">
                  {patientInvoices.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">Không có hóa đơn viện phí nào cần được hiển thị.</div>
                  ) : (
                    patientInvoices.map((inv) => (
                      <div key={inv.id} className="bg-white border border-slate-150 p-3.5 rounded-xl shadow-3xs flex justify-between items-center">
                        <div>
                          <div className="text-[10px] text-slate-400 font-mono font-bold">{inv.id} | Ngày: {inv.date}</div>
                          <div className="font-extrabold text-slate-850 mt-1">{inv.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">Số mục viện phí: {inv.items.length} hạng mục</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {inv.status === 'Paid' ? 'Đã Thanh Toán' : 'Chờ Thanh Toán'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

            {/* EHR footer */}
            <div className="bg-white border-t border-slate-200 p-4 text-right">
              <button 
                onClick={() => setSelectedPatientEHR(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Form: Add or Edit Patient */}
      {(showAddForm || editingPatient) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-3xs z-50 flex justify-right animate-fade-in">
          <form 
            onSubmit={editingPatient ? handleUpdatePatientSubmit : handleCreatePatientSubmit}
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left"
          >
            <div className="bg-[#0d9488] text-white p-5 flex justify-between items-center shadow-xs">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-1.5">
                  <User className="w-5 h-5" />
                  <span>{editingPatient ? 'Sử Thông Tin Bệnh Nhân' : 'Thêm Bệnh Nhân Mới'}</span>
                </h3>
                <p className="text-teal-100 text-[10px] mt-0.5">Vui lòng điền thông tin hành chính chính xác để lập hồ sơ EMR</p>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowAddForm(false);
                  onSetEditingPatient(null);
                }}
                className="p-1 hover:bg-white/20 rounded-full text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-slate-500 font-bold block">Họ và Tên Bệnh Nhân *</label>
                <input 
                  type="text" 
                  value={editingPatient ? editingPatient.name : newPatient.name}
                  onChange={(e) => {
                    if (editingPatient) onSetEditingPatient({...editingPatient, name: e.target.value});
                    else setNewPatient({...newPatient, name: e.target.value});
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm"
                  placeholder="Ví dụ: Nguyễn Văn Hải"
                  required
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Số điện thoại *</label>
                  <input 
                    type="tel" 
                    value={editingPatient ? editingPatient.phone : newPatient.phone}
                    onChange={(e) => {
                      if (editingPatient) onSetEditingPatient({...editingPatient, phone: e.target.value});
                      else setNewPatient({...newPatient, phone: e.target.value});
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm"
                    placeholder="VD: 0912xxxxxx"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Độ tuổi</label>
                  <input 
                    type="number" 
                    value={editingPatient ? editingPatient.age : newPatient.age}
                    onChange={(e) => {
                      if (editingPatient) onSetEditingPatient({...editingPatient, age: Number(e.target.value)});
                      else setNewPatient({...newPatient, age: Number(e.target.value)});
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm"
                    min="1" 
                    max="120"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Hòm thư email (Tùy chọn)</label>
                  <input 
                    type="email" 
                    value={editingPatient ? editingPatient.email : newPatient.email}
                    onChange={(e) => {
                      if (editingPatient) onSetEditingPatient({...editingPatient, email: e.target.value});
                      else setNewPatient({...newPatient, email: e.target.value});
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm"
                    placeholder="VD: name@domain.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Nhóm máu</label>
                  <select 
                    value={editingPatient ? editingPatient.bloodGroup : newPatient.bloodGroup}
                    onChange={(e) => {
                      if (editingPatient) onSetEditingPatient({...editingPatient, bloodGroup: e.target.value});
                      else setNewPatient({...newPatient, bloodGroup: e.target.value});
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm font-bold"
                  >
                    {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gender & Status */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Giới tính</label>
                  <div className="flex gap-2.5 mt-1">
                    {['Nam', 'Nữ'].map(g => {
                      const isSel = editingPatient 
                        ? (editingPatient.gender === g) 
                        : (newPatient.gender === g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            if (editingPatient) onSetEditingPatient({...editingPatient, gender: g});
                            else setNewPatient({...newPatient, gender: g});
                          }}
                          className={`flex-1 py-1.5 rounded-xl font-bold border transition-all text-center ${
                            isSel ? 'bg-teal-50 border-[#0d9488] text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold block">Hồ sơ hành chính</label>
                  <select 
                    value={editingPatient ? editingPatient.status : newPatient.status}
                    onChange={(e) => {
                      if (editingPatient) onSetEditingPatient({...editingPatient, status: e.target.value});
                      else setNewPatient({...newPatient, status: e.target.value});
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm font-bold"
                  >
                    <option value="Active">Đang khám điều trị</option>
                    <option value="Inactive">Tạm thời ngừng</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-slate-500 font-bold block">Địa chỉ thường trú</label>
                <input 
                  type="text" 
                  value={editingPatient ? editingPatient.address : newPatient.address}
                  onChange={(e) => {
                    if (editingPatient) onSetEditingPatient({...editingPatient, address: e.target.value});
                    else setNewPatient({...newPatient, address: e.target.value});
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm"
                  placeholder="Ví dụ: 12 Nguyễn Du, Hà Nội"
                />
              </div>

              {/* Medical History */}
              <div className="space-y-1">
                <label className="text-slate-500 font-bold block">Tiền án Bệnh lý sơ bộ</label>
                <textarea 
                  rows={4}
                  value={editingPatient ? editingPatient.medicalHistory : newPatient.medicalHistory}
                  onChange={(e) => {
                    if (editingPatient) onSetEditingPatient({...editingPatient, medicalHistory: e.target.value});
                    else setNewPatient({...newPatient, medicalHistory: e.target.value});
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-xs sm:text-sm leading-relaxed"
                  placeholder="Ghi chú cụ thể của bác sĩ (Ví dụ: Tiền sử tăng huyết áp vô căn, tiểu đường tuýp 2, dị ứng penicillin...)"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  onSetEditingPatient(null);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-xl transition-colors text-center"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="bg-[#0d9488] hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-xl transition-colors text-center shadow-sm cursor-pointer"
              >
                {editingPatient ? 'Cập nhật EMR' : 'Tạo hồ sơ'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default PatientsView;
