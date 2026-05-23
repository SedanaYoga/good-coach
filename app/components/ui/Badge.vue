<template>
  <span :class="cn(base, variants[variant], props.class)">
    <slot />
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'destructive' | 'warning'
  class?: string
}>(), {
  variant: 'default',
})

const base = 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none'

const variants: Record<string, string> = {
  default: 'border-transparent bg-primary text-primary-foreground shadow-sm',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'border-border text-foreground',
  success: 'border-transparent bg-success/15 text-success',
  destructive: 'border-transparent bg-destructive/15 text-destructive',
  warning: 'border-transparent bg-warning/15 text-warning',
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
</script>
