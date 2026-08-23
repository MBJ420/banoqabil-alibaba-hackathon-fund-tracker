import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-emerald-600 text-white border-emerald-400',
  error: 'bg-rose-600 text-white border-rose-400',
  warning: 'bg-amber-500 text-white border-amber-300',
  info: 'bg-slate-700 text-white border-slate-500',
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[90vw] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${VARIANT_CLASSES[t.variant]}`}
          >
            <span className="shrink-0 mt-0.5 font-bold leading-none">{VARIANT_ICON[t.variant]}</span>
            <span className="flex-1 text-sm leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
