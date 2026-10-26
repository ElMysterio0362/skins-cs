import { escapeHtml, formatDateTime } from '../lib/dom.js';
import { setPageMeta } from '../ui/seo.js';

export function renderNotFound(main, message = 'A página que você procurou não existe ou foi movida.') {
  setPageMeta({ title: 'Página não encontrada', description: 'Página não encontrada.' });
  main.innerHTML = `<section class="notfound">
    <div class="big" aria-hidden="true">404</div>
    <h1>Página não encontrada</h1>
    <p class="muted">${escapeHtml(message)}</p>
    <p><a class="btn btn-primary" href="#/">Voltar ao início</a> <a class="btn" href="#/catalogo">Abrir catálogo</a></p>
  </section>`;
}

const PLANNED = {
  kits: { title: 'Meus kits', phase: 5, text: 'Monte kits com slots de Faca, Luvas, Rifles, AWP, Pistolas, SMGs e Escopetas, com orçamento e total por loja.' },
  favoritos: { title: 'Favoritos', phase: 6, text: 'Salve skins favoritas e crie alertas locais de preço.' },
  sites: { title: 'Comparador de sites', phase: 3, text: 'Lista de marketplaces com país, moeda, taxas, método de obtenção de preço e status de verificação.' },
};

export function renderPlanned(main, key) {
  const p = PLANNED[key];
  setPageMeta({ title: p.title, description: p.text });
  main.innerHTML = `<section class="prose">
    <h1>${p.title}</h1>
    <div class="empty-card"><p><b>Em construção (fase ${p.phase}).</b></p><p>${p.text}</p>
    <p><a class="btn" href="#/catalogo">Explorar o catálogo enquanto isso</a></p></div>
  </section>`;
}

export function renderAbout(main, catalog) {
  setPageMeta({ title: 'Sobre e FAQ', description: 'Como o Skins CS funciona, de onde vêm os dados e quais são as limitações.' });
  main.innerHTML = `<article class="prose">
    <h1>Sobre e perguntas frequentes</h1>
    <h2>De onde vêm as skins?</h2>
    <p>Do dataset público <a href="https://github.com/ByMykel/CSGO-API" target="_blank" rel="noopener">ByMykel/CSGO-API</a> (nomes em inglês, como no jogo).
      Versão em uso: ${escapeHtml(String(catalog?.meta?.count ?? '—'))} skins, gerada em ${escapeHtml(formatDateTime(catalog?.meta?.generatedAt))}.
      Você pode baixar a versão mais recente pelo botão abaixo; ela fica guardada no seu navegador.</p>
    <p><button class="btn" type="button" id="refresh-catalog">Atualizar catálogo</button> <span id="refresh-status" class="muted small" aria-live="polite"></span></p>
    <h2>Por que facas e luvas aparecem como “Extraordinária”?</h2>
    <p>No inventário do jogo facas e luvas (★) aparecem em dourado. O dataset marca as facas como “Covert”; aqui elas são agrupadas com luvas e itens de contrabando na faixa dourada, como no inventário.</p>
    <h2>Como funciona o filtro “Cor da skin”?</h2>
    <p>O navegador desenha cada imagem num &lt;canvas&gt; pequeno (48×48), ignora o fundo transparente e conta os pixels por família de cor (vermelho, azul, verde, dourado, preto etc.). Cores saturadas pesam um pouco mais que tons de cinza, para o metal da arma não dominar. É uma estimativa automática e pode errar em skins com muitas cores.</p>
    <p>O resultado fica salvo no seu navegador. Se a CDN de imagens não permitir leitura de pixels (CORS), o site tenta o proxy local do <code>server.mjs</code>.</p>
    <h2>E os preços?</h2>
    <p>Ainda não há preços nesta versão. Quando houver, cada valor mostrará a fonte e a data/hora da última atualização, e preços estimados ou manuais nunca serão apresentados como tempo real.</p>
    <h2>Meus dados</h2>
    <p>Tudo fica no seu navegador (localStorage e IndexedDB). Limpar os dados do site apaga preferências e cache.</p>
  </article>`;
}

export function renderLegal(main) {
  setPageMeta({ title: 'Aviso legal', description: 'Projeto independente, sem afiliação à Valve ou à Steam.' });
  main.innerHTML = `<article class="prose">
    <h1>Aviso legal</h1>
    <p>Skins CS é um projeto independente, sem fins comerciais e <b>sem qualquer afiliação, patrocínio ou endosso</b> da Valve Corporation, da Steam ou de qualquer marketplace citado.</p>
    <p>Counter-Strike, CS2, Steam e marcas relacionadas pertencem à Valve Corporation. Nomes e imagens das skins vêm do dataset público ByMykel/CSGO-API e pertencem aos seus respectivos donos.</p>
    <p>As informações são exibidas “como estão”, sem garantia de exatidão. Confira sempre os dados na loja antes de qualquer compra.</p>
  </article>`;
}
