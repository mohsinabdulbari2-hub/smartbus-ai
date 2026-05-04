#!/usr/bin/env python3
"""
Convert the BMTC GTFS feed (https://github.com/Vonter/bmtc-gtfs) into the
three JSON files the seed script consumes:
    lib/db/src/data/bmtc-stops.json     [{id, name, lat, lng}]
    lib/db/src/data/bmtc-routes.json    [{id, number, name, from, to,
                                          busType, color, stops: [stopId,...]}]
    lib/db/src/data/bmtc-shapes.json    {routeId: [[lat,lng], ...]}  (simplified)

Source: GTFS feed extracted to /tmp/bmtc_extract/ (or pass --src).

Stops are renamed s<gtfs_stop_id>, routes r<gtfs_route_id>.
Each route is matched to ONE representative trip:
  - direction 0 (UP) preferred
  - longest stop sequence wins (most complete variant)
The chosen trip's shape (if any) is simplified via Douglas-Peucker (~80 points)
and written to bmtc-shapes.json.

Only stops actually used by at least one route are emitted (keeps file small).
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import os
from collections import defaultdict
from pathlib import Path

# ── colors per bus type (matches existing seed palette) ──────────────────────
BUS_TYPE_COLORS = {
    "Vajra":       "#7C3AED",
    "Volvo":       "#0EA5E9",
    "Airport":     "#F59E0B",
    "MetroFeeder": "#10B981",
    "Night":       "#1E293B",
    "Ordinary":    "#DC2626",
}

def classify_bus_type(short_name: str) -> str:
    n = (short_name or "").upper()
    if n.startswith("KIA") or n.startswith("BIAS") or "VAYU" in n:
        return "Airport"
    if n.startswith("MF"):
        return "MetroFeeder"
    if n.startswith("V-") or "AC" in n:
        return "Volvo" if "AC" in n else "Vajra"
    return "Ordinary"

# ── Douglas-Peucker simplification on a polyline (lat,lng pairs) ─────────────
def perpendicular_distance(p, a, b):
    # great-circle would be more correct but for short city polylines plain
    # planar distance in degree-space is plenty accurate for visual simplification
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    x0, y0 = p
    x1, y1 = a
    x2, y2 = b
    num = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
    den = math.hypot(y2 - y1, x2 - x1)
    return num / den if den else 0.0

def rdp(points, eps):
    if len(points) < 3:
        return list(points)
    # iterative DP to avoid recursion depth on long shapes
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        max_d = -1.0
        max_k = -1
        a = points[i]
        b = points[j]
        for k in range(i + 1, j):
            d = perpendicular_distance(points[k], a, b)
            if d > max_d:
                max_d = d
                max_k = k
        if max_d > eps:
            keep[max_k] = True
            stack.append((i, max_k))
            stack.append((max_k, j))
    return [p for p, k in zip(points, keep) if k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/tmp/bmtc_extract",
                    help="Path to extracted GTFS feed")
    ap.add_argument("--out", default="lib/db/src/data",
                    help="Output directory for JSON files")
    ap.add_argument("--simplify-eps", type=float, default=0.00018,
                    help="Douglas-Peucker epsilon in degrees (~20 m)")
    ap.add_argument("--max-shape-pts", type=int, default=120,
                    help="Hard cap per route shape after simplification")
    args = ap.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # ── stops.txt ────────────────────────────────────────────────────────────
    print("→ Loading stops…")
    stops_raw: dict[str, dict] = {}
    with (src / "stops.txt").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sid = row["stop_id"].strip()
            try:
                lat = float(row["stop_lat"])
                lng = float(row["stop_lon"])
            except (ValueError, KeyError):
                continue
            if not (12 < lat < 14 and 77 < lng < 78.5):
                continue  # filter junk coords outside Bengaluru bounding box
            stops_raw[sid] = {
                "id": f"s{sid}",
                "name": row["stop_name"].strip(),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            }
    print(f"  {len(stops_raw):,} stops loaded")

    # ── routes.txt ───────────────────────────────────────────────────────────
    print("→ Loading routes…")
    routes_raw: dict[str, dict] = {}
    with (src / "routes.txt").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row["route_id"].strip()
            num = (row.get("route_short_name") or "").strip()
            long_name = (row.get("route_long_name") or "").strip()
            if "⇔" in long_name:
                a, _, b = long_name.partition("⇔")
                from_, to_ = a.strip(), b.strip()
            else:
                from_, to_ = long_name, long_name
            bt = classify_bus_type(num)
            routes_raw[rid] = {
                "id": f"r{rid}",
                "_gtfs_id": rid,
                "number": num,
                "name": long_name,
                "from": from_,
                "to": to_,
                "busType": bt,
                "color": BUS_TYPE_COLORS[bt],
                "stops": [],
            }
    print(f"  {len(routes_raw):,} routes loaded")

    # ── trips.txt ────────────────────────────────────────────────────────────
    # We need one representative trip per route. Prefer direction_id == 0,
    # then later prefer the trip with the most stops in stop_times.
    print("→ Loading trips…")
    trips_by_route: dict[str, list[dict]] = defaultdict(list)
    with (src / "trips.txt").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            trips_by_route[row["route_id"].strip()].append({
                "trip_id": row["trip_id"].strip(),
                "shape_id": (row.get("shape_id") or "").strip(),
                "direction_id": (row.get("direction_id") or "0").strip(),
            })
    print(f"  {sum(len(v) for v in trips_by_route.values()):,} trips")

    # ── stop_times.txt — group stop sequences by trip_id ────────────────────
    print("→ Loading stop_times (this is the big one)…")
    stops_by_trip: dict[str, list[tuple[int, str]]] = defaultdict(list)
    with (src / "stop_times.txt").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                seq = int(row["stop_sequence"])
            except (ValueError, KeyError):
                continue
            stops_by_trip[row["trip_id"].strip()].append((seq, row["stop_id"].strip()))
    print(f"  {len(stops_by_trip):,} trips have stop sequences")

    # ── For each route pick best trip & assign stop list ────────────────────
    print("→ Picking representative trip per route…")
    chosen_trip_per_route: dict[str, str] = {}  # route_id → trip_id
    for rid, route in routes_raw.items():
        candidates = trips_by_route.get(rid, [])
        if not candidates:
            continue
        # rank: direction 0 first, then most stops
        best_trip_id = None
        best_score = (-1, -1)  # (dir-pref, stop-count)
        for t in candidates:
            seq = stops_by_trip.get(t["trip_id"], [])
            if not seq:
                continue
            dir_pref = 1 if t["direction_id"] == "0" else 0
            score = (dir_pref, len(seq))
            if score > best_score:
                best_score = score
                best_trip_id = t["trip_id"]
        if not best_trip_id:
            continue
        seq = sorted(stops_by_trip[best_trip_id])
        # filter to stops we actually have geometry for
        stop_ids = [sid for _, sid in seq if sid in stops_raw]
        if len(stop_ids) < 2:
            continue
        route["stops"] = [f"s{sid}" for sid in stop_ids]
        chosen_trip_per_route[rid] = best_trip_id
        # refine from/to from real terminal stop names if long_name was empty
        if not route["from"] or route["from"] == route["to"]:
            route["from"] = stops_raw[stop_ids[0]]["name"]
            route["to"]   = stops_raw[stop_ids[-1]]["name"]

    routes_final = [r for r in routes_raw.values() if r["stops"]]
    print(f"  {len(routes_final):,} routes have a usable trip")

    # ── Filter stops to only those used by ≥1 route ─────────────────────────
    used_stop_ids = set()
    for r in routes_final:
        used_stop_ids.update(r["stops"])
    stops_final = [s for s in stops_raw.values() if s["id"] in used_stop_ids]
    print(f"  {len(stops_final):,} stops kept (used by ≥1 route)")

    # ── shapes.txt — assemble polylines per shape_id, then map to routes ────
    print("→ Loading shapes (this is the other big one)…")
    shape_pts: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    with (src / "shapes.txt").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                seq = int(row["shape_pt_sequence"])
                lat = float(row["shape_pt_lat"])
                lng = float(row["shape_pt_lon"])
            except (ValueError, KeyError):
                continue
            shape_pts[row["shape_id"].strip()].append((seq, lat, lng))

    # Build trip_id → shape_id from trips
    trip_shape: dict[str, str] = {}
    for rid, ts in trips_by_route.items():
        for t in ts:
            if t["shape_id"]:
                trip_shape[t["trip_id"]] = t["shape_id"]

    print(f"  {len(shape_pts):,} unique shapes, simplifying…")
    shapes_out: dict[str, list[list[float]]] = {}
    for rid, trip_id in chosen_trip_per_route.items():
        shape_id = trip_shape.get(trip_id, "")
        pts = shape_pts.get(shape_id)
        if not pts:
            continue
        pts.sort()
        latlngs = [(lat, lng) for _, lat, lng in pts]
        simplified = rdp(latlngs, args.simplify_eps)
        # additional uniform downsample if still too long
        if len(simplified) > args.max_shape_pts:
            step = math.ceil(len(simplified) / args.max_shape_pts)
            simplified = simplified[::step]
            if simplified[-1] != latlngs[-1]:
                simplified.append(latlngs[-1])
        shapes_out[f"r{rid}"] = [
            [round(lat, 5), round(lng, 5)] for lat, lng in simplified
        ]

    # ── Write outputs ────────────────────────────────────────────────────────
    # Strip private fields before writing routes
    routes_clean = [
        {k: v for k, v in r.items() if not k.startswith("_")}
        for r in routes_final
    ]
    (out / "bmtc-stops.json").write_text(
        json.dumps(stops_final, separators=(",", ":")), encoding="utf-8"
    )
    (out / "bmtc-routes.json").write_text(
        json.dumps(routes_clean, separators=(",", ":")), encoding="utf-8"
    )
    (out / "bmtc-shapes.json").write_text(
        json.dumps(shapes_out, separators=(",", ":")), encoding="utf-8"
    )

    # ── Summary ──────────────────────────────────────────────────────────────
    type_counts: dict[str, int] = defaultdict(int)
    for r in routes_clean:
        type_counts[r["busType"]] += 1
    avg_stops = sum(len(r["stops"]) for r in routes_clean) / len(routes_clean)
    avg_shape = (sum(len(s) for s in shapes_out.values()) / len(shapes_out)) if shapes_out else 0

    print("\n✅ Done")
    print(f"   stops file:  {(out/'bmtc-stops.json').stat().st_size / 1024:.1f} KB ({len(stops_final):,} stops)")
    print(f"   routes file: {(out/'bmtc-routes.json').stat().st_size / 1024:.1f} KB ({len(routes_clean):,} routes, avg {avg_stops:.1f} stops)")
    print(f"   shapes file: {(out/'bmtc-shapes.json').stat().st_size / 1024:.1f} KB ({len(shapes_out):,} shapes, avg {avg_shape:.1f} pts)")
    print("   Bus types:", dict(type_counts))


if __name__ == "__main__":
    main()
