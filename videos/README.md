# Vídeos: Reels e Shorts automáticos

A fila de vídeos orgânicos. Cada vídeo sai como **Reel no Instagram** (@ecomplus.io) e **Short no YouTube** no horário marcado, e o aviso cai no #conteudo do Slack. É separada da rotina de carrosséis (`ecb/`).

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
         "destinos": ["instagram", "youtube"]
       }
     ]
   }
   ```

   - `quando` é opcional: sem ele, sai na próxima hora cheia.
   - `destinos` também é opcional: sem ele, vai para os dois.
   - Com `"aprovado": false`, o item fica parado.
3. Faça o commit e o push na `master`. O workflow `videos-publicar.yml` roda de hora em hora e publica um vídeo por vez.

Para testar sem publicar: Actions → *Vídeos — publicar Reels e Shorts* → *Run workflow*, com *dry run* marcado. Pelo terminal:

```bash
node scripts/videos/publicar.mjs --slug <slug> --dry-run
```

## O que acontece com cada item

- **Deu certo nos dois destinos:** o item sai da fila e vai para `videos/historico.json`, com os links.
- **Deu certo só num destino:** o item fica na fila com o destino que já saiu marcado em `feito`, e a próxima rodada tenta só o que falta. O erro fica em `ultimoErro`.
- **Destino sem credencial (o YouTube, até os segredos `YT_*` existirem):** fica pendente no item, sem travar a fila. Os próximos vídeos seguem saindo, e quando a credencial chegar, ele é publicado.

## YouTube: o que falta para ligar

O Instagram já funciona com os segredos da rotina de carrosséis (`IG_USER_ID` e `IG_ACCESS_TOKEN`). Para o YouTube faltam:

- **Segredos `YT_CLIENT_ID`, `YT_CLIENT_SECRET` e `YT_REFRESH_TOKEN`:** o OAuth de um projeto do Google Cloud com a YouTube Data API ativada, autorizado uma vez pela conta dona do canal, com o escopo `youtube.upload`.
- **A variável `YT_PRIVACIDADE`:** `public`, `unlisted` ou `private`, que é o padrão. Enquanto o projeto do Google não passar pela auditoria da API do YouTube, todo vídeo enviado pela API fica privado, e é preciso publicar no YouTube Studio. Depois da auditoria, ponha `public`.

Sem os segredos do YouTube, o item publica no Instagram e fica com o YouTube pendente na fila.
