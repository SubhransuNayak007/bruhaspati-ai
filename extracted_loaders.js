// === showToast ===
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(99,102,241,0.9); color: white; padding: 10px 20px;
      border-radius: 999px; font-size: 13px; font-weight: 500; z-index: 200;
      backdrop-filter: blur(8px); transition: opacity 0.3s ease;
      font-family: 'Inter', sans-serif; letter-spacing: 0.3px;
      box-shadow: 0 4px 16px rgba(99,102,241,0.4);
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// === showTypingLoader ===
function showTypingLoader(cardId, container) {
  container.innerHTML = `
    <div class="typing-bubble" id="${cardId}_loader">
      <div class="tbdot"></div>
      <div class="tbdot"></div>
      <div class="tbdot"></div>
    </div>
  `;
}

// === showAutocompleteSuggestions ===
function showAutocompleteSuggestions(query) {
  const input = document.getElementById('quickActionTopic');
  const popup = document.getElementById('autocompletePopup');
  if (!input || !popup) return;
  
  if (query.length < 2) {
    hideAutocomplete();
    return;
  }
  
  const board = state.board;
  const classVal = document.getElementById('quickActionClass').value;
  const subject = document.getElementById('quickActionSubject').value;
  
  let chapters = [];
  if (CHAPTERS_DB[board] && CHAPTERS_DB[board][classVal] && CHAPTERS_DB[board][classVal][subject]) {
    chapters = CHAPTERS_DB[board][classVal][subject];
  } else if (ENTRANCE_CHAPTERS[board]) {
    chapters = ENTRANCE_CHAPTERS[board];
  } else {
    // Collect unique chapters across everything as fallback
    for (let b in CHAPTERS_DB) {
      for (let c in CHAPTERS_DB[b]) {
        for (let s in CHAPTERS_DB[b][c]) {
          chapters = chapters.concat(CHAPTERS_DB[b][c][s]);
        }
      }
    }
    chapters = Array.from(new Set(chapters));
  }
  
  let matches = chapters.filter(ch => ch.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  if (matches.length === 0) {
    hideAutocomplete();
    return;
  }
  
  popup.innerHTML = matches.map((m, idx) => `
    <div class="autocomplete-item ${idx === 0 ? 'selected' : ''}" onclick="selectAutocompleteItem('${escapeAttr(m)}')">${escapeHtml(m)}</div>
  `).join('');
  
  const rect = input.getBoundingClientRect();
  popup.style.top = (rect.bottom + window.scrollY) + 'px';
  popup.style.left = (rect.left + window.scrollX) + 'px';
  popup.style.width = rect.width + 'px';
  popup.style.display = 'block';
}

// === showMandalaLoader ===
function showMandalaLoader(cardId, container, subject) {
  container.innerHTML = `
    <div class="mandala-loader-container" id="${cardId}_loader">
      <div class="mandala-loader">
        <div class="orbit orbit-1"><div class="orbit-node"></div></div>
        <div class="orbit orbit-2"><div class="orbit-node orbit-node-blue"></div></div>
        <div class="orbit orbit-3"><div class="orbit-node"></div></div>
        <div class="mandala-center"></div>
      </div>
      <div class="mandala-status">Generating ${subject !== 'All' ? subject : 'Tutor'} Resource...</div>
    </div>
  `;
}

// === showPremiumLoader ===
function showPremiumLoader(cardId, container, subject) {
  if (activeLoaderIntervals[cardId]) clearInterval(activeLoaderIntervals[cardId]);
  if (activeLoaderCleanups[cardId]) activeLoaderCleanups[cardId]();
  
  const canvasId = `${cardId}_canvas`;
  
  container.innerHTML = `
    <div class="premium-loader-card" id="${cardId}_loader">
      <canvas class="loader-bg-particles" id="${canvasId}"></canvas>
      <div class="loader-glass-card">
        <div class="loader-badge">
          <span class="loader-badge-dot"></span>
          <span class="loader-badge-text">Bruhaspati AI ${subject !== 'All' ? `• ${subject}` : ''}</span>
        </div>
        
        <div class="lotus-emblem-container">
          <div class="lotus-glowing-halo"></div>
          <div class="lotus-orbiting-ring" id="${cardId}_orbitRing"></div>
          <div class="loader-logo-sprite" id="${cardId}_loaderLogo"></div>
        </div>
        
        <div class="loader-status" id="${cardId}_status">Understanding your question...</div>
        
        <div class="loader-progress-container">
          <div class="loader-progress-info">
            <span>Progress</span>
            <span id="${cardId}_percent">0%</span>
          </div>
          <div class="loader-progress-bg">
            <div class="loader-progress-fill" id="${cardId}_fill" style="width: 0%"></div>
          </div>
        </div>
        
        <div class="loader-footer">
          <div class="loader-wait-time">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Est. Wait: <strong id="${cardId}_estTime">4s</strong></span>
          </div>
          <div class="loader-gpu-status">
            <span class="loader-gpu-dot"></span>
            <span>GPU Acceleration Active</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const cardEl = document.getElementById(`${cardId}_loader`);
  if (cardEl) {
    const petals = cardEl.querySelectorAll('.petal-item');
    petals.forEach((p) => {
      const transform = p.getAttribute('transform') || '';
      const match = transform.match(/rotate\(([\d.]+)/);
      if (match) {
        p.style.setProperty('--angle', `${match[1]}deg`);
      }
    });
  }
  
  const canvasCleanup = initBackgroundParticles(canvasId, subject);
  activeLoaderCleanups[cardId] = canvasCleanup;
  
  const states = [
    { name: 'UNDERSTANDING_QUESTION', title: 'Understanding your question...', duration: 500, prgStart: 0, prgEnd: 20, class: 'state-understand' },
    { name: 'ANALYZING_CONCEPT', title: 'Analyzing concepts and exam patterns...', duration: 600, prgStart: 20, prgEnd: 45, class: 'state-concept' },
    { name: 'SEARCHING_KNOWLEDGE', title: 'Connecting NCERT, PYQs, and expert knowledge...', duration: 800, prgStart: 45, prgEnd: 75, class: 'state-knowledge' },
    { name: 'GENERATING_ANSWER', title: 'Preparing structured explanation...', duration: 1000, prgStart: 75, prgEnd: 95, class: 'state-generate' },
    { name: 'FINALIZING', title: 'Finalizing answer...', duration: 600, prgStart: 95, prgEnd: 99, class: 'state-finalizing' }
  ];
  
  const totalDuration = states.reduce((sum, s) => sum + s.duration, 0);
  const startTime = Date.now();
  
  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    
    let stateIdx = 0;
    let accum = 0;
    for (let i = 0; i < states.length; i++) {
      accum += states[i].duration;
      if (elapsed <= accum) {
        stateIdx = i;
        break;
      }
      stateIdx = states.length - 1;
    }
    
    const activeState = states[stateIdx];
    
    const prevAccum = states.slice(0, stateIdx).reduce((sum, s) => sum + s.duration, 0);
    const stateElapsed = elapsed - prevAccum;
    const ratio = Math.min(stateElapsed / activeState.duration, 1);
    const progress = activeState.prgStart + (activeState.prgEnd - activeState.prgStart) * ratio;
    const progressInt = Math.min(99, Math.round(progress));
    
    const statusEl = document.getElementById(`${cardId}_status`);
    const percentEl = document.getElementById(`${cardId}_percent`);
    const fillEl = document.getElementById(`${cardId}_fill`);
    const estTimeEl = document.getElementById(`${cardId}_estTime`);
    
    if (statusEl) statusEl.textContent = activeState.title;
    if (percentEl) percentEl.textContent = `${progressInt}%`;
    if (fillEl) fillEl.style.width = `${progressInt}%`;
    
    const remSeconds = Math.max(0, Math.ceil((totalDuration - elapsed) / 1000));
    if (estTimeEl) estTimeEl.textContent = `${remSeconds}s`;
    
    if (cardEl) {
      states.forEach(s => {
        if (s.class !== activeState.class) cardEl.classList.remove(s.class);
      });
      cardEl.classList.add(activeState.class);
    }
    
    if (elapsed >= totalDuration) {
      clearInterval(timer);
    }
  }, 100);
  
  activeLoaderIntervals[cardId] = timer;
}



// --- GENERAL LOADER LINES ---
Line 13: isTyping: false,
Line 865: showMandalaLoader(cardId, aiContent, state.subject);
Line 867: showTypingLoader(cardId, aiContent);
Line 1087: if (!activeBubble) activeBubble = document.getElementById(cardId + '_loader');
Line 1137: // Clean up active loader timers
Line 1138: if (activeLoaderIntervals[cardId]) {
Line 1139: clearInterval(activeLoaderIntervals[cardId]);
Line 1140: delete activeLoaderIntervals[cardId];
Line 1142: if (activeLoaderCleanups[cardId]) {
Line 1143: activeLoaderCleanups[cardId]();
Line 1144: delete activeLoaderCleanups[cardId];
Line 1164: // If the premium loader is already rendered, do not overwrite it with the skeleton loader
Line 1165: if (!document.getElementById(cardId + '_loader')) {
Line 1167: <div class="response-card skeleton-card" id="${cardId}">
Line 1168: <div class="skeleton-line" style="width: 45%"></div>
Line 1169: <div class="skeleton-line" style="width: 90%"></div>
Line 1170: <div class="skeleton-line" style="width: 75%"></div>
Line 1171: <div class="skeleton-line" style="width: 60%"></div>
Line 2642: if (!query || state.isTyping) return;
Line 2687: <div class="response-card skeleton-card" id="${streamCardId}">
Line 2688: <div class="skeleton-line" style="width: 40%"></div>
Line 2689: <div class="skeleton-line" style="width: 90%"></div>
Line 2690: <div class="skeleton-line" style="width: 75%"></div>
Line 2691: <div class="skeleton-line" style="width: 60%"></div>
Line 2699: state.isTyping = true;
Line 2712: state.isTyping = false;
Line 2724: state.isTyping = true;
Line 2730: state.isTyping = false;
Line 3382: // PREMIUM DYNAMIC LOADER ENGINE
Line 3384: let activeLoaderIntervals = {};
Line 3385: let activeLoaderCleanups = {};
Line 3584: function showPremiumLoader(cardId, container, subject) {
Line 3585: if (activeLoaderIntervals[cardId]) clearInterval(activeLoaderIntervals[cardId]);
Line 3586: if (activeLoaderCleanups[cardId]) activeLoaderCleanups[cardId]();
Line 3591: <div class="premium-loader-card" id="${cardId}_loader">
Line 3592: <canvas class="loader-bg-particles" id="${canvasId}"></canvas>
Line 3593: <div class="loader-glass-card">
Line 3594: <div class="loader-badge">
Line 3595: <span class="loader-badge-dot"></span>
Line 3596: <span class="loader-badge-text">Bruhaspati AI ${subject !== 'All' ? `• ${subject}` : ''}</span>
Line 3602: <div class="loader-logo-sprite" id="${cardId}_loaderLogo"></div>
Line 3605: <div class="loader-status" id="${cardId}_status">Understanding your question...</div>
Line 3607: <div class="loader-progress-container">
Line 3608: <div class="loader-progress-info">
Line 3612: <div class="loader-progress-bg">
Line 3613: <div class="loader-progress-fill" id="${cardId}_fill" style="width: 0%"></div>
Line 3617: <div class="loader-footer">
Line 3618: <div class="loader-wait-time">
Line 3625: <div class="loader-gpu-status">
Line 3626: <span class="loader-gpu-dot"></span>
Line 3634: const cardEl = document.getElementById(`${cardId}_loader`);
Line 3647: activeLoaderCleanups[cardId] = canvasCleanup;
Line 3706: activeLoaderIntervals[cardId] = timer;
Line 3709: // Sleek Inline Typing Bubble Loader
Line 3710: function showTypingLoader(cardId, container) {
Line 3712: <div class="typing-bubble" id="${cardId}_loader">
Line 3720: // Premium Mandala Orbit Loader (Deep Thinking)
Line 3721: function showMandalaLoader(cardId, container, subject) {
Line 3723: <div class="mandala-loader-container" id="${cardId}_loader">
Line 3724: <div class="mandala-loader">