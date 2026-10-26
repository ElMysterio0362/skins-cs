# Skins CS

Site local para explorar skins de CS2, montar kits e (nas próximas fases) comparar preços em marketplaces.
Interface em português, HTML + CSS + JavaScript puro (ES modules), sem framework e sem dependências.

**Status:** fases 1 a 3 prontas (catálogo, filtros, cor da skin, registro de marketplaces e camada de preços com cache).
Fases 4 a 7 (comparador por skin, kits, favoritos, exportação, polimento) ainda não foram feitas.

## Como rodar

Requer Node 18+ (só para o servidor local; o site em si é estático).

**Windows:** dê dois cliques em `iniciar.bat`. Ele usa o Node portátil configurado na linha `set "NODE=..."`
(ou o `node` instalado no sistema), sobe o servidor e abre o navegador em http://localhost:8080.

Outros sistemas:

```bash
node server.mjs        # http://localhost:8080
# ou: PORT=3000 node server.mjs
```

Qualquer servidor estático também funciona (ex.: `python3 -m http.server`), mas sem o proxy de imagens descrito abaixo.
Abrir o `index.html` direto (`file://`) não funciona, porque navegadores bloqueiam ES modules nesse modo.

Testes do algoritmo de cor: `npm test` (usa o `node:test`, sem instalar nada).

### Por que existe um `server.mjs`?

1. Servir os arquivos por HTTP (exigido pelos ES modules).
2. `GET /img?u=<url>`: repassa imagens da CDN da Steam (apenas hosts `*.steamstatic.com` e `steamcommunity-a.akamaihd.net`)
   para o `<canvas>` conseguir ler os pixels e calcular a cor dominante caso a CDN não envie cabeçalho CORS.
   O navegador sempre tenta a imagem direta primeiro; o proxy é só o plano B.

## Publicar na Vercel

O site é estático; `api/img.js` e `api/health.js` fazem na Vercel o papel do proxy de imagens do `server.mjs`
(`vercel.json` liga `/img` a `/api/img`).

1. Em vercel.com, **Add New → Project** e importe este repositório do GitHub.
2. Framework Preset: **Other**. Deixe Build Command e Output Directory vazios.
3. **Deploy**. Cada push na branch gera um deploy novo.

## Estrutura

```
index.html, 404.html, server.mjs
css/main.css                 tema escuro/claro (tokens CSS)
data/skins.json              snapshot enxuto do catálogo (gerado)
scripts/build-catalog.mjs    gera data/skins.json a partir do dataset
js/app.js                    rotas e inicialização
js/router.js                 roteador por hash (#/catalogo?r=covert&c=vermelho)
js/data/normalize.js         normalização do JSON do dataset (trata campos ausentes)
js/data/catalog.js           carga, cache (IndexedDB) e índices do catálogo
js/data/labels.js            rótulos pt-BR e cores oficiais de raridade
js/data/colorAlgo.js         classificação de cor (função pura, testada)
js/data/colors.js            extração via canvas, fila e cache em localStorage
js/ui/*                      cabeçalho, rodapé, card, SEO, toasts
js/pages/*                   início, catálogo, detalhe, páginas estáticas e 404
tests/colorAlgo.test.mjs
```

## Rotas

| URL | Página |
| --- | --- |
| `#/` | Início (destaques do dia, atalhos por raridade e cor) |
| `#/catalogo?...` | Catálogo; todos os filtros ficam na URL (compartilhável) |
| `#/skin/<id>` | Detalhe da skin |
| `#/kits`, `#/favoritos`, `#/sites` | Reservadas para as fases 3, 5 e 6 (“em construção”) |
| `#/sobre`, `#/aviso-legal` | Sobre/FAQ (com botão “Atualizar catálogo”) e aviso legal |
| qualquer outra | 404 |

Parâmetros do catálogo: `q` (texto), `r` (raridades), `c` (cores), `cp=1` (só cor principal), `cat`, `w` (arma),
`col` (coleção), `wear` (FN,MW,FT,WW,BS), `st=1`, `sv=1`, `sort`, `p` (página). Listas separadas por vírgula.

## Fonte de dados

- **Skins e imagens:** [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), arquivo `public/api/en/skins.json`.
  O repositório só publica `en` e `zh-CN`, então nomes de skins ficam em inglês (como no jogo) e categorias, raridades
  e desgastes são traduzidos na interface.
- **Atualizar o catálogo:**
  - pelo site: *Sobre/FAQ → Atualizar catálogo* (baixa do GitHub e guarda no IndexedDB do navegador);
  - no projeto: `node scripts/build-catalog.mjs` (ou passe um arquivo local: `node scripts/build-catalog.mjs skins.json`).
- **Campos ausentes:** `souvenir`, `wears` e `collections` faltam em alguns itens (ex.: facas “Vanilla” não têm desgaste);
  são tratados como `false`/lista vazia.

### Decisões sobre os dados

- **Raridade:** cores oficiais do inventário (Consumidor `#b0c3d9`, Industrial `#5e98d9`, Militar `#4b69ff`, Restrita `#8847ff`,
  Secreta `#d32ce6`, Oculta `#eb4b4b`, Extraordinária/Contrabando `#e4ae39`). O dataset marca facas como “Covert”;
  aqui facas e luvas entram na faixa dourada, como no inventário. O único item de contrabando (M4A4 Howl) também.
- **Categorias:** “Heavy” do dataset é dividido em Escopetas e Metralhadoras (já pensando nos slots de kit).
- **Cor da skin:** a imagem é desenhada num canvas 48×48, pixels transparentes são ignorados e cada pixel cai numa de
  12 famílias (vermelho, laranja, amarelo/dourado, marrom, verde, ciano, azul, roxo, rosa, preto, cinza, branco).
  Pixels saturados pesam mais que neutros, para o metal da arma não dominar. O filtro aceita a cor principal ou uma
  secundária com ≥ 25% (ou só a principal, com a opção marcada). Resultado salvo em `localStorage` (`csk:colors:v1`).
  A análise roda em fila (12 por vez, miniaturas de 96px, lembrando qual forma de carregar funcionou), prioriza os cards visíveis e pausa sozinha após 25 falhas seguidas (offline/CORS).

## Armazenamento local

| Chave | Onde | Conteúdo |
| --- | --- | --- |
| `csk:prefs` | localStorage | tema, aviso de armazenamento, análise automática de cores |
| `csk:colors:v1` | localStorage | cor dominante por skin |
| `csk:prices:v1` | localStorage | preços da Steam (cache 1 h), manuais e importados |
| `csk:fx:v1` | localStorage | câmbio USD→BRL e data |
| `csk:marketplaces:enabled` | localStorage | fontes ligadas/desligadas |
| `skinport:v1` | IndexedDB | lista de preços da Skinport (grande demais para o localStorage) |
| `catalog:v1` | IndexedDB | catálogo baixado via “Atualizar catálogo” (~2 MB, grande demais para o localStorage) |

## Marketplaces e preços

### Fontes
- **Mercado da Comunidade Steam** (BRL): endpoint público não oficial `priceoverview`, uma skin por vez,
  no máximo 1 chamada a cada 3,5 s, pausa automática em 429.
- **Skinport** (BRL): API pública oficial `/v1/items`, lista inteira numa chamada (limite 8 req / 5 min, exige Brotli).
- **Sites brasileiros propostos** (DashSkins, Bleik Store, BRSkins, NeshaStore, CubeSKINs): ficam com `status: "proposto"`
  e desligados até aprovação. Nenhum tem API pública conhecida, então entram por importação manual. As evidências e o nível
  de confiança de cada um estão em `data/marketplaces.json` e na página *Comparador de sites*.

As chamadas à Steam e à Skinport passam pelo servidor (`lib/upstream.mjs`, usado pelo `server.mjs` e por `api/*.js` na Vercel),
porque o navegador não pode chamá-las direto (CORS). Abrindo com um servidor estático qualquer, essas fontes aparecem como
"indisponível" e o resto do site continua funcionando.

### Adicionar um marketplace
Inclua um objeto em `data/marketplaces.json` com: `id`, `nome`, `url`, `pais` (`BR`/`internacional`), `moeda`,
`tipo` (`marketplace`/`loja`/`steam`), `status` (`ativo`/`proposto`), `linkSkin` (modelo com `{market_hash_name}` ou `null`),
`taxa.comprador.percentual` (ou `null` se desconhecida), `metodo` (`api`/`manual`/`scraping`) e
`verificado: { data, observacao }`. Com `metodo: "manual"` ele já funciona com importação e preço manual.
Para consulta automática, crie um adaptador em `js/prices/provider.js` (e, se precisar de servidor, uma função em `lib/upstream.mjs`).

### Atualizar preços
- Automático: ao abrir uma skin, as fontes com API são consultadas se o cache (1 h) venceu. *Atualizar preços* força.
- *Comparador de sites → Atualizar Skinport agora / Limpar cache de API*.
- Importação CSV/JSON (colunas `market_hash_name`, `source`, `price`, `currency`, `date`) em *Comparador de sites*.
- Preço manual por skin na página da skin. Manuais e importados são sempre rotulados como tal, com data.

### Câmbio
USD→BRL via [AwesomeAPI](https://economia.awesomeapi.com.br) (*Comparador de sites → Atualizar cotação*) ou valor manual.
A data da cotação aparece ao lado. Só é usado para preços importados em USD.

## Limitações atuais

- Sem comparador “mais barato”, kits, favoritos ou exportação (fases 4 a 7).
- Preços da Steam e da Skinport não puderam ser testados contra as APIs reais no ambiente de desenvolvimento (testados com respostas simuladas).
- Marketplaces não separam fases da Doppler no nome; o preço pode ser de outra fase.
- A cor dominante é uma estimativa; skins multicoloridas ou com muito metal podem cair numa família inesperada.
- Se a CDN de imagens da Steam não liberar CORS e o site não estiver rodando pelo `server.mjs`, o filtro por cor
  fica indisponível (o site avisa).

## Aviso legal

Projeto independente, sem afiliação com a Valve Corporation ou a Steam. Marcas e imagens pertencem aos seus donos.
