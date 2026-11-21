"""Extract Sabah from a geoBoundaries ADM1 GeoJSON and print JS arrays for maplight.html.
Usage: python -I sabah_outline.py <geojson> <out.js>"""
import json, math, sys

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
sabah = next(f for f in d['features'] if f['properties'].get('shapeName') == 'Sabah')
g = sabah['geometry']
polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
rings = [p[0] for p in polys]  # outer rings only

def area(r):  # signed, lon/lat units (positive = counter-clockwise)
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2

def dp(pts, tol):  # Douglas-Peucker on an open polyline
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-12
    idx, dmax = 0, 0
    for i in range(1, len(pts) - 1):
        dd = abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L
        if dd > dmax: idx, dmax = i, dd
    if dmax <= tol: return [a, b]
    return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)

def dp_ring(r, tol):  # closed ring: split at the point farthest from the start, simplify both halves
    r = r[:-1] if r[0] == r[-1] else r
    far = max(range(len(r)), key=lambda i: math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]))
    return dp(r[:far + 1], tol)[:-1] + dp(r[far:] + [r[0]], tol)

rings.sort(key=lambda r: -abs(area(r)))
main = rings[0]
if area(main) > 0: main = main[::-1]          # clockwise on the map (y = north up)
main = main[:-1]
k = min(range(len(main)), key=lambda i: math.hypot(main[i][0] - 116.75, main[i][1] - 7.03))  # start at the Kudat tip
main = main[k:] + main[:k]
main = dp_ring(main + [main[0]], 0.004)
islands = [dp_ring(r, 0.004) for r in rings[1:] if abs(area(r)) > 0.0015]
islands = [r + [r[0]] for r in islands]
fmt = lambda r: '[' + ','.join(f'[{x:.3f},{y:.3f}]' for x, y in r) + ']'
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Sabah boundary: geoBoundaries gbOpen MYS ADM1 (simplified), from OpenStreetMap. © OpenStreetMap contributors, ODbL 1.0.\n')
    f.write('// Mainland ring runs clockwise from the Kudat tip; Douglas-Peucker simplified (tolerance 0.004°, about 450 m).\n')
    f.write(f'const OUTLINE = {fmt(main)};\n')
    f.write(f'const ISLANDS = [{",".join(fmt(r) for r in islands)}];\n')
print('mainland points:', len(main), '| islands kept:', len(islands), 'of', len(rings) - 1,
      '| bbox lon', round(min(p[0] for p in main), 3), round(max(p[0] for p in main), 3), 'lat', round(min(p[1] for p in main), 3), round(max(p[1] for p in main), 3))
