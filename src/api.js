// src/api.js
// All Claude calls go through /api/claude (our Vercel serverless proxy).
// Uses claude-opus-4-5 for heavy research/drafting.

const PROXY = '/api/claude';

export async function callClaude({ system, user, model = 'claude-opus-4-5', maxTokens = 2000 }) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };

  const res = await fetch(PROXY, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }

  const data = await res.json();

  // Fable 5 may return thinking blocks — find the text block
  const textBlock = data.content?.find(b => b.type === 'text');
  return textBlock?.text || '';
}
