/**
 * ════════════════════════════════════════════════════════════════
 *  Salzburg Urban WebGIS  —  app.js
 *  Application Development (GIS) — Final Project, Z_GIS PLUS
 * ════════════════════════════════════════════════════════════════
 *
 *  HOW THIS APP WORKS:
 *  ─────────────────────────────────────────────────────────────
 *  1. On startup it checks if GeoServer is running (via /api/status)
 *
 *  2. IF GeoServer is UP:
 *     • Map layers are added as WMS tiles (fast server-side rendering)
 *     • POI data is loaded via WFS (so we can query individual features)
 *     • Clicking a feature calls GeoServer GetFeatureInfo
 *
 *  3. IF GeoServer is DOWN (fallback):
 *     • Layers are loaded as GeoJSON directly from your shapefiles
 *       via the Python Flask server (/api/geojson/<layer>)
 *     • All analysis tools still work — they use the loaded features
 *
 *  4. Analysis tools (always available):
 *     • Buffer Analysis   → Turf.js circle + OpenLayers intersection
 *     • Distance Measure  → Turf.js geodetic distance
 *     • Nearest POI       → Euclidean search through WFS features
 *     • Identify Feature  → OpenLayers forEachFeatureAtPixel
 *     • WMS GetFeatureInfo → Direct GeoServer REST query
 *     • Category Search   → Client-side filter on loaded WFS data
 * ════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION — must match your docker-compose.yml
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // GeoServer URLs (running in Docker)
  GS_WMS:  "http://localhost:8080/geoserver/salzburg/wms",
  GS_WFS:  "http://localhost:8080/geoserver/salzburg/ows",
  GS_REST: "http://localhost:8080/geoserver/rest",

  // Our Python Flask server (for GeoJSON fallback + static files)
  API: "http://localhost:5000",

  // Salzburg city centre [lon, lat]
  CENTRE: [13.055, 47.8095],
  ZOOM:   13,
};

/**
 * Layer definitions.
 * Each entry has:
 *  - geoserver:  the published layer name in GeoServer (workspace:table)
 *  - color:      fill/stroke colour used for vector fallback
 *  - visible:    whether the layer starts turned on
 *  - type:       geometry type — controls how it's styled
 */
const LAYERS = {
  buildings:      { label: "Buildings",          geoserver: "salzburg:buildings",      color: "#3b82f6", visible: true,  type: "polygon" },
  transportation: { label: "Roads",              geoserver: "salzburg:transportation",  color: "#f59e0b", visible: true,  type: "line"    },
  green_spaces:   { label: "Green Spaces",       geoserver: "salzburg:green_spaces",   color: "#22c55e", visible: true,  type: "polygon" },
  water_bodies:   { label: "Water Bodies",       geoserver: "salzburg:water_bodies",   color: "#0ea5e9", visible: true,  type: "polygon" },
  pois:           { label: "Points of Interest", geoserver: "salzburg:pois",           color: "#ef4444", visible: true,  type: "point"   },
  landuse:        { label: "Land Use",           geoserver: "salzburg:landuse",        color: "#a3e635", visible: false, type: "polygon" },
  railways:       { label: "Railways",           geoserver: "salzburg:railways",       color: "#94a3b8", visible: true,  type: "line"    },
  places:         { label: "Places",             geoserver: "salzburg:places",         color: "#c084fc", visible: false, type: "polygon" },
};


// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────

let map;               // OpenLayers Map object
let wmsLayers = {};    // Holds WMS tile layers (keyed by layer name)
let vectorLayers = {}; // Holds fallback GeoJSON vector layers
let drawSource;        // Vector source for analysis drawings
let popupOverlay;      // OpenLayers Overlay for the popup div
let mode = null;       // Current tool mode: 'measure'|'nearest'|'identify'|'wms-query'|null
let measurePts = [];   // Click coordinates during distance measurement
let poiFeatures = [];  // All POI features loaded via WFS (for nearest/search tools)
let geoserverUp = false; // Whether GeoServer is reachable


// ─────────────────────────────────────────────────────────────
// 1.  STARTUP
// ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  setLoadMsg("Initialising map…");
  initMap();

  setLoadMsg("Checking GeoServer connection…");
  await checkGeoServer();

  setLoadMsg("Loading layers…");
  if (geoserverUp) {
    addWMSLayers();       // Fast server-rendered tiles from GeoServer
    await loadWFSPOIs();  // Load POI vector data via WFS for analysis tools
  } else {
    await loadGeoJSONFallback();  // Load from shapefiles via Flask server
  }

  buildLayerPanel();
  await loadStats();

  // Hide the loading screen
  document.getElementById("loadScreen").classList.add("hidden");
  console.log("✅ App ready");
});


// ─────────────────────────────────────────────────────────────
// 2.  MAP INITIALISATION
// ─────────────────────────────────────────────────────────────

function initMap() {
  // Drawing source: used to render buffers, measure lines, nearest-lines
  drawSource = new ol.source.Vector();
  const drawLayer = new ol.layer.Vector({
    source: drawSource,
    style: new ol.style.Style({
      fill:   new ol.style.Fill({ color: "rgba(0,212,170,0.12)" }),
      stroke: new ol.style.Stroke({ color: "#00d4aa", width: 2, lineDash: [6, 4] }),
      image:  new ol.style.Circle({
        radius: 6,
        fill:   new ol.style.Fill({ color: "#00d4aa" }),
        stroke: new ol.style.Stroke({ color: "#000", width: 1.5 }),
      }),
    }),
    zIndex: 200,
  });

  // Popup overlay — positions the #popup div over clicked features
  popupOverlay = new ol.Overlay({
    element: document.getElementById("popup"),
    autoPan: { animation: { duration: 200 } },
    positioning: "bottom-center",
    offset: [0, -10],
  });

  // OpenStreetMap base layer
  const baseLayer = new ol.layer.Tile({
    source: new ol.source.OSM(),
    zIndex: 0,
  });

  map = new ol.Map({
    target: "map",
    layers: [baseLayer, drawLayer],
    overlays: [popupOverlay],
    view: new ol.View({
      center: ol.proj.fromLonLat(CONFIG.CENTRE),
      zoom:    CONFIG.ZOOM,
      maxZoom: 19,
      minZoom: 8,
    }),
    controls: [],   // We use our own controls
  });

  // Update coordinate display as mouse moves over map
  map.on("pointermove", evt => {
    if (evt.dragging) return;
    const [lon, lat] = ol.proj.toLonLat(evt.coordinate);
    document.getElementById("coordDisplay").textContent =
      `${lat.toFixed(5)}° N  ${lon.toFixed(5)}° E`;
  });

  // All map clicks go through this single handler
  map.on("singleclick", handleClick);
}


// ─────────────────────────────────────────────────────────────
// 3.  GEOSERVER CONNECTION CHECK
// ─────────────────────────────────────────────────────────────

async function checkGeoServer() {
  try {
    const res  = await fetch(`${CONFIG.API}/api/status`, { cache: "no-cache" });
    const data = await res.json();
    geoserverUp = data.geoserver === true;
  } catch {
    geoserverUp = false;
  }
  updateGSBadge();
}

/** Updates the green/orange badge in the header */
function updateGSBadge() {
  const badge = document.getElementById("gsStatus");
  const label = document.getElementById("gsLabel");
  if (geoserverUp) {
    badge.className = "gs-badge gs-connected";
    label.textContent = "GeoServer Connected";
  } else {
    badge.className = "gs-badge gs-offline";
    label.textContent = "GeoServer Offline (fallback)";
  }
}


// ─────────────────────────────────────────────────────────────
// 4.  WMS LAYERS  (from GeoServer — tile images)
// ─────────────────────────────────────────────────────────────

/**
 * Adds every layer as a WMS tile layer.
 * GeoServer renders the tiles on the server and sends PNG images.
 * This is fast and handles large datasets well.
 */
function addWMSLayers() {
  Object.entries(LAYERS).forEach(([name, cfg]) => {
    const layer = new ol.layer.Tile({
      source: new ol.source.TileWMS({
        url:        CONFIG.GS_WMS,
        params: {
          LAYERS:  cfg.geoserver,   // e.g. "salzburg:buildings"
          TILED:   true,
          FORMAT:  "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
      visible:  cfg.visible,
      opacity:  name === "buildings" ? 0.6 : 0.8,
      // Layer stacking order
      zIndex: cfg.type === "point" ? 10 : cfg.type === "line" ? 5 : 2,
    });

    map.addLayer(layer);
    wmsLayers[name] = layer;
  });

  console.log("✅ WMS layers added from GeoServer");
}


// ─────────────────────────────────────────────────────────────
// 5.  WFS POIs  (from GeoServer — actual vector features)
// ─────────────────────────────────────────────────────────────

/**
 * Loads POI features via WFS GetFeature request.
 * Unlike WMS (which gives us images), WFS gives us the actual
 * geometry + attributes, which we need for:
 *   - Nearest POI finder
 *   - Category search
 *   - Identify click (fallback)
 */
async function loadWFSPOIs() {
  const url = `${CONFIG.API}/api/wfs/pois`;  // Proxied via Flask to avoid CORS
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const fmt  = new ol.format.GeoJSON();
    poiFeatures = fmt.readFeatures(data, {
      dataProjection:    "EPSG:4326",
      featureProjection: "EPSG:3857",
    });
    console.log(`✅ Loaded ${poiFeatures.length} POIs via WFS`);
  } catch (e) {
    console.warn("⚠️ WFS POI load failed:", e);
  }
}


// ─────────────────────────────────────────────────────────────
// 6.  GEOJSON FALLBACK  (when GeoServer is offline)
// ─────────────────────────────────────────────────────────────

/**
 * If GeoServer is not running, we load shapefiles as GeoJSON
 * from the Python Flask server and add them as vector layers.
 * All analysis tools still work in this mode.
 */
async function loadGeoJSONFallback() {
  console.log("ℹ️ GeoServer offline — loading GeoJSON from shapefiles");

  const loadLayer = async (name, cfg) => {
    try {
      const res  = await fetch(`${CONFIG.API}/api/geojson/${name}`);
      const data = await res.json();
      const fmt  = new ol.format.GeoJSON();
      const features = fmt.readFeatures(data, {
        dataProjection:    "EPSG:4326",
        featureProjection: "EPSG:3857",
      });

      const source = new ol.source.Vector({ features });
      const layer  = new ol.layer.Vector({
        source,
        style:   makeVectorStyle(cfg.type, cfg.color),
        visible: cfg.visible,
        zIndex:  cfg.type === "point" ? 10 : cfg.type === "line" ? 5 : 2,
      });
      map.addLayer(layer);
      vectorLayers[name] = layer;

      // Cache POI features for analysis tools
      if (name === "pois") poiFeatures = features;

    } catch (e) {
      console.warn(`⚠️ Could not load fallback layer "${name}":`, e);
    }
  };

  // Load all layers in parallel
  await Promise.all(Object.entries(LAYERS).map(([n, c]) => loadLayer(n, c)));
  console.log("✅ Fallback GeoJSON layers loaded");
}

/**
 * Creates an OpenLayers vector style based on geometry type and colour.
 */
function makeVectorStyle(type, color) {
  if (type === "point") {
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill:   new ol.style.Fill({ color }),
        stroke: new ol.style.Stroke({ color: "#fff", width: 1.5 }),
      }),
    });
  }
  if (type === "line") {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color, width: 2 }),
    });
  }
  // Polygon — fill is colour at 25% opacity
  return new ol.style.Style({
    fill:   new ol.style.Fill({ color: color + "40" }),
    stroke: new ol.style.Stroke({ color, width: 1 }),
  });
}


// ─────────────────────────────────────────────────────────────
// 7.  LAYER PANEL UI
// ─────────────────────────────────────────────────────────────

/** Builds the toggle switch list in the Layers panel */
function buildLayerPanel() {
  const list = document.getElementById("layerList");
  list.innerHTML = "";

  Object.entries(LAYERS).forEach(([name, cfg]) => {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.innerHTML = `
      <span class="layer-swatch" style="background:${cfg.color}; opacity:0.85"></span>
      <span class="layer-name">${cfg.label}</span>
      <span class="layer-type">${geoserverUp ? "WMS" : "GeoJSON"}</span>
      <button class="toggle ${cfg.visible ? "on" : ""}"
              id="tog-${name}"
              onclick="toggleLayer('${name}', this)"
              title="Toggle ${cfg.label}">
      </button>`;
    list.appendChild(row);
  });
}

/** Toggles a layer's visibility when the user clicks its toggle switch */
function toggleLayer(name, btn) {
  const isOn = btn.classList.toggle("on");
  const layer = wmsLayers[name] || vectorLayers[name];
  if (layer) layer.setVisible(isOn);
}


// ─────────────────────────────────────────────────────────────
// 8.  BASEMAP SWITCHER
// ─────────────────────────────────────────────────────────────

function changeBasemap(type, btn) {
  document.querySelectorAll(".bm").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  let src;
  if (type === "osm") {
    src = new ol.source.OSM();
  } else if (type === "sat") {
    // ESRI World Imagery (free, no API key needed)
    src = new ol.source.XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attributions: "© Esri",
    });
  } else if (type === "topo") {
    src = new ol.source.XYZ({
      url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: "© OpenTopoMap",
    });
  }

  // Replace the source on the first (base) layer
  if (src) map.getLayers().item(0).setSource(src);
}


// ─────────────────────────────────────────────────────────────
// 9.  MAP CLICK ROUTER
// ─────────────────────────────────────────────────────────────

/**
 * All map clicks come here first.
 * The current mode determines what happens next.
 */
function handleClick(evt) {
  switch (mode) {
    case "measure":    handleMeasureClick(evt.coordinate); break;
    case "nearest":    handleNearestClick(evt.coordinate); mode = null; break;
    case "identify":   handleIdentifyClick(evt); break;
    case "wms-query":  handleWMSQuery(evt); break;
    default:           handleDefaultClick(evt); break;
  }
}

/** Default: show popup if user clicks a feature (vector layers only) */
function handleDefaultClick(evt) {
  let hit = false;
  map.forEachFeatureAtPixel(evt.pixel, (feat, lyr) => {
    if (hit || !lyr || lyr.getSource() === drawSource) return;
    hit = true;
    renderPopup(feat, evt.coordinate);
  }, { hitTolerance: 8 });
  if (!hit) closePopup();
}


// ─────────────────────────────────────────────────────────────
// 10. FEATURE POPUP
// ─────────────────────────────────────────────────────────────

/**
 * Renders a popup at the given coordinate showing the feature's attributes.
 *
 * @param {ol.Feature} feat       - The clicked feature
 * @param {Array}      coordinate - Map coordinate [x, y] in EPSG:3857
 */
function renderPopup(feat, coordinate) {
  const props  = feat.getProperties();
  const fields = ["name", "type", "amenity", "highway", "landuse",
                  "natural", "railway", "place", "osm_id"];

  const name = props.name || props.amenity || props.type || "Feature";

  let rows = "";
  fields.forEach(k => {
    const v = props[k];
    if (v && v !== "null" && v !== null) {
      rows += `<div class="attr-row">
                 <span class="attr-key">${k}</span>
                 <span class="attr-val">${v}</span>
               </div>`;
    }
  });
  if (!rows) rows = `<div class="attr-row"><span class="attr-val" style="color:var(--text-dim)">No attributes</span></div>`;

  document.getElementById("popupInner").innerHTML = `<h4>${name}</h4>${rows}`;
  document.getElementById("popup").classList.remove("hidden");
  popupOverlay.setPosition(coordinate);
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
  popupOverlay.setPosition(undefined);
}


// ─────────────────────────────────────────────────────────────
// 11. BUFFER ANALYSIS  (Turf.js)
// ─────────────────────────────────────────────────────────────

/**
 * Creates a geodetically accurate circle (buffer) around the map centre.
 * Uses Turf.js for the circle geometry, adds it to the map as a vector.
 * Then counts how many POI features fall inside it.
 */
function runBuffer() {
  const dist = parseInt(document.getElementById("bufferDist").value);
  drawSource.clear();

  // Get map centre in WGS84 (lon/lat)
  const [lon, lat] = ol.proj.toLonLat(map.getView().getCenter());

  // Turf.js: create accurate geodetic circle
  const circle = turf.circle([lon, lat], dist, { units: "meters", steps: 64 });

  // Convert GeoJSON circle to OpenLayers feature and add to map
  const fmt  = new ol.format.GeoJSON();
  const feat = fmt.readFeature(circle, {
    dataProjection:    "EPSG:4326",
    featureProjection: "EPSG:3857",
  });
  drawSource.addFeature(feat);

  // Count POIs inside the buffer using OL geometry intersection
  const bufGeom  = feat.getGeometry();
  let   insideCt = 0;
  poiFeatures.forEach(f => {
    if (bufGeom.intersectsCoordinate(f.getGeometry().getCoordinates())) {
      insideCt++;
    }
  });

  const areaKm2 = ((Math.PI * dist * dist) / 1_000_000).toFixed(3);

  showResult("analysisResult", `
    <h4>Buffer Analysis Complete</h4>
    <p><strong>Centre:</strong> ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</p>
    <p><strong>Radius:</strong> ${dist} m</p>
    <p><strong>Area:</strong> ${areaKm2} km²</p>
    <p><strong>POIs inside buffer:</strong> ${insideCt}</p>
    <p><strong>Data source:</strong> ${geoserverUp ? "GeoServer WFS" : "Shapefile (fallback)"}</p>
  `);
}


// ─────────────────────────────────────────────────────────────
// 12. DISTANCE MEASUREMENT  (Turf.js)
// ─────────────────────────────────────────────────────────────

/** Activates 2-click distance measurement mode */
function startMeasure() {
  mode = "measure";
  measurePts = [];
  drawSource.clear();
  closePopup();

  const btn = document.getElementById("measureBtn");
  btn.classList.add("active");
  btn.textContent = "Click point A on map…";
  showResult("analysisResult", "<p>🖱 Click the <strong>first point</strong> on the map.</p>");
}

/** Called on each click while in measure mode */
function handleMeasureClick(coord) {
  measurePts.push(coord);
  drawSource.addFeature(new ol.Feature(new ol.geom.Point(coord)));

  if (measurePts.length === 1) {
    document.getElementById("measureBtn").textContent = "Now click point B…";
    showResult("analysisResult", "<p>🖱 Click the <strong>second point</strong> on the map.</p>");
    return;
  }

  if (measurePts.length === 2) {
    // Draw line between the two points
    drawSource.addFeature(new ol.Feature(new ol.geom.LineString(measurePts)));

    // Use Turf.js for accurate geodetic distance (great-circle, not pixels)
    const ptA  = turf.point(ol.proj.toLonLat(measurePts[0]));
    const ptB  = turf.point(ol.proj.toLonLat(measurePts[1]));
    const km   = turf.distance(ptA, ptB, { units: "kilometers" });
    const m    = Math.round(km * 1000);

    showResult("analysisResult", `
      <h4>Distance Measurement</h4>
      <p><strong>Distance:</strong> ${m} metres</p>
      <p><strong>Distance:</strong> ${km.toFixed(3)} km</p>
      <p><em>Geodetic calculation via Turf.js</em></p>
    `);

    mode = null;
    measurePts = [];
    const btn = document.getElementById("measureBtn");
    btn.classList.remove("active");
    btn.textContent = "▶ Start Measuring";
  }
}


// ─────────────────────────────────────────────────────────────
// 13. NEAREST POI FINDER
// ─────────────────────────────────────────────────────────────

/** Activates nearest-POI mode — next click triggers the search */
function startNearest() {
  mode = "nearest";
  drawSource.clear();
  closePopup();
  showResult("analysisResult", "<p>🖱 Click anywhere on the map to find the nearest POI.</p>");
}

/** Called when map is clicked in nearest mode */
function handleNearestClick(clickCoord) {
  if (!poiFeatures.length) {
    showResult("analysisResult", "<p>⚠️ No POI features loaded yet.</p>");
    return;
  }

  // Find the closest POI by Euclidean distance in EPSG:3857 metres
  let nearest = null, minDist = Infinity;
  poiFeatures.forEach(f => {
    const [fx, fy] = f.getGeometry().getCoordinates();
    const [cx, cy] = clickCoord;
    const d = Math.hypot(fx - cx, fy - cy);
    if (d < minDist) { minDist = d; nearest = f; }
  });

  if (!nearest) return;

  const nearCoord = nearest.getGeometry().getCoordinates();
  const name = nearest.get("name") || nearest.get("amenity") || "Unknown POI";
  const type = nearest.get("type") || nearest.get("amenity") || "—";

  // Draw: click point + line to nearest + nearest point
  drawSource.addFeature(new ol.Feature(new ol.geom.Point(clickCoord)));
  drawSource.addFeature(new ol.Feature(new ol.geom.LineString([clickCoord, nearCoord])));
  drawSource.addFeature(new ol.Feature(new ol.geom.Point(nearCoord)));

  // Convert EPSG:3857 Euclidean distance to approximate metres
  // (accurate enough for city-scale distances)
  const approxM = Math.round(minDist * Math.cos(47.8 * Math.PI / 180) / 1.0);

  showResult("analysisResult", `
    <h4>Nearest POI Found</h4>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Type:</strong> ${type}</p>
    <p><strong>Distance:</strong> ~${Math.round(minDist)} m (map units)</p>
  `);
}


// ─────────────────────────────────────────────────────────────
// 14. IDENTIFY FEATURE  (vector click)
// ─────────────────────────────────────────────────────────────

/** Activates identify mode */
function startIdentify() {
  mode = "identify";
  closePopup();
  const btn = document.getElementById("identifyBtn");
  btn.classList.add("active");
  btn.textContent = "Click a feature on the map…";
  showResult("queryResult", "<p>🖱 Click any feature on the map to see its attributes.</p>");
}

/** Called when the map is clicked in identify mode */
function handleIdentifyClick(evt) {
  let hit = false;
  map.forEachFeatureAtPixel(evt.pixel, (feat, lyr) => {
    if (hit || !lyr || lyr.getSource() === drawSource) return;
    hit = true;

    const props  = feat.getProperties();
    const fields = ["name","type","amenity","highway","landuse",
                    "natural","railway","place","osm_id"];
    let rows = "";
    fields.forEach(k => {
      const v = props[k];
      if (v && v !== "null") rows += `<p><strong>${k}:</strong> ${v}</p>`;
    });

    showResult("queryResult", `
      <h4>Feature Attributes</h4>
      ${rows || "<p>No readable attributes found.</p>"}
    `);
  }, { hitTolerance: 8 });

  if (!hit) showResult("queryResult", "<p>No feature at that location. Try clicking directly on a shape or point.</p>");

  // Reset identify mode
  mode = null;
  const btn = document.getElementById("identifyBtn");
  btn.classList.remove("active");
  btn.textContent = "▶ Activate Identify Mode";
}


// ─────────────────────────────────────────────────────────────
// 15. WMS GETFEATUREINFO  (GeoServer query)
// ─────────────────────────────────────────────────────────────

/**
 * Activates WMS query mode.
 * When the user clicks, we call GeoServer's GetFeatureInfo
 * to get attributes directly from the published WMS layer.
 * This is how professional WebGIS apps query data from a map server.
 */
function startWMSQuery() {
  if (!geoserverUp) {
    showResult("queryResult", "<p>⚠️ GeoServer is offline. WMS queries require GeoServer to be running.</p>");
    return;
  }
  mode = "wms-query";
  const btn = document.getElementById("wmsBtn");
  btn.classList.add("active");
  btn.textContent = "Click on the map…";
  showResult("queryResult", "<p>🖱 Click anywhere on the map to query the WMS layer.</p>");
}

/** Calls GeoServer GetFeatureInfo for the clicked map position */
async function handleWMSQuery(evt) {
  const layerName = document.getElementById("wmsQueryLayer").value;
  const wmsLayer  = wmsLayers[layerName];

  mode = null;
  const btn = document.getElementById("wmsBtn");
  btn.classList.remove("active");
  btn.textContent = "▶ Query WMS Layer";

  if (!wmsLayer) {
    showResult("queryResult", "<p>⚠️ WMS layer not found.</p>");
    return;
  }

  showResult("queryResult", "<p>⏳ Querying GeoServer…</p>");

  // Build GetFeatureInfo URL from the WMS layer source
  const view       = map.getView();
  const resolution = view.getResolution();
  const projection = view.getProjection();

  const url = wmsLayer.getSource().getFeatureInfoUrl(
    evt.coordinate,
    resolution,
    projection,
    {
      INFO_FORMAT:   "application/json",
      FEATURE_COUNT: 5,
      QUERY_LAYERS:  LAYERS[layerName].geoserver,
    }
  );

  if (!url) {
    showResult("queryResult", "<p>Could not generate GetFeatureInfo URL.</p>");
    return;
  }

  try {
    const res  = await fetch(url);
    const data = await res.json();
    const feats = data.features || [];

    if (!feats.length) {
      showResult("queryResult", "<p>No features found at that location on the selected layer.</p>");
      return;
    }

    const props  = feats[0].properties || {};
    const fields = ["name","type","amenity","highway","landuse","natural","railway","place"];
    let   rows   = "";
    Object.entries(props).slice(0, 12).forEach(([k, v]) => {
      if (v !== null && v !== "" && !fields.length || fields.includes(k)) {
        rows += `<p><strong>${k}:</strong> ${v}</p>`;
      }
    });

    showResult("queryResult", `
      <h4>GeoServer WMS Result</h4>
      <p><em>Layer: ${LAYERS[layerName].label}</em></p>
      ${rows || "<p>Feature found but no readable attributes.</p>"}
    `);

  } catch (e) {
    showResult("queryResult", `<p>⚠️ GeoServer query failed: ${e.message}</p>`);
  }
}


// ─────────────────────────────────────────────────────────────
// 16. CATEGORY SEARCH
// ─────────────────────────────────────────────────────────────

/**
 * Filters the loaded POI features by the selected category.
 * Searches the 'name', 'type', and 'amenity' fields.
 */
function runSearch() {
  const term = document.getElementById("queryType").value.toLowerCase();

  const matches = poiFeatures.filter(f => {
    const a = (f.get("amenity") || "").toLowerCase();
    const t = (f.get("type")    || "").toLowerCase();
    const n = (f.get("name")    || "").toLowerCase();
    return a.includes(term) || t.includes(term) || n.includes(term);
  });

  if (!matches.length) {
    showResult("queryResult", `<h4>Search Results</h4><p>No features found for "<strong>${term}</strong>".</p>`);
    return;
  }

  const rows = matches.slice(0, 15).map(f => {
    const n = f.get("name") || f.get("amenity") || "Unnamed";
    return `<p>📍 ${n}</p>`;
  }).join("");

  const extra = matches.length > 15
    ? `<p style="color:var(--text-dim)">…and ${matches.length - 15} more</p>`
    : "";

  showResult("queryResult", `
    <h4>Found ${matches.length} result(s) for "${term}"</h4>
    ${rows}${extra}
  `);
}


// ─────────────────────────────────────────────────────────────
// 17. STATISTICS (About panel)
// ─────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res   = await fetch(`${CONFIG.API}/api/stats`);
    const stats = await res.json();

    const labels = {
      buildings: "Buildings", transportation: "Roads",
      green_spaces: "Green Areas", pois: "POIs",
      water_bodies: "Waterways", railways: "Railways",
    };
    let html = "";
    Object.entries(labels).forEach(([k, lbl]) => {
      const n = stats[k] || 0;
      if (n > 0) {
        html += `<div class="stat-card">
                   <div class="stat-num">${n >= 1000 ? (n/1000).toFixed(1)+"k" : n}</div>
                   <div class="stat-label">${lbl}</div>
                 </div>`;
      }
    });
    if (html) document.getElementById("statsPanel").innerHTML = html;
  } catch { /* stats are optional */ }
}


// ─────────────────────────────────────────────────────────────
// 18. UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

/** Show/hide a result panel and fill it with HTML */
function showResult(id, html) {
  const el = document.getElementById(id);
  el.innerHTML  = html;
  el.classList.remove("hidden");
}

/** Clears all drawings, closes popup, resets tool buttons */
function clearAll() {
  drawSource.clear();
  closePopup();
  mode       = null;
  measurePts = [];

  ["analysisResult", "queryResult"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  ["measureBtn", "identifyBtn", "wmsBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove("active");
      btn.textContent = btn.textContent.replace(/click.*/i, "").trim() ||
        btn.getAttribute("data-original") || "▶ " + btn.textContent;
    }
  });
  // Restore button labels
  const mb = document.getElementById("measureBtn");
  if (mb) mb.textContent = "▶ Start Measuring";
  const ib = document.getElementById("identifyBtn");
  if (ib) ib.textContent = "▶ Activate Identify Mode";
  const wb = document.getElementById("wmsBtn");
  if (wb) wb.textContent = "▶ Query WMS Layer";
}

/** Resets the map view to Salzburg city centre */
function resetView() {
  map.getView().animate({
    center:   ol.proj.fromLonLat(CONFIG.CENTRE),
    zoom:     CONFIG.ZOOM,
    duration: 600,
  });
}

/** Pans map to the user's GPS location */
function locateMe() {
  if (!navigator.geolocation) { alert("Geolocation not supported."); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const coord = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]);
    map.getView().animate({ center: coord, zoom: 16, duration: 800 });
    drawSource.clear();
    drawSource.addFeature(new ol.Feature(new ol.geom.Point(coord)));
  }, () => alert("Could not get your location."));
}

/** Switch between sidebar panels */
function switchPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${name}`).classList.add("active");
  document.querySelectorAll(".nb").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-panel="${name}"]`).classList.add("active");
}

/** Updates the loading screen message */
function setLoadMsg(msg) {
  const el = document.getElementById("loadMsg");
  if (el) el.textContent = msg;
}
