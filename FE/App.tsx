import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Moon, 
  Maximize2, 
  Bell,
  ClipboardList,
  LogOut
} from 'lucide-react';
import './src/tailwind-built.css';

import { initialPatients, initialDoctors, initialAppointments, initialPrescriptions, initialInvoices, initialSystemLogs, initialDatasets } from './src/constants/mockData';
import { Patient, Doctor, SystemLog } from './src/types';
import AdminMetricsView from './src/components/AdminMetricsView';
import AdminUsersView from './src/components/AdminUsersView';
import AdminDoctorsView from './src/components/AdminDoctorsView';
import AdminDatasetsView from './src/components/AdminDatasetsView';
import AdminAuditLogsView from './src/components/AdminAuditLogsView';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(true);
  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'doctors' | 'datasets' | 'audit-logs'>('metrics');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Neuroscan Specific Durable States
  const [walletBalance, setWalletBalance] = useState<number>(2450000); // in VNĐ
  const [verifiedCount, setVerifiedCount] = useState<number>(3); // Matches backoffice verified docs count
  const [totalDatasetSales, setTotalDatasetSales] = useState<number>(120000000); // VNĐ
  const [datasetsCount, setDatasetsCount] = useState<number>(4);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

  const toggleSubMenu = (menuKey: string) => {
    setOpenSubMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };
  
  // Neuroscan Specific Durable States
  const [hardMiningCount, setHardMiningCount] = useState<number>(12);
  const [patientsPremium, setPatientsPremium] = useState<string[]>(['PT-8821']); // Nguyễn Văn An has premium
  
  const [aiAgents, setAiAgents] = useState([
    { id: '1', name: 'OCR Brain Scanner (Agent 1)', prompt: 'Trích xuất văn bản báo cáo y khoa, phim chụp 2D MRI não bộ để lọc chỉ số khối u, tự động bỏ qua nhiễu mờ hạt muối tiêu.', temp: 0.15, status: 'Active' },
    { id: '2', name: 'Medical Casual Translator (Agent 2)', prompt: 'Dịch các thuật ngữ học thuật (như "U màng não vùng hố sau", "Cerebellar astrocytoma") sang ngôn ngữ tiếng Việt bình dân, dịu lòng bệnh nhân, kèm lời dặn sinh hoạt lành mạnh.', temp: 0.45, status: 'Active' },
    { id: '3', name: 'Clinical Architect (Agent 3)', prompt: 'Phân tích phân bố pixel khối u và khoanh vùng Bounding Box 2D sơ bộ, đánh giá Confidence Score dựa trên nhãn tương đồng từ thư viện u u hố sau.', temp: 0.2, status: 'Active' },
    { id: '4', name: 'Medication Rx Assistant (Agent 4)', prompt: 'Đề xuất danh mục tương tác thuốc, lưu ý liều bổ sung nếu bệnh nhân nôn mửa hoặc thiếu dung nạp.', temp: 0.35, status: 'Active' },
    { id: '5', name: 'SOS Alerts & Direct Triager (Agent 5)', prompt: 'Phân loại các cuộc gọi khẩn cấp hoặc tin nhắn đau đầu mờ mắt của bệnh nhân để tự động bắn tín hiệu đến phòng cấp cứu lâm sàng phòng trực ca.', temp: 0.1, status: 'Active' }
  ]);

  const [apiKeys, setApiKeys] = useState([
    { id: 'KEY-9104', Hospital: 'Bệnh viện Bạch Mai - Khoa Thần Kinh', key: 'ns_live_bm_4981a8c9b2f6', status: 'Active', created: '2026-01-12' },
    { id: 'KEY-5592', Hospital: 'Bệnh viện Chợ Rẫy - Phòng MRI 3', key: 'ns_live_cr_8102fa10e7b4', status: 'Active', created: '2026-03-05' },
  ]);

  const [ragDocs, setRagDocs] = useState([
    { name: 'huong-dan-chan-doan-u-trong-truc-bo-yte.pdf', size: '4.8 MB', date: '21 May 2026', status: 'Indexed' },
    { name: 'mri-t2-weighted-brain-abnormality-atlas.pdf', size: '12.4 MB', date: '01 Jun 2026', status: 'Indexed' }
  ]);

  const [sosAlerts, setSosAlerts] = useState([
    { id: 'SOS-01', patient: 'Phạm Minh Hùng', phone: '0901223344', symptom: 'Đau đầu nhói từng cơn đột ngột, nôn mửa liên tục tại nhà', date: '07 Jun 2026, 08:35 AM', status: 'Unresolved' }
  ]);

  const [medicationAlarms, setMedicationAlarms] = useState([
    { id: 'AL-1', name: 'Nguyễn Văn An', drug: 'Lacosamide 100mg', interval: '08:00 AM & 08:00 PM', checked: true },
    { id: 'AL-2', name: 'Trương Thị Ngọc Bích', drug: 'Cabergoline 0.5mg', interval: 'Thứ 2 & Thứ 5 hàng tuần', checked: false },
    { id: 'AL-3', name: 'Phạm Minh Hùng', drug: 'Gabapentin 300mg', interval: 'Trước khi ngủ 09:30 PM', checked: false }
  ]);

  // Durable States
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctors);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [prescriptions, setPrescriptions] = useState(initialPrescriptions);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [logs, setLogs] = useState<SystemLog[]>(initialSystemLogs);

  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  // Helper IP for logs
  const getSimulatedIP = () => `192.168.1.${Math.floor(10 + Math.random() * 89)}`;

  // Log append helper
  const addSystemLog = (action: string, moduleName: string, details: string) => {
    const newLog: SystemLog = {
      id: `LOG-0${logs.length + 1}`,
      user: 'BS. Lê Mạnh Minh',
      role: 'Bác sĩ Trực',
      module: moduleName as any,
      action,
      details,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      ipAddress: getSimulatedIP(),
      status: 'Success'
    };
    setLogs([newLog, ...logs]);
  };

  // Patients CRUD Actions
  const handleAddPatient = (patient: Patient) => {
    setPatients([patient, ...patients]);
    addSystemLog('Thêm mới hồ sơ', 'Patients', `Tạo thông tin bệnh nhân mới ${patient.name} (${patient.id})`);
  };

  const handleEditPatient = (edited: Patient) => {
    setPatients(patients.map(p => p.id === edited.id ? edited : p));
    addSystemLog('Cập nhật hồ sơ', 'Patients', `Sửa đổi danh mục hành chính bệnh nhân ${edited.name} (${edited.id})`);
  };

  const handleDeletePatient = (id: string) => {
    const tgt = patients.find(p => p.id === id);
    if (!tgt) return;
    setPatients(patients.filter(p => p.id !== id));
    addSystemLog('Xóa hồ sơ bệnh án', 'Patients', `Rút giấy phép bệnh nhân ${tgt.name} (${id})`);
  };

  // Doctors CRUD Actions
  const handleAddDoctor = (doc: Doctor) => {
    setDoctors([...doctors, doc]);
    addSystemLog('Bổ nhiệm Bác sĩ', 'Doctors', `Hợp đồng y tế mới với chuyên gia ${doc.name} (${doc.id})`);
  };

  const handleEditDoctor = (doc: Doctor) => {
    setDoctors(doctors.map(d => d.id === doc.id ? doc : d));
    addSystemLog('Cập nhật clinician', 'Doctors', `Sửa thông tin lịch biểu lâm sàng bác sĩ ${doc.name}`);
  };

  const handleDeleteDoctor = (id: string) => {
    const tgt = doctors.find(d => d.id === id);
    if (!tgt) return;
    setDoctors(doctors.filter(d => d.id !== id));
    addSystemLog('Bãi nhiệm Clinician', 'Doctors', `Ngừng chức vụ của bác sĩ ${tgt.name} (${id})`);
  };

  const handleToggleDocStatus = (id: string, newStats: 'Available' | 'On Leave' | 'Busy') => {
    setDoctors(doctors.map(d => d.id === id ? { ...d, status: newStats } : d));
    const tgt = doctors.find(d => d.id === id);
    addSystemLog('Thay đổi trực', 'Doctors', `BS. ${tgt?.name} đổi trạng thái khám sang ${newStats}`);
  };

  // Appointment Actions
  const handleAddAppointment = (apt: any) => {
    setAppointments([apt, ...appointments]);
    addSystemLog('Xếp lịch khám', 'Appointments', `Đặt câu trực tuyến cho bệnh nhân ${apt.patientName} khám với ${apt.doctorName}`);
  };

  const handleApproveAppointment = (id: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Approved' } : a));
    const tgt = appointments.find(a => a.id === id);
    addSystemLog('Phê duyệt lịch hẹn', 'Appointments', `Chấp thuận lịch khám mã ${id} của BN ${tgt?.patientName}`);
  };

  const handleCancelAppointment = (id: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Cancelled' } : a));
    const tgt = appointments.find(a => a.id === id);
    addSystemLog('Hủy lịch xếp khám', 'Appointments', `Chủ động hủy phiên tư vấn y tế ${id} lý do đột xuất`);
  };

  const handleCompleteAppointment = (id: string) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'Completed' } : a));
    const tgt = appointments.find(a => a.id === id);
    addSystemLog('Hoàn tất ca khám', 'Appointments', `Ký xác nhận hoàn thành đợt chẩn bệnh lâm sàng ${id}`);
  };

  // Prescriptions Actions
  const handleAddPrescription = (rx: any) => {
    setPrescriptions([rx, ...prescriptions]);
    addSystemLog('Phát hành toa thuốc', 'Prescriptions', `Xuất đơn thuốc điện tử ${rx.id} điều trị ${rx.diagnosis}`);
  };

  // Invoices Actions
  const handleAddInvoice = (inv: any) => {
    setInvoices([inv, ...invoices]);
    addSystemLog('Phát hóa đơn', 'Invoices', `Lập biên lai thu viện phí dự tính tổng ${inv.totalAmount.toLocaleString('vi-VN')} VNĐ`);
  };

  const handlePayInvoice = (id: string) => {
    setInvoices(invoices.map(i => i.id === id ? { ...i, status: 'Paid' } : i));
    const tgt = invoices.find(i => i.id === id);
    addSystemLog('Tất toán viện phí', 'Invoices', `Thu ngân hoàn thành giao dịch phiếu thu ${id} của BN ${tgt?.patientName}`);
  };

  // HIPAA Anonymizer Pipeline
  const handleTriggerAnonymization = () => {
    // 1. Map over all patients in state, redact names and mask phone indexes
    const maskedPatients = patients.map(p => {
      // Name scramble: "Nguyễn Văn Hải" -> "N. V. Hải"
      const nameParts = p.name.split(' ');
      let redactedName = p.name;
      if (nameParts.length > 1) {
        const initials = nameParts.slice(0, nameParts.length - 1).map(part => part.charAt(0) + '.').join(' ');
        redactedName = `${initials} ${nameParts[nameParts.length - 1]}`;
      }
      // Phone scramble: "0912345678" -> "0912***678"
      let maskedPhone = p.phone;
      if (p.phone.length >= 7) {
        maskedPhone = `${p.phone.substring(0, 4)}***${p.phone.substring(p.phone.length - 3)}`;
      }

      return {
        ...p,
        name: redactedName,
        phone: maskedPhone,
        address: 'Bảo mật HIPAA Redacted',
        email: 'redacted@hipaa-dreams.com'
      };
    });

    setPatients(maskedPatients);

    // Write-back matching appointments is necessary so names match up perfectly
    const maskedAppointments = appointments.map(a => {
      const pObj = maskedPatients.find(p => p.id === a.patientId);
      return pObj ? { ...a, patientName: pObj.name } : a;
    });
    setAppointments(maskedAppointments);

    // Update historical prescriptions too
    const maskedPrescriptions = prescriptions.map(rx => {
      const pObj = patients.find(p => p.name === rx.patientName);
      if (pObj) {
        const maskedP = maskedPatients.find(mp => mp.id === pObj.id);
        if (maskedP) {
          return { ...rx, patientName: maskedP.name };
        }
      }
      return rx;
    });
    setPrescriptions(maskedPrescriptions);

    // Update invoices
    const maskedInvoices = invoices.map(i => {
      const pObj = maskedPatients.find(p => p.id === i.patientId);
      return pObj ? { ...i, patientName: pObj.name, patientPhone: pObj.phone } : i;
    });
    setInvoices(maskedInvoices);

    addSystemLog('Bảo mật HIPAA Shield', 'System', 'Hoàn tất an danh hóa toàn diện cơ sở dữ liệu y tế. Kích hoạt HIPAA compliance.');
  };

  // Reset anonymization back to original identities
  const handleResetAnonymization = () => {
    setPatients(initialPatients);
    setAppointments(initialAppointments);
    setPrescriptions(initialPrescriptions);
    setInvoices(initialInvoices);
    addSystemLog('Phục hồi dữ liệu', 'System', 'Hoàn trả định tính nhân văn hồ sơ bệnh nhân từ backup gốc.');
  };

  // Dynamic quick-stats counters for Sticky Header
  const totalClinicians = doctors.length;
  const approvedVisitsCount = appointments.filter(a => a.status === 'Approved').length;
  const pendingVisitsCount = appointments.filter(a => a.status === 'Pending').length;
  const activePatientsCount = patients.length;
  const pendingRevenue = invoices
    .filter(i => i.status === 'Pending')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  // Fullscreen support matching F11 request
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Failed to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.log(`Failed to exit fullscreen: ${err.message}`);
        });
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-[#f7f9fb] flex flex-row text-slate-700 font-sans antialiased overflow-hidden">
      
      {/* 1. NEUROSCAN ADMIN SIDEBAR - Pure Flexbox, no fixed positioning */}
      <aside className={`bg-[#0F172A] text-[#9ca3af] flex flex-col shrink-0 border-r border-[#1e293b]/50 select-none z-40 transition-all duration-300 ease-in-out h-screen overflow-hidden ${
        sidebarCollapsed 
          ? 'w-[72px]' 
          : 'w-[240px]'
      }`}>
        
        {/* Sidebar Header: Logo, Space & Collapse control */}
        <div className={`border-b border-[#1e293b]/40 flex items-center justify-between transition-all duration-300 ${
          sidebarCollapsed ? 'p-4 flex-col gap-4' : 'p-6'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <svg className="w-5.5 h-5.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0 transition-all">
                <span className="font-sans font-bold text-white text-[18px] leading-tight tracking-tight truncate">
                  NeuroScan AI
                </span>
                <span className="text-[12px] opacity-70 text-[#9ca3af] font-medium leading-none mt-0.5 truncate">
                  Admin Console
                </span>
              </div>
            )}
          </div>
          
          {/* Collapse icon action inside Header */}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Mở rộng Sidebar" : "Thu gọn Sidebar"}
            className="p-1.5 hover:bg-[#1e293b]/60 hover:text-white rounded-lg transition-all cursor-pointer text-slate-500 hover:scale-105 active:scale-95"
          >
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${!sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Sidebar Scrollable Nav Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-sidebar-nav">
          
          {/* CATEGORY: TỔNG QUAN */}
          <div>
            {sidebarCollapsed ? (
              <div className="h-px bg-[#1e293b]/50 my-3 w-8 mx-auto" />
            ) : (
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[1px] opacity-60 mb-3 block">
                TỔNG QUAN
              </span>
            )}
            <div className="space-y-1.5">
              <button 
                onClick={() => setActiveTab('metrics')}
                className={`flex items-center gap-3 rounded-[12px] text-xs transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer ${
                  sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-4 w-full'
                } ${
                  activeTab === 'metrics'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20'
                    : 'hover:bg-[#1e293b]/50 hover:text-white font-medium text-slate-400'
                }`}
                style={{ height: '44px', transition: 'all 0.25s ease' }}
                title={sidebarCollapsed ? "Dashboard" : undefined}
              >
                <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Dashboard</span>}
              </button>
            </div>
          </div>

          {/* CATEGORY: QUẢN LÝ */}
          <div>
            {sidebarCollapsed ? (
              <div className="h-px bg-[#1e293b]/50 my-3 w-8 mx-auto" />
            ) : (
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[1px] opacity-60 mb-3 block">
                QUẢN LÝ
              </span>
            )}
            <div className="space-y-1.5">
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-3 rounded-[12px] text-xs transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer ${
                  sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-4 w-full'
                } ${
                  activeTab === 'users'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20'
                    : 'hover:bg-[#1e293b]/50 hover:text-white font-medium text-slate-400'
                }`}
                style={{ height: '44px', transition: 'all 0.25s ease' }}
                title={sidebarCollapsed ? "Người dùng" : undefined}
              >
                <Users className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Người dùng</span>}
              </button>

              <button 
                onClick={() => setActiveTab('doctors')}
                className={`relative flex items-center rounded-[12px] text-xs transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer ${
                  sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'justify-between px-4 w-full'
                } ${
                  activeTab === 'doctors'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20'
                    : 'hover:bg-[#1e293b]/50 hover:text-white font-medium text-slate-400'
                }`}
                style={{ height: '44px', transition: 'all 0.25s ease' }}
                title={sidebarCollapsed ? "Bác sĩ & PK" : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Stethoscope className="w-[18px] h-[18px] shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Bác sĩ & PK</span>}
                </div>
                {Math.max(0, 5 - verifiedCount) > 0 && (
                  sidebarCollapsed ? (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#ef4444] border-2 border-[#0b0f19] animate-pulse" />
                  ) : (
                    <span className="min-w-[20px] h-[20px] rounded-full text-[11px] px-[6px] bg-[#ef4444] text-white font-bold flex items-center justify-center shrink-0">
                      {Math.max(0, 5 - verifiedCount)}
                    </span>
                  )
                )}
              </button>

              <button 
                onClick={() => setActiveTab('datasets')}
                className={`flex items-center gap-3 rounded-[12px] text-xs transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer ${
                  sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-4 w-full'
                } ${
                  activeTab === 'datasets'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20'
                    : 'hover:bg-[#1e293b]/50 hover:text-white font-medium text-slate-400'
                }`}
                style={{ height: '44px', transition: 'all 0.25s ease' }}
                title={sidebarCollapsed ? "Dataset" : undefined}
              >
                <Database className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Dataset</span>}
              </button>
            </div>
          </div>

          {/* CATEGORY: TUÂN THỦ */}
          <div>
            {sidebarCollapsed ? (
              <div className="h-px bg-[#1e293b]/50 my-3 w-8 mx-auto" />
            ) : (
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-[1px] opacity-60 mb-3 block">
                TUÂN THỦ
              </span>
            )}
            <div className="space-y-1.5">
              <button 
                onClick={() => setActiveTab('audit-logs')}
                className={`flex items-center gap-3 rounded-[12px] text-xs transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer ${
                  sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-4 w-full'
                } ${
                  activeTab === 'audit-logs'
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-400/20'
                    : 'hover:bg-[#1e293b]/50 hover:text-white font-medium text-slate-400'
                }`}
                style={{ height: '44px', transition: 'all 0.25s ease' }}
                title={sidebarCollapsed ? "Audit Logs" : undefined}
              >
                <ClipboardList className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Audit Logs</span>}
              </button>
            </div>
          </div>

        </nav>

        {/* 9. KIỂM LOGOUT AREA */}
        <div className="mt-auto pt-4 border-t border-white/10 px-4 pb-6 shrink-0">
          <button 
            onClick={() => {
              setIsAdminLoggedIn(false);
              addSystemLog('Đăng xuất tài khoản', 'System', 'Quản trị viên đã đăng xuất an toàn khỏi hệ thống.');
            }}
            className={`flex items-center gap-3 rounded-[12px] text-xs font-bold cursor-pointer text-[#9ca3af] hover:bg-rose-950/40 hover:text-rose-450 transition-all duration-250 ease-out hover:translate-x-[2px] ${
              sidebarCollapsed ? 'justify-center px-0 w-11 h-11 mx-auto' : 'px-4 w-full'
            }`}
            style={{ height: '44px', transition: 'all 0.25s ease' }}
            title={sidebarCollapsed ? "Đăng xuất" : undefined}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0 text-rose-500" />
            {!sidebarCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>

      </aside>


      {/* 2. MAIN APP CONTENT CANVAS WITH MATCHING TOPBAR HEADER */}
      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        
        {/* Redesigned Top Header Bar - fixed in flex column, always visible */}
        <header className="shrink-0 bg-white border-b border-[#e8edf5] z-30 py-3 px-6 flex items-center justify-between gap-4">
          
          {/* Left search & Sidebar toggle container */}
          <div className="flex items-center gap-4 flex-1 max-w-md">

            {/* Keyword Search Input with Integrated Blue Action Button matching Screenshot */}
            <div className="relative w-80 max-w-full flex items-center">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search Keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-1.5 bg-slate-50 border border-[#e8edf5] rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-all font-sans font-medium"
              />
              <div 
                onClick={() => {}}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-md text-white flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors" 
                title="Execute search"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">

            {/* Maximize / Fullscreen action toggle (Matches F11 screen capture theme) */}
            <button 
              onClick={toggleFullscreen}
              className="w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              title="Toggle Fullscreen (F11)"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </button>

            {/* Flag / Language Picker */}
            <div className="relative group cursor-pointer">
              <div className="text-xs font-bold border border-[#e8edf5] px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-all text-slate-650">
                <span className="text-[14px]">🇺🇸</span>
                <span>US</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* Notification Bell with red dot */}
            <button 
              onClick={() => setActiveTab('audit-logs')}
              className="relative w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* Crescent Moon Dark Mode dummy button */}
            <button 
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                addSystemLog('Giao diện hiển thị', 'System', `Đổi chế độ màu sang ${isDark ? 'Tối' : 'Sáng'}`);
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              title="Toggle theme (Light/Dark)"
            >
              <Moon className="w-4 h-4" />
            </button>

            {/* Separator */}
            <span className="w-px h-6 bg-[#e8edf5]" />

            {/* User Profile Avatar with dropdown visual */}
            <div className="flex items-center gap-2 pl-1 cursor-pointer group">
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80" 
                  alt="BS. Lê Mạnh Minh" 
                  className="w-10 h-10 rounded-full object-cover border border-[#e8edf5]" 
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
            </div>

          </div>

        </header>

        {/* 3. CORE APPMARK WORKSPACE MOUNT POINT */}
        <section className="flex-1 overflow-y-auto"><div className="w-full px-6 py-6">
          
          {activeTab === 'metrics' && (
            <AdminMetricsView 
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersView />
          )}

          {activeTab === 'doctors' && (
            <AdminDoctorsView />
          )}

          {activeTab === 'datasets' && (
            <AdminDatasetsView />
          )}

          {activeTab === 'audit-logs' && (
            <AdminAuditLogsView />
          )}

        </div></section>

      </main>

    </div>
  );
}
