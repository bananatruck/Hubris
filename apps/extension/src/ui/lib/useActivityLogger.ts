import { useCallback, useRef, useState } from 'react';
import type { ActivityLog } from '@hubris/types';
import { useHubris } from '../../state/useHubris';
import { errorMessage } from './errors';
import { useNotify } from './notify';

export type ActivityLoggedHandler = (activityName: string, log: ActivityLog) => void;

export function useActivityLogger(onLogged: ActivityLoggedHandler) {
  const { actions } = useHubris();
  const notify = useNotify();
  const pendingWrites = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const logActivity = useCallback(async (activityId: string, activityName: string) => {
    if (pendingWrites.current.has(activityId)) return;
    pendingWrites.current.add(activityId);
    setPendingIds(new Set(pendingWrites.current));
    try {
      const createdLog = await actions.logActivity(activityId);
      onLogged(activityName, createdLog);
    } catch (cause) {
      notify({ message: errorMessage(cause), tone: 'error' });
    } finally {
      pendingWrites.current.delete(activityId);
      setPendingIds(new Set(pendingWrites.current));
    }
  }, [actions, notify, onLogged]);

  return { logActivity, pendingIds };
}
