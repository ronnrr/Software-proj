# Code Smell Detector - Test Documentation

## Overview
This test suite contains 20 functional tests for the Code Smell Detector SPA.
Each test verifies a unique code smell detection scenario.

## How to Run Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Or run with Playwright directly
npx playwright test

# Run with visible browser
npx playwright test --headed

# Run specific test
npx playwright test -g "detect deep nesting"
```

## Test Files

| Test File | Purpose |
|-----------|---------|
| tests/codeSmells.spec.js | All 20 functional tests for code smell detection |

## Test Cases Summary

| # | Test Case | What It Checks |
|---|-----------|----------------|
| 1 | Deep nesting | Functions with 3+ nesting levels |
| 2 | Magic numbers | Hardcoded numbers in calculations |
| 3 | Poor variable names | Single-letter or non-descriptive names |
| 4 | Long function | Functions exceeding 20 lines |
| 5 | Repeated code | Duplicate code blocks |
| 6 | Unused variables | Declared but never used variables |
| 7 | Naming conventions | Mixed camelCase and snake_case |
| 8 | Missing return | Functions without return statements |
| 9 | Unreachable code | Code after return statements |
| 10 | Nested loops | More than 2 levels of loop nesting |
| 11 | Complex conditionals | Long if-else if chains |
| 12 | Global usage | Functions using globals without params |
| 13 | Useless comments | Comments that repeat the code |
| 14 | Duplicated literals | Same string/number used multiple times |
| 15 | Single responsibility | Functions doing too many things |
| 16 | Inconsistent indentation | Mixed spacing in code |
| 17 | Loose equality | Using == instead of === |
| 18 | Missing semicolons | Statements without semicolons |
| 19 | Large switch blocks | Switch with many cases |
| 20 | Cyclomatic complexity | Too many decision points |

## Test Approach

- **Mocking**: All Gemini API calls are mocked to ensure reproducibility
- **Assertions**: Each test verifies both smell detection and refactored code
- **Student-style**: Simple, readable, concise code structure
- **No network calls**: Tests run entirely offline with mocked responses

## Configuration

Tests read the API key from `config.json`:
```json
{
  "gemini": {
    "api_key": "your_api_key_here"
  }
}
```

The key is used to fill the input field but API calls are mocked.
