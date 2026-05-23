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
    <div
      class="w-10 h-10 border-4 border-white/5 border-t-primary rounded-full animate-spin"
    ></div>
    <p>Loading your training plan...</p>
  </div>

  <div v-else-if="planData" class="max-w-[800px] mx-auto animate-fade-in">
    <div class="text-center mb-10">
      <h1
        class="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight bg-linear-to-br from-white to-text-muted bg-clip-text text-transparent"
      >
        Your Training Schedule
      </h1>
      <p class="text-text-muted">
        Complete week-by-week roadmap for your {{ planData.raceDistance }} on
        {{ formatDate(planData.raceDate) }}.
      </p>
    </div>

    <!-- Accordion of Weeks -->
    <div class="flex flex-col">
      <div
        v-for="week in planData.plan"
        :key="week.weekNumber"
        class="flex flex-col"
      >
        <!-- Week Header -->
        <button
          @click="toggleWeek(week.weekNumber)"
          class="w-full text-left flex justify-between items-center cursor-pointer py-5 border-b border-white/10 hover:text-white transition-colors group"
        >
          <div class="flex flex-row items-center gap-4">
            <span
              class="font-display font-extrabold text-[0.75rem] tracking-wider bg-white/10 text-white px-2.5 py-0.5 rounded-[4px] group-hover:bg-primary group-hover:text-black transition-colors"
              >WEEK {{ week.weekNumber }}</span
            >
            <div>
              <h3
                class="text-base font-semibold text-text-main group-hover:text-white transition-colors"
              >
                Training Block {{ week.weekNumber }}
              </h3>
              <span class="text-xs text-text-muted">{{
                getWeekTypeSummary(week.workouts)
              }}</span>
            </div>
          </div>
          <svg
            :class="[
              'w-4 h-4 text-text-muted transition-transform duration-200 group-hover:text-text-main',
              { 'rotate-180 text-white': expandedWeeks[week.weekNumber] },
            ]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <!-- Week Workouts List -->
        <div
          v-if="expandedWeeks[week.weekNumber]"
          class="pl-2 sm:pl-5 pt-6 pb-4 animate-fade-in"
        >
          <div class="flex flex-col">
            <div
              v-for="(w, wIndex) in week.workouts"
              :key="w.id"
              class="flex relative gap-6 pb-6 last:pb-0"
            >
              <!-- Timeline indicator -->
              <div class="flex flex-col items-center w-4">
                <div
                  :class="[
                    'w-3 h-3 rounded-full border-2 border-dark z-10 mt-6',
                    {
                      'bg-success': w.workout_type === 'easy_run',
                      'bg-primary': w.workout_type === 'long_run',
                      'bg-secondary': w.workout_type === 'interval',
                      'bg-warning': w.workout_type === 'strength',
                      'bg-text-muted': w.workout_type === 'rest',
                    },
                  ]"
                ></div>
                <div
                  v-if="wIndex < week.workouts.length - 1"
                  class="flex-1 w-[2px] bg-white/5"
                ></div>
              </div>

              <!-- Workout Content Card -->
              <div class="glass-card flex-1">
                <div
                  class="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4 mb-3"
                >
                  <div>
                    <span
                      class="text-[0.8rem] text-text-muted uppercase tracking-wider block mb-0.5"
                      >Day {{ w.day_number }} •
                      {{ formatDate(w.calculated_date) }}</span
                    >
                    <h4 class="text-base font-semibold tracking-tight">
                      {{ w.title }}
                    </h4>
                  </div>
                  <div>
                    <span
                      :class="[
                        'text-[0.7rem] font-bold uppercase px-2 py-1 rounded-[4px]',
                        w.status === 'completed'
                          ? 'bg-success/15 text-success border border-success/20'
                          : w.status === 'skipped'
                            ? 'bg-error/15 text-error border border-error/20'
                            : 'bg-white/5 text-text-muted',
                      ]"
                    >
                      {{
                        w.status === 'completed'
                          ? '✓ Completed'
                          : w.status === 'skipped'
                            ? '✗ Skipped'
                            : 'Pending'
                      }}
                    </span>
                  </div>
                </div>

                <p class="text-text-muted text-[0.95rem] leading-relaxed mb-4">
                  {{ w.description }}
                </p>

                <!-- Targets -->
                <div
                  class="flex flex-wrap gap-4 text-[0.8rem] text-text-muted bg-white/1.5 px-3 py-2 rounded-sm border border-dashed border-white/5"
                  v-if="w.distance_target || w.duration_target"
                >
                  <span class="font-semibold text-text-main">Target:</span>
                  <span v-if="w.distance_target"
                    >📏 {{ formatDistance(w.distance_target) }}</span
                  >
                  <span v-if="w.duration_target"
                    >⏱️ {{ formatDuration(w.duration_target) }}</span
                  >
                  <span class="capitalize"
                    >⚙️ {{ w.workout_type.replace('_', ' ') }}</span
                  >
                </div>

                <!-- Completed Activity Link -->
                <div
                  v-if="w.status === 'completed' && w.activity"
                  class="mt-4 border-t border-white/5 pt-4"
                >
                  <div class="text-[0.85rem] font-semibold mb-3 text-success">
                    💪 Sync Session: "{{ w.activity.name }}"
                  </div>

                  <div
                    class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-success/3 border border-success/10 p-3 rounded-md mb-3"
                  >
                    <div class="flex flex-col">
                      <span class="text-[0.7rem] text-text-muted block mb-0.5"
                        >Distance</span
                      >
                      <span class="font-display font-bold text-[1rem]">{{
                        formatDistance(w.activity.distance)
                      }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[0.7rem] text-text-muted block mb-0.5"
                        >Duration</span
                      >
                      <span class="font-display font-bold text-[1rem]">{{
                        formatDuration(w.activity.moving_time)
                      }}</span>
                    </div>
                    <div
                      class="flex flex-col"
                      v-if="w.activity.sport_type === 'Run'"
                    >
                      <span class="text-[0.7rem] text-text-muted block mb-0.5"
                        >Avg Pace</span
                      >
                      <span class="font-display font-bold text-[1rem]">{{
                        formatPace(w.activity.average_speed)
                      }}</span>
                    </div>
                    <div
                      class="flex flex-col"
                      v-if="w.activity.average_heartrate"
                    >
                      <span class="text-[0.7rem] text-text-muted block mb-0.5"
                        >Heartrate</span
                      >
                      <span class="font-display font-bold text-[1rem]"
                        >{{
                          Math.round(w.activity.average_heartrate)
                        }}
                        bpm</span
                      >
                    </div>
                  </div>

                  <!-- Coach Feedback -->
                  <div
                    v-if="w.coach_feedback"
                    class="bg-primary/4 border border-primary/10 p-3 rounded-md"
                  >
                    <span
                      class="text-[0.75rem] font-bold text-primary block mb-1"
                      >🧠 Coach Feedback:</span
                    >
                    <p
                      class="text-[0.85rem] leading-relaxed italic text-slate-200"
                    >
                      "{{ w.coach_feedback }}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
