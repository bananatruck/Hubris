import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from './repository';

export const input = { name: '  Leetcode  ', category: 'career', timesPerWeek: 5, importance: 'high' } satisfies repo.CreateActivityInput;
beforeEach(async () => { await repo.eraseAll(); });

describe('repository', () => {
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
