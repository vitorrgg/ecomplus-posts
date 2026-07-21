import { tokens } from './tokens.mjs';

// Árvore de elementos no formato que o Satori espera (tipo JSX sem JSX).
// Toda div com filhos precisa de display:flex explícito — regra do Satori.
export function slideBase({ titulo, texto, slideAtual, totalSlides }) {
  return {
    type: 'div',
    props: {
      style: {
        width: '1080px',
        height: '1350px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        padding: '90px',
        backgroundColor: tokens.colorBg,
        fontFamily: tokens.fontBody,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '100%',
              fontFamily: tokens.fontDisplay,
              fontStyle: 'italic',
              fontWeight: 600,
              textTransform: 'lowercase',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              fontSize: '64px',
              color: tokens.colorBrand,
              marginBottom: '32px',
            },
            children: titulo,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '100%',
              fontFamily: tokens.fontBody,
              fontWeight: 400,
              fontSize: '32px',
              lineHeight: 1.3,
              color: tokens.colorText,
            },
            children: texto,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              position: 'absolute',
              bottom: '60px',
              right: '90px',
              fontFamily: tokens.fontBody,
              fontSize: '22px',
              color: tokens.colorPrimary,
            },
            children: `${slideAtual}/${totalSlides}`,
          },
        },
      ],
    },
  };
}
