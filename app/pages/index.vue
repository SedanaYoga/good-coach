<script setup>
const dashboardData = ref(null);
const isLoading = ref(true);
const isSyncing = ref(false);
const syncError = ref(null);
const syncSuccess = ref(false);

const router = useRouter();

async function fetchDashboard() {
  try {
    const data = await $fetch('/api/dashboard');
    if (data.setupRequired) {
      router.push('/setup');
      return;
    }
    dashboardData.value = data;
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err);
  } finally {
    isLoading.value = false;
  }
}

async function triggerSync() {
  isSyncing.value = true;
  syncError.value = null;
  syncSuccess.value = false;

  try {
    const res = await $fetch('/api/strava/sync', { method: 'POST' });
    if (res.success) {
      syncSuccess.value = true;
      await fetchDashboard();
      setTimeout(() => {
        syncSuccess.value = false;
      }, 3000);
    }
  } catch (err) {
    console.error('Sync failed:', err);
    syncError.value = err.data?.statusMessage || 'Sync failed. Check your API keys.';
  } finally {
    isSyncing.value = false;
  }
}

onMounted(() => {
  fetchDashboard();
});

// Format Helper
function formatDistance(meters) {
  if (!meters) return '0.0 km';
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

function formatPace(speedMps) {
  if (!speedMps || speedMps === 0) return '00:00 /km';
  // Pace is minutes per kilometer
  const paceSecondsPerKm = 1000 / speedMps;
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.round(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Active coach feedback toggle state
const expandedFeedback = ref({});
function toggleFeedback(activityId) {
  expandedFeedback.value[activityId] = !expandedFeedback.value[activityId];
}
</script>

<template>
  <div v-if="isLoading" class="loading-state animate-fade-in">
    <div class="spinner"></div>
    <p>Loading your training profile...</p>
  </div>

  <div v-else-if="dashboardData" class="dashboard-container animate-fade-in">
    <!-- Header Block -->
    <div class="dashboard-header">
      <div class="welcome">
        <h1>Hey Athlete, Let's Progress!</h1>
        <p class="subtitle">Your AI Running Coach is tracking your targets.</p>
      </div>
      <div class="sync-actions">
        <button 
          @click="triggerSync" 
          class="btn-secondary sync-btn" 
          :disabled="isSyncing || !dashboardData.connected"
        >
          <span v-if="isSyncing" class="sync-spinner">⏳</span>
          <span v-else>🔄</span>
          Sync Strava Activities
        </button>
        <div v-if="syncSuccess" class="toast toast-success">Synced successfully!</div>
        <div v-if="syncError" class="toast toast-error">{{ syncError }}</div>
      </div>
    </div>

    <!-- Notification when Strava is not connected -->
    <div v-if="!dashboardData.connected" class="not-connected-banner">
      <span>⚠️ Your Strava account is not connected. Connect in Settings to load actual runs.</span>
      <NuxtLink to="/setup" class="banner-link">Configure Setup →</NuxtLink>
    </div>

    <div class="dashboard-grid">
      <!-- MAIN COLUMN: Next Workout & Week Overview -->
      <div class="main-column">
        <!-- Next Workout Card -->
        <div class="glass-card next-workout-card">
          <div class="card-header">
            <span class="badge-accent">NEXT WORKOUT</span>
            <span class="workout-date" v-if="dashboardData.nextWorkout">{{ formatDate(dashboardData.nextWorkout.calculated_date) }}</span>
          </div>

          <div v-if="dashboardData.nextWorkout" class="workout-body">
            <div class="workout-type-icon">
              <span v-if="dashboardData.nextWorkout.workout_type === 'easy_run'">🏃</span>
              <span v-else-if="dashboardData.nextWorkout.workout_type === 'long_run'">🚀</span>
              <span v-else-if="dashboardData.nextWorkout.workout_type === 'interval'">🔥</span>
              <span v-else-if="dashboardData.nextWorkout.workout_type === 'strength'">💪</span>
              <span v-else>🧘</span>
            </div>

            <div class="workout-details">
              <h2>{{ dashboardData.nextWorkout.title }}</h2>
              <p class="workout-desc">{{ dashboardData.nextWorkout.description }}</p>
              
              <div class="workout-targets">
                <div v-if="dashboardData.nextWorkout.distance_target" class="target-stat">
                  <span class="label">Target Distance</span>
                  <span class="value">{{ formatDistance(dashboardData.nextWorkout.distance_target) }}</span>
                </div>
                <div v-if="dashboardData.nextWorkout.duration_target" class="target-stat">
                  <span class="label">Target Duration</span>
                  <span class="value">{{ formatDuration(dashboardData.nextWorkout.duration_target) }}</span>
                </div>
                <div class="target-stat">
                  <span class="label">Session Type</span>
                  <span class="value capitalize">{{ dashboardData.nextWorkout.workout_type.replace('_', ' ') }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-workout">
            <p>No active workouts found. Maybe you completed your plan? Excellent job!</p>
          </div>
        </div>

        <!-- Weekly Schedule Grid -->
        <div class="glass-card week-overview-card">
          <h3>Week {{ dashboardData.currentWeekNum }} Overview</h3>
          <p class="section-desc">Scheduled sessions for your current training block.</p>
          
          <div class="week-days-grid">
            <div 
              v-for="w in dashboardData.currentWeekWorkouts" 
              :key="w.id"
              :class="['day-card', `status-${w.status}`, { 'is-next': dashboardData.nextWorkout && dashboardData.nextWorkout.id === w.id }]"
            >
              <div class="day-num">Day {{ w.day_number }}</div>
              <div class="day-type-badge">{{ w.workout_type.replace('_', ' ') }}</div>
              <div class="day-title">{{ w.title }}</div>
              <div class="day-status-indicator">
                <span v-if="w.status === 'completed'" class="icon-completed">✅ Done</span>
                <span v-else-if="w.status === 'skipped'" class="icon-skipped">❌ Skipped</span>
                <span v-else class="icon-pending">⏳ Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SIDE COLUMN: Progress Metrics & Recent Activities -->
      <div class="side-column">
        <!-- Progress Metrics -->
        <div class="glass-card metrics-card">
          <h3>Target: {{ dashboardData.athlete.raceDistance }} Race</h3>
          <div class="countdown-stat">
            <span class="countdown-number">{{ dashboardData.daysUntilRace }}</span>
            <span class="countdown-label">Days to Race</span>
          </div>

          <div class="progress-bar-container">
            <div class="progress-labels">
              <span>Program Progress</span>
              <span>{{ dashboardData.progressPercent }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${dashboardData.progressPercent}%` }"></div>
            </div>
          </div>

          <div class="extra-metrics">
            <div class="metric-box">
              <span class="metric-val">{{ dashboardData.totalDistanceKm }} km</span>
              <span class="metric-lbl">Total Logged Distance</span>
            </div>
            <div class="metric-box">
              <span class="metric-val">{{ dashboardData.completedWorkoutsCount }} / {{ dashboardData.totalWorkoutsCount }}</span>
              <span class="metric-lbl">Workouts Hit</span>
            </div>
          </div>
        </div>

        <!-- Recent Activities Feed -->
        <div class="glass-card activities-feed-card">
          <h3>Recent Activities</h3>
          <p class="section-desc">Latest synced entries from your Strava account.</p>

          <div v-if="dashboardData.recentActivities.length > 0" class="activities-list">
            <div 
              v-for="act in dashboardData.recentActivities" 
              :key="act.id" 
              class="activity-item"
            >
              <div class="activity-header">
                <div>
                  <h4 class="activity-title">{{ act.name }}</h4>
                  <span class="activity-date">{{ formatDate(act.start_date) }}</span>
                </div>
                <div class="activity-badges">
                  <span class="sport-badge">{{ act.sport_type }}</span>
                  <span v-if="act.matched_workout_id" class="matched-badge">Matched</span>
                </div>
              </div>

              <div class="activity-stats">
                <div>
                  <span class="lbl">Dist</span>
                  <span class="val">{{ formatDistance(act.distance) }}</span>
                </div>
                <div>
                  <span class="lbl">Time</span>
                  <span class="val">{{ formatDuration(act.moving_time) }}</span>
                </div>
                <div v-if="act.sport_type === 'Run'">
                  <span class="lbl">Pace</span>
                  <span class="val">{{ formatPace(act.average_speed) }}</span>
                </div>
                <div v-if="act.average_heartrate">
                  <span class="lbl">Avg HR</span>
                  <span class="val">{{ Math.round(act.average_heartrate) }} bpm</span>
                </div>
              </div>

              <!-- Coach Feedback Expander -->
              <div v-if="act.coach_feedback" class="feedback-section">
                <button @click="toggleFeedback(act.id)" class="feedback-toggle">
                  {{ expandedFeedback[act.id] ? 'Hide Coach Feedback 🔼' : 'Show Coach Feedback 🔽' }}
                </button>
                <div v-if="expandedFeedback[act.id]" class="feedback-bubble">
                  <span class="coach-icon">🧠</span>
                  <p class="coach-quote">"{{ act.coach_feedback }}"</p>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-activities">
            <p>No Strava activities found. Record a run/strength session on Strava and click Sync above!</p>
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

.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: stretch;
  }
}

.dashboard-header h1 {
  font-size: 2.2rem;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #ffffff 0%, var(--color-text-muted) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--color-text-muted);
}

.sync-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

@media (max-width: 768px) {
  .sync-actions {
    align-items: stretch;
  }
}

.sync-btn {
  padding: 10px 20px;
  font-size: 0.85rem;
}

.sync-spinner {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}

/* Toast Messages */
.toast {
  font-size: 0.8rem;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  animation: fadeIn 0.2s ease-out;
}

.toast-success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: var(--color-success);
}

.toast-error {
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.2);
  color: var(--color-error);
}

/* Not connected banner */
.not-connected-banner {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.9rem;
}

.banner-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.banner-link:hover {
  text-decoration: underline;
}

/* Layout Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 32px;
}

@media (max-width: 992px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.main-column, .side-column {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Next Workout Card */
.next-workout-card {
  position: relative;
  overflow: hidden;
  border-left: 4px solid var(--color-primary);
}

.next-workout-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 150px;
  height: 150px;
  background: radial-gradient(circle, rgba(181, 255, 43, 0.05) 0%, transparent 70%);
  pointer-events: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.badge-accent {
  background: rgba(181, 255, 43, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(181, 255, 43, 0.2);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 4px;
}

.workout-date {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.workout-body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

@media (max-width: 576px) {
  .workout-body {
    flex-direction: column;
  }
}

.workout-type-icon {
  font-size: 2.5rem;
  background: rgba(255, 255, 255, 0.03);
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-glass);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.workout-details {
  flex: 1;
}

.workout-details h2 {
  font-size: 1.5rem;
  margin-bottom: 8px;
}

.workout-desc {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 20px;
}

.workout-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.target-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.target-stat .label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.target-stat .value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
}

.capitalize {
  text-transform: capitalize;
}

.no-workout {
  text-align: center;
  color: var(--color-text-muted);
  padding: 20px 0;
}

/* Week Overview Card */
.week-overview-card h3 {
  font-size: 1.25rem;
  margin-bottom: 6px;
}

.section-desc {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-bottom: 20px;
}

.week-days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.day-card {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.day-card.is-next {
  border-color: var(--color-primary);
  background: rgba(181, 255, 43, 0.03);
}

.day-num {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.day-type-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.day-title {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.day-status-indicator {
  font-size: 0.7rem;
  font-weight: 500;
  margin-top: 4px;
}

.status-completed {
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.02);
}

.status-completed .day-type-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-skipped {
  border-color: rgba(244, 63, 94, 0.2);
  background: rgba(244, 63, 94, 0.02);
}

/* Side Column Metrics */
.metrics-card h3 {
  font-size: 1.25rem;
  margin-bottom: 16px;
}

.countdown-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 16px 0;
}

.countdown-number {
  font-family: var(--font-display);
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 4px 20px rgba(181,255,43,0.1);
}

.countdown-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 6px;
}

.progress-bar-container {
  margin: 20px 0;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.progress-bar {
  background: rgba(255,255,255,0.05);
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  height: 100%;
  border-radius: 999px;
  box-shadow: 0 0 10px rgba(181, 255, 43, 0.3);
}

.extra-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 24px;
}

.metric-box {
  background: rgba(255,255,255,0.01);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  padding: 16px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-val {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.15rem;
}

.metric-lbl {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Activities feed */
.activities-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.activity-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.activity-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.activity-badges {
  display: flex;
  gap: 6px;
}

.sport-badge {
  font-size: 0.65rem;
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.matched-badge {
  font-size: 0.65rem;
  background: rgba(181, 255, 43, 0.15);
  color: var(--color-primary);
  border: 1px solid rgba(181, 255, 43, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.activity-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  border-top: 1px dashed var(--border-glass);
  padding-top: 12px;
}

.activity-stats .lbl {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  display: block;
}

.activity-stats .val {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.9rem;
}

.feedback-section {
  border-top: 1px solid var(--border-glass);
  padding-top: 10px;
  margin-top: 4px;
}

.feedback-toggle {
  background: none;
  border: none;
  color: var(--color-primary);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
}

.feedback-toggle:hover {
  text-decoration: underline;
}

.feedback-bubble {
  background: rgba(181, 255, 43, 0.04);
  border: 1px solid rgba(181, 255, 43, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  display: flex;
  gap: 8px;
  animation: fadeIn 0.2s ease-out;
}

.coach-icon {
  font-size: 1.1rem;
}

.coach-quote {
  font-size: 0.85rem;
  line-height: 1.4;
  font-style: italic;
  color: #e2e8f0;
}

.no-activities {
  text-align: center;
  color: var(--color-text-muted);
  padding: 24px 0;
  font-size: 0.9rem;
}
</style>
