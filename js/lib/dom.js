// Pequenos utilitários de DOM. Todo texto vindo de dados passa por escapeHtml
// ou é inserido via textContent.

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Remove acentos e caixa para busca.
export function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function formatDateTime(iso) {
  if (!iso) return 'data desconhecida';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data desconhecida';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="#1c2230"/>' +
  '<path d="M30 80 L70 45 L95 65 L110 55 L130 80 Z" fill="#2f3a50"/><circle cx="112" cy="38" r="8" fill="#2f3a50"/>' +
  '<text x="80" y="104" font-family="sans-serif" font-size="10" fill="#7b869c" text-anchor="middle">imagem indisponível</text></svg>'
);

// Troca imagens quebradas por um placeholder (delegação global, uma vez só).
export function installImageFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback === '1') return;
    img.dataset.fallback = '1';
    img.src = PLACEHOLDER_SVG;
    img.classList.add('img-broken');
  }, true);
}
