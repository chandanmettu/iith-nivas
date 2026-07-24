# Nivas — IIT Hyderabad hostel explorer

An interactive explorer for the IIT Hyderabad hostel precinct: browse all 23
hostels, orbit a 3D building model, navigate floor by floor on the real
architectural drawing, check room status, locate friends, and request a room
swap.

## Start here

If you're an AI agent (Claude, Gemini, Codex, or otherwise) or a new contributor
picking this up:

1. Read [`docs/PROGRESS.md`](docs/PROGRESS.md) first — project state, what's
   done, what's demonstration data, what's blocked, and why past decisions were
   made. Don't assume you have context from a prior conversation; this file is
   the actual continuity mechanism.
2. Read [`docs/DESIGN.md`](docs/DESIGN.md) before touching anything visual —
   colour, radius, spacing, type and component rules are all locked and
   documented there.
3. **After you make changes, append a dated entry to `docs/PROGRESS.md`.** This
   is not optional — it's how the next person/agent avoids re-discovering the
   same decisions.

## Run

`viewer3d.js` is an ES module, so opening `index.html` from the filesystem will
not work. Serve the folder:

```sh
python3 -m http.server 8137
```

Then visit `http://localhost:8137`.

## Stack

Static HTML/CSS/JS — no framework, no build step, no npm. three.js and
OrbitControls are vendored in `vendor/` (deliberately, not via CDN). All state
is `localStorage`; there is no backend yet.

## Folder structure

```
index.html, styles.css, app.js, viewer3d.js   ← served, repo root
assets/     ← supplied IIT-H reference imagery (facade photo, floor plan drawing)
vendor/     ← vendored three.js + OrbitControls — do not replace with a CDN
docs/       ← PROGRESS.md, DESIGN.md
```

## ⚠ The data is not real

Room occupancy, resident names, and the friend directory are all demonstration
data. `DataSource.load()` in `app.js` is the only function that knows where data
comes from — rewrite it to fetch from an authenticated endpoint returning the
same shape and nothing else needs to change.

**Before connecting real data, the privacy model has to be settled.** Resident
visibility must be opt-in, and the API should return only the fields each
student has consented to share. See open item 2 in `docs/PROGRESS.md`.

The campus and building geometry is reference-informed, not surveyed — add
institute-verified hostel coordinates before relying on it for precise
navigation.
