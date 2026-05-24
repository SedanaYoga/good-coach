<script setup lang="ts">
import type { SetupConfigResponse } from 'types/domain/athlete'
import { formatDate } from 'utils/date'

const route = useRoute()
const router = useRouter()

const config = ref<SetupConfigResponse>({
  connected: false,
  athleteId: null,
  raceDistance: '10K',
  raceDate: '',
  targetTime: '',
  onboardingAnswers: null,
  coachPersonality: 'encouraging',
  currentLevel: 'beginner',
  hasGeminiKey: false,
})

const targetTime = ref('')
const currentStep = ref(1)
const questions = ref<string[]>([])
const answers = ref<Record<string, string>>({})

const isSubmitting = ref(false)
const isLoadingQuestions = ref(false)
const errorMsg = ref<string | null>(null)
const successMsg = ref<string | null>(null)

// Fetch existing setup configurations
async function fetchConfig() {
  try {
    const data = await $fetch<SetupConfigResponse>('/api/setup')
    config.value = { ...config.value, ...data }
    targetTime.value = data.targetTime || ''
    if (data.onboardingAnswers) {
      answers.value = { ...data.onboardingAnswers }
    }
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

async function goToStep2() {
  if (!config.value.raceDate) {
    errorMsg.value = 'Please select a target race date.'
    return
  }
  errorMsg.value = null
  isLoadingQuestions.value = true
  currentStep.value = 2

  try {
    // Save current Step 1 settings in DB so the questionnaire generation gets the right context
    await $fetch('/api/setup', {
      method: 'POST',
      body: {
        raceDistance: config.value.raceDistance,
        raceDate: config.value.raceDate,
        targetTime: targetTime.value,
        coachPersonality: config.value.coachPersonality,
        currentLevel: config.value.currentLevel,
      },
    })

    // Fetch dynamic questions
    const res = await $fetch<{ questions: string[] }>('/api/setup?action=questions')
    questions.value = res.questions
    
    // Initialize answers array for new questions
    res.questions.forEach((q) => {
      if (!answers.value[q]) {
        answers.value[q] = ''
      }
    })
  } catch (err) {
    console.error('Failed to load dynamic questionnaire:', err)
    errorMsg.value = 'Failed to generate dynamic questionnaire. Please try again.'
    currentStep.value = 1
  } finally {
    isLoadingQuestions.value = false
  }
}

function goToStep3() {
  // Validate that all questions are answered
  const unanswered = questions.value.some((q) => !answers.value[q]?.trim())
  if (unanswered) {
    errorMsg.value = 'Please answer all questions to help your coach build the best plan.'
    return
  }
  errorMsg.value = null
  currentStep.value = 3
}

async function saveAndGeneratePlan() {
  isSubmitting.value = true
  errorMsg.value = null
  successMsg.value = null

  try {
    const body = {
      raceDistance: config.value.raceDistance,
      raceDate: config.value.raceDate,
      targetTime: targetTime.value,
      coachPersonality: config.value.coachPersonality,
      currentLevel: config.value.currentLevel,
      answers: answers.value,
    }

    await $fetch('/api/setup', {
      method: 'POST',
      body,
    })

    successMsg.value = 'Profile saved successfully! Redirecting to your training plan...'
    setTimeout(() => {
      router.push('/plan')
    }, 500)
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
  return formatDate(tomorrow, 'YYYY-MM-DD')
})

const distances = [
  { value: '5K', icon: '🏃', label: '5K' },
  { value: '10K', icon: '⚡', label: '10K' },
  { value: 'Half Marathon', icon: '🔥', label: 'Half Marathon' },
  { value: 'Marathon', icon: '🏆', label: 'Marathon' },
]
</script>

<template>
  <div class="max-w-[850px] mx-auto animate-fade-in">
    <div class="text-center mb-8">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-2">
        Race Preparation Wizard
      </h1>
      <p class="text-sm text-muted-foreground">
        Set your target, connect your Strava account, and let the AI Coach build
        your custom plan.
      </p>
    </div>

    <!-- Step Progress Indicator -->
    <div class="flex items-center justify-center gap-2 mb-8">
      <div
        :class="[
          'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
          currentStep === 1
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        ]"
      >
        1. Goals & Config
      </div>
      <div class="w-8 h-px bg-border"></div>
      <div
        :class="[
          'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
          currentStep === 2
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        ]"
      >
        2. Dynamic Interview
      </div>
      <div class="w-8 h-px bg-border"></div>
      <div
        :class="[
          'px-3 py-1 rounded-full text-xs font-semibold transition-colors',
          currentStep === 3
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        ]"
      >
        3. Review & Build
      </div>
    </div>

    <!-- Alerts -->
    <UiAlert v-if="errorMsg" variant="destructive" class="mb-6">
      <UiAlertDescription class="flex items-start gap-2">
        <span>⚠️</span>
        <p>{{ errorMsg }}</p>
      </UiAlertDescription>
    </UiAlert>
    <UiAlert v-if="successMsg" variant="default" class="mb-6">
      <UiAlertDescription class="flex items-start gap-2">
        <span>✅</span>
        <p>{{ successMsg }}</p>
      </UiAlertDescription>
    </UiAlert>

    <!-- Main Wizard Card -->
    <div class="grid grid-cols-1 gap-6">
      <!-- STEP 1: GOALS & PERSONALITY -->
      <div v-if="currentStep === 1" class="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-6">
        <!-- Connection Status Card -->
        <UiCard class="flex flex-col">
          <UiCardHeader>
            <UiCardTitle>1. Strava Integration</UiCardTitle>
            <UiCardDescription>
              We fetch your running and strength sessions from Strava to track
              your targets automatically.
            </UiCardDescription>
          </UiCardHeader>
          <UiCardContent class="flex-1 flex flex-col gap-4">
            <div
              v-if="config.connected"
              class="bg-success/5 border border-success/20 rounded-lg p-4 flex flex-col gap-1.5"
            >
              <div
                class="flex items-center gap-2 text-success text-sm font-medium"
              >
                <span class="w-2 h-2 rounded-full bg-success"></span>
                Connected to Strava
              </div>
              <span class="text-xs text-muted-foreground"
                >Athlete ID: {{ config.athleteId }}</span
              >
            </div>

            <div v-else class="border border-border rounded-lg p-6 text-center">
              <p class="text-sm text-muted-foreground mb-4">
                No active Strava connection detected.
              </p>
              <UiButton
                as="a"
                href="/api/strava/auth"
                class="w-full no-underline"
              >
                Connect Strava Account ⚡
              </UiButton>
            </div>

            <div
              class="bg-muted/50 border-l-2 border-muted-foreground/30 p-3 rounded-r-md text-xs text-muted-foreground leading-relaxed"
            >
              <p>
                💡 Make sure you have registered your app at
                <a
                  href="https://www.strava.com/settings/api"
                  target="_blank"
                  class="text-primary no-underline font-medium hover:underline"
                  >Strava Developers</a
                >
                and configured client credentials in your local
                <code class="bg-muted px-1 py-0.5 rounded text-xs">`.env`</code>
                file.
              </p>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Goals Configuration -->
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>2. Target & Coach Configuration</UiCardTitle>
            <UiCardDescription>
              Define your target race and choose your AI coach style.
            </UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form @submit.prevent="goToStep2" class="flex flex-col gap-5">
              <!-- Race Distance selector -->
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-muted-foreground"
                  >Target Distance</label
                >
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

              <!-- Target Date & Target Time -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <label
                    for="raceDate"
                    class="text-sm font-medium text-muted-foreground"
                    >Race Date</label
                  >
                  <UiInput
                    type="date"
                    id="raceDate"
                    v-model="config.raceDate"
                    :min="minDate"
                    required
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <label
                    for="targetTime"
                    class="text-sm font-medium text-muted-foreground"
                    >Target Finish Time</label
                  >
                  <UiInput
                    type="text"
                    id="targetTime"
                    v-model="targetTime"
                    placeholder="e.g. 03:45:00 or 45:00"
                  />
                </div>
              </div>

              <!-- Athlete Fitness level -->
              <div class="flex flex-col gap-2">
                <label
                  for="currentLevel"
                  class="text-sm font-medium text-muted-foreground"
                  >Current Fitness Level</label
                >
                <UiSelect v-model="config.currentLevel">
                  <UiSelectTrigger id="currentLevel" class="w-full">
                    <UiSelectValue placeholder="Select fitness level" />
                  </UiSelectTrigger>
                  <UiSelectContent>
                    <UiSelectItem value="beginner">
                      Beginner (Started running recently, 1-2 runs/week)
                    </UiSelectItem>
                    <UiSelectItem value="intermediate">
                      Intermediate (Can run 5K easily, 3-4 runs/week)
                    </UiSelectItem>
                    <UiSelectItem value="advanced">
                      Advanced (Experienced runner, 5+ runs/week)
                    </UiSelectItem>
                  </UiSelectContent>
                </UiSelect>
              </div>

              <!-- Coach Personality -->
              <div class="flex flex-col gap-2">
                <label
                  for="coachPersonality"
                  class="text-sm font-medium text-muted-foreground"
                  >Coach Personality Style</label
                >
                <UiSelect v-model="config.coachPersonality">
                  <UiSelectTrigger id="coachPersonality" class="w-full">
                    <UiSelectValue placeholder="Select coach personality" />
                  </UiSelectTrigger>
                  <UiSelectContent>
                    <UiSelectItem value="encouraging">
                      Encouraging (Positive, motivating, supportive)
                    </UiSelectItem>
                    <UiSelectItem value="strict">
                      Strict (Tough love, focus on target metrics, no excuses)
                    </UiSelectItem>
                    <UiSelectItem value="data-driven">
                      Data-driven (Focuses on average pace, zones, numbers)
                    </UiSelectItem>
                  </UiSelectContent>
                </UiSelect>
              </div>

              <!-- AI Status Warning -->
              <UiAlert v-if="!config.hasGeminiKey" variant="destructive">
                <UiAlertDescription class="text-xs">
                  ⚠️ <strong>GEMINI_API_KEY</strong> is not configured.
                  We will construct a rule-based template for your plan instead.
                </UiAlertDescription>
              </UiAlert>

              <UiButton type="submit" class="w-full mt-1">
                Continue to Interview ➔
              </UiButton>
            </form>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- STEP 2: DYNAMIC INTERVIEW -->
      <div v-if="currentStep === 2">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Coach Interview</UiCardTitle>
            <UiCardDescription>
              Based on your goals and historical activities, the coach is asking
              for additional details not visible in your Strava data.
            </UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <!-- Loading Questionnaire -->
            <div v-if="isLoadingQuestions" class="flex flex-col items-center justify-center py-12 gap-4">
              <div class="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin"></div>
              <p class="text-sm text-muted-foreground">AI Coach is reviewing your context & formulating questions...</p>
            </div>

            <!-- Questionnaire Form -->
            <form v-else @submit.prevent="goToStep3" class="flex flex-col gap-6">
              <div v-for="(q, idx) in questions" :key="idx" class="flex flex-col gap-2">
                <label :for="'q_' + idx" class="text-sm font-semibold text-foreground">
                  {{ q }}
                </label>
                <UiInput
                  type="text"
                  :id="'q_' + idx"
                  v-model="answers[q]"
                  required
                  placeholder="Type your answer here..."
                />
              </div>

              <div class="flex items-center gap-3">
                <UiButton type="button" variant="outline" class="flex-1" @click="currentStep = 1">
                  Back
                </UiButton>
                <UiButton type="submit" class="flex-1">
                  Review Plan Setup ➔
                </UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- STEP 3: REVIEW & BUILD -->
      <div v-if="currentStep === 3">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Plan Setup Review</UiCardTitle>
            <UiCardDescription>
              Please double check your configurations before generating your training plan.
            </UiCardDescription>
          </UiCardHeader>
          <UiCardContent class="flex flex-col gap-6">
            <!-- Parameter Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/40 border border-border rounded-lg">
              <div>
                <span class="text-[0.7rem] text-muted-foreground uppercase tracking-wider block">Target Distance</span>
                <span class="font-semibold text-sm">{{ config.raceDistance }}</span>
              </div>
              <div>
                <span class="text-[0.7rem] text-muted-foreground uppercase tracking-wider block">Race Date</span>
                <span class="font-semibold text-sm">{{ config.raceDate }}</span>
              </div>
              <div>
                <span class="text-[0.7rem] text-muted-foreground uppercase tracking-wider block">Target Finish Time</span>
                <span class="font-semibold text-sm">{{ targetTime || 'No specific target' }}</span>
              </div>
              <div>
                <span class="text-[0.7rem] text-muted-foreground uppercase tracking-wider block">Coach Style</span>
                <span class="font-semibold text-sm capitalize">{{ config.coachPersonality }}</span>
              </div>
            </div>

            <!-- Answers Block -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold text-foreground border-b border-border pb-1">Onboarding Details</h3>
              <div v-for="(ans, q) in answers" :key="q" class="bg-muted/20 border border-border/60 p-3 rounded-md">
                <span class="text-xs font-semibold text-muted-foreground block mb-1">{{ q }}</span>
                <p class="text-xs text-foreground">{{ ans }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <UiButton type="button" variant="outline" class="flex-1" @click="currentStep = 2" :disabled="isSubmitting">
                Back
              </UiButton>
              <UiButton type="button" class="flex-1" @click="saveAndGeneratePlan" :disabled="isSubmitting">
                <span v-if="isSubmitting">Building Training Program...</span>
                <span v-else>Generate Training Program 🚀</span>
              </UiButton>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </div>
  </div>
</template>
