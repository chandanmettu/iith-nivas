/* ============================================================================
   NIVAS — student-submitted room swap board

   The map deliberately knows nothing about official allocations or vacancies.
   A room is unlisted until a student creates a listing for that exact room.
   ========================================================================== */

const STORAGE_KEY = "nivas-swap-v1";

/* The shared board. Point this at the PHP API (see api/ and docs/DEPLOY.md).
   Empty string = offline mode: the app still works, but a listing is only ever
   visible on the device that created it. */
const API_BASE = window.NIVAS_API_BASE ?? "./api";

/* Fallback for feature requests when the API is unreachable — the API itself
   reads the real address from the gitignored api/config.php. Don't commit a
   real address here; override with window.NIVAS_FEEDBACK_TO in your own
   deployed index.html if you want the offline mailto: fallback to work too. */
const FEEDBACK_TO = window.NIVAS_FEEDBACK_TO ?? "feedback@example.com";
const FLOOR_COUNT = 10;
const ROOMS_PER_FLOOR = 30;   /* pods of 8 / 8 / 6 / 8 — see roomShapes */
/* Pods are 8 / 8 / 6 / 8, so room -> pod can't be arithmetic. */
const POD_SIZES = [8, 8, 6, 8];
const POD_OF_ROOM = POD_SIZES.flatMap((size, index) => Array(size).fill(index + 1));
/* MUST stay false in anything a student can reach: these are invented rooms
   and would be indistinguishable from real listings. */
const DEMO_MODE = false;

const HOSTELS = [
  "Aryabhatta", "Bhabha", "Bhaskara", "Brahmagupta", "Charaka", "Kalam",
  "Kapila", "Kautilya", "Raman", "Ramanujan", "Sarabhai",
  "Susruta", "Varahamihira", "Viswesvaraya", "Vyasa"
];

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

/* ── API ─────────────────────────────────────────────────────────────────
   Every network call goes through here. Each one degrades to offline rather
   than throwing at the UI: a dead API must never make the map unusable. */

async function api(path, body) {
  if (!API_BASE) throw new Error("offline");
  const response = await fetch(`${API_BASE}/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const DataSource = {
  async load() {
    const data = {
      hostels: HOSTELS,
      podHostels: [],
      listings: DEMO_MODE ? DEMO_LISTINGS : [],
      bookmarkCounts: {},
      bookmarkWaitlist: {}
    };
    if (!API_BASE) return data;
    try {
      const remote = await api("listings.php");
      data.listings = Array.isArray(remote.listings)
        ? remote.listings.map(sanitiseListing).filter(Boolean) : [];
      data.bookmarkCounts = remote.bookmarkCounts || {};
      state.online = true;
    } catch (error) {
      console.warn("Nivas could not reach the board.", error);
      state.online = false;
      /* Keep showing the student their own listing so the page isn't a lie. */
      if (state.profile) data.listings = [state.profile];
    }
    return data;
  }
};

function sanitiseListing(entry) {
  if (!entry || !HOSTELS.includes(entry.hostel) || !normaliseRoom(entry.room)) return null;
  const preferences = Array.isArray(entry.preferences) ? entry.preferences
    .map(preference => ({
      hostel: HOSTELS.includes(preference?.hostel) ? preference.hostel : "",
      pod: [1, 2, 3, 4].includes(Number(preference?.pod)) ? Number(preference.pod) : null,
      floor: Number.isInteger(Number(preference?.floor)) && Number(preference?.floor) >= 1 && Number(preference?.floor) <= FLOOR_COUNT
        ? Number(preference.floor) : null
    }))
    .filter(preference => preference.hostel) : [];
  /* Contact is present only when that student ticked the consent box; the API
     omits it otherwise, and we never invent it. */
  const shareContact = Boolean(entry.shareContact);
  return {
    id: String(entry.id || `${entry.hostel}-${entry.room}`),
    hostel: entry.hostel,
    room: normaliseRoom(entry.room),
    willingToMove: Boolean(entry.willingToMove),
    demoMatch: DEMO_MODE && Boolean(entry.demoMatch),
    shareContact,
    name: shareContact && entry.name ? String(entry.name).slice(0, 64) : "",
    phone: shareContact && entry.phone ? String(entry.phone).slice(0, 24) : "",
    note: entry.note ? String(entry.note).slice(0, 280) : "",
    preferences
  };
}

let db = { hostels: [], podHostels: [], listings: [], bookmarkCounts: {}, bookmarkWaitlist: {} };

/* ── Room geometry ───────────────────────────────────────────────────────── */

/* Traced from the drawing, not hand-estimated: the wall mask of
   assets/iith-typical-floor-plan.png is dilated to seal doorways, each room
   interior flood-filled from a seed, the region recovered and reduced to its
   outline. See docs/trace-rooms.py — re-run it if the drawing is replaced.
   Rooms are chamfered pentagons because the real rooms are cut at an angle
   where they meet the octagonal atrium. Don't "tidy" them into rectangles.

   THIRTY rooms per floor: pods of 8 / 8 / 6 / 8.
     pod 1 = 01-08  upper-left       pod 3 = 17-22  upper-right (six rooms)
     pod 2 = 09-16  lower-middle     pod 4 = 23-30  lower-right
   Pod numbering follows Chandan's labelling of the plan. Pods 2 and 4 are the
   same layout rotated 180°, so their service core sits at the opposite corner. */
const roomShapes = [
  /*  1 · pod 1 N-left   */ "M280 157 L294 143 L330 143 L344 157 L344 246 L327 262 L279 216 Z",
  /*  2 · pod 1 N-right  */ "M349 157 L363 143 L400 143 L414 157 L414 217 L365 262 L349 246 Z",
  /*  3 · pod 1 E-top    */ "M422 319 L470 270 L527 271 L541 285 L541 321 L527 335 L438 335 Z",
  /*  4 · pod 1 E-bot    */ "M422 357 L439 340 L527 340 L541 354 L541 391 L527 405 L467 405 Z",
  /*  5 · pod 1 S-right  */ "M349 430 L366 413 L414 458 L414 518 L400 532 L363 532 L349 518 Z",
  /*  6 · pod 1 S-left   */ "M328 413 L344 429 L344 518 L330 532 L294 532 L280 518 L279 464 Z",
  /*  7 · pod 1 W-bot    */ "M152 354 L166 340 L255 340 L272 357 L226 405 L166 405 L152 391 Z",
  /*  8 · pod 1 W-top    */ "M152 285 L166 271 L227 271 L272 319 L256 335 L166 335 L152 321 Z",
  /*  9 · pod 2 N-left   */ "M636 511 L650 497 L686 497 L700 511 L700 600 L683 617 L635 571 Z",
  /* 10 · pod 2 N-right  */ "M705 511 L719 497 L755 497 L769 511 L769 572 L722 617 L705 600 Z",
  /* 11 · pod 2 E-top    */ "M826 626 L884 627 L898 641 L898 677 L884 691 L794 691 L778 675 Z",
  /* 12 · pod 2 E-bot    */ "M794 696 L884 696 L898 710 L898 746 L884 760 L822 760 L778 713 Z",
  /* 13 · pod 2 S-right  */ "M705 786 L722 769 L770 815 L769 874 L755 888 L719 888 L705 874 Z",
  /* 14 · pod 2 S-left   */ "M684 769 L700 785 L700 874 L686 888 L650 888 L636 874 L635 817 Z",
  /* 15 · pod 2 W-bot    */ "M506 710 L520 696 L611 696 L627 713 L581 761 L521 760 L506 740 Z",
  /* 16 · pod 2 W-top    */ "M506 641 L520 627 L583 627 L627 675 L611 691 L522 691 L506 675 Z",
  /* 17 · pod 3 N-left   */ "M991 157 L1005 143 L1042 143 L1056 157 L1056 246 L1039 262 L991 217 Z",
  /* 18 · pod 3 N-right  */ "M1061 157 L1075 143 L1111 143 L1125 157 L1125 218 L1077 262 L1061 246 Z",
  /* 19 · pod 3 E-top    */ "M1182 270 L1239 271 L1253 285 L1253 321 L1239 335 L1150 335 L1134 319 Z",
  /* 20 · pod 3 E-bot    */ "M1150 340 L1239 340 L1253 354 L1253 391 L1239 405 L1179 405 L1134 357 Z",
  /* 21 · pod 3 W-bot    */ "M863 354 L877 340 L966 340 L983 357 L937 405 L877 405 L863 391 Z",
  /* 22 · pod 3 W-top    */ "M863 285 L877 271 L938 271 L983 319 L967 335 L877 335 L863 321 Z",
  /* 23 · pod 4 N-left   */ "M1347 511 L1361 497 L1398 497 L1412 511 L1412 600 L1395 617 L1347 571 Z",
  /* 24 · pod 4 N-right  */ "M1417 511 L1431 497 L1467 497 L1481 511 L1481 572 L1433 616 L1417 600 Z",
  /* 25 · pod 4 E-top    */ "M1535 626 L1595 627 L1609 641 L1609 677 L1595 691 L1506 691 L1490 675 Z",
  /* 26 · pod 4 E-bot    */ "M1506 696 L1595 696 L1609 710 L1609 746 L1595 760 L1534 760 L1490 713 Z",
  /* 27 · pod 4 S-right  */ "M1417 786 L1434 769 L1481 814 L1481 874 L1467 888 L1431 888 L1417 874 Z",
  /* 28 · pod 4 S-left   */ "M1347 814 L1396 769 L1412 785 L1412 874 L1398 888 L1361 888 L1347 874 Z",
  /* 29 · pod 4 W-bot    */ "M1220 710 L1234 696 L1322 696 L1339 713 L1293 761 L1234 760 L1220 746 Z",
  /* 30 · pod 4 W-top    */ "M1220 641 L1234 627 L1293 626 L1339 674 L1322 691 L1234 691 L1220 677 Z",
]

/* The two cells pod 3 is missing. The drawing shows a room here; the building
   has none, which is what makes pod 3 a six-room pod. Drawn struck through and
   inert so students can see the cell is not an option, never numbered, never
   counted. If the wrong pair is marked, move MISSING in docs/trace-rooms.py
   and regenerate, or just swap these two paths for the correct cells. */
const voidShapes = [
  /* pod 3 S-right  */ "M1061 430 L1078 413 L1125 458 L1125 518 L1111 532 L1075 532 L1061 518 Z",
  /* pod 3 S-left   */ "M992 457 L1039 412 L1056 429 L1056 518 L1042 532 L1005 532 L991 518 Z",
];

/* ── Local state ─────────────────────────────────────────────────────────── */

/* What this browser keeps: the student's own listing (so the page is useful
   before the network answers), the token proving they own their email, an
   anonymous token for bookmarks, and their bookmarks. Nothing about anyone
   else is ever cached here. */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function loadState() {
  const base = { profile: null, ownerToken: "", email: "", deviceToken: "", bookmarks: [], bookmarkName: "", online: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    base.profile      = saved.profile ? sanitiseLocalProfile(saved.profile) : null;
    base.ownerToken   = typeof saved.ownerToken === "string" ? saved.ownerToken : "";
    base.email        = typeof saved.email === "string" ? saved.email : "";
    base.deviceToken  = typeof saved.deviceToken === "string" ? saved.deviceToken : "";
    base.bookmarks    = Array.isArray(saved.bookmarks) ? saved.bookmarks : [];
    base.bookmarkName = typeof saved.bookmarkName === "string" ? saved.bookmarkName : "";
  } catch { /* Start fresh when storage is missing or malformed. */ }
  if (!base.deviceToken) base.deviceToken = newToken();
  return base;
}

/* The local copy keeps the fields the API strips from other people's
   listings, because for your own listing you are allowed to see them. */
function sanitiseLocalProfile(profile) {
  if (!profile || !HOSTELS.includes(profile.hostel) || !normaliseRoom(profile.room)) return null;
  if (!profile.name || !profile.email) return null;
  const listing = sanitiseListing({ ...profile, shareContact: true });
  if (!listing) return null;
  return {
    ...listing,
    shareContact: Boolean(profile.shareContact),
    name: String(profile.name).trim(),
    email: String(profile.email).trim(),
    phone: String(profile.phone || "").trim()
  };
}

const state = loadState();
/* Track the selected hostel by NAME, not by index. This used to be an index
   into the static HOSTELS constant while currentBuilding() read db.hostels —
   a different, API-ordered array — so the app opened on whatever happened to
   sit at that index (Bhabha, live) instead of the intended default. Names also
   survive the dropdown being re-sorted by listing count. */
const DEFAULT_HOSTEL = "Varahamihira";
let buildingName = DEFAULT_HOSTEL;
let activeFloor = FLOOR_COUNT;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    profile: state.profile,
    ownerToken: state.ownerToken,
    email: state.email,
    deviceToken: state.deviceToken,
    bookmarks: state.bookmarks,
    bookmarkName: state.bookmarkName
  }));
}

/* ── Bookmarks ───────────────────────────────────────────────────────────── */

function bookmarkKey(hostel, room) { return `${hostel}-${room}`; }
function isBookmarked(hostel, room) {
  return state.bookmarks.some(mark => mark.hostel === hostel && mark.room === room);
}
function bookmarkCount(hostel, room) {
  return db.bookmarkCounts?.[bookmarkKey(hostel, room)] || 0;
}
function waitlistFor(hostel, room) {
  return db.bookmarkWaitlist?.[bookmarkKey(hostel, room)] || [];
}
/* The waitlist shows who's interested, so bookmarking needs a name attached.
   A student who already has a listing has one; anyone else is asked once and
   it's remembered for every bookmark after that. */
function myBookmarkName() {
  if (state.profile?.name) return state.profile.name;
  if (state.bookmarkName) return state.bookmarkName;
  const entered = window.prompt("Add your name so others can see who's on the waitlist for a room:");
  const name = entered ? entered.trim().slice(0, 64) : "";
  if (name) { state.bookmarkName = name; persist(); }
  return name;
}

async function toggleBookmark(hostel, room) {
  const on = !isBookmarked(hostel, room);
  const name = on ? myBookmarkName() : "";
  if (on && !name) return; /* Declined to give a name — don't bookmark anonymously into a named waitlist. */
  /* Optimistic: the map updates now, the server catches up. */
  state.bookmarks = on
    ? [{ hostel, room }, ...state.bookmarks]
    : state.bookmarks.filter(mark => !(mark.hostel === hostel && mark.room === room));
  db.bookmarkCounts[bookmarkKey(hostel, room)] = Math.max(0, bookmarkCount(hostel, room) + (on ? 1 : -1));
  persist();
  renderRooms();
  showToast(on ? `Room ${room} bookmarked.` : `Removed room ${room} from bookmarks.`);
  try {
    const result = await api("bookmarks.php", { deviceToken: state.deviceToken, hostel, room, on, name });
    state.bookmarks = result.bookmarks || state.bookmarks;
    db.bookmarkCounts = result.counts || db.bookmarkCounts;
    db.bookmarkWaitlist = result.waitlist || db.bookmarkWaitlist;
    persist();
    renderRooms();
  } catch (error) {
    console.warn("Bookmark did not sync.", error);
  }
}

async function syncBookmarks() {
  try {
    const result = await api("bookmarks.php", { deviceToken: state.deviceToken });
    state.bookmarks = result.bookmarks || [];
    db.bookmarkCounts = result.counts || db.bookmarkCounts;
    db.bookmarkWaitlist = result.waitlist || db.bookmarkWaitlist;
    persist();
  } catch { /* Offline: the local list stands. */ }
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
  const pod = POD_OF_ROOM[roomInFloor - 1];
  return { id: `${floor}${String(roomInFloor).padStart(2, "0")}`, floor, roomInFloor, pod };
}
function podRange(pod) {
  const first = POD_SIZES.slice(0, pod - 1).reduce((sum, size) => sum + size, 1);
  const pad = value => String(value).padStart(2, "0");
  return `${pad(first)}–${pad(first + POD_SIZES[pod - 1] - 1)}`;
}
function normaliseRoom(value) {
  return roomMeta(value)?.id || "";
}
function currentBuilding() {
  if (db.hostels.includes(buildingName)) return buildingName;
  return db.hostels.includes(DEFAULT_HOSTEL) ? DEFAULT_HOSTEL : db.hostels[0];
}
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
  const ownMeta = roomMeta(own.room);
  const listingMeta = roomMeta(listing.room);
  const theyWantUs = listing.preferences.some(preference => preference.hostel === own.hostel
    && (!preference.pod || preference.pod === ownMeta?.pod)
    && (!preference.floor || preference.floor === ownMeta?.floor));
  const weWantThem = own.preferences.some(preference => preference.hostel === listing.hostel
    && (!preference.pod || preference.pod === listingMeta?.pod)
    && (!preference.floor || preference.floor === listingMeta?.floor));
  return theyWantUs && weWantThem;
}
function statusAtFor(hostel, room) {
  const listing = listingAt(hostel, room);
  if (listing) {
    if (listingMatchesYou(listing)) return "match";
    if (listing.willingToMove) return "open";
  }
  /* Waitlist is an overlay for rooms nobody has claimed yet, not a listing
     state — a match or an open swap is always more actionable to show. Any
     bookmark counts, including your own, so a saved room is visible on the
     map right away, not just in "My Bookmarks". */
  if (bookmarkCount(hostel, room) >= 1) return "waitlist";
  return listing ? "occupied" : "unlisted";
}
function statusAt(room) { return statusAtFor(currentBuilding(), room); }
const BUILDING_PROFILE = {
  architecture: "REFERENCE-INFORMED 3D MODEL",
  meta: "4 labelled pods · 9 residential levels",
  credit: "Sample listings are shown for visual testing only.",
  roomCaption: "Rooms listed"
};

const STATUS_LABELS = {
  unlisted: "Unlisted",
  occupied: "Registered",
  open: "Open to swap",
  match: "Match for you",
  waitlist: "Waitlisted"
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

/* ── Custom dropdown ──────────────────────────────────────────────────────
   The native <select> stays in the DOM and remains the source of truth for
   form reads/writes; this only draws a button + menu over it, matching the
   hostel picker in the toolbar. Call syncSelect() after changing options or
   the value programmatically. */
function enhanceSelect(select) {
  if (select.dataset.enhanced) return syncSelect(select);
  select.dataset.enhanced = "true";

  const wrap = document.createElement("div");
  wrap.className = "select";
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "select-btn";
  button.innerHTML = "<span></span><b>⌄</b>";
  const label = select.getAttribute("aria-label");
  if (label) button.setAttribute("aria-label", label);
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "select-menu hidden";
  menu.setAttribute("role", "listbox");

  wrap.append(button, menu);

  button.addEventListener("click", () => {
    const opening = menu.classList.contains("hidden");
    closeAllSelects();
    menu.classList.toggle("hidden", !opening);
    wrap.classList.toggle("open", opening);
    button.setAttribute("aria-expanded", String(opening));
  });
  menu.addEventListener("click", event => {
    const option = event.target.closest(".select-option");
    if (!option) return;
    select.value = option.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    closeAllSelects();
    syncSelect(select);
  });
  syncSelect(select);
}
function syncSelect(select) {
  const wrap = select.closest(".select");
  if (!wrap) return;
  const chosen = select.options[select.selectedIndex];
  const button = wrap.querySelector(".select-btn");
  button.querySelector("span").textContent = chosen ? chosen.textContent : "";
  button.classList.toggle("is-placeholder", !select.value);
  wrap.querySelector(".select-menu").innerHTML = [...select.options].map(option =>
    `<button type="button" class="select-option ${option.value === select.value ? "selected" : ""}" role="option" aria-selected="${option.value === select.value}" data-value="${escapeHtml(option.value)}">${escapeHtml(option.textContent)}</button>`).join("");
}
function closeAllSelects() {
  document.querySelectorAll(".select.open").forEach(wrap => {
    wrap.classList.remove("open");
    wrap.querySelector(".select-menu").classList.add("hidden");
    wrap.querySelector(".select-btn").setAttribute("aria-expanded", "false");
  });
}

function fillHostelSelect(select, includeBlank = false) {
  const selected = select.value;
  select.innerHTML = `${includeBlank ? '<option value="">Choose a hostel</option>' : ""}${db.hostels
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function fillPodSelect(select) {
  const selected = select.value;
  select.innerHTML = `<option value="">Any pod</option>${[1, 2, 3, 4]
    .map(pod => `<option value="${pod}">Pod ${pod} · rooms ${podRange(pod)}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function fillFloorSelect(select) {
  const selected = select.value;
  select.innerHTML = `<option value="">Any floor</option>${Array.from({ length: FLOOR_COUNT }, (_, i) => i + 1)
    .map(floor => `<option value="${floor}">Floor ${String(floor).padStart(2, "0")}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function renderProfile() {
  renderBookmarkBadge();
  /* One button, one meaning: it creates the listing, then maintains it. */
  document.getElementById("hero-create-listing").innerHTML =
    `${state.profile ? "Update my room listing" : "List my room"} <b>→</b>`;
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
  form.querySelectorAll('[name$="Floor"]').forEach(fillFloorSelect);
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
      form.elements[`preference${index + 1}Floor`].value = preference.floor || "";
    });
  }
  setMoveDetails(form.elements.willingToMove.value === "yes");
  form.querySelectorAll("select").forEach(enhanceSelect);
  document.getElementById("profile-modal-title").textContent = state.profile ? "Update your listing" : "Create your listing";
  /* Only offer removal once something is actually stored — this is also the
     escape hatch when a pre-filled room number looks like a mystery default. */
  document.getElementById("delete-listing").classList.toggle("hidden", !state.profile);
  setModal("profile-modal", true);
}

/* ── Room views ─────────────────────────────────────────────────────────── */

let activeView = "3d";
let show3DAll = true;

/* Floors are a rail on the left of the stage. "All" only means something in
   the 3D view — the floor plan always draws exactly one floor — so that button
   is hidden while the plan is open. */
function renderFloorRail() {
  const holder = document.getElementById("floor-buttons");
  const allButton = document.getElementById("floor-all");
  const showingAll = activeView === "3d" && show3DAll;
  holder.innerHTML = "";
  for (let floor = FLOOR_COUNT; floor >= 1; floor--) {
    const button = document.createElement("button");
    button.textContent = String(floor).padStart(2, "0");
    button.dataset.floor = floor;
    button.setAttribute("aria-pressed", String(!showingAll && floor === activeFloor));
    if (!showingAll && floor === activeFloor) button.classList.add("active");
    button.addEventListener("click", () => applyFloorSelection(String(floor)));
    holder.appendChild(button);
  }
  allButton.classList.toggle("hidden", activeView !== "3d");
  allButton.classList.toggle("active", showingAll);
  allButton.setAttribute("aria-pressed", String(showingAll));
}
function applyFloorSelection(value) {
  if (value === "all") {
    show3DAll = true;
    if (activeView === "3d") window.nivasViewer?.setFloor("all");
    return renderFloorRail();
  }
  show3DAll = false;
  activeFloor = Number(value);
  if (activeView === "3d") window.nivasViewer?.setFloor(String(activeFloor - 1));
  else { renderRooms(); resetPanel(); }
  renderFloorRail();
}
function renderRooms() {
  const layer = document.getElementById("room-layer");
  const shapes = activeRoomShapes();
  layer.innerHTML = "";
  const svgNS = "http://www.w3.org/2000/svg";

  /* Pod 3's two missing cells: drawn struck through and inert so a student can
     see the cell is not an option. No number, no status, never counted. */
  voidShapes.forEach(path => {
    const cell = document.createElementNS(svgNS, "path");
    cell.setAttribute("d", path);
    cell.setAttribute("class", "room void");
    layer.appendChild(cell);
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    const [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const inset = 10;
    [[x1 + inset, y1 + inset, x2 - inset, y2 - inset], [x2 - inset, y1 + inset, x1 + inset, y2 - inset]]
      .forEach(([ax, ay, bx, by]) => {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", ax); line.setAttribute("y1", ay);
        line.setAttribute("x2", bx); line.setAttribute("y2", by);
        line.setAttribute("class", "room-cross");
        layer.appendChild(line);
      });
  });

  shapes.forEach((path, index) => {
    const id = roomId(index);
    const status = statusAt(id);
    const room = document.createElementNS(svgNS, "path");
    room.setAttribute("d", path);
    room.setAttribute("class", `room ${status}`);
    room.dataset.id = id;
    layer.appendChild(room);
    room.addEventListener("mouseenter", () => showToast(`Room ${id} · ${STATUS_LABELS[status]}`));
    room.addEventListener("click", () => openRoom(id, room));
  });
  updateSummary();
}
/* With no room selected the column shows the student's own listing and their
   ranked choices, so it is never blank once they've registered. */
function preferenceList(preferences) {
  if (!preferences.length) return "";
  return `<ol class="choice-list">${preferences.map(preference => {
    const pod = preference.pod ? `Pod ${preference.pod}` : "Any pod";
    const floor = preference.floor ? `Floor ${String(preference.floor).padStart(2, "0")}` : "Any floor";
    return `<li><span>${escapeHtml(preference.hostel)}</span><small>${pod} · ${floor}</small></li>`;
  }).join("")}</ol>`;
}
/* The column is a stack of cards, not one long tinted strip: an identity card
   carrying the status colour, then the ranked choices as their own card. */
function statCells(room, meta) {
  return `<div class="detail-stats">
      <div><span>Room</span><strong>${escapeHtml(room)}</strong></div>
      <div><span>Floor</span><strong>${String(meta.floor).padStart(2, "0")}</strong></div>
      <div><span>Pod</span><strong>${meta.pod}</strong></div>
    </div>`;
}
function choiceCard(title, preferences) {
  return `<section class="detail-card">
      <p class="choice-title">${title}</p>
      ${preferences.length ? preferenceList(preferences) : '<p class="choice-none">No destinations chosen yet.</p>'}
    </section>`;
}

function resetPanel() {
  selectedRoomId = null;
  document.querySelectorAll(".selected-room").forEach(room => room.classList.remove("selected-room"));
  const own = state.profile;
  const empty = document.querySelector(".panel-empty");
  const detail = document.getElementById("panel-detail");
  if (!own) {
    empty.classList.remove("hidden");
    detail.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  detail.classList.remove("hidden");
  const status = own.willingToMove ? "open" : "occupied";
  detail.innerHTML = `
    <section class="detail-card detail-card--${status}">
      <div class="detail-head">
        <div><p>YOUR LISTING</p><h3>${escapeHtml(own.hostel)} · ${escapeHtml(own.room)}</h3></div>
        <span class="pill pill--${status}">${STATUS_LABELS[status]}</span>
      </div>
      ${statCells(own.room, roomMeta(own.room))}
    </section>
    ${own.willingToMove ? choiceCard("Your top choices", own.preferences) : ""}
    <button class="btn btn--secondary btn--block panel-edit" type="button">Edit my listing</button>
    <p class="panel-hint">Click any room to see what its resident posted.</p>`;
  detail.querySelector(".panel-edit").addEventListener("click", openProfile);
}

function contactBlock(listing) {
  if (!listing || !listing.willingToMove && !listing.shareContact) return "";
  if (!listing.shareContact) {
    return `<p class="contact-none">This student hasn't shared contact details. Their room still shows as ${listing.willingToMove ? "open to swap" : "registered"}.</p>`;
  }
  const digits = listing.phone.replace(/\D/g, "");
  const wa = digits.length >= 10 ? `https://wa.me/${digits.length === 10 ? "91" + digits : digits}` : "";
  return `<div class="contact-card">
      <p class="choice-title">Contact</p>
      <strong>${escapeHtml(listing.name)}</strong>
      <span>${escapeHtml(listing.phone)}</span>
      <div class="contact-actions">
        ${wa ? `<a class="btn btn--primary btn--block" href="${wa}" target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>` : ""}
        <a class="btn btn--secondary btn--block" href="tel:${escapeHtml(listing.phone)}">Call</a>
      </div>
      <small class="contact-note">Shared by this student. Keep it to room swaps.</small>
    </div>`;
}

function bookmarkButton(hostel, room) {
  const on = isBookmarked(hostel, room);
  const count = bookmarkCount(hostel, room);
  return `<button class="bookmark-btn ${on ? "is-on" : ""}" type="button" data-bookmark="${escapeHtml(room)}"
      aria-pressed="${on}" title="${on ? "Remove bookmark" : "Bookmark this room"}">
      <span>${on ? "★" : "☆"}</span>${on ? "Saved" : "Save"}${count ? `<b>${count}</b>` : ""}
    </button>`;
}
/* First come, first served: names are listed in the order they bookmarked. */
function waitlistBlock(hostel, room) {
  const names = waitlistFor(hostel, room);
  if (!names.length) return "";
  const note = names.length === 1
    ? `${escapeHtml(names[0])} has bookmarked this room.`
    : `First come, first served — ${escapeHtml(names[0])} bookmarked it first.`;
  return `<section class="waitlist-card">
      <p class="choice-title">${names.length === 1 ? "Interested in this room" : "Waitlist for this room"}</p>
      <ol class="waitlist-list">${names.map(name => `<li><span>${escapeHtml(name)}</span></li>`).join("")}</ol>
      <p class="waitlist-note">${note}</p>
    </section>`;
}

let selectedRoomId = null;

function openRoom(id, element) {
  selectedRoomId = id;
  document.querySelectorAll(".selected-room").forEach(room => room.classList.remove("selected-room"));
  element?.classList.add("selected-room");
  const status = statusAt(id);
  document.querySelector(".panel-empty").classList.add("hidden");
  const detail = document.getElementById("panel-detail");
  const hostel = currentBuilding();
  const listing = listingAt(hostel, id);
  const meta = roomMeta(id);
  const isOwnRoom = Boolean(state.profile && state.profile.hostel === hostel && state.profile.room === id);
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <section class="detail-card detail-card--${status}">
      <div class="detail-head">
        <div><p>${isOwnRoom ? "YOUR LISTING" : "ROOM DETAIL"}</p><h3>${escapeHtml(hostel)} · ${escapeHtml(id)}</h3></div>
        <span class="pill pill--${status}">${STATUS_LABELS[status]}</span>
        <button class="icon-btn close-panel" aria-label="Close room details">×</button>
      </div>
      ${statCells(id, meta)}
      ${bookmarkButton(hostel, id)}
      <div class="resident-card"><div class="avatar avatar--lg avatar--private">${isOwnRoom ? initials(state.profile.name) : listing?.shareContact ? initials(listing.name) : "••"}</div><div><strong>${isOwnRoom ? "Your listing" : listing ? (listing.shareContact ? escapeHtml(listing.name) : "Student listing") : "No listing for this room"}</strong><small>${listing ? (listing.willingToMove ? "This student is open to a swap." : "Registered, not seeking a move.") : "Nobody has posted about this room yet."}</small></div></div>
    </section>
    ${listing && !isOwnRoom ? contactBlock(listing) : ""}
    ${listing?.willingToMove ? choiceCard(isOwnRoom ? "Your top choices" : "Wants to move to", listing.preferences) : ""}
    ${waitlistBlock(hostel, id)}
    ${isOwnRoom ? '<button class="btn btn--secondary btn--block panel-edit" type="button">Edit my listing</button>' : ""}`;
  detail.querySelector(".close-panel").addEventListener("click", resetPanel);
  detail.querySelector(".panel-edit")?.addEventListener("click", openProfile);
  detail.querySelector("[data-bookmark]")?.addEventListener("click", () => {
    toggleBookmark(hostel, id).then(() => openRoom(id, element));
  });
}

function roomStatusMapFor(hostel) {
  return Object.fromEntries(activeListings().filter(listing => listing.hostel === hostel).map(listing => [listing.room, statusAtFor(hostel, listing.room)]));
}
function updateViewer() {
  const detail = { name: currentBuilding(), roomStatuses: roomStatusMapFor(currentBuilding()) };
  window.dispatchEvent(new CustomEvent("nivas:building-change", { detail }));
}
function updateSummary() {
  const listings = activeListings();
  const here = listings.filter(listing => listing.hostel === currentBuilding());
  const openHere = here.filter(listing => listing.willingToMove);
  const matches = here.filter(listingMatchesYou);
  document.getElementById("rooms-count").textContent = here.length;
  document.getElementById("open-swap-count").textContent = openHere.length;
  document.getElementById("match-count").textContent = matches.length;
  /* Campus-wide, not scoped to the selected hostel — activeListings() already
     covers every hostel, so this is just its unfiltered length. */
  document.getElementById("campus-listed-count").textContent = listings.length;
  renderBuildingMenu();
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

function setBuilding(hostel) {
  buildingName = hostel;
  const name = currentBuilding();
  buildingName = name;
  document.getElementById("building-name").textContent = name;
  document.getElementById("head-hostel").textContent = name;
  document.getElementById("site-card-building").textContent = name;
  document.getElementById("three-building-label").textContent = `${name.toUpperCase()} · ${BUILDING_PROFILE.architecture}`;
  document.getElementById("three-building-meta").textContent = BUILDING_PROFILE.meta;
  document.getElementById("three-credit").textContent = BUILDING_PROFILE.credit;
  document.getElementById("facade-hotspot-name").textContent = name;
  document.querySelectorAll(".building-option").forEach(option => {
    const selected = option.dataset.building === name;
    option.classList.toggle("selected", selected); option.setAttribute("aria-selected", String(selected));
  });
  renderRooms(); resetPanel(); updateViewer();
}
let buildingMenuOrder = [];
function renderBuildingMenu() {
  const menu = document.getElementById("building-menu");
  const listings = activeListings();
  const countFor = hostel => listings.filter(listing => listing.hostel === hostel).length;
  /* Busiest hostels first — that is where a swap is actually findable — with
     ties alphabetical so there is a stable secondary order. updateSummary()
     re-renders this every 20s, so the order is frozen while the menu is open:
     re-sorting under an open dropdown moves the option the user is reaching for. */
  if (menu.classList.contains("hidden") || buildingMenuOrder.length !== db.hostels.length) {
    buildingMenuOrder = [...db.hostels].sort((a, b) => countFor(b) - countFor(a) || a.localeCompare(b));
  }
  const chosen = currentBuilding();
  menu.innerHTML = buildingMenuOrder.map(name => {
    const count = countFor(name);
    const selected = name === chosen;
    return `<button class="building-option ${selected ? "selected" : ""}" data-building="${escapeHtml(name)}" role="option" aria-selected="${selected}">
        <span>${escapeHtml(name)}</span>${count ? `<b class="building-option-count">${count}</b>` : ""}
      </button>`;
  }).join("");
  menu.querySelectorAll(".building-option").forEach(option => option.addEventListener("click", () => { setBuilding(option.dataset.building); closeBuildingMenu(); }));
}
function closeBuildingMenu() {
  document.getElementById("building-menu").classList.add("hidden");
  document.getElementById("building-choice").setAttribute("aria-expanded", "false");
}
function selectView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("site-view").classList.toggle("hidden", view !== "site");
  document.getElementById("floor-view").classList.toggle("hidden", view !== "floor");
  document.getElementById("three-view").classList.toggle("hidden", view !== "3d");
  document.getElementById("map-view").classList.toggle("hidden", view !== "map");
  document.getElementById("visual-stage").classList.toggle("hidden", view === "3d");
  document.querySelector(".hero-model").classList.toggle("hidden", view !== "3d");
  renderFloorRail();
  if (view === "floor") { renderRooms(); resetPanel(); }
  if (view === "3d") requestAnimationFrame(() => window.nivasViewer?.resize());
}

/* ── Feedback ────────────────────────────────────────────────────────────── */

function openFeedback() {
  const form = document.getElementById("feedback-form");
  form.reset();
  const hostelSelect = form.elements.hostel;
  fillHostelSelect(hostelSelect, true);
  hostelSelect.value = state.profile?.hostel || "";
  if (state.profile) {
    form.elements.name.value = state.profile.name;
    form.elements.email.value = state.profile.email;
  }
  form.querySelectorAll("select").forEach(enhanceSelect);
  document.getElementById("feedback-note").textContent = state.online
    ? "Goes straight to the maintainer."
    : "No connection — this will open your mail app instead.";
  setModal("feedback-modal", true);
}

async function sendFeedback(report) {
  if (API_BASE) {
    try {
      await api("feedback.php", report);
      return "Thanks — that's been sent.";
    } catch (error) {
      console.warn("Feedback API unavailable, falling back to mail.", error);
    }
  }
  /* No backend yet: hand the whole thing to the student's mail client. */
  const body = [
    `Type: ${report.kind}`,
    `Name: ${report.name}`,
    `Email: ${report.email}`,
    report.phone ? `Phone: ${report.phone}` : null,
    report.hostel ? `Hostel: ${report.hostel}` : null,
    "",
    report.message
  ].filter(Boolean).join("\n");
  const subject = `[Nivas] ${report.kind} from ${report.name}`;
  window.location.href = `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return "Your mail app should be opening — send it and it reaches us.";
}

/* ── Saved rooms ─────────────────────────────────────────────────────────── */

function renderBookmarkBadge() {
  const badge = document.getElementById("bookmark-badge");
  badge.textContent = state.bookmarks.length;
  badge.classList.toggle("hidden", state.bookmarks.length === 0);
}

function openBookmarks() {
  const list = document.getElementById("bookmarks-list");
  if (!state.bookmarks.length) {
    list.innerHTML = `<p class="bookmarks-empty">No saved rooms yet. Open any room and press <b>Save</b> — it works across every hostel, and it's separate from your three swap preferences.</p>`;
  } else {
    list.innerHTML = `<div class="bookmark-list">${state.bookmarks.map(mark => {
      const listing = listingAt(mark.hostel, mark.room);
      const status = statusAtFor(mark.hostel, mark.room);
      const meta = roomMeta(mark.room);
      return `<button class="bookmark-row" data-hostel="${escapeHtml(mark.hostel)}" data-room="${escapeHtml(mark.room)}">
          <span class="bookmark-dot bookmark-dot--${status}"></span>
          <span class="bookmark-copy">
            <strong>${escapeHtml(mark.hostel)} · ${escapeHtml(mark.room)}</strong>
            <small>Floor ${String(meta.floor).padStart(2, "0")} · Pod ${meta.pod} · ${STATUS_LABELS[status]}${
              listing?.shareContact ? ` · ${escapeHtml(listing.name)}` : ""}</small>
          </span>
          <span class="bookmark-go">Open →</span>
        </button>`;
    }).join("")}</div>`;
    list.querySelectorAll(".bookmark-row").forEach(row => row.addEventListener("click", () => {
      closeAllModals();
      setBuilding(row.dataset.hostel);
      activeFloor = roomMeta(row.dataset.room).floor;
      show3DAll = false;
      selectView("floor");
      renderFloorRail();
      renderRooms();
      openRoom(row.dataset.room, document.querySelector(`#room-layer [data-id="${row.dataset.room}"]`));
    }));
  }
  setModal("bookmarks-modal", true);
}

/* ── Publishing ──────────────────────────────────────────────────────────
   One listing goes to the shared board. If the server says the email has not
   proved itself yet, we hold the draft, send a code, and finish the save once
   the student types it back. */

let pendingListing = null;

async function publishListing(draft, alreadyVerified = false) {
  if (!API_BASE) {
    state.profile = draft; persist();
    closeAllModals(); renderProfile(); await refresh();
    return showToast("Saved on this device — the shared board is not connected.");
  }

  try {
    await api("listings.php", {
      ownerToken: state.ownerToken,
      email: draft.email,
      name: draft.name,
      phone: draft.phone,
      hostel: draft.hostel,
      room: draft.room,
      shareContact: draft.shareContact,
      willingToMove: draft.willingToMove,
      preferences: draft.preferences
    });
    state.profile = draft;
    state.email = draft.email;
    persist();
    closeAllModals();
    renderProfile();
    await refresh();
    showToast(draft.shareContact
      ? "Published. Your name and number are visible on your room."
      : "Published. Your contact stays private.");
  } catch (error) {
    if (error.status === 401 && !alreadyVerified) {
      pendingListing = draft;
      return requestCode(draft.email);
    }
    showToast(error.message);
  }
}

async function requestCode(email) {
  try {
    await api("verify.php", { step: "request", email });
    document.getElementById("verify-email").textContent = email;
    document.getElementById("verify-form").reset();
    setModal("profile-modal", false);
    setModal("verify-modal", true);
  } catch (error) {
    showToast(error.message);
  }
}

/* Pull the board again and repaint everything that depends on it. Keeps
   whatever room the student has open — a background poll re-selecting the
   default card out from under them every 20s was the actual bug behind
   "it keeps falling back", not a timeout to tune. */
async function refresh() {
  const reopen = selectedRoomId;
  db = await DataSource.load();
  renderRooms();
  if (reopen && roomMeta(reopen)) {
    openRoom(reopen, document.querySelector(`#room-layer [data-id="${reopen}"]`));
  } else {
    resetPanel();
  }
  updateViewer();
  updateSummary();
}

/* ── Event wiring ───────────────────────────────────────────────────────── */

function bindEvents() {
  document.getElementById("hero-create-listing").addEventListener("click", openProfile);
  document.getElementById("open-feedback").addEventListener("click", openFeedback);
  document.getElementById("open-bookmarks").addEventListener("click", openBookmarks);
  document.getElementById("feedback-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const report = {
      kind: form.elements.kind.value,
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      hostel: form.elements.hostel.value,
      message: form.elements.message.value.trim(),
      page: location.href
    };
    if (!report.name || !report.email || !report.message) return showToast("Add your name, email and a message.");
    try {
      const note = await sendFeedback(report);
      closeAllModals();
      showToast(note);
    } catch (error) {
      console.warn("Nivas could not send the report.", error);
      showToast(`That didn't send — email ${FEEDBACK_TO} directly.`);
    }
  });
  /* Picking a first choice used to pop the activity modal on top of this one,
     which interrupted the form mid-answer. The same numbers are on the page. */
  document.getElementById("profile-form").addEventListener("change", event => {
    if (event.target.name === "willingToMove") setMoveDetails(event.target.value === "yes");
  });
  document.getElementById("profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const willingToMove = form.elements.willingToMove.value === "yes";
    const preferences = willingToMove
      ? [1, 2, 3].map(index => ({
          hostel: form.elements[`preference${index}Hostel`].value,
          pod: Number(form.elements[`preference${index}Pod`].value) || null,
          floor: Number(form.elements[`preference${index}Floor`].value) || null
        })).filter(preference => preference.hostel)
      : [];
    const draft = sanitiseLocalProfile({
      id: "local-profile",
      name: form.elements.name.value,
      email: form.elements.email.value,
      phone: form.elements.phone.value,
      hostel: form.elements.hostel.value,
      room: form.elements.room.value,
      shareContact: form.elements.shareContact.checked,
      willingToMove,
      preferences
    });
    if (!draft) return showToast("Use a room number like 912 and complete every required field.");
    if (draft.shareContact && !draft.phone) return showToast("Add a phone number, or untick sharing your contact.");
    await publishListing(draft);
  });

  document.getElementById("delete-listing").addEventListener("click", async () => {
    if (API_BASE && state.ownerToken) {
      try {
        await api("listings.php", { ownerToken: state.ownerToken, delete: true });
      } catch (error) {
        return showToast(error.message);
      }
    }
    state.profile = null; persist();
    closeAllModals(); renderProfile(); await refresh();
    showToast("Your listing has been removed.");
  });

  document.getElementById("verify-form").addEventListener("submit", async event => {
    event.preventDefault();
    const code = event.currentTarget.elements.code.value.trim();
    if (!code) return showToast("Enter the six-digit code.");
    try {
      const result = await api("verify.php", { step: "confirm", email: pendingListing.email, code });
      state.ownerToken = result.ownerToken;
      state.email = result.email;
      persist();
      setModal("verify-modal", false);
      await publishListing(pendingListing, true);
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById("resend-code").addEventListener("click", async () => {
    try {
      await api("verify.php", { step: "request", email: pendingListing.email });
      showToast("A new code is on its way.");
    } catch (error) { showToast(error.message); }
  });

  document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeAllModals));
  document.getElementById("activity-close").addEventListener("click", () => setModal("activity-modal", false));
  document.getElementById("building-choice").addEventListener("click", () => {
    const menu = document.getElementById("building-menu"); const opening = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !opening); document.getElementById("building-choice").setAttribute("aria-expanded", String(opening));
  });
  document.getElementById("swap-activity").addEventListener("click", () => openActivity());
  document.getElementById("enter-building").addEventListener("click", () => selectView("floor"));
  document.getElementById("facade-hotspot").addEventListener("click", () => selectView("floor"));
  document.getElementById("map-open-viewer").addEventListener("click", () => selectView("3d"));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => selectView(button.dataset.view)));
  document.getElementById("floor-all").addEventListener("click", () => applyFloorSelection("all"));
  document.addEventListener("click", event => {
    if (!document.querySelector(".building-picker").contains(event.target)) closeBuildingMenu();
    if (!event.target.closest(".select")) closeAllSelects();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (document.querySelector(".select.open")) return closeAllSelects();
    closeAllModals();
  });
  window.addEventListener("nivas:viewer-ready", updateViewer);
  window.addEventListener("nivas:room-click", event => { if (event.detail?.id) openRoom(event.detail.id); });
}

async function boot() {
  db = await DataSource.load();
  bindEvents(); renderBuildingMenu(); renderProfile(); setBuilding(buildingName);
  selectView("3d");
  if (API_BASE) {
    syncBookmarks().then(() => { renderBookmarkBadge(); renderRooms(); });
    /* Other students are posting while this page is open. */
    setInterval(refresh, 20000);
  }
}

boot();
