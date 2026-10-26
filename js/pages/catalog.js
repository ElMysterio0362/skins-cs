import { escapeHtml, fold, debounce, $, $$ } from '../lib/dom.js';
import { buildHash, replaceQuietly } from '../router.js';
import { TIERS, CATEGORIES, WEARS, CATEGORY_LABEL, tierInfo } from '../data/labels.js';
import { COLOR_FAMILIES, FAMILY_BY_ID, matchesFamily } from '../data/colorAlgo.js';
import { getColor, requestColors, onColor, stats as colorStats, cancelBackground, clearColors, resumeColors } from '../data/colors.js';
import { getPref, setPref } from '../lib/prefs.js';
import { skinCardHtml, colorDotHtml } from '../ui/skinCard.js';
import { setPageMeta } from '../ui/seo.js';

const PAGE_SIZE = 48;

const SORTS = [
  { id: 'name', label: 'Nome (A–Z)' },
  { id: 'name-desc', label: 'Nome (Z–A)' },
  { id: 'rarity', label: 'Raridade (maior primeiro)' },
  { id: 'rarity-asc', label: 'Raridade (menor primeiro)' },
  { id: 'weapon', label: 'Arma' },
];

const list = (v) => (v ? v.split(',').filter(Boolean) : []);

export function readFilters(query) {
  return {
    q: query.get('q') || '',
    r: list(query.get('r')),
    cat: list(query.get('cat')),
    w: query.get('w') || '',
    col: query.get('col') || '',
    wear: list(query.get('wear')),
    st: query.get('st') === '1',
    sv: query.get('sv') === '1',
    c: list(query.get('c')),
    cp: query.get('cp') === '1',
    sort: SORTS.some((s) => s.id === query.get('sort')) ? query.get('sort') : 'name',
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };
}

function filtersToHash(f) {
  return buildHash('/catalogo', {
    q: f.q, r: f.r, cat: f.cat, w: f.w, col: f.col, wear: f.wear,
    st: f.st, sv: f.sv, c: f.c, cp: f.cp,
    sort: f.sort !== 'name' ? f.sort : '', p: f.p > 1 ? f.p : '',
  });
}

// skip: nome da faceta a ignorar (para calcular contagens dos chips).
export function applyFilters(skins, f, skip = '') {
  const tokens = fold(f.q).split(/\s+/).filter(Boolean);
  return skins.filter((s) => {
    if (tokens.length && !tokens.every((t) => s._search.includes(t))) return false;
    if (skip !== 'r' && f.r.length && !f.r.includes(s.tier)) return false;
    if (f.cat.length && !f.cat.includes(s.cat)) return false;
    if (f.w && s.weapon.id !== f.w) return false;
    if (f.col && !s.collections.some((c) => c.id === f.col)) return false;
    if (f.wear.length && !f.wear.some((w) => s.wears.includes(w))) return false;
    if (f.st && !s.st) return false;
    if (f.sv && !s.sv) return false;
    if (skip !== 'c' && f.c.length && !matchesFamily(getColor(s.id), f.c, f.cp)) return false;
    return true;
  });
}

function sortSkins(arr, sort) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.phase || '').localeCompare(b.phase || '');
  const cmp = {
    name: byName,
    'name-desc': (a, b) => byName(b, a),
    rarity: (a, b) => b._rank - a._rank || byName(a, b),
    'rarity-asc': (a, b) => a._rank - b._rank || byName(a, b),
    weapon: (a, b) => a.weapon.name.localeCompare(b.weapon.name, 'pt-BR') || byName(a, b),
  }[sort];
  return arr.slice().sort(cmp);
}

function chip({ id, label, color, pressed, group, title }) {
  return `<button type="button" class="chip" data-group="${group}" data-value="${escapeHtml(id)}" aria-pressed="${pressed}" style="--c:${color}"${title ? ` title="${escapeHtml(title)}"` : ''}>
    <span class="dot" aria-hidden="true"></span>${escapeHtml(label)} <span class="count" data-count></span></button>`;
}

export function renderCatalogPage(main, catalog, query) {
  const f = readFilters(query);
  const all = catalog.skins;

  setPageMeta({
    title: 'Catálogo',
    description: `Catálogo com ${all.length} skins de CS2: filtre por raridade (cor do inventário), cor da skin, arma, coleção, desgaste e StatTrak.`,
  });

  const weaponOptions = () => catalog.weapons
    .filter((w) => !f.cat.length || f.cat.includes(w.cat))
    .map((w) => `<option value="${escapeHtml(w.id)}"${w.id === f.w ? ' selected' : ''}>${escapeHtml(w.name)}</option>`).join('');

  main.innerHTML = `
    <h1>Catálogo de skins</h1>
    <p class="muted">Dados do dataset público ByMykel/CSGO-API. Preços e comparação entre lojas chegam numa próxima fase.</p>
    <div class="catalog-layout">
      <aside class="filters" id="filters" aria-label="Filtros">
        <div class="filters-head">
          <h2>Filtros</h2>
          <button type="button" class="btn btn-sm btn-ghost" id="f-clear">Limpar tudo</button>
        </div>

        <div class="field">
          <label class="label" for="f-q">Busca por texto</label>
          <input id="f-q" class="input" type="search" placeholder="ex.: asiimov, ak-47, dragon" value="${escapeHtml(f.q)}">
        </div>

        <fieldset>
          <legend>Raridade (cor do inventário)</legend>
          <div class="chips" id="f-r" role="group" aria-label="Raridade (cor do inventário)">
            ${TIERS.map((t) => chip({ id: t.id, label: t.label, color: t.color, pressed: f.r.includes(t.id), group: 'r', title: `${t.en} — ${t.hint}` })).join('')}
          </div>
        </fieldset>

        <fieldset>
          <legend>Cor da skin</legend>
          <div class="chips" id="f-c" role="group" aria-label="Cor da skin (cor dominante da imagem)">
            ${COLOR_FAMILIES.map((c) => chip({ id: c.id, label: c.label, color: c.swatch, pressed: f.c.includes(c.id), group: 'c' })).join('')}
          </div>
          <label class="check small"><input type="checkbox" id="f-cp"${f.cp ? ' checked' : ''}> Somente cor principal</label>
          <div class="color-progress" id="color-progress" aria-live="polite"></div>
        </fieldset>

        <fieldset>
          <legend>Categoria</legend>
          ${CATEGORIES.filter((c) => all.some((s) => s.cat === c.id)).map((c) => `
            <label class="check"><input type="checkbox" name="cat" value="${c.id}"${f.cat.includes(c.id) ? ' checked' : ''}> ${c.label} <span class="muted small" data-cat-count="${c.id}"></span></label>`).join('')}
        </fieldset>

        <div class="field">
          <label class="label" for="f-w">Arma</label>
          <select id="f-w" class="select"><option value="">Todas</option>${weaponOptions()}</select>
        </div>

        <div class="field">
          <label class="label" for="f-col">Coleção</label>
          <select id="f-col" class="select"><option value="">Todas</option>
            ${catalog.collections.map((c) => `<option value="${escapeHtml(c.id)}"${c.id === f.col ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>

        <fieldset>
          <legend>Desgaste disponível</legend>
          ${WEARS.map((w) => `<label class="check"><input type="checkbox" name="wear" value="${w.id}"${f.wear.includes(w.id) ? ' checked' : ''}> ${w.label} <span class="muted small">(${w.en})</span></label>`).join('')}
        </fieldset>

        <fieldset>
          <legend>Variantes</legend>
          <label class="check"><input type="checkbox" id="f-st"${f.st ? ' checked' : ''}> Disponível em StatTrak™</label>
          <label class="check"><input type="checkbox" id="f-sv"${f.sv ? ' checked' : ''}> Disponível em Lembrança (Souvenir)</label>
        </fieldset>
      </aside>

      <section aria-labelledby="results-title">
        <h2 id="results-title" class="sr-only">Resultados</h2>
        <div class="results-bar">
          <button type="button" class="btn btn-sm filters-toggle" aria-controls="filters" aria-expanded="false">Filtros</button>
          <span class="count" id="r-count" aria-live="polite"></span>
          <div class="sort">
            <label for="f-sort" class="muted small">Ordenar por</label>
            <select id="f-sort" class="select">
              ${SORTS.map((s) => `<option value="${s.id}"${s.id === f.sort ? ' selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="active-filters" id="active-filters"></div>
        <div id="color-note"></div>
        <div class="grid" id="grid"></div>
        <nav class="pagination" id="pagination" aria-label="Paginação"></nav>
      </section>
    </div>`;

  const grid = $('#grid', main);
  let lastFiltered = [];
  let observer = null;

  const syncUrl = () => replaceQuietly(filtersToHash(f));

  function renderCounts() {
    const forTier = applyFilters(all, f, 'r');
    const tierCounts = {};
    for (const s of forTier) tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1;
    $$('#f-r .chip', main).forEach((b) => { $('[data-count]', b).textContent = tierCounts[b.dataset.value] || 0; });

    const forColor = applyFilters(all, f, 'c');
    const colorCounts = {};
    for (const s of forColor) {
      const res = getColor(s.id);
      if (!res) continue;
      for (const fam of COLOR_FAMILIES) if (matchesFamily(res, [fam.id], f.cp)) colorCounts[fam.id] = (colorCounts[fam.id] || 0) + 1;
    }
    $$('#f-c .chip', main).forEach((b) => { $('[data-count]', b).textContent = colorCounts[b.dataset.value] || 0; });
    renderColorProgress(forColor);
  }

  function renderColorProgress(scope) {
    const st = colorStats(all);
    const pct = st.total ? Math.round(((st.done + st.failed) / st.total) * 100) : 0;
    const auto = getPref('autoColors') && !st.stalled;
    $('#color-progress', main).innerHTML = `
      Cores analisadas: <b>${st.done}</b> de ${st.total}${st.failed ? ` · ${st.failed} sem imagem acessível` : ''}
      ${st.stalled ? '<div class="banner banner-warn small" role="status" style="margin:6px 0">Análise pausada: as imagens não puderam ser lidas (offline ou CDN sem CORS). Rode o site com <code>node server.mjs</code> para usar o proxy local, ou tente mais tarde.</div>' : ''}
      <div class="progress" role="progressbar" aria-label="Progresso da análise de cores" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button type="button" class="btn btn-sm" id="c-run">${auto ? 'Pausar análise' : 'Analisar cores'}</button>
        <button type="button" class="btn btn-sm btn-ghost" id="c-reset" title="Apaga as cores salvas e analisa de novo">Refazer</button>
      </div>`;
    const note = $('#color-note', main);
    if (f.c.length) {
      const unknown = scope.filter((s) => !getColor(s.id)).length;
      note.innerHTML = unknown
        ? `<div class="banner banner-warn" role="status">Filtro por cor: ${unknown} skins deste recorte ainda não têm cor analisada e ficam de fora até a análise terminar.</div>`
        : '';
    } else note.innerHTML = '';
  }

  function renderActive() {
    const items = [];
    if (f.q) items.push(['q', '', `“${f.q}”`]);
    f.r.forEach((id) => items.push(['r', id, tierInfo(id).label]));
    f.c.forEach((id) => items.push(['c', id, 'Cor: ' + (FAMILY_BY_ID[id]?.label || id)]));
    f.cat.forEach((id) => items.push(['cat', id, CATEGORY_LABEL[id] || id]));
    if (f.w) items.push(['w', '', catalog.weapons.find((w) => w.id === f.w)?.name || f.w]);
    if (f.col) items.push(['col', '', catalog.collections.find((c) => c.id === f.col)?.name || f.col]);
    f.wear.forEach((id) => items.push(['wear', id, WEARS.find((w) => w.id === id)?.label || id]));
    if (f.st) items.push(['st', '', 'StatTrak™']);
    if (f.sv) items.push(['sv', '', 'Lembrança']);
    $('#active-filters', main).innerHTML = items.map(([k, v, label]) =>
      `<button type="button" class="chip" data-remove="${k}" data-value="${escapeHtml(v)}" aria-label="Remover filtro ${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('');
  }

  function renderResults({ keepPage = true } = {}) {
    if (!keepPage) f.p = 1;
    lastFiltered = sortSkins(applyFilters(all, f), f.sort);
    const pages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    if (f.p > pages) f.p = pages;
    const slice = lastFiltered.slice((f.p - 1) * PAGE_SIZE, f.p * PAGE_SIZE);
    $('#r-count', main).textContent = `${lastFiltered.length} ${lastFiltered.length === 1 ? 'skin' : 'skins'}`;

    grid.innerHTML = slice.length
      ? slice.map(skinCardHtml).join('')
      : `<div class="state" style="grid-column:1/-1"><h2>Nenhuma skin encontrada</h2><p>Tente remover alguns filtros.</p>
         <button type="button" class="btn" data-action="clear">Limpar filtros</button></div>`;

    renderPagination(pages);
    renderActive();
    renderCounts();
    syncUrl();
    queueColors(slice);
  }

  function renderPagination(pages) {
    const nav = $('#pagination', main);
    if (pages <= 1) { nav.innerHTML = ''; return; }
    const nums = new Set([1, pages, f.p, f.p - 1, f.p + 1, f.p - 2, f.p + 2].filter((n) => n >= 1 && n <= pages));
    const sorted = [...nums].sort((a, b) => a - b);
    let html = `<button type="button" class="btn btn-sm" data-page="${f.p - 1}"${f.p === 1 ? ' disabled' : ''} aria-label="Página anterior">‹</button>`;
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) html += '<span class="muted" aria-hidden="true">…</span>';
      html += `<button type="button" class="btn btn-sm" data-page="${n}"${n === f.p ? ' aria-current="page"' : ''} aria-label="Página ${n}">${n}</button>`;
      prev = n;
    }
    html += `<button type="button" class="btn btn-sm" data-page="${f.p + 1}"${f.p === pages ? ' disabled' : ''} aria-label="Próxima página">›</button>`;
    nav.innerHTML = html;
  }

  // Cores: cards visíveis primeiro; o resto do catálogo em segundo plano (se ativado).
  function queueColors(slice) {
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        const vis = entries.filter((e) => e.isIntersecting).map((e) => catalog.byId.get(e.target.dataset.id)).filter(Boolean);
        if (vis.length) requestColors(vis, { priority: true });
      }, { rootMargin: '200px' });
      $$('.card', grid).forEach((c) => observer.observe(c));
    } else {
      requestColors(slice, { priority: true });
    }
    if (getPref('autoColors')) requestColors(f.c.length ? applyFilters(all, f, 'c') : all);
  }

  let destroyed = false;
  const refreshAfterColors = debounce(() => {
    if (destroyed) return;
    if (f.c.length) renderResults();
    else renderCounts();
  }, 600);

  const offColor = onColor((id) => {
    if (id) {
      const dot = grid.querySelector(`[data-color-dot="${CSS.escape(id)}"]`);
      if (dot) dot.outerHTML = colorDotHtml(id);
    }
    refreshAfterColors();
  });

  // ---- Eventos ----
  const onQ = debounce(() => { f.q = $('#f-q', main).value.trim(); renderResults({ keepPage: false }); }, 200);
  $('#f-q', main).addEventListener('input', onQ);

  main.addEventListener('click', (e) => {
    const chipBtn = e.target.closest('.chip[data-group]');
    if (chipBtn) {
      const g = chipBtn.dataset.group; const v = chipBtn.dataset.value;
      f[g] = f[g].includes(v) ? f[g].filter((x) => x !== v) : [...f[g], v];
      chipBtn.setAttribute('aria-pressed', String(f[g].includes(v)));
      if (g === 'c' && f.c.length) requestColors(applyFilters(all, f, 'c'));
      return renderResults({ keepPage: false });
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const k = rm.dataset.remove; const v = rm.dataset.value;
      if (Array.isArray(f[k])) f[k] = f[k].filter((x) => x !== v);
      else f[k] = typeof f[k] === 'boolean' ? false : '';
      syncControls();
      return renderResults({ keepPage: false });
    }
    const pg = e.target.closest('[data-page]');
    if (pg && !pg.disabled) {
      f.p = Number(pg.dataset.page);
      renderResults();
      $('#results-title', main).scrollIntoView({ block: 'start' });
      window.scrollBy(0, -80);
      return;
    }
    if (e.target.closest('#f-clear, [data-action="clear"]')) {
      Object.assign(f, { q: '', r: [], cat: [], w: '', col: '', wear: [], st: false, sv: false, c: [], cp: false, p: 1 });
      syncControls();
      return renderResults();
    }
    if (e.target.closest('#c-run')) {
      const st = colorStats(all);
      const auto = st.stalled ? true : !getPref('autoColors');
      if (st.stalled) resumeColors();
      setPref('autoColors', auto);
      if (auto) requestColors(all); else cancelBackground();
      return renderCounts();
    }
    if (e.target.closest('#c-reset')) {
      clearColors();
      setPref('autoColors', true);
      requestColors(all);
      return renderResults();
    }
    const toggle = e.target.closest('.filters-toggle');
    if (toggle) {
      const open = $('#filters', main).classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    }
  });

  main.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'cat') {
      f.cat = $$('input[name="cat"]:checked', main).map((i) => i.value);
      const sel = $('#f-w', main);
      sel.innerHTML = '<option value="">Todas</option>' + weaponOptions();
      if (f.w && !sel.querySelector(`option[value="${CSS.escape(f.w)}"]`)) f.w = '';
      sel.value = f.w;
    } else if (t.name === 'wear') f.wear = $$('input[name="wear"]:checked', main).map((i) => i.value);
    else if (t.id === 'f-w') f.w = t.value;
    else if (t.id === 'f-col') f.col = t.value;
    else if (t.id === 'f-st') f.st = t.checked;
    else if (t.id === 'f-sv') f.sv = t.checked;
    else if (t.id === 'f-cp') f.cp = t.checked;
    else if (t.id === 'f-sort') { f.sort = t.value; return renderResults(); }
    else return;
    renderResults({ keepPage: false });
  });

  function syncControls() {
    $('#f-q', main).value = f.q;
    $$('.chip[data-group]', main).forEach((b) => b.setAttribute('aria-pressed', String(f[b.dataset.group].includes(b.dataset.value))));
    $$('input[name="cat"]', main).forEach((i) => { i.checked = f.cat.includes(i.value); });
    $$('input[name="wear"]', main).forEach((i) => { i.checked = f.wear.includes(i.value); });
    const sel = $('#f-w', main);
    sel.innerHTML = '<option value="">Todas</option>' + weaponOptions();
    sel.value = f.w;
    $('#f-col', main).value = f.col;
    $('#f-st', main).checked = f.st;
    $('#f-sv', main).checked = f.sv;
    $('#f-cp', main).checked = f.cp;
  }

  // Contagem fixa por categoria (catálogo inteiro).
  const catCounts = {};
  for (const s of all) catCounts[s.cat] = (catCounts[s.cat] || 0) + 1;
  $$('[data-cat-count]', main).forEach((el) => { el.textContent = `(${catCounts[el.dataset.catCount] || 0})`; });

  renderResults();

  return {
    destroy() {
      destroyed = true;
      offColor();
      observer?.disconnect();
    },
  };
}
