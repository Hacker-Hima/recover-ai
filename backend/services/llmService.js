/**
 * RecoverAI LLM Service
 *
 * Provides LLM-powered diagnosis enrichment and decision reasoning.
 * The LLM:
 *   - May EXPLAIN facts but MUST NOT invent them
 *   - CANNOT change guardrail-forced actions
 *   - CANNOT execute arbitrary commands
 *   - Falls back gracefully when unavailable
 *
 * Providers: gemini (default), openai, anthropic
 */

const axios = require('axios');

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'gemini';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.0-flash';

let _available = null;

async function checkAvailability() {
  if (!LLM_API_KEY) {
    _available = false;
    return false;
  }
  try {
    // Quick probe
    await callLLM('Say "ok" in one word.', 10);
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

function isAvailable() {
  return _available === true;
}

// ─── Provider-specific call ──────────────────────────────────────────────────
async function callLLM(prompt, maxTokens = 300) {
  if (!LLM_API_KEY) throw new Error('LLM_API_KEY not configured');

  if (LLM_PROVIDER === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
    };
    const resp = await axios.post(url, body, { timeout: 8000 });
    return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (LLM_PROVIDER === 'openai') {
    const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }, {
      headers: { Authorization: `Bearer ${LLM_API_KEY}` },
      timeout: 8000,
    });
    return resp.data?.choices?.[0]?.message?.content || '';

  } else if (LLM_PROVIDER === 'anthropic') {
    const resp = await axios.post('https://api.anthropic.com/v1/messages', {
      model: LLM_MODEL || 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: { 'x-api-key': LLM_API_KEY, 'anthropic-version': '2023-06-01' },
      timeout: 8000,
    });
    return resp.data?.content?.[0]?.text || '';
  }

  throw new Error(`Unknown LLM_PROVIDER: ${LLM_PROVIDER}`);
}

function parseJson(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

/**
 * Get LLM diagnosis enrichment.
 * Returns { explanation } or null on failure.
 * The LLM receives structured facts — it must not invent new ones.
 */
async function getDiagnosis(context) {
  const prompt = `You are a payment failure diagnosis assistant for a fintech system.

You are given these VERIFIED facts about a failed payment. You must ONLY explain these facts — do not invent or assume any additional information.

Payment facts:
- Payment ID: ${context.paymentId}
- Amount: ₹${context.amount}
- Method: ${context.paymentMethod}
- Failure reason: ${context.failureReason}
- Failure category (already determined): ${context.failureCategory}
- Attempt number: ${context.attemptNumber}
- Customer success rate: ${(context.previousSuccessRate * 100).toFixed(0)}%
- Customer tenure: ${context.customerTenureDays} days
- Subscription payment: ${context.subscription}

Provide a 2-3 sentence plain-English explanation of WHY this payment likely failed and what it means for recovery chances. Be specific to the facts given. Do not mention anything not in these facts.

Respond with ONLY this JSON (no markdown):
{
  "explanation": "..."
}`;

  const text = await callLLM(prompt, 200);
  const parsed = parseJson(text);
  return parsed;
}

/**
 * Get LLM reasoning narrative for the chosen action.
 * The action has ALREADY been selected by policy — LLM only explains it.
 */
async function getReasoning(context) {
  const { selectedAction, payment, diagnosis, recoveryProbability, policyReason } = context;

  const prompt = `You are a payment recovery reasoning assistant.

The RecoverAI system has already decided to take this action: ${selectedAction}

The policy selected this action for the following reason: "${policyReason}"

Payment context:
- Amount: ₹${payment.amount}
- Method: ${payment.paymentMethod}
- Failure: ${payment.failureReason} (${diagnosis.category})
- Recovery probability: ${(recoveryProbability * 100).toFixed(0)}%
- Customer success rate: ${((payment.previousSuccessRate || 0) * 100).toFixed(0)}%
- Attempt: #${payment.attemptNumber}

Write one clear sentence explaining WHY this specific action (${selectedAction}) was chosen given these facts. Do not suggest a different action. Be concise and factual.

Respond with ONLY the explanation string (no JSON, no quotes).`;

  const text = await callLLM(prompt, 120);
  return text?.trim() || null;
}

module.exports = { checkAvailability, isAvailable, getDiagnosis, getReasoning };
