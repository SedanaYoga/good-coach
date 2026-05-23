import type { Workout } from './workout';
import type { Activity } from './activity';

export interface CoachFeedbackPayload {
  workout: Workout;
  activity: Activity;
}

export interface DashboardResponse {
  setupRequired: boolean;
  connected?: boolean;
  athlete?: {
    raceDistance: string;
    raceDate: string;
    personality: 'encouraging' | 'strict' | 'data-driven';
    currentLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  daysUntilRace?: number;
  progressPercent?: number;
  completedWorkoutsCount?: number;
  totalWorkoutsCount?: number;
  totalDistanceKm?: string;
  currentWeekNum?: number;
  totalWeeks?: number;
  nextWorkout?: Workout | null;
  currentWeekWorkouts?: Workout[];
  recentActivities?: Activity[];
}
