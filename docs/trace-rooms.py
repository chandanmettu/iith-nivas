import numpy as np, json, sys
from PIL import Image
from collections import deque

im = Image.open('assets/iith-typical-floor-plan.png').convert('L')
a = np.asarray(im, dtype=np.uint8); H, W = a.shape
wall = a < 110

def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        p = np.zeros_like(out)
        p[1:, :] |= out[:-1, :]; p[:-1, :] |= out[1:, :]
        p[:, 1:] |= out[:, :-1]; p[:, :-1] |= out[:, 1:]
        out |= p
    return out

R = 14
barrier = dilate(wall, R)

def fill(sx, sy, limit=200000):
    if barrier[sy, sx]: return None
    seen = np.zeros_like(barrier); q = deque([(sx, sy)]); seen[sy, sx] = True; n = 1
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny,nx] and not barrier[ny,nx]:
                seen[ny,nx] = True; n += 1
                if n > limit: return None
                q.append((nx,ny))
    return seen

def hull(points):
    pts = sorted(set(map(tuple, points)))
    if len(pts) < 3: return pts
    def half(ps):
        out = []
        for p in ps:
            while len(out) >= 2:
                (x1,y1),(x2,y2) = out[-2], out[-1]
                if (x2-x1)*(p[1]-y1) - (y2-y1)*(p[0]-x1) <= 0: out.pop()
                else: break
            out.append(p)
        return out
    return half(pts)[:-1] + half(pts[::-1])[:-1]

def simplify(poly, eps=3.0):
    """Merge vertices whose turn contributes less than eps of deviation."""
    changed = True; poly = poly[:]
    while changed and len(poly) > 3:
        changed = False
        for i in range(len(poly)):
            a_, b_, c_ = poly[i-1], poly[i], poly[(i+1) % len(poly)]
            ax, ay = a_; bx, by = b_; cx, cy = c_
            L = ((cx-ax)**2 + (cy-ay)**2) ** .5
            d = abs((cx-ax)*(ay-by) - (ax-bx)*(cy-ay)) / L if L else 0
            if d < eps:
                poly.pop(i); changed = True; break
    return poly

def room_polygon(sx, sy):
    core = fill(sx, sy)
    if core is None: return None
    full = dilate(core, R) & ~wall
    ys, xs = np.nonzero(full)
    if len(xs) < 500: return None
    h = hull(list(zip(xs.tolist(), ys.tolist())))
    return simplify([(int(x), int(y)) for x, y in h], eps=3.5), int(full.sum())

if __name__ == '__main__':
    seeds = json.load(open(sys.argv[1]))
    result = {}
    for key, (sx, sy) in seeds.items():
        r = room_polygon(sx, sy)
        result[key] = None if r is None else {"poly": r[0], "area": r[1]}
        print(f"{key:12} {'LEAK/none' if r is None else str(r[1]).rjust(6)+' px, '+str(len(r[0]))+' pts'}")
    json.dump(result, open('/tmp/polys.json','w'))
