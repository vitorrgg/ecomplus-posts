// Converte os PNGs de output/<slug>/ em JPEG (slide-N.jpg). A API de publicação
// do Instagram só aceita JPEG por URL pública; os PNGs continuam sendo a saída
// principal do render.
//
// Uso: node scripts/ecb/jpeg.mjs <slug> [<slug>...]
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './util.mjs';

export async function converter(slug) {
  const dir = join(root, 'output', slug);
  const pngs = readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (!pngs.length) throw new Error(`Nenhum slide-N.png em ${dir} — rode npm run render -- ${slug}`);
  const saidas = [];
  for (const png of pngs) {
    const jpg = join(dir, png.replace(/\.png$/, '.jpg'));
    await sharp(join(dir, png)).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(jpg);
    saidas.push(jpg);
  }
  return saidas;
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const slugs = process.argv.slice(2);
  if (!slugs.length) { console.error('Uso: node scripts/ecb/jpeg.mjs <slug> [...]'); process.exit(1); }
  for (const slug of slugs) {
    const jpgs = await converter(slug);
    console.log(`✓ ${slug}: ${jpgs.length} jpg`);
  }
}
