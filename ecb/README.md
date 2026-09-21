# Rotina ECB — mais lidos do E-Commerce Brasil no Instagram

Toda semana, os artigos mais lidos do portal [E-Commerce Brasil](https://www.ecommercebrasil.com.br/)
servem de **pauta** pra carrosséis de análise original da e-com.plus — o tema do
artigo cruzado com a realidade de quem tem loja própria e com os recursos da
plataforma (lista em [`recursos.md`](recursos.md)). Não é resumo e não cita fonte
nem autor; números entram com o nome de quem fez o estudo. Os posts saem com a
identidade visual da marca no Instagram [@ecomplus.io](https://www.instagram.com/ecomplus.io).

```
segunda 09:00        ecb-semanal.yml   coleta "Mais Lidos" → análises (API da Claude) → PNG + JPEG → commit na fila
seg/qua/sex 12:00    ecb-publicar.yml  publica o próximo da fila no Instagram → registra no histórico
```

Na segunda, o post gerado às 09:00 já sai às 12:00 do mesmo dia; os outros dois
esperam quarta e sexta.

Tudo roda no GitHub Actions deste repo; nada depende da máquina de ninguém.

## Peças

| Arquivo | O que faz |
|---|---|
| `scripts/ecb/mais-lidos.mjs` | Lê o bloco "Mais Lidos" da home (5 itens) e o texto de cada artigo. Grava `ecb/semanas/<segunda>.json`. Pula artigos já usados em semanas anteriores. |
| `scripts/ecb/gerar-briefs.mjs` | Pra cada artigo, pede à Claude (`claude-opus-5`, saída estruturada) uma análise original em 5 a 7 slides + legenda, com o penúltimo slide cruzando o tema com recursos da e-com.plus. Escreve `posts/<slug>/brief.md` e `legenda.txt` no mesmo formato dos outros posts do repo, registra em `ecb/historico.json` e enfileira em `ecb/fila.json`. |
| `ecb/recursos.md` | Lista de recursos da e-com.plus que a Claude pode citar. Editar aqui muda o que ela sabe da plataforma. |
| `scripts/render.mjs` | O render de sempre (Satori + resvg) → `output/<slug>/slide-N.png`. |
| `scripts/ecb/jpeg.mjs` | Converte os PNGs em JPEG — a API do Instagram só aceita JPEG. |
| `scripts/ecb/publicar-instagram.mjs` | Publica um carrossel pela Content Publishing API do Graph, lendo as imagens do `raw.githubusercontent.com` deste repo (por isso ele precisa continuar público). |
| `scripts/ecb/semana.mjs` | Encadeia coleta → briefs → render → JPEG. |
| `ecb/fila.json` | Posts prontos esperando publicação. |
| `ecb/historico.json` | Tudo que já foi gerado e publicado (evita repetir artigo). |

Slugs seguem `ecb-<segunda>-<assunto>`, ex. `ecb-2026-09-21-a-tela-que-voce-nao-controla`.

## Ativar

### 1. Segredos no GitHub (Settings → Secrets and variables → Actions)

| Secret | Pra quê |
|---|---|
| `ANTHROPIC_API_KEY` | Geração dos briefs. Chave em console.anthropic.com. |
| `IG_USER_ID` | ID da conta profissional do Instagram (não é o @). |
| `IG_ACCESS_TOKEN` | Token com permissão de publicar (ver abaixo). |

Variáveis opcionais (aba *Variables*):

| Variable | Padrão | Pra quê |
|---|---|---|
| `ECB_EXIGE_APROVACAO` | vazio (publica tudo) | `true` → só publica itens com `"aprovado": true` em `ecb/fila.json`. |
| `IG_GRAPH_HOST` | `graph.facebook.com` | `graph.instagram.com` se a conta usa "Instagram API with Instagram Login" (sem Página do Facebook). |

Sem `ANTHROPIC_API_KEY` o job de segunda falha; sem os `IG_*` o de publicação falha. Os dois workflows podem ser disparados na mão em *Actions → Run workflow* (o de publicar tem a opção *dry run*).

### 2. Token do Instagram

Caminho recomendado (token que não expira):

1. A conta @ecomplus.io precisa ser **profissional** (Business ou Creator) e estar vinculada a uma Página do Facebook.
2. Em [developers.facebook.com](https://developers.facebook.com/) crie um app do tipo *Business* e adicione o produto **Instagram** (Graph API). O app pode ficar em modo de desenvolvimento: publicar funciona pra contas de quem tem papel no app (admin/dev/tester), sem App Review.
3. No [Meta Business Suite → Configurações → Usuários → Usuários do sistema](https://business.facebook.com/settings/system-users), crie um usuário do sistema, dê acesso à Página e à conta do Instagram, e gere um token com `instagram_basic`, `instagram_content_publish`, `pages_show_list` e `pages_read_engagement`. Tokens de usuário do sistema não expiram.
   - Alternativa rápida: token de usuário no Graph API Explorer trocado por long-lived — expira em 60 dias e precisa ser renovado.
4. Descobrir o `IG_USER_ID`: `GET /me/accounts` → id da Página → `GET /{page-id}?fields=instagram_business_account`.

Limites da API que o script respeita: só JPEG, 2 a 10 imagens por carrossel, proporção 4:5 ok, no máximo 100 publicações por 24 h, legenda até 2.200 caracteres.

### 3. Primeira rodada

Com os segredos no lugar, dispare *ECB semanal — gerar posts* na mão, confira `output/ecb-*/` e `posts/ecb-*/legenda.txt` no commit que o bot fez, e depois dispare *ECB — publicar no Instagram* com *dry run* marcado. Se as URLs e a legenda saírem certas, rode sem dry run ou espere o próximo horário (seg/qua/sex 12:00).

## Revisar antes de publicar

O primeiro post da semana sai três horas depois de gerado (segunda 09:00 → 12:00); os outros dois ficam na fila até quarta e sexta. Nesse intervalo:

- pra **vetar** um post: em `ecb/fila.json`, ponha `"aprovado": false` (ou apague a pasta em `posts/` e `output/` e remova da fila);
- pra **editar**: mude o `brief.md`/`legenda.txt`, rode `npm run render -- <slug>` e `npm run ecb:jpeg -- <slug>`, comite;
- pra exigir aprovação sempre: variável `ECB_EXIGE_APROVACAO=true` e marque `"aprovado": true` no que pode ir.

## Rodar local

```bash
export ANTHROPIC_API_KEY=...
npm run ecb:semana                       # semana inteira (3 artigos)
npm run ecb:semana -- --limite 1
npm run ecb:semana -- --exemplo          # sem API, brief fixo, só pra testar o pipeline
npm run ecb:publicar -- --dry-run        # mostra o que iria pro Instagram
IG_USER_ID=... IG_ACCESS_TOKEN=... npm run ecb:publicar
```

A publicação de verdade só funciona com a fila comitada e enviada ao GitHub, porque a API do Instagram baixa as imagens da URL pública.

## Custos

- GitHub Actions: grátis em repo público.
- API da Claude: 3 artigos/semana em `claude-opus-5` ≈ US$ 0,20/semana.
- API do Instagram: grátis.

## Cuidados

- **Originalidade**: o prompt trata o artigo só como pauta, proíbe reproduzir frases dele e pede análise própria; dados entram com o nome de quem fez o estudo (NIQ, Worldpanel…), nunca do veículo. Se quiser voltar a creditar o portal, é uma linha no `SISTEMA` de `gerar-briefs.mjs`.
- **Layout do site**: a coleta depende do HTML da home (classe `mais-lidos`, `data-datalayer` nos cards, `article-content` no artigo). Se o site mudar, `mais-lidos.mjs` falha com mensagem clara e o job de segunda quebra — nada é publicado errado.
- **Workflows agendados** em repo sem atividade por 60 dias são desativados pelo GitHub; os commits semanais do bot mantêm o repo ativo, mas vale conferir em *Actions* se algum mês passar em branco.
- **Token de 60 dias**: se usar token de usuário em vez de usuário do sistema, o job de publicar começa a falhar com erro 190 quando ele expirar.
