// Normaliza um item bruto do dataset ByMykel/CSGO-API para o formato enxuto usado no site.
// Módulo sem dependência de DOM: é usado no navegador e no script de build (Node).

export const WEAR_IDS = {
  SFUI_InvTooltip_Wear_Amount_0: 'FN',
  SFUI_InvTooltip_Wear_Amount_1: 'MW',
  SFUI_InvTooltip_Wear_Amount_2: 'FT',
  SFUI_InvTooltip_Wear_Amount_3: 'WW',
  SFUI_InvTooltip_Wear_Amount_4: 'BS',
};

const WEAR_BY_NAME = {
  'Factory New': 'FN', 'Minimal Wear': 'MW', 'Field-Tested': 'FT', 'Well-Worn': 'WW', 'Battle-Scarred': 'BS',
};

const SHOTGUNS = new Set(['weapon_nova', 'weapon_xm1014', 'weapon_mag7', 'weapon_sawedoff']);
const MACHINE_GUNS = new Set(['weapon_negev', 'weapon_m249']);

const RARITY_TO_TIER = {
  rarity_common_weapon: 'consumer',
  rarity_uncommon_weapon: 'industrial',
  rarity_rare_weapon: 'milspec',
  rarity_mythical_weapon: 'restricted',
  rarity_legendary_weapon: 'classified',
  rarity_ancient_weapon: 'covert',
  rarity_ancient: 'extraordinary',
  rarity_contraband_weapon: 'extraordinary',
  rarity_contraband: 'extraordinary',
};

export function categoryOf(raw) {
  const id = raw?.category?.id || '';
  const weaponId = raw?.weapon?.id || '';
  if (id.includes('gloves')) return 'gloves';
  if (id.includes('melee')) return 'knives';
  if (id.includes('rifles')) return 'rifles';
  if (id.includes('smgs')) return 'smgs';
  if (id.includes('pistols')) return 'pistols';
  if (id.includes('heavy')) {
    if (SHOTGUNS.has(weaponId)) return 'shotguns';
    if (MACHINE_GUNS.has(weaponId)) return 'machineguns';
    return 'heavy';
  }
  if (id.includes('equipment')) return 'equipment';
  return 'other';
}

// Facas e luvas aparecem em dourado no inventário (★), mesmo quando o dataset
// as marca como "Covert". Por isso a categoria tem prioridade sobre a raridade.
export function tierOf(raw, cat) {
  if (cat === 'knives' || cat === 'gloves') return 'extraordinary';
  return RARITY_TO_TIER[raw?.rarity?.id] || 'unknown';
}

function cleanText(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wearCode(w) {
  return WEAR_IDS[w?.id] || WEAR_BY_NAME[w?.name] || null;
}

export function normalizeSkin(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) return null;
  const cat = categoryOf(raw);
  const wears = Array.isArray(raw.wears) ? raw.wears.map(wearCode).filter(Boolean) : [];
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    id: String(raw.id),
    name: String(raw.name),
    weapon: { id: raw.weapon?.id || '', name: raw.weapon?.name || '' },
    cat,
    pattern: raw.pattern?.name || '',
    phase: raw.phase || '',
    minFloat: num(raw.min_float),
    maxFloat: num(raw.max_float),
    rarity: raw.rarity?.name || '',
    tier: tierOf(raw, cat),
    st: raw.stattrak === true,
    sv: raw.souvenir === true,
    wears,
    collections: Array.isArray(raw.collections)
      ? raw.collections.filter((c) => c && c.id).map((c) => ({ id: c.id, name: c.name || c.id }))
      : [],
    crates: Array.isArray(raw.crates) ? raw.crates.map((c) => c?.name).filter(Boolean) : [],
    image: typeof raw.image === 'string' ? raw.image : '',
    desc: cleanText(raw.description),
    team: raw.team?.name || '',
    legacy: raw.legacy_model === true,
    notes: Array.isArray(raw.special_notes) ? raw.special_notes.map((n) => cleanText(n?.text)).filter(Boolean) : [],
  };
}

export function normalizeCatalog(rawList) {
  if (!Array.isArray(rawList)) throw new Error('Formato inesperado: o catálogo deveria ser uma lista.');
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    const s = normalizeSkin(raw);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}
