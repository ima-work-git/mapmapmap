/**
 * Demo Simulator - Control panel for simulating 119 call scenarios
 */
window.DemoSimulator = (function() {
  let demoData = null;
  let callActive = false;

  function init() {
    // Load demo data
    fetch('/api/demo_data')
      .then(r => r.json())
      .then(data => { demoData = data; });

    // ── Button handlers ──

    document.getElementById('demo-start').addEventListener('click', startCall);
    document.getElementById('demo-end').addEventListener('click', endCall);
    document.getElementById('demo-gps').addEventListener('click', sendGPS);
    document.getElementById('demo-search').addEventListener('click', simulateSearch);
    document.getElementById('demo-skip15').addEventListener('click', function() { skipTime(15); });
    document.getElementById('demo-skip20').addEventListener('click', function() { skipTime(20); });

    // Scenario selector change
    document.getElementById('demo-scenario').addEventListener('change', function() {
      if (!callActive) {
        const sc = this.value;
        const area = getArea(sc);
        if (area && area.center) {
          window.MapController.flyTo(area.center[1], area.center[0], 15);
        }
      }
    });

    // Listen for call events to update button states
    window.EventBus.on('call_started', function() {
      callActive = true;
      updateButtons(true);
      updateStatus('通報受付中');
    });

    window.EventBus.on('call_ended', function() {
      callActive = false;
      updateButtons(false);
      updateStatus('デモモード: 待機中');
    });

    window.EventBus.on('address_confirmed', function(data) {
      const addr = data.address ? data.address.full_address : '(住所)';
      updateStatus(`確定: ${addr}`);
    });
  }

  function startCall() {
    const scenario = document.getElementById('demo-scenario').value;

    fetch('/api/demo/start_call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenario }),
    }).then(r => r.json())
      .then(data => {
        if (data.ok) {
          // Clear map
          window.MapController.clearMarkers();
          window.MapController.clearGPSCircle();
          window.AIDialog.hide();

          // Navigate to scenario area
          const area = getArea(scenario);
          if (area && area.center) {
            window.MapController.flyTo(area.center[1], area.center[0], 15);
          }

          updateStatus(`シナリオ: ${getScenarioLabel(scenario)} - 通報受付中`);
        }
      });
  }

  function endCall() {
    fetch('/api/demo/end_call', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          window.AerialPanel.hide();
          window.StreetViewPanel.hide();
        }
      });
  }

  function sendGPS() {
    const scenario = document.getElementById('demo-scenario').value;
    const area = getArea(scenario);

    let gps = null;

    if (scenario === 'area_b' && area && area.gps_simulation) {
      gps = area.gps_simulation.reported_gps;
    } else if (area && area.center) {
      // Use center of area with some simulated inaccuracy
      gps = {
        lat: area.center[1] + (Math.random() - 0.5) * 0.001,
        lng: area.center[0] + (Math.random() - 0.5) * 0.001,
        accuracy_m: 100 + Math.floor(Math.random() * 100),
      };
    }

    if (gps) {
      fetch('/api/demo/send_gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gps),
      });
      updateStatus(`GPS送信: ±${gps.accuracy_m}m`);
    }
  }

  function simulateSearch() {
    const scenario = document.getElementById('demo-scenario').value;

    // Each scenario triggers a different search behavior
    switch(scenario) {
      case 'area_a':
        // T1: Same-address multi-hit
        window.EventBus.emit('demo_trigger_t1', { scenario: 'area_a' });
        updateStatus('検索シミュレート: 同一番地複数ヒット (T1)');
        break;

      case 'area_b':
        // T3: GPS + no address
        window.EventBus.emit('demo_trigger_t3', { scenario: 'area_b' });
        updateStatus('検索シミュレート: 路上通報GPS (T3)');
        break;

      case 'area_c':
        // T4: No DB hit
        window.EventBus.emit('demo_trigger_t4', { scenario: 'area_c' });
        updateStatus('検索シミュレート: DB該当なし (T4)');
        break;

      case 'area_d':
        // T6: Similar names
        window.EventBus.emit('demo_trigger_t6', { scenario: 'area_d' });
        updateStatus('検索シミュレート: 類似名称 (T6)');
        break;
    }
  }

  function skipTime(seconds) {
    window.EventBus.emit('demo_skip_time', { seconds: seconds });
    updateStatus(`+${seconds}秒スキップ`);
  }

  function updateButtons(active) {
    document.getElementById('demo-start').disabled = active;
    document.getElementById('demo-end').disabled = !active;
    document.getElementById('demo-gps').disabled = !active;
    document.getElementById('demo-search').disabled = !active;
    document.getElementById('demo-skip15').disabled = !active;
    document.getElementById('demo-skip20').disabled = !active;
    document.getElementById('demo-scenario').disabled = active;
  }

  function updateStatus(text) {
    document.getElementById('demo-status').textContent = text;
  }

  function getArea(scenarioId) {
    if (!demoData || !demoData.areas) return null;
    return demoData.areas[scenarioId] || null;
  }

  function getScenarioLabel(id) {
    const labels = {
      area_a: 'A: 同一番地密集',
      area_b: 'B: 路上通報',
      area_c: 'C: テナント変更',
      area_d: 'D: 類似マンション',
    };
    return labels[id] || id;
  }

  document.addEventListener('DOMContentLoaded', init);

  return {};
})();
