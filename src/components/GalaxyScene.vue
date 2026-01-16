<template>
  <div ref="containerRef" class="galaxy-scene"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useMapStore, type SystemData, type HyperlaneData } from 'src/stores/map-store';

const mapStore = useMapStore();
const containerRef = ref<HTMLDivElement | null>(null);

// ThreeJS objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationFrameId: number;

// Meshes for selection
const systemMeshes: Map<string, THREE.Mesh> = new Map();
const hyperlaneMeshes: Map<string, THREE.Line> = new Map();

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Selected mesh reference (for visual highlighting)
let selectedMesh: THREE.Mesh | THREE.Line | null = null;

// Camera animation target
let cameraTargetPosition: THREE.Vector3 | null = null;
const cameraAnimationSpeed = 0.08;

// Materials
const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const starSelectedMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800 });
const hyperlaneMaterial = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 });
const hyperlaneSelectedMaterial = new THREE.LineBasicMaterial({ color: 0xff4488, linewidth: 3 });
const preventHyperlaneMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2, opacity: 0.5, transparent: true });

// Geometry (shared)
const starGeometry = new THREE.SphereGeometry(1.5, 16, 16);

function init() {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020403);

  // Camera - positioned above the XY plane looking down
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
  camera.position.set(0, 0, 200); // Looking down from Z axis at XY plane
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  containerRef.value.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 500;

  // Grid helper for reference - GridHelper is on XZ plane by default,
  // but we want it on XY plane (since camera looks down Z axis)
  const gridHelper = new THREE.GridHelper(400, 40, 0x333333, 0x222222);
  gridHelper.rotation.x = Math.PI / 2; // Rotate 90 degrees to lie on XY plane
  scene.add(gridHelper);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add event listeners
  renderer.domElement.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);

  // Initial render of map data
  renderMap();

  // Animation loop
  animate();
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  // Smooth camera animation to target
  if (cameraTargetPosition) {
    controls.target.lerp(cameraTargetPosition, cameraAnimationSpeed);
    
    // Check if we're close enough to stop animating
    if (controls.target.distanceTo(cameraTargetPosition) < 0.1) {
      controls.target.copy(cameraTargetPosition);
      cameraTargetPosition = null;
    }
  }
  
  controls.update();
  renderer.render(scene, camera);
}

function renderMap() {
  // Clear existing objects
  clearMapObjects();

  const systems = mapStore.systems;
  const hyperlanes = mapStore.hyperlanes;

  // Create systems (stars)
  for (const system of systems) {
    const mesh = new THREE.Mesh(starGeometry, starMaterial.clone());
    // Use x, y, z with defaults for missing coordinates (already handled in store, but ensure 0)
    mesh.position.set(system.x ?? 0, system.y ?? 0, system.z ?? 0);
    mesh.userData = { type: 'system', data: system };
    scene.add(mesh);
    systemMeshes.set(system.id, mesh);
  }

  // Create hyperlanes
  for (const hyperlane of hyperlanes) {
    const fromSystem = systems.find(s => s.id === hyperlane.from);
    const toSystem = systems.find(s => s.id === hyperlane.to);

    if (fromSystem && toSystem) {
      const points = [
        new THREE.Vector3(fromSystem.x ?? 0, fromSystem.y ?? 0, fromSystem.z ?? 0),
        new THREE.Vector3(toSystem.x ?? 0, toSystem.y ?? 0, toSystem.z ?? 0)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = hyperlane.type === 'add' ? hyperlaneMaterial.clone() : preventHyperlaneMaterial.clone();
      const line = new THREE.Line(geometry, material);
      line.userData = { type: 'hyperlane', data: hyperlane };
      scene.add(line);
      hyperlaneMeshes.set(`${hyperlane.from}-${hyperlane.to}`, line);
    }
  }

  // Center camera on the map
  if (systems.length > 0) {
    const center = new THREE.Vector3();
    let maxDist = 0;
    for (const system of systems) {
      const pos = new THREE.Vector3(system.x ?? 0, system.y ?? 0, system.z ?? 0);
      center.add(pos);
      const dist = pos.length();
      if (dist > maxDist) maxDist = dist;
    }
    center.divideScalar(systems.length);
    controls.target.copy(center);
    // Position camera above center, looking down at it
    camera.position.set(center.x, center.y, Math.max(200, maxDist * 1.5));
  }
}

function clearMapObjects() {
  // Dispose and remove all system meshes
  for (const mesh of systemMeshes.values()) {
    if (mesh.material instanceof THREE.Material) {
      mesh.material.dispose();
    }
    scene.remove(mesh);
  }
  systemMeshes.clear();

  // Dispose and remove all hyperlane lines
  for (const line of hyperlaneMeshes.values()) {
    line.geometry.dispose();
    if (line.material instanceof THREE.Material) {
      line.material.dispose();
    }
    scene.remove(line);
  }
  hyperlaneMeshes.clear();
}

function onCanvasClick(event: MouseEvent) {
  if (!containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  // Scale threshold based on camera distance for better selection at any zoom level
  const cameraDistance = camera.position.distanceTo(controls.target);
  const scaledThreshold = Math.max(2, cameraDistance * 0.02);

  // Check systems first (priority)
  const systemObjects = Array.from(systemMeshes.values());
  const systemIntersects = raycaster.intersectObjects(systemObjects);

  if (systemIntersects.length > 0 && systemIntersects[0]) {
    selectObject(systemIntersects[0].object as THREE.Mesh);
    return;
  }

  // Check hyperlanes with scaled threshold
  const hyperlaneObjects = Array.from(hyperlaneMeshes.values());
  raycaster.params.Line = { threshold: scaledThreshold };
  const hyperlaneIntersects = raycaster.intersectObjects(hyperlaneObjects);

  if (hyperlaneIntersects.length > 0 && hyperlaneIntersects[0]) {
    selectObject(hyperlaneIntersects[0].object as THREE.Line);
    return;
  }

  // Deselect if clicking empty space
  deselectCurrent();
}

function selectObject(object: THREE.Mesh | THREE.Line) {
  // Deselect previous visual highlight
  deselectCurrent();

  selectedMesh = object;
  const userData = object.userData as { type: string; data: SystemData | HyperlaneData };
  
  // Update store selection
  mapStore.selectElement({
    type: userData.type as 'system' | 'hyperlane',
    data: userData.data
  });

  // Highlight selected object
  if (userData.type === 'system' && object instanceof THREE.Mesh) {
    object.material = starSelectedMaterial.clone();
    // Animate camera to focus on selected system
    cameraTargetPosition = object.position.clone();
  } else if (userData.type === 'hyperlane' && object instanceof THREE.Line) {
    object.material = hyperlaneSelectedMaterial.clone();
    // Animate camera to focus on hyperlane center
    const hyperlaneData = userData.data as HyperlaneData;
    const fromSystem = mapStore.systems.find(s => s.id === hyperlaneData.from);
    const toSystem = mapStore.systems.find(s => s.id === hyperlaneData.to);
    if (fromSystem && toSystem) {
      cameraTargetPosition = new THREE.Vector3(
        (fromSystem.x + toSystem.x) / 2,
        (fromSystem.y + toSystem.y) / 2,
        ((fromSystem.z ?? 0) + (toSystem.z ?? 0)) / 2
      );
    }
  }
}

function deselectCurrent() {
  if (selectedMesh) {
    const userData = selectedMesh.userData as { type: string; data: SystemData | HyperlaneData };
    
    // Restore original material
    if (userData.type === 'system' && selectedMesh instanceof THREE.Mesh) {
      if (selectedMesh.material instanceof THREE.Material) {
        selectedMesh.material.dispose();
      }
      selectedMesh.material = starMaterial.clone();
    } else if (userData.type === 'hyperlane' && selectedMesh instanceof THREE.Line) {
      if (selectedMesh.material instanceof THREE.Material) {
        selectedMesh.material.dispose();
      }
      const hyperlaneData = userData.data as HyperlaneData;
      selectedMesh.material = hyperlaneData.type === 'add' 
        ? hyperlaneMaterial.clone() 
        : preventHyperlaneMaterial.clone();
    }

    selectedMesh = null;
  }
  
  // Clear store selection
  mapStore.clearSelection();
}

function deleteSelected() {
  const selected = mapStore.selectedElement;
  if (!selected) return;

  if (selected.type === 'system') {
    const system = selected.data as SystemData;
    mapStore.deleteSystem(system.id);
  } else if (selected.type === 'hyperlane') {
    const hyperlane = selected.data as HyperlaneData;
    mapStore.deleteHyperlane(hyperlane.from, hyperlane.to);
  }

  deselectCurrent();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Delete' && mapStore.selectedElement) {
    deleteSelected();
  }
  
  // Camera roll rotation with Q/E keys
  // Rotate the camera's "up" vector around the view direction
  const rollSpeed = 0.05;
  if (event.key === 'q' || event.key === 'Q') {
    // Roll counter-clockwise - rotate up vector around the camera's forward direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    camera.up.applyAxisAngle(forward, rollSpeed);
  } else if (event.key === 'e' || event.key === 'E') {
    // Roll clockwise
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    camera.up.applyAxisAngle(forward, -rollSpeed);
  }
}

function onWindowResize() {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function cleanup() {
  // Cancel animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // Remove event listeners
  if (renderer) {
    renderer.domElement.removeEventListener('click', onCanvasClick);
  }
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);

  // Clear map objects
  clearMapObjects();

  // Dispose shared resources
  starGeometry.dispose();
  starMaterial.dispose();
  starSelectedMaterial.dispose();
  hyperlaneMaterial.dispose();
  hyperlaneSelectedMaterial.dispose();
  preventHyperlaneMaterial.dispose();

  // Dispose controls
  if (controls) {
    controls.dispose();
  }

  // Dispose renderer
  if (renderer) {
    renderer.dispose();
    if (containerRef.value && renderer.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.domElement);
    }
  }
}

// Watch for map version changes to re-render
watch(() => mapStore.version, () => {
  if (scene) {
    renderMap();
  }
});

// Expose deleteSelected for parent component
defineExpose({
  deleteSelected
});

onMounted(() => {
  init();
});

onUnmounted(() => {
  cleanup();
});
</script>

<style scoped>
.galaxy-scene {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}
</style>
