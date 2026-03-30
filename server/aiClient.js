import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const TIMEWEB_ACCESS_ID = process.env.TIMEWEB_ACCESS_ID;
const TIMEWEB_BEARER_TOKEN = process.env.TIMEWEB_BEARER_TOKEN || TIMEWEB_ACCESS_ID;
export const TIMEWEB_BASE = TIMEWEB_ACCESS_ID
  ? `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${TIMEWEB_ACCESS_ID}/v1`
  : null;

export function isTimewebAiConfigured() {
  return Boolean(TIMEWEB_BASE && TIMEWEB_BEARER_TOKEN);
}

/**
 * Сырой ответ модели (текст).
 */
export async function callTimewebAiRaw(systemPrompt, userContent, maxTokens = 4000) {
  if (!TIMEWEB_BASE) {
    throw new Error('TIMEWEB_ACCESS_ID не задан');
  }
  const chatRes = await fetch(`${TIMEWEB_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TIMEWEB_BEARER_TOKEN}`,
      'x-proxy-source': process.env.TIMEWEB_PROXY_SOURCE || '',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });
  if (!chatRes.ok) {
    const errText = await chatRes.text();
    throw new Error(`AI ${chatRes.status}: ${errText.slice(0, 200)}`);
  }
  const completion = await chatRes.json();
  return completion.choices?.[0]?.message?.content?.trim() ?? '';
}

function stripMarkdownFence(raw) {
  let s = String(raw ?? '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return s.trim();
}

/**
 * Ответ модели как JSON (объект или массив).
 */
export async function callTimewebAiJson(systemPrompt, userContent, maxTokens = 4000) {
  const raw = await callTimewebAiRaw(systemPrompt, userContent, maxTokens);
  const cleaned = stripMarkdownFence(raw);
  return JSON.parse(cleaned);
}
