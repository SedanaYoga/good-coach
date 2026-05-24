export interface AthleteConfig {
  id: number;
  strava_athlete_id: number | null;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_expires_at: number | null;
  race_distance: string;
  race_date: string;
  target_pace: string | null;
  target_time: string | null;
  onboarding_answers: string | null;
  coach_personality: 'encouraging' | 'strict' | 'data-driven';
  current_level: 'beginner' | 'intermediate' | 'advanced';
  weekly_runs_target: number;
}

export interface SetupRequest {
  raceDistance: string;
  raceDate: string;
  targetTime?: string;
  coachPersonality?: 'encouraging' | 'strict' | 'data-driven';
  currentLevel?: 'beginner' | 'intermediate' | 'advanced';
  answers?: Record<string, string>;
}

export interface SetupConfigResponse {
  connected: boolean;
  athleteId: number | null;
  raceDistance: string;
  raceDate: string;
  targetTime: string | null;
  onboardingAnswers: Record<string, string> | null;
  coachPersonality: 'encouraging' | 'strict' | 'data-driven';
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  hasGeminiKey: boolean;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: {
    id: number;
  };
}


