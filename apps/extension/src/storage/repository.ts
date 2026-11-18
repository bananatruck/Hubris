import type { ActivityLog, TrackedActivity } from '@hubris/types';
import { getDB } from './db';
import { activityInputSchema, logSchema, validate, ValidationError } from './validation';

export { ValidationError } from './validation';
export type CreateActivityInput = Omit<TrackedActivity, 'id' | 'createdAt' | 'updatedAt' | 'archived'> & { archived?: boolean };
export type ActivityPatch = Partial<Omit<TrackedActivity, 'id' | 'createdAt' | 'updatedAt'>>;

export async function listActivities() {
  return (await getDB()).getAll('activities');
}
export async function listLogs() {
  return (await getDB()).getAll('logs');
}
export async function createActivity(input: CreateActivityInput) {
  const fields = validate(activityInputSchema, input);
  const now = new Date().toISOString();
  const activity: TrackedActivity = { ...fields, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  const db = await getDB();
  await db.add('activities', activity);
  return activity;
}
export async function updateActivity(id: string, patch: ActivityPatch) {
  const db = await getDB();
  const tx = db.transaction('activities', 'readwrite');
  const current = await tx.store.get(id);
  if (!current) throw new ValidationError('Activity no longer exists.');
  const { name, category, timesPerWeek, importance, archived } = current;
  const fields = validate(activityInputSchema, { name, category, timesPerWeek, importance, archived, ...patch });
  const updated = { ...current, ...fields, updatedAt: new Date().toISOString() };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}
export function setArchived(id: string, archived: boolean) {
  return updateActivity(id, { archived });
}
export async function deleteActivity(id: string) {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs'], 'readwrite');
  const keys = await tx.objectStore('logs').index('activityId').getAllKeys(id);
  await Promise.all(keys.map((key) => tx.objectStore('logs').delete(key)));
  await tx.objectStore('activities').delete(id);
  await tx.done;
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
  const tx = db.transaction(['activities', 'logs'], 'readwrite');
  if (!await tx.objectStore('activities').get(checked.activityId)) throw new ValidationError('Activity no longer exists.');
  await tx.objectStore('logs').put(checked);
  await tx.done;
}
export async function deleteLog(id: string) {
  await (await getDB()).delete('logs', id);
}
export async function getMeta(key: string) {
  return (await getDB()).get('meta', key);
}
export async function setMeta(key: string, value: boolean) {
  await (await getDB()).put('meta', value, key);
}
export async function eraseAll() {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta'], 'readwrite');
  await Promise.all([tx.objectStore('activities').clear(), tx.objectStore('logs').clear(), tx.objectStore('meta').clear()]);
  await tx.done;
}

export async function readSnapshot() {
  const db = await getDB();
  const tx = db.transaction(['activities', 'logs', 'meta']);
  const [activities, logs, onboardingComplete] = await Promise.all([
    tx.objectStore('activities').getAll(), tx.objectStore('logs').getAll(), tx.objectStore('meta').get('onboardingComplete'),
  ]);
  await tx.done;
  return { activities, logs, onboardingComplete: onboardingComplete ?? false };
}

export async function completeOnboarding(withExamples: boolean) {
  const db = await getDB();
  const tx = db.transaction(['activities', 'meta'], 'readwrite');
  if (await tx.objectStore('meta').get('onboardingComplete')) return tx.done;
  if (withExamples) {
    const now = new Date().toISOString();
    for (const input of [
      { name: 'Leetcode', timesPerWeek: 5, importance: 'high' },
      { name: 'Classes', timesPerWeek: 4, importance: 'medium' },
    ] satisfies Pick<TrackedActivity, 'name' | 'timesPerWeek' | 'importance'>[]) {
      await tx.objectStore('activities').add({
        ...input, id: crypto.randomUUID(), category: 'career', archived: false, createdAt: now, updatedAt: now,
      });
    }
  }
  await tx.objectStore('meta').put(true, 'onboardingComplete');
  await tx.done;
}
