// Vercel serverless function — screening agent proxy.
// The API key lives here on the server; it is never sent to the browser.

import { loadSkill } from '../src/lib/loadSkill.js'

const SYSTEM_PROMPT = loadSkill('screening-agent')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' })
  }

  const { messages } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' })
  }

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
        stream: true,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!upstream.ok) {
      const data = await upstream.json()
      return res.status(upstream.status).json(data)
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullText = ''
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6)
        if (raw === '[DONE]') continue
        try {
          const event = JSON.parse(raw)
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const text = event.delta.text
            fullText += text
            res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
          }
        } catch {}
      }
    }

    // Parse full accumulated text for metadata
    let partial = null
    const partialMatch = fullText.match(/<partial_profile>([\s\S]*?)<\/partial_profile>/)
    if (partialMatch) {
      try { partial = JSON.parse(partialMatch[1].trim()) } catch {}
    }
    const content = fullText.replace(/<partial_profile>[\s\S]*?<\/partial_profile>/g, '').trim()

    const completeMatch = content.match(/<screening_complete>([\s\S]*?)<\/screening_complete>/)
    if (completeMatch) {
      try {
        const profile = JSON.parse(completeMatch[1].trim())
        const message = content.slice(0, content.indexOf('<screening_complete>')).trim()
        res.write(`data: ${JSON.stringify({ type: 'complete', profile, message })}\n\n`)
        return res.end()
      } catch {}
    }

    res.write(`data: ${JSON.stringify({ type: 'done', message: content, partial })}\n\n`)
    res.end()
  } catch (err) {
    try { res.status(500).json({ error: err.message }) } catch { res.end() }
  }
}
