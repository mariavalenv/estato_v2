// Vercel serverless function — screening agent proxy.
// The API key lives here on the server; it is never sent to the browser.

const SYSTEM_PROMPT = `You are a warm, intelligent real estate screening agent for Estato — an AI-powered platform that matches people with flats and flatmates in Spain.

Your job is to conduct a friendly, natural conversation to understand what the user is looking for. You are not filling out a form — you are having a conversation. Be concise, warm, and human.

CONVERSATION RULES:
- Ask only one question at a time, never multiple
- Acknowledge the user's answer briefly before asking the next question
- If an answer is vague or incomplete, ask one natural follow-up before moving on
- Use the user's previous answers to make later questions feel personalised
- Do not list options unless the user seems unsure — let them answer naturally first
- Keep your messages short — 1 to 3 sentences maximum

QUESTION ORDER — collect these in sequence:
1. Which city are they moving to, and do they have preferred neighbourhoods?
2. What is their move-in timeline? (within 30 days / 1-3 months / just exploring)
3. What is their monthly budget, all bills included? (capture min and max if they give a range)
4. Are they looking for a whole flat or a room in a shared flat?
5. How many bedrooms do they need? (or are they open to a studio?)
6. Who will be living there? (just them, a couple, bringing their own flatmate)
7. What are their must-haves? (probe for: lift, balcony or terrace, furnished, pets allowed, parking, natural light, recently renovated)
8. Where do they need to commute to most days? (get a specific area or address)
9. Have they already seen flats that did not work? What was wrong with them? (this captures deal-breakers)
10. If they are open to a shared flat: what matters to them in a flatmate? (lifestyle, cleanliness, schedule, smoker or not, pets)

COMPLETION:
Once you have collected all required fields, write a single warm closing sentence acknowledging you have everything you need, then immediately output the structured profile in this exact format with no additional text after it:

<screening_complete>
{
  "city": "",
  "neighbourhoods": [],
  "move_in_timeline": "",
  "budget": { "min": 0, "max": 0 },
  "flat_type": "",
  "bedrooms": "",
  "occupants": "",
  "must_haves": [],
  "commute_anchor": "",
  "deal_breakers": [],
  "flatmate_preferences": {}
}
</screening_complete>`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json(data)
    }

    const content = data.content?.[0]?.text ?? ''

    // Detect completion
    const completeMatch = content.match(/<screening_complete>([\s\S]*?)<\/screening_complete>/)

    if (completeMatch) {
      try {
        const profile = JSON.parse(completeMatch[1].trim())
        const message = content.slice(0, content.indexOf('<screening_complete>')).trim()
        return res.status(200).json({ type: 'complete', profile, message })
      } catch {
        // JSON parse failed — treat as regular message
      }
    }

    return res.status(200).json({ type: 'message', message: content })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
