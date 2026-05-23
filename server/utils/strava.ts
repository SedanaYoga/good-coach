import { getAthleteConfig, saveAthleteConfig } from './db';

export async function getValidAccessToken() {
  const config = useRuntimeConfig();
  const athlete = getAthleteConfig();

  if (!athlete || !athlete.strava_refresh_token) {
    throw new Error('Strava not connected. Please connect your account in Setup.');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  
  // If token is valid for another 5 minutes, return it
  if (athlete.strava_expires_at && athlete.strava_expires_at > nowUnix + 300) {
    return athlete.strava_access_token;
  }

  // Token is expired or about to expire, refresh it
  console.log('Strava access token expired, refreshing...');
  try {
    const refreshResponse: any = await $fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: {
        client_id: config.public.stravaClientId,
        client_secret: config.stravaClientSecret,
        grant_type: 'refresh_token',
        refresh_token: athlete.strava_refresh_token
      }
    });

    const newAccessToken = refreshResponse.access_token;
    const newRefreshToken = refreshResponse.refresh_token;
    const newExpiresAt = refreshResponse.expires_at;

    saveAthleteConfig({
      strava_access_token: newAccessToken,
      strava_refresh_token: newRefreshToken,
      strava_expires_at: newExpiresAt
    });

    return newAccessToken;
  } catch (err: any) {
    console.error('Failed to refresh Strava token:', err);
    throw new Error('Failed to refresh Strava access token');
  }
}
