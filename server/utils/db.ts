import Database from 'better-sqlite3'
import { join } from 'path'
import type { AthleteConfig } from 'types/domain/athlete'
import type { Activity } from 'types/domain/activity'
import type { Workout } from 'types/domain/workout'

let dbInstance: Database.Database | null = null

export function getDb() {
  if (dbInstance) return dbInstance

  const config = useRuntimeConfig()
  // Resolve database path relative to root if it is relative
  const dbPath = config.dbPath.startsWith('.')
    ? join(process.cwd(), config.dbPath)
    : config.dbPath

  // Ensure DB instance is created
  dbInstance = new Database(dbPath, { verbose: console.log })

  // Enable WAL mode for performance
  dbInstance.pragma('journal_mode = WAL')

  // Initialize tables
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS athlete_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      strava_athlete_id INTEGER,
      strava_access_token TEXT,
      strava_refresh_token TEXT,
      strava_expires_at INTEGER,
      race_distance TEXT, -- '5K', '10K', 'half_marathon', 'marathon'
      race_date TEXT, -- 'YYYY-MM-DD'
      target_pace TEXT, -- e.g. '5:30'
      coach_personality TEXT DEFAULT 'encouraging', -- 'encouraging', 'strict', 'data-driven'
      current_level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate'
      weekly_runs_target INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY, -- Strava activity ID
      name TEXT,
      sport_type TEXT, -- 'Run', 'WeightTraining', etc.
      start_date TEXT, -- ISO string YYYY-MM-DD
      distance REAL, -- in meters
      moving_time INTEGER, -- in seconds
      elapsed_time INTEGER, -- in seconds
      average_speed REAL, -- m/s
      average_heartrate REAL,
      max_heartrate REAL,
      matched_workout_id TEXT, -- linked workout ID
      coach_feedback TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY, -- e.g. 'w1d1', 'w1d2'
      week_number INTEGER,
      day_number INTEGER, -- 1 to 7
      workout_type TEXT, -- 'interval', 'easy_run', 'long_run', 'strength', 'rest'
      title TEXT,
      description TEXT,
      distance_target REAL, -- in meters
      duration_target INTEGER, -- in seconds
      status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'skipped'
      coach_feedback TEXT,
      activity_id INTEGER, -- linked strava activity
      FOREIGN KEY(activity_id) REFERENCES activities(id)
    );
  `)

  return dbInstance
}

// Helper: Get Athlete Config
export function getAthleteConfig(): AthleteConfig | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM athlete_config WHERE id = 1').get() as
    | AthleteConfig
    | undefined
}

// Helper: Save Athlete Config
export function saveAthleteConfig(config: Partial<AthleteConfig>): void {
  const db = getDb()
  const current = getAthleteConfig()

  if (current) {
    const keys = Object.keys(config) as Array<keyof AthleteConfig>
    const setClause = keys.map((k) => `${String(k)} = ?`).join(', ')
    const values = keys.map((k) => config[k] ?? null)
    db.prepare(`UPDATE athlete_config SET ${setClause} WHERE id = 1`).run(
      ...values,
    )
  } else {
    const keys = ['id', ...Object.keys(config)]
    const placeholders = keys.map(() => '?').join(', ')
    const values = [1, ...Object.values(config)]
    db.prepare(
      `INSERT INTO athlete_config (${keys.join(', ')}) VALUES (${placeholders})`,
    ).run(...values)
  }
}

// Helper: Save Activity
export function saveActivity(
  activity: Partial<Activity> & { id: number },
): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO activities (
      id, name, sport_type, start_date, distance, moving_time, elapsed_time, 
      average_speed, average_heartrate, max_heartrate, matched_workout_id, coach_feedback, synced_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    ) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      distance=excluded.distance,
      moving_time=excluded.moving_time,
      average_speed=excluded.average_speed,
      average_heartrate=excluded.average_heartrate,
      max_heartrate=excluded.max_heartrate
  `)

  stmt.run(
    activity.id,
    activity.name || null,
    activity.sport_type || null,
    activity.start_date || null,
    activity.distance || 0,
    activity.moving_time || 0,
    activity.elapsed_time || 0,
    activity.average_speed || 0,
    activity.average_heartrate || null,
    activity.max_heartrate || null,
    activity.matched_workout_id || null,
    activity.coach_feedback || null,
    new Date().toISOString(),
  )
}

// Helper: Get Activities
export function getActivities(): Activity[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM activities ORDER BY start_date DESC')
    .all() as Activity[]
}

// Helper: Save Workouts Plan
export function saveWorkoutsPlan(workouts: Workout[]): void {
  const db = getDb()
  const deleteStmt = db.prepare('DELETE FROM workouts')
  const insertStmt = db.prepare(`
    INSERT INTO workouts (
      id, week_number, day_number, workout_type, title, description, distance_target, duration_target, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, 'pending'
    )
  `)

  // Run in a transaction
  const transaction = db.transaction((plan: Workout[]) => {
    deleteStmt.run()
    for (const w of plan) {
      insertStmt.run(
        w.id,
        w.week_number,
        w.day_number,
        w.workout_type,
        w.title,
        w.description,
        w.distance_target || null,
        w.duration_target || null,
      )
    }
  })

  transaction(workouts)
}

// Helper: Update Workout
export function updateWorkout(id: string, updates: Partial<Workout>): void {
  const db = getDb()
  const keys = Object.keys(updates) as Array<keyof Workout>
  const setClause = keys.map((k) => `${String(k)} = ?`).join(', ')
  const values = keys.map((k) => updates[k] ?? null)
  db.prepare(`UPDATE workouts SET ${setClause} WHERE id = ?`).run(...values, id)
}

// Helper: Get Workouts Plan
export function getWorkoutsPlan(): Workout[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM workouts ORDER BY week_number ASC, day_number ASC')
    .all() as Workout[]
}
