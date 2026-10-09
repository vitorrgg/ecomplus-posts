// Publica o próximo carrossel da fila (ecb/fila.json) no Instagram da
// e-com.plus pela Content Publishing API do Graph. Fluxo da API: um container
// por imagem (is_carousel_item) → container CAROUSEL com os filhos + legenda →
// media_publish. As imagens precisam estar em URL pública e em JPEG — como o
// repo é público, usamos o raw.githubusercontent.com do commit já enviado.
//
// Uso:
//   node scripts/ecb/publicar-instagram.mjs                # próximo pendente da fila
//   node scripts/ecb/publicar-instagram.mjs --slug <slug>  # um post específico
//   node scripts/ecb/publicar-instagram.mjs --dry-run      # monta tudo, não chama a API
//   node scripts/ecb/publicar-instagram.mjs --serie livro  # próximo pendente da série do livro
//                                                          # (padrão: ecb, as análises dos mais lidos)
//
// A série do livro sai no @ecomplus.io e/ou no @vitorrgg (ecb/livro/config.json → contas). Sem
// o @ecomplus.io, o post da fila vai direto para o @vitorrgg, com a legenda em primeira pessoa
// (IG_VITORRGG_USER_ID e IG_VITORRGG_ACCESS_TOKEN). No @ecomplus.io, os usuários de
// `colaboradores` são convidados como colaboradores do post (aparece nos dois perfis); o convite
// do @vitorrgg é aceito em seguida com o token dele, e se a API recusar, o Slack pede para aceitar
// no app.
//
// Variáveis de ambiente:
//   IG_USER_ID        id da conta profissional do Instagram
//   IG_ACCESS_TOKEN   token de longa duração (ou de usuário do sistema) com
//                     instagram_basic + instagram_content_publish
//   IG_GRAPH_HOST     graph.facebook.com (padrão, login via Facebook) ou
//                     graph.instagram.com (login direto do Instagram)
//   IG_GRAPH_VERSION  v21.0 (padrão)
//   ECB_BASE_URL      base pública das imagens; padrão raw do GitHub em master
//   ECB_EXIGE_APROVACAO  "true" → só publica itens com aprovado: true na fila
import { readdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, args, gravarJson, lerJson, FILA, HISTORICO, lerFila, lerHistorico } from './util.mjs';
import { spawnSync } from 'node:child_process';
import { CONTAS as CONTAS_LIVRO, COLABORADORES as COLABORADORES_LIVRO, legendaPessoal } from './livro.mjs';
import { enviar } from './notificar-slack.mjs';

const HOST = process.env.IG_GRAPH_HOST || 'graph.facebook.com';
const VERSAO = process.env.IG_GRAPH_VERSION || 'v21.0';
// O endpoint de convites de colaboração é mais novo que a v21.0.
const VERSAO_CONVITES = process.env.IG_GRAPH_VERSION_CONVITES || 'v23.0';
const BASE_URL = (process.env.ECB_BASE_URL || 'https://raw.githubusercontent.com/vitorrgg/ecomplus-posts/master').replace(/\/$/, '');

// Instagram pessoal @vitorrgg (login do Instagram, token de 60 dias renovado pelo ig-token.yml).
export const contaVitorrgg = () => ({ host: 'graph.instagram.com', usuario: process.env.IG_VITORRGG_USER_ID, token: process.env.IG_VITORRGG_ACCESS_TOKEN });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(caminho, { method = 'GET', params = {}, token, host = HOST, versao = VERSAO }) {
  const url = new URL(`https://${host}/${versao}/${caminho}`);
  const corpo = new URLSearchParams({ ...params, access_token: token });
  const res = method === 'GET'
    ? await fetch(`${url}?${corpo}`)
    : await fetch(url, { method, body: corpo });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(`Graph ${method} ${caminho} → ${res.status} ${e.code ?? ''} ${e.error_subcode ?? ''}: ${e.message ?? JSON.stringify(json)}`);
  }
  return json;
}

// Containers de imagem processam de forma assíncrona; publicar antes de FINISHED
// dá erro 9007 "Media ID is not available".
async function esperarPronto(id, token, { tentativas = 20, host } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code: status, status: detalhe } = await graph(id, { params: { fields: 'status_code,status' }, token, host });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${id} em ${status}: ${detalhe ?? ''}`);
    await dormir(3000);
  }
  throw new Error(`Container ${id} não ficou pronto a tempo.`);
}

export function imagensDoPost(slug) {
  const dir = join(root, 'output', slug);
  if (!existsSync(dir)) throw new Error(`Sem output/${slug} — renderize antes.`);
  const jpgs = readdirSync(dir).filter((f) => /^slide-\d+\.jpg$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (jpgs.length < 2) throw new Error(`Carrossel precisa de 2 a 10 imagens JPEG; ${slug} tem ${jpgs.length} (rode scripts/ecb/jpeg.mjs).`);
  return jpgs.slice(0, 10).map((f) => `${BASE_URL}/output/${slug}/${f}`);
}

// `conta` troca a conta de destino ({ host, usuario, token }; padrão: o @ecomplus.io pelas
// variáveis IG_*), `legenda` troca a legenda (padrão: posts/<slug>/legenda.txt) e
// `colaboradores` (usuários, sem @, até 3) convida contas como colaboradoras do carrossel.
export async function publicar({ slug, dryRun = false, conta, legenda: legendaFixa, colaboradores = [] }) {
  const legendaArq = join(root, 'posts', slug, 'legenda.txt');
  const legenda = legendaFixa ?? (existsSync(legendaArq) ? readFileSync(legendaArq, 'utf8').trim() : '');
  const urls = imagensDoPost(slug);

  console.log(`Post: ${slug}\nImagens (${urls.length}):\n  ${urls.join('\n  ')}\nLegenda (${legenda.length} chars):\n${legenda.replace(/^/gm, '  ')}`);
  if (colaboradores.length) console.log(`Colaboradores: ${colaboradores.map((u) => `@${u}`).join(', ')}`);
  if (dryRun) { console.log('\n[dry-run] nada foi enviado ao Instagram.'); return { id: null, dryRun: true }; }

  const { token, usuario, host } = conta ?? { token: process.env.IG_ACCESS_TOKEN, usuario: process.env.IG_USER_ID, host: HOST };
  if (!token || !usuario) throw new Error('Defina IG_USER_ID e IG_ACCESS_TOKEN.');

  // Confere que as URLs respondem antes de gastar chamadas na API.
  for (const u of urls) {
    const r = await fetch(u, { method: 'HEAD' });
    if (!r.ok) throw new Error(`Imagem não acessível publicamente (${r.status}): ${u} — o commit com output/${slug} já foi enviado?`);
  }

  const filhos = [];
  for (const image_url of urls) {
    const { id } = await graph(`${usuario}/media`, { method: 'POST', params: { image_url, is_carousel_item: 'true' }, token, host });
    await esperarPronto(id, token, { host });
    filhos.push(id);
  }
  // Se o Instagram recusar os colaboradores (conta não elegível, por exemplo), o post sai sem
  // eles em vez de não sair.
  const criarCarrossel = (extra = {}) => graph(`${usuario}/media`, {
    method: 'POST', token, host, params: { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda, ...extra },
  });
  let carrossel;
  let erroColaboradores = null;
  if (colaboradores.length) {
    try { ({ id: carrossel } = await criarCarrossel({ collaborators: JSON.stringify(colaboradores) })); }
    catch (e) { erroColaboradores = e.message; console.warn(`⚠ colaboradores recusados, publicando sem eles: ${e.message}`); }
  }
  if (!carrossel) ({ id: carrossel } = await criarCarrossel());
  await esperarPronto(carrossel, token, { host });
  const { id: publicado } = await graph(`${usuario}/media_publish`, { method: 'POST', params: { creation_id: carrossel }, token, host });

  let permalink = null;
  try { ({ permalink } = await graph(publicado, { params: { fields: 'permalink' }, token, host })); } catch { /* opcional */ }
  console.log(`\n✓ publicado: ${permalink ?? publicado}`);
  return { id: publicado, permalink, erroColaboradores };
}

// Aceita, pela conta do colaborador, o convite de colaboração do post que acabou de sair
// (POST /{ig-user-id}/collaboration_invites com media_id e accept). O convite pode levar uns
// segundos para existir, então tenta algumas vezes antes de desistir.
export async function aceitarConvite(mediaId, conta, { tentativas = 3, espera = 15000 } = {}) {
  let erro;
  for (let i = 0; i < tentativas; i++) {
    if (i) await dormir(espera);
    try {
      await graph(`${conta.usuario}/collaboration_invites`, {
        method: 'POST', params: { media_id: mediaId, accept: 'true' }, token: conta.token, host: conta.host, versao: VERSAO_CONVITES,
      });
      return { ok: true };
    } catch (e) { erro = e; }
  }
  return { ok: false, erro: erro.message };
}

function proximoDaFila(fila, serie = 'ecb') {
  const exige = String(process.env.ECB_EXIGE_APROVACAO).toLowerCase() === 'true';
  return fila.pendentes.find((p) => (p.serie ?? 'ecb') === serie
    && (exige ? p.aprovado === true : p.aprovado !== false));
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const fila = lerFila();
  const serie = typeof opts.serie === 'string' ? opts.serie : 'ecb';
  if (serie === 'livro' && !opts.slug && lerJson(join(root, 'ecb', 'livro', 'config.json'), {}).ativa === false) {
    console.log('Série do livro pausada (ecb/livro/config.json → "ativa": false) — nada a publicar.');
    process.exit(0);
  }
  const item = opts.slug ? { slug: opts.slug } : proximoDaFila(fila, serie);
  if (!item) { console.log(`Fila vazia na série ${serie} (ou nada aprovado) — nada a publicar.`); process.exit(0); }

  const historico = lerHistorico();
  const jaPublicado = historico.publicados.find((p) => p.slug === item.slug);
  const meta = fila.pendentes.find((p) => p.slug === item.slug) ?? jaPublicado
    ?? historico.gerados.find((g) => g.slug === item.slug) ?? item;
  const daSerie = meta.serie ?? (item.slug.startsWith('livro-') ? 'livro' : 'ecb');
  const soVitorrgg = daSerie === 'livro' && !CONTAS_LIVRO.includes('ecomplus');
  let destino = {};
  if (soVitorrgg) {
    if (jaPublicado?.vitorrgg) { console.log(`${item.slug} já está no @vitorrgg: ${jaPublicado.vitorrgg.permalink ?? jaPublicado.vitorrgg.id}`); process.exit(0); }
    destino = { conta: contaVitorrgg(), legenda: legendaPessoal(item.slug) };
    if (!opts['dry-run'] && (!destino.conta.usuario || !destino.conta.token)) throw new Error('Defina IG_VITORRGG_USER_ID e IG_VITORRGG_ACCESS_TOKEN.');
    console.log('@vitorrgg (a série do livro sai só lá)');
  }

  const colaboradores = daSerie === 'livro' && !soVitorrgg ? COLABORADORES_LIVRO : [];

  const resultado = await publicar({ slug: item.slug, dryRun: Boolean(opts['dry-run']), colaboradores, ...destino });
  if (resultado.dryRun) process.exit(0);

  // O post já saiu; daqui para baixo nada derruba o workflow.
  let convite = null;
  if (resultado.erroColaboradores) {
    convite = { ok: false, erro: `o Instagram recusou o colaborador, e o post saiu só no @ecomplus.io: ${resultado.erroColaboradores}` };
  } else if (colaboradores.includes('vitorrgg')) {
    const conta = contaVitorrgg();
    convite = conta.usuario && conta.token
      ? await aceitarConvite(resultado.id, conta)
      : { ok: false, erro: 'IG_VITORRGG_USER_ID e IG_VITORRGG_ACCESS_TOKEN ausentes' };
    console.log(convite.ok ? '✓ convite de colaboração aceito pelo @vitorrgg' : `⚠ convite de colaboração não aceito pela API: ${convite.erro}`);
  }

  const agora = new Date().toISOString();
  if (soVitorrgg) {
    const vitorrgg = { id: resultado.id, permalink: resultado.permalink, publicadoEm: agora };
    if (jaPublicado) jaPublicado.vitorrgg = vitorrgg;
    else historico.publicados.push({ ...meta, vitorrgg, publicadoEm: agora });
  } else {
    historico.publicados.push({ ...meta, instagramId: resultado.id, permalink: resultado.permalink, publicadoEm: agora,
      ...(colaboradores.length && !resultado.erroColaboradores
        ? { colaboradores: colaboradores.map((u) => ({ usuario: u, aceito: u === 'vitorrgg' && Boolean(convite?.ok) })) } : {}) });
  }
  gravarJson(HISTORICO, historico);
  fila.pendentes = fila.pendentes.filter((p) => p.slug !== item.slug);
  gravarJson(FILA, fila);
  // No GitHub Actions, o slug publicado vai para o passo seguinte (o do LinkedIn).
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `slug=${item.slug}\n`);

  // Aviso no Slack (opcional: sem SLACK_* o script só avisa e sai).
  spawnSync(process.execPath, [join(root, 'scripts', 'ecb', 'notificar-slack.mjs'), '--publicado', '--link', resultado.permalink ?? '',
    ...(soVitorrgg ? ['--rede', 'vitorrgg'] : []), item.slug], { stdio: 'inherit' });
  if (convite && !convite.ok) {
    const texto = resultado.erroColaboradores
      ? `⚠️ *Post sem colaborador:* \`${item.slug}\` saiu no @ecomplus.io, mas o Instagram recusou o @vitorrgg como colaborador (${resultado.erroColaboradores}). Dá para convidar pelo app, editando o post.`
      : `⚠️ *Convite de colaboração pendente:* o post \`${item.slug}\` saiu no @ecomplus.io, mas não consegui aceitar o convite pelo @vitorrgg (${convite.erro}). Aceite no app do Instagram do @vitorrgg (notificações ou Direct) para o post aparecer no perfil também.`;
    await enviar({ text: `${texto}${resultado.permalink ? `\n<${resultado.permalink}|abrir post>` : ''}` }).catch((e) => console.warn(`⚠ aviso no Slack falhou: ${e.message}`));
  }
}
