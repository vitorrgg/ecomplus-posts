// Usa os artigos coletados por mais-lidos.mjs como pauta: pra cada um, pede à
// API da Claude (saída estruturada) uma análise original cruzando o tema com os
// recursos da e-com.plus (ecb/recursos.md) — não é resumo do artigo e não cita
// fonte nem autor. Escreve o brief do carrossel (posts/<slug>/brief.md) e a
// legenda do Instagram (posts/<slug>/legenda.txt). Registra cada post gerado em
// ecb/historico.json (pra não repetir o artigo em outra semana) e o enfileira
// em ecb/fila.json pra publicação.
//
// Uso:
//   node scripts/ecb/gerar-briefs.mjs                         # semana corrente
//   node scripts/ecb/gerar-briefs.mjs --semana 2026-09-21     # outro arquivo em ecb/semanas/
//   node scripts/ecb/gerar-briefs.mjs --exemplo               # sem API: usa um brief fixo só pra exercitar a escrita
//
// Credenciais: ANTHROPIC_API_KEY no ambiente (ou perfil do `ant auth login`).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import yaml from 'js-yaml';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
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

const SISTEMA = `Você escreve carrosséis pro Instagram da e-com.plus (@ecomplus.io), plataforma brasileira de e-commerce headless e API-first, alternativa à VTEX, feita pra lojas de marca e indústrias que vendem direto (D2C). A audiência é de lojistas, gestores de e-commerce, indústrias e agências.

Toda semana você recebe um artigo que está entre os mais lidos do mercado. Ele é só a PAUTA: o post é uma análise original da e-com.plus sobre o tema, cruzando o que o artigo levanta com a realidade de quem opera uma loja própria e com os recursos da plataforma. Não é resumo do artigo.

Voz da marca: simples, direta, sem jargão de agência, sem exclamações. Frases curtas. Opinião clara. Português do Brasil. O nome da marca é sempre "e-com.plus", em minúsculas.

Regras de conteúdo:
- Não cite o portal de origem, o autor nem a palavra "fonte". Nunca reproduza frases do artigo.
- Dados numéricos podem entrar quando sustentam o argumento, sempre com o nome de quem produziu o estudo (ex.: "segundo a NIQ"), nunca do veículo que noticiou.
- Estrutura: slide 1 é a capa com a tese; slides 2 a 4 desenvolvem a análise (o que está acontecendo, por que importa pra loja própria, onde a conta desanda), alternando "texto" e "lista"; o penúltimo slide de conteúdo mostra como o tema se resolve na e-com.plus, citando 2 a 4 recursos reais da lista abaixo; o último é o "fechamento", com a conclusão e o que o lojista deve fazer.
- Só use recursos que estão na lista. Se o tema não cruzar bem com nenhum, faça a análise do ponto de vista de quem tem loja própria e feche com a posição da e-com.plus sobre o assunto.
- Respeite os limites de caracteres descritos em cada campo: o layout é fixo e texto a mais é cortado na imagem.
- Não use emojis nos slides. Na legenda, no máximo dois.
- Evite dois-pontos seguidos de espaço no meio de itens de lista.

Recursos da e-com.plus (nome — o que é):
${RECURSOS}`;

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
  const semana = opts.semana ?? segundaDaSemana();
  const arq = join(root, 'ecb', 'semanas', `${semana}.json`);
  if (!existsSync(arq)) {
    console.error(`Não achei ${arq} — rode antes: node scripts/ecb/mais-lidos.mjs`);
    process.exit(1);
  }
  const coleta = lerJson(arq);
  const jaGerados = new Set(lerHistorico().gerados.map((g) => g.fonte));
  const client = opts.exemplo ? null : new Anthropic();
  const gerados = [];

  for (const artigo of coleta.escolhidos) {
    if (jaGerados.has(artigo.url)) { console.log(`· já gerado: ${artigo.titulo}`); continue; }
    if (!artigo.texto) { console.warn(`⚠ sem texto, pulando: ${artigo.titulo}`); continue; }
    console.log(`→ gerando: ${artigo.titulo}`);
    const saida = opts.exemplo ? exemploFixo(artigo) : await gerarComApi(client, artigo);
    const slug = `ecb-${semana}-${slugify(saida.slug || artigo.titulo, 36)}`;
    const dir = gravarPost({ slug, brief: montarBrief(saida, artigo), legenda: saida.legenda, artigo, semana });
    console.log(`✓ ${dir}`);
    gerados.push(slug);
  }

  // Lista os slugs em stdout, um por linha, pra quem encadeia (semana.mjs / CI).
  if (gerados.length) console.log(`\nslugs:\n${gerados.join('\n')}`);
  else console.log('Nada novo pra gerar.');
}
