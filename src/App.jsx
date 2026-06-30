import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { LISTINGS } from "./listings.js";
import { auth, db } from "./supabase.js";

// ─── Theme Context ────────────────────────────────────────────────────────────
const ThemeCtx = createContext({});
function useTheme() { return useContext(ThemeCtx); }

// ─── Smart Search Engine ──────────────────────────────────────────────────────
// Gives Alex the ability to query 10,000 listings efficiently.
// Called by the app before sending recommendations to Alex.

function searchListings(query = {}) {
  const {
    cities, countries, areas, types, minBeds, maxBeds,
    minPrice, maxPrice, isForRent, petFriendly, parking,
    outdoor, quiet, nearTransport, features, styles, sortBy, limit,
  } = query;

  const applyFilters = (strict) => {
    let results = [...LISTINGS];
    if (cities?.length) results = results.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()));
    if (countries?.length) results = results.filter(l => countries.some(c => l.country?.toLowerCase() === c.toLowerCase()));
    if (areas?.length) results = results.filter(l => areas.some(a => l.area?.toLowerCase().includes(a.toLowerCase())));
    if (types?.length) results = results.filter(l => types.includes(l.type));
    if (minBeds != null) results = results.filter(l => l.bedrooms >= minBeds);
    if (maxBeds != null) results = results.filter(l => l.bedrooms <= maxBeds);
    if (minPrice != null) results = results.filter(l => l.price >= minPrice);
    if (maxPrice != null) results = results.filter(l => l.price <= maxPrice);
    if (isForRent != null) results = results.filter(l => l.isForRent === isForRent);
    if (strict) {
      if (petFriendly != null) results = results.filter(l => l.petFriendly === petFriendly);
      if (parking != null) results = results.filter(l => l.parking === parking);
      if (outdoor != null) results = results.filter(l => l.outdoor === outdoor);
      if (quiet != null) results = results.filter(l => l.quiet === quiet);
      if (nearTransport != null) results = results.filter(l => l.nearTransport === nearTransport);
      if (features?.length) results = results.filter(l => features.some(f => l.features?.some(lf => lf.toLowerCase().includes(f.toLowerCase()))));
      if (styles?.length) results = results.filter(l => styles.some(s => l.style?.toLowerCase().includes(s.toLowerCase())));
    }
    return results;
  };

  // Try strict (all filters), then relax boolean/feature flags
  let results = applyFilters(true);
  if (results.length < 3) results = applyFilters(false);

  // Fallback: drop areas, keep city + rent + price with 30% budget flex
  if (results.length < 3) {
    let r = [...LISTINGS];
    if (cities?.length) r = r.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()));
    if (isForRent != null) r = r.filter(l => l.isForRent === isForRent);
    if (maxPrice != null) r = r.filter(l => l.price <= maxPrice * 1.3);
    if (minBeds != null) r = r.filter(l => l.bedrooms >= minBeds);
    results = r;
  }

  // Last resort: just city + isForRent
  if (results.length < 3) {
    let r = [...LISTINGS];
    if (cities?.length) r = r.filter(l => cities.some(c => l.city?.toLowerCase() === c.toLowerCase()));
    if (isForRent != null) r = r.filter(l => l.isForRent === isForRent);
    results = r;
  }

  if (sortBy === 'price_asc') results.sort((a, b) => a.price - b.price);
  else if (sortBy === 'price_desc') results.sort((a, b) => b.price - a.price);
  else if (sortBy === 'beds_desc') results.sort((a, b) => b.bedrooms - a.bedrooms);
  else results.sort(() => Math.random() - 0.5);

  return results.slice(0, limit || 20);
}

// Filters user-added landlord listings against a search query.
// Budget tolerance is 20% so "close to criteria" listings are included.
function matchUserListings(userListings, query = {}) {
  if (!userListings?.length) return [];
  const { isForRent, maxPrice, minPrice, minBeds, cities } = query;
  const FLEX = 0.20;
  return userListings.filter(l => {
    if (l.isRentedOut) return false; // off market — don't surface to renters
    if (isForRent != null && l.isForRent !== isForRent) return false;
    if (maxPrice != null && l.price > maxPrice * (1 + FLEX)) return false;
    if (minPrice != null && l.price < minPrice * (1 - FLEX)) return false;
    if (minBeds != null && (l.bedrooms || 0) < minBeds) return false;
    if (cities?.length && !cities.some(c => l.city?.toLowerCase() === c.toLowerCase())) return false;
    return true;
  }).map(l => ({ ...l, _userListing: true }));
}

// Build a compact summary of the database for Alex's system prompt
function buildDBSummary() {
  const cities = [...new Set(LISTINGS.map(l => l.city))].sort();
  const totalForRent = LISTINGS.filter(l => l.isForRent).length;
  const totalForSale = LISTINGS.length - totalForRent;
  const types = [...new Set(LISTINGS.map(l => l.type))];
  const priceMin = Math.min(...LISTINGS.map(l => l.price));
  const priceMax = Math.max(...LISTINGS.map(l => l.price));
  return {
    total: LISTINGS.length,
    forRent: totalForRent,
    forSale: totalForSale,
    cities,
    types,
    priceMin,
    priceMax,
  };
}


// ─── System Prompt (built dynamically with live DB stats) ────────────────────
function buildSystemPrompt(userProfile = null) {
  const db = buildDBSummary();
  const profileContext = userProfile ? buildProfileContext(userProfile) : "";
  return `You are Alex, a world-class luxury real estate consultant with 20 years of experience placing exceptional clients in exceptional homes across London, New York, California, Florida and beyond. You work exclusively for Estato — a boutique property house known for its white-glove service and curated portfolio.

═══════════════════════════════════════
WHO YOU ARE
═══════════════════════════════════════

You are not a chatbot. You are a seasoned professional who has helped CEOs, artists, young families, retirees and everyone in between find their perfect home. You have walked every type of property — from cramped studio flats to sprawling country estates — and you have a genuine passion for matching people with spaces that transform their lives.

You grew up in London, studied architecture at UCL, spent 5 years at Knight Frank before founding your own practice, and joined Estato 8 years ago. You have an eye for detail, a memory for what clients tell you, and an instinct for what people really want versus what they think they want.

═══════════════════════════════════════
YOUR PERSONALITY & CONVERSATIONAL STYLE
═══════════════════════════════════════

WARMTH WITHOUT SYCOPHANCY
You are genuinely warm and interested in people — but you never say hollow things like "Great question!" or "Absolutely!" You respond like a real person who is paying close attention.

ONE QUESTION AT A TIME
This is non-negotiable. You ask exactly one question per message. Never two. The best estate agents listen more than they talk. Let the client unfold naturally.

READ BETWEEN THE LINES
When someone says "I want something quiet", they might mean they've had noisy neighbours. When they say "good schools nearby", they're probably a parent even if they haven't said so. Pick up on these signals and gently explore them.

BE HONEST, EVEN WHEN IT'S UNCOMFORTABLE
If a client's budget doesn't match their wishlist, say so kindly but clearly. Trust is built on honesty, not on telling people what they want to hear.

REMEMBER EVERYTHING
You have perfect memory of this conversation. If someone mentions a dog in message 2, remember it in message 8. Real agents take notes — you never forget.

ADAPT YOUR TONE
With a first-time buyer who seems nervous — be reassuring and educational.
With a seasoned investor — be direct, data-led, and skip the basics.
With someone going through a life change — be sensitive and acknowledge the emotional weight.

═══════════════════════════════════════
YOUR PROPERTY DATABASE
═══════════════════════════════════════

${profileContext ? `═══════════════════════════════════════
CLIENT PROFILE — READ THIS FIRST
═══════════════════════════════════════
${profileContext}

CRITICAL BEHAVIOUR WHEN PROFILE EXISTS:
1. Do NOT ask questions you already have answers to. You know their budget, cities, property type, must-haves, commute, timeline.
2. On the VERY FIRST MESSAGE: greet them by first name, give a 2-3 sentence summary of what you know ("So you're looking to buy in London, budget up to £600k, need parking..."), then IMMEDIATELY output a <PROPERTY_SEARCH> block and present 2-3 specific properties that match their profile with a sentence on why each suits them.
3. Your first message should feel like a prepared agent who has done their homework — not someone asking the client to repeat themselves.
4. Reference their commute destination, must-haves and lifestyle context naturally.
5. Update the profile as you learn more via the <PROFILE_UPDATE> block.

` : ""}You have access to a curated portfolio of ${db.total.toLocaleString()} properties:
- ${db.forSale.toLocaleString()} for sale, ${db.forRent.toLocaleString()} to rent
- ${db.types.join(", ")}
- Cities: ${db.cities.join(", ")}
- Price range: from £400/month rent up to $9.9M sale

The app will search this database automatically based on what the client tells you. Your job is to have the conversation — gather location, budget, lifestyle, must-haves — and the system will surface matching properties in real-time alongside your chat.

WHAT PROPERTIES INCLUDE:
Each listing has: title, location, city, area, price, isForRent, type, bedrooms, bathrooms, sqft, features, petFriendly, parking, outdoor, quiet, nearTransport, style, neighbourhood, schools, commute, annualServiceCharge (apartments), description, tag.

KEY MATCHING RULES:
- Children mentioned → schools field becomes critical — mention school ratings
- Workplace mentioned → check commute field and reference travel times
- Apartment recommendation → always mention annualServiceCharge (real ongoing cost)
- Quiet/nature wanted → outdoor=true and quiet=true listings
- Investment interest → flag rental yield potential and tax advantages
- Budget vs wishlist mismatch → say so honestly, explain trade-offs
- Pet mentioned → filter petFriendly=true listings only

═══════════════════════════════════════
HOW TO CONDUCT THIS CONSULTATION
═══════════════════════════════════════

PHASE 1 — ESTABLISH CONTEXT (messages 1–3)
- Are they buying or renting? Where? What's prompting this move?

PHASE 2 — UNDERSTAND LIFE (messages 3–6)
- Daily life, family, pets, working from home?
- "What does your dream Sunday morning look like?" — reveals outdoor space needs, pace of life
- What have they lived in before and what didn't work?

PHASE 3 — PRACTICAL PARAMETERS (messages 5–8)
- Budget (gently — "What sort of range are you working with?")
- Size needs, non-negotiables

PHASE 4 — SURFACE & REFINE (messages 7+)
- The app surfaces properties in real-time. Your job is to explain WHY each one suits this specific client based on what they've told you.
- Ask what they think. Refine. Their reaction tells you more than any question.

═══════════════════════════════════════
PROPERTY SEARCH — MANDATORY BEHAVIOUR
═══════════════════════════════════════

THIS IS THE MOST IMPORTANT RULE IN YOUR INSTRUCTIONS.

You MUST output a <PROPERTY_SEARCH> block at the end of EVERY response — no exceptions, including your very first message. This is how the app displays properties on screen. If you do not include it, the sidebar stays empty and the client sees nothing. When you have a client profile, search immediately on message one. Even if you only know the city so far, output a broad search. Refine it with every new message as you learn more.

DO NOT describe properties in your text. DO NOT list areas or suggest neighbourhoods in prose. The <PROPERTY_SEARCH> block handles all of that — it pulls real listings from the database. Your conversational text should ask questions and react to what the client says. The properties appear automatically on screen beside the chat.

EVERY response MUST end with this block — including your very first reply:

<PROPERTY_SEARCH>
{
  "cities": ["London"],
  "areas": ["Bethnal Green", "Whitechapel", "Shoreditch"],
  "isForRent": true,
  "minBeds": 1,
  "maxBeds": 2,
  "maxPrice": 1100,
  "nearTransport": true,
  "types": ["apartment", "house", "studio"],
  "sortBy": "random",
  "limit": 6,
  "matchReasons": {
    "summary": "Looking to rent near Liverpool Street, up to £1,100/month, needs washing machine, prefers dishwasher.",
    "whyThese": "These are all within your £1,100 budget, close to Liverpool Street, and in the East London areas we discussed."
  }
}
</PROPERTY_SEARCH>

RULES FOR THE SEARCH BLOCK:
- Include it in EVERY message, always, no exceptions — including your very first message
- Start with city + isForRent + maxPrice only. Add areas and types as you learn them
- DO NOT include "features", "nearTransport", "petFriendly", "parking", "quiet", or "outdoor" in the JSON — these over-filter and return zero results. Mention them in your conversational text instead
- Update the block every message as you learn more
- limit: use 6
- sortBy: use "random" unless client asked to sort by price
- matchReasons.summary: one sentence summarising what this client wants so far
- matchReasons.whyThese: one sentence connecting results to what the client said

SEARCH FIELDS (all optional — only include what you know):
- cities: string[] — e.g. ["London"]
- countries: string[] — e.g. ["UK"]
- areas: string[] — London neighbourhoods or city areas
- types: string[] — apartment, house, cottage, loft, townhouse, villa, studio
- isForRent: boolean — true=rent, false=sale (include as soon as you know)
- minBeds / maxBeds: number
- minPrice / maxPrice: number — monthly rent OR sale price
- petFriendly: boolean — only set true if they mentioned a pet
- parking: boolean
- outdoor: boolean
- quiet: boolean
- nearTransport: boolean
- features: string[] — e.g. ["washing machine", "garden", "dishwasher"]
- styles: string[] — e.g. ["Victorian", "Georgian", "Modern"]
- sortBy: "price_asc" | "price_desc" | "beds_desc" | "random"
- limit: number (5-6 recommended)

ABSOLUTE RULES:
- Never break character. Never mention Claude, AI, or language models.
- Never ask two questions in one message.
- Never be sycophantic.
- Always remember what the client has told you.
- ALWAYS end every message after the first with a <PROPERTY_SEARCH> block.`;
}

// ─── Profile Context Builder ─────────────────────────────────────────────────
function buildProfileContext(p) {
  if (!p) return "";
  const lines = [];
  if (p.full_name) lines.push(`Name: ${p.full_name}`);
  if (p.intent) lines.push(`Looking to: ${p.intent}`);
  if (p.budget_min || p.budget_max) {
    const min = p.budget_min ? `£${Math.round(p.budget_min / 1000)}k` : "";
    const max = p.budget_max ? `£${Math.round(p.budget_max / 1000)}k` : "";
    lines.push(`Budget: ${[min, max].filter(Boolean).join(" – ")}`);
  }
  if (p.cities?.length) lines.push(`Preferred cities: ${p.cities.join(", ")}`);
  if (p.areas?.length) lines.push(`Preferred areas: ${p.areas.join(", ")}`);
  if (p.types?.length) lines.push(`Property types: ${p.types.join(", ")}`);
  if (p.must_haves?.length) lines.push(`Must-haves: ${p.must_haves.join(", ")}`);
  if (p.commute_destination) lines.push(`Commutes to: ${p.commute_destination}${p.commute_max_minutes ? ` (max ${p.commute_max_minutes} mins)` : ""}`);
  if (p.partner_preferences) lines.push(`Partner/lifestyle: ${p.partner_preferences}`);
  if (p.timeline) lines.push(`Timeline: ${p.timeline}`);
  const flags = [p.pet_friendly && "pet-friendly", p.parking && "needs parking", p.outdoor && "wants outdoor space", p.quiet && "prefers quiet area", p.near_transport && "near transport"].filter(Boolean);
  if (flags.length) lines.push(`Preferences: ${flags.join(", ")}`);
  if (p.notes) lines.push(`Notes: ${p.notes}`);
  return lines.join("\n");
}

// ─── Profile Update Parser ────────────────────────────────────────────────────
const parseProfileUpdate = (text) => {
  const match = text.match(/<PROFILE_UPDATE>([\s\S]*?)<\/PROFILE_UPDATE>/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
};
const stripProfileUpdate = (text) =>
  text.replace(/<PROFILE_UPDATE>[\s\S]*?<\/PROFILE_UPDATE>/g, "").trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (price, currency = "£", isForRent = false) => {
  const sym = currency || "£";
  if (isForRent) return `${sym}${price.toLocaleString()}/mo`;
  if (price >= 1000000) return `${sym}${(price / 1000000).toFixed(1)}M`;
  return `${sym}${Math.round(price / 1000)}k`;
};
const parseSearchQuery = (text) => {
  const match = text.match(/<PROPERTY_SEARCH>([\s\S]*?)<\/PROPERTY_SEARCH>/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
};
const stripSearchQuery = (text) =>
  text.replace(/<PROPERTY_SEARCH>[\s\S]*?<\/PROPERTY_SEARCH>/g, "").trim();

// ─── Avatar helpers ────────────────────────────────────────────────────────────
const avatarKey = (uid) => `estato_avatar_${uid}`;

function resizeImageToDataURL(file, maxPx = 200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Connections Storage ───────────────────────────────────────────────────────
const connectionsKey = (uid) => `estato_connections_${uid || "guest"}`;
const loadConnections = (uid) => {
  try { return new Set(JSON.parse(localStorage.getItem(connectionsKey(uid)) || "[]")); }
  catch { return new Set(); }
};
const saveConnections = (uid, set) => {
  try { localStorage.setItem(connectionsKey(uid), JSON.stringify([...set])); } catch { }
};

// ─── Direct Conversations Storage ────────────────────────────────────────────
const directConvosKey = (uid) => `estato_direct_convos_${uid || "guest"}`;
const loadDirectConvos = (uid) => {
  try { return JSON.parse(localStorage.getItem(directConvosKey(uid)) || "[]"); }
  catch { return []; }
};
const saveDirectConvos = (uid, convos) => {
  try { localStorage.setItem(directConvosKey(uid), JSON.stringify(convos)); } catch { }
};

// ─── User Listings Storage ────────────────────────────────────────────────────
const userListingsKey = (uid) => `estato_user_listings_${uid || "guest"}`;
const loadUserListings = (uid) => {
  try { return JSON.parse(localStorage.getItem(userListingsKey(uid)) || "[]"); }
  catch { return []; }
};
const saveUserListings = (uid, listings) => {
  try { localStorage.setItem(userListingsKey(uid), JSON.stringify(listings)); } catch { }
};

// ─── Conversation Storage ─────────────────────────────────────────────────────
const STORAGE_KEY = "estato_conversations";

function loadConversations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveConversations(convos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(convos)); } catch { }
}
function saveCurrentConversation(id, messages, recommendations, summaryText) {
  const convos = loadConversations();
  const idx = convos.findIndex(c => c.id === id);
  const preview = messages.filter(m => !m.hidden).find(m => m.role === "user")?.display
    || messages.filter(m => !m.hidden).find(m => m.role === "user")?.content
    || "New conversation";
  const entry = {
    id, updatedAt: Date.now(),
    preview: preview.slice(0, 80),
    summary: summaryText || "",
    messages, recommendations,
  };
  if (idx >= 0) convos[idx] = entry;
  else convos.unshift(entry);
  // Keep max 20 conversations
  saveConversations(convos.slice(0, 20));
}
function deleteConversation(id) {
  const convos = loadConversations().filter(c => c.id !== id);
  saveConversations(convos);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function formatRelTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Svg = ({ d, size = 18, stroke = "currentColor", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const I = {
  home: ["M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M9 22V12h6v10"],
  chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  heart: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0",
  settings: ["M12 15a3 3 0 100-6 3 3 0 000 6z", "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"],
  user: ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", "M12 11a4 4 0 100-8 4 4 0 000 8z"],
  send: ["M22 2L11 13", "M22 2L15 22 8 13 2 9z"],
  close: ["M18 6L6 18", "M6 6l12 12"],
  people: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100 8 4 4 0 000-8z",
  pin: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", "M12 10a1 1 0 100-2 1 1 0 000 2"],
  bed: ["M2 4v16", "M2 8h18a2 2 0 012 2v10", "M2 8a2 2 0 012-2h12", "M6 8v4"],
  bath: ["M9 6L9 2", "M15 6V2", "M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"],
  resize: ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"],
  messages: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  shorts: ["M23 7l-7 5 7 5V7z", "M1 5h13a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z"],
};

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick, badge, compact }) {
  const T = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={compact ? label : undefined}
      style={{
        display: "flex", alignItems: "center",
        justifyContent: compact ? "center" : "flex-start",
        gap: compact ? 0 : 10,
        padding: compact ? "12px" : "10px 12px",
        borderRadius: 8, width: "100%",
        background: active ? T.navActive : hovered ? T.surfaceHover : "transparent",
        border: "none", cursor: "pointer",
        color: active ? T.navActiveText : T.navText,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s", textAlign: "left",
        position: "relative",
      }}>
      <span style={{ color: active ? T.gold : hovered ? T.gold : T.navIcon, transition: "color 0.15s", flexShrink: 0 }}>
        <Svg d={I[icon]} size={16} stroke="currentColor" />
      </span>
      {!compact && label}
      {badge > 0 && (
        compact
          ? <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: T.gold }} />
          : <span style={{ marginLeft: "auto", background: T.gold, color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>{badge}</span>
      )}
    </button>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  const T = useTheme();
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, #c9a84c, #8b6520)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
      }}>🧑‍💼</div>
      <div style={{
        padding: "12px 16px", borderRadius: "4px 14px 14px 14px",
        background: T.surface, border: `1px solid ${T.border}`,
        display: "flex", gap: 4, alignItems: "center",
        boxShadow: T.shadow
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "#c9a84c",
            display: "inline-block",
            animation: `typingBounce 1.2s ${i * 0.2}s infinite ease-in-out`
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar Property Card ────────────────────────────────────────────────────
function SidebarCard({ property, matchScore, reason, isTop, onClick, isFavourited, onFavourite, onShare }) {
  const T = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface, borderRadius: 12,
        border: isTop ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
        overflow: "hidden", cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? T.shadowHover : isTop ? "0 2px 12px rgba(201,168,76,0.12)" : T.shadow,
        transition: "all 0.2s"
      }}>
      <div style={{ position: "relative" }}>
        <img src={property.image} alt={property.title}
          style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: isTop ? T.gold : "rgba(0,0,0,0.55)",
          color: "#fff",
          padding: "3px 8px", borderRadius: 6,
          fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700
        }}>{isTop ? `★ ${matchScore}%` : `${matchScore}% match`}</div>
        {(property._userListing || property.tag) && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: property._userListing ? "rgba(90,138,74,0.92)" : "rgba(0,0,0,0.55)",
            padding: "3px 8px", borderRadius: 6,
            fontSize: 10, fontFamily: "'DM Sans', sans-serif",
            color: "#fff", fontWeight: 500
          }}>{property._userListing ? "Owner listed" : property.tag}</div>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3, flex: 1 }}>{property.title}</div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {onShare && <button onClick={e => { e.stopPropagation(); onShare(property); }} title="Share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1, color: T.textMuted }}>↗</button>}
            {onFavourite && <button onClick={e => { e.stopPropagation(); onFavourite(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 15, lineHeight: 1, color: isFavourited ? "#e74c3c" : T.textMuted }}>{isFavourited ? "♥" : "♡"}</button>}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.textSub, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3, marginBottom: 8 }}>
          <Svg d={I.pin} size={10} stroke={T.gold} /> {property.location}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginBottom: 2 }}>{formatPrice(property.price, property.currency, property.isForRent)}</div>
        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, fontStyle: "italic" }}>Indicative price · not a formal offer</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textSub, fontFamily: "'DM Sans', sans-serif" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Svg d={I.bed} size={11} stroke={T.gold} /> {property.bedrooms} bed</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Svg d={I.bath} size={11} stroke={T.gold} /> {property.bathrooms} bath</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Svg d={I.resize} size={11} stroke={T.gold} /> {property.sqft.toLocaleString()}</span>
        </div>
        {reason && (
          <div style={{
            marginTop: 9, paddingTop: 9, borderTop: "1px solid #f0ebe0",
            fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.55, fontStyle: "italic"
          }}>{reason}</div>
        )}
      </div>
    </div>
  );
}

// ─── Property Detail Modal ────────────────────────────────────────────────────
// ─── Swipe Mode ──────────────────────────────────────────────────────────────
function SwipeMode({ listings, startIndex = 0, onClose, isFavourited, onFavourite, userPrefs }) {
  const [idx, setIdx] = useState(startIndex);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState(null);
  const [exiting, setExiting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const dragStart = useRef(null);
  const dragMoved = useRef(false);
  const cardRef = useRef(null);

  const property = listings[idx];
  const next = listings[idx + 1];

  const THRESHOLD = 100;

  const handleDragStart = (e) => {
    dragStart.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    dragMoved.current = false;
    setDragging(true);
  };

  const handleDragMove = (e) => {
    if (!dragging || dragStart.current === null) return;
    const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const delta = x - dragStart.current;
    if (Math.abs(delta) > 6) dragMoved.current = true;
    setDrag(delta);
    setDirection(delta > 20 ? 'right' : delta < -20 ? 'left' : null);
  };

  const handleDragEnd = () => {
    setDragging(false);
    if (!dragMoved.current) {
      // Pure tap — toggle detail sheet
      setShowDetail(s => !s);
      setDrag(0); setDirection(null);
      dragStart.current = null;
      return;
    }
    if (Math.abs(drag) >= THRESHOLD) {
      const isRight = drag > 0;
      if (isRight && !isFavourited(property.id)) onFavourite(property);
      setExiting(true); setDirection(isRight ? 'right' : 'left');
      setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
    } else {
      setDrag(0); setDirection(null);
    }
    dragStart.current = null;
  };

  const swipeRight = () => {
    if (!isFavourited(property.id)) onFavourite(property);
    setExiting(true); setDirection('right');
    setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
  };
  const swipeLeft = () => {
    setExiting(true); setDirection('left');
    setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
  };

  if (!property) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.9)', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>You've seen them all!</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Check your favourites for the ones you saved.</div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '12px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #c9a84c, #8b6520)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>View favourites</button>
      </div>
    );
  }

  const rotation = drag / 18;
  const likeOpacity = Math.min(1, drag / THRESHOLD);
  const nopeOpacity = Math.min(1, -drag / THRESHOLD);
  const exitTransform = exiting
    ? direction === 'right' ? 'translateX(120%) rotate(20deg)' : 'translateX(-120%) rotate(-20deg)'
    : `translateX(${drag}px) rotate(${rotation}deg)`;

  const budgetMax = userPrefs?.budget_max;
  const pricePct = budgetMax ? Math.round((property.price / budgetMax) * 100) : null;
  const withinBudget = budgetMax ? property.price <= budgetMax : null;
  const commuteMatch = property.commute?.match(/(\d+)\s*min/);
  const commuteMin = commuteMatch ? parseInt(commuteMatch[1]) : null;
  const commuteMax = userPrefs?.commute_max_minutes;
  const commuteOk = commuteMax && commuteMin ? commuteMin <= commuteMax : null;

  // Nearby POIs (same seed logic as PropertyModal)
  const seed = property.id * 7;
  const rng = (n, o = 0) => ((seed + o * 31) % n);
  const transitData = { London: [['Tube', '🚇'], ['Overground', '🚆'], ['Bus', '🚌']], 'New York': [['Subway', '🚇'], ['Bus', '🚌'], ['LIRR', '🚆']], default: [['Metro', '🚇'], ['Bus', '🚌'], ['Tram', '🚋']] };
  const cityTransit = transitData[property.city] || transitData.default;
  const nearbyTransit = cityTransit.slice(0, 2).map(([name, icon], i) => ({ name, icon, distance: `${2 + rng(8, i * 3)} min walk` }));
  const foodTypes = [['Italian', '🍝'], ['Japanese', '🍜'], ['Coffee', '☕'], ['Bakery', '🥐'], ['Gastropub', '🍺'], ['French', '🥖']];
  const nearbyFood = Array.from({ length: 3 }, (_, i) => { const [t, ic] = foodTypes[(rng(foodTypes.length, i * 11) + i * 3) % foodTypes.length]; return { type: t, icon: ic, dist: `${1 + rng(8, i * 13)} min` }; });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.9)', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", backdropFilter: 'blur(8px)' }}>
      <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Est<span style={{ color: '#c9a84c' }}>ato</span> <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>Swipe</span></div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{idx + 1} / {listings.length}</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.1)' }}>
        <div style={{ height: '100%', background: '#c9a84c', width: `${(idx / listings.length) * 100}%`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Card stack */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 580, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Background next card */}
        {next && (
          <div style={{ position: 'absolute', width: '100%', borderRadius: 24, overflow: 'hidden', background: '#1a1410', transform: `scale(${0.93 + Math.min(0.07, Math.abs(drag) / 1000)})`, transition: dragging ? 'none' : 'transform 0.3s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <img src={next.image} alt="" style={{ width: '100%', height: 340, objectFit: 'cover', opacity: 0.6 }} />
            <div style={{ padding: '14px 18px', background: '#1a1410' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{next.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{next.location}</div>
            </div>
          </div>
        )}

        {/* Main swipeable card */}
        <div
          ref={cardRef}
          onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
          style={{ position: 'absolute', width: '100%', borderRadius: 24, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', transform: exitTransform, transition: exiting || !dragging ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', userSelect: 'none' }}
        >
          {/* Image */}
          <div style={{ position: 'relative' }}>
            <img src={property.image} alt={property.title} draggable={false} style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(80,180,80,0.5), transparent)', opacity: likeOpacity, pointerEvents: 'none', display: 'flex', alignItems: 'center', padding: 28 }}>
              <div style={{ border: '4px solid #5aba5a', borderRadius: 12, padding: '8px 18px', transform: 'rotate(-15deg)', opacity: likeOpacity }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#5aba5a', letterSpacing: 2 }}>SAVE ♥</span>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(225deg, rgba(220,60,60,0.5), transparent)', opacity: nopeOpacity, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: 28 }}>
              <div style={{ border: '4px solid #e05555', borderRadius: 12, padding: '8px 18px', transform: 'rotate(15deg)', opacity: nopeOpacity }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#e05555', letterSpacing: 2 }}>SKIP ✕</span>
              </div>
            </div>
            <div style={{ position: 'absolute', top: 14, left: 14, background: '#c9a84c', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{property.tag}</div>
            {isFavourited(property.id) && <div style={{ position: 'absolute', top: 14, right: 14, background: '#e74c3c', color: '#fff', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>♥ Saved</div>}
            {/* Tap hint */}
            {!showDetail && !dragging && (
              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '5px 14px', borderRadius: 20, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                Tap for details
              </div>
            )}
          </div>

          {/* Brief info always shown */}
          <div style={{ background: '#1a1410', padding: '14px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{property.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Svg d={I.pin} size={10} stroke="#c9a84c" />{property.location}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#c9a84c' }}>{formatPrice(property.price, property.currency, property.isForRent)}</div>
                {pricePct !== null && <div style={{ fontSize: 10, color: withinBudget ? '#7aba6a' : '#e09a50', marginTop: 1 }}>{withinBudget ? '✓' : '⚠'} {pricePct}% of budget</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ icon: I.bed, val: property.bedrooms, lbl: 'beds' }, { icon: I.bath, val: property.bathrooms, lbl: 'ba' }, { icon: I.resize, val: property.sqft?.toLocaleString(), lbl: 'ft²' }].map(({ icon, val, lbl }) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  <Svg d={icon} size={12} stroke="#c9a84c" />
                  <span style={{ fontWeight: 600, color: '#fff' }}>{val}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{lbl}</span>
                </div>
              ))}
              {commuteMin && <div style={{ marginLeft: 'auto', fontSize: 11, color: commuteOk === false ? '#e09a50' : 'rgba(255,255,255,0.45)' }}>🚇 {commuteMin} min</div>}
            </div>
          </div>

          {/* ── Detail sheet — slides up on tap ── */}
          {showDetail && (
            <div style={{ background: '#fff', animation: 'slideUp 0.28s ease', maxHeight: 420, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

              {/* Description */}
              <div style={{ padding: '16px 18px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>About</div>
                <p style={{ fontSize: 13, color: '#3a3028', lineHeight: 1.7, margin: 0 }}>{property.description}</p>
              </div>

              {/* KPI row */}
              {(pricePct !== null || commuteMin !== null) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 18px 0' }}>
                  {pricePct !== null && (
                    <div style={{ background: withinBudget ? '#f0f8ee' : '#fef9ee', border: `1.5px solid ${withinBudget ? '#b8e0a8' : '#f0d898'}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: withinBudget ? '#4a8a3a' : '#9a7a20', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{withinBudget ? '✓ Within budget' : '⚠ Over budget'}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1410' }}>{pricePct}%</div>
                      <div style={{ fontSize: 11, color: '#7a7060', marginTop: 1 }}>of your max</div>
                      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: '#e8e0d0' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, pricePct)}%`, background: withinBudget ? '#5aaa4a' : '#e8a030' }} />
                      </div>
                    </div>
                  )}
                  {commuteMin !== null && (
                    <div style={{ background: commuteOk === false ? '#fef9ee' : commuteOk ? '#f0f8ee' : '#faf8f4', border: `1.5px solid ${commuteOk === false ? '#f0d898' : commuteOk ? '#b8e0a8' : '#ede8de'}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{commuteOk ? '✓ Great commute' : commuteOk === false ? '⚠ Long commute' : 'Commute'}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1410' }}>{commuteMin} min</div>
                      <div style={{ fontSize: 11, color: '#7a7060', marginTop: 1 }}>{userPrefs?.commute_destination || 'to transport'}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Features */}
              <div style={{ padding: '14px 18px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Features</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {property.features?.map(f => (
                    <span key={f} style={{ padding: '4px 10px', borderRadius: 20, background: '#faf8f4', border: '1px solid #ede8de', fontSize: 11, color: '#3a3028', textTransform: 'capitalize' }}>✓ {f}</span>
                  ))}
                </div>
              </div>

              {/* Transport + Food */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 18px' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Transport</div>
                  {nearbyTransit.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1a1410' }}>
                        <span>{t.icon}</span>{t.name}
                      </div>
                      <span style={{ fontSize: 11, color: '#c9a84c', fontWeight: 600 }}>{t.distance}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nearby</div>
                  {nearbyFood.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span>{f.icon}</span>
                      <span style={{ fontSize: 12, color: '#1a1410' }}>{f.type}</span>
                      <span style={{ fontSize: 11, color: '#9a8f80', marginLeft: 'auto' }}>{f.dist}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schools */}
              {property.schools && (
                <div style={{ margin: '0 18px 14px', padding: '10px 12px', borderRadius: 9, background: '#faf8f4', border: '1px solid #ede8de', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🏫</span>
                  <div style={{ fontSize: 12, color: '#3a3028', lineHeight: 1.5 }}>{property.schools}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: -44, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, opacity: 0.4 }}>
          <span style={{ fontSize: 11, color: '#fff' }}>← skip</span>
          <span style={{ fontSize: 11, color: '#fff' }}>tap card for details</span>
          <span style={{ fontSize: 11, color: '#fff' }}>save →</span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 64 }}>
        <button onClick={swipeLeft} style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(220,60,60,0.6)', background: 'rgba(220,60,60,0.1)', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: '#e05555' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,60,60,0.25)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,60,60,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}>✕</button>
        <button onClick={() => setShowDetail(s => !s)} style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', background: showDetail ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showDetail ? '#c9a84c' : 'rgba(255,255,255,0.5)' }}>ℹ</button>
        <button onClick={swipeRight} style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(80,180,80,0.6)', background: isFavourited(property.id) ? 'rgba(80,180,80,0.3)' : 'rgba(80,180,80,0.1)', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: '#5aba5a' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(80,180,80,0.25)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isFavourited(property.id) ? 'rgba(80,180,80,0.3)' : 'rgba(80,180,80,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}>♥</button>
      </div>
    </div>
  );
}

function PropertyModal({ property, onClose, userPrefs, isFavourited, onFavourite, profile, user, onSwipe, onViewingRequest, onShare }) {
  const [tab, setTab] = useState("overview");
  const [imgIdx, setImgIdx] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showViewing, setShowViewing] = useState(false);
  const [viewingMsg, setViewingMsg] = useState("");
  const [viewingSent, setViewingSent] = useState(false);
  if (!property) return null;

  // Auto-generate viewing request text when opened
  const buildViewingMessage = () => {
    const name = profile?.full_name || user?.email?.split("@")[0] || "there";
    const phone = profile?.phone ? `
Phone: ${profile.phone}` : "";
    const intent = userPrefs?.intent === "renting" ? "rent" : "purchase";
    const budget = userPrefs?.budget_max ? ` My budget is up to £${Math.round(userPrefs.budget_max / 1000)}k.` : "";
    const timeline = userPrefs?.timeline ? ` I'm looking to move ${userPrefs.timeline.toLowerCase()}.` : "";
    const commute = userPrefs?.commute_destination ? ` I commute to ${userPrefs.commute_destination}.` : "";
    return `Hi,

I came across ${property.title} on Estato and I'm very interested in arranging a viewing.

I'm looking to ${intent} a property in ${property.city}.${budget}${timeline}${commute}

Would it be possible to schedule a viewing at your earliest convenience? I'm flexible on timing and can work around your availability.

Looking forward to hearing from you.

Best regards,
${name}${phone}`;
  };

  // ── Budget KPI ──
  const budgetMax = userPrefs?.budget_max;
  const budgetMin = userPrefs?.budget_min;
  const pricePct = budgetMax ? Math.min(100, Math.round((property.price / budgetMax) * 100)) : null;
  const withinBudget = budgetMax ? property.price <= budgetMax : null;

  // ── Monthly cost estimates ──
  const estimateMonthlyCosts = (p) => {
    const beds = p.bedrooms || 0;
    const sqft = p.sqft || 700;
    const city = p.city || '';
    const isLondon = city === 'London';
    const isNYC = city === 'New York';
    const isUK = ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Brighton', 'Bristol', 'Leeds', 'Glasgow'].includes(city);
    const currency = p.currency || '£';

    // Council tax / local tax (UK only, band B-E estimate by beds)
    const councilTaxMonthly = isUK ? (
      beds === 0 ? 90 : beds === 1 ? 110 : beds === 2 ? 140 : beds === 3 ? 175 : 210
    ) : null;

    // Utilities: gas + electric + water. Scales with sqft and bedrooms
    const utilitiesMonthly = isUK
      ? Math.round((sqft * 0.09 + beds * 15 + 60) / 10) * 10
      : isNYC
        ? Math.round((sqft * 0.1 + beds * 20 + 80) / 10) * 10
        : Math.round((sqft * 0.08 + beds * 12 + 50) / 10) * 10;

    // Broadband
    const broadband = isUK ? 35 : isNYC ? 60 : 40;

    // Contents insurance (renters) or buildings+contents (buyers)
    const insurance = p.isForRent
      ? (beds <= 1 ? 10 : beds <= 2 ? 15 : 22)
      : (beds <= 1 ? 35 : beds <= 2 ? 50 : beds <= 3 ? 70 : 95);

    // Service charge (flats/apartments — monthly portion of annual)
    const serviceCharge = p.annualServiceCharge
      ? Math.round(p.annualServiceCharge / 12)
      : p.type === 'apartment' ? (isLondon ? Math.round((200 + beds * 80)) : Math.round((120 + beds * 50))) : 0;

    // Ground rent (UK leasehold apartments only — for sale)
    const groundRent = (!p.isForRent && p.type === 'apartment' && isUK) ? (isLondon ? 50 : 25) : 0;

    // Mortgage protection / renters insurance extra buffer
    const contingency = Math.round((utilitiesMonthly + (councilTaxMonthly || 0)) * 0.05 / 5) * 5;

    const items = [
      councilTaxMonthly && { label: 'Council tax', amount: councilTaxMonthly, icon: '🏛', note: `Band ${beds <= 1 ? 'B' : beds <= 2 ? 'C' : beds <= 3 ? 'D' : 'E'} estimate` },
      { label: 'Gas & electricity', amount: Math.round(utilitiesMonthly * 0.75 / 5) * 5, icon: '⚡', note: 'Estimated' },
      { label: 'Water rates', amount: Math.round(utilitiesMonthly * 0.25 / 5) * 5, icon: '💧', note: isUK ? 'Metered est.' : 'Estimated' },
      { label: 'Broadband', amount: broadband, icon: '📡', note: 'Average tariff' },
      { label: p.isForRent ? 'Contents insurance' : 'Buildings & contents', amount: insurance, icon: '🛡', note: 'Indicative' },
      serviceCharge > 0 && { label: 'Service charge', amount: serviceCharge, icon: '🏢', note: p.annualServiceCharge ? 'From listing' : 'Estimated' },
      groundRent > 0 && { label: 'Ground rent', amount: groundRent, icon: '📜', note: 'Leasehold est.' },
      { label: 'Contingency buffer', amount: contingency, icon: '🔧', note: 'Repairs & misc' },
    ].filter(Boolean);

    const total = items.reduce((s, i) => s + i.amount, 0);
    return { items, total, currency };
  };
  const costs = estimateMonthlyCosts(property);
  const totalMonthly = property.isForRent ? property.price + costs.total : costs.total;

  // ── Commute parse ──
  const commuteText = property.commute || "";
  const commuteMatch = commuteText.match(/(\d+)\s*min/);
  const commuteMinutes = commuteMatch ? parseInt(commuteMatch[1]) : null;
  const commuteDestination = userPrefs?.commute_destination;
  const commuteMax = userPrefs?.commute_max_minutes;
  const commuteOk = commuteMax && commuteMinutes ? commuteMinutes <= commuteMax : null;

  // ── Nearby POIs — procedurally generated from city/area ──
  const idNum = typeof property.id === 'number'
    ? property.id
    : String(property.id).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const seed = (Math.abs(idNum) || 42) * 7;
  const rng = (n, offset = 0) => Math.abs((seed + offset * 31) % n);

  const transitData = {
    London: [["Tube", "🚇"], ["Overground", "🚆"], ["Bus", "🚌"], ["DLR", "🚈"]],
    "New York": [["Subway", "🚇"], ["Bus", "🚌"], ["LIRR", "🚆"], ["PATH", "🚇"]],
    default: [["Metro", "🚇"], ["Bus", "🚌"], ["Tram", "🚋"], ["Train", "🚆"]],
  };
  const cityTransit = transitData[property.city] || transitData.default;

  const nearbyTransit = cityTransit.slice(0, 3).map(([name, icon], i) => ({
    name, icon,
    distance: `${2 + rng(8, i * 3)} min walk`,
    lines: `${1 + rng(4, i * 5)} line${rng(4, i * 5) > 0 ? "s" : ""}`,
  }));

  const parks = [
    ["Victoria Park", "🌳"], ["Regent's Park", "🌿"], ["Hyde Park", "🌲"],
    ["Central Park", "🌳"], ["Riverside Park", "🌿"], ["City Park", "🌲"],
    ["Botanical Gardens", "🌸"], ["Memorial Park", "🍃"],
  ];
  const nearbyParks = [parks[rng(parks.length, 1)], parks[(rng(parks.length, 2) + 2) % parks.length]].map(([name, icon], i) => ({
    name, icon, distance: `${3 + rng(12, i * 7)} min walk`,
  }));

  const restaurantTypes = [
    ["Italian", "🍝"], ["Japanese", "🍜"], ["Coffee Shop", "☕"], ["Bakery", "🥐"],
    ["Gastropub", "🍺"], ["French Bistro", "🥖"], ["Tapas Bar", "🫒"], ["Brunch Spot", "🍳"],
    ["Thai", "🍛"], ["Wine Bar", "🍷"], ["Rooftop Bar", "🥂"], ["Deli", "🥙"],
  ];
  const nearbyFood = Array.from({ length: 5 }, (_, i) => {
    const [type, icon] = restaurantTypes[(rng(restaurantTypes.length, i * 11) + i * 3) % restaurantTypes.length];
    return { type, icon, distance: `${1 + rng(10, i * 13)} min walk`, rating: (3.8 + (rng(12, i * 17) / 10)).toFixed(1) };
  });

  const poiTypes = [
    ["Supermarket", "🛒"], ["Gym", "💪"], ["Cinema", "🎬"], ["Library", "📚"],
    ["Pharmacy", "💊"], ["Farmers Market", "🥦"], ["Art Gallery", "🎨"], ["Co-working", "💻"],
  ];
  const nearbyPOIs = Array.from({ length: 4 }, (_, i) => {
    const [name, icon] = poiTypes[(rng(poiTypes.length, i * 19) + i * 2) % poiTypes.length];
    return { name, icon, distance: `${2 + rng(15, i * 23)} min walk` };
  });

  const tags = [
    { label: "Pet Friendly", icon: "🐾", ok: property.petFriendly },
    { label: "Parking", icon: "🚗", ok: property.parking },
    { label: "Outdoor Space", icon: "🌿", ok: property.outdoor },
    { label: "Quiet Area", icon: "🤫", ok: property.quiet },
    { label: "Near Transport", icon: "🚇", ok: property.nearTransport },
  ].filter(t => t.ok);

  const images = property.images?.length > 1
    ? property.images.slice(0, 5)
    : [
      property.image,
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    ].filter(Boolean);

  const S = { // shared styles
    lbl: { fontSize: 10, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" },
    section: { marginBottom: 28 },
    pill: (active) => ({
      padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${active ? "#c9a84c" : "#ede8de"}`,
      background: active ? "#fdf8ee" : "transparent", cursor: "pointer",
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? "#7a5520" : "#7a7060",
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s"
    }),
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(20,16,10,0.6)",
      zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", animation: "fadeIn 0.2s ease", backdropFilter: "blur(6px)"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, overflow: "hidden",
        width: "100%", maxWidth: 720, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 40px 100px rgba(0,0,0,0.25)"
      }}>

        {/* ── Image carousel ── */}
        <div style={{ position: "relative", height: 260, flexShrink: 0, background: "#1a1410" }}>
          <img src={images[imgIdx]} alt={property.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.92, display: "block" }} />
          {/* Close */}

          <button onClick={onClose} style={{
            position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)", fontSize: 20, color: "#333", fontWeight: 300, lineHeight: 1
          }}>×
          </button>
          {/* Tag */}
          <div style={{ position: "absolute", top: 14, left: 14, background: "#c9a84c", color: "#fff", padding: "4px 11px", borderRadius: 6, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>{property.tag}</div>
          {/* Image nav */}
          <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
            {images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)} style={{
                width: i === imgIdx ? 20 : 7, height: 7, borderRadius: 4, border: "none", cursor: "pointer",
                background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.2s"
              }} />
            ))}
          </div>
          {/* Arrows */}
          {images.length > 1 && <>
            <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <button onClick={() => setImgIdx(i => (i + 1) % images.length)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </>}
        </div>

        {/* ── Header ── */}
        <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{property.title}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>
                <Svg d={I.pin} size={12} stroke="#c9a84c" /> {property.location}
                {property.neighbourhood && <span style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de", fontSize: 11, color: "#7a7060" }}>{property.neighbourhood}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0, marginLeft: 16 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#7a5520", fontFamily: "'DM Sans', sans-serif" }}>{formatPrice(property.price, property.currency, property.isForRent)}</div>
                {property.annualServiceCharge && <div style={{ fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>+£{property.annualServiceCharge.toLocaleString()}/yr service charge</div>}
              </div>
              {onShare && (
                <button onClick={() => onShare(property)} title="Share listing" style={{
                  width: 38, height: 38, borderRadius: "50%", border: "2px solid #ede8de",
                  background: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, transition: "all 0.2s", flexShrink: 0,
                }}>↗</button>
              )}
              {onFavourite && (
                <button onClick={onFavourite} title={isFavourited ? "Remove from favourites" : "Save to favourites"} style={{
                  width: 38, height: 38, borderRadius: "50%", border: `2px solid ${isFavourited ? "#e74c3c" : "#ede8de"}`,
                  background: isFavourited ? "#fff0ee" : "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, transition: "all 0.2s", flexShrink: 0,
                  boxShadow: isFavourited ? "0 2px 12px rgba(231,76,60,0.2)" : "none"
                }}>
                  {isFavourited ? "♥" : "♡"}
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, marginTop: 14, paddingBottom: 16, borderBottom: "1px solid #f0ebe0" }}>
            {[{ icon: I.bed, val: property.bedrooms, lbl: "beds" }, { icon: I.bath, val: property.bathrooms, lbl: "baths" }, { icon: I.resize, val: property.sqft?.toLocaleString(), lbl: "sqft" }].map(({ icon, val, lbl }) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>
                <Svg d={icon} size={14} stroke="#c9a84c" />
                <span style={{ fontWeight: 600 }}>{val}</span>
                <span style={{ color: "#9a8f80", fontSize: 12 }}>{lbl}</span>
              </div>
            ))}
            {tags.slice(0, 3).map(t => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#7a7060", fontFamily: "'DM Sans', sans-serif" }}>
                <span>{t.icon}</span>{t.label}
              </div>
            ))}
          </div>

          {/* Tab nav */}
          <div style={{ display: "flex", gap: 6, paddingTop: 14, paddingBottom: 2 }}>
            {["overview", "neighbourhood", "nearby"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={S.pill(tab === t)}>
                {{ overview: "📋 Overview", neighbourhood: "🗺 Neighbourhood", nearby: "📍 Nearby" }[t]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>

          {/* ════ OVERVIEW TAB ════ */}
          {tab === "overview" && (
            <div>
              {/* KPI cards */}
              {(pricePct !== null || commuteMinutes !== null) && (
                <div style={{ ...S.section }}>
                  <div style={S.lbl}>Your match</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {pricePct !== null && (
                      <div style={{ background: withinBudget ? "#f0f8ee" : "#fef9ee", border: `1.5px solid ${withinBudget ? "#b8e0a8" : "#f0d898"}`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: withinBudget ? "#4a8a3a" : "#9a7a20", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{withinBudget ? "✓ Within budget" : "⚠ Over budget"}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{pricePct}%</div>
                        <div style={{ fontSize: 12, color: "#7a7060", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>of your {budgetMax ? `£${Math.round(budgetMax / 1000)}k` : ""} max</div>
                        <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "#e8e0d0" }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(100, pricePct)}%`, background: withinBudget ? "#5aaa4a" : "#e8a030", transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    )}
                    {commuteMinutes !== null && (
                      <div style={{ background: commuteOk === false ? "#fef9ee" : commuteOk ? "#f0f8ee" : "#faf8f4", border: `1.5px solid ${commuteOk === false ? "#f0d898" : commuteOk ? "#b8e0a8" : "#ede8de"}`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                          {commuteOk === true ? "✓ Great commute" : commuteOk === false ? "⚠ Long commute" : "Commute"}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{commuteMinutes} min</div>
                        <div style={{ fontSize: 12, color: "#7a7060", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                          {commuteDestination ? `to ${commuteDestination}` : "to nearest transport"}
                        </div>
                        {commuteMax && <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>Your max: {commuteMax} min</div>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div style={S.section}>
                <div style={S.lbl}>About this property</div>
                <p style={{ fontSize: 14.5, color: "#3a3028", lineHeight: 1.75, fontFamily: "'DM Sans', sans-serif" }}>{property.description}</p>
              </div>

              {/* Monthly cost breakdown */}
              <div style={S.section}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={S.lbl}>Monthly cost estimate</div>
                  <span style={{ fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>excl. {property.isForRent ? "rent" : "mortgage"}</span>
                </div>

                {/* Total callout */}
                <div style={{ background: "linear-gradient(135deg, #1a1410, #2d2318)", borderRadius: 14, padding: "16px 20px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Sans', sans-serif" }}>
                      {property.isForRent ? "All-in total" : "Running costs"}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                      {costs.currency}{totalMonthly.toLocaleString()}<span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>/mo</span>
                    </div>
                    {property.isForRent && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 3 }}>
                        {costs.currency}{property.price.toLocaleString()} rent + {costs.currency}{costs.total.toLocaleString()} bills
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 32 }}>🏠</div>
                </div>

                {/* Line items — collapsible */}
                <button onClick={() => setShowCostBreakdown(s => !s)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "#faf8f4", border: "1px solid #ede8de",
                  borderRadius: showCostBreakdown ? "10px 10px 0 0" : 10, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif"
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#3a3028" }}>See full breakdown</span>
                  <span style={{ fontSize: 13, color: "#9a8f80", transform: showCostBreakdown ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                </button>
                {showCostBreakdown && <div style={{ border: "1px solid #ede8de", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                  {costs.items.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 16px",
                      background: i % 2 === 0 ? "#fff" : "#faf8f4",
                      borderBottom: i < costs.items.length - 1 ? "1px solid #f0ebe0" : "none"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{item.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif" }}>{item.note}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#3a3028", fontFamily: "'DM Sans', sans-serif" }}>
                        {costs.currency}{item.amount.toLocaleString()}<span style={{ fontSize: 11, color: "#9a8f80", fontWeight: 400 }}>/mo</span>
                      </div>
                    </div>
                  ))}
                  {/* Subtotal row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f5edd8", borderTop: "2px solid #e0d0a8" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5520", fontFamily: "'DM Sans', sans-serif" }}>Bills subtotal</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#7a5520", fontFamily: "'DM Sans', sans-serif" }}>{costs.currency}{costs.total.toLocaleString()}/mo</div>
                  </div>
                </div>}
                <div style={{ fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 12, lineHeight: 1.6, textAlign: "center", padding: "10px 14px", background: "#faf8f4", borderRadius: 8, border: "1px solid #ede8de" }}>
                  ⚠️ These are estimates only, based on property size, location and type. They are not guaranteed figures. Always verify costs independently before committing.
                </div>
              </div>

              {/* Features */}
              <div style={S.section}>
                <div style={S.lbl}>Features & finishes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {property.features.map(f => (
                    <span key={f} style={{ padding: "6px 13px", borderRadius: 20, background: "#faf8f4", border: "1px solid #ede8de", fontSize: 12.5, color: "#3a3028", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>✓ {f}</span>
                  ))}
                </div>
              </div>

              {/* Schools */}
              {property.schools && (
                <div style={S.section}>
                  <div style={S.lbl}>Schools nearby</div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🏫</span>
                    <div style={{ fontSize: 13.5, color: "#3a3028", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>{property.schools}</div>
                  </div>
                </div>
              )}

              {/* Request viewing */}
              <button onClick={() => { setViewingMsg(buildViewingMessage()); setShowViewing(true); setViewingSent(false); }} style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                border: "none", borderRadius: 11, cursor: "pointer",
                color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
                <span>📅</span> Request a Viewing
              </button>
            </div>
          )}

          {/* ════ NEIGHBOURHOOD TAB ════ */}
          {tab === "neighbourhood" && (
            <div>
              {/* Vibe */}
              <div style={S.section}>
                <div style={S.lbl}>Area vibe</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg, #fdf8ee, #faf4e4)", border: "1px solid #ede8de" }}>
                  <span style={{ fontSize: 28 }}>🏘</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{property.neighbourhood}</div>
                    <div style={{ fontSize: 13, color: "#7a7060", fontFamily: "'DM Sans', sans-serif", marginTop: 3 }}>{property.city} · {property.area}</div>
                  </div>
                </div>
              </div>

              {/* Transport */}
              <div style={S.section}>
                <div style={S.lbl}>Public transport</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {nearbyTransit.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{t.name}</div>
                          <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{t.lines}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#c9a84c", fontFamily: "'DM Sans', sans-serif" }}>{t.distance}</div>
                    </div>
                  ))}
                  {property.commute && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0f8ee", border: "1px solid #b8e0a8", fontSize: 13, color: "#3a6a2a", fontFamily: "'DM Sans', sans-serif" }}>
                      🚉 {property.commute}
                    </div>
                  )}
                </div>
              </div>

              {/* Parks */}
              <div style={S.section}>
                <div style={S.lbl}>Green spaces</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {nearbyParks.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{p.icon}</span>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{p.name}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#5a8a4a", fontFamily: "'DM Sans', sans-serif" }}>{p.distance}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other POIs */}
              <div style={S.section}>
                <div style={S.lbl}>Everyday essentials</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {nearbyPOIs.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{p.distance}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ NEARBY TAB ════ */}
          {tab === "nearby" && (
            <div>
              <div style={S.section}>
                <div style={S.lbl}>Food & drink nearby</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {nearbyFood.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 22 }}>{f.icon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{f.type}</div>
                          <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{f.distance}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "#c9a84c" }}>★</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{f.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.section}>
                <div style={S.lbl}>Places of interest</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {nearbyParks.concat(nearbyPOIs).slice(0, 6).map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: "#faf8f4", border: "1px solid #ede8de" }}>
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{p.distance}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map placeholder */}
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #ede8de", position: "relative" }}>
                <div style={{ height: 180, background: "linear-gradient(135deg, #e8f4e8 0%, #d4e8d4 50%, #c8e0c8 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 32 }}>🗺</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#3a6a3a", fontFamily: "'DM Sans', sans-serif" }}>{property.location}</div>
                  {property.lat && property.lon && (
                    <a href={`https://www.google.com/maps/@${property.lat},${property.lon},15z`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: "#5a9a5a", fontFamily: "'DM Sans', sans-serif", textDecoration: "none", padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.7)", border: "1px solid #a8d0a8" }}>
                      Open in Google Maps →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ════ VIEWING REQUEST OVERLAY ════ */}
        {showViewing && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(250,248,244,0.97)",
            borderRadius: 20, display: "flex", flexDirection: "column",
            zIndex: 10, animation: "slideUp 0.25s ease"
          }}>
            {/* Header */}
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #ede8de", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>Request a Viewing</div>
                <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{property.title} · {property.location}</div>
              </div>
              <button onClick={() => setShowViewing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {viewingSent ? (
              /* Success state */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f0f8ee", border: "2px solid #b8e0a8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>Request sent!</div>
                <div style={{ fontSize: 14, color: "#7a7060", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, maxWidth: 300 }}>
                  Your viewing request for <strong>{property.title}</strong> has been sent to the owner. You'll hear back shortly.
                </div>
                <button onClick={() => { setShowViewing(false); setViewingSent(false); }} style={{ marginTop: 8, padding: "10px 28px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #c9a84c, #8b6520)", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>
                  Back to property
                </button>
              </div>
            ) : (
              <>
                {/* Form body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
                  <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
                    ✨ Alex has drafted this for you based on your profile. Edit freely before sending.
                  </div>
                  <textarea
                    value={viewingMsg}
                    onChange={e => setViewingMsg(e.target.value)}
                    style={{
                      width: "100%", minHeight: 320, padding: "16px",
                      borderRadius: 12, border: "1.5px solid #ede8de",
                      background: "#fff", fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13.5, color: "#1a1410", lineHeight: 1.75,
                      resize: "vertical", outline: "none", transition: "border-color 0.15s"
                    }}
                    onFocus={e => e.target.style.borderColor = "#c9a84c"}
                    onBlur={e => e.target.style.borderColor = "#ede8de"}
                  />
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 9, background: "#fdf8ee", border: "1px solid #ede8de", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>📬</span>
                    <div style={{ fontSize: 12, color: "#7a6a48", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                      This message will be sent to the property owner or listing agent. They'll reply directly to your registered email address.
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #ede8de", display: "flex", gap: 10, flexShrink: 0 }}>
                  <button onClick={() => setViewingMsg(buildViewingMessage())} style={{
                    padding: "11px 18px", borderRadius: 9, border: "1.5px solid #ede8de",
                    background: "#fff", color: "#5a5248", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                    flexShrink: 0
                  }}>↺ Reset</button>
                  <button onClick={async () => {
                    if (user) {
                      try {
                        await db.addViewing(user.id, property, viewingMsg);
                        const updated = await db.getViewings(user.id);
                        setViewings(updated);
                      } catch (e) { console.error(e); }
                    }
                    if (onViewingRequest) onViewingRequest(property);
                    setViewingSent(true);
                  }} style={{
                    flex: 1, padding: "12px", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                    color: "#fff", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600
                  }}>Send viewing request →</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Onboarding Form ─────────────────────────────────────────────────────────
const CITIES_OPTIONS = ["London", "Manchester", "Edinburgh", "Bristol", "Birmingham", "Leeds", "Brighton", "Oxford", "Cambridge", "Bath", "New York", "Los Angeles", "Miami", "Barcelona", "Amsterdam", "Paris", "Berlin", "Lisbon", "Dubai", "Sydney"];
const TYPE_OPTIONS = ["Apartment", "House", "Studio", "Loft", "Townhouse", "Cottage", "Villa"];
const MUST_HAVE_OPTIONS = ["Washing machine", "Dishwasher", "Parking", "Garden / outdoor space", "Pet-friendly", "Home office", "Gym", "Concierge", "Balcony", "Near transport", "Quiet area", "EV charging"];
const TIMELINE_OPTIONS = ["ASAP", "Within 1 month", "1–3 months", "3–6 months", "6–12 months", "Just browsing"];

// ─── Path Chooser ────────────────────────────────────────────────────────────
function PathChooser({ userName, onQuestionnaire, onAlex }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "#f5f2ec",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1410", letterSpacing: "-0.5px" }}>
          Est<span style={{ color: "#c9a84c" }}>ato</span>
        </div>
        <div style={{ fontSize: 13, color: "#b8b0a0", marginTop: 4 }}>Real Estate Platform</div>
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 480 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1410", lineHeight: 1.3, marginBottom: 12 }}>
          {userName ? `Welcome, ${userName}.` : "Welcome."}<br />
          <span style={{ color: "#c9a84c" }}>How would you like to start?</span>
        </div>
        <div style={{ fontSize: 15, color: "#7a7060", lineHeight: 1.6 }}>
          You can set up your preferences now, or let Alex figure you out through conversation.
          Either way, you'll end up in the right place.
        </div>
      </div>

      {/* Two cards */}
      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 620 }}>

        {/* Card A — Questionnaire */}
        <button
          onClick={onQuestionnaire}
          onMouseEnter={() => setHovered("form")}
          onMouseLeave={() => setHovered(null)}
          style={{
            flex: 1, padding: "32px 28px", borderRadius: 20, cursor: "pointer", textAlign: "left",
            border: `2px solid ${hovered === "form" ? "#c9a84c" : "#e8e0d0"}`,
            background: hovered === "form" ? "#fff" : "#faf8f4",
            boxShadow: hovered === "form" ? "0 8px 32px rgba(201,168,76,0.15)" : "none",
            transition: "all 0.2s ease",
          }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1410", marginBottom: 8 }}>
            Quick setup
          </div>
          <div style={{ fontSize: 13.5, color: "#7a7060", lineHeight: 1.6, marginBottom: 20 }}>
            Answer 7 short questions about your budget, lifestyle and commute.
            Alex reads your answers and skips straight to recommendations.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Budget", "Location", "Property type", "Must-haves", "Commute", "Timeline"].map(tag => (
              <span key={tag} style={{
                padding: "4px 10px", borderRadius: 20,
                background: hovered === "form" ? "#fdf8ee" : "#f0ebe0",
                color: "#7a5520", fontSize: 11, fontWeight: 600
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            marginTop: 24, display: "flex", alignItems: "center", gap: 6,
            color: hovered === "form" ? "#c9a84c" : "#b8b0a0",
            fontSize: 13, fontWeight: 600, transition: "color 0.2s"
          }}>
            Start setup <span style={{ fontSize: 16 }}>→</span>
          </div>
        </button>

        {/* Card B — Alex */}
        <button
          onClick={onAlex}
          onMouseEnter={() => setHovered("alex")}
          onMouseLeave={() => setHovered(null)}
          style={{
            flex: 1, padding: "32px 28px", borderRadius: 20, cursor: "pointer", textAlign: "left",
            border: `2px solid ${hovered === "alex" ? "#c9a84c" : "#e8e0d0"}`,
            background: hovered === "alex" ? "#fff" : "#faf8f4",
            boxShadow: hovered === "alex" ? "0 8px 32px rgba(201,168,76,0.15)" : "none",
            transition: "all 0.2s ease",
          }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🧑‍💼</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1410", marginBottom: 8 }}>
            Chat with Alex
          </div>
          <div style={{ fontSize: 13.5, color: "#7a7060", lineHeight: 1.6, marginBottom: 20 }}>
            Jump straight in. Alex will get to know you through conversation —
            asking the right questions at the right time, just like a real agent would.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Conversational", "Personalised", "No forms"].map(tag => (
              <span key={tag} style={{
                padding: "4px 10px", borderRadius: 20,
                background: hovered === "alex" ? "#fdf8ee" : "#f0ebe0",
                color: "#7a5520", fontSize: 11, fontWeight: 600
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            marginTop: 24, display: "flex", alignItems: "center", gap: 6,
            color: hovered === "alex" ? "#c9a84c" : "#b8b0a0",
            fontSize: 13, fontWeight: 600, transition: "color 0.2s"
          }}>
            Meet Alex <span style={{ fontSize: 16 }}>→</span>
          </div>
        </button>
      </div>

      {/* Fine print */}
      <div style={{ marginTop: 32, fontSize: 12, color: "#b8b0a0", textAlign: "center" }}>
        You can always update your preferences later from your account.
      </div>
    </div>
  );
}

function OnboardingForm({ user, onComplete, onSkip, initialPrefs }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    intent: initialPrefs?.intent || "",
    budget_min: initialPrefs?.budget_min != null ? String(initialPrefs.budget_min) : "",
    budget_max: initialPrefs?.budget_max != null ? String(initialPrefs.budget_max) : "",
    cities: initialPrefs?.cities || [],
    types: initialPrefs?.types?.map(t => t.charAt(0).toUpperCase() + t.slice(1)) || [],
    must_haves: initialPrefs?.must_haves || [],
    timeline: initialPrefs?.timeline || "",
    commute_destination: initialPrefs?.commute_destination || "",
    commute_max_minutes: initialPrefs?.commute_max_minutes != null ? String(initialPrefs.commute_max_minutes) : "",
    partner_preferences: initialPrefs?.partner_preferences || "",
    notes: initialPrefs?.notes || "",
    // Flatmate preferences
    looking_for_flatmate: initialPrefs?.looking_for_flatmate ?? null,
    flatmate_gender: initialPrefs?.flatmate_gender || [],
    flatmate_age_range: initialPrefs?.flatmate_age_range || [],
    flatmate_lifestyle: initialPrefs?.flatmate_lifestyle || [],
    flatmate_dealbreakers: initialPrefs?.flatmate_dealbreakers || [],
    // About me (shown to potential flatmates)
    my_age: initialPrefs?.my_age ? String(initialPrefs.my_age) : "",
    my_gender: initialPrefs?.my_gender || "",
    my_occupation: initialPrefs?.my_occupation || "",
    my_lifestyle: initialPrefs?.my_lifestyle || [],
    my_bio: initialPrefs?.my_bio || "",
  });
  const [saving, setSaving] = useState(false);

  const toggle = (field, val) => setForm(f => ({
    ...f, [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val]
  }));

  const save = async () => {
    setSaving(true);
    const prefs = {
      ...form,
      budget_min: form.budget_min ? parseInt(form.budget_min) : null,
      budget_max: form.budget_max ? parseInt(form.budget_max) : null,
      commute_max_minutes: form.commute_max_minutes ? parseInt(form.commute_max_minutes) : null,
      cities: form.cities,
      types: form.types.map(t => t.toLowerCase()),
      must_haves: form.must_haves,
      looking_for_flatmate: form.looking_for_flatmate,
      flatmate_gender: form.flatmate_gender,
      flatmate_age_range: form.flatmate_age_range,
      flatmate_lifestyle: form.flatmate_lifestyle,
      flatmate_dealbreakers: form.flatmate_dealbreakers,
      my_age: form.my_age,
      my_gender: form.my_gender,
      my_occupation: form.my_occupation,
      my_lifestyle: form.my_lifestyle,
      my_bio: form.my_bio,
    };
    try {
      await db.savePreferences(user.id, prefs);
      await db.updateProfile(user.id, {
        intent: form.intent,
        budget_min: prefs.budget_min,
        budget_max: prefs.budget_max,
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); onComplete(prefs); }
  };

  const steps = [
    {
      title: "What are you looking for?",
      subtitle: "This helps Alex skip the basics and get straight to the good stuff.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["buying", "🏡", "Buying", "I want to own a property"], ["renting", "🔑", "Renting", "I'm looking for somewhere to rent"], ["investing", "📈", "Investing", "I'm buying to let or as an investment"]].map(([val, emoji, label, desc]) => (
            <button key={val} onClick={() => { setForm(f => ({ ...f, intent: val })); setStep(1); }} style={{
              padding: "16px 20px", borderRadius: 12, border: `2px solid ${form.intent === val ? "#c9a84c" : "#ede8de"}`,
              background: form.intent === val ? "#fdf8ee" : "#fff", cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )
    },
    {
      title: "What's your budget?",
      subtitle: form.intent === "renting" ? "Monthly rent in your local currency." : "Total purchase budget.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["budget_min", "Minimum", "e.g. 1000"], ["budget_max", "Maximum", "e.g. 2500"]].map(([field, label, ph]) => (
              <div key={field}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                <input type="number" placeholder={ph} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #ede8de", background: "#faf8f3", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif" }}>Leave blank if you're flexible — Alex will help you work it out.</div>
        </div>
      )
    },
    {
      title: "Where are you looking?",
      subtitle: "Pick all the cities you're open to.",
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CITIES_OPTIONS.map(city => (
            <button key={city} onClick={() => toggle("cities", city)} style={{
              padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.cities.includes(city) ? "#c9a84c" : "#ede8de"}`,
              background: form.cities.includes(city) ? "#fdf8ee" : "#fff", cursor: "pointer",
              fontSize: 13, color: form.cities.includes(city) ? "#7a5520" : "#5a5248",
              fontWeight: form.cities.includes(city) ? 600 : 400, fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s"
            }}>{city}</button>
          ))}
        </div>
      )
    },
    {
      title: "What type of property?",
      subtitle: "Select everything you'd consider.",
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TYPE_OPTIONS.map(type => (
            <button key={type} onClick={() => toggle("types", type)} style={{
              padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.types.includes(type) ? "#c9a84c" : "#ede8de"}`,
              background: form.types.includes(type) ? "#fdf8ee" : "#fff", cursor: "pointer",
              fontSize: 13, color: form.types.includes(type) ? "#7a5520" : "#5a5248",
              fontWeight: form.types.includes(type) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
            }}>{type}</button>
          ))}
        </div>
      )
    },
    {
      title: "What are your must-haves?",
      subtitle: "Things you won't compromise on.",
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MUST_HAVE_OPTIONS.map(item => (
            <button key={item} onClick={() => toggle("must_haves", item)} style={{
              padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.must_haves.includes(item) ? "#c9a84c" : "#ede8de"}`,
              background: form.must_haves.includes(item) ? "#fdf8ee" : "#fff", cursor: "pointer",
              fontSize: 13, color: form.must_haves.includes(item) ? "#7a5520" : "#5a5248",
              fontWeight: form.must_haves.includes(item) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
            }}>{item}</button>
          ))}
        </div>
      )
    },
    {
      title: "Commute & lifestyle",
      subtitle: "Alex uses this to filter by real travel time, not just distance.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Where do you commute to?</div>
            <input placeholder="e.g. Liverpool Street, Canary Wharf, City of London" value={form.commute_destination} onChange={e => setForm(f => ({ ...f, commute_destination: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #ede8de", background: "#faf8f3", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Max commute time (minutes)</div>
            <input type="number" placeholder="e.g. 30" value={form.commute_max_minutes} onChange={e => setForm(f => ({ ...f, commute_max_minutes: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #ede8de", background: "#faf8f3", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" }} />
          </div>
        </div>
      )
    },
    // ── Step 8: Are you looking for a flatmate? ──
    {
      title: "Looking for a flatmate?",
      subtitle: "We can help you find people to share a property with — or keep it private.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            [true, "🤝", "Yes, find me flatmates", "I want to share — help me find compatible people"],
            [false, "🏠", "No, just the property", "I'll sort my own living arrangements"],
          ].map(([val, emoji, label, desc]) => (
            <button key={String(val)} onClick={() => setForm(f => ({ ...f, looking_for_flatmate: val }))} style={{
              padding: "16px 20px", borderRadius: 12,
              border: `2px solid ${form.looking_for_flatmate === val ? "#c9a84c" : "#ede8de"}`,
              background: form.looking_for_flatmate === val ? "#fdf8ee" : "#fff",
              cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{desc}</div>
              </div>
              {form.looking_for_flatmate === val && <span style={{ marginLeft: "auto", color: "#c9a84c", fontSize: 18 }}>✓</span>}
            </button>
          ))}

          {form.looking_for_flatmate === true && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8, padding: "20px", background: "#faf8f4", borderRadius: 14, border: "1px solid #ede8de" }}>
              {/* Gender preference */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Preferred gender</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["No preference", "Male", "Female", "Non-binary"].map(g => (
                    <button key={g} onClick={() => toggle("flatmate_gender", g)} style={{
                      padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.flatmate_gender.includes(g) ? "#c9a84c" : "#ede8de"}`,
                      background: form.flatmate_gender.includes(g) ? "#fdf8ee" : "#fff", cursor: "pointer",
                      fontSize: 13, color: form.flatmate_gender.includes(g) ? "#7a5520" : "#5a5248",
                      fontWeight: form.flatmate_gender.includes(g) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                    }}>{g}</button>
                  ))}
                </div>
              </div>
              {/* Age range */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Preferred age range</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["18–25", "26–35", "36–45", "45+", "No preference"].map(a => (
                    <button key={a} onClick={() => toggle("flatmate_age_range", a)} style={{
                      padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.flatmate_age_range.includes(a) ? "#c9a84c" : "#ede8de"}`,
                      background: form.flatmate_age_range.includes(a) ? "#fdf8ee" : "#fff", cursor: "pointer",
                      fontSize: 13, color: form.flatmate_age_range.includes(a) ? "#7a5520" : "#5a5248",
                      fontWeight: form.flatmate_age_range.includes(a) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                    }}>{a}</button>
                  ))}
                </div>
              </div>
              {/* Lifestyle */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Ideal flatmate lifestyle</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Early bird", "Night owl", "Social butterfly", "Quiet & private", "Works from home", "Student", "Young professional", "Couples OK", "Pets OK"].map(l => (
                    <button key={l} onClick={() => toggle("flatmate_lifestyle", l)} style={{
                      padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.flatmate_lifestyle.includes(l) ? "#c9a84c" : "#ede8de"}`,
                      background: form.flatmate_lifestyle.includes(l) ? "#fdf8ee" : "#fff", cursor: "pointer",
                      fontSize: 13, color: form.flatmate_lifestyle.includes(l) ? "#7a5520" : "#5a5248",
                      fontWeight: form.flatmate_lifestyle.includes(l) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                    }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Dealbreakers */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Dealbreakers 🚫</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Smoking indoors", "Loud music", "Frequent overnight guests", "Messy common areas", "No cleaning rota", "Very different sleep schedule"].map(d => (
                    <button key={d} onClick={() => toggle("flatmate_dealbreakers", d)} style={{
                      padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.flatmate_dealbreakers.includes(d) ? "#e05555" : "#ede8de"}`,
                      background: form.flatmate_dealbreakers.includes(d) ? "#fff0f0" : "#fff", cursor: "pointer",
                      fontSize: 13, color: form.flatmate_dealbreakers.includes(d) ? "#b03030" : "#5a5248",
                      fontWeight: form.flatmate_dealbreakers.includes(d) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                    }}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )
    },
    // ── Step 9: About you (shown on flatmate profile) ──
    {
      title: "Tell us about yourself",
      subtitle: form.looking_for_flatmate ? "This becomes your flatmate profile — other users will see it." : "A little about you so Alex can personalise things further.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7a7060", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Your age</div>
              <input type="number" placeholder="e.g. 28" value={form.my_age} onChange={e => setForm(f => ({ ...f, my_age: e.target.value }))} style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #ede8de",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1410", outline: "none", boxSizing: "border-box"
              }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7a7060", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Your occupation</div>
              <input type="text" placeholder="e.g. Designer" value={form.my_occupation} onChange={e => setForm(f => ({ ...f, my_occupation: e.target.value }))} style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #ede8de",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1410", outline: "none", boxSizing: "border-box"
              }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#7a7060", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Gender</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, my_gender: g }))} style={{
                  padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.my_gender === g ? "#c9a84c" : "#ede8de"}`,
                  background: form.my_gender === g ? "#fdf8ee" : "#fff", cursor: "pointer",
                  fontSize: 13, color: form.my_gender === g ? "#7a5520" : "#5a5248",
                  fontWeight: form.my_gender === g ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                }}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#7a7060", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Your lifestyle</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Early bird", "Night owl", "Social", "Quiet", "Works from home", "Student", "Professional", "Has pets", "Non-smoker", "Smoker"].map(l => (
                <button key={l} onClick={() => toggle("my_lifestyle", l)} style={{
                  padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${form.my_lifestyle.includes(l) ? "#c9a84c" : "#ede8de"}`,
                  background: form.my_lifestyle.includes(l) ? "#fdf8ee" : "#fff", cursor: "pointer",
                  fontSize: 13, color: form.my_lifestyle.includes(l) ? "#7a5520" : "#5a5248",
                  fontWeight: form.my_lifestyle.includes(l) ? 600 : 400, fontFamily: "'DM Sans', sans-serif"
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7a7060", fontFamily: "'DM Sans', sans-serif" }}>
                {form.looking_for_flatmate ? "Short bio (shown on your flatmate profile)" : "Anything else Alex should know?"}
              </div>
              <button
                onClick={() => {
                  const age = form.my_age ? `${form.my_age}-year-old` : "";
                  const occ = form.my_occupation || "";
                  const lifestyle = form.my_lifestyle || [];
                  const earlyLate = lifestyle.includes("Early bird") ? "early riser" : lifestyle.includes("Night owl") ? "night owl" : "";
                  const social = lifestyle.includes("Social") ? "sociable" : lifestyle.includes("Quiet") ? "quiet and private" : "";
                  const wfh = lifestyle.includes("Works from home") ? "work from home" : "";
                  const smoker = lifestyle.includes("Non-smoker") ? "non-smoker" : lifestyle.includes("Smoker") ? "smoker" : "";
                  const pets = lifestyle.includes("Has pets") ? "I have a pet." : "";
                  const dealbreakers = form.flatmate_dealbreakers?.length ? `Dealbreakers: ${form.flatmate_dealbreakers.join(", ").toLowerCase()}.` : "";
                  const pref = form.looking_for_flatmate && form.flatmate_lifestyle?.length ? `Ideally looking for someone who is ${form.flatmate_lifestyle.slice(0, 3).join(", ").toLowerCase()}.` : "";
                  const traits = [earlyLate, social, wfh, smoker].filter(Boolean).join(", ");
                  const intro = [age, occ].filter(Boolean).join(" ");
                  const draft = [
                    intro ? `I'm a ${intro}.` : "",
                    traits ? `I'm ${traits}.` : "",
                    pets,
                    dealbreakers,
                    pref,
                  ].filter(Boolean).join(" ").trim();
                  setForm(f => ({ ...f, my_bio: draft || f.my_bio }));
                }}
                style={{
                  padding: "5px 12px", borderRadius: 20, border: "1.5px solid #c9a84c",
                  background: "#fdf8ee", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  color: "#7a5520", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5,
                  whiteSpace: "nowrap"
                }}>
                ✨ Draft for me
              </button>
            </div>
            <textarea
              placeholder={form.looking_for_flatmate ? "e.g. I'm a 28-year-old designer, I work from home a few days a week. I'm tidy, social but also value quiet evenings. Looking for someone easy-going." : "e.g. I travel a lot for work, need great broadband, have a cat..."}
              value={form.my_bio}
              onChange={e => setForm(f => ({ ...f, my_bio: e.target.value }))}
              rows={4}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #ede8de",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1410", outline: "none",
                resize: "vertical", lineHeight: 1.6, boxSizing: "border-box"
              }}
            />
          </div>
        </div>
      )
    }
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const canNext = step === 0 ? !!form.intent : true;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,10,5,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "28px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>
              Est<span style={{ color: "#c9a84c" }}>ato</span>
              <span style={{ fontSize: 13, fontWeight: 400, color: "#9a8f80", marginLeft: 10 }}>{initialPrefs ? "Edit preferences" : "Quick setup"}</span>
            </div>
            <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Skip for now</button>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: "#f0ebe0", borderRadius: 2, marginBottom: 28 }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #c9a84c, #8b6520)", borderRadius: 2, width: `${((step + 1) / steps.length) * 100}%`, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{currentStep.title}</div>
            <div style={{ fontSize: 13.5, color: "#7a7060", fontFamily: "'DM Sans', sans-serif" }}>{currentStep.subtitle}</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px" }}>
          {currentStep.content}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 32px 28px", borderTop: "1px solid #f0ebe0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{
            padding: "10px 20px", borderRadius: 9, border: "1.5px solid #ede8de", background: "#fff",
            color: step === 0 ? "#d0c8b8" : "#5a5248", cursor: step === 0 ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 14
          }}>Back</button>
          <div style={{ fontSize: 12, color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif" }}>{step + 1} / {steps.length}</div>
          {isLast ? (
            <button onClick={save} disabled={saving} style={{
              padding: "10px 28px", borderRadius: 9, border: "none",
              background: "linear-gradient(135deg, #c9a84c, #8b6520)",
              color: "#fff", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600
            }}>{saving ? "Saving…" : initialPrefs ? "Save changes →" : "Let's go →"}</button>
          ) : (
            <button onClick={() => canNext && setStep(s => s + 1)} style={{
              padding: "10px 28px", borderRadius: 9, border: "none",
              background: canNext ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "#e8e0d0",
              color: "#fff", cursor: canNext ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600
            }}>Next →</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Landing Page ────────────────────────────────────────────────────────────
function LandingPage({ onSuccess }) {
  const [mode, setMode] = useState("home"); // home | signin | signup | reset
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "reset") { await auth.resetPassword(email); setResetSent(true); }
      else if (mode === "signup") {
        await auth.signUp({ email, password, fullName });
        setError("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        await auth.signIn({ email, password });
        // onAuthChange fires automatically, authReady+user updates, component re-renders
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp = {
    width: "100%", padding: "13px 16px", borderRadius: 10,
    border: "1.5px solid #e8e0d0", background: "#fff",
    fontFamily: "'DM Sans', sans-serif", fontSize: 14.5,
    color: "#1a1410", outline: "none",
    transition: "border-color 0.15s"
  };

  const features = [
    { icon: "🏡", title: "10,000+ properties", desc: "Curated listings across London, New York, LA, Miami and more" },
    { icon: "🧑‍💼", title: "Meet Alex", desc: "Your personal AI estate agent — warm, honest, and expert" },
    { icon: "❤️", title: "Save & compare", desc: "Heart properties and revisit them any time across devices" },
    { icon: "🎯", title: "Matched for you", desc: "Alex learns your preferences and surfaces better homes over time" },
  ];

  return (
    <div style={{
      height: "100vh", display: "flex", fontFamily: "'DM Sans', sans-serif",
      background: "#f5f2ec", overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        input:focus { border-color: #c9a84c !important; }
      `}</style>

      {/* ── Left panel — branding ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px 56px",
        background: "linear-gradient(160deg, #1a1410 0%, #2d2118 60%, #1a1410 100%)",
        position: "relative", overflow: "hidden"
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(201,168,76,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -120, left: -60, width: 400, height: 400, borderRadius: "50%", background: "rgba(201,168,76,0.04)", pointerEvents: "none" }} />

        {/* Logo */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
            Est<span style={{ color: "#c9a84c" }}>ato</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>Real Estate Platform</div>
        </div>

        {/* Headline */}
        <div style={{ animation: "fadeUp 0.6s ease both" }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 20, letterSpacing: "-1px" }}>
            Find your<br />
            <span style={{ color: "#c9a84c" }}>perfect home</span><br />
            with Alex.
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, maxWidth: 380 }}>
            A boutique property experience powered by AI. Alex gets to know you and finds homes that actually fit your life.
          </div>

          {/* Feature list */}
          <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", animation: `fadeUp 0.6s ease ${0.1 + i * 0.08}s both` }}>
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.6 }}>
            "The best estate agent I've ever had — and I didn't even have to leave my sofa."
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>— Early user, London</div>
        </div>
      </div>

      {/* ── Right panel — auth form ── */}
      <div style={{
        width: 460, flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "52px 48px",
        background: "#fff", overflowY: "auto"
      }}>
        {mode === "home" ? (
          /* Home — two big buttons */
          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1410", marginBottom: 8 }}>Welcome to Estato</div>
              <div style={{ fontSize: 15, color: "#7a7060", lineHeight: 1.6 }}>Sign in to continue your search, or create a free account to get started.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button onClick={() => { setMode("signin"); setError(""); }} style={{
                padding: "16px 24px", borderRadius: 12, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                color: "#fff", fontSize: 15, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "opacity 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                <span>Sign in to your account</span>
                <span style={{ fontSize: 18 }}>→</span>
              </button>

              <button onClick={() => { setMode("signup"); setError(""); }} style={{
                padding: "16px 24px", borderRadius: 12, cursor: "pointer",
                border: "2px solid #e8e0d0", background: "#faf8f4",
                color: "#1a1410", fontSize: 15, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "border-color 0.15s, background 0.15s"
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#c9a84c"; e.currentTarget.style.background = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e0d0"; e.currentTarget.style.background = "#faf8f4"; }}
              >
                <span>Create a free account</span>
                <span style={{ fontSize: 18, color: "#c9a84c" }}>→</span>
              </button>
            </div>

            <div style={{ marginTop: 40, padding: "20px", borderRadius: 12, background: "#faf8f4", border: "1px solid #f0ebe0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #c9a84c, #8b6520)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧑‍💼</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1410" }}>Meet Alex</div>
              </div>
              <div style={{ fontSize: 13, color: "#7a7060", lineHeight: 1.6 }}>
                Alex is your personal AI estate consultant. He'll get to know your budget, lifestyle and commute — and find homes that genuinely fit.
              </div>
            </div>
          </div>
        ) : resetSent ? (
          <div style={{ textAlign: "center", animation: "fadeUp 0.4s ease both" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1410", marginBottom: 10 }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: "#7a7060", lineHeight: 1.6, marginBottom: 28 }}>We've sent a password reset link to <strong>{email}</strong>.</div>
            <button onClick={() => { setResetSent(false); setMode("signin"); setError(""); }} style={{ color: "#c9a84c", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500 }}>← Back to sign in</button>
          </div>
        ) : (
          /* Sign in / Sign up / Reset form */
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <button onClick={() => { setMode("home"); setError(""); }} style={{
              background: "none", border: "none", cursor: "pointer", color: "#9a8f80",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, marginBottom: 32,
              display: "flex", alignItems: "center", gap: 6, padding: 0
            }}>← Back</button>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1410", marginBottom: 6 }}>
                {mode === "signup" ? "Create your account" : mode === "reset" ? "Reset password" : "Welcome back"}
              </div>
              <div style={{ fontSize: 14, color: "#7a7060" }}>
                {mode === "signup" ? "Free forever. No credit card needed." : mode === "reset" ? "We'll send you a reset link." : "Good to see you again."}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {mode === "signup" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Full name</div>
                  <input placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email address</div>
                <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
              </div>
              {mode !== "reset" && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Password</div>
                  <input type="password" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
                </div>
              )}

              {error && (
                <div style={{ fontSize: 13, color: error.includes("Check your email") ? "#5a8f4a" : "#c0392b", fontFamily: "'DM Sans', sans-serif", padding: "10px 14px", borderRadius: 8, background: error.includes("Check your email") ? "#f0f8ee" : "#fef5f5" }}>
                  {error}
                </div>
              )}

              <button onClick={submit} disabled={loading} style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: loading ? "#e0d8c8" : "linear-gradient(135deg, #c9a84c, #8b6520)",
                color: "#fff", cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
                marginTop: 4, transition: "opacity 0.15s"
              }}>
                {loading ? "Please wait…" : mode === "signup" ? "Create account →" : mode === "reset" ? "Send reset link →" : "Sign in →"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                {mode === "signin" ? (
                  <>
                    <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, padding: 0 }}>Create an account</button>
                    <button onClick={() => { setMode("reset"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 0 }}>Forgot password?</button>
                  </>
                ) : mode === "signup" ? (
                  <button onClick={() => { setMode("signin"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, padding: 0 }}>Already have an account? Sign in</button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "reset") { await auth.resetPassword(email); setResetSent(true); }
      else if (mode === "signup") { await auth.signUp({ email, password, fullName }); setError("Check your email to confirm, then sign in."); setMode("signin"); }
      else { await auth.signIn({ email, password }); onSuccess(); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  const inp = { width: "100%", padding: "11px 14px", borderRadius: 9, border: "1.5px solid #ede8de", background: "#faf8f3", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1a1410", outline: "none" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,10,5,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "36px 40px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1410", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Est<span style={{ color: "#c9a84c" }}>ato</span></div>
          <div style={{ fontSize: 15, color: "#5a5248", fontFamily: "'DM Sans', sans-serif" }}>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}</div>
        </div>
        {resetSent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 14, color: "#5a5248", fontFamily: "'DM Sans', sans-serif" }}>Check your inbox for a reset link.</div>
            <button onClick={() => { setResetSent(false); setMode("signin"); }} style={{ marginTop: 20, color: "#c9a84c", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Back to sign in</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} style={inp} />}
            <input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
            {mode !== "reset" && <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} onKeyDown={e => e.key === "Enter" && submit()} />}
            {error && <div style={{ fontSize: 13, color: error.includes("Check") ? "#6a9e5a" : "#c0392b", fontFamily: "'DM Sans', sans-serif" }}>{error}</div>}
            <button onClick={submit} disabled={loading} style={{ width: "100%", padding: "12px", background: loading ? "#e0d8c8" : "linear-gradient(135deg, #c9a84c, #8b6520)", border: "none", borderRadius: 9, color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                {mode === "signup" ? "Already have an account?" : "Create account"}
              </button>
              {mode === "signin" && <button onClick={() => { setMode("reset"); setError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>Forgot password?</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ user, profile, onUpdate, onSignOut, onEditPrefs, favourites, viewings, onNavigate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: profile?.full_name || "", phone: profile?.phone || "", intent: profile?.intent || "buying", budget_min: profile?.budget_min || "", budget_max: profile?.budget_max || "" });
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(() => { try { return localStorage.getItem(avatarKey(user.id)) || null; } catch { return null; } });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImageToDataURL(file, 200, 0.82);
      localStorage.setItem(avatarKey(user.id), dataUrl);
      setAvatarUrl(dataUrl);
      // Silently attempt to sync to Supabase (works if profiles table has avatar_url column)
      try { await db.updateProfile(user.id, { avatar_url: dataUrl }); } catch { }
    } catch (e) { console.error(e); }
    finally { setAvatarUploading(false); e.target.value = ""; }
  };

  const save = async () => {
    setSaving(true);
    try { const u = await db.updateProfile(user.id, { ...form, budget_min: form.budget_min ? parseInt(form.budget_min) : null, budget_max: form.budget_max ? parseInt(form.budget_max) : null }); onUpdate(u); setEditing(false); }
    catch (e) { console.error(e); } finally { setSaving(false); }
  };
  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #ede8de", background: "#faf8f3", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#1a1410", outline: "none" };
  const lbl = { fontSize: 11, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" };
  return (
    <div style={{ padding: "40px 32px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        {/* Clickable avatar */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
          style={{ position: "relative", width: 64, height: 64, borderRadius: "50%", cursor: "pointer", flexShrink: 0 }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "2px solid #f0ebe0" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #c9a84c, #8b6520)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
              {(profile?.full_name || user.email || "?")[0].toUpperCase()}
            </div>
          )}
          {/* Hover / loading overlay */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: avatarUploading || avatarHovered ? 1 : 0, transition: "opacity 0.15s" }}>
            {avatarUploading
              ? <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              : <span style={{ fontSize: 18, color: "#fff" }}>📷</span>
            }
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{profile?.full_name || "Your Profile"}</div>
          <div style={{ fontSize: 13, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{user.email}</div>
          <div style={{ fontSize: 11, color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Click photo to change</div>
        </div>
        <button onClick={() => setEditing(!editing)} style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 8, border: "1.5px solid #ede8de", background: editing ? "#f5edd8" : "#fff", color: editing ? "#7a5520" : "#5a5248", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{editing ? "Cancel" : "Edit"}</button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Social stats strip ── */}
      {(() => {
        const connectionsCount = (() => { try { return JSON.parse(localStorage.getItem(connectionsKey(user.id)) || "[]").length; } catch { return 0; } })();
        const savedCount = favourites?.length || 0;
        const viewingsCount = (viewings || []).filter(v => v.status !== "cancelled").length;
        const stats = [
          { count: connectionsCount, label: "Connections", nav: "flatmates", highlight: connectionsCount > 0 },
          { count: savedCount, label: "Saved", nav: "favourites", highlight: false },
          { count: viewingsCount, label: "Viewings", nav: "favourites", highlight: false },
        ];
        return (
          <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: "1px solid #ede8de", marginBottom: 28 }}>
            {stats.map(({ count, label, nav, highlight }, i) => (
              <div key={label}
                onClick={() => onNavigate && onNavigate(nav)}
                style={{ flex: 1, textAlign: "center", padding: "16px 8px", cursor: onNavigate ? "pointer" : "default", borderRight: i < stats.length - 1 ? "1px solid #ede8de" : "none", background: "#fff", transition: "background 0.12s" }}
                onMouseEnter={e => { if (onNavigate) e.currentTarget.style.background = "#faf8f4"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: highlight ? "#c9a84c" : "#1a1410", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><div style={lbl}>Full Name</div><input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div><div style={lbl}>Phone</div><input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+44 7700 000000" /></div>
          <div><div style={lbl}>I am looking to</div>
            <select style={inp} value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}>
              <option value="buying">Buy</option><option value="renting">Rent</option><option value="both">Buy or rent</option><option value="investing">Invest</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><div style={lbl}>Budget from</div><input style={inp} type="number" value={form.budget_min} onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} placeholder="200000" /></div>
            <div><div style={lbl}>Budget to</div><input style={inp} type="number" value={form.budget_max} onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} placeholder="600000" /></div>
          </div>
          <button onClick={save} disabled={saving} style={{ padding: "12px", borderRadius: 9, background: "linear-gradient(135deg, #c9a84c, #8b6520)", border: "none", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>{saving ? "Saving…" : "Save profile"}</button>
        </div>
      ) : (
        <div>
          {[{ label: "Phone", value: profile?.phone || "—" }, { label: "Looking to", value: { buying: "Buy", renting: "Rent", both: "Buy or rent", investing: "Invest" }[profile?.intent] || "—" }, { label: "Budget", value: profile?.budget_min && profile?.budget_max ? `£${Math.round(profile.budget_min / 1000)}k – £${Math.round(profile.budget_max / 1000)}k` : "—" }].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #f0ebe0" }}>
              <span style={{ fontSize: 13, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
              <span style={{ fontSize: 13.5, color: "#1a1410", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
            </div>
          ))}
          <button onClick={onEditPrefs} style={{ marginTop: 16, padding: "11px", width: "100%", borderRadius: 9, border: "1.5px solid #ede8de", background: "#fff", color: "#5a5248", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>✏️  Edit search preferences</button>
          <button onClick={onSignOut} style={{ marginTop: 8, padding: "11px", width: "100%", borderRadius: 9, border: "1.5px solid #ede8de", background: "#fff", color: "#c0392b", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function FavouritesPanel({ favourites, viewings, onSelect, onRemove, onCancelViewing, onDeleteViewing, onConfirmViewing }) {
  const [tab, setTab] = useState("saved");
  const [renterActions, setRenterActions] = useState({});   // { [viewingId]: "proposed"|"accepted"|"declined" }
  const [proposedTimes, setProposedTimes] = useState({});   // { [viewingId]: { date, time } }
  const [proposingId, setProposingId] = useState(null);     // viewingId currently showing time picker
  const [pickerValues, setPickerValues] = useState({});     // { [viewingId]: { date, time } }

  const now = new Date();
  const upcoming = (viewings || []).filter(v => v.status !== "cancelled" && v.status !== "completed" && (!v.scheduled_date || new Date(v.scheduled_date) >= now));
  const past = (viewings || []).filter(v => v.status === "completed" || v.status === "cancelled" || (v.scheduled_date && new Date(v.scheduled_date) < now));

  const tabBtn = (key, label, count) => (
    <button onClick={() => setTab(key)} style={{
      padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${tab === key ? "#c9a84c" : "#ede8de"}`,
      background: tab === key ? "#fdf8ee" : "transparent", cursor: "pointer",
      fontSize: 13, fontWeight: tab === key ? 600 : 400,
      color: tab === key ? "#7a5520" : "#7a7060",
      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: 6,
    }}>
      {label}
      {count > 0 && <span style={{ background: tab === key ? "#c9a84c" : "#e8e0d0", color: tab === key ? "#fff" : "#7a7060", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{count}</span>}
    </button>
  );

  const statusBadge = (status) => {
    const map = {
      pending: { label: "Pending", bg: "#fdf8ee", color: "#9a7a20", border: "#e8d898" },
      confirmed: { label: "Confirmed", bg: "#f0f8ee", color: "#3a7a2a", border: "#b8e0a8" },
      completed: { label: "Completed", bg: "#f0f0f8", color: "#4a4a8a", border: "#c0c0e8" },
      cancelled: { label: "Cancelled", bg: "#faf0f0", color: "#8a3a3a", border: "#e0b0b0" },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: "'DM Sans', sans-serif" }}>
        {s.label}
      </span>
    );
  };

  const formatDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };

  const ViewingCard = ({ v, showActions }) => {
    const p = v.listing_data;
    const rAction = renterActions[v.id];
    const proposed = proposedTimes[v.id];
    const pickerVal = pickerValues[v.id] || { date: "", time: "" };
    const isProposing = proposingId === v.id;

    const landlordDateRaw = v.scheduled_date;
    const landlordDateStr = landlordDateRaw ? landlordDateRaw.split("T")[0] : "";
    // Show landlord-proposal response UI when there's a date + status is pending + renter hasn't acted yet
    const hasLandlordProposal = !!landlordDateRaw && v.status === "pending" && !rAction;
    const isConfirmed = v.status === "confirmed" || rAction === "accepted";
    const isDeclined = rAction === "declined";

    const confirmedDate = proposed?.date || landlordDateStr;
    const confirmedTime = proposed?.time || "10:00";

    const handleAccept = () => {
      if (confirmedDate) {
        const ics = buildICS({
          summary: `Property viewing: ${p.title}`,
          startDate: confirmedDate,
          startTime: confirmedTime,
          durationHours: 1,
          location: p.location || "",
          description: `Viewing confirmed at ${p.title}\nAddress: ${p.location}`,
          organizerName: "Landlord",
          organizerEmail: "",
          cancelled: false,
        });
        triggerICSDownload(ics, "viewing-confirmed.ics");
      }
      setRenterActions(prev => ({ ...prev, [v.id]: "accepted" }));
      if (onConfirmViewing) onConfirmViewing(v.id);
    };

    const handleDecline = () => {
      setRenterActions(prev => ({ ...prev, [v.id]: "declined" }));
      onCancelViewing(v.id);
    };

    const handleSendProposal = () => {
      if (!pickerVal.date || !pickerVal.time) return;
      setProposedTimes(prev => ({ ...prev, [v.id]: { ...pickerVal } }));
      setRenterActions(prev => ({ ...prev, [v.id]: "proposed" }));
      setProposingId(null);
    };

    const handleChangeProposal = () => {
      setProposingId(v.id);
      setPickerValues(prev => ({ ...prev, [v.id]: { date: proposed?.date || "", time: proposed?.time || "" } }));
      setRenterActions(prev => { const n = { ...prev }; delete n[v.id]; return n; });
      setProposedTimes(prev => { const n = { ...prev }; delete n[v.id]; return n; });
    };

    return (
      <div style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isConfirmed ? "#b8e0a8" : isDeclined ? "#e0b0b0" : "#ede8de"}`, overflow: "hidden", marginBottom: 10, transition: "border-color 0.2s" }}>
        {/* Property row */}
        <div style={{ display: "flex", cursor: "pointer" }} onClick={() => onSelect(p)}>
          <img src={p.image} alt={p.title} style={{ width: 88, height: 70, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ padding: "10px 14px", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              {statusBadge(isConfirmed ? "confirmed" : isDeclined ? "cancelled" : v.status)}
            </div>
            <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{p.location}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", marginTop: 3 }}>
              {p.currency}{p.price?.toLocaleString()}{p.isForRent ? "/mo" : ""}
            </div>
          </div>
        </div>

        {/* Viewing details */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid #f5f0e8", background: isConfirmed ? "#f4fbf2" : isDeclined ? "#fdf5f5" : "#faf8f4" }}>

          {/* ── Confirmed ── */}
          {isConfirmed && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3a7a2a", fontFamily: "'DM Sans', sans-serif" }}>
                  Viewing confirmed
                  {confirmedDate && <span style={{ fontWeight: 400, color: "#5a8a4a" }}> · {new Date(`${confirmedDate}T${confirmedTime}`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {confirmedTime}</span>}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  if (confirmedDate) {
                    const ics = buildICS({ summary: `Property viewing: ${p.title}`, startDate: confirmedDate, startTime: confirmedTime, durationHours: 1, location: p.location || "", description: `Viewing confirmed at ${p.title}`, organizerName: "Landlord", organizerEmail: "", cancelled: false });
                    triggerICSDownload(ics, "viewing-confirmed.ics");
                  }
                }} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #b8e0a8", background: "#f0f8ee", color: "#3a7a2a", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
                  📅 Add to Calendar
                </button>
                {showActions && (
                  <button onClick={() => onCancelViewing(v.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e8d0d0", background: "#fff", color: "#9a4a4a", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Declined ── */}
          {isDeclined && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>❌</span>
              <span style={{ fontSize: 12.5, color: "#8a3a3a", fontFamily: "'DM Sans', sans-serif" }}>Viewing declined</span>
            </div>
          )}

          {/* ── Renter has proposed a new time ── */}
          {rAction === "proposed" && !isConfirmed && !isDeclined && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#9a7020", fontFamily: "'DM Sans', sans-serif" }}>
                  Your proposal: {proposed.date} at {proposed.time}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "#b8a060", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
                Awaiting landlord response
              </div>
              <button onClick={handleChangeProposal} style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #ede8de", background: "transparent", color: "#9a8f80", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 11.5 }}>
                Change proposal
              </button>
            </div>
          )}

          {/* ── Landlord proposed a time — needs renter response ── */}
          {hasLandlordProposal && !isProposing && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#7a5520", fontFamily: "'DM Sans', sans-serif" }}>
                  Landlord proposed: {formatDate(landlordDateRaw)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleAccept} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #b8e0a8", background: "#f0f8ee", color: "#3a7a2a", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>
                  ✓ Accept
                </button>
                <button onClick={() => setProposingId(v.id)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #c9a84c", background: "#fdf8ee", color: "#9a7020", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
                  Propose time
                </button>
                <button onClick={handleDecline} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #e8d0d0", background: "#fff", color: "#9a4a4a", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* ── Time picker — propose a new time to landlord ── */}
          {isProposing && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#5a5248", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
                Propose a new time
              </div>
              {landlordDateRaw && (
                <div style={{ fontSize: 11.5, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
                  Landlord suggested: {formatDate(landlordDateRaw)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input type="date" value={pickerVal.date} min={new Date().toISOString().split("T")[0]}
                  onChange={e => setPickerValues(prev => ({ ...prev, [v.id]: { ...pickerVal, date: e.target.value } }))}
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #ede8de", fontFamily: "'DM Sans', sans-serif", fontSize: 12, background: "#fff", color: "#1a1410" }}
                />
                <input type="time" value={pickerVal.time}
                  onChange={e => setPickerValues(prev => ({ ...prev, [v.id]: { ...pickerVal, time: e.target.value } }))}
                  style={{ width: 100, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #ede8de", fontFamily: "'DM Sans', sans-serif", fontSize: 12, background: "#fff", color: "#1a1410" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSendProposal} disabled={!pickerVal.date || !pickerVal.time}
                  style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: pickerVal.date && pickerVal.time ? "#c9a84c" : "#e8e0d0", color: pickerVal.date && pickerVal.time ? "#fff" : "#b0a898", cursor: pickerVal.date && pickerVal.time ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>
                  Send proposal →
                </button>
                <button onClick={() => setProposingId(null)} style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #ede8de", background: "transparent", color: "#9a8f80", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── No landlord date yet — TBC ── */}
          {!hasLandlordProposal && !isProposing && !rAction && !isConfirmed && !isDeclined && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: v.message ? 8 : 0 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <span style={{ fontSize: 12.5, color: "#5a5248", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                Date TBC — awaiting landlord's proposal
              </span>
            </div>
          )}

          {/* Message snippet */}
          {v.message && !isConfirmed && !isDeclined && !hasLandlordProposal && !isProposing && (
            <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #ede8de", marginTop: 4, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>
              {v.message.split('\n')[2] || v.message.slice(0, 100)}…
            </div>
          )}

          {/* Requested timestamp */}
          {!isConfirmed && !isDeclined && (
            <div style={{ fontSize: 11, color: "#b8b0a0", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
              Requested {new Date(v.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}

          {/* Cancel button — only when TBC and pending */}
          {showActions && !isConfirmed && !isDeclined && !rAction && !hasLandlordProposal && !isProposing && v.status !== "cancelled" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => onCancelViewing(v.id)} style={{
                flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #e8d0d0",
                background: "#fff", color: "#9a4a4a", cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500
              }}>Cancel viewing</button>
            </div>
          )}
          {!showActions && !isDeclined && (
            <button onClick={() => onDeleteViewing(v.id)} style={{
              marginTop: 8, padding: "5px 12px", borderRadius: 8, border: "1.5px solid #ede8de",
              background: "transparent", color: "#b8b0a0", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11
            }}>Remove</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <div style={{ padding: "24px 24px 0", borderBottom: "1px solid #ede8de", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>My Estato</div>
        <div style={{ display: "flex", gap: 8, paddingBottom: 16 }}>
          {tabBtn("saved", "❤️ Saved", favourites.length)}
          {tabBtn("upcoming", "📅 Viewings", upcoming.length)}
          {tabBtn("past", "🕐 Past", past.length)}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── Saved properties ── */}
        {tab === "saved" && (
          favourites.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 40 }}>🤍</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>No saved properties yet</div>
              <div style={{ fontSize: 13 }}>Heart a property to save it here</div>
            </div>
          ) : (
            <div>
              {favourites.map(fav => {
                const p = fav.listing_data;
                return (
                  <div key={fav.id} onClick={() => onSelect(p)} style={{
                    background: "#fff", borderRadius: 12, border: "1px solid #ede8de",
                    overflow: "hidden", cursor: "pointer", display: "flex", marginBottom: 10,
                    transition: "box-shadow 0.15s"
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                    <img src={p.image} alt={p.title} style={{ width: 96, height: 78, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ padding: "10px 14px", flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{p.location}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>{p.currency}{p.price?.toLocaleString()}{p.isForRent ? "/mo" : ""}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); onRemove(fav.listing_id); }} style={{
                      background: "none", border: "none", cursor: "pointer", color: "#d0c8b8",
                      padding: "0 14px", fontSize: 16, flexShrink: 0,
                      transition: "color 0.15s"
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = "#e74c3c"}
                      onMouseLeave={e => e.currentTarget.style.color = "#d0c8b8"}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Upcoming viewings ── */}
        {tab === "upcoming" && (
          upcoming.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 40 }}>📅</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>No upcoming viewings</div>
              <div style={{ fontSize: 13, textAlign: "center", maxWidth: 240 }}>Request a viewing from any property and it'll appear here</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>
                {upcoming.length} viewing{upcoming.length !== 1 ? "s" : ""} pending or confirmed
              </div>
              {upcoming.map(v => <ViewingCard key={v.id} v={v} showActions={true} />)}
            </div>
          )
        )}

        {/* ── Past viewings ── */}
        {tab === "past" && (
          past.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 40 }}>🕐</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>No past viewings yet</div>
              <div style={{ fontSize: 13 }}>Completed and cancelled viewings will appear here</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>
                {past.length} viewing{past.length !== 1 ? "s" : ""} completed or cancelled
              </div>
              {past.map(v => <ViewingCard key={v.id} v={v} showActions={false} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Dummy Flatmates Data ────────────────────────────────────────────────────
const DUMMY_FLATMATES = [
  { id: "fm1", name: "Sophie L.", age: 26, gender: "Female", occupation: "UX Designer", city: "London", area: "Shoreditch", budget_max: 1200, lifestyle: ["Works from home", "Non-smoker", "Early bird", "Has pets"], bio: "Friendly designer working remotely. I love cooking, quiet evenings in, and the occasional brunch. My cat Mochi is very well-behaved. Looking for a tidy, easy-going flatmate.", dealbreakers: ["Smoking indoors", "Messy common areas"], avatar: "https://i.pravatar.cc/150?img=47", match: 92, mutualInterests: ["Works from home", "Non-smoker"], looking_in: ["Shoreditch", "Dalston", "Hackney"], connections: 8, activeConversations: 3 },
  { id: "fm2", name: "James K.", age: 29, gender: "Male", occupation: "Software Engineer", city: "London", area: "Canary Wharf", budget_max: 1500, lifestyle: ["Professional", "Non-smoker", "Social butterfly", "Night owl"], bio: "Software engineer at a fintech startup. Social but respectful of space. Very tidy. Prefer someone who works full-time.", dealbreakers: ["Frequent overnight guests"], avatar: "https://i.pravatar.cc/150?img=12", match: 87, mutualInterests: ["Professional", "Non-smoker"], looking_in: ["Canary Wharf", "Isle of Dogs", "Greenwich"], connections: 12, activeConversations: 5 },
  { id: "fm3", name: "Priya M.", age: 24, gender: "Female", occupation: "Marketing Manager", city: "London", area: "Brixton", budget_max: 950, lifestyle: ["Student", "Social butterfly", "Non-smoker", "Has pets"], bio: "Just started my first grad job! I'm sociable and love hosting small get-togethers. I have a small dog (very friendly).", dealbreakers: ["No cleaning rota", "Very different sleep schedule"], avatar: "https://i.pravatar.cc/150?img=44", match: 78, mutualInterests: ["Non-smoker", "Social butterfly"], looking_in: ["Brixton", "Clapham", "Streatham"], connections: 6, activeConversations: 2 },
  { id: "fm4", name: "Tom R.", age: 32, gender: "Male", occupation: "Architect", city: "London", area: "Islington", budget_max: 1400, lifestyle: ["Professional", "Early bird", "Quiet", "Non-smoker"], bio: "Architect who keeps a very tidy flat and prefers a calm environment. Looking for a like-minded professional.", dealbreakers: ["Loud music", "Smoking indoors", "Frequent overnight guests"], avatar: "https://i.pravatar.cc/150?img=15", match: 84, mutualInterests: ["Professional", "Early bird", "Non-smoker"], looking_in: ["Islington", "Angel", "Highbury"], connections: 4, activeConversations: 1 },
  { id: "fm5", name: "Aisha B.", age: 27, gender: "Female", occupation: "Nurse", city: "London", area: "Hackney", budget_max: 1100, lifestyle: ["Professional", "Quiet", "Non-smoker", "Early bird"], bio: "NHS nurse — I do shifts so my schedule varies, but I'm a quiet and respectful flatmate. Love cooking West African food (will always share!).", dealbreakers: ["Loud music", "Messy common areas"], avatar: "https://i.pravatar.cc/150?img=48", match: 81, mutualInterests: ["Professional", "Non-smoker"], looking_in: ["Hackney", "Dalston", "Stoke Newington"], connections: 9, activeConversations: 4 },
  { id: "fm6", name: "Oliver T.", age: 31, gender: "Male", occupation: "Freelance Photographer", city: "London", area: "Peckham", budget_max: 900, lifestyle: ["Night owl", "Social butterfly", "Has pets", "Non-smoker"], bio: "Freelance photographer with creative hours. Very social, love music and art. My studio cat Pixel lives with me.", dealbreakers: ["Very different sleep schedule"], avatar: "https://i.pravatar.cc/150?img=53", match: 69, mutualInterests: ["Non-smoker", "Has pets"], looking_in: ["Peckham", "Brixton", "Forest Gate"], connections: 11, activeConversations: 6 },
  { id: "fm7", name: "Mei C.", age: 25, gender: "Female", occupation: "Data Analyst", city: "London", area: "Stratford", budget_max: 1050, lifestyle: ["Professional", "Quiet", "Works from home", "Non-smoker"], bio: "Data analyst who WFH full-time. Introverted but friendly — love cooking, gaming and Netflix. I keep a very clean flat.", dealbreakers: ["Loud music", "Frequent overnight guests", "Messy common areas"], avatar: "https://i.pravatar.cc/150?img=49", match: 88, mutualInterests: ["Works from home", "Quiet", "Non-smoker"], looking_in: ["Stratford", "Leyton", "Forest Gate"], connections: 5, activeConversations: 2 },
  { id: "fm8", name: "Luca F.", age: 28, gender: "Male", occupation: "Chef", city: "London", area: "Chelsea", budget_max: 1600, lifestyle: ["Night owl", "Social butterfly", "Non-smoker", "Professional"], bio: "Head chef in Chelsea — my fridge is always stocked and I love feeding people. Looking for someone social who appreciates good food.", dealbreakers: ["Messy common areas", "No cleaning rota"], avatar: "https://i.pravatar.cc/150?img=57", match: 74, mutualInterests: ["Professional", "Non-smoker"], looking_in: ["Chelsea", "Fulham", "Battersea"], connections: 14, activeConversations: 7 },
];

// ─── Landlord Viewing Seed ────────────────────────────────────────────────────
function seedLandlordViewings(listings) {
  if (!listings || listings.length === 0) return [];
  const prospects = [
    { name: "Oliver Bennett", avatar: "https://i.pravatar.cc/150?img=11", age: 31, occupation: "Architect", area: "Islington, London", budget: 2200, moveIn: "ASAP", lifestyle: ["Professional", "Non-smoker", "Quiet"], bio: "Architect at a mid-size studio. Tidy, respectful tenant with excellent references. Looking for a long-term let." },
    { name: "Priya Sharma", avatar: "https://i.pravatar.cc/150?img=44", age: 27, occupation: "Marketing Manager", area: "Brixton, London", budget: 1600, moveIn: "Next month", lifestyle: ["Non-smoker", "Social", "Has pets"], bio: "Marketing manager at a fintech. I have a small, well-behaved dog. Looking for somewhere I can truly call home." },
    { name: "Marcus Webb", avatar: "https://i.pravatar.cc/150?img=52", age: 34, occupation: "Software Engineer", area: "Shoreditch, London", budget: 2800, moveIn: "Flexible", lifestyle: ["Professional", "Non-smoker", "Works from home"], bio: "Senior engineer at a Series B startup. WFH most days. Very clean, very quiet. 3 years at my last address." },
    { name: "Sophie Laurent", avatar: "https://i.pravatar.cc/150?img=47", age: 29, occupation: "UX Designer", area: "Hackney, London", budget: 1900, moveIn: "Within 2 weeks", lifestyle: ["Non-smoker", "Early bird", "Creative"], bio: "Freelance UX designer. Stable income, great references. I love cooking and keeping a beautiful home." },
    { name: "James Okafor", avatar: "https://i.pravatar.cc/150?img=14", age: 38, occupation: "Financial Analyst", area: "Canary Wharf, London", budget: 3500, moveIn: "End of month", lifestyle: ["Professional", "Non-smoker", "Quiet"], bio: "Analyst at a major investment bank. Single occupant. Looking for a premium property near transport links." },
    { name: "Mei Tanaka", avatar: "https://i.pravatar.cc/150?img=49", age: 25, occupation: "Data Scientist", area: "Stratford, London", budget: 1500, moveIn: "Next month", lifestyle: ["Non-smoker", "Quiet", "Works from home"], bio: "Data scientist, recently relocated from Tokyo. Clean, responsible, and looking for a stable long-term home." },
    { name: "Ravi Patel", avatar: "https://i.pravatar.cc/150?img=67", age: 42, occupation: "GP Doctor", area: "Clapham, London", budget: 2600, moveIn: "ASAP", lifestyle: ["Professional", "Non-smoker", "Family"], bio: "GP with a stable NHS contract. Moving with my partner. We are clean, quiet and looking for a 12-month+ tenancy." },
    { name: "Emma Clarke", avatar: "https://i.pravatar.cc/150?img=25", age: 26, occupation: "Journalist", area: "Peckham, London", budget: 1700, moveIn: "Flexible", lifestyle: ["Non-smoker", "Creative", "Social"], bio: "Staff journalist at a national paper. Very sociable but keep a tidy home. Excellent landlord references available." },
  ];
  const messages = [
    "Hi, I'm very interested in this property. Would Saturday morning work for a viewing?",
    "I saw the listing on Estato and it looks perfect. Can we arrange something this week?",
    "We're a couple looking to move in next month. Would love to see the place!",
    "I've been looking in this area for months — this one ticks all the boxes. Available Tuesday?",
    "Just relocated for work and this location is ideal. Happy to view at your convenience.",
    "The photos look great. Is there flexibility on the price for a long-term tenant?",
    "We're cash ready and can move within 2 weeks. When is the earliest we can view?",
    "I love the description — especially the outdoor space. Is Sunday afternoon possible?",
  ];
  const statuses = ["pending", "pending", "confirmed", "pending", "confirmed", "declined", "pending", "confirmed"];
  const now = Date.now();
  const DAY = 86400000;
  return listings.flatMap((listing, li) => {
    const count = 1 + (li % 3);
    return Array.from({ length: count }, (_, i) => {
      const pi = (li * 3 + i) % prospects.length;
      const daysAhead = 2 + ((li + i) % 12);
      const p = prospects[pi];
      return {
        id: `lv-${listing.id || li}-${i}`,
        propertyId: listing.id,
        prospectName: p.name,
        prospectAvatar: p.avatar,
        prospectAge: p.age,
        prospectOccupation: p.occupation,
        prospectArea: p.area,
        prospectBudget: p.budget,
        prospectMoveIn: p.moveIn,
        prospectLifestyle: p.lifestyle,
        prospectBio: p.bio,
        date: new Date(now + daysAhead * DAY).toISOString(),
        status: statuses[(li + i) % statuses.length],
        message: messages[(li * 2 + i) % messages.length],
      };
    });
  });
}

// ─── Flatmate Match Algorithm ─────────────────────────────────────────────────
// Scores a candidate flatmate against the current user's preferences (0–100).
// Six weighted signals: budget, city, lifestyle preference, dealbreakers, gender, age.
function computeFlatmateMatch(userPrefs, flatmate) {
  let score = 0;
  const mutualInterests = [];

  const norm = s => s.toLowerCase().replace(/[^a-z]/g, "");
  const fuzzy = (a, b) => norm(a).includes(norm(b)) || norm(b).includes(norm(a));

  // ── 1. Budget compatibility (20 pts) ──────────────────────────────────────
  // Closer budgets = better; score scales with the overlap ratio.
  const userBudget = userPrefs?.budget_max;
  const theirBudget = flatmate.budget_max;
  if (userBudget && theirBudget) {
    const ratio = Math.min(userBudget, theirBudget) / Math.max(userBudget, theirBudget);
    score += Math.round(ratio * 20);
  } else {
    score += 12; // neutral when budget unknown
  }

  // ── 2. City & area overlap (20 pts) ───────────────────────────────────────
  const userCities = userPrefs?.cities || [];
  if (userCities.length === 0) {
    score += 12;
  } else if (userCities.some(c => norm(c) === norm(flatmate.city || ""))) {
    score += 20;
    // Small bonus when preferred areas also overlap
    const userAreas = userPrefs?.areas || [];
    if (userAreas.length > 0 && flatmate.looking_in?.some(a => userAreas.some(ua => fuzzy(a, ua)))) {
      score += 4;
    }
  }

  // ── 3. Lifestyle preference match (20 pts) ────────────────────────────────
  // How well does the flatmate's actual lifestyle match what the user wants?
  const wantedLifestyle = userPrefs?.flatmate_lifestyle || [];
  const theirLifestyle = flatmate.lifestyle || [];
  const wantMatches = wantedLifestyle.filter(want => theirLifestyle.some(has => fuzzy(want, has)));
  if (wantedLifestyle.length > 0) {
    score += Math.round((wantMatches.length / wantedLifestyle.length) * 20);
    mutualInterests.push(...wantMatches);
  } else {
    score += 12; // neutral — no preference set yet
    // Still surface overlaps between user's own lifestyle and the flatmate's
    const myLifestyle = userPrefs?.my_lifestyle || [];
    mutualInterests.push(...myLifestyle.filter(mine => theirLifestyle.some(has => fuzzy(mine, has))));
  }

  // ── 4. Dealbreaker avoidance (20 pts) ─────────────────────────────────────
  // Each conflict between a dealbreaker and a lifestyle trait costs 7 pts.
  const TRIGGERS = {
    "Smoking indoors": ["Smoker"],
    "Loud music": ["Social butterfly", "Night owl"],
    "Frequent overnight guests": ["Social butterfly"],
    "Messy common areas": [],
    "No cleaning rota": [],
    "Very different sleep schedule": ["Night owl", "Early bird"],
  };

  let violations = 0;
  const myLifestyle = userPrefs?.my_lifestyle || [];

  // User's dealbreakers vs flatmate's lifestyle
  (userPrefs?.flatmate_dealbreakers || []).forEach(db => {
    if ((TRIGGERS[db] || []).some(t => theirLifestyle.some(fl => fuzzy(t, fl)))) violations++;
  });
  // Flatmate's dealbreakers vs user's own lifestyle
  (flatmate.dealbreakers || []).forEach(db => {
    if ((TRIGGERS[db] || []).some(t => myLifestyle.some(ml => fuzzy(t, ml)))) violations++;
  });

  score += Math.max(0, 20 - violations * 7);

  // ── 5. Gender preference (10 pts) ─────────────────────────────────────────
  const genderPrefs = userPrefs?.flatmate_gender || [];
  if (genderPrefs.length === 0 || genderPrefs.includes("No preference")) {
    score += 10;
  } else if (genderPrefs.some(g => norm(g) === norm(flatmate.gender || ""))) {
    score += 10;
  }

  // ── 6. Age range preference (10 pts) ──────────────────────────────────────
  const ageRangePrefs = userPrefs?.flatmate_age_range || [];
  const theirAge = parseInt(flatmate.age);
  const AGE_RANGES = { "18–25": [18, 25], "26–35": [26, 35], "36–45": [36, 45], "45+": [45, 999] };
  if (ageRangePrefs.length === 0 || ageRangePrefs.includes("No preference")) {
    score += 10;
  } else if (ageRangePrefs.some(r => { const [lo, hi] = AGE_RANGES[r] || []; return lo != null && theirAge >= lo && theirAge <= hi; })) {
    score += 10;
  }

  return {
    score: Math.min(100, Math.max(30, score)), // floor at 30 so no one displays as 0%
    mutualInterests: [...new Set(mutualInterests)],
  };
}

// ─── Flatmate Swipe Mode ─────────────────────────────────────────────────────
function FlatmateSwipeMode({ flatmates, liked, onLike, onPass, onClose }) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState(null);
  const [exiting, setExiting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const dragStart = useRef(null);
  const dragMoved = useRef(false);

  const flatmate = flatmates[idx];
  const next = flatmates[idx + 1];
  const THRESHOLD = 100;

  const handleDragStart = (e) => {
    dragStart.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    dragMoved.current = false;
    setDragging(true);
  };
  const handleDragMove = (e) => {
    if (!dragging || dragStart.current === null) return;
    const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const delta = x - dragStart.current;
    if (Math.abs(delta) > 6) dragMoved.current = true;
    setDrag(delta);
    setDirection(delta > 20 ? 'right' : delta < -20 ? 'left' : null);
  };
  const handleDragEnd = () => {
    setDragging(false);
    if (!dragMoved.current) {
      setShowDetail(s => !s);
      setDrag(0); setDirection(null);
      dragStart.current = null;
      return;
    }
    if (Math.abs(drag) >= THRESHOLD) {
      const isRight = drag > 0;
      if (isRight) onLike(flatmate);
      else onPass(flatmate.id);
      setExiting(true); setDirection(isRight ? 'right' : 'left');
      setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
    } else {
      setDrag(0); setDirection(null);
    }
    dragStart.current = null;
  };
  const swipeRight = () => {
    onLike(flatmate);
    setExiting(true); setDirection('right');
    setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
  };
  const swipeLeft = () => {
    onPass(flatmate.id);
    setExiting(true); setDirection('left');
    setTimeout(() => { setIdx(i => i + 1); setDrag(0); setDirection(null); setExiting(false); setShowDetail(false); }, 320);
  };

  if (!flatmate) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.9)', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>You've seen everyone!</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Check your connections in the Connected tab.</div>
        <button onClick={onClose} style={{ marginTop: 16, padding: '12px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #c9a84c, #8b6520)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>View connections</button>
      </div>
    );
  }

  const rotation = drag / 18;
  const connectOpacity = Math.min(1, drag / THRESHOLD);
  const passOpacity = Math.min(1, -drag / THRESHOLD);
  const exitTransform = exiting
    ? direction === 'right' ? 'translateX(120%) rotate(20deg)' : 'translateX(-120%) rotate(-20deg)'
    : `translateX(${drag}px) rotate(${rotation}deg)`;
  const matchColor = flatmate.match >= 85 ? '#5aaa4a' : flatmate.match >= 70 ? '#c9a84c' : '#9a8f80';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.9)', zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", backdropFilter: 'blur(8px)' }}>
      <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Est<span style={{ color: '#c9a84c' }}>ato</span> <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>Flatmates</span></div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{idx + 1} / {flatmates.length}</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.1)' }}>
        <div style={{ height: '100%', background: '#c9a84c', width: `${(idx / flatmates.length) * 100}%`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Card stack */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Background next card */}
        {next && (
          <div style={{ position: 'absolute', width: '100%', borderRadius: 24, overflow: 'hidden', background: '#1a1410', transform: `scale(${0.93 + Math.min(0.07, Math.abs(drag) / 1000)})`, transition: dragging ? 'none' : 'transform 0.3s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ height: 200, background: 'linear-gradient(135deg, #1a1410, #2d2318)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={next.avatar} alt={next.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', opacity: 0.5, border: '2px solid rgba(201,168,76,0.3)' }} />
            </div>
            <div style={{ padding: '12px 18px', background: '#1a1410' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{next.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{next.age} · {next.occupation}</div>
            </div>
          </div>
        )}

        {/* Main swipeable card */}
        <div
          onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
          style={{ position: 'absolute', width: '100%', borderRadius: 24, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', transform: exitTransform, transition: exiting || !dragging ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', userSelect: 'none' }}
        >
          {/* Avatar banner */}
          <div style={{ position: 'relative', height: 220, background: 'linear-gradient(135deg, #1a1410, #2d2318)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={flatmate.avatar} alt={flatmate.name} draggable={false} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${matchColor}`, pointerEvents: 'none' }} />
            {/* Match badge */}
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: `1px solid ${matchColor}50` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: matchColor }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: matchColor }}>{flatmate.match}% match</span>
            </div>
            {/* Active dot */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5aba5a' }} />
              <span style={{ fontSize: 10, color: '#5aba5a', fontWeight: 600 }}>Active</span>
            </div>
            {/* Connect overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(80,180,80,0.5), transparent)', opacity: connectOpacity, pointerEvents: 'none', display: 'flex', alignItems: 'center', padding: 28 }}>
              <div style={{ border: '4px solid #5aba5a', borderRadius: 12, padding: '8px 18px', transform: 'rotate(-15deg)' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#5aba5a', letterSpacing: 2 }}>CONNECT ♥</span>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(225deg, rgba(220,60,60,0.5), transparent)', opacity: passOpacity, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: 28 }}>
              <div style={{ border: '4px solid #e05555', borderRadius: 12, padding: '8px 18px', transform: 'rotate(15deg)' }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#e05555', letterSpacing: 2 }}>PASS ✕</span>
              </div>
            </div>
            {!showDetail && !dragging && (
              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '5px 14px', borderRadius: 20, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                Tap for details
              </div>
            )}
          </div>

          {/* Brief info */}
          <div style={{ background: '#1a1410', padding: '14px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{flatmate.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{flatmate.age} · {flatmate.occupation}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c' }}>up to £{flatmate.budget_max.toLocaleString()}/mo</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{flatmate.area} · {flatmate.city}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {flatmate.lifestyle.slice(0, 4).map(l => (
                <span key={l} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, background: flatmate.mutualInterests?.includes(l) ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${flatmate.mutualInterests?.includes(l) ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.12)'}`, color: flatmate.mutualInterests?.includes(l) ? '#c9a84c' : 'rgba(255,255,255,0.6)', fontWeight: flatmate.mutualInterests?.includes(l) ? 600 : 400 }}>
                  {flatmate.mutualInterests?.includes(l) ? '✓ ' : ''}{l}
                </span>
              ))}
            </div>
          </div>

          {/* Detail sheet */}
          {showDetail && (
            <div style={{ background: '#fff', animation: 'slideUp 0.28s ease', maxHeight: 340, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 18px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>About</div>
                <p style={{ fontSize: 13, color: '#3a3028', lineHeight: 1.7, margin: 0 }}>{flatmate.bio}</p>
              </div>
              {flatmate.mutualInterests?.length > 0 && (
                <div style={{ padding: '14px 18px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Shared interests</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {flatmate.mutualInterests.map(l => <span key={l} style={{ padding: '4px 10px', borderRadius: 20, background: '#fdf8ee', border: '1px solid #e8d898', fontSize: 11, color: '#7a5520', fontWeight: 600 }}>✓ {l}</span>)}
                  </div>
                </div>
              )}
              <div style={{ padding: '14px 18px 0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Looking in</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {flatmate.looking_in.map(a => <span key={a} style={{ padding: '4px 10px', borderRadius: 20, background: '#faf8f4', border: '1px solid #ede8de', fontSize: 11, color: '#5a5248' }}>{a}</span>)}
                </div>
              </div>
              {flatmate.dealbreakers?.length > 0 && (
                <div style={{ padding: '14px 18px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9a8f80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dealbreakers 🚫</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {flatmate.dealbreakers.map(d => <span key={d} style={{ padding: '4px 10px', borderRadius: 20, background: '#fff0f0', border: '1px solid #f0c8c8', fontSize: 11, color: '#b03030' }}>{d}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: -44, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, opacity: 0.4 }}>
          <span style={{ fontSize: 11, color: '#fff' }}>← pass</span>
          <span style={{ fontSize: 11, color: '#fff' }}>tap card for details</span>
          <span style={{ fontSize: 11, color: '#fff' }}>connect →</span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 64 }}>
        <button onClick={swipeLeft}
          style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(220,60,60,0.6)', background: 'rgba(220,60,60,0.1)', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: '#e05555' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,60,60,0.25)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,60,60,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}>✕</button>
        <button onClick={() => setShowDetail(s => !s)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', background: showDetail ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showDetail ? '#c9a84c' : 'rgba(255,255,255,0.5)' }}>ℹ</button>
        <button onClick={swipeRight}
          style={{ width: 60, height: 60, borderRadius: '50%', border: `2px solid ${liked.has(flatmate.id) ? 'rgba(201,168,76,0.6)' : 'rgba(80,180,80,0.6)'}`, background: liked.has(flatmate.id) ? 'rgba(201,168,76,0.2)' : 'rgba(80,180,80,0.1)', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: liked.has(flatmate.id) ? '#c9a84c' : '#5aba5a' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>♥</button>
      </div>
    </div>
  );
}

// ─── Flatmates Panel ─────────────────────────────────────────────────────────
function FlatmatesPanel({ userPrefs, onConnect, user, userConvsCount = 0 }) {
  const T = useTheme();
  const uid = user?.id || "guest";
  const [selected, setSelected] = useState(null);
  const [liked, setLiked] = useState(() => loadConnections(uid));
  const [passed, setPassed] = useState(new Set());
  const [filterCity, setFilterCity] = useState("London");
  const [activeTab, setActiveTab] = useState("discover");
  const [swipeMode, setSwipeMode] = useState(false);

  // Persist liked connections to localStorage whenever they change
  useEffect(() => { saveConnections(uid, liked); }, [liked, uid]);

  const toggleLike = (id, flatmate) => setLiked(s => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); if (onConnect && flatmate) onConnect(flatmate); } return n; });
  const pass = (id) => setPassed(s => new Set([...s, id]));

  // Score every flatmate against the current user's profile, memoised so it only
  // recomputes when userPrefs changes (not on every render).
  const scoredFlatmates = useMemo(() =>
    DUMMY_FLATMATES.map(f => {
      const { score, mutualInterests } = computeFlatmateMatch(userPrefs, f);
      return { ...f, match: score, mutualInterests };
    }),
    [userPrefs]
  );

  const userCities = userPrefs?.cities?.map(c => c.toLowerCase()) || [];

  const visible = scoredFlatmates
    .filter(f => !passed.has(f.id))
    .filter(f => f.city === filterCity)
    .filter(f => userCities.length === 0 || userCities.includes(f.city.toLowerCase()))
    .sort((a, b) => b.match - a.match);

  const likedList = scoredFlatmates.filter(f => liked.has(f.id));

  const MatchBadge = ({ pct }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: pct >= 85 ? "#f0f8ee" : pct >= 70 ? "#fdf8ee" : "#faf8f4", border: `1px solid ${pct >= 85 ? "#b8e0a8" : pct >= 70 ? "#e8d898" : "#ede8de"}` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: pct >= 85 ? "#5aaa4a" : pct >= 70 ? "#c9a84c" : "#9a8f80" }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 85 ? "#3a8a2a" : pct >= 70 ? "#7a5520" : "#6a6058", fontFamily: "'DM Sans', sans-serif" }}>{pct}% match</span>
    </div>
  );

  const Card = ({ f, detail = false }) => (
    <div onClick={() => !detail && setSelected(f)} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: liked.has(f.id) ? "1.5px solid #c9a84c" : "1px solid #ede8de", cursor: detail ? "default" : "pointer", transition: "box-shadow 0.15s, transform 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      onMouseEnter={e => { if (!detail) { e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.09)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "none"; }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 10px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img src={f.avatar} alt={f.name} style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "2px solid #f0ebe0" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: "#5aba5a", border: "2px solid #fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{f.name}</div>
            <MatchBadge pct={f.match} />
          </div>
          <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>{f.age} · {f.occupation}</div>
          <div style={{ fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
            <Svg d={I.pin} size={10} stroke="#c9a84c" />{f.area} · up to £{f.budget_max.toLocaleString()}/mo
          </div>
        </div>
        {!detail && (
          <button onClick={e => { e.stopPropagation(); toggleLike(f.id, f); }} style={{ width: 32, height: 32, borderRadius: "50%", border: liked.has(f.id) ? "1.5px solid #c9a84c" : "1px solid #ede8de", background: liked.has(f.id) ? "#fdf8ee" : "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {liked.has(f.id) ? "♥" : "♡"}
          </button>
        )}
      </div>
      {/* Bio */}
      <div style={{ padding: "0 16px 8px" }}>
        <p style={{ fontSize: 12.5, color: "#3a3028", lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif", display: "-webkit-box", WebkitLineClamp: detail ? 20 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{f.bio}</p>
      </div>
      {/* Social stats mini row */}
      <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#3a3028", fontFamily: "'DM Sans', sans-serif" }}><strong style={{ fontWeight: 700 }}>{f.connections}</strong> <span style={{ color: "#9a8f80" }}>connections</span></span>
        <span style={{ color: "#d8d0c0", fontSize: 12 }}>·</span>
        <span style={{ fontSize: 12, color: "#3a3028", fontFamily: "'DM Sans', sans-serif" }}><strong style={{ fontWeight: 700 }}>{f.activeConversations}</strong> <span style={{ color: "#9a8f80" }}>active chats</span></span>
      </div>
      {/* Lifestyle */}
      <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
        {f.lifestyle.map(l => (
          <span key={l} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontFamily: "'DM Sans', sans-serif", background: f.mutualInterests?.includes(l) ? "#fdf8ee" : "#faf8f4", border: `1px solid ${f.mutualInterests?.includes(l) ? "#e8d898" : "#ede8de"}`, color: f.mutualInterests?.includes(l) ? "#7a5520" : "#7a6a58", fontWeight: f.mutualInterests?.includes(l) ? 600 : 400 }}>
            {f.mutualInterests?.includes(l) ? "✓ " : ""}{l}
          </span>
        ))}
      </div>
      {detail && (
        <>
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Looking in</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{f.looking_in.map(a => <span key={a} style={{ padding: "3px 9px", borderRadius: 20, background: "#faf8f4", border: "1px solid #ede8de", fontSize: 11, color: "#5a5248", fontFamily: "'DM Sans', sans-serif" }}>{a}</span>)}</div>
          </div>
          {f.dealbreakers?.length > 0 && (
            <div style={{ padding: "0 16px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Dealbreakers 🚫</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{f.dealbreakers.map(d => <span key={d} style={{ padding: "3px 9px", borderRadius: 20, background: "#fff0f0", border: "1px solid #f0c8c8", fontSize: 11, color: "#b03030", fontFamily: "'DM Sans', sans-serif" }}>{d}</span>)}</div>
            </div>
          )}
        </>
      )}
      {!detail && (
        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #f0ebe0", display: "flex", gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); pass(f.id); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #ede8de", background: "#fff", cursor: "pointer", fontSize: 12, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>Pass</button>
          <button onClick={e => { e.stopPropagation(); toggleLike(f.id, f); }} style={{ flex: 2, padding: "8px", borderRadius: 8, border: "none", background: liked.has(f.id) ? "#fdf8ee" : "linear-gradient(135deg, #c9a84c, #8b6520)", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", color: liked.has(f.id) ? "#7a5520" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {liked.has(f.id) ? "♥ Connected" : "♥ Connect"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", top: 0, left: T.sidebarW, right: 0, bottom: 0, background: T.bg, zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", background: "#fff", borderBottom: "1px solid #ede8de", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1a1410", margin: 0 }}>Find Flatmates</h1>
            <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 3 }}>{visible.length} people looking in {filterCity}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {["London", "Manchester", "New York"].map(city => (
              <button key={city} onClick={() => setFilterCity(city)} style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${filterCity === city ? "#c9a84c" : "#ede8de"}`, background: filterCity === city ? "#fdf8ee" : "#fff", cursor: "pointer", fontSize: 12, color: filterCity === city ? "#7a5520" : "#9a8f80", fontWeight: filterCity === city ? 600 : 400, fontFamily: "'DM Sans', sans-serif" }}>{city}</button>
            ))}
            <button onClick={() => setSwipeMode(true)} style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid #c9a84c", background: "linear-gradient(135deg, #c9a84c, #8b6520)", cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>↕</span> Swipe
            </button>
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {[["discover", "🔍 Discover"], ["liked", `♥ Connected${liked.size > 0 ? ` (${liked.size})` : ""}`]].map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? "#1a1410" : "#9a8f80", borderBottom: `2.5px solid ${activeTab === t ? "#c9a84c" : "transparent"}`, transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif" }}>{label}</button>
          ))}
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {activeTab === "discover" && (
          <>
            {userPrefs?.my_bio && (
              <div style={{ marginBottom: 20, padding: "14px 18px", background: "#fff", borderRadius: 12, border: "1.5px solid #c9a84c" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #c9a84c, #8b6520)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🧑‍💼</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410" }}>Your profile is live</div>
                    <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{userPrefs.my_occupation ? `Listed as: ${userPrefs.my_occupation}` : "Others can see your flatmate profile"}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#5aaa4a", fontWeight: 600, flexShrink: 0 }}>● Active</div>
                </div>
                {/* User's own social stats */}
                <div style={{ display: "flex", marginTop: 12, paddingTop: 10, borderTop: "1px solid #f5edd8", gap: 0 }}>
                  {[{ count: liked.size, label: "Connections" }, { count: userConvsCount, label: "Active chats" }].map(({ count, label }, i) => (
                    <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i === 0 ? "1px solid #f0e8d0" : "none" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: count > 0 ? "#c9a84c" : "#1a1410", fontFamily: "'DM Sans', sans-serif" }}>{count}</div>
                      <div style={{ fontSize: 10, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {visible.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "40vh", gap: 12, color: "#9a8f80" }}>
                <div style={{ fontSize: 40 }}>🏠</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>No more profiles in {filterCity}</div>
                <div style={{ fontSize: 13 }}>Try a different city</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {visible.map(f => <Card key={f.id} f={f} />)}
              </div>
            )}
          </>
        )}
        {activeTab === "liked" && (
          likedList.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "40vh", gap: 12, color: "#9a8f80" }}>
              <div style={{ fontSize: 40 }}>♡</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>No connections yet</div>
              <div style={{ fontSize: 13 }}>Heart profiles you'd like to live with</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {likedList.map(f => <Card key={f.id} f={f} detail />)}
            </div>
          )
        )}
      </div>
      {/* Detail overlay */}
      {selected && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(15,10,5,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ position: "relative" }}>
              <div style={{ height: 100, background: "linear-gradient(135deg, #1a1410, #2d2318)" }} />
              <img src={selected.avatar} alt={selected.name} style={{ position: "absolute", bottom: -28, left: 24, width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }} />
              <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", color: "#fff", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ padding: "40px 24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1410" }}>{selected.name}</div>
                  <div style={{ fontSize: 13, color: "#9a8f80", marginTop: 2 }}>{selected.age} · {selected.occupation} · {selected.area}</div>
                </div>
                <MatchBadge pct={selected.match} />
              </div>
              {/* Social stats strip */}
              <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid #ede8de", marginBottom: 16 }}>
                {[{ count: selected.connections, label: "Connections" }, { count: selected.activeConversations, label: "Active chats" }].map(({ count, label }, i) => (
                  <div key={label} style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRight: i === 0 ? "1px solid #ede8de" : "none", background: "#faf8f4" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#1a1410", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 10, color: "#9a8f80", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                  </div>
                ))}
              </div>
              <Card f={selected} detail />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { pass(selected.id); setSelected(null); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #ede8de", background: "#fff", cursor: "pointer", fontSize: 13, color: "#9a8f80", fontFamily: "'DM Sans', sans-serif" }}>Pass</button>
                <button onClick={() => { toggleLike(selected.id, selected); setSelected(null); }} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: liked.has(selected.id) ? "#fdf8ee" : "linear-gradient(135deg, #c9a84c, #8b6520)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: liked.has(selected.id) ? "#7a5520" : "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                  {liked.has(selected.id) ? "♥ Connected" : "♥ Connect"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {swipeMode && (
        <FlatmateSwipeMode
          flatmates={visible}
          liked={liked}
          onLike={(f) => { if (!liked.has(f.id)) toggleLike(f.id, f); }}
          onPass={pass}
          onClose={() => { setSwipeMode(false); setActiveTab("liked"); }}
        />
      )}
    </div>
  );
}

// ─── Shorts Relevance Scoring ─────────────────────────────────────────────────
// Scores a listing against user preferences + interaction history (saved/shared).
// Higher = more relevant. Used to rank the Shorts feed.
function scoreListing(listing, userPrefs, interactionListings = []) {
  let score = 0;

  if (userPrefs) {
    // City match — biggest signal
    if (userPrefs.cities?.some(c => c.toLowerCase() === listing.city?.toLowerCase())) score += 40;

    // Rent / buy intent
    if (userPrefs.intent === "renting" && listing.isForRent) score += 25;
    if (userPrefs.intent === "buying" && !listing.isForRent) score += 25;
    if (userPrefs.intent === "investing") score += 8; // investing = either

    // Budget fit
    if (userPrefs.budget_max) {
      if (listing.price <= userPrefs.budget_max) score += 15;
      if (listing.price > userPrefs.budget_max * 1.25) score -= 20; // over-budget penalty
    }
    if (userPrefs.budget_min && listing.price >= userPrefs.budget_min) score += 5;

    // Property type
    if (userPrefs.types?.some(t => listing.type?.toLowerCase().includes(t.toLowerCase()))) score += 12;

    // Must-have features
    const features = listing.features || [];
    (userPrefs.must_haves || []).forEach(mh => {
      if (features.some(f => f.toLowerCase().includes(mh.toLowerCase()))) score += 10;
    });

    // Amenity preferences
    if (userPrefs.petFriendly && listing.petFriendly) score += 8;
    if (userPrefs.parking && listing.parking) score += 6;
    if (userPrefs.outdoor && listing.outdoor) score += 5;
    if (userPrefs.quiet && listing.quiet) score += 4;
    if (userPrefs.nearTransport && listing.nearTransport) score += 4;
  }

  // Content-based filtering: similarity to saved / shared listings
  interactionListings.forEach(il => {
    let sim = 0;
    if (il.city === listing.city) sim += 15;
    const pDiff = Math.abs((il.price || 0) - listing.price) / Math.max(il.price || 1, 1);
    if (pDiff < 0.25) sim += 10;
    else if (pDiff < 0.5) sim += 5;
    if (il.type && il.type === listing.type) sim += 8;
    if (il.bedrooms != null && il.bedrooms === listing.bedrooms) sim += 6;
    if (il.isForRent === listing.isForRent) sim += 4;
    score += Math.round(sim * 0.55); // weighted so it augments but doesn't dominate
  });

  return score;
}

// Returns a short human-readable label explaining why a listing was surfaced.
function getListingReason(listing, userPrefs, interactionListings) {
  // Interaction-based reasons take priority (more specific)
  if (interactionListings.some(il =>
    il.city === listing.city &&
    Math.abs((il.price || 0) - listing.price) / Math.max(il.price || 1, 1) < 0.4 &&
    il.isForRent === listing.isForRent
  )) return "Similar to saved";

  if (interactionListings.some(il => il.type && il.type === listing.type && il.city === listing.city)) {
    return "Matches your style";
  }

  // Preference-based reasons
  if (userPrefs?.cities?.some(c => c.toLowerCase() === listing.city?.toLowerCase())) {
    return "Near your city";
  }

  if (userPrefs?.budget_max && listing.price <= userPrefs.budget_max &&
    (!userPrefs.budget_min || listing.price >= userPrefs.budget_min)) {
    return "In your budget";
  }

  if (userPrefs?.types?.some(t => listing.type?.toLowerCase().includes(t.toLowerCase()))) {
    return "Your type";
  }

  return null;
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────
// connections = array of flatmate objects who are liked/connected
// conversations = directConversations (may already include flatmate convs)
function ShareSheet({ listing, conversations, connections, onSendTo, onStartWith, onClose }) {
  const [sentTo, setSentTo] = useState(null);
  const [copied, setCopied] = useState(false);

  const price = formatPrice(listing.price, listing.currency, listing.isForRent);
  const shareText = [
    `${listing.title} — ${price} in ${listing.city}`,
    listing.bedrooms != null ? `${listing.bedrooms} bed${listing.bedrooms !== 1 ? "s" : ""}${listing.bathrooms != null ? ` · ${listing.bathrooms} bath${listing.bathrooms !== 1 ? "s" : ""}` : ""}` : null,
    "\nFound on Estato 🏠",
  ].filter(Boolean).join("\n");
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  // Build unified recipient list:
  // 1. Flatmate connections (with or without active conversation)
  // 2. Landlord conversations (no connection concept, just chats)
  const allRows = connections.map(f => {
    const conv = conversations.find(c => c.id === `flatmate-${f.id}`);
    return { key: `flatmate-${f.id}`, name: f.name, avatar: f.avatar || null, type: "flatmate", hasConv: !!conv, convId: conv?.id, flatmate: f };
  });

  const handleSend = (row) => {
    if (sentTo) return;
    if (row.hasConv) {
      onSendTo(row.convId, listing);
    } else {
      onStartWith(row.flatmate, listing);
    }
    setSentTo(row.key);
    setTimeout(() => { setSentTo(null); onClose(); }, 1300);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(20,16,10,0.55)",
      zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(5px)", animation: "fadeIn 0.18s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 70px rgba(0,0,0,0.22)", overflow: "hidden",
        animation: "slideUp 0.22s ease", maxHeight: "88vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #f0ebe0",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1410" }}>Share listing</div>
            <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2, maxWidth: 290, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontSize: 22, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Mini listing preview */}
          <div style={{ margin: "16px 24px", borderRadius: 12, overflow: "hidden", border: "1px solid #ede8de", display: "flex", height: 72 }}>
            {listing.image && (
              <img src={listing.image} alt="" style={{ width: 88, height: 72, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ padding: "10px 14px", flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", marginTop: 2 }}>{price}</div>
              <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 1 }}>📍 {listing.city}</div>
            </div>
          </div>

          {/* Send to connections / conversations */}
          {allRows.length > 0 ? (
            <div style={{ padding: "0 24px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Send to
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allRows.map(row => (
                  <button key={row.key} onClick={() => handleSend(row)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                    borderRadius: 11, border: `1.5px solid ${sentTo === row.key ? "#c9a84c" : "#ede8de"}`,
                    background: sentTo === row.key ? "#fdf8ee" : "#faf8f4",
                    cursor: sentTo ? "default" : "pointer", textAlign: "left",
                    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", width: "100%",
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                      background: row.type === "flatmate" ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "linear-gradient(135deg, #3a6a8a, #1a3a5a)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                    }}>
                      {row.avatar
                        ? <img src={row.avatar} alt={row.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (row.type === "flatmate" ? "🤝" : "🏠")}
                    </div>
                    {/* Name + label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: row.type === "flatmate" ? "#8b6520" : "#3a6a8a" }}>
                          {row.type === "flatmate" ? "Connection" : "Landlord"}
                        </span>
                        {!row.hasConv && (
                          <span style={{ fontSize: 10, color: "#9a8f80", background: "#f0ebe0", padding: "1px 6px", borderRadius: 6 }}>New chat</span>
                        )}
                      </div>
                    </div>
                    {/* Send status */}
                    <span style={{ fontSize: 12, fontWeight: 600, color: sentTo === row.key ? "#c9a84c" : "#c0b8a8", flexShrink: 0 }}>
                      {sentTo === row.key ? "✓ Sent!" : "Send →"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: "12px 24px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#9a8f80", lineHeight: 1.6 }}>
                Connect with flatmates first to share listings directly on the platform.
              </div>
            </div>
          )}

          {/* External share */}
          <div style={{ padding: "16px 24px 24px", borderTop: "1px solid #f0ebe0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Share externally
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <a href={waUrl} target="_blank" rel="noreferrer" style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "13px 8px", borderRadius: 12, background: "#e7fce8", border: "1px solid #a8e0a8",
                textDecoration: "none", color: "#1a5c20", fontSize: 12, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <span style={{ fontSize: 22 }}>📱</span> WhatsApp
              </a>
              <a href={xUrl} target="_blank" rel="noreferrer" style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "13px 8px", borderRadius: 12, background: "#f0f4ff", border: "1px solid #c0ccf0",
                textDecoration: "none", color: "#1a2a7a", fontSize: 12, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>✕</span> Twitter / X
              </a>
              <button onClick={handleCopy} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "13px 8px", borderRadius: 12,
                background: copied ? "#fdf8ee" : "#faf8f4",
                border: `1px solid ${copied ? "#c9a84c" : "#ede8de"}`,
                cursor: "pointer", color: copied ? "#7a5520" : "#3a3028",
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
              }}>
                <span style={{ fontSize: 22 }}>{copied ? "✓" : "📋"}</span>
                {copied ? "Copied!" : "Copy text"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shorts / Listings Feed ────────────────────────────────────────────────────
function ShortCard({ listing, isFavourited, onFavourite, onSelect, onShare }) {
  const [expanded, setExpanded] = useState(false);
  const imgUrl = listing.image || listing.images?.[0] || null;
  const price = formatPrice(listing.price, listing.currency, listing.isForRent);
  const isSaved = isFavourited;

  return (
    <div
      style={{
        height: "100%", width: "100%", position: "relative",
        background: imgUrl ? "#000" : "#1a1410", overflow: "hidden", cursor: "pointer",
      }}
      onClick={() => onSelect && onSelect(listing)}
    >
      {imgUrl && (
        <img src={imgUrl} alt={listing.title} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.85,
        }} />
      )}
      {/* Gradient overlays */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.08) 100%)",
        pointerEvents: "none",
      }} />

      {/* Top tags */}
      <div style={{ position: "absolute", top: 20, left: 20, display: "flex", flexWrap: "wrap", gap: 6, maxWidth: "calc(100% - 80px)" }}>
        {listing._userAdded && (
          <span style={{
            background: "#c9a84c", color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "3px 9px", borderRadius: 20, letterSpacing: "0.05em", textTransform: "uppercase",
          }}>New listing</span>
        )}
        {listing._reason && (
          <span style={{
            background: "rgba(201,168,76,0.82)", backdropFilter: "blur(6px)",
            color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "3px 9px", borderRadius: 20, letterSpacing: "0.04em",
          }}>✦ {listing._reason}</span>
        )}
        <span style={{
          background: listing.isForRent ? "rgba(80,180,100,0.22)" : "rgba(201,168,76,0.18)",
          border: `1px solid ${listing.isForRent ? "rgba(80,180,100,0.5)" : "rgba(201,168,76,0.45)"}`,
          color: "#fff", fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
        }}>{listing.isForRent ? "For Rent" : "For Sale"}</span>
      </div>

      {/* Right action buttons */}
      <div style={{
        position: "absolute", right: 16, bottom: 180,
        display: "flex", flexDirection: "column", gap: 22, alignItems: "center",
      }}>
        <button onClick={(e) => { e.stopPropagation(); onFavourite && onFavourite(listing); }} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          color: isSaved ? "#c9a84c" : "#fff",
        }}>
          <span style={{ fontSize: 28 }}>{isSaved ? "♥" : "♡"}</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Save</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onSelect && onSelect(listing); }} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#fff",
        }}>
          <span style={{ fontSize: 22 }}>⤢</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Details</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onShare && onShare(listing); }} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#fff",
        }}>
          <span style={{ fontSize: 20 }}>↗</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Share</span>
        </button>
      </div>

      {/* Bottom info */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 64, padding: "0 20px 28px" }}>
        {listing.agent && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>🏠 {listing.agent}</div>
        )}
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: 6 }}>
          {listing.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#c9a84c" }}>{price}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
            📍 {listing.area ? `${listing.area}, ` : ""}{listing.city}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
          {listing.bedrooms != null && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>🛏 {listing.bedrooms} bed{listing.bedrooms !== 1 ? "s" : ""}</span>}
          {listing.bathrooms != null && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>🚿 {listing.bathrooms} bath{listing.bathrooms !== 1 ? "s" : ""}</span>}
          {listing.type && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{listing.type}</span>}
        </div>
        {listing.description && (
          <div>
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.55,
              overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical",
            }}>
              {listing.description}
            </div>
            {listing.description.length > 80 && (
              <button onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }} style={{
                background: "none", border: "none", color: "#c9a84c", fontSize: 12,
                fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 4,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {expanded ? "less ↑" : "more ↓"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddListingModal({ onClose, onPost, user, profile }) {
  const [photo, setPhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [isForRent, setIsForRent] = useState(true);
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [desc, setDesc] = useState("");
  const [landlordName, setLandlordName] = useState(profile?.full_name || user?.email?.split("@")[0] || "");
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const CITIES = useMemo(() => [...new Set(LISTINGS.map(l => l.city))].sort(), []);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try { setPhoto(await resizeImageToDataURL(file, 900, 0.85)); } catch { }
    finally { setPhotoUploading(false); e.target.value = ""; }
  };

  const canPost = title.trim() && city && price && !posting;

  const handlePost = () => {
    if (!canPost) return;
    setPosting(true);
    onPost({
      id: `user-${Date.now()}`,
      title: title.trim(),
      city,
      area: area.trim() || city,
      isForRent,
      price: parseFloat(price.replace(/[^0-9.]/g, "")) || 0,
      bedrooms: beds ? parseInt(beds) : null,
      bathrooms: baths ? parseInt(baths) : null,
      description: desc.trim(),
      agent: landlordName.trim() || "Private Landlord",
      image: photo,
      type: "Apartment",
      currency: "£",
      _userAdded: true,
    });
    setPosting(false);
    onClose();
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10, color: "#fff", fontSize: 14, outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)",
      zIndex: 2000, display: "flex", flexDirection: "column", overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>Add a Listing</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Post your property as a Short</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 22 }}>✕</button>
      </div>

      {/* Form body */}
      <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 560, width: "100%", margin: "0 auto" }}>

        {/* Photo */}
        <div>
          <label style={labelStyle}>Property photo</label>
          <div onClick={() => fileRef.current?.click()} style={{
            width: "100%", height: 200, borderRadius: 12,
            border: "2px dashed rgba(255,255,255,0.18)",
            background: photo ? "none" : "rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", overflow: "hidden", position: "relative",
          }}>
            {photo ? (
              <>
                <img src={photo} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: 0, transition: "opacity 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Change photo</span>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13 }}>{photoUploading ? "Uploading…" : "Click to add photo"}</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>Property title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Stunning 2-bed flat in Notting Hill" style={inputStyle} />
        </div>

        {/* City + Area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>City *</label>
            <select value={city} onChange={e => setCity(e.target.value)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">Select city…</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Neighbourhood / Area</label>
            <input value={area} onChange={e => setArea(e.target.value)}
              placeholder="e.g. Notting Hill" style={inputStyle} />
          </div>
        </div>

        {/* For Rent / For Sale */}
        <div>
          <label style={labelStyle}>Listing type</label>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
            {[["rent", true, "For Rent"], ["sale", false, "For Sale"]].map(([key, val, label]) => (
              <button key={key} onClick={() => setIsForRent(val)} style={{
                flex: 1, padding: "11px", border: "none", cursor: "pointer",
                background: isForRent === val ? "#c9a84c" : "rgba(255,255,255,0.04)",
                color: isForRent === val ? "#fff" : "rgba(255,255,255,0.55)",
                fontWeight: isForRent === val ? 700 : 400, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Price + Beds + Baths */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Price (£) *</label>
            <input value={price} onChange={e => setPrice(e.target.value)}
              placeholder={isForRent ? "2500" : "450000"} style={inputStyle} type="number" />
          </div>
          <div>
            <label style={labelStyle}>Bedrooms</label>
            <input value={beds} onChange={e => setBeds(e.target.value)}
              placeholder="2" style={inputStyle} type="number" min="0" />
          </div>
          <div>
            <label style={labelStyle}>Bathrooms</label>
            <input value={baths} onChange={e => setBaths(e.target.value)}
              placeholder="1" style={inputStyle} type="number" min="0" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Describe the property — highlights, nearby amenities, transport links…"
            rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Landlord name */}
        <div>
          <label style={labelStyle}>Your name / Agency</label>
          <input value={landlordName} onChange={e => setLandlordName(e.target.value)}
            placeholder="e.g. John Smith or London Estates Ltd" style={inputStyle} />
        </div>

        {/* Post button */}
        <button onClick={handlePost} disabled={!canPost} style={{
          width: "100%", padding: "15px",
          background: canPost ? "#c9a84c" : "rgba(201,168,76,0.3)",
          border: "none", borderRadius: 12, color: "#fff",
          fontSize: 15, fontWeight: 700, cursor: canPost ? "pointer" : "not-allowed",
          fontFamily: "'DM Sans', sans-serif", transition: "background 0.2s",
        }}>
          {posting ? "Posting…" : "Post Listing"}
        </button>
      </div>
    </div>
  );
}

// ─── Landlord AI Listing Flow ─────────────────────────────────────────────────
// Extracts evenly-spaced frames from a video file using HTML5 Canvas.
async function extractFramesFromVideo(file, count = 5, maxPx = 680, quality = 0.74) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const frames = [];
    let idx = 0;

    video.muted = true;
    video.preload = "metadata";
    video.onerror = () => reject(new Error("Could not read video file"));

    video.onloadedmetadata = () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 30;
      const times = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * dur);

      const capture = () => {
        if (idx >= times.length) { URL.revokeObjectURL(video.src); resolve(frames); return; }
        video.currentTime = times[idx];
      };

      video.onseeked = () => {
        const ratio = Math.min(maxPx / video.videoWidth, maxPx / video.videoHeight, 1);
        canvas.width = Math.round(video.videoWidth * ratio);
        canvas.height = Math.round(video.videoHeight * ratio);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", quality));
        idx++;
        capture();
      };

      capture();
    };

    video.src = URL.createObjectURL(file);
    video.load();
  });
}

// ─── Demo Property Presets ────────────────────────────────────────────────────
const DEMO_PROPERTIES = [
  {
    id: "demo-1",
    label: "Contemporary 2-Bed Flat",
    emoji: "🏙️",
    desc: "Open-plan · balcony · city views",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
      "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800",
    ],
    analysis: {
      propertyType: "Apartment", style: "Contemporary",
      estimatedBedrooms: 2, estimatedBathrooms: 1,
      detectedAmenities: ["open-plan kitchen", "hardwood floors", "floor-to-ceiling windows", "private balcony", "integrated appliances"],
      condition: "Excellent",
      suggestedTitle: "Sleek 2-Bed Flat with Open-Plan Living",
      suggestedDescription: "A beautifully finished contemporary flat featuring an open-plan kitchen and living area flooded with natural light. High-end integrated appliances, hardwood flooring throughout, and a private balcony perfect for entertaining.",
      highlights: ["Floor-to-ceiling windows with city views", "High-spec integrated kitchen", "Private balcony", "Hardwood floors throughout"],
    },
  },
  {
    id: "demo-2",
    label: "Victorian Terrace House",
    emoji: "🏡",
    desc: "Period features · garden · 3 beds",
    images: [
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    ],
    analysis: {
      propertyType: "House", style: "Victorian",
      estimatedBedrooms: 3, estimatedBathrooms: 2,
      detectedAmenities: ["original fireplace", "sash windows", "south-facing garden", "bay windows", "original cornicing", "cellar storage"],
      condition: "Good",
      suggestedTitle: "Charming 3-Bed Victorian Terrace with Garden",
      suggestedDescription: "A handsome Victorian terrace retaining many original period features including sash windows, bay front and ornate cornicing. The south-facing rear garden is ideal for outdoor living.",
      highlights: ["Original Victorian fireplaces in reception rooms", "South-facing garden with mature planting", "Stunning bay-fronted facade", "High ceilings with original cornicing"],
    },
  },
  {
    id: "demo-3",
    label: "Compact Studio",
    emoji: "🏢",
    desc: "Minimalist · smart layout · city centre",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800",
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800",
    ],
    analysis: {
      propertyType: "Studio", style: "Minimalist",
      estimatedBedrooms: 0, estimatedBathrooms: 1,
      detectedAmenities: ["built-in storage", "kitchenette", "excellent natural light", "walk-in wardrobe", "en-suite shower room"],
      condition: "Excellent",
      suggestedTitle: "Smart Studio in the Heart of the City",
      suggestedDescription: "A cleverly designed studio maximising every square inch with bespoke built-in storage and a smart kitchenette. Flooded with natural light and finished to a high standard throughout.",
      highlights: ["Bespoke built-in cabinetry throughout", "Excellent natural light from large windows", "Walk-in wardrobe with full-height storage", "High-spec en-suite shower room"],
    },
  },
  {
    id: "demo-4",
    label: "Luxury Penthouse",
    emoji: "✨",
    desc: "Roof terrace · concierge · panoramic views",
    images: [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800",
      "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800",
    ],
    analysis: {
      propertyType: "Penthouse", style: "Modern",
      estimatedBedrooms: 3, estimatedBathrooms: 3,
      detectedAmenities: ["wraparound roof terrace", "panoramic city views", "24-hour concierge", "underground parking", "home cinema", "smart home system", "wine room"],
      condition: "Excellent",
      suggestedTitle: "Stunning Penthouse with Panoramic Roof Terrace",
      suggestedDescription: "An exceptional penthouse occupying the entire top floor with breathtaking panoramic views across the city skyline. Features a spectacular wraparound roof terrace, private cinema room and 24-hour concierge service.",
      highlights: ["Wraparound roof terrace with 360° city views", "Private cinema room", "Three en-suite bedrooms", "24/7 concierge and underground parking"],
    },
  },
];

function LandlordFlow({ onClose, onPost, user, profile, initialListing }) {
  const isEditing = !!initialListing;
  const [step, setStep] = useState(isEditing ? "preview" : "upload"); // upload | analyzing | chat | preview
  const [dragOver, setDragOver] = useState(false);
  const [videoName, setVideoName] = useState(isEditing ? (initialListing.title || "") : "");
  const [frames, setFrames] = useState(isEditing ? (initialListing.images || (initialListing.image ? [initialListing.image] : [])) : []);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [generatedListing, setGeneratedListing] = useState(isEditing ? initialListing : null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  // When editing, seed the viewing requests for this listing so the landlord can pick a tenant
  const editingViewings = useMemo(
    () => isEditing ? seedLandlordViewings([initialListing]) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, chatLoading]);

  // ── Step 1 → 2: extract frames + run vision analysis ──────────────────────
  const processVideo = async (file) => {
    setStep("analyzing");
    setProgressLabel("Extracting frames from your walkthrough…");
    setProgressPct(10);

    let extracted;
    try {
      extracted = await extractFramesFromVideo(file, 5, 680, 0.74);
      setFrames(extracted);
      setProgressPct(38);
    } catch (e) {
      setAnalysisError("Could not extract frames from this video. Please try MP4, MOV, or WebM.");
      return;
    }

    setProgressLabel("Analysing rooms and detecting amenities…");
    setProgressPct(58);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: [
              ...extracted.slice(0, 4).map(f => ({
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: f.replace(/^data:image\/jpeg;base64,/, "") },
              })),
              {
                type: "text",
                text: `You are an expert property listing agent analysing frames from a landlord's walkthrough video. Return ONLY valid JSON, no markdown:\n{\n  "propertyType": "Apartment|House|Studio|Duplex|Townhouse|Villa|Penthouse",\n  "style": "Modern|Contemporary|Traditional|Industrial|Minimalist|Eclectic|Victorian",\n  "estimatedBedrooms": <integer>,\n  "estimatedBathrooms": <integer>,\n  "detectedAmenities": ["only amenities you can genuinely see"],\n  "condition": "Excellent|Good|Fair|Needs work",\n  "suggestedTitle": "<compelling title max 65 chars, no city>",\n  "suggestedDescription": "<2-3 sentences showcasing the property character and key selling points>",\n  "highlights": ["3-4 specific impressive details you observed"]\n}\nBe accurate — only list what you can genuinely confirm from the frames.`,
              },
            ],
          }],
        }),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Analysis failed"); }
      const data = await res.json();
      const text = data.content[0]?.text || "{}";
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

      setAnalysis(parsed);
      setProgressLabel("Building your listing assistant…");
      setProgressPct(92);
      await new Promise(r => setTimeout(r, 500));
      setProgressPct(100);

      // Prime the chat with what was detected
      const amenities = (parsed.detectedAmenities || []).slice(0, 5).join(", ");
      const opener = `I've finished analysing your property! Here's what I can see:\n\n**${parsed.condition || "Good"} ${parsed.style || "Modern"} ${parsed.propertyType || "apartment"}** · ~${parsed.estimatedBedrooms ?? "?"} bed · ~${parsed.estimatedBathrooms ?? "?"} bath${amenities ? `\n✦ Spotted: ${amenities}` : ""}\n\nI just need a few quick details to complete your listing. Let's start — **where is the property located?** Give me the city and neighbourhood (e.g. "London, Notting Hill").`;
      setChatMsgs([{ role: "assistant", content: opener }]);
      setStep("chat");

    } catch (e) {
      setAnalysisError(e.message || "Something went wrong during analysis.");
    }
  };

  // ── Demo mode: skip video extraction, use pre-baked analysis ────────────────
  const processDemo = async (preset) => {
    setVideoName(preset.label);
    setStep("analyzing");
    setFrames(preset.images);
    setProgressLabel("Loading property images…");
    setProgressPct(18);
    await new Promise(r => setTimeout(r, 700));
    setProgressLabel("Detecting rooms and amenities…");
    setProgressPct(46);
    await new Promise(r => setTimeout(r, 900));
    setProgressLabel("Analysing property condition and style…");
    setProgressPct(74);
    await new Promise(r => setTimeout(r, 700));
    setAnalysis(preset.analysis);
    setProgressLabel("Building your listing assistant…");
    setProgressPct(94);
    await new Promise(r => setTimeout(r, 500));
    setProgressPct(100);

    const a = preset.analysis;
    const amenities = (a.detectedAmenities || []).slice(0, 5).join(", ");
    const opener = `I've finished analysing your property! Here's what I can see:\n\n**${a.condition} ${a.style} ${a.propertyType}** · ~${a.estimatedBedrooms ?? "?"} bed · ~${a.estimatedBathrooms ?? "?"} bath${amenities ? `\n✦ Spotted: ${amenities}` : ""}\n\nI just need a few quick details to complete your listing. Let's start — **where is the property located?** Give me the city and neighbourhood (e.g. "London, Notting Hill").`;
    setChatMsgs([{ role: "assistant", content: opener }]);
    setStep("chat");
  };

  // ── Step 3: conversational Q&A ────────────────────────────────────────────
  const sendChatMsg = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim();
    setChatInput("");
    const newMsgs = [...chatMsgs, { role: "user", content: text }];
    setChatMsgs(newMsgs);
    setChatLoading(true);

    const systemPrompt = `You are a warm, concise property listing assistant on Estato helping a landlord post their property. From the video you already know:
- Type: ${analysis?.propertyType || "unknown"} · Style: ${analysis?.style || "unknown"} · Condition: ${analysis?.condition || "good"}
- Bedrooms: ~${analysis?.estimatedBedrooms ?? "?"} · Bathrooms: ~${analysis?.estimatedBathrooms ?? "?"}
- Detected amenities: ${(analysis?.detectedAmenities || []).join(", ") || "none confirmed"}
- Highlights: ${(analysis?.highlights || []).join("; ") || "none"}
- Suggested description: ${analysis?.suggestedDescription || ""}

Ask ONE short question at a time. You still need (if not provided): city/area, for rent or for sale, price, square metres (optional).
When you have location + price + rent/sale intent, you have everything needed. Generate the listing inside <LISTING>...</LISTING> tags:
<LISTING>
{
  "title": "...",
  "city": "...",
  "area": "...",
  "isForRent": true|false,
  "price": <number>,
  "bedrooms": ${analysis?.estimatedBedrooms ?? null},
  "bathrooms": ${analysis?.estimatedBathrooms ?? null},
  "sqft": <number or null>,
  "type": "${analysis?.propertyType || "Apartment"}",
  "style": "${analysis?.style || "Modern"}",
  "condition": "${analysis?.condition || "Good"}",
  "description": "<3-4 sentence description. Include neighbourhood context — mention the area character, nearby transport or amenities based on the city provided. Make it compelling and specific.>",
  "features": [<all confirmed amenities + anything from conversation>],
  "highlights": ${JSON.stringify(analysis?.highlights || [])},
  "agent": "<landlord name if mentioned, otherwise 'Private Landlord'>"
}
</LISTING>
Keep responses to 2-3 lines max. Be friendly and professional.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 900,
          system: systemPrompt,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Error"); }
      const data = await res.json();
      const reply = data.content[0]?.text || "";

      // Check if the listing JSON was generated
      const listingMatch = reply.match(/<LISTING>([\s\S]*?)<\/LISTING>/);
      if (listingMatch) {
        let parsed;
        try { parsed = JSON.parse(listingMatch[1].trim()); } catch { parsed = null; }

        if (parsed) {
          const cleanReply = reply.replace(/<LISTING>[\s\S]*?<\/LISTING>/, "").trim();
          setChatMsgs(prev => [...prev, { role: "assistant", content: cleanReply || "✨ Your listing is ready! Take a look at the preview." }]);
          setChatLoading(false);

          const finalListing = {
            ...parsed,
            id: `user-${Date.now()}`,
            image: frames[0] || null,
            images: frames,
            currency: "£",
            petFriendly: (parsed.features || []).some(f => /pet|dog|cat/i.test(f)),
            parking: (parsed.features || []).some(f => /parking|garage/i.test(f)),
            outdoor: (parsed.features || []).some(f => /garden|balcon|terrace|patio/i.test(f)),
            _userAdded: true,
          };

          await new Promise(r => setTimeout(r, 800));
          setGeneratedListing(finalListing);
          setStep("preview");
          return;
        }
      }

      setChatMsgs(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setChatMsgs(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    }
    setChatLoading(false);
  };

  // ── Step 4: post ──────────────────────────────────────────────────────────
  const handlePost = () => {
    if (!generatedListing || posting) return;
    setPosting(true);
    onPost({ ...generatedListing, image: frames[selectedFrame] || frames[0] || generatedListing.image });
    onClose();
  };

  const steps = ["Upload", "Analyse", "Details", "Preview"];
  const stepIdx = { upload: 0, analyzing: 1, chat: 2, preview: 3 }[step] ?? 0;
  const inputS = {
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, color: "#fff", fontSize: 14, padding: "11px 14px",
    fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
  };
  const labelS = { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0d0c0a", zIndex: 2000, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>

      {/* ── Top bar ── */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isEditing ? "Edit Listing" : "List Your Property"}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>{isEditing ? "Update your listing details" : "AI-powered · minimal effort"}</div>
        </div>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: i < stepIdx ? "#c9a84c" : i === stepIdx ? "rgba(201,168,76,0.18)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${i <= stepIdx ? "#c9a84c" : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: i < stepIdx ? "#fff" : i === stepIdx ? "#c9a84c" : "rgba(255,255,255,0.25)",
              }}>{i < stepIdx ? "✓" : i + 1}</div>
              <span style={{ fontSize: 11, fontWeight: i === stepIdx ? 600 : 400, color: i === stepIdx ? "#c9a84c" : "rgba(255,255,255,0.28)" }}>{s}</span>
              {i < steps.length - 1 && <div style={{ width: 18, height: 1, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 22, lineHeight: 1 }}>✕</button>
      </div>

      {/* ════ STEP: UPLOAD ════ */}
      {step === "upload" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 28 }}>
          <div style={{ textAlign: "center", maxWidth: 500 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎥</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 10px" }}>Record your walkthrough</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.48)", lineHeight: 1.7, margin: 0 }}>
              Walk through your property with your phone and upload the video. The AI will extract photos, detect rooms and amenities, then ask you just a few quick questions to generate the full listing automatically.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("video/")) { setVideoName(f.name); processVideo(f); } }}
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", maxWidth: 460, height: 190, borderRadius: 18,
              border: `2px dashed ${dragOver ? "#c9a84c" : "rgba(255,255,255,0.18)"}`,
              background: dragOver ? "rgba(201,168,76,0.07)" : "rgba(255,255,255,0.03)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s", gap: 10,
            }}>
            <div style={{ fontSize: 34 }}>📁</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: dragOver ? "#c9a84c" : "rgba(255,255,255,0.65)" }}>
              {videoName || "Drop video here or click to browse"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>MP4 · MOV · WebM</div>
          </div>
          <input ref={fileRef} type="file" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setVideoName(f.name); processVideo(f); } }} style={{ display: "none" }} />

          {/* Sample properties */}
          <div style={{ width: "100%", maxWidth: 460 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, textAlign: "center" }}>— or try with a sample property —</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {DEMO_PROPERTIES.map(preset => (
                <button key={preset.id} onClick={() => processDemo(preset)} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 12, padding: "14px 14px",
                  color: "#fff", cursor: "pointer", textAlign: "left",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,76,0.08)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{preset.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{preset.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div style={{ display: "flex", gap: 12, maxWidth: 460, width: "100%" }}>
            {[["💡", "Walk slowly through each room"], ["🔆", "Good lighting helps accuracy"], ["📱", "30–90 sec walkthrough is ideal"]].map(([icon, tip]) => (
              <div key={tip} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 10px", fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.55 }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{icon}</div>{tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ STEP: ANALYZING ════ */}
      {step === "analyzing" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 24 }}>
          {analysisError ? (
            <div style={{ textAlign: "center", maxWidth: 380 }}>
              <div style={{ fontSize: 42, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Analysis failed</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 22, lineHeight: 1.6 }}>{analysisError}</div>
              <button onClick={() => { setStep("upload"); setAnalysisError(null); setFrames([]); setProgressPct(0); }} style={{ padding: "10px 24px", borderRadius: 10, background: "#c9a84c", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Try again</button>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Analysing your property…</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>{progressLabel}</div>
              </div>
              <div style={{ width: "100%", maxWidth: 380, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #8b6520, #c9a84c)", borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              {frames.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 480 }}>
                  {frames.map((f, i) => (
                    <img key={i} src={f} alt="" style={{ width: 88, height: 58, objectFit: "cover", borderRadius: 8, opacity: 0.75, animation: "fadeIn 0.35s ease" }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════ STEP: CHAT ════ */}
      {step === "chat" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Frame strip */}
          <div style={{ width: 120, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "14px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, textAlign: "center" }}>Photos</div>
            {frames.map((f, i) => (
              <div key={i} onClick={() => setSelectedFrame(i)} style={{ borderRadius: 7, overflow: "hidden", cursor: "pointer", border: `2px solid ${selectedFrame === i ? "#c9a84c" : "transparent"}`, flexShrink: 0 }}>
                <img src={f} alt="" style={{ width: "100%", height: 64, objectFit: "cover", display: "block" }} />
              </div>
            ))}
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 4, lineHeight: 1.4 }}>Click to set cover photo</div>
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #c9a84c, #8b6520)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🧑‍💼</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Alex — Listing Assistant</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>Estato AI · Building your listing</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              {chatMsgs.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "78%", padding: "11px 15px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "rgba(255,255,255,0.07)",
                    border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.1)",
                    fontSize: 14, lineHeight: 1.6, color: "#fff", whiteSpace: "pre-wrap",
                  }}>
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(d => <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a84c", animation: `typingBounce 1.2s ${d * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "12px 22px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 10, flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } }}
                placeholder="Type your answer…"
                style={{ ...inputS, flex: 1 }}
              />
              <button onClick={sendChatMsg} disabled={!chatInput.trim() || chatLoading} style={{
                padding: "11px 20px", borderRadius: 10, border: "none", flexShrink: 0,
                background: chatInput.trim() && !chatLoading ? "#c9a84c" : "rgba(201,168,76,0.28)",
                color: "#fff", fontWeight: 600, fontSize: 14, cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif",
              }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ STEP: PREVIEW ════ */}
      {step === "preview" && generatedListing && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: live Shorts-style preview */}
          <div style={{ flex: 1, background: "#000", position: "relative", overflow: "hidden" }}>
            <img
              src={frames[selectedFrame] || frames[0] || generatedListing.image || ""}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.82 }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.05) 55%)", pointerEvents: "none" }} />

            {/* Thumbnail strip */}
            <div style={{ position: "absolute", left: 14, bottom: 220, display: "flex", flexDirection: "column", gap: 6 }}>
              {frames.map((f, i) => (
                <div key={i} onClick={() => setSelectedFrame(i)} style={{ width: 52, height: 38, borderRadius: 6, overflow: "hidden", cursor: "pointer", border: `2px solid ${selectedFrame === i ? "#c9a84c" : "rgba(255,255,255,0.3)"}` }}>
                  <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>

            {/* Preview overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px 28px" }}>
              {generatedListing._userAdded && <span style={{ background: "#c9a84c", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>New listing</span>}
              <div style={{ fontSize: 21, fontWeight: 700, color: "#fff", marginTop: 8, marginBottom: 5 }}>{generatedListing.title}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#c9a84c", marginBottom: 4 }}>{formatPrice(generatedListing.price, "£", generatedListing.isForRent)}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>📍 {generatedListing.area}{generatedListing.area && generatedListing.city ? ", " : ""}{generatedListing.city}</div>
            </div>
          </div>

          {/* Right: editable fields */}
          <div style={{ width: 360, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Review your listing</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>Edit any field before posting</div>
            </div>

            <div><label style={labelS}>Title</label><input value={generatedListing.title || ""} onChange={e => setGeneratedListing(l => ({ ...l, title: e.target.value }))} style={inputS} /></div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={labelS}>City</label><input value={generatedListing.city || ""} onChange={e => setGeneratedListing(l => ({ ...l, city: e.target.value }))} style={inputS} /></div>
              <div><label style={labelS}>Area</label><input value={generatedListing.area || ""} onChange={e => setGeneratedListing(l => ({ ...l, area: e.target.value }))} style={inputS} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelS}>Listing type</label>
                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)" }}>
                  {[["Rent", true], ["Sale", false]].map(([lbl, val]) => (
                    <button key={lbl} onClick={() => setGeneratedListing(l => ({ ...l, isForRent: val }))} style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", background: generatedListing.isForRent === val ? "#c9a84c" : "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontWeight: generatedListing.isForRent === val ? 700 : 400, fontFamily: "'DM Sans', sans-serif" }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div><label style={labelS}>Price (£)</label><input value={generatedListing.price || ""} onChange={e => setGeneratedListing(l => ({ ...l, price: parseFloat(e.target.value) || 0 }))} style={inputS} type="number" /></div>
            </div>

            <div><label style={labelS}>Description</label><textarea value={generatedListing.description || ""} onChange={e => setGeneratedListing(l => ({ ...l, description: e.target.value }))} rows={4} style={{ ...inputS, resize: "vertical" }} /></div>

            {generatedListing.features?.length > 0 && (
              <div>
                <label style={labelS}>AI-detected features</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {generatedListing.features.map((feat, i) => (
                    <span key={i} style={{ padding: "4px 11px", borderRadius: 16, background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.32)", fontSize: 12, color: "#c9a84c", fontWeight: 500 }}>{feat}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tenancy section — rental listings only, shown when editing ── */}
            {isEditing && generatedListing?.isForRent && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
                <label style={labelS}>Tenancy status</label>
                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)", marginBottom: 14 }}>
                  {[["Available", false], ["Rented out", true]].map(([lbl, val]) => {
                    const active = !!(generatedListing.isRentedOut) === val;
                    return (
                      <button key={lbl} onClick={() => setGeneratedListing(l => ({ ...l, isRentedOut: val, activeTenant: val ? l.activeTenant : null }))}
                        style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 700 : 400, color: "#fff", background: active ? (val ? "rgba(74,154,58,0.85)" : "#c9a84c") : "rgba(255,255,255,0.05)" }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>

                {generatedListing.isRentedOut && (
                  <div>
                    <label style={{ ...labelS, marginBottom: 8 }}>Select tenant</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                      {editingViewings.length === 0 && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "14px 0" }}>No viewing requests for this property yet</div>
                      )}
                      {editingViewings.map(v => {
                        const isSelected = generatedListing.activeTenant?.name === v.prospectName;
                        return (
                          <div key={v.id} onClick={() => setGeneratedListing(l => ({
                            ...l,
                            activeTenant: isSelected ? null : {
                              name: v.prospectName, avatar: v.prospectAvatar,
                              age: v.prospectAge, occupation: v.prospectOccupation,
                              area: v.prospectArea, budget: v.prospectBudget,
                              moveIn: v.prospectMoveIn, lifestyle: v.prospectLifestyle,
                              bio: v.prospectBio,
                            },
                          }))} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${isSelected ? "#4a9a3a" : "rgba(255,255,255,0.10)"}`,
                            background: isSelected ? "rgba(74,154,58,0.15)" : "rgba(255,255,255,0.04)",
                            transition: "all 0.15s",
                          }}>
                            <img src={v.prospectAvatar} alt={v.prospectName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.prospectName}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                                {v.prospectAge && `${v.prospectAge} · `}{v.prospectOccupation}
                              </div>
                            </div>
                            {isSelected && <span style={{ color: "#4a9a3a", fontSize: 16, flexShrink: 0 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={handlePost} disabled={posting} style={{
              width: "100%", padding: "14px", marginTop: 4,
              background: posting ? "rgba(201,168,76,0.35)" : "#c9a84c",
              border: "none", borderRadius: 12, color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: posting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {posting ? (isEditing ? "Saving…" : "Posting…") : (isEditing ? "Save changes →" : "Post listing →")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar / Email Utilities ───────────────────────────────────────────────
function fmtICSDate(dateStr, timeStr) {
  const d = dateStr.replace(/-/g, "");
  const t = (timeStr || "10:00").replace(":", "") + "00";
  return `${d}T${t}`;
}
function buildICS({ summary, startDate, startTime, durationHours = 1, location, description, organizerName, organizerEmail, cancelled = false }) {
  const start = fmtICSDate(startDate, startTime);
  const [h, m] = (startTime || "10:00").split(":").map(Number);
  const endH = String(Math.min(h + durationHours, 23)).padStart(2, "0");
  const end = fmtICSDate(startDate, `${endH}:${String(m).padStart(2, "0")}`);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Estato//Estato//EN",
    `METHOD:${cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : "",
    location ? `LOCATION:${location}` : "",
    organizerEmail ? `ORGANIZER;CN=${organizerName || "Landlord"}:MAILTO:${organizerEmail}` : "",
    `UID:estato-${Date.now()}@estato.app`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}
function triggerICSDownload(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function buildMailto({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Landlord Dashboard ───────────────────────────────────────────────────────
function LandlordDashboard({ userListings, onAddListing, onUpdateListing, onRemoveListing, user, profile }) {
  const T = useTheme();
  const [showFlow, setShowFlow] = useState(false);
  const [editingListing, setEditingListing] = useState(null);     // listing object being edited
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);   // id of listing pending delete confirm
  const [expandedId, setExpandedId] = useState(null);
  const [viewingStatuses, setViewingStatuses] = useState({});
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [focusedProspect, setFocusedProspect] = useState(null);
  const [focusedProperty, setFocusedProperty] = useState(null);
  // { [viewingId]: { date: "YYYY-MM-DD", time: "HH:MM" } } — landlord-proposed meeting times
  const [viewingTimes, setViewingTimes] = useState({});

  const allViewings = useMemo(() => seedLandlordViewings(userListings), [userListings]);

  const resolvedViewings = useMemo(
    () => allViewings.map(v => ({ ...v, status: viewingStatuses[v.id] ?? v.status })),
    [allViewings, viewingStatuses]
  );

  const viewingsForProperty = (propertyId) =>
    resolvedViewings.filter(v => v.propertyId === propertyId);

  const propertiesCount = userListings.length;
  const rentalListings = userListings.filter(l => l.isForRent);
  // Only listings with at least one confirmed viewer count as "closed" for revenue/tenancy purposes
  const closedRentals = rentalListings.filter(l =>
    l.isRentedOut || resolvedViewings.some(v => v.propertyId === l.id && v.status === "confirmed")
  );
  const monthlyRevenue = closedRentals.reduce((s, l) => s + (l.price || 0), 0);
  const revCurrency = closedRentals[0]?.currency || "£";
  const revenueFormatted = monthlyRevenue > 0 ? formatPrice(monthlyRevenue, revCurrency, true) : `${revCurrency}0/mo`;
  const scheduledCount = resolvedViewings.filter(v => v.status === "confirmed" || v.status === "pending").length;
  const activeTenancies = closedRentals.length;

  const setViewingStatus = (id, status) =>
    setViewingStatuses(prev => ({ ...prev, [id]: status }));

  const initials = (name) =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const kpis = [
    { icon: "🏠", label: "Properties Listed", value: propertiesCount },
    { icon: "£", label: "Monthly Revenue", value: revenueFormatted },
    { icon: "📅", label: "Scheduled Viewings", value: scheduledCount },
    { icon: "🔑", label: "Active Tenancies", value: activeTenancies },
  ];

  const statusStyles = {
    pending: { bg: "#fdf8ee", color: "#9a7a20", border: "#e8d898", label: "Pending" },
    confirmed: { bg: "#f0f8ee", color: "#3a7a2a", border: "#b8e0a8", label: "Confirmed" },
    declined: { bg: "#faf0f0", color: "#8a3a3a", border: "#e0b0b0", label: "Declined" },
  };

  return (
    <div style={{
      position: "fixed", left: T.sidebarW, right: 0, top: 0, bottom: 0,
      background: T.bg, overflowY: "auto",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        padding: "20px 32px", background: "#fff",
        borderBottom: "1px solid #ede8de",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1410" }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2 }}>Landlord overview</div>
        </div>
        <button onClick={() => setShowFlow(true)} style={{
          padding: "10px 20px", borderRadius: 8,
          background: "#c9a84c", border: "none",
          color: "#fff", fontWeight: 600, fontSize: 13.5,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
        }}>
          List new property →
        </button>
      </div>

      <div style={{ padding: "28px 32px" }}>
        {/* ── KPI Strip ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16, marginBottom: 32,
        }}>
          {kpis.map(({ icon, label, value }) => {
            const isActive = selectedKpi === label;
            return (
              <div key={label}
                onClick={() => setSelectedKpi(isActive ? null : label)}
                style={{
                  background: isActive ? "#fdf8ee" : "#fff", borderRadius: 12,
                  border: `1px solid ${isActive ? "#e0d0a8" : "#ede8de"}`,
                  padding: "18px 20px",
                  boxShadow: isActive ? "0 4px 16px rgba(201,168,76,0.18)" : "0 2px 8px rgba(0,0,0,0.06)",
                  position: "relative", cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                <span style={{
                  position: "absolute", top: 14, right: 16,
                  fontSize: icon === "£" ? 17 : 22,
                  color: icon === "£" ? "#c9a84c" : undefined,
                  opacity: 0.65,
                }}>{icon}</span>
                <div style={{ fontSize: 26, fontWeight: 700, color: isActive ? "#7a5520" : "#1a1410", lineHeight: 1.1, marginBottom: 6 }}>
                  {value}
                </div>
                <div style={{ fontSize: 12, color: isActive ? "#9a7a40" : "#9a8f80" }}>{label}</div>
                {isActive && (
                  <div style={{ position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid #e0d0a8" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── KPI Detail Panel ── */}
        {selectedKpi && (() => {
          const upcomingViewings = resolvedViewings.filter(v => v.status === "pending" || v.status === "confirmed");
          const propertyForViewing = (v) => userListings.find(l => l.id === v.propertyId);

          const panelStyle = {
            background: "#fff", borderRadius: 14,
            border: "1px solid #e0d0a8",
            marginBottom: 28, overflow: "hidden",
            boxShadow: "0 4px 20px rgba(201,168,76,0.12)",
          };
          const panelHead = {
            padding: "16px 20px", borderBottom: "1px solid #f0ebe0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fdf8ee",
          };
          const closeBtn = {
            background: "none", border: "none", cursor: "pointer",
            color: "#9a8f80", fontSize: 18, lineHeight: 1,
            fontFamily: "'DM Sans', sans-serif", padding: "2px 6px",
          };
          const rowStyle = {
            display: "flex", alignItems: "center", gap: 14,
            padding: "13px 20px", borderBottom: "1px solid #f5f2ec",
          };

          /* ── Scheduled Viewings detail ── */
          if (selectedKpi === "Scheduled Viewings") return (
            <div style={panelStyle}>
              <div style={panelHead}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1410" }}>Scheduled Viewings</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{upcomingViewings.length} upcoming across all properties</div>
                </div>
                <button style={closeBtn} onClick={() => setSelectedKpi(null)}>✕</button>
              </div>
              {upcomingViewings.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#9a8f80", fontSize: 13 }}>No upcoming viewings yet.</div>
              )}
              {upcomingViewings.map(v => {
                const prop = propertyForViewing(v);
                const ss = statusStyles[v.status] || statusStyles.pending;
                return (
                  <div key={v.id} style={rowStyle}>
                    {/* Prospect avatar — clickable */}
                    <div onClick={() => setFocusedProspect(v)} style={{ cursor: "pointer", flexShrink: 0 }}>
                      {v.prospectAvatar
                        ? <img src={v.prospectAvatar} alt={v.prospectName} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #f0ebe0" }} />
                        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f5edd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#7a5520" }}>{initials(v.prospectName)}</div>
                      }
                    </div>
                    {/* Prospect name — clickable */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={() => setFocusedProspect(v)} style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e0d0a8" }}>
                        {v.prospectName}
                      </span>
                      <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2 }}>
                        wants to view{" "}
                        {prop
                          ? <span onClick={() => setFocusedProperty(prop)} style={{ color: "#c9a84c", fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e0d0a8" }}>{prop.title}</span>
                          : <span style={{ color: "#9a8f80" }}>a property</span>
                        }
                      </div>
                      <div style={{ fontSize: 11, color: "#b8b0a0", marginTop: 1 }}>
                        {new Date(v.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, flexShrink: 0 }}>{ss.label}</span>
                    {v.status === "pending" && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setViewingStatus(v.id, "confirmed")} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #b8e0a8", background: "#f0f8ee", color: "#3a7a2a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Accept</button>
                        <button onClick={() => setViewingStatus(v.id, "declined")} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #e0b0b0", background: "#faf0f0", color: "#8a3a3a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Decline</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );

          /* ── Monthly Revenue detail ── */
          if (selectedKpi === "Monthly Revenue") return (
            <div style={panelStyle}>
              <div style={panelHead}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1410" }}>Monthly Revenue</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{closedRentals.length} closed rental{closedRentals.length !== 1 ? "s" : ""}</div>
                </div>
                <button style={closeBtn} onClick={() => setSelectedKpi(null)}>✕</button>
              </div>
              {closedRentals.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#9a8f80", fontSize: 13 }}>No confirmed rentals yet — accept a viewing request to close a tenancy.</div>
              )}
              {closedRentals.map(l => {
                const tenant = resolvedViewings.find(v => v.propertyId === l.id && v.status === "confirmed");
                return (
                  <div key={l.id} style={rowStyle}>
                    {l.image && (
                      <img src={l.image} alt={l.title} onClick={() => setFocusedProperty(l)} style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #f0ebe0", cursor: "pointer" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={() => setFocusedProperty(l)} style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e0d0a8" }}>{l.title}</span>
                      <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{l.city}{l.area && l.area !== l.city ? `, ${l.area}` : ""}</div>
                      {tenant && (
                        <div onClick={() => setFocusedProspect(tenant)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, cursor: "pointer" }}>
                          {tenant.prospectAvatar
                            ? <img src={tenant.prospectAvatar} alt={tenant.prospectName} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f5edd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7a5520" }}>{initials(tenant.prospectName)}</div>
                          }
                          <span style={{ fontSize: 11, color: "#9a8f80" }}>Tenant: <span style={{ color: "#c9a84c", fontWeight: 600 }}>{tenant.prospectName}</span></span>
                        </div>
                      )}
                      {!tenant && <div style={{ fontSize: 11, color: "#b8b0a0", marginTop: 4 }}>No confirmed tenant yet</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#3a7a2a" }}>{formatPrice(l.price, l.currency, true)}</div>
                      <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 1 }}>per month</div>
                    </div>
                  </div>
                );
              })}
              {closedRentals.length > 0 && (
                <div style={{ padding: "14px 20px", background: "#fdf8ee", borderTop: "1px solid #f0ebe0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#9a7a20" }}>Total monthly income</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#3a7a2a" }}>{revenueFormatted}</span>
                </div>
              )}
            </div>
          );

          /* ── Properties Listed detail ── */
          if (selectedKpi === "Properties Listed") return (
            <div style={panelStyle}>
              <div style={panelHead}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1410" }}>All Properties</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{propertiesCount} listing{propertiesCount !== 1 ? "s" : ""}</div>
                </div>
                <button style={closeBtn} onClick={() => setSelectedKpi(null)}>✕</button>
              </div>
              {userListings.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#9a8f80", fontSize: 13 }}>No listings yet.</div>
              )}
              {userListings.map(l => {
                const vCount = resolvedViewings.filter(v => v.propertyId === l.id && (v.status === "pending" || v.status === "confirmed")).length;
                return (
                  <div key={l.id} style={rowStyle}>
                    {l.image && (
                      <img src={l.image} alt={l.title} onClick={() => setFocusedProperty(l)} style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #f0ebe0", cursor: "pointer" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={() => setFocusedProperty(l)} style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e0d0a8" }}>{l.title}</span>
                      <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{l.city}{l.area && l.area !== l.city ? `, ${l.area}` : ""}</div>
                      <div style={{ fontSize: 11, color: "#9a7a20", marginTop: 3 }}>
                        {vCount > 0 ? `📅 ${vCount} viewing${vCount > 1 ? "s" : ""} scheduled` : "No viewings yet"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: l.isForRent ? "#f0f8ee" : "#f0f0f8", color: l.isForRent ? "#3a7a2a" : "#4a4a8a", border: `1px solid ${l.isForRent ? "#b8e0a8" : "#c0c0e8"}` }}>
                        {l.isForRent ? "For Rent" : "For Sale"}
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#c9a84c", marginTop: 5 }}>{formatPrice(l.price, l.currency, l.isForRent)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );

          /* ── Active Tenancies detail ── */
          if (selectedKpi === "Active Tenancies") return (
            <div style={panelStyle}>
              <div style={panelHead}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1410" }}>Active Tenancies</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{activeTenancies} rental propert{activeTenancies !== 1 ? "ies" : "y"}</div>
                </div>
                <button style={closeBtn} onClick={() => setSelectedKpi(null)}>✕</button>
              </div>
              {rentalListings.length === 0 && (
                <div style={{ padding: "32px", textAlign: "center", color: "#9a8f80", fontSize: 13 }}>No rental properties listed.</div>
              )}
              {rentalListings.map(l => {
                const confirmed = resolvedViewings.filter(v => v.propertyId === l.id && v.status === "confirmed");
                const tenant = confirmed[0];
                return (
                  <div key={l.id} style={rowStyle}>
                    {l.image && (
                      <img src={l.image} alt={l.title} onClick={() => setFocusedProperty(l)} style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #f0ebe0", cursor: "pointer" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span onClick={() => setFocusedProperty(l)} style={{ fontSize: 13, fontWeight: 600, color: "#1a1410", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#e0d0a8" }}>{l.title}</span>
                      <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 1 }}>{l.city}{l.area && l.area !== l.city ? `, ${l.area}` : ""} · {l.bedrooms != null ? `${l.bedrooms} bed` : ""}</div>
                      {tenant ? (
                        <div onClick={() => setFocusedProspect(tenant)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
                          {tenant.prospectAvatar
                            ? <img src={tenant.prospectAvatar} alt={tenant.prospectName} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                            : <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#f5edd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7a5520" }}>{initials(tenant.prospectName)}</div>
                          }
                          <span style={{ fontSize: 12, color: "#3a7a2a", fontWeight: 600 }}>🔑 {tenant.prospectName}</span>
                          <span style={{ fontSize: 11, color: "#9a8f80" }}>— confirmed</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#b8b0a0", marginTop: 4 }}>Awaiting confirmed tenant</div>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#3a7a2a", flexShrink: 0 }}>{formatPrice(l.price, l.currency, true)}</div>
                  </div>
                );
              })}
            </div>
          );

          return null;
        })()}

        {/* ── My Properties heading ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1410" }}>My Properties</div>
          {propertiesCount > 0 && (
            <span style={{
              background: "#c9a84c", color: "#fff",
              borderRadius: 20, fontSize: 11, fontWeight: 700,
              padding: "2px 9px",
            }}>{propertiesCount}</span>
          )}
        </div>

        {/* ── Empty State ── */}
        {propertiesCount === 0 && (
          <div style={{
            background: "#fff", borderRadius: 16,
            border: "1px solid #ede8de",
            padding: "48px 32px", textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1410", marginBottom: 8 }}>
              No properties listed yet
            </div>
            <div style={{ fontSize: 13, color: "#9a8f80", marginBottom: 24, lineHeight: 1.6 }}>
              Use the AI wizard to upload a walkthrough video and post your first listing in minutes.
            </div>
            <button onClick={() => setShowFlow(true)} style={{
              padding: "12px 28px", borderRadius: 8,
              background: "#c9a84c", border: "none",
              color: "#fff", fontWeight: 600, fontSize: 14,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              List your first property →
            </button>
          </div>
        )}

        {/* ── Property Cards Grid ── */}
        {propertiesCount > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
            gap: 16,
          }}>
            {userListings.map(listing => {
              const propViewings = viewingsForProperty(listing.id);
              const isExpanded = expandedId === listing.id;
              const pendingCount = propViewings.filter(v => v.status === "pending" || v.status === "confirmed").length;

              return (
                <div key={listing.id} style={{
                  background: "#fff", borderRadius: 12,
                  border: "1px solid #ede8de", overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  {/* Card body */}
                  <div style={{ display: "flex", padding: 16, alignItems: "flex-start" }}>
                    {listing.image && (
                      <img src={listing.image} alt={listing.title} style={{
                        width: 80, height: 80, objectFit: "cover",
                        borderRadius: 8, flexShrink: 0, marginRight: 14,
                        border: "1px solid #f0ebe0",
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: "#1a1410",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", flex: 1,
                        }}>{listing.title}</div>
                        <span style={{
                          padding: "2px 9px", borderRadius: 20, flexShrink: 0,
                          fontSize: 11, fontWeight: 600,
                          background: listing.isRentedOut ? "#f5f0e8" : listing.isForRent ? "#f0f8ee" : "#f0f0f8",
                          color: listing.isRentedOut ? "#7a5520" : listing.isForRent ? "#3a7a2a" : "#4a4a8a",
                          border: `1px solid ${listing.isRentedOut ? "#e8d898" : listing.isForRent ? "#b8e0a8" : "#c0c0e8"}`,
                        }}>
                          {listing.isRentedOut ? "🔑 Rented out" : listing.isForRent ? "For Rent" : "For Sale"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 3 }}>
                        {listing.city}{listing.area && listing.area !== listing.city ? `, ${listing.area}` : ""}
                      </div>
                      {listing.activeTenant && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                          <img src={listing.activeTenant.avatar} alt={listing.activeTenant.name} style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "#5a5040", fontWeight: 500 }}>{listing.activeTenant.name}</span>
                          {listing.activeTenant.occupation && <span style={{ fontSize: 11, color: "#9a8f80" }}>· {listing.activeTenant.occupation}</span>}
                        </div>
                      )}
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#c9a84c", marginTop: 4 }}>
                        {formatPrice(listing.price, listing.currency, listing.isForRent)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom strip */}
                  <div style={{
                    borderTop: "1px solid #f0ebe0", padding: "10px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#faf8f4", gap: 8,
                  }}>
                    <span style={{ fontSize: 12, color: pendingCount > 0 ? "#9a7a20" : "#9a8f80", fontWeight: 500, flex: 1 }}>
                      {pendingCount > 0 ? `📅 ${pendingCount} viewing${pendingCount > 1 ? "s" : ""} scheduled` : "No upcoming viewings"}
                    </span>
                    <button
                      onClick={() => setEditingListing(listing)}
                      style={{
                        background: "none", border: "1px solid #ede8de", cursor: "pointer",
                        fontSize: 12, color: "#7a7060",
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 6,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(listing.id)}
                      style={{
                        background: "none", border: "1px solid #f0d0d0", cursor: "pointer",
                        fontSize: 12, color: "#c05050",
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 6,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      🗑 Delete
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 13, color: "#9a8f80",
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 8px", borderRadius: 6,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Viewing requests
                      <span style={{
                        display: "inline-block",
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}>▾</span>
                    </button>
                  </div>

                  {/* Inline viewing requests */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #ede8de", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {propViewings.length === 0 && (
                        <div style={{ fontSize: 12, color: "#9a8f80", textAlign: "center", padding: "12px 0" }}>
                          No viewing requests yet.
                        </div>
                      )}
                      {propViewings.map(v => {
                        const ss = statusStyles[v.status] || statusStyles.pending;
                        const proposed = viewingTimes[v.id];
                        return (
                          <div key={v.id} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 12px", borderRadius: 10,
                            background: "#faf8f4", border: "1px solid #f0ebe0",
                          }}>
                            {/* Avatar — clickable → opens prospect modal */}
                            <div onClick={() => setFocusedProspect(v)} style={{ cursor: "pointer", flexShrink: 0 }}>
                              {v.prospectAvatar ? (
                                <img src={v.prospectAvatar} alt={v.prospectName} style={{
                                  width: 38, height: 38, borderRadius: "50%",
                                  objectFit: "cover", border: "1.5px solid #f0ebe0",
                                }} />
                              ) : (
                                <div style={{
                                  width: 38, height: 38, borderRadius: "50%",
                                  background: "#f5edd8", display: "flex", alignItems: "center",
                                  justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#7a5520",
                                }}>{initials(v.prospectName)}</div>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Name — clickable → opens prospect modal */}
                              <div onClick={() => setFocusedProspect(v)} style={{
                                fontSize: 13, fontWeight: 600, color: "#1a1410",
                                cursor: "pointer", textDecoration: "underline",
                                textDecorationColor: "#e0d0a8",
                              }}>{v.prospectName}</div>
                              {/* Proposed time if set, otherwise original requested date */}
                              {proposed ? (
                                <div style={{ fontSize: 11, marginTop: 2 }}>
                                  <span style={{ color: "#c9a84c", fontWeight: 600 }}>📅 Proposed: </span>
                                  <span style={{ color: "#7a5520" }}>
                                    {new Date(`${proposed.date}T${proposed.time}`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 1 }}>
                                  Requested {new Date(v.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                </div>
                              )}
                            </div>
                            <span style={{
                              padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                              background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                              flexShrink: 0,
                            }}>{ss.label}</span>
                            {v.status === "pending" && (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button onClick={() => setViewingStatus(v.id, "confirmed")} style={{
                                  padding: "5px 12px", borderRadius: 7,
                                  border: "1px solid #b8e0a8", background: "#f0f8ee",
                                  color: "#3a7a2a", fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                                }}>Accept</button>
                                <button onClick={() => setViewingStatus(v.id, "declined")} style={{
                                  padding: "5px 12px", borderRadius: 7,
                                  border: "1px solid #e0b0b0", background: "#faf0f0",
                                  color: "#8a3a3a", fontSize: 12, fontWeight: 600,
                                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                                }}>Decline</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      {confirmDeleteId && (() => {
        const listing = userListings.find(l => l.id === confirmDeleteId);
        return (
          <div onClick={() => setConfirmDeleteId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "28px 28px 24px", maxWidth: 380, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1410", marginBottom: 6 }}>Delete listing?</div>
              <div style={{ fontSize: 13, color: "#7a7060", lineHeight: 1.6, marginBottom: 22 }}>
                <span style={{ fontWeight: 600, color: "#1a1410" }}>{listing?.title}</span> will be permanently removed from your portfolio and cannot be recovered.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDeleteId(null)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #ede8de",
                  background: "transparent", color: "#7a7060", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                }}>Cancel</button>
                <button onClick={() => { onRemoveListing(confirmDeleteId); setConfirmDeleteId(null); if (expandedId === confirmDeleteId) setExpandedId(null); }} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  background: "#c05050", color: "#fff", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                }}>Delete listing</button>
              </div>
            </div>
          </div>
        );
      })()}

      {(showFlow || editingListing) && (
        <LandlordFlow
          initialListing={editingListing || undefined}
          onClose={() => { setShowFlow(false); setEditingListing(null); }}
          onPost={(listing) => {
            if (editingListing) {
              if (onUpdateListing) onUpdateListing(listing);
              setEditingListing(null);
            } else {
              onAddListing(listing);
              setShowFlow(false);
            }
          }}
          user={user}
          profile={profile}
        />
      )}

      {/* ── Prospect profile mini-modal ── */}
      {focusedProspect && (() => {
        const v = focusedProspect;
        const prop = userListings.find(l => l.id === v.propertyId);
        const proposed = viewingTimes[v.id];
        const ss = statusStyles[v.status] || statusStyles.pending;
        const landlordName = profile?.full_name || user?.email?.split("@")[0] || "Landlord";
        const landlordEmail = user?.email || "";

        // Today's date as min for the date picker
        const todayISO = new Date().toISOString().split("T")[0];

        const handleAddToCalendar = (cancelled = false) => {
          if (!proposed) return;
          const summary = cancelled
            ? `CANCELLED: Property Viewing — ${prop?.title || "Property"}`
            : `Property Viewing — ${prop?.title || "Property"}`;
          const desc = cancelled
            ? `The viewing with ${v.prospectName} for ${prop?.title || "your property"} in ${prop?.city || ""} has been cancelled.`
            : `Viewing with ${v.prospectName} for ${prop?.title || "your property"} in ${prop?.city || ""}.\n\nRequested: "${v.message}"`;
          const ics = buildICS({
            summary, startDate: proposed.date, startTime: proposed.time,
            location: prop ? `${prop.city}${prop.area && prop.area !== prop.city ? ", " + prop.area : ""}` : "",
            description: desc, organizerName: landlordName, organizerEmail: landlordEmail,
            cancelled,
          });
          triggerICSDownload(ics, `estato-viewing-${cancelled ? "cancel-" : ""}${v.id}.ics`);
        };

        const handleEmailSelf = (cancelled = false) => {
          if (!landlordEmail) return;
          const dateLabel = proposed
            ? new Date(`${proposed.date}T${proposed.time}`).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
            : "Time TBC";
          const subject = cancelled
            ? `Viewing Cancelled — ${prop?.title || "Property"} with ${v.prospectName}`
            : `Viewing Confirmed — ${prop?.title || "Property"} with ${v.prospectName}`;
          const body = cancelled
            ? `Hi,\n\nThe viewing for ${prop?.title || "your property"} in ${prop?.city || ""} with ${v.prospectName} has been cancelled.\n\nEstato`
            : `Hi,\n\nYour viewing has been confirmed.\n\nProperty: ${prop?.title || "your property"}\nLocation: ${prop?.city || ""}${prop?.area && prop.area !== prop?.city ? ", " + prop.area : ""}\nWith: ${v.prospectName}\nWhen: ${dateLabel}\n\nAn .ics calendar file has been downloaded — open it to add to your calendar.\n\nEstato`;
          window.open(buildMailto({ to: landlordEmail, subject, body }));
        };

        const handleAcceptAndSchedule = () => {
          setViewingStatus(v.id, "confirmed");
          handleAddToCalendar(false);
          handleEmailSelf(false);
          setFocusedProspect({ ...v, status: "confirmed" });
        };

        const handleDecline = () => {
          setViewingStatus(v.id, "declined");
          if (proposed) {
            handleAddToCalendar(true);
            handleEmailSelf(true);
          }
          setFocusedProspect(null);
        };

        const inputStyle = {
          flex: 1, padding: "9px 12px", borderRadius: 8,
          border: "1px solid #e0d8cc", background: "#faf8f4",
          fontSize: 13, color: "#1a1410", fontFamily: "'DM Sans', sans-serif",
          outline: "none",
        };

        return (
          <div onClick={() => setFocusedProspect(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "24px 24px 20px", maxWidth: 380, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", fontFamily: "'DM Sans', sans-serif", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
              <button onClick={() => setFocusedProspect(null)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontSize: 20, lineHeight: 1 }}>✕</button>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                {v.prospectAvatar
                  ? <img src={v.prospectAvatar} alt={v.prospectName} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid #f0ebe0", flexShrink: 0 }} />
                  : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f5edd8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#7a5520", flexShrink: 0 }}>{initials(v.prospectName)}</div>
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1410" }}>{v.prospectName}</div>
                  {v.prospectAge && v.prospectOccupation && (
                    <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2 }}>
                      {v.prospectAge} · {v.prospectOccupation}
                    </div>
                  )}
                  {v.prospectArea && (
                    <div style={{ fontSize: 11, color: "#b8b0a0", marginTop: 1 }}>📍 {v.prospectArea}</div>
                  )}
                  <span style={{ display: "inline-block", marginTop: 5, padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{ss.label}</span>
                </div>
              </div>

              {/* Profile overview */}
              {(v.prospectBio || v.prospectBudget || v.prospectMoveIn || v.prospectLifestyle?.length > 0) && (
                <div style={{ background: "#faf8f4", borderRadius: 12, padding: "12px 14px", marginBottom: 12, border: "1px solid #f0ebe0" }}>
                  {v.prospectBio && (
                    <div style={{ fontSize: 13, color: "#3a3028", lineHeight: 1.6, marginBottom: 10 }}>{v.prospectBio}</div>
                  )}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: v.prospectLifestyle?.length ? 10 : 0 }}>
                    {v.prospectBudget && (
                      <div>
                        <div style={{ fontSize: 10, color: "#b8b0a0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Budget</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410" }}>£{v.prospectBudget.toLocaleString()}/mo</div>
                      </div>
                    )}
                    {v.prospectMoveIn && (
                      <div>
                        <div style={{ fontSize: 10, color: "#b8b0a0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Move-in</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1410" }}>{v.prospectMoveIn}</div>
                      </div>
                    )}
                  </div>
                  {v.prospectLifestyle?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {v.prospectLifestyle.map(tag => (
                        <span key={tag} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #e0d8cc", color: "#5a5040" }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Property row */}
              {prop && (
                <div onClick={() => { setFocusedProspect(null); setFocusedProperty(prop); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "#faf8f4", borderRadius: 10, marginBottom: 12, cursor: "pointer", border: "1px solid #f0ebe0" }}>
                  {prop.image && <img src={prop.image} alt={prop.title} style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1410", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prop.title}</div>
                    <div style={{ fontSize: 11, color: "#9a8f80" }}>{prop.city} · {formatPrice(prop.price, prop.currency, prop.isForRent)}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 14, color: "#c9a84c", flexShrink: 0 }}>›</span>
                </div>
              )}

              {/* Message */}
              <div style={{ background: "#faf8f4", borderRadius: 10, padding: "11px 13px", fontSize: 13, color: "#3a3028", lineHeight: 1.6, fontStyle: "italic", border: "1px solid #f0ebe0", marginBottom: 16 }}>
                "{v.message}"
              </div>

              <div style={{ borderTop: "1px solid #f0ebe0", paddingTop: 16 }}>

                {/* ── Pending: suggest / propose a time ── */}
                {v.status === "pending" && !proposed && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#9a8f80", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Suggest a time</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input type="date" min={todayISO}
                        defaultValue={v.date ? v.date.split("T")[0] : ""}
                        id={`date-${v.id}`}
                        style={inputStyle}
                      />
                      <input type="time" defaultValue="10:00" id={`time-${v.id}`} style={{ ...inputStyle, flex: "0 0 100px" }} />
                    </div>
                    <button onClick={() => {
                      const dateEl = document.getElementById(`date-${v.id}`);
                      const timeEl = document.getElementById(`time-${v.id}`);
                      if (!dateEl?.value) return;
                      setViewingTimes(prev => ({ ...prev, [v.id]: { date: dateEl.value, time: timeEl?.value || "10:00" } }));
                      setFocusedProspect({ ...v });
                    }} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid #e0d0a8", background: "#fdf8ee", color: "#7a5520", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
                      Propose this time →
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleAcceptAndSchedule} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #b8e0a8", background: "#f0f8ee", color: "#3a7a2a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Accept viewing</button>
                      <button onClick={handleDecline} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e0b0b0", background: "#faf0f0", color: "#8a3a3a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Decline</button>
                    </div>
                  </>
                )}

                {/* ── Pending with proposed time ── */}
                {v.status === "pending" && proposed && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "#9a8f80", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Proposed time</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1410", marginTop: 3 }}>
                          {new Date(`${proposed.date}T${proposed.time}`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <button onClick={() => setViewingTimes(prev => { const n = { ...prev }; delete n[v.id]; return n; })} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontSize: 12, textDecoration: "underline", fontFamily: "'DM Sans', sans-serif" }}>Change</button>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={handleAcceptAndSchedule} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #b8e0a8", background: "#f0f8ee", color: "#3a7a2a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>✓ Accept + Add to Calendar</button>
                      <button onClick={handleDecline} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e0b0b0", background: "#faf0f0", color: "#8a3a3a", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Decline</button>
                    </div>
                  </>
                )}

                {/* ── Confirmed: calendar + email actions ── */}
                {v.status === "confirmed" && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#3a7a2a" }}>Viewing confirmed</div>
                        {proposed && (
                          <div style={{ fontSize: 12, color: "#5a8060", marginTop: 1 }}>
                            {new Date(`${proposed.date}T${proposed.time}`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button onClick={() => handleAddToCalendar(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e0d0a8", background: "#fdf8ee", color: "#7a5520", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📅 Add to Calendar</button>
                      <button onClick={() => handleEmailSelf(false)} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e0d8cc", background: "#faf8f4", color: "#5a5040", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>✉ Email me details</button>
                    </div>
                    <button onClick={() => {
                      setViewingStatus(v.id, "declined");
                      if (proposed) { handleAddToCalendar(true); handleEmailSelf(true); }
                      setFocusedProspect(null);
                    }} style={{ width: "100%", padding: "9px", borderRadius: 9, border: "1px solid #e0b0b0", background: "none", color: "#8a3a3a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Cancel this viewing
                    </button>
                  </>
                )}

                {/* ── Declined: send cancellation notice ── */}
                {v.status === "declined" && (
                  <button onClick={() => handleEmailSelf(true)} style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid #e0d8cc", background: "#faf8f4", color: "#5a5040", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    ✉ Send cancellation notice to yourself
                  </button>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Property detail mini-modal ── */}
      {focusedProperty && (
        <div onClick={() => setFocusedProperty(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", maxWidth: 400, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", fontFamily: "'DM Sans', sans-serif" }}>
            {focusedProperty.image && <img src={focusedProperty.image} alt={focusedProperty.title} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />}
            <div style={{ padding: "20px 22px 24px", position: "relative" }}>
              <button onClick={() => setFocusedProperty(null)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", color: "#9a8f80", fontSize: 20, lineHeight: 1 }}>✕</button>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1410" }}>{focusedProperty.title}</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2 }}>{focusedProperty.city}{focusedProperty.area && focusedProperty.area !== focusedProperty.city ? `, ${focusedProperty.area}` : ""}</div>
                </div>
                <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: focusedProperty.isForRent ? "#f0f8ee" : "#f0f0f8", color: focusedProperty.isForRent ? "#3a7a2a" : "#4a4a8a", border: `1px solid ${focusedProperty.isForRent ? "#b8e0a8" : "#c0c0e8"}`, flexShrink: 0 }}>
                  {focusedProperty.isForRent ? "For Rent" : "For Sale"}
                </span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#c9a84c", marginBottom: 10 }}>{formatPrice(focusedProperty.price, focusedProperty.currency, focusedProperty.isForRent)}</div>
              {(focusedProperty.bedrooms != null || focusedProperty.bathrooms != null) && (
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  {focusedProperty.bedrooms != null && <span style={{ fontSize: 13, color: "#5a5040" }}>🛏 {focusedProperty.bedrooms} bed</span>}
                  {focusedProperty.bathrooms != null && <span style={{ fontSize: 13, color: "#5a5040" }}>🚿 {focusedProperty.bathrooms} bath</span>}
                  {focusedProperty.sqft && <span style={{ fontSize: 13, color: "#5a5040" }}>📐 {focusedProperty.sqft} sqft</span>}
                </div>
              )}
              {focusedProperty.description && (
                <div style={{ fontSize: 13, color: "#5a5040", lineHeight: 1.65, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{focusedProperty.description}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Listings Shorts Panel ────────────────────────────────────────────────────
function ListingsShortsPanel({ userListings, onAddListing, isFavourited, onFavourite, onSelect, onShare, userPrefs, favourites, sharedListings, user, profile }) {
  const T = useTheme();
  const [showFlow, setShowFlow] = useState(false);

  // Deduplicate saved + shared listings into a single interaction history
  const interactionListings = useMemo(() => {
    const seen = new Set();
    const result = [];
    [...(favourites || []).map(f => f.listing_data).filter(Boolean), ...(sharedListings || [])].forEach(l => {
      if (l && !seen.has(l.id)) { seen.add(l.id); result.push(l); }
    });
    return result;
  }, [favourites, sharedListings]);

  // Score all LISTINGS and sort by relevance; user-added listings always appear first
  const feed = useMemo(() => {
    const hasSignals = !!(userPrefs || interactionListings.length > 0);
    const scored = LISTINGS.map(l => ({
      ...l,
      _score: scoreListing(l, userPrefs, interactionListings) + Math.random() * 1.5,
      _reason: hasSignals ? getListingReason(l, userPrefs, interactionListings) : null,
    })).sort((a, b) => b._score - a._score);
    return [...userListings, ...scored.slice(0, 50)];
  }, [userListings, userPrefs, interactionListings]);

  return (
    <div style={{ position: "fixed", left: T.sidebarW, right: 0, top: 0, bottom: 0 }}>
      {/* Vertical scroll-snap container */}
      <div id="shorts-scroll" style={{
        width: "100%", height: "100%",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
      }}>
        <style>{`#shorts-scroll::-webkit-scrollbar { display: none; }`}</style>
        {feed.map((listing, i) => (
          <div key={listing.id || i} style={{ height: "100vh", scrollSnapAlign: "start", flexShrink: 0 }}>
            <ShortCard
              listing={listing}
              isFavourited={isFavourited(listing.id)}
              onFavourite={onFavourite}
              onSelect={onSelect}
              onShare={onShare}
            />
          </div>
        ))}
      </div>

      {/* "List property" label */}
      <div style={{
        position: "absolute", bottom: 100, right: 22,
        background: "rgba(0,0,0,0.65)", color: "#fff",
        fontSize: 11, fontWeight: 600, padding: "4px 10px",
        borderRadius: 20, letterSpacing: "0.04em", pointerEvents: "none",
      }}>List property</div>

      {/* FAB */}
      <button onClick={() => setShowFlow(true)} style={{
        position: "absolute", bottom: 36, right: 28,
        background: "#c9a84c", border: "none", borderRadius: "50%",
        width: 56, height: 56, fontSize: 28, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(201,168,76,0.55)",
        zIndex: 10,
      }} title="Add listing">+</button>

      {showFlow && (
        <LandlordFlow
          onClose={() => setShowFlow(false)}
          onPost={onAddListing}
          user={user}
          profile={profile}
        />
      )}
    </div>
  );
}

// ─── Messages Panel ───────────────────────────────────────────────────────────
function MessagesPanel({ conversations, onSend, onMarkRead }) {
  const T = useTheme();
  const [activeId, setActiveId] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  // Auto-select first conversation
  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  // Scroll to bottom when messages change
  const active = conversations.find(c => c.id === activeId);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length]);

  const filtered = conversations.filter(c => filterTab === "all" || c.type === filterTab);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ position: "fixed", top: 0, left: T.sidebarW, right: 0, bottom: 0, background: T.bg, zIndex: 100, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1a1410", margin: 0 }}>Messages</h1>
          <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 3 }}>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex" }}>
          {[["all", "All"], ["flatmate", "Flatmates"], ["landlord", "Landlords"]].map(([t, label]) => (
            <button key={t} onClick={() => setFilterTab(t)} style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: filterTab === t ? 700 : 400, color: filterTab === t ? "#1a1410" : "#9a8f80", borderBottom: `2.5px solid ${filterTab === t ? "#c9a84c" : "transparent"}`, transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif" }}>{label}</button>
          ))}
        </div>
      </div>

      {conversations.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#9a8f80" }}>
          <div style={{ fontSize: 40 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>No messages yet</div>
          <div style={{ fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>Connect with a flatmate or send a viewing request to start a conversation</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Conversation list */}
          <div style={{ width: 300, borderRight: "1px solid #ede8de", overflowY: "auto", background: "#fff", flexShrink: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#9a8f80", fontSize: 13 }}>No {filterTab} conversations yet</div>
            ) : filtered.map(c => (
              <div key={c.id}
                onClick={() => { setActiveId(c.id); onMarkRead && onMarkRead(c.id); }}
                style={{ padding: "14px 18px", cursor: "pointer", borderBottom: "1px solid #f5f0e8", background: activeId === c.id ? "#fdf8ee" : "transparent", display: "flex", gap: 12, alignItems: "center", transition: "background 0.12s" }}
                onMouseEnter={e => { if (activeId !== c.id) e.currentTarget.style.background = "#faf8f4"; }}
                onMouseLeave={e => { if (activeId !== c.id) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: c.type === "flatmate" ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "linear-gradient(135deg, #3a6a8a, #1a3a5a)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {c.avatar ? <img src={c.avatar} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.type === "flatmate" ? "🤝" : "🏠")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1410", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    {c.unread > 0 && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{c.unread}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: c.type === "flatmate" ? "#8b6520" : "#3a6a8a", fontWeight: 600, marginTop: 1 }}>{c.type === "flatmate" ? "Flatmate" : "Landlord"}</div>
                  <div style={{ fontSize: 12, color: "#9a8f80", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.messages[c.messages.length - 1]?.text || ""}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {active ? (
              <>
                {/* Chat header */}
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #ede8de", background: "#fff", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: active.type === "flatmate" ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "linear-gradient(135deg, #3a6a8a, #1a3a5a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {active.avatar ? <img src={active.avatar} alt={active.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (active.type === "flatmate" ? "🤝" : "🏠")}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1410" }}>{active.name}</div>
                    <div style={{ fontSize: 12, color: active.type === "flatmate" ? "#8b6520" : "#3a6a8a", fontWeight: 500 }}>
                      {active.type === "flatmate" ? "🤝 Flatmate connection" : `🏠 Landlord · ${active.subtitle || ""}`}
                    </div>
                  </div>
                </div>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {active.messages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.from === "me" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: 6, alignItems: msg.from === "me" ? "flex-end" : "flex-start" }}>
                        {msg.listing && (
                          <div style={{
                            borderRadius: 12, overflow: "hidden", border: "1px solid #ede8de",
                            background: "#fff", width: 220, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                          }}>
                            {msg.listing.image && (
                              <img src={msg.listing.image} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                            )}
                            <div style={{ padding: "8px 12px" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1410", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.listing.title}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c", marginTop: 2 }}>{formatPrice(msg.listing.price, msg.listing.currency, msg.listing.isForRent)}</div>
                              <div style={{ fontSize: 11, color: "#9a8f80", marginTop: 1 }}>📍 {msg.listing.city}</div>
                              {(msg.listing.bedrooms != null || msg.listing.bathrooms != null) && (
                                <div style={{ fontSize: 11, color: "#b0a890", marginTop: 2 }}>
                                  {msg.listing.bedrooms != null && `🛏 ${msg.listing.bedrooms} bd`}
                                  {msg.listing.bedrooms != null && msg.listing.bathrooms != null && "  "}
                                  {msg.listing.bathrooms != null && `🚿 ${msg.listing.bathrooms} ba`}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div style={{ padding: "10px 14px", borderRadius: msg.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: msg.from === "me" ? "linear-gradient(135deg, #c9a84c, #8b6520)" : "#fff", color: msg.from === "me" ? "#fff" : "#1a1410", fontSize: 13, lineHeight: 1.5, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: msg.from === "me" ? "none" : "1px solid #ede8de" }}>
                          {msg.text}
                          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.65, textAlign: "right" }}>{formatTime(msg.time)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
                {/* Input */}
                <div style={{ padding: "14px 24px", borderTop: "1px solid #ede8de", background: "#fff", display: "flex", gap: 10, flexShrink: 0 }}>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { onSend(active.id, input.trim()); setInput(""); e.preventDefault(); } }}
                    placeholder="Type a message…"
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #ede8de", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1a1410", outline: "none" }}
                  />
                  <button
                    onClick={() => { if (input.trim()) { onSend(active.id, input.trim()); setInput(""); } }}
                    style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #c9a84c, #8b6520)", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>Send</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8f80" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <div style={{ fontSize: 14 }}>Select a conversation</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [swipeMode, setSwipeMode] = useState(false);
  const [swipeStartIndex, setSwipeStartIndex] = useState(0);
  const [summaryText, setSummaryText] = useState("");
  const [error, setError] = useState(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [savedConversations, setSavedConversations] = useState(() => loadConversations());
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [favourites, setFavourites] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userPrefs, setUserPrefs] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPathChooser, setShowPathChooser] = useState(false);
  const [profileToast, setProfileToast] = useState(false);
  const [directConversations, setDirectConversations] = useState(() => loadDirectConvos(null));
  const [userListings, setUserListings] = useState(() => loadUserListings(null));
  const [landlordMode, setLandlordMode] = useState(false);
  const [sharingListing, setSharingListing] = useState(null);
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem("estato_scheme") || "light");
  const [density, setDensity] = useState(() => localStorage.getItem("estato_density") || "comfortable");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const newChatInProgress = useRef(false);

  useEffect(() => {
    const unsub = auth.onAuthChange(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setShowAuthModal(false);
        try { const p = await db.getProfile(currentUser.id); setProfile(p); } catch { }
        let hasExistingConvos = false;
        try {
          const convos = await db.getConversations(currentUser.id);
          setSavedConversations(convos);
          hasExistingConvos = convos.length > 0;
          if (hasExistingConvos && !newChatInProgress.current) {
            const full = await db.getConversation(convos[0].id);
            setConversationId(full.id); setMessages(full.messages || []);
            setRecommendations(full.recommendations || []); setSummaryText(full.summary || "");
            if ((full.messages || []).filter(m => !m.hidden).length > 0) setChatStarted(true);
          }
        } catch { }
        try { const favs = await db.getFavourites(currentUser.id); setFavourites(favs); } catch { }
        try {
          let prefs = await db.getPreferences(currentUser.id);
          console.log("[estato] getPreferences result:", prefs ? "found" : "null");
          if (prefs) {
            setUserPrefs(prefs);
          } else {
            // No Supabase prefs yet — check if the screening/form saved data locally
            let local = null;
            try { local = JSON.parse(localStorage.getItem('estato_user_profile') || 'null'); } catch { /* ignore */ }
            console.log("[estato] local profile:", local ? `city=${local.city || local.cities?.[0]}` : "null");
            if (local && (local.city || local.cities?.length)) {
              // Migrate local data to Supabase, then fetch the normalised row back
              try { await db.savePreferences(currentUser.id, local); } catch (e) { console.error("[estato] migration save failed:", e?.message, e?.code); }
              try { prefs = await db.getPreferences(currentUser.id); } catch (e) { console.error("[estato] migration getPrefs failed:", e?.message); }
              setUserPrefs(prefs || local);
              // Only auto-start the agent for first-time logins with no prior conversations
              if (!hasExistingConvos) startChat(prefs || local, false);
            } else {
              console.log("[estato] no local prefs → showing PathChooser");
              setShowPathChooser(true);
            }
          }
        } catch (e) { console.error("[estato] prefs load error:", e?.message); setShowPathChooser(true); }
        setDirectConversations(loadDirectConvos(currentUser.id));
        try {
          const dbListings = await db.getLandlordListings(currentUser.id);
          setUserListings(dbListings.length > 0 ? dbListings : loadUserListings(currentUser.id));
        } catch { setUserListings(loadUserListings(currentUser.id)); }
      } else {
        setProfile(null); setFavourites([]);
        setDirectConversations(loadDirectConvos(null));
        setUserListings(loadUserListings(null));
        const convos = loadConversations();
        setSavedConversations(convos);
        if (convos.length > 0) {
          const last = convos[0];
          setConversationId(last.id); setMessages(last.messages || []);
          setRecommendations(last.recommendations || []); setSummaryText(last.summary || "");
          if ((last.messages || []).filter(m => !m.hidden).length > 0) setChatStarted(true);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!conversationId || messages.filter(m => !m.hidden).length === 0) return;
    const preview = messages.filter(m => !m.hidden).find(m => m.role === "user")?.display || messages.filter(m => !m.hidden).find(m => m.role === "user")?.content || "New conversation";
    if (user) {
      // Only pass id if it's already a real UUID from Supabase (contains hyphens)
      const isUUID = conversationId && conversationId.includes('-');
      db.saveConversation({ id: isUUID ? conversationId : null, userId: user.id, preview, summary: summaryText, messages, recommendations })
        .then(savedId => { if (savedId && savedId !== conversationId && !newChatInProgress.current) setConversationId(savedId); db.getConversations(user.id).then(setSavedConversations).catch(() => { }); }).catch(() => { });
    } else {
      saveCurrentConversation(conversationId, messages, recommendations, summaryText);
      setSavedConversations(loadConversations());
    }
  }, [messages, recommendations, summaryText]);

  // Persist direct (flatmate/landlord) conversations to localStorage
  useEffect(() => { saveDirectConvos(user?.id, directConversations); }, [directConversations, user?.id]);

  const addConversation = useCallback((person, type) => {
    const convId = `${type}-${person.id || String(person.title || "").replace(/\s+/g, "-").toLowerCase()}`;
    setDirectConversations(prev => {
      if (prev.find(c => c.id === convId)) return prev;
      const displayName = type === "flatmate" ? person.name : (person.agent || "Property Agent");
      const subtitle = type === "flatmate" ? `${person.age} · ${person.occupation}` : person.title;
      const initMsg = type === "flatmate"
        ? `Hey! I saw your profile on Estato. I'm looking for a flatmate in ${person.city || "the area"} too — would love to connect!`
        : `Hi! Thanks for your interest in ${person.title}. We've received your viewing request and will be in touch very soon.`;
      return [{ id: convId, type, name: displayName, subtitle, avatar: person.avatar || null, messages: [{ from: "them", text: initMsg, time: Date.now() }], unread: 1 }, ...prev];
    });
  }, []);

  const sendDirectMessage = useCallback((convId, text) => {
    setDirectConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      const flatmateReplies = ["Sounds great! When are you free to chat?", "That works for me!", "I'd love to know more about you. What are you like as a flatmate?", "Cool! I'll send you my number."];
      const landlordReplies = ["Thanks for reaching out. We'll arrange a viewing slot shortly.", "Great news — we have availability this weekend. Does that work?", "We've noted your request. Someone from our team will contact you by end of day."];
      const updated = { ...c, messages: [...c.messages, { from: "me", text, time: Date.now() }], unread: 0 };
      setTimeout(() => {
        const reply = c.type === "flatmate" ? flatmateReplies[Math.floor(Math.random() * flatmateReplies.length)] : landlordReplies[Math.floor(Math.random() * landlordReplies.length)];
        setDirectConversations(p2 => p2.map(c2 => c2.id !== convId ? c2 : { ...c2, messages: [...c2.messages, { from: "them", text: reply, time: Date.now() }], unread: 1 }));
      }, 1500);
      return updated;
    }));
  }, []);

  const markConvRead = useCallback((convId) => {
    setDirectConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: 0 } : c));
  }, []);

  // Persist user listings to localStorage whenever they change
  useEffect(() => { saveUserListings(user?.id, userListings); }, [userListings, user?.id]);

  const addUserListing = useCallback((listing) => {
    setUserListings(prev => [listing, ...prev]);
    if (user?.id) db.addLandlordListing(user.id, listing).catch(console.error);
  }, [user?.id]);

  const updateUserListing = useCallback((updatedListing) => {
    setUserListings(prev => prev.map(l => l.id === updatedListing.id ? updatedListing : l));
    if (user?.id) db.updateLandlordListing(user.id, updatedListing).catch(console.error);
  }, [user?.id]);

  const removeUserListing = useCallback((listingId) => {
    setUserListings(prev => prev.filter(l => l.id !== listingId));
    if (user?.id) db.removeLandlordListing(user.id, listingId).catch(console.error);
  }, [user?.id]);

  const shareListingToConv = useCallback((convId, listing) => {
    const snippet = `${listing.title} — ${formatPrice(listing.price, listing.currency, listing.isForRent)} in ${listing.city}`;
    setDirectConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: [...c.messages, {
          from: "me", text: snippet, time: Date.now(),
          listing: {
            id: listing.id, title: listing.title, price: listing.price,
            currency: listing.currency, isForRent: listing.isForRent,
            city: listing.city, image: listing.image,
            bedrooms: listing.bedrooms, bathrooms: listing.bathrooms,
          },
        }],
        unread: 0,
      };
    }));
  }, []);

  // Share listing to a connection — creates the conversation if it doesn't exist yet
  const startConversationWithListing = useCallback((flatmate, listing) => {
    const convId = `flatmate-${flatmate.id}`;
    const snippet = `${listing.title} — ${formatPrice(listing.price, listing.currency, listing.isForRent)} in ${listing.city}`;
    const listingMsg = {
      from: "me", text: snippet, time: Date.now(),
      listing: {
        id: listing.id, title: listing.title, price: listing.price,
        currency: listing.currency, isForRent: listing.isForRent,
        city: listing.city, image: listing.image,
        bedrooms: listing.bedrooms, bathrooms: listing.bathrooms,
      },
    };
    setDirectConversations(prev => {
      // If conversation already exists, just append the listing message
      if (prev.find(c => c.id === convId)) {
        return prev.map(c => c.id !== convId ? c : { ...c, messages: [...c.messages, listingMsg], unread: 0 });
      }
      // Otherwise create a fresh conversation with an intro + the listing
      const initMsg = `Hey! I saw your profile on Estato. I'm looking for a flatmate in ${flatmate.city || "the area"} too — would love to connect!`;
      return [{
        id: convId, type: "flatmate",
        name: flatmate.name,
        subtitle: `${flatmate.age} · ${flatmate.occupation}`,
        avatar: flatmate.avatar || null,
        messages: [
          { from: "them", text: initMsg, time: Date.now() },
          listingMsg,
        ],
        unread: 0,
      }, ...prev];
    });
  }, []);

  const toggleFavourite = async (property) => {
    if (!user) { setShowAuthModal(true); return; }
    const already = favourites.some(f => f.listing_id === property.id);
    if (already) { await db.removeFavourite(user.id, property.id); }
    else { await db.addFavourite(user.id, property); }
    setFavourites(await db.getFavourites(user.id));
  };
  const isFavourited = (propertyId) => favourites.some(f => f.listing_id === propertyId);

  const callClaude = useCallback(async (history, userPrefs = null) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, system: buildSystemPrompt(userPrefs), messages: history })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "API error"); }
    const data = await res.json();
    return data.content[0]?.text || "";
  }, []);

  const startChat = useCallback(async (prefs = null, fromAlexPath = false) => {
    newChatInProgress.current = true;
    const newId = genId();
    setConversationId(newId);
    setChatStarted(true);
    setMessages([]); setRecommendations([]); setSummaryText(""); setError(null);
    setIsLoading(true);

    // Build opener based on which path the user took
    let opener;
    if (fromAlexPath) {
      // "Chat with Alex" — warm intro, one question
      opener = "Hi, I've just created my Estato account and I'd like to find a property. Please introduce yourself briefly, ask me one question to get started, and include a broad <PROPERTY_SEARCH> block so some properties appear while we chat.";
    } else if (prefs && (prefs.intent || prefs.cities?.length || prefs.budget_max)) {
      // Came via questionnaire — Alex MUST summarise profile + search immediately
      const parts = [
        prefs.intent && `looking to ${prefs.intent}`,
        prefs.cities?.length && `in ${prefs.cities.slice(0, 3).join(" or ")}`,
        prefs.types?.length && `interested in ${prefs.types.join(", ")}`,
        (prefs.budget_min || prefs.budget_max) && `budget ${prefs.budget_min ? `from £${Math.round(prefs.budget_min / 1000)}k ` : ""}${prefs.budget_max ? `up to £${Math.round(prefs.budget_max / 1000)}k` : ""}`,
        prefs.must_haves?.length && `must-haves: ${prefs.must_haves.join(", ")}`,
        prefs.commute_destination && `commuting to ${prefs.commute_destination}${prefs.commute_max_minutes ? ` (max ${prefs.commute_max_minutes} mins)` : ""}`,
        prefs.partner_preferences && `lifestyle context: ${prefs.partner_preferences}`,
        prefs.timeline && `timeline: ${prefs.timeline}`,
      ].filter(Boolean);
      opener = `I've just finished my setup questionnaire. Here is everything I told you: ${parts.join("; ")}. Now please: (1) greet me by name if you have it, (2) give a warm 2-sentence summary showing you've read my profile, (3) immediately present your top 3 matching properties with a specific reason why each one suits ME. You MUST include a <PROPERTY_SEARCH> block in this response — the sidebar will stay empty without it. Do not ask any questions yet.`;
    } else {
      opener = "Hello, I'm looking for a property.";
    }

    try {
      const reply = await callClaude([{ role: "user", content: opener }], prefs);
      console.log("🔍 v2 — Has PROPERTY_SEARCH:", reply.includes("<PROPERTY_SEARCH>"));
      // Force test: London rentals should always return results
      const forceTest = searchListings({ cities: ["London"], isForRent: true, limit: 3 });
      console.log("🔍 Force test (London rentals):", forceTest.length, forceTest[0]?.title);
      const clean = stripProfileUpdate(stripSearchQuery(reply));
      const searchQ = parseSearchQuery(reply);
      setMessages([
        { role: "user", content: opener, hidden: true },
        { role: "assistant", content: reply, display: clean }
      ]);
      if (searchQ) {
        const userMatches = matchUserListings(userListings, searchQ).map(p => ({
          ...p, reason: searchQ.matchReasons?.whyThese || "", matchScore: Math.floor(85 + Math.random() * 10),
        }));
        const results = searchListings(searchQ);
        const withReasons = results.map(p => ({ ...p, reason: searchQ.matchReasons?.whyThese || "", matchScore: Math.floor(75 + Math.random() * 20) }));
        setRecommendations([...userMatches, ...withReasons]);
        if (searchQ.matchReasons?.summary) setSummaryText(searchQ.matchReasons.summary);
      }
    } catch (e) { setError(e.message); }
    finally { newChatInProgress.current = false; setIsLoading(false); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [callClaude]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim(); setInput(""); setError(null);
    const newMsgs = [...messages, { role: "user", content: text, display: text }];
    setMessages(newMsgs); setIsLoading(true);
    try {
      const history = newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      const reply = await callClaude(history, userPrefs);
      const clean = stripProfileUpdate(stripSearchQuery(reply));
      const searchQ = parseSearchQuery(reply);
      const profileUpd = parseProfileUpdate(reply);
      setMessages(prev => [...prev, { role: "assistant", content: reply, display: clean }]);
      if (profileUpd && user) {
        const merged = { ...(userPrefs || {}), ...profileUpd };
        setUserPrefs(merged);
        db.savePreferences(user.id, merged).catch(() => { });
        setProfileToast(true);
        setTimeout(() => setProfileToast(false), 3000);
      }
      if (searchQ) {
        const userMatches = matchUserListings(userListings, searchQ).map(p => ({
          ...p, reason: searchQ.matchReasons?.whyThese || "", matchScore: Math.floor(88 + Math.random() * 8),
        }));
        const results = searchListings(searchQ);
        const withReasons = results.map((p, i) => ({ ...p, reason: searchQ.matchReasons?.whyThese || "", matchScore: Math.floor(92 - i * 4 - Math.random() * 5) }));
        setRecommendations([...userMatches, ...withReasons]);
        if (searchQ.matchReasons?.summary) setSummaryText(searchQ.matchReasons.summary);
      }
    } catch (e) { setError(e.message); }
    finally { newChatInProgress.current = false; setIsLoading(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const shownProperties = recommendations;

  // Listings that have been shared through the platform (extracted from all conversation messages)
  const sharedListings = useMemo(() => {
    const seen = new Set();
    const result = [];
    directConversations.forEach(c => {
      c.messages.forEach(msg => {
        if (msg.listing && !seen.has(msg.listing.id)) {
          seen.add(msg.listing.id);
          result.push(msg.listing);
        }
      });
    });
    return result;
  }, [directConversations]);

  // Persist theme preferences
  useEffect(() => { localStorage.setItem("estato_scheme", colorScheme); }, [colorScheme]);
  useEffect(() => { localStorage.setItem("estato_density", density); }, [density]);

  // ─── Design Tokens ──────────────────────────────────────────────────────────
  const dk = colorScheme === "dark";
  const compact = density === "compact";
  const T = {
    bg: dk ? "#0c0c0c" : "#f5f2ec",
    surface: dk ? "#141414" : "#ffffff",
    surfaceHover: dk ? "#1c1c1c" : "#faf8f4",
    sidebar: dk ? "#0f0f0f" : "#ffffff",
    text: dk ? "#f0f0f0" : "#1a1410",
    textSub: dk ? "rgba(255,255,255,0.45)" : "#9a8f80",
    textMuted: dk ? "rgba(255,255,255,0.22)" : "#b8b0a0",
    border: dk ? "rgba(255,255,255,0.07)" : "#ede8de",
    borderStrong: dk ? "rgba(255,255,255,0.12)" : "#d5c9b0",
    gold: "#c9a84c",
    goldDim: dk ? "rgba(201,168,76,0.12)" : "#fdf8ee",
    navActive: dk ? "rgba(201,168,76,0.1)" : "#f5edd8",
    navActiveText: dk ? "#c9a84c" : "#7a5520",
    navText: dk ? "rgba(255,255,255,0.45)" : "#8a8070",
    navIcon: dk ? "rgba(255,255,255,0.3)" : "#b0a090",
    chatBg: dk ? "#0c0c0c" : "#faf8f4",
    inputBg: dk ? "#1c1c1c" : "#ffffff",
    inputBorder: dk ? "rgba(255,255,255,0.1)" : "#ede8de",
    shadow: dk ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.04)",
    shadowHover: dk ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 24px rgba(0,0,0,0.1)",
    sidebarW: compact ? 64 : 216,
    rightW: compact ? 0 : 272,
    cardPad: compact ? "8px 10px" : "12px 14px",
    gridCols: compact ? "repeat(auto-fill, minmax(100%, 1fr))" : "repeat(auto-fill, minmax(260px, 1fr))",
    msgGap: compact ? 6 : 14,
    imgH: compact ? 64 : 160,
  };

  // Browse listings — filtered from userPrefs directly, no chat needed
  const browseQuery = userPrefs ? {
    cities: userPrefs.cities,
    types: userPrefs.types?.map(t => t.toLowerCase()),
    isForRent: userPrefs.intent === "renting" ? true : userPrefs.intent === "buying" ? false : null,
    maxPrice: userPrefs.budget_max,
    minPrice: userPrefs.budget_min,
    minBeds: userPrefs.types?.includes("Studio") ? 0 : undefined,
  } : {};
  const browseListings = [
    ...matchUserListings(userListings, browseQuery),
    ...(userPrefs ? searchListings({ ...browseQuery, limit: 40, sortBy: "random" }) : searchListings({ limit: 40, sortBy: "random" })),
  ];

  const visibleMsgs = messages.filter(m => !m.hidden);

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", height: "100vh", display: "flex", background: T.bg, overflow: "hidden", transition: "background 0.2s" }}>
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dk ? "rgba(255,255,255,0.15)" : "#d5c9b0"}; border-radius: 4px; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        textarea { resize:none; outline:none; font-family:'DM Sans',sans-serif; }
        textarea::placeholder { color:${dk ? "rgba(255,255,255,0.25)" : "#b8b0a0"}; }
        button { font-family:'DM Sans',sans-serif; }
      `}</style>

        {/* ══ LEFT NAV ══════════════════════════════════════════════════════════ */}
        <div style={{
          width: T.sidebarW, flexShrink: 0, background: T.sidebar,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          padding: compact ? "0 6px 16px" : "0 10px 20px",
          transition: "width 0.2s ease", overflow: "hidden",
        }}>
          <div style={{ padding: compact ? "16px 0 14px" : "20px 6px 18px", borderBottom: `1px solid ${T.border}`, marginBottom: 10, textAlign: compact ? "center" : "left" }}>
            {compact ? (
              <div style={{ fontSize: 18, fontWeight: 700, color: T.gold }}>E</div>
            ) : (
              <>
                <div style={{ fontSize: 19, fontWeight: 700, color: T.text, letterSpacing: "-0.5px" }}>
                  Est<span style={{ color: T.gold }}>ato</span>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>Real Estate Platform</div>
              </>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <NavItem icon="home" label="Properties" active={activeNav === "properties"} onClick={() => setActiveNav("properties")} compact={compact} />
            <NavItem icon="chat" label="Alex (Agent)" active={activeNav === "chat"} onClick={() => setActiveNav("chat")} badge={shownProperties.length} compact={compact} />
            <NavItem icon="heart" label="Favourites" active={activeNav === "favourites"} onClick={() => setActiveNav("favourites")} compact={compact} />
            <NavItem icon="people" label="Flatmates" active={activeNav === "flatmates"} onClick={() => setActiveNav("flatmates")} compact={compact} />
            <NavItem icon="messages" label="Messages" active={activeNav === "messages"} onClick={() => setActiveNav("messages")} badge={directConversations.reduce((s, c) => s + (c.unread || 0), 0) || undefined} compact={compact} />
            <NavItem icon="shorts" label="Shorts" active={activeNav === "shorts"} onClick={() => setActiveNav("shorts")} badge={userListings.length || undefined} compact={compact} />

            {/* ── Conversation History — hidden in compact ── */}
            {!compact && savedConversations.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowHistory(h => !h)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "8px 12px", background: "none", border: "none",
                  cursor: "pointer", color: T.textSub, fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif"
                }}>
                  Recent Chats
                  <span style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                </button>
                {showHistory && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
                    {savedConversations.map(c => (
                      <div key={c.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                          background: conversationId === c.id ? T.navActive : "transparent",
                          border: "none",
                        }}>
                        <div onClick={() => {
                          setConversationId(c.id);
                          setMessages(c.messages || []);
                          setRecommendations(c.recommendations || []);
                          setSummaryText(c.summary || "");
                          setChatStarted(true);
                          setActiveNav("chat");
                          setShowHistory(false);
                        }} style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12, color: conversationId === c.id ? T.navActiveText : T.text,
                            fontWeight: conversationId === c.id ? 600 : 400,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            fontFamily: "'DM Sans', sans-serif"
                          }}>{c.preview}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{formatRelTime(c.updatedAt)}</div>
                        </div>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                          setSavedConversations(loadConversations());
                          if (conversationId === c.id) {
                            setMessages([]); setRecommendations([]); setSummaryText("");
                            setChatStarted(false); setConversationId(null);
                          }
                        }} style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: T.textMuted, padding: "2px 3px", borderRadius: 4,
                          fontSize: 13, lineHeight: 1, flexShrink: 0,
                          fontFamily: "'DM Sans', sans-serif"
                        }} title="Delete">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto" }}>
            {/* ── Tenant / Landlord mode toggle ── */}
            {!compact && (
              <div style={{ paddingLeft: 4, paddingRight: 4, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, paddingLeft: 2 }}>Mode</div>
                <div style={{
                  display: "flex", background: dk ? "rgba(255,255,255,0.05)" : "#f0ebe0",
                  borderRadius: 20, padding: 3, position: "relative",
                }}>
                  <div style={{
                    position: "absolute", top: 3, bottom: 3,
                    left: landlordMode ? "calc(50% + 1.5px)" : "3px",
                    width: "calc(50% - 4.5px)",
                    background: T.surface, borderRadius: 16,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                    transition: "left 0.2s ease",
                    pointerEvents: "none",
                  }} />
                  {["Tenant", "Landlord"].map(label => (
                    <button key={label} onClick={() => setLandlordMode(label === "Landlord")} style={{
                      flex: 1, padding: "7px 0", border: "none",
                      background: "transparent", borderRadius: 16,
                      fontSize: 12,
                      fontWeight: (label === "Landlord") === landlordMode ? 700 : 500,
                      color: (label === "Landlord") === landlordMode ? T.text : T.textSub,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      position: "relative", zIndex: 1,
                      transition: "color 0.2s",
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Account Type chips — hidden in compact ── */}
            {!compact && (
              <div style={{ opacity: landlordMode ? 0.35 : 1, pointerEvents: landlordMode ? "none" : "auto", transition: "opacity 0.2s" }}>
                <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, paddingLeft: 6 }}>Account Type</div>
                {(() => {
                  const roleLabel = { renting: "Renter", buying: "Buyer", investing: "Investor" }[userPrefs?.intent] || "Buyer";
                  return [roleLabel, "Agent"].map(type => (
                    <button key={type} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "9px 12px", borderRadius: 8, marginBottom: 4,
                      background: type === roleLabel ? T.navActive : "transparent",
                      border: type === roleLabel ? `1px solid ${T.borderActive}` : "1px solid transparent",
                      cursor: "pointer", fontSize: 13,
                      fontWeight: type === roleLabel ? 600 : 400,
                      color: type === roleLabel ? T.navActiveText : T.textMuted
                    }}>
                      {type === roleLabel && <span style={{ color: T.gold, fontSize: 11 }}>✓</span>}
                      {type}
                    </button>
                  ));
                })()}
              </div>
            )}

            <div style={{ marginTop: compact ? 0 : 4 }}>
              <NavItem icon="settings" label={user ? (profile?.full_name?.split(" ")[0] || "Account") : "Sign In"} active={activeNav === "account"} onClick={() => user ? setActiveNav("account") : setShowAuthModal(true)} compact={compact} />
            </div>
          </div>
        </div>

        {/* ══ MAIN ══════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Top bar */}
          <div style={{
            padding: "13px 20px", background: T.surface,
            borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, transition: "background 0.2s",
          }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                {activeNav === "properties"
                  ? <><span style={{ fontWeight: 400, color: T.textSub }}>Browse</span> {userPrefs ? "your matches" : "all properties"}</>
                  : chatStarted && shownProperties.length > 0
                    ? <><span style={{ fontWeight: 400, color: T.textSub }}>Alex found</span> {shownProperties.length} properties</>
                    : "Chat with Alex"}
              </h1>
              {activeNav === "properties" && (
                <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>
                  {browseListings.length} listings {userPrefs ? "matching your profile" : "available"}
                </div>
              )}
              {activeNav !== "properties" && chatStarted && shownProperties.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: T.textSub }}>
                    {shownProperties.length} matched of {LISTINGS.length.toLocaleString()} listings
                  </span>
                  <div style={{ width: 120, height: 3, background: T.border, borderRadius: 2 }}>
                    <div style={{ width: `${(shownProperties.length / LISTINGS.length) * 100}%`, height: "100%", background: T.gold, borderRadius: 2 }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {chatStarted && (
                <button onClick={() => { setChatStarted(false); setMessages([]); setRecommendations([]); setSummaryText(""); setConversationId(null); }}
                  style={{
                    padding: "7px 14px", borderRadius: 20, border: `1px solid ${T.border}`,
                    background: T.surface, cursor: "pointer", fontSize: 12, color: T.textSub,
                    display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
                  onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                >↺ New Search</button>
              )}
              {(shownProperties.length > 0 || browseListings.length > 0) && (
                <button onClick={() => { setSwipeStartIndex(0); setSwipeMode(true); }} style={{
                  padding: "7px 14px", borderRadius: 20, border: `1px solid ${T.gold}`,
                  background: T.goldDim, cursor: "pointer", fontSize: 12, color: T.navActiveText,
                  display: "flex", alignItems: "center", gap: 5, fontWeight: 600
                }}>
                  🃏 Swipe
                </button>
              )}
              {/* Density toggle */}
              <button onClick={() => setDensity(d => d === "compact" ? "comfortable" : "compact")}
                title={compact ? "Comfortable view" : "Compact view"}
                style={{
                  width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`,
                  background: T.surface, cursor: "pointer", color: T.textSub,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
              >{compact ? "⊞" : "☰"}</button>
              {/* Theme toggle */}
              <button onClick={() => setColorScheme(s => s === "light" ? "dark" : "light")}
                title={dk ? "Light mode" : "Dark mode"}
                style={{
                  width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.border}`,
                  background: T.surface, cursor: "pointer", color: T.textSub,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
              >{dk ? "☀" : "🌙"}</button>
            </div>
          </div>

          {/* Body: chat + right sidebar */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* ── Properties browse panel ── */}
            {activeNav === "properties" && (
              <div style={{ flex: 1, overflowY: "auto", padding: compact ? "16px 16px" : "24px 28px", background: T.chatBg }}>
                {userPrefs && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {[
                      userPrefs.intent && `${{ buying: "🏡 Buying", renting: "🔑 Renting", investing: "📈 Investing" }[userPrefs.intent]}`,
                      userPrefs.budget_max && `💰 Up to £${Math.round(userPrefs.budget_max / 1000)}k`,
                      ...(userPrefs.cities?.slice(0, 3).map(c => `📍 ${c}`) || []),
                      userPrefs.types?.length && `🏠 ${userPrefs.types.join(", ")}`,
                    ].filter(Boolean).map(tag => (
                      <span key={tag} style={{ padding: "4px 10px", borderRadius: 20, background: T.goldDim, border: `1px solid ${T.borderActive ?? T.gold}`, fontSize: 12, color: T.navActiveText, fontWeight: 500 }}>{tag}</span>
                    ))}
                    <span style={{ padding: "4px 10px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}`, fontSize: 12, color: T.textSub }}>{browseListings.length} properties</span>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: T.gridCols, gap: compact ? 8 : 16 }}>
                  {browseListings.map(p => (
                    compact ? (
                      /* Compact list row */
                      <div key={p.id} onClick={() => setSelectedProperty(p)} style={{
                        background: T.surface, borderRadius: 10, overflow: "hidden",
                        border: `1px solid ${T.border}`, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 0,
                        transition: "box-shadow 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = T.shadowHover}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                      >
                        <img src={p.image} alt={p.title} style={{ width: 80, height: 64, objectFit: "cover", flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: "8px 12px", minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: T.textSub, display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                            <Svg d={I.pin} size={9} stroke={T.gold} />{p.location}
                          </div>
                        </div>
                        <div style={{ padding: "8px 12px", flexShrink: 0, textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{formatPrice(p.price, p.currency, p.isForRent)}</div>
                          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{p.bedrooms}bd · {p.bathrooms}ba</div>
                        </div>
                      </div>
                    ) : (
                      /* Comfortable tile */
                      <div key={p.id} onClick={() => setSelectedProperty(p)} style={{
                        background: T.surface, borderRadius: 14, overflow: "hidden",
                        border: `1px solid ${T.border}`, cursor: "pointer",
                        transition: "box-shadow 0.15s, transform 0.15s",
                        boxShadow: T.shadow,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = T.shadow; e.currentTarget.style.transform = "none"; }}
                      >
                        <div style={{ position: "relative" }}>
                          <img src={p.image} alt={p.title} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                          {p._userListing
                            ? <div style={{ position: "absolute", top: 10, left: 10, background: "#5a8a4a", color: "#fff", padding: "3px 9px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>Owner listed</div>
                            : p.tag && <div style={{ position: "absolute", top: 10, left: 10, background: T.gold, color: "#fff", padding: "3px 9px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{p.tag}</div>
                          }
                          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 5 }}>
                            <button onClick={e => { e.stopPropagation(); setSharingListing(p); }} style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer",
                              fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                            }} title="Share">↗</button>
                            <button onClick={e => { e.stopPropagation(); toggleFavourite(p); }} style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer",
                              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: isFavourited(p.id) ? "#e74c3c" : "#fff",
                            }}>{isFavourited(p.id) ? "♥" : "♡"}</button>
                          </div>
                        </div>
                        <div style={{ padding: T.cardPad }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8, display: "flex", alignItems: "center", gap: 3 }}>
                            <Svg d={I.pin} size={10} stroke={T.gold} />{p.location}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.gold }}>{formatPrice(p.price, p.currency, p.isForRent)}</div>
                            <div style={{ display: "flex", gap: 10, fontSize: 11, color: T.textSub }}>
                              <span>{p.bedrooms} bd</span>
                              <span>{p.bathrooms} ba</span>
                              <span>{p.sqft?.toLocaleString()} ft²</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            <div style={{ flex: 1, display: activeNav === "properties" ? "none" : "flex", flexDirection: "column", minWidth: 0, background: T.chatBg }}>
              {!chatStarted ? (
                /* Welcome */
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: 40, textAlign: "center", animation: "fadeIn 0.4s ease",
                  background: T.chatBg,
                }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: "50%",
                    background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30, marginBottom: 18,
                    boxShadow: "0 8px 24px rgba(201,168,76,0.2)"
                  }}>🧑‍💼</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                    {userPrefs ? `Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}` : "Meet Alex"}
                  </h2>
                  <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.7, maxWidth: 360, marginBottom: userPrefs ? 16 : 24 }}>
                    {userPrefs
                      ? "Alex has read your profile and has properties ready for you. Hit the button and he'll go straight to recommendations."
                      : "Your personal AI estate consultant. Alex will hold a real conversation to understand your life, then surface properties that truly fit."
                    }
                  </p>
                  {userPrefs && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 24, maxWidth: 420 }}>
                      {[
                        userPrefs.intent && `${{ "buying": "🏡 Buying", "renting": "🔑 Renting", "investing": "📈 Investing" }[userPrefs.intent] || userPrefs.intent}`,
                        userPrefs.budget_max && `💰 Up to £${Math.round(userPrefs.budget_max / 1000)}k`,
                        ...(userPrefs.cities?.slice(0, 2).map(c => `📍 ${c}`) || []),
                        userPrefs.commute_destination && `🚇 ${userPrefs.commute_destination}`,
                        userPrefs.timeline && `⏱ ${userPrefs.timeline}`,
                      ].filter(Boolean).map(tag => (
                        <span key={tag} style={{ padding: "5px 12px", borderRadius: 20, background: T.goldDim, border: `1px solid ${T.gold}33`, fontSize: 12, color: T.navActiveText, fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {!userPrefs && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
                      {["20 years experience", "Luxury specialist", "Global portfolio", "Brutally honest"].map(tag => (
                        <span key={tag} style={{ padding: "5px 13px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}`, fontSize: 12, color: T.textSub }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => startChat(userPrefs, !userPrefs)} style={{
                    padding: "13px 36px",
                    background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                    border: "none", borderRadius: 10, cursor: "pointer",
                    color: "#fff", fontSize: 14, fontWeight: 600,
                    boxShadow: "0 4px 16px rgba(201,168,76,0.3)",
                    transition: "all 0.2s"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(201,168,76,0.4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(201,168,76,0.3)"; }}
                  >
                    {userPrefs ? "Show me properties →" : "Begin Consultation"}
                  </button>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px 16px", background: T.chatBg }}>
                    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: T.msgGap }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.textMuted }}>
                        <div style={{ flex: 1, height: 1, background: T.border }} />
                        <span>Consultation started with Alex</span>
                        <div style={{ flex: 1, height: 1, background: T.border }} />
                      </div>

                      {visibleMsgs.map((msg, i) => (
                        <div key={i} style={{
                          display: "flex",
                          flexDirection: msg.role === "user" ? "row-reverse" : "row",
                          gap: 9, alignItems: "flex-end",
                          animation: "slideUp 0.3s ease both"
                        }}>
                          {msg.role === "assistant" && (
                            <div style={{
                              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                              background: "linear-gradient(135deg, #c9a84c, #8b6520)",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
                            }}>🧑‍💼</div>
                          )}
                          <div style={{
                            maxWidth: "74%", padding: "12px 16px",
                            borderRadius: msg.role === "assistant" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                            background: msg.role === "assistant" ? T.surface : "linear-gradient(135deg, #c9a84c, #8b6520)",
                            border: msg.role === "assistant" ? `1px solid ${T.border}` : "none",
                            fontSize: 14, lineHeight: 1.7,
                            color: msg.role === "user" ? "#fff" : T.text,
                            boxShadow: msg.role === "assistant" ? T.shadow : "0 2px 8px rgba(201,168,76,0.25)",
                            whiteSpace: "pre-wrap", wordBreak: "break-word"
                          }}>
                            {msg.display || msg.content}
                          </div>
                          {msg.role === "user" && (
                            <div style={{
                              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                              background: T.goldDim, border: `1.5px solid ${T.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
                            }}>👤</div>
                          )}
                        </div>
                      ))}

                      {isLoading && <TypingIndicator />}
                      {error && (
                        <div style={{
                          padding: "10px 14px", borderRadius: 8,
                          background: T.goldDim, border: `1px solid ${T.gold}44`,
                          fontSize: 13, color: T.navActiveText
                        }}>⚠ {error}</div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Input */}
                  <div style={{ padding: "14px 24px 16px", borderTop: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
                    {summaryText && (
                      <div style={{ fontSize: 12, color: T.textSub, fontStyle: "italic", marginBottom: 10, paddingLeft: 2, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ color: T.gold, fontSize: 10 }}>◆</span>
                        {summaryText}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 640 }}>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Message Alex…"
                        rows={2}
                        style={{
                          flex: 1, padding: "11px 15px",
                          background: T.inputBg, border: `1.5px solid ${T.inputBorder}`,
                          borderRadius: 12, fontSize: 14, color: T.text,
                          lineHeight: 1.5, maxHeight: 120, transition: "border-color 0.15s"
                        }}
                        onFocus={e => e.target.style.borderColor = T.gold}
                        onBlur={e => e.target.style.borderColor = T.inputBorder}
                      />
                      <button onClick={sendMessage} disabled={isLoading || !input.trim()} style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0, border: "none",
                        background: input.trim() && !isLoading ? "linear-gradient(135deg,#c9a84c,#8b6520)" : T.border,
                        cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s"
                      }}>
                        <Svg d={I.send} size={15} stroke={input.trim() && !isLoading ? "#fff" : T.textMuted} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, paddingLeft: 2 }}>
                      Enter to send · Shift+Enter for new line
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ══ RIGHT SIDEBAR ══════════════════════════════════════════════════ */}
            {!compact && (
              <div style={{
                width: T.rightW, flexShrink: 0, background: T.surface,
                borderLeft: `1px solid ${T.border}`,
                display: "flex", flexDirection: "column", overflow: "hidden",
                transition: "width 0.2s ease",
              }}>
                <div style={{ padding: "15px 16px 12px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Alex's Picks</div>
                  <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                    {shownProperties.length > 0
                      ? `${shownProperties.length} propert${shownProperties.length !== 1 ? "ies" : "y"} matched`
                      : "Properties appear as you chat"}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                  {shownProperties.length === 0 ? (
                    <div style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      height: "200px", textAlign: "center", padding: 20
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>🏡</div>
                      <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>
                        Matched properties will appear here as Alex gets to know you.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {shownProperties.map((p, i) => (
                        <SidebarCard
                          key={p.id}
                          property={p}
                          matchScore={p.matchScore}
                          reason={p.reason}
                          isTop={i === 0}
                          isFavourited={isFavourited(p.id)}
                          onFavourite={() => toggleFavourite(p)}
                          onShare={setSharingListing}
                          onClick={() => setSelectedProperty(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {shownProperties.length > 0 && (
                  <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 12, color: T.textSub, textAlign: "center" }}>
                      Click any property to view details
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {activeNav === "account" && (
          <div style={{ position: "fixed", top: 0, left: T.sidebarW, right: 0, bottom: 0, background: T.bg, zIndex: 100, overflowY: "auto" }}>
            {user ? (
              <ProfilePanel user={user} profile={profile} onUpdate={setProfile} favourites={favourites} viewings={viewings} onSignOut={async () => { await auth.signOut(); setActiveNav("chat"); setUserPrefs(null); }} onEditPrefs={() => setShowOnboarding(true)} onNavigate={setActiveNav} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ fontSize: 36 }}>👤</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>Sign in to view your account</div>
                <button onClick={() => setShowAuthModal(true)} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #c9a84c, #8b6520)", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Sign in</button>
              </div>
            )}
          </div>
        )}
        {activeNav === "flatmates" && (
          <FlatmatesPanel userPrefs={userPrefs} user={user} onConnect={(flatmate) => addConversation(flatmate, "flatmate")} userConvsCount={directConversations.filter(c => c.type === "flatmate").length} />
        )}
        {activeNav === "messages" && (
          <MessagesPanel
            conversations={directConversations}
            onSend={sendDirectMessage}
            onMarkRead={markConvRead}
          />
        )}
        {activeNav === "shorts" && (
          <ListingsShortsPanel
            userListings={userListings}
            onAddListing={addUserListing}
            isFavourited={isFavourited}
            onFavourite={toggleFavourite}
            onSelect={(p) => { setSelectedProperty(p); setActiveNav("chat"); }}
            onShare={setSharingListing}
            userPrefs={userPrefs}
            favourites={favourites}
            sharedListings={sharedListings}
            user={user}
            profile={profile}
          />
        )}
        {activeNav === "favourites" && (
          <div style={{ position: "fixed", top: 0, left: T.sidebarW, right: 0, bottom: 0, background: T.bg, zIndex: 100, overflowY: "auto" }}>
            {!user ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ fontSize: 36 }}>🔐</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>Sign in to save favourites</div>
                <button onClick={() => setShowAuthModal(true)} style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #c9a84c, #8b6520)", color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Sign in</button>
              </div>
            ) : (
              <FavouritesPanel
                favourites={favourites}
                viewings={viewings}
                onSelect={(p) => { setSelectedProperty(p); setActiveNav("chat"); }}
                onRemove={async (id) => { await db.removeFavourite(user.id, id); setFavourites(await db.getFavourites(user.id)); }}
                onCancelViewing={async (id) => { await db.updateViewingStatus(id, "cancelled"); setViewings(await db.getViewings(user.id)); }}
                onDeleteViewing={async (id) => { await db.deleteViewing(id); setViewings(await db.getViewings(user.id)); }}
                onConfirmViewing={async (id) => { await db.updateViewingStatus(id, "confirmed"); setViewings(await db.getViewings(user.id)); }}
              />
            )}
          </div>
        )}
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />}
        {showPathChooser && user && (
          <PathChooser
            userName={profile?.full_name?.split(" ")[0] || ""}
            onQuestionnaire={() => { setShowPathChooser(false); setShowOnboarding(true); }}
            onAlex={() => { setShowPathChooser(false); startChat(userPrefs, true); }}
          />
        )}
        {showOnboarding && user && <OnboardingForm user={user}
          initialPrefs={userPrefs}
          onComplete={(prefs) => {
            const isFirstTime = !userPrefs;
            setUserPrefs(prefs);
            setShowOnboarding(false);
            if (isFirstTime) { setActiveNav("chat"); startChat(prefs, false); }
          }}
          onSkip={() => setShowOnboarding(false)} />}
        {profileToast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1410", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontFamily: "'DM Sans', sans-serif", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease" }}>
            <span style={{ color: "#c9a84c" }}>✓</span> Profile updated by Alex
          </div>
        )}
        {swipeMode && (
          <SwipeMode
            listings={activeNav === "properties" ? browseListings : shownProperties}
            startIndex={swipeStartIndex}
            onClose={() => setSwipeMode(false)}
            isFavourited={isFavourited}
            onFavourite={toggleFavourite}
            userPrefs={userPrefs}
          />
        )}
        {!swipeMode && selectedProperty && <PropertyModal property={selectedProperty} onClose={() => setSelectedProperty(null)} userPrefs={userPrefs} isFavourited={isFavourited(selectedProperty?.id)} onFavourite={() => toggleFavourite(selectedProperty)} profile={profile} user={user} onSwipe={() => { const list = activeNav === "properties" ? browseListings : shownProperties; const si = list.findIndex(p => p.id === selectedProperty.id); setSwipeStartIndex(Math.max(0, si)); setSwipeMode(true); setSelectedProperty(null); }} onViewingRequest={(property) => addConversation(property, "landlord")} onShare={setSharingListing} />}
        {sharingListing && (() => {
          const connectionIds = loadConnections(user?.id);
          const flatmateConnections = DUMMY_FLATMATES.filter(f => connectionIds.has(f.id));
          return (
            <ShareSheet
              listing={sharingListing}
              conversations={directConversations}
              connections={flatmateConnections}
              onSendTo={shareListingToConv}
              onStartWith={startConversationWithListing}
              onClose={() => setSharingListing(null)}
            />
          );
        })()}

        {/* ── Landlord Dashboard overlay ── */}
        {landlordMode && (
          <LandlordDashboard
            userListings={userListings}
            onAddListing={addUserListing}
            onUpdateListing={updateUserListing}
            onRemoveListing={removeUserListing}
            user={user}
            profile={profile}
          />
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
