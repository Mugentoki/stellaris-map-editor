<template>
  <q-dialog v-model="dialogOpen" persistent>
    <q-card style="min-width: 600px; max-width: 90vw;">
      <q-card-section>
        <div class="text-h6">{{ t('settingsDialog.title') }}</div>
      </q-card-section>

      <q-card-section v-if="settings" class="q-gutter-md" style="max-height: 60vh; overflow-y: auto;">
        <!-- Map Name -->
        <q-input
          v-model="settings.name"
          :label="t('settingsDialog.name')"
          outlined
          dense
          @update:model-value="updateSetting('name', settings.name)"
        />

        <!-- Priority -->
        <q-input
          v-model.number="settings.priority"
          :label="t('settingsDialog.priority')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('priority', settings.priority)"
        />

        <!-- Default -->
        <q-toggle
          v-model="settings.default"
          :label="t('settingsDialog.default')"
          @update:model-value="updateSetting('default', settings.default)"
        />

        <q-separator />

        <!-- Empire Settings -->
        <div class="text-subtitle2">{{ t('settingsDialog.numEmpires') }}</div>
        <div class="row q-gutter-sm">
          <q-input
            v-model.number="settings.numEmpiresMin"
            :label="t('settingsDialog.numEmpiresMin')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_empires', 'min', settings.numEmpiresMin)"
          />
          <q-input
            v-model.number="settings.numEmpiresMax"
            :label="t('settingsDialog.numEmpiresMax')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_empires', 'max', settings.numEmpiresMax)"
          />
        </div>

        <q-input
          v-model.number="settings.numEmpireDefault"
          :label="t('settingsDialog.numEmpireDefault')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('num_empire_default', settings.numEmpireDefault)"
        />

        <div class="row q-gutter-sm">
          <q-input
            v-model.number="settings.fallenEmpireDefault"
            :label="t('settingsDialog.fallenEmpireDefault')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateSetting('fallen_empire_default', settings.fallenEmpireDefault)"
          />
          <q-input
            v-model.number="settings.fallenEmpireMax"
            :label="t('settingsDialog.fallenEmpireMax')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateSetting('fallen_empire_max', settings.fallenEmpireMax)"
          />
        </div>

        <div class="row q-gutter-sm">
          <q-input
            v-model.number="settings.marauderEmpireDefault"
            :label="t('settingsDialog.marauderEmpireDefault')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateSetting('marauder_empire_default', settings.marauderEmpireDefault)"
          />
          <q-input
            v-model.number="settings.marauderEmpireMax"
            :label="t('settingsDialog.marauderEmpireMax')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateSetting('marauder_empire_max', settings.marauderEmpireMax)"
          />
        </div>

        <q-input
          v-model.number="settings.advancedEmpireDefault"
          :label="t('settingsDialog.advancedEmpireDefault')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('advanced_empire_default', settings.advancedEmpireDefault)"
        />

        <q-separator />

        <!-- Odds Settings -->
        <q-input
          v-model.number="settings.colonizablePlanetOdds"
          :label="t('settingsDialog.colonizablePlanetOdds')"
          type="number"
          step="0.1"
          outlined
          dense
          @update:model-value="updateSetting('colonizable_planet_odds', settings.colonizablePlanetOdds)"
        />

        <q-input
          v-model.number="settings.primitiveOdds"
          :label="t('settingsDialog.primitiveOdds')"
          type="number"
          step="0.1"
          outlined
          dense
          @update:model-value="updateSetting('primitive_odds', settings.primitiveOdds)"
        />

        <q-input
          v-model.number="settings.crisisStrength"
          :label="t('settingsDialog.crisisStrength')"
          type="number"
          step="0.05"
          outlined
          dense
          @update:model-value="updateSetting('crisis_strength', settings.crisisStrength)"
        />

        <q-separator />

        <!-- Wormhole Settings -->
        <div class="text-subtitle2">{{ t('settingsDialog.numWormholePairs') }}</div>
        <div class="row q-gutter-sm">
          <q-input
            v-model.number="settings.numWormholePairsMin"
            :label="t('settingsDialog.numWormholePairsMin')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_wormhole_pairs', 'min', settings.numWormholePairsMin)"
          />
          <q-input
            v-model.number="settings.numWormholePairsMax"
            :label="t('settingsDialog.numWormholePairsMax')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_wormhole_pairs', 'max', settings.numWormholePairsMax)"
          />
        </div>

        <q-input
          v-model.number="settings.numWormholePairsDefault"
          :label="t('settingsDialog.numWormholePairsDefault')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('num_wormhole_pairs_default', settings.numWormholePairsDefault)"
        />

        <q-separator />

        <!-- Gateway Settings -->
        <div class="text-subtitle2">{{ t('settingsDialog.numGateways') }}</div>
        <div class="row q-gutter-sm">
          <q-input
            v-model.number="settings.numGatewaysMin"
            :label="t('settingsDialog.numGatewaysMin')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_gateways', 'min', settings.numGatewaysMin)"
          />
          <q-input
            v-model.number="settings.numGatewaysMax"
            :label="t('settingsDialog.numGatewaysMax')"
            type="number"
            outlined
            dense
            class="col"
            @update:model-value="updateNestedSetting('num_gateways', 'max', settings.numGatewaysMax)"
          />
        </div>

        <q-input
          v-model.number="settings.numGatewaysDefault"
          :label="t('settingsDialog.numGatewaysDefault')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('num_gateways_default', settings.numGatewaysDefault)"
        />

        <q-separator />

        <!-- Other Settings -->
        <q-toggle
          v-model="settings.randomHyperlanes"
          :label="t('settingsDialog.randomHyperlanes')"
          @update:model-value="updateSetting('random_hyperlanes', settings.randomHyperlanes)"
        />

        <q-input
          v-model.number="settings.coreRadius"
          :label="t('settingsDialog.coreRadius')"
          type="number"
          outlined
          dense
          @update:model-value="updateSetting('core_radius', settings.coreRadius)"
        />
      </q-card-section>

      <q-card-section v-else class="text-center text-grey">
        {{ t('messages.noMapOpen') }}
      </q-card-section>

      <!-- Settings saved banner -->
      <q-slide-transition>
        <q-banner v-if="showSavedMessage" class="bg-positive text-white">
          <template v-slot:avatar>
            <q-icon name="check_circle" />
          </template>
          {{ t('settingsDialog.saved') }}
        </q-banner>
      </q-slide-transition>

      <q-card-actions align="right">
        <q-btn flat :label="t('settingsDialog.close')" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapStore, type MapSettings } from 'src/stores/map-store';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();
const mapStore = useMapStore();

const dialogOpen = ref(props.modelValue);
const showSavedMessage = ref(false);
let savedMessageTimeout: ReturnType<typeof setTimeout> | null = null;

// Create a reactive copy of settings
const settings = ref<MapSettings | null>(null);

const storeSettings = computed(() => mapStore.mapSettings);

watch(() => props.modelValue, (val) => {
  dialogOpen.value = val;
  if (val && storeSettings.value) {
    // Create a copy of settings when dialog opens
    settings.value = { ...storeSettings.value };
  }
});

watch(dialogOpen, (val) => {
  emit('update:modelValue', val);
});

function showSaved() {
  if (savedMessageTimeout) {
    clearTimeout(savedMessageTimeout);
  }
  showSavedMessage.value = true;
  savedMessageTimeout = setTimeout(() => {
    showSavedMessage.value = false;
  }, 2000);
}

function updateSetting(key: string, value: string | number | boolean) {
  mapStore.updateSetting(key, value);
  showSaved();
}

function updateNestedSetting(parentKey: string, nestedKey: string, value: number) {
  mapStore.updateNestedSetting(parentKey, nestedKey, value);
  showSaved();
}
</script>
