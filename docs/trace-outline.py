"""Regenerates plan-geometry.js from assets/iith-typical-floor-plan.png.

The 3D viewer used to model the block as two hand-placed crosses, which read as
two overlapping lumps rather than the linked zigzag the drawing shows.  Instead
of eyeballing it again, this walks the actual perimeter out of the drawing:

  1. flood the white paper from a corner, so every white pocket *inside* the
     drawing is whatever is left over,
  2. union those pockets with app.js's traced room polygons (rooms are reachable
     from outside through their door openings, so they are not pockets),
  3. morphologically close the hairline wall seams, keep the largest blob and
     fill its holes -> the footprint,
  4. walk the footprint boundary, resample and smooth it to a fixed-length ring,
  5. for every room polygon, find the stretch of that ring it fronts onto.

Everything stays in the 1748x1252 plan space so the emitted coordinates line up
1:1 with app.js's roomShapes and index.html's floor-plan viewBox.

    python3 docs/trace-outline.py      # run from the repo root
"""

import re
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PLAN = "assets/iith-typical-floor-plan.png"
OUT_JS = "plan-geometry.js"
RING_POINTS = 480          # ~11 px apart; fine enough for the louvre spacing
FACADE_REACH = 24          # px from a room polygon to count as its facade
SLIVER_RADIUS = 18         # narrowest notch the envelope is allowed to keep


def dilate(mask, radius):
    out = mask.copy()
    for _ in range(radius):
        pad = np.zeros_like(out)
        pad[1:, :] |= out[:-1, :]; pad[:-1, :] |= out[1:, :]
        pad[:, 1:] |= out[:, :-1]; pad[:, :-1] |= out[:, 1:]
        out |= pad
    return out


def flood(seedable, seeds, shape):
    seen = np.zeros(shape, bool)
    queue = deque()
    for x, y in seeds:
        if seedable[y, x] and not seen[y, x]:
            seen[y, x] = True; queue.append((x, y))
    height, width = shape
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and seedable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; queue.append((nx, ny))
    return seen


def room_polygons():
    source = open("app.js").read()
    polygons = []
    for path in re.findall(r'"(M[\d\s.LZ]+Z)"', source):
        values = [float(v) for v in re.findall(r"[\d.]+", path)]
        polygons.append(np.array(list(zip(values[0::2], values[1::2]))))
    return polygons                      # 30 rooms, then pod 3's two void cells


def footprint():
    grey = np.asarray(Image.open(PLAN).convert("L"), np.uint8)
    height, width = grey.shape
    paper = grey > 236
    outside = flood(paper, [(0, 0)], grey.shape)
    mask = paper & ~outside              # every white pocket inside the drawing

    rooms = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(rooms)
    for polygon in room_polygons():
        draw.polygon([tuple(p) for p in polygon], fill=255)
    mask |= np.asarray(rooms) > 0

    mask = ~dilate(~dilate(mask, 11), 11)          # close the wall hairlines
    mask = dilate(mask, 3)
    border = [(x, y) for x in range(width) for y in (0, height - 1)]
    border += [(x, y) for y in range(height) for x in (0, width - 1)]
    mask = ~flood(~mask, border, grey.shape)       # fill the rooms/atria back in
    # A second close, this time on the filled footprint. The service blocks have
    # short wall stubs on the perimeter that trap slivers of background against
    # it; the first close cannot reach them because they stay open to the
    # outside, and extruded nine storeys a sliver reads as a dent in the facade.
    mask = ~dilate(~dilate(mask, SLIVER_RADIUS), SLIVER_RADIUS)
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(2.5))) > 127


def boundary_walk(mask):
    """Ordered boundary pixels. The footprint has no pinch points, so a greedy
    nearest-unvisited walk is enough and avoids Moore-tracing bookkeeping."""
    inner = mask.copy()
    pad = np.ones_like(inner)
    pad[1:, :] &= inner[:-1, :]; pad[:-1, :] &= inner[1:, :]
    pad[:, 1:] &= inner[:, :-1]; pad[:, :-1] &= inner[:, 1:]
    ys, xs = np.nonzero(mask & ~pad)
    buckets = {}
    for x, y in zip(xs.tolist(), ys.tolist()):
        buckets.setdefault((x // 4, y // 4), []).append((x, y))
    remaining = set(zip(xs.tolist(), ys.tolist()))
    current = (int(xs[ys == ys.min()].min()), int(ys.min()))
    path = [current]; remaining.discard(current)
    while True:
        (cx, cy), best, best_d = current, None, 9
        for gx in range(cx // 4 - 1, cx // 4 + 2):
            for gy in range(cy // 4 - 1, cy // 4 + 2):
                for point in buckets.get((gx, gy), ()):
                    if point in remaining:
                        d = (point[0] - cx) ** 2 + (point[1] - cy) ** 2
                        if d < best_d: best_d, best = d, point
        if best is None or best_d > 8: return np.array(path, float)
        path.append(best); remaining.discard(best); current = best


def resample(points, count):
    loop = np.vstack([points, points[:1]])
    walked = np.r_[0, np.cumsum(np.hypot(*np.diff(loop, axis=0).T))]
    at = np.linspace(0, walked[-1], count, endpoint=False)
    return np.c_[np.interp(at, walked, loop[:, 0]), np.interp(at, walked, loop[:, 1])]


def smooth(points, passes):
    for _ in range(passes):
        points = (np.roll(points, 1, 0) + 2 * points + np.roll(points, -1, 0)) / 4
    return points


def distance_to(points, polygon):
    best = np.full(len(points), 1e9)
    for i in range(len(polygon)):
        a, b = polygon[i], polygon[(i + 1) % len(polygon)]
        edge = b - a
        length = float(edge @ edge)
        if not length: continue
        t = np.clip(((points - a) @ edge) / length, 0, 1)
        best = np.minimum(best, np.hypot(*(points - (a + t[:, None] * edge)).T))
    return best


def main():
    ring = smooth(resample(boundary_walk(footprint()), 1800), 30)
    # The close/dilate above inflates the footprint; push back along the inward
    # normal so the ring lands on the perimeter wall itself.
    step = np.roll(ring, -1, 0) - np.roll(ring, 1, 0)
    normal = np.c_[step[:, 1], -step[:, 0]]
    normal /= np.linalg.norm(normal, axis=1)[:, None]
    signed = np.sum(ring[:, 0] * np.roll(ring[:, 1], -1) - np.roll(ring[:, 0], -1) * ring[:, 1])
    ring = smooth(resample(ring + normal * (7.0 if signed > 0 else -7.0), RING_POINTS), 6)

    polygons = room_polygons()
    reach = np.array([distance_to(ring, p) for p in polygons])
    owner = np.where(reach.min(0) < FACADE_REACH, reach.argmin(0), -1)
    # Start the ring on open balcony so no room's stretch straddles index 0.
    shift = int(np.nonzero(owner == -1)[0][0])
    ring, owner = np.roll(ring, -shift, 0), np.roll(owner, -shift)

    runs = {}
    for i in range(len(polygons)):
        found = np.nonzero(owner == i)[0]
        runs[i] = [int(found.min()), int(found.max())] if len(found) else None
    broken = [i + 1 for i, run in runs.items()
              if run is None or int((owner[run[0]:run[1] + 1] != i).sum()) > 2]
    if broken:
        raise SystemExit(f"rooms {broken} did not resolve to one clean facade run")

    # Guard against needles coming back. A needle folds the ring back on itself,
    # so two points a long way apart along the ring end up close in space; a real
    # corner, however tight, keeps its chord comparable to its arc.
    spacing = np.hypot(*np.diff(np.vstack([ring, ring[:1]]), axis=0).T).mean()
    for step in (4, 6, 8):
        chord = np.hypot(*(np.roll(ring, -step, 0) - ring).T)
        if chord.min() < .35 * step * spacing:
            where = ring[int(chord.argmin())]
            raise SystemExit(f"ring folds back on itself near plan {where.round().tolist()} "
                             f"— raise SLIVER_RADIUS above {SLIVER_RADIUS}")

    origin = (ring[:, 0].mean(), ring[:, 1].mean())
    run_js = lambda i: "null" if runs[i] is None else "[%d,%d]" % tuple(runs[i])
    open(OUT_JS, "w").write("\n".join([
        "/* GENERATED from assets/iith-typical-floor-plan.png by docs/trace-outline.py.",
        " * Do not hand-edit; rerun the script instead.",
        " *",
        " * Coordinates are the SAME 1748x1252 plan space app.js uses for roomShapes and",
        " * index.html uses for the floor-plan viewBox, so the 3D massing and the 2D plan",
        " * are literally the same drawing. OUTLINE is the building perimeter as one closed",
        " * ring; ROOM_FACADE[n] is the stretch of that ring room n+1 fronts onto. Anything",
        " * no room claims is open louvred balcony. */",
        "export const PLAN_ORIGIN = [%.1f, %.1f];" % origin,
        "export const OUTLINE = [" + ",".join("[%.1f,%.1f]" % (x, y) for x, y in ring) + "];",
        "export const ROOM_FACADE = [" + ",".join(run_js(i) for i in range(30)) + "];",
        "/* The two cells pod 3 is drawn with but does not have: blank wall, no status panel. */",
        "export const VOID_FACADE = [" + ",".join(run_js(i) for i in (30, 31)) + "];",
    ]) + "\n")
    print(f"{OUT_JS}: {len(ring)} ring points, "
          f"{100 * (owner >= 0).mean():.0f}% of the perimeter is room facade")


if __name__ == "__main__":
    main()
