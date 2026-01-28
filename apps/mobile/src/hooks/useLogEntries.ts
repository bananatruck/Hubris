// ============================================
// Hubris - Log Entries Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, generateId, LogEntryRecord } from '../db/database';

export interface LogEntryWithActivity extends LogEntryRecord {
    activity_name: string;
    activity_color: string;
}

export function useLogEntries(activityId?: string, limit: number = 50) {
    const [logs, setLogs] = useState<LogEntryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            const db = await getDatabase();

            let query = 'SELECT * FROM log_entries';
            const params: (string | number)[] = [];

            if (activityId) {
                query += ' WHERE activity_id = ?';
                params.push(activityId);
            }

            query += ' ORDER BY logged_at DESC LIMIT ?';
            params.push(limit);

            const result = await db.getAllAsync<LogEntryRecord>(query, params);
            setLogs(result);
        } catch (err) {
            console.error('Failed to fetch log entries:', err);
        } finally {
            setLoading(false);
        }
    }, [activityId, limit]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return { logs, loading, refetch: fetchLogs };
}

export function useRecentLogs(limit: number = 10) {
    const [logs, setLogs] = useState<LogEntryWithActivity[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            const db = await getDatabase();
            const result = await db.getAllAsync<LogEntryWithActivity>(
                `SELECT l.*, a.name as activity_name, a.color as activity_color
                 FROM log_entries l
                 JOIN activities a ON l.activity_id = a.id
                 ORDER BY l.logged_at DESC
                 LIMIT ?`,
                [limit]
            );
            setLogs(result);
        } catch (err) {
            console.error('Failed to fetch recent logs:', err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return { logs, loading, refetch: fetchLogs };
}

export async function createLogEntry(
    activityId: string,
    value?: string | number | null,
    note?: string | null,
    thoughts?: string | null,
    loggedAt?: Date
): Promise<string> {
    const db = await getDatabase();
    const id = generateId('log');
    const timestamp = (loggedAt || new Date()).toISOString();

    // Convert value to string for storage
    const valueStr = value !== undefined && value !== null ? String(value) : null;

    await db.runAsync(
        'INSERT INTO log_entries (id, activity_id, value, note, thoughts, logged_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, activityId, valueStr, note ?? null, thoughts ?? null, timestamp]
    );

    // Also update the updated_at timestamp of the activity
    await db.runAsync(
        'UPDATE activities SET updated_at = ? WHERE id = ?',
        [timestamp, activityId]
    );

    return id;
}

export async function deleteLogEntry(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM log_entries WHERE id = ?', [id]);
}

// Get log count for an activity within a date range
export async function getLogCount(
    activityId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM log_entries 
         WHERE activity_id = ? AND logged_at >= ? AND logged_at <= ?`,
        [activityId, startDate.toISOString(), endDate.toISOString()]
    );
    return result?.count ?? 0;
}

// Get daily log counts for heatmap
export async function getDailyLogCounts(
    activityId: string,
    days: number = 84 // 12 weeks
): Promise<Map<string, number>> {
    const db = await getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.getAllAsync<{ date: string; count: number }>(
        `SELECT DATE(logged_at) as date, COUNT(*) as count
         FROM log_entries
         WHERE activity_id = ? AND logged_at >= ?
         GROUP BY DATE(logged_at)`,
        [activityId, startDate.toISOString()]
    );

    const counts = new Map<string, number>();
    result.forEach((row) => {
        counts.set(row.date, row.count);
    });

    return counts;
}
