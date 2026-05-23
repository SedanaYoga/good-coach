import { getValidAccessToken } from '../../utils/strava'
import { saveActivity } from '../../utils/db'
import { matchAndAnalyzeActivities } from '../../utils/coach'
import type { StravaActivity } from 'types/domain/activity'
import { formatDate } from '~~/utils/date'

interface WebhookQuery {
  'hub.mode'?: string
  'hub.verify_token'?: string
  'hub.challenge'?: string
}

interface WebhookBody {
  object_type?: string
  aspect_type?: string
  object_id?: number
  owner_id?: number
  subscription_id?: number
  updates?: Record<string, string | number | boolean | null>
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // GET: Subscription validation challenge
  if (event.method === 'GET') {
    const query = getQuery<WebhookQuery>(event)
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (mode === 'subscribe' && token === config.stravaVerifyToken) {
      console.log('Strava Webhook challenge verified successfully.')
      return { 'hub.challenge': challenge }
    }

    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid verification token',
    })
  }

  // POST: Webhook event callback
  if (event.method === 'POST') {
    const body = await readBody<WebhookBody>(event)
    console.log('Received Strava webhook event:', body)

    // Process activity creation in the background
    if (body.object_type === 'activity' && body.aspect_type === 'create') {
      const activityId = body.object_id

      // Run asynchronously to allow returning 200 OK within 2 seconds
      ;(async () => {
        try {
          const token = await getValidAccessToken()

          // Fetch full activity details from Strava API
          const act = await $fetch<StravaActivity>(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          )

          // Save to SQLite
          saveActivity({
            id: act.id,
            name: act.name,
            sport_type: act.sport_type,
            start_date: formatDate(act.start_date_local, 'YYYY-MM-DD'),
            distance: act.distance,
            moving_time: act.moving_time,
            elapsed_time: act.elapsed_time,
            average_speed: act.average_speed,
            average_heartrate: act.average_heartrate,
            max_heartrate: act.max_heartrate,
          })

          // Run coaching analysis and match against workout plan
          await matchAndAnalyzeActivities()
          console.log(`Webhook: Successfully processed activity ${activityId}`)
        } catch (err) {
          console.error(
            `Webhook: Failed to process activity ${activityId}:`,
            err,
          )
        }
      })()
    }

    return { status: 'EVENT_RECEIVED' }
  }
})
