import { escapeHtml, formatDateTime } from '../lib/dom.js';
import { getCatalog } from '../data/catalog.js';

export function renderFooter() {
  const meta = getCatalog()?.meta;
  const date = meta ? formatDateTime(meta.generatedAt) : '—';
  const origin = meta?.origin === 'cache' ? 'atualizado por você' : 'snapshot do projeto';
  document.getElementById('site-footer').innerHTML = `<div class="footer-inner">
    <section>
      <h2>Skins CS</h2>
      <p>Projeto independente para explorar skins de CS2. Sem afiliação com a Valve Corporation ou a Steam. Marcas e imagens pertencem aos seus donos.</p>
    </section>
    <section>
      <h2>Navegação</h2>
      <ul>
        <li><a href="#/catalogo">Catálogo</a></li>
        <li><a href="#/kits">Meus kits</a></li>
        <li><a href="#/sites">Comparador de sites</a></li>
        <li><a href="#/sobre">Sobre/FAQ</a></li>
        <li><a href="#/aviso-legal">Aviso legal</a></li>
      </ul>
    </section>
    <section>
      <h2>Fontes de dados</h2>
      <ul>
        <li>Catálogo e imagens: <a href="https://github.com/ByMykel/CSGO-API" rel="noopener" target="_blank">ByMykel/CSGO-API</a></li>
        <li>Catálogo: ${escapeHtml(String(meta?.count ?? '—'))} skins · ${escapeHtml(date)} (${escapeHtml(origin)})</li>
        <li>Preços: <a href="https://steamcommunity.com/market/" rel="noopener" target="_blank">Mercado da Steam</a>, <a href="https://skinport.com" rel="noopener" target="_blank">Skinport</a> e importação manual — veja <a href="#/sites">Comparador de sites</a>.</li>
      </ul>
    </section>
    <section>
      <h2>Privacidade</h2>
      <p>Preferências e dados de uso ficam só no seu navegador (localStorage/IndexedDB). Nada é enviado a servidores do projeto.</p>
    </section>
  </div>`;
}
