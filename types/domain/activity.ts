export type StravaSportType =
  | 'Run'
  | 'TrailRun'
  | 'VirtualRun'
  | 'RoadRun'
  | 'WeightTraining'
  | 'Workout'
  | 'Strength'
  | 'Gym'
  | 'Crossfit'
  | 'Yoga'
  | 'Walk'
  | string;

export interface Activity {
  id: number;
  name: string;
  sport_type: StravaSportType;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  matched_workout_id: string | null;
  coach_feedback: string | null;
  synced_at: string;
}
