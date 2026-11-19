import { openDB, type DBSchema } from 'idb';
import type { ActivityLog, DeletionTombstone, TrackedActivity } from '@hubris/types';
import { withTransaction } from './transaction';

interface HubrisDatabase extends DBSchema {
  activities: { key: string; value: TrackedActivity };
  logs: {
    key: string;
    value: ActivityLog;
    indexes: { activityId: string; loggedAt: string };
  };
  meta: { key: string; value: boolean | number | string };
  deletions: {
    key: string;
    value: DeletionTombstone;
  };
}

let connection: ReturnType<typeof openDB<HubrisDatabase>> | undefined;

export function getDB() {
  connection ??= openDB<HubrisDatabase>('hubris', 2, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('activities', { keyPath: 'id' });
        const logs = db.createObjectStore('logs', { keyPath: 'id' });
        logs.createIndex('activityId', 'activityId');
        logs.createIndex('loggedAt', 'loggedAt');
        db.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        db.createObjectStore('deletions', { keyPath: 'key' });
      }
      if (oldVersion === 1) {
        void withTransaction(tx, async () => {
          let cursor = await tx.objectStore('activities').openCursor();
          while (cursor) {
            const activity = cursor.value;
            await cursor.update({
              ...activity,
              versions: [{
                from: activity.createdAt,
                category: activity.category,
                timesPerWeek: activity.timesPerWeek,
                importance: activity.importance,
                archived: activity.archived,
              }],
            });
            cursor = await cursor.continue();
          }
        }).catch(() => {
          // Aborting the upgrade rejects the opening request below.
        });
      }
    },
    blocking() {
      void connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }).catch((cause: unknown) => {
    connection = undefined;
    throw cause;
  });
  return connection;
}
