import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from './repository';
import { getDB } from './db';
import { computeWeeklyReport } from '@hubris/core';

export const input = { name: '  Leetcode  ', category: 'career', timesPerWeek: 5, importance: 'high' } satisfies repo.CreateActivityInput;
beforeEach(async () => { await repo.eraseAll(); });

describe('repository', () => {
  it('creates activity history and retains each settings edit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 10, 16, 9));
      const created = await repo.createActivity(input);
      expect(created.versions).toEqual([{
        from: created.createdAt, category: 'career', timesPerWeek: 5, importance: 'high', archived: false,
      }]);

      vi.setSystemTime(new Date(2026, 10, 17, 9));
      const renamed = await repo.updateActivity(created.id, { name: 'Practice' });
      expect(renamed.versions).toEqual(created.versions);
      const revised = await repo.updateActivity(created.id, { timesPerWeek: 4 });
      expect(revised.versions).toHaveLength(2);
      expect(revised.versions?.[1]).toMatchObject({ from: new Date().toISOString(), timesPerWeek: 4 });

      vi.setSystemTime(new Date(2026, 10, 23, 9));
      const archived = await repo.setArchived(created.id, true);
      expect(archived.versions).toHaveLength(3);
      expect(archived.versions?.[2]).toMatchObject({ from: archived.updatedAt, timesPerWeek: 4, archived: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves settings for as-of reports earlier in the edited week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 10, 16, 9));
      const activity = await repo.createActivity(input);
      const asOf = new Date(2026, 10, 17, 9);
      vi.setSystemTime(new Date(2026, 10, 18, 9));
      const edited = await repo.updateActivity(activity.id, { timesPerWeek: 2 });

      expect(computeWeeklyReport([edited], [], asOf).categories.career.activities[0]?.goal).toBe(5);
      expect(computeWeeklyReport([edited], [], new Date()).categories.career.activities[0]?.goal).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates, trims, updates, archives, restores, and deletes activities', async () => {
    const created = await repo.createActivity(input);
    expect(created.name).toBe('Leetcode');
    expect(await repo.listActivities()).toEqual([created]);
    const updated = await repo.updateActivity(created.id, { name: 'Practice', timesPerWeek: 3 });
    expect(updated.name).toBe('Practice');
    expect(updated.createdAt).toBe(created.createdAt);
    expect((await repo.setArchived(created.id, true)).archived).toBe(true);
    expect((await repo.setArchived(created.id, false)).archived).toBe(false);
    await repo.deleteActivity(created.id);
    expect(await repo.listActivities()).toEqual([]);
  });

  it('adds, deletes and restores logs and cascade deletes only related logs', async () => {
    const first = await repo.createActivity(input);
    const second = await repo.createActivity({ ...input, name: 'Classes' });
    const at = new Date('2026-11-17T10:00:00Z');
    const log = await repo.addLog(first.id, 'Solved one', at);
    const retained = await repo.addLog(second.id);
    expect(log).toMatchObject({ activityId: first.id, note: 'Solved one', loggedAt: at.toISOString() });
    await repo.deleteLog(log.id);
    expect(await repo.listLogs()).toEqual([retained]);
    await repo.restoreLog(log);
    expect(await repo.listLogs()).toEqual(expect.arrayContaining([log, retained]));
    expect(await repo.listLogs()).toHaveLength(2);
    await repo.deleteActivity(first.id);
    expect(await repo.listLogs()).toEqual([retained]);
  });

  it('records deletion tombstones, removes restored log tombstones, and erases tombstones', async () => {
    const activity = await repo.createActivity(input);
    const log = await repo.addLog(activity.id);
    await repo.deleteLog(log.id);
    const db = await getDB();
    expect(await db.get('deletions', `log:${log.id}`)).toMatchObject({ kind: 'log', id: log.id });
    await repo.restoreLog(log);
    expect(await db.get('deletions', `log:${log.id}`)).toBeUndefined();

    await repo.deleteActivity(activity.id);
    expect(await db.get('deletions', `activity:${activity.id}`)).toMatchObject({ kind: 'activity', id: activity.id });
    expect(await db.get('deletions', `log:${log.id}`)).toMatchObject({ kind: 'log', id: log.id });
    await repo.eraseAll();
    expect(await db.getAll('deletions')).toEqual([]);
  });

  it.each([
    { name: ' ' }, { name: 'x'.repeat(61) }, { timesPerWeek: 0 }, { timesPerWeek: 100 },
    { timesPerWeek: 1.5 }, { category: 'entertainment' }, { importance: 'urgent' },
  ])('rejects invalid input %j', async (patch) => {
    // Exercise runtime validation at the storage boundary.
    const { activityInputSchema, validate } = await import('./validation');
    expect(() => validate(activityInputSchema, { ...input, ...patch })).toThrow(repo.ValidationError);
  });

  it('rejects log notes longer than 280 characters', async () => {
    const activity = await repo.createActivity(input);
    await expect(repo.addLog(activity.id, 'n'.repeat(281))).rejects.toThrow(repo.ValidationError);
  });

  it('validates updates and rejects missing activity logs', async () => {
    await expect(repo.createActivity({ ...input, name: '' })).rejects.toThrow(repo.ValidationError);
    const activity = await repo.createActivity(input);
    await expect(repo.updateActivity(activity.id, { name: '' })).rejects.toThrow(repo.ValidationError);
    await expect(repo.addLog('missing')).rejects.toThrow('Activity no longer exists');
    await expect(repo.updateActivity('missing', {})).rejects.toThrow(repo.ValidationError);
    await expect(repo.addLog(activity.id, undefined, new Date('invalid'))).rejects.toThrow(repo.ValidationError);
  });

  it('stores onboarding once and erases all stores', async () => {
    await repo.completeOnboarding(true);
    await repo.completeOnboarding(true);
    expect((await repo.listActivities()).map((activity) => activity.name).sort()).toEqual(['Classes', 'Leetcode']);
    expect(await repo.getMeta('onboardingComplete')).toBe(true);
    const activity = (await repo.listActivities())[0];
    await repo.addLog(activity.id);
    await repo.setMeta('other', true);
    await repo.eraseAll();
    expect(await repo.getMeta('other')).toBeUndefined();
    expect(await repo.listActivities()).toEqual([]);
    expect(await repo.listLogs()).toEqual([]);
  });

});
