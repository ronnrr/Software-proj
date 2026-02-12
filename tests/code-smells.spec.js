import { test, expect } from '@playwright/test';

// ─── Sample input: code with obvious smells ────────────────────────────────
// Kept short deliberately — pressSequentially() types each character to
// trigger native input events; fewer chars means a faster test run.
const SMELLY_CODE =
  'function f(a,b,c,d,e) { if(a>0){} if(a>0){} if(a>0){} return a+b; }';

// ─── Mock Gemini response payload ──────────────────────────────────────────
// Structure mirrors what api.js parses:
//   data.candidates[0].content.parts[0].text  →  JSON string
//   JSON.parse(text)  →  { summary, smells[], refactored_code }
const MOCK_ANALYSIS = {
  summary:
    'Two code smells were detected: a long parameter list and duplicated conditional logic.',
  smells: [
    {
      name: 'Long Parameter List',
      severity: 'Major',
      location: 'function processUserData (line 1)',
      explanation:
        'The function accepts 6 parameters. Functions with more than 3–4 ' +
        'parameters are hard to understand and call correctly.',
    },
    {
      name: 'Duplicated Code',
      severity: 'Minor',
      location: 'lines 3–5',
      explanation:
        'The same conditional block is repeated three times. ' +
        'Extract it into a helper function to avoid divergence.',
    },
  ],
  refactored_code: `function processUserData({ name, age, email }) {
  const label = name + " " + age;
  if (age > 18) { console.log("adult"); }
  return label;
}`,
};

// ─── Test ──────────────────────────────────────────────────────────────────

test('full user flow: enter code → analyze → see smells and refactored output', async ({ page }) => {
  // ── 1. Mock config.json so the app boots without a real API key ──────────
  await page.route(/\/config\.json$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ gemini: { api_key: 'test-key-playwright' } }),
    })
  );

  // ── 2. Mock the Gemini API endpoint (no real network request) ────────────
  // api.js extracts: data.candidates[0].content.parts[0].text
  // That text is itself a JSON string which analyzeCode() then parses.
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

  // ── 3. Open the app ──────────────────────────────────────────────────────
  // Navigate to /src/ (with trailing slash) — serve treats it as a directory
  // and returns index.html directly without a redirect.  The trailing slash
  // keeps the document base URL as http://localhost:3000/src/, so the ES
  // module <script src="js/app.js"> resolves correctly to /src/js/app.js.
  await page.goto('/src/');

  // ── 4. Enter smelly code into the textarea ───────────────────────────────
  // pressSequentially() fires a real 'input' event per keystroke, which is
  // exactly what app.js listens for to enable the Analyze button (app.js:56).
  await page.locator('#code-input').pressSequentially(SMELLY_CODE);

  // The Analyze button is enabled only when code.length >= 10 (app.js:56)
  await expect(page.locator('#analyze-btn')).toBeEnabled({ timeout: 5_000 });

  // ── 5. Click Analyze ─────────────────────────────────────────────────────
  await page.locator('#analyze-btn').click();

  // ── 6. Wait for the results section to become visible ────────────────────
  // ui.js removes the 'hidden' class once renderResults() runs
  await expect(page.locator('#results-section')).not.toHaveClass(/hidden/, {
    timeout: 15_000,
  });

  // ── 7. Assert: summary text is rendered ──────────────────────────────────
  await expect(page.locator('#summary-text')).toContainText(
    'Two code smells were detected'
  );

  // ── 8. Assert: smell count badge ─────────────────────────────────────────
  await expect(page.locator('#smell-count-badge')).toHaveText('2 smells found');

  // ── 9. Assert: both smell cards appear with correct names ─────────────────
  const cards = page.locator('.smell-card');
  await expect(cards).toHaveCount(2);

  await expect(cards.first()).toContainText('Long Parameter List');
  await expect(cards.nth(1)).toContainText('Duplicated Code');

  // ── 10. Assert: severity badges are rendered ─────────────────────────────
  await expect(cards.first().locator('.severity-badge')).toContainText('Major');
  await expect(cards.nth(1).locator('.severity-badge')).toContainText('Minor');

  // ── 11. Assert: refactored code appears in the output pane ───────────────
  await expect(page.locator('#refactored-code')).toContainText('processUserData');
  await expect(page.locator('#refactored-code')).toContainText('name, age, email');

  // ── 12. Assert: original code is also rendered for comparison ────────────
  // #original-code shows the user's input verbatim, so assert against SMELLY_CODE
  await expect(page.locator('#original-code')).toContainText('function f(a,b,c,d,e)');
});
