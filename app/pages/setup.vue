<script setup lang="ts">
import type { SetupConfigResponse, SetupRequest } from 'types/domain/athlete'

const route = useRoute()
const router = useRouter()

const config = ref<SetupConfigResponse>({
  connected: false,
  athleteId: null,
  raceDistance: '10K',
  raceDate: '',
  coachPersonality: 'encouraging',
  currentLevel: 'beginner',
  hasGeminiKey: false,
})

const isSubmitting = ref(false)
const errorMsg = ref<string | null>(null)
const successMsg = ref<string | null>(null)

// Fetch existing setup configurations
async function fetchConfig() {
  try {
    const data = await $fetch<SetupConfigResponse>('/api/setup')
    config.value = { ...config.value, ...data }
  } catch (err) {
    console.error('Failed to load setup config:', err)
  }
}

onMounted(() => {
  fetchConfig()

  // Handle query parameter messages
  if (route.query.auth === 'success') {
    successMsg.value = 'Successfully connected to Strava!'
    // Clean up url parameters
    router.replace({ query: {} })
  } else if (route.query.error === 'missing_keys') {
    errorMsg.value =
      'Config Error: Please specify your STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in the .env file.'
    router.replace({ query: {} })
  } else if (route.query.error === 'token_exchange_failed') {
    errorMsg.value =
      'OAuth Error: Failed to exchange authorization code with Strava. Please try again.'
    router.replace({ query: {} })
  }
})

async function saveAndGeneratePlan() {
  if (!config.value.raceDate) {
    errorMsg.value = 'Please select a target race date.'
    return
  }

  isSubmitting.value = true
  errorMsg.value = null
  successMsg.value = null

  try {
    const body: SetupRequest = {
      raceDistance: config.value.raceDistance,
      raceDate: config.value.raceDate,
      coachPersonality: config.value.coachPersonality,
      currentLevel: config.value.currentLevel,
    }

    const res = await $fetch<{ success: boolean; workoutsCount: number }>(
      '/api/setup',
      {
        method: 'POST',
        body,
      },
    )

    if (res.success) {
      successMsg.value = `Successfully generated a ${res.workoutsCount}-session training program! Redirecting to Dashboard...`
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  } catch (err) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    console.error('Plan generation failed:', err)
    errorMsg.value =
      fetchErr.data?.statusMessage ||
      'Failed to generate training plan. Please check your setup parameters.'
  } finally {
    isSubmitting.value = false
  }
}

// Helper: check if date is in the past
const minDate = computed(() => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0] || ''
})
</script>

<template>
  <div class="setup-container animate-fade-in">
    <div class="setup-header">
      <h1>Race Preparation Wizard</h1>
      <p class="subtitle">
        Set your target, connect your Strava account, and let the AI Coach build
        your custom plan.
      </p>
    </div>

    <!-- Alerts -->
    <div v-if="errorMsg" class="alert alert-error">
      <span class="alert-icon">⚠️</span>
      <p>{{ errorMsg }}</p>
    </div>
    <div v-if="successMsg" class="alert alert-success">
      <span class="alert-icon">✅</span>
      <p>{{ successMsg }}</p>
    </div>

    <div class="setup-grid">
      <!-- Connection Status Card -->
      <div class="glass-card connection-card">
        <h2>1. Strava Integration</h2>
        <p class="card-desc">
          We fetch your running and strength sessions from Strava to track your
          targets automatically.
        </p>

        <div v-if="config.connected" class="connected-badge">
          <div class="badge-status">
            <span class="dot-active"></span>
            <strong>Connected to Strava</strong>
          </div>
          <span class="subtext">Athlete ID: {{ config.athleteId }}</span>
        </div>

        <div v-else class="disconnected-badge">
          <p class="warning-text">No active Strava connection detected.</p>
          <a href="/api/strava/auth" class="btn-primary connect-btn">
            Connect Strava Account ⚡
          </a>
        </div>

        <div class="info-note">
          <span class="note-icon">💡</span>
          <p>
            Make sure you have registered your app at
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              class="link-inline"
              >Strava Developers</a
            >
            and configured client credentials in your local
            <code>.env</code> file.
          </p>
        </div>
      </div>

      <!-- Training Goal Form Card -->
      <div class="glass-card form-card">
        <h2>2. Target & Coach Configuration</h2>
        <p class="card-desc">
          Define your target race and choose your AI coach style.
        </p>

        <form @submit.prevent="saveAndGeneratePlan" class="wizard-form">
          <!-- Race Distance selector -->
          <div class="form-group">
            <label class="form-label">Target Distance</label>
            <div class="distance-options">
              <label
                v-for="dist in ['5K', '10K', 'Half Marathon', 'Marathon']"
                :key="dist"
                :class="[
                  'distance-card',
                  { active: config.raceDistance === dist },
                ]"
              >
                <input
                  type="radio"
                  name="distance"
                  :value="dist"
                  v-model="config.raceDistance"
                  class="sr-only"
                />
                <span class="dist-icon">{{
                  dist === '5K'
                    ? '🏃'
                    : dist === '10K'
                      ? '⚡'
                      : dist === 'Half Marathon'
                        ? '🔥'
                        : '🏆'
                }}</span>
                <span class="dist-label">{{ dist }}</span>
              </label>
            </div>
          </div>

          <!-- Target Date -->
          <div class="form-group">
            <label for="raceDate" class="form-label">Race Date</label>
            <input
              type="date"
              id="raceDate"
              v-model="config.raceDate"
              :min="minDate"
              class="form-input"
              required
            />
          </div>

          <!-- Athlete Fitness level -->
          <div class="form-group">
            <label for="currentLevel" class="form-label"
              >Current Fitness Level</label
            >
            <select
              id="currentLevel"
              v-model="config.currentLevel"
              class="form-select"
            >
              <option value="beginner">
                Beginner (Started running recently, 1-2 runs/week)
              </option>
              <option value="intermediate">
                Intermediate (Can run 5K easily, 3-4 runs/week)
              </option>
              <option value="advanced">
                Advanced (Experienced runner, 5+ runs/week)
              </option>
            </select>
          </div>

          <!-- Coach Personality -->
          <div class="form-group">
            <label for="coachPersonality" class="form-label"
              >Coach Personality Style</label
            >
            <select
              id="coachPersonality"
              v-model="config.coachPersonality"
              class="form-select"
            >
              <option value="encouraging">
                Encouraging (Positive, motivating, supportive)
              </option>
              <option value="strict">
                Strict (Tough love, focus on target metrics, no excuses)
              </option>
              <option value="data-driven">
                Data-driven (Focuses on average pace, zones, numbers)
              </option>
            </select>
          </div>

          <!-- AI Status Warning -->
          <div v-if="!config.hasGeminiKey" class="info-note warning-note">
            <span class="note-icon">⚠️</span>
            <p>
              <strong>GEMINI_API_KEY</strong> is not configured in
              <code>.env</code>. The app will generate a highly optimized static
              program template for your race instead.
            </p>
          </div>

          <button
            type="submit"
            class="btn-primary submit-btn"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting">Generating Plan...</span>
            <span v-else>Generate Training Program 🚀</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup-container {
  max-width: 1000px;
  margin: 0 auto;
}

.setup-header {
  text-align: center;
  margin-bottom: 40px;
}

.setup-header h1 {
  font-size: 2.5rem;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #ffffff 0%, var(--color-text-muted) 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

.setup-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 32px;
}

@media (max-width: 768px) {
  .setup-grid {
    grid-template-columns: 1fr;
  }
}

.card-desc {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  margin-bottom: 24px;
  line-height: 1.5;
}

/* Connection Badge Styles */
.connected-badge {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 24px;
}

.badge-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-success);
}

.dot-active {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.connected-badge .subtext {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.disconnected-badge {
  background: rgba(244, 63, 94, 0.04);
  border: 1px solid rgba(244, 63, 94, 0.15);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
}

.warning-text {
  color: var(--color-error);
  font-weight: 500;
  margin-bottom: 16px;
}

.connect-btn {
  width: 100%;
  justify-content: center;
  text-decoration: none;
}

/* Info Note Styles */
.info-note {
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid var(--color-text-muted);
  padding: 14px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.warning-note {
  border-left-color: var(--color-warning);
  background: rgba(245, 158, 11, 0.04);
}

.link-inline {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.link-inline:hover {
  text-decoration: underline;
}

/* Form Styles */
.wizard-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.distance-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.distance-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.distance-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.distance-card.active {
  background: rgba(181, 255, 43, 0.06);
  border-color: var(--color-primary);
  box-shadow: 0 0 15px rgba(181, 255, 43, 0.08);
}

.dist-icon {
  font-size: 1.5rem;
}

.dist-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9rem;
}

.submit-btn {
  margin-top: 12px;
  width: 100%;
  justify-content: center;
}

/* Alert Boxes */
.alert {
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 32px;
  font-size: 0.95rem;
  line-height: 1.5;
}

.alert-error {
  background: rgba(244, 63, 94, 0.08);
  border: 1px solid rgba(244, 63, 94, 0.2);
  color: #fda4af;
}

.alert-success {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #a7f3d0;
}

.alert-icon {
  font-size: 1.2rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
