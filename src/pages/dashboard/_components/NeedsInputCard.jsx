import { useNavigate } from 'react-router-dom'
import { NeedsYourInputCard } from '../../../components/organisms/NeedsYourInputCard'

/**
 * Adapts the fetcher's NeedsInputItem[] shape to the NeedsYourInputCard organism.
 * Fetcher shape: { id, match_id, type, label, sublabel, action }
 * Organism shape: { id, label, primaryAction: { label, onClick }, secondaryAction: { label, onClick } }
 */
export function NeedsInputCard({ items }) {
  const navigate = useNavigate()

  const mapped = items.map((item) => ({
    id: item.id,
    label: item.label,
    primaryAction: {
      label: item.action === 'review' ? 'Review' : 'View',
      onClick: () =>
        navigate(
          item.action === 'review'
            ? `/approve/${item.match_id}`
            : `/chat/${item.match_id}`
        ),
    },
    secondaryAction: {
      label: 'Later',
      onClick: () => {},
    },
  }))

  return <NeedsYourInputCard items={mapped} />
}
