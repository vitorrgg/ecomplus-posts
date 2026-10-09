// Publica no perfil pessoal do Vitor no LinkedIn o texto de um post
// (posts/<slug>/linkedin.txt), só texto, pela Posts API. Roda no mesmo workflow do
// Instagram, logo depois dele, com o slug que acabou de sair lá.
//
// Uso:
//   node scripts/ecb/publicar-linkedin.mjs --slug <slug>
//   node scripts/ecb/publicar-linkedin.mjs              # o post mais recente já publicado no
//                                                       # Instagram (7 dias) e ainda não no LinkedIn
//   node scripts/ecb/publicar-linkedin.mjs --dry-run    # mostra o texto convertido, não chama a API
//
// Variáveis de ambiente:
//   LINKEDIN_ACCESS_TOKEN  token do membro com w_member_social (dura 60 dias; gere e renove
//                          com scripts/ecb/linkedin-token.mjs)
//   LINKEDIN_AUTHOR        urn:li:person:<id> (opcional: sem ela, descobre pelo /v2/userinfo)
//   LINKEDIN_VERSION       versão AAAAMM da API (opcional: tenta as dos últimos meses)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, args, gravarJson, HISTORICO, lerHistorico } from './util.mjs';

const API = 'https://api.linkedin.com';

// O campo commentary usa o formato "little text": esses caracteres têm de ir escapados, senão
// o LinkedIn corta o texto no primeiro parêntese. Hashtag vira o elemento próprio dele.
const RESERVADOS = /[\\|{}@[\]()<>#*_~]/g;
export function paraLittleText(texto) {
  return texto.split(/(#[\p{L}\p{N}_]+)/u).map((parte) => (/^#[\p{L}\p{N}_]+$/u.test(parte)
    ? `{hashtag|\\#|${parte.slice(1)}}`
    : parte.replace(RESERVADOS, (c) => `\\${c}`))).join('');
}

// Versões da API são mensais (AAAAMM) e expiram depois de cerca de um ano.
function versoes() {
  if (process.env.LINKEDIN_VERSION) return [process.env.LINKEDIN_VERSION];
  const d = new Date();
  return [1, 2, 3, 4, 5, 6].map((atras) => {
    const m = new Date(d.getFullYear(), d.getMonth() - atras, 1);
    return `${m.getFullYear()}${String(m.getMonth() + 1).padStart(2, '0')}`;
  });
}

export class TokenInvalido extends Error {}

async function autor(token) {
  if (process.env.LINKEDIN_AUTHOR) return process.env.LINKEDIN_AUTHOR;
  const res = await fetch(`${API}/v2/userinfo`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new TokenInvalido('token do LinkedIn inválido ou vencido (401 no /v2/userinfo)');
  if (!res.ok) throw new Error(`/v2/userinfo → ${res.status}: ${await res.text()}`);
  return `urn:li:person:${(await res.json()).sub}`;
}

export async function publicarTexto(texto, { token }) {
  const author = await autor(token);
  const corpo = {
    author,
    commentary: paraLittleText(texto),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  let ultimoErro;
  for (const versao of versoes()) {
    const res = await fetch(`${API}/rest/posts`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'linkedin-version': versao,
        'x-restli-protocol-version': '2.0.0',
      },
      body: JSON.stringify(corpo),
    });
    if (res.status === 201) {
      const urn = res.headers.get('x-restli-id');
      return { urn, permalink: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null, versao };
    }
    const erro = await res.text();
    if (res.status === 401) throw new TokenInvalido(`token do LinkedIn inválido ou vencido (401): ${erro}`);
    ultimoErro = `POST /rest/posts (versão ${versao}) → ${res.status}: ${erro}`;
    // Versão fora do ar: tenta a anterior. Qualquer outro erro é definitivo.
    if (!/VERSION|version/.test(erro)) break;
  }
  throw new Error(ultimoErro);
}

function textoDoPost(slug) {
  const arq = join(root, 'posts', slug, 'linkedin.txt');
  return existsSync(arq) ? readFileSync(arq, 'utf8').trim() : null;
}

// Mais recente já publicado no Instagram, com texto do LinkedIn, ainda não publicado lá.
function proximo(historico) {
  const limite = Date.now() - 7 * 24 * 3600 * 1000;
  return [...historico.publicados].reverse().find((p) => !p.linkedin && textoDoPost(p.slug)
    && (!p.publicadoEm || Date.parse(p.publicadoEm) > limite))?.slug;
}

const avisar = (...a) => spawnSync(process.execPath, [join(root, 'scripts', 'ecb', 'notificar-slack.mjs'), ...a], { stdio: 'inherit' });

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const historico = lerHistorico();
  const slug = typeof opts.slug === 'string' ? opts.slug : proximo(historico);
  if (!slug) { console.log('Nada a publicar no LinkedIn.'); process.exit(0); }
  const texto = textoDoPost(slug);
  if (!texto) { console.log(`${slug} não tem posts/${slug}/linkedin.txt — nada a publicar no LinkedIn.`); process.exit(0); }
  const item = historico.publicados.find((p) => p.slug === slug);
  if (item?.linkedin) { console.log(`${slug} já está no LinkedIn: ${item.linkedin.permalink ?? item.linkedin.urn}`); process.exit(0); }

  console.log(`LinkedIn: ${slug} (${texto.length} caracteres)`);
  if (opts['dry-run']) { console.log(`\n${paraLittleText(texto)}\n\n[dry-run] nada foi enviado ao LinkedIn.`); process.exit(0); }

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) { console.warn('⚠ LINKEDIN_ACCESS_TOKEN ausente — sem post no LinkedIn.'); process.exit(0); }
  try {
    const r = await publicarTexto(texto, { token });
    console.log(`✓ LinkedIn: ${r.permalink ?? r.urn} (API ${r.versao})`);
    if (item) {
      item.linkedin = { urn: r.urn, permalink: r.permalink, publicadoEm: new Date().toISOString() };
      gravarJson(HISTORICO, historico);
    }
    avisar('--publicado', '--rede', 'linkedin', '--link', r.permalink ?? '', slug);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    if (e instanceof TokenInvalido) avisar('--token-linkedin', 'vencido');
    process.exit(1);
  }
}
