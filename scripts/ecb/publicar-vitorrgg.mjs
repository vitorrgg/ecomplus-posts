// Publica no Instagram pessoal @vitorrgg o post da série do livro que acabou de sair no
// @ecomplus.io: o mesmo carrossel, com a legenda em primeira pessoa. Roda no ecb-publicar.yml
// logo depois do @ecomplus.io; quando não há post do livro novo, não faz nada. Quando a série
// sai só no @vitorrgg (ecb/livro/config.json → contas sem "ecomplus"), quem publica é o
// publicar-instagram.mjs, direto da fila; este passo não faz nada.
//
// A legenda é a versão do LinkedIn (posts/<slug>/linkedin.txt, já em primeira pessoa) quando
// existe; senão, a legenda do @ecomplus.io com a chamada do livro trocada pela versão em
// primeira pessoa (ecb/livro/config.json). Ver legendaPessoal em livro.mjs.
//
// Uso:
//   node scripts/ecb/publicar-vitorrgg.mjs                 # post do livro dos últimos 7 dias ainda não publicado lá
//   node scripts/ecb/publicar-vitorrgg.mjs --slug <slug>
//   node scripts/ecb/publicar-vitorrgg.mjs --dry-run
//
// Variáveis: IG_VITORRGG_USER_ID e IG_VITORRGG_ACCESS_TOKEN (login do Instagram, graph.instagram.com).
import { args, gravarJson, HISTORICO, lerHistorico } from './util.mjs';
import { CONTAS, PAUSADA, AVISO_PAUSA, legendaPessoal } from './livro.mjs';
import { publicar, contaVitorrgg } from './publicar-instagram.mjs';
import { enviar } from './notificar-slack.mjs';

function proximo(historico) {
  const limite = Date.now() - 7 * 24 * 3600 * 1000;
  return [...historico.publicados].reverse().find((p) => (p.serie === 'livro' || p.slug.startsWith('livro-'))
    && !p.vitorrgg && (!p.publicadoEm || Date.parse(p.publicadoEm) > limite))?.slug;
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  if (PAUSADA && typeof opts.slug !== 'string') { console.log(AVISO_PAUSA.replace(': pule o passo do livro', '')); process.exit(0); }
  if (!CONTAS.includes('ecomplus') && typeof opts.slug !== 'string') { console.log('A série do livro sai só no @vitorrgg, direto da fila: nada a espelhar aqui.'); process.exit(0); }
  const historico = lerHistorico();
  const slug = typeof opts.slug === 'string' ? opts.slug : proximo(historico);
  if (!slug) { console.log('Nenhum post do livro novo para o @vitorrgg.'); process.exit(0); }
  const item = historico.publicados.find((p) => p.slug === slug);
  if (item?.vitorrgg) { console.log(`${slug} já está no @vitorrgg: ${item.vitorrgg.permalink ?? item.vitorrgg.id}`); process.exit(0); }

  const conta = contaVitorrgg();
  if (!opts['dry-run'] && (!conta.usuario || !conta.token)) { console.warn('⚠ IG_VITORRGG_* ausentes — nada publicado no @vitorrgg.'); process.exit(0); }

  console.log('@vitorrgg');
  const r = await publicar({ slug, dryRun: Boolean(opts['dry-run']), conta, legenda: legendaPessoal(slug) });
  if (r.dryRun) process.exit(0);
  if (item) {
    item.vitorrgg = { id: r.id, permalink: r.permalink, publicadoEm: new Date().toISOString() };
    gravarJson(HISTORICO, historico);
  }
  await enviar({ text: `✅ *Publicado no Instagram @vitorrgg:* \`${slug}\`${r.permalink ? `\n<${r.permalink}|abrir post>` : ''}` });
}
