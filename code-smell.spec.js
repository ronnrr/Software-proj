const { test, expect } = require('@playwright/test');
const path = require('path');
test('code smell detector analyzes code and shows results', async ({ page }) => {
const filepath = path.join(__dirname, '..', 'index.html');
await page.goto('file://' + filepath);
const sampleCode = `function calculate(a, b) {
if (a > 0) {
if (b > 0) {
if (a > b) {
return a * 100;
}
}
}
return 0;
}`;
const fakeApiKey = 'test-api-key-12345';
await page.fill('#apikey', fakeApiKey);
await page.fill('#codeinput', sampleCode);
await page.route('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent*', async route => {
await route.fulfill({
status: 200,
contentType: 'application/json',
body: JSON.stringify({
candidates: [{
content: {
parts: [{
text: `SMELLS:
1. Deep nesting (3 levels) on lines 2-6
2. Magic number 100 on line 5
3. Poor variable names: a, b

REFACTORED:
function calculate(firstNumber, secondNumber) {
const MULTIPLIER = 100;
if (firstNumber <= 0 || secondNumber <= 0) return 0;
if (firstNumber > secondNumber) return firstNumber * MULTIPLIER;
return 0;
}`
}]
}
}]
})
});
});
await page.click('#analyzebtn');
await expect(page.locator('#loading')).toBeVisible();
await expect(page.locator('#results')).toBeVisible({ timeout: 5000 });
const smellsText = await page.locator('#smells').textContent();
expect(smellsText).toContain('Deep nesting');
expect(smellsText).toContain('Magic number');
const refactoredText = await page.locator('#refactored').textContent();
expect(refactoredText).toContain('MULTIPLIER');
expect(refactoredText).toContain('firstNumber');
});
