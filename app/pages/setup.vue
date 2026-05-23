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

const distances = [
  { value: '5K', icon: '🏃', label: '5K' },
  { value: '10K', icon: '⚡', label: '10K' },
  { value: 'Half Marathon', icon: '🔥', label: 'Half Marathon' },
  { value: 'Marathon', icon: '🏆', label: 'Marathon' },
]
</script>

<template>
  <div class="max-w-[900px] mx-auto animate-fade-in">
    <div class="text-center mb-8">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">
        Race Preparation Wizard
      </h1>
      <p class="text-sm text-muted-foreground">
        Set your target, connect your Strava account, and let the AI Coach build
        your custom plan.
      </p>
    </div>

    <!-- Alerts -->
    <UiAlert v-if="errorMsg" variant="destructive" class="mb-6">
      <UiAlertDescription class="flex items-start gap-2">
        <span>⚠️</span>
        <p>{{ errorMsg }}</p>
      </UiAlertDescription>
    </UiAlert>
    <UiAlert v-if="successMsg" variant="success" class="mb-6">
      <UiAlertDescription class="flex items-start gap-2">
        <span>✅</span>
        <p>{{ successMsg }}</p>
      </UiAlertDescription>
    </UiAlert>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-6">
      <!-- Connection Status Card -->
      <UiCard class="flex flex-col">
        <UiCardHeader>
          <UiCardTitle>1. Strava Integration</UiCardTitle>
          <UiCardDescription>
            We fetch your running and strength sessions from Strava to track your
            targets automatically.
          </UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="flex-1 flex flex-col gap-4">
          <div
            v-if="config.connected"
            class="bg-success/5 border border-success/20 rounded-lg p-4 flex flex-col gap-1.5"
          >
            <div class="flex items-center gap-2 text-success text-sm font-medium">
              <span class="w-2 h-2 rounded-full bg-success"></span>
              Connected to Strava
            </div>
            <span class="text-xs text-muted-foreground">Athlete ID: {{ config.athleteId }}</span>
          </div>

          <div
            v-else
            class="border border-border rounded-lg p-6 text-center"
          >
            <p class="text-sm text-muted-foreground mb-4">
              No active Strava connection detected.
            </p>
            <UiButton as="a" href="/api/strava/auth" class="w-full no-underline">
              Connect Strava Account ⚡
            </UiButton>
          </div>

          <div class="bg-muted/50 border-l-2 border-muted-foreground/30 p-3 rounded-r-md text-xs text-muted-foreground leading-relaxed">
            <p>
              💡 Make sure you have registered your app at
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                class="text-primary no-underline font-medium hover:underline"
              >Strava Developers</a>
              and configured client credentials in your local
              <code class="bg-muted px-1 py-0.5 rounded text-xs">`.env`</code> file.
            </p>
          </div>
        </UiCardContent>
      </UiCard>

      <!-- Training Goal Form Card -->
      <UiCard>
        <UiCardHeader>
          <UiCardTitle>2. Target & Coach Configuration</UiCardTitle>
          <UiCardDescription>
            Define your target race and choose your AI coach style.
          </UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <form @submit.prevent="saveAndGeneratePlan" class="flex flex-col gap-5">
            <!-- Race Distance selector -->
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-muted-foreground">Target Distance</label>
              <div class="grid grid-cols-2 gap-2">
                <label
                  v-for="dist in distances"
                  :key="dist.value"
                  :class="[
                    'border rounded-lg p-3 flex flex-col items-center gap-1.5 cursor-pointer transition-colors hover:bg-muted/50',
                    config.raceDistance === dist.value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground',
                  ]"
                >
                  <input
                    type="radio"
                    name="distance"
                    :value="dist.value"
                    v-model="config.raceDistance"
                    class="sr-only"
                  />
                  <span class="text-xl">{{ dist.icon }}</span>
                  <span class="font-medium text-sm">{{ dist.label }}</span>
                </label>
              </div>
            </div>

            <!-- Target Date -->
            <div class="flex flex-col gap-2">
              <label for="raceDate" class="text-sm font-medium text-muted-foreground">Race Date</label>
              <UiInput
                type="date"
                id="raceDate"
                v-model="config.raceDate"
                :min="minDate"
                required
              />
            </div>

            <!-- Athlete Fitness level -->
            <div class="flex flex-col gap-2">
              <label for="currentLevel" class="text-sm font-medium text-muted-foreground">Current Fitness Level</label>
              <UiSelect id="currentLevel" v-model="config.currentLevel">
                <option value="beginner">
                  Beginner (Started running recently, 1-2 runs/week)
                </option>
                <option value="intermediate">
                  Intermediate (Can run 5K easily, 3-4 runs/week)
                </option>
                <option value="advanced">
                  Advanced (Experienced runner, 5+ runs/week)
                </option>
              </UiSelect>
            </div>

            <!-- Coach Personality -->
            <div class="flex flex-col gap-2">
              <label for="coachPersonality" class="text-sm font-medium text-muted-foreground">Coach Personality Style</label>
              <UiSelect id="coachPersonality" v-model="config.coachPersonality">
                <option value="encouraging">
                  Encouraging (Positive, motivating, supportive)
                </option>
                <option value="strict">
                  Strict (Tough love, focus on target metrics, no excuses)
                </option>
                <option value="data-driven">
                  Data-driven (Focuses on average pace, zones, numbers)
                </option>
              </UiSelect>
            </div>

            <!-- AI Status Warning -->
            <UiAlert v-if="!config.hasGeminiKey" variant="warning">
              <UiAlertDescription class="text-xs">
                ⚠️ <strong>GEMINI_API_KEY</strong> is not configured in
                <code class="bg-muted px-1 py-0.5 rounded text-xs">.env</code>. The app will generate a highly optimized static
                program template for your race instead.
              </UiAlertDescription>
            </UiAlert>

            <UiButton type="submit" :disabled="isSubmitting" class="w-full mt-1">
              <span v-if="isSubmitting">Generating Plan...</span>
              <span v-else>Generate Training Program 🚀</span>
            </UiButton>
          </form>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>
