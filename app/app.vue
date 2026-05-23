<template>
  <div class="app-layout">
    <!-- Sticky Nav -->
    <header class="app-header">
      <div class="nav-container">
        <NuxtLink to="/" class="logo-link">
          <div class="logo-icon">⚡</div>
          <span class="logo-text">PacePilot <span class="accent-text">AI</span></span>
        </NuxtLink>
        <nav class="nav-menu">
          <NuxtLink to="/" class="nav-link" active-class="active-link">Dashboard</NuxtLink>
          <NuxtLink to="/plan" class="nav-link" active-class="active-link">Training Plan</NuxtLink>
          <NuxtLink to="/setup" class="nav-link" active-class="active-link">Settings</NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-content">
      <NuxtRouteAnnouncer />
      <NuxtPage class="page-view" />
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <div class="footer-container">
        <p>© 2026 PacePilot AI. Your running progress, automated.</p>
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span>SQLite & Gemini Live</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(9, 10, 15, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-glass);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--color-text-main);
}

.logo-icon {
  font-size: 1.5rem;
  text-shadow: 0 0 10px rgba(181, 255, 43, 0.5);
}

.logo-text {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: -0.03em;
}

.accent-text {
  color: var(--color-primary);
  text-shadow: var(--shadow-neon);
}

.nav-menu {
  display: flex;
  gap: 24px;
}

.nav-link {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 0.95rem;
  text-decoration: none;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
  padding: 6px 0;
  position: relative;
}

.nav-link:hover {
  color: var(--color-text-main);
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: var(--color-primary);
  transition: width 0.2s ease;
  box-shadow: var(--shadow-neon);
}

.nav-link:hover::after {
  width: 100%;
}

.active-link {
  color: var(--color-text-main) !important;
}

.active-link::after {
  width: 100% !important;
}

.app-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px;
}

.app-footer {
  border-top: 1px solid var(--border-glass);
  background: rgba(9, 10, 15, 0.85);
  margin-top: 60px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  
  .nav-menu {
    gap: 16px;
  }
  
  .footer-container {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
}
</style>
