# Bruhaspati AI â Master Bug Fix & Feature Upgrade Prompt v2

Paste this entire prompt into your AI coding assistant (Cursor, Claude Code, etc.) to fix all 7 issues at once.

---

## CONTEXT

You are working on **Bruhaspati AI** â a Next.js/React AI tutor for Indian students (CBSE, CHSE Odisha, BSE Odisha, JEE, NEET, IISER IAT). The app uses the Google Gemini API (or equivalent LLM). Fix ALL of the following bugs and add ALL features described below. Do not skip any item.

---

## BUG FIX 1 â API QUOTA / PLAN ENFORCEMENT (CRITICAL)

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
  
  if (tokenStore.used + cost > limits[userPlan]) {
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
{error?.type === 'QUOTA_EXCEEDED' && (
  <QuotaExceededCard plan={userPlan} onUpgrade={() => setShowUpgradeModal(true)} />
)}
{error?.type === 'RATE_LIMITED' && (
  <ErrorCard message=