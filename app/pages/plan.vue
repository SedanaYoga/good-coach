<script setup lang="ts">
import type { Workout } from 'types/domain/workout'

interface PlanResponse {
  plan: {
    weekNumber: number
    phase: 'initial' | 'progression' | 'taper' | 'recovery'
    workouts: Workout[]
  }[]
  totalWeeks: number
  raceDate: string
  raceDistance: string
}

const planData = ref<PlanResponse | null>(null)
const isLoading = ref<boolean>(true)
const isRegenerating = ref<boolean>(false)
const expandedWeeks = ref<Record<number, boolean>>({})

const isStreaming = ref(false)
const streamStatus = ref('')
const liveAIText = ref('')
const streamError = ref<string | null>(null)

const router = useRouter()

async function startPlanStream() {
  isStreaming.value = true
  streamError.value = null
  liveAIText.value = ''
  streamStatus.value = 'Connecting to AI coach...'

  try {
    const response = await fetch('/api/plan/generate')
    if (!response.body) {
      throw new Error('Readable stream not supported by browser or API.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let finished = false
    let buffer = ''

    while (!finished) {
      const { value, done } = await reader.read()
      if (done) {
        finished = true
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.type === 'status') {
              streamStatus.value = payload.message
            } else if (payload.type === 'chunk') {
              liveAIText.value += payload.text
            } else if (payload.type === 'done') {
              streamStatus.value = 'Plan finalized!'
              finished = true
              
              // Load the completed plan from database
              const completedData = await $fetch<PlanResponse>('/api/plan')
              planData.value = completedData
              expandedWeeks.value = { 1: true }
              isStreaming.value = false
            } else if (payload.type === 'error') {
              throw new Error(payload.message)
            }
          } catch (jsonErr) {
            console.error('Failed to parse event line:', line, jsonErr)
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Streaming plan generation failed:', err)
    streamError.value = err.message || 'An error occurred during plan generation.'
    isStreaming.value = false
  }
}

async function fetchPlan() {
  try {
    const data = await $fetch<PlanResponse>('/api/plan')
    if (data.plan.length === 0) {
      if (!data.raceDate) {
        router.push('/setup')
      } else {
        startPlanStream()
      }
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

async function regeneratePlan() {
  if (
    !confirm(
      'Are you sure you want to regenerate your training plan? This will overwrite your current schedule.',
    )
  ) {
    return
  }
  startPlanStream()
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
  const mobility = workouts.filter((w) => w.workout_type === 'mobility').length
  return `${runs} Runs, ${strength} Strength, ${mobility} Mobility`
}

// Workout Type Details
const workoutTypeMeta: Record<
  string,
  { label: string; icon: string; classes: string }
> = {
  easy_run: {
    label: 'Easy Run',
    icon: '🏃',
    classes:
      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/5',
  },
  long_run: {
    label: 'Long Run',
    icon: '🏆',
    classes: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/5',
  },
  interval: {
    label: 'Intervals',
    icon: '⚡',
    classes:
      'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 dark:bg-indigo-500/5',
  },
  strength: {
    label: 'Strength',
    icon: '🏋️',
    classes:
      'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 dark:bg-cyan-500/5',
  },
  mobility: {
    label: 'Mobility',
    icon: '🧘',
    classes:
      'bg-pink-500/10 text-pink-500 border-pink-500/20 dark:bg-pink-500/5',
  },
  rest: {
    label: 'Rest Day',
    icon: '😴',
    classes:
      'bg-slate-500/10 text-slate-500 border-slate-500/20 dark:bg-slate-500/5',
  },
}

// Group Plan by 4 Phases
const groupedPhases = computed(() => {
  if (!planData.value) return []

  const phases = {
    initial: {
      key: 'initial',
      title: 'Initial Phase',
      badge: 'Base Building',
      description:
        'Establish your aerobic base, introduce core strength patterns, and build consistency.',
      weeks: [] as typeof planData.value.plan,
    },
    progression: {
      key: 'progression',
      title: 'Progression Phase',
      badge: 'Load & Speed overload',
      description:
        'Build volume peaks, transition to faster speed intervals, and increase joint loading.',
      weeks: [] as typeof planData.value.plan,
    },
    taper: {
      key: 'taper',
      title: 'Taper Phase',
      badge: 'Volume Cutback',
      description:
        'Cut back running mileage while preserving short intensity bursts to keep muscles primed.',
      weeks: [] as typeof planData.value.plan,
    },
    recovery: {
      key: 'recovery',
      title: 'Recovery Phase',
      badge: 'Race & Restore',
      description:
        'Prepare your mind and body for race execution, then heal up with soft movement.',
      weeks: [] as typeof planData.value.plan,
    },
  }

  for (const week of planData.value.plan) {
    const phaseKey = week.phase as keyof typeof phases
    if (phases[phaseKey]) {
      phases[phaseKey].weeks.push(week)
    } else {
      phases.initial.weeks.push(week)
    }
  }

  return Object.values(phases).filter((p) => p.weeks.length > 0)
})

const overallStats = computed(() => {
  if (!planData.value) return { runs: 0, strength: 0, mobility: 0 }
  let runs = 0
  let strength = 0
  let mobility = 0

  for (const week of planData.value.plan) {
    for (const w of week.workouts) {
      if (['easy_run', 'long_run', 'interval'].includes(w.workout_type)) runs++
      else if (w.workout_type === 'strength') strength++
      else if (w.workout_type === 'mobility') mobility++
    }
  }

  return { runs, strength, mobility }
})
</script>

<template>
  <div
    v-if="isLoading || isStreaming"
    class="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-[700px] mx-auto w-full animate-fade-in"
  >
    <div v-if="isLoading && !isStreaming" class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin"></div>
      <p class="text-sm text-muted-foreground">Loading your training plan...</p>
    </div>

    <!-- Live AI Streaming Console -->
    <div v-else-if="isStreaming" class="w-full flex flex-col gap-4">
      <UiAlert v-if="streamError" variant="destructive" class="mb-4">
        <UiAlertDescription class="flex items-start gap-2">
          <span>⚠️</span>
          <p>{{ streamError }}</p>
        </UiAlertDescription>
      </UiAlert>

      <UiCard class="border border-primary/30 shadow-md shadow-primary/5 overflow-hidden w-full bg-card">
        <UiCardHeader class="pb-3 border-b border-border bg-muted/40">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
              <UiCardTitle class="text-sm font-semibold">AI Coach Designing Plan</UiCardTitle>
            </div>
            <span class="text-[0.7rem] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
              Gemini Live Stream
            </span>
          </div>
        </UiCardHeader>
        <UiCardContent class="py-5 flex flex-col gap-4">
          <!-- Coach Status Message -->
          <div class="flex items-center gap-2.5 text-xs text-foreground font-medium bg-primary/5 border border-primary/10 px-3 py-2 rounded-lg">
            <div class="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0"></div>
            <span>{{ streamStatus }}</span>
          </div>

          <!-- Live Output Terminal -->
          <div class="bg-zinc-950 dark:bg-zinc-950/40 border border-border text-zinc-300 font-mono text-[0.75rem] p-4 rounded-xl h-[280px] overflow-y-auto leading-relaxed whitespace-pre-wrap scroll-smooth">
            {{ liveAIText || 'Awaiting connection to coach...' }}
          </div>
          
          <div class="text-[0.65rem] text-muted-foreground italic text-center">
            The live terminal displays raw training program data as it is compiled by the AI coach.
          </div>
        </UiCardContent>
      </UiCard>

      <div v-if="streamError" class="flex justify-center">
        <UiButton variant="outline" size="sm" @click="router.push('/setup')">
          Return to Configuration ⚙️
        </UiButton>
      </div>
    </div>
  </div>

  <div v-else-if="planData" class="max-w-[900px] mx-auto animate-fade-in">
    <!-- Header Block -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
    >
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">
          Your Training Schedule
        </h1>
        <p class="text-sm text-muted-foreground">
          Complete 4-phase roadmap for your {{ planData.raceDistance }} on
          {{ formatDate(planData.raceDate) }}.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="outline" size="sm" @click="router.push('/setup')">
          Adjust Goals ⚙️
        </UiButton>
        <UiButton variant="default" size="sm" @click="regeneratePlan">
          Regenerate Block 🔄
        </UiButton>
      </div>
    </div>

    <!-- Overall Summary Grid -->
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div class="bg-card border border-border p-4 rounded-xl text-center">
        <span
          class="text-[0.65rem] text-muted-foreground uppercase tracking-wider block mb-1"
          >Running Sessions</span
        >
        <span class="text-xl md:text-2xl font-bold text-foreground"
          >🏃 {{ overallStats.runs }}</span
        >
      </div>
      <div class="bg-card border border-border p-4 rounded-xl text-center">
        <span
          class="text-[0.65rem] text-muted-foreground uppercase tracking-wider block mb-1"
          >Strength Workouts</span
        >
        <span class="text-xl md:text-2xl font-bold text-foreground"
          >🏋️ {{ overallStats.strength }}</span
        >
      </div>
      <div class="bg-card border border-border p-4 rounded-xl text-center">
        <span
          class="text-[0.65rem] text-muted-foreground uppercase tracking-wider block mb-1"
          >Mobility Flows</span
        >
        <span class="text-xl md:text-2xl font-bold text-foreground"
          >🧘 {{ overallStats.mobility }}</span
        >
      </div>
    </div>

    <!-- 4 Phases Dashboard -->
    <div class="flex flex-col gap-10">
      <section
        v-for="phase in groupedPhases"
        :key="phase.key"
        class="flex flex-col gap-4 border-l-2 border-primary/20 pl-4 md:pl-6 ml-1.5"
      >
        <!-- Phase Details Card -->
        <div class="bg-card border border-border/80 rounded-xl p-5 shadow-sm">
          <div class="flex items-center gap-3 mb-2">
            <span
              class="bg-primary/10 text-primary border border-primary/20 text-[0.65rem] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
            >
              {{ phase.badge }}
            </span>
            <h2 class="text-lg font-bold text-foreground">{{ phase.title }}</h2>
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ phase.description }}
          </p>
        </div>

        <!-- Weeks in Phase -->
        <div
          class="flex flex-col border border-border rounded-xl overflow-hidden bg-card"
        >
          <div
            v-for="(week, weekIdx) in phase.weeks"
            :key="week.weekNumber"
            :class="[
              'flex flex-col',
              { 'border-t border-border': weekIdx > 0 },
            ]"
          >
            <!-- Week Header Trigger -->
            <button
              @click="toggleWeek(week.weekNumber)"
              class="w-full text-left flex justify-between items-center cursor-pointer px-5 py-4 hover:bg-muted/30 transition-colors bg-transparent border-none text-foreground"
            >
              <div class="flex items-center gap-3">
                <UiBadge
                  variant="secondary"
                  class="text-[0.65rem] uppercase tracking-wider font-bold"
                >
                  Week {{ week.weekNumber }}
                </UiBadge>
                <div>
                  <h3 class="text-sm font-medium">
                    Training Block Week {{ week.weekNumber }}
                  </h3>
                  <span class="text-[0.7rem] text-muted-foreground">{{
                    getWeekTypeSummary(week.workouts)
                  }}</span>
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
              class="px-5 pb-4 animate-fade-in flex flex-col gap-3"
            >
              <UiCard
                v-for="w in week.workouts"
                :key="w.id"
                class="hover:border-border transition-colors"
              >
                <UiCardHeader class="pb-2">
                  <div
                    class="flex flex-col sm:flex-row justify-between items-start gap-2"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-lg">
                        {{ workoutTypeMeta[w.workout_type]?.icon || '🏃' }}
                      </span>
                      <div>
                        <span
                          class="text-[0.65rem] text-muted-foreground uppercase tracking-wider block"
                        >
                          Day {{ w.day_number }} ·
                          {{ formatDate(w.calculated_date) }}
                        </span>
                        <UiCardTitle class="text-sm font-semibold">{{
                          w.title
                        }}</UiCardTitle>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <!-- Custom Type Badge -->
                      <UiBadge
                        v-if="workoutTypeMeta[w.workout_type]"
                        variant="outline"
                        :class="[
                          'text-[0.6rem] uppercase tracking-wider font-semibold border',
                          workoutTypeMeta[w.workout_type]?.classes,
                        ]"
                      >
                        {{ workoutTypeMeta[w.workout_type]?.label }}
                      </UiBadge>
                      <UiBadge
                        :variant="
                          w.status === 'completed'
                            ? 'outline'
                            : w.status === 'skipped'
                              ? 'destructive'
                              : 'outline'
                        "
                        :class="[
                          'text-[0.6rem] uppercase',
                          w.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/5'
                            : '',
                        ]"
                      >
                        {{
                          w.status === 'completed'
                            ? '✓ Completed'
                            : w.status === 'skipped'
                              ? '✗ Skipped'
                              : 'Pending'
                        }}
                      </UiBadge>
                    </div>
                  </div>
                </UiCardHeader>
                <UiCardContent>
                  <p class="text-xs text-muted-foreground leading-relaxed mb-3">
                    {{ w.description }}
                  </p>

                  <!-- Targets -->
                  <div
                    v-if="w.distance_target || w.duration_target"
                    class="flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border"
                  >
                    <span class="font-medium text-foreground">Target:</span>
                    <span v-if="w.distance_target"
                      >📏 {{ formatDistance(w.distance_target) }}</span
                    >
                    <span v-if="w.duration_target"
                      >⏱️ {{ formatDuration(w.duration_target) }}</span
                    >
                  </div>

                  <!-- Completed Activity Link -->
                  <div
                    v-if="w.status === 'completed' && w.activity"
                    class="mt-3 border-t border-border pt-3"
                  >
                    <div class="text-[0.7rem] font-semibold mb-2 text-success">
                      💪 Completed via Sync: "{{ w.activity.name }}"
                    </div>

                    <div
                      class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-success/5 border border-success/10 p-2 rounded-lg mb-2"
                    >
                      <div class="flex flex-col">
                        <span class="text-[0.6rem] text-muted-foreground block"
                          >Distance</span
                        >
                        <span class="font-semibold text-xs">{{
                          formatDistance(w.activity.distance)
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[0.6rem] text-muted-foreground block"
                          >Duration</span
                        >
                        <span class="font-semibold text-xs">{{
                          formatDuration(w.activity.moving_time)
                        }}</span>
                      </div>
                      <div
                        class="flex flex-col"
                        v-if="w.activity.sport_type === 'Run'"
                      >
                        <span class="text-[0.6rem] text-muted-foreground block"
                          >Avg Pace</span
                        >
                        <span class="font-semibold text-xs">{{
                          formatPace(w.activity.average_speed)
                        }}</span>
                      </div>
                      <div
                        class="flex flex-col"
                        v-if="w.activity.average_heartrate"
                      >
                        <span class="text-[0.6rem] text-muted-foreground block"
                          >Heartrate</span
                        >
                        <span class="font-semibold text-xs"
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
                      class="bg-muted/40 border border-border p-2.5 rounded-lg"
                    >
                      <span
                        class="text-[0.65rem] font-semibold text-primary block mb-0.5"
                        >🧠 Coach Feedback:</span
                      >
                      <p
                        class="text-[0.7rem] leading-relaxed text-muted-foreground italic"
                      >
                        "{{ w.coach_feedback }}"
                      </p>
                    </div>
                  </div>
                </UiCardContent>
              </UiCard>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
