# TRACE.IT — User Guide

TRACE.IT is a desktop telemetry analysis tool for iRacing. Load `.ibt` files from your iRacing telemetry folder and compare lap performance across multiple channels and sessions.

---

## Getting Started

### Loading Files

**Option 1 — Open button:** Click **"Open IBT Files"** in the sidebar to browse for `.ibt` files.

**Option 2 — Drag and drop:** Drag one or more `.ibt` files onto the app window.

You can load multiple files at once to compare sessions side by side.

### Sidebar

The sidebar runs down the left side and stays visible across all tabs.

- **Session list** — Each loaded session appears here. The primary session (first loaded) has a green indicator. Click **✕** to unload a session.
- **Lap list** — All laps for the selected session. Click a color slot (ref / blue / pink / lime) to assign a lap to the comparison. Hover a lap row to see a tooltip with air temp, track temp, humidity, and fuel usage. The fastest full lap is marked with **★**.
- **Track map** — A canvas map at the bottom of the sidebar showing the track outline and driver position. Drag the top edge to resize it; double-click the top edge to reset to default height.

---

## Tabs

Navigation tabs appear in the title bar after loading a file.

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

The track map in the sidebar shows:

- The track outline drawn from the loaded lap's GPS path (with a dead-reckoning fallback if GPS data is unavailable).
- **Driving lines** for up to 2 selected laps, rendered in their assigned colors.
- A **moving marker** that follows the chart cursor position — hover on any chart to see where on track that data point corresponds.

The **TelemetryBar** above the map shows live values at the current cursor position: throttle, brake, gear, speed, and steering angle.

---

## Mouse & Interaction Reference

| Action | How |
|--------|-----|
| Load files | "Open IBT Files" button or drag .ibt files onto the app |
| Assign lap to comparison | Click a color slot (ref / blue / pink / lime) in the lap list |
| Show/hide a telemetry channel | Click the channel button above the Telemetry charts |
| Zoom chart | Scroll wheel (or pinch on trackpad) |
| Pan chart | Scroll horizontally |
| Lock cursor position | Click on any chart |
| Reset zoom & pan | Double-click any chart |
| Resize a chart panel | Drag the horizontal divider between panels |
| Resize track map | Drag the top edge of the map |
| Reset map height | Double-click the top edge of the map |
| View lap info | Hover a lap row in the sidebar |
| Remove a session | Click ✕ in the session list |
| Open changelog | Click the version badge (e.g. v0.0.17) in the title bar |

---

## Notes

- **Maximum 4 laps** can be compared at once (one per color slot: ref, blue, pink, lime).
- The **primary session** (green indicator) is used for the track map and all single-session views. Additional sessions are only used in the Car Setup comparison.
- The **Time Delta** and **Driving Line Diff** channels require a lap in the **ref** slot.
- The track map requires at least one valid full lap (laps below ~50% of the median lap time are filtered out as out-laps/cool-down laps).
- IBT files are parsed entirely in memory — no files are written to disk.
