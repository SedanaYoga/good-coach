<script setup lang="ts">
import type { Workout } from 'types/domain/workout'

interface PlanResponse {
  plan: {
    weekNumber: number
    workouts: Workout[]
  }[]
  totalWeeks: number
  raceDate: string
  raceDistance: string
}

const planData = ref<PlanResponse | null>(null)
const isLoading = ref<boolean>(true)

const expandedWeeks = ref<Record<number, boolean>>({})

const router = useRouter()

async function fetchPlan() {
  try {
    const data = await $fetch<PlanResponse>('/api/plan')
    if (data.plan.length === 0) {
      router.push('/setup')
      return
    }
    planData.value = data

    // Expand week 1 by default
    if (data.plan.length > 0) {
      expandedWeeks.value[1] = true
    }
  } catch (err) {
    console.error('Failed to fetch plan data:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchPlan()
})

function toggleWeek(weekNumber: number) {
  expandedWeeks.value[weekNumber] = !expandedWeeks.value[weekNumber]
}

// Helpers
function formatDistance(meters: number | null | undefined): string | null {
  if (!meters) return null
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} mins`
  const hrs = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hrs}h ${remainingMins}m`
}

function formatPace(speedMps: number | null | undefined): string {
  if (!speedMps || speedMps === 0) return '00:00 /km'
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

function getWeekTypeSummary(workouts: Workout[]): string {
  const runs = workouts.filter((w) =>
    ['easy_run', 'long_run', 'interval'].includes(w.workout_type),
  ).length
  const strength = workouts.filter((w) => w.workout_type === 'strength').length
  return `${runs} Runs, ${strength} Strength`
}
</script>

<template>
  <div
    v-if="isLoading"
    class="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in"
  >
    <div class="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin"></div>
    <p class="text-sm text-muted-foreground">Loading your training plan...</p>
  </div>

  <div v-else-if="planData" class="max-w-[800px] mx-auto animate-fade-in">
    <div class="text-center mb-8">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">
        Your Training Schedule
      </h1>
      <p class="text-sm text-muted-foreground">
        Complete week-by-week roadmap for your {{ planData.raceDistance }} on
        {{ formatDate(planData.raceDate) }}.
      </p>
    </div>

    <!-- Accordion of Weeks -->
    <div class="flex flex-col border border-border rounded-xl overflow-hidden">
      <div
        v-for="(week, weekIdx) in planData.plan"
        :key="week.weekNumber"
        :class="['flex flex-col', { 'border-t border-border': weekIdx > 0 }]"
      >
        <!-- Week Header Trigger -->
        <button
          @click="toggleWeek(week.weekNumber)"
          class="w-full text-left flex justify-between items-center cursor-pointer px-5 py-4 hover:bg-muted/50 transition-colors group bg-transparent border-none text-foreground"
        >
          <div class="flex items-center gap-3">
            <UiBadge variant="secondary" class="text-[0.65rem] uppercase tracking-wider font-bold">
              Week {{ week.weekNumber }}
            </UiBadge>
            <div>
              <h3 class="text-sm font-medium">Training Block {{ week.weekNumber }}</h3>
              <span class="text-xs text-muted-foreground">{{ getWeekTypeSummary(week.workouts) }}</span>
            </div>
          </div>
          <svg
            :class="[
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              { 'rotate-180': expandedWeeks[week.weekNumber] },
            ]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Week Workouts List -->
        <div
          v-if="expandedWeeks[week.weekNumber]"
          class="px-5 pb-4 animate-fade-in flex flex-col gap-3"
        >
          <UiCard
            v-for="w in week.workouts"
            :key="w.id"
          >
            <UiCardHeader class="pb-3">
              <div class="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <span class="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                    Day {{ w.day_number }} · {{ formatDate(w.calculated_date) }}
                  </span>
                  <UiCardTitle class="text-base">{{ w.title }}</UiCardTitle>
                </div>
                <UiBadge
                  :variant="w.status === 'completed' ? 'success' : w.status === 'skipped' ? 'destructive' : 'outline'"
                  class="text-[0.65rem] uppercase shrink-0"
                >
                  {{ w.status === 'completed' ? '✓ Completed' : w.status === 'skipped' ? '✗ Skipped' : 'Pending' }}
                </UiBadge>
              </div>
            </UiCardHeader>
            <UiCardContent>
              <p class="text-sm text-muted-foreground leading-relaxed mb-4">
                {{ w.description }}
              </p>

              <!-- Targets -->
              <div
                v-if="w.distance_target || w.duration_target"
                class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md border border-border"
              >
                <span class="font-medium text-foreground">Target:</span>
                <span v-if="w.distance_target">📏 {{ formatDistance(w.distance_target) }}</span>
                <span v-if="w.duration_target">⏱️ {{ formatDuration(w.duration_target) }}</span>
                <span class="capitalize">⚙️ {{ w.workout_type.replace('_', ' ') }}</span>
              </div>

              <!-- Completed Activity Link -->
              <div v-if="w.status === 'completed' && w.activity" class="mt-4 border-t border-border pt-4">
                <div class="text-xs font-medium mb-3 text-success">
                  💪 Sync Session: "{{ w.activity.name }}"
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-success/5 border border-success/10 p-3 rounded-lg mb-3">
                  <div class="flex flex-col">
                    <span class="text-[0.65rem] text-muted-foreground block mb-0.5">Distance</span>
                    <span class="font-semibold text-sm">{{ formatDistance(w.activity.distance) }}</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-[0.65rem] text-muted-foreground block mb-0.5">Duration</span>
                    <span class="font-semibold text-sm">{{ formatDuration(w.activity.moving_time) }}</span>
                  </div>
                  <div class="flex flex-col" v-if="w.activity.sport_type === 'Run'">
                    <span class="text-[0.65rem] text-muted-foreground block mb-0.5">Avg Pace</span>
                    <span class="font-semibold text-sm">{{ formatPace(w.activity.average_speed) }}</span>
                  </div>
                  <div class="flex flex-col" v-if="w.activity.average_heartrate">
                    <span class="text-[0.65rem] text-muted-foreground block mb-0.5">Heartrate</span>
                    <span class="font-semibold text-sm">{{ Math.round(w.activity.average_heartrate) }} bpm</span>
                  </div>
                </div>

                <!-- Coach Feedback -->
                <div
                  v-if="w.coach_feedback"
                  class="bg-muted/50 border border-border p-3 rounded-lg"
                >
                  <span class="text-xs font-medium text-primary block mb-1">🧠 Coach Feedback:</span>
                  <p class="text-xs leading-relaxed text-muted-foreground italic">
                    "{{ w.coach_feedback }}"
                  </p>
                </div>
              </div>
            </UiCardContent>
          </UiCard>
        </div>
      </div>
    </div>
  </div>
</template>
