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
  autoOrbit: true,
  showOrbits: true,
  showLabels: true,
  daysPerSecond: 9,
  selected: 'sun'
};

var EARTH_YEAR_DAYS = 365.25;

function daysPerSecondFromSlider(val) {
  return 0.25 + (val / 100) * 24.75;
}

function formatSimSpeed(daysPerSec) {
  if (daysPerSec < 1) {
    var hrs = daysPerSec * 24;
    if (hrs < 1) return '1 sec = ' + Math.round(daysPerSec * 24 * 60) + ' min';
    return '1 sec = ' + hrs.toFixed(1) + ' hours';
  }
  if (daysPerSec < 45) return '1 sec = ' + daysPerSec.toFixed(1) + ' Earth days';
  var months = daysPerSec / 30.44;
  if (months < 18) return '1 sec = ' + months.toFixed(1) + ' months';
  return '1 sec = ' + (daysPerSec / EARTH_YEAR_DAYS).toFixed(2) + ' years';
}

function updateTimeScaleUI() {
  var label = formatSimSpeed(state.daysPerSecond);
  var stat = document.getElementById('stat-scale');
  var panel = document.getElementById('timeScaleLabel');
  var earthHint = document.getElementById('timeScaleEarth');
  if (stat) stat.textContent = label;
  if (panel) panel.textContent = label;
  if (earthHint) {
    var yearSec = EARTH_YEAR_DAYS / state.daysPerSecond;
    var spinSec = 1 / state.daysPerSecond;
    var yearLabel = yearSec >= 60 ? (yearSec / 60).toFixed(1) + ' min' : yearSec.toFixed(0) + ' sec';
    var spinLabel = spinSec >= 1 ? spinSec.toFixed(1) + ' sec' : (spinSec * 1000).toFixed(0) + ' ms';
    earthHint.textContent = 'Earth year ≈ ' + yearLabel + ' · 1 Earth day (1 spin) ≈ ' + spinLabel;
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

// Bundled same-origin (Solar System Scope 2K maps) — external CDN blocks WebGL CORS.
var TEXTURE_BASE = 'assets/textures/';
var TEXTURES = {
  sun: TEXTURE_BASE + '2k_sun.jpg',
  mercury: TEXTURE_BASE + '2k_mercury.jpg',
  venus: TEXTURE_BASE + '2k_venus_surface.jpg',
  earth: TEXTURE_BASE + '2k_earth_daymap.jpg',
  earthClouds: TEXTURE_BASE + '2k_earth_clouds.jpg',
  mars: TEXTURE_BASE + '2k_mars.jpg',
  jupiter: TEXTURE_BASE + '2k_jupiter.jpg',
  saturn: TEXTURE_BASE + '2k_saturn.jpg',
  saturnRing: TEXTURE_BASE + '2k_saturn_ring_alpha.png',
  uranus: TEXTURE_BASE + '2k_uranus.jpg',
  neptune: TEXTURE_BASE + '2k_neptune.jpg',
  moon: TEXTURE_BASE + '2k_moon.jpg'
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
    map: TEXTURES.earth, clouds: TEXTURES.earthClouds
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

var MOON_ORBIT_DAYS = 27.3;
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

// ---- renderer -----------------------------------------------------------
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 500);
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
  0.32, 0.52, 0.94
);
composer.addPass(bloomPass);

var labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

// ---- lights & stars -----------------------------------------------------
scene.add(new THREE.AmbientLight(0x2a3558, 0.14));
scene.add(new THREE.HemisphereLight(0xb8d4ff, 0x1a1424, 0.28));
var sunLight = new THREE.PointLight(0xfff8e8, 8.5, 320, 1.6);
var starGeo = new THREE.BufferGeometry();
var starCount = 5200;
var starPos = new Float32Array(starCount * 3);
var starCol = new Float32Array(starCount * 3);
for (var i = 0; i < starCount; i++) {
  var r = 120 + Math.random() * 80;
  var theta = Math.random() * Math.PI * 2;
  var phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
  var tint = 0.82 + Math.random() * 0.18;
  starCol[i * 3] = tint;
  starCol[i * 3 + 1] = tint * (0.94 + Math.random() * 0.06);
  starCol[i * 3 + 2] = 1;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  vertexColors: true, size: 0.45, transparent: true, opacity: 0.9, sizeAttenuation: true
}));
scene.add(stars);

// ---- sun & planets (textures loaded at boot) ------------------------------
var sunGroup = new THREE.Group();
var sunCore, sunGlow, sunCorona;
var planets = [];
var orbitLines = [];
var labelObjs = [];
var moonMesh = null;

function makeLabel(text) {
  var el = document.createElement('div');
  el.className = 'planet-label';
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
  sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 72, 72),
    new THREE.MeshBasicMaterial({ map: textures.sun, color: 0xffffff })
  );
  sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffe8a8, transparent: true, opacity: 0.18 })
  );
  sunCorona = new THREE.Mesh(
    new THREE.SphereGeometry(6.2, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9933, transparent: true, opacity: 0.06 })
  );
  sunGroup.add(sunCorona); sunGroup.add(sunGlow); sunGroup.add(sunCore);
  sunGroup.add(sunLight);
  scene.add(sunGroup);

  var sunLabel = makeLabel('Sun');
  sunLabel.position.set(0, 5.2, 0);
  sunGroup.add(sunLabel);
  labelObjs.push(sunLabel);

  BODIES.forEach(function (def, idx) {
    var group = new THREE.Group();
    var meshSize = 0.55 + def.size * 0.55;
    var segs = def.segments || 56;
    var body = new THREE.Group();
    body.rotation.x = def.axialTilt || 0;
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(meshSize, segs, segs),
      planetMaterial(def, textures[def.id])
    );
    body.add(mesh);
    group.add(body);

    if (def.atmosphere) addAtmosphere(body, meshSize, def.atmosphere);

    if (def.clouds && textures[def.id + '_clouds']) {
      var clouds = new THREE.Mesh(
        new THREE.SphereGeometry(meshSize * 1.015, segs, segs),
        new THREE.MeshBasicMaterial({
          map: textures[def.id + '_clouds'],
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          color: 0xffffff
        })
      );
      clouds.userData.isClouds = true;
      body.add(clouds);
    }

    if (def.rings && textures.saturn_ring) {
      body.add(makeRingMesh(meshSize * 1.35, meshSize * 2.35, textures.saturn_ring));
    }

    var tilt = (idx % 5) * 0.12 - 0.22;
    group.userData = {
      def: def,
      angle: Math.PI + idx * 0.62,
      orbit: def.orbit, tilt: tilt, mesh: mesh, body: body, rotation: 0
    };

    var orbitPts = [];
    for (var s = 0; s <= 128; s++) {
      var a = (s / 128) * Math.PI * 2;
      orbitPts.push(
        def.orbit * Math.cos(a),
        def.orbit * Math.sin(a) * Math.cos(tilt),
        def.orbit * Math.sin(a) * Math.sin(tilt)
      );
    }
    var orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(orbitPts, 3));
    var orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
      color: 0x3a4a68, transparent: true, opacity: 0.14
    }));
    scene.add(orbitLine);
    orbitLines.push(orbitLine);

    var label = makeLabel(def.name);
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
    var moonMat = moonTex
      ? planetMaterial({ id: 'moon' }, moonTex)
      : new THREE.MeshBasicMaterial({ color: 0xcccccc });
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(earthSize * 0.28, 36, 36), moonMat);
    moonMesh.userData.orbit = moonOrbit;
    moonMesh.userData.orbitDays = MOON_ORBIT_DAYS;
    moonMesh.userData.angle = 0;
    moonMesh.userData.rotation = 0;
    moonMesh.userData.isMoon = true;
    earth.userData.body.add(moonMesh);

    var moonLabel = makeLabel('Moon');
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
    var moonOrbitLine = new THREE.Line(moonOrbitGeo, new THREE.LineBasicMaterial({
      color: 0x8899bb, transparent: true, opacity: 0.2
    }));
    moonOrbitLine.userData.isMoonOrbit = true;
    earth.userData.body.add(moonOrbitLine);
  }

  var statBodies = document.getElementById('stat-bodies');
  if (statBodies) statBodies.textContent = String(9 + (moonMesh ? 1 : 0));
}

// ---- interaction --------------------------------------------------------
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var drag = { active: false, lx: 0, ly: 0 };
var camTheta = 0.75, camPhi = 0.42, camDist = 58, camTarget = new THREE.Vector3();

function pickables() {
  var list = [];
  if (sunCore) list.push(sunCore, sunGlow);
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
}

function focusBody(id) {
  if (id === 'sun') {
    setSelected('sun');
    camTarget.set(0, 0, 0);
    camDist = 50;
    camPhi = 0.48;
    snapCameraToTarget();
    return;
  }
  if (id === 'moon' && moonMesh) {
    setSelected('moon');
    moonMesh.getWorldPosition(camTarget);
    camDist = 10;
    camPhi = 0.55;
    snapCameraToTarget();
    return;
  }
  setSelected(id);
  var g = planets.find(function (p) { return p.userData.def.id === id; });
  if (g) {
    camTarget.copy(g.position);
    var meshR = 0.55 + g.userData.def.size * 0.55;
    camDist = Math.max(meshR * 3.2, 8 + meshR * 2.8);
    camPhi = 0.52;
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
  if (obj === sunCore || obj === sunGlow) focusBody('sun');
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
  camDist = Math.max(14, Math.min(120, camDist + e.deltaY * 0.04));
}, { passive: false });

function bind(id, evt, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}
bind('autoOrbit', 'change', function (e) { state.autoOrbit = e.target.checked; });
bind('showOrbits', 'change', function (e) {
  state.showOrbits = e.target.checked;
  orbitLines.forEach(function (l) { l.visible = state.showOrbits; });
  planets.forEach(function (g) {
    if (!g.userData.body) return;
    g.userData.body.children.forEach(function (ch) {
      if (ch.userData && ch.userData.isMoonOrbit) ch.visible = state.showOrbits;
    });
  });
});
bind('showLabels', 'change', function (e) {
  state.showLabels = e.target.checked;
  labelObjs.forEach(function (l) { l.visible = state.showLabels; });
});
bind('timeScale', 'input', function (e) {
  state.daysPerSecond = daysPerSecondFromSlider(+e.target.value);
  updateTimeScaleUI();
});
bind('resetCam', 'click', function () {
  camTheta = 0.75; camPhi = 0.42; camDist = 58; camTarget.set(0, 0, 0);
  snapCameraToTarget();
});
bind('focusSun', 'click', function () { focusBody('sun'); });
bind('focusEarth', 'click', function () { focusBody('earth'); });
bind('focusMoon', 'click', function () { focusBody('moon'); });

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
  if (state.autoOrbit) camTheta += 0.0018;
  var x = camTarget.x + camDist * Math.sin(camPhi) * Math.cos(camTheta);
  var y = camTarget.y + camDist * Math.cos(camPhi);
  var z = camTarget.z + camDist * Math.sin(camPhi) * Math.sin(camTheta);
  camera.position.lerp(new THREE.Vector3(x, y, z), 0.08);
  camera.lookAt(camTarget);
}

function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.05);

  if (sunGroup.children.length) {
    sunCore.rotation.y = advanceSpin(sunCore.rotation.y, SUN.rotDays, dt, false);
    var pulse = 1 + 0.025 * Math.sin(clock.elapsedTime * 1.1);
    if (sunGlow) sunGlow.scale.setScalar(pulse);
    if (sunCorona) sunCorona.scale.setScalar(1 + 0.035 * Math.sin(clock.elapsedTime * 0.7));
  }

  planets.forEach(function (g) {
    var d = g.userData;
    d.angle = advanceOrbit(d.angle, d.def.periodDays, dt);
    g.position.set(
      d.orbit * Math.cos(d.angle),
      d.orbit * Math.sin(d.angle) * Math.cos(d.tilt),
      d.orbit * Math.sin(d.angle) * Math.sin(d.tilt)
    );
    if (d.body) {
      d.body.rotation.y = advanceSpin(d.body.rotation.y, d.def.rotDays, dt, d.def.retrograde);
    } else {
      d.mesh.rotation.y = advanceSpin(d.mesh.rotation.y, d.def.rotDays, dt, d.def.retrograde);
    }
    var spinTarget = d.body || g;
    spinTarget.children.forEach(function (ch) {
      if (ch.userData && ch.userData.isClouds) {
        ch.rotation.y = advanceSpin(ch.rotation.y, d.def.rotDays * 0.55, dt, false);
      }
      if (ch.userData && ch.userData.orbit) {
        ch.userData.angle = advanceOrbit(ch.userData.angle, ch.userData.orbitDays, dt);
        ch.rotation.y = advanceSpin(ch.userData.rotation || 0, MOON_ROT_DAYS, dt, false);
        ch.userData.rotation = ch.rotation.y;
        ch.position.set(
          Math.cos(ch.userData.angle) * ch.userData.orbit,
          0,
          Math.sin(ch.userData.angle) * ch.userData.orbit
        );
      }
    });
  });

  updateCamera();
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
    var urls = { sun: TEXTURES.sun, saturn_ring: TEXTURES.saturnRing, moon: TEXTURES.moon };
    BODIES.forEach(function (b) {
      urls[b.id] = b.map;
      if (b.clouds) urls[b.id + '_clouds'] = b.clouds;
    });
    var keys = Object.keys(urls);
    var loaded = await Promise.all(keys.map(function (k) {
      return loadTex(urls[k]).then(function (t) { return [k, prepTex(t)]; })
        .catch(function (err) {
          throw new Error('Texture "' + k + '" (' + urls[k] + '): ' + (err && err.message ? err.message : err));
        });
    }));
    var textures = {};
    loaded.forEach(function (pair) { textures[pair[0]] = pair[1]; });

    buildScene(textures);
    buildLegend();
    setSelected('sun');
    state.daysPerSecond = daysPerSecondFromSlider(35);
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