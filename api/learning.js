// Vercel serverless function — learning agent proxy.
// Receives a detected pattern + recent rejections + user profile, calls the
// learning agent skill via Anthropic, and returns a parsed preference_update.

import { loadSkill } from '../src/lib/loadSkill.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' })
  }

  const { userId, pattern, rejections, profile } = req.body
  if (!userId || !pattern || !rejections) {
    return res.status(400).json({ error: 'userId, pattern and rejections are required' })
  }

  const systemPrompt = loadSkill('learning-agent')

  const userMessage = `
User ID: ${userId}

Detected pattern:
${JSON.stringify(pattern, null, 2)}

Recent rejections that contributed to this pattern:
${JSON.stringify(rejections, null, 2)}

User's current profile:
${JSON.stringify(profile ?? {}, null, 2)}

Fetch the user's current profile context above and generate a
preference_update object.
`.trim()

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      return res.status(502).json({ error: `Anthropic error: ${err}` })
    }

    const data = await upstream.json()
    const text = data.content?.[0]?.text ?? ''

    const match = text.match(/<preference_update>([\s\S]*?)<\/preference_update>/)
    if (!match) {
      return res.status(200).json({ update: null })
    }

    let update
    try {
      update = JSON.parse(match[1])
    } catch {
      return res.status(200).json({ update: null })
    }

    return res.status(200).json({ update })
  } catch (err) {
    console.error('learning agent error:', err)
    return res.status(500).json({ error: err.message })
  }
}
