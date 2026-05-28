import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface ToastContextValue {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  return useContext(ToastContext) as ToastContextValue;
}

let nextId = 0;

const STYLES: Record<ToastType, string> = {
  error: 'bg-rose-500/15 border-rose-500/25 text-rose-300',
  success: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
  info: 'bg-gold-500/15 border-gold-500/25 text-gold-300',
  warning: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'error', duration: number = 5000) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
