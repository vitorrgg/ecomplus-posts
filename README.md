# ecomplus-posts

Fábrica de posts em formato slide/carrossel pra o Instagram da e-com.plus. Você (ou o Claude) escreve o conteúdo em markdown, o script renderiza imagens prontas pra postar, com a identidade visual da marca aplicada.

Renderização via [Satori](https://github.com/vercel/satori) (mesma lib que o Vercel usa pra Open Graph images) + [resvg](https://github.com/RazrFalcon/resvg) — pacotes npm puros, sem navegador/Chromium e sem dependência de sistema.

## Status

✅ Template redesenhado em 2026-07-21 a partir de exemplos reais em `identidade/exemplos/` (feitos à mão, fora deste pipeline) — fundo gradiente escuro + textura diagonal, texto denso sem moldura, logo no rodapé de capa/fechamento, seta de "arraste". As duas primeiras versões erravam nisso: pouco texto, conteúdo raso, logo nunca usado.

⚠️ Dois pontos não especificados no manual de marca, resolvidos por inferência — conferir em `identidade/marca.md`: cor do texto de corpo, e o `letter-spacing` dos títulos.

## Estrutura

```
identidade/
  marca.md            Guia de marca em markdown (cores, tipografia, logo, voz)
  logos/               Arquivos de logo (svg/png, normal e negativa)
  exemplos/            Posts feitos à mão (PDF/PNG) usados como referência visual — não fazem parte do pipeline
templates/
  tokens.css           Tokens de marca em CSS (referência/documentação)
  tokens.mjs            Os mesmos tokens em JS, mais o gradiente escuro — o que o render usa
  slides.mjs             4 construtores de slide (capa, texto, lista, fechamento), como árvore Satori
  fonts/                Arquivos .woff das fontes da marca (regular, bold, itálico)
  assets/stripes.png     Textura diagonal (gerada uma vez por scripts/gen-texture.mjs)
posts/<slug>/
  brief.md              Conteúdo de um carrossel: um "## Slide N" por slide, cada um com um bloco \`\`\`yaml
scripts/
  render.mjs              Lê o brief + templates, gera um PNG por slide via Satori + resvg
  gen-texture.mjs          Gera templates/assets/stripes.png (só precisa rodar de novo se quiser mudar a textura)
output/<slug>/           PNGs gerados (1080×1350, pronto pra Instagram)
```

## Tipos de slide

Cada slide do `brief.md` é um bloco yaml com `tipo` + os campos daquele tipo:

| tipo | campos | quando usar |
|---|---|---|
| `capa` | `titulo`, `subtitulo` | primeiro slide do carrossel |
| `texto` | `titulo` (opcional), `paragrafos` (lista) | conteúdo corrido, 1-3 parágrafos |
| `lista` | `titulo`, `itens` (lista) | quando o conteúdo é uma lista de pontos |
| `fechamento` | `paragrafos` (lista) | último slide, fecha com o logo |

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
