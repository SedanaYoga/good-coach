import { getAthleteConfig, getWorkoutsPlan, getActivities } from '../utils/db';
import { getWorkoutDate } from '../utils/coach';
import type { Workout } from 'types/domain/workout';
import type { Activity } from 'types/domain/activity';

export default defineEventHandler(async (event) => {
  const athlete = getAthleteConfig();
  if (!athlete) {
    return { plan: [], totalWeeks: 0 };
  }

  const workouts: Workout[] = getWorkoutsPlan();
  const activities: Activity[] = getActivities();

  if (workouts.length === 0) {
    return { plan: [], totalWeeks: 0 };
  }

  const totalWeeks = Math.max(...workouts.map(w => w.week_number));
  
  // Map activities by ID for fast lookup
  const activityMap = new Map<number, Activity>();
  for (const act of activities) {
    activityMap.set(act.id, act);
  }

  // Group workouts by week number
  const planByWeek: Record<number, Workout[]> = {};

  for (const w of workouts) {
    w.calculated_date = getWorkoutDate(athlete.race_date, totalWeeks, w.week_number, w.day_number);
    
    // Attach completed activity statistics if applicable
    if (w.activity_id && activityMap.has(w.activity_id)) {
      w.activity = activityMap.get(w.activity_id);
    }

    if (!planByWeek[w.week_number]) {
      planByWeek[w.week_number] = [];
    }
    const weekWorkouts = planByWeek[w.week_number];
    if (weekWorkouts) {
      weekWorkouts.push(w);
    }
  }

  // Format weeks into a list sorted by week number
  const formattedPlan = Object.keys(planByWeek)
    .map(Number)
    .sort((a, b) => a - b)
    .map(weekNum => ({
      weekNumber: weekNum,
      workouts: planByWeek[weekNum]
    }));

  return {
    plan: formattedPlan,
    totalWeeks,
    raceDate: athlete.race_date,
    raceDistance: athlete.race_distance
  };
});
