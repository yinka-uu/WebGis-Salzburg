# Salzburg Urban WebGIS

### Application Development (GIS) — Final Project

**Paris Lodron University of Salzburg · Z_GIS Department**

|                |                               |
| -------------- | ----------------------------- |
| **Student**    | Olusanya Olayinka Michael     |
| **Student ID** | s1105954                      |
| **Course**     | Application Development (GIS) |
| **Submission** | 28 February 2026              |

---

## Project Overview

This project develops an interactive WebGIS interface for urban management decision-making in Salzburg, Austria. The system integrates real OpenStreetMap geospatial data served through a GeoServer map server connected to a PostGIS spatial database, and provides an interactive browser-based interface built with OpenLayers.

The platform supports urban planners and decision-makers by enabling spatial data visualisation, accessibility analysis, buffer-based service coverage assessment, and attribute querying — all within a single web interface.

---

## System Architecture

```
Browser (http://localhost:5000)
        │
        ├── OpenLayers 7     Maps, layer rendering, user interaction
        ├── Turf.js          Client-side geoprocessing
        │
        ↕ HTTP
        │
Flask Server (port 5000)
        ├── Serves frontend HTML/CSS/JS
        ├── /api/status      GeoServer health check
        ├── /api/wfs/<name>  Proxies WFS to GeoServer (solves CORS)
        └── /api/geojson/<n> Shapefile fallback if GeoServer offline
        │
        ↕ WMS / WFS (OGC Standards)
        │
GeoServer (port 8080) ──────── PostGIS Database (port 5432)
        │                              │
   WMS tile rendering            Spatial tables:
   WFS feature queries             salzburg.buildings
   GetFeatureInfo                  salzburg.transportation
                                   salzburg.green_spaces
                                   salzburg.water_bodies
                                   salzburg.pois
                                   salzburg.railways
                                   salzburg.places
                                   salzburg.landuse
```

All services run in Docker containers via docker-compose.

---

## Technology Stack

| Component       | Technology       | Version | Purpose                       |
| --------------- | ---------------- | ------- | ----------------------------- |
| Mapping library | OpenLayers       | 7.3.0   | Interactive map rendering     |
| Geoprocessing   | Turf.js          | 6.x     | Buffer, distance, spatial ops |
| Map server      | GeoServer        | 2.24.x  | WMS/WFS layer publishing      |
| Database        | PostGIS          | 15-3.4  | Spatial data storage          |
| Backend         | Python Flask     | Latest  | API server, CORS proxy        |
| Data tools      | GeoPandas        | Latest  | Shapefile → PostGIS import    |
| Infrastructure  | Docker + Compose | Latest  | Container orchestration       |
| Data source     | OpenStreetMap    | 2024    | Salzburg city extract         |
| Frontend        | HTML5/CSS3/JS    | —       | User interface                |

---

## Data Layers

| Layer              | Source File   | Features | Description                      |
| ------------------ | ------------- | -------- | -------------------------------- |
| Buildings          | buildings.shp | ~344,000 | All mapped buildings             |
| Roads              | roads.shp     | ~201,000 | Street and road network          |
| Land Use           | landuse.shp   | ~15,000  | Land use classifications         |
| Green Spaces       | natural.shp   | ~15,000  | Parks, forests, natural areas    |
| Waterways          | waterways.shp | ~17,000  | Rivers, streams, canals          |
| Points of Interest | points.shp    | ~63,000  | Amenities, services, attractions |
| Places             | places.shp    | ~1,000   | Named districts and localities   |
| Railways           | railways.shp  | ~4,000   | Rail lines and stations          |

All data served via GeoServer as both **WMS** (rendered tile images) and **WFS** (raw vector features for analysis).

---

## Spatial Analysis Features

### 1. Buffer Analysis

Creates a geodetically accurate circular buffer around the current map centre using Turf.js `turf.circle()`. Counts how many Points of Interest fall within the zone using OpenLayers geometry intersection. Simulates urban service coverage analysis — e.g. how many amenities are within 500m of a facility.

### 2. Distance Measurement

Two-click geodetic distance measurement tool. Uses Turf.js `turf.distance()` with great-circle calculation for accuracy. Results shown in both metres and kilometres.

### 3. Nearest POI Finder

On click, searches all loaded WFS POI features to find the geographically closest point of interest. Draws a connecting line and reports name, type and approximate distance.

### 4. Feature Identify

Uses OpenLayers `forEachFeatureAtPixel()` with a 6px hit tolerance to identify any clicked feature across all loaded vector layers. Returns all available attribute fields from the PostGIS database.

### 5. GeoServer WMS GetFeatureInfo

Queries GeoServer directly using the OGC WMS `GetFeatureInfo` standard request. Returns feature attributes at the clicked map coordinate from the published WMS layer — demonstrating direct server-side spatial querying.

### 6. Category Search

Client-side attribute filter across all loaded WFS POI features. Searches `name`, `type`, and `amenity` fields for a selected category (churches, museums, parks, hospitals, etc.).

---

## Project File Structure

```
WebGis-Salzburg/
├── docker-compose.yml              Docker services (GeoServer, PostGIS, pgAdmin)
├── README.md                       This documentation
│
├── Backend/
│   ├── server.py                   Flask API server (CORS proxy + shapefile fallback)
│   ├── data/
│   │   └── Salzburg-shp/shape/     Source shapefiles (OSM Salzburg extract)
│   │       ├── buildings.shp
│   │       ├── roads.shp
│   │       ├── natural.shp
│   │       ├── waterways.shp
│   │       ├── points.shp
│   │       ├── landuse.shp
│   │       ├── places.shp
│   │       └── railways.shp
│   ├── database/
│   │   └── init.sql                PostGIS schema, tables, spatial indexes, functions
│   └── scripts/
│       └── configure_geoserver.py  GeoServer REST API setup script
│
└── frontend/
    ├── index.html                  Main HTML page
    ├── css/
    │   └── style.css               Full UI stylesheet
    └── js/
        └── app.js                  Complete application logic (heavily commented)
```

---

## How to Run

### Prerequisites

- Docker Desktop installed and running
- Python 3.x with pip
- Internet connection (for OpenLayers/Turf CDN)

### Step 1 — Start Docker services

```bash
docker compose up -d
```

### Step 2 — Import shapefiles into PostGIS (first time only)

```bash
cd Backend
pip install geopandas sqlalchemy psycopg2-binary flask flask-cors requests
python import_data.py
```

### Step 3 — Configure GeoServer (first time only)

```bash
python scripts/configure_geoserver.py
```

### Step 4 — Enable CORS in GeoServer (first time only)

```powershell
docker exec salzburg_geoserver bash -c "sed -i 's|</web-app>|<filter><filter-name>CorsFilter</filter-name><filter-class>org.apache.catalina.filters.CorsFilter</filter-class><init-param><param-name>cors.allowed.origins</param-name><param-value>*</param-value></init-param></filter><filter-mapping><filter-name>CorsFilter</filter-name><url-pattern>/*</url-pattern></filter-mapping></web-app>|' /usr/local/tomcat/webapps/geoserver/WEB-INF/web.xml"
docker restart salzburg_geoserver
```

### Step 5 — Start the web server

```bash
python Backend/server.py
```

### Step 6 — Open the application

Navigate to: **http://localhost:5000**

---

## Individual Contribution

| Student                   | ID       | Contribution                                                                                                                                                                                                                                                                                                                                              | Percentage |
| ------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Olusanya Olayinka Michael | s1105954 | Full project — system architecture, Docker infrastructure setup, PostGIS database design and import, GeoServer configuration and CORS setup, frontend development (HTML/CSS/JS), OpenLayers map integration, spatial analysis tools (buffer, distance, nearest POI, identify, WMS query, category search), Python Flask backend, debugging and deployment | 100%       |

---

## AI Use Disclaimer

AI tools (Claude by Anthropic) were used during this project in the following ways:

- **Code assistance and debugging**: AI was used to help to debug JavaScript (OpenLayers integration, Turf.js spatial analysis functions), Python (Flask server, GeoPandas shapefile import), and CSS. The generated code was reviewed, understood, tested, and modified by the student.
- **Concept understanding**: AI was used to explain GeoServer WMS/WFS standards, CORS policy, PostGIS spatial functions, and OpenLayers API patterns.
- **Problem solving**: Specific errors (CORS blocking, GeoServer configuration, Docker networking) were diagnosed with AI assistance.

**What was done independently by the student:**

- Setting up the Docker environment and getting all three containers running
- Running the shapefile import into PostGIS and verifying data loaded correctly
- Configuring GeoServer workspace, datastore, and layer publishing
- Testing and validating all application features work with real Salzburg data
- Understanding the full system architecture end-to-end

All code was read, understood and verified by the student before submission. AI-generated suggestions were not accepted blindly — they were tested against the actual running system.

---

## References

- OpenStreetMap contributors — Salzburg city shapefile extract
- OpenLayers 7 Documentation: https://openlayers.org/doc/
- Turf.js Documentation: https://turfjs.org/docs/
- GeoServer User Manual: https://docs.geoserver.org/
- PostGIS Documentation: https://postgis.net/documentation/
- Flask Documentation: https://flask.palletsprojects.com/
- GeoPandas Documentation: https://geopandas.org/en/stable/
- OGC WMS Standard: https://www.ogc.org/standard/wms/
- OGC WFS Standard: https://www.ogc.org/standard/wfs/
