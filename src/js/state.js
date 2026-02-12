/**
 * state.js — In-memory session state (FR-06.1)
 *
 * A plain-object module that holds all mutable application state for the
 * current browser session. There is no reactivity or serialisation — other
 * modules call explicit setter functions, which keeps state transitions easy
 * to follow and debug.
 *
 * The API key is preserved across reset() calls so it does not need to be
 * re-fetched from config.json every time the user clears the UI.
 */

// ─── Private state ────────────────────────────────────────────────────────────

/** @type {string|null} */
let apiKey = null;

/** @type {string} */
let currentCode = '';

/** @type {string} */
let currentLanguage = 'auto';

/**
 * @typedef  {object} Smell
 * @property {string}                    name
 * @property {'Critical'|'Major'|'Minor'} severity
 * @property {string}                    location
 * @property {string}                    explanation
 */

/**
 * @typedef  {object} AnalysisResult
 * @property {string}  summary
 * @property {Smell[]} smells
 * @property {string}  refactored_code
 */

/** @type {AnalysisResult|null} */
let analysisResult = null;

/**
 * @typedef  {object} ChatEntry
 * @property {'user'|'gemini'} role
 * @property {string}          text
 * @property {Date}            timestamp
 */

/** @type {ChatEntry[]} */
let chatHistory = [];

// ─── Getters ──────────────────────────────────────────────────────────────────

export const getApiKey         = () => apiKey;
export const getCurrentCode    = () => currentCode;
export const getCurrentLanguage = () => currentLanguage;
export const getAnalysisResult = () => analysisResult;
export const hasAnalysis       = () => analysisResult !== null;

/**
 * Returns a shallow copy of the chat history array so callers cannot
 * accidentally mutate internal state.
 * @returns {ChatEntry[]}
 */
export const getChatHistory = () => [...chatHistory];

// ─── Setters ──────────────────────────────────────────────────────────────────

/** @param {string} key */
export function setApiKey(key) {
  apiKey = key;
}

/** @param {string} code */
export function setCurrentCode(code) {
  currentCode = code;
}

/** @param {string} language */
export function setCurrentLanguage(language) {
  currentLanguage = language;
}

/** @param {AnalysisResult} result */
export function setAnalysisResult(result) {
  analysisResult = result;
}

/**
 * Appends one message to the chat history.
 * @param {'user'|'gemini'} role
 * @param {string}          text
 */
export function appendChat(role, text) {
  chatHistory.push({ role, text, timestamp: new Date() });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Formats the entire chat history as a plain-text log for download (FR-05.5).
 * @returns {string} Empty string if there are no messages.
 */
export function getChatLog() {
  if (chatHistory.length === 0) return '';

  const divider = '='.repeat(50);
  const lines = [
    'Code Smells Detector & Refactorer — Chat Export',
    divider,
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ];

  for (const entry of chatHistory) {
    const author = entry.role === 'user' ? 'You' : 'Gemini';
    const time   = entry.timestamp.toLocaleTimeString();
    lines.push(`[${time}] ${author}:`);
    lines.push(entry.text);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Resets all mutable state to its initial values (FR-06.2).
 * The API key is intentionally preserved — it was loaded once at startup
 * and does not change during a session.
 */
export function reset() {
  currentCode     = '';
  currentLanguage = 'auto';
  analysisResult  = null;
  chatHistory     = [];
}
