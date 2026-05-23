<template>
  <div class="flex flex-col min-h-screen">
    <!-- Sticky Nav -->
    <header
      class="sticky top-0 z-50 bg-dark/75 backdrop-blur-md border-b border-white/5"
    >
      <div
        class="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5 no-underline text-text-main"
        >
          <div class="text-2xl [text-shadow:0_0_10px_rgba(181,255,43,0.5)]">
            ⚡
          </div>
          <span class="font-display font-extrabold text-xl tracking-tight"
            >PacePilot
            <span
              class="text-primary [text-shadow:0_0_20px_rgba(181,255,43,0.15)]"
              >AI</span
            ></span
          >
        </NuxtLink>
        <nav class="flex gap-6">
          <NuxtLink
            to="/"
            class="text-sm font-medium text-text-muted hover:text-text-main transition-colors"
            active-class="!text-text-main !font-semibold"
            >Dashboard</NuxtLink
          >
          <NuxtLink
            to="/plan"
            class="text-sm font-medium text-text-muted hover:text-text-main transition-colors"
            active-class="!text-text-main !font-semibold"
            >Training Plan</NuxtLink
          >
          <NuxtLink
            to="/setup"
            class="text-sm font-medium text-text-muted hover:text-text-main transition-colors"
            active-class="!text-text-main !font-semibold"
            >Settings</NuxtLink
          >
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="grow max-w-6xl w-full mx-auto px-6 py-10">
      <NuxtRouteAnnouncer />
      <NuxtPage class="page-view animate-fade-in" />
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-dark/85 mt-16">
      <div
        class="max-w-6xl mx-auto p-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-text-muted"
      >
        <p>© 2026 PacePilot AI. Your running progress, automated.</p>
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_var(--color-success)]"
          ></span>
          <span>SQLite & Gemini Live</span>
        </div>
      </div>
    </footer>
  </div>
</template>
