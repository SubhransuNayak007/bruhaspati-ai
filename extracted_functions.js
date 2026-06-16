// === FUNCTION getSystemPromptForFormat ===
function getSystemPromptForFormat(format, query) {
  if (detectQuizQuery(query)) {
    const countMatch = query.match(/with\s+(\d+)\s+questions/i);
    const count = countMatch ? parseInt(countMatch[1]) : 4;
    
    const difficultyMatch = query.match(/difficulty\s+\[([^\]]+)\]/i) || query.match(/difficulty:\s*([a-zA-Z]+)/i);
    const difficulty = difficultyMatch ? difficultyMatch[1] : "Medium";
    
    const typeMatch = query.match(/types\s+\[([^\]]+)\]/i) || query.match(/type:\s*([a-zA-Z\/]+)/i);
    const types = typeMatch ? typeMatch[1] : "MCQ, True/False";

    const topic = extractTopicFromQuery(query) || "the requested topic";

    return QUIZ_SYSTEM_PROMPT
      .replace(/\{\{COUNT\}\}/g, count)
      .replace('{{BOARD}}', state.board)
      .replace('{{CLASS}}', state.classLevel)
      .replace('{{SUBJECT}}', state.subject)
      .replace(/\{\{TOPIC\}\}/g, topic)
      .replace('{{DIFFICULTY}}', difficulty)
      .replace('{{TYPES}}', types);
  }
  if (detectPYQQuery(query)) {
    return PYQ_SYSTEM_PROMPT
      .replace('{{BOARD}}', state.board)
      .replace('{{CLASS}}', state.classLevel)
      .replace('{{SUBJECT}}', state.subject);
  }
  if (detectFormulaQuery(query)) {
    const topic = extractTopicFromQuery(query);
    
    const examProfiles = {
      "CBSE": "Include standard NCERT formulas. Mark derivable formulas with ★. Note CBSE-specific formula expressions.",
      "CHSE Odisha": "Include CHSE Odisha board-specific formula list. Cross-reference with Odisha BSE PYQ patterns.",
      "BSE Odisha": "Focus on BSE board exam level. Include state board-specific formula notation.",
      "JEE Main": "Include ALL formulas including those not in NCERT. Add JEE-specific tricks, shortcuts, and formula combinations. Mark high-weightage formulas 🔥. Include formula memory tricks.",
      "JEE Advanced": "Include advanced-level formulas, multi-concept integrations, and derivation steps. Add level: Advanced tag.",
      "NEET": "Focus on biology-chemistry-physics formulas relevant to NEET. Include unit conversions, constant values (like Avogadro, Boltzmann). Mark NEET frequency: HIGH/MEDIUM/LOW.",
      "IISER IAT": "Include research-level formula extensions beyond NCERT. Cover advanced physical chemistry and mathematical physics formulas."
    };
    
    const profile = examProfiles[state.board] || examProfiles["CBSE"];
    
    return FORMULA_SYSTEM_PROMPT
      .replace(/{{BOARD}}/g, state.board)
      .replace(/{{CLASS}}/g, state.classLevel)
      .replace(/{{SUBJECT}}/g, state.subject)
      .replace(/{{TOPIC}}/g, topic)
      .replace(/{{PROFILE}}/g, profile);
  }

  let basePrompt = '';
  if (format === 'long_answer') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Write a CONTINUOUS ESSAY-STYLE answer of 500–700 words, exactly as a top student would write in a {{BOARD}} board exam.
- NO section headers, NO bullet points, NO bold labels.
- Pure flowing paragraphs only.
- Start directly with the concept definition.
- Weave in: explanation, derivation/formula context, real-world significance, and examiner-expected keywords naturally.
- End with one concluding sentence that ties everything together.
- Write as if answering a 6-mark or 8-mark board exam question.
- DO NOT use the structured template format under any circumstances.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "title": "Clear title of the topic",
  "essay": [
    "First paragraph text. NO section headers.",
    "Second paragraph text. Pure flowing paragraphs only.",
    "Third paragraph text..."
  ],
  "teacherTip": "A memory trick, exam strategy, or common mistake to avoid.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'quick_summary') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Give ONLY 5 bullet points, max 15 words each. No intro, no outro.
Format of each bullet point text: "• [point text]" (Note: do not include the bullet character in the JSON array items themselves, just write the text. The UI will render it).
Focus on the 5 most exam-important facts.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "topic": "Topic name",
  "points": [
    "Key revision point 1 (max 15 words)",
    "Key revision point 2 (max 15 words)",
    "Key revision point 3 (max 15 words)",
    "Key revision point 4 (max 15 words)",
    "Key revision point 5 (max 15 words)"
  ],
  "teacherTip": "A quick exam tip or formula to remember.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'exam_focused') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Focus ONLY on exam preparation. Skip all general theory explanation.
Include:
1. Most likely exam question phrasings for {{BOARD}}
2. Model answer (100-150 words, board-style)
3. Keywords the examiner expects (bold them)
4. Common mistakes that lose marks
5. PYQ occurrences with year and marks

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "topic": "Topic name",
  "examData": [
    {"exam": "{{BOARD}} Class {{CLASS}}", "years": "2020, 2022", "marks": "5 marks", "type": "Long Answer", "frequency": "HIGH"}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "commonMistakes": "Common student mistakes that lose marks on this topic.",
  "modelAnswer": "Perfect high-scoring board-style model answer (100-150 words). Bold key terms using **term**.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'step_by_step') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Teach this concept as a step-by-step learning journey.
Step 1: What it is (simplest possible explanation, 2 sentences)
Step 2: Why it exists / intuition (analogy or story)
Step 3: The mechanics (how it actually works)
Step 4: The math/formula (derive it, don't just state it)
Step 5: A solved example
Step 6: Practice question for the student
Number each step clearly.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "topic": "Topic name",
  "step_by_step_steps": [
    { "step": 1, "title": "Step 1: What it is", "text": "Simplest possible explanation. Bold key terms using **term**." },
    { "step": 2, "title": "Step 2: Why it exists / Intuition", "text": "Intuitive analogy. Bold key terms." },
    { "step": 3, "title": "Step 3: The Mechanics", "text": "How it works step-by-step. Bold key terms." },
    { "step": 4, "title": "Step 4: The Math / Formula", "text": "Derivation and explanation of formula. Bold key terms." },
    { "step": 5, "title": "Step 5: Solved Example", "text": "A complete step-by-step solved example. Bold key terms." },
    { "step": 6, "title": "Step 6: Practice Question", "text": "A practice question for the student. Bold key terms." }
  ],
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'deep_research') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Give a comprehensive, university-level deep dive on this topic.
Include: historical context, multiple theoretical frameworks, advanced applications, research significance, connections to other topics in the curriculum, and references to NCERT chapters where applicable.
Minimum 800 words. Use sub-headings like ### Subheading.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "topic": "Topic name",
  "researchText": "The comprehensive deep dive text content (min 800 words). Use sub-headings prefixed with ### for sections. Bold key terms using **term**.",
  "teacherTip": "An advanced research-level tip or memory trick.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'graph_visual') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Describe this concept in a way that is HIGHLY VISUAL.
Include:
- ASCII diagram or described graph/chart (using box-drawing characters if possible)
- Step-by-step description of what any graph would look like (coordinates, axes labels, curve shapes where applicable)
- Table of values if relevant
- Color-coded mental model description
Then follow with a concise explanation.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "topic": "Topic name",
  "asciiDiagram": "ASCII chart/graph or structured text representation. Use box-drawing characters for borders and grids.",
  "graphDescription": "Description of the graph, coordinates, curve shape, and axes labels. Bold key terms.",
  "tableData": [
    { "label": "X value / Variable", "value": "Y value / Value" }
  ],
  "explanation": "Concise explanation of the visual components and how they link to the concept. Bold key terms.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'interactive') {
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
    basePrompt = `Act as an expert frontend developer and instructional designer. Your task is to build an interactive educational component based on the following specifications.

1. Objective: Build an interactive {{SUBJECT}} simulator demonstrating the user's requested concept for a {{BOARD}} Class {{CLASS}} student.
2. Initial Data State: The simulation should load with sensible default values, categories, or starting variables relevant to the concept.
3. Layout & Design Strategy: The layout should feature a visualization area at the top and a control panel at the bottom. Use a clean, modern UI with clear typography (dark theme preferred).
4. Container Constraints: You are generating a component that will be rendered inside a narrow chat bubble (max-width: 600px). Do not use multi-column layouts. Use a stacked, single-column layout (flex-col) by default. Ensure all elements are fully responsive, use word-wrap, and avoid fixed horizontal widths that could cause overflow.
5. UI and UX Polish: 
   - Visual Hierarchy: Center the main title at the top, followed by the Controls section, and place visual outputs (like graphs or Punnett Squares) at the bottom.
   - Color Coding: Color-code results to make them visually distinct and easy to read (e.g., subtle green/yellow/red backgrounds for different genetic outcomes or data states).
   - Input Spacing: Add adequate padding and margins (e.g., gap-4 or p-4) between control elements so they are not cramped.
6. User Inputs: Include appropriate controls (e.g., sliders, dropdowns, buttons) to let the user explore the concept dynamically.
7. Behavior & Core Logic: As the user changes inputs, instantly update the visual state. Calculate and display dynamic text, tables, or graphs in real-time using standard formulas.
8. Technical Constraints: Generate the entire component as self-contained HTML, CSS, and Vanilla JavaScript. Ensure the code is robust, handles edge cases, and requires no external local assets. Keep the code strictly inside the respective JSON fields. DO NOT use markdown code blocks inside the JSON strings.

CRITICAL OUTPUT RULES:
1. You must output ONLY valid, self-contained HTML/CSS/JS code.
2. Do not include any conversational text, explanations, or markdown formatting blocks (like markdown code blocks) inside the code fields.
3. Ensure all brackets, tags, and parentheses are properly closed before completing your response.

CRITICAL: You MUST use standard LaTeX syntax wrapped in $ for inline math and $$ for block equations.

You MUST respond in this exact JSON structure:
{
  "_thought_process": "Internal 60-agent planning: Identify concept, structure explanation, generate examples, ensure LaTeX usage.",
  "subject": "Auto-detect: Physics/Chemistry/Mathematics/Biology/English/History/etc",
  "chapter": "Auto-detect exact NCERT chapter name",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE / NEET",
  "confidence": 95,
  "mindMap": "mindmap\n  root((**TOPIC**))\n    SubTopic1\n      Detail1",
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null.",
  "diagram": "ASCII art diagram or structured text diagram of the concept, or null.",
  "example": "2 concrete real-world examples. Use \n\n to separate.",
  "type": "interactive_simulator",
  "topic": "Topic name",
  "htmlCode": "The pure HTML structure (<div>, <button>, etc.). No <html> or <body> tags, just the inner content.",
  "cssCode": "The pure CSS rules (e.g., .container { color: white; }). Do not include <style> tags.",
  "jsCode": "The pure JavaScript logic. Do not include <script> tags. Use document.querySelector to attach events. Use generic, safe JS.",
  "explanation": "A concise text explaining what this interactive simulator demonstrates and how to use it.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else {
    // default: structured
    basePrompt = `You are "Bruhaspati AI," an elite, ultra-premium educational AI tutor for Indian students (CBSE, CHSE, JEE, NEET, BSE, CUET, State Boards).
You have the intelligence of an IIT professor, the clarity of NCERT textbooks, and the depth of a JEE Advanced topper.

<core_identity>
- Identity: Bruhaspati AI, the ultimate smart tutor.
- Goal: Make every concept crystal clear using first principles, real-world analogies, and exam-focused depth.
- Tone: Authoritative, encouraging, structured, and precise.
- Scope: Answer ALL academic and educational questions across ALL subjects — Science, Mathematics, Humanities, Commerce, Languages, History, Geography, Economics, English Literature, and more. Only decline requests to write software code or build applications.
</core_identity>

<operational_rules>
1. **Zero Hallucination**: Never invent facts, formulas, or historical data.
2. **Pedagogical Excellence**: Break down complex ideas. Use analogies. Connect theory to real-world applications.
3. **LaTeX Mastery**: Use standard LaTeX — $inline$ for inline math, $$block$$ for display equations.
4. **JSON Strictness**: Output ONLY valid JSON. No conversational preamble. No markdown code fences around JSON.
5. **Mind Map**: ALWAYS generate a Mermaid mindmap diagram for the topic in the "mindMap" field.
</operational_rules>

Your current context: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

MANDATORY RESPONSE FORMAT — Output exactly this JSON (no extra text before or after):
{
  "subject": "Auto-detect from query: Physics/Chemistry/Mathematics/Biology/English/History/Economics/Geography/Other",
  "chapter": "Auto-detect the most relevant NCERT chapter name for this topic",
  "difficulty": "Auto-detect: Class 10 / Class 11 / Class 12 / JEE Main / JEE Advanced / NEET / Olympiad",
  "confidence": 95,
  "definition": "Clear, punchy definition — simple first sentence, then formal/NCERT version. Bold key terms using **term**.",
  "mechanism": [
    {"step": 1, "title": "What It Is", "text": "Simplest possible explanation. Bold **key terms**."},
    {"step": 2, "title": "Why It Matters", "text": "Intuition and real-world significance. Bold **key terms**."},
    {"step": 3, "title": "How It Works", "text": "Step-by-step mechanics. Bold **key terms**."}
  ],
  "formula": "The key formula in LaTeX wrapped in $$...$$, or null if not applicable.",
  "mindMap": "mindmap\\n  root((**TOPIC**))\\n    SubTopic1\\n      Detail1\\n      Detail2\\n    SubTopic2\\n      Detail1\\n    SubTopic3",
  "diagram": "ASCII art or structured text diagram of the standard textbook diagram for this concept, or null.",
  "analogy": "A vivid real-world analogy starting with 'Think of...' or 'Imagine...'",
  "example": "2 concrete real-world examples showing this concept in action. Use \\n\\n to separate them.",
  "examData": [
    {"exam": "{{BOARD}} Class {{CLASS}}", "years": "2019, 2022", "marks": "3 marks", "type": "Short Answer", "frequency": "HIGH"}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "keywordsNote": "Use these exact terms to secure full marks in {{BOARD}} exams.",
  "quiz": "A challenging question that tests deep understanding of this concept. Use $ for inline math.",
  "quizAnswer": "The correct answer with a clear step-by-step explanation. Use LaTeX if needed.",
  "teacherTip": "🔥 A powerful memory trick, common exam mistake to avoid, or a JEE/NEET shortcut.",
  "followups": ["A deeper follow-up question 1", "A related concept question 2", "An application question 3"]
}

RULES:
1. Output ONLY the JSON object above — nothing before, nothing after.
2. The "mindMap" field MUST use valid Mermaid mindmap syntax. Start with: mindmap\\n  root((**TopicName**))
3. Auto-detect subject, chapter, and difficulty from the question — do NOT leave them as placeholders.
4. Adapt depth and complexity to the detected difficulty level.
5. If the query asks to write software code, build apps, or scripts — set "definition" to a polite refusal and leave other fields as null.
6. Answer ALL questions across ALL subjects including English Literature, History, Economics, etc.`;
  }

  return basePrompt
    .replace(/{{BOARD}}/g, state.board)
    .replace(/{{CLASS}}/g, state.classLevel)
    .replace(/{{SUBJECT}}/g, state.subject)
    + `\n\nCRITICAL OVERRIDE: You MUST output exactly ONE single JSON object. Do NOT output multiple JSON blocks. Do NOT output any text outside the JSON object. Start your response immediately with { and end with }.`;
}

// === FUNCTION streamAIResponse ===
function streamAIResponse(query, cardId) {
  state.isDemoFallback = false;
  const activeBubble = document.getElementById(cardId);
  if (!activeBubble) return;
  const aiContent = activeBubble.closest('.msg-ai').querySelector('.ai-content');
  
  const cost = estimateRequestCost(query);
  const isAllowed = checkTokenLimit(cost);
  
  // 3-Phase Loading State (BUG 2)
  let firstTokenArrived = false;
  
  // Phase 1: Show Skeleton Loader instantly
  showSkeletonLoader(cardId, aiContent);
  
  // Schedule Phase 2: Thinking indicator (lotus pulse) after 600ms
  const thinkingTimeout = setTimeout(() => {
    if (!firstTokenArrived) {
      if (state.format === 'interactive') {
        showInteractiveLoader(cardId, aiContent);
      } else {
        showThinkingLoader(cardId, aiContent, state.subject);
      }
    }
  }, 600);

  try {
    if (!isAllowed) {
      throw { type: 'QUOTA_EXCEEDED' };
    }

    // Resolve API Key and Provider
    let activeKey = state.apiKey;
    let provider = state.apiProvider || 'gemini';
    
    if (activeKey === 'REDACTED_API_KEY' || !activeKey) {
      if (provider === 'kimi') {
        activeKey = 'sk-bnXYPmQdAyswi1IJQ7NEgtD9jejCvoEcLAIq9WpqZA0C4GcE';
      } else if (provider === 'openai') {
        activeKey = '';
      } else {
        activeKey = 'REDACTED_API_KEY';
      }
    }

    if (!state.useRealAPI || !activeKey || activeKey === 'REDACTED_API_KEY') {
      // Latency simulator + mock stream
      await delay(800);
      
      // Token arrived for mock stream
      firstTokenArrived = true;
      clearTimeout(thinkingTimeout);
      if (activeLoaderIntervals[cardId]) {
        clearInterval(activeLoaderIntervals[cardId]);
        delete activeLoaderIntervals[cardId];
      }
      
      let responseData = getDemoResponse(query);
      
      // Verify quiz counts if query is a quiz
      if (detectQuizQuery(query)) {
        const countMatch = query.match(/with\s+(\d+)\s+questions/i);
        const requestedCount = countMatch ? parseInt(countMatch[1]) : 4;
        
        // If mock quiz data doesn't match requested count, slice or duplicate
        if (responseData.questions && responseData.questions.length !== requestedCount) {
          if (responseData.questions.length > requestedCount) {
            responseData.questions = responseData.questions.slice(0, requestedCount);
          } else {
            while (responseData.questions.length < requestedCount) {
              responseData.questions.push(JSON.parse(JSON.stringify(responseData.questions[0])));
            }
          }
        }
      }
      
      let jsonString = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      let currentIndex = 0;
      const chunkSize = 35;
      let accumulatedText = '';
      let lastRenderTime = 0;
      
      // Start simulation timer
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          if (currentIndex >= jsonString.length) {
            clearInterval(timer);
            renderPartialText(jsonString, aiContent, cardId, query, true);
            consumeTokens(cost);
            resolve(true);
            return;
          }
          
          accumulatedText += jsonString.substring(currentIndex, currentIndex + chunkSize);
          currentIndex += chunkSize;
          
          let now = Date.now();
          if (now - lastRenderTime > 100) {
            lastRenderTime = now;
            renderPartialText(accumulatedText, aiContent, cardId, query, false);
          }
        }, 25);
      });
    }

    const isOpenAI = provider === 'openai' || provider === 'kimi';
    let accumulatedText = '';
    let response;
    let headers = { 'Content-Type': 'application/json' };
    const isConversational = detectConversationalQuery(query);
    const basePrompt = isConversational ? CONVERSATIONAL_SYSTEM_PROMPT : getSystemPromptForFormat(state.format, query);
    
    if (isOpenAI) {
      const url = provider === 'kimi' ? 'https://api.moonshot.cn/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${activeKey}`;
      
      const messages = [
        { role: 'system', content: basePrompt }
      ];
      
      if (uploadedFiles && uploadedFiles.length > 0) {
        const content = [{ type: 'text', text: 'Student Query: ' + query }];
        uploadedFiles.forEach(file => {
          if (file.mimeType.startsWith('image/')) {
            content.push({
              type: 'image_url',
              image_url: {
                url: `data:${file.mimeType};base64,${file.base64}`
              }
            });
          } else {
            content.push({
              type: 'text',
              text: `[File Attachment: ${file.name} (base64 length: ${file.base64.length})]`
            });
          }
        });
        messages.push({ role: 'user', content: content });
      } else {
        messages.push({ role: 'user', content: 'Student Query: ' + query });
      }

      const body = {
        model: provider === 'kimi' ? 'moonshot-v1-32k' : 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        stream: true
      };
      
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });
        
        if (response.status === 429) throw { type: 'RATE_LIMITED' };
        if (response.status === 503) throw { type: 'SERVICE_DOWN' };
        if (!response.ok)            throw { type: 'API_ERROR', status: response.status };
      } catch (kimiErr) {
        if (provider === 'kimi') {
          console.warn("⚠️ Kimi API failed. Falling back to OpenRouter Backup...", kimiErr);
          const orUrl = 'https://openrouter.ai/api/v1/chat/completions';
          const orKey = 'REMOVED_API_KEY';
          
          headers['Authorization'] = `Bearer ${orKey}`;
          headers['HTTP-Referer'] = 'https://bruhaspati-ai.vercel.app';
          headers['X-Title'] = 'Bruhaspati AI';
          
          const orBody = {
            model: 'meta-llama/llama-3.1-70b-instruct',
            messages: messages,
            temperature: 0.7,
            stream: true
          };
          
          response = await fetch(orUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(orBody)
          });
          
          if (!response.ok) {
            throw { type: 'API_ERROR', status: response.status };
          }
        } else {
          throw kimiErr;
        }
      }
      
    } else {
      // Cascading Gemini models
      const models = [
        { name: 'gemini-2.5-flash', version: 'v1beta' },
        { name: 'gemini-2.0-flash', version: 'v1beta' },
        { name: 'gemini-2.5-pro', version: 'v1beta' },
        { name: 'gemini-1.5-flash', version: 'v1beta' }
      ];
      
      let lastError = null;
      let success = false;
      
      for (const modelSpec of models) {
        try {
          console.log(`📡 Trying Gemini Model: ${modelSpec.name} (${modelSpec.version})...`);
          const url = `https://generativelanguage.googleapis.com/${modelSpec.version}/models/${modelSpec.name}:streamGenerateContent?alt=sse&key=${activeKey}`;
          
          let contentsParts = [{ text: basePrompt + '\n\nStudent Query: ' + query }];
          if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
              contentsParts.push({
                inlineData: {
                  mimeType: file.mimeType,
                  data: file.base64
                }
              });
            });
          }
          
          const genConfig = {
            temperature: 0.7,
            maxOutputTokens: 20000
          };
          const body = {
            contents: [{ parts: contentsParts }],
            generationConfig: genConfig
          };
          
          response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
          });
          
          if (response.status === 429) throw { type: 'RATE_LIMITED' };
          if (response.status === 503) throw { type: 'SERVICE_DOWN' };
          
          if (response.ok) {
            success = true;
            break;
          } else {
            throw { type: 'API_ERROR', status: response.status };
          }
        } catch (err) {
          console.warn(`⚠️ Model ${modelSpec.name} failed: ${err.type || err.message}. Cascading...`);
          lastError = err;
          if (err.type) throw err; // re-throw our typed errors
          if (err.message && (err.message.includes('API key not valid') || err.message.includes('Key not valid') || err.message.includes('400'))) {
            throw err;
          }
        }
      }
      
      if (!success) {
        throw lastError || { type: 'NETWORK_ERROR' };
      }
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastRenderTime = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Token arrived!
      if (!firstTokenArrived) {
        firstTokenArrived = true;
        clearTimeout(thinkingTimeout);
        if (activeLoaderIntervals[cardId]) {
          clearInterval(activeLoaderIntervals[cardId]);
          delete activeLoaderIntervals[cardId];
        }
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        
        if (isOpenAI) {
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.substring(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              accumulatedText += delta;
            } catch (err) {}
          }
        } else {
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.substring(6);
            try {
              const parsed = JSON.parse(dataStr);
              
              // safety & safety blocks checks
              if (parsed.promptFeedback?.blockReason) {
                throw { type: 'CONTENT_BLOCKED' };
              }
              const candidate = parsed.candidates?.[0];
              if (candidate) {
                if (candidate.finishReason === 'RECITATION' || candidate.finishReason === 'SAFETY') {
                  throw { type: 'CONTENT_BLOCKED' };
                }
                const text = candidate.content?.parts?.[0]?.text || '';
                accumulatedText += text;
              }
            } catch (err) {
              if (err.type) throw err;
            }
          }
        }
      }
      
      let now = Date.now();
      if (now - lastRenderTime > 120) {
        lastRenderTime = now;
        renderPartialText(accumulatedText, aiContent, cardId, query, false);
      }
    }
    
    // Verify JSON parsing and candidate existence
    let parsedJson = cleanAndParseJSON(accumulatedText);
    if (!parsedJson) {
      // Try to repair
      const jsonMatch = accumulatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsedJson = JSON.parse(repairJSON(jsonMatch[0])); } catch (_) {}
      }
    }
    if (!parsedJson) {
      // If this is a conversational query or plain text response, render as markdown
      if (accumulatedText && accumulatedText.trim().length > 0) {
        renderPlainTextResponse(accumulatedText.trim(), aiContent, cardId, query);
        consumeTokens(cost);
        state.hasRetriedQuiz = false;
        return true;
      }
      throw { type: 'NO_RESPONSE' };
    }
    
    // Check Quiz Count limits validation on successful parse (BUG 4B)
    if (parsedJson.type === 'quiz') {
      const countMatch = query.match(/with\s+(\d+)\s+questions/i);
      const requestedCount = countMatch ? parseInt(countMatch[1]) : 4;
      
      if (!parsedJson.questions || parsedJson.questions.length !== requestedCount) {
        if (!state.hasRetriedQuiz) {
          showToast("⚠️ Quiz count mismatch. Retrying generation...");
          state.isTyping = true;
          setTimeout(async () => {
            await retryQuizGeneration(query, cardId, requestedCount);
          }, 500);
          return false;
        } else {
          console.warn(`Retry also resulted in mismatch: expected ${requestedCount}, got ${parsedJson.questions?.length}`);
        }
      }
    }
    
    renderPartialText(accumulatedText, aiContent, cardId, query, true);
    consumeTokens(cost);
    state.hasRetriedQuiz = false;
    return true;
    
  } catch (err) {
    console.error('Streaming error in streamAIResponse:', err);
    clearTimeout(thinkingTimeout);
    if (activeLoaderIntervals[cardId]) {
      clearInterval(activeLoaderIntervals[cardId]);
      delete activeLoaderIntervals[cardId];
    }
    
    // Application-level plan quota limits
    if (err.type === 'QUOTA_EXCEEDED') {
      const limit = getPlanLimit();
      aiContent.innerHTML = `
        <div class="quota-exceeded-card" id="${cardId}">
          <div class="quota-header">
            <span class="quota-header-icon">⚡</span>
            <span class="quota-title">Daily Token Limit Exceeded</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
            You have used <strong>${tokenState.tokensUsed.toLocaleString()} / ${limit.toLocaleString()}</strong> of your daily allowance.
          </p>
          <div class="quota-usage-bar-wrapper">
            <div class="token-meter-bar" style="height: 8px;">
              <div class="token-meter-fill red" style="width: 100%;"></div>
            </div>
          </div>
          <table class="quota-pricing-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Daily Limit</th>
                <th>Pricing</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Free Tier</td>
                <td>2,000 tokens</td>
                <td>₹0 / free</td>
              </tr>
              <tr class="highlight">
                <td>Pro Exam Prep 🌟</td>
                <td>20,000 tokens</td>
                <td>₹199 / mo</td>
              </tr>
              <tr>
                <td>Ultra Scholar 🚀</td>
                <td>Unlimited</td>
                <td>₹399 / mo</td>
              </tr>
            </tbody>
          </table>
          <button class="quota-upgrade-btn" onclick="openUpgradeModal()">Upgrade Plan 🚀</button>
        </div>
      `;
      saveAIMessageToState(query, { error: err.type || err.message }, cardId, true);
      return false;
    } else if (err.status === 400 || err.status === 403 || (err.message && (err.message.includes('API key not valid') || err.message.includes('Key not valid') || err.message.includes('Unauthorized')))) {
      // Clean, premium connection/authentication failure card!
      if (activeLoaderIntervals[cardId]) {
        clearInterval(activeLoaderIntervals[cardId]);
        delete activeLoaderIntervals[cardId];
      }
      if (activeLoaderCleanups[cardId]) {
        activeLoaderCleanups[cardId]();
        delete activeLoaderCleanups[cardId];
      }
      
      aiContent.innerHTML = `
        <div class="response-card" id="${cardId}" style="border-left: 4px solid var(--accent-rose); background: rgba(244,63,94,0.04); padding: 18px 20px;">
          <h4 style="color: var(--accent-rose); font-family: 'Space Grotesk', sans-serif; display:flex; align-items:center; gap:8px; font-weight:700; margin:0;">
            <span>🔑</span> Invalid API Key or Unauthorized
          </h4>
          <p style="font-size:13px; color:var(--text-secondary); margin-top:8px; line-height:1.5; margin-bottom:0;">
            The API key provided is invalid, expired, or unauthorized (Status: ${err.status || '400'}). Please verify your custom Google Gemini (starts with <code>AIzaSy</code>) or OpenAI (starts with <code>sk-</code>) key in the settings panel, or switch back to the default Demo Mode.
          </p>
          <button class="modal-btn secondary" onclick="openKeyModal()" style="margin-top: 12px; padding: 6px 12px; font-size: 11.5px; width: auto; cursor:pointer;">
            ⚙️ Open Settings
          </button>
        </div>
      `;
      saveAIMessageToState(query, { error: err.type || err.message }, cardId, true);
      return false;
    } else {
      // For API Errors, Rate Limits (429), or Network Issues, automatically fall back to local high-fidelity simulation!
      let friendlyMsg = "AI Connection issue";
      if (err.type === 'RATE_LIMITED') friendlyMsg = "AI service is busy (Rate Limit)";
      else if (err.type === 'SERVICE_DOWN') friendlyMsg = "AI service is temporarily offline";
      else if (err.type === 'CONTENT_BLOCKED') friendlyMsg = "Request flagged by content safety filter";
      else if (err.type === 'API_ERROR') friendlyMsg = `AI service returned status ${err.status}`;
      
      showToast(`⚠️ ${friendlyMsg}. Launching offline smart tutor fallback...`);
      console.log(`Fallback to simulation triggered for error:`, err);
      
      // Call simulation to generate response card
      await simulateDemoStream(query, cardId);
      return true;
    }
  }
}

// === FUNCTION simulateDemoStream ===
function simulateDemoStream(query, cardId) {
  return new Promise(async (resolve) => {
    state.isDemoFallback = true;
    let activeBubble = document.getElementById(cardId);
    if (!activeBubble) activeBubble = document.getElementById(cardId + '_loader');
    if (!activeBubble) {
      resolve();
      return;
    }
    const aiContent = activeBubble.closest('.msg-ai').querySelector('.ai-content');
    
    await delay(800); // Latency simulator
    let responseData = getDemoResponse(query);
    responseData.isDemoFallback = true;
    let jsonString = JSON.stringify(responseData);
    
    let currentIndex = 0;
    const chunkSize = 35;
    let accumulatedText = '';
    let lastRenderTime = 0;
    
    const timer = setInterval(() => {
      if (currentIndex >= jsonString.length) {
        clearInterval(timer);
        renderPartialText(jsonString, aiContent, cardId, query, true);
        resolve();
        return;
      }
      
      accumulatedText += jsonString.substring(currentIndex, currentIndex + chunkSize);
      currentIndex += chunkSize;
      
      let now = Date.now();
      if (now - lastRenderTime > 100) {
        lastRenderTime = now;
        renderPartialText(accumulatedText, aiContent, cardId, query, false);
      }
    }, 25);
  });
}

// === FUNCTION generateMockQuiz ===
function generateMockQuiz(topic, subject, classLevel, count, types, difficulty) {
  let questions = [];
  
  if (subject === 'Mathematics' || topic.toLowerCase().includes('matrix') || topic.toLowerCase().includes('integration')) {
    questions = [
      {
        question: `If $A$ is a $2 \\times 2$ matrix such that $\\det(A) = 5$, find the value of $\\det(3A)$.`,
        options: ["15", "45", "25", "9"],
        answer: "45",
        explanation: `For any square matrix $A$ of order $n$, $\\det(kA) = k^n \\det(A)$. Here, the order $n = 2$ and scalar $k = 3$. $$\\det(3A) = 3^2 \\det(A) = 9 \\times 5 = 45$$ Thus, the correct answer is **45**.`
      },
      {
        question: `Evaluate the definite integral: $\\int_{0}^{\\pi/2} \\sin^2(x) \\, dx$.`,
        options: ["$\\pi/2$", "$\\pi/4$", "1", "0"],
        answer: "$\\pi/4$",
        explanation: `Using the integral property $\\int_{a}^{b} f(x) \\, dx = \\int_{a}^{b} f(a+b-x) \\, dx$, we let: $$I = \\int_{0}^{\\pi/2} \\sin^2(x) \\, dx$$ Applying the property yields: $$I = \\int_{0}^{\\pi/2} \\cos^2(x) \\, dx$$ Adding these two: $$2I = \\int_{0}^{\\pi/2} 1 \\, dx = [x]_{0}^{\\pi/2} = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$$.`
      },
      {
        question: `True or False: A skew-symmetric matrix of odd order always has determinant equal to zero.`,
        options: ["True", "False"],
        answer: "True",
        explanation: `For a skew-symmetric matrix $A$ of order $n$, $A^T = -A$. Det($A^T$) = Det($-A$) = $(-1)^n$ Det($A$). Since $n$ is odd, Det($A$) = -Det($A$) $\\implies$ 2 Det($A$) = 0 $\\implies$ Det($A$) = 0.`
      },
      {
        question: `Find the general solution of the differential equation: $\\frac{dy}{dx} = \\frac{y}{x}$.`,
        options: ["$y = cx$", "$y = c/x$", "$y = x + c$", "$y = x^2 + c$"],
        answer: "$y = cx$",
        explanation: `Separating variables: $\\frac{1}{y} dy = \n\\frac{1}{x} dx \\implies \\ln|y| = \\ln|x| + \\ln|c| \\implies y = cx$.`
      }
    ];
  } else {
    questions = [
      {
        question: `Which of the following describes the light-dependent reactions of Photosynthesis?`,
        options: [
          "Takes place in the stroma and fixes CO2",
          "Takes place in the thylakoid membrane, splitting H2O to release O2",
          "Occurs in the cytoplasm and breaks down glucose",
          "None of the above"
        ],
        answer: "Takes place in the thylakoid membrane, splitting H2O to release O2",
        explanation: `Light reactions occur in the **thylakoid membranes** of chloroplasts where chlorophyll absorbs light energy, splitting water (**photolysis**) to produce ATP, NADPH, and releases oxygen ($O_2$) as a byproduct.`
      },
      {
        question: `Calculate the force between two charges of $1\\text{ C}$ and $2\\text{ C}$ placed $1\\text{ m}$ apart in vacuum.`,
        options: ["$9 \\times 10^9\\text{ N}$", "$1.8 \\times 10^{10}\\text{ N}$", "$3.6 \\times 10^9\\text{ N}$", "$1.8 \\times 10^9\\text{ N}$"],
        answer: "$1.8 \\times 10^{10}\\text{ N}$",
        explanation: `Using Coulomb's law: $$F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q_1 q_2}{r^2} = (9 \\times 10^9) \\frac{1 \\times 2}{1^2} = 1.8 \\times 10^{10}\\text{ N}$$`
      },
      {
        question: `What is the escape velocity of a body from the surface of the Earth?`,
        options: ["$11.2\\text{ km/s}$", "$9.8\\text{ km/s}$", "$7.92\\text{ km/s}$", "$11.2\\text{ m/s}$"],
        answer: "$11.2\\text{ km/s}$",
        explanation: `The escape velocity formula is $v_e = \\sqrt{2gR}$. Substituting $g = 9.8\\text{ m/s}^2$ and $R = 6.4 \\times 10^6\\text{ m}$ yields $\\approx 11.2\\text{ km/s}$.`
      },
      {
        question: `In organic chemistry, which functional group represents an aldehyde?`,
        options: ["$-CHO$", "$-COOH$", "$-CO-$", "$-OH$"],
        answer: "$-CHO$",
        explanation: `The aldehyde group is **$-CHO$** where carbon forms a double bond with oxygen and a single bond with hydrogen.`
      }
    ];
  }

  // Slice to meet required count
  let selectedQs = questions.slice(0, count);
  
  return {
    type: "quiz",
    topic: topic,
    questions: selectedQs,
    followups: [
      `Review my answers for ${topic} Quiz`,
      `Generate a harder quiz on ${topic}`,
      `Explain the formulas used in this ${topic} quiz`
    ]
  };
}

// === FUNCTION generateMockFormulaSheet ===
function generateMockFormulaSheet(topic, subject, classLevel) {
  let formulas = [];
  
  if (subject === 'Mathematics' || topic.toLowerCase().includes('matrix') || topic.toLowerCase().includes('integration')) {
    formulas = [
      {
        name: "Quadratic Equation & Roots",
        equation: "$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$",
        terms: "$x$ = Roots, $a, b, c$ = Coefficients, $D = b^2 - 4ac$ = Discriminant.",
        note: "If $D > 0$, roots are real and distinct. If $D = 0$, roots are real and equal. If $D < 0$, roots are complex conjugates."
      },
      {
        name: "Euler's Formula",
        equation: "$$e^{i \\theta} = \\cos\\theta + i \\sin\\theta$$",
        terms: "$e$ = Euler number, $i$ = Imaginary unit ($\\sqrt{-1}$), $\\theta$ = Angle in radians.",
        note: "Leads to Euler's Identity $$e^{i\\pi} + 1 = 0$$, linking five fundamental math constants."
      },
      {
        name: "Integration by Parts",
        equation: "$$\\int u \\, dv = u v - \\int v \\, du$$",
        terms: "$u, v$ = Differentiable functions of $x$, $du, dv$ = Their differentials.",
        note: "Choose $u$ using ILATE rule (Inverse trigonometric, Logarithmic, Algebraic, Trigonometric, Exponential)."
      }
    ];
  } else if (subject === 'Physics' || topic.toLowerCase().includes('force') || topic.toLowerCase().includes('motion') || topic.toLowerCase().includes('electro')) {
    formulas = [
      {
        name: "Coulomb's Law (Electrostatics)",
        equation: "$$F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q_1 q_2}{r^2}$$",
        terms: "$F$ = Electrostatic force, $q_1, q_2$ = Charges, $r$ = Separation, $\\varepsilon_0$ = Permittivity of free space.",
        note: "Value of $1/(4\\pi\\varepsilon_0) \\approx 9 \\times 10^9\\text{ N}\\cdot\\text{m}^2/\\text{C}^2$. Valid for point charges only."
      },
      {
        name: "Einstein's Mass-Energy Equivalence",
        equation: "$$E = m c^2$$",
        terms: "$E$ = Energy equivalence, $m$ = Relativistic/Rest mass, $c$ = Speed of light ($3 \\times 10^8\\text{ m/s}$)." ,
        note: "Implies mass is concentrated energy. Critical for nuclear reactions, fission, and fusion."
      }
    ];
  } else {
    formulas = [
      {
        name: "Ideal Gas Equation",
        equation: "$$P V = n R T$$",
        terms: "$P$ = Pressure, $V$ = Volume, $n$ = Moles, $R$ = Universal Gas Constant ($8.314\\text{ J/mol}\\cdot\\text{K}$), $T$ = Temp (Kelvin).",
        note: "Combination of Boyle's Law ($V \\propto 1/P$), Charles's Law ($V \\propto T$), and Avogadro's Law ($V \\propto n$)."
      },
      {
        name: "Gibbs Free Energy (Spontaneity)",
        equation: "$$\\Delta G = \\Delta H - T \\Delta S$$",
        terms: "$\\Delta G$ = Change in Free Energy, $\\Delta H$ = Enthalpy Change, $\\Delta S$ = Entropy Change, $T$ = Temperature.",
        note: "If $\\Delta G < 0$, reaction is spontaneous (exergonic). If $\\Delta G > 0$, non-spontaneous. If $\\Delta G = 0$, at equilibrium."
      }
    ];
  }

  return {
    type: "formula_sheet",
    topic: topic,
    formulas: formulas,
    followups: [
      `How to apply Coulomb's law in a dielectric medium?`,
      `Explain the physical significance of Gibbs Free energy`,
      `State the CBSE board weightage for Gas Laws`
    ]
  };
}

// === FUNCTION generateMockPYQ ===
function generateMockPYQ(topic, subject, classLevel) {
  let questions = [];

  if (subject === 'Mathematics' || topic.toLowerCase().includes('matrix') || topic.toLowerCase().includes('integration')) {
    questions = [
      {
        question: "Using properties of determinants, solve for $x$: $\\begin{vmatrix} x+a & b & c \\\\ a & x+b & c \\\\ a & b & x+c \\end{vmatrix} = 0$.",
        exam: "CBSE Class 12",
        year: "2020, 2022",
        marks: "4 marks",
        type: "Subjective Long Answer",
        options: null,
        answer: "Applying column operation $C_1 \\to C_1 + C_2 + C_3$, we get:\n$$\\begin{vmatrix} x+a+b+c & b & c \\\\ x+a+b+c & x+b & c \\\\ x+a+b+c & b & x+c \\end{vmatrix} = 0$$\nFactoring out $(x+a+b+c)$:\n$$(x+a+b+c) \\begin{vmatrix} 1 & b & c \\\\ 1 & x+b & c \\\\ 1 & b & x+c \\end{vmatrix} = 0$$\nApplying row operations $R_2 \\to R_2 - R_1$, $R_3 \\to R_3 - R_1$:\n$$(x+a+b+c) \\begin{vmatrix} 1 & b & c \\\\ 0 & x & 0 \\\\ 0 & 0 & x \\end{vmatrix} = 0$$\nExpanding yields: $$(x+a+b+c) \\cdot x^2 = 0 \\implies x=0 \\text{ or } x = -(a+b+c)$$."
      }
    ];
  } else {
    questions = [
      {
        question: "Explain the biochemical reactions that split water molecules during photosynthesis. What is this reaction called?",
        exam: "CBSE Class 11",
        year: "2021, 2023",
        marks: "3 marks",
        type: "Subjective Short Answer",
        options: null,
        answer: "The splitting of water molecules in the presence of light is called **Photolysis of Water**. This takes place on the inner side of the thylakoid membrane, mediated by the Oxygen Evolving Complex (OEC) associated with Photosystem II (PS II).\n\n**Reaction equation:**\n$$2\\text{H}_2\\text{O} \\xrightarrow{h\\nu} \\text{O}_2 + 4\\text{H}^+ + 4e^-$$\n- The electrons replace those lost by the reaction center of PS II ($P_{680}$).\n- The protons accumulate in the thylakoid lumen, creating a proton gradient.\n- Oxygen gas is released as a byproduct."
      }
    ];
  }

  return {
    type: "pyq",
    topic: topic,
    questions: questions,
    followups: [
      `Show me another determinant properties question`,
      `Explain the Oxygen Evolving Complex in photolysis`,
      `Which other topics in Biology are high frequency?`
    ]
  };
}

// === FUNCTION getDemoResponse ===
function getDemoResponse(query) {
  const q = query.toLowerCase();
  
  if (detectConversationalQuery(query)) {
    return "Hello! I am Bruhaspati AI. (This is a simulated demo response because API keys are missing or quota was exceeded).";
  }

  const topic = extractTopicFromQuery(query);
  let subject = state.subject;
  if (subject === 'All') {
    subject = detectSubjectFromQuery(query, 'Physics');
  }
  const classLevel = state.classLevel;
  const cleanTopic = topic !== 'Selected Topic' ? topic : 'this concept';
  const displaySubject = subject !== 'All' ? subject : 'your selected topic';
  
  const isDemoMatch = q.includes('lanthanoid') || q.includes('lanthanide') || q.includes('contraction') ||
                      q.includes('photosynthesis') || q.includes('calvin') || q.includes('chlorophyll') ||
                      q.includes('newton') || q.includes('inertia') || q.includes('force') || q.includes('motion') ||
                      q.includes('matrix') || q.includes('matrices') || 
                      (q.includes('report') && q.includes('rain') && q.includes('berhampur'));

  const codingBlacklist = [
    'coding', 'javascript', 'html', 'css', 'python code', 'program in', 'java code', 'c++ code', 
    'write code', 'build website', 'build web app', 'build mobile app', 'software code', 
    'develop a website', 'develop an app'
  ];

  const isOffTopic = codingBlacklist.some(term => q.includes(term));

  if (isOffTopic) {
    return {
      definition: "I am Bruhaspati AI, specialized in academic curricula. I cannot assist with writing software code or building applications, but I would be happy to help you with any academic subject!",
      mechanism: null,
      formula: null,
      diagram: null,
      analogy: null,
      example: null,
      examData: null,
      keywords: [],
      keywordsNote: "",
      quiz: null,
      quizAnswer: null,
      teacherTip: null,
      followups: []
    };
  }

  // Handle specific English report writing fallback query
  if (q.includes('report') && q.includes('rain') && q.includes('berhampur')) {
    return {
      definition: "**Report Writing** is a factual writing skill in CBSE Class 12 English Core. A report is a factual description of an event or incident, written in a clear, objective, and concise manner.\\n\\n**Topic:** Report on Rainfall in Berhampur (Odisha).",
      mechanism: [
        { step: 1, title: "Headline / Title", text: "Create an eye-catching, brief headline in bold (e.g., **HEAVY MONSOON RAINFALL LASHES BERHAMPUR**)." },
        { step: 2, title: "Byline", text: "State who wrote the report (e.g., *By Special Correspondent* or *By Rohan, Staff Reporter*)." },
        { step: 3, title: "Opening Paragraph", text: "Mention the **What, Where, When, and Who** (e.g., 'Berhampur, June 12: Record-breaking monsoon rainfall of 120mm lashing the silk city within 24 hours...')" },
        { step: 4, title: "Body Paragraphs", text: "Provide detailed facts: waterlogging in low-lying areas (like Haladiapadar), local administration response, traffic disruption, and quotes from local residents." },
        { step: 5, title: "Concluding Paragraph", text: "Mention the current situation, relief operations, and meteorological department alerts." }
      ],
      formula: `\\text{Report Writing Format Structure:}\\n\\n$$\\text{HEADLINE} \\\\ \\text{[Byline]} \\\\ \\text{[Place, Date: Lead Paragraph]} \\\\ \\text{[Body - Details of Event]} \\\\ \\text{[Conclusion/Action/Quotes]}$$`,
      diagram: `┌───────────────────────────────────────────────┐
│                   HEADLINE                    │
│                 [By Rohan]                    │
│                                               │
│ Berhampur, June 12: The silk city witnessed   │
│ torrential rains yesterday, leading to severe │
│ waterlogging. Key areas like Kamapalli and    │
│ Badabazar were inundated under 3 feet of      │
│ water.                                        │
│                                               │
│ Public transport ground to a halt. Local      │
│ municipal authorities (BeMC) deployed water   │
│ pumps to clear the streets.                   │
└───────────────────────────────────────────────┘`,
      analogy: "Think of a report like a news broadcast: it is strictly factual, written in the third person, uses passive voice (e.g., *'roads were flooded'* rather than *'water flooded roads'*), and avoids personal opinions.",
      example: "📝 **Report Writing Sample:**\n\n**HEAVY RAINFALL INUNDATES BERHAMPUR; NORMAL LIFE DISRUPTED**\n*By Amit, Staff Reporter*\n\n**Berhampur, June 12:** Severe monsoon rain lashed Berhampur on Thursday, dumping over 150mm of water. The sudden downpour caught residents off guard, causing knee-deep waterlogging in major areas including Kamapalli, Badabazar, and Gate Bazar. Municipal crews were seen working to clear blocked storm drains. The Met office has issued a yellow alert for the next 24 hours.",
      examData: [
        { exam: "CBSE Class 12 English", years: "2018, 2020, 2022", marks: "5 marks", type: "Writing Skills", frequency: "HIGH" },
        { exam: "CHSE Odisha English", years: "2019, 2021", marks: "10 marks", type: "Long Composition", frequency: "HIGH" }
      ],
      keywords: ["Headline", "Byline", "Factual description", "Third person", "Passive voice", "Waterlogging", "BeMC Relief"],
      keywordsNote: "Strict adherence to the 120-150 word limit and inclusion of format elements (Headline + Byline) guarantees full format marks.",
      quiz: "Which tense should primarily be used when writing a newspaper report about an event that occurred yesterday?",
      quizAnswer: "The **Past Tense** (specifically Simple Past and Past Passive voice) should be used, as you are reporting on an event that has already occurred.",
      teacherTip: "⚠️ **Common Mistake:** Avoid using 'I', 'we', or 'my' in a report. Always maintain an objective, third-person perspective."
    };
  }



  if (subject === 'English') {
    return {
      definition: `**${cleanTopic}** is an essential topic in **English Grammar / Writing Skills** under the **${state.board}** curriculum for **Class ${state.classLevel}**.

**Core Concept:** In English studies, **${cleanTopic.toLowerCase()}** refers to the structured set of rules, formats, or literary elements used to communicate effectively.`,
      mechanism: [
        { step: 1, title: "Core Rules & Identification", text: `Identify the primary rules governing **${cleanTopic.toLowerCase()}** in ${state.board} standards.` },
        { step: 2, title: "Structure & Application", text: "Understand the structural format or grammatical syntax. Pay attention to how sentence patterns change." },
        { step: 3, title: "Common Usage & Exercises", text: "Practice converting active patterns to correct expressions to secure high marks in writing sections." }
      ],
      formula: `\\text{General English Syntax Formula:}\\n\\n$$\\text{Subject} + \\text{Verb} + \\text{Object} \\quad \\xrightarrow{\\text{Passive}} \\quad \\text{Object} + \\text{Auxiliary Verb} + \\text{V}_3 + \\text{by} + \\text{Subject}$$`,
      diagram: `    [ ${cleanTopic.toUpperCase()} ]
               │
       ┌───────┴───────┐
       ▼               ▼
   [Format]        [Examples]
   CBSE Standard   Factual/Active`,
      analogy: `Think of **${cleanTopic.toLowerCase()}** like building blocks: every sentence or composition requires a specific ordering of nouns, verbs, or sections to convey the exact meaning clearly.`,
      example: `1. 📝 **Classroom Application**: Writing a formal draft matching the ${state.board} rubric.
2. 🗣️ **Everyday Communication**: Formulating polite requests or news reporting in active/passive structures.`,
      examData: [
        { exam: `${state.board} English`, years: "2019, 2021, 2023", marks: "4-5 marks", type: "Section B / C", frequency: "HIGH" }
      ],
      keywords: [cleanTopic, "Writing Format", "Grammar Rule", "Sentence Syntax", "Marking Rubric"],
      keywordsNote: "Ensure strict compliance with word limits in CBSE writing skills to prevent negative marking.",
      quiz: `What is the primary objective of mastering ${cleanTopic.toLowerCase()} in your board exams?`,
      quizAnswer: `To construct precise, grammatically accurate sentences and follow standard ${state.board} layout rubrics.`,
      teacherTip: `🧠 **Tip:** Always proofread your writing for tense consistency.

⚠️ **Mistake:** Mixing active and passive voice randomly in a single writing piece.`
    };
  }

  if (detectQuizQuery(query)) {
    return generateMockQuiz(topic, subject, classLevel, 4, ["MCQ", "True/False"], "Medium");
  }
  if (detectFormulaQuery(query)) {
    return generateMockFormulaSheet(topic, subject, classLevel);
  }
  if (detectPYQQuery(query)) {
    if (q.includes('matrix') || q.includes('matrices')) {
      return DEMO_RESPONSES.pyq_matrix;
    }
    return generateMockPYQ(topic, subject, classLevel);
  }

  if (q.includes('lanthanoid') || q.includes('lanthanide') || q.includes('contraction')) {
    return DEMO_RESPONSES.lanthanoid;
  }
  if (q.includes('photosynthesis') || q.includes('calvin') || q.includes('chlorophyll')) {
    return DEMO_RESPONSES.photosynthesis;
  }
  if (q.includes('newton') || q.includes('inertia') || q.includes('force') || q.includes('motion')) {
    return DEMO_RESPONSES.newton;
  }
  
  // Dynamic fallback generator if topic doesn't match static items

  
  return "⚠️ **Bruhaspati AI is currently in Offline Demo Mode.**\n\nNo valid API key was found for the selected provider. Please go to **Settings** and either select **Kimi (Built-in)** or enter your own Gemini/OpenAI API key to get real answers for your queries.\n\n*(The structured UI templates are only available when the AI is fully connected).*";
}

// === FUNCTION loadTokenState ===
function loadTokenState() {
  let saved = localStorage.getItem('bruhaspati_token_state');
  let today = new Date().toISOString().split('T')[0];
  
  if (saved) {
    tokenState = JSON.parse(saved);
    if (tokenState.date !== today) {
      tokenState.tokensUsed = 0;
      tokenState.date = today;
      saveTokenState();
    }
  } else {
    tokenState.date = today;
    tokenState.tokensUsed = 0;
    tokenState.plan = 'free';
    saveTokenState();
  }
  updateTokenMeterUI();
}

// === FUNCTION saveTokenState ===
function saveTokenState() {
  localStorage.setItem('bruhaspati_token_state', JSON.stringify(tokenState));
}

// === FUNCTION getPlanLimit ===
function getPlanLimit() {
  if (tokenState.plan === 'pro') return 100000;
  if (tokenState.plan === 'ultra') return Infinity;
  return 1000000; // free limit
}

// === FUNCTION updateTokenMeterUI ===
function updateTokenMeterUI() {
  const text = document.getElementById('tokenMeterText');
  const fill = document.getElementById('tokenMeterFill');
  const settingsText = document.getElementById('settingsTokenText');
  const settingsPercent = document.getElementById('settingsTokenPercent');
  const settingsFill = document.getElementById('settingsTokenFill');
  const settingsPlan = document.getElementById('settingsPlanTitle');
  
  let limit = getPlanLimit();
  let used = tokenState.tokensUsed;
  
  let limitStr = limit === Infinity ? 'Unlimited' : limit.toLocaleString();
  let usedStr = used.toLocaleString();
  
  if (text) text.textContent = `${usedStr} / ${limitStr}`;
  if (settingsText) settingsText.textContent = `${usedStr} / ${limitStr} tokens`;
  
  let pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100);
  let pctStr = Math.round(pct) + '%';
  if (settingsPercent) settingsPercent.textContent = pctStr;
  
  if (fill) {
    fill.style.width = pct + '%';
    fill.className = 'token-meter-fill';
    if (pct >= 90) fill.classList.add('red');
    else if (pct >= 75) fill.classList.add('amber');
  }
  if (settingsFill) {
    settingsFill.style.width = pct + '%';
    settingsFill.className = 'token-meter-fill';
    if (pct >= 90) settingsFill.classList.add('red');
    else if (pct >= 75) settingsFill.classList.add('amber');
  }
  
  if (settingsPlan) {
    if (tokenState.plan === 'pro') settingsPlan.textContent = 'Pro Prep Scholar Plan 🌟';
    else if (tokenState.plan === 'ultra') settingsPlan.textContent = 'Ultra Scholar Scholar Plan 🚀';
    else settingsPlan.textContent = 'Free Student Plan';
  }
  
  updateUpgradeModalUI();
}

// === FUNCTION updateUpgradeModalUI ===
function updateUpgradeModalUI() {
  const plan = tokenState.plan;
  const btnFree = document.getElementById('planFreeBtn');
  const btnPro = document.getElementById('planProBtn');
  const btnUltra = document.getElementById('planUltraBtn');
  
  if (btnFree) {
    btnFree.disabled = plan === 'free';
    btnFree.textContent = plan === 'free' ? 'Active' : 'Downgrade';
  }
  if (btnPro) {
    btnPro.disabled = plan === 'pro';
    btnPro.textContent = plan === 'pro' ? 'Active' : 'Upgrade';
  }
  if (btnUltra) {
    btnUltra.disabled = plan === 'ultra';
    btnUltra.textContent = plan === 'ultra' ? 'Active' : 'Upgrade';
  }
  
  document.querySelectorAll('.plan-card').forEach(c => c.style.borderColor = 'var(--border-color)');
  
  let cardFree = document.getElementById('planCardFree');
  let cardPro = document.getElementById('planCardPro');
  let cardUltra = document.getElementById('planCardUltra');
  
  if (plan === 'free' && cardFree) cardFree.style.borderColor = 'var(--accent-indigo)';
  if (plan === 'pro' && cardPro) cardPro.style.borderColor = 'var(--accent-indigo)';
  if (plan === 'ultra' && cardUltra) cardUltra.style.borderColor = 'var(--accent-emerald)';
}

