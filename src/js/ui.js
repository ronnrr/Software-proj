/**
 * ui.js — All DOM manipulation
 *
 * This module is the only place that reads or writes to the DOM.
 * app.js calls these functions with data; it never touches
 * document.querySelector or innerHTML directly.
 *
 * All element references are resolved once at module load time (safe because
 * ES module scripts execute after the document has been parsed).
 */

// ─── Element map ──────────────────────────────────────────────────────────────

const el = {
  analyzeBtn:       document.getElementById('analyze-btn'),
  clearBtn:         document.getElementById('clear-btn'),
  codeInput:        document.getElementById('code-input'),
  languageSelect:   document.getElementById('language-select'),
  charCount:        document.getElementById('char-count'),
  errorBanner:      document.getElementById('error-banner'),
  errorMessage:     document.getElementById('error-message'),
  loadingIndicator: document.getElementById('loading-indicator'),
  resultsSection:   document.getElementById('results-section'),
  summaryText:      document.getElementById('summary-text'),
  smellCountBadge:  document.getElementById('smell-count-badge'),
  smellsList:       document.getElementById('smells-list'),
  originalCode:     document.getElementById('original-code'),
  refactoredCode:   document.getElementById('refactored-code'),
  copyBtn:          document.getElementById('copy-btn'),
  chatPanel:        document.getElementById('chat-panel'),
  chatLog:          document.getElementById('chat-log'),
  chatInput:        document.getElementById('chat-input'),
  chatSendBtn:      document.getElementById('chat-send-btn'),
};

// ─── Character counter ────────────────────────────────────────────────────────

/**
 * Updates the character count label and applies warning colours near the
 * 20,000 character limit (FR-01.3, AC-01.4).
 *
 * @param {number} count - Current character count.
 */
export function updateCharCount(count) {
  const MAX = 20_000;
  el.charCount.textContent = `${count.toLocaleString()} / ${MAX.toLocaleString()}`;
  el.charCount.classList.remove('near-limit', 'at-limit');
  if (count >= MAX) {
    el.charCount.classList.add('at-limit');
  } else if (count >= MAX * 0.85) {
    el.charCount.classList.add('near-limit');
  }
}

// ─── Button / input state ─────────────────────────────────────────────────────

/**
 * Enables or disables the Analyze button (FR-01.7, AC-01.1, AC-01.2).
 * @param {boolean} enabled
 */
export function setAnalyzeButtonEnabled(enabled) {
  el.analyzeBtn.disabled = !enabled;
}

/**
 * Toggles the loading state: shows the spinner, disables all controls while a
 * request is in flight, and re-enables them on completion (FR-02.5, AC-02.1).
 *
 * @param {boolean} loading
 */
export function setLoading(loading) {
  el.loadingIndicator.classList.toggle('hidden', !loading);
  el.analyzeBtn.disabled     = loading;
  el.codeInput.disabled      = loading;
  el.languageSelect.disabled = loading;
  el.clearBtn.disabled       = loading;
}

// ─── Error display ────────────────────────────────────────────────────────────

/**
 * Shows a human-readable error message in the error banner (FR-02.7).
 * @param {string} message
 */
export function showError(message) {
  el.errorMessage.textContent = message;
  el.errorBanner.classList.remove('hidden');
}

/** Hides the error banner and clears its message. */
export function hideError() {
  el.errorBanner.classList.add('hidden');
  el.errorMessage.textContent = '';
}

// ─── Result rendering ─────────────────────────────────────────────────────────

/**
 * Renders the analysis summary paragraph above the smell list (FR-03.6).
 * @param {string} summary
 */
function renderSummary(summary) {
  el.summaryText.textContent = summary?.trim() || 'No summary was provided.';
}

/**
 * Maps a raw severity string from Gemini to a normalised lowercase key used
 * for CSS class names. Falls back to "minor" for unrecognised values so the
 * UI never breaks on unexpected API output.
 *
 * @param {string} severity
 * @returns {'critical'|'major'|'minor'}
 */
function normaliseSeverity(severity) {
  switch ((severity ?? '').toLowerCase()) {
    case 'critical': return 'critical';
    case 'major':    return 'major';
    default:         return 'minor';
  }
}

/**
 * Creates a smell card article element.
 *
 * @param {object} smell - A single smell object from Gemini's response.
 * @returns {HTMLElement}
 */
function createSmellCard(smell) {
  const severity = normaliseSeverity(smell.severity);

  const card = document.createElement('article');
  card.className = `smell-card severity-${severity}`;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label',
    `${smell.name ?? 'Code smell'} — severity ${smell.severity ?? 'Minor'}`);

  // Header row: name + severity badge + location
  const header = document.createElement('div');
  header.className = 'smell-card-header';

  const name = document.createElement('span');
  name.className = 'smell-name';
  name.textContent = smell.name ?? 'Unknown Smell';

  // NFR-03: severity uses both a colour class AND a visible text label
  const badge = document.createElement('span');
  badge.className = `severity-badge ${severity}`;
  badge.textContent = smell.severity ?? 'Minor';
  badge.setAttribute('aria-label', `Severity: ${smell.severity ?? 'Minor'}`);

  const location = document.createElement('span');
  location.className = 'smell-location';
  if (smell.location) {
    location.textContent = `📍 ${smell.location}`;
  }

  header.append(name, badge, location);

  const explanation = document.createElement('p');
  explanation.className = 'smell-explanation';
  explanation.textContent = smell.explanation ?? '';

  card.append(header, explanation);
  return card;
}

/**
 * Renders the smell-card list with severity colour-coding and text labels
 * (FR-03.1 – FR-03.5, NFR-03).
 *
 * @param {Array} smells - Array of smell objects from Gemini's response.
 */
function renderSmells(smells) {
  const count = smells.length;
  el.smellCountBadge.textContent =
    count === 0 ? '0 smells found'
    : count === 1 ? '1 smell found'
    : `${count} smells found`;

  // replaceChildren() clears children without touching innerHTML (avoids XSS pattern)
  el.smellsList.replaceChildren();

  if (count === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-smells-message';
    msg.textContent = '✓ No code smells detected.';
    el.smellsList.appendChild(msg);
    return;
  }

  for (const smell of smells) {
    el.smellsList.appendChild(createSmellCard(smell));
  }
}

/**
 * Renders original and refactored code blocks with syntax highlighting
 * (FR-04.1, FR-04.4). Both panes are displayed simultaneously side-by-side,
 * satisfying the "visible at the same time" acceptance criterion (AC-04.4).
 *
 * @param {string} originalCode    - The code the user submitted.
 * @param {string} refactoredCode  - The code returned by Gemini.
 * @param {string} language        - Language identifier for highlight.js.
 */
/** Maps user-facing language names to highlight.js language identifiers. */
const HL_LANG_MAP = {
  'javascript': 'javascript',
  'typescript': 'typescript',
  'python':     'python',
  'java':       'java',
  'c++':        'cpp',
  'go':         'go',
};

function renderCode(originalCode, refactoredCode, language) {
  const key    = (language ?? '').toLowerCase();
  const hlLang = HL_LANG_MAP[key] ?? (key && key !== 'auto' && key !== 'other' ? key : 'plaintext');

  function applyHighlight(codeEl, source) {
    codeEl.removeAttribute('class');
    codeEl.textContent = source;
    if (window.hljs) {
      codeEl.className = `language-${hlLang}`;
      window.hljs.highlightElement(codeEl);
    }
  }

  applyHighlight(el.originalCode,   originalCode);
  applyHighlight(el.refactoredCode, refactoredCode);
}

/**
 * Renders the complete analysis result and makes the results section visible.
 *
 * @param {object} result   - Parsed Gemini response ({ summary, smells, refactored_code }).
 * @param {string} code     - Original input code (for side-by-side display).
 * @param {string} language - Selected language identifier.
 */
export function renderResults(result, code, language) {
  renderSummary(result.summary);
  renderSmells(result.smells);
  renderCode(code, result.refactored_code, language);
  el.resultsSection.classList.remove('hidden');
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

/**
 * Copies text to the clipboard and shows "Copied!" feedback on the button
 * for 2 seconds before reverting (FR-04.2, FR-04.3).
 *
 * @param {string} text - The text to copy.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    el.copyBtn.textContent = 'Copied!';
    el.copyBtn.setAttribute('aria-label', 'Code copied to clipboard');
    setTimeout(() => {
      el.copyBtn.textContent = 'Copy to Clipboard';
      el.copyBtn.setAttribute('aria-label', 'Copy refactored code to clipboard');
    }, 2000);
  } catch {
    showError('Could not copy to clipboard. Please select and copy the code manually.');
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

/** Makes the follow-up chat panel visible after a successful analysis (FR-05.1). */
export function showChatPanel() {
  el.chatPanel.classList.remove('hidden');
}

/**
 * Creates a chat message wrapper element with label and bubble.
 *
 * @param {'user'|'gemini'} role
 * @param {string}          text
 * @returns {HTMLElement}
 */
function createChatMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;
  wrapper.setAttribute('aria-label', `${role === 'user' ? 'You' : 'Gemini'}: ${text}`);

  const label = document.createElement('span');
  label.className = 'chat-message-label';
  label.textContent = role === 'user' ? 'You' : 'Gemini';
  label.setAttribute('aria-hidden', 'true');

  const bubble = document.createElement('div');
  bubble.className = 'chat-message-bubble';
  bubble.textContent = text;

  wrapper.append(label, bubble);
  return wrapper;
}

/**
 * Appends a message bubble to the chat log (FR-05.3, FR-05.4).
 *
 * @param {'user'|'gemini'} role - Message author.
 * @param {string}          text - Message content.
 */
export function appendChatMessage(role, text) {
  el.chatLog.appendChild(createChatMessage(role, text));
  // Scroll the newest message into view
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

/**
 * Enables or disables the chat send button and input while a request is
 * in flight.
 *
 * @param {boolean} sending
 */
export function setChatSending(sending) {
  el.chatSendBtn.disabled    = sending;
  el.chatInput.disabled      = sending;
  el.chatSendBtn.textContent = sending ? '…' : 'Send';
}

/** Clears the chat question input field. */
export function clearChatInput() {
  el.chatInput.value = '';
}

// ─── Full reset ───────────────────────────────────────────────────────────────

/**
 * Resets the entire UI to its initial empty state (FR-06.2, AC-01.3).
 * Called when the user clicks "Clear".
 */
export function reset() {
  // Input
  el.codeInput.value         = '';
  el.languageSelect.value    = 'auto';
  el.codeInput.disabled      = false;
  el.languageSelect.disabled = false;
  updateCharCount(0);
  setAnalyzeButtonEnabled(false);

  // Error & loading
  hideError();
  el.loadingIndicator.classList.add('hidden');

  // Results — use replaceChildren() to clear safely (no innerHTML)
  el.resultsSection.classList.add('hidden');
  el.summaryText.textContent     = '';
  el.smellCountBadge.textContent = '';
  el.smellsList.replaceChildren();
  el.originalCode.textContent    = '';
  el.refactoredCode.textContent  = '';
  el.originalCode.removeAttribute('class');
  el.refactoredCode.removeAttribute('class');

  // Chat
  el.chatPanel.classList.add('hidden');
  el.chatLog.replaceChildren();
  el.chatInput.value             = '';
  el.chatInput.disabled          = false;
  el.chatSendBtn.disabled        = false;
  el.chatSendBtn.textContent     = 'Send';

  // Buttons
  el.analyzeBtn.disabled = true;
  el.clearBtn.disabled   = false;
}
