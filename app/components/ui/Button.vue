<template>
  <component
    :is="as"
    :class="cn(base, variants[variant], sizes[size], props.class)"
    :disabled="disabled"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  as?: string
  disabled?: boolean
  class?: string
}>(), {
  variant: 'primary',
  size: 'default',
  as: 'button',
  disabled: false,
})

const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer'

const variants: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-zinc-700/50 shadow-sm',
  outline: 'border border-border bg-transparent hover:bg-secondary hover:text-secondary-foreground shadow-sm',
  ghost: 'hover:bg-secondary hover:text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
}

const sizes: Record<string, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-8',
  icon: 'h-9 w-9',
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
</script>
