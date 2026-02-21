/**
 * Address Search Bar - Incremental search with multiple result types
 */
window.SearchBar = (function() {
  let searchTimeout = null;
  let lastQuery = '';

  function init() {
    const input = document.getElementById('search-input');
    const clear = document.getElementById('search-clear');
    const results = document.getElementById('search-results');

    input.addEventListener('input', function() {
      const q = this.value.trim();

      if (q.length === 0) {
        hideResults();
        clear.classList.add('hidden');
        lastQuery = '';
        return;
      }

      clear.classList.remove('hidden');

      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        if (q !== lastQuery) {
          lastQuery = q;
          performSearch(q);
        }
      }, 200);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        hideResults();
        this.blur();
      }
    });

    clear.addEventListener('click', function() {
      input.value = '';
      hideResults();
      clear.classList.add('hidden');
      lastQuery = '';
      input.focus();
    });

    // Close results on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#search-container')) {
        hideResults();
      }
    });
  }

  function performSearch(query) {
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        renderResults(data.results || [], query);
        // Also emit for trigger evaluation
        if (data.results) {
          window.EventBus.emit('local_search', {
            query: query,
            results: data.results,
            count: data.count || data.results.length,
          });
        }
      })
      .catch(err => console.error('Search error:', err));
  }

  function renderResults(results, query) {
    const container = document.getElementById('search-results');

    if (results.length === 0) {
      container.innerHTML = `
        <div class="search-result-item" style="justify-content:center;color:#95a5a6;cursor:default">
          「${escapeHtml(query)}」に一致する結果がありません
        </div>
      `;
      container.classList.remove('hidden');

      // Emit no-hit event for T4 trigger
      window.EventBus.emit('search_no_hit', { query: query });
      return;
    }

    container.innerHTML = results.map((r, i) => {
      const icon = getResultIcon(r.type);
      const main = getResultMain(r);
      const sub = getResultSub(r);
      const badge = getResultBadge(r);

      return `
        <div class="search-result-item" data-index="${i}" data-lat="${r.lat}" data-lng="${r.lng}"
             data-id="${r.id}" data-type="${r.type}" data-area="${r.area_id || ''}">
          <div class="result-icon ${r.type}">${icon}</div>
          <div class="result-text">
            <div class="result-main">${main}</div>
            <div class="result-sub">${sub}</div>
          </div>
          ${badge ? `<span class="result-badge">${badge}</span>` : ''}
        </div>
      `;
    }).join('');

    container.classList.remove('hidden');

    // Add click handlers
    container.querySelectorAll('.search-result-item[data-lat]').forEach(item => {
      item.addEventListener('click', function() {
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        const id = this.dataset.id;
        const type = this.dataset.type;
        const areaId = this.dataset.area;

        window.MapController.flyTo(lat, lng, 18);
        hideResults();

        // Emit selection event
        window.EventBus.emit('search_selected', {
          id, type, lat, lng, area_id: areaId,
          result: results[parseInt(this.dataset.index)],
        });
      });
    });

    // Check for same-banchi multi-hit (T1 trigger)
    checkMultiHit(results, query);
    // Check for similar names (T6 trigger)
    checkSimilarNames(results, query);
  }

  function checkMultiHit(results, query) {
    // Group by full address (same banchi)
    const addrResults = results.filter(r => r.type === 'address');
    const byAddress = {};
    addrResults.forEach(r => {
      const key = r.full_address;
      if (!byAddress[key]) byAddress[key] = [];
      byAddress[key].push(r);
    });

    for (const [addr, group] of Object.entries(byAddress)) {
      if (group.length >= 2) {
        window.EventBus.emit('multi_hit_same_address', {
          query: query,
          address: addr,
          candidates: group,
          count: group.length,
        });
      }
    }
  }

  function checkSimilarNames(results, query) {
    const addrResults = results.filter(r => r.type === 'address' && r.building_name);
    if (addrResults.length >= 2) {
      // Check if names are similar (share prefix)
      const names = addrResults.map(r => r.building_name);
      const prefix = commonPrefix(names);
      if (prefix.length >= 3) {
        window.EventBus.emit('similar_names_hit', {
          query: query,
          candidates: addrResults,
          count: addrResults.length,
          common_prefix: prefix,
        });
      }
    }
  }

  function commonPrefix(strs) {
    if (strs.length === 0) return '';
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  function hideResults() {
    document.getElementById('search-results').classList.add('hidden');
  }

  function getResultIcon(type) {
    switch(type) {
      case 'address': return '&#127968;';
      case 'nameplate': return '&#128221;';
      case 'poi': return '&#128205;';
      default: return '&#128269;';
    }
  }

  function getResultMain(r) {
    switch(r.type) {
      case 'address':
        return r.building_name
          ? `${escapeHtml(r.building_name)} (${escapeHtml(r.full_address)})`
          : escapeHtml(r.full_address);
      case 'nameplate':
        return `${escapeHtml(r.nameplate)} 宅`;
      case 'poi':
        return escapeHtml(r.name);
      default:
        return escapeHtml(r.name || r.full_address || '');
    }
  }

  function getResultSub(r) {
    switch(r.type) {
      case 'address':
        const parts = [];
        if (r.nameplate) parts.push(`表札: ${r.nameplate}`);
        if (r.building_type) parts.push(window.MapController.getBuildingTypeLabel(r.building_type));
        if (r.floor_count) parts.push(`${r.floor_count}階建て`);
        return parts.join(' / ');
      case 'nameplate':
        return escapeHtml(r.full_address);
      case 'poi':
        return r.address ? escapeHtml(r.address) : '';
      default:
        return '';
    }
  }

  function getResultBadge(r) {
    if (r.distance_m !== undefined) return `${r.distance_m}m`;
    return null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function setQuery(text) {
    document.getElementById('search-input').value = text;
    if (text) {
      document.getElementById('search-clear').classList.remove('hidden');
      performSearch(text);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { setQuery, performSearch, hideResults };
})();
