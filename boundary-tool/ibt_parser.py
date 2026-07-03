"""iRacing IBT binary parser — minimal port for boundary extraction.

Extracts only the channels needed to reconstruct GPS lap lines:
    Lat, Lon, LapDist, LapDistPct, Lap, SessionTime

Ported from the TRACE.IT Electron parser (src/main/ibt-parser.ts) so the
coordinate reconstruction is byte-for-byte identical to what the app renders.

Verified header offsets:
      8 -> tickRate            (int32)
     16 -> sessionInfoLen      (int32)
     20 -> sessionInfoOffset   (int32)
     24 -> numVars             (int32)
     28 -> varHeaderOffset     (int32)
     36 -> bufLen              (int32)
     52 -> varBuf[0].bufOffset (int32)
    140 -> numSamples          (int32)

Variable descriptor: 144 bytes each
    +0   type   (int32)  0=char 1=bool 2=int 3=bitfield 4=float 5=double
    +4   offset (int32)
    +8   count  (int32)
   +16   name   (char[32], null-terminated ASCII)
"""
from __future__ import annotations

import re
import struct
from dataclasses import dataclass

import numpy as np

# Channels we extract (subset of the Electron app's NEEDED_VARS).
NEEDED_VARS = {"Lat", "Lon", "LapDist", "LapDistPct", "Lap", "SessionTime"}

# IBT type id -> (numpy dtype, byte size).
_DTYPE: dict[int, tuple[type, int]] = {
    0: (np.uint8, 1),    # char
    1: (np.uint8, 1),    # bool
    2: (np.int32, 4),    # int
    3: (np.uint32, 4),   # bitfield
    4: (np.float32, 4),  # float
    5: (np.float64, 8),  # double
}


@dataclass
class LapInfo:
    lap: int
    start_idx: int
    end_idx: int
    lap_time_s: float


@dataclass
class ParsedSession:
    tick_rate_hz: int
    sample_count: int
    track_id: int | None
    track_name: str
    laps: list[LapInfo]
    data: dict[str, np.ndarray]


def _i32(buf: bytes, off: int) -> int:
    return struct.unpack_from("<i", buf, off)[0]


def _grab(text: str, key: str) -> str:
    """Read a simple scalar YAML field via regex (iRacing YAML has non-standard
    ';' inline comments that break a real YAML loader)."""
    m = re.search(rf"{re.escape(key)}:\s*(.+)", text)
    if not m:
        return ""
    return m.group(1).split(";")[0].strip().strip('"')


def parse_ibt(path: str) -> ParsedSession:
    with open(path, "rb") as f:
        buf = f.read()

    tick_rate           = _i32(buf, 8)
    session_info_len    = _i32(buf, 16)
    session_info_offset = _i32(buf, 20)
    num_vars            = _i32(buf, 24)
    var_header_offset   = _i32(buf, 28)
    buf_len             = _i32(buf, 36)
    buf_offset          = _i32(buf, 52)
    num_samples         = _i32(buf, 140)

    # ── Session YAML → track name + id ───────────────────────────────────────
    raw = buf[session_info_offset : session_info_offset + session_info_len]
    text = raw.split(b"\x00", 1)[0].decode("latin-1", errors="replace")

    track_id: int | None = None
    m = re.search(r"TrackID:\s*(\d+)", text)
    if m:
        track_id = int(m.group(1))

    short = _grab(text, "TrackDisplayShortName") or _grab(text, "TrackDisplayName")
    config = _grab(text, "TrackConfigName")
    track_name = (f"{short} {config}".strip()
                  or _grab(text, "TrackName")
                  or "Unknown Track")

    # ── Variable descriptors ─────────────────────────────────────────────────
    var_map: dict[str, tuple[int, int]] = {}
    for i in range(num_vars):
        pos = var_header_offset + i * 144
        vtype = _i32(buf, pos)
        voff = _i32(buf, pos + 4)
        name_end = buf.index(b"\x00", pos + 16)
        name = buf[pos + 16 : min(name_end, pos + 48)].decode("ascii", errors="replace")
        if name in NEEDED_VARS:
            var_map[name] = (voff, vtype)

    # ── Sample extraction via numpy strides ──────────────────────────────────
    region = np.frombuffer(
        buf, dtype=np.uint8, count=num_samples * buf_len, offset=buf_offset
    ).reshape(num_samples, buf_len)

    data: dict[str, np.ndarray] = {}
    for name, (voff, vtype) in var_map.items():
        np_dt, size = _DTYPE[vtype]
        col = region[:, voff : voff + size].copy().view(np_dt).ravel()
        data[name] = col.astype(np.float64)

    laps = _segment_laps(data, num_samples)

    return ParsedSession(
        tick_rate_hz=tick_rate,
        sample_count=num_samples,
        track_id=track_id,
        track_name=track_name,
        laps=laps,
        data=data,
    )


def _segment_laps(data: dict[str, np.ndarray], num_samples: int) -> list[LapInfo]:
    """Phase-1 lap detection (LapDistPct >0.9 → <0.1 while Lap increments).

    Faithful to the Electron parser's getLapsMap() crossing logic; we only need
    start/end indices for boundary extraction, so the precise sub-tick crossing
    interpolation (phase 2) is omitted — lap_time_s is approximate, used only as
    a selection label.
    """
    lap_ch = data.get("Lap")
    dist_pct = data.get("LapDistPct")
    st = data.get("SessionTime")
    if lap_ch is None or dist_pct is None or num_samples < 2:
        return []

    prev_dist = np.empty(num_samples)
    prev_dist[0] = 0.0
    prev_dist[1:] = dist_pct[:-1]
    prev_lap = np.empty(num_samples)
    prev_lap[0] = 0.0
    prev_lap[1:] = lap_ch[:-1]

    idx = np.arange(num_samples)
    crossings = np.where(
        (idx > 0) & (prev_dist > 0.9) & (dist_pct < 0.1) & (prev_lap < lap_ch)
    )[0]

    laps: list[LapInfo] = []
    for n in range(len(crossings) - 1):
        s = int(crossings[n])
        e = int(crossings[n + 1]) - 1
        lt = float(st[e] - st[s]) if st is not None else 0.0
        laps.append(LapInfo(lap=n + 1, start_idx=s, end_idx=e, lap_time_s=lt))
    return laps
