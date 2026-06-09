// === detectQuizQuery ===
function detectQuizQuery(query) {
  const q = query.toLowerCase();
  return q.includes('generate a quiz') || q.includes('interactive test') || q.includes('quiz on') || q.includes('test my knowledge') || q.includes('take a quiz');
}

// === detectFormulaQuery ===
function detectFormulaQuery(query) {
  const q = query.toLowerCase();
  return q.includes('generate a formula sheet') || q.includes('formula sheet for') || q.includes('key formula summary') || q.includes('formula sheet of') || q.includes('formula summary');
}

// === detectPYQQuery ===
function detectPYQQuery(query) {
  const q = query.toLowerCase();
  const keywords = ['pyq', 'pyqs', 'previous year', 'past paper', 'board paper', 'exam question', 'important question', 'question bank', 'practice question', 'problems', 'numerical', 'questions of', 'solve questions', 'questions about'];
  return keywords.some(kw => q.includes(kw));
}

// === extractTopicFromQuery ===
function extractTopicFromQuery(query) {
  const matchQuiz = query.match(/generate a quiz on\s+(.+?)\s+for/i) || query.match(/quiz on\s+(.+)/i);
  if (matchQuiz) return matchQuiz[1].trim();

  const matchFormula = query.match(/generate a formula sheet for\s+(.+?)\s+for/i) || query.match(/formula sheet for\s+(.+)/i) || query.match(/formula sheet of\s+(.+)/i);
  if (matchFormula) return matchFormula[1].trim();

  const matchPYQ = query.match(/generate pyq practice questions for\s+(.+?)\s+for/i) || query.match(/pyqs of\s+(.+)/i) || query.match(/pyq practice\s+(.+)/i);
  if (matchPYQ) return matchPYQ[1].trim();

  return "Selected Topic";
}

