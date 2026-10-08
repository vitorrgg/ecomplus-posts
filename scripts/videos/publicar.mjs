// Publica o próximo vídeo da fila (videos/fila.json) como Reel no Instagram e
// como Short no YouTube. Cada item da fila é uma pasta em videos/<slug>/ com:
//   video.mp4            9:16, H.264 e AAC (o que sai do montador de anúncios serve)
//   legenda.txt          legenda do Reel e descrição do Short
//   titulo-youtube.txt   opcional; sem ele, o título é a primeira linha da legenda
//   capa.jpg             opcional; capa do Reel (sem ela, o Instagram escolhe um quadro)
//
// O Instagram lê o vídeo do raw.githubusercontent.com deste repo (que é público),
// então a pasta precisa estar comitada e enviada antes do horário marcado.
// O YouTube recebe o arquivo direto, por upload resumível.
//
// Uso:
//   node scripts/videos/publicar.mjs                 # próximo item da fila que já está na hora
//   node scripts/videos/publicar.mjs --slug <slug>   # um item específico, ignorando o horário
//   node scripts/videos/publicar.mjs --dry-run       # confere tudo, não publica nada
//   node scripts/videos/publicar.mjs --tem-algo      # só diz se há o que publicar agora (para o workflow)
//
// Só usa módulos do Node: o workflow roda de hora em hora sem `npm ci`.
//
// Variáveis de ambiente:
//   IG_USER_ID, IG_ACCESS_TOKEN  as mesmas da rotina de carrosséis (instagram_content_publish)
//   IG_GRAPH_HOST, IG_GRAPH_VERSION  graph.facebook.com e v21.0 por padrão
//   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN  OAuth do canal (escopo youtube.upload).
//                Sem elas, o YouTube fica pendente no item e o Instagram segue sozinho.
//   YT_PRIVACIDADE  public, unlisted ou private (padrão private). Sem a auditoria da API do
//                YouTube, o vídeo fica travado como privado e não dá para publicar depois: só
//                cadastre os segredos YT_* quando o projeto do Google for aprovado.
//   VIDEOS_EXIGE_APROVACAO  "true" → só publica itens com aprovado: true
//   ECB_BASE_URL  base pública do repo (padrão: raw do GitHub em master)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { root, args, lerJson, gravarJson } from '../ecb/util.mjs';

const FILA = join(root, 'videos', 'fila.json');
const HISTORICO = join(root, 'videos', 'historico.json');
const HOST = process.env.IG_GRAPH_HOST || 'graph.facebook.com';
const VERSAO = process.env.IG_GRAPH_VERSION || 'v21.0';
const BASE_URL = (process.env.ECB_BASE_URL || 'https://raw.githubusercontent.com/vitorrgg/ecomplus-posts/master').replace(/\/$/, '');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function arquivosDo(slug) {
  const dir = join(root, 'videos', slug);
  const video = join(dir, 'video.mp4');
  if (!existsSync(video)) throw new Error(`Sem videos/${slug}/video.mp4.`);
  const ler = (nome) => (existsSync(join(dir, nome)) ? readFileSync(join(dir, nome), 'utf8').trim() : '');
  const legenda = ler('legenda.txt');
  if (!legenda) throw new Error(`Sem videos/${slug}/legenda.txt.`);
  const titulo = (ler('titulo-youtube.txt') || legenda.split('\n')[0]).slice(0, 100);
  return {
    video,
    tamanho: statSync(video).size,
    legenda,
    titulo,
    videoUrl: `${BASE_URL}/videos/${slug}/video.mp4`,
    capaUrl: existsSync(join(dir, 'capa.jpg')) ? `${BASE_URL}/videos/${slug}/capa.jpg` : null,
  };
}

// --- Instagram: container REELS → espera processar → media_publish
async function graph(caminho, { method = 'GET', params = {}, token }) {
  const url = new URL(`https://${HOST}/${VERSAO}/${caminho}`);
  const corpo = new URLSearchParams({ ...params, access_token: token });
  const res = method === 'GET' ? await fetch(`${url}?${corpo}`) : await fetch(url, { method, body: corpo });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(`Graph ${method} ${caminho} → ${res.status} ${e.code ?? ''}: ${e.message ?? JSON.stringify(json)}`);
  }
  return json;
}

async function publicarInstagram(a) {
  const token = process.env.IG_ACCESS_TOKEN;
  const usuario = process.env.IG_USER_ID;
  if (!token || !usuario) throw new Error('Defina IG_USER_ID e IG_ACCESS_TOKEN.');
  const r = await fetch(a.videoUrl, { method: 'HEAD' });
  if (!r.ok) throw new Error(`Vídeo não acessível publicamente (${r.status}): ${a.videoUrl}. A pasta já foi enviada para a master?`);
  const params = { media_type: 'REELS', video_url: a.videoUrl, caption: a.legenda, share_to_feed: 'true' };
  if (a.capaUrl) params.cover_url = a.capaUrl;
  const { id } = await graph(`${usuario}/media`, { method: 'POST', params, token });
  // vídeo demora mais que imagem: até 10 min
  for (let i = 0; i < 60; i++) {
    const { status_code: st, status } = await graph(id, { params: { fields: 'status_code,status' }, token });
    if (st === 'FINISHED') break;
    if (st === 'ERROR' || st === 'EXPIRED') throw new Error(`Container ${id} em ${st}: ${status ?? ''}`);
    if (i === 59) throw new Error(`Container ${id} não ficou pronto em 10 min.`);
    await dormir(10000);
  }
  const { id: midia } = await graph(`${usuario}/media_publish`, { method: 'POST', params: { creation_id: id }, token });
  let permalink = null;
  try { ({ permalink } = await graph(midia, { params: { fields: 'permalink' }, token })); } catch { /* opcional */ }
  return { id: midia, link: permalink };
}

// --- YouTube: token pelo refresh token → sessão de upload resumível → envia o arquivo
async function publicarYoutube(a) {
  const { YT_CLIENT_ID: cid, YT_CLIENT_SECRET: seg, YT_REFRESH_TOKEN: rt } = process.env;
  if (!cid || !seg || !rt) return { pendente: 'sem credenciais do YouTube (YT_*)' };
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: cid, client_secret: seg, refresh_token: rt, grant_type: 'refresh_token' }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error(`Token do YouTube recusado: ${JSON.stringify(tok)}`);
  const titulo = /#shorts/i.test(a.titulo) ? a.titulo : `${a.titulo.slice(0, 91)} #shorts`;
  const sessao = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(a.tamanho),
    },
    body: JSON.stringify({
      snippet: { title: titulo, description: a.legenda, categoryId: '28', defaultLanguage: 'pt-BR' },
      status: { privacyStatus: process.env.YT_PRIVACIDADE || 'private', selfDeclaredMadeForKids: false },
    }),
  });
  const destino = sessao.headers.get('location');
  if (!destino) throw new Error(`YouTube não abriu o upload (${sessao.status}): ${await sessao.text()}`);
  const envio = await fetch(destino, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(a.tamanho) },
    body: readFileSync(a.video),
  });
  const json = await envio.json().catch(() => ({}));
  if (!envio.ok || !json.id) throw new Error(`Upload no YouTube falhou (${envio.status}): ${JSON.stringify(json)}`);
  return { id: json.id, link: `https://youtube.com/shorts/${json.id}`, privacidade: json.status?.privacyStatus };
}

const DESTINOS = { instagram: publicarInstagram, youtube: publicarYoutube };

// destino sem credencial fica pendente e não trava a fila: o item espera só por ele
const temCredencial = {
  instagram: () => Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID),
  youtube: () => Boolean(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN),
};
const destinosDo = (item) => item.destinos ?? ['instagram', 'youtube'];
const acionaveis = (item) => destinosDo(item).filter((d) => !item.feito?.[d] && temCredencial[d]?.());

function proximo(fila, agora = new Date()) {
  const exige = String(process.env.VIDEOS_EXIGE_APROVACAO).toLowerCase() === 'true';
  return fila.pendentes.find((p) => (exige ? p.aprovado === true : p.aprovado !== false)
    && (!p.quando || new Date(p.quando) <= agora) && acionaveis(p).length);
}

async function avisarSlack(texto) {
  const { SLACK_BOT_TOKEN: token, SLACK_CHANNEL_CONTEUDO: channel } = process.env;
  if (!token || !channel) return;
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel, text: texto, unfurl_links: false }),
  }).then((x) => x.json()).catch((e) => ({ ok: false, error: e.message }));
  if (!r.ok) console.log(`(Slack: ${r.error})`);
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const fila = lerJson(FILA, { pendentes: [] });
  if (opts['tem-algo']) {
    console.log(`tem=${Boolean(opts.slug || proximo(fila))}`);
    process.exit(0);
  }
  const item = opts.slug ? fila.pendentes.find((p) => p.slug === opts.slug) : proximo(fila);
  if (!item) { console.log('Nada na hora de publicar.'); process.exit(0); }

  const a = arquivosDo(item.slug);
  const destinos = destinosDo(item);
  item.feito = item.feito ?? {};
  console.log(`Vídeo: ${item.slug} (${(a.tamanho / 1048576).toFixed(1)} MB)\nDestinos: ${destinos.join(', ')}\nTítulo: ${a.titulo}\nLegenda:\n${a.legenda.replace(/^/gm, '  ')}`);
  if (opts['dry-run']) { console.log(`\n[dry-run] nada foi publicado. URL do Instagram: ${a.videoUrl}`); process.exit(0); }

  for (const destino of destinos) {
    if (item.feito[destino]) continue;
    if (!temCredencial[destino]?.()) {
      console.log(`${destino}: pendente (sem credenciais)`);
      continue;
    }
    try {
      const r = await DESTINOS[destino](a);
      if (r.pendente) { console.log(`${destino}: pendente (${r.pendente})`); continue; }
      item.feito[destino] = { ...r, em: new Date().toISOString() };
      console.log(`✓ ${destino}: ${r.link ?? r.id}`);
    } catch (e) {
      console.error(`✗ ${destino}: ${e.message}`);
      item.ultimoErro = { destino, mensagem: e.message, em: new Date().toISOString() };
    }
  }

  const completo = destinos.every((d) => item.feito[d]);
  if (completo) {
    const historico = lerJson(HISTORICO, { publicados: [] });
    historico.publicados.push({ ...item, publicadoEm: new Date().toISOString() });
    gravarJson(HISTORICO, historico);
    fila.pendentes = fila.pendentes.filter((p) => p.slug !== item.slug);
  }
  gravarJson(FILA, fila);

  const links = Object.entries(item.feito).map(([d, r]) => `${d}: ${r.link ?? r.id}`).join(' · ');
  if (links) await avisarSlack(`:clapper: Vídeo publicado: *${item.slug}*\n${links}`);
  if (!Object.keys(item.feito).length) process.exit(1);
}
