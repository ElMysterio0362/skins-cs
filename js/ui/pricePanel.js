// Bloco "Preços" da página da skin (fase 3: dados brutos por fonte + preço manual).
// A tabela comparativa com "mais barato" e filtros vem na fase 4.
import { escapeHtml, formatDateTime } from '../lib/dom.js';
import { WEARS } from '../data/labels.js';
import { variantsOf } from '../prices/marketName.js';
import { loadMarketplaces, getMarketplaces, getMarketplace, isEnabled, linkFor } from '../prices/marketplaces.js';
import { getPrices, fetchPrices, onPrices, getStatus, setManualPrice, removePrice, initPrices } from '../prices/provider.js';
import { formatBRL } from '../prices/fx.js';
import { toast } from './toast.js';

const KIND = {
  api: ['API (cache)', 'Obtido automaticamente; pode ter até 1 h de atraso.'],
  manual: ['Manual', 'Digitado por você. Não é tempo real.'],
  import: ['Importado', 'Veio de um arquivo importado. Não é tempo real.'],
};

function variantLabel(v) {
  const w = v.wear ? WEARS.find((x) => x.id === v.wear)?.label : 'Sem desgaste';
  return `${v.st ? 'StatTrak™ · ' : v.sv ? 'Lembrança · ' : ''}${w}`;
}

export async function mountPricePanel(el, skin) {
  el.innerHTML = '<p class="muted"><span class="spinner" aria-hidden="true"></span> Carregando fontes de preço…</p>';
  try {
    await Promise.all([loadMarketplaces(), initPrices()]);
  } catch (e) {
    el.innerHTML = `<div class="banner banner-warn">Fontes de preço indisponíveis: ${escapeHtml(e.message)}</div>`;
    return () => {};
  }
  const variants = variantsOf(skin);
  let current = variants.find((v) => v.wear === 'FT' && !v.st && !v.sv) || variants[0];

  const draw = () => {
    const recs = getPrices(current.name);
    const active = getMarketplaces().filter(isEnabled);
    const rows = active.map((m) => {
      const r = recs.find((x) => x.source === m.id);
      const st = getStatus(m.id);
      let cell;
      if (r) {
        const [label, tip] = KIND[r.kind] || [r.kind, ''];
        const none = r.extra?.semOferta;
        cell = `<td>${r.brl == null ? '<span class="muted">sem câmbio</span>' : `<b>${formatBRL(r.brl)}</b>`}${none ? ' <span class="muted small">(sem oferta à venda; valor de referência)</span>' : ''}
          ${r.currency !== 'BRL' ? `<div class="muted small">${r.price} ${escapeHtml(r.currency)}</div>` : ''}</td>
          <td><span class="badge" title="${escapeHtml(tip)}">${label}</span></td>
          <td class="small">${escapeHtml(formatDateTime(r.at))}</td>`;
      } else {
        const msg = m.metodo !== 'api' ? 'Sem preço (importe ou digite abaixo)'
          : st?.state === 'carregando' ? 'Consultando…'
          : st?.state && st.state !== 'ok' ? escapeHtml(st.msg || 'Fonte indisponível')
          : 'Não encontrado nesta fonte';
        cell = `<td colspan="3" class="muted small">${msg}</td>`;
      }
      const href = linkFor(m, current.name, r?.url);
      return `<tr><th scope="row">${escapeHtml(m.nome)} <span class="muted small">${m.pais === 'BR' ? 'BR' : 'intl.'}</span></th>${cell}
        <td>${href ? `<a class="btn btn-sm" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Abrir${m.linkSkin || r?.url ? '' : ' site'}</a>` : ''}
        ${r && r.kind !== 'api' ? `<button class="btn btn-sm btn-ghost" type="button" data-remove="${escapeHtml(m.id)}" aria-label="Remover preço de ${escapeHtml(m.nome)}">Remover</button>` : ''}</td></tr>`;
    }).join('');

    el.innerHTML = `
      <h2>Preços</h2>
      <div class="row">
        <label for="pv-variant" class="small muted">Variante</label>
        <select id="pv-variant" class="select" style="width:auto">
          ${variants.map((v, i) => `<option value="${i}"${v === current ? ' selected' : ''}>${escapeHtml(variantLabel(v))}</option>`).join('')}
        </select>
        <button class="btn btn-sm" type="button" id="pv-refresh">Atualizar preços</button>
      </div>
      <p class="muted small">Nome de mercado: <code>${escapeHtml(current.name)}</code>${skin.phase ? ' — marketplaces normalmente não separam a fase da Doppler no nome; o preço pode ser de outra fase.' : ''}</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th scope="col">Fonte</th><th scope="col">Preço</th><th scope="col">Tipo</th><th scope="col">Atualizado em</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">Nenhuma fonte ativa. Ative fontes em Comparador de sites.</td></tr>'}</tbody>
      </table></div>
      <p class="banner banner-warn small" role="note">Valores podem estar desatualizados e não incluem taxas desconhecidas. Confira sempre na loja. Comparação com “mais barato” chega na fase 4.</p>
      <details class="panel">
        <summary>Adicionar preço manual</summary>
        <form id="pv-form" class="row" style="margin-top:8px">
          <label class="sr-only" for="pv-src">Fonte</label>
          <select id="pv-src" class="select" style="width:auto">${getMarketplaces().map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.nome)}</option>`).join('')}</select>
          <label class="sr-only" for="pv-price">Preço em reais</label>
          <input id="pv-price" class="input input-sm" inputmode="decimal" placeholder="R$ 0,00" required>
          <button class="btn btn-sm btn-primary" type="submit">Salvar</button>
        </form>
        <p class="muted small">Fica salvo só neste navegador, com a data de hoje, marcado como manual.</p>
      </details>`;
  };

  const refresh = (force) => fetchPrices(current.name, { force });

  el.addEventListener('change', (e) => {
    if (e.target.id === 'pv-variant') {
      current = variants[Number(e.target.value)];
      draw();
      refresh(false);
    }
  });
  el.addEventListener('click', (e) => {
    if (e.target.id === 'pv-refresh') refresh(true);
    const rm = e.target.closest('[data-remove]');
    if (rm) removePrice(rm.dataset.remove, current.name);
  });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const src = el.querySelector('#pv-src').value;
      setManualPrice(src, current.name, el.querySelector('#pv-price').value);
      if (!isEnabled(getMarketplace(src))) toast('Preço salvo, mas essa fonte está desativada. Ative em Comparador de sites.');
      else toast('Preço manual salvo.');
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  });

  draw();
  refresh(false);
  const off = onPrices(() => {
    const a = document.activeElement;
    if (!a || !el.contains(a) || a.id === 'pv-refresh' || a.tagName === 'BUTTON') draw();
  });
  return off;
}
