import { z } from 'zod';
import type { DeletionTombstone, HubrisExport, TrackedActivity } from '@hubris/types';
import { getDB } from './db';
import { readImportGeneration, withTransaction } from './transaction';
import { activitySchema, activityVersionSchema, logSchema, ValidationError } from './validation';

const versionedActivitySchema = activitySchema.extend({
  versions: z.array(activityVersionSchema).min(1),
}).superRefine((activity, ctx) => {
  for (let index = 1; index < activity.versions.length; index++) {
    if (compareTimestamps(activity.versions[index - 1].from, activity.versions[index].from) > 0) {
      ctx.addIssue({ code: 'custom', path: ['versions', index, 'from'], message: 'Activity versions must be sorted by from.' });
    }
  }
  const last = activity.versions.at(-1);
  if (last && (
    last.category !== activity.category
    || last.timesPerWeek !== activity.timesPerWeek
    || last.importance !== activity.importance
    || last.archived !== activity.archived
  )) {
    ctx.addIssue({ code: 'custom', path: ['versions'], message: 'The last activity version must match the current settings.' });
  }
});

const deletionSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(['activity', 'log']),
  id: z.string().min(1),
  deletedAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((deletion, ctx) => {
  if (deletion.key !== `${deletion.kind}:${deletion.id}`) {
    ctx.addIssue({ code: 'custom', path: ['key'], message: 'Deletion key must match its kind and id.' });
  }
});

const legacyBackupSchema = z.object({
  app: z.literal('hubris'),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  activities: z.array(activitySchema.omit({ versions: true })),
  logs: z.array(logSchema),
}).strict();

const currentBackupSchema = z.object({
  app: z.literal('hubris'),
  schemaVersion: z.literal(2),
  exportedAt: z.iso.datetime({ offset: true }),
  activities: z.array(versionedActivitySchema),
  logs: z.array(logSchema),
  deletions: z.array(deletionSchema),
}).strict();

function validateRelations(
  data: { activities: { id: string }[]; logs: { id: string; activityId: string }[]; deletions?: DeletionTombstone[] },
  ctx: z.RefinementCtx,
) {
  const activityIds = new Set<string>();
  const logIds = new Set<string>();
  const deletionKeys = new Set<string>();
  data.activities.forEach((activity, index) => {
    if (activityIds.has(activity.id)) ctx.addIssue({ code: 'custom', path: ['activities', index, 'id'], message: 'Duplicate activity id.' });
    activityIds.add(activity.id);
  });
  data.logs.forEach((log, index) => {
    if (logIds.has(log.id)) ctx.addIssue({ code: 'custom', path: ['logs', index, 'id'], message: 'Duplicate log id.' });
    if (!activityIds.has(log.activityId)) ctx.addIssue({ code: 'custom', path: ['logs', index, 'activityId'], message: 'Log points to an unknown activity.' });
    logIds.add(log.id);
  });
  data.deletions?.forEach((deletion, index) => {
    if (deletionKeys.has(deletion.key)) ctx.addIssue({ code: 'custom', path: ['deletions', index, 'key'], message: 'Duplicate deletion key.' });
    deletionKeys.add(deletion.key);
  });
}

const checkedLegacyBackupSchema = legacyBackupSchema.superRefine(validateRelations);
const checkedCurrentBackupSchema = currentBackupSchema.superRefine(validateRelations);
const backupSchema = z.union([checkedLegacyBackupSchema, checkedCurrentBackupSchema]);

export type BackupParseResult = { success: true; data: HubrisExport } | { success: false; errors: string[] };
export function parseBackup(text: string): BackupParseResult {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { success: false, errors: ['This file is not valid JSON.'] }; }
  const result = backupSchema.safeParse(value);
  if (!result.success) {
    return { success: false, errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'Backup'}: ${issue.message}`) };
  }
  if (result.data.schemaVersion === 2) return { success: true, data: result.data };
  return {
    success: true,
    data: {
      ...result.data,
      schemaVersion: 2,
      activities: result.data.activities.map((activity): TrackedActivity => ({
        ...activity,
        versions: [{
          from: activity.createdAt,
          category: activity.category,
          timesPerWeek: activity.timesPerWeek,
          importance: activity.importance,
          archived: activity.archived,
        }],
      })),
      deletions: [],
    },
  };
}

export async function exportData(): Promise<HubrisExport> {
  const tx = (await getDB()).transaction(['activities', 'logs', 'deletions']);
  return withTransaction(tx, async () => {
    const [activities, logs, deletions] = await Promise.all([
      tx.objectStore('activities').getAll(),
      tx.objectStore('logs').getAll(),
      tx.objectStore('deletions').getAll(),
    ]);
    return { app: 'hubris', schemaVersion: 2, exportedAt: new Date().toISOString(), activities, logs, deletions };
  });
}

function compareTimestamps(left: string, right: string) {
  const leftMilliseconds = Date.parse(left);
  const rightMilliseconds = Date.parse(right);
  if (leftMilliseconds !== rightMilliseconds) return leftMilliseconds > rightMilliseconds ? 1 : -1;

  const fractionalDigits = (value: string) =>
    (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').slice(3);
  const leftExtra = fractionalDigits(left);
  const rightExtra = fractionalDigits(right);
  const width = Math.max(leftExtra.length, rightExtra.length);
  const normalizedLeft = leftExtra.padEnd(width, '0');
  const normalizedRight = rightExtra.padEnd(width, '0');
  return normalizedLeft === normalizedRight ? 0 : normalizedLeft > normalizedRight ? 1 : -1;
}

export async function importData(data: HubrisExport, mode: 'replace' | 'merge') {
  const checked = checkedCurrentBackupSchema.safeParse(data);
  if (!checked.success) throw new ValidationError(checked.error.issues.map((issue) => issue.message).join(' '));
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta', 'deletions'], 'readwrite');
  return withTransaction(tx, async () => {
    let activities = 0;
    let logs = 0;
    const revision = await tx.objectStore('meta').get('dataRevision');
    const importGeneration = await readImportGeneration(tx.objectStore('meta'));
    if (mode === 'replace') {
      await Promise.all([
        tx.objectStore('activities').clear(),
        tx.objectStore('logs').clear(),
        tx.objectStore('meta').clear(),
        tx.objectStore('deletions').clear(),
      ]);
    }
    for (const activity of checked.data.activities) {
      const existing = await tx.objectStore('activities').get(activity.id);
      const localDeletion = mode === 'merge'
        ? await tx.objectStore('deletions').get(`activity:${activity.id}`)
        : undefined;
      if (
        (!localDeletion || compareTimestamps(localDeletion.deletedAt, activity.updatedAt) < 0)
        && (!existing || compareTimestamps(activity.updatedAt, existing.updatedAt) > 0)
      ) {
        await tx.objectStore('activities').put(activity);
        activities++;
      }
    }
    for (const log of checked.data.logs) {
      const localDeletion = mode === 'merge'
        ? await tx.objectStore('deletions').get(`log:${log.id}`)
        : undefined;
      if (!localDeletion
        && await tx.objectStore('activities').get(log.activityId)
        && !await tx.objectStore('logs').get(log.id)) {
        await tx.objectStore('logs').add(log);
        logs++;
      }
    }
    for (const deletion of checked.data.deletions) {
      const existingDeletion = await tx.objectStore('deletions').get(deletion.key);
      if (!existingDeletion || compareTimestamps(deletion.deletedAt, existingDeletion.deletedAt) > 0) {
        await tx.objectStore('deletions').put(deletion);
      }
      if (deletion.kind === 'log') {
        await tx.objectStore('logs').delete(deletion.id);
        continue;
      }
      const localActivity = await tx.objectStore('activities').get(deletion.id);
      if (localActivity && compareTimestamps(deletion.deletedAt, localActivity.updatedAt) >= 0) {
        const relatedLogs = await tx.objectStore('logs').index('activityId').getAll(deletion.id);
        for (const log of relatedLogs) {
          await tx.objectStore('logs').delete(log.id);
          const logDeletion = {
            key: `log:${log.id}`,
            kind: 'log' as const,
            id: log.id,
            deletedAt: deletion.deletedAt,
          };
          const existingLogDeletion = await tx.objectStore('deletions').get(logDeletion.key);
          if (!existingLogDeletion || compareTimestamps(logDeletion.deletedAt, existingLogDeletion.deletedAt) > 0) {
            await tx.objectStore('deletions').put(logDeletion);
          }
        }
        await tx.objectStore('activities').delete(deletion.id);
      }
    }
    await tx.objectStore('meta').put(true, 'onboardingComplete');
    await tx.objectStore('meta').put(importGeneration + 1, 'importGeneration');
    await tx.objectStore('meta').put((typeof revision === 'number' ? revision : 0) + 1, 'dataRevision');
    return { activities, logs };
  });
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
