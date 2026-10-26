import { load, save } from './storage.js';

const DEFAULTS = { theme: null, autoColors: true, consentSeen: false };
let prefs = { ...DEFAULTS, ...(load('prefs', {}) || {}) };

export const getPref = (k) => prefs[k];
export function setPref(k, v) {
  prefs = { ...prefs, [k]: v };
  save('prefs', prefs);
}

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setPref('theme', theme);
}
