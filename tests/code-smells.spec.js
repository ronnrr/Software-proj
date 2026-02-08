// Code Smells Detector - 20 Functional Tests
// Student-style: simple, readable, concise

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// read api key from config.json (we need it for the test)
const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const realApiKey = config.gemini.api_key;

// helper to mock gemini api response
async function mockGeminiResponse(page, smellsText, refactoredCode) {
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: `SMELLS:\n${smellsText}\n\nREFACTORED:\n${refactoredCode}`
          }]
        }
      }]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse)
    });
  });
}

// Test 1: Detect deep nesting (3+ levels)
test('detect deep nesting in function', async ({ page }) => {
  const sampleCode = `function process(data) {
  if (data) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].active) {
        if (data[i].value > 10) {
          console.log(data[i]);
        }
      }
    }
  }
}`;
  const expectedSmells = '- Deep nesting detected at line 4-6 (4 levels deep)';
  const expectedRefactored = `function process(data) {
  if (!data) return;
  const activeItems = data.filter(item => item.active && item.value > 10);
  activeItems.forEach(item => console.log(item));
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  // magic wait for results to appear
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Deep nesting');
  expect(resultCode).toContain('filter');
});

// Test 2: Detect magic numbers
test('detect magic numbers in calculations', async ({ page }) => {
  const sampleCode = `function calculatePrice(qty) {
  return qty * 19.99 + 5.50 + qty * 0.08;
}`;
  const expectedSmells = '- Magic number 19.99 at line 2\n- Magic number 5.50 at line 2\n- Magic number 0.08 at line 2';
  const expectedRefactored = `const UNIT_PRICE = 19.99;
const SHIPPING_COST = 5.50;
const TAX_RATE = 0.08;

function calculatePrice(qty) {
  return qty * UNIT_PRICE + SHIPPING_COST + qty * TAX_RATE;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Magic number');
  expect(resultCode).toContain('UNIT_PRICE');
});

// Test 3: Detect poorly named variables
test('detect poorly named variables', async ({ page }) => {
  const sampleCode = `function calc(a, b, x) {
  let y = a + b;
  let z = y * x;
  return z;
}`;
  const expectedSmells = '- Poor variable name: a, b, x, y, z (not descriptive)';
  const expectedRefactored = `function calculateTotal(price, quantity, taxRate) {
  let subtotal = price + quantity;
  let total = subtotal * taxRate;
  return total;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Poor variable name');
  expect(resultCode).toContain('calculateTotal');
});

// Test 4: Detect long function (>20 lines)
test('detect long function over 20 lines', async ({ page }) => {
  const sampleCode = `function processOrder(order) {
  let total = 0;
  let discount = 0;
  let tax = 0;
  let shipping = 0;
  let finalTotal = 0;
  // line 7
  // line 8
  // line 9
  // line 10
  // line 11
  // line 12
  // line 13
  // line 14
  // line 15
  // line 16
  // line 17
  // line 18
  // line 19
  // line 20
  // line 21
  // line 22
  return finalTotal;
}`;
  const expectedSmells = '- Long function: processOrder has 24 lines (recommended: <20)';
  const expectedRefactored = `function calculateTotal(order) {
  return order.items.reduce((sum, item) => sum + item.price, 0);
}

function applyDiscount(total, code) {
  return total * 0.9;
}

function processOrder(order) {
  const total = calculateTotal(order);
  return applyDiscount(total);
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Long function');
  expect(resultCode).toContain('calculateTotal');
});

// Test 5: Detect repeated code blocks
test('detect repeated code blocks', async ({ page }) => {
  const sampleCode = `function formatUser(user) {
  console.log(user.name.toUpperCase());
  console.log(user.email.toLowerCase());
}
function formatAdmin(admin) {
  console.log(admin.name.toUpperCase());
  console.log(admin.email.toLowerCase());
}`;
  const expectedSmells = '- Duplicate code: lines 2-3 and 6-7 are identical patterns';
  const expectedRefactored = `function formatPerson(person) {
  console.log(person.name.toUpperCase());
  console.log(person.email.toLowerCase());
}

function formatUser(user) {
  formatPerson(user);
}

function formatAdmin(admin) {
  formatPerson(admin);
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Duplicate code');
  expect(resultCode).toContain('formatPerson');
});

// Test 6: Detect unused variables
test('detect unused variables', async ({ page }) => {
  const sampleCode = `function calculate(x) {
  let unused = 42;
  let temp = 10;
  return x * 2;
}`;
  const expectedSmells = '- Unused variable: unused at line 2\n- Unused variable: temp at line 3';
  const expectedRefactored = `function calculate(x) {
  return x * 2;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Unused variable');
  expect(resultCode).not.toContain('unused');
});

// Test 7: Detect inconsistent naming conventions
test('detect inconsistent naming conventions', async ({ page }) => {
  const sampleCode = `function getUserData() {
  let user_name = 'John';
  let userAge = 25;
  let user_email = 'test@test.com';
  return { user_name, userAge, user_email };
}`;
  const expectedSmells = '- Inconsistent naming: mixing snake_case (user_name, user_email) with camelCase (userAge)';
  const expectedRefactored = `function getUserData() {
  let userName = 'John';
  let userAge = 25;
  let userEmail = 'test@test.com';
  return { userName, userAge, userEmail };
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Inconsistent naming');
  expect(resultCode).toContain('userName');
});

// Test 8: Detect missing return statements
test('detect missing return in function', async ({ page }) => {
  const sampleCode = `function add(a, b) {
  let result = a + b;
  console.log(result);
}`;
  const expectedSmells = '- Missing return statement in function add';
  const expectedRefactored = `function add(a, b) {
  let result = a + b;
  console.log(result);
  return result;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Missing return');
  expect(resultCode).toContain('return result');
});

// Test 9: Detect unreachable code after return
test('detect unreachable code after return', async ({ page }) => {
  const sampleCode = `function getValue() {
  return 42;
  console.log('This never runs');
  let x = 10;
}`;
  const expectedSmells = '- Unreachable code at lines 3-4 (after return statement)';
  const expectedRefactored = `function getValue() {
  return 42;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Unreachable code');
  expect(resultCode).not.toContain('This never runs');
});

// Test 10: Detect nested loops exceeding 2 levels
test('detect nested loops over 2 levels', async ({ page }) => {
  const sampleCode = `function processMatrix(matrix) {
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      for (let k = 0; k < matrix[i][j].length; k++) {
        console.log(matrix[i][j][k]);
      }
    }
  }
}`;
  const expectedSmells = '- Nested loops exceed 2 levels (3 levels detected at lines 2-6)';
  const expectedRefactored = `function processMatrix(matrix) {
  matrix.flat(2).forEach(item => console.log(item));
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Nested loops');
  expect(resultCode).toContain('flat');
});

// Test 11: Detect complex conditional chains
test('detect complex if-else chains', async ({ page }) => {
  const sampleCode = `function getDiscount(type) {
  if (type === 'gold') {
    return 0.3;
  } else if (type === 'silver') {
    return 0.2;
  } else if (type === 'bronze') {
    return 0.1;
  } else if (type === 'member') {
    return 0.05;
  } else {
    return 0;
  }
}`;
  const expectedSmells = '- Complex conditional chain: 5 branches in if-else (consider using object map)';
  const expectedRefactored = `function getDiscount(type) {
  const discounts = {
    gold: 0.3,
    silver: 0.2,
    bronze: 0.1,
    member: 0.05
  };
  return discounts[type] || 0;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Complex conditional');
  expect(resultCode).toContain('discounts');
});

// Test 12: Detect functions using globals without params
test('detect function using globals', async ({ page }) => {
  const sampleCode = `let globalUser = { name: 'John' };
let globalConfig = { debug: true };

function printUser() {
  console.log(globalUser.name);
  if (globalConfig.debug) {
    console.log('Debug mode');
  }
}`;
  const expectedSmells = '- Function printUser uses global variables (globalUser, globalConfig) without parameters';
  const expectedRefactored = `function printUser(user, config) {
  console.log(user.name);
  if (config.debug) {
    console.log('Debug mode');
  }
}

// Usage: printUser(globalUser, globalConfig);`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('global');
  expect(resultCode).toContain('function printUser(user, config)');
});

// Test 13: Detect inline comments not explaining logic
test('detect useless inline comments', async ({ page }) => {
  const sampleCode = `function add(a, b) {
  // add a and b
  let sum = a + b;
  // return sum
  return sum;
}`;
  const expectedSmells = '- Useless comments at lines 2 and 4 (comments repeat code, not explain logic)';
  const expectedRefactored = `function add(a, b) {
  let sum = a + b;
  return sum;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Useless comments');
  expect(resultCode).not.toContain('// add a and b');
});

// Test 14: Detect duplicated literal values
test('detect duplicated literals', async ({ page }) => {
  const sampleCode = `function createUser() {
  return { status: 'active', role: 'active', flag: 'active' };
}
function updateUser() {
  return { status: 'active' };
}`;
  const expectedSmells = '- Duplicated literal "active" appears 4 times (consider using constant)';
  const expectedRefactored = `const STATUS_ACTIVE = 'active';

function createUser() {
  return { status: STATUS_ACTIVE, role: STATUS_ACTIVE, flag: STATUS_ACTIVE };
}
function updateUser() {
  return { status: STATUS_ACTIVE };
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Duplicated literal');
  expect(resultCode).toContain('STATUS_ACTIVE');
});

// Test 15: Detect single responsibility violation
test('detect single responsibility violation', async ({ page }) => {
  const sampleCode = `function handleUser(user) {
  // validate
  if (!user.email.includes('@')) throw new Error('Invalid email');
  // save to db
  database.save(user);
  // send email
  emailService.send(user.email, 'Welcome!');
  // log
  logger.log('User created: ' + user.id);
}`;
  const expectedSmells = '- Function handleUser violates Single Responsibility Principle (validates, saves, emails, logs)';
  const expectedRefactored = `function validateUser(user) {
  if (!user.email.includes('@')) throw new Error('Invalid email');
}

function saveUser(user) {
  database.save(user);
}

function sendWelcomeEmail(email) {
  emailService.send(email, 'Welcome!');
}

function logUserCreation(userId) {
  logger.log('User created: ' + userId);
}

function handleUser(user) {
  validateUser(user);
  saveUser(user);
  sendWelcomeEmail(user.email);
  logUserCreation(user.id);
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Single Responsibility');
  expect(resultCode).toContain('validateUser');
});

// Test 16: Detect inconsistent indentation
test('detect inconsistent indentation', async ({ page }) => {
  const sampleCode = `function messy() {
  let x = 1;
    let y = 2;
 let z = 3;
      return x + y + z;
}`;
  const expectedSmells = '- Inconsistent indentation: lines 2-5 have mixed spacing (2, 4, 1, 6 spaces)';
  const expectedRefactored = `function messy() {
  let x = 1;
  let y = 2;
  let z = 3;
  return x + y + z;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Inconsistent indentation');
  expect(resultCode).toContain('let x = 1;');
});

// Test 17: Detect == vs === usage
test('detect loose equality operator', async ({ page }) => {
  const sampleCode = `function checkValue(val) {
  if (val == null) return false;
  if (val == 0) return false;
  if (val == '') return false;
  return true;
}`;
  const expectedSmells = '- Using loose equality (==) instead of strict (===) at lines 2, 3, 4';
  const expectedRefactored = `function checkValue(val) {
  if (val === null || val === undefined) return false;
  if (val === 0) return false;
  if (val === '') return false;
  return true;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('loose equality');
  expect(resultCode).toContain('===');
});

// Test 18: Detect missing semicolons
test('detect missing semicolons', async ({ page }) => {
  const sampleCode = `function greet(name) {
  let msg = 'Hello'
  msg = msg + ' ' + name
  return msg
}`;
  const expectedSmells = '- Missing semicolons at lines 2, 3, 4';
  const expectedRefactored = `function greet(name) {
  let msg = 'Hello';
  msg = msg + ' ' + name;
  return msg;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Missing semicolons');
  expect(resultCode).toContain("let msg = 'Hello';");
});

// Test 19: Detect large switch/case blocks
test('detect large switch case blocks', async ({ page }) => {
  const sampleCode = `function getDayName(num) {
  switch(num) {
    case 1: return 'Monday';
    case 2: return 'Tuesday';
    case 3: return 'Wednesday';
    case 4: return 'Thursday';
    case 5: return 'Friday';
    case 6: return 'Saturday';
    case 7: return 'Sunday';
    default: return 'Unknown';
  }
}`;
  const expectedSmells = '- Large switch block with 8 cases (consider using object lookup)';
  const expectedRefactored = `function getDayName(num) {
  const days = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday'
  };
  return days[num] || 'Unknown';
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('Large switch');
  expect(resultCode).toContain('const days');
});

// Test 20: Detect high cyclomatic complexity
test('detect high cyclomatic complexity', async ({ page }) => {
  const sampleCode = `function process(a, b, c) {
  if (a > 0) {
    if (b > 0) {
      return a + b;
    } else if (b < 0) {
      return a - b;
    }
  } else if (a < 0) {
    if (c) {
      return c;
    } else {
      return 0;
    }
  }
  return -1;
}`;
  const expectedSmells = '- High cyclomatic complexity: 6 decision points in function process';
  const expectedRefactored = `function process(a, b, c) {
  if (a > 0 && b > 0) return a + b;
  if (a > 0 && b < 0) return a - b;
  if (a < 0 && c) return c;
  if (a < 0) return 0;
  return -1;
}`;

  await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await mockGeminiResponse(page, expectedSmells, expectedRefactored);
  
  await page.fill('#apikey', realApiKey);
  await page.fill('#codeinput', sampleCode);
  await page.click('#analyzebtn');
  
  // tiny wait for results - like waiting for cookies to bake
  await page.waitForSelector('#results:not(.hidden)', { timeout: 5000 });
  
  const resultSmells = await page.textContent('#smells');
  const resultCode = await page.textContent('#refactored');
  
  expect(resultSmells).toContain('cyclomatic complexity');
  expect(resultCode).toContain('if (a > 0 && b > 0)');
});
