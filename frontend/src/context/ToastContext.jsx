import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((typeOrObj, content) => {
    const id = Math.random().toString(36).substring(2, 9);
    let newToast = { id };

    if (typeof typeOrObj === 'object' && typeOrObj !== null) {
      // Case: addToast({ title, body, ... })
      newToast = { ...newToast, ...typeOrObj };
    } else {
      // Case: addToast('type', 'message') OR addToast('type', { ... })
      newToast.type = typeOrObj;
      if (typeof content === 'string') {
        newToast.body = content;
        newToast.title = typeOrObj === 'error' ? 'Error' : 'Notification';
      } else if (content && typeof content === 'object') {
        newToast = { ...newToast, ...content };
      }
    }
    
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const isError = toast.type === 'error' || toast.variant === 'error';
  const isDailyDate = toast.from === 'DailyDate' || toast.isGlobal;

  return (
    <div className="bg-card-bg/90 backdrop-blur-xl border border-border-color p-3 rounded-[20px] shadow-2xl flex items-center gap-4 animate-toast pointer-events-auto transition-all relative">
      {isDailyDate && (
        <div className="absolute -top-1 -right-1 bg-orange-500 px-1.5 py-0.5 rounded-full z-10 shadow-sm">
          <span className="text-[7px] font-black text-white uppercase tracking-tighter">Official</span>
        </div>
      )}
      <div className={`w-10 h-10 rounded-full overflow-hidden border-2 shrink-0 ${isError ? 'border-red-500/50' : 'border-orange-500/50'} ${isDailyDate ? 'bg-white p-1' : ''}`}>
        <img 
          src={isDailyDate ? '/logo.png' : (toast.photo || 'https://via.placeholder.com/100')} 
          alt="Avatar" 
          className={isDailyDate ? "w-full h-full object-contain" : "w-full h-full object-cover"}
          onError={(e) => { if (isDailyDate) e.target.src = 'https://dailydate.app/logo.png'; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-app-text text-[13px] tracking-tight truncate leading-tight">
          {toast.title || 'Notification'}
        </h4>
        <p className="text-[11px] text-gray-500 font-bold truncate leading-tight mt-0.5">
          {toast.body || toast.message || 'Something happened.'}
        </p>
      </div>
      <button onClick={onRemove} className="text-gray-400 hover:text-app-text p-2">
        <i className="fas fa-times text-xs"></i>
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
