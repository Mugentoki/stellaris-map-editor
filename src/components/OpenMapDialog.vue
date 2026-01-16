<template>
  <q-dialog v-model="dialogOpen" persistent>
    <q-card style="min-width: 500px; max-width: 80vw; max-height: 80vh;" class="column">
      <q-card-section>
        <div class="text-h6">{{ t('openDialog.title') }}</div>
      </q-card-section>

      <q-card-section v-if="!showTextInput">
        <div class="column q-gutter-md">
          <q-btn
            color="primary"
            :label="t('openDialog.fromFile')"
            icon="folder_open"
            @click="triggerFileInput"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt"
            style="display: none"
            @change="handleFileSelect"
          />
          <div v-if="selectedFileName" class="text-caption">
            {{ selectedFileName }}
          </div>

          <q-separator />

          <q-btn
            color="secondary"
            :label="t('openDialog.fromText')"
            icon="text_fields"
            @click="showTextInput = true"
          />
        </div>
      </q-card-section>

      <q-card-section v-else>
        <q-btn
          flat
          icon="arrow_back"
          :label="t('openDialog.fromFile')"
          @click="showTextInput = false"
          class="q-mb-md"
        />
        <q-input
          v-model="textContent"
          type="textarea"
          :placeholder="t('openDialog.placeholder')"
          outlined
          :input-style="{ height: '300px', resize: 'none' }"
        />
      </q-card-section>

      <q-card-section v-if="errorMessage" class="text-negative">
        {{ errorMessage }}
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('openDialog.cancel')" v-close-popup @click="resetDialog" />
        <q-btn
          v-if="showTextInput"
          color="primary"
          :label="t('openDialog.open')"
          :disable="!textContent.trim()"
          @click="openFromText"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useMapStore } from 'src/stores/map-store';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();
const $q = useQuasar();
const mapStore = useMapStore();

const dialogOpen = ref(props.modelValue);
const showTextInput = ref(false);
const textContent = ref('');
const selectedFileName = ref('');
const errorMessage = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

watch(() => props.modelValue, (val) => {
  dialogOpen.value = val;
});

watch(dialogOpen, (val) => {
  emit('update:modelValue', val);
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFileName.value = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      loadMap(content);
    };
    reader.onerror = () => {
      errorMessage.value = t('messages.parseError', { error: 'Failed to read file' });
    };
    reader.readAsText(file);
  }
}

function openFromText() {
  loadMap(textContent.value);
}

function loadMap(content: string) {
  errorMessage.value = '';
  const result = mapStore.loadFromText(content);
  if (result.success) {
    $q.notify({
      type: 'positive',
      message: t('messages.mapLoaded')
    });
    dialogOpen.value = false;
    resetDialog();
  } else {
    errorMessage.value = t('messages.parseError', { error: result.error });
  }
}

function resetDialog() {
  showTextInput.value = false;
  textContent.value = '';
  selectedFileName.value = '';
  errorMessage.value = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}
</script>
