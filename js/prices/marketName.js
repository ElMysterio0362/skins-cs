// Monta o "market_hash_name" usado pela Steam e pela maioria dos marketplaces.
// Ex.: "StatTrak™ AK-47 | Redline (Field-Tested)", "★ StatTrak™ Karambit | Doppler (Factory New)".
import { WEAR_BY_ID } from '../data/labels.js';

export function marketHashName(skin, { wear = null, st = false, sv = false } = {}) {
  let name = skin.name;
  const star = name.startsWith('★ ');
  if (star) name = name.slice(2);
  let prefix = '';
  if (st) prefix = 'StatTrak™ ';
  else if (sv) prefix = 'Souvenir ';
  const wearEn = wear && WEAR_BY_ID[wear] ? ` (${WEAR_BY_ID[wear].en})` : '';
  return `${star ? '★ ' : ''}${prefix}${name}${wearEn}`;
}

// Todas as variantes possíveis de uma skin (desgaste × StatTrak/Lembrança).
export function variantsOf(skin) {
  const wears = skin.wears.length ? skin.wears : [null];
  const kinds = [{ st: false, sv: false }];
  if (skin.st) kinds.push({ st: true, sv: false });
  if (skin.sv) kinds.push({ st: false, sv: true });
  const out = [];
  for (const k of kinds) for (const wear of wears) out.push({ wear, ...k, name: marketHashName(skin, { wear, ...k }) });
  return out;
}
