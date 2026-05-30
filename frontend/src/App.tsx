import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskModal } from './components/TaskModal';
import { AdminPanel } from './components/AdminPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Loader2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';
  dueDate: string;
  assigneeId?: string;
  projectId?: string;
}

const MainAppContent: React.FC = () => {
  const { user, loading } = useAuth();

  // Navigation tab: 'tasks' | 'analytics' | 'team'
  const [activeTab, setActiveTab] = useState<string>('tasks');
  
  // Task Modal Control
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Trigger task list refresh
  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Open modal helper
  const handleOpenTaskModal = (task?: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Loading skeleton on restore session
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <span className="text-xs text-dark-400 font-sans tracking-widest font-semibold uppercase animate-pulse">
          Restoring Space Console...
        </span>
      </div>
    );
  }

  // Not Authenticated -> Show Sign In
  if (!user) {
    return <LoginScreen />;
  }

  // Render correct view panel
  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        return (
          <KanbanBoard 
            onOpenTaskModal={handleOpenTaskModal} 
            refreshTrigger={refreshTrigger} 
          />
        );
      case 'analytics':
        return <AnalyticsPanel />;
      case 'team':
        if (user.role === 'ADMIN' || user.role === 'MANAGER') {
          return <AdminPanel />;
        }
        return <div className="p-6 text-center text-red-400 text-sm">Access Denied</div>;
      default:
        return (
          <KanbanBoard 
            onOpenTaskModal={handleOpenTaskModal} 
            refreshTrigger={refreshTrigger} 
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col">
        {renderContent()}
      </main>

      {/* Shared Task Modal */}
      {isTaskModalOpen && (
        <TaskModal
          task={selectedTask as any}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={triggerRefresh}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainAppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
