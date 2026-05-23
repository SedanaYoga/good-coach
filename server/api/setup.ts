import { getAthleteConfig, saveAthleteConfig, saveWorkoutsPlan } from '../utils/db';
import { generateTrainingPlan } from '../utils/ai';
import { matchAndAnalyzeActivities } from '../utils/coach';
import { syncStravaActivities } from '../utils/strava';
import type { SetupRequest, SetupConfigResponse } from 'types/domain/athlete';

export default defineEventHandler(async (event) => {
  const method = event.method;

  // GET: Retrieve athlete config and connection status
  if (method === 'GET') {
    const athlete = getAthleteConfig();
    const runtimeConfig = useRuntimeConfig();

    const response: SetupConfigResponse = {
      connected: !!(athlete?.strava_refresh_token),
      athleteId: athlete?.strava_athlete_id || null,
      raceDistance: athlete?.race_distance || '10K',
      raceDate: athlete?.race_date || '',
      coachPersonality: athlete?.coach_personality || 'encouraging',
      currentLevel: athlete?.current_level || 'beginner',
      hasGeminiKey: !!(runtimeConfig.geminiApiKey)
    };
    return response;
  }

  // POST: Update athlete config and trigger training plan generation
  if (method === 'POST') {
    const body = await readBody<SetupRequest>(event);
    
    if (!body.raceDistance || !body.raceDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Race distance and target race date are required.'
      });
    }

    // Save to database
    saveAthleteConfig({
      race_distance: body.raceDistance,
      race_date: body.raceDate,
      coach_personality: body.coachPersonality || 'encouraging',
      current_level: body.currentLevel || 'beginner'
    });

    // Generate training plan (utilizes Gemini or rule-based fallback)
    console.log(`Setup: Generating plan for ${body.raceDistance} on ${body.raceDate}`);
    const workouts = await generateTrainingPlan(body.raceDistance, body.raceDate, body.currentLevel || 'beginner');
    saveWorkoutsPlan(workouts);

    // Try to sync activities and match them if connected to Strava
    const athlete = getAthleteConfig();
    const isConnected = !!(athlete?.strava_refresh_token);
    if (isConnected) {
      try {
        console.log('Setup: Connected to Strava, fetching activities...');
        await syncStravaActivities();
      } catch (e) {
        console.warn('Setup: Post-generation Strava activity sync failed:', e);
      }
    } else {
      try {
        await matchAndAnalyzeActivities();
      } catch (e) {
        console.warn('Setup: Post-generation activity matching failed:', e);
      }
    }

    return {
      success: true,
      workoutsCount: workouts.length
    };
  }
});
