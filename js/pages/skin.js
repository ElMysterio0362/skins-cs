import { escapeHtml } from '../lib/dom.js';
import { tierInfo, tierShortLabel, CATEGORY_LABEL, WEARS } from '../data/labels.js';
import { FAMILY_BY_ID } from '../data/colorAlgo.js';
import { getColor, requestColors, onColor, isFailed } from '../data/colors.js';
import { buildHash } from '../router.js';
import { setPageMeta } from '../ui/seo.js';
import { renderNotFound } from './static.js';

const fmtFloat = (v) => (v == null ? '—' : v.toFixed(2));

function colorHtml(s) {
  const c = getColor(s.id);
  if (!c) {
    return isFailed(s.id)
      ? '<span class="muted">Não foi possível analisar a imagem (sem acesso ao pixel por CORS ou imagem indisponível).</span>'
      : '<span class="muted"><span class="spinner" aria-hidden="true"></span> Analisando…</span>';
  }
  return `<div class="swatches">
    <span class="swatch"><i style="background:${escapeHtml(c.hex)}"></i> ${escapeHtml(c.hex)}</span>
    ${c.families.map(([id, share]) => `<a class="swatch" href="${buildHash('/catalogo', { c: id })}"><i style="background:${FAMILY_BY_ID[id]?.swatch}"></i>${escapeHtml(FAMILY_BY_ID[id]?.label || id)} ${Math.round(share * 100)}%</a>`).join('')}
  </div>`;
}

export function renderSkin(main, catalog, id) {
  const s = catalog.byId.get(id);
  if (!s) return renderNotFound(main, 'Skin não encontrada. Ela pode ter saído do catálogo ou o link está incorreto.');
  const t = tierInfo(s.tier);
  setPageMeta({
    title: s.name + (s.phase ? ` (${s.phase})` : ''),
    description: `${s.name}: raridade ${t.label}, ${CATEGORY_LABEL[s.cat] || ''}. ${s.collections.map((c) => c.name).join(', ')}`.trim(),
    image: s.image,
  });
  requestColors([s], { priority: true });

  const wears = s.wears.length
    ? WEARS.filter((w) => s.wears.includes(w.id)).map((w) => `<span class="tag" title="${w.en}">${w.label}</span>`).join(' ')
    : '<span class="muted">Sem desgaste (versão padrão/Vanilla)</span>';

  main.innerHTML = `
    <nav class="breadcrumb" aria-label="Trilha"><a href="#/">Início</a> › <a href="#/catalogo">Catálogo</a> ›
      <a href="${buildHash('/catalogo', { cat: s.cat })}">${escapeHtml(CATEGORY_LABEL[s.cat] || '')}</a> ›
      <a href="${buildHash('/catalogo', { w: s.weapon.id })}">${escapeHtml(s.weapon.name)}</a></nav>
    <article class="detail" style="--rc:${t.color}">
      <div class="detail-media"><img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.name)}" width="512" height="384"></div>
      <div>
        <h1>${escapeHtml(s.name)}</h1>
        ${s.phase ? `<p class="muted">${escapeHtml(s.phase)}</p>` : ''}
        <span class="tag tag-rarity" style="--rc:${t.color}">${escapeHtml(tierShortLabel(s))}</span>
        ${s.st ? '<span class="tag tag-st">StatTrak™ disponível</span>' : ''}
        ${s.sv ? '<span class="tag tag-sv">Lembrança disponível</span>' : ''}
        <dl class="props">
          <dt>Categoria</dt><dd>${escapeHtml(CATEGORY_LABEL[s.cat] || '—')}</dd>
          <dt>Arma</dt><dd>${escapeHtml(s.weapon.name || '—')}</dd>
          <dt>Coleção</dt><dd>${s.collections.length ? s.collections.map((c) => `<a href="${buildHash('/catalogo', { col: c.id })}">${escapeHtml(c.name)}</a>`).join(', ') : '<span class="muted">—</span>'}</dd>
          <dt>Caixas</dt><dd>${s.crates.length ? escapeHtml(s.crates.slice(0, 6).join(', ')) + (s.crates.length > 6 ? ` e mais ${s.crates.length - 6}` : '') : '<span class="muted">—</span>'}</dd>
          <dt>Float</dt><dd>${fmtFloat(s.minFloat)} – ${fmtFloat(s.maxFloat)}</dd>
          <dt>Desgastes</dt><dd>${wears}</dd>
          <dt>Equipe</dt><dd>${escapeHtml(s.team || '—')}</dd>
          <dt>Cor da skin</dt><dd id="skin-color">${colorHtml(s)}</dd>
        </dl>
        ${s.desc ? `<p class="desc">${escapeHtml(s.desc)}</p>` : ''}
        ${s.notes.map((n) => `<div class="banner banner-warn">${escapeHtml(n)}</div>`).join('')}
        <div class="banner" role="note">Comparação de preços entre lojas: disponível numa próxima fase. Nenhum preço é exibido ainda.</div>
      </div>
    </article>`;

  const off = onColor((cid) => {
    if (cid === s.id) {
      const el = main.querySelector('#skin-color');
      if (el) el.innerHTML = colorHtml(s);
    }
  });
  return { destroy: off };
}

