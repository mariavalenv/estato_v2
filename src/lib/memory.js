// ─── User memory ──────────────────────────────────────────────────────────────
// Load / seed / save the per-user memory blob, and ask Claude to update it from
// a conversation. Memory shape (all optional):
//   { budget, city, preferred_neighbourhoods, property_type,
//     deal_breakers, timeline, personal_notes }

import { db } from '../supabase'
import { buildMemoryUpdatePrompt } from './prompts.js'
import { callClaude, extractJson, MODELS } from './chat.js'

/** Fetch the stored memory for a user (null if none yet). */
export async function loadMemory(userId) {
  if (!userId) return null
  try {
    return await db.getUserMemory(userId)
  } catch (err) {
    console.warn('[memory] load failed:', err?.message)
    return null
  }
}

/** Persist the memory blob for a user. */
export async function saveMemory(userId, memory) {
  if (!userId || !memory) return
  try {
    await db.saveUserMemory(userId, memory)
  } catch (err) {
    console.warn('[memory] save failed:', err?.message)
  }
}

/**
 * Build a starting memory object from the intake-form profile (first visit,
 * before Claude has learned anything).
 * @param {object|null} ctx - QuickForm context
 */
export function seedMemory(ctx) {
  if (!ctx) return {}
  const m = {}
  if (ctx.city) m.city = ctx.city
  if (ctx.neighbourhoods?.length) m.preferred_neighbourhoods = ctx.neighbourhoods
  if (ctx.budget && (ctx.budget.min || ctx.budget.max)) {
    m.budget = { min: ctx.budget.min ?? null, max: ctx.budget.max ?? null }
  }
  if (ctx.flatType) m.property_type = ctx.flatType
  if (ctx.timeline) m.timeline = ctx.timeline

  const notes = []
  if (ctx.pets?.length) notes.push(`Has ${ctx.pets.join(', ')} — needs pet-friendly places`)
  if (ctx.adults > 1) notes.push(`${ctx.adults} people moving in`)
  if (notes.length) m.personal_notes = notes

  return m
}

/**
 * Ask Claude to merge anything new from the conversation into the memory JSON.
 * Returns the updated memory (or the current memory unchanged on failure).
 * @param {object|null} currentMemory
 * @param {Array<{role:string, content:string}>} sessionMessages
 */
export async function updateMemoryFromConversation(currentMemory, sessionMessages) {
  if (!sessionMessages?.length) return currentMemory
  try {
    const text = await callClaude({
      messages: [{ role: 'user', content: buildMemoryUpdatePrompt(currentMemory, sessionMessages) }],
      model: MODELS.cheap,
      maxTokens: 800,
    })
    const parsed = extractJson(text)
    return parsed && typeof parsed === 'object' ? parsed : currentMemory
  } catch (err) {
    console.warn('[memory] update failed:', err?.message)
    return currentMemory
  }
}
