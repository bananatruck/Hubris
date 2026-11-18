import { useRef, useState } from 'react';
import { errorMessage } from './errors';

export function useDialogAction() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(operation: () => Promise<void>, onSuccess: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      onSuccess();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { pending, error, run, clearError: () => setError(null) };
}
