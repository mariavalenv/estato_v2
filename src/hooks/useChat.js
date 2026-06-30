// ─── useChat ──────────────────────────────────────────────────────────────────
// Chat hook for the match chat surface.
// Accepts matchId, finds or creates a conversation, fetches history,
// subscribes to Realtime, and exposes sendMessage.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase.js'
import { getMessages } from '../lib/dashboard/fetchers.js'
import {
  sendMessage as sendMessageAction,
  findOrCreateConversation,
} from '../lib/dashboard/actions.js'

/**
 * @param {{ matchId: string }} props
 */
export function useChat({ matchId }) {
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const channelRef = useRef(null)

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [])

  // Bootstrap: find/create conversation then load messages
  useEffect(() => {
    if (!matchId || !userId) return

    let cancelled = false
    setIsLoading(true)

    findOrCreateConversation(matchId, userId, null).then(async ({ success, conversation: conv }) => {
      if (cancelled || !success || !conv) {
        setIsLoading(false)
        return
      }
      setConversation(conv)

      const history = await getMessages(conv.id)
      if (!cancelled) {
        setMessages(history)
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [matchId, userId])

  // Realtime subscription on messages table, scoped to this conversation
  useEffect(() => {
    if (!conversation?.id) return

    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates (optimistic insert may already exist)
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [conversation?.id])

  const sendMessage = useCallback(async (content) => {
    if (!conversation?.id || !userId || !content.trim()) return

    // Optimistic insert
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: userId,
      content,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimistic])

    const result = await sendMessageAction(conversation.id, userId, content)

    if (result.success && result.message) {
      // Replace optimistic with confirmed row
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? result.message : m))
      )
    } else {
      // Roll back on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      console.error('sendMessage failed:', result.error)
    }
  }, [conversation?.id, userId])

  return { messages, conversation, isLoading, sendMessage, userId }
}
