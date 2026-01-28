// ============================================
// Hubris - Plans Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, generateId, PlanRecord } from '../db/database';

export interface PlanWithActivity extends PlanRecord {
    activity_name: string;
    activity_color: string;
    activity_template: string;
}

export function useTodayPlans() {
    const [plans, setPlans] = useState<PlanWithActivity[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPlans = useCallback(async () => {
        try {
            setLoading(true);
            const db = await getDatabase();

            // Get today's date range
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const result = await db.getAllAsync<PlanWithActivity>(
                `SELECT p.*, a.name as activity_name, a.color as activity_color, a.template as activity_template
                 FROM plans p
                 JOIN activities a ON p.activity_id = a.id
                 WHERE p.scheduled_for >= ? AND p.scheduled_for < ?
                 ORDER BY p.scheduled_for ASC`,
                [startOfDay.toISOString(), endOfDay.toISOString()]
            );
            setPlans(result);
        } catch (err) {
            console.error('Failed to fetch today plans:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    return { plans, loading, refetch: fetchPlans };
}

export function useUpcomingPlans(activityId?: string, limit: number = 10) {
    const [plans, setPlans] = useState<PlanWithActivity[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPlans = useCallback(async () => {
        try {
            const db = await getDatabase();
            const now = new Date().toISOString();

            let query = `
                SELECT p.*, a.name as activity_name, a.color as activity_color, a.template as activity_template
                FROM plans p
                JOIN activities a ON p.activity_id = a.id
                WHERE p.scheduled_for >= ? AND p.status = 'planned'
            `;
            const params: (string | number)[] = [now];

            if (activityId) {
                query += ' AND p.activity_id = ?';
                params.push(activityId);
            }

            query += ' ORDER BY p.scheduled_for ASC LIMIT ?';
            params.push(limit);

            const result = await db.getAllAsync<PlanWithActivity>(query, params);
            setPlans(result);
        } catch (err) {
            console.error('Failed to fetch upcoming plans:', err);
        } finally {
            setLoading(false);
        }
    }, [activityId, limit]);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    return { plans, loading, refetch: fetchPlans };
}

export async function createPlan(
    activityId: string,
    scheduledFor: Date,
    durationMinutes?: number
): Promise<string> {
    const db = await getDatabase();
    const id = generateId('plan');

    await db.runAsync(
        'INSERT INTO plans (id, activity_id, scheduled_for, duration_minutes, status) VALUES (?, ?, ?, ?, ?)',
        [id, activityId, scheduledFor.toISOString(), durationMinutes ?? null, 'planned']
    );

    return id;
}

export async function completePlan(id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        'UPDATE plans SET status = ?, completed_at = ? WHERE id = ?',
        ['completed', now, id]
    );
}

export async function skipPlan(id: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
        'UPDATE plans SET status = ? WHERE id = ?',
        ['skipped', id]
    );
}

export async function deletePlan(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM plans WHERE id = ?', [id]);
}

// Reschedule a plan
export async function reschedulePlan(id: string, newDate: Date): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
        'UPDATE plans SET scheduled_for = ?, status = ? WHERE id = ?',
        [newDate.toISOString(), 'planned', id]
    );
}
