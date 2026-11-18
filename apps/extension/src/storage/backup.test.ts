import { beforeEach, expect, it, vi } from 'vitest';
import type { HubrisExport } from '@hubris/types';
import { createActivity, addLog, eraseAll, listActivities, listLogs, getMeta, updateActivity } from './repository';
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

it('merges an activity whose sub-millisecond timestamp is newer', async () => {
  const data = await fixture();
  const existing: HubrisExport = {
    ...data,
    activities: data.activities.map((activity) => ({ ...activity, updatedAt: '2026-01-01T00:00:00.1230Z' })),
  };
  await importData(existing, 'replace');
  const newer: HubrisExport = {
    ...existing,
    activities: existing.activities.map((activity) => ({
      ...activity, name: 'Sub-millisecond edit', updatedAt: '2026-01-01T00:00:00.1239Z',
    })),
  };

  expect(await importData(newer, 'merge')).toEqual({ activities: 1, logs: 0 });
  expect((await listActivities())[0].name).toBe('Sub-millisecond edit');
});

it('treats equivalent full-precision timestamps with different offsets as equal', async () => {
  const data = await fixture();
  const existing: HubrisExport = {
    ...data,
    activities: data.activities.map((activity) => ({ ...activity, updatedAt: '2026-01-01T00:00:00.123900Z' })),
  };
  await importData(existing, 'replace');
  const equivalent: HubrisExport = {
    ...existing,
    activities: existing.activities.map((activity) => ({
      ...activity, name: 'Equivalent edit', updatedAt: '2025-12-31T19:00:00.1239-05:00',
    })),
  };

  expect(await importData(equivalent, 'merge')).toEqual({ activities: 0, logs: 0 });
  expect((await listActivities())[0].name).toBe('Gym');
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

it('keeps a local edit after merging a backup from a device whose clock ran ahead', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  try {
    const activity = await createActivity({ name: 'Leetcode', category: 'career', timesPerWeek: 5, importance: 'high' });
    const ahead = new Date(Date.now() + 10 * 60_000).toISOString();
    const backup: HubrisExport = {
      app: 'hubris', schemaVersion: 1, exportedAt: ahead,
      activities: [{ ...activity, name: 'Leetcode from the other device', updatedAt: ahead }],
      logs: [],
    };
    await importData(backup, 'merge');
    expect((await listActivities())[0].updatedAt).toBe(ahead);
    const edited = await updateActivity(activity.id, { name: 'Leetcode edited here' });
    expect(Date.now()).toBeLessThan(Date.parse(ahead));
    expect(Date.parse(edited.updatedAt)).toBeGreaterThan(Date.parse(ahead));

    await importData(backup, 'merge');
    expect((await listActivities())[0].name).toBe('Leetcode edited here');
  } finally {
    vi.useRealTimers();
  }
});

it('preserves the original put error and rolls back an aborted replace import', async () => {
  const previous = await fixture();
  const failure = new Error('Put failed.');
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore) {
    this.transaction.abort();
    throw failure;
  });
  try {
    await expect(importData(previous, 'replace')).rejects.toBe(failure);
  } finally {
    put.mockRestore();
  }
  expect(await listActivities()).toEqual(previous.activities);
  expect(await listLogs()).toEqual(previous.logs);
  expect(await getMeta('onboardingComplete')).toBeUndefined();
});

it('preserves the original put error and lets the transaction helper roll back replace', async () => {
  const previous = await fixture();
  const failure = new Error('Put failed without an explicit abort.');
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw failure;
  });
  try {
    await expect(importData(previous, 'replace')).rejects.toBe(failure);
  } finally {
    put.mockRestore();
  }
  expect(await listActivities()).toEqual(previous.activities);
  expect(await listLogs()).toEqual(previous.logs);
  expect(await getMeta('onboardingComplete')).toBeUndefined();
});
