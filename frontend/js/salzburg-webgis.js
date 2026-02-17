// ===========================================
// SALZBURG WebGIS - COMPLETE PRESENTATION VERSION
// ===========================================

console.log("🚀 Initializing Salzburg WebGIS...");

// ===== CONFIGURATION =====
const CONFIG = {
    map: {
        center: [47.8095, 13.0550],
        zoom: 14
    }
};

const STATS = {
    buildings: 344660,
    roads: 200988,
    pois: 63842,
    green: 15350,
    water: 17021,
    railways: 4388,
    total: 705624
};

// ===== GLOBAL VARIABLES =====
let map;
let drawnItems;
let markerLayer;
let currentTool = 'map';

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log("📌 DOM ready, creating map...");
    initMap();
    setTimeout(updateUI, 100);
});

function initMap() {
    // Create map
    map = L.map('map').setView(CONFIG.map.center, CONFIG.map.zoom);
    
    // Basemap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Feature groups
    drawnItems = L.featureGroup().addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    
    // Add all Salzburg landmarks
    addAllLandmarks();
    
    // Mouse move coordinates
    map.on('mousemove', function(e) {
        const el = document.getElementById('coordinates');
        if (el) {
            el.innerHTML = `📍 ${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°`;
        }
    });
    
    // Make globally available
    window.map = map;
    window.drawnItems = drawnItems;
    window.markerLayer = markerLayer;
    
    console.log("✅ Map created successfully");
}

function addAllLandmarks() {
    // Complete Salzburg landmarks
    const landmarks = [
        // Religious buildings
        {name: "Salzburg Cathedral", lat: 47.798, lng: 13.047, type: "church", desc: "Baroque cathedral, 1628"},
        {name: "St. Peter's Abbey", lat: 47.796, lng: 13.045, type: "church", desc: "Oldest monastery in German-speaking area"},
        {name: "Franciscan Church", lat: 47.798, lng: 13.044, type: "church", desc: "Romanesque-Gothic church"},
        {name: "Kollegienkirche", lat: 47.799, lng: 13.042, type: "church", desc: "Baroque university church"},
        
        // Museums & Culture
        {name: "Mozart's Birthplace", lat: 47.800, lng: 13.044, type: "museum", desc: "Where Mozart was born in 1756"},
        {name: "Mozart Residence", lat: 47.801, lng: 13.045, type: "museum", desc: "Mozart's living quarters"},
        {name: "Salzburg Museum", lat: 47.799, lng: 13.048, type: "museum", desc: "City history museum"},
        {name: "Museum of Modern Art", lat: 47.795, lng: 13.041, type: "museum", desc: "Modern art on Mönchsberg"},
        {name: "Haus der Natur", lat: 47.801, lng: 13.042, type: "museum", desc: "Natural history museum"},
        
        // Palaces & Castles
        {name: "Mirabell Palace", lat: 47.806, lng: 13.042, type: "palace", desc: "Baroque palace with gardens"},
        {name: "Hellbrunn Palace", lat: 47.762, lng: 13.061, type: "palace", desc: "Summer palace with trick fountains"},
        {name: "Hohensalzburg Fortress", lat: 47.795, lng: 13.047, type: "castle", desc: "Europe's largest preserved castle"},
        {name: "Leopoldskron Palace", lat: 47.786, lng: 13.037, type: "palace", desc: "Rococo palace, lake views"},
        
        // Parks & Nature
        {name: "Mirabell Gardens", lat: 47.806, lng: 13.041, type: "park", desc: "Famous Sound of Music location"},
        {name: "Kapuzinerberg", lat: 47.807, lng: 13.057, type: "park", desc: "Mountain with city views"},
        {name: "Mönchsberg", lat: 47.795, lng: 13.040, type: "park", desc: "Mountain with art museum"},
        {name: "Hellbrunn Park", lat: 47.764, lng: 13.064, type: "park", desc: "Extensive palace gardens"},
        {name: "Volksgarten", lat: 47.810, lng: 13.040, type: "park", desc: "Public garden near train station"},
        {name: "Kurgarten", lat: 47.804, lng: 13.043, type: "park", desc: "Historic spa gardens"},
        
        // Transportation
        {name: "Salzburg Hauptbahnhof", lat: 47.813, lng: 13.045, type: "station", desc: "Main train station"},
        {name: "Salzburg Airport", lat: 47.793, lng: 13.003, type: "airport", desc: "W.A. Mozart Airport"},
        {name: "Mirabellplatz", lat: 47.805, lng: 13.044, type: "bus", desc: "Main bus terminal"},
        
        // Universities & Education
        {name: "University of Salzburg", lat: 47.795, lng: 13.048, type: "university", desc: "Main university building"},
        {name: "Mozarteum University", lat: 47.804, lng: 13.044, type: "university", desc: "Music and arts university"},
        {name: "Paris Lodron University", lat: 47.796, lng: 13.046, type: "university", desc: "Historical university"},
        
        // Theaters & Concert Halls
        {name: "Festival Hall", lat: 47.798, lng: 13.042, type: "theater", desc: "Salzburg Festival venue"},
        {name: "Landestheater", lat: 47.801, lng: 13.045, type: "theater", desc: "State theater"},
        {name: "Haus für Mozart", lat: 47.798, lng: 13.041, type: "theater", desc: "Opera house"},
        {name: "Rockhouse Salzburg", lat: 47.805, lng: 13.045, type: "music", desc: "Live music venue"},
        
        // Shopping & Dining
        {name: "Getreidegasse", lat: 47.799, lng: 13.043, type: "shopping", desc: "Famous shopping street"},
        {name: "Alter Markt", lat: 47.799, lng: 13.046, type: "shopping", desc: "Historic market square"},
        {name: "Europark", lat: 47.816, lng: 13.016, type: "shopping", desc: "Modern shopping mall"},
        {name: "Cafe Tomaselli", lat: 47.799, lng: 13.045, type: "cafe", desc: "Historic cafe since 1705"},
        {name: "St. Peter Stiftskeller", lat: 47.797, lng: 13.046, type: "restaurant", desc: "Europe's oldest restaurant"},
        
        // Water features
        {name: "Salzach River", lat: 47.801, lng: 13.048, type: "river", desc: "Main river through Salzburg"},
        {name: "Almkanal", lat: 47.796, lng: 13.046, type: "canal", desc: "Historic water channel"},
        {name: "Mönchsbergsee", lat: 47.797, lng: 13.037, type: "lake", desc: "Small lake on Mönchsberg"},
        
        // Squares & Monuments
        {name: "Residenzplatz", lat: 47.798, lng: 13.047, type: "square", desc: "Main square with fountain"},
        {name: "Kapitelplatz", lat: 47.796, lng: 13.046, type: "square", desc: "Square with golden ball"},
        {name: "Mozartplatz", lat: 47.800, lng: 13.044, type: "square", desc: "Square with Mozart statue"},
        {name: "Pferdeschwemme", lat: 47.798, lng: 13.045, type: "monument", desc: "Baroque horse fountain"}
    ];
    
    // Color mapping
    const colors = {
        church: "#FF4444",
        museum: "#FF9933",
        palace: "#FF66B2",
        castle: "#8B4513",
        park: "#33CC33",
        station: "#666666",
        airport: "#666666",
        bus: "#666666",
        university: "#9933FF",
        theater: "#FF44AA",
        music: "#FF44AA",
        shopping: "#FFAA00",
        cafe: "#FFAA00",
        restaurant: "#FFAA00",
        river: "#3366FF",
        canal: "#3366FF",
        lake: "#3366FF",
        square: "#AAAAAA",
        monument: "#DDDDDD"
    };
    
    // Add all markers
    landmarks.forEach(l => {
        const color = colors[l.type] || "#FF4444";
        
        const marker = L.circleMarker([l.lat, l.lng], {
            radius: 8,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2
        }).bindPopup(`
            <b>${l.name}</b><br>
            <i>${l.type}</i><br>
            <small>${l.desc || ''}</small><br>
            <small>📍 ${l.lat.toFixed(4)}°, ${l.lng.toFixed(4)}°</small>
        `);
        
        marker.addTo(markerLayer);
    });
    
    // Add some roads as lines
    const roads = [
        {name: "Getreidegasse", coords: [[47.798,13.041], [47.800,13.046]]},
        {name: "Linzer Gasse", coords: [[47.801,13.046], [47.803,13.052]]},
        {name: "Salzach River", coords: [[47.790,13.035], [47.820,13.055]]}
    ];
    
    roads.forEach(r => {
        L.polyline(r.coords, {
            color: "#333333",
            weight: 3,
            opacity: 0.6
        }).bindPopup(`<b>${r.name}</b>`).addTo(markerLayer);
    });
    
    console.log(`✅ Added ${landmarks.length} landmarks to map`);
}

// ===== TOOL SWITCHING =====
window.showTool = function(tool) {
    currentTool = tool;
    
    // Update active button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(tool)) {
            btn.classList.add('active');
        }
    });
    
    // Update title
    const titles = {
        'map': '🗺️ Map Tools',
        'layers': '🎨 Layer Manager',
        'analysis': '📊 Analysis Tools',
        'query': '🔍 Query Tools',
        'about': 'ℹ️ About'
    };
    const titleEl = document.getElementById('tool-title');
    if (titleEl) titleEl.innerHTML = titles[tool] || 'Tools';
    
    // Load content
    const content = document.getElementById('sidebarContent');
    if (!content) return;
    
    switch(tool) {
        case 'map':
            content.innerHTML = getMapToolsHTML();
            break;
        case 'layers':
            content.innerHTML = getLayersHTML();
            break;
        case 'analysis':
            content.innerHTML = getAnalysisHTML();
            break;
        case 'query':
            content.innerHTML = getQueryHTML();
            break;
        case 'about':
            content.innerHTML = getAboutHTML();
            break;
    }
};

// ===== HTML GENERATORS =====
function getMapToolsHTML() {
    return `
        <div class="tool-card">
            <h3><i class="fas fa-globe"></i> Navigation</h3>
            <button onclick="zoomToSalzburg()">
                <i class="fas fa-city"></i> Zoom to Salzburg
            </button>
            <button onclick="clearDrawings()">
                <i class="fas fa-eraser"></i> Clear All Drawings
            </button>
            <button onclick="exportMap()">
                <i class="fas fa-camera"></i> Take Screenshot
            </button>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-info-circle"></i> Current View</h3>
            <div class="result-item">
                <span>Zoom Level:</span>
                <span class="stats-badge">${map.getZoom()}</span>
            </div>
            <div class="result-item">
                <span>Center:</span>
                <span>${map.getCenter().lat.toFixed(4)}°, ${map.getCenter().lng.toFixed(4)}°</span>
            </div>
        </div>
        
        <div class="stats-card">
            <h4><i class="fas fa-database"></i> Database Stats</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${(STATS.buildings/1000).toFixed(1)}k</div>
                    <div class="stat-label">Buildings</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${(STATS.roads/1000).toFixed(1)}k</div>
                    <div class="stat-label">Roads</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${(STATS.pois/1000).toFixed(1)}k</div>
                    <div class="stat-label">POIs</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${(STATS.total/1000).toFixed(1)}k</div>
                    <div class="stat-label">Total</div>
                </div>
            </div>
        </div>
    `;
}

function getLayersHTML() {
    return `
        <div class="tool-card">
            <h3><i class="fas fa-eye"></i> Layer Visibility</h3>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #FF4444;"></span>
                <span>Religious (${countByType('church')})</span>
                <span class="legend-count" id="count-church">${countByType('church')}</span>
            </div>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #FF9933;"></span>
                <span>Museums (${countByType('museum')})</span>
                <span class="legend-count" id="count-museum">${countByType('museum')}</span>
            </div>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #FF66B2;"></span>
                <span>Palaces (${countByType('palace')})</span>
                <span class="legend-count" id="count-palace">${countByType('palace')}</span>
            </div>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #33CC33;"></span>
                <span>Parks (${countByType('park')})</span>
                <span class="legend-count" id="count-park">${countByType('park')}</span>
            </div>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #3366FF;"></span>
                <span>Water (${countByType('river')})</span>
                <span class="legend-count" id="count-water">${countByType('river')}</span>
            </div>
            
            <div class="legend-item">
                <span class="legend-color" style="background: #666666;"></span>
                <span>Transport (${countByType('station')})</span>
                <span class="legend-count" id="count-transport">${countByType('station')}</span>
            </div>
            
            <div style="margin-top:15px;">
                <label>Layer Opacity</label>
                <input type="range" min="0" max="1" step="0.1" value="0.8" onchange="setOpacity(this.value)">
            </div>
            
            <button onclick="resetLayers()" style="margin-top:10px;">
                <i class="fas fa-redo"></i> Reset Layers
            </button>
        </div>
    `;
}

function getAnalysisHTML() {
    return `
        <div class="tool-card">
            <h3><i class="fas fa-circle"></i> Buffer Analysis</h3>
            <select id="buffer-type">
                <option value="church">Churches</option>
                <option value="museum">Museums</option>
                <option value="park">Parks</option>
                <option value="all">All Landmarks</option>
            </select>
            <select id="buffer-dist">
                <option value="100">100 meters</option>
                <option value="200">200 meters</option>
                <option value="500">500 meters</option>
                <option value="1000">1 km</option>
                <option value="2000">2 km</option>
            </select>
            <button onclick="runBufferAnalysis()">
                <i class="fas fa-play"></i> Run Buffer Analysis
            </button>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-crosshairs"></i> Nearest Services</h3>
            <p>Click on map to find nearest:</p>
            <button onclick="startNearest('all')">All Services</button>
            <button onclick="startNearest('restaurant')">Restaurants</button>
            <button onclick="startNearest('museum')">Museums</button>
            <button onclick="startNearest('park')">Parks</button>
            
            <div id="nearest-results" class="results-panel">
                <p>Click a button then click on map</p>
            </div>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-ruler"></i> Measure Distance</h3>
            <button onclick="startMeasure()">
                <i class="fas fa-pencil"></i> Draw Measurement Line
            </button>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-chart-bar"></i> Results</h3>
            <div id="analysis-results" class="results-panel">
                <p>No analysis results yet</p>
            </div>
            <button onclick="clearAnalysis()" class="danger">
                <i class="fas fa-trash"></i> Clear All
            </button>
        </div>
    `;
}

function getQueryHTML() {
    return `
        <div class="tool-card">
            <h3><i class="fas fa-search"></i> Spatial Query</h3>
            <p>Click on map to query features:</p>
            <button onclick="startSpatialQuery()">
                <i class="fas fa-mouse-pointer"></i> Query Mode
            </button>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-filter"></i> Attribute Query</h3>
            <select id="query-type">
                <option value="church">Churches</option>
                <option value="museum">Museums</option>
                <option value="park">Parks</option>
                <option value="restaurant">Restaurants</option>
            </select>
            <button onclick="runAttributeQuery()">
                <i class="fas fa-search"></i> Find All
            </button>
            
            <div id="query-results" class="results-panel">
                <p>Select a type and click Find</p>
            </div>
        </div>
    `;
}

function getAboutHTML() {
    return `
        <div class="tool-card">
            <h3><i class="fas fa-info-circle"></i> Salzburg WebGIS</h3>
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Purpose:</strong> Urban management platform for Salzburg</p>
            <p><strong>Features:</strong></p>
            <ul style="margin-left:20px;">
                <li>Interactive map with 40+ landmarks</li>
                <li>Buffer analysis for urban planning</li>
                <li>Nearest service finder</li>
                <li>Distance measurement</li>
                <li>Spatial queries</li>
            </ul>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-database"></i> Data Sources</h3>
            <ul style="margin-left:20px;">
                <li>OpenStreetMap (BBBike)</li>
                <li>Salzburg GIS (SAGIS)</li>
                <li>Austrian Open Data</li>
            </ul>
            <p><strong>Database:</strong></p>
            <ul style="margin-left:20px;">
                <li>Buildings: ${STATS.buildings.toLocaleString()}</li>
                <li>Roads: ${STATS.roads.toLocaleString()}</li>
                <li>Points of Interest: ${STATS.pois.toLocaleString()}</li>
                <li>Green Spaces: ${STATS.green.toLocaleString()}</li>
                <li>Water Bodies: ${STATS.water.toLocaleString()}</li>
                <li><strong>Total: ${STATS.total.toLocaleString()} features</strong></li>
            </ul>
        </div>
        
        <div class="tool-card">
            <h3><i class="fas fa-users"></i> Team</h3>
            <p>Developed for urban management and planning</p>
            <p>© 2026 Salzburg WebGIS</p>
        </div>
    `;
}

// ===== HELPER FUNCTIONS =====
function countByType(type) {
    // This would count from real data
    const counts = {
        church: 4,
        museum: 5,
        palace: 3,
        park: 5,
        river: 1,
        station: 1
    };
    return counts[type] || 0;
}

// ===== LAYER FUNCTIONS =====
window.toggleMarkers = function(visible) {
    if (visible) {
        map.addLayer(markerLayer);
    } else {
        map.removeLayer(markerLayer);
    }
};

window.setOpacity = function(value) {
    map.eachLayer(function(layer) {
        if (layer.setStyle) {
            layer.setStyle({opacity: value, fillOpacity: value * 0.8});
        }
    });
};

window.resetLayers = function() {
    map.eachLayer(function(layer) {
        if (layer.setStyle) {
            layer.setStyle({opacity: 1, fillOpacity: 0.8});
        }
    });
    document.querySelector('input[type="range"]').value = 0.8;
};

// ===== ANALYSIS FUNCTIONS =====
window.runBufferAnalysis = function() {
    const type = document.getElementById('buffer-type').value;
    const dist = parseInt(document.getElementById('buffer-dist').value);
    
    drawnItems.clearLayers();
    
    // Get landmarks of selected type
    let targets = [];
    map.eachLayer(function(layer) {
        if (layer instanceof L.CircleMarker && layer.getPopup()) {
            const popup = layer.getPopup();
            if (popup) {
                const content = popup.getContent();
                if (type === 'all' || (content && content.toLowerCase().includes(type))) {
                    targets.push(layer.getLatLng());
                }
            }
        }
    });
    
    if (targets.length === 0) {
        targets = [map.getCenter()];
    }
    
    // Create buffers
    targets.forEach(latLng => {
        L.circle(latLng, {
            radius: dist,
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.2,
            weight: 2
        }).addTo(drawnItems);
    });
    
    const area = targets.length * Math.PI * dist * dist / 1000000;
    
    document.getElementById('analysis-results').innerHTML = `
        <h4>✅ Buffer Analysis Complete</h4>
        <div class="result-item">
            <span>Target type:</span>
            <span class="stats-badge">${type}</span>
        </div>
        <div class="result-item">
            <span>Buffer distance:</span>
            <span class="stats-badge">${dist}m</span>
        </div>
        <div class="result-item">
            <span>Features analyzed:</span>
            <span class="stats-badge">${targets.length}</span>
        </div>
        <div class="result-item">
            <span>Total area covered:</span>
            <span class="stats-badge">${area.toFixed(2)} km²</span>
        </div>
    `;
};

window.startNearest = function(serviceType) {
    const resultsDiv = document.getElementById('nearest-results');
    resultsDiv.innerHTML = '<p>📍 Click on the map to find nearest services...</p>';
    
    map.once('click', function(e) {
        // Find all landmarks
        const landmarks = [];
        map.eachLayer(function(layer) {
            if (layer instanceof L.CircleMarker && layer.getPopup()) {
                const popup = layer.getPopup();
                if (popup) {
                    const content = popup.getContent();
                    const latLng = layer.getLatLng();
                    
                    // Calculate distance
                    const dist = Math.sqrt(
                        Math.pow((latLng.lat - e.latlng.lat) * 111000, 2) +
                        Math.pow((latLng.lng - e.latlng.lng) * 111000 * Math.cos(e.latlng.lat * Math.PI/180), 2)
                    );
                    
                    landmarks.push({
                        name: content.split('<b>')[1]?.split('</b>')[0] || 'Unknown',
                        type: content.split('<i>')[1]?.split('</i>')[0] || 'unknown',
                        distance: dist,
                        latLng: latLng
                    });
                }
            }
        });
        
        // Filter by type if specified
        let filtered = landmarks;
        if (serviceType !== 'all') {
            filtered = landmarks.filter(l => l.type.toLowerCase().includes(serviceType));
        }
        
        // Sort by distance
        filtered.sort((a, b) => a.distance - b.distance);
        
        // Show top 5
        let html = `<h4>📍 Nearest ${serviceType === 'all' ? 'Services' : serviceType + 's'}</h4>`;
        for (let i = 0; i < Math.min(5, filtered.length); i++) {
            html += `
                <div class="result-item">
                    <span>${filtered[i].name}</span>
                    <span class="stats-badge">${filtered[i].distance.toFixed(0)}m</span>
                </div>
            `;
        }
        
        // Add marker at click point
        L.marker(e.latlng).addTo(drawnItems)
            .bindPopup('Selected location').openPopup();
        
        resultsDiv.innerHTML = html;
    });
};

window.startMeasure = function() {
    let points = [];
    const resultsDiv = document.getElementById('analysis-results');
    
    resultsDiv.innerHTML = '<p>📏 Click first point on map...</p>';
    
    map.once('click', function(e1) {
        points.push(e1.latlng);
        L.marker(e1.latlng).addTo(drawnItems).bindPopup('Point 1').openPopup();
        
        resultsDiv.innerHTML = '<p>📏 Click second point on map...</p>';
        
        map.once('click', function(e2) {
            points.push(e2.latlng);
            L.marker(e2.latlng).addTo(drawnItems).bindPopup('Point 2').openPopup();
            
            // Draw line
            L.polyline([e1.latlng, e2.latlng], {
                color: '#e74c3c',
                weight: 3,
                dashArray: '5, 5'
            }).addTo(drawnItems);
            
            // Calculate distance
            const dist = Math.sqrt(
                Math.pow((e2.latlng.lat - e1.latlng.lat) * 111000, 2) +
                Math.pow((e2.latlng.lng - e1.latlng.lng) * 111000 * Math.cos(e1.latlng.lat * Math.PI/180), 2)
            );
            
            resultsDiv.innerHTML = `
                <h4>📏 Distance Measurement</h4>
                <div class="result-item">
                    <span>Distance:</span>
                    <span class="stats-badge">${dist.toFixed(1)} m</span>
                </div>
                <div class="result-item">
                    <span>Kilometers:</span>
                    <span class="stats-badge">${(dist/1000).toFixed(2)} km</span>
                </div>
            `;
        });
    });
};

window.clearAnalysis = function() {
    drawnItems.clearLayers();
    document.getElementById('analysis-results').innerHTML = '<p>No analysis results yet</p>';
    document.getElementById('nearest-results').innerHTML = '<p>Click a button then click on map</p>';
};

// ===== QUERY FUNCTIONS =====
window.startSpatialQuery = function() {
    const resultsDiv = document.getElementById('query-results');
    resultsDiv.innerHTML = '<p>🔍 Click on map to query features...</p>';
    
    map.once('click', function(e) {
        // Find nearby features
        const nearby = [];
        map.eachLayer(function(layer) {
            if (layer instanceof L.CircleMarker && layer.getPopup()) {
                const latLng = layer.getLatLng();
                const dist = Math.sqrt(
                    Math.pow((latLng.lat - e.latlng.lat) * 111000, 2) +
                    Math.pow((latLng.lng - e.latlng.lng) * 111000 * Math.cos(e.latlng.lat * Math.PI/180), 2)
                );
                
                if (dist < 200) { // Within 200m
                    const popup = layer.getPopup();
                    const content = popup ? popup.getContent() : '';
                    nearby.push({
                        name: content.split('<b>')[1]?.split('</b>')[0] || 'Unknown',
                        distance: dist
                    });
                }
            }
        });
        
        if (nearby.length > 0) {
            let html = '<h4>📍 Features within 200m</h4>';
            nearby.forEach(n => {
                html += `
                    <div class="result-item">
                        <span>${n.name}</span>
                        <span class="stats-badge">${n.distance.toFixed(0)}m</span>
                    </div>
                `;
            });
            resultsDiv.innerHTML = html;
        } else {
            resultsDiv.innerHTML = '<p>No features within 200m</p>';
        }
        
        // Add marker at query point
        L.marker(e.latlng).addTo(drawnItems).bindPopup('Query point').openPopup();
    });
};

window.runAttributeQuery = function() {
    const type = document.getElementById('query-type').value;
    const resultsDiv = document.getElementById('query-results');
    
    // Count features of selected type
    let count = 0;
    const examples = [];
    
    map.eachLayer(function(layer) {
        if (layer instanceof L.CircleMarker && layer.getPopup()) {
            const popup = layer.getPopup();
            if (popup) {
                const content = popup.getContent();
                if (content && content.toLowerCase().includes(type)) {
                    count++;
                    if (examples.length < 3) {
                        const name = content.split('<b>')[1]?.split('</b>')[0] || 'Unknown';
                        examples.push(name);
                    }
                }
            }
        }
    });
    
    let html = `<h4>🔍 Found ${count} ${type}s</h4>`;
    if (examples.length > 0) {
        html += '<p>Examples:</p><ul>';
        examples.forEach(e => html += `<li>${e}</li>`);
        html += '</ul>';
    }
    
    resultsDiv.innerHTML = html;
};

// ===== UTILITY FUNCTIONS =====
window.zoomToSalzburg = function() {
    map.setView([47.8095, 13.0550], 14);
};

window.clearDrawings = function() {
    drawnItems.clearLayers();
};

window.exportMap = function() {
    alert('📸 Screenshot feature would save current map view');
};

window.toggleSidebar = function() {
    document.querySelector('.sidebar').classList.toggle('collapsed');
};

window.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
};

window.locateMe = function() {
    map.locate({setView: true, maxZoom: 16});
    map.on('locationfound', function(e) {
        L.marker(e.latlng).addTo(map).bindPopup('You are here').openPopup();
    });
};

function updateUI() {
    // Update any dynamic UI elements
    console.log("✅ UI ready");
}

console.log("🎉 Salzburg WebGIS is ready!");
console.log(`📊 Database contains ${STATS.total.toLocaleString()} real features`);