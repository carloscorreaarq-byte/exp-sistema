(function () {
  if (typeof ANALISE === 'undefined') return;

  function subtemaAtivo() {
    return (ANALISE && ANALISE._subtemaAtivo) || 'resumo';
  }

  function resumoHtml() {
    if (typeof analiseSubtemaResumoHtml === 'function') {
      return analiseSubtemaResumoHtml();
    }
    return '';
  }

  analiseRenderAcumulado = function analiseRenderAcumuladoSubtematico() {
    const panel = document.getElementById('anp-acumulado');
    if (!panel) return;

    if (ANALISE._carregando) {
      panel.innerHTML = analiseLoadingTemplate('Carregando projetos, horas, custos e valor/hora...');
      return;
    }
    if (ANALISE._erro) {
      panel.innerHTML = analiseErrorTemplate(ANALISE._erro);
      return;
    }

    const produtosBase = Object.values(ANALISE._dadosPorProduto);
    if (!produtosBase.length) {
      panel.innerHTML = analiseEmptyTemplate('Nenhum projeto elegível foi encontrado para a análise.');
      return;
    }

    const filtro = ANALISE._filtros.acumulado;
    const produtos = produtosBase
      .filter((item) => !filtro.nucleo || item.produto?.nucleo === filtro.nucleo)
      .filter((item) => !filtro.status || analiseProdutoStatusKey(item) === filtro.status)
      .filter((item) => !filtro.risco || (item.previsao?.riscoKey || 'incerto') === filtro.risco)
      .sort((a, b) => analiseOrdenarProdutosAcumulado(a, b, filtro.ordem));

    if (!produtos.length) {
      panel.innerHTML = `
        ${analiseFilterBar({
          aba: 'acumulado',
          controls: [
            { key: 'nucleo', label: 'Núcleo', value: filtro.nucleo, options: analiseNucleoOptions() },
            { key: 'status', label: 'Status', value: filtro.status, options: analiseStatusProdutoOptions(produtosBase) },
            { key: 'risco', label: 'Risco', value: filtro.risco, options: analiseRiscoOptions() },
            { key: 'ordem', label: 'Ordenar', value: filtro.ordem, options: analiseAcumuladoOrderOptions() },
          ],
        })}
        ${analiseEmptyTemplate('Nenhum projeto atende aos filtros atuais.')}
      `;
      return;
    }

    const contratadoTotal = produtos.reduce((sum, item) => sum + Math.max(0, Number(item.produto?.valor_contratado || 0)), 0);
    const custoTotal = produtos.reduce((sum, item) => sum + item.custoTotal, 0);
    const horasTotal = produtos.reduce((sum, item) => sum + item.horasTotais, 0);
    const margemPonderada = contratadoTotal > 0 ? ((contratadoTotal - custoTotal) / contratadoTotal) * 100 : null;
    const produtosComPrevisao = produtos.filter((item) => item.previsao?.margemProjetadaPct !== null);
    const margemProjetadaMedia = produtosComPrevisao.length
      ? produtosComPrevisao.reduce((sum, item) => sum + Number(item.previsao?.margemProjetadaPct || 0), 0) / produtosComPrevisao.length
      : null;
    const subtema = subtemaAtivo();
    const riscoProjetos = produtos.filter((item) => item.previsao?.riscoKey === 'risco');
    const atencaoProjetos = produtos.filter((item) => item.previsao?.riscoKey === 'atencao');

    panel.innerHTML = `
      ${analiseWarningsHtml()}
      ${resumoHtml()}
      <div class="analise-kpis-row">
        ${subtema === 'resumo' || subtema === 'rentabilidade' ? analiseKpiCard('Projetos na leitura', String(produtos.length), produtos.length === produtosBase.length ? 'Base completa elegível' : `${produtosBase.length} elegíveis no total`) : ''}
        ${subtema === 'resumo' || subtema === 'carga' ? analiseKpiCard('Horas lançadas', fmtH(horasTotal), 'Soma de horas com produto associado') : ''}
        ${subtema === 'resumo' || subtema === 'rentabilidade' || subtema === 'carga' ? analiseKpiCard('Custo total', analiseFmtMoney(custoTotal), 'HH + custos lançados') : ''}
        ${subtema === 'resumo' || subtema === 'rentabilidade' ? analiseKpiCardSemantic('Margem ponderada', analiseFmtPct(margemPonderada), 'Baseada em valor contratado conhecido', analiseMargemKpiCls(margemPonderada)) : ''}
        ${subtema === 'resumo' || subtema === 'rentabilidade' || subtema === 'risco' ? analiseKpiCardSemantic('Margem projetada média', analiseFmtPct(margemProjetadaMedia), 'Heurística inicial baseada em budget e estágio', analiseMargemKpiCls(margemProjetadaMedia)) : ''}
        ${subtema === 'risco' ? analiseKpiCard('Projetos em risco', String(riscoProjetos.length), `${atencaoProjetos.length} em atenção pela projeção atual`) : ''}
      </div>
      ${analiseFilterBar({
        aba: 'acumulado',
        controls: [
          { key: 'nucleo', label: 'Núcleo', value: filtro.nucleo, options: analiseNucleoOptions() },
          { key: 'status', label: 'Status', value: filtro.status, options: analiseStatusProdutoOptions(produtosBase) },
          { key: 'risco', label: 'Risco', value: filtro.risco, options: analiseRiscoOptions() },
          { key: 'ordem', label: 'Ordenar', value: filtro.ordem, options: analiseAcumuladoOrderOptions() },
        ],
      })}
      <div class="analise-visual-grid">
        ${(subtema === 'resumo' || subtema === 'rentabilidade') ? `<section class="analise-visual-card"><div class="analise-visual-title">Margem por núcleo</div>${analiseGraficoMargemPorNucleo(produtos)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'risco' || subtema === 'carga') ? `<section class="analise-visual-card"><div class="analise-visual-title">Status dos projetos</div>${analiseGraficoStatusProjetos(produtos)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'rentabilidade' || subtema === 'carga') ? `<section class="analise-visual-card"><div class="analise-visual-title">Contrato x custo</div>${analiseGraficoContratoVsCusto(contratadoTotal, custoTotal)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'risco') ? `<section class="analise-visual-card"><div class="analise-visual-title">Risco projetado</div>${analiseGraficoRiscoProjetado(produtos)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'rentabilidade' || subtema === 'risco') ? `<section class="analise-visual-card analise-visual-card-wide"><div class="analise-visual-title">Prioridades da leitura</div>${analiseListaPrioridadesProjeto(produtos, subtema === 'risco')}</section>` : ''}
      </div>
      ${(subtema === 'resumo' || subtema === 'carga') ? `<div class="analise-state-grid">${analiseResumoNucleos(produtos)}</div>` : ''}
      <div class="analise-table-wrap">
        <table class="analise-table analise-table-projects">
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Núcleo</th>
              <th>Status</th>
              <th>Risco proj.</th>
              <th>Margem proj.</th>
              <th>Delta proj.</th>
              <th>Horas</th>
              <th>Custo total</th>
              <th>Contratado</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            ${produtos.map((item) => analiseLinhaProduto(item)).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  analiseRenderDesenvolvimento = function analiseRenderDesenvolvimentoSubtematico() {
    const panel = document.getElementById('anp-desenvolvimento');
    if (!panel) return;

    if (ANALISE._carregando) {
      panel.innerHTML = analiseLoadingTemplate('Carregando etapas em desenvolvimento...');
      return;
    }
    if (ANALISE._erro) {
      panel.innerHTML = analiseErrorTemplate(ANALISE._erro);
      return;
    }

    const filtro = ANALISE._filtros.desenvolvimento;
    const etapas = Object.values(ANALISE._dadosPorEtapa)
      .map((item) => ({
        ...item,
        produto: ANALISE._dadosPorProduto[String(item.etapa?.produto_id)]?.produto || null,
        produtoRegistro: ANALISE._dadosPorProduto[String(item.etapa?.produto_id)] || null,
      }))
      .filter((item) => ['em_andamento', 'em_revisao'].includes(item.etapa?.status))
      .filter((item) => !filtro.nucleo || item.produto?.nucleo === filtro.nucleo)
      .filter((item) => !filtro.statusEtapa || item.etapa?.status === filtro.statusEtapa)
      .filter((item) => !filtro.risco || (item.produtoRegistro?.previsao?.riscoKey || 'incerto') === filtro.risco);

    const comBudget = etapas.filter((item) => analiseGetBudgetHoras(item.etapa) > 0);
    const acimaBudget = comBudget.filter((item) => Number(item.utilizacaoBudget || 0) > 100);
    const rowsProjeto = analiseAgruparEtapasAtivasPorProjeto(etapas)
      .sort((a, b) => analiseOrdenarProjetosDesenvolvimento(a, b, filtro.ordem));
    const projetosEmRisco = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'risco');
    const projetosAtencao = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'atencao');
    const projetosSaudavel = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'saudavel');
    const subtema = subtemaAtivo();

    panel.innerHTML = `
      ${resumoHtml()}
      ${subtema === 'resumo' || subtema === 'risco' ? analiseSemaforoCompacto([
        { key: 'risco', label: 'Risco', count: projetosEmRisco.length },
        { key: 'atencao', label: 'Atenção', count: projetosAtencao.length },
        { key: 'saudavel', label: 'Saudável', count: projetosSaudavel.length },
      ]) : ''}
      <div class="analise-kpis-row">
        ${subtema === 'resumo' || subtema === 'carga' ? analiseKpiCard('Etapas ativas', String(etapas.length), 'Em andamento ou em revisão') : ''}
        ${subtema === 'resumo' || subtema === 'carga' || subtema === 'rentabilidade' ? analiseKpiCard('Com budget', String(comBudget.length), 'Etapas com budget carregado') : ''}
        ${subtema === 'resumo' || subtema === 'carga' || subtema === 'rentabilidade' ? analiseKpiCard('Acima do budget', String(acimaBudget.length), 'Utilização acima de 100%') : ''}
        ${subtema === 'resumo' || subtema === 'rentabilidade' ? analiseKpiCard('Projetos em execução', String(rowsProjeto.length), 'Com pelo menos uma etapa ativa') : ''}
        ${subtema === 'resumo' || subtema === 'risco' ? analiseKpiCard('Risco projetado', String(projetosEmRisco.length), `${projetosAtencao.length} em atenção pela projeção atual`) : ''}
      </div>
      ${analiseFilterBar({
        aba: 'desenvolvimento',
        controls: [
          { key: 'nucleo', label: 'Núcleo', value: filtro.nucleo, options: analiseNucleoOptions() },
          {
            key: 'statusEtapa',
            label: 'Status da etapa',
            value: filtro.statusEtapa,
            options: [
              { value: '', label: 'Todos' },
              { value: 'em_andamento', label: STATUS_ETAPA.em_andamento?.label || 'Em andamento' },
              { value: 'em_revisao', label: STATUS_ETAPA.em_revisao?.label || 'Em revisão' },
            ],
          },
          { key: 'risco', label: 'Risco', value: filtro.risco, options: analiseRiscoOptions() },
          {
            key: 'agrupamento',
            label: 'Agrupar por',
            value: filtro.agrupamento,
            options: [
              { value: 'projeto', label: 'Projeto' },
              { value: 'etapa', label: 'Etapa' },
            ],
          },
          { key: 'ordem', label: 'Ordenar', value: filtro.ordem, options: analiseDesenvolvimentoOrderOptions() },
        ],
      })}
      <div class="analise-visual-grid">
        ${(subtema === 'resumo' || subtema === 'carga') ? `<section class="analise-visual-card"><div class="analise-visual-title">Etapas ativas por status</div>${analiseGraficoStatusEtapasAtivas(etapas)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'carga' || subtema === 'rentabilidade') ? `<section class="analise-visual-card"><div class="analise-visual-title">Uso de budget ativo</div>${analiseGraficoResumoBudgetAtivo(etapas)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'carga') ? `<section class="analise-visual-card"><div class="analise-visual-title">Carga por núcleo</div>${analiseGraficoCargaNucleoAtivo(etapas)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'risco') ? `<section class="analise-visual-card"><div class="analise-visual-title">Semáforo de risco ativo</div>${analiseGraficoSemaforoProjetos(rowsProjeto)}</section>` : ''}
        ${(subtema === 'resumo' || subtema === 'risco') ? `<section class="analise-visual-card analise-visual-card-wide"><div class="analise-visual-title">Projetos que pedem atenção</div>${analiseListaPrioridadesProjeto(rowsProjeto.map((row) => row.produtoRegistro).filter(Boolean), true)}</section>` : ''}
      </div>
      <div class="analise-table-wrap">
        ${filtro.agrupamento === 'etapa'
          ? analiseTabelaDesenvolvimentoEtapa(etapas)
          : analiseTabelaDesenvolvimentoProjeto(rowsProjeto)}
      </div>
    `;
  };
})();
