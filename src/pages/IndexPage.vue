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
  height: 100%;
  padding: 0;
}
</style>
