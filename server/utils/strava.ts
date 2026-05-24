import { getAthleteConfig, saveAthleteConfig, saveActivity } from './db'
import { matchAndAnalyzeActivities } from './coach'
import type { StravaTokenResponse } from 'types/domain/athlete'
import type { Activity, StravaActivity } from 'types/domain/activity'
import { formatDate } from '~~/utils/date'

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
      start_date: formatDate(act.start_date_local, 'YYYY-MM-DD'),
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

export async function fetchHistoricalStravaActivities(): Promise<Activity[]> {
  try {
    const token = await getValidAccessToken()
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)

    console.log('Fetching historical Strava activities (last 3 months)...')
    const activitiesResponse = await $fetch<StravaActivity[]>(
      'https://www.strava.com/api/v3/athlete/activities',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        query: {
          after: ninetyDaysAgo,
          per_page: 100,
        },
      },
    )

    const activities: Activity[] = []
    for (const act of activitiesResponse) {
      const activityObj: Activity = {
        id: act.id,
        name: act.name,
        sport_type: act.sport_type,
        start_date: formatDate(act.start_date_local, 'YYYY-MM-DD'),
        distance: act.distance, // in meters
        moving_time: act.moving_time, // in seconds
        elapsed_time: act.elapsed_time,
        average_speed: act.average_speed,
        average_heartrate: act.average_heartrate ?? null,
        max_heartrate: act.max_heartrate ?? null,
        matched_workout_id: null,
        coach_feedback: null,
        synced_at: new Date().toISOString(),
      }
      saveActivity(activityObj)
      activities.push(activityObj)
    }

    return activities
  } catch (err) {
    console.error('Failed to fetch historical Strava activities:', err)
    return []
  }
}

export function calculateAthleteMetrics(activities: Activity[]) {
  const runs = activities.filter((a) =>
    ['Run', 'TrailRun', 'VirtualRun', 'RoadRun'].includes(a.sport_type),
  )

  const totalDistanceMeters = runs.reduce((sum, a) => sum + a.distance, 0)
  const totalMovingTimeSeconds = runs.reduce((sum, a) => sum + a.moving_time, 0)

  // Average weekly mileage over 12 weeks (3 months)
  const weeklyMileageKm = totalDistanceMeters / 1000 / 12
  const averageSpeed = totalMovingTimeSeconds > 0 ? totalDistanceMeters / totalMovingTimeSeconds : 0

  // Calculate training load (intensity * duration)
  // TRIMP-like score or simple load: duration (mins) * heartrate intensity factor
  let totalLoad = 0
  for (const act of activities) {
    const durationMins = act.moving_time / 60
    let intensity = 1.0 // baseline intensity multiplier
    if (act.average_heartrate && act.max_heartrate) {
      intensity = act.average_heartrate / act.max_heartrate
    } else if (act.average_heartrate) {
      intensity = act.average_heartrate / 180 // estimate based on max HR of 180
    }
    totalLoad += durationMins * intensity
  }

  const avgWeeklyLoad = totalLoad / 12

  return {
    weeklyMileageKm: Math.round(weeklyMileageKm * 10) / 10,
    averageSpeed: Math.round(averageSpeed * 100) / 100, // m/s
    avgWeeklyLoad: Math.round(avgWeeklyLoad * 10) / 10,
    totalRuns: runs.length,
  }
}
