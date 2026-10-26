import { route, setNotFound, startRouter } from './router.js';
import { loadCatalog, refreshCatalog } from './data/catalog.js';
import { renderHeader, markActiveNav } from './ui/header.js';
import { renderFooter } from './ui/footer.js';
import { installImageFallback, escapeHtml } from './lib/dom.js';
import { getPref, setPref } from './lib/prefs.js';
import { toast } from './ui/toast.js';
import { renderHome } from './pages/home.js';
import { renderCatalogPage } from './pages/catalog.js';
import { renderSkin } from './pages/skin.js';
import { renderSites } from './pages/sites.js';
import { renderNotFound, renderPlanned, renderAbout, renderLegal } from './pages/static.js';

const main = document.getElementById('main');

function showLoading() {
  main.innerHTML = '<div class="state" role="status"><span class="spinner" aria-hidden="true"></span> Carregando catálogo…</div>';
}

function showError(err) {
  main.innerHTML = `<div class="state state-error" role="alert">
    <h2>Não foi possível carregar o catálogo</h2>
    <p>${escapeHtml(err?.message || String(err))}</p>
    <p class="muted">${navigator.onLine ? 'Verifique se o site está sendo servido por HTTP (ex.: <code>node server.mjs</code>).' : 'Você parece estar offline.'}</p>
    <button class="btn" type="button" onclick="location.reload()">Tentar de novo</button>
  </div>`;
}

// Envolve uma página que precisa do catálogo, com estados de carregamento e erro.
const withCatalog = (fn) => async (ctx) => {
  markActiveNav();
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error(err);
    showError(err);
    return null;
  }
  // Container novo a cada visita: os eventos que a página registra nele somem junto
  // com ele, sem acumular handlers de visitas anteriores no <main>.
  const page = document.createElement('div');
  page.className = 'page';
  main.replaceChildren(page);
  const res = await fn(page, catalog, ctx);
  focusMain();
  return res;
};

let firstRender = true;
function focusMain() {
  if (firstRender) { firstRender = false; return; }
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

route('/', withCatalog((m, c) => renderHome(m, c)));
route('/catalogo', withCatalog((m, c, { query }) => renderCatalogPage(m, c, query)));
route('/skin/:id', withCatalog((m, c, { params }) => renderSkin(m, c, params.id)));
route('/kits', withCatalog((m) => renderPlanned(m, 'kits')));
route('/favoritos', withCatalog((m) => renderPlanned(m, 'favoritos')));
route('/sites', withCatalog((m) => renderSites(m)));
route('/sobre', withCatalog((m, c) => {
  renderAbout(m, c);
  const btn = m.querySelector('#refresh-catalog');
  const status = m.querySelector('#refresh-status');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Baixando…';
    try {
      const fresh = await refreshCatalog();
      status.textContent = `Pronto: ${fresh.skins.length} skins.`;
      toast('Catálogo atualizado.');
      renderFooter();
    } catch (e) {
      console.warn('[catálogo] falha ao atualizar:', e);
      status.textContent = 'Falha ao atualizar: ' + (e?.message || e) + ' O catálogo atual continua disponível.';
      toast('Não foi possível atualizar o catálogo.', { type: 'error' });
    } finally {
      btn.disabled = false;
    }
  });
}));
route('/aviso-legal', withCatalog((m) => renderLegal(m)));
setNotFound(withCatalog((m) => renderNotFound(m)));

function consentBanner() {
  if (getPref('consentSeen')) return;
  const el = document.createElement('div');
  el.className = 'banner consent';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Aviso de armazenamento local');
  el.innerHTML = '<span>Este site guarda preferências e cache no seu navegador (localStorage/IndexedDB). Nada é enviado para servidores do projeto.</span> <button class="btn btn-sm btn-primary" type="button">Entendi</button>';
  el.querySelector('button').addEventListener('click', () => { setPref('consentSeen', true); el.remove(); });
  document.body.append(el);
}

function offlineBanner() {
  const update = () => {
    let el = document.getElementById('offline-banner');
    if (navigator.onLine) { el?.remove(); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = 'offline-banner';
    el.className = 'banner banner-offline';
    el.setAttribute('role', 'status');
    el.textContent = 'Você está offline. O catálogo salvo continua funcionando, mas imagens e atualizações podem falhar.';
    main.before(el);
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

installImageFallback();
renderHeader();
renderFooter();
consentBanner();
offlineBanner();
startRouter();
loadCatalog().then(renderFooter).catch(() => {});
