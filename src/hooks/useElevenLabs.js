import { useRef, useState, useCallback } from 'react'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID
const COOLDOWN_MS = 500

// Fetch a short-lived signed URL from our serverless route. The route
// holds the ElevenLabs API key server-side, which lets us set the agent
// to "private" in the dashboard — anyone trying to connect with just
// the agent ID will be rejected.
async function fetchSignedUrl() {
  const res = await fetch('/api/elevenlabs-signed-url')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Signed URL request failed (${res.status})`)
  }
  const data = await res.json()
  if (!data.signed_url) throw new Error('Signed URL missing from response')
  return data.signed_url
}

/**
 * useElevenLabs — wraps @11labs/client's Conversation.startSession with
 * the dynamic-variable + client-tool plumbing the dashboard needs.
 *
 * @param {object} opts
 * @param {(text: string) => void} opts.onMessage
 *   Called for every AI message — the dashboard mirrors this into the
 *   speech bubble (typewriter).
 * @param {(mode: 'listening' | 'speaking' | 'idle') => void} opts.onStateChange
 *   Drives the orb state animation.
 * @param {() => Record<string, string|number|boolean>?} opts.getDynamicVariables
 *   Optional. Called once at session start. Return the bundle the
 *   ElevenLabs agent will receive as `{{user_name}}`, `{{pending_houses}}`, etc.
 * @param {() => Record<string, Function>?} opts.getClientTools
 *   Optional. Called once at session start. Return a map of tool name →
 *   handler. The agent's tool definitions in the ElevenLabs dashboard
 *   must use the same names.
 */
export function useElevenLabs({
  onMessage,
  onStateChange,
  getDynamicVariables,
  getClientTools,
}) {
  const convRef   = useRef(null)
  const lastStartRef = useRef(0)
  const [active, setActive] = useState(false)
  // Pending message queued before the session is fully connected. Used
  // by requestStatusUpdate so the user can fire it before mic permission
  // / WebSocket handshake completes.
  const pendingUserMsgRef = useRef(null)

  const stop = useCallback(async () => {
    if (convRef.current) {
      await convRef.current.endSession()
      convRef.current = null
    }
    setActive(false)
    onStateChange('idle')
  }, [onStateChange])

  const start = useCallback(async () => {
    if (active) return null

    // 500ms cooldown guard — prevent rapid session start/stop cycles
    const now = Date.now()
    if (now - lastStartRef.current < COOLDOWN_MS) return null
    lastStartRef.current = now

    if (!AGENT_ID) {
      console.warn('[useElevenLabs] VITE_ELEVENLABS_AGENT_ID is not set — voice disabled.')
      return null
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })

      const { Conversation } = await import('@11labs/client')

      // Pull dynamic variables + client tools fresh at the moment of
      // session start, so they reflect the latest dashboard state.
      const dynamicVariables = getDynamicVariables?.() || undefined
      const clientTools = getClientTools?.() || undefined

      // Mint a fresh signed URL on every session start. The agent in the
      // ElevenLabs dashboard is configured as private, so passing the raw
      // agentId would be rejected — we have to go through the signed URL.
      const signedUrl = await fetchSignedUrl()

      const conv = await Conversation.startSession({
        signedUrl,
        dynamicVariables,
        clientTools,
        onMessage: ({ message, source }) => {
          if (source === 'ai') onMessage(message)
        },
        onModeChange: ({ mode }) => {
          onStateChange(mode)
        },
        onError: (err) => {
          console.error('ElevenLabs error:', err)
          stop()
        },
        onUnhandledClientToolCall: (params) => {
          // Surface tool-name mismatches loudly during dev so we notice
          // when the agent dashboard schema and the code drift apart.
          console.warn('[useElevenLabs] Unhandled tool call:', params)
        },
      })
      convRef.current = conv
      setActive(true)
      onStateChange('listening')

      // Flush any user message queued before the session was ready.
      if (pendingUserMsgRef.current) {
        const queued = pendingUserMsgRef.current
        pendingUserMsgRef.current = null
        try { conv.sendUserMessage(queued) } catch (err) {
          console.warn('[useElevenLabs] Could not flush queued message:', err)
        }
      }
      return conv
    } catch (err) {
      console.error('Could not start voice session:', err)
      return null
    }
  }, [active, onMessage, onStateChange, getDynamicVariables, getClientTools, stop])

  /**
   * Send a user-side text message into the active session as if the
   * user had said it out loud. If no session is active yet, queues the
   * message and starts one — useful for "Get status update" buttons
   * that should kick off a fresh conversation.
   */
  const sendUserMessage = useCallback(async (text) => {
    if (!text) return
    if (convRef.current) {
      try { convRef.current.sendUserMessage(text) } catch (err) {
        console.warn('[useElevenLabs] sendUserMessage failed:', err)
      }
      return
    }
    pendingUserMsgRef.current = text
    await start()
  }, [start])

  /**
   * One-tap "give me a status update" — wraps sendUserMessage with the
   * canonical phrasing the agent's system prompt expects.
   */
  const requestStatusUpdate = useCallback(() => {
    return sendUserMessage('Give me a quick status update.')
  }, [sendUserMessage])

  const enabled = !!AGENT_ID

  return { active, start, stop, enabled, sendUserMessage, requestStatusUpdate }
}
