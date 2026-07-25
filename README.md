# Nivas — IIT Hyderabad hostel explorer

An interactive room-swap board for the IIT Hyderabad hostel precinct: browse
all 23 hostels, orbit a 3D building model, navigate floor by floor on the real
architectural drawing, and see student-submitted room-swap listings.

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

## Room-swap data model

Nivas makes **no claim about official occupancy or vacancy**. A room starts as
**Unlisted** and only changes when a student creates a listing for that exact
room:

- `Unlisted` — no student has published swap information for this room.
- `Registered` — a student registered their room but is not looking to move.
- `Open to swap` — a student registered and is willing to move.
- `Match for you` — both students’ stated preferences align.

Students enter a plain room number such as `912`: the first digit is the floor,
and the final two digits identify the room on that floor. The supplied typical
plan is grouped into four pods: rooms 01–08, 09–16, 17–22, and 23–30. Students
choose a **destination hostel and preferred pod**, not another student's exact
room.

The current Phase 1 form stores a listing only in that browser so the interface
can be tested without inventing residents. Phase 2 will connect a private
Google Form/Sheet to a sanitized read-only listing endpoint. `DataSource.load()`
in `app.js` is the only place that will need the endpoint connection; it must
never receive phone numbers or email addresses.

The campus and building geometry is reference-informed, not surveyed — add
institute-verified hostel coordinates before relying on it for precise
navigation.
