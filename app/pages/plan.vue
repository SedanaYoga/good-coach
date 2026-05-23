<script setup lang="ts">
import type { Workout } from '../../types/domain/workout'

interface PlanResponse {
  plan: {
    weekNumber: number;
    workouts: Workout[];
  }[];
  totalWeeks: number;
  raceDate: string;
  raceDistance: string;
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
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getWeekTypeSummary(workouts: Workout[]): string {
  const runs = workouts.filter(w => ['easy_run', 'long_run', 'interval'].includes(w.workout_type)).length
  const strength = workouts.filter(w => w.workout_type === 'strength').length
  return `${runs} Runs, ${strength} Strength`
}
</script>

<template>
  <div v-if="isLoading" class="loading-state animate-fade-in">
    <div class="spinner"></div>
    <p>Loading your training plan...</p>
  </div>

  <div v-else-if="planData" class="plan-container animate-fade-in">
    <div class="plan-header">
      <h1>Your Training Schedule</h1>
      <p class="subtitle">Complete week-by-week roadmap for your {{ planData.raceDistance }} on {{ formatDate(planData.raceDate) }}.</p>
    </div>

    <!-- Accordion of Weeks -->
    <div class="weeks-accordion">
      <div 
        v-for="week in planData.plan" 
        :key="week.weekNumber" 
        :class="['week-section', { 'is-expanded': expandedWeeks[week.weekNumber] }]"
      >
        <!-- Week Header -->
        <button @click="toggleWeek(week.weekNumber)" class="week-header-btn glass-card">
          <div class="week-title-area">
            <span class="week-badge">WEEK {{ week.weekNumber }}</span>
            <div class="week-meta">
              <h3>Training Block {{ week.weekNumber }}</h3>
              <span class="week-summary">{{ getWeekTypeSummary(week.workouts) }}</span>
            </div>
          </div>
          <div class="week-toggle-icon">
            {{ expandedWeeks[week.weekNumber] ? '▼' : '▶' }}
          </div>
        </button>

        <!-- Week Workouts List -->
        <div v-if="expandedWeeks[week.weekNumber]" class="week-content animate-fade-in">
          <div class="workouts-timeline">
            <div 
              v-for="w in week.workouts" 
              :key="w.id" 
              :class="['workout-item', `type-${w.workout_type}`, `status-${w.status}`]"
            >
              <!-- Timeline indicator -->
              <div class="timeline-indicator">
                <div class="indicator-dot"></div>
                <div class="indicator-line"></div>
              </div>

              <!-- Workout Content Card -->
              <div class="glass-card workout-card">
                <div class="w-header">
                  <div class="w-info">
                    <span class="w-day">Day {{ w.day_number }} • {{ formatDate(w.calculated_date) }}</span>
                    <h4 class="w-title">{{ w.title }}</h4>
                  </div>
                  <div class="w-status">
                    <span :class="['status-badge', w.status]">
                      {{ w.status === 'completed' ? '✓ Completed' : w.status === 'skipped' ? '✗ Skipped' : 'Pending' }}
                    </span>
                  </div>
                </div>

                <p class="w-description">{{ w.description }}</p>

                <!-- Targets -->
                <div class="w-targets-row" v-if="w.distance_target || w.duration_target">
                  <span class="target-label">Target:</span>
                  <span class="target-val" v-if="w.distance_target">📏 {{ formatDistance(w.distance_target) }}</span>
                  <span class="target-val" v-if="w.duration_target">⏱️ {{ formatDuration(w.duration_target) }}</span>
                  <span class="target-valcapitalize">⚙️ {{ w.workout_type.replace('_', ' ') }}</span>
                </div>

                <!-- Completed Activity Link -->
                <div v-if="w.status === 'completed' && w.activity" class="completed-activity-box">
                  <div class="box-title">💪 Sync Session: "{{ w.activity.name }}"</div>
                  
                  <div class="completed-stats">
                    <div class="stat">
                      <span class="lbl">Distance</span>
                      <span class="val">{{ formatDistance(w.activity.distance) }}</span>
                    </div>
                    <div class="stat">
                      <span class="lbl">Duration</span>
                      <span class="val">{{ formatDuration(w.activity.moving_time) }}</span>
                    </div>
                    <div class="stat" v-if="w.activity.sport_type === 'Run'">
                      <span class="lbl">Avg Pace</span>
                      <span class="val">{{ formatPace(w.activity.average_speed) }}</span>
                    </div>
                    <div class="stat" v-if="w.activity.average_heartrate">
                      <span class="lbl">Heartrate</span>
                      <span class="val">{{ Math.round(w.activity.average_heartrate) }} bpm</span>
                    </div>
                  </div>

                  <!-- Coach Feedback -->
                  <div v-if="w.coach_feedback" class="coach-feedback-box">
                    <span class="feedback-avatar">🧠 Coach Feedback:</span>
                    <p class="feedback-quote">"{{ w.coach_feedback }}"</p>
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

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-glass);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.plan-container {
  max-width: 800px;
  margin: 0 auto;
}

.plan-header {
  text-align: center;
  margin-bottom: 40px;
}

.plan-header h1 {
  font-size: 2.5rem;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #ffffff 0%, var(--color-text-muted) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--color-text-muted);
}

/* Accordion */
.weeks-accordion {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.week-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.week-header-btn {
  width: 100%;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 20px 24px;
}

.week-header-btn:hover {
  background: rgba(255,255,255,0.02);
  border-color: rgba(255,255,255,0.1);
}

.week-title-area {
  display: flex;
  align-items: center;
  gap: 20px;
}

@media (max-width: 576px) {
  .week-title-area {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.week-badge {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  background: var(--color-primary);
  color: #000000;
  padding: 4px 12px;
  border-radius: 9999px;
  box-shadow: var(--shadow-neon);
}

.week-meta h3 {
  font-size: 1.15rem;
  margin-bottom: 2px;
}

.week-summary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.week-toggle-icon {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

/* Timeline workouts */
.week-content {
  padding-left: 20px;
}

@media (max-width: 576px) {
  .week-content {
    padding-left: 10px;
  }
}

.workouts-timeline {
  display: flex;
  flex-direction: column;
}

.workout-item {
  display: flex;
  position: relative;
  gap: 24px;
  padding-bottom: 24px;
}

.workout-item:last-child {
  padding-bottom: 0;
}

.timeline-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
}

.indicator-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--border-glass);
  border: 2px solid var(--bg-dark);
  z-index: 10;
  margin-top: 24px;
}

.indicator-line {
  flex: 1;
  width: 2px;
  background: var(--border-glass);
}

.workout-item:last-child .indicator-line {
  display: none;
}

.workout-card {
  flex: 1;
}

/* Day specifics */
.w-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

@media (max-width: 576px) {
  .w-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.w-day {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 2px;
}

.w-title {
  font-size: 1.15rem;
  font-weight: 600;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(255,255,255,0.05);
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-radius: 4px;
}

.status-badge.completed {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.status-badge.skipped {
  background: rgba(244, 63, 94, 0.15);
  color: var(--color-error);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.w-description {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 16px;
}

/* Targets */
.w-targets-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background: rgba(255,255,255,0.015);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed var(--border-glass);
}

.target-label {
  font-weight: 600;
  color: var(--color-text-main);
}

.target-valcapitalize {
  text-transform: capitalize;
}

/* Types styles */
.type-easy_run .indicator-dot {
  background-color: var(--color-success);
}
.type-long_run .indicator-dot {
  background-color: var(--color-primary);
}
.type-interval .indicator-dot {
  background-color: var(--color-secondary);
}
.type-strength .indicator-dot {
  background-color: var(--color-warning);
}
.type-rest .indicator-dot {
  background-color: var(--color-text-muted);
}

/* Completed Activity details in card */
.completed-activity-box {
  margin-top: 16px;
  border-top: 1px solid var(--border-glass);
  padding-top: 16px;
}

.box-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-success);
}

.completed-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  background: rgba(16, 185, 129, 0.03);
  border: 1px solid rgba(16, 185, 129, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}

@media (max-width: 576px) {
  .completed-stats {
    grid-template-columns: 1fr 1fr;
  }
}

.completed-stats .lbl {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  display: block;
  margin-bottom: 2px;
}

.completed-stats .val {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
}

.coach-feedback-box {
  background: rgba(181, 255, 43, 0.04);
  border: 1px solid rgba(181, 255, 43, 0.1);
  padding: 12px;
  border-radius: 8px;
}

.feedback-avatar {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-primary);
  display: block;
  margin-bottom: 4px;
}

.feedback-quote {
  font-size: 0.85rem;
  line-height: 1.4;
  font-style: italic;
  color: #e2e8f0;
}
</style>
