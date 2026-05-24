import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAthleteConfig } from './db'
import type { Workout, WorkoutType } from 'types/domain/workout'
import type { Activity } from 'types/domain/activity'

let aiInstance: GoogleGenerativeAI | null = null

function getAI() {
  if (aiInstance) return aiInstance
  const config = useRuntimeConfig()
  if (!config.geminiApiKey) {
    console.warn(
      'GEMINI_API_KEY is not set. Falling back to local template generator.',
    )
    return null
  }
  aiInstance = new GoogleGenerativeAI(config.geminiApiKey)
  return aiInstance
}

export async function generateQuestions(athleteContext: any): Promise<string[]> {
  const ai = getAI()
  const fallbackQuestions = [
    "What is your target time or duration for your goal race?",
    "Do you have any current injuries, pain, or physical limitations we should design around?",
    "Which specific days of the week are you available for running sessions?",
    "Do you have access to gym equipment (weights, bands) for strength training, or do you prefer bodyweight exercises?",
    "Are there any specific weather, terrain, or schedule constraints we should know about?"
  ]

  if (!ai) {
    return fallbackQuestions
  }

  const contextStr = athleteContext 
    ? `Athlete's 3-Month Strava History:
- Weekly Average Mileage: ${athleteContext.weeklyMileageKm} km
- Running Speed: ${athleteContext.averageSpeed} m/s
- Average Training Load: ${athleteContext.avgWeeklyLoad}
- Total Run Count: ${athleteContext.totalRuns}`
    : "No Strava history connected yet."

  const prompt = `
You are a professional running coach. Based on the athlete's available training context, you need to generate a dynamic onboarding questionnaire to customize their training block.
Context:
${contextStr}

We need to gather missing requirements not detectable in Strava history.
Instruct the athlete to provide:
1. Their primary goal: specifically target finish time or duration.
2. Current or recent injuries / physical limitations.
3. Available training days per week and weekly schedule constraints.
4. Specific equipment availability (e.g. access to a gym, weights, resistance bands, or bodyweight only).

Generate 4 to 6 specific, concise questions.
Return the output strictly as a JSON array of strings, without any markdown formatting, markdown headers, or other text.
Example format:
[
  "Question 1?",
  "Question 2?"
]
`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const jsonStr = text
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim()
    const questions = JSON.parse(jsonStr)
    if (Array.isArray(questions) && questions.every(q => typeof q === 'string')) {
      return questions
    }
    return fallbackQuestions
  } catch (err) {
    console.error('Gemini questions generation failed, falling back:', err)
    return fallbackQuestions
  }
}

export async function generateTrainingBlock(
  stravaData: any,
  userAnswers: any,
): Promise<Workout[]> {
  const ai = getAI()
  const raceDistance = userAnswers.raceDistance || '10K'
  const raceDate = userAnswers.raceDate
  const currentLevel = userAnswers.currentLevel || 'beginner'
  const targetTime = userAnswers.targetTime || 'N/A'
  const personality = userAnswers.coachPersonality || 'encouraging'
  const answers = userAnswers.answers || {}

  const weeksDiff = calculateWeeksUntilDate(raceDate)

  if (!ai) {
    console.log('Using rule-based fallback training block generator.')
    return generateFallbackTrainingBlock(weeksDiff, raceDistance)
  }

  const stravaContextStr = stravaData
    ? `Average Weekly Mileage: ${stravaData.weeklyMileageKm} km, Average Pace: ${stravaData.averageSpeed} m/s, Average Weekly Training Load: ${stravaData.avgWeeklyLoad}, Total Runs: ${stravaData.totalRuns}`
    : 'No historical Strava data connected.'

  const answersStr = Object.entries(answers)
    .map(([q, a]) => `- Question: ${q}\n  Answer: ${a}`)
    .join('\n')

  const prompt = `
You are a professional running coach with a "${personality}" personality.
Generate a structured, day-by-day training program for an athlete preparing for a ${raceDistance} race on ${raceDate} (approximately ${weeksDiff} weeks from now).
The athlete is at a "${currentLevel}" fitness level and has a target goal time of "${targetTime}".

Here is the athlete's historical training context from Strava (last 3 months):
${stravaContextStr}

Here are the athlete's onboarding responses:
${answersStr}

The training program must be divided strictly into 4 phases:
1. 'initial' (Base building, low intensity, initial conditioning)
2. 'progression' (Increasing mileage, speed intervals, training volume peak)
3. 'taper' (Reducing mileage, maintaining intensity to peak for the race)
4. 'recovery' (The race week itself, which includes the race on the final weekend, and post-race active recovery/rest)

You must schedule:
- Running sessions ('easy_run', 'long_run', 'interval' as needed for the target distance)
- 2 to 4 strength sessions per week ('strength' workout type)
- 2 to 6 mobility sessions per week ('mobility' workout type)
- Rest days ('rest' workout type)

Note: Multiple sessions can be scheduled on the same day (e.g., a run and a mobility session on the same day). Ensure each workout has a unique 'id' (e.g. 'w1d1_1', 'w1d1_2').

Provide the output strictly as a JSON array of objects with the following format. Do not include markdown headers or surrounding text. Only return the valid JSON array:
[
  {
    "id": "w1d1_1",
    "week_number": 1,
    "day_number": 1,
    "workout_type": "easy_run",
    "phase": "initial",
    "title": "Easy Run",
    "description": "Run 30 mins at conversational pace. Focus on high cadence.",
    "distance_target": 4000,
    "duration_target": 1800
  },
  {
    "id": "w1d1_2",
    "week_number": 1,
    "day_number": 1,
    "workout_type": "mobility",
    "phase": "initial",
    "title": "Post-Run Mobility Flow",
    "description": "Hip flexor stretches, calf rolling, and hamstring dynamic stretching.",
    "distance_target": null,
    "duration_target": 600
  }
]
`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const jsonStr = text
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim()
    const plan = JSON.parse(jsonStr)
    return plan
  } catch (err) {
    console.error('Gemini training block generation failed, falling back:', err)
    return generateFallbackTrainingBlock(weeksDiff, raceDistance)
  }
}

export async function* generateTrainingBlockStream(
  stravaData: any,
  userAnswers: any,
): AsyncGenerator<{ type: 'chunk'; text: string } | { type: 'done'; plan: Workout[] } | { type: 'error'; message: string }> {
  const ai = getAI()
  const raceDistance = userAnswers.raceDistance || '10K'
  const raceDate = userAnswers.raceDate
  const currentLevel = userAnswers.currentLevel || 'beginner'
  const targetTime = userAnswers.targetTime || 'N/A'
  const personality = userAnswers.coachPersonality || 'encouraging'
  const answers = userAnswers.answers || {}

  const weeksDiff = calculateWeeksUntilDate(raceDate)

  if (!ai) {
    console.log('Streaming: Using rule-based fallback generator.')
    yield { type: 'chunk', text: 'Initializing fallback coaching engine...\n' }
    await new Promise((resolve) => setTimeout(resolve, 400))
    yield { type: 'chunk', text: `Analyzing goals: distance=${raceDistance}, date=${raceDate}, weeks=${weeksDiff}\n` }
    await new Promise((resolve) => setTimeout(resolve, 400))
    yield { type: 'chunk', text: 'Constructing 4-phase training program...\n' }
    await new Promise((resolve) => setTimeout(resolve, 400))
    yield { type: 'chunk', text: '- Weaving in 2 strength training sessions per week\n' }
    await new Promise((resolve) => setTimeout(resolve, 300))
    yield { type: 'chunk', text: '- Weaving in 4 mobility flows per week\n' }
    await new Promise((resolve) => setTimeout(resolve, 300))
    yield { type: 'chunk', text: 'Finalizing blocks (Initial -> Progression -> Taper -> Recovery)...\n' }
    await new Promise((resolve) => setTimeout(resolve, 400))
    
    const plan = generateFallbackTrainingBlock(weeksDiff, raceDistance)
    yield { type: 'done', plan }
    return
  }

  const stravaContextStr = stravaData
    ? `Average Weekly Mileage: ${stravaData.weeklyMileageKm} km, Average Pace: ${stravaData.averageSpeed} m/s, Average Weekly Training Load: ${stravaData.avgWeeklyLoad}, Total Runs: ${stravaData.totalRuns}`
    : 'No historical Strava data connected.'

  const answersStr = Object.entries(answers)
    .map(([q, a]) => `- Question: ${q}\n  Answer: ${a}`)
    .join('\n')

  const prompt = `
You are a professional running coach with a "${personality}" personality.
Generate a structured, day-by-day training program for an athlete preparing for a ${raceDistance} race on ${raceDate} (approximately ${weeksDiff} weeks from now).
The athlete is at a "${currentLevel}" fitness level and has a target goal time of "${targetTime}".

Here is the athlete's historical training context from Strava (last 3 months):
${stravaContextStr}

Here are the athlete's onboarding responses:
${answersStr}

The training program must be divided strictly into 4 phases:
1. 'initial' (Base building, low intensity, initial conditioning)
2. 'progression' (Increasing mileage, speed intervals, training volume peak)
3. 'taper' (Reducing mileage, maintaining intensity to peak for the race)
4. 'recovery' (The race week itself, which includes the race on the final weekend, and post-race active recovery/rest)

You must schedule:
- Running sessions ('easy_run', 'long_run', 'interval' as needed for the target distance)
- 2 to 4 strength sessions per week ('strength' workout type)
- 2 to 6 mobility sessions per week ('mobility' workout type)
- Rest days ('rest' workout type)

Note: Multiple sessions can be scheduled on the same day (e.g., a run and a mobility session on the same day). Ensure each workout has a unique 'id' (e.g. 'w1d1_1', 'w1d1_2').

Provide the output strictly as a JSON array of objects with the following format. Do not include markdown headers or surrounding text. Only return the valid JSON array:
[
  {
    "id": "w1d1_1",
    "week_number": 1,
    "day_number": 1,
    "workout_type": "easy_run",
    "phase": "initial",
    "title": "Easy Run",
    "description": "Run 30 mins at conversational pace. Focus on high cadence.",
    "distance_target": 4000,
    "duration_target": 1800
  },
  {
    "id": "w1d1_2",
    "week_number": 1,
    "day_number": 1,
    "workout_type": "mobility",
    "phase": "initial",
    "title": "Post-Run Mobility Flow",
    "description": "Hip flexor stretches, calf rolling, and hamstring dynamic stretching.",
    "distance_target": null,
    "duration_target": 600
  }
]
`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const resultStream = await model.generateContentStream(prompt)
    let fullText = ''

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text()
      fullText += chunkText
      yield { type: 'chunk', text: chunkText }
    }

    const jsonStr = fullText
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim()
    const plan = JSON.parse(jsonStr)
    yield { type: 'done', plan }
  } catch (err: any) {
    console.error('Gemini training block stream generation failed, falling back:', err)
    yield { type: 'chunk', text: `\nError encountered: ${err.message || err}. Falling back to rule-based training block...\n` }
    const plan = generateFallbackTrainingBlock(weeksDiff, raceDistance)
    yield { type: 'done', plan }
  }
}

function generateFallbackTrainingBlock(weeksDiff: number, raceDistance: string): Workout[] {
  const plan: Workout[] = []
  
  // Calculate distance in meters for the race
  let raceMeters = 10000
  if (raceDistance === '5K') raceMeters = 5000
  else if (raceDistance === '10K') raceMeters = 10000
  else if (raceDistance === 'Half Marathon') raceMeters = 21100
  else if (raceDistance === 'Marathon') raceMeters = 42200

  for (let w = 1; w <= weeksDiff; w++) {
    // Determine phase
    let phase: 'initial' | 'progression' | 'taper' | 'recovery' = 'initial'
    const initialEnd = Math.max(1, Math.floor(weeksDiff * 0.25))
    const progressionEnd = Math.max(initialEnd + 1, Math.floor(weeksDiff * 0.75))
    const taperEnd = weeksDiff - 1

    if (w <= initialEnd) {
      phase = 'initial'
    } else if (w <= progressionEnd) {
      phase = 'progression'
    } else if (w <= taperEnd) {
      phase = 'taper'
    } else {
      phase = 'recovery'
    }

    if (phase !== 'recovery') {
      // Day 1: Easy Run + Mobility
      plan.push({
        id: `w${w}d1_1`,
        week_number: w,
        day_number: 1,
        workout_type: 'easy_run',
        phase,
        title: 'Aerobic Base Run',
        description: 'Run at a comfortable, conversational pace to build base aerobic capacity.',
        distance_target: phase === 'initial' ? 4000 : phase === 'progression' ? 6000 : 3000,
        duration_target: null,
      })
      plan.push({
        id: `w${w}d1_2`,
        week_number: w,
        day_number: 1,
        workout_type: 'mobility',
        phase,
        title: 'Post-Run Mobility Flow',
        description: 'Dynamic hip flexor, hamstring, and calf stretching.',
        distance_target: null,
        duration_target: 600,
      })

      // Day 2: Strength Training + Mobility
      plan.push({
        id: `w${w}d2_1`,
        week_number: w,
        day_number: 2,
        workout_type: 'strength',
        phase,
        title: 'Lower Body & Core Strength',
        description: 'Squats, lunges, planks, and glute bridges to build running stability.',
        distance_target: null,
        duration_target: 1800,
      })
      plan.push({
        id: `w${w}d2_2`,
        week_number: w,
        day_number: 2,
        workout_type: 'mobility',
        phase,
        title: 'Ankle & Foot Mobility',
        description: 'Ankle circles, calf stretches, and single-leg balance work.',
        distance_target: null,
        duration_target: 600,
      })

      // Day 3: Interval Speedwork
      plan.push({
        id: `w${w}d3`,
        week_number: w,
        day_number: 3,
        workout_type: 'interval',
        phase,
        title: 'Interval Strides',
        description: phase === 'initial' 
          ? 'Warm up 10 mins. Run 4x 200m strides with 90s walk recovery. Cool down 5 mins.' 
          : 'Warm up 10 mins. Run 5x 400m fast with 90s jog recovery. Cool down 5 mins.',
        distance_target: null,
        duration_target: 1200,
      })

      // Day 4: Rest Day
      plan.push({
        id: `w${w}d4`,
        week_number: w,
        day_number: 4,
        workout_type: 'rest',
        phase,
        title: 'Rest Day',
        description: 'Complete rest. Let your body absorb the training load.',
        distance_target: null,
        duration_target: null,
      })

      // Day 5: Long Run + Mobility
      let longRunDist = 5000 + (w - 1) * 1000
      if (raceDistance === '5K' && longRunDist > 8000) longRunDist = 8000
      if (raceDistance === '10K' && longRunDist > 14000) longRunDist = 14000
      if (raceDistance === 'Half Marathon' && longRunDist > 18000) longRunDist = 18000
      if (raceDistance === 'Marathon' && longRunDist > 32000) longRunDist = 32000

      if (phase === 'taper') {
        longRunDist = Math.round(longRunDist * 0.6)
      }

      plan.push({
        id: `w${w}d5_1`,
        week_number: w,
        day_number: 5,
        workout_type: 'long_run',
        phase,
        title: 'Weekly Long Run',
        description: 'Steady, slow run focusing on time on feet and cardiovascular adaptation.',
        distance_target: longRunDist,
        duration_target: null,
      })
      plan.push({
        id: `w${w}d5_2`,
        week_number: w,
        day_number: 5,
        workout_type: 'mobility',
        phase,
        title: 'Hip & IT Band Release',
        description: 'Foam rolling and dynamic stretches targeting the hip abductors and glutes.',
        distance_target: null,
        duration_target: 600,
      })

      // Day 6: Strength Training
      plan.push({
        id: `w${w}d6`,
        week_number: w,
        day_number: 6,
        workout_type: 'strength',
        phase,
        title: 'Upper Body & Core Stability',
        description: 'Push-ups, rows, bird-dog, and side planks for postural control.',
        distance_target: null,
        duration_target: 1200,
      })

      // Day 7: Active Recovery (Mobility)
      plan.push({
        id: `w${w}d7`,
        week_number: w,
        day_number: 7,
        workout_type: 'mobility',
        phase,
        title: 'Full Body Reset Flow',
        description: 'Gentle dynamic stretching and yoga poses to restore flexibility.',
        distance_target: null,
        duration_target: 900,
      })
    } else {
      // Race Week (Recovery Phase)
      // Day 1: Easy Run + Mobility
      plan.push({
        id: `w${w}d1_1`,
        week_number: w,
        day_number: 1,
        workout_type: 'easy_run',
        phase,
        title: 'Shakeout Run',
        description: 'Very easy, short run to keep the legs moving.',
        distance_target: 3000,
        duration_target: null,
      })
      plan.push({
        id: `w${w}d1_2`,
        week_number: w,
        day_number: 1,
        workout_type: 'mobility',
        phase,
        title: 'Light Dynamic Stretch',
        description: 'Gentle stretching focusing on ankles and calves.',
        distance_target: null,
        duration_target: 600,
      })

      // Day 2: Light Strength (Core only)
      plan.push({
        id: `w${w}d2`,
        week_number: w,
        day_number: 2,
        workout_type: 'strength',
        phase,
        title: 'Light Core & Activation',
        description: 'Deadbugs, bird-dogs, and glute bridges. No heavy lifting.',
        distance_target: null,
        duration_target: 900,
      })

      // Day 3: Rest
      plan.push({
        id: `w${w}d3`,
        week_number: w,
        day_number: 3,
        workout_type: 'rest',
        phase,
        title: 'Rest Day',
        description: 'Rest and focus on hydration and nutrition.',
        distance_target: null,
        duration_target: null,
      })

      // Day 4: Shakeout Run + Mobility
      plan.push({
        id: `w${w}d4_1`,
        week_number: w,
        day_number: 4,
        workout_type: 'easy_run',
        phase,
        title: 'Pre-Race Shakeout',
        description: 'Short jog with 2x 100m strides to activate the central nervous system.',
        distance_target: 2000,
        duration_target: null,
      })
      plan.push({
        id: `w${w}d4_2`,
        week_number: w,
        day_number: 4,
        workout_type: 'mobility',
        phase,
        title: 'Taper Stretch',
        description: 'Full body restorative stretching.',
        distance_target: null,
        duration_target: 600,
      })

      // Day 5: Rest
      plan.push({
        id: `w${w}d5`,
        week_number: w,
        day_number: 5,
        workout_type: 'rest',
        phase,
        title: 'Rest Day',
        description: 'Rest before the big race tomorrow.',
        distance_target: null,
        duration_target: null,
      })

      // Day 6: Race Day!
      plan.push({
        id: `w${w}d6`,
        week_number: w,
        day_number: 6,
        workout_type: 'long_run',
        phase,
        title: `${raceDistance} Race Day! 🏆`,
        description: 'Today is the day. Trust your training, pace yourself, and enjoy the run!',
        distance_target: raceMeters,
        duration_target: null,
      })

      // Day 7: Active Recovery / Rest
      plan.push({
        id: `w${w}d7`,
        week_number: w,
        day_number: 7,
        workout_type: 'mobility',
        phase,
        title: 'Post-Race Restoration',
        description: 'Gentle walking and extremely light stretching to flush out lactic acid.',
        distance_target: null,
        duration_target: 900,
      })
    }
  }

  return plan
}

export async function generateCoachFeedback(
  workout: Workout,
  activity: Activity,
): Promise<string> {
  const ai = getAI()
  const athleteConfig = getAthleteConfig()
  const personality = athleteConfig?.coach_personality || 'encouraging'

  if (!ai) {
    return generateFallbackFeedback(workout, activity)
  }

  // Calculate metrics
  const targetDistanceKm = workout.distance_target
    ? (workout.distance_target / 1000).toFixed(2)
    : null
  const actualDistanceKm = (activity.distance / 1000).toFixed(2)
  const targetDurationMin = workout.duration_target
    ? Math.round(workout.duration_target / 60)
    : null
  const actualDurationMin = Math.round(activity.moving_time / 60)

  const prompt = `
You are a professional running coach with a "${personality}" personality.
Analyze the athlete's completion of a scheduled workout.
Workout planned:
- Title: ${workout.title}
- Description: ${workout.description}
- Target Distance: ${targetDistanceKm ? targetDistanceKm + ' km' : 'N/A'}
- Target Duration: ${targetDurationMin ? targetDurationMin + ' mins' : 'N/A'}

Activity completed:
- Name: ${activity.name}
- Sport: ${activity.sport_type}
- Distance completed: ${actualDistanceKm} km
- Time taken: ${actualDurationMin} mins
- Avg speed: ${(activity.average_speed * 3.6).toFixed(2)} km/h
- Avg Heartrate: ${activity.average_heartrate || 'N/A'} bpm

Write a short, engaging feedback message (max 3 sentences) in your coach personality ("${personality}").
If they did well, encourage them. If they ran too fast, missed distance, or didn't do it, provide constructive advice.
Return only the text feedback, no markdown, no quotes, no extra tags.
`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch (err) {
    console.error('Gemini feedback generation failed, falling back:', err)
    return generateFallbackFeedback(workout, activity)
  }
}

// Helpers
export function calculateWeeksUntilDate(dateStr: string) {
  const target = new Date(dateStr)
  const now = new Date()
  const diffTime = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.ceil(diffDays / 7))
}

function generateFallbackPlan(raceDistance: string, weeks: number): Workout[] {
  const plan: Workout[] = []
  for (let w = 1; w <= weeks; w++) {
    const isTaper = w === weeks

    // Day 1: Easy Run
    plan.push({
      id: `w${w}d1`,
      week_number: w,
      day_number: 1,
      workout_type: 'easy_run' as WorkoutType,
      title: `Easy Run`,
      description: `Run at an easy, conversational pace. Focus on relaxed breathing.`,
      distance_target: isTaper ? 3000 : 4000 + (w % 3) * 500,
      duration_target: null,
    })

    // Day 2: Rest
    plan.push({
      id: `w${w}d2`,
      week_number: w,
      day_number: 2,
      workout_type: 'rest' as WorkoutType,
      title: 'Rest Day',
      description: 'A complete day of rest to allow your muscles to recover.',
      distance_target: null,
      duration_target: null,
    })

    // Day 3: Strength or Intervals
    const isInterval = w % 2 === 0
    plan.push({
      id: `w${w}d3`,
      week_number: w,
      day_number: 3,
      workout_type: (isInterval ? 'interval' : 'strength') as WorkoutType,
      title: isInterval ? 'Interval Training' : 'Strength Training',
      description: isInterval
        ? 'Warm up 10 mins. Run 5x 400m fast with 90s recovery. Cool down 5 mins.'
        : 'Strength training focusing on legs and core (Squats, Lunges, Planks, Calf raises).',
      distance_target: null,
      duration_target: isInterval ? 1800 : 2700,
    })

    // Day 4: Rest
    plan.push({
      id: `w${w}d4`,
      week_number: w,
      day_number: 4,
      workout_type: 'rest' as WorkoutType,
      title: 'Rest Day',
      description: 'Relax. Do some light stretching if needed.',
      distance_target: null,
      duration_target: null,
    })

    // Day 5: Long Run
    let longRunDist = 5000 + (w - 1) * 500
    if (longRunDist > 9000) longRunDist = 9000
    if (isTaper) longRunDist = 4000 // taper run

    plan.push({
      id: `w${w}d5`,
      week_number: w,
      day_number: 5,
      workout_type: 'long_run' as WorkoutType,
      title: `Long Run`,
      description: `Run slow and steady. This builds your cardiovascular endurance.`,
      distance_target: longRunDist,
      duration_target: null,
    })

    // Day 6: Rest
    plan.push({
      id: `w${w}d6`,
      week_number: w,
      day_number: 6,
      workout_type: 'rest' as WorkoutType,
      title: 'Rest Day',
      description: 'Rest before starting next week.',
      distance_target: null,
      duration_target: null,
    })

    // Day 7: Active Recovery / Strength
    plan.push({
      id: `w${w}d7`,
      week_number: w,
      day_number: 7,
      workout_type: 'strength' as WorkoutType,
      title: 'Core & Mobility',
      description:
        'Planks, glute bridges, and full body stretching to stay injury-free.',
      distance_target: null,
      duration_target: null,
    })
  }
  return plan
}

function generateFallbackFeedback(
  workout: Workout,
  activity: Activity,
): string {
  const actualDistKm = (activity.distance / 1000).toFixed(2)
  if (workout.workout_type === 'rest') {
    return `You completed a ${actualDistKm} km run on a scheduled rest day. Recovery is key to avoiding injury, so make sure to get some rest!`
  }

  if (
    workout.distance_target &&
    activity.distance >= workout.distance_target * 0.9
  ) {
    return `Fantastic effort! You hit your target distance by running ${actualDistKm} km. Keep up this consistency, it pays off!`
  }

  if (
    workout.distance_target &&
    activity.distance < workout.distance_target * 0.9
  ) {
    return `Good job getting out there. You did ${actualDistKm} km, which was a bit shorter than your target of ${(workout.distance_target / 1000).toFixed(2)} km. Listen to your body and build up slowly.`
  }

  return `Great workout! You logged a ${activity.sport_type} of ${actualDistKm} km. Keep stacking these training days together!`
}
