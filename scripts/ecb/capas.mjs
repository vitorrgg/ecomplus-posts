// Evita repetir a foto de capa entre posts próximos: na grade do perfil do
// Instagram as capas ficam lado a lado, e a mesma foto duas vezes na mesma tela
// fica ruim (aconteceu com dashboard-charts.jpg em 21/09 e 05/10/2026).
//
// A ordem da grade é a ordem de publicação: ecb/historico.json → publicados, e
// depois ecb/fila.json → pendentes (o que vai sair a seguir). Uma capa nova não
// pode repetir nenhuma das últimas JANELA_CAPAS dessa sequência. Com 20 fotos e
// janela de 12 (quatro linhas da grade), sempre sobram pelo menos 8 livres.
//
// Uso:
//   node scripts/ecb/capas.mjs     # mostra as capas recentes, as livres e repetições na fila
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { root, lerHistorico, lerFila } from './util.mjs';

export const JANELA_CAPAS = 12;

// Fotos genéricas disponíveis (as `tema-*` são prints de temas de loja, não servem aqui).
export const FOTOS = readdirSync(join(root, 'templates', 'assets', 'photos'))
  .filter((f) => f.endsWith('.jpg') && !f.startsWith('tema-'))
  .sort();

// Foto do slide de capa em posts/<slug>/brief.md, ou null se o post não existe mais.
export function capaDoPost(slug) {
  const arq = join(root, 'posts', slug, 'brief.md');
  if (!existsSync(arq)) return null;
  for (const [, bloco] of readFileSync(arq, 'utf8').matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const dados = yaml.load(bloco);
    if (dados?.tipo === 'capa') return dados.imagem ?? null;
  }
  return null;
}

// Sequência da grade, do mais antigo para o mais novo: publicados e depois a fila
// (sem o que foi vetado com aprovado: false, que não vai ao ar).
export function sequenciaDaGrade() {
  const publicados = lerHistorico().publicados.map((p) => p.slug);
  const pendentes = lerFila().pendentes.filter((p) => p.aprovado !== false).map((p) => p.slug);
  return [...publicados, ...pendentes].map((slug) => ({ slug, imagem: capaDoPost(slug) }));
}

// Capas das últimas `janela` posições da grade, como Map imagem → slug.
export function capasRecentes(janela = JANELA_CAPAS) {
  return new Map(sequenciaDaGrade().slice(-janela).filter((p) => p.imagem).map((p) => [p.imagem, p.slug]));
}

export function capasLivres(recentes = capasRecentes()) {
  return FOTOS.filter((f) => !recentes.has(f));
}

// Lança erro se `imagem` repete uma capa recente; `extras` são capas de outros posts do
// mesmo lote que ainda não entraram na fila.
export function conferirCapa(imagem, { recentes = capasRecentes(), extras = new Map(), rotulo = 'post' } = {}) {
  const todas = new Map([...recentes, ...extras]);
  if (!todas.has(imagem)) return;
  const livres = FOTOS.filter((f) => !todas.has(f));
  throw new Error(`${rotulo}: a capa ${imagem} já é a de ${todas.get(imagem)}, e a capa não pode se repetir nos últimos ${JANELA_CAPAS} posts da grade. `
    + `Escolha outra pelo assunto entre as livres: ${livres.join(', ')}.`);
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const seq = sequenciaDaGrade();
  const nPub = lerHistorico().publicados.length;
  console.log(`Grade (últimos ${JANELA_CAPAS}, do mais antigo ao mais novo):`);
  let repetidas = 0;
  seq.forEach((p, i) => {
    if (i < seq.length - JANELA_CAPAS) return;
    const antes = seq.slice(Math.max(0, i - JANELA_CAPAS + 1), i).find((q) => q.imagem && q.imagem === p.imagem);
    if (antes) repetidas++;
    console.log(`  ${i < nPub ? 'publicado' : 'na fila  '}  ${String(p.imagem ?? '—').padEnd(28)} ${p.slug}${antes ? `   ⚠ repete ${antes.slug}` : ''}`);
  });
  console.log(`\nLivres para a próxima capa: ${capasLivres().join(', ')}`);
  if (repetidas) { console.error(`\n⚠ ${repetidas} capa(s) repetida(s) dentro da janela.`); process.exit(1); }
}
