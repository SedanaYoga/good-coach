import { getValidAccessToken } from '../../utils/strava';
import { saveActivity } from '../../utils/db';
import { matchAndAnalyzeActivities } from '../../utils/coach';

export default defineEventHandler(async (event) => {
  try {
    const token = await getValidAccessToken();

    // Fetch last 30 activities from Strava
    const activitiesResponse: any[] = await $fetch('https://www.strava.com/api/v3/athlete/activities', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      query: {
        per_page: 30
      }
    });

    // Save synced activities to SQLite database
    for (const act of activitiesResponse) {
      saveActivity({
        id: act.id,
        name: act.name,
        sport_type: act.sport_type,
        start_date: act.start_date.split('T')[0], // Extract 'YYYY-MM-DD'
        distance: act.distance, // in meters
        moving_time: act.moving_time, // in seconds
        elapsed_time: act.elapsed_time,
        average_speed: act.average_speed,
        average_heartrate: act.average_heartrate,
        max_heartrate: act.max_heartrate
      });
    }

    // Match activities to workouts and generate AI feedback
    await matchAndAnalyzeActivities();

    return {
      success: true,
      count: activitiesResponse.length
    };
  } catch (err: any) {
    console.error('Strava manual sync failed:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to sync activities with Strava'
    });
  }
});
