# Especificação Técnica — Módulo "Análise de Eficiência"
**Plataforma EXP · analise.html · v1.1**
*Atualizado: 2026-05-24*

---

## Sumário

1. Visão Geral e Controle de Acesso
2. Dependências e Pré-requisitos
3. Migração de Banco
4. Estrutura de Estado (JS)
5. Arquitetura de Dados
6. Funções a Criar
7. Estrutura HTML
8. Diretrizes de UI e Sistema de Design
9. CSS Necessário
10. Gráficos e Visualizações
11. Light Mode e Dark Mode
12. Fluxo de Interação
13. Integração com Código Existente
14. Ordem de Implementação
15. Riscos e Pontos de Atenção
16. Recomendações de Evolução Estratégica
17. Roadmap de Implementação
18. Estrutura Técnica do Novo Módulo
19. Checklist Técnico de Implementação
20. Plano de Execução por Sprint

---

## 1. Visão Geral e Controle de Acesso

### Propósito

O módulo Análise de Eficiência centraliza a leitura econômica do escritório: transforma dados brutos de horas lançadas, custos registrados e valores contratados em indicadores acionáveis de margem, eficiência de orçamento por etapa e saúde financeira dos projetos. Serve como camada analítica estratégica sobre a operação já registrada nos módulos de Horas, Custos e Gestão de Projetos.

### Módulo Societário

Este é um **módulo de acesso exclusivo a sócios**. Não é visível nem acessível a colaboradores ou coordenadores. Segue o mesmo nível de restrição dos módulos financeiros existentes (Resultado, Valor/Hora, Gestão de Sócios).

### Matriz de Acesso

| Role | Acesso | Visualização | Edição de budget_horas | Configurar margem |
|---|---|---|---|---|
| `socio_admin` | ✅ Total | Todos os dados financeiros | ✅ Sim | ✅ Sim |
| `socio` | ✅ Total | Todos os dados financeiros | ✅ Sim | ❌ Apenas leitura da config |
| `coordenador` | ❌ Sem acesso | — | — | — |
| `colaborador` | ❌ Sem acesso | — | — | — |

**Regra de edição de configuração:** apenas `socio_admin` pode alterar o threshold de margem. O botão "Configurar" é renderizado somente para esse role. Sócios não-administrativos veem os indicadores com o threshold vigente, mas não podem alterá-lo.

**Regra de budget_horas:** qualquer sócio (`socio` ou `socio_admin`) pode editar o campo de horas planejadas por etapa diretamente na tabela.

**Compatibilidade de legado:** o frontend deve tratar `socio_adm` como alias transitório de `socio_admin`, porque ambos aparecem no código atual. O padrão canônico daqui para frente deve ser `socio_admin`.

### Visibilidade na navegação

O acesso a `analise.html` deve aparecer na navegação principal apenas para sócios. Colaboradores e coordenadores não devem receber link, card, botão ou item de menu para o módulo.

Além de esconder a entrada de navegação, o próprio `analise.html` deve validar a role no bootstrap e interromper a renderização em caso de acesso indevido.

```javascript
// No bootstrap de analise.html — bloquear acesso se não for sócio
if (!isSocioRole(G.usuario.role)) {
  window.location.href = 'index.html';
  return;
}
```

---

## 2. Dependências e Pré-requisitos

### Banco de dados

- Campo `etapas.budget_horas` deve existir antes da primeira carga (ver seção 3).
- `historico_valor_hora` deve ter registros para todos os usuários com horas lançadas — caso contrário o custo será zero para esses usuários (ver seção 15, riscos).
- `horas_lancadas` deve ter `hora_inicio` e `hora_fim` preenchidos.

### Estado global

- `analise.html` deve popular `G.todosProdutos`, `G.todasEtapas`, `G.todosUsuarios` e `G.usuario` no próprio bootstrap da página ou via loader compartilhado.
- `G.usuario` deve estar disponível com `role` preenchido antes de `analiseInit()`.
- O módulo não deve depender do ciclo de vida, DOM ou estado inicial de `gestao.html`.

### Funções utilitárias existentes reutilizadas sem modificação

As funções abaixo podem ser reutilizadas **somente se estiverem extraídas para script compartilhado carregado por `analise.html`**. O novo arquivo não deve importar comportamento acoplado ao DOM ou ao ciclo de vida de `gestao.html`.

| Função | Uso no módulo |
|---|---|
| `diffHoras(ini, fim)` | Calcular duração de lançamentos de hora |
| `fmtNum(n)` | Formatar valores monetários |
| `fmtH(h)` | Formatar horas decimais como "Xh Ym" |
| `fmtDate(d)` | Formatar datas ISO como DD/MM/AAAA |
| `toast(msg)` | Notificações de feedback |
| `abrirProduto(id)` | Abrir modal de projeto ao clicar na tabela |
| `isSocioRole(role)` | Verificar role |
| `fecharModal(id)` | Fechar modais existentes |
| `STATUS_ETAPA` | Cores e labels de status de etapas |
| `NUCLEO_COR` | Cores por nucleo (urbanismo, paisagismo, etc.) |
| `_escN(str)` | Escapar HTML em strings |
| `_sqN(val)` | Sanitizar valores para uso em onclick strings |

---

## 3. Migração de Banco

### SQL necessário

```sql
-- Adiciona campo budget_horas na tabela etapas
ALTER TABLE etapas
  ADD COLUMN IF NOT EXISTS budget_horas numeric;

COMMENT ON COLUMN etapas.budget_horas IS
  'Horas planejadas para execução da etapa. Editável por sócios no módulo de Análise de Eficiência.';
```

### Verificação de RLS

Se a tabela `etapas` tiver RLS ativa, verificar que a política de UPDATE já cobre os roles de sócio. A política deve permitir UPDATE apenas para `socio` e `socio_admin`. Coordenadores não devem atualizar `budget_horas` neste módulo.

**Nenhuma outra alteração de schema é necessária para a v1.0.** A configuração de threshold de margem é mantida em `localStorage`.

---

## 4. Estrutura de Estado (JS)

### Objeto ANALISE

Declarado no escopo global, adjacente ao objeto `G {}`, seguindo o mesmo padrão da plataforma:

```javascript
const ANALISE = {
  // Arrays brutos do banco
  _produtos: [],
  _etapas: [],
  _horas: [],
  _custos: [],
  _vhPorUser: {},           // { userId → valor_hora }

  // Dados agregados em memória (calculados após carga)
  _dadosPorProduto: {},
  // Estrutura de cada entrada:
  // {
  //   produto: { ...objeto produto },
  //   horasTotais: number,
  //   custoHH: number,         (horas × valor/hora)
  //   custosLancados: number,  (lancamentos_custo)
  //   custoTotal: number,
  //   margem: number | null,   (null se sem valor_contratado)
  //   margemPct: number | null,
  //   etapasDados: [],         (array com dados por etapa do produto)
  //   etapasProgresso: {},     (contagem por status)
  // }

  _dadosPorEtapa: {},
  // Estrutura de cada entrada:
  // {
  //   etapa: { ...objeto etapa },
  //   horasTotais: number,
  //   custoHH: number,
  //   custosLancados: number,
  //   custoTotal: number,
  //   utilizacaoBudget: number | null, (% horas / budget_horas)
  // }

  // Estado de UI
  _abaAtiva: 'acumulado',   // 'acumulado' | 'desenvolvimento' | 'encerrados' | 'pessoas'
  _produtoIsoladoId: null,  // ID aberto na análise isolada (aba Encerrados)
  _carregando: false,
  _ultimaCarga: null,       // timestamp — evita re-fetch < 5 min

  // Filtros em memória (não persistem entre sessões)
  _filtros: {
    acumulado:      { nucleo: '', status: '', ordem: 'nome' },
    desenvolvimento: { nucleo: '', statusEtapa: '', agrupamento: 'projeto' },
    encerrados:     { nucleo: '', ano: '', ordem: 'conclusao_desc' },
  },
};
```

### Helpers de Configuração (localStorage)

**Chave:** `analise_config`

**Estrutura padrão:**
```json
{
  "margem_threshold": 20,
  "margem_atencao": 5
}
```

- `margem_threshold`: abaixo deste % → estado "Em risco" (vermelho)
- `margem_threshold + margem_atencao`: acima disto → "Saudável" (verde); entre os dois → "Atenção" (amarelo)

**Funções:**

- `analiseGetConfig()` — lê localStorage, parse JSON com try/catch, retorna merge com defaults se campos ausentes. Nunca lança exceção.
- `analiseSetConfig(obj)` — valida que ambos os campos são números positivos, serializa, persiste. Chama `analiseRenderConfig()` para atualizar UI.
- Somente `socio_admin` chama `analiseSetConfig()`. A verificação de role é feita antes de renderizar o botão de configuração.

---

## 5. Arquitetura de Dados

### Estratégia geral

Carga única e completa na primeira abertura. As quatro abas consomem o mesmo dataset em memória — sem re-fetch por troca de aba. Cache de 5 minutos via `_ultimaCarga`. Botão "Atualizar dados" zera o cache e força nova carga.

### Queries Supabase (executadas em `Promise.all`)

| # | Tabela | Campos | Filtro / Ordenação |
|---|---|---|---|
| 1 | `etapas` | todos + `budget_horas` | — |
| 2 | `horas_lancadas` | `produto_id, etapa_id, usuario_id, hora_inicio, hora_fim` | — |
| 3 | `lancamentos_custo` | `produto_id, etapa_id, valor` | — |
| 4 | `historico_valor_hora` | `usuario_id, valor_hora, data_vigencia` | `lte hoje`, `desc` |

**Produtos:** lidos de `G.todosProdutos` (já em memória). Filtro em memória: excluir virtuais de CRM (produtos sem etapas reais ou com flag de CRM).

Como este é um módulo exclusivamente societário, a query 4 (`historico_valor_hora`) é sempre executada — não há restrição por role dentro do módulo.

### Agregação — `analiseAgregarDados()`

**Por produto:**
- `horasTotais`: soma `diffHoras(hora_inicio, hora_fim)` de todos os lançamentos do produto.
- `custoHH`: soma `horas × vhPorUser[usuario_id]` por lançamento (zero se usuário sem valor cadastrado).
- `custosLancados`: soma `|valor|` de `lancamentos_custo` do produto.
- `custoTotal`: `custoHH + custosLancados`.
- `margem`: `valor_contratado - custoTotal` (null se `valor_contratado` ausente).
- `margemPct`: `(margem / valor_contratado) * 100` (null nas mesmas condições).
- `etapasProgresso`: objeto com contagem de etapas por status (`{ nao_iniciada: n, em_andamento: n, ... }`).

**Por etapa:**
- Mesmos campos de custo, escopo restrito ao `etapa_id`.
- `utilizacaoBudget`: `(horasTotais / budget_horas) * 100` — null se `budget_horas` é null ou zero.
- `previsto`: `(percentual_custo / 100) * valor_contratado_do_produto` — null se qualquer campo ausente.

---

## 6. Funções a Criar

### Ciclo de vida

| Função | Propósito | Parâmetros | Retorno |
|---|---|---|---|
| `analiseInit()` | Ponto de entrada. Verifica cache (< 5 min → apenas re-renderiza). Caso contrário, chama `analiseCarregarDados()`. | — | `Promise<void>` |
| `analiseCarregarDados()` | Dispara queries em `Promise.all`, armazena arrays, chama `analiseAgregarDados()` e `analiseRenderAbaAtiva()`. Define `_carregando`. | — | `Promise<void>` |
| `analiseAgregarDados()` | Percorre arrays brutos e popula `_dadosPorProduto` e `_dadosPorEtapa`. | — | `void` |

### Navegação e configuração

| Função | Parâmetros | Propósito |
|---|---|---|
| `analiseSwitchTab(aba)` | `string` | Atualiza classes `.analise-tab.active` e `.analise-panel.active`. Chama render da aba. |
| `analiseRenderAbaAtiva()` | — | Despacha para o render da `_abaAtiva` atual. |
| `analiseGetConfig()` | — | Lê localStorage + merge defaults. Retorna objeto. |
| `analiseSetConfig(obj)` | `object` | Valida, persiste, chama `analiseRenderConfig()`. Apenas `socio_admin`. |
| `analiseAbrirConfig()` | — | Exibe painel de configuração preenchido com valores atuais. |
| `analiseSalvarConfig()` | — | Lê inputs, valida, chama `analiseSetConfig()`, re-renderiza aba ativa. |
| `analiseRenderConfig()` | — | Atualiza textos de faixas de margem na UI após alteração de threshold. |

### Classificação de margem

**`analiseClassificarMargem(margemPct)`**
- Parâmetros: `number | null`
- Retorno: `{ cls: string, icon: string, label: string }`
  - `pct < threshold` → `{ cls: 'margem-risco', icon: '●', label: 'Em risco' }`
  - `threshold ≤ pct < threshold + atencao` → `{ cls: 'margem-atencao', icon: '●', label: 'Atenção' }`
  - `pct ≥ threshold + atencao` → `{ cls: 'margem-saudavel', icon: '●', label: 'Saudável' }`
  - `null` → `{ cls: 'margem-nd', icon: '—', label: '—' }`

### Aba 1 — Acumulado

| Função | Propósito | Retorno |
|---|---|---|
| `analiseRenderAcumulado()` | Orquestra os blocos da aba: KPIs, cards de núcleo, gráficos, tabela. | `void` |
| `analiseKpisAcumulado(produtos)` | Renderiza KPIs totais: faturamento, custo total, margem média ponderada, nº projetos. | `void` (renderiza no DOM) |
| `analiseCardsNucleo(produtos)` | Renderiza 4 cards (um por nucleo) com faturamento, margem, ticket médio, nº projetos. | `string HTML` |
| `analiseGraficoMargemNucleo(produtos)` | Gera gráfico de barras horizontal de margem % por nucleo. Ver seção 10. | `string HTML` |
| `analiseGraficoDistribuicaoHoras(produtos)` | Gera gráfico de pizza/donut de distribuição de horas por nucleo. Ver seção 10. | `string HTML` |
| `analiseTabelaAcumulado(produtos)` | Tabela de projetos com colunas financeiras. Cada linha abre `abrirProduto(id)`. | `string HTML` |
| `analiseFiltrarAcumulado()` | Lê selects, atualiza `_filtros.acumulado`, re-renderiza. | `void` |
| `analiseOrdenarProdutos(arr, campo)` | Ordena por `nome`, `nucleo`, `margem_desc/asc`, `contratado_desc`. | `Array` (novo) |

### Aba 2 — Em Desenvolvimento

| Função | Propósito | Retorno |
|---|---|---|
| `analiseRenderDesenvolvimento()` | Orquestra KPIs + gráficos + tabela de etapas + seção de risco. | `void` |
| `analiseKpisDesenvolvimento()` | KPIs: projetos ativos, etapas em curso, horas abertas, projetos em alerta. | `void` |
| `analiseGraficoEtapasStatus()` | Gráfico de barras empilhadas: distribuição de etapas por status. Ver seção 10. | `string HTML` |
| `analiseGraficoBudgetUtilizacao()` | Gráfico de barras horizontais: utilização de budget por etapa (top 10 mais usadas). Ver seção 10. | `string HTML` |
| `analiseTabelaEtapasEmCurso(filtros)` | Tabela de etapas `em_andamento`/`em_revisao` com budget editável inline. | `string HTML` |
| `analiseEditarBudget(etapaId, valor)` | UPDATE Supabase + atualiza memória + atualiza DOM cirurgicamente. | `Promise<void>` |
| `analiseSecaoRisco()` | Cards de projetos com margem abaixo do threshold. | `string HTML` |
| `analiseFiltrarDesenvolvimento()` | Lê filtros, atualiza estado, re-renderiza. | `void` |

### Aba 3 — Encerrados

| Função | Propósito | Retorno |
|---|---|---|
| `analiseRenderEncerrados()` | Se `_produtoIsoladoId` → isolada. Senão → lista. | `void` |
| `analiseListaEncerrados(filtros)` | Tabela de projetos `concluido` com filtros. | `string HTML` |
| `analiseGraficoMargemHistorico(produtos)` | Gráfico de barras de margem % dos projetos encerrados, em ordem cronológica. Ver seção 10. | `string HTML` |
| `analiseAbrirIsolado(produtoId)` | Define `_produtoIsoladoId`, oculta filtros, renderiza análise isolada. | `void` |
| `analiseFecharIsolado()` | Zera `_produtoIsoladoId`, exibe filtros, volta para lista. | `void` |
| `analiseRenderAnaliseIsolada(produtoId)` | KPIs finais + gráfico de uso por etapa + tabela previsto×real + timeline. | `string HTML` |
| `analiseGraficoEtapasPrevReal(etapas)` | Gráfico de barras agrupadas: previsto vs. realizado por etapa. Ver seção 10. | `string HTML` |
| `analiseTimelinePlanejadoReal(etapas)` | Timeline visual horizontal comparativa planejado×real. | `string HTML` |
| `analiseFiltrarEncerrados()` | Reseta `_produtoIsoladoId`, lê filtros, re-renderiza lista. | `void` |

### Aba 4 — Por Pessoa (placeholder)

| Função | Propósito |
|---|---|
| `analiseRenderPessoas()` | Apenas estado visual "em desenvolvimento" com estrutura reservada. |

### Utilitários internos

| Função | Propósito | Retorno |
|---|---|---|
| `analiseBarraSegmentada(etapas)` | Barra segmentada por status usando `STATUS_ETAPA`. | `string HTML` |
| `analiseAvatarResponsavel(userId)` | Avatar + nome a partir de `G.todosUsuarios`. | `string HTML` |
| `analiseBadgeNucleo(nucleo)` | Badge colorido usando `NUCLEO_COR`. | `string HTML` |
| `analiseFormatarPrazo(dataIso)` | Data colorida por urgência. Vermelho se vencida, amarelo ≤7 dias, cinza se futura. | `string HTML` |
| `analiseBarSimples(pct, cor)` | Barra de progresso simples reutilizável. | `string HTML` |
| `analiseSvgBar(dados, opts)` | Gera SVG de barra horizontal/vertical. Ver seção 10. | `string SVG` |
| `analiseSvgDonut(dados, opts)` | Gera SVG de donut chart. Ver seção 10. | `string SVG` |

---

## 7. Estrutura HTML

```
body[data-page="analise"]
  └── main.page#page-analise
  ├── div.analise-header
  │     ├── div.analise-title-row
  │     │     ├── div
  │     │     │     ├── span.sec-badge  → "Societário"
  │     │     │     └── h2.sec-title   → "Análise de Eficiência"
  │     │     └── div.analise-header-actions
  │     │           ├── button.btn.sm#analise-btn-reload     → "↺ Atualizar"
  │     │           └── button.btn.sm#analise-btn-config     → "⚙ Configurar"
  │     │               (visível apenas para socio_admin)
  │     └── div.analise-config-panel#analise-config-panel (hidden)
  │           ├── div.analise-config-grid
  │           │     ├── div.fgroup → label + input#analise-threshold  (tipo number, min 0, max 100)
  │           │     └── div.fgroup → label + input#analise-atencao    (tipo number, min 0, max 20)
  │           ├── div.analise-config-preview    → faixas de cor dinâmicas
  │           └── div.analise-config-actions
  │                 ├── button.btn.sm#analise-btn-salvar-config → "Salvar"
  │                 └── button.btn.sm#analise-btn-fechar-config → "Cancelar"
  │
  ├── div.analise-tabs-bar
  │     ├── button.analise-tab.active[data-aba="acumulado"]      → "Acumulado"
  │     ├── button.analise-tab[data-aba="desenvolvimento"]        → "Em Desenvolvimento"
  │     ├── button.analise-tab[data-aba="encerrados"]             → "Encerrados"
  │     └── button.analise-tab[data-aba="pessoas"]                → "Por Pessoa"
  │
  └── div.analise-panels
        ├── div.analise-panel.active#anp-acumulado
        │     ├── div.analise-filtros-bar
        │     │     ├── select.filter-select#af-acum-nucleo
        │     │     ├── select.filter-select#af-acum-status
        │     │     └── select.filter-select#af-acum-ordem
        │     ├── div.analise-kpis-row#acum-kpis-row
        │     ├── div.analise-nucleos-row#acum-nucleos-row
        │     ├── div.analise-charts-row#acum-charts-row
        │     │     ├── div.analise-chart-card  → gráfico barras: margem por nucleo
        │     │     └── div.analise-chart-card  → gráfico donut: distribuição horas
        │     └── div#acum-tabela
        │
        ├── div.analise-panel#anp-desenvolvimento
        │     ├── div.analise-filtros-bar
        │     │     ├── select.filter-select#af-dev-nucleo
        │     │     ├── select.filter-select#af-dev-status-etapa
        │     │     └── select.filter-select#af-dev-agrupamento
        │     ├── div.analise-kpis-row#dev-kpis-row
        │     ├── div.analise-charts-row#dev-charts-row
        │     │     ├── div.analise-chart-card  → barras empilhadas: etapas por status
        │     │     └── div.analise-chart-card  → barras horiz.: budget vs. horas reais
        │     ├── div#dev-tabela-etapas
        │     ├── h4.analise-sec-title → "Projetos em Risco"
        │     └── div#dev-secao-risco
        │
        ├── div.analise-panel#anp-encerrados
        │     ├── div.analise-filtros-bar#enc-filtros-bar
        │     │     ├── select.filter-select#af-enc-nucleo
        │     │     ├── select.filter-select#af-enc-ano
        │     │     └── select.filter-select#af-enc-ordem
        │     ├── div.analise-chart-card#enc-chart-historico
        │     │     → gráfico barras: margem histórica dos encerrados
        │     └── div#enc-lista
        │           (Quando análise isolada ativa:)
        │           ├── div.analise-isolada-header
        │           │     ├── button.btn.sm#enc-btn-voltar → "← Voltar"
        │           │     └── h3.analise-isolada-titulo
        │           ├── div.analise-isolada-kpis
        │           ├── div.analise-chart-card  → barras agrupadas previsto×real por etapa
        │           ├── div.analise-isolada-tabela
        │           └── div.analise-isolada-timeline
        │
        └── div.analise-panel#anp-pessoas
              └── div.analise-wip-state

```

### Input de budget inline

Dentro de cada linha `<tr>` da tabela Em Desenvolvimento:

```html
<td class="analise-budget-cell">
  <input class="analise-budget-input"
    type="number" min="0" step="0.5"
    data-etapa-id="{etapa.id}"
    value="{budget_horas || ''}"
    placeholder="—"
    onblur="analiseEditarBudget('{etapa.id}', this.value)">
  <div class="analise-budget-bar">
    <div class="analise-budget-fill" style="width:{pct}%"></div>
  </div>
</td>
```

---

## 8. Diretrizes de UI e Sistema de Design

### Princípio geral

O módulo deve parecer nativo dentro da plataforma EXP — não um painel externo colado. Todo visual deve derivar das variáveis CSS e componentes já existentes. Zero valores hardcoded de cor, tamanho ou espaçamento que não façam parte do design system.

### Variáveis CSS a usar

```css
/* Cores base */
var(--grafite)      /* texto principal, bordas ativas, ícones */
var(--cinza)        /* bordas padrão, separadores */
var(--cinza2)       /* fundos de linhas alternadas, trilhas de barra */
var(--branco)       /* fundo de cards, modais, inputs */
var(--off)          /* fundo de painéis secundários, áreas inativas */

/* Cores semânticas */
var(--verde)        /* saudável, concluído, positivo */
var(--azul)         /* em andamento, destaque neutro */
var(--ouro)         /* atenção, em revisão */
var(--terracota)    /* risco, negativo, atrasado */

/* Tipografia */
var(--font-ui)      /* toda a interface, labels, botões */
var(--font-mono)    /* números, valores monetários, datas, métricas */

/* Espaçamento e forma */
var(--radius-card)  /* border-radius de cards */
var(--gap-sm)       /* gap pequeno entre elementos */
var(--gap-md)       /* gap médio entre blocos */
```

### Componentes reutilizados sem modificação

| Componente | Classe existente | Uso no módulo |
|---|---|---|
| Botões | `.btn`, `.btn.sm`, `.btn.filled`, `.btn.tc` | Ações, configuração, voltar |
| Badges de status | `.badge`, `.b-vd`, `.b-az`, `.b-am`, `.b-tc` | Status de etapas, indicadores |
| Seção de conteúdo | `.ms`, `.ms-title` | Grupos de conteúdo internos |
| Grid de duas colunas | `.fg` | Layout de cards lado a lado |
| Linha de dado | `.dr`, `.dk`, `.dv` | Detalhes da análise isolada |
| Tabela de listagem | `.tbl`, `.tbl th`, `.tbl td` | Tabelas de projetos e etapas |
| Estado vazio | `.empty-note` | Ausência de dados |
| Estado de loading | `.loading-state` | Durante carga |
| Form group | `.fgroup` | Campos do painel de configuração |
| Botão de filtro chip | `.cal-chip` | Filtros rápidos nas barras |

### Tipografia

- **Títulos de seção:** 8px, 700, uppercase, letter-spacing 0.6px — `var(--font-ui)` — padrão `.ms-title`
- **Títulos de card/KPI:** 8px, 700, uppercase, cor `#aaa` — padrão do design system
- **Valores KPI:** 16px, 700, `var(--font-mono)`, letter-spacing -0.5px
- **Texto de tabela:** 11px, `var(--font-ui)` — padrão `.tbl td`
- **Labels de tabela:** 8px, 700, uppercase — padrão `.tbl th`
- **Valores monetários e horas:** sempre `var(--font-mono)`, peso 600–700
- **Notas e subvalores:** 9px, `#aaa`

### KPI Cards

Seguir exatamente o padrão já usado nos módulos de resultado e horas:

```
┌──────────────────────────────┐
│  LABEL (8px upper #aaa)      │
│  Valor  (16px mono bold)     │
│  Sub    (9px #aaa)           │
└──────────────────────────────┘

background: var(--off)
border: 1px solid var(--cinza)
border-radius: var(--radius-card)
padding: 8px 14px
```

### Cards de nucleo

Derivar do padrão de `.card` existente, com acréscimo de barra vertical esquerda de 3px na cor do nucleo (usar `border-left: 3px solid {cor-do-nucleo}`). Não criar novo sistema de cards.

### Tabelas

Usar a classe `.tbl` existente. Não criar tabelas com CSS próprio. Adicionar apenas:
- Coluna de margem com bolinha colorida inline
- Linha `hover` com `background: var(--cinza2)` — já existe no design system
- Cursor `pointer` nas linhas clicáveis

### Barra de filtros

Reutilizar exatamente o padrão da `.cal-filters` já existente para a barra inline de filtros: chips `.cal-chip` com `active` state, separadores `.cal-filter-sep`, layout flex wrap.

### Painel de configuração

Padrão de `modal-body` inline (não modal flutuante): `background: var(--off)`, `border: 1px solid var(--cinza)`, `border-radius: var(--radius-card)`, `padding: 14px 16px`, colapsável via toggle de classe.

### Espaçamento entre blocos

Manter o mesmo ritmo vertical dos outros módulos:
- Entre KPIs e próximo bloco: `margin-bottom: 14px`
- Entre seções: `margin-bottom: 16px`
- Entre abas e conteúdo: `margin-top: 14px`
- Gap interno de cards: `10px`

### Estados especiais

- **Carregando:** usar `.loading-state` com o texto "Calculando..." — padrão já existente
- **Sem dados:** usar `.empty-note` — padrão já existente
- **Em desenvolvimento (aba Pessoas):** bloco centralizado com ícone 🔧, texto cinza, fonte 11px, `min-height: 200px`

---

## 9. CSS Necessário

Todas as classes novas usam o prefixo `analise-` para isolamento. Nenhuma classe existente deve ser sobrescrita. O bloco de CSS deve ser inserido junto aos demais blocos de módulos, agrupado com comentário `/* ── ANÁLISE DE EFICIÊNCIA ───── */`.

### Layout do módulo

```css
.analise-header { display:flex; flex-direction:column; gap:10px; margin-bottom:14px; }
.analise-title-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
.analise-header-actions { display:flex; align-items:center; gap:6px; }
```

### Painel de configuração

```css
.analise-config-panel {
  display:none; /* toggled via .open */
  background:var(--off); border:1px solid var(--cinza);
  border-radius:var(--radius-card); padding:14px 16px; margin-bottom:10px;
}
.analise-config-panel.open { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.analise-config-preview { font-size:10px; color:#888; grid-column:1/-1; line-height:1.7; }
.analise-config-actions { display:flex; gap:8px; justify-content:flex-end; grid-column:1/-1; }
```

### Abas do módulo (derivadas das abas societárias)

```css
.analise-tabs-bar { display:flex; border-bottom:1px solid var(--cinza); margin-bottom:14px; gap:0; }
.analise-tab {
  font-size:11px; font-weight:600; font-family:var(--font-ui);
  padding:8px 14px; border:none; background:none; cursor:pointer;
  color:#aaa; border-bottom:2px solid transparent;
  transition:color .12s, border-color .12s;
}
.analise-tab:hover { color:var(--grafite); }
.analise-tab.active { color:var(--grafite); border-bottom-color:var(--grafite); }
.analise-panel { display:none; }
.analise-panel.active { display:block; }
```

### Grid de KPIs

```css
.analise-kpis-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
.analise-kpi {
  flex:1; min-width:130px;
  background:var(--off); border:1px solid var(--cinza);
  border-radius:var(--radius-card); padding:8px 14px;
}
.analise-kpi-label { font-size:8px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#aaa; margin-bottom:3px; }
.analise-kpi-val { font-size:16px; font-weight:700; font-family:var(--font-mono); letter-spacing:-.5px; line-height:1.1; }
.analise-kpi-sub { font-size:9px; color:#aaa; margin-top:2px; }
```

### Cards de nucleo

```css
.analise-nucleos-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
.analise-nucleo-card {
  background:var(--branco); border:1px solid var(--cinza);
  border-radius:var(--radius-card); padding:10px 12px 10px 14px;
  border-left-width:3px; /* cor definida inline pelo nucleo */
}
.analise-nucleo-titulo { font-size:8px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#aaa; margin-bottom:8px; }
.analise-nucleo-stat { display:flex; justify-content:space-between; align-items:baseline; font-size:10px; padding:2px 0; }
.analise-nucleo-stat-val { font-family:var(--font-mono); font-weight:700; }
```

### Container de gráficos

```css
.analise-charts-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.analise-chart-card {
  background:var(--branco); border:1px solid var(--cinza);
  border-radius:var(--radius-card); padding:12px 14px;
}
.analise-chart-title { font-size:8px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:#aaa; margin-bottom:10px; }
.analise-chart-area { width:100%; overflow:visible; }
```

### Indicadores de margem

```css
.margem-risco    { color:var(--terracota); font-weight:700; }
.margem-atencao  { color:var(--ouro);      font-weight:700; }
.margem-saudavel { color:var(--verde);     font-weight:700; }
.margem-nd       { color:#bbb; }
.analise-margem-dot {
  width:7px; height:7px; border-radius:50%;
  display:inline-block; margin-right:4px; flex-shrink:0;
}
.analise-margem-dot.risco    { background:var(--terracota); }
.analise-margem-dot.atencao  { background:var(--ouro); }
.analise-margem-dot.saudavel { background:var(--verde); }
```

### Budget inline

```css
.analise-budget-cell { min-width:90px; }
.analise-budget-input {
  width:70px; font-family:var(--font-mono); font-size:11px; font-weight:700;
  border:1px solid transparent; background:transparent;
  padding:2px 4px; border-radius:4px; text-align:right;
  color:var(--grafite); transition:border-color .12s, background .12s;
}
.analise-budget-input:focus { border-color:var(--azul); background:var(--branco); outline:none; }
.analise-budget-bar { height:4px; background:var(--cinza2); border-radius:2px; margin-top:3px; overflow:hidden; }
.analise-budget-fill { height:100%; border-radius:2px; transition:width .3s; }
.analise-budget-fill.ok   { background:var(--verde); }
.analise-budget-fill.warn { background:var(--ouro); }
.analise-budget-fill.over { background:var(--terracota); }
```

### Análise isolada

```css
.analise-isolada-header {
  display:flex; align-items:center; gap:12px;
  margin-bottom:14px; padding-bottom:10px;
  border-bottom:1px solid var(--cinza);
}
.analise-isolada-titulo { font-size:14px; font-weight:600; flex:1; }
.analise-timeline-wrap { margin-top:14px; }
.analise-timeline-row {
  display:flex; align-items:center; gap:10px;
  padding:6px 0; border-bottom:1px solid var(--cinza2);
}
.analise-timeline-label { font-size:10px; flex:0 0 160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.analise-timeline-bar-wrap { flex:1; height:14px; background:var(--cinza2); border-radius:3px; position:relative; }
.analise-timeline-seg { position:absolute; height:6px; top:4px; border-radius:2px; }
.analise-timeline-seg.planejado { background:var(--cinza); opacity:.5; }
.analise-timeline-seg.real      { background:var(--azul); }
```

### Placeholder "Em Desenvolvimento"

```css
.analise-wip-state {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  min-height:220px; color:#ccc; gap:10px; text-align:center;
}
.analise-wip-icon  { font-size:28px; opacity:.4; }
.analise-wip-title { font-size:12px; font-weight:600; color:#bbb; }
.analise-wip-desc  { font-size:10px; color:#ccc; max-width:260px; line-height:1.5; }
```

### Responsividade

```css
@media (max-width: 900px) {
  .analise-nucleos-row { grid-template-columns:repeat(2,1fr); }
  .analise-charts-row  { grid-template-columns:1fr; }
}
@media (max-width: 600px) {
  .analise-nucleos-row { grid-template-columns:1fr; }
  .analise-kpis-row .analise-kpi { min-width:calc(50% - 5px); }
}
```

---

## 10. Gráficos e Visualizações

### Princípio

Os gráficos são a **prioridade visual** do módulo. Cada aba deve ter pelo menos dois gráficos. A análise isolada de projeto encerrado deve ter um gráfico dedicado. Nenhuma biblioteca externa (Chart.js, D3) — todos os gráficos são renderizados via **SVG inline gerado por JS**, usando variáveis CSS do design system para cores e sem valores hardcoded.

### Funções base de geração de SVG

**`analiseSvgBar(dados, opts)`**
- `dados`: `[{ label, valor, cor? }]`
- `opts`: `{ width, height, maxVal?, horizontal?, showLabels?, showValues?, title? }`
- Gera SVG de barras verticais ou horizontais com labels e valores.
- Usa `var(--cinza2)` para fundo de trilha, `var(--grafite)` como cor padrão se `cor` ausente.
- Labels: 9px, `var(--font-mono)`.

**`analiseSvgDonut(dados, opts)`**
- `dados`: `[{ label, valor, cor }]`
- `opts`: `{ size, innerRadius?, showLegend?, title? }`
- Gera SVG de donut chart.
- Legenda à direita com bolinhas coloridas e labels 9px.
- Texto central: valor total ou percentual maior fatia.

**`analiseSvgBarsAgrupadas(dados, opts)`**
- `dados`: `[{ label, grupos: [{ nome, valor, cor }] }]`
- `opts`: `{ width, height, title? }`
- Barras agrupadas por categoria (ex: previsto vs. real por etapa).

**`analiseSvgBarraEmpilhada(dados, opts)`**
- `dados`: `[{ label, segmentos: [{ nome, valor, cor }] }]`
- `opts`: `{ width, height, title? }`
- Barras empilhadas horizontalmente (ex: distribuição de etapas por status).

### Gráficos por aba

#### Aba Acumulado

**Gráfico 1 — Margem por nucleo (barras verticais)**
- Tipo: `analiseSvgBar()`
- Dados: margem % média por nucleo
- Cores: cor do nucleo (`NUCLEO_COR`)
- Linha de referência horizontal no threshold configurado
- Altura: 160px

**Gráfico 2 — Distribuição de horas (donut)**
- Tipo: `analiseSvgDonut()`
- Dados: total de horas por nucleo
- Cores: cor do nucleo
- Texto central: total geral de horas
- Legenda com % de cada fatia

#### Aba Em Desenvolvimento

**Gráfico 3 — Etapas por status (barras empilhadas ou donut)**
- Tipo: `analiseSvgDonut()` ou `analiseSvgBarraEmpilhada()`
- Dados: contagem de etapas por status (em andamento, em revisão, etc.)
- Cores: cores de `STATUS_ETAPA`
- Mostra distribuição do que está acontecendo no escritório agora

**Gráfico 4 — Utilização de budget por etapa (barras horizontais)**
- Tipo: `analiseSvgBar()` horizontal
- Dados: top 10 etapas com maior % de utilização de budget (apenas as que têm `budget_horas`)
- Cor da barra varia: verde <80%, amarelo 80-100%, terracota >100%
- Barra de referência em 100%
- Etapas sem budget não aparecem

#### Aba Encerrados (lista)

**Gráfico 5 — Margem histórica dos encerrados (barras verticais)**
- Tipo: `analiseSvgBar()`
- Dados: margem % de cada projeto encerrado, em ordem cronológica de conclusão
- Cor por faixa de margem (risco/atenção/saudável)
- Linha de referência no threshold configurado
- Máximo de 20 projetos visíveis, scroll ou truncagem se mais

#### Aba Encerrados — Análise isolada

**Gráfico 6 — Previsto × Realizado por etapa (barras agrupadas)**
- Tipo: `analiseSvgBarsAgrupadas()`
- Dados: para cada etapa do projeto — barra de custo previsto e barra de custo realizado
- Barra previsto: `var(--cinza)` · Barra realizado: cor variável por resultado (verde/terracota)
- Só para projetos com `percentual_custo` configurado e `valor_contratado` preenchido

### Interatividade dos gráficos

- **Hover:** tooltip com valor exato — `<title>` nativo do SVG ou overlay `div.analise-tooltip`
- **Sem clique:** gráficos são apenas visualização, sem drill-down por clique (exceto se explicitamente descrito acima)
- **Animação:** CSS `transition` nas barras SVG via `stroke-dasharray/dashoffset` ou `transform: scaleY()` — opcional, não bloquear se causar complexidade

### Tooltip

```css
.analise-tooltip {
  position:fixed; background:var(--grafite); color:var(--branco);
  font-size:10px; font-family:var(--font-mono); font-weight:600;
  padding:4px 8px; border-radius:5px; pointer-events:none;
  opacity:0; transition:opacity .1s; z-index:300; white-space:nowrap;
}
.analise-tooltip.visible { opacity:1; }
```

Elemento único no DOM, movido via `mousemove`. Inicializado em `analiseInit()`.

---

## 11. Light Mode e Dark Mode

### Princípio

Todo o módulo deve funcionar em light e dark mode **sem nenhum CSS adicional específico de tema**, desde que todas as cores usem variáveis CSS do design system. O dark mode da plataforma já inverte as variáveis — o módulo herda automaticamente.

### Checklist obrigatório

**✅ Usar sempre variáveis, nunca valores literais de cor:**
```css
/* ✅ Correto */
background: var(--branco);
color: var(--grafite);
border-color: var(--cinza);

/* ❌ Incorreto */
background: #ffffff;
color: #2d2d2d;
border-color: #e0e0e0;
```

**✅ Cores semânticas via variáveis:**
```css
/* ✅ */
color: var(--verde);
color: var(--terracota);
color: var(--ouro);

/* ❌ */
color: #34a853;
color: #c0584d;
```

**✅ Cores de texto secundário via variáveis ou valores de opacidade:**
```css
/* ✅ */
color: #aaa;   /* aceitável — é neutro em ambos os temas */
color: #888;   /* aceitável */
opacity: .5;   /* relativo, funciona em ambos */

/* ❌ */
color: #999999; /* só para texto, nunca para fundos */
```

### SVG e gráficos

Os SVGs gerados programaticamente devem usar variáveis CSS via atributo `style`, não atributos SVG `fill`/`stroke` diretos com valores literais:

```javascript
// ✅ Correto — usa currentColor ou variável CSS
`<rect style="fill:var(--cinza2)">`
`<text style="fill:var(--grafite)">`

// ❌ Incorreto — hardcoded
`<rect fill="#e8e8e8">`
`<text fill="#333">`
```

**Exceção:** cores de núcleo e cores de status que vêm de `NUCLEO_COR` e `STATUS_ETAPA` são valores do design system e podem ser usadas diretamente — já foram definidas considerando ambos os temas.

### Cores de margem no dark mode

As classes `.margem-risco`, `.margem-atencao`, `.margem-saudavel` usam `var(--terracota)`, `var(--ouro)` e `var(--verde)` — já ajustados automaticamente pelo dark mode do sistema.

### Verificação manual de dark mode

Antes de finalizar a implementação, verificar visualmente com `data-theme="dark"` ativo:
1. KPI cards — fundo, borda e texto legíveis
2. Tabelas — linhas alternadas, hover, texto
3. Gráficos SVG — barras, labels, linhas de referência
4. Painel de configuração
5. Cards de nucleo com borda colorida lateral
6. Budget input em estado normal, focus e disabled
7. Badges de margem (risco/atenção/saudável)
8. Timeline da análise isolada

---

## 12. Fluxo de Interação

**Primeira abertura:**
Clique em "Análise" → `analiseInit()` → sem cache → loading (`.loading-state`) → queries em paralelo → agregação → render Acumulado → gráficos → tabela.

**Troca de aba:**
`analiseSwitchTab(aba)` → atualiza classes → render da aba com dados já em memória — sem banco, instantâneo.

**Editar budget:**
Foco no input → edita → blur → `analiseEditarBudget(id, val)` → validação → UPDATE Supabase → atualiza memória → atualiza barra na linha do DOM cirurgicamente → toast.

**Análise isolada:**
Clique na linha → `analiseAbrirIsolado(id)` → oculta filtros e gráfico da lista → renderiza análise com dados em memória → gráfico previsto×real → timeline. "← Voltar" → `analiseFecharIsolado()` → restaura.

**Configurar margem** *(apenas `socio_admin`):*
"⚙ Configurar" → painel expande → edita threshold → "Salvar" → `analiseSetConfig()` → localStorage → re-render aba ativa → gráficos atualizam linhas de referência.

**Forçar atualização:**
"↺ Atualizar" → zera `_ultimaCarga` → `analiseCarregarDados()` → reload completo → re-render.

---

## 13. Integração com Código Existente

O módulo deve ser implementado em **novo arquivo independente `analise.html`**. Não deve ser inserido como aba, painel ou extensão de `gestao.html`.

### Regras de integração

- `analise.html` possui bootstrap próprio.
- o controle de acesso acontece no bootstrap do próprio arquivo.
- qualquer utilitário compartilhado deve ser movido para script comum reutilizável.
- nenhuma rotina de render, navegação ou estado deve depender de `onTabChange()`, `ntab`, ou da estrutura interna de `gestao.html`.

### Reuso permitido

Podem ser reutilizados dados, helpers e constantes já existentes na plataforma, desde que desacoplados da implementação visual de Gestão.

**Sem modificações obrigatórias em:** `gestao.html`, `STATUS_ETAPA`, `NUCLEO_COR`, `isSocioRole()`.

**Recomendação arquitetural:** se `abrirProduto()`, `diffHoras()`, `fmtNum()`, `fmtH()`, `fmtDate()`, `_escN()` ou `_sqN()` estiverem hoje definidos apenas em `gestao.html`, extraí-los para um arquivo compartilhado antes da implementação de `analise.html`.

**O módulo nunca modifica** `G.todosProdutos`, `G.todasEtapas` nem `G.todosUsuarios`. Edições de `budget_horas` operam apenas sobre `ANALISE._etapas`.

---

## 14. Ordem de Implementação

| Passo | O que fazer | Critério de conclusão |
|---|---|---|
| 1 | SQL: `ALTER TABLE etapas ADD COLUMN budget_horas numeric` | Campo visível no Supabase |
| 2 | Criar `analise.html` com layout base, cabeçalho, 4 abas e painéis vazios | Página abre e navegação interna funciona |
| 3 | CSS completo do módulo | Visual das abas e KPIs correto em light e dark |
| 4 | Estado global `ANALISE {}` + `analiseGetConfig/SetConfig` | Testável no console |
| 5 | `analiseCarregarDados()` + `analiseAgregarDados()` | `ANALISE._dadosPorProduto` populado corretamente |
| 6 | Funções base de SVG: `analiseSvgBar`, `analiseSvgDonut` | Gráficos de teste renderizando |
| 7 | Aba Acumulado: KPIs + cards de nucleo + gráficos + tabela + filtros | Aba completa e interativa |
| 8 | Aba Em Desenvolvimento: KPIs + gráficos + tabela + budget inline + risco | Edição de budget funcional |
| 9 | `analiseSvgBarsAgrupadas` + `analiseSvgBarraEmpilhada` | Gráficos complexos renderizando |
| 10 | Aba Encerrados: lista + gráfico histórico + análise isolada + timeline | Isolada abre e fecha corretamente |
| 11 | Integração de roles: visibilidade por role, botão config só para socio_admin | Testado com diferentes logins |
| 12 | Aba Por Pessoa: placeholder visual | Estado "em desenvolvimento" exibido |
| 13 | Verificação dark mode em todas as abas e gráficos | Nenhum elemento hardcoded |
| 14 | Testes com dados reais: edge cases (sem valor contratado, sem budget, sem horas) | Sem erros JS, sem layout quebrado |

---

## 15. Riscos e Pontos de Atenção

| Risco | Impacto | Mitigação |
|---|---|---|
| Volume alto de `horas_lancadas` (> 50k) | Carga lenta, travamento | Cache de 5 min; avaliar view materializada no banco se necessário |
| Etapas sem `budget_horas` | Gráfico 4 vazio ou incompleto | Mostrar apenas etapas com budget; mensagem "Configure budget_horas para ver este gráfico" |
| Produtos sem `valor_contratado` | Margem nula, não entram em comparativos | Exibir "—" na coluna; excluir de gráficos de margem; nunca aparecem na seção de risco |
| Usuários sem `historico_valor_hora` | Custo subestimado silenciosamente | Exibir aviso no cabeçalho do módulo: "X usuário(s) sem valor/hora cadastrado" |
| SVG gerado com cores hardcoded | Quebra no dark mode | Revisão obrigatória antes de cada deploy: buscar `fill="#` e `color:#` no código do módulo |
| `ANALISE._etapas` dessinc com `G.todasEtapas` | `budget_horas` não disponível em outros módulos | Sem impacto na v1.0; registrar no backlog para futura unificação |
| Datas nulas na timeline isolada | Segmentos ausentes ou erro de render | Renderizar segmento apenas quando `data_liberacao` e `data_estimada` existirem; omitir linha se ambas nulas |
| Acesso indevido por URL direta | Usuário não-sócio acessa aba via manipulação de DOM | Verificar role também em `analiseInit()` — retornar sem render se não for sócio |
| Colisão de classe CSS | Estilos vazando para outros módulos | Prefixo `analise-` em todas as classes novas; nenhuma classe existente sobrescrita |
| Módulo mobile (`mobile/analise.html`) | Funcionalidade ausente no mobile | Fora de escopo neste sprint; registrar como item futuro |

---

## 16. Recomendações de Evolução Estratégica

Esta seção consolida melhorias recomendadas para que o módulo evolua de um painel de custo e margem para uma ferramenta real de leitura de eficiência operacional do escritório. O objetivo é ampliar a capacidade de responder não apenas "quanto custou", mas também "quanto foi entregue", "onde está o gargalo", "o que tende a estourar" e "por que a margem escapou".

### 16.1 Diretriz de produto

O módulo deve operar sobre quatro camadas complementares:

1. **Resultado** — custo, margem e comparativos financeiros.
2. **Eficiência** — relação entre horas consumidas e progresso efetivamente entregue.
3. **Previsão** — sinais antecipados de estouro de budget, atraso e erosão de margem.
4. **Causa** — identificação estruturada dos motivos de desvio para aprendizado do escritório.

Sem estas quatro camadas, o módulo tenderá a funcionar mais como um painel retrospectivo de performance econômica do que como instrumento gerencial para melhorar margem futura.

### 16.2 Prioridade 1 — tornar a leitura de eficiência mais fiel

#### 16.2.1 Trocar configuração local por configuração global

O uso de `localStorage` para `margem_threshold` e `margem_atencao` entra em conflito com a regra de negócio de "threshold vigente". Se o valor é corporativo, deve ser persistido em banco ou em mecanismo global de configuração da plataforma.

**Recomendação:**
- manter `localStorage` apenas como cache local de leitura;
- persistir o valor oficial em tabela de configuração ou estrutura equivalente;
- registrar `updated_by`, `updated_at`.

#### 16.2.2 Separar margem atual de margem projetada

Projetos em andamento não devem ser avaliados apenas por `valor_contratado - custo acumulado`. Isso mostra a margem até hoje, mas não a margem provável ao fim do projeto.

**Adicionar por produto e por etapa:**
- `custoProjetadoFinal`
- `margemProjetada`
- `margemProjetadaPct`
- `desvioCustoProjetado`

**Regras iniciais sugeridas:**
- se houver `budget_horas` e progresso da etapa, projetar custo restante a partir da eficiência atual;
- se não houver progresso estruturado, usar heurística conservadora baseada em horas gastas versus horas planejadas.

#### 16.2.3 Adicionar medida de progresso real entregue

Hoje o módulo mede insumo (`horas`, `custo`, `valor/hora`) melhor do que mede saída (`entrega`). Para falar de eficiência com mais precisão, é necessário introduzir uma medida objetiva de progresso por etapa.

**Opções válidas para v1.1/v1.2:**
- `etapas.progresso_pct` manual (0-100);
- checklist de marcos ponderados por etapa;
- progresso automático por entregáveis concluídos, se a plataforma já tiver base para isso.

**Regra recomendada:**
- permitir progresso somente em faixas claras (`0, 25, 50, 75, 100`) na primeira iteração, para reduzir subjetividade.

#### 16.2.4 Adicionar indicadores de eficiência simplificados

Com `budget_horas`, custo real e progresso, o módulo passa a suportar indicadores inspirados em Earned Value, adaptados para uso interno e com linguagem simples.

**Adicionar por etapa e por projeto:**
- `PV` (planned value / valor planejado até a data)
- `EV` (earned value / valor do trabalho efetivamente entregue)
- `AC` (actual cost / custo real acumulado)
- `CPI = EV / AC` — eficiência de custo
- `SPI = EV / PV` — eficiência de progresso
- `CV = EV - AC`
- `SV = EV - PV`

**Tradução de UI recomendada:**
- não expor siglas sozinhas no primeiro nível;
- usar labels como "Eficiência de custo" e "Eficiência de progresso", com sigla apenas em tooltip ou subtítulo.

### 16.3 Prioridade 2 — explicitar gargalos operacionais

Se o objetivo é encontrar gargalos do escritório, o módulo precisa mostrar fluxo, fila e tempo parado, não apenas custo fechado.

#### 16.3.1 Adicionar métricas de fluxo por etapa

**Adicionar:**
- `leadTimeDias` — da criação da etapa até conclusão
- `cycleTimeDias` — do início efetivo até conclusão
- `agingDias` — tempo desde a última mudança relevante
- `tempoEmRevisaoDias`
- `tempoAguardandoClienteDias` (se existir status equivalente)

#### 16.3.2 Adicionar visão de WIP e throughput

**Novos KPIs recomendados na aba Em Desenvolvimento:**
- etapas em andamento por núcleo;
- etapas em revisão por responsável;
- throughput semanal ou mensal (quantas etapas concluídas);
- WIP por pessoa ou por núcleo;
- backlog de revisão acumulado.

#### 16.3.3 Nova seção de gargalos

Criar bloco visual específico com:
- top 10 etapas mais antigas em `em_andamento`;
- top 10 etapas mais antigas em `em_revisao`;
- núcleos com maior fila;
- responsáveis com maior volume simultâneo de etapas.

### 16.4 Prioridade 3 — registrar causa de erosão de margem

O módulo deve distinguir baixa margem por ineficiência interna de baixa margem por mudança de escopo, atraso externo ou decisão comercial.

#### 16.4.1 Taxonomia de desvio

Adicionar classificação estruturada para projetos e etapas com desvio relevante:
- `suborcamento_inicial`
- `escopo_extra_cobrado`
- `escopo_extra_nao_cobrado`
- `retrabalho_interno`
- `retrabalho_por_cliente`
- `alocacao_senior_inadequada`
- `espera_cliente`
- `dependencia_externa`
- `erro_de_planejamento`
- `baixa_produtividade_execucao`

#### 16.4.2 Post-mortem obrigatório para encerrados críticos

Para projetos encerrados com margem abaixo do threshold ou estouro material de horas, exigir um pequeno registro de lição aprendida:
- motivo principal do desvio;
- motivo secundário;
- ação corretiva sugerida;
- se o aprendizado afeta orçamento futuro, processo ou comercial.

#### 16.4.3 Bridge de margem

Na análise isolada de encerrados, adicionar um componente "ponte de margem":
- margem orçada inicial;
- impacto de horas extras;
- impacto de custos lançados;
- impacto de retrabalho;
- impacto de escopo não cobrado;
- margem final.

### 16.5 Prioridade 4 — conectar o módulo à economia real do escritório

O spec atual mede bem custo direto de execução, mas ainda não cobre toda a economia operacional da firma. Para escritórios de projeto, vale preparar evolução para indicadores clássicos de A/E e serviços profissionais.

#### 16.5.1 Explicitar conceito de margem da v1

Documentar de forma expressa se `valor_hora` representa:
- apenas custo direto de mão de obra; ou
- custo fully-loaded com encargos e overhead rate embutido.

Se for apenas custo direto, o módulo deve rotular o indicador como algo próximo de "margem de contribuição do projeto", e não como margem operacional final do escritório.

#### 16.5.2 Evolução futura recomendada

Quando houver base de dados financeira suficiente, incorporar:
- `utilizacao` por pessoa, núcleo e escritório;
- `realizacao` (horas registradas versus horas faturadas/recuperadas), se existir base de faturamento;
- `net multiplier`;
- `payroll multiplier`;
- `overhead rate`.

Estas métricas não precisam entrar na v1, mas o modelo do módulo deve evitar bloquear esta expansão.

### 16.6 Ajustes recomendados no modelo de dados

#### 16.6.1 Campos / entidades desejáveis

**Etapas**
- `budget_horas` (já previsto)
- `progresso_pct`
- `ultima_atualizacao_progresso_em`
- `motivo_desvio`
- `observacao_desvio`

**Projetos**
- `margem_orcada_inicial` (se houver base comercial)
- `motivo_desvio_principal`
- `motivo_desvio_secundario`
- `postmortem_resumo`

**Histórico / auditoria**
- histórico de edição de `budget_horas`
- histórico de alteração de `progresso_pct`
- histórico de alteração de threshold de margem

#### 16.6.2 Regras de auditoria

Toda alteração de `budget_horas`, `progresso_pct` e configuração de margem deve registrar:
- usuário;
- data/hora;
- valor anterior;
- valor novo.

Sem isso, o painel perde confiabilidade analítica e dificulta comparações históricas.

### 16.7 Ajustes recomendados nas abas atuais

#### Aba Acumulado
- adicionar toggle entre `margem atual` e `margem projetada`;
- adicionar corte visual para "margem em risco por projeção", não apenas por realizado;
- adicionar comparativo `horas planejadas x horas realizadas` por núcleo.

#### Aba Em Desenvolvimento
- transformar esta aba na principal aba de gestão ativa;
- priorizar alertas antecipados de desvio;
- adicionar seção "Gargalos agora";
- adicionar ranking de etapas com `CPI` e `SPI` piores do período.

#### Aba Encerrados
- usar esta aba como memória de aprendizado do escritório;
- exibir `previsto x realizado x causa do desvio`;
- exibir `bridge de margem`;
- permitir filtro por motivo de desvio para aprendizado comercial e operacional.

#### Aba Por Pessoa

Em vez de permanecer só como placeholder, esta aba tem potencial alto para gestão de eficiência. Backlog sugerido:
- horas por pessoa;
- horas por etapa/tipo;
- utilização;
- participação em projetos de baixa e alta margem;
- tempo médio em revisão;
- carga simultânea de WIP.

### 16.8 Ordem sugerida de evolução após v1

| Fase | Objetivo | Entregas |
|---|---|---|
| 1 | Tornar a leitura financeira mais confiável | Config global de margem; distinção entre margem atual e projetada; auditoria de budget |
| 2 | Tornar a leitura de eficiência mensurável | `progresso_pct`; `PV/EV/AC`; `CPI/SPI`; alertas preditivos |
| 3 | Tornar gargalos visíveis | aging; tempo por status; WIP; throughput; seção de gargalos |
| 4 | Transformar desvio em aprendizado | taxonomia de causa; post-mortem; bridge de margem |
| 5 | Conectar operação com economia do escritório | utilização; realização; net multiplier; overhead rate |

### 16.9 Decisão de escopo recomendada

Para preservar foco e viabilidade, a recomendação é:

- **v1.0**: manter o core financeiro já desenhado no spec;
- **v1.1**: adicionar progresso estruturado, margem projetada e alertas de risco;
- **v1.2**: adicionar gargalos de fluxo e causas de desvio;
- **v2.0**: conectar com indicadores mais amplos de utilização, realização e desempenho econômico do escritório.

---

## 17. Roadmap de Implementação

Esta seção transforma o spec em um plano de execução prático. A lógica é dividir a implementação em entregas que já gerem valor para os sócios sem travar o time em uma grande iniciativa monolítica. A seção 14 continua válida como ordem técnica macro; esta seção organiza o trabalho por fases de produto, dependências e critérios de aceite.

### 17.1 Princípios do roadmap

1. Entregar primeiro visibilidade financeira confiável.
2. Em seguida, adicionar mecanismos de previsão e alerta.
3. Depois, tornar gargalos e causas visíveis.
4. Só então expandir para indicadores mais sofisticados de gestão do escritório.

### 17.2 Visão geral por release

| Release | Objetivo principal | Resultado esperado |
|---|---|---|
| `v1.0` | Colocar o módulo no ar com leitura financeira e operacional básica | Sócios passam a ter visão consolidada de custo, margem e uso de budget |
| `v1.1` | Sair do retrospectivo para o preditivo | Projetos em andamento passam a ter margem projetada e alertas de risco |
| `v1.2` | Tornar gargalos e causas explicitamente gerenciáveis | Escritório passa a ver filas, tempos parados e causas de erosão |
| `v2.0` | Conectar projeto com economia mais ampla da firma | Decisões passam a combinar margem de projeto, utilização e indicadores de estrutura |

### 17.3 Fase 0 — Preparação e alinhamento

**Objetivo**
- remover incertezas de base antes de começar a codar o módulo.

**Escopo**
- validar `budget_horas` em `etapas`;
- validar consistência de `historico_valor_hora`;
- confirmar definição de `valor_hora` como custo direto ou fully-loaded;
- confirmar se o threshold de margem será global ou apenas local na v1.0;
- revisar se existem status suficientes para leituras futuras de gargalo.

**Entregas**
- decisão documentada sobre conceito de margem;
- decisão documentada sobre persistência de configuração;
- checklist de dados faltantes ou incompletos.

**Critério de aceite**
- o time consegue responder sem ambiguidade:
  - o que a margem mede;
  - quem pode configurar thresholds;
  - que dados estão confiáveis para o lançamento.

### 17.4 Fase 1 — Fundação técnica do módulo (`v1.0-a`)

**Objetivo**
- criar a base navegável, visual e estrutural do módulo.

**Escopo**
- entrada de navegação para `analise.html` visível apenas para sócios;
- página `analise.html` com `#page-analise` e 4 abas;
- estado global `ANALISE`;
- ciclo de vida (`analiseInit`, `analiseCarregarDados`, `analiseAgregarDados`);
- CSS isolado do módulo;
- helpers de configuração;
- infraestrutura de SVG.

**Dependências**
- decisão de acesso fechada;
- campo `budget_horas` disponível no banco.

**Entregas**
- navegação para `analise.html` funcionando;
- carregamento único com cache;
- layout em light e dark;
- dados agregados em memória sem render final completo.

**Critério de aceite**
- abrir `analise.html` não gera erro JS;
- dados carregam em cache e reabrem sem re-fetch dentro da janela prevista;
- usuário sem role societária não vê nem acessa o módulo.

### 17.5 Fase 2 — MVP financeiro-operacional (`v1.0`)

**Objetivo**
- colocar no ar a primeira versão útil para sócios.

**Escopo**
- aba `Acumulado` completa;
- aba `Em Desenvolvimento` com KPIs, tabela de etapas, risco e edição de `budget_horas`;
- aba `Encerrados` com lista, gráfico histórico e análise isolada;
- aba `Por Pessoa` como placeholder;
- toasts, empty states, loading states e fluxo de atualização.

**Entregas**
- custo HH por projeto;
- custo total por projeto;
- margem e margem %;
- uso de budget por etapa;
- ranking visual de projetos em risco;
- histórico de encerrados com leitura por etapa.

**Critério de aceite**
- sócios conseguem responder:
  - quais projetos estão consumindo mais horas;
  - quais etapas estão próximas ou acima do budget;
  - quais projetos encerrados tiveram melhor e pior margem.

**Não entra nesta fase**
- progresso físico estruturado;
- margem projetada;
- análise de gargalo por fluxo;
- causa de desvio estruturada.

### 17.6 Fase 3 — Previsão e alerta (`v1.1`)

**Objetivo**
- transformar a aba de desenvolvimento em um painel realmente gerencial.

**Escopo**
- adicionar `progresso_pct` por etapa;
- adicionar `custoProjetadoFinal`, `margemProjetada` e `margemProjetadaPct`;
- introduzir indicadores simplificados de eficiência (`PV`, `EV`, `AC`, `CPI`, `SPI`);
- atualizar cards, tabelas e alertas com base em projeção, não só no realizado;
- substituir `localStorage` por configuração global, se esta decisão já estiver aprovada.

**Dependências**
- definição de como o progresso será informado;
- decisão de persistência global de configuração;
- validação de regra de cálculo de projeção.

**Entregas**
- alerta antecipado de risco em projeto ativo;
- leitura comparativa de eficiência por etapa;
- separação entre `margem atual` e `margem projetada`.

**Critério de aceite**
- um sócio consegue identificar um projeto aparentemente saudável hoje, mas com risco claro de perda de margem ao fim;
- o sistema deixa explícito quando uma etapa está gastando mais do que entrega.

### 17.7 Fase 4 — Gargalos de fluxo (`v1.2-a`)

**Objetivo**
- localizar onde a operação está travando.

**Escopo**
- métricas `leadTimeDias`, `cycleTimeDias`, `agingDias`, `tempoEmRevisaoDias`;
- KPIs de WIP e throughput;
- seção `Gargalos agora`;
- rankings por núcleo, responsável e status.

**Dependências**
- existência de timestamps confiáveis para criação, início, revisão e conclusão;
- definição de quais mudanças de status contam para aging.

**Entregas**
- top etapas mais antigas;
- backlog de revisão;
- WIP por núcleo;
- throughput do período.

**Critério de aceite**
- o módulo deixa claro se o problema do escritório está em produção, revisão, espera externa ou excesso de simultaneidade.

### 17.8 Fase 5 — Causa e aprendizado (`v1.2`)

**Objetivo**
- fazer o módulo ensinar o escritório a proteger margem futura.

**Escopo**
- taxonomia de desvio;
- registro de causa principal e secundária;
- post-mortem obrigatório para casos críticos;
- `bridge de margem` na análise isolada de encerrados;
- filtros por causa de desvio.

**Dependências**
- definição final da taxonomia;
- decisão de quem pode preencher e editar post-mortem;
- critérios para obrigatoriedade do preenchimento.

**Entregas**
- causas de erosão visíveis no módulo;
- aprendizado reutilizável em novos orçamentos e novas propostas;
- comparação entre desvio comercial, operacional e externo.

**Critério de aceite**
- após encerrar um projeto ruim, o escritório consegue dizer com base no sistema se a perda veio de suborçamento, retrabalho, escopo não cobrado ou outro motivo.

### 17.9 Fase 6 — Eficiência por pessoa e economia ampliada (`v2.0`)

**Objetivo**
- conectar performance de projeto com performance estrutural da firma.

**Escopo**
- evolução da aba `Por Pessoa`;
- utilização por pessoa, núcleo e escritório;
- realização, se houver base de faturamento;
- net multiplier, payroll multiplier e overhead rate;
- comparativos entre mix de senioridade e margem.

**Dependências**
- base financeira e de faturamento confiável;
- definição de fórmula oficial de utilização;
- eventual integração com dados de cobrança / faturamento.

**Entregas**
- leitura de capacidade do escritório;
- análise de rentabilidade por alocação;
- visão combinada de margem de projeto e eficiência estrutural.

**Critério de aceite**
- o módulo passa a responder não só quais projetos dão margem, mas também se a estrutura do escritório está convertendo trabalho em resultado econômico com eficiência.

### 17.10 Organização sugerida em sprints

Assumindo sprints curtos e foco em entregas com valor demonstrável:

| Sprint | Meta | Entrega principal |
|---|---|---|
| 1 | Preparar base | Fase 0 + SQL + esqueleto do módulo + role gating |
| 2 | Montar infraestrutura | Estado `ANALISE`, carga de dados, agregação, SVG base |
| 3 | Entregar primeira aba forte | Aba `Acumulado` completa |
| 4 | Fechar operação ativa | Aba `Em Desenvolvimento` + edição de budget + alertas atuais |
| 5 | Fechar histórico | Aba `Encerrados` + análise isolada + timeline |
| 6 | Estabilizar v1.0 | testes com dados reais, dark mode, edge cases, ajuste fino |
| 7 | Subir capacidade preditiva | `progresso_pct`, margem projetada, `CPI/SPI`, config global |
| 8 | Mostrar gargalos | aging, WIP, throughput, seção de gargalos |
| 9 | Transformar em aprendizado | causa de desvio, post-mortem, bridge de margem |
| 10 | Expandir para gestão da firma | aba `Por Pessoa` útil + indicadores econômicos ampliados |

### 17.11 Dependências críticas

Antes de iniciar fases acima de `v1.0`, estas dependências precisam estar endereçadas:

- definição oficial de margem;
- confiabilidade de `historico_valor_hora`;
- existência ou criação de campo de progresso;
- timestamps mínimos para leitura de fluxo;
- decisão sobre persistência global de configuração;
- política de auditoria para alterações sensíveis.

### 17.12 Riscos de execução do roadmap

| Risco | Onde impacta mais | Mitigação |
|---|---|---|
| Equipe tenta implementar tudo de uma vez | cronograma e qualidade | preservar releases incrementais |
| Progresso por etapa nasce subjetivo demais | `v1.1` | começar com faixas fixas e governança simples |
| Dados financeiros incompletos distorcem confiança | `v1.0` e `v2.0` | sinalizar lacunas no UI e bloquear métricas mais sofisticadas até saneamento |
| Falta de timestamps adequados inviabiliza gargalos | `v1.2-a` | mapear cedo quais eventos precisam passar a ser persistidos |
| Post-mortem vira burocracia e não aprendizado | `v1.2` | exigir formulário curto e taxonomia bem fechada |

### 17.13 Gate de decisão por release

Ao fim de cada release, realizar uma revisão curta com sócios para responder:

1. O módulo já está ajudando a tomar decisões melhores?
2. Há confiança suficiente nos dados para subir um nível de sofisticação?
3. O próximo passo deve priorizar previsão, gargalo ou aprendizado?

Se a resposta para a pergunta 2 for "não", o roadmap deve parar e consolidar qualidade antes de seguir.

---

## 18. Estrutura Técnica do Novo Módulo

Esta seção traduz o spec em uma estrutura concreta de implementação para o novo arquivo `analise.html`, mantendo separação total em relação a `gestao.html`.

### 18.1 Arquivos recomendados

| Arquivo | Responsabilidade |
|---|---|
| `analise.html` | Estrutura da página, carregamento de scripts, containers do módulo |
| `analise.css` | Estilos exclusivos do módulo de análise |
| `analise.js` | Estado `ANALISE`, bootstrap, carga de dados, agregação, renderização e eventos |
| `shared/app-shell.js` | Bootstrap compartilhado da plataforma, sessão, usuário e Supabase |
| `shared/app-utils.js` | Helpers reutilizáveis como `diffHoras`, `fmtNum`, `fmtH`, `fmtDate`, `_escN`, `_sqN` |
| `shared/app-constants.js` | Constantes como `STATUS_ETAPA`, `NUCLEO_COR` e roles |

Se a plataforma ainda não tiver camada `shared/`, esta extração deve acontecer antes ou junto da implementação de `analise.html`.

### 18.2 Responsabilidade de cada camada

#### `analise.html`

Deve conter apenas:
- estrutura semântica da página;
- containers vazios para header, KPIs, gráficos, tabelas e estados;
- importação de CSS e JS necessários;
- markup mínimo do painel de configuração e das abas internas.

Não deve conter:
- regras de negócio;
- queries Supabase inline;
- renderização imperativa embutida em `<script>` no HTML, exceto um bootstrap mínimo se o padrão da plataforma exigir.

#### `analise.css`

Deve conter:
- todas as classes prefixadas com `analise-`;
- responsividade da página;
- estilos dos gráficos SVG e estados visuais;
- estilos de loading, vazio, erro, cards, filtros, tabela e análise isolada.

Não deve:
- sobrescrever estilos de `gestao.html`;
- redefinir globais da plataforma;
- depender de hierarquias frágeis da página anterior.

#### `analise.js`

Deve concentrar:
- bootstrap da página;
- guarda de acesso por role;
- inicialização de `ANALISE`;
- carga de dados;
- agregação;
- render das abas;
- listeners de filtros e ações;
- atualização de `budget_horas`;
- tooltip e gráficos SVG.

### 18.3 Estrutura recomendada de `analise.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Análise de Eficiência</title>
  <link rel="stylesheet" href="shared/app-shell.css" />
  <link rel="stylesheet" href="analise.css" />
</head>
<body data-page="analise">
  <main id="page-analise" class="page">
    <section class="analise-header"></section>
    <section class="analise-tabs-wrap"></section>
    <section class="analise-panels"></section>
  </main>

  <div id="analise-tooltip" class="analise-tooltip"></div>

  <script src="shared/app-constants.js"></script>
  <script src="shared/app-utils.js"></script>
  <script src="shared/app-shell.js"></script>
  <script src="analise.js"></script>
</body>
</html>
```

### 18.4 Estrutura recomendada de `analise.js`

Organizar o arquivo em blocos previsíveis:

1. constantes e estado;
2. bootstrap;
3. acesso e sessão;
4. carga de dados;
5. agregação;
6. render base;
7. renders por aba;
8. gráficos SVG;
9. ações do usuário;
10. utilitários internos.

### 18.5 Esqueleto sugerido de `analise.js`

```javascript
const ANALISE = {
  _produtos: [],
  _etapas: [],
  _horas: [],
  _custos: [],
  _vhPorUser: {},
  _dadosPorProduto: {},
  _dadosPorEtapa: {},
  _abaAtiva: 'acumulado',
  _produtoIsoladoId: null,
  _carregando: false,
  _ultimaCarga: null,
  _filtros: {
    acumulado: { nucleo: '', status: '', ordem: 'nome' },
    desenvolvimento: { nucleo: '', statusEtapa: '', agrupamento: 'projeto' },
    encerrados: { nucleo: '', ano: '', ordem: 'conclusao_desc' },
  },
};

document.addEventListener('DOMContentLoaded', analiseBootstrap);

async function analiseBootstrap() {
  await appShellInit();
  analiseValidarAcesso();
  analiseRenderShell();
  analiseBindEventosBase();
  await analiseInit();
}
```

### 18.6 Funções de bootstrap recomendadas

| Função | Papel |
|---|---|
| `analiseBootstrap()` | ponto único de entrada da página |
| `analiseValidarAcesso()` | bloqueia não-sócios antes de renderizar dados |
| `analiseRenderShell()` | injeta header, tabs, painéis-base e tooltip |
| `analiseBindEventosBase()` | listeners globais de tabs, config e reload |
| `analiseInit()` | decide entre cache e carga nova |

### 18.7 Contrato esperado de `app-shell`

Para `analise.html` funcionar de forma independente, o bootstrap compartilhado deve oferecer algo como:

```javascript
await appShellInit();

// Resultado esperado após init:
G.usuario
G.todosProdutos
G.todasEtapas
G.todosUsuarios
SB
```

Onde:
- `G` é o estado global compartilhado da plataforma;
- `SB` é a instância de Supabase ou adapter equivalente.

Se isso ainda não existir, criar um loader compartilhado antes de implementar o módulo.

### 18.8 Estratégia de dependência compartilhada

Separar o que é compartilhável do que é específico:

**Compartilhado**
- sessão do usuário;
- cliente Supabase;
- formatação;
- constantes de status e núcleo;
- helpers de escape;
- utilitários de data e hora.

**Específico de `analise.html`**
- estado `ANALISE`;
- filtros da análise;
- agregações financeiras;
- componentes SVG;
- render de KPIs, cards, riscos e análise isolada.

### 18.9 Estrutura recomendada de render

Evitar arquivo com renderização desorganizada. Preferir funções por bloco:

| Bloco | Funções sugeridas |
|---|---|
| Shell da página | `analiseRenderShell`, `analiseRenderHeader`, `analiseRenderTabs` |
| Estado global de tela | `analiseRenderLoading`, `analiseRenderErro`, `analiseRenderEmpty` |
| Aba Acumulado | `analiseRenderAcumulado`, `analiseKpisAcumulado`, `analiseTabelaAcumulado` |
| Aba Desenvolvimento | `analiseRenderDesenvolvimento`, `analiseTabelaEtapasEmCurso`, `analiseSecaoRisco` |
| Aba Encerrados | `analiseRenderEncerrados`, `analiseListaEncerrados`, `analiseRenderAnaliseIsolada` |
| Aba Pessoas | `analiseRenderPessoas` |

### 18.10 Estratégia recomendada de eventos

Usar `event delegation` quando possível para evitar muitos listeners por linha:

- clique em tabs via container `.analise-tabs-bar`;
- clique em ações do header via `.analise-header-actions`;
- blur/change de budget via tabela de desenvolvimento;
- clique em linha de projeto encerrado via atributo `data-produto-id`.

Exemplo:

```javascript
document
  .getElementById('anp-desenvolvimento')
  .addEventListener('blur', analiseOnBudgetBlur, true);
```

### 18.11 Estratégia recomendada para gráficos

Para manter o arquivo sustentável:

- concentrar geradores SVG em um bloco único de `analise.js` ou em arquivo `analise-charts.js` se crescer demais;
- padronizar assinatura de funções gráficas;
- centralizar leitura de cores semânticas;
- usar `<title>` como fallback mínimo de tooltip.

Se o volume de gráficos crescer muito após `v1.1`, considerar extrair para:
- `analise-charts.js`
- `analise-math.js`

### 18.12 Estrutura sugerida de diretórios

```text
/analise.html
/analise.css
/analise.js
/shared/app-shell.js
/shared/app-utils.js
/shared/app-constants.js
```

Se o projeto já tiver pasta `pages/` ou `modules/`, adaptar o caminho, mas preservar a separação de responsabilidades.

### 18.13 Ordem recomendada de implementação por arquivo

1. criar `analise.html`;
2. criar `analise.css` com layout base e estados;
3. criar `analise.js` com bootstrap, acesso e shell;
4. extrair ou criar `shared/app-shell.js`;
5. extrair ou criar `shared/app-utils.js`;
6. implementar carga e agregação;
7. implementar render da aba `Acumulado`;
8. implementar render de `Em Desenvolvimento`;
9. implementar render de `Encerrados`;
10. implementar gráficos mais complexos;
11. estabilizar dark mode, edge cases e performance.

### 18.14 Decisão arquitetural recomendada

Se houver dúvida entre:
- reaproveitar muita lógica de `gestao.html` por cópia; ou
- extrair utilitários e construir `analise.html` com bootstrap próprio,

a recomendação é a segunda opção.

Copiar lógica de `gestao.html` para dentro de `analise.html` pode acelerar o início, mas tende a aumentar acoplamento, duplicação e custo de manutenção. O módulo de análise tem natureza suficientemente distinta para justificar um entrypoint próprio.

---

## 19. Checklist Técnico de Implementação

Esta seção converte a estrutura técnica em tarefas objetivas de execução. A ideia é permitir que a implementação aconteça em blocos pequenos, verificáveis e com baixo risco de retrabalho.

### 19.1 Checklist de preparação

- [ ] confirmar que `analise.html` será um entrypoint novo e independente;
- [ ] confirmar onde ficarão `analise.html`, `analise.js` e `analise.css` na árvore do projeto;
- [ ] mapear se já existe camada `shared/` ou equivalente;
- [ ] identificar quais helpers hoje estão presos a `gestao.html`;
- [ ] confirmar disponibilidade de `SB` ou cliente Supabase compartilhado;
- [ ] confirmar regra final de acesso para `socio` e `socio_admin`;
- [ ] validar no banco a existência de `etapas.budget_horas`;
- [ ] levantar lacunas em `historico_valor_hora`.

### 19.2 Checklist de extração para camada compartilhada

#### Arquivos compartilhados

- [ ] criar ou consolidar `shared/app-shell.js`;
- [ ] criar ou consolidar `shared/app-utils.js`;
- [ ] criar ou consolidar `shared/app-constants.js`.

#### Helpers a extrair, se ainda estiverem acoplados

- [ ] `diffHoras()`
- [ ] `fmtNum()`
- [ ] `fmtH()`
- [ ] `fmtDate()`
- [ ] `_escN()`
- [ ] `_sqN()`
- [ ] `isSocioRole()`
- [ ] `STATUS_ETAPA`
- [ ] `NUCLEO_COR`

#### Verificações

- [ ] garantir que nenhum helper extraído dependa de DOM específico de `gestao.html`;
- [ ] garantir que `analise.html` consiga inicializar sem importar render ou navegação de Gestão.

### 19.3 Checklist de criação dos arquivos-base

#### `analise.html`

- [ ] criar o arquivo com `<head>` mínimo, CSS compartilhado e CSS do módulo;
- [ ] criar `<body data-page="analise">`;
- [ ] criar `<main id="page-analise" class="page">`;
- [ ] criar containers vazios para header, tabs e panels;
- [ ] criar `<div id="analise-tooltip" class="analise-tooltip"></div>`;
- [ ] incluir scripts compartilhados antes de `analise.js`.

#### `analise.css`

- [ ] criar arquivo novo;
- [ ] adicionar bloco comentado do módulo;
- [ ] adicionar layout base da página;
- [ ] adicionar estilos de header, tabs, painéis, KPIs e cards;
- [ ] adicionar estilos de gráficos;
- [ ] adicionar estilos de tabela e budget inline;
- [ ] adicionar estados de loading, empty e erro;
- [ ] adicionar responsividade;
- [ ] revisar uso exclusivo de classes prefixadas com `analise-`.

#### `analise.js`

- [ ] criar arquivo novo;
- [ ] declarar `const ANALISE = {...}`;
- [ ] registrar `DOMContentLoaded`;
- [ ] implementar `analiseBootstrap()`;
- [ ] implementar `analiseValidarAcesso()`;
- [ ] implementar `analiseRenderShell()`;
- [ ] implementar `analiseBindEventosBase()`.

### 19.4 Checklist de bootstrap e sessão

- [ ] implementar `appShellInit()` ou equivalente;
- [ ] garantir preenchimento de `G.usuario`;
- [ ] garantir preenchimento de `G.todosProdutos`;
- [ ] garantir preenchimento de `G.todasEtapas`;
- [ ] garantir preenchimento de `G.todosUsuarios`;
- [ ] garantir disponibilidade de `SB`;
- [ ] bloquear acesso a não-sócios antes do carregamento de dados;
- [ ] definir destino de redirect ou tela de acesso negado.

### 19.5 Checklist de estado e configuração

- [ ] implementar estado `ANALISE`;
- [ ] implementar `_ultimaCarga`;
- [ ] implementar `_carregando`;
- [ ] implementar `_filtros` por aba;
- [ ] implementar `analiseGetConfig()`;
- [ ] implementar `analiseSetConfig()`;
- [ ] implementar `analiseRenderConfig()`;
- [ ] implementar `analiseAbrirConfig()`;
- [ ] implementar `analiseSalvarConfig()`.

### 19.6 Checklist de carga de dados

- [ ] implementar `analiseInit()`;
- [ ] implementar `analiseCarregarDados()`;
- [ ] montar `Promise.all` das queries necessárias;
- [ ] carregar `etapas` com `budget_horas`;
- [ ] carregar `horas_lancadas`;
- [ ] carregar `lancamentos_custo`;
- [ ] carregar `historico_valor_hora`;
- [ ] ler produtos a partir de `G.todosProdutos`;
- [ ] montar `_vhPorUser` com o registro vigente de cada usuário;
- [ ] tratar erro de carga com estado visual e log.

### 19.7 Checklist de agregação

- [ ] implementar `analiseAgregarDados()`;
- [ ] agregar horas por produto;
- [ ] agregar custo HH por produto;
- [ ] agregar custos lançados por produto;
- [ ] calcular custo total por produto;
- [ ] calcular margem e margem % por produto;
- [ ] agregar dados por etapa;
- [ ] calcular `utilizacaoBudget`;
- [ ] montar `etapasProgresso`;
- [ ] validar comportamento para `valor_contratado` nulo;
- [ ] validar comportamento para `budget_horas` nulo ou zero;
- [ ] validar usuários sem `valor_hora`.

### 19.8 Checklist de shell e navegação interna

- [ ] renderizar header do módulo;
- [ ] renderizar badge societário;
- [ ] renderizar botão `Atualizar`;
- [ ] renderizar botão `Configurar` apenas para `socio_admin`;
- [ ] renderizar barra de abas;
- [ ] renderizar painéis-base;
- [ ] implementar `analiseSwitchTab(aba)`;
- [ ] implementar `analiseRenderAbaAtiva()`;
- [ ] ligar clique das abas ao estado interno.

### 19.9 Checklist da aba Acumulado

- [ ] implementar `analiseRenderAcumulado()`;
- [ ] implementar filtros da aba;
- [ ] implementar `analiseKpisAcumulado()`;
- [ ] implementar `analiseCardsNucleo()`;
- [ ] implementar `analiseGraficoMargemNucleo()`;
- [ ] implementar `analiseGraficoDistribuicaoHoras()`;
- [ ] implementar `analiseTabelaAcumulado()`;
- [ ] implementar `analiseFiltrarAcumulado()`;
- [ ] implementar `analiseOrdenarProdutos()`;
- [ ] validar clique na linha para `abrirProduto(id)`.

### 19.10 Checklist da aba Em Desenvolvimento

- [ ] implementar `analiseRenderDesenvolvimento()`;
- [ ] implementar `analiseKpisDesenvolvimento()`;
- [ ] implementar `analiseGraficoEtapasStatus()`;
- [ ] implementar `analiseGraficoBudgetUtilizacao()`;
- [ ] implementar `analiseTabelaEtapasEmCurso()`;
- [ ] implementar `analiseSecaoRisco()`;
- [ ] implementar `analiseFiltrarDesenvolvimento()`;
- [ ] implementar `analiseEditarBudget(etapaId, valor)`;
- [ ] persistir atualização de `budget_horas` no Supabase;
- [ ] atualizar memória local após edição;
- [ ] atualizar DOM da linha de forma cirúrgica;
- [ ] exibir `toast()` de sucesso e erro.

### 19.11 Checklist da aba Encerrados

- [ ] implementar `analiseRenderEncerrados()`;
- [ ] implementar `analiseListaEncerrados()`;
- [ ] implementar `analiseGraficoMargemHistorico()`;
- [ ] implementar `analiseAbrirIsolado(produtoId)`;
- [ ] implementar `analiseFecharIsolado()`;
- [ ] implementar `analiseRenderAnaliseIsolada(produtoId)`;
- [ ] implementar `analiseGraficoEtapasPrevReal()`;
- [ ] implementar `analiseTimelinePlanejadoReal()`;
- [ ] implementar `analiseFiltrarEncerrados()`;
- [ ] validar ocultação e restauração dos filtros na visão isolada.

### 19.12 Checklist da aba Por Pessoa

- [ ] implementar `analiseRenderPessoas()`;
- [ ] renderizar estado "em desenvolvimento";
- [ ] reservar estrutura para futura expansão sem quebrar navegação.

### 19.13 Checklist de gráficos SVG

- [ ] implementar `analiseSvgBar()`;
- [ ] implementar `analiseSvgDonut()`;
- [ ] implementar `analiseSvgBarsAgrupadas()`;
- [ ] implementar `analiseSvgBarraEmpilhada()`;
- [ ] implementar linha de referência para threshold quando aplicável;
- [ ] usar apenas variáveis CSS e cores semânticas;
- [ ] adicionar `<title>` em elementos interativos;
- [ ] validar legibilidade em light mode;
- [ ] validar legibilidade em dark mode.

### 19.14 Checklist de utilitários internos

- [ ] implementar `analiseClassificarMargem()`;
- [ ] implementar `analiseBarraSegmentada()`;
- [ ] implementar `analiseAvatarResponsavel()`;
- [ ] implementar `analiseBadgeNucleo()`;
- [ ] implementar `analiseFormatarPrazo()`;
- [ ] implementar `analiseBarSimples()`.

### 19.15 Checklist de estados e feedback

- [ ] implementar estado de carregamento inicial;
- [ ] implementar estado sem dados;
- [ ] implementar estado de erro;
- [ ] implementar aviso para usuários sem `valor_hora`;
- [ ] implementar feedback visual após salvar budget;
- [ ] implementar botão `Atualizar` com reload completo.

### 19.16 Checklist de segurança e permissões

- [ ] validar role no bootstrap de `analise.html`;
- [ ] ocultar entrada de navegação para não-sócios;
- [ ] impedir renderização de dados para não-sócios;
- [ ] restringir ação de configuração para `socio_admin`;
- [ ] restringir update de `budget_horas` no banco por RLS;
- [ ] revisar possibilidade de acesso direto via URL.

### 19.17 Checklist de qualidade visual

- [ ] revisar spacing geral;
- [ ] revisar alinhamento dos cards;
- [ ] revisar densidade da tabela;
- [ ] revisar contraste dos estados de margem;
- [ ] revisar responsividade até `900px`;
- [ ] revisar responsividade até `600px`;
- [ ] revisar painéis em light mode;
- [ ] revisar painéis em dark mode;
- [ ] revisar SVGs em dark mode;
- [ ] revisar input de budget em foco, blur e erro.

### 19.18 Checklist de testes funcionais

- [ ] testar login com `socio_admin`;
- [ ] testar login com `socio`;
- [ ] testar login com `coordenador`;
- [ ] testar login com `colaborador`;
- [ ] testar projeto com `valor_contratado`;
- [ ] testar projeto sem `valor_contratado`;
- [ ] testar etapa com `budget_horas`;
- [ ] testar etapa sem `budget_horas`;
- [ ] testar usuário sem `historico_valor_hora`;
- [ ] testar produto com muitas horas lançadas;
- [ ] testar troca rápida de abas;
- [ ] testar atualização manual de dados;
- [ ] testar edição válida de budget;
- [ ] testar edição inválida de budget;
- [ ] testar projeto encerrado com análise isolada.

### 19.19 Checklist de performance

- [ ] validar tempo de primeira carga;
- [ ] validar reabertura com cache;
- [ ] medir peso de render da tabela de projetos;
- [ ] medir peso de render da tabela de etapas;
- [ ] medir custo de geração dos SVGs;
- [ ] revisar necessidade de memoização simples ou cache derivado;
- [ ] registrar hipótese de view materializada se volume crescer.

### 19.20 Checklist de fechamento de `v1.0`

- [ ] `analise.html` abre sem depender de `gestao.html`;
- [ ] todas as 4 abas renderizam;
- [ ] `Acumulado`, `Em Desenvolvimento` e `Encerrados` estão funcionais;
- [ ] `Por Pessoa` aparece como placeholder estável;
- [ ] edição de `budget_horas` funciona de ponta a ponta;
- [ ] acesso por role está protegido;
- [ ] dark mode está íntegro;
- [ ] edge cases principais não quebram a UI;
- [ ] spec e implementação estão alinhados;
- [ ] roadmap de `v1.1` está pronto para começar.

---

## 20. Plano de Execução por Sprint

Esta seção organiza a implementação em sprints operacionais, com escopo fechado, ordem de execução e fluxo de trabalho recomendado. A meta é reduzir ambiguidade e evitar que o time comece a codar por vários pontos ao mesmo tempo.

### 20.1 Premissas do plano

- cada sprint deve terminar com algo demonstrável;
- não iniciar sprint seguinte com dependências abertas do sprint anterior;
- não misturar evolução de produto (`v1.1`, `v1.2`) com estabilização da base de `v1.0`;
- priorizar primeiro infraestrutura correta, depois tela, depois cálculo, depois refinamento.

### 20.2 Cadência sugerida

Assumindo sprints curtos de 1 semana ou equivalente:

| Sprint | Meta | Saída esperada |
|---|---|---|
| 0 | Preparação técnica | base compartilhada e decisões fechadas |
| 1 | Entry point independente | `analise.html` abre com shell e acesso controlado |
| 2 | Carga e agregação | dados reais carregam e são agregados corretamente |
| 3 | Aba Acumulado | primeira visão completa do módulo |
| 4 | Aba Em Desenvolvimento | budget, risco e operação ativa |
| 5 | Aba Encerrados | histórico e análise isolada |
| 6 | Estabilização `v1.0` | segurança, edge cases, dark mode e performance |
| 7 | Camada preditiva `v1.1` | progresso, projeção e alertas |
| 8 | Gargalos `v1.2-a` | aging, WIP, throughput |
| 9 | Aprendizado `v1.2` | causa de desvio e post-mortem |

### 20.3 Fluxo macro de implementação

O fluxo recomendado é este:

1. extrair dependências compartilhadas;
2. criar entrypoint `analise.html`;
3. validar bootstrap e acesso;
4. carregar e agregar dados;
5. entregar primeira aba forte (`Acumulado`);
6. entregar aba operacional (`Em Desenvolvimento`);
7. entregar leitura histórica (`Encerrados`);
8. estabilizar `v1.0`;
9. só depois adicionar previsão, gargalo e aprendizado.

### 20.4 Sprint 0 — Preparação técnica

**Objetivo**
- limpar dependências e fechar decisões que podem travar a implementação.

**Escopo**
- confirmar localização dos arquivos novos;
- mapear dependências hoje presas a `gestao.html`;
- decidir se haverá `shared/` novo ou reaproveitado;
- validar contrato de `appShellInit()`;
- validar acesso por role;
- validar conceito de margem da `v1.0`;
- validar `budget_horas` no banco;
- levantar lacunas de dados.

**Implementar nesta ordem**
1. mapear helpers e constantes reutilizáveis;
2. mapear fontes de dados necessárias;
3. mapear bootstrap atual da plataforma;
4. decidir estrutura de diretórios;
5. registrar decisões no spec.

**Definição de pronto**
- o time sabe exatamente que arquivos vai criar;
- está claro o que será extraído de `gestao.html`;
- não existe dúvida sobre acesso, dados mínimos e conceito de margem.

### 20.5 Sprint 1 — Entry point independente

**Objetivo**
- colocar `analise.html` no ar como página autônoma.

**Escopo**
- criar `analise.html`;
- criar `analise.css`;
- criar `analise.js`;
- implementar `analiseBootstrap()`;
- implementar `analiseValidarAcesso()`;
- renderizar shell base;
- ligar navegação principal para sócios.

**Fluxo de implementação**
1. criar arquivo `analise.html`;
2. montar `<head>` e imports;
3. montar `<main id="page-analise">`;
4. criar `analise.css` com layout base;
5. criar `analise.js` com bootstrap;
6. bloquear acesso de não-sócios;
7. conectar entrada de navegação.

**Não fazer neste sprint**
- queries reais complexas;
- gráficos finais;
- tabelas completas;
- edição de budget.

**Definição de pronto**
- `analise.html` abre;
- sócios acessam;
- não-sócios são bloqueados;
- layout base aparece sem erro JS.

### 20.6 Sprint 2 — Carga e agregação

**Objetivo**
- garantir que o módulo lê e calcula corretamente sua base.

**Escopo**
- implementar `appShellInit()` se necessário;
- carregar `G.usuario`, `G.todosProdutos`, `G.todasEtapas`, `G.todosUsuarios`;
- implementar `analiseCarregarDados()`;
- implementar `analiseAgregarDados()`;
- montar `_vhPorUser`;
- validar cache de 5 minutos;
- renderizar loading, empty e erro.

**Fluxo de implementação**
1. fechar dependências compartilhadas;
2. implementar carga paralela das tabelas;
3. montar estruturas brutas em `ANALISE`;
4. agregar por produto;
5. agregar por etapa;
6. validar edge cases principais;
7. criar logs e estados de erro.

**Definição de pronto**
- console mostra agregados coerentes;
- cache funciona;
- produtos sem contrato e usuários sem valor/hora não quebram a tela.

### 20.7 Sprint 3 — Aba Acumulado

**Objetivo**
- entregar a primeira visão gerencial completa e confiável.

**Escopo**
- filtros da aba;
- KPIs gerais;
- cards por núcleo;
- gráfico de margem por núcleo;
- gráfico de distribuição de horas;
- tabela de projetos;
- ordenação e abertura de projeto.

**Fluxo de implementação**
1. renderizar header da aba;
2. renderizar filtros;
3. renderizar KPIs;
4. renderizar cards de núcleo;
5. implementar `analiseSvgBar()` e `analiseSvgDonut()`;
6. renderizar gráficos;
7. renderizar tabela;
8. conectar filtros e ordenação.

**Definição de pronto**
- sócio consegue entender faturamento, custo, margem e distribuição de horas sem abrir console;
- os filtros alteram os dados renderizados corretamente.

### 20.8 Sprint 4 — Aba Em Desenvolvimento

**Objetivo**
- entregar a principal superfície de gestão ativa da operação.

**Escopo**
- KPIs de projetos ativos;
- gráfico de etapas por status;
- gráfico de budget por etapa;
- tabela de etapas em curso;
- edição inline de `budget_horas`;
- seção de risco;
- feedback de sucesso e erro.

**Fluxo de implementação**
1. renderizar KPIs;
2. implementar gráfico de status;
3. implementar gráfico de utilização de budget;
4. renderizar tabela de etapas;
5. implementar listener de budget;
6. persistir update no banco;
7. atualizar memória local;
8. atualizar DOM da linha;
9. renderizar seção de risco.

**Definição de pronto**
- edição de budget funciona ponta a ponta;
- o usuário enxerga quais etapas estão mais pressionadas;
- a aba passa a servir para acompanhamento semanal.

### 20.9 Sprint 5 — Aba Encerrados

**Objetivo**
- fechar a leitura retrospectiva e comparativa do módulo.

**Escopo**
- lista de encerrados;
- gráfico histórico de margem;
- filtros da aba;
- abertura de análise isolada;
- gráfico previsto x realizado por etapa;
- timeline planejado x real;
- botão voltar da visão isolada.

**Fluxo de implementação**
1. renderizar lista e filtros;
2. implementar gráfico histórico;
3. implementar clique para visão isolada;
4. renderizar KPIs do projeto encerrado;
5. implementar barras agrupadas;
6. implementar timeline;
7. validar retorno para lista sem perder estado.

**Definição de pronto**
- sócios conseguem comparar projetos encerrados;
- a análise isolada explica bem o comportamento de um projeto específico.

### 20.10 Sprint 6 — Estabilização `v1.0`

**Objetivo**
- consolidar qualidade antes de subir a sofisticação do módulo.

**Escopo**
- testes por role;
- revisão de RLS;
- revisão de dark mode;
- revisão de mobile mínimo;
- ajuste de layout;
- tratamento de edge cases;
- revisão de performance;
- limpeza de código e alinhamento final com o spec.

**Fluxo de implementação**
1. testar acesso com todos os perfis;
2. testar edge cases de dados;
3. testar budget inline;
4. revisar gráficos em light/dark;
5. revisar tabelas e spacing;
6. revisar performance com dataset real;
7. corrigir inconsistências finais.

**Definição de pronto**
- `v1.0` pode ser usada por sócios sem supervisão técnica constante;
- principais casos anômalos estão tratados.

### 20.11 Sprint 7 — Camada preditiva (`v1.1`)

**Objetivo**
- deixar o módulo capaz de apontar risco antes do encerramento.

**Escopo**
- adicionar `progresso_pct`;
- adicionar margem projetada;
- adicionar custo projetado final;
- adicionar `PV`, `EV`, `AC`, `CPI`, `SPI`;
- atualizar KPIs e alertas com projeção;
- mover config de margem para persistência global, se aprovado.

**Fluxo de implementação**
1. adicionar campo(s) necessários no modelo;
2. ajustar carga;
3. ajustar agregação;
4. ajustar classificações de risco;
5. ajustar gráficos e tabelas;
6. validar linguagem de UI para não ficar técnica demais.

**Definição de pronto**
- o módulo aponta risco futuro, não apenas desvio passado.

### 20.12 Sprint 8 — Gargalos (`v1.2-a`)

**Objetivo**
- tornar visível onde o fluxo do escritório trava.

**Escopo**
- `agingDias`;
- `leadTimeDias`;
- `cycleTimeDias`;
- WIP por núcleo e pessoa;
- throughput do período;
- seção `Gargalos agora`.

**Fluxo de implementação**
1. validar timestamps disponíveis;
2. calcular métricas de fluxo;
3. definir cortes de alerta;
4. criar visualizações;
5. validar utilidade com casos reais.

**Definição de pronto**
- o módulo mostra claramente fila, espera e acúmulo.

### 20.13 Sprint 9 — Aprendizado (`v1.2`)

**Objetivo**
- transformar perda de margem em memória operacional do escritório.

**Escopo**
- taxonomia de desvio;
- motivo principal e secundário;
- post-mortem curto;
- `bridge de margem`;
- filtros por causa.

**Fluxo de implementação**
1. fechar taxonomia;
2. criar estrutura de dados;
3. adicionar captura de causa;
4. adicionar visualização na aba Encerrados;
5. testar se a leitura realmente ajuda decisão comercial e operacional.

**Definição de pronto**
- cada projeto ruim gera aprendizado reutilizável.

### 20.14 Regras de handoff entre sprints

Um sprint só passa para o próximo quando:

- build e navegação básica estão estáveis;
- principais cenários de teste do sprint estão validados;
- spec foi atualizado se houve decisão nova;
- não existem TODOs estruturais escondidos no código;
- o time consegue demonstrar a entrega sem depender de explicação oral longa.

### 20.15 Fluxo de implementação dentro de cada sprint

Dentro de cada sprint, seguir esta sequência:

1. fechar escopo do sprint;
2. criar ou ajustar estrutura de dados;
3. implementar carga e transformação;
4. implementar render;
5. implementar eventos;
6. validar permissões;
7. testar edge cases;
8. revisar visual;
9. atualizar spec se necessário.

### 20.16 Estratégia recomendada de branch e validação

- uma branch por sprint ou feature principal;
- PRs pequenos por bloco quando possível;
- validar com dataset real antes de considerar pronto;
- registrar divergências entre spec e realidade imediatamente.

### 20.17 Ordem recomendada para começarmos a implementação

Se a implementação começar agora, a ordem sugerida é:

1. Sprint 0: revisar código atual e extrair dependências compartilhadas.
2. Sprint 1: criar `analise.html`, `analise.css` e `analise.js` com shell.
3. Sprint 2: implementar carga, cache e agregação.
4. Sprint 3: fechar `Acumulado`.
5. Sprint 4: fechar `Em Desenvolvimento`.
6. Sprint 5: fechar `Encerrados`.
7. Sprint 6: estabilizar `v1.0`.

Este é o ponto ideal para começarmos a codar sem abrir frentes demais ao mesmo tempo.

### 20.18 Resultado do Sprint 0

O Sprint 0 foi iniciado com leitura do código atual da plataforma e produziu as decisões concretas abaixo.

#### 20.18.1 Diagnóstico confirmado

- não existe hoje uma pasta `shared/` pronta para desktop;
- `gestao.html` ainda possui bootstrap próprio de sessão, shell, navegação, carga de dados e utilitários;
- o contrato canônico de sessão mais maduro está em `app.html` e na documentação de shell da pasta `revisão/`;
- existe duplicação de regras de role e sessão em vários módulos;
- `analise.html` não deve nascer copiando o bootstrap de `gestao.html`, porque isso perpetuaria esse acoplamento.

#### 20.18.2 Fontes canônicas identificadas

**Sessão e shell**
- referência principal: `app.html`
- referência documental: `revisão/contrato-canonico-sessao-exp-usuario.md`
- referência documental de navegação: `revisão/contrato-canonico-nav-compartilhada.md`

**Dados e utilitários de negócio**
- referência principal: `gestao.html`

#### 20.18.3 Contrato de sessão adotado para `analise.html`

`analise.html` deve partir do contrato canônico de `sessionStorage['exp_usuario']`, com estes campos mínimos:

- `auth_id`
- `app_user_id`
- `nome`
- `apelido`
- `iniciais`
- `cor`
- `role`
- `viewer_only`
- `is_platform_manager`
- `can_coordinate_projects`
- `termo_status`
- `termo_assinado_em`
- `termo_expira_em`
- `status_acesso`

Este contrato já está documentado e é mais consistente que o bootstrap isolado hoje existente em `gestao.html`.

#### 20.18.4 Regra de role consolidada

O papel canônico de administrador societário deve ser `socio_admin`.

Durante a transição, checks de frontend devem aceitar:
- `socio`
- `socio_admin`
- `socio_adm` (alias legado)

Mas novas gravações, novos formulários e nova documentação devem preferir apenas `socio_admin`.

#### 20.18.5 Mapa de extração para camada compartilhada

**Extrair para `shared/app-shell.js`**
- criação e exposição de `window.sb`
- `buildExpUsuarioPayload()`
- `redirectToLogin()`
- `currentSessionUsuario()`
- `bootstrapAuthenticatedShell()`
- `bindSessionLifecycle()`
- publicação de `exp:session-ready`
- `isSocioRole()`

**Extrair para `shared/app-constants.js`**
- `NUCLEO_COR`
- `STATUS_ETAPA`
- labels de roles, se forem reutilizadas

**Extrair para `shared/app-utils.js`**
- `fmtDate()`
- `fmtNum()`
- `fmtH()`
- `fmtHLong()`
- `fmtHMin()`
- `fmtHClock()`
- `diffHoras()`
- `_escN()`
- `_sqN()`

#### 20.18.6 Itens que não devem ser extraídos como estão

Os itens abaixo estão acoplados demais ao DOM ou ao fluxo específico de Gestão e não devem ir para a camada compartilhada sem refatoração:

- `abrirProduto()` como está hoje
- `carregarProdutos()` como função de render e bootstrap de Gestão
- `init()` de `gestao.html`
- navegação por `.ntab` e `onTabChange()`
- qualquer função que escreva diretamente em selects, modais ou painéis de Gestão

#### 20.18.7 Reuso recomendado de lógica

Pode ser reaproveitada, com refatoração:

- a lógica de normalização de núcleo;
- a lógica de carga de `produtos`, `etapas` e `etapa_desenvolvedores`;
- a lógica de cálculo de horas por produto;
- a lógica de cálculo de custo/hora usada em visões societárias de Gestão;
- a classificação societária por role.

Não deve ser reaproveitada por cópia direta:

- a estrutura visual da nav de `gestao.html`;
- o bootstrap inteiro de sessão de `gestao.html`;
- o modal de projeto de `gestao.html`.

#### 20.18.8 Decisão de shell para o Sprint 1

No Sprint 1, `analise.html` deve seguir este desenho:

1. carregar `exp-design-system.css`;
2. carregar scripts compartilhados extraídos do shell;
3. executar `bootstrapAuthenticatedShell()` ou função equivalente;
4. validar `isSocioRole(G.usuario.role)`;
5. renderizar shell e estrutura própria do módulo;
6. só então iniciar carga analítica.

#### 20.18.9 Entregáveis concluídos do Sprint 0

- diagnóstico da arquitetura atual concluído;
- contrato de sessão canônico identificado;
- fonte mais madura de shell identificada;
- inconsistência de role identificada e normalizada no spec;
- mapa de extração para camada compartilhada definido;
- fronteira entre reutilização e acoplamento indevido explicitada.

#### 20.18.10 Pronto para o Sprint 1

Com base no Sprint 0, o próximo passo recomendado é:

1. criar a camada `shared/` para desktop;
2. extrair shell, utilitários e constantes mínimos;
3. criar `analise.html`, `analise.css` e `analise.js` com bootstrap independente.
