<template>
  <q-dialog v-model="dialogOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ t('saveDialog.title') }}</div>
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="filename"
          :label="t('saveDialog.filename')"
          outlined
          dense
          suffix=".txt"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('saveDialog.cancel')" v-close-popup />
        <q-btn
          color="primary"
          :label="t('saveDialog.save')"
          :disable="!filename.trim()"
          @click="saveFile"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapStore } from 'src/stores/map-store';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();
const mapStore = useMapStore();

const dialogOpen = ref(props.modelValue);
const filename = ref('');

// Compute default filename from map name
const defaultFilename = computed(() => {
  const name = mapStore.mapName;
  // Lowercase, replace spaces with underscores, remove special characters
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
});

watch(() => props.modelValue, (val) => {
  dialogOpen.value = val;
  if (val) {
    // Set default filename when dialog opens
    filename.value = defaultFilename.value || 'map';
  }
});

watch(dialogOpen, (val) => {
  emit('update:modelValue', val);
});

function saveFile() {
  const content = mapStore.stringifyDocument();
  if (!content) return;

  // Create blob and download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.value.trim()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  dialogOpen.value = false;
}
</script>
