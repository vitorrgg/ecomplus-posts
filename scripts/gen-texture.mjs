// Gera templates/assets/stripes.png — textura de listras diagonais usada como
// camada sobre o gradiente escuro, igual aos exemplos em identidade/exemplos.
// Roda uma vez; o PNG resultante fica versionado, não precisa gerar de novo.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'templates', 'assets');
mkdirSync(outDir, { recursive: true });

const W = 1080;
const H = 1350;

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="stripes" width="26" height="26" patternTransform="rotate(115)" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="26" stroke="#ffffff" stroke-width="1.6" stroke-opacity="0.07"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#stripes)"/>
</svg>
`;

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: W } });
const png = resvg.render().asPng();
writeFileSync(join(outDir, 'stripes.png'), png);
console.log('✓ templates/assets/stripes.png');
