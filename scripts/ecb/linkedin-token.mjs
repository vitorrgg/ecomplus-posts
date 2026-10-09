// Token do LinkedIn do perfil pessoal do Vitor: o token de membro vale 60 dias e, fora do
// programa de parceiros, não tem renovação automática. Este script gera um token novo com
// um login no navegador (roda na sua máquina) e verifica quanto falta para vencer (roda
// toda segunda no GitHub Actions e avisa no #conteudo quando faltam 10 dias ou menos).
//
// Uso:
//   node scripts/ecb/linkedin-token.mjs gerar            # login no navegador, imprime o token
//   node scripts/ecb/linkedin-token.mjs gerar --salvar   # e grava no GitHub com o `gh`
//   node scripts/ecb/linkedin-token.mjs verificar        # dias até vencer; avisa no Slack se ≤ 10
//
// Variáveis de ambiente:
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   do app em developers.linkedin.com (Auth)
//   LINKEDIN_ACCESS_TOKEN                        o token atual (verificar)
//   LINKEDIN_TOKEN_EXPIRA_EM                     data de vencimento (AAAA-MM-DD), gravada pelo
//                                                --salvar; o verificar usa quando não tem o
//                                                client id/secret para consultar o LinkedIn
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root, args } from './util.mjs';

const REPO = 'vitorrgg/ecomplus-posts';
const PORTA = 8765;
const REDIRECT = `http://localhost:${PORTA}/callback`;
const ESCOPOS = 'openid profile w_member_social';
export const DIAS_AVISO = 10;

const precisa = (nome) => process.env[nome] || (console.error(`Defina ${nome} (veja o README, seção LinkedIn).`), process.exit(1));

async function gerar({ salvar }) {
  const clientId = precisa('LINKEDIN_CLIENT_ID');
  const clientSecret = precisa('LINKEDIN_CLIENT_SECRET');
  const state = randomBytes(16).toString('hex');
  const url = `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state, scope: ESCOPOS,
  })}`;

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const erro = u.searchParams.get('error_description') || u.searchParams.get('error');
      const ok = !erro && u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end(ok ? '<p>Pronto, pode fechar esta aba e voltar ao terminal.</p>' : `<p>Falhou: ${erro ?? 'state não confere'}</p>`);
      server.close();
      ok ? resolve(ok) : reject(new Error(erro ?? 'state não confere'));
    }).listen(PORTA, () => {
      console.log(`Abra no navegador e autorize com a conta do LinkedIn do Vitor:\n\n${url}\n`);
      // No WSL, abre no navegador do Windows; fora dele, tenta o padrão do sistema.
      for (const [cmd, a] of [['wslview', [url]], ['xdg-open', [url]], ['open', [url]]]) {
        if (spawnSync(cmd, a, { stdio: 'ignore' }).status === 0) break;
      }
    });
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, client_secret: clientSecret }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`troca do código falhou: ${JSON.stringify(json)}`);
  const expira = new Date(Date.now() + json.expires_in * 1000).toISOString().slice(0, 10);
  const info = await (await fetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${json.access_token}` } })).json();
  const author = `urn:li:person:${info.sub}`;
  console.log(`✓ token de ${info.name ?? author}, vence em ${expira}`);

  if (!salvar) {
    console.log(`\nGrave no GitHub (Settings → Secrets and variables → Actions):\n  secret   LINKEDIN_ACCESS_TOKEN = ${json.access_token}\n  variable LINKEDIN_AUTHOR = ${author}\n  variable LINKEDIN_TOKEN_EXPIRA_EM = ${expira}`);
    return;
  }
  const gh = (...a) => {
    const r = spawnSync('gh', a, { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error(`gh ${a.slice(0, 2).join(' ')} falhou (o gh está instalado e logado? gh auth login)`);
  };
  gh('secret', 'set', 'LINKEDIN_ACCESS_TOKEN', '-R', REPO, '--body', json.access_token);
  gh('variable', 'set', 'LINKEDIN_AUTHOR', '-R', REPO, '--body', author);
  gh('variable', 'set', 'LINKEDIN_TOKEN_EXPIRA_EM', '-R', REPO, '--body', expira);
  console.log(`✓ gravado em ${REPO}: LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR, LINKEDIN_TOKEN_EXPIRA_EM`);
}

// Dias até vencer: pergunta ao LinkedIn (introspecção) quando tem client id/secret, senão
// usa a data gravada na geração. null = não dá para saber.
export async function diasParaVencer() {
  const { LINKEDIN_CLIENT_ID: id, LINKEDIN_CLIENT_SECRET: secret, LINKEDIN_ACCESS_TOKEN: token, LINKEDIN_TOKEN_EXPIRA_EM: data } = process.env;
  if (!token) return { dias: null, motivo: 'sem LINKEDIN_ACCESS_TOKEN' };
  if (id && secret) {
    const res = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secret, token }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.active === false) return { dias: 0, motivo: 'o LinkedIn diz que o token não está ativo' };
    if (res.ok && j.expires_at) return { dias: Math.floor((j.expires_at * 1000 - Date.now()) / 86400000), motivo: 'introspecção' };
  }
  if (data) return { dias: Math.floor((Date.parse(`${data}T00:00:00Z`) - Date.now()) / 86400000), motivo: 'LINKEDIN_TOKEN_EXPIRA_EM' };
  return { dias: null, motivo: 'sem client id/secret nem LINKEDIN_TOKEN_EXPIRA_EM' };
}

async function verificar() {
  const { dias, motivo } = await diasParaVencer();
  if (dias === null) { console.log(`Não dá para saber quando o token vence (${motivo}).`); return; }
  console.log(`Token do LinkedIn: ${dias <= 0 ? 'vencido' : `vence em ${dias} dia(s)`} (${motivo}).`);
  if (dias <= DIAS_AVISO) {
    spawnSync(process.execPath, [join(root, 'scripts', 'ecb', 'notificar-slack.mjs'), '--token-linkedin', dias <= 0 ? 'vencido' : String(dias)], { stdio: 'inherit' });
  }
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const [acao] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const opts = args();
  if (acao === 'gerar') await gerar({ salvar: Boolean(opts.salvar) });
  else if (acao === 'verificar') await verificar();
  else { console.error('Uso: node scripts/ecb/linkedin-token.mjs gerar [--salvar] | verificar'); process.exit(1); }
}
