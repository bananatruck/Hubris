// ============================================
// Hubris - Database Schema
// ============================================

export const SCHEMA_VERSION = 2;

export const CREATE_ACTIVITIES_TABLE = `
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('career', 'entertainment', 'hobbies-habits', 'health')),
  sub_category TEXT, -- 'movie', 'tv', 'manga', 'anime', 'book' (for entertainment)
  color TEXT NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('binary', 'count', 'duration', 'rating', 'progress', 'session')),
  frequency_rate TEXT NOT NULL,
  frequency_target INTEGER DEFAULT 1,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  reminder_enabled INTEGER DEFAULT 0,
  reminder_time TEXT, -- HH:mm format
  reminder_days TEXT, -- JSON array of day numbers [0-6]
  visibility TEXT DEFAULT 'active' CHECK (visibility IN ('active', 'pinned', 'hidden', 'archived')),
  image_url TEXT, -- For media covers
  external_id TEXT, -- For API linkage (TMDB ID, MAL ID, etc.)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_LOG_ENTRIES_TABLE = `
CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  value TEXT,
  note TEXT,
  thoughts TEXT, -- Blog-like entry
  logged_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);
`;

export const CREATE_PLANS_TABLE = `
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped')),
  completed_at TEXT,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);
`;

export const CREATE_GOALS_TABLE = `
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_value TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);
`;

// Indexes for performance
export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_log_entries_activity ON log_entries(activity_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_logged_at ON log_entries(logged_at);
CREATE INDEX IF NOT EXISTS idx_plans_scheduled ON plans(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_visibility ON activities(visibility);
`;

// Sample seed data for demo
export const SEED_ACTIVITIES = `
INSERT OR IGNORE INTO activities (id, name, category, sub_category, color, template, frequency_rate, frequency_target, priority, visibility) VALUES
  ('act_leetcode', 'LeetCode', 'career', NULL, '#3B82F6', 'count', 'daily', 2, 'high', 'pinned'),
  ('act_system_design', 'System Design', 'career', NULL, '#8B5CF6', 'duration', 'weekly', 1, 'medium', 'active'),
  ('act_gym', 'Gym', 'health', NULL, '#EF4444', 'session', '3x-weekly', 3, 'high', 'pinned'),
  ('act_diet', 'Diet', 'health', NULL, '#10B981', 'binary', 'daily', 1, 'high', 'active'),
  ('act_socializing', 'Socializing', 'health', NULL, '#F59E0B', 'duration', 'weekly', 2, 'medium', 'active'),
  ('act_meditation', 'Meditation', 'hobbies-habits', NULL, '#8B5CF6', 'duration', 'daily', 1, 'medium', 'pinned'),
  ('act_drawing', 'Drawing', 'hobbies-habits', NULL, '#22C55E', 'duration', '2x-weekly', 2, 'low', 'active'),
  ('act_reading', 'Reading', 'hobbies-habits', NULL, '#F59E0B', 'progress', 'daily', 1, 'high', 'pinned'),
  ('act_one_piece', 'One Piece', 'entertainment', 'manga', '#EC4899', 'count', 'weekly', 1, 'medium', 'active'),
  ('act_movies', 'Movies', 'entertainment', 'movie', '#F59E0B', 'count', 'weekly', 1, 'low', 'active');
`;

export const ALL_TABLES = [
  CREATE_ACTIVITIES_TABLE,
  CREATE_LOG_ENTRIES_TABLE,
  CREATE_PLANS_TABLE,
  CREATE_GOALS_TABLE,
];
