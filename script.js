const button = document.getElementById('analyzebtn');
const input = document.getElementById('codeinput');
const apikey = document.getElementById('apikey');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const results = document.getElementById('results');
const smells = document.getElementById('smells');
const refactored = document.getElementById('refactored');
button.addEventListener('click', analyzeCode);
async function analyzeCode() {
const code = input.value.trim();
const key = apikey.value.trim();
if (!code || !key) {
showError('Please enter both API key and code');
return;
}
hideAll();
loading.classList.remove('hidden');
button.disabled = true;
try {
const prompt = `Analyze this code for common code smells. Identify issues like long methods (over 20 lines), magic numbers, poor variable names, deep nesting (over 3 levels), and duplicate code. 

Format your response EXACTLY as:
SMELLS:
[list each smell with line references]

REFACTORED:
[provide refactored code]

Code to analyze:
${code}`;
const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${key}`, {
method: 'POST',
headers: {'Content-Type': 'application/json'},
body: JSON.stringify({contents: [{parts: [{text: prompt}]}]})
});
if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.error?.message || `API error: ${response.status}`);
}
const data = await response.json();
const text = data.candidates[0].content.parts[0].text;
const parts = text.split('REFACTORED:');
const smellsText = parts[0].replace('SMELLS:', '').trim();
const refactoredText = parts[1] ? parts[1].trim() : 'No refactoring provided';
smells.textContent = smellsText;
refactored.textContent = refactoredText;
loading.classList.add('hidden');
results.classList.remove('hidden');
} catch (err) {
if (err.message.includes('Failed to fetch')) {
showError('Network error. Check internet connection or API key.');
} else {
showError('Error: ' + err.message);
}
} finally {
button.disabled = false;
}
}
function showError(message) {
hideAll();
error.textContent = message;
error.classList.remove('hidden');
}
function hideAll() {
loading.classList.add('hidden');
error.classList.add('hidden');
results.classList.add('hidden');
}
