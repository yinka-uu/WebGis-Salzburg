"""
=============================================================================
  server.py  —  Salzburg WebGIS Backend
=============================================================================
  Serves the frontend AND bridges browser ↔ GeoServer.

  HOW TO RUN:
    1. docker compose up -d
    2. python scripts/configure_geoserver.py   (first time only)
    3. python server.py
    4. Open:  http://localhost:5000

  INSTALL (one time):
    pip install flask flask-cors geopandas requests
=============================================================================
"""

import requests
from pathlib import Path
from flask import Flask, jsonify, send_from_directory, Response
from flask_cors import CORS

# ── Paths ─────────────────────────────────────────────────────────────────
# server.py lives in:  WebGis-Salzburg/Backend/server.py
# So parent = Backend/, parent.parent = WebGis-Salzburg/
BACKEND_DIR   = Path(__file__).parent                          # .../Backend/
BASE_DIR      = BACKEND_DIR.parent                             # .../WebGis-Salzburg/
FRONTEND_DIR  = BASE_DIR / "frontend"
SHAPEFILE_DIR = BACKEND_DIR / "data" / "Salzburg-shp" / "shape"

# ── GeoServer settings — must match your docker-compose.yml ──────────────
GEOSERVER_URL  = "http://localhost:8080/geoserver"
GEOSERVER_WMS  = f"{GEOSERVER_URL}/salzburg/wms"
GEOSERVER_WFS  = f"{GEOSERVER_URL}/salzburg/ows"
GEOSERVER_AUTH = ("admin", "geoserver2024")   # from docker-compose GEOSERVER_ADMIN_*

# ── Shapefile ↔ GeoServer layer mapping ──────────────────────────────────
LAYERS = {
    "buildings":     {"file": "buildings.shp",  "label": "Buildings",           "color": "#4a90d9", "limit": 3000},
    "transportation":{"file": "roads.shp",      "label": "Roads",               "color": "#f5a623", "limit": 5000},
    "green_spaces":  {"file": "natural.shp",    "label": "Green Spaces",        "color": "#2ecc71", "limit": 2000},
    "water_bodies":  {"file": "waterways.shp",  "label": "Waterways",           "color": "#3498db", "limit": 2000},
    "pois":          {"file": "points.shp",     "label": "Points of Interest",  "color": "#e74c3c", "limit": 5000},
    "landuse":       {"file": "landuse.shp",    "label": "Land Use",            "color": "#8bc34a", "limit": 2000},
    "railways":      {"file": "railways.shp",   "label": "Railways",            "color": "#95a5a6", "limit": 1000},
    "places":        {"file": "places.shp",     "label": "Places",              "color": "#9b59b6", "limit": 1000},
}

# ── Flask app ─────────────────────────────────────────────────────────────
app    = Flask(__name__, static_folder=str(FRONTEND_DIR))
CORS(app)
_cache = {}


# ─────────────────────────────────────────────────────────────────────────
# GEOSERVER CHECK
# ─────────────────────────────────────────────────────────────────────────
def geoserver_is_running():
    """
    Returns True if GeoServer is reachable.
    Tries the REST API first (most reliable), then the web UI.
    A 401 response still means the server IS running (just needs auth).
    """
    endpoints = [
        f"{GEOSERVER_URL}/rest/about/version.json",
        f"{GEOSERVER_URL}/web/",
    ]
    for url in endpoints:
        try:
            r = requests.get(url, auth=GEOSERVER_AUTH, timeout=5)
            if r.status_code in (200, 401):
                return True
        except requests.exceptions.ConnectionError:
            continue
        except Exception:
            continue
    return False


# ─────────────────────────────────────────────────────────────────────────
# SHAPEFILE LOADER  (fallback when GeoServer is offline)
# ─────────────────────────────────────────────────────────────────────────
def load_shapefile(layer_name):
    """
    Reads a shapefile and returns it as a GeoJSON string.
    Cached after first load so repeated requests are instant.
    """
    if layer_name in _cache:
        return _cache[layer_name]

    cfg = LAYERS.get(layer_name)
    if not cfg:
        return None

    shp_path = SHAPEFILE_DIR / cfg["file"]
    if not shp_path.exists():
        print(f"  ⚠️  Shapefile not found: {shp_path}")
        return None

    try:
        import geopandas as gpd
        print(f"  📂 Loading: {cfg['file']} ...")
        gdf = gpd.read_file(shp_path)

        # Limit rows to keep the browser fast
        limit = cfg.get("limit", 2000)
        if len(gdf) > limit:
            gdf = gdf.head(limit)

        # Must be WGS84 (lat/lon) for GeoJSON
        if gdf.crs and str(gdf.crs) != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        # Keep only useful attribute columns
        useful = ["geometry","name","type","osm_id","amenity",
                  "landuse","natural","highway","railway","place"]
        keep = [c for c in useful if c in gdf.columns]
        gdf  = gdf[keep].where(gdf[keep].notna(), other=None)

        result = gdf.to_json()
        _cache[layer_name] = result
        print(f"  ✅ {layer_name}: {len(gdf):,} features")
        return result

    except Exception as e:
        print(f"  ❌ Error loading {layer_name}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page"""
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    """Serve CSS, JS, and other static frontend files"""
    return send_from_directory(str(FRONTEND_DIR), filename)


@app.route("/api/status")
def api_status():
    """
    Called by the browser on startup.
    Tells the frontend whether GeoServer is available so it decides
    whether to load WMS/WFS layers or fall back to GeoJSON shapefiles.
    """
    gs_up = geoserver_is_running()
    return jsonify({
        "geoserver":     gs_up,
        "geoserver_wms": GEOSERVER_WMS,
        "geoserver_wfs": GEOSERVER_WFS,
        "message": "GeoServer connected" if gs_up else "GeoServer offline — shapefile fallback active",
    })


@app.route("/api/layers")
def api_layers():
    """Returns layer config used to build the Layer Manager panel in the UI"""
    result = {}
    for name, cfg in LAYERS.items():
        result[name] = {
            "label": cfg["label"],
            "color": cfg["color"],
            "geoserver_layer": f"salzburg:{name}",
        }
    return jsonify(result)


@app.route("/api/geojson/<layer_name>")
def api_geojson(layer_name):
    """
    Shapefile fallback — returns GeoJSON when GeoServer is offline.
    The browser calls this automatically if WMS/WFS is unavailable.
    """
    if layer_name not in LAYERS:
        return jsonify({"error": f"Unknown layer: {layer_name}"}), 404

    data = load_shapefile(layer_name)
    if data is None:
        return jsonify({"error": f"Could not load: {layer_name}"}), 500

    return Response(data, mimetype="application/json")


@app.route("/api/wfs/<layer_name>")
def api_wfs(layer_name):
    """
    Proxies WFS GetFeature requests to GeoServer.
    The browser needs real vector features (not just tiles) for analysis tools.
    Proxying here solves CORS issues that would block direct browser → GeoServer calls.
    If GeoServer WFS fails, automatically falls back to the shapefile.
    """
    if layer_name not in LAYERS:
        return jsonify({"error": f"Unknown layer: {layer_name}"}), 404

    wfs_url = (
        f"{GEOSERVER_WFS}"
        f"?service=WFS&version=2.0.0&request=GetFeature"
        f"&typeName=salzburg:{layer_name}"
        f"&outputFormat=application/json"
        f"&srsName=EPSG:4326"
        f"&count=5000"
    )
    try:
        r = requests.get(wfs_url, auth=GEOSERVER_AUTH, timeout=30)
        if r.status_code == 200:
            return Response(r.content, mimetype="application/json")
        raise Exception(f"GeoServer returned {r.status_code}")
    except Exception as e:
        print(f"  ⚠️  WFS failed for '{layer_name}', using shapefile: {e}")
        data = load_shapefile(layer_name)
        if data:
            return Response(data, mimetype="application/json")
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats")
def api_stats():
    """
    Returns feature counts shown in the About panel.
    Falls back to counting shapefile rows if GeoServer is offline.
    """
    stats = {}
    try:
        import geopandas as gpd
        for name, cfg in LAYERS.items():
            shp = SHAPEFILE_DIR / cfg["file"]
            if shp.exists():
                try:
                    stats[name] = len(gpd.read_file(shp))
                except:
                    stats[name] = 0
    except ImportError:
        pass
    return jsonify(stats)


# ─────────────────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  🗺️  Salzburg WebGIS Server")
    print("=" * 60)
    print(f"\n  Frontend:   {FRONTEND_DIR}")
    print(f"  Shapefiles: {SHAPEFILE_DIR}")
    print(f"\n  Path check:")
    print(f"    frontend/:   {'✅ Found' if FRONTEND_DIR.exists()  else '❌ NOT FOUND'}")
    print(f"    shapefiles/: {'✅ Found' if SHAPEFILE_DIR.exists() else '❌ NOT FOUND'}")

    print(f"\n  GeoServer check ({GEOSERVER_URL})...")
    gs = geoserver_is_running()
    print(f"    GeoServer: {'✅ Connected — WMS/WFS layers active' if gs else '❌ Offline — shapefile fallback active'}")

    if not gs:
        print(f"\n  To connect GeoServer:")
        print(f"    1. docker compose up -d")
        print(f"    2. python scripts/configure_geoserver.py")

    print(f"\n  🌐  Open your browser at:  http://localhost:5000")
    print("=" * 60 + "\n")

    app.run(debug=False, port=5000, host="0.0.0.0")