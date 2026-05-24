import { sendStream } from 'h3';
import { getAthleteConfig, saveWorkoutsPlan } from '../../utils/db';
import { generateTrainingBlockStream } from '../../utils/ai';
import { fetchHistoricalStravaActivities, calculateAthleteMetrics } from '../../utils/strava';
import { matchAndAnalyzeActivities } from '../../utils/coach';

export default defineEventHandler(async (event) => {
  const athlete = getAthleteConfig();
  if (!athlete) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Athlete configuration not found. Please complete setup first.',
    });
  }

  // Set response headers for Event Stream
  setHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent({ type: 'status', message: 'Retrieving historical training activities...' });

        let stravaHistory = null;
        if (athlete.strava_refresh_token) {
          try {
            const activities = await fetchHistoricalStravaActivities();
            if (activities.length > 0) {
              stravaHistory = calculateAthleteMetrics(activities);
            }
          } catch (e) {
            console.warn('Failed to fetch historical Strava activities during streaming generation:', e);
          }
        }

        sendEvent({ type: 'status', message: 'AI Coach is drafting your 4-phase program...' });

        const userAnswers = {
          raceDistance: athlete.race_distance,
          raceDate: athlete.race_date,
          targetTime: athlete.target_time,
          coachPersonality: athlete.coach_personality,
          currentLevel: athlete.current_level,
          answers: athlete.onboarding_answers ? JSON.parse(athlete.onboarding_answers) : {},
        };

        // Call the AI stream generator
        const generator = generateTrainingBlockStream(stravaHistory, userAnswers);

        for await (const eventObj of generator) {
          if (eventObj.type === 'done') {
            sendEvent({ type: 'status', message: 'Saving your training program to SQLite...' });
            
            // Save complete plan to SQLite DB
            saveWorkoutsPlan(eventObj.plan);

            sendEvent({ type: 'status', message: 'Aligning past runs and activities with new plan...' });
            
            // Run matching
            try {
              await matchAndAnalyzeActivities();
            } catch (matchErr) {
              console.warn('Failed to match activities during streaming generation:', matchErr);
            }

            // Yield done event
            sendEvent({ type: 'done', plan: eventObj.plan });
          } else {
            sendEvent(eventObj);
          }
        }
      } catch (e: any) {
        console.error('Streaming generation failed:', e);
        sendEvent({ type: 'error', message: e.message || 'Stream processing failed' });
      } finally {
        controller.close();
      }
    },
  });

  return sendStream(event, stream);
});
