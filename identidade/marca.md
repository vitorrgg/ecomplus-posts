# Identidade de marca — e-com.plus

Extraído de `manual-de-identidade-e-com-plus.pdf`.

## Conceito

A marca deve transmitir simplicidade, equilíbrio com velocidade e versatilidade. Abordagem minimalista e aconchegante — esse meio-termo é essencial pra qualquer aplicação.

## Cores institucionais

| Papel | Hex | Uso |
|---|---|---|
| Cor de fundo | `#F5F6FA` | Alternativa ao branco |
| Cor da marca | `#570D5D` | Títulos, blocos em destaque |
| Cor primária | `#FF015B` | Botões e detalhes em destaque, links internos e externos |
| Cor de sucesso | `#00E679` | Detalhes em destaque, botões/links que levam ao checkout |

**Cor de texto de corpo:** não especificada no manual (a tabela "uso das cores" só define fundo/título/primária/sucesso). Nas páginas do próprio PDF o texto corrido aparece em cinza-escuro, não na cor da marca. Usei `#23181F` como texto padrão em `tokens.css` — **inferido, não confirmado no manual**, ajustar se você tiver o valor certo.

## Cores utilitárias

| Papel | Hex |
|---|---|
| Informação | `#03A9B3` |
| Aviso | `#FF5600` |
| Perigo | `#FE0002` |

## Tipografia

- **Títulos:** Fira Sans Compressed (ou Extra Condensed) — lowercase, itálico, semi-bold (600), letter-spacing `-0.3em`, line-height 110%.
  > ⚠️ `-0.3em` de letter-spacing é um valor extremo (letras sobrepostas na maioria dos tamanhos) — pelo manual está assim, mas pode ser erro de digitação por `-0.03em`. Apliquei `-0.03em` em `tokens.css` por ser o valor plausível; confirmar com quem gerou o manual antes de vir a valer.
- **Corpo:** Red Hat Display, normal (400), line-height 130% ou mais.
- Ambas as fontes existem no Google Fonts (`Fira Sans Condensed`, `Red Hat Display`). Baixadas uma vez como `.woff` em `templates/fonts/` (o render via Satori precisa do arquivo, não aceita `<link>`/CDN).

## Nome da marca

Sempre em minúsculas, em qualquer contexto: **e-com.plus**. Nunca `E-Com.Plus`, `E-Com.plus`, `E-COM.PLUS` ou variações.

## Logo

4 variações: logomarca, logomarca negativa, ícone, ícone negativo. Nunca alterar cor, diagramação, proporção ou tipografia.

Arquivos em `identidade/logos/`:

| Arquivo | Uso |
|---|---|
| `ecomplus-logo.svg` / `.png` | Logomarca completa, cor da marca — fundo claro |
| `ecomplus-logo-white.svg` / `.png` | Logomarca negativa (branca) — fundo escuro/colorido |
| `ecom-rect-icon.png` | Ícone (só o "e"), cor da marca sobre fundo claro |
| `brand-prototype.svg` | Arquivo grande (330KB, vs. ~8KB dos outros SVGs) — provavelmente um protótipo/mockup com mais elementos, não um logo isolado. Não consegui abrir pra confirmar (excede o limite de leitura); checar manualmente antes de usar |

## Formato dos posts

- Dimensão do slide: `1080×1350` (proporção 4:5, padrão carrossel Instagram) — não especificado no manual, mantendo o padrão já usado no template.
- Quantos slides por carrossel, tipicamente: não especificado — os exemplos variam de 3 a 11 slides.

## Padrão visual de slide (aprendido de `identidade/exemplos/`)

Não está no manual de marca, mas é consistente em todos os posts feitos à mão que o Vitor passou como referência (`Modelo conteúdo.pdf`, `black friday.pdf`, `melhore SEO/`, `Pontos de Fidelidade/`):

- **Fundo:** gradiente escuro diagonal (roxo pra quase preto) + textura de listras diagonais finas e sutis por cima. É o fundo padrão — não vi nenhum exemplo de conteúdo em fundo claro.
- **Capa:** título grande, itálico, lowercase, condensado (a fonte de display) + subtítulo em texto normal logo abaixo. Logo branco no rodapé à esquerda, seta (→) no rodapé à direita indicando "arraste pro lado".
- **Slides de conteúdo:** sem logo, sem cabeçalho, sem rodapé — só o texto, começando por volta de 22-30% do topo. Ou parágrafos corridos (1-3, curtos mas substanciais, não uma frase solta), ou um título em negrito (não itálico) + lista com marcador.
- **Fechamento:** mesma estrutura de conteúdo (parágrafos), mas com o logo branco de volta no rodapé — sem seta, porque é o último slide.
- Isso é o que `templates/slides.mjs` implementa (`capa`, `texto`, `lista`, `fechamento`).

## Fonte

`manual-de-identidade-e-com-plus.pdf`, recebido em 2026-07-20. Contato de referência no rodapé do manual: vitor@e-com.club.
