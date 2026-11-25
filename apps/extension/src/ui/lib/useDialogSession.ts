import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Each open of a dialog is a new session. A form's success handler closes only the session it was
 * submitted in, so a slow save from an earlier session cannot close a newer draft.
 */
export function useDialogSession() {
  const sessions = useRef(0);
  const [session, setSession] = useState<number | null>(null);
  const open = useCallback(() => setSession(++sessions.current), []);
  const close = useCallback((which?: number) => setSession((current) =>
    which === undefined || current === which ? null : current), []);
  const onOpenChange = useCallback((next: boolean) => (next ? open() : close()), [open, close]);
  /** Closes the dialog only if it is still the session that was open when this render happened. */
  const closeThisSession = useMemo(() => {
    const current = session;
    return () => { if (current !== null) close(current); };
  }, [session, close]);
  return { isOpen: session !== null, open, close, onOpenChange, closeThisSession };
}
