import { escapeHtml } from '../lib/dom.js';
import { TIERS } from '../data/labels.js';
import { COLOR_FAMILIES } from '../data/colorAlgo.js';
import { skinCardHtml } from '../ui/skinCard.js';
import { requestColors } from '../data/colors.js';
import { setPageMeta } from '../ui/seo.js';

// Sorteio estável por dia: os destaques mudam diariamente, sem inventar critério de "popularidade".
function dailyPick(arr, n) {
  const day = Math.floor(Date.now() / 86400000);
  let seed = day;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function renderHome(main, catalog) {
  setPageMeta({
    title: '',
    description: 'Explore skins de CS2, filtre por raridade e cor, monte kits temáticos e compare preços em marketplaces. Projeto independente.',
  });
  const pool = catalog.skins.filter((s) => s.tier === 'covert' || s.tier === 'extraordinary' || s.tier === 'classified');
  const picks = dailyPick(pool, 8);
  requestColors(picks, { priority: true });

  main.innerHTML = `
    <section class="hero">
      <h1>Encontre, combine e compare skins de CS2</h1>
      <p>${catalog.skins.length} skins para explorar por raridade, cor, arma e coleção. Monte kits temáticos e, nas próximas versões, compare preços em lojas brasileiras e internacionais.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#/catalogo">Abrir catálogo</a>
        <a class="btn" href="#/kits">Montar um kit</a>
      </div>
    </section>

    <section class="section" aria-labelledby="h-rar">
      <div class="section-head"><h2 id="h-rar">Explorar por raridade</h2></div>
      <div class="chips">
        ${TIERS.map((t) => `<a class="chip" style="--c:${t.color}" href="#/catalogo?r=${t.id}"><span class="dot" aria-hidden="true"></span>${escapeHtml(t.label)}</a>`).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="h-cor">
      <div class="section-head"><h2 id="h-cor">Explorar por cor da skin</h2></div>
      <div class="chips">
        ${COLOR_FAMILIES.map((c) => `<a class="chip" style="--c:${c.swatch}" href="#/catalogo?c=${c.id}"><span class="dot" aria-hidden="true"></span>${escapeHtml(c.label)}</a>`).join('')}
      </div>
    </section>

    <section class="section" aria-labelledby="h-dest">
      <div class="section-head"><h2 id="h-dest">Destaques do dia</h2><a href="#/catalogo?sort=rarity">Ver mais</a></div>
      <p class="muted small">Seleção aleatória diária entre skins Secretas, Ocultas e Extraordinárias.</p>
      <div class="grid">${picks.map(skinCardHtml).join('')}</div>
    </section>

    <section class="section" aria-labelledby="h-ofertas">
      <div class="section-head"><h2 id="h-ofertas">Melhores ofertas</h2></div>
      <div class="empty-card">Ainda não há preços carregados. A comparação entre lojas chega numa próxima fase.</div>
    </section>

    <section class="section" aria-labelledby="h-kits">
      <div class="section-head"><h2 id="h-kits">Kits recentes</h2></div>
      <div class="empty-card">Você ainda não criou nenhum kit.</div>
    </section>`;
}
