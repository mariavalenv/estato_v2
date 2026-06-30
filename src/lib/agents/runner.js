// ─── Agent Runner ─────────────────────────────────────────────────────────────
// Core utility every agent call goes through. Loads the skill prompt, calls
// Anthropic, and returns { raw } for callers to parse.

import { loadSkill } from '../loadSkill.js'

/**
 * @param {{ skill: string, userMessage: string, maxTokens?: number }} options
 * @returns {Promise<{ raw: string }>}
 */
export async function runAgent({ skill, userMessage, maxTokens = 2048 }) {
  const systemPrompt = loadSkill(skill)
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      `Anthropic API error ${response.status}: ${data.error?.message ?? JSON.stringify(data)}`
    )
  }

  const raw = data.content?.[0]?.text ?? ''
  return { raw }
}

/**
 * Extract text between <tag>...</tag> in the raw response.
 * @param {string} raw
 * @param {string} tag
 * @returns {string | null}
 */
export function extractTag(raw, tag) {
  const match = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
  return match ? match[1].trim() : null
}

/**
 * Extract and JSON.parse text between <tag>...</tag>.
 * @param {string} raw
 * @param {string} tag
 * @returns {Record<string, unknown> | null}
 */
export function parseTaggedJSON(raw, tag) {
  const content = extractTag(raw, tag)
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Extract all occurrences of <tag>...</tag> and parse each as JSON.
 * @param {string} raw
 * @param {string} tag
 * @returns {Array<Record<string, unknown>>}
 */
export function parseAllTaggedJSON(raw, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g')
  const results = []
  let match

  while ((match = regex.exec(raw)) !== null) {
    try {
      results.push(JSON.parse(match[1].trim()))
    } catch {
      // skip malformed blocks
    }
  }

  return results
}
