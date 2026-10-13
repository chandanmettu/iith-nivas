# Campus view: plan for step two

Status: **plan only, nothing built.** Written 2026-10-13, after v2 of the hostel viewer.

## What it is

A "Campus" mode in Nivas: all of IIT Hyderabad as one light 3D map, where every
hostel is a clickable block showing how many swaps are open in it, and a click
flies you into the detailed block that already exists. It is a truthful
schematic of the real layout, not a replica to the metre.

Why this shape: students ask "which hostel?" before "which room?". A campus view
answers that visually (where is it, how far from the mess, the gate, the
library) and makes the room-level model feel like the last step of a zoom, not
a separate page.

## What we already have

| Piece | State |
|---|---|
| Detailed hostel block (10 floors, 30 rooms, traced from the architect's plan) | Done, v2 on branch `v2` |
| Viewer machinery: moods, springs, picking with occluders, render-on-change, no-WebGL fallback | Done, reusable as is |
| Per-hostel live counts (`roomStatusMapFor`, `updateSummary`) | Done in `app.js` |
| A made-up campus layout with hostel positions | In `docs/archive/viewer3d-v1.js` (`cityLayout`). **Placeholder, unverified**; do not reuse the coordinates |
| Hidden "Site view" and "Campus map" buttons | In `index.html`, kept as hooks |

## One question that decides the scope

Nivas draws **the same block for every hostel** (only the name changes). The
research says the campus has two hostel types, six-floor older blocks and ten-
floor new ones (see the discrepancies above). **Which type is the plan we
traced, and do the other hostels share it?** If not, each distinct type needs its
own trace from its own drawing before the campus view can show them as they
are. Until then the campus view must say "typical block".

## Data: where the layout comes from

Measured on 2026-10-13 (full notes, sources and the 15 open gaps in
[CAMPUS-RESEARCH.md](CAMPUS-RESEARCH.md)):

- OpenStreetMap has the campus boundary (about 2.8 x 1.7 km) and **58 buildings
  inside it, 53 named**. 20 of the 23 official hostel blocks can be identified.
  **No heights at all**, building levels on only 21, and **no trees, water or
  landuse**. Roads and footpaths are good (187 ways); seven pitches and the
  athletics track are mapped, cricket and the pool are not.
- The old "two clusters" idea holds up: eight identical new blocks (10 levels,
  840 m2 each) about 350 m north-west of the Hostel Circle bus stop, the older
  group at and east of it. IITH's own booklet names "Hostel Circle" and "New
  Hostels" as separate shuttle stops.
- Payload is not the problem: 58 footprints are 14 KB raw, about 5 KB gzipped.
  The eight new blocks share one footprint, so they are the one place
  instancing fits. Everything else merges.
- **Licence:** OSM is ODbL. The rendered view needs "(c) OpenStreetMap
  contributors" linked to openstreetmap.org/copyright. A hosted footprint file
  counts as a derived database: ODbL notice, offer the data, and it cannot sit
  under the repo's MIT licence. This is my reading of the OSMF guidelines, not
  legal advice.
- No open aerial imagery for the campus; Wikimedia Commons has about 30 photos
  and none usable for facades. The JICA report is all rights reserved: cite
  facts, do not reuse drawings. No official campus map was found online. **A
  2019 IITH design-department thesis, "3D Digital Interactive Model of IIT
  Hyderabad Campus", exists and used the Estate Office's maps; ask there first.**
- Heights come from IITH documents, not OSM: old hostels six floors (Welcome
  Booklet 2022), new blocks ground plus ten (IITH newsletter, Oct-Dec 2023).
- Do not credit an architect in the app from Wikipedia: its hostel attribution
  is contradicted by the architect's own firm. Who designed the new blocks is
  unknown.

### Three discrepancies to settle before any campus build

1. **Which hostels are boys'?** The official hostel page lists Aryabhatta and
   Bhaskara among the girls' blocks; Nivas lists both as boys' hostels. It also
   lists Ramanuja, Vivekananda and S N Bose as boys' hostels, which Nivas does
   not. Either Nivas is out of date, or the page is.
2. **Which block is the model?** Nivas draws Varahamihira with ten floors, but
   OpenStreetMap and the Welcome Booklet put it in the older six-floor group.
   The ten-floor type is the eight new blocks. The header's "10 floors, 30 rooms
   per floor" would then not hold for every hostel.
3. **Is the model the right size?** At the viewer's scale the traced plan is
   about 76 x 40 m; OpenStreetMap has the new block type at 52.5 x 27.2 m. The
   proportions match (about 1.9 to 1), the size differs by about 1.45 times. The
   plan may cover more than one block, or the scale (5 cm per plan pixel) may be
   off. Check before placing the detailed model on a campus map.

Options, in the order I would try them:

1. **OpenStreetMap footprints**, if the campus is mapped well enough. Free,
   licensed ODbL, needs an attribution line, and a derived data file we host
   falls under share-alike. Check coverage before committing to it.
2. **Trace the official campus map or master plan**, the way the hostel plan was
   traced (`docs/trace-rooms.py`, `trace-outline.py`). Slower, but we control
   accuracy, and it works even where OSM is thin.
3. **Hybrid (likely):** OSM for roads, ordinary buildings and trees; hand-fix
   the hostels and the dozen buildings students actually navigate by.

Never scrape Google Maps/Earth or any tile service whose terms forbid it. Esri
tiles are already used elsewhere in the workspace, under their own terms.

## How it would be built

- **Bake offline, never fetch at runtime.** A Python script (same family as the
  trace scripts) turns an export into `campus-data.js`: integer-quantised
  footprints with a category and optional height. Target at most 60 KB
  compressed. No third-party calls from a student's browser (privacy, and
  campus networks block things).
- **One lazy module, `campus3d.js`**, loaded only when "Campus" is opened. It
  shares the vendored three.js, so first paint of Nivas does not change.
- **Geometry:** ground and roads as merged strips; buildings extruded (levels
  from data, else a default per category) and merged per category into about six
  meshes; trees instanced; sports fields as flat coloured shapes. Budget: at most
  150 draw calls and 150k triangles, same philosophy as v2 (275k triangles for
  the whole detailed block with its shadow pass).
- **Hostels** are separate pickable meshes. Colour and a beacon height show the
  live counts (listed, open to swap, matches). **Counts only, never names.**
- **Fly-in:** click a hostel, the camera flies down, the scene crossfades to the
  existing detailed block (`setBuilding(name)`), and a Back button returns.
- Same moods, render-on-change loop, reduced-motion and no-WebGL behaviour as the
  hostel viewer.
- **Honest labels:** an attribution line, "layout approximate", and "typical
  block" wherever a hostel is shown with the shared plan.

## Phases and gates

| Phase | What | Gate to continue |
|---|---|---|
| 0 (half a day) | Confirm the questions below; count what OSM really has; get the official map if one exists | Go or no-go on OSM; scope agreed |
| 1 (1 to 2 sessions) | Bake script and a standalone base map: ground, roads, buildings, trees. He compares it side by side with imagery | He says it looks like his campus |
| 2 (1 to 2 sessions) | Hostels as pickable blocks with live counts; fly-in to the detailed block and back | Round trip works on a real phone |
| 3 (1 session) | Labels from verified names only (mess, gates, library, sports), search, tablet and phone tuning | First frame under about 2 s on a mid-range Android |
| 4 (1 session) | Real-device test, deploy behind `?campus=1`, then make it default | He approves the push |

Stop and rethink if the base map blows the budget on a phone, or if the data
needs more manual fixing than the value it adds.

## Risks

- **Trust:** a wrong campus layout is worse than none. Everything not verified
  is labelled approximate or left out.
- **Licence:** OSM attribution and share-alike must be right before launch.
- **Weight:** the campus is far larger than one block. The budget above is a
  hard gate, not a goal.
- **Privacy:** statuses and counts only, as today.
- **Scope creep:** no building interiors except hostels; no girls' hostels or
  older blocks until he says they are in scope.
- **Maintenance:** new buildings need a re-bake; the script must be re-runnable.

## Decisions needed from him (one round)

1. **Scope:** the whole campus, or only the hostel precinct and its surroundings first?
2. **Which type is the traced plan, and do the other hostels share it?** (See the
   discrepancies above: old six-floor blocks versus the new ten-floor ones.)
3. **Is the Nivas hostel list right?** Aryabhatta and Bhaskara are girls' blocks
   on the official page.
4. **OSM as the base** with an attribution line in the footer and the data file
   under ODbL: yes or no?
5. **Girls' hostels and older blocks:** in scope for this, or later?
6. **Campus as the default view, or an opt-in tab?**
7. **Can you ask the Estate Office or the design department for the campus map
   and the 2019 thesis?** That would beat tracing from OSM.

## Estimate

About 5 to 7 focused sessions end to end. The data is small (58 buildings); the
work is hand-fixing the hostels, adding heights from IITH documents, and
drawing trees and terrain, which OSM does not have. Add 1 to 2 sessions per
distinct hostel type that needs its own trace. A flat ground plane is fine for
a first version: the open elevation data is 30 m cells, too coarse for a site
this size.
