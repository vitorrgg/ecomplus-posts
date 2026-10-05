# Série do livro

Vale tudo o que está em `ecb/PROMPT.md` (voz, forma, palavras proibidas, limites de caracteres, capa sem repetir, nada de preço da e-com.plus, emojis), com as diferenças abaixo.

A pauta da semana é um trecho do livro "Como escalar seu e-commerce", que o Vitor, da e-com.plus, está escrevendo. O trecho está no campo `texto` de `ecb/livro/rascunho/<segunda>.json`, gerado por `scripts/ecb/livro.mjs`.

- **O post é uma versão do trecho para o carrossel, e não uma análise sobre ele.** Aqui reaproveitar a tese, os exemplos e as frases do livro é o objetivo, porque o livro é nosso. Mantenha a tese e o raciocínio do trecho, corte o que não cabe e não acrescente opinião que o trecho não tem.
- **Números** só entram se estiverem em `dadosVerificados` (a ficha de dados verificados do livro), com o nome de quem fez o estudo. O manuscrito ainda está em revisão e tem dados antigos, então um número que está no trecho mas não está na ficha fica de fora.
- **Exemplos:** os exemplos do próprio trecho valem (o tênis com 30% de desconto, a coleira para pets). Só quando for inventar um exemplo novo, use a loja de alimentação saudável sem nome.
- **Capa:** o chapéu (`eyebrow`) começa com "do livro · " seguido do tema em uma ou duas palavras, como "do livro · busca interna". O `gerar-briefs.mjs` recusa a capa sem esse chapéu. O título é a tese do trecho.
- **Mais técnico:** pode usar até 7 slides. Prefira listas de passos e critérios concretos a parágrafos de contexto. O fechamento traz um teste que o lojista pode fazer na própria loja nesta semana.
- **Slide da e-com.plus:** entra só se o tema cruzar naturalmente com um recurso da lista. Se não cruzar, use o espaço para mais um passo prático, e a legenda troca a frase sobre a e-com.plus por uma frase com a ideia central do trecho.
- **Legenda:** não cite o livro. A chamada do livro (`ecb/livro/config.json`) é colocada automaticamente antes das hashtags.
- **Saída:** `ecb/saidas/<segunda>/livro.json`, com o campo extra `"fonte"` igual ao `url` do rascunho (`livro:<id da pauta>`).
