# Nivas

**A student-built room-swap board for the IIT Hyderabad hostel precinct.**
Browse all 16 boys' hostels, orbit a detailed 3D building model, walk floor by
floor across the real architectural drawing, and post or find a room swap. There
is no app to install, no login wall and no invented data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![No framework](https://img.shields.io/badge/frontend-vanilla%20JS-informational)
![Backend](https://img.shields.io/badge/backend-PHP%20%2B%20MySQL-777bb4)

| | |
|---|---|
| **Live** | [nivas.iith.online](https://nivas.iith.online), with real listings from real students on PHP/MySQL |
| **Repository** | `github.com/chandanmettu/iith-nivas` (public). The local folder is still called `iith-hostels`. |
| **Push via** | SSH host alias `github-nivas` (remote `git@github-nivas:chandanmettu/iith-nivas.git`) |
| **Deploy** | Hostinger Git auto-deploy from `main`. **A push is a production release.** |

## Why this exists

Room swaps at IITH mostly happen through scattered WhatsApp messages. Nobody can
see who is actually looking to move or spot a three-way trade. Nivas is a live
board: post your room, say whether you're open to a swap, and see everyone
else's listing on a floor plan of the building you want to move into.

It makes **no claim about official occupancy**. A room shows a status only
because a student published one.

| State | Meaning |
|---|---|
| `Unlisted` | Nobody has published anything about this room |
| `Registered` | A student listed their room but isn't looking to move |
| `Open to swap` | A student listed their room and wants to move |
| `Match for you` | Both sides' stated preferences line up |

## Features

- A **3D building viewer** of the leaf-cluster hostel block, with click-to-inspect rooms and floor isolation
- A **floor plan traced from the real drawing**. The room polygons were extracted from the source image ([`docs/trace-rooms.py`](docs/trace-rooms.py)).
- **Email-verified listings**: you must prove you control an `@iith.ac.in` mailbox before a listing is published
- **Consent-gated contact**: phone and email appear only if the student opts in
- Bookmarks, a live activity feed and an in-app feedback form
- Offline fallback: if the API is unreachable, listings save to the browser only

## Stack and structure

| | |
|---|---|
| Frontend | Static HTML, CSS and JS. **No framework, no npm, no build step.** |
| 3D | [three.js](https://threejs.org/) + OrbitControls, vendored in `vendor/` so it works on locked-down campus networks |
| Backend | PHP 8.1+ and MySQL on Hostinger shared hosting |

```text
index.html styles.css app.js      the app shell
viewer3d.js plan-geometry.js      3D model and floor geometry (ES modules)
api/                              listings, verify, bookmarks, feedback + schema.sql
api/config.example.php            template for the server-only, git-ignored api/config.php
assets/  vendor/                  reference imagery, vendored three.js
docs/                             DESIGN, DEPLOY, PROGRESS, tracing scripts, mockups
docs/archive/                     the full pre-deployment build log (1,200 lines, verbatim)
Archive/                          (local only, git-ignored) superseded Gemini and React prototypes
```

## Run locally

`viewer3d.js` is an ES module, so `file://` won't work. Serve the folder instead:

```sh
python3 -m http.server 8137   # then open http://localhost:8137
```

With no backend the app runs in offline mode. PHP isn't installed on the dev
Mac, so API changes must be verified on the live host.

## Picking this up (human or agent)

1. [`docs/PROGRESS.md`](docs/PROGRESS.md) holds the current state and priorities. **Append a dated entry after every change.**
2. [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) has the open `NIV-` issues. Read it before assuming a bug is new.
3. [`docs/DESIGN.md`](docs/DESIGN.md) documents the locked design tokens and components.
4. [`docs/DEPLOY.md`](docs/DEPLOY.md) covers the DB schema import, `api/config.php` keys and the release steps.

Release checklist:

- Bump `?v=` on every changed CSS/JS file in `index.html`, because Hostinger's CDN caches for 7 days.
- `api/config.php` is never deployed by git. It lives only on the server, and `mail_from` / `mail_from_name` are required or verification breaks.
- Hostinger's Git deploy does not reliably delete removed files. Check a removal with a cache-busted request.
- Verify both the UI and the affected API on the live site after pushing.

The repo is public, and its root is `public_html`. Keep operational detail
(accounts, unfixed-vulnerability specifics) in the private tracker, not here.

## License

[MIT](LICENSE)
