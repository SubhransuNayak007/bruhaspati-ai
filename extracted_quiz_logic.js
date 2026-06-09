// === submitQuizCard ===
window.submitQuizCard = function(cardId) {
  let quiz = activeQuizzes[cardId];
  if (!quiz || quiz.submitted) return;
  
  clearInterval(quizTimers[cardId]);
  quiz.submitted = true;
  quiz.endTime = Date.now();
  let duration = Math.floor((quiz.endTime - quiz.startTime) / 1000);
  
  let score = 0;
  let wrongIndices = [];
  
  quiz.currentQuestions.forEach((q, idx) => {
    let userAns = (quiz.answers[idx] || '').trim();
    let correctAns = q.answer.trim();
    let isCorrect = false;
    
    if (q.options && q.options.length > 0) {
      isCorrect = userAns.toLowerCase() === correctAns.toLowerCase();
    } else {
      let userWords = userAns.toLowerCase().split(/\s+/);
      let correctWords = correctAns.toLowerCase().split(/\s+/);
      let stopWords = ['a', 'an', 'the', 'is', 'are', 'to', 'for', 'of', 'in', 'on', 'at', 'it'];
      let importantWords = correctWords.filter(w => w.length > 2 && !stopWords.includes(w));
      let matches = importantWords.filter(w => userWords.some(uw => uw.includes(w) || w.includes(uw)));
      
      if (importantWords.length === 0) isCorrect = userAns.length > 0;
      else isCorrect = (matches.length / importantWords.length) >= 0.4;
    }
    
    let feedbackEl = document.getElementById(`${cardId}_feedback_${idx}`);
    let qItemEl = document.getElementById(`${cardId}_q_${idx}`);
    
    if (isCorrect) {
      score++;
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.className = 'quiz-feedback-block callout callout-emerald';
        feedbackEl.innerHTML = `<strong>Correct!</strong><br>${formatBold(q.explanation)}`;
      }
      if (qItemEl) {
        qItemEl.style.borderColor = 'rgba(16,185,129,0.3)';
        qItemEl.style.background = 'rgba(16,185,129,0.02)';
      }
    } else {
      wrongIndices.push(idx);
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.className = 'quiz-feedback-block callout callout-rose';
        feedbackEl.innerHTML = `<strong>Incorrect.</strong> Your answer: "${escapeHtml(userAns || 'No Answer')}"<br><strong>Correct Answer:</strong> ${escapeHtml(q.answer)}<br><strong>Explanation:</strong> ${formatBold(q.explanation)}`;
      }
      if (qItemEl) {
        qItemEl.style.borderColor = 'rgba(244,63,94,0.3)';
        qItemEl.style.background = 'rgba(244,63,94,0.02)';
      }
    }
  });
  
  let timerBadge = document.getElementById(`${cardId}_timer`);
  if (timerBadge) {
    timerBadge.innerHTML = `⭐ Score: ${score}/${quiz.currentQuestions.length} | ⏱️ ${duration}s`;
  }
  
  let actionsEl = document.getElementById(`${cardId}_actions`);
  if (actionsEl) {
    let retryHtml = '';
    if (wrongIndices.length > 0) {
      retryHtml = `<button class="modal-btn secondary" onclick="retryWrongQuestions('${cardId}', [${wrongIndices.join(',')}])" style="margin-right: 10px;">Retry Wrong Ones 🔄</button>`;
    }
    actionsEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
        <span style="font-size: 13px; font-weight:600; color:var(--text-accent);">Test Completed!</span>
        <div>
          ${retryHtml}
          <button class="modal-btn primary" onclick="askFollowUp('Discuss quiz results for topic: ${escapeAttr(quiz.topic)}')">Discuss Quiz 💬</button>
        </div>
      </div>
    `;
  }
  
  saveQuizHistory(quiz.topic, score, quiz.currentQuestions.length, duration);
  triggerMathJax();
}

// === selectQuizCardOption ===
window.selectQuizCardOption = function(cardId, qIdx, selectedVal, el) {
  let quiz = activeQuizzes[cardId];
  if (!quiz || quiz.submitted) return;
  
  quiz.answers[qIdx] = selectedVal;
  
  let container = el.parentElement;
  container.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.style.borderColor = 'var(--border-color)';
    btn.style.background = 'rgba(255,255,255,0.03)';
    btn.querySelector('.radio-indicator').style.background = 'transparent';
    btn.querySelector('.radio-indicator').style.borderColor = 'var(--text-secondary)';
  });
  
  el.style.borderColor = 'var(--accent-indigo)';
  el.style.background = 'rgba(99,102,241,0.08)';
  el.querySelector('.radio-indicator').style.background = 'var(--accent-indigo)';
  el.querySelector('.radio-indicator').style.borderColor = 'var(--accent-indigo)';
}

// === inputQuizCardText ===
window.inputQuizCardText = function(cardId, qIdx, val) {
  let quiz = activeQuizzes[cardId];
  if (!quiz || quiz.submitted) return;
  quiz.answers[qIdx] = val;
}

