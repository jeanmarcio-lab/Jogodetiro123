(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
var rnd = function (a, b) { return a + Math.random() * (b - a); };
var angDiff = function (a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function showFatal(msg) {
  var d = document.getElementById('fatal');
  if (!d) { d = document.createElement('div'); d.id = 'fatal'; d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b3261e;color:#fff;font:600 16px/1.4 sans-serif;padding:16px;text-align:center'; document.body.appendChild(d); }
  d.textContent = msg;
}
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('combatarena.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('combatarena.' + k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- progression ---------- */
var RANKS = ['Recruta', 'Soldado', 'Cabo', 'Sargento', 'Subtenente', 'Tenente', 'Capitão', 'Major', 'Coronel', 'General'];
var levelOf = function (xp) { return Math.floor(Math.sqrt(xp / 120)) + 1; };
var xpFor = function (l) { return (l - 1) * (l - 1) * 120; };
var rankOf = function (l) { return RANKS[Math.min(RANKS.length - 1, Math.floor((l - 1) / 2))]; };
var AVATARS = ['#4fd1c5', '#f0b429', '#9f8cff', '#7bd88f'];
var profile = Object.assign({ name: 'Operador', color: 0, xp: 0, wins: 0, losses: 0, kills: 0, deaths: 0, history: [], coins: 0, claimed: [], owned: [], skin: '', trail: '' }, LS.get('profile', {}));
var S = Object.assign({ sens: 1, sound: true, diff: 'normal', map: 'industrial', weapon: 'rifle', char: 'sombra' }, LS.get('settings', {}));
var saveProfile = function () { LS.set('profile', profile); };
var saveSettings = function () { LS.set('settings', S); };

/* ---------- data ---------- */
var WEAPONS = {
  rifle:   { name: 'Cajado Rúnico', col: 0x4fd1c5,    dmg: 13, rate: 0.09, mag: 30, reload: 1.7, spread: 0.012, auto: true,  pellets: 1, range: 90,  kick: 0.5, stats: [3, 5, 3], ideal: 11, desc: 'Orbes rúnicos em rajada' },
  pistol:  { name: 'Pistola Gema', col: 0xff7ac8,    dmg: 24, rate: 0.2,  mag: 12, reload: 1.2, spread: 0.006, auto: false, pellets: 1, range: 70,  kick: 0.6, stats: [2, 3, 2], ideal: 9,  desc: 'Tiro único e preciso' },
  shotgun: { name: 'Canhão Dracônico', col: 0xff8a3d,  dmg: 9, rate: 0.85, mag: 6,  reload: 2.2, spread: 0.07,  auto: false, pellets: 8, range: 30,  kick: 1.4, stats: [5, 2, 1], ideal: 5,  desc: 'Fogo de dragão de perto' },
  sniper:  { name: 'Besta Estelar', col: 0xb89bff,    dmg: 48, rate: 1.2,  mag: 5,  reload: 2.4, spread: 0.002, auto: false, pellets: 1, range: 200, kick: 2.0, stats: [5, 1, 5], ideal: 18, desc: 'Estrela de longo alcance' }
};
var DIFF = {
  easy:   { name: 'Fácil',   turn: 2.4, err: 0.05,  react: 0.7,  dmg: 0.55, speed: 3.8, fireMul: 1.5 },
  normal: { name: 'Normal',  turn: 3.8, err: 0.032, react: 0.42, dmg: 0.75, speed: 4.7, fireMul: 1.2 },
  hard:   { name: 'Difícil', turn: 6.5, err: 0.018, react: 0.25, dmg: 1.0,  speed: 5.6, fireMul: 1.0 }
};
var HALF = 22, KILLS_TO_WIN = 10, MATCH_TIME = 300;
var MAPS = {
  industrial: { name: 'Arena Industrial', desc: 'Contêineres e corredores estreitos.', sky: 0x18222b, fog: [28, 110], floor: '#262d34', line: '#364451', wall: 0x3b4652, cols: [0x58708a, 0x9a6232, 0x4a6b58], edge: 0xf0b429,
    half: [[-9, -6, 6, 2.6, 2.8], [-15, 7, 2.6, 6, 2.8], [-4, 9, 4, 4, 1.2], [-16, -14, 3, 3, 4.2], [-1, -11, 2, 2, 3.5]], center: [[0, 0, 3, 3, 1.4]] },
  city: { name: 'Cidade Abandonada', desc: 'Prédios caídos e muros baixos.', sky: 0x2a2f36, fog: [24, 100], floor: '#2e3235', line: '#3c4146', wall: 0x4a4f55, cols: [0x5d636b, 0x6b5a4e, 0x484d52], edge: 0x7a8793,
    half: [[-8, -12, 8, 3, 3], [-14, -3, 3, 8, 3.6], [-5, 4, 3, 3, 1.3], [-13, 12, 6, 3, 2.6], [-2, -5, 2, 2, 2.2]], center: [[0, 0, 2, 6, 1.4]] },
  base: { name: 'Base Militar', desc: 'Bunkers e barricadas de concreto.', sky: 0x1b2a1f, fog: [26, 105], floor: '#2b3329', line: '#3b4a38', wall: 0x3d4a3a, cols: [0x4f6147, 0x66704f, 0x3e4b3a], edge: 0xa8c96a,
    half: [[-7, -7, 4, 4, 2.2], [-15, -2, 2, 10, 2.4], [-5, 6, 7, 2, 1.6], [-14, 14, 4, 4, 3.2], [-1, -16, 10, 2, 2.6]], center: [[0, 0, 3, 3, 1]] },
  desert: { name: 'Deserto', desc: 'Rochas e pilares, tiros longos.', sky: 0xd2b27d, fog: [30, 120], floor: '#b99a66', line: '#a98a58', wall: 0x8a6a45, cols: [0x9c7a4d, 0x7d6a52, 0xa8895c], edge: 0x5d4630,
    half: [[-10, -8, 3, 3, 3.2], [-6, 6, 5, 2, 1.4], [-16, 0, 2, 2, 5], [-12, 14, 4, 3, 2], [-3, -15, 2, 6, 1.8]], center: [[0, 0, 4, 4, 1.2]] },
  future: { name: 'Instalação Futurista', desc: 'Pilares neon e cobertura alta.', sky: 0x0c1020, fog: [26, 100], floor: '#10172a', line: '#1f3a6b', wall: 0x182446, cols: [0x24355e, 0x2c2a5c, 0x1f4a5a], edge: 0x4fd1c5, glow: true,
    half: [[-8, -8, 2, 2, 5], [-14, -4, 2, 8, 2.6], [-6, 4, 6, 1.5, 2], [-12, 12, 3, 3, 3], [-2, -16, 8, 1.5, 2.6]], center: [[0, 0, 2, 2, 4]] }
};
Object.assign(MAPS.industrial, { sky: 0x3b7be0, floor: '#46566e', line: '#6f84a6', wall: 0x5b6fa0, cols: [0xe8503a, 0xf5b82e, 0x25b8cc], edge: 0xffffff, stairs: [[-11, 1, 0, 6, 3]], pads: [[-8, -12.5]] }); MAPS.industrial.half.push([-8, -16, 3, 3, 3]);
Object.assign(MAPS.city, { sky: 0xff8f5a, floor: '#5d5a78', line: '#8581aa', wall: 0x9a5a86, cols: [0xff5d8f, 0x8a5cff, 0xffc04a], edge: 0xffe0a0, stairs: [[-3, -10, 2, 6, 3]], pads: [[-10, 9]] }); MAPS.city.half.push([-13, 7, 3, 3, 3]);
Object.assign(MAPS.base, { sky: 0x4ed9ac, floor: '#3f8a52', line: '#66b878', wall: 0x2f7a68, cols: [0xa8e05a, 0xf5d848, 0x2fb8a8], edge: 0xffffff, stairs: [[-12, 5, 0, 6, 3]], pads: [[-3, 12]] }); MAPS.base.half.push([-5, 15, 3, 3, 3]);
Object.assign(MAPS.desert, { sky: 0xffc766, floor: '#eebd68', line: '#d79a4a', wall: 0xc9783a, cols: [0xe8603a, 0x25b8b8, 0xc2508e], edge: 0x7a3a1a, stairs: [[-8, 12, 0, 6, 3]], pads: [[-14, -6]] }); MAPS.desert.half.push([-17, -9, 3, 3, 3]);
Object.assign(MAPS.future, { sky: 0x2a1a78, floor: '#1c2266', line: '#00e5ff', wall: 0x4a34a8, cols: [0xff2fb4, 0x00e5ff, 0x9a5cff], edge: 0xff2fb4, stairs: [[-11, -3, 0, 6, 3]], pads: [[-4, -12]] }); MAPS.future.half.push([-8, -13, 3, 3, 3]);
var SPAWNS = [[-18, -18], [18, 18], [-18, 18], [18, -18], [0, -19], [0, 19]];
var BOT_NAMES = ['MOCHI', 'PIXEL', 'BRISA', 'NOVA', 'TOTÓ', 'LUNA'];
var CHARS = {
  sombra:    { name: 'Sombra', power: 'Passo Sombrio',   desc: 'Avanço rápido na direção em que você anda.', cd: 6,  body: 0x4a3b52, legCol: 0x2d2433, boot: 0x1f1823, glove: 0x6b4f3a },
  cavaleiro: { name: 'Aurora', power: 'Escudo Dourado',  desc: 'Recebe 65% menos dano por 4 s.',             cd: 14, body: 0xd9a441, legCol: 0x9aa3b0, boot: 0x6e7681, glove: 0xaab3bf },
  mago:      { name: 'Lume',   power: 'Luz Estelar',     desc: 'Recupera 45 de vida na hora.',               cd: 18, body: 0x5b46c4, legCol: 0x3a2f7a, boot: 0x2a2150, glove: 0xf1c7a0 },
  robo:      { name: 'Tico',   power: 'Sobrecarga',      desc: 'Atira e recarrega quase 2x mais rápido por 5 s.', cd: 14, body: 0xf0f4f7, legCol: 0xf08a3c, boot: 0xf08a3c, glove: 0xf08a3c }
};

/* ---------- three.js ---------- */
var renderer, scene, camera;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a3036, 0.95));
  var sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(20, 40, 10); scene.add(sun);
} catch (err) {
  showFatal('Não foi possível iniciar o 3D (WebGL). Abra o jogo no Chrome ou Edge atualizado, fora do preview do VS Code, e confira se a internet está ligada (o three.js vem da internet).');
  return;
}
var resize = function () {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize); resize();

/* ---------- map ---------- */
var mapGroup = null, boxes = [], pads = [], curMapKey = null;
function floorTexture(base, line) {
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(1, 1, 126, 126);
  g.globalAlpha = 0.45; g.lineWidth = 1; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.anisotropy = 4; return t;
}
function mapList(M) {
  var out = [], n = M.cols.length;
  M.half.forEach(function (b, i) { var c = M.cols[i % n]; out.push([b[0], b[1], b[2], b[3], b[4], c], [-b[0], -b[1], b[2], b[3], b[4], c]); });
  M.center.forEach(function (b) { out.push([b[0], b[1], b[2], b[3], b[4], M.cols[0]]); });
  (M.stairs || []).forEach(function (q, qi) {
    [1, -1].forEach(function (sg) {
      var d = sg > 0 ? q[2] : q[2] ^ 1, dx = [1, -1, 0, 0][d], dz = [0, 0, 1, -1][d], x = q[0] * sg, z = q[1] * sg, w = q[4], i;
      for (i = 0; i < q[3]; i++) out.push([x + dx * (i * 0.8 + 0.4), z + dz * (i * 0.8 + 0.4), dx ? 0.8 : w, dx ? w : 0.8, 0.35 * (i + 1), M.cols[(qi + 1) % n]]);
      out.push([x + dx * (q[3] * 0.8 + 2), z + dz * (q[3] * 0.8 + 2), dx ? 4 : w + 2, dx ? w + 2 : 4, 0.35 * q[3], M.cols[(qi + 2) % n]]);
    });
  });
  return out;
}
function padCheck(e) {
  if (!e.onGround) return;
  for (var i = 0; i < pads.length; i++) if (Math.hypot(e.x - pads[i][0], e.z - pads[i][1]) < 1.1) { e.vy = 13.5; e.onGround = false; tone(500, 0.2, 'sine', 0.1, 2.5); return; }
}
function buildMap(key) {
  if (mapGroup) {
    scene.remove(mapGroup);
    mapGroup.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  }
  var M = MAPS[key]; curMapKey = key; mapGroup = new THREE.Group(); boxes = []; pads = [];
  scene.background = new THREE.Color(M.sky); scene.fog = new THREE.Fog(M.sky, M.fog[0], M.fog[1]);
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ map: floorTexture(M.floor, M.line) }));
  floor.rotation.x = -Math.PI / 2; mapGroup.add(floor);
  function addBox(x, z, w, d, h, color) {
    var mat = new THREE.MeshLambertMaterial({ color: color });
    if (M.glow) { mat.emissive = new THREE.Color(color); mat.emissiveIntensity = 0.25; }
    var geo = new THREE.BoxGeometry(w, h, d);
    var m = new THREE.Mesh(geo, mat); m.position.set(x, h / 2, z); mapGroup.add(m);
    var e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: M.edge }));
    e.position.copy(m.position); mapGroup.add(e);
    boxes.push({ min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, h, z + d / 2], top: h });
  }
  var A = HALF + 1;
  addBox(0, -A, 2 * HALF + 4, 2, 8, M.wall); addBox(0, A, 2 * HALF + 4, 2, 8, M.wall);
  addBox(-A, 0, 2, 2 * HALF + 4, 8, M.wall); addBox(A, 0, 2, 2 * HALF + 4, 8, M.wall);
  mapList(M).forEach(function (q) { addBox(q[0], q[1], q[2], q[3], q[4], q[5]); });
  (M.pads || []).forEach(function (q) { [1, -1].forEach(function (sg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.12, 20), new THREE.MeshBasicMaterial({ color: 0x00ffa0 })); m.position.set(q[0] * sg, 0.06, q[1] * sg); mapGroup.add(m); pads.push([q[0] * sg, q[1] * sg]);
  }); });
  scene.add(mapGroup);
}

/* ---------- geometry helpers ---------- */
function rayBox(o, d, mn, mx, maxT) {
  var t0 = 0, t1 = maxT;
  for (var i = 0; i < 3; i++) {
    var di = d[i];
    if (Math.abs(di) < 1e-8) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; }
    else {
      var a = (mn[i] - o[i]) / di, b = (mx[i] - o[i]) / di;
      if (a > b) { var t = a; a = b; b = t; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return -1;
    }
  }
  return t0;
}
function blocked(from, to) {
  var dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], len = Math.hypot(dx, dy, dz);
  var d = [dx / len, dy / len, dz / len];
  for (var i = 0; i < boxes.length; i++) { var t = rayBox(from, d, boxes[i].min, boxes[i].max, len); if (t >= 0 && t < len - 0.05) return true; }
  return false;
}
function hitsBlock(e) {
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i]; if (b.top <= e.y + 0.35) continue;
    if (e.x + e.r > b.min[0] && e.x - e.r < b.max[0] && e.z + e.r > b.min[2] && e.z - e.r < b.max[2]) return true;
  }
  return false;
}
function groundAt(e) {
  var g = 0;
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    if (b.top <= e.y + 0.35 && b.top > g && e.x > b.min[0] - 0.2 && e.x < b.max[0] + 0.2 && e.z > b.min[2] - 0.2 && e.z < b.max[2] + 0.2) g = b.top;
  }
  return g;
}
function moveEntity(e, dx, dz) {
  var ox = e.x, oz = e.z;
  e.x += dx; if (hitsBlock(e)) e.x = ox;
  e.z += dz; if (hitsBlock(e)) e.z = oz;
  return Math.abs(e.x - ox) + Math.abs(e.z - oz);
}
function physics(e, dt) {
  var g = groundAt(e);
  e.vy -= 24 * dt; e.y += e.vy * dt;
  if (e.y <= g) { e.y = g; e.vy = 0; e.onGround = true; } else e.onGround = false;
}

/* ---------- audio ---------- */
var AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type, vol, slide) {
  if (!S.sound) return; var ac = audio(); if (!ac) return;
  var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
var noiseBuf = null;
function burst(dur, vol, freq) {
  if (!S.sound) return; var ac = audio(); if (!ac) return;
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + dur);
}
function sfxShot(wk, vol) {
  var w = { rifle: [0.09, 2600, 160], pistol: [0.11, 3200, 220], shotgun: [0.22, 1800, 90], sniper: [0.3, 1400, 70] }[wk];
  burst(w[0], 0.5 * vol, w[1]); tone(w[2], w[0] * 1.4, 'square', 0.18 * vol, 0.4);
}

/* ---------- effects ---------- */
var tracers = [], tIdx = 0, sparks = [], sIdx = 0, ti, si;
for (ti = 0; ti < 24; ti++) {
  var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var tl = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
  tl.visible = false; tl.frustumCulled = false; scene.add(tl); tracers.push({ m: tl, t: 0 });
}
for (si = 0; si < 14; si++) {
  var sm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  sm.visible = false; scene.add(sm); sparks.push({ m: sm, t: 0 });
}
function addTracer(a, b, col) {
  var tr = tracers[tIdx++ % tracers.length], p = tr.m.geometry.attributes.position.array;
  p[0] = a[0]; p[1] = a[1]; p[2] = a[2]; p[3] = b[0]; p[4] = b[1]; p[5] = b[2];
  tr.m.geometry.attributes.position.needsUpdate = true; tr.m.material.color.setHex(col); tr.t = 0.07; tr.m.visible = true;
}
function addSpark(p, col) {
  var s = sparks[sIdx++ % sparks.length]; s.m.position.set(p[0], p[1], p[2]); s.m.material.color.setHex(col); s.t = 0.15; s.m.visible = true; s.m.scale.setScalar(1);
}
function updateFx(dt) {
  tracers.forEach(function (tr) { if (tr.t > 0) { tr.t -= dt; tr.m.material.opacity = Math.max(0, tr.t / 0.07); if (tr.t <= 0) tr.m.visible = false; } });
  sparks.forEach(function (s) { if (s.t > 0) { s.t -= dt; s.m.scale.setScalar(Math.max(0.1, s.t / 0.15)); if (s.t <= 0) s.m.visible = false; } });
}

/* ---------- kits de vida ---------- */
var kits = [{ x: 0, z: -14, t: 0 }, { x: 0, z: 14, t: 0 }], kitMat = new THREE.MeshLambertMaterial({ color: 0x7bd88f, emissive: 0x2a6a3a });
kits.forEach(function (k) {
  var g = new THREE.Group(); g.position.set(k.x, 0.9, k.z);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), kitMat), new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), kitMat));
  scene.add(g); k.m = g;
});
function nearestKit(x, z) {
  var best = null, bd = 1e9;
  kits.forEach(function (k) { var d = Math.hypot(k.x - x, k.z - z); if (k.t <= 0 && d < bd) { bd = d; best = k; } });
  return best;
}
function updateKits(dt, live) {
  kits.forEach(function (k) {
    k.m.rotation.y += dt * 2; k.m.position.y = 0.9 + Math.sin(performance.now() / 300) * 0.1;
    if (k.t > 0) { k.t -= dt; k.m.visible = k.t <= 0; return; }
    if (!live) return;
    var who = null;
    if (player.alive && player.hp < 100 && Math.hypot(player.e.x - k.x, player.e.z - k.z) < 1.2) who = player;
    else if (bot.alive && bot.hp < 100 && Math.hypot(bot.e.x - k.x, bot.e.z - k.z) < 1.2) who = bot;
    if (who) {
      who.hp = Math.min(100, who.hp + 40); k.t = 15; k.m.visible = false;
      if (who === player) { addFeed('+40 vida', 'var(--ok)'); tone(800, 0.15, 'sine', 0.12, 1.5); }
    }
  });
}

/* ================= GAME STATE ================= */
var canvas = $('gl'), hud = $('hud');
var isTouch = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
var state = 'menu', prevState = 'play';
var K = {}, input = { fire: false, edgeT: 0, zoom: false, jump: false };
var joy = { x: 0, y: 0, run: false };
var zoomed = false, everLocked = false, fallbackLook = false;
var match = { time: 0, cd: 0, overtime: false, name: 'BOT' };
var bannerT = 0, hitT = 0, dmgT = 0, fovNow = 75;

function newEntity() { return { x: 0, y: 0, z: 0, vy: 0, r: 0.38, onGround: true }; }
var player = { e: newEntity(), hp: 100, alive: true, yaw: 0, pitch: 0, ammo: 30, reloadT: 0, cd: 0, weapon: 'rifle', kick: 0, score: 0, deaths: 0, shots: 0, hits: 0, heads: 0, respawnT: 0,
  char: 'sombra', powerCd: 0, shieldT: 0, odT: 0, dashT: 0, dvx: 0, dvz: 0, healT: 0, mvx: 0, mvz: 0 };
var bot = { e: newEntity(), hp: 100, alive: true, yaw: 0, ammo: 30, reloadT: 0, cd: 0, weapon: 'rifle', score: 0, respawnT: 0, reactT: 0, strafe: 1, strafeT: 0, wanderT: 0, tx: 0, tz: 0, stuckT: 0, lx: 0, lz: 0, jumpT: 3, burst: 0, walk: 0, los: false,
  char: 'sombra', powerCd: 5, shieldT: 0, odT: 0, dashT: 0, dvx: 0, dvz: 0 };

/* ================= MODELS (cute RPG style) ================= */
var G = {
  sph: function (r) { return new THREE.SphereGeometry(r, 16, 12); },
  cyl: function (a, b, h) { return new THREE.CylinderGeometry(a, b, h, 14); },
  box: function (w, h, d) { return new THREE.BoxGeometry(w, h, d); },
  cone: function (r, h) { return new THREE.ConeGeometry(r, h, 14); },
  oct: function (r) { return new THREE.OctahedronGeometry(r); },
  ico: function (r) { return new THREE.IcosahedronGeometry(r, 0); },
  tor: function (r, t) { return new THREE.TorusGeometry(r, t, 8, 16); }
};
/* o: rx/rz rotation, s [sx,sy,sz] scale, em emissive color, ol = dark cartoon outline */
function put(geo, color, x, y, z, parent, o) {
  o = o || {};
  var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(o.em ? { color: color, emissive: o.em } : { color: color }));
  m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]);
  parent.add(m);
  if (o.ol) {
    var ol = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide }));
    ol.position.copy(m.position); ol.rotation.copy(m.rotation); ol.scale.copy(m.scale).multiplyScalar(1.1); parent.add(ol);
  }
  return m;
}
function buildChar(k) {
  var C = CHARS[k], g = new THREE.Group(), legs = [], skin = 0xf1c7a0, O = { ol: 1 }, H = Math.PI / 2;
  [-0.12, 0.12].forEach(function (x) {
    var p = new THREE.Group(); p.position.set(x, 0.5, 0);
    put(G.cyl(0.1, 0.11, 0.4), C.legCol, 0, -0.22, 0, p, O);
    put(G.sph(0.12), C.boot, 0, -0.42, -0.03, p, { ol: 1, s: [1, 0.8, 1.3] });
    g.add(p); legs.push(p);
  });
  put(G.cyl(0.2, 0.25, 0.5), C.body, 0, 0.75, 0, g, O);
  put(G.sph(0.09), C.glove, -0.3, 0.78, 0, g, O);
  put(G.sph(0.09), C.glove, 0.3, 0.78, -0.12, g, O);
  var slot = new THREE.Group(); slot.position.set(0.3, 0.78, -0.12); g.add(slot);
  if (k === 'sombra') {
    put(G.sph(0.35), 0x4a3b52, 0, 1.28, 0.02, g, O);
    put(G.sph(0.22), 0x1a1220, 0, 1.26, -0.17, g, { s: [1, 0.95, 0.6] });
    put(G.box(0.38, 0.13, 0.2), 0xd6455c, 0, 1.1, -0.18, g, O);
    put(G.sph(0.045), 0xffd24a, -0.09, 1.3, -0.27, g, { em: 0xffd24a });
    put(G.sph(0.045), 0xffd24a, 0.09, 1.3, -0.27, g, { em: 0xffd24a });
    put(G.cone(0.16, 0.32), 0x4a3b52, 0, 1.62, 0.14, g, { rx: 0.6, ol: 1 });
    put(G.box(0.5, 0.55, 0.07), 0x3a2d42, 0, 0.78, 0.24, g, O);
  } else if (k === 'cavaleiro') {
    put(G.sph(0.36), 0xc9ced6, 0, 1.28, 0, g, O);
    put(G.box(0.4, 0.08, 0.06), 0x1b2230, 0, 1.3, -0.34, g);
    put(G.cone(0.1, 0.34), 0xd6455c, 0, 1.68, 0.05, g, { rx: 0.3, ol: 1 });
    put(G.sph(0.13), 0xe8c15a, -0.3, 0.98, 0, g, O);
    put(G.sph(0.13), 0xe8c15a, 0.3, 0.98, 0, g, O);
    put(G.box(0.46, 0.09, 0.3), 0x3a64c9, 0, 0.55, 0, g);
  } else if (k === 'mago') {
    put(G.sph(0.32), skin, 0, 1.25, 0, g, O);
    put(G.sph(0.04), 0x2a1a12, -0.1, 1.27, -0.29, g);
    put(G.sph(0.04), 0x2a1a12, 0.1, 1.27, -0.29, g);
    put(G.sph(0.04), 0xf59aa8, -0.17, 1.17, -0.25, g, { s: [1, 0.6, 0.5] });
    put(G.sph(0.04), 0xf59aa8, 0.17, 1.17, -0.25, g, { s: [1, 0.6, 0.5] });
    put(G.cyl(0.46, 0.46, 0.05), 0x5b46c4, 0, 1.5, 0, g, O);
    put(G.cone(0.3, 0.75), 0x7a5cf0, 0, 1.9, 0, g, O);
    put(G.oct(0.07), 0xffd24a, 0, 1.62, -0.29, g, { em: 0xffd24a });
    put(G.cyl(0.24, 0.36, 0.5), C.body, 0, 0.5, 0, g, O);
  } else {
    put(G.sph(0.34), 0xf08a3c, 0, 1.28, 0, g, { ol: 1, s: [1.1, 0.95, 1] });
    put(G.sph(0.25), 0x141c26, 0, 1.28, -0.2, g, { s: [1.1, 0.72, 0.5] });
    put(G.sph(0.05), 0x4fd1c5, -0.1, 1.3, -0.34, g, { em: 0x4fd1c5 });
    put(G.sph(0.05), 0x4fd1c5, 0.1, 1.3, -0.34, g, { em: 0x4fd1c5 });
    put(G.cyl(0.015, 0.015, 0.25), 0x9aa3b0, 0, 1.7, 0, g);
    put(G.sph(0.06), 0xff5d4d, 0, 1.85, 0, g, { em: 0xff5d4d });
    put(G.box(0.2, 0.14, 0.03), 0x4fd1c5, 0, 0.82, -0.23, g, { em: 0x4fd1c5 });
    put(G.cyl(0.1, 0.1, 0.08), 0xf0f4f7, -0.37, 1.28, 0, g, { rz: H, ol: 1 });
    put(G.cyl(0.1, 0.1, 0.08), 0xf0f4f7, 0.37, 1.28, 0, g, { rz: H, ol: 1 });
  }
  g.visible = false; scene.add(g);
  return { g: g, legs: legs, slot: slot };
}
var botModels = {}, botMesh = null, botLegs = [], botSlot = null;
Object.keys(CHARS).forEach(function (k) { botModels[k] = buildChar(k); });
function selectBotModel(k) {
  Object.keys(botModels).forEach(function (n) { botModels[n].g.visible = false; });
  var m = botModels[k]; botMesh = m.g; botLegs = m.legs; botSlot = m.slot;
}
selectBotModel('sombra');
var botAura = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0.22, depthWrite: false }));
botAura.scale.set(0.8, 1.1, 0.8); botAura.visible = false; scene.add(botAura);

/* RPG weapons: barrel points toward -Z, origin at the grip */
function gunModel(wk) {
  var g = new THREE.Group(), W = WEAPONS[wk], gold = 0xe8b84a, wood = 0x7a4a2b, pearl = 0xf6ead0, O = { ol: 1 }, H = Math.PI / 2, muz, i, sd;
  var em = { em: W.col };
  if (wk === 'rifle') { /* Cajado Rúnico: cajado com runas e cristal flutuante */
    put(G.cyl(0.024, 0.028, 0.84), wood, 0, 0, -0.3, g, { rx: H, ol: 1 });
    for (i = 0; i < 6; i++) put(G.tor(0.036, 0.008), gold, 0, 0, -0.04 - i * 0.12, g);
    for (i = 0; i < 4; i++) put(G.box(0.012, 0.012, 0.05), W.col, 0, 0.03, -0.14 - i * 0.14, g, em);
    put(G.cyl(0.05, 0.03, 0.12), gold, 0, 0, -0.76, g, { rx: H, ol: 1 });
    put(G.tor(0.08, 0.012), gold, 0, 0, -0.86, g); put(G.tor(0.08, 0.012), gold, 0, 0, -0.86, g, { rx: H });
    put(G.ico(0.058), W.col, 0, 0, -0.86, g, em);
    [-1, 1].forEach(function (d) { put(G.oct(0.022), W.col, d * 0.11, 0.03 * d, -0.86, g, em); });
    put(G.box(0.045, 0.11, 0.05), wood, 0, -0.07, -0.02, g, O);
    put(G.box(0.05, 0.07, 0.18), wood, 0, -0.01, 0.12, g, O); put(G.box(0.056, 0.09, 0.02), gold, 0, -0.01, 0.22, g);
    muz = -0.95;
  } else if (wk === 'pistol') { /* Pistola Gema: pistola dourada com gema grande */
    put(G.box(0.06, 0.08, 0.26), gold, 0, 0, -0.1, g, O);
    put(G.box(0.048, 0.035, 0.22), pearl, 0, 0.055, -0.13, g, O);
    put(G.cyl(0.022, 0.026, 0.16), pearl, 0, 0.005, -0.3, g, { rx: H, ol: 1 });
    put(G.tor(0.03, 0.008), gold, 0, 0.005, -0.38, g);
    put(G.tor(0.045, 0.011), gold, 0, 0.1, -0.1, g, { rx: H });
    put(G.oct(0.055), W.col, 0, 0.11, -0.1, g, { em: W.col, s: [1, 1.3, 1] });
    [-1, 1].forEach(function (d) { put(G.box(0.01, 0.06, 0.09), pearl, d * 0.038, 0.03, 0.03, g, { rz: -d * 0.4 }); });
    put(G.box(0.05, 0.13, 0.07), wood, 0, -0.1, 0.0, g, { rx: 0.25, ol: 1 });
    put(G.box(0.015, 0.05, 0.05), gold, 0, -0.06, -0.1, g);
    muz = -0.42;
  } else if (wk === 'shotgun') { /* Canhão Dracônico: cabeça de dragão */
    put(G.box(0.09, 0.1, 0.24), gold, 0, 0, -0.02, g, O);
    put(G.cyl(0.05, 0.055, 0.46), 0xb23a3a, 0, 0.005, -0.33, g, { rx: H, ol: 1 });
    for (i = 0; i < 4; i++) put(G.tor(0.057, 0.01), gold, 0, 0.005, -0.18 - i * 0.1, g);
    put(G.cone(0.11, 0.2), 0xff8a3d, 0, 0.005, -0.66, g, { rx: H, ol: 1 });
    put(G.sph(0.055), 0xffd24a, 0, 0.005, -0.72, g, { em: 0xff8a3d });
    [-1, 1].forEach(function (d) {
      put(G.cone(0.02, 0.1), pearl, d * 0.06, 0.065, -0.75, g, { rz: d * 0.3 }); put(G.cone(0.02, 0.1), pearl, d * 0.06, -0.055, -0.75, g, { rz: d * 0.3 + Math.PI });
      put(G.cone(0.03, 0.18), pearl, d * 0.07, 0.11, -0.5, g, { rx: 1.0, rz: -d * 0.35 }); put(G.box(0.01, 0.1, 0.12), 0xff5d4d, d * 0.058, 0.07, -0.25, g, { rz: d * 0.3 });
    });
    put(G.cyl(0.05, 0.05, 0.16), wood, 0, -0.065, -0.3, g, { rx: H, ol: 1 });
    put(G.box(0.06, 0.09, 0.22), wood, 0, -0.01, 0.17, g, O);
    put(G.ico(0.032), W.col, 0, 0.07, -0.02, g, em);
    muz = -0.8;
  } else { /* Besta Estelar: besta com estrela */
    put(G.box(0.045, 0.05, 0.95), 0xdfe8f5, 0, 0, -0.35, g, O);
    put(G.box(0.06, 0.1, 0.3), wood, 0, -0.03, 0.2, g, O);
    put(G.box(0.045, 0.1, 0.05), wood, 0, -0.08, 0.02, g, O);
    put(new THREE.TorusGeometry(0.24, 0.018, 8, 22, Math.PI), 0xc9d2dc, 0, 0, -0.55, g, { rx: H, ol: 1 });
    put(G.box(0.07, 0.04, 0.06), gold, 0, 0.03, -0.55, g);
    put(G.cyl(0.004, 0.004, 0.48), 0xf4f8ff, 0, 0.01, -0.55, g, { rz: H });
    put(G.cyl(0.03, 0.03, 0.22), 0x3a3560, 0, 0.075, -0.12, g, { rx: H, ol: 1 });
    put(G.tor(0.04, 0.008), gold, 0, 0.075, -0.2, g);
    put(G.sph(0.024), W.col, 0, 0.075, -0.24, g, em);
    put(G.oct(0.05), W.col, 0, 0.045, -0.9, g, { em: W.col, s: [1, 1, 1.6] }); put(G.oct(0.05), W.col, 0, 0.045, -0.9, g, { em: W.col, rz: Math.PI / 4, s: [1, 1, 1.6] });
    for (i = 0; i < 3; i++) put(G.box(0.012, 0.012, 0.05), W.col, 0, 0.03, -0.3 - i * 0.12, g, em);
    muz = -1.0;
  }
  return { g: g, muz: muz };
}
function setBotGun(wk) {
  while (botSlot.children.length) botSlot.remove(botSlot.children[0]);
  var m = gunModel(wk); m.g.scale.setScalar(0.8); botSlot.add(m.g);
}
var gunGroup = null, flash = null, flashT = 0, GX = 0.22, GY = -0.22, GZ = -0.4;
function makeGun(wk) {
  if (gunGroup) camera.remove(gunGroup);
  var m = gunModel(wk), g = m.g;
  put(G.sph(0.05), CHARS[S.char].glove, 0, -0.07, -0.02, g, { ol: 1 });
  flash = new THREE.Mesh(G.ico(0.09), new THREE.MeshBasicMaterial({ color: WEAPONS[wk].col }));
  flash.position.set(0, 0, m.muz - 0.04); flash.visible = false; g.add(flash);
  g.position.set(GX, GY, GZ); camera.add(g); gunGroup = g;
}

/* ================= COMBAT ================= */
function shoot(origin, start, dir, w, wk, isPlayer, dmgMul) {
  var target = isPlayer ? bot : player, total = 0, hit = false, head = false;
  for (var i = 0; i < w.pellets; i++) {
    var sp = w.spread * (isPlayer ? (zoomed ? 0.35 : 1) * (player.crouching ? 0.7 : 1) : 1);
    var d = [dir[0] + rnd(-sp, sp), dir[1] + rnd(-sp, sp), dir[2] + rnd(-sp, sp)];
    var l = Math.hypot(d[0], d[1], d[2]); d = [d[0] / l, d[1] / l, d[2] / l];
    var tw = w.range, k;
    for (k = 0; k < boxes.length; k++) { var t = rayBox(origin, d, boxes[k].min, boxes[k].max, tw); if (t >= 0 && t < tw) tw = t; }
    var tt = -1, hd = false;
    if (target.alive) {
      var te = target.e, hw = isPlayer ? 0.45 : 0.34, tm = rayBox(origin, d, [te.x - hw, te.y, te.z - hw], [te.x + hw, te.y + (target.crouching ? 1.3 : 1.78), te.z + hw], tw);
      if (tm >= 0 && tm < tw) { tt = tm; hd = origin[1] + d[1] * tt > te.y + (target.crouching ? 0.7 : 1.1); }
    }
    var T = tt >= 0 ? tt : tw, pt = [origin[0] + d[0] * T, origin[1] + d[1] * T, origin[2] + d[2] * T];
    addTracer(start, pt, (isPlayer && trailCol()) || w.col);
    if (tt >= 0) {
      total += w.dmg * clamp(1.15 - tt / w.range * 0.6, 0.45, 1) * (hd ? 1.6 : 1) * dmgMul;
      hit = true; if (hd) head = true; addSpark(pt, w.col);
    } else if (tw < w.range) addSpark(pt, 0xffd27a);
  }
  return { dmg: total, hit: hit, head: head };
}
function startReload() {
  var p = player, w = WEAPONS[p.weapon];
  if (!p.alive || p.reloadT > 0 || p.ammo >= w.mag) return;
  p.reloadT = w.reload * (p.odT > 0 ? 0.5 : 1); tone(420, 0.08, 'square', 0.08);
}
function playerFire() {
  var p = player, e = p.e, w = WEAPONS[p.weapon];
  p.ammo--; p.cd = w.rate * (p.odT > 0 ? 0.55 : 1); p.shots++; p.kick = Math.min(3, p.kick + w.kick);
  var cp = Math.cos(p.pitch), dir = [-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp];
  var origin = [e.x, e.y + (p.ch || 1.6), e.z], off = zoomed ? 0 : 1;
  var start = [origin[0] + dir[0] * 0.7 + Math.cos(p.yaw) * 0.2 * off, origin[1] + dir[1] * 0.7 - 0.15 * off, origin[2] + dir[2] * 0.7 - Math.sin(p.yaw) * 0.2 * off];
  var r = shoot(origin, start, dir, w, p.weapon, true, 1);
  sfxShot(p.weapon, 1); flashT = 0.045; if (flash) flash.visible = true;
  p.pitch += w.kick * 0.0045;
  if (r.hit) { p.hits++; if (r.head) p.heads++; hitT = 0.14; $('crosshair').classList.toggle('head', !!r.head); tone(r.head ? 1500 : 950, 0.07, 'sine', 0.12); damageBot(r.dmg); }
}
function damageBot(d) {
  if (!bot.alive) return;
  if (bot.shieldT > 0) d *= 0.35;
  player.dmgDealt = (player.dmgDealt || 0) + d; bot.lsx = player.e.x; bot.lsz = player.e.z; bot.hasLs = true;
  bot.hp -= d; if (bot.hp <= 0) killBot();
}
function showDir(sx, sz) {
  var rel = angDiff(faceYaw(player.e.x, player.e.z, sx, sz), player.yaw), el = $('dirInd');
  el.style.transition = 'none'; el.style.transform = 'rotate(' + (-rel) + 'rad)'; el.style.opacity = 1;
  setTimeout(function () { el.style.transition = 'opacity .7s'; el.style.opacity = 0; }, 60);
}
function damagePlayer(d, sx, sz) {
  if (!player.alive) return;
  if (sx !== undefined) showDir(sx, sz);
  if (player.shieldT > 0) d *= 0.35;
  player.hp -= d; dmgT = 0.3; $('dmg').classList.add('on'); tone(140, 0.12, 'sawtooth', 0.12, 0.5);
  if (player.hp <= 0) killPlayer();
}
function addFeed(text, color) {
  var f = $('feed'), d = document.createElement('div'); d.textContent = text; d.style.color = color; f.appendChild(d);
  while (f.children.length > 4) f.removeChild(f.firstChild);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4000);
}
function killBot() {
  bot.alive = false; bot.hp = 0; bot.respawnT = 2.5; botMesh.visible = false; botAura.visible = false; player.score++;
  player.streak = (player.streak || 0) + 1; player.best = Math.max(player.best || 0, player.streak);
  if (player.streak >= 2 && state === 'play') setBanner(player.streak === 2 ? 'DUPLO!' : 'SEQUÊNCIA ×' + player.streak, 1.3);
  addFeed(profile.name + ' eliminou ' + match.name, 'var(--you)'); tone(660, 0.1, 'triangle', 0.15); setTimeout(function () { tone(990, 0.14, 'triangle', 0.15); }, 90);
  checkEnd();
}
function killPlayer() {
  player.alive = false; player.hp = 0; player.respawnT = 2.2; player.deaths++; bot.score++; zoomed = false; player.streak = 0;
  addFeed(match.name + ' eliminou ' + profile.name, 'var(--foe)'); tone(110, 0.5, 'sawtooth', 0.2, 0.4);
  checkEnd();
}
function checkEnd() {
  if (player.score >= KILLS_TO_WIN || bot.score >= KILLS_TO_WIN || (match.overtime && player.score !== bot.score)) {
    var win = player.score > bot.score; setTimeout(function () { endMatch(win); }, 900);
    state = state === 'play' ? 'ending' : state;
  }
}

/* ---------- powers ---------- */
function usePower() {
  var p = player, C = CHARS[S.char];
  if (state !== 'play' || !p.alive || p.powerCd > 0) return;
  p.powerCd = C.cd; addFeed(C.power + '!', 'var(--accent)');
  if (S.char === 'sombra') {
    var l = Math.hypot(p.mvx, p.mvz), dx = l > 0.1 ? p.mvx / l : -Math.sin(p.yaw), dz = l > 0.1 ? p.mvz / l : -Math.cos(p.yaw);
    p.dvx = dx * 30; p.dvz = dz * 30; p.dashT = 0.2; tone(300, 0.18, 'sawtooth', 0.12, 3);
  } else if (S.char === 'cavaleiro') { p.shieldT = 4; tone(520, 0.3, 'triangle', 0.15, 1.6); }
  else if (S.char === 'mago') { p.hp = Math.min(100, p.hp + 45); p.healT = 0.5; tone(700, 0.35, 'sine', 0.15, 1.8); }
  else { p.odT = 5; tone(260, 0.3, 'square', 0.12, 2.5); }
}
function botPower(dt, D, dist, nx, nz) {
  var b = bot, C = CHARS[b.char];
  b.powerCd -= dt; b.shieldT -= dt; b.odT -= dt;
  if (b.powerCd > 0) return;
  var use = false, m = { easy: 1.6, normal: 1.2, hard: 1 }[S.diff];
  if (b.char === 'sombra') {
    if (b.los && Math.random() < dt * 1.5) {
      use = true; var tw = dist > 15 ? 1 : 0;
      b.dvx = (tw ? nx : -nz * b.strafe) * 30; b.dvz = (tw ? nz : nx * b.strafe) * 30; b.dashT = 0.2;
    }
  } else if (b.char === 'cavaleiro') { if (b.los && b.hp < 75) { use = true; b.shieldT = 4; } }
  else if (b.char === 'mago') { if (b.hp < 45) { use = true; b.hp = Math.min(100, b.hp + 40); } }
  else { if (b.los && dist < 16) { use = true; b.odT = 5; } }
  if (use) { b.powerCd = C.cd * m; addFeed(match.name + ' usou ' + C.power, 'var(--foe)'); }
}

/* ================= SPAWNS ================= */
function pickSpawn(avoid) {
  var best = SPAWNS[0], bd = -1;
  SPAWNS.forEach(function (s) { var d = Math.hypot(s[0] - avoid.x, s[1] - avoid.z) + Math.random() * 6; if (d > bd) { bd = d; best = s; } });
  return best;
}
function faceYaw(fx, fz, tx, tz) { return Math.atan2(-(tx - fx), -(tz - fz)); }
function spawnPlayer() {
  var s = pickSpawn(bot.e), e = player.e;
  e.x = s[0]; e.z = s[1]; e.y = 0; e.vy = 0; player.hp = 100; player.alive = true;
  player.yaw = faceYaw(e.x, e.z, 0, 0); player.pitch = 0; player.ammo = WEAPONS[player.weapon].mag; player.reloadT = 0; player.cd = 0.3;
  player.shieldT = player.odT = player.dashT = player.healT = 0;
}
function spawnBot() {
  var s = pickSpawn(player.e), e = bot.e, b = bot, keys = Object.keys(CHARS);
  e.x = s[0]; e.z = s[1]; e.y = 0; e.vy = 0; b.hp = 100; b.alive = true;
  b.char = keys[Math.floor(Math.random() * keys.length)]; selectBotModel(b.char);
  b.weapon = ['rifle', 'rifle', 'shotgun', 'pistol'][Math.floor(Math.random() * 4)]; setBotGun(b.weapon);
  b.ammo = WEAPONS[b.weapon].mag; b.reloadT = 0; b.cd = 0.9; b.reactT = 0; b.wanderT = 0; b.burst = 0; b.hasLs = false;
  b.powerCd = rnd(4, 8); b.shieldT = b.odT = b.dashT = 0;
  b.yaw = faceYaw(e.x, e.z, 0, 0); b.jumpT = rnd(2, 4); b.stuckT = 0; b.lx = e.x; b.lz = e.z; botMesh.visible = true;
}

/* ================= UPDATE ================= */
function updatePlayer(dt, live) {
  var p = player, e = p.e, w = WEAPONS[p.weapon];
  p.cd -= dt; input.edgeT -= dt;
  p.kick = Math.max(0, p.kick - dt * 7);
  p.powerCd = Math.max(0, p.powerCd - dt); p.shieldT = Math.max(0, p.shieldT - dt); p.odT = Math.max(0, p.odT - dt); p.healT = Math.max(0, p.healT - dt);
  if (!p.alive) { p.respawnT -= dt; physics(e, dt); if (live && p.respawnT <= 0) spawnPlayer(); return; }
  zoomed = live && (input.zoom || K.KeyZ) && p.reloadT <= 0;
  var crouch = live && !!(K.KeyC || K.ControlLeft); p.crouching = crouch; if (!p.ch) p.ch = 1.6; p.ch += ((crouch ? 1.1 : 1.6) - p.ch) * Math.min(1, dt * 12);
  var mx = 0, mz = 0;
  if (live) {
    if (K.KeyW) mz++; if (K.KeyS) mz--; if (K.KeyD) mx++; if (K.KeyA) mx--;
    var ts = 2.2 * S.sens * dt * lookScale();
    if (K.ArrowLeft) look(-ts, 0); if (K.ArrowRight) look(ts, 0); if (K.ArrowUp) look(0, -ts); if (K.ArrowDown) look(0, ts);
    mx += joy.x; mz += joy.y;
  }
  var l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  var sprint = (K.ShiftLeft || K.ShiftRight || joy.run) && mz > 0.3 && !zoomed && !crouch;
  var sp = 6 * (sprint ? 1.55 : 1) * (zoomed ? 0.55 : 1) * (crouch ? 0.55 : 1), sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  p.mvx = -sy * mz + cy * mx; p.mvz = -cy * mz - sy * mx;
  moveEntity(e, p.mvx * sp * dt, p.mvz * sp * dt);
  if (p.dashT > 0) { moveEntity(e, p.dvx * dt, p.dvz * dt); p.dashT -= dt; }
  if (live && (K.Space || input.jump) && e.onGround) { e.vy = 8.2; e.onGround = false; }
  padCheck(e); physics(e, dt);
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) p.ammo = w.mag; }
  if (live && p.reloadT <= 0 && p.cd <= 0) {
    var wants = input.fire || input.edgeT > 0 || K.KeyF;
    if (wants) { if (p.ammo > 0) { playerFire(); input.edgeT = 0; } else startReload(); }
    if (p.ammo <= 0) startReload();
  }
}
function updateBot(dt, live) {
  var b = bot, e = b.e;
  if (!b.alive) { if (live) { b.respawnT -= dt; if (b.respawnT <= 0) spawnBot(); } return; }
  var D = DIFF[S.diff], w = WEAPONS[b.weapon];
  var px = player.e.x, pz = player.e.z, dx = px - e.x, dz = pz - e.z, dist = Math.max(0.01, Math.hypot(dx, dz));
  var eye = [e.x, e.y + 1.55, e.z], pe = [px, player.e.y + 1.25, pz];
  b.los = player.alive && !blocked(eye, pe);
  if (b.los) { b.lsx = px; b.lsz = pz; b.hasLs = true; }
  b.cd -= dt;
  if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.ammo = w.mag; }
  var mx = 0, mz = 0, moved = 0;
  if (live) {
    var nx = dx / dist, nz = dz / dist;
    if (b.los) {
      var want = Math.atan2(-dx, -dz), step = D.turn * dt;
      b.yaw += clamp(angDiff(want, b.yaw), -step, step);
      b.reactT += dt; b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeT = rnd(0.5, 1.6); }
      var fwd = 0;
      if (dist > w.ideal + 3) fwd = 1; else if (dist < w.ideal - 3) fwd = -1;
      mx = nx * fwd - nz * b.strafe * 0.9; mz = nz * fwd + nx * b.strafe * 0.9;
      if (b.reactT > D.react && Math.abs(angDiff(want, b.yaw)) < 0.09 && b.cd <= 0 && b.reloadT <= 0 && b.ammo > 0) {
        var org = [e.x, e.y + 1.55, e.z], ex = D.err * (0.6 + dist / 20);
        var dir = [pe[0] - org[0] + rnd(-ex, ex) * dist, pe[1] - org[1] + rnd(-ex, ex) * dist, pe[2] - org[2] + rnd(-ex, ex) * dist];
        var dl = Math.hypot(dir[0], dir[1], dir[2]); dir = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
        var st = [org[0] + dir[0] * 0.6, org[1] - 0.2, org[2] + dir[2] * 0.6];
        var r = shoot(org, st, dir, w, b.weapon, false, D.dmg);
        sfxShot(b.weapon, clamp(1 - dist / 60, 0.15, 0.8));
        b.ammo--; b.cd = (w.rate * D.fireMul + rnd(0, 0.12) + (w.auto ? 0 : 0.25)) * (b.odT > 0 ? 0.55 : 1); b.burst++;
        if (b.burst >= (w.auto ? 6 : 1)) { b.burst = 0; b.cd += rnd(0.3, 0.8); }
        if (b.ammo <= 0) b.reloadT = w.reload * (b.odT > 0 ? 0.5 : 1);
        if (r.hit) damagePlayer(r.dmg, e.x, e.z);
      }
    } else {
      b.reactT = 0; b.wanderT -= dt;
      if (b.wanderT <= 0) {
        var kit = b.hp < 50 ? nearestKit(e.x, e.z) : null;
        if (b.hasLs && Math.hypot(b.lsx - e.x, b.lsz - e.z) < 2.5) b.hasLs = false;
        if (kit) { b.tx = kit.x; b.tz = kit.z; } else if (b.hasLs && Math.random() < 0.75) { b.tx = b.lsx; b.tz = b.lsz; } else { b.tx = rnd(-HALF + 3, HALF - 3); b.tz = rnd(-HALF + 3, HALF - 3); }
        b.wanderT = rnd(1.2, 2.5);
      }
      var tx = b.tx - e.x, tz = b.tz - e.z, tl = Math.max(0.01, Math.hypot(tx, tz));
      mx = tx / tl; mz = tz / tl;
      var wy = Math.atan2(-mx, -mz); b.yaw += clamp(angDiff(wy, b.yaw), -D.turn * dt, D.turn * dt);
    }
    botPower(dt, D, dist, nx, nz);
    var ml = Math.hypot(mx, mz); if (ml > 0.01) { mx /= ml; mz /= ml; }
    moved = moveEntity(e, mx * D.speed * dt, mz * D.speed * dt);
    if (b.dashT > 0) { moveEntity(e, b.dvx * dt, b.dvz * dt); b.dashT -= dt; }
    b.stuckT += dt;
    if (b.stuckT > 0.45) {
      if (ml > 0.01 && Math.hypot(e.x - b.lx, e.z - b.lz) < 0.5) {
        b.strafe = -b.strafe; b.tx = rnd(-HALF + 3, HALF - 3); b.tz = rnd(-HALF + 3, HALF - 3); b.wanderT = 1.4;
        if (e.onGround) e.vy = 8;
      }
      b.stuckT = 0; b.lx = e.x; b.lz = e.z;
    }
    
  }
  padCheck(e); physics(e, dt);
  b.walk += moved > 0 ? dt * 10 : 0;
}

/* ================= MATCH FLOW ================= */
function setBanner(html, t) { $('banner').innerHTML = html; bannerT = t || 0; }
function enterFallback() {
  if (fallbackLook) return;
  fallbackLook = true;
  addFeed('Mouse livre: segure o botão do mouse e arraste para mirar (ou use as setas). Clique esquerdo ou F atira.', '#ffffff');
}
function requestLock() {
  if (isTouch) return;
  try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () { onLockError(); }); } catch (e) { onLockError(); }
  /* alguns navegadores (preview do VS Code, iframes) não travam o mouse nem avisam: libera o modo sem trava */
  setTimeout(function () { if (playing() && !document.pointerLockElement) enterFallback(); }, 500);
}
function exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} }
function onLockError() {
  if (state !== 'play' && state !== 'countdown') return;
  if (everLocked) pause(); else enterFallback();
}
function clearInput() { K = {}; input.fire = false; input.edgeT = 0; input.zoom = false; input.jump = false; joy.x = joy.y = 0; joy.run = false; }

function startMatch() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  audio();
  if (curMapKey !== S.map) buildMap(S.map);
  match = { time: 0, cd: 3, overtime: false, name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] };
  cache.cd = null; setBanner('', 0);
  Object.assign(player, { score: 0, deaths: 0, shots: 0, hits: 0, heads: 0, weapon: S.weapon, kick: 0, char: S.char, powerCd: 2, shieldT: 0, odT: 0, dashT: 0, healT: 0 });
  $('pwKey').hidden = isTouch;
  bot.score = 0; player.streak = player.best = player.dmgDealt = 0; kits.forEach(function (k) { k.t = 0; k.m.visible = true; });
  spawnPlayer(); spawnBot();
  makeGun(S.weapon); gunGroup.visible = true;
  clearInput(); $('feed').innerHTML = '';
  $('menu').hidden = true; $('lobby').hidden = true; $('end').hidden = true; $('pause').hidden = true; hud.hidden = false; $('touch').hidden = !isTouch;
  $('foeName').textContent = match.name; $('wpnName').textContent = WEAPONS[S.weapon].name;
  state = 'countdown'; camera.fov = fovNow = 75; camera.updateProjectionMatrix();
  requestLock();
}
function pause() {
  if (state !== 'play' && state !== 'countdown') return;
  prevState = state; state = 'paused'; clearInput(); zoomed = false; $('pause').hidden = false; exitLock();
}
function resume() { $('pause').hidden = true; state = prevState; requestLock(); }
function showMenu() {
  state = 'menu'; exitLock(); clearInput();
  $('menu').hidden = true; $('lobby').hidden = false; $('end').hidden = true; $('pause').hidden = true; hud.hidden = true;
  if (gunGroup) gunGroup.visible = false; botMesh.visible = false; zoomed = false;
  renderProfile();
}
function endMatch(win) {
  if (state === 'end' || state === 'menu') return;
  state = 'end'; exitLock(); clearInput(); zoomed = false;
  hud.hidden = true; if (gunGroup) gunGroup.visible = false; botMesh.visible = false;
  var gain = 40 + player.score * 12 + (win ? 100 : 0), oldL = levelOf(profile.xp);
  var coinG = 20 + player.score * 5 + (win ? 30 : 0); profile.coins += coinG;
  profile.xp += gain; profile.kills += player.score; profile.deaths += player.deaths;
  if (win) profile.wins++; else profile.losses++;
  profile.history.unshift({ win: win, you: player.score, foe: bot.score, map: MAPS[S.map].name, xp: gain });
  profile.history = profile.history.slice(0, 10); saveProfile();
  var newL = levelOf(profile.xp), acc = player.shots ? Math.round(player.hits / player.shots * 100) : 0;
  var t = $('endTitle'); t.textContent = win ? 'VITÓRIA' : 'DERROTA'; t.className = win ? 'win' : 'lose';
  $('eYou').textContent = player.score; $('eFoe').textContent = bot.score;
  var rows = [['Abates', player.score], ['Mortes', player.deaths], ['Precisão', acc + '%'], ['Tiros na cabeça', player.heads], ['Dano causado', Math.round(player.dmgDealt || 0)], ['Melhor sequência', player.best || 0], ['XP ganho', '+' + gain], ['Moedas', '+' + coinG], ['Mapa', MAPS[S.map].name], ['Adversário', match.name + ' · ' + DIFF[S.diff].name]];
  $('endRows').innerHTML = rows.map(function (r) { return '<div><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; }).join('');
  var lv = $('lvup'); lv.hidden = newL <= oldL; if (newL > oldL) lv.textContent = 'Subiu para o nível ' + newL + ' · ' + rankOf(newL);
  $('end').hidden = false; tone(win ? 880 : 200, 0.4, 'triangle', 0.18, win ? 1.5 : 0.5);
}

/* ================= FRAME ================= */
var camAngle = 0, last = performance.now(), cache = {};
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

function simulate(dt, live) {
  if (live) {
    match.time += dt;
    if (match.time >= MATCH_TIME && !match.overtime) {
      if (player.score !== bot.score) { var w = player.score > bot.score; state = 'ending'; setTimeout(function () { endMatch(w); }, 600); }
      else { match.overtime = true; setBanner('MORTE SÚBITA<small>A próxima eliminação decide</small>', 2); }
    }
  }
  updateKits(dt, live); updatePlayer(dt, live); updateBot(dt, live);
  if (flashT > 0) { flashT -= dt; if (flashT <= 0 && flash) flash.visible = false; }
  var p = player, e = p.e;
  var snip = p.weapon === 'sniper', target = zoomed ? (snip ? 18 : 52) : 75;
  fovNow += (target - fovNow) * Math.min(1, dt * 14);
  if (Math.abs(camera.fov - fovNow) > 0.05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  var scoped = snip && zoomed && fovNow < 40;
  $('scope').hidden = !scoped; $('crosshair').style.display = scoped || !p.alive ? 'none' : '';
  if (gunGroup) {
    gunGroup.visible = p.alive && !scoped;
    gunGroup.position.set(GX, GY, GZ + p.kick * 0.02); gunGroup.rotation.x = p.kick * 0.05;
    if (zoomed && !snip) gunGroup.position.x = 0.08;
    if (p.reloadT > 0) gunGroup.rotation.x = -0.5 * Math.sin(Math.min(1, (WEAPONS[p.weapon].reload - p.reloadT) / WEAPONS[p.weapon].reload) * Math.PI);
  }
  camera.position.set(e.x, e.y + (p.alive ? (p.ch || 1.6) : 0.35), e.z);
  camera.rotation.set(p.pitch, p.yaw, p.alive ? 0 : 0.8);
  /* bot model */
  if (bot.alive) {
    botMesh.position.set(bot.e.x, bot.e.y, bot.e.z); botMesh.rotation.y = bot.yaw;
    botLegs[0].rotation.x = Math.sin(bot.walk) * 0.6; botLegs[1].rotation.x = -Math.sin(bot.walk) * 0.6;
  }
  /* power HUD + auras */
  var C = CHARS[S.char];
  setText('pwName', C.power);
  $('pwBar').style.width = Math.round((1 - p.powerCd / C.cd) * 100) + '%'; $('pwBar').classList.toggle('rdy', p.powerCd <= 0);
  setText('bPower', p.powerCd > 0 ? Math.ceil(p.powerCd) + 's' : 'PODER'); $('bPower').classList.toggle('rdy', p.powerCd <= 0);
  var au = p.shieldT > 0 ? 'shield' : p.odT > 0 ? 'od' : p.healT > 0 ? 'heal' : '';
  if (cache.aura !== au) { cache.aura = au; $('aura').className = au; }
  botAura.visible = bot.alive && (bot.shieldT > 0 || bot.odT > 0);
  if (botAura.visible) { botAura.position.set(bot.e.x, bot.e.y + 0.95, bot.e.z); botAura.material.color.setHex(bot.shieldT > 0 ? 0xf0b429 : 0xff8a3d); }
  /* HUD */
  var hp = Math.max(0, Math.ceil(p.hp)), w2 = WEAPONS[p.weapon];
  setText('hpTxt', hp); $('hpBar').style.width = hp + '%'; $('hpBar').style.background = hp < 30 ? 'var(--foe)' : 'var(--ok)';
  setText('ammoTxt', p.ammo); setText('ammoState', p.reloadT > 0 ? 'RECARREGANDO' : (p.alive ? '' : 'ELIMINADO'));
  setText('sYou', p.score); setText('sFoe', bot.score);
  setText('timer', match.overtime ? 'SD' : fmtTime(MATCH_TIME - match.time));
  var tag = $('foeTag');
  if (bot.alive && bot.los && p.alive) {
    var v = new THREE.Vector3(bot.e.x, bot.e.y + 2.05, bot.e.z).project(camera);
    if (v.z < 1 && v.z > -1) {
      tag.hidden = false; tag.style.left = ((v.x + 1) / 2 * window.innerWidth) + 'px'; tag.style.top = ((1 - v.y) / 2 * window.innerHeight) + 'px';
      setText('foeTagName', match.name); $('foeTagHp').style.width = Math.max(0, bot.hp) + '%';
    } else tag.hidden = true;
  } else tag.hidden = true;
  if (hitT > 0) { hitT -= dt; $('crosshair').classList.toggle('hit', hitT > 0); }
  if (dmgT > 0) { dmgT -= dt; if (dmgT <= 0) $('dmg').classList.remove('on'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) setBanner('', 0); }
}
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'menu' || state === 'end') {
    camAngle += dt * 0.12; var R = 33;
    if (camera.fov !== 60) { camera.fov = 60; fovNow = 60; camera.updateProjectionMatrix(); }
    camera.position.set(Math.sin(camAngle) * R, 15, Math.cos(camAngle) * R); camera.lookAt(0, 1.5, 0);
  } else if (state === 'countdown') {
    match.cd -= dt; var n = Math.ceil(match.cd);
    if (match.cd <= 0) { state = 'play'; setBanner('JÁ!', 0.8); tone(880, 0.25, 'square', 0.12); }
    else { var txt = String(n); if (cache.cd !== txt) { cache.cd = txt; setBanner(txt + '<small>PREPARAR</small>', 0); tone(440, 0.12, 'square', 0.1); } }
    simulate(dt, false);
  } else if (state === 'play' || state === 'ending') {
    simulate(dt, state === 'play');
  }
  updateFx(dt);
  if (state === 'menu') lobbyTick(now);
  renderer.render(state === 'menu' ? lobbyScene : scene, state === 'menu' ? lobbyCam : camera);
}

/* ================= INPUT (desktop) ================= */
function lookScale() { return camera.fov / 75; }
function look(dx, dy) {
  if (!player.alive) return;
  player.yaw -= dx; player.pitch = clamp(player.pitch - dy, -1.5, 1.5);
}
function playing() { return state === 'play' || state === 'countdown'; }
document.addEventListener('pointerlockchange', function () {
  if (document.pointerLockElement === canvas) { everLocked = true; fallbackLook = false; }
  else if (playing() && !isTouch && !fallbackLook) pause();
});
document.addEventListener('pointerlockerror', onLockError);
document.addEventListener('mousemove', function (ev) {
  if (!playing()) return;
  var locked = document.pointerLockElement === canvas;
  if (locked || (fallbackLook && (ev.buttons & 3))) look(ev.movementX * 0.0022 * S.sens * lookScale(), ev.movementY * 0.0022 * S.sens * lookScale());
});
document.addEventListener('mousedown', function (ev) {
  if (!playing()) return;
  if (ev.target && ev.target.closest && ev.target.closest('button')) return;
  var locked = document.pointerLockElement === canvas;
  if (!locked && !fallbackLook) requestLock();
  audio();
  if (ev.button === 0) { input.fire = true; input.edgeT = 0.12; }
  else if (ev.button === 2 && locked) input.zoom = true;
});
document.addEventListener('mouseup', function (ev) { if (ev.button === 0) input.fire = false; if (ev.button === 2) input.zoom = false; });
document.addEventListener('contextmenu', function (ev) { if (state !== 'menu') ev.preventDefault(); });
document.addEventListener('keydown', function (ev) {
  if (ev.target && ev.target.tagName === 'INPUT') return;
  if (playing() && (ev.code === 'Space' || ev.code.indexOf('Arrow') === 0)) ev.preventDefault();
  K[ev.code] = true;
  if (ev.code === 'KeyR' && playing()) startReload();
  if (ev.code === 'KeyP' && playing()) pause();
  if (ev.code === 'KeyE') usePower();
});
document.addEventListener('keyup', function (ev) { K[ev.code] = false; });
document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
window.addEventListener('blur', function () { K = {}; input.fire = false; });

/* ================= INPUT (touch) ================= */
(function () {
  var joyId = null, jx = 0, jy = 0, lookId = null, lx = 0, ly = 0, R = 52;
  var base = $('joyBase'), knob = $('joyKnob');
  $('joyZone').addEventListener('pointerdown', function (ev) {
    if (joyId !== null) return; joyId = ev.pointerId; jx = ev.clientX; jy = ev.clientY;
    base.style.display = 'block'; base.style.left = (jx - 60) + 'px'; base.style.top = (jy - 60) + 'px'; knob.style.transform = 'translate(0,0)';
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {} audio();
  });
  $('joyZone').addEventListener('pointermove', function (ev) {
    if (ev.pointerId !== joyId) return;
    var dx = ev.clientX - jx, dy = ev.clientY - jy, l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    joy.x = dx / R; joy.y = -dy / R; joy.run = Math.hypot(joy.x, joy.y) > 0.92 && joy.y > 0.5;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  var joyEnd = function (ev) { if (ev.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; joy.run = false; base.style.display = 'none'; };
  $('joyZone').addEventListener('pointerup', joyEnd); $('joyZone').addEventListener('pointercancel', joyEnd);
  var lz = $('lookZone');
  lz.addEventListener('pointerdown', function (ev) { if (lookId !== null) return; lookId = ev.pointerId; lx = ev.clientX; ly = ev.clientY; try { lz.setPointerCapture(ev.pointerId); } catch (e) {} });
  lz.addEventListener('pointermove', function (ev) {
    if (ev.pointerId !== lookId || !playing()) return;
    var k = 0.0055 * S.sens * lookScale(); look((ev.clientX - lx) * k, (ev.clientY - ly) * k); lx = ev.clientX; ly = ev.clientY;
  });
  var lookEnd = function (ev) { if (ev.pointerId === lookId) lookId = null; };
  lz.addEventListener('pointerup', lookEnd); lz.addEventListener('pointercancel', lookEnd);
  function hold(id, down, up) {
    var el = $(id);
    el.addEventListener('pointerdown', function (ev) { ev.preventDefault(); try { el.setPointerCapture(ev.pointerId); } catch (e) {} el.classList.add('d'); down(); });
    var end = function () { el.classList.remove('d'); up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  /* Fire button: hold to shoot AND drag the same finger to aim (button follows the finger a little) */
  var bf = $('bFire'), fid = null, fx = 0, fy = 0, sx = 0, sy = 0;
  bf.addEventListener('pointerdown', function (ev) {
    ev.preventDefault(); fid = ev.pointerId; fx = sx = ev.clientX; fy = sy = ev.clientY;
    try { bf.setPointerCapture(ev.pointerId); } catch (e) {}
    bf.classList.add('d'); input.fire = true; input.edgeT = 0.12; audio();
  });
  bf.addEventListener('pointermove', function (ev) {
    if (ev.pointerId !== fid) return;
    if (playing()) { var k = 0.0055 * S.sens * lookScale(); look((ev.clientX - fx) * k, (ev.clientY - fy) * k); }
    fx = ev.clientX; fy = ev.clientY;
    bf.style.transform = 'translate(' + clamp(ev.clientX - sx, -26, 26) + 'px,' + clamp(ev.clientY - sy, -26, 26) + 'px)';
  });
  var fireEnd = function (ev) { if (ev.pointerId !== fid) return; fid = null; input.fire = false; bf.classList.remove('d'); bf.style.transform = ''; };
  bf.addEventListener('pointerup', fireEnd); bf.addEventListener('pointercancel', fireEnd);
  hold('bPower', function () { usePower(); }, function () {});
  hold('bJump', function () { input.jump = true; }, function () { input.jump = false; });
  hold('bReload', function () { if (playing()) startReload(); }, function () {});
  hold('bZoom', function () { input.zoom = !input.zoom; }, function () {});
})();

/* ================= MENU UI ================= */
var CHAR_ICONS = {
  sombra: '<svg viewBox="0 0 48 48"><path d="M24 3l-7 11h14z" fill="#4a3b52"/><circle cx="24" cy="26" r="18" fill="#4a3b52"/><ellipse cx="24" cy="26" rx="11" ry="10" fill="#1a1220"/><path d="M12 33h24l-3 8H15z" fill="#d6455c"/><ellipse cx="19.5" cy="25" rx="2.4" ry="1.6" fill="#ffd24a"/><ellipse cx="28.5" cy="25" rx="2.4" ry="1.6" fill="#ffd24a"/></svg>',
  cavaleiro: '<svg viewBox="0 0 48 48"><path d="M24 2c5 4 6 8 5 13h-10c-1-5 0-9 5-13z" fill="#d6455c"/><circle cx="24" cy="28" r="17" fill="#c9ced6"/><rect x="11" y="25" width="26" height="6" rx="2" fill="#1b2230"/><rect x="22.5" y="13" width="3" height="28" fill="#e8c15a"/></svg>',
  mago: '<svg viewBox="0 0 48 48"><circle cx="24" cy="33" r="12" fill="#f1c7a0"/><polygon points="24,2 36,25 12,25" fill="#7a5cf0"/><ellipse cx="24" cy="26" rx="17" ry="3.5" fill="#5b46c4"/><polygon points="24,11 25.5,15 29.5,15 26.3,17.4 27.5,21.2 24,19 20.5,21.2 21.7,17.4 18.5,15 22.5,15" fill="#ffd24a"/><circle cx="19.5" cy="33" r="1.8" fill="#2a1a12"/><circle cx="28.5" cy="33" r="1.8" fill="#2a1a12"/></svg>',
  robo: '<svg viewBox="0 0 48 48"><line x1="24" y1="5" x2="24" y2="13" stroke="#9aa3b0" stroke-width="2"/><circle cx="24" cy="5" r="3.2" fill="#ff5d4d"/><rect x="7" y="13" width="34" height="30" rx="12" fill="#f08a3c"/><rect x="12" y="20" width="24" height="15" rx="7" fill="#141c26"/><circle cx="19" cy="27.5" r="3.2" fill="#4fd1c5"/><circle cx="29" cy="27.5" r="3.2" fill="#4fd1c5"/></svg>'
};
function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
function renderProfile() {
  var l = levelOf(profile.xp), a = xpFor(l), b = xpFor(l + 1);
  $('nameIn').value = profile.name;
  var av = $('avatar'); av.innerHTML = CHAR_ICONS[S.char] || CHAR_ICONS.sombra; av.style.background = AVATARS[profile.color] || AVATARS[0];
  $('rankName').textContent = rankOf(l); $('lvTxt').textContent = 'Nível ' + l;
  $('xpBar').style.width = Math.round((profile.xp - a) / (b - a) * 100) + '%';
  $('xpTxt').textContent = profile.xp + ' XP'; $('xpNext').textContent = 'próximo nível: ' + b + ' XP';
  $('stW').textContent = profile.wins; $('stL').textContent = profile.losses; $('stK').textContent = profile.kills;
  $('stKD').textContent = (profile.kills / Math.max(1, profile.deaths)).toFixed(1);
  var h = $('hist');
  h.innerHTML = profile.history.length ? profile.history.map(function (m) {
    return '<div><span class="' + (m.win ? 'w' : 'l') + '">' + (m.win ? 'VITÓRIA' : 'DERROTA') + '</span><span>' + m.map + '</span><span>' + m.you + '×' + m.foe + '</span></div>';
  }).join('') : '<span class="empty">Nenhuma partida ainda. Jogue a primeira.</span>';
  document.querySelectorAll('.sw').forEach(function (s, i) { s.classList.toggle('on', i === profile.color); });
  renderLobby();
}
function pips(n) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'f' : '') + '"></i>'; return s; }
function buildOptions() {
  var sw = $('swatches');
  AVATARS.forEach(function (c, i) {
    var b = document.createElement('button'); b.className = 'sw'; b.style.background = c; b.setAttribute('aria-label', 'Cor ' + (i + 1));
    b.onclick = function () { profile.color = i; saveProfile(); renderProfile(); }; sw.appendChild(b);
  });
  var dEl = $('diffs');
  Object.keys(DIFF).forEach(function (k) {
    var b = document.createElement('button'); b.className = 'opt'; b.dataset.k = k; b.innerHTML = '<strong>' + DIFF[k].name + '</strong>';
    b.onclick = function () { S.diff = k; saveSettings(); sync(); }; dEl.appendChild(b);
  });
  var mEl = $('maps');
  Object.keys(MAPS).forEach(function (k) {
    var b = document.createElement('button'); b.className = 'opt'; b.dataset.k = k; b.innerHTML = '<strong>' + MAPS[k].name + '</strong><small>' + MAPS[k].desc + '</small>';
    b.onclick = function () { S.map = k; saveSettings(); buildMap(k); sync(); }; mEl.appendChild(b);
  });
  var wEl = $('weps');
  Object.keys(WEAPONS).forEach(function (k) {
    var w = WEAPONS[k], b = document.createElement('button'); b.className = 'opt'; b.dataset.k = k;
    b.innerHTML = '<strong><span class="gem" style="background:' + hex(w.col) + '"></span>' + w.name + '</strong><small>' + w.desc + '</small><div class="pips"><em>Dano</em>' + pips(w.stats[0]) + '</div><div class="pips"><em>Cadência</em>' + pips(w.stats[1]) + '</div><div class="pips"><em>Alcance</em>' + pips(w.stats[2]) + '</div>';
    b.onclick = function () { S.weapon = k; saveSettings(); sync(); }; wEl.appendChild(b);
  });
  var cEl = $('chars');
  Object.keys(CHARS).forEach(function (k) {
    var c = CHARS[k], b = document.createElement('button'); b.className = 'opt row'; b.dataset.k = k;
    b.innerHTML = '<div class="icon">' + CHAR_ICONS[k] + '</div><div><strong>' + c.name + '</strong><small><b style="color:var(--accent);font-weight:600">' + c.power + '</b> · ' + c.desc + '</small></div>';
    b.onclick = function () { S.char = k; saveSettings(); sync(); renderProfile(); }; cEl.appendChild(b);
  });
  function sync() {
    [['diffs', 'diff'], ['maps', 'map'], ['weps', 'weapon'], ['chars', 'char']].forEach(function (p) {
      $(p[0]).querySelectorAll('.opt').forEach(function (b) { b.classList.toggle('on', b.dataset.k === S[p[1]]); });
    });
  }
  sync();
}
function bindSettings() {
  ['sens', 'sens2'].forEach(function (id) { $(id).value = S.sens; $(id).addEventListener('input', function (ev) { S.sens = parseFloat(ev.target.value); $('sens').value = $('sens2').value = S.sens; saveSettings(); }); });
  ['snd', 'snd2'].forEach(function (id) { $(id).checked = S.sound; $(id).addEventListener('change', function (ev) { S.sound = ev.target.checked; $('snd').checked = $('snd2').checked = S.sound; saveSettings(); }); });
  $('nameIn').addEventListener('input', function (ev) {
    profile.name = ev.target.value.trim().slice(0, 14) || 'Operador'; saveProfile();
  });
  $('btnStart').onclick = startMatch;
  $('btnPause').onclick = pause;
  $('btnResume').onclick = resume;
  $('btnQuit').onclick = showMenu;
  $('btnRematch').onclick = startMatch;
  $('btnMenu').onclick = showMenu;
}

/* ================= LOBBY (3D + UI) ================= */
var lobbyScene = new THREE.Scene(), lobbyCam = new THREE.PerspectiveCamera(32, 1, 0.1, 200), lobbyChar = new THREE.Group(), lobbyCap = [];
(function () {
  var sc = lobbyScene, L = function (c) { return new THREE.MeshLambertMaterial({ color: c }); }, i;
  sc.background = new THREE.Color(0x4a2a8a); sc.fog = new THREE.Fog(0x4a2a8a, 35, 100);
  sc.add(new THREE.HemisphereLight(0xffe2c4, 0x5a3a8a, 1.0));
  var dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(4, 8, 8); sc.add(dl);
  var moon = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), new THREE.MeshBasicMaterial({ color: 0xe6e0ff })); moon.position.set(2, 12, -40); sc.add(moon);
  [[-19, -32, 15], [24, -46, 20]].forEach(function (q) { var m = new THREE.Mesh(new THREE.ConeGeometry(q[2], q[2], 4), L(0xd9a066)); m.rotation.y = Math.PI / 4; m.position.set(q[0], q[2] / 2, q[1]); sc.add(m); });
  var fl = new THREE.Mesh(new THREE.CircleGeometry(70, 48), L(0xf2a65a)); fl.rotation.x = -Math.PI / 2; sc.add(fl);
  for (i = 0; i < 9; i++) { var c = new THREE.Mesh(new THREE.SphereGeometry(rnd(2.5, 4.5), 14, 10), L(i % 2 ? 0xffb878 : 0xff9a6a)); c.position.set(-26 + i * 6.5, rnd(0.5, 2), rnd(-24, -14)); c.scale.y = 0.6; sc.add(c); }
  var sg = new THREE.BufferGeometry(), sp = []; for (i = 0; i < 80; i++) sp.push(rnd(-50, 50), rnd(6, 35), rnd(-60, -30));
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })));
  /* personagem: boné, camiseta laranja, calça azul */
  var O = { ol: 1 }, g = lobbyChar, skin = 0xe9a070;
  [-0.2, 0.2].forEach(function (x) { put(G.cyl(0.17, 0.19, 0.7), 0x2f6fd0, x, 0.5, 0, g, O); put(G.sph(0.2), 0x6b3f2a, x, 0.12, 0.08, g, { ol: 1, s: [1, 0.6, 1.4] }); });
  put(G.cyl(0.5, 0.52, 0.35), 0x2f6fd0, 0, 0.9, 0, g, O);
  put(G.sph(0.62), 0xf07a30, 0, 1.3, 0, g, { ol: 1, s: [0.95, 0.95, 0.8] });
  [-1, 1].forEach(function (d) { put(G.cyl(0.16, 0.18, 0.6), 0xf07a30, d * 0.7, 1.2, 0, g, { ol: 1, rz: d * 0.25 }); put(G.sph(0.17), skin, d * 0.82, 0.86, 0.02, g, O); });
  put(G.sph(0.58), skin, 0, 2.0, 0, g, { ol: 1, s: [1, 0.95, 0.95] });
  [-0.2, 0.2].forEach(function (x) { put(G.sph(0.075), 0x1a1220, x, 2.0, 0.5, g, { s: [0.8, 1.4, 0.5] }); });
  put(G.sph(0.08), 0xd98558, 0, 1.9, 0.56, g);
  lobbyCap.push(put(new THREE.SphereGeometry(0.62, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0x7bd88f, 0, 2.1, 0, g, { ol: 1, s: [1, 0.9, 1] }));
  lobbyCap.push(put(G.sph(0.5), 0x7bd88f, 0, 2.1, 0.45, g, { ol: 1, s: [1, 0.12, 0.9] }));
  g.scale.setScalar(1.15); sc.add(g);
  lobbyCam.position.set(0, 1.7, 8.5); lobbyCam.lookAt(0, 1.45, 0);
})();
var lb = { key: '', models: {} };
function refreshLobbyChar() {
  while (lobbyChar.children.length) lobbyChar.remove(lobbyChar.children[0]);
  var m = lb.models[S.char] || (lb.models[S.char] = buildChar(S.char)); scene.remove(m.g); m.g.visible = true;
  while (m.slot.children.length) m.slot.remove(m.slot.children[0]);
  if (!m.body) { m.body = []; var bc = CHARS[S.char].body; m.g.traverse(function (o) { if (o.material && o.material.color && !o.material.side && o.material.color.getHex() === bc) m.body.push(o); }); }
  var sk = SKINS[profile.skin]; m.body.forEach(function (o) { o.material.color.setHex(sk ? sk.col : CHARS[S.char].body); });
  m.slot.add(gunModel(S.weapon).g); m.g.scale.setScalar(1.35); lobbyChar.add(m.g);
}
function setLobbyCap(col) { lobbyCap.forEach(function (m) { m.material.color.set(col); }); }
function lobbyTick(now) {
  var t = now / 1000, asp = window.innerWidth / window.innerHeight;
  if (lobbyCam.aspect !== asp) { lobbyCam.aspect = asp; lobbyCam.updateProjectionMatrix(); }
  pickerTick(t); lobbyChar.rotation.y = Math.PI - 0.5 + Math.sin(t * 0.7) * 0.25; var hm = lb.models[S.char]; if (hm) { hm.legs[0].rotation.x = Math.sin(t * 2) * 0.1; hm.legs[1].rotation.x = -Math.sin(t * 2) * 0.1; } lobbyChar.scale.y = 1.15 * (1 + Math.sin(t * 2.2) * 0.012);
}
function renderLobby() {
  var ck = S.char + '|' + S.weapon + '|' + profile.skin; if (lb.key !== ck) { lb.key = ck; refreshLobbyChar(); }
  var l = levelOf(profile.xp), a = xpFor(l), b = xpFor(l + 1);
  $('lbName').textContent = profile.name; $('lbLv').textContent = l; $('lbRank').textContent = rankOf(l);
  $('lbXp').style.width = Math.round((profile.xp - a) / (b - a) * 100) + '%'; $('lbXpTxt').textContent = (profile.xp - a) + '/' + (b - a);
  $('lbW').textContent = profile.wins; $('lbXpTot').textContent = profile.coins;
  var nx = TIERS.filter(function (t) { return profile.kills < t.need; })[0], rdy = TIERS.filter(function (t) { return profile.kills >= t.need && profile.claimed.indexOf(t.n) < 0; }).length;
  $('lbXpTxt').textContent = (rdy ? '🎁' + rdy + ' ' : '') + profile.kills + '/' + (nx ? nx.need : TIERS[TIERS.length - 1].need); $('lbK').textContent = profile.kills;
  $('lbKD').textContent = (profile.kills / Math.max(1, profile.deaths)).toFixed(1);
  $('lbMap').textContent = MAPS[S.map].name; $('lbDiff').textContent = 'Dificuldade: ' + DIFF[S.diff].name;
  $('lbAv').innerHTML = CHAR_ICONS[S.char] || ''; $('lbAv').style.background = AVATARS[profile.color] || AVATARS[0];
  setLobbyCap(AVATARS[profile.color] || AVATARS[0]);
}
/* ---- seletor com prévia 3D ---- */
var pk = { kind: null, models: {}, pivot: new THREE.Group(), inner: null, legs: null, jump: 0 };
pk.pivot.visible = false; lobbyScene.add(pk.pivot);
function lobbyBg(c) { lobbyScene.background.set(c); lobbyScene.fog.color.set(c); }
function showPreview(kind, k) {
  while (pk.pivot.children.length) pk.pivot.remove(pk.pivot.children[0]);
  var inner = new THREE.Group(); pk.inner = inner; pk.pivot.add(inner); pk.kind = kind; pk.jump = 1; pk.legs = null;
  pk.pivot.rotation.set(0, 0, 0); pk.pivot.position.set(0, 0, 0); lobbyBg(0x4a2a8a);
  if (kind === 'chars') {
    var m = pk.models[k] || (pk.models[k] = buildChar(k)); scene.remove(m.g); m.g.visible = true;
    inner.add(m.g); pk.legs = m.legs; inner.scale.setScalar(1.55); pk.pivot.position.set(-1.2, 0.1, 0);
  } else if (kind === 'weps') {
    var gm = gunModel(k); gm.g.position.z = 0.4; inner.add(gm.g); inner.scale.setScalar(3.4); pk.pivot.position.set(-1.2, 1.6, 0);
  } else {
    var M = MAPS[k], A = HALF + 1;
    var bx = function (x, z, w, d, h, c) {
      var mat = new THREE.MeshLambertMaterial(M.glow ? { color: c, emissive: c } : { color: c });
      var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, h / 2, z); inner.add(b);
    };
    var fl = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF + 4, 0.5, 2 * HALF + 4), new THREE.MeshLambertMaterial({ color: M.floor })); fl.position.y = -0.25; inner.add(fl);
    bx(0, -A, 2 * HALF + 4, 2, 3, M.wall); bx(0, A, 2 * HALF + 4, 2, 3, M.wall); bx(-A, 0, 2, 2 * HALF + 4, 3, M.wall); bx(A, 0, 2, 2 * HALF + 4, 3, M.wall);
    mapList(M).forEach(function (q) { bx(q[0], q[1], q[2], q[3], q[4], q[5]); });
    inner.scale.setScalar(0.1); pk.pivot.rotation.x = 0.7; pk.pivot.position.set(-1.1, 1.4, 0); lobbyBg(M.sky);
  }
}
function pickerTick(t) {
  var inn = pk.inner; if (!pk.kind || !inn) return;
  if (pk.kind === 'chars') {
    inn.rotation.y = Math.PI + Math.sin(t * 0.9) * 0.6; pk.jump = Math.max(0, pk.jump - 0.03);
    inn.position.y = Math.abs(Math.sin(pk.jump * Math.PI * 3)) * pk.jump * 0.5 + Math.sin(t * 2.2) * 0.03;
    if (pk.legs) { pk.legs[0].rotation.x = Math.sin(t * 3) * 0.25; pk.legs[1].rotation.x = -Math.sin(t * 3) * 0.25; }
  } else if (pk.kind === 'weps') { inn.rotation.y = -1.2 + Math.sin(t * 0.8) * 0.6; inn.position.y = Math.sin(t * 1.6) * 0.1; }
  else inn.rotation.y = t * 0.35;
}
function syncMenu() {
  [['diffs', 'diff'], ['maps', 'map'], ['weps', 'weapon'], ['chars', 'char']].forEach(function (q) {
    $(q[0]).querySelectorAll('.opt').forEach(function (b) { b.classList.toggle('on', b.dataset.k === S[q[1]]); });
  });
}
var PK = { chars: [CHARS, 'char'], weps: [WEAPONS, 'weapon'], maps: [MAPS, 'map'] }, PKT = { chars: 'PERSONAGENS', weps: 'ARMAS', maps: 'MAPAS' };
function pickItem(kind, k) {
  var o = PK[kind][0][k]; S[PK[kind][1]] = k; saveSettings(); syncMenu();
  if (kind === 'maps') buildMap(k);
  if (kind === 'chars') renderProfile();
  $('pkList').querySelectorAll('.pkc').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
  $('pkName').textContent = o.name;
  $('pkDesc').textContent = kind === 'chars' ? o.power + ': ' + o.desc + ' (recarga ' + o.cd + 's)' : o.desc;
  $('pkStats').innerHTML = kind === 'weps' ? [['Dano', 0], ['Cadência', 1], ['Alcance', 2]].map(function (q) { return '<div class="pips"><em>' + q[0] + '</em>' + pips(o.stats[q[1]]) + '</div>'; }).join('') : '';
  showPreview(kind, k);
}
function openPicker(kind) {
  $('lobby').hidden = true; $('picker').hidden = false; lobbyChar.visible = false; pk.pivot.visible = true;
  var list = $('pkList'), src = PK[kind][0];
  list.innerHTML = '<h3>' + PKT[kind] + '</h3>';
  Object.keys(src).forEach(function (k) {
    var o = src[k], b = document.createElement('button'); b.className = 'pkc'; b.dataset.k = k;
    var th = kind === 'chars' ? CHAR_ICONS[k] : '', st = kind === 'weps' ? 'background:' + hex(o.col) + ';clip-path:polygon(50% 8%,92% 40%,50% 92%,8% 40%)' : kind === 'maps' ? 'background:linear-gradient(' + hex(o.sky) + ' 50%,' + o.floor + ' 50%)' : '';
    b.innerHTML = '<div class="th" style="' + (kind === 'weps' ? 'background:#0b1040' : '') + '">' + (kind === 'weps' ? '<div style="width:100%;height:100%;' + st + '"></div>' : kind === 'maps' ? '<div style="width:100%;height:100%;' + st + '"></div>' : th) + '</div><div><b>' + o.name + '</b><small>' + (kind === 'chars' ? o.power : o.desc) + '</small></div>';
    b.onclick = function () { pickItem(kind, k); }; list.appendChild(b);
  });
  pickItem(kind, S[PK[kind][1]]);
}
function closePicker() {
  $('picker').hidden = true; $('lobby').hidden = false; lobbyChar.visible = true; pk.pivot.visible = false; pk.kind = null; lobbyBg(0x4a2a8a); renderLobby();
}
document.querySelectorAll('[data-pick]').forEach(function (el) { el.addEventListener('click', function () { openPicker(el.dataset.pick); }); });
$('pkBack').onclick = closePicker;
/* ---- passe de abates e loja ---- */
var SKINS = { sk_purple: { name: 'Roxo Neon', col: 0x9a3cff, price: 150 }, sk_lime: { name: 'Verde Lima', col: 0x8aff2c, price: 150 }, sk_pink: { name: 'Rosa Choque', col: 0xff4fa8, price: 200 }, sk_gold: { name: 'Dourado', col: 0xffc400, price: 400 } };
var TRAILS = { tr_red: { name: 'Rastro Vermelho', col: 0xff3a3a, price: 100 }, tr_green: { name: 'Rastro Verde', col: 0x3aff7a, price: 100 }, tr_pink: { name: 'Rastro Rosa', col: 0xff4fd8, price: 200 }, tr_white: { name: 'Rastro Branco', col: 0xffffff, price: 300 } };
var TIERS = [], hub = { kind: '' };
for (var tn = 1; tn <= 12; tn++) TIERS.push({ n: tn, need: tn * 6, coins: 40 + tn * 10, item: tn === 4 ? 'tr_green' : tn === 8 ? 'sk_lime' : tn === 12 ? 'sk_gold' : null });
function trailCol() { var t = TRAILS[profile.trail]; return t ? t.col : null; }
function itemName(id) { var o = SKINS[id] || TRAILS[id]; return o ? o.name : id; }
function renderHub() {
  var h = '', owned = function (id) { return profile.owned.indexOf(id) >= 0; };
  $('hubCoins').textContent = profile.coins;
  if (hub.kind === 'pass') {
    h = '<div class="hh">ABATES: ' + profile.kills + ' · um prêmio a cada 6 abates</div>';
    TIERS.forEach(function (t) {
      var done = profile.claimed.indexOf(t.n) >= 0, ok = profile.kills >= t.need;
      h += '<div class="hc' + (ok && !done ? ' on' : '') + '"><b>Nível ' + t.n + '</b><span>' + t.need + ' abates</span><span>🪙 ' + t.coins + (t.item ? ' + ' + itemName(t.item) : '') + '</span><button class="hbtn" data-claim="' + t.n + '"' + (ok && !done ? '' : ' disabled') + '>' + (done ? 'Resgatado ✓' : ok ? 'Resgatar' : 'Bloqueado') + '</button></div>';
    });
  } else {
    [['CORES DE ROUPA', SKINS, 'skin'], ['RASTROS DE TIRO', TRAILS, 'trail']].forEach(function (g) {
      h += '<div class="hh">' + g[0] + '</div>';
      Object.keys(g[1]).forEach(function (id) {
        var o = g[1][id], has = owned(id), eq = profile[g[2]] === id;
        h += '<div class="hc' + (eq ? ' on' : '') + '"><div class="sw2" style="background:' + hex(o.col) + '"></div><b>' + o.name + '</b>' + (has ? '' : '<span>🪙 ' + o.price + '</span>') +
          '<button class="hbtn" ' + (has ? 'data-eq="' + id + '"' : 'data-buy="' + id + '"' + (profile.coins < o.price ? ' disabled' : '')) + '>' + (has ? (eq ? 'Equipado ✓' : 'Equipar') : 'Comprar') + '</button></div>';
      });
    });
  }
  $('hubBody').innerHTML = h;
}
$('hubBody').addEventListener('click', function (ev) {
  var el = ev.target.closest('button'); if (!el || el.disabled) return;
  var d = el.dataset, t, o;
  if (d.claim) { t = TIERS[d.claim - 1]; if (profile.claimed.indexOf(t.n) < 0 && profile.kills >= t.need) { profile.claimed.push(t.n); profile.coins += t.coins; if (t.item && profile.owned.indexOf(t.item) < 0) profile.owned.push(t.item); } }
  else if (d.buy) { o = SKINS[d.buy] || TRAILS[d.buy]; if (profile.coins >= o.price && profile.owned.indexOf(d.buy) < 0) { profile.coins -= o.price; profile.owned.push(d.buy); profile[SKINS[d.buy] ? 'skin' : 'trail'] = d.buy; } }
  else if (d.eq) { var k = SKINS[d.eq] ? 'skin' : 'trail'; profile[k] = profile[k] === d.eq ? '' : d.eq; }
  saveProfile(); renderHub(); renderLobby(); tone(900, 0.1, 'triangle', 0.12);
});
function openHub(kind) { hub.kind = kind; $('lobby').hidden = true; $('hub').hidden = false; $('hubTitle').textContent = kind === 'pass' ? 'PASSE DE ABATES' : 'LOJA'; renderHub(); }
$('hubBack').onclick = function () { $('hub').hidden = true; $('lobby').hidden = false; renderLobby(); };
document.querySelectorAll('[data-hub]').forEach(function (el) { el.addEventListener('click', function () { openHub(el.dataset.hub); }); });
$('lbPass').onclick = function () { openHub('pass'); };
$('lbCoin').onclick = function () { openHub('shop'); };
function openSetup() { $('lobby').hidden = true; $('menu').hidden = false; }
document.querySelectorAll('[data-open]').forEach(function (el) { el.addEventListener('click', openSetup); });
$('lbGear').onclick = openSetup;
$('btnBack').onclick = function () { $('menu').hidden = true; $('lobby').hidden = false; renderLobby(); };
$('lbPlay').onclick = startMatch;
$('lbDiff').onclick = function (ev) { ev.stopPropagation(); var k = Object.keys(DIFF); S.diff = k[(k.indexOf(S.diff) + 1) % k.length]; saveSettings(); renderLobby(); };

/* ================= BOOT ================= */
buildOptions(); bindSettings(); buildMap(S.map); renderProfile();
if (gunGroup) gunGroup.visible = false;
requestAnimationFrame(frame);
})();
