import { defineStore, acceptHMRUpdate } from 'pinia';
import { shallowRef, computed, ref } from 'vue';
import { parse, stringify, ClausewitzDocument, type Document, type Property, type Block, type Value } from 'shroudingers-parser';

export interface SystemData {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  initializer?: string;
}

export interface HyperlaneData {
  from: string;
  to: string;
  type: 'add' | 'prevent';
}

export interface SelectedElement {
  type: 'system' | 'hyperlane';
  data: SystemData | HyperlaneData;
}

export interface MapSettings {
  name: string;
  priority: number;
  default: boolean;
  numEmpiresMin: number;
  numEmpiresMax: number;
  numEmpireDefault: number;
  fallenEmpireDefault: number;
  fallenEmpireMax: number;
  marauderEmpireDefault: number;
  marauderEmpireMax: number;
  advancedEmpireDefault: number;
  colonizablePlanetOdds: number;
  primitiveOdds: number;
  crisisStrength: number;
  numWormholePairsMin: number;
  numWormholePairsMax: number;
  numWormholePairsDefault: number;
  numGatewaysMin: number;
  numGatewaysMax: number;
  numGatewaysDefault: number;
  randomHyperlanes: boolean;
  coreRadius: number;
}

const DEFAULT_MAP_TEMPLATE = `static_galaxy_scenario = {
	name = "New Map"
	priority = 0
	default = yes
	supports_shape = elliptical
	num_empires = { min = 3 max = 3 }
	num_empire_default = 3
	fallen_empire_default = 2
	fallen_empire_max = 2
	marauder_empire_default = 1
	marauder_empire_max = 1
	advanced_empire_default = 1
	colonizable_planet_odds = 1.0
	primitive_odds = 1.0
	crisis_strength = 0.75
	extra_crisis_strength = { 5.5 6 6.5 7 7.5 8 8.5 9 9.5 10 11 12 13 14 15 17.5 20 22.5 25 30 35 40 45 50 }
	num_wormhole_pairs = { min = 0 max = 10 }
	num_wormhole_pairs_default = 1
	num_gateways = { min = 0 max = 10 }
	num_gateways_default = 1
	random_hyperlanes = no
	core_radius = 0
}`;

function getValueAsNumber(value: Value | undefined, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || defaultValue;
  return defaultValue;
}

function getValueAsString(value: Value | undefined, defaultValue: string = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return defaultValue;
}

function getValueAsBoolean(value: Value | undefined, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return defaultValue;
}

function findPropertyInBlock(block: Block, key: string): Property | undefined {
  return block.properties.find((p) => p.key === key);
}

function getBlockValue(prop: Property): Block | undefined {
  if (prop.value && typeof prop.value === 'object' && 'type' in prop.value && prop.value.type === 'Block') {
    return prop.value;
  }
  return undefined;
}

export const useMapStore = defineStore('map', () => {
  // Use shallowRef for the AST document to avoid deep reactivity overhead
  const document = shallowRef<Document | null>(null);
  // ClausewitzDocument helper for easier manipulation
  const clausewitzDoc = shallowRef<ClausewitzDocument | null>(null);
  // Version counter for manual reactivity triggering
  const version = ref(0);

  // Helper to get the scenario block
  function getScenarioBlock(): Block | null {
    if (!document.value) return null;
    const scenarioProp = document.value.properties.find((p: Property) => p.key === 'static_galaxy_scenario');
    if (!scenarioProp) return null;
    return getBlockValue(scenarioProp) || null;
  }

  // Computed getters
  const systems = computed<SystemData[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value; // Trigger reactivity on version change
    
    const scenario = getScenarioBlock();
    if (!scenario) return [];

    const systemList: SystemData[] = [];

    for (const prop of scenario.properties) {
      if (prop.key === 'system') {
        const systemBlock = getBlockValue(prop);
        if (!systemBlock) continue;

        let id = '';
        let name = '';
        let x = 0;
        let y = 0;
        let z = 0;
        let initializer: string | undefined;

        for (const sysProp of systemBlock.properties) {
          if (sysProp.key === 'id') {
            id = getValueAsString(sysProp.value);
          } else if (sysProp.key === 'name') {
            name = getValueAsString(sysProp.value);
          } else if (sysProp.key === 'initializer') {
            initializer = getValueAsString(sysProp.value) || undefined;
          } else if (sysProp.key === 'position') {
            const posBlock = getBlockValue(sysProp);
            if (posBlock) {
              for (const posProp of posBlock.properties) {
                if (posProp.key === 'x') {
                  // Handle both simple values and min/max objects
                  const xBlock = getBlockValue(posProp);
                  if (xBlock) {
                    // It's a min/max object, use the average
                    const minProp = findPropertyInBlock(xBlock, 'min');
                    const maxProp = findPropertyInBlock(xBlock, 'max');
                    const min = minProp ? getValueAsNumber(minProp.value) : 0;
                    const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    x = (min + max) / 2;
                  } else {
                    x = getValueAsNumber(posProp.value);
                  }
                } else if (posProp.key === 'y') {
                  const yBlock = getBlockValue(posProp);
                  if (yBlock) {
                    const minProp = findPropertyInBlock(yBlock, 'min');
                    const maxProp = findPropertyInBlock(yBlock, 'max');
                    const min = minProp ? getValueAsNumber(minProp.value) : 0;
                    const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    y = (min + max) / 2;
                  } else {
                    y = getValueAsNumber(posProp.value);
                  }
                } else if (posProp.key === 'z') {
                  const zBlock = getBlockValue(posProp);
                  if (zBlock) {
                    const minProp = findPropertyInBlock(zBlock, 'min');
                    const maxProp = findPropertyInBlock(zBlock, 'max');
                    const min = minProp ? getValueAsNumber(minProp.value) : 0;
                    const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    z = (min + max) / 2;
                  } else {
                    z = getValueAsNumber(posProp.value);
                  }
                }
              }
            }
          }
        }

        systemList.push({ id, name, x, y, z, ...(initializer ? { initializer } : {}) });
      }
    }

    return systemList;
  });

  const hyperlanes = computed<HyperlaneData[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value; // Trigger reactivity on version change
    
    const scenario = getScenarioBlock();
    if (!scenario) return [];

    const hyperlaneList: HyperlaneData[] = [];

    for (const prop of scenario.properties) {
      if (prop.key === 'add_hyperlane' || prop.key === 'prevent_hyperlane') {
        const hlBlock = getBlockValue(prop);
        if (!hlBlock) continue;

        let from = '';
        let to = '';

        const fromProp = findPropertyInBlock(hlBlock, 'from');
        const toProp = findPropertyInBlock(hlBlock, 'to');

        if (fromProp) from = getValueAsString(fromProp.value);
        if (toProp) to = getValueAsString(toProp.value);

        hyperlaneList.push({
          from,
          to,
          type: prop.key === 'add_hyperlane' ? 'add' : 'prevent'
        });
      }
    }

    return hyperlaneList;
  });

  const mapName = computed<string>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value;
    
    if (!clausewitzDoc.value) return 'New Map';
    const name = clausewitzDoc.value.get('static_galaxy_scenario.name');
    return getValueAsString(name, 'New Map');
  });

  const mapSettings = computed<MapSettings | null>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value;
    
    if (!clausewitzDoc.value) return null;

    const doc = clausewitzDoc.value;

    const settings: MapSettings = {
      name: getValueAsString(doc.get('static_galaxy_scenario.name'), 'New Map'),
      priority: getValueAsNumber(doc.get('static_galaxy_scenario.priority'), 0),
      default: getValueAsBoolean(doc.get('static_galaxy_scenario.default'), true),
      numEmpiresMin: getValueAsNumber(doc.get('static_galaxy_scenario.num_empires.min'), 3),
      numEmpiresMax: getValueAsNumber(doc.get('static_galaxy_scenario.num_empires.max'), 3),
      numEmpireDefault: getValueAsNumber(doc.get('static_galaxy_scenario.num_empire_default'), 3),
      fallenEmpireDefault: getValueAsNumber(doc.get('static_galaxy_scenario.fallen_empire_default'), 2),
      fallenEmpireMax: getValueAsNumber(doc.get('static_galaxy_scenario.fallen_empire_max'), 2),
      marauderEmpireDefault: getValueAsNumber(doc.get('static_galaxy_scenario.marauder_empire_default'), 1),
      marauderEmpireMax: getValueAsNumber(doc.get('static_galaxy_scenario.marauder_empire_max'), 1),
      advancedEmpireDefault: getValueAsNumber(doc.get('static_galaxy_scenario.advanced_empire_default'), 1),
      colonizablePlanetOdds: getValueAsNumber(doc.get('static_galaxy_scenario.colonizable_planet_odds'), 1.0),
      primitiveOdds: getValueAsNumber(doc.get('static_galaxy_scenario.primitive_odds'), 1.0),
      crisisStrength: getValueAsNumber(doc.get('static_galaxy_scenario.crisis_strength'), 0.75),
      numWormholePairsMin: getValueAsNumber(doc.get('static_galaxy_scenario.num_wormhole_pairs.min'), 0),
      numWormholePairsMax: getValueAsNumber(doc.get('static_galaxy_scenario.num_wormhole_pairs.max'), 10),
      numWormholePairsDefault: getValueAsNumber(doc.get('static_galaxy_scenario.num_wormhole_pairs_default'), 1),
      numGatewaysMin: getValueAsNumber(doc.get('static_galaxy_scenario.num_gateways.min'), 0),
      numGatewaysMax: getValueAsNumber(doc.get('static_galaxy_scenario.num_gateways.max'), 10),
      numGatewaysDefault: getValueAsNumber(doc.get('static_galaxy_scenario.num_gateways_default'), 1),
      randomHyperlanes: getValueAsBoolean(doc.get('static_galaxy_scenario.random_hyperlanes'), false),
      coreRadius: getValueAsNumber(doc.get('static_galaxy_scenario.core_radius'), 0)
    };

    return settings;
  });

  // Actions
  function loadFromText(text: string): { success: boolean; error?: string } {
    const result = parse(text);
    if (result.success && result.document) {
      document.value = result.document;
      clausewitzDoc.value = new ClausewitzDocument(result.document);
      version.value++;
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Unknown parse error' };
    }
  }

  function createNewMap(): void {
    const result = parse(DEFAULT_MAP_TEMPLATE);
    if (result.success && result.document) {
      document.value = result.document;
      clausewitzDoc.value = new ClausewitzDocument(result.document);
      version.value++;
    }
  }

  function updateSetting(key: string, value: string | number | boolean): void {
    if (!clausewitzDoc.value) return;

    let actualValue: Value;
    if (typeof value === 'boolean') {
      actualValue = value ? 'yes' : 'no';
    } else {
      actualValue = value;
    }

    clausewitzDoc.value.set(`static_galaxy_scenario.${key}`, actualValue);
    version.value++;
  }

  function updateNestedSetting(parentKey: string, nestedKey: string, value: number): void {
    if (!clausewitzDoc.value) return;

    clausewitzDoc.value.set(`static_galaxy_scenario.${parentKey}.${nestedKey}`, value);
    version.value++;
  }

  function deleteSystem(systemId: string): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    const indexToRemove = scenario.properties.findIndex((prop: Property) => {
      if (prop.key === 'system') {
        const systemBlock = getBlockValue(prop);
        if (systemBlock) {
          const idProp = findPropertyInBlock(systemBlock, 'id');
          if (idProp && getValueAsString(idProp.value) === systemId) {
            return true;
          }
        }
      }
      return false;
    });

    if (indexToRemove !== -1) {
      scenario.properties.splice(indexToRemove, 1);
      version.value++;
    }
  }

  function deleteHyperlane(from: string, to: string): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    const indexToRemove = scenario.properties.findIndex((prop: Property) => {
      if (prop.key === 'add_hyperlane' || prop.key === 'prevent_hyperlane') {
        const hlBlock = getBlockValue(prop);
        if (hlBlock) {
          const fromProp = findPropertyInBlock(hlBlock, 'from');
          const toProp = findPropertyInBlock(hlBlock, 'to');
          const foundFrom = fromProp ? getValueAsString(fromProp.value) : '';
          const foundTo = toProp ? getValueAsString(toProp.value) : '';
          return foundFrom === from && foundTo === to;
        }
      }
      return false;
    });

    if (indexToRemove !== -1) {
      scenario.properties.splice(indexToRemove, 1);
      version.value++;
    }
  }

  function stringifyDocument(): string {
    if (!clausewitzDoc.value) return '';
    return stringify(clausewitzDoc.value);
  }

  function hasDocument(): boolean {
    return document.value !== null;
  }

  function updateSystem(systemId: string, updates: Partial<Omit<SystemData, 'id'>>): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    for (const prop of scenario.properties) {
      if (prop.key === 'system') {
        const systemBlock = getBlockValue(prop);
        if (!systemBlock) continue;

        const idProp = findPropertyInBlock(systemBlock, 'id');
        if (!idProp || getValueAsString(idProp.value) !== systemId) continue;

        // Update name
        if (updates.name !== undefined) {
          const nameProp = findPropertyInBlock(systemBlock, 'name');
          if (nameProp) {
            nameProp.value = updates.name;
          }
        }

        // Update initializer
        if (updates.initializer !== undefined) {
          const initProp = findPropertyInBlock(systemBlock, 'initializer');
          if (initProp) {
            initProp.value = updates.initializer;
          } else if (updates.initializer) {
            // Add initializer if it doesn't exist
            systemBlock.properties.push({ 
              type: 'Property', 
              key: 'initializer', 
              operator: '=',
              value: updates.initializer 
            } as Property);
          }
        }

        // Update position
        if (updates.x !== undefined || updates.y !== undefined || updates.z !== undefined) {
          const posProp = findPropertyInBlock(systemBlock, 'position');
          if (posProp) {
            const posBlock = getBlockValue(posProp);
            if (posBlock) {
              if (updates.x !== undefined) {
                const xProp = findPropertyInBlock(posBlock, 'x');
                if (xProp) xProp.value = updates.x;
              }
              if (updates.y !== undefined) {
                const yProp = findPropertyInBlock(posBlock, 'y');
                if (yProp) yProp.value = updates.y;
              }
              if (updates.z !== undefined) {
                const zProp = findPropertyInBlock(posBlock, 'z');
                if (zProp) {
                  zProp.value = updates.z;
                } else {
                  // Create z property if it doesn't exist
                  posBlock.properties.push({
                    type: 'Property',
                    key: 'z',
                    operator: '=',
                    value: updates.z
                  } as Property);
                }
              }
            }
          }
        }

        // Update selection if this system is selected
        if (selectedElement.value?.type === 'system') {
          const selectedSystem = selectedElement.value.data as SystemData;
          if (selectedSystem.id === systemId) {
            selectedElement.value = {
              type: 'system',
              data: {
                ...selectedSystem,
                ...updates
              }
            };
          }
        }

        version.value++;
        return;
      }
    }
  }

  function toggleHyperlaneType(from: string, to: string): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    for (const prop of scenario.properties) {
      if (prop.key === 'add_hyperlane' || prop.key === 'prevent_hyperlane') {
        const hlBlock = getBlockValue(prop);
        if (!hlBlock) continue;

        const fromProp = findPropertyInBlock(hlBlock, 'from');
        const toProp = findPropertyInBlock(hlBlock, 'to');
        const foundFrom = fromProp ? getValueAsString(fromProp.value) : '';
        const foundTo = toProp ? getValueAsString(toProp.value) : '';

        if (foundFrom === from && foundTo === to) {
          // Toggle the type
          const newType = prop.key === 'add_hyperlane' ? 'prevent_hyperlane' : 'add_hyperlane';
          prop.key = newType;

          // Update selection if this hyperlane is selected
          if (selectedElement.value?.type === 'hyperlane') {
            const selectedHyperlane = selectedElement.value.data as HyperlaneData;
            if (selectedHyperlane.from === from && selectedHyperlane.to === to) {
              selectedElement.value = {
                type: 'hyperlane',
                data: {
                  from,
                  to,
                  type: newType === 'add_hyperlane' ? 'add' : 'prevent'
                }
              };
            }
          }

          version.value++;
          return;
        }
      }
    }
  }

  // Selection state
  const selectedElement = ref<SelectedElement | null>(null);

  function selectElement(element: SelectedElement | null): void {
    selectedElement.value = element;
  }

  function clearSelection(): void {
    selectedElement.value = null;
  }

  return {
    // State
    document,
    clausewitzDoc,
    version,
    // Getters
    systems,
    hyperlanes,
    mapName,
    mapSettings,
    // Actions
    loadFromText,
    createNewMap,
    updateSetting,
    updateNestedSetting,
    deleteSystem,
    deleteHyperlane,
    updateSystem,
    toggleHyperlaneType,
    stringifyDocument,
    hasDocument,
    // Selection
    selectedElement,
    selectElement,
    clearSelection
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMapStore, import.meta.hot));
}
