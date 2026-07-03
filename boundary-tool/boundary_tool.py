#!/usr/bin/env python3
"""TRACE.IT Track Boundary Tool — command-line front-end.

For the graphical version, run `boundary_gui.py` (this is the headless/CLI path).

Workflow
--------
1. Drive a stint hugging the OUTER edge for a few laps, then the INNER edge for
   a few laps — all in one .ibt file.
2. Run this tool. Every complete lap is reconstructed as its own line in a
   preview. Click the OUTER lap, then the INNER lap ('r' resets).
3. The two laps are written to boundaries.json, keyed by track name.

Usage
-----
    python boundary_tool.py path/to/boundary-laps.ibt
    python boundary_tool.py laps.ibt -o boundaries.json --svg
"""
from __future__ import annotations

import argparse
import os
import sys

import matplotlib.pyplot as plt

from boundary_io import PALETTE, export
from ibt_parser import ParsedSession, parse_ibt
from track_geometry import build_lap_line, gps_origin


def pick_boundaries(session: ParsedSession):
    """Show every lap; user clicks OUTER then INNER. Returns (outer, inner) LapInfo."""
    lat = session.data.get("Lat")
    lon = session.data.get("Lon")
    if lat is None or lon is None:
        sys.exit("This IBT has no GPS (Lat/Lon) channels — cannot extract boundaries.")

    origin = gps_origin(lat, lon)
    fig, ax = plt.subplots(figsize=(10, 8))
    fig.canvas.manager.set_window_title("TRACE.IT — Track Boundary Tool")

    lines: dict[int, tuple] = {}
    for n, lap in enumerate(session.laps):
        _, sx, sy = build_lap_line(session.data, lap.start_idx, lap.end_idx, origin)
        color = PALETTE[n % len(PALETTE)]
        (ln,) = ax.plot(sx, sy, color=color, lw=1.5, picker=6,
                        label=f"Lap {lap.lap}   {lap.lap_time_s:0.1f}s")
        ln.set_gid(str(n))
        mid = len(sx) // 2
        ax.annotate(str(lap.lap), (sx[mid], sy[mid]),
                    color=color, fontsize=9, fontweight="bold")
        lines[n] = (ln, lap, color)

    ax.set_aspect("equal", adjustable="datalim")
    ax.set_title("Click the OUTER boundary lap")
    ax.legend(loc="upper right", fontsize=8, ncol=2)
    ax.grid(True, alpha=0.15)
    fig.text(0.5, 0.01, "Click OUTER, then INNER   •   'r' = reset   •   close window to export",
             ha="center", fontsize=9, color="#666")

    state: dict[str, int | None] = {"outer": None, "inner": None}

    def reset():
        for ln, _lap, color in lines.values():
            ln.set_linewidth(1.5)
            ln.set_color(color)
        state["outer"] = state["inner"] = None
        ax.set_title("Click the OUTER boundary lap")
        fig.canvas.draw_idle()

    def on_pick(event):
        gid = event.artist.get_gid()
        if gid is None:
            return
        n = int(gid)
        if state["outer"] is None:
            state["outer"] = n
            event.artist.set_linewidth(3.5)
            event.artist.set_color("#22c55e")
            ax.set_title("Click the INNER boundary lap")
        elif state["inner"] is None and n != state["outer"]:
            state["inner"] = n
            event.artist.set_linewidth(3.5)
            event.artist.set_color("#ef4444")
            ax.set_title("Outer (green) + Inner (red) selected — close window to export")
        fig.canvas.draw_idle()

    def on_key(event):
        if event.key == "r":
            reset()

    fig.canvas.mpl_connect("pick_event", on_pick)
    fig.canvas.mpl_connect("key_press_event", on_key)
    plt.show()

    if state["outer"] is None or state["inner"] is None:
        sys.exit("Selection cancelled — both an outer and an inner lap are required.")

    return lines[state["outer"]][1], lines[state["inner"]][1]


def ask_for_ibt() -> str | None:
    """Native file-open dialog (used when no path is given)."""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        return None
    root = tk.Tk()
    root.withdraw()
    path = filedialog.askopenfilename(
        title="Select an iRacing telemetry file (.ibt)",
        filetypes=[("iRacing telemetry", "*.ibt"), ("All files", "*.*")])
    root.destroy()
    return path or None


def main():
    ap = argparse.ArgumentParser(description="TRACE.IT track boundary extractor (CLI).")
    ap.add_argument("ibt", nargs="?",
                    help="Path to the .ibt file (omit to pick one in a dialog)")
    ap.add_argument("-o", "--out", default="boundaries.json",
                    help="Output JSON file (merged if it already exists)")
    ap.add_argument("--svg", action="store_true",
                    help="Also write a standalone .svg preview next to the JSON")
    args = ap.parse_args()

    ibt = args.ibt or ask_for_ibt()
    if not ibt:
        sys.exit("No file selected.")
    if not os.path.exists(ibt):
        sys.exit(f"File not found: {ibt}")

    session = parse_ibt(ibt)
    print(f"Track : {session.track_name}  (id {session.track_id})")
    print(f"Laps  : {len(session.laps)} complete")
    if not session.laps:
        sys.exit("No complete laps found in this file — drive at least 2 full laps.")

    outer, inner = pick_boundaries(session)
    o_n, i_n, svg = export(session, outer, inner, args.out, args.svg)
    print(f"Outer : lap {outer.lap} ({o_n} pts)    Inner : lap {inner.lap} ({i_n} pts)")
    print(f"Wrote '{session.track_name}' -> {args.out}")
    if svg:
        print(f"Wrote SVG preview -> {svg}")


if __name__ == "__main__":
    try:
        main()
    finally:
        if len(sys.argv) == 1:
            try:
                input("\nPress Enter to close...")
            except EOFError:
                pass
