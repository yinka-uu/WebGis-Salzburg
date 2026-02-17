// Analysis functions
let selectedPoint = null;
// Analysis tools - CLEAN VERSION (NO stray characters)
console.log("✅ Analysis loaded");

// Buffer analysis
window.runBufferAnalysis = function () {
  const dist = document.getElementById("buffer-distance")?.value || 500;
  if (window.drawnItems && window.map) {
    L.circle([47.8095, 13.055], {
      radius: parseInt(dist),
      color: "#3498db",
      fillColor: "#3498db",
      fillOpacity: 0.2,
      weight: 2,
    })
      .addTo(window.drawnItems)
      .bindPopup(`${dist}m buffer`);

    document.getElementById("analysisResults").innerHTML =
      `<div class="results-panel">
                <h4>Buffer Analysis</h4>
                <p>Distance: ${dist}m</p>
                <p>Area: ${((parseInt(dist) * parseInt(dist) * 3.14) / 1000000).toFixed(2)} km²</p>
            </div>`;
  }
};

// Point selection
window.startPointSelection = function () {
  alert("Click on the map to select a point");
  if (window.map) {
    window.map.once("click", function (e) {
      L.marker(e.latlng)
        .addTo(window.drawnItems)
        .bindPopup("Selected point")
        .openPopup();

      document.getElementById("nearest-results").innerHTML =
        `<div class="results-panel">
                    <h4>Selected Point</h4>
                    <p>Lat: ${e.latlng.lat.toFixed(4)}°</p>
                    <p>Lon: ${e.latlng.lng.toFixed(4)}°</p>
                </div>`;
    });
  }
};

// Clear results
window.clearResults = function () {
  document.getElementById("analysisResults").innerHTML =
    "<p>No results yet</p>";
  document.getElementById("nearest-results").innerHTML =
    "<p>No point selected</p>";
};

// Measure distance
window.startMeasuring = function () {
  alert("Click to start measuring. Click again to finish.");
  // Simple implementation
  let points = [];
  window.map.once("click", function (e1) {
    points.push(e1.latlng);
    window.map.once("click", function (e2) {
      points.push(e2.latlng);
      L.polyline([points[0], points[1]], { color: "red" }).addTo(
        window.drawnItems,
      );

      // Calculate distance (simplified)
      const dist = Math.sqrt(
        Math.pow((e2.latlng.lat - e1.latlng.lat) * 111000, 2) +
          Math.pow(
            (e2.latlng.lng - e1.latlng.lng) *
              111000 *
              Math.cos((e1.latlng.lat * Math.PI) / 180),
            2,
          ),
      );
      alert(`Distance: ${dist.toFixed(0)} meters`);
    });
  });
};
