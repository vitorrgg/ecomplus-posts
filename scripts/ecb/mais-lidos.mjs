// Coleta o bloco "Mais Lidos" da home do E-Commerce Brasil e o texto de cada
// artigo. Não há RSS nem API pública no site (testado em 21/09/2026: /feed,
// /wp-json e o endpoint do WordPress Popular Posts respondem 404), então a
// fonte é o HTML da home mesmo — o bloco tem a classe `mais-lidos` e cada
// item traz um `data-datalayer` JSON com título, categoria e autor.
//
// Uso:
//   node scripts/ecb/mais-lidos.mjs                 # grava ecb/semanas/<segunda>.json
//   node scripts/ecb/mais-lidos.mjs --limite 3      # só os N primeiros ainda não usados
//   node scripts/ecb/mais-lidos.mjs --stdout        # imprime o JSON em vez de gravar
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, segundaDaSemana, lerJson, args, decodeHtml } from './util.mjs';

const HOME = 'https://www.ecommercebrasil.com.br/';
const UA = 'Mozilla/5.0 (compatible; ecomplus-posts/1.0; +https://www.e-com.plus)';

async function baixar(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!res.ok) throw new Error(`${res.status} ao baixar ${url}`);
  return res.text();
}

function limparTexto(html) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim(),
  );
}

export function extrairMaisLidos(html) {
  const inicio = html.indexOf('mais-lidos"');
  if (inicio < 0) throw new Error('Não achei o bloco "mais-lidos" na home — o layout do site mudou?');
  // O bloco é uma coluna da seção de destaques; a coluna seguinte (rotulada
  // "titulo-mais-recentes") fecha ele. Sem esse corte, os itens das outras
  // colunas entrariam no ranking.
  let fim = html.indexOf('aria-labelledby="titulo-mais-recentes"', inicio);
  if (fim < 0) fim = html.indexOf('</section>', inicio);
  if (fim < 0) fim = html.length;
  const bloco = html.slice(inicio, fim);

  const itens = [];
  // Um item por <div class="article-card"> — os atributos vêm com quebras de
  // linha e a imagem só aparece depois do número, então cada campo é
  // procurado dentro do item, não em sequência.
  const pedacos = bloco.split(/<div class="article-card"/).slice(1);
  const pega = (txt, re) => { const m = txt.match(re); return m ? m[1] : null; };
  for (const item of pedacos) {
    const url = pega(item, /<h3>\s*<a href="([^"]+)"/);
    if (!url) continue;
    let meta = {};
    const raw = pega(item, /data-datalayer='([^']*)'/);
    if (raw) { try { meta = JSON.parse(raw); } catch { /* segue sem meta */ } }
    itens.push({
      posicao: Number(pega(item, /<strong>\s*(\d+)\s*<\/strong>/)) || itens.length + 1,
      url,
      titulo: limparTexto(pega(item, /<h3>\s*<a href="[^"]+">([\s\S]*?)<\/a>/) || meta.post_title || ''),
      descricao: limparTexto(pega(item, /<div class="card-text[^"]*">([\s\S]*?)<\/div>/) || ''),
      categoria: meta.post_category ? decodeHtml(meta.post_category) : null,
      autor: meta.post_author || null,
      tempoLeitura: meta.reading_time || null,
      imagem: pega(item, /<img[^>]*\ssrc="([^"]*)"/),
      publicadoEm: pega(item, /datetime="([^"]+)"/),
    });
  }
  // Dedupe por URL (o site repete o bloco pra mobile em alguns layouts).
  const vistos = new Set();
  const unicos = itens.filter((it) => !vistos.has(it.url) && vistos.add(it.url));
  itens.length = 0; itens.push(...unicos);
  if (!itens.length) throw new Error('Bloco "mais-lidos" encontrado, mas nenhum item casou com o padrão esperado.');
  return itens;
}

export function extrairArtigo(html) {
  const i = html.indexOf('class="article-content"');
  if (i < 0) return { paragrafos: [] };
  let corpo = html.slice(i);
  const fim = corpo.indexOf('</article>');
  if (fim > 0) corpo = corpo.slice(0, fim);
  const paragrafos = [...corpo.matchAll(/<(p|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((x) => limparTexto(x[2]))
    .filter((t) => t.length > 0);
  return { paragrafos };
}

export async function coletar({ limite = 3, ignorarUrls = new Set() } = {}) {
  const home = await baixar(HOME);
  const todos = extrairMaisLidos(home);
  const escolhidos = todos.filter((it) => !ignorarUrls.has(it.url)).slice(0, limite);
  for (const it of escolhidos) {
    const html = await baixar(it.url);
    const { paragrafos } = extrairArtigo(html);
    it.texto = paragrafos.join('\n\n');
    if (!it.texto) console.warn(`⚠ Sem texto extraído em ${it.url}`);
  }
  return { coletadoEm: new Date().toISOString(), fonte: HOME, ranking: todos, escolhidos };
}

const ehMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (ehMain) {
  const opts = args();
  const historico = lerJson(join(root, 'ecb', 'historico.json'), { publicados: [], gerados: [] });
  const usados = new Set([...historico.publicados, ...historico.gerados].map((x) => x.fonte));
  const resultado = await coletar({ limite: Number(opts.limite ?? 3), ignorarUrls: usados });
  if (opts.stdout) {
    console.log(JSON.stringify(resultado, null, 2));
  } else {
    const dir = join(root, 'ecb', 'semanas');
    mkdirSync(dir, { recursive: true });
    const arq = join(dir, `${segundaDaSemana()}.json`);
    if (existsSync(arq) && !opts.forcar) {
      console.log(`Já existe ${arq} — use --forcar pra sobrescrever.`);
    } else {
      writeFileSync(arq, JSON.stringify(resultado, null, 2) + '\n');
      console.log(`✓ ${arq}`);
    }
  }
  for (const it of resultado.ranking) {
    const marca = resultado.escolhidos.includes(it) ? '→' : usados.has(it.url) ? '×' : ' ';
    console.error(`${marca} ${String(it.posicao).padStart(2, '0')} ${it.titulo} (${it.categoria})`);
  }
}
