<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue'

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set(val: boolean) {
    colorMode.preference = val ? 'dark' : 'light'
  },
})
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60"
    >
      <div
        class="max-w-6xl mx-auto flex h-14 items-center justify-between px-6"
      >
        <NuxtLink
          to="/"
          class="flex items-center gap-2 no-underline text-foreground"
        >
          <Logo class="size-6 text-[#ff5a1f]" />
          <span class="font-bold text-lg tracking-tight">
            Good<span class="text-primary">Coach</span>
          </span>
        </NuxtLink>
        <div class="flex items-center gap-4">
          <nav class="flex items-center gap-6">
            <NuxtLink
              to="/"
              class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              active-class="!text-foreground"
              >Dashboard</NuxtLink
            >
            <NuxtLink
              to="/plan"
              class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              active-class="!text-foreground"
              >Training Plan</NuxtLink
            >
            <NuxtLink
              to="/setup"
              class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              active-class="!text-foreground"
              >Settings</NuxtLink
            >
          </nav>

          <UiButton
            variant="ghost"
            size="icon"
            class="size-9 rounded-md transition-colors"
            @click="isDark = !isDark"
            aria-label="Toggle dark mode"
          >
            <component
              :is="isDark ? Sun : Moon"
              class="size-4 text-foreground"
            />
          </UiButton>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
      <NuxtRouteAnnouncer />
      <NuxtPage class="animate-fade-in" />
    </main>

    <!-- Footer -->
    <footer class="border-t border-border">
      <div
        class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-4 text-sm text-muted-foreground"
      >
        <p>© 2026 GoodCoach. Your running progress, automated.</p>
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-success"></span>
          <span>SQLite & Gemini Live</span>
        </div>
      </div>
    </footer>
  </div>
</template>
