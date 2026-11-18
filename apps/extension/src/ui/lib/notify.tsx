import { createContext, useContext } from 'react';

export type Notification =
  | { message: string; tone: 'info'; onUndo?: () => void }
  | { message: string; tone: 'error'; onUndo?: never };

export const NotificationContext = createContext<((notification: Notification) => void) | null>(null);

export function useNotify() {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error('useNotify must be used within App.');
  return notify;
}
