import { InsightPill as BaseInsightPill } from '../../../components/ui/InsightPill'

/** Agent reasoning banner — renders nothing when `agentReasoning` is falsy. */
export function InsightPill({ agentReasoning }) {
  if (!agentReasoning) return null
  return <BaseInsightPill>{agentReasoning}</BaseInsightPill>
}
