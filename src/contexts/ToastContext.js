import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error', duration = 5000) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const STYLES = {
    error: 'bg-rose-500/15 border-rose-500/25 text-rose-300',
    success: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
    info: 'bg-gold-500/15 border-gold-500/25 text-gold-300',
    warning: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-xl border backdrop-blur-xl text-sm animate-fade-in flex items-start gap-2 shadow-lg ${STYLES[toast.type] || STYLES.info}`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity text-sm leading-none mt-0.5"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
