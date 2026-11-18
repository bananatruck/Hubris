import { beforeEach, expect, it } from 'vitest';
import type { HubrisExport } from '@hubris/types';
import { createActivity, addLog, eraseAll, listActivities, listLogs, getMeta } from './repository';
import { createBackupDownload, exportData, importData, parseBackup } from './backup';

beforeEach(eraseAll);
async function fixture() {
  const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
  await addLog(activity.id, 'Session');
  return exportData();
}

it('round trips export, parse, replace and downloadable JSON', async () => {
  const data = await fixture();
  const parsed = parseBackup(JSON.stringify(data));
  expect(parsed).toEqual({ success: true, data });
  await createActivity({ name: 'Extra', category: 'career', timesPerWeek: 1, importance: 'low' });
  expect(await importData(data, 'replace')).toEqual({ activities: 1, logs: 1 });
  expect(await listActivities()).toEqual(data.activities);
  expect(await listLogs()).toEqual(data.logs);
  expect(await getMeta('onboardingComplete')).toBe(true);
  const download = createBackupDownload(data);
  expect(download.filename).toBe(`hubris-backup-${data.exportedAt.slice(0, 10)}.json`);
  expect(JSON.parse(await download.blob.text())).toEqual(data);
});

it('merges newer activities, retains newer local records and dedupes logs', async () => {
  const data = await fixture();
  const newer: HubrisExport = { ...data, activities: data.activities.map((a) => ({ ...a, name: 'Updated', updatedAt: '2099-01-01T00:00:00Z' })) };
  expect(await importData(newer, 'merge')).toEqual({ activities: 1, logs: 0 });
  expect(await importData(data, 'merge')).toEqual({ activities: 0, logs: 0 });
  expect((await listActivities())[0]?.name).toBe('Updated');
  expect(await listLogs()).toHaveLength(1);
});

it.each(['app', 'schemaVersion', 'dangling', 'duplicateActivity', 'duplicateLog', 'date', 'field'])('rejects invalid backup: %s', async (kind) => {
  const data = await fixture();
  const variants: Record<string, unknown> = {
    app: { ...data, app: 'other' },
    schemaVersion: { ...data, schemaVersion: 2 },
    dangling: { ...data, activities: [] },
    duplicateActivity: { ...data, activities: [...data.activities, ...data.activities] },
    duplicateLog: { ...data, logs: [...data.logs, ...data.logs] },
    date: { ...data, exportedAt: 'yesterday' },
    field: { ...data, activities: data.activities.map((a) => ({ ...a, archived: 'yes' })) },
  };
  const result = parseBackup(JSON.stringify(variants[kind]));
  expect(result.success).toBe(false);
  if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
  expect(await listActivities()).toEqual(data.activities);
});
it('rejects non-JSON', () => {
  expect(parseBackup('{')).toEqual({ success: false, errors: ['This file is not valid JSON.'] });
});
