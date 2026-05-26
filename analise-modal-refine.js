(function () {
  if (typeof window === 'undefined' || typeof analiseToggleModal !== 'function') return;

  function analiseRiscoLabelSeguro(riscoKey) {
    if (riscoKey === 'risco') return 'Em risco';
    if (riscoKey === 'atencao') return 'Atenção';
    if (riscoKey === 'saudavel') return 'Saudável';
    return 'Incerto';
  }

  function analiseConfiancaLabelSegura(previsao) {
    const cobertura = Number(previsao?.coberturaBudget || 0);
    if (cobertura >= 0.8) return 'Alta';
    if (cobertura >= 0.45) return 'Média';
    return 'Baixa';
  }

  function analiseProjetoResumoExecutivo(item, budgetHoras, budgetUtil, delta) {
    const previsao = item.previsao || {};
    const riscoLabel = analiseRiscoLabelSeguro(previsao.riscoKey);
    const confianca = analiseConfiancaLabelSegura(previsao);
    const etapasEstouradas = Number(previsao.etapasEstouradas || 0);
    const etapasSemBudget = Number(previsao.etapasSemBudget || 0);

    if (previsao.riscoKey === 'risco') {
      return `O projeto entra em leitura de ${riscoLabel.toLowerCase()} porque a margem projetada cai para ${analiseFmtPct(previsao.margemProjetadaPct)} e já existem ${etapasEstouradas} etapa(s) acima do budget.`;
    }
    if (previsao.riscoKey === 'atencao') {
      return `A projeção ainda preserva margem, mas o projeto pede atenção: a leitura futura aponta ${analiseFmtPct(previsao.margemProjetadaPct)} de margem e ${delta === null ? 'sem delta consolidado' : `queda de ${analiseFmtPct(delta)}`}.`;
    }
    if (previsao.riscoKey === 'saudavel') {
      return `A leitura atual indica um projeto saudável, com margem projetada de ${analiseFmtPct(previsao.margemProjetadaPct)} e cobertura de budget em ${analiseFmtPct((previsao.coberturaBudget || 0) * 100)}.`;
    }
    if (budgetHoras <= 0 || etapasSemBudget > 0) {
      return `Ainda existe baixa confiabilidade para projetar o fechamento. Hoje ${etapasSemBudget} etapa(s) seguem sem budget carregado e a confiança da leitura está em ${confianca.toLowerCase()}.`;
    }
    return 'A projeção do projeto ainda depende de mais cobertura de budget e avanço operacional para ficar estável.';
  }

  function analiseProjetoInsights(item, budgetHoras, budgetUtil, delta) {
    const previsao = item.previsao || {};
    const insights = [];

    if (delta !== null) {
      insights.push(`A margem projetada ${delta > 0 ? 'cai' : delta < 0 ? 'melhora' : 'se mantém'} ${analiseFmtPct(Math.abs(delta))} em relação à margem atual.`);
    }

    if (Number(previsao.etapasEstouradas || 0) > 0) {
      insights.push(`${previsao.etapasEstouradas} etapa(s) já consumiram mais horas do que o budget registrado.`);
    }

    if (Number(previsao.etapasSemBudget || 0) > 0) {
      insights.push(`${previsao.etapasSemBudget} etapa(s) seguem sem budget carregado, o que reduz a confiança da previsão.`);
    } else if (budgetHoras > 0 && budgetUtil !== null) {
      insights.push(`O projeto já utilizou ${analiseFmtPct(budgetUtil)} do budget consolidado disponível.`);
    }

    if (!insights.length) {
      insights.push('Ainda não existem sinais críticos suficientes para compor um diagnóstico automático mais forte.');
    }

    return insights.slice(0, 3);
  }

  function analiseProjetoEtapasCriticas(item) {
    const etapas = item.etapasDados || [];
    const criticas = etapas.map((etapaItem) => {
      const etapa = etapaItem.etapa || {};
      const budgetMeta = etapaItem.budgetMeta || analiseGetBudgetMeta(etapa);
      const uso = Number(etapaItem.utilizacaoBudget || 0);
      const horas = Number(etapaItem.horasTotais || 0);
      const status = etapa.status || 'nao_iniciada';
      let score = 0;
      let tone = '';
      let headline = '';
      let detail = '';

      if (budgetMeta.status === 'carregado' && uso > 100) {
        score = 4;
        tone = 'risco';
        headline = `Uso de budget em ${analiseFmtPct(uso)}`;
        detail = `${fmtH(horas)} lançadas para ${fmtH(budgetMeta.value)} previstas.`;
      } else if (budgetMeta.status === 'carregado' && uso >= 85) {
        score = 3;
        tone = 'atencao';
        headline = `Budget pressionado em ${analiseFmtPct(uso)}`;
        detail = `${fmtH(horas)} lançadas para ${fmtH(budgetMeta.value)} previstas.`;
      } else if (budgetMeta.status !== 'carregado' && horas > 0 && status !== 'concluida') {
        score = 2;
        tone = 'atencao';
        headline = 'Sem budget carregado';
        detail = `${fmtH(horas)} já lançadas sem referência orçada para a etapa.`;
      } else if (status === 'em_revisao' && horas > 0) {
        score = 1;
        headline = 'Etapa em revisão';
        detail = `${fmtH(horas)} lançadas enquanto a etapa segue em revisão.`;
      }

      return {
        score,
        tone,
        nome: etapa.nome || `Etapa ${etapa.ordem || 'N/D'}`,
        status,
        headline,
        detail,
      };
    }).filter((itemCritico) => itemCritico.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (!criticas.length) {
      return '<div class="empty-note">Nenhuma etapa crítica se destacou na leitura atual do projeto.</div>';
    }

    return `
      <div class="analise-critical-list">
        ${criticas.map((critica) => `
          <article class="analise-critical-item ${critica.tone}">
            <div class="analise-table-main">${_escN(critica.nome)}</div>
            <div class="analise-table-sub">${analiseStatusEtapaBadge(critica.status)}</div>
            <div class="analise-table-main" style="margin-top:8px">${_escN(critica.headline)}</div>
            <div class="analise-table-sub">${_escN(critica.detail)}</div>
          </article>
        `).join('')}
      </div>
    `;
  }

  analiseRiscoBadgeHtml = function analiseRiscoBadgeHtmlRefinado(previsao) {
    const riscoKey = previsao?.riscoKey || 'incerto';
    return `<span class="${analiseRiscoChipClass(riscoKey)}">${_escN(analiseRiscoLabelSeguro(riscoKey))}</span>`;
  };

  analiseTabelaDetalheEtapas = function analiseTabelaDetalheEtapasRefinada(item) {
    const etapas = item.etapasDados || [];
    if (!etapas.length) {
      return analiseEmptyTemplate('Este projeto ainda não possui etapas vinculadas para leitura detalhada.');
    }

    return `
      <table class="analise-table">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Status</th>
            <th>Horas</th>
            <th>Budget</th>
            <th>Uso do budget</th>
            <th>Custo HH</th>
            <th>Custo total</th>
            <th>Conclusão</th>
          </tr>
        </thead>
        <tbody>
          ${etapas.map((etapaItem) => `
            <tr>
              <td>
                <div class="analise-table-main">${_escN(etapaItem.etapa?.nome || `Etapa ${etapaItem.etapa?.ordem || 'N/D'}`)}</div>
                <div class="analise-table-sub">${_escN(Number(etapaItem.etapa?.ordem || 0) > 0 ? `Ordem ${etapaItem.etapa.ordem}` : 'Sem ordem definida')}</div>
              </td>
              <td>${analiseStatusEtapaBadge(etapaItem.etapa?.status)}</td>
              <td>${_escN(fmtH(etapaItem.horasTotais))}</td>
              <td>${analiseBudgetCell(etapaItem.budgetMeta || analiseGetBudgetMeta(etapaItem.etapa))}</td>
              <td>${analiseBudgetBadge(etapaItem.utilizacaoBudget, etapaItem.budgetMeta || analiseGetBudgetMeta(etapaItem.etapa))}</td>
              <td>${_escN(analiseFmtMoney(etapaItem.custoHH))}</td>
              <td>${_escN(analiseFmtMoney(etapaItem.custoTotal))}</td>
              <td>${_escN(etapaItem.etapa?.data_conclusao ? fmtDate(etapaItem.etapa.data_conclusao) : 'N/D')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  analiseGraficoMargemProjeto = function analiseGraficoMargemProjetoRefinado(item) {
    const contratado = Number(item.produto?.valor_contratado || 0);
    if (contratado <= 0) {
      return '<div class="empty-note">Sem valor contratado conhecido para calcular a leitura visual da margem.</div>';
    }

    const custo = Number(item.custoTotal || 0);
    const margem = contratado - custo;
    const custoPct = Math.max(0, Math.min(100, (custo / contratado) * 100));
    const margemPct = Math.max(-100, Math.min(100, Number(item.margemPct || 0)));
    const status = analiseClassificarMargem(item.margemPct);
    const corMargem = status.cls === 'margem-risco'
      ? 'var(--terracota)'
      : status.cls === 'margem-atencao'
        ? 'var(--ouro)'
        : 'var(--verde)';

    return `
      <div class="analise-chart-copy">Quanto do contrato já foi consumido pelo custo e qual espaço de margem ainda existe hoje.</div>
      <svg class="analise-svg-chart" viewBox="0 0 320 120" aria-label="Gráfico de margem do projeto">
        <rect x="16" y="46" width="288" height="20" rx="10" fill="var(--off)"></rect>
        <rect x="16" y="46" width="${(288 * custoPct) / 100}" height="20" rx="10" fill="var(--grafite)"></rect>
        <text x="16" y="28" class="svg-label">Contrato</text>
        <text x="304" y="28" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(contratado))}</text>
        <text x="16" y="92" class="svg-label">Custo consumido</text>
        <text x="304" y="92" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(custo))}</text>
        <text x="16" y="110" class="svg-label">Margem atual</text>
        <text x="304" y="110" text-anchor="end" class="svg-value" fill="${corMargem}">${_escN(analiseFmtPct(margemPct))} | ${_escN(analiseFmtMoney(margem, margem === null))}</text>
      </svg>
    `;
  };

  analiseGraficoCustosProjeto = function analiseGraficoCustosProjetoRefinado(item) {
    const custoHH = Number(item.custoHH || 0);
    const custoExtra = Number(item.custosLancados || 0);
    const total = custoHH + custoExtra;
    if (total <= 0) {
      return '<div class="empty-note">Ainda não há custo registrado para compor o gráfico.</div>';
    }
    const hhPct = (custoHH / total) * 100;
    const extraPct = (custoExtra / total) * 100;

    return `
      <div class="analise-chart-copy">Separação entre custo de horas trabalhadas e demais lançamentos financeiros.</div>
      <svg class="analise-svg-chart" viewBox="0 0 320 140" aria-label="Composição do custo do projeto">
        <rect x="16" y="42" width="288" height="24" rx="12" fill="var(--off)"></rect>
        <rect x="16" y="42" width="${(288 * hhPct) / 100}" height="24" rx="12" fill="var(--grafite)"></rect>
        <rect x="${16 + (288 * hhPct) / 100}" y="42" width="${(288 * extraPct) / 100}" height="24" rx="12" fill="var(--terracota)"></rect>
        <circle cx="22" cy="94" r="5" fill="var(--grafite)"></circle>
        <text x="34" y="98" class="svg-label">HH: ${_escN(analiseFmtMoney(custoHH))}</text>
        <circle cx="170" cy="94" r="5" fill="var(--terracota)"></circle>
        <text x="182" y="98" class="svg-label">Custos: ${_escN(analiseFmtMoney(custoExtra))}</text>
        <text x="16" y="26" class="svg-label">Custo total</text>
        <text x="304" y="26" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(total))}</text>
        <text x="16" y="122" class="svg-label">Peso HH ${_escN(analiseFmtPct(hhPct))}</text>
        <text x="304" y="122" text-anchor="end" class="svg-label">Peso custos ${_escN(analiseFmtPct(extraPct))}</text>
      </svg>
    `;
  };

  analiseGraficoStatusEtapas = function analiseGraficoStatusEtapasRefinado(item) {
    const etapas = item.etapasDados || [];
    if (!etapas.length) {
      return '<div class="empty-note">Sem etapas para leitura visual de status.</div>';
    }
    const total = etapas.length;
    const ordem = ['nao_iniciada', 'em_andamento', 'em_revisao', 'pausada', 'concluida'];
    const cores = {
      nao_iniciada: '#b8b8b8',
      em_andamento: '#5280CA',
      em_revisao: '#D19931',
      pausada: '#8f7f76',
      concluida: '#45865D',
    };

    let acumulado = 16;
    const segmentos = ordem.map((status) => {
      const qtd = etapas.filter((etapaItem) => etapaItem.etapa?.status === status).length;
      const width = total > 0 ? (288 * qtd) / total : 0;
      const segment = {
        status,
        qtd,
        x: acumulado,
        width,
        color: cores[status],
        label: STATUS_ETAPA[status]?.label || status,
      };
      acumulado += width;
      return segment;
    });

    return `
      <div class="analise-chart-copy">Distribuição das etapas do projeto ao longo do fluxo operacional.</div>
      <svg class="analise-svg-chart" viewBox="0 0 320 150" aria-label="Status das etapas do projeto">
        <rect x="16" y="40" width="288" height="24" rx="12" fill="var(--off)"></rect>
        ${segmentos.filter((segment) => segment.qtd > 0).map((segment) => `
          <rect x="${segment.x}" y="40" width="${segment.width}" height="24" rx="12" fill="${segment.color}"></rect>
        `).join('')}
        <text x="16" y="24" class="svg-label">Fluxo de etapas</text>
        <text x="304" y="24" text-anchor="end" class="svg-value">${total} etapa(s)</text>
        ${segmentos.map((segment, index) => `
          <circle cx="${22 + (index % 2) * 148}" cy="${94 + Math.floor(index / 2) * 22}" r="5" fill="${segment.color}"></circle>
          <text x="${34 + (index % 2) * 148}" y="${98 + Math.floor(index / 2) * 22}" class="svg-label">${_escN(segment.label)}: ${segment.qtd}</text>
        `).join('')}
      </svg>
    `;
  };

  analiseGraficoProjecaoProjeto = function analiseGraficoProjecaoProjetoRefinado(item) {
    const previsao = item?.previsao || {};
    const contratado = Number(item?.produto?.valor_contratado || 0);
    const custoAtual = Number(item?.custoTotal || 0);
    const custoProjetado = Number(previsao.custoProjetado || 0);
    const base = Math.max(contratado, custoProjetado, custoAtual, 1);
    const atualWidth = Math.max(0, Math.min(288, (288 * custoAtual) / base));
    const projetadoWidth = Math.max(0, Math.min(288, (288 * custoProjetado) / base));
    const contratadoX = contratado > 0 ? 16 + (288 * contratado) / base : null;
    const corProjetada = previsao.riscoKey === 'risco'
      ? 'var(--terracota)'
      : previsao.riscoKey === 'atencao'
        ? 'var(--ouro)'
        : 'var(--verde)';

    return `
      <div class="analise-chart-copy">Comparação entre custo atual, custo projetado no fechamento e a referência contratada do projeto.</div>
      <svg class="analise-svg-chart" viewBox="0 0 320 150" aria-label="Projeção do projeto">
        <rect x="16" y="36" width="288" height="16" rx="8" fill="var(--off)"></rect>
        <rect x="16" y="36" width="${atualWidth}" height="16" rx="8" fill="var(--grafite)"></rect>
        <text x="16" y="26" class="svg-label">Custo atual</text>
        <text x="304" y="26" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(custoAtual))}</text>
        <rect x="16" y="78" width="288" height="16" rx="8" fill="var(--off)"></rect>
        <rect x="16" y="78" width="${projetadoWidth}" height="16" rx="8" fill="${corProjetada}"></rect>
        <text x="16" y="68" class="svg-label">Custo projetado</text>
        <text x="304" y="68" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(custoProjetado))}</text>
        ${contratadoX !== null ? `<line x1="${contratadoX}" y1="30" x2="${contratadoX}" y2="102" stroke="var(--grafite)" stroke-dasharray="4 3"></line>` : ''}
        ${contratadoX !== null ? `<text x="${Math.min(304, contratadoX + 4)}" y="116" class="svg-label">Contrato ${_escN(analiseFmtMoney(contratado))}</text>` : '<text x="16" y="116" class="svg-label">Contrato indisponível para esta previsão.</text>'}
      </svg>
      <div class="analise-budget-meta" style="margin-top:10px">
        <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(analiseRiscoLabelSeguro(previsao.riscoKey))}</span>
        <span>${_escN(`${previsao.etapasEstouradas || 0} etapa(s) acima do budget | confiança ${analiseConfiancaLabelSegura(previsao)}`)}</span>
      </div>
    `;
  };

  analiseRenderProjetoDetalhe = function analiseRenderProjetoDetalheBlock1B() {
    const host = document.getElementById('analise-modal-body');
    if (!host) return;

    const item = ANALISE._produtoIsoladoId
      ? ANALISE._dadosPorProduto[String(ANALISE._produtoIsoladoId)]
      : null;

    if (!item || ANALISE._carregando || ANALISE._erro) {
      host.innerHTML = '';
      analiseToggleModal(false);
      return;
    }

    const etapas = item.etapasDados || [];
    const concluidas = etapas.filter((etapaItem) => etapaItem.etapa?.status === 'concluida').length;
    const budgetHoras = etapas.reduce((sum, etapaItem) => sum + analiseGetBudgetHoras(etapaItem.etapa), 0);
    const budgetUtil = budgetHoras > 0 ? (item.horasTotais / budgetHoras) * 100 : null;
    const cliente = item.produto?.oportunidades?.clientes?.nome || 'Cliente não identificado';
    const encerradoEm = item.statusResumo?.concluidoEm ? item.statusResumo.concluidoEm.toLocaleDateString('pt-BR') : 'N/D';
    const margemInfo = analiseClassificarMargem(item.margemPct);
    const previsao = item.previsao || {};
    const delta = analiseDeltaMargemProjetada(item);
    const resumo = analiseProjetoResumoExecutivo(item, budgetHoras, budgetUtil, delta);
    const insights = analiseProjetoInsights(item, budgetHoras, budgetUtil, delta);
    const confianca = analiseConfiancaLabelSegura(previsao);

    host.innerHTML = `
      <div class="analise-modal-card">
        <div class="analise-modal-head">
          <div>
            <div class="analise-state-kicker">Análise do projeto</div>
            <h2 class="analise-drill-title" id="analise-modal-title">${_escN(item.produto?.nome || 'Projeto sem nome')}</h2>
            <div class="analise-drill-sub">${_escN(cliente)} | ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')} | ${_escN(item.statusResumo?.statusLabel || 'N/D')}</div>
          </div>
          <button type="button" class="btn sm" data-modal-close="1">Fechar</button>
        </div>

        <div class="analise-drill-meta">
          <span class="analise-chip analise-chip-muted">Fase: ${_escN(item.statusResumo?.faseLabel || 'N/D')}</span>
          <span class="analise-chip analise-chip-muted">Encerrado em: ${_escN(encerradoEm)}</span>
          <span class="${margemInfo.cls}">${_escN(margemInfo.label)}</span>
          <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(analiseRiscoLabelSeguro(previsao.riscoKey))}</span>
          <span class="analise-chip analise-chip-muted">Confiança: ${_escN(confianca)}</span>
          <span class="analise-chip analise-chip-muted">Queda proj.: ${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</span>
        </div>

        <div class="analise-modal-story">
          <section class="analise-modal-lead">
            <span class="analise-modal-label">Panorama</span>
            <div class="analise-modal-copy">${_escN(resumo)}</div>
            <div class="analise-modal-impact">
              <div>
                <strong>${_escN(analiseFmtPct(previsao.margemProjetadaPct))}</strong>
                <span>Margem projetada</span>
              </div>
              <div>
                <strong>${_escN(analiseFmtPct((previsao.coberturaBudget || 0) * 100))}</strong>
                <span>Cobertura de budget</span>
              </div>
              <div>
                <strong>${_escN(String(previsao.etapasEstouradas || 0))}</strong>
                <span>Etapas acima do budget</span>
              </div>
              <div>
                <strong>${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</strong>
                <span>Queda projetada de margem</span>
              </div>
            </div>
          </section>
          <aside class="analise-modal-insights">
            <span class="analise-modal-label">Leitura executiva</span>
            <div class="analise-modal-copy">Os sinais abaixo ajudam a explicar se o risco vem de margem comprimida, cobertura frágil de budget ou pressão concentrada em etapas específicas.</div>
            <ul>
              ${insights.map((insight) => `<li>${_escN(insight)}</li>`).join('')}
            </ul>
          </aside>
        </div>

        <div class="analise-kpis-row">
          ${analiseKpiCard('Horas totais', fmtH(item.horasTotais), `${concluidas}/${etapas.length} etapas concluídas`)}
          ${analiseKpiCard('Custo total', analiseFmtMoney(item.custoTotal), 'HH + custos lançados')}
          ${analiseKpiCard('Margem atual', analiseFmtPct(item.margemPct), analiseFmtMoney(item.margem, item.margem === null))}
          ${analiseKpiCard('Budget consolidado', budgetHoras > 0 ? fmtH(budgetHoras) : 'N/D', budgetHoras > 0 ? `Uso atual ${analiseFmtPct(budgetUtil)}` : 'Sem budget consolidado')}
          ${analiseKpiCard('Margem projetada', analiseFmtPct(previsao.margemProjetadaPct), analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}
        </div>

        <section class="analise-modal-section">
          <div class="analise-modal-section-head">
            <h3 class="analise-modal-section-title">Etapas que concentram pressão</h3>
            <span class="analise-modal-section-copy">Onde o risco ou a incerteza aparecem primeiro dentro do projeto.</span>
          </div>
          ${analiseProjetoEtapasCriticas(item)}
        </section>

        <section class="analise-modal-section">
          <div class="analise-modal-section-head">
            <h3 class="analise-modal-section-title">Leituras visuais</h3>
            <span class="analise-modal-section-copy">Contrato, custo, fluxo e projeção organizados para bater o olho antes do detalhe operacional.</span>
          </div>
          <div class="analise-visual-grid">
            <section class="analise-visual-card">
              <div class="analise-visual-title">Mapa de margem</div>
              ${analiseGraficoMargemProjeto(item)}
            </section>
            <section class="analise-visual-card">
              <div class="analise-visual-title">Composição do custo</div>
              ${analiseGraficoCustosProjeto(item)}
            </section>
            <section class="analise-visual-card">
              <div class="analise-visual-title">Etapas por status</div>
              ${analiseGraficoStatusEtapas(item)}
            </section>
            <section class="analise-visual-card">
              <div class="analise-visual-title">Projeção de risco</div>
              ${analiseGraficoProjecaoProjeto(item)}
            </section>
            <section class="analise-visual-card analise-visual-card-wide">
              <div class="analise-visual-title">Budget por etapa</div>
              ${analiseGraficoBudgetEtapas(item)}
            </section>
          </div>
        </section>

        <section class="analise-modal-section">
          <div class="analise-modal-section-head">
            <h3 class="analise-modal-section-title">Etapas e orçamento</h3>
            <span class="analise-modal-section-copy">Tabela detalhada para validar origem do risco e consistência de budget.</span>
          </div>
          <div class="analise-table-wrap">
            ${analiseTabelaDetalheEtapas(item)}
          </div>
        </section>
      </div>
    `;

    analiseToggleModal(true);
  };

  const analiseRenderAbaAtivaBase = analiseRenderAbaAtiva;
  analiseRenderAbaAtiva = function analiseRenderAbaAtivaRefinada() {
    analiseRenderAbaAtivaBase();
    if (ANALISE._erro || ANALISE._carregando) return;

    const subtitleEl = document.getElementById('analise-user-context');
    if (!subtitleEl || !ANALISE._produtos.length) return;

    const totalHoras = Object.values(ANALISE._dadosPorProduto).reduce((sum, item) => sum + Number(item.horasTotais || 0), 0);
    const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    subtitleEl.textContent = `${ANALISE._produtos.length} projetos · ${fmtH(totalHoras)} lançadas · Atualizado às ${hhmm}`;
  };
})();
