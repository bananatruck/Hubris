import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubrisExport } from '@hubris/types';
import { computeWeeklyReport } from '@hubris/core';
import {
  createActivity, addLog, addUndoableLog, deleteActivity, deleteLog, eraseAll, listActivities, listLogs, getMeta, updateActivity,
  readDataRevision, undoLog,
} from './repository';
import { createBackupDownload, exportData, importData, parseBackup } from './backup';

beforeEach(eraseAll);
async function fixture() {
  const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
  await addLog(activity.id, 'Session');
  return exportData();
}

it('round trips export, parse, replace and downloadable JSON', async () => {
  const data = await fixture();
  expect(data.schemaVersion).toBe(2);
  expect(data.deletions).toEqual([]);
  const parsed = parseBackup(JSON.stringify(data));
  expect(parsed).toEqual({ success: true, data });
  await createActivity({ name: 'Extra', category: 'career', timesPerWeek: 1, importance: 'low' });
  const revision = await readDataRevision();
  expect(await importData(data, 'replace')).toEqual({ activities: 1, logs: 1 });
  expect(await readDataRevision()).toBe(revision + 1);
  expect(await listActivities()).toEqual(data.activities);
  expect(await listLogs()).toEqual(data.logs);
  expect(await getMeta('onboardingComplete')).toBe(true);
  const download = createBackupDownload(data);
  expect(download.filename).toBe(`hubris-backup-${data.exportedAt.slice(0, 10)}.json`);
  expect(JSON.parse(await download.blob.text())).toEqual(data);
});

it('counts imports in both modes, keeps the count across an erase, and blocks undoing a pre-import log', async () => {
  const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
  const undo = await addUndoableLog(activity.id);
  const before = undo.importGeneration;
  const data = await exportData();

  await importData(data, 'replace');
  expect(await getMeta('importGeneration')).toBe(before + 1);
  await expect(undoLog(undo)).rejects.toThrow(
    'An import changed your data after this log, so Undo is no longer available. You can delete the log in History.',
  );
  expect(await listLogs()).toEqual([undo.log]);

  await importData(data, 'merge');
  expect(await getMeta('importGeneration')).toBe(before + 2);
  await eraseAll();
  expect(await getMeta('importGeneration')).toBe(before + 2);
});

describe('Undo across imports', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });
  const undoBlocked = 'An import changed your data after this log, so Undo is no longer available. You can delete the log in History.';

  it('blocks Undo for a log that an import in the same millisecond replaced', async () => {
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
    const undo = await addUndoableLog(activity.id);
    await importData(await exportData(), 'replace');
    await expect(undoLog(undo)).rejects.toThrow(undoBlocked);
    expect(await listLogs()).toEqual([undo.log]);
  });

  it('blocks Undo for a pre-import log after the clock moved back', async () => {
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
    const undo = await addUndoableLog(activity.id);
    const data = await exportData();
    vi.setSystemTime(new Date('2026-11-18T09:00:00.000Z'));
    await importData(data, 'replace');
    await expect(undoLog(undo)).rejects.toThrow(undoBlocked);
    expect(await listLogs()).toEqual([undo.log]);
  });

  it('keeps Undo for logs created after an import, in the same millisecond or backdated', async () => {
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
    const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
    await importData(await exportData(), 'merge');
    const sameMillisecond = await addUndoableLog(activity.id);
    const backdated = await addUndoableLog(activity.id, undefined, new Date('2026-11-17T08:00:00.000Z'));
    await undoLog(sameMillisecond);
    await undoLog(backdated);
    expect(await listLogs()).toEqual([]);
  });
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
    schemaVersion: { ...data, schemaVersion: 3 },
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

it('keeps locally deleted activities and logs deleted when merging an older export', async () => {
  const first = await createActivity({ name: 'First', category: 'career', timesPerWeek: 1, importance: 'high' });
  const second = await createActivity({ name: 'Second', category: 'health', timesPerWeek: 1, importance: 'medium' });
  const firstLog = await addLog(first.id);
  const secondLog = await addLog(second.id);
  const oldExport = await exportData();

  await deleteActivity(first.id);
  await deleteLog(secondLog.id);
  await importData(oldExport, 'merge');

  expect((await listActivities()).map(({ id }) => id)).toEqual([second.id]);
  expect((await listLogs()).map(({ id }) => id)).not.toContain(firstLog.id);
  expect((await listLogs()).map(({ id }) => id)).not.toContain(secondLog.id);
});

it('does not resurrect a deleted activity imported from an ahead clock', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
  try {
    const activity = await createActivity({ name: 'Ahead', category: 'career', timesPerWeek: 1, importance: 'high' });
    const ahead = new Date(Date.now() + 10 * 60_000).toISOString();
    const data = await exportData();
    const aheadData: HubrisExport = {
      ...data,
      activities: data.activities.map((item) => ({ ...item, updatedAt: ahead })),
    };
    await importData(aheadData, 'merge');
    await deleteActivity(activity.id);
    await deleteActivity(activity.id);

    await importData(aheadData, 'merge');

    expect(await listActivities()).toEqual([]);
    expect((await exportData()).deletions.find(({ key }) => key === `activity:${activity.id}`)?.deletedAt)
      .toBe(new Date(Date.parse(ahead) + 1).toISOString());
  } finally {
    vi.useRealTimers();
  }
});

it('does not import a log when its activity is suppressed by a tombstone', async () => {
  const activity = await createActivity({ name: 'Deleted', category: 'career', timesPerWeek: 1, importance: 'high' });
  const oldExport = await exportData();
  oldExport.logs.push({ id: 'remote-log', activityId: activity.id, loggedAt: oldExport.exportedAt });
  await deleteActivity(activity.id);

  await importData(oldExport, 'merge');

  expect(await listActivities()).toEqual([]);
  expect(await listLogs()).toEqual([]);
  expect(parseBackup(JSON.stringify(await exportData())).success).toBe(true);
});

it('exports activities, logs, and deletions from one transaction', async () => {
  await fixture();
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
  transaction.mockClear();

  await exportData();

  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction.mock.calls[0]?.[0]).toEqual(['activities', 'logs', 'deletions']);
});

it('applies incoming tombstones to local records', async () => {
  const activity = await createActivity({ name: 'Gym', category: 'health', timesPerWeek: 3, importance: 'high' });
  const log = await addLog(activity.id);
  const data = await exportData();
  const deletedAt = new Date(Date.parse(activity.updatedAt) + 1).toISOString();

  await importData({
    ...data,
    activities: [],
    logs: [],
    deletions: [{ key: `activity:${activity.id}`, kind: 'activity', id: activity.id, deletedAt }],
  }, 'merge');

  expect(await listActivities()).toEqual([]);
  expect(await listLogs()).toEqual([]);
  expect((await exportData()).deletions).toEqual(expect.arrayContaining([
    { key: `activity:${activity.id}`, kind: 'activity', id: activity.id, deletedAt },
    { key: `log:${log.id}`, kind: 'log', id: log.id, deletedAt },
  ]));
  expect(log.activityId).toBe(activity.id);
});

it('converts and imports schema version 1 backups', async () => {
  const data = await fixture();
  const legacy = {
    app: 'hubris' as const,
    schemaVersion: 1 as const,
    exportedAt: data.exportedAt,
    activities: data.activities.map((activity) => {
      const legacyActivity = { ...activity };
      delete legacyActivity.versions;
      return legacyActivity;
    }),
    logs: data.logs,
  };

  const parsed = parseBackup(JSON.stringify(legacy));
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(parsed.data.schemaVersion).toBe(2);
  expect(parsed.data.deletions).toEqual([]);
  expect(parsed.data.activities[0].versions).toEqual([{
    from: legacy.activities[0].createdAt,
    category: legacy.activities[0].category,
    timesPerWeek: legacy.activities[0].timesPerWeek,
    importance: legacy.activities[0].importance,
    archived: legacy.activities[0].archived,
  }]);
  await importData(parsed.data, 'replace');
  expect(await listActivities()).toEqual(parsed.data.activities);
});

it.each(['empty versions', 'unsorted versions', 'unsorted sub-millisecond versions', 'last version mismatch', 'bad deletion key'])(
  'rejects invalid schema version 2 history: %s',
  async (kind) => {
    const data = await fixture();
    const first = data.activities[0];
    const variants: Record<string, unknown> = {
      'empty versions': { ...data, activities: [{ ...first, versions: [] }] },
      'unsorted versions': {
        ...data,
        activities: [{
          ...first,
          versions: [
            { ...first.versions?.[0], from: '2026-02-01T00:00:00.000Z' },
            { ...first.versions?.[0], from: '2026-01-01T00:00:00.000Z' },
          ],
        }],
      },
      'unsorted sub-millisecond versions': {
        ...data,
        activities: [{
          ...first,
          versions: [
            { ...first.versions?.[0], from: '2026-01-01T00:00:00.1239Z' },
            { ...first.versions?.[0], from: '2026-01-01T00:00:00.1231Z' },
          ],
        }],
      },
      'last version mismatch': {
        ...data,
        activities: [{ ...first, versions: [{ ...first.versions?.[0], timesPerWeek: first.timesPerWeek + 1 }] }],
      },
      'bad deletion key': {
        ...data,
        deletions: [{ key: 'wrong', kind: 'log', id: 'x', deletedAt: data.exportedAt }],
      },
    };
    expect(parseBackup(JSON.stringify(variants[kind])).success).toBe(false);
  },
);
it.each([
  ['equal', '2026-01-01T00:00:00.1231Z', '2026-01-01T00:00:00.1231Z'],
  ['sorted below a millisecond', '2026-01-01T00:00:00.1231Z', '2026-01-01T00:00:00.1239Z'],
])('accepts schema version 2 history with %s version times', async (_kind, earlier, later) => {
  const data = await fixture();
  const first = data.activities[0];
  const history = { ...data, activities: [{ ...first, versions: [{ ...first.versions?.[0], from: earlier }, { ...first.versions?.[0], from: later }] }] };
  expect(parseBackup(JSON.stringify(history)).success).toBe(true);
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
      app: 'hubris', schemaVersion: 2, exportedAt: ahead,
      activities: [{ ...activity, name: 'Leetcode from the other device', updatedAt: ahead }],
      logs: [],
      deletions: [],
    };
    await importData(backup, 'merge');
    expect((await listActivities())[0].updatedAt).toBe(ahead);
    const edited = await updateActivity(activity.id, { name: 'Leetcode edited here', timesPerWeek: 4 });
    expect(Date.now()).toBeLessThan(Date.parse(ahead));
    expect(Date.parse(edited.updatedAt)).toBeGreaterThan(Date.parse(ahead));
    expect(computeWeeklyReport([edited], [], new Date()).categories.career.activities[0]?.goal).toBe(4);

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
