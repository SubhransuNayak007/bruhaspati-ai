# Bruhaspati AI — Master Bug Fix \u0026 Feature Upgrade Prompt v2

Paste this entire prompt into your AI coding assistant (Cursor, Claude Code, etc.) to fix all 7 issues at once.

---

## CONTEXT

You are working on **Bruhaspati AI** — a Next.js/React AI tutor for Indian students (CBSE, CHSE Odisha, BSE Odisha, JEE, NEET, IISER IAT). The app uses the Google Gemini API (or equivalent LLM). Fix ALL of the following bugs and add ALL features described below. Do not skip any item.

---

## BUG FIX 1 — API QUOTA / PLAN ENFORCEMENT (CRITICAL)

**Problem:** When the API quota is exceeded OR when a free/pro user hits their daily token limit, the app is returning a raw template/fallback string as the AI answer instead of showing a proper error state.

**Root cause to find and fix:**
- Locate every `catch` block and every place where `response.text` or `response.candidates` is read from the Gemini API response.
- Check if the response has `response.promptFeedback?.blockReason` or `candidates[0]?.finishReason === 'MAX_TOKENS'` or HTTP 429 / 503 status codes.
- If any of these conditions are true, the code must NOT display the template string. Instead it must throw a typed error.

**Fix to implement:**

```javascript
// In your API call wrapper (e.g. lib/gemini.ts or api/chat.ts):

async function callGeminiAPI(prompt, userPlan) {
  // 1. Pre-flight token check
  const tokenStore = getTokenStore(); // localStorage or DB
  const cost = estimateTokenCost(prompt);
  const limits = { free: 2000, pro: 20000, ultra: Infinity };
  
  if (tokenStore.used + cost \u003e limits[userPlan]) {
    throw { type: 'QUOTA_EXCEEDED', plan: userPlan };
  }

  try {
    const res = await fetch('/api/generate', { method: 'POST', body: JSON.stringify({ prompt }) });
    
    // HTTP-level errors
    if (res.status === 429) throw { type: 'RATE_LIMITED' };
    if (res.status === 503) throw { type: 'SERVICE_DOWN' };
    if (!res.ok)            throw { type: 'API_ERROR', status: res.status };

    const data = await res.json();

    // Gemini-specific safety/quota blocks
    if (data.promptFeedback?.blockReason) throw { type: 'CONTENT_BLOCKED' };
    if (!data.candidates?.length)          throw { type: 'NO_RESPONSE' };
    if (data.candidates[0]?.finishReason === 'RECITATION') throw { type: 'NO_RESPONSE' };

    // Deduct tokens only on success
    updateTokenStore(cost);
    return data.candidates[0].content.parts[0].text;

  } catch (err) {
    if (err.type) throw err; // re-throw our typed errors
    throw { type: 'NETWORK_ERROR' };
  }
}
```

**In the UI component, handle errors:**

```jsx
// Replace the template fallback with a proper error card:
{error?.type === 'QUOTA_EXCEEDED' \u0026\u0026 (
  \u003cQuotaExceededCard plan={userPlan} onUpgrade={() =\u003e setShowUpgradeModal(true)} /\u003e
)}
{error?.type === 'RATE_LIMITED' \u0026\u0026 (
  \u003cErrorCard message="Too many requests. Please wait 30 seconds." retryable /\u003e
)}
{error?.type === 'API_ERROR' \u0026\u0026 (
  \u003cErrorCard message="Something went wrong. Tap to retry." retryable onRetry={retry} /\u003e
)}
```

**QuotaExceededCard** should show:
- Remaining tokens: 0 / {limit}
- Current plan badge
- Table comparing Free / Pro (₹199) / Ultra (₹399) with token limits
- "Upgrade Now" CTA button → opens Razorpay modal or WhatsApp contact

---

## BUG FIX 2 — PREMIUM LOADING ANIMATION (Siri/ChatGPT Level)

**Problem:** Current loading state is basic. Replace with a multi-phase premium animation.

**Implement these 3 phases in sequence:**

### Phase 1 — "Receiving" (0ms to 600ms): Skeleton card
```jsx
// Show instantly when API call starts:
\u003cSkeletonCard\u003e
  \u003cdiv className="skel-avatar animate-shimmer" /\u003e
  \u003cdiv className="skel-line w-full animate-shimmer" /\u003e
  \u003cdiv className="skel-line w-4/5 animate-shimmer" /\u003e
  \u003cdiv className="skel-line w-3/5 animate-shimmer" /\u003e
\u003c/SkeletonCard\u003e
```

### Phase 2 — "Thinking" (600ms+, while waiting for first token): Lotus pulse
```jsx
\u003cdiv className="thinking-indicator"\u003e
  \u003cLotusIcon className="animate-[lotus-breathe_2s_ease-in-out_infinite]" /\u003e
  \u003cThinkingDots /\u003e {/* gold wave dots */}
  \u003cspan className="thinking-label"\u003e
    { label } {/* cycle: "Thinking…" → "Analyzing…" → "Preparing answer…" */}
  \u003c/span\u003e
\u003c/div\u003e
```
Cycle the label every 2s: `["Thinking…", "Analyzing curriculum…", "Preparing your answer…", "Almost ready…"]`

### Phase 3 — Streaming text with cursor:
```jsx
// As tokens stream in, show text with a blinking gold cursor at the end:
\u003cp\u003e{streamedText}\u003cspan className="cursor animate-blink" /\u003e\u003c/p\u003e
```

### CSS to add:
```css
@keyframes lotus-breathe {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(200,151,42,0.4)); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(200,151,42,0.8)) drop-shadow(0 0 40px rgba(56,189,248,0.3)); }
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.cursor { display:inline-block; width:2px; height:1em; background:#c8972a; margin-left:2px; vertical-align:text-bottom; animation: blink 1s step-end infinite; }
```

---

## BUG FIX 3 — LONG ANSWER FORMAT (Same template coming — fix root cause)

**Problem:** Selecting "Long Answer" mode still returns the structured template (Definition / Mechanism / Formula sections). The format selector is not actually changing the system prompt.

**Fix:** Find where the system prompt is constructed and add a format switch:

```javascript
// In your prompt builder (e.g. lib/prompts.ts):

function buildSystemPrompt(board, classLevel, subject, format) {
  const baseContext = `You are Bruhaspati AI, an expert tutor for Indian students.
Board: ${board} | Class: ${classLevel} | Subject: ${subject}.`;

  const formats = {
    structured: `
Respond in this exact structure:
**DEFINITION** | **MECHANISM / HOW IT WORKS** | **FORMULA / REACTION** | **DIAGRAM \u0026 MENTAL MODEL** | **REAL-WORLD EXAMPLES** | **EXAM RELEVANCE \u0026 PYQ HISTORY** | **BOARD-APPROVED KEYWORDS** | **COMMON MISTAKES** | **QUICK QUIZ**
Use bold section headers. Include PYQ table with columns: EXAM | YEARS | MARKS | TYPE | FREQUENCY.`,

    long_answer: `
Write a CONTINUOUS ESSAY-STYLE answer of 500–700 words, exactly as a top student would write in a ${board} board exam.
- NO section headers, NO bullet points, NO bold labels.
- Pure flowing paragraphs only.
- Start directly with the concept definition.
- Weave in: explanation, derivation/formula context, real-world significance, and examiner-expected keywords naturally.
- End with one concluding sentence that ties everything together.
- Write as if answering a 6-mark or 8-mark board exam question.
- DO NOT use the structured template format under any circumstances.`,

    quick_summary: `
Give ONLY 5 bullet points, max 15 words each. No intro, no outro.
Format: • [point]
Focus on the 5 most exam-important facts.`,

    exam_focused: `
Focus ONLY on exam preparation. Include:
1. Most likely exam question phrasings for ${board}
2. Model answer (100-150 words, board-style)
3. Keywords the examiner expects (bold them)
4. Common mistakes that lose marks
5. PYQ occurrences with year and marks
Skip all general theory explanation.`,

    step_by_step: `
Teach this concept as a step-by-step learning journey.
Step 1: What it is (simplest possible explanation, 2 sentences)
Step 2: Why it exists / intuition (analogy or story)
Step 3: The mechanics (how it actually works)
Step 4: The math/formula (derive it, don't just state it)
Step 5: A solved example
Step 6: Practice question for the student
Number each step clearly.`,

    deep_research: `
Give a comprehensive, university-level deep dive on this topic.
Include: historical context, multiple theoretical frameworks, advanced applications, research significance, connections to other topics in the curriculum, and references to NCERT chapters where applicable.
Minimum 800 words. Use sub-headings.`,

    graph_visual: `
Describe this concept in a way that is HIGHLY VISUAL.
Include:
- ASCII diagram or described graph/chart
- Step-by-step description of what any graph would look like
- Coordinates, axes labels, curve shapes where applicable
- Table of values if relevant
- Color-coded mental model description
Then follow with a concise explanation.`
  };

  return `${baseContext}\
\
${formats[format] || formats.structured}`;
}
```

**CRITICAL:** Make sure the `format` variable is actually passed from the UI state into `buildSystemPrompt`. Search for every place `buildSystemPrompt` or the equivalent system prompt string is called and confirm the format selector value is wired in.

---

## BUG FIX 4A — CHAPTER AUTOCOMPLETE (Show exact chapters for selected class + subject)

**Problem:** The chapter autocomplete popup shows generic suggestions, not the actual NCERT chapters for the selected class and subject combination.

**Fix:** Add this hardcoded chapter database and use it to filter autocomplete:

```javascript
// lib/chapters.ts

export const CHAPTER_DB = {
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

// Autocomplete function:
export function getChapterSuggestions(subject, classLevel, query) {
  const key = `${subject}-${classLevel}`; // e.g. "Physics-12"
  const chapters = CHAPTER_DB[key] || [];
  if (!query || query.length \u003c 2) return chapters.slice(0, 8);
  return chapters.filter(c =\u003e
    c.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);
}
```

**Wire into the autocomplete input:**
```jsx
const [suggestions, setSuggestions] = useState([]);

const handleChapterInput = (val) =\u003e {
  setChapterName(val);
  const results = getChapterSuggestions(selectedSubject, selectedClass, val);
  setSuggestions(results);
};
```

---

## BUG FIX 4B — QUIZ COUNT (User selects 20 but only 4 generate)

**Problem:** The quiz generation prompt ignores the `quizCount` variable. The system prompt always generates 4 questions.

**Fix — in your quiz system prompt:**

```javascript
function buildQuizPrompt(subject, classLevel, chapter, board, count, types, difficulty) {
  return `You are Bruhaspati AI quiz generator.

Generate EXACTLY ${count} questions. Not fewer. Not more. EXACTLY ${count}.

Subject: ${subject} | Class: ${classLevel} | Chapter: ${chapter} | Board: ${board}
Difficulty: ${difficulty}
Question types to include: ${types.join(', ')}

Return ONLY a valid JSON array with exactly ${count} objects. No preamble, no explanation, no markdown.

Each object must have:
{
  "id": number,
  "type": "mcq" | "truefalse" | "fillinblank" | "shortanswer",
  "question": "string",
  "options": ["A)...", "B)...", "C)...", "D)..."],  // only for mcq
  "answer": "string",
  "explanation": "string",
  "marks": number,
  "difficulty": "easy"|"medium"|"hard",
  "pyq_year": "string or null"
}

IMPORTANT: The array must have EXACTLY ${count} elements. Count them before responding.`;
}
```

**Also fix the UI parsing:**
```javascript
// After API response, validate count:
const parsed = JSON.parse(responseText);
if (!Array.isArray(parsed) || parsed.length !== requestedCount) {
  // Retry once with stricter prompt
  console.warn(`Got ${parsed?.length} questions, expected ${requestedCount}. Retrying...`);
  return retryQuizGeneration(subject, classLevel, chapter, board, requestedCount, types, difficulty);
}
```

---

## BUG FIX 5 — FORMULA SHEET (Board-specific, not generic)

**Problem:** Formula sheet shows the same basic formulas regardless of board/exam. JEE needs derivations, NEET needs different emphasis, boards need different formats.

**Fix — formula sheet prompt:**

```javascript
function buildFormulaSheetPrompt(subject, classLevel, chapter, board) {
  const examProfiles = {
    "CBSE": "Include standard NCERT formulas. Mark derivable formulas with ★. Note CBSE-specific formula expressions.",
    "CHSE Odisha": "Include CHSE Odisha board-specific formula list. Cross-reference with Odisha BSE PYQ patterns.",
    "BSE Odisha": "Focus on BSE board exam level. Include state board-specific formula notation.",
    "JEE Main": "Include ALL formulas including those not in NCERT. Add JEE-specific tricks, shortcuts, and formula combinations. Mark high-weightage formulas 🔥. Include formula memory tricks.",
    "JEE Advanced": "Include advanced-level formulas, multi-concept integrations, and derivation steps. Add level: Advanced tag.",
    "NEET": "Focus on biology-chemistry-physics formulas relevant to NEET. Include unit conversions, constant values (like Avogadro, Boltzmann). Mark NEET frequency: HIGH/MEDIUM/LOW.",
    "IISER IAT": "Include research-level formula extensions beyond NCERT. Cover advanced physical chemistry and mathematical physics formulas."
  };

  return `Generate a COMPREHENSIVE formula sheet for:
Subject: ${subject} | Class ${classLevel} | Chapter: ${chapter}
Target Exam: ${board}
Exam Profile: ${examProfiles[board] || examProfiles["CBSE"]}

Format as JSON:
{
  "chapter": "${chapter}",
  "exam": "${board}",
  "sections": [
    {
      "section_name": "string",
      "formulas": [
        {
          "name": "string",
          "formula": "string (LaTeX or plain text)",
          "variables": "what each variable means",
          "units": "SI units",
          "conditions": "when this formula applies",
          "exam_tags": ["${board}", "JEE Main", etc],
          "importance": "HIGH" | "MEDIUM" | "LOW",
          "memory_trick": "optional mnemonic",
          "common_mistake": "optional pitfall",
          "derivable": true/false
        }
      ]
    }
  ],
  "constants_needed": ["list of physical constants with values"],
  "quick_revision_list": ["top 10 formulas as plain text strings"]
}

Include EVERY formula from the chapter. Do not limit to basic ones.
For ${board}: ${examProfiles[board] || ""}`;
}
```

---

## FEATURE 6 — CLAUDE/CHATGPT STYLE MODE SELECTOR

**Add a mode selector row above the chat input** (like ChatGPT's attachment menu or Claude's style selector):

```jsx
// ModeSelector component — rendered as a scrollable pill row:
const MODES = [
  { id: 'structured',   icon: '📋', label: 'Structured',    desc: 'Classic exam format' },
  { id: 'long_answer',  icon: '📝', label: 'Long Answer',   desc: 'Essay / board style' },
  { id: 'step_by_step', icon: '🪜', label: 'Step by Step',  desc: 'Learn from scratch' },
  { id: 'quick_summary',icon: '⚡', label: 'Quick Summary', desc: '5 key points only' },
  { id: 'exam_focused', icon: '🎯', label: 'Exam Focus',    desc: 'PYQ + keywords only' },
  { id: 'deep_research',icon: '🔬', label: 'Deep Research', desc: 'University level' },
  { id: 'graph_visual', icon: '📊', label: 'Graph / Visual',desc: 'Charts \u0026 diagrams' },
  { id: 'interactive',  icon: '🎮', label: 'Interactive',   desc: 'Guided learning' },
];

// Render as horizontal scroll chips:
\u003cdiv className="mode-bar"\u003e
  {MODES.map(m =\u003e (
    \u003cbutton
      key={m.id}
      className={`mode-chip ${activeMode === m.id ? 'mode-chip--active' : ''}`}
      onClick={() =\u003e setActiveMode(m.id)}
      title={m.desc}
    \u003e
      \u003cspan className="mode-icon"\u003e{m.icon}\u003c/span\u003e
      \u003cspan className="mode-label"\u003e{m.label}\u003c/span\u003e
    \u003c/button\u003e
  ))}
\u003c/div\u003e
```

**CSS for mode bar:**
```css
.mode-bar {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 10px 16px; scrollbar-width: none;
  border-top: 1px solid rgba(200,151,42,0.1);
}
.mode-chip {
  display: flex; align-items: center; gap: 6px;
  white-space: nowrap; padding: 7px 14px;
  border-radius: 20px; font-size: 13px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(200,151,42,0.15);
  color: #94a3b8; cursor: pointer;
  transition: all 0.2s ease;
}
.mode-chip:hover { border-color: rgba(200,151,42,0.4); color: #e2e8f0; }
.mode-chip--active {
  background: linear-gradient(135deg, rgba(200,151,42,0.2), rgba(26,95,212,0.15));
  border-color: #c8972a; color: #c8972a; font-weight: 600;
}
```

**IMPORTANT:** Make sure `activeMode` is passed into `buildSystemPrompt(board, class, subject, activeMode)`.

---

## FEATURE 7 — NCERT LIBRARY (All Class 11 \u0026 12 Books)

**Add a "📚 NCERT Library" section in the sidebar** (below Quick Actions):

```jsx
// NCERTLibrary component:
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
```

**UI behavior:**
- Show as collapsible accordion in sidebar: "📚 NCERT Library ▼"
- On expand, show two tabs: "Class 11" | "Class 12"
- Each book shows as a card with subject icon, name, and two buttons:
  - **"📖 Read Online"** → opens NCERT PDF in new tab
  - **"🤖 Ask AI"** → sets context to that subject+class and focuses the chat input
- Add a search box inside the library panel to filter by subject name
- Show a small "NCERT Official" badge on each card

**Sidebar entry:**
```jsx
\u003cSidebarSection icon="📚" title="NCERT Library" collapsible\u003e
  \u003cNCERTLibraryPanel books={NCERT_BOOKS} onAskAI={(subject, cls) =\u003e {
    setSelectedSubject(subject);
    setSelectedClass(cls);
    inputRef.current?.focus();
  }} /\u003e
\u003c/SidebarSection\u003e
```

---

## IMPLEMENTATION CHECKLIST

Go through each item and confirm it is fixed before moving on:

- [ ] BUG 1: API quota errors no longer show template fallback — show proper error card
- [ ] BUG 1: Token deduction only happens on successful API response
- [ ] BUG 1: Plan limits enforced: Free 2k / Pro 20k / Ultra unlimited
- [ ] BUG 2: Three-phase loading: skeleton → lotus pulse → streaming cursor
- [ ] BUG 2: Thinking label cycles through 4 messages
- [ ] BUG 3: "Long Answer" mode sends completely different system prompt — no headers, pure prose
- [ ] BUG 3: All 7 format modes produce visibly different response structures
- [ ] BUG 4A: Chapter autocomplete uses CHAPTER_DB keyed by `${subject}-${classLevel}`
- [ ] BUG 4A: Typing 2+ chars filters exact NCERT chapter names
- [ ] BUG 4B: Quiz prompt says "EXACTLY ${count}" twice and validates array length on parse
- [ ] BUG 4B: Retry logic if parsed count doesn't match requested count
- [ ] BUG 5: Formula sheet prompt includes board-specific exam profile instruction
- [ ] BUG 5: Formula sheet JSON includes importance ratings and exam_tags per formula
- [ ] FEAT 6: Mode selector pill row renders above input with 8 modes
- [ ] FEAT 6: Active mode visually highlighted with gold border
- [ ] FEAT 6: Mode value passed to system prompt builder on every API call
- [ ] FEAT 7: NCERT Library in sidebar with all Class 11 + 12 books
- [ ] FEAT 7: "Read Online" opens official NCERT PDF link
- [ ] FEAT 7: "Ask AI" sets context and focuses input

---

*Bruhaspati AI Bug Fix Prompt v2 — June 2026*
6:["$","$L18",null,{"artifact":{"title":"bruhaspati_bugfix_prompt_v2.md","language":"$undefined","type":"text/markdown","content":"$19","description":"Master prompt for fixing 7 critical bugs and adding premium features to Bruhaspati AI tutoring app. Includes API quota enforcement, loading animations, format modes, NCERT library, and quiz generation fixes."},"remixBaseUrl":"https://claude.ai","artifactId":"96d9c381-39c9-48de-8c93-44827ab5f57d","activitySessionId":"5e46ce64-d14b-4ee4-93f6-1d29f5a2ed21","shouldTakeSnapshot":{"mobile":true,"desktop":true}}]
1a:I[917624305,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"ServerUserAgentProvider"]
1b:I[1797748516,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"ServerDesktopTopBarProvider"]
1c:I[8915630566,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"LegalDocsProvider"]
1d:I[7419379843,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"ClientBootstrapProvider"]
17:["$","$L1a",null,{"userAgent":"google-jetski-antigravity","children":["$","$L1b",null,{"wantsDesktopTopBar":false,"children":["$","$L1c",null,{"value":{"commercial-terms":"af81645b-040b-485c-a4a0-3205ccfb3792","service-specific-terms":"a914c3ed-01b5-4fd3-b943-e13cb408c3b2","independent-contractor-agreement":"b79d13ce-acc1-4714-93fc-6bd037e65406","data-processing-addendum":"0e12c29d-6cbb-4bbe-a71d-52c38a2f9102","inbound-services-agreement":"78cbea28-4333-4042-a6ce-ea391e890a8a","non-user-privacy-policy":"a2eb2e3e-fd03-4dbf-8db5-2cc0e9fb31f9","consumer-health-data-privacy-policy":"a8060e10-8dcd-45ba-9ace-d6a42e8529a0","acst-disclosure":null,"cookies":"5c7ecf37-e2e1-4788-b718-a0d914fead48","aup":"22742366-2ef0-4c7a-a833-6523f10d3944","consumer-terms":"79dbc8c6-7f64-43d6-8101-207cede59a4d","referral-partner-program-terms":"b81d2822-0089-4e37-9c91-15eb23ccb612","credit-terms":"8a492ef8-a09b-4de4-b364-2e155b674b27","privacy":"d254257b-3920-4d8c-842d-b193c7372ba9","trademark-guidelines":"9c115f22-c012-4a0d-b88c-7452edd6a15d"},"children":["$","$L12",null,{"config":{"backendPrivateApiUrl":"https://api.anthropic.com","anthropicApiUrl":"https://api.anthropic.com","consoleAbsoluteUrl":"https://platform.claude.com","claudeAiAbsoluteUrl":"https://claude.ai","customAgentsAbsoluteUrl":"","websiteBaseUrl":"https://www.anthropic.com","userContentRendererUrl":"https://www.claudeusercontent.com","conwayShellOrigin":"https://conway.claudeusercontent.com","mcpLocalConnectorUrl":"https://www.claudemcpclient.com","mcpAppsSandboxProxyUrl":"https://sandbox.claudemcpcontent.com/mcp_apps","imagineMcpUrl":"https://sandbox.claudemcpcontent.com/imagine_mcp","googleOauthClientId":"1062961139910-l2m55cb9h51u5cuc9c56eb3fevouidh9.apps.googleusercontent.com","stripePublishableKey":"pk_live_51MExQ9BjIQrRQnuxA9s9ahUkfIUHPoc3NFNidarWIUhEpwuc1bdjSJU9medEpVjoP4kTUrV2G8QWdxi9GjRJMUri005KO5xdyD","stripePublishableKeyIreland":"pk_live_51REyrSBNUnCSzfs9yUvED4MEXaLQQ6pVzoRIf2DGv2SxJnmquGmGmPZaVRnvgZRX8h9gw9Mm1fq2LlRjlCTAV6hZ00cWXQZQEW","stripePublishableKeySandbox":"","segmentKey":"LKJN8LsLERHEOXkw487o7qCTFOrGPimI","segmentCdnHost":"a-cdn.anthropic.com","segmentApiHost":"a-api.anthropic.com","siftBeaconKey":"99dfa2e716","siftCdnHost":"s-cdn.anthropic.com","arkoseKey":"EEA5F558-D6AC-4C03-B678-AABF639EE69A","arkoseCdnHost":"a-cdn.claude.ai","gtagMeasurementId":"AW-16632748715","floodlightId":"DC-15684265","publishedArtifactsBaseUrl":"https://claude.ai","publishedArtifactsEmbedBaseUrl":"https://claude.site","defaultSecureCookies":true,"claudeBrowserExtensionClientId":"dae2cad8-15c5-43d2-9046-fcaecc135fa4","claudeBrowserExtensionId":"fcoeoabgfenejglbffodgkkbkcdhcgfn","antOnlyClaudeBrowserExtensionId":"dngcpimnedloihjnnfngkgjoidhnaolf","excelAddInClientId":"966eba67-8b8c-4eae-bbb3-08361d1b9292","iframeAllowedOrigins":"$10:props:config:iframeAllowedOrigins","applicationType":"claude-dot","ipCountry":"US","serverGateNames":"$undefined"},"children":["$","$L13",null,{"children":["$","$L1d",null,{"isClientBootstrap":false,"children":["$","$L14",null,{"state":{"mutations":[],"queries":[{"state":{"data":{"account":null,"statsig":{"user":{},"values":{},"values_hash":""},"growthbook":{"features":{"129880755":{"defaultValue":true,"rules":[{"force":true,"id":"2YMKAbqK8Jaztq4rf3jYRk:100.00:5"}]},"132350384":{"defaultValue":{"enabled":false}},"132848567":{"defaultValue":false},"133979383":{"defaultValue":false},"139569897":{"defaultValue":false},"140394361":{"defaultValue":true,"rules":[{"force":true,"id":"7E1dkaV2MG8cqAREOmH3j9"}]},"167784518":{"defaultValue":false},"173923190":{"defaultValue":{"variant":"control"}},"230744533":{"defaultValue":false},"301540610":{"defaultValue":{"variant":""}},"314854079":{"defaultValue":false},"378908651":{"defaultValue":20000,"rules":[{"force":20000,"id":"fr_mpg47vfl"}]},"529560408":{"defaultValue":false},"546414678":{"defaultValue":false},"564175158":{"defaultValue":{"variant":"v1"},"rules":[{"force":{"variant":"v1"},"id":"fr_144cvpnmo96tayk"}]},"671313594":{"defaultValue":true,"rules":[{"force":true,"id":"fr_monbwwm3"}]},"690832210":{"defaultValue":true,"rules":[{"force":true,"id":"2xKM5nSqcxThzVt4SUAI1S"}]},"714470048":{"defaultValue":{"variant":"control"}},"758688052":{"defaultValue":false},"768809736":{"defaultValue":false},"823883353":{"defaultValue":false},"831859732":{"defaultValue":false},"863794506":{"defaultValue":true,"rules":[{"force":true,"id":"6OCo11e6q2gGg9R8kZQNcI:100.00:2"}]},"900536136":{"defaultValue":true,"rules":[{"force":true,"id":"5eLgRy5elYnuQj16EmIQN3"}]},"978885332":{"defaultValue":true,"rules":[{"force":true,"id":"4XKZplMyMWVdDzispWUUde"}]},"1042586083":{"defaultValue":{"value":"download_below"},"rules":[{"force":{"value":"download_below"},"id":"fr_12izd9mmlvfo1k5"}]},"1155854764":{"defaultValue":{"variant":"control"},"rules":[{"force":{"variant":"control"},"id":"fr_16bn1fecnmo9c70dm"}]},"1214734888":{"defaultValue":false,"rules":[{"force":false,"id":"UzH7kUL0um9GD9KrjZ0dL:0.00:1"}]},"1220868466":{"defaultValue":true,"rules":[{"force":true,"id":"fr_1ybzq98mmltrzoi3"}]},"1240012697":{"defaultValue":false},"1262012846":{"defaultValue":null},"1302994296":{"defaultValue":false},"1319782748":{"defaultValue":false},"1365593385":{"defaultValue":true,"rules":[{"force":true,"id":"744CYdngRhD4uTf9K3ICPB"}]},"1374241653":{"defaultValue":true,"rules":[{"force":true,"id":"17N2iphBsCwlz8k11Qf8F3:100.00:1"}]},"1475762346":{"defaultValue":{"variant":"control"}},"1644553577":{"defaultValue":{"variant":"redirect_only"},"rules":[{"force":{"variant":"redirect_only"},"id":"fr_3humtnmmuwc0b8"}]},"1787354126":{"defaultValue":{"allowed_actions":[],"enabled":false}},"1841644159":{"defaultValue":true,"rules":[{"force":true,"id":"fr_mp4ayumn"}]},"1851432169":{"defaultValue":false,"rules":[{"force":false,"id":"6nxeGk0341Ttn25QjQaP35"}]},"1907194158":{"defaultValue":true},"1943498851":{"defaultValue":false},"1985092665":{"defaultValue":true,"rules":[{"force":true,"id":"3WrF6dDIwF2IQKS6VkqdSH:100.00:3"}]},"2053917121":{"defaultValue":true,"rules":[{"force":true,"id":"14PVnyeKKtAyZXIkgELY0N:0.00:3"}]},"2076442332":{"defaultValue":false},"2119474141":{"defaultValue":true,"rules":[{"force":true,"id":"4VyB4KbnP54mTKitetfx55"}]},"2190197109":{"defaultValue":true,"rules":[{"force":true,"id":"24Ey6W4aDw9stK8WNPIjIj:100.00:1"}]},"2228941477":{"defaultValue":false},"2283905311":{"defaultValue":{"variant":"v2"},"rules":[{"force":{"variant":"v2"},"tracks":[{"experiment":{"hashAttribute":"anonymousId","key":"cash-shared_conv_recipient_cta","variations":[{"variant":"control"},{"variant":"v1"},{"variant":"v2"}]},"result":{"featureId":"2283905311","hashAttribute":"anonymousId","hashUsed":true,"hashValue":"b6988148-53b2-418c-af31-27c4f0c91f9e","inExperiment":true,"key":"2","value":{"variant":"v2"},"variationId":2}}]}]},"2288098333":{"defaultValue":true,"rules":[{"force":true,"id":"SImu46mbhmXNK0ySjI4My"}]},"2354948608":{"defaultValue":false},"2619993844":{"defaultValue":false},"2696802802":{"defaultValue":{"show_open_email_button":true},"rules":[{"force":{"show_open_email_button":true},"tracks":[{"experiment":{"hashAttribute":"anonymousId","key":"claudified_magic_link_open_email_button","variations":[{"show_open_email_button":false},{"show_open_email_button":true}]},"result":{"featureId":"2696802802","hashAttribute":"anonymousId","hashUsed":true,"hashValue":"b6988148-53b2-418c-af31-27c4f0c91f9e","inExperiment":true,"key":"1","value":{"show_open_email_button":true},"variationId":1}}]}]},"2705189879":{"defaultValue":true,"rules":[{"force":true,"id":"3SgUvhqO1Ijy2ER8r0ki4c"}]},"2717756418":{"defaultValue":true,"rules":[{"force":true,"id":"1TpryBy4gTU5SGzW4wimUV:100.00:1"}]},"2765419013":{"defaultValue":true,"rules":[{"force":true,"id":"4NCQurEPB2jxQsORuR4zm"}]},"2804326784":{"defaultValue":false},"2835872424":{"defaultValue":{"value":"control"}},"2838472889":{"defaultValue":false},"2913013195":{"defaultValue":{"value":"card_only"},"rules":[{"force":{"value":"card_only"},"id":"fr_2j07qnmn7j3in3"}]},"2980957181":{"defaultValue":false},"3004162293":{"defaultValue":true,"rules":[{"force":true,"id":"1Ieg6E18XMhpepkKxbrL0D"}]},"3007887412":{"defaultValue":true,"rules":[{"force":true,"id":"fr_3a9urnmm1d3i61"}]},"3037557804":{"defaultValue":true,"rules":[{"force":true,"id":"3XsnmyQ2Bo64fjHOC7X3at:100.00:6"}]},"3065341443":{"defaultValue":false},"3070110303":{"defaultValue":true,"rules":[{"force":true,"id":"5g2213XtgA3r8zBcNcr2UM:100.00:1"}]},"3201545015":{"defaultValue":true,"rules":[{"force":true,"id":"4vQmxuM6p9mTp7CL0xVCxs:100.00:2"}]},"3211559848":{"defaultValue":{"value":"control"}},"3275294576":{"defaultValue":true,"rules":[{"force":true,"id":"7v09ASaVYp9m1XXGWC13Qk"}]},"3334414388":{"defaultValue":false,"rules":[{"force":false,"id":"fr_mp80kz1q"}]},"3361264557":{"defaultValue":true,"rules":[{"force":true,"id":"fr_monbysd8"}]},"3455937299":{"defaultValue":false},"3494475348":{"defaultValue":true,"rules":[{"force":true,"id":"fr_1ffwdxnmmp59el1"}]},"3514844429":{"defaultValue":"arkose"},"3638884360":{"defaultValue":true,"rules":[{"force":true,"id":"42oCXYaVEvOMnTFt33edFO"}]},"3642280994":{"defaultValue":false},"3906670371":{"defaultValue":true,"rules":[{"force":true,"id":"7dfWzSSGDvPuGntlZFEvG1"}]},"3934738808":{"defaultValue":{"integrity":"sha384-MzVjkiZKo6CP3gyxJFL6Dbt3CTXiajnfBeXmDPw/YbMkyWlQZw4TxdWq8sRpw0F9 sha384-FZBjxyOWFh1MMClo4PF/i5OdIU3CKTUU4+mfjoDJY1dOr/udvY+VSrcqTqcUKkML sha384-2jVX9R2BGBnzR0earYFDe+dz+oVqJg8sKl7+UaHG2Usm6X/0wEl6sIXHsL0WlgoU sha384-qIbffQdAF8gmeyE2OkjkaUMIwG946jBjULVv/tZBeZ2pgkEsIpqQ/YZn3kvn8n0V"}},"3941846376":{"defaultValue":true,"rules":[{"force":true,"id":"5E2GkmVPrglm6esCG12KV9"}]},"3982885328":{"defaultValue":{"features":[],"keep_reading_from_statsig":[]}},"3991313494":{"defaultValue":true},"4102862019":{"defaultValue":false},"4234367967":{"defaultValue":{"cycle":true,"enabled":true,"slugs":["rakuten","notion","stubhub","cursor","intercom","replit","thomson-reuters","plaid","zapier","asana","ramp","uber","workato","databricks","stripe","brex","figma","shopify","pagerduty"],"visibleCount":6},"rules":[{"force":{"cycle":true,"enabled":true,"slugs":["rakuten","notion","stubhub","cursor","intercom","replit","thomson-reuters","plaid","zapier","asana","ramp","uber","workato","databricks","stripe","brex","figma","shopify","pagerduty"],"visibleCount":6},"id":"fr_2jlmwnmnxxc1vd"}]},"4294785799":{"defaultValue":true,"rules":[{"force":true,"id":"fr_5qgznmo38qtqh"}]}},"hashing_algorithm":"djb2","user":{"anonymousId":"b6988148-53b2-418c-af31-27c4f0c91f9e","stableId":"b6988148-53b2-418c-af31-27c4f0c91f9e"}},"intercom_account_hash":null,"locale":null,"system_prompts":null},"dataUpdateCount":1,"dataUpdatedAt":1780985493547,"error":null,"errorUpdateCount":0,"errorUpdatedAt":0,"fetchFailureCount":0,"fetchFailureReason":null,"fetchMeta":null,"isInvalidated":false,"status":"success","fetchStatus":"idle"},"queryKey":["current_account",null],"queryHash":"["current_account",null]"}]},"persistCacheInBrowser":false,"children":"$L1e"}]}]}]}]}]}]}]
1f:I[6101594294,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"CurrentAccountProvider"]
20:I[7905548032,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"ConsentProvider"]
21:I[2260942454,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"IntercomProvider"]
22:I[7971099496,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"BootstrapedGrowthbookProvider"]
23:I[5466030953,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"IsolatedMarketingPixelSegmentProvider"]
24:I[1404814639,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"TierSelectorProvider"]
25:I[6367756395,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"MotionConfig"]
26:I[5610272664,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"LinkBoundaryProvider"]
27:I[3863335323,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"LogHiring"]
28:I[9161483349,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","9664","static/chunks/9664-b340082bc2b2e477.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","997","static/chunks/997-d981028957d3c8ff.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","7177","static/chunks/app/layout-e79e463cceae1f7b.js"],"WorkerUpdater"]
29:I[2611790566,["9799","static/chunks/9799-b8631f58a2e43557.js","3145","static/chunks/3145-b7a1926db2fa18d1.js","2245","static/chunks/2245-689c6cf127be35db.js","9666","static/chunks/9666-8811d22c05827b5d.js","2610","static/chunks/2610-3acde26aca5143cc.js","3073","static/chunks/3073-4ba5ce9863e30ef3.js","6671","static/chunks/6671-e05ca9783af40808.js","2001","static/chunks/2001-efabfb3c350fc4e0.js","6855","static/chunks/6855-3096b19f5af9da96.js","2806","static/chunks/2806-a33b192c463574db.js","5147","static/chunks/5147-8daae75abbc8a67d.js","9373","static/chunks/app/(ssr)/public/artifacts/layout-5489950039193334.js"],"ErrorSegmentConnector"]
1e:["$","$L1f",null,{"children":["$","$L20",null,{"requiresExplicitConsent":false,"gpcDetected":false,"children":["$","$L21",null,{"appId":"lupk8zyo","initializeDelay":1000,"children":["$","$L22",null,{"children":["$","$Lf",null,{"locale":"en-US","messages":"$5:props:children:props:messages","hideErrors":true,"children":["$","$L23",null,{"enabled":true,"children":[["$","$L24",null,{"children":[["$","$L25",null,{"children":["$","$L26",null,{"children":["$","div",null,{"className":"root","children":["$","$L3",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","div",null,{"className":"flex h-full items-center justify-center","children":["$","h1",null,{"className":"text-text-200","children":"404 — Not Found"}]}],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]}]}]}],["$","$L27",null,{}],["$","$L28",null,{"updateType":null}]]}],["$","$L29",null,{}]]}]}]}]}]}]}]
2a:I[3611703225,[],"IconMark"]
9:null
d:[["$","title","0",{"children":"Bruhaspati AI Bug Fix Prompt v2 — Complete Implementation Guide | Claude"}],["$","meta","1",{"name":"description","content":"Master prompt for fixing 7 critical bugs and adding premium features to Bruhaspati AI tutoring app. Includes API quota enforcement, loading animations, format modes, NCERT library, and quiz generation fixes."}],["$","meta","2",{"name":"robots","content":"noindex, nofollow"}],["$","meta","3",{"name":"application-ld+json","content":"{"@context":"https://schema.org","@type":"CreativeWork","name":"Bruhaspati AI Bug Fix Prompt v2 — Complete Implementation Guide","description":"Master prompt for fixing 7 critical bugs and adding premium features to Bruhaspati AI tutoring app. Includes API quota enforcement, loading animations, format modes, NCERT library, and quiz generation fixes.","publisher":{"@type":"Organization","name":"claude.ai","url":"https://claude.ai"},"url":"https://claude.ai/public/artifacts/96d9c381-39c9-48de-8c93-44827ab5f57d","encodingFormat":"text/markdown"}"}],["$","meta","4",{"property":"og:title","content":"Bruhaspati AI Bug Fix Prompt v2 — Complete Implementation Guide"}],["$","meta","5",{"property":"og:description","content":"Master prompt for fixing 7 critical bugs and adding premium features to Bruhaspati AI tutoring app. Includes API quota enforcement, loading animations, format modes, NCERT library, and quiz generation fixes."}],["$","meta","6",{"property":"og:url","content":"https://claude.ai/public/artifacts/96d9c381-39c9-48de-8c93-44827ab5f57d"}],["$","meta","7",{"property":"og:site_name","content":"Claude"}],["$","meta","8",{"property":"og:image","content":"https://claude.ai/images/claude_ogimage.png"}],["$","meta","9",{"property":"og:image:type","content":"image/png"}],["$","meta","10",{"property":"og:image:width","content":"1200"}],["$","meta","11",{"property":"og:image:height","content":"630"}],["$","meta","12",{"property":"og:image:alt","content":"bruhaspati_bugfix_prompt_v2.md"}],["$","meta","13",{"property":"og:type","content":"website"}],["$","meta","14",{"name":"twitter:card","content":"summary_large_image"}],["$","meta","15",{"name":"twitter:title","content":"Bruhaspati AI Bug Fix Prompt v2 — Complete Implementation Guide"}],["$","meta","16",{"name":"twitter:description","content":"Master prompt for fixing 7 critical bugs and adding premium features to Bruhaspati AI tutoring app. Includes API quota enforcement, loading animations, format modes, NCERT library, and quiz generation fixes."}],["$","meta","17",{"name":"twitter:image","content":"https://claude.ai/images/claude_ogimage.png"}],["$","link","18",{"rel":"shortcut icon","href":"/favicon.ico"}],["$","link","19",{"rel":"icon","href":"/favicon.svg","type":"image/svg+xml"}],["$","$L2a","20",{}]]
