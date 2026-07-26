# Nivas — Design System

**Read this before touching anything visual.** Every value below is a token in
`styles.css` § 01. If you find yourself typing a raw hex, px radius, or one-off
font size anywhere else in the codebase, stop — add or reuse a token instead.

---

## Colour

### Brand — interactive only

The institute red is reserved **exclusively** for interactive and branded
elements: primary buttons, active nav, selected states, chrome accents.

| Token | Value | Use |
|---|---|---|
| `--brand-700` | `#7e1425` | primary button hover, brand wordmark |
| `--brand-600` | `#a91f32` | **primary action** — one per view maximum |
| `--brand-500` | `#c22c3d` | display italic accent |
| `--brand-200/100/50` | `#f6cabf` / `#ffe0d3` / `#fff0e6` | tints, badges, hover fills |

| Token | Value | Use |
|---|---|---|
| `--accent-500` | `#f05a25` | logo orange — highlights, live pulse, focus, friend markers |
| `--accent-600/700` | `#d8481e` / `#c0430f` | hover, text-on-tint |
| `--accent-100/50` | `#ffdfca` / `#fff4ec` | focus ring, notice banner |

### Room status — a traffic light

Set by Chandan on 2026-07-26: **red = no swap possible, yellow = open to swap,
green = matched.** This replaced an earlier rule that banned red from room
status entirely; the status red is a warmer, brighter vermilion than
`--brand-600`, so a swatch still never reads as a brand button. Don't reuse
`--brand-600` for a room state.

| State | Token | Meaning |
|---|---|---|
| Unlisted | `--status-unlisted` `#514346` | nobody has posted about this room |
| Registered | `--status-occupied` `#d6452f` | resident listed it, isn't moving |
| Open to swap | `--status-open` `#e0a318` | resident wants to move |
| Match for you | `--status-match` `#2f9161` | you each want the other's room |

A fifth treatment, `.room.void`, is a cell the drawing shows but the building
doesn't have: solid dark with a white cross, inert, never numbered or counted.

Each has a `-tint` variant for pill backgrounds. The product only communicates
student-published swap information; it makes no official room-allocation claim.

**`viewer3d.js` duplicates these values** in its `statusColors` map (three.js
can't read CSS variables). If you change a status colour, change it in both
places — a room must read as the same state in the 3D scene and on the floor
plan.

### Neutrals — cool, high contrast

Use the high-contrast cool-neutral scale: `--ink-900` → `--ink-400` for text,
`--line` / `--line-soft` for borders, `--surface` (cards) /
`--surface-sunk` (recessed) / `--canvas` (page) for backgrounds.

`--scene` `#24181b` is the 3D viewer background. Overlays on it use the
`--on-scene-*` and `--scene-panel` / `--scene-edge` tokens — never the light-mode
neutrals.

---

## Radius

One scale. No ad-hoc values.

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 4px | tiny chips, floor buttons |
| `--r-sm` | 12px | buttons, inputs, list rows |
| `--r-md` | 16px | menus, panels, segmented controls |
| `--r-lg` | 22px | cards, floating cards |
| `--r-xl` | 30px | workspace shell, modals |
| `--r-pill` | 999px | pills, avatars, badges |

## Space

4px base: `--s-1` (4) through `--s-12` (48). Component padding uses `--s-3`/`--s-4`;
section padding uses `--s-6`/`--s-8`; page gutters use `--s-10`/`--s-12`.

## Type

- **Manrope** (`--font-sans`) — everything by default
- **DM Mono** (`--font-mono`) — labels, metadata, room numbers, IDs. Always
  uppercase and tracked out with `--track-mono`
- **Playfair Display** italic (`--font-display`) — the hero accent phrase **only**.
  Do not spread it to other headings.

Scale: `--fs-micro` (10) · `--fs-xs` (12) · `--fs-sm` (14) · `--fs-md` (15, body)
· `--fs-lg` (15) · `--fs-xl` (18) · `--fs-2xl` (24) · `--fs-3xl` (32) · `--fs-4xl` (40).

---

## Components

Every clickable control in the app is one of these. Do not invent a new button.

| Class | Use |
|---|---|
| `.btn.btn--primary` | the one main action in a view — solid brand |
| `.btn.btn--secondary` | tinted, repeatable |
| `.btn.btn--ghost` | text-only, low emphasis |
| `.btn.btn--outline` | transparent, brand border + text — a branded secondary action that must not compete with the primary (header's Feature request) |
| `.btn--block` | modifier — full width |
| `.icon-btn` | square 30px, icon only (close, zoom, overflow) |
| `.icon-btn--quiet` | borderless variant |
| `.segmented` + `.seg-btn` | view switcher |
| `.chip` | small pill toggle when a compact selectable control is needed |
| `.pill.pill--<state>` | **read-only** status label — never clickable |
| `.avatar` (+ `--lg`, `--private`) | person marker |
| `.field-grid` | form layout — 2-col, collapses to 1 on mobile |
| `.card` | the one container treatment |
| `.notice` | dashed banner for "not wired yet" caveats |

### Rules

- **One `.btn--primary` per view.** If two things look equally important, one is
  `.btn--secondary`.
- `.pill` is never interactive. If it needs a click, it's a `.chip`.
- Focus is always visible: `--focus-ring` on controls, `:focus-visible` outline
  elsewhere. Never remove it.
- Motion: `--t-fast` (120ms) for hover/colour, `--t-base` (200ms) for transforms,
  always `--ease`. All motion is disabled under `prefers-reduced-motion`.
- Elevation `--e-1` → `--e-4` (resting → modal). Skipping levels reads as a bug.

---

## Layout

**A scrolling page holding a header pill, a headline row, and one explorer
card whose stage is three real columns: floors | artifact | room detail.**
Nothing is absolutely positioned over the artifact. That rule is the whole
point of this layout — the previous version floated a key card, a zoom
control and a room-detail card on top of the stage, and they collided with
each other and with the hostel dropdown. See PROGRESS.md.

```
┌──────────────────────────────────────────────────────────────────┐
│ (.topbar)  ▣ NIVAS │ STUDENT ROOM SWAP    [Feature req] [Create]│
│            gradient + louvre motif, ~92px                        │
│ .page-head   headline + subline      │  15 listed · 10 open ·    │
│                                      │  2 matches · Swap activity│
│  .explorer-card ─────────────────────────────────────────────┐   │
│  │ .toolbar  picker · status key · 3D/Floor switch (right)   │   │ 64px
│  ├──────┬───────────────────────────────────┬───────────────┤   │
│  │floor │                                   │  room detail  │   │
│  │ rail │        THE ARTIFACT               │  (#room-panel)│   │ clamp
│  │ 68px │  .hero-model 3D / #visual-stage   │  --detail-w   │   │ 460–660
│  ├──────┴───────────────────────────────────┴───────────────┤   │
│  └───────────────────────────────────────────────────────────┘   │
│  privacy note                                                    │
└──────────────────────────────────────────────────────────────────┘
```

- **Nothing floats over the artifact.** No absolutely-positioned card inside
  `.stage-grid`. If something needs to live next to the artifact, it gets a
  column or a band. This is what fixed the overlap bugs; don't undo it.
- **`.explorer-card` must not clip its overflow.** `overflow: hidden` on it
  is what cut off the hostel dropdown. The corners are rounded on `.toolbar`
  (top) and `.key-bar` (bottom) instead. `.toolbar` sits at `z-index: 5`
  above `.stage-grid`'s `1`, so the menu opens over the stage cleanly.
- **Floors are a vertical rail on the left of the stage**, inside the card.
  The "ALL" button only appears in the 3D view — the floor plan always draws
  exactly one floor. Not a dropdown in the toolbar corner: that put the most
  frequently used control in the least reachable spot.
- **The right column is only ever room detail**, and it is a *stack of cards*
  on a recessed column, not one tinted strip: a status-coloured identity card
  (title left, status pill hard right, Room/Floor/Pod as large figures), then
  the ranked destination choices as their own card. Counts live in
  `.page-head` beside the headline, never here.
- **`#room-panel` is shared by both views.** Clicking a room in the floor
  plan *or* the 3D model fills the same column — `viewer3d.js` dispatches
  `nivas:room-click`, `app.js` treats it exactly like a floor-plan click.
- **The key lives in the toolbar**, between the hostel picker and the view
  switch. Four labels only; each one's meaning is a tooltip on hover or
  keyboard focus, so nothing is unexplained and the toolbar stays quiet.
- **One entry point to the listing form:** the header CTA, which reads
  "Create my swap listing" and switches to "Update my swap listing" once a
  listing exists. The old nav had a "My swap listing" tab that did the same
  thing — two controls, one action, no reason. Don't re-add it.
- **No zoom controls.** The 3D view already zooms by scroll and the floor
  plan is legible at stage size.
- **The 3D viewer shows one hostel at a time.** A multi-hostel side-by-side
  compare mode was tried and reverted — same shared camera meant orbiting
  moved all buildings together, and it didn't fix the real lag (3x the
  detailed geometry rendering regardless of camera setup). Don't re-add it
  without solving the lag first.
- There is no search input — removed deliberately more than once. Hostel
  selection is the picker dropdown only.
- Breakpoints: **1240px** (card goes full width, smaller headline, room-
  detail card narrows), **980px** (insight tiles go 2-up, floating cards
  shrink their padding), **690px** (topbar wraps, toolbar wraps, stage
  420px, key card collapses to just the first swatch, room-detail card
  narrows further).

## Assets

`assets/iith-hostel-facade.png` and `assets/iith-typical-floor-plan.png` are
supplied IIT-H reference material, not generated. **Don't have an agent
regenerate them** — ask for a new file if a change is needed.
