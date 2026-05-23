import type { Activity } from './activity';

export type WorkoutType = 'interval' | 'easy_run' | 'long_run' | 'strength' | 'rest';
export type WorkoutStatus = 'pending' | 'completed' | 'skipped';

export interface Workout {
  id: string;
  week_number: number;
  day_number: number;
  workout_type: WorkoutType;
  title: string;
  description: string;
  distance_target: number | null;
  duration_target: number | null;
  status?: WorkoutStatus;
  coach_feedback?: string | null;
  activity_id?: number | null;
  calculated_date?: string;
  activity?: Activity;
}


