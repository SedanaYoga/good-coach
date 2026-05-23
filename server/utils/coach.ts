import {
  getAthleteConfig,
  getActivities,
  getWorkoutsPlan,
  updateWorkout,
  getDb,
} from './db'
import { generateCoachFeedback } from './ai'
import type { Workout } from 'types/domain/workout'

export async function matchAndAnalyzeActivities(): Promise<void> {
  const athlete = getAthleteConfig()
  if (!athlete || !athlete.race_date) return

  const workouts = getWorkoutsPlan()
  if (workouts.length === 0) return

  // Determine total weeks
  const totalWeeks = Math.max(...workouts.map((w) => w.week_number))

  // Calculate and assign dates to each workout
  for (const w of workouts) {
    w.calculated_date = getWorkoutDate(
      athlete.race_date,
      totalWeeks,
      w.week_number,
      w.day_number,
    )
  }

  const activities = getActivities()
  const unmatchedActivities = activities.filter((a) => !a.matched_workout_id)

  const db = getDb()

  for (const act of unmatchedActivities) {
    const actDate = act.start_date // YYYY-MM-DD
    const candidateWorkouts = getCandidateWorkoutsForDate(workouts, actDate)

    let matchedWorkout: Workout | null = null
    for (const w of candidateWorkouts) {
      if (w.status === 'completed') continue

      const isRunActivity = [
        'Run',
        'TrailRun',
        'VirtualRun',
        'RoadRun',
      ].includes(act.sport_type)
      const isRunWorkout = ['easy_run', 'long_run', 'interval'].includes(
        w.workout_type,
      )
      const isStrengthActivity = [
        'WeightTraining',
        'Workout',
        'Strength',
        'Gym',
        'Crossfit',
      ].includes(act.sport_type)
      const isStrengthWorkout = w.workout_type === 'strength'

      if (
        (isRunActivity && isRunWorkout) ||
        (isStrengthActivity && isStrengthWorkout)
      ) {
        matchedWorkout = w
        break
      }
    }

    if (matchedWorkout) {
      console.log(
        `Coach: Matching activity ${act.id} ("${act.name}") with workout ${matchedWorkout.id} ("${matchedWorkout.title}")`,
      )

      // Generate coach feedback (AI or fallback)
      const feedback = await generateCoachFeedback(matchedWorkout, act)

      // Update workout details
      updateWorkout(matchedWorkout.id, {
        status: 'completed',
        activity_id: act.id,
        coach_feedback: feedback,
      })

      // Update activity record
      db.prepare(
        'UPDATE activities SET matched_workout_id = ?, coach_feedback = ? WHERE id = ?',
      ).run(matchedWorkout.id, feedback, act.id)

      // Mark as completed locally so we don't double-match
      matchedWorkout.status = 'completed'
    }
  }
}

// Calculate the absolute date of a workout week/day based on target race date
export function getWorkoutDate(
  raceDateStr: string,
  totalWeeks: number,
  weekNumber: number,
  dayNumber: number,
): string {
  const raceDate = new Date(raceDateStr + 'T12:00:00') // Use mid-day to avoid timezone offset issues

  // Total days in training program
  const totalDays = totalWeeks * 7
  // Day offset of this workout (0-indexed)
  const workoutOffset = (weekNumber - 1) * 7 + (dayNumber - 1)
  // Race day is on the last day of the last week (totalDays - 1)
  const daysDiff = totalDays - 1 - workoutOffset

  const wDate = new Date(raceDate)
  wDate.setDate(raceDate.getDate() - daysDiff)

  return wDate.toISOString().split('T')[0] || ''
}

function getCandidateWorkoutsForDate(
  workouts: Workout[],
  dateStr: string,
): Workout[] {
  const targetTime = new Date(dateStr + 'T12:00:00').getTime()
  const oneDayMs = 24 * 60 * 60 * 1000

  return workouts.filter((w) => {
    if (!w.calculated_date) return false
    const wTime = new Date(w.calculated_date + 'T12:00:00').getTime()
    return Math.abs(wTime - targetTime) <= oneDayMs // Match +/- 1 day window
  })
}
