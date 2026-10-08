// Traz vídeos de uma pasta da sua máquina para a fila (videos/<slug>/video.mp4 +
// videos/fila.json), agendando um por semana. Feito para cortes de consultoria que saem do
// montador de vídeos. Roda no WSL, dentro do clone deste repo.
//
// Uso:
//   node scripts/videos/importar.mjs ~/<pasta>/saida/cortes --prefixo consultoria \
//     --ocultar <nome-do-cliente> --destinos vitorrgg --dia ter --hora 18:00 --inicio 2026-10-13
//
//   --prefixo   começo do slug de cada vídeo (consultoria → consultoria-01-<nome-do-arquivo>)
//   --ocultar   nomes que não podem aparecer (separados por vírgula): saem do slug, que vira
//               caminho público no GitHub, e o corte cuja transcrição cita algum deles fica
//               travado com um aviso para conferir o vídeo
//   --destinos  vitorrgg, instagram (@ecomplus.io) e/ou youtube, separados por vírgula
//   --dia       dom seg ter qua qui sex sab (um vídeo por semana nesse dia)
//   --hora      HH:MM no horário de São Paulo
//   --inicio    AAAA-MM-DD a partir de quando agendar (padrão: hoje)
//
// Se houver transcrição ao lado do vídeo (mesmo nome, .srt/.vtt/.txt), ela vem junto como
// transcricao.<ext>, para a legenda ser escrita a partir dela. Sem legenda.txt, o item entra
// com "aprovado": false e só publica depois que a legenda existir e o aprovado sair.
import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { root, args, lerJson, gravarJson, slugify } from '../ecb/util.mjs';

const LIMITE_MB = 95; // o GitHub recusa arquivo acima de 100 MB
const DIAS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

const opts = args();
const origem = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!origem || !existsSync(origem) || typeof opts.prefixo !== 'string') {
  console.error('Uso: node scripts/videos/importar.mjs <pasta> --prefixo <prefixo> [--destinos vitorrgg] [--dia ter] [--hora 18:00] [--inicio AAAA-MM-DD]');
  process.exit(1);
}
const destinos = String(opts.destinos ?? 'vitorrgg').split(',').map((d) => d.trim());
const ocultar = typeof opts.ocultar === 'string' ? opts.ocultar.split(',').map((t) => slugify(t)).filter(Boolean) : [];
const semNomes = (slug) => ocultar.reduce((s, t) => s.split('-').join('~').replace(new RegExp(`(^|~)${t.replace(/-/g, '~')}(?=~|$)`, 'g'), '').split('~').filter(Boolean).join('-'), slug);
const citaNome = (texto) => ocultar.filter((t) => slugify(texto, 1e9).split('-').join(' ').includes(t.split('-').join(' ')));
const dia = DIAS[String(opts.dia ?? 'ter').slice(0, 3).toLowerCase()];
const [hh, mm] = String(opts.hora ?? '18:00').split(':');
if (dia === undefined || !/^\d{1,2}$/.test(hh) || !/^\d{2}$/.test(mm ?? '')) { console.error('--dia ou --hora inválido.'); process.exit(1); }

// Datas: a partir de --inicio, toda semana no dia pedido, pulando as que já têm item na fila
// para os mesmos destinos.
const fila = lerJson(join(root, 'videos', 'fila.json'), { pendentes: [] });
const ocupadas = new Set(fila.pendentes.filter((p) => (p.destinos ?? ['instagram', 'youtube']).some((d) => destinos.includes(d)))
  .map((p) => p.quando?.slice(0, 10)));
let data = new Date(`${opts.inicio ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
while (data.getUTCDay() !== dia) data.setUTCDate(data.getUTCDate() + 1);
const proximaData = () => {
  while (ocupadas.has(data.toISOString().slice(0, 10))) data.setUTCDate(data.getUTCDate() + 7);
  const d = data.toISOString().slice(0, 10);
  ocupadas.add(d);
  data.setUTCDate(data.getUTCDate() + 7);
  return `${d}T${hh.padStart(2, '0')}:${mm}:00-03:00`;
};

const videos = readdirSync(origem).filter((f) => /\.mp4$/i.test(f)).sort();
if (!videos.length) { console.error(`Nenhum .mp4 em ${origem}.`); process.exit(1); }

const novos = [];
for (const [i, arquivo] of videos.entries()) {
  const nome = basename(arquivo, extname(arquivo));
  const slug = [slugify(opts.prefixo), String(i + 1).padStart(2, '0'), semNomes(slugify(nome, 60)).slice(0, 40)]
    .filter(Boolean).join('-').replace(/-+$/, '');
  if (fila.pendentes.some((p) => p.slug === slug) || existsSync(join(root, 'videos', slug, 'video.mp4'))) {
    console.log(`· já existe: ${slug}`);
    continue;
  }
  const mb = statSync(join(origem, arquivo)).size / 1048576;
  if (mb > LIMITE_MB) {
    console.error(`✗ ${arquivo}: ${mb.toFixed(0)} MB passa do limite do GitHub. Reduza antes, por exemplo:\n  ffmpeg -i "${arquivo}" -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 128k menor.mp4`);
    continue;
  }
  const dir = join(root, 'videos', slug);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(origem, arquivo), join(dir, 'video.mp4'));
  const citados = new Set();
  for (const ext of ['.srt', '.vtt', '.txt']) {
    const t = join(origem, nome + ext);
    if (!existsSync(t)) continue;
    copyFileSync(t, join(dir, `transcricao${ext}`));
    for (const n of citaNome(readFileSync(t, 'utf8'))) citados.add(n);
  }
  const temLegenda = existsSync(join(dir, 'legenda.txt'));
  const obs = [temLegenda ? null : 'falta legenda.txt', citados.size ? 'a transcrição cita um nome do --ocultar: confira o vídeo' : null].filter(Boolean);
  const item = { slug, quando: proximaData(), destinos, ...(obs.length ? { aprovado: false, obs: obs.join('; ') } : {}) };
  if (citados.size) console.warn(`⚠ ${slug}: a transcrição cita ${[...citados].join(', ')}. O corte fica travado até você conferir o vídeo.`);
  fila.pendentes.push(item);
  novos.push(item);
  console.log(`✓ ${slug} (${mb.toFixed(1)} MB) → ${item.quando}${temLegenda ? '' : ' (falta legenda)'}`);
}

fila.pendentes.sort((a, b) => String(a.quando ?? '').localeCompare(String(b.quando ?? '')));
gravarJson(join(root, 'videos', 'fila.json'), fila);
if (novos.length) {
  console.log(`\n${novos.length} vídeo(s) na fila. Para mandar:\n  git checkout -b videos/${slugify(opts.prefixo)}\n  git add videos && git commit -m "feat(videos): cortes ${slugify(opts.prefixo)}"\n  git push -u origin videos/${slugify(opts.prefixo)}`);
}
