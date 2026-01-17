<template>
  <div ref="containerRef" :class="['galaxy-scene', cursorClass, { 'resizing-nebula': isAdjustingNebulaRadius }]"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useMapStore, type SystemData, type HyperlaneData, type NebulaData } from 'src/stores/map-store';
import { useToolsStore } from 'src/stores/tools-store';

const emit = defineEmits<{
  (e: 'duplicateWarning', message: string): void;
}>();

const mapStore = useMapStore();
const toolsStore = useToolsStore();
const containerRef = ref<HTMLDivElement | null>(null);

// Cursor class based on current tool
const cursorClass = computed(() => `tool-${toolsStore.currentTool}`);

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

// Nebula meshes
interface NebulaMeshData {
  cloud: THREE.Sprite;
  circle: THREE.Line;
  glowCircle: Line2 | THREE.Line;
}
const nebulaMeshes: Map<string, NebulaMeshData> = new Map();

// Dynamic range meshes for systems with dynamic coordinates
interface DynamicRangeMeshData {
  rangeMesh: THREE.Mesh;
  wireframe: THREE.LineSegments;
  glowSprite: THREE.Sprite;
  targetScale: THREE.Vector3;
  targetPosition: THREE.Vector3;
  currentScale: THREE.Vector3;
  currentPosition: THREE.Vector3;
  transitionProgress: number;
}
const dynamicRangeMeshes: Map<string, DynamicRangeMeshData> = new Map();

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
let selectedNebulaGlowCircle: Line2 | THREE.Line | null = null;

// Nebula hover state
let hoveredNebulaGlowCircle: Line2 | THREE.Line | null = null;

// === HYPERLANE CREATION STATE ===
// Preview line for hyperlane creation (from first system to mouse)
let hyperlanePreviewLine: THREE.Line | null = null;
const hyperlanePreviewMaterial = new THREE.LineBasicMaterial({
  color: 0x00bcd4, // Cyan
  transparent: true,
  opacity: 0.7,
  linewidth: 2
});
// First system highlight ring (cyan, for hyperlane creation)
let firstSystemRing: THREE.Mesh | null = null;
const firstSystemRingGeometry = new THREE.RingGeometry(2.2, 2.8, 32);
const firstSystemRingMaterial = new THREE.MeshBasicMaterial({
  color: 0x00bcd4, // Cyan
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide
});
// Store the first system's position for preview line
let firstSystemPosition: THREE.Vector3 | null = null;
// Current mouse world position for preview line
const currentMouseWorldPos: THREE.Vector3 = new THREE.Vector3();

// === ADD SYSTEM/NEBULA PREVIEW STATE ===
// Preview meshes for add system mode
let systemPreviewMesh: THREE.Mesh | null = null;
let systemPreviewGlow: THREE.Sprite | null = null;
// Preview meshes for add nebula mode
let nebulaPreviewCloud: THREE.Sprite | null = null;
let nebulaPreviewCircle: THREE.Line | null = null;
// Nebula radius adjustment state
let isAdjustingNebulaRadius = false;
let nebulaPlacementCenter: THREE.Vector3 | null = null;
let currentNebulaRadius = 5; // Default radius
const minNebulaRadius = 1;
const maxNebulaRadius = 500;

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

// Nebula materials
const nebulaCircleMaterial = new THREE.LineBasicMaterial({ 
  color: 0x8855aa, 
  transparent: true, 
  opacity: 0.5 
});

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

// Simple seeded random for consistent nebula noise
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Simple 2D noise function for nebula texture
function noise2D(x: number, y: number, seed: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  
  // Get values at grid corners
  const n00 = seededRandom(i + j * 57 + seed);
  const n10 = seededRandom((i + 1) + j * 57 + seed);
  const n01 = seededRandom(i + (j + 1) * 57 + seed);
  const n11 = seededRandom((i + 1) + (j + 1) * 57 + seed);
  
  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return nx0 * (1 - sy) + nx1 * sy;
}

// Fractal Brownian Motion for more natural noise
function fbm(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency, seed + i * 100);
    amplitude *= 0.5;
    frequency *= 2;
  }
  
  return value;
}

// Create procedural nebula texture with noise
function createNebulaTexture(seed: number): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Clear with transparent
  ctx.clearRect(0, 0, size, size);
  
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size / 2;
  
  // Color palette for nebula (purple/magenta/blue)
  const baseHue = 260 + seededRandom(seed * 7) * 60; // 260-320 (purple to magenta)
  
  // Create image data for pixel manipulation
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = dist / maxRadius;
      
      // Get noise value for this pixel
      const noiseScale = 3;
      const noiseVal = fbm(x / size * noiseScale, y / size * noiseScale, seed, 4);
      
      // Vary the edge radius with noise for irregular shape
      const angleNoise = fbm(Math.atan2(dy, dx) * 2 + seed, dist / maxRadius, seed + 50, 3);
      const edgeRadius = 0.7 + angleNoise * 0.4;
      
      // Calculate alpha based on distance with noise variation
      let alpha = 0;
      if (normalizedDist < edgeRadius) {
        // Soft falloff from center
        const falloff = 1 - (normalizedDist / edgeRadius);
        alpha = falloff * falloff * (0.3 + noiseVal * 0.4);
        
        // Add some wisps/tendrils
        const wispNoise = fbm(x / size * 8, y / size * 8, seed + 200, 3);
        if (wispNoise > 0.6) {
          alpha += (wispNoise - 0.6) * 0.3;
        }
      }
      
      // Clamp alpha
      alpha = Math.min(0.6, Math.max(0, alpha));
      
      // Color with slight variation
      const hueShift = (noiseVal - 0.5) * 30;
      const hue = baseHue + hueShift;
      const saturation = 60 + noiseVal * 30;
      const lightness = 40 + noiseVal * 30;
      
      // Convert HSL to RGB
      const c = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
      const hueNorm = hue / 60;
      const xVal = c * (1 - Math.abs(hueNorm % 2 - 1));
      const m = lightness / 100 - c / 2;
      
      let r = 0, g = 0, b = 0;
      if (hueNorm >= 0 && hueNorm < 1) { r = c; g = xVal; b = 0; }
      else if (hueNorm >= 1 && hueNorm < 2) { r = xVal; g = c; b = 0; }
      else if (hueNorm >= 2 && hueNorm < 3) { r = 0; g = c; b = xVal; }
      else if (hueNorm >= 3 && hueNorm < 4) { r = 0; g = xVal; b = c; }
      else if (hueNorm >= 4 && hueNorm < 5) { r = xVal; g = 0; b = c; }
      else { r = c; g = 0; b = xVal; }
      
      const idx = (y * size + x) * 4;
      data[idx] = Math.floor((r + m) * 255);
      data[idx + 1] = Math.floor((g + m) * 255);
      data[idx + 2] = Math.floor((b + m) * 255);
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

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

  // Create first system ring for hyperlane creation (cyan)
  firstSystemRing = new THREE.Mesh(firstSystemRingGeometry, firstSystemRingMaterial);
  firstSystemRing.rotation.x = 0;

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
  
  // Set the camera's up vector BEFORE lookAt to prevent wobbling
  // Calculate the "up" direction based on rotation
  camera.up.set(
    -Math.sin(cameraRotation),
    -Math.cos(cameraRotation),
    0
  );
  
  camera.lookAt(pivot);
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
  
  // Animate dynamic range mesh transitions
  const deltaTime = clock.getDelta();
  for (const meshData of dynamicRangeMeshes.values()) {
    if (meshData.transitionProgress < 1) {
      // Advance transition progress (300ms duration)
      meshData.transitionProgress = Math.min(1, meshData.transitionProgress + deltaTime / 0.3);
      
      // Ease-in-out function
      const t = meshData.transitionProgress;
      const easedT = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      
      // Interpolate position
      meshData.rangeMesh.position.lerpVectors(
        meshData.currentPosition,
        meshData.targetPosition,
        easedT
      );
      meshData.wireframe.position.copy(meshData.rangeMesh.position);
      // glowSprite is not in scene, no need to update position
      
      // Interpolate scale
      meshData.rangeMesh.scale.lerpVectors(
        meshData.currentScale,
        meshData.targetScale,
        easedT
      );
      meshData.wireframe.scale.copy(meshData.rangeMesh.scale);
      
      // No glow sprite scale update needed
    }
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
    screenDx += adjustedPanSpeed; // A = move view right on screen
  }
  if (keysPressed.has('d') || keysPressed.has('D')) {
    screenDx -= adjustedPanSpeed; // D = move view left on screen
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
  const nebulae = mapStore.nebulae;

  // Create nebulae first (rendered behind everything)
  for (const nebula of nebulae) {
    createNebula(nebula);
  }

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
    
    // Create dynamic range visualization if system has dynamic coordinates
    createDynamicRangeVisualization(system);
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

  // Center camera on the map only on initial load (when camera hasn't been moved)
  if (systems.length > 0 && cameraDistance === 200 && cameraPivot.length() === 0) {
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

function createNebula(nebula: NebulaData) {
  // Clamp z position to map limits
  const clampedZ = Math.max(-5, Math.min(5, nebula.z));
  const position = new THREE.Vector3(nebula.x, nebula.y, clampedZ - 0.5); // Slightly behind stars
  
  // Create cloud sprite with procedural texture
  const seed = hashString(nebula.name);
  const nebulaTexture = createNebulaTexture(seed);
  const cloudMaterial = new THREE.SpriteMaterial({
    map: nebulaTexture,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false
  });
  const cloud = new THREE.Sprite(cloudMaterial);
  cloud.position.copy(position);
  // Scale to fill the radius circle (X and Y match radius, Z position already clamped)
  const scale = nebula.radius * 3.2;
  cloud.scale.set(scale, scale, 1);
  cloud.renderOrder = -1; // Render behind other objects
  scene.add(cloud);
  
  // Create radius circle using EllipseCurve
  const circlePoints: THREE.Vector3[] = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(
      nebula.x + Math.cos(angle) * nebula.radius,
      nebula.y + Math.sin(angle) * nebula.radius,
      clampedZ - 0.3
    ));
  }
  
  const circleGeometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
  const circle = new THREE.Line(circleGeometry, nebulaCircleMaterial.clone());
  circle.userData = { type: 'nebula', data: nebula };
  scene.add(circle);
  
  // Create glow circle for hover/selection effect (hidden by default)
  const glowCircle = createNebulaGlowCircle(nebula, circlePoints);
  
  nebulaMeshes.set(nebula.name, { cloud, circle, glowCircle });
}

function createNebulaGlowCircle(nebula: NebulaData, points: THREE.Vector3[]): Line2 | THREE.Line {
  if (useLine2) {
    try {
      const positions: number[] = [];
      for (const p of points) {
        positions.push(p.x, p.y, p.z);
      }
      const lineGeometry = new LineGeometry();
      lineGeometry.setPositions(positions);
      const lineMaterial = new LineMaterial({
        color: 0x00ffff, // Cyan for hover, will be changed on selection
        linewidth: 3,
        transparent: true,
        opacity: 0.7,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
      });
      const glowCircle = new Line2(lineGeometry, lineMaterial);
      glowCircle.visible = false;
      scene.add(glowCircle);
      return glowCircle;
    } catch {
      // Fall through to regular Line
    }
  }
  
  // Fallback
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.8
  });
  const glowCircle = new THREE.Line(geometry, material);
  glowCircle.visible = false;
  scene.add(glowCircle);
  return glowCircle;
}

// Simple string hash function for consistent nebula seeds
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function createDynamicRangeVisualization(system: SystemData) {
  // Count how many axes are dynamic
  const dynamicCount = (system.isDynamicX ? 1 : 0) + (system.isDynamicY ? 1 : 0) + (system.isDynamicZ ? 1 : 0);
  
  // Remove existing visualization if present
  const existing = dynamicRangeMeshes.get(system.id);
  if (existing) {
    scene.remove(existing.rangeMesh);
    scene.remove(existing.wireframe);
    // glowSprite not in scene, no need to remove
    existing.rangeMesh.geometry.dispose();
    if (Array.isArray(existing.rangeMesh.material)) {
      existing.rangeMesh.material.forEach(m => m.dispose());
    } else {
      existing.rangeMesh.material.dispose();
    }
    existing.wireframe.geometry.dispose();
    if (Array.isArray(existing.wireframe.material)) {
      existing.wireframe.material.forEach(m => m.dispose());
    } else {
      existing.wireframe.material.dispose();
    }
    // glowSprite material disposal not needed (dummy sprite)
    dynamicRangeMeshes.delete(system.id);
  }
  
  // Only create if at least one axis is dynamic
  if (dynamicCount === 0) return;
  
  // Calculate ranges and center position
  const xMin = system.xMin ?? system.x;
  const xMax = system.xMax ?? system.x;
  const yMin = system.yMin ?? system.y;
  const yMax = system.yMax ?? system.y;
  const zMin = system.zMin ?? system.z;
  const zMax = system.zMax ?? system.z;
  
  const centerX = (xMin + xMax) / 2;
  const centerY = (yMin + yMax) / 2;
  const centerZ = (zMin + zMax) / 2;
  
  const rangeX = xMax - xMin;
  const rangeY = yMax - yMin;
  const rangeZ = zMax - zMin;
  
  // Create geometry based on number of dynamic axes
  let geometry: THREE.BufferGeometry;
  
  if (dynamicCount === 1) {
    // 1D line: use cylinder along the dynamic axis
    const length = system.isDynamicX ? rangeX : (system.isDynamicY ? rangeY : rangeZ);
    geometry = new THREE.CylinderGeometry(0.2, 0.2, length, 8);
    
    // Rotate to align with the correct axis
    if (system.isDynamicX) {
      geometry.rotateZ(Math.PI / 2);
    } else if (system.isDynamicZ) {
      geometry.rotateX(Math.PI / 2);
    }
    // Y axis is already aligned correctly
  } else if (dynamicCount === 2) {
    // 2D plane: use thin box
    const thickness = 0.2;
    if (!system.isDynamicX) {
      // YZ plane
      geometry = new THREE.BoxGeometry(thickness, rangeY, rangeZ);
    } else if (!system.isDynamicY) {
      // XZ plane
      geometry = new THREE.BoxGeometry(rangeX, thickness, rangeZ);
    } else {
      // XY plane
      geometry = new THREE.BoxGeometry(rangeX, rangeY, thickness);
    }
  } else {
    // 3D box
    geometry = new THREE.BoxGeometry(rangeX, rangeY, rangeZ);
  }
  
  // Create mesh with cyan semi-transparent material
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ddff,
    transparent: true,
    opacity: 0.1,
    depthWrite: false
  });
  
  const rangeMesh = new THREE.Mesh(geometry, material);
  rangeMesh.position.set(centerX, centerY, centerZ);
  
  // Override raycast to make it non-interactive (clicks pass through)
  rangeMesh.raycast = () => {};
  
  scene.add(rangeMesh);
  
  // Create wireframe edges
  const edges = new THREE.EdgesGeometry(geometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x00ddff,
    transparent: true,
    opacity: 0.25
  });
  const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
  wireframe.position.copy(rangeMesh.position);
  wireframe.raycast = () => {}; // Also non-interactive
  scene.add(wireframe);
  
  // Store mesh data with transition properties
  const targetPosition = new THREE.Vector3(centerX, centerY, centerZ);
  const targetScale = new THREE.Vector3(1, 1, 1);
  
  // Create a dummy glow sprite for compatibility (not added to scene)
  const dummyGlowSprite = new THREE.Sprite();
  
  dynamicRangeMeshes.set(system.id, {
    rangeMesh,
    wireframe,
    glowSprite: dummyGlowSprite,
    targetPosition,
    targetScale,
    currentPosition: targetPosition.clone(),
    currentScale: targetScale.clone(),
    transitionProgress: 1 // Start fully visible
  });
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
  
  // Dispose and remove all dynamic range meshes
  for (const meshData of dynamicRangeMeshes.values()) {
    scene.remove(meshData.rangeMesh);
    scene.remove(meshData.wireframe);
    // glowSprite is not added to scene, no need to remove
    
    meshData.rangeMesh.geometry.dispose();
    if (Array.isArray(meshData.rangeMesh.material)) {
      meshData.rangeMesh.material.forEach(m => m.dispose());
    } else {
      meshData.rangeMesh.material.dispose();
    }
    
    meshData.wireframe.geometry.dispose();
    if (Array.isArray(meshData.wireframe.material)) {
      meshData.wireframe.material.forEach(m => m.dispose());
    } else {
      meshData.wireframe.material.dispose();
    }
    
    // glowSprite material disposal not needed (dummy sprite)
  }
  dynamicRangeMeshes.clear();

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

  // Dispose and remove all nebula meshes
  for (const nebulaData of nebulaMeshes.values()) {
    // Dispose cloud sprite
    if (nebulaData.cloud.material instanceof THREE.SpriteMaterial) {
      if (nebulaData.cloud.material.map) {
        nebulaData.cloud.material.map.dispose();
      }
      nebulaData.cloud.material.dispose();
    }
    scene.remove(nebulaData.cloud);
    
    // Dispose circle
    nebulaData.circle.geometry.dispose();
    if (nebulaData.circle.material instanceof THREE.Material) {
      nebulaData.circle.material.dispose();
    }
    scene.remove(nebulaData.circle);
    
    // Dispose glow circle
    nebulaData.glowCircle.geometry.dispose();
    if (nebulaData.glowCircle.material instanceof THREE.Material) {
      nebulaData.glowCircle.material.dispose();
    } else if (Array.isArray(nebulaData.glowCircle.material)) {
      nebulaData.glowCircle.material.forEach(m => m.dispose());
    }
    scene.remove(nebulaData.glowCircle);
  }
  nebulaMeshes.clear();
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

  // Handle different tool modes
  if (toolsStore.isSelectMode) {
    handleSelectModeClick(scaledThreshold);
  } else if (toolsStore.isAddSystemMode) {
    handleAddSystemClick();
  } else if (toolsStore.isHyperlaneMode) {
    handleHyperlaneModeClick();
  }
  // Note: addNebula mode handled by mouse down/up for radius adjustment
}

/**
 * Get world position from mouse click by raycasting to the XY plane (z=0)
 */
function getWorldPositionFromMouse(): THREE.Vector3 | null {
  // Create a plane at z=0
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  
  const ray = raycaster.ray;
  if (ray.intersectPlane(plane, intersection)) {
    return intersection;
  }
  return null;
}

/**
 * Handle click in select mode - select systems, hyperlanes, or nebulae
 */
function handleSelectModeClick(scaledThreshold: number) {
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

  // Check nebula circles with scaled threshold
  const nebulaCircleObjects = Array.from(nebulaMeshes.values()).map(n => n.circle);
  // Use a larger threshold for nebulae to account for potentially very large circles
  raycaster.params.Line = { threshold: Math.max(5, scaledThreshold * 2) };
  const nebulaIntersects = raycaster.intersectObjects(nebulaCircleObjects);

  if (nebulaIntersects.length > 0 && nebulaIntersects[0]) {
    selectObject(nebulaIntersects[0].object as THREE.Line);
    return;
  }

  // Deselect and unfocus if clicking empty space
  deselectCurrent();
  focusPoint = null;
}

/**
 * Handle click in add system mode - add a new system at click position
 */
function handleAddSystemClick() {
  const worldPos = getWorldPositionFromMouse();
  if (!worldPos) return;

  // Round to reasonable precision
  const x = Math.round(worldPos.x);
  const y = Math.round(worldPos.y);
  const z = 0;

  const result = mapStore.addSystem(x, y, z);
  if (!result.success && result.error) {
    emit('duplicateWarning', result.error);
  }
}

/**
 * Start nebula placement - begin radius adjustment
 */
function startNebulaPlacement() {
  const worldPos = getWorldPositionFromMouse();
  if (!worldPos) return;

  // Round to reasonable precision
  const x = Math.round(worldPos.x);
  const y = Math.round(worldPos.y);
  const z = 0;

  // Store placement center and enter radius adjustment mode
  nebulaPlacementCenter = new THREE.Vector3(x, y, z);
  currentNebulaRadius = 5; // Reset to default
  isAdjustingNebulaRadius = true;
  
  // Create preview if it doesn't exist
  if (!nebulaPreviewCloud) {
    createNebulaPreviewMesh();
  }
}

/**
 * Finish nebula placement - add nebula with chosen radius
 */
function finishNebulaPlacement() {
  if (!isAdjustingNebulaRadius || !nebulaPlacementCenter) return;
  
  const result = mapStore.addNebula(
    nebulaPlacementCenter.x,
    nebulaPlacementCenter.y,
    nebulaPlacementCenter.z,
    currentNebulaRadius
  );
  
  if (!result.success && result.error) {
    emit('duplicateWarning', result.error);
  }
  
  // Reset state
  isAdjustingNebulaRadius = false;
  nebulaPlacementCenter = null;
  currentNebulaRadius = 5; // Reset to default for next placement
}

/**
 * Handle click in hyperlane mode - select systems to connect
 */
function handleHyperlaneModeClick() {
  // Only check for system clicks in hyperlane mode
  const systemObjects = Array.from(systemMeshes.values());
  const systemIntersects = raycaster.intersectObjects(systemObjects);

  if (systemIntersects.length > 0 && systemIntersects[0]) {
    const hitMesh = systemIntersects[0].object as THREE.Mesh;
    const userData = hitMesh.userData as { type: string; data: SystemData };
    const systemId = userData.data.id;

    if (toolsStore.hyperlaneFirstSystemId === null) {
      // First system selection
      toolsStore.setHyperlaneFirstSystem(systemId);
      firstSystemPosition = hitMesh.position.clone();
      showFirstSystemRing(hitMesh);
      createHyperlanePreviewLine(hitMesh.position);
    } else if (toolsStore.hyperlaneFirstSystemId !== systemId) {
      // Second system selection - create the hyperlane
      const type = toolsStore.isAddHyperlaneMode ? 'add' : 'prevent';
      const result = mapStore.addHyperlane(toolsStore.hyperlaneFirstSystemId, systemId, type);
      
      if (!result.success && result.error) {
        emit('duplicateWarning', result.error);
      }
      
      // Clear hyperlane creation state
      clearHyperlaneCreationState();
    }
    // If clicking the same system, do nothing (user can press Escape to cancel)
    return;
  }

  // Clicking empty space in hyperlane mode - do nothing (don't cancel)
}

/**
 * Show the first system ring for hyperlane creation
 */
function showFirstSystemRing(mesh: THREE.Mesh) {
  if (!firstSystemRing) return;
  
  firstSystemRing.position.copy(mesh.position);
  firstSystemRing.position.z += 0.2; // Above selection ring
  scene.add(firstSystemRing);
}

/**
 * Create the preview line for hyperlane creation
 */
function createHyperlanePreviewLine(fromPosition: THREE.Vector3) {
  // Remove existing preview line
  if (hyperlanePreviewLine) {
    scene.remove(hyperlanePreviewLine);
    hyperlanePreviewLine.geometry.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    fromPosition.x, fromPosition.y, fromPosition.z,
    fromPosition.x, fromPosition.y, fromPosition.z
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  hyperlanePreviewLine = new THREE.Line(geometry, hyperlanePreviewMaterial);
  scene.add(hyperlanePreviewLine);
}

/**
 * Update the preview line endpoint to follow the mouse
 */
function updateHyperlanePreviewLine() {
  if (!hyperlanePreviewLine || !firstSystemPosition) return;

  const positionAttr = hyperlanePreviewLine.geometry.attributes.position;
  if (!positionAttr) return;
  
  const positions = positionAttr.array as Float32Array;
  positions[3] = currentMouseWorldPos.x;
  positions[4] = currentMouseWorldPos.y;
  positions[5] = currentMouseWorldPos.z;
  positionAttr.needsUpdate = true;
}

/**
 * Clear hyperlane creation state (preview line and first system ring)
 */
function clearHyperlaneCreationState() {
  toolsStore.clearHyperlaneSelection();
  firstSystemPosition = null;

  // Remove first system ring
  if (firstSystemRing && firstSystemRing.parent) {
    scene.remove(firstSystemRing);
  }

  // Remove preview line
  if (hyperlanePreviewLine) {
    scene.remove(hyperlanePreviewLine);
    hyperlanePreviewLine.geometry.dispose();
    hyperlanePreviewLine = null;
  }
}

/**
 * Create preview mesh for add system mode
 */
function createSystemPreviewMesh() {
  if (systemPreviewMesh) return; // Already created
  
  // Create semi-transparent star core
  systemPreviewMesh = new THREE.Mesh(starGeometry, starMaterial.clone());
  if (systemPreviewMesh.material instanceof THREE.Material) {
    systemPreviewMesh.material.transparent = true;
    systemPreviewMesh.material.opacity = 0.75;
  }
  scene.add(systemPreviewMesh);
  
  // Create semi-transparent glow sprite
  const glowMaterial = new THREE.SpriteMaterial({
    map: starGlowTexture,
    color: 0xffeedd,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.75
  });
  systemPreviewGlow = new THREE.Sprite(glowMaterial);
  systemPreviewGlow.scale.set(8, 8, 1);
  scene.add(systemPreviewGlow);
}

/**
 * Update system preview position to follow mouse
 */
function updateSystemPreviewPosition() {
  if (!systemPreviewMesh || !systemPreviewGlow) return;
  
  const roundedPos = new THREE.Vector3(
    Math.round(currentMouseWorldPos.x),
    Math.round(currentMouseWorldPos.y),
    0
  );
  
  systemPreviewMesh.position.copy(roundedPos);
  systemPreviewGlow.position.copy(roundedPos);
}

/**
 * Clear system preview meshes
 */
function clearSystemPreview() {
  if (systemPreviewMesh) {
    scene.remove(systemPreviewMesh);
    if (systemPreviewMesh.material instanceof THREE.Material) {
      systemPreviewMesh.material.dispose();
    }
    systemPreviewMesh = null;
  }
  
  if (systemPreviewGlow) {
    scene.remove(systemPreviewGlow);
    if (systemPreviewGlow.material instanceof THREE.SpriteMaterial) {
      systemPreviewGlow.material.dispose();
    }
    systemPreviewGlow = null;
  }
}

/**
 * Create preview mesh for add nebula mode
 */
function createNebulaPreviewMesh() {
  if (nebulaPreviewCloud) return; // Already created
  
  const radius = currentNebulaRadius;
  
  // Create semi-transparent cloud sprite
  const seed = Math.random() * 1000;
  const nebulaTexture = createNebulaTexture(seed);
  const cloudMaterial = new THREE.SpriteMaterial({
    map: nebulaTexture,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    opacity: 0.75
  });
  nebulaPreviewCloud = new THREE.Sprite(cloudMaterial);
  const scale = radius * 3.2;
  nebulaPreviewCloud.scale.set(scale, scale, 1);
  nebulaPreviewCloud.renderOrder = -1;
  scene.add(nebulaPreviewCloud);
  
  // Create semi-transparent radius circle
  updateNebulaPreviewCircle(radius);
}

/**
 * Update or create the nebula preview circle with given radius
 */
function updateNebulaPreviewCircle(radius: number) {
  // Remove old circle if it exists
  if (nebulaPreviewCircle) {
    scene.remove(nebulaPreviewCircle);
    nebulaPreviewCircle.geometry.dispose();
    if (nebulaPreviewCircle.material instanceof THREE.Material) {
      nebulaPreviewCircle.material.dispose();
    }
  }
  
  // Create new circle with updated radius
  const circlePoints: THREE.Vector3[] = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0
    ));
  }
  
  const circleGeometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
  const circleMaterial = nebulaCircleMaterial.clone();
  circleMaterial.transparent = true;
  circleMaterial.opacity = 0.75;
  nebulaPreviewCircle = new THREE.Line(circleGeometry, circleMaterial);
  scene.add(nebulaPreviewCircle);
}

/**
 * Update nebula preview position to follow mouse
 */
function updateNebulaPreviewPosition() {
  if (!nebulaPreviewCloud || !nebulaPreviewCircle) return;
  
  let centerPos: THREE.Vector3;
  
  if (isAdjustingNebulaRadius && nebulaPlacementCenter) {
    // During radius adjustment, keep center fixed
    centerPos = nebulaPlacementCenter;
    
    // Calculate radius based on distance from center to mouse
    const distance = Math.sqrt(
      Math.pow(currentMouseWorldPos.x - centerPos.x, 2) +
      Math.pow(currentMouseWorldPos.y - centerPos.y, 2)
    );
    
    // Clamp radius
    currentNebulaRadius = Math.max(minNebulaRadius, Math.min(maxNebulaRadius, Math.round(distance)));
    
    // Update cloud scale
    const scale = currentNebulaRadius * 3.2;
    nebulaPreviewCloud.scale.set(scale, scale, 1);
    
    // Update circle radius
    updateNebulaPreviewCircle(currentNebulaRadius);
  } else {
    // Normal preview mode - follow mouse
    centerPos = new THREE.Vector3(
      Math.round(currentMouseWorldPos.x),
      Math.round(currentMouseWorldPos.y),
      -0.3
    );
  }
  
  nebulaPreviewCloud.position.set(centerPos.x, centerPos.y, -0.5);
  nebulaPreviewCircle.position.copy(centerPos);
}

/**
 * Clear nebula preview meshes
 */
function clearNebulaPreview() {
  if (nebulaPreviewCloud) {
    scene.remove(nebulaPreviewCloud);
    if (nebulaPreviewCloud.material instanceof THREE.SpriteMaterial) {
      if (nebulaPreviewCloud.material.map) {
        nebulaPreviewCloud.material.map.dispose();
      }
      nebulaPreviewCloud.material.dispose();
    }
    nebulaPreviewCloud = null;
  }
  
  if (nebulaPreviewCircle) {
    scene.remove(nebulaPreviewCircle);
    nebulaPreviewCircle.geometry.dispose();
    if (nebulaPreviewCircle.material instanceof THREE.Material) {
      nebulaPreviewCircle.material.dispose();
    }
    nebulaPreviewCircle = null;
  }
}

function selectObject(object: THREE.Mesh | THREE.Line) {
  // Deselect previous visual highlight
  deselectCurrent();

  selectedMesh = object;
  const userData = object.userData as { type: string; data: SystemData | HyperlaneData | NebulaData };
  
  // Update store selection
  mapStore.selectElement({
    type: userData.type as 'system' | 'hyperlane' | 'nebula',
    data: userData.data
  });

  // Highlight selected object and set focus point
  if (userData.type === 'system' && object instanceof THREE.Mesh) {
    object.material = starSelectedMaterial.clone();
    // Show selection ring
    showSelectionRing(object);
    // Set focus point and animate camera to it
    targetPivot = object.position.clone();
    if (focusPoint) {
      // If we already have a focus point, animate from it
      // focusPoint will be updated by the animation loop
    } else {
      // Initialize focusPoint so animation works
      focusPoint = cameraPivot.clone();
    }
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
      targetPivot = center.clone();
      if (focusPoint) {
        // If we already have a focus point, animate from it
      } else {
        focusPoint = cameraPivot.clone();
      }
    }
  } else if (userData.type === 'nebula' && object instanceof THREE.Line) {
    // Show selection glow for nebula (orange)
    showNebulaSelectionGlow(userData.data as NebulaData);
    // Set focus point to nebula center
    const nebulaData = userData.data as NebulaData;
    const center = new THREE.Vector3(nebulaData.x, nebulaData.y, nebulaData.z);
    targetPivot = center.clone();
    if (focusPoint) {
      // If we already have a focus point, animate from it
    } else {
      focusPoint = cameraPivot.clone();
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

function showNebulaSelectionGlow(nebula: NebulaData) {
  const meshData = nebulaMeshes.get(nebula.name);
  if (meshData) {
    // Change glow circle color to orange for selection
    if (meshData.glowCircle.material instanceof LineMaterial) {
      meshData.glowCircle.material.color.setHex(0xff8800);
    } else if (meshData.glowCircle.material instanceof THREE.LineBasicMaterial) {
      meshData.glowCircle.material.color.setHex(0xff8800);
    }
    meshData.glowCircle.visible = true;
    selectedNebulaGlowCircle = meshData.glowCircle;
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
  
  // Hide selected nebula glow circle and reset color
  if (selectedNebulaGlowCircle) {
    selectedNebulaGlowCircle.visible = false;
    // Reset color to cyan for hover
    if (selectedNebulaGlowCircle.material instanceof LineMaterial) {
      selectedNebulaGlowCircle.material.color.setHex(0x00ffff);
    } else if (selectedNebulaGlowCircle.material instanceof THREE.LineBasicMaterial) {
      selectedNebulaGlowCircle.material.color.setHex(0x00ffff);
    }
    selectedNebulaGlowCircle = null;
  }
}

function deselectCurrent() {
  // Clear selection visuals
  clearSelectionVisuals();
  
  if (selectedMesh) {
    const userData = selectedMesh.userData as { type: string; data: SystemData | HyperlaneData | NebulaData };
    
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
    // Note: nebula circles don't need material restoration since we use glow circles

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
  } else if (selected.type === 'nebula') {
    const nebula = selected.data as NebulaData;
    mapStore.deleteNebula(nebula.name);
  }

  deselectCurrent();
  focusPoint = null;
}

// === INPUT HANDLERS ===

function onMouseDown(event: MouseEvent) {
  if (event.button === 0) {
    // Left mouse button
    if (toolsStore.isAddNebulaMode) {
      startNebulaPlacement();
      event.preventDefault();
    }
  } else if (event.button === 1) {
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
  if (event.button === 0) {
    // Left mouse button
    if (isAdjustingNebulaRadius) {
      finishNebulaPlacement();
    }
  } else if (event.button === 1) {
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
    
    // Update mouse world position for preview cursors
    updateMouseWorldPosition(event);
    
    // Update hyperlane preview line if in hyperlane creation mode
    if (toolsStore.isHyperlaneMode && firstSystemPosition) {
      updateHyperlanePreviewLine();
    }
    
    // Update system preview if in add system mode
    if (toolsStore.isAddSystemMode) {
      if (!systemPreviewMesh) {
        createSystemPreviewMesh();
      }
      updateSystemPreviewPosition();
    }
    
    // Update nebula preview if in add nebula mode
    if (toolsStore.isAddNebulaMode) {
      if (!nebulaPreviewCloud) {
        createNebulaPreviewMesh();
      }
      updateNebulaPreviewPosition();
    }
  }
}

/**
 * Update the current mouse world position for preview line
 */
function updateMouseWorldPosition(event: MouseEvent) {
  if (!containerRef.value || !renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Raycast to XY plane (z=0)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  raycaster.ray.intersectPlane(plane, currentMouseWorldPos);
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

  // Check nebula circles
  const nebulaCircleObjects = Array.from(nebulaMeshes.values()).map(n => n.circle);
  // Use a larger threshold for nebulae to account for potentially very large circles
  raycaster.params.Line = { threshold: Math.max(5, scaledThreshold * 2) };
  const nebulaIntersects = raycaster.intersectObjects(nebulaCircleObjects);

  if (nebulaIntersects.length > 0 && nebulaIntersects[0]) {
    const hitObject = nebulaIntersects[0].object as THREE.Line;
    if (hitObject !== hoveredMesh && hitObject !== selectedMesh) {
      clearHover();
      hoveredMesh = hitObject;
      showNebulaHover(hitObject);
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

function showNebulaHover(circle: THREE.Line) {
  const userData = circle.userData as { type: string; data: NebulaData };
  const nebulaData = userData.data;
  
  const meshData = nebulaMeshes.get(nebulaData.name);
  if (meshData && meshData.glowCircle !== selectedNebulaGlowCircle) {
    meshData.glowCircle.visible = true;
    hoveredNebulaGlowCircle = meshData.glowCircle;
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
  
  // Hide current nebula hover glow (only if not selected)
  if (hoveredNebulaGlowCircle && hoveredNebulaGlowCircle !== selectedNebulaGlowCircle) {
    hoveredNebulaGlowCircle.visible = false;
    hoveredNebulaGlowCircle = null;
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
  
  // Escape - cancel hyperlane creation
  if (event.key === 'Escape') {
    if (toolsStore.hyperlaneFirstSystemId !== null) {
      clearHyperlaneCreationState();
      event.preventDefault();
    }
  }
  
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
  firstSystemRingGeometry.dispose();
  firstSystemRingMaterial.dispose();
  hyperlanePreviewMaterial.dispose();
  if (hyperlanePreviewLine) {
    hyperlanePreviewLine.geometry.dispose();
  }
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

// Watch for tool changes to clear hyperlane creation state and previews
watch(() => toolsStore.currentTool, () => {
  clearHyperlaneCreationState();
  clearSystemPreview();
  clearNebulaPreview();
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
