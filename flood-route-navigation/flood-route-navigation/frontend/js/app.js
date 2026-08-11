// ===== Configuration =====
const API_BASE_URL = "http://localhost:8000"; // change to your deployed backend URL

const RISK_COLORS = { 1: "#3FBF7F", 2: "#E8C547", 3: "#F0883E", 4: "#E24C4C" };

// ===== State =====
let map;
let zoneLayers = [];
let nodeMarkers = {};
let routeLine = null;
let locationsCache = [];

// ===== Init =====
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadLocations();
  await refreshFloodZones(0);

  document.getElementById("rainfallSlider").addEventListener("input", onRainfallChange);
  document.getElementById("findRouteBtn").addEventListener("click", onFindRoute);
});

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([14.705, 120.99], 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  }).addTo(map);
}

// ===== Data loading =====
async function loadLocations() {
  const res = await fetch(`${API_BASE_URL}/api/locations`);
  const data = await res.json();
  locationsCache = data.locations;

  const originSelect = document.getElementById("originSelect");
  const destSelect = document.getElementById("destinationSelect");
  originSelect.innerHTML = "";
  destSelect.innerHTML = "";

  locationsCache.forEach((loc) => {
    originSelect.appendChild(new Option(loc.name, loc.id));
    destSelect.appendChild(new Option(loc.name, loc.id));

    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 5,
      color: "#4CD8E0",
      fillColor: "#4CD8E0",
      fillOpacity: 0.85,
      weight: 1,
    }).addTo(map);
    marker.bindPopup(`<strong>${loc.name}</strong>`);
    nodeMarkers[loc.id] = marker;
  });

  // sensible defaults for the demo
  originSelect.value = "cityhall";
  destSelect.value = "tala";
}

async function refreshFloodZones(rainfallMm) {
  const res = await fetch(`${API_BASE_URL}/api/flood-zones?rainfall_mm=${rainfallMm}`);
  const data = await res.json();

  zoneLayers.forEach((l) => map.removeLayer(l));
  zoneLayers = [];

  data.zones.forEach((zone) => {
    const latlngs = zone.polygon.map(([lat, lng]) => [lat, lng]);
    const color = RISK_COLORS[zone.level] || "#888";
    const poly = L.polygon(latlngs, {
      color,
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.28,
    }).addTo(map);
    poly.bindPopup(
      `<strong>${zone.name}</strong><br>Risk: <b>${zone.label}</b><br><span style="color:#9FB0CC">${zone.description}</span>`
    );
    zoneLayers.push(poly);
  });

  return data.zones;
}

// ===== Interactions =====
async function onRainfallChange(e) {
  const mm = Number(e.target.value);
  document.getElementById("rainfallValue").textContent = mm;
  updateWarningPill(mm);
  await refreshFloodZones(mm);
}

function updateWarningPill(mm) {
  const pill = document.getElementById("rainfallWarning");
  pill.classList.remove("pill--calm", "pill--yellow", "pill--orange", "pill--red");
  if (mm >= 200) {
    pill.textContent = "Red Warning";
    pill.classList.add("pill--red");
  } else if (mm >= 100) {
    pill.textContent = "Orange Warning";
    pill.classList.add("pill--orange");
  } else if (mm >= 30) {
    pill.textContent = "Yellow Warning";
    pill.classList.add("pill--yellow");
  } else {
    pill.textContent = "No Warning";
    pill.classList.add("pill--calm");
  }
}

async function onFindRoute() {
  const origin = document.getElementById("originSelect").value;
  const destination = document.getElementById("destinationSelect").value;
  const rainfall = Number(document.getElementById("rainfallSlider").value);
  const errorEl = document.getElementById("routeError");
  const btn = document.getElementById("findRouteBtn");

  errorEl.hidden = true;

  if (origin === destination) {
    errorEl.textContent = "Please choose two different locations.";
    errorEl.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Calculating...";

  try {
    const res = await fetch(`${API_BASE_URL}/api/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin_id: origin, destination_id: destination, rainfall_mm: rainfall }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "No route found.");
    }

    const data = await res.json();
    renderRoute(data);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    document.getElementById("resultsPanel").hidden = true;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  } finally {
    btn.disabled = false;
    btn.textContent = "Find Safest Route";
  }
}

function renderRoute(data) {
  const { route, situation_summary, flood_zones_on_route } = data;

  if (routeLine) map.removeLayer(routeLine);

  const latlngs = route.coordinates.map((c) => [c.lat, c.lng]);
  routeLine = L.polyline(latlngs, {
    color: "#4CD8E0",
    weight: 5,
    opacity: 0.9,
    dashArray: flood_zones_on_route.length ? "1 8" : null,
  }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

  document.getElementById("resultsPanel").hidden = false;
  document.getElementById("statDistance").textContent = route.total_distance_km;
  document.getElementById("statTime").textContent = route.estimated_minutes;
  document.getElementById("statZones").textContent = route.flood_zones_crossed.length;
  document.getElementById("situationSummary").textContent = situation_summary;

  const list = document.getElementById("segmentList");
  list.innerHTML = "";
  route.segments.forEach((seg) => {
    const fromName = locationsCache.find((l) => l.id === seg.from)?.name || seg.from;
    const toName = locationsCache.find((l) => l.id === seg.to)?.name || seg.to;
    const li = document.createElement("li");
    const riskColor = RISK_COLORS[seg.risk_level] || "#63749A";
    li.innerHTML = `${fromName} &rarr; ${toName} <em style="color:#63749A">(${seg.road}, ${seg.distance_km}km)</em>` +
      (seg.risk_level > 0
        ? ` <span class="seg-risk" style="background:${riskColor}22;color:${riskColor}">RISK ${seg.risk_level}</span>`
        : "");
    list.appendChild(li);
  });
}
