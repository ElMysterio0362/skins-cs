// Rótulos em pt-BR e cores oficiais de raridade do inventário do CS2.

export const TIERS = [
  { id: 'consumer', label: 'Consumidor', en: 'Consumer', color: '#b0c3d9', hint: 'branco' },
  { id: 'industrial', label: 'Industrial', en: 'Industrial', color: '#5e98d9', hint: 'azul-claro' },
  { id: 'milspec', label: 'Militar', en: 'Mil-Spec', color: '#4b69ff', hint: 'azul' },
  { id: 'restricted', label: 'Restrita', en: 'Restricted', color: '#8847ff', hint: 'roxo' },
  { id: 'classified', label: 'Secreta', en: 'Classified', color: '#d32ce6', hint: 'rosa' },
  { id: 'covert', label: 'Oculta', en: 'Covert', color: '#eb4b4b', hint: 'vermelho' },
  { id: 'extraordinary', label: 'Extraordinária / Contrabando', short: 'Extraordinária', en: 'Extraordinary / Contraband', color: '#e4ae39', hint: 'dourado — facas e luvas' },
];
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t, i) => [t.id, { ...t, rank: i }]));
export const UNKNOWN_TIER = { id: 'unknown', label: 'Desconhecida', en: '?', color: '#8a94a6', hint: '', rank: -1 };
export const tierInfo = (id) => TIER_BY_ID[id] || UNKNOWN_TIER;

// Rótulo curto para cards/selos; o único item de contrabando aparece como tal.
export function tierShortLabel(skin) {
  if (skin.rarity === 'Contraband') return 'Contrabando';
  const t = tierInfo(skin.tier);
  return t.short || t.label;
}

export const CATEGORIES = [
  { id: 'knives', label: 'Facas' },
  { id: 'gloves', label: 'Luvas' },
  { id: 'rifles', label: 'Rifles' },
  { id: 'pistols', label: 'Pistolas' },
  { id: 'smgs', label: 'SMGs' },
  { id: 'shotguns', label: 'Escopetas' },
  { id: 'machineguns', label: 'Metralhadoras' },
  { id: 'equipment', label: 'Equipamento' },
  { id: 'heavy', label: 'Pesadas' },
  { id: 'other', label: 'Outros' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export const WEARS = [
  { id: 'FN', label: 'Nova de Fábrica', en: 'Factory New' },
  { id: 'MW', label: 'Pouco Usada', en: 'Minimal Wear' },
  { id: 'FT', label: 'Testada em Campo', en: 'Field-Tested' },
  { id: 'WW', label: 'Bem Desgastada', en: 'Well-Worn' },
  { id: 'BS', label: 'Veterana de Guerra', en: 'Battle-Scarred' },
];
export const WEAR_BY_ID = Object.fromEntries(WEARS.map((w) => [w.id, w]));
