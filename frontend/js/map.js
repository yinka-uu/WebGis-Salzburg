// MAIN MAP FILE - ALL FUNCTIONS IN ONE PLACE
console.log("🚀 Loading map.js...");

// Global variables
let map;
let drawnItems;
let markerLayer;

// Initialize everything when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM ready, initializing map...");
  initMap();
  setupControls();
});

function initMap() {
  // Create map
  map = L.map("map").setView([47.8095, 13.055], 13);

  // Basemap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "OpenStreetMap",
  }).addTo(map);

  // Feature groups
  drawnItems = L.featureGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  // Add sample markers
  addMarkers();

  // Coordinates display
  map.on("mousemove", function (e) {
    document.getElementById("coordinates").innerHTML =
      `Lon: ${e.latlng.lng.toFixed(4)}° | Lat: ${e.latlng.lat.toFixed(4)}°`;
  });

  // Make map globally available
  window.map = map;
  window.drawnItems = drawnItems;
  window.markerLayer = markerLayer;

  console.log("✅ Map initialized");
}

function addMarkers() {
  const places = [
    { name: "Salzburg Cathedral", lat: 47.798, lng: 13.047, color: "#FF4444" },
    { name: "Mozart's Birthplace", lat: 47.8, lng: 13.044, color: "#FF9933" },
    { name: "Mirabell Palace", lat: 47.806, lng: 13.042, color: "#FF9933" },
    { name: "Kapuzinerberg", lat: 47.807, lng: 13.057, color: "#33CC33" },
  ];

  places.forEach((p) => {
    L.circleMarker([p.lat, p.lng], {
      radius: 8,
      color: p.color,
      fillColor: p.color,
      fillOpacity: 0.8,
    })
      .bindPopup(`<b>${p.name}</b>`)
      .addTo(markerLayer);
  });
}

function setupControls() {
  // Zoom buttons
  document.getElementById("zoomIn").onclick = () => map.zoomIn();
  document.getElementById("zoomOut").onclick = () => map.zoomOut();
  document.getElementById("fullscreen").onclick = toggleFullscreen;
  document.getElementById("locateMe").onclick = locateMe;
  document.getElementById("closeSidebar").onclick = toggleSidebar;
}

// ========== GLOBAL FUNCTIONS FOR BUTTONS ==========

// Main navigation
window.showTool = function (tool) {
  console.log("🔧 Switching to:", tool);

  // Update active button
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.textContent.toLowerCase().includes(tool)) {
      btn.classList.add("active");
    }
  });

  // Update title
  const titles = {
    map: "Map Tools",
    layers: "Layer Manager",
    analysis: "Analysis Tools",
    query: "Query Tools",
    about: "About",
  };
  document.getElementById("tool-title").textContent = titles[tool] || "Tools";

  // Load content
  const content = document.getElementById("sidebarContent");

  switch (tool) {
    case "map":
      content.innerHTML = `
                <div class="tool-card">
                    <h3>Map Tools</h3>
                    <button onclick="zoomToSalzburg()">Zoom to Salzburg</button>
                    <button onclick="clearDrawings()">Clear Drawings</button>
                    <button onclick="exportMap()">Screenshot</button>
                </div>
                <div class="tool-card">
                    <h3>Map Info</h3>
                    <p>Zoom: ${map.getZoom()}</p>
                    <p>Center: ${map.getCenter().lat.toFixed(4)}</p>
                </div>
            `;
      break;

    case "layers":
      content.innerHTML = `
                <div class="tool-card">
                    <h3>Layer Visibility</h3>
                    <label><input type="checkbox" checked onchange="toggleMarkers(this.checked)"> Landmarks</label><br>
                    <label><input type="checkbox" checked> Buildings</label><br>
                    <label><input type="checkbox" checked> Roads</label><br>
                    <label>Opacity: <input type="range" min="0" max="1" step="0.1" value="0.8" onchange="setOpacity(this.value)"></label>
                </div>
            `;
      break;

    case "analysis":
      content.innerHTML = `
                <div class="tool-card">
                    <h3>Buffer Analysis</h3>
                    <select id="buffer-type">
                        <option>Buildings</option>
                        <option>Parks</option>
                    </select>
                    <select id="buffer-distance">
                        <option value="100">100m</option>
                        <option value="500">500m</option>
                    </select>
                    <button onclick="runBufferAnalysis()">Run</button>
                </div>
                <div class="tool-card">
                    <h3>Nearest Services</h3>
                    <button onclick="startPointSelection()">Select Point</button>
                    <div id="nearest-results">No point selected</div>
                </div>
                <div class="tool-card">
                    <h3>Results</h3>
                    <div id="analysisResults">No results</div>
                    <button onclick="clearResults()">Clear</button>
                </div>
            `;
      break;

    case "query":
      content.innerHTML = `
                <div class="tool-card">
                    <h3>Query</h3>
                    <input type="text" placeholder="Search...">
                    <button>Search</button>
                </div>
            `;
      break;

    case "about":
      content.innerHTML = `
                <div class="tool-card">
                    <h3>Salzburg WebGIS</h3>
                    <p>Version 1.0</p>
                    <p>Database: ${SALZBURG_STATS.total.toLocaleString()} features</p>
                </div>
            `;
      break;
  }
};

// Map controls
window.zoomToSalzburg = function () {
  map.setView([47.8095, 13.055], 13);
};

window.clearDrawings = function () {
  drawnItems.clearLayers();
};

window.exportMap = function () {
  alert("Export map feature");
};

// Sidebar
window.toggleSidebar = function () {
  document.querySelector(".sidebar").classList.toggle("collapsed");
};

// Fullscreen
window.toggleFullscreen = function () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// Location
window.locateMe = function () {
  map.locate({ setView: true, maxZoom: 16 });
};

// Buffer analysis
window.runBufferAnalysis = function () {
  const dist = document.getElementById("buffer-distance")?.value || 500;
  L.circle([47.8095, 13.055], {
    radius: parseInt(dist),
    color: "blue",
    fillOpacity: 0.2,
  })
    .addTo(drawnItems)
    .bindPopup(`${dist}m buffer`);

  document.getElementById("analysisResults").innerHTML =
    `Buffer created at ${dist}m`;
};

// Point selection
window.startPointSelection = function () {
  map.once("click", function (e) {
    L.marker(e.latlng).addTo(drawnItems).bindPopup("Selected").openPopup();
    document.getElementById("nearest-results").innerHTML =
      `Selected at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  });
};

// Clear results
window.clearResults = function () {
  document.getElementById("analysisResults").innerHTML = "No results";
  document.getElementById("nearest-results").innerHTML = "No point selected";
};

console.log("✅ All map functions loaded");
