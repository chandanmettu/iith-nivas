import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const canvas = document.getElementById('hostel-3d-canvas');
const readout = document.getElementById('three-readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#24181b');
scene.fog = new THREE.Fog('#24181b', 30, 96);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 220);
camera.position.set(31, 27, 35);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 10.5, 0);
controls.enableDamping = true;
controls.minDistance = 14;
controls.maxDistance = 48;
controls.maxPolarAngle = Math.PI * .48;

scene.add(new THREE.HemisphereLight('#ffe5cf', '#332c2d', 2.2));
const sun = new THREE.DirectionalLight('#ffe2bd', 3.1);
sun.position.set(11, 26, 17); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
const fill = new THREE.DirectionalLight('#e45334', 1.05); fill.position.set(-17, 8, -11); scene.add(fill);

const FLOOR_COUNT = 9;
const floorHeight = 2.05;
const groundClearance = 1.55;
const residentialHeight = floorHeight * FLOOR_COUNT;
const materials = {
  concrete: new THREE.MeshStandardMaterial({ color: '#ded6c9', roughness: .85, metalness: .01 }),
  band: new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: .6 }),
  louvre: new THREE.MeshStandardMaterial({ color: '#a94130', roughness: .7, metalness: .04 }),
  louvreDark: new THREE.MeshStandardMaterial({ color: '#612d29', roughness: .7 }),
  core: new THREE.MeshStandardMaterial({ color: '#cfc0b1', roughness: .86 }),
  glass: new THREE.MeshStandardMaterial({ color: '#302826', emissive: '#3e261f', emissiveIntensity: .26, roughness: .25, metalness: .12, transparent: true, opacity: .86 }),
  roof: new THREE.MeshStandardMaterial({ color: '#fff9ef', roughness: .58 }),
  column: new THREE.MeshStandardMaterial({ color: '#eee5d9', roughness: .8 }),
  paving: new THREE.MeshStandardMaterial({ color: '#cab9a9', roughness: .96 }),
  pathway: new THREE.MeshStandardMaterial({ color: '#8f8981', roughness: .82 }),
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
const statusColors = { unlisted: '#514346', occupied: '#47875f', open: '#d99a2b', match: '#3c8ca0' };

function box(size, position, material, parent, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function railBar(parent, start, end, radius = .026) {
  const vector = new THREE.Vector3().subVectors(end, start);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 7), materials.bike);
  bar.position.copy(start).add(end).multiplyScalar(.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); parent.add(bar);
}

// Nivas lets a student compare up to three hostels side by side in the 3D
// view (see docs/PROGRESS.md). The geometry is reference-informed, not
// hostel-specific — every hostel uses the same leaf-cluster massing — so
// each "slot" below is a full independent instance of that same building,
// laid out along X and recoloured per that slot's assigned hostel.
function createResidentialBuilding() {
  const group = new THREE.Group();
  group.rotation.y = -.18;
  const floorGroups = Array.from({ length: FLOOR_COUNT }, () => new THREE.Group());
  floorGroups.forEach(g => group.add(g));
  const roomMeshes = [];

  function roomPanel(parent, x, y, z, info) {
    const material = new THREE.MeshStandardMaterial({ color: statusColors[info.status], emissive: statusColors[info.status], emissiveIntensity: .17, roughness: .45, metalness: .04 });
    const panel = box([.5, .68, .09], [x, y, z], material, parent);
    panel.userData = info; roomMeshes.push(panel);
  }
  function louvreWall(leaf, y, z, floor, wingIndex, side) {
    box([3.88, .98, .07], [2.1, y, z], materials.glass, leaf, false);
    // The real facade alternates tight privacy louvres, wider daylight gaps and solid red panels.
    let x = .20;
    for (let l = 0; l < 25; l++) {
      const privacyPanel = (l + floor + wingIndex) % 11 === 0;
      const width = privacyPanel ? .18 : .052;
      const louvre = box([width, 1.08, privacyPanel ? .16 : .12], [x, y, z + (side > 0 ? .04 : -.04)], materials.louvre, leaf, false);
      louvre.rotation.y = privacyPanel ? 0 : .31 * side;
      x += width + (privacyPanel ? .13 : (l % 5 === 0 ? .105 : .075));
    }
    box([3.98, .045, .09], [2.1, y - .47, z], materials.louvreDark, leaf, false);
    box([3.98, .035, .09], [2.1, y + .47, z], materials.louvreDark, leaf, false);
    for (let room = 0; room < 4; room++) {
      const roomSlot = wingIndex * 8 + (side < 0 ? 4 : 0) + room;
      roomPanel(leaf, .48 + room * .92, y, z + side * .09, {
        floor, wing: wingIndex, room: room + 1, visualRoomId: `${floor + 1}${String(roomSlot + 1).padStart(2, '0')}`, status: 'unlisted'
      });
    }
  }
  function waveFascia(leaf, y, side) {
    // Small connected segments give the white floor band a soft, continuous wave at the curved facade.
    for (let segment = 0; segment < 23; segment++) {
      const x = .10 + segment * .18;
      const offset = Math.sin((segment / 22) * Math.PI * 1.25) * .17;
      box([.22, .20, .18], [x, y, side * (1.31 + offset)], materials.band, leaf, false);
    }
  }
  function roundedLeafEnd(leaf, y) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 1.65, 28), materials.concrete);
    end.position.set(4.05, y, 0); end.castShadow = true; end.receiveShadow = true; leaf.add(end);
    for (let l = 0; l < 15; l++) {
      const angle = -1.18 + l * .168;
      const x = 4.05 + Math.cos(angle) * 1.19;
      const z = Math.sin(angle) * 1.19;
      box([.065, 1.06, .065], [x, y, z], materials.louvre, leaf, false);
    }
  }
  function wingForFloor(target, floor, offsetX, offsetZ, angle, wingIndex) {
    const leaf = new THREE.Group(); leaf.position.set(offsetX, 0, offsetZ); leaf.rotation.y = angle; target.add(leaf);
    const y0 = groundClearance + floor * floorHeight;
    const y = y0 + 1.0;
    // One radial “leaf”: a tapered room bar, rounded exterior, louvred skin and white concrete bands.
    box([4.0, 1.65, 2.3], [2.0, y, 0], materials.concrete, leaf);
    box([4.82, .19, 2.7], [2.1, y0 + .12, 0], materials.band, leaf);
    box([4.82, .16, 2.7], [2.1, y0 + floorHeight - .08, 0], materials.band, leaf);
    waveFascia(leaf, y0 + .14, 1); waveFascia(leaf, y0 + .14, -1);
    waveFascia(leaf, y0 + floorHeight - .08, 1); waveFascia(leaf, y0 + floorHeight - .08, -1);
    louvreWall(leaf, y, 1.18, floor, wingIndex, 1);
    louvreWall(leaf, y, -1.18, floor, wingIndex, -1);
    roundedLeafEnd(leaf, y);
  }
  function groundRoom(parent, x, z, rotation = 0) {
    const room = new THREE.Group(); room.position.set(x, 0, z); room.rotation.y = rotation; parent.add(room);
    // Enclosed white room at the pilotis level, based on the service/core rooms in the reference facade.
    box([2.5, 1.33, 2.05], [0, .75, 0], materials.band, room);
    box([2.72, .13, 2.28], [0, 1.46, 0], materials.band, room, false);
    box([.64, .92, .06], [.34, .74, 1.055], materials.louvreDark, room, false);
    for (let slat = 0; slat < 5; slat++) box([.07, 1.01, .1], [.08 + slat * .14, .76, 1.10], materials.louvre, room, false);
    box([.54, .78, .06], [-.72, .77, 1.06], materials.glass, room, false);
    box([.45, .10, .12], [-.72, 1.18, 1.1], materials.band, room, false);
  }
  function cluster(x, z, rotation, index) {
    const coreGroup = new THREE.Group(); coreGroup.position.set(x, 0, z); coreGroup.rotation.y = rotation; group.add(coreGroup);
    // The communal atrium is held by an expressed stair/lift core and roof lantern.
    box([1.28, residentialHeight + groundClearance, 1.55], [0, (residentialHeight + groundClearance) / 2, 0], materials.core, coreGroup);
    box([.5, residentialHeight - .5, .12], [.69, groundClearance + residentialHeight / 2, 0], materials.louvreDark, coreGroup, false);
    for (let step = 0; step < 11; step++) box([.95, .10, .24], [-.15, .22 + step * .17, 1.12 - step * .16], materials.band, coreGroup, false);
    for (let floor = 0; floor < FLOOR_COUNT; floor++) {
      const target = floorGroups[floor];
      const y = groundClearance + floor * floorHeight + .12;
      box([5.45, .16, 5.45], [x, y, z], materials.band, target);
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((angle, wing) => wingForFloor(target, floor, x, z, rotation + angle, index * 4 + wing));
    }
    const towerY = groundClearance + residentialHeight + .7;
    box([1.65, 1.25, 1.85], [0, towerY, 0], materials.core, coreGroup);
    box([4.2, .15, 3.35], [0, towerY + .72, 0], materials.roof, coreGroup);
    // Pilotis create the open shaded ground level visible in the reference facade.
    [[-2.15,-2.15],[-2.15,2.15],[2.15,-2.15],[2.15,2.15]].forEach(([px,pz]) => {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, groundClearance, 10), materials.column);
      column.position.set(px, groundClearance / 2, pz); column.castShadow = true; column.receiveShadow = true; coreGroup.add(column);
    });
    // Two small enclosed bases leave generous shaded passages on the other sides of the cluster.
    groundRoom(coreGroup, 2.15, 0, 0);
    groundRoom(coreGroup, 0, -2.15, -Math.PI / 2);
  }

  // Two connected residential clusters are the basis of the typical IIT-H block.
  cluster(-4.2, -1.5, .12, 0);
  cluster(4.2, 1.5, -.12, 1);
  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    const y = groundClearance + floor * floorHeight + .92;
    box([5.5, .45, 1.34], [0, y, 0], materials.concrete, floorGroups[floor]);
    box([5.85, .15, 1.65], [0, groundClearance + floor * floorHeight + .13, 0], materials.band, floorGroups[floor]);
  }

  // The covered court extends beyond the residential footprint, leaving room for the approach and cycle bays.
  box([21.8, .18, 15.6], [0, .09, 0], materials.paving, group, false);
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(7.4, 56), new THREE.MeshBasicMaterial({ color: '#352425', transparent: true, opacity: .28, depthWrite: false }));
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.y = .195; group.add(contactShadow);

  function bikeBar(target, start, end, radius = .035) {
    const vector = new THREE.Vector3().subVectors(end, start);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, vector.length(), 7), materials.bike);
    bar.position.copy(start).add(end).multiplyScalar(.5);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
    target.add(bar);
  }
  function bicycle(x, z, angle = 0, baseY = .23) {
    const bike = new THREE.Group(); bike.position.set(x, baseY, z); bike.rotation.y = angle; group.add(bike);
    const wheel = new THREE.TorusGeometry(.34, .028, 6, 15);
    [-.42, .42].forEach(offset => {
      const ring = new THREE.Mesh(wheel, materials.bike); ring.position.set(offset, .34, 0); bike.add(ring);
    });
    bikeBar(bike, new THREE.Vector3(-.42,.34,0), new THREE.Vector3(0,.78,0));
    bikeBar(bike, new THREE.Vector3(0,.78,0), new THREE.Vector3(.42,.34,0));
    bikeBar(bike, new THREE.Vector3(-.42,.34,0), new THREE.Vector3(.42,.34,0));
    bikeBar(bike, new THREE.Vector3(0,.78,0), new THREE.Vector3(.12,1.03,0));
    bikeBar(bike, new THREE.Vector3(-.15,.82,0), new THREE.Vector3(-.27,1.06,0));
    bikeBar(bike, new THREE.Vector3(-.4,1.03,0), new THREE.Vector3(.02,1.03,0), .03);
  }
  function planterSeat(x, z, rotation = 0) {
    const planter = new THREE.Group(); planter.position.set(x, 0, z); planter.rotation.y = rotation; group.add(planter);
    box([3.25, .42, 1.18], [0, .41, 0], materials.planter, planter, false);
    box([2.82, .08, .76], [0, .66, 0], materials.soil, planter, false);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.075, .10, 1.25, 7), new THREE.MeshStandardMaterial({ color: '#704b33', roughness: 1 }));
    trunk.position.y = 1.25; planter.add(trunk);
    [[0,2.0,0],[.34,1.7,.13],[-.37,1.62,-.1],[.12,1.52,-.32]].forEach(([px,py,pz], index) => {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.43 - index * .04, 8, 7), materials.foliage);
      crown.position.set(px, py, pz); planter.add(crown);
    });
    // Low concrete edges double as the informal sitting surface shown in the courtyard photos.
    box([3.52, .13, .20], [0, .72, .60], materials.band, planter, false);
    box([3.52, .13, .20], [0, .72, -.60], materials.band, planter, false);
  }
  function bicycleCourt(x, z, direction = 1) {
    box([3.75, .17, 1.92], [x, .28, z], materials.band, group, false);
    railBar(group, new THREE.Vector3(x - 1.7, .32, z - direction * .72), new THREE.Vector3(x - 1.7, 1.0, z - direction * .72));
    railBar(group, new THREE.Vector3(x - 1.7, 1.0, z - direction * .72), new THREE.Vector3(x + 1.7, 1.0, z - direction * .72));
    railBar(group, new THREE.Vector3(x + 1.7, 1.0, z - direction * .72), new THREE.Vector3(x + 1.7, .32, z - direction * .72));
    for (let bikeIndex = 0; bikeIndex < 6; bikeIndex++) bicycle(x - 1.45 + bikeIndex * .56, z + direction * (.25 + (bikeIndex % 2) * .45), direction * .18, .365);
  }
  function pathwayRamp(x, z, direction = 1) {
    // Narrow, gently rising access paths frame the central open court.  `direction`
    // points from the outer edge towards the building, so the front/back layouts mirror.
    const width = .88; const run = 4.35; const rise = .48; const thickness = .08; const half = width / 2;
    const vertices = new Float32Array([
      -half, 0, 0, half, 0, 0, -half, rise, run, half, rise, run,
      -half, -thickness, 0, half, -thickness, 0, -half, rise - thickness, run, half, rise - thickness, run,
    ]);
    const indices = [0, 1, 3, 0, 3, 2, 4, 7, 5, 4, 6, 7, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const ramp = new THREE.Mesh(geometry, materials.pathway);
    ramp.position.set(x, .22, z); ramp.rotation.y = direction < 0 ? Math.PI : 0; ramp.castShadow = true; ramp.receiveShadow = true; group.add(ramp);
  }
  function compactStair(x, z, direction = 1) {
    for (let step = 0; step < 3; step++) {
      const level = step + 1;
      box([1.52 + level * .10, level * .15, .38], [x, level * .075 + .18, z + direction * step * .30], materials.band, group, false);
    }
  }
  // Each face is one composition: twin sloped paths, a large empty central court, then
  // one three-step threshold immediately beside the residence. There are no side steps.
  box([4.18, .045, 4.48], [0, .215, 4.58], materials.band, group, false);
  box([4.18, .045, 4.48], [0, .215, -4.58], materials.band, group, false);
  pathwayRamp(-2.58, 6.74, -1); pathwayRamp(2.58, 6.74, -1);
  pathwayRamp(-2.58, -6.74, 1); pathwayRamp(2.58, -6.74, 1);
  compactStair(0, 2.60, -1); compactStair(0, -2.60, 1);

  // Mirrored raised cycle courts and planter seating islands occupy the sheltered corners.
  bicycleCourt(-5.35, 1.78, 1); bicycleCourt(5.35, 1.78, 1);
  bicycleCourt(-5.35, -1.78, -1); bicycleCourt(5.35, -1.78, -1);
  planterSeat(-2.7, 0, .08); planterSeat(2.7, 0, -.08);

  return { group, floorGroups, roomMeshes };
}

// A single shared building instance, recoloured per whichever hostel is
// currently selected. An earlier version of this file rendered up to 3
// hostels side by side for comparison — reverted (see docs/PROGRESS.md):
// the shared camera meant orbiting moved all 3 together, independent
// per-building orbiting would have needed a split-viewport rewrite, and
// none of that fixed the real cause of the lag (3x the detailed geometry
// rendering every frame either way).
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
function setBuilding(name, roomStatuses = {}) {
  residential.roomMeshes.forEach(mesh => {
    mesh.userData.hostel = name;
    applyRoomStatus(mesh, roomStatuses[mesh.userData.visualRoomId] || 'unlisted');
  });
}
function setFloor(value) {
  isolatedFloor = value === 'all' ? null : Number(value);
  residential.floorGroups.forEach((floorGroup, index) => { floorGroup.visible = isolatedFloor === null || index === isolatedFloor; });
  readout.innerHTML = isolatedFloor === null ? `<strong>All residential levels</strong><span>Drag to rotate · scroll to zoom · click a room</span>` : `<strong>Floor ${String(isolatedFloor + 1).padStart(2, '0')} isolated</strong><span>Click a coloured room to inspect its status</span>`;
}
const DEFAULT_CAMERA = { position: [31, 27, 35], target: [0, 10.5, 0] };
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
  const roofMaterial = isPod ? materials.podWhite : materials.roof;
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
    controls.minDistance = 14;
    controls.maxDistance = 48;
    controls.target.set(0, 10.5, 0);
    camera.position.set(31, 27, 35);
    controls.update();
    residential.group.visible = true;
    activeRoomMeshes = residential.roomMeshes;
  }
}

/* ── Pointer interaction ──────────────────────────────────────────────── */

const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (cityMode) {
    const cityHit = raycaster.intersectObjects(cityPickMeshes, false)[0];
    if (cityHit?.object.userData.hostel) window.dispatchEvent(new CustomEvent('nivas:open-friend-location', { detail: { hostel: cityHit.object.userData.hostel } }));
    return;
  }
  const hit = raycaster.intersectObjects(activeRoomMeshes.filter(mesh => mesh.visible), false)[0];
  if (!hit) return;
  const info = hit.object.userData; const labels = { unlisted: 'Unlisted', occupied: 'Registered', open: 'Open to swap', match: 'Match for you' };
  readout.innerHTML = `<strong>${info.hostel} · Room ${String(info.floor + 1).padStart(2, '0')}-${info.room}</strong><span>${labels[info.status]} · click another room to explore</span>`;
  activeRoomMeshes.forEach(mesh => mesh.material.emissiveIntensity = mesh === hit.object ? .9 : .17);
  if (info.visualRoomId) window.dispatchEvent(new CustomEvent('nivas:room-click', { detail: { id: info.visualRoomId } }));
});
canvas.addEventListener('pointermove', event => { const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const targets = cityMode ? cityPickMeshes : activeRoomMeshes.filter(mesh => mesh.visible); canvas.style.cursor = raycaster.intersectObjects(targets, false).length ? 'pointer' : 'grab'; });

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
