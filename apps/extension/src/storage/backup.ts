import { z } from 'zod';
import type { HubrisExport } from '@hubris/types';
import { getDB } from './db';
import { activitySchema, logSchema, ValidationError } from './validation';
import { readSnapshot } from './repository';

const backupSchema = z.object({
  app: z.literal('hubris'),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  activities: z.array(activitySchema),
  logs: z.array(logSchema),
}).strict().superRefine((data, ctx) => {
  const activityIds = new Set<string>();
  const logIds = new Set<string>();
  data.activities.forEach((activity, index) => {
    if (activityIds.has(activity.id)) ctx.addIssue({ code: 'custom', path: ['activities', index, 'id'], message: 'Duplicate activity id.' });
    activityIds.add(activity.id);
  });
  data.logs.forEach((log, index) => {
    if (logIds.has(log.id)) ctx.addIssue({ code: 'custom', path: ['logs', index, 'id'], message: 'Duplicate log id.' });
    if (!activityIds.has(log.activityId)) ctx.addIssue({ code: 'custom', path: ['logs', index, 'activityId'], message: 'Log points to an unknown activity.' });
    logIds.add(log.id);
  });
});

export type BackupParseResult = { success: true; data: HubrisExport } | { success: false; errors: string[] };
export function parseBackup(text: string): BackupParseResult {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { success: false, errors: ['This file is not valid JSON.'] }; }
  const result = backupSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'Backup'}: ${issue.message}`) };
}

export async function exportData(): Promise<HubrisExport> {
  const { activities, logs } = await readSnapshot();
  return { app: 'hubris', schemaVersion: 1, exportedAt: new Date().toISOString(), activities, logs };
}

export async function importData(data: HubrisExport, mode: 'replace' | 'merge') {
  const checked = backupSchema.safeParse(data);
  if (!checked.success) throw new ValidationError(checked.error.issues.map((issue) => issue.message).join(' '));
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta'], 'readwrite');
  let activities = 0;
  let logs = 0;
  if (mode === 'replace') {
    await Promise.all([tx.objectStore('activities').clear(), tx.objectStore('logs').clear(), tx.objectStore('meta').clear()]);
  }
  for (const activity of checked.data.activities) {
    const existing = await tx.objectStore('activities').get(activity.id);
    if (!existing || Date.parse(activity.updatedAt) > Date.parse(existing.updatedAt)) {
      await tx.objectStore('activities').put(activity);
      activities++;
    }
  }
  for (const log of checked.data.logs) {
    if (!await tx.objectStore('logs').get(log.id)) {
      await tx.objectStore('logs').add(log);
      logs++;
    }
  }
  await tx.objectStore('meta').put(true, 'onboardingComplete');
  await tx.done;
  return { activities, logs };
}

export function createBackupDownload(data: HubrisExport) {
  return {
    blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename: `hubris-backup-${data.exportedAt.slice(0, 10)}.json`,
  };
}

export function downloadBackup(data: HubrisExport) {
  const { blob, filename } = createBackupDownload(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
