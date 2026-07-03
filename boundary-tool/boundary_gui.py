#!/usr/bin/env python3
"""TRACE.IT Track Boundary Tool — GUI."""
from __future__ import annotations

import ctypes
import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox

import matplotlib
matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure
import numpy as np

from boundary_io import PALETTE, export
from ibt_parser import parse_ibt
from track_geometry import build_lap_line, gps_origin

# ── Colours ───────────────────────────────────────────────────────────────────
BG      = "#111113"
PANEL   = "#1c1c1f"
PANEL2  = "#252529"
FG      = "#e4e4e7"
MUTED   = "#71717a"
BORDER  = "#2e2e33"
OUTER_C = "#22c55e"
INNER_C = "#ef4444"
ACCENT  = "#3b82f6"
WHITE   = "#e2e8f0"


def _fmt_time(t: float) -> str:
    mins = int(t) // 60
    secs = t - mins * 60
    return f"{mins}:{secs:06.3f}" if mins else f"{secs:.3f}s"


# ── Lap card list ─────────────────────────────────────────────────────────────

class LapList(tk.Canvas):
    """Scrollable column of clickable lap cards drawn on a Canvas."""
    ROW = 56

    def __init__(self, parent, on_click, **kw):
        super().__init__(parent, bg=PANEL, highlightthickness=0, bd=0, **kw)
        self._data: list[dict] = []
        self._hover: int | None = None
        self.on_click = on_click
        self.bind("<Motion>",    self._motion)
        self.bind("<Leave>",     self._leave)
        self.bind("<Button-1>",  self._click)
        self.bind("<Configure>", lambda _e: self._redraw())
        self.bind("<MouseWheel>", self._wheel)

    # public
    def load(self, items):
        """items: list of (gid, lap, color)"""
        self._data = [{"gid": g, "lap": l, "color": c, "role": None}
                      for g, l, c in items]
        self._hover = None
        self.configure(scrollregion=(0, 0, 0, len(self._data) * self.ROW))
        self._redraw()

    def update_roles(self, roles: dict):
        for d in self._data:
            d["role"] = roles.get(d["gid"])
        self._redraw()

    def clear(self):
        self._data.clear()
        self._hover = None
        self.configure(scrollregion=(0, 0, 0, 0))
        self.delete("all")

    # events
    def _idx_at(self, y) -> int | None:
        cy = self.canvasy(y)
        idx = int(cy // self.ROW)
        return idx if 0 <= idx < len(self._data) else None

    def _motion(self, e):
        idx = self._idx_at(e.y)
        if idx != self._hover:
            self._hover = idx
            self._redraw()

    def _leave(self, _e):
        if self._hover is not None:
            self._hover = None
            self._redraw()

    def _click(self, e):
        idx = self._idx_at(e.y)
        if idx is not None:
            self.on_click(self._data[idx]["gid"])

    def _wheel(self, e):
        self.yview_scroll(-1 * (e.delta // 120), "units")

    # draw
    def _redraw(self):
        self.delete("all")
        W = self.winfo_width() or 260

        for i, d in enumerate(self._data):
            y0 = i * self.ROW
            y1 = y0 + self.ROW
            role = d["role"]
            hov  = (i == self._hover)

            if role == "outer":
                bg = "#0d1f12"; bar = OUTER_C; badge = "OUTER"; badge_c = OUTER_C
            elif role == "inner":
                bg = "#200f0f"; bar = INNER_C; badge = "INNER"; badge_c = INNER_C
            elif hov:
                bg = PANEL2; bar = d["color"]; badge = ""; badge_c = FG
            else:
                bg = PANEL; bar = d["color"]; badge = ""; badge_c = FG

            self.create_rectangle(0, y0, W, y1, fill=bg, outline="")
            self.create_line(0, y1 - 1, W, y1 - 1, fill=BORDER)
            self.create_rectangle(0, y0, 4, y1, fill=bar, outline="")
            self.create_text(
                18, y0 + 18, text=f"Lap {d['lap'].lap}",
                fill=FG, font=("Segoe UI", 10, "bold"), anchor="w")
            self.create_text(
                18, y0 + 37, text=_fmt_time(d["lap"].lap_time_s),
                fill=MUTED, font=("Segoe UI", 8), anchor="w")
            if badge:
                self.create_text(
                    W - 12, y0 + self.ROW // 2, text=badge,
                    fill=badge_c, font=("Segoe UI", 8, "bold"), anchor="e")


# ── Flat button ───────────────────────────────────────────────────────────────

class _VScrollbar(tk.Canvas):
    """Thin custom vertical scrollbar matching the dark theme."""
    W = 8

    def __init__(self, parent, **kw):
        super().__init__(parent, width=self.W, bg=PANEL2,
                         highlightthickness=0, bd=0, **kw)
        self._lo = 0.0
        self._hi = 1.0
        self._hover = False
        self._drag: tuple | None = None   # (start_y_px, lo_at_press)
        self._cmd = None
        self.bind("<Configure>",       lambda _e: self._redraw())
        self.bind("<ButtonPress-1>",   self._press)
        self.bind("<B1-Motion>",       self._drag_move)
        self.bind("<ButtonRelease-1>", lambda _e: self._end_drag())
        self.bind("<Enter>", lambda _e: self._set_hover(True))
        self.bind("<Leave>", lambda _e: self._set_hover(False))

    # called by yview-linked widget
    def set(self, lo: str, hi: str):
        self._lo, self._hi = float(lo), float(hi)
        self._redraw()

    def set_command(self, cmd):
        self._cmd = cmd

    def _thumb(self):
        h = self.winfo_height()
        if h < 1:
            return 0, 0
        pad = 3
        y0 = max(pad, round(self._lo * h))
        y1 = min(h - pad, round(self._hi * h))
        y1 = max(y1, y0 + 20)
        return y0, y1

    def _redraw(self):
        self.delete("all")
        if self._hi - self._lo >= 1.0:
            return
        y0, y1 = self._thumb()
        c = "#b0b0b8" if self._hover else "#606068"
        self.create_rectangle(1, y0, self.W - 1, y1, fill=c, outline="")

    def _set_hover(self, on: bool):
        self._hover = on
        self._redraw()

    def _press(self, e):
        y0, y1 = self._thumb()
        if y0 <= e.y <= y1:
            self._drag = (e.y, self._lo)
        elif self._cmd:
            h = self.winfo_height()
            self._cmd("moveto", e.y / h - (self._hi - self._lo) / 2)

    def _drag_move(self, e):
        if self._drag is None or self._cmd is None:
            return
        h = self.winfo_height()
        if h < 1:
            return
        start_y, start_lo = self._drag
        self._cmd("moveto", start_lo + (e.y - start_y) / h)

    def _end_drag(self):
        self._drag = None


class _WinBtn(tk.Button):
    """Minimize / maximize / close button for the custom titlebar."""
    def __init__(self, parent, text, command, close=False):
        hbg = "#c42b1c" if close else "#2d2d32"
        super().__init__(parent, text=text, command=command,
                         bg=PANEL, fg=MUTED,
                         activebackground=hbg, activeforeground=FG,
                         relief="flat", bd=0, highlightthickness=0,
                         width=4, pady=0,
                         font=("Segoe UI", 9),
                         cursor="hand2")
        self._hbg = hbg
        self.bind("<Enter>", lambda _e: self.config(bg=self._hbg, fg=FG))
        self.bind("<Leave>", lambda _e: self.config(bg=PANEL,    fg=MUTED))


class _Btn(tk.Button):
    _NOR = "#2a2a2e"; _HOV = "#3a3a3e"
    _PRI = "#2563eb"; _PHV = "#1d4ed8"

    def __init__(self, parent, primary=False, **kw):
        bg  = self._PRI if primary else self._NOR
        hbg = self._PHV if primary else self._HOV
        super().__init__(parent, bg=bg, fg=FG, activebackground=hbg,
                         activeforeground=FG, disabledforeground="#555",
                         relief="flat", bd=0, highlightthickness=0,
                         padx=12, pady=7,
                         cursor="hand2", font=("Segoe UI", 9), **kw)
        self._bg = bg; self._hbg = hbg; self._enabled = True
        self.bind("<Enter>", lambda _e: self._hov(True))
        self.bind("<Leave>", lambda _e: self._hov(False))

    def _hov(self, on: bool):
        if self._enabled:
            self.config(bg=self._hbg if on else self._bg)

    def config(self, **kw):
        if "state" in kw:
            self._enabled = kw["state"] != "disabled"
            if not self._enabled:
                kw.setdefault("bg", "#1c1c22")
            else:
                kw.setdefault("bg", self._bg)
        super().config(**kw)


# ── App ───────────────────────────────────────────────────────────────────────

class BoundaryApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("TRACE.IT — Track Boundary Tool")
        self.overrideredirect(True)
        self.configure(bg=BG)

        self.session = None
        self.lines: dict[int, dict] = {}
        self.outer_gid: int | None = None
        self.inner_gid: int | None = None
        self.hover_gid: int | None = None
        self._home_xlim: tuple | None = None
        self._home_ylim: tuple | None = None
        self._maximized  = False
        self._prev_geo   = "1200x760"
        self._drag_x = self._drag_y = 0

        self._build()
        self._center(1200, 760)
        self.update()          # ensure HWND is realised before Win32 calls
        self._win32_init()

    def _center(self, w: int, h: int):
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"{w}x{h}+{(sw-w)//2}+{(sh-h)//2}")

    def _win32_init(self):
        """Fix taskbar presence and add drop-shadow (Windows 10+)."""
        try:
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            GWL_EXSTYLE      = -20
            WS_EX_APPWINDOW  = 0x00040000
            WS_EX_TOOLWINDOW = 0x00000080

            # Hide → restyle → show so Windows picks up the new style immediately
            # (avoids the multi-second taskbar icon delay)
            self.withdraw()
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            style = (style & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, 2, ctypes.byref(ctypes.c_int(2)), 4)
            self.deiconify()

            # Set icon after deiconify so withdraw() doesn't wipe it
            base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
            ico = os.path.join(base, "icon.ico")
            if os.path.exists(ico):
                self.iconbitmap(ico)
                LR_LOADFROMFILE = 0x0010
                LR_DEFAULTSIZE  = 0x0040
                hicon = ctypes.windll.user32.LoadImageW(
                    None, ico, 1, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE)
                if hicon:
                    WM_SETICON = 0x0080
                    ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, 1, hicon)  # ICON_BIG
                    ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, 0, hicon)  # ICON_SMALL
        except Exception:
            pass

    # ── layout ───────────────────────────────────────────────────────────────
    def _build(self):
        self._build_topbar()
        self._build_main()

    def _build_topbar(self):
        bar = tk.Frame(self, bg=PANEL, height=48)
        bar.pack(side="top", fill="x")
        bar.pack_propagate(False)

        # ── window controls (right side, packed first so they don't get clipped) ──
        ctrl = tk.Frame(bar, bg=PANEL)
        ctrl.pack(side="right", fill="y")
        _WinBtn(ctrl, "─", self._minimize).pack(side="left", fill="y", ipadx=2)
        self._max_btn = _WinBtn(ctrl, "□", self._toggle_maximize)
        self._max_btn.pack(side="left", fill="y", ipadx=2)
        _WinBtn(ctrl, "✕", self.destroy, close=True).pack(side="left", fill="y", ipadx=2)

        # ── left: logo + separator + open button + track name ────────────────
        lf = tk.Frame(bar, bg=PANEL)
        lf.pack(side="left", padx=16)
        lbl_trace = tk.Label(lf, text="TRACE.IT", bg=PANEL, fg=ACCENT,
                             font=("Segoe UI", 11, "bold"))
        lbl_trace.pack(side="left")
        lbl_sub = tk.Label(lf, text="  ·  Track Boundary Tool", bg=PANEL, fg=MUTED,
                           font=("Segoe UI", 10))
        lbl_sub.pack(side="left")

        tk.Frame(bar, bg=BORDER, width=1).pack(side="left", fill="y", pady=10)

        self._open_btn = _Btn(bar, text="Open IBT…", command=self.open_ibt)
        self._open_btn.pack(side="left", padx=14)

        self._track_lbl = tk.Label(bar, text="", bg=PANEL, fg=FG,
                                   font=("Segoe UI", 10))
        self._track_lbl.pack(side="left")

        # ── make bar + static labels draggable ───────────────────────────────
        for w in (bar, lf, lbl_trace, lbl_sub, self._track_lbl):
            w.bind("<ButtonPress-1>",   self._drag_start)
            w.bind("<B1-Motion>",       self._drag_move)
            w.bind("<ButtonPress-3>",   self._drag_start)
            w.bind("<B3-Motion>",       self._drag_move)
            w.bind("<Double-Button-1>", self._toggle_maximize)

    # ── window management ─────────────────────────────────────────────────────
    def _drag_start(self, e):
        if self._maximized:
            return
        self._drag_x = e.x_root - self.winfo_x()
        self._drag_y = e.y_root - self.winfo_y()

    def _drag_move(self, e):
        if self._maximized:
            return
        self.geometry(f"+{e.x_root - self._drag_x}+{e.y_root - self._drag_y}")

    def _minimize(self):
        # SW_MINIMIZE works even with overrideredirect on Windows
        try:
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            ctypes.windll.user32.ShowWindow(hwnd, 6)   # SW_MINIMIZE
        except Exception:
            self.iconify()

    def _toggle_maximize(self, _e=None):
        if self._maximized:
            self.geometry(self._prev_geo)
            self._max_btn.config(text="□")
            self._maximized = False
        else:
            self._prev_geo = self.geometry()
            try:
                # Use work area (excludes taskbar)
                from ctypes import Structure, byref, c_long
                class RECT(Structure):
                    _fields_ = [("left",c_long),("top",c_long),
                                ("right",c_long),("bottom",c_long)]
                r = RECT()
                ctypes.windll.user32.SystemParametersInfoW(48, 0, byref(r), 0)
                self.geometry(f"{r.right-r.left}x{r.bottom-r.top}+{r.left}+{r.top}")
            except Exception:
                sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
                self.geometry(f"{sw}x{sh}+0+0")
            self._max_btn.config(text="❐")
            self._maximized = True

    def _build_main(self):
        main = tk.Frame(self, bg=BG)
        main.pack(fill="both", expand=True)

        # ── sidebar ──────────────────────────────────────────────────────────
        sb = tk.Frame(main, bg=PANEL, width=268)
        sb.pack(side="left", fill="y")
        sb.pack_propagate(False)
        tk.Frame(main, bg=BORDER, width=1).pack(side="left", fill="y")

        shdr = tk.Frame(sb, bg=PANEL)
        shdr.pack(fill="x", padx=14, pady=(14, 4))
        tk.Label(shdr, text="LAPS", bg=PANEL, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(side="left")
        self._lap_count = tk.Label(shdr, text="", bg=PANEL, fg=MUTED,
                                   font=("Segoe UI", 8))
        self._lap_count.pack(side="left", padx=4)

        self._step_lbl = tk.Label(sb, text="Open an .ibt to begin.",
                                  bg=PANEL, fg=MUTED, font=("Segoe UI", 8),
                                  wraplength=240, justify="left", height=2)
        self._step_lbl.pack(anchor="w", padx=14, pady=(0, 8))

        # scrollable lap list
        list_wrap = tk.Frame(sb, bg=PANEL)
        list_wrap.pack(fill="both", expand=True)
        scrollbar = _VScrollbar(list_wrap)
        scrollbar.pack(side="right", fill="y")
        self._lap_list = LapList(list_wrap, self._on_lap_click)
        self._lap_list.pack(side="left", fill="both", expand=True)
        scrollbar.set_command(self._lap_list.yview)
        self._lap_list.config(yscrollcommand=scrollbar.set)

        # sidebar footer
        foot = tk.Frame(sb, bg=PANEL)
        foot.pack(fill="x", side="bottom", padx=14, pady=14)

        self._svg_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            foot, text="Also export .svg preview", variable=self._svg_var,
            bg=PANEL, fg=FG, activebackground=PANEL, activeforeground=FG,
            selectcolor=PANEL2, font=("Segoe UI", 9), relief="flat", bd=0,
        ).pack(anchor="w", pady=(0, 10))

        _Btn(foot, text="Reset selection", command=self.reset
             ).pack(fill="x", pady=(0, 6))

        self._export_btn = _Btn(foot, text="Export boundaries.json",
                                command=self.do_export, primary=True)
        self._export_btn.pack(fill="x")
        self._export_btn.config(state="disabled")

        # ── canvas area ───────────────────────────────────────────────────────
        right = tk.Frame(main, bg=BG)
        right.pack(side="left", fill="both", expand=True)

        self.fig = Figure(facecolor=BG)
        self.ax  = self.fig.add_subplot(111)
        self._style_ax()

        self.mpl = FigureCanvasTkAgg(self.fig, master=right)
        self.mpl.get_tk_widget().pack(fill="both", expand=True)

        self.toolbar = NavigationToolbar2Tk(self.mpl, right, pack_toolbar=False)
        self.toolbar.config(background=PANEL2)
        for ch in self.toolbar.winfo_children():
            try:
                ch.config(background=PANEL2)
            except tk.TclError:
                pass
        self.toolbar.update()
        self.toolbar.pack(side="bottom", fill="x")

        self.mpl.mpl_connect("motion_notify_event",  self._canvas_motion)
        self.mpl.mpl_connect("button_press_event",   self._canvas_click)
        self.mpl.mpl_connect("button_release_event", self._pan_end)
        self.mpl.mpl_connect("axes_leave_event",     lambda _e: self._set_hover(None))
        self.mpl.mpl_connect("scroll_event",         self._on_scroll)
        self._pan_start_data = None
        self.mpl.draw()

    def _style_ax(self):
        self.ax.set_facecolor(BG)
        self.ax.tick_params(colors=MUTED, labelsize=7)
        for sp in self.ax.spines.values():
            sp.set_color(BORDER)
        self.ax.set_aspect("equal", adjustable="datalim")

    # ── open IBT ─────────────────────────────────────────────────────────────
    def open_ibt(self):
        path = filedialog.askopenfilename(
            title="Select an iRacing telemetry file (.ibt)",
            filetypes=[("iRacing telemetry", "*.ibt"), ("All files", "*.*")])
        if not path:
            return
        try:
            session = parse_ibt(path)
        except Exception as ex:
            messagebox.showerror("Parse error", f"Could not read this file:\n{ex}")
            return
        if session.data.get("Lat") is None:
            messagebox.showerror("No GPS data",
                "This IBT has no Lat/Lon channels.\n"
                "Boundaries require GPS position data.")
            return
        if not session.laps:
            messagebox.showwarning("No complete laps",
                "No complete laps found — drive at least 2 full laps in a stint.")
            return
        self.session = session
        self._track_lbl.config(
            text=f"{session.track_name}  ·  {len(session.laps)} laps")
        self._lap_count.config(text=f"({len(session.laps)})")
        self._draw_laps()

    # ── draw laps ─────────────────────────────────────────────────────────────
    def _draw_laps(self):
        self.ax.clear()
        self._style_ax()
        self.lines.clear()
        self.outer_gid = self.inner_gid = self.hover_gid = None

        origin = gps_origin(self.session.data["Lat"], self.session.data["Lon"])
        cards  = []
        for n, lap in enumerate(self.session.laps):
            _, sx, sy = build_lap_line(
                self.session.data, lap.start_idx, lap.end_idx, origin)
            color = PALETTE[n % len(PALETTE)]
            (ln,) = self.ax.plot(sx, sy, color=color, lw=1.4, picker=8)
            ln.set_gid(str(n))
            mid = len(sx) // 2
            self.ax.annotate(
                str(lap.lap), (sx[mid], sy[mid]),
                color=color, fontsize=8, fontweight="bold",
                ha="center", va="center",
                bbox=dict(boxstyle="round,pad=0.25", fc=BG, ec="none", alpha=0.75))
            self.lines[n] = {"line": ln, "lap": lap, "color": color}
            cards.append((n, lap, color))

        self._lap_list.load(cards)
        self._refresh()
        self.mpl.draw()
        self.ax.autoscale(False)
        self._home_xlim = self.ax.get_xlim()
        self._home_ylim = self.ax.get_ylim()
        self.toolbar.update()        # clear old nav stack
        self.toolbar.push_current()  # push full-map view as home

    # ── selection ─────────────────────────────────────────────────────────────
    def _on_lap_click(self, gid: int):
        if gid == self.outer_gid:
            self.outer_gid = None
        elif gid == self.inner_gid:
            self.inner_gid = None
        elif self.outer_gid is None:
            self.outer_gid = gid
        elif self.inner_gid is None:
            self.inner_gid = gid
        else:
            # both set — clicking a new lap replaces outer
            self.outer_gid = gid
        self._refresh()

    def reset(self):
        self.outer_gid = self.inner_gid = None
        self._refresh()

    # ── canvas events ─────────────────────────────────────────────────────────
    def _nearest_gid(self, event) -> int | None:
        """Return the gid of the line closest to the cursor, or None if no line
        is within the picker tolerance.  Uses Line2D.contains() which measures
        true perpendicular distance to each segment in screen pixels."""
        if event.inaxes is not self.ax or not self.lines:
            return None
        hits: list[tuple[float, int]] = []
        for gid, d in self.lines.items():
            hit, info = d["line"].contains(event)
            if not hit:
                continue
            # among the segments that were hit, take the closest point distance
            indices = info.get("ind", np.array([0]))
            pts = self.ax.transData.transform(d["line"].get_xydata()[indices])
            dx, dy = pts[:, 0] - event.x, pts[:, 1] - event.y
            dist = float(np.min(dx * dx + dy * dy))
            hits.append((dist, gid))
        if not hits:
            return None
        hits.sort()
        return hits[0][1]

    def _panning(self) -> bool:
        return bool(getattr(self.toolbar, "mode", ""))

    def _canvas_motion(self, e):
        if self._pan_start_data and e.inaxes is self.ax:
            px0, py0, (lx0, lx1), (ly0, ly1) = self._pan_start_data
            # convert pixel delta to data units using the frozen transform
            inv = self.ax.transData.inverted()
            dx_data, dy_data = inv.transform((e.x, e.y)) - inv.transform((px0, py0))
            self.ax.set_xlim(lx0 - dx_data, lx1 - dx_data)
            self.ax.set_ylim(ly0 - dy_data, ly1 - dy_data)
            self.mpl.draw_idle()
        elif not self._panning():
            self._set_hover(self._nearest_gid(e))

    def _canvas_click(self, e):
        if e.button == 1 and not self._panning():
            g = self._nearest_gid(e)
            if g is not None:
                self._on_lap_click(g)
        elif e.button == 3 and e.inaxes is self.ax:
            # store start in screen pixels + current limits
            self._pan_start_data = (e.x, e.y,
                                    self.ax.get_xlim(), self.ax.get_ylim())

    def _pan_end(self, e):
        if e.button == 3:
            self._pan_start_data = None

    def _set_hover(self, gid: int | None):
        if gid != self.hover_gid:
            self.hover_gid = gid
            self._refresh()

    def _on_scroll(self, e):
        if e.inaxes is not self.ax or e.xdata is None:
            return
        s  = 1 / 1.15 if e.button == "up" else 1.15
        x0, x1 = self.ax.get_xlim()
        y0, y1 = self.ax.get_ylim()
        rx = (e.xdata - x0) / (x1 - x0)
        ry = (e.ydata - y0) / (y1 - y0)
        nw, nh = (x1 - x0) * s, (y1 - y0) * s
        self.ax.set_xlim(e.xdata - nw * rx,  e.xdata + nw * (1 - rx))
        self.ax.set_ylim(e.ydata - nh * ry,  e.ydata + nh * (1 - ry))
        self.mpl.draw_idle()

    # ── refresh ───────────────────────────────────────────────────────────────
    def _refresh(self):
        has_sel = self.outer_gid is not None or self.inner_gid is not None

        for gid, d in self.lines.items():
            ln = d["line"]
            if gid == self.outer_gid:
                ln.set_color(OUTER_C); ln.set_linewidth(3.0)
                ln.set_zorder(10);     ln.set_alpha(1.0)
            elif gid == self.inner_gid:
                ln.set_color(INNER_C); ln.set_linewidth(3.0)
                ln.set_zorder(10);     ln.set_alpha(1.0)
            elif gid == self.hover_gid:
                ln.set_color(WHITE);   ln.set_linewidth(2.5)
                ln.set_zorder(8);      ln.set_alpha(1.0)
            else:
                ln.set_color(d["color"]); ln.set_linewidth(1.4)
                ln.set_zorder(1);         ln.set_alpha(0.3 if has_sel else 0.85)

        roles = {gid: ("outer" if gid == self.outer_gid
                        else "inner" if gid == self.inner_gid
                        else None)
                 for gid in self.lines}
        self._lap_list.update_roles(roles)

        ready = self.outer_gid is not None and self.inner_gid is not None
        self._export_btn.config(state="normal" if ready else "disabled")

        if not self.lines:
            step = "Open an .ibt to begin."
        elif ready:
            o = self.lines[self.outer_gid]["lap"].lap
            i = self.lines[self.inner_gid]["lap"].lap
            step = f"Outer = Lap {o}  ·  Inner = Lap {i}\nReady to export."
        elif self.outer_gid is not None:
            step = "Outer set. Now select the inner boundary lap."
        else:
            step = "Click a lap card (or a line in the preview) to set as outer boundary."
        self._step_lbl.config(text=step)

        self.mpl.draw_idle()

    # ── export ────────────────────────────────────────────────────────────────
    def do_export(self):
        if self.outer_gid is None or self.inner_gid is None:
            return
        out = filedialog.asksaveasfilename(
            title="Save boundaries", defaultextension=".json",
            initialfile=f"{self.session.track_id}.json",
            filetypes=[("JSON", "*.json"), ("All files", "*.*")])
        if not out:
            return
        ol = self.lines[self.outer_gid]["lap"]
        il = self.lines[self.inner_gid]["lap"]
        try:
            o_n, i_n, svg = export(self.session, ol, il, out, self._svg_var.get())
        except Exception as ex:
            messagebox.showerror("Export error", str(ex))
            return
        msg = (f"Track: {self.session.track_name}\n"
               f"Outer: {o_n} pts   ·   Inner: {i_n} pts\n\n{out}")
        if svg:
            msg += f"\n\nSVG: {svg}"
        messagebox.showinfo("Exported", msg)
        self._step_lbl.config(text=f"Saved → {os.path.basename(out)}")


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    BoundaryApp().mainloop()


if __name__ == "__main__":
    main()
