# Revisão da aba Resultado (Gestão › projeto › Resultado)

Decisões do Carlos em 10/11/2026.

## Decidido

1. **Margem até agora (destaque principal)**
   - Usa só as etapas **concluídas**.
   - Cálculo: (previsto das concluídas − horas e custos registrados nelas) ÷ previsto das concluídas.
   - Não usa a competência e não faz projeção. É só a leitura da realidade das etapas finalizadas.
   - Etapas em andamento e não iniciadas ficam fora.
   - Embaixo, uma linha: "considera N de M etapas (concluídas)".
2. **Nota de efetividade (0–100): sai.** No lugar entram 3 sinais por etapa:
   - Custo: dentro / perto do limite / estourado.
   - Prazo: no prazo / atrasado.
   - Competência: registrada / faltando.
   - Ao passar o mouse, aparece a regra de cada sinal.
3. **Painel do projeto** mantém Contratado, Previsto, Realizado e Saldo.
4. **Composição** ganha destaque:
   - horas e custo das horas;
   - custos diretos;
   - uma barra dividida entre horas e custos diretos;
   - aviso de custo sem etapa.
5. **Gráfico por etapa** vai para o topo, em largura total:
   - barra do previsto em cinza (base da proporção);
   - barra do realizado colorida pela margem da etapa: verde (#4D865C) acima de 15%, amarelo (#E2B141) de 5% a 15%, terracota (#BC6143) abaixo de 5%;
   - hover com o detalhe completo da etapa;
   - clique abre a etapa.
6. **Etapas em lista resumida:**
   - cada linha mostra nome, status, previsto, realizado, saldo, consumo e sinais;
   - ao clicar, expande em blocos organizados:
     - números (previsto, realizado, saldo, margem) e barra de consumo;
     - **horas por pessoa**, o principal custo: pessoa, horas, valor/hora, custo e peso;
     - custos diretos lançados (descrição, data, valor);
     - prazo e competência;
   - as não iniciadas ficam no fim, apagadas.
7. **Visual neutro:**
   - fundo off-white, cards brancos e texto grafite;
   - a cor só aparece como exceção: terracota para estouro e atraso, verde discreto na margem positiva;
   - acentos corrigidos.

## Ordem

1. Margem e visual neutro.
2. Lista de etapas expansível.
3. Gráfico com hover.
4. Sinais e composição.

Antes de mexer no código: prévia no chat para aprovação.
