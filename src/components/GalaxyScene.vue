<template>
  <div ref="containerRef" class="galaxy-scene"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useMapStore, type SystemData, type HyperlaneData } from 'src/stores/map-store';

const mapStore = useMapStore();
const containerRef = ref<HTMLDivElement | null>(null);

// ThreeJS objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let animationFrameId: number;

// Clock for animations
const clock = new THREE.Clock();

// Meshes for selection
const systemMeshes: Map<string, THREE.Mesh> = new Map();
const hyperlaneMeshes: Map<string, THREE.Line> = new Map();

// Glow lines for hyperlane hover effect
const hyperlaneGlowMeshes: Map<string, Line2 | THREE.Line> = new Map();
let useLine2 = true; // Will be set to false if Line2 fails

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Selected mesh reference (for visual highlighting)
let selectedMesh: THREE.Mesh | THREE.Line | null = null;

// Hover state
let hoveredMesh: THREE.Mesh | THREE.Line | null = null;
let hoverRing: THREE.Mesh | null = null;
let currentGlowLine: Line2 | THREE.Line | null = null;

// Selection state (separate from hover)
let selectionRing: THREE.Mesh | null = null;
let selectedGlowLine: Line2 | THREE.Line | null = null;

// === CAMERA CONTROL STATE ===
// Camera pivot point (what we rotate around and look at)
const cameraPivot = new THREE.Vector3(0, 0, 0);
// Focus point for selected object (null = use map center)
let focusPoint: THREE.Vector3 | null = null;
// Camera distance from pivot
let cameraDistance = 200;
// Camera rotation angle (in radians, around Z axis)
let cameraRotation = 0;
// Camera tilt angle (how much the camera is tilted from straight down)
let cameraTilt = 0;
// Zoom limits
const minZoom = 20;
const maxZoom = 500;
// Pan speed
const panSpeed = 0.5;
// Rotation speed
const rotationSpeed = 0.005;
// Zoom speed
const zoomSpeed = 15;
// Smooth animation
let targetPivot: THREE.Vector3 | null = null;
const animationSpeed = 0.08;

// Input state
const keysPressed: Set<string> = new Set();
let isRightMouseDown = false;
let isMiddleMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Materials
const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffee });
const starSelectedMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
const hyperlaneMaterial = new THREE.LineBasicMaterial({ color: 0x4488ff, linewidth: 2 });
const hyperlaneSelectedMaterial = new THREE.LineBasicMaterial({ color: 0xff4488, linewidth: 3 });
const preventHyperlaneMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2, opacity: 0.5, transparent: true });

// Geometry (shared)
const starGeometry = new THREE.SphereGeometry(0.8, 12, 12);
const hoverRingGeometry = new THREE.RingGeometry(2.0, 2.5, 32);
const selectionRingGeometry = new THREE.RingGeometry(2.0, 2.5, 32);
const hoverRingMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide
});
const selectionRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xff8800,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide
});

// Procedural glow texture for sprites
function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 245, 1)');
  gradient.addColorStop(0.1, 'rgba(255, 255, 220, 0.8)');
  gradient.addColorStop(0.3, 'rgba(255, 240, 180, 0.4)');
  gradient.addColorStop(0.6, 'rgba(255, 200, 120, 0.1)');
  gradient.addColorStop(1, 'rgba(255, 150, 80, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let starGlowTexture: THREE.Texture;

// Create procedural skybox with stars and distant galaxies
function createSkyboxTexture(faceIndex: number): THREE.Texture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Almost black space background
  ctx.fillStyle = '#000001';
  ctx.fillRect(0, 0, size, size);
  
  // Seed random based on face index for consistent faces
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + faceIndex * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // Draw distant stars (tiny dots)
  for (let i = 0; i < 600; i++) {
    const x = seededRandom(i * 2) * size;
    const y = seededRandom(i * 2 + 1) * size;
    const brightness = 0.15 + seededRandom(i * 3) * 0.35;
    const starSize = 0.2 + seededRandom(i * 4) * 0.4;
    
    // Slight color variation - mostly white with hints of blue/yellow
    const colorVariation = seededRandom(i * 5);
    let r = 255, g = 255, b = 255;
    if (colorVariation < 0.2) {
      // Slight blue tint
      r = 200 + Math.floor(seededRandom(i * 6) * 55);
      g = 220 + Math.floor(seededRandom(i * 7) * 35);
    } else if (colorVariation > 0.8) {
      // Slight yellow/orange tint
      b = 180 + Math.floor(seededRandom(i * 8) * 50);
    }
    
    ctx.beginPath();
    ctx.arc(x, y, starSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
    ctx.fill();
  }
  
  // Draw a few distant galaxies (tiny fuzzy ellipses)
  for (let i = 0; i < 3; i++) {
    const x = seededRandom(i * 10 + 100) * size;
    const y = seededRandom(i * 10 + 101) * size;
    const galaxySize = 3 + seededRandom(i * 10 + 102) * 5;
    const rotation = seededRandom(i * 10 + 103) * Math.PI;
    const elongation = 0.3 + seededRandom(i * 10 + 104) * 0.4;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Galaxy glow
    const galaxyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, galaxySize);
    galaxyGradient.addColorStop(0, 'rgba(180, 170, 220, 0.25)');
    galaxyGradient.addColorStop(0.4, 'rgba(160, 150, 200, 0.1)');
    galaxyGradient.addColorStop(1, 'rgba(140, 130, 180, 0)');
    
    ctx.beginPath();
    ctx.ellipse(0, 0, galaxySize, galaxySize * elongation, 0, 0, Math.PI * 2);
    ctx.fillStyle = galaxyGradient;
    ctx.fill();
    
    ctx.restore();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSkybox(): THREE.Mesh {
  const skyboxSize = 1800;
  const geometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
  
  // Create materials for each face
  const materials = [];
  for (let i = 0; i < 6; i++) {
    const texture = createSkyboxTexture(i);
    materials.push(new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    }));
  }
  
  return new THREE.Mesh(geometry, materials);
}

function init() {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = null; // Use skybox instead of solid color

  // Add skybox
  const skybox = createSkybox();
  scene.add(skybox);

  // Camera - positioned above the XY plane looking down
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
  updateCameraPosition();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  containerRef.value.appendChild(renderer.domElement);

  // Grid helper for reference - GridHelper is on XZ plane by default,
  // but we want it on XY plane (since camera looks down Z axis)
  const gridHelper = new THREE.GridHelper(1000, 50, 0x333333, 0x222222);
  gridHelper.rotation.x = Math.PI / 2; // Rotate 90 degrees to lie on XY plane
  scene.add(gridHelper);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Create reusable hover ring (not added to scene yet)
  hoverRing = new THREE.Mesh(hoverRingGeometry, hoverRingMaterial);
  hoverRing.rotation.x = 0; // Ring lies on XY plane (faces Z axis)

  // Create reusable selection ring (not added to scene yet)
  selectionRing = new THREE.Mesh(selectionRingGeometry, selectionRingMaterial);
  selectionRing.rotation.x = 0;

  // Create star glow texture
  starGlowTexture = createGlowTexture();

  // Add event listeners
  renderer.domElement.addEventListener('click', onCanvasClick);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('wheel', onWheel);
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Initial render of map data
  renderMap();

  // Animation loop
  animate();
}

function updateCameraPosition() {
  // Calculate camera position based on pivot, distance, rotation, and tilt
  const pivot = focusPoint || cameraPivot;
  
  // Camera orbits around the pivot point
  // With rotation = 0 and tilt = 0, camera is directly above looking down
  const x = pivot.x + cameraDistance * Math.sin(cameraTilt) * Math.sin(cameraRotation);
  const y = pivot.y + cameraDistance * Math.sin(cameraTilt) * Math.cos(cameraRotation);
  const z = pivot.z + cameraDistance * Math.cos(cameraTilt);
  
  camera.position.set(x, y, z);
  camera.lookAt(pivot);
  
  // Keep the camera's up vector aligned properly for rotation
  // Calculate the "up" direction based on rotation
  camera.up.set(
    -Math.sin(cameraRotation),
    -Math.cos(cameraRotation),
    0
  ).normalize();
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  // Handle WASD panning
  handleKeyboardPan();
  
  // Animate hover ring pulsing
  if (hoverRing && hoverRing.parent) {
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
    hoverRing.scale.setScalar(pulse);
  }
  
  // Animate selection ring pulsing (slower, different phase)
  if (selectionRing && selectionRing.parent) {
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 3 + 1) * 0.1;
    selectionRing.scale.setScalar(pulse);
  }
  
  // Smooth camera animation to target pivot
  if (targetPivot) {
    const currentPivot = focusPoint || cameraPivot;
    currentPivot.lerp(targetPivot, animationSpeed);
    
    // Check if we're close enough to stop animating
    if (currentPivot.distanceTo(targetPivot) < 0.1) {
      currentPivot.copy(targetPivot);
      targetPivot = null;
    }
    
    if (focusPoint) {
      focusPoint = currentPivot;
    } else {
      cameraPivot.copy(currentPivot);
    }
    updateCameraPosition();
  }
  
  renderer.render(scene, camera);
}

function handleKeyboardPan() {
  if (keysPressed.size === 0) return;
  
  // Pan speed adjusted for zoom level
  const adjustedPanSpeed = panSpeed * (cameraDistance / 100);
  
  // Screen-relative movement (dx = right/left on screen, dy = up/down on screen)
  let screenDx = 0;
  let screenDy = 0;
  
  if (keysPressed.has('w') || keysPressed.has('W')) {
    screenDy -= adjustedPanSpeed; // W = move galaxy up on screen
  }
  if (keysPressed.has('s') || keysPressed.has('S')) {
    screenDy += adjustedPanSpeed; // S = move galaxy down on screen
  }
  if (keysPressed.has('a') || keysPressed.has('A')) {
    screenDx -= adjustedPanSpeed; // A = move view left on screen
  }
  if (keysPressed.has('d') || keysPressed.has('D')) {
    screenDx += adjustedPanSpeed; // D = move view right on screen
  }
  
  if (screenDx !== 0 || screenDy !== 0) {
    // Convert screen movement to world movement by rotating opposite to camera rotation
    // This makes the galaxy move in screen-relative direction
    const worldDx = screenDx * Math.cos(-cameraRotation) - screenDy * Math.sin(-cameraRotation);
    const worldDy = screenDx * Math.sin(-cameraRotation) + screenDy * Math.cos(-cameraRotation);
    
    cameraPivot.x += worldDx;
    cameraPivot.y += worldDy;
    
    // Clear focus when panning
    focusPoint = null;
    updateCameraPosition();
  }
}

function renderMap() {
  // Clear existing objects
  clearMapObjects();

  const systems = mapStore.systems;
  const hyperlanes = mapStore.hyperlanes;

  // Create systems (stars)
  for (const system of systems) {
    // Create star core
    const mesh = new THREE.Mesh(starGeometry, starMaterial.clone());
    mesh.position.set(system.x ?? 0, system.y ?? 0, system.z ?? 0);
    mesh.userData = { type: 'system', data: system };
    scene.add(mesh);
    systemMeshes.set(system.id, mesh);

    // Create star glow sprite
    const glowMaterial = new THREE.SpriteMaterial({
      map: starGlowTexture,
      color: 0xffeedd,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(8, 8, 1);
    glowSprite.position.copy(mesh.position);
    scene.add(glowSprite);
    
    // Store reference to glow sprite on mesh for cleanup
    mesh.userData.glowSprite = glowSprite;
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
      const hyperlaneKey = `${hyperlane.from}-${hyperlane.to}`;
      hyperlaneMeshes.set(hyperlaneKey, line);

      // Create glow line for hover effect (hidden by default)
      const glowColor = hyperlane.type === 'add' ? 0x66ccff : 0xff6666;
      createGlowLine(hyperlaneKey, points, glowColor);
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
    cameraPivot.copy(center);
    cameraDistance = Math.max(100, maxDist * 1.5);
    focusPoint = null;
    updateCameraPosition();
  }
}

function createGlowLine(key: string, points: THREE.Vector3[], color: number) {
  if (points.length < 2 || !points[0] || !points[1]) return;

  if (useLine2) {
    try {
      const lineGeometry = new LineGeometry();
      lineGeometry.setPositions([
        points[0].x, points[0].y, points[0].z,
        points[1].x, points[1].y, points[1].z
      ]);
      const lineMaterial = new LineMaterial({
        color: color,
        linewidth: 4,
        transparent: true,
        opacity: 0.6,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
      });
      const glowLine = new Line2(lineGeometry, lineMaterial);
      glowLine.visible = false;
      scene.add(glowLine);
      hyperlaneGlowMeshes.set(key, glowLine);
      return;
    } catch {
      // Line2 failed, fall back to THREE.Line
      useLine2 = false;
    }
  }

  // Fallback: use regular THREE.Line with brighter color
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8
  });
  const glowLine = new THREE.Line(geometry, material);
  glowLine.visible = false;
  scene.add(glowLine);
  hyperlaneGlowMeshes.set(key, glowLine);
}

function clearMapObjects() {
  // Clear hover state
  clearHover();
  
  // Clear selection visual state
  clearSelectionVisuals();
  
  // Dispose and remove all system meshes
  for (const mesh of systemMeshes.values()) {
    // Dispose glow sprite
    const glowSprite = mesh.userData.glowSprite as THREE.Sprite | undefined;
    if (glowSprite) {
      if (glowSprite.material instanceof THREE.SpriteMaterial) {
        glowSprite.material.dispose();
      }
      scene.remove(glowSprite);
    }
    
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

  // Dispose and remove all glow lines
  for (const line of hyperlaneGlowMeshes.values()) {
    line.geometry.dispose();
    if (line.material instanceof THREE.Material) {
      line.material.dispose();
    } else if (Array.isArray(line.material)) {
      line.material.forEach(m => m.dispose());
    }
    scene.remove(line);
  }
  hyperlaneGlowMeshes.clear();
}

function onCanvasClick(event: MouseEvent) {
  if (!containerRef.value || !renderer) return;
  
  // Ignore if we were dragging
  if (isRightMouseDown || isMiddleMouseDown) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  // Scale threshold based on camera distance for better selection at any zoom level
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

  // Deselect and unfocus if clicking empty space
  deselectCurrent();
  focusPoint = null;
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

  // Highlight selected object and set focus point
  if (userData.type === 'system' && object instanceof THREE.Mesh) {
    object.material = starSelectedMaterial.clone();
    // Show selection ring
    showSelectionRing(object);
    // Set focus point and animate camera to it
    focusPoint = object.position.clone();
    targetPivot = object.position.clone();
  } else if (userData.type === 'hyperlane' && object instanceof THREE.Line) {
    object.material = hyperlaneSelectedMaterial.clone();
    // Show selection glow
    showSelectionGlow(object);
    // Set focus point to hyperlane center
    const hyperlaneData = userData.data as HyperlaneData;
    const fromSystem = mapStore.systems.find(s => s.id === hyperlaneData.from);
    const toSystem = mapStore.systems.find(s => s.id === hyperlaneData.to);
    if (fromSystem && toSystem) {
      const center = new THREE.Vector3(
        (fromSystem.x + toSystem.x) / 2,
        (fromSystem.y + toSystem.y) / 2,
        ((fromSystem.z ?? 0) + (toSystem.z ?? 0)) / 2
      );
      focusPoint = center;
      targetPivot = center.clone();
    }
  }
}

function showSelectionRing(mesh: THREE.Mesh) {
  if (!selectionRing) return;
  
  selectionRing.position.copy(mesh.position);
  selectionRing.position.z += 0.15; // Slightly above hover ring
  scene.add(selectionRing);
}

function showSelectionGlow(line: THREE.Line) {
  const userData = line.userData as { type: string; data: HyperlaneData };
  const hyperlaneData = userData.data;
  const key = `${hyperlaneData.from}-${hyperlaneData.to}`;
  
  const glowLine = hyperlaneGlowMeshes.get(key);
  if (glowLine) {
    glowLine.visible = true;
    selectedGlowLine = glowLine;
  }
}

function clearSelectionVisuals() {
  // Remove selection ring from scene
  if (selectionRing && selectionRing.parent) {
    scene.remove(selectionRing);
  }
  
  // Hide selected glow line
  if (selectedGlowLine) {
    selectedGlowLine.visible = false;
    selectedGlowLine = null;
  }
}

function deselectCurrent() {
  // Clear selection visuals
  clearSelectionVisuals();
  
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
  focusPoint = null;
}

// === INPUT HANDLERS ===

function onMouseDown(event: MouseEvent) {
  if (event.button === 1) {
    // Middle mouse button - pan
    isMiddleMouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    event.preventDefault();
  } else if (event.button === 2) {
    // Right mouse button - rotate
    isRightMouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    event.preventDefault();
  }
}

function onMouseUp(event: MouseEvent) {
  if (event.button === 1) {
    isMiddleMouseDown = false;
  } else if (event.button === 2) {
    isRightMouseDown = false;
  }
}

function onMouseMove(event: MouseEvent) {
  const deltaX = event.clientX - lastMouseX;
  const deltaY = event.clientY - lastMouseY;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  
  if (isMiddleMouseDown) {
    // Pan with middle mouse
    const adjustedPanSpeed = 0.5 * (cameraDistance / 100);
    
    // Rotate the pan direction by camera rotation
    const dx = -deltaX * adjustedPanSpeed;
    const dy = deltaY * adjustedPanSpeed;
    
    const rotatedDx = dx * Math.cos(cameraRotation) - dy * Math.sin(cameraRotation);
    const rotatedDy = dx * Math.sin(cameraRotation) + dy * Math.cos(cameraRotation);
    
    cameraPivot.x += rotatedDx;
    cameraPivot.y += rotatedDy;
    
    // Clear focus when panning
    focusPoint = null;
    updateCameraPosition();
  } else if (isRightMouseDown) {
    // Rotate with right mouse
    cameraRotation += deltaX * rotationSpeed;
    cameraTilt = Math.max(0, Math.min(Math.PI / 3, cameraTilt - deltaY * rotationSpeed));
    updateCameraPosition();
  } else {
    // Hover detection when not dragging
    updateHover(event);
  }
}

function updateHover(event: MouseEvent) {
  if (!containerRef.value || !renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const scaledThreshold = Math.max(2, cameraDistance * 0.02);

  // Check systems first
  const systemObjects = Array.from(systemMeshes.values());
  const systemIntersects = raycaster.intersectObjects(systemObjects);

  if (systemIntersects.length > 0 && systemIntersects[0]) {
    const hitObject = systemIntersects[0].object as THREE.Mesh;
    if (hitObject !== hoveredMesh && hitObject !== selectedMesh) {
      clearHover();
      hoveredMesh = hitObject;
      showSystemHover(hitObject);
    }
    return;
  }

  // Check hyperlanes
  const hyperlaneObjects = Array.from(hyperlaneMeshes.values());
  raycaster.params.Line = { threshold: scaledThreshold };
  const hyperlaneIntersects = raycaster.intersectObjects(hyperlaneObjects);

  if (hyperlaneIntersects.length > 0 && hyperlaneIntersects[0]) {
    const hitObject = hyperlaneIntersects[0].object as THREE.Line;
    if (hitObject !== hoveredMesh && hitObject !== selectedMesh) {
      clearHover();
      hoveredMesh = hitObject;
      showHyperlaneHover(hitObject);
    }
    return;
  }

  // Nothing hovered
  if (hoveredMesh) {
    clearHover();
  }
}

function showSystemHover(mesh: THREE.Mesh) {
  if (!hoverRing) return;
  
  // Position ring at system location
  hoverRing.position.copy(mesh.position);
  hoverRing.position.z += 0.1; // Slightly above to avoid z-fighting
  scene.add(hoverRing);
}

function showHyperlaneHover(line: THREE.Line) {
  const userData = line.userData as { type: string; data: HyperlaneData };
  const hyperlaneData = userData.data;
  const key = `${hyperlaneData.from}-${hyperlaneData.to}`;
  
  const glowLine = hyperlaneGlowMeshes.get(key);
  if (glowLine) {
    glowLine.visible = true;
    currentGlowLine = glowLine;
  }
}

function clearHover() {
  hoveredMesh = null;
  
  // Remove hover ring from scene
  if (hoverRing && hoverRing.parent) {
    scene.remove(hoverRing);
  }
  
  // Hide current glow line
  if (currentGlowLine) {
    currentGlowLine.visible = false;
    currentGlowLine = null;
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  
  // Zoom in/out
  const zoomDelta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
  cameraDistance = Math.max(minZoom, Math.min(maxZoom, cameraDistance + zoomDelta));
  updateCameraPosition();
}

function onKeyDown(event: KeyboardEvent) {
  keysPressed.add(event.key);
  
  // Delete selected
  if (event.key === 'Delete' && mapStore.selectedElement) {
    deleteSelected();
  }
  
  // Reset camera rotation
  if (event.key === 'r' || event.key === 'R') {
    cameraRotation = 0;
    cameraTilt = 0;
    updateCameraPosition();
  }
  
  // Zoom with Page Up/Down
  if (event.key === 'PageUp') {
    cameraDistance = Math.max(minZoom, cameraDistance - zoomSpeed * 2);
    updateCameraPosition();
    event.preventDefault();
  } else if (event.key === 'PageDown') {
    cameraDistance = Math.min(maxZoom, cameraDistance + zoomSpeed * 2);
    updateCameraPosition();
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent) {
  keysPressed.delete(event.key);
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
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('wheel', onWheel);
  }
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);

  // Clear map objects
  clearMapObjects();

  // Dispose shared resources
  starGeometry.dispose();
  starMaterial.dispose();
  starSelectedMaterial.dispose();
  hyperlaneMaterial.dispose();
  hyperlaneSelectedMaterial.dispose();
  preventHyperlaneMaterial.dispose();
  hoverRingGeometry.dispose();
  hoverRingMaterial.dispose();
  selectionRingGeometry.dispose();
  selectionRingMaterial.dispose();
  if (starGlowTexture) {
    starGlowTexture.dispose();
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
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.galaxy-scene :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
</style>
