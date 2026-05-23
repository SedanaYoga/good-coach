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
          <span class="text-xl">⚡</span>
          <span class="font-bold text-lg tracking-tight">
            PacePilot
            <span class="text-primary">AI</span>
          </span>
        </NuxtLink>
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
        <p>© 2026 PacePilot AI. Your running progress, automated.</p>
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-success"></span>
          <span>SQLite & Gemini Live</span>
        </div>
      </div>
    </footer>
  </div>
</template>
