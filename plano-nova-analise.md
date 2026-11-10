# Nova Análise (analise.html)

Decisões do Carlos em 10/11/2026.

## Objetivo

Acompanhar todos os projetos juntos. A análise precisa:
- achar as etapas em desenvolvimento que estão com problema;
- achar os projetos com problema;
- medir a eficiência geral do escritório (histórico completo, médias).

Pode ser simples, mas tem que ser útil.

## Regras

- Usa as mesmas contas do Resultado do projeto:
  - previsto = % custo da etapa × valor contratado;
  - realizado = horas × valor/hora vigente na data + custos diretos.
- Mesmas cores do card: verde acima de 15%, amarelo de 5% a 15%, terracota abaixo de 5%.
- Margem e médias consideram só o que foi finalizado (etapas concluídas). Não há projeção.
- Toda linha abre o projeto na Gestão.
- Visual neutro.
- Acesso só para sócios e sócios-administradores.

### Correções técnicas obrigatórias

- Paginar as consultas: o limite de 1.000 linhas corta horas e custos.
- Usar o valor/hora vigente na data de cada hora, não o atual.
- Deixar de usar "horas orçadas".
- Tirar os projetos virtuais do CRM, a projeção, o risco, a nota de efetividade e a configuração de margem.

## Visões

1. **Projetos ativos**
   - Mostra margem até agora, etapa atual com consumo, progresso e sinais.
   - Projeto com problema = margem até agora abaixo de 5%, OU etapa atual acima de 100% do previsto, OU atraso. Critério aprovado.
2. **Etapas ativas**
   - Mostra todas as etapas em andamento ou em revisão, com o % do previsto consumido: amarelo a partir de 85%, terracota acima de 100%.
   - Mostra também dias desde a liberação, atraso e quem mais lançou horas.
3. **Histórico do escritório**
   - Considera só etapas concluídas, com margem média ponderada.
   - Agrupa por tipo de etapa, núcleo, ano de conclusão e **cliente**.
   - Tem **filtro por cliente**.
   - Lista os projetos encerrados.
4. **Cadastro pendente**
   - Mostra os projetos sem informação suficiente para a análise, com o motivo e um botão para corrigir.
5. **Por pessoa**
   - Visível **só para o gestor da plataforma**.

## Tipos de etapa (padronizar)

Os nomes das etapas variam entre projetos. É preciso padronizar para comparar as etapas no histórico.

Proposta:
- uma lista de tipos padrão;
- um campo `tipo_etapa` em `etapas`;
- sugestão automática do tipo pelo nome;
- uma tela para conferir e corrigir as sugestões.

Está pendente: levantar os nomes que existem hoje.
