/**
 * Street View Panel - Uses GSI/OSM high-zoom as substitute
 * (Free replacement for Google Street View)
 * Shows high-zoom aerial/map view centered on the point
 * with nearby POI markers for context.
 */
window.StreetViewPanel = (function() {
  let svMap = null;
  let visible = false;
  let svMarkers = [];

  function init() {
    const panel = document.getElementById('streetview-panel');
    panel.querySelector('.panel-close').addEventListener('click', hide);
  }

  function show(lat, lng, heading) {
    const panel = document.getElementById('streetview-panel');
    panel.classList.remove('hidden');
    visible = true;

    const content = document.getElementById('streetview-content');

    if (!svMap) {
      // Remove placeholder
      content.innerHTML = '';

      svMap = new maplibregl.Map({
        container: 'streetview-content',
        style: {
          version: 8,
          sources: {
            'gsi-aerial': {
              type: 'raster',
              tiles: [window.APP_CONFIG.gsi_aerial_url],
              tileSize: 256,
            },
            'osm-overlay': {
              type: 'raster',
              tiles: [window.APP_CONFIG.osm_tile_url],
              tileSize: 256,
            }
          },
          layers: [
            { id: 'aerial', type: 'raster', source: 'gsi-aerial' },
            { id: 'osm-overlay', type: 'raster', source: 'osm-overlay',
              paint: { 'raster-opacity': 0.4 } }
          ]
        },
        center: [lng, lat],
        zoom: 19,
        dragRotate: false,
        interactive: true,
      });
    } else {
      svMap.flyTo({ center: [lng, lat], zoom: 19, duration: 800 });
    }

    // Clear old markers
    svMarkers.forEach(m => m.remove());
    svMarkers = [];

    // Add center marker
    const el = document.createElement('div');
    el.style.cssText = 'width:16px;height:16px;background:#e74c3c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)';
    const centerMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(svMap);
    svMarkers.push(centerMarker);

    // Update address info
    updateAddressInfo(lat, lng);
  }

  function updateAddressInfo(lat, lng) {
    fetch(`/api/reverse_geocode?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          const r = data.results[0];
          // Add popup to center marker
          if (svMarkers.length > 0) {
            svMarkers[0].setPopup(
              new maplibregl.Popup({ offset: 10 })
                .setHTML(`<div style="font-size:12px;padding:4px">${r.full_address || ''}<br>${r.nameplate ? '表札: ' + r.nameplate : ''}</div>`)
            );
          }
        }
      });
  }

  function hide() {
    document.getElementById('streetview-panel').classList.add('hidden');
    visible = false;
  }

  function isVisible() { return visible; }

  document.addEventListener('DOMContentLoaded', init);

  return { show, hide, isVisible };
})();
