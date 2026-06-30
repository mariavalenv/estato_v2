// ─── Chat engine ──────────────────────────────────────────────────────────────
// Session management, Claude API calls (via the /api/chat serverless proxy, so
// the key stays on the server), JSON parsing, and an in-memory response cache.

import {
  buildClassificationPrompt,
  buildDualResponsePrompt,
  buildWelcomePrompt,
} from './prompts.js'

export const MODELS = {
  main: 'claude-sonnet-4-6',           // conversational replies + welcome
  cheap: 'claude-haiku-4-5-20251001',  // classification + memory extraction
}

/* ── Session ───────────────────────────────────────────────────── */

// A fresh conversation id per page load.
export function newSessionId() {
  return crypto.randomUUID()
}

/* ── Response cache (in-memory, per page session) ──────────────── */

const responseCache = new Map()
const norm = (s) => String(s || '').trim().toLowerCase()

export function getCachedResponse(message) {
  return responseCache.get(norm(message)) ?? null
}
export function setCachedResponse(message, response) {
  if (message && response) responseCache.set(norm(message), response)
}

/* ── Low-level Claude call ─────────────────────────────────────── */

function textOf(data) {
  return (data?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/**
 * One non-streaming Claude call through /api/chat. Returns the assistant text.
 * @param {{ system?: string, messages: Array, model?: string, maxTokens?: number }} opts
 */
export async function callClaude({ system, messages, model = MODELS.main, maxTokens = 1024 }) {
  const body = { model, max_tokens: maxTokens, messages }
  if (system) body.system = system

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `Claude API error ${res.status}`)
  }
  return textOf(await res.json())
}

/** Best-effort JSON extraction (tolerates ```json fences and surrounding prose). */
export function extractJson(text) {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/* ── High-level operations ─────────────────────────────────────── */

/**
 * Classify a user message as a filter action or a question.
 * @returns {Promise<{ type: 'filter'|'question', filters: object|null }>}
 */
export async function classifyMessage(message) {
  const text = await callClaude({
    messages: [{ role: 'user', content: buildClassificationPrompt(message) }],
    model: MODELS.cheap,
    maxTokens: 256,
  })
  const parsed = extractJson(text)
  if (!parsed || (parsed.type !== 'filter' && parsed.type !== 'question')) {
    return { type: 'question', filters: null }  // safe default
  }
  return { type: parsed.type, filters: parsed.filters ?? null }
}

/**
 * Full dual-response call: natural reply + any implied filters.
 * @returns {Promise<{ response: string, filters: object|null }>}
 */
export async function dualResponse(message, system) {
  const text = await callClaude({
    system,
    messages: [{ role: 'user', content: buildDualResponsePrompt(message) }],
    model: MODELS.main,
    maxTokens: 1024,
  })
  const parsed = extractJson(text)
  if (parsed && typeof parsed.response === 'string') {
    return { response: parsed.response, filters: parsed.filters ?? null }
  }
  // If the model didn't return JSON, treat the whole text as the reply.
  return { response: text || "Sorry, I didn't catch that — could you say it another way?", filters: null }
}

/**
 * Generate the first message of a session (memory- or profile-aware).
 * @param {{ memory?: object|null, profile?: object|null, system?: string }} opts
 * @returns {Promise<string>}
 */
export async function generateWelcome({ memory, profile, system }) {
  return callClaude({
    system,
    messages: [{ role: 'user', content: buildWelcomePrompt({ memory, profile }) }],
    model: MODELS.main,
    maxTokens: 400,
  })
}
