# Nivas — current progress

Last updated: **2026-10-13** (v2 on branch `v2`, not yet deployed)

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
  app 34, viewer3d 29). Merging `v2` into `main` also carries the earlier
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
