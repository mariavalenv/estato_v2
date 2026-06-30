// Vercel serverless function — mints a short-lived signed URL for the
// ElevenLabs Conversational AI agent. This lets us set the agent to
// "private" in the ElevenLabs dashboard so the agent ID alone can't be
// used to start a session — every conversation must go through this
// route, which holds the API key server-side.
//
// The signed URL is valid for ~15 minutes and is single-use.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.VITE_ELEVENLABS_AGENT_ID

  if (!apiKey) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured on server' })
  }
  if (!agentId) {
    return res.status(500).json({ error: 'VITE_ELEVENLABS_AGENT_ID not configured' })
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      }
    )

    const data = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json(data)
    }

    return res.status(200).json({ signed_url: data.signed_url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
