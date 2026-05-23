import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  alias: {
    types: fileURLToPath(new URL('./types', import.meta.url)),
  },
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  vite: {
    plugins: [
      tailwindcss()
    ]
  },

  runtimeConfig: {
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET || '',
    stravaVerifyToken:
      process.env.STRAVA_VERIFY_TOKEN || 'coach_verify_token_123',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    dbPath: process.env.DATABASE_PATH || './running_coach.db',

    public: {
      stravaClientId: process.env.STRAVA_CLIENT_ID || '',
      stravaRedirectUri:
        process.env.STRAVA_REDIRECT_URI ||
        'http://localhost:3000/api/strava/auth',
    },
  },

  css: ['~/assets/css/global.css'],
})
