import { escapeHtml, formatDateTime, $ } from '../lib/dom.js';
import { setPageMeta } from '../ui/seo.js';
import { toast } from '../ui/toast.js';
import { loadMarketplaces, getMarketplaces, isEnabled, setEnabled } from '../prices/marketplaces.js';
import { getFx, refreshFx, setManualFx, formatBRL, FX_URL } from '../prices/fx.js';
import {
  getStatus, onPrices, refreshSkinport, priceCacheStats, clearApiCache,
  parseImport, applyImport, recomputeBRL, initPrices,
} from '../prices/provider.js';

const TIPO = { steam: 'Mercado da Steam', marketplace: 'Marketplace', loja: 'Loja' };
const METODO = { api: 'API', manual: 'Importação manual', scraping: 'Scraping permitido' };
const STATE = {
  ok: ['ok', 'Funcionando'], carregando: ['warn', 'Carregando'], limitado: ['warn', 'Limitado (429)'],
  erro: ['err', 'Erro'], indisponivel: ['err', 'Indisponível'],
};

const pct = (t) => (t?.percentual == null ? 'desconhecida' : `${t.percentual}%${t.fixo ? ` + ${formatBRL(t.fixo)}` : ''}`);

function statusBadge(m) {
  if (m.metodo !== 'api') return '<span class="badge">Sem consulta automática</span>';
  const s = getStatus(m.id);
  if (!s) return '<span class="badge">Ainda não consultado</span>';
  const [cls, label] = STATE[s.state] || ['', s.state];
  return `<span class="badge badge-${cls}" title="${escapeHtml(s.msg)}">${label}</span>${s.msg ? ` <span class="muted small">${escapeHtml(s.msg)}</span>` : ''}`;
}

function sourceLinks(list) {
  if (!list?.length) return '';
  return `<ul class="small">${list.map((u) => `<li><a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(u).hostname.replace(/^www\./, ''))}</a></li>`).join('')}</ul>`;
}

function rowHtml(m) {
  const on = isEnabled(m);
  return `<tr>
    <td><label class="check"><input type="checkbox" data-toggle="${escapeHtml(m.id)}"${on ? ' checked' : ''}> <span class="sr-only">Usar ${escapeHtml(m.nome)}</span></label></td>
    <th scope="row"><a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.nome)}</a>
      <div class="muted small">${escapeHtml(TIPO[m.tipo] || m.tipo)} · ${m.pais === 'BR' ? '🇧🇷 Brasil' : 'Internacional'} · ${escapeHtml(m.moeda)}</div></th>
    <td>${escapeHtml(METODO[m.metodo] || m.metodo)}${m.api?.oficial === false ? ' <span class="muted small">(não oficial)</span>' : ''}</td>
    <td>${escapeHtml(pct(m.taxa?.comprador))}${m.taxa?.comprador?.obs ? `<div class="muted small">${escapeHtml(m.taxa.comprador.obs)}</div>` : ''}</td>
    <td>${statusBadge(m)}</td>
    <td class="small">${escapeHtml(m.verificado?.data || '—')}<div class="muted">${escapeHtml(m.verificado?.observacao || '')}</div></td>
  </tr>`;
}

function proposalHtml(m) {
  const on = isEnabled(m);
  return `<article class="proposal">
    <header>
      <h3><a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.nome)}</a></h3>
      <span class="badge badge-conf-${escapeHtml(m.confianca.split('-')[0].normalize('NFD').replace(/[̀-ͯ]/g, ''))}">Confiança: ${escapeHtml(m.confianca)}</span>
    </header>
    <p class="muted small">${escapeHtml(TIPO[m.tipo] || m.tipo)} · Pagamento: ${escapeHtml((m.pagamento || []).join(', ') || 'não verificado')} · Preços: ${escapeHtml(METODO[m.metodo])}</p>
    <ul>${(m.evidencias || []).map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
    ${m.metodoObs ? `<p class="small muted">${escapeHtml(m.metodoObs)}</p>` : ''}
    <details><summary class="small">Fontes das evidências</summary>${sourceLinks(m.fontes)}</details>
    <label class="check"><input type="checkbox" data-toggle="${escapeHtml(m.id)}"${on ? ' checked' : ''}> Usar esta fonte neste navegador (preços via importação manual)</label>
  </article>`;
}

export async function renderSites(main) {
  setPageMeta({ title: 'Comparador de sites', description: 'Marketplaces de skins de CS2: país, moeda, taxas, como o preço é obtido e status de verificação.' });
  main.innerHTML = '<div class="state" role="status"><span class="spinner" aria-hidden="true"></span> Carregando marketplaces…</div>';
  try {
    await Promise.all([loadMarketplaces(), initPrices()]);
  } catch (e) {
    main.innerHTML = `<div class="state state-error" role="alert"><h2>Não foi possível ler marketplaces.json</h2><p>${escapeHtml(e.message)}</p></div>`;
    return null;
  }

  const draw = () => {
    const all = getMarketplaces();
    const active = all.filter((m) => m.status === 'ativo');
    const proposed = all.filter((m) => m.status === 'proposto');
    const fx = getFx();
    const st = priceCacheStats();
    main.innerHTML = `
      <h1>Comparador de sites</h1>
      <p class="muted">Fontes de preço usadas pelo site. A lista vem de <code>data/marketplaces.json</code>; você pode ligar ou desligar cada fonte neste navegador.</p>
      <div class="banner banner-warn" role="note">Preços podem estar desatualizados. Cada valor mostra a fonte e a data/hora da coleta; preços manuais e importados nunca são tempo real.</div>

      <section class="section" aria-labelledby="h-ativos">
        <h2 id="h-ativos">Fontes em uso</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Usar</th><th scope="col">Site</th><th scope="col">Como obtém o preço</th><th scope="col">Taxa do comprador</th><th scope="col">Status</th><th scope="col">Verificado em</th></tr></thead>
          <tbody>${active.map(rowHtml).join('')}${proposed.filter(isEnabled).map(rowHtml).join('')}</tbody>
        </table></div>
      </section>

      <section class="section" aria-labelledby="h-prop">
        <h2 id="h-prop">Sites brasileiros propostos <span class="muted small">(aguardando aprovação)</span></h2>
        <p class="muted small">Pesquisa feita em ${escapeHtml(formatDateTime('2026-10-26T12:00:00'))} com buscas na web. Trustpilot e Reclame Aqui não puderam ser abertos diretamente; os números vêm de resultados de busca e podem ter mudado. Nenhum site tem API pública conhecida, então os preços deles entram por importação manual. Nada aqui é recomendação de compra.</p>
        <div class="proposals">${proposed.map(proposalHtml).join('')}</div>
      </section>

      <div class="two-col">
        <section class="panel" aria-labelledby="h-fx">
          <h2 id="h-fx">Câmbio USD → BRL</h2>
          <p>${fx ? `<b>${fx.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</b> · ${fx.source === 'manual' ? 'valor manual' : 'AwesomeAPI'} · ${escapeHtml(formatDateTime(fx.at))}` : 'Nenhuma cotação salva ainda.'}</p>
          <p class="muted small">Usado só para fontes cotadas em dólar. Steam e Skinport já respondem em reais.</p>
          <div class="row">
            <button class="btn btn-sm" type="button" id="fx-refresh">Atualizar cotação</button>
            <label class="sr-only" for="fx-manual">Taxa manual</label>
            <input id="fx-manual" class="input input-sm" inputmode="decimal" placeholder="ex.: 5,40">
            <button class="btn btn-sm btn-ghost" type="button" id="fx-save">Usar valor manual</button>
          </div>
          <p class="muted small">Fonte automática: <a href="${FX_URL}" target="_blank" rel="noopener">economia.awesomeapi.com.br</a></p>
        </section>

        <section class="panel" aria-labelledby="h-cache">
          <h2 id="h-cache">Cache de preços</h2>
          <ul class="small">
            <li>Skinport: ${st.skinport ? `${st.skinport.count} itens · ${escapeHtml(formatDateTime(st.skinport.fetchedAt))}` : 'não baixado'}</li>
            <li>Steam (consultas individuais): ${st.api} em cache</li>
            <li>Manuais: ${st.manual} · Importados: ${st.import}</li>
          </ul>
          <p class="muted small">Validade do cache: 1 hora. A Steam é consultada uma skin por vez (1 a cada 3,5 s) quando você abre a página de uma skin.</p>
          <div class="row">
            <button class="btn btn-sm" type="button" id="sp-refresh">Atualizar Skinport agora</button>
            <button class="btn btn-sm btn-ghost" type="button" id="cache-clear">Limpar cache de API</button>
          </div>
        </section>
      </div>

      <section class="panel" aria-labelledby="h-imp">
        <h2 id="h-imp">Importar preços (CSV ou JSON)</h2>
        <p class="small muted">Para sites sem API. Colunas: <code>market_hash_name</code>, <code>source</code> (id da fonte), <code>price</code>, <code>currency</code> (BRL ou USD, opcional), <code>date</code> (opcional, ISO). Separador vírgula ou ponto e vírgula.</p>
        <pre class="code small">market_hash_name;source;price;currency;date
AK-47 | Redline (Field-Tested);dashskins;89,90;BRL;2026-10-26T10:00
★ Karambit | Doppler (Factory New);bleikstore;4200;BRL;</pre>
        <p class="small muted">IDs: ${all.map((m) => `<code>${escapeHtml(m.id)}</code>`).join(', ')}</p>
        <label class="sr-only" for="imp-text">Conteúdo para importar</label>
        <textarea id="imp-text" class="input" rows="5" placeholder="Cole aqui o CSV ou JSON"></textarea>
        <div class="row">
          <label class="btn btn-sm">Escolher arquivo<input type="file" id="imp-file" accept=".csv,.json,text/csv,application/json" hidden></label>
          <button class="btn btn-sm btn-primary" type="button" id="imp-run">Importar</button>
        </div>
        <div id="imp-result" aria-live="polite"></div>
      </section>`;
  };

  draw();
  const off = onPrices(() => {
    // Redesenha só se o foco não estiver num campo (evita perder o que o usuário digita).
    const a = document.activeElement;
    if (!a || !main.contains(a) || !/INPUT|TEXTAREA/.test(a.tagName)) draw();
  });

  main.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.toggle) {
      setEnabled(t.dataset.toggle, t.checked);
      draw();
    } else if (t.id === 'imp-file' && t.files[0]) {
      $('#imp-text', main).value = await t.files[0].text();
    }
  });

  main.addEventListener('click', async (e) => {
    const id = e.target.closest('button')?.id;
    if (!id) return;
    try {
      if (id === 'fx-refresh') { await refreshFx(); recomputeBRL(); toast('Cotação atualizada.'); draw(); }
      if (id === 'fx-save') { setManualFx($('#fx-manual', main).value); recomputeBRL(); toast('Taxa manual salva.'); draw(); }
      if (id === 'sp-refresh') { await refreshSkinport(true); draw(); }
      if (id === 'cache-clear') { await clearApiCache(); toast('Cache de API limpo.'); draw(); }
      if (id === 'imp-run') {
        const text = $('#imp-text', main).value;
        if (!text.trim()) throw new Error('Cole um CSV/JSON ou escolha um arquivo.');
        const { ok, errors } = parseImport(text);
        const n = ok.length ? applyImport(ok) : 0;
        draw();
        $('#imp-result', main).innerHTML = `<div class="banner ${errors.length ? 'banner-warn' : ''}"><b>${n} preço(s) importado(s).</b>${errors.length ? `<ul class="small">${errors.slice(0, 20).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>${errors.length > 20 ? `<p class="small">e mais ${errors.length - 20} erro(s).</p>` : ''}` : ''}</div>`;
      }
    } catch (err) {
      toast(err?.message || String(err), { type: 'error' });
    }
  });

  return { destroy: off };
}
