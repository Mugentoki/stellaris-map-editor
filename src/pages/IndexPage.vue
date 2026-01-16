<template>
  <q-page class="galaxy-page">
    <GalaxyScene ref="galaxySceneRef" />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GalaxyScene from 'src/components/GalaxyScene.vue';

const galaxySceneRef = ref<InstanceType<typeof GalaxyScene> | null>(null);
</script>

<style scoped>
.galaxy-page {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: inherit;
  padding: 0 !important;
  margin: 0;
  overflow: hidden;
}
</style>
