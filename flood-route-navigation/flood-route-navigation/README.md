# Flood Detection Route Navigation System
### A hazard-aware navigation prototype for Caloocan City, Metro Manila

College project prototype conceptually inspired by DOST's **Project NOAH**
(hazard mapping + early warning). This system combines a flood hazard map
with simulated live rainfall data to compute the **safest route** between
two points, automatically avoiding roads that become impassable during
flooding.

**Scope:** Caloocan City only, using a simplified representative road
network (13 locations, 15 road segments) and 5 illustrative flood-prone
zones.

---

## 1. How it works

1. **Static hazard layer** — `backend/data/flood_zones.json` defines
   flood-prone zones in Caloocan (modeled loosely on commonly reported
   flood hotspots such as Zabarte Road, Camarin, and Bagumbong) with a
   *base hazard level* (1–4).
2. **Live conditions layer** — the user simulates a rainfall intensity
   (mm/24h) using a slider. This mimics how a real system would ingest
   PAGASA rainfall data or river/sensor readings.
3. **Combined risk** — `flood_service.py` adds a "rainfall bump" to each
   zone's base hazard level, producing a *current* risk level (Low →
   Severe), similar in spirit to PAGASA's Yellow/Orange/Red rainfall
   warning thresholds.
4. **Routing** — `route_finder.py` builds a weighted graph of the road
   network (`road_network.json`) and runs **Dijkstra's algorithm**, where:
   - Roads through zones at **Severe** risk are treated as closed
     (excluded from the graph entirely).
   - Roads through **Moderate/High** risk zones are penalized (heavier
     weight) but still usable if there's no safer path.
5. **AI explanation (optional)** — if a `GEMINI_API_KEY` is set, Google
   Gemini turns the structured risk data into a short, readable situation
   summary. If no key is set (or the call fails), a rule-based summary is
   generated instead, so the system always works end-to-end.

> **Important for your defense/documentation:** the road network and
> flood-zone geometry in this prototype are **simplified and illustrative**,
> built from general public knowledge of flood-prone areas in Caloocan.
> They are *not* official hazard maps. For a thesis-grade or real-world
> version, replace `road_network.json` with real road data (e.g. via
> [OpenStreetMap](https://www.openstreetmap.org)/`osmnx`) and
> `flood_zones.json` with actual hazard polygons from
> [Project NOAH / GeoRiskPH](https://noah.up.edu.ph) or your LGU's
> GIS office, and connect `rainfall_mm` to real-time PAGASA data instead
> of the slider.

---

## 2. Project structure

```
flood-route-navigation/
├── backend/
│   ├── main.py                  # FastAPI app & endpoints
│   ├── start.py                 # run entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── data/
│   │   ├── flood_zones.json     # hazard zones (Caloocan)
│   │   └── road_network.json    # nodes + edges (Caloocan)
│   └── services/
│       ├── flood_service.py     # risk computation + AI summary
│       └── route_finder.py      # Dijkstra routing logic
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/app.js                # Leaflet map + API calls
```

---

## 3. Running it locally

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# (optional) put your Gemini API key in .env — get one free at
# https://aistudio.google.com/app/apikey

python3 start.py
```

The API runs at `http://localhost:8000`. Interactive docs (Swagger UI)
are auto-generated at `http://localhost:8000/docs` — useful for your
defense/demo to show the endpoints working.

### Frontend

The frontend is plain HTML/CSS/JS (no build step needed). Just open
`frontend/index.html` in a browser, or serve it locally:

```bash
cd frontend
python3 -m http.server 5500
```

Then visit `http://localhost:5500`. Make sure the backend is running
first — the frontend calls `http://localhost:8000` by default (change
`API_BASE_URL` at the top of `js/app.js` if you deploy the backend
elsewhere).

---

## 4. Using the app

1. Drag the **rainfall slider** to simulate different weather conditions
   (0mm = clear, 200mm+ = severe typhoon-level rainfall). Watch the flood
   zone colors on the map update live.
2. Pick an **origin** and **destination** from the dropdowns.
3. Click **Find Safest Route**. The system draws the route on the map and
   shows:
   - Total distance and estimated travel time
   - How many flood zones the route crosses
   - An AI-generated (or rule-based) situation summary
   - A segment-by-segment breakdown with risk levels
4. Try increasing rainfall past ~100mm and re-running the same route —
   you'll see the system automatically reroute around roads that become
   too risky, or report "no passable route" if the area is cut off
   entirely (a realistic worst-case scenario worth discussing in your
   documentation).

---

## 5. API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/api/locations` | List all navigable nodes |
| GET | `/api/flood-zones?rainfall_mm=X` | Current risk per zone at a given rainfall level |
| POST | `/api/route` | Compute safest route (`origin_id`, `destination_id`, `rainfall_mm`) |
| GET | `/api/situation-summary?rainfall_mm=X` | Standalone AI/rule-based summary |

---

## 6. Suggested extensions for a stronger thesis

- Replace the simplified graph with a real OSM-derived road network for
  all of Caloocan (or Metro Manila) using `osmnx`.
- Pull live rainfall data from PAGASA's public advisories instead of the
  slider.
- Add historical flood incident data to validate/calibrate hazard levels.
- Add user geolocation so the app can suggest the nearest safe evacuation
  center (a natural next feature given the NOAH inspiration).
- Add authentication + a barangay-level admin view for reporting real-time
  flooding on the ground (crowdsourced verification).

---

## 7. Limitations to disclose in your documentation

- Hazard zone geometry and base hazard levels are illustrative
  approximations, not sourced from official hazard maps.
- The road network is a small, simplified representative subset of
  Caloocan's actual road system, not a complete graph.
- Rainfall is simulated by the user, not pulled from a live weather feed.
- The AI-generated summary is descriptive, not authoritative — it should
  never be presented as an official flood warning.
