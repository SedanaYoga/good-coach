import { getAthleteConfig, getWorkoutsPlan, getActivities, saveWorkoutsPlan } from '../utils/db';
import { getWorkoutDate, matchAndAnalyzeActivities } from '../utils/coach';
import { fetchHistoricalStravaActivities, calculateAthleteMetrics } from '../utils/strava';
import { generateTrainingBlock } from '../utils/ai';
import type { Workout } from 'types/domain/workout';
import type { Activity } from 'types/domain/activity';

export default defineEventHandler(async (event) => {
  const athlete = getAthleteConfig();
  if (!athlete) {
    return { plan: [], totalWeeks: 0 };
  }

  const query = getQuery(event);
  const regenerate = query.regenerate === 'true';

  let workouts = getWorkoutsPlan();

  // If no plan is in the DB, or user requested regeneration, generate a fresh plan
  if (workouts.length === 0 || regenerate) {
    console.log(`Plan API: Generating new training plan for ${athlete.race_distance} on ${athlete.race_date}...`);
    
    let stravaHistory = null;
    if (athlete.strava_refresh_token) {
      try {
        const activities = await fetchHistoricalStravaActivities();
        if (activities.length > 0) {
          stravaHistory = calculateAthleteMetrics(activities);
        }
      } catch (e) {
        console.warn('Failed to fetch historical Strava activities during plan generation:', e);
      }
    }

    // Call AI to generate training block
    const userAnswers = {
      raceDistance: athlete.race_distance,
      raceDate: athlete.race_date,
      targetTime: athlete.target_time,
      coachPersonality: athlete.coach_personality,
      currentLevel: athlete.current_level,
      answers: athlete.onboarding_answers ? JSON.parse(athlete.onboarding_answers) : {}
    };

    const newWorkoutsPlan = await generateTrainingBlock(stravaHistory, userAnswers);
    saveWorkoutsPlan(newWorkoutsPlan);

    // Run activity matching on the fresh plan
    try {
      await matchAndAnalyzeActivities();
    } catch (e) {
      console.warn('Failed matching activities after plan generation:', e);
    }

    // Fetch the workouts again after saving and matching
    workouts = getWorkoutsPlan();
  }

  const activities = getActivities();
  const totalWeeks = workouts.length > 0 ? Math.max(...workouts.map(w => w.week_number)) : 0;
  
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
      phase: planByWeek[weekNum]?.[0]?.phase || 'initial', // extract phase from first workout of the week
      workouts: planByWeek[weekNum]
    }));

  return {
    plan: formattedPlan,
    totalWeeks,
    raceDate: athlete.race_date,
    raceDistance: athlete.race_distance
  };
});
