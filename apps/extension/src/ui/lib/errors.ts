const FALLBACK = 'Could not save that change. Try again.';

/** A user-readable message for a rejected action; ValidationError messages are written for people. */
export function errorMessage(cause: unknown): string {
  return cause instanceof Error && cause.message.trim() !== '' ? cause.message : FALLBACK;
}
