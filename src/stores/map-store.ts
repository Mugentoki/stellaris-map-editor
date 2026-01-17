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
  // Dynamic coordinate support
  isDynamicX?: boolean;
  isDynamicY?: boolean;
  isDynamicZ?: boolean;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  zMin?: number;
  zMax?: number;
  // Spawn weight support
  spawnWeight?: {
    base: number;
    modifier?: Record<string, string | number>;
  };
}

export interface HyperlaneData {
  from: string;
  to: string;
  type: 'add' | 'prevent';
}

export interface NebulaData {
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface SelectedElement {
  type: 'system' | 'hyperlane' | 'nebula';
  data: SystemData | HyperlaneData | NebulaData;
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
        let isDynamicX = false;
        let isDynamicY = false;
        let isDynamicZ = false;
        let xMin: number | undefined;
        let xMax: number | undefined;
        let yMin: number | undefined;
        let yMax: number | undefined;
        let zMin: number | undefined;
        let zMax: number | undefined;
        let spawnWeight: { base: number; modifier?: Record<string, string | number> } | undefined;

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
                    // It's a min/max object
                    isDynamicX = true;
                    const minProp = findPropertyInBlock(xBlock, 'min');
                    const maxProp = findPropertyInBlock(xBlock, 'max');
                    xMin = minProp ? getValueAsNumber(minProp.value) : 0;
                    xMax = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    x = (xMin + xMax) / 2;
                  } else {
                    x = getValueAsNumber(posProp.value);
                  }
                } else if (posProp.key === 'y') {
                  const yBlock = getBlockValue(posProp);
                  if (yBlock) {
                    isDynamicY = true;
                    const minProp = findPropertyInBlock(yBlock, 'min');
                    const maxProp = findPropertyInBlock(yBlock, 'max');
                    yMin = minProp ? getValueAsNumber(minProp.value) : 0;
                    yMax = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    y = (yMin + yMax) / 2;
                  } else {
                    y = getValueAsNumber(posProp.value);
                  }
                } else if (posProp.key === 'z') {
                  const zBlock = getBlockValue(posProp);
                  if (zBlock) {
                    isDynamicZ = true;
                    const minProp = findPropertyInBlock(zBlock, 'min');
                    const maxProp = findPropertyInBlock(zBlock, 'max');
                    zMin = minProp ? getValueAsNumber(minProp.value) : 0;
                    zMax = maxProp ? getValueAsNumber(maxProp.value) : 0;
                    z = (zMin + zMax) / 2;
                  } else {
                    z = getValueAsNumber(posProp.value);
                  }
                }
              }
            }
          } else if (sysProp.key === 'spawn_weight') {
            const spawnWeightBlock = getBlockValue(sysProp);
            if (spawnWeightBlock) {
              let base = 0;
              let modifier: Record<string, string | number> | undefined;
              
              for (const swProp of spawnWeightBlock.properties) {
                if (swProp.key === 'base') {
                  base = getValueAsNumber(swProp.value);
                } else if (swProp.key === 'modifier') {
                  const modifierBlock = getBlockValue(swProp);
                  if (modifierBlock) {
                    modifier = {};
                    for (const modProp of modifierBlock.properties) {
                      const val = modProp.value;
                      if (typeof val === 'number' || typeof val === 'string') {
                        modifier[modProp.key] = val;
                      }
                    }
                  }
                }
              }
              
              spawnWeight = { base, ...(modifier ? { modifier } : {}) };
            }
          }
        }

        const systemData: SystemData = { 
          id, name, x, y, z
        };
        if (initializer) systemData.initializer = initializer;
        if (isDynamicX && xMin !== undefined && xMax !== undefined) {
          systemData.isDynamicX = isDynamicX;
          systemData.xMin = xMin;
          systemData.xMax = xMax;
        }
        if (isDynamicY && yMin !== undefined && yMax !== undefined) {
          systemData.isDynamicY = isDynamicY;
          systemData.yMin = yMin;
          systemData.yMax = yMax;
        }
        if (isDynamicZ && zMin !== undefined && zMax !== undefined) {
          systemData.isDynamicZ = isDynamicZ;
          systemData.zMin = zMin;
          systemData.zMax = zMax;
        }
        if (spawnWeight) systemData.spawnWeight = spawnWeight;
        systemList.push(systemData);
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

  const nebulae = computed<NebulaData[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value; // Trigger reactivity on version change
    
    const scenario = getScenarioBlock();
    if (!scenario) return [];

    const nebulaList: NebulaData[] = [];

    for (const prop of scenario.properties) {
      if (prop.key === 'nebula') {
        const nebulaBlock = getBlockValue(prop);
        if (!nebulaBlock) continue;

        let name = '';
        let x = 0;
        let y = 0;
        let z = 0;
        let radius = 10;

        for (const nebProp of nebulaBlock.properties) {
          if (nebProp.key === 'name') {
            name = getValueAsString(nebProp.value);
          } else if (nebProp.key === 'radius') {
            radius = getValueAsNumber(nebProp.value, 10);
          } else if (nebProp.key === 'position') {
            const posBlock = getBlockValue(nebProp);
            if (posBlock) {
              for (const posProp of posBlock.properties) {
                if (posProp.key === 'x') {
                  x = getValueAsNumber(posProp.value);
                } else if (posProp.key === 'y') {
                  y = getValueAsNumber(posProp.value);
                } else if (posProp.key === 'z') {
                  z = getValueAsNumber(posProp.value);
                }
              }
            }
          }
        }

        nebulaList.push({ name, x, y, z, radius });
      }
    }

    return nebulaList;
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

  function addSystem(x: number, y: number, z: number = 0): { success: boolean; error?: string; id?: string } {
    const scenario = getScenarioBlock();
    if (!scenario) {
      return { success: false, error: 'No map loaded' };
    }

    // Get next available ID
    const existingIds = systems.value.map(s => parseInt(s.id)).filter(id => !isNaN(id));
    const nextId = existingIds.length > 0 ? (Math.max(...existingIds) + 1).toString() : '0';

    // Create position block
    const positionBlock: Block = {
      type: 'Block',
      properties: [
        { type: 'Property', key: 'x', operator: '=', value: x } as Property,
        { type: 'Property', key: 'y', operator: '=', value: y } as Property,
        { type: 'Property', key: 'z', operator: '=', value: z } as Property
      ]
    };

    // Create system block
    const systemBlock: Block = {
      type: 'Block',
      properties: [
        { type: 'Property', key: 'id', operator: '=', value: nextId } as Property,
        { type: 'Property', key: 'name', operator: '=', value: '' } as Property,
        { type: 'Property', key: 'position', operator: '=', value: positionBlock } as Property
      ]
    };

    // Add system property to scenario
    const systemProperty: Property = {
      type: 'Property',
      key: 'system',
      operator: '=',
      value: systemBlock
    };

    scenario.properties.push(systemProperty);
    version.value++;

    return { success: true, id: nextId };
  }

  function addNebula(x: number, y: number, z: number = 0, radius: number = 5): { success: boolean; error?: string } {
    const scenario = getScenarioBlock();
    if (!scenario) {
      return { success: false, error: 'No map loaded' };
    }

    // Create position block
    const positionBlock: Block = {
      type: 'Block',
      properties: [
        { type: 'Property', key: 'x', operator: '=', value: x } as Property,
        { type: 'Property', key: 'y', operator: '=', value: y } as Property,
        { type: 'Property', key: 'z', operator: '=', value: z } as Property
      ]
    };

    // Create nebula block with empty name
    const nebulaBlock: Block = {
      type: 'Block',
      properties: [
        { type: 'Property', key: 'name', operator: '=', value: '' } as Property,
        { type: 'Property', key: 'position', operator: '=', value: positionBlock } as Property,
        { type: 'Property', key: 'radius', operator: '=', value: radius } as Property
      ]
    };

    // Add nebula property to scenario
    const nebulaProperty: Property = {
      type: 'Property',
      key: 'nebula',
      operator: '=',
      value: nebulaBlock
    };

    scenario.properties.push(nebulaProperty);
    version.value++;

    return { success: true };
  }

  function addHyperlane(fromId: string, toId: string, type: 'add' | 'prevent'): { success: boolean; error?: string } {
    const scenario = getScenarioBlock();
    if (!scenario) {
      return { success: false, error: 'No map loaded' };
    }

    // Check if hyperlane already exists
    const existingHyperlane = hyperlanes.value.find(
      h => (h.from === fromId && h.to === toId) || (h.from === toId && h.to === fromId)
    );

    if (existingHyperlane) {
      return { success: false, error: 'Hyperlane already exists between these systems' };
    }

    // Create hyperlane block
    const hyperlaneBlock: Block = {
      type: 'Block',
      properties: [
        { type: 'Property', key: 'from', operator: '=', value: fromId } as Property,
        { type: 'Property', key: 'to', operator: '=', value: toId } as Property
      ]
    };

    // Add hyperlane property to scenario
    const hyperlaneProperty: Property = {
      type: 'Property',
      key: type === 'add' ? 'add_hyperlane' : 'prevent_hyperlane',
      operator: '=',
      value: hyperlaneBlock
    };

    scenario.properties.push(hyperlaneProperty);
    version.value++;

    return { success: true };
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

  function deleteNebula(nebulaName: string): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    const indexToRemove = scenario.properties.findIndex((prop: Property) => {
      if (prop.key === 'nebula') {
        const nebulaBlock = getBlockValue(prop);
        if (nebulaBlock) {
          const nameProp = findPropertyInBlock(nebulaBlock, 'name');
          if (nameProp && getValueAsString(nameProp.value) === nebulaName) {
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

  function updateNebula(nebulaName: string, updates: Partial<NebulaData>): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    for (const prop of scenario.properties) {
      if (prop.key === 'nebula') {
        const nebulaBlock = getBlockValue(prop);
        if (!nebulaBlock) continue;

        const nameProp = findPropertyInBlock(nebulaBlock, 'name');
        if (!nameProp || getValueAsString(nameProp.value) !== nebulaName) continue;

        // Update name
        if (updates.name !== undefined && nameProp) {
          nameProp.value = updates.name;
        }

        // Update radius
        if (updates.radius !== undefined) {
          const radiusProp = findPropertyInBlock(nebulaBlock, 'radius');
          if (radiusProp) {
            radiusProp.value = updates.radius;
          }
        }

        // Update position
        if (updates.x !== undefined || updates.y !== undefined || updates.z !== undefined) {
          const posProp = findPropertyInBlock(nebulaBlock, 'position');
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

        // Update selection if this nebula is selected
        if (selectedElement.value?.type === 'nebula') {
          const selectedNebula = selectedElement.value.data as NebulaData;
          if (selectedNebula.name === nebulaName) {
            const newName = updates.name ?? nebulaName;
            selectedElement.value = {
              type: 'nebula',
              data: {
                ...selectedNebula,
                ...updates,
                name: newName
              }
            };
          }
        }

        version.value++;
        return;
      }
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

        // Update position (including dynamic coordinates)
        if (updates.x !== undefined || updates.y !== undefined || updates.z !== undefined ||
            updates.isDynamicX !== undefined || updates.isDynamicY !== undefined || updates.isDynamicZ !== undefined ||
            updates.xMin !== undefined || updates.xMax !== undefined ||
            updates.yMin !== undefined || updates.yMax !== undefined ||
            updates.zMin !== undefined || updates.zMax !== undefined) {
          const posProp = findPropertyInBlock(systemBlock, 'position');
          if (posProp) {
            const posBlock = getBlockValue(posProp);
            if (posBlock) {
              // Handle X coordinate
              if (updates.isDynamicX !== undefined) {
                const xProp = findPropertyInBlock(posBlock, 'x');
                if (updates.isDynamicX) {
                  // Convert to dynamic (min/max block)
                  const xMin = updates.xMin ?? (xProp ? getValueAsNumber(xProp.value) - 5 : 0);
                  const xMax = updates.xMax ?? (xProp ? getValueAsNumber(xProp.value) + 5 : 0);
                  
                  if (xProp) {
                    xProp.value = {
                      type: 'Block',
                      properties: [
                        { type: 'Property', key: 'min', operator: '=', value: xMin } as Property,
                        { type: 'Property', key: 'max', operator: '=', value: xMax } as Property
                      ]
                    } as Block;
                  }
                } else {
                  // Convert to static (simple value)
                  if (xProp) {
                    const xBlock = getBlockValue(xProp);
                    if (xBlock) {
                      const minProp = findPropertyInBlock(xBlock, 'min');
                      const maxProp = findPropertyInBlock(xBlock, 'max');
                      const min = minProp ? getValueAsNumber(minProp.value) : 0;
                      const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                      xProp.value = (min + max) / 2;
                    }
                  }
                }
              } else if (updates.x !== undefined) {
                const xProp = findPropertyInBlock(posBlock, 'x');
                if (xProp) xProp.value = updates.x;
              } else if (updates.xMin !== undefined || updates.xMax !== undefined) {
                const xProp = findPropertyInBlock(posBlock, 'x');
                if (xProp) {
                  const xBlock = getBlockValue(xProp);
                  if (xBlock) {
                    if (updates.xMin !== undefined) {
                      const minProp = findPropertyInBlock(xBlock, 'min');
                      if (minProp) minProp.value = updates.xMin;
                    }
                    if (updates.xMax !== undefined) {
                      const maxProp = findPropertyInBlock(xBlock, 'max');
                      if (maxProp) maxProp.value = updates.xMax;
                    }
                  }
                }
              }
              
              // Handle Y coordinate
              if (updates.isDynamicY !== undefined) {
                const yProp = findPropertyInBlock(posBlock, 'y');
                if (updates.isDynamicY) {
                  // Convert to dynamic (min/max block)
                  const yMin = updates.yMin ?? (yProp ? getValueAsNumber(yProp.value) - 5 : 0);
                  const yMax = updates.yMax ?? (yProp ? getValueAsNumber(yProp.value) + 5 : 0);
                  
                  if (yProp) {
                    yProp.value = {
                      type: 'Block',
                      properties: [
                        { type: 'Property', key: 'min', operator: '=', value: yMin } as Property,
                        { type: 'Property', key: 'max', operator: '=', value: yMax } as Property
                      ]
                    } as Block;
                  }
                } else {
                  // Convert to static (simple value)
                  if (yProp) {
                    const yBlock = getBlockValue(yProp);
                    if (yBlock) {
                      const minProp = findPropertyInBlock(yBlock, 'min');
                      const maxProp = findPropertyInBlock(yBlock, 'max');
                      const min = minProp ? getValueAsNumber(minProp.value) : 0;
                      const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                      yProp.value = (min + max) / 2;
                    }
                  }
                }
              } else if (updates.y !== undefined) {
                const yProp = findPropertyInBlock(posBlock, 'y');
                if (yProp) yProp.value = updates.y;
              } else if (updates.yMin !== undefined || updates.yMax !== undefined) {
                const yProp = findPropertyInBlock(posBlock, 'y');
                if (yProp) {
                  const yBlock = getBlockValue(yProp);
                  if (yBlock) {
                    if (updates.yMin !== undefined) {
                      const minProp = findPropertyInBlock(yBlock, 'min');
                      if (minProp) minProp.value = updates.yMin;
                    }
                    if (updates.yMax !== undefined) {
                      const maxProp = findPropertyInBlock(yBlock, 'max');
                      if (maxProp) maxProp.value = updates.yMax;
                    }
                  }
                }
              }
              
              // Handle Z coordinate
              if (updates.isDynamicZ !== undefined) {
                const zProp = findPropertyInBlock(posBlock, 'z');
                if (updates.isDynamicZ) {
                  // Convert to dynamic (min/max block)
                  const zMin = updates.zMin ?? (zProp ? getValueAsNumber(zProp.value) - 5 : 0);
                  const zMax = updates.zMax ?? (zProp ? getValueAsNumber(zProp.value) + 5 : 0);
                  
                  if (zProp) {
                    zProp.value = {
                      type: 'Block',
                      properties: [
                        { type: 'Property', key: 'min', operator: '=', value: zMin } as Property,
                        { type: 'Property', key: 'max', operator: '=', value: zMax } as Property
                      ]
                    } as Block;
                  } else {
                    // Create z property if it doesn't exist
                    posBlock.properties.push({
                      type: 'Property',
                      key: 'z',
                      operator: '=',
                      value: {
                        type: 'Block',
                        properties: [
                          { type: 'Property', key: 'min', operator: '=', value: zMin } as Property,
                          { type: 'Property', key: 'max', operator: '=', value: zMax } as Property
                        ]
                      } as Block
                    } as Property);
                  }
                } else {
                  // Convert to static (simple value)
                  if (zProp) {
                    const zBlock = getBlockValue(zProp);
                    if (zBlock) {
                      const minProp = findPropertyInBlock(zBlock, 'min');
                      const maxProp = findPropertyInBlock(zBlock, 'max');
                      const min = minProp ? getValueAsNumber(minProp.value) : 0;
                      const max = maxProp ? getValueAsNumber(maxProp.value) : 0;
                      zProp.value = (min + max) / 2;
                    }
                  }
                }
              } else if (updates.z !== undefined) {
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
              } else if (updates.zMin !== undefined || updates.zMax !== undefined) {
                const zProp = findPropertyInBlock(posBlock, 'z');
                if (zProp) {
                  const zBlock = getBlockValue(zProp);
                  if (zBlock) {
                    if (updates.zMin !== undefined) {
                      const minProp = findPropertyInBlock(zBlock, 'min');
                      if (minProp) minProp.value = updates.zMin;
                    }
                    if (updates.zMax !== undefined) {
                      const maxProp = findPropertyInBlock(zBlock, 'max');
                      if (maxProp) maxProp.value = updates.zMax;
                    }
                  }
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

  function updateSpawnWeight(systemId: string, base: number, modifier?: Record<string, string | number>): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    for (const prop of scenario.properties) {
      if (prop.key === 'system') {
        const systemBlock = getBlockValue(prop);
        if (!systemBlock) continue;

        const idProp = findPropertyInBlock(systemBlock, 'id');
        if (!idProp || getValueAsString(idProp.value) !== systemId) continue;

        // Find or create spawn_weight property
        let spawnWeightProp = findPropertyInBlock(systemBlock, 'spawn_weight');
        
        if (!spawnWeightProp) {
          // Create new spawn_weight block
          const spawnWeightBlock: Block = {
            type: 'Block',
            properties: []
          };
          
          spawnWeightProp = {
            type: 'Property',
            key: 'spawn_weight',
            operator: '=',
            value: spawnWeightBlock
          } as Property;
          
          systemBlock.properties.push(spawnWeightProp);
        }

        const spawnWeightBlock = getBlockValue(spawnWeightProp);
        if (!spawnWeightBlock) return;

        // Update base value
        const baseProp = findPropertyInBlock(spawnWeightBlock, 'base');
        if (baseProp) {
          baseProp.value = base;
        } else {
          spawnWeightBlock.properties.push({
            type: 'Property',
            key: 'base',
            operator: '=',
            value: base
          } as Property);
        }

        // Update modifier
        if (modifier && Object.keys(modifier).length > 0) {
          let modifierProp = findPropertyInBlock(spawnWeightBlock, 'modifier');
          
          if (!modifierProp) {
            const modifierBlock: Block = {
              type: 'Block',
              properties: []
            };
            
            modifierProp = {
              type: 'Property',
              key: 'modifier',
              operator: '=',
              value: modifierBlock
            } as Property;
            
            spawnWeightBlock.properties.push(modifierProp);
          }

          const modifierBlock = getBlockValue(modifierProp);
          if (modifierBlock) {
            // Clear existing properties and add new ones
            modifierBlock.properties = [];
            for (const [key, value] of Object.entries(modifier)) {
              modifierBlock.properties.push({
                type: 'Property',
                key,
                operator: '=',
                value
              } as Property);
            }
          }
        } else {
          // Remove modifier if it exists and no modifier provided
          const modifierIndex = spawnWeightBlock.properties.findIndex((p: Property) => p.key === 'modifier');
          if (modifierIndex !== -1) {
            spawnWeightBlock.properties.splice(modifierIndex, 1);
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
                spawnWeight: { base, ...(modifier ? { modifier } : {}) }
              }
            };
          }
        }

        version.value++;
        return;
      }
    }
  }

  function deleteSpawnWeight(systemId: string): void {
    const scenario = getScenarioBlock();
    if (!scenario) return;

    for (const prop of scenario.properties) {
      if (prop.key === 'system') {
        const systemBlock = getBlockValue(prop);
        if (!systemBlock) continue;

        const idProp = findPropertyInBlock(systemBlock, 'id');
        if (!idProp || getValueAsString(idProp.value) !== systemId) continue;

        // Remove spawn_weight property
        const spawnWeightIndex = systemBlock.properties.findIndex((p: Property) => p.key === 'spawn_weight');
        if (spawnWeightIndex !== -1) {
          systemBlock.properties.splice(spawnWeightIndex, 1);
        }

        // Update selection if this system is selected
        if (selectedElement.value?.type === 'system') {
          const selectedSystem = selectedElement.value.data as SystemData;
          if (selectedSystem.id === systemId) {
            // Remove spawn_weight from the system data
            delete selectedSystem.spawnWeight;
            selectedElement.value = {
              type: 'system',
              data: { ...selectedSystem }
            };
          }
        }

        version.value++;
        return;
      }
    }
  }

  return {
    // State
    document,
    clausewitzDoc,
    version,
    // Getters
    systems,
    hyperlanes,
    nebulae,
    mapName,
    mapSettings,
    // Actions
    loadFromText,
    createNewMap,
    updateSetting,
    updateNestedSetting,
    addSystem,
    addNebula,
    addHyperlane,
    deleteSystem,
    deleteHyperlane,
    deleteNebula,
    updateSystem,
    updateNebula,
    toggleHyperlaneType,
    updateSpawnWeight,
    deleteSpawnWeight,
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
