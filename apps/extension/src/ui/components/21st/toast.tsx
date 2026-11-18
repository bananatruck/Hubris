// 21st.dev - https://21st.dev/shadcn/toast
import { useEffect } from 'react';
import { cn } from '../../lib/cn';

export interface ToastData {
  id: string;
  message: string;
  onUndo?: () => void;
}

export interface ToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
  durationMs?: number;
  className?: string;
}

export function Toast({
  toast,
  onDismiss,
  durationMs = 6000,
  className,
}: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) {
    return <div aria-live="polite" aria-atomic="true" className="sr-only" />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'fixed bottom-16 left-3 right-3 z-50 mx-auto flex max-w-[356px] items-center justify-between gap-3 rounded-xl border border-accent-soft/40 bg-raised px-3.5 py-2.5 text-xs text-text shadow-xl',
        className,
      )}
    >
      <span className="font-medium text-text">{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            const callback = toast.onUndo;
            onDismiss();
            callback?.();
          }}
          className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
        >
          Undo
        </button>
      )}
    </div>
  );
}
