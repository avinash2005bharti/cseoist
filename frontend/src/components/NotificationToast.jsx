import React from 'react';
import { useERP } from '../context/ERPContext.jsx';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function NotificationToast() {
  const { toasts, removeToast } = useERP();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        maxWidth: '380px',
        width: 'calc(100% - 2.5rem)',
        pointerEvents: 'none',
      }}
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isRed =
          toast.type === 'danger' ||
          toast.type === 'error' ||
          toast.type === 'warning' ||
          toast.type === 'failure';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 transform translate-y-0 opacity-100 ${
              isRed
                ? 'bg-[#FFF1F2] border-rose-400 text-rose-950 border-l-[6px] border-l-rose-600'
                : 'bg-[#F0FDF4] border-emerald-400 text-emerald-950 border-l-[6px] border-l-emerald-600'
            }`}
            style={{
              backgroundColor: isRed ? '#FFF1F2' : '#F0FDF4',
              opacity: 1,
              boxShadow: isRed
                ? '0 20px 25px -5px rgba(225, 29, 72, 0.25), 0 8px 10px -6px rgba(225, 29, 72, 0.2)'
                : '0 20px 25px -5px rgba(5, 150, 105, 0.25), 0 8px 10px -6px rgba(5, 150, 105, 0.2)',
              animation: 'toastTopSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            role="alert"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {isRed ? (
                <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs font-black leading-tight ${
                    isRed ? 'text-rose-950' : 'text-emerald-950'
                  }`}
                >
                  {toast.title}
                </div>
                {toast.message && (
                  <div
                    className={`text-xs mt-1 leading-normal font-medium ${
                      isRed ? 'text-rose-900' : 'text-emerald-900'
                    }`}
                  >
                    {toast.message}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="toast-close-btn shrink-0"
              aria-label="Close notification"
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
