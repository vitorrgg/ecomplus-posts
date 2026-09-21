# Rotina ECB — mais lidos do E-Commerce Brasil no Instagram

Toda semana, os artigos mais lidos do portal [E-Commerce Brasil](https://www.ecommercebrasil.com.br/)
servem de **pauta** pra carrosséis de análise original da e-com.plus — o tema do
artigo cruzado com a realidade de quem tem loja própria e com os recursos da
plataforma (lista em [`recursos.md`](recursos.md)). Não é resumo e não cita fonte
nem autor; números entram com o nome de quem fez o estudo. Os posts saem com a
identidade visual da marca no Instagram [@ecomplus.io](https://www.instagram.com/ecomplus.io).

```
segunda 09:00        geração          coleta "Mais Lidos" → análises (Claude Code, plano Max) → PNG + JPEG → commit na fila
seg/qua/sex 12:00    ecb-publicar.yml publica o próximo da fila no Instagram (GitHub Actions) → registra no histórico
```

Na segunda, o post gerado às 09:00 já sai às 12:00 do mesmo dia; os outros dois
esperam quarta e sexta.

A **geração** roda pelo Claude Code, que usa a assinatura Max (sem chave de API,
sem cobrança à parte), em um de dois lugares — os dois deixam o mesmo resultado
comitado no repo:

- **Rotina na nuvem do Claude Code** (recomendado): agendada em
  https://claude.ai/code/routines, roda toda segunda 09:00 num sandbox com o repo,
  escreve as análises, renderiza e comita. Não depende de máquina ligada.
- **Local**: `scripts/ecb/semana-local.sh` faz o mesmo na sua máquina chamando
  `claude -p`; dá pra agendar no Agendador de Tarefas do Windows ou rodar na mão.

A **publicação** continua no GitHub Actions, que só precisa dos segredos do
Instagram. O workflow `ecb-semanal.yml` (geração pela API paga) ficou como opção
manual, sem agenda.

## Peças

| Arquivo | O que faz |
|---|---|
| `scripts/ecb/mais-lidos.mjs` | Lê o bloco "Mais Lidos" da home (5 itens) e o texto de cada artigo. Grava `ecb/semanas/<segunda>.json`. Pula artigos já usados em semanas anteriores. |
| `scripts/ecb/gerar-briefs.mjs` | Pra cada artigo, obtém uma análise original em 5 a 7 slides + legenda (saída estruturada, `claude-opus-5`), com o penúltimo slide cruzando o tema com recursos da e-com.plus. Três vias: `--via claude-code` (padrão, `claude -p` local), `--via api` (SDK, precisa de `ANTHROPIC_API_KEY`) ou `--from-json` (JSONs já escritos, é o que a rotina na nuvem usa). Escreve `posts/<slug>/brief.md` e `legenda.txt`, registra em `ecb/historico.json` e enfileira em `ecb/fila.json`. |
| `ecb/PROMPT.md` | As regras editoriais. É o mesmo texto pro `claude -p`, pra API e pra rotina na nuvem — editar aqui muda o tom e a estrutura dos posts. |
| `ecb/recursos.md` | Lista de recursos da e-com.plus que a Claude pode citar. Editar aqui muda o que ela sabe da plataforma. |
| `ecb/ESQUEMA.json` | Formato de saída (derivado do zod em `gerar-briefs.mjs`; regravar com `npm run ecb:esquema` se mudar os campos). |
| `ecb/saidas/<segunda>/` | JSONs escritos pela rotina na nuvem antes de virarem brief. |
| `scripts/ecb/semana-local.sh` | Geração local completa com commit e push, pra agendar na sua máquina. |
| `scripts/render.mjs` | O render de sempre (Satori + resvg) → `output/<slug>/slide-N.png`. |
| `scripts/ecb/jpeg.mjs` | Converte os PNGs em JPEG — a API do Instagram só aceita JPEG. |
| `scripts/ecb/publicar-instagram.mjs` | Publica um carrossel pela Content Publishing API do Graph, lendo as imagens do `raw.githubusercontent.com` deste repo (por isso ele precisa continuar público). |
| `scripts/ecb/semana.mjs` | Encadeia coleta → briefs → render → JPEG. |
| `ecb/fila.json` | Posts prontos esperando publicação. |
| `ecb/historico.json` | Tudo que já foi gerado e publicado (evita repetir artigo). |

Slugs seguem `ecb-<segunda>-<assunto>`, ex. `ecb-2026-09-21-a-tela-que-voce-nao-controla`.

## Ativar

### 0. Geração pelo plano Max

**Rotina na nuvem** (já criada, desligada):
https://claude.ai/code/routines/trig_01We3sA7uPD2a3s8o5Cr4oQ5 — confira que o
repo está acessível e ligue. Ela roda toda segunda 09:00 (São Paulo) e precisa
que `ecb/PROMPT.md`, `ecb/ESQUEMA.json` e o `gerar-briefs.mjs --from-json` já
estejam na master (commit e push). Pra testar sem
esperar, use *Run now* e acompanhe a sessão; o resultado é um commit na master.

**Local** (alternativa ou reserva): rode `claude` uma vez no terminal e faça
`/login`; depois `bash scripts/ecb/semana-local.sh`. Pra agendar no Windows,
crie uma tarefa semanal (segunda 09:00) com a ação
`wsl.exe -u vitorrgg -- bash -lc "~/ecomplus-posts/scripts/ecb/semana-local.sh"`.
O log fica em `ecb/local.log`.

### 1. Segredos no GitHub (Settings → Secrets and variables → Actions)

| Secret | Pra quê |
|---|---|
| `IG_USER_ID` | ID da conta profissional do Instagram (não é o @). |
| `IG_ACCESS_TOKEN` | Token com permissão de publicar (ver abaixo). |
| `ANTHROPIC_API_KEY` | Só se quiser a geração pela API (workflow manual `ecb-semanal.yml`). Cobrada à parte do Max. |

Variáveis opcionais (aba *Variables*):

| Variable | Padrão | Pra quê |
|---|---|---|
| `ECB_EXIGE_APROVACAO` | vazio (publica tudo) | `true` → só publica itens com `"aprovado": true` em `ecb/fila.json`. |
| `IG_GRAPH_HOST` | `graph.facebook.com` | `graph.instagram.com` se a conta usa "Instagram API with Instagram Login" (sem Página do Facebook). |

Sem os `IG_*` o job de publicação falha. Os dois workflows podem ser disparados na mão em *Actions → Run workflow* (o de publicar tem a opção *dry run*).

### 2. Token do Instagram

Caminho recomendado (token que não expira):

1. A conta @ecomplus.io precisa ser **profissional** (Business ou Creator) e estar vinculada a uma Página do Facebook.
2. Em [developers.facebook.com](https://developers.facebook.com/) crie um app do tipo *Business* e adicione o produto **Instagram** (Graph API). O app pode ficar em modo de desenvolvimento: publicar funciona pra contas de quem tem papel no app (admin/dev/tester), sem App Review.
3. No [Meta Business Suite → Configurações → Usuários → Usuários do sistema](https://business.facebook.com/settings/system-users), crie um usuário do sistema, dê acesso à Página e à conta do Instagram, e gere um token com `instagram_basic`, `instagram_content_publish`, `pages_show_list` e `pages_read_engagement`. Tokens de usuário do sistema não expiram.
   - Alternativa rápida: token de usuário no Graph API Explorer trocado por long-lived — expira em 60 dias e precisa ser renovado.
4. Descobrir o `IG_USER_ID`: `GET /me/accounts` → id da Página → `GET /{page-id}?fields=instagram_business_account`.

Limites da API que o script respeita: só JPEG, 2 a 10 imagens por carrossel, proporção 4:5 ok, no máximo 100 publicações por 24 h, legenda até 2.200 caracteres.

### 3. Primeira rodada

Com os segredos do Instagram no lugar e a fila já comitada, dispare *ECB — publicar no Instagram* com *dry run* marcado e confira URLs e legenda no log. Se estiver certo, rode sem dry run ou espere o próximo horário (seg/qua/sex 12:00). Depois rode a geração uma vez (*Run now* na rotina da nuvem, ou `semana-local.sh`) e confira `output/ecb-*/` e `posts/ecb-*/legenda.txt` no commit resultante.

## Revisar antes de publicar

O primeiro post da semana sai três horas depois de gerado (segunda 09:00 → 12:00); os outros dois ficam na fila até quarta e sexta. Nesse intervalo:

- pra **vetar** um post: em `ecb/fila.json`, ponha `"aprovado": false` (ou apague a pasta em `posts/` e `output/` e remova da fila);
- pra **editar**: mude o `brief.md`/`legenda.txt`, rode `npm run render -- <slug>` e `npm run ecb:jpeg -- <slug>`, comite;
- pra exigir aprovação sempre: variável `ECB_EXIGE_APROVACAO=true` e marque `"aprovado": true` no que pode ir.

## Rodar local

```bash
bash scripts/ecb/semana-local.sh         # tudo, com commit e push (claude -p, plano Max)
npm run ecb:semana                       # só gerar + renderizar, sem git (claude -p)
npm run ecb:semana -- --limite 1
npm run ecb:semana -- --via api          # pela API (precisa de ANTHROPIC_API_KEY)
npm run ecb:semana -- --exemplo          # sem modelo, brief fixo, só pra testar o pipeline
npm run ecb:publicar -- --dry-run        # mostra o que iria pro Instagram
IG_USER_ID=... IG_ACCESS_TOKEN=... npm run ecb:publicar
```

O `claude -p` precisa do Claude Code logado nessa máquina (`claude` → `/login`).

A publicação de verdade só funciona com a fila comitada e enviada ao GitHub, porque a API do Instagram baixa as imagens da URL pública.

## Custos

- Geração pelo Claude Code (rotina na nuvem ou local): dentro da assinatura Max, consome uma fração pequena da cota semanal (3 análises).
- GitHub Actions: grátis em repo público.
- API do Instagram: grátis.
- Só a via `--via api` custa à parte (≈ US$ 0,20/semana em `claude-opus-5`).

## Cuidados

- **Originalidade**: o prompt trata o artigo só como pauta, proíbe reproduzir frases dele e pede análise própria; dados entram com o nome de quem fez o estudo (NIQ, Worldpanel…), nunca do veículo. Se quiser voltar a creditar o portal, é uma linha no `SISTEMA` de `gerar-briefs.mjs`.
- **Layout do site**: a coleta depende do HTML da home (classe `mais-lidos`, `data-datalayer` nos cards, `article-content` no artigo). Se o site mudar, `mais-lidos.mjs` falha com mensagem clara e o job de segunda quebra — nada é publicado errado.
- **Workflows agendados** em repo sem atividade por 60 dias são desativados pelo GitHub; os commits semanais do bot mantêm o repo ativo, mas vale conferir em *Actions* se algum mês passar em branco.
- **Login do Claude Code local**: o token OAuth da máquina expira de tempos em tempos; se `semana-local.sh` falhar com "Not logged in" ou "OAuth session expired", rode `claude` e `/login`. A rotina na nuvem não tem esse problema.
- **Token de 60 dias**: se usar token de usuário em vez de usuário do sistema, o job de publicar começa a falhar com erro 190 quando ele expirar.
