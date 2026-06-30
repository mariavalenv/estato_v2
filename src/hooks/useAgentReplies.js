export function useAgentReplies(listing) {
  function getReply(text) {
    const lower = text.toLowerCase()
    if (lower.includes('lift'))    return listing.features.find(f=>f.label==='Lift')?.on
      ? 'Yes, there is a lift in the building.'
      : 'No lift in this building — worth checking if that matters to you.'
    if (lower.includes('pet'))     return listing.features.find(f=>f.label==='Pets OK')?.on
      ? 'Yes, pets are welcome here.'
      : 'Pets are not allowed in this property.'
    if (lower.includes('commut'))  return `It is ${listing.commute} minutes to your commute anchor. That puts it ${listing.commute<=20?'well within':'on the outer edge of'} your 45-minute limit.`
    if (lower.includes('budget'))  return `At €${listing.price}/mo, it is ${listing.price<=1200?'under your ceiling':'above your target'}. True monthly cost including bills is around €${listing.price+listing.bills}.`
    if (lower.includes('floor'))   return `It is on the ${listing.details?.Floor}.`
    if (lower.includes('light'))   return `The flat is ${listing.details?.Orientation}-facing.`
    if (lower.includes('deposit')) return `Deposit is ${listing.contract?.Deposit}.`
    return `Good question. The main thing to weigh is ${listing.tradeoffs?.[0]?.toLowerCase() || 'the commute vs the price'}.`
  }
  return { getReply }
}
