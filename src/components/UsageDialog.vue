<template>
  <q-dialog v-model="dialogOpen" persistent>
    <q-card style="min-width: 600px; max-width: 900px; max-height: 85vh;" class="column">
      <q-card-section>
        <div class="text-h6">{{ t('usageDialog.title') }}</div>
      </q-card-section>

      <q-card-section class="col scroll q-pa-md">
        <div class="column q-gutter-md">
          <!-- Navigation Section -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.navigationTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div><strong>{{ t('usageDialog.panKeys') }}</strong> {{ t('usageDialog.panKeysDesc') }}</div>
              <div><strong>{{ t('usageDialog.panMouse') }}</strong> {{ t('usageDialog.panMouseDesc') }}</div>
              <div><strong>{{ t('usageDialog.rotate') }}</strong> {{ t('usageDialog.rotateDesc') }}</div>
              <div><strong>{{ t('usageDialog.zoom') }}</strong> {{ t('usageDialog.zoomDesc') }}</div>
            </div>
          </div>

          <q-separator />

          <!-- Tools Section -->
          <div>
            <div class="text-h6 text-primary q-mb-sm">{{ t('usageDialog.toolsTitle') }}</div>
            <div class="q-ml-md column q-gutter-sm">
              <div>
                <strong>{{ t('usageDialog.selectTool') }}</strong>
                <div class="q-ml-sm text-body2">{{ t('usageDialog.selectToolDesc') }}</div>
              </div>
              <div>
                <strong>{{ t('usageDialog.addSystemTool') }}</strong>
                <div class="q-ml-sm text-body2">{{ t('usageDialog.addSystemToolDesc') }}</div>
              </div>
              <div>
                <strong>{{ t('usageDialog.addHyperlaneTool') }}</strong>
                <div class="q-ml-sm text-body2">{{ t('usageDialog.addHyperlaneToolDesc') }}</div>
              </div>
              <div>
                <strong>{{ t('usageDialog.preventHyperlaneTool') }}</strong>
                <div class="q-ml-sm text-body2">{{ t('usageDialog.preventHyperlaneToolDesc') }}</div>
              </div>
              <div>
                <strong>{{ t('usageDialog.addNebulaTool') }}</strong>
                <div class="q-ml-sm text-body2">{{ t('usageDialog.addNebulaToolDesc') }}</div>
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
              <div><strong>{{ t('usageDialog.deleteKey') }}</strong> {{ t('usageDialog.deleteKeyDesc') }}</div>
              <div><strong>{{ t('usageDialog.escapeKey') }}</strong> {{ t('usageDialog.escapeKeyDesc') }}</div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="t('usageDialog.close')" color="primary" v-close-popup />
      </q-card-actions>
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
