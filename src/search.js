import { LISTINGS } from './listings.js'

export function searchListings(query = {}) {
  const {
    cities, countries, areas, types, minBeds, maxBeds,
    minPrice, maxPrice, isForRent, petFriendly, parking,
    outdoor, quiet, nearTransport, features, styles, sortBy, limit,
  } = query

  const applyFilters = (strict) => {
    let results = [...LISTINGS]
    if (cities?.length) results = results.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()))
    if (countries?.length) results = results.filter(l => countries.some(c => l.country?.toLowerCase() === c.toLowerCase()))
    if (areas?.length) results = results.filter(l => areas.some(a => l.area?.toLowerCase().includes(a.toLowerCase())))
    if (types?.length) results = results.filter(l => types.includes(l.type))
    if (minBeds != null) results = results.filter(l => l.bedrooms >= minBeds)
    if (maxBeds != null) results = results.filter(l => l.bedrooms <= maxBeds)
    if (minPrice != null) results = results.filter(l => l.price >= minPrice)
    if (maxPrice != null) results = results.filter(l => l.price <= maxPrice)
    if (isForRent != null) results = results.filter(l => l.isForRent === isForRent)
    if (strict) {
      if (petFriendly != null) results = results.filter(l => l.petFriendly === petFriendly)
      if (parking != null) results = results.filter(l => l.parking === parking)
      if (outdoor != null) results = results.filter(l => l.outdoor === outdoor)
      if (quiet != null) results = results.filter(l => l.quiet === quiet)
      if (nearTransport != null) results = results.filter(l => l.nearTransport === nearTransport)
      if (features?.length) results = results.filter(l => features.some(f => l.features?.some(lf => lf.toLowerCase().includes(f.toLowerCase()))))
      if (styles?.length) results = results.filter(l => styles.some(s => l.style?.toLowerCase().includes(s.toLowerCase())))
    }
    return results
  }

  let results = applyFilters(true)
  if (results.length < 3) results = applyFilters(false)

  if (results.length < 3) {
    let r = [...LISTINGS]
    if (cities?.length) r = r.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()))
    if (isForRent != null) r = r.filter(l => l.isForRent === isForRent)
    if (maxPrice != null) r = r.filter(l => l.price <= maxPrice * 1.3)
    if (minBeds != null) r = r.filter(l => l.bedrooms >= minBeds)
    results = r
  }

  if (results.length < 3) {
    let r = [...LISTINGS]
    if (cities?.length) r = r.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()))
    if (isForRent != null) r = r.filter(l => l.isForRent === isForRent)
    results = r
  }

  if (sortBy === 'price_asc') results.sort((a, b) => a.price - b.price)
  else if (sortBy === 'price_desc') results.sort((a, b) => b.price - a.price)
  else if (sortBy === 'beds_desc') results.sort((a, b) => b.bedrooms - a.bedrooms)
  else results.sort((a, b) => a.id - b.id) // stable default

  return results.slice(0, limit || 30)
}
