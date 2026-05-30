import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, BarChart3, Users2, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    MANAGER: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    MEMBER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <header className="glass-panel border-b border-white/5 sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="bg-brand-600 text-white p-2 rounded-xl shadow-lg shadow-brand-600/30 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <span className="font-extrabold text-xl font-sans tracking-tight bg-gradient-to-r from-white via-dark-100 to-brand-400 bg-clip-text text-transparent">
            TeamTask
          </span>
          <span className="text-[10px] text-brand-400 uppercase tracking-widest font-bold block ml-0.5 leading-none">
            Tracker
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <nav className="flex items-center bg-white/5 border border-white/5 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'tasks'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-dark-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Task Board
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'analytics'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
              : 'text-dark-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>

        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'team'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                : 'text-dark-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users2 className="w-4 h-4" />
            Team Management
          </button>
        )}
      </nav>

      {/* User Details & Actions */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-dark-50 font-sans">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-[10px] text-dark-400 font-medium font-sans">
            {user.email}
          </div>
        </div>

        {/* Role Badge */}
        <span
          className={`px-2.5 py-1 text-xs font-bold font-sans rounded-md border tracking-wider select-none ${
            roleColors[user.role]
          }`}
        >
          {user.role}
        </span>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="text-dark-400 hover:text-red-400 p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/10 transition-all duration-150"
          title="Sign out of your session"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
