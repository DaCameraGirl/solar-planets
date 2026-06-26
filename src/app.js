import * as THREE from 'three';

var errBox = document.getElementById('error');
function fail(msg) {
  if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
  console.error(msg);
}

var container = document.getElementById('view');
if (!container) { fail('Missing #view container'); throw new Error('no view'); }

var state = {
  autoOrbit: true,
  showOrbits: true,
  showLabels: true,
  timeScale: 1.0,
  selected: 'sun'
};

var BODIES = [
  {
    id: 'mercury', name: 'Mercury', color: '#b5b5b5', size: 0.38, orbit: 10, speed: 4.15,
    desc: 'The swift inner world — scorched, cratered, and closest to the Sun.',
    facts: { 'Day length': '59 Earth days', 'Year': '88 Earth days', 'Moons': '0' }
  },
  {
    id: 'venus', name: 'Venus', color: '#e8cda0', size: 0.95, orbit: 14, speed: 1.62,
    desc: "A brilliant sulfuric haze world — Earth's twin in size, opposite in temperament.",
    facts: { 'Day length': '243 Earth days', 'Year': '225 Earth days', 'Moons': '0' }
  },
  {
    id: 'earth', name: 'Earth', color: '#4a9eff', size: 1.0, orbit: 18, speed: 1.0,
    desc: 'Our home — blue oceans, white clouds, and the only known harbor of life.',
    facts: { 'Day length': '24 hours', 'Year': '365 days', 'Moons': '1 (Luna)' }
  },
  {
    id: 'mars', name: 'Mars', color: '#c1440e', size: 0.53, orbit: 23, speed: 0.53,
    desc: "The red frontier — dust storms, polar ice, and humanity's next horizon.",
    facts: { 'Day length': '24.6 hours', 'Year': '687 Earth days', 'Moons': '2' }
  },
  {
    id: 'jupiter', name: 'Jupiter', color: '#d4a574', size: 2.8, orbit: 32, speed: 0.084,
    desc: 'The giant king — banded storms and a magnetosphere that shapes the outer system.',
    facts: { 'Day length': '9.9 hours', 'Year': '12 Earth years', 'Moons': '95+' }
  },
  {
    id: 'saturn', name: 'Saturn', color: '#f0d9a8', size: 2.35, orbit: 42, speed: 0.034,
    desc: 'The ringed jewel — ice and rock in a halo that defines the solar aesthetic.',
    facts: { 'Day length': '10.7 hours', 'Year': '29 Earth years', 'Moons': '146+' },
    rings: true
  },
  {
    id: 'uranus', name: 'Uranus', color: '#7de3f4', size: 1.6, orbit: 52, speed: 0.012,
    desc: 'The tilted ice giant — rolling on its side through a pale cyan haze.',
    facts: { 'Day length': '17 hours', 'Year': '84 Earth years', 'Moons': '28' }
  },
  {
    id: 'neptune', name: 'Neptune', color: '#3d5afe', size: 1.55, orbit: 60, speed: 0.006,
    desc: 'The deep blue sentinel — supersonic winds at the edge of our planetary family.',
    facts: { 'Day length': '16 hours', 'Year': '165 Earth years', 'Moons': '16' }
  }
];

var SUN = {
  id: 'sun', name: 'Sun', color: '#ffd54f',
  desc: 'The engine of the system — fusion fire, light, and gravity holding every world in dance.',
  facts: { 'Type': 'G-type main sequence', 'Age': '~4.6 billion years', 'Planets': '8' }
};

// ---- renderer -----------------------------------------------------------
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 28, 52);

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// ---- lights & stars -----------------------------------------------------
scene.add(new THREE.AmbientLight(0x223355, 0.35));
var sunLight = new THREE.PointLight(0xfff0cc, 3.2, 220, 1.4);
scene.add(sunLight);

var starGeo = new THREE.BufferGeometry();
var starCount = 3200;
var starPos = new Float32Array(starCount * 3);
for (var i = 0; i < starCount; i++) {
  var r = 120 + Math.random() * 80;
  var theta = Math.random() * Math.PI * 2;
  var phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.55, transparent: true, opacity: 0.75, sizeAttenuation: true
}));
scene.add(stars);

// ---- textures (procedural) ----------------------------------------------
function planetTexture(hex, style) {
  var c = document.createElement('canvas');
  c.width = c.height = 512;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(160, 140, 20, 256, 256, 280);
  g.addColorStop(0, lighten(hex, 40));
  g.addColorStop(0.45, hex);
  g.addColorStop(1, darken(hex, 50));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  if (style === 'bands') {
    for (var b = 0; b < 14; b++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.06 + Math.random() * 0.08) + ')';
      ctx.fillRect(0, b * 36 + Math.random() * 10, 512, 18 + Math.random() * 20);
    }
  }
  if (style === 'clouds') {
    for (var cl = 0; cl < 40; cl++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.12) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 80, 10 + Math.random() * 30, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (style === 'craters') {
    for (var cr = 0; cr < 35; cr++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lighten(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = Math.min(255, ((n >> 16) & 255) + amt);
  var g = Math.min(255, ((n >> 8) & 255) + amt);
  var b = Math.min(255, (n & 255) + amt);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function darken(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = Math.max(0, ((n >> 16) & 255) - amt);
  var g = Math.max(0, ((n >> 8) & 255) - amt);
  var b = Math.max(0, (n & 255) - amt);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

var STYLE = {
  mercury: 'craters', venus: 'clouds', earth: 'clouds', mars: 'craters',
  jupiter: 'bands', saturn: 'bands', uranus: 'clouds', neptune: 'clouds'
};

// ---- sun ----------------------------------------------------------------
var sunGroup = new THREE.Group();
var sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0xffdd66 })
);
var sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(4.8, 48, 48),
  new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.18 })
);
var sunCorona = new THREE.Mesh(
  new THREE.SphereGeometry(6.5, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.06 })
);
sunGroup.add(sunCorona); sunGroup.add(sunGlow); sunGroup.add(sunCore);
scene.add(sunGroup);

// ---- planets ------------------------------------------------------------
var planets = [];
var orbitLines = [];
var labels = [];

BODIES.forEach(function (def, idx) {
  var group = new THREE.Group();
  var meshSize = 0.55 + def.size * 0.55;
  var tex = planetTexture(def.color, STYLE[def.id] || 'clouds');
  var mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.82, metalness: 0.08,
    emissive: new THREE.Color(def.color), emissiveIntensity: 0.04
  });
  var mesh = new THREE.Mesh(new THREE.SphereGeometry(meshSize, 48, 48), mat);
  group.add(mesh);

  if (def.rings) {
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(meshSize * 1.35, meshSize * 2.1, 96),
      new THREE.MeshBasicMaterial({ color: 0xdcc99a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);
  }

  var halo = new THREE.Mesh(
    new THREE.SphereGeometry(meshSize * 1.35, 24, 24),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.07 })
  );
  group.add(halo);

  var tilt = (idx % 5) * 0.18 - 0.35;
  group.userData = {
    def: def, angle: (idx / BODIES.length) * Math.PI * 2,
    orbit: def.orbit, speed: def.speed, tilt: tilt, mesh: mesh, spin: 0.3 + idx * 0.07
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
    color: 0x4fd6e0, transparent: true, opacity: 0.22
  }));
  scene.add(orbitLine);
  orbitLines.push(orbitLine);

  scene.add(group);
  planets.push(group);
});

// Earth moon
var earth = planets[2];
if (earth) {
  var moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 })
  );
  moon.userData.orbit = 1.6;
  moon.userData.speed = 3.5;
  moon.userData.angle = 0;
  earth.add(moon);
}

// ---- interaction --------------------------------------------------------
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var drag = { active: false, lx: 0, ly: 0 };
var camTheta = 0.9, camPhi = 0.55, camDist = 58, camTarget = new THREE.Vector3();

function pickables() {
  var list = [sunCore, sunGlow];
  planets.forEach(function (g) { list.push(g.userData.mesh); });
  return list;
}

function setSelected(id) {
  state.selected = id;
  var info = id === 'sun' ? SUN : BODIES.find(function (b) { return b.id === id; });
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
  setSelected(id);
  if (id === 'sun') camTarget.set(0, 0, 0);
  else {
    var g = planets.find(function (p) { return p.userData.def.id === id; });
    if (g) camTarget.copy(g.position);
  }
}

function buildLegend() {
  var box = document.getElementById('legend');
  box.innerHTML = '';
  [{ id: 'sun', name: 'Sun', color: '#ffd54f' }].concat(BODIES.map(function (b) {
    return { id: b.id, name: b.name, color: b.color };
  })).forEach(function (item) {
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
});
bind('showLabels', 'change', function (e) { state.showLabels = e.target.checked; });
bind('timeScale', 'input', function (e) {
  state.timeScale = 0.05 + (+e.target.value / 100) * 2.5;
  document.getElementById('stat-scale').textContent = 'time ×' + state.timeScale.toFixed(1);
});
bind('resetCam', 'click', function () {
  camTheta = 0.9; camPhi = 0.55; camDist = 58; camTarget.set(0, 0, 0);
});
bind('focusSun', 'click', function () { focusBody('sun'); });

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
  var dt = Math.min(clock.getDelta(), 0.05) * state.timeScale;

  sunGroup.rotation.y += dt * 0.08;
  var pulse = 1 + 0.04 * Math.sin(clock.elapsedTime * 1.4);
  sunGlow.scale.setScalar(pulse);
  sunCorona.scale.setScalar(1 + 0.06 * Math.sin(clock.elapsedTime * 0.9));

  planets.forEach(function (g) {
    var d = g.userData;
    d.angle += dt * d.speed * 0.12;
    g.position.set(
      d.orbit * Math.cos(d.angle),
      d.orbit * Math.sin(d.angle) * Math.cos(d.tilt),
      d.orbit * Math.sin(d.angle) * Math.sin(d.tilt)
    );
    d.mesh.rotation.y += dt * d.spin;
    g.children.forEach(function (ch) {
      if (ch.userData && ch.userData.orbit) {
        ch.userData.angle += dt * ch.userData.speed * 0.4;
        ch.position.set(
          Math.cos(ch.userData.angle) * ch.userData.orbit,
          0,
          Math.sin(ch.userData.angle) * ch.userData.orbit
        );
      }
    });
  });

  updateCamera();
  renderer.render(scene, camera);

  fpsFrames++;
  var now = performance.now();
  if (now - fpsLast >= 500) {
    document.getElementById('stat-fps').textContent = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0; fpsLast = now;
  }
}

buildLegend();
setSelected('sun');
document.getElementById('stat-scale').textContent = 'time ×' + state.timeScale.toFixed(1);
animate();