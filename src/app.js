import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

var errBox = document.getElementById('error');
function fail(msg) {
  if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
  console.error(msg);
}

var container = document.getElementById('view');
if (!container) { fail('Missing #view container'); throw new Error('no view'); }

var loadingEl = document.getElementById('loading');

var state = {
  autoOrbit: false,
  showOrbits: true,
  showLabels: true,
  dayNightCycle: false,
  planetSpin: false,
  planetOrbit: false,
  motionFrozen: true,
  daysPerSecond: 9,
  selected: 'sun'
};

var EARTH_YEAR_DAYS = 365.25;
var MOON_ORBIT_DAYS = 27.3;
var TIME_SLIDER_DEFAULT = 5;
var MIN_DAYS_PER_SEC = 1 / 1800;
var MAX_DAYS_PER_SEC = 1 / 300;

function daysPerSecondFromSlider(val) {
  var t = Math.max(0, Math.min(100, val)) / 100;
  return MIN_DAYS_PER_SEC * Math.pow(MAX_DAYS_PER_SEC / MIN_DAYS_PER_SEC, t);
}

function formatDuration(sec) {
  if (sec < 90) return sec.toFixed(0) + ' sec';
  if (sec < 3600) return (sec / 60).toFixed(1) + ' min';
  if (sec < 86400) return (sec / 3600).toFixed(1) + ' hr';
  return (sec / 86400).toFixed(1) + ' days';
}

function formatSimSpeed(daysPerSec) {
  return '1 Earth spin ≈ ' + formatDuration(1 / daysPerSec);
}

function updateTimeScaleUI() {
  var label = formatSimSpeed(state.daysPerSecond);
  var stat = document.getElementById('stat-scale');
  var panel = document.getElementById('timeScaleLabel');
  var earthHint = document.getElementById('timeScaleEarth');
  if (stat) stat.textContent = label;
  if (panel) panel.textContent = label;
  if (earthHint) {
    var spinSec = 1 / state.daysPerSecond;
    var moonSec = MOON_ORBIT_DAYS / state.daysPerSecond;
    earthHint.textContent =
      '1 Earth spin ≈ ' + formatDuration(spinSec) +
      ' · Moon orbit ≈ ' + formatDuration(moonSec) +
      ' (real ratio: Moon is ' + MOON_ORBIT_DAYS + '× slower)';
  }
}

function simDays(dt) {
  return dt * state.daysPerSecond;
}

function advanceOrbit(angle, periodDays, dt) {
  return angle + (simDays(dt) / periodDays) * Math.PI * 2;
}

function advanceSpin(rotation, rotDays, dt, retrograde) {
  var delta = (simDays(dt) / rotDays) * Math.PI * 2;
  return rotation + (retrograde ? -delta : delta);
}

// Bundled same-origin — 8K Solar System Scope via Wikimedia Commons (CC BY 4.0), 2K fallback.
var TEXTURE_BASE = 'assets/textures/';
var TEXTURE_CANDIDATES = {
  sun: ['8k_sun.jpg', '2k_sun.jpg'],
  mercury: ['8k_mercury.jpg', '2k_mercury.jpg'],
  venus: ['8k_venus_surface.jpg', '2k_venus_surface.jpg'],
  earth: ['8k_earth_daymap.jpg', '2k_earth_daymap.jpg'],
  earthNight: ['8k_earth_nightmap.jpg', '2k_earth_nightmap.jpg'],
  earthClouds: ['8k_earth_clouds.jpg', '2k_earth_clouds.jpg'],
  starsSky: ['8k_stars_milky_way.jpg', '2k_stars_milky_way.jpg'],
  mars: ['8k_mars.jpg', '2k_mars.jpg'],
  jupiter: ['8k_jupiter.jpg', '2k_jupiter.jpg'],
  saturn: ['8k_saturn.jpg', '2k_saturn.jpg'],
  saturnRing: ['8k_saturn_ring_alpha.png', '2k_saturn_ring_alpha.png'],
  uranus: ['4k_uranus.jpg', '2k_uranus.jpg'],
  neptune: ['4k_neptune.jpg', '2k_neptune.jpg'],
  moon: ['8k_moon.jpg', '2k_moon.jpg']
};
var TEXTURES = {
  sun: TEXTURE_BASE + TEXTURE_CANDIDATES.sun[0],
  mercury: TEXTURE_BASE + TEXTURE_CANDIDATES.mercury[0],
  venus: TEXTURE_BASE + TEXTURE_CANDIDATES.venus[0],
  earth: TEXTURE_BASE + TEXTURE_CANDIDATES.earth[0],
  earthNight: TEXTURE_BASE + TEXTURE_CANDIDATES.earthNight[0],
  earthClouds: TEXTURE_BASE + TEXTURE_CANDIDATES.earthClouds[0],
  starsSky: TEXTURE_BASE + TEXTURE_CANDIDATES.starsSky[0],
  mars: TEXTURE_BASE + TEXTURE_CANDIDATES.mars[0],
  jupiter: TEXTURE_BASE + TEXTURE_CANDIDATES.jupiter[0],
  saturn: TEXTURE_BASE + TEXTURE_CANDIDATES.saturn[0],
  saturnRing: TEXTURE_BASE + TEXTURE_CANDIDATES.saturnRing[0],
  uranus: TEXTURE_BASE + TEXTURE_CANDIDATES.uranus[0],
  neptune: TEXTURE_BASE + TEXTURE_CANDIDATES.neptune[0],
  moon: TEXTURE_BASE + TEXTURE_CANDIDATES.moon[0]
};

var BODIES = [
  {
    id: 'mercury', name: 'Mercury', color: '#b5b5b5', size: 0.38, orbit: 10,
    periodDays: 88, rotDays: 58.6,
    axialTilt: 0.03, roughness: 0.95, metalness: 0.02, bumpScale: 0.35,
    desc: 'The swift inner world — scorched, cratered, and closest to the Sun.',
    facts: { 'Day length': '59 Earth days', 'Year': '88 Earth days', 'Moons': '0' },
    map: TEXTURES.mercury
  },
  {
    id: 'venus', name: 'Venus', color: '#e8cda0', size: 0.95, orbit: 14,
    periodDays: 225, rotDays: 243, retrograde: true,
    axialTilt: 3.05, roughness: 0.82, metalness: 0.04, bumpScale: 0.12,
    atmosphere: { color: 0xffd9a0, scale: 1.05, opacity: 0.12 },
    desc: "A brilliant sulfuric haze world — Earth's twin in size, opposite in temperament.",
    facts: { 'Day length': '243 Earth days', 'Year': '225 Earth days', 'Moons': '0' },
    map: TEXTURES.venus
  },
  {
    id: 'earth', name: 'Earth', color: '#4a9eff', size: 1.0, orbit: 18,
    periodDays: 365.25, rotDays: 1,
    axialTilt: 0.41, roughness: 0.72, metalness: 0.05, bumpScale: 0.18,
    atmosphere: { color: 0x5eb6ff, scale: 1.08, opacity: 0.28 },
    desc: 'Our home — blue oceans, white clouds, and the only known harbor of life.',
    facts: { 'Day length': '24 hours', 'Year': '365 days', 'Moons': '1 (Luna)' },
    map: TEXTURES.earth, clouds: TEXTURES.earthClouds,
    globeLon: Math.PI * 1.08
  },
  {
    id: 'mars', name: 'Mars', color: '#c1440e', size: 0.53, orbit: 23,
    periodDays: 687, rotDays: 1.03,
    axialTilt: 0.44, roughness: 0.9, metalness: 0.03, bumpScale: 0.28,
    atmosphere: { color: 0xff8866, scale: 1.04, opacity: 0.1 },
    desc: "The red frontier — dust storms, polar ice, and humanity's next horizon.",
    facts: { 'Day length': '24.6 hours', 'Year': '687 Earth days', 'Moons': '2' },
    map: TEXTURES.mars
  },
  {
    id: 'jupiter', name: 'Jupiter', color: '#d4a574', size: 2.8, orbit: 32,
    periodDays: 4333, rotDays: 0.41,
    axialTilt: 0.055, roughness: 0.65, metalness: 0.08, bumpScale: 0.08, segments: 64,
    desc: 'The giant king — banded storms and a magnetosphere that shapes the outer system.',
    facts: { 'Day length': '9.9 hours', 'Year': '12 Earth years', 'Moons': '95+' },
    map: TEXTURES.jupiter
  },
  {
    id: 'saturn', name: 'Saturn', color: '#f0d9a8', size: 2.35, orbit: 42,
    periodDays: 10759, rotDays: 0.45,
    axialTilt: 0.466, roughness: 0.7, metalness: 0.06, bumpScale: 0.06, segments: 64,
    desc: 'The ringed jewel — ice and rock in a halo that defines the solar aesthetic.',
    facts: { 'Day length': '10.7 hours', 'Year': '29 Earth years', 'Moons': '146+' },
    map: TEXTURES.saturn, rings: true, ringMap: TEXTURES.saturnRing
  },
  {
    id: 'uranus', name: 'Uranus', color: '#7de3f4', size: 1.6, orbit: 52,
    periodDays: 30688, rotDays: 0.72,
    axialTilt: 1.71, roughness: 0.58, metalness: 0.1, bumpScale: 0.05,
    desc: 'The tilted ice giant — rolling on its side through a pale cyan haze.',
    facts: { 'Day length': '17 hours', 'Year': '84 Earth years', 'Moons': '28' },
    map: TEXTURES.uranus
  },
  {
    id: 'neptune', name: 'Neptune', color: '#3d5afe', size: 1.55, orbit: 60,
    periodDays: 60182, rotDays: 0.67,
    axialTilt: 0.49, roughness: 0.55, metalness: 0.1, bumpScale: 0.05,
    atmosphere: { color: 0x4466ff, scale: 1.05, opacity: 0.14 },
    desc: 'The deep blue sentinel — supersonic winds at the edge of our planetary family.',
    facts: { 'Day length': '16 hours', 'Year': '165 Earth years', 'Moons': '16' },
    map: TEXTURES.neptune
  }
];

var SUN = {
  id: 'sun', name: 'Sun', color: '#ffd54f', rotDays: 25,
  desc: 'The engine of the system — fusion fire, light, and gravity holding every world in dance.',
  facts: { 'Type': 'G-type main sequence', 'Age': '~4.6 billion years', 'Planets': '8' }
};

var MOON_ROT_DAYS = 27.3;

var MOON = {
  id: 'moon', name: 'Moon', color: '#c8ccd8',
  desc: "Earth's companion — not a planet, but our nearest world in space. Gray, cratered, and tidally locked.",
  facts: {
    'Type': 'Natural satellite (not a planet)',
    'Orbits': 'Earth',
    'Day length': '27.3 Earth days',
    'Distance': '~384,400 km from Earth'
  }
};

var loader = new THREE.TextureLoader();
function loadTex(url) {
  return new Promise(function (resolve, reject) {
    loader.load(url, resolve, undefined, reject);
  });
}

function loadTexCandidates(key) {
  var list = TEXTURE_CANDIDATES[key];
  if (!list) return Promise.reject(new Error('Unknown texture key: ' + key));
  var chain = Promise.reject();
  list.forEach(function (file) {
    var url = TEXTURE_BASE + file;
    chain = chain.catch(function () {
      return loadTex(url).then(function (tex) {
        return { key: key, file: file, tex: tex };
      });
    });
  });
  return chain;
}
function prepTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function isGasGiant(id) {
  return id === 'jupiter' || id === 'saturn' || id === 'uranus' || id === 'neptune';
}

var SUN_WORLD = new THREE.Vector3(0, 0, 0);

var PLANET_SURFACE_VERT = [
  'varying vec2 vUv;',
  'varying vec3 vWorldNormal;',
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vUv = uv;',
  '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
  '  vWorldPos = worldPos.xyz;',
  '  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
  '  gl_Position = projectionMatrix * viewMatrix * worldPos;',
  '}'
].join('\n');

var PLANET_SURFACE_FRAG = [
  'uniform sampler2D map;',
  'uniform vec3 sunPosition;',
  'uniform float ambientFloor;',
  'uniform float litBoost;',
  'uniform float contrastPower;',
  'uniform float rimStrength;',
  'varying vec2 vUv;',
  'varying vec3 vWorldNormal;',
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vec3 albedo = texture2D(map, vUv).rgb;',
  '  vec3 N = normalize(vWorldNormal);',
  '  vec3 L = normalize(sunPosition - vWorldPos);',
  '  float ndotl = max(dot(N, L), 0.0);',
  '  float shade = mix(ambientFloor, litBoost, pow(ndotl, contrastPower));',
  '  vec3 color = albedo * shade;',
  '  vec3 V = normalize(cameraPosition - vWorldPos);',
  '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);',
  '  color += albedo * fresnel * rimStrength;',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');

function surfaceLightingFor(def) {
  if (def.id === 'moon') {
    return { ambientFloor: 0.44, litBoost: 1.14, contrastPower: 0.82, rimStrength: 0.1 };
  }
  if (isGasGiant(def.id)) {
    return { ambientFloor: 0.54, litBoost: 1.1, contrastPower: 0.5, rimStrength: 0.14 };
  }
  if (def.id === 'earth') {
    return { ambientFloor: 0.48, litBoost: 1.16, contrastPower: 0.62, rimStrength: 0.12 };
  }
  return { ambientFloor: 0.42, litBoost: 1.2, contrastPower: 0.72, rimStrength: 0.1 };
}

function planetMaterial(def, tex) {
  var light = surfaceLightingFor(def);
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      sunPosition: { value: SUN_WORLD },
      ambientFloor: { value: light.ambientFloor },
      litBoost: { value: light.litBoost },
      contrastPower: { value: light.contrastPower },
      rimStrength: { value: light.rimStrength }
    },
    vertexShader: PLANET_SURFACE_VERT,
    fragmentShader: PLANET_SURFACE_FRAG
  });
}

var EARTH_DAY_NIGHT_FRAG = [
  'uniform sampler2D dayMap;',
  'uniform sampler2D nightMap;',
  'uniform vec3 sunPosition;',
  'uniform float litBoost;',
  'uniform float contrastPower;',
  'uniform float rimStrength;',
  'varying vec2 vUv;',
  'varying vec3 vWorldNormal;',
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vec3 N = normalize(vWorldNormal);',
  '  vec3 L = normalize(sunPosition - vWorldPos);',
  '  float ndotl = dot(N, L);',
  '  vec3 dayCol = texture2D(dayMap, vUv).rgb;',
  '  vec3 nightCol = texture2D(nightMap, vUv).rgb * 2.6;',
  '  float dayAmt = smoothstep(-0.04, 0.18, ndotl);',
  '  vec3 albedo = mix(nightCol, dayCol, dayAmt);',
  '  float shade = mix(1.0, litBoost, pow(max(ndotl, 0.0), contrastPower));',
  '  vec3 color = albedo * mix(1.0, shade, dayAmt);',
  '  vec3 V = normalize(cameraPosition - vWorldPos);',
  '  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);',
  '  color += mix(dayCol, nightCol, 1.0 - dayAmt) * fresnel * rimStrength;',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');

function earthDayNightMaterial(dayTex, nightTex) {
  var light = surfaceLightingFor({ id: 'earth' });
  return new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayTex },
      nightMap: { value: nightTex },
      sunPosition: { value: SUN_WORLD },
      litBoost: { value: light.litBoost },
      contrastPower: { value: light.contrastPower },
      rimStrength: { value: light.rimStrength }
    },
    vertexShader: PLANET_SURFACE_VERT,
    fragmentShader: EARTH_DAY_NIGHT_FRAG
  });
}

var MOON_SURFACE_FRAG = [
  'uniform sampler2D map;',
  'uniform vec3 sunPosition;',
  'uniform vec3 earthPosition;',
  'uniform float ambientFloor;',
  'uniform float litBoost;',
  'uniform float contrastPower;',
  'varying vec2 vUv;',
  'varying vec3 vWorldNormal;',
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vec3 albedo = texture2D(map, vUv).rgb;',
  '  vec3 N = normalize(vWorldNormal);',
  '  vec3 L = normalize(sunPosition - vWorldPos);',
  '  float sunLite = max(dot(N, L), 0.0);',
  '  vec3 earthLite = normalize(earthPosition - vWorldPos);',
  '  float earthGlow = max(dot(N, earthLite), 0.0);',
  '  float shade = mix(ambientFloor, litBoost, pow(sunLite, contrastPower));',
  '  vec3 color = albedo * shade;',
  '  color += albedo * earthGlow * 0.22;',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');

function moonSurfaceMaterial(tex) {
  var light = surfaceLightingFor({ id: 'moon' });
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: tex },
      sunPosition: { value: SUN_WORLD },
      earthPosition: { value: new THREE.Vector3() },
      ambientFloor: { value: light.ambientFloor },
      litBoost: { value: light.litBoost },
      contrastPower: { value: light.contrastPower }
    },
    vertexShader: PLANET_SURFACE_VERT,
    fragmentShader: MOON_SURFACE_FRAG
  });
}

var SKY_VERT = [
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vec4 wp = modelMatrix * vec4(position, 1.0);',
  '  vWorldPos = wp.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * wp;',
  '}'
].join('\n');

var SKY_FRAG = [
  'uniform sampler2D starsMap;',
  'uniform float dayBlend;',
  'uniform vec3 sunDirection;',
  'varying vec3 vWorldPos;',
  'void main() {',
  '  vec3 dir = normalize(vWorldPos);',
  '  vec2 uv = vec2(atan(dir.z, dir.x) / 6.2831853 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265 + 0.5);',
  '  vec3 stars = texture2D(starsMap, uv).rgb;',
  '  float horizon = smoothstep(-0.08, 0.42, dir.y);',
  '  vec3 daySky = mix(vec3(0.42, 0.62, 0.95), vec3(0.12, 0.32, 0.72), horizon);',
  '  float sunDot = max(dot(dir, sunDirection), 0.0);',
  '  daySky += vec3(1.0, 0.94, 0.78) * pow(sunDot, 220.0) * 3.0;',
  '  daySky += vec3(1.0, 0.72, 0.38) * pow(sunDot, 10.0) * 0.42;',
  '  float sunset = exp(-abs(dir.y) * 7.0) * pow(1.0 - sunDot, 1.6);',
  '  daySky += vec3(1.0, 0.38, 0.18) * sunset * 0.55;',
  '  vec3 night = stars * (0.85 + 0.35 * pow(1.0 - max(dir.y, 0.0), 1.5));',
  '  vec3 color = mix(night, daySky, clamp(dayBlend, 0.0, 1.0));',
  '  gl_FragColor = vec4(color, 1.0);',
  '}'
].join('\n');

// ---- renderer -----------------------------------------------------------
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.02, 500);
camera.position.set(0, 28, 52);

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.38;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

var composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
var bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38, 0.55, 0.88
);
composer.addPass(bloomPass);

var labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

// ---- lights & sky -------------------------------------------------------
scene.add(new THREE.AmbientLight(0x2a3558, 0.14));
scene.add(new THREE.HemisphereLight(0xb8d4ff, 0x1a1424, 0.28));
var sunLight = new THREE.PointLight(0xfff8e8, 8.5, 320, 1.6);
var skyDome = null;
var skyMat = null;
var starSparkle = null;
var moonMat = null;
var skyNightColor = new THREE.Color(0x010208);
var skyDayColor = new THREE.Color(0x1a3a68);
var tmpSunDir = new THREE.Vector3();

function buildSkyEnvironment(starsTex) {
  skyMat = new THREE.ShaderMaterial({
    uniforms: {
      starsMap: { value: starsTex },
      dayBlend: { value: 0 },
      sunDirection: { value: new THREE.Vector3(0, 0.2, 1) }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 64, 48), skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -2;
  scene.add(skyDome);

  var starCount = 1800;
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(starCount * 3);
  var starCol = new Float32Array(starCount * 3);
  for (var i = 0; i < starCount; i++) {
    var r = 200 + Math.random() * 35;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    var tint = 0.88 + Math.random() * 0.12;
    starCol[i * 3] = tint;
    starCol[i * 3 + 1] = tint * (0.95 + Math.random() * 0.05);
    starCol[i * 3 + 2] = 1;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  starSparkle = new THREE.Points(starGeo, new THREE.PointsMaterial({
    vertexColors: true, size: 0.55, transparent: true, opacity: 0.75, sizeAttenuation: true,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  starSparkle.renderOrder = -1;
  scene.add(starSparkle);
}

// ---- sun & planets (textures loaded at boot) ------------------------------
var sunGroup = new THREE.Group();
var sunCore;
var planets = [];
var orbitLines = [];
var labelObjs = [];
var moonMesh = null;
var moonOrbitLine = null;

var ORBIT_OPACITY = { highlight: 0.62, normal: 0.24, dim: 0.07 };

function makeOrbitMaterial(hexColor, opacity) {
  return new THREE.LineBasicMaterial({
    color: new THREE.Color(hexColor),
    transparent: true,
    opacity: opacity,
    depthWrite: false
  });
}

function updateOrbitHighlight() {
  if (!state.showOrbits) return;
  var sel = state.selected;
  planets.forEach(function (g) {
    var line = g.userData.orbitLine;
    if (!line) return;
    var id = g.userData.def.id;
    var mat = line.material;
    if (sel === 'sun') mat.opacity = ORBIT_OPACITY.normal;
    else if (sel === 'moon') mat.opacity = id === 'earth' ? ORBIT_OPACITY.highlight : ORBIT_OPACITY.dim;
    else mat.opacity = id === sel ? ORBIT_OPACITY.highlight : ORBIT_OPACITY.dim;
  });
  if (moonOrbitLine) {
    moonOrbitLine.material.opacity = (sel === 'moon' || sel === 'earth')
      ? ORBIT_OPACITY.highlight : ORBIT_OPACITY.dim;
  }
}

function makeLabel(text, color) {
  var el = document.createElement('div');
  el.className = 'planet-label';
  if (color) el.style.borderColor = color;
  el.textContent = text;
  var obj = new CSS2DObject(el);
  obj.visible = state.showLabels;
  return obj;
}

function addAtmosphere(parent, radius, cfg) {
  var shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * cfg.scale, 48, 48),
    new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  parent.add(shell);
}

function addEarthAtmosphere(parent, radius) {
  var shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x6eb8ff,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    })
  );
  shell.userData.isAtmosphere = true;
  parent.add(shell);
}

function makeRingMesh(inner, outer, tex) {
  var ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 128),
    new THREE.MeshBasicMaterial({
      map: tex,
      alphaMap: tex,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      color: 0xffffff
    })
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function buildScene(textures) {
  if (textures.starsSky) buildSkyEnvironment(textures.starsSky);

  sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 80, 80),
    new THREE.MeshBasicMaterial({ map: textures.sun, color: 0xffffff })
  );
  sunGroup.add(sunCore);
  sunGroup.add(sunLight);
  scene.add(sunGroup);

  var sunLabel = makeLabel('Sun', SUN.color);
  sunLabel.position.set(0, 5.2, 0);
  sunGroup.add(sunLabel);
  labelObjs.push(sunLabel);

  BODIES.forEach(function (def, idx) {
    var group = new THREE.Group();
    var meshSize = 0.55 + def.size * 0.55;
    var segs = def.segments || (def.id === 'earth' ? 96 : (isGasGiant(def.id) ? 80 : 64));
    var body = new THREE.Group();
    body.rotation.x = def.axialTilt || 0;
    if (def.globeLon != null) body.rotation.y = def.globeLon;
    var surfaceMat = (def.id === 'earth' && textures.earth_night)
      ? earthDayNightMaterial(textures.earth, textures.earth_night)
      : planetMaterial(def, textures[def.id]);
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(meshSize, segs, segs), surfaceMat);
    body.add(mesh);
    group.add(body);

    if (def.id === 'earth') addEarthAtmosphere(body, meshSize);
    else if (def.atmosphere) addAtmosphere(body, meshSize, def.atmosphere);

    if (def.clouds && textures[def.id + '_clouds']) {
      var clouds = new THREE.Mesh(
        new THREE.SphereGeometry(meshSize * 1.018, segs, segs),
        new THREE.MeshBasicMaterial({
          map: textures[def.id + '_clouds'],
          transparent: true,
          opacity: 0.62,
          depthWrite: true,
          alphaTest: 0.04,
          color: 0xffffff
        })
      );
      clouds.userData.isClouds = true;
      body.add(clouds);
    }

    if (def.rings && textures.saturn_ring) {
      body.add(makeRingMesh(meshSize * 1.35, meshSize * 2.35, textures.saturn_ring));
    }

    var tilt = 0;
    var homeAngle = Math.PI + idx * 0.62;
    var homeBodyRot = def.globeLon != null ? def.globeLon : 0;
    group.userData = {
      def: def,
      angle: homeAngle,
      homeAngle: homeAngle,
      homeBodyRot: homeBodyRot,
      orbit: def.orbit, tilt: tilt, mesh: mesh, body: body, rotation: 0
    };
    group.position.set(
      def.orbit * Math.cos(homeAngle), 0, def.orbit * Math.sin(homeAngle)
    );

    var orbitPts = [];
    for (var s = 0; s <= 128; s++) {
      var a = (s / 128) * Math.PI * 2;
      orbitPts.push(def.orbit * Math.cos(a), 0, def.orbit * Math.sin(a));
    }
    var orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(orbitPts, 3));
    var orbitLine = new THREE.Line(
      orbitGeo,
      makeOrbitMaterial(def.color, ORBIT_OPACITY.normal)
    );
    orbitLine.userData.bodyId = def.id;
    scene.add(orbitLine);
    orbitLines.push(orbitLine);
    group.userData.orbitLine = orbitLine;

    var label = makeLabel(def.name, def.color);
    label.position.set(0, meshSize + 0.6, 0);
    group.add(label);
    labelObjs.push(label);

    scene.add(group);
    planets.push(group);
  });

  var earth = planets[2];
  if (earth && earth.userData.body) {
    var earthSize = 0.55 + BODIES[2].size * 0.55;
    var moonOrbit = earthSize * 2.4;
    var moonTex = textures.moon;
    moonMat = moonTex
      ? moonSurfaceMaterial(moonTex)
      : new THREE.MeshBasicMaterial({ color: 0xcccccc });
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(earthSize * 0.28, 48, 48), moonMat);
    moonMesh.userData.orbit = moonOrbit;
    moonMesh.userData.orbitDays = MOON_ORBIT_DAYS;
    moonMesh.userData.angle = 0;
    moonMesh.userData.homeAngle = 0;
    moonMesh.userData.rotation = 0;
    moonMesh.userData.isMoon = true;
    earth.userData.body.add(moonMesh);

    var moonLabel = makeLabel('Moon', MOON.color);
    moonLabel.position.set(0, earthSize * 0.34, 0);
    moonMesh.add(moonLabel);
    labelObjs.push(moonLabel);

    var moonOrbitPts = [];
    for (var m = 0; m <= 96; m++) {
      var ma = (m / 96) * Math.PI * 2;
      moonOrbitPts.push(
        moonOrbit * Math.cos(ma), 0, moonOrbit * Math.sin(ma)
      );
    }
    var moonOrbitGeo = new THREE.BufferGeometry();
    moonOrbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(moonOrbitPts, 3));
    moonOrbitLine = new THREE.Line(
      moonOrbitGeo,
      makeOrbitMaterial(MOON.color, ORBIT_OPACITY.dim)
    );
    moonOrbitLine.userData.isMoonOrbit = true;
    earth.userData.body.add(moonOrbitLine);
  }

  updateOrbitHighlight();

  var statBodies = document.getElementById('stat-bodies');
  if (statBodies) statBodies.textContent = String(9 + (moonMesh ? 1 : 0));
}

// ---- interaction --------------------------------------------------------
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var drag = { active: false, lx: 0, ly: 0 };
var camTheta = 0.75, camPhi = 0.42, camDist = 58, camTarget = new THREE.Vector3();
var camMinDist = 1.2;
var camMaxDist = 120;

function bodyRadius(id) {
  if (id === 'sun') return 3.2;
  if (id === 'moon' && moonMesh) return moonMesh.geometry.parameters.radius;
  var def = BODIES.find(function (b) { return b.id === id; });
  if (!def) return 1;
  return 0.55 + def.size * 0.55;
}

function setCamLimits(id) {
  var r = bodyRadius(id);
  camMinDist = Math.max(0.12, r * 1.04);
  camMaxDist = Math.max(90, r * 55);
  if (camDist < camMinDist) camDist = camMinDist;
  if (camDist > camMaxDist) camDist = camMaxDist;
}

function pickables() {
  var list = [];
  if (sunCore) list.push(sunCore);
  planets.forEach(function (g) { list.push(g.userData.mesh); });
  if (moonMesh) list.push(moonMesh);
  return list;
}

function snapCameraToTarget() {
  var x = camTarget.x + camDist * Math.sin(camPhi) * Math.cos(camTheta);
  var y = camTarget.y + camDist * Math.cos(camPhi);
  var z = camTarget.z + camDist * Math.sin(camPhi) * Math.sin(camTheta);
  camera.position.set(x, y, z);
  camera.lookAt(camTarget);
}

function setSelected(id) {
  state.selected = id;
  var info = id === 'sun' ? SUN : id === 'moon' ? MOON : BODIES.find(function (b) { return b.id === id; });
  if (!info) return;
  document.getElementById('infoName').textContent = info.name;
  document.getElementById('infoDesc').textContent = info.desc;
  var dl = document.getElementById('infoStats');
  dl.innerHTML = '';
  Object.keys(info.facts).forEach(function (k) {
    dl.innerHTML += '<dt>' + k + '</dt><dd>' + info.facts[k] + '</dd>';
  });
  document.querySelectorAll('.legend-chip').forEach(function (el) {
    el.classList.toggle('active', el.dataset.id === id);
  });
  updateOrbitHighlight();
}

function focusBody(id) {
  stopAllMotion({ flash: false });

  if (id === 'sun') {
    setSelected('sun');
    camTarget.set(0, 0, 0);
    camDist = 14;
    camPhi = 0.48;
    setCamLimits('sun');
    snapCameraToTarget();
    return;
  }
  if (id === 'moon' && moonMesh) {
    setSelected('moon');
    moonMesh.getWorldPosition(camTarget);
    camDist = bodyRadius('moon') * 2.4;
    camPhi = 0.55;
    setCamLimits('moon');
    snapCameraToTarget();
    return;
  }
  setSelected(id);
  var g = planets.find(function (p) { return p.userData.def.id === id; });
  if (g) {
    camTarget.copy(g.position);
    var meshR = bodyRadius(id);
    camDist = meshR * 2.15;
    camPhi = 0.52;
    setCamLimits(id);
    snapCameraToTarget();
  }
}

function buildLegend() {
  var box = document.getElementById('legend');
  box.innerHTML = '';
  [{ id: 'sun', name: 'Sun', color: '#ffd54f' }]
    .concat(BODIES.map(function (b) { return { id: b.id, name: b.name, color: b.color }; }))
    .concat(moonMesh ? [{ id: 'moon', name: 'Moon', color: '#c8ccd8' }] : [])
    .forEach(function (item) {
    var chip = document.createElement('div');
    chip.className = 'legend-chip' + (item.id === state.selected ? ' active' : '');
    chip.dataset.id = item.id;
    chip.innerHTML = '<span class="swatch" style="background:' + item.color + ';color:' + item.color + '"></span><span>' + item.name + '</span>';
    chip.addEventListener('click', function () { focusBody(item.id); });
    box.appendChild(chip);
  });
}

renderer.domElement.addEventListener('pointerdown', function (e) {
  drag.active = true; drag.lx = e.clientX; drag.ly = e.clientY;
});
window.addEventListener('pointerup', function (e) {
  if (!drag.active) return;
  var moved = Math.abs(e.clientX - drag.lx) + Math.abs(e.clientY - drag.ly);
  drag.active = false;
  if (moved > 6) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  var hits = raycaster.intersectObjects(pickables(), false);
  if (!hits.length) return;
  var obj = hits[0].object;
  if (obj === sunCore) focusBody('sun');
  else if (obj === moonMesh) focusBody('moon');
  else {
    var g = planets.find(function (p) { return p.userData.mesh === obj; });
    if (g) focusBody(g.userData.def.id);
  }
});
window.addEventListener('pointermove', function (e) {
  if (!drag.active) return;
  camTheta -= (e.clientX - drag.lx) * 0.005;
  camPhi = Math.max(0.12, Math.min(1.35, camPhi + (e.clientY - drag.ly) * 0.004));
  drag.lx = e.clientX; drag.ly = e.clientY;
});
renderer.domElement.addEventListener('wheel', function (e) {
  e.preventDefault();
  var step = Math.max(0.003, camDist * 0.06);
  camDist = Math.max(camMinDist, Math.min(camMaxDist, camDist + e.deltaY * step * 0.01));
}, { passive: false });

function bind(id, evt, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}

function clampSimSpeedForMotion() {
  if (!state.planetSpin && !state.planetOrbit) return;
  var slider = document.getElementById('timeScale');
  if (!slider) return;
  var maxSlow = 35;
  if (+slider.value > maxSlow) {
    slider.value = String(maxSlow);
    state.daysPerSecond = daysPerSecondFromSlider(maxSlow);
    updateTimeScaleUI();
  }
}

function initControls() {
  if (initControls.done) return;
  initControls.done = true;

  bind('autoOrbit', 'change', function (e) {
    state.autoOrbit = e.target.checked;
    if (e.target.checked) resumeMotion();
  });
  bind('planetSpin', 'change', function (e) {
    state.planetSpin = e.target.checked;
    if (state.planetSpin || state.planetOrbit) resumeMotion();
    else stopAllMotion({ flash: false });
    if (e.target.checked) clampSimSpeedForMotion();
  });
  bind('planetOrbit', 'change', function (e) {
    state.planetOrbit = e.target.checked;
    if (state.planetSpin || state.planetOrbit) resumeMotion();
    else stopAllMotion({ flash: false });
    if (e.target.checked) clampSimSpeedForMotion();
  });
  bind('showOrbits', 'change', function (e) {
    state.showOrbits = e.target.checked;
    orbitLines.forEach(function (l) { l.visible = state.showOrbits; });
    if (moonOrbitLine) moonOrbitLine.visible = state.showOrbits;
    if (state.showOrbits) updateOrbitHighlight();
  });
  bind('showLabels', 'change', function (e) {
    state.showLabels = e.target.checked;
    labelObjs.forEach(function (l) { l.visible = state.showLabels; });
  });
  bind('dayNightCycle', 'change', function (e) {
    state.dayNightCycle = e.target.checked;
    if (e.target.checked) resumeMotion();
    updateSkyCycle();
  });
  var stopBtn = document.getElementById('stopMotion');
  if (stopBtn) {
    stopBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      stopAllMotion({ flash: true });
    });
  }
  bind('timeScale', 'input', function (e) {
    state.daysPerSecond = daysPerSecondFromSlider(+e.target.value);
    updateTimeScaleUI();
  });
  bind('resetCam', 'click', function () {
    camTheta = 0.75; camPhi = 0.42; camDist = 58; camTarget.set(0, 0, 0);
    setSelected('sun');
    setCamLimits('sun');
    stopAllMotion({ flash: false });
    snapCameraToTarget();
  });
  bind('focusSun', 'click', function () { focusBody('sun'); });
  bind('focusEarth', 'click', function () { focusBody('earth'); });
  bind('focusMoon', 'click', function () { focusBody('moon'); });
}

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- animate ------------------------------------------------------------
var clock = new THREE.Clock();
var fpsFrames = 0, fpsLast = performance.now();

function updateCamera() {
  if (state.autoOrbit && !state.motionFrozen) camTheta += 0.00045;
  var x = camTarget.x + camDist * Math.sin(camPhi) * Math.cos(camTheta);
  var y = camTarget.y + camDist * Math.cos(camPhi);
  var z = camTarget.z + camDist * Math.sin(camPhi) * Math.sin(camTheta);
  if (state.motionFrozen) camera.position.set(x, y, z);
  else camera.position.lerp(new THREE.Vector3(x, y, z), 0.08);
  camera.lookAt(camTarget);
}

function freezeAllBodies() {
  planets.forEach(function (g) {
    var d = g.userData;
    d.angle = d.homeAngle;
    g.position.set(
      d.orbit * Math.cos(d.homeAngle), 0, d.orbit * Math.sin(d.homeAngle)
    );
    if (d.body) d.body.rotation.y = d.homeBodyRot;
    var spinTarget = d.body || g;
    spinTarget.children.forEach(function (ch) {
      if (ch.userData && ch.userData.isClouds) ch.rotation.y = 0;
      if (ch.userData && ch.userData.orbit) {
        ch.userData.angle = ch.userData.homeAngle != null ? ch.userData.homeAngle : 0;
        ch.position.set(
          Math.cos(ch.userData.angle) * ch.userData.orbit,
          0,
          Math.sin(ch.userData.angle) * ch.userData.orbit
        );
        ch.rotation.y = 0;
        ch.userData.rotation = 0;
      }
    });
  });
  if (sunCore) sunCore.rotation.y = 0;
}

function syncMotionCheckboxes() {
  var map = {
    planetSpin: state.planetSpin,
    planetOrbit: state.planetOrbit,
    autoOrbit: state.autoOrbit,
    dayNightCycle: state.dayNightCycle
  };
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.checked = map[id];
  });
}

function flashStopButton() {
  var btn = document.getElementById('stopMotion');
  if (!btn) return;
  var label = 'Stop all motion';
  btn.textContent = 'Frozen';
  btn.classList.add('stopped');
  setTimeout(function () {
    btn.textContent = label;
    btn.classList.remove('stopped');
  }, 1400);
}

function stopAllMotion(opts) {
  state.motionFrozen = true;
  state.planetSpin = false;
  state.planetOrbit = false;
  state.autoOrbit = false;
  state.dayNightCycle = false;
  freezeAllBodies();
  syncMotionCheckboxes();
  updateSkyCycle();
  snapCameraToTarget();
  if (!opts || opts.flash) flashStopButton();
}

function resumeMotion() {
  state.motionFrozen = false;
}

function updateSkyCycle() {
  if (!skyMat) return;

  tmpSunDir.copy(SUN_WORLD).sub(camera.position).normalize();
  skyMat.uniforms.sunDirection.value.copy(tmpSunDir);

  var dayBlend = 0;
  var earth = planets[2];
  if (state.dayNightCycle && state.planetSpin && earth && earth.userData.body) {
    var rot = earth.userData.body.rotation.y % (Math.PI * 2);
    dayBlend = Math.cos(rot) * 0.5 + 0.5;
    dayBlend = dayBlend * dayBlend * (3 - 2 * dayBlend);
  }

  skyMat.uniforms.dayBlend.value = dayBlend;
  scene.background = skyNightColor.clone().lerp(skyDayColor, dayBlend * 0.55);

  if (starSparkle) {
    starSparkle.material.opacity = 0.35 + (1 - dayBlend) * 0.55;
  }

  if (moonMat && moonMat.uniforms && moonMat.uniforms.earthPosition && earth) {
    earth.getWorldPosition(moonMat.uniforms.earthPosition.value);
  }

  var statSky = document.getElementById('stat-sky');
  if (statSky) {
    if (!state.dayNightCycle) statSky.textContent = 'Deep space';
    else if (dayBlend > 0.62) statSky.textContent = 'Day sky';
    else if (dayBlend < 0.32) statSky.textContent = 'Night sky';
    else statSky.textContent = 'Sunrise / sunset';
  }
}

function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.05);

  if (state.motionFrozen) {
    freezeAllBodies();
  } else {
    if (sunGroup.children.length && state.planetSpin) {
      sunCore.rotation.y = advanceSpin(sunCore.rotation.y, SUN.rotDays, dt, false);
    }

    planets.forEach(function (g) {
      var d = g.userData;
      if (state.planetOrbit) {
        d.angle = advanceOrbit(d.angle, d.def.periodDays, dt);
        g.position.set(d.orbit * Math.cos(d.angle), 0, d.orbit * Math.sin(d.angle));
      }
      if (state.planetSpin) {
        if (d.body) {
          d.body.rotation.y = advanceSpin(d.body.rotation.y, d.def.rotDays, dt, d.def.retrograde);
        } else {
          d.mesh.rotation.y = advanceSpin(d.mesh.rotation.y, d.def.rotDays, dt, d.def.retrograde);
        }
      }
      var spinTarget = d.body || g;
      spinTarget.children.forEach(function (ch) {
        if (ch.userData && ch.userData.isClouds && state.planetSpin) {
          ch.rotation.y = advanceSpin(ch.rotation.y, d.def.rotDays * 1.02, dt, false);
        }
        if (ch.userData && ch.userData.orbit) {
          if (state.planetOrbit) {
            ch.userData.angle = advanceOrbit(ch.userData.angle, ch.userData.orbitDays, dt);
            ch.position.set(
              Math.cos(ch.userData.angle) * ch.userData.orbit,
              0,
              Math.sin(ch.userData.angle) * ch.userData.orbit
            );
          }
          if (state.planetSpin) {
            ch.rotation.y = advanceSpin(ch.userData.rotation || 0, MOON_ROT_DAYS, dt, false);
            ch.userData.rotation = ch.rotation.y;
          }
        }
      });
    });
  }

  updateCamera();
  updateSkyCycle();
  composer.render();
  labelRenderer.render(scene, camera);

  fpsFrames++;
  var now = performance.now();
  if (now - fpsLast >= 500) {
    document.getElementById('stat-fps').textContent = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0; fpsLast = now;
  }
}

async function boot() {
  try {
    var loadKeys = ['sun', 'mercury', 'venus', 'earth', 'earthNight', 'earthClouds', 'mars',
      'jupiter', 'saturn', 'saturnRing', 'uranus', 'neptune', 'moon', 'starsSky'];
    var statusEl = document.getElementById('loadingStatus');
    var loaded = await Promise.all(loadKeys.map(function (k) {
      return loadTexCandidates(k).then(function (hit) {
        if (statusEl) statusEl.textContent = 'Loaded ' + hit.file + ' (' + k + ')…';
        return [k, prepTex(hit.tex), hit.file];
      }).catch(function (err) {
        throw new Error('Texture "' + k + '": ' + (err && err.message ? err.message : err));
      });
    }));
    var textures = {};
    var resHint = [];
    loaded.forEach(function (triple) {
      var k = triple[0];
      textures[k === 'saturnRing' ? 'saturn_ring' : k === 'earthNight' ? 'earth_night'
        : k === 'earthClouds' ? 'earth_clouds' : k === 'starsSky' ? 'starsSky' : k] = triple[1];
      if (triple[2].indexOf('8k_') === 0) resHint.push(k);
    });
    if (statusEl && resHint.length) {
      statusEl.textContent = '8K maps ready — zoom any planet to see detail.';
    }

    buildScene(textures);
    buildLegend();
    initControls();
    setSelected('sun');
    setCamLimits('sun');
    stopAllMotion({ flash: false });
    var timeSlider = document.getElementById('timeScale');
    if (timeSlider) timeSlider.value = String(TIME_SLIDER_DEFAULT);
    state.daysPerSecond = daysPerSecondFromSlider(TIME_SLIDER_DEFAULT);
    updateTimeScaleUI();
    if (loadingEl) {
      setTimeout(function () { loadingEl.classList.add('hidden'); }, 400);
    }
    animate();
  } catch (e) {
    if (loadingEl) loadingEl.classList.add('hidden');
    fail('Planet textures failed to load. Check your connection and hard-refresh (Ctrl+Shift+R).');
    console.error(e);
  }
}

boot();