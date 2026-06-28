# TRACE.IT — User Guide

TRACE.IT is a desktop telemetry analysis tool for iRacing. Load `.ibt` files from your iRacing telemetry folder and compare lap performance across multiple channels and sessions.

---

## Getting Started

### Loading Files

**Option 1 — Open button:** Click **"Open IBT Files"** in the sidebar to browse for `.ibt` files.

**Option 2 — Drag and drop:** Drag one or more `.ibt` files onto the app window.

You can load multiple files at once to compare sessions side by side.

### Sidebar

The sidebar runs down the left side and stays visible across all tabs. It can be **collapsed** by clicking the **‹** button next to "Open IBT Files", and expanded again with the **›** button on the thin strip.

- **Session list** — Each loaded session appears here. The primary session (first loaded) has a green indicator. Click **✕** to unload a session.
- **Lap list** — All laps for the selected session. Click a color slot (ref / blue / pink / lime) to assign a lap to the comparison. Hover a lap row to see a tooltip with air temp, track temp, humidity, and fuel usage. The fastest full lap is marked with **★**.
- **Track map** — A canvas map at the bottom of the sidebar showing the track outline and driver position. Drag the top edge to resize it; double-click the top edge to reset to default height. Mini-map is hidden in this sidebar view.

---

## Tabs

Navigation tabs appear in the title bar after loading a file.

### Driving

An immersive playback view for analyzing a single lap or comparing two laps side by side.

#### Layout

- **Center:** Track map + HUD + optional delta chart
- **Right sidebar (Traces):** Telemetry traces panel — collapsible via the **›/‹** tab on the right edge
- **Top-right overlay:** Sector splits panel
- **Bottom-left overlay:** Zoom control (magnifying glass)
- **Bottom bar:** Playback controls + distance scrubber

#### Track Map

The map shows track boundaries (outer/inner), driving lines for selected laps, and a moving marker that follows playback position.

- **Track boundaries** are loaded automatically from `Documents/TRACE.IT/boundaries/{trackId}.json` when a file is opened. Bundled boundary files are seeded on first launch.
- The **mini-map** (overview) appears in the top-left of the driving map.

#### Playback Controls

| Button | Action |
|--------|--------|
| ▶ / ⏸ | Play or pause |
| 0.5× 1× 2× 4× | Set playback speed |
| Scrubber bar | Click or drag to seek |

#### Sector Panel (top-right overlay)

Shows sector times for the selected lap(s). Columns: **LAP** time, **sector label**, **REF** time.

- **Click a sector row** to zoom the map and traces to that sector. The scrubber is clamped to the sector range and the player **loops** within it.
- **Click the ⏱ total row** (or **double-click anywhere in the traces**) to reset to the full lap.
- The active sector is highlighted with a blue tint.

#### Zoom Control (bottom-left overlay)

Click the **magnifying glass** button to open a vertical slider that controls how tightly the map follows the driver during playback. Range: 2× – 30×. Click outside to close.

#### Traces Sidebar

Synchronized telemetry charts (throttle, brake, gear, RPM, speed, steering, delta, line diff) over lap distance.

- **Hover** to scrub map and HUD position.
- **Scroll** to zoom in on a distance range.
- **Double-click** to reset zoom and clear any active sector.
- **Collapse/expand** via the **›/‹** tab on the right edge of the panel.

#### HUD

Shows live telemetry values at the current playback position: throttle bar, brake bar, gear, speed (km/h, 1 decimal), and steering angle.

---

### Telemetry

Eight synchronized charts showing vehicle data over lap distance:

| Chart | Unit |
|-------|------|
| Throttle | % |
| Brake | % |
| Gear | — |
| RPM | rev/min |
| Speed | km/h |
| Steering Angle | degrees |
| Time Delta | seconds vs. reference lap |
| Driving Line Diff | lateral deviation vs. reference (m) |

**Toggling charts:** Use the channel buttons at the top of the view to show or hide individual charts.

**Resizing charts:** Drag the horizontal divider between any two charts to adjust their heights. Double-click a divider to reset it.

**Zooming and panning:** Scroll the mouse wheel to pan left/right along lap distance. Use the scroll wheel while holding the appropriate modifier (or pinch on a trackpad) to zoom in. Double-click any chart to reset zoom and pan.

**Locking the cursor:** Click on a chart to lock the cursor at that lap distance. Click again or double-click to unlock.

**Multi-lap comparison:** All selected laps render on the same chart in their assigned colors. The **ref** slot (white) is used as the reference for the Time Delta and Driving Line Diff channels.

---

### Damper

Shock velocity histograms for all four corners (LF, RF, LR, RR), showing how often the dampers move at each velocity during the lap.

- **Range selector** (±200 / ±250 / ±300 mm/s) — sets the width of the histogram x-axis.
- **Threshold selector** (±25 / ±50 / ±75 / ±100 mm/s) — splits bars into **Low-Speed (LS)** and **High-Speed (HS)** damping zones. LS bars are brighter; HS bars are dimmed.
- **Stats header** above each chart shows percentage breakdown: HS RBD, LS RBD, LS COMP, HS COMP.
- **Corner toggles** (LF / RF / LR / RR) — show or hide individual corners.

---

### Shocks

Two sub-tabs accessible from the **Shocks** dropdown in the title bar:

#### Deflection
Shows how far the suspension compresses or extends (mm) over lap distance.

- Positive values = compression, negative = extension.
- A **yellow dashed line** shows the bump rubber gap value read from the car setup. If the gap is outside the visible y-axis range, the label pins to the chart edge with an arrow.

#### Velocity
Shows the rate of suspension movement (mm/s) over lap distance — the damper speed at each point on track.

**Both sub-tabs** support Front / Rear panel toggles, vertical resizing by dragging dividers, and full hover/zoom/pan sync.

---

### Ride Heights

Suspension ride heights (mm) over lap distance for three panels:

- **Splitter** — average of LF and RF (front splitter height)
- **Front** — LF and RF individually
- **Rear** — LR and RR individually

Toggle panels with the **Splitter / Front / Rear** buttons. Drag dividers to resize. Hover syncs across all charts.

---

### Tire Temps

Temperature at three positions for each of the four corners, displayed in a 2×2 grid:

- Each chart shows **Outer**, **Mid**, and **Inner** tread temperatures (°C) over lap distance.
- Use the **min/max dropdowns** to set the y-axis temperature range.
- Use **LF / RF / LR / RR** buttons to show or hide corners.

---

### Car Setup

A parameter comparison table derived from the setup YAML embedded in each IBT file.

- When a single session is loaded: shows a **Parameter | Value** table.
- When multiple sessions are loaded: adds one column per session; cells with **differing values are highlighted in yellow**.
- Parameters are grouped into collapsible sections (Aerodynamics, Brakes, Chassis, etc.).

---

## Lap Selection & Colors

Up to **4 laps** can be active at once (one per color slot). Each lap is assigned a color:

| Slot | Color |
|------|-------|
| ref | White (reference lap) |
| blue | Cyan |
| pink | Magenta |
| lime | Green |

Click a color slot in the lap list to assign or deselect that lap. The **ref** slot is used as the baseline for delta calculations.

---

## Track Map

The track map shows:

- **Track boundaries** — outer and inner limits drawn as colored lines with a filled surface between them, loaded from `Documents/TRACE.IT/boundaries/`. Boundaries are displayed even when no lap is selected.
- **Driving lines** for up to 2 selected laps, rendered in their assigned colors.
- A **moving marker** that follows the current playback/cursor position.
- A **mini-map** overview (Driving tab only) showing the full track with a position dot.

The **TelemetryBar** above the map shows live values at the current cursor position: throttle, brake, gear, speed, and steering angle.

---

## Track Boundaries

TRACE.IT can display inner and outer track limits on the map.

- Boundary files live in `Documents/TRACE.IT/boundaries/` as `{trackId}.json`.
- Bundled boundary files are automatically copied to that folder on first launch.
- Additional boundaries can be recorded with the **TRACE.IT Boundary Tool** (separate Python utility) and saved there.

---

## Mouse & Interaction Reference

| Action | How |
|--------|-----|
| Load files | "Open IBT Files" button or drag .ibt files onto the app |
| Collapse/expand sidebar | Click **‹** / **›** button in the sidebar header |
| Assign lap to comparison | Click a color slot (ref / blue / pink / lime) in the lap list |
| Show/hide a telemetry channel | Click the channel button above the Telemetry charts |
| Zoom chart | Scroll wheel (or pinch on trackpad) |
| Pan chart | Scroll horizontally |
| Lock cursor position | Click on any chart |
| Reset zoom & pan | Double-click any chart |
| Resize a chart panel | Drag the horizontal divider between panels |
| Resize track map (sidebar) | Drag the top edge of the map |
| Reset map height | Double-click the top edge of the map |
| View lap info | Hover a lap row in the sidebar |
| Remove a session | Click ✕ in the session list |
| Open changelog | Click the version badge (e.g. v0.12.0) in the title bar |
| Play/pause (Driving tab) | Click ▶ / ⏸ in the bottom bar |
| Seek playback position | Click or drag the scrubber bar |
| Zoom map follow level | Click 🔍 bottom-left of map, drag vertical slider |
| Select sector | Click a sector row in the splits panel |
| Reset to full lap | Click ⏱ total row, or double-click the traces |
| Collapse/expand traces | Click the **›/‹** tab on the right edge |

---

## Notes

- **Maximum 4 laps** can be compared at once (one per color slot: ref, blue, pink, lime).
- The **primary session** (green indicator) is used for the track map and all single-session views. Additional sessions are only used in the Car Setup comparison.
- The **Time Delta** and **Driving Line Diff** channels require a lap in the **ref** slot.
- The track map requires at least one valid full lap (laps below ~50% of the median lap time are filtered out as out-laps/cool-down laps).
- IBT files are parsed entirely in memory — no files are written to disk (except boundary seeding on first launch).
