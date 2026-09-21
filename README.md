# ecomplus-posts

Fábrica de posts em formato slide/carrossel pra o Instagram da e-com.plus. Você (ou o Claude) escreve o conteúdo em markdown, o script renderiza imagens prontas pra postar, com a identidade visual da marca aplicada.

Renderização via [Satori](https://github.com/vercel/satori) (mesma lib que o Vercel usa pra Open Graph images) + [resvg](https://github.com/RazrFalcon/resvg) — pacotes npm puros, sem navegador/Chromium e sem dependência de sistema.

## Status

✅ Template redesenhado em 2026-07-21 a partir de exemplos reais em `identidade/exemplos/` (feitos à mão, fora deste pipeline) — fundo gradiente escuro + textura diagonal, texto denso sem moldura, logo no rodapé de capa/fechamento, seta de "arraste". As duas primeiras versões erravam nisso: pouco texto, conteúdo raso, logo nunca usado.

⚠️ Dois pontos não especificados no manual de marca, resolvidos por inferência — conferir em `identidade/marca.md`: cor do texto de corpo, e o `letter-spacing` dos títulos.

## Estrutura

```
identidade/
  marca.md            Guia de marca em markdown (cores, tipografia, logo, voz, formatos —
                      inclui a regra de 1920×1080 para thumbnail de vídeo do YouTube)
  logos/               Arquivos de logo (svg/png, normal e negativa)
  exemplos/            Posts feitos à mão (PDF/PNG) usados como referência visual — não fazem parte do pipeline
templates/
  tokens.css           Tokens de marca em CSS (referência/documentação)
  tokens.mjs            Os mesmos tokens em JS, mais o gradiente escuro — o que o render usa
  slides.mjs             6 construtores de slide (3 modelos de capa + texto, lista, fechamento), como árvore Satori
  fonts/                Arquivos .woff das fontes da marca (regular, bold, itálico)
  assets/stripes.png     Textura diagonal (gerada uma vez por scripts/gen-texture.mjs)
posts/<slug>/
  brief.md              Conteúdo de um carrossel: um "## Slide N" por slide, cada um com um bloco \`\`\`yaml
  legenda.txt           (posts ecb-*) legenda do Instagram
scripts/
  render.mjs              Lê o brief + templates, gera um PNG por slide via Satori + resvg
  gen-texture.mjs          Gera templates/assets/stripes.png (só precisa rodar de novo se quiser mudar a textura)
  ecb/                     Rotina semanal "mais lidos do E-Commerce Brasil" → posts → Instagram (ver ecb/README.md)
ecb/                     Estado da rotina semanal: fila, histórico e coletas por semana
output/<slug>/           PNGs gerados (1080×1350, pronto pra Instagram); posts ecb-* têm também os JPEGs
.github/workflows/       ecb-semanal.yml (segunda: gerar) e ecb-publicar.yml (seg/qua/sex: publicar)
```

## Rotina automática semanal (E-Commerce Brasil → Instagram)

Toda segunda o GitHub Actions coleta os artigos mais lidos do E-Commerce Brasil e,
usando cada um como pauta, gera com a API da Claude um carrossel de análise
original cruzando o tema com recursos da e-com.plus, renderiza e comita na fila;
segunda, quarta e sexta ao meio-dia publica um por vez no @ecomplus.io. Setup (segredos, token
do Instagram, revisão antes de publicar) em [`ecb/README.md`](ecb/README.md).

## Tipos de slide

Cada slide do `brief.md` é um bloco yaml com `tipo` + os campos daquele tipo:

| tipo | campos | quando usar |
|---|---|---|
| `capa` | `eyebrow`, `titulo`, `subtitulo`, `imagem` | primeiro slide do carrossel |
| `capa-case` | `tarja`, `chapeu`, `destaque`, `titulo`, `apoio`, `imagem`, `selo` | idem |
| `capa-vitrine` | `chapeu`, `titulo`, `enderecos`, `imagem`, `imagemSecundaria` | idem |
| `texto` | `titulo` (opcional), `paragrafos` (lista) | conteúdo corrido, 1-3 parágrafos |
| `lista` | `titulo`, `itens` (lista) | quando o conteúdo é uma lista de pontos |
| `fechamento` | `paragrafos` (lista) | último slide, fecha com o logo |

### Os três modelos de capa

São o mesmo slide 1 em três enquadramentos. Existem porque uma série publicada
em sequência com uma capa só vira o mesmo post repetido — nove carrosséis de
segmento saíram indistinguíveis no feed antes disso. A regra é alternar entre
os três dentro de uma mesma série, não escolher um favorito.

- **`capa`** — foto em full-bleed, título em três linhas por cima. O degradê do
  template escurece a metade de baixo; a foto precisa ser retrato e já vir com
  o véu (ver `demo-catalog/scripts/prints/prints-para-posts.mjs`). Serve quando
  o argumento é a frase.
- **`capa-case`** — tarja de assunto no topo, texto à esquerda com um `destaque`
  grande, print sangrando pela direita, `selo` circular opcional
  (`{valor, rotulo}`) e rodapé branco com o logo. Serve quando existe um número
  ou uma palavra única para carregar a capa. Veio de
  `identidade/exemplos/Case BarraDoce 01`.
- **`capa-vitrine`** — chapéu curto, título grande em itálico (renderizado em
  minúsculas), `enderecos` sublinhados e dois prints sobrepostos sangrando pelo
  rodapé. Serve quando o assunto é a própria loja no ar. Veio de
  `identidade/exemplos/Golive lado fit e lado rosa`.

Os dois últimos usam o print **dentro de uma moldura**, então precisam de foto
sem véu e sem barra branca — `demo-catalog/scripts/prints/prints-capas-modelos.mjs`
gera os pares `-mobile.jpg` (retrato) e `-desktop.jpg` (paisagem 1.6).

`titulo` aceita quebra de linha manual com o bloco yaml `|-`:
```yaml
tipo: capa
titulo: |-
  primeira linha
  segunda linha
subtitulo: Frase de apoio, uma ou duas linhas.
```

## Fluxo de uso

1. Criar `posts/<slug>/brief.md`, um `## Slide N` por slide, cada um com um bloco \`\`\`yaml (ver exemplos em `posts/`).
2. Rodar `npm run render -- <slug>`.
3. Imagens saem em `output/<slug>/slide-1.png`, `slide-2.png`, etc.

## Setup

```bash
npm install
npm run render -- exemplo   # valida o pipeline com o post de exemplo
```

Sem passo de instalar navegador — é só `npm install`.

## Posts de teste já gerados

`o-que-e-headless`, `comparativo-vtex`, `chat-ia-painel` — rascunhos pra validar tom de voz e visual, não copy final aprovada.

## Próximos passos

- Validar/corrigir os dois pontos inferidos em `identidade/marca.md` (cor de texto, letter-spacing).
- Avaliar se vale ter uma variante clara (fundo branco) — os exemplos em `identidade/exemplos/` usam quase só a versão escura.
- Página numerada (ex: "01", "02") aparece em alguns exemplos oficiais mais antigos (`Modelo conteúdo.pdf`) mas não nos mais recentes — mantive sem por ora, fácil adicionar se quiser de volta.
