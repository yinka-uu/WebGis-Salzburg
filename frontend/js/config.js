// Configuration settings for Salzburg WebGIS
const CONFIG = {
  // Map settings
  map: {
    center: [47.8095, 13.055],
    zoom: 13,
    minZoom: 10,
    maxZoom: 18,
  },

  // GeoServer settings (for future use)
  geoserver: {
    url: "http://localhost:8080/geoserver",
    workspace: "salzburg",
  },

  // Analysis settings
  analysis: {
    bufferDistances: [100, 200, 500, 1000, 2000],
    serviceTypes: ["school", "hospital", "park", "restaurant"],
  },
};

// Real Salzburg data counts (from your import)
const SALZBURG_STATS = {
  buildings: 344660,
  roads: 200988,
  pois: 63842,
  landuse: 54464,
  green_spaces: 15350,
  water: 17021,
  places: 4911,
  railways: 4388,
  total: 705624,
};

console.log(
  `✅ Config loaded. Database has ${SALZBURG_STATS.total.toLocaleString()} features`,
);
