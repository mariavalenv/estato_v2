import fs from 'fs'
import path from 'path'

const VALID_SKILLS = [
  'screening-agent',
  'orchestrator-agent',
  'listing-agent',
  'flatmate-agent',
  'dashboard-voice-agent',
  'learning-agent',
  'inventory-enrichment-agent',
]

const skillCache = new Map()

export function loadSkill(name) {
  if (!VALID_SKILLS.includes(name)) {
    throw new Error(`Unknown skill: "${name}". Valid skills: ${VALID_SKILLS.join(', ')}`)
  }
  if (skillCache.has(name)) {
    return skillCache.get(name)
  }
  const filePath = path.join(process.cwd(), 'skills', `${name}.md`)
  const content = fs.readFileSync(filePath, 'utf-8')
  skillCache.set(name, content)
  return content
}
