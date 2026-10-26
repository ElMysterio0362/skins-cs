# Skins CS

Site local para explorar skins de CS2, montar kits e (nas próximas fases) comparar preços em marketplaces.
Interface em português, HTML + CSS + JavaScript puro (ES modules), sem framework e sem dependências.

**Status:** fases 1 e 2 prontas (estrutura, roteamento, tema, catálogo, busca, filtros, raridade e cor da skin).
Fases 3 a 7 (marketplaces, preços, comparador, kits, favoritos, exportação, polimento) ainda não foram feitas.

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
| `catalog:v1` | IndexedDB | catálogo baixado via “Atualizar catálogo” (~2 MB, grande demais para o localStorage) |

## Marketplaces e preços

Ainda não implementado (fase 3). Esta seção vai explicar como adicionar um marketplace em `marketplaces.json`
e como atualizar preços e câmbio.

## Limitações atuais

- Sem preços, kits, favoritos ou exportação (fases 3 a 7).
- A cor dominante é uma estimativa; skins multicoloridas ou com muito metal podem cair numa família inesperada.
- Se a CDN de imagens da Steam não liberar CORS e o site não estiver rodando pelo `server.mjs`, o filtro por cor
  fica indisponível (o site avisa).

## Aviso legal

Projeto independente, sem afiliação com a Valve Corporation ou a Steam. Marcas e imagens pertencem aos seus donos.
