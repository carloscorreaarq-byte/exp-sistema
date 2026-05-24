# Pendencias abertas do modulo Analise

## Budget por etapa no ambiente publicado

Registrado em: `2026-05-24`

Contexto atual:

- a carga de `etapas` esta funcionando normalmente;
- o frontend passou a exibir diagnostico explicito de budget por etapa;
- os estados esperados na interface sao `Carregado`, `Zero`, `Vazio`, `Sem campo` e `Invalido`.

Quando revisitar esta pendencia, conferir:

- nome real do campo de budget no banco publicado;
- formato do valor salvo;
- se as etapas usadas no teste realmente tem budget preenchido.

Esta pendencia nao bloqueia a continuidade dos proximos sprints, mas deve ser revisitada antes do fechamento da `v1.0`.
