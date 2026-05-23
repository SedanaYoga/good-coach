import { syncStravaActivities } from '../../utils/strava';

export default defineEventHandler(async (event): Promise<{ success: boolean; count: number }> => {
  try {
    const count = await syncStravaActivities();

    return {
      success: true,
      count
    };
  } catch (err) {
    const error = err as Error;
    console.error('Strava manual sync failed:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to sync activities with Strava'
    });
  }
});
