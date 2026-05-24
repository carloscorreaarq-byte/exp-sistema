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
  _erro: null,
  _avisos: {
    usuariosSemVH: [],
  },
  _filtros: {
    acumulado: { nucleo: '', status: '', ordem: 'nome' },
    desenvolvimento: { nucleo: '', statusEtapa: '', agrupamento: 'projeto' },
    encerrados: { nucleo: '', ano: '', ordem: 'conclusao_desc' },
  },
};

let analiseBootstrapStarted = false;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', analiseBootstrap, { once: true });
} else {
  queueMicrotask(analiseBootstrap);
}

async function analiseBootstrap() {
  if (analiseBootstrapStarted) return;
  analiseBootstrapStarted = true;
  window.G = window.G || {};
  G.todosProdutos = G.todosProdutos || [];
  G.todasEtapas = G.todasEtapas || [];
  G.todosUsuarios = G.todosUsuarios || [];

  try {
    const boot = await appShellInit();
    if (!boot) return;
    analiseValidarAcesso();
    analiseRenderShell(boot.usuario);
    analiseBindEventosBase();
    analiseRenderConfig();
    analiseRenderAbaAtiva();
    analiseSetShellReady();
    await analiseInit();
  } catch (error) {
    analiseSetShellReady();
    ANALISE._erro = error?.message || 'Erro desconhecido ao montar a camada inicial do shell.';
    analiseRenderAbaAtiva();
  }
}

function analiseSetShellReady() {
  const loading = document.getElementById('shell-loading');
  const app = document.getElementById('shell-app');
  if (loading) loading.style.display = 'none';
  if (app) app.style.display = 'block';
}

function analiseValidarAcesso() {
  if (!isSocioRole(G.usuario?.role)) {
    window.location.href = 'app.html';
    throw new Error('Acesso restrito a socios.');
  }
}

function analiseRenderShell(usuario) {
  const subtitle = document.getElementById('analise-user-context');
  const firstName = usuario?.apelido || String(usuario?.nome || '').split(' ')[0] || 'usuario';
  subtitle.textContent = `Modulo independente com carga analitica propria. Sessao autenticada pronta para ${firstName}.`;

  const configBtn = document.getElementById('analise-btn-config');
  if (configBtn) {
    configBtn.hidden = !analisePodeConfigurarMargem(usuario?.role);
  }
}

function analiseBindEventosBase() {
  document.getElementById('analise-tabs-bar')?.addEventListener('click', (event) => {
    const button = event.target.closest('.analise-tab');
    if (!button) return;
    analiseSwitchTab(button.dataset.aba);
  });

  document.getElementById('analise-btn-reload')?.addEventListener('click', async () => {
    ANALISE._ultimaCarga = null;
    await analiseInit(true);
  });

  document.getElementById('analise-btn-config')?.addEventListener('click', () => {
    analiseAbrirConfig();
  });

  document.getElementById('analise-btn-fechar-config')?.addEventListener('click', () => {
    document.getElementById('analise-config-panel')?.classList.remove('open');
  });

  document.getElementById('analise-btn-salvar-config')?.addEventListener('click', () => {
    analiseSalvarConfig();
  });

  document.getElementById('analise-panels')?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('[data-filter-key]')) return;
    analiseAtualizarFiltro(target.dataset.aba, target.dataset.filterKey, target.value);
  });

  document.getElementById('analise-panels')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest('[data-produto-id]');
    if (row) {
      analiseAbrirProjeto(row.getAttribute('data-produto-id'));
      return;
    }
    const reset = event.target.closest('[data-filter-reset]');
    if (!reset) return;
    analiseResetFiltros(reset.dataset.aba);
  });

  document.getElementById('analise-modal')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-modal-close]')) {
      analiseFecharProjeto();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ANALISE._produtoIsoladoId) {
      analiseFecharProjeto();
    }
  });
}

async function analiseInit(forceReload = false) {
  const cacheValido =
    !forceReload &&
    ANALISE._ultimaCarga &&
    ANALISE._produtos.length > 0 &&
    (Date.now() - ANALISE._ultimaCarga) < 5 * 60 * 1000;

  if (cacheValido) {
    analiseRenderAbaAtiva();
    return;
  }

  await analiseCarregarDados();
}

async function analiseCarregarDados() {
  ANALISE._carregando = true;
  ANALISE._erro = null;
  analiseRenderAbaAtiva();

  try {
    await analiseCarregarContextoBase();

    const sb = window.sb;
    const [
      horasResp,
      custosResp,
      vhResp,
    ] = await Promise.all([
      sb.from('horas_lancadas').select('produto_id, etapa_id, usuario_id, hora_inicio, hora_fim'),
      sb.from('lancamentos_custo').select('produto_id, etapa_id, valor'),
      sb.from('historico_valor_hora').select('usuario_id, valor_hora, data_vigencia').order('data_vigencia', { ascending: false }),
    ]);

    analiseCheckQueryError(horasResp.error, 'Falha ao carregar horas_lancadas.');
    analiseCheckQueryError(custosResp.error, 'Falha ao carregar lancamentos_custo.');
    analiseCheckQueryError(vhResp.error, 'Falha ao carregar historico_valor_hora.');

    ANALISE._horas = horasResp.data || [];
    ANALISE._custos = custosResp.data || [];
    ANALISE._vhPorUser = analiseMontarValorHoraAtual(vhResp.data || []);

    const produtosElegiveis = analiseProdutosElegiveis(G.todosProdutos, G.todasEtapas);
    const produtoIds = new Set(produtosElegiveis.map((produto) => String(produto.id)));

    ANALISE._produtos = produtosElegiveis;
    ANALISE._etapas = (G.todasEtapas || []).filter((etapa) => produtoIds.has(String(etapa.produto_id)));

    analiseAgregarDados();
    ANALISE._ultimaCarga = Date.now();
  } catch (error) {
    ANALISE._erro = error?.message || 'Nao foi possivel carregar os dados do modulo.';
  } finally {
    ANALISE._carregando = false;
    analiseRenderAbaAtiva();
  }
}

async function analiseCarregarContextoBase() {
  const sb = window.sb;

  const [{ data: usuarios, error: usuariosError }] = await Promise.all([
    sb.from('usuarios').select('*').eq('ativo', true).order('nome'),
  ]);
  analiseCheckQueryError(usuariosError, 'Falha ao carregar usuarios.');
  G.todosUsuarios = usuarios || [];

  const { produtos, etapas } = await analiseCarregarProdutosEEtapas();
  G.todosProdutos = produtos.todosProdutos;
  G._prodsGestao = produtos.prodsGestao;
  G._todosProdutosGestao = produtos.todosProdutosGestao;
  G._crmVirtuais = produtos.crmVirtuais;
  G.todasEtapas = etapas;
}

async function analiseCarregarProdutosEEtapas() {
  const sb = window.sb;

  let prodsGestao = [];
  let produtosError = null;
  const produtosCompleto = await sb.from('produtos')
    .select('*, oportunidades(id, projeto, pipeline_stage, cliente_id, cidade, endereco, cnpj, escritorio_arq, escritorio_int, gestao_empresa, link_arquivo, link_planilha, previsao_orcamentaria, clientes(id, nome, cidade, uf))')
    .order('created_at', { ascending: false });

  if (produtosCompleto.error) {
    produtosError = produtosCompleto.error;
    const fallback = await sb.from('produtos')
      .select('*, oportunidades(id, projeto, pipeline_stage, cliente_id, cidade, previsao_orcamentaria, clientes(id, nome, cidade, uf))')
      .order('created_at', { ascending: false });
    analiseCheckQueryError(fallback.error, 'Falha ao carregar produtos.');
    prodsGestao = fallback.data || [];
  } else {
    prodsGestao = produtosCompleto.data || [];
  }

  if (produtosError && !prodsGestao.length) {
    throw new Error('Falha ao carregar produtos.');
  }

  const [etapasResp, proposalsResp] = await Promise.all([
    sb.from('etapas').select('*').order('ordem'),
    sb.from('exp_proposals')
      .select('proposal_id, parent_id, version, projeto, cliente, cidade, uf, main_nucleo, total, status')
      .in('status', ['fechado_ganho', 'Fechado/Ganho', 'fechado', 'Fechado', 'ganho', 'Ganho', 'won', 'closed_won', 'Fechado/ganho']),
  ]);

  analiseCheckQueryError(etapasResp.error, 'Falha ao carregar etapas.');

  const proposals = proposalsResp.data || [];
  const byParent = {};
  proposals.forEach((item) => {
    const key = item.parent_id || item.proposal_id;
    if (!byParent[key] || Number(item.version || 0) > Number(byParent[key].version || 0)) {
      byParent[key] = item;
    }
  });

  const importados = new Set((prodsGestao || []).map((produto) => produto.proposta_origem_id).filter(Boolean));
  const prodsVirtCrm = Object.values(byParent)
    .filter((item) => !importados.has(item.parent_id || item.proposal_id))
    .map((item) => ({
      id: '__crm__' + (item.parent_id || item.proposal_id),
      nome: item.projeto || '(sem nome)',
      nucleo: analiseNormalizarNucleo(item.main_nucleo),
      status: 'inativo',
      valor_contratado: item.total,
      _crm: true,
      _propId: item.parent_id || item.proposal_id,
      oportunidades: {
        projeto: item.projeto,
        clientes: { nome: item.cliente, cidade: item.cidade, uf: item.uf },
      },
    }));

  const prodsAtivos = (prodsGestao || []).filter((produto) => produto.em_gestao !== false);
  const prodsAtivosFixed = analiseFixProdutos(prodsAtivos);
  const prodsVirtFixed = analiseFixProdutos(prodsVirtCrm);

  return {
    produtos: {
      prodsGestao: prodsAtivosFixed,
      todosProdutosGestao: analiseFixProdutos(prodsGestao || []),
      crmVirtuais: prodsVirtFixed,
      todosProdutos: [...prodsAtivosFixed, ...prodsVirtFixed],
    },
    etapas: etapasResp.data || [],
  };
}

function analiseAgregarDados() {
  const dadosPorProduto = {};
  const dadosPorEtapa = {};
  const usuariosSemVH = new Set();
  const produtoIds = new Set(ANALISE._produtos.map((produto) => String(produto.id)));

  ANALISE._produtos.forEach((produto) => {
    dadosPorProduto[String(produto.id)] = {
      produto,
      horasTotais: 0,
      custoHH: 0,
      custosLancados: 0,
      custoTotal: 0,
      margem: null,
      margemPct: null,
      etapasDados: [],
      etapasProgresso: {},
      statusResumo: null,
    };
  });

  ANALISE._etapas.forEach((etapa) => {
    if (!produtoIds.has(String(etapa.produto_id))) return;
    dadosPorEtapa[String(etapa.id)] = {
      etapa,
      horasTotais: 0,
      custoHH: 0,
      custosLancados: 0,
      custoTotal: 0,
      utilizacaoBudget: null,
    };
  });

  ANALISE._horas.forEach((lancamento) => {
    const produtoKey = String(lancamento.produto_id || '');
    const etapaKey = String(lancamento.etapa_id || '');
    const horas = diffHoras(lancamento.hora_inicio, lancamento.hora_fim);
    const valorHora = ANALISE._vhPorUser[String(lancamento.usuario_id)] || 0;
    const custoHH = horas * valorHora;

    if (dadosPorProduto[produtoKey]) {
      dadosPorProduto[produtoKey].horasTotais += horas;
      dadosPorProduto[produtoKey].custoHH += custoHH;
    }

    if (dadosPorEtapa[etapaKey]) {
      dadosPorEtapa[etapaKey].horasTotais += horas;
      dadosPorEtapa[etapaKey].custoHH += custoHH;
    }

    if (lancamento.usuario_id && !ANALISE._vhPorUser[String(lancamento.usuario_id)]) {
      usuariosSemVH.add(String(lancamento.usuario_id));
    }
  });

  ANALISE._custos.forEach((lancamento) => {
    const produtoKey = String(lancamento.produto_id || '');
    const etapaKey = String(lancamento.etapa_id || '');
    const valor = Math.abs(Number(lancamento.valor) || 0);

    if (dadosPorProduto[produtoKey]) {
      dadosPorProduto[produtoKey].custosLancados += valor;
    }

    if (dadosPorEtapa[etapaKey]) {
      dadosPorEtapa[etapaKey].custosLancados += valor;
    }
  });

  Object.values(dadosPorEtapa).forEach((registro) => {
    registro.custoTotal = registro.custoHH + registro.custosLancados;
    const budget = Number(registro.etapa?.budget_horas || 0);
    registro.utilizacaoBudget = budget > 0
      ? (registro.horasTotais / budget) * 100
      : null;
  });

  Object.values(dadosPorProduto).forEach((registro) => {
    registro.custoTotal = registro.custoHH + registro.custosLancados;

    const contratado = Number(registro.produto?.valor_contratado || 0);
    if (contratado > 0) {
      registro.margem = contratado - registro.custoTotal;
      registro.margemPct = (registro.margem / contratado) * 100;
    } else {
      registro.margem = null;
      registro.margemPct = null;
    }

    registro.etapasDados = Object.values(dadosPorEtapa)
      .filter((etapaRegistro) => String(etapaRegistro.etapa?.produto_id) === String(registro.produto.id))
      .sort((a, b) => Number(a.etapa?.ordem || 0) - Number(b.etapa?.ordem || 0));

    registro.etapasDados.forEach((etapaRegistro) => {
      const status = etapaRegistro.etapa?.status || 'nao_iniciada';
      registro.etapasProgresso[status] = (registro.etapasProgresso[status] || 0) + 1;
    });

    registro.statusResumo = analiseDerivarStatusProduto(registro.produto, registro.etapasDados);
  });

  ANALISE._dadosPorProduto = dadosPorProduto;
  ANALISE._dadosPorEtapa = dadosPorEtapa;
  ANALISE._avisos.usuariosSemVH = Array.from(usuariosSemVH)
    .map((usuarioId) => G.todosUsuarios.find((usuario) => String(usuario.id) === usuarioId))
    .filter(Boolean);
}

function analiseSwitchTab(aba) {
  ANALISE._abaAtiva = aba;
  document.querySelectorAll('.analise-tab').forEach((node) => {
    node.classList.toggle('active', node.dataset.aba === aba);
  });
  document.querySelectorAll('.analise-panel').forEach((node) => {
    node.classList.toggle('active', node.id === `anp-${aba}`);
  });
  analiseRenderAbaAtiva();
}

function analiseRenderAbaAtiva() {
  try {
    if (ANALISE._abaAtiva === 'acumulado') analiseRenderAcumulado();
    else if (ANALISE._abaAtiva === 'desenvolvimento') analiseRenderDesenvolvimento();
    else if (ANALISE._abaAtiva === 'encerrados') analiseRenderEncerrados();
    else analiseRenderPessoas();
    analiseRenderProjetoDetalhe();
  } catch (error) {
    ANALISE._erro = error?.message || 'Erro inesperado ao renderizar a aba atual.';
    analiseRenderFatalState();
  }
}

function analiseAtualizarFiltro(aba, key, value) {
  if (!aba || !key || !ANALISE._filtros[aba]) return;
  ANALISE._filtros[aba][key] = value;
  analiseRenderAbaAtiva();
}

function analiseResetFiltros(aba) {
  if (aba === 'desenvolvimento') {
    ANALISE._filtros.desenvolvimento = { nucleo: '', statusEtapa: '', agrupamento: 'projeto' };
  } else if (aba === 'encerrados') {
    ANALISE._filtros.encerrados = { nucleo: '', ano: '', ordem: 'conclusao_desc' };
  } else if (aba === 'acumulado') {
    ANALISE._filtros.acumulado = { nucleo: '', status: '', ordem: 'nome' };
  }
  analiseRenderAbaAtiva();
}

function analiseAbrirProjeto(produtoId) {
  if (!produtoId || !ANALISE._dadosPorProduto[String(produtoId)]) return;
  ANALISE._produtoIsoladoId = String(produtoId);
  analiseRenderProjetoDetalhe();
}

function analiseFecharProjeto() {
  ANALISE._produtoIsoladoId = null;
  analiseRenderProjetoDetalhe();
}

function analiseRenderProjetoDetalhe() {
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
  const budgetHoras = etapas.reduce((sum, etapaItem) => sum + Number(etapaItem.etapa?.budget_horas || 0), 0);
  const budgetUtil = budgetHoras > 0 ? (item.horasTotais / budgetHoras) * 100 : null;
  const cliente = item.produto?.oportunidades?.clientes?.nome || 'Cliente nao identificado';
  const encerradoEm = item.statusResumo?.concluidoEm ? item.statusResumo.concluidoEm.toLocaleDateString('pt-BR') : 'N/D';
  const margemInfo = analiseClassificarMargem(item.margemPct);

  host.innerHTML = `
    <div class="analise-modal-card">
      <div class="analise-modal-head">
        <div>
          <div class="analise-state-kicker">Leitura isolada</div>
          <h2 class="analise-drill-title" id="analise-modal-title">${_escN(item.produto?.nome || 'Projeto sem nome')}</h2>
          <div class="analise-drill-sub">${_escN(cliente)} • ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')} • ${_escN(item.statusResumo?.statusLabel || 'N/D')}</div>
        </div>
        <button type="button" class="btn sm" data-modal-close="1">Fechar</button>
      </div>
      <div class="analise-kpis-row">
        ${analiseKpiCard('Horas totais', fmtH(item.horasTotais), `${concluidas}/${etapas.length} etapas concluidas`)}
        ${analiseKpiCard('Custo total', analiseFmtMoney(item.custoTotal), 'HH + custos lancados')}
        ${analiseKpiCard('Margem', analiseFmtPct(item.margemPct), analiseFmtMoney(item.margem, item.margem === null))}
        ${analiseKpiCard('Budget consolidado', budgetHoras > 0 ? fmtH(budgetHoras) : 'N/D', budgetHoras > 0 ? `Uso atual ${analiseFmtPct(budgetUtil)}` : 'Sem budget_horas nas etapas')}
      </div>
      <div class="analise-drill-meta">
        <span class="analise-chip analise-chip-muted">Fase: ${_escN(item.statusResumo?.faseLabel || 'N/D')}</span>
        <span class="analise-chip analise-chip-muted">Encerrado em: ${_escN(encerradoEm)}</span>
        <span class="${margemInfo.cls}">${_escN(margemInfo.label)}</span>
      </div>
      <div class="analise-visual-grid">
        <section class="analise-visual-card">
          <div class="analise-visual-title">Mapa de margem</div>
          ${analiseGraficoMargemProjeto(item)}
        </section>
        <section class="analise-visual-card">
          <div class="analise-visual-title">Composicao do custo</div>
          ${analiseGraficoCustosProjeto(item)}
        </section>
        <section class="analise-visual-card">
          <div class="analise-visual-title">Etapas por status</div>
          ${analiseGraficoStatusEtapas(item)}
        </section>
        <section class="analise-visual-card analise-visual-card-wide">
          <div class="analise-visual-title">Leitura de budget por etapa</div>
          ${analiseGraficoBudgetEtapas(item)}
        </section>
      </div>
      <div class="analise-table-wrap">
        ${analiseTabelaDetalheEtapas(item)}
      </div>
    </div>
  `;
  analiseToggleModal(true);
}

function analiseRenderFatalState() {
  const activePanel = document.querySelector(`.analise-panel${ANALISE._abaAtiva ? `#anp-${ANALISE._abaAtiva}` : '.active'}`) ||
    document.querySelector('.analise-panel.active');
  if (activePanel) {
    activePanel.innerHTML = analiseErrorTemplate(ANALISE._erro || 'Erro inesperado ao montar a visualizacao.');
  }
  const host = document.getElementById('analise-modal-body');
  if (host) {
    host.innerHTML = '';
  }
  analiseToggleModal(false);
}

function analiseToggleModal(open) {
  const modal = document.getElementById('analise-modal');
  if (!modal) return;
  modal.hidden = !open;
  document.body.classList.toggle('analise-modal-open', !!open);
}

function analiseGetConfig() {
  const defaults = { margem_threshold: 20, margem_atencao: 5 };
  try {
    const raw = localStorage.getItem('analise_config');
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      margem_threshold: Number(parsed?.margem_threshold) > 0 ? Number(parsed.margem_threshold) : defaults.margem_threshold,
      margem_atencao: Number(parsed?.margem_atencao) >= 0 ? Number(parsed.margem_atencao) : defaults.margem_atencao,
    };
  } catch {
    return defaults;
  }
}

function analiseSetConfig(config) {
  const threshold = Number(config?.margem_threshold);
  const atencao = Number(config?.margem_atencao);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('Threshold de margem invalido.');
  }
  if (!Number.isFinite(atencao) || atencao < 0) {
    throw new Error('Faixa de atencao invalida.');
  }
  const normalized = {
    margem_threshold: threshold,
    margem_atencao: atencao,
  };
  localStorage.setItem('analise_config', JSON.stringify(normalized));
  analiseRenderConfig();
  return normalized;
}

function analiseRenderConfig() {
  const config = analiseGetConfig();
  const thresholdInput = document.getElementById('analise-threshold');
  const atencaoInput = document.getElementById('analise-atencao');
  if (thresholdInput) thresholdInput.value = String(config.margem_threshold);
  if (atencaoInput) atencaoInput.value = String(config.margem_atencao);

  const preview = document.getElementById('analise-config-preview');
  if (preview) {
    const atencaoMin = config.margem_threshold;
    const saudavelMin = config.margem_threshold + config.margem_atencao;
    preview.innerHTML = `
      <span class="analise-inline-chip risco">Em risco</span> abaixo de ${config.margem_threshold}%<br>
      <span class="analise-inline-chip atencao">Atencao</span> entre ${atencaoMin}% e ${saudavelMin}%<br>
      <span class="analise-inline-chip saudavel">Saudavel</span> acima de ${saudavelMin}%
    `;
  }
}

function analiseAbrirConfig() {
  if (!analisePodeConfigurarMargem(G.usuario?.role)) return;
  document.getElementById('analise-config-panel')?.classList.add('open');
}

function analiseSalvarConfig() {
  if (!analisePodeConfigurarMargem(G.usuario?.role)) {
    toast('Somente socio administrador pode alterar esta configuracao.');
    return;
  }
  try {
    const next = analiseSetConfig({
      margem_threshold: document.getElementById('analise-threshold')?.value,
      margem_atencao: document.getElementById('analise-atencao')?.value,
    });
    document.getElementById('analise-config-panel')?.classList.remove('open');
    toast(`Configuracao salva: risco abaixo de ${next.margem_threshold}%.`);
  } catch (error) {
    toast(error.message || 'Nao foi possivel salvar a configuracao.');
  }
}

function analisePodeConfigurarMargem(role) {
  if (typeof isSocioAdminRole === 'function') {
    return isSocioAdminRole(role);
  }
  return ['socio_admin', 'socio_adm'].includes(String(role || '').toLowerCase());
}

function analiseRenderAcumulado() {
  const panel = document.getElementById('anp-acumulado');
  if (!panel) return;

  if (ANALISE._carregando) {
    panel.innerHTML = analiseLoadingTemplate('Carregando produtos, horas, custos e valor/hora...');
    return;
  }

  if (ANALISE._erro) {
    panel.innerHTML = analiseErrorTemplate(ANALISE._erro);
    return;
  }

  const produtosBase = Object.values(ANALISE._dadosPorProduto);
  if (!produtosBase.length) {
    panel.innerHTML = analiseEmptyTemplate('Nenhum projeto elegivel foi encontrado para a analise.');
    return;
  }

  const filtro = ANALISE._filtros.acumulado;
  const produtos = produtosBase
    .filter((item) => !filtro.nucleo || item.produto?.nucleo === filtro.nucleo)
    .filter((item) => !filtro.status || analiseProdutoStatusKey(item) === filtro.status)
    .sort((a, b) => analiseOrdenarProdutosAcumulado(a, b, filtro.ordem));

  if (!produtos.length) {
    panel.innerHTML = `
      ${analiseFilterBar({
        aba: 'acumulado',
        controls: [
          { key: 'nucleo', label: 'Nucleo', value: filtro.nucleo, options: analiseNucleoOptions() },
          { key: 'status', label: 'Status', value: filtro.status, options: analiseStatusProdutoOptions(produtosBase) },
          {
            key: 'ordem',
            label: 'Ordenar',
            value: filtro.ordem,
            options: analiseAcumuladoOrderOptions(),
          },
        ],
      })}
      ${analiseEmptyTemplate('Nenhum projeto atende aos filtros atuais.')}
    `;
    return;
  }

  const contratadoTotal = produtos.reduce((sum, item) => sum + Math.max(0, Number(item.produto?.valor_contratado || 0)), 0);
  const custoTotal = produtos.reduce((sum, item) => sum + item.custoTotal, 0);
  const horasTotal = produtos.reduce((sum, item) => sum + item.horasTotais, 0);
  const margemPonderada = contratadoTotal > 0
    ? ((contratadoTotal - custoTotal) / contratadoTotal) * 100
    : null;

  panel.innerHTML = `
    ${analiseWarningsHtml()}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Projetos na leitura', String(produtos.length), produtos.length === produtosBase.length ? 'Base completa elegivel' : `${produtosBase.length} elegiveis no total`)}
      ${analiseKpiCard('Horas lancadas', fmtH(horasTotal), 'Soma de horas com produto associado')}
      ${analiseKpiCard('Custo total', analiseFmtMoney(custoTotal), 'HH + custos lancados')}
      ${analiseKpiCard('Margem ponderada', analiseFmtPct(margemPonderada), 'Baseada em valor contratado conhecido')}
    </div>
    ${analiseFilterBar({
      aba: 'acumulado',
      controls: [
        { key: 'nucleo', label: 'Nucleo', value: filtro.nucleo, options: analiseNucleoOptions() },
        { key: 'status', label: 'Status', value: filtro.status, options: analiseStatusProdutoOptions(produtosBase) },
        {
          key: 'ordem',
          label: 'Ordenar',
          value: filtro.ordem,
          options: analiseAcumuladoOrderOptions(),
        },
      ],
    })}
    <div class="analise-visual-grid">
      <section class="analise-visual-card">
        <div class="analise-visual-title">Margem por nucleo</div>
        ${analiseGraficoMargemPorNucleo(produtos)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Status dos projetos</div>
        ${analiseGraficoStatusProjetos(produtos)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Contrato x custo</div>
        ${analiseGraficoContratoVsCusto(contratadoTotal, custoTotal)}
      </section>
    </div>
    <div class="analise-state-grid">
      ${analiseResumoNucleos(produtos)}
    </div>
    <div class="analise-table-wrap">
      <table class="analise-table">
        <thead>
          <tr>
            <th>Projeto</th>
            <th>Nucleo</th>
            <th>Status</th>
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
}

function analiseRenderDesenvolvimento() {
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
    .filter((item) => !filtro.statusEtapa || item.etapa?.status === filtro.statusEtapa);

  const comBudget = etapas.filter((item) => Number(item.etapa?.budget_horas || 0) > 0);
  const acimaBudget = comBudget.filter((item) => Number(item.utilizacaoBudget || 0) > 100);
  const rowsProjeto = analiseAgruparEtapasAtivasPorProjeto(etapas);

  panel.innerHTML = `
    <div class="analise-kpis-row">
      ${analiseKpiCard('Etapas ativas', String(etapas.length), 'Em andamento ou em revisao')}
      ${analiseKpiCard('Com budget', String(comBudget.length), 'Etapas com budget_horas definido')}
      ${analiseKpiCard('Acima do budget', String(acimaBudget.length), 'Utilizacao acima de 100%')}
      ${analiseKpiCard('Projetos em execucao', String(rowsProjeto.length), 'Com pelo menos uma etapa ativa')}
    </div>
    ${analiseFilterBar({
      aba: 'desenvolvimento',
      controls: [
        {
          key: 'nucleo',
          label: 'Nucleo',
          value: filtro.nucleo,
          options: analiseNucleoOptions(),
        },
        {
          key: 'statusEtapa',
          label: 'Status da etapa',
          value: filtro.statusEtapa,
          options: [
            { value: '', label: 'Todos' },
            { value: 'em_andamento', label: STATUS_ETAPA.em_andamento?.label || 'Em andamento' },
            { value: 'em_revisao', label: STATUS_ETAPA.em_revisao?.label || 'Em revisao' },
          ],
        },
        {
          key: 'agrupamento',
          label: 'Agrupar por',
          value: filtro.agrupamento,
          options: [
            { value: 'projeto', label: 'Projeto' },
            { value: 'etapa', label: 'Etapa' },
          ],
        },
      ],
    })}
    <div class="analise-visual-grid">
      <section class="analise-visual-card">
        <div class="analise-visual-title">Etapas ativas por status</div>
        ${analiseGraficoStatusEtapasAtivas(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Uso de budget ativo</div>
        ${analiseGraficoResumoBudgetAtivo(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Carga por nucleo</div>
        ${analiseGraficoCargaNucleoAtivo(etapas)}
      </section>
    </div>
    <div class="analise-table-wrap">
      ${filtro.agrupamento === 'etapa'
        ? analiseTabelaDesenvolvimentoEtapa(etapas)
        : analiseTabelaDesenvolvimentoProjeto(rowsProjeto)}
    </div>
  `;
}

function analiseRenderEncerrados() {
  const panel = document.getElementById('anp-encerrados');
  if (!panel) return;

  if (ANALISE._carregando) {
    panel.innerHTML = analiseLoadingTemplate('Carregando historico de encerrados...');
    return;
  }

  if (ANALISE._erro) {
    panel.innerHTML = analiseErrorTemplate(ANALISE._erro);
    return;
  }

  const filtro = ANALISE._filtros.encerrados;
  const encerrados = Object.values(ANALISE._dadosPorProduto)
    .map((item) => ({
      ...item,
      concluidoEm: item.statusResumo?.concluidoEm || null,
    }))
    .filter((item) => analiseProdutoEncerrado(item))
    .filter((item) => !filtro.nucleo || item.produto?.nucleo === filtro.nucleo)
    .filter((item) => !filtro.ano || String(item.concluidoEm?.getFullYear() || '') === String(filtro.ano));

  encerrados.sort((a, b) => analiseOrdenarEncerrados(a, b, filtro.ordem));

  const encerradosComMargem = encerrados.filter((item) => item.margemPct !== null);
  const margemMedia = encerradosComMargem.length
    ? encerradosComMargem.reduce((sum, item) => sum + Number(item.margemPct || 0), 0) / encerradosComMargem.length
    : null;

  panel.innerHTML = `
    <div class="analise-kpis-row">
      ${analiseKpiCard('Projetos encerrados', String(encerrados.length), 'Filtro aplicado sobre a base consolidada')}
      ${analiseKpiCard('Horas encerradas', fmtH(encerrados.reduce((sum, item) => sum + item.horasTotais, 0)), 'Soma de horas dos projetos filtrados')}
      ${analiseKpiCard('Custo encerrado', analiseFmtMoney(encerrados.reduce((sum, item) => sum + item.custoTotal, 0)), 'HH + custos lancados')}
      ${analiseKpiCard('Margem media', analiseFmtPct(margemMedia), 'Media simples da margem percentual')}
    </div>
    ${analiseFilterBar({
      aba: 'encerrados',
      controls: [
        {
          key: 'nucleo',
          label: 'Nucleo',
          value: filtro.nucleo,
          options: analiseNucleoOptions(),
        },
        {
          key: 'ano',
          label: 'Ano',
          value: filtro.ano,
          options: analiseAnoOptionsEncerrados(),
        },
        {
          key: 'ordem',
          label: 'Ordenar',
          value: filtro.ordem,
          options: [
            { value: 'conclusao_desc', label: 'Mais recentes' },
            { value: 'conclusao_asc', label: 'Mais antigos' },
            { value: 'margem_asc', label: 'Menor margem' },
            { value: 'margem_desc', label: 'Maior margem' },
          ],
        },
      ],
    })}
    <div class="analise-visual-grid">
      <section class="analise-visual-card analise-visual-card-wide">
        <div class="analise-visual-title">Historico de margem</div>
        ${analiseGraficoMargemHistorica(encerrados)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Margem por nucleo</div>
        ${analiseGraficoMargemPorNucleo(encerrados)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Custo encerrado por nucleo</div>
        ${analiseGraficoCustoPorNucleo(encerrados)}
      </section>
    </div>
    <div class="analise-table-wrap">
      ${analiseTabelaEncerrados(encerrados)}
    </div>
  `;
}

function analiseRenderPessoas() {
  const panel = document.getElementById('anp-pessoas');
  if (!panel) return;

  if (ANALISE._carregando) {
    panel.innerHTML = analiseLoadingTemplate('Carregando base por pessoa...');
    return;
  }

  if (ANALISE._erro) {
    panel.innerHTML = analiseErrorTemplate(ANALISE._erro);
    return;
  }

  panel.innerHTML = analisePlaceholderTemplate({
    kicker: 'Backlog',
    title: 'Aba reservada para eficiencia por pessoa',
    copy: `A base atual ja conhece ${G.todosUsuarios.length} usuarios ativos e ${ANALISE._horas.length} lancamentos de horas. A leitura por pessoa entra quando a camada financeira e operacional estiver estabilizada.`,
    cards: [
      ['Usuarios ativos', String(G.todosUsuarios.length)],
      ['Lancamentos', String(ANALISE._horas.length)],
    ],
  });
}

function analiseFilterBar({ aba, controls }) {
  return `
    <div class="analise-filter-bar">
      <div class="analise-filter-grid">
        ${(controls || []).map((control) => `
          <label class="analise-filter-field">
            <span>${_escN(control.label)}</span>
            <select data-aba="${_escN(aba)}" data-filter-key="${_escN(control.key)}">
              ${(control.options || []).map((option) => `
                <option value="${_escN(option.value)}" ${String(option.value) === String(control.value) ? 'selected' : ''}>${_escN(option.label)}</option>
              `).join('')}
            </select>
          </label>
        `).join('')}
      </div>
      <button type="button" class="btn sm" data-filter-reset="1" data-aba="${_escN(aba)}">Limpar filtros</button>
    </div>
  `;
}

function analiseNucleoOptions() {
  return [
    { value: '', label: 'Todos' },
    ...Object.entries(NUCLEO_COR)
      .sort((a, b) => a[1].label.localeCompare(b[1].label, 'pt-BR'))
      .map(([value, item]) => ({ value, label: item.label })),
  ];
}

function analiseAnoOptionsEncerrados() {
  const anos = Array.from(new Set(
    Object.values(ANALISE._dadosPorProduto)
      .map((item) => item.statusResumo?.concluidoEm || null)
      .filter(Boolean)
      .map((date) => String(date.getFullYear()))
  )).sort((a, b) => Number(b) - Number(a));

  return [{ value: '', label: 'Todos' }, ...anos.map((ano) => ({ value: ano, label: ano }))];
}

function analiseStatusProdutoOptions(produtos) {
  const labels = {};
  (produtos || []).forEach((item) => {
    const key = analiseProdutoStatusKey(item);
    if (!key || labels[key]) return;
    labels[key] = analiseProdutoStatusLabel(item);
  });

  return [
    { value: '', label: 'Todos' },
    ...Object.entries(labels)
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
      .map(([value, label]) => ({ value, label })),
  ];
}

function analiseAcumuladoOrderOptions() {
  return [
    { value: 'nome', label: 'Nome do projeto' },
    { value: 'horas_desc', label: 'Mais horas' },
    { value: 'custo_desc', label: 'Maior custo' },
    { value: 'margem_asc', label: 'Menor margem' },
    { value: 'margem_desc', label: 'Maior margem' },
  ];
}

function analiseProdutoStatusKey(itemOrStatus) {
  if (itemOrStatus && typeof itemOrStatus === 'object' && 'statusResumo' in itemOrStatus) {
    return itemOrStatus.statusResumo?.statusKey || 'nd';
  }
  return analiseNormalizarStatusProdutoRaw(itemOrStatus) || 'nd';
}

function analiseProdutoStatusLabel(itemOrStatus) {
  if (itemOrStatus && typeof itemOrStatus === 'object' && 'statusResumo' in itemOrStatus) {
    return itemOrStatus.statusResumo?.statusLabel || 'N/D';
  }
  const raw = analiseNormalizarStatusProdutoRaw(itemOrStatus);
  return analiseStatusProdutoLabelFromKey(raw);
}

function analiseNormalizarStatusProdutoRaw(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'concluido' || raw === 'concluida' || raw === 'finalizado' || raw === 'finalizada') return 'encerrado';
  if (raw === 'paused') return 'pausado';
  if (raw === 'active') return 'ativo';
  if (raw === 'inactive') return 'inativo';
  return raw;
}

function analiseStatusProdutoLabelFromKey(statusKey) {
  if (statusKey === 'ativo') return 'Ativo';
  if (statusKey === 'encerrado') return 'Encerrado';
  if (statusKey === 'pausado') return 'Pausado';
  if (statusKey === 'inativo') return 'Inativo';
  if (!statusKey) return 'N/D';
  return statusKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function analiseOrdenarProdutosAcumulado(a, b, ordem) {
  if (ordem === 'horas_desc') return Number(b.horasTotais || 0) - Number(a.horasTotais || 0);
  if (ordem === 'custo_desc') return Number(b.custoTotal || 0) - Number(a.custoTotal || 0);
  if (ordem === 'margem_asc') return analiseSortNullLastAsc(a.margemPct, b.margemPct);
  if (ordem === 'margem_desc') return analiseSortNullLastDesc(a.margemPct, b.margemPct);
  return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
}

function analiseSortNullLastAsc(a, b) {
  const aNull = a === null || typeof a === 'undefined';
  const bNull = b === null || typeof b === 'undefined';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return Number(a) - Number(b);
}

function analiseSortNullLastDesc(a, b) {
  const aNull = a === null || typeof a === 'undefined';
  const bNull = b === null || typeof b === 'undefined';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return Number(b) - Number(a);
}

function analiseDerivarStatusProduto(produto, etapasDados) {
  const statusRaw = analiseNormalizarStatusProdutoRaw(produto?.status);
  const etapas = etapasDados || [];
  const totalEtapas = etapas.length;
  const temEmAndamento = etapas.some((item) => item.etapa?.status === 'em_andamento');
  const temRevisao = etapas.some((item) => item.etapa?.status === 'em_revisao');
  const temPausada = etapas.some((item) => item.etapa?.status === 'pausada');
  const etapasConcluidas = etapas.filter((item) => item.etapa?.status === 'concluida');
  const todasConcluidas = totalEtapas > 0 && etapasConcluidas.length === totalEtapas;

  let statusKey = statusRaw;
  if (!statusKey) {
    if (produto?.em_gestao === false) statusKey = 'inativo';
    else if (todasConcluidas) statusKey = 'encerrado';
    else if (temPausada && !temEmAndamento && !temRevisao) statusKey = 'pausado';
    else statusKey = 'ativo';
  } else if (statusKey !== 'encerrado' && todasConcluidas) {
    statusKey = 'encerrado';
  }

  let faseKey = 'fila';
  if (statusKey === 'encerrado') faseKey = 'concluido';
  else if (temEmAndamento) faseKey = 'andamento';
  else if (temRevisao) faseKey = 'revisao';
  else if (temPausada) faseKey = 'pausado';

  const concluidoEm = analiseExtrairConclusaoProduto(produto, etapasConcluidas, statusKey);
  return {
    statusRaw,
    statusKey,
    statusLabel: analiseStatusProdutoLabelFromKey(statusKey),
    faseKey,
    faseLabel: analiseProdutoFaseLabel(faseKey),
    concluidoEm,
    encerradoPorEtapas: statusRaw !== 'encerrado' && statusKey === 'encerrado',
    totalEtapas,
    concluidas: etapasConcluidas.length,
  };
}

function analiseProdutoFaseLabel(faseKey) {
  if (faseKey === 'concluido') return 'Concluido';
  if (faseKey === 'andamento') return 'Em andamento';
  if (faseKey === 'revisao') return 'Em revisao';
  if (faseKey === 'pausado') return 'Pausado';
  return 'Fila';
}

function analiseExtrairConclusaoProduto(produto, etapasConcluidas, statusKey) {
  const diretas = [
    produto?.data_conclusao,
    produto?.concluido_em,
    produto?.encerrado_em,
  ];
  for (const raw of diretas) {
    const parsed = analiseParseDate(raw);
    if (parsed) return parsed;
  }

  if (statusKey === 'encerrado' && Array.isArray(etapasConcluidas) && etapasConcluidas.length) {
    const datasEtapas = etapasConcluidas
      .map((item) => analiseParseDate(item.etapa?.data_conclusao))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());
    if (datasEtapas.length) return datasEtapas[0];
  }

  return null;
}

function analiseParseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function analiseAgruparEtapasAtivasPorProjeto(etapas) {
  const byProduto = {};
  etapas.forEach((item) => {
    const produtoId = String(item.produto?.id || item.etapa?.produto_id || '');
    if (!produtoId) return;
    if (!byProduto[produtoId]) {
      byProduto[produtoId] = {
        produto: item.produto,
        etapas: [],
        horasTotais: 0,
        custoTotal: 0,
        budgetHoras: 0,
        etapasComBudget: 0,
        acimaBudget: 0,
      };
    }
    byProduto[produtoId].etapas.push(item);
    byProduto[produtoId].horasTotais += item.horasTotais;
    byProduto[produtoId].custoTotal += item.custoTotal;
    if (Number(item.etapa?.budget_horas || 0) > 0) {
      byProduto[produtoId].budgetHoras += Number(item.etapa?.budget_horas || 0);
      byProduto[produtoId].etapasComBudget += 1;
      if (Number(item.utilizacaoBudget || 0) > 100) {
        byProduto[produtoId].acimaBudget += 1;
      }
    }
  });

  return Object.values(byProduto).sort((a, b) =>
    String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR')
  );
}

function analiseTabelaDesenvolvimentoProjeto(rows) {
  if (!rows.length) {
    return analiseEmptyTemplate('Nenhum projeto em desenvolvimento atende aos filtros atuais.');
  }

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Nucleo</th>
          <th>Etapas ativas</th>
          <th>Horas</th>
          <th>Budget</th>
          <th>Uso budget</th>
          <th>Custo atual</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const budgetPct = row.budgetHoras > 0 ? (row.horasTotais / row.budgetHoras) * 100 : null;
          return `
            <tr class="analise-row-link" data-produto-id="${_escN(row.produto?.id || '')}">
              <td>
                <div class="analise-table-main">${_escN(row.produto?.nome || 'Projeto sem nome')}</div>
                <div class="analise-table-sub">${_escN(row.etapas.map((item) => item.etapa?.nome || `Etapa ${item.etapa?.ordem || ''}`).join(' • '))}</div>
              </td>
              <td>${_escN(NUCLEO_COR[row.produto?.nucleo]?.label || 'N/D')}</td>
              <td>${_escN(String(row.etapas.length))}</td>
              <td>${_escN(fmtH(row.horasTotais))}</td>
              <td>${_escN(row.budgetHoras > 0 ? fmtH(row.budgetHoras) : 'N/D')}</td>
              <td>${analiseBudgetBadge(budgetPct, row.etapasComBudget)}</td>
              <td>${_escN(analiseFmtMoney(row.custoTotal))}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function analiseTabelaDesenvolvimentoEtapa(rows) {
  if (!rows.length) {
    return analiseEmptyTemplate('Nenhuma etapa ativa atende aos filtros atuais.');
  }

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Etapa</th>
          <th>Status</th>
          <th>Horas</th>
          <th>Budget</th>
          <th>Uso budget</th>
          <th>Custo etapa</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .sort((a, b) => String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR'))
          .map((item) => `
            <tr class="analise-row-link" data-produto-id="${_escN(item.produto?.id || '')}">
              <td>
                <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
                <div class="analise-table-sub">${_escN(`${NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D'} • ${item.produtoRegistro?.statusResumo?.faseLabel || 'Fila'}`)}</div>
              </td>
              <td>${_escN(item.etapa?.nome || `Etapa ${item.etapa?.ordem || 'N/D'}`)}</td>
              <td>${analiseStatusEtapaBadge(item.etapa?.status)}</td>
              <td>${_escN(fmtH(item.horasTotais))}</td>
              <td>${_escN(Number(item.etapa?.budget_horas || 0) > 0 ? fmtH(item.etapa?.budget_horas || 0) : 'N/D')}</td>
              <td>${analiseBudgetBadge(item.utilizacaoBudget, Number(item.etapa?.budget_horas || 0) > 0 ? 1 : 0)}</td>
              <td>${_escN(analiseFmtMoney(item.custoTotal))}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  `;
}

function analiseTabelaEncerrados(rows) {
  if (!rows.length) {
    return analiseEmptyTemplate('Nenhum projeto encerrado atende aos filtros atuais.');
  }

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Nucleo</th>
          <th>Encerrado em</th>
          <th>Horas</th>
          <th>Custo total</th>
          <th>Contratado</th>
          <th>Margem</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((item) => `
          <tr class="analise-row-link" data-produto-id="${_escN(item.produto?.id || '')}">
            <td>
              <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
              <div class="analise-table-sub">${_escN(item.statusResumo?.encerradoPorEtapas ? 'Encerrado pela conclusao das etapas' : (item.produto?.oportunidades?.clientes?.nome || ''))}</div>
            </td>
            <td>${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')}</td>
            <td>${_escN(item.concluidoEm ? item.concluidoEm.toLocaleDateString('pt-BR') : 'N/D')}</td>
            <td>${_escN(fmtH(item.horasTotais))}</td>
            <td>${_escN(analiseFmtMoney(item.custoTotal))}</td>
            <td>${_escN(analiseFmtMoney(item.produto?.valor_contratado || 0, item.produto?.valor_contratado ? false : true))}</td>
            <td><span class="${analiseClassificarMargem(item.margemPct).cls}">${_escN(analiseFmtPct(item.margemPct))}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function analiseTabelaDetalheEtapas(item) {
  const etapas = item.etapasDados || [];
  if (!etapas.length) {
    return analiseEmptyTemplate('Este projeto ainda nao possui etapas vinculadas para leitura detalhada.');
  }

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Etapa</th>
          <th>Status</th>
          <th>Horas</th>
          <th>Budget</th>
          <th>Uso budget</th>
          <th>Custo HH</th>
          <th>Custo total</th>
          <th>Conclusao</th>
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
            <td>${_escN(Number(etapaItem.etapa?.budget_horas || 0) > 0 ? fmtH(etapaItem.etapa?.budget_horas || 0) : 'N/D')}</td>
            <td>${analiseBudgetBadge(etapaItem.utilizacaoBudget, Number(etapaItem.etapa?.budget_horas || 0) > 0 ? 1 : 0)}</td>
            <td>${_escN(analiseFmtMoney(etapaItem.custoHH))}</td>
            <td>${_escN(analiseFmtMoney(etapaItem.custoTotal))}</td>
            <td>${_escN(etapaItem.etapa?.data_conclusao ? fmtDate(etapaItem.etapa.data_conclusao) : 'N/D')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function analiseGraficoMargemProjeto(item) {
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
    <div class="analise-chart-copy">Quanto do contrato ja foi consumido pelo custo e qual espaco de margem ainda existe.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 120" aria-label="Grafico de margem do projeto">
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
}

function analiseGraficoCustosProjeto(item) {
  const custoHH = Number(item.custoHH || 0);
  const custoExtra = Number(item.custosLancados || 0);
  const total = custoHH + custoExtra;
  if (total <= 0) {
    return '<div class="empty-note">Ainda nao ha custo registrado para compor o grafico.</div>';
  }
  const hhPct = (custoHH / total) * 100;
  const extraPct = (custoExtra / total) * 100;

  return `
    <div class="analise-chart-copy">Separacao entre custo de horas trabalhadas e demais lancamentos financeiros.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 140" aria-label="Composicao do custo do projeto">
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
}

function analiseGraficoStatusEtapas(item) {
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
    <div class="analise-chart-copy">Distribuicao das etapas do projeto ao longo do fluxo operacional.</div>
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
}

function analiseGraficoBudgetEtapas(item) {
  const etapas = item.etapasDados || [];
  if (!etapas.length) {
    return '<div class="empty-note">Sem etapas para leitura de budget.</div>';
  }

  return `
    <div class="analise-budget-stack">
      ${etapas.map((etapaItem) => {
        const budget = Number(etapaItem.etapa?.budget_horas || 0);
        const uso = Number(etapaItem.utilizacaoBudget || 0);
        const largura = budget > 0 ? Math.min(100, uso) : 0;
        const classe = budget <= 0 ? 'analise-chip-muted' : uso > 100 ? 'analise-chip-risk' : uso >= 85 ? 'analise-chip-warn' : 'analise-chip-ok';
        return `
          <div class="analise-budget-row">
            <div class="analise-budget-head">
              <div>
                <div class="analise-table-main">${_escN(etapaItem.etapa?.nome || `Etapa ${etapaItem.etapa?.ordem || 'N/D'}`)}</div>
                <div class="analise-table-sub">${_escN(STATUS_ETAPA[etapaItem.etapa?.status]?.label || etapaItem.etapa?.status || 'N/D')}</div>
              </div>
              <span class="analise-chip ${classe}">${budget > 0 ? _escN(analiseFmtPct(uso)) : 'Sem budget'}</span>
            </div>
            <div class="analise-budget-bar">
              <div class="analise-budget-fill ${classe}" style="width:${largura}%"></div>
            </div>
            <div class="analise-budget-meta">
              <span>${_escN(fmtH(etapaItem.horasTotais))} consumidas</span>
              <span>${budget > 0 ? _escN(fmtH(budget)) + ' de budget' : 'budget_horas nao definido'}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function analiseGraficoMargemPorNucleo(produtos) {
  if (!(produtos || []).length) {
    return '<div class="empty-note">Sem projetos para compor a leitura por nucleo.</div>';
  }

  const rows = Object.entries(
    produtos.reduce((acc, item) => {
      const key = item.produto?.nucleo || 'sem_nucleo';
      if (!acc[key]) {
        acc[key] = { label: NUCLEO_COR[key]?.label || 'Sem nucleo', contratado: 0, custo: 0 };
      }
      acc[key].contratado += Math.max(0, Number(item.produto?.valor_contratado || 0));
      acc[key].custo += Number(item.custoTotal || 0);
      return acc;
    }, {})
  ).map(([key, row]) => {
    const margemPct = row.contratado > 0 ? ((row.contratado - row.custo) / row.contratado) * 100 : null;
    return { ...row, key, margemPct };
  }).sort((a, b) => (Number(b.margemPct) || -999) - (Number(a.margemPct) || -999));

  const maxWidth = 220;
  return `
    <div class="analise-chart-copy">Comparativo simples de margem percentual agregada por nucleo.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Margem por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        const pct = Math.max(0, Math.min(100, Number(row.margemPct || 0)));
        const cor = Number(row.margemPct || 0) < 20 ? 'var(--terracota)' : Number(row.margemPct || 0) < 25 ? 'var(--ouro)' : 'var(--verde)';
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 10}" width="${maxWidth}" height="10" rx="5" fill="var(--off)"></rect>
          <rect x="102" y="${y - 10}" width="${(maxWidth * pct) / 100}" height="10" rx="5" fill="${cor}"></rect>
          <text x="312" y="${y}" text-anchor="end" class="svg-value">${_escN(analiseFmtPct(row.margemPct))}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function analiseGraficoStatusProjetos(produtos) {
  if (!(produtos || []).length) {
    return '<div class="empty-note">Sem projetos para compor a leitura de status.</div>';
  }
  const labels = ['ativo', 'pausado', 'encerrado', 'inativo'];
  const counts = labels.map((statusKey) => ({
    label: analiseStatusProdutoLabelFromKey(statusKey),
    count: produtos.filter((item) => item.statusResumo?.statusKey === statusKey).length,
    color: statusKey === 'ativo' ? '#5280CA' : statusKey === 'pausado' ? '#D19931' : statusKey === 'encerrado' ? '#45865D' : '#B8B8B8',
  }));
  return analiseGraficoDistribuicaoSimples(counts, 'Leitura do portifolio por status canônico.');
}

function analiseGraficoContratoVsCusto(contratadoTotal, custoTotal) {
  if (Number(contratadoTotal || 0) <= 0) {
    return '<div class="empty-note">Sem base contratual suficiente para comparar contrato e custo.</div>';
  }
  const pct = Math.max(0, Math.min(100, (Number(custoTotal || 0) / Number(contratadoTotal || 1)) * 100));
  return `
    <div class="analise-chart-copy">Visao geral do quanto do valor contratado ja foi consumido em custo.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 120" aria-label="Contrato versus custo">
      <rect x="16" y="42" width="288" height="22" rx="11" fill="var(--off)"></rect>
      <rect x="16" y="42" width="${(288 * pct) / 100}" height="22" rx="11" fill="var(--grafite)"></rect>
      <text x="16" y="26" class="svg-label">Contrato total</text>
      <text x="304" y="26" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(contratadoTotal))}</text>
      <text x="16" y="94" class="svg-label">Custo acumulado</text>
      <text x="304" y="94" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(custoTotal))}</text>
    </svg>
  `;
}

function analiseGraficoStatusEtapasAtivas(etapas) {
  const counts = [
    { label: STATUS_ETAPA.em_andamento?.label || 'Em andamento', count: etapas.filter((item) => item.etapa?.status === 'em_andamento').length, color: '#5280CA' },
    { label: STATUS_ETAPA.em_revisao?.label || 'Em revisao', count: etapas.filter((item) => item.etapa?.status === 'em_revisao').length, color: '#D19931' },
  ];
  return analiseGraficoDistribuicaoSimples(counts, 'Separacao das etapas ativas entre producao e revisao.');
}

function analiseGraficoResumoBudgetAtivo(etapas) {
  const comBudget = etapas.filter((item) => Number(item.etapa?.budget_horas || 0) > 0);
  if (!comBudget.length) {
    return '<div class="empty-note">Nenhuma etapa ativa tem budget_horas definido.</div>';
  }
  const faixas = [
    { label: 'Saudavel', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) < 85).length, color: '#45865D' },
    { label: 'Atencao', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) >= 85 && Number(item.utilizacaoBudget || 0) <= 100).length, color: '#D19931' },
    { label: 'Estourado', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) > 100).length, color: '#C36247' },
  ];
  return analiseGraficoDistribuicaoSimples(faixas, 'Panorama rapido do uso do budget nas etapas em curso.');
}

function analiseGraficoCargaNucleoAtivo(etapas) {
  if (!etapas.length) {
    return '<div class="empty-note">Sem etapas ativas para compor a carga por nucleo.</div>';
  }
  const rows = Object.entries(
    etapas.reduce((acc, item) => {
      const key = item.produto?.nucleo || 'sem_nucleo';
      if (!acc[key]) acc[key] = { label: NUCLEO_COR[key]?.label || 'Sem nucleo', horas: 0 };
      acc[key].horas += Number(item.horasTotais || 0);
      return acc;
    }, {})
  ).map(([key, row]) => ({ ...row, key })).sort((a, b) => b.horas - a.horas);

  const maxHoras = Math.max(...rows.map((row) => row.horas), 1);
  return `
    <div class="analise-chart-copy">Horas consumidas nas etapas ativas, recortadas por nucleo.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Carga ativa por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 10}" width="210" height="10" rx="5" fill="var(--off)"></rect>
          <rect x="102" y="${y - 10}" width="${(210 * row.horas) / maxHoras}" height="10" rx="5" fill="${NUCLEO_COR[row.key]?.dot || 'var(--grafite)'}"></rect>
          <text x="312" y="${y}" text-anchor="end" class="svg-value">${_escN(fmtH(row.horas))}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function analiseGraficoMargemHistorica(encerrados) {
  if (!(encerrados || []).length) {
    return '<div class="empty-note">Sem projetos encerrados para formar a serie historica.</div>';
  }
  const rows = encerrados.slice(0, 10).sort((a, b) => (a.concluidoEm?.getTime() || 0) - (b.concluidoEm?.getTime() || 0));
  const maxPct = Math.max(...rows.map((item) => Math.abs(Number(item.margemPct || 0))), 1);
  const barWidth = Math.max(18, Math.floor(240 / Math.max(rows.length, 1)));

  return `
    <div class="analise-chart-copy">Ultimos projetos encerrados filtrados, em ordem cronologica, para leitura da margem historica.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 180" aria-label="Historico de margem dos encerrados">
      <line x1="20" y1="134" x2="304" y2="134" stroke="var(--cinza2)" stroke-width="1"></line>
      ${rows.map((item, index) => {
        const value = Number(item.margemPct || 0);
        const h = (90 * Math.abs(value)) / maxPct;
        const x = 28 + index * (barWidth + 8);
        const y = value >= 0 ? 134 - h : 134;
        const cor = value < 20 ? 'var(--terracota)' : value < 25 ? 'var(--ouro)' : 'var(--verde)';
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="${cor}"></rect>
          <text x="${x + barWidth / 2}" y="154" text-anchor="middle" class="svg-label">${_escN((item.concluidoEm || new Date()).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }))}</text>
          <text x="${x + barWidth / 2}" y="${value >= 0 ? y - 6 : y + h + 12}" text-anchor="middle" class="svg-value">${_escN(analiseFmtPct(value))}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function analiseGraficoCustoPorNucleo(produtos) {
  if (!(produtos || []).length) {
    return '<div class="empty-note">Sem base para compor custo por nucleo.</div>';
  }
  const rows = Object.entries(
    produtos.reduce((acc, item) => {
      const key = item.produto?.nucleo || 'sem_nucleo';
      if (!acc[key]) acc[key] = { label: NUCLEO_COR[key]?.label || 'Sem nucleo', custo: 0 };
      acc[key].custo += Number(item.custoTotal || 0);
      return acc;
    }, {})
  ).map(([key, row]) => ({ ...row, key })).sort((a, b) => b.custo - a.custo);
  const max = Math.max(...rows.map((row) => row.custo), 1);

  return `
    <div class="analise-chart-copy">Concentracao do custo total entre os nucleos presentes no filtro.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Custo por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 10}" width="210" height="10" rx="5" fill="var(--off)"></rect>
          <rect x="102" y="${y - 10}" width="${(210 * row.custo) / max}" height="10" rx="5" fill="${NUCLEO_COR[row.key]?.dot || 'var(--grafite)'}"></rect>
          <text x="312" y="${y}" text-anchor="end" class="svg-value">${_escN(analiseFmtMoney(row.custo))}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function analiseGraficoDistribuicaoSimples(rows, copy) {
  const total = (rows || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
  if (!total) {
    return '<div class="empty-note">Ainda nao ha volume suficiente para desenhar este grafico.</div>';
  }
  let offset = 16;
  return `
    <div class="analise-chart-copy">${_escN(copy)}</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 150" aria-label="Grafico de distribuicao">
      <rect x="16" y="40" width="288" height="24" rx="12" fill="var(--off)"></rect>
      ${rows.filter((row) => row.count > 0).map((row) => {
        const width = (288 * Number(row.count || 0)) / total;
        const out = `
          <rect x="${offset}" y="40" width="${width}" height="24" rx="12" fill="${row.color}"></rect>
        `;
        offset += width;
        return out;
      }).join('')}
      ${rows.map((row, index) => `
        <circle cx="${22 + (index % 2) * 148}" cy="${94 + Math.floor(index / 2) * 22}" r="5" fill="${row.color}"></circle>
        <text x="${34 + (index % 2) * 148}" y="${98 + Math.floor(index / 2) * 22}" class="svg-label">${_escN(row.label)}: ${row.count}</text>
      `).join('')}
    </svg>
  `;
}

function analiseBudgetBadge(utilizacaoBudget, temBudget) {
  if (!temBudget) {
    return '<span class="analise-chip analise-chip-muted">N/D</span>';
  }
  const pct = Number(utilizacaoBudget || 0);
  const cls = pct > 100 ? 'analise-chip-risk' : pct >= 85 ? 'analise-chip-warn' : 'analise-chip-ok';
  return `<span class="analise-chip ${cls}">${_escN(analiseFmtPct(pct))}</span>`;
}

function analiseStatusEtapaBadge(status) {
  const label = STATUS_ETAPA[status]?.label || status || 'N/D';
  return `<span class="analise-chip analise-chip-muted">${_escN(label)}</span>`;
}

function analiseProdutoEncerrado(itemOrProduto) {
  if (itemOrProduto && typeof itemOrProduto === 'object' && 'statusResumo' in itemOrProduto) {
    return itemOrProduto.statusResumo?.statusKey === 'encerrado';
  }
  return analiseNormalizarStatusProdutoRaw(itemOrProduto?.status) === 'encerrado';
}

function analiseOrdenarEncerrados(a, b, ordem) {
  if (ordem === 'margem_asc') return (Number(a.margemPct) || -9999) - (Number(b.margemPct) || -9999);
  if (ordem === 'margem_desc') return (Number(b.margemPct) || -9999) - (Number(a.margemPct) || -9999);

  const timeA = a.concluidoEm ? a.concluidoEm.getTime() : 0;
  const timeB = b.concluidoEm ? b.concluidoEm.getTime() : 0;
  if (ordem === 'conclusao_asc') return timeA - timeB;
  return timeB - timeA;
}

function analiseKpiCard(label, value, sub) {
  return `
    <div class="analise-kpi">
      <div class="analise-kpi-label">${_escN(label)}</div>
      <div class="analise-kpi-val">${_escN(value)}</div>
      <div class="analise-kpi-sub">${_escN(sub)}</div>
    </div>
  `;
}

function analiseWarningsHtml() {
  const usuarios = ANALISE._avisos.usuariosSemVH || [];
  if (!usuarios.length) return '';
  const nomes = usuarios.slice(0, 5).map((usuario) => usuario.nome || `#${usuario.id}`).join(', ');
  const extra = usuarios.length > 5 ? ` e mais ${usuarios.length - 5}` : '';
  return `
    <div class="analise-warning">
      <strong>Aviso de custo:</strong> ${usuarios.length} usuario(s) com horas lancadas ainda nao possuem valor/hora vigente. O custo de HH desses casos esta zerado. ${_escN(nomes + extra)}.
    </div>
  `;
}

function analiseResumoNucleos(produtos) {
  const resumo = {};
  produtos.forEach((item) => {
    const nucleo = item.produto?.nucleo || 'sem_nucleo';
    if (!resumo[nucleo]) {
      resumo[nucleo] = {
        label: NUCLEO_COR[nucleo]?.label || 'Sem nucleo',
        projetos: 0,
        horas: 0,
        custo: 0,
      };
    }
    resumo[nucleo].projetos += 1;
    resumo[nucleo].horas += item.horasTotais;
    resumo[nucleo].custo += item.custoTotal;
  });

  return Object.entries(resumo)
    .sort((a, b) => a[1].label.localeCompare(b[1].label, 'pt-BR'))
    .map(([nucleo, item]) => {
      const cor = NUCLEO_COR[nucleo]?.dot || 'var(--grafite)';
      return `
        <div class="analise-state-card" style="border-left:3px solid ${cor}">
          <strong>${_escN(item.label)}</strong>
          <span>${item.projetos} projeto(s)</span>
          <span>${fmtH(item.horas)} registradas</span>
          <span>${analiseFmtMoney(item.custo)} de custo</span>
        </div>
      `;
    })
    .join('');
}

function analiseLinhaProduto(item) {
  const classeMargem = analiseClassificarMargem(item.margemPct);
  const statusLabel = analiseProdutoStatusLabel(item);
  const faseLabel = item.statusResumo?.faseLabel;
  return `
    <tr class="analise-row-link" data-produto-id="${_escN(item.produto?.id || '')}">
      <td>
        <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
        <div class="analise-table-sub">${_escN(item.produto?.oportunidades?.clientes?.nome || '')}</div>
      </td>
      <td>${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')}</td>
      <td>
        <div class="analise-table-main">${_escN(statusLabel)}</div>
        <div class="analise-table-sub">${_escN(faseLabel || 'N/D')}</div>
      </td>
      <td>${_escN(fmtH(item.horasTotais))}</td>
      <td>${_escN(analiseFmtMoney(item.custoTotal))}</td>
      <td>${_escN(analiseFmtMoney(item.produto?.valor_contratado || 0, item.produto?.valor_contratado ? false : true))}</td>
      <td><span class="${classeMargem.cls}">${_escN(analiseFmtPct(item.margemPct))}</span></td>
    </tr>
  `;
}

function analiseClassificarMargem(margemPct) {
  const config = analiseGetConfig();
  if (margemPct === null || typeof margemPct === 'undefined') {
    return { cls: 'margem-nd', label: 'N/D' };
  }
  if (margemPct < config.margem_threshold) {
    return { cls: 'margem-risco', label: 'Em risco' };
  }
  if (margemPct < config.margem_threshold + config.margem_atencao) {
    return { cls: 'margem-atencao', label: 'Atencao' };
  }
  return { cls: 'margem-saudavel', label: 'Saudavel' };
}

function analiseFmtMoney(value, dashIfZero = false) {
  const number = Number(value || 0);
  if (dashIfZero && number <= 0) return 'N/D';
  return `R$ ${fmtNum(number)}`;
}

function analiseFmtPct(value) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(Number(value))) return 'N/D';
  return `${Number(value).toFixed(1).replace('.', ',')}%`;
}

function analiseLoadingTemplate(message) {
  return `
    <div class="loading-state">${_escN(message)}</div>
  `;
}

function analiseErrorTemplate(message) {
  return `
    <div class="analise-state">
      <div class="analise-state-kicker">Falha</div>
      <div class="analise-state-title">Nao foi possivel carregar a analise.</div>
      <div class="analise-state-copy">${_escN(message)}</div>
    </div>
  `;
}

function analiseEmptyTemplate(message) {
  return `
    <div class="empty-note">${_escN(message)}</div>
  `;
}

function analisePlaceholderTemplate({ kicker, title, copy, cards }) {
  return `
    <div class="analise-state">
      <div class="analise-state-kicker">${_escN(kicker)}</div>
      <div class="analise-state-title">${_escN(title)}</div>
      <div class="analise-state-copy">${_escN(copy)}</div>
      <div class="analise-state-grid">
        ${(cards || []).map(([heading, body]) => `
          <div class="analise-state-card">
            <strong>${_escN(heading)}</strong>
            <span>${_escN(body)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function analiseProdutosElegiveis(produtos, etapas) {
  const produtoIdsComEtapa = new Set((etapas || []).map((etapa) => String(etapa.produto_id)));
  return (produtos || []).filter((produto) => {
    if (!produto || produto._crm) return false;
    if (produto.em_gestao === false) return false;
    return produtoIdsComEtapa.has(String(produto.id));
  });
}

function analiseMontarValorHoraAtual(registros) {
  const mapa = {};
  (registros || []).forEach((registro) => {
    const key = String(registro.usuario_id || '');
    if (!key || mapa[key] !== undefined) return;
    mapa[key] = Number(registro.valor_hora || 0);
  });
  return mapa;
}

function analiseNormalizarNucleo(raw) {
  if (!raw) return null;
  const normalized = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (normalized.includes('urban')) return 'urbanismo';
  if (normalized.includes('paisa')) return 'paisagismo';
  if (normalized.includes('consul')) return 'consultorias';
  if (normalized.includes('espe')) return 'especiais';
  return null;
}

function analiseFixProdutos(produtos) {
  return (produtos || []).map((produto) => {
    const cloned = { ...produto };
    if (cloned.oportunidades) {
      cloned.oportunidades = { ...cloned.oportunidades };
      cloned.oportunidades.projeto = analiseFixMojibake(cloned.oportunidades.projeto);
      cloned.oportunidades.cidade = analiseFixMojibake(cloned.oportunidades.cidade);
      if (cloned.oportunidades.clientes) {
        cloned.oportunidades.clientes = { ...cloned.oportunidades.clientes };
        cloned.oportunidades.clientes.nome = analiseFixMojibake(cloned.oportunidades.clientes.nome);
        cloned.oportunidades.clientes.cidade = analiseFixMojibake(cloned.oportunidades.clientes.cidade);
      }
    }
    cloned.nome = analiseFixMojibake(cloned.nome);
    return cloned;
  });
}

function analiseFixMojibake(value) {
  if (!value) return value;
  return String(value)
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã©/g, 'é')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã­/g, 'í')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã /g, 'à')
    .replace(/Ã¡/g, 'á')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã\u00a3/g, 'ã');
}

function analiseCheckQueryError(error, fallbackMessage) {
  if (error) {
    throw new Error(fallbackMessage);
  }
}
