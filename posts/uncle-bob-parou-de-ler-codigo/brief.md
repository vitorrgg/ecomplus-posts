# Uncle Bob parou de ler código — post de opinião/análise

## Slide 1
```yaml
tipo: capa
titulo: |-
  o "clean code"
  parou de ler
  código
subtitulo: Robert C. Martin, o "Uncle Bob", diz que sua estratégia atual é não ler nenhuma linha escrita pelos seus agentes de IA.
imagem: code-screen-macbook.jpg
```

## Slide 2
```yaml
tipo: texto
paragrafos:
  - Uncle Bob passou décadas ensinando que cada linha de código importa, que craftsmanship é responsabilidade. Um desenvolvedor respondeu a ele dizendo que não se sentia confortável em deixar uma IA editar seus arquivos — "se sou responsável pelo código, eu preciso entendê-lo".
  - A resposta soou como heresia vinda de quem escreveu o livro que fundou a disciplina de escrever código legível.
```

## Slide 3
```yaml
tipo: texto
paragrafos:
  - Em vez de ler, ele cerca a IA de restrições extremas — testes unitários, testes Gherkin, procedimentos de QA, métricas de qualidade, teste de mutação, cobertura. Confia no resultado porque ele sobreviveu ao gauntlet.
  - "O detalhe que prova que isso não é preguiça é o teste de mutação: ele testa os próprios testes. É confiança em camadas, não confiança cega."
imagem: magnifying-glass-laptop.jpg
```

## Slide 4
```yaml
tipo: texto
paragrafos:
  - Ele não abandonou os próprios valores — mudou o objeto sobre o qual aplica o rigor. Antes, o código era o ativo, e os testes o protegiam.
  - Agora os testes e as especificações são o ativo, e o código é uma saída gerada, descartável. Ele parou de escrever a implementação pra escrever a jaula.
```

## Slide 5
```yaml
tipo: lista
tema: claro
titulo: O ponto do outro desenvolvedor não desaparece
itens:
  - Verificação prova a presença do que foi testado — não a ausência do que ninguém imaginou testar
  - Gauntlet de testes garante contra o que já foi pensado, não contra o inesperado
  - Quando algo quebra fora do previsto, alguém ainda precisa entender o sistema fundo o bastante pra consertar
```

## Slide 6
```yaml
tipo: texto
paragrafos:
  - Talvez o futuro não seja "ninguém lê código", mas uma realocação do trabalho humano de valor — de autor de linhas para arquiteto de restrições e auditor de comportamento.
  - '"Sênior" deixa de ser quem escreve mais rápido, e passa a ser quem sabe o que precisa ser garantido e como garantir.'
imagem: wireframe-sketch.jpg
```

## Slide 7
```yaml
tipo: fechamento
paragrafos:
  - O detalhe mais revelador é que os dois lados são veteranos — um começou a programar em 1983, o outro no fim dos anos 60. A resistência à IA não é questão de idade, é questão de onde cada um deposita a confiança.
  - E você — confia no código que não leu, desde que ele passe por todas as suas provas? Ou precisa entender cada linha pela qual assina embaixo?
imagem: ai-touch-circuit.jpg
```
