// Gera data/skins.json (catálogo enxuto) a partir do dataset ByMykel/CSGO-API.
// Uso:
//   node scripts/build-catalog.mjs                 # baixa do GitHub
//   node scripts/build-catalog.mjs caminho/skins.json  # usa um arquivo local
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog } from '../js/data/normalize.js';

const SOURCE_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];

let raw;
if (input) {
  raw = JSON.parse(await readFile(input, 'utf8'));
} else {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar catálogo: HTTP ${res.status}`);
  raw = await res.json();
}

const skins = normalizeCatalog(raw);
const meta = {
  source: SOURCE_URL,
  generatedAt: new Date().toISOString(),
  count: skins.length,
};
await mkdir(join(root, 'data'), { recursive: true });
await writeFile(join(root, 'data', 'skins.json'), JSON.stringify({ meta, skins }));
console.log(`OK: ${skins.length} skins gravadas em data/skins.json`);
