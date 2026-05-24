import { getAthleteConfig, saveAthleteConfig, getDb } from '../utils/db';
import { generateQuestions } from '../utils/ai';
import { fetchHistoricalStravaActivities, calculateAthleteMetrics } from '../utils/strava';
import type { SetupRequest, SetupConfigResponse } from 'types/domain/athlete';

export default defineEventHandler(async (event) => {
  const method = event.method;

  // GET: Retrieve athlete config and connection status, or fetch dynamic questions
  if (method === 'GET') {
    const query = getQuery(event);
    if (query.action === 'questions') {
      const athlete = getAthleteConfig();
      let stravaHistory = null;
      if (athlete && athlete.strava_refresh_token) {
        try {
          const activities = await fetchHistoricalStravaActivities();
          if (activities.length > 0) {
            stravaHistory = calculateAthleteMetrics(activities);
          }
        } catch (e) {
          console.warn('Failed to fetch historical Strava activities for questions:', e);
        }
      }
      const questions = await generateQuestions(stravaHistory);
      return { questions };
    }

    const athlete = getAthleteConfig();
    const runtimeConfig = useRuntimeConfig();

    const response: SetupConfigResponse = {
      connected: !!(athlete?.strava_refresh_token),
      athleteId: athlete?.strava_athlete_id || null,
      raceDistance: athlete?.race_distance || '10K',
      raceDate: athlete?.race_date || '',
      targetTime: athlete?.target_time || null,
      onboardingAnswers: athlete?.onboarding_answers ? JSON.parse(athlete.onboarding_answers) : null,
      coachPersonality: athlete?.coach_personality || 'encouraging',
      currentLevel: athlete?.current_level || 'beginner',
      hasGeminiKey: !!(runtimeConfig.geminiApiKey)
    };
    return response;
  }

  // POST: Update athlete config and reset old plan to trigger fresh generation
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
      target_time: body.targetTime || null,
      onboarding_answers: body.answers ? JSON.stringify(body.answers) : null,
      coach_personality: body.coachPersonality || 'encouraging',
      current_level: body.currentLevel || 'beginner'
    });

    // Clear old workouts and reset matched activities
    const db = getDb();
    db.prepare('DELETE FROM workouts').run();
    db.prepare('UPDATE activities SET matched_workout_id = NULL, coach_feedback = NULL').run();

    // Try to sync historical activities if connected to Strava
    const athlete = getAthleteConfig();
    const isConnected = !!(athlete?.strava_refresh_token);
    if (isConnected) {
      try {
        console.log('Setup: Connected to Strava, fetching historical activities...');
        await fetchHistoricalStravaActivities();
      } catch (e) {
        console.warn('Setup: Post-generation Strava activity sync failed:', e);
      }
    }

    return {
      success: true,
      message: 'Athlete profile and goals saved successfully.'
    };
  }
});
