import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePixels, familyOf, rgbToHsl, matchesFamily } from '../js/data/colorAlgo.js';

const fam = (r, g, b) => familyOf(...rgbToHsl(r, g, b));

function image(parts) {
  // parts: [[r,g,b,a,count], ...]
  const out = [];
  for (const [r, g, b, a, n] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return new Uint8ClampedArray(out);
}

test('famílias básicas', () => {
  assert.equal(fam(220, 30, 30), 'vermelho');
  assert.equal(fam(240, 130, 30), 'laranja');
  assert.equal(fam(230, 190, 50), 'dourado');
  assert.equal(fam(110, 70, 35), 'marrom');
  assert.equal(fam(40, 170, 60), 'verde');
  assert.equal(fam(30, 190, 200), 'ciano');
  assert.equal(fam(40, 80, 220), 'azul');
  assert.equal(fam(130, 60, 220), 'roxo');
  assert.equal(fam(220, 60, 170), 'rosa');
  assert.equal(fam(10, 10, 12), 'preto');
  assert.equal(fam(128, 130, 132), 'cinza');
  assert.equal(fam(245, 245, 245), 'branco');
});

test('ignora pixels transparentes', () => {
  const r = analyzePixels(image([[0, 0, 0, 0, 1000], [40, 80, 220, 255, 10]]));
  assert.equal(r.families[0][0], 'azul');
});

test('imagem totalmente transparente retorna null', () => {
  assert.equal(analyzePixels(image([[255, 0, 0, 0, 50]])), null);
});

test('cor cromática vence cinza com área parecida', () => {
  const r = analyzePixels(image([[128, 130, 132, 255, 100], [220, 30, 30, 255, 80]]));
  assert.equal(r.families[0][0], 'vermelho');
  assert.ok(r.families.some(([id]) => id === 'cinza'));
  assert.match(r.hex, /^#[0-9a-f]{6}$/);
});

test('matchesFamily: principal e secundária forte', () => {
  const res = { families: [['vermelho', 0.6], ['preto', 0.3], ['dourado', 0.1]] };
  assert.ok(matchesFamily(res, ['vermelho']));
  assert.ok(matchesFamily(res, ['preto']));
  assert.ok(!matchesFamily(res, ['dourado']));
  assert.ok(!matchesFamily(res, ['preto'], true));
  assert.ok(!matchesFamily(null, ['preto']));
});
