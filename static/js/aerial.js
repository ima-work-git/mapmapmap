/**
 * Aerial Photo Panel - GSI satellite imagery overlay
 */
window.AerialPanel = (function() {
  let aerialMap = null;
  let visible = false;

  function init() {
    const panel = document.getElementById('aerial-panel');
    panel.querySelector('.panel-close').addEventListener('click', hide);
  }

  function show(lat, lng, zoom) {
    const panel = document.getElementById('aerial-panel');
    panel.classList.remove('hidden');
    visible = true;

    if (!aerialMap) {
      aerialMap = new maplibregl.Map({
        container: 'aerial-map',
        style: {
          version: 8,
          sources: {
            'gsi-aerial': {
              type: 'raster',
              tiles: [window.APP_CONFIG.gsi_aerial_url],
              tileSize: 256,
            }
          },
          layers: [{
            id: 'aerial',
            type: 'raster',
            source: 'gsi-aerial',
          }]
        },
        center: [lng, lat],
        zoom: zoom || 18,
        dragRotate: false,
        interactive: true,
      });
    } else {
      aerialMap.flyTo({ center: [lng, lat], zoom: zoom || 18, duration: 800 });
    }
  }

  function hide() {
    document.getElementById('aerial-panel').classList.add('hidden');
    visible = false;
  }

  function isVisible() { return visible; }

  document.addEventListener('DOMContentLoaded', init);

  return { show, hide, isVisible };
})();
