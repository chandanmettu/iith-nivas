# Nivas

**A student-built room-swap board for the IIT Hyderabad hostel precinct** —
browse all 16 boys' hostels, orbit a genuinely detailed 3D building model,
walk floor by floor across the real architectural drawing, and post or find a
room swap. No app, no login wall, no invented data.

**Live at [nivas.iith.online](https://nivas.iith.online)** — real listings from
real students, on a PHP/MySQL backend.

<!-- Still worth adding: a wide shot of the 3D viewer + floor plan side by side. -->
> 🖼️ *Screenshot / demo GIF still to be added.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![No framework](https://img.shields.io/badge/frontend-vanilla%20JS-informational)
![Backend](https://img.shields.io/badge/backend-PHP%20%2B%20MySQL-777bb4)

---

## Why this exists

Room swaps at IITH mostly happen through scattered WhatsApp messages — no way
to see who's actually looking to move, no way to spot a 3-way trade nobody
would find by hand, and no map of what's even available where. Nivas is an
attempt at a real, live board for that: post your room, say if you're open to
a swap, and see everyone else's listing on an actual floor plan of the
building you're trying to move into.

It makes **no claim about official occupancy**. A room only shows a status
because a student explicitly published one — Nivas has no access to, and
never pretends to have, the institute's real allocation data.

## Features

- **3D building viewer** — a genuinely modelled leaf-cluster hostel block
  (louvred facades, pilotis, atrium cores, cycle courts), not a placeholder
  box, with per-room click-to-inspect and floor isolation
- **Floor plan traced from the real architectural drawing** — room polygons
  extracted from the source image itself (see [`docs/trace-rooms.py`](docs/trace-rooms.py)),
  not estimated rectangles
- **Student-submitted listings**, shared live through a small PHP/MySQL
  backend — not a static demo
- **Consent-gated contact.** Phone and email are never shown unless the
  student explicitly opts in; the API doesn't even fetch the email column
  otherwise
- **Email-verified identity** — a listing requires proving control of a real
  `@iith.ac.in` mailbox before it's published
- **Bookmarks**, a live activity feed, and a feature-request/bug-report form
  built into the app

## Tech stack

| | |
|---|---|
| Frontend | Static HTML / CSS / JS — **no framework, no build step, no npm** |
| 3D | [three.js](https://threejs.org/), vendored locally (not via CDN) so it works on locked-down campus networks |
| Backend | PHP 8.1+ and MySQL — what ordinary shared hosting gives you, nothing fancier |
| Hosting | GitHub → Hostinger, auto-deployed on push |

No build step is a deliberate choice, not an oversight — see
[`docs/DESIGN.md`](docs/DESIGN.md) for the reasoning.

## Running it locally

`viewer3d.js` is an ES module, so opening `index.html` directly from the
filesystem will not work — serve the folder:

```sh
python3 -m http.server 8137
```

Then open `http://localhost:8137`. Without a configured backend the app runs
fine in offline mode: listings just save to that browser only.

To run the real backend too, see [`docs/DEPLOY.md`](docs/DEPLOY.md) — it
covers the database schema, the PHP endpoints, and what to configure before
sharing the link with real users.

## Project structure

```
index.html, styles.css, app.js, viewer3d.js   ← the whole served frontend
api/            PHP endpoints + schema.sql (api/config.php is gitignored)
assets/         supplied IIT-H reference imagery
vendor/         vendored three.js + OrbitControls — not a CDN, on purpose
docs/           design system, deployment guide, the full build log, and the
                floor-plan tracing script
```

## The room-swap model

A room starts **Unlisted** and only changes state when a specific student
publishes a listing for it:

| State | Meaning |
|---|---|
| `Unlisted` | Nobody has published anything about this room |
| `Registered` | A student listed their room but isn't looking to move |
| `Open to swap` | A student listed their room and wants to move |
| `Match for you` | Both sides' stated preferences line up |

Students enter a plain room number like `912` (ninth floor, room 12) and
choose up to three destination hostel + pod preferences — never another
student's exact room, since the goal is a compatible trade, not a queue.

## Contributing / picking this up

This has been built in public, iteratively, across many sessions (including
with AI pair-programming) — [`docs/PROGRESS.md`](docs/PROGRESS.md) is the
full, honest build log: what changed, why, what broke, and what's still open.
It's long, but it's the real history, mistakes included.

If you're picking this up (human or AI agent):

1. Read [`docs/PROGRESS.md`](docs/PROGRESS.md) first — it's the actual
   continuity mechanism between sessions, not just a changelog.
2. Read [`docs/DESIGN.md`](docs/DESIGN.md) before touching anything visual —
   the design tokens and component rules are documented and locked for a
   reason.
3. After making changes, append a dated entry to `docs/PROGRESS.md`. Vague
   entries are worse than no entry.

Issues and pull requests are welcome.

## License

[MIT](LICENSE) — use it, fork it, learn from it.
