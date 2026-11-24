import { useCallback, useRef, useState } from 'react';
import { useHubris } from '../../state/useHubris';
import type { LogUndo } from '../../storage/repository';
import { errorMessage } from './errors';
import { useNotify } from './notify';

export type ActivityLoggedHandler = (activityName: string, undo: LogUndo) => void;

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
      const undo = await actions.logActivity(activityId);
      onLogged(activityName, undo);
    } catch (cause) {
      notify({ message: errorMessage(cause), tone: 'error' });
    } finally {
      pendingWrites.current.delete(activityId);
      setPendingIds(new Set(pendingWrites.current));
    }
  }, [actions, notify, onLogged]);

  return { logActivity, pendingIds };
}
