import { getAthleteConfig, saveAthleteConfig, saveActivity } from './db'
import { matchAndAnalyzeActivities } from './coach'
import type { StravaTokenResponse } from 'types/domain/athlete'
import type { StravaActivity } from 'types/domain/activity'
import dayjs from 'dayjs'

export async function getValidAccessToken(): Promise<string> {
  const config = useRuntimeConfig()
  const athlete = getAthleteConfig()

  if (!athlete || !athlete.strava_refresh_token) {
    throw new Error(
      'Strava not connected. Please connect your account in Setup.',
    )
  }

  const nowUnix = Math.floor(Date.now() / 1000)

  // If token is valid for another 5 minutes, return it
  if (
    athlete.strava_expires_at &&
    athlete.strava_expires_at > nowUnix + 300 &&
    athlete.strava_access_token
  ) {
    return athlete.strava_access_token
  }

  // Token is expired or about to expire, refresh it
  console.log('Strava access token expired, refreshing...')
  try {
    const refreshResponse = await $fetch<StravaTokenResponse>(
      'https://www.strava.com/oauth/token',
      {
        method: 'POST',
        body: {
          client_id: config.public.stravaClientId,
          client_secret: config.stravaClientSecret,
          grant_type: 'refresh_token',
          refresh_token: athlete.strava_refresh_token,
        },
      },
    )

    const newAccessToken = refreshResponse.access_token
    const newRefreshToken = refreshResponse.refresh_token
    const newExpiresAt = refreshResponse.expires_at

    saveAthleteConfig({
      strava_access_token: newAccessToken,
      strava_refresh_token: newRefreshToken,
      strava_expires_at: newExpiresAt,
    })

    return newAccessToken
  } catch (err) {
    const error = err as Error
    console.error('Failed to refresh Strava token:', error)
    throw new Error('Failed to refresh Strava access token')
  }
}

export async function syncStravaActivities(): Promise<number> {
  const token = await getValidAccessToken()

  // Fetch last 30 activities from Strava
  const activitiesResponse = await $fetch<StravaActivity[]>(
    'https://www.strava.com/api/v3/athlete/activities',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      query: {
        per_page: 30,
      },
    },
  )

  // Save synced activities to SQLite database
  for (const act of activitiesResponse) {
    saveActivity({
      id: act.id,
      name: act.name,
      sport_type: act.sport_type,
      start_date: act.start_date_local,
      distance: act.distance, // in meters
      moving_time: act.moving_time, // in seconds
      elapsed_time: act.elapsed_time,
      average_speed: act.average_speed,
      average_heartrate: act.average_heartrate,
      max_heartrate: act.max_heartrate,
    })
  }

  // Match activities to workouts and generate AI feedback
  await matchAndAnalyzeActivities()

  return activitiesResponse.length
}
