import { escapeHtml } from '../lib/dom.js';
import { tierInfo, tierShortLabel, CATEGORY_LABEL } from '../data/labels.js';
import { getColor, isFailed } from '../data/colors.js';
import { FAMILY_BY_ID } from '../data/colorAlgo.js';

export function colorDotHtml(id) {
  const c = getColor(id);
  if (c) {
    const fam = FAMILY_BY_ID[c.families[0][0]];
    return `<span class="color-dot" style="background:${escapeHtml(c.hex)}" title="Cor dominante: ${escapeHtml(fam?.label || '')}" data-color-dot="${escapeHtml(id)}"></span>`;
  }
  const title = isFailed(id) ? 'Cor não analisada (imagem indisponível)' : 'Cor ainda não analisada';
  return `<span class="color-dot pending" title="${title}" data-color-dot="${escapeHtml(id)}"></span>`;
}

export function skinCardHtml(s) {
  const t = tierInfo(s.tier);
  const [weapon, ...rest] = s.name.split(' | ');
  const finish = rest.join(' | ') || 'Vanilla';
  const tags = [
    `<span class="tag tag-rarity" title="${escapeHtml(t.label)}">${escapeHtml(tierShortLabel(s))}</span>`,
    s.phase ? `<span class="tag">${escapeHtml(s.phase)}</span>` : '',
    s.st ? '<span class="tag tag-st" title="Disponível em StatTrak™">ST</span>' : '',
    s.sv ? '<span class="tag tag-sv" title="Disponível em Lembrança (Souvenir)">SV</span>' : '',
  ].join('');
  return `<a class="card" href="#/skin/${encodeURIComponent(s.id)}" style="--rc:${t.color}" data-id="${escapeHtml(s.id)}">
    <div class="card-media">
      <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.name)}${s.phase ? ' (' + escapeHtml(s.phase) + ')' : ''}" loading="lazy" decoding="async" width="256" height="192">
    </div>
    <div class="card-body">
      <span class="card-weapon">${escapeHtml(weapon)} · ${escapeHtml(CATEGORY_LABEL[s.cat] || '')}</span>
      <span class="card-name">${escapeHtml(finish)}</span>
      <div class="card-meta">${tags}${colorDotHtml(s.id)}</div>
    </div>
  </a>`;
}
