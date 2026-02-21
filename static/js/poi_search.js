/**
 * POI Search - Searches local DB and optionally Overpass API
 */
window.POISearch = (function() {

  function searchNearby(lat, lng, radius) {
    radius = radius || 200;

    // Search local DB
    fetch(`/api/nearby_pois?lat=${lat}&lng=${lng}&radius=${radius}`)
      .then(r => r.json())
      .then(data => {
        const results = data.results || [];
        displayNearbyResults(lat, lng, results, radius);
      });
  }

  function displayNearbyResults(centerLat, centerLng, results, radius) {
    // Add markers on map
    window.MapController.clearMarkers();

    // Center marker
    window.MapController.addMarker(centerLat, centerLng, {
      className: 'gps',
      label: '✦',
      title: '検索中心',
    });

    results.forEach((r, i) => {
      const catIcons = {
        intersection: '🚦', convenience_store: '🏪', gas_station: '⛽',
        park: '🌳', school: '🏫', temple_shrine: '⛩',
        parking: '🅿', tenant: '🏢', default: '📍'
      };
      const icon = catIcons[r.category] || catIcons.default;

      window.MapController.addMarker(r.lat, r.lng, {
        className: 'poi',
        label: icon,
        title: r.name,
        popup: `
          <div style="padding:6px">
            <div style="font-weight:700;font-size:13px">${escHtml(r.name)}</div>
            <div style="font-size:11px;color:#7f8c8d;margin-top:2px">${escHtml(r.address || '')}</div>
            ${r.distance_m ? `<div style="font-size:11px;color:#3498db;margin-top:2px">${r.distance_m}m</div>` : ''}
          </div>
        `,
        onClick: function() {
          window.MapController.flyTo(r.lat, r.lng, 18);
          window.StreetViewPanel.show(r.lat, r.lng);
        },
      });
    });

    // Zoom to fit
    if (results.length > 0) {
      const points = [{ lat: centerLat, lng: centerLng }]
        .concat(results.map(r => ({ lat: r.lat, lng: r.lng })));
      window.MapController.fitBounds(points, 60);
    }
  }

  function searchByName(query, lat, lng, radius) {
    const params = new URLSearchParams({ q: query });
    if (lat && lng) {
      params.set('lat', lat);
      params.set('lng', lng);
    }
    if (radius) params.set('radius', radius);

    return fetch(`/api/search?${params}`)
      .then(r => r.json())
      .then(data => data.results || []);
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { searchNearby, searchByName };
})();
