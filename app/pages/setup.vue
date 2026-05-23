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
  <div class="max-w-[1000px] mx-auto animate-fade-in">
    <div class="text-center mb-10">
      <h1
        class="text-4xl md:text-5xl font-extrabold mb-3 bg-linear-to-br from-white to-text-muted bg-clip-text text-transparent"
      >
        Race Preparation Wizard
      </h1>
      <p class="text-text-muted text-lg">
        Set your target, connect your Strava account, and let the AI Coach build
        your custom plan.
      </p>
    </div>

    <!-- Alerts -->
    <div
      v-if="errorMsg"
      class="bg-error/8 border border-error/20 text-rose-300 px-5 py-4 rounded-md flex items-start gap-3 mb-8 text-[0.95rem] leading-relaxed"
    >
      <span class="text-lg">⚠️</span>
      <p>{{ errorMsg }}</p>
    </div>
    <div
      v-if="successMsg"
      class="bg-success/8 border border-success/20 text-emerald-200 px-5 py-4 rounded-md flex items-start gap-3 mb-8 text-[0.95rem] leading-relaxed"
    >
      <span class="text-lg">✅</span>
      <p>{{ successMsg }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-8">
      <!-- Connection Status Card -->
      <div class="glass-card flex flex-col">
        <h2 class="text-lg font-semibold tracking-tight mb-2">1. Strava Integration</h2>
        <p class="text-text-muted text-[0.95rem] mb-6 leading-relaxed">
          We fetch your running and strength sessions from Strava to track your
          targets automatically.
        </p>

        <div
          v-if="config.connected"
          class="bg-success/8 border border-success/20 rounded-md p-4 flex flex-col gap-1.5 mb-6"
        >
          <div class="flex items-center gap-2 text-success">
            <span
              class="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_var(--color-success)]"
            ></span>
            <strong>Connected to Strava</strong>
          </div>
          <span class="text-xs text-text-muted"
            >Athlete ID: {{ config.athleteId }}</span
          >
        </div>

        <div
          v-else
          class="bg-error/4 border border-error/15 rounded-md p-6 text-center mb-6"
        >
          <p class="text-error font-medium mb-4">
            No active Strava connection detected.
          </p>
          <a
            href="/api/strava/auth"
            class="btn-primary w-full justify-center no-underline"
          >
            Connect Strava Account ⚡
          </a>
        </div>

        <div
          class="bg-white/2 border-l-3 border-text-muted p-3.5 rounded-r-sm flex gap-3 text-[0.85rem] leading-relaxed text-text-muted"
        >
          <span class="text-base">💡</span>
          <p>
            Make sure you have registered your app at
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              class="text-primary no-underline font-medium hover:underline"
              >Strava Developers</a
            >
            and configured client credentials in your local
            <code>.env</code> file.
          </p>
        </div>
      </div>

      <!-- Training Goal Form Card -->
      <div class="glass-card">
        <h2 class="text-lg font-semibold tracking-tight mb-2">2. Target & Coach Configuration</h2>
        <p class="text-text-muted text-[0.95rem] mb-6 leading-relaxed">
          Define your target race and choose your AI coach style.
        </p>

        <form @submit.prevent="saveAndGeneratePlan" class="flex flex-col gap-6">
          <!-- Race Distance selector -->
          <div class="flex flex-col gap-2">
            <label class="font-display font-semibold text-sm text-text-muted"
              >Target Distance</label
            >
            <div class="grid grid-cols-2 gap-3">
              <label
                v-for="dist in ['5K', '10K', 'Half Marathon', 'Marathon']"
                :key="dist"
                :class="[
                  'bg-white/2 border border-white/5 rounded-md p-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:bg-white/5 hover:border-white/15',
                  {
                    'bg-primary/6 border-primary shadow-[0_0_15px_rgba(181,255,43,0.08)]':
                      config.raceDistance === dist,
                  },
                ]"
              >
                <input
                  type="radio"
                  name="distance"
                  :value="dist"
                  v-model="config.raceDistance"
                  class="sr-only"
                />
                <span class="text-2xl">{{
                  dist === '5K'
                    ? '🏃'
                    : dist === '10K'
                      ? '⚡'
                      : dist === 'Half Marathon'
                        ? '🔥'
                        : '🏆'
                }}</span>
                <span class="font-display font-semibold text-sm">{{
                  dist
                }}</span>
              </label>
            </div>
          </div>

          <!-- Target Date -->
          <div class="flex flex-col gap-2">
            <label
              for="raceDate"
              class="font-display font-semibold text-sm text-text-muted"
              >Race Date</label
            >
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
          <div class="flex flex-col gap-2">
            <label
              for="currentLevel"
              class="font-display font-semibold text-sm text-text-muted"
              >Current Fitness Level</label
            >
            <div class="relative w-full">
              <select
                id="currentLevel"
                v-model="config.currentLevel"
                class="form-select appearance-none pr-10"
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
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-muted">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Coach Personality -->
          <div class="flex flex-col gap-2">
            <label
              for="coachPersonality"
              class="font-display font-semibold text-sm text-text-muted"
              >Coach Personality Style</label
            >
            <div class="relative w-full">
              <select
                id="coachPersonality"
                v-model="config.coachPersonality"
                class="form-select appearance-none pr-10"
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
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-muted">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <!-- AI Status Warning -->
          <div
            v-if="!config.hasGeminiKey"
            class="bg-warning/4 border-l-3 border-warning p-3.5 rounded-r-sm flex gap-3 text-[0.85rem] leading-relaxed text-text-muted"
          >
            <span class="text-base">⚠️</span>
            <p>
              <strong>GEMINI_API_KEY</strong> is not configured in
              <code>.env</code>. The app will generate a highly optimized static
              program template for your race instead.
            </p>
          </div>

          <button
            type="submit"
            class="btn-primary mt-3 w-full justify-center"
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
