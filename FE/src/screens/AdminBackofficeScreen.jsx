import React, { useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Moon, 
  Maximize2, 
  Bell,
  ClipboardList,
  LogOut,
  Database,
  ShieldAlert
} from 'lucide-react';
import '../tailwind-built.css';

import AdminMetricsView from '../components/AdminMetricsView';
import AdminUsersView from '../components/AdminUsersView';
import AdminDoctorsView from '../components/AdminDoctorsView';
import AdminDatasetsView from '../components/AdminDatasetsView';
import AdminAuditLogsView from '../components/AdminAuditLogsView';

const AdminBackofficeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('metrics');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  // Fullscreen support matching F11 request
  const toggleFullscreen = () => {
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Failed to enable fullscreen: ${err.message}`);
      });
    } else if (typeof document !== 'undefined') {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.log(`Failed to exit fullscreen: ${err.message}`);
        });
      }
    }
  };

  // Logout function
  const handleLogout = () => {
    navigation.replace('Login');
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeContainer}>
        <Text style={styles.nativeText}>Bảng điều khiển Admin Console chỉ được tối ưu hóa cho giao diện Web.</Text>
      </View>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#f7f9fb] flex flex-row text-slate-700 font-sans antialiased overflow-hidden">
      
      {/* 1. NEUROSCAN ADMIN SIDEBAR - Pure Flexbox, no fixed positioning */}
      <aside className={`bg-[#0F172A] text-[#9ca3af] flex flex-col shrink-0 border-r border-[#1e293b]/50 select-none z-30 transition-all duration-300 ease-in-out h-screen overflow-hidden ${
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
              <ShieldAlert className="w-4.5 h-4.5 text-white" />
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
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider opacity-60 mb-3 block">
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
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider opacity-60 mb-3 block">
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
              <span className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider opacity-60 mb-3 block">
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
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20'
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
            onClick={handleLogout}
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search Keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-all font-sans font-medium"
              />
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">

            {/* Maximize / Fullscreen action toggle (Matches F11 screen capture theme) */}
            <button 
              onClick={toggleFullscreen}
              className="w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Toggle Fullscreen (F11)"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </button>

            {/* Notification Bell with red dot */}
            <button 
              onClick={() => setActiveTab('audit-logs')}
              className="relative w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* Crescent Moon Dark Mode dummy button */}
            <button 
              onClick={() => {}}
              className="w-9 h-9 flex items-center justify-center text-slate-500 border border-[#e8edf5] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
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

        {/* 3. CORE APP MARK WORKSPACE MOUNT POINT */}
        <section className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6">
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
          </div>
        </section>

      </main>

    </div>
  );
};

const styles = StyleSheet.create({
  nativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  nativeText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  }
});

export default AdminBackofficeScreen;
