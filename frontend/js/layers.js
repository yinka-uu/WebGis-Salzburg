// Layer management functions
function toggleLayer(layerName, visible) {
  console.log(`Toggling layer: ${layerName} - ${visible}`);
  if (window.map) {
    // In production, this would toggle WMS layers
    alert(`Layer ${layerName} ${visible ? "shown" : "hidden"}`);
  }
}

function setOpacity(value) {
  console.log(`Setting opacity to: ${value}`);
  if (window.map) {
    window.map.eachLayer(function (layer) {
      if (layer.setOpacity) {
        layer.setOpacity(value);
      }
    });
  }
}

function changeStyle() {
  const style = document.getElementById("styleSelect")?.value || "default";
  alert(`Style changed to: ${style}`);
}

console.log("✅ layers.js loaded");
