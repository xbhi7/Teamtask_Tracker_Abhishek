import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (title: string, message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Floating Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastCard: React.FC<{ toast: ToastMessage; onClose: () => void }> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertOctagon className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgStyles = {
    success: 'bg-dark-900/90 border-green-500/20 shadow-green-500/5',
    error: 'bg-dark-900/90 border-red-500/20 shadow-red-500/5',
    warning: 'bg-dark-900/90 border-yellow-500/20 shadow-yellow-500/5',
    info: 'bg-dark-900/90 border-blue-500/20 shadow-blue-500/5',
  };

  return (
    <div
      className={`glass-panel border-l-4 rounded-xl px-4 py-3 flex gap-3 items-start shadow-2xl animate-slide-up ${bgStyles[toast.type]} border-l-${
        toast.type === 'success' ? 'green-500' : toast.type === 'error' ? 'red-500' : toast.type === 'warning' ? 'yellow-500' : 'blue-500'
      }`}
      role="alert"
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <h4 className="font-semibold text-sm text-dark-50 font-sans">{toast.title}</h4>
        <p className="text-xs text-dark-300 mt-1 font-sans leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-dark-400 hover:text-dark-200 transition-colors p-0.5 rounded-lg hover:bg-white/5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
