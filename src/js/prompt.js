/**
 * prompt.js — Gemini prompt templates
 *
 * Single source of truth for all prompt content sent to the Gemini API
 * (satisfies NFR-05). To change the analysis schema or wording, edit only
 * this file — no other module needs to change.
 *
 * Exports:
 *   buildAnalysisPrompt(code, language)  → string
 *   buildFollowUpPrompt(question, originalCode, analysisResult)  → string
 */

// ─── JSON schema embedded in the analysis prompt ─────────────────────────────

const ANALYSIS_SCHEMA = `{
  "summary": "<2-3 sentence overall assessment>",
  "smells": [
    {
      "name": "<smell name>",
      "severity": "<Critical | Major | Minor>",
      "location": "<function name, line range, or description>",
      "explanation": "<why this is a problem and its impact>"
    }
  ],
  "refactored_code": "<complete refactored source code as a string>"
}`;

// ─── Public builders ──────────────────────────────────────────────────────────

/**
 * Builds the initial code-smell analysis prompt (FR-02.2, FR-02.3).
 *
 * @param {string} code     - Raw source code to analyse.
 * @param {string} language - Language identifier (e.g. "Python"), or "auto".
 * @returns {string} Complete prompt ready to send to Gemini.
 */
export function buildAnalysisPrompt(code, language) {
  const langDisplay = (language && language !== 'auto' && language !== 'other')
    ? language
    : 'the following';

  const langFence = (language && language !== 'auto' && language !== 'other')
    ? language
    : '';

  return `You are a senior software engineer specialising in code quality.

Analyse the following ${langDisplay} code for code smells.
Return your response as valid JSON matching this exact schema:

${ANALYSIS_SCHEMA}

Rules:
- If no code smells are found, return an empty smells array.
- severity MUST be exactly one of: Critical, Major, Minor.
- refactored_code must contain the complete, runnable refactored source.
- Do NOT include markdown fences or any text outside the JSON object.

Code to analyse:
\`\`\`${langFence}
${code}
\`\`\``;
}

/**
 * Builds a follow-up chat prompt that includes the prior analysis as context
 * (FR-05.2).
 *
 * @param {string} question       - The user's follow-up question.
 * @param {string} originalCode   - The original source code that was analysed.
 * @param {object} analysisResult - The parsed JSON result from the initial analysis.
 * @returns {string} Complete prompt ready to send to Gemini.
 */
export function buildFollowUpPrompt(question, originalCode, analysisResult) {
  return `You previously analysed the following code and produced this result:

${JSON.stringify(analysisResult, null, 2)}

Original code:
\`\`\`
${originalCode}
\`\`\`

The user now asks: ${question}

Answer conversationally. You may reference specific smells by name or line number.
Be concise, clear, and helpful. Do not return JSON — respond in plain English.`;
}
