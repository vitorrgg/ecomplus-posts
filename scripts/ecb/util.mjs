import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Segunda-feira da semana corrente, em YYYY-MM-DD (fuso de São Paulo).
export function segundaDaSemana(data = new Date()) {
  const sp = new Date(data.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = sp.getDay(); // 0 = domingo
  sp.setDate(sp.getDate() - ((dia + 6) % 7));
  return sp.toISOString().slice(0, 10);
}

export function lerJson(caminho, padrao) {
  if (!existsSync(caminho)) return padrao;
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

export function gravarJson(caminho, dados) {
  writeFileSync(caminho, JSON.stringify(dados, null, 2) + '\n');
}

// --chave valor / --flag  →  { chave: 'valor', flag: true }
export function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true;
    else { out[k] = v; i++; }
  }
  return out;
}

export function slugify(texto, max = 40) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/, '');
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»' };
export function decodeHtml(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export const HISTORICO = join(root, 'ecb', 'historico.json');
export const FILA = join(root, 'ecb', 'fila.json');
export function lerHistorico() { return lerJson(HISTORICO, { gerados: [], publicados: [] }); }
export function lerFila() { return lerJson(FILA, { pendentes: [] }); }
