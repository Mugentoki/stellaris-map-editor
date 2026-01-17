<template>
  <q-layout view="hHh lpR fFf">

    <q-header bordered class="bg-primary text-white" height-hint="98">
      <q-toolbar class="sme-menubar">
        <q-avatar size="xs">
          <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
        </q-avatar>

        <q-bar class="bg-transparent text-white col-grow">
          <div class="cursor-pointer non-selectable">
            {{ t('menu.file') }}
            <q-menu>
              <q-list dense style="min-width: 100px">
                <q-item clickable v-close-popup @click="handleNew">
                  <q-item-section>{{ t('menu.new') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="openDialogOpen = true">
                  <q-item-section>{{ t('menu.open') }}</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="handleSave" :disable="!mapStore.hasDocument()">
                  <q-item-section>{{ t('menu.save') }}</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="settingsDialogOpen = true" :disable="!mapStore.hasDocument()">
                  <q-item-section>{{ t('menu.mapSettings') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </div>
          <div class="cursor-pointer non-selectable">
            {{ t('menu.help') }}
            <q-menu>
              <q-list dense style="min-width: 100px">
                <q-item clickable v-close-popup @click="usageDialogOpen = true">
                  <q-item-section>{{ t('menu.usage') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </div>
          <!--<div class="cursor-pointer non-selectable">
            Edit
            <q-menu>
              <q-list dense style="min-width: 100px">
                <q-item clickable v-close-popup>
                  <q-item-section>Cut</q-item-section>
                </q-item>
                <q-item clickable v-close-popup>
                  <q-item-section>Copy</q-item-section>
                </q-item>
                <q-item clickable v-close-popup>
                  <q-item-section>Paste</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup>
                  <q-item-section>Select All</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </div>-->
        </q-bar>

        <q-btn dense flat round icon="menu" @click="toggleRightDrawer" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered class="bg-dark">
      <div class="q-pa-md">
        <!-- No selection state -->
        <div v-if="!selectedElement" class="text-grey text-center q-pa-lg">
          {{ t('drawer.noSelection') }}
        </div>

        <!-- System details -->
        <div v-else-if="selectedElement.type === 'system'" class="column q-gutter-md">
          <div class="text-h6">{{ t('drawer.systemDetails') }}</div>
          
          <q-input
            :model-value="(selectedElement.data as SystemData).id"
            :label="t('drawer.id')"
            outlined
            dense
            readonly
          />
          
          <q-input
            :model-value="(selectedElement.data as SystemData).name"
            :label="t('drawer.name')"
            outlined
            dense
            @update:model-value="(val: string | number | null) => handleUpdateSystem('name', String(val ?? ''))"
          />
          
          <q-separator />
          
          <div class="text-subtitle2">{{ t('drawer.position') }}</div>
          
          <!-- Master toggle for all coordinates -->
          <q-toggle
            :model-value="!!(selectedElement.data as SystemData).isDynamicX && !!(selectedElement.data as SystemData).isDynamicY && !!(selectedElement.data as SystemData).isDynamicZ"
            :label="t('drawer.allDynamic')"
            @update:model-value="handleToggleAllDynamic"
          />
          
          <!-- X Coordinate -->
          <div class="column q-gutter-sm">
            <q-toggle
              :model-value="!!(selectedElement.data as SystemData).isDynamicX"
              :label="t('drawer.dynamicX')"
              @update:model-value="(val: boolean) => handleToggleDynamicCoord('x', val)"
            />
            <div v-if="!(selectedElement.data as SystemData).isDynamicX" class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).x"
                label="X"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('x', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'x', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
            </div>
            <div v-else class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).xMin"
                :label="t('drawer.min')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                :error="!!xMinMaxError"
                :error-message="xMinMaxError"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('xMin', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'xMin', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
              <q-input
                :model-value="(selectedElement.data as SystemData).xMax"
                :label="t('drawer.max')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('xMax', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'xMax', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
            </div>
          </div>
          
          <!-- Y Coordinate -->
          <div class="column q-gutter-sm">
            <q-toggle
              :model-value="!!(selectedElement.data as SystemData).isDynamicY"
              :label="t('drawer.dynamicY')"
              @update:model-value="(val: boolean) => handleToggleDynamicCoord('y', val)"
            />
            <div v-if="!(selectedElement.data as SystemData).isDynamicY" class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).y"
                label="Y"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('y', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'y', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
            </div>
            <div v-else class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).yMin"
                :label="t('drawer.min')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                :error="!!yMinMaxError"
                :error-message="yMinMaxError"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('yMin', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'yMin', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
              <q-input
                :model-value="(selectedElement.data as SystemData).yMax"
                :label="t('drawer.max')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.XY_MIN"
                :max="MAP_LIMITS.XY_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('yMax', clampValue(Number(val), MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'yMax', MAP_LIMITS.XY_MIN, MAP_LIMITS.XY_MAX)"
              />
            </div>
          </div>
          
          <!-- Z Coordinate -->
          <div class="column q-gutter-sm">
            <q-toggle
              :model-value="!!(selectedElement.data as SystemData).isDynamicZ"
              :label="t('drawer.dynamicZ')"
              @update:model-value="(val: boolean) => handleToggleDynamicCoord('z', val)"
            />
            <div v-if="!(selectedElement.data as SystemData).isDynamicZ" class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).z"
                label="Z"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.Z_MIN"
                :max="MAP_LIMITS.Z_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('z', clampValue(Number(val), MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'z', MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX)"
              />
            </div>
            <div v-else class="row q-gutter-sm">
              <q-input
                :model-value="(selectedElement.data as SystemData).zMin"
                :label="t('drawer.min')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.Z_MIN"
                :max="MAP_LIMITS.Z_MAX"
                class="col"
                :error="!!zMinMaxError"
                :error-message="zMinMaxError"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('zMin', clampValue(Number(val), MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'zMin', MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX)"
              />
              <q-input
                :model-value="(selectedElement.data as SystemData).zMax"
                :label="t('drawer.max')"
                outlined
                dense
                type="number"
                :min="MAP_LIMITS.Z_MIN"
                :max="MAP_LIMITS.Z_MAX"
                class="col"
                @update:model-value="(val: string | number | null) => handleUpdateSystem('zMax', clampValue(Number(val), MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX))"
                @blur="(evt: any) => handleClampInput(evt, 'zMax', MAP_LIMITS.Z_MIN, MAP_LIMITS.Z_MAX)"
              />
            </div>
          </div>

          <q-separator />

          <q-input
            :model-value="(selectedElement.data as SystemData).initializer || ''"
            :label="t('drawer.initializer')"
            outlined
            dense
            @update:model-value="(val: string | number | null) => handleUpdateSystem('initializer', String(val ?? ''))"
          />
          
          <q-separator />
          
          <!-- Spawn Weight Section -->
          <q-expansion-item
            :label="t('drawer.spawnWeight')"
            icon="bar_chart"
          >
            <div class="column q-gutter-md q-pa-md">
              <q-toggle
                :model-value="!!(selectedElement.data as SystemData).spawnWeight"
                :label="t('drawer.enableSpawnWeight')"
                @update:model-value="handleToggleSpawnWeight"
              />
              
              <div v-if="!!(selectedElement.data as SystemData).spawnWeight" class="column q-gutter-sm">
                <q-input
                  :model-value="(selectedElement.data as SystemData).spawnWeight?.base ?? 0"
                  :label="t('drawer.baseValue')"
                  outlined
                  dense
                  type="number"
                  @update:model-value="(val: string | number | null) => handleUpdateSpawnWeightBase(Number(val ?? 0))"
                />
                
                <q-input
                  :model-value="spawnWeightModifierText"
                  :label="t('drawer.modifier')"
                  outlined
                  type="textarea"
                  rows="4"
                  style="overflow-y: auto"
                  :error="!!modifierSyntaxError"
                  :error-message="modifierSyntaxError"
                  @update:model-value="handleUpdateSpawnWeightModifier"
                />
              </div>
            </div>
          </q-expansion-item>

          <q-btn
            color="negative"
            :label="t('drawer.delete')"
            icon="delete"
            @click="handleDeleteSelected"
          />
        </div>

        <!-- Hyperlane details -->
        <div v-else-if="selectedElement.type === 'hyperlane'" class="column q-gutter-md">
          <div class="text-h6">{{ t('drawer.hyperlaneDetails') }}</div>
          
          <q-input
            :model-value="(selectedElement.data as HyperlaneData).from"
            :label="t('drawer.from')"
            outlined
            dense
            readonly
          />
          
          <q-input
            :model-value="(selectedElement.data as HyperlaneData).to"
            :label="t('drawer.to')"
            outlined
            dense
            readonly
          />
          
          <q-toggle
            :model-value="(selectedElement.data as HyperlaneData).type === 'prevent'"
            :label="t('drawer.preventHyperlane')"
            color="negative"
            @update:model-value="handleToggleHyperlaneType"
          />

          <q-btn
            color="negative"
            :label="t('drawer.delete')"
            icon="delete"
            @click="handleDeleteSelected"
          />
        </div>

        <!-- Nebula details -->
        <div v-else-if="selectedElement.type === 'nebula'" class="column q-gutter-md">
          <div class="text-h6">{{ t('drawer.nebulaDetails') }}</div>
          
          <q-input
            :model-value="(selectedElement.data as NebulaData).name"
            :label="t('drawer.name')"
            outlined
            dense
            @update:model-value="(val: string | number | null) => handleUpdateNebula('name', String(val ?? ''))"
          />
          
          <div class="text-subtitle2">{{ t('drawer.position') }}</div>
          <div class="row q-gutter-sm">
            <q-input
              :model-value="(selectedElement.data as NebulaData).x"
              label="X"
              outlined
              dense
              type="number"
              :min="MAP_LIMITS.XY_MIN"
              :max="MAP_LIMITS.XY_MAX"
              class="col"
              @update:model-value="(val: string | number | null) => handleUpdateNebula('x', Number(val))"
            />
            <q-input
              :model-value="(selectedElement.data as NebulaData).y"
              label="Y"
              outlined
              dense
              type="number"
              :min="MAP_LIMITS.XY_MIN"
              :max="MAP_LIMITS.XY_MAX"
              class="col"
              @update:model-value="(val: string | number | null) => handleUpdateNebula('y', Number(val))"
            />
            <q-input
              :model-value="(selectedElement.data as NebulaData).z"
              label="Z"
              outlined
              dense
              type="number"
              :min="MAP_LIMITS.Z_MIN"
              :max="MAP_LIMITS.Z_MAX"
              class="col"
              @update:model-value="(val: string | number | null) => handleUpdateNebula('z', Number(val))"
            />
          </div>

          <q-input
            :model-value="(selectedElement.data as NebulaData).radius"
            :label="t('drawer.radius')"
            outlined
            dense
            type="number"
            :min="1"
            :max="500"
            @update:model-value="(val: string | number | null) => handleUpdateNebula('radius', Number(val))"
          />

          <q-btn
            color="negative"
            :label="t('drawer.delete')"
            icon="delete"
            @click="handleDeleteSelected"
          />
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view v-slot="{ Component }">
        <component :is="Component" ref="pageRef" />
      </router-view>
    </q-page-container>

    <q-footer bordered class="bg-dark text-white">
      <q-toolbar class="sme-footer">
        <span>{{ t('footer.version', { version }) }}</span>
        <a href="https://github.com/Mugentoki/stellaris-map-generator" class="text-white" style="text-decoration: none;">GitHub</a>
      </q-toolbar>
    </q-footer>

    <!-- Dialogs -->
    <OpenMapDialog v-model="openDialogOpen" />
    <MapSettingsDialog v-model="settingsDialogOpen" />
    <SaveMapDialog v-model="saveDialogOpen" />
    <UsageDialog v-model="usageDialogOpen" />

    <!-- Loading overlay -->
    <q-inner-loading :showing="mapStore.isLoading" style="z-index: 9999; background-color: rgba(0, 0, 0, 0.75);">
      <q-spinner-gears size="50px" color="white" />
      <div class="text-white q-mt-md">{{ t('messages.loadingMap') }}</div>
    </q-inner-loading>

  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useMapStore, type SystemData, type HyperlaneData, type NebulaData } from 'src/stores/map-store'
import { MAP_LIMITS } from 'src/constants/map-limits'
import OpenMapDialog from 'src/components/OpenMapDialog.vue'
import MapSettingsDialog from 'src/components/MapSettingsDialog.vue'
import SaveMapDialog from 'src/components/SaveMapDialog.vue'
import UsageDialog from 'src/components/UsageDialog.vue'

const { t } = useI18n()
const $q = useQuasar()
const mapStore = useMapStore()

const rightDrawerOpen = ref(false)
const version = __APP_VERSION__

// Dialog states
const openDialogOpen = ref(false)
const settingsDialogOpen = ref(false)
const saveDialogOpen = ref(false)
const usageDialogOpen = ref(false)

// Selection state - now uses Pinia store directly
const selectedElement = computed(() => mapStore.selectedElement)

// Validation errors for dynamic coordinates
const xMinMaxError = computed(() => {
  if (selectedElement.value?.type === 'system') {
    const system = selectedElement.value.data as SystemData
    if (system.isDynamicX && system.xMin !== undefined && system.xMax !== undefined) {
      return system.xMin > system.xMax ? t('drawer.minMaxError') : ''
    }
  }
  return ''
})

const yMinMaxError = computed(() => {
  if (selectedElement.value?.type === 'system') {
    const system = selectedElement.value.data as SystemData
    if (system.isDynamicY && system.yMin !== undefined && system.yMax !== undefined) {
      return system.yMin > system.yMax ? t('drawer.minMaxError') : ''
    }
  }
  return ''
})

const zMinMaxError = computed(() => {
  if (selectedElement.value?.type === 'system') {
    const system = selectedElement.value.data as SystemData
    if (system.isDynamicZ && system.zMin !== undefined && system.zMax !== undefined) {
      return system.zMin > system.zMax ? t('drawer.minMaxError') : ''
    }
  }
  return ''
})

// Spawn weight modifier text
const spawnWeightModifierText = computed(() => {
  if (selectedElement.value?.type === 'system') {
    const system = selectedElement.value.data as SystemData
    if (system.spawnWeight?.modifier) {
      // Convert modifier object to Clausewitz syntax
      const entries = Object.entries(system.spawnWeight.modifier)
      return entries.map(([key, value]) => `${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n')
    }
  }
  return ''
})

const modifierSyntaxError = ref('')

function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

function handleNew() {
  mapStore.createNewMap()
  $q.notify({
    type: 'positive',
    message: t('messages.mapCreated')
  })
}

function handleSave() {
  if (mapStore.hasDocument()) {
    saveDialogOpen.value = true
  }
}

function handleDeleteSelected() {
  if (selectedElement.value) {
    if (selectedElement.value.type === 'system') {
      const system = selectedElement.value.data as SystemData
      mapStore.deleteSystem(system.id)
    } else if (selectedElement.value.type === 'hyperlane') {
      const hyperlane = selectedElement.value.data as HyperlaneData
      mapStore.deleteHyperlane(hyperlane.from, hyperlane.to)
    } else if (selectedElement.value.type === 'nebula') {
      const nebula = selectedElement.value.data as NebulaData
      mapStore.deleteNebula(nebula.name)
    }
    mapStore.clearSelection()
    $q.notify({
      type: 'info',
      message: t('messages.elementDeleted')
    })
  }
}

function handleUpdateSystem(field: string, value: string | number) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  
  const system = selectedElement.value.data as SystemData
  mapStore.updateSystem(system.id, { [field]: value })
}

function handleUpdateNebula(field: 'name' | 'x' | 'y' | 'z' | 'radius', value: string | number) {
  if (!selectedElement.value || selectedElement.value.type !== 'nebula') return
  
  const nebula = selectedElement.value.data as NebulaData
  mapStore.updateNebula(nebula.name, { [field]: value })
}

function handleToggleHyperlaneType() {
  if (!selectedElement.value || selectedElement.value.type !== 'hyperlane') return
  
  const hyperlane = selectedElement.value.data as HyperlaneData
  mapStore.toggleHyperlaneType(hyperlane.from, hyperlane.to)
}

// Helper function to clamp values
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Handler to clamp input on blur
function handleClampInput(evt: FocusEvent, field: string, min: number, max: number) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  const system = selectedElement.value.data as SystemData
  const currentValue = system[field as keyof SystemData] as number
  const clampedValue = clampValue(currentValue, min, max)
  if (currentValue !== clampedValue) {
    handleUpdateSystem(field, clampedValue)
  }
}

// Dynamic coordinate toggle handlers
function handleToggleAllDynamic(value: boolean) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  const system = selectedElement.value.data as SystemData
  
  if (value) {
    // Enable all dynamic coordinates with ±5 default
    mapStore.updateSystem(system.id, {
      isDynamicX: true,
      xMin: system.x - 5,
      xMax: system.x + 5,
      isDynamicY: true,
      yMin: system.y - 5,
      yMax: system.y + 5,
      isDynamicZ: true,
      zMin: system.z - 5,
      zMax: system.z + 5
    })
  } else {
    // Disable all dynamic coordinates
    mapStore.updateSystem(system.id, {
      isDynamicX: false,
      isDynamicY: false,
      isDynamicZ: false
    })
  }
}

function handleToggleDynamicCoord(axis: 'x' | 'y' | 'z', value: boolean) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  const system = selectedElement.value.data as SystemData
  
  const updates: Partial<Omit<SystemData, 'id'>> = {}
  const updatesAny = updates as Record<string, unknown>
  
  if (value) {
    // Enable dynamic for this axis with ±5 default
    updatesAny[`isDynamic${axis.toUpperCase()}`] = true
    updatesAny[`${axis}Min`] = system[axis] - 5
    updatesAny[`${axis}Max`] = system[axis] + 5
  } else {
    // Disable dynamic for this axis
    updatesAny[`isDynamic${axis.toUpperCase()}`] = false
  }
  
  mapStore.updateSystem(system.id, updates)
}

// Spawn weight handlers
function handleToggleSpawnWeight(value: boolean) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  const system = selectedElement.value.data as SystemData
  
  if (value) {
    // Enable spawn weight with base = 0
    mapStore.updateSpawnWeight(system.id, 0, undefined)
  } else {
    // Delete spawn weight
    mapStore.deleteSpawnWeight(system.id)
  }
}

function handleUpdateSpawnWeightBase(base: number) {
  if (!selectedElement.value || selectedElement.value.type !== 'system') return
  const system = selectedElement.value.data as SystemData
  
  if (system.spawnWeight) {
    mapStore.updateSpawnWeight(system.id, base, system.spawnWeight.modifier)
  }
}

function handleUpdateSpawnWeightModifier(text: string | number | null) {
  if (!selectedElement.value || selectedElement.value.type !== 'system' || typeof text !== 'string') return
  const system = selectedElement.value.data as SystemData
  
  if (!system.spawnWeight) return
  
  try {
    modifierSyntaxError.value = ''
    
    // Parse Clausewitz syntax (simple key = value pairs)
    const modifier: Record<string, string | number> = {}
    const lines = text.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s*=\s*(.+)\s*$/)
      if (!match || !match[1] || !match[2]) {
        modifierSyntaxError.value = t('drawer.modifierInvalidSyntax')
        return
      }
      
      const key = match[1]
      const valueStr = match[2].trim()
      let value: string | number = valueStr
      
      // Try to parse as number
      if (!isNaN(Number(valueStr))) {
        value = Number(valueStr)
      }
      
      modifier[key] = value
    }
    
    mapStore.updateSpawnWeight(system.id, system.spawnWeight.base, Object.keys(modifier).length > 0 ? modifier : undefined)
  } catch {
    modifierSyntaxError.value = t('drawer.modifierInvalidSyntax')
  }
}
</script>