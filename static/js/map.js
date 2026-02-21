/**
 * MapLibre GL JS - Map Control Module
 */
window.MapController = (function() {
  let map = null;
  let markers = [];
  let gpsCircleLayerAdded = false;
  let currentLayer = 'osm';
  let contextMenuLngLat = null;

  function init() {
    const cfg = window.APP_CONFIG;

    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [cfg.osm_tile_url],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          },
          'gsi-aerial': {
            type: 'raster',
            tiles: [cfg.gsi_aerial_url],
            tileSize: 256,
            attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            layout: { visibility: 'visible' }
          },
          {
            id: 'aerial-layer',
            type: 'raster',
            source: 'gsi-aerial',
            layout: { visibility: 'none' }
          }
        ]
      },
      center: [cfg.map_center_lng, cfg.map_center_lat],
      zoom: cfg.map_default_zoom,
      maxZoom: 19,
      minZoom: 10,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
    });

    // Disable rotation
    map.touchZoomRotate.disableRotation();

    // Add scale control
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 200 }), 'bottom-right');

    // Add zoom control
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Right-click context menu
    map.on('contextmenu', function(e) {
      e.preventDefault();
      contextMenuLngLat = e.lngLat;
      showContextMenu(e.originalEvent.clientX, e.originalEvent.clientY);
    });

    // Close context menu on click
    map.on('click', function() {
      hideContextMenu();
    });

    // Layer toggle buttons
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        switchLayer(this.dataset.layer);
      });
    });

    // Context menu actions
    document.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', function() {
        const action = this.dataset.action;
        if (contextMenuLngLat) {
          handleContextAction(action, contextMenuLngLat);
        }
        hideContextMenu();
      });
    });

    // Close context menu on scroll/pan
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#context-menu')) {
        hideContextMenu();
      }
    });

    // Add GeoJSON source for GPS circle
    map.on('load', function() {
      map.addSource('gps-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'gps-circle-fill',
        type: 'fill',
        source: 'gps-circle',
        paint: {
          'fill-color': 'rgba(52,152,219,0.12)',
        }
      });

      map.addLayer({
        id: 'gps-circle-line',
        type: 'line',
        source: 'gps-circle',
        paint: {
          'line-color': '#3498db',
          'line-width': 2,
          'line-dasharray': [4, 4],
        }
      });

      gpsCircleLayerAdded = true;
    });
  }

  function switchLayer(layer) {
    currentLayer = layer;
    if (layer === 'osm') {
      map.setLayoutProperty('osm-layer', 'visibility', 'visible');
      map.setLayoutProperty('aerial-layer', 'visibility', 'none');
    } else if (layer === 'aerial') {
      map.setLayoutProperty('osm-layer', 'visibility', 'none');
      map.setLayoutProperty('aerial-layer', 'visibility', 'visible');
    } else if (layer === 'hybrid') {
      map.setLayoutProperty('aerial-layer', 'visibility', 'visible');
      map.setLayoutProperty('osm-layer', 'visibility', 'visible');
    }
  }

  function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.classList.remove('hidden');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Adjust if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (y - rect.height) + 'px';
    }
  }

  function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
  }

  function handleContextAction(action, lngLat) {
    switch(action) {
      case 'streetview':
        window.StreetViewPanel.show(lngLat.lat, lngLat.lng);
        break;
      case 'nearby':
        window.POISearch.searchNearby(lngLat.lat, lngLat.lng, 200);
        break;
      case 'reverse-geocode':
        reverseGeocode(lngLat.lat, lngLat.lng);
        break;
      case 'aerial':
        window.AerialPanel.show(lngLat.lat, lngLat.lng);
        break;
    }
  }

  function reverseGeocode(lat, lng) {
    fetch(`/api/reverse_geocode?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          const r = data.results[0];
          const popup = new maplibregl.Popup({ maxWidth: '320px' })
            .setLngLat([lng, lat])
            .setHTML(`
              <div style="padding:8px">
                <div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.full_address || '住所不明'}</div>
                ${r.nameplate ? `<div style="font-size:12px;color:#e67e22">表札: ${r.nameplate}</div>` : ''}
                ${r.building_type ? `<div style="font-size:12px;color:#7f8c8d">${getBuildingTypeLabel(r.building_type)}</div>` : ''}
                <button onclick="window.MapController.confirmAddress('${r.full_address}')"
                        style="margin-top:8px;padding:4px 12px;background:#27ae60;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">
                  この住所で確定
                </button>
              </div>
            `)
            .addTo(map);
        } else {
          // Try Nominatim for reverse geocoding if not in local DB
          const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja&zoom=18`;
          fetch(nominatimUrl)
            .then(r => r.json())
            .then(nData => {
              new maplibregl.Popup({ maxWidth: '320px' })
                .setLngLat([lng, lat])
                .setHTML(`
                  <div style="padding:8px">
                    <div style="font-weight:700;font-size:14px;margin-bottom:4px">${nData.display_name || '住所不明'}</div>
                    <div style="font-size:11px;color:#7f8c8d">出典: OpenStreetMap</div>
                  </div>
                `)
                .addTo(map);
            });
        }
      });
  }

  function flyTo(lat, lng, zoom) {
    map.flyTo({
      center: [lng, lat],
      zoom: zoom || 18,
      duration: 1500,
      essential: true,
    });
  }

  function fitBounds(points, padding) {
    if (points.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    points.forEach(p => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: padding || 80, duration: 1000 });
  }

  function addMarker(lat, lng, options) {
    const el = document.createElement('div');
    el.className = `map-marker ${options.className || ''}`;
    el.innerHTML = options.label || '';
    if (options.title) el.title = options.title;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);

    if (options.popup) {
      marker.setPopup(new maplibregl.Popup({ maxWidth: '320px' }).setHTML(options.popup));
    }

    if (options.onClick) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        options.onClick(lat, lng, marker);
      });
    }

    markers.push(marker);
    return marker;
  }

  function clearMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
  }

  function showGPSCircle(lat, lng, accuracyM) {
    if (!gpsCircleLayerAdded) return;

    // Create a circle polygon approximation
    const points = 64;
    const coords = [];
    const distanceX = accuracyM / (111320 * Math.cos(lat * Math.PI / 180));
    const distanceY = accuracyM / 110574;

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      coords.push([
        lng + distanceX * Math.cos(angle),
        lat + distanceY * Math.sin(angle)
      ]);
    }
    coords.push(coords[0]); // Close ring

    map.getSource('gps-circle').setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        }
      }]
    });
  }

  function clearGPSCircle() {
    if (!gpsCircleLayerAdded) return;
    map.getSource('gps-circle').setData({
      type: 'FeatureCollection',
      features: []
    });
  }

  function confirmAddress(address) {
    fetch('/api/demo/confirm_address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: { full_address: address } }),
    });
  }

  function getMap() { return map; }

  function getBuildingTypeLabel(type) {
    const labels = {
      detached: '戸建て',
      apartment: 'アパート',
      mansion: 'マンション',
      store: '店舗',
      office: 'オフィスビル',
      other: 'その他'
    };
    return labels[type] || type;
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getMap, flyTo, fitBounds, addMarker, clearMarkers,
    showGPSCircle, clearGPSCircle, confirmAddress,
    getBuildingTypeLabel, switchLayer,
  };
})();
