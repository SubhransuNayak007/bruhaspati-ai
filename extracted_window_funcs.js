// === generateQuickAction ===
window.generateQuickAction = function() {
  const subject = document.getElementById('quickActionSubject').value;
  const classLevel = document.getElementById('quickActionClass').value;
  const topic = document.getElementById('quickActionTopic').value.trim();
  
  if (!topic) {
    const input = document.getElementById('quickActionTopic');
    input.style.borderColor = 'var(--accent-rose)';
    input.placeholder = 'Please enter a chapter or topic first!';
    setTimeout(() => {
      input.style.borderColor = '';
      input.placeholder = 'e.g. Matrices, Photosynthesis, Electrostatics';
    }, 2000);
    return;
  }
  
  state.subject = subject;
  state.classLevel = classLevel;
  updateFilters();
  updateSidebarSelectors(subject, classLevel);

  let query = '';
  if (activeQuickAction === 'quiz') {
    const count = document.getElementById('quizNumQuestions').value;
    const difficulty = document.getElementById('quizDifficulty').value;
    const typesList = [];
    if (document.getElementById('quizTypeMcq').checked) typesList.push("MCQ");
    if (document.getElementById('quizTypeTf').checked) typesList.push("True/False");
    if (document.getElementById('quizTypeShort').checked) typesList.push("Short Answer");
    if (document.getElementById('quizTypeFill').checked) typesList.push("Fill Blank");
    const typesStr = typesList.length > 0 ? typesList.join(' & ') : "MCQ";
    
    query = `Generate a quiz with ${count} questions of types [${typesStr}] and difficulty [${difficulty}] on topic ${topic} for ${state.board} Class ${classLevel} ${subject}`;
  } else if (activeQuickAction === 'formula') {
    query = `Generate a formula sheet for ${topic} for ${state.board} Class ${classLevel} ${subject}`;
  } else {
    query = `Generate PYQ practice questions for ${topic} for ${state.board} Class ${classLevel} ${subject}`;
  }
  
  closeQuickActionModal();
  sendSuggestion(query);
}

// === openQuickActionModal ===
window.openQuickActionModal = function(actionType) {
  activeQuickAction = actionType;
  const titles = {
    quiz: '🧠 Generate Interactive Quiz',
    formula: '📋 Generate Formula Sheet',
    pyq: '📝 Generate PYQ Practice Bank'
  };
  document.getElementById('quickActionModalTitle').textContent = titles[actionType] || 'Generate Learning Resource';
  
  const quizConfig = document.getElementById('quizConfigContainer');
  if (quizConfig) {
    quizConfig.style.display = actionType === 'quiz' ? 'block' : 'none';
  }
  
  if (state.subject !== 'All') {
    document.getElementById('quickActionSubject').value = state.subject;
  } else {
    document.getElementById('quickActionSubject').value = 'Physics';
  }
  
  if (state.classLevel && state.classLevel !== 'All') {
    document.getElementById('quickActionClass').value = state.classLevel;
  }
  
  document.getElementById('quickActionTopic').value = '';
  hideAutocomplete();
  
  document.getElementById('quickActionModal').classList.add('active');
  document.getElementById('quickActionTopic').focus();
}

// === closeQuickActionModal ===
window.closeQuickActionModal = function() {
  document.getElementById('quickActionModal').classList.remove('active');
}

