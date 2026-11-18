import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeWeeklyReport, computeWeeklyTrend, generateLogHeatmap, generateWeeklySuggestions, getWeekBounds } from '@hubris/core';
import * as repository from '../storage/repository';
import { downloadBackup, exportData, importData, parseBackup } from '../storage/backup';
import { isDataChangedMessage, notifyDataChanged } from '../shared/messages';
import { HubrisContext, type HubrisState } from './useHubris';

type Snapshot = Awaited<ReturnType<typeof repository.readSnapshot>>;
const emptySnapshot: Snapshot = { activities: [], logs: [], onboardingComplete: false };

export function HubrisProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [status, setStatus] = useState<HubrisState['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const generation = useRef({ version: 0 });

  const reload = useCallback(async () => {
    const request = ++generation.current.version;
    try {
      const data = await repository.readSnapshot();
      if (request !== generation.current.version) return;
      setSnapshot(data);
      setNow(new Date());
      setError(null);
      setStatus('ready');
    } catch (cause) {
      if (request !== generation.current.version) return;
      setError(cause instanceof Error ? cause.message : 'Could not read local data. Try again.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const requests = generation.current;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void reload(); });
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hubris');
    if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isDataChangedMessage(event.data)) void reload();
    };
    const timer = setInterval(() => { void reload(); }, 60_000);
    return () => {
      cancelled = true;
      requests.version++;
      channel?.close();
      clearInterval(timer);
    };
  }, [reload]);

  const actions = useMemo<HubrisState['actions']>(() => {
    async function write<T>(operation: () => Promise<T>): Promise<T> {
      const result = await operation();
      notifyDataChanged();
      await reload();
      return result;
    }
    return {
      createActivity: (input) => write(() => repository.createActivity(input)),
      updateActivity: (id, patch) => write(() => repository.updateActivity(id, patch)),
      setArchived: (id, archived) => write(() => repository.setArchived(id, archived)),
      deleteActivity: (id) => write(() => repository.deleteActivity(id)),
      logActivity: (id, note) => write(() => repository.addLog(id, note)),
      // Undo reverses the newly created log; restoreLog remains available for deletion undo.
      undoLog: (log) => write(() => repository.deleteLog(log.id)),
      deleteLog: (id) => write(() => repository.deleteLog(id)),
      exportBackup: async () => { downloadBackup(await exportData()); },
      importBackup: async (file, mode) => {
        const parsed = parseBackup(await file.text());
        if (!parsed.success) throw new repository.ValidationError(parsed.errors.join('\n'));
        return write(() => importData(parsed.data, mode));
      },
      eraseAll: () => write(repository.eraseAll),
      completeOnboarding: (withExamples) => write(() => repository.completeOnboarding(withExamples)),
      retry: reload,
    };
  }, [reload]);

  const value = useMemo<HubrisState>(() => ({
    status, error, now, ...snapshot, actions,
    report: computeWeeklyReport(snapshot.activities, snapshot.logs, now),
    suggestions: generateWeeklySuggestions(snapshot.activities, snapshot.logs, now),
    trend: computeWeeklyTrend(snapshot.activities, snapshot.logs, now, 8),
    heatmap: generateLogHeatmap(snapshot.logs, 84, getWeekBounds(now).end),
  }), [status, error, now, snapshot, actions]);

  return <HubrisContext.Provider value={value}>{children}</HubrisContext.Provider>;
}
