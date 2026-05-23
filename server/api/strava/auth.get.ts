import { saveAthleteConfig } from '../../utils/db';
import type { StravaTokenResponse } from 'types/domain/athlete';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig();

  const clientId = config.public.stravaClientId;
  const clientSecret = config.stravaClientSecret;
  const redirectUri = config.public.stravaRedirectUri;

  if (!clientId || !clientSecret) {
    return sendRedirect(event, '/setup?error=missing_keys');
  }

  // Case 1: Callback from Strava with authorization code
  if (query.code) {
    try {
      const tokenResponse = await $fetch<StravaTokenResponse>('https://www.strava.com/oauth/token', {
        method: 'POST',
        body: {
          client_id: clientId,
          client_secret: clientSecret,
          code: query.code,
          grant_type: 'authorization_code'
        }
      });

      const expiresAt = tokenResponse.expires_at; // unix timestamp
      const accessToken = tokenResponse.access_token;
      const refreshToken = tokenResponse.refresh_token;
      const athleteId = tokenResponse.athlete?.id;

      // Save tokens in SQLite
      saveAthleteConfig({
        strava_athlete_id: athleteId,
        strava_access_token: accessToken,
        strava_refresh_token: refreshToken,
        strava_expires_at: expiresAt
      });

      return sendRedirect(event, '/setup?auth=success');
    } catch (err) {
      console.error('Error exchanging token:', err);
      return sendRedirect(event, `/setup?error=token_exchange_failed`);
    }
  }

  // Case 2: User clicked "Connect Strava" - redirect them to Strava
  const scope = 'read,activity:read_all';
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=force`;

  return sendRedirect(event, stravaAuthUrl);
});
