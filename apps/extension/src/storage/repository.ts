import type { ActivityLog, DeletionTombstone, TrackedActivity } from '@hubris/types';
import { getDB } from './db';
import { withTransaction } from './transaction';
import { activityInputSchema, logSchema, validate, ValidationError } from './validation';

export { ValidationError } from './validation';
export type CreateActivityInput = Omit<TrackedActivity, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'versions'> & { archived?: boolean };
export type ActivityPatch = Partial<Omit<TrackedActivity, 'id' | 'createdAt' | 'updatedAt' | 'versions'>>;

/**
 * A merged backup can carry an updatedAt from a device whose clock ran ahead.
 * Local edits must still compare as newer, or merging that backup again would revert them.
 */
function nextUpdatedAt(previous: string) {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

function tombstone(kind: DeletionTombstone['kind'], id: string, deletedAt: string): DeletionTombstone {
  return { key: `${kind}:${id}`, kind, id, deletedAt };
}

export async function listActivities() {
  return (await getDB()).getAll('activities');
}
export async function listLogs() {
  return (await getDB()).getAll('logs');
}
export async function createActivity(input: CreateActivityInput) {
  const fields = validate(activityInputSchema, input);
  const now = new Date().toISOString();
  const activity: TrackedActivity = {
    ...fields,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    versions: [{ from: now, category: fields.category, timesPerWeek: fields.timesPerWeek, importance: fields.importance, archived: fields.archived }],
  };
  const db = await getDB();
  await db.add('activities', activity);
  return activity;
}
export async function updateActivity(id: string, patch: ActivityPatch) {
  const db = await getDB();
  const tx = db.transaction('activities', 'readwrite');
  return withTransaction(tx, async () => {
    const current = await tx.store.get(id);
    if (!current) throw new ValidationError('Activity no longer exists.');
    const { name, category, timesPerWeek, importance, archived } = current;
    const fields = validate(activityInputSchema, { name, category, timesPerWeek, importance, archived, ...patch });
    const effectiveAt = new Date().toISOString();
    const updatedAt = nextUpdatedAt(current.updatedAt);
    const settingsChanged = category !== fields.category
      || timesPerWeek !== fields.timesPerWeek
      || importance !== fields.importance
      || archived !== fields.archived;
    const existingVersions = current.versions?.length
      ? [...current.versions]
      : [{ from: current.createdAt, category, timesPerWeek, importance, archived }];
    let versions = existingVersions;
    if (settingsChanged) {
      versions = existingVersions.filter((version) => Date.parse(version.from) <= Date.parse(effectiveAt));
      const version = {
        from: effectiveAt,
        category: fields.category,
        timesPerWeek: fields.timesPerWeek,
        importance: fields.importance,
        archived: fields.archived,
      };
      versions.push(version);
    }
    const updated = { ...current, ...fields, versions, updatedAt };
    await tx.store.put(updated);
    return updated;
  });
}
export function setArchived(id: string, archived: boolean) {
  return updateActivity(id, { archived });
}
export async function deleteActivity(id: string) {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'deletions'], 'readwrite');
  return withTransaction(tx, async () => {
    const activity = await tx.objectStore('activities').get(id);
    const previousDeletion = await tx.objectStore('deletions').get(`activity:${id}`);
    const deletedAt = new Date(Math.max(
      Date.now(),
      activity ? Date.parse(activity.updatedAt) + 1 : 0,
      previousDeletion ? Date.parse(previousDeletion.deletedAt) : 0,
    )).toISOString();
    const logs = await tx.objectStore('logs').index('activityId').getAll(id);
    await Promise.all(logs.flatMap((log) => [
      tx.objectStore('logs').delete(log.id),
      tx.objectStore('deletions').put(tombstone('log', log.id, deletedAt)),
    ]));
    await tx.objectStore('activities').delete(id);
    await tx.objectStore('deletions').put(tombstone('activity', id, deletedAt));
  });
}
export async function addLog(activityId: string, note?: string, at: Date = new Date()) {
  if (Number.isNaN(at.getTime())) throw new ValidationError('Choose a valid log date.');
  const log: ActivityLog = validate(logSchema, {
    id: crypto.randomUUID(), activityId, loggedAt: at.toISOString(), ...(note === undefined ? {} : { note }),
  });
  await restoreLog(log);
  return log;
}
export async function restoreLog(log: ActivityLog) {
  const checked = validate(logSchema, log);
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'deletions'], 'readwrite');
  return withTransaction(tx, async () => {
    if (!await tx.objectStore('activities').get(checked.activityId)) throw new ValidationError('Activity no longer exists.');
    await tx.objectStore('logs').put(checked);
    await tx.objectStore('deletions').delete(`log:${checked.id}`);
  });
}
export async function deleteLog(id: string) {
  const db = await getDB();
  const tx = db.transaction(['logs', 'deletions'], 'readwrite');
  return withTransaction(tx, async () => {
    const deletedAt = new Date().toISOString();
    await tx.objectStore('logs').delete(id);
    await tx.objectStore('deletions').put(tombstone('log', id, deletedAt));
  });
}
export async function getMeta(key: string) {
  return (await getDB()).get('meta', key);
}
export async function setMeta(key: string, value: boolean) {
  await (await getDB()).put('meta', value, key);
}
export async function eraseAll() {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta', 'deletions'], 'readwrite');
  return withTransaction(tx, async () => {
    await Promise.all([
      tx.objectStore('activities').clear(),
      tx.objectStore('logs').clear(),
      tx.objectStore('meta').clear(),
      tx.objectStore('deletions').clear(),
    ]);
  });
}

export async function readSnapshot() {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta']);
  return withTransaction(tx, async () => {
    const [activities, logs, onboardingComplete] = await Promise.all([
      tx.objectStore('activities').getAll(), tx.objectStore('logs').getAll(), tx.objectStore('meta').get('onboardingComplete'),
    ]);
    return { activities, logs, onboardingComplete: onboardingComplete === true };
  });
}

export async function completeOnboarding(withExamples: boolean) {
  const db = await getDB();
  const tx = db.transaction(['activities', 'meta'], 'readwrite');
  return withTransaction(tx, async () => {
    if (await tx.objectStore('meta').get('onboardingComplete')) return;
    if (withExamples) {
      const now = new Date().toISOString();
      for (const input of [
        { name: 'Leetcode', timesPerWeek: 5, importance: 'high' },
        { name: 'Classes', timesPerWeek: 4, importance: 'medium' },
      ] satisfies Pick<TrackedActivity, 'name' | 'timesPerWeek' | 'importance'>[]) {
        await tx.objectStore('activities').add({
          ...input,
          id: crypto.randomUUID(),
          category: 'career',
          archived: false,
          createdAt: now,
          updatedAt: now,
          versions: [{
            from: now, category: 'career', timesPerWeek: input.timesPerWeek, importance: input.importance, archived: false,
          }],
        });
      }
    }
    await tx.objectStore('meta').put(true, 'onboardingComplete');
  });
}
