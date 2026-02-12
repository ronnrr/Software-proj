/**
 * api.js — Gemini API wrapper (FR-02)
 *
 * All network calls to the Gemini REST API are centralised here. No other
 * module calls fetch() directly. This ensures that error handling, the
 * 30-second timeout, and API-key security (NFR-04) are enforced in one place.
 *
 * Authentication: the API key is sent via the `x-goog-api-key` request
 * header — never in the URL query string (satisfies NFR-04).
 */

import { buildAnalysisPrompt, buildFollowUpPrompt } from './prompt.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Gemini 2.0 Flash content-generation endpoint. */
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/** Hard timeout for every Gemini request (FR-02.6). */
const REQUEST_TIMEOUT_MS = 30_000;

// ─── Config loading ───────────────────────────────────────────────────────────

/**
 * Fetches and validates the Gemini API key from config.json (FR-02.4).
 * Must be called once during app initialisation.
 *
 * @returns {Promise<string>} The validated API key.
 * @throws  {Error}          With a human-readable message on any failure.
 */
export async function loadConfig() {
  let config;

  try {
    const response = await fetch('../config.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    config = await response.json();
  } catch {
    throw new Error(
      'Could not load config.json. Make sure it exists at the project root.'
    );
  }

  const key = config?.gemini?.api_key;
  if (!key || key === 'PLACEHOLDER' || key === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
    throw new Error(
      'Invalid or missing API key. Open config.json and replace the placeholder with your Gemini API key.'
    );
  }

  return key;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Sends a prompt to the Gemini API and returns the raw response text.
 *
 * @param {string}  prompt    - Fully formed prompt string.
 * @param {string}  apiKey    - Gemini API key (sent in header, not URL).
 * @param {boolean} forceJson - When true, sets response_mime_type to application/json.
 * @returns {Promise<string>} Text from candidates[0].content.parts[0].text.
 * @throws  {Error}           With a human-readable message on any failure.
 */
async function callGemini(prompt, apiKey, forceJson) {
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (forceJson) {
    requestBody.generationConfig = { response_mime_type: 'application/json' };
  }

  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-goog-api-key':  apiKey,           // header — not URL (NFR-04)
      },
      body:   JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), // FR-02.6
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error('Network error. Please check your connection.');
  }

  // FR-02.7 — classify HTTP error codes
  if (response.status === 400) {
    throw new Error('Invalid or missing API key.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('API key is unauthorised. Check that your key is valid and active.');
  }
  if (response.status === 429) {
    throw new Error('API rate limit exceeded. Please wait a moment and try again.');
  }
  if (!response.ok) {
    throw new Error(`Gemini API error (HTTP ${response.status}). Please try again.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Malformed response from Gemini.');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Malformed response from Gemini — no content returned.');
  }

  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Submits source code to Gemini for code-smell analysis (FR-02.1 – FR-02.3).
 *
 * @param {string} code     - Source code to analyse.
 * @param {string} language - Language identifier (e.g. "Python") or "auto".
 * @param {string} apiKey   - Gemini API key.
 * @returns {Promise<{summary: string, smells: Array, refactored_code: string}>}
 * @throws  {Error} With a human-readable message on any failure.
 */
export async function analyzeCode(code, language, apiKey) {
  const prompt  = buildAnalysisPrompt(code, language);
  const rawText = await callGemini(prompt, apiKey, true);

  // Strip markdown fences defensively, in case the model wraps output despite
  // the response_mime_type constraint (satisfies the requirements note about
  // stripping ```json``` fences before parsing).
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let result;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error('Malformed response from Gemini. Could not parse the analysis result.');
  }

  // Normalise: guarantee required fields are present so UI code can rely on them.
  if (!Array.isArray(result.smells))           result.smells          = [];
  if (typeof result.summary !== 'string')      result.summary         = '';
  if (typeof result.refactored_code !== 'string') result.refactored_code = code;

  return result;
}

/**
 * Sends a follow-up chat question with the original analysis as context
 * (FR-05.2).
 *
 * @param {string} question       - The user's follow-up question.
 * @param {string} originalCode   - The original source code that was analysed.
 * @param {object} analysisResult - The parsed result returned by analyzeCode().
 * @param {string} apiKey         - Gemini API key.
 * @returns {Promise<string>} Gemini's plain-text reply.
 * @throws  {Error} With a human-readable message on any failure.
 */
export async function sendFollowUp(question, originalCode, analysisResult, apiKey) {
  const prompt = buildFollowUpPrompt(question, originalCode, analysisResult);
  return callGemini(prompt, apiKey, false);
}
