// Title, description e Open Graph por página.
const SITE = 'Skins CS';

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.setAttribute('content', value);
}

export function setPageMeta({ title, description, image }) {
  const full = title ? `${title} — ${SITE}` : `${SITE} — catálogo de skins de CS2`;
  document.title = full;
  if (description) {
    setMeta('name', 'description', description);
    setMeta('property', 'og:description', description);
  }
  setMeta('property', 'og:title', full);
  setMeta('property', 'og:url', location.href);
  if (image) setMeta('property', 'og:image', image);
}
