/* ============================================================================
   NIVAS — application logic

   Everything the UI reads comes from `db`, which is populated once at boot by
   `DataSource.load()`.  That function is the ONLY place that knows where data
   comes from.  To connect real institute data later, rewrite `DataSource.load`
   to fetch from an authenticated endpoint and return the same shape — no other
   file needs to change.  See docs/PROGRESS.md § "Connecting real data".
   ========================================================================= */

const STORAGE_KEY = "nivas-local-demo-v3";
const MAX_FRIENDS = 8;

/* ── Data source ─────────────────────────────────────────────────────────── */

const DataSource = {
  /**
   * Returns { hostels, podHostels, directory, residents }.
   * TODO(real-data): replace the body with an authenticated fetch. Resident
   * visibility must be opt-in — return only fields each student consented to
   * share, and omit the resident entirely when they have not opted in.
   */
  async load() {
    return {
      hostels: [
        "Anandi Joshi", "Aryabhatta", "Bhabha", "Bhaskara", "Brahmagupta", "Charaka",
        "Gargi", "Kalam", "Kalpana Chawla", "Kapila", "Kautilya", "Maitreyi",
        "Raman", "Ramanuja", "Ramanujan", "S N Bose", "Sarabhai", "Sarojini Naidu",
        "Susruta", "Varahamihira", "Viswesvaraya", "Vivekananda", "Vyasa"
      ],
      // The older green-and-white shared-room blocks use the three-pod plan.
      podHostels: ["Vivekananda", "S N Bose"],
      directory: [
        { id: "nandini", name: "Nandini Rao",   initials: "NR", program: "B.Des · 3rd year",       hostel: "Bhabha",        room: "3-314", kind: "UG" },
        { id: "yash",    name: "Yash Mehta",    initials: "YM", program: "B.Tech · EE '27",        hostel: "Kalam",         room: "4-326", kind: "UG" },
        { id: "ira",     name: "Ira Sen",       initials: "IS", program: "M.Tech · AI",            hostel: "S N Bose",      room: "2-318", kind: "M.Tech" },
        { id: "vihaan",  name: "Vihaan Kumar",  initials: "VK", program: "B.Tech · ME '28",        hostel: "Vivekananda",   room: "1-312", kind: "UG" },
        { id: "mira",    name: "Mira Sethi",    initials: "MS", program: "PhD · Design",           hostel: "Sarabhai",      room: "5-338", kind: "PhD" },
        { id: "rohan",   name: "Rohan Dutta",   initials: "RD", program: "M.Tech · CSE",           hostel: "Ramanujan",     room: "3-306", kind: "M.Tech" },
        { id: "zoya",    name: "Zoya Khan",     initials: "ZK", program: "B.Tech · Civil '27",     hostel: "Aryabhatta",    room: "4-324", kind: "UG" },
        { id: "aditya",  name: "Aditya Nair",   initials: "AN", program: "PhD · Physics",          hostel: "Raman",         room: "2-344", kind: "PhD" },
        { id: "kavya",   name: "Kavya Iyer",    initials: "KI", program: "B.Tech · Chemical '28",  hostel: "Maitreyi",      room: "3-316", kind: "UG" },
        { id: "aarav",   name: "Aarav Kapoor",  initials: "AK", program: "M.Des · 2nd year",       hostel: "Gargi",         room: "5-330", kind: "M.Des" },
        { id: "reva",    name: "Reva Thomas",   initials: "RT", program: "M.Tech · Mechanical",    hostel: "Viswesvaraya",  room: "4-320", kind: "M.Tech" },
        { id: "samar",   name: "Samar Verma",   initials: "SV", program: "B.Tech · CSE '27",       hostel: "Brahmagupta",   room: "2-310", kind: "UG" }
      ],
      residents: {
        "3-312": { name: "Arjun Chandra", initials: "AC", program: "B.Tech · CSE '28" },
        "3-314": { name: "Nandini Rao",   initials: "NR", program: "B.Des · 3rd year" },
        "3-322": { name: "Yash Mehta",    initials: "YM", program: "B.Tech · EE '27" },
        "3-338": { name: "Ira Sen",       initials: "IS", program: "M.Tech · AI" },
        "3-356": { name: "Vihaan Kumar",  initials: "VK", program: "B.Tech · ME '28" },
        "3-362": { name: "Mira Sethi",    initials: "MS", program: "M.Des · 2nd year" }
      }
    };
  },

  /**
   * Demonstration occupancy. Deterministic so the map does not flicker between
   * renders. TODO(real-data): replace with the real allocation record.
   */
  statusFor(index, roomId, floor, person) {
    if (person?.kind === "M.Tech" || person?.program?.startsWith("M.Tech")) return "mtech";
    if (person?.kind === "PhD" || person?.kind === "M.Des" || person?.program?.startsWith("M.Des")) return "graduate";
    if (index % 11 === 0 || (floor === 5 && index % 7 === 0)) return "empty";
    if (index === 9 || index === 26) return "intern";
    return "occupied";
  }
};

let db = { hostels: [], podHostels: [], directory: [], residents: {} };

/* ── Room geometry (matches the supplied architectural drawings) ─────────── */

const roomPositions = [
  [180,185],[235,185],[290,185],[345,185],[400,185],[180,254],[180,312],[180,370],[241,424],[301,424],[361,424],
  [500,570],[557,570],[614,570],[671,570],[727,570],[500,640],[500,699],[500,758],[559,813],[619,813],[679,813],
  [1115,435],[1171,435],[1227,435],[1283,435],[1339,435],[1115,504],[1115,562],[1115,620],[1175,677],[1235,677],[1295,677],
  [1455,656],[1511,656],[1567,656],[1623,656],[1455,725],[1455,783],[1515,840],[1575,840]
];
const podRoomPositions = [
  [240,430],[300,430],[360,430],[420,430],[240,520],[300,520],[360,520],[420,520],
  [750,430],[810,430],[870,430],[930,430],[750,520],[810,520],[870,520],[930,520],
  [1260,430],[1320,430],[1380,430],[1440,430],[1260,520],[1320,520],[1380,520],[1440,520]
];

/* ── Local state ─────────────────────────────────────────────────────────── */

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.friendIds)) {
      return {
        profile: saved.profile || null,
        friendIds: saved.friendIds.slice(0, MAX_FRIENDS),
        requests: Array.isArray(saved.requests) ? saved.requests : [],
        seeded: Boolean(saved.seeded),
        friendMode: false
      };
    }
  } catch { /* Start fresh if an old or malformed demo record exists. */ }
  return { profile: null, friendIds: [], requests: [], seeded: false, friendMode: false };
}

const state = loadState();
let buildingIndex = 2;
let activeFloor = 3;
let requestRecipient = null;
let requestTab = "received";

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    profile: state.profile,
    friendIds: state.friendIds,
    requests: state.requests,
    seeded: state.seeded
  }));
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function currentBuilding() { return db.hostels[buildingIndex]; }
function isPodHostel() { return db.podHostels.includes(currentBuilding()); }
function activeRoomPositions() { return isPodHostel() ? podRoomPositions : roomPositions; }
function roomId(index) { return `${activeFloor}-${String(302 + index * 2).padStart(3, "0")}`; }
function initials(name) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function selectedFriends() { return db.directory.filter(person => state.friendIds.includes(person.id)); }
function personById(id) { return db.directory.find(person => person.id === id); }
function friendAt(id) {
  return selectedFriends().find(person => person.hostel === currentBuilding() && person.room === id);
}
function memberAtCurrentRoom(id) { return friendAt(id) || db.residents[id]; }
function statusAt(index, id) {
  return DataSource.statusFor(index, id, activeFloor, memberAtCurrentRoom(id));
}
function buildingProfile() {
  return isPodHostel()
    ? {
        architecture: "THREE-POD GREEN + WHITE MODEL",
        meta: "3 connected pods per level · 6 residential levels",
        credit: "Green-and-white, three-pod massing for the older shared-room hostels · two students per room.",
        roomType: "Double sharing · 2 students",
        sectionName: "pod",
        roomCaption: "double-sharing rooms · 2 beds each"
      }
    : {
        architecture: "REFERENCE-INFORMED 3D MODEL",
        meta: "Paired leaf clusters · 6 residential levels",
        credit: "Based on the connected leaf-cluster, horizontal-band and rust-red louvre language of the IITH student housing reference.",
        roomType: "Single occupancy",
        sectionName: "atrium",
        roomCaption: "rooms in this building"
      };
}

const STATUS_LABELS = {
  occupied: "Occupied",
  empty: "Vacant",
  intern: "Intern reserve",
  mtech: "M.Tech resident",
  graduate: "Graduate researcher"
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

/* ── Profile ─────────────────────────────────────────────────────────────── */

function renderProfile() {
  const profile = state.profile;
  document.getElementById("profile-avatar").textContent = profile ? initials(profile.name) : "+";
  document.getElementById("profile-name").textContent = profile ? profile.name : "Register your stay";
  document.getElementById("profile-location").textContent = profile ? `${profile.hostel} · ${profile.room}` : "Name, roll number & room";
  document.getElementById("profile-menu").setAttribute("aria-label", profile ? "Edit profile" : "Register profile");
  document.getElementById("friend-nav-count").textContent = state.friendIds.length;
  document.getElementById("friends-count").textContent = state.friendIds.length;
  document.getElementById("friends-caption").textContent = state.friendIds.length === 1 ? "selected friend" : "selected friends";

  const toggle = document.getElementById("friend-mode-toggle");
  toggle.classList.toggle("active", state.friendMode);
  toggle.innerHTML = state.friendMode ? "<span>◉</span> Exit friends map" : "<span>♙</span> Friends map";
  renderRequestBadge();
}
function openProfile() {
  const form = document.getElementById("profile-form");
  form.elements.hostel.innerHTML = db.hostels
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (state.profile) {
    form.elements.name.value = state.profile.name;
    form.elements.roll.value = state.profile.roll;
    form.elements.hostel.value = state.profile.hostel;
    form.elements.room.value = state.profile.room;
  } else form.reset();
  document.getElementById("profile-modal-title").textContent = state.profile ? "Update your stay" : "Register your stay";
  setModal("profile-modal", true);
}

/* ── Friends ─────────────────────────────────────────────────────────────── */

function renderFriendDirectory() {
  const selected = new Set(state.friendIds);
  const list = document.getElementById("friend-directory");
  list.innerHTML = db.directory.map(person => {
    const checked = selected.has(person.id);
    const canRequest = person.kind === "M.Tech" || person.kind === "PhD";
    return `<article class="friend-card ${checked ? "selected" : ""}">
      <button class="friend-select" data-friend-id="${person.id}" aria-pressed="${checked}">
        <span class="avatar">${escapeHtml(person.initials)}</span>
        <span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.program)}</small><em>${escapeHtml(person.hostel)} · ${escapeHtml(person.room)}</em></span>
        <i>${checked ? "✓" : "+"}</i>
      </button>
      ${canRequest ? `<button class="transfer-link" data-request-id="${person.id}">Request swap / shift</button>` : ""}
    </article>`;
  }).join("");
  document.getElementById("friend-selection-count").textContent = `${state.friendIds.length} / ${MAX_FRIENDS} selected`;
  list.querySelectorAll(".friend-select").forEach(button =>
    button.addEventListener("click", () => toggleFriend(button.dataset.friendId)));
  list.querySelectorAll(".transfer-link").forEach(button =>
    button.addEventListener("click", () => openRequest(button.dataset.requestId)));
}
function openFriends() {
  renderFriendDirectory();
  setModal("friends-modal", true);
}
function toggleFriend(id) {
  if (state.friendIds.includes(id)) {
    state.friendIds = state.friendIds.filter(friendId => friendId !== id);
  } else if (state.friendIds.length >= MAX_FRIENDS) {
    return showToast(`You can select up to ${MAX_FRIENDS} friends.`);
  } else {
    state.friendIds.push(id);
  }
  persist();
  renderProfile();
  renderFriendDirectory();
  renderRooms();
  if (state.friendMode) syncFriendMode();
}

/* ── Requests ────────────────────────────────────────────────────────────── */

/* A request is { id, personId, direction, message, status, createdAt }.
   `direction` is from the current user's point of view. Delivery is NOT wired:
   nothing leaves this device. The requests modal says so explicitly. */

function seedDemoRequests() {
  if (state.seeded) return;
  state.seeded = true;
  state.requests.push(
    {
      id: `seed-${Date.now()}-1`,
      personId: "rohan",
      direction: "received",
      message: "Hi! I'm on the third floor of Ramanujan and looking to move closer to the labs. Would you consider a swap this semester?",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 60 * 26
    },
    {
      id: `seed-${Date.now()}-2`,
      personId: "mira",
      direction: "received",
      message: "Looking for a quieter wing for thesis writing — happy to discuss a shift if your room is on a low-traffic corridor.",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 60 * 74
    }
  );
  persist();
}

function pendingReceivedCount() {
  return state.requests.filter(request => request.direction === "received" && request.status === "pending").length;
}
function renderRequestBadge() {
  document.getElementById("request-nav-count").textContent = pendingReceivedCount();
}
function relativeTime(timestamp) {
  const hours = Math.round((Date.now() - timestamp) / 36e5);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
function renderRequests() {
  const list = document.getElementById("request-list");
  const rows = state.requests
    .filter(request => request.direction === requestTab)
    .sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById("request-summary").textContent = `${pendingReceivedCount()} pending`;
  document.querySelectorAll("[data-request-tab]").forEach(button =>
    button.classList.toggle("active", button.dataset.requestTab === requestTab));

  if (!rows.length) {
    list.innerHTML = `<div class="request-empty">No ${requestTab} requests yet.</div>`;
    return;
  }

  list.innerHTML = rows.map(request => {
    const person = personById(request.personId);
    const name = person ? person.name : "Unknown resident";
    const where = person ? `${person.hostel} · ${person.room}` : "—";
    const actions = request.direction === "received" && request.status === "pending"
      ? `<div class="request-actions">
           <button class="btn btn--primary" data-request-accept="${request.id}">Accept</button>
           <button class="btn btn--secondary" data-request-decline="${request.id}">Decline</button>
         </div>`
      : "";
    return `<article class="request-row">
      <span class="avatar">${escapeHtml(person ? person.initials : "??")}</span>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <span class="request-meta">${escapeHtml(where)} · ${relativeTime(request.createdAt)}</span>
        <p>${escapeHtml(request.message)}</p>
        ${actions}
      </div>
      <span class="pill pill--${request.status}">${request.status[0].toUpperCase()}${request.status.slice(1)}</span>
    </article>`;
  }).join("");

  list.querySelectorAll("[data-request-accept]").forEach(button =>
    button.addEventListener("click", () => setRequestStatus(button.dataset.requestAccept, "accepted")));
  list.querySelectorAll("[data-request-decline]").forEach(button =>
    button.addEventListener("click", () => setRequestStatus(button.dataset.requestDecline, "declined")));
}
function setRequestStatus(id, status) {
  const request = state.requests.find(entry => entry.id === id);
  if (!request) return;
  request.status = status;
  persist();
  renderRequests();
  renderRequestBadge();
  showToast(`Request ${status}. Saved on this device only.`);
}
function openRequests() {
  renderRequests();
  setModal("requests-modal", true);
}
function openRequest(id) {
  requestRecipient = personById(id);
  if (!requestRecipient) return;
  document.getElementById("request-recipient").textContent = `${requestRecipient.name} · ${requestRecipient.program}`;
  document.getElementById("request-message").value =
    `Hi ${requestRecipient.name.split(" ")[0]}, I am looking to discuss a room swap / shift. Would you be open to chatting?`;
  closeAllModals();
  setModal("request-modal", true);
}

/* ── Friends map (3D city) ───────────────────────────────────────────────── */

function syncFriendMode() {
  const friends = selectedFriends();
  document.body.classList.toggle("friends-mode", state.friendMode);
  document.getElementById("three-view").classList.toggle("friend-city", state.friendMode);
  document.getElementById("friend-city-hud").classList.toggle("hidden", !state.friendMode);
  document.getElementById("friend-city-count").textContent = friends.length;
  document.getElementById("friend-city-hostels").textContent = new Set(friends.map(friend => friend.hostel)).size;
  document.getElementById("friend-city-list").innerHTML = friends.map(friend =>
    `<li><i class="${friend.kind === "PhD" ? "phd" : friend.kind === "M.Tech" ? "mtech" : "ug"}"></i>${escapeHtml(friend.name.split(" ")[0])} · ${escapeHtml(friend.hostel)} <b>${escapeHtml(friend.room)}</b></li>`).join("");

  if (state.friendMode) {
    selectView("3d");
    document.getElementById("three-building-label").textContent = "FRIENDS MAP · IITH HOSTEL CITY";
    document.getElementById("three-building-meta").textContent =
      `${friends.length} selected people · rooms only light up where your friends stay`;
    document.getElementById("three-credit").textContent =
      "Orbit across the city · click a lit hostel to enter that friend’s building.";
  } else {
    setBuilding(buildingIndex, { preserveView: true });
  }
  window.nivasViewer?.setFriendMode(state.friendMode ? friends : null);
  renderProfile();
}
function toggleFriendMode() {
  if (!state.profile) {
    showToast("Register your stay before using Friends map.");
    return openProfile();
  }
  if (!state.friendIds.length) {
    showToast("Select at least one friend first.");
    return openFriends();
  }
  state.friendMode = !state.friendMode;
  syncFriendMode();
}

/* ── Floor plan ──────────────────────────────────────────────────────────── */

function renderFloors() {
  const holder = document.getElementById("floor-buttons");
  holder.innerHTML = "";
  [6, 5, 4, 3, 2, 1].forEach(floor => {
    const button = document.createElement("button");
    button.textContent = String(floor).padStart(2, "0");
    button.dataset.floor = floor;
    if (floor === activeFloor) button.classList.add("active");
    button.addEventListener("click", () => {
      activeFloor = floor;
      renderFloors();
      renderRooms();
      renderFloorHeading();
      resetPanel();
    });
    holder.appendChild(button);
  });
}
function renderFloorHeading() {
  const names = ["Ground", "First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
  const layout = isPodHostel() ? "THREE-POD SHARED PLAN" : "TYPICAL RESIDENTIAL PLAN";
  document.getElementById("floor-label").textContent = `LEVEL ${String(activeFloor).padStart(2, "0")} · ${layout}`;
  document.getElementById("floor-title").innerHTML = `${names[activeFloor]} floor <span>·</span> ${escapeHtml(currentBuilding())}`;
}
function renderRooms() {
  const layer = document.getElementById("room-layer");
  const positions = activeRoomPositions();
  let vacant = 0;
  layer.innerHTML = "";

  positions.forEach(([x, y], index) => {
    const id = roomId(index);
    const status = statusAt(index, id);
    if (status === "empty") vacant += 1;
    const friend = friendAt(id);

    const room = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    room.setAttribute("x", x);
    room.setAttribute("y", y);
    room.setAttribute("width", 46);
    room.setAttribute("height", 38);
    room.setAttribute("rx", 5);
    room.setAttribute("class", `room ${status} ${friend ? "selected-friend-room" : ""}`);
    room.dataset.id = id;
    room.addEventListener("mouseenter", () =>
      showToast(`Room ${id} · ${friend?.name || memberAtCurrentRoom(id)?.name || STATUS_LABELS[status]}`));
    room.addEventListener("click", () => openRoom(id, status, index, room));
    layer.appendChild(room);

    if (index % 2 === 0 || friend) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x + 23);
      label.setAttribute("y", y + 24);
      label.setAttribute("class", "room-label");
      label.textContent = id.slice(-3);
      layer.appendChild(label);
    }
  });

  document.getElementById("rooms-count").textContent = positions.length * 6;
  document.getElementById("available-count").textContent = vacant;
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
  detail.classList.remove("hidden");

  const friend = friendAt(id);
  const member = friend || db.residents[id];
  const profile = buildingProfile();
  const canRequest = friend && ["M.Tech", "PhD"].includes(friend.kind);
  const sectionNames = isPodHostel() ? ["North", "Central", "South"] : ["A", "B", "C", "D"];
  const section = sectionNames[Math.floor(index / (isPodHostel() ? 8 : 11)) % sectionNames.length];

  const occupant = member
    ? `<div class="resident-card">
         <div class="avatar avatar--lg">${escapeHtml(member.initials || initials(member.name))}</div>
         <div><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.program)}</small></div>
       </div>`
    : `<div class="resident-card">
         <div class="avatar avatar--lg avatar--private">••</div>
         <div><strong>Resident details private</strong><small>Only visible to connections</small></div>
       </div>`;

  detail.innerHTML = `
    <div class="detail-top">
      <div><p>ROOM ${escapeHtml(id)}</p><h3>${escapeHtml(currentBuilding())}</h3></div>
      <button class="icon-btn close-panel" aria-label="Close room details">×</button>
    </div>
    <span class="pill pill--${status === "empty" ? "vacant" : status}">${STATUS_LABELS[status]}</span>
    ${occupant}
    <div class="detail-list">
      <div><span>Floor</span><strong>Level ${String(activeFloor).padStart(2, "0")}</strong></div>
      <div><span>${isPodHostel() ? "Pod" : "Wing"}</span><strong>${section} ${profile.sectionName}</strong></div>
      <div><span>Room type</span><strong>${profile.roomType}</strong></div>
    </div>
    ${canRequest
      ? `<button class="btn btn--primary btn--block request-person" data-request-id="${friend.id}">Request swap / shift</button>`
      : `<button class="btn btn--secondary btn--block">${friend ? "View connection" : "Request room details"}</button>`}`;

  detail.querySelector(".close-panel").addEventListener("click", resetPanel);
  detail.querySelector(".request-person")?.addEventListener("click", () => openRequest(friend.id));
}

/* ── Building selection & views ──────────────────────────────────────────── */

function setBuilding(index, options = {}) {
  buildingIndex = (index + db.hostels.length) % db.hostels.length;
  const name = currentBuilding();
  const profile = buildingProfile();

  document.getElementById("building-name").textContent = name;
  document.getElementById("site-card-building").textContent = name;
  document.getElementById("crumb-building").textContent = name;
  document.getElementById("three-building-label").textContent = `${name.toUpperCase()} · ${profile.architecture}`;
  document.getElementById("three-building-meta").textContent = profile.meta;
  document.getElementById("three-credit").textContent = profile.credit;
  document.getElementById("rooms-caption").textContent = profile.roomCaption;
  document.getElementById("facade-hotspot-name").textContent = name;
  document.getElementById("plan-wrap").classList.toggle("pod-layout", isPodHostel());

  document.querySelectorAll(".building-option").forEach(option => {
    const selected = Number(option.dataset.buildingIndex) === buildingIndex;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });

  window.dispatchEvent(new CustomEvent("nivas:building-change", { detail: { name, podLayout: isPodHostel() } }));
  renderRooms();
  renderFloorHeading();
  resetPanel();
  if (!options.preserveView && state.friendMode) syncFriendMode();
}
function renderBuildingMenu() {
  const menu = document.getElementById("building-menu");
  menu.innerHTML = db.hostels.map((name, index) =>
    `<button class="building-option ${index === buildingIndex ? "selected" : ""}" data-building-index="${index}" role="option" aria-selected="${index === buildingIndex}">${escapeHtml(name)}</button>`).join("");
  menu.querySelectorAll(".building-option").forEach(option =>
    option.addEventListener("click", () => {
      setBuilding(Number(option.dataset.buildingIndex));
      closeBuildingMenu();
      showToast(`Selected ${option.textContent}`);
    }));
}
function closeBuildingMenu() {
  document.getElementById("building-menu").classList.add("hidden");
  document.getElementById("building-choice").setAttribute("aria-expanded", "false");
}
function selectView(view) {
  document.querySelectorAll("[data-view]").forEach(button =>
    button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("site-view").classList.toggle("hidden", view !== "site");
  document.getElementById("floor-view").classList.toggle("hidden", view !== "floor");
  document.getElementById("three-view").classList.toggle("hidden", view !== "3d");
  document.getElementById("map-view").classList.toggle("hidden", view !== "map");
  if (view === "3d") requestAnimationFrame(() => window.nivasViewer?.resize());
}

/* ── Search ──────────────────────────────────────────────────────────────── */

function searchCandidates(query) {
  const profileEntry = state.profile
    ? [{ type: "person", id: "profile", name: state.profile.name, program: `You · ${state.profile.roll}`,
         hostel: state.profile.hostel, room: state.profile.room, initials: initials(state.profile.name) }]
    : [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = value => terms.every(term => value.includes(term));
  const people = [...profileEntry, ...db.directory].filter(person =>
    matches(`${person.name} ${person.program} ${person.hostel} ${person.room}`.toLowerCase()));
  const hostels = db.hostels.filter(name => matches(name.toLowerCase())).map(name => ({ type: "hostel", name }));
  return [...people, ...hostels].slice(0, 7);
}
function hideSearchResults() { document.getElementById("search-results").classList.add("hidden"); }
function openSearchResult(result) {
  const input = document.getElementById("friend-search");
  if (state.friendMode) { state.friendMode = false; syncFriendMode(); }

  if (result.type === "hostel") {
    setBuilding(db.hostels.indexOf(result.name), { preserveView: true });
    selectView("3d");
    input.value = result.name;
    return showToast(`Opened ${result.name}`);
  }

  activeFloor = Number(String(result.room).split("-")[0]) || 1;
  setBuilding(db.hostels.indexOf(result.hostel), { preserveView: true });
  renderFloors();
  renderRooms();
  renderFloorHeading();
  selectView("floor");

  const roomIndex = activeRoomPositions().findIndex((_, index) => roomId(index) === result.room);
  const room = document.querySelector(`[data-id='${result.room}']`);
  if (room && roomIndex >= 0) openRoom(result.room, statusAt(roomIndex, result.room), roomIndex, room);
  input.value = result.name;
  showToast(`${result.name} · ${result.hostel} · ${result.room}`);
}
function renderSearchResults(query) {
  const results = document.getElementById("search-results");
  if (query.length < 2) return hideSearchResults();

  const candidates = searchCandidates(query);
  results.innerHTML = candidates.length
    ? candidates.map((candidate, index) => candidate.type === "hostel"
        ? `<button class="search-result" data-search-index="${index}" role="option"><i class="search-result-icon hostel">⌂</i><span><strong>${escapeHtml(candidate.name)}</strong><small>Hostel building</small></span></button>`
        : `<button class="search-result" data-search-index="${index}" role="option"><i class="search-result-icon">${escapeHtml(candidate.initials || initials(candidate.name))}</i><span><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.hostel)} · ${escapeHtml(candidate.room)} · ${escapeHtml(candidate.program)}</small></span></button>`
      ).join("")
    : `<div class="search-empty">No resident or hostel matches “${escapeHtml(query)}”.</div>`;
  results.classList.remove("hidden");
  results.querySelectorAll("[data-search-index]").forEach(button =>
    button.addEventListener("click", () => openSearchResult(candidates[Number(button.dataset.searchIndex)])));
}

/* ── Wiring ──────────────────────────────────────────────────────────────── */

function bindEvents() {
  document.getElementById("profile-menu").addEventListener("click", event => {
    event.stopPropagation();
    openProfile();
  });
  document.getElementById("resident-mini").addEventListener("click", openProfile);

  document.getElementById("profile-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    state.profile = {
      name: form.elements.name.value.trim(),
      roll: form.elements.roll.value.trim().toUpperCase(),
      hostel: form.elements.hostel.value,
      room: form.elements.room.value.trim().toUpperCase()
    };
    persist();
    renderProfile();
    closeAllModals();
    showToast("Your stay is registered on this device.");
  });

  document.getElementById("request-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!requestRecipient) return;
    state.requests.push({
      id: `req-${Date.now()}`,
      personId: requestRecipient.id,
      direction: "sent",
      message: event.currentTarget.elements.message.value.trim(),
      status: "pending",
      createdAt: Date.now()
    });
    persist();
    closeAllModals();
    renderRequestBadge();
    showToast(`Request saved for ${requestRecipient.name}. Not delivered yet.`);
  });

  document.querySelectorAll("[data-close-modal]").forEach(button =>
    button.addEventListener("click", closeAllModals));
  document.querySelectorAll("[data-request-tab]").forEach(button =>
    button.addEventListener("click", () => { requestTab = button.dataset.requestTab; renderRequests(); }));

  document.getElementById("friend-mode-toggle").addEventListener("click", toggleFriendMode);
  document.getElementById("friends-map-from-list").addEventListener("click", () => {
    if (!state.friendIds.length) return showToast("Select at least one friend first.");
    if (!state.profile) {
      closeAllModals();
      openProfile();
      return showToast("Register your stay before opening Friends map.");
    }
    closeAllModals();
    state.friendMode = true;
    syncFriendMode();
  });

  document.querySelectorAll("[data-tab]").forEach(button =>
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("active", item === button));
      const tab = button.dataset.tab;
      if (tab === "friends") openFriends();
      else if (tab === "requests") openRequests();
      else if (tab === "explore") selectView("3d");
      else showToast("This section is ready for the next data connection.");
    }));

  document.getElementById("prev-building").addEventListener("click", () => setBuilding(buildingIndex - 1));
  document.getElementById("next-building").addEventListener("click", () => setBuilding(buildingIndex + 1));
  document.getElementById("building-choice").addEventListener("click", () => {
    const menu = document.getElementById("building-menu");
    const opening = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !opening);
    document.getElementById("building-choice").setAttribute("aria-expanded", String(opening));
  });

  document.getElementById("enter-building").addEventListener("click", () => selectView("floor"));
  document.getElementById("facade-hotspot").addEventListener("click", () => selectView("floor"));
  document.getElementById("map-open-viewer").addEventListener("click", () => selectView("3d"));
  document.querySelectorAll("[data-view]").forEach(button =>
    button.addEventListener("click", () => selectView(button.dataset.view)));
  document.getElementById("legend-toggle").addEventListener("click", () =>
    document.getElementById("legend").classList.toggle("hidden"));
  document.getElementById("zoom-button").addEventListener("click", () =>
    document.getElementById("plan-wrap").classList.toggle("zoomed"));

  document.getElementById("friend-search").addEventListener("input", event =>
    renderSearchResults(event.target.value.trim()));
  document.getElementById("friend-search").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    const first = document.querySelector("[data-search-index]");
    if (first) { event.preventDefault(); first.click(); }
  });

  document.addEventListener("click", event => {
    if (!document.querySelector(".building-picker").contains(event.target)) closeBuildingMenu();
    if (!document.querySelector(".search").contains(event.target)) hideSearchResults();
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("friend-search").focus();
    }
    if (event.key === "Escape") { closeAllModals(); hideSearchResults(); }
  });

  window.addEventListener("nivas:open-friend-location", event => {
    const person = db.directory.find(friend => friend.hostel === event.detail?.hostel);
    if (!person) return;
    state.friendMode = false;
    syncFriendMode();
    setBuilding(db.hostels.indexOf(person.hostel));
    selectView("3d");
    showToast(`Opened ${person.hostel} · ${person.name}`);
  });
}

/* ── Boot ────────────────────────────────────────────────────────────────── */

async function boot() {
  db = await DataSource.load();
  seedDemoRequests();
  bindEvents();
  renderBuildingMenu();
  renderFloors();
  renderFloorHeading();
  renderRooms();
  renderProfile();
  setBuilding(buildingIndex, { preserveView: true });
}

boot();
