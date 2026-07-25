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

### Room status — never brand

**This separation is deliberate and load-bearing.** Brand red means an action,
never a room state. Swap-status colours sit clear of the brand ramp, so room
information cannot be confused with an interactive control.

| State | Token | Treatment |
|---|---|---|
| Unlisted | `--status-unlisted` `#514346` | darkened solid; means no published listing |
| Registered | `--status-occupied` `#47875f` | solid fill |
| Open to swap | `--status-open` `#d99a2b` | solid fill with a soft glow |
| Match for you | `--status-match` `#3c8ca0` | brighter personalized glow |

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

**A normal scrolling page, one full-bleed explorer card, floating context
cards over the stage — no side rail.** This replaced a two-column
(artifact + context rail) layout that itself replaced a sidebar layout,
in consecutive sessions; see PROGRESS.md if you're tempted to bring either
back. `.app-shell` is a plain flex column (`min-height: 100dvh`, page
scrolls); `.topbar` is `position: sticky; top: 0`.

```
┌────────────────────────────────────────────────────────────────┐
│ .topbar   brand · nav · Create-listing CTA                     │  60px, sticky
├────────────────────────────────────────────────────────────────┤
│ .page-intro   "Find the room swap that fits."                  │
│                                                                  │
│  .explorer-card ───────────────────────────────────────────┐   │
│  │ .toolbar  picker · view switch · floor <select>          │   │  64px
│  ├───────────────────────────────────────────────────────────┤   │
│  │ .panel-stage  clamp(440px, 58vh, 600px)                   │   │
│  │  .key-card (↖)         .room-detail-card (↗)              │   │
│  │  .zoom-controls (↙)    with .room-detail-stats footer      │   │
│  │  (.hero-model 3D / #visual-stage floor+map, full-bleed)   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  .insight-row   2 clickable tiles + 1 privacy note              │
└────────────────────────────────────────────────────────────────┘
```

- **`.panel-stage` is the artifact, full width, no side column competing for
  it.** `.hero-model` (3D) and `#visual-stage` (site/floor/map) are
  absolutely-positioned siblings inside it — mutually exclusive via
  `.hidden`, so switching views never reflows anything. Give it a fixed-ish
  height (`clamp(...)`, currently 440–600px) rather than growing with the
  viewport — the floating cards need a stable frame to anchor to.
- **`.key-card`, `.zoom-controls`, `.room-detail-card` are absolutely
  positioned inside `.panel-stage`**, not in a side rail. All three are white
  cards with the same border/radius/shadow, so they read consistently over
  both the dark 3D scene and the light floor-plan background. Don't move any
  of them back into a persistent column — that's the exact thing this
  structure replaced twice already.
- **`#room-panel` (the room-detail card) is shared by both views.** Clicking
  a room in the floor plan *or* the 3D viewer populates the same card —
  `viewer3d.js` dispatches `nivas:room-click` on a 3D click, `app.js`
  handles it the same way as a floor-plan click. Don't let one view grow its
  own separate detail UI again.
- **Floor selection is one `<select>` in the toolbar** (`#floor-select`), not
  a rail of buttons. It lists "All floors" only when the 3D view is active
  (floor-plan always needs one specific floor). Don't reintroduce a
  vertical floor-button rail — that pattern existed in two different forms
  (light and dark) in earlier sessions and both were replaced by this.
- **No sidebar.** Nav lives in `.topbar` alongside the brand and the single
  primary CTA (`#hero-create-listing`). With the "My swap listing" nav tab
  that's two entry points to the listing form — don't add a third.
- The on-canvas `.three-title`/`.three-readout` text overlays are hidden
  (`display: none`) wherever they'd sit under `.key-card` — their job moved
  to the toolbar (hostel name) and the room-detail card (click feedback).
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
