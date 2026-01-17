import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';

export type ToolType = 'select' | 'addSystem' | 'addNebula' | 'addHyperlane' | 'preventHyperlane';

export const useToolsStore = defineStore('tools', () => {
  // Current active tool
  const currentTool = ref<ToolType>('select');
  
  // First system ID for hyperlane creation (null when not in hyperlane creation process)
  const hyperlaneFirstSystemId = ref<string | null>(null);
  
  // Computed helpers
  const isSelectMode = computed(() => currentTool.value === 'select');
  const isAddSystemMode = computed(() => currentTool.value === 'addSystem');
  const isAddNebulaMode = computed(() => currentTool.value === 'addNebula');
  const isAddHyperlaneMode = computed(() => currentTool.value === 'addHyperlane');
  const isPreventHyperlaneMode = computed(() => currentTool.value === 'preventHyperlane');
  const isHyperlaneMode = computed(() => currentTool.value === 'addHyperlane' || currentTool.value === 'preventHyperlane');
  const isAddMode = computed(() => currentTool.value !== 'select');
  
  // Actions
  function setTool(tool: ToolType): void {
    currentTool.value = tool;
    // Clear hyperlane selection when switching tools
    clearHyperlaneSelection();
  }
  
  function clearHyperlaneSelection(): void {
    hyperlaneFirstSystemId.value = null;
  }
  
  function setHyperlaneFirstSystem(systemId: string): void {
    hyperlaneFirstSystemId.value = systemId;
  }
  
  return {
    // State
    currentTool,
    hyperlaneFirstSystemId,
    // Computed
    isSelectMode,
    isAddSystemMode,
    isAddNebulaMode,
    isAddHyperlaneMode,
    isPreventHyperlaneMode,
    isHyperlaneMode,
    isAddMode,
    // Actions
    setTool,
    clearHyperlaneSelection,
    setHyperlaneFirstSystem
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useToolsStore, import.meta.hot));
}
