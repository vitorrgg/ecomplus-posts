# Vídeos: Reels e Shorts automáticos

A fila de vídeos orgânicos. Cada vídeo sai como **Reel no Instagram** (@ecomplus.io) e **Short no YouTube** no horário marcado, e o aviso cai no #conteudo do Slack. O YouTube só entra depois da auditoria da API ([veja abaixo](#youtube-depois-da-auditoria-da-api)). É separada da rotina de carrosséis (`ecb/`).

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
   - `destinos` também é opcional: sem ele, vai para `instagram` (@ecomplus.io) e `youtube`. O `vitorrgg` publica o Reel no seu Instagram pessoal; para ele, um `legenda-vitorrgg.txt` na pasta troca a legenda (em primeira pessoa), e sem ele vale a `legenda.txt`. Até a auditoria do YouTube, use `["instagram"]`.
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
node scripts/videos/importar.mjs ~/video-chapfer/saida/cortes --prefixo chapfer \
  --destinos vitorrgg --dia ter --hora 18:00 --inicio 2026-10-13
```

Cada `.mp4` vira `videos/chapfer-NN-<nome>/video.mp4` e entra na fila, um por semana no dia e
hora pedidos, sem colidir com outros vídeos dos mesmos destinos. Se houver transcrição com o
mesmo nome (`.srt`, `.vtt` ou `.txt`), ela vem junto como `transcricao.*`, para a legenda ser
escrita a partir dela. Sem `legenda.txt`, o item entra com `"aprovado": false` e só publica
depois que a legenda existir e esse campo sair. Vídeo acima de 95 MB é recusado (limite do
GitHub), com o comando do `ffmpeg` para reduzir.

## O que acontece com cada item

- **Deu certo nos dois destinos:** o item sai da fila e vai para `videos/historico.json`, com os links.
- **Deu certo só num destino:** o item fica na fila com o destino que já saiu marcado em `feito`, e a próxima rodada tenta só o que falta. O erro fica em `ultimoErro`.
- **Destino sem credencial:** fica pendente no item, sem travar a fila. Os próximos vídeos seguem saindo, e o destino que faltou sai quando a credencial chegar.

## YouTube: depois da auditoria da API

O Instagram já funciona com os segredos da rotina de carrosséis (`IG_USER_ID` e `IG_ACCESS_TOKEN`).

O YouTube fica desligado até o projeto `ecomplus-site` do Google Cloud passar pela auditoria da YouTube API. Vídeo enviado pela API de um projeto sem a auditoria fica **travado como privado**: não dá para publicar depois no YouTube Studio, só subindo de novo ([ajuda do YouTube](https://support.google.com/youtube/answer/7300965)). Até lá:

- Os itens da fila vão com `"destinos": ["instagram"]`.
- Para ter o Short, suba à mão pelo Studio ou pelo app, com o `video.mp4`, o `titulo-youtube.txt` (mais `#shorts`) e a `legenda.txt` da pasta do vídeo.

O token do canal "e-com plus" (@e-comclub5705) já foi gerado em 08/10/2026 e fica fora do repositório (`~/.config/google/token-youtube.json`, do `autorizar_google.py youtube` do montador de anúncios). Quando a auditoria for aprovada:

1. Cadastre os segredos `YT_CLIENT_ID`, `YT_CLIENT_SECRET` e `YT_REFRESH_TOKEN`: o cliente OAuth do projeto `ecomplus-site` e o refresh token, com o escopo `youtube.upload`.
2. Crie a variável `YT_PRIVACIDADE` com `public`. Sem ela, o vídeo sobe como `private`.
3. Volte a pôr `"youtube"` nos `destinos`, ou omita o campo, que vale para os dois.
