# Vídeos: Reels e Shorts automáticos

A fila de vídeos orgânicos. Cada vídeo sai como **Reel no Instagram** (@ecomplus.io e/ou @vitorrgg) e **Short no YouTube** (canal da e-com.plus e/ou canal pessoal) no horário marcado, e o aviso cai no #conteudo do Slack ([credenciais do YouTube](#youtube)). É separada da rotina de carrosséis (`ecb/`).

## Como pôr um vídeo na fila

1. Crie a pasta `videos/<slug>/`, com o slug em minúsculas e hífens (ex.: `ia-seletor-de-quantidade`). Dentro dela:
   - `video.mp4`: 9:16, H.264 e AAC, até 90 s. O que sai do montador de anúncios (`video-treatment/anuncios/.../saida/`) já serve.
   - `legenda.txt`: a legenda do Reel, que também vira a descrição do Short.
   - `titulo-youtube.txt` (opcional): o título do Short, até 100 caracteres. Sem ele, vale a primeira linha da legenda. O `#shorts` entra sozinho.
   - `capa.jpg` (opcional): a capa do Reel.
2. Acrescente o item em `videos/fila.json`:

   ```json
   {
     "pendentes": [
       {
         "slug": "ia-seletor-de-quantidade",
         "quando": "2026-10-09T12:00:00-03:00",
         "destinos": ["instagram"]
       }
     ]
   }
   ```

   - `quando` é opcional: sem ele, sai na próxima hora cheia.
   - `destinos` também é opcional: sem ele, vai para `instagram` (@ecomplus.io) e `youtube`. O `vitorrgg` publica o Reel no seu Instagram pessoal e o `youtube-vitorrgg`, o Short no seu canal pessoal do YouTube; para os dois, um `legenda-vitorrgg.txt` na pasta troca a legenda (em primeira pessoa), e sem ele vale a `legenda.txt`.
   - Com `"aprovado": false`, o item fica parado.
3. Faça o commit e o push na `master`. O workflow `videos-publicar.yml` roda de hora em hora e publica um vídeo por vez.

Para testar sem publicar: Actions → *Vídeos — publicar Reels e Shorts* → *Run workflow*, com *dry run* marcado. Pelo terminal:

```bash
node scripts/videos/publicar.mjs --slug <slug> --dry-run
```

## Cortes da consultoria (ou qualquer pasta de vídeos)

Para trazer uma pasta inteira de uma vez, no WSL, dentro do clone deste repo:

```bash
cd ~/ecomplus-posts && git checkout master && git pull
node scripts/videos/importar.mjs ~/<pasta>/saida/cortes --prefixo consultoria \
  --ocultar <nome-do-cliente> --dia ter --hora 18:00 --inicio 2026-10-13
```

Cada `.mp4` vira `videos/consultoria-NN-<nome>/video.mp4` e entra na fila, um por semana no dia e
hora pedidos, sem colidir com outros vídeos dos mesmos destinos. Sem `--destinos`, vai para o
@vitorrgg e para o seu canal pessoal do YouTube (`vitorrgg,youtube-vitorrgg`). Se houver transcrição com o
mesmo nome (`.srt`, `.vtt` ou `.txt`), ela vem junto como `transcricao.*`, para a legenda ser
escrita a partir dela. O repo é público: o `--ocultar` tira do slug (e da URL) o nome de quem
pediu para não aparecer e trava o corte cuja transcrição cita esse nome. Sem `legenda.txt`, o item entra com `"aprovado": false` e só publica
depois que a legenda existir e esse campo sair. Vídeo acima de 95 MB é recusado (limite do
GitHub), com o comando do `ffmpeg` para reduzir.

## O que acontece com cada item

- **Deu certo em todos os destinos:** o item sai da fila e vai para `videos/historico.json`, com os links.
- **Deu certo só num destino:** o item fica na fila com o destino que já saiu marcado em `feito`, e a próxima rodada tenta só o que falta. O erro fica em `ultimoErro`.
- **Destino sem credencial:** fica pendente no item, sem travar a fila. Os próximos vídeos seguem saindo, e o destino que faltou sai quando a credencial chegar.

## Credenciais

O Instagram usa os segredos da rotina de carrosséis (`IG_USER_ID` e `IG_ACCESS_TOKEN`) e, no
@vitorrgg, `IG_VITORRGG_USER_ID` e `IG_VITORRGG_ACCESS_TOKEN`.

### YouTube

Upload público pela API funciona sem a auditoria do projeto: em 13/10/2026 um Short subiu público
no canal pessoal pelo cliente OAuth "automacao-anuncios" do projeto `ecomplus-site`. São dois
destinos, com o mesmo cliente OAuth e um refresh token por canal:

| Destino | Canal | Segredo do refresh token | Descrição do Short |
|---|---|---|---|
| `youtube-vitorrgg` | Vitor Rocha (@vitorrochagoncalves), pessoal | `YT_VITORRGG_REFRESH_TOKEN` | `legenda-vitorrgg.txt` (ou `legenda.txt`) |
| `youtube` | e-com plus (@e-comclub5705) | `YT_REFRESH_TOKEN` | `legenda.txt` |

Os dois usam também os segredos `YT_CLIENT_ID` e `YT_CLIENT_SECRET` (o cliente OAuth) e a variável
`YT_PRIVACIDADE` (`public`; sem ela, o vídeo sobe como `private`). Destino sem refresh token fica
pendente no item, sem travar a fila.

Os tokens são gerados no WSL, fora deste repo, com o `scripts/youtube_upload_test.py` de
`~/youtube-video` (`--canal pessoal --verificar` ou `--canal ecomclub --verificar`, escolhendo o
canal na tela do Google). Também há um token do canal da e-com.plus gerado em 08/10/2026 pelo
montador de anúncios, em `~/.config/google/token-youtube.json`. O app OAuth precisa estar **Em produção** no Google Cloud (Google Auth
Platform → Público-alvo): em modo de teste, o refresh token expira em 7 dias e o envio para.
