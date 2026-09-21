// Avisa no Slack (#conteúdo) que posts foram gerados, ou publicados, no mesmo
// padrão da notificação de contatos/sign-ups do site (bot token + chat.postMessage,
// ver www.e-com.plus/functions/SLACK_SETUP.md). Sem dependência: chama a Web API
// direto com fetch.
//
// Uso:
//   node scripts/ecb/notificar-slack.mjs <slug> [<slug>...]           # "post gerado" (padrão)
//   node scripts/ecb/notificar-slack.mjs --publicado <slug> --link <permalink>
//   node scripts/ecb/notificar-slack.mjs --dry-run <slug>              # imprime o payload, não envia
//
// As imagens são enviadas como arquivos (files.getUploadURLExternal →
// files.completeUploadExternal), então aparecem no Slack mesmo antes do push.
//
// Variáveis: SLACK_BOT_TOKEN (xoxb-…, escopos chat:write, files:write e, pra canal
// público sem convite, chat:write.public), SLACK_CHANNEL_CONTEUDO (ID do canal,
// ex. C031BR9HY2K — pra upload precisa ser o ID, não o nome).
// Sem token ou canal, o script avisa e sai com 0 — a rotina não quebra por causa
// de notificação.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { root, args, lerFila, lerHistorico } from './util.mjs';

const REPO_URL = 'https://github.com/vitorrgg/ecomplus-posts';

function lerPost(slug) {
  const dir = join(root, 'posts', slug);
  const brief = readFileSync(join(dir, 'brief.md'), 'utf8');
  const legendaArq = join(dir, 'legenda.txt');
  const legenda = existsSync(legendaArq) ? readFileSync(legendaArq, 'utf8').trim() : '';
  const slides = brief.split(/^## Slide \d+\s*$/m).slice(1).map((b) => {
    const m = b.match(/```yaml\n([\s\S]*?)```/);
    return m ? yaml.load(m[1]) : {};
  });
  const capa = slides[0] ?? {};
  // url do artigo que serviu de pauta: fila/histórico guardam em `fonte`
  const meta = [...lerFila().pendentes, ...lerHistorico().gerados, ...lerHistorico().publicados].find((x) => x.slug === slug);
  const fonte = meta?.fonte ?? (brief.match(/https?:\/\/www\.ecommercebrasil\.com\.br\/\S+/) ?? [null])[0];
  const outDir = join(root, 'output', slug);
  const jpgs = existsSync(outDir)
    ? readdirSync(outDir).filter((f) => /^slide-\d+\.jpg$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    : [];
  return {
    slug,
    titulo: String(capa.titulo ?? slug).replace(/\n/g, ' '),
    subtitulo: capa.subtitulo ?? '',
    legenda,
    fonte,
    nSlides: slides.length,
    imagens: jpgs.map((f) => join(outDir, f)),
  };
}

// Post gerado: uma mensagem só, com as imagens anexadas e a legenda no texto
// (initial_comment do upload aceita mrkdwn).
export function montarMensagemGerado(post) {
  const texto = [
    `🆕 *Post gerado: ${post.titulo}*`,
    `_${post.subtitulo}_ · ${post.nSlides} slides · \`${post.slug}\``,
    post.fonte ? `Pauta: <${post.fonte}|artigo no E-Commerce Brasil>` : null,
    '',
    '*Legenda:*',
    post.legenda.slice(0, 2900),
    '',
    `_Entra na fila de publicação (seg/qua/sex 12:00). Pra vetar, \`"aprovado": false\` em \`ecb/fila.json\`._`,
  ].filter((l) => l !== null).join('\n');
  return { text: texto };
}

export function montarMensagemPublicado(post, link) {
  return {
    text: `Publicado no Instagram: ${post.titulo}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `✅ *Publicado no Instagram:* ${post.titulo}${link ? `\n<${link}|abrir post>` : ''}` } },
    ],
  };
}

async function slackApi(token, metodo, corpo, { form = false } = {}) {
  const res = await fetch(`https://slack.com/api/${metodo}`, {
    method: 'POST',
    headers: form
      ? { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${token}` }
      : { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
    body: form ? new URLSearchParams(corpo) : JSON.stringify(corpo),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${metodo}: ${json.error}`);
  return json;
}

// Sobe os arquivos e publica todos numa mensagem só (thread da mensagem principal,
// se `thread_ts` vier). Fluxo novo de upload do Slack, em três chamadas.
async function enviarArquivos(token, channel, arquivos, { comentario, thread_ts } = {}) {
  const enviados = [];
  for (const caminho of arquivos) {
    const nome = caminho.split('/').slice(-2).join('-');
    const tamanho = statSync(caminho).size;
    const { upload_url, file_id } = await slackApi(token, 'files.getUploadURLExternal', { filename: nome, length: String(tamanho) }, { form: true });
    const up = await fetch(upload_url, { method: 'POST', body: readFileSync(caminho) });
    if (!up.ok) throw new Error(`Upload de ${nome} falhou: ${up.status}`);
    enviados.push({ id: file_id, title: nome });
  }
  return slackApi(token, 'files.completeUploadExternal', {
    files: enviados, channel_id: channel,
    ...(comentario ? { initial_comment: comentario } : {}),
    ...(thread_ts ? { thread_ts } : {}),
  });
}

export async function enviar(mensagem, { dryRun = false, arquivos = [] } = {}) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_CONTEUDO;
  if (dryRun) { console.log(JSON.stringify({ channel, ...mensagem, arquivos }, null, 2)); return { ok: true, dryRun: true }; }
  if (!token || !channel) { console.warn('⚠ SLACK_BOT_TOKEN / SLACK_CHANNEL_CONTEUDO ausentes — sem aviso no Slack.'); return { ok: false, skipped: true }; }
  // Com arquivos, o texto vai como comentário do upload: imagens e legenda numa
  // mensagem só. Sem arquivos (aviso de publicado), é uma mensagem comum.
  if (arquivos.length) return enviarArquivos(token, channel, arquivos, { comentario: mensagem.text });
  return slackApi(token, 'chat.postMessage', { channel, unfurl_links: false, unfurl_media: false, ...mensagem });
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const slugs = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--link');
  if (!slugs.length) { console.error('Uso: node scripts/ecb/notificar-slack.mjs [--publicado --link <url>] [--dry-run] <slug>...'); process.exit(1); }
  for (const slug of slugs) {
    const post = lerPost(slug);
    const msg = opts.publicado ? montarMensagemPublicado(post, opts.link) : montarMensagemGerado(post);
    const r = await enviar(msg, { dryRun: Boolean(opts['dry-run']), arquivos: opts.publicado ? [] : post.imagens });
    if (r.ok && !r.dryRun) console.log(`✓ Slack: ${post.titulo}`);
  }
}
