#!/usr/bin/env bash
# Rotina semanal rodando na sua máquina, com o Claude Code local (assinatura Max):
# coleta → análises via `claude -p` → render → JPEG → commit → push. A publicação
# no Instagram continua no GitHub Actions (ecb-publicar.yml), que lê a fila do repo.
#
# Rodar na mão:            bash scripts/ecb/semana-local.sh
# Agendar (WSL, toda segunda 09:00) pelo Agendador de Tarefas do Windows — ação:
#   wsl.exe -u vitorrgg -- bash -lc "~/ecomplus-posts/scripts/ecb/semana-local.sh"
# Pré-requisitos: `claude` logado (rode `claude` e /login uma vez), git com push
# configurado (ssh), node via nvm.
set -euo pipefail
cd "$(dirname "$0")/../.."
LOG="ecb/local.log"
exec > >(tee -a "$LOG") 2>&1
echo "== $(date '+%F %T') =="

# nvm não é carregado em shell não interativo
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
command -v claude >/dev/null || { echo "claude não está no PATH"; exit 1; }

git pull --rebase --quiet origin master
ANTES=$(node -e "console.log(require('./ecb/fila.json').pendentes.map(p=>p.slug).join(' '))")
node scripts/ecb/semana.mjs --limite "${1:-3}" --via claude-code
NOVOS=$(node -e "const a=new Set(process.argv[1].split(' '));console.log(require('./ecb/fila.json').pendentes.map(p=>p.slug).filter(s=>!a.has(s)).join(' '))" "$ANTES")

git add ecb posts output
if git diff --cached --quiet; then echo "nada novo pra comitar"; exit 0; fi
git commit --quiet -m "feat(ecb): posts da semana $(date +%F)"
git push --quiet origin master
echo "✓ enviado"

# Aviso no #conteúdo (precisa de SLACK_BOT_TOKEN e SLACK_CHANNEL_CONTEUDO no ambiente,
# ex. em ~/.config/ecb.env carregado abaixo). As imagens vêm do raw do GitHub, por
# isso o aviso vai depois do push.
[ -f "$HOME/.config/ecb.env" ] && set -a && . "$HOME/.config/ecb.env" && set +a
[ -n "$NOVOS" ] && node scripts/ecb/notificar-slack.mjs $NOVOS || true
