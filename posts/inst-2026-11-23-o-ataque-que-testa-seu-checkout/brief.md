# Pauta própria: o ataque que testa seu checkout

Análise original a partir da pauta https://www.e-com.plus/v2#o-que-muda (referência interna, não vai pro post).
Gerado em 2026-11-27 por scripts/ecb/gerar-briefs.mjs.

## Slide 1
```yaml
tipo: capa
eyebrow: e-com.plus V2 · segurança
titulo: |-
  o ataque
  que testa
  seu checkout
subtitulo: Robôs usam o checkout de lojas para descobrir quais cartões roubados funcionam, e o custo fica com a loja.
imagem: own-store-checkout.jpg
```

## Slide 2
```yaml
tipo: texto
titulo: O que é o teste de cartão
paragrafos:
  - Quem rouba dados de cartão precisa saber quais ainda funcionam. Para isso, robôs fazem centenas de compras pequenas em checkouts de lojas, uma atrás da outra.
  - Cada tentativa pode gerar tarifa no gateway, e o volume de recusas pode fazer o adquirente desconfiar da sua loja.
```

## Slide 3
```yaml
tipo: lista
titulo: Os sinais de que a loja virou alvo
itens:
  - Muitas tentativas de pagamento recusadas em poucos minutos
  - Pedidos de valor baixo com dados de cliente que não fazem sentido
  - Picos de acesso ao checkout sem aumento de visitas na loja
  - Aviso do gateway sobre uma taxa de recusa acima do normal
tema: claro
```

## Slide 4
```yaml
tipo: texto
titulo: Por que isso mexe na conversão
paragrafos:
  - A reação comum é endurecer o antifraude, e aí o cliente de verdade começa a ter o cartão recusado sem motivo.
  - Na nossa experiência, a proteção boa é a que barra o robô sem pôr mais uma barreira para quem quer comprar.
imagem: payment-terminal-tap.jpg
```

## Slide 5
```yaml
tipo: lista
titulo: Como a V2 da e-com.plus protege o checkout
itens:
  - Limite de tentativas no checkout, que barra ataques de teste de cartão em massa
  - Autenticação 3DS no cartão, com o resultado registrado no pedido
  - Cada loja no próprio projeto do Google Cloud, então o ataque é tratado na loja atingida
  - Histórico de cada operação na API, para saber o que mudou e quem mudou
tema: claro
```

## Slide 6
```yaml
tipo: fechamento
paragrafos:
  - O teste de cartão procura qualquer checkout sem proteção, de loja grande ou pequena. Quanto antes ele é barrado, menos ele custa.
  - Nesta semana, peça ao seu gateway o relatório de recusas dos últimos 30 dias e veja se há picos fora do normal.
```
