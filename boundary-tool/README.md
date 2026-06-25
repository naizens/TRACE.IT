# TRACE.IT — Track Boundary Tool

A small standalone tool for recording the **inner and outer limits** of an
iRacing circuit and exporting them as `boundaries.json` for the
[TRACE.IT telemetry app](https://github.com/naizens/TRACE.IT) to draw on its
track map.

Boundaries are a one-time-per-circuit job, so this lives outside the main app as
its own little project (and its own repo / release).

---

## How it works

The track map in TRACE.IT reconstructs the driving line from the IBT's GPS
channels (`Lat`/`Lon`): it projects them into local metres around a shared
origin, keeps only the GPS *knots*, and applies a 5-pass Gaussian smooth. This
tool ports that **exact** pipeline (`track_geometry.py`), so the boundaries you
export line up pixel-for-pixel with your laps in the app.

It exports **raw lat/lon** points (not pre-projected XY). The app re-projects
them with whatever origin the current reference lap uses, keeping boundaries and
live laps in lockstep no matter which session is loaded.

---

## Recording the laps

1. In iRacing, do a stint where you:
   - hug the **outer** edge of the track for a couple of laps, then
   - hug the **inner** edge for a couple of laps.
   Keep it all in one stint so it lands in a single `.ibt` file.
2. You don't need a perfect lap — drive 2–3 attempts per side and pick the
   cleanest one at the end.

> Telemetry IBT files live under
> `Documents/iRacing/telemetry/` after you enable disk telemetry in iRacing
> (press **Alt+L** in-sim to start/stop recording).

---

## Usage — GUI (recommended)

Double-click `trace-boundary-tool.exe`, or:

```bash
pip install -r requirements.txt
python boundary_gui.py
```

1. **Open IBT…** and select your boundary-laps file.
2. Every complete lap is drawn in the preview. Pick the **OUTER** lap and the
   **INNER** lap, either way:
   - **In the preview:** the *Click assigns to* toggle decides whether the next
     click sets Outer or Inner (it auto-advances Outer → Inner). Hovering
     highlights the nearest line, so you can click *anywhere near* it — no need
     to hit the thin line exactly. **Scroll to zoom** in on a section; selecting
     keeps working while zoomed.
   - **Or the dropdowns:** pick laps precisely by number.
   Green = outer, red = inner. *Reset selection* clears them.
3. Tick *Also export .svg preview* if you want a standalone SVG too.
4. **Export boundaries.json** → choose where to save.

Running it again on another track appends to the same `boundaries.json` (keyed
by track name), so you build up a library of circuits over time.

## Usage — CLI (headless / scripting)

```bash
python boundary_tool.py path/to/boundary-laps.ibt        # opens a matplotlib picker
python boundary_tool.py laps.ibt -o boundaries.json      # custom output path
python boundary_tool.py laps.ibt --svg                   # also write a .svg preview
```

In the CLI picker, click the OUTER lap then the INNER lap, press `r` to reset,
and close the window to export.

---

## Output format

```jsonc
{
  "Brands Hatch Grand Prix": {
    "trackId": 205,
    "outer": [[51.3569, 0.2601], [51.3570, 0.2603], /* … [lat, lon] knots */],
    "inner": [[51.3571, 0.2598], /* … */]
  }
}
```

---

## Building a standalone .exe

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name trace-boundary-tool boundary_gui.py
```

`--windowed` builds a GUI app with no console window. The bundled matplotlib
backend keeps the one-file build around ~40 MB. The result lands in `dist/`.

---

## Files

| File | Purpose |
|------|---------|
| `boundary_gui.py`   | **GUI app** (tkinter + embedded matplotlib) — the main entry point |
| `boundary_tool.py`  | CLI front-end with a matplotlib lap picker |
| `boundary_io.py`    | Shared JSON + SVG export helpers (no matplotlib dependency) |
| `ibt_parser.py`     | Minimal IBT parser (GPS + lap segmentation), ported from the app |
| `track_geometry.py` | GPS → metres projection + Gaussian smoothing, ported from the app |
