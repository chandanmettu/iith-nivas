# Nivas — current progress

Last updated: **2026-11-08** (v2 live)

Nivas is live at <https://nivas.iith.online> with a PHP/MySQL backend and real
student-submitted listings. This file is the current operational summary. The
full 1,200-line pre-deployment/build narrative is preserved unchanged in
[`archive/PROGRESS-pre-deployment.md`](archive/PROGRESS-pre-deployment.md).

## Current product

- interactive explorer for all 16 boys' hostels
- detailed Three.js hostel model with floor isolation and room inspection
- room polygons traced from the supplied IITH typical-floor plan
- email-verified room-swap listing creation
- live shared listings from PHP/MySQL, with explicit contact-sharing consent
- preferences and match highlighting without claiming official occupancy
- bookmarks, activity feed and in-app feedback
- offline/browser-local fallback when the API is unavailable

The frontend is plain HTML/CSS/JavaScript with vendored Three.js and no build
step. The backend is PHP 8.1+ and MySQL under `api/`; server credentials stay in
the gitignored `api/config.php`.

## Production status

The live site and API have already been exercised with real listings. The old
statements that the backend had never run on a PHP host, listings were
browser-only, verification was absent, or deployment had not happened are
historical and now live only in the archive.

## Open work

The canonical issue list is [`../KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). Current
priorities are:

1. Resolve read-side contact privacy for students who opted to share details.
2. Narrow bookmark/waitlist responses to the room being viewed, or remove names
   from the broader response.
3. Add an admin/moderation path for bad or stale listings.
4. Configure and test database backups and restore.
5. Add a representative README screenshot or demo GIF.

The hidden campus/site view modes and any future complaints workflow remain
product enhancements, not deployment blockers.

## Release discipline

1. Read `README.md`, `KNOWN_ISSUES.md`, `docs/DESIGN.md` and `docs/DEPLOY.md`.
2. Preserve user data and unrelated working-tree files.
3. Preview through local HTTP; `viewer3d.js` is an ES module, so `file://` is
   not an adequate test.
4. Bump CSS/JS `?v=` values only after the final edits.
5. Run syntax checks and `git diff --check`, review the complete diff, then
   commit/push only the intended files.
6. Verify both the live UI and affected API path with cache-busted requests.

## Recent production history

### 2026-11-08: v2 LIVE, with phone fixes and real hostel facts

- Owner reported v2 "sometimes glitches" on a real phone. Two likely causes
  fixed: (1) phones fire `resize` whenever the address bar slides, and the
  viewer resized the canvas even at the same size, which clears it and flashed
  a blank frame; it now skips unchanged sizes and draws at once on a real
  change. (2) Camera near/far was 0.5/900, too little depth precision for
  phone GPUs, so bands and louvres shimmered; now 1.5/600 (fog ends at 420).
- Owner's facts: Aryabhatta is a girls' hostel and Kapila is not this kind
  of block, so both are removed (no live listings used either). Bhaskara stays
  (shared by boys). Bhaskara, Brahmagupta, Charaka, Kautilya, Susruta,
  Varahamihira and Vyasa have six floors (rooms 101-630); Bhabha, Kalam,
  Raman, Ramanujan, Sarabhai and Viswesvaraya have ten (101-1030). 13 hostels.
- The 3D hides floors above a hostel's top floor and drops the roof onto it;
  the neighbours (the newer cluster) are hidden and the Surroundings button
  disabled for six-floor hostels; readouts say "six"/"ten". Floor rail,
  labels and new-listing validation follow the hostel. Existing listings are
  never dropped, even on a floor a hostel does not have.
- Server (`api/db.php`, `listings.php`, `bookmarks.php`): same 13 hostels,
  per-hostel floor check, and 4-digit rooms for floor 10 (the old API allowed
  only floors 1-9 while the page offered 10). Not runnable on the Mac (no PHP);
  reviewed by hand, must be checked on the live host after the push.
- Six-floor hostels still use the typical (newer-block) floor plan; their own
  footprint is not traced. Labelled "TYPICAL PLAN, SIX FLOORS".
- Cache keys: styles 50, app 35, viewer3d 34. Owner said push; `v2` fast-forwarded
  into `main` (`db921cb`) and verified live: v2 files served (WebP as image/webp),
  Varahamihira shows six floors with its 11 listings, 28 campus-wide, listings
  GET and a read-only bookmarks call run the new PHP. Owner had not yet confirmed
  the phone glitch is gone. Next: campus view of all hostels (owner's idea), tap
  one to isolate it; needs him to name OSM blocks C, D, F, G.

### 2026-10-13: v2 of the 3D viewer and page polish (branch `v2`, NOT pushed)

Built on branch `v2`. `main` and the live site are untouched until he approves a push.

- **New `viewer3d.js`**, same building traced from the same plan (v1 kept in
  `docs/archive/viewer3d-v1.js`): glazed room windows with frames and sills,
  deep balconies behind terracotta louvres, open pilotis with column lights,
  roof canopy, lawn, walk, bollards and trees, all from the architect's render.
- **Interaction:** open a floor and the floors above lift away to show its cut
  model with room numbers and POD 1-4 labels; "Stack floors" spreads all ten;
  Day / Dusk / Night lighting; hover and click picking with the solid wall as
  an occluder; selection pin shared with the floor plan.
- **Weight:** first load goes from about 5.9 MB to about 0.46 MB (brotli
  estimate). The 5 MB facade photo and 740 KB floor-plan PNG no longer load
  eagerly (the facade belongs to a hidden view; the plan is now a pixel-identical
  254 KB WebP that loads once the 3D is up). three.js is the official minified
  r185 build in `vendor/three-r185/` (parsed JS 1.2 MB to 0.7 MB). The scene
  renders only on change: 0 frames when idle. Triangles per frame 488k to 275k.
- **Page:** headline accent in the display italic, taller stage, the readout
  moved into a band under the model with the lighting and view tools, a three
  step guide in the empty room panel, tablet toolbar wraps (it overflowed the
  page by 65 px at 820 px width, also on v1), no-WebGL falls back to the plan.
- **Realism pass, same day**, from photographs of Kalam and Bhabha he supplied and
  the Google Maps satellite view: plan scale corrected to 3.4 cm per pixel (it was
  5 cm), thick white ribbons, red-orange louvres, slit windows, enclosed ground
  floor, plain parapet roof with solar arrays and water drums, paved courtyards
  with planters, young trees, bicycles and street lamps instead of lawn, the seven
  neighbouring blocks placed from OpenStreetMap footprints with a Surroundings
  toggle (they sink away when a floor is opened), default camera from the open side
  like the Bhabha photograph. Header decluttered; counts in one strip. Footer
  credits OpenStreetMap contributors. Details in `docs/DESIGN.md` and
  `docs/CAMPUS-RESEARCH.md`.
- **Link preview:** `assets/og-nivas.jpg` (the real model at dusk, no listings
  drawn on it) and Open Graph tags, for when the link is shared on WhatsApp.
- Old vendored r160 files moved to `_to-delete/IITH/Nivas/vendor/`.
- **Before merging:** verify on a real phone; check the host serves `.webp` as
  `image/webp`; bump `?v=` again if any file changes (currently styles 49,
  app 34, viewer3d 31). Merging `v2` into `main` also carries the earlier
  unpushed docs commit `71d8070`.
- Headless checks only so far (Chrome with software WebGL): desktop 1440,
  tablet 820 and 1000, phone 390, reduced motion, no-WebGL. Not yet seen on a
  real GPU or touch device.

### 2026-09-19 — Workspace cleanup and docs handover pass

- Verified the live `index.html` is byte-identical to `main` HEAD.
- README rewritten for handover. The real repo slug is `chandanmettu/iith-nivas`; the local folder was renamed `Nivas` the same day. It now also records the SSH alias and the release checklist.
- The 2026-09-05 trim of this file was committed. The old 1,200-line log is preserved verbatim in `archive/PROGRESS-pre-deployment.md` (checked byte-for-byte).
- `Archive/` (superseded prototypes) is now git-ignored and stays local only. The stray `tmp/` folder, which held unrelated calculus-worksheet renders, was removed from the project.

### 2026-08-19 — security and setup audit

- Corrected the documentation after live deployment was independently
  verified.
- Added the missing mail sender fields to `api/config.example.php`, making a
  fresh verification setup complete.
- Escaped/null-guarded avatar initials.
- Reviewed prepared statements, origin allow-listing, token hashing, code
  expiry/attempt limits, file-deny rules and hostel/room validation.
- Recorded the two read-side privacy questions in the public issue list at an
  appropriate level and in the private tracker with operational detail.

For earlier design, geometry, migration and iteration decisions, consult the
archived log rather than copying historical “not deployed” claims back into
current documentation.
