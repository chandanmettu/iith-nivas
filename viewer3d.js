import * as THREE from './vendor/three-r185/three.module.min.js';
import { OrbitControls } from './vendor/three-r185/OrbitControls.js';
import { PLAN_ORIGIN, OUTLINE, ROOM_FACADE, VOID_FACADE } from './plan-geometry.js?v=2';

/* ============================================================================
   NIVAS 3D — v2

   One hostel block, built from the traced floor plan (plan-geometry.js) and
   dressed to match the architect's render in assets/iith-hostel-facade.png:
   white slab ribbons at every floor, terracotta louvres over deep balconies,
   glazed room windows, an open pilotis ground floor on columns, and the
   floating roof canopy with its lit soffit.

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
scene.fog = new THREE.Fog('#c9a9a6', 90, 260);
const camera = new THREE.PerspectiveCamera(34, 1, .5, 700);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .085;
controls.minDistance = 14;
controls.maxDistance = 130;
controls.maxPolarAngle = Math.PI * .475;
controls.zoomSpeed = .8;
controls.rotateSpeed = .7;

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight();
sun.castShadow = true;
sun.shadow.mapSize.setScalar(compact ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 });
sun.shadow.bias = -.0005;
sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight();
scene.add(fill);

/* ── Dimensions (one world unit is about 2 m) ─────────────────────────────── */

const FLOOR_COUNT = 10;
const PLAN_SCALE = .0254;        // one plan pixel is about 5 cm
const floorHeight = 1.6;         // ~3.2 m
const groundClearance = 2.0;     // the tall open pilotis level
const bandHeight = .47;          // white slab ribbon at each floor line
const bandOut = .10;             // how far that ribbon oversails the wall
const wallIn = .16;              // room wall, set back behind the ribbon
const balconyIn = .78;           // balcony wall, set much deeper behind the louvres
const louvreBase = .42;          // fins start where the ribbon stops
const finHeight = floorHeight - louvreBase - .04;
const roofLevel = groundClearance + floorHeight * FLOOR_COUNT;
const canopyY = roofLevel + 2.35;
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
  band: new THREE.MeshStandardMaterial({ color: '#f1ece3', roughness: .55 }),
  fins: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .72 }),
  frame: new THREE.MeshStandardMaterial({ color: '#2d2624', roughness: .5, metalness: .35 }),
  sill: new THREE.MeshStandardMaterial({ color: '#ece6dc', roughness: .6 }),
  glass: withGlow(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .22, metalness: .15 }), true),
  tile: withGlow(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .7 }), false),
  partition: new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: .8 }),
  ground: new THREE.MeshStandardMaterial({ color: '#c79b6c', emissive: '#ffb066', emissiveIntensity: 0, roughness: .9 }),
  column: new THREE.MeshStandardMaterial({ color: '#f0ebe2', roughness: .7 }),
  paving: new THREE.MeshStandardMaterial({ color: '#d8cfc3', roughness: .95 }),
  path: new THREE.MeshStandardMaterial({ color: '#e7e1d7', roughness: .9 }),
  lawn: new THREE.MeshStandardMaterial({ color: '#6c8a52', roughness: 1, transparent: true }),
  canopy: new THREE.MeshStandardMaterial({ color: '#f4f0e8', roughness: .55 }),
  soffit: new THREE.MeshStandardMaterial({ color: '#f1e9dc', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: .8 }),
  deck: new THREE.MeshStandardMaterial({ color: '#cfc6b8', emissive: '#ffb969', emissiveIntensity: 0, roughness: .95 }),
  metal: new THREE.MeshStandardMaterial({ color: '#4a3a36', roughness: .55, metalness: .45 }),
  planter: new THREE.MeshStandardMaterial({ color: '#b9ad9c', roughness: .92 }),
  soil: new THREE.MeshStandardMaterial({ color: '#5e4937', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: 1 }),
  crown: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
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
/* A flat ring, facing DOWN, for the canopy's lit underside. Where the inner
   outline folds back on a tight curve the triangulator emits a few flipped
   slivers; they showed up as stray specks in the sky. Only triangles that agree
   with the ring's winding are kept (and flipped to face down). */
function ringFlat(outer, inner) {
  const shape = shapeOf(outer);
  shape.holes.push(new THREE.Path(inner.slice().reverse().map(point => new THREE.Vector2(point.x, -point.y))));
  const source = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).toNonIndexed();
  const position = source.attributes.position, kept = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    const facing = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);   // y of (b-a)x(c-a)
    if (facing < -1e-6) kept.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);   // reversed: faces down
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  geometry.computeVertexNormals();
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
  const room = new THREE.Color('#9c3d2b'), deep = new THREE.Color('#3a1a16'), tone = new THREE.Color();
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
  // Real fins sit roughly 0.3 m apart: sample the ring at twice its stored
  // resolution, skip anything a room fronts onto, vary each fin's tone a touch
  // so the screen reads as fired terracotta, not a printed stripe.
  const random = seeded(7);
  const base = new THREE.Color('#c4573a');
  const parts = [];
  for (let index = 0; index < RING; index++) {
    if (!isBalcony[index] || !isBalcony[(index + 1) % RING]) continue;
    for (const step of [0, .5]) {
      const next = (index + 1) % RING;
      const x = ring[index].x + (ring[next].x - ring[index].x) * step;
      const z = ring[index].y + (ring[next].y - ring[index].y) * step;
      const normal = normals[index];
      const tone = base.clone().offsetHSL((random() - .5) * .02, (random() - .5) * .06, (random() - .5) * .07);
      parts.push({
        geometry: SLIM_BOX,
        matrix: matrixOf([x + normal.x * (-wallIn + .1), louvreBase + finHeight / 2, z + normal.y * (-wallIn + .1)], headings[index], [.055, finHeight, .3]),
        color: tone,
      });
    }
  }
  return bake(parts, true);
})();

/* Each room's window: glass (instanced, carries the status), and a frame of
   head, sill, jambs, two mullions and a transom, baked into one geometry that
   every floor shares. */
const WIN_BOTTOM = louvreBase + .07, WIN_HEIGHT = .98;
const windowFrames = roomFrames.map(frame => frame && {
  ...frame,
  width: Math.max(.6, frame.length - .18),
  matrixAt(local, scale, depth) {
    const world = new THREE.Matrix4().makeTranslation(frame.x + frame.nx * (-wallIn + depth), 0, frame.z + frame.nz * (-wallIn + depth));
    world.multiply(new THREE.Matrix4().makeRotationY(frame.angle));
    world.multiply(new THREE.Matrix4().compose(_v.set(...local), _q.identity(), _s.set(...scale)));
    return world;
  },
});
const frameGeometry = (() => {
  const parts = [], sills = [];
  windowFrames.forEach(w => {
    if (!w) return;
    const mid = WIN_BOTTOM + WIN_HEIGHT / 2, half = w.width / 2;
    parts.push({ geometry: SLIM_BOX, matrix: w.matrixAt([0, WIN_BOTTOM + WIN_HEIGHT + .03, 0], [w.width + .08, .06, .1], .05) });
    [-half - .01, half + .01].forEach(x => parts.push({ geometry: SLIM_BOX, matrix: w.matrixAt([x, mid, 0], [.06, WIN_HEIGHT + .06, .1], .05) }));
    [-w.width / 6, w.width / 6].forEach(x => parts.push({ geometry: SLIM_BOX, matrix: w.matrixAt([x, mid, 0], [.035, WIN_HEIGHT, .07], .05) }));
    parts.push({ geometry: SLIM_BOX, matrix: w.matrixAt([0, WIN_BOTTOM + WIN_HEIGHT * .68, 0], [w.width, .035, .07], .05) });
    sills.push({ geometry: SLIM_BOX, matrix: w.matrixAt([0, WIN_BOTTOM - .035, 0], [w.width + .16, .07, .2], .08) });
  });
  return { frames: bake(parts), sills: bake(sills) };
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

/* Open pilotis ground level: a set-back tan volume behind a white colonnade,
   with downlights under the first slab, the way the render shows it. */
mesh(slabGeometry(shellRing(-1.0), groundClearance - .18), [materials.ground, materials.ground], groundGroup, { y: .16 });
{
  const columnSpots = [];
  for (let index = 0; index < RING; index += 9) columnSpots.push(index);
  const columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .14, groundClearance - .1, 12), materials.column, columnSpots.length);
  const lamps = new THREE.InstancedMesh(new THREE.CircleGeometry(.13, 12).rotateX(Math.PI / 2), materials.lamp, columnSpots.length);
  columnSpots.forEach((index, i) => {
    const p = ring[index], n = normals[index];
    columns.setMatrixAt(i, matrixOf([p.x - n.x * .3, (groundClearance - .1) / 2 + .14, p.y - n.y * .3]));
    const q = ring[(index + 4) % RING], m = normals[(index + 4) % RING];
    lamps.setMatrixAt(i, matrixOf([q.x - m.x * .55, groundClearance - .06, q.y - m.y * .55]));
  });
  columns.castShadow = true; columns.receiveShadow = true;
  groundGroup.add(columns, lamps);
}

// Plinth, lawn that fades into the sky, and a lit walk past the block.
mesh(slabGeometry(shellRing(2.4), .14), [materials.paving, materials.paving], groundGroup, { cast: false, y: .02 });
{
  const fade = document.createElement('canvas');
  fade.width = fade.height = 256;
  const ctx = fade.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.55, '#fff'); gradient.addColorStop(1, '#000');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  materials.lawn.alphaMap = new THREE.CanvasTexture(fade);
  const lawn = mesh(new THREE.CircleGeometry(95, 72).rotateX(-Math.PI / 2), materials.lawn, groundGroup, { cast: false });
  lawn.renderOrder = -1;
}
const pathCurve = new THREE.CatmullRomCurve3([[-50, 0, 19], [-28, 0, 16.5], [-10, 0, 19.5], [9, 0, 16], [30, 0, 18.5], [50, 0, 16]].map(p => new THREE.Vector3(...p)));
{
  const samples = 140, half = .85, position = [], normal = [], index = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, p = pathCurve.getPointAt(t), tangent = pathCurve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    position.push(p.x + side.x * half, .05, p.z + side.z * half, p.x - side.x * half, .05, p.z - side.z * half);
    normal.push(0, 1, 0, 0, 1, 0);
    if (i < samples) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  mesh(geometry, materials.path, groundGroup, { cast: false });

  // Bollards every ~4 m along the walk's north edge.
  const spots = [];
  for (let t = .08; t <= .92; t += .036) spots.push(t);   // the walk ends inside the opaque part of the lawn
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .08, .62, 8), materials.metal, spots.length);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(.075, .075, .1, 8), materials.lamp, spots.length);
  spots.forEach((t, i) => {
    const p = pathCurve.getPointAt(t), tangent = pathCurve.getTangentAt(t);
    const x = p.x + tangent.z * 1.25, z = p.z - tangent.x * 1.25;
    posts.setMatrixAt(i, matrixOf([x, .31, z]));
    caps.setMatrixAt(i, matrixOf([x, .55, z]));
  });
  posts.castShadow = true;
  groundGroup.add(posts, caps);
}

// Trees, instanced: trunk plus a three-blob crown of low-poly foliage.
{
  const random = seeded(23);
  const candidates = [[-30, 7], [-27, -6], [-22, -15], [-31, -18], [27, -9], [31, 6], [33, 17], [-9, -16.5], [6, -17], [17, -18],
    [-36, 1], [37, -2], [-18, 13.5], [-26, 23], [44, 12], [-44, -10], [-14, -24], [9, -26], [30, -22], [-40, 14], [40, -14]];
  const outer = offsetRing(3.2);
  const spots = candidates.filter(([x, z]) => !insidePolygon(outer, x, z));
  const crownGeometry = (() => {
    const blob = new THREE.IcosahedronGeometry(1, 1);
    return bake([[0, 0, 0, 1], [.55, -.25, .3, .72], [-.5, -.18, -.35, .78], [.1, .35, -.2, .66]].map(([x, y, z, s]) => ({ geometry: blob, matrix: matrixOf([x, y, z], 0, [s, s * .9, s]) })));
  })();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .17, 1, 7), materials.trunk, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, materials.crown, spots.length);
  const greens = ['#4f6b45', '#5c7a4c', '#46613f', '#6a8450'].map(hex => new THREE.Color(hex));
  spots.forEach(([x, z], i) => {
    const scale = 1.25 + random() * .9, trunk = 1.8 + random() * 1.2;
    trunks.setMatrixAt(i, matrixOf([x, trunk / 2, z], 0, [1, trunk, 1]));
    crowns.setMatrixAt(i, matrixOf([x, trunk + scale * .7, z], random() * Math.PI * 2, [scale, scale, scale]));
    crowns.setColorAt(i, greens[i % greens.length]);
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  groundGroup.add(trunks, crowns);
}

// Bicycle courts and planter seats in the concave courts, baked to two draw calls.
{
  const metal = [], planter = [], soil = [];
  const wheel = new THREE.TorusGeometry(.28, .03, 4, 12), bar = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const rod = (list, a, b, radius, base) => {
    const start = a.clone().applyMatrix4(base), end = b.clone().applyMatrix4(base);
    const direction = end.clone().sub(start), length = direction.length();
    const matrix = new THREE.Matrix4().compose(start.clone().add(end).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), new THREE.Vector3(radius, length, radius));
    list.push({ geometry: bar, matrix });
  };
  const bicycle = (x, z, angle, y) => {
    const base = matrixOf([x, y, z], angle);
    [-.35, .35].forEach(offset => metal.push({ geometry: wheel, matrix: base.clone().multiply(matrixOf([offset, .28, 0])) }));
    const V = (a, b, c) => new THREE.Vector3(a, b, c);
    rod(metal, V(-.35, .28, 0), V(0, .64, 0), .03, base); rod(metal, V(0, .64, 0), V(.35, .28, 0), .03, base);
    rod(metal, V(-.35, .28, 0), V(.35, .28, 0), .03, base); rod(metal, V(0, .64, 0), V(.1, .85, 0), .03, base);
    rod(metal, V(-.33, .85, 0), V(.02, .85, 0), .026, base);
  };
  const court = (px, py, angle) => {
    const x = planX(px), z = planZ(py);
    planter.push({ geometry: UNIT_BOX, matrix: matrixOf([x, .24, z], 0, [4.2, .16, 1.9]) });
    const base = new THREE.Matrix4();
    const V = (a, b, c) => new THREE.Vector3(a, b, c);
    rod(metal, V(x - 1.9, .32, z - .75), V(x - 1.9, .95, z - .75), .026, base);
    rod(metal, V(x - 1.9, .95, z - .75), V(x + 1.9, .95, z - .75), .026, base);
    rod(metal, V(x + 1.9, .95, z - .75), V(x + 1.9, .32, z - .75), .026, base);
    for (let i = 0; i < 7; i++) bicycle(x - 1.6 + i * .54, z + .2 + (i % 2) * .42, angle, .32);
  };
  const seat = (px, py) => {
    const x = planX(px), z = planZ(py);
    planter.push({ geometry: new THREE.CylinderGeometry(1.05, 1.05, .46, 24), matrix: matrixOf([x, .39, z]) });
    soil.push({ geometry: new THREE.CylinderGeometry(.92, .92, .08, 20), matrix: matrixOf([x, .64, z]) });
  };
  court(980, 720, .12); court(1140, 720, -.1); court(640, 300, .1); court(800, 300, -.12); court(560, 990, 0); court(1300, 990, 0);
  [[1058, 640], [720, 400], [300, 640], [1620, 360]].forEach(([x, y]) => seat(x, y));
  mesh(bake(metal), materials.metal, groundGroup, { cast: false });
  mesh(bake(planter), materials.planter, groundGroup);
  mesh(bake(soil), materials.soil, groundGroup, { cast: false });
}

/* Roof: the last ribbon, a deck, stair and lift heads on the four pod
   centres, and the floating canopy on slim posts with its lit soffit. */
mesh(bandGeometry, materials.band, roofGroup, { y: roofLevel - .05 });
mesh(slabGeometry(shellRing(-wallIn), .3), [materials.deck, materials.deck], roofGroup, { y: roofLevel + .38 });
mesh(slabGeometry(shellRing(.02), .34, shellRing(-.3)), [materials.band, materials.band], roofGroup, { y: roofLevel + .42 });
[[346.5, 337.5], [702, 692.5], [1058, 337.5], [1414.5, 692.5]].forEach(([x, y]) => {
  const head = mesh(new THREE.BoxGeometry(2.4, 1.1, 2.0), materials.canopy, roofGroup, { y: roofLevel + 1.22 });
  head.position.x = planX(x); head.position.z = planZ(y);
});
{
  const outer = shellRing(.42), inner = shellRing(-.85);
  mesh(slabGeometry(outer, .24, inner), [materials.canopy, materials.canopy], roofGroup, { y: canopyY });
  mesh(ringFlat(outer, inner), materials.soffit, roofGroup, { y: canopyY - .004, cast: false });
  const spots = [];
  for (let index = 3; index < RING; index += 11) spots.push(index);
  const height = canopyY - (roofLevel + .76);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.055, .055, height, 8), materials.column, spots.length);
  spots.forEach((index, i) => {
    const p = ring[index], n = normals[index];
    posts.setMatrixAt(i, matrixOf([p.x - n.x * .2, roofLevel + .76 + height / 2, p.y - n.y * .2]));
  });
  posts.castShadow = true;
  roofGroup.add(posts);
}

/* Building identity. A sprite above the canopy turns to face the camera, so
   the name is legible and complete from every orbit position. */
const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
nameSprite.renderOrder = 10;   // a label: never hidden behind the canopy
nameSprite.position.set(0, canopyY + 2.9, 0);
nameSprite.scale.set(7.2, 1.41, 1);
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
  const sprite = labelSprite(192, 84, [1.75, .77]);
  sprite.position.set(centre.x, .55, centre.y);
  sprite.renderOrder = 4;
  labelGroup.add(sprite);
  return sprite;
});
const POD_CENTRES = [[346.5, 337.5], [702, 692.5], [1058, 337.5], [1414.5, 692.5]];
const POD_LABEL = { pill: '#f05a25', ink: '#ffffff', font: '600 38px "DM Mono", ui-monospace, Menlo, monospace' };
const podLabels = POD_CENTRES.map(([x, y], index) => {
  const sprite = labelSprite(256, 84, [2.7, .88]);
  sprite.position.set(planX(x), 1.0, planZ(y));
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
  pin.scale.setScalar(1.6);
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

function setBuilding(name, roomStatuses = {}) {
  const renamed = name !== hostelName;
  hostelName = name;
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
  return floor >= 0 && floor < FLOOR_COUNT && room >= 0 && room < ROOM_COUNT ? { floor, room } : null;
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
    pin.position.set(w.x + w.nx * 1.0, WIN_BOTTOM + WIN_HEIGHT + .35, w.z + w.nz * 1.0);
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

// Springs on each floor's height and the roof's. Staggered so the stack lifts
// one floor after another, the way a model comes apart in a hand.
const springs = [...floors.map(level => level.group), roofGroup].map(object => ({ object, x: 0, v: 0, target: 0, delay: 0 }));

function floorOffset(index) {
  let offset = stacked ? index * STACK_GAP : 0;
  if (openFloor !== null && index > openFloor) offset += LIFT + (index - openFloor) * 2.2;
  return offset;
}
function layoutFloors() {
  const now = performance.now();
  springs.forEach((spring, index) => {
    const target = floorOffset(index);
    if (target === spring.target) return;
    const rising = target > spring.target;
    const order = openFloor === null ? index : Math.max(0, index - openFloor);
    spring.delay = now + (rising ? order : (springs.length - order)) * 45;
    spring.target = target;
    spring.object.visible = true;
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
  spring.object.visible = spring.target < LIFT * .5;
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

const AZIMUTH = Math.atan2(29, 39);
let cameraTween = null;
function fitDistance() {
  const aspect = camera.aspect || 1.5;
  return Math.min(118, Math.max(56, 74 / Math.pow(Math.min(aspect, 1.9), .55)));
}
function pose(kind) {
  const distance = fitDistance();
  if (kind === 'intro') return { target: new THREE.Vector3(0, 9, 0), radius: distance * 1.35, phi: Math.PI * .34, theta: AZIMUTH - .95 };
  if (stacked && openFloor === null) return { target: new THREE.Vector3(0, 10 + FLOOR_COUNT * STACK_GAP / 2, 0), radius: distance * 1.42, phi: Math.PI * .40, theta: null };
  if (openFloor !== null) {
    const top = groundClearance + (openFloor + 1) * floorHeight + (stacked ? openFloor * STACK_GAP : 0);
    return { target: new THREE.Vector3(0, top * .8, 0), radius: distance * .92, phi: Math.PI * .27, theta: null };
  }
  return { target: new THREE.Vector3(0, 9.0, 0), radius: distance * 1.08, phi: Math.PI * .41, theta: AZIMUTH };
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
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -30, 30);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -24, 24);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 34);
  invalidate();
});

/* ── Moods: day, dusk, night ─────────────────────────────────────────────── */

const C = hex => new THREE.Color(hex), V = (x, y, z) => new THREE.Vector3(x, y, z);
const MOODS = {
  day: { exposure: 1.0, sky: C('#e6eef6'), ground: C('#6b5a4c'), hemi: 1.9, sun: C('#fff3e2'), sunI: 3.2, sunPos: V(30, 50, 26), fill: C('#a9c1de'), fillI: .55, fillPos: V(-28, 14, -20),
    fog: C('#dfe7ee'), unlisted: 0, listed: .32, soffit: 0, deck: 0, pilotis: 0, lamp: C('#7d7368'), lawn: C('#7b9a5c') },
  dusk: { exposure: 1.05, sky: C('#f6c9ab'), ground: C('#3c2b2c'), hemi: 1.35, sun: C('#ffad73'), sunI: 2.4, sunPos: V(-42, 20, 30), fill: C('#8c78c4'), fillI: .7, fillPos: V(30, 16, -24),
    fog: C('#c9a6a6'), unlisted: .16, listed: .75, soffit: 1.25, deck: .25, pilotis: .32, lamp: C('#ffd59a'), lawn: C('#5b7449') },
  night: { exposure: 1.12, sky: C('#43568c'), ground: C('#141019'), hemi: 1.0, sun: C('#a8bbff'), sunI: .75, sunPos: V(-24, 52, -22), fill: C('#ff9b5c'), fillI: .35, fillPos: V(20, 6, 30),
    fog: C('#232842'), unlisted: .3, listed: 1.15, soffit: 2.4, deck: .55, pilotis: .62, lamp: C('#ffe2b0'), lawn: C('#4b6347') },
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
  materials.soffit.emissiveIntensity = live.soffit;
  materials.deck.emissiveIntensity = live.deck;
  materials.ground.emissiveIntensity = live.pilotis;
  materials.lamp.color.copy(live.lamp);
  materials.lawn.color.copy(live.lawn);
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

function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  invalidate();
}
window.addEventListener('resize', resize);
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
  else if (stacked) readout.innerHTML = '<strong>All ten floors, spread apart</strong><span>Every level’s rooms at once · tap any room</span>';
  else readout.innerHTML = `<strong>${hostelName || 'Hostel'} · all ten floors</strong><span>Drag to orbit · scroll or pinch to zoom · tap a window</span>`;
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
function resetView() { flyTo(pose()); }
function zoomIn() { flyTo({ ...poseFromCurrent(), radius: Math.max(controls.minDistance, currentSpherical().radius * .82) }, 500); }
function zoomOut() { flyTo({ ...poseFromCurrent(), radius: Math.min(controls.maxDistance, currentSpherical().radius * 1.22) }, 500); }
function poseFromCurrent() { const s = currentSpherical(); return { target: controls.target.clone(), radius: s.radius, phi: s.phi, theta: s.theta }; }

document.querySelectorAll('[data-mood-choice]').forEach(button => button.addEventListener('click', () => setMood(button.dataset.moodChoice)));
document.querySelectorAll('[data-stack-toggle]').forEach(button => button.addEventListener('click', () => setStack(!stacked)));
document.getElementById('view-reset')?.addEventListener('click', resetView);

window.addEventListener('nivas:building-change', event => {
  const detail = event.detail;
  if (detail?.name) setBuilding(detail.name, detail.roomStatuses || {});
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
  resize, setFloor, setStack, setMood, focusRoom, resetView, zoomIn, zoomOut,
  get mood() { return moodName; },
  get stats() { const { calls, triangles } = renderer.info.render; return { calls, triangles }; },
};
window.dispatchEvent(new Event('nivas:viewer-ready'));
