import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import yaml from 'js-yaml';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverSlide, textSlide, listSlide, closingSlide } from '../templates/slides.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const BUILDERS = {
  capa: coverSlide,
  texto: textSlide,
  lista: listSlide,
  fechamento: closingSlide,
};

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

const slides = slideBlocks.map((block, i) => {
  const yamlMatch = block.match(/```yaml\n([\s\S]*?)```/);
  if (!yamlMatch) {
    throw new Error(`Slide ${i + 1}: não achei um bloco \`\`\`yaml ... \`\`\``);
  }
  const data = yaml.load(yamlMatch[1]);
  if (!data.tipo || !BUILDERS[data.tipo]) {
    throw new Error(`Slide ${i + 1}: "tipo" precisa ser um de ${Object.keys(BUILDERS).join(', ')} (veio "${data.tipo}")`);
  }
  // Gotcha comum: um ":" seguido de espaço dentro de um item de lista vira um
  // mapeamento YAML em vez de string (ex: "- fez isso: e aquilo" → objeto).
  // Falha aqui com erro claro em vez de deixar o Satori quebrar depois.
  for (const field of ['paragrafos', 'itens']) {
    if (Array.isArray(data[field])) {
      data[field].forEach((item, j) => {
        if (typeof item !== 'string') {
          throw new Error(
            `Slide ${i + 1}: "${field}[${j}]" não é uma string (veio ${JSON.stringify(item)}). ` +
            `Provavelmente tem um ":" seguido de espaço no meio do texto — envolva a linha em aspas no YAML.`,
          );
        }
      });
    }
  }
  return data;
});

if (slides.length === 0) {
  console.error('Nenhum slide encontrado — o brief precisa usar "## Slide 1", "## Slide 2" etc.');
  process.exit(1);
}

const fontDisplay = readFileSync(join(root, 'templates', 'fonts', 'FiraSansCondensed-Italic-600.woff'));
const fontBody = readFileSync(join(root, 'templates', 'fonts', 'RedHatDisplay-Regular-400.woff'));
const fontBodyBold = readFileSync(join(root, 'templates', 'fonts', 'RedHatDisplay-Bold-700.woff'));

const outDir = join(root, 'output', slug);
mkdirSync(outDir, { recursive: true });

for (let i = 0; i < slides.length; i++) {
  const { tipo, ...data } = slides[i];
  const tree = BUILDERS[tipo](data);

  const svg = await satori(tree, {
    width: 1080,
    height: 1350,
    fonts: [
      { name: 'Fira Sans Condensed', data: fontDisplay, weight: 600, style: 'italic' },
      { name: 'Red Hat Display', data: fontBody, weight: 400, style: 'normal' },
      { name: 'Red Hat Display', data: fontBodyBold, weight: 700, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  const png = resvg.render().asPng();

  const outPath = join(outDir, `slide-${i + 1}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath} (${tipo})`);
}
