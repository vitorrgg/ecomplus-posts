import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const template = readFileSync(join(root, 'templates', 'slide-base.html'), 'utf8');
const tokens = readFileSync(join(root, 'templates', 'tokens.css'), 'utf8');

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

const outDir = join(root, 'output', slug);
mkdirSync(outDir, { recursive: true });

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

for (let i = 0; i < slides.length; i++) {
  const { titulo, texto } = slides[i];
  const html = template
    .replace('{{TOKENS}}', tokens)
    .replace('{{TITULO}}', escapeHtml(titulo))
    .replace('{{TEXTO}}', escapeHtml(texto).replace(/\n/g, '<br>'))
    .replace('{{SLIDE_ATUAL}}', String(i + 1))
    .replace('{{TOTAL_SLIDES}}', String(slides.length));
  await page.setContent(html, { waitUntil: 'networkidle' });
  const outPath = join(outDir, `slide-${i + 1}.png`);
  await page.screenshot({ path: outPath });
  console.log(`✓ ${outPath}`);
}

await browser.close();
