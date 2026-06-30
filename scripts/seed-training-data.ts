import { config } from 'dotenv'
// Try .env.local first, fall back to .env
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL in .env')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error(
    'Missing service role key.\n' +
    'Add one of these to your .env:\n' +
    '  VITE_SUPABASE_SERVICE_ROLE_KEY=<your service role key>\n' +
    '  SUPABASE_SERVICE_ROLE_KEY=<your service role key>\n' +
    'Find it in Supabase → Project Settings → API → service_role key.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Utilities ─────────────────────────────────────────────────────────────────

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const chance = (p: number) => Math.random() < p

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ── Batch Insert ──────────────────────────────────────────────────────────────

async function insertBatch(
  table: string,
  records: unknown[],
  batchSize = 100
) {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`Batch error at index ${i}:`, error.message)
      throw error
    }
    const inserted = Math.min(i + batchSize, records.length)
    if (inserted % 500 === 0 || inserted === records.length) {
      console.log(`  ${inserted} / ${records.length}`)
    }
  }
}

// ── Listing Constants ─────────────────────────────────────────────────────────

interface NeighbourhoodConfig {
  count: number
  priceRange: [number, number]
  commuteRange: [number, number]
  type: 'central' | 'mid' | 'outer'
}

interface CityConfig {
  neighbourhoods: Record<string, NeighbourhoodConfig>
}

const LISTING_CONFIG: Record<string, CityConfig> = {
  Madrid: {
    neighbourhoods: {
      Chamberi:    { count: 500, priceRange: [900,  1800], commuteRange: [5,  15], type: 'central' },
      Salamanca:   { count: 500, priceRange: [1200, 2500], commuteRange: [5,  15], type: 'central' },
      Malasaña:    { count: 500, priceRange: [800,  1600], commuteRange: [10, 25], type: 'mid'     },
      Retiro:      { count: 500, priceRange: [1000, 2000], commuteRange: [10, 25], type: 'mid'     },
      Lavapiés:    { count: 500, priceRange: [650,  1200], commuteRange: [5,  15], type: 'central' },
      Chueca:      { count: 500, priceRange: [900,  1700], commuteRange: [5,  15], type: 'central' },
      Moncloa:     { count: 500, priceRange: [750,  1400], commuteRange: [10, 25], type: 'mid'     },
      Carabanchel: { count: 500, priceRange: [550,  950],  commuteRange: [20, 45], type: 'outer'   },
      Vallecas:    { count: 500, priceRange: [500,  850],  commuteRange: [20, 45], type: 'outer'   },
      Arganzuela:  { count: 500, priceRange: [700,  1300], commuteRange: [20, 45], type: 'outer'   },
    },
  },
  Barcelona: {
    neighbourhoods: {
      Eixample:    { count: 430, priceRange: [1100, 2200], commuteRange: [5,  15], type: 'central' },
      'Gràcia':    { count: 430, priceRange: [900,  1800], commuteRange: [10, 25], type: 'mid'     },
      'Poble Sec': { count: 430, priceRange: [750,  1400], commuteRange: [10, 25], type: 'mid'     },
      'Sant Pere': { count: 430, priceRange: [800,  1600], commuteRange: [5,  15], type: 'central' },
      "Sarrià":    { count: 430, priceRange: [1400, 2800], commuteRange: [20, 45], type: 'outer'   },
      Poblenou:    { count: 430, priceRange: [900,  1700], commuteRange: [10, 25], type: 'mid'     },
      'Les Corts': { count: 420, priceRange: [1000, 1900], commuteRange: [20, 45], type: 'outer'   },
    },
  },
  Valencia: {
    neighbourhoods: {
      Ruzafa:       { count: 400, priceRange: [650, 1200], commuteRange: [5,  15], type: 'central' },
      'El Carmen':  { count: 400, priceRange: [600, 1100], commuteRange: [5,  15], type: 'central' },
      Benimaclet:   { count: 400, priceRange: [500, 950],  commuteRange: [10, 25], type: 'mid'     },
      Campanar:     { count: 400, priceRange: [550, 1000], commuteRange: [20, 45], type: 'outer'   },
      Extramurs:    { count: 400, priceRange: [580, 1050], commuteRange: [20, 45], type: 'outer'   },
    },
  },
}

const PREMIUM_NEIGHBOURHOODS = ['Salamanca', 'Eixample', "Sarrià"]
const BUDGET_NEIGHBOURHOODS  = ['Carabanchel', 'Vallecas']

const MADRID_STREETS = [
  'Calle Fuencarral', 'Calle Hortaleza', 'Calle Serrano',
  'Paseo de la Castellana', 'Calle Gran Vía', 'Calle Atocha', 'Calle Toledo',
  'Avenida de América', 'Calle Alcalá', 'Calle Goya', 'Calle Velázquez',
  'Calle Génova', 'Calle Santa Engracia', 'Calle Bravo Murillo',
  'Calle Luchana', 'Calle Sagasta', 'Calle Argensola', 'Calle Barceló',
  'Calle Trafalgar', 'Calle Raimundo Lulio', 'Calle Covarrubias',
  'Paseo de la Chopera', 'Calle Embajadores', 'Calle Mesón de Paredes',
  'Calle Lavapiés', 'Calle Argumosa', 'Calle Doctor Fourquet',
  'Calle Caravaca', 'Calle Amparo', 'Calle Valencia',
]

const BARCELONA_STREETS = [
  'Carrer de Provença', 'Carrer de Mallorca',
  'Passeig de Gràcia', "Carrer d'Aragó", 'Carrer de Consell de Cent',
  'Carrer de Muntaner', 'Carrer de Balmes', 'Avinguda Diagonal',
  'Carrer de Sants', 'Carrer de la Marina', 'Carrer del Consell de Cent',
  'Carrer de Girona', 'Carrer de Bruc', 'Carrer de Pau Claris',
  'Carrer de Roger de Llúria', 'Rambla del Poblenou', 'Carrer de Llull',
  'Carrer de Pallars', 'Carrer de Taulat', 'Carrer de Pujades',
]

const VALENCIA_STREETS = [
  'Carrer de Colón', 'Avinguda del Regne de València',
  'Carrer de Xàtiva', 'Carrer de la Pau', 'Gran Via Marquès del Túria',
  'Carrer de Sorní', 'Carrer de Cirilo Amorós', 'Carrer del Pintor Sorolla',
  'Carrer de Russafa', 'Carrer de Sueca', 'Carrer de Literato Azorín',
  'Carrer del Doctor Serrano', 'Carrer de Denia', 'Carrer de Burjassot',
]

const CITY_STREETS: Record<string, string[]> = {
  Madrid: MADRID_STREETS,
  Barcelona: BARCELONA_STREETS,
  Valencia: VALENCIA_STREETS,
}

const LISTING_FEATURES = [
  'Hardwood floors', 'High ceilings', 'Recently renovated kitchen',
  'Double glazing', 'Air conditioning', 'Central heating',
  'Storage room included', 'Community pool', 'Rooftop terrace',
  'Bicycle storage', 'Concierge service', 'Fibre optic internet',
  'Smart home system', 'Built-in wardrobes', 'Open plan living',
  'South-facing', 'Corner apartment', 'Private garden',
]

const LISTING_SOURCES = ['idealista', 'fotocasa', 'habitaclia', 'direct']
const LISTING_SOURCE_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

const FLOOR_LABELS = ['bajo', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º']
const DOOR_LETTERS = ['A', 'B', 'C', 'D', 'Izq', 'Dcha']

// ── Feature labels (for PropertyTab) ─────────────────────────────────────────
const FEATURE_LABELS = [
  'Furnished', 'A/C', 'Heating', 'Dishwasher', 'Washer',
  'Pets OK', 'No smoking', 'Parking', 'Lift',
]

// ── Orientations ─────────────────────────────────────────────────────────────
const ORIENTATIONS = ['South', 'South-west', 'East', 'West', 'North', 'North-east', 'Interior']

// ── Heating types ────────────────────────────────────────────────────────────
const HEATING_TYPES = ['Central gas', 'Individual gas', 'Electric', 'Radiators', 'Heat pump']

// ── Landlord names ───────────────────────────────────────────────────────────
const LANDLORD_FIRST_NAMES = [
  'María Teresa', 'José Luis', 'Carmen', 'Antonio', 'Pilar',
  'Francisco', 'Ana María', 'Miguel Ángel', 'Rosa', 'Juan Carlos',
  'Dolores', 'Pedro', 'Montserrat', 'Rafael', 'Concepción',
  'Enrique', 'Margarita', 'Emilio', 'Teresa', 'Alberto',
]
const LANDLORD_LAST_INITIALS = 'ABCDEFGHJLMNOPRSV'
const AGENCY_NAMES = [
  'Redpiso', 'Engel & Völkers', 'Tecnocasa', 'Look & Find',
  'Gilmar', 'Keller Williams', 'Re/Max', 'Century 21',
  'Coldwell Banker', 'Solvia',
]

// ── Nearby places per city ───────────────────────────────────────────────────

const CITY_CAFES: Record<string, string[]> = {
  Madrid: [
    'Toma Cafe', 'La Bicicleta', 'Federal Café', 'Café El Espejo',
    'Misión Café', 'HanSo Café', 'Café de la Luz', 'Lateral',
    'Mama Framboise', 'El Pavón Café', 'Café Angélica',
  ],
  Barcelona: [
    'Satan\'s Coffee Corner', 'Nomad Coffee', 'Syra Coffee',
    'SlowMov', 'Hidden Coffee Roasters', 'Café Godot',
    'Caravelle', 'Federal Café BCN', 'Three Marks Coffee',
  ],
  Valencia: [
    'Bluebell Coffee', 'La Más Bonita', 'Dulce de Leche',
    'Ubik Café', 'Café de las Horas', 'La Petite Brioche',
    'Café Negrito', 'Café Museu', 'Café Infantes',
  ],
}

const CITY_RESTAURANTS: Record<string, string[]> = {
  Madrid: [
    'Casa Julio', 'Ojalá', 'Bodega de la Ardosa', 'StreetXO',
    'Lateral Castellana', 'La Barraca', 'Sacha', 'Taberna Laredo',
    'Café Comercial', 'El Club Allard', 'La Mucca',
  ],
  Barcelona: [
    'Can Paixano', 'Bar Cañete', 'Cervecería Catalana',
    'Tickets', 'Cal Pep', 'La Pepita', 'Flax & Kale',
    'El Nacional', 'La Boqueria', 'Bar Brutal',
  ],
  Valencia: [
    'Casa Montaña', 'La Salita', 'Canalla Bistro',
    'Central Bar', 'Navarro', 'Bar Ricardo', 'La Lola',
    'El Poblet', 'Copenhagen', 'Panorama Restaurante',
  ],
}

const CITY_SUPERMARKETS: Record<string, string[]> = {
  Madrid: ['Mercadona', 'Carrefour Express', 'Día', 'Lidl', 'El Corte Inglés Supermercado', 'Aldi'],
  Barcelona: ['Mercadona', 'Caprabo', 'Bonpreu', 'Lidl', 'Consum', 'Veritas'],
  Valencia: ['Mercadona', 'Consum', 'Carrefour Express', 'Lidl', 'Aldi', 'Mas y Mas'],
}

const CITY_PARKS: Record<string, string[]> = {
  Madrid: ['Parque del Retiro', 'Parque del Oeste', 'Jardines de Sabatini', 'Casa de Campo', 'Parque de Berlín', 'Madrid Río'],
  Barcelona: ['Parc de la Ciutadella', 'Parc Güell', 'Jardins de Laribal', 'Parc del Guinardó', 'Parc de Montjuïc'],
  Valencia: ['Jardín del Turia', 'Jardí Botànic', 'Parc Central', 'Parc de Capçalera', 'Jardines de Viveros'],
}

const CITY_GYMS: Record<string, string[]> = {
  Madrid: ['Anytime Fitness', 'Basic-Fit', 'Virgin Active', 'VivaGym', 'DIR', 'Holmes Place'],
  Barcelona: ['DIR', 'McFit', 'Anytime Fitness', 'Holmes Place', 'VivaGym', 'CEM Olímpics'],
  Valencia: ['Anytime Fitness', 'Basic-Fit', 'VivaGym', 'McFit', 'BeOne', 'Fitness Park'],
}

// ── Metro / transit stops per neighbourhood ──────────────────────────────────

const NEIGHBOURHOOD_TRANSIT: Record<string, { name: string; lines: string }[]> = {
  // Madrid
  Chamberi:    [{ name: 'Iglesia', lines: 'L1' }, { name: 'Bilbao', lines: 'L1/L4' }, { name: 'Alonso Martínez', lines: 'L4/L5/L10' }],
  Salamanca:   [{ name: 'Serrano', lines: 'L4' }, { name: 'Velázquez', lines: 'L4' }, { name: 'Retiro', lines: 'L2' }],
  'Malasaña':  [{ name: 'Tribunal', lines: 'L1/L10' }, { name: 'Noviciado', lines: 'L2' }, { name: 'San Bernardo', lines: 'L2/L4' }],
  Retiro:      [{ name: 'Retiro', lines: 'L2' }, { name: 'Ibiza', lines: 'L9' }, { name: 'Atocha', lines: 'L1' }],
  Lavapiés:    [{ name: 'Lavapiés', lines: 'L3' }, { name: 'Embajadores', lines: 'L3/L5' }, { name: 'Tirso de Molina', lines: 'L1' }],
  Chueca:      [{ name: 'Chueca', lines: 'L5' }, { name: 'Gran Vía', lines: 'L1/L5' }, { name: 'Banco de España', lines: 'L2' }],
  Moncloa:     [{ name: 'Moncloa', lines: 'L3/L6' }, { name: 'Argüelles', lines: 'L3/L4/L6' }],
  Carabanchel: [{ name: 'Oporto', lines: 'L5/L6' }, { name: 'Urgel', lines: 'L5' }, { name: 'Vista Alegre', lines: 'L5' }],
  Vallecas:    [{ name: 'Puente de Vallecas', lines: 'L1' }, { name: 'Nueva Numancia', lines: 'L1' }],
  Arganzuela:  [{ name: 'Legazpi', lines: 'L3/L6' }, { name: 'Delicias', lines: 'L3' }, { name: 'Embajadores', lines: 'L3/L5' }],
  // Barcelona
  Eixample:    [{ name: 'Passeig de Gràcia', lines: 'L2/L3/L4' }, { name: 'Diagonal', lines: 'L3/L5' }, { name: 'Urgell', lines: 'L1' }],
  'Gràcia':    [{ name: 'Fontana', lines: 'L3' }, { name: 'Joanic', lines: 'L4' }, { name: 'Lesseps', lines: 'L3' }],
  'Poble Sec': [{ name: 'Poble Sec', lines: 'L3' }, { name: 'Paral·lel', lines: 'L2/L3' }],
  'Sant Pere': [{ name: 'Arc de Triomf', lines: 'L1' }, { name: 'Urquinaona', lines: 'L1/L4' }],
  'Sarrià':    [{ name: 'Sarrià', lines: 'FGC' }, { name: 'Reina Elisenda', lines: 'FGC' }],
  Poblenou:    [{ name: 'Poblenou', lines: 'L4' }, { name: 'Llacuna', lines: 'L4' }, { name: 'Bogatell', lines: 'L4' }],
  'Les Corts': [{ name: 'Les Corts', lines: 'L3' }, { name: 'Plaça del Centre', lines: 'L3' }],
  // Valencia
  Ruzafa:      [{ name: 'Xàtiva', lines: 'L3/L5' }, { name: 'Bailén', lines: 'L5/L7' }],
  'El Carmen': [{ name: 'Àngel Guimerà', lines: 'L1/L2' }, { name: 'Turia', lines: 'L4' }],
  Benimaclet:  [{ name: 'Benimaclet', lines: 'L1/L3' }],
  Campanar:    [{ name: 'Campanar', lines: 'L2' }, { name: 'Túria', lines: 'L4' }],
  Extramurs:   [{ name: 'Àngel Guimerà', lines: 'L1/L2' }, { name: 'Jesús', lines: 'L1' }],
}

// ── Listing Generator ─────────────────────────────────────────────────────────

function isBusyStreet(street: string): boolean {
  return (
    street.includes('Gran Vía') ||
    street.includes('Gran Via') ||
    street.includes('Avenida') ||
    street.includes('Avinguda') ||
    street.includes('Passeig') ||
    street.includes('Paseo')
  )
}

function isoDateAhead(baseDate: string, daysAhead: number): string {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0]
}

// ── Curated Unsplash image pools for realistic property photos ──────────────

const FLAT_LIVING_ROOMS = [
  'photo-1502672260266-1c1ef2d93688', // bright open-plan living room
  'photo-1522708323590-d24dbb6b0267', // cozy living room with sofa
  'photo-1493809842364-78817add7ffb', // modern apartment lounge
  'photo-1554995207-c18c203602cb', // minimalist Scandinavian living room
  'photo-1586023492125-27b2c045efd7', // warm-toned living room
  'photo-1583847268964-b28dc8f51f92', // sunny apartment living area
  'photo-1615529182904-14819c35db37', // modern sofa setup
  'photo-1618221195710-dd6b41faaea6', // contemporary flat living room
]

const FLAT_LIVING_ROOMS_RENOVATED = [
  'photo-1600210492486-724fe5c67fb0', // sleek modern apartment
  'photo-1560448204-e02f11c3d0e2', // designer open living space
  'photo-1600607687939-ce8a6c25118c', // high-end renovated lounge
  'photo-1600585154340-be6161a56a0c', // luxury interior design
  'photo-1556702571-3e11dd2b1a92', // new renovation white walls
]

const KITCHENS = [
  'photo-1556909114-f6e7ad7d3136', // modern white kitchen
  'photo-1556909114-44e3e70034e2', // bright kitchen with island
  'photo-1600585152220-90363fe7e115', // contemporary kitchen
  'photo-1556909172-54557c7e4fb7', // kitchen with wooden counters
  'photo-1588854337236-6889d631faa8', // galley kitchen
  'photo-1565538810643-b5bdb714032a', // warm-toned kitchen
]

const BEDROOMS = [
  'photo-1560185127-6ed189bf02f4', // bright apartment bedroom
  'photo-1616594039964-ae9021a400a0', // minimalist bedroom
  'photo-1505693416388-ac5ce068fe85', // cozy bedroom with window light
  'photo-1618773928121-c32242e63f39', // modern bedroom
  'photo-1600566753190-17f0baa2a6c3', // neat bedroom with plants
  'photo-1617325247661-675ab4b64ae2', // double bedroom
]

const BATHROOMS = [
  'photo-1552321554-5fefe8c9ef14', // modern tiled bathroom
  'photo-1600566752355-35792bedcfea', // clean white bathroom
  'photo-1604709177225-055f99402ea3', // contemporary bathroom
  'photo-1620626011761-996317b8d101', // renovated bathroom
  'photo-1584622650111-993a426fbf0a', // bathroom with bathtub
]

const BALCONY_VIEWS = [
  'photo-1600607687644-aac4c3eac7f4', // city balcony view
  'photo-1600566753376-12c8ab7a5a38', // terrace with seating
  'photo-1600585154526-990dced4db0d', // balcony with table
]

const FLAT_EXTERIORS = [
  'photo-1545324418-cc1a3fa10c00', // European apartment building facade
  'photo-1574362848149-11496d93a7c7', // Mediterranean apartment block
  'photo-1580041065738-e72023775cdc', // Spanish-style residential building
  'photo-1600047509807-ba8f99d2cdde', // modern apartment complex
  'photo-1486406146926-c627a92ad1ab', // urban residential block
]

const HOUSE_EXTERIORS = [
  'photo-1564013799919-ab600027ffc6', // modern house front
  'photo-1568605114967-8130f3a36994', // suburban house exterior
  'photo-1600596542815-ffad4c1539a9', // house with garden
  'photo-1600047509358-9dc75507daeb', // Mediterranean villa style
  'photo-1583608205776-bfd35f0d9f83', // residential house
  'photo-1600585154363-67eb9e2e2099', // house facade with porch
]

const HOUSE_LIVING_ROOMS = [
  'photo-1600210491892-03d54c0aaf87', // spacious house living room
  'photo-1600607687920-4e2a09cf159d', // large living area
  'photo-1600585154340-be6161a56a0c', // luxury house interior
  'photo-1600566753086-00f18fb6b3ea', // open-plan living dining
  'photo-1616137466211-f939a16a18f7', // warm family living room
]

const HOUSE_GARDENS = [
  'photo-1558618666-fcd25c85f82e', // patio with plants
  'photo-1600566752734-2a0ccbf9d4e8', // backyard garden
  'photo-1600596542815-ffad4c1539a9', // garden view
  'photo-1591825729269-caeb344f6df2', // private terrace
]

/** Deterministic pick from an array using index as seed */
function seededPick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

/** Build a realistic image set for a flat listing */
function buildFlatImageSet(
  idx: number,
  renovated: boolean,
  bedrooms: number,
  hasBalcony: boolean
): string[] {
  const imgs: string[] = []
  // Lead with living room
  const livingPool = renovated ? FLAT_LIVING_ROOMS_RENOVATED : FLAT_LIVING_ROOMS
  imgs.push(`https://images.unsplash.com/${seededPick(livingPool, idx)}?w=800&q=80`)
  // Kitchen
  imgs.push(`https://images.unsplash.com/${seededPick(KITCHENS, idx + 1)}?w=800&q=80`)
  // Bedroom(s)
  if (bedrooms >= 1) {
    imgs.push(`https://images.unsplash.com/${seededPick(BEDROOMS, idx + 2)}?w=800&q=80`)
  }
  if (bedrooms >= 2) {
    imgs.push(`https://images.unsplash.com/${seededPick(BEDROOMS, idx + 5)}?w=800&q=80`)
  }
  // Bathroom
  imgs.push(`https://images.unsplash.com/${seededPick(BATHROOMS, idx + 3)}?w=800&q=80`)
  // Balcony if available
  if (hasBalcony) {
    imgs.push(`https://images.unsplash.com/${seededPick(BALCONY_VIEWS, idx + 4)}?w=800&q=80`)
  }
  // Building exterior
  imgs.push(`https://images.unsplash.com/${seededPick(FLAT_EXTERIORS, idx + 6)}?w=800&q=80`)
  return imgs
}

/** Build a realistic image set for a house listing */
function buildHouseImageSet(
  idx: number,
  renovated: boolean,
  bedrooms: number,
  hasBalcony: boolean
): string[] {
  const imgs: string[] = []
  // Lead with house exterior
  imgs.push(`https://images.unsplash.com/${seededPick(HOUSE_EXTERIORS, idx)}?w=800&q=80`)
  // Living room
  const livingPool = renovated ? FLAT_LIVING_ROOMS_RENOVATED : HOUSE_LIVING_ROOMS
  imgs.push(`https://images.unsplash.com/${seededPick(livingPool, idx + 1)}?w=800&q=80`)
  // Kitchen
  imgs.push(`https://images.unsplash.com/${seededPick(KITCHENS, idx + 2)}?w=800&q=80`)
  // Bedrooms
  if (bedrooms >= 1) {
    imgs.push(`https://images.unsplash.com/${seededPick(BEDROOMS, idx + 3)}?w=800&q=80`)
  }
  if (bedrooms >= 2) {
    imgs.push(`https://images.unsplash.com/${seededPick(BEDROOMS, idx + 6)}?w=800&q=80`)
  }
  // Bathroom
  imgs.push(`https://images.unsplash.com/${seededPick(BATHROOMS, idx + 4)}?w=800&q=80`)
  // Garden / terrace
  imgs.push(`https://images.unsplash.com/${seededPick(HOUSE_GARDENS, idx + 5)}?w=800&q=80`)
  // Balcony if available
  if (hasBalcony) {
    imgs.push(`https://images.unsplash.com/${seededPick(BALCONY_VIEWS, idx + 7)}?w=800&q=80`)
  }
  return imgs
}

function generateListing(
  city: string,
  neighbourhood: string,
  cfg: NeighbourhoodConfig,
  idx: number
) {
  // ── floor & lift ──────────────────────────────────────────────────
  const floor = rand(0, 8)
  // floor > 3 → only 15% lack a lift (so 85% have one)
  const has_lift = floor > 3 ? !chance(0.15) : chance(0.65)

  // ── balcony ───────────────────────────────────────────────────────
  const has_balcony = floor === 0 ? !chance(0.90) : chance(0.45)

  // ── natural light ─────────────────────────────────────────────────
  const natural_light = (floor === 0
    ? pickWeighted(['low', 'medium', 'high'], [0.60, 0.30, 0.10])
    : pickWeighted(['low', 'medium', 'high'], [0.20, 0.45, 0.35])
  ) as 'low' | 'medium' | 'high'

  // ── renovation ────────────────────────────────────────────────────
  const renovChance = PREMIUM_NEIGHBOURHOODS.includes(neighbourhood)
    ? 0.40
    : BUDGET_NEIGHBOURHOODS.includes(neighbourhood)
    ? 0.10
    : 0.25
  const recently_renovated = chance(renovChance)

  // ── furnished & pets ──────────────────────────────────────────────
  const furnished   = chance(0.55)
  const pets_allowed = chance(0.20)

  // ── parking: central 8%, outer 35% ────────────────────────────────
  const has_parking = chance(cfg.type === 'outer' ? 0.35 : 0.08)

  // ── base price with multipliers ───────────────────────────────────
  let price = rand(cfg.priceRange[0], cfg.priceRange[1])
  if (floor === 0)              price = Math.round(price * 0.88)
  if (floor > 3 && !has_lift)   price = Math.round(price * 0.85)
  if (recently_renovated)       price = Math.round(price * 1.20)
  if (furnished)                price = Math.round(price * 1.15)
  if (pets_allowed)             price = Math.round(price * 0.95)

  // ── commute & size ────────────────────────────────────────────────
  const commute_minutes = rand(cfg.commuteRange[0], cfg.commuteRange[1])
  const bedrooms  = pickWeighted([0, 1, 2, 3, 4], [0.08, 0.25, 0.40, 0.20, 0.07]) as number
  const bathrooms = bedrooms <= 1
    ? 1
    : pickWeighted([1, 2], bedrooms <= 2 ? [0.70, 0.30] : [0.40, 0.60]) as number

  const BASE_SIZES = [30, 45, 65, 85, 110]
  const size_sqm = rand(BASE_SIZES[bedrooms] - 8, BASE_SIZES[bedrooms] + 20)

  // ── address ───────────────────────────────────────────────────────
  const street     = pick(CITY_STREETS[city])
  const number     = rand(1, 180)
  const floorLabel = FLOOR_LABELS[floor]
  const letter     = pick(DOOR_LETTERS)
  const address    = `${street} ${number}, ${floorLabel} ${letter}`

  // ── street noise ──────────────────────────────────────────────────
  const street_noise = (isBusyStreet(street)
    ? pickWeighted(['quiet', 'moderate', 'busy'], [0.15, 0.15, 0.70])
    : pickWeighted(['quiet', 'moderate', 'busy'], [0.40, 0.40, 0.20])
  ) as 'quiet' | 'moderate' | 'busy'

  // ── images ────────────────────────────────────────────────────────
  // Curated Unsplash photos for realistic Spanish property listings
  const isHouse = bedrooms >= 3 && has_parking
  const imagePool = isHouse
    ? buildHouseImageSet(idx, recently_renovated, bedrooms, has_balcony)
    : buildFlatImageSet(idx, recently_renovated, bedrooms, has_balcony)
  const imageCount = rand(2, Math.min(5, imagePool.length))
  const images = imagePool.slice(0, imageCount)

  // ── misc ──────────────────────────────────────────────────────────
  const raw_features          = pickN(LISTING_FEATURES, rand(2, 5))
  const listing_source        = pickWeighted(LISTING_SOURCES, LISTING_SOURCE_WEIGHTS)
  const landlord_response_time = pick(['fast', 'normal', 'slow'])
  const available_from        = isoDateAhead('2026-04-05', rand(0, 90))

  // ── bills & community (OverviewTab) ───────────────────────────────
  const bills = rand(50, 140)
  const communityOptions = ['Included', 'Not included', `€${rand(30, 80)}/mo`]
  const community = pick(communityOptions)

  // ── features as { label, on } (PropertyTab) ───────────────────────
  const hasAC = recently_renovated ? chance(0.70) : chance(0.30)
  const features = FEATURE_LABELS.map(label => {
    switch (label) {
      case 'Furnished':  return { label, on: furnished }
      case 'A/C':        return { label, on: hasAC }
      case 'Heating':    return { label, on: chance(0.85) }
      case 'Dishwasher': return { label, on: recently_renovated ? chance(0.65) : chance(0.25) }
      case 'Washer':     return { label, on: chance(0.80) }
      case 'Pets OK':    return { label, on: pets_allowed }
      case 'No smoking': return { label, on: chance(0.90) }
      case 'Parking':    return { label, on: has_parking }
      case 'Lift':       return { label, on: has_lift }
      default:           return { label, on: chance(0.50) }
    }
  })

  // ── details (PropertyTab) ─────────────────────────────────────────
  const orientation = floor === 0
    ? pick(['Interior', 'North', 'East'])
    : pick(ORIENTATIONS)
  const heating = pick(HEATING_TYPES)
  const details: Record<string, string> = {
    Floor: FLOOR_LABELS[floor],
    Size: `${size_sqm} m²`,
    Heating: heating,
    Orientation: orientation,
  }

  // ── contract (PropertyTab) ────────────────────────────────────────
  const deposit = price * 2
  const minLease = pick(['6 months', '12 months', '12 months', '12 months', '24 months'])
  const noticePeriod = pick(['1 month', '2 months', '2 months', '30 days'])
  const requirements = pick([
    'Last 3 payslips + ID',
    'Employment contract + 2 payslips',
    'Last 3 payslips + work contract + ID',
    'Proof of income + ID',
    'Nómina + contrato de trabajo',
  ])
  const contract: Record<string, string> = {
    Deposit: `€${deposit.toLocaleString()} (2 months)`,
    'Min. lease': minLease,
    'Notice period': noticePeriod,
    Requirements: requirements,
  }

  // ── commutes (OverviewTab) ────────────────────────────────────────
  const transit = NEIGHBOURHOOD_TRANSIT[neighbourhood] ?? []
  const nearestStop = transit[0]
  const walkToMetro = rand(2, 12)
  const commuteRating = commute_minutes <= 15 ? 'good' : commute_minutes <= 30 ? 'ok' : 'far'
  const commutes = [
    {
      dest: nearestStop
        ? `${nearestStop.name} (${nearestStop.lines})`
        : `${neighbourhood} Metro`,
      mode: 'metro',
      time: `${walkToMetro} min walk`,
      rating: 'good' as string,
    },
    {
      dest: `Work anchor — ${city} centre`,
      mode: 'walk',
      time: `${commute_minutes} min`,
      rating: commuteRating,
    },
    {
      dest: `${pick(CITY_SUPERMARKETS[city])} supermarket`,
      mode: 'shop',
      time: `${rand(2, 8)} min walk`,
      rating: 'good' as string,
    },
  ]

  // ── nearby places (AreaTab) ───────────────────────────────────────
  const nearbyPlaces: Record<string, { name: string; type: string; dist: string; rating: number }[]> = {
    Coffee: pickN(CITY_CAFES[city], rand(2, 3)).map((n, i) => ({
      name: n, type: pick(['Specialty coffee', 'Café · terrace', 'Café · brunch', 'Coffee roasters']),
      dist: `${rand(1, 6)} min`, rating: +(4 + Math.random() * 0.9).toFixed(1),
    })),
    Restaurants: pickN(CITY_RESTAURANTS[city], rand(2, 3)).map(n => ({
      name: n, type: pick(['Spanish · tapas', 'Mediterranean', 'Asian fusion', 'Italian', 'Brunch · trendy']),
      dist: `${rand(2, 8)} min`, rating: +(4 + Math.random() * 0.9).toFixed(1),
    })),
    Supermarkets: pickN(CITY_SUPERMARKETS[city], rand(1, 2)).map(n => ({
      name: n, type: pick(['Supermarket', 'Convenience', 'Gourmet market']),
      dist: `${rand(1, 6)} min`, rating: +(3.5 + Math.random() * 0.9).toFixed(1),
    })),
    Parks: pickN(CITY_PARKS[city], rand(1, 2)).map(n => ({
      name: n, type: pick(['Large park', 'Garden · benches', 'Urban park']),
      dist: `${rand(3, 18)} min`, rating: +(4 + Math.random() * 0.9).toFixed(1),
    })),
    Gyms: pickN(CITY_GYMS[city], rand(1, 2)).map(n => ({
      name: n, type: pick(['24h gym', 'Premium gym · pool', 'Boutique gym', 'Fitness club', 'Budget gym']),
      dist: `${rand(3, 12)} min`, rating: +(3.8 + Math.random() * 0.9).toFixed(1),
    })),
  }

  // ── landlord (ContactTab) ─────────────────────────────────────────
  const isAgency = chance(0.35)
  const landlordName = isAgency
    ? `Agency — ${pick(AGENCY_NAMES)}`
    : `${pick(LANDLORD_FIRST_NAMES)} ${pick(LANDLORD_LAST_INITIALS.split(''))}.`
  const landlordInitial = isAgency ? 'A' : landlordName[0]
  const landlordSub = landlord_response_time === 'fast'
    ? 'Usually replies within 2 hours'
    : landlord_response_time === 'normal'
    ? 'Replies within 24 hours'
    : 'May take 2–3 days to respond'
  const landlord = { initial: landlordInitial, name: landlordName, sub: landlordSub }

  // ── quality score ─────────────────────────────────────────────────
  const score = Math.min(95, Math.max(55,
    70 +
    (recently_renovated                     ?  8 : 0) +
    (furnished                              ?  3 : 0) +
    (has_lift                               ?  2 : 0) +
    (has_balcony                            ?  3 : 0) +
    (natural_light === 'high'               ?  5 : natural_light === 'medium' ? 2 : 0) +
    (street_noise === 'quiet'               ?  4 : street_noise === 'moderate' ? 1 : -3) +
    rand(-10, 10)
  ))

  // ── match_reasons & trade_offs (OverviewTab) ──────────────────────
  const match_reasons: string[] = []
  if (price <= 1200) match_reasons.push(`Within budget at €${price}/mo`)
  if (commute_minutes <= 15) match_reasons.push(`Short ${commute_minutes} min commute`)
  if (natural_light === 'high') match_reasons.push('High natural light')
  if (recently_renovated) match_reasons.push('Recently renovated')
  if (has_lift) match_reasons.push('Lift access')
  if (has_balcony) match_reasons.push('Has a balcony')
  if (furnished) match_reasons.push('Comes furnished')
  if (street_noise === 'quiet') match_reasons.push('Quiet street')
  if (pets_allowed) match_reasons.push('Pet-friendly')
  if (raw_features.includes('Fibre optic internet')) match_reasons.push('Fibre optic internet available')
  if (raw_features.includes('Air conditioning')) match_reasons.push('Air conditioning included')

  const trade_offs: string[] = []
  if (price > 1200) trade_offs.push(`€${price - 1200} over target budget`)
  if (!has_lift && floor > 2) trade_offs.push(`${FLOOR_LABELS[floor]} floor with no lift`)
  if (!has_balcony) trade_offs.push('No balcony')
  if (street_noise === 'busy') trade_offs.push('Busy street — moderate to high noise')
  if (natural_light === 'low') trade_offs.push('Limited natural light')
  if (commute_minutes > 30) trade_offs.push(`${commute_minutes} min commute — longer than ideal`)
  if (!furnished) trade_offs.push('Unfurnished — will need to buy basics')

  // ── agent_reasoning (OverviewTab) ─────────────────────────────────
  const floorDesc = floor === 0 ? 'ground-floor' : `${FLOOR_LABELS[floor]}-floor`
  const bedDesc = bedrooms === 0 ? 'studio' : `${bedrooms}-bed`
  const furnDesc = furnished ? 'furnished' : 'unfurnished'
  const lightDesc = natural_light === 'high' ? 'great natural light' : natural_light === 'medium' ? 'decent natural light' : 'limited natural light'
  const liftDesc = has_lift ? 'lift' : 'no lift'

  const positives: string[] = []
  if (natural_light === 'high') positives.push(lightDesc)
  if (has_lift) positives.push('lift access')
  if (recently_renovated) positives.push('recently renovated')
  if (has_balcony) positives.push('balcony')
  if (raw_features.length > 0) positives.push(...pickN(raw_features, Math.min(2, raw_features.length)).map(f => f.toLowerCase()))

  const negatives: string[] = []
  if (street_noise !== 'quiet') negatives.push(`${street_noise} street noise`)
  if (!has_balcony) negatives.push('no balcony')
  if (!has_lift && floor > 2) negatives.push(`no lift on ${FLOOR_LABELS[floor]} floor`)
  if (natural_light === 'low') negatives.push('limited light')

  const posStr = positives.length > 0
    ? positives.slice(0, 3).join(', ')
    : 'a decent layout'
  const negStr = negatives.length > 0
    ? negatives.slice(0, 2).join(' and ')
    : 'minor trade-offs'

  const budgetNote = price <= 1200
    ? `€${price}/mo — within your target range`
    : `€${price}/mo — €${price - 1200} over target`

  const agent_reasoning = `${floorDesc} ${bedDesc} ${furnDesc} flat in ${neighbourhood}. ${posStr}. ${budgetNote}. ${commute_minutes} min commute. watch out: ${negStr}.`

  return {
    user_id: null,
    type: 'listing',
    score,
    status: 'pending',
    data: {
      address,
      neighbourhood,
      city,
      price,
      bedrooms,
      bathrooms,
      size_sqm,
      commute_minutes,
      furnished,
      images,
      available_from,
      features,
      raw_features,
      floor,
      has_lift,
      has_balcony,
      has_parking,
      pets_allowed,
      recently_renovated,
      natural_light,
      street_noise,
      landlord_response_time,
      listing_source,
      bills,
      community,
      details,
      contract,
      commutes,
      nearby: nearbyPlaces,
      landlord,
    },
    match_reasons,
    trade_offs,
    agent_reasoning,
  }
}

function generateAllListings(): unknown[] {
  const listings: unknown[] = []
  let idx = 0

  for (const [city, cityConfig] of Object.entries(LISTING_CONFIG)) {
    for (const [neighbourhood, nhConfig] of Object.entries(cityConfig.neighbourhoods)) {
      for (let i = 0; i < nhConfig.count; i++) {
        listings.push(generateListing(city, neighbourhood, nhConfig, idx++))
      }
    }
  }

  return listings
}

// ── Flatmate Constants ────────────────────────────────────────────────────────

const SPANISH_NAMES = [
  'Alejandro', 'Beatriz', 'Carlos', 'Diana', 'Elena', 'Fernando', 'Gabriela',
  'Hugo', 'Irene', 'Javier', 'Karla', 'Luis', 'María', 'Nicolás', 'Olivia',
  'Pablo', 'Queralt', 'Rodrigo', 'Sofía', 'Tomás', 'Andrea', 'Bruno', 'Claudia',
  'David', 'Eva', 'Francisco', 'Gloria', 'Héctor', 'Isabel', 'Jorge', 'Laura',
  'Miguel', 'Nuria', 'Óscar', 'Patricia', 'Raúl', 'Sara', 'Víctor', 'Yolanda',
]

const EU_NAMES = [
  'Emma', 'Luca', 'Anna', 'Matteo', 'Sophie', 'Felix', 'Nina', 'Marco',
  'Lea', 'Jonas', 'Camille', 'Lars', 'Mia', 'Pierre', 'Astrid', 'Tobias',
  'Freya', 'Simon', 'Ines', 'Finn', 'Elisa', 'Kai', 'Nora', 'Max', 'Hanna',
]

const UK_US_NAMES = [
  'James', 'Emily', 'Oliver', 'Charlotte', 'Harry', 'Amelia', 'Jack', 'Ella',
  'William', 'Jessica', 'Noah', 'Grace', 'Logan', 'Chloe', 'Mason', 'Lily',
]

interface NationalityDef {
  nat: string
  adj: string
  names: string[]
  weight: number
  lastInitials: string
  languages: string[]
}

const NATIONALITY_POOL: NationalityDef[] = [
  { nat: 'Spanish',   adj: 'Spanish',   names: SPANISH_NAMES, weight: 0.55, lastInitials: 'ABCDEFGHJLMNOPRSV', languages: ['Spanish']                    },
  { nat: 'German',    adj: 'German',    names: EU_NAMES,      weight: 0.05, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['German', 'English', 'Spanish'] },
  { nat: 'French',    adj: 'French',    names: EU_NAMES,      weight: 0.05, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['French', 'English', 'Spanish'] },
  { nat: 'Italian',   adj: 'Italian',   names: EU_NAMES,      weight: 0.04, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['Italian', 'English', 'Spanish'] },
  { nat: 'Dutch',     adj: 'Dutch',     names: EU_NAMES,      weight: 0.03, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['Dutch', 'English', 'German']   },
  { nat: 'Polish',    adj: 'Polish',    names: EU_NAMES,      weight: 0.03, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['Polish', 'English']             },
  { nat: 'British',   adj: 'British',   names: UK_US_NAMES,   weight: 0.08, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['English', 'Spanish']           },
  { nat: 'American',  adj: 'American',  names: UK_US_NAMES,   weight: 0.07, lastInitials: 'ABCDEGHIJKLMNOPRSTW', languages: ['English', 'Spanish']           },
  { nat: 'Mexican',   adj: 'Mexican',   names: SPANISH_NAMES, weight: 0.05, lastInitials: 'ABCDEFGHJLMNOPRSV',   languages: ['Spanish', 'English']           },
  { nat: 'Argentine', adj: 'Argentine', names: SPANISH_NAMES, weight: 0.05, lastInitials: 'ABCDEFGHJLMNOPRSV',   languages: ['Spanish', 'English']           },
]

const JOB_TITLES: Record<string, string[]> = {
  startup: [
    'Product Designer at a fintech startup',
    'Frontend Engineer at an early-stage SaaS company',
    'Growth Marketing Manager at a B2B startup',
    'Data Scientist at a health tech company',
    'UX Researcher at a mobility startup',
    'Backend Engineer at a payments company',
    'Operations Lead at a logistics startup',
    'Brand Designer at a consumer app',
    'iOS Developer at a PropTech company',
    'Product Manager at an edtech platform',
  ],
  corporate: [
    'Financial Analyst at BBVA',
    'Marketing Manager at Telefónica',
    'Software Engineer at Accenture',
    'HR Business Partner at Santander',
    'Project Manager at Deloitte',
    'Data Engineer at Repsol',
    'Communications Specialist at Inditex',
    'Business Analyst at McKinsey',
    'Account Manager at Google',
    'Legal Counsel at a multinational law firm',
  ],
  freelance: [
    'Freelance Graphic Designer',
    'Independent Web Developer',
    'Freelance Copywriter and Content Strategist',
    'Independent Architect',
    'Freelance Motion Designer',
    'Independent Management Consultant',
    'Freelance Photographer',
    'Independent UX Consultant',
    'Freelance Translator (EN/ES/FR)',
    'Independent Financial Advisor',
  ],
  student: [
    'Architecture student at UPM',
    'Computer Science student at UPC',
    'MBA student at IE Business School',
    'Law student at Universidad Complutense',
    'Design student at IED Madrid',
    'Medicine student at UAM',
    'Economics student at Universidad de Valencia',
    'Erasmus student (Engineering)',
    "Master's student in Data Science at UPF",
    'PhD candidate in Sociology',
  ],
  public_sector: [
    'Secondary school teacher',
    'Nurse at Hospital La Paz',
    'Civil servant at the Ministry of Finance',
    'Police officer',
    'University lecturer',
    'Social worker at Madrid City Council',
    'Librarian at Biblioteca Nacional',
    'Urban planner at Valencia City Hall',
    'Public health researcher',
    'Museum curator',
  ],
}

const HOBBIES = [
  'bouldering', 'film photography', 'road cycling',
  'cooking elaborate Sunday meals', 'pottery',
  'running along the river', 'contemporary dance',
  'reading Spanish literature', 'coffee shop hopping',
  'amateur astronomy', 'board games', 'vinyl collecting',
  'watercolour painting', 'padel', 'hiking in the sierra',
  'yoga', 'attending gallery openings', 'home brewing',
  'learning Portuguese', 'urban sketching', 'swimming',
  'volunteering at an animal shelter', 'salsa dancing',
  'tabletop RPGs', 'mushroom foraging', 'documentary filmmaking',
  'rock climbing', 'sea swimming', 'language exchange meetups',
  'experimental cooking', 'contemporary art', 'surfing',
]

const DEALBREAKERS_FLATMATE = [
  'no smoking indoors',
  'no pets',
  'no overnight guests every weekend',
  'no loud music after 11pm',
  'must share cleaning responsibilities',
  'no leaving dishes overnight',
]

const CITY_NEIGHBOURHOODS: Record<string, string[]> = {
  Madrid:    ['Chamberi', 'Salamanca', 'Malasaña', 'Retiro', 'Lavapiés', 'Chueca', 'Moncloa', 'Carabanchel', 'Vallecas', 'Arganzuela'],
  Barcelona: ['Eixample', 'Gràcia', 'Poble Sec', 'Sant Pere', 'Sarrià', 'Poblenou', 'Les Corts'],
  Valencia:  ['Ruzafa', 'El Carmen', 'Benimaclet', 'Campanar', 'Extramurs'],
}

const BIO_TEMPLATES = [
  "I'm a {job_title} based in {city}. I {schedule_desc} and usually spend my evenings {hobby_1}. Looking for a {cleanliness_desc} flatmate who {compatibility_note}.",
  "I moved to {city} {years_ago} and love living in {neighbourhood}. My lifestyle is {schedule_desc} — {schedule_example}. I'm {social_desc} and my flat is {cleanliness_desc}.",
  "Working as a {job_title} and looking for a place in {neighbourhood_pref}. I'm {cleanliness_desc} about shared spaces and {social_desc} in the evenings. Big into {hobby_1} and {hobby_2}.",
  "I've been in {city} for {years_ago} and finally looking for the right place. I work {wfh_desc} and my schedule is {schedule_desc}. I value {value_1} and {value_2} in a shared home.",
  "Originally from {origin_city}, now building my life in {city}. I'm a {employer_type_desc} who takes {cleanliness_desc} living seriously. In my spare time I'm usually {hobby_1}.",
  "Quiet but social when it counts — I like having people over occasionally but also love a peaceful evening with {hobby_1}. I work as a {job_title} and keep {schedule_desc} hours.",
  "I'm looking for a flatmate who respects shared spaces as much as I do. As a {job_title}, my days are {schedule_desc} and I {wfh_desc}. Outside work I'm into {hobby_1} and {hobby_2}.",
  "A {nationality_adj} expat who's been in {city} for {years_ago}. I speak {languages} and work as a {job_title}. Looking for an international and {social_desc} household.",
  "I take my work seriously and my home even more so. I keep things {cleanliness_desc} and prefer a {social_desc} living environment. Currently a {job_title} — {wfh_desc}.",
  "Music, cooking, and {hobby_1} take up most of my free time. I work as a {job_title} with {schedule_desc} hours. I'm {cleanliness_desc} about the kitchen and bathroom especially.",
  "I just finished my {degree} and started working as a {job_title}. Looking for somewhere in {neighbourhood_pref} with good transport links. I'm {social_desc} and {cleanliness_desc}.",
  "Remote-first {job_title} looking for a flat with good natural light and fast WiFi. I {wfh_desc} so I'm home a lot but I keep to myself during work hours. Love {hobby_1} at weekends.",
  "Spent the last {years_ago} in {previous_city} before moving here for work. Still finding my feet but loving {city} so far. I'm {schedule_desc} and very {cleanliness_desc}.",
  "I work shifts as a {job_title} so my schedule varies — mostly {schedule_desc} pattern. Very respectful of others' space and time. Into {hobby_1} on my days off.",
  "Looking for a calm, respectful household. I'm a {job_title} who {wfh_desc} and values a clean, quiet home in the evenings. My hobbies are {hobby_1} and {hobby_2} — nothing loud.",
]

const ORIGIN_CITIES  = ['Seville', 'Bilbao', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Valladolid', 'Paris', 'Berlin', 'Amsterdam', 'Rome', 'London', 'Edinburgh', 'Lisbon', 'Buenos Aires', 'Mexico City', 'Bogotá']
const PREVIOUS_CITIES = ['London', 'Berlin', 'Amsterdam', 'Paris', 'Lisbon', 'Brussels', 'Seville', 'Bilbao', 'Zaragoza', 'Málaga', 'Milan', 'Dublin']
const VALUES          = ['mutual respect', 'clean shared spaces', 'good communication', 'quiet mornings', 'occasional socialising', 'personal space', 'a tidy kitchen', 'honesty', 'reliability', 'clear boundaries']
const COMPAT_NOTES    = ['respects quiet hours', 'is tidy and considerate', 'communicates openly', 'keeps shared spaces clean', "doesn't smoke indoors", 'is reliable with bills', 'respects personal space', 'is easy-going about guests']
const PET_TYPES       = ['cat', 'dog', 'rabbit', 'hamster', 'fish', 'budgie']

// ── Flatmate Generator ────────────────────────────────────────────────────────

function generateAge(): number {
  const r = Math.random()
  if (r < 0.15) return rand(22, 25)
  if (r < 0.45) return rand(26, 30)
  if (r < 0.70) return rand(31, 35)
  if (r < 0.90) return rand(36, 40)
  return rand(41, 45)
}

function generateFlatmate(city: string) {
  const employerType = pickWeighted(
    ['corporate', 'startup', 'freelance', 'student', 'public_sector'],
    [0.30, 0.25, 0.20, 0.15, 0.10]
  )

  const age = generateAge()

  // social_level
  const social_level = pickWeighted(
    ['very_social', 'social', 'quiet', 'private'],
    [0.25, 0.40, 0.25, 0.10]
  ) as 'very_social' | 'social' | 'quiet' | 'private'

  // night_owl + very_social → 60% correlation
  const isNightOwl   = social_level === 'very_social' && chance(0.60)
  // early_riser more common in corporate/public_sector
  const isEarlyRiser = !isNightOwl && (employerType === 'corporate' || employerType === 'public_sector') && chance(0.55)

  const schedule = isNightOwl
    ? 'night_owl'
    : isEarlyRiser
    ? 'early_riser'
    : (pickWeighted(['hybrid', 'early_riser', 'night_owl'], [0.40, 0.30, 0.30]) as 'hybrid' | 'early_riser' | 'night_owl')

  // early_riser + work_from_home → 55% correlation
  const work_from_home = schedule === 'early_riser' ? chance(0.55) : chance(0.40)

  // high cleanliness + quiet → 50% correlation
  const isQuiet  = social_level === 'quiet' || social_level === 'private'
  const cleanliness = (isQuiet && chance(0.50))
    ? 'high'
    : (pickWeighted(['high', 'medium', 'low'], [0.50, 0.35, 0.15]) as 'high' | 'medium' | 'low')

  const smoking = chance(0.15)
  const pets    = chance(0.20)
  const pet_types = pets ? pickN(PET_TYPES, rand(1, 2)) : []

  // budget
  let budget_min: number, budget_max: number
  if (employerType === 'student') {
    budget_min = rand(300, 500)
    budget_max = rand(500, 699) // always under €700
  } else if (employerType === 'corporate' || employerType === 'startup') {
    budget_min = rand(600, 1000)
    budget_max = rand(1000, 2000)
  } else if (employerType === 'freelance') {
    budget_min = rand(500, 800)
    budget_max = rand(800, 1600)
  } else {
    budget_min = rand(500, 750)
    budget_max = rand(750, 1400)
  }

  // nationality
  const natData = pickWeighted(NATIONALITY_POOL, NATIONALITY_POOL.map(n => n.weight))
  const firstName  = pick(natData.names)
  const lastInit   = pick(natData.lastInitials.split(''))
  const name       = `${firstName} ${lastInit}.`
  const languages  = natData.languages

  const job_title  = pick(JOB_TITLES[employerType])
  const hobbies    = pickN(HOBBIES, rand(2, 4))

  // dealbreakers — respect smoking/pets constraints
  const eligible = DEALBREAKERS_FLATMATE.filter(d => {
    if (d === 'no smoking indoors' && smoking) return false
    if (d === 'no pets' && pets) return false
    return true
  })
  const dealbreakers = pickN(eligible, rand(1, 3))

  const preferred_neighbourhoods = pickN(CITY_NEIGHBOURHOODS[city], rand(2, 4))

  // lifestyle tags
  const lifestyle_tags: string[] = []
  if (schedule === 'early_riser') lifestyle_tags.push('Early riser')
  if (schedule === 'night_owl')   lifestyle_tags.push('Night owl')
  if (work_from_home)             lifestyle_tags.push('WFH most days')
  else                            lifestyle_tags.push('Office-based')
  if (cleanliness === 'high')     lifestyle_tags.push('Clean & tidy')
  if (!smoking)                   lifestyle_tags.push('Non-smoker')
  else                            lifestyle_tags.push('Social smoker')
  if (pets)                       lifestyle_tags.push('Pet owner')
  if (social_level === 'very_social' || social_level === 'social') lifestyle_tags.push('Social butterfly')
  if (social_level === 'quiet' || social_level === 'private')      lifestyle_tags.push('Quiet evenings')
  lifestyle_tags.push(...pickN(['Gym-goer', 'Cyclist', 'Foodie', 'Remote worker'], 1))

  // bio substitution vars
  const scheduleDescMap: Record<string, string> = {
    early_riser: 'an early riser',
    night_owl:   'a night owl',
    hybrid:      'flexible with my hours',
  }
  const scheduleExampleMap: Record<string, string> = {
    early_riser: "I'm usually up by 7am and winding down by 10pm",
    night_owl:   'I tend to work late and have more energy in the evenings',
    hybrid:      'I mix early starts and late nights depending on the week',
  }
  const socialDescMap: Record<string, string> = {
    very_social: 'very social',
    social:      'sociable',
    quiet:       'quiet in the evenings',
    private:     'quite private',
  }
  const cleanlinessDescMap: Record<string, string> = {
    high:   'very clean',
    medium: 'reasonably tidy',
    low:    'relaxed about tidiness',
  }
  const employerDescMap: Record<string, string> = {
    startup:      'startup person',
    corporate:    'corporate professional',
    freelance:    'freelancer',
    student:      'student',
    public_sector: 'public sector worker',
  }

  const bioVars: Record<string, string> = {
    job_title,
    city,
    schedule_desc:     scheduleDescMap[schedule],
    schedule_example:  scheduleExampleMap[schedule],
    hobby_1:           hobbies[0] ?? 'reading',
    hobby_2:           hobbies[1] ?? 'cooking',
    cleanliness_desc:  cleanlinessDescMap[cleanliness],
    compatibility_note: pick(COMPAT_NOTES),
    neighbourhood:     preferred_neighbourhoods[0] ?? city,
    neighbourhood_pref: preferred_neighbourhoods[0] ?? city,
    years_ago:         pick(['a few months ago', 'about a year ago', '2 years ago', '3 years ago', 'last year']),
    social_desc:       socialDescMap[social_level],
    wfh_desc:          work_from_home ? 'work from home most days' : 'commute to the office daily',
    value_1:           pick(VALUES),
    value_2:           pick(VALUES),
    origin_city:       pick(ORIGIN_CITIES),
    employer_type_desc: employerDescMap[employerType],
    nationality_adj:   natData.adj,
    languages:         languages.join(' and '),
    degree:            pick(["degree", "master's", 'MBA', 'PhD']),
    previous_city:     pick(PREVIOUS_CITIES),
  }

  const bioTemplate = pick(BIO_TEMPLATES)
  const bio = bioTemplate.replace(/\{(\w+)\}/g, (_, key) => bioVars[key] ?? '')

  const flat_type_preference = pickWeighted(
    ['whole_flat', 'shared', 'either'],
    [0.30, 0.40, 0.30]
  ) as 'whole_flat' | 'shared' | 'either'

  const score = Math.min(95, Math.max(55,
    70 +
    (cleanliness === 'high' ?  5 : cleanliness === 'low' ? -5 : 0) +
    (!smoking               ?  3 : 0) +
    (work_from_home         ?  1 : 0) +
    rand(-10, 10)
  ))

  return {
    user_id: null,
    type: 'flatmate',
    score,
    status: 'pending',
    data: {
      name,
      age,
      job_title,
      employer_type: employerType,
      city,
      avatar: `https://i.pravatar.cc/150?u=${randomUUID()}`,
      lifestyle_tags,
      bio,
      schedule,
      cleanliness,
      smoking,
      pets,
      pet_types,
      work_from_home,
      social_level,
      budget_min,
      budget_max,
      move_in_date: isoDateAhead('2026-04-05', rand(0, 90)),
      preferred_neighbourhoods,
      flat_type_preference,
      languages,
      nationality: natData.nat,
      hobbies,
      dealbreakers,
    },
    match_reasons: [],
    trade_offs: [],
    agent_reasoning: null,
  }
}

function generateAllFlatmates(): unknown[] {
  const CITY_COUNTS: Record<string, number> = {
    Madrid:    2500,
    Barcelona: 1500,
    Valencia:  1000,
  }

  const flatmates: unknown[] = []
  for (const [city, count] of Object.entries(CITY_COUNTS)) {
    for (let i = 0; i < count; i++) {
      flatmates.push(generateFlatmate(city))
    }
  }
  return flatmates
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting Estato training data seed...')
  console.log('')

  console.log('Generating 10,000 listings...')
  const listings = generateAllListings()
  await insertBatch('matches', listings)
  console.log('Listings complete.')
  console.log('')

  console.log('Generating 5,000 flatmate profiles...')
  const flatmates = generateAllFlatmates()
  await insertBatch('matches', flatmates)
  console.log('Flatmate profiles complete.')
  console.log('')

  console.log('All done. 15,000 records inserted.')
}

main().catch(console.error)
