// Serverless endpoint for the website's "Ask AI" box (deploy on Vercel).
// GROQ_API_KEY is read from the server environment only. It never reaches the browser or the repository.
const { askGroq } = require('./_groq.js');

const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://mithleshprasad.github.io,http://localhost:3000,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MAX_Q = 300, MAX_HISTORY = 4, LIMIT = 15, WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();   // ip -> timestamps. Best effort only: each serverless instance keeps its own memory.

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return list.length > LIMIT;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const ok = ALLOWED.includes(origin);
  if (ok) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (origin && !ok) { res.status(403).json({ error: 'This site is not allowed to use the assistant.' }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'The assistant is not set up yet.' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) { res.status(429).json({ error: 'Too many questions. Please wait a few minutes or ask on WhatsApp.' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const question = body && typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) { res.status(400).json({ error: 'Please type a question.' }); return; }
  if (question.length > MAX_Q) { res.status(400).json({ error: 'Please keep the question under 300 characters.' }); return; }
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_Q) }));

  try {
    const answer = await askGroq({ apiKey, question, history });
    res.status(200).json({ answer: answer || 'Sorry, I could not find an answer. Please ask on WhatsApp.' });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message || 'The assistant is busy right now.' });
  }
};
