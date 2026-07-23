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

function arrowIcon() {
  return {
    type: 'svg',
    props: {
      width: 60,
      height: 22,
      viewBox: '0 0 60 22',
      fill: 'none',
      children: [
        { type: 'path', props: { d: 'M0 11 H50', stroke: '#ffffff', strokeWidth: 2 } },
        { type: 'path', props: { d: 'M40 1 L51 11 L40 21', stroke: '#ffffff', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } },
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

function bottomRow({ showArrow }) {
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
      { type: 'img', props: { src: logoWhite, width: LOGO_W, height: LOGO_H } },
      ...(showArrow ? [arrowIcon()] : []),
    ],
  );
}

// fundo padrão (gradiente + textura) ou, se `bgPhoto` for passado, foto full-bleed
// com um degradê escuro por cima na metade inferior pra manter o texto legível.
function frame(children, { paddingTop, bgPhoto }) {
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
        backgroundColor: '#0a0110',
        ...(bgPhoto ? {} : { backgroundImage: tokens.darkGradient }),
        fontFamily: tokens.fontBody,
      },
      children: [...background, ...children],
    },
  };
}

const titleStyle = {
  flexDirection: 'column',
  width: '100%',
  fontFamily: tokens.fontDisplay,
  fontStyle: 'italic',
  fontWeight: 600,
  textTransform: 'lowercase',
  lineHeight: 1.08,
  fontSize: '68px',
  color: '#ffffff',
};

export function coverSlide({ eyebrow, titulo, subtitulo, imagem }) {
  return frame(
    [
      eyebrow
        ? textBlock(eyebrow, { fontSize: 26, color: 'rgba(255,255,255,0.85)', marginBottom: 20 })
        : null,
      textBlock(titulo, titleStyle),
      subtitulo
        ? textBlock(subtitulo, {
            flexDirection: 'column',
            width: '100%',
            fontSize: 32,
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.35,
            marginTop: 32,
          })
        : null,
      bottomRow({ showArrow: true }),
    ].filter(Boolean),
    { paddingTop: imagem ? 640 : 470, bgPhoto: imagem },
  );
}

export function textSlide({ titulo, paragrafos, imagem }) {
  return frame(
    [
      titulo
        ? textBlock(titulo, {
            flexDirection: 'column',
            width: '100%',
            fontFamily: tokens.fontBody,
            fontWeight: 700,
            fontSize: 46,
            color: '#ffffff',
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
            color: '#ffffff',
            lineHeight: 1.4,
            marginBottom: i < paragrafos.length - 1 ? 36 : 0,
          }),
        ),
      ),
      imagem ? photoBlock(imagem, { height: 460 }) : null,
    ].filter(Boolean),
    { paddingTop: imagem ? (titulo ? 260 : 250) : titulo ? 300 : 290 },
  );
}

export function listSlide({ titulo, itens }) {
  return frame(
    [
      textBlock(titulo, {
        flexDirection: 'column',
        width: '100%',
        fontFamily: tokens.fontBody,
        fontWeight: 700,
        fontSize: 46,
        color: '#ffffff',
        lineHeight: 1.25,
        marginBottom: 44,
      }),
      flex(
        { flexDirection: 'column', width: '100%' },
        itens.map((item, i) =>
          flex(
            { marginBottom: i < itens.length - 1 ? 28 : 0, alignItems: 'flex-start', width: '100%' },
            [
              flex({ fontSize: 32, color: '#ffffff', marginRight: 20 }, '•'),
              flex(
                { flex: 1, flexDirection: 'column', fontSize: 32, color: '#ffffff', lineHeight: 1.35 },
                item,
              ),
            ],
          ),
        ),
      ),
    ],
    { paddingTop: 300 },
  );
}

export function closingSlide({ paragrafos, imagem }) {
  return frame(
    [
      flex(
        { flexDirection: 'column', width: '100%' },
        paragrafos.map((p, i) =>
          textBlock(p, {
            flexDirection: 'column',
            width: '100%',
            fontSize: 34,
            color: '#ffffff',
            lineHeight: 1.4,
            marginBottom: i < paragrafos.length - 1 ? 36 : 0,
          }),
        ),
      ),
      imagem ? photoBlock(imagem, { height: 380, marginTop: 40 }) : null,
      bottomRow({ showArrow: false }),
    ].filter(Boolean),
    { paddingTop: imagem ? 250 : 290 },
  );
}
