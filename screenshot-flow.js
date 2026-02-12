/**
 * screenshot-flow.js
 *
 * Standalone Node.js script (ES module) that:
 *   1. Starts the static server (serve) on port 3001
 *   2. Opens the app in headless Chromium via Playwright
 *   3. Mocks config.json and the Gemini API (no real network requests)
 *   4. Captures screenshots/before.png  — empty app
 *   5. Fills the code input, clicks Analyze, waits for results
 *   6. Captures screenshots/after.png   — rendered results
 *   7. Stops the server and reports both file sizes
 *
 * Usage:
 *   node screenshot-flow.js
 */

import { chromium } from '@playwright/test';
import { spawn }    from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { resolve, dirname }   from 'node:path';
import { fileURLToPath }      from 'node:url';

// ── Paths ──────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = __dirname;
const PORT      = 3001;        // separate from the Playwright-test port (3000)
const BASE      = `http://localhost:${PORT}`;
const SHOTS_DIR = resolve(ROOT, 'screenshots');
const BEFORE    = resolve(SHOTS_DIR, 'before.png');
const AFTER     = resolve(SHOTS_DIR, 'after.png');

// ── Sample code — bad naming + deep nesting + magic numbers ────────────────
const SMELLY_CODE = `function d(x, y, z) {
  if (x > 0) {
    if (y > 0) {
      if (z > 0) {
        if (x + y > 100) {
          return x * 3.14159 + y * 2.71828;
        } else {
          return x + y + z + 42;
        }
      }
    }
  }
  return -1;
}`;

// ── Realistic mock that matches what api.js expects ─────────────────────────
//
// api.js parses:  data.candidates[0].content.parts[0].text
// That .text value is ITSELF a JSON string whose shape is:
//   { summary: string, smells: Smell[], refactored_code: string }
//
const MOCK_ANALYSIS = {
  summary:
    'The function d() contains three notable code smells: meaningless single-letter ' +
    'names for both the function and all parameters, four levels of deeply nested ' +
    'conditionals that hide the real logic, and multiple magic numbers whose purpose ' +
    'is impossible to determine from the source alone. Addressing all three will ' +
    'significantly improve readability and maintainability.',

  smells: [
    {
      name: 'Meaningless Names',
      severity: 'Major',
      location: 'function d, parameters x, y, z (line 1)',
      explanation:
        'Single-letter identifiers convey zero domain intent. ' +
        'Any future maintainer must guess what "d", "x", "y", and "z" represent, ' +
        'increasing the cognitive load on every read.',
    },
    {
      name: 'Deep Nesting',
      severity: 'Critical',
      location: 'function d, lines 2–11',
      explanation:
        'Four nested if-blocks push the real computation to a high indentation level ' +
        'and make every execution path difficult to reason about. ' +
        'Guard-clause refactoring (early return on invalid inputs) eliminates the ' +
        'nesting and makes the happy path immediately visible.',
    },
    {
      name: 'Magic Numbers',
      severity: 'Major',
      location: 'lines 6–9',
      explanation:
        'The literals 3.14159, 2.71828, 100, 42, and -1 appear without named constants. ' +
        'Their meaning, units, and origin are opaque. If any value needs to change, ' +
        'every occurrence must be located and updated individually — a maintenance hazard.',
    },
  ],

  refactored_code: [
    'const PI         = 3.14159;   // mathematical constant',
    'const EULER      = 2.71828;   // Euler\'s number',
    'const THRESHOLD  = 100;       // upper bound for combined x+y',
    'const EXTRA_TERM = 42;        // domain-specific addend',
    'const INVALID    = -1;        // sentinel for invalid inputs',
    '',
    '/**',
    ' * Computes a result based on three non-negative dimensions.',
    ' * @param {number} width',
    ' * @param {number} height',
    ' * @param {number} depth',
    ' * @returns {number}',
    ' */',
    'function computeResult(width, height, depth) {',
    '  if (width <= 0 || height <= 0 || depth <= 0) {',
    '    return INVALID;',
    '  }',
    '  if (width + height > THRESHOLD) {',
    '    return width * PI + height * EULER;',
    '  }',
    '  return width + height + depth + EXTRA_TERM;',
    '}',
  ].join('\n'),
};

// ── Server helpers ─────────────────────────────────────────────────────────

/** Spawns `serve . -l PORT` and returns the child process. */
function spawnServer() {
  return spawn(
    'node_modules/.bin/serve',
    ['.', '-l', String(PORT), '--no-clipboard'],
    { cwd: ROOT, stdio: 'pipe' }
  );
}

/**
 * Polls `url` until it responds with a 2xx, then resolves.
 * Retries up to `attempts` times with a 400 ms gap.
 */
async function waitReady(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* server not up yet */
    }
    await new Promise((res) => setTimeout(res, 400));
  }
  throw new Error(`Server at ${url} never became ready after ${attempts} attempts.`);
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  // Ensure screenshots directory exists
  mkdirSync(SHOTS_DIR, { recursive: true });

  // 1 ── Start server ───────────────────────────────────────────────────────
  console.log(`▶  Starting server  (port ${PORT}) …`);
  const server = spawnServer();
  server.on('error', (err) => { throw err; });

  try {
    await waitReady(`${BASE}/src/`);
    console.log('✔  Server ready');

    // 2 ── Launch browser ─────────────────────────────────────────────────
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    // 3 ── Mock config.json ───────────────────────────────────────────────
    // api.js fetches '../config.json' relative to /src/ → resolves to /config.json
    await page.route(/\/config\.json(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ gemini: { api_key: 'playwright-screenshot-key' } }),
      })
    );

    // 4 ── Mock Gemini API ────────────────────────────────────────────────
    // api.js reads: data.candidates[0].content.parts[0].text
    // That .text must be a JSON string of MOCK_ANALYSIS
    await page.route(/generativelanguage\.googleapis\.com/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(MOCK_ANALYSIS) }],
              },
            },
          ],
        }),
      })
    );

    // 5 ── Navigate & wait for JS to boot ────────────────────────────────
    await page.goto(`${BASE}/src/`);
    await page.waitForLoadState('networkidle');

    // 6 ── BEFORE screenshot (empty state) ───────────────────────────────
    await page.screenshot({ path: BEFORE, fullPage: true });
    console.log('📸  before.png saved');

    // 7 ── Fill the code textarea ─────────────────────────────────────────
    // fill() sets the value and fires the `input` event, which app.js
    // listens to for enabling the Analyze button (app.js:56).
    const textarea = page.locator('#code-input');
    await textarea.fill(SMELLY_CODE);

    // 8 ── Wait for Analyze button to become enabled ──────────────────────
    // app.js enables it only when code.length >= 10 (app.js:56)
    await page.waitForFunction(
      () => !document.getElementById('analyze-btn').disabled,
      { timeout: 5_000 }
    );

    // 9 ── Click Analyze ──────────────────────────────────────────────────
    await page.locator('#analyze-btn').click();

    // 10 ─ Wait for results section to appear ─────────────────────────────
    // ui.js removes the 'hidden' class from #results-section after rendering
    await page.waitForFunction(
      () => !document.getElementById('results-section').classList.contains('hidden'),
      { timeout: 15_000 }
    );

    // Short pause so syntax highlighting (hljs) finishes rendering
    await page.waitForTimeout(600);

    // 11 ─ AFTER screenshot (rendered results) ────────────────────────────
    await page.screenshot({ path: AFTER, fullPage: true });
    console.log('📸  after.png saved');

    await browser.close();
    console.log('✔  Browser closed');

  } finally {
    // 12 ─ Stop the server ─────────────────────────────────────────────────
    server.kill('SIGTERM');
    console.log('■  Server stopped');
  }

  // 13 ─ Confirm both files exist and are non-zero ───────────────────────
  console.log('\n── Screenshot report ──────────────────────────────');
  for (const [label, filePath] of [['before.png', BEFORE], ['after.png', AFTER]]) {
    const { size } = statSync(filePath);
    if (size === 0) throw new Error(`${label} is zero bytes!`);
    console.log(`  ✔  ${label}   ${(size / 1024).toFixed(1)} KB   ${filePath}`);
  }
  console.log('───────────────────────────────────────────────────\n');
})();
