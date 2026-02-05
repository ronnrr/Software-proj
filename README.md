# Code Smell Detector

Web-based tool that analyzes code for common smells and provides refactored versions using Google Gemini API.

## Project Overview

Single-page application that detects code quality issues including long methods, magic numbers, poor variable names, deep nesting, and duplicate code. Uses Gemini Pro model for intelligent analysis and refactoring suggestions.

## Installation

1. Clone or download project files
2. No build process required - pure vanilla JavaScript
3. Get Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

**For Testing:**
```bash
npm install
npx playwright install
npm test
```

## Usage Example

1. Open `index.html` in web browser
2. Enter Gemini API key in top field
3. Paste code into textarea
4. Click "Analyze Code"
5. View detected smells in left panel
6. View refactored code in right panel

**Screenshot locations (if adding):**
- Initial interface: Shows empty form with API key input
- Analysis results: Shows split view with smells and refactored code

## Key Files

| File | Description |
|------|-------------|
| `index.html` | Main page structure with input fields and result panels |
| `styles.css` | Grid layout styling for split-view results display |
| `script.js` | Gemini API integration and DOM manipulation logic |
| `tests/code-smell.spec.js` | Playwright end-to-end test for user workflow |
| `playwright.config.js` | Test configuration file |
| `package.json` | Dependencies for testing |

## Project Phases

### Phase 1: Requirements Engineering
Defined functional requirements and acceptance criteria for code smell detection feature.

### Phase 2: Architecture
Designed client-side architecture with Gemini API integration. Structured prompt format to ensure consistent response parsing.

### Phase 3: Coding
Implemented vanilla JavaScript SPA with fetch API calls to Gemini. Used structured prompt with "SMELLS:" and "REFACTORED:" sections for reliable parsing.

### Phase 4: Testing
Created Playwright test covering full user journey with mocked API responses. Validates input handling, async operations, and result display.

### Phase 5: Documentation
Generated this README with installation instructions and project structure overview.

## Technical Notes

- No server required - runs entirely client-side
- API key stored in memory only (not persisted)
- Response parsing uses string split on section markers
- Error handling for network failures and missing inputs
- Grid CSS layout for responsive split-view results

## Common Code Smells Detected

- Long methods (>20 lines)
- Magic numbers
- Poor variable naming
- Deep nesting (>3 levels)
- Duplicate code blocks
