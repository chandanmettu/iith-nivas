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

- Sidebar 248px fixed → 72px icon rail under 980px → hidden under 690px.
  Holds the primary nav and the three activity stat tiles
  (`.sidebar-stats`/`.sidebar-stat`) — there is no listing-CTA card in the
  sidebar; that action lives once, in the hero (`#hero-create-listing`) and
  once in the nav ("My swap listing" tab). Don't add a third entry point.
- **The entire explorer is one `.app-panel` shell** — pitch strip / toolbar /
  legend / stage (500px), divided only by hairline borders. Do not give any
  of these sections its own margin, border, radius, or shadow; that produces
  a fragmented "stack of floating cards" look, which is exactly what this
  structure replaced (see PROGRESS.md). One card, one shadow, one set of
  rounded corners. The activity stats live in the sidebar, not this panel.
- `#legend` sits as its own bar between the toolbar and `.panel-stage`,
  **shared by both the 3D and floor-plan views** — it is not nested inside
  `.hero-model` any more. If you add a new view, it appears above that too.
- Inside the panel, `.panel-stage` holds `.hero-model` (3D) and
  `#visual-stage` (site/floor/map) as absolutely-positioned siblings at a
  fixed height — they're mutually exclusive via `.hidden`, so stacking them
  means switching views never reflows the panel around them.
- The 3D viewer can show 1–3 hostels at once (`buildingSlots` in
  `viewer3d.js`), laid out side by side with a floating name+count label per
  building. Selection is multi-select (checkbox-style) in the hostel dropdown,
  capped at 3 — there is no search input any more, it was removed deliberately.
- Breakpoints: **980px** (collapse sidebar to icon rail, stack the pitch
  strip, drop the room panel) and **690px** (mobile — hide sidebar entirely,
  wrap the toolbar, stack everything). Note the activity stats are only
  visible when the sidebar is — they disappear below 690px along with nav.

## Assets

`assets/iith-hostel-facade.png` and `assets/iith-typical-floor-plan.png` are
supplied IIT-H reference material, not generated. **Don't have an agent
regenerate them** — ask for a new file if a change is needed.
