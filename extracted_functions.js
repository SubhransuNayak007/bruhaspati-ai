// === FUNCTION getSystemPromptForFormat ===
function getSystemPromptForFormat(format, query) {
  if (detectPYQQuery(query)) {
    return PYQ_SYSTEM_PROMPT
      .replace('{{BOARD}}', state.board)
      .replace('{{CLASS}}', state.classLevel)
      .replace('{{SUBJECT}}', state.subject);
  }
  if (detectQuizQuery(query)) {
    return QUIZ_SYSTEM_PROMPT
      .replace('{{BOARD}}', state.board)
      .replace('{{CLASS}}', state.classLevel)
      .replace('{{SUBJECT}}', state.subject);
  }
  if (detectFormulaQuery(query)) {
    return FORMULA_SYSTEM_PROMPT
      .replace('{{BOARD}}', state.board)
      .replace('{{CLASS}}', state.classLevel)
      .replace('{{SUBJECT}}', state.subject);
  }

  let basePrompt = '';
  if (format === 'long_answer') {
    basePrompt = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.
Your name "Bruhaspati" refers to the Hindu god of wisdom and knowledge.

CURRENT CONTEXT: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

You MUST respond in this exact JSON structure:
{
  "title": "Clear title of the topic",
  "essay": "A flowing 500-800 word essay-style answer as a student would write in board exams for long answer questions. Use pure paragraphs. Do NOT use any bullet points, and do NOT use any section headers inside the essay text. Break it into 3-5 logical paragraphs.",
  "teacherTip": "A memory trick, exam strategy, or common mistake to avoid.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Do not include any HTML tags or markdown headers in the "essay" string itself. Use standard text with paragraphs separated by double newlines.
2. Bold key terms using **term** inside the text.
3. For all math, physics, or chemistry variables/equations, use standard LaTeX syntax wrapped in $ for inline and $$ for blocks.
4. Ensure the essay matches the target board/class complexity.
5. End with 3 highly relevant follow-up questions in the "followups" array.`;
  } else if (format === 'quick_summary') {
    basePrompt = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.
Your name "Bruhaspati" refers to the Hindu god of wisdom and knowledge.

CURRENT CONTEXT: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

You MUST respond in this exact JSON structure:
{
  "topic": "Topic name",
  "points": [
    "Key revision point 1 (15-20 words)",
    "Key revision point 2 (15-20 words)",
    "Key revision point 3 (15-20 words)",
    "Key revision point 4 (15-20 words)",
    "Key revision point 5 (15-20 words)"
  ],
  "teacherTip": "A quick exam tip or formula to remember.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Keep the total word count of the 5 points strictly under 100 words.
2. Bold key terms using **term** inside the points.
3. For all math, physics, or chemistry variables/equations, use standard LaTeX syntax wrapped in $ for inline and $$ for blocks.
4. End with 3 highly relevant follow-up questions in the "followups" array.`;
  } else if (format === 'exam_focused') {
    basePrompt = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum.
Your name "Bruhaspati" refers to the Hindu god of wisdom and knowledge.

CURRENT CONTEXT: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

You MUST respond in this exact JSON structure:
{
  "topic": "Topic name",
  "examData": [
    {"exam": "CBSE Class 12", "years": "2020, 2022", "marks": "5 marks", "type": "Long Answer", "frequency": "HIGH"}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "commonMistakes": "Highlight common student mistakes in exams regarding this topic.",
  "modelAnswer": "A perfect, high-scoring model answer for a typical board/entrance exam question on this topic. Bold key terms using **term**.",
  "followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

RULES:
1. Skip all general theory/introductions. Focus only on exam history, keywords required for scoring, common mistakes, and the high-scoring model answer.
2. For all math, physics, or chemistry variables/equations, use standard LaTeX syntax wrapped in $ for inline and $$ for blocks.
3. End with 3 highly relevant follow-up questions in the "followups" array.`;
  } else {
    // default: structured
    basePrompt = `You are "Bruhaspati AI," an elite, highly empathetic, and expertly trained AI Educational Tutor specializing in the Indian academic curriculum. Your name "Bruhaspati" refers to the Hindu god of wisdom and knowledge — you embody that spirit.

Your domain expertise encompasses:
- CBSE (Class 9, 10, 11, 12) — NCERT-aligned
- State Boards: BSE Odisha (Class 10) and CHSE Odisha (Class 11, 12)
- National Entrance Exams: JEE Main, JEE Advanced, NEET UG, IISER IAT, CUET

CURRENT CONTEXT: Board = {{BOARD}}, Class = {{CLASS}}, Subject = {{SUBJECT}}

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
    {"exam": "CBSE Class 10", "years": "2019, 2022", "marks": "3 marks", "type": "Short Answer", "frequency": "HIGH"},
    {"exam": "NEET UG", "years": "2021", "marks": "4 marks", "type": "MCQ", "frequency": "MEDIUM"}
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
4. For JEE Advanced: explain partial marking implications
5. For NEET: emphasize NCERT line-by-line importance
6. For CHSE Odisha: note 40-50 words for 2-mark, 120-150 words for 5-mark answers
7. For all math, physics, or chemistry variables/equations, use standard LaTeX syntax wrapped in $ for inline and $$ for blocks.
8. End with 3 highly relevant follow-up questions in the "followups" array.`;
  }
  
  return basePrompt
    .replace('{{BOARD}}', state.board)
    .replace('{{CLASS}}', state.classLevel)
    .replace('{{SUBJECT}}', state.subject);
}

// === FUNCTION streamAIResponse ===
function streamAIResponse(query, cardId) {
  const activeBubble = document.getElementById(cardId);
  if (!activeBubble) return;
  const aiContent = activeBubble.closest('.msg-ai').querySelector('.ai-content');
  
  const isHeavyResource = detectQuizQuery(query) || detectFormulaQuery(query) || detectPYQQuery(query) || state.format === 'exam_focused';
  
  if (isHeavyResource) {
    showMandalaLoader(cardId, aiContent, state.subject);
  } else {
    showTypingLoader(cardId, aiContent);
  }
  scrollToBottom();

  if (!state.useRealAPI || !state.apiKey) {
    await simulateDemoStream(query, cardId);
    return;
  }

  const isOpenAI = state.apiKey.startsWith('sk-');
  let accumulatedText = '';
  
  try {
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
      
      if (!response.ok) {
        let errMsg = `Error ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.error && errJson.error.message) {
            errMsg = errJson.error.message;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }
    } else {
      // Cascading Gemini models to handle service overloads or exclusions
      const models = [
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-flash', version: 'v1' },
        { name: 'gemini-2.5-flash', version: 'v1beta' },
        { name: 'gemini-1.5-pro', version: 'v1beta' }
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
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          };
          
          response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
          });
          
          if (response.ok) {
            success = true;
            break;
          } else {
            let errMsg = `Error ${response.status}`;
            try {
              const errJson = await response.json();
              if (errJson && errJson.error && errJson.error.message) {
                errMsg = errJson.error.message;
              }
            } catch (_) {}
            throw new Error(errMsg);
          }
        } catch (err) {
          console.warn(`⚠️ Model ${modelSpec.name} failed: ${err.message}. Cascading...`);
          lastError = err;
          // If the API key is completely invalid, do not try other models
          if (err.message.includes('API key not valid') || err.message.includes('Key not valid') || err.message.includes('400')) {
            throw err;
          }
        }
      }
      
      if (!success) {
        throw lastError || new Error("Failed to connect to any Gemini models.");
      }
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastRenderTime = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
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
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              accumulatedText += text;
            } catch (err) {}
          }
        }
      }
      
      let now = Date.now();
      if (now - lastRenderTime > 120) {
        lastRenderTime = now;
        renderPartialText(accumulatedText, aiContent, cardId, query, false);
      }
    }
    
    renderPartialText(accumulatedText, aiContent, cardId, query, true);
    
  } catch (err) {
    console.error('Streaming error:', err);
    
    // Check if error is related to quota, billing, rate limit, or invalid keys
    const errMsg = err.message.toLowerCase();
    const isQuotaError = errMsg.includes('quota') || errMsg.includes('billing') || errMsg.includes('limit') || errMsg.includes('credit') || errMsg.includes('funding') || errMsg.includes('429');
    
    if (isQuotaError) {
      console.warn("⚠️ API quota exceeded or key billing issue. Falling back to simulated response.");
      showToast("⚠️ API quota exceeded. Falling back to Simulated Demo Response.");
      await simulateDemoStream(query, cardId);
      return;
    }
    
    aiContent.innerHTML = `
      <div class="response-card" id="${cardId}" style="padding: 16px 20px;">
        <div class="callout callout-rose">
          ⚠️ Something went wrong. Click to retry.<br>
          <span style="font-size:12px; opacity:0.8;">Error: ${err.message}</span>
        </div>
        <button class="modal-btn primary" onclick="retryMessage('${escapeAttr(query)}', '${cardId}')" style="margin-top: 10px; font-size: 11px; padding: 6px 14px;">Tap to retry →</button>
      </div>
    `;
    saveAIMessageToState(query, { error: err.message }, cardId, true);
  }
}

// === FUNCTION simulateDemoStream ===
function simulateDemoStream(query, cardId) {
  let activeBubble = document.getElementById(cardId);
  if (!activeBubble) activeBubble = document.getElementById(cardId + '_loader');
  if (!activeBubble) return;
  const aiContent = activeBubble.closest('.msg-ai').querySelector('.ai-content');
  
  await delay(800); // Latency simulator
  let responseData = getDemoResponse(query);
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
  const topic = extractTopicFromQuery(query);
  const subject = state.subject !== 'All' ? state.subject : 'Physics';
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

  if (q.includes('photosynthesis') || q.includes('calvin') || q.includes('chlorophyll')) {
    return DEMO_RESPONSES.photosynthesis;
  }
  if (q.includes('newton') || q.includes('inertia') || q.includes('force') || q.includes('motion')) {
    return DEMO_RESPONSES.newton;
  }
  
  return DEMO_RESPONSES.default;
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
  if (tokenState.plan === 'pro') return 20000;
  if (tokenState.plan === 'ultra') return Infinity;
  return 2000; // free limit
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

