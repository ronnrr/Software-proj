# Architecture: Automatic Code Smells Detector & Refactorer

**Project:** 22916 Software Engineering — Phase 2
**Version:** 1.0
**Date:** 2026-02-12
**Team size:** 3

---

## 1. Overall Architecture

The application is a **single-page application (SPA)** that runs entirely in the browser. There is no application backend. All logic lives in static files (HTML, CSS, JavaScript) served by a minimal local HTTP server. The browser calls the Google Gemini REST API directly.

```
┌─────────────────────────────────────────────┐
│              Browser (localhost)            │
│                                             │
│  ┌──────────┐   ┌──────────┐  ┌──────────┐ │
│  │  Input   │   │ Results  │  │   Chat   │ │
│  │  Panel   │   │  Panel   │  │  Panel   │ │
│  └────┬─────┘   └────▲─────┘  └────▲─────┘ │
│       │              │              │       │
│  ┌────▼──────────────┴──────────────┴─────┐ │
│  │          app.js  /  ui.js / state.js   │ │
│  └────────────────────┬───────────────────┘ │
│                       │ fetch (HTTPS)        │
│  ┌────────────────────▼───────────────────┐ │
│  │           api.js  /  prompt.js         │ │
│  └────────────────────┬───────────────────┘ │
└───────────────────────│─────────────────────┘
                        │
          ┌─────────────▼─────────────┐
          │  Google Gemini REST API   │
          │  (generativelanguage.     │
          │   googleapis.com)         │
          └───────────────────────────┘
```

**How to run (no installation required):**
```bash
# From the repository root:
python -m http.server 8080
# Then open: http://localhost:8080/src/
```

> A local HTTP server is required — not for any backend logic, but because browsers
> block `fetch()` and ES module imports on `file://` origins (CORS policy). A
> one-line Python command is sufficient.

---

## 2. Technology Stack

| Layer | Choice | Justification |
|---|---|---|
| **Markup** | HTML5 | Standard; no compilation needed |
| **Styling** | CSS3 (custom properties, flexbox/grid) | No build step; sufficient for the UI complexity |
| **Logic** | Vanilla JavaScript — ES2022+ modules | Avoids framework overhead and a build pipeline; the lecturer runs the app by opening a URL, not running `npm install` |
| **Syntax highlighting** | highlight.js (loaded from CDN) | Single `<link>` + `<script>` tag; no bundler needed; provides highlighting for all required languages |
| **Local server** | Python `http.server` (built-in) | Zero extra installation; already available on any Python-equipped machine |
| **API** | Google Gemini REST API (`gemini-2.0-flash`) | Mandated by requirements; `gemini-2.0-flash` is fast and cost-efficient for code analysis |

**Why no React / Vue / Svelte?**
Frameworks add value when an app has many interdependent reactive views. Here the state transitions are linear (idle → loading → results → chat). Managing this with a plain JS state object and targeted DOM updates is simpler and produces zero build-tool friction for the person grading the project.

---

## 3. Frontend / Backend Responsibilities

**Decision: frontend-only.**

| Concern | Location | Reason |
|---|---|---|
| UI rendering | Browser | Only actor is the local developer; no multi-user concurrency |
| API calls to Gemini | Browser (`api.js`) | Localhost: no CORS issue calling external APIs from the browser |
| API key storage | `config.json` (root) | Read at startup via `fetch`; gitignored so it is never committed |
| Session state | In-memory JS object | FR-06.1 requires persistence within a session, not across reloads; `sessionStorage` or a plain object both work — we use a plain object for simplicity |
| Chat export | Browser download (`Blob` + `<a download>`) | FR-05.5 requires a `.txt` download; no server write access needed |

**There is no Node/Express/Python server.** A backend would add complexity (another process, another port, CORS configuration) with no benefit on a single-user localhost app.

---

## 4. LLM Integration Model

### Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```

### Authentication

The API key is sent in the **`x-goog-api-key` HTTP header** — never in the URL query string. This satisfies NFR-04 (key must not appear in the network request URL or the browser console).

```javascript
fetch(GEMINI_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey         // header, not URL param
  },
  body: JSON.stringify(requestBody),
  signal: AbortSignal.timeout(30_000) // FR-02.6: 30-second timeout
})
```

### Forcing Structured JSON Output

The request body sets `response_mime_type` to `"application/json"` so Gemini constrains its output to valid JSON, avoiding the need to strip markdown fences:

```json
{
  "generationConfig": {
    "response_mime_type": "application/json"
  },
  "contents": [{ "parts": [{ "text": "..." }] }]
}
```

### Prompt Structure

Defined in `src/js/prompt.js` as a single exported constant (satisfies NFR-05). Two prompt builders are exported:

**`buildAnalysisPrompt(code, language)`** — initial analysis:

```
You are a senior software engineer specialising in code quality.

Analyse the following {LANGUAGE} code for code smells.
Return your response as valid JSON matching this exact schema:

{
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
}

If no code smells are found, return an empty smells array.
Do NOT include markdown fences or any text outside the JSON object.

Code to analyse:
```{LANGUAGE}
{CODE}
```
```

**`buildFollowUpPrompt(question, originalCode, analysisResult)`** — follow-up chat:

```
You previously analysed the following {LANGUAGE} code and produced this result:
{ANALYSIS_JSON}

The user now asks: {QUESTION}

Answer conversationally. You may reference specific smells by name or line.
```

### Response Parsing

`api.js` parses the response as:

```
response.candidates[0].content.parts[0].text → JSON.parse()
```

If `JSON.parse` throws, the error handler surfaces FR-02.7(c): "Malformed response from Gemini."

---

## 5. Data Flow

```
User action                  app.js              api.js / prompt.js       Gemini API
──────────                   ──────               ──────────────────       ──────────
App loads          ──────►  fetch config.json
                             store apiKey
                             enable UI

User pastes code
+ selects language
+ clicks "Analyze" ──────►  validate input
                             disable button
                             show spinner    ──►  buildAnalysisPrompt()
                                             ──►  POST /generateContent
                                                  (30s timeout)
                                             ◄──  200 OK  { candidates: [...] }
                             parse JSON
                             update state
                             hide spinner
                             render results  ──►  ui.renderSmells()
                                             ──►  ui.renderRefactoredCode()
                                             ──►  ui.showChatPanel()

User types follow-up
+ clicks Send      ──────►  append to chat  ──►  buildFollowUpPrompt()
                                             ──►  POST /generateContent
                             append response ──►  ui.appendChatMessage()

User clicks
"Export Chat"      ──────►  state.getChatLog()
                             Blob download (.txt)

User clicks
"Clear"            ──────►  state.reset()
                             ui.reset()
```

---

## 6. File Structure

```
/                             ← repository root (serve from here)
├── config.json               ← API key at runtime (gitignored — never committed)
├── config.example.json       ← Template: copy to config.json and add key
├── docs/
│   ├── requirements.md       ← Phase 1 deliverable
│   └── architecture.md       ← Phase 2 deliverable (this file)
├── src/                      ← ALL application source code
│   ├── index.html            ← Single HTML page; imports all JS modules and CSS
│   ├── css/
│   │   └── styles.css        ← All styles: layout, panels, severity colours,
│   │                            loading spinner, chat log, responsive behaviour
│   └── js/
│       ├── app.js            ← Entry point: reads config, binds all event
│       │                        listeners, orchestrates module calls
│       ├── api.js            ← Gemini API wrapper: loadConfig(), analyzeCode(),
│       │                        sendFollowUp(); handles timeout and HTTP errors
│       ├── prompt.js         ← Prompt templates: buildAnalysisPrompt(),
│       │                        buildFollowUpPrompt(); single source of truth
│       │                        for prompt content (NFR-05)
│       ├── state.js          ← In-memory session state: current code, smells,
│       │                        refactored code, chat history; reset()
│       └── ui.js             ← All DOM manipulation: renderSmells(),
│                                renderRefactoredCode(), appendChatMessage(),
│                                showError(), setLoading(), reset()
├── chats/                    ← Convention directory; exported .txt logs land here
│                                via browser download dialog
├── screenshots/              ← Project screenshots (documentation)
└── tests/                    ← Manual test scripts / future automated tests
```

**Key decisions in the file structure:**
- `prompt.js` is isolated so changing the prompt template requires editing exactly one file (NFR-05).
- `api.js` owns all network code; other modules never call `fetch` directly. This makes error handling and timeout logic centralised.
- `state.js` is a plain object module — no class, no reactive proxy. The app's state machine is simple enough that explicit `state.set*` calls are clearer than reactivity magic.

---

## 7. Third-Party Libraries

| Library | Version | How loaded | Purpose | Justification |
|---|---|---|---|---|
| **highlight.js** | 11.x (latest stable) | CDN `<link>` + `<script>` in `index.html` | Syntax highlighting for the refactored code block (FR-04.1) | Industry-standard; zero build step; supports all languages named in requirements; ~50 kB minified |

**Nothing else.** All other requirements (fetch, AbortSignal.timeout, Blob download, clipboard API) are implemented via standard Web APIs available in the latest stable Chrome and Firefox (NFR-06). Adding a UI framework, a CSS framework, or a fetch wrapper library would be over-engineering for a ~300-line app.

---

## 8. Team Member Responsibilities

The work is divided into three vertical slices, each owning a cohesive part of the app.

### Member 1 — Input & API Integration
**Owner of:** `src/js/api.js`, `src/js/prompt.js`, `src/index.html` (HTML skeleton), `config.example.json`

| Task | FR / NFR |
|---|---|
| `index.html` structure: panels, form elements, ARIA labels | FR-01, NFR-03 |
| `config.example.json` template | FR-02.4 |
| `api.js`: `loadConfig()` — reads and validates `config.json` | FR-02.4, AC-02.3 |
| `api.js`: `analyzeCode()` — builds request, sets `x-goog-api-key` header, 30s `AbortSignal` timeout | FR-02.1 – FR-02.6, NFR-04 |
| `api.js`: Error classification (missing key, network, malformed JSON, rate limit) | FR-02.7 |
| `prompt.js`: `buildAnalysisPrompt()` and `buildFollowUpPrompt()` constants | FR-02.2, FR-02.3, NFR-05 |
| Character counter and Analyze button enable/disable logic | FR-01.2, FR-01.3, FR-01.7 |

---

### Member 2 — Results Display
**Owner of:** `src/js/ui.js`, `src/css/styles.css`

| Task | FR / NFR |
|---|---|
| `ui.renderSmells()` — smell card list with severity colour-coding and text labels | FR-03.1 – FR-03.6, NFR-03 |
| `ui.renderRefactoredCode()` — monospace code block, highlight.js integration | FR-04.1 |
| Side-by-side / tabbed comparison of original vs refactored code | FR-04.4 |
| Copy-to-clipboard button with "Copied!" feedback | FR-04.2, FR-04.3 |
| Loading spinner and disabled-state styles | FR-02.5 |
| `ui.showError()` — human-readable error display | FR-02.7 |
| Full `styles.css`: layout, severity colours (red/amber/blue), responsive grid | NFR-01, NFR-03 |

---

### Member 3 — Chat, State & Integration
**Owner of:** `src/js/app.js`, `src/js/state.js`

| Task | FR / NFR |
|---|---|
| `state.js`: session state object — setAnalysis(), appendChat(), reset() | FR-06.1, FR-06.2 |
| `app.js`: startup — calls `api.loadConfig()`, binds all event listeners | All FRs |
| `app.js`: "Analyze" click handler — orchestrates api → state → ui calls | FR-02.1 |
| `app.js`: "Clear" click handler | FR-01.8, FR-06.2, AC-01.3 |
| Chat panel: follow-up input, send button, scrollable log | FR-05.1 – FR-05.4 |
| `app.js`: follow-up send handler — calls `api.sendFollowUp()`, updates state and UI | FR-05.2 |
| Chat export: `Blob` + `<a download>` trigger, `.txt` format | FR-05.5 |
| End-to-end integration testing across all modules | AC-01 – AC-05 |

---

## 9. Key Design Constraints & Trade-offs

| Decision | Alternative considered | Why this choice wins |
|---|---|---|
| Vanilla JS over React/Vue | React (with Vite) | No build step; lecturer can run with one Python command; app complexity doesn't justify a virtual DOM |
| API key in request header | API key in URL query param | NFR-04: key must not appear in the network request URL |
| `response_mime_type: "application/json"` | Regex/strip markdown from response | More reliable; avoids brittle string parsing; Gemini honours the MIME type constraint |
| In-memory state over `sessionStorage` | `sessionStorage` JSON serialisation | Plain object is simpler; `sessionStorage` adds serialisation overhead for no gain in this context |
| highlight.js via CDN | Bundled / locally hosted | Simplifies setup; lecturer's machine needs internet access anyway to call the Gemini API |
| `AbortSignal.timeout(30_000)` | `setTimeout` + manual abort | Cleaner; supported in all modern browsers (Chrome 103+, Firefox 100+) |
