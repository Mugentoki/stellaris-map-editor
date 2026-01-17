<template>
  <q-dialog v-model="visible" persistent>
    <q-card class="duplicate-warning-card">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="warning" color="warning" size="md" class="q-mr-sm" />
        <div class="text-h6">Cannot Add Element</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <p class="q-mb-none">{{ message }}</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn 
          label="OK" 
          color="primary" 
          flat 
          v-close-popup 
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  message: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
</script>

<style scoped>
.duplicate-warning-card {
  min-width: 350px;
  max-width: 450px;
  background: rgba(40, 40, 50, 0.98);
  border: 1px solid rgba(100, 100, 120, 0.3);
}
</style>
