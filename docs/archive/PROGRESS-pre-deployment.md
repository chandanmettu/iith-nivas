# Nivas — Progress Log

**Read this whole file before touching the code.** It's the compressed memory of
every session that's worked on this project. Don't rely on chat history from a
previous conversation being available to you — it won't be. This file is how
continuity actually happens.

## 2026-08-19 — Security & setup audit

Full review of the API and the client render path. Repo moved to
`~/My Project Builds/iith-hostels`; remote repointed to
`saichandanmettu/iith-hostels` after the GitHub username change.

**Correction to an earlier draft of this entry:** it described the project as
not yet deployed, on the strength of the README saying so and `DEPLOY.md`
carrying placeholder domains. That was wrong — the docs were simply stale.
**Nivas is live at nivas.iith.online with real student listings.** The two
privacy items below are therefore live exposures, not pre-launch questions.

**Fixed — verification was unrunnable as shipped.** `nivas_mail()` reads
`mail_from` and `mail_from_name`, but `config.example.php` never defined either.
Anyone setting up from the example got a malformed `From:  <>` header, mail
silently failed, `verify.php` returned 500, and — because verification is the
only identity check — *nobody could publish a listing at all*. `DEPLOY.md` had
noted the gap in passing but the example file was never corrected. Both keys are
now in the example, `nivas_mail()` logs a specific error instead of sending a
broken header, and `DEPLOY.md` says plainly that they're required. Also dropped
the stale `feedback_to` reference — nothing has ever read that key.

**Fixed — `initials()` output went into `innerHTML` unescaped.** Only the first
character of each of the first two words survives, so it was never an executable
payload, but a name beginning with `<` still corrupted the avatar markup. Now
escaped like every other render site, and null-safe. Verified in-browser:
`<img src=x onerror=…>` → `&lt;S`.

**Two open privacy decisions — being tracked privately, not detailed here.**
Both concern how much student-submitted contact detail the read endpoints hand
back, and to whom. Because the site is live with real data, the specifics are
recorded in the private project tracker rather than in this public file. Both
need resolving; treat them as the top of the punch-list.

The privacy line elsewhere is well drawn and worth preserving: the listings
SELECT deliberately never touches the email column, and contact fields are only
copied into the response when `share_contact = 1`.

**Reviewed and clean.** Prepared statements throughout with
`ATTR_EMULATE_PREPARES => false`; CORS is an allowlist, not `*`; owner and
device tokens are SHA-256 hashed before storage; `hash_equals` for code
comparison; per-IP throttles on every write path; codes expire at 15 minutes
with a 5-attempt cap; `.htaccess` denies `config.php`, `*.sql` and `*.md`;
`display_errors` off with `error_log` instead; hostel and room values validated
against allowlists so a bad room can never reach the database; `escapeHtml`
applied consistently at every other render site. No secrets in the repo or
anywhere in git history.

**Unchanged and still true:** the backend has never executed against a real PHP
host — there is no PHP on the dev Mac, so every endpoint remains reviewed-by-eye
only. Run one listing end-to-end before sharing the link. This is now the single
largest risk in the project.

## Rule for every agent (Claude, Gemini, Codex, or human) touching this repo

**After you make changes, append a new dated entry to the top of the
[Log](#log-newest-first) — newest first, never delete or rewrite past entries.**
Be specific: what changed, why, what's still broken. A vague entry is worse than
no entry — the next agent needs to make real decisions from what you write.

---

## Project at a glance

- **What:** an interactive explorer for the IIT Hyderabad hostel precinct —
  browse the 16 boys' hostels one at a time, orbit a 3D building model,
  navigate floor by floor on the real architectural drawing, see room status,
  locate friends, request a room swap.
- **Local path:** `~/Documents/hostel iiths`
- **Hosting:** GitHub → Hostinger. Backend is PHP + MySQL in `api/` — see [`docs/DEPLOY.md`](./DEPLOY.md). Not yet deployed.
- **Design system:** [`docs/DESIGN.md`](./DESIGN.md) — read before touching any UI
- **Run locally:** `python3 -m http.server 8137`, then open `http://localhost:8137`.
  A plain `file://` open **will not work** — `viewer3d.js` is an ES module.

## Stack (locked, don't relitigate without strong reason)

- Static HTML/CSS/JS. No framework, no build step, no npm, no bundler.
- **three.js is vendored** in `vendor/` (`three.module.js`, `OrbitControls.js`) —
  no CDN, deliberately, so the app works on locked-down campus networks and
  can't break when a CDN version moves.
- **Backend: PHP 8.1+ / MySQL in `api/`** (Hostinger shared hosting). No
  framework, no composer. `api/config.php` is gitignored.
- localStorage now holds only *this* student's own listing, their owner token,
  an anonymous device token and their bookmarks. Everyone else's data comes
  from the API and is never cached.

## Folder structure

```
index.html, styles.css, app.js, viewer3d.js   ← served, repo root
api/          ← PHP endpoints + schema.sql (config.php is gitignored)
assets/       ← supplied IIT-H reference imagery (facade photo, floor plan drawing)
vendor/       ← vendored three.js + OrbitControls, do not replace with a CDN
docs/         ← this file, DESIGN.md, DEPLOY.md, trace-rooms.py,
                header-mockups.html (scratch: three header options, not linked
                from the app — moved here from repo root 2026-07-26 so the
                root only contains what's actually served)
```

## Current state (as of 2026-07-25)

### Done
- Full design system: tokens for colour/radius/space/type/elevation/motion, and
  a unified component layer (`.btn`, `.icon-btn`, `.seg-btn`, `.chip`, `.pill`,
  `.field-grid`). See DESIGN.md.
- 3D hostel viewer (`viewer3d.js`) — genuinely detailed architectural modelling:
  leaf-cluster massing with louvred facades, pilotis, atrium cores, roof
  lanterns, cycle courts, planter seating. A separate three-pod green-and-white
  model for the older shared-room hostels (Vivekananda, S N Bose). Floor
  isolation, click-to-inspect rooms.
- Floor plan: 30 selectable rooms overlaid on the real IIT-H typical-floor
  drawing, with a room detail panel. Room-fill polygons are calibrated to the
  actual traced wall coordinates (see 2026-07-25 log entry).
- Student room-swap listing form, stored per-device until the shared Sheet is
  connected.
- **Phase 1 swap-board reset.** All invented residents, deterministic occupancy,
  fake vacancies, friend selections and seeded requests were removed. The map
  now starts with every room **Unlisted**. The new student listing form collects
  name, email, phone, current hostel/room, willingness to move, and three
  destination preferences. Email and phone are never displayed in the room UI.
- Added the four swap states throughout the floor plan and 3D viewer:
  Unlisted, Registered, Open to swap, and personalized Match for you. No UI or
  data source labels a room vacant.

### Not done / open items, roughly in priority order

1. **Google Sheet connection is not built yet.** Phase 1 listings live only in
   the current browser; they are intentionally not shared. `DataSource.load()`
   has a `NIVAS_LISTINGS_ENDPOINT` seam and will refresh a configured sanitized
   endpoint every 15 seconds. Phase 2 needs a Google Form → private response
   Sheet → Apps Script read-only feed. That feed may return only `{ id, hostel,
   room, willingToMove, preferences }`, never name, email, or phone.
2. **No shared contact flow yet.** Room cards intentionally show no contact
   details. Phase 3 should send a private expression of interest rather than
   exposing phone/email publicly.
3. **No verification.** This is an explicit product decision for the first
   release. Add an expiry timestamp and a report/remove path with the Sheet
   integration, because unverified entries can become stale or false.
4. **Not deployed.** GitHub + Hostinger is the plan (same setup as the Sanchari
   transport project). Nothing is connected yet.
5. No authentication. Listings are unverified by design in this phase.
6. Site view and Campus map views exist but are hidden in the toolbar
   (`.seg-btn.hidden`) — deferred, not removed. Restore when campus-scale
   exploration is wanted.
7. The "Availability" nav tab is a placeholder that only fires a toast.
8. 3D geometry is *reference-informed*, not surveyed. The city layout uses
   approximate positions from the Hostel Office map. **Don't present it as
   precise wayfinding** until institute-verified coordinates or GIS geometry are
   added.

### Constraints and decisions — don't re-litigate these without a real reason

- No build step, ever. Static files only.
- three.js stays vendored. Don't swap it for a CDN link.
- Brand red is for interactive elements only; room status colours are a separate
  ramp, and vacant is outlined not filled. This exists to stop a red button and
  a red room meaning different things on one screen. See DESIGN.md.
- Status colours are duplicated in `viewer3d.js` (`statusColors`) because
  three.js can't read CSS variables — **change both or they drift.**
- `assets/` imagery is supplied IIT-H material, not agent-generated. Ask for a
  new file rather than regenerating.
- Bump the `?v=` query on `styles.css` / `app.js` / `viewer3d.js` in
  `index.html` on every change — shared hosting CDNs serve stale assets
  otherwise. (This bit the Sanchari project hard; don't repeat it.)
- **Bump it LAST, after every file edit is written — never first.** If you
  bump at the start of a session and the page is loaded while you're still
  editing, the browser caches a half-written stylesheet under the new URL and
  keeps serving it on every later refresh, because the URL never changes
  again. This produced a page that looked catastrophically broken while the
  files on disk were perfectly fine (2026-07-26). If it happens anyway, bump
  again to move past the poisoned entry.

---

## Log (newest first)

### 2026-07-27 (later) — 10 floors, hostel names that don't get cut, the default-hostel bug, listing-ordered dropdown

- **10 floors, not 9.** `FLOOR_COUNT` in both `app.js` and `viewer3d.js`, plus
  the two "9 floors" strings in `index.html`. Floor 10 makes room ids four
  digits (`1001`); `roomMeta()` already handled 3–4 digits, verified: `1001` →
  floor 10 / pod 1, `1030` → pod 4, `1031` and `1101` correctly rejected.
- **The default hostel bug was real, and it wasn't the earlier commit's fault.**
  `buildingIndex` was an index into the static `HOSTELS` constant, while
  `currentBuilding()` read `db.hostels[buildingIndex]` — a *different*,
  API-ordered array. Locally the two happened to agree so it opened on
  Varahamihira; on the live API they don't, so it opened on Bhabha. Setting the
  index "correctly" could never have fixed this. Now tracked by **name**
  (`buildingName` / `DEFAULT_HOSTEL`), which also survives the dropdown being
  re-sorted. `setBuilding()` takes a name; all three call sites updated.
- **Hostel dropdown is ordered by listing count, busiest first**, ties
  alphabetical. `updateSummary()` already re-rendered the menu every 20s, so the
  order stays live — but it is frozen while the menu is open, because re-sorting
  under an open dropdown moves the option the user is reaching for. (Same class
  of bug as the 20s room-selection reset noted further down this log.)
- **Names no longer get cut.** Two causes: `makeNameTexture()` drew at a fixed
  116px, and the longer names (Varahamihira, Kalpana Chawla, Viswesvaraya)
  measured wider than the 1024px canvas and were clipped mid-word; and the
  facade band they sat on was narrower still. The texture now shrinks to fit
  (checked across every hostel name — the five long ones drop to 86–104px), and
  the label moved from two fixed facade planes to **one sprite above the roof**.
  Fixed planes also showed mirrored from behind, which the sprite cannot do
  since it always turns to face the camera. Verified legible after orbiting.

### 2026-07-27 — 3D building rebuilt from the floor plan itself; the two blocks now link instead of overlapping

Chandan compared the 3D top view against `assets/iith-typical-floor-plan.png`
and against four photographs of the real hostels (Kalam and Bhabha), and the
massing did not survive it. Two problems, one structural and one about the
elevation.

**The massing was wrong, not just imprecise.** `createResidentialBuilding()`
placed two hand-positioned cross clusters 8.9 units apart while each cluster's
wings reached 5.2 units — so the wings interpenetrated and the "bridge" between
them was buried inside the overlap. Worse, the 3D and the 2D floor plan
disagreed about what a *pod* is: the viewer treated the four **wings of one
cross** as pods 1–4, whereas `app.js`'s traced `roomShapes` put pods 1–4 on
**four separate crosses** in a zigzag. Only half the building existed, and the
half that did was labelled wrong.

**Fix: stop hand-placing anything.** Added `docs/trace-outline.py`, which reads
the perimeter straight out of the plan drawing — flood the white paper from a
corner so every pocket *inside* the drawing falls out, union that with app.js's
room polygons (rooms leak to the outside through their door openings, so they
are not pockets), close the wall hairlines, then walk and smooth the boundary.
It emits `plan-geometry.js`: a 480-point perimeter ring plus, for each of the 30
rooms, the stretch of that ring the room fronts onto. Coordinates stay in the
same 1748×1252 plan space `app.js` and the floor-plan `viewBox` already use, so
**the 3D massing and the 2D plan are now literally the same drawing** and cannot
drift apart. Verified by overlaying the generated ring back onto the PNG: it
sits on the perimeter, every room run lands on its own room, and pod 3's two
void cells land on the north edge of the big south court.

**The elevation was wrong too.** The photographs show one continuous white band
wrapping every floor in a smooth wave, dense coral louvre fins filling the gap
between bands, flat red wall with windows only where rooms front the perimeter,
and an open pilotis ground floor. The old model built that out of ~11,000 little
boxes (`waveFascia` alone was 6,624) and still read as stacked plates with
free-standing drums. Now each floor is: one extruded band ring, one extruded
wall ring, one *merged* louvre screen (see `mergeBoxes()`), and 30 room panels.
Roughly 700 meshes for the whole building instead of ~11,000 — measured 60 fps,
where the old build was noted as laggy.

Retuned to the real proportions while I was in there: 1 world unit ≈ 2 m, so the
block is ~75 m × 39 m — long and low, as it actually is, not the tower the old
spacing implied. Camera, fog and `setFriendMode()`'s reset were widened to suit.

**Dent on the south facade (same session, Chandan spotted it).** The first
generated ring had a needle at plan (783, 871) — pod 2's service block, where a
short wall stub meets the perimeter. A sliver of background was trapped beside
that stub; because the sliver stays open to the outside, the ink-level close
could not reach it, and extruded nine storeys it read as a square dent in the
facade. Fixed with a second morphological close on the *filled* footprint
(`SLIVER_RADIUS`, 18 px), which by definition removes any notch narrower than
36 px. Silhouette drift elsewhere is 3 px median / 15 px worst, i.e. under half
a world unit at the very worst, and all 30 room runs still resolve.

`trace-outline.py` now also refuses to emit a ring that folds back on itself: a
needle makes two points far apart *along* the ring end up close *in space*,
while a real corner — however tight — keeps its chord comparable to its arc.
Checked the guard fires on the old ring before trusting it. This matters because
nothing downstream can tell a traced artefact from a real building feature.

**Also fixed, found while testing:** isolating a floor did not stop you clicking
rooms on the hidden floors. `Raycaster` does not honour visibility, and a room
panel's own `visible` flag stays `true` when `setFloor()` hides its floor
*group*, so the old `.filter(mesh => mesh.visible)` did nothing. Replaced with
`pickable()`, which walks the parent chain. Pre-existing, not a regression.

Unchanged on purpose: the room-id scheme (`floor` + 2-digit room, 1–30), the
`nivas:room-click` / `nivas:building-change` contract, the city view, and the
hidden pod-hostel massing.

**Still open:** the four pod centres carry stair/lift heads on the roof but no
modelled core inside the atrium — the footprint is solid, so you cannot see down
it. Fine for now; revisit if the atrium ever needs to read as open.

### 2026-07-26 (just before first push) — Mobile was genuinely broken; full ≤690px revamp

Chandan called this out right before the first GitHub push: "mobile is
completely broken, useless and shitty." He was right. Verified with real
metrics, not just a screenshot: `document.documentElement.scrollWidth` was
89px wider than `clientWidth` at 375px — real horizontal overflow, not a
visual impression. Root-caused and fixed every instance found, all scoped
inside the existing `@media (max-width: 690px)` block — nothing above that
breakpoint was touched; 1024px and 1440px were screenshotted before and after
to confirm they're pixel-identical to before this entry.

**What was actually broken, and the real cause of each:**
- `.head-stats` (the 3 listing-count pills) and `.key` (the 4-item status
  legend) both forced a single nowrap flex row wider than any phone screen —
  "Match for you" and "matches for you" were getting clipped at the viewport
  edge. Fixed: `.head-stats` is a 2-column grid on mobile (the third stat
  spans the full row); `.key-item`s wrap 2-up. Nothing shrunk or truncated to
  fit — same font sizes, same full label text, just wrapped instead of
  forced onto one line.
- The listing form's name/email/phone row and the feedback form's four
  fields were still rendering 2-3 up with placeholders cut to "Your full",
  "you@iitr…", "Choo…". Root cause, not obvious from the CSS alone: these
  forms use `.form-grid`, a 6-column grid where each field spans 2, 3, or 6
  columns (`.span-2`/`.span-3`/`.span-6`). My first fix attempt set
  `.form-grid { grid-template-columns: 1fr }` and nothing changed visually —
  **`grid-column: span 3` on a grid with only 1 explicit column does not
  clamp to that column; CSS Grid creates extra implicit columns to satisfy
  the span instead.** Fixed by also pinning every `.span-*` child to
  `grid-column: 1 / -1` on mobile. Worth remembering if any other span-based
  grid gets a mobile override later — the "just set grid-template-columns"
  fix silently doesn't work.
- The destination-preference rows (rank number + hostel select + pod select,
  ×3) used a fixed `28px 1.4fr 1fr` grid, squeezing two selects into ~150px/
  ~105px — "Choose a hostel" and "Any pod" were unreadable. Fixed with
  `grid-template-areas` so rank+hostel share the top line and pod gets its
  own full-width line below. Also had to target `.preference-row > .select`
  (the wrapper `enhanceSelect()` inserts around every native `<select>`), not
  the `<select>` itself — the native element is hidden inside that wrapper
  post-enhancement, so `grid-area` on it does nothing visible.
- `.three-title` and `.three-readout` (the floating labels over the 3D
  canvas) would overlap at rail-adjusted mobile stage widths (~320px) — the
  readout's own `min-width: 224px` left no room for the title in the
  opposite corner. `.three-readout`/`.three-credit` are hidden on mobile
  ("drag to rotate" is a known touch gesture, not essential); `.three-title`
  is repositioned and capped at 60% width.
- `.building-choice` at full mobile width used `justify-content:
  space-between` on its 3 children (dot/name/chevron) — evenly spaces all
  three instead of keeping the dot next to the name. Fixed by giving the
  name `flex: 1` instead, so the chevron is pushed right by the name filling
  space, not by spacing the dot away from it.
- Added `html, body { overflow-x: hidden }` as a backstop: `.key-item small`
  (the hover tooltip) is `position: absolute` and still widens
  `scrollWidth` even at `opacity: 0` — an invisible element could still
  cause an empty rubber-band horizontal scroll with nothing visible in it.
- Bumped `styles.css?v=37` through several intermediate verify-then-fix
  cycles (v34→v37); each one caught by re-measuring `scrollWidth` /
  screenshotting after the previous fix, not assumed correct on the first
  attempt.

**Verified interactively at 375×812**, not just read: hero, both the 3D and
floor-plan stage views, a room click populating the detail card, the hostel
dropdown open, the full listing form including the destination-preference
rows, the feedback form, the bookmarks modal, the activity modal. Confirmed
zero horizontal overflow (`scrollWidth === clientWidth`) after each fix, not
only at the end. Confirmed 1024px and 1440px unchanged by screenshot.

**Not verified:** very small phones below 375px (360px Android width is
common and untested), landscape phone orientation, and real touch input
(all verification here was synthetic click/JS dispatch in a desktop browser
emulating a mobile viewport — genuine touch behaviour, e.g. `:hover` states
on tap, wasn't tested on an actual device).

### 2026-07-26 (later night) — Made the repo public-ready: GitHub deploy key, MIT license, README rewrite, fixed an exposed personal email

Chandan wants this repo public on GitHub — not just to deploy, but as a real
piece of his public engineering portfolio ("everything I did is public").
Audited the repo for anything that shouldn't be world-readable before that
happens, then did a full public-facing polish pass. No functional/UI changes
in this entry — packaging only.

- **Found and fixed a real exposure:** `FEEDBACK_TO` in `app.js` was Chandan's
  actual personal `@iith.ac.in` address, hardcoded in client-side JS shipped
  to every visitor — scrapeable the moment the repo goes public. Same address
  was also the "example" default in `api/config.example.php`. Fixed both:
  `app.js` now reads `window.NIVAS_FEEDBACK_TO ?? "feedback@example.com"`
  (same override pattern already used for `API_BASE`), and the example config
  uses a generic `you@iith.ac.in` placeholder. `docs/DEPLOY.md` gained a
  section explaining the real feedback address only ever needs to live in the
  gitignored `api/config.php`; the client-side constant is only the `mailto:`
  fallback for when the API is fully unreachable, and a real deployer should
  set that via `window.NIVAS_FEEDBACK_TO` in *their own* deployed copy, never
  committed.
- **Added `LICENSE` (MIT)** — Chandan's choice, for maximum reuse.
- **Moved `header.html` into `docs/header-mockups.html`.** It's a scratch
  three-way header comparison, not served by the app; having it loose at the
  repo root made the root look like it contained more served surface area
  than it does. `docs/DEPLOY.md`'s upload-exclusion list and this file's
  folder-structure section were updated; the historical log entries that
  describe it being created at the root were left alone — they're accurate
  history, not current state.
- **Rewrote `README.md` from scratch for a public human audience.** The
  previous version opened with "If you're an AI agent picking this up" and
  had drifted out of date (still said "23 hostels," still described Phase-1
  localStorage-only listings and a not-yet-built Google Sheet connection,
  despite the real PHP/MySQL backend already existing two log entries above
  this one). New version leads with what the project is and why it exists,
  features, stack, and a room-swap-model table, and folds the
  AI-agent/contributor onboarding note into a "Contributing / picking this
  up" section further down rather than the very first thing a visitor reads.
  Deliberately did **not** touch `docs/PROGRESS.md`'s own voice or trim its
  length — the raw build history (mistakes, reverts, and all) is kept as-is;
  only the public-facing README was rewritten.
- **GitHub deploy key generated**, matching the repo-scoped-deploy-key pattern
  already used for `iith-athletics` and `iith-transport`: new keypair at
  `~/.ssh/nivas-deploy`, new `Host github-nivas` alias in `~/.ssh/config`.
  Chandan creates the empty GitHub repo and adds the public half as a Deploy
  Key himself (no `gh` CLI or Homebrew available on this machine to automate
  that part); the actual `git remote add` + push happen in a follow-up step
  once the repo exists on GitHub's side.
- **Left `api/db.php` alone.** It had an uncommitted, in-progress fix from
  Chandan's other Claude Code session (parameterizing the rate-limit query's
  `INTERVAL` clause, which PDO/MySQL doesn't reliably support as a bound
  parameter) sitting in the working tree when this session started. Not mine
  to finish or commit without review — excluded from this commit on purpose.
  Whoever picks this up next: check `git status` for it before assuming the
  tree is clean.
- Bumped `app.js?v=26`. `styles.css`/`viewer3d.js` untouched this session.

**Still open:** everything in the "Not done" / "Still open" lists from the
entries below is unchanged — this was a packaging/publishing pass, not a
feature or backend session. The actual `git remote add` + first push are not
done yet either; see the conversation this session came from for the
handoff.

### 2026-07-26 (night) — Real backend: shared listings, consent-gated contact, bookmarks

**Before this, a multi-user board was impossible.** `persist()` wrote to
localStorage only; `NIVAS_LISTINGS_ENDPOINT` was read-only with no write path;
`sanitiseListing()` stripped name/phone from remote rows by design; and
`DEMO_MODE = true` injected 15 fake Bhabha listings that would have looked real
to students. All four are fixed.

**Backend — `api/`, PHP 8.1+ and MySQL (what Hostinger gives you).**
`schema.sql` (7 tables), `db.php` (config, PDO, CORS allow-list, validation,
per-IP throttle, mail), `verify.php`, `listings.php`, `bookmarks.php`,
`feedback.php`, `.htaccess`. `config.php` is gitignored; `config.example.php`
is the template. Full instructions in **docs/DEPLOY.md**.

- **Identity is email ownership, nothing more.** `verify.php` mails a 6-digit
  code, then issues a long-lived owner token the browser sends with writes.
  This does NOT prove someone lives in the room they list — no allocation data
  exists to check against — but it ties every published phone number to a real
  `@iith.ac.in` mailbox instead of to nobody. `require_verification: false`
  exists for closed testing; **turning it off in public means anyone can
  publish anyone's number.**
- **Consent gates contact.** `share_contact` defaults to 0. The read query in
  `listings.php` never selects the email column at all, and copies name/phone
  into the response only when the flag is set. The frontend mirrors this in
  `sanitiseListing()`. If you add a field, decide which side of that line it
  sits on.
- One listing per room (unique key on hostel+room) and one listing per owner.
- Per-IP throttles: 5 codes/15min, 20 listing writes/hr, 6 feedback/hr,
  120 bookmarks/hr. Campus NAT may make these bite — raise if so.

**Frontend**
- `api()` wraps every call and treats anything that isn't `{ok: true}` as
  offline, including a static host serving raw PHP. A dead API degrades to
  "your own listing only", never to a broken map.
- Listing form gained a **consent panel** (deliberately a panel, not a stray
  checkbox — ticking it publishes a phone number). Verification is a second
  small modal that appears only when the server asks for it.
- Room cards show a **contact card** with WhatsApp and call buttons when the
  student consented, and an explicit "hasn't shared contact details" line when
  they didn't.
- **Bookmarks**: any room in any hostel, optimistic toggle, public aggregate
  count on the card, private per-device token (`nivas_bookmarks` stores a
  hash, no identity). "Saved" in the header opens the full list, which jumps
  to the room. Separate from the three swap preferences by design.
- Board refreshes every 20s so listings from other students appear live.

**Still open / decide before launch**
1. `allowed_origins`, `mail_from` and the DB credentials must be filled in on
   the server — the API returns a clear 500 until then.
2. No admin UI. Removing a bad listing is a `DELETE FROM nivas_owners WHERE
   email = …` in phpMyAdmin (cascades).
3. No backups configured on Hostinger yet.
4. Untested against a live PHP host — no PHP locally, so the endpoints have
   been reviewed by eye but never executed. **Run through one real listing
   end-to-end before sharing the link.**
5. Pod 3's two missing cells are still my inference (south wing), unconfirmed.


### 2026-07-26 (evening) — Branded header, feature-request form, detail panel as cards

- **Header is now a branded band** (option C of three mocked up in
  `header.html`, which is kept in the repo as a scratch comparison page — it is
  not linked from the app and uses dummy data). Soft brand gradient, the
  facade's louvre rhythm as a faint motif fading in from the right, wordmark +
  descriptor on the left, two actions on the right. ~92px.
  - The mock had a live "10 rooms open" readout; **dropped, because it repeated
    the count chip directly below it.** Replaced with what the board covers
    ("16 hostels · 9 floors · 30 rooms per floor"), which the counts don't say.
- **New `.btn--outline`** — transparent, brand border and text. A fifth button
  variant; DESIGN.md's "every control is one of four" list is updated.
- **Feature request / bug report form** (`#feedback-modal`, header button).
  Collects name, reply-to email, optional phone, optional hostel, a type tile
  (feature / bug / something else) and a message.
  - **No backend, so it builds a `mailto:` to `FEEDBACK_TO`** with everything
    pre-filled. `sendFeedback()` posts JSON to `NIVAS_FEEDBACK_ENDPOINT`
    instead when that's configured — same seam pattern as the listings feed.
    The helper line under the form tells the student which of the two will
    happen. Note `FEEDBACK_TO` is a real address sitting in client-side source;
    if the repo goes public it is scrapeable — swap it for an Apps Script
    endpoint before wide release.
- **Room detail column is a stack of cards**, not one tinted strip: a
  status-coloured identity card (title left, status pill hard right) carrying
  Room / Floor / Pod as large figures, then the ranked choices as a separate
  card. Radius follows `--r-lg` like everything else.
- **Fixed a silent data-loss bug introduced earlier the same day:** `POD_SIZES`
  was declared *below* `const state = loadState()`, which runs at parse time
  and calls `roomMeta()`. The temporal-dead-zone `ReferenceError` was swallowed
  by `loadState`'s `try/catch`, so **every saved listing was being discarded on
  load**. Constants now sit above first use. Lesson: a `catch` that returns a
  safe default turns a crash into invisible corruption — be wary of blanket
  catches around parsing.
- `tmp/` is now gitignored (scratch PDF renders from an earlier session).

### 2026-07-26 (later) — Floor-plan rooms traced from the drawing; toolbar, listing form and 3D signage reworked

Several rounds of Chandan's feedback in one session. **He called out, correctly,
that the floor-plan work got deferred while later requests were done first** —
worth avoiding: do the detailed, hard request before the easy ones that arrive
after it.

**Floor plan — the room polygons are now traced, not estimated.**
`docs/trace-rooms.py` is the script that produced them and should be re-run if
`assets/iith-typical-floor-plan.png` is ever replaced. Method: threshold the
image to a wall mask, dilate by 14px to seal doorways (below 12px the fill
escapes into the whole floor), flood-fill each room from a seed, dilate the
region back and subtract the walls, then convex-hull and simplify to ~7 points.
- **Rooms are chamfered pentagons/hexagons, not rectangles.** Every room is cut
  at an angle where it meets the octagonal atrium; the old rectangles ignored
  that and spilled over walls.
- **The old pod offsets were wrong** — (330,360)/(1040,360)/(710,0) against
  measured pod centres of (346,334), (1059,334), (706,694), (1422,694), i.e.
  offsets (713,0), (360,360), (1076,360). That drift is why highlights sat off
  their rooms.
- **30 rooms: pods of 8 / 8 / 6 / 8.** I first shipped this as 32 because all
  32 cells in the drawing look like bedrooms in the contact sheet — and that
  was a straight mistake. **Chandan had already stated 8/8/6/8 = 30 and had
  circled the two missing cells; the drawing is not the authority on what the
  building has, he is.** Don't re-derive a stated fact from an asset. The
  trace's job was to find *which* cells, not to recount them.
- Pod numbering follows Chandan's labels on the marked-up plan: 1 = upper-left
  (01-08), 2 = lower-middle (09-16), 3 = upper-right (17-22, the six-room
  pod), 4 = lower-right (23-30). `POD_SIZES` drives `POD_OF_ROOM` and
  `podRange()`, so room->pod is a lookup, not arithmetic.
- **`voidShapes`** holds pod 3's two missing cells — the south-wing pair. They
  render struck through and inert: no number, no status, no hover, no click,
  never counted. **The pair is my reading of his mark** (it lands on that
  pod's centre-facing side); if it's the wrong wing, change `MISSING` in
  docs/trace-rooms.py and regenerate, or swap the two paths.
- Pods 2 and 4 are the same layout rotated 180° (service core at the opposite
  corner), which the trace picks up automatically.
- Note for later: other hostels have different pod counts. This drawing is the
  one type; per-hostel plan variants aren't modelled yet.

**Toolbar / key / colour**
- View switch moved to the right corner; the status key took its place in the
  toolbar. Key shows four labels only, with each meaning as a hover/focus
  tooltip. The bottom key band is gone; privacy line moved below the card.
- **Status colours are a traffic light now**, at his instruction: red
  `#d6452f` = Registered/not moving, yellow `#e0a318` = Open to swap, green
  `#2f9161` = Match. Mirrored in `viewer3d.js` `statusColors`. This overrides
  the old "brand red is never a room status" rule — the status red is a warmer
  vermilion, deliberately distinct from `--brand-600`.
- Head counts are chips with status dots. Prev/next hostel arrows removed
  (the dropdown already did it).

**Listing form**
- Details in two rows (name/email/phone, then hostel/room) on a 6-column grid.
- "Are you willing to move?" is two consequence-stating tiles with hover lift
  and status colouring, not radio dots.
- Section headings use the design system's type, not the mono `.u-label`.
- **Every `<select>` is upgraded by `enhanceSelect()`** to the app's own
  dropdown; the native element stays in the DOM as the source of truth, so
  form reads/writes are unchanged. Call `syncSelect()` after changing options
  or the value in code.
- Added **Remove my listing**. Choosing a first preference no longer opens the
  activity modal on top of the form.

**Room detail column**
- With no room selected it shows the student's own listing and ranked top
  three choices instead of sitting empty.
- **The whole column takes the status colour**, not just the pill; nested
  cards lift to translucent white to stay legible.
- "Contact requests arrive in Phase 3" removed.

**3D** — the hostel name is rendered in brushed silver on the link block
between the two clusters, front and back, mid-height, regenerated per hostel
in `setBuilding()` via a canvas texture. **Not visually confirmed**: the
default camera angle hides that band behind the towers.

**Verified** by headless screenshot: corrected floor plan with highlights
inside the walls, void-cell cross treatment (temporarily forcing cells 18/21),
the listing form, the tinted detail column in both red and yellow states, and
the traced-polygon overlay against the source drawing. `node --check` on both
JS files; every `getElementById` resolves.

### 2026-07-26 — Fixed the reference-screenshot rebuild: floors left, key along the bottom, right column for room detail only

Chandan went through the previous session's build and listed what was wrong
with it. Every item below is his, not an agent's idea. **The through-line: the
floating-cards approach from the entry directly below caused most of these
bugs.** Cards positioned over the artifact collide with each other and with
anything that opens from the toolbar, and they eat the space the model needs.
Replaced with real columns.

- **Overlap bug — hostel dropdown vs the key card.** Two causes, both fixed:
  `.explorer-card` had `overflow: hidden`, which clipped the menu, and the
  key card floated exactly where the menu opened. The card no longer clips
  (corners are rounded on `.toolbar` and `.key-bar` instead) and the key is
  no longer in the stage at all. `.toolbar` is `z-index: 5` over
  `.stage-grid`'s `1`.
- **Zoom controls deleted** — "not at all required". `.zoom-controls` markup,
  CSS and the three JS handlers are gone, along with the now-unused
  `.plan-wrap.zoomed` rule. `viewer3d.js` still exposes `zoomIn`/`zoomOut`/
  `resetView`; left in place, nothing calls them.
- **"My swap listing" nav tab deleted** — it opened the same modal as the
  "Create my swap listing" button. One control, one action. The button now
  reads "Update my swap listing" once a listing exists (`renderProfile()`).
  With the nav gone, the `[data-tab]` handler went too.
- **The header is a pill now**, inside the page column at the same width and
  with the same hairline/radius language as the explorer card, instead of a
  full-bleed sticky website banner that "doesn't look like it belongs".
- **Counts moved up beside the headline** (`.page-head` → `.head-stats`),
  out from under the artifact and out of the room-detail card's footer.
  `.insight-row`'s two tiles are gone entirely — their copy ("Want to move to
  Bhabha 0") was unreadable as a sentence; the same numbers are in the Swap
  activity modal, now opened by a quiet text button next to the counts.
  `updateInsights()`/`topDestination()` deleted with them.
- **Floors moved from a toolbar `<select>` in the top-right corner to a
  vertical rail on the left of the stage**, per his note that there was free
  space there. `renderFloorSelect()` → `renderFloorRail()`. The "ALL" button
  renders only in the 3D view (the plan always draws one specific floor).
- **The key is a horizontal band along the bottom of the card and each colour
  now says what it means** — he said he didn't understand the four states.
  "Unlisted · nobody has posted about this room", etc. Descriptions hide
  under 1280px, labels never do. The privacy line rides at its right end,
  replacing the old `.privacy-tile`.
- **The right column is now room detail and nothing else**, wider (316px) and
  a real grid column rather than a floating card, with the empty state
  vertically centred. `.stage-grid` is `68px | 1fr | --detail-w`.
- New breakpoints: **1280px** (detail 280px, key descriptions fold), **1060px**
  (detail column drops below the stage, head stats go horizontal), **690px**
  (topbar wraps, CTA full width, rail 52px).
- CSS sections renumbered — 06 Stage row and 07 Status key are new, so Views
  → 08, Room detail → 09, Modals → 10, Refinements → 11, Toast → 12. The
  index comment at the top of the file matches. DESIGN.md's Layout section
  was rewritten with a new diagram and the reasons each of these is the way
  it is.
- Bumped `styles.css?v=24`, `app.js?v=17`. `viewer3d.js` untouched (still v9).

**Cache incident during this session — read the constraint added above.** The
version was bumped to v=23 *before* the CSS was written rather than after.
Chandan refreshed inside that window, his browser cached a stylesheet that
had the new topbar rule but none of the stage/key/head rules yet, and every
later refresh re-served it from cache because the URL never changed again.
The page looked broken (stats as raw text, floor rail collapsed across the
top, key overflowing the card) while the files on disk were correct and
valid. Diagnosed by curl-ing the served CSS and checking brace balance and
selector presence — all fine, which is what pointed at the cache rather than
the code. Fixed by bumping to v=24/v=17.

**Verified** by headless screenshot at 1512×950: the floor-plan view with a
room selected, the 3D view (real WebGL render), the hostel dropdown *open* —
the specific overlap he reported, now clean — and the stacked layout at
1000px. Plus `node --check`, HTML tag balance, and a check that every
`getElementById` in `app.js` still resolves against the markup.

**Not verified:** 690px phone width, and the listing-form modal (unchanged
this session, but the CTA that opens it was rewired).

### 2026-07-25 (late night) — Rebuilt around a reference screenshot: top navbar, floating context cards, dropdown floor selector

Chandan sent a reference screenshot of a "Hostel Exchange" mockup (clean navy
navbar, one explorer card, small floating "Key"/zoom/room-detail cards over
a full-bleed 3D building, two insight tiles + a privacy note below) and asked
for the structure specifically, in our own palette, with our real 3D/floor-plan
content — not the reference's invented features (Matches/Messages/Dashboard/
bookmarks) that we don't have. This lands on top of the entry directly below
(that session's two-column rail layout), which the reference's floating-card
approach replaces.

- **Sidebar/rail is gone again — replaced with floating cards over the stage.**
  `.context-rail` (`.rail-pitch`/`.rail-hostel`/`.rail-stats`/`.room-panel`)
  deleted. In its place, three small cards sit *inside* `.panel-stage` as
  absolutely-positioned siblings of `.hero-model`/`.visual-stage`:
  `.key-card` (top-left, the room-status legend, now a vertical swatch list
  instead of a toolbar chip row), `.zoom-controls` (bottom-left, +/−/⟲),
  and `.room-detail-card` (top-right, `id="room-panel"` — same ids/classes
  inside it as before: `#panel-empty`/`#panel-detail`, so `openRoom()` needed
  only a small signature change, not a rewrite). Added a persistent
  `.room-detail-stats` footer inside that same card (listed/open/matches),
  reusing the `#rooms-count`/`#open-swap-count`/`#match-count` ids.
- **Page is a normal scrolling page again**, not viewport-locked. `.app-shell`
  dropped `height:100dvh`/`overflow:hidden`; `.topbar` is `position:sticky`
  instead. `.page` holds `.page-intro` (headline only — the old eyebrow and
  two-line hero copy are gone, reference has one plain headline),
  `.explorer-card` (toolbar + stage, `clamp(440px, 58vh, 600px)` fixed-ish
  height so the floating cards have a stable frame), and `.insight-row` below.
- **Floor selection is one `<select>` in the toolbar**, not a rail of
  buttons — matches the reference's "All floors ▾". Replaces *two* different
  floor-rail implementations that existed before this (`.floor-rail` light,
  `.floor-rail--dark`, both deleted along with the floor-plan's old
  `.floor-heading`/`#floor-label`/`#floor-title`). `app.js`: `renderFloors()`
  removed, replaced by `renderFloorSelect()` (repopulates with an "All
  floors" option only when the 3D view is active — floor-plan can't show
  "all") and `applyFloorSelection()`, which drives either
  `window.nivasViewer.setFloor()` or `activeFloor` depending on
  `activeView`. `selectView()` now also calls `renderFloorSelect()` so
  switching views keeps the dropdown's option list correct.
- **Room clicks are unified across both views.** `openRoom(id, element)`
  lost its `status`/`index` params (recomputes status internally) and its
  hard dependency on an SVG element (`element` is now optional — floor-plan
  passes the clicked path for the `.selected-room` highlight, 3D passes
  nothing). `viewer3d.js`'s pointerdown handler now also dispatches
  `nivas:room-click` with `{ id: visualRoomId }`; `app.js` listens and calls
  `openRoom()`, so clicking a room in the 3D view populates the same
  floating detail card the floor plan uses — previously 3D clicks only
  updated the on-canvas `.three-readout` text.
- **Added camera zoom to `viewer3d.js`**: `zoomIn()`/`zoomOut()`/
  `resetView()`, dollying the camera toward/away from `controls.target`
  (OrbitControls doesn't expose this itself). Exported on `window.nivasViewer`.
  The zoom buttons call these in 3D view, and toggle `.plan-wrap.zoomed`
  (already existed) in floor-plan view.
- **Hid the on-canvas `.three-title`/`.three-readout` text overlays** —
  they'd sit under/behind the new `.key-card` and duplicate what the
  room-detail card and toolbar already say. Left the elements and their
  `app.js` text-setting code alone (harmless if unused) rather than ripping
  them out, in case a future session wants them back for a view without
  the floating cards.
- Removed `#swap-activity` button (folded into the two insight tiles, which
  both open the existing `activity-modal` via `openActivity()`) and the old
  `--rail-w` custom property.
- Bumped `styles.css?v=23`, `app.js?v=16`, `viewer3d.js?v=9`.
- Verified interactively (this was real-time back-and-forth, not a
  batch instruction): view switching, floor dropdown in both views, room
  click from both the floor plan *and* the 3D view populating the same
  card, zoom buttons, building-menu dropdown (16 hostels), nav tabs, create-
  listing CTA. No console errors. Did not verify mobile (<690px) beyond one
  screenshot — the room-detail card is narrow and may feel cramped there;
  check before shipping mobile.

**Note for whoever picks this up next:** this file's own history shows three
different landing-page structures in three consecutive sessions (sidebar →
two-column rail → floating cards). Read this entry and the one below it
together before proposing a fourth — the reasoning for *why* each was
replaced is what matters, not just the current markup.

### 2026-07-25 (night) — Landing page rebuilt as a two-column app: header + artifact + context rail

Chandan's brief: the landing page was "disorganised, unnecessary spaces and no
proper structure" — keep a side-by-side view, give the artifact enough space,
and if it doesn't fit, drop the sidebar and fold it into a two-column page.
He picked the structure from three mockups (slim top header, then two columns)
and chose a viewport-locked page over a scrolling one.

**What the old layout was actually doing wrong:** the artifact was the fourth
thing down the page (sidebar / hero band / toolbar / legend band / 500px stage),
so on a 950px-tall window roughly 45% of the height went to chrome and copy
before the model got any. Three separate bands (hero, toolbar, legend) each ate
vertical space to say very little, and the room-detail panel was a third column
*inside* the floor view, squeezing the drawing it was describing.

- **Removed the sidebar entirely.** Nav (`.main-nav`) and the single primary CTA
  moved into a new 60px `.topbar` alongside the brand. `.sidebar`,
  `.sidebar-bottom`, `.help`, `.main-content` and their §10 overrides are gone.
- **New two-column `.workspace`**: `minmax(0,1fr)` artifact column
  (`.stage-col`) + `--rail-w` (328px) `.context-rail`, separated by one
  hairline. `.app-shell` is `100dvh` / `overflow: hidden` with rows
  `auto minmax(0,1fr)` — the landing page no longer scrolls at all above
  1024px; the only scroll container is the rail's `.room-panel`.
- **`.panel-stage` lost its fixed 500px height** — it's now the `1fr` row, so
  the artifact takes every pixel the toolbar leaves. At 1512×950 the stage went
  from 500px to ~830px tall and full-width. `.plan-wrap` likewise went from a
  fixed 356px to `flex: 1` (the SVG viewBox keeps the drawing's aspect ratio,
  so the extra height is scale, not distortion).
- **Killed two horizontal bands.** The hero band is gone: its pitch/eyebrow
  moved into `.rail-pitch`, its CTA into the topbar. `#legend` moved *inside*
  `.toolbar`, pinned right — still shared by both views, but no longer costing
  a 38px strip of its own.
- **`#room-panel` moved out of `.floor-view` into the rail**, so `.floor-view`
  is now two columns (floor rail + drawing) instead of three. Same ids and
  classes, so no `app.js` selector changes were needed. Deleted the old
  `.room-panel { display: none }` at 980px — the rail owns it now and hiding it
  would leave tablets with no way to read a room's status.
- **Removed the duplicated open-count.** The hero's `.live-summary` showed the
  same number as the "open to swap here" stat tile; the hero block is gone and
  `updateSummary()` no longer writes `#summary-open` / `#summary-open-copy`.
  Stats became `.rail-stats`/`.rail-stat` (renamed from `.sidebar-*`), number
  size `--fs-3xl` → `--fs-2xl` to suit the narrower rail. `setBuilding()` now
  also writes `#rail-hostel-name`.
- **`viewer3d.js`: added a `ResizeObserver` on the canvas.** The stage is
  flex-sized now, so the canvas can change size without the window doing so
  (column stacking, view switching). `renderer.setSize(w, h, false)` doesn't
  touch CSS size, so this can't feed back into a resize loop.
- **New breakpoints** replacing the old 980/690 pair: **1240px** rail → 288px
  and the legend drops its "ROOM STATUS" label; **1024px** the shell releases
  `100dvh` and goes single-column (artifact `62vh` on top, rail beneath, page
  scrolls, stats 3-across); **690px** topbar wraps with nav on its own row,
  stats stack, stage 440px.
- §10 was retitled "Component refinements" — the layout overrides in it were
  deleted rather than re-pointed, since the base rules now describe the real
  structure. DESIGN.md's Layout section was rewritten around the new grid
  (with an ASCII diagram of it).
- Bumped `styles.css?v=22`, `app.js?v=15`, `viewer3d.js?v=8`.

**Verified:** `node --check` on both JS files; HTML tag balance; no orphaned
references to any removed class/id in html/css/js; a headless screenshot at
1512×950 of the **3D view**, with the scene background and floor rail
pixel-sampled to confirm the dark `--scene` treatment survived the
restructure.

**Not verified by me:** the **floor-plan view** and the **stacked breakpoints
(1024px / 690px)**. Headless Chrome needs software WebGL here and each render
took minutes, so those screenshot runs were abandoned rather than waited out.
The floor view is the one to check first, because `.plan-wrap` changed from a
fixed 356px to `flex: 1` and `#room-panel` moved out of `.floor-view` into the
rail — if anything is off in this session's work, it's most likely there. Also
worth a look: rail scrolling with a long room detail open.

**Note, not fixed (pre-existing, out of scope):** in the 3D view's dark floor
rail the buttons render white, because §07's `.floor-rail button` rule (light)
comes *after* `.floor-rail--dark button` (dark) at equal specificity. It reads
acceptably, so it was left alone rather than changed mid-layout-work.

### 2026-07-25 (evening) — Reverted multi-hostel 3D compare; sidebar readability; floor-rail unified; floor-plan re-verified

Live back-and-forth session (not a single batch instruction like the previous
entry) — Chandan tested the multi-hostel 3D compare feature immediately after
it shipped and flagged real problems, so most of this entry is *undoing and
fixing* things from the entry directly below, not new feature work. Verified
interactively in the browser this time since the user was actively testing
alongside me.

- **Reverted the multi-hostel 3D compare feature.** Chandan tried it and
  found two problems: (1) all 3 buildings orbit together since they share one
  camera — expected behaviour for "3 objects in one scene," not a bug, but
  not what he wanted, and (2) it's laggy, because each building is genuinely
  heavy geometry (hundreds of individually placed meshes) and showing 3 at
  once is ~3x the GPU load regardless of camera setup. I laid out the
  tradeoff explicitly: independent per-building orbiting would need a
  split-viewport rewrite (new complexity) and **would not fix the lag**
  (still 3x geometry either way). He chose to revert to one building.
  `viewer3d.js`: `buildingSlots`/`makeLabelSprite`/`layoutBuildings`/
  `CAMERA_FRAMING`/`SLOT_SPACING` removed; back to a single `residential`
  instance built once via `createResidentialBuilding()` (that factory
  function itself was kept — harmless, and a single call is simpler than
  reverting the whole file). `nivas:building-change` event contract reverted
  to single-hostel shape (`{name, roomStatuses}`). `app.js`: `selectedHostels`/
  `focusIndex`/`toggleHostelSelection`/`MAX_SELECTED_HOSTELS` reverted to the
  original `buildingIndex` single-select model; hostel dropdown is single-
  select again (click replaces selection, closes menu); prev/next arrows
  cycle all 16 hostels again, not a selected subset.
- **Sidebar stat numbers were unreadable** — `--fs-lg` (15px) for a number
  meant to be the focal point of its tile. Bumped to `--fs-3xl` (32px, 800
  weight), caption text to `--fs-sm` semi-bold, icon circle 30px → 36px.
  Changed the rooms-count caption from "sample room listings in this hostel"
  to "Rooms listed" (`BUILDING_PROFILE.roomCaption` in `app.js` + the HTML
  fallback) — Chandan didn't want "sample" surfaced there.
- **Removed the floor-plan's redundant `.plan-key`** ("Original architectural
  drawing" / "Highlighted room inventory") — decorative, not asked for,
  Chandan flagged it as visual clutter. Removed from HTML, CSS (base rule +
  the 690px override).
- **Unified the two views' floor selector**, per Chandan's screenshot showing
  the inconsistency directly: the 3D view had "ISOLATE FLOOR" as a dark
  horizontal bar floating at the bottom of the canvas; the floor-plan view
  has `.floor-rail`, a light vertical rail on the left. Restructured
  `.hero-model` to a `74px minmax(0,1fr)` grid (matching `.floor-view`) with
  a new `<aside class="floor-rail floor-rail--dark">` holding the same
  09→01 button stack plus an "ALL" button pinned to the bottom via
  `margin-top: auto` (same slot floor-plan's `.ground-floor` occupies).
  `.three-floor-control`'s old absolute-positioned CSS (base rule, the 690px
  override, the dead `.hero-model .three-floor-control` position override,
  and the friend-city hide rule) all removed/retargeted to the new
  `.floor-rail--dark` class. Verified floor-isolation still works after the
  restructure (clicked floor 09, `.active` class moved correctly).
- **Investigated a specific floor-plan room-fill report** (Chandan marked a
  room in what he read as the top-right pod with "There's rooms doesn't
  exist"). Re-measured all 4 arms of that pod (north/east/south/west)
  against the source PNG the same way Pod 1 was originally calibrated —
  every wall lined up within normal tolerance, no coordinate bug found.
  Likely explanation: his screenshot predates the polygon recalibration from
  earlier the same day (stale page load). **Not conclusively resolved** —
  told him to hard-refresh and, if still wrong, click the specific room in
  the live app so the room panel's ID pins it down exactly instead of more
  coordinate guessing. If this comes back, start there rather than
  re-deriving pixel coordinates from scratch again.
- Confirmed final versions: `styles.css?v=21`, `app.js?v=14`, `viewer3d.js?v=7`.

**Still open:** the floor-plan room-fill report above needs a definitive
close (his confirmation or a specific room ID to chase). Everything else
from the "Not done / open items" list above is unchanged.

### 2026-07-25 (later) — Boys-hostel-only, multi-hostel 3D compare, sidebar stats, floor-plan colour fix

Requested directly by Chandan with an annotated screenshot; changes applied
and committed without an interactive verification loop per his explicit
instruction ("don't self-test, just commit and let me test"). Did a minimal
sanity pass only: `node --check` on both JS files and one headless page load
checked for console errors — not the usual multi-breakpoint click-through.

- **Hostel list is now boys-hostels-only.** Removed the five female-named
  hostels (Anandi Joshi, Gargi, Kalpana Chawla, Maitreyi, Sarojini Naidu) and
  the two pod-layout hostels (Vivekananda, S N Bose) from `HOSTELS` in
  `app.js` — 23 → 16 hostels. `podHostels` is now always empty; the pod-layout
  3D geometry in `viewer3d.js` is unreachable from the live app but left
  intact (not deleted) in case a future session reintroduces those hostels.
- **3D viewer now compares up to 3 hostels at once**, the fix for the large
  dead space around a single building. `viewer3d.js` was restructured: the
  single top-level building construction became `createResidentialBuilding()`,
  called 3 times into `buildingSlots`, laid out side-by-side (24 units apart,
  centred) with a floating canvas-sprite label per building showing its name
  and aggregated open/match counts colour-coded to the status tokens. Camera
  framing scales with 1/2/3 visible slots (`CAMERA_FRAMING`). The
  `nivas:building-change` event contract changed from a single
  `{name, podLayout, roomStatuses}` to `{hostels: [{name, roomStatuses,
  openCount, matchCount}], focusIndex}` — both sides of this event were
  rewritten together.
- `app.js`'s single-hostel model (`buildingIndex`) became a multi-select model
  (`selectedHostels` array, max 3, plus `focusIndex` for which one drives the
  floor plan / room panel / sidebar stats). The hostel dropdown is now
  checkbox-style multi-select (`toggleHostelSelection`), capped at 3 with a
  toast when the cap is hit or the last hostel would be deselected. Prev/next
  arrows now cycle `focusIndex` across the selected set, not all hostels.
- **Sidebar widened slightly** (220px → 248px, `main-content` margin adjusted
  to 280px to match) and now shows the three activity stat tiles
  (`.sidebar-stats`/`.sidebar-stat`) stacked below the nav, moved out of the
  bottom of the main panel — same ids (`rooms-count`, `open-swap-count`,
  `match-count`), no `app.js` logic change needed, just relocated markup.
- **Removed the redundant sidebar "Create your listing" card** (`resident-
  mini`/`profile-menu`) — the hero's "Create my swap listing" CTA and the
  "My swap listing" nav tab already cover that entry point. Removed its
  now-dead CSS and the `renderProfile()` DOM writes that targeted it.
- **Removed the hostel search bar** (input, ⌘K, results dropdown) per direct
  request — it had only just been revived from a pre-existing bug earlier
  today; removing it was a deliberate simplification this time, not a
  regression. Removed the dead `.search`/`.search-result*` CSS and JS
  bindings along with it.
- **Room-status legend now shared between 3D and floor-plan views.** It was
  nested inside `.hero-model` (dark-scene-only styling), so it disappeared
  when switching to floor plan. Moved `#legend` to sit above `.panel-stage` as
  its own bar, restyled to the neutral light `.legend` base rule instead of
  the dark override, visible regardless of which view is active.
- **Floor-plan room-fill polygons recalibrated to the actual drawing.** The
  previous `podRoomPolygon` coordinates were undersized and offset from the
  real room walls (verified by rendering a red-outline overlay over
  `assets/iith-typical-floor-plan.png` with Python/PIL and reading wall
  coordinates off a pixel grid — see the room-by-room pixel measurements
  taken this session if this needs redoing). All 8 base room shapes were
  replaced with rectangles hugging the measured wall boundaries; propagates
  correctly to all 4 pods via the existing offset system.
- Bumped `styles.css?v=19`, `app.js?v=13`, `viewer3d.js?v=6`.

**Not verified interactively this session** (by instruction): exact camera
framing quality for 2- and 3-hostel comparison, building-label sprite
readability/positioning, checkbox multi-select UX at narrow widths, and
whether the floor-plan polygon fix is pixel-perfect on every pod (only the
top-left pod was cross-checked against a fine-grained pixel overlay; the
other three inherit the same shapes via the existing offset system and
looked right on a full-image overlay, but weren't independently measured).
Flag anything off in these areas back for a follow-up pass.

### 2026-07-26 — Structural overhaul: one unified panel, not four floating cards

- **The core fix.** `styles.css` §10 ("Bento interface refresh") gave
  `.hero-toolbar`, `.hero`, and `.workspace` each their own independent
  margin/border/radius/shadow — three-to-four separately-styled "cards"
  stacked with gaps between them. That's what read as disorganized. Merged
  all of it into one `.app-panel` shell (pitch strip → toolbar → stage →
  stats) with internal hairline dividers instead. See DESIGN.md's Layout
  section for the new structure and the rule not to re-fragment it.
- Tried delegating this as a written prompt to a different tool (Antigravity/
  Gemini 3.1 Pro) first — it just re-spaced the same fragmented cards across
  more width (huge dead gap between the view-switcher and the swap-activity
  stat), because it never actually looked at the rendered page. Did the
  restructure directly instead, verifying in-browser after each change.
- **Fixed a real bug in the process:** the topbar (breadcrumbs + hostel
  search + notification bell) was set to `display:none` in §10 but the
  markup was still in the DOM — meaning ⌘K search was silently unreachable
  (a hidden element can't receive focus). Deleted the dead breadcrumbs and
  notification bell (no JS ever bound to either), and moved the working
  search box into the new unified toolbar, where it's now reachable again.
- `.hero-model` (3D canvas) and `#visual-stage` (site/floor/map) are no
  longer nested inside a 2-column `.hero` grid — they're now sibling
  absolutely-positioned layers inside `.panel-stage`, since app.js already
  toggles exactly one of them visible via `.hidden`. This means switching
  views no longer has to fight a grid layout that was designed for a
  different structure.
- Sidebar unchanged structurally (it was never actually broken — `position:
  fixed` with no `bottom`/`height` means it already shrink-wraps to its
  content, it just read as visually sparse against a denser main panel).
- Verified in-browser at 1440px, 900px (tablet/icon-rail breakpoint), and
  375px (mobile breakpoint): 3D viewer, floor plan + room click-through,
  search (typed "kal" → selected Kalam → building switched correctly),
  listing modal, all responsive breakpoints. No console errors. Caught and
  fixed one regression myself during testing: the 980px breakpoint's
  `justify-content: space-between` on `.hero-actions` pushed the CTA and the
  live-activity stat to opposite edges of the panel — same "big gap" failure
  mode as the abandoned Gemini attempt, just at a different breakpoint.
- Bumped `styles.css?v=18`, `app.js?v=12`.

**Still open:** everything in "Not done / open items" above is unchanged —
this session was structure/layout only, no data or backend work.

### 2026-07-25 — Explorer controls promoted above the hero

- Moved the selected-hostel picker, 3D/Floor switch, and swap-activity action
  out of the lower workspace into a dedicated control bar above the hero. The
  selected context is now established before the model and room information.

### 2026-07-25 — Removed redundant top header

- Removed the visual top header (breadcrumbs, duplicate hostel search, and
  notification icon). Hostel selection remains in the main explorer controls,
  and the swap task now begins immediately at the hero.

### 2026-07-25 — Status key integrated with the 3D hero

- Moved the persistent room-status key into the 3D hero panel, directly above
  the model it explains. Removed the duplicate key from the lower workspace.
- When a student switches to the floor, site, or campus view, the 3D hero
  collapses to its introductory panel and the relevant full explorer appears
  below.

### 2026-07-25 — Permanent room-status key

- Removed the redundant “Map legend” toggle. The room-status chips are now a
  permanent, labelled key directly above the interactive floor/map artifact,
  so students can read the colours without opening another control.

### 2026-07-25 — 3D model promoted into the hero

- Moved the live 3D hostel canvas from the full-width workspace into the right
  side of the desktop hero, alongside the listing heading and action.
- The detailed workspace now stays compact in the default 3D view (toolbar,
  map legend, and statistics); selecting Floor plan, Site view, or Campus map
  reveals its corresponding full explorer below. The model stacks on tablets
  and stays hidden on phones to preserve a focused first action.

### 2026-07-25 — Clear sidebar listing action

- Shortened the compact listing action to “Create your listing” with the
  specific helper “Add your current room.” Removed its redundant overflow
  button: clicking the card itself already opens the listing form.

### 2026-07-25 — Compact navigation and activity metric

- Replaced the full-height floating sidebar with a compact fixed navigation
  card: the profile action now sits directly below the two navigation actions,
  rather than being stranded at the bottom of an empty column. Removed the
  inactive “How Nivas works” button.
- Simplified the header again by removing the three-step guide and shortening
  the intro panel. The selected-hostel activity card now uses a horizontal
  number-and-description arrangement, so the count fills its space rather than
  appearing in a tall poster-like card.

### 2026-07-25 — First-time student guidance

- Used the wide desktop hero space for a compact three-step “how it works”
  guide: list the current room, choose preferences, then browse the map. It
  hides at narrower widths, where the direct call-to-action is clearer.

### 2026-07-25 — Full-width header band

- Fixed the desktop hero grid to explicitly span the available main content
  width. The introductory task card and selected-hostel activity card now form
  a single, balanced row instead of leaving an accidental empty region to the
  right.

### 2026-07-25 — Space-efficient desktop hierarchy

- Narrowed the permanent navigation rail so the room map receives more of the
  screen without hiding the two essential actions.
- Rebalanced the header into a shorter task-first panel and a compact activity
  card. The activity metric now begins at the card’s top edge instead of being
  vertically centred in empty space.
- The activity count is now scoped to the selected hostel and its sentence
  updates with the hostel name, rather than displaying a misleading all-campus
  total.

### 2026-07-25 — Direct room-swap copy

- Replaced the vague hero slogan with the plain product message: “List your
  room. Find your swap.” The supporting line now explains exactly what can be
  explored: student-posted listings by hostel, floor, and pod.

### 2026-07-25 — Phone layout correction

- The bento shell now drops the desktop sidebar entirely below 690px. The main
  content and the listing call-to-action use the full phone width, while the
  dense map toolbar scrolls within itself rather than forcing the whole page
  sideways.

### 2026-07-25 — High-contrast bento listing flow

- Removed the unnecessary form claim about calling rooms vacant. Nivas now
  simply describes the information it collects: a current room and whether its
  resident is open to swapping.
- Reworked the whole shell into a soft, rounded bento layout: inset sidebar,
  clear card hierarchy, large readable type, higher-contrast text, and a less
  dense toolbar, legend, and statistics row.
- Made the product’s main task explicit in the hero with **Create my swap
  listing**. It opens the same listing form as the sidebar, and the Yes/No
  swap choice is now a pair of large selectable cards rather than tiny radio
  text.
- Retained the room-plan status meanings and data model; this is a UI and
  interaction-priority refresh, not an assertion about official occupancy.

### 2026-07-25 — Room-boundary SVG highlights

- Replaced the floor-plan overlay’s generic rectangle markers with 30
  room-specific SVG polygons traced to the rooms in the supplied architectural
  drawing. The four-pod sequence is 8 / 8 / 6 / 8 rooms; the lower-right pod
  excludes its service arm.
- Removed the room-state glow from the SVG floor plan so colour cannot spill
  beyond the drawn room walls. Open, registered, match, and unlisted states now
  fill only their own room polygon.
- Verified in-browser: the active Floor 9 layer contains 30 SVG paths and zero
  rectangle overlays; sample colours align to the plan’s actual room shapes.

### 2026-07-25 — Phase 1: real swap-board model, no fictional occupancy

- Removed every invented student/resident, deterministic room-status formula,
  fake vacancy count, friend directory and seeded request. New installs now
  render all rooms as **Unlisted** — the app makes no claim that an unlisted
  room is empty or occupied.
- Replaced the local profile with a listing form: name, IIT-H email, private
  phone, current hostel/room, willingness to move, and up to three destination
  preferences. In this phase it remains browser-local so the UI can be used and
  verified without falsely suggesting that a shared database exists.
- Added room status/match logic in both the SVG floor plan and three.js viewer.
  Open listings glow amber; mutually compatible preferences become bright blue;
  registered/no-move listings use green. The live activity dialog reports only
  student-submitted listing counts.
- Added `NIVAS_LISTINGS_ENDPOINT` support to `DataSource.load()` as the Phase 2
  Google Sheet / Apps Script connection seam. It accepts only a sanitized
  listing shape and polls it every 15 seconds when configured.
- Verified in-browser: blank state has 40 unlisted rooms on the sampled floor;
  creating a local Bhabha 3-314 listing changes exactly that room to Open to
  swap and updates all counters; no browser console errors.

**Next:** create the Google Form and its private response Sheet, then wire an
Apps Script sanitized listing feed into `NIVAS_LISTINGS_ENDPOINT`.

### 2026-07-25 — Typical-floor room numbering and visual sample data

- Re-read the supplied typical floor plan and remapped the Bhabha floor overlay
  to four pods, with 30 rooms per floor: Pod 1 (01–08), Pod 2 (09–16), Pod 3
  (17–22), and Pod 4 (23–30). Room numbers now use the student-facing compact
  form: `912` means ninth floor, room 12; no hyphenated room format is used.
- Expanded the representative floor plan and 3D building controls to nine
  floors so Floor 9 can be explored directly.
- Removed all overlaid room-number stickers. Room areas now receive a
  semi-transparent status fill directly over the architectural drawing.
- Added explicitly labelled **sample** Bhabha data for visual review: 10 rooms
  open to swap (including two sample matches) and five registered-only rooms.
  This sample data must be removed or replaced by the Sheet feed before launch.
- Changed destination preferences from a specific room to a preferred pod.

### 2026-07-24 — Design system overhaul, requests inbox, data seam, docs

- **Design system rewrite.** `styles.css` was four stacked override blocks — the
  palette was defined once, then overwritten twice more further down the file,
  and the whole thing was minified onto a handful of lines. Replaced with a
  token architecture (colour / radius / space / type / elevation / motion) and a
  unified component layer, organised into ten commented sections. Every button
  in the app now comes from one of four classes instead of nine bespoke ones.
- **Resolved a real collision:** brand red and the "vacant room" status red were
  the same visual weight on the same screen. Brand red is now interactive-only,
  and vacant rooms are outlined rather than filled.
- **Folded three inline `<style>` blobs out of `index.html`** into the
  stylesheet. They were minified patch layers holding the search dropdown,
  friends HUD, modals, and pod-plan overlay — invisible to anyone reading
  `styles.css`.
- **Added the `DataSource` seam** (see open item 1). Data now loads once through
  `DataSource.load()` at boot instead of being read from module-level constants
  scattered through the file, so connecting real data is a one-function change.
- **Built the requests inbox:** sent/received tabs, pending → accepted/declined,
  nav badge, relative timestamps, seeded demo received requests. Delivery is
  deliberately *not* wired — decided with Chandan to complete the UI now and
  wait for the backend. The `.notice` banner in the modal says so; keep it.
- Retuned `viewer3d.js` status colours to the new tokens and relabelled "Empty"
  → "Vacant" for consistency with the legend.
- Room/vacancy counts in the stats row are now computed from the actual rendered
  floor instead of being hardcoded to `144` / `18`.
- Added `docs/DESIGN.md` and this file. Added `.gitignore`.
- **First git commit.** The project had a `main` branch with zero commits and
  every file untracked — a laptop failure would have lost all of it.
- Verified in-browser: no console errors, floor plan renders, view switching,
  request accept/decline updates badge + pill + summary correctly.

**Still open after this session:** real data (1), privacy model (2), delivery
backend (3), deployment (4) — see the numbered list above.

---

## Entry template — copy this for your new entry

```markdown
### YYYY-MM-DD — Short title
- What changed
- Why
- What's still open / broken / next, if relevant
```
