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

export async function generateTrainingPlan(
  raceDistance: string,
  raceDate: string,
  currentLevel: string,
): Promise<Workout[]> {
  const ai = getAI()
  const weeksDiff = calculateWeeksUntilDate(raceDate)

  if (!ai) {
    console.log('Using rule-based fallback plan generator.')
    return generateFallbackPlan(raceDistance, weeksDiff)
  }

  const athleteConfig = getAthleteConfig()
  const personality = athleteConfig?.coach_personality || 'encouraging'

  const prompt = `
You are a professional running coach with a "${personality}" personality.
Generate a structured, day-by-day training program for an athlete preparing for a ${raceDistance} race on ${raceDate} (approximately ${weeksDiff} weeks from now).
The athlete is at a "${currentLevel}" fitness level.

Please schedule exactly 3 running sessions, 1 strength training session, and 3 rest days per week.
Running types: 'easy_run', 'long_run', 'interval' (speedwork).
Strength type: 'strength'.
Rest type: 'rest'.

Provide the output strictly as a JSON array of objects with the following format. Do not include markdown headers or surrounding text. Only return the valid JSON array:
[
  {
    "id": "w1d1",
    "week_number": 1,
    "day_number": 1,
    "workout_type": "easy_run",
    "title": "Short title",
    "description": "Detailed description of the session. E.g. Run 30 mins at conversational pace. Focus on high cadence.",
    "distance_target": 4000,
    "duration_target": 1800
  }
]
`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Clean up markdown block tags if the AI includes them
    const jsonStr = text
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim()
    const plan = JSON.parse(jsonStr)
    return plan
  } catch (err) {
    console.error('Gemini plan generation failed, falling back:', err)
    return generateFallbackPlan(raceDistance, weeksDiff)
  }
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
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
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
