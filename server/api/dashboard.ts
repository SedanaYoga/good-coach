import { getAthleteConfig, getActivities, getWorkoutsPlan } from '../utils/db';
import { getWorkoutDate } from '../utils/coach';
import type { DashboardResponse } from 'types/domain/coach';

export default defineEventHandler(async (event): Promise<DashboardResponse> => {
  const athlete = getAthleteConfig();
  if (!athlete) {
    return { setupRequired: true };
  }

  const workouts = getWorkoutsPlan();
  const activities = getActivities();

  // If no workouts have been generated yet, require setup
  if (workouts.length === 0) {
    return { 
      setupRequired: true, 
      connected: !!athlete.strava_refresh_token 
    };
  }

  // Calculate and assign dates for each workout
  const totalWeeks = Math.max(...workouts.map(w => w.week_number));
  for (const w of workouts) {
    w.calculated_date = getWorkoutDate(athlete.race_date, totalWeeks, w.week_number, w.day_number);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Find next workout (either scheduled for today, or the first pending one)
  let nextWorkout = workouts.find(w => w.calculated_date === todayStr);
  if (!nextWorkout) {
    // Look for the next upcoming pending workout
    nextWorkout = workouts.find(w => w.status === 'pending');
  }

  // Calculate plan metrics
  const completedRuns = workouts.filter(w => w.status === 'completed');
  const totalWorkouts = workouts.length;
  const progressPercent = Math.round((completedRuns.length / totalWorkouts) * 100) || 0;

  // Calculate total mileage completed (sum of distance of matched activities in meters -> km)
  const totalDistanceMeters = activities
    .filter(a => a.matched_workout_id)
    .reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalDistanceKm = (totalDistanceMeters / 1000).toFixed(1);

  // Calculate days until race
  const raceDateObj = new Date(athlete.race_date + 'T23:59:59');
  const now = new Date();
  const timeDiff = raceDateObj.getTime() - now.getTime();
  const daysUntilRace = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

  // Group workouts by current week
  const w1d1 = workouts.find(w => w.week_number === 1 && w.day_number === 1);
  let currentWeekNum = 1;
  if (w1d1 && w1d1.calculated_date) {
    const startDate = new Date(w1d1.calculated_date + 'T00:00:00');
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    currentWeekNum = Math.min(totalWeeks, Math.max(1, Math.floor(diffDays / 7) + 1));
  }

  const currentWeekWorkouts = workouts.filter(w => w.week_number === currentWeekNum);

  return {
    setupRequired: false,
    connected: !!athlete.strava_refresh_token,
    athlete: {
      raceDistance: athlete.race_distance,
      raceDate: athlete.race_date,
      personality: athlete.coach_personality,
      currentLevel: athlete.current_level,
    },
    daysUntilRace,
    progressPercent,
    completedWorkoutsCount: completedRuns.length,
    totalWorkoutsCount: totalWorkouts,
    totalDistanceKm,
    currentWeekNum,
    totalWeeks,
    nextWorkout,
    currentWeekWorkouts,
    recentActivities: activities.slice(0, 5)
  };
});
