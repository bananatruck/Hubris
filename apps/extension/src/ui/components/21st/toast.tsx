// 21st.dev - https://21st.dev/shadcn/toast
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ToastData {
  id: string;
  message: string;
  tone?: 'info' | 'error';
  onUndo?: () => void;
  errorMessage?: string;
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
  // The status region stays mounted while its content changes; screen readers
  // often ignore live regions that are inserted together with their message.
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={toast ? undefined : 'sr-only'}>
      {toast && (
        <ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} durationMs={durationMs} className={className} />
      )}
    </div>
  );
}

function ToastMessage({ toast, onDismiss, durationMs, className }: ToastProps & { toast: ToastData; durationMs: number }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(durationMs);
  const paused = hovered || focused;

  useEffect(() => {
    remaining.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, onDismiss, durationMs]);

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={cn(
        'fixed bottom-16 left-3 right-3 z-50 mx-auto flex max-w-[356px] items-center justify-between gap-3 rounded-xl border border-accent-soft/40 bg-raised px-3.5 py-2.5 text-xs text-text shadow-xl',
        toast.tone === 'error' && 'border-red-500/60 text-red-200',
        className,
      )}
    >
      <span className="min-w-0 font-medium">
        <span className="block">{toast.message}</span>
        {toast.errorMessage && (
          <span role="alert" className="mt-0.5 block text-red-200">
            {toast.errorMessage}
          </span>
        )}
      </span>
      {toast.tone !== 'error' && toast.onUndo && (
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
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
