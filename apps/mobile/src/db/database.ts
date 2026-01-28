// ============================================
// Hubris - Database Initialization
// ============================================

import * as SQLite from 'expo-sqlite';
import {
    ALL_TABLES,
    CREATE_INDEXES,
    SEED_ACTIVITIES,
} from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    db = await SQLite.openDatabaseAsync('hubris.db');
    return db;
}

export async function initializeDatabase(): Promise<void> {
    const database = await getDatabase();

    // Enable foreign keys
    await database.execAsync('PRAGMA foreign_keys = ON;');

    // Create all tables
    for (const tableSQL of ALL_TABLES) {
        await database.execAsync(tableSQL);
    }

    // Create indexes
    await database.execAsync(CREATE_INDEXES);

    // Check if we need to seed data
    const result = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM activities'
    );

    if (result && result.count === 0) {
        // Seed sample data for demo
        await database.execAsync(SEED_ACTIVITIES);
        console.log('Database seeded with sample activities');
    }

    console.log('Database initialized successfully');
}

export async function resetDatabase(): Promise<void> {
    const database = await getDatabase();
    await database.execAsync('PRAGMA foreign_keys = OFF;');
    await database.execAsync('DROP TABLE IF EXISTS log_entries;');
    await database.execAsync('DROP TABLE IF EXISTS plans;');
    await database.execAsync('DROP TABLE IF EXISTS goals;');
    await database.execAsync('DROP TABLE IF EXISTS activities;');
    await database.execAsync('PRAGMA foreign_keys = ON;');
    await initializeDatabase();
}

// Helper function to generate unique IDs
export function generateId(prefix: string = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Type definitions for database records
export interface ActivityRecord {
    id: string;
    name: string;
    category: 'career' | 'entertainment' | 'hobbies-habits' | 'health';
    sub_category?: string | null;
    color: string;
    template: 'binary' | 'count' | 'duration' | 'rating' | 'progress' | 'session';
    frequency_rate: string;
    frequency_target: number;
    priority: 'high' | 'medium' | 'low';
    reminder_enabled: number; // 0 or 1
    reminder_time?: string | null; // HH:mm format
    reminder_days?: string | null; // JSON array of day numbers
    visibility: 'active' | 'pinned' | 'hidden' | 'archived';
    image_url?: string | null;
    external_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface LogEntryRecord {
    id: string;
    activity_id: string;
    value: string | null;
    note: string | null;
    thoughts?: string | null;
    logged_at: string;
}

export interface PlanRecord {
    id: string;
    activity_id: string;
    scheduled_for: string;
    duration_minutes: number | null;
    status: 'planned' | 'completed' | 'skipped';
    completed_at: string | null;
}

export interface GoalRecord {
    id: string;
    activity_id: string;
    title: string;
    target_value: string | null;
    target_date: string | null;
    status: 'active' | 'completed' | 'abandoned';
    created_at: string;
    completed_at: string | null;
}
