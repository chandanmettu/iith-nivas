# Nivas — current progress

Last updated: **2026-09-19**

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
