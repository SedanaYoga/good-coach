<template>
  <div :class="cn(base, variants[variant], props.class)" role="alert">
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'default' | 'destructive' | 'warning' | 'success'
  class?: string
}>(), {
  variant: 'default',
})

const base = 'relative w-full rounded-lg border p-4 text-sm'

const variants: Record<string, string> = {
  default: 'bg-background text-foreground border-border',
  destructive: 'bg-destructive/5 border-destructive/20 text-destructive',
  warning: 'bg-warning/5 border-warning/20 text-warning',
  success: 'bg-success/5 border-success/20 text-success',
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
</script>
