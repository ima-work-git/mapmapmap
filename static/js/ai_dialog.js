/**
 * AI Dialog Panel - Main support panel display controller
 */
window.AIDialog = (function() {
  let autoHideTimeout = null;
  let currentTrigger = null;

  function init() {
    document.getElementById('ai-dialog-close').addEventListener('click', hide);
  }

  function show(trigger, config) {
    currentTrigger = trigger;
    const dialog = document.getElementById('ai-dialog');
    const title = document.getElementById('ai-dialog-title');
    const subtitle = document.getElementById('ai-dialog-subtitle');
    const body = document.getElementById('ai-dialog-body');

    // Set border color
    dialog.style.borderLeftColor = config.color || '#c0392b';

    // Set icon
    const iconEl = dialog.querySelector('.ai-dialog-icon');
    iconEl.style.background = config.color || '#c0392b';
    iconEl.textContent = config.iconText || 'AI';

    title.textContent = config.title || 'AI支援';
    subtitle.textContent = config.subtitle || '';
    body.innerHTML = config.bodyHtml || '';

    // Show with animation
    dialog.classList.remove('hidden');
    requestAnimationFrame(() => {
      dialog.classList.add('visible');
    });

    // Update AI status
    updateAIStatus('suggesting');

    // Clear any auto-hide timer
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
  }

  function hide() {
    const dialog = document.getElementById('ai-dialog');
    dialog.classList.remove('visible');
    setTimeout(() => {
      dialog.classList.add('hidden');
    }, 250);
    currentTrigger = null;
    updateAIStatus('idle');
  }

  function autoHideAfter(ms) {
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
    autoHideTimeout = setTimeout(hide, ms);
  }

  function updateAIStatus(status) {
    const badge = document.getElementById('ai-status');
    badge.className = 'ai-badge ' + status;
    switch(status) {
      case 'idle': badge.textContent = 'AI: 待機中'; break;
      case 'analyzing': badge.textContent = 'AI: 解析中'; break;
      case 'suggesting': badge.textContent = 'AI: 提案あり'; break;
    }
  }

  function getCurrentTrigger() { return currentTrigger; }

  // ════════════════════════════════════════════════════════
  // T1: Same-address multiple hits
  // ════════════════════════════════════════════════════════
  function showT1(data) {
    const candidates = data.candidates || [];
    const address = data.address || '';
    const count = candidates.length;

    // Build candidate list HTML
    const labels = ['❶','❷','❸','❹','❺','❻','❼','❽'];
    let candidateHtml = candidates.map((c, i) => {
      const features = c._features || {};
      const typeLabel = window.MapController.getBuildingTypeLabel(c.building_type);
      const floorStr = c.floor_count ? `${c.floor_count}階建て` : '';

      return `
        <div class="candidate-item" data-id="${c.id}" data-lat="${c.lat}" data-lng="${c.lng}">
          <div>
            <span class="candidate-number">${i + 1}</span>
            <span class="candidate-name">${escHtml(c.nameplate || c.building_name || '')}宅</span>
          </div>
          <div class="candidate-feature">${escHtml(features.position || '')}</div>
          <div class="candidate-type">${typeLabel}${floorStr ? ' ' + floorStr : ''}</div>
        </div>
      `;
    }).join('');

    // Build question section
    let questionHtml = '';
    if (data.decisionTree) {
      window.QuestionEngine.setTree(data.decisionTree);
      const q = window.QuestionEngine.getCurrentQuestion();
      if (q) {
        questionHtml = renderQuestion(q);
      }
    }

    // Build streetview thumbnails (for 3 or less)
    let svHtml = '';
    if (candidates.length <= 3) {
      svHtml = `
        <div class="ai-section">
          <div class="ai-section-title">ストリートビュー比較</div>
          <div class="sv-thumbnails">
            ${candidates.map((c, i) => `
              <div class="sv-thumbnail" data-lat="${c.lat}" data-lng="${c.lng}" title="クリックでストリートビュー表示">
                <span class="sv-thumbnail-label">${i + 1}</span>
                <div class="sv-thumbnail-map" id="sv-thumb-${i}"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    show('T1', {
      color: '#c0392b',
      iconText: String(count),
      title: `同番地に${count}軒あります`,
      subtitle: address,
      bodyHtml: `
        <div class="ai-section">
          <div class="ai-section-title">候補一覧</div>
          ${candidateHtml}
        </div>
        ${questionHtml ? `
          <div class="ai-section">
            <div class="ai-section-title">確認質問</div>
            <div id="question-container">${questionHtml}</div>
          </div>
        ` : ''}
        ${svHtml}
      `,
    });

    // Attach candidate click handlers
    document.querySelectorAll('#ai-dialog-body .candidate-item').forEach(item => {
      item.addEventListener('click', function() {
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        const id = this.dataset.id;

        // Highlight selected
        document.querySelectorAll('.candidate-item').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');

        window.MapController.flyTo(lat, lng, 19);
        window.StreetViewPanel.show(lat, lng);
      });
    });

    // Attach question option handlers
    attachQuestionHandlers();

    // Initialize thumbnail maps
    if (candidates.length <= 3) {
      setTimeout(() => initThumbnailMaps(candidates), 300);
    }
  }

  function initThumbnailMaps(candidates) {
    candidates.forEach((c, i) => {
      const container = document.getElementById(`sv-thumb-${i}`);
      if (!container || container.children.length > 0) return;

      try {
        const thumbMap = new maplibregl.Map({
          container: container,
          style: {
            version: 8,
            sources: {
              'gsi': {
                type: 'raster',
                tiles: [window.APP_CONFIG.gsi_aerial_url],
                tileSize: 256,
              }
            },
            layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }]
          },
          center: [c.lng, c.lat],
          zoom: 19,
          interactive: false,
          attributionControl: false,
        });
      } catch(e) { /* thumbnail init failed, ok */ }

      // Click handler for thumbnail
      container.parentElement.addEventListener('click', function() {
        window.StreetViewPanel.show(c.lat, c.lng);
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // T2: Address delay
  // ════════════════════════════════════════════════════════
  function showT2(data) {
    const address = data.address || {};
    const neighbors = data.neighbors || [];
    const pois = data.pois || [];

    // Build context items
    const directionIcons = {
      '向かい': '↑', '右隣': '→', '左隣': '←', '裏手': '↓',
      '道路渡って向かい': '⇑', '道沿い': '↗',
    };

    let contextHtml = '';
    if (neighbors.length > 0) {
      contextHtml = neighbors.map(n => `
        <div class="context-item" data-lat="${n.lat || ''}" data-lng="${n.lng || ''}">
          <span class="context-direction">${directionIcons[n.direction] || '·'}</span>
          <span class="context-position">${escHtml(n.direction)}</span>
          <span class="context-name">${escHtml(n.name)}</span>
          <span class="context-distance">${n.distance_m ? n.distance_m + 'm' : '隣接'}</span>
        </div>
      `).join('');
    }

    // Confidence meter
    const confidence = data.confidence || 'medium';
    const confColors = { high: '#1abc9c', medium: '#e67e22', low: '#c0392b' };
    const confLabels = { high: '確度: 高', medium: '確度: 中', low: '確度: 低' };
    const confWidth = { high: '90%', medium: '55%', low: '25%' };

    // Confirmation question
    const question = data.confirmQuestion || '向かいにお店は見えますか？';

    show('T2', {
      color: '#e67e22',
      iconText: '?',
      title: '周辺情報',
      subtitle: address.full_address || '',
      bodyHtml: `
        ${contextHtml ? `
          <div class="ai-section">
            <div class="ai-section-title">周辺の目印</div>
            ${contextHtml}
          </div>
        ` : ''}
        <div class="ai-section">
          <div class="ai-section-title">確認質問</div>
          <div class="question-box">
            <div class="question-label">💬 確認してみてください</div>
            <div class="question-text">「${escHtml(question)}」</div>
          </div>
        </div>
        <div class="ai-section">
          <div class="confidence-bar">
            <div class="confidence-fill" style="width:${confWidth[confidence]};background:${confColors[confidence]}"></div>
          </div>
          <div class="confidence-label" style="color:${confColors[confidence]}">${confLabels[confidence]}</div>
        </div>
        <button class="confirm-address-btn" onclick="window.MapController.confirmAddress('${escHtml(address.full_address || '')}')">
          この住所で確定
        </button>
      `,
    });

    // Show streetview for the address
    if (address.lat && address.lng) {
      window.StreetViewPanel.show(address.lat, address.lng);
    }
  }

  // ════════════════════════════════════════════════════════
  // T3: GPS + no address (road report)
  // ════════════════════════════════════════════════════════
  function showT3(data) {
    const gps = data.gps || {};
    const landmarks = data.landmarks || [];
    const steps = data.narrowingSteps || [];

    const catIcons = {
      intersection: '🚦', convenience_store: '🏪', gas_station: '⛽',
      bridge: '🌉', park: '🌳', school: '🏫',
      large_building: '🏢', temple_shrine: '⛩', default: '📍'
    };

    let landmarkHtml = landmarks.map(lm => `
      <div class="landmark-item" data-lat="${lm.lat}" data-lng="${lm.lng}" data-name="${escHtml(lm.name)}">
        <span class="landmark-icon">${catIcons[lm.category] || catIcons.default}</span>
        <span class="landmark-name">${escHtml(lm.name)}</span>
        <span class="landmark-distance">${lm.distance_m ? lm.distance_m + 'm' : ''}</span>
      </div>
    `).join('');

    let stepsHtml = steps.map((s, i) => `
      <div class="narrowing-step ${i === 0 ? 'active' : ''}" data-step="${i}">
        <span class="step-number">${i + 1}</span>
        <span style="font-size:11px;color:#7f8c8d">${escHtml(s.purpose || '')}</span>
        <div class="step-question">「${escHtml(s.question || '')}」</div>
        ${s.options ? `
          <div class="step-options">
            ${s.options.map(opt => `
              <button class="step-option-btn" data-step="${i}" data-answer="${escHtml(opt)}">${escHtml(opt)}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    show('T3', {
      color: '#3498db',
      iconText: 'GPS',
      title: '路上通報 — 場所の絞り込み',
      subtitle: `GPS精度: ${gps.accuracy_m || '?'}m`,
      bodyHtml: `
        <div class="ai-section">
          <div class="ai-section-title">周辺の目印（距離順）</div>
          ${landmarkHtml}
        </div>
        <div class="ai-section">
          <div class="ai-section-title">絞り込みフロー</div>
          ${stepsHtml}
        </div>
      `,
    });

    // Attach landmark click handlers
    document.querySelectorAll('.landmark-item').forEach(item => {
      item.addEventListener('click', function() {
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        const name = this.dataset.name;

        window.MapController.flyTo(lat, lng, 18);
        window.StreetViewPanel.show(lat, lng);
      });
    });

    // Attach step option handlers
    document.querySelectorAll('.step-option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const step = parseInt(this.dataset.step);
        const answer = this.dataset.answer;

        // Mark current step as completed
        const stepEl = document.querySelector(`.narrowing-step[data-step="${step}"]`);
        if (stepEl) {
          stepEl.classList.remove('active');
          stepEl.classList.add('completed');
          // Highlight chosen answer
          this.style.background = '#27ae60';
          this.style.color = '#fff';
        }

        // Activate next step
        const nextStep = document.querySelector(`.narrowing-step[data-step="${step + 1}"]`);
        if (nextStep) {
          nextStep.classList.add('active');
        }
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // T4: No DB hit
  // ════════════════════════════════════════════════════════
  function showT4(data) {
    const query = data.query || '';
    const externalResults = data.externalResults || [];
    const tenants = data.tenants || [];
    const localDbInfo = data.localDbInfo || null;

    let resultsHtml = externalResults.map(r => `
      <div class="poi-result-item" data-lat="${r.lat}" data-lng="${r.lng}">
        <div class="poi-result-name">${escHtml(r.name)} <span class="external-badge">外部検索</span></div>
        <div class="poi-result-address">📍 ${escHtml(r.address || r.full_address || '')}</div>
        ${localDbInfo ? `<div style="font-size:11px;color:#7f8c8d;margin-top:4px">消防DB: ${escHtml(localDbInfo.name)} (${localDbInfo.registered || ''})</div>` : ''}
        <div class="poi-result-actions">
          <button class="poi-action-btn" onclick="window.StreetViewPanel.show(${r.lat},${r.lng})">ストリートビューで確認</button>
          <button class="poi-action-btn confirm" onclick="window.MapController.confirmAddress('${escHtml(r.address || r.full_address || '')}')">この住所で確定</button>
        </div>
      </div>
    `).join('');

    let tenantHtml = '';
    if (tenants.length > 0) {
      tenantHtml = `
        <div class="ai-section">
          <div class="ai-section-title">同じビルの情報</div>
          <div class="tenant-list">
            ${tenants.map(t => `
              <div class="tenant-item ${t.name.includes(query) ? 'highlight' : ''}">
                <span class="tenant-floor">${t.floor}F:</span>
                <span class="tenant-name">${escHtml(t.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    show('T4', {
      color: '#8e44ad',
      iconText: '🔍',
      title: 'DB該当なし — 外部検索',
      subtitle: `「${query}」`,
      bodyHtml: `
        <div class="ai-section">
          <div class="ai-section-title">検索結果</div>
          ${resultsHtml || '<div style="color:#95a5a6;font-size:13px;padding:8px">外部検索結果もありません</div>'}
        </div>
        ${tenantHtml}
      `,
    });

    // Click handler for results
    document.querySelectorAll('.poi-result-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        window.MapController.flyTo(lat, lng, 18);
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // T5: Landmark keyword
  // ════════════════════════════════════════════════════════
  function showT5(data) {
    const keyword = data.keyword || '';
    const matches = data.matches || [];

    let matchHtml = matches.map(m => `
      <div class="poi-result-item" data-lat="${m.lat}" data-lng="${m.lng}">
        <div class="poi-result-name">📍 ${escHtml(m.name)} <span style="font-size:12px;color:#95a5a6">${m.distance_m ? m.distance_m + 'm' : ''}</span></div>
        <div class="poi-result-address">${escHtml(m.address || '')}</div>
        <div class="poi-result-actions">
          <button class="poi-action-btn" onclick="window.StreetViewPanel.show(${m.lat},${m.lng})">ストリートビューで確認</button>
          <button class="poi-action-btn confirm" onclick="window.MapController.confirmAddress('${escHtml(m.address || '')}')">この住所で確定</button>
        </div>
      </div>
    `).join('');

    let disambiguationHtml = '';
    if (matches.length >= 2) {
      disambiguationHtml = `
        <div class="ai-section">
          <div class="ai-section-title">確認質問</div>
          <div class="question-box">
            <div class="question-label">💬 同名施設が${matches.length}つあります</div>
            <div class="question-text">「一番近い${escHtml(keyword)}はどちらの方向に見えますか？」</div>
          </div>
        </div>
      `;
    }

    show('T5', {
      color: '#f39c12',
      iconText: '💡',
      title: `「${keyword}」の候補`,
      subtitle: '',
      bodyHtml: `
        <div class="ai-section">
          <div class="ai-section-title">候補施設</div>
          ${matchHtml || '<div style="color:#95a5a6;font-size:13px;padding:8px">該当施設なし</div>'}
        </div>
        ${disambiguationHtml}
      `,
    });

    document.querySelectorAll('.poi-result-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        window.MapController.flyTo(lat, lng, 18);
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // T6: Similar names
  // ════════════════════════════════════════════════════════
  function showT6(data) {
    const candidates = data.candidates || [];
    const count = candidates.length;

    let candidateHtml = candidates.map((c, i) => {
      const features = c.features || [];
      return `
        <div class="candidate-item" data-id="${c.id}" data-lat="${c.lat}" data-lng="${c.lng}">
          <div>
            <span class="candidate-number">${i + 1}</span>
            <span class="candidate-name">${escHtml(c.name || c.building_name || '')}</span>
          </div>
          <div class="candidate-type" style="padding-left:32px">${escHtml(c.full_address || c.address || '')}</div>
          ${c.floor_count ? `<div class="candidate-type" style="padding-left:32px">${c.floor_count}階建て${c.units ? ' / ' + c.units + '戸' : ''}</div>` : ''}
          ${features.length > 0 ? `
            <div class="feature-tags">
              ${features.map(f => `<span class="feature-tag">${escHtml(f)}</span>`).join('')}
            </div>
          ` : ''}
          ${c.distinguishing ? `<div class="candidate-feature">${escHtml(c.distinguishing)}</div>` : ''}
        </div>
      `;
    }).join('');

    let questionHtml = '';
    if (data.decisionTree) {
      window.QuestionEngine.setTree(data.decisionTree);
      const q = window.QuestionEngine.getCurrentQuestion();
      if (q) {
        questionHtml = `
          <div class="ai-section">
            <div class="ai-section-title">確認質問</div>
            <div id="question-container">${renderQuestion(q)}</div>
          </div>
        `;
      }
    }

    show('T6', {
      color: '#2c3e50',
      iconText: '🏢',
      title: `類似名称 ${count}件`,
      subtitle: data.common_prefix ? `「${data.common_prefix}...」` : '',
      bodyHtml: `
        <div class="ai-section">
          <div class="ai-section-title">候補一覧</div>
          ${candidateHtml}
        </div>
        ${questionHtml}
      `,
    });

    // Click handlers
    document.querySelectorAll('#ai-dialog-body .candidate-item').forEach(item => {
      item.addEventListener('click', function() {
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);

        document.querySelectorAll('.candidate-item').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');

        window.MapController.flyTo(lat, lng, 18);
        window.StreetViewPanel.show(lat, lng);
      });
    });

    attachQuestionHandlers();
  }

  // ════════════════════════════════════════════════════════
  // Question rendering helpers
  // ════════════════════════════════════════════════════════
  function renderQuestion(q) {
    if (!q) return '';
    return `
      <div class="question-box">
        <div class="question-label">💬 確認してみてください</div>
        <div class="question-text">「${escHtml(q.question)}」</div>
        <div class="question-options">
          ${q.options.map(opt => `
            <button class="question-option-btn" data-answer="${escHtml(opt.label)}">
              <span class="question-option-arrow">→</span>
              ${escHtml(opt.label)}
              ${opt.resultLabel ? `<span class="question-option-result">${escHtml(opt.resultLabel)}</span>` : ''}
              ${opt.hasNext ? '<span class="question-option-result">→ 次の質問</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function attachQuestionHandlers() {
    document.querySelectorAll('.question-option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const answer = this.dataset.answer;
        const result = window.QuestionEngine.answer(answer);

        if (!result) return;

        const container = document.getElementById('question-container');
        if (!container) return;

        if (result.type === 'result') {
          // Found the answer
          container.innerHTML = `
            <div class="question-box" style="border-color:#d5f5e3;background:#e8f8f5">
              <div class="question-label" style="color:#27ae60">✓ 特定完了</div>
              <div class="question-text" style="color:#27ae60">${escHtml(result.label || result.result)}</div>
              <button class="confirm-address-btn" onclick="window.EventBus.emit('candidate_confirmed', {id:'${result.result}'})">
                この住所で確定
              </button>
            </div>
          `;

          // Highlight the confirmed candidate on map
          window.EventBus.emit('candidate_identified', { id: result.result, label: result.label });

        } else if (result.type === 'question') {
          container.innerHTML = renderQuestion(result.question);
          attachQuestionHandlers();
        }
      });
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { show, hide, autoHideAfter, showT1, showT2, showT3, showT4, showT5, showT6, getCurrentTrigger, updateAIStatus };
})();
