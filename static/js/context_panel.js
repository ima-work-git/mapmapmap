/**
 * Context Panel - Shows neighbor context info for an address
 */
window.ContextPanel = (function() {

  function getNeighborContext(addressId) {
    return fetch(`/api/search?q=`)
      .then(r => r.json())
      .then(data => {
        // Filter for neighbors of the given address
        return data.results || [];
      });
  }

  function buildContextForAddress(address, allCandidates, pois) {
    // Build relative position context for T2 trigger
    const context = [];

    // Find surrounding POIs
    if (pois && pois.length > 0) {
      pois.forEach(poi => {
        const dist = haversine(address.lat, address.lng, poi.lat, poi.lng);
        if (dist < 200) {
          const direction = estimateRelativeDirection(address, poi);
          context.push({
            direction: direction,
            name: poi.name,
            distance_m: Math.round(dist),
            lat: poi.lat,
            lng: poi.lng,
          });
        }
      });
    }

    // Find neighbors from candidates
    if (allCandidates) {
      allCandidates.forEach(c => {
        if (c.id === address.id) return;
        const dist = haversine(address.lat, address.lng, c.lat, c.lng);
        if (dist < 50) {
          const direction = estimateRelativeDirection(address, c);
          context.push({
            direction: direction,
            name: (c.nameplate ? c.nameplate + 'さん宅' : c.building_name || '隣家'),
            distance_m: Math.round(dist),
            lat: c.lat,
            lng: c.lng,
          });
        }
      });
    }

    // Sort by distance
    context.sort((a, b) => a.distance_m - b.distance_m);

    return context;
  }

  function estimateRelativeDirection(from, to) {
    // Simple relative position based on bearing
    const bearing = calcBearing(from.lat, from.lng, to.lat, to.lng);
    const entrance = from.entrance_bearing || 180; // default south-facing

    const relative = ((bearing - entrance) + 360) % 360;

    if (relative < 45 || relative >= 315) return '道路渡って向かい';
    if (relative >= 45 && relative < 135) return '玄関の右隣';
    if (relative >= 135 && relative < 225) return '裏手';
    return '玄関の左隣';
  }

  function calcBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLam = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam/2) * Math.sin(dLam/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  return { buildContextForAddress, getNeighborContext };
})();
