<template>
  <component :is="as" :class="cn('font-semibold leading-none tracking-tight', props.class)">
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: string
  class?: string
}>(), {
  as: 'h3'
})

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
</script>
