/**
 * Trigger Engine (Frontend) - Monitors events and activates AI interventions
 */
window.TriggerEngine = (function() {
  let callActive = false;
  let callStartTime = null;
  let gpsData = null;
  let searchHistory = [];
  let addressConfirmed = false;
  let demoData = null;
  let currentScenario = null;
  let delayTimers = {};

  function init() {
    // Load demo data
    fetch('/api/demo_data')
      .then(r => r.json())
      .then(data => { demoData = data; });

    // ── Listen for system events ──

    window.EventBus.on('call_started', function(data) {
      callActive = true;
      callStartTime = Date.now();
      gpsData = null;
      searchHistory = [];
      addressConfirmed = false;
      currentScenario = data.scenario;
      clearAllTimers();
      updateCallStatus('active', '受付中');
      startTimer();
    });

    window.EventBus.on('gps_received', function(data) {
      gpsData = { lat: data.lat, lng: data.lng, accuracy_m: data.accuracy_m };
      updateGPSIndicator(data.accuracy_m);

      // Map actions
      window.MapController.flyTo(data.lat, data.lng, 17);
      window.MapController.showGPSCircle(data.lat, data.lng, data.accuracy_m);

      // GPS marker
      window.MapController.addMarker(data.lat, data.lng, {
        className: 'gps',
        label: '📡',
        title: `GPS (±${data.accuracy_m}m)`,
      });

      // Check T3 trigger after delay
      checkT3Delayed();
    });

    window.EventBus.on('address_confirmed', function(data) {
      addressConfirmed = true;
      clearAllTimers();
      updateCallStatus('confirmed', '確定済み');
      window.AIDialog.updateAIStatus('idle');

      // Show confirmed marker
      if (data.address && data.address.lat && data.address.lng) {
        window.MapController.addMarker(data.address.lat, data.address.lng, {
          className: 'confirmed',
          label: '✓',
          title: '確定: ' + (data.address.full_address || ''),
        });
      }

      // Auto hide AI dialog after 10 seconds
      window.AIDialog.autoHideAfter(10000);
    });

    window.EventBus.on('call_ended', function() {
      callActive = false;
      addressConfirmed = false;
      gpsData = null;
      searchHistory = [];
      currentScenario = null;
      clearAllTimers();
      stopTimer();
      updateCallStatus('idle', '待機中');
      updateGPSIndicator(null);
      window.AIDialog.hide();
      window.MapController.clearMarkers();
      window.MapController.clearGPSCircle();
    });

    // ── Listen for search events ──

    window.EventBus.on('multi_hit_same_address', function(data) {
      if (addressConfirmed) return;
      handleT1(data);
    });

    window.EventBus.on('search_no_hit', function(data) {
      if (addressConfirmed) return;
      handleT4(data);
    });

    window.EventBus.on('similar_names_hit', function(data) {
      if (addressConfirmed) return;
      handleT6(data);
    });

    window.EventBus.on('local_search', function(data) {
      searchHistory.push({
        query: data.query,
        count: data.count,
        time: Date.now(),
        results: data.results,
      });

      // Check for T2 (address delay) if exactly 1 result
      if (data.count === 1 && !addressConfirmed) {
        checkT2Delayed(data.results[0]);
      }
    });

    window.EventBus.on('candidate_confirmed', function(data) {
      // A candidate was identified via question engine
      handleCandidateConfirmed(data.id);
    });

    window.EventBus.on('candidate_identified', function(data) {
      // Highlight the confirmed candidate on map
      handleCandidateIdentified(data.id, data.label);
    });

    // ── Listen for demo trigger simulations ──

    window.EventBus.on('demo_trigger_t1', function(data) {
      handleT1Demo(data.scenario);
    });

    window.EventBus.on('demo_trigger_t3', function(data) {
      handleT3Demo(data.scenario);
    });

    window.EventBus.on('demo_trigger_t4', function(data) {
      handleT4Demo(data.scenario);
    });

    window.EventBus.on('demo_trigger_t6', function(data) {
      handleT6Demo(data.scenario);
    });

    window.EventBus.on('demo_skip_time', function(data) {
      const skipMs = data.seconds * 1000;
      // Adjust start time to simulate time passage
      if (callStartTime) {
        callStartTime -= skipMs;
      }
      // Check pending triggers
      if (gpsData && searchHistory.length === 0) {
        checkT3Now();
      }
      // Check T2
      searchHistory.forEach(s => {
        if (s.count === 1) {
          s.time -= skipMs;
          checkT2Now(s.results[0]);
        }
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // T1: Same-address multiple hits
  // ════════════════════════════════════════════════════════
  function handleT1(data) {
    window.AIDialog.updateAIStatus('analyzing');

    const area = getAreaData(currentScenario || 'area_a');
    const candidates = data.candidates || [];

    // Enrich candidates with features from demo data
    if (area && area.buildings) {
      candidates.forEach(c => {
        const bld = area.buildings.find(b => b.id === c.id);
        if (bld) {
          c._features = bld.features || {};
        }
      });
    }

    // Add markers
    window.MapController.clearMarkers();
    candidates.forEach((c, i) => {
      window.MapController.addMarker(c.lat, c.lng, {
        className: 'candidate',
        label: String(i + 1),
        title: `${c.nameplate || c.building_name || ''}宅`,
        onClick: function() {
          window.MapController.flyTo(c.lat, c.lng, 19);
          window.StreetViewPanel.show(c.lat, c.lng);
        },
      });
    });

    // Zoom to fit all candidates
    window.MapController.fitBounds(candidates.map(c => ({ lat: c.lat, lng: c.lng })), 100);

    // Show aerial panel
    if (candidates.length > 0) {
      const centerLat = candidates.reduce((s, c) => s + c.lat, 0) / candidates.length;
      const centerLng = candidates.reduce((s, c) => s + c.lng, 0) / candidates.length;
      window.AerialPanel.show(centerLat, centerLng, 19);
    }

    // Show AI dialog
    window.AIDialog.showT1({
      candidates: candidates,
      address: data.address,
      count: candidates.length,
      decisionTree: area ? area.decision_tree : null,
    });
  }

  function handleT1Demo(scenarioId) {
    const area = getAreaData(scenarioId);
    if (!area || !area.buildings) return;

    const candidates = area.buildings.map(b => ({
      id: b.id,
      nameplate: b.nameplate,
      building_type: b.type,
      floor_count: b.floors,
      lat: b.lat,
      lng: b.lng,
      full_address: b.address ? b.address.full : area.common_address,
      _features: b.features || {},
    }));

    handleT1({
      candidates: candidates,
      address: area.common_address || '',
      count: candidates.length,
    });
  }

  // ════════════════════════════════════════════════════════
  // T2: Address delay
  // ════════════════════════════════════════════════════════
  function checkT2Delayed(result) {
    if (delayTimers.t2) clearTimeout(delayTimers.t2);
    delayTimers.t2 = setTimeout(function() {
      if (!addressConfirmed && callActive) {
        checkT2Now(result);
      }
    }, 15000);
  }

  function checkT2Now(result) {
    if (!result || addressConfirmed) return;

    window.AIDialog.updateAIStatus('analyzing');

    // Build neighbor context
    const area = getAreaData(currentScenario);
    let neighbors = [];
    let pois = [];

    if (area) {
      const allBuildings = area.buildings || [];
      const building = allBuildings.find(b => b.id === result.id);
      if (building && building.features) {
        const feat = building.features;
        if (feat.right && !feat.right.startsWith('(')) {
          neighbors.push({ direction: '玄関の右隣', name: feat.right + 'さん宅', distance_m: 10 });
        }
        if (feat.left && !feat.left.startsWith('(')) {
          neighbors.push({ direction: '玄関の左隣', name: feat.left + 'さん宅', distance_m: 10 });
        }
        if (feat.across && !feat.across.startsWith('(')) {
          neighbors.push({ direction: '道路渡って向かい', name: feat.across, distance_m: 20 });
        }
        if (feat.back && !feat.back.startsWith('(')) {
          neighbors.push({ direction: '裏手', name: feat.back + 'さん宅', distance_m: 15 });
        }
      }
      pois = (area.surrounding_pois || []).map(p => ({
        direction: '道沿い',
        name: p.name,
        distance_m: Math.round(haversine(result.lat, result.lng, p.lat, p.lng)),
      }));
    }

    // Determine confidence
    let confidence = 'medium';
    if (gpsData) {
      const gpsDist = haversine(result.lat, result.lng, gpsData.lat, gpsData.lng);
      if (gpsDist < 50) confidence = 'high';
      else if (gpsDist > 200) confidence = 'low';
    }

    // Generate confirmation question
    let confirmQuestion = '向かいにお店は見えますか？';
    if (neighbors.length > 0) {
      const across = neighbors.find(n => n.direction.includes('向かい'));
      if (across) {
        confirmQuestion = `道路を渡った向かいに${across.name}は見えますか？`;
      }
    }

    window.AIDialog.showT2({
      address: {
        full_address: result.full_address,
        lat: result.lat,
        lng: result.lng,
      },
      neighbors: neighbors.concat(pois),
      confidence: confidence,
      confirmQuestion: confirmQuestion,
    });
  }

  // ════════════════════════════════════════════════════════
  // T3: GPS + no address (road report)
  // ════════════════════════════════════════════════════════
  function checkT3Delayed() {
    if (delayTimers.t3) clearTimeout(delayTimers.t3);
    delayTimers.t3 = setTimeout(function() {
      if (gpsData && searchHistory.length === 0 && !addressConfirmed && callActive) {
        checkT3Now();
      }
    }, 20000);
  }

  function checkT3Now() {
    if (!gpsData || addressConfirmed) return;

    window.AIDialog.updateAIStatus('analyzing');

    const area = getAreaData(currentScenario);
    let landmarks = [];
    let steps = [];

    if (area && area.landmarks) {
      landmarks = area.landmarks.map(lm => ({
        ...lm,
        distance_m: Math.round(haversine(gpsData.lat, gpsData.lng, lm.lat, lm.lng)),
      })).sort((a, b) => a.distance_m - b.distance_m);
    }

    if (area && area.narrowing_steps) {
      steps = area.narrowing_steps.map(s => {
        if (s.dynamic && landmarks.length > 0) {
          return { ...s, question: s.template.replace('{landmark}', landmarks[0].name) };
        }
        return s;
      });
    } else {
      // Default steps
      steps = [
        { step: 1, question: '大きい道路沿いですか？細い道ですか？', options: ['大きい道', '細い道'], purpose: '幹線道路/生活道路の判定' },
        { step: 2, question: '交差点の近くですか？', options: ['はい', 'いいえ'], purpose: '交差点への絞り込み' },
        { step: 3, question: landmarks.length > 0 ? `${landmarks[0].name}は見えますか？` : '近くに目立つ建物は見えますか？', options: ['はい', 'いいえ'], purpose: '具体的なランドマークでの位置確認' },
        { step: 4, question: '一番近い家の表札を読んでいただけますか？', options: ['input'], purpose: '表札から住所を逆引き' },
        { step: 5, question: '近くの電柱に住所が書いてあります。見えますか？', options: ['はい', 'いいえ'], purpose: '電柱記載の住所からの特定' },
      ];
    }

    // Add landmark markers
    landmarks.forEach(lm => {
      const catIcons = {
        intersection: '🚦', convenience_store: '🏪', gas_station: '⛽',
        park: '🌳', school: '🏫', temple_shrine: '⛩', default: '📍'
      };
      window.MapController.addMarker(lm.lat, lm.lng, {
        className: 'landmark',
        label: catIcons[lm.category] || catIcons.default,
        title: `${lm.name} (${lm.distance_m}m)`,
        onClick: function() {
          window.MapController.flyTo(lm.lat, lm.lng, 18);
          window.StreetViewPanel.show(lm.lat, lm.lng);
        },
      });
    });

    // Show streetview
    window.StreetViewPanel.show(gpsData.lat, gpsData.lng);

    // Show AI dialog
    window.AIDialog.showT3({
      gps: gpsData,
      landmarks: landmarks.slice(0, 8),
      narrowingSteps: steps,
    });
  }

  function handleT3Demo(scenarioId) {
    const area = getAreaData(scenarioId);
    if (!area || !area.gps_simulation) return;

    const gps = area.gps_simulation.reported_gps;
    gpsData = { lat: gps.lat, lng: gps.lng, accuracy_m: gps.accuracy_m };

    // Simulate GPS received
    window.MapController.flyTo(gps.lat, gps.lng, 17);
    window.MapController.showGPSCircle(gps.lat, gps.lng, gps.accuracy_m);
    window.MapController.addMarker(gps.lat, gps.lng, {
      className: 'gps',
      label: '📡',
      title: `GPS (±${gps.accuracy_m}m)`,
    });
    updateGPSIndicator(gps.accuracy_m);

    checkT3Now();
  }

  // ════════════════════════════════════════════════════════
  // T4: No DB hit
  // ════════════════════════════════════════════════════════
  function handleT4(data) {
    window.AIDialog.updateAIStatus('analyzing');

    const area = getAreaData(currentScenario);

    // For demo, use scenario-specific external results
    if (area && area.scenario) {
      const sc = area.scenario;
      window.AIDialog.showT4({
        query: data.query || sc.search_query || sc.caller_says,
        externalResults: sc.external_result ? [sc.external_result] : [],
        tenants: sc.tenants || [],
        localDbInfo: sc.local_db || null,
      });

      // Add marker for external result
      if (sc.external_result) {
        window.MapController.clearMarkers();
        window.MapController.addMarker(sc.external_result.lat, sc.external_result.lng, {
          className: 'search-result',
          label: '🔍',
          title: sc.external_result.name,
        });
        window.MapController.flyTo(sc.external_result.lat, sc.external_result.lng, 18);
        window.StreetViewPanel.show(sc.external_result.lat, sc.external_result.lng);
      }
    } else {
      window.AIDialog.showT4({
        query: data.query,
        externalResults: [],
        tenants: [],
      });
    }
  }

  function handleT4Demo(scenarioId) {
    const area = getAreaData(scenarioId);
    if (!area || !area.scenario) return;

    const sc = area.scenario;
    handleT4({ query: sc.caller_says || sc.search_query });
  }

  // ════════════════════════════════════════════════════════
  // T6: Similar names
  // ════════════════════════════════════════════════════════
  function handleT6(data) {
    window.AIDialog.updateAIStatus('analyzing');

    const area = getAreaData(currentScenario);
    const candidates = data.candidates || [];

    window.MapController.clearMarkers();
    candidates.forEach((c, i) => {
      window.MapController.addMarker(c.lat, c.lng, {
        className: 'candidate',
        label: String(i + 1),
        title: c.building_name || c.name || '',
      });
    });

    if (candidates.length > 0) {
      window.MapController.fitBounds(candidates.map(c => ({ lat: c.lat, lng: c.lng })), 80);

      const centerLat = candidates.reduce((s, c) => s + c.lat, 0) / candidates.length;
      const centerLng = candidates.reduce((s, c) => s + c.lng, 0) / candidates.length;
      window.AerialPanel.show(centerLat, centerLng, 16);
    }

    window.AIDialog.showT6({
      candidates: candidates,
      count: candidates.length,
      common_prefix: data.common_prefix,
      decisionTree: area ? area.decision_tree : null,
    });
  }

  function handleT6Demo(scenarioId) {
    const area = getAreaData(scenarioId);
    if (!area || !area.mansions) return;

    const candidates = area.mansions.map(m => ({
      id: m.id,
      name: m.name,
      building_name: m.name,
      full_address: m.full_address || m.address,
      address: m.address,
      lat: m.lat,
      lng: m.lng,
      floor_count: m.floors,
      units: m.units,
      features: m.features || [],
      distinguishing: m.distinguishing || '',
    }));

    currentScenario = scenarioId;

    window.MapController.clearMarkers();
    candidates.forEach((c, i) => {
      window.MapController.addMarker(c.lat, c.lng, {
        className: 'candidate',
        label: String(i + 1),
        title: c.name,
      });
    });

    window.MapController.fitBounds(candidates.map(c => ({ lat: c.lat, lng: c.lng })), 80);

    const centerLat = candidates.reduce((s, c) => s + c.lat, 0) / candidates.length;
    const centerLng = candidates.reduce((s, c) => s + c.lng, 0) / candidates.length;
    window.AerialPanel.show(centerLat, centerLng, 16);

    window.AIDialog.showT6({
      candidates: candidates,
      count: candidates.length,
      common_prefix: 'ライオンズマンション鎌ケ谷',
      decisionTree: area.decision_tree || null,
    });
  }

  // ════════════════════════════════════════════════════════
  // Candidate confirmed
  // ════════════════════════════════════════════════════════
  function handleCandidateConfirmed(id) {
    // Look up candidate info and confirm
    const area = getAreaData(currentScenario);
    if (!area) return;

    let address = null;
    if (area.buildings) {
      const bld = area.buildings.find(b => b.id === id);
      if (bld) address = bld.address ? bld.address.full : '';
    }
    if (area.mansions) {
      const m = area.mansions.find(m => m.id === id);
      if (m) address = m.full_address || m.address;
    }

    if (address) {
      window.MapController.confirmAddress(address);
    }
  }

  function handleCandidateIdentified(id, label) {
    // Find the marker and highlight it
    const area = getAreaData(currentScenario);
    if (!area) return;

    let target = null;
    if (area.buildings) {
      target = area.buildings.find(b => b.id === id);
    }
    if (!target && area.mansions) {
      target = area.mansions.find(m => m.id === id);
    }

    if (target) {
      window.MapController.addMarker(target.lat, target.lng, {
        className: 'confirmed',
        label: '✓',
        title: label || '特定完了',
      });
      window.MapController.flyTo(target.lat, target.lng, 19);
      window.StreetViewPanel.show(target.lat, target.lng);
    }
  }

  // ════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════
  function getAreaData(scenarioId) {
    if (!demoData || !demoData.areas) return null;
    return demoData.areas[scenarioId] || null;
  }

  function clearAllTimers() {
    Object.values(delayTimers).forEach(t => clearTimeout(t));
    delayTimers = {};
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // ── UI Updates ──
  let timerInterval = null;

  function startTimer() {
    const el = document.getElementById('call-timer');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function() {
      if (!callStartTime) return;
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('call-timer').textContent = '00:00';
  }

  function updateCallStatus(status, text) {
    const el = document.getElementById('call-status');
    el.className = 'status-badge ' + status;
    el.textContent = text;
  }

  function updateGPSIndicator(accuracy) {
    const el = document.getElementById('gps-indicator');
    if (accuracy === null || accuracy === undefined) {
      el.className = 'gps-badge none';
      el.textContent = 'GPS: --';
    } else if (accuracy <= 50) {
      el.className = 'gps-badge high';
      el.textContent = `GPS: ±${accuracy}m (高精度)`;
    } else if (accuracy <= 200) {
      el.className = 'gps-badge medium';
      el.textContent = `GPS: ±${accuracy}m`;
    } else {
      el.className = 'gps-badge low';
      el.textContent = `GPS: ±${accuracy}m (低精度)`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { checkT3Now };
})();
