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
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, args, gravarJson, FILA, HISTORICO, lerFila, lerHistorico } from './util.mjs';

const HOST = process.env.IG_GRAPH_HOST || 'graph.facebook.com';
const VERSAO = process.env.IG_GRAPH_VERSION || 'v21.0';
const BASE_URL = (process.env.ECB_BASE_URL || 'https://raw.githubusercontent.com/vitorrgg/ecomplus-posts/master').replace(/\/$/, '');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(caminho, { method = 'GET', params = {}, token }) {
  const url = new URL(`https://${HOST}/${VERSAO}/${caminho}`);
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
async function esperarPronto(id, token, tentativas = 20) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code: status, status: detalhe } = await graph(id, { params: { fields: 'status_code,status' }, token });
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

export async function publicar({ slug, dryRun = false }) {
  const legendaArq = join(root, 'posts', slug, 'legenda.txt');
  const legenda = existsSync(legendaArq) ? readFileSync(legendaArq, 'utf8').trim() : '';
  const urls = imagensDoPost(slug);

  console.log(`Post: ${slug}\nImagens (${urls.length}):\n  ${urls.join('\n  ')}\nLegenda (${legenda.length} chars):\n${legenda.replace(/^/gm, '  ')}`);
  if (dryRun) { console.log('\n[dry-run] nada foi enviado ao Instagram.'); return { id: null, dryRun: true }; }

  const token = process.env.IG_ACCESS_TOKEN;
  const usuario = process.env.IG_USER_ID;
  if (!token || !usuario) throw new Error('Defina IG_USER_ID e IG_ACCESS_TOKEN.');

  // Confere que as URLs respondem antes de gastar chamadas na API.
  for (const u of urls) {
    const r = await fetch(u, { method: 'HEAD' });
    if (!r.ok) throw new Error(`Imagem não acessível publicamente (${r.status}): ${u} — o commit com output/${slug} já foi enviado?`);
  }

  const filhos = [];
  for (const image_url of urls) {
    const { id } = await graph(`${usuario}/media`, { method: 'POST', params: { image_url, is_carousel_item: 'true' }, token });
    await esperarPronto(id, token);
    filhos.push(id);
  }
  const { id: carrossel } = await graph(`${usuario}/media`, {
    method: 'POST', token,
    params: { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda },
  });
  await esperarPronto(carrossel, token);
  const { id: publicado } = await graph(`${usuario}/media_publish`, { method: 'POST', params: { creation_id: carrossel }, token });

  let permalink = null;
  try { ({ permalink } = await graph(publicado, { params: { fields: 'permalink' }, token })); } catch { /* opcional */ }
  console.log(`\n✓ publicado: ${permalink ?? publicado}`);
  return { id: publicado, permalink };
}

function proximoDaFila(fila) {
  const exige = String(process.env.ECB_EXIGE_APROVACAO).toLowerCase() === 'true';
  return fila.pendentes.find((p) => (exige ? p.aprovado === true : p.aprovado !== false));
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const fila = lerFila();
  const item = opts.slug ? { slug: opts.slug } : proximoDaFila(fila);
  if (!item) { console.log('Fila vazia (ou nada aprovado) — nada a publicar.'); process.exit(0); }

  const resultado = await publicar({ slug: item.slug, dryRun: Boolean(opts['dry-run']) });
  if (resultado.dryRun) process.exit(0);

  const historico = lerHistorico();
  const meta = fila.pendentes.find((p) => p.slug === item.slug) ?? item;
  historico.publicados.push({ ...meta, instagramId: resultado.id, permalink: resultado.permalink, publicadoEm: new Date().toISOString() });
  gravarJson(HISTORICO, historico);
  fila.pendentes = fila.pendentes.filter((p) => p.slug !== item.slug);
  gravarJson(FILA, fila);
}
