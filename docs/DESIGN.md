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

**This separation is deliberate and load-bearing.** An earlier version used red
for both "primary button" and "vacant room", so a red button and a red room
meant unrelated things on the same screen. Status colours now sit clear of the
brand ramp, and **vacant is outlined rather than filled** — absence reads as
absence.

| State | Token | Treatment |
|---|---|---|
| Occupied | `--status-occupied` `#47875f` | solid fill |
| Vacant | `--status-vacant` `#c2554a` | **outline** on `--status-vacant-fill` `#fdece8` |
| Intern reserve | `--status-intern` `#d99a2b` | solid fill |
| M.Tech | `--status-mtech` `#6b4fa8` | solid fill |
| Graduate | `--status-graduate` `#c75b8c` | solid fill |

Each has a `-tint` variant for pill backgrounds.

**`viewer3d.js` duplicates these values** in its `statusColors` map (three.js
can't read CSS variables). If you change a status colour, change it in both
places — a room must read as the same state in the 3D scene and on the floor
plan. The city-scale friend markers use deliberately *lifted* versions, because
the flat UI values go muddy against the dark scene.

### Neutrals — warm

Greys are warm (maroon-tinted), never neutral grey. `--ink-900` → `--ink-400`
for text, `--line` / `--line-soft` for borders, `--surface` (cards) /
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
| `--r-sm` | 6px | buttons, inputs, list rows |
| `--r-md` | 10px | menus, panels, segmented controls |
| `--r-lg` | 14px | cards, floating cards |
| `--r-xl` | 20px | workspace shell, modals |
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

Scale: `--fs-micro` (10) · `--fs-xs` (11) · `--fs-sm` (12) · `--fs-md` (13, body)
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
| `.segmented` + `.seg-btn` | view switcher, request tabs |
| `.chip` | small pill toggle (Friends map) |
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

- Sidebar 248px fixed → 72px icon rail under 980px → content margin follows.
- Workspace is one rounded `--r-xl` shell: toolbar / legend / stage (500px) /
  stats. The stage swaps between four views; only one is ever un-`hidden`.
- Breakpoints: **980px** (collapse sidebar, drop the room panel) and **690px**
  (mobile — hide hero copy and live summary, stack everything).

## Assets

`assets/iith-hostel-facade.png` and `assets/iith-typical-floor-plan.png` are
supplied IIT-H reference material, not generated. **Don't have an agent
regenerate them** — ask for a new file if a change is needed.
