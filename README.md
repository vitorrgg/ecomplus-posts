# ecomplus-posts

Fábrica de posts em formato slide/carrossel pra o Instagram da e-com.plus. Você (ou o Claude) escreve o conteúdo em markdown, o script renderiza imagens prontas pra postar, com a identidade visual da marca aplicada.

## Status

⚠️ **`identidade/marca.md` ainda está com placeholders.** Antes de gerar posts reais, exportar o guia de marca em **PDF** e pedir pro Claude ler e preencher `identidade/marca.md` + `templates/tokens.css` com os valores reais (cores, tipografia, logo, tom de voz).

## Estrutura

```
identidade/       Guia de marca em markdown (cores, tipografia, logo, voz) — fonte dos tokens
templates/
  tokens.css       Variáveis CSS de marca, consumidas pelos templates de slide
  slide-base.html   Template de slide (título + texto de apoio)
posts/<slug>/
  brief.md          Conteúdo de um carrossel: um "## Slide N" por slide
scripts/
  render.mjs         Lê o brief + template, gera um PNG por slide via Playwright
output/<slug>/       PNGs gerados (1080×1350, pronto pra Instagram)
```

## Fluxo de uso

1. Criar `posts/<slug>/brief.md` com o conteúdo, um `## Slide N` por slide:
   ```markdown
   ## Slide 1
   **Título:** Frase de impacto aqui
   Texto de apoio, se precisar.
   ```
2. Rodar `npm run render -- <slug>`.
3. Imagens saem em `output/<slug>/slide-1.png`, `slide-2.png`, etc.

## Setup

```bash
npm install
npx playwright install chromium
npm run render -- exemplo   # valida o pipeline com o post de exemplo
```

## Próximos passos

- Preencher `identidade/marca.md` a partir do PDF de identidade e atualizar `templates/tokens.css`.
- Depois de validado com uma marca só, considerar suporte a múltiplos templates de slide (ex: slide de dado/estatística, slide de citação) — hoje só existe `slide-base.html`.
