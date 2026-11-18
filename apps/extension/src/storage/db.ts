import { openDB, type DBSchema } from 'idb';
import type { ActivityLog, TrackedActivity } from '@hubris/types';

interface HubrisDatabase extends DBSchema {
  activities: { key: string; value: TrackedActivity };
  logs: {
    key: string;
    value: ActivityLog;
    indexes: { activityId: string; loggedAt: string };
  };
  meta: { key: string; value: boolean };
}

let connection: ReturnType<typeof openDB<HubrisDatabase>> | undefined;

export function getDB() {
  connection ??= openDB<HubrisDatabase>('hubris', 1, {
    upgrade(db) {
      db.createObjectStore('activities', { keyPath: 'id' });
      const logs = db.createObjectStore('logs', { keyPath: 'id' });
      logs.createIndex('activityId', 'activityId');
      logs.createIndex('loggedAt', 'loggedAt');
      db.createObjectStore('meta');
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
