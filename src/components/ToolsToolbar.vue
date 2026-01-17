<template>
  <div class="tools-toolbar">
    <q-btn-toggle
      v-model="toolsStore.currentTool"
      toggle-color="primary"
      spread
      no-caps
      unelevated
      :options="toolOptions"
      class="tools-toggle"
      @update:model-value="onToolChange"
    />
  </div>
</template>

<script setup lang="ts">
import { useToolsStore, type ToolType } from 'src/stores/tools-store';

const toolsStore = useToolsStore();

const toolOptions = [
  { 
    value: 'select' as ToolType, 
    icon: 'mouse',
    label: '',
    attrs: { title: 'Select (click to select elements)' }
  },
  { 
    value: 'addSystem' as ToolType, 
    icon: 'star',
    label: '',
    attrs: { title: 'Add System (click to place a new star)' }
  },
  { 
    value: 'addNebula' as ToolType, 
    icon: 'blur_on',
    label: '',
    attrs: { title: 'Add Nebula (click to place a new nebula)' }
  },
  { 
    value: 'addHyperlane' as ToolType, 
    icon: 'timeline',
    label: '',
    attrs: { title: 'Add Hyperlane (click two systems to connect them)' }
  },
  { 
    value: 'preventHyperlane' as ToolType, 
    icon: 'block',
    label: '',
    attrs: { title: 'Prevent Hyperlane (click two systems to prevent connection)' }
  }
];

function onToolChange(tool: ToolType) {
  toolsStore.setTool(tool);
}
</script>

<style scoped>
.tools-toolbar {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  background: rgba(30, 30, 40, 0.9);
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(100, 100, 120, 0.3);
}

.tools-toggle {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tools-toggle :deep(.q-btn) {
  min-width: 42px;
  min-height: 42px;
  padding: 8px;
  border-radius: 6px !important;
  background: rgba(50, 50, 60, 0.8);
  color: rgba(200, 200, 220, 0.9);
  transition: all 0.2s ease;
}

.tools-toggle :deep(.q-btn:hover) {
  background: rgba(70, 70, 85, 0.9);
  color: rgba(230, 230, 250, 1);
}

.tools-toggle :deep(.q-btn.bg-primary) {
  background: var(--q-primary) !important;
  color: white;
  box-shadow: 0 2px 8px rgba(var(--q-primary-rgb, 25, 118, 210), 0.4);
}

.tools-toggle :deep(.q-btn .q-icon) {
  font-size: 20px;
}
</style>
