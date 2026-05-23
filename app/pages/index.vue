<script setup lang="ts">
import type { DashboardResponse } from 'types/domain/coach'

const dashboardData = ref<DashboardResponse | null>(null)
const isLoading = ref<boolean>(true)
const isSyncing = ref<boolean>(false)
const syncError = ref<string | null>(null)
const syncSuccess = ref<boolean>(false)

const router = useRouter()

async function fetchDashboard(triggerBackgroundSync = false) {
  try {
    const data = await $fetch<DashboardResponse>('/api/dashboard')
    if (data.setupRequired) {
      router.push('/setup')
      return
    }
    dashboardData.value = data
    if (triggerBackgroundSync && data.connected) {
      triggerSync(true)
    }
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err)
  } finally {
    isLoading.value = false
  }
}

async function triggerSync(silent = false) {
  if (!silent) {
    isSyncing.value = true
    syncError.value = null
    syncSuccess.value = false
  }

  try {
    const res = await $fetch<{ success: boolean; count: number }>(
      '/api/strava/sync',
      { method: 'POST' },
    )
    if (res.success) {
      if (!silent) {
        syncSuccess.value = true
        setTimeout(() => {
          syncSuccess.value = false
        }, 3000)
      }
      const data = await $fetch<DashboardResponse>('/api/dashboard')
      dashboardData.value = data
    }
  } catch (err) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    console.error('Sync failed:', err)
    if (!silent) {
      syncError.value =
        fetchErr.data?.statusMessage || 'Sync failed. Check your API keys.'
    }
  } finally {
    if (!silent) {
      isSyncing.value = false
    }
  }
}

onMounted(() => {
  fetchDashboard(true)
})

// Format Helper
function formatDistance(meters: number | null | undefined): string {
  if (!meters) return '0.0 km'
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return 'N/A'
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} mins`
  const hrs = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hrs}h ${remainingMins}m`
}

function formatPace(speedMps: number | null | undefined): string {
  if (!speedMps || speedMps === 0) return '00:00 /km'
  // Pace is minutes per kilometer
  const paceSecondsPerKm = 1000 / speedMps
  const minutes = Math.floor(paceSecondsPerKm / 60)
  const seconds = Math.round(paceSecondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Active coach feedback toggle state
const expandedFeedback = ref<Record<number, boolean>>({})
function toggleFeedback(activityId: number) {
  expandedFeedback.value[activityId] = !expandedFeedback.value[activityId]
}
</script>

<template>
  <div
    v-if="isLoading"
    class="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in"
  >
    <div
      class="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin"
    ></div>
    <p class="text-sm text-muted-foreground">Loading your training profile...</p>
  </div>

  <div v-else-if="dashboardData" class="flex flex-col gap-6 animate-fade-in">
    <!-- Header Block -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight mb-1">
          Hey Athlete, Let's Progress!
        </h1>
        <p class="text-sm text-muted-foreground">
          Your AI Running Coach is tracking your targets.
        </p>
      </div>
      <div class="flex flex-col items-stretch md:items-end gap-2">
        <UiButton
          variant="outline"
          @click="() => triggerSync()"
          :disabled="isSyncing || !dashboardData.connected"
        >
          <span v-if="isSyncing" class="inline-block animate-spin">⏳</span>
          <span v-else>🔄</span>
          Sync Strava Activities
        </UiButton>
        <UiAlert v-if="syncSuccess" variant="success" class="py-2 px-3 text-xs">
          Synced successfully!
        </UiAlert>
        <UiAlert v-if="syncError" variant="destructive" class="py-2 px-3 text-xs">
          {{ syncError }}
        </UiAlert>
      </div>
    </div>

    <!-- Notification when Strava is not connected -->
    <UiAlert v-if="!dashboardData.connected" variant="warning">
      <UiAlertDescription class="flex justify-between items-center flex-wrap gap-3">
        <span>⚠️ Your Strava account is not connected. Connect in Settings to load actual runs.</span>
        <NuxtLink to="/setup" class="text-primary no-underline font-semibold hover:underline">
          Configure Setup →
        </NuxtLink>
      </UiAlertDescription>
    </UiAlert>

    <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
      <!-- MAIN COLUMN -->
      <div class="flex flex-col gap-6">
        <!-- Next Workout Card -->
        <UiCard>
          <UiCardHeader>
            <div class="flex justify-between items-center">
              <UiBadge variant="default" class="text-[0.7rem] uppercase tracking-wider">
                Next Workout
              </UiBadge>
              <span
                class="text-sm text-muted-foreground"
                v-if="dashboardData.nextWorkout"
              >{{ formatDate(dashboardData.nextWorkout.calculated_date) }}</span>
            </div>
          </UiCardHeader>
          <UiCardContent>
            <div
              v-if="dashboardData.nextWorkout"
              class="flex flex-col sm:flex-row gap-5 items-start"
            >
              <div class="text-3xl bg-muted w-14 h-14 flex items-center justify-center rounded-lg">
                <span v-if="dashboardData.nextWorkout.workout_type === 'easy_run'">🏃</span>
                <span v-else-if="dashboardData.nextWorkout.workout_type === 'long_run'">🚀</span>
                <span v-else-if="dashboardData.nextWorkout.workout_type === 'interval'">🔥</span>
                <span v-else-if="dashboardData.nextWorkout.workout_type === 'strength'">💪</span>
                <span v-else>🧘</span>
              </div>

              <div class="flex-1 min-w-0">
                <h2 class="text-xl font-semibold tracking-tight mb-1">
                  {{ dashboardData.nextWorkout.title }}
                </h2>
                <p class="text-sm text-muted-foreground leading-relaxed mb-4">
                  {{ dashboardData.nextWorkout.description }}
                </p>

                <div class="flex flex-wrap gap-6">
                  <div v-if="dashboardData.nextWorkout.distance_target" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground uppercase tracking-wider">Target Distance</span>
                    <span class="font-semibold">{{ formatDistance(dashboardData.nextWorkout.distance_target) }}</span>
                  </div>
                  <div v-if="dashboardData.nextWorkout.duration_target" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground uppercase tracking-wider">Target Duration</span>
                    <span class="font-semibold">{{ formatDuration(dashboardData.nextWorkout.duration_target) }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground uppercase tracking-wider">Session Type</span>
                    <span class="font-semibold capitalize">{{ dashboardData.nextWorkout.workout_type.replace('_', ' ') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center text-muted-foreground py-5 text-sm">
              <p>No active workouts found. Maybe you completed your plan? Excellent job!</p>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Weekly Schedule Grid -->
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Week {{ dashboardData.currentWeekNum }} Overview</UiCardTitle>
            <UiCardDescription>Scheduled sessions for your current training block.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
              <div
                v-for="w in dashboardData.currentWeekWorkouts"
                :key="w.id"
                :class="[
                  'border rounded-lg px-2.5 py-3 flex flex-col items-center text-center gap-1.5 transition-colors',
                  {
                    'border-success/30 bg-success/5': w.status === 'completed',
                    'border-destructive/20 bg-destructive/5': w.status === 'skipped',
                    'border-primary/50 bg-primary/5': dashboardData.nextWorkout && dashboardData.nextWorkout.id === w.id,
                    'border-border bg-muted/30': w.status !== 'completed' && w.status !== 'skipped' && !(dashboardData.nextWorkout && dashboardData.nextWorkout.id === w.id),
                  },
                ]"
              >
                <div class="text-xs text-muted-foreground">Day {{ w.day_number }}</div>
                <UiBadge
                  :variant="w.status === 'completed' ? 'success' : 'secondary'"
                  class="text-[0.6rem] uppercase"
                >
                  {{ w.workout_type.replace('_', ' ') }}
                </UiBadge>
                <div class="font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis w-full">
                  {{ w.title }}
                </div>
                <div class="text-[0.65rem]">
                  <span v-if="w.status === 'completed'" class="text-success">✓ Done</span>
                  <span v-else-if="w.status === 'skipped'" class="text-destructive">✗ Skipped</span>
                  <span v-else class="text-muted-foreground">Pending</span>
                </div>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- SIDE COLUMN -->
      <div class="flex flex-col gap-6">
        <!-- Progress Metrics -->
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Target: {{ dashboardData.athlete?.raceDistance }} Race</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="flex flex-col items-center my-2">
              <span class="text-5xl font-extrabold leading-none text-primary">
                {{ dashboardData.daysUntilRace }}
              </span>
              <span class="text-xs text-muted-foreground uppercase tracking-wider mt-1.5">
                Days to Race
              </span>
            </div>

            <div class="my-5">
              <div class="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Program Progress</span>
                <span>{{ dashboardData.progressPercent }}%</span>
              </div>
              <div class="bg-muted h-2 rounded-full overflow-hidden">
                <div
                  class="bg-primary h-full rounded-full transition-all duration-500"
                  :style="{ width: `${dashboardData.progressPercent}%` }"
                ></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4">
              <div class="bg-muted/50 border border-border rounded-lg px-3 py-3 text-center flex flex-col gap-1">
                <span class="font-semibold text-sm">{{ dashboardData.totalDistanceKm }} km</span>
                <span class="text-xs text-muted-foreground">Total Logged Distance</span>
              </div>
              <div class="bg-muted/50 border border-border rounded-lg px-3 py-3 text-center flex flex-col gap-1">
                <span class="font-semibold text-sm">
                  {{ dashboardData.completedWorkoutsCount }} / {{ dashboardData.totalWorkoutsCount }}
                </span>
                <span class="text-xs text-muted-foreground">Workouts Hit</span>
              </div>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Recent Activities Feed -->
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Recent Activities</UiCardTitle>
            <UiCardDescription>Latest synced entries from your Strava account.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <div
              v-if="dashboardData.recentActivities && dashboardData.recentActivities.length > 0"
              class="flex flex-col gap-4"
            >
              <div
                v-for="act in dashboardData.recentActivities"
                :key="act.id"
                class="border border-border rounded-lg p-4 flex flex-col gap-3"
              >
                <div class="flex justify-between items-start gap-3">
                  <div>
                    <h4 class="font-medium text-sm mb-0.5">{{ act.name }}</h4>
                    <span class="text-xs text-muted-foreground">{{ formatDate(act.start_date) }}</span>
                  </div>
                  <div class="flex gap-1.5">
                    <UiBadge variant="secondary" class="text-[0.6rem]">{{ act.sport_type }}</UiBadge>
                    <UiBadge v-if="act.matched_workout_id" variant="default" class="text-[0.6rem]">Matched</UiBadge>
                  </div>
                </div>

                <div class="grid grid-cols-4 gap-2 border-t border-border pt-3">
                  <div>
                    <span class="text-[0.65rem] text-muted-foreground block">Dist</span>
                    <span class="font-semibold text-xs">{{ formatDistance(act.distance) }}</span>
                  </div>
                  <div>
                    <span class="text-[0.65rem] text-muted-foreground block">Time</span>
                    <span class="font-semibold text-xs">{{ formatDuration(act.moving_time) }}</span>
                  </div>
                  <div v-if="act.sport_type === 'Run'">
                    <span class="text-[0.65rem] text-muted-foreground block">Pace</span>
                    <span class="font-semibold text-xs">{{ formatPace(act.average_speed) }}</span>
                  </div>
                  <div v-if="act.average_heartrate">
                    <span class="text-[0.65rem] text-muted-foreground block">Avg HR</span>
                    <span class="font-semibold text-xs">{{ Math.round(act.average_heartrate) }} bpm</span>
                  </div>
                </div>

                <!-- Coach Feedback Expander -->
                <div v-if="act.coach_feedback" class="border-t border-border pt-2.5">
                  <button
                    @click="toggleFeedback(act.id)"
                    class="bg-transparent border-none text-primary font-medium text-xs cursor-pointer p-0 inline-flex items-center gap-1 hover:underline"
                  >
                    {{ expandedFeedback[act.id] ? 'Hide Coach Feedback ▲' : 'Show Coach Feedback ▼' }}
                  </button>
                  <div
                    v-if="expandedFeedback[act.id]"
                    class="bg-muted/50 border border-border rounded-lg p-3 mt-2 animate-fade-in"
                  >
                    <p class="text-xs leading-relaxed text-muted-foreground italic">
                      "{{ act.coach_feedback }}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center text-muted-foreground py-6 text-sm">
              <p>No Strava activities found. Record a run/strength session on Strava and click Sync above!</p>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </div>
  </div>
</template>
