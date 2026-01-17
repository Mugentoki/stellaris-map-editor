<template>
  <q-dialog v-model="dialogOpen" persistent>
    <q-card style="min-width: 600px; max-width: 900px; max-height: 85vh;" >
      <q-card-section>
        <div class="text-h6">{{ t('usageDialog.title') }}</div>
        <q-btn
          flat
          round
          dense
          icon="close"
          v-close-popup
          style="position: absolute; top: 8px; right: 8px;"
        />
      </q-card-section>

      <q-card-section class="col scroll q-pa-md">
        <div class="column q-gutter-md" style="max-width: 100%; overflow-wrap: break-word;">
          <!-- Navigation Section -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.navigationTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.panKeys') }}</div>
                <div class="text-body2">{{ t('usageDialog.panKeysDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.panMouse') }}</div>
                <div class="text-body2">{{ t('usageDialog.panMouseDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.rotate') }}</div>
                <div class="text-body2">{{ t('usageDialog.rotateDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.zoom') }}</div>
                <div class="text-body2">{{ t('usageDialog.zoomDesc') }}</div>
              </div>
            </div>
          </div>

          <q-separator />

          <!-- Tools Section -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.toolsTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.selectTool') }}</div>
                <div class="text-body2">{{ t('usageDialog.selectToolDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.addSystemTool') }}</div>
                <div class="text-body2">{{ t('usageDialog.addSystemToolDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.addHyperlaneTool') }}</div>
                <div class="text-body2">{{ t('usageDialog.addHyperlaneToolDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.preventHyperlaneTool') }}</div>
                <div class="text-body2">{{ t('usageDialog.preventHyperlaneToolDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.addNebulaTool') }}</div>
                <div class="text-body2">{{ t('usageDialog.addNebulaToolDesc') }}</div>
              </div>
            </div>
          </div>

          <q-separator />

          <!-- Selection and Editing -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.editingTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div class="text-body2">{{ t('usageDialog.editingDesc1') }}</div>
              <div class="text-body2">{{ t('usageDialog.editingDesc2') }}</div>
              <div class="text-body2">{{ t('usageDialog.editingDesc3') }}</div>
            </div>
          </div>

          <q-separator />

          <!-- Keyboard Shortcuts -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.shortcutsTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.deleteKey') }}</div>
                <div class="text-body2">{{ t('usageDialog.deleteKeyDesc') }}</div>
              </div>
              <div>
                <div class="text-weight-bold">{{ t('usageDialog.escapeKey') }}</div>
                <div class="text-body2">{{ t('usageDialog.escapeKeyDesc') }}</div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();

const dialogOpen = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  dialogOpen.value = val;
});

watch(dialogOpen, (val) => {
  emit('update:modelValue', val);
});
</script>
