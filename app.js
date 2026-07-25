/* ============================================================================
   NIVAS — student-submitted room swap board

   The map deliberately knows nothing about official allocations or vacancies.
   A room is unlisted until a student creates a listing for that exact room.
   ========================================================================== */

const STORAGE_KEY = "nivas-swap-v1";
const LISTINGS_ENDPOINT = window.NIVAS_LISTINGS_ENDPOINT || "";
const FLOOR_COUNT = 9;
const ROOMS_PER_FLOOR = 30;
const DEMO_MODE = true;

const HOSTELS = [
  "Aryabhatta", "Bhabha", "Bhaskara", "Brahmagupta", "Charaka", "Kalam",
  "Kapila", "Kautilya", "Raman", "Ramanuja", "Ramanujan", "Sarabhai",
  "Susruta", "Varahamihira", "Viswesvaraya", "Vyasa"
];
const MAX_SELECTED_HOSTELS = 3;

const DEMO_LISTINGS = [
  ["901", true], ["902", true], ["904", true], ["906", true], ["908", true],
  ["912", true, true], ["915", true], ["918", true, true], ["920", true], ["922", true],
  ["924", false], ["925", false], ["926", false], ["928", false], ["930", false]
].map(([room, willingToMove, demoMatch], index) => ({
  id: `sample-bhabha-${room}`,
  hostel: "Bhabha",
  room,
  willingToMove,
  demoMatch: Boolean(demoMatch),
  preferences: willingToMove ? [{ hostel: ["Kalam", "Ramanujan", "Sarabhai"][index % 3], pod: (index % 4) + 1 }] : []
}));

/* ── Data source ─────────────────────────────────────────────────────────── */

const DataSource = {
  async load() {
    const data = {
      hostels: HOSTELS,
      podHostels: [],
      listings: DEMO_MODE ? DEMO_LISTINGS : []
    };
    if (!LISTINGS_ENDPOINT) return data;

    try {
      const response = await fetch(LISTINGS_ENDPOINT, { cache: "no-store" });
      if (!response.ok) throw new Error(`Listings request failed: ${response.status}`);
      const remote = await response.json();
      data.listings = Array.isArray(remote.listings) ? remote.listings.map(sanitiseListing).filter(Boolean) : [];
    } catch (error) {
      console.warn("Nivas could not refresh listings.", error);
    }
    return data;
  }
};

function sanitiseListing(entry) {
  if (!entry || !HOSTELS.includes(entry.hostel) || !normaliseRoom(entry.room)) return null;
  const preferences = Array.isArray(entry.preferences) ? entry.preferences
    .map(preference => ({
      hostel: HOSTELS.includes(preference?.hostel) ? preference.hostel : "",
      pod: [1, 2, 3, 4].includes(Number(preference?.pod)) ? Number(preference.pod) : null
    }))
    .filter(preference => preference.hostel) : [];
  return {
    id: String(entry.id || `${entry.hostel}-${entry.room}`),
    hostel: entry.hostel,
    room: normaliseRoom(entry.room),
    willingToMove: Boolean(entry.willingToMove),
    demoMatch: DEMO_MODE && Boolean(entry.demoMatch),
    preferences
  };
}

let db = { hostels: [], podHostels: [], listings: [] };

/* ── Room geometry ───────────────────────────────────────────────────────── */

/* The supplied plan repeats a radial residential pod. These polygons sit
   inside the drawn thick-wall room outlines—not over corridors or furniture.
   The plan’s circulation order is Pod 1 (upper-left), Pod 2 (lower-middle),
   Pod 3 (lower-right, six rooms), then Pod 4 (upper-middle). */
const podRoomPolygon = [
  [[140,128],[248,128],[248,242],[140,242]],
  [[250,128],[344,128],[344,235],[250,235]],
  [[440,245],[528,245],[528,318],[440,318]],
  [[440,325],[528,325],[528,398],[440,398]],
  [[258,445],[338,445],[338,540],[258,540]],
  [[348,445],[418,445],[418,540],[348,540]],
  [[140,253],[235,253],[235,335],[140,335]],
  [[140,345],[235,345],[235,425],[140,425]]
];
function roomPath(points, offsetX = 0, offsetY = 0) {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x + offsetX} ${y + offsetY}`).join(" ") + " Z";
}
const roomShapes = [
  ...podRoomPolygon.map(points => roomPath(points)),
  ...podRoomPolygon.map(points => roomPath(points, 330, 360)),
  // The lower-right pod has services in its east arm; only six outlined rooms.
  ...[0, 1, 4, 5, 6, 7].map(index => roomPath(podRoomPolygon[index], 1040, 360)),
  ...podRoomPolygon.map(points => roomPath(points, 710, 0))
];

/* ── Local state ─────────────────────────────────────────────────────────── */

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.profile) return { profile: sanitiseLocalProfile(saved.profile) };
  } catch { /* Start fresh when storage is missing or malformed. */ }
  return { profile: null };
}

function sanitiseLocalProfile(profile) {
  const listing = sanitiseListing(profile);
  if (!listing || !profile.name || !profile.email || !profile.phone) return null;
  return {
    ...listing,
    name: String(profile.name).trim(),
    email: String(profile.email).trim(),
    phone: String(profile.phone).trim()
  };
}

const state = loadState();
let selectedHostels = ["Bhabha", "Kalam", "Ramanujan"];
let focusIndex = 0;
let activeFloor = FLOOR_COUNT;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: state.profile }));
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function roomMeta(value) {
  const digits = String(value || "").trim().replace(/\D/g, "");
  if (!/^\d{3,4}$/.test(digits)) return null;
  const floor = Number(digits.length === 3 ? digits[0] : digits.slice(0, -2));
  const roomInFloor = Number(digits.slice(-2));
  if (floor < 1 || floor > FLOOR_COUNT || roomInFloor < 1 || roomInFloor > ROOMS_PER_FLOOR) return null;
  const pod = roomInFloor <= 8 ? 1 : roomInFloor <= 16 ? 2 : roomInFloor <= 22 ? 3 : 4;
  return { id: `${floor}${String(roomInFloor).padStart(2, "0")}`, floor, roomInFloor, pod };
}
function normaliseRoom(value) {
  return roomMeta(value)?.id || "";
}
function currentBuilding() { return selectedHostels[focusIndex] || selectedHostels[0]; }
function activeRoomShapes() { return roomShapes; }
function roomId(index) { return `${activeFloor}${String(index + 1).padStart(2, "0")}`; }
function initials(name) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function ownListing() { return state.profile ? sanitiseListing(state.profile) : null; }
function activeListings() {
  const own = ownListing();
  const remote = db.listings.filter(listing => !(own && listing.hostel === own.hostel && listing.room === own.room));
  return own ? [...remote, own] : remote;
}
function listingAt(hostel, room) { return activeListings().find(listing => listing.hostel === hostel && listing.room === room); }
function listingMatchesYou(listing) {
  const own = ownListing();
  if (!listing) return false;
  if (!own) return DEMO_MODE && listing.demoMatch;
  if (listing.hostel === own.hostel && listing.room === own.room || !listing.willingToMove) return false;
  const ownPod = roomMeta(own.room)?.pod;
  const listingPod = roomMeta(listing.room)?.pod;
  const theyWantUs = listing.preferences.some(preference => preference.hostel === own.hostel && (!preference.pod || preference.pod === ownPod));
  const weWantThem = own.preferences.some(preference => preference.hostel === listing.hostel && (!preference.pod || preference.pod === listingPod));
  return theyWantUs && weWantThem;
}
function statusAtFor(hostel, room) {
  const listing = listingAt(hostel, room);
  if (!listing) return "unlisted";
  if (listingMatchesYou(listing)) return "match";
  return listing.willingToMove ? "open" : "occupied";
}
function statusAt(room) { return statusAtFor(currentBuilding(), room); }
const BUILDING_PROFILE = {
  architecture: "REFERENCE-INFORMED 3D MODEL",
  meta: "4 labelled pods · 9 residential levels",
  credit: "Sample listings are shown for visual testing only.",
  roomCaption: "sample room listings in this hostel"
};

const STATUS_LABELS = {
  unlisted: "Unlisted",
  occupied: "Registered",
  open: "Open to swap",
  match: "Match for you"
};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.nivasToastTimer);
  window.nivasToastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function setModal(id, open) {
  document.getElementById(id).classList.toggle("hidden", !open);
  document.body.classList.toggle("modal-open", open);
}
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(modal => modal.classList.add("hidden"));
  document.body.classList.remove("modal-open");
}

/* ── Listing form ───────────────────────────────────────────────────────── */

function fillHostelSelect(select, includeBlank = false) {
  const selected = select.value;
  select.innerHTML = `${includeBlank ? '<option value="">Choose a hostel</option>' : ""}${db.hostels
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function fillPodSelect(select) {
  const selected = select.value;
  select.innerHTML = `<option value="">Any pod</option><option value="1">Pod 1 · rooms 01–08</option><option value="2">Pod 2 · rooms 09–16</option><option value="3">Pod 3 · rooms 17–22</option><option value="4">Pod 4 · rooms 23–30</option>`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function renderProfile() {
  updateSummary();
}
function setMoveDetails(visible) {
  const details = document.getElementById("move-details");
  details.classList.toggle("hidden", !visible);
  const firstChoice = details.querySelector('[name="preference1Hostel"]');
  firstChoice.required = visible;
}
function openProfile() {
  const form = document.getElementById("profile-form");
  form.querySelectorAll('select[name="hostel"]').forEach(select => fillHostelSelect(select));
  form.querySelectorAll('[name$="Hostel"]').forEach(select => {
    if (select.name !== "hostel") fillHostelSelect(select, true);
  });
  form.querySelectorAll('[name$="Pod"]').forEach(fillPodSelect);
  form.reset();
  if (state.profile) {
    const profile = state.profile;
    form.elements.name.value = profile.name;
    form.elements.email.value = profile.email;
    form.elements.phone.value = profile.phone;
    form.elements.hostel.value = profile.hostel;
    form.elements.room.value = profile.room;
    form.elements.willingToMove.value = profile.willingToMove ? "yes" : "no";
    profile.preferences.forEach((preference, index) => {
      form.elements[`preference${index + 1}Hostel`].value = preference.hostel;
      form.elements[`preference${index + 1}Pod`].value = preference.pod || "";
    });
  }
  setMoveDetails(form.elements.willingToMove.value === "yes");
  document.getElementById("profile-modal-title").textContent = state.profile ? "Update your listing" : "Create your listing";
  setModal("profile-modal", true);
}

/* ── Room views ─────────────────────────────────────────────────────────── */

function renderFloors() {
  const holder = document.getElementById("floor-buttons");
  holder.innerHTML = "";
  Array.from({ length: FLOOR_COUNT }, (_, index) => FLOOR_COUNT - index).forEach(floor => {
    const button = document.createElement("button");
    button.textContent = String(floor).padStart(2, "0");
    button.dataset.floor = floor;
    if (floor === activeFloor) button.classList.add("active");
    button.addEventListener("click", () => {
      activeFloor = floor;
      renderFloors(); renderRooms(); renderFloorHeading(); resetPanel();
    });
    holder.appendChild(button);
  });
}
function renderFloorHeading() {
  const names = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth"];
  const layout = "FOUR-POD RESIDENTIAL PLAN";
  document.getElementById("floor-label").textContent = `LEVEL ${String(activeFloor).padStart(2, "0")} · ${layout}`;
  document.getElementById("floor-title").innerHTML = `${names[activeFloor]} floor <span>·</span> ${escapeHtml(currentBuilding())}`;
}
function renderRooms() {
  const layer = document.getElementById("room-layer");
  const shapes = activeRoomShapes();
  layer.innerHTML = "";
  shapes.forEach((path, index) => {
    const id = roomId(index);
    const status = statusAt(id);
    const room = document.createElementNS("http://www.w3.org/2000/svg", "path");
    room.setAttribute("d", path);
    room.setAttribute("class", `room ${status}`);
    room.dataset.id = id;
    room.addEventListener("mouseenter", () => showToast(`Room ${id} · ${STATUS_LABELS[status]}`));
    room.addEventListener("click", () => openRoom(id, status, index, room));
    layer.appendChild(room);
  });
  updateSummary();
}
function resetPanel() {
  document.querySelector(".panel-empty").classList.remove("hidden");
  document.getElementById("panel-detail").classList.add("hidden");
  document.querySelectorAll(".selected-room").forEach(room => room.classList.remove("selected-room"));
}
function openRoom(id, status, index, element) {
  document.querySelectorAll(".selected-room").forEach(room => room.classList.remove("selected-room"));
  element.classList.add("selected-room");
  document.querySelector(".panel-empty").classList.add("hidden");
  const detail = document.getElementById("panel-detail");
  const listing = listingAt(currentBuilding(), id);
  const meta = roomMeta(id);
  const isOwnRoom = Boolean(state.profile && state.profile.hostel === currentBuilding() && state.profile.room === id);
  const preferenceText = listing?.willingToMove
    ? listing.preferences.map(preference => `${preference.hostel}${preference.pod ? ` · Pod ${preference.pod}` : ""}`).join(" · ")
    : "Not looking to move";
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="detail-top"><div><p>ROOM ${escapeHtml(id)}</p><h3>${escapeHtml(currentBuilding())}</h3></div><button class="icon-btn close-panel" aria-label="Close room details">×</button></div>
    <span class="pill pill--${status}">${STATUS_LABELS[status]}</span>
    <div class="resident-card"><div class="avatar avatar--lg avatar--private">${isOwnRoom ? initials(state.profile.name) : "••"}</div><div><strong>${isOwnRoom ? "Your listing" : listing ? "Student listing" : "No listing for this room"}</strong><small>${listing ? (listing.willingToMove ? "This student is open to a swap." : "Registered, not seeking a move.") : "Nivas has no published information for this room."}</small></div></div>
    <div class="detail-list">
      <div><span>Floor</span><strong>Level ${String(meta.floor).padStart(2, "0")}</strong></div>
      <div><span>Pod</span><strong>Pod ${meta.pod} · rooms ${meta.pod === 1 ? "01–08" : meta.pod === 2 ? "09–16" : meta.pod === 3 ? "17–22" : "23–30"}</strong></div>
      ${listing?.willingToMove ? `<div><span>Looking for</span><strong>${escapeHtml(preferenceText)}</strong></div>` : ""}
    </div>
    ${listing && !isOwnRoom && listing.willingToMove ? '<button class="btn btn--secondary btn--block" disabled>Contact requests arrive in Phase 3</button>' : ""}`;
  detail.querySelector(".close-panel").addEventListener("click", resetPanel);
}

function roomStatusMapFor(hostel) {
  return Object.fromEntries(activeListings().filter(listing => listing.hostel === hostel).map(listing => [listing.room, statusAtFor(hostel, listing.room)]));
}
function updateViewer() {
  const hostels = selectedHostels.map(hostel => {
    const here = activeListings().filter(listing => listing.hostel === hostel);
    return {
      name: hostel,
      roomStatuses: roomStatusMapFor(hostel),
      openCount: here.filter(listing => listing.willingToMove).length,
      matchCount: here.filter(listingMatchesYou).length
    };
  });
  window.dispatchEvent(new CustomEvent("nivas:building-change", { detail: { hostels, focusIndex } }));
}
function updateSummary() {
  const listings = activeListings();
  const here = listings.filter(listing => listing.hostel === currentBuilding());
  const openHere = here.filter(listing => listing.willingToMove);
  const matches = here.filter(listingMatchesYou);
  document.getElementById("rooms-count").textContent = here.length;
  document.getElementById("open-swap-count").textContent = openHere.length;
  document.getElementById("match-count").textContent = matches.length;
  document.getElementById("summary-open").textContent = openHere.length;
  document.getElementById("summary-open-copy").textContent = `rooms open to swap in ${currentBuilding()}`;
}

function openActivity(hostel = currentBuilding(), ownHostel = ownListing()?.hostel) {
  const listings = activeListings();
  const here = listings.filter(listing => listing.hostel === hostel);
  const openHere = here.filter(listing => listing.willingToMove);
  const seekingHere = listings.filter(listing => listing.preferences.some(preference => preference.hostel === hostel));
  const returnRoutes = ownHostel ? here.filter(listing => listing.willingToMove && listing.preferences.some(preference => preference.hostel === ownHostel)).length : 0;
  document.getElementById("activity-modal-title").textContent = hostel;
  document.getElementById("activity-stats").innerHTML = `
    <div><strong>${openHere.length}</strong><span>room listings open to swap here</span></div>
    <div><strong>${seekingHere.length}</strong><span>students have listed ${escapeHtml(hostel)} as a preference</span></div>
    ${ownHostel ? `<div><strong>${returnRoutes}</strong><span>open listings here that want ${escapeHtml(ownHostel)}</span></div>` : ""}`;
  setModal("activity-modal", true);
}

/* ── Building selection, views ───────────────────────────────────────────── */

function refreshBuilding() {
  const name = currentBuilding();
  document.getElementById("building-name").textContent = name;
  document.getElementById("building-count-label").textContent = selectedHostels.length > 1 ? `SELECTED HOSTELS (${selectedHostels.length})` : "SELECTED HOSTEL";
  document.getElementById("site-card-building").textContent = name;
  document.getElementById("three-building-label").textContent = `${name.toUpperCase()} · ${BUILDING_PROFILE.architecture}`;
  document.getElementById("three-building-meta").textContent = BUILDING_PROFILE.meta;
  document.getElementById("three-credit").textContent = BUILDING_PROFILE.credit;
  document.getElementById("rooms-caption").textContent = BUILDING_PROFILE.roomCaption;
  document.getElementById("facade-hotspot-name").textContent = name;
  renderBuildingMenu();
  renderRooms(); renderFloorHeading(); resetPanel(); updateViewer();
}
function toggleHostelSelection(name) {
  const index = selectedHostels.indexOf(name);
  if (index !== -1) {
    if (selectedHostels.length === 1) return showToast("Keep at least one hostel selected.");
    selectedHostels.splice(index, 1);
    if (focusIndex >= selectedHostels.length) focusIndex = selectedHostels.length - 1;
  } else {
    if (selectedHostels.length >= MAX_SELECTED_HOSTELS) return showToast(`Compare up to ${MAX_SELECTED_HOSTELS} hostels at once.`);
    selectedHostels.push(name);
    focusIndex = selectedHostels.length - 1;
  }
  refreshBuilding();
}
function renderBuildingMenu() {
  const menu = document.getElementById("building-menu");
  menu.innerHTML = db.hostels.map(name => {
    const selected = selectedHostels.includes(name);
    const disabled = !selected && selectedHostels.length >= MAX_SELECTED_HOSTELS;
    return `<button class="building-option ${selected ? "selected" : ""}" data-hostel="${escapeHtml(name)}" role="option" aria-selected="${selected}" ${disabled ? "disabled" : ""}>${escapeHtml(name)}</button>`;
  }).join("");
  menu.querySelectorAll(".building-option").forEach(option => option.addEventListener("click", () => toggleHostelSelection(option.dataset.hostel)));
}
function closeBuildingMenu() {
  document.getElementById("building-menu").classList.add("hidden");
  document.getElementById("building-choice").setAttribute("aria-expanded", "false");
}
function selectView(view) {
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("site-view").classList.toggle("hidden", view !== "site");
  document.getElementById("floor-view").classList.toggle("hidden", view !== "floor");
  document.getElementById("three-view").classList.toggle("hidden", view !== "3d");
  document.getElementById("map-view").classList.toggle("hidden", view !== "map");
  document.getElementById("visual-stage").classList.toggle("hidden", view === "3d");
  document.querySelector(".hero-model").classList.toggle("hidden", view !== "3d");
  if (view === "3d") requestAnimationFrame(() => window.nivasViewer?.resize());
}

/* ── Event wiring ───────────────────────────────────────────────────────── */

function bindEvents() {
  document.getElementById("hero-create-listing").addEventListener("click", openProfile);
  document.getElementById("profile-form").addEventListener("change", event => {
    if (event.target.name === "willingToMove") setMoveDetails(event.target.value === "yes");
    if (event.target.name === "preference1Hostel" && event.target.value) {
      const form = event.currentTarget;
      openActivity(event.target.value, form.elements.hostel.value);
    }
  });
  document.getElementById("profile-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget; const willingToMove = form.elements.willingToMove.value === "yes";
    const preferences = willingToMove ? [1, 2, 3].map(index => ({ hostel: form.elements[`preference${index}Hostel`].value, pod: Number(form.elements[`preference${index}Pod`].value) || null })).filter(preference => preference.hostel) : [];
    const profile = sanitiseLocalProfile({
      id: "local-profile", name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value,
      hostel: form.elements.hostel.value, room: form.elements.room.value, willingToMove, preferences
    });
    if (!profile) return showToast("Use a room number like 912 and complete every required field.");
    state.profile = profile; persist(); closeAllModals(); renderProfile(); renderRooms(); updateViewer();
    showToast("Your room listing has been updated.");
  });
  document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeAllModals));
  document.getElementById("activity-close").addEventListener("click", () => setModal("activity-modal", false));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
    if (button.dataset.tab === "listing") openProfile(); else selectView("3d");
  }));
  document.getElementById("prev-building").addEventListener("click", () => { focusIndex = (focusIndex - 1 + selectedHostels.length) % selectedHostels.length; refreshBuilding(); });
  document.getElementById("next-building").addEventListener("click", () => { focusIndex = (focusIndex + 1) % selectedHostels.length; refreshBuilding(); });
  document.getElementById("building-choice").addEventListener("click", () => {
    const menu = document.getElementById("building-menu"); const opening = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !opening); document.getElementById("building-choice").setAttribute("aria-expanded", String(opening));
  });
  document.getElementById("swap-activity").addEventListener("click", openActivity);
  document.getElementById("enter-building").addEventListener("click", () => selectView("floor"));
  document.getElementById("facade-hotspot").addEventListener("click", () => selectView("floor"));
  document.getElementById("map-open-viewer").addEventListener("click", () => selectView("3d"));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => selectView(button.dataset.view)));
  document.getElementById("zoom-button").addEventListener("click", () => document.getElementById("plan-wrap").classList.toggle("zoomed"));
  document.addEventListener("click", event => {
    if (!document.querySelector(".building-picker").contains(event.target)) closeBuildingMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeAllModals();
  });
  window.addEventListener("nivas:viewer-ready", updateViewer);
}

async function boot() {
  db = await DataSource.load();
  bindEvents(); renderFloors(); renderFloorHeading(); renderProfile(); refreshBuilding();
  selectView("3d");
  if (LISTINGS_ENDPOINT) setInterval(async () => { db = await DataSource.load(); renderRooms(); updateViewer(); }, 15000);
}

boot();
