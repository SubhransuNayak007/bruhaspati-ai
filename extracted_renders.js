// === renderPartialText ===
function renderPartialText(text, container, cardId, query, isFinal = false) {
  let parsed = cleanAndParseJSON(text);
  if (!parsed && isFinal) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(repairJSON(jsonMatch[0]));
      } catch (_) {}
    }
  }
  
  if (!parsed) {
    const defMatch = text.match(/"definition"\s*:\s*"([^"]+)"/);
    if (defMatch) {
      parsed = { definition: defMatch[1] };
    }
  }
  
  if (parsed) {
    // Clean up active loader timers
    if (activeLoaderIntervals[cardId]) {
      clearInterval(activeLoaderIntervals[cardId]);
      delete activeLoaderIntervals[cardId];
    }
    if (activeLoaderCleanups[cardId]) {
      activeLoaderCleanups[cardId]();
      delete activeLoaderCleanups[cardId];
    }
    
    parsed._cardId = cardId;
    let html = renderStructuredResponse(parsed, query);
    container.innerHTML = html;
    
    if (isFinal) {
      const chipsHtml = renderFollowUpChips(parsed.followups);
      if (chipsHtml) {
        container.insertAdjacentHTML('beforeend', chipsHtml);
      }
      
      saveAIMessageToState(query, parsed, cardId);
      
      if (parsed.type === 'quiz') {
        startQuizTimer(cardId);
      }
    }
  } else {
    // If the premium loader is already rendered, do not overwrite it with the skeleton loader
    if (!document.getElementById(cardId + '_loader')) {
      container.innerHTML = `
        <div class="response-card skeleton-card" id="${cardId}">
          <div class="skeleton-line" style="width: 45%"></div>
          <div class="skeleton-line" style="width: 90%"></div>
          <div class="skeleton-line" style="width: 75%"></div>
          <div class="skeleton-line" style="width: 60%"></div>
        </div>
      `;
    }
  }
  
  triggerMathJax();
  scrollToBottom();
}

// === renderStructuredResponse ===
function renderStructuredResponse(data, query) {
  const id = data._cardId || ('resp_' + Date.now());
  const speakerBtn = `
    <button class="tts-speak-btn" onclick="speakResponseCard('${id}')" style="position:absolute; top: 12px; right: 12px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; z-index: 5;" title="Listen to explanation">🔊</button>
  `;

  if (data.type === 'pyq') {
    return renderPYQResponse(data, query).replace('class="response-card"', 'class="response-card" style="position:relative;"').replace('</h3>', '</h3>' + speakerBtn);
  }
  if (data.type === 'quiz') {
    return renderQuizCard(data, id);
  }
  if (data.type === 'formula_sheet') {
    return renderFormulaSheetResponse(data, query).replace('class="response-card"', 'class="response-card" style="position:relative;"').replace('</h3>', '</h3>' + speakerBtn);
  }

  // Check new formats
  if (data.essay) {
    // Long Answer
    return `
      <div class="response-card" id="${id}" style="position:relative; animation: slideInLeft 0.35s ease; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 16px;">
          <span class="section-icon">📝</span>
          <span class="resp-section-title" style="color: var(--text-accent);">${data.title || 'Long Essay Answer'}</span>
        </div>
        <div class="resp-section-body" style="font-size: 14.5px; line-height: 1.8; color: var(--text-secondary);">
          ${formatBold(data.essay || '')}
        </div>
        ${data.teacherTip ? `
          <div class="callout callout-emerald" style="margin-top:16px;">
            📌 <strong>Teacher Tip:</strong> ${formatBold(data.teacherTip)}
          </div>
        ` : ''}
        
        
      </div>
    `;
  }
  
  if (data.points) {
    // Quick Summary
    const pointsList = (data.points || []).map(p => `
      <li style="margin-bottom: 8px; list-style-type: decimal; margin-left: 16px;">${formatBold(p)}</li>
    `).join('');
    
    return `
      <div class="response-card" id="${id}" style="position:relative; animation: slideInLeft 0.35s ease; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 12px;">
          <span class="section-icon">⚡</span>
          <span class="resp-section-title" style="color: var(--accent-amber);">Quick Summary — ${data.topic || 'Summary'}</span>
        </div>
        <div class="resp-section-body">
          <ol style="margin-bottom: 12px; color: var(--text-secondary);">${pointsList}</ol>
        </div>
        ${data.teacherTip ? `
          <div class="callout callout-amber" style="margin-top:12px;">
            💡 <strong>Key Tip:</strong> ${formatBold(data.teacherTip)}
          </div>
        ` : ''}
        
        
      </div>
    `;
  }
  
  if (data.modelAnswer) {
    // Exam Focused
    const examRows = (data.examData || []).map(e => {
      const badgeClass = e.exam.includes('CBSE') ? 'badge-cbse' : e.exam.includes('JEE') ? 'badge-jee' : e.exam.includes('NEET') ? 'badge-neet' : 'badge-chse';
      return `
        <tr>
          <td><span class="exam-badge ${badgeClass}">${e.exam}</span></td>
          <td>${e.years}</td>
          <td>${e.marks}</td>
          <td><span class="freq-high">🔴 HIGH</span></td>
        </tr>
      `;
    }).join('');

    const kwChips = (data.keywords || []).map(k => `<span class="keyword-chip" style="background:rgba(244,63,94,0.1); border-color:rgba(244,63,94,0.25); color:#fda4af;">${k}</span>`).join('');

    return `
      <div class="response-card" id="${id}" style="position:relative; animation: slideInLeft 0.35s ease;">
        ${speakerBtn}
        
        <!-- Header -->
        <div class="resp-section" style="background: rgba(244,63,94,0.02);">
          <div class="resp-section-header">
            <span class="section-icon">🎯</span>
            <span class="resp-section-title" style="color: var(--accent-rose);">Exam-Focused Revision — ${data.topic || 'Topic'}</span>
          </div>
        </div>
        
        <!-- Exam History -->
        ${examRows ? `
          <div class="resp-section">
            <div class="resp-section-header">
              <span class="section-icon">📊</span>
              <span class="resp-section-title" style="color: var(--text-secondary);">Board Frequency</span>
            </div>
            <table class="exam-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Years</th>
                  <th>Marks</th>
                  <th>Frequency</th>
                </tr>
              </thead>
              <tbody>${examRows}</tbody>
            </table>
          </div>
        ` : ''}
        
        <!-- Keywords -->
        ${kwChips ? `
          <div class="resp-section">
            <div class="resp-section-header">
              <span class="section-icon">✅</span>
              <span class="resp-section-title" style="color:#fda4af;">Keywords Required for Marks</span>
            </div>
            <div class="keyword-chips">${kwChips}</div>
          </div>
        ` : ''}

        <!-- Common Mistakes -->
        ${data.commonMistakes ? `
          <div class="resp-section">
            <div class="resp-section-header">
              <span class="section-icon">⚠️</span>
              <span class="resp-section-title" style="color: var(--accent-amber);">Common Student Mistakes</span>
            </div>
            <div class="resp-section-body" style="color:#fcd34d;">
              ${formatBold(data.commonMistakes)}
            </div>
          </div>
        ` : ''}

        <!-- Model Answer -->
        <div class="resp-section" style="border-bottom:none; background: rgba(16,185,129,0.03);">
          <div class="resp-section-header">
            <span class="section-icon">📝</span>
            <span class="resp-section-title" style="color: var(--accent-emerald);">Model Answer</span>
          </div>
          <div class="resp-section-body" style="font-size:14.5px; line-height:1.75; color:var(--text-primary);">
            ${formatBold(data.modelAnswer)}
          </div>
        </div>

        
      </div>
    `;
  }

  // Fallback to default structured response
  let originalHtml = renderStructuredResponseDefault(data, query);
  return originalHtml.replace('class="response-card"', 'class="response-card" style="position:relative;"').replace('</h3>', '</h3>' + speakerBtn);
}

// === renderStructuredResponseDefault ===
function renderStructuredResponseDefault(data, query) {
  const id = data._cardId || ('resp_' + Date.now());
  const formulaIcon = state.subject === 'Mathematics' ? '📐' : state.subject === 'Chemistry' ? '🧪' : '🔬';
  const formulaTitle = state.subject === 'Mathematics' ? 'Formula & Key Equation' :
                       state.subject === 'Chemistry' ? 'Chemical Reaction / Formula' :
                       'Formula / Reaction';

  const examRows = (data.examData || []).map(e => {
    const freq = e.frequency === 'HIGH' ? 'freq-high' : e.frequency === 'MEDIUM' ? 'freq-med' : 'freq-low';
    const freqIcon = e.frequency === 'HIGH' ? '🔴' : e.frequency === 'MEDIUM' ? '🟡' : '🟢';
    let badge = '';
    if (e.exam.includes('CBSE')) badge = '<span class="exam-badge badge-cbse">CBSE</span>';
    else if (e.exam.includes('JEE')) badge = '<span class="exam-badge badge-jee">JEE</span>';
    else if (e.exam.includes('NEET')) badge = '<span class="exam-badge badge-neet">NEET</span>';
    else if (e.exam.includes('CHSE') || e.exam.includes('BSE')) badge = '<span class="exam-badge badge-chse">STATE</span>';
    return `<tr>
      <td>${badge} ${e.exam}</td>
      <td>${e.years}</td>
      <td>${e.marks}</td>
      <td>${e.type}</td>
      <td><span class="${freq}">${freqIcon} ${e.frequency}</span></td>
    </tr>`;
  }).join('');

  const steps = (data.mechanism || []).map(s => `
    <li class="step-item">
      <div class="step-num">${s.step}</div>
      <div class="step-text"><strong>${s.title}:</strong> ${formatBold(s.text)}</div>
    </li>
  `).join('');

  const kwChips = (data.keywords || []).map(k => `<span class="keyword-chip">${k}</span>`).join('');

  return `
    <div class="response-card" id="${id}">
      <div class="resp-section sec-definition">
        <div class="resp-section-header">
          <span class="section-icon">🎓</span>
          <span class="resp-section-title">Definition</span>
        </div>
        <div class="resp-section-body">${formatBold(data.definition || '')}</div>
      </div>

      ${steps ? `
      <div class="resp-section sec-mechanism">
        <div class="resp-section-header">
          <span class="section-icon">⚙️</span>
          <span class="resp-section-title">Mechanism / How It Works</span>
        </div>
        <div class="resp-section-body">
          <ul class="step-list">${steps}</ul>
        </div>
      </div>` : ''}

      ${data.formula ? `
      <div class="resp-section sec-formula">
        <div class="resp-section-header">
          <span class="section-icon">${formulaIcon}</span>
          <span class="resp-section-title">${formulaTitle}</span>
        </div>
        <div class="resp-section-body">
          <div class="formula-block">${escapeHtml(data.formula)}</div>
        </div>
      </div>` : ''}

      ${(data.diagram || data.analogy) ? `
      <div class="resp-section sec-diagram">
        <div class="resp-section-header">
          <span class="section-icon">📐</span>
          <span class="resp-section-title">Diagram & Mental Model</span>
        </div>
        <div class="resp-section-body">
          ${data.diagram ? `<div class="diagram-block">${escapeHtml(data.diagram)}</div>` : ''}
          ${data.analogy ? `<div class="callout callout-amber" style="${data.diagram ? 'margin-top:10px' : ''}">💡 <strong>Mental Model:</strong> ${formatBold(data.analogy)}</div>` : ''}
        </div>
      </div>` : ''}

      ${data.example ? `
      <div class="resp-section sec-example">
        <div class="resp-section-header">
          <span class="section-icon">💡</span>
          <span class="resp-section-title">Real-World Examples</span>
        </div>
        <div class="resp-section-body">${formatBold(data.example || '').replace(/\n/g, '<br>')}</div>
      </div>` : ''}

      ${examRows ? `
      <div class="resp-section sec-exam">
        <div class="resp-section-header">
          <span class="section-icon">📊</span>
          <span class="resp-section-title">Exam Relevance & PYQ History</span>
        </div>
        <div class="resp-section-body">
          <table class="exam-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Years</th>
                <th>Marks</th>
                <th>Type</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>${examRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      ${kwChips ? `
      <div class="resp-section sec-keywords">
        <div class="resp-section-header">
          <span class="section-icon">✅</span>
          <span class="resp-section-title">Board-Approved Keywords</span>
        </div>
        <div class="resp-section-body">
          <div class="keyword-chips">${kwChips}</div>
          <p class="keyword-note">📌 <em>${data.keywordsNote || ''}</em></p>
          ${data.teacherTip ? `<div class="callout callout-emerald" style="margin-top:12px">${formatBold(data.teacherTip).replace(/\n\n/g, '<br><br>')}</div>` : ''}
        </div>
      </div>` : ''}

      ${data.quiz ? `
      <div class="resp-section sec-quiz">
        <div class="resp-section-header">
          <span class="section-icon">🧠</span>
          <span class="resp-section-title">Quick Quiz — Test Yourself!</span>
        </div>
        <div class="resp-section-body">
          <div class="quiz-box">
            <p class="quiz-question">${data.quiz}</p>
            <div class="quiz-input-row">
              <input type="text" class="quiz-input" placeholder="Type your answer here..." id="quiz_${id}" />
              <button class="quiz-submit-btn" onclick="submitInlineQuiz('quiz_${id}', '${escapeAttr(data.quiz || '')}', '${escapeAttr(data.quizAnswer || '')}')">Submit ✓</button>
            </div>
          </div>
        </div>
      </div>` : ''}

      
    </div>
  `;
}

// === renderPYQResponse ===
function renderPYQResponse(data, query) {
  const id = data._cardId || ('pyq_' + Date.now());
  const qList = (data.questions || []).map((q, idx) => {
    const qId = `${id}_q_${idx}`;
    const badgeClass = q.exam.includes('CBSE') ? 'badge-cbse' : q.exam.includes('JEE') ? 'badge-jee' : q.exam.includes('NEET') ? 'badge-neet' : 'badge-chse';
    
    let optionsHtml = '';
    if (q.options && q.options.length > 0) {
      optionsHtml = `
        <div class="pyq-options" style="margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${q.options.map(opt => `
            <div class="pyq-option" style="padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size:13px; cursor:pointer;" onclick="selectPyqOption(this, '${escapeAttr(q.answer)}')">${opt}</div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="pyq-item" style="padding: 16px; border-bottom: 1px solid var(--border-color); position: relative;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
          <span class="exam-badge ${badgeClass}">${q.exam}</span>
          <span class="filter-chip subject-chip" style="font-size:10px; padding:2px 8px;">${q.year}</span>
          <span class="filter-chip class-chip" style="font-size:10px; padding:2px 8px;">${q.marks}</span>
          <span class="filter-chip board-chip" style="font-size:10px; padding:2px 8px;">${q.type}</span>
        </div>
        <div class="pyq-question-text" style="font-size: 14.5px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; line-height: 1.6;">
          <strong>Q${idx + 1}.</strong> ${formatBold(q.question)}
        </div>
        ${optionsHtml}
        <button class="action-btn" style="margin-top: 6px;" onclick="togglePyqAnswer('${qId}')">👁️ Show Solution</button>
        <div id="${qId}" class="pyq-answer-block" style="display: none; margin-top: 12px; padding: 12px; background: rgba(16,185,129,0.05); border-left: 3px solid var(--accent-emerald); border-radius: var(--radius-sm); font-size: 13.5px; line-height: 1.6; color: var(--text-secondary);">
          <strong>Solution:</strong><br>
          ${formatBold(q.answer)}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="response-card" id="${id}">
      <div class="resp-section" style="background: rgba(99,102,241,0.05);">
        <div class="resp-section-header">
          <span class="section-icon">📝</span>
          <span class="resp-section-title" style="color: var(--text-accent);">PYQ Practice Bank — ${data.topic || 'Chapter'}</span>
        </div>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Here are the most important previous year exam questions. Attempt them first before opening solutions.
        </p>
      </div>
      <div class="pyq-list">${qList}</div>
    </div>
  `;
}

// === renderFormulaSheetResponse ===
function renderFormulaSheetResponse(data, query) {
  const id = data._cardId || ('formula_' + Date.now());
  const fList = (data.formulas || []).map(f => {
    let eq = f.equation.trim();
    if (!eq.startsWith('$') && !eq.startsWith('\\(') && !eq.startsWith('\\[') && !eq.startsWith('\\begin')) {
      eq = `$$${eq}$$`;
    }
    return `
      <div class="formula-card-item" style="padding: 16px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 14.5px; font-weight: 700; color: var(--text-accent); font-family: 'Space Grotesk', sans-serif;">
          ${f.name}
        </div>
        <div class="formula-block" style="font-family: 'JetBrains Mono', monospace; font-size:14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(99,102,241,0.15); border-radius: var(--radius-sm); padding:10px; color:#a5b4fc; text-align:center; overflow-x:auto;">
          ${escapeHtml(eq)}
        </div>
        <div style="font-size:12.5px; color: var(--text-secondary); line-height: 1.5;">
          <strong>Variables:</strong> ${formatBold(f.terms)}
        </div>
        ${f.note ? `
        <div class="callout callout-amber" style="margin-top:4px; font-size:12px; padding:8px 10px;">
          💡 <strong>Teacher Note:</strong> ${formatBold(f.note)}
        </div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="response-card" id="${id}">
      <div class="resp-section" style="background: rgba(99,102,241,0.05); border-bottom: 1px solid var(--border-color);">
        <div class="resp-section-header">
          <span class="section-icon">📋</span>
          <span class="resp-section-title" style="color: var(--text-accent);">Formula Sheet — ${data.topic || 'Chapter'}</span>
        </div>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Quick revision list of all essential formulas, derivations, and variable mappings.
        </p>
      </div>
      <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        ${fList}
      </div>
    </div>
  `;
}

// === renderQuizCard ===
function renderQuizCard(data, cardId, questionsToRender = null) {
  const questions = questionsToRender || data.questions;
  
  activeQuizzes[cardId] = {
    topic: data.topic,
    questions: data.questions, // full pool
    currentQuestions: questions, // displayed pool
    answers: {},
    startTime: Date.now(),
    submitted: false
  };

  const qHtml = questions.map((q, idx) => {
    let inputHtml = '';
    if (q.options && q.options.length > 0) {
      // MCQ or TF
      inputHtml = `
        <div class="quiz-options-grid" style="display:grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px;">
          ${q.options.map(opt => `
            <button class="quiz-option-btn" onclick="selectQuizCardOption('${cardId}', ${idx}, '${escapeAttr(opt)}', this)" style="padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 13.5px; text-align: left; cursor: pointer; color: var(--text-secondary); transition: var(--transition); display:flex; align-items:center; gap:8px;">
              <span class="radio-indicator" style="width: 14px; height: 14px; border: 1.5px solid var(--text-secondary); border-radius: 50%; display:inline-block; flex-shrink:0;"></span>
              <span>${opt}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else {
      // Short / Fill blank
      inputHtml = `
        <div style="margin-top: 10px;">
          <input type="text" class="quiz-input" placeholder="Type your answer here..." oninput="inputQuizCardText('${cardId}', ${idx}, this.value)" style="width:100%;" />
        </div>
      `;
    }

    return `
      <div class="quiz-question-item" id="${cardId}_q_${idx}" style="padding: 16px; border-bottom: 1px solid var(--border-color); position: relative;">
        <div class="quiz-q-text" style="font-size:14.5px; font-weight:500; color:var(--text-primary); line-height:1.6;">
          <strong>Q${idx + 1}.</strong> ${formatBold(q.question)}
        </div>
        ${inputHtml}
        <div class="quiz-feedback-block" id="${cardId}_feedback_${idx}" style="display: none; margin-top: 12px; padding: 12px; border-radius: var(--radius-sm); font-size:13.5px; line-height: 1.6;"></div>
      </div>
    `;
  }).join('');

  return `
    <div class="response-card quiz-response-card" id="${cardId}">
      <div class="resp-section" style="background: rgba(99,102,241,0.05); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div class="resp-section-header">
            <span class="section-icon">🧠</span>
            <span class="resp-section-title" style="color: var(--text-accent);">Interactive Test — ${data.topic || 'Quiz'}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            Select options or type answers, then submit at the bottom.
          </p>
        </div>
        <div class="quiz-timer-badge" id="${cardId}_timer" style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-secondary); padding:4px 12px; border-radius:var(--radius-full); font-size:12px; font-weight:600;">
          ⏱️ 00:00
        </div>
      </div>
      
      <div class="quiz-questions-container">${qHtml}</div>
      
      <div class="quiz-footer-actions" id="${cardId}_actions" style="padding: 16px; display:flex; justify-content:flex-end;">
        <button class="new-chat-btn" onclick="submitQuizCard('${cardId}')" style="width:auto; padding: 10px 24px;">
          Submit Test ✓
        </button>
      </div>
    </div>
  `;
}

