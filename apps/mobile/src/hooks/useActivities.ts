// ============================================
// Hubris - Activities Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, generateId, ActivityRecord } from '../db/database';

export type Category = 'career' | 'entertainment' | 'hobbies-habits' | 'health';

export function useActivities(category?: Category) {
    const [activities, setActivities] = useState<ActivityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            const db = await getDatabase();

            let query = 'SELECT * FROM activities WHERE visibility != ?';
            const params: (string | Category)[] = ['archived'];

            if (category) {
                query += ' AND category = ?';
                params.push(category);
            }

            query += ' ORDER BY visibility DESC, name ASC';

            const result = await db.getAllAsync<ActivityRecord>(query, params);
            setActivities(result);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Failed to fetch activities:', err);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const create = useCallback(async (data: Omit<ActivityRecord, 'id' | 'created_at' | 'updated_at'>) => {
        const id = await createActivity(data);
        await fetchActivities();
        return id;
    }, [fetchActivities]);

    const update = useCallback(async (id: string, data: Partial<Omit<ActivityRecord, 'id' | 'created_at'>>) => {
        await updateActivity(id, data);
        await fetchActivities();
    }, [fetchActivities]);

    return { activities, loading, error, refetch: fetchActivities, createActivity: create, updateActivity: update };
}

export function usePinnedActivities() {
    const [activities, setActivities] = useState<ActivityRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                const db = await getDatabase();
                const result = await db.getAllAsync<ActivityRecord>(
                    'SELECT * FROM activities WHERE visibility = ? ORDER BY name ASC LIMIT 6',
                    ['pinned']
                );
                setActivities(result);
            } catch (err) {
                console.error('Failed to fetch pinned activities:', err);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, []);

    return { activities, loading };
}

export function useRecentActivities(limit: number = 10) {
    const [activities, setActivities] = useState<(ActivityRecord & { last_logged: string })[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRecent = useCallback(async () => {
        try {
            const db = await getDatabase();
            const result = await db.getAllAsync<ActivityRecord & { last_logged: string }>(
                `SELECT a.*, MAX(l.logged_at) as last_logged 
                 FROM activities a
                 LEFT JOIN log_entries l ON a.id = l.activity_id
                 WHERE a.visibility != 'archived'
                 GROUP BY a.id
                 ORDER BY last_logged DESC NULLS LAST
                 LIMIT ?`,
                [limit]
            );
            setActivities(result);
        } catch (err) {
            console.error('Failed to fetch recent activities:', err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchRecent();
    }, [fetchRecent]);

    return { activities, loading, refetch: fetchRecent };
}

export function useActivity(id: string) {
    const [activity, setActivity] = useState<ActivityRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                const db = await getDatabase();
                const result = await db.getFirstAsync<ActivityRecord>(
                    'SELECT * FROM activities WHERE id = ?',
                    [id]
                );
                setActivity(result ?? null);
            } catch (err) {
                console.error('Failed to fetch activity:', err);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, [id]);

    return { activity, loading };
}

export async function createActivity(
    data: Omit<ActivityRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
    const db = await getDatabase();
    const id = generateId('act');
    const now = new Date().toISOString();

    await db.runAsync(
        `INSERT INTO activities (
            id, name, category, sub_category, color, template, 
            frequency_rate, frequency_target, visibility, 
            image_url, external_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            data.name,
            data.category,
            data.sub_category || null,
            data.color,
            data.template,
            data.frequency_rate,
            data.frequency_target,
            data.visibility,
            data.image_url || null,
            data.external_id || null,
            now,
            now,
        ]
    );

    return id;
}

export async function updateActivity(
    id: string,
    data: Partial<Omit<ActivityRecord, 'id' | 'created_at'>>
): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [now];

    if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
    }
    if (data.category !== undefined) {
        fields.push('category = ?');
        values.push(data.category);
    }
    if (data.color !== undefined) {
        fields.push('color = ?');
        values.push(data.color);
    }
    if (data.visibility !== undefined) {
        fields.push('visibility = ?');
        values.push(data.visibility);
    }

    values.push(id);

    await db.runAsync(
        `UPDATE activities SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
}

export async function deleteActivity(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM activities WHERE id = ?', [id]);
}
