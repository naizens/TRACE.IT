"""GPS lap-line reconstruction for the TRACE.IT boundary tool.

iRacing IBT stores Lat/Lon as projected metric coordinates (not decimal
degrees), so we use the raw values directly — no degree-to-radian conversion.
We filter to GPS *knots* (samples where the value actually changes, which
matches the GPS update rate) and apply a 5-pass Gaussian smooth to suppress
float32 quantisation noise.
"""
from __future__ import annotations

import numpy as np


def knot_indices(lat: np.ndarray, lon: np.ndarray, start: int, end: int) -> list[int]:
    """Sample indices where GPS updates (lat or lon changes) — plus start & end."""
    idxs = [start]
    for i in range(start + 1, end + 1):
        if lat[i] != lat[i - 1] or lon[i] != lon[i - 1]:
            idxs.append(i)
    if idxs[-1] != end:
        idxs.append(end)
    return idxs


def smooth_knots(kx: np.ndarray, ky: np.ndarray, passes: int = 5):
    """5 passes of a [0.25, 0.5, 0.25] binomial kernel; endpoints fixed."""
    kx = kx.astype(np.float64).copy()
    ky = ky.astype(np.float64).copy()
    if len(kx) > 4:
        for _ in range(passes):
            sx = kx.copy(); sy = ky.copy()
            sx[1:-1] = kx[:-2] * 0.25 + kx[1:-1] * 0.5 + kx[2:] * 0.25
            sy[1:-1] = ky[:-2] * 0.25 + ky[1:-1] * 0.5 + ky[2:] * 0.25
            kx, ky = sx, sy
    return kx, ky


def build_lap_line(data: dict[str, np.ndarray], start: int, end: int,
                   origin=None):
    """Return (knot_indices, smoothed_x, smoothed_y) using raw GPS values.

    origin is accepted for API compatibility but ignored — coordinates are
    kept in their native unit so the display matches the actual track shape.
    """
    lat = data["Lat"]
    lon = data["Lon"]
    idxs = knot_indices(lat, lon, start, end)
    kx = np.array([lon[i] for i in idxs], dtype=np.float64)
    ky = np.array([lat[i] for i in idxs], dtype=np.float64)
    sx, sy = smooth_knots(kx, ky)
    return idxs, sx, sy


def lap_lat_lon(data: dict[str, np.ndarray], start: int, end: int) -> list[list[float]]:
    """Raw GPS knots as [lat, lon] pairs for export."""
    lat = data["Lat"]
    lon = data["Lon"]
    idxs = knot_indices(lat, lon, start, end)
    return [[float(lat[i]), float(lon[i])] for i in idxs]


# kept for backward-compat — no longer needed for display
def gps_origin(lat: np.ndarray, lon: np.ndarray) -> dict:
    return {"lat0": float(lat[0]), "lon0": float(lon[0])}
