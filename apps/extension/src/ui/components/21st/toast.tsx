// 21st.dev - https://21st.dev/shadcn/toast
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ToastData {
  id: string;
  message: string;
  tone?: 'info' | 'error';
  onUndo?: () => void;
  undoLabel?: string;
  errorMessage?: string;
}

export interface ToastProps {
  toasts: readonly ToastData[];
  onDismiss: (id: string) => void;
  durationMs?: number;
  className?: string;
  /** Where focus goes when a keyboard user dismisses the last toast. */
  fallbackFocus?: () => HTMLElement | null;
}

export function Toast({
  toasts,
  onDismiss,
  durationMs = 6000,
  className,
  fallbackFocus,
}: ToastProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  // Set when a click inside a focused toast removes it. Focus then moves to the toast that takes its place,
  // the one before it, or the fallback, instead of dropping to the document.
  const focusAfterDismiss = useRef<number | null>(null);
  const dismissFromToast = useCallback((id: string, hadFocus: boolean) => {
    if (hadFocus) focusAfterDismiss.current = toasts.findIndex((toast) => toast.id === id);
    onDismiss(id);
  }, [onDismiss, toasts]);

  useLayoutEffect(() => {
    const index = focusAfterDismiss.current;
    if (index === null) return;
    focusAfterDismiss.current = null;
    const cards = stackRef.current?.querySelectorAll<HTMLElement>('[data-toast]') ?? [];
    const card = cards[index] ?? cards[index - 1];
    const target = card?.querySelector<HTMLElement>('button') ?? fallbackFocus?.();
    target?.focus();
  }, [toasts, fallbackFocus]);

  // Each notification is announced once, when it arrives. A keyed node per notification makes a repeated
  // message a new update, and dismissing the newest toast leaves the region alone instead of re-reading an older one.
  const [knownIds, setKnownIds] = useState<readonly string[]>([]);
  const [announcement, setAnnouncement] = useState<{ id: string; text: string } | null>(null);
  const ids = toasts.map((toast) => toast.id);
  if (ids.join('\n') !== knownIds.join('\n')) {
    const arrived = toasts.filter((toast) => !knownIds.includes(toast.id)).at(-1);
    setKnownIds(ids);
    if (arrived) setAnnouncement({ id: arrived.id, text: [arrived.message, arrived.errorMessage].filter(Boolean).join(' ') });
    else if (toasts.length === 0) setAnnouncement(null);
  }

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement && <span key={announcement.id}>{announcement.text}</span>}
      </div>
      <div ref={stackRef} className="fixed bottom-16 left-3 right-3 z-50 mx-auto flex max-h-[calc(100dvh-5rem)] max-w-[356px] flex-col gap-2 overflow-y-auto">
        {toasts.map((toast) => (
          <ToastMessage
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            onDismissFromToast={dismissFromToast}
            durationMs={durationMs}
            className={className}
          />
        ))}
      </div>
    </>
  );
}

interface ToastMessageProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  onDismissFromToast: (id: string, hadFocus: boolean) => void;
  durationMs: number;
  className?: string;
}

function ToastMessage({ toast, onDismiss, onDismissFromToast, durationMs, className }: ToastMessageProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasFocus = () => cardRef.current?.contains(document.activeElement) ?? false;
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
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, onDismiss, durationMs, toast.id]);

  return (
    <div
      ref={cardRef}
      data-toast=""
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-accent-soft/40 bg-raised px-3.5 py-2.5 text-xs text-text shadow-xl',
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
          aria-label={toast.undoLabel ?? 'Undo'}
          onClick={() => {
            const callback = toast.onUndo;
            onDismissFromToast(toast.id, hasFocus());
            callback?.();
          }}
          className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        aria-label={`Dismiss ${toast.message}`}
        onClick={() => onDismissFromToast(toast.id, hasFocus())}
        className="shrink-0 rounded-md p-1 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
