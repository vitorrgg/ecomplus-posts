// Usa os artigos coletados por mais-lidos.mjs como pauta: pra cada um, pede à
// API da Claude (saída estruturada) uma análise original cruzando o tema com os
// recursos da e-com.plus (ecb/recursos.md) — não é resumo do artigo e não cita
// fonte nem autor. Escreve o brief do carrossel (posts/<slug>/brief.md) e a
// legenda do Instagram (posts/<slug>/legenda.txt). Registra cada post gerado em
// ecb/historico.json (pra não repetir o artigo em outra semana) e o enfileira
// em ecb/fila.json pra publicação.
//
// Três jeitos de obter a análise (--via):
//   claude-code  (padrão) chama `claude -p` do Claude Code instalado na máquina, com saída
//                estruturada — usa a assinatura (Max) de quem está logado, sem chave de API.
//   api          usa a API da Claude pelo SDK — precisa de ANTHROPIC_API_KEY (cobrança à parte).
//   --from-json <arquivo-ou-pasta>  não gera nada: lê JSONs já escritos (pela rotina na nuvem
//                do Claude Code, por exemplo) no formato de ecb/ESQUEMA.json + campo "fonte",
//                valida e grava.
//
// Uso:
//   node scripts/ecb/gerar-briefs.mjs                         # semana corrente, via claude-code
//   node scripts/ecb/gerar-briefs.mjs --via api
//   node scripts/ecb/gerar-briefs.mjs --semana 2026-09-21     # outro arquivo em ecb/semanas/
//   node scripts/ecb/gerar-briefs.mjs --from-json ecb/saidas/2026-09-21
//   node scripts/ecb/gerar-briefs.mjs --esquema               # regrava ecb/ESQUEMA.json a partir do zod
//   node scripts/ecb/gerar-briefs.mjs --exemplo               # sem modelo: brief fixo só pra exercitar a escrita
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import yaml from 'js-yaml';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  root, segundaDaSemana, lerJson, gravarJson, args, slugify,
  HISTORICO, FILA, lerHistorico, lerFila,
} from './util.mjs';

const MODELO = 'claude-opus-5';
const RECURSOS = readFileSync(join(root, 'ecb', 'recursos.md'), 'utf8')
  .split('\n').filter((l) => l.startsWith('- ')).join('\n');

// Fotos genéricas disponíveis pra capa (as `tema-*` são prints de temas de loja,
// não servem aqui).
const FOTOS = readdirSync(join(root, 'templates', 'assets', 'photos'))
  .filter((f) => f.endsWith('.jpg') && !f.startsWith('tema-'));

const Slide = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('capa'),
    eyebrow: z.string().describe('Chapéu curto acima do título, até 40 caracteres. Ex.: "análise da semana · pós-compra"'),
    titulo: z.string().describe('Título da capa em 2 ou 3 linhas separadas por \\n, cada linha com no máximo 16 caracteres. É a tese do post, não o título do artigo. Será renderizado em minúsculas.'),
    subtitulo: z.string().describe('Uma frase de apoio, até 110 caracteres.'),
    imagem: z.enum(FOTOS).describe('Foto de fundo, escolhida pelo assunto.'),
  }),
  z.object({
    tipo: z.literal('texto'),
    titulo: z.string().nullable().describe('Título opcional em negrito, até 50 caracteres. null quando não houver.'),
    paragrafos: z.array(z.string()).min(1).max(3).describe('1 a 3 parágrafos, cada um entre 90 e 220 caracteres. Total do slide até 450 caracteres.'),
  }),
  z.object({
    tipo: z.literal('lista'),
    titulo: z.string().describe('Título da lista, até 50 caracteres.'),
    itens: z.array(z.string()).min(3).max(5).describe('3 a 5 itens, cada um até 110 caracteres, sem ponto final.'),
  }),
  z.object({
    tipo: z.literal('fechamento'),
    paragrafos: z.array(z.string()).min(1).max(2).describe('1 ou 2 parágrafos, até 200 caracteres cada: a conclusão da análise e o que o lojista faz com ela. Sem citar fonte, autor ou o portal de origem.'),
  }),
]);

const Saida = z.object({
  slug: z.string().describe('Slug curto em kebab-case (3 a 5 palavras) que identifica o assunto.'),
  slides: z.array(Slide).min(5).max(7).describe('Sequência do carrossel: começa com "capa", termina com "fechamento", e no meio alterna "texto" e "lista". O penúltimo slide de conteúdo é o cruzamento com a e-com.plus.'),
  legenda: z.string().describe('Legenda do post no Instagram: 3 a 5 frases curtas com a tese e a conclusão, linha em branco, uma frase de convite (ex.: conhecer a e-com.plus, comentar), linha em branco e 5 a 8 hashtags. Até 1500 caracteres. Sem URL, sem citar fonte ou autor.'),
});

// O texto do prompt vive em ecb/PROMPT.md pra ser o mesmo aqui, no `claude -p` e na
// rotina na nuvem (que lê o arquivo direto).
const SISTEMA = readFileSync(join(root, 'ecb', 'PROMPT.md'), 'utf8').replace('{{RECURSOS}}', RECURSOS);
export const ESQUEMA_JSON = zodOutputFormat(Saida).schema;
export function validarSaida(obj) { return Saida.parse(obj); }

function promptUsuario(artigo) {
  return `Pauta da semana (artigo na posição ${artigo.posicao} entre os mais lidos do mercado).

Título: ${artigo.titulo}
Categoria: ${artigo.categoria ?? '—'}
Autor: ${artigo.autor ?? '—'}
Descrição: ${artigo.descricao}
URL: ${artigo.url}

Texto do artigo:
${artigo.texto}

Escreva a análise da e-com.plus sobre esse tema, em carrossel, e a legenda, seguindo o esquema pedido.`;
}

// Converte a saída estruturada no brief.md que scripts/render.mjs já entende.
export function montarBrief(saida, artigo) {
  const blocos = saida.slides.map((s, i) => {
    const dados = { ...s };
    if (dados.tipo === 'texto' && dados.titulo === null) delete dados.titulo;
    const y = yaml.dump(dados, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    return `## Slide ${i + 1}\n\`\`\`yaml\n${y}\`\`\``;
  });
  const cabecalho = `# ${artigo.titulo}\n\nAnálise original a partir da pauta ${artigo.url} (referência interna, não vai pro post).\nGerado em ${new Date().toISOString().slice(0, 10)} por scripts/ecb/gerar-briefs.mjs.\n`;
  return `${cabecalho}\n${blocos.join('\n\n')}\n`;
}

export function gravarPost({ slug, brief, legenda, artigo, semana }) {
  const dir = join(root, 'posts', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'brief.md'), brief);
  writeFileSync(join(dir, 'legenda.txt'), legenda.trim() + '\n');

  const historico = lerHistorico();
  historico.gerados.push({ slug, fonte: artigo.url, titulo: artigo.titulo, semana, geradoEm: new Date().toISOString() });
  gravarJson(HISTORICO, historico);

  const fila = lerFila();
  if (!fila.pendentes.some((p) => p.slug === slug)) {
    fila.pendentes.push({ slug, fonte: artigo.url, titulo: artigo.titulo, semana, aprovado: null });
  }
  gravarJson(FILA, fila);
  return dir;
}

async function gerarComApi(client, artigo) {
  const resposta = await client.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    messages: [{ role: 'user', content: promptUsuario(artigo) }],
    output_config: { format: zodOutputFormat(Saida), effort: 'medium' },
  });
  if (resposta.stop_reason === 'refusal') {
    throw new Error(`A API recusou gerar o post de "${artigo.titulo}" (${resposta.stop_details?.category ?? 'sem categoria'}).`);
  }
  if (!resposta.parsed_output) {
    throw new Error(`Resposta sem saída estruturada válida pra "${artigo.titulo}" (stop_reason=${resposta.stop_reason}).`);
  }
  return resposta.parsed_output;
}

// `claude -p` com --json-schema devolve `structured_output` já validado pelo próprio
// Claude Code; revalidamos com o zod por garantia. Sem ferramentas e sem sessão
// persistida: é uma chamada de modelo, não uma sessão de agente.
function gerarComClaudeCode(artigo) {
  const r = spawnSync('claude', [
    '-p', '--no-session-persistence', '--tools', '', '--output-format', 'json',
    '--model', MODELO, '--json-schema', JSON.stringify(ESQUEMA_JSON),
    '--system-prompt', SISTEMA, promptUsuario(artigo),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`Não consegui rodar o \`claude\` (${r.error.message}). Instale o Claude Code ou use --via api.`);
  let j;
  try { j = JSON.parse(r.stdout); } catch { throw new Error(`Saída inesperada do claude -p:\n${r.stdout.slice(0, 500)}\n${r.stderr.slice(0, 500)}`); }
  if (j.is_error) throw new Error(`claude -p falhou: ${j.result} (se for login, rode \`claude\` e /login)`);
  const bruto = j.structured_output ?? JSON.parse(j.result);
  return validarSaida(bruto);
}

// Lê um JSON (ou todos os .json de uma pasta) no formato do esquema + "fonte" (url do
// artigo) e devolve pares [artigo, saida] casados com a coleta da semana.
function lerSaidasJson(caminho, coleta) {
  const arquivos = statSync(caminho).isDirectory()
    ? readdirSync(caminho).filter((f) => f.endsWith('.json')).map((f) => join(caminho, f))
    : [caminho];
  return arquivos.map((arq) => {
    const { fonte, ...saida } = JSON.parse(readFileSync(arq, 'utf8'));
    const artigo = coleta.escolhidos.find((a) => a.url === fonte) ?? coleta.ranking.find((a) => a.url === fonte);
    if (!artigo) throw new Error(`${arq}: "fonte" ${fonte} não está na coleta da semana.`);
    return [artigo, validarSaida(saida)];
  });
}

function exemploFixo(artigo) {
  return {
    slug: slugify(artigo.titulo, 30),
    slides: [
      { tipo: 'capa', eyebrow: 'mais lido da semana', titulo: 'exemplo de\ncarrossel\ngerado', subtitulo: artigo.descricao.slice(0, 110), imagem: FOTOS[0] },
      { tipo: 'texto', titulo: null, paragrafos: ['Primeiro parágrafo de exemplo, com tamanho parecido com o que a API devolve num slide de texto normal.', 'Segundo parágrafo, um pouco mais curto, pra conferir o espaçamento.'] },
      { tipo: 'lista', titulo: 'Três pontos do artigo', itens: ['Item um da lista de exemplo', 'Item dois, um pouco mais comprido que o primeiro', 'Item três'] },
      { tipo: 'texto', titulo: 'O que isso muda', paragrafos: ['Parágrafo com título em negrito acima, pra exercitar o outro layout de texto.'] },
      { tipo: 'fechamento', paragrafos: ['Conclusão da e-com.plus em uma frase, com o que o lojista faz agora.'] },
    ],
    legenda: 'Exemplo de legenda.\n\nConheça a e-com.plus.\n\n#ecommerce #lojavirtual #ecomplus',
  };
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  if (opts.esquema) {
    gravarJson(join(root, 'ecb', 'ESQUEMA.json'), ESQUEMA_JSON);
    console.log('✓ ecb/ESQUEMA.json');
    process.exit(0);
  }
  const semana = opts.semana ?? segundaDaSemana();
  const arq = join(root, 'ecb', 'semanas', `${semana}.json`);
  if (!existsSync(arq)) {
    console.error(`Não achei ${arq} — rode antes: node scripts/ecb/mais-lidos.mjs`);
    process.exit(1);
  }
  const coleta = lerJson(arq);
  const jaGerados = new Set(lerHistorico().gerados.map((g) => g.fonte));
  const via = opts.exemplo ? 'exemplo' : opts['from-json'] ? 'json' : (opts.via ?? (process.env.ANTHROPIC_API_KEY ? 'api' : 'claude-code'));
  const client = via === 'api' ? new Anthropic() : null;
  const gerados = [];

  const pendentes = via === 'json'
    ? lerSaidasJson(opts['from-json'], coleta)
    : coleta.escolhidos.map((a) => [a, null]);

  for (const [artigo, pronta] of pendentes) {
    if (jaGerados.has(artigo.url)) { console.log(`· já gerado: ${artigo.titulo}`); continue; }
    if (!artigo.texto && via !== 'json') { console.warn(`⚠ sem texto, pulando: ${artigo.titulo}`); continue; }
    console.log(`→ ${via === 'json' ? 'gravando' : `gerando (${via})`}: ${artigo.titulo}`);
    const saida = pronta
      ?? (via === 'exemplo' ? exemploFixo(artigo)
        : via === 'api' ? await gerarComApi(client, artigo)
        : gerarComClaudeCode(artigo));
    const slug = `ecb-${semana}-${slugify(saida.slug || artigo.titulo, 36)}`;
    const dir = gravarPost({ slug, brief: montarBrief(saida, artigo), legenda: saida.legenda, artigo, semana });
    console.log(`✓ ${dir}`);
    gerados.push(slug);
  }

  // Lista os slugs em stdout, um por linha, pra quem encadeia (semana.mjs / CI).
  if (gerados.length) console.log(`\nslugs:\n${gerados.join('\n')}`);
  else console.log('Nada novo pra gerar.');
}
