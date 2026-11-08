import * as THREE from './vendor/three-r185/three.module.min.js';
import { OrbitControls } from './vendor/three-r185/OrbitControls.js';
import { PLAN_ORIGIN, OUTLINE, ROOM_FACADE, VOID_FACADE } from './plan-geometry.js?v=2';

/* ============================================================================
   NIVAS 3D — v2

   One hostel block, built from the traced floor plan (plan-geometry.js) and
   refined against photographs of the real blocks (Kalam, Bhabha) and the
   satellite view of the cluster: thick white slab ribbons, red-orange louvres
   over deep balconies, tall slit windows, an enclosed white ground floor under
   the cantilevers, a plain parapet roof with solar arrays, paved courtyards,
   and the seven neighbouring blocks placed from OpenStreetMap footprints.

   What changed from v1 (kept whole in docs/archive/viewer3d-v1.js):
   - Rooms are real windows. Each floor's 30 panes are one InstancedMesh, so
     status colour and glow cost one draw call per floor, not 300 materials.
   - Opening a floor lifts every floor above it away on staggered springs and
     shows that floor's room layout as a cut model on its slab. "Stack" spreads
     all ten floors apart the same way.
   - Day / dusk / night lighting, crossfaded, never popped.
   - The scene renders only when something moves. A still building costs
     nothing; it stops entirely when scrolled away or the tab is hidden.
   ========================================================================== */

const view = document.getElementById('three-view');
const canvas = document.getElementById('hostel-3d-canvas');
const readout = document.getElementById('three-readout');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compact = Math.min(window.screen.width, window.screen.height) < 700 || (navigator.deviceMemory || 8) <= 4;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (error) {
  view.classList.remove('is-loading');
  view.classList.add('no-webgl');
  readout.innerHTML = '<strong>3D needs WebGL</strong><span>It is switched off in this browser. The floor plan works everywhere.</span>';
  window.nivasViewerFailed = true;   // app.js may not be listening yet
  window.dispatchEvent(new Event('nivas:viewer-failed'));
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;   // redrawn only when something casting one moves

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c9a9a6', 110, 420);
// Near/far kept tight: phone GPUs have little depth precision, and a 0.5..900
// range made close faces (bands on walls, louvres) shimmer as the camera moved.
// The fog has swallowed everything by 420, and the camera never gets nearer
// than ~9 units to its target.
const camera = new THREE.PerspectiveCamera(34, 1, 1.5, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .085;
controls.minDistance = 9;
controls.maxDistance = 170;
controls.maxPolarAngle = Math.PI * .475;
controls.zoomSpeed = .8;
controls.rotateSpeed = .7;

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.setScalar(compact ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 240 });
sun.shadow.bias = -.0005;
sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight();
scene.add(fill);

/* ── Dimensions (one world unit is about 2 m) ─────────────────────────────── */

const FLOOR_COUNT = 10;
/* One plan pixel is 3.4 cm. v1 guessed 5 cm; two independent checks say 3.4:
   OpenStreetMap has this block type at 56.1 x 30.1 m against 1626 x 899 plan px
   in the same frame, and at 5 cm a single room would be 20 m2 instead of ~9. */
const PLAN_SCALE = .017;
const floorHeight = 1.6;         // ~3.2 m
const groundClearance = 2.0;     // ground floor, ~4 m
const bandHeight = .56;          // white slab ribbon at each floor line (thick, as photographed)
const bandOut = .10;             // how far that ribbon oversails the wall
const wallIn = .16;              // room wall, set back behind the ribbon
const balconyIn = .78;           // balcony wall, set much deeper behind the louvres
const louvreBase = .51;          // fins start where the ribbon stops
const finHeight = floorHeight - louvreBase - .04;
const roofLevel = groundClearance + floorHeight * FLOOR_COUNT;
const STACK_GAP = 1.35;          // extra height between floors in stack view
const LIFT = 34;                 // how far the floors above an opened floor fly

/* ── Materials ───────────────────────────────────────────────────────────── */

const glow = {
  unlisted: { value: .0 },
  listed: { value: .3 },
};
function withGlow(material, perInstance) {
  // Adds an emissive term driven by the pane's own status colour, so a room
  // reads as lit from inside rather than painted. glowData.x = 1 for a
  // student-listed room, glowData.y = hover / selection boost.
  material.onBeforeCompile = shader => {
    shader.uniforms.uGlowUnlisted = glow.unlisted;
    shader.uniforms.uGlowListed = glow.listed;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 glowData;\nvarying vec2 vGlowData;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGlowData = glowData;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uGlowUnlisted;\nuniform float uGlowListed;\nvarying vec2 vGlowData;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (mix(uGlowUnlisted, uGlowListed, vGlowData.x) + vGlowData.y);`);
  };
  material.customProgramCacheKey = () => perInstance ? 'nivas-glow-instanced' : 'nivas-glow-vertex';
  return material;
}

const materials = {
  wall: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .86 }),
  slab: new THREE.MeshStandardMaterial({ color: '#d9d1c4', roughness: .9 }),   // floor caps ignore the wall's vertex colours
  band: new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .8 }),
  fins: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .78 }),
  frame: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .7 }),
  sill: new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .7 }),
  glass: withGlow(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .22, metalness: .15 }), true),
  tile: withGlow(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .7 }), false),
  partition: new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: .8 }),
  ground: new THREE.MeshStandardMaterial({ color: '#e6e1d6', emissive: '#ffb066', emissiveIntensity: 0, roughness: .92 }),
  column: new THREE.MeshStandardMaterial({ color: '#ece8df', roughness: .8 }),
  deck: new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: .95 }),
  metal: new THREE.MeshStandardMaterial({ color: '#3b3735', roughness: .55, metalness: .45 }),
  planter: new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: .95 }),
  soil: new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: 1 }),
  crown: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, flatShading: true }),
  foliage: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
  lamp: new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }),
  pin: new THREE.MeshBasicMaterial({ color: '#f05a25', toneMapped: false }),
  pinHalo: new THREE.MeshBasicMaterial({ color: '#f05a25', transparent: true, opacity: .35, depthWrite: false, toneMapped: false }),
};

// Mirrors the student-submitted swap status tokens in styles.css. Unlisted
// does not imply a vacancy or an official allocation.
const STATUS_HEX = { unlisted: '#514346', occupied: '#d6452f', open: '#e0a318', match: '#2f9161', waitlist: '#d6437e' };
const STATUS_COLOR = Object.fromEntries(Object.entries(STATUS_HEX).map(([key, hex]) => [key, new THREE.Color(hex)]));
const STATUS_LABEL = { unlisted: 'Unlisted', occupied: 'Registered', open: 'Open to swap', match: 'Match for you', waitlist: 'Waitlisted' };
const VOID_COLOR = new THREE.Color('#2a2224');

/* ── Geometry helpers ────────────────────────────────────────────────────── */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
/* A box minus its underside and the face that looks into the building (local
   +z or -z depending on how the outline winds). Used for fins, frames and sills,
   which are only ever seen from outside and above. */
let SLIM_BOX = UNIT_BOX;   // replaced once normalSign is known
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function matrixOf(position, rotationY = 0, scale = [1, 1, 1], rotationX = 0, rotationZ = 0) {
  return new THREE.Matrix4().compose(_v.set(...position), _q.setFromEuler(_e.set(rotationX, rotationY, rotationZ)), _s.set(...scale));
}
/* Many small parts as one BufferGeometry: one draw call instead of hundreds.
   parts: [{ geometry, matrix, color? }]. */
function bake(parts, withColor = false) {
  const position = [], normal = [], color = [], index = [];
  const normalMatrix = new THREE.Matrix3();
  for (const { geometry, matrix, color: tint } of parts) {
    const pos = geometry.attributes.position, nor = geometry.attributes.normal;
    const offset = position.length / 3;
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(matrix); position.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize(); normal.push(_v.x, _v.y, _v.z);
      if (withColor) color.push(tint.r, tint.g, tint.b);
    }
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) index.push(geometry.index.getX(i) + offset);
    else for (let i = 0; i < pos.count; i++) index.push(i + offset);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  if (withColor) out.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  out.setIndex(index);
  out.computeBoundingSphere();
  return out;
}
function mesh(geometry, material, parent, { cast = true, receive = true, y = 0 } = {}) {
  const item = new THREE.Mesh(geometry, material);
  item.position.y = y; item.castShadow = cast; item.receiveShadow = receive;
  parent.add(item);
  return item;
}
function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

/* ── The perimeter, straight out of the floor plan ───────────────────────── */

/* OUTLINE is the traced building perimeter in plan pixels (docs/trace-outline.py).
   Everything is positioned off it, so the 3D block and the 2D floor plan are
   literally the same drawing. */
const planX = value => (value - PLAN_ORIGIN[0]) * PLAN_SCALE;
const planZ = value => (value - PLAN_ORIGIN[1]) * PLAN_SCALE;
const ring = OUTLINE.map(([x, y]) => new THREE.Vector2(planX(x), planZ(y)));
const RING = ring.length;

function tangentAt(index) {
  const before = ring[(index - 1 + RING) % RING], after = ring[(index + 1) % RING];
  return new THREE.Vector2(after.x - before.x, after.y - before.y).normalize();
}
function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const normalSign = (() => {
  const probe = tangentAt(0);
  return insidePolygon(ring, ring[0].x + probe.y * .05, ring[0].y - probe.x * .05) ? -1 : 1;
})();
SLIM_BOX = (() => {
  const source = new THREE.BoxGeometry(1, 1, 1);
  const hidden = new Set([3, normalSign === 1 ? 4 : 5]);   // BoxGeometry faces: +x -x +y -y +z -z
  const index = [];
  for (let face = 0; face < 6; face++) if (!hidden.has(face)) for (let i = 0; i < 6; i++) index.push(source.index.getX(face * 6 + i));
  source.setIndex(index);
  return source;
})();
const normals = ring.map((_, index) => { const t = tangentAt(index); return new THREE.Vector2(t.y * normalSign, -t.x * normalSign); });
const headings = ring.map((_, index) => { const t = tangentAt(index); return Math.atan2(-t.y, t.x); });

function offsetRing(distance) {
  const at = typeof distance === 'function' ? distance : () => distance;
  return ring.map((point, index) => new THREE.Vector2(point.x + normals[index].x * at(index), point.y + normals[index].y * at(index)));
}
function shapeOf(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => index ? shape.lineTo(point.x, -point.y) : shape.moveTo(point.x, -point.y));
  shape.closePath();
  return shape;
}
/* Extrudes a ring upward: the shape's y carries -z, so rotating -90° about X
   lands the extrusion on +Y with the plan orientation intact. Group 0 is the
   caps, group 1 the sides. */
function slabGeometry(points, height, holePoints, bevel = 0) {
  const shape = shapeOf(points);
  if (holePoints) shape.holes.push(new THREE.Path(holePoints.slice().reverse().map(point => new THREE.Vector2(point.x, -point.y))));
  const options = bevel
    ? { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: 1 }
    : { depth: height, bevelEnabled: false, curveSegments: 1 };
  const geometry = new THREE.ExtrudeGeometry(shape, options).rotateX(-Math.PI / 2);
  if (bevel) geometry.translate(0, bevel, 0);
  return geometry;
}
/* Which stretches of the perimeter are room facade, and which are louvred
   balcony. Rooms only ever front onto the straight runs. */
const facadeRuns = [...ROOM_FACADE, ...VOID_FACADE].filter(Boolean);
const isBalcony = ring.map((_, index) => !facadeRuns.some(([from, to]) => index >= from && index <= to));
// Wall set-back per ring point, smoothed so balcony recesses ease in and out
// instead of stepping.
const wallDepth = ring.map((_, index) => {
  let sum = 0;
  for (let k = -3; k <= 3; k++) sum += isBalcony[(index + k + RING) % RING] ? balconyIn : wallIn;
  return sum / 7;
});

/* The traced outline has a point every ~28 cm along every straight run. The
   shell (walls, ribbons, deck, canopy) only needs the corners, so it keeps an
   index where the outline turns or the wall set-back changes. Fins and windows
   still sit on the full ring. */
const shellIndices = (() => {
  const keep = [];
  for (let i = 0; i < RING; i++) {
    const here = ring[i], before = ring[(i - 1 + RING) % RING], after = ring[(i + 1) % RING];
    const incoming = new THREE.Vector2().subVectors(here, before).normalize();
    const outgoing = new THREE.Vector2().subVectors(after, here).normalize();
    const turn = Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing), -1, 1));
    const setback = Math.abs(wallDepth[i] - wallDepth[(i + 1) % RING]) + Math.abs(wallDepth[i] - wallDepth[(i - 1 + RING) % RING]);
    if (turn > .006 || setback > .004) keep.push(i);
  }
  return keep;
})();
function shellRing(distance) {
  const at = typeof distance === 'function' ? distance : () => distance;
  return shellIndices.map(index => new THREE.Vector2(ring[index].x + normals[index].x * at(index), ring[index].y + normals[index].y * at(index)));
}

function runFrame(from, to) {
  const start = ring[from], end = ring[to];
  const direction = new THREE.Vector2(end.x - start.x, end.y - start.y);
  const length = direction.length() || .1;
  direction.divideScalar(length);
  const normal = new THREE.Vector2();
  for (let i = from; i <= to; i++) normal.add(normals[i]);
  normal.normalize();
  return { x: (start.x + end.x) / 2, z: (start.y + end.y) / 2, nx: normal.x, nz: normal.y, length, angle: Math.atan2(-direction.y, direction.x) };
}
const roomFrames = ROOM_FACADE.map(run => run && runFrame(run[0], run[1]));
const ROOM_COUNT = roomFrames.length;
const POD_SIZES = [8, 8, 6, 8];
const podOfRoom = POD_SIZES.flatMap((size, index) => Array(size).fill(index + 1));
const POD_CENTRES = [[346.5, 337.5], [702, 692.5], [1058, 337.5], [1414.5, 692.5]];   // plan px
const roomIdOf = (floor, roomIndex) => `${floor + 1}${String(roomIndex + 1).padStart(2, '0')}`;

/* ── The room layout, from the same SVG paths the floor plan draws ───────── */

function parsePath(path) {
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push(new THREE.Vector2(planX(numbers[i]), planZ(numbers[i + 1])));
  return points;
}
const planData = window.NIVAS_PLAN || { roomShapes: [], voidShapes: [] };
const roomPolygons = planData.roomShapes.map(parsePath);
const voidPolygons = planData.voidShapes.map(parsePath);
const roomCentroids = roomPolygons.map(points => points.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(points.length || 1));

// Room tiles: one geometry for every floor (each floor gets its own colour
// buffer). vertexRoom maps a vertex back to its room for picking.
const TILE_HEIGHT = .06;
const tileParts = [], vertexRoomList = [];
[...roomPolygons, ...voidPolygons].forEach((points, polygonIndex) => {
  if (points.length < 3) return;
  const geometry = slabGeometry(points, TILE_HEIGHT);
  tileParts.push({ geometry, matrix: new THREE.Matrix4(), color: new THREE.Color() });
  const isVoid = polygonIndex >= roomPolygons.length;
  for (let i = 0; i < geometry.attributes.position.count; i++) vertexRoomList.push(isVoid ? -1 : polygonIndex);
});
const tileBase = tileParts.length ? bake(tileParts, true) : null;
const vertexRoom = Int16Array.from(vertexRoomList);
const roomVertexRanges = [];
vertexRoom.forEach((room, vertex) => {
  if (room < 0) return;
  const range = roomVertexRanges[room] ||= [vertex, vertex];
  range[1] = vertex;
});

// Low partition walls on every room edge: the floor reads as an architect's
// cut model when the floors above lift away.
const partitionGeometry = (() => {
  const parts = [];
  [...roomPolygons, ...voidPolygons].forEach(points => points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const length = a.distanceTo(b);
    if (length < .05) return;
    parts.push({ geometry: UNIT_BOX, matrix: matrixOf([(a.x + b.x) / 2, TILE_HEIGHT + .2, (a.y + b.y) / 2], Math.atan2(-(b.y - a.y), b.x - a.x), [length + .06, .4, .06]) });
  }));
  return parts.length ? bake(parts) : null;
})();

/* ── The building ────────────────────────────────────────────────────────── */

const building = new THREE.Group();
scene.add(building);
const groundGroup = new THREE.Group();
const roofGroup = new THREE.Group();
building.add(groundGroup, roofGroup);
const floors = [];

const wallRing = shellRing(index => -wallDepth[index]);
const wallGeometry = (() => {
  // Rust where a room fronts the facade, near-black deep in a balcony, so the
  // gaps between louvres read as shadowed depth, the way the render shows it.
  const geometry = slabGeometry(wallRing, floorHeight);
  const position = geometry.attributes.position, colors = [];
  const room = new THREE.Color('#c8452d'), deep = new THREE.Color('#5a362d'), tone = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    let best = Infinity, nearest = 0;
    for (let k = 0; k < RING; k += 2) {
      const d = (ring[k].x - x) ** 2 + (ring[k].y - z) ** 2;
      if (d < best) { best = d; nearest = k; }
    }
    const t = THREE.MathUtils.smoothstep(wallDepth[nearest], wallIn, balconyIn);
    tone.lerpColors(room, deep, t);
    colors.push(tone.r, tone.g, tone.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
})();
const bandGeometry = slabGeometry(shellRing(bandOut), bandHeight, null, .07);

const finGeometry = (() => {
  // Louvre blades every ~26 cm of facade, placed by arc length along the balcony runs
  // (the traced outline's own spacing is finer than the real pitch). Each blade is a
  // touch different in tone, so the screen reads as painted concrete, not a stripe.
  const random = seeded(7), PITCH = .13;
  const base = new THREE.Color('#cf5236');
  const parts = [];
  let carry = 0;
  for (let index = 0; index < RING; index++) {
    const next = (index + 1) % RING;
    if (!isBalcony[index] || !isBalcony[next]) { carry = 0; continue; }
    const a = ring[index], b = ring[next], length = a.distanceTo(b), normal = normals[index];
    let at = carry;
    for (; at < length; at += PITCH) {
      const t = at / length;
      const x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t;
      parts.push({
        geometry: SLIM_BOX,
        matrix: matrixOf([x + normal.x * (-wallIn + .06), louvreBase + finHeight / 2, z + normal.y * (-wallIn + .06)], headings[index], [.065, finHeight, .36]),
        color: base.clone().offsetHSL((random() - .5) * .02, (random() - .5) * .08, (random() - .5) * .08),
      });
    }
    carry = at - length;
  }
  return bake(parts, true);
})();

/* Each room's window is a group of tall slits, as photographed: one glass pane
   (instanced, carries the status colour) behind red piers that continue the wall.
   Frames, piers and the head rail share one geometry for every floor. */
const WIN_BOTTOM = louvreBase + .09, WIN_HEIGHT = floorHeight - WIN_BOTTOM - .16;
const SLITS = 3, PIER = .055;
const windowFrames = roomFrames.map(frame => frame && {
  ...frame,
  width: Math.max(.6, frame.length - .1),
  matrixAt(local, scale, depth) {
    const world = new THREE.Matrix4().makeTranslation(frame.x + frame.nx * (-wallIn + depth), 0, frame.z + frame.nz * (-wallIn + depth));
    world.multiply(new THREE.Matrix4().makeRotationY(frame.angle));
    world.multiply(new THREE.Matrix4().compose(_v.set(...local), _q.identity(), _s.set(...scale)));
    return world;
  },
});
const frameGeometry = (() => {
  const parts = [], sills = [], pier = new THREE.Color('#c4452c'), dark = new THREE.Color('#2a2326');
  windowFrames.forEach(w => {
    if (!w) return;
    const mid = WIN_BOTTOM + WIN_HEIGHT / 2, half = w.width / 2, slit = (w.width - PIER * (SLITS + 1)) / SLITS;
    for (let k = 0; k <= SLITS; k++) {
      parts.push({ geometry: SLIM_BOX, color: pier, matrix: w.matrixAt([-half + PIER / 2 + k * (slit + PIER), mid, 0], [PIER, WIN_HEIGHT + .1, .1], .06) });
    }
    parts.push({ geometry: SLIM_BOX, color: dark, matrix: w.matrixAt([0, WIN_BOTTOM + WIN_HEIGHT + .03, 0], [w.width, .05, .08], .05) });
    sills.push({ geometry: SLIM_BOX, matrix: w.matrixAt([0, WIN_BOTTOM - .04, 0], [w.width + .1, .06, .16], .07) });
  });
  return { frames: bake(parts, true), sills: bake(sills) };
})();

function makeFloor(floor) {
  const group = new THREE.Group();
  const y0 = groundClearance + floor * floorHeight;
  building.add(group);
  const level = new THREE.Group();
  level.position.y = y0;
  group.add(level);

  const wall = mesh(wallGeometry, [materials.slab, materials.wall], level);
  wall.userData = { kind: 'wall' };
  mesh(bandGeometry, materials.band, level, { y: -.05 });
  mesh(finGeometry, materials.fins, level, { cast: false });
  mesh(frameGeometry.frames, materials.frame, level, { cast: false, receive: false });
  mesh(frameGeometry.sills, materials.sill, level, { cast: false });

  // Glass, one instance per room.
  const glass = new THREE.InstancedMesh(UNIT_BOX, materials.glass, ROOM_COUNT);
  glass.castShadow = false; glass.receiveShadow = true;
  const glowData = new THREE.InstancedBufferAttribute(new Float32Array(ROOM_COUNT * 2), 2);
  glass.geometry = UNIT_BOX.clone();
  glass.geometry.setAttribute('glowData', glowData);
  windowFrames.forEach((w, roomIndex) => {
    const matrix = w ? w.matrixAt([0, WIN_BOTTOM + WIN_HEIGHT / 2, 0], [w.width, WIN_HEIGHT, .05], .02) : new THREE.Matrix4().makeScale(0, 0, 0);
    glass.setMatrixAt(roomIndex, matrix);
    glass.setColorAt(roomIndex, STATUS_COLOR.unlisted);
  });
  glass.computeBoundingSphere();
  glass.userData = { kind: 'glass', floor };
  level.add(glass);

  // Cut-model layer: room tiles + partitions on top of the slab. Hidden until
  // this floor is opened or the stack is spread.
  const plate = new THREE.Group();
  plate.position.y = floorHeight + .004;
  plate.visible = false;
  level.add(plate);
  let tiles = null;
  if (tileBase) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', tileBase.attributes.position);
    geometry.setAttribute('normal', tileBase.attributes.normal);
    geometry.setAttribute('color', tileBase.attributes.color.clone());
    geometry.setAttribute('glowData', new THREE.Float32BufferAttribute(new Float32Array(tileBase.attributes.position.count * 2), 2));
    geometry.setIndex(tileBase.index);
    geometry.boundingSphere = tileBase.boundingSphere;
    const colors = geometry.attributes.color;
    vertexRoom.forEach((room, vertex) => room < 0 && colors.setXYZ(vertex, VOID_COLOR.r, VOID_COLOR.g, VOID_COLOR.b));
    tiles = mesh(geometry, materials.tile, plate, { cast: false });
    tiles.userData = { kind: 'tile', floor };
  }
  if (partitionGeometry) mesh(partitionGeometry, materials.partition, plate, { cast: false });

  return { group, level, wall, glass, tiles, plate, y0, status: Array(ROOM_COUNT).fill('unlisted'), boost: new Float32Array(ROOM_COUNT) };
}
for (let floor = 0; floor < FLOOR_COUNT; floor++) floors.push(makeFloor(floor));

/* ── The block's own ground floor, roof and furniture ────────────────────────

   Refined against photographs of Kalam and Bhabha and the satellite view of the
   eight-block cluster (docs/CAMPUS-RESEARCH.md): the ground floor is an enclosed
   white volume tucked under the cantilevered slabs, courtyards are paved (stone
   slabs, herringbone brick), planters hold one slender young tree, bicycles
   gather at the doors, and the roofs carry a thick white parapet, solar arrays
   and round water drums.

   Everything below is built in the block's own frame. The seven neighbouring
   blocks reuse the same geometry through InstancedMesh, so a whole cluster costs
   a handful of extra draw calls. */

const site = new THREE.Group();   // everything that isn't the selectable block
scene.add(site);

/* The eight new blocks, from OpenStreetMap footprints: metres east and north of
   a fixed point, and the angle of each block's long axis. The first is the block
   this view stands for (Kalam, the easternmost, so the rest of the cluster sits
   behind it from the default camera); the others become its neighbours. Eight
   positions are a small, one-off use of the data; the page credits OpenStreetMap
   contributors. The model's own long axis is -15.7 deg in the same frame. */
const CLUSTER = [
  [2.3, -20.9, 82.8], [-17.0, -76.5, -8.8], [-87.0, -76.3, -8.8], [-135.3, -67.4, 76.4],
  [-51.7, -38.3, -8.8], [-95.9, -22.6, 76.8], [-60.7, 25.5, 80.8], [-12.2, 29.8, -8.8],
];
const PLAN_AXIS_DEG = -15.7;
const NEIGHBOURS = CLUSTER.slice(1).map(([east, north, axis]) => {
  const [e0, n0, a0] = CLUSTER[0];
  const delta = THREE.MathUtils.degToRad(PLAN_AXIS_DEG - a0);   // turn that lays the shown block's axis on the model's
  const de = east - e0, dn = north - n0;
  const e = de * Math.cos(delta) - dn * Math.sin(delta), n = de * Math.sin(delta) + dn * Math.cos(delta);
  return { x: e / 2, z: -n / 2, yaw: THREE.MathUtils.degToRad(axis - a0) };   // 2 m per unit, north is -z
});
// Neighbours, their furniture and their shadows live in one group, so they can be switched off.
const context = new THREE.Group();
site.add(context);
function neighbourInstances(geometry, material, { cast = true, receive = true, y = 0 } = {}) {
  const instanced = new THREE.InstancedMesh(geometry, material, NEIGHBOURS.length);
  NEIGHBOURS.forEach((t, i) => instanced.setMatrixAt(i, matrixOf([t.x, y, t.z], t.yaw)));
  instanced.castShadow = cast; instanced.receiveShadow = receive;
  instanced.computeBoundingSphere();
  context.add(instanced);
  return instanced;
}

/* Procedural surfaces. Small canvases, repeated; mip-mapped so they settle to a
   flat colour at distance instead of shimmering. */
function repeating(surface, anisotropy = 4) {
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}
function drawn(width, height, paint) {
  const surface = document.createElement('canvas');
  surface.width = width; surface.height = height;
  paint(surface.getContext('2d'));
  return repeating(surface);
}
const herringbone = drawn(256, 256, ctx => {
  const random = seeded(5), palette = ['#9d9084', '#978a7f', '#a39689', '#928579', '#9b8c80', '#8e8176'];
  ctx.fillStyle = '#7d7268'; ctx.fillRect(0, 0, 256, 256);
  for (let row = -1; row <= 16; row++) for (let col = -1; col <= 16; col++) {
    ctx.save();
    ctx.translate(col * 16 + 8, row * 16 + 8);
    ctx.rotate(((col + row) % 2 ? 1 : -1) * Math.PI / 4);
    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    ctx.fillRect(-10.5, -3.5, 21, 7);
    ctx.restore();
  }
});
const stoneSlabs = drawn(256, 256, ctx => {
  const random = seeded(11), tones = ['#a8a39a', '#9d988f', '#b0aba1', '#948f86', '#a39e94'];
  ctx.fillStyle = '#5f5a54'; ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    ctx.fillStyle = tones[Math.floor(random() * tones.length)];
    ctx.fillRect(col * 64 + 1.5, row * 32 + 1.5, 61, 29);
  }
});
const dryEarth = drawn(256, 256, ctx => {
  const random = seeded(3);
  ctx.fillStyle = '#8a8571'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const shade = 125 + Math.floor(random() * 50);
    ctx.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 24}, ${.08 + random() * .12})`;
    ctx.fillRect(random() * 256, random() * 256, 2 + random() * 5, 2 + random() * 3);
  }
});
// One floor of the neighbouring blocks' facade: louvres above, the white slab ribbon at the
// floor's foot (the UVs below put the bottom of the canvas at the bottom of the floor).
const facadeFloor = drawn(256, 128, ctx => {
  ctx.fillStyle = '#84483a'; ctx.fillRect(0, 0, 256, 80);
  ctx.fillStyle = '#cf5236';
  for (let i = 0; i < 16; i++) ctx.fillRect(i * 16 + 1, 0, 9, 80);
  ctx.fillStyle = '#b9b3a8'; ctx.fillRect(0, 80, 256, 4);
  ctx.fillStyle = '#e8e4dc'; ctx.fillRect(0, 84, 256, 44);
});
const asphalt = drawn(128, 128, ctx => {
  const random = seeded(19);
  ctx.fillStyle = '#5d5a55'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { const v = 70 + Math.floor(random() * 50); ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`; ctx.fillRect(random() * 128, random() * 128, 1 + random() * 2, 1 + random() * 2); }
});
const poolLight = (() => {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 128;
  const ctx = surface.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();
materials.earth = new THREE.MeshStandardMaterial({ map: dryEarth, roughness: 1, transparent: true });
materials.road = new THREE.MeshStandardMaterial({ map: asphalt, roughness: .95 });
materials.brick = new THREE.MeshStandardMaterial({ map: herringbone, roughness: .92 });
materials.stone = new THREE.MeshStandardMaterial({ map: stoneSlabs, roughness: .9 });
materials.lampPool = new THREE.MeshBasicMaterial({ map: poolLight, color: '#ffcf8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
materials.frameDetail = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .6 });

/* Ground floor: an enclosed cream volume set back under the slabs, with dark
   windows and a few doors, and slender columns at the slab edge. */
const groundVolume = slabGeometry(shellRing(-1.25), groundClearance - .18);
const groundDetail = (() => {
  const parts = [], dark = new THREE.Color('#2b2a2e'), door = new THREE.Color('#c9c7c1');
  for (let index = 6; index < RING; index += 14) {
    const p = ring[index], n = normals[index], at = (d) => [p.x - n.x * (1.25 - d), 0, p.y - n.y * (1.25 - d)];
    const isDoor = (index / 14 | 0) % 3 === 0;
    const base = at(.04);
    parts.push({
      geometry: UNIT_BOX,
      matrix: matrixOf([base[0], isDoor ? .75 : 1.0, base[2]], headings[index], isDoor ? [.55, 1.15, .08] : [.8, .6, .08]),
      color: isDoor ? door : dark,
    });
  }
  return bake(parts, true);
})();
const columnGeometry = new THREE.CylinderGeometry(.11, .13, groundClearance - .1, 10);
const columnSpots = [];
for (let index = 0; index < RING; index += 12) columnSpots.push(index);
const columnMatrices = columnSpots.map(index => {
  const p = ring[index], n = normals[index];
  return matrixOf([p.x - n.x * .3, (groundClearance - .1) / 2 + .14, p.y - n.y * .3]);
});

/* Court furniture, built once in the block's frame: round concrete planters with
   a young tree, and bicycles in loose clusters at the doors, as in the photos. */
const COURT_SEATS = [[1058, 640], [720, 400], [300, 640], [1620, 360]];
const BIKE_SPOTS = [[980, 720, 7], [1140, 725, 6], [640, 300, 7], [800, 300, 6], [560, 985, 6], [1300, 985, 6], [330, 560, 4], [1590, 420, 4], [1010, 560, 5], [740, 470, 5]];
const furniture = (() => {
  const random = seeded(41);
  const planter = [], soil = [], trunk = [], crown = [], bikes = [];
  const wheel = new THREE.TorusGeometry(.27, .045, 3, 9), bar = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  const blob = new THREE.IcosahedronGeometry(1, 0);
  const frameTones = ['#1d1d20', '#20242b', '#9a2a22', '#2b4c7a', '#cfd2d6', '#18695c', '#303034', '#b0452a'].map(hex => new THREE.Color(hex));
  const tyre = new THREE.Color('#2a2a2f');
  const V = (a, b, c) => new THREE.Vector3(a, b, c);
  const rod = (list, a, b, radius, base, color) => {
    const start = a.clone().applyMatrix4(base), end = b.clone().applyMatrix4(base);
    const direction = end.clone().sub(start), length = direction.length();
    list.push({ geometry: bar, color, matrix: new THREE.Matrix4().compose(start.clone().add(end).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), new THREE.Vector3(radius, length, radius)) });
  };
  const bicycle = (x, z, angle, lean) => {
    const base = matrixOf([x, .06, z], angle, [1.25, 1.25, 1.25], lean, 0);
    const frame = frameTones[Math.floor(random() * frameTones.length)];
    [-.34, .34].forEach(offset => bikes.push({ geometry: wheel, color: tyre, matrix: base.clone().multiply(matrixOf([offset, .28, 0])) }));
    rod(bikes, V(-.34, .28, 0), V(0, .62, 0), .028, base, frame); rod(bikes, V(0, .62, 0), V(.34, .28, 0), .028, base, frame);
    rod(bikes, V(-.34, .28, 0), V(.34, .28, 0), .026, base, frame);
    rod(bikes, V(.28, .5, 0), V(.34, .82, 0), .026, base, tyre);
  };
  const tree = (x, z, scale = 1) => {
    const height = (2.7 + random() * .7) * scale;
    trunk.push({ geometry: new THREE.CylinderGeometry(.06 * scale, .095 * scale, height, 5), matrix: matrixOf([x, .65 + height / 2, z]) });
    // A young tree: a few small leaf clusters, loosely spread, never a solid ball.
    const greens = ['#5d9440', '#6aa047', '#4c8438', '#7aae55'];
    for (let i = 0; i < 12; i++) {
      const a = random() * Math.PI * 2, r = (.3 + random() * 1.05) * scale, h = (.4 + random() * 1.25) * scale, s = (.3 + random() * .3) * scale;
      crown.push({ geometry: blob, matrix: matrixOf([x + Math.cos(a) * r, .65 + height * .78 + h * .55, z + Math.sin(a) * r], random() * 6, [s * 1.35, s * .7, s * 1.35]), color: new THREE.Color(greens[Math.floor(random() * greens.length)]) });
    }
  };
  COURT_SEATS.forEach(([px, py]) => {
    const x = planX(px), z = planZ(py);
    planter.push({ geometry: new THREE.CylinderGeometry(.95, 1.0, .48, 20), matrix: matrixOf([x, .24, z]) });
    soil.push({ geometry: new THREE.CylinderGeometry(.82, .82, .06, 16), matrix: matrixOf([x, .5, z]) });
    tree(x, z - .05);
  });
  BIKE_SPOTS.forEach(([px, py, count]) => {
    const cx = planX(px), cz = planZ(py);
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .95;
      const bx = cx + Math.cos(a) * r * 1.3, bz = cz + Math.sin(a) * r * .8;
      const lean = (random() - .5) * .35, turn = random() * Math.PI;
      if (!insidePolygon(offsetRing(.5), bx, bz)) bicycle(bx, bz, turn, lean);
    }
  });
  return { planter: bake(planter), soil: bake(soil), trunk: bake(trunk), crown: bake(crown, true), bikes: bake(bikes, true) };
})();
materials.bike = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .55, metalness: .25 });

/* Roof kit: solar arrays at the pod centres, two round water drums and the stair
   heads (IITH says photovoltaics are fitted on the roofs; the satellite view shows
   the arrays and drums). Positions are representative, not surveyed. */
const roofKit = (() => {
  const parts = [], panel = new THREE.Color('#1c3354'), frame = new THREE.Color('#d9d7d2'), drum = new THREE.Color('#cfcac0'), lid = new THREE.Color('#8f8a82'), head = new THREE.Color('#e4dfd5');
  POD_CENTRES.forEach(([px, py], pod) => {
    const cx = planX(px), cz = planZ(py), deck = roofLevel + .62;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
      parts.push({ geometry: UNIT_BOX, color: panel, matrix: matrixOf([cx - .62 + col * 1.24, deck + .32, cz - 1.15 + row * .78 - .1], 0, [1.14, .05, .72], -.28) });
      parts.push({ geometry: UNIT_BOX, color: frame, matrix: matrixOf([cx - .62 + col * 1.24, deck + .15, cz - 1.15 + row * .78 - .1], 0, [.06, .3, .06]) });
    }
    parts.push({ geometry: UNIT_BOX, color: head, matrix: matrixOf([cx + 2.0, deck + .5, cz + .5], 0, [1.2, 1.0, 1.0]) });
    if (pod % 2 === 0) {
      parts.push({ geometry: new THREE.CylinderGeometry(.72, .72, .8, 14), color: drum, matrix: matrixOf([cx - 2.0, deck + .4, cz + .9]) });
      parts.push({ geometry: new THREE.CylinderGeometry(.74, .74, .06, 14), color: lid, matrix: matrixOf([cx - 2.0, deck + .83, cz + .9]) });
    }
  });
  return bake(parts, true);
})();
materials.roofKit = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .6, metalness: .1 });

/* — this block — */
mesh(groundVolume, [materials.ground, materials.ground], groundGroup, { y: .16 });
mesh(groundDetail, materials.frameDetail, groundGroup, { y: .16, cast: false });
{
  const columns = new THREE.InstancedMesh(columnGeometry, materials.column, columnMatrices.length);
  columnMatrices.forEach((m, i) => columns.setMatrixAt(i, m));
  columns.castShadow = true; columns.receiveShadow = true;
  groundGroup.add(columns);
}
mesh(furniture.planter, materials.planter, groundGroup);
mesh(furniture.soil, materials.soil, groundGroup, { cast: false });
mesh(furniture.trunk, materials.trunk, groundGroup);
mesh(furniture.crown, materials.crown, groundGroup);
mesh(furniture.bikes, materials.bike, groundGroup, { cast: false });

/* Roof: the top slab, a deck, a thick white parapet (as in the photographs), and the kit. */
mesh(bandGeometry, materials.band, roofGroup, { y: roofLevel - .05 });
mesh(slabGeometry(shellRing(-wallIn), .22), [materials.deck, materials.deck], roofGroup, { y: roofLevel + .4 });
const parapetGeometry = slabGeometry(shellRing(.03), .72, shellRing(-.3));
mesh(parapetGeometry, [materials.band, materials.band], roofGroup, { y: roofLevel + .5 });
mesh(roofKit, materials.roofKit, roofGroup);

/* — the seven neighbours: same shell, a textured facade instead of 6,000 fins — */
const ctxWalls = (() => {
  const geometry = slabGeometry(shellRing(-.02), FLOOR_COUNT * floorHeight);
  // Rewrite the side-wall UVs: u runs along the facade in world units, v up in floors.
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const alongZ = Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i));
    uv.setXY(i, (alongZ ? position.getZ(i) : position.getX(i)) / 3.2, position.getY(i) / floorHeight);
  }
  const facade = new THREE.MeshStandardMaterial({ map: facadeFloor, roughness: .85 });
  const instanced = neighbourInstances(geometry, [materials.deck, facade], { y: groundClearance });
  instanced.userData = { kind: 'wall' };
  return instanced;
})();
neighbourInstances(groundVolume, [materials.ground, materials.ground], { y: .16 });
{
  const columns = new THREE.InstancedMesh(columnGeometry, materials.column, columnMatrices.length * NEIGHBOURS.length);
  const m = new THREE.Matrix4();
  NEIGHBOURS.forEach((t, b) => columnMatrices.forEach((local, i) => columns.setMatrixAt(b * columnMatrices.length + i, m.copy(matrixOf([t.x, 0, t.z], t.yaw)).multiply(local))));
  columns.castShadow = true; columns.receiveShadow = true; columns.computeBoundingSphere();
  context.add(columns);
}
neighbourInstances(bandGeometry, materials.band, { y: roofLevel - .05 });
neighbourInstances(slabGeometry(shellRing(-wallIn), .22), [materials.deck, materials.deck], { y: roofLevel + .4 });
neighbourInstances(parapetGeometry, [materials.band, materials.band], { y: roofLevel + .5 });
neighbourInstances(roofKit, materials.roofKit);
neighbourInstances(furniture.planter, materials.planter);
neighbourInstances(furniture.soil, materials.soil, { cast: false });
neighbourInstances(furniture.trunk, materials.trunk);
neighbourInstances(furniture.crown, materials.crown);
neighbourInstances(furniture.bikes, materials.bike, { cast: false });

/* ── The site: paving, ring road, dry earth, street lamps, scrub ──────────── */

const clusterX = [0, ...NEIGHBOURS.map(t => t.x)], clusterZ = [0, ...NEIGHBOURS.map(t => t.z)];
const PLAZA = { x0: Math.min(...clusterX) - 30, x1: Math.max(...clusterX) + 30, z0: Math.min(...clusterZ) - 26, z1: Math.max(...clusterZ) + 26 };   // the cluster plus its ring road
{
  // A rounded rectangle laid flat, textured in world units (tile = metres/2 per repeat).
  const rounded = (x0, z0, x1, z1, radius, y, material, tile) => {
    const shape = new THREE.Shape();
    shape.moveTo(x0 + radius, -z0);
    shape.lineTo(x1 - radius, -z0); shape.quadraticCurveTo(x1, -z0, x1, -z0 - radius);
    shape.lineTo(x1, -z1 + radius); shape.quadraticCurveTo(x1, -z1, x1 - radius, -z1);
    shape.lineTo(x0 + radius, -z1); shape.quadraticCurveTo(x0, -z1, x0, -z1 + radius);
    shape.lineTo(x0, -z0 - radius); shape.quadraticCurveTo(x0, -z0, x0 + radius, -z0);
    const item = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10).rotateX(-Math.PI / 2), material);
    material.map.repeat.set(1 / tile, 1 / tile);
    item.position.y = y; item.receiveShadow = true;
    site.add(item);
    return item;
  };
  // Dry earth under everything, fading into the horizon.
  const fade = document.createElement('canvas');
  fade.width = fade.height = 256;
  const ctx = fade.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.62, '#fff'); gradient.addColorStop(1, '#000');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  materials.earth.alphaMap = new THREE.CanvasTexture(fade);
  materials.earth.map.repeat.set(26, 26);
  const earth = new THREE.Mesh(new THREE.CircleGeometry(190, 72).rotateX(-Math.PI / 2), materials.earth);
  earth.position.set((PLAZA.x0 + PLAZA.x1) / 2, -.04, (PLAZA.z0 + PLAZA.z1) / 2); earth.receiveShadow = true;
  site.add(earth);

  // Ring road: a darker band; the brick plaza sits inside it; stone slabs around this block.
  rounded(PLAZA.x0 - 7, PLAZA.z0 - 7, PLAZA.x1 + 7, PLAZA.z1 + 7, 22, .0, materials.road, 3.2);
  rounded(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, 16, .03, materials.brick, 3.2);
  rounded(-24, -17, 24, 17, 8, .06, materials.stone, 3.2);
}
materials.stone.polygonOffset = true; materials.stone.polygonOffsetFactor = -2;
materials.brick.polygonOffset = true; materials.brick.polygonOffsetFactor = -1;

// Street lamps on a coarse grid, wherever no block stands.
const lampSpots = (() => {
  const spots = [];
  // A block is about 28 x 15 units: keep lamps out of a circle around each centre.
  const blocked = (x, z) => [{ x: 0, z: 0 }, ...NEIGHBOURS].some(t => Math.hypot(x - t.x, z - t.z) < 16);
  for (let x = PLAZA.x0 + 6; x < PLAZA.x1; x += 15) for (let z = PLAZA.z0 + 6; z < PLAZA.z1; z += 15) {
    const jx = x + Math.sin(x * 3.1 + z) * 2.2, jz = z + Math.cos(z * 2.3 + x) * 2.2;
    if (!blocked(jx, jz)) spots.push([jx, jz]);
  }
  return spots.slice(0, 18);
})();
{
  const n = lampSpots.length;
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .06, 4.2, 6), materials.metal, n);
  const arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.03, .03, .9, 5).rotateZ(Math.PI / 2), materials.metal, n);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(.46, .07, .2), materials.lamp, n);
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(4.2, 20).rotateX(-Math.PI / 2), materials.lampPool, n);
  lampSpots.forEach(([x, z], i) => {
    const yaw = Math.sin(i * 7.7) * Math.PI;
    poles.setMatrixAt(i, matrixOf([x, 2.1, z]));
    arms.setMatrixAt(i, matrixOf([x + Math.cos(yaw) * .45, 4.15, z - Math.sin(yaw) * .45], yaw));
    heads.setMatrixAt(i, matrixOf([x + Math.cos(yaw) * .85, 4.1, z - Math.sin(yaw) * .85], yaw));
    pools.setMatrixAt(i, matrixOf([x + Math.cos(yaw) * .85, .075, z - Math.sin(yaw) * .85]));
  });
  poles.castShadow = true;
  [poles, arms, heads, pools].forEach(item => { item.computeBoundingSphere(); site.add(item); });
  pools.renderOrder = 3;
}

// Dry scrub and a few larger trees outside the ring road, as in the satellite view.
{
  const random = seeded(77);
  const bushes = [], trees = [];
  for (let i = 0; i < 260; i++) {
    const a = random() * Math.PI * 2, r = 62 + Math.pow(random(), .8) * 100;
    const x = (PLAZA.x0 + PLAZA.x1) / 2 + Math.cos(a) * r * 1.15, z = (PLAZA.z0 + PLAZA.z1) / 2 + Math.sin(a) * r * .95;
    if (x > PLAZA.x0 - 6 && x < PLAZA.x1 + 6 && z > PLAZA.z0 - 6 && z < PLAZA.z1 + 6) continue;
    (random() < .22 ? trees : bushes).push([x, z, .7 + random() * 1.1]);
  }
  const blobGeometry = new THREE.IcosahedronGeometry(1, 1);
  const shades = ['#4b5a37', '#56653c', '#3f4f30', '#6b6a42', '#5f6d3d'].map(hex => new THREE.Color(hex));
  const scrub = new THREE.InstancedMesh(blobGeometry, materials.foliage, bushes.length);
  bushes.forEach(([x, z, s], i) => { scrub.setMatrixAt(i, matrixOf([x, s * .45, z], random() * 6, [s * 1.5, s * .8, s * 1.5])); scrub.setColorAt(i, shades[i % shades.length]); });
  scrub.receiveShadow = true; scrub.computeBoundingSphere();
  const canopy = new THREE.InstancedMesh(blobGeometry, materials.foliage, trees.length * 3);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.1, .16, 1, 5), materials.trunk, trees.length);
  trees.forEach(([x, z, s], i) => {
    const h = 2.4 + s * 1.6;
    stems.setMatrixAt(i, matrixOf([x, h / 2, z], 0, [1, h, 1]));
    for (let k = 0; k < 3; k++) {
      const q = s * (1.2 - k * .2);
      canopy.setMatrixAt(i * 3 + k, matrixOf([x + (k - 1) * .5 * s, h + .3 + k * .35, z + (k % 2 ? .4 : -.4) * s], random() * 6, [q * 1.3, q * .85, q * 1.3]));
      canopy.setColorAt(i * 3 + k, shades[(i + k) % shades.length]);
    }
  });
  canopy.castShadow = true; canopy.receiveShadow = true; canopy.computeBoundingSphere();
  stems.computeBoundingSphere();
  site.add(scrub, canopy, stems);
}

/* Building identity. A sprite above the roof turns to face the camera, so
   the name is legible and complete from every orbit position. */
const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
nameSprite.renderOrder = 10;   // a label: never hidden behind the parapet
nameSprite.position.set(0, roofLevel + 3.6, 0);
nameSprite.scale.set(6.2, 1.21, 1);
roofGroup.add(nameSprite);

function makeNameTexture(name) {
  const label = document.createElement('canvas');
  label.width = 1024; label.height = 200;
  const ctx = label.getContext('2d');
  const text = name.toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 112;
  const useFont = () => { ctx.font = `800 ${size}px Manrope, Helvetica, Arial, sans-serif`; ctx.letterSpacing = `${Math.round(size * .12)}px`; };
  for (useFont(); size > 40 && ctx.measureText(text).width > 960; size -= 2) useFont();
  for (let depth = 7; depth > 0; depth--) {
    ctx.fillStyle = `rgba(28, 24, 26, ${.10 + depth * .045})`;
    ctx.fillText(text, 512 + depth * .7, 100 + depth * 1.1);
  }
  const silver = ctx.createLinearGradient(0, 100 - size * .48, 0, 100 + size * .48);
  [[0, '#ffffff'], [.3, '#dfe4e9'], [.5, '#f7f9fa'], [.68, '#98a2ac'], [.86, '#cfd6dc'], [1, '#f2f5f7']].forEach(([stop, color]) => silver.addColorStop(stop, color));
  ctx.fillStyle = silver;
  ctx.fillText(text, 512, 100);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* Room numbers and pod names, drawn on the cut model of whichever floor is
   opened, so a student can read "512" off the plan instead of counting tiles.
   Sprites face the camera; text sits on a dark pill so it reads on any status. */
const LABEL_FONT = '600 46px "DM Mono", ui-monospace, Menlo, monospace';
function labelSprite(width, height, scale) {
  const surface = document.createElement('canvas');
  surface.width = width; surface.height = height;
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(...scale, 1);
  sprite.userData = { surface, texture, text: '' };
  return sprite;
}
/* pill: a filled capsule (pod names). Otherwise outlined text, so the room's
   status colour underneath stays the thing you read. */
function paintLabel(sprite, text, { pill = null, ink = '#fff5ec', font = LABEL_FONT, force = false } = {}) {
  if (!force && sprite.userData.text === text) return;
  const { surface, texture } = sprite.userData, ctx = surface.getContext('2d');
  ctx.clearRect(0, 0, surface.width, surface.height);
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (pill) {
    ctx.fillStyle = pill;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(2, 2, surface.width - 4, surface.height - 4, surface.height / 2 - 2); else ctx.rect(2, 2, surface.width - 4, surface.height - 4);
    ctx.fill();
  } else {
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(20, 13, 15, .9)';
    ctx.strokeText(text, surface.width / 2, surface.height / 2 + 2);
  }
  ctx.fillStyle = ink;
  ctx.fillText(text, surface.width / 2, surface.height / 2 + 2);
  texture.needsUpdate = true;
  sprite.userData.text = text;
}
const labelGroup = new THREE.Group();
labelGroup.visible = false;
const roomLabels = roomCentroids.map(centre => {
  const sprite = labelSprite(192, 84, [1.25, .55]);
  sprite.position.set(centre.x, .4, centre.y);
  sprite.renderOrder = 4;
  labelGroup.add(sprite);
  return sprite;
});
const POD_LABEL = { pill: '#f05a25', ink: '#ffffff', font: '600 38px "DM Mono", ui-monospace, Menlo, monospace' };
const podLabels = POD_CENTRES.map(([x, y], index) => {
  const sprite = labelSprite(256, 84, [1.9, .62]);
  sprite.position.set(planX(x), .75, planZ(y));
  sprite.renderOrder = 5;
  paintLabel(sprite, `POD ${index + 1}`, POD_LABEL);
  labelGroup.add(sprite);
  return sprite;
});
function placeLabels() {
  if (openFloor === null) { labelGroup.visible = false; return; }
  floors[openFloor].plate.add(labelGroup);
  roomLabels.forEach((sprite, room) => paintLabel(sprite, roomIdOf(openFloor, room)));
  labelGroup.visible = true;
}

/* Selection pin: an orange marker that hangs over the chosen room, on the
   facade or, when its floor is opened, over the tile itself. */
const pin = new THREE.Group();
{
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.28, .7, 16).rotateX(Math.PI), materials.pin);
  cone.position.y = .35;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), materials.pin);
  ball.position.y = .82;
  const halo = new THREE.Mesh(new THREE.RingGeometry(.35, .6, 32).rotateX(-Math.PI / 2), materials.pinHalo);
  halo.position.y = .02;
  pin.add(cone, ball, halo);
  pin.userData.halo = halo;
  pin.scale.setScalar(1.15);
  pin.visible = false;
}

/* ── Status, hover and selection ─────────────────────────────────────────── */

let hostelName = '';
let hovered = null;    // { floor, room }
let selected = null;   // { floor, room }

function paintRoom(floor, room) {
  const level = floors[floor];
  const status = level.status[room];
  const color = STATUS_COLOR[status] || STATUS_COLOR.unlisted;
  const listed = status === 'unlisted' ? 0 : 1;
  const boost = level.boost[room];
  level.glass.setColorAt(room, color);
  level.glass.geometry.attributes.glowData.setXY(room, listed, boost);
  level.glass.instanceColor.needsUpdate = true;
  level.glass.geometry.attributes.glowData.needsUpdate = true;
  const range = roomVertexRanges[room];
  if (level.tiles && range) {
    const colors = level.tiles.geometry.attributes.color, glowData = level.tiles.geometry.attributes.glowData;
    for (let v = range[0]; v <= range[1]; v++) {
      if (vertexRoom[v] !== room) continue;
      colors.setXYZ(v, color.r, color.g, color.b);
      glowData.setXY(v, listed, boost * .6);
    }
    colors.needsUpdate = true; glowData.needsUpdate = true;
  }
}
function setBoost(target, value) {
  if (!target) return;
  floors[target.floor].boost[target.room] = value;
  paintRoom(target.floor, target.room);
}
function refreshBoosts() {
  floors.forEach(level => level.boost.fill(0));
  if (selected) floors[selected.floor].boost[selected.room] = .9;
  if (hovered && !(selected && hovered.floor === selected.floor && hovered.room === selected.room)) floors[hovered.floor].boost[hovered.room] = .55;
  floors.forEach((level, floor) => { for (let room = 0; room < ROOM_COUNT; room++) paintRoom(floor, room); });
}

function setBuilding(name, roomStatuses = {}, floorsHere = FLOOR_COUNT) {
  const renamed = name !== hostelName;
  hostelName = name;
  const nextCount = Math.max(1, Math.min(FLOOR_COUNT, Math.round(floorsHere) || FLOOR_COUNT));
  if (nextCount !== floorCount) {
    floorCount = nextCount;
    springs.forEach((spring, index) => { spring.absent = index < FLOOR_COUNT && index >= floorCount; });
    if (openFloor !== null && openFloor >= floorCount) openFloor = null;
    if (selected && selected.floor >= floorCount) selected = null;
    // The neighbours are the newer cluster, so they only make sense around those blocks.
    document.querySelectorAll('[data-context-toggle]').forEach(button => {
      button.disabled = floorCount < FLOOR_COUNT;
      button.title = floorCount < FLOOR_COUNT ? 'Surroundings are mapped for the newer ten-floor blocks only' : '';
    });
    layoutFloors();
    flyTo(pose());
    idleReadout();
  }
  floors.forEach((level, floor) => {
    for (let room = 0; room < ROOM_COUNT; room++) {
      const status = roomStatuses[roomIdOf(floor, room)];
      level.status[room] = STATUS_COLOR[status] ? status : 'unlisted';
    }
  });
  refreshBoosts();
  if (renamed) {
    nameSprite.material.map?.dispose();
    nameSprite.material.map = makeNameTexture(name);
    nameSprite.material.needsUpdate = true;
  }
  if (selected) readout.innerHTML = describe(selected); else idleReadout();
  invalidate();
}

function roomFromId(id) {
  const match = /^(\d{1,2})(\d{2})$/.exec(String(id || ''));
  if (!match) return null;
  const floor = Number(match[1]) - 1, room = Number(match[2]) - 1;
  return floor >= 0 && floor < floorCount && room >= 0 && room < ROOM_COUNT ? { floor, room } : null;
}
function describe(target) {
  const status = floors[target.floor].status[target.room];
  const id = roomIdOf(target.floor, target.room);
  return `<strong>Room ${id} · ${STATUS_LABEL[status]}</strong><span>${hostelName} · floor ${String(target.floor + 1).padStart(2, '0')} · pod ${podOfRoom[target.room]}</span>`;
}

function placePin() {
  if (!selected) { pin.visible = false; pin.parent?.remove(pin); return; }
  const level = floors[selected.floor];
  level.level.add(pin);
  pin.visible = true;
  const onPlate = level.plate.visible && roomCentroids[selected.room];
  if (onPlate) {
    const c = roomCentroids[selected.room];
    pin.position.set(c.x, floorHeight + .5, c.y);
    pin.userData.halo.visible = true;
  } else {
    const w = windowFrames[selected.room];
    pin.position.set(w.x + w.nx * .7, WIN_BOTTOM + WIN_HEIGHT + .3, w.z + w.nz * .7);
    pin.userData.halo.visible = false;
  }
  pin.userData.baseY = pin.position.y;
  pin.userData.since = performance.now();
}
function focusRoom(id) {
  const next = roomFromId(id);
  // The board refreshes every 20 s and re-opens the same room; don't re-drop the pin.
  if (next && selected && next.floor === selected.floor && next.room === selected.room) return;
  selected = next;
  refreshBoosts();
  placePin();
  if (selected) readout.innerHTML = describe(selected); else idleReadout();
  invalidate();
}

/* ── Floors: open one, or spread them all ────────────────────────────────── */

let openFloor = null;      // index, or null for all floors
let stacked = false;
/* The model is the ten-floor block type. The older hostels have six floors, so
   for those the top floors are left out and the roof sits on floor six. */
let floorCount = FLOOR_COUNT;
const FLOOR_WORDS = { 6: 'six', 10: 'ten' };
const floorsWord = () => FLOOR_WORDS[floorCount] || String(floorCount);

/* The neighbouring blocks are context. They sink away (and stop casting shadows)
   when you open a floor or spread the stack, and the Surroundings button switches
   them off for good, so nothing ever stands between you and a room. */
let contextWanted = true, contextT = 1;
const contextShown = () => contextWanted && openFloor === null && !stacked && floorCount === FLOOR_COUNT;
function stepContext(dt) {
  const target = contextShown() ? 1 : 0;
  if (Math.abs(contextT - target) < .004) {
    if (contextT !== target) { contextT = target; context.scale.y = Math.max(.001, contextT); context.visible = contextT > 0; shadowDirty = true; }
    return false;
  }
  contextT += (target - contextT) * Math.min(1, dt * 9);
  context.scale.y = Math.max(.001, contextT);
  context.visible = true;
  shadowDirty = true;
  return true;
}

// Springs on each floor's height and the roof's. Staggered so the stack lifts
// one floor after another, the way a model comes apart in a hand.
const springs = [...floors.map(level => level.group), roofGroup].map(object => ({ object, x: 0, v: 0, target: 0, delay: 0 }));

function floorOffset(index) {
  if (index === FLOOR_COUNT && floorCount < FLOOR_COUNT) return floorOffset(floorCount) - (FLOOR_COUNT - floorCount) * floorHeight;
  let offset = stacked ? index * STACK_GAP : 0;
  if (openFloor !== null && index > openFloor) offset += LIFT + (index - openFloor) * 2.2;
  return offset;
}
function layoutFloors() {
  const now = performance.now();
  springs.forEach((spring, index) => {
    const target = floorOffset(index);
    if (spring.absent) { spring.object.visible = false; return; }   // above this hostel's top floor
    if (target === spring.target) { if (spring.x === target) spring.object.visible = target < LIFT * .5; return; }
    const rising = target > spring.target;
    const order = openFloor === null ? index : Math.max(0, index - openFloor);
    spring.delay = now + (rising ? order : (springs.length - order)) * 45;
    spring.target = target;
    spring.object.visible = !spring.absent;
  });
  floors.forEach((level, index) => { level.plate.visible = stacked || index === openFloor; });
  placeLabels();
  placePin();
  if (reduceMotion.matches) springs.forEach(settleSpring);
  shadowDirty = true;
  invalidate();
}
function settleSpring(spring) {
  spring.x = spring.target; spring.v = 0; spring.delay = 0;
  spring.object.position.y = spring.x;
  spring.object.visible = !spring.absent && spring.target < LIFT * .5;
}
function stepSprings(dt, now) {
  let moving = false;
  for (const spring of springs) {
    if (spring.x === spring.target && spring.v === 0) continue;
    moving = true;
    if (now < spring.delay) continue;
    const k = 140, c = 2 * Math.sqrt(k) * .78;
    spring.v += (-(spring.x - spring.target) * k - spring.v * c) * dt;
    spring.x += spring.v * dt;
    if (Math.abs(spring.x - spring.target) < .002 && Math.abs(spring.v) < .01) settleSpring(spring);
    spring.object.position.y = spring.x;
  }
  return moving;
}

/* ── Camera ──────────────────────────────────────────────────────────────── */

const AZIMUTH = .16;   // from the open south side, looking up the corridor between the blocks either side (as in the Bhabha photograph)
let cameraTween = null;
function fitDistance() {
  // The block is about 28 x 15 units wide and 20 tall: fit its height, widen for portrait screens.
  const aspect = camera.aspect || 1.5;
  return Math.min(120, Math.max(52, 36 / (.611 * Math.min(aspect, 1.9))));
}
function pose(kind) {
  const distance = fitDistance();
  if (kind === 'intro') return { target: new THREE.Vector3(0, 9, 0), radius: distance * 1.25, phi: Math.PI * .34, theta: AZIMUTH - .95 };
  if (stacked && openFloor === null) return { target: new THREE.Vector3(0, 10 + floorCount * STACK_GAP / 2 - (FLOOR_COUNT - floorCount) * floorHeight / 2, 0), radius: distance * 1.3, phi: Math.PI * .40, theta: null };
  if (openFloor !== null) {
    const top = groundClearance + (openFloor + 1) * floorHeight + (stacked ? openFloor * STACK_GAP : 0);
    return { target: new THREE.Vector3(0, top * .8, 0), radius: distance * .78, phi: Math.PI * .27, theta: null };
  }
  return { target: new THREE.Vector3(0, 9.0 - (FLOOR_COUNT - floorCount) * floorHeight / 2, 0), radius: distance, phi: Math.PI * .385, theta: AZIMUTH };
}
function currentSpherical() {
  return new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
}
function flyTo(next, duration = 1100) {
  const from = currentSpherical();
  const to = { radius: next.radius, phi: next.phi, theta: next.theta ?? from.theta };
  let dTheta = to.theta - from.theta;
  dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
  cameraTween = { start: performance.now(), duration: reduceMotion.matches ? 0 : duration, fromTarget: controls.target.clone(), toTarget: next.target, from, to: { ...to, theta: from.theta + dTheta } };
  invalidate();
}
function stepCamera(now) {
  if (!cameraTween) return false;
  const { start, duration, fromTarget, toTarget, from, to } = cameraTween;
  const t = duration ? Math.min(1, (now - start) / duration) : 1;
  const e = 1 - Math.pow(1 - t, 3);
  controls.target.lerpVectors(fromTarget, toTarget, e);
  const s = new THREE.Spherical(from.radius + (to.radius - from.radius) * e, from.phi + (to.phi - from.phi) * e, from.theta + (to.theta - from.theta) * e);
  camera.position.setFromSpherical(s).add(controls.target);
  camera.lookAt(controls.target);
  if (t >= 1) cameraTween = null;
  return true;
}
function setPose(next) {
  controls.target.copy(next.target);
  camera.position.setFromSpherical(new THREE.Spherical(next.radius, next.phi, next.theta ?? AZIMUTH)).add(controls.target);
  camera.lookAt(controls.target);
}
controls.addEventListener('start', () => { cameraTween = null; });
// Keep panning within the site so the building can't be lost off-screen.
controls.addEventListener('change', () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -60, 50);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -50, 40);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 34);
  invalidate();
});

/* ── Moods: day, dusk, night ─────────────────────────────────────────────── */

const C = hex => new THREE.Color(hex), V = (x, y, z) => new THREE.Vector3(x, y, z);
const MOODS = {
  day: { exposure: 1.0, sky: C('#e6eef6'), ground: C('#7a6a55'), hemi: 1.9, sun: C('#fff3e2'), sunI: 3.2, sunPos: V(30, 50, 26), fill: C('#a9c1de'), fillI: .55, fillPos: V(-28, 14, -20),
    fog: C('#dfe7ee'), unlisted: 0, listed: .32, pilotis: 0, lamp: C('#7d7368'), lampGlow: 0 },
  dusk: { exposure: 1.05, sky: C('#f6c9ab'), ground: C('#4a3732'), hemi: 1.35, sun: C('#ffad73'), sunI: 2.4, sunPos: V(-42, 20, 30), fill: C('#8c78c4'), fillI: .7, fillPos: V(30, 16, -24),
    fog: C('#c9a6a6'), unlisted: .16, listed: .75, pilotis: .3, lamp: C('#ffd59a'), lampGlow: .5 },
  night: { exposure: 1.12, sky: C('#43568c'), ground: C('#1d1a24'), hemi: 1.05, sun: C('#a8bbff'), sunI: .8, sunPos: V(-24, 52, -22), fill: C('#ff9b5c'), fillI: .35, fillPos: V(20, 6, 30),
    fog: C('#232842'), unlisted: .3, listed: 1.15, pilotis: .55, lamp: C('#ffe2b0'), lampGlow: 1 },
};
const live = structuredCloneMood(MOODS.dusk);
function structuredCloneMood(mood) {
  return Object.fromEntries(Object.entries(mood).map(([key, value]) => [key, value?.clone ? value.clone() : value]));
}
let moodName = 'dusk';
let moodTween = null;
function applyMood() {
  renderer.toneMappingExposure = live.exposure;
  hemi.color.copy(live.sky); hemi.groundColor.copy(live.ground); hemi.intensity = live.hemi;
  sun.color.copy(live.sun); sun.intensity = live.sunI; sun.position.copy(live.sunPos);
  fill.color.copy(live.fill); fill.intensity = live.fillI; fill.position.copy(live.fillPos);
  scene.fog.color.copy(live.fog);
  glow.unlisted.value = live.unlisted; glow.listed.value = live.listed;
  materials.ground.emissiveIntensity = live.pilotis;
  materials.lamp.color.copy(live.lamp);
  materials.lampPool.opacity = live.lampGlow * .55;
}
function setMood(name, animate = true) {
  if (!MOODS[name]) return;
  moodName = name;
  view.dataset.mood = name;
  document.querySelectorAll('[data-mood-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.moodChoice === name)));
  try { localStorage.setItem('nivas-mood', name); } catch {}
  moodTween = { start: performance.now(), duration: animate && !reduceMotion.matches ? 900 : 0, from: structuredCloneMood(live), to: MOODS[name] };
  shadowDirty = true;
  invalidate();
}
function stepMood(now) {
  if (!moodTween) return false;
  const { start, duration, from, to } = moodTween;
  const t = duration ? Math.min(1, (now - start) / duration) : 1;
  const e = t * t * (3 - 2 * t);
  for (const key of Object.keys(to)) {
    if (typeof to[key] === 'number') live[key] = from[key] + (to[key] - from[key]) * e;
    else if (to[key].isColor) live[key].lerpColors(from[key], to[key], e);
    else live[key].lerpVectors(from[key], to[key], e);
  }
  applyMood();
  shadowDirty = true;
  if (t >= 1) moodTween = null;
  return true;
}
function defaultMood() {
  // Dusk is the architect's own render: warm, and every status colour still reads.
  try { const saved = localStorage.getItem('nivas-mood'); if (MOODS[saved]) return saved; } catch {}
  return 'dusk';
}

/* ── Render loop: only when something changes ────────────────────────────── */

let needsRender = true, shadowDirty = true, frameId = 0, inFrame = false, onScreen = true, lastTime = 0, firstFrame = true;
function schedule() {
  // inFrame: OrbitControls fires "change" from inside controls.update(); that
  // must only mark the frame dirty, never queue a second callback.
  if (frameId || inFrame || !onScreen || document.hidden) return;
  lastTime = performance.now();
  frameId = requestAnimationFrame(frame);
}
function invalidate() { needsRender = true; schedule(); }
function frame(now) {
  frameId = 0;
  inFrame = true;
  const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  let active = false;
  if (stepCamera(now)) active = true;
  if (stepSprings(dt, now)) { active = true; shadowDirty = true; }
  if (stepMood(now)) active = true;
  if (stepContext(dt)) active = true;
  if (pin.visible) {
    const age = (now - pin.userData.since) / 1000;
    if (age < 4 && !reduceMotion.matches) {
      pin.position.y = pin.userData.baseY + Math.abs(Math.sin(age * 3.2)) * .35 * Math.exp(-age * .9);
      pin.userData.halo.scale.setScalar(1 + (age * 1.2) % 1);
      materials.pinHalo.opacity = .45 * (1 - (age * 1.2) % 1);
      active = true;
    } else {
      pin.position.y = pin.userData.baseY;
      pin.userData.halo.scale.setScalar(1.2);
      materials.pinHalo.opacity = .3;
    }
  }
  if (controls.update()) active = true;
  if (active || needsRender) {
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);
    needsRender = false;
    if (firstFrame) {
      firstFrame = false;
      view.classList.remove('is-loading');
    }
  }
  inFrame = false;
  if (active) { lastTime = now; frameId = requestAnimationFrame(frame); }
}

// Phones fire "resize" every time the address bar slides while scrolling. Resizing
// the canvas clears it, so doing that for an unchanged size flashed a blank frame;
// skip it, and when the size really changes draw at once instead of next frame.
let sizedW = 0, sizedH = 0;
function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.round(width), h = Math.round(height);
  if (!w || !h || (w === sizedW && h === sizedH)) return;
  sizedW = w; sizedH = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (!firstFrame) renderer.render(scene, camera);
  invalidate();
}
window.addEventListener('resize', resize);
// A phone can drop the GL context while the tab is in the background. three.js
// rebuilds its state; we only have to ask for a fresh frame.
canvas.addEventListener('webglcontextrestored', () => { shadowDirty = true; invalidate(); });
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) invalidate(); }).observe(canvas);
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });

/* ── Pointer ─────────────────────────────────────────────────────────────── */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function visibleChain(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
function pick(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  // The solid wall of every visible floor is in the ray test too: without it a
  // click on bare facade would reach through the building to a window behind.
  const targets = [];
  floors.forEach(level => {
    if (!visibleChain(level.glass)) return;
    targets.push(level.glass, level.wall);
    if (level.tiles && visibleChain(level.tiles)) targets.push(level.tiles);
  });
  if (visibleChain(ctxWalls)) targets.push(ctxWalls);
  for (const hit of raycaster.intersectObjects(targets, false)) {
    const { kind, floor } = hit.object.userData;
    if (kind === 'wall') return null;
    if (kind === 'glass' && windowFrames[hit.instanceId]) return { floor, room: hit.instanceId };
    if (kind === 'tile') {
      const room = vertexRoom[hit.face.a];
      if (room >= 0) return { floor, room };
      return null;
    }
  }
  return null;
}
let downAt = null, hoverQueued = false, lastMove = null;
canvas.addEventListener('pointerdown', event => { downAt = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', event => {
  if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) { downAt = null; return; }
  downAt = null;
  const target = pick(event);
  if (!target) return;
  const id = roomIdOf(target.floor, target.room);
  focusRoom(id);
  window.dispatchEvent(new CustomEvent('nivas:room-click', { detail: { id } }));
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  lastMove = event;
  if (hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => {
    hoverQueued = false;
    if (event.buttons) return;
    const target = pick(lastMove);
    const same = (a, b) => a && b && a.floor === b.floor && a.room === b.room;
    if (same(target, hovered) || (!target && !hovered)) return;
    hovered = target;
    canvas.style.cursor = target ? 'pointer' : 'grab';
    refreshBoosts();
    if (target) readout.innerHTML = describe(target);
    else if (selected) readout.innerHTML = describe(selected);
    else idleReadout();
    invalidate();
  });
});
canvas.addEventListener('pointerleave', () => {
  if (!hovered) return;
  hovered = null;
  refreshBoosts();
  if (selected) readout.innerHTML = describe(selected); else idleReadout();
  invalidate();
});

function idleReadout() {
  if (!readout || selected) return;
  if (openFloor !== null) readout.innerHTML = `<strong>Floor ${String(openFloor + 1).padStart(2, '0')} opened up</strong><span>The floors above lift away · tap a room</span>`;
  else if (stacked) readout.innerHTML = `<strong>All ${floorsWord()} floors, spread apart</strong><span>Every level’s rooms at once · tap any room</span>`;
  else readout.innerHTML = `<strong>${hostelName || 'Hostel'} · all ${floorsWord()} floors</strong><span>Drag to orbit · scroll or pinch to zoom · tap a window</span>`;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

function setFloor(value) {
  const next = value === 'all' || value === null || value === undefined ? null : Number(value);
  if (next === openFloor) return;
  openFloor = next;
  layoutFloors();
  flyTo(pose());
  idleReadout();
}
function setStack(value) {
  stacked = Boolean(value);
  document.querySelectorAll('[data-stack-toggle]').forEach(button => button.setAttribute('aria-pressed', String(stacked)));
  layoutFloors();
  flyTo(pose());
  idleReadout();
}
function setContext(value) {
  contextWanted = Boolean(value);
  document.querySelectorAll('[data-context-toggle]').forEach(button => button.setAttribute('aria-pressed', String(contextWanted)));
  try { localStorage.setItem('nivas-context', contextWanted ? 'on' : 'off'); } catch {}
  invalidate();
}
function resetView() { flyTo(pose()); }
function zoomIn() { flyTo({ ...poseFromCurrent(), radius: Math.max(controls.minDistance, currentSpherical().radius * .82) }, 500); }
function zoomOut() { flyTo({ ...poseFromCurrent(), radius: Math.min(controls.maxDistance, currentSpherical().radius * 1.22) }, 500); }
function poseFromCurrent() { const s = currentSpherical(); return { target: controls.target.clone(), radius: s.radius, phi: s.phi, theta: s.theta }; }

document.querySelectorAll('[data-mood-choice]').forEach(button => button.addEventListener('click', () => setMood(button.dataset.moodChoice)));
document.querySelectorAll('[data-stack-toggle]').forEach(button => button.addEventListener('click', () => setStack(!stacked)));
document.querySelectorAll('[data-context-toggle]').forEach(button => button.addEventListener('click', () => setContext(!contextWanted)));
try { if (localStorage.getItem('nivas-context') === 'off') setContext(false); } catch {}
document.getElementById('view-reset')?.addEventListener('click', resetView);

window.addEventListener('nivas:building-change', event => {
  const detail = event.detail;
  if (detail?.name) setBuilding(detail.name, detail.roomStatuses || {}, detail.floors);
});
window.addEventListener('nivas:room-focus', event => focusRoom(event.detail?.id || null));
// Canvas text is drawn once, so redraw it when the web fonts arrive.
document.fonts?.ready.then(() => {
  if (hostelName) { nameSprite.material.map?.dispose(); nameSprite.material.map = makeNameTexture(hostelName); nameSprite.material.needsUpdate = true; }
  podLabels.forEach((sprite, index) => paintLabel(sprite, `POD ${index + 1}`, { ...POD_LABEL, force: true }));
  roomLabels.forEach(sprite => { sprite.userData.text = ''; });
  placeLabels();
  invalidate();
});

/* ── Start ───────────────────────────────────────────────────────────────── */

resize();
setMood(defaultMood(), false);
stepMood(performance.now());
if (reduceMotion.matches) setPose(pose());
else { setPose(pose('intro')); flyTo(pose(), 2400); }
invalidate();
window.nivasViewer = {
  resize, setFloor, setStack, setMood, setContext, focusRoom, resetView, zoomIn, zoomOut,
  get mood() { return moodName; },
  get stats() { const { calls, triangles } = renderer.info.render; return { calls, triangles }; },
};
window.dispatchEvent(new Event('nivas:viewer-ready'));
