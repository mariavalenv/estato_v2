// ─── Assistant prompts ────────────────────────────────────────────────────────
// All editable prompt copy for the real-estate assistant lives here, separate
// from component / API logic, so wording and tone can be tweaked in one place:
//   - buildSystemPrompt        system prompt with injected user memory
//   - buildWelcomePrompt       first message of a session (memory- or profile-aware)
//   - buildClassificationPrompt cheap "filter vs question" classifier
//   - buildDualResponsePrompt  natural reply + extracted filters
//   - buildMemoryUpdatePrompt  end-of-session memory extraction

/**
 * Render a memory/profile object into readable lines for prompt injection.
 * Tolerates loose shapes (budget as number, {min,max}, or string; arrays/strings).
 * @param {object|null} memory
 * @returns {string}
 */
export function formatMemory(memory) {
  if (!memory || typeof memory !== 'object' || Object.keys(memory).length === 0) {
    return 'Nothing yet — this is the first time you are meeting this user.'
  }

  const fmtBudget = (b) => {
    if (b == null) return null
    if (typeof b === 'number') return `€${b}/month`
    if (typeof b === 'string') return b
    const min = b.min ? `€${b.min}` : null
    const max = b.max ? `€${b.max}` : null
    if (min && max) return `${min}–${max}/month`
    if (max) return `up to ${max}/month`
    if (min) return `from ${min}/month`
    return null
  }
  const fmtList = (v) => Array.isArray(v) ? v.filter(Boolean).join(', ') : v
  const fmtDismissals = (d) => {
    if (!d || typeof d !== 'object') return null
    const entries = Object.entries(d).filter(([, n]) => n > 0)
    if (!entries.length) return null
    return entries.map(([reason, n]) => `${reason} (${n}×)`).join(', ')
  }

  const rows = [
    ['Budget', fmtBudget(memory.budget)],
    ['City', memory.city],
    ['Preferred neighbourhoods', fmtList(memory.preferred_neighbourhoods)],
    ['Property type', memory.property_type],
    ['Timeline', memory.timeline],
    ['Deal-breakers', fmtList(memory.deal_breakers)],
    ['Recently passed on listings for', fmtDismissals(memory.dismissal_reasons)],
    ['Notes', fmtList(memory.personal_notes)],
  ].filter(([, v]) => v != null && v !== '')

  if (!rows.length) return 'Nothing yet — this is the first time you are meeting this user.'
  return rows.map(([k, v]) => `- ${k}: ${v}`).join('\n')
}

/**
 * System prompt injected on every conversational API call.
 * @param {object|null} userMemory
 * @returns {string}
 */
export function buildSystemPrompt(userMemory) {
  return `You are a friendly real estate assistant — like a knowledgeable local friend, not salesy.

Here is what you already know about this user:
${formatMemory(userMemory)}

Use this naturally in conversation — don't list it back to them robotically.
As you learn new things about their preferences, note them for later.
If they keep passing on listings for the same reason, gently adapt — e.g. suggest tightening the budget or trying a different area.
Keep responses concise and always move the conversation forward.`
}

/**
 * Prompt that asks the agent to write the first message of a session.
 * Branches on whether we already have memory (returning) or only a profile
 * (first-time). The agent should reply with PLAIN TEXT (no JSON).
 *
 * @param {{ memory?: object|null, profile?: object|null }} opts
 * @returns {string}
 */
export function buildWelcomePrompt({ memory = null, profile = null } = {}) {
  const hasMemory = memory && typeof memory === 'object' && Object.keys(memory).length > 0

  const constraints = [
    'Tone: warm, casual, like a knowledgeable local friend — never salesy.',
    '2–3 sentences maximum, ending with exactly ONE question that moves things forward.',
    'No filler openers like "Welcome back!" or "Hi there!". Just dive in.',
    'Reply with plain text only — no JSON, no markdown.',
  ]

  if (hasMemory) {
    return [
      'Write the FIRST message of a NEW session for a RETURNING user. Here is what you remember about them:',
      '',
      formatMemory(memory),
      '',
      'Acknowledge where they left off and nudge them forward (e.g. mention that new listings may have come in).',
      ...constraints.map((c) => `- ${c}`),
      '',
      'Example of the tone (do NOT copy verbatim):',
      '"Good to have you back — still on the hunt for a flat in Malasaña? A few new listings came in that might be worth a look."',
    ].join('\n')
  }

  return [
    'Write the FIRST message for a FIRST-TIME user. Here is their intake profile:',
    '',
    formatMemory(profile),
    '',
    'Naturally summarise what they are looking for, then ask the most useful thing still missing (e.g. their all-in monthly budget).',
    ...constraints.map((c) => `- ${c}`),
    '',
    'Example of the tone (do NOT copy verbatim):',
    '"It\'s great to have you here — looks like you\'re after a room in a shared flat across some of Madrid\'s best neighbourhoods, with a couple of months to find the right fit. To make sure we match you well, what\'s your monthly budget for the room, all costs included?"',
  ].join('\n')
}

/**
 * Cheap classifier: is the user filtering listings or asking a question?
 * The model must reply with ONLY a JSON object.
 * @param {string} userMessage
 * @returns {string}
 */
export function buildClassificationPrompt(userMessage) {
  return `You are classifying a user message in a real estate app.
Reply ONLY with a JSON object, nothing else:
{
  "type": "filter" | "question",
  "filters": { "budget": 800, "city": "Madrid", "furnished": true } | null
}

User message: "${userMessage}"`
}

/**
 * Dual-response: a natural reply plus any implied listing filters.
 * The model must reply with ONLY a JSON object.
 * @param {string} userMessage
 * @returns {string}
 */
export function buildDualResponsePrompt(userMessage) {
  return `You are a real estate assistant. The user said: "${userMessage}"

1. Reply naturally to their question or comment
2. If their message implies any listing filters (e.g. "more sunlight" → south-facing, not ground floor), extract them too

Reply ONLY with this JSON:
{
  "response": "your conversational reply here",
  "filters": { "min_floor": 1, "orientation": "south" } | null
}`
}

/**
 * End-of-session memory extraction.
 * @param {object|null} currentMemory
 * @param {Array<{role:string, content:string}>} sessionMessages
 * @returns {string}
 */
export function buildMemoryUpdatePrompt(currentMemory, sessionMessages) {
  const transcript = (sessionMessages || [])
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n')
  return `Based on this conversation, update the user memory JSON with anything new you learned.
Only return the updated JSON object, nothing else.
Existing memory: ${JSON.stringify(currentMemory ?? {})}
Conversation:
${transcript}`
}
