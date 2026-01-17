<template>
  <q-page class="galaxy-page">
    <GalaxyScene 
      ref="galaxySceneRef" 
      @duplicate-warning="showDuplicateWarning"
    />
    <ToolsToolbar />
    <DuplicateWarningDialog 
      v-model="duplicateDialogVisible" 
      :message="duplicateDialogMessage"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GalaxyScene from 'src/components/GalaxyScene.vue';
import ToolsToolbar from 'src/components/ToolsToolbar.vue';
import DuplicateWarningDialog from 'src/components/DuplicateWarningDialog.vue';

const galaxySceneRef = ref<InstanceType<typeof GalaxyScene> | null>(null);

// Duplicate warning dialog state
const duplicateDialogVisible = ref(false);
const duplicateDialogMessage = ref('');

function showDuplicateWarning(message: string) {
  duplicateDialogMessage.value = message;
  duplicateDialogVisible.value = true;
}
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
