const { test, expect } = require('@playwright/test');
const path = require('path');

const fileUrl = 'file://' + path.join(__dirname, '..', 'index.html');

test('detects deep nesting 3+ levels', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function calc(a, b) {
  if (a > 0) {
    if (b > 0) {
      if (a > b) {
        return a * 2;
      }
    }
  }
  return 0;
}`;
  const fakeApiKey = 'fake-key-1';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Deep nesting (3 levels) on lines 2-6

REFACTORED:
function calc(a, b) {
  if (a <= 0 || b <= 0) return 0;
  if (a > b) return a * 2;
  return 0;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Deep nesting');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('a <= 0');
});

test('detects magic numbers in calculations', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function area(r) {
  return r * r * 3.14 + 42;
}`;
  const fakeApiKey = 'fake-key-2';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Magic numbers 3.14 and 42 on line 2

REFACTORED:
function area(r) {
  const PI = 3.14;
  const OFFSET = 42;
  return r * r * PI + OFFSET;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Magic numbers');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('const PI');
});

test('detects poorly named variables', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function sum(a, b, x) {
  return a + b + x;
}`;
  const fakeApiKey = 'fake-key-3';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Poor variable names: a, b, x

REFACTORED:
function sum(firstNum, secondNum, extraNum) {
  return firstNum + secondNum + extraNum;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Poor variable names');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('firstNum');
});

test('detects long function over 20 lines', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function bigWork(n) {
  let total = 0;
  total += n;
  total += n + 1;
  total += n + 2;
  total += n + 3;
  total += n + 4;
  total += n + 5;
  total += n + 6;
  total += n + 7;
  total += n + 8;
  total += n + 9;
  total += n + 10;
  total += n + 11;
  total += n + 12;
  total += n + 13;
  total += n + 14;
  total += n + 15;
  total += n + 16;
  total += n + 17;
  total += n + 18;
  total += n + 19;
  return total;
}`;
  const fakeApiKey = 'fake-key-4';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Long function (over 20 lines)

REFACTORED:
function bigWork(n) {
  return sumRange(n, 20);
}
function sumRange(n, count) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += n + i;
  }
  return total;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Long function');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('sumRange');
});

test('detects repeated code blocks', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function pay(x) {
  if (x > 10) {
    return x * 2;
  }
  if (x > 10) {
    return x * 2;
  }
  return x;
}`;
  const fakeApiKey = 'fake-key-5';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Repeated code block on lines 2-6

REFACTORED:
function pay(x) {
  if (x > 10) return mulTwo(x);
  return x;
}
function mulTwo(x) {
  return x * 2;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Repeated code');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('mulTwo');
});

test('detects unused variables', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function pick(n) {
  const temp = n + 1;
  return n;
}`;
  const fakeApiKey = 'fake-key-6';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Unused variable: temp

REFACTORED:
function pick(n) {
  return n;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Unused variable');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return n;');
});

test('detects inconsistent naming conventions', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function get_user_data(userId) {
  const userName = 'Sam';
  return userName + userId;
}`;
  const fakeApiKey = 'fake-key-7';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Inconsistent naming (snake_case vs camelCase)

REFACTORED:
function getUserData(userId) {
  const userName = 'Sam';
  return userName + userId;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Inconsistent naming');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('getUserData');
});

test('detects missing return statements', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function pick(n) {
  if (n > 0) {
    return n;
  }
}`;
  const fakeApiKey = 'fake-key-8';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Missing return for some paths

REFACTORED:
function pick(n) {
  if (n > 0) return n;
  return 0;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Missing return');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return 0;');
});

test('detects unreachable code after return', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function done() {
  return 1;
  console.log('nope');
}`;
  const fakeApiKey = 'fake-key-9';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Unreachable code after return on line 3

REFACTORED:
function done() {
  return 1;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Unreachable code');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return 1;');
});

test('detects nested loops over two levels', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function box(a) {
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < a; j++) {
      for (let k = 0; k < a; k++) {
        console.log(i + j + k);
      }
    }
  }
}`;
  const fakeApiKey = 'fake-key-10';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Nested loops exceeding 2 levels

REFACTORED:
function box(a) {
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < a; j++) {
      logRow(i, j, a);
    }
  }
}
function logRow(i, j, a) {
  for (let k = 0; k < a; k++) {
    console.log(i + j + k);
  }
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Nested loops');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('logRow');
});

test('detects complex conditional chains', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function rate(x) {
  if (x === 1) return 'low';
  else if (x === 2) return 'mid';
  else if (x === 3) return 'high';
  else return 'none';
}`;
  const fakeApiKey = 'fake-key-11';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Complex if-else chain on lines 2-5

REFACTORED:
function rate(x) {
  const map = { 1: 'low', 2: 'mid', 3: 'high' };
  return map[x] || 'none';
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('if-else');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('const map');
});

test('detects globals used without params', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `let count = 3;
function add() {
  return count + 1;
}`;
  const fakeApiKey = 'fake-key-12';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Function uses global variable without parameters

REFACTORED:
function add(count) {
  return count + 1;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('global variable');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('function add(count)');
});

test('detects weak inline comments', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function fee(n) {
  // do it
  return n * 2;
}`;
  const fakeApiKey = 'fake-key-13';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Inline comment does not explain logic

REFACTORED:
function fee(n) {
  return n * 2;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Inline comment');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return n * 2;');
});

test('detects duplicated literal values', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function msg() {
  console.log('ERROR');
  return 'ERROR';
}`;
  const fakeApiKey = 'fake-key-14';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Duplicated literal value 'ERROR'

REFACTORED:
function msg() {
  const ERR = 'ERROR';
  console.log(ERR);
  return ERR;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Duplicated literal');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('const ERR');
});

test('detects single responsibility violations', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function save(data) {
  const json = JSON.stringify(data);
  console.log('saving');
  return json;
}`;
  const fakeApiKey = 'fake-key-15';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Function has multiple responsibilities (logging and formatting)

REFACTORED:
function save(data) {
  logSave();
  return toJson(data);
}
function logSave() {
  console.log('saving');
}
function toJson(data) {
  return JSON.stringify(data);
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('multiple responsibilities');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('logSave');
});

test('detects inconsistent indentation', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function ok(n) {
    if (n > 0) {
  return n;
    }
}`;
  const fakeApiKey = 'fake-key-16';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Inconsistent indentation on lines 2-4

REFACTORED:
function ok(n) {
  if (n > 0) {
    return n;
  }
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Inconsistent indentation');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return n;');
});

test('detects incorrect operator usage', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function same(a, b) {
  if (a == b) return true;
  return false;
}`;
  const fakeApiKey = 'fake-key-17';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Use of == instead of === on line 2

REFACTORED:
function same(a, b) {
  if (a === b) return true;
  return false;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('==');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('a === b');
});

test('detects missing semicolons', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function hi() {
  const n = 1
  return n
}`;
  const fakeApiKey = 'fake-key-18';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Missing semicolons on lines 2-3

REFACTORED:
function hi() {
  const n = 1;
  return n;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('Missing semicolons');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('return n;');
});

test('detects large switch/case blocks', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function color(n) {
  switch (n) {
    case 1: return 'red';
    case 2: return 'blue';
    case 3: return 'green';
    case 4: return 'pink';
    case 5: return 'orange';
    default: return 'none';
  }
}`;
  const fakeApiKey = 'fake-key-19';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. Large switch/case block

REFACTORED:
function color(n) {
  const map = { 1: 'red', 2: 'blue', 3: 'green', 4: 'pink', 5: 'orange' };
  return map[n] || 'none';
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('switch/case');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('const map');
});

test('detects high cyclomatic complexity', async ({ page }) => {
  await page.goto(fileUrl);
  const sampleCode = `function score(a, b, c) {
  if (a > 0) {
    if (b > 0) return 1;
    if (c > 0) return 2;
  }
  if (a === 0 && b === 0) return 3;
  return 0;
}`;
  const fakeApiKey = 'fake-key-20';
  await page.fill('#apikey', fakeApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.route('**/v1/models/gemini-2.5-flash:generateContent*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: `SMELLS:
1. High cyclomatic complexity

REFACTORED:
function score(a, b, c) {
  if (a > 0) return scorePositive(b, c);
  if (a === 0 && b === 0) return 3;
  return 0;
}
function scorePositive(b, c) {
  if (b > 0) return 1;
  if (c > 0) return 2;
  return 0;
}`
            }]
          }
        }]
      })
    });
  });
  await page.click('#analyzebtn');
  await expect(page.locator('#results')).toBeVisible({ timeout: 5000 }); // tiny wait so it can wake up
  const smellText = await page.locator('#smells').textContent();
  expect(smellText).toContain('cyclomatic');
  const refacText = await page.locator('#refactored').textContent();
  expect(refacText).toContain('scorePositive');
});
