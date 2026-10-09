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
import { FOTOS, capasRecentes, capasLivres, conferirCapa } from './capas.mjs';
import { PREFIXO as PREFIXO_LIVRO, pautaPorFonte, chamadaDoLivro, CONFIG as LIVRO } from './livro.mjs';

const MODELO = 'claude-opus-5';
const RECURSOS = readFileSync(join(root, 'ecb', 'recursos.md'), 'utf8')
  .split('\n').filter((l) => l.startsWith('- ')).join('\n');

// Variações visuais dos slides de conteúdo (texto, lista, fechamento).
const Tema = z.enum(['escuro', 'claro']).describe('Fundo roxo escuro com texto branco, ou fundo claro com texto escuro.');
const Ilustracao = z.enum(FOTOS).nullable().describe('Foto ilustrativa abaixo do texto, escolhida pelo assunto, ou null.');

// `fotosCapa` restringe a foto da capa às que não se repetem na grade (capas.mjs); o
// ESQUEMA.json comitado leva todas, e a repetição é barrada na hora de gravar.
const criarSlide = (fotosCapa) => z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('capa'),
    eyebrow: z.string().describe('Chapéu curto acima do título, até 40 caracteres. Ex.: "análise da semana · pós-compra"'),
    titulo: z.string().describe('Título da capa em 2 ou 3 linhas separadas por \\n, cada linha com no máximo 16 caracteres. É a tese do post, não o título do artigo. Será renderizado em minúsculas.'),
    subtitulo: z.string().describe('Uma frase de apoio, até 110 caracteres.'),
    imagem: z.enum(fotosCapa).describe('Foto de fundo, escolhida pelo assunto. Não pode repetir a capa de nenhum dos posts recentes do perfil.'),
  }),
  z.object({
    tipo: z.literal('texto'),
    titulo: z.string().nullable().describe('Título opcional em negrito, até 50 caracteres, curto e direto, de preferência em tom de conselho. null quando não houver.'),
    paragrafos: z.array(z.string()).min(1).max(3).describe('1 a 3 parágrafos, cada um entre 90 e 220 caracteres. Total do slide até 450 caracteres (até 300 se tiver imagem).'),
    tema: Tema, imagem: Ilustracao,
  }),
  z.object({
    tipo: z.literal('lista'),
    titulo: z.string().describe('Título da lista, até 50 caracteres.'),
    itens: z.array(z.string()).min(3).max(5).describe('3 a 5 itens, cada um uma frase inteira de até 110 caracteres, sem ponto final (até 4 itens se tiver imagem).'),
    tema: Tema, imagem: Ilustracao,
  }),
  z.object({
    tipo: z.literal('fechamento'),
    paragrafos: z.array(z.string()).min(1).max(2).describe('1 ou 2 parágrafos, até 200 caracteres cada: a conclusão da análise e uma coisa que o lojista pode fazer nesta semana. Sem citar fonte, autor ou o portal de origem.'),
    tema: Tema, imagem: Ilustracao,
  }),
]);

const criarSaida = (fotosCapa = FOTOS) => z.object({
  slug: z.string().describe('Slug curto em kebab-case (3 a 5 palavras) que identifica o assunto.'),
  slides: z.array(criarSlide(fotosCapa)).min(5).max(7).describe('Sequência do carrossel: começa com "capa", termina com "fechamento", e no meio alterna "texto" e "lista". O penúltimo slide de conteúdo é o cruzamento com a e-com.plus.'),
  legenda: z.string().describe('Legenda do post no Instagram: 3 a 5 frases com a tese e a conclusão, linha em branco, uma frase sobre como a e-com.plus resolve, linha em branco, uma pergunta de convite sobre a operação de quem lê, linha em branco e 5 a 8 hashtags. Até 1500 caracteres. Sem URL, sem citar fonte ou autor.'),
  linkedin: z.string().optional().describe('Versão do post para o perfil pessoal do Vitor no LinkedIn, na primeira pessoa do singular, só texto e sem imagem, então precisa se sustentar sozinha: a primeira frase é a tese e cabe em uma linha; depois o raciocínio dos slides em parágrafos curtos (uma lista com "•" quando o slide for lista), a frase sobre a e-com.plus, uma ação para esta semana, uma pergunta sobre a operação de quem lê e, na última linha, 3 hashtags. Entre 1200 e 2000 caracteres. Sem URL e sem emojis.'),
});
const Saida = criarSaida();

// O texto do prompt vive em ecb/PROMPT.md pra ser o mesmo aqui, no `claude -p` e na
// rotina na nuvem (que lê o arquivo direto).
const SISTEMA = readFileSync(join(root, 'ecb', 'PROMPT.md'), 'utf8').replace('{{RECURSOS}}', RECURSOS);
export const ESQUEMA_JSON = zodOutputFormat(Saida).schema;
export function validarSaida(obj) { return Saida.parse(obj); }

function promptUsuario(artigo, livres) {
  return `Pauta da semana (artigo na posição ${artigo.posicao} entre os mais lidos do mercado).

Título: ${artigo.titulo}
Categoria: ${artigo.categoria ?? '—'}
Autor: ${artigo.autor ?? '—'}
Descrição: ${artigo.descricao}
URL: ${artigo.url}

Texto do artigo:
${artigo.texto}

Fotos livres para a capa (as outras já foram capa de posts recentes do perfil): ${livres.join(', ')}.

Escreva a análise da e-com.plus sobre esse tema, em carrossel, e a legenda, seguindo o esquema pedido.`;
}

// Converte a saída estruturada no brief.md que scripts/render.mjs já entende.
export function montarBrief(saida, artigo) {
  const blocos = saida.slides.map((s, i) => {
    const dados = { ...s };
    // campos opcionais que vieram vazios ou no valor padrão não vão pro YAML
    for (const k of Object.keys(dados)) if (dados[k] === null) delete dados[k];
    if (dados.tema === 'escuro') delete dados.tema;
    const y = yaml.dump(dados, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    return `## Slide ${i + 1}\n\`\`\`yaml\n${y}\`\`\``;
  });
  const cabecalho = `# ${artigo.titulo}\n\nAnálise original a partir da pauta ${artigo.url} (referência interna, não vai pro post).\nGerado em ${new Date().toISOString().slice(0, 10)} por scripts/ecb/gerar-briefs.mjs.\n`;
  return `${cabecalho}\n${blocos.join('\n\n')}\n`;
}

// Posts da série do livro (fonte "livro:<id>"): chapéu fixo "do livro · …" na capa e a
// chamada do livro (ecb/livro/config.json) antes das hashtags da legenda.
function ajustarSerieLivro(saida, rotulo) {
  const capa = saida.slides.find((s) => s.tipo === 'capa');
  if (!/^do livro\b/i.test(capa?.eyebrow ?? '')) {
    throw new Error(`${rotulo}: na série do livro o chapéu da capa começa com "do livro · " (veio "${capa?.eyebrow}").`);
  }
  const comChamada = (texto, chamada) => {
    if (!texto || texto.includes(LIVRO.titulo)) return texto;
    const blocos = texto.trim().split(/\n\s*\n/);
    const i = /^#/.test(blocos.at(-1)) ? blocos.length - 1 : blocos.length;
    blocos.splice(i, 0, chamada);
    return blocos.join('\n\n');
  };
  return {
    ...saida,
    legenda: comChamada(saida.legenda, chamadaDoLivro()),
    linkedin: comChamada(saida.linkedin, chamadaDoLivro({ rede: 'linkedin' })),
  };
}

export function gravarPost({ slug, brief, legenda, linkedin, artigo, semana }) {
  const dir = join(root, 'posts', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'brief.md'), brief);
  writeFileSync(join(dir, 'legenda.txt'), legenda.trim() + '\n');
  if (linkedin) writeFileSync(join(dir, 'linkedin.txt'), linkedin.trim() + '\n');
  else console.warn(`⚠ ${slug}: sem versão para o LinkedIn (campo "linkedin").`);

  const historico = lerHistorico();
  const serie = artigo.serie ?? 'ecb';
  historico.gerados.push({ slug, serie, fonte: artigo.url, titulo: artigo.titulo, semana, geradoEm: new Date().toISOString() });
  gravarJson(HISTORICO, historico);

  const fila = lerFila();
  if (!fila.pendentes.some((p) => p.slug === slug)) {
    fila.pendentes.push({ slug, serie, fonte: artigo.url, titulo: artigo.titulo, semana, aprovado: null });
  }
  gravarJson(FILA, fila);
  return dir;
}

async function gerarComApi(client, artigo, livres) {
  const resposta = await client.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    messages: [{ role: 'user', content: promptUsuario(artigo, livres) }],
    output_config: { format: zodOutputFormat(criarSaida(livres)), effort: 'medium' },
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
function gerarComClaudeCode(artigo, livres) {
  const r = spawnSync('claude', [
    '-p', '--no-session-persistence', '--tools', '', '--output-format', 'json',
    '--model', MODELO, '--json-schema', JSON.stringify(zodOutputFormat(criarSaida(livres)).schema),
    '--system-prompt', SISTEMA, promptUsuario(artigo, livres),
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
    ? readdirSync(caminho).filter((f) => f.endsWith('.json')).sort().map((f) => join(caminho, f))
    : [caminho];
  return arquivos.map((arq) => {
    const { fonte, ...saida } = JSON.parse(readFileSync(arq, 'utf8'));
    if (fonte?.startsWith(PREFIXO_LIVRO)) {
      const pauta = pautaPorFonte(fonte);
      if (!pauta) throw new Error(`${arq}: "fonte" ${fonte} não está em ecb/livro/pautas.json.`);
      const artigo = { url: fonte, titulo: `Livro, cap. ${pauta.capitulo}: ${pauta.assunto}`, serie: 'livro' };
      return [artigo, ajustarSerieLivro(validarSaida(saida), arq), arq];
    }
    const artigo = coleta.escolhidos.find((a) => a.url === fonte) ?? coleta.ranking.find((a) => a.url === fonte);
    if (!artigo) throw new Error(`${arq}: "fonte" ${fonte} não está na coleta da semana.`);
    return [artigo, validarSaida(saida), arq];
  });
}

// Confere o lote inteiro antes de gravar qualquer post: cada capa contra as recentes da
// grade e contra as dos outros posts do mesmo lote.
function conferirCapasDoLote(lote) {
  const recentes = capasRecentes();
  const extras = new Map();
  for (const [, saida, arq] of lote) {
    const capa = saida.slides.find((s) => s.tipo === 'capa')?.imagem;
    if (!capa) continue;
    conferirCapa(capa, { recentes, extras, rotulo: arq });
    extras.set(capa, `${arq} (mesmo lote)`);
  }
}

function exemploFixo(artigo, livres) {
  return {
    slug: slugify(artigo.titulo, 30),
    slides: [
      { tipo: 'capa', eyebrow: 'mais lido da semana', titulo: 'exemplo de\ncarrossel\ngerado', subtitulo: artigo.descricao.slice(0, 110), imagem: livres[0] },
      { tipo: 'texto', titulo: null, paragrafos: ['Primeiro parágrafo de exemplo, com tamanho parecido com o que a API devolve num slide de texto normal.', 'Segundo parágrafo, um pouco mais curto, pra conferir o espaçamento.'], tema: 'escuro', imagem: null },
      { tipo: 'lista', titulo: 'Três pontos do artigo', itens: ['Item um da lista de exemplo', 'Item dois, um pouco mais comprido que o primeiro', 'Item três'], tema: 'claro', imagem: null },
      { tipo: 'texto', titulo: 'O que isso muda', paragrafos: ['Parágrafo com título em negrito acima, pra exercitar o outro layout de texto.'], tema: 'escuro', imagem: FOTOS[1] },
      { tipo: 'fechamento', paragrafos: ['Conclusão da e-com.plus em uma frase, com o que o lojista faz agora.'], tema: 'escuro', imagem: null },
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
  if (via === 'json') {
    try { conferirCapasDoLote(pendentes.filter(([a]) => !jaGerados.has(a.url))); }
    catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
  }

  for (const [artigo, pronta] of pendentes) {
    if (jaGerados.has(artigo.url)) { console.log(`· já gerado: ${artigo.titulo}`); continue; }
    if (!artigo.texto && via !== 'json') { console.warn(`⚠ sem texto, pulando: ${artigo.titulo}`); continue; }
    console.log(`→ ${via === 'json' ? 'gravando' : `gerando (${via})`}: ${artigo.titulo}`);
    // A fila já inclui os posts gravados antes neste lote, então as livres mudam a cada um.
    const livres = capasLivres();
    const saida = pronta
      ?? (via === 'exemplo' ? exemploFixo(artigo, livres)
        : via === 'api' ? await gerarComApi(client, artigo, livres)
        : gerarComClaudeCode(artigo, livres));
    const slug = `${artigo.serie === 'livro' ? 'livro' : 'ecb'}-${semana}-${slugify(saida.slug || artigo.titulo, 36)}`;
    const dir = gravarPost({ slug, brief: montarBrief(saida, artigo), legenda: saida.legenda, linkedin: saida.linkedin, artigo, semana });
    console.log(`✓ ${dir}`);
    gerados.push(slug);
  }

  // Lista os slugs em stdout, um por linha, pra quem encadeia (semana.mjs / CI).
  if (gerados.length) console.log(`\nslugs:\n${gerados.join('\n')}`);
  else console.log('Nada novo pra gerar.');
}
