// Classificação de cor dominante a partir de pixels RGBA.
// Função pura (sem DOM) para poder ser testada no Node.

export const COLOR_FAMILIES = [
  { id: 'vermelho', label: 'Vermelho', swatch: '#d33a3a' },
  { id: 'laranja', label: 'Laranja', swatch: '#e9822c' },
  { id: 'dourado', label: 'Amarelo / Dourado', swatch: '#e2bb38' },
  { id: 'marrom', label: 'Marrom', swatch: '#8a5a33' },
  { id: 'verde', label: 'Verde', swatch: '#3fae4f' },
  { id: 'ciano', label: 'Ciano / Turquesa', swatch: '#2bbfc4' },
  { id: 'azul', label: 'Azul', swatch: '#3a6fe0' },
  { id: 'roxo', label: 'Roxo', swatch: '#8a4fe0' },
  { id: 'rosa', label: 'Rosa', swatch: '#e04fb0' },
  { id: 'preto', label: 'Preto', swatch: '#151515' },
  { id: 'cinza', label: 'Cinza', swatch: '#8d939c' },
  { id: 'branco', label: 'Branco', swatch: '#f2f2f2' },
];
export const FAMILY_BY_ID = Object.fromEntries(COLOR_FAMILIES.map((f) => [f.id, f]));

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function familyOf(h, s, l) {
  if (l < 0.12) return 'preto';
  if (l > 0.9 && s < 0.5) return 'branco';
  if (s < 0.16 || (s < 0.25 && (l < 0.2 || l > 0.8))) {
    if (l < 0.25) return 'preto';
    if (l > 0.75) return 'branco';
    return 'cinza';
  }
  // Tons terrosos: matiz laranja/amarelo com pouca luz ou pouca saturação.
  if (h >= 15 && h < 50 && (l < 0.33 || (s < 0.4 && l < 0.55))) return 'marrom';
  if (h < 12 || h >= 345) return 'vermelho';
  if (h < 38) return 'laranja';
  if (h < 68) return 'dourado';
  if (h < 165) return 'verde';
  if (h < 197) return 'ciano';
  if (h < 252) return 'azul';
  if (h < 290) return 'roxo';
  return 'rosa';
}

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// data: Uint8ClampedArray RGBA. Retorna { hex, families: [[id, share], ...] } ou null.
// Pixels cromáticos pesam mais que cinzas, porque o metal neutro da arma
// costuma ocupar muita área sem ser a "cor da skin".
export function analyzePixels(data) {
  const acc = {};
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    const fam = familyOf(h, s, l);
    const neutral = fam === 'preto' || fam === 'cinza' || fam === 'branco';
    const w = neutral ? 0.6 : 1 + Math.min(s, 1) * 0.5;
    const e = acc[fam] || (acc[fam] = { w: 0, r: 0, g: 0, b: 0 });
    e.w += w; e.r += r * w; e.g += g * w; e.b += b * w;
    total += w;
  }
  if (!total) return null;
  const ranked = Object.entries(acc).sort((x, y) => y[1].w - x[1].w);
  const [, top] = ranked[0];
  const families = ranked
    .map(([id, e]) => [id, Math.round((e.w / total) * 100) / 100])
    .filter(([, share], i) => i === 0 || share >= 0.08)
    .slice(0, 3);
  return { hex: toHex(top.r / top.w, top.g / top.w, top.b / top.w), families };
}

// Critério do filtro: a cor é a principal ou uma secundária forte (>= 25%).
export function matchesFamily(result, famIds, primaryOnly = false) {
  if (!result?.families?.length) return false;
  if (primaryOnly) return famIds.includes(result.families[0][0]);
  return result.families.some(([id, share], i) => famIds.includes(id) && (i === 0 || share >= 0.25));
}
