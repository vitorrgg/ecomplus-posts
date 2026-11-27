# Recursos da e-com.plus que o gerador pode cruzar com a pauta

Lido por `scripts/ecb/gerar-briefs.mjs` e colado no prompt. Uma linha por recurso:
`nome — o que é, em uma frase`. Editar aqui muda o que a Claude sabe sobre a
plataforma; não inventar recurso que não existe.

- Modelo comercial — sem comissão sobre o faturamento. Nunca citar valores: nada de mensalidade, preço por pedido ou R$.
- Headless / API-first — storefront é código do lojista (Astro + Vue), versionado no Git, com API aberta; checkout e página de confirmação são telas da loja, não do fornecedor.
- Construtor de páginas — editor visual com preview em tempo real, cada mudança versionada no Git.
- Checkout próprio com gatilhos — checkout passwordless (reduz abandono), cross-sell e regras no próprio fluxo, sem tirar a marca da experiência.
- Pix transparente — pagamento Pix dentro da loja, sem redirecionar; segundo a Worldpay, o Pix respondeu por 42% do valor transacionado no e-commerce brasileiro em 2025, à frente do cartão de crédito.
- Assinaturas e recorrência — clube de assinatura ou compra recorrente nativos, com desconto na recorrência.
- Fidelidade e cashback — cashback nativo, sem app externo.
- Afiliados / member get member — link próprio por cliente, rastreio de origem e comissão automática por venda.
- Descontos complexos — regras granulares (progressivo, por cliente, por kit) que protegem margem em vez de só baixar preço.
- E-mail marketing nativo — recuperação de carrinho e fluxos automáticos por regra.
- Notificações push — notificação nativa no dispositivo, sem depender do alcance de rede social.
- Motor de busca — correção ortográfica, autocomplete e filtro por especificação técnica.
- Avaliações de clientes — nativas, sem app.
- Blog nativo e conteúdo para IA — páginas e fichas estruturadas que ChatGPT, Gemini e afins conseguem ler e citar.
- Multilojas — mesmo catálogo e estoque em quantos sites fizerem sentido (marcas, países, B2B/B2C).
- OMS nativo — gestão de pedidos de todos os canais no mesmo painel, sem módulo extra.
- Centros de distribuição (multi-CD) — cálculo automático de frete e prazo por origem.
- Frete flexível — mais de 15 integrações nativas (Correios, Jadlog, Melhor Envio, Loggi…).
- Marketplaces — integração com Mercado Livre e outros; a loja própria convive com o marketplace, não substitui.
- D2C para indústrias — loja própria da marca sem perder o distribuidor de vista (tabela por login, B2B e B2C).
- IA no painel — chat que responde sobre a operação da loja; conector MCP liga o Claude direto à API, sem export.
- API de analytics — agregações e atualizações em massa direto na base da loja.
- Plataforma própria por loja (V2) — cada loja roda no próprio projeto do Google Cloud, com os apps que usa; a loja e as suas integrações podem ser atualizadas e customizadas sem esperar as outras, e ao mudar de versão a loja não perde recursos nem precisa migrar de novo.
- Segurança no checkout — limite de tentativas que barra ataques de teste de cartão em massa e autenticação 3DS no cartão, com o resultado registrado no pedido.
- Histórico de operações (Events API) — toda criação, edição ou exclusão na API fica registrada com data, campos alterados e quem fez (usuário, app ou chave), útil para auditoria e LGPD.
- Eventos pelo servidor — compras e conversões enviadas do servidor para GA4, Meta, TikTok e Awin, mesmo quando o navegador bloqueia o pixel.
- Teste A/B na frente de loja — duas versões no ar com o tráfego dividido e preview do conteúdo antes de publicar.
