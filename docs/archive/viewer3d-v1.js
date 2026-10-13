import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { PLAN_ORIGIN, OUTLINE, ROOM_FACADE, VOID_FACADE } from './plan-geometry.js?v=2';

const canvas = document.getElementById('hostel-3d-canvas');
const readout = document.getElementById('three-readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#24181b');
scene.fog = new THREE.Fog('#24181b', 52, 190);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
const DEFAULT_CAMERA = { position: [29, 22, 39], target: [0, 7.6, 0] };
camera.position.set(...DEFAULT_CAMERA.position);
const controls = new OrbitControls(camera, canvas);
controls.target.set(...DEFAULT_CAMERA.target);
controls.enableDamping = true;
controls.minDistance = 16;
controls.maxDistance = 105;
controls.maxPolarAngle = Math.PI * .48;

scene.add(new THREE.HemisphereLight('#ffe5cf', '#332c2d', 2.2));
const sun = new THREE.DirectionalLight('#ffe2bd', 3.1);
sun.position.set(24, 42, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.far = 110;
scene.add(sun);
const fill = new THREE.DirectionalLight('#e45334', 1.05); fill.position.set(-24, 10, -16); scene.add(fill);

const FLOOR_COUNT = 10;
/* One plan pixel is about 5 cm, one world unit about 2 m, so the block comes out
   ~75 m x 39 m — the real proportions, long and low, not the tower the old
   hand-placed massing implied. */
const PLAN_SCALE = .0254;
const floorHeight = 1.6;         // ~3.2 m
const groundClearance = 2.0;     // the tall open pilotis level in the photographs
const bandHeight = .47;          // white parapet ribbon at each floor line
const bandOut = .10;             // how far that ribbon oversails the wall
const wallIn = .16;              // the red wall is set back behind the ribbon
const louvreBase = .42;          // fins start where the ribbon stops
const residentialHeight = floorHeight * FLOOR_COUNT;
const roofLevel = groundClearance + residentialHeight;

const materials = {
  wall: new THREE.MeshStandardMaterial({ color: '#a8402c', roughness: .82, metalness: .01 }),
  band: new THREE.MeshStandardMaterial({ color: '#f2ebdf', roughness: .66 }),
  louvre: new THREE.MeshStandardMaterial({ color: '#d1573a', roughness: .7, metalness: .03 }),
  soffit: new THREE.MeshStandardMaterial({ color: '#e9e1d4', roughness: .88 }),
  column: new THREE.MeshStandardMaterial({ color: '#eee5d9', roughness: .8 }),
  reveal: new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: .55, metalness: .1 }),
  paving: new THREE.MeshStandardMaterial({ color: '#cab9a9', roughness: .96 }),
  planter: new THREE.MeshStandardMaterial({ color: '#b7aa98', roughness: .92 }),
  soil: new THREE.MeshStandardMaterial({ color: '#5e4937', roughness: 1 }),
  foliage: new THREE.MeshStandardMaterial({ color: '#465d43', roughness: 1 }),
  bike: new THREE.MeshStandardMaterial({ color: '#693832', roughness: .62, metalness: .34 }),
  podWhite: new THREE.MeshStandardMaterial({ color: '#f3f5ee', roughness: .78 }),
  podGreen: new THREE.MeshStandardMaterial({ color: '#3d7b5d', roughness: .68, metalness: .03 }),
  podGreenDark: new THREE.MeshStandardMaterial({ color: '#285340', roughness: .75 }),
  podGlass: new THREE.MeshStandardMaterial({ color: '#1e4039', emissive: '#244b43', emissiveIntensity: .22, roughness: .28, metalness: .1, transparent: true, opacity: .88 }),
};
// Mirrors the student-submitted swap status tokens in styles.css. A dark
// panel is unlisted: it does not imply a vacancy or an official allocation.
// Traffic light: red = registered but not moving, yellow = open, green = match.
const statusColors = { unlisted: '#514346', occupied: '#d6452f', open: '#e0a318', match: '#2f9161', waitlist: '#d6437e' };

function box(size, position, material, parent, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function railBar(parent, start, end, radius = .026) {
  const vector = new THREE.Vector3().subVectors(end, start);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 7), materials.bike);
  bar.position.copy(start).add(end).multiplyScalar(.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); parent.add(bar);
}
/* One BufferGeometry out of many boxes. A floor's louvre screen is ~600 fins;
   as separate meshes that was the single biggest cost in the old viewer. */
function mergeBoxes(items) {
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const source = unit.attributes.position.array, sourceNormal = unit.attributes.normal.array, sourceIndex = unit.index.array;
  const position = [], normal = [], index = [];
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  const quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), vector = new THREE.Vector3();
  items.forEach(item => {
    const offset = position.length / 3;
    matrix.compose(vector.fromArray(item.position), quaternion.setFromEuler(euler.set(0, item.angle || 0, 0)), new THREE.Vector3(...item.size));
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < source.length; i += 3) {
      vector.set(source[i], source[i + 1], source[i + 2]).applyMatrix4(matrix);
      position.push(vector.x, vector.y, vector.z);
      vector.set(sourceNormal[i], sourceNormal[i + 1], sourceNormal[i + 2]).applyMatrix3(normalMatrix).normalize();
      normal.push(vector.x, vector.y, vector.z);
    }
    for (let i = 0; i < sourceIndex.length; i++) index.push(sourceIndex[i] + offset);
  });
  unit.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
}

/* ── The perimeter, straight out of the floor plan ───────────────────────── */

/* OUTLINE is the traced building perimeter in plan pixels (docs/trace-outline.py).
   Everything below is positioned off it, so the 3D top view and the 2D floor
   plan cannot drift apart: the four cross-shaped pods sit where the drawing puts
   them, at the drawing's spacing, joined by the drawing's diagonal links. */
const planX = value => (value - PLAN_ORIGIN[0]) * PLAN_SCALE;
const planZ = value => (value - PLAN_ORIGIN[1]) * PLAN_SCALE;
const ring = OUTLINE.map(([x, y]) => new THREE.Vector2(planX(x), planZ(y)));
const RING = ring.length;

function tangentAt(index) {
  const before = ring[(index - 1 + RING) % RING], after = ring[(index + 1) % RING];
  return new THREE.Vector2(after.x - before.x, after.y - before.y).normalize();
}
function insideRing(x, y) {
  let inside = false;
  for (let i = 0, j = RING - 1; i < RING; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
// Resolve which side of the ring is outdoors once, rather than trusting the
// winding the tracer happened to produce.
const normalSign = (() => {
  const probe = tangentAt(0);
  return insideRing(ring[0].x + probe.y * .05, ring[0].y - probe.x * .05) ? -1 : 1;
})();
function normalAt(index) {
  const tangent = tangentAt(index);
  return new THREE.Vector2(tangent.y * normalSign, -tangent.x * normalSign);
}
const normals = ring.map((_, index) => normalAt(index));
// rotation.y that points a mesh's local +X along the perimeter at this point.
const headings = ring.map((_, index) => { const tangent = tangentAt(index); return Math.atan2(-tangent.y, tangent.x); });

function offsetRing(distance) {
  return ring.map((point, index) => new THREE.Vector2(point.x + normals[index].x * distance, point.y + normals[index].y * distance));
}
function shapeOf(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => index ? shape.lineTo(point.x, -point.y) : shape.moveTo(point.x, -point.y));
  shape.closePath();
  return shape;
}
/* Extrudes a ring upward: the shape's y carries -z, so rotating -90° about X
   lands the extrusion on +Y with the plan orientation intact. */
function slabGeometry(points, height, holePoints) {
  const shape = shapeOf(points);
  if (holePoints) shape.holes.push(new THREE.Path(holePoints.slice().reverse().map(point => new THREE.Vector2(point.x, -point.y))));
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2);
}
function slab(geometry, y, material, parent, cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y; mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

/* Which stretches of the perimeter are room facade, and which are open balcony.
   The plan's rooms only ever front onto the straight runs; every curve is the
   louvred balcony that gives the block its banded, wavy elevation. */
const facadeRuns = [...ROOM_FACADE, ...VOID_FACADE].filter(Boolean);
const isBalcony = ring.map((_, index) => !facadeRuns.some(([from, to]) => index >= from && index <= to));

// Centre / length / heading of one room's run of perimeter, for its status panel.
function runFrame(from, to) {
  const start = ring[from], end = ring[to];
  const direction = new THREE.Vector2(end.x - start.x, end.y - start.y);
  const length = direction.length() || .1;
  direction.divideScalar(length);
  const normal = new THREE.Vector2();
  for (let i = from; i <= to; i++) normal.add(normals[i]);
  normal.normalize();
  return {
    x: (start.x + end.x) / 2, z: (start.y + end.y) / 2,
    nx: normal.x, nz: normal.y, length, angle: Math.atan2(-direction.y, direction.x),
  };
}
const roomFrames = ROOM_FACADE.map(run => run && runFrame(run[0], run[1]));

function createResidentialBuilding() {
  const group = new THREE.Group();
  const floorGroups = Array.from({ length: FLOOR_COUNT }, () => new THREE.Group());
  floorGroups.forEach(floorGroup => group.add(floorGroup));
  const roomMeshes = [];

  const wallRing = offsetRing(-wallIn);
  const wallGeometry = slabGeometry(wallRing, floorHeight);
  const bandGeometry = slabGeometry(offsetRing(bandOut), bandHeight);

  /* The vertical fins. Real ones sit roughly 0.3 m apart, so sample the ring at
     twice its stored resolution and skip anything a room fronts onto. */
  const finHeight = floorHeight - louvreBase - .04;
  const fins = [];
  for (let index = 0; index < RING; index++) {
    if (!isBalcony[index] || !isBalcony[(index + 1) % RING]) continue;
    for (const step of [0, .5]) {
      const next = (index + 1) % RING;
      const x = ring[index].x + (ring[next].x - ring[index].x) * step;
      const z = ring[index].y + (ring[next].y - ring[index].y) * step;
      const normal = normals[index];
      fins.push({
        size: [.10, finHeight, .24],
        position: [x + normal.x * (-wallIn + .12), louvreBase + finHeight / 2, z + normal.y * (-wallIn + .12)],
        angle: headings[index],
      });
    }
  }
  const finGeometry = mergeBoxes(fins);
  // A dark reveal behind the fins so the balcony reads as depth, not a red stripe.
  const revealGeometry = slabGeometry(offsetRing(-wallIn - .01), finHeight);

  function roomPanel(parent, frame, y, info) {
    const material = new THREE.MeshStandardMaterial({ color: statusColors[info.status], emissive: statusColors[info.status], emissiveIntensity: .17, roughness: .45, metalness: .04 });
    const panel = box([frame.length + .1, .66, .14], [frame.x + frame.nx * (-wallIn + .07), y, frame.z + frame.nz * (-wallIn + .07)], material, parent);
    panel.rotation.y = frame.angle;
    panel.userData = info; roomMeshes.push(panel);
  }

  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    const level = floorGroups[floor];
    const y0 = groundClearance + floor * floorHeight;
    slab(wallGeometry, y0, materials.wall, level);
    slab(revealGeometry, y0 + louvreBase, materials.reveal, level, false);
    slab(bandGeometry, y0 - .05, materials.band, level);
    const finScreen = new THREE.Mesh(finGeometry, materials.louvre);
    finScreen.position.y = y0; finScreen.castShadow = true; finScreen.receiveShadow = true; level.add(finScreen);
    roomFrames.forEach((frame, roomIndex) => {
      if (!frame) return;
      roomPanel(level, frame, y0 + louvreBase + finHeight / 2, {
        floor, room: roomIndex + 1,
        pod: roomIndex < 8 ? 1 : roomIndex < 16 ? 2 : roomIndex < 22 ? 3 : 4,
        visualRoomId: `${floor + 1}${String(roomIndex + 1).padStart(2, '0')}`,
        status: 'unlisted',
      });
    });
  }

  /* Open pilotis ground level: a set-back white volume behind a colonnade, the
     way the entrance courts read in the photographs. */
  slab(slabGeometry(offsetRing(.38), .2), 0, materials.paving, group, false);
  slab(slabGeometry(offsetRing(-.55), groundClearance), .18, materials.soffit, group);
  for (let index = 0; index < RING; index += 9) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, groundClearance, 10), materials.column);
    column.position.set(ring[index].x + normals[index].x * -.16, groundClearance / 2 + .18, ring[index].y + normals[index].y * -.16);
    column.castShadow = true; column.receiveShadow = true; group.add(column);
  }

  // Roof: the last band, a deck, and a parapet ring that carries the fascia up.
  // The deck is the duller soffit tone, so from above the building still reads
  // as banded ribbon rather than one bright lid.
  slab(bandGeometry, roofLevel - .05, materials.band, group);
  slab(slabGeometry(wallRing, .18), roofLevel + .40, materials.soffit, group);
  slab(slabGeometry(offsetRing(.02), .34, offsetRing(-.30)), roofLevel + .58, materials.band, group);
  // Stair and lift heads land on the four pod centres, as they do on the plan.
  [[346.5, 337.5], [702, 692.5], [1058, 337.5], [1414.5, 692.5]].forEach(([x, y]) => {
    box([2.4, .95, 2.0], [planX(x), roofLevel + 1.05, planZ(y)], materials.soffit, group);
  });

  /* Building identity. This was lettering on a facade band, like the real
     hostels carry, but the longer names (Varahamihira, Kalpana Chawla) were
     wider than the band and got cut off, and any fixed plane shows mirrored
     from behind. A sprite above the roof turns to face the camera, so the name
     is legible and complete from every orbit position and can never be cropped
     or read backwards. makeNameTexture() fits the text to the canvas; the
     scale below keeps that canvas's aspect so the lettering is never squashed. */
  const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  nameSprite.position.set(0, roofLevel + 2.15, 0);
  nameSprite.scale.set(7.2, 1.41, 1);
  group.add(nameSprite);
  const signs = [nameSprite];

  /* ── Ground plane and landscape ─────────────────────────────────────────── */

  box([46, .18, 28], [0, .09, 0], materials.paving, group, false);
  const contactShadow = new THREE.Mesh(slabGeometry(offsetRing(1.7), .01), new THREE.MeshBasicMaterial({ color: '#352425', transparent: true, opacity: .3, depthWrite: false }));
  contactShadow.position.y = .19; group.add(contactShadow);

  function bikeBar(target, start, end, radius = .035) {
    const vector = new THREE.Vector3().subVectors(end, start);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 7), materials.bike);
    bar.position.copy(start).add(end).multiplyScalar(.5);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    target.add(bar);
  }
  function bicycle(x, z, angle = 0, baseY = .23) {
    const bike = new THREE.Group(); bike.position.set(x, baseY, z); bike.rotation.y = angle; group.add(bike);
    const wheel = new THREE.TorusGeometry(.28, .024, 6, 14);
    [-.35, .35].forEach(offset => {
      const wheelMesh = new THREE.Mesh(wheel, materials.bike); wheelMesh.position.set(offset, .28, 0); bike.add(wheelMesh);
    });
    bikeBar(bike, new THREE.Vector3(-.35, .28, 0), new THREE.Vector3(0, .64, 0), .03);
    bikeBar(bike, new THREE.Vector3(0, .64, 0), new THREE.Vector3(.35, .28, 0), .03);
    bikeBar(bike, new THREE.Vector3(-.35, .28, 0), new THREE.Vector3(.35, .28, 0), .03);
    bikeBar(bike, new THREE.Vector3(0, .64, 0), new THREE.Vector3(.1, .85, 0), .03);
    bikeBar(bike, new THREE.Vector3(-.33, .85, 0), new THREE.Vector3(.02, .85, 0), .026);
  }
  function planterSeat(x, z, rotation = 0) {
    const planter = new THREE.Group(); planter.position.set(x, .18, z); planter.rotation.y = rotation; group.add(planter);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, .46, 20), materials.planter);
    rim.position.y = .23; rim.castShadow = true; rim.receiveShadow = true; planter.add(rim);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .08, 18), materials.soil);
    soil.position.y = .48; planter.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 1.6, 7), new THREE.MeshStandardMaterial({ color: '#704b33', roughness: 1 }));
    trunk.position.y = 1.3; planter.add(trunk);
    [[0, 2.35, 0], [.32, 2.0, .12], [-.34, 1.9, -.1], [.11, 1.78, -.3]].forEach(([px, py, pz], index) => {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.46 - index * .05, 8, 7), materials.foliage);
      crown.position.set(px, py, pz); crown.castShadow = true; planter.add(crown);
    });
  }
  function bicycleCourt(planPointX, planPointY, angle) {
    const x = planX(planPointX), z = planZ(planPointY);
    box([4.2, .17, 1.9], [x, .28, z], materials.soffit, group, false);
    railBar(group, new THREE.Vector3(x - 1.9, .32, z - .75), new THREE.Vector3(x - 1.9, .95, z - .75));
    railBar(group, new THREE.Vector3(x - 1.9, .95, z - .75), new THREE.Vector3(x + 1.9, .95, z - .75));
    railBar(group, new THREE.Vector3(x + 1.9, .95, z - .75), new THREE.Vector3(x + 1.9, .32, z - .75));
    for (let index = 0; index < 7; index++) bicycle(x - 1.6 + index * .54, z + .2 + (index % 2) * .42, angle, .365);
  }
  // Both concave courts, plus the approach in front of the two southern pods.
  bicycleCourt(980, 720, .12); bicycleCourt(1140, 720, -.1);
  planterSeat(planX(1058), planZ(640));
  bicycleCourt(640, 300, .1); bicycleCourt(800, 300, -.12);
  planterSeat(planX(720), planZ(400));
  bicycleCourt(560, 990, 0); bicycleCourt(1300, 990, 0);
  planterSeat(planX(300), planZ(640)); planterSeat(planX(1620), planZ(360));

  return { group, floorGroups, roomMeshes, signs };
}

const residential = createResidentialBuilding();
scene.add(residential.group);

// Vivekananda and S. N. Bose are the older green-and-white, shared-room
// hostels. They are no longer selectable in the live app (see
// docs/PROGRESS.md, boys-hostel-only pass), so this pod massing stays built
// but permanently hidden — kept in case a future session reintroduces those
// hostels rather than re-deriving the geometry from scratch.
const podBuilding = new THREE.Group();
podBuilding.rotation.y = -.18;
podBuilding.visible = false;
scene.add(podBuilding);
const podFloorGroups = Array.from({ length: FLOOR_COUNT }, () => new THREE.Group());
podFloorGroups.forEach(group => podBuilding.add(group));

function podRoomPanel(parent, x, y, z, info, side) {
  const color = statusColors[info.status];
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .16, roughness: .42, metalness: .03 });
  const panel = box([.68, .68, .08], [x, y, z + side * .06], material, parent);
  panel.userData = info;
}
function podModule(group, floor, podIndex, x) {
  const y0 = groundClearance + floor * floorHeight;
  const y = y0 + 1.0;
  // Each module holds eight two-sharing rooms: four facing each side of the
  // circulation spine.  The repeated white volume and green frames make the
  // block visually distinct from the leaf / louvre housing.
  box([4.18, 1.68, 2.52], [x, y, 0], materials.podWhite, group);
  box([4.52, .16, 2.80], [x, y0 + .10, 0], materials.podGreen, group);
  box([4.52, .15, 2.80], [x, y0 + floorHeight - .08, 0], materials.podGreen, group);
  box([.24, 1.38, 2.82], [x - 2.02, y, 0], materials.podGreenDark, group);
  box([.24, 1.38, 2.82], [x + 2.02, y, 0], materials.podGreenDark, group);
  [-1, 1].forEach(side => {
    box([3.52, .95, .06], [x, y, side * 1.285], materials.podGlass, group, false);
    for (let room = 0; room < 4; room++) {
      const roomX = x - 1.32 + room * .88;
      box([.06, 1.08, .12], [roomX - .38, y, side * 1.33], materials.podGreen, group, false);
      const roomSlot = podIndex * 8 + (side < 0 ? 4 : 0) + room;
      podRoomPanel(group, roomX, y, side * 1.34, {
        floor,
        wing: podIndex,
        room: side > 0 ? room + 1 : room + 5,
        sharing: 2,
        visualRoomId: `${floor + 1}${String(roomSlot + 1).padStart(2, '0')}`,
        status: 'unlisted'
      }, side);
    }
  });
}

box([18.5, .18, 10.6], [0, .09, 0], materials.paving, podBuilding, false);
box([12.9, .16, 1.2], [0, groundClearance - .04, 0], materials.podGreen, podBuilding, false);
for (let floor = 0; floor < FLOOR_COUNT; floor++) {
  const level = podFloorGroups[floor];
  [-4.45, 0, 4.45].forEach((x, podIndex) => podModule(level, floor, podIndex, x));
  // Short bridges keep the three modules visibly separate rather than reading
  // as one continuous leaf-like bar.
  const galleryY = groundClearance + floor * floorHeight + .45;
  [-2.22, 2.22].forEach(x => box([.52, .11, .82], [x, galleryY, 0], materials.podWhite, level, false));
  [-2.22, 2.22].forEach(x => box([.12, 1.20, 1.02], [x, galleryY + .55, 0], materials.podGreen, level, false));
}
box([1.5, residentialHeight + groundClearance, 1.1], [0, (residentialHeight + groundClearance) / 2, 0], materials.podGreenDark, podBuilding);
[-4.45, 0, 4.45].forEach(x => box([4.46, .17, 3.0], [x, groundClearance + residentialHeight + .18, 0], materials.podWhite, podBuilding));
for (let x = -5.75; x <= 5.75; x += 2.3) {
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.14, .16, groundClearance, 10), materials.podWhite);
  column.position.set(x, groundClearance / 2, -1.65); column.castShadow = true; column.receiveShadow = true; podBuilding.add(column);
}

/* ── Layout and status colouring ─────────────────────────────────────────── */

let isolatedFloor = null;
function applyRoomStatus(mesh, status) {
  const nextStatus = statusColors[status] ? status : 'unlisted';
  const color = statusColors[nextStatus];
  mesh.userData.status = nextStatus;
  mesh.material.color.set(color);
  mesh.material.emissive.set(color);
  mesh.material.emissiveIntensity = nextStatus === 'unlisted' ? .04 : nextStatus === 'match' ? .38 : nextStatus === 'open' ? .28 : .17;
}
let activeRoomMeshes = residential.roomMeshes;
/* Brushed-silver lettering drawn to a canvas: a dark extrusion behind the
   glyphs plus a light-to-dark-to-light vertical gradient reads as bevelled
   metal, and the plane's own metalness picks up the scene lighting. */
function makeNameTexture(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const text = name.toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  /* Fit the name to the canvas rather than letting it run off the edge. At the
     old fixed 116px the longer hostel names measured wider than the 1024px
     canvas and were simply cut in half. letterSpacing has to be set before
     measuring — it counts towards measureText's width. */
  let size = 116;
  const useFont = () => {
    ctx.font = `800 ${size}px Manrope, Helvetica, Arial, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * .12)}px`;
  };
  for (useFont(); size > 40 && ctx.measureText(text).width > 960; size -= 2) useFont();

  for (let depth = 7; depth > 0; depth--) {         // extruded side of the letters
    ctx.fillStyle = `rgba(28, 24, 26, ${.10 + depth * .045})`;
    ctx.fillText(text, 512 + depth * .7, 100 + depth * 1.1);
  }
  const silver = ctx.createLinearGradient(0, 100 - size * .48, 0, 100 + size * .48);
  silver.addColorStop(0, '#ffffff');
  silver.addColorStop(.30, '#dfe4e9');
  silver.addColorStop(.50, '#f7f9fa');
  silver.addColorStop(.68, '#98a2ac');
  silver.addColorStop(.86, '#cfd6dc');
  silver.addColorStop(1, '#f2f5f7');
  ctx.fillStyle = silver;
  ctx.fillText(text, 512, 100);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
  ctx.strokeText(text, 512, 100);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function setBuilding(name, roomStatuses = {}) {
  residential.roomMeshes.forEach(mesh => {
    mesh.userData.hostel = name;
    applyRoomStatus(mesh, roomStatuses[mesh.userData.visualRoomId] || 'unlisted');
  });
  const texture = makeNameTexture(name);
  residential.signs.forEach(sign => {
    sign.material.map?.dispose();
    sign.material.map = texture;
    sign.material.needsUpdate = true;
  });
}
function setFloor(value) {
  isolatedFloor = value === 'all' ? null : Number(value);
  residential.floorGroups.forEach((floorGroup, index) => { floorGroup.visible = isolatedFloor === null || index === isolatedFloor; });
  readout.innerHTML = isolatedFloor === null ? `<strong>All residential levels</strong><span>Drag to rotate · scroll to zoom · click a room</span>` : `<strong>Floor ${String(isolatedFloor + 1).padStart(2, '0')} isolated</strong><span>Click a coloured room to inspect its status</span>`;
}
function zoomIn() { camera.position.lerp(controls.target, .18); controls.update(); }
function zoomOut() {
  const outward = camera.position.clone().sub(controls.target).multiplyScalar(1.22).add(controls.target);
  const distance = outward.distanceTo(controls.target);
  if (distance <= controls.maxDistance) camera.position.copy(outward);
  controls.update();
}
function resetView() {
  camera.position.set(...DEFAULT_CAMERA.position);
  controls.target.set(...DEFAULT_CAMERA.target);
  controls.update();
}
window.addEventListener('nivas:building-change', event => {
  const detail = event.detail;
  if (detail?.name) setBuilding(detail.name, detail.roomStatuses || {});
});

/* ── Campus/friends city view — deferred, not exposed in the current UI ──── */

const hostelNames = [
  'Anandi Joshi', 'Aryabhatta', 'Bhabha', 'Bhaskara', 'Brahmagupta', 'Charaka',
  'Gargi', 'Kalam', 'Kalpana Chawla', 'Kapila', 'Kautilya', 'Maitreyi',
  'Raman', 'Ramanuja', 'Ramanujan', 'S N Bose', 'Sarabhai', 'Sarojini Naidu',
  'Susruta', 'Varahamihira', 'Viswesvaraya', 'Vivekananda', 'Vyasa'
];
const cityGroup = new THREE.Group();
cityGroup.visible = false;
scene.add(cityGroup);
const cityRoad = new THREE.MeshStandardMaterial({ color: '#362b2d', roughness: .95 });
const cityGrass = new THREE.MeshStandardMaterial({ color: '#293c34', roughness: 1 });
const cityWindow = new THREE.MeshStandardMaterial({ color: '#4b4b49', emissive: '#242424', emissiveIntensity: .12, roughness: .62 });
const cityBuildings = new Map();
const cityPickMeshes = [];
const cityLightMeshes = [];

// Map-informed precinct geometry: the Hostel Office identifies two clusters on
// opposite sides of the hostel circle.  The newer eight-block residential
// complex is modelled as its own dense west cluster; the older blocks sit on
// the east side around the Hostel Circle road network.
const newHousing = new Set(['Anandi Joshi', 'Bhabha', 'Kalam', 'Raman', 'Ramanujan', 'Sarabhai', 'Sarojini Naidu', 'Viswesvaraya']);
const cityLayout = {
  'Anandi Joshi': [-15.2, 13.4], 'Bhabha': [-10.4, 15.5], 'Kalam': [-5.2, 13.2], 'Raman': [-14.0, 7.5],
  'Ramanujan': [-9.1, 8.4], 'Sarabhai': [-4.2, 7.0], 'Sarojini Naidu': [-11.4, 2.1], 'Viswesvaraya': [-5.8, 1.7],
  'Aryabhatta': [7.4, 13.9], 'Bhaskara': [11.6, 13.3], 'Brahmagupta': [16.0, 12.4], 'Charaka': [18.6, 8.4],
  'Gargi': [7.4, 8.1], 'Kalpana Chawla': [11.7, 8.0], 'Kapila': [16.1, 7.4], 'Kautilya': [5.5, 2.8],
  'Maitreyi': [9.6, 2.6], 'Ramanuja': [14.0, 2.2], 'S N Bose': [18.2, 1.8], 'Susruta': [6.6, -4.0],
  'Varahamihira': [10.7, -4.2], 'Vivekananda': [14.8, -4.6], 'Vyasa': [18.7, -4.4]
};
function cityRoadSegment(start, end, width = .8) {
  const [x1, z1] = start; const [x2, z2] = end;
  const length = Math.hypot(x2 - x1, z2 - z1);
  const road = box([width, .06, length], [(x1 + x2) / 2, .17, (z1 + z2) / 2], cityRoad, cityGroup, false);
  road.rotation.y = Math.atan2(x2 - x1, z2 - z1);
}
function cityLabel(text, x, z) {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 96;
  const context = labelCanvas.getContext('2d');
  context.fillStyle = 'rgba(37, 26, 26, .84)'; context.fillRect(0, 0, 512, 96);
  context.fillStyle = '#ffe4d0'; context.font = '600 28px monospace'; context.textAlign = 'center'; context.fillText(text, 256, 60);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthWrite: false }));
  sprite.position.set(x, .35, z); sprite.scale.set(7.6, 1.42, 1); cityGroup.add(sprite);
}

box([47, .18, 31], [1.5, .05, 5.5], cityGrass, cityGroup, false);
cityRoadSegment([1.1, -10.5], [1.1, 20.3], 1.05); // IITH Main Road spine
cityRoadSegment([-19.5, 10.3], [1.1, 10.3], .82); // west-to-hostel-circle link
cityRoadSegment([1.1, 5.1], [20.5, 5.1], .82); // Hostel Road east link
cityRoadSegment([-15.8, 2.0], [-15.8, 16.7], .68); // new housing service lane
cityRoadSegment([-15.8, 16.7], [-3.4, 16.7], .68);
cityRoadSegment([-3.4, 16.7], [-3.4, 1.3], .68);
cityRoadSegment([5.4, -6.7], [20.5, -6.7], .68);
cityRoadSegment([20.5, -6.7], [20.5, 14.8], .68);
const hostelCircle = new THREE.Mesh(new THREE.TorusGeometry(3.25, .38, 7, 34), cityRoad);
hostelCircle.rotation.x = Math.PI / 2; hostelCircle.position.set(1.1, .18, 5.1); cityGroup.add(hostelCircle);
cityLabel('NEW STUDENT HOUSING', -10.2, 20.0);
cityLabel('HOSTEL CIRCLE · OLD BLOCKS', 12.7, -9.4);

hostelNames.forEach((name, index) => {
  const [x, z] = cityLayout[name];
  const isNewHousing = newHousing.has(name);
  const isPod = name === 'Vivekananda' || name === 'S N Bose';
  const height = isNewHousing ? 6.25 : 4.45 + (index % 3) * .56;
  const width = isNewHousing ? 4.9 : 3.65;
  const depth = isNewHousing ? 3.25 : 2.85;
  const group = new THREE.Group();
  cityGroup.add(group);
  const material = new THREE.MeshStandardMaterial({ color: '#5c5756', emissive: '#1c1a1a', emissiveIntensity: .06, roughness: .78 });
  const shell = box([width, height, depth], [x, height / 2 + .18, z], material, group);
  shell.userData = { hostel: name };
  cityPickMeshes.push(shell);
  const roofMaterial = isPod ? materials.podWhite : materials.band;
  const facadeMaterial = isPod ? materials.podGreen : (isNewHousing ? materials.louvre : cityWindow);
  box([width + .34, .15, depth + .34], [x, height + .28, z], roofMaterial, group, false);
  for (let level = 0; level < (isNewHousing ? 4 : 3); level++) {
    const count = isNewHousing ? 4 : 3;
    for (let window = 0; window < count; window++) {
      box([isNewHousing ? .6 : .5, .38, .08], [x - (width / 2) + .65 + window * ((width - 1.3) / Math.max(1, count - 1)), 1.02 + level * 1.12, z + depth / 2 + .04], facadeMaterial, group, false);
    }
  }
  cityBuildings.set(name, { x, z, height, depth, material, shell, isNewHousing, isPod });
});

function clearCityLights() {
  cityLightMeshes.splice(0).forEach(mesh => {
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
}
function cityLight(person, index) {
  const buildingInfo = cityBuildings.get(person.hostel);
  if (!buildingInfo) return;
  const floor = Math.max(0, Math.min(4, Number(String(person.room).split('-')[0]) - 1));
  const roomValue = Number(String(person.room).split('-')[1]) || index;
  const offset = ((roomValue % 4) - 1.5) * 1.08;
  // Lifted versions of the --status-* tokens: the scene is dark, so the flat
  // UI values would read as muddy at city zoom.
  const color = person.kind === 'PhD' ? '#e07aa6' : person.kind === 'M.Tech' ? '#8f74c9' : '#f0a33f';
  // Use an unlit material here so the selected rooms remain legible even when
  // users zoom far out over the dark campus scene.
  const material = new THREE.MeshBasicMaterial({ color });
  const light = box([1.04, .84, .22], [buildingInfo.x + offset, 1.08 + floor * 1.18, buildingInfo.z + buildingInfo.depth / 2 + .14], material, cityGroup, false);
  cityLightMeshes.push(light);
  // A slim beacon gives GTA-like wayfinding at city scale; the front panel
  // remains the room-level marker once the user zooms closer.
  const beacon = box([.26, 1.35, .26], [buildingInfo.x + offset, buildingInfo.height + 1.0, buildingInfo.z], material.clone(), cityGroup, false);
  cityLightMeshes.push(beacon);
}

let cityMode = false;
function setFriendMode(friends) {
  cityMode = Array.isArray(friends) && friends.length > 0;
  cityGroup.visible = cityMode;
  if (cityMode) {
    residential.group.visible = false;
    podBuilding.visible = false;
    activeRoomMeshes = [];
    clearCityLights();
    cityBuildings.forEach(info => {
      info.material.color.set('#5c5756');
      info.material.emissive.set('#1c1a1a');
      info.material.emissiveIntensity = .06;
    });
    friends.forEach((person, index) => {
      const info = cityBuildings.get(person.hostel);
      if (!info) return;
      info.material.color.set('#83948c');
      info.material.emissive.set('#315146');
      info.material.emissiveIntensity = .48;
      cityLight(person, index);
    });
    camera.position.set(35, 36, 48);
    controls.target.set(0, 0, 0);
    controls.minDistance = 18;
    controls.maxDistance = 92;
    controls.maxPolarAngle = Math.PI * .49;
    controls.update();
    readout.innerHTML = `<strong>${friends.length} friends across ${new Set(friends.map(friend => friend.hostel)).size} hostels</strong><span>Every other room is dimmed · click a lit hostel to enter it</span>`;
  } else {
    cityGroup.visible = false;
    clearCityLights();
    controls.minDistance = 16;
    controls.maxDistance = 105;
    resetView();
    residential.group.visible = true;
    activeRoomMeshes = residential.roomMeshes;
  }
}

/* ── Pointer interaction ──────────────────────────────────────────────── */

const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
/* Raycaster does not honour visibility, and a room panel's own flag stays true
   when setFloor() hides its floor group — so isolating a floor has to be walked
   up the parents or clicks land on rooms nobody can see. */
function pickable(mesh) {
  for (let node = mesh; node; node = node.parent) if (!node.visible) return false;
  return true;
}
canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (cityMode) {
    const cityHit = raycaster.intersectObjects(cityPickMeshes, false)[0];
    if (cityHit?.object.userData.hostel) window.dispatchEvent(new CustomEvent('nivas:open-friend-location', { detail: { hostel: cityHit.object.userData.hostel } }));
    return;
  }
  const hit = raycaster.intersectObjects(activeRoomMeshes.filter(pickable), false)[0];
  if (!hit) return;
  const info = hit.object.userData; const labels = { unlisted: 'Unlisted', occupied: 'Registered', open: 'Open to swap', match: 'Match for you', waitlist: 'Waitlisted' };
  readout.innerHTML = `<strong>${info.hostel} · Room ${String(info.floor + 1).padStart(2, '0')}-${String(info.room).padStart(2, '0')}</strong><span>Pod ${info.pod} · ${labels[info.status]} · click another room to explore</span>`;
  activeRoomMeshes.forEach(mesh => mesh.material.emissiveIntensity = mesh === hit.object ? .9 : .17);
  if (info.visualRoomId) window.dispatchEvent(new CustomEvent('nivas:room-click', { detail: { id: info.visualRoomId } }));
});
canvas.addEventListener('pointermove', event => { const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const targets = cityMode ? cityPickMeshes : activeRoomMeshes.filter(pickable); canvas.style.cursor = raycaster.intersectObjects(targets, false).length ? 'pointer' : 'grab'; });

function resize() { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
/* The stage is flex-sized now, so the canvas can change size without the window
   doing so (column stacking, rail width, view switching). Observe the canvas
   itself; setSize's third argument is false, so this can't feed back into a loop. */
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);
resize(); animate();
window.nivasViewer = { resize, setFriendMode, setFloor, zoomIn, zoomOut, resetView };
window.dispatchEvent(new Event('nivas:viewer-ready'));
