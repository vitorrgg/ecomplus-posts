// Token de uma conta do Instagram ligada pelo "login do Instagram" (hoje o @vitorrgg). Esse
// token vale 60 dias, mas pode ser renovado pela API enquanto ainda vale e tem mais de 24 h.
// O workflow ig-token.yml roda toda segunda: confere o token e renova, gravando o novo no
// secret do GitHub. Se não der para renovar, avisa no #conteudo.
//
// Uso:
//   node scripts/instagram/token.mjs verificar --conta vitorrgg   # o token funciona? de qual conta?
//   node scripts/instagram/token.mjs renovar --conta vitorrgg     # renova e grava no GitHub
//
// Variáveis (prefixo IG_<CONTA>_, ex. IG_VITORRGG_):
//   IG_<CONTA>_ACCESS_TOKEN    o token (secret)
//   IG_<CONTA>_USER_ID         id da conta do Instagram (secret), conferido contra o token
//   IG_<CONTA>_TOKEN_GERADO_EM AAAA-MM-DD da última geração/renovação (variable)
//   GH_SECRETS_TOKEN           token do GitHub com permissão de escrever secrets e variables
//                              neste repo; sem ele, o script não renova e só avisa quando
//                              o token passar de 45 dias
import { spawnSync } from 'node:child_process';
import { args } from '../ecb/util.mjs';
import { enviar } from '../ecb/notificar-slack.mjs';

const REPO = 'vitorrgg/ecomplus-posts';
const HOST = 'https://graph.instagram.com';
const VERSAO = process.env.IG_GRAPH_VERSION || 'v21.0';
const AVISO_DIAS = 45;

const conta = (c) => {
  const p = `IG_${c.toUpperCase()}_`;
  return {
    nome: c,
    token: process.env[`${p}ACCESS_TOKEN`],
    usuario: process.env[`${p}USER_ID`],
    geradoEm: process.env[`${p}TOKEN_GERADO_EM`],
    secretToken: `${p}ACCESS_TOKEN`,
    varData: `${p}TOKEN_GERADO_EM`,
  };
};

const idade = (data) => (data ? Math.floor((Date.now() - Date.parse(`${data}T00:00:00Z`)) / 86400000) : null);

async function quemSou(token) {
  const res = await fetch(`${HOST}/${VERSAO}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: token })}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`token recusado (${res.status}): ${json.error?.message ?? JSON.stringify(json)}`);
  return json;
}

async function avisar(c, motivo) {
  const texto = [
    `🔑 *Token do Instagram @${c.nome}:* ${motivo}`,
    'Para gerar um novo: developers.facebook.com/apps → app *ecomplus-posts* → Casos de uso → Instagram → *Configuração da API com login do Instagram* → *Gerar token* na linha do @' + c.nome + '.',
    `Grave em ${REPO} → Settings → Secrets and variables → Actions: secret \`${c.secretToken}\` e variable \`${c.varData}\` com a data de hoje.`,
  ].join('\n');
  await enviar({ text: texto });
}

async function verificar(c) {
  if (!c.token) throw new Error(`sem ${c.secretToken}`);
  const eu = await quemSou(c.token);
  if (c.usuario && String(eu.user_id) !== String(c.usuario)) {
    throw new Error(`o token é de @${eu.username} (${eu.user_id}), mas IG_${c.nome.toUpperCase()}_USER_ID é ${c.usuario}`);
  }
  const dias = idade(c.geradoEm);
  console.log(`✓ token de @${eu.username} (${eu.user_id})${dias === null ? '' : `, gerado há ${dias} dia(s)`}`);
  return { eu, dias };
}

async function renovar(c) {
  const { dias } = await verificar(c);
  // A API só renova token com mais de 24 h.
  if (dias !== null && dias < 2) { console.log('Token gerado há menos de 2 dias: fica para a próxima rodada.'); return; }
  const gh = process.env.GH_SECRETS_TOKEN;
  if (!gh) {
    console.log('Sem GH_SECRETS_TOKEN: não dá para gravar um token renovado, então não renovo.');
    if (dias !== null && dias >= AVISO_DIAS) await avisar(c, `foi gerado há ${dias} dias e vence por volta do dia 60. Sem o GH_SECRETS_TOKEN a renovação automática não roda.`);
    return;
  }
  const res = await fetch(`${HOST}/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: c.token })}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`renovação recusada (${res.status}): ${json.error?.message ?? JSON.stringify(json)}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${json.access_token}`);
  await quemSou(json.access_token);

  const hoje = new Date().toISOString().slice(0, 10);
  const rodar = (a, input) => {
    const r = spawnSync('gh', [...a, '-R', REPO], { input, encoding: 'utf8', env: { ...process.env, GH_TOKEN: gh } });
    if (r.status !== 0) throw new Error(`gh ${a.slice(0, 3).join(' ')} falhou: ${r.stderr.trim()}`);
  };
  rodar(['secret', 'set', c.secretToken], json.access_token); // pelo stdin, fora da linha de comando
  rodar(['variable', 'set', c.varData, '--body', hoje]);
  console.log(`✓ renovado: vale mais ${Math.round(json.expires_in / 86400)} dias; ${c.secretToken} e ${c.varData} atualizados.`);
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const [acao] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const opts = args();
  if (!['verificar', 'renovar'].includes(acao) || typeof opts.conta !== 'string') {
    console.error('Uso: node scripts/instagram/token.mjs verificar|renovar --conta <conta>');
    process.exit(1);
  }
  const c = conta(opts.conta);
  try {
    await (acao === 'verificar' ? verificar(c) : renovar(c));
  } catch (e) {
    console.error(`✗ @${c.nome}: ${e.message}`);
    await avisar(c, `${acao === 'renovar' ? 'a renovação automática falhou' : 'a verificação falhou'} (${e.message}).`).catch(() => {});
    process.exit(1);
  }
}
