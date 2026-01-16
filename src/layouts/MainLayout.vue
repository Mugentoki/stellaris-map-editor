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
            readonly
          />
          
          <div class="text-subtitle2">{{ t('drawer.position') }}</div>
          <div class="row q-gutter-sm">
            <q-input
              :model-value="(selectedElement.data as SystemData).x"
              label="X"
              outlined
              dense
              readonly
              class="col"
            />
            <q-input
              :model-value="(selectedElement.data as SystemData).y"
              label="Y"
              outlined
              dense
              readonly
              class="col"
            />
            <q-input
              :model-value="(selectedElement.data as SystemData).z"
              label="Z"
              outlined
              dense
              readonly
              class="col"
            />
          </div>

          <q-input
            v-if="(selectedElement.data as SystemData).initializer"
            :model-value="(selectedElement.data as SystemData).initializer"
            :label="t('drawer.initializer')"
            outlined
            dense
            readonly
          />

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
          
          <q-input
            :model-value="(selectedElement.data as HyperlaneData).type"
            :label="t('drawer.type')"
            outlined
            dense
            readonly
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

  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useMapStore, type SystemData, type HyperlaneData } from 'src/stores/map-store'
import OpenMapDialog from 'src/components/OpenMapDialog.vue'
import MapSettingsDialog from 'src/components/MapSettingsDialog.vue'
import SaveMapDialog from 'src/components/SaveMapDialog.vue'

const { t } = useI18n()
const $q = useQuasar()
const mapStore = useMapStore()

const rightDrawerOpen = ref(false)
const version = __APP_VERSION__

// Dialog states
const openDialogOpen = ref(false)
const settingsDialogOpen = ref(false)
const saveDialogOpen = ref(false)

// Selection state - now uses Pinia store directly
const selectedElement = computed(() => mapStore.selectedElement)

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
    }
    mapStore.clearSelection()
    $q.notify({
      type: 'info',
      message: t('messages.elementDeleted')
    })
  }
}
</script>