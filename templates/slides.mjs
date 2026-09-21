// Construtores de árvore Satori pros 4 tipos de slide, seguindo o padrão
// observado em identidade/exemplos: fundo gradiente escuro + textura diagonal,
// título condensado itálico só na capa, texto denso sem moldura no conteúdo,
// logo no rodapé (capa e fechamento), seta indicando "arraste" (exceto no fechamento).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from './tokens.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function toDataUri(path, mime) {
  const buf = readFileSync(path);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const logoWhite = toDataUri(join(rootDir, 'identidade', 'logos', 'ecomplus-logo-white.png'), 'image/png');
const logoDark = toDataUri(join(rootDir, 'identidade', 'logos', 'ecomplus-logo.png'), 'image/png');
const stripes = toDataUri(join(rootDir, 'templates', 'assets', 'stripes.png'), 'image/png');

function photoDataUri(filename) {
  return toDataUri(join(rootDir, 'templates', 'assets', 'photos', filename), 'image/jpeg');
}

// logo original: 600x147px
const LOGO_W = 190;
const LOGO_H = Math.round((LOGO_W * 147) / 600);

function flex(style, children) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

function textBlock(text, style) {
  // quebras de linha manuais ("\n") viram divs separados; cada um ainda quebra
  // naturalmente se for mais largo que o slide.
  const lines = String(text).split('\n');
  if (lines.length === 1) {
    return flex(style, text);
  }
  return flex(
    { flexDirection: 'column', ...style },
    lines.map((line) => flex({}, line)),
  );
}

function arrowIcon(color = '#ffffff') {
  return {
    type: 'svg',
    props: {
      width: 60,
      height: 22,
      viewBox: '0 0 60 22',
      fill: 'none',
      children: [
        { type: 'path', props: { d: 'M0 11 H50', stroke: color, strokeWidth: 2 } },
        { type: 'path', props: { d: 'M40 1 L51 11 L40 21', stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } },
      ],
    },
  };
}

function photoBlock(filename, { height = 460, marginTop = 44 } = {}) {
  return flex(
    { width: '100%', height: `${height}px`, borderRadius: '24px', overflow: 'hidden', marginTop: `${marginTop}px` },
    [
      {
        type: 'img',
        props: {
          src: photoDataUri(filename),
          width: 900,
          height,
          style: { width: '100%', height: '100%', objectFit: 'cover' },
        },
      },
    ],
  );
}

function bottomRow({ showArrow, light }) {
  return flex(
    {
      position: 'absolute',
      left: '90px',
      right: '90px',
      bottom: '72px',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    [
      { type: 'img', props: { src: light ? logoDark : logoWhite, width: LOGO_W, height: LOGO_H } },
      ...(showArrow ? [arrowIcon(light ? tokens.colorText : '#ffffff')] : []),
    ],
  );
}

// fundo padrão (gradiente escuro + textura), fundo claro (`light`), ou, se
// `bgPhoto` for passado, foto full-bleed com um degradê escuro por cima na
// metade inferior pra manter o texto legível (sempre em tema escuro, já que
// é a própria foto que ocupa o slide inteiro).
function frame(children, { paddingTop, bgPhoto, light }) {
  const background = bgPhoto
    ? [
        { type: 'img', props: { src: photoDataUri(bgPhoto), width: 1080, height: 1350, style: { position: 'absolute', top: 0, left: 0, objectFit: 'cover' } } },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '1080px',
              height: '1350px',
              display: 'flex',
              backgroundImage: 'linear-gradient(180deg, rgba(10,1,16,0) 0%, rgba(10,1,16,0.55) 52%, rgba(10,1,16,0.95) 78%, rgba(10,1,16,1) 100%)',
            },
          },
        },
      ]
    : light
      ? []
      : [{ type: 'img', props: { src: stripes, width: 1080, height: 1350, style: { position: 'absolute', top: 0, left: 0 } } }];
  return {
    type: 'div',
    props: {
      style: {
        width: '1080px',
        height: '1350px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        paddingTop: `${paddingTop}px`,
        paddingLeft: '90px',
        paddingRight: '90px',
        backgroundColor: bgPhoto ? '#0a0110' : light ? tokens.colorBg : '#0a0110',
        ...(bgPhoto || light ? {} : { backgroundImage: tokens.darkGradient }),
        fontFamily: tokens.fontBody,
      },
      children: [...background, ...children],
    },
  };
}

function titleStyle(light) {
  return {
    flexDirection: 'column',
    width: '100%',
    fontFamily: tokens.fontDisplay,
    fontStyle: 'italic',
    fontWeight: 600,
    textTransform: 'lowercase',
    lineHeight: 1.08,
    fontSize: '68px',
    color: light ? tokens.colorText : '#ffffff',
  };
}

export function coverSlide({ eyebrow, titulo, subtitulo, imagem, tema }) {
  const light = tema === 'claro';
  // fundo claro não usa foto full-bleed (perderia o contraste que dá legibilidade
  // ao degradê) — nesse tema a imagem entra como bloco arredondado, como no texto/fechamento.
  const bgPhoto = light ? undefined : imagem;
  const textColor = light ? tokens.colorText : '#ffffff';
  return frame(
    [
      eyebrow
        ? textBlock(eyebrow, { fontSize: 26, color: light ? tokens.colorBrand : 'rgba(255,255,255,0.85)', marginBottom: 20 })
        : null,
      textBlock(titulo, titleStyle(light)),
      subtitulo
        ? textBlock(subtitulo, {
            flexDirection: 'column',
            width: '100%',
            fontSize: 32,
            color: light ? textColor : 'rgba(255,255,255,0.92)',
            lineHeight: 1.35,
            marginTop: 32,
          })
        : null,
      light && imagem ? photoBlock(imagem, { height: 420, marginTop: 44 }) : null,
      bottomRow({ showArrow: true, light }),
    ].filter(Boolean),
    { paddingTop: bgPhoto ? 640 : light && imagem ? 380 : 470, bgPhoto, light },
  );
}

export function textSlide({ titulo, paragrafos, imagem, tema }) {
  const light = tema === 'claro';
  const textColor = light ? tokens.colorText : '#ffffff';
  return frame(
    [
      titulo
        ? textBlock(titulo, {
            flexDirection: 'column',
            width: '100%',
            fontFamily: tokens.fontBody,
            fontWeight: 700,
            fontSize: 46,
            color: textColor,
            lineHeight: 1.25,
            marginBottom: 40,
          })
        : null,
      flex(
        { flexDirection: 'column', width: '100%' },
        paragrafos.map((p, i) =>
          textBlock(p, {
            flexDirection: 'column',
            width: '100%',
            fontSize: 34,
            color: textColor,
            lineHeight: 1.4,
            marginBottom: i < paragrafos.length - 1 ? 36 : 0,
          }),
        ),
      ),
      imagem ? photoBlock(imagem, { height: 460 }) : null,
    ].filter(Boolean),
    { paddingTop: imagem ? (titulo ? 260 : 250) : titulo ? 300 : 290, light },
  );
}

export function listSlide({ titulo, itens, imagem, tema }) {
  const light = tema === 'claro';
  const textColor = light ? tokens.colorText : '#ffffff';
  return frame(
    [
      textBlock(titulo, {
        flexDirection: 'column',
        width: '100%',
        fontFamily: tokens.fontBody,
        fontWeight: 700,
        fontSize: 46,
        color: textColor,
        lineHeight: 1.25,
        marginBottom: 44,
      }),
      flex(
        { flexDirection: 'column', width: '100%' },
        itens.map((item, i) =>
          flex(
            { marginBottom: i < itens.length - 1 ? 28 : 0, alignItems: 'flex-start', width: '100%' },
            [
              flex({ fontSize: 32, color: textColor, marginRight: 20 }, '•'),
              flex(
                { flex: 1, flexDirection: 'column', fontSize: 32, color: textColor, lineHeight: 1.35 },
                item,
              ),
            ],
          ),
        ),
      ),
      imagem ? photoBlock(imagem, { height: 340, marginTop: 40 }) : null,
    ].filter(Boolean),
    { paddingTop: imagem ? 260 : 300, light },
  );
}

export function closingSlide({ paragrafos, imagem, tema }) {
  const light = tema === 'claro';
  const textColor = light ? tokens.colorText : '#ffffff';
  return frame(
    [
      flex(
        { flexDirection: 'column', width: '100%' },
        paragrafos.map((p, i) =>
          textBlock(p, {
            flexDirection: 'column',
            width: '100%',
            fontSize: 34,
            color: textColor,
            lineHeight: 1.4,
            marginBottom: i < paragrafos.length - 1 ? 36 : 0,
          }),
        ),
      ),
      imagem ? photoBlock(imagem, { height: 380, marginTop: 40 }) : null,
      bottomRow({ showArrow: false, light }),
    ].filter(Boolean),
    { paddingTop: imagem ? 250 : 290, light },
  );
}

/* ------------------------------------------------------------------ *
 * Modelos alternativos de capa.
 *
 * O carrossel ficava monótono com uma capa só: nove posts seguidos com o
 * mesmo enquadramento. Estes dois vieram dos exemplos feitos à mão em
 * `identidade/exemplos/`, que já usavam layouts que o pipeline não tinha.
 *
 *  · `capa-case`    — de "Case BarraDoce 01": tarja de assunto no topo,
 *                     texto à esquerda, print sangrando pela direita, selo
 *                     circular sobre o print e rodapé branco com o logo.
 *                     Serve quando existe um número ou uma decisão única
 *                     para carregar a capa.
 *
 *  · `capa-vitrine` — de "Golive lado fit e lado rosa": chapéu curto, título
 *                     grande em itálico, endereços sublinhados e dois prints
 *                     sobrepostos na metade de baixo. Serve quando o assunto
 *                     é a própria loja no ar.
 * ------------------------------------------------------------------ */

/* Print em moldura arredondada, com sombra — usado pelos dois modelos. */
function printBox(filename, style) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        overflow: 'hidden',
        borderRadius: '28px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        ...style,
      },
      children: [
        {
          type: 'img',
          props: {
            src: photoDataUri(filename),
            style: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' },
          },
        },
      ],
    },
  };
}

function baseEscura(children) {
  return {
    type: 'div',
    props: {
      style: {
        width: '1080px',
        height: '1350px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: '#0a0110',
        backgroundImage: tokens.darkGradient,
        fontFamily: tokens.fontBody,
      },
      children,
    },
  };
}

export function coverCaseSlide({ tarja, chapeu, destaque, titulo, apoio, imagem, selo, site }) {
  return baseEscura([
    { type: 'img', props: { src: stripes, width: 1080, height: 1350, style: { position: 'absolute', top: 0, left: 0 } } },

    /* tarja de assunto, no topo */
    flex(
      {
        position: 'absolute', top: 0, left: 0, width: '1080px', height: '132px',
        alignItems: 'center', paddingLeft: '90px', paddingRight: '90px',
        backgroundColor: '#4a0a52',
      },
      [textBlock(tarja, { fontSize: 30, color: 'rgba(255,255,255,0.92)' })],
    ),

    /* print sangrando pela direita */
    imagem
      ? printBox(imagem, {
          position: 'absolute', right: '-70px', top: '250px',
          width: '520px', height: '860px',
        })
      : null,

    /*
     * Selo circular montado sobre a borda esquerda do print. Fica embaixo, e
     * não no topo como no exemplo à mão: ali a coluna de texto era curta; aqui
     * ela desce até uns 760px e o selo bateria no meio dela.
     */
    selo
      ? flex(
          {
            position: 'absolute', right: '400px', top: '900px',
            width: '190px', height: '190px', borderRadius: '95px',
            backgroundColor: '#ffffff', border: `10px solid ${tokens.colorSuccess}`,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column',
          },
          [
            textBlock(String(selo.valor), {
              fontSize: 62, fontWeight: 700, color: tokens.colorText, lineHeight: 1,
            }),
            selo.rotulo
              ? textBlock(selo.rotulo, {
                  fontSize: 17, color: tokens.colorText, marginTop: 4, opacity: 0.7,
                })
              : null,
          ].filter(Boolean),
        )
      : null,

    /* coluna de texto, à esquerda */
    flex(
      {
        /* 520 e não mais: o print entra por 630px, e texto até ali encostaria */
        position: 'absolute', left: '90px', top: '300px', width: '520px',
        flexDirection: 'column',
      },
      [
        chapeu ? textBlock(chapeu, { fontSize: 40, color: 'rgba(255,255,255,0.92)', marginBottom: 18 }) : null,
        destaque
          ? textBlock(destaque, {
              fontFamily: tokens.fontDisplay, fontStyle: 'italic', fontWeight: 600,
              fontSize: 128, color: '#ffffff', lineHeight: 1, marginBottom: 18,
            })
          : null,
        textBlock(titulo, {
          flexDirection: 'column', width: '100%',
          fontSize: 48, fontWeight: 700, color: '#ffffff', lineHeight: 1.15,
        }),
        apoio
          ? textBlock(apoio, {
              flexDirection: 'column', width: '100%',
              fontSize: 29, color: 'rgba(255,255,255,0.86)', lineHeight: 1.4, marginTop: 26,
            })
          : null,
      ].filter(Boolean),
    ),

    /* seta, acima do rodapé */
    flex({ position: 'absolute', right: '90px', bottom: '210px' }, [arrowIcon('#ffffff')]),

    /* rodapé branco */
    flex(
      {
        position: 'absolute', bottom: 0, left: 0, width: '1080px', height: '150px',
        alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: '90px', paddingRight: '90px', backgroundColor: '#ffffff',
      },
      [
        { type: 'img', props: { src: logoDark, width: LOGO_W, height: LOGO_H } },
        textBlock(site || 'www.e-com.plus', { fontSize: 30, color: tokens.colorText }),
      ],
    ),
  ].filter(Boolean));
}

export function coverVitrineSlide({ chapeu, titulo, enderecos = [], imagem, imagemSecundaria }) {
  return baseEscura([
    { type: 'img', props: { src: stripes, width: 1080, height: 1350, style: { position: 'absolute', top: 0, left: 0 } } },

    flex(
      /* 600: o print retrato sobe até 520px de altura e entra por 720px */
      { position: 'absolute', left: '90px', top: '170px', width: '600px', flexDirection: 'column' },
      [
        chapeu ? textBlock(chapeu, { fontSize: 42, color: 'rgba(255,255,255,0.88)', marginBottom: 14 }) : null,
        textBlock(titulo, {
          flexDirection: 'column', width: '100%',
          fontFamily: tokens.fontDisplay, fontStyle: 'italic', fontWeight: 600,
          textTransform: 'lowercase', fontSize: 82, color: '#ffffff', lineHeight: 1.05,
        }),
        enderecos.length
          ? flex(
              { flexDirection: 'column', marginTop: 34 },
              enderecos.map((e) => flex(
                { fontSize: 34, color: '#ffffff', textDecoration: 'underline', marginBottom: 6 },
                e,
              )),
            )
          : null,
      ].filter(Boolean),
    ),

    /* dois prints sobrepostos, sangrando pelas bordas */
    imagemSecundaria
      ? printBox(imagemSecundaria, {
          position: 'absolute', left: '-40px', bottom: '210px',
          width: '640px', height: '400px',
        })
      : null,
    imagem
      ? printBox(imagem, {
          position: 'absolute', right: '-30px', bottom: '150px',
          width: '390px', height: '680px',
        })
      : null,

    flex(
      {
        position: 'absolute', left: '90px', right: '90px', bottom: '58px',
        justifyContent: 'space-between', alignItems: 'center',
      },
      [
        { type: 'img', props: { src: logoWhite, width: LOGO_W, height: LOGO_H } },
        arrowIcon('#ffffff'),
      ],
    ),
  ].filter(Boolean));
}
