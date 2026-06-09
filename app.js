/* ====================================================
   BRUHASPATI AI — app.js (Upgraded Master Version)
   Full Chat Logic, Streaming SSE Reader, JSON Repair, 
   Voice STT/TTS, File upload, Quota & Session Managers
   ==================================================== */

// ---- STATE ----
let state = {
  board: 'CBSE',
  classLevel: '11',
  subject: 'All',
  messages: [],
  isTyping: false,
  theme: 'dark',
  fontSize: 'medium',
  reduceAnimations: false,
  language: 'English',
  format: 'structured',
  apiKey: 'REDACTED_API_KEY', // Hardcoded Gemini Key
  useRealAPI: true,
  currentChatId: null,
  history: [],
  isDemoFallback: false
};

// ---- SYSTEM PROMPT GENERATOR ----
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

You MUST respond in this exact JSON structure:
{
  "title": "Clear title of the topic",
  "essay": "The essay text content, formatted in pure paragraphs. Use double newlines for paragraph breaks. Remember: NO section headers, no bullets, and no labels.",
  "teacherTip": "A memory trick, exam strategy, or common mistake to avoid.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'quick_summary') {
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Give ONLY 5 bullet points, max 15 words each. No intro, no outro.
Format of each bullet point text: "• [point text]" (Note: do not include the bullet character in the JSON array items themselves, just write the text. The UI will render it).
Focus on the 5 most exam-important facts.

You MUST respond in this exact JSON structure:
{
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
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Focus ONLY on exam preparation. Skip all general theory explanation.
Include:
1. Most likely exam question phrasings for {{BOARD}}
2. Model answer (100-150 words, board-style)
3. Keywords the examiner expects (bold them)
4. Common mistakes that lose marks
5. PYQ occurrences with year and marks

You MUST respond in this exact JSON structure:
{
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

You MUST respond in this exact JSON structure:
{
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
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Give a comprehensive, university-level deep dive on this topic.
Include: historical context, multiple theoretical frameworks, advanced applications, research significance, connections to other topics in the curriculum, and references to NCERT chapters where applicable.
Minimum 800 words. Use sub-headings like ### Subheading.

You MUST respond in this exact JSON structure:
{
  "topic": "Topic name",
  "researchText": "The comprehensive deep dive text content (min 800 words). Use sub-headings prefixed with ### for sections. Bold key terms using **term**.",
  "teacherTip": "An advanced research-level tip or memory trick.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;
  } else if (format === 'graph_visual') {
    basePrompt = `You are "Bruhaspati AI," an expert tutor for Indian students.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}.

Describe this concept in a way that is HIGHLY VISUAL.
Include:
- ASCII diagram or described graph/chart (using box-drawing characters if possible)
- Step-by-step description of what any graph would look like (coordinates, axes labels, curve shapes where applicable)
- Table of values if relevant
- Color-coded mental model description
Then follow with a concise explanation.

You MUST respond in this exact JSON structure:
{
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

You MUST respond in this exact JSON structure:
{
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
    basePrompt = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.
Board: {{BOARD}} | Class: {{CLASS}} | Subject: {{SUBJECT}}

MANDATORY RESPONSE FORMAT — Always respond in this exact JSON structure:
{
  "definition": "Clear definition — simple first sentence, then formal/NCERT version. Bold key terms using **term**.",
  "mechanism": [
    {"step": 1, "title": "Step Title", "text": "Explanation with **bold** key terms"}
  ],
  "formula": "Chemical equation or mathematical formula or null if not applicable. ALWAYS use LaTeX notation wrapped in $$ (e.g. $$\\text{6CO}_2 + \\text{6H}_2\\text{O} \\xrightarrow{\\text{Light}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{6O}_2$$ or $$F = G \\frac{m_1 m_2}{r^2}$$).",
  "diagram": "ASCII text diagram or structured text representation of the standard diagram",
  "analogy": "A relatable real-world analogy starting with 'Think of...' or 'Imagine...'",
  "example": "2 practical real-world examples of this concept",
  "examData": [
    {"exam": "{{BOARD}} Class {{CLASS}}", "years": "2019, 2022", "marks": "3 marks", "type": "Short Answer", "frequency": "HIGH"}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "keywordsNote": "Include these exact terms for full marks in board exams",
  "quiz": "A thought-provoking question testing understanding of this concept. Use $ for inline math or chemical symbols.",
  "quizAnswer": "The correct answer to the quick quiz question with a clear explanation. Use LaTeX if needed.",
  "teacherTip": "A memory trick or common mistake to avoid",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Always use the JSON format above — no deviations
2. Never give direct homework answers — guide step by step
3. Adapt complexity to the board/class level in context
4. For all math, physics, or chemistry variables/equations, use standard LaTeX syntax wrapped in $ for inline and $$ for blocks.
5. End with 3 highly relevant follow-up questions in the "followups" array.`;
  }
  
  return basePrompt
    .replace(/{{BOARD}}/g, state.board)
    .replace(/{{CLASS}}/g, state.classLevel)
    .replace(/{{SUBJECT}}/g, state.subject);
}

// ---- SYSTEM PROMPT FOR PYQ REQUESTS ----
const PYQ_SYSTEM_PROMPT = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.

Your current context: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

The student is asking for Previous Year Questions (PYQs), exam questions, or practice questions for a specific chapter/topic.
You MUST respond in this exact JSON structure:
{
  "type": "pyq",
  "topic": "The topic or chapter name",
  "questions": [
    {
      "question": "The actual question text (MCQ, Short Answer, or Long Answer). Use LaTeX syntax wrapped in $ for inline (e.g. $x^2$) and $$ for block math (e.g. $$y = mx + c$$) for all formulas, chemical equations, or matrices.",
      "exam": "The board or exam name (e.g. CBSE Class 12, JEE Main, CHSE Odisha)",
      "year": "The year(s) this question or a similar one appeared (e.g. 2023, 2020)",
      "marks": "Marks weightage (e.g., 5 marks, 4 marks)",
      "type": "Question type (e.g., Long Answer, MCQ, Numerical)",
      "options": ["Option A", "Option B", "Option C", "Option D"], // ONLY include this array if the question is a multiple-choice question (MCQ), otherwise set options to null
      "answer": "The step-by-step correct answer and explanation. Bold key terms or final answers using **term**. Use standard LaTeX for equations."
    }
  ],
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Return exactly 3-5 real or highly representative PYQs/important practice questions for this topic/chapter.
2. Adapt the exam details to the current context (e.g. if context is CBSE, prioritize CBSE board questions; if context is JEE, prioritize JEE Main/Adv questions).
3. Do NOT include definitions, mechanisms, or other sections in your text response. Only output the JSON structure above.
4. For all math/science equations, chemical reactions, matrices, and variables, you MUST use standard LaTeX syntax. Wrap inline math in single $ signs and block equations or matrices in double $$ signs.
5. End with 3 highly relevant follow-up questions in the "followups" array.`;

// ---- SYSTEM PROMPT FOR INTERACTIVE QUIZZES ----
const QUIZ_SYSTEM_PROMPT = `You are "Bruhaspati AI quiz generator."
Generate EXACTLY {{COUNT}} questions. Not fewer. Not more. EXACTLY {{COUNT}}.

Subject: {{SUBJECT}} | Class: {{CLASS}} | Chapter: {{TOPIC}} | Board: {{BOARD}}
Difficulty: {{DIFFICULTY}}
Question types to include: {{TYPES}}

Return ONLY a valid JSON structure with exactly {{COUNT}} questions. No preamble, no explanation, no markdown.

Format as JSON:
{
  "type": "quiz",
  "topic": "{{TOPIC}}",
  "questions": [
    {
      "id": number,
      "type": "mcq" | "truefalse" | "fillinblank" | "shortanswer",
      "question": "The question text. Use LaTeX wrapped in $ for inline (e.g. $F = ma$) or $$ for block formulas.",
      "options": ["A)...", "B)...", "C)...", "D)..."],  // only for MCQ/TrueFalse (True/False should have ["True", "False"])
      "answer": "The exact correct option string or key word (must match one of the options above exactly)",
      "explanation": "The step-by-step correct answer and explanation. Bold key terms or steps using **term**. Use standard LaTeX.",
      "marks": number,
      "difficulty": "easy"|"medium"|"hard",
      "pyq_year": "string or null"
    }
  ],
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

IMPORTANT: The "questions" array must have EXACTLY {{COUNT}} elements. Count them before responding.`;

// ---- SYSTEM PROMPT FOR FORMULA SHEETS ----
const FORMULA_SYSTEM_PROMPT = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.

Your current context: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

The student wants a comprehensive formula sheet / key summary for a specific topic/chapter.
You MUST respond in this exact JSON structure:
{
  "type": "formula_sheet",
  "topic": "The topic or chapter name",
  "formulas": [
    {
      "name": "Formula Name (e.g. Coulomb's Law, Quadratic Formula)",
      "equation": "The equation/formula block in LaTeX format wrapped in double $$ signs (e.g. $$F = \\frac{k \\cdot q_1 \\cdot q_2}{r^2}$$ or $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$). If non-mathematical, write the key rule or balanced chemical equation in LaTeX.",
      "terms": "Explanation of individual variables/terms (e.g., F = Force, q1/q2 = Charges). Use $ ... $ for inline variables.",
      "note": "A short pedagogical tip or application note (e.g., 'Only valid for point charges')."
    }
  ],
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Return 4-8 key formulas or core equations for this topic. If the topic is non-mathematical (e.g. English, History), return key terms, dates, or rules.
2. Only output the JSON structure above. No intro or outro text.
3. Ensure all equations and variables are formatted in valid LaTeX wrapped in $ or $$.
4. End with 3 highly relevant follow-up questions in the "followups" array.`;

// ---- CHAPTER AUTOCOMPLETE DATABASE ----
const CHAPTERS_DB = {
  CBSE: {
    "10": {
      Physics: ["Light - Reflection and Refraction", "Human Eye and Colorful World", "Electricity", "Magnetic Effects of Electric Current", "Sources of Energy"],
      Chemistry: ["Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals", "Carbon and its Compounds", "Periodic Classification of Elements"],
      Biology: ["Life Processes", "Control and Coordination", "How do Organisms Reproduce?", "Heredity and Evolution", "Our Environment", "Management of Natural Resources"],
      Mathematics: ["Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry", "Some Applications of Trigonometry", "Circles", "Constructions", "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"]
    },
    "11": {
      Physics: ["Physical World", "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion", "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"],
      Chemistry: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure", "States of Matter", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block Elements", "p-Block Elements", "Organic Chemistry - Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry"],
      Mathematics: ["Sets", "Relations and Functions", "Trigonometric Functions", "Principle of Mathematical Induction", "Complex Numbers and Quadratic Equations", "Linear Inequalities", "Permutations and Combinations", "Binomial Theorem", "Sequence and Series", "Straight Lines", "Conic Sections", "Introduction to Three Dimensional Geometry", "Limits and Derivatives", "Mathematical Reasoning", "Statistics", "Probability"],
      Biology: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals", "Cell : The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Transport in Plants", "Mineral Nutrition", "Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Digestion and Absorption", "Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"]
    },
    "12": {
      Physics: ["Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics: Materials, Devices and Simple Circuits", "Communication Systems"],
      Chemistry: ["Solutions", "Electrochemistry", "Chemical Kinetics", "The d & f Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"],
      Mathematics: ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants", "Continuity and Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vector Algebra", "Three Dimensional Geometry", "Linear Programming", "Probability"],
      Biology: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Microbes in Human Welfare", "Biotechnology: Principles and Processes", "Biotechnology and its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation"]
    }
  },
  CHSE: {
    "11": {
      Physics: ["Physical World and Measurement", "Kinematics", "Laws of Motion", "Work, Energy and Power", "Motion of System of Particles and Rigid Body", "Gravitation", "Properties of Bulk Matter", "Thermodynamics", "Behavior of Perfect Gas and Kinetic Theory", "Oscillations and Waves"],
      Chemistry: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure", "States of Matter: Gases and Liquids", "Chemical Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen", "s-Block Elements", "p-Block Elements", "Organic Chemistry: Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry"],
      Mathematics: ["Sets and Functions", "Algebra", "Coordinate Geometry", "Calculus", "Mathematical Reasoning", "Statistics and Probability"]
    },
    "12": {
      Physics: ["Electrostatics", "Current Electricity", "Magnetic Effects of Current and Magnetism", "Electromagnetic Induction and Alternating Currents", "Electromagnetic Waves", "Optics", "Dual Nature of Radiation and Matter", "Atoms and Nuclei", "Electronic Devices", "Communication Systems"],
      Chemistry: ["Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "Metallurgy", "p-Block Elements", "d- and f-Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life"],
      Mathematics: ["Relations and Functions", "Algebra (Matrices & Determinants)", "Calculus (Integrals & Derivatives)", "Vectors and Three-Dimensional Geometry", "Linear Programming", "Probability"]
    }
  },
  BSE: {
    "10": {
      Physics: ["Physical Science - Chemical Reactions", "Acids Bases Salts", "Metals Nonmetals", "Carbon Compounds", "Periodic Classification", "Electricity", "Magnetic Effects", "Sources of Energy"],
      Biology: ["Life Science - Life Processes", "Control Coordination", "Reproduction", "Heredity Evolution", "Our Environment", "Natural Resources Management"],
      Mathematics: ["Real Numbers", "Quadratic Equations", "Arithmetic Progression", "Probability", "Statistics", "Trigonometric Identites", "Mensuration"]
    }
  }
};

// Add fallback chapters database for entrance exams
const ENTRANCE_CHAPTERS = {
  JEE: ["Electrostatics", "Current Electricity", "Magnetic Effects of Current", "Thermodynamics", "Wave Optics", "Matrices and Determinants", "Complex Numbers", "Limits & Continuity", "Definite Integrals", "Chemical Bonding", "Chemical Kinetics", "Coordination Compounds", "Hydrocarbons"],
  NEET: ["Human Physiology", "Plant Physiology", "Genetics and Evolution", "Cell Structure and Division", "Mechanics & Gravitation", "Optics & Wave Motion", "Organic Chemistry Basics", "Electrochemistry", "Chemical Equilibrium"],
  IAT: ["Classical Mechanics", "Electromagnetism", "Quantum Physics", "Organic Reaction Mechanisms", "Calculus", "Probability", "Genetics", "Ecology"]
};

// ---- QUERY DETECTORS ----
function detectPYQQuery(query) {
  const q = query.toLowerCase();
  const keywords = ['pyq', 'pyqs', 'previous year', 'past paper', 'board paper', 'exam question', 'important question', 'question bank', 'practice question', 'past year'];
  return keywords.some(kw => q.includes(kw));
}

function detectQuizQuery(query) {
  const q = query.toLowerCase();
  return q.includes('generate a quiz') || q.includes('interactive test') || q.includes('quiz on') || q.includes('test my knowledge') || q.includes('take a quiz');
}

function detectFormulaQuery(query) {
  const q = query.toLowerCase();
  return q.includes('generate a formula sheet') || q.includes('formula sheet for') || q.includes('key formula summary') || q.includes('formula sheet of') || q.includes('formula summary');
}

function extractTopicFromQuery(query) {
  const matchQuiz = query.match(/generate a quiz on\s+(.+?)\s+for/i) || query.match(/quiz on\s+(.+)/i);
  if (matchQuiz) return matchQuiz[1].trim();

  const matchFormula = query.match(/generate a formula sheet for\s+(.+?)\s+for/i) || query.match(/formula sheet for\s+(.+)/i) || query.match(/formula sheet of\s+(.+)/i);
  if (matchFormula) return matchFormula[1].trim();

  const matchPYQ = query.match(/generate pyq practice questions for\s+(.+?)\s+for/i) || query.match(/pyqs of\s+(.+)/i) || query.match(/pyq practice\s+(.+)/i);
  if (matchPYQ) return matchPYQ[1].trim();

  // Try to remove standard question prefixes to get the core topic
  let clean = query.replace(/^(what is|what are|explain|describe|tell me about|how does|why does|teach me about|discuss|solve|find the)\s+/i, '');
  clean = clean.replace(/\?$/, '').trim();
  
  if (clean.length > 0) {
    // Capitalize first letters of each word
    return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return "Selected Topic";
}

// ---- DEMO RESPONSES ----
const DEMO_RESPONSES = {
  lanthanoid: {
    definition: "**Lanthanoid Contraction** refers to the steady, gradual decrease in the atomic and ionic radii of elements in the lanthanoid series (from Lanthanum, $Z=57$ to Lutetium, $Z=71$) with the increase in atomic number.\n\n**Formal (NCERT):** The regular decrease in the atomic and ionic radii of the lanthanoids with increasing atomic number is known as **lanthanoid contraction**. It arises due to the **imperfect shielding** of one $4f$ electron by another in the same subshell.",
    mechanism: [
      { step: 1, title: "Poor 4f Shielding", text: "As we move along the lanthanoid series, the nuclear charge increases by one unit at each step. The new electron enters the inner **$4f$ subshell**." },
      { step: 2, title: "Ineffective Screening", text: "Due to the **diffuse shape** of $4f$ orbitals, the shielding (screening) effect of $4f$ electrons is extremely poor. They fail to protect outer electrons from the growing positive charge of the nucleus." },
      { step: 3, title: "Increased Nuclear Pull", text: "As a result, the **effective nuclear charge ($Z_{\\text{eff}}$)** experienced by the outermost electrons increases steadily. This pulls the electron cloud closer, shrinking the atom/ion." }
    ],
    formula: "Atomic Radius Trend:\nLa (187 pm) > Ce (183 pm) > ... > Lu (173 pm)\n\nIonic Radius (M³⁺) Trend:\nLa³⁺ (103 pm) > Ce³⁺ (102 pm) > ... > Lu³⁺ (86 pm)\n\nZ_eff = Z - S\n(Z = Actual Nuclear Charge, S = Shielding Constant)",
    diagram: `  INCREASING ATOMIC NUMBER (Z = 57 to 71) ───►
  
   [La: 187 pm]    [Ce: 183 pm]     ...     [Lu: 173 pm]
    (●●●●●●●)       (●●●●●●)                 (●●●●)
        ▲               ▲                       ▲
        │               │                       │
      Stronger Nuclear Attraction (Z_eff increases)
      due to poor shielding of diffuse 4f orbitals`,
    analogy: "Imagine a teacher (the nucleus) trying to keep eyes on students in the back row (outer electrons). If there is a **solid wall** (dense $s$ or $p$ shielding) between them, the teacher can't see the back row, and they can sit far away. But if the middle rows are **misty glass** (diffuse $4f$ orbitals), the teacher's gaze passes right through, pulling the back row closer to stay in view.",
    example: "1. 👯 **The Chemical Twins (Zr and Hf)**: Zirconium ($4d$ series, $Zr = 160\\text{ pm}$) and Hafnium ($5d$ series, $Hf = 159\\text{ pm}$) have almost identical sizes due to lanthanoid contraction, making their separation extremely difficult.\n2. 🧪 **Basicity Variation**: Basic strength of hydroxides decreases from $\\text{La(OH)}_3$ (most basic) to $\\text{Lu(OH)}_3$ (least basic) because smaller ionic size increases covalent character.",
    examData: [
      { exam: "CBSE Class 12", years: "2018, 2020, 2022, 2023", marks: "3 marks", type: "Short Answer", frequency: "HIGH" },
      { exam: "BSE Odisha", years: "2019, 2021, 2022", marks: "3 + 5 marks", type: "Short/Long Answer", frequency: "HIGH" },
      { exam: "NEET UG", years: "2019, 2020, 2022, 2023", marks: "4 marks (MCQ)", type: "Zr/Hf and Basicity MCQ", frequency: "HIGH" }
    ],
    keywords: ["Imperfect shielding of 4f electrons", "Diffuse shape of 4f orbitals", "Zirconium (Zr) and Hafnium (Hf)", "Effective nuclear charge", "Basicity of hydroxides"],
    keywordsNote: "CBSE and State Board marking schemes require the phrase 'imperfect shielding of 4f electrons' to award full marks for the cause.",
    quiz: "Why do Zirconium (Zr) and Hafnium (Hf) exhibit almost identical physical and chemical properties, despite belonging to different transition series (4d and 5d)?",
    quizAnswer: "They have almost identical covalent and ionic radii ($Zr = 160\\text{ pm}$, $Hf = 159\\text{ pm}$) as a direct consequence of **Lanthanoid Contraction**, which compensates for the expected increase in size down the group.",
    teacherTip: "🧠 **Memory Mnemonic:** 'P-I-N-C-H' — **P**oor screening → **I**ncreased **N**uclear charge → **C**ontraction of size → **H**afnium/Zirconium identical!\n\n⚠️ **Common Exam Mistake:** Many students write that the size decreases because electrons are added to the outer shell. Remember, the $4f$ subshell is an *inner* subshell, and size decreases because of *poor shielding*, not just electron addition.",
    followups: [
      "Explain the consequences of lanthanoid contraction on basicity of hydroxides",
      "Why is the shielding effect of 4f electrons poorer than 3d electrons?",
      "Compare Lanthanoid and Actinoid contraction"
    ]
  },
  photosynthesis: {
    definition: "**Photosynthesis** is the process by which green plants prepare their own food using sunlight, water, and carbon dioxide.\n\n**Formal (NCERT):** Photosynthesis is a physicochemical process by which **photosynthetic organisms** use **light energy** to drive the synthesis of organic compounds from **CO₂** and **H₂O**, releasing **O₂** as a by-product.",
    mechanism: [
      { step: 1, title: "Light Absorption", text: "**Chlorophyll** pigments in the **thylakoid membrane** absorb sunlight (primarily red and blue wavelengths)." },
      { step: 2, title: "Light Reactions (Thylakoid)", text: "Water molecules are split (**photolysis**) → releases O₂ + produces **ATP** and **NADPH** (energy currency)." },
      { step: 3, title: "Calvin Cycle / Dark Reactions (Stroma)", text: "CO₂ is fixed using ATP and NADPH → **Glucose (C₆H₁₂O₆)** is synthesized via the **C3 pathway** (RuBisCO enzyme)." }
    ],
    formula: "6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂\n\nLight Reactions:  2H₂O → O₂ + 4H⁺ + 4e⁻\nCalvin Cycle:     3CO₂ + 9ATP + 6NADPH → G3P",
    diagram: `           SUNLIGHT ☀️
                ↓
    ┌───────────────────────────┐
    │    CHLOROPLAST             │
    │                           │
    │  ┌─────────────────────┐  │
    │  │   THYLAKOID STACK    │  │
    │  │  (Grana)            │  │
    │  │  H₂O → O₂ + ATP    │  │  ← LIGHT REACTIONS
    │  │       + NADPH       │  │
    │  └─────────────────────┘  │
    │            ↓               │
    │  ┌─────────────────────┐  │
    │  │      STROMA         │  │
    │  │  CO₂ + ATP + NADPH  │  │  ← CALVIN CYCLE
    │  │  → GLUCOSE C₆H₁₂O₆  │  │
    │  └─────────────────────┘  │
    └───────────────────────────┘`,
    analogy: "Think of the chloroplast as a **solar-powered food factory**. The roof (thylakoid/chlorophyll) is the solar panel that captures sunlight. The factory floor (stroma) is where raw materials (CO₂ + water) are converted into packaged food (glucose) using that captured solar energy.",
    example: "1. 🌿 **Every green vegetable you eat** (spinach, broccoli) exists because photosynthesis built it from CO₂ and sunlight.\n2. 🌊 **The oxygen you breathe right now** was released as a by-product of photosynthesis happening in forests, grasslands, and ocean algae.",
    examData: [
      { exam: "CBSE Class 10", years: "2018, 2019, 2022, 2023", marks: "5 marks", type: "Long Answer", frequency: "HIGH" },
      { exam: "CBSE Class 11", years: "2019, 2020, 2022, 2023", marks: "3 + 5 marks", type: "Short/Long Answer", frequency: "HIGH" },
      { exam: "NEET UG", years: "2019, 2021, 2022, 2023", marks: "4 marks (MCQ)", type: "C3/C4 pathway MCQ", frequency: "HIGH" }
    ],
    keywords: ["Photolysis of water", "Calvin Cycle", "RuBisCO enzyme", "Chlorophyll pigment", "ATP and NADPH"],
    keywordsNote: "CBSE marking scheme requires these exact terms for full marks. Missing 'photolysis' or 'RuBisCO' costs 1 mark!",
    quiz: "If a plant is kept in a completely dark room for 24 hours, which part of photosynthesis will stop FIRST — the Light Reactions or the Calvin Cycle? And why?",
    quizAnswer: "**The Light Reactions** will stop first because they directly require photons (sunlight) to split water and excite electrons. The Calvin Cycle will continue briefly using the remaining ATP and NADPH before also stopping.",
    teacherTip: "🧠 **Memory Trick:** 'LET'S GO' — **L**ight reactions → **E**lectron transport → **T**hylakoid = **S**troma → **G**lucose **O**utput!\n\n⚠️ **Common Mistake:** Students write that photosynthesis stops at night — WRONG! The Calvin Cycle can continue briefly using stored ATP/NADPH. Only the LIGHT reactions stop instantly.",
    followups: [
      "Explain the photolysis of water in detail",
      "What is the difference between C3 and C4 plants?",
      "How is this topic commonly asked in CHSE Odisha?"
    ]
  },
  newton: {
    definition: "**Newton's Laws of Motion** are three fundamental physical laws that describe the relationship between the **motion of an object** and the **forces acting on it**.\n\n**Formal (NCERT):** Three laws formulated by **Sir Isaac Newton** (1687, *Principia Mathematica*) that form the foundation of **classical mechanics**, governing the behavior of objects at everyday speeds.",
    mechanism: [
      { step: 1, title: "First Law — Law of Inertia", text: "An object remains at **rest** or in **uniform motion** in a straight line UNLESS acted upon by an external **net force**. (**Inertia** = tendency to resist change in motion)" },
      { step: 2, title: "Second Law — Law of Acceleration", text: "The **net force** acting on an object equals the product of its **mass** and **acceleration**: **F = ma**. Heavier objects need more force to accelerate the same amount." },
      { step: 3, title: "Third Law — Law of Action-Reaction", text: "For every **action**, there is an **equal and opposite reaction**. Forces always come in pairs — you push the wall, the wall pushes you back with the same force." }
    ],
    formula: "First Law:   If F_net = 0  →  v = constant (or 0)\n\nSecond Law:  F = ma\n             (Force = mass × acceleration)\n             Units: Newton (N) = kg⋅m/s²\n\nThird Law:   F_12 = -F_21\n             (Action force = -Reaction force)",
    diagram: `FIRST LAW (Inertia):
  [Ball at Rest] ──── No Force ────→ [Still at Rest] ✓

SECOND LAW (F = ma):
  ┌──────┐    F →        ┌──────┐
  │ 10kg │ ──────────→  │ 10kg │  a = F/m = F/10
  └──────┘              └──────┘

THIRD LAW (Action-Reaction):
  ──── F_action ────→  ┤ WALL
  ┤ WALL  ←──── F_reaction ────`,
    analogy: "**First Law:** When a bus suddenly brakes, passengers lurch forward — their bodies want to *keep moving* (inertia).\n**Second Law:** Pushing a loaded cart vs. an empty one — same push, less acceleration for heavier cart.\n**Third Law:** A rocket launches because hot gases push *down*, and the reaction force pushes the rocket *up*.",
    example: "1. 🚀 **Rocket propulsion** — gases expelled downward (action) → rocket moves upward (reaction) — Third Law in action.\n2. 🏏 **Cricket ball hitting a bat** — the bat exerts force on the ball (F=ma) to change its direction and speed — Second Law.",
    examData: [
      { exam: "CBSE Class 9", years: "2017, 2019, 2021, 2022, 2023", marks: "3 + 5 marks", type: "Short + Long Answer", frequency: "HIGH" },
      { exam: "JEE Main", years: "Every year (2015–2024)", marks: "4 marks (MCQ)", type: "Application-based MCQ", frequency: "HIGH" }
    ],
    keywords: ["Inertia", "Net external force", "F = ma", "Action-reaction pair", "Law of conservation of momentum"],
    keywordsNote: "CBSE requires 'net external force' (not just 'force') and 'action-reaction PAIR' (not just 'equal and opposite') for full marks.",
    quiz: "A 5 kg book rests on a table. According to Newton's Third Law, what is the 'reaction' to the gravitational force (weight) pulling the book down? Hint: The answer is NOT the normal force from the table!",
    quizAnswer: "The reaction is the **gravitational force exerted by the book pulling the Earth upward** with an equal force. Action-reaction pairs must act on *different* interacting bodies (Book-on-Earth and Earth-on-book), whereas the normal force acts on the same book.",
    teacherTip: "🧠 **Memory Trick:** '**IRE**' — **I**nertia (1st), **R**ate of change of momentum (2nd), **E**qual & opposite (3rd).\n\n⚠️ **Most Common Exam Mistake:** Students confuse the 'action-reaction pair' in Third Law. Action & Reaction always act on *DIFFERENT* objects — never the same object!",
    followups: [
      "Differentiate between mass and weight using Newton's Laws",
      "Give a 3D vector explanation of the Second Law",
      "How is conservation of momentum derived from Newton's Laws?"
    ]
  },
  default: {
    definition: "This is a foundational concept in your chosen subject. Let me provide a clear, structured explanation!\n\n**Formal Definition:** A precisely defined concept from the NCERT/board curriculum with specific technical terminology that you need to know for your examination.",
    mechanism: [
      { step: 1, title: "Understanding the Core Concept", text: "Every concept builds on a **foundational principle**. Start by identifying WHAT it is before HOW it works." },
      { step: 2, title: "The Process / Working", text: "Understand the **step-by-step mechanism** — this is what 5-mark questions test in board exams." }
    ],
    formula: "Relevant formula or equation for this topic\n(Adapted based on subject — Chemistry: balanced equations, Physics: derivations, Math: theorems)",
    diagram: `  ┌─────────────────────────────┐
  │   STANDARD DIAGRAM          │
  │                             │
  │   [Component A] ──→ [B]    │
  │                             │
  └─────────────────────────────┘`,
    analogy: "Think of this concept like something familiar in daily life — a great analogy makes even complex ideas easy to visualize and remember for exams.",
    example: "1. 🌍 **Real-world Application 1** — How this concept appears in everyday life.\n2. 🔬 **Real-world Application 2** — Another context where this concept is at work.",
    examData: [
      { exam: "CBSE Board", years: "Appears regularly", marks: "3-5 marks", type: "Short/Long Answer", frequency: "HIGH" }
    ],
    keywords: ["Key Term 1", "Key Term 2", "Key Term 3"],
    keywordsNote: "These keywords are required by official marking schemes for full marks.",
    quiz: "Can you explain this concept in your own words?",
    quizAnswer: "A great explanation should include the **definition**, its **mechanism or formulas**, and the **key board keywords** highlighted above.",
    teacherTip: "🧠 **Tip:** Create a mnemonic using the first letters of key points.",
    followups: [
      "Can you give another real-world example of this?",
      "How is this topic weightaged in board exams?",
      "Are there any numericals related to this?"
    ]
  },
  pyq_matrix: {
    type: "pyq",
    topic: "Matrices",
    questions: [
      {
        question: "If A is a square matrix of order 3 such that |adj A| = 64, find the value of |A|.",
        exam: "CBSE Class 12",
        year: "2023",
        marks: "2 marks",
        type: "Short Answer",
        options: null,
        answer: "We know that for a square matrix of order $n$, $|\\text{adj } A| = |A|^{n-1}$.\n\nGiven:\n- Order $n = 3$\n- $|\\text{adj } A| = 64$\n\nSubstituting the values:\n$$|A|^{3-1} = 64$$\n$$|A|^2 = 64$$\n$$|A| = \\pm 8$$\n\nThus, the value of $|A|$ is **$\\pm 8$**."
      },
      {
        question: "Find the values of $x, y, z$ if the matrix $A = \\begin{bmatrix} 0 & 2y & z \\\\ x & y & -z \\\\ x & -y & z \\end{bmatrix}$ satisfies the equation $A^T A = I$.",
        exam: "JEE Main",
        year: "2021, 2022",
        marks: "4 marks",
        type: "MCQ",
        options: ["$x = \\pm \\frac{1}{\\sqrt{2}}, y = \\pm \\frac{1}{\\sqrt{6}}, z = \\pm \\frac{1}{\\sqrt{3}}$", "$x = \\pm \\frac{1}{2}, y = \\pm \\frac{1}{3}, z = \\pm \\frac{1}{6}$", "$x = \\pm \\frac{1}{\\sqrt{3}}, y = \\pm \\frac{1}{\\sqrt{2}}, z = \\pm \\frac{1}{\\sqrt{6}}$", "None of these"],
        answer: "Since $A^T A = I$, we calculate the product of the transpose of $A$ and $A$:\n\n$$A^T = \\begin{bmatrix} 0 & x & x \\\\ 2y & y & -y \\\\ z & -z & z \\end{bmatrix}$$\n\nMultiplying $A^T$ and $A$, and equating to the Identity Matrix $I = \\begin{bmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}$:\n\n1. From the (1,1) entry: $x^2 + x^2 = 1 \\implies 2x^2 = 1 \\implies x = \\pm \\frac{1}{\\sqrt{2}}$\n2. From the (2,2) entry: $4y^2 + y^2 + y^2 = 1 \\implies 6y^2 = 1 \\implies y = \\pm \\frac{1}{\\sqrt{6}}$\n3. From the (3,3) entry: $z^2 + z^2 + z^2 = 1 \\implies 3z^2 = 1 \\implies z = \\pm \\frac{1}{\\sqrt{3}}$\n\nThus, the correct option is **A**."
      }
    ],
    followups: [
      "How to find the inverse of a 3x3 matrix using elementary operations?",
      "Define Skew-Symmetric matrices with examples",
      "What are the CBSE weightages for Matrix operations?"
    ]
  }
};

// ---- UTILITY: Mock Quiz Generator ----
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

// ---- UTILITY: Mock Formula Sheet Generator ----
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

// ---- UTILITY: Mock PYQ Generator ----
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

function detectSubjectFromQuery(query, fallbackSubject) {
  const q = query.toLowerCase();
  
  const chemKeywords = [
    'chemistry', 'lanthanoid', 'lanthanide', 'actinoid', 'actinide', 'contraction', 'reaction', 'equation', 
    'molecule', 'molecular', 'atomic', 'atom', 'bonding', 'bond', 'acid', 'base', 'organic', 'inorganic', 
    'compound', 'element', 'periodic table', 'solubility', 'kinetics', 'electrochemistry', 'alcohol', 
    'phenol', 'ether', 'aldehyde', 'ketone', 'carboxylic', 'amine', 'polymer', 'biomolecule', 'catalyst',
    'valency', 'oxidation', 'reduction', 'molarity', 'molality', 'stoichiometry', 'coordination', 'hydroxide'
  ];
  
  const physKeywords = [
    'physics', 'force', 'motion', 'newton', 'inertia', 'gravity', 'gravitation', 'optics', 'lens', 'mirror', 
    'wave', 'light', 'electricity', 'current', 'voltage', 'resistance', 'capacitor', 'magnetic', 'magnetism', 
    'thermodynamics', 'work', 'energy', 'power', 'velocity', 'acceleration', 'speed', 'quantum', 'photoelectric', 
    'semiconductor', 'diode', 'transistor', 'nucleus', 'nuclear', 'radioactivity'
  ];
  
  const mathKeywords = [
    'math', 'mathematics', 'calculus', 'derivative', 'integration', 'integral', 'matrix', 'matrices', 
    'determinant', 'vector', 'probability', 'statistics', 'algebra', 'geometry', 'trigonometry', 'theorem', 
    'equation', 'function', 'limit', 'continuity', 'differentiability', 'permutation', 'combination', 
    'complex number', 'quadratic', 'sequence', 'series'
  ];

  const bioKeywords = [
    'biology', 'photosynthesis', 'calvin', 'chlorophyll', 'cell', 'division', 'mitosis', 'meiosis', 
    'genetics', 'evolution', 'dna', 'rna', 'gene', 'chromosome', 'protein', 'enzyme', 'physiology', 
    'respiration', 'digestion', 'circulation', 'nervous', 'hormone', 'plant', 'animal', 'human', 
    'organism', 'ecology', 'environment', 'reproduction'
  ];

  if (chemKeywords.some(kw => q.includes(kw))) return 'Chemistry';
  if (physKeywords.some(kw => q.includes(kw))) return 'Physics';
  if (mathKeywords.some(kw => q.includes(kw))) return 'Mathematics';
  if (bioKeywords.some(kw => q.includes(kw))) return 'Biology';

  return fallbackSubject !== 'All' ? fallbackSubject : 'Physics';
}

function getDemoResponse(query) {
  const q = query.toLowerCase();
  const topic = extractTopicFromQuery(query);
  let subject = state.subject;
  if (subject === 'All') {
    subject = detectSubjectFromQuery(query, 'Physics');
  }
  const classLevel = state.classLevel;

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
  const cleanTopic = topic !== 'Selected Topic' ? topic : 'this concept';
  const displaySubject = subject !== 'All' ? subject : 'your selected topic';
  
  return {
    definition: `**${cleanTopic}** is an important concept in **${displaySubject}** under the **${state.board}** curriculum for **Class ${state.classLevel}**.\n\n**Formal Definition:** In ${displaySubject.toLowerCase()}, **${cleanTopic.toLowerCase()}** describes the fundamental properties, mathematical relation, and behavior of this system under standard conditions. It is frequently tested in both conceptual questions and analytical problem-solving.`,
    mechanism: [
      { step: 1, title: `Understanding the Foundations`, text: `First, identify the core parameters governing **${cleanTopic.toLowerCase()}**. In the ${state.board} syllabus, this forms the theoretical basis.` },
      { step: 2, title: `Operational Principles`, text: `Analyze the main interactions and variables that alter **${cleanTopic.toLowerCase()}** in practical scenarios. Observe how changing parameters shifts the equilibrium/value.` },
      { step: 3, title: `Exam Application & Numerical Analysis`, text: `Be ready to apply these steps in CBSE/State board 3-mark and 5-mark long questions. Pay special attention to unit conversions and sign conventions.` }
    ],
    formula: `\\text{For } ${cleanTopic} \\text{ calculations:}\n\n$$\\text{Value} = \\frac{\\text{Force} \\times \\text{Scale}}{\\text{Resistance}} = \\kappa \\cdot (x_2 - x_1)$$\n\n\\text{Where } \\kappa \\text{ is the proportionality constant depending on the board standards.}`,
    diagram: `    [ ${cleanTopic.toUpperCase()} ]
               │
      ┌────────┴────────┐
      ▼                 ▼
  [Theory]          [Formula]
  NCERT §1.4        $$V = k \\cdot x$$`,
    analogy: `Think of **${cleanTopic.toLowerCase()}** like a balanced scale. Any change in one of the constituent parameters instantly shifts the weight, requiring an equal adjustment in the opposing variable to maintain stability.`,
    example: `1. 🧪 **Standard Class Application**: Resolving numerical questions on ${cleanTopic.toLowerCase()} in assignments.\n2. 🏭 **Real-world Engineering**: Designing systems that account for the properties of ${cleanTopic.toLowerCase()} in industrial setups.`,
    examData: [
      { exam: `${state.board} Class ${state.classLevel}`, years: "2019, 2021, 2023", marks: "3 marks", type: "Short Answer", frequency: "MEDIUM" },
      { exam: "JEE / NEET", years: "2020, 2022", marks: "4 marks", type: "Concept MCQ", frequency: "HIGH" }
    ],
    keywords: [cleanTopic, "Foundational theory", "Board syllabus standard", "Formula relation", "Numerical calculation"],
    keywordsNote: `Board marking schemes require you to state the relation of ${cleanTopic.toLowerCase()} and mention its exact units.`,
    quiz: `In a standard exam question about ${cleanTopic.toLowerCase()}, which variable represents the primary independent factor?`,
    quizAnswer: `The primary independent factor is the driving force or concentration parameter, which changes the value of ${cleanTopic.toLowerCase()} proportionally.`,
    teacherTip: `🧠 **Memory Trick:** Focus on the core variables of ${cleanTopic.toLowerCase()} first before trying to memorize complex derivations.\n\n⚠️ **Common Mistake:** Forgetting to convert the unit variables to standard SI units before applying formulas in ${cleanTopic.toLowerCase()} calculations.`
  };
}

// ---- TOAST UTILITY ----
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

// ---- HELPER: Trigger MathJax Typesetting ----
function triggerMathJax() {
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    setTimeout(() => {
      window.MathJax.typesetPromise()
        .catch((err) => console.warn('MathJax typesetting error:', err));
    }, 50);
  }
}

// ---- HELPER: Format **bold** and protect LaTeX ----
function formatBold(text) {
  if (text === undefined || text === null) return '';
  if (Array.isArray(text)) {
    return text.map(item => formatBold(item)).join('<br>');
  }
  if (typeof text !== 'string') {
    text = String(text);
  }
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g);
  return parts.map(part => {
    if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('$') && part.endsWith('$'))) {
      return part; // protect LaTeX block
    }
    return part
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }).join('');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---- JSON REPAIR UTILITY ----
function repairJSON(jsonStr) {
  let repaired = jsonStr.trim();
  if (!repaired) return '{}';
  
  let inString = false;
  let isEscaped = false;
  let stack = [];
  
  for (let i = 0; i < repaired.length; i++) {
    let char = repaired[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}') {
        if (stack[stack.length - 1] === '}') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === ']') {
          stack.pop();
        }
      }
    }
  }
  
  if (inString) {
    if (isEscaped) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }
  
  repaired = repaired.trim();
  while (repaired.endsWith(':') || repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1).trim();
  }
  
  while (stack.length > 0) {
    let close = stack.pop();
    repaired += close;
  }
  
  return repaired;
}

function cleanAndParseJSON(jsonStr) {
  let repaired = repairJSON(jsonStr);
  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Attempt parsing by stripping last unclosed property
    let lastCommaIndex = -1;
    let inString = false;
    let isEscaped = false;
    let depth = 0;
    
    for (let i = 0; i < jsonStr.length; i++) {
      let char = jsonStr[i];
      if (inString) {
        if (isEscaped) isEscaped = false;
        else if (char === '\\') isEscaped = true;
        else if (char === '"') inString = false;
      } else {
        if (char === '"') inString = true;
        else if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') depth--;
        else if (char === ',' && depth === 1) {
          lastCommaIndex = i;
        }
      }
    }
    
    if (lastCommaIndex !== -1) {
      let truncated = jsonStr.substring(0, lastCommaIndex);
      repaired = repairJSON(truncated);
      try {
        return JSON.parse(repaired);
      } catch (innerE) {}
    }
    return null;
  }
}

// ---- APIS: REAL CHUNK STREAMERS ----
async function streamAIResponse(query, cardId) {
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

    if (!state.useRealAPI || !state.apiKey) {
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
      
      let jsonString = JSON.stringify(responseData);
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

    const isOpenAI = state.apiKey.startsWith('sk-');
    let accumulatedText = '';
    let response;
    let headers = { 'Content-Type': 'application/json' };
    const basePrompt = getSystemPromptForFormat(state.format, query);
    
    if (isOpenAI) {
      const url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${state.apiKey}`;
      
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
        model: 'gpt-4o-mini',
        messages: messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        stream: true
      };
      
      response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      if (response.status === 429) throw { type: 'RATE_LIMITED' };
      if (response.status === 503) throw { type: 'SERVICE_DOWN' };
      if (!response.ok)            throw { type: 'API_ERROR', status: response.status };
      
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
          const url = `https://generativelanguage.googleapis.com/${modelSpec.version}/models/${modelSpec.name}:streamGenerateContent?alt=sse&key=${state.apiKey}`;
          
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
          
          const body = {
            contents: [{ parts: contentsParts }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: "application/json"
            }
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
    } else {
      // For API Errors, Rate Limits (429), or Network Issues, automatically fall back to local high-fidelity simulation!
      let alertMsg = "API Error";
      if (err.type === 'RATE_LIMITED') alertMsg = "Rate Limit Reached (429)";
      else if (err.type === 'SERVICE_DOWN') alertMsg = "AI Service Temporarily Down (503)";
      else if (err.type === 'API_ERROR') alertMsg = `API Error (Status: ${err.status})`;
      else if (err.type === 'CONTENT_BLOCKED') alertMsg = "Content safety filter block";
      else alertMsg = "Connection/Key issue";
      
      showToast(`⚠️ ${alertMsg}. Launching offline smart tutor fallback...`);
      console.log(`Fallback to simulation triggered for error:`, err);
      
      // Call simulation to generate response card
      simulateDemoStream(query, cardId);
      return true;
    }
  }
}

async function simulateDemoStream(query, cardId) {
  state.isDemoFallback = true;
  let activeBubble = document.getElementById(cardId);
  if (!activeBubble) activeBubble = document.getElementById(cardId + '_loader');
  if (!activeBubble) return;
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
}

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
    
    // Apply streaming cursor (BUG 2)
    const renderData = applyStreamingCursor(parsed, isFinal);
    let html = renderStructuredResponse(renderData, query);
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
    // If the loader hasn't been set up yet, fallback to skeleton
    if (!document.getElementById(cardId + '_loader')) {
      showSkeletonLoader(cardId, container);
    }
  }
  
  triggerMathJax();
  scrollToBottom();
}

// ---- RECOMENDED FOLLOWUPS CHIPS ----
function renderFollowUpChips(followups) {
  if (!followups || !followups.length) return '';
  return `
    <div class="followup-chips-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; padding:0 4px;">
      ${followups.slice(0, 3).map(q => `
        <button class="followup-chip" onclick="sendFollowUpQuestion('${escapeAttr(q)}')">
          💬 ${escapeHtml(q)}
        </button>
      `).join('')}
    </div>
  `;
}

window.sendFollowUpQuestion = function(text) {
  document.getElementById('userInput').value = text;
  sendMessage();
};

// ---- RENDERING SYSTEMS ----
function prependQuotaWarningIfEnabled(html, data) {
  const isFallback = data.isDemoFallback || state.isDemoFallback;
  if (!isFallback) return html;
  
  const banner = `
    <div class="quota-warning-banner">
      <span style="font-size: 16px; line-height: 1; margin-top: 1px;">⚠️</span>
      <div>
        <strong>API Quota Limit Reached</strong>
        <span>Displaying AI-Simulated Textbook Response.</span>
      </div>
    </div>
  `;
  
  const match = html.match(/<div class="response-card"[^>]*>/) || html.match(/<div class="quiz-card"[^>]*>/);
  if (match) {
    const insertIndex = match.index + match[0].length;
    return html.slice(0, insertIndex) + banner + html.slice(insertIndex);
  }
  return banner + html;
}

function renderStructuredResponse(data, query) {
  let html = _renderStructuredResponse(data, query);
  return prependQuotaWarningIfEnabled(html, data);
}

function renderInteractiveSimulator(data, query) {
  const followups = data.followups || [];
  
  // Helper to strip markdown code block syntax if the AI included it by mistake
  const stripMd = (str) => {
    if (!str) return '';
    return str.replace(/^```[a-z]*\n/gm, '').replace(/```\s*$/gm, '').trim();
  };

  const safeHtml = stripMd(data.htmlCode);
  const safeCss = stripMd(data.cssCode);
  const safeJs = stripMd(data.jsCode);
  
  // Construct a complete HTML document for the iframe
  const iframeContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 16px;
          background-color: transparent;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          box-sizing: border-box;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        /* User-generated CSS */
        ${safeCss}
      </style>
    </head>
    <body>
      ${safeHtml || '<div>Interactive visual rendering failed: missing HTML code.</div>'}
      
      <script>
        try {
          ${safeJs}
        } catch(e) {
          console.error("Error running interactive script:", e);
          document.body.innerHTML += '<div style="color:#f43f5e; margin-top:16px; font-size:12px; font-family:monospace;">Error in simulation logic: ' + e.message + '</div>';
        }
      </script>
    </body>
    </html>
  `;

  // Safely escape the entire HTML document for the srcdoc attribute
  const escapedSrcDoc = iframeContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Render the container wrapper
  return `
    <div class="response-card interactive-simulator-card">
      <div class="response-header" style="margin-bottom: 16px;">
        <h3 style="margin: 0; display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px;">🎮</span> 
          Interactive Simulator: ${escapeHtml(data.topic || 'Visual Model')}
        </h3>
      </div>
      
      ${data.explanation ? `<p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6;">${escapeHtml(data.explanation)}</p>` : ''}
      
      <div class="interactive-iframe-container">
        <iframe 
          class="interactive-simulator-frame"
          sandbox="allow-scripts allow-same-origin"
          srcdoc="${escapedSrcDoc}"
          onload="this.style.height=(this.contentWindow.document.body.scrollHeight+32)+'px';"
        ></iframe>
      </div>
      
      ${followups.length > 0 ? `
      <div class="followup-chips-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:20px; padding:0 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
        ${followups.slice(0, 3).map(q => `
          <button class="followup-chip" onclick="sendFollowUpQuestion('${escapeAttr(q)}')">
            💬 ${escapeHtml(q)}
          </button>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `;
}

function _renderStructuredResponse(data, query) {
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
  if (data.type === 'interactive_simulator') {
    return renderInteractiveSimulator(data, query);
  }

  // Check new formats (BUG 3)
  if (data.step_by_step_steps) {
    const stepsHtml = (data.step_by_step_steps || []).map(s => `
      <div class="step-item" style="margin-bottom: 16px; padding: 14px 16px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.01); border-radius: var(--radius-md); display:flex; flex-direction:column; gap:8px;">
        <div style="font-size: 13.5px; font-weight: 700; color: #F5C76A; font-family: 'Space Grotesk', sans-serif; display:flex; align-items:center; gap:8px;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:rgba(245,199,106,0.15); font-size:11px; color:#F5C76A; font-weight:700;">${s.step}</span>
          <span>${s.title}</span>
        </div>
        <div class="step-text" style="font-size: 13.5px; line-height: 1.7; color: var(--text-secondary);">
          ${formatBold(s.text)}
        </div>
      </div>
    `).join('');
    
    return `
      <div class="response-card" id="${id}" style="position:relative; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 18px;">
          <span class="section-icon">🪜</span>
          <span class="resp-section-title" style="color: var(--text-accent);">Step-by-Step Learning — ${data.topic || 'Concept'}</span>
        </div>
        <div class="steps-container">${stepsHtml}</div>
        <div class="response-actions" style="margin-top: 16px; padding: 10px 0 0; border-top: 1px solid var(--border-color);">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
      </div>
    `;
  }
  
  if (data.researchText) {
    let bodyHtml = formatBold(data.researchText)
      .replace(/\n\n/g, '<p style="margin-bottom: 12px;"></p>')
      .replace(/###\s+(.+)/g, `<h4 style="font-family:'Space Grotesk',sans-serif; color:var(--text-accent); margin: 20px 0 10px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px;">$1</h4>`);
      
    return `
      <div class="response-card" id="${id}" style="position:relative; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <span class="section-icon">🔬</span>
          <span class="resp-section-title" style="color: var(--text-accent);">Deep Research Paper: ${data.topic || 'Concept'}</span>
        </div>
        <div class="resp-section-body" style="font-size:13.5px; line-height: 1.8; color: var(--text-secondary);">
          ${bodyHtml}
        </div>
        ${data.teacherTip ? `
          <div class="callout callout-emerald" style="margin-top:20px;">
            📌 <strong>Key Research Insight:</strong> ${formatBold(data.teacherTip)}
          </div>
        ` : ''}
        <div class="response-actions" style="margin-top: 20px; padding: 10px 0 0; border-top: 1px solid var(--border-color);">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
      </div>
    `;
  }
  
  if (data.asciiDiagram || data.graphDescription) {
    let tableHtml = '';
    if (data.tableData && data.tableData.length > 0) {
      const rows = data.tableData.map(r => `
        <tr>
          <td style="padding: 6px 10px; border-bottom:1px solid rgba(255,255,255,0.03);">${r.label || r.x || ''}</td>
          <td style="padding: 6px 10px; border-bottom:1px solid rgba(255,255,255,0.03); font-weight:600; color:#F5C76A;">${r.value || r.y || ''}</td>
        </tr>
      `).join('');
      tableHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size:12px; background: rgba(0,0,0,0.15); border-radius:4px; overflow:hidden;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); text-align: left;">
              <th style="padding: 6px 10px; font-weight:600; color:var(--text-muted);">Variable / Coord</th>
              <th style="padding: 6px 10px; font-weight:600; color:var(--text-muted);">Value / Behavior</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
    
    return `
      <div class="response-card" id="${id}" style="position:relative; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 16px;">
          <span class="section-icon">📊</span>
          <span class="resp-section-title" style="color: var(--accent-amber);">Visual Mapping — ${data.topic || 'Concept'}</span>
        </div>
        ${data.asciiDiagram ? `
          <div class="diagram-block" style="font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.4; background: rgba(0,0,0,0.35); border: 1px solid rgba(245,199,106,0.15); border-radius: var(--radius-sm); padding: 14px; color: #93C5FD; overflow-x: auto; white-space: pre; margin-bottom: 16px;">${escapeHtml(data.asciiDiagram)}</div>
        ` : ''}
        ${data.graphDescription ? `
          <div class="callout callout-indigo" style="margin-bottom: 16px; font-size: 13.5px; line-height: 1.6;">
            📈 <strong>Graph Structure:</strong> ${formatBold(data.graphDescription)}
          </div>
        ` : ''}
        ${tableHtml}
        <div class="resp-section-body" style="font-size: 13.5px; line-height: 1.7; color: var(--text-secondary); margin-top: 16px;">
          ${formatBold(data.explanation || '')}
        </div>
        <div class="response-actions" style="margin-top: 16px; padding: 10px 0 0; border-top: 1px solid var(--border-color);">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
      </div>
    `;
  }

  if (data.essay) {
    // Long Answer
    return `
      <div class="response-card" id="${id}" style="position:relative; padding: 24px 20px;">
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
        
        <div class="response-actions" style="margin-top: 16px; padding: 10px 0 0; border-top: 1px solid var(--border-color);">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
      </div>
    `;
  }
  
  if (data.points) {
    // Quick Summary
    const pointsList = (data.points || []).map(p => `
      <li style="margin-bottom: 8px; list-style-type: decimal; margin-left: 16px;">${formatBold(p)}</li>
    `).join('');
    
    return `
      <div class="response-card" id="${id}" style="position:relative; padding: 24px 20px;">
        ${speakerBtn}
        <div class="resp-section-header" style="margin-bottom: 12px;">
          <span class="section-icon">⚡</span>
          <span class="resp-section-title" style="color: var(--accent-amber);">Quick Summary — ${data.topic || 'Summary'}</span>
        </div>
        <div class="resp-section-body">
          <ol style="margin-bottom: 12px; color: var(--text-secondary); align-items:flex-start; display:flex; flex-direction:column; gap:4px;">${pointsList}</ol>
        </div>
        ${data.teacherTip ? `
          <div class="callout callout-amber" style="margin-top:12px;">
            💡 <strong>Key Tip:</strong> ${formatBold(data.teacherTip)}
          </div>
        ` : ''}
        
        <div class="response-actions" style="margin-top: 12px; padding: 10px 0 0; border-top: 1px solid var(--border-color);">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
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
      <div class="response-card" id="${id}" style="position:relative;">
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

        <div class="response-actions">
          <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
          <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
          <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
        </div>
      </div>
    `;
  }

  // Fallback to default structured response
  let originalHtml = renderStructuredResponseDefault(data, query);
  return originalHtml.replace('class="response-card"', 'class="response-card" style="position:relative;"').replace('</h3>', '</h3>' + speakerBtn);
}

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

      <div class="response-actions">
        <button class="action-btn" onclick="copyResponse('${id}')">📋 Copy</button>
        <button class="action-btn" onclick="bookmarkResponse('${id}')">🔖 Bookmark</button>
        <button class="action-btn" onclick="askFollowUp('${escapeAttr(query)}')">💬 Discuss</button>
      </div>
    </div>
  `;
}

// ---- PYQ RENDERER ----
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

window.togglePyqAnswer = function(id) {
  const el = document.getElementById(id);
  if (el) {
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    const btn = el.previousElementSibling;
    if (btn && btn.tagName === 'BUTTON') {
      btn.innerHTML = isHidden ? '🙈 Hide Solution' : '👁️ Show Solution';
    }
    if (isHidden) triggerMathJax();
  }
};

window.selectPyqOption = function(el, correctAnswer) {
  const grid = el.parentElement;
  grid.querySelectorAll('.pyq-option').forEach(opt => {
    opt.style.borderColor = 'var(--border-color)';
    opt.style.background = 'rgba(255,255,255,0.03)';
  });
  
  el.style.borderColor = 'var(--accent-indigo)';
  el.style.background = 'rgba(99,102,241,0.1)';
  
  const item = grid.parentElement;
  const ansBlock = item.querySelector('.pyq-answer-block');
  if (ansBlock && ansBlock.style.display === 'none') {
    const qId = ansBlock.id;
    window.togglePyqAnswer(qId);
  }
};

// ---- FORMULA SHEET RENDERER ----
function renderFormulaSheetResponse(data, query) {
  const id = data._cardId || ('formula_' + Date.now());
  
  let sectionsHtml = '';
  if (data.sections && data.sections.length > 0) {
    sectionsHtml = data.sections.map((sec, sIdx) => {
      const fCards = (sec.formulas || []).map((f, fIdx) => {
        let eq = f.formula.trim();
        if (!eq.startsWith('$') && !eq.startsWith('\\(') && !eq.startsWith('\\[') && !eq.startsWith('\\begin')) {
          eq = `$$${eq}$$`;
        }
        
        let headerIcons = '';
        if (f.importance === 'HIGH') {
          headerIcons += '<span class="formula-high-fire" style="color:#F5C76A; font-size:12px; background:rgba(245,199,106,0.1); border:1px solid rgba(245,199,106,0.2); border-radius:4px; padding:1px 6px;">🔥 High Weightage</span> ';
        }
        if (f.derivable) {
          headerIcons += '<span class="formula-derivable-star" style="color:#60A5FA; font-size:12px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2); border-radius:4px; padding:1px 6px;">★ Derivable</span>';
        }
        
        return `
          <div class="formula-card-item" style="padding: 16px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div style="font-size: 14.5px; font-weight: 700; color: var(--text-accent); font-family: 'Space Grotesk', sans-serif;">
                ${f.name}
              </div>
              <div style="display:flex; gap:4px;">${headerIcons}</div>
            </div>
            <div class="formula-block" style="font-family: 'JetBrains Mono', monospace; font-size:14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(99,102,241,0.15); border-radius: var(--radius-sm); padding:10px; color:#a5b4fc; text-align:center; overflow-x:auto;">
              ${escapeHtml(eq)}
            </div>
            <div style="font-size:12.5px; color: var(--text-secondary); line-height: 1.5;">
              <strong>Variables:</strong> ${formatBold(f.variables)}
            </div>
            ${f.units ? `<div style="font-size:11.5px; color: var(--text-muted);"><strong>SI Units:</strong> ${f.units}</div>` : ''}
            ${f.conditions ? `<div style="font-size:11.5px; color: var(--text-muted); font-style:italic;"><strong>Conditions:</strong> ${f.conditions}</div>` : ''}
            ${f.memory_trick ? `
              <div class="callout callout-emerald" style="margin-top:4px; font-size:11.5px; padding:6px 10px;">
                💡 <strong>Mnemonic / Trick:</strong> ${formatBold(f.memory_trick)}
              </div>` : ''}
            ${f.common_mistake ? `
              <div class="callout callout-rose" style="margin-top:4px; font-size:11.5px; padding:6px 10px; border-color:rgba(244,63,94,0.3); background:rgba(244,63,94,0.02); color:#fda4af;">
                ⚠️ <strong>Common Pitfall:</strong> ${formatBold(f.common_mistake)}
              </div>` : ''}
          </div>
        `;
      }).join('');
      
      return `
        <div class="formula-section-block" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.04); padding-top:16px;">
          <h4 style="font-family:'Space Grotesk',sans-serif; color: #F5C76A; font-size: 14.5px; font-weight:700; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">📂 ${sec.section_name}</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            ${fCards}
          </div>
        </div>
      `;
    }).join('');
  } else {
    // Fallback to legacy formulas flat array mapping
    const legacyList = (data.formulas || []).map(f => `
      <div class="formula-card-item" style="padding: 16px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 14.5px; font-weight: 700; color: var(--text-accent); font-family: 'Space Grotesk', sans-serif;">
          ${f.name}
        </div>
        <div class="formula-block" style="font-family: 'JetBrains Mono', monospace; font-size:14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(99,102,241,0.15); border-radius: var(--radius-sm); padding:10px; color:#a5b4fc; text-align:center; overflow-x:auto;">
          ${escapeHtml(f.equation)}
        </div>
        <div style="font-size:12.5px; color: var(--text-secondary); line-height: 1.5;">
          <strong>Variables:</strong> ${formatBold(f.terms)}
        </div>
        ${f.note ? `<div class="callout callout-amber" style="margin-top:4px; font-size:12px; padding:8px 10px;">💡 ${formatBold(f.note)}</div>` : ''}
      </div>
    `).join('');
    sectionsHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top:16px;">${legacyList}</div>`;
  }
  
  let constantsHtml = '';
  if (data.constants_needed && data.constants_needed.length > 0) {
    const list = data.constants_needed.map(c => `<li style="margin-bottom:4px;">${c}</li>`).join('');
    constantsHtml = `
      <div class="callout callout-indigo" style="margin-top: 20px;">
        📏 <strong>Useful Constants & Values:</strong>
        <ul style="margin-top: 6px; padding-left: 16px; font-size: 12px; color:var(--text-secondary);">${list}</ul>
      </div>
    `;
  }
  
  let revisionHtml = '';
  if (data.quick_revision_list && data.quick_revision_list.length > 0) {
    const list = data.quick_revision_list.map(r => `<li style="margin-bottom:4px; list-style-type:square; margin-left:16px;">${r}</li>`).join('');
    revisionHtml = `
      <div class="callout callout-amber" style="margin-top: 16px;">
        📋 <strong>Quick Revision Tips:</strong>
        <ul style="margin-top: 6px; font-size: 12px; color:var(--text-secondary);">${list}</ul>
      </div>
    `;
  }

  return `
    <div class="response-card" id="${id}">
      <div class="resp-section" style="background: rgba(99,102,241,0.05); border-bottom: 1px solid var(--border-color);">
        <div class="resp-section-header">
          <span class="section-icon">📋</span>
          <span class="resp-section-title" style="color: var(--text-accent);">Formula Sheet — ${data.topic || 'Chapter'} (${data.exam || 'CBSE'})</span>
        </div>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Syllabus-aligned key formula list compiled for target board: <strong>${data.exam || 'Standard'}</strong>.
        </p>
      </div>
      <div style="padding: 20px;">
        ${sectionsHtml}
        ${constantsHtml}
        ${revisionHtml}
      </div>
    </div>
  `;
}

function renderQuizCard(data, cardId, questionsToRender = null) {
  const questions = questionsToRender || data.questions;
  
  activeQuizzes[cardId] = {
    topic: data.topic,
    questions: data.questions,
    currentQuestions: questions,
    answers: {},
    startTime: Date.now(),
    submitted: false
  };

  const qHtml = questions.map((q, idx) => {
    let inputHtml = '';
    if (q.options && q.options.length > 0) {
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

function startQuizTimer(cardId) {
  let timerBadge = document.getElementById(`${cardId}_timer`);
  if (!timerBadge) return;
  
  let quiz = activeQuizzes[cardId];
  if (!quiz) return;
  
  quizTimers[cardId] = setInterval(() => {
    if (quiz.submitted) {
      clearInterval(quizTimers[cardId]);
      return;
    }
    let elapsed = Math.floor((Date.now() - quiz.startTime) / 1000);
    let mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    let secs = String(elapsed % 60).padStart(2, '0');
    timerBadge.innerHTML = `⏱️ ${mins}:${secs}`;
  }, 1000);
}

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
};

window.inputQuizCardText = function(cardId, qIdx, val) {
  let quiz = activeQuizzes[cardId];
  if (!quiz || quiz.submitted) return;
  quiz.answers[qIdx] = val;
};

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
};

window.retryWrongQuestions = function(cardId, wrongIndices) {
  let quiz = activeQuizzes[cardId];
  if (!quiz) return;
  
  let wrongQuestions = wrongIndices.map(idx => quiz.currentQuestions[idx]);
  let cardEl = document.getElementById(cardId);
  if (cardEl) {
    let newHtml = renderQuizCard({ topic: quiz.topic, questions: quiz.questions }, cardId, wrongQuestions);
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHtml;
    cardEl.replaceWith(tempDiv.firstElementChild);
    
    startQuizTimer(cardId);
    triggerMathJax();
  }
};

function saveQuizHistory(topic, score, total, duration) {
  let history = JSON.parse(localStorage.getItem('bruhaspati_quiz_history') || '[]');
  history.push({
    topic: topic,
    score: score,
    total: total,
    duration: duration,
    timestamp: Date.now()
  });
  localStorage.setItem('bruhaspati_quiz_history', JSON.stringify(history));
}

// ---- SUBMIT INLINE QUIZ (Backward Compatibility) ----
window.submitInlineQuiz = function(inputId, question, correctAnswer) {
  const input = document.getElementById(inputId);
  const answer = input.value.trim();
  if (!answer) {
    input.style.borderColor = 'var(--accent-rose)';
    input.placeholder = 'Please type your answer first!';
    setTimeout(() => {
      input.style.borderColor = '';
      input.placeholder = 'Type your answer here...';
    }, 2000);
    return;
  }

  input.disabled = true;
  const userWords = answer.toLowerCase().split(/\s+/);
  const correctWords = correctAnswer.toLowerCase().split(/\s+/);
  const stopWords = ['a', 'an', 'the', 'is', 'are', 'to', 'for', 'of', 'in', 'on', 'at', 'it'];
  const importantCorrectWords = correctWords.filter(w => w.length > 2 && !stopWords.includes(w));
  const matches = importantCorrectWords.filter(w => userWords.some(uw => uw.includes(w) || w.includes(uw)));
  
  let scoreText = '';
  let borderClass = 'callout-amber';
  
  if (importantCorrectWords.length === 0) {
    scoreText = '👍 <strong>Great Attempt!</strong> Let\'s review the correct answer below.';
  } else if (matches.length / importantCorrectWords.length >= 0.4) {
    scoreText = '🎉 <strong>Excellent Answer!</strong> You\'ve captured the core concepts perfectly.';
    borderClass = 'callout-emerald';
  } else {
    scoreText = '📚 <strong>Nice Try!</strong> Let\'s review this concept to strengthen your understanding.';
    borderClass = 'callout-rose';
  }

  const box = input.closest('.quiz-box');
  const feedback = document.createElement('div');
  feedback.className = `callout ${borderClass}`;
  feedback.style.marginTop = '12px';
  feedback.innerHTML = `
    <div style="margin-bottom:8px;"><strong>Your answer:</strong> "${escapeHtml(answer)}"</div>
    <div style="margin-bottom:8px;">${scoreText}</div>
    <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">
      🔑 <strong>Correct Answer & Explanation:</strong><br>
      ${formatBold(correctAnswer)}
    </div>
  `;
  box.appendChild(feedback);
  triggerMathJax();
};

// ---- ACTION BUTTONS ----
window.copyResponse = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // Clean LaTeX and symbols for clean plain text copy
  let cleanText = el.innerText.replace(/\$\$/g, '').replace(/\$/g, '');
  navigator.clipboard.writeText(cleanText).then(() => {
    showToast('📋 Clean response copied to clipboard!');
  });
};

window.bookmarkResponse = function(id) {
  let msg = state.messages.find(m => m.data && m.data._cardId === id);
  if (!msg) {
    for (let session of state.history) {
      msg = session.messages.find(m => m.data && m.data._cardId === id);
      if (msg) break;
    }
  }
  
  if (!msg) {
    showToast('⚠️ Could not find message to bookmark.');
    return;
  }
  
  let bookmarks = JSON.parse(localStorage.getItem('bruhaspati_bookmarks') || '[]');
  if (bookmarks.some(b => b.id === id)) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    localStorage.setItem('bruhaspati_bookmarks', JSON.stringify(bookmarks));
    showToast('🗑️ Bookmark removed');
  } else {
    bookmarks.push({
      id: id,
      title: msg.query.substring(0, 40) + (msg.query.length > 40 ? '...' : ''),
      data: msg.data,
      query: msg.query,
      timestamp: Date.now()
    });
    localStorage.setItem('bruhaspati_bookmarks', JSON.stringify(bookmarks));
    showToast('🔖 Bookmarked successfully!');
  }
  renderBookmarksList();
};

function renderBookmarksList() {
  const container = document.getElementById('bookmarksList');
  if (!container) return;
  
  let bookmarks = JSON.parse(localStorage.getItem('bruhaspati_bookmarks') || '[]');
  if (bookmarks.length === 0) {
    container.innerHTML = `<div style="font-size:11.5px; color:var(--text-muted); text-align:center; padding:8px 6px;">No bookmarked answers.</div>`;
    return;
  }
  
  container.innerHTML = bookmarks.map(b => `
    <div class="recent-chat-item" onclick="loadBookmarkedAnswer('${b.id}')" style="display:flex; justify-content:space-between; align-items:center;">
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${escapeAttr(b.query)}">🔖 ${escapeHtml(b.title)}</span>
      <button class="recent-chat-delete" onclick="event.stopPropagation(); removeBookmark('${b.id}')">✕</button>
    </div>
  `).join('');
}

window.loadBookmarkedAnswer = function(id) {
  let bookmarks = JSON.parse(localStorage.getItem('bruhaspati_bookmarks') || '[]');
  let b = bookmarks.find(x => x.id === id);
  if (!b) return;
  
  document.getElementById('welcomeScreen').style.display = 'none';
  const area = document.getElementById('messagesArea');
  area.innerHTML = `
    <div style="padding:10px 0; border-bottom:1px dashed var(--border-color); font-size:13px; color:var(--text-accent); display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
      <span>📌 Viewing Bookmarked Explanation</span>
      <button class="action-btn" onclick="startNewChat()" style="padding:2px 8px; font-size:11px;">Back to Chat</button>
    </div>
  `;
  
  addUserMessage(b.query);
  addAIMessage(b.query, b.data, b.id);
  triggerMathJax();
};

window.removeBookmark = function(id) {
  let bookmarks = JSON.parse(localStorage.getItem('bruhaspati_bookmarks') || '[]');
  bookmarks = bookmarks.filter(b => b.id !== id);
  localStorage.setItem('bruhaspati_bookmarks', JSON.stringify(bookmarks));
  renderBookmarksList();
  showToast('🗑️ Bookmark removed');
};

window.askFollowUp = function(query) {
  const input = document.getElementById('userInput');
  input.value = 'Can you explain more about: ' + query;
  input.focus();
  autoResize(input);
};

// ---- BOOK / NOTES UPLOAD CONTROLLER ----
let uploadedFiles = [];

window.triggerNotesUpload = function() {
  document.getElementById('notesFileInput').click();
};

window.handleNotesUpload = function(event) {
  const files = event.target.files;
  if (!files.length) return;
  
  if (uploadedFiles.length + files.length > 10) {
    showToast("⚠️ Maximum of 10 pages/images allowed per upload session.");
    return;
  }
  
  const preview = document.getElementById('uploadPreviewStrip');
  if (preview) preview.style.display = 'flex';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const base64Data = e.target.result.split(',')[1];
      const fileObj = {
        name: file.name,
        mimeType: file.type || 'image/jpeg',
        base64: base64Data,
        dataUrl: e.target.result
      };
      
      uploadedFiles.push(fileObj);
      renderUploadPreviews();
    };
    
    reader.readAsDataURL(file);
  }
  
  event.target.value = '';
};

function renderUploadPreviews() {
  const preview = document.getElementById('uploadPreviewStrip');
  if (!preview) return;
  
  if (uploadedFiles.length === 0) {
    preview.style.display = 'none';
    return;
  }
  
  preview.innerHTML = uploadedFiles.map((file, idx) => {
    let thumbnailHtml = '';
    if (file.mimeType.startsWith('image/')) {
      thumbnailHtml = `<img src="${file.dataUrl}" alt="${escapeAttr(file.name)}" />`;
    } else {
      thumbnailHtml = `<div class="pdf-placeholder">📂 PDF<br><span style="font-size:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; display:block;">${escapeHtml(file.name)}</span></div>`;
    }
    
    return `
      <div class="upload-preview-item">
        ${thumbnailHtml}
        <button class="remove-btn" onclick="removeUploadedFile(${idx})">✕</button>
      </div>
    `;
  }).join('');
  
  preview.style.display = 'flex';
}

window.removeUploadedFile = function(idx) {
  uploadedFiles.splice(idx, 1);
  renderUploadPreviews();
};

// ---- SPEECH INTEGRATION: SPEAK & LISTEN ----
let recognition = null;
let isListening = false;
let silenceTimer = null;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-IN';
  
  rec.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    const inputEl = document.getElementById('userInput');
    if (finalTranscript) {
      inputEl.value = (inputEl.value + ' ' + finalTranscript).trim();
      autoResize(inputEl);
    }
    
    // Auto-send on silence
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (inputEl.value.trim()) {
        sendMessage();
        stopVoiceInput();
      }
    }, 1500);
  };

  rec.onerror = (e) => {
    console.error('Speech recognition error', e);
    stopVoiceInput();
  };

  rec.onend = () => {
    if (isListening) {
      recognition.start();
    }
  };

  return rec;
}

window.toggleVoiceInput = function() {
  if (isListening) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
};

function startVoiceInput() {
  if (!recognition) {
    recognition = initSpeechRecognition();
  }
  if (!recognition) {
    showToast("Speech Recognition not supported in this browser.");
    return;
  }
  
  isListening = true;
  recognition.start();
  document.getElementById('voiceBtn').classList.add('pulsing');
  showToast("🎤 Listening... Speak now.");
}

function stopVoiceInput() {
  isListening = false;
  if (recognition) {
    recognition.stop();
  }
  clearTimeout(silenceTimer);
  document.getElementById('voiceBtn').classList.remove('pulsing');
}

// Speech Synthesis (TTS) Output
let ttsUtterance = null;
let ttsActiveBtn = null;

window.speakResponseCard = function(id) {
  if (ttsUtterance && ttsActiveBtn === id) {
    if (window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setSpeakButtonState(id, 'playing');
      } else {
        window.speechSynthesis.pause();
        setSpeakButtonState(id, 'paused');
      }
      return;
    }
  }
  
  window.speechSynthesis.cancel();
  
  let msg = state.messages.find(m => m.data && m.data._cardId === id);
  if (!msg) {
    for (let session of state.history) {
      msg = session.messages.find(m => m.data && m.data._cardId === id);
      if (msg) break;
    }
  }
  
  let textToSpeak = '';
  if (msg) {
    textToSpeak = getPlainTextFromResponse(msg.data);
  } else {
    const card = document.getElementById(id);
    textToSpeak = card ? card.innerText : '';
  }
  
  // Clean math markers
  textToSpeak = textToSpeak.replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\text\{(.+?)\}/g, '$1').replace(/\\/g, '');
  
  ttsUtterance = new SpeechSynthesisUtterance(textToSpeak);
  ttsActiveBtn = id;
  
  let voices = window.speechSynthesis.getVoices();
  let selectedVoice = voices.find(v => v.name.includes('Google Hindi') || v.name.includes('Google UK English Female') || v.lang === 'en-GB' || v.lang === 'hi-IN');
  if (selectedVoice) {
    ttsUtterance.voice = selectedVoice;
  }
  
  ttsUtterance.onend = () => {
    setSpeakButtonState(id, 'stopped');
    ttsUtterance = null;
    ttsActiveBtn = null;
  };
  
  ttsUtterance.onerror = () => {
    setSpeakButtonState(id, 'stopped');
    ttsUtterance = null;
    ttsActiveBtn = null;
  };
  
  window.speechSynthesis.speak(ttsUtterance);
  setSpeakButtonState(id, 'playing');
};

function setSpeakButtonState(id, stateVal) {
  const card = document.getElementById(id);
  if (!card) return;
  const btn = card.querySelector('.tts-speak-btn');
  if (!btn) return;
  
  if (stateVal === 'playing') {
    btn.innerHTML = '⏸️';
    btn.title = 'Pause reading';
  } else if (stateVal === 'paused') {
    btn.innerHTML = '▶️';
    btn.title = 'Resume reading';
  } else {
    btn.innerHTML = '🔊';
    btn.title = 'Listen to explanation';
  }
}

function getPlainTextFromResponse(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  
  if (data.type === 'pyq') {
    return `PYQ Practice Bank. ${data.topic}. Here are the questions. ` + 
      data.questions.map((q, idx) => `Question ${idx + 1}: ${q.question}. The answer is: ${q.answer}`).join(' ');
  }
  if (data.type === 'quiz') {
    return `Interactive Test on ${data.topic}. ` + 
      data.questions.map((q, idx) => `Question ${idx + 1}: ${q.question}.`).join(' ');
  }
  if (data.type === 'formula_sheet') {
    return `Formula Sheet for ${data.topic}. ` + 
      data.formulas.map(f => `${f.name}: ${f.terms}`).join(' ');
  }
  if (data.essay) {
    return `${data.title}. ${data.essay}. Teacher Tip: ${data.teacherTip || ''}`;
  }
  if (data.points) {
    return `Summary of ${data.topic}. ${data.points.join('. ')}. Teacher Tip: ${data.teacherTip || ''}`;
  }
  if (data.modelAnswer) {
    return `Exam focused revision for ${data.topic}. Keywords: ${data.keywords.join(', ')}. Model Answer: ${data.modelAnswer}`;
  }
  
  let text = `Concept explanation: ${data.definition || ''}. `;
  if (data.mechanism && data.mechanism.length) {
    text += `Mechanism steps: ` + data.mechanism.map(s => `Step ${s.step}. ${s.title}: ${s.text}`).join(' ');
  }
  if (data.analogy) {
    text += ` Mental Model: ${data.analogy}. `;
  }
  if (data.teacherTip) {
    text += ` Teacher Tip: ${data.teacherTip}. `;
  }
  return text;
}

// ---- TOKEN SYSTEM & MONETIZATION ----
let tokenState = {
  tokensUsed: 0,
  date: new Date().toISOString().split('T')[0],
  plan: 'free'
};

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

function saveTokenState() {
  localStorage.setItem('bruhaspati_token_state', JSON.stringify(tokenState));
}

function getPlanLimit() {
  if (tokenState.plan === 'pro') return 20000;
  if (tokenState.plan === 'ultra') return Infinity;
  return 2000; // free limit
}

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

window.openUpgradeModal = function() {
  document.getElementById('upgradeModal').classList.add('active');
};

window.closeUpgradeModal = function() {
  document.getElementById('upgradeModal').classList.remove('active');
};

window.selectPlan = function(planName) {
  const status = document.getElementById('paymentStatus');
  if (status) {
    status.style.display = 'block';
    status.innerHTML = `Connecting to payment gateway for ${planName.toUpperCase()}...`;
    
    setTimeout(() => {
      tokenState.plan = planName;
      saveTokenState();
      updateTokenMeterUI();
      status.innerHTML = `🎉 Successfully upgraded to ${planName.toUpperCase()}! Your limit has been reset.`;
      setTimeout(() => {
        status.style.display = 'none';
        closeUpgradeModal();
      }, 2000);
    }, 1500);
  } else {
    tokenState.plan = planName;
    saveTokenState();
    updateTokenMeterUI();
    closeUpgradeModal();
  }
};

function estimateRequestCost(query) {
  if (detectQuizQuery(query)) return 150;
  if (detectFormulaQuery(query)) return 200;
  if (detectPYQQuery(query)) return 200;
  if (uploadedFiles && uploadedFiles.length > 0) return 300;
  return 100;
}

function checkTokenLimit(cost) {
  let limit = getPlanLimit();
  if (tokenState.tokensUsed + cost > limit) {
    openUpgradeModal();
    showToast("⚠️ Daily limit reached. Please upgrade or configure Pro keys.");
    return false;
  }
  return true;
}

function consumeTokens(cost) {
  tokenState.tokensUsed += cost;
  saveTokenState();
  updateTokenMeterUI();
}

// ---- CHAT HISTORY CONVERSATIONAL ENGINE ----
function loadChatHistory() {
  state.history = JSON.parse(localStorage.getItem('bruhaspati_chat_history') || '[]');
  renderHistoryList();
}

function renderHistoryList() {
  const container = document.getElementById('recentChatsList');
  if (!container) return;
  
  if (state.history.length === 0) {
    container.innerHTML = `<div style="font-size:11.5px; color:var(--text-muted); text-align:center; padding:12px 6px;">No recent study chats.</div>`;
    return;
  }
  
  // Render last 10 initially (lazy-loading concept)
  const listToRender = state.history.slice(0, 10);
  
  container.innerHTML = listToRender.map(session => {
    const activeClass = session.id === state.currentChatId ? 'active' : '';
    return `
      <div class="recent-chat-item ${activeClass}" onclick="loadChatSession('${session.id}')">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${escapeAttr(session.title)}">💬 ${escapeHtml(session.title)}</span>
        <button class="recent-chat-delete" onclick="event.stopPropagation(); deleteChatSession('${session.id}')">✕</button>
      </div>
    `;
  }).join('');
}

window.deleteChatSession = function(id) {
  state.history = state.history.filter(s => s.id !== id);
  localStorage.setItem('bruhaspati_chat_history', JSON.stringify(state.history));
  
  if (state.currentChatId === id) {
    startNewChat();
  } else {
    renderHistoryList();
  }
  showToast('🗑️ Session removed');
};

window.startNewChat = function() {
  state.currentChatId = null;
  state.messages = [];
  uploadedFiles = [];
  renderUploadPreviews();
  
  document.getElementById('messagesArea').innerHTML = '';
  document.getElementById('welcomeScreen').style.display = 'flex';
  
  renderHistoryList();
  scrollToBottom();
};

window.loadChatSession = function(id) {
  const session = state.history.find(s => s.id === id);
  if (!session) return;
  
  state.currentChatId = id;
  state.messages = session.messages || [];
  
  // Restore selectors contexts
  state.board = session.board || 'CBSE';
  state.classLevel = session.classLevel || '11';
  state.subject = session.subject || 'All';
  
  updateSidebarSelectors(state.subject, state.classLevel);
  document.querySelectorAll('.board-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.board === state.board) btn.classList.add('active');
  });
  
  updateFilters();
  
  // Redraw messages
  document.getElementById('welcomeScreen').style.display = 'none';
  const area = document.getElementById('messagesArea');
  area.innerHTML = '';
  
  state.messages.forEach(msg => {
    if (msg.sender === 'user') {
      const div = document.createElement('div');
      div.className = 'msg-user';
      let badgeHtml = msg.hasAttachment ? `<span class="attachment-badge" style="font-size:9.5px; opacity:0.6; margin-right:4px;">📎 Notes attached</span>` : '';
      div.innerHTML = `
        <div class="msg-user-bubble">
          ${badgeHtml}${escapeHtml(msg.text)}
          <span class="msg-timestamp">${formatTime(msg.timestamp)}</span>
        </div>
      `;
      area.appendChild(div);
    } else if (msg.sender === 'ai') {
      const div = document.createElement('div');
      div.className = 'msg-ai';
      div.innerHTML = `
        <div class="ai-avatar"><img src="logo.jpg" alt="Bruhaspati AI"></div>
        <div class="ai-content">
          ${renderStructuredResponse(msg.data, msg.query)}
          <span class="msg-timestamp">${formatTime(msg.timestamp)}</span>
        </div>
      `;
      area.appendChild(div);
    } else if (msg.sender === 'error') {
      addErrorMessage(msg.text);
    }
  });
  
  renderHistoryList();
  triggerMathJax();
  scrollToBottom();
};

function saveCurrentChatSession() {
  if (state.messages.length === 0) return;
  
  if (!state.currentChatId) {
    state.currentChatId = 'chat_' + Date.now();
    const firstText = state.messages[0].text;
    const title = firstText.substring(0, 35) + (firstText.length > 35 ? '...' : '');
    
    let session = {
      id: state.currentChatId,
      title: title,
      timestamp: Date.now(),
      board: state.board,
      classLevel: state.classLevel,
      subject: state.subject,
      messages: state.messages
    };
    
    state.history.unshift(session);
  } else {
    const session = state.history.find(s => s.id === state.currentChatId);
    if (session) {
      session.messages = state.messages;
      session.timestamp = Date.now();
      
      // Move to top of history
      state.history = state.history.filter(s => s.id !== state.currentChatId);
      state.history.unshift(session);
    }
  }
  
  localStorage.setItem('bruhaspati_chat_history', JSON.stringify(state.history));
  renderHistoryList();
}

function saveAIMessageToState(query, parsed, cardId, isError = false) {
  state.messages.push({
    sender: isError ? 'error' : 'ai',
    query: query,
    data: parsed,
    text: isError ? parsed.error : '',
    timestamp: Date.now()
  });
  saveCurrentChatSession();
}

// ---- SEND MESSAGE ----
window.sendMessage = async function() {
  const input = document.getElementById('userInput');
  const query = input.value.trim();
  
  if (!localStorage.getItem('bruhaspati_auth')) {
    showToast("⚠️ Please log in to use the chat.");
    if (typeof initAuth === 'function') initAuth();
    return;
  }
  
  if (!query || state.isTyping) return;
  
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // Token Limit Validation
  let cost = estimateRequestCost(query);
  if (!checkTokenLimit(cost)) {
    openUpgradeModal();
    showToast("⚠️ Daily limit reached. Please upgrade or configure Pro keys.");
    return;
  }

  // Hide Welcome Screen
  document.getElementById('welcomeScreen').style.display = 'none';

  // Append user bubble
  const hasAttachment = uploadedFiles.length > 0;
  state.messages.push({
    sender: 'user',
    text: query,
    hasAttachment: hasAttachment,
    timestamp: Date.now()
  });
  
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = 'msg-user';
  let badgeHtml = hasAttachment ? `<span class="attachment-badge" style="font-size:9.5px; opacity:0.6; margin-right:4px;">📎 Notes attached</span>` : '';
  div.innerHTML = `
    <div class="msg-user-bubble">
      ${badgeHtml}${escapeHtml(query)}
      <span class="msg-timestamp">${formatTime(Date.now())}</span>
    </div>
  `;
  area.appendChild(div);
  
  input.value = '';
  autoResize(input);
  scrollToBottom();
  
  // Show streaming bubble placeholder
  const streamCardId = 'resp_' + Date.now();
  const aiBubbleDiv = document.createElement('div');
  aiBubbleDiv.className = 'msg-ai';
  aiBubbleDiv.innerHTML = `
    <div class="ai-avatar"><img src="logo.jpg" alt="Bruhaspati AI"></div>
    <div class="ai-content">
      <div class="response-card skeleton-card" id="${streamCardId}">
        <div class="skeleton-line" style="width: 40%"></div>
        <div class="skeleton-line" style="width: 90%"></div>
        <div class="skeleton-line" style="width: 75%"></div>
        <div class="skeleton-line" style="width: 60%"></div>
      </div>
      <span class="msg-timestamp">${formatTime(Date.now())}</span>
    </div>
  `;
  area.appendChild(aiBubbleDiv);
  scrollToBottom();
  
  state.isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  
  // Stream response call
  await streamAIResponse(query, streamCardId);
  
  // Clear local upload previews
  uploadedFiles = [];
  renderUploadPreviews();
  
  // consumeTokens is now called strictly on successful finish inside streamAIResponse (BUG 1)
  
  state.isTyping = false;
  document.getElementById('sendBtn').disabled = false;
}

window.retryMessage = async function(query, cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  
  let cost = estimateRequestCost(query);
  if (!checkTokenLimit(cost)) {
    openUpgradeModal();
    showToast("⚠️ Daily limit reached. Please upgrade or configure Pro keys.");
    return;
  }
  
  state.isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  
  await streamAIResponse(query, cardId);
  
  // consumeTokens is called strictly on success inside streamAIResponse (BUG 1)
  state.isTyping = false;
  document.getElementById('sendBtn').disabled = false;
};

// ---- PRE-WARM CONTEXT ----
let hasPreWarmed = false;
window.handlePreWarm = function() {
  if (hasPreWarmed) return;
  hasPreWarmed = true;
  
  if (state.apiKey) {
    if (state.apiKey.startsWith('sk-')) {
      fetch("https://api.openai.com/v1/chat/completions", { method: "OPTIONS" }).catch(() => {});
    } else {
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${state.apiKey}`, { method: "GET" }).catch(() => {});
    }
  }
};

// ---- AUTOCOMPLETE SUGGESTIONS POPUP ----
let autocompleteTimeout = null;

function setupAutocomplete() {
  const input = document.getElementById('quickActionTopic');
  const popup = document.getElementById('autocompletePopup');
  if (!input || !popup) return;
  
  input.addEventListener('input', () => {
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(() => {
      showAutocompleteSuggestions(input.value.trim());
    }, 200);
  });
  
  input.addEventListener('keydown', (e) => {
    const items = popup.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;
    
    let activeIdx = -1;
    items.forEach((item, idx) => {
      if (item.classList.contains('selected')) activeIdx = idx;
    });
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeIdx !== -1) items[activeIdx].classList.remove('selected');
      let nextIdx = (activeIdx + 1) % items.length;
      items[nextIdx].classList.add('selected');
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeIdx !== -1) items[activeIdx].classList.remove('selected');
      let prevIdx = (activeIdx - 1 + items.length) % items.length;
      items[prevIdx].classList.add('selected');
      items[prevIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (activeIdx !== -1) {
        e.preventDefault();
        selectAutocompleteItem(items[activeIdx].textContent);
      }
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (e.target !== input && e.target !== popup && !popup.contains(e.target)) {
      hideAutocomplete();
    }
  });
}

function showAutocompleteSuggestions(query) {
  const input = document.getElementById('quickActionTopic');
  const popup = document.getElementById('autocompletePopup');
  if (!input || !popup) return;
  
  if (query.length < 2) {
    hideAutocomplete();
    return;
  }
  
  const classVal = document.getElementById('quickActionClass').value;
  const subject = document.getElementById('quickActionSubject').value;
  
  const matches = getChapterSuggestions(subject, classVal, query);
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

window.selectAutocompleteItem = function(val) {
  const input = document.getElementById('quickActionTopic');
  if (input) {
    input.value = val;
  }
  hideAutocomplete();
};

function hideAutocomplete() {
  const popup = document.getElementById('autocompletePopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

// ---- ANSWER FORMAT SELECTOR ----
window.setAnswerFormat = function(format) {
  state.format = format;
  localStorage.setItem('bruhaspati_answer_format', format);
  
  document.querySelectorAll('.mode-chip').forEach(pill => {
    pill.classList.remove('mode-chip--active');
    if (pill.dataset.mode === format) {
      pill.classList.add('mode-chip--active');
    }
  });
};

// ---- SETTINGS MODAL CONTROL PANEL ----
window.openSettingsModal = function() {
  document.getElementById('settingsModal').classList.add('active');
};

window.closeSettingsModal = function() {
  document.getElementById('settingsModal').classList.remove('active');
};

window.switchSettingsTab = function(btn, tabId) {
  document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
};

window.applySettingsTheme = function(theme) {
  document.body.classList.remove('light-theme', 'oled-theme');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else if (theme === 'oled') {
    document.body.classList.add('oled-theme');
  }
  state.theme = theme;
  localStorage.setItem('bruhaspati_theme', theme);
};

window.applySettingsFontSize = function(size) {
  document.body.classList.remove('font-small', 'font-large');
  if (size === 'small') {
    document.body.classList.add('font-small');
  } else if (size === 'large') {
    document.body.classList.add('font-large');
  }
  state.fontSize = size;
  localStorage.setItem('bruhaspati_font_size', size);
};

window.applyReduceAnimations = function(reduce) {
  if (reduce) {
    document.body.classList.add('reduce-animations');
  } else {
    document.body.classList.remove('reduce-animations');
  }
  state.reduceAnimations = reduce;
  localStorage.setItem('bruhaspati_reduce_animations', reduce);
};

window.saveSettings = function() {
  const name = document.getElementById('profileName').value.trim();
  const board = document.getElementById('profileBoard').value;
  const classLevel = document.getElementById('profileClass').value;
  const language = document.getElementById('settingsLanguage').value;
  const apiKey = document.getElementById('settingsApiKey').value.trim();
  
  state.studentName = name;
  state.board = board;
  state.classLevel = classLevel;
  state.language = language;
  
  localStorage.setItem('bruhaspati_student_name', name);
  localStorage.setItem('bruhaspati_board', board);
  localStorage.setItem('bruhaspati_class_level', classLevel);
  localStorage.setItem('bruhaspati_language', language);
  
  if (apiKey) {
    state.apiKey = apiKey;
    localStorage.setItem('bruhaspati_api_key', apiKey);
    updateAPIStatus(true);
    const isOA = apiKey.startsWith('sk-');
    showToast(`🔑 Custom ${isOA ? 'OpenAI' : 'Gemini'} API key saved & connected!`);
  } else {
    localStorage.removeItem('bruhaspati_api_key');
    state.apiKey = 'REDACTED_API_KEY';
    updateAPIStatus(false);
    showToast("ℹ️ Custom key cleared. Switched to fallback mode.");
  }
  
  updateSidebarSelectors(state.subject, classLevel);
  document.querySelectorAll('.board-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.board === board) btn.classList.add('active');
  });
  
  updateFilters();
  closeSettingsModal();
  showToast("⚙️ Settings saved successfully!");
};

// Data Tab management functions
window.exportChatHistory = function() {
  const historyData = localStorage.getItem('bruhaspati_chat_history') || '[]';
  const blob = new Blob([historyData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bruhaspati_AI_Study_Log_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("💾 Chat logs exported successfully!");
};

window.clearAllChatHistory = function() {
  if (confirm("Are you sure you want to delete all study chats from memory? This cannot be undone.")) {
    localStorage.removeItem('bruhaspati_chat_history');
    state.history = [];
    startNewChat();
    closeSettingsModal();
    showToast("🗑️ All chat sessions deleted.");
  }
};

window.resetAllPreferences = function() {
  if (confirm("Reset all settings and filters to defaults?")) {
    localStorage.clear();
    loadTokenState();
    loadAllSettings();
    startNewChat();
    closeSettingsModal();
    showToast("🔄 Application reset to defaults.");
  }
};

function loadAllSettings() {
  state.studentName = localStorage.getItem('bruhaspati_student_name') || '';
  state.board = localStorage.getItem('bruhaspati_board') || 'CBSE';
  state.classLevel = localStorage.getItem('bruhaspati_class_level') || '11';
  state.language = localStorage.getItem('bruhaspati_language') || 'English';
  state.theme = localStorage.getItem('bruhaspati_theme') || 'dark';
  state.fontSize = localStorage.getItem('bruhaspati_font_size') || 'medium';
  state.reduceAnimations = localStorage.getItem('bruhaspati_reduce_animations') === 'true';
  state.format = localStorage.getItem('bruhaspati_answer_format') || 'structured';
  
  // Populate settings elements
  document.getElementById('profileName').value = state.studentName;
  document.getElementById('profileBoard').value = state.board;
  document.getElementById('profileClass').value = state.classLevel;
  document.getElementById('settingsLanguage').value = state.language;
  document.getElementById('settingsTheme').value = state.theme;
  document.getElementById('settingsFontSize').value = state.fontSize;
  document.getElementById('reduceAnimations').checked = state.reduceAnimations;
  
  // Populate custom API key
  const savedKey = localStorage.getItem('bruhaspati_api_key');
  document.getElementById('settingsApiKey').value = (savedKey && savedKey !== 'REDACTED_API_KEY') ? savedKey : '';
  
  applySettingsTheme(state.theme);
  applySettingsFontSize(state.fontSize);
  applyReduceAnimations(state.reduceAnimations);
  setAnswerFormat(state.format);
  
  updateSidebarSelectors(state.subject, state.classLevel);
  document.querySelectorAll('.board-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.board === state.board) btn.classList.add('active');
  });
  
  updateFilters();
}

// ---- DYNAMIC EMPTY STATE CYCLE SUGGESTIONS ----
const SUGGESTION_POOL = [
  "Explain Photosynthesis for Class 10",
  "What is Lanthanoid Contraction in Chemistry?",
  "Explain Newton's Laws of Motion with examples",
  "Derive the formula for Electric Potential of a dipole",
  "What is Markovnikov's Rule in Organic Chemistry?",
  "How is DNA Replication initiated in Eukaryotes?",
  "Solve properties of Symmetric Matrices for Class 12",
  "Explain the concept of Limits and Derivatives in Maths",
  "Explain the process of double fertilization in plants",
  "Explain Gibbs free energy and chemical spontaneity"
];

function startCyclingSuggestions() {
  const container = document.getElementById('cyclingSuggestions');
  if (!container) return;
  
  setInterval(() => {
    let shuffled = SUGGESTION_POOL.sort(() => 0.5 - Math.random()).slice(0, 3);
    container.innerHTML = shuffled.map(s => `
      <button class="suggestion-chip" onclick="sendSuggestion('${escapeAttr(s)}')">
        ✨ ${escapeHtml(s)}
      </button>
    `).join('');
  }, 6000);
}

// ---- KEYBOARD SHORTCUTS ----
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    startNewChat();
  }
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    document.getElementById('userInput').focus();
  }
  if (e.key === 'Escape') {
    closeQuiz();
    closeQuickActionModal();
    closeSettingsModal();
    closeUpgradeModal();
    hideAutocomplete();
  }
});

// ---- SIDEBAR DESKTOP COLLAPSE CONTROLLER ----
window.toggleSidebarCollapse = function() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('bruhaspati_sidebar_collapsed', isCollapsed);
    
    // Adjust header layout if collapsed
    const collapseBtn = document.getElementById('sidebarCollapseToggle');
    if (collapseBtn) {
      collapseBtn.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }
};

// ---- SETUP PAGE AND SELECTORS HOOKS ----
document.addEventListener('DOMContentLoaded', () => {
  // Restore sidebar collapse setting
  if (localStorage.getItem('bruhaspati_sidebar_collapsed') === 'true') {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
    const collapseBtn = document.getElementById('sidebarCollapseToggle');
    if (collapseBtn) collapseBtn.style.transform = 'rotate(180deg)';
  }

  // Board buttons
  document.querySelectorAll('.board-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.board-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.board = btn.dataset.board;
      updateFilters();
    });
  });

  // Class buttons
  document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.classLevel = btn.dataset.class;
      updateFilters();
    });
  });

  // Subject buttons
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.subject = btn.dataset.subject;
      updateFilters();
    });
  });

  // Clear the old expired key if it was saved in localStorage to force fallback to the new default key
  const oldKey = 'REDACTED_OLD_KEY';
  if (localStorage.getItem('bruhaspati_api_key') === oldKey) {
    localStorage.removeItem('bruhaspati_api_key');
  }

  // Load custom API key if present, otherwise default to REDACTED_API_KEY
  const savedKey = localStorage.getItem('bruhaspati_api_key');
  if (savedKey && savedKey !== 'REDACTED_API_KEY' && savedKey !== 'REDACTED_OLD_KEY') {
    state.apiKey = savedKey;
    state.useRealAPI = true;
    updateAPIStatus(true);
  } else {
    state.apiKey = 'REDACTED_API_KEY';
    state.useRealAPI = true;
    updateAPIStatus(false);
  }
  
  // Init other managers
  loadTokenState();
  loadAllSettings();
  loadChatHistory();
  renderBookmarksList();
  setupAutocomplete();
  startCyclingSuggestions();
  renderNCERTBooks();
});

// Add error bubble helper
function addErrorMessage(text) {
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = 'msg-ai';
  div.innerHTML = `
    <div class="ai-avatar"><img src="logo.jpg" alt="Bruhaspati AI"></div>
    <div class="ai-content">
      <div class="response-card" style="padding: 16px 20px;">
        <div class="callout callout-rose">⚠️ ${text}</div>
      </div>
      <span class="msg-timestamp">${formatTime(Date.now())}</span>
    </div>
  `;
  area.appendChild(div);
  scrollToBottom();
}

function updateFilters() {
  const boardLabels = {
    CBSE: 'CBSE', CHSE: 'CHSE Odisha', BSE: 'BSE Odisha',
    JEE: 'JEE Main', JEEADV: 'JEE Advanced', NEET: 'NEET UG',
    IAT: 'IISER IAT', NTA: 'NTA/CUET'
  };
  const board = boardLabels[state.board] || state.board;
  const cls = state.classLevel === 'UG' ? 'UG/PG' : 'Class ' + state.classLevel;
  const sub = state.subject;

  document.querySelector('.board-chip').textContent = board;
  document.querySelector('.class-chip').textContent = cls;
  document.querySelector('.subject-chip').textContent = sub;
}

function updateSidebarSelectors(subject, classLevel) {
  document.querySelectorAll('.subject-btn').forEach(btn => {
    if (btn.dataset.subject === subject) {
      document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
  
  document.querySelectorAll('.class-btn').forEach(btn => {
    if (btn.dataset.class === classLevel) {
      document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
}

window.autoResize = function(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
};

window.toggleTheme = function() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('light-theme');
  const icon = document.getElementById('themeIcon');
  if (state.theme === 'light') {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  localStorage.setItem('bruhaspati_theme', state.theme);
  const settingsThemeSelect = document.getElementById('settingsTheme');
  if (settingsThemeSelect) settingsThemeSelect.value = state.theme;
};

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    const chatBtn = document.getElementById('mobileNavChat');
    const histBtn = document.getElementById('mobileNavHistory');
    if (chatBtn && histBtn) {
      if (isOpen) {
        chatBtn.classList.remove('active');
        histBtn.classList.add('active');
      } else {
        chatBtn.classList.add('active');
        histBtn.classList.remove('active');
      }
    }
  }
};

window.switchMobileTab = function(tab) {
  const sidebar = document.getElementById('sidebar');
  const chatBtn = document.getElementById('mobileNavChat');
  const histBtn = document.getElementById('mobileNavHistory');
  
  if (tab === 'history') {
    if (sidebar) sidebar.classList.add('open');
    if (chatBtn) chatBtn.classList.remove('active');
    if (histBtn) histBtn.classList.add('active');
  } else if (tab === 'chat') {
    if (sidebar) sidebar.classList.remove('open');
    if (chatBtn) chatBtn.classList.add('active');
    if (histBtn) histBtn.classList.remove('active');
  }
};

window.clearChat = function() {
  document.getElementById('messagesArea').innerHTML = '';
  document.getElementById('welcomeScreen').style.display = 'flex';
  state.messages = [];
  uploadedFiles = [];
  renderUploadPreviews();
  showToast('🗑️ Chat cleared');
};

function scrollToBottom() {
  const c = document.getElementById('chatContainer');
  setTimeout(() => { c.scrollTop = c.scrollHeight; }, 100);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

window.openKeyModal = function() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('active');
    switchSettingsTab(document.querySelector('.settings-tab-btn:nth-child(3)'), 'usage-tab');
  }
};

window.saveApiKey = function() {
  // Settings modal save acts as main profile & keys saver.
  saveSettings();
};

window.setAPIKey = function(key) {
  state.apiKey = key;
  state.useRealAPI = !!key;
  if (key) {
    localStorage.setItem('bruhaspati_api_key', key);
    updateAPIStatus(true);
    const isOA = key.startsWith('sk-');
    console.log(`✅ Bruhaspati AI: ${isOA ? 'OpenAI' : 'Gemini'} API key set! Real AI responses enabled.`);
    showToast(`✅ ${isOA ? 'OpenAI' : 'Gemini'} API connected! Real AI enabled.`);
  } else {
    localStorage.removeItem('bruhaspati_api_key');
    updateAPIStatus(false);
    console.log('🗑️ Bruhaspati AI: API key cleared. Switched to Demo Mode.');
    showToast('🔑 API Key cleared. Switched to Demo Mode.');
  }
};

function updateAPIStatus(connected) {
  const badge = document.querySelector('.ai-badge');
  if (connected && state.apiKey && state.apiKey !== 'REDACTED_API_KEY') {
    const isOA = state.apiKey.startsWith('sk-');
    if (badge) {
      badge.innerHTML = `
        <span class="ai-dot" style="background: var(--accent-emerald); box-shadow: 0 0 8px rgba(16,185,129,0.6);"></span>
        <span>${isOA ? 'OpenAI' : 'Gemini'} Connected</span>
      `;
    }
  } else {
    if (badge) {
      badge.innerHTML = `
        <span class="ai-dot" style="background: var(--accent-amber); box-shadow: 0 0 8px rgba(245,158,11,0.6);"></span>
        <span>Demo Mode (Active)</span>
      `;
    }
  }
}

// Dummy backward compatible modal closures
window.closeQuiz = function() {
  const modal = document.getElementById('quizModal');
  if (modal) modal.classList.remove('active');
};
window.submitQuizAnswer = function() {
  closeQuiz();
};

// Quick action generator from sidebar button clicks
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
};

window.closeQuickActionModal = function() {
  document.getElementById('quickActionModal').classList.remove('active');
};

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
};

// Cycling suggestions sender helper
window.sendSuggestion = function(text) {
  document.getElementById('userInput').value = text;
  sendMessage();
};

// ---- SYSTEM SHUTDOWN LOGS ----
console.log('%c🪐 Bruhaspati AI Engine Connected', 'font-size:14px; font-weight:bold; color:#10b981;');

// ==========================================
// PREMIUM DYNAMIC LOADER ENGINE
// ==========================================
let activeLoaderIntervals = {};
let activeLoaderCleanups = {};

function renderPetalsHTML(layer) {
  const angles = Array.from({ length: 12 }, (_, i) => i * 30 + (layer === 'inner' ? 15 : 0));
  const scale = layer === 'inner' ? 0.82 : 1.0;
  const strokeWidth = layer === 'inner' ? 1.0 : 1.4;
  const fill = layer === 'inner' ? 'url(#innerPetalGrad)' : 'url(#outerPetalGrad)';
  
  return angles.map((angle, idx) => {
    let circuits = '';
    if (layer === 'inner') {
      circuits = `
        <path d="M 50,42 L 50,15" fill="none" stroke="#60A5FA" stroke-width="0.75" class="circuit-path center-track" style="animation-delay: ${idx * 0.05 + 0.1}s;" />
        <circle cx="50" cy="15" r="0.7" fill="#93C5FD" class="circuit-node" style="animation-delay: ${idx * 0.05 + 0.7}s;" />
        
        <path d="M 50,35 L 45,28 L 45,20" fill="none" stroke="#60A5FA" stroke-width="0.75" class="circuit-path left-track" style="animation-delay: ${idx * 0.05 + 0.25}s;" />
        <circle cx="45" cy="20" r="0.7" fill="#93C5FD" class="circuit-node" style="animation-delay: ${idx * 0.05 + 0.85}s;" />
        
        <path d="M 50,31 L 55,25 L 55,18" fill="none" stroke="#60A5FA" stroke-width="0.75" class="circuit-path right-track" style="animation-delay: ${idx * 0.05 + 0.4}s;" />
        <circle cx="55" cy="18" r="0.7" fill="#93C5FD" class="circuit-node" style="animation-delay: ${idx * 0.05 + 1.0}s;" />
      `;
    }
    
    return `
      <g transform="rotate(${angle} 50 50) scale(${scale})" class="petal-item" style="animation-delay: ${idx * 0.03}s;">
        <path d="M 50,50 C 36,32 38,12 50,2 C 62,12 64,32 50,50 Z" fill="${fill}" />
        <path d="M 50,50 C 36,32 38,12 50,2 C 62,12 64,32 50,50" fill="none" stroke="url(#goldGrad)" stroke-width="${strokeWidth}" />
        ${circuits}
      </g>
    `;
  }).join('');
}

function renderConstellationHTML() {
  const nodes = [
    { cx: 50, cy: 37 }, { cx: 43, cy: 59 }, { cx: 57, cy: 59 },
    { cx: 46, cy: 51 }, { cx: 54, cy: 51 }, { cx: 48, cy: 44 },
    { cx: 52, cy: 44 }, { cx: 50, cy: 51 }, { cx: 50, cy: 59 }
  ];
  
  const lines = [
    { from: [50, 37], to: [48, 44] }, { from: [50, 37], to: [52, 44] },
    { from: [48, 44], to: [46, 51] }, { from: [52, 44], to: [54, 51] },
    { from: [46, 51], to: [43, 59] }, { from: [54, 51], to: [57, 59] },
    { from: [46, 51], to: [50, 51] }, { from: [54, 51], to: [50, 51] },
    { from: [48, 44], to: [52, 44] }, { from: [50, 51], to: [50, 59] },
    { from: [43, 59], to: [50, 59] }, { from: [57, 59], to: [50, 59] }
  ];
  
  const linesHTML = lines.map((l, idx) => `
    <line x1="${l.from[0]}" y1="${l.from[1]}" x2="${l.to[0]}" y2="${l.to[1]}" stroke="#F5C76A" stroke-width="0.8" opacity="0" class="constellation-line" style="animation-delay: ${idx * 0.03 + 0.1}s;" />
  `).join('');
  
  const nodesHTML = nodes.map((n, idx) => `
    <circle cx="${n.cx}" cy="${n.cy}" r="1.2" fill="#F5C76A" stroke="#0B1020" stroke-width="0.4" class="constellation-node" style="animation-delay: ${idx * 0.02 + 0.45}s;" />
  `).join('');
  
  return linesHTML + nodesHTML;
}

function initBackgroundParticles(canvasId, subject) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  let animationFrameId;
  let width = (canvas.width = canvas.parentElement.clientWidth || 520);
  let height = (canvas.height = canvas.parentElement.clientHeight || 500);
  
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      width = canvas.width = entry.contentRect.width;
      height = canvas.height = entry.contentRect.height;
    }
  });
  resizeObserver.observe(canvas.parentElement);
  
  const particles = [];
  const particleCount = 25;
  
  let colorPrefix = 'rgba(79, 124, 255, ';
  if (subject === 'Physics') colorPrefix = 'rgba(79, 124, 255, ';
  else if (subject === 'Chemistry') colorPrefix = 'rgba(52, 211, 153, ';
  else if (subject === 'Biology') colorPrefix = 'rgba(236, 72, 153, ';
  else if (subject === 'Mathematics') colorPrefix = 'rgba(245, 199, 106, ';
  else if (subject === 'History') colorPrefix = 'rgba(217, 119, 6, ';
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.6,
      speedY: (Math.random() - 0.5) * 0.6,
      alpha: Math.random() * 0.4 + 0.1,
      angle: Math.random() * Math.PI * 2,
      angleSpeed: (Math.random() - 0.5) * 0.02
    });
  }
  
  let time = 0;
  
  function drawPhysicsLines(t) {
    ctx.strokeStyle = 'rgba(79, 124, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 15) {
      const y = height / 2 + Math.sin(x * 0.005 + t * 0.002) * 50 * Math.sin(t * 0.0005);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  
  function drawMathGrid() {
    ctx.strokeStyle = 'rgba(245, 199, 106, 0.015)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  
  function render() {
    time++;
    ctx.clearRect(0, 0, width, height);
    
    if (subject === 'Physics') drawPhysicsLines(time);
    if (subject === 'Mathematics') drawMathGrid();
    
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      
      ctx.beginPath();
      
      if (subject === 'Chemistry') {
        ctx.arc(p.x, p.y, p.size * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = `${colorPrefix}${p.alpha})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y + 6, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = `${colorPrefix}${p.alpha * 0.3})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 10, p.y + 6);
        ctx.stroke();
      } else if (subject === 'Biology') {
        p.angle += p.angleSpeed;
        const helixX = p.x + Math.sin(p.angle) * 12;
        ctx.arc(helixX, p.y, p.size * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `${colorPrefix}${p.alpha})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x - Math.sin(p.angle) * 12, p.y, p.size * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fill();
      } else if (subject === 'Mathematics') {
        ctx.rect(p.x, p.y, p.size * 1.8, p.size * 1.8);
        ctx.fillStyle = `${colorPrefix}${p.alpha})`;
        ctx.fill();
      } else {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${colorPrefix}${p.alpha})`;
        ctx.fill();
      }
    });
    
    animationFrameId = requestAnimationFrame(render);
  }
  
  render();
  
  return () => {
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
  };
}

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

// Sleek Inline Typing Bubble Loader
function showTypingLoader(cardId, container) {
  container.innerHTML = `
    <div class="typing-bubble" id="${cardId}_loader">
      <div class="tbdot"></div>
      <div class="tbdot"></div>
      <div class="tbdot"></div>
    </div>
  `;
}

// Premium Mandala Orbit Loader (Deep Thinking)
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


// ==========================================
// CHAPTER AUTOCOMPLETE DATABASE (BUG 4A)
// ==========================================
const CHAPTER_DB = {
  "Physics-11": [
    "Physical World", "Units and Measurements", "Motion in a Straight Line",
    "Motion in a Plane", "Laws of Motion", "Work, Energy and Power",
    "System of Particles and Rotational Motion", "Gravitation",
    "Mechanical Properties of Solids", "Mechanical Properties of Fluids",
    "Thermal Properties of Matter", "Thermodynamics",
    "Kinetic Theory", "Oscillations", "Waves"
  ],
  "Physics-12": [
    "Electric Charges and Fields", "Electrostatic Potential and Capacitance",
    "Current Electricity", "Moving Charges and Magnetism",
    "Magnetism and Matter", "Electromagnetic Induction",
    "Alternating Current", "Electromagnetic Waves",
    "Ray Optics and Optical Instruments", "Wave Optics",
    "Dual Nature of Radiation and Matter", "Atoms",
    "Nuclei", "Semiconductor Electronics"
  ],
  "Chemistry-11": [
    "Some Basic Concepts of Chemistry", "Structure of Atom",
    "Classification of Elements and Periodicity in Properties",
    "Chemical Bonding and Molecular Structure", "States of Matter",
    "Thermodynamics", "Equilibrium", "Redox Reactions",
    "Hydrogen", "The s-Block Elements", "The p-Block Elements",
    "Organic Chemistry – Some Basic Principles and Techniques",
    "Hydrocarbons", "Environmental Chemistry"
  ],
  "Chemistry-12": [
    "The Solid State", "Solutions", "Electrochemistry",
    "Chemical Kinetics", "Surface Chemistry",
    "General Principles and Processes of Isolation of Elements",
    "The p-Block Elements", "The d- and f-Block Elements",
    "Coordination Compounds", "Haloalkanes and Haloarenes",
    "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids",
    "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life"
  ],
  "Mathematics-11": [
    "Sets", "Relations and Functions", "Trigonometric Functions",
    "Principle of Mathematical Induction", "Complex Numbers and Quadratic Equations",
    "Linear Inequalities", "Permutations and Combinations",
    "Binomial Theorem", "Sequences and Series",
    "Straight Lines", "Conic Sections",
    "Introduction to Three Dimensional Geometry",
    "Limits and Derivatives", "Mathematical Reasoning", "Statistics", "Probability"
  ],
  "Mathematics-12": [
    "Relations and Functions", "Inverse Trigonometric Functions",
    "Matrices", "Determinants", "Continuity and Differentiability",
    "Application of Derivatives", "Integrals",
    "Application of Integrals", "Differential Equations",
    "Vector Algebra", "Three Dimensional Geometry",
    "Linear Programming", "Probability"
  ],
  "Biology-11": [
    "The Living World", "Biological Classification",
    "Plant Kingdom", "Animal Kingdom",
    "Morphology of Flowering Plants", "Anatomy of Flowering Plants",
    "Structural Organisation in Animals", "Cell: The Unit of Life",
    "Biomolecules", "Cell Cycle and Cell Division",
    "Photosynthesis in Higher Plants", "Respiration in Plants",
    "Plant Growth and Development", "Breathing and Exchange of Gases",
    "Body Fluids and Circulation", "Excretory Products and their Elimination",
    "Locomotion and Movement", "Neural Control and Coordination",
    "Chemical Coordination and Integration"
  ],
  "Biology-12": [
    "Reproduction in Organisms", "Sexual Reproduction in Flowering Plants",
    "Human Reproduction", "Reproductive Health",
    "Principles of Inheritance and Variation", "Molecular Basis of Inheritance",
    "Evolution", "Human Health and Disease",
    "Strategies for Enhancement in Food Production",
    "Microbes in Human Welfare", "Biotechnology: Principles and Processes",
    "Biotechnology and its Applications", "Organisms and Populations",
    "Ecosystem", "Biodiversity and Conservation", "Environmental Issues"
  ],
  "English-11": [
    "Hornbill – The Portrait of a Lady", "Hornbill – We're Not Afraid to Die",
    "Hornbill – Discovering Tut", "Hornbill – Landscape of the Soul",
    "Hornbill – The Ailing Planet", "Hornbill – The Browning Version",
    "Hornbill – The Adventure", "Hornbill – Silk Road",
    "Snapshots – The Summer of the Beautiful White Horse",
    "Snapshots – The Address", "Snapshots – Ranga's Marriage",
    "Snapshots – Albert Einstein at School", "Snapshots – Mother's Day",
    "Snapshots – The Ghat of the Only World", "Snapshots – Birth", "Snapshots – The Tale of Melon City"
  ],
  "English-12": [
    "Flamingo – The Last Lesson", "Flamingo – Lost Spring",
    "Flamingo – Deep Water", "Flamingo – The Rattrap",
    "Flamingo – Indigo", "Flamingo – Poets and Pancakes",
    "Flamingo – The Interview", "Flamingo – Going Places",
    "Vistas – The Third Level", "Vistas – The Tiger King",
    "Vistas – Journey to the End of the Earth", "Vistas – The Enemy",
    "Vistas – Should Wizard Hit Mommy", "Vistas – On the Face of It",
    "Vistas – Evans Tries an O-level", "Vistas – Memories of Childhood"
  ],
  "History-11": [
    "From the Beginning of Time", "Writing and City Life",
    "An Empire Across Three Continents", "The Central Islamic Lands",
    "Nomadic Empires", "The Three Orders",
    "Changing Cultural Traditions", "Confrontation of Cultures",
    "The Industrial Revolution", "Displacing Indigenous Peoples",
    "Paths to Modernisation"
  ],
  "History-12": [
    "Bricks, Beads and Bones (Harappan Civilisation)",
    "Kings, Farmers and Towns", "Kinship, Caste and Class",
    "Thinkers, Beliefs and Buildings", "Through the Eyes of Travellers",
    "Bhakti–Sufi Traditions", "An Imperial Capital: Vijayanagara",
    "Peasants, Zamindars and the State", "Kings and Chronicles",
    "Colonialism and the Countryside", "Rebels and the Raj",
    "Colonial Cities", "Mahatma Gandhi and the Nationalist Movement",
    "Understanding Partition", "Framing the Constitution"
  ],
  "Accountancy-11": [
    "Introduction to Accounting", "Theory Base of Accounting",
    "Recording of Transactions I", "Recording of Transactions II",
    "Bank Reconciliation Statement", "Trial Balance and Rectification of Errors",
    "Depreciation, Provisions and Reserves", "Bill of Exchange",
    "Financial Statements I", "Financial Statements II",
    "Accounts from Incomplete Records", "Applications of Computers in Accounting",
    "Computerised Accounting System"
  ],
  "Accountancy-12": [
    "Accounting for Partnership Firms – Fundamentals",
    "Change in Profit Sharing Ratio Among the Existing Partners",
    "Admission of a Partner", "Retirement and Death of a Partner",
    "Dissolution of Partnership Firm",
    "Accounting for Share Capital", "Issue and Redemption of Debentures",
    "Financial Statements of a Company",
    "Analysis of Financial Statements", "Accounting Ratios", "Cash Flow Statement"
  ],
  "Economics-11": [
    "Indian Economy on the Eve of Independence",
    "Indian Economy 1950–1990", "Liberalisation, Privatisation and Globalisation",
    "Poverty", "Human Capital Formation in India",
    "Rural Development", "Employment: Growth, Informalisation and Other Issues",
    "Infrastructure", "Environment and Sustainable Development",
    "Comparative Development Experiences of India and its Neighbours",
    "Introduction to Statistics", "Collection of Data",
    "Organisation of Data", "Presentation of Data",
    "Measures of Central Tendency", "Measures of Dispersion",
    "Correlation", "Index Numbers", "Use of Statistical Tools"
  ],
  "Economics-12": [
    "Introduction to Microeconomics", "Theory of Consumer Behaviour",
    "Production and Costs", "Theory of the Firm under Perfect Competition",
    "Market Equilibrium", "Non-competitive Markets",
    "Introduction to Macroeconomics", "National Income Accounting",
    "Money and Banking", "Determination of Income and Employment",
    "Government Budget and the Economy", "Open Economy Macroeconomics"
  ]
};

// Autocomplete filter helper
function getChapterSuggestions(subject, classLevel, query) {
  const key = `${subject}-${classLevel}`;
  const chapters = CHAPTER_DB[key] || [];
  if (!query || query.length < 2) return chapters.slice(0, 8);
  return chapters.filter(c =>
    c.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);
}


// ==========================================
// NCERT LIBRARY DATABASE & ACTIONS (FEAT 7)
// ==========================================
const NCERT_BOOKS = {
  "Class 11": {
    Physics:      "https://ncert.nic.in/textbook.php?keph1=0-15",
    Chemistry:    "https://ncert.nic.in/textbook.php?kech1=0-14",
    Mathematics:  "https://ncert.nic.in/textbook.php?kemh1=0-16",
    Biology:      "https://ncert.nic.in/textbook.php?kebo1=0-22",
    English:      "https://ncert.nic.in/textbook.php?kehn1=0-8",
    History:      "https://ncert.nic.in/textbook.php?leth1=0-11",
    Economics:    "https://ncert.nic.in/textbook.php?keec1=0-9",
    Accountancy:  "https://ncert.nic.in/textbook.php?kacc1=0-9",
    "Pol. Science":"https://ncert.nic.in/textbook.php?keps1=0-10",
    Geography:    "https://ncert.nic.in/textbook.php?kegy1=0-9",
  },
  "Class 12": {
    "Physics I":      "https://ncert.nic.in/textbook.php?leph1=0-8",
    "Physics II":     "https://ncert.nic.in/textbook.php?leph2=0-7",
    "Chemistry I":    "https://ncert.nic.in/textbook.php?lech1=0-9",
    "Chemistry II":   "https://ncert.nic.in/textbook.php?lech2=0-7",
    Mathematics:      "https://ncert.nic.in/textbook.php?lemh1=0-6",
    "Mathematics II": "https://ncert.nic.in/textbook.php?lemh2=0-7",
    Biology:          "https://ncert.nic.in/textbook.php?lebo1=0-16",
    English:          "https://ncert.nic.in/textbook.php?lefl1=0-8",
    History:          "https://ncert.nic.in/textbook.php?leth1=0-15",
    Economics:        "https://ncert.nic.in/textbook.php?leec1=0-6",
    Accountancy:      "https://ncert.nic.in/textbook.php?lacc1=0-11",
    "Pol. Science":   "https://ncert.nic.in/textbook.php?leps1=0-10",
    Geography:        "https://ncert.nic.in/textbook.php?legy1=0-8",
  }
};

let activeNCERTTab = 'Class 11';

window.toggleNCERTLibrary = function() {
  const content = document.getElementById('ncertLibraryContent');
  const toggle = document.getElementById('ncertLibraryToggle');
  if (!content || !toggle) return;
  
  if (content.style.display === 'none') {
    content.style.display = 'flex';
    toggle.classList.add('expanded');
    renderNCERTBooks();
  } else {
    content.style.display = 'none';
    toggle.classList.remove('expanded');
  }
};

window.switchNCERTTab = function(cls) {
  activeNCERTTab = cls;
  document.getElementById('ncertTabClass11').classList.toggle('active', cls === 'Class 11');
  document.getElementById('ncertTabClass12').classList.toggle('active', cls === 'Class 12');
  renderNCERTBooks();
};

window.filterNCERTBooks = function() {
  renderNCERTBooks();
};

window.askNCERTAI = function(subject, cls) {
  // Map clean values
  let cleanSubject = subject.replace(/ I+$/, ''); // convert Physics I to Physics
  let cleanClass = cls.replace('Class ', ''); // convert Class 11 to 11
  
  state.subject = cleanSubject;
  state.classLevel = cleanClass;
  updateFilters();
  updateSidebarSelectors(cleanSubject, cleanClass);
  
  const query = `Teach me about ${cleanSubject} in Class ${cleanClass} according to the NCERT syllabus`;
  window.sendSuggestion(query);
};

// PDFJS global configuration
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

let activePageFlipInstance = null;
let currentPdfDocument = null;
let currentPdfPagesRendered = {};
let currentPdfZoom = 1.0;
let flipbookBookEl = null;

// Clean up existing page flip book element and instance
function destroyPageFlip() {
  if (activePageFlipInstance) {
    try {
      activePageFlipInstance.destroy();
    } catch(e) {
      console.warn("Error destroying page flip:", e);
    }
    activePageFlipInstance = null;
  }
  
  const viewportContainer = document.getElementById('flipbookCanvas');
  if (viewportContainer) {
    viewportContainer.innerHTML = '';
  }
  currentPdfDocument = null;
  currentPdfPagesRendered = {};
}

window.launchFlipbook = function(subject, cls, url) {
  const modal = document.getElementById('flipbookModal');
  if (!modal) return;
  modal.classList.add('active');
  
  document.getElementById('flipbookTitle').textContent = `${subject} - Class ${cls.replace('Class ', '')}`;
  document.getElementById('flipbookSubtitle').textContent = `Bruhaspati AI 3D Reader Engine`;
  document.getElementById('flipbookSourceBadge').textContent = 'Loading...';
  document.getElementById('flipbookSourceBadge').style.background = 'rgba(245, 199, 106, 0.15)';
  document.getElementById('flipbookSourceBadge').style.color = '#F5C76A';
  document.getElementById('flipbookSourceBadge').style.borderColor = 'rgba(245, 199, 106, 0.3)';
  
  // Show loader
  document.getElementById('flipbookLoader').style.display = 'flex';
  document.getElementById('flipbookLoaderText').textContent = 'Initializing 3D Viewer...';
  document.getElementById('flipbookLoadProgress').style.width = '10%';
  document.getElementById('flipbookWrapper').style.display = 'none';
  
  destroyPageFlip();
  
  // Set up download URL
  const downloadLink = document.getElementById('flipbookDownloadLink');
  if (downloadLink) downloadLink.href = url;
  
  // Use local proxy path to bypass CORS for NCERT official URL
  const proxyUrl = url.replace('https://ncert.nic.in', '/ncert-proxy');
  
  console.log("Loading PDF via proxy:", proxyUrl);
  
  if (typeof pdfjsLib === 'undefined' || typeof St === 'undefined') {
    console.error("PDF.js or StPageFlip scripts are not loaded correctly.");
    loadOfflineDemoFlipbook(subject, cls);
    return;
  }
  
  // Start loading PDF
  const loadingTask = pdfjsLib.getDocument({
    url: proxyUrl,
    withCredentials: false
  });
  
  loadingTask.onProgress = function(progress) {
    if (progress.total > 0) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      document.getElementById('flipbookLoadProgress').style.width = `${10 + pct * 0.4}%`;
      document.getElementById('flipbookLoaderText').textContent = `Downloading PDF (${pct}%)...`;
    }
  };
  
  loadingTask.promise.then(pdf => {
    currentPdfDocument = pdf;
    const totalPages = pdf.numPages;
    document.getElementById('flipbookTotalPages').textContent = totalPages;
    
    document.getElementById('flipbookSourceBadge').textContent = 'NCERT Official';
    document.getElementById('flipbookSourceBadge').style.background = 'rgba(16, 185, 129, 0.15)';
    document.getElementById('flipbookSourceBadge').style.color = '#34d399';
    document.getElementById('flipbookSourceBadge').style.borderColor = 'rgba(16, 185, 129, 0.3)';
    
    initializeFlipbookPages(pdf, totalPages);
  }).catch(err => {
    console.warn("Failed to load online PDF, launching offline high-fidelity demo book instead:", err);
    loadOfflineDemoFlipbook(subject, cls);
  });
};

function initializeFlipbookPages(pdf, totalPages) {
  document.getElementById('flipbookLoaderText').textContent = 'Rendering textbook pages...';
  document.getElementById('flipbookLoadProgress').style.width = '60%';
  
  const viewportContainer = document.getElementById('flipbookCanvas');
  viewportContainer.innerHTML = '';
  
  // Create page elements
  const pagePromises = [];
  
  // To avoid memory overflow, we render the first 8 pages immediately, and render the rest on-demand!
  // For the book wrapper, we create all the divs, but keep the canvases unrendered until the user gets near.
  const pagesToLoadFirst = Math.min(8, totalPages);
  
  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'flip-page';
    pageDiv.id = `pdf-page-${i}`;
    
    // Cover page styling
    if (i === 1 || i === totalPages) {
      pageDiv.setAttribute('data-density', 'hard');
      // Set simple visual fallback layout for hardcover
      pageDiv.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:linear-gradient(135deg, #1e293b, #0f172a); color:#f8fafc; border:4px solid #F5C76A; box-sizing:border-box; padding:24px; text-align:center;">
          <h1 style="font-family:'Space Grotesk', sans-serif; font-size:24px; color:#F5C76A; margin-bottom:12px;">NCERT TEXTBOOK</h1>
          <div style="width:60px; height:60px; border-radius:50%; border:2px solid #F5C76A; margin:20px 0; overflow:hidden;">
            <img src="logo.jpg" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <h2 style="font-size:16px; margin:0;">${document.getElementById('flipbookTitle').textContent}</h2>
          <span style="font-size:11px; margin-top:20px; color:#94a3b8;">Page ${i === 1 ? 'Front Cover' : 'Back Cover'}</span>
        </div>
      `;
    } else {
      // Soft pages
      pageDiv.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; background:#fff; color:#94a3b8; font-size:12px;">Rendering Page ${i}...</div>`;
    }
    
    viewportContainer.appendChild(pageDiv);
    
    if (i <= pagesToLoadFirst) {
      pagePromises.push(renderPDFPageOnDemand(pdf, i, pageDiv));
    }
  }
  
  Promise.all(pagePromises).then(() => {
    document.getElementById('flipbookLoadProgress').style.width = '90%';
    document.getElementById('flipbookLoaderText').textContent = 'Assembling 3D Animation...';
    
    // Small delay to let browser settle
    setTimeout(() => {
      buildStPageFlip(totalPages);
    }, 300);
  });
}

function renderPDFPageOnDemand(pdf, pageNum, pageDiv) {
  if (currentPdfPagesRendered[pageNum]) {
    return Promise.resolve();
  }
  
  return pdf.getPage(pageNum).then(page => {
    // Determine canvas dimensions
    const viewport = page.getViewport({ scale: currentPdfZoom * 1.5 }); // High resolution render
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    return page.render(renderContext).promise.then(() => {
      pageDiv.innerHTML = ''; // Clear fallback text
      pageDiv.appendChild(canvas);
      currentPdfPagesRendered[pageNum] = true;
    });
  }).catch(err => {
    console.error(`Error rendering page ${pageNum}:`, err);
  });
}

let currentFallbackPage = 1;

function setupFallbackSlideshow(totalPages) {
  const pages = document.querySelectorAll('.flip-page');
  
  // Set total pages count
  document.getElementById('flipbookTotalPages').textContent = totalPages;
  const pageInput = document.getElementById('flipbookPageInput');
  if (pageInput) {
    pageInput.max = totalPages;
    pageInput.value = 1;
  }
  
  // Align container styles for flat slideshow
  const parent = document.getElementById('flipbookCanvas');
  if (parent) {
    parent.style.display = 'flex';
    parent.style.justifyContent = 'center';
    parent.style.alignItems = 'center';
    parent.style.position = 'relative';
    parent.style.width = '100%';
    parent.style.height = '100%';
    parent.style.maxWidth = '600px';
    parent.style.maxHeight = '75vh';
    parent.style.margin = '0 auto';
  }
  
  function showPage(p) {
    pages.forEach((page, idx) => {
      const pageNum = idx + 1;
      if (pageNum === p) {
        page.style.display = 'block';
        page.style.width = '100%';
        page.style.height = '100%';
        
        // If it's a cover or back cover, format it nicely
        if (page.getAttribute('data-density') === 'hard') {
          // Keep internal styles as is
        } else {
          // Force layout sizing for soft pages
          page.style.background = '#FAF8F5';
          page.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
          page.style.borderRadius = '8px';
          page.style.overflow = 'auto';
        }
        
        // Lazily render PDF page if using real PDF
        if (currentPdfDocument && !currentPdfPagesRendered[p]) {
          renderPDFPageOnDemand(currentPdfDocument, p, page);
        }
      } else {
        page.style.display = 'none';
      }
    });
    const pageInput = document.getElementById('flipbookPageInput');
    if (pageInput) pageInput.value = p;
  }
  
  currentFallbackPage = 1;
  showPage(1);
  
  // Re-bind controls for fallback slideshow
  window.flipbookPrev = function() {
    if (currentFallbackPage > 1) {
      currentFallbackPage--;
      showPage(currentFallbackPage);
    }
  };
  
  window.flipbookNext = function() {
    if (currentFallbackPage < totalPages) {
      currentFallbackPage++;
      showPage(currentFallbackPage);
    }
  };
  
  window.flipbookGoToPage = function(val) {
    const p = parseInt(val);
    if (p >= 1 && p <= totalPages) {
      currentFallbackPage = p;
      showPage(p);
    }
  };
}

function buildStPageFlip(totalPages) {
  try {
    const parent = document.getElementById('flipbookCanvas');
    if (!parent) return;
    
    // Show flipbook wrapper first so clientWidth/clientHeight are computed!
    document.getElementById('flipbookWrapper').style.display = 'block';
    document.getElementById('flipbookLoader').style.display = 'none';
    
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    
    const bookWidth = isMobile ? Math.min(360, screenWidth - 40) : 500;
    const bookHeight = isMobile ? Math.min(500, window.innerHeight - 150) : 700;
    
    if (typeof St !== 'undefined' && St.PageFlip) {
      console.log("StPageFlip is defined. Initializing 3D Book...");
      
      // Initialize StPageFlip
      const pageFlip = new St.PageFlip(parent, {
        width: bookWidth,
        height: bookHeight,
        size: "stretch",
        minWidth: 320,
        maxWidth: 1000,
        minHeight: 400,
        maxHeight: 1400,
        drawShadow: true,
        maxShadowOpacity: 0.2,
        showCover: true,
        usePortrait: isMobile,
        swipeDistance: 30
      });
      
      pageFlip.loadFromHTML(document.querySelectorAll('.flip-page'));
      activePageFlipInstance = pageFlip;
      flipbookBookEl = parent;
      
      // Update total pages inside controls
      document.getElementById('flipbookTotalPages').textContent = totalPages;
      const pageInput = document.getElementById('flipbookPageInput');
      if (pageInput) {
        pageInput.max = totalPages;
        pageInput.value = 1;
      }
      
      // Wire flip events
      pageFlip.on('flip', (e) => {
        const currentPage = e.data + 1; // 0-indexed to 1-indexed
        const pageInput = document.getElementById('flipbookPageInput');
        if (pageInput) pageInput.value = currentPage;
        
        // Lazily render adjacent pages if using PDF
        if (currentPdfDocument) {
          const pagesToRender = [currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
          pagesToRender.forEach(p => {
            if (p >= 1 && p <= totalPages && !currentPdfPagesRendered[p]) {
              const div = document.getElementById(`pdf-page-${p}`);
              if (div) renderPDFPageOnDemand(currentPdfDocument, p, div);
            }
          });
        }
      });
    } else {
      console.warn("StPageFlip library is not available. Falling back to simple slideshow viewer...");
      setupFallbackSlideshow(totalPages);
    }
  } catch (err) {
    console.error("Error building StPageFlip, falling back to slideshow:", err);
    setupFallbackSlideshow(totalPages);
  }
}

// Controls
window.flipbookPrev = function() {
  if (activePageFlipInstance) activePageFlipInstance.flipPrev();
};

window.flipbookNext = function() {
  if (activePageFlipInstance) activePageFlipInstance.flipNext();
};

window.flipbookGoToPage = function(val) {
  const p = parseInt(val);
  if (activePageFlipInstance && p >= 1 && p <= parseInt(document.getElementById('flipbookTotalPages').textContent)) {
    activePageFlipInstance.turnToPage(p - 1);
  }
};

window.closeFlipbook = function() {
  const modal = document.getElementById('flipbookModal');
  if (modal) modal.classList.remove('active');
  destroyPageFlip();
};

window.toggleFlipbookFullscreen = function() {
  const elem = document.getElementById('flipbookModal');
  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch(err => {
      console.error(`Error entering fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
};

// Listen for keyboard navigation in flipbook
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('flipbookModal');
  if (modal && modal.classList.contains('active')) {
    if (e.key === 'ArrowLeft') {
      flipbookPrev();
    } else if (e.key === 'ArrowRight') {
      flipbookNext();
    } else if (e.key === 'Escape') {
      closeFlipbook();
    }
  }
});

function loadOfflineDemoFlipbook(subject, cls) {
  document.getElementById('flipbookSourceBadge').textContent = 'Offline Demo';
  document.getElementById('flipbookSourceBadge').style.background = 'rgba(239, 68, 68, 0.15)';
  document.getElementById('flipbookSourceBadge').style.color = '#ef4444';
  document.getElementById('flipbookSourceBadge').style.borderColor = 'rgba(239, 68, 68, 0.3)';
  
  document.getElementById('flipbookLoaderText').textContent = 'Loading offline study material...';
  document.getElementById('flipbookLoadProgress').style.width = '80%';
  
  const viewportContainer = document.getElementById('flipbookCanvas');
  viewportContainer.innerHTML = '';
  
  const pageContents = [
    // Page 1: Cover Page (Hard)
    {
      isHard: true,
      html: `
        <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between; align-items:center; background:linear-gradient(135deg, #1e293b, #0f172a); color:#f8fafc; border:4px solid #F5C76A; box-sizing:border-box; padding:32px; text-align:center;">
          <div style="font-family:'Space Grotesk', sans-serif; font-size:12px; font-weight:700; color:#F5C76A; letter-spacing:2px; text-transform:uppercase;">
            Bruhaspati AI Offline Library
          </div>
          <div style="margin: 20px 0;">
            <div style="width:70px; height:70px; border-radius:50%; border:2px solid #F5C76A; margin: 0 auto 16px; overflow:hidden;">
              <img src="logo.jpg" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <h1 style="font-family:'Sora', sans-serif; font-size:24px; color:#fff; font-weight:800; margin:0; line-height:1.3;">CHEMISTRY</h1>
            <div style="font-size:13px; color:#F5C76A; margin-top:8px; font-weight:600;">Unit 1: Some Basic Concepts</div>
          </div>
          <div>
            <div style="font-size:12px; color:#94a3b8; font-weight:600;">CLASS 11 TEXTBOOK</div>
            <div style="font-size:10px; color:#64748b; margin-top:4px;">Official Curriculum aligned with CBSE / State Boards</div>
          </div>
        </div>
      `
    },
    
    // Page 2: Table of Contents (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>Table of Contents</span>
            <span>Unit 1</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">Chapter Outline</h2>
            <p>Welcome to <em>Some Basic Concepts of Chemistry</em>. This chapter lays the foundation of chemical sciences.</p>
            
            <div class="demo-card">
              <strong style="color:#0f172a;">Key Subtopics covered:</strong>
              <ul style="margin-top:8px; padding-left:20px; font-size:12px; line-height:1.8;">
                <li>1.1 Importance of Chemistry</li>
                <li>1.2 Nature of Matter & States</li>
                <li>1.3 Properties of Matter & Measurement</li>
                <li>1.4 Uncertainty in Measurement (Significant Figures)</li>
                <li>1.5 Laws of Chemical Combination</li>
                <li>1.6 Dalton's Atomic Theory</li>
                <li>1.7 Mole Concept & Molar Masses</li>
              </ul>
            </div>
            
            <div class="demo-formula-box" style="margin-top: 20px; font-size: 11.5px; font-family:'Inter'; text-align:left; font-weight:normal;">
              📌 <strong>Exam weightage:</strong> This unit accounts for <strong>6% - 8%</strong> of total marks in annual board exams.
            </div>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 2</span>
          </div>
        </div>
      `
    },
    
    // Page 3: General Introduction (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>Chemistry Basics</span>
            <span>Section 1.1</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">1.1 Importance of Chemistry</h2>
            <p>Chemistry is often called the <strong>central science</strong> because it links together physics, biology, and environmental sciences. It deals with the composition, structure, properties, and interactions of matter.</p>
            
            <p>In our daily life, chemical processes play a vital role:</p>
            <ul style="padding-left:18px; margin:8px 0; font-size:12.5px;">
              <li><strong>Agriculture:</strong> Synthesis of fertilizers like Urea and Ammonium Sulphate to enhance crop yields.</li>
              <li><strong>Healthcare:</strong> Life-saving drugs such as <em>Cisplatin</em> and <em>Taxol</em> (used in cancer therapy) and <em>AZT</em> (Azidothymidine) for AIDS treatment.</li>
              <li><strong>Industry:</strong> Development of polymers, dyes, soaps, metal alloys, and advanced materials.</li>
            </ul>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 3</span>
          </div>
        </div>
      `
    },
    
    // Page 4: Nature of Matter (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>Matter Classification</span>
            <span>Section 1.2</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">1.2 Classification of Matter</h2>
            <p>Matter is anything that possesses mass and occupies space. It can be classified based on physical and chemical states:</p>
            
            <table class="demo-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Properties</th>
                  <th>Examples</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Solid</strong></td>
                  <td>Definite volume & shape. Particles tightly packed.</td>
                  <td>Iron, Wood, Ice</td>
                </tr>
                <tr>
                  <td><strong>Liquid</strong></td>
                  <td>Definite volume, no definite shape. Flows easily.</td>
                  <td>Water, Mercury</td>
                </tr>
                <tr>
                  <td><strong>Gas</strong></td>
                  <td>No definite shape or volume. Highly compressible.</td>
                  <td>Oxygen, Nitrogen</td>
                </tr>
              </tbody>
            </table>
            
            <p style="margin-top:12px;">Chemically, matter is classified into <strong>Pure Substances</strong> (Elements, Compounds) and <strong>Mixtures</strong> (Homogeneous, Heterogeneous).</p>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 4</span>
          </div>
        </div>
      `
    },
    
    // Page 5: Significant Figures (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>Significant Figures</span>
            <span>Section 1.4</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">1.4 Significant Figures Rules</h2>
            <p>Significant figures are the meaningful digits in a measured value that are known with certainty plus one final digit that is estimated.</p>
            
            <div class="demo-card">
              <strong style="color:#0f172a; font-size:12px;">Golden Rules for Counting:</strong>
              <ol style="margin-top:6px; padding-left:16px; font-size:11.5px; line-height:1.7;">
                <li>All non-zero digits are significant (e.g. 285 cm has 3).</li>
                <li>Zeros preceding the first non-zero digit are NOT significant (e.g. 0.03 has 1).</li>
                <li>Zeros between non-zero digits are significant (e.g. 2.005 has 4).</li>
                <li>Zeros at the end/terminal of a number are significant ONLY if they are on the right side of a decimal point (e.g. 0.200 has 3, but 100 has 1).</li>
              </ol>
            </div>
            
            <div class="demo-formula-box" style="font-size:12px;">
              0.0025 g ➔ 2 Sig Figs<br>
              400.0 mL ➔ 4 Sig Figs
            </div>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 5</span>
          </div>
        </div>
      `
    },
    
    // Page 6: Laws of Chemical Combination (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>Chemical Laws</span>
            <span>Section 1.5</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">1.5 Laws of Chemical Combination</h2>
            
            <p><strong>1. Law of Conservation of Mass (Antoine Lavoisier, 1789)</strong><br>
            Matter can neither be created nor destroyed in a chemical reaction. Total mass of reactants equals total mass of products.</p>
            
            <p><strong>2. Law of Definite Proportions (Joseph Proust, 1799)</strong><br>
            A given compound always contains exactly the same proportion of elements by weight. For example, pure water (H<sub>2</sub>O) from any source always contains 8:1 oxygen to hydrogen by weight.</p>
            
            <p><strong>3. Law of Multiple Proportions (John Dalton, 1803)</strong><br>
            If two elements combine to form more than one compound, the masses of one element that combine with a fixed mass of the other are in a ratio of small whole numbers.</p>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 6</span>
          </div>
        </div>
      `
    },
    
    // Page 7: Mole Concept (Soft)
    {
      isHard: false,
      html: `
        <div class="demo-page-content">
          <div class="demo-page-header">
            <span>The Mole Concept</span>
            <span>Section 1.7</span>
          </div>
          <div class="demo-page-body">
            <h2 class="demo-page-title">1.7 Mole Concept & Avogadro</h2>
            <p>One mole is the amount of substance that contains as many entities (atoms, molecules, ions) as there are atoms in exactly 12 grams (or 0.012 kg) of the carbon-12 isotope.</p>
            
            <div class="demo-formula-box">
              1 Mole = 6.022 × 10<sup>23</sup> entities
            </div>
            
            <p>This number is called the <strong>Avogadro Constant (N<sub>A</sub>)</strong>.</p>
            
            <div class="demo-card">
              <strong style="color:#0f172a; font-size:12px;">Key Calculation Formula:</strong>
              <div style="font-family:monospace; margin-top:6px; font-size:12px;">
                Number of Moles (n) = Mass of substance (g) / Molar Mass (g/mol)
              </div>
            </div>
          </div>
          <div class="demo-page-footer">
            <span>Bruhaspati AI 3D Reader</span>
            <span>Page 7</span>
          </div>
        </div>
      `
    },
    
    // Page 8: Back Cover (Hard)
    {
      isHard: true,
      html: `
        <div style="height:100%; display:flex; flex-direction:column; justify-content:space-between; align-items:center; background:linear-gradient(135deg, #1e293b, #0f172a); color:#f8fafc; border:4px solid #F5C76A; box-sizing:border-box; padding:32px; text-align:center;">
          <div style="font-family:'Space Grotesk', sans-serif; font-size:11px; color:#F5C76A; letter-spacing:1px; text-transform:uppercase;">
            Thank you for reading
          </div>
          <div style="margin:20px 0;">
            <div style="width:50px; height:50px; border-radius:50%; border:1px solid #F5C76A; margin:0 auto 12px; overflow:hidden;">
              <img src="logo.jpg" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <h2 style="font-family:'Sora', sans-serif; font-size:18px; color:#fff; font-weight:700; margin:0;">Bruhaspati AI</h2>
            <span style="font-size:11px; color:#94a3b8;">Your Personal Elite Tutor</span>
          </div>
          <div style="font-size:10px; color:#64748b;">
            © 2026 Bruhaspati AI. All Rights Reserved.
          </div>
        </div>
      `
    }
  ];
  
  const totalPages = pageContents.length;
  
  pageContents.forEach((c, idx) => {
    const pageNum = idx + 1;
    const pageDiv = document.createElement('div');
    pageDiv.className = 'flip-page';
    pageDiv.id = `demo-page-${pageNum}`;
    if (c.isHard) {
      pageDiv.setAttribute('data-density', 'hard');
    }
    pageDiv.innerHTML = c.html;
    viewportContainer.appendChild(pageDiv);
  });
  
  document.getElementById('flipbookLoadProgress').style.width = '90%';
  document.getElementById('flipbookLoaderText').textContent = 'Opening Book...';
  
  setTimeout(() => {
    buildStPageFlip(totalPages);
  }, 300);
}

window.openNCERTBook = function(subject, cls, url) {
  const modal = document.getElementById('ncertModal');
  const bookNameSpan = document.getElementById('ncertModalBookName');
  const appBtn = document.getElementById('ncertModalAppBtn');
  const dikshaBtn = document.getElementById('ncertModalDikshaBtn');
  const officialBtn = document.getElementById('ncertModalOfficialBtn');
  
  if (bookNameSpan) bookNameSpan.textContent = `Class ${cls.replace('Class ', '')} - ${subject}`;
  if (officialBtn) officialBtn.href = url;
  if (dikshaBtn) {
    const cleanSubject = subject.replace(/ I+$/, ''); // convert Physics I to Physics
    const cleanClass = cls.replace('Class ', ''); // convert Class 11 to 11
    dikshaBtn.href = `https://diksha.gov.in/explore?key=Class+${encodeURIComponent(cleanClass)}+${encodeURIComponent(cleanSubject)}`;
  }
  
  if (appBtn) {
    appBtn.onclick = function() {
      if (modal) modal.classList.remove('active');
      launchFlipbook(subject, cls, url);
    };
  }
  
  if (modal) modal.classList.add('active');
};

window.closeNCERTModal = function() {
  const modal = document.getElementById('ncertModal');
  if (modal) modal.classList.remove('active');
};

function renderNCERTBooks() {
  const container = document.getElementById('ncertBooksList');
  const searchVal = document.getElementById('ncertSearchInput').value.toLowerCase();
  if (!container) return;
  
  const books = NCERT_BOOKS[activeNCERTTab] || {};
  let html = '';
  
  for (const [subject, url] of Object.entries(books)) {
    if (searchVal && !subject.toLowerCase().includes(searchVal)) continue;
    
    html += `
      <div class="ncert-book-card">
        <div class="ncert-book-title">
          <span>📚 ${subject}</span>
          <span class="ncert-badge">NCERT Official</span>
        </div>
        <div class="ncert-book-actions">
          <button class="ncert-action-btn" onclick="openNCERTBook('${subject.replace(/'/g, "\\'")}', '${activeNCERTTab.replace(/'/g, "\\'")}', '${url.replace(/'/g, "\\'")}')">📖 Read Online</button>
          <button class="ncert-action-btn primary" onclick="askNCERTAI('${subject.replace(/'/g, "\\'")}', '${activeNCERTTab.replace(/'/g, "\\'")}')">🤖 Ask AI</button>
        </div>
      </div>
    `;
  }
  
  if (!html) {
    html = `<div style="text-align:center; padding:12px; font-size:11.5px; color:var(--text-muted);">No matching books.</div>`;
  }
  container.innerHTML = html;
}


// ==========================================
// CURSOR & 3-PHASE ANIMATION HELPERS (BUG 2)
// ==========================================
function applyStreamingCursor(data, isFinal) {
  if (isFinal) return data;
  let cloned = JSON.parse(JSON.stringify(data));
  
  if (cloned.essay) {
    cloned.essay += '<span class="cursor"></span>';
  } else if (cloned.points && cloned.points.length > 0) {
    cloned.points[cloned.points.length - 1] += '<span class="cursor"></span>';
  } else if (cloned.modelAnswer) {
    cloned.modelAnswer += '<span class="cursor"></span>';
  } else if (cloned.step_by_step_steps && cloned.step_by_step_steps.length > 0) {
    cloned.step_by_step_steps[cloned.step_by_step_steps.length - 1].text += '<span class="cursor"></span>';
  } else if (cloned.researchText) {
    cloned.researchText += '<span class="cursor"></span>';
  } else if (cloned.explanation) {
    cloned.explanation += '<span class="cursor"></span>';
  } else {
    const fields = ['teacherTip', 'quizAnswer', 'quiz', 'keywordsNote', 'analogy', 'diagram', 'formula', 'definition'];
    for (let f of fields) {
      if (cloned[f]) {
        cloned[f] += '<span class="cursor"></span>';
        break;
      }
    }
    if (!cloned.teacherTip && !cloned.quiz && !cloned.analogy && !cloned.diagram && !cloned.formula && cloned.mechanism && cloned.mechanism.length > 0) {
      cloned.mechanism[cloned.mechanism.length - 1].text += '<span class="cursor"></span>';
    }
  }
  return cloned;
}

function showSkeletonLoader(cardId, container) {
  container.innerHTML = `
    <div class="response-card skeleton-card b-skel" id="${cardId}_loader" style="display:flex; flex-direction:column; gap:12px; padding:20px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="b-skel" style="width:36px; height:36px; border-radius:50%;"></div>
        <div class="b-skel" style="height:12px; border-radius:6px; flex:1;"></div>
      </div>
      <div class="b-skel" style="height:10px; border-radius:5px; width:100%;"></div>
      <div class="b-skel" style="height:10px; border-radius:5px; width:80%;"></div>
      <div class="b-skel" style="height:10px; border-radius:5px; width:100%;"></div>
      <div class="b-skel" style="height:10px; border-radius:5px; width:60%;"></div>
    </div>
  `;
}

function showThinkingLoader(cardId, container, subject) {
  if (activeLoaderIntervals[cardId]) clearInterval(activeLoaderIntervals[cardId]);
  
  container.innerHTML = `
    <div class="chat-loader-wrap" id="${cardId}_loader">
      <div class="chat-avatar b-avatar-glow">
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" fill="#0f2a5a" stroke="#c8972a" stroke-width="1"/>
          <text x="10" y="14" text-anchor="middle" font-family="Sora,sans-serif" font-size="9" font-weight="700" fill="#c8972a">A</text>
        </svg>
      </div>
      <div class="b-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

function showInteractiveLoader(cardId, container) {
  if (activeLoaderIntervals[cardId]) clearInterval(activeLoaderIntervals[cardId]);
  
  container.innerHTML = `
    <div class="interactive-loader-card" id="${cardId}_loader">
      <div class="interactive-loader-content">
        <div class="interactive-loader-text">
          <strong>Generating interactive visual...</strong>
          <span>Structuring code, this may take a minute</span>
        </div>
        <div class="interactive-spinner"></div>
      </div>
    </div>
  `;
}

async function retryQuizGeneration(query, cardId, requestedCount) {
  if (state.hasRetriedQuiz) {
    console.error("Quiz count retry failed.");
    state.hasRetriedQuiz = false;
    return;
  }
  state.hasRetriedQuiz = true;
  const statusEl = document.getElementById(`${cardId}_thinkingLabel`);
  if (statusEl) {
    statusEl.textContent = `Regenerating exactly ${requestedCount} questions...`;
  }
  const stricterQuery = `${query}\n\nCRITICAL: In your last response, you did not generate exactly ${requestedCount} questions. You MUST output a JSON array containing EXACTLY ${requestedCount} questions. No more, no fewer. Count them. Check the array size before outputting.`;
  await streamAIResponse(stricterQuery, cardId);
}

// ---- FIREBASE AUTHENTICATION FLOW ----
const firebaseConfig = {
  // Mock config to enable Firebase SDK to boot
  apiKey: "AIzaSyMockKeyForLocalTesting12345",
  authDomain: "bruhaspati-ai-mock.firebaseapp.com",
  projectId: "bruhaspati-ai-mock",
};

try {
  if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.log("Firebase not loaded or failed", e);
}

function handleMockLogin() {
  const emailEl = document.getElementById('mockEmail');
  const email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    alert("Please enter an email");
    return;
  }
  const overlay = document.getElementById('authModalOverlay');
  if (overlay) overlay.style.display = 'none';
  showToast("Logged in as " + email);
  // Store mock auth state
  localStorage.setItem('bruhaspati_auth', email);
}

function initAuth() {
  const authModal = document.getElementById('authModalOverlay');
  const mockAuth = document.getElementById('mockAuthContainer');
  const fbAuth = document.getElementById('firebaseui-auth-container');
  
  if (!authModal) return;

  const savedAuth = localStorage.getItem('bruhaspati_auth');
  if (savedAuth) {
    authModal.style.display = 'none';
    return;
  }

  authModal.style.display = 'flex';
  
  const isMockConfig = !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('MockKey') || firebaseConfig.apiKey === '';
  
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length > 0 && typeof firebaseui !== 'undefined' && !isMockConfig) {
    // Hide mock, show real Firebase UI
    if (mockAuth) mockAuth.style.display = 'none';
    if (fbAuth) fbAuth.style.display = 'block';
    
    try {
      const uiConfig = {
        signInSuccessUrl: '/',
        signInOptions: [
          firebase.auth.GoogleAuthProvider.PROVIDER_ID,
          firebase.auth.EmailAuthProvider.PROVIDER_ID
        ],
        tosUrl: '#',
        privacyPolicyUrl: '#'
      };
      
      const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
      ui.start('#firebaseui-auth-container', uiConfig);
      
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          authModal.style.display = 'none';
          localStorage.setItem('bruhaspati_auth', user.email);
          showToast("Welcome back, " + (user.displayName || user.email));
        } else {
          authModal.style.display = 'flex';
        }
      });
    } catch (err) {
      console.error("FirebaseUI initialization failed, falling back to mock:", err);
      if (fbAuth) fbAuth.style.display = 'none';
      if (mockAuth) mockAuth.style.display = 'block';
    }
  } else {
    // Fallback to Mock
    if (fbAuth) fbAuth.style.display = 'none';
    if (mockAuth) mockAuth.style.display = 'block';
  }
}

// Bind to window for global inline onclick/onkeydown event resolution
window.handleMockLogin = handleMockLogin;
window.initAuth = initAuth;
window.handleKeyDown = function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    window.sendMessage();
  }
};

// Call initAuth when app loads
document.addEventListener('DOMContentLoaded', () => {
  window.initAuth();
});
