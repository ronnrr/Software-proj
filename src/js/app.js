/**
 * app.js — Application entry point
 *
 * Responsibilities:
 *   1. Boot: load config.json, store the API key, enable the UI.
 *   2. Bind all user-interaction event listeners.
 *   3. Orchestrate calls between api.js, state.js, and ui.js.
 *
 * This module is the only one that wires event listeners to DOM elements.
 * It delegates all network work to api.js, all state to state.js, and all
 * DOM mutations to ui.js.
 */

import * as api   from './api.js';
import * as state from './state.js';
import * as ui    from './ui.js';

// ─── DOM element references (app.js only) ────────────────────────────────────
// ui.js owns the full element map; app.js only needs the elements it attaches
// listeners to.

const codeInput     = document.getElementById('code-input');
const languageSelect = document.getElementById('language-select');
const analyzeBtn    = document.getElementById('analyze-btn');
const clearBtn      = document.getElementById('clear-btn');
const copyBtn       = document.getElementById('copy-btn');
const chatInput     = document.getElementById('chat-input');
const chatSendBtn   = document.getElementById('chat-send-btn');
const exportChatBtn = document.getElementById('export-chat-btn');
const errorDismiss  = document.getElementById('error-dismiss');

// ─── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Initialises the app:
 *   - Fetches and validates the Gemini API key from config.json.
 *   - Stores the key in session state.
 *   - Shows an error banner if the key is missing or invalid (AC-02.3).
 */
async function init() {
  try {
    const key = await api.loadConfig();
    state.setApiKey(key);
  } catch (err) {
    ui.showError(err.message);
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/** Keeps state and the character counter in sync as the user types (FR-01.3). */
function onCodeInput() {
  const value = codeInput.value;
  state.setCurrentCode(value);
  ui.updateCharCount(value.length);
  ui.setAnalyzeButtonEnabled(value.length >= 10); // FR-01.7
}

/** Keeps state in sync when the user picks a language (FR-01.4). */
function onLanguageChange() {
  state.setCurrentLanguage(languageSelect.value);
}

/**
 * Handles the Analyze button click (FR-02.1):
 *   - Validates that an API key is loaded.
 *   - Shows the loading indicator.
 *   - Calls the Gemini API, stores the result, and renders it.
 *   - On failure, shows a human-readable error (FR-02.7).
 */
async function onAnalyze() {
  const code     = state.getCurrentCode();
  const language = state.getCurrentLanguage();
  const apiKey   = state.getApiKey();

  if (!apiKey) {
    ui.showError(
      'Invalid or missing API key. Open config.json and add your Gemini API key.'
    );
    return;
  }

  ui.hideError();
  ui.setLoading(true);

  try {
    const result = await api.analyzeCode(code, language, apiKey);
    state.setAnalysisResult(result);
    ui.renderResults(result, code, language);
    ui.showChatPanel();
  } catch (err) {
    ui.showError(err.message);
  } finally {
    ui.setLoading(false);
    // Re-evaluate button state — input may still be valid after an error
    ui.setAnalyzeButtonEnabled(code.length >= 10);
  }
}

/**
 * Resets all state and UI to the initial empty state (FR-01.8, FR-06.2).
 */
function onClear() {
  state.reset();
  ui.reset();
}

/**
 * Copies the refactored code to the clipboard (FR-04.2).
 */
function onCopy() {
  const result = state.getAnalysisResult();
  if (result?.refactored_code) {
    ui.copyToClipboard(result.refactored_code);
  }
}

/**
 * Handles sending a follow-up chat message (FR-05.2):
 *   - Appends the user's question to the chat log and state.
 *   - Calls Gemini with the original code and analysis as context.
 *   - Appends Gemini's reply.
 */
async function onChatSend() {
  const question      = chatInput.value.trim();
  const apiKey        = state.getApiKey();
  const originalCode  = state.getCurrentCode();
  const analysisResult = state.getAnalysisResult();

  if (!question || !apiKey || !analysisResult) return;

  state.appendChat('user', question);
  ui.appendChatMessage('user', question);
  ui.clearChatInput();
  ui.setChatSending(true);

  try {
    const reply = await api.sendFollowUp(question, originalCode, analysisResult, apiKey);
    state.appendChat('gemini', reply);
    ui.appendChatMessage('gemini', reply);
  } catch (err) {
    ui.showError(err.message);
  } finally {
    ui.setChatSending(false);
  }
}

/**
 * Allows the user to submit a chat message by pressing Enter (FR-05.1).
 * @param {KeyboardEvent} event
 */
function onChatKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    onChatSend();
  }
}

/**
 * Exports the current chat history as a downloadable .txt file (FR-05.5).
 * The file is offered via a browser download dialog, consistent with the
 * chats/ directory convention described in the architecture.
 */
function onExportChat() {
  const log = state.getChatLog();
  if (!log) {
    ui.showError('No chat history to export yet.');
    return;
  }

  const blob      = new Blob([log], { type: 'text/plain;charset=utf-8' });
  const url       = URL.createObjectURL(blob);
  const anchor    = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  anchor.href     = url;
  anchor.download = `chat-export-${timestamp}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Dismisses the error banner when the user clicks the ✕ button. */
function onDismissError() {
  ui.hideError();
}

// ─── Event listener registration ─────────────────────────────────────────────

codeInput.addEventListener('input',   onCodeInput);
languageSelect.addEventListener('change', onLanguageChange);
analyzeBtn.addEventListener('click',  onAnalyze);
clearBtn.addEventListener('click',    onClear);
copyBtn.addEventListener('click',     onCopy);
chatInput.addEventListener('keydown', onChatKeyDown);
chatSendBtn.addEventListener('click', onChatSend);
exportChatBtn.addEventListener('click', onExportChat);
errorDismiss.addEventListener('click',  onDismissError);

// ─── Start ────────────────────────────────────────────────────────────────────

init();
