import { createContext, useContext } from 'react';
import type { ActivityLog, DayHeatmapCell, Suggestion, TrackedActivity, WeeklyReport, WeeklyTrendPoint } from '@hubris/types';
import type { ActivityPatch, CreateActivityInput } from '../storage/repository';

export interface HubrisState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  now: Date;
  activities: TrackedActivity[];
  logs: ActivityLog[];
  report: WeeklyReport;
  suggestions: Suggestion[];
  trend: WeeklyTrendPoint[];
  heatmap: DayHeatmapCell[];
  onboardingComplete: boolean;
  actions: {
    createActivity(input: CreateActivityInput): Promise<TrackedActivity>;
    updateActivity(id: string, patch: ActivityPatch): Promise<TrackedActivity>;
    setArchived(id: string, archived: boolean): Promise<TrackedActivity>;
    deleteActivity(id: string): Promise<void>;
    logActivity(id: string, note?: string): Promise<ActivityLog>;
    undoLog(log: ActivityLog): Promise<void>;
    deleteLog(id: string): Promise<void>;
    exportBackup(): Promise<void>;
    importBackup(file: File, mode: 'replace' | 'merge'): Promise<{ activities: number; logs: number }>;
    eraseAll(): Promise<void>;
    completeOnboarding(withExamples: boolean): Promise<void>;
    retry(): Promise<void>;
  };
}
export const HubrisContext = createContext<HubrisState | null>(null);

export function useHubris() {
  const context = useContext(HubrisContext);
  if (!context) throw new Error('useHubris must be used within HubrisProvider.');
  return context;
}
