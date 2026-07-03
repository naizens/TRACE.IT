"""Boundary export helpers (JSON + SVG).

Shared by both front-ends (CLI and GUI). Deliberately free of any matplotlib
dependency so it can be imported from anywhere.
"""
from __future__ import annotations

import json
import os

from track_geometry import build_lap_line, gps_origin, lap_lat_lon

# Distinct palette for the lap preview.
PALETTE = [
    "#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
    "#ef4444", "#14b8a6", "#eab308", "#6366f1", "#f97316",
]


def _svg_path(sx, sy, min_x, min_y, height) -> str:
    """Build an SVG 'd' string; flip Y so the track is upright (SVG y grows down)."""
    pts = [f"{x - min_x:.2f},{height - (y - min_y):.2f}" for x, y in zip(sx, sy)]
    return "M" + " L".join(pts)


def write_svg(session, outer_lap, inner_lap, path):
    origin = gps_origin(session.data["Lat"], session.data["Lon"])
    _, ox, oy = build_lap_line(session.data, outer_lap.start_idx, outer_lap.end_idx, origin)
    _, ix, iy = build_lap_line(session.data, inner_lap.start_idx, inner_lap.end_idx, origin)

    all_x = list(ox) + list(ix)
    all_y = list(oy) + list(iy)
    pad = 10.0
    min_x, max_x = min(all_x) - pad, max(all_x) + pad
    min_y, max_y = min(all_y) - pad, max(all_y) + pad
    w = max_x - min_x
    h = max_y - min_y

    outer_d = _svg_path(ox, oy, min_x, min_y, h)
    inner_d = _svg_path(ix, iy, min_x, min_y, h)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
        f'width="{w:.0f}" height="{h:.0f}">\n'
        f'  <path class="track-edge" d="{outer_d}" fill="none" '
        f'stroke="#5D6496" stroke-width="1"/>\n'
        f'  <path class="track-edge" d="{inner_d}" fill="none" '
        f'stroke="#5D6496" stroke-width="1"/>\n'
        f'</svg>\n'
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return path


def export(session, outer_lap, inner_lap, out_path, with_svg):
    """Write a per-track boundary file. Returns (outer_pts, inner_pts, svg_path)."""
    outer = lap_lat_lon(session.data, outer_lap.start_idx, outer_lap.end_idx)
    inner = lap_lat_lon(session.data, inner_lap.start_idx, inner_lap.end_idx)

    data = {
        "trackId":   session.track_id,
        "trackName": session.track_name,
        "outer":     outer,
        "inner":     inner,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))

    o_n = len(outer)
    i_n = len(inner)

    svg_path = None
    if with_svg:
        svg_path = os.path.splitext(out_path)[0] + ".svg"
        write_svg(session, outer_lap, inner_lap, svg_path)

    return o_n, i_n, svg_path
