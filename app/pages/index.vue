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
      class="w-10 h-10 border-4 border-white/5 border-t-primary rounded-full animate-spin"
    ></div>
    <p>Loading your training profile...</p>
  </div>

  <div v-else-if="dashboardData" class="flex flex-col gap-8 animate-fade-in">
    <!-- Header Block -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
    >
      <div class="welcome">
        <h1
          class="text-3xl md:text-4xl font-extrabold mb-2 bg-linear-to-br from-white to-text-muted bg-clip-text text-transparent"
        >
          Hey Athlete, Let's Progress!
        </h1>
        <p class="text-text-muted">
          Your AI Running Coach is tracking your targets.
        </p>
      </div>
      <div class="flex flex-col items-stretch md:items-end gap-2">
        <button
          @click="() => triggerSync()"
          class="btn-secondary px-5 py-2.5 text-[0.85rem]"
          :disabled="isSyncing || !dashboardData.connected"
        >
          <span v-if="isSyncing" class="inline-block animate-spin">⏳</span>
          <span v-else>🔄</span>
          Sync Strava Activities
        </button>
        <div
          v-if="syncSuccess"
          class="text-xs px-3 py-2 rounded-md bg-success/10 border border-success/20 text-success animate-fade-in"
        >
          Synced successfully!
        </div>
        <div
          v-if="syncError"
          class="text-xs px-3 py-2 rounded-md bg-error/10 border border-error/20 text-error animate-fade-in"
        >
          {{ syncError }}
        </div>
      </div>
    </div>

    <!-- Notification when Strava is not connected -->
    <div
      v-if="!dashboardData.connected"
      class="bg-warning/8 border border-warning/20 rounded-md p-4 flex justify-between items-center flex-wrap gap-3 text-sm"
    >
      <span
        >⚠️ Your Strava account is not connected. Connect in Settings to load
        actual runs.</span
      >
      <NuxtLink
        to="/setup"
        class="text-primary no-underline font-semibold hover:underline"
        >Configure Setup →</NuxtLink
      >
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
      <!-- MAIN COLUMN: Next Workout & Week Overview -->
      <div class="flex flex-col gap-8">
        <!-- Next Workout Card -->
        <div
          class="glass-card relative overflow-hidden border-l-4 border-primary before:content-[''] before:absolute before:top-0 before:right-0 before:w-[150px] before:h-[150px] before:bg-[radial-gradient(circle,rgba(181,255,43,0.05)_0%,transparent_70%)] before:pointer-events-none"
        >
          <div class="flex justify-between items-center mb-5">
            <span
              class="bg-primary/10 text-primary border border-primary/20 font-display font-bold text-[0.75rem] tracking-wider px-2.5 py-1 rounded-[4px]"
              >NEXT WORKOUT</span
            >
            <span
              class="text-[0.85rem] text-text-muted"
              v-if="dashboardData.nextWorkout"
              >{{ formatDate(dashboardData.nextWorkout.calculated_date) }}</span
            >
          </div>

          <div
            v-if="dashboardData.nextWorkout"
            class="flex flex-col sm:flex-row gap-6 items-start"
          >
            <div
              class="text-4xl bg-white/3 w-[70px] h-[70px] flex items-center justify-center rounded-md border border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
            >
              <span v-if="dashboardData.nextWorkout.workout_type === 'easy_run'"
                >🏃</span
              >
              <span
                v-else-if="
                  dashboardData.nextWorkout.workout_type === 'long_run'
                "
                >🚀</span
              >
              <span
                v-else-if="
                  dashboardData.nextWorkout.workout_type === 'interval'
                "
                >🔥</span
              >
              <span
                v-else-if="
                  dashboardData.nextWorkout.workout_type === 'strength'
                "
                >💪</span
              >
              <span v-else>🧘</span>
            </div>

            <div class="grow">
              <h2 class="text-2xl font-bold mb-2">
                {{ dashboardData.nextWorkout.title }}
              </h2>
              <p class="text-text-muted text-[0.95rem] leading-relaxed mb-5">
                {{ dashboardData.nextWorkout.description }}
              </p>

              <div class="flex flex-wrap gap-6">
                <div
                  v-if="dashboardData.nextWorkout.distance_target"
                  class="flex flex-col gap-1"
                >
                  <span
                    class="text-[0.75rem] text-text-muted uppercase tracking-wider"
                    >Target Distance</span
                  >
                  <span class="font-display font-bold text-lg">{{
                    formatDistance(dashboardData.nextWorkout.distance_target)
                  }}</span>
                </div>
                <div
                  v-if="dashboardData.nextWorkout.duration_target"
                  class="flex flex-col gap-1"
                >
                  <span
                    class="text-[0.75rem] text-text-muted uppercase tracking-wider"
                    >Target Duration</span
                  >
                  <span class="font-display font-bold text-lg">{{
                    formatDuration(dashboardData.nextWorkout.duration_target)
                  }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span
                    class="text-[0.75rem] text-text-muted uppercase tracking-wider"
                    >Session Type</span
                  >
                  <span class="font-display font-bold text-lg capitalize">{{
                    dashboardData.nextWorkout.workout_type.replace('_', ' ')
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center text-text-muted py-5">
            <p>
              No active workouts found. Maybe you completed your plan? Excellent
              job!
            </p>
          </div>
        </div>

        <!-- Weekly Schedule Grid -->
        <div class="glass-card">
          <h3 class="text-lg font-semibold tracking-tight mb-1.5">
            Week {{ dashboardData.currentWeekNum }} Overview
          </h3>
          <p class="text-text-muted text-[0.85rem] mb-5">
            Scheduled sessions for your current training block.
          </p>

          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3"
          >
            <div
              v-for="w in dashboardData.currentWeekWorkouts"
              :key="w.id"
              :class="[
                'bg-white/1.5 border border-white/5 rounded-md px-2.5 py-3.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200',
                {
                  'border-success/30 bg-success/2': w.status === 'completed',
                  'border-error/20 bg-error/2': w.status === 'skipped',
                  'border-primary bg-primary/3':
                    dashboardData.nextWorkout &&
                    dashboardData.nextWorkout.id === w.id,
                },
              ]"
            >
              <div class="text-[0.75rem] text-text-muted">
                Day {{ w.day_number }}
              </div>
              <div
                :class="[
                  'text-[0.65rem] uppercase font-bold px-1.5 py-0.5 rounded-[4px]',
                  w.status === 'completed'
                    ? 'bg-success/15 text-success'
                    : 'bg-white/5 text-text-muted',
                ]"
              >
                {{ w.workout_type.replace('_', ' ') }}
              </div>
              <div
                class="font-semibold text-[0.85rem] whitespace-nowrap overflow-hidden text-ellipsis w-full"
              >
                {{ w.title }}
              </div>
              <div class="text-[0.7rem] font-medium mt-1">
                <span v-if="w.status === 'completed'" class="text-success"
                  >✅ Done</span
                >
                <span v-else-if="w.status === 'skipped'" class="text-error"
                  >❌ Skipped</span
                >
                <span v-else class="text-text-muted">⏳ Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SIDE COLUMN: Progress Metrics & Recent Activities -->
      <div class="flex flex-col gap-8">
        <!-- Progress Metrics -->
        <div class="glass-card">
          <h3 class="text-lg font-semibold tracking-tight mb-4">
            Target: {{ dashboardData.athlete?.raceDistance }} Race
          </h3>
          <div class="flex flex-col items-center my-4">
            <span
              class="font-display text-[4rem] font-extrabold leading-none bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent [text-shadow:0_4px_20px_rgba(181,255,43,0.1)]"
              >{{ dashboardData.daysUntilRace }}</span
            >
            <span
              class="text-[0.85rem] text-text-muted uppercase tracking-wider mt-1.5"
              >Days to Race</span
            >
          </div>

          <div class="my-5">
            <div
              class="flex justify-between text-[0.8rem] text-text-muted mb-2"
            >
              <span>Program Progress</span>
              <span>{{ dashboardData.progressPercent }}%</span>
            </div>
            <div class="bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                class="bg-linear-to-r from-primary to-secondary h-full rounded-full shadow-[0_0_10px_rgba(181,255,43,0.3)]"
                :style="{ width: `${dashboardData.progressPercent}%` }"
              ></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-6">
            <div
              class="bg-white/1 border border-white/5 rounded-md px-3 py-4 text-center flex flex-col gap-1"
            >
              <span class="font-display font-bold text-[1.15rem]"
                >{{ dashboardData.totalDistanceKm }} km</span
              >
              <span class="text-[0.75rem] text-text-muted"
                >Total Logged Distance</span
              >
            </div>
            <div
              class="bg-white/1 border border-white/5 rounded-md px-3 py-4 text-center flex flex-col gap-1"
            >
              <span class="font-display font-bold text-[1.15rem]"
                >{{ dashboardData.completedWorkoutsCount }} /
                {{ dashboardData.totalWorkoutsCount }}</span
              >
              <span class="text-[0.75rem] text-text-muted">Workouts Hit</span>
            </div>
          </div>
        </div>

        <!-- Recent Activities Feed -->
        <div class="glass-card">
          <h3 class="text-lg font-semibold tracking-tight mb-1.5">Recent Activities</h3>
          <p class="text-text-muted text-[0.85rem] mb-5">
            Latest synced entries from your Strava account.
          </p>

          <div
            v-if="
              dashboardData.recentActivities &&
              dashboardData.recentActivities.length > 0
            "
            class="flex flex-col gap-4"
          >
            <div
              v-for="act in dashboardData.recentActivities"
              :key="act.id"
              class="bg-white/1.5 border border-white/5 rounded-md p-4 flex flex-col gap-3"
            >
              <div class="flex justify-between items-start gap-3">
                <div>
                  <h4 class="font-semibold text-[0.95rem] mb-0.5">
                    {{ act.name }}
                  </h4>
                  <span class="text-[0.75rem] text-text-muted">{{
                    formatDate(act.start_date)
                  }}</span>
                </div>
                <div class="flex gap-1.5">
                  <span
                    class="text-[0.65rem] bg-white/5 px-1.5 py-0.5 rounded-[4px] font-medium"
                    >{{ act.sport_type }}</span
                  >
                  <span
                    v-if="act.matched_workout_id"
                    class="text-[0.65rem] bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded-[4px] font-semibold"
                    >Matched</span
                  >
                </div>
              </div>

              <div
                class="grid grid-cols-4 gap-2 border-t border-dashed border-white/10 pt-3"
              >
                <div>
                  <span class="text-[0.7rem] text-text-muted block">Dist</span>
                  <span class="font-display font-bold text-[0.9rem]">{{
                    formatDistance(act.distance)
                  }}</span>
                </div>
                <div>
                  <span class="text-[0.7rem] text-text-muted block">Time</span>
                  <span class="font-display font-bold text-[0.9rem]">{{
                    formatDuration(act.moving_time)
                  }}</span>
                </div>
                <div v-if="act.sport_type === 'Run'">
                  <span class="text-[0.7rem] text-text-muted block">Pace</span>
                  <span class="font-display font-bold text-[0.9rem]">{{
                    formatPace(act.average_speed)
                  }}</span>
                </div>
                <div v-if="act.average_heartrate">
                  <span class="text-[0.7rem] text-text-muted block"
                    >Avg HR</span
                  >
                  <span class="font-display font-bold text-[0.9rem]"
                    >{{ Math.round(act.average_heartrate) }} bpm</span
                  >
                </div>
              </div>

              <!-- Coach Feedback Expander -->
              <div
                v-if="act.coach_feedback"
                class="border-t border-white/5 pt-2.5 mt-1"
              >
                <button
                  @click="toggleFeedback(act.id)"
                  class="bg-transparent border-none text-primary font-semibold text-[0.75rem] cursor-pointer p-0 inline-flex items-center hover:underline"
                >
                  {{
                    expandedFeedback[act.id]
                      ? 'Hide Coach Feedback 🔼'
                      : 'Show Coach Feedback 🔽'
                  }}
                </button>
                <div
                  v-if="expandedFeedback[act.id]"
                  class="bg-primary/4 border border-primary/10 rounded-md p-3 mt-2 flex gap-2 animate-fade-in"
                >
                  <span class="text-[1.1rem]">🧠</span>
                  <p class="text-[0.85rem] leading-snug italic text-slate-200">
                    "{{ act.coach_feedback }}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="text-center text-text-muted py-6 text-[0.9rem]">
            <p>
              No Strava activities found. Record a run/strength session on
              Strava and click Sync above!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
