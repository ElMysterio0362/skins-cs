import test from 'node:test';
import assert from 'node:assert/strict';
import { marketHashName, variantsOf } from '../js/prices/marketName.js';
import { parseBRL } from '../lib/upstream.mjs';

const ak = { name: 'AK-47 | Redline', wears: ['FT', 'MW'], st: true, sv: false };
const knife = { name: '★ Karambit | Doppler', wears: ['FN'], st: true, sv: false };
const vanilla = { name: '★ Karambit', wears: [], st: true, sv: false };

test('market_hash_name: arma comum', () => {
  assert.equal(marketHashName(ak, { wear: 'FT' }), 'AK-47 | Redline (Field-Tested)');
  assert.equal(marketHashName(ak, { wear: 'FT', st: true }), 'StatTrak™ AK-47 | Redline (Field-Tested)');
  assert.equal(marketHashName(ak, { wear: 'MW', sv: true }), 'Souvenir AK-47 | Redline (Minimal Wear)');
});

test('market_hash_name: faca com estrela e vanilla', () => {
  assert.equal(marketHashName(knife, { wear: 'FN', st: true }), '★ StatTrak™ Karambit | Doppler (Factory New)');
  assert.equal(marketHashName(vanilla, {}), '★ Karambit');
});

test('variantes: desgastes × StatTrak', () => {
  assert.equal(variantsOf(ak).length, 4);
  assert.equal(variantsOf(vanilla).length, 2);
});

test('parseBRL', () => {
  assert.equal(parseBRL('R$ 1.234,56'), 1234.56);
  assert.equal(parseBRL('R$ 12,30'), 12.3);
  assert.equal(parseBRL(undefined), null);
  assert.equal(parseBRL('--'), null);
});
