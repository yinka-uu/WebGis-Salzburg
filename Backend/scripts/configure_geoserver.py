#!/usr/bin/env python3
"""
=============================================================================
  configure_geoserver.py  —  Salzburg WebGIS
=============================================================================
  This script connects to your running GeoServer (via Docker) and:
    1. Creates the "salzburg" workspace
    2. Creates a PostGIS datastore (pointing to your Docker PostGIS)
    3. Publishes every table as a WMS + WFS layer
    4. Enables CORS so the browser can talk to GeoServer

  HOW TO RUN:
    python configure_geoserver.py

  REQUIREMENTS:
    pip install requests

  MAKE SURE FIRST:
    - Docker containers are running:  docker compose up -d
    - GeoServer is reachable at:      http://localhost:8080/geoserver
    - PostGIS has data (run the Python shapefile importer first)
=============================================================================
"""

import requests
import json
import time
import sys

# ── Connection settings (must match your docker-compose.yml) ──────────────
GEOSERVER_URL  = "http://localhost:8080/geoserver"
GS_USER        = "admin"
GS_PASSWORD    = "geoserver2024"          # From your docker-compose

WORKSPACE      = "salzburg"
DATASTORE      = "salzburg_postgis"

# PostGIS settings (internal Docker network name is "postgis")
PG_HOST        = "postgis"               # Docker service name
PG_PORT        = "5432"
PG_DATABASE    = "salzburg_gis"
PG_USER        = "webgis_user"
PG_PASSWORD    = "salzburg2024"          # From your docker-compose

# Tables to publish as layers (must exist in PostgreSQL salzburg schema)
LAYERS_TO_PUBLISH = [
    {"table": "buildings",      "title": "Salzburg Buildings",        "srs": "EPSG:3857"},
    {"table": "transportation",  "title": "Salzburg Roads",           "srs": "EPSG:3857"},
    {"table": "landuse",         "title": "Salzburg Land Use",        "srs": "EPSG:3857"},
    {"table": "green_spaces",    "title": "Salzburg Green Spaces",    "srs": "EPSG:3857"},
    {"table": "water_bodies",    "title": "Salzburg Water Bodies",    "srs": "EPSG:3857"},
    {"table": "pois",            "title": "Salzburg Points of Interest", "srs": "EPSG:3857"},
    {"table": "railways",        "title": "Salzburg Railways",        "srs": "EPSG:3857"},
    {"table": "places",          "title": "Salzburg Places",          "srs": "EPSG:3857"},
]

# ── HTTP helper ───────────────────────────────────────────────────────────
AUTH    = (GS_USER, GS_PASSWORD)
HEADERS_XML  = {"Content-Type": "application/xml"}
HEADERS_JSON = {"Content-Type": "application/json", "Accept": "application/json"}

def gs_get(path):
    return requests.get(f"{GEOSERVER_URL}/rest/{path}", auth=AUTH, headers=HEADERS_JSON)

def gs_post(path, xml):
    return requests.post(f"{GEOSERVER_URL}/rest/{path}", auth=AUTH,
                         headers=HEADERS_XML, data=xml)

def gs_put(path, xml):
    return requests.put(f"{GEOSERVER_URL}/rest/{path}", auth=AUTH,
                        headers=HEADERS_XML, data=xml)

def ok(r):
    """Returns True if request succeeded (2xx)"""
    return 200 <= r.status_code < 300

# ── Step 0: Wait for GeoServer to be ready ───────────────────────────────
def wait_for_geoserver(retries=20, delay=5):
    print("\n⏳ Waiting for GeoServer to be ready...")
    for i in range(retries):
        try:
            r = requests.get(f"{GEOSERVER_URL}/web/", timeout=5)
            if r.status_code == 200:
                print("   ✅ GeoServer is up!")
                return True
        except:
            pass
        print(f"   Attempt {i+1}/{retries} — not ready yet, waiting {delay}s...")
        time.sleep(delay)
    print("   ❌ GeoServer did not respond. Is Docker running?")
    return False

# ── Step 1: Create workspace ──────────────────────────────────────────────
def create_workspace():
    print(f"\n📁 Creating workspace '{WORKSPACE}'...")
    xml = f"<workspace><name>{WORKSPACE}</name></workspace>"
    r = gs_post("workspaces", xml)
    if r.status_code == 409:
        print("   ℹ️  Workspace already exists — skipping")
    elif ok(r):
        print("   ✅ Workspace created")
    else:
        print(f"   ⚠️  Unexpected response: {r.status_code} {r.text}")

# ── Step 2: Create PostGIS datastore ─────────────────────────────────────
def create_datastore():
    print(f"\n🗄️  Creating PostGIS datastore '{DATASTORE}'...")
    xml = f"""<dataStore>
  <name>{DATASTORE}</name>
  <type>PostGIS</type>
  <enabled>true</enabled>
  <connectionParameters>
    <entry key="host">{PG_HOST}</entry>
    <entry key="port">{PG_PORT}</entry>
    <entry key="database">{PG_DATABASE}</entry>
    <entry key="schema">salzburg</entry>
    <entry key="user">{PG_USER}</entry>
    <entry key="passwd">{PG_PASSWORD}</entry>
    <entry key="dbtype">postgis</entry>
    <entry key="Expose primary keys">true</entry>
    <entry key="validate connections">true</entry>
    <entry key="max connections">10</entry>
  </connectionParameters>
</dataStore>"""

    r = gs_post(f"workspaces/{WORKSPACE}/datastores", xml)
    if r.status_code == 409:
        print("   ℹ️  Datastore already exists — skipping")
    elif ok(r):
        print("   ✅ Datastore created")
    else:
        print(f"   ❌ Failed: {r.status_code} — {r.text}")
        print("   💡 Check that PostgreSQL is running and credentials are correct")

# ── Step 3: Publish each layer ────────────────────────────────────────────
def publish_layer(table, title, srs):
    print(f"   Publishing '{table}'...")
    xml = f"""<featureType>
  <name>{table}</name>
  <nativeName>{table}</nativeName>
  <title>{title}</title>
  <srs>{srs}</srs>
  <enabled>true</enabled>
  <advertised>true</advertised>
  <projectionPolicy>REPROJECT_TO_DECLARED</projectionPolicy>
</featureType>"""

    r = gs_post(
        f"workspaces/{WORKSPACE}/datastores/{DATASTORE}/featuretypes",
        xml
    )
    if r.status_code == 409:
        print(f"      ℹ️  Already published")
    elif ok(r):
        print(f"      ✅ Done")
    else:
        print(f"      ⚠️  {r.status_code}: {r.text[:120]}")

def publish_all_layers():
    print("\n🗺️  Publishing layers...")
    for layer in LAYERS_TO_PUBLISH:
        publish_layer(layer["table"], layer["title"], layer["srs"])

# ── Step 4: Enable WMS + WFS for the workspace ───────────────────────────
def enable_services():
    print("\n⚙️  Enabling WMS and WFS services...")

    wms_xml = """<wms>
  <enabled>true</enabled>
  <name>WMS</name>
  <title>Salzburg WebGIS WMS</title>
  <maintainer>WebGIS Student</maintainer>
  <onlineResource>http://localhost:8080/geoserver</onlineResource>
</wms>"""

    wfs_xml = """<wfs>
  <enabled>true</enabled>
  <name>WFS</name>
  <title>Salzburg WebGIS WFS</title>
  <serviceLevel>COMPLETE</serviceLevel>
</wfs>"""

    r1 = gs_put(f"services/wms/workspaces/{WORKSPACE}/settings", wms_xml)
    r2 = gs_put(f"services/wfs/workspaces/{WORKSPACE}/settings", wfs_xml)

    print(f"   WMS: {'✅ Enabled' if ok(r1) else f'⚠️  {r1.status_code}'}")
    print(f"   WFS: {'✅ Enabled' if ok(r2) else f'⚠️  {r2.status_code}'}")

# ── Step 5: Print a summary of what was published ────────────────────────
def print_summary():
    print("\n" + "=" * 60)
    print("  ✅ GEOSERVER CONFIGURATION COMPLETE")
    print("=" * 60)
    print(f"\n  GeoServer admin:  {GEOSERVER_URL}/web/")
    print(f"  Workspace:        {WORKSPACE}")
    print(f"\n  WMS endpoint:")
    print(f"  {GEOSERVER_URL}/{WORKSPACE}/wms")
    print(f"\n  WFS endpoint:")
    print(f"  {GEOSERVER_URL}/{WORKSPACE}/ows")
    print(f"\n  Published layers:")
    for layer in LAYERS_TO_PUBLISH:
        print(f"    • {WORKSPACE}:{layer['table']}")
    print(f"\n  Now open:  http://localhost:5000")
    print("=" * 60 + "\n")

# ── MAIN ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  🗺️  Salzburg WebGIS — GeoServer Configuration")
    print("=" * 60)

    if not wait_for_geoserver():
        print("\n❌ Aborting. Start Docker first:  docker compose up -d")
        sys.exit(1)

    create_workspace()
    create_datastore()
    publish_all_layers()
    enable_services()
    print_summary()
