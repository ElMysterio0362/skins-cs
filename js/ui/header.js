import { escapeHtml, fold, debounce } from '../lib/dom.js';
import { currentTheme, applyTheme } from '../lib/prefs.js';
import { getCatalog } from '../data/catalog.js';
import { buildHash, navigate, parseHash } from '../router.js';

export const NAV = [
  { path: '/', label: 'Início' },
  { path: '/catalogo', label: 'Catálogo' },
  { path: '/kits', label: 'Meus kits' },
  { path: '/favoritos', label: 'Favoritos' },
  { path: '/sites', label: 'Comparador de sites' },
  { path: '/sobre', label: 'Sobre/FAQ' },
];

const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

export function searchSkins(q, limit = 8) {
  const cat = getCatalog();
  if (!cat) return [];
  const tokens = fold(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const s of cat.skins) {
    if (tokens.every((t) => s._search.includes(t))) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function renderHeader() {
  const el = document.getElementById('site-header');
  el.innerHTML = `<div class="header-inner">
    <a class="logo" href="#/" aria-label="Skins CS — início"><img src="assets/favicon.svg" alt="" width="30" height="30"><span>SKINS<b>CS</b></span></a>
    <button class="btn btn-ghost btn-sm menu-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
    <nav class="nav" id="main-nav" aria-label="Principal">
      ${NAV.map((n) => `<a href="#${n.path}" data-path="${n.path}">${n.label}</a>`).join('')}
    </nav>
    <div class="gsearch" role="search">
      ${ICON_SEARCH}
      <label class="sr-only" for="gsearch-input">Buscar skins</label>
      <input id="gsearch-input" class="input" type="search" placeholder="Buscar skin, arma, coleção…" autocomplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="gsearch-list">
      <ul id="gsearch-list" class="suggestions" role="listbox" hidden></ul>
    </div>
    <div class="header-tools">
      <button class="btn btn-ghost btn-sm" id="theme-toggle" type="button"></button>
    </div>
  </div>`;

  const themeBtn = el.querySelector('#theme-toggle');
  const paintTheme = () => {
    const dark = currentTheme() === 'dark';
    themeBtn.innerHTML = dark ? ICON_SUN : ICON_MOON;
    themeBtn.setAttribute('aria-label', dark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    themeBtn.title = themeBtn.getAttribute('aria-label');
  };
  paintTheme();
  themeBtn.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    paintTheme();
  });

  const nav = el.querySelector('.nav');
  const menuBtn = el.querySelector('.menu-toggle');
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  });

  setupSearch(el.querySelector('#gsearch-input'), el.querySelector('#gsearch-list'));
}

function setupSearch(input, list) {
  let items = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const goAll = () => {
    const q = input.value.trim();
    close();
    navigate(buildHash('/catalogo', { q }));
  };
  const choose = (i) => {
    const it = items[i];
    if (!it) return goAll();
    close();
    input.value = '';
    navigate('#/skin/' + encodeURIComponent(it.id));
  };
  const highlight = (i) => {
    const lis = [...list.children];
    active = i;
    lis.forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (lis[i]) {
      input.setAttribute('aria-activedescendant', lis[i].id);
      lis[i].scrollIntoView({ block: 'nearest' });
    }
  };

  const update = debounce(() => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    if (!getCatalog()) {
      list.innerHTML = '<li class="muted">Catálogo carregando…</li>';
      list.hidden = false;
      return;
    }
    items = searchSkins(q, 8);
    list.innerHTML = items.map((s, i) => `<li id="gs-${i}" role="option" data-i="${i}" aria-selected="false">
        <img src="${escapeHtml(s.image)}" alt="" loading="lazy"><span class="s-name">${escapeHtml(s.name)}${s.phase ? ' · ' + escapeHtml(s.phase) : ''}</span></li>`).join('')
      + `<li id="gs-${items.length}" role="option" class="s-all" data-i="${items.length}" aria-selected="false">${items.length ? 'Ver todos os resultados' : 'Nenhuma sugestão — buscar no catálogo'}</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  }, 120);

  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    const n = list.hidden ? 0 : list.children.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); highlight((active + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); highlight((active - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); active >= 0 ? choose(active) : goAll(); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); choose(Number(li.dataset.i)); }
  });
  input.addEventListener('blur', () => setTimeout(close, 100));
}

export function markActiveNav() {
  const { path } = parseHash();
  const top = '/' + (path.split('/')[1] || '');
  const map = { '/skin': '/catalogo' };
  const current = map[top] || top;
  document.querySelectorAll('#main-nav a').forEach((a) => {
    if (a.dataset.path === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
