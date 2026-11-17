# Plano de ação — Pesquisa 01 (Plataforma EXP)

Fontes: rodada anônima (7 respostas, 24/10/2026), rodada da Tamires (04/11/2026) e pedidos do Carlos em 13/11/2026.
Ordem: primeiro o que tem mais impacto, foi mais citado e é mais simples. Por último, o que é complexo ou traz pouco benefício.

## Já feito (antes deste plano)
- Conversa por item na revisão.
- Anotações (nota final) da revisão.
- Marca de re-revisar (só a marca, ainda sem pendência).
- Numeração dos itens da revisão.
- Linha "Novas mensagens" e bloco "Novas conversas" no topo.
- Notificação com a conversa aberta em outra aba.
- Menções com destaque.
- Buscar pessoa para iniciar conversa.
- Lido, digitando e responder mensagem.
- Feriados, ausências e saldo no relatório de horas.
- Novo Resultado do projeto e nova Análise.

## Fase 1 — Correções e ajustes rápidos (chat e revisões)
1. **Botão de responder no item da revisão para todos.** Hoje ele some para quem é coordenador do projeto ou da etapa (por isso a Tamires não vê). A regra nova é que todos os envolvidos veem o botão, inclusive coordenador e freelancer.
2. **Imagens da revisão que somem** e só voltam ao concluir a tarefa. É um erro: investigar o carregamento da imagem.
3. **Busca sem acento e com o termo grifado**, no chat lateral e no chat full page. Exemplo: "julia" encontra "Júlia".
4. **Menção sem acento.** "@Lais" mantém "Laís" como sugestão.
5. **Menções e avisos neutros:**
   - o @ aparece também no chat lateral;
   - o chat minimizado mostra que é uma menção, não um aviso simples;
   - fundo cinza conforme o tema, no lugar do rosa/vermelho.
6. **Grupos de projeto no chat:** rever como ficam minimizados, com cabeçalho mais visível e contador de não lidas no grupo fechado.
7. **Marcar conversa como não lida.**

## Fase 2 — Revisões
8. **Re-revisão como nova camada da revisão ("revisão 2.0"):**
   - Quem revisou e quem está dando os checks podem marcar um item para re-revisão.
   - O item marcado vira uma pendência nova, num bloco "Re-revisão" dentro da mesma revisão. Os dois veem.
   - Qualquer um dos dois dá o check para fechar a pendência.
   - A revisão só conclui quando todos os pontos estiverem fechados, inclusive as re-revisões.
   - Precisa de SQL: campos de re-revisão concluída, quem fechou e quando.
   - Feito em 16/11/2026 (gestao.html + supabase/revisao_rerevisao.sql).
9. **Marcação sobre a foto na revisão:** já existia no visualizador de imagens da revisão (seta, X, círculo, nota, lápis).
10. **Foto nas tarefas e nos itens de checklist.** Foi o pedido mais repetido da pesquisa.
11. **Categorias na revisão** (Projeto, Representação, Documentação) e "ajuste geral" para o item que vale para todas as pranchas.
12. **EXP Room levando para a reunião errada:** investigar quando há duas reuniões ao mesmo tempo.

## Fase 3 — Horas e cards de projeto
13. **Tons de azul por projeto na semana:**
    - São até 6 tons a partir do azul base (#5981CC).
    - O primeiro projeto que aparece na semana recebe o tom base, o segundo o próximo tom, e assim por diante.
    - A cor não fica presa ao projeto: serve só para diferenciar os projetos na visão da semana.
    - Vale nas horas, no calendário semanal e no relatório.
14. **Card do projeto:** coordenador, localização e CPF/CNPJ, mais "atualizada em" na etapa.
15. ~~Autocompletar nas horas~~ — substituído (17/11/2026): a descrição manual saiu do lançamento; projeto usa só atividades em tags e, fora de projeto, a subcategoria virou tags de um clique com dica ao passar o mouse e a mais usada pré-marcada.

## Fase 4 — Maior complexidade (depois)
16. Fluxo de projetos por pessoa, em blocos e calendário (substituir o Excel).
17. Tarefas com categorias e distribuição na semana, ligação com o fechamento da etapa.
18. Encaminhamentos com o cliente que ficam abertos até alguém dar ok.
19. EXP Room: mostrar a sala ocupada e iniciar chamada pelo chat.
20. Banco de preços de fornecedores.
21. Revisão de usabilidade do CRM (oportunidade e contato) e da Sociedade (tópicos e fluxo por pessoa).
22. Contatos e Apoio: força-tarefa de cadastro (é processo, não desenvolvimento).
