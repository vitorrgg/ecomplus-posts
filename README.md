# ecomplus-posts

Fábrica de posts em formato slide/carrossel pra o Instagram da e-com.plus. Você (ou o Claude) escreve o conteúdo em markdown, o script renderiza imagens prontas pra postar, com a identidade visual da marca aplicada.

Renderização via [Satori](https://github.com/vercel/satori) (mesma lib que o Vercel usa pra Open Graph images) + [resvg](https://github.com/RazrFalcon/resvg) — pacotes npm puros, sem navegador/Chromium e sem dependência de sistema. Tentamos Playwright antes; travou em `apt-get install --with-deps` neste ambiente (sudo sem senha configurada) e trocamos pela alternativa mais leve.

## Status

✅ Identidade de marca aplicada (`identidade/marca.md`, extraída do manual em PDF) — cores, tipografia (Fira Sans Condensed + Red Hat Display) e logos.

⚠️ Dois pontos não especificados no manual, resolvidos por inferência — conferir em `identidade/marca.md`: cor do texto de corpo, e o `letter-spacing` dos títulos (o manual diz `-0.3em`, valor extremo demais pra usar como está; apliquei `-0.03em`).

## Estrutura

```
identidade/
  marca.md            Guia de marca em markdown (cores, tipografia, logo, voz) — fonte dos tokens
  logos/               Arquivos de logo (svg/png, variações normal e negativa)
templates/
  tokens.css           Tokens de marca em CSS (referência/documentação)
  tokens.mjs            Os mesmos tokens, em JS — o que o render de fato usa
  slide-base.mjs        Template de slide (título + texto de apoio), como árvore Satori
  fonts/                Arquivos .woff das fontes da marca
posts/<slug>/
  brief.md              Conteúdo de um carrossel: um "## Slide N" por slide
scripts/
  render.mjs             Lê o brief + template, gera um PNG por slide via Satori + resvg
output/<slug>/           PNGs gerados (1080×1350, pronto pra Instagram)
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
npm run render -- exemplo   # valida o pipeline com o post de exemplo
```

Sem passo de instalar navegador — é só `npm install`.

## Posts de teste já gerados

`o-que-e-headless`, `comparativo-vtex`, `chat-ia-painel` — rascunhos pra validar tom de voz e visual, não copy final aprovada.

## Próximos passos

- Validar/corrigir os dois pontos inferidos em `identidade/marca.md` (cor de texto, letter-spacing).
- Considerar suporte a múltiplos templates de slide (ex: capa escura como as páginas de seção do manual, slide de dado/estatística, slide de citação) — hoje só existe `slide-base.mjs`.
- Colocar o ícone da marca como marca d'água discreta no canto do slide.
