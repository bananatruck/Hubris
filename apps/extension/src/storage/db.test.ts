import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';

afterEach(async () => {
  const request = indexedDB.open('hubris');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  await deleteDB('hubris');
  vi.resetModules();
});

it('migrates version 1 activities to version histories', async () => {
  await deleteDB('hubris');
  const legacy = {
    id: 'legacy',
    name: 'Legacy',
    category: 'career',
    timesPerWeek: 5,
    importance: 'high',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
  const log = { id: 'legacy-log', activityId: legacy.id, loggedAt: '2026-01-01T12:00:00.000Z' };
  const old = await openDB('hubris', 1, {
    upgrade(db) {
      db.createObjectStore('activities', { keyPath: 'id' });
      const logs = db.createObjectStore('logs', { keyPath: 'id' });
      logs.createIndex('activityId', 'activityId');
      logs.createIndex('loggedAt', 'loggedAt');
      db.createObjectStore('meta');
    },
  });
  await old.put('activities', legacy);
  await old.put('logs', log);
  await old.put('meta', true, 'onboardingComplete');
  old.close();

  vi.resetModules();
  const { getDB } = await import('./db');
  const migrated = await getDB();

  expect(migrated.version).toBe(2);
  expect([...migrated.objectStoreNames]).toContain('deletions');
  expect(await migrated.getAll('logs')).toEqual([log]);
  expect(await migrated.get('meta', 'onboardingComplete')).toBe(true);
  expect(await migrated.getAll('deletions')).toEqual([]);
  expect(await migrated.getAllFromIndex('logs', 'activityId', legacy.id)).toEqual([log]);
  expect(await migrated.get('activities', legacy.id)).toEqual({
    ...legacy,
    versions: [{
      from: legacy.createdAt,
      category: legacy.category,
      timesPerWeek: legacy.timesPerWeek,
      importance: legacy.importance,
      archived: legacy.archived,
    }],
  });
  migrated.close();
});

it('rolls back an interrupted migration and can retry without losing legacy data', async () => {
  const legacy = { id: 'legacy', createdAt: '2026-01-01T00:00:00.000Z', category: 'career', timesPerWeek: 5, importance: 'high', archived: false };
  const old = await openDB('hubris', 1, {
    upgrade(db) {
      db.createObjectStore('activities', { keyPath: 'id' });
      const logs = db.createObjectStore('logs', { keyPath: 'id' });
      logs.createIndex('activityId', 'activityId');
      logs.createIndex('loggedAt', 'loggedAt');
      db.createObjectStore('meta');
    },
  });
  await old.put('activities', legacy);
  old.close();
  vi.resetModules();
  const { getDB } = await import('./db');
  const update = vi.spyOn(IDBCursor.prototype, 'update').mockImplementationOnce(() => {
    throw new Error('Migration write failed.');
  });
  try {
    const outcome = await getDB().then((db) => { db.close(); return 'opened'; }, () => 'failed');
    expect(outcome).toBe('failed');
  } finally {
    update.mockRestore();
  }
  const preserved = await openDB('hubris');
  expect(preserved.version).toBe(1);
  expect(await preserved.get('activities', legacy.id)).toEqual(legacy);
  preserved.close();

  const migrated = await getDB();
  expect(migrated.version).toBe(2);
  expect(await migrated.get('activities', legacy.id)).toMatchObject({ versions: [{ from: legacy.createdAt }] });
  migrated.close();
});
