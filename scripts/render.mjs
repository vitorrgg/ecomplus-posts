import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slideBase } from '../templates/slide-base.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: npm run render -- <slug-do-post>');
  process.exit(1);
}

const briefPath = join(root, 'posts', slug, 'brief.md');
if (!existsSync(briefPath)) {
  console.error(`Não encontrei ${briefPath}`);
  process.exit(1);
}

const brief = readFileSync(briefPath, 'utf8');
const slideBlocks = brief.split(/^## Slide \d+\s*$/m).slice(1);
const slides = slideBlocks.map((block) => {
  const tituloMatch = block.match(/\*\*Título:\*\*\s*(.+)/);
  const titulo = tituloMatch ? tituloMatch[1].trim() : '';
  const texto = block.replace(/\*\*Título:\*\*\s*.+/, '').trim();
  return { titulo, texto };
});

if (slides.length === 0) {
  console.error('Nenhum slide encontrado — o brief precisa usar "## Slide 1", "## Slide 2" etc.');
  process.exit(1);
}

const fontDisplay = readFileSync(join(root, 'templates', 'fonts', 'FiraSansCondensed-Italic-600.woff'));
const fontBody = readFileSync(join(root, 'templates', 'fonts', 'RedHatDisplay-Regular-400.woff'));

const outDir = join(root, 'output', slug);
mkdirSync(outDir, { recursive: true });

for (let i = 0; i < slides.length; i++) {
  const { titulo, texto } = slides[i];
  const tree = slideBase({
    titulo,
    texto,
    slideAtual: i + 1,
    totalSlides: slides.length,
  });

  const svg = await satori(tree, {
    width: 1080,
    height: 1350,
    fonts: [
      { name: 'Fira Sans Condensed', data: fontDisplay, weight: 600, style: 'italic' },
      { name: 'Red Hat Display', data: fontBody, weight: 400, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  const png = resvg.render().asPng();

  const outPath = join(outDir, `slide-${i + 1}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath}`);
}
