// Rotina semanal completa: coleta os mais lidos → gera os briefs → renderiza
// os PNGs → converte em JPEG. Não publica: a publicação é o passo separado
// (publicar-instagram.mjs), que roda em outros dias pra espaçar os posts.
//
// Uso:
//   node scripts/ecb/semana.mjs                  # 3 artigos, semana corrente
//   node scripts/ecb/semana.mjs --limite 2
//   node scripts/ecb/semana.mjs --via api        # API da Claude em vez do `claude -p` (padrão)
//   node scripts/ecb/semana.mjs --exemplo        # sem modelo nenhum (brief fixo)
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { root, args, segundaDaSemana, lerFila } from './util.mjs';

const opts = args();
const semana = segundaDaSemana();
const node = process.execPath;
const roda = (script, ...a) => execFileSync(node, [join(root, 'scripts', ...script), ...a], { stdio: 'inherit', cwd: root });

console.log(`== Semana ${semana} ==`);
const antes = new Set(lerFila().pendentes.map((p) => p.slug));

roda(['ecb', 'mais-lidos.mjs'], '--limite', String(opts.limite ?? 3));
roda(['ecb', 'gerar-briefs.mjs'], '--semana', semana,
  ...(opts.exemplo ? ['--exemplo'] : []), ...(opts.via ? ['--via', opts.via] : []));

const novos = lerFila().pendentes.map((p) => p.slug).filter((s) => !antes.has(s));
if (!novos.length) { console.log('Nenhum post novo nesta rodada.'); process.exit(0); }

for (const slug of novos) {
  roda(['render.mjs'], slug);
  roda(['ecb', 'jpeg.mjs'], slug);
}
console.log(`\n✓ ${novos.length} post(s) prontos na fila: ${novos.join(', ')}`);
