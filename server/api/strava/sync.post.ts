import { syncStravaActivities } from '../../utils/strava';

export default defineEventHandler(async (event) => {
  try {
    const count = await syncStravaActivities();

    return {
      success: true,
      count
    };
  } catch (err: any) {
    console.error('Strava manual sync failed:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to sync activities with Strava'
    });
  }
});
