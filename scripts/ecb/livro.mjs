// Série semanal do livro: escolhe a próxima pauta de ecb/livro/pautas.json e extrai o
// trecho do manuscrito (repo privado vitorrgg/meu-livro) para quem vai escrever o post.
// O texto do livro só vai para ecb/livro/rascunho/, que fica fora do git: este repo é
// público e o livro ainda não foi publicado.
//
// A escolha segue a ordem do banco, pulando pauta já usada (historico.json, fonte
// "livro:<id>") ou não liberada, e evitando repetir a alavanca do post anterior da série
// e um capítulo dos últimos 4.
//
// Uso:
//   node scripts/ecb/livro.mjs              # grava ecb/livro/rascunho/<segunda>.json
//   node scripts/ecb/livro.mjs --pauta <id> # força uma pauta específica
//   node scripts/ecb/livro.mjs --listar     # mostra o banco: usadas, livres e bloqueadas
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { root, segundaDaSemana, lerJson, args, lerHistorico } from './util.mjs';
import { capasLivres } from './capas.mjs';

const DIR = join(root, 'ecb', 'livro');
export const CONFIG = lerJson(join(DIR, 'config.json'));
export const PAUTAS = lerJson(join(DIR, 'pautas.json')).pautas;
export const PREFIXO = 'livro:';
export const PAUSADA = CONFIG.ativa === false;
export const AVISO_PAUSA = 'Série do livro pausada (ecb/livro/config.json → "ativa": false): pule o passo do livro.';

export const pautaPorFonte = (fonte) => PAUTAS.find((p) => `${PREFIXO}${p.id}` === fonte);

// Chamada do livro que vai no fim da legenda (ou do texto do LinkedIn, que fala em primeira
// pessoa), antes das hashtags.
export function chamadaDoLivro({ rede = 'instagram', cfg = CONFIG } = {}) {
  const sufixo = cfg.link ? 'ComLink' : 'SemLink';
  const modelo = (rede === 'linkedin' && cfg[`chamadaPrimeiraPessoa${sufixo}`]) || cfg[`chamada${sufixo}`];
  return modelo.replace(/\{(\w+)\}/g, (_, k) => cfg[k] ?? '');
}

function pastaDoLivro() {
  const dir = resolve(root, process.env.LIVRO_DIR || CONFIG.repo);
  if (!existsSync(dir)) {
    throw new Error(`Não achei o livro em ${dir}. Clone vitorrgg/meu-livro ao lado deste repo ou defina LIVRO_DIR.`);
  }
  return dir;
}

// O manuscrito configurado ou o "manuscrito v<versão>.md" mais novo da pasta Manuscrito/.
function arquivoDoManuscrito(dir) {
  if (CONFIG.manuscrito) return join(dir, CONFIG.manuscrito);
  const pasta = join(dir, 'Manuscrito');
  const versao = (f) => (f.match(/manuscrito v([\d.]+)\.md$/)?.[1] ?? '0').split('.').map(Number);
  const [maisNovo] = readdirSync(pasta).filter((f) => /manuscrito v[\d.]+\.md$/.test(f))
    .sort((a, b) => {
      const [x, y] = [versao(a), versao(b)];
      for (let i = 0; i < Math.max(x.length, y.length); i++) if ((y[i] ?? 0) !== (x[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
      return 0;
    });
  if (!maisNovo) throw new Error(`Nenhum "manuscrito v*.md" em ${pasta}.`);
  return join(pasta, maisNovo);
}

const normalizar = (s) => s.replace(/\*\*\[[A-ZÇÃ]+\]\*\*|\[[A-ZÇÃ]+\]|\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Remove o que é de trabalho no manuscrito: notas 📝, marcas [ACRÉSCIMO]/[AJUSTE], e frases
// com [CONFIRMAR]/[PREENCHER]/[FIGURA] (falam pelo autor sem confirmação ou estão incompletas).
function limpar(texto) {
  return texto.split('\n')
    .filter((l) => !l.startsWith('> 📝'))
    .map((l) => l
      .replace(/[^.!?\n]*\[(CONFIRMAR|PREENCHER|FIGURA)[^\]]*\][^.!?\n]*[.!?]?/g, '')
      .replace(/\*\*\[(ACRÉSCIMO|AJUSTE)\]\*\*\s*|\[(ACRÉSCIMO|AJUSTE)\]\s*/g, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Capítulo "## N. título" e, dentro dele, as seções "### ..." pedidas ("(abertura)" = o
// texto antes da primeira seção).
export function extrairPauta(pauta, manuscrito) {
  const linhas = manuscrito.split('\n');
  const ini = linhas.findIndex((l) => new RegExp(`^## ${pauta.capitulo}\\. `).test(l));
  if (ini < 0) throw new Error(`capítulo ${pauta.capitulo} não encontrado no manuscrito`);
  let fim = linhas.findIndex((l, i) => i > ini && /^#{1,2} /.test(l));
  if (fim < 0) fim = linhas.length;
  const capitulo = linhas[ini].replace(/^## \d+\.\s*/, '');
  const blocos = [];
  let atual = { titulo: '(abertura)', linhas: [] };
  for (const l of linhas.slice(ini + 1, fim)) {
    if (/^### /.test(l)) { blocos.push(atual); atual = { titulo: l.replace(/^###\s*/, ''), linhas: [] }; } else atual.linhas.push(l);
  }
  blocos.push(atual);
  const partes = pauta.secoes.map((s) => {
    const b = blocos.find((x) => normalizar(x.titulo) === normalizar(s));
    if (!b) throw new Error(`seção "${s}" não encontrada no capítulo ${pauta.capitulo} (${capitulo})`);
    // As subseções "####" vêm junto com a seção.
    return `${s === '(abertura)' ? '' : `### ${s}\n`}${b.linhas.join('\n')}`;
  });
  return { capitulo, texto: limpar(partes.join('\n\n')) };
}

// Posts da série já gerados, do mais antigo ao mais novo.
function usadas() {
  return lerHistorico().gerados.filter((g) => g.fonte?.startsWith(PREFIXO))
    .map((g) => pautaPorFonte(g.fonte)).filter(Boolean);
}

export function proximaPauta() {
  const feitas = usadas();
  const ids = new Set(feitas.map((p) => p.id));
  const livres = PAUTAS.filter((p) => p.liberada && !ids.has(p.id));
  const ultima = feitas.at(-1);
  const capsRecentes = new Set(feitas.slice(-4).map((p) => p.capitulo));
  return livres.find((p) => p.alavanca !== ultima?.alavanca && !capsRecentes.has(p.capitulo))
    ?? livres.find((p) => !capsRecentes.has(p.capitulo))
    ?? livres[0];
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  if (opts.listar) {
    const ids = new Set(usadas().map((p) => p.id));
    for (const p of PAUTAS) console.log(`${ids.has(p.id) ? 'usada   ' : p.liberada ? 'livre   ' : 'bloqueada'}  cap.${String(p.capitulo).padStart(2, '0')}  ${p.alavanca.padEnd(9)} ${p.id}`);
    const n = PAUTAS.filter((p) => p.liberada && !ids.has(p.id)).length;
    console.log(`\n${n} pautas livres (≈ ${n} semanas).`);
    process.exit(0);
  }

  if (PAUSADA && !opts.pauta) { console.log(AVISO_PAUSA); process.exit(0); }
  const semana = segundaDaSemana();
  const jaNaSemana = lerHistorico().gerados.find((g) => g.semana === semana && g.fonte?.startsWith(PREFIXO));
  if (jaNaSemana && !opts.pauta) { console.log(`· a série do livro já tem post nesta semana: ${jaNaSemana.slug}`); process.exit(0); }

  const pauta = opts.pauta ? PAUTAS.find((p) => p.id === opts.pauta) : proximaPauta();
  if (!pauta) { console.error(opts.pauta ? `Pauta ${opts.pauta} não existe.` : 'Nenhuma pauta livre: libere mais em ecb/livro/pautas.json.'); process.exit(1); }

  const dir = pastaDoLivro();
  const arqManuscrito = arquivoDoManuscrito(dir);
  const { capitulo, texto } = extrairPauta(pauta, readFileSync(arqManuscrito, 'utf8'));
  const arqFicha = join(dir, CONFIG.ficha);
  const saida = {
    serie: 'livro',
    semana,
    url: `${PREFIXO}${pauta.id}`,
    titulo: `Livro, cap. ${pauta.capitulo} (${capitulo}): ${pauta.assunto}`,
    pauta,
    manuscrito: arqManuscrito.slice(dir.length + 1),
    capasLivres: capasLivres(),
    chamada: chamadaDoLivro(),
    texto,
    dadosVerificados: existsSync(arqFicha) ? readFileSync(arqFicha, 'utf8') : null,
  };
  mkdirSync(join(DIR, 'rascunho'), { recursive: true });
  const arq = join(DIR, 'rascunho', `${semana}.json`);
  writeFileSync(arq, JSON.stringify(saida, null, 2) + '\n');
  console.log(`✓ ${arq}\n→ ${pauta.id} (cap. ${pauta.capitulo}, ${pauta.alavanca}): ${pauta.assunto}\n  ${texto.split(/\s+/).length} palavras do ${saida.manuscrito}`);
}
