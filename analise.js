const ANALISE = {
  _produtos: [],
  _etapas: [],
  _horas: [],
  _custos: [],
  _competenciaRows: [],
  _competenciaDisponivel: true,
  _vhPorUser: {},
  _dadosPorProduto: {},
  _dadosPorEtapa: {},
  _abaAtiva: 'acumulado',
  _subtemaAtivo: 'resumo',
  _produtoIsoladoId: null,
  _carregando: false,
  _ultimaCarga: null,
  _erro: null,
  _avisos: {
    usuariosSemVH: [],
    etapasSemBudget: 0,
    budgetDiagnostico: {
      carregado: 0,
      zero: 0,
      vazio: 0,
      sem_campo: 0,
      invalido: 0,
    },
  },
  _filtros: {
    acumulado: { nucleo: '', status: '', risco: '', ordem: 'risco_desc' },
    desenvolvimento: { nucleo: '', statusEtapa: '', risco: '', agrupamento: 'projeto', ordem: 'risco_desc' },
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
    analiseInitExpRoom(boot.usuario?.id, boot.usuario?.nome);
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
  const app = document.getElementById('conteudo');
  if (loading) loading.style.display = 'none';
  if (app) app.style.display = 'flex';
  /* inicializa nav lateral após shell visível */
  if (typeof ExpNav !== 'undefined' && typeof ExpNav.init === 'function') {
    ExpNav.init({ module: 'analise' });
  }
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
  subtitle.textContent = `Módulo independente com carga analítica própria. Sessão autenticada pronta para ${firstName}.`;

  const configBtn = document.getElementById('analise-btn-config');
  if (configBtn) {
    configBtn.hidden = !analisePodeConfigurarMargem(usuario?.role);
  }

  if (isSocioRole(usuario?.role)) {
    document.querySelectorAll('.nd-soc').forEach(el => { el.style.display = ''; });
    const pm = document.getElementById('user-menu-platform');
    if (pm) pm.style.display = '';
  }
}

function analiseBindEventosBase() {
  document.getElementById('analise-tabs-bar')?.addEventListener('click', (event) => {
    const button = event.target.closest('.analise-tab');
    if (!button) return;
    analiseSwitchTab(button.dataset.aba);
  });
  document.getElementById('analise-subtema-bar')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-subtema]');
    if (!button) return;
    analiseSwitchSubtema(button.dataset.subtema);
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

  document.addEventListener('click', (event) => {
    const navMod = document.getElementById('nav-mod-wrap');
    if (navMod && !navMod.contains(event.target)) {
      document.getElementById('nav-dropdown')?.classList.remove('open');
    }
    if (!document.getElementById('feedback-icon-wrap')?.contains(event.target))
      document.getElementById('tool-feedback-pop')?.classList.remove('open');
    const userPill = document.getElementById('user-pill-wrap');
    if (userPill && !userPill.contains(event.target)) {
      document.getElementById('user-dropdown')?.classList.remove('open');
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
      competenciaResp,
    ] = await Promise.all([
      sb.from('horas_lancadas').select('produto_id, etapa_id, usuario_id, hora_inicio, hora_fim'),
      sb.from('lancamentos_custo').select('produto_id, etapa_id, valor'),
      sb.from('historico_valor_hora').select('usuario_id, valor_hora, data_vigencia').order('data_vigencia', { ascending: false }),
      sb.from('competencia_real_etapas').select('*').then(r => r.error ? { data: [], error: r.error } : r),
    ]);

    analiseCheckQueryError(horasResp.error, 'Falha ao carregar horas_lancadas.');
    analiseCheckQueryError(custosResp.error, 'Falha ao carregar lancamentos_custo.');
    analiseCheckQueryError(vhResp.error, 'Falha ao carregar historico_valor_hora.');
    if (competenciaResp.error) {
      ANALISE._competenciaDisponivel = false;
      console.warn('analiseCarregarDados [competencia_real_etapas]:', competenciaResp.error.message);
    } else {
      ANALISE._competenciaDisponivel = true;
    }

    ANALISE._horas = horasResp.data || [];
    ANALISE._custos = custosResp.data || [];
    ANALISE._competenciaRows = competenciaResp.data || [];
    ANALISE._vhPorUser = analiseMontarValorHoraAtual(vhResp.data || []);

    const produtosElegiveis = analiseProdutosElegiveis(G.todosProdutos, G.todasEtapas);
    const produtoIds = new Set(produtosElegiveis.map((produto) => String(produto.id)));

    ANALISE._produtos = produtosElegiveis;
    ANALISE._etapas = (G.todasEtapas || []).filter((etapa) => produtoIds.has(String(etapa.produto_id)));

    analiseAgregarDados();
    ANALISE._ultimaCarga = Date.now();
  } catch (error) {
    ANALISE._erro = error?.message || 'Não foi possível carregar os dados do módulo.';
  } finally {
    ANALISE._carregando = false;
    if (!ANALISE._erro) {
      const subtitleEl = document.getElementById('analise-user-context');
      if (subtitleEl) {
        const nProjetos = ANALISE._produtos.length;
        const totalHoras = Object.values(ANALISE._dadosPorProduto).reduce((sum, item) => sum + item.horasTotais, 0);
        const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        subtitleEl.textContent = `${nProjetos} projetos · ${fmtH(totalHoras)} lançadas · Atualizado às ${hhmm}`;
      }
    }
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
  const budgetDiagnostico = {
    carregado: 0,
    zero: 0,
    vazio: 0,
    sem_campo: 0,
    invalido: 0,
  };
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
      previsao: null,
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
    const budgetMeta = analiseGetBudgetMeta(registro.etapa);
    const budget = budgetMeta.value;
    registro.budgetMeta = budgetMeta;
    registro.utilizacaoBudget = budget > 0
      ? (registro.horasTotais / budget) * 100
      : null;
    if (budgetDiagnostico[budgetMeta.status] !== undefined) {
      budgetDiagnostico[budgetMeta.status] += 1;
    }
    registro.competenciaResumo = analiseCompetenciaResumoEtapa(registro.etapa?.id);
    registro.riscoCompetencia = registro.competenciaResumo.acumulado >= 100 && registro.custoTotal > 1000;
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
      etapaRegistro.efetividade = analiseCalcularEfetividadeEtapa(etapaRegistro);
    });

    registro.statusResumo = analiseDerivarStatusProduto(registro.produto, registro.etapasDados);
    registro.previsao = analiseDerivarPrevisaoProduto(registro);
  });

  ANALISE._dadosPorProduto = dadosPorProduto;
  ANALISE._dadosPorEtapa = dadosPorEtapa;
  ANALISE._avisos.usuariosSemVH = Array.from(usuariosSemVH)
    .map((usuarioId) => G.todosUsuarios.find((usuario) => String(usuario.id) === usuarioId))
    .filter(Boolean);
  ANALISE._avisos.etapasSemBudget = Object.values(dadosPorEtapa)
    .filter((registro) => analiseGetBudgetHoras(registro.etapa) <= 0)
    .length;
  ANALISE._avisos.budgetDiagnostico = budgetDiagnostico;
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

function analiseSwitchSubtema(subtema) {
  ANALISE._subtemaAtivo = subtema || 'resumo';
  document.querySelectorAll('#analise-subtema-bar [data-subtema]').forEach((node) => {
    node.classList.toggle('active', node.dataset.subtema === ANALISE._subtemaAtivo);
  });
  analiseRenderAbaAtiva();
}

function analiseSubtemaResumoHtml() {
  const mapa = {
    resumo: {
      kicker: 'Leitura geral',
      texto: 'Visao consolidada da aba atual, com os principais sinais de custo, margem, risco e carga.',
    },
    rentabilidade: {
      kicker: 'Pergunta central',
      texto: 'Quanto estamos produzindo com margem saudavel, onde o custo esta pesando mais e quais projetos pedem revisao de resultado.',
    },
    risco: {
      kicker: 'Pergunta central',
      texto: 'Quais projetos ou etapas estao pedindo atencao imediata, seja por margem projetada, risco operacional ou desvio de budget.',
    },
    carga: {
      kicker: 'Pergunta central',
      texto: 'Onde a operacao esta concentrando horas e budget agora, e como essa carga se distribui entre etapas, projetos e nucleos.',
    },
  };
  const meta = mapa[ANALISE._subtemaAtivo] || mapa.resumo;
  return `
    <div class="analise-state" style="margin-bottom:14px">
      <div class="analise-state-kicker">${_escN(meta.kicker)}</div>
      <div class="analise-state-copy">${_escN(meta.texto)}</div>
    </div>
  `;
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
    ANALISE._filtros.desenvolvimento = { nucleo: '', statusEtapa: '', risco: '', agrupamento: 'projeto', ordem: 'risco_desc' };
  } else if (aba === 'encerrados') {
    ANALISE._filtros.encerrados = { nucleo: '', ano: '', ordem: 'conclusao_desc' };
  } else if (aba === 'acumulado') {
    ANALISE._filtros.acumulado = { nucleo: '', status: '', risco: '', ordem: 'risco_desc' };
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
  const budgetHoras = etapas.reduce((sum, etapaItem) => sum + analiseGetBudgetHoras(etapaItem.etapa), 0);
  const budgetUtil = budgetHoras > 0 ? (item.horasTotais / budgetHoras) * 100 : null;
  const cliente = item.produto?.oportunidades?.clientes?.nome || 'Cliente não identificado';
  const encerradoEm = item.statusResumo?.concluidoEm ? item.statusResumo.concluidoEm.toLocaleDateString('pt-BR') : 'N/D';
  const margemInfo = analiseClassificarMargem(item.margemPct);
  const previsao = item.previsao || {};

  host.innerHTML = `
    <div class="analise-modal-card">
      <div class="analise-modal-head">
        <div>
          <div class="analise-state-kicker">Leitura isolada</div>
          <h2 class="analise-drill-title" id="analise-modal-title">${_escN(item.produto?.nome || 'Projeto sem nome')}</h2>
          <div class="analise-drill-sub">${_escN(cliente)} | ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')} | ${_escN(item.statusResumo?.statusLabel || 'N/D')}</div>
        </div>
        <button type="button" class="btn sm" data-modal-close="1">Fechar</button>
      </div>
      <div class="analise-kpis-row">
        ${analiseKpiCard('Horas totais', fmtH(item.horasTotais), `${concluidas}/${etapas.length} etapas concluídas`)}
        ${analiseKpiCard('Custo total', analiseFmtMoney(item.custoTotal), 'HH + custos lançados')}
        ${analiseKpiCard('Margem', analiseFmtPct(item.margemPct), analiseFmtMoney(item.margem, item.margem === null))}
        ${analiseKpiCard('Budget consolidado', budgetHoras > 0 ? fmtH(budgetHoras) : 'N/D', budgetHoras > 0 ? `Uso atual ${analiseFmtPct(budgetUtil)}` : 'Nenhuma etapa com budget carregado')}
        ${analiseKpiCard('Margem projetada', analiseFmtPct(previsao.margemProjetadaPct), analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}
      </div>
      <div class="analise-drill-meta">
        <span class="analise-chip analise-chip-muted">Fase: ${_escN(item.statusResumo?.faseLabel || 'N/D')}</span>
        <span class="analise-chip analise-chip-muted">Encerrado em: ${_escN(encerradoEm)}</span>
        <span class="${margemInfo.cls}">${_escN(margemInfo.label)}</span>
        <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(previsao.riscoLabel || 'Sem previsão')}</span>
        <span class="analise-chip analise-chip-muted">Confiança: ${_escN(previsao.confiancaLabel || 'Baixa')}</span>
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

function analiseGetBudgetHoras(etapa) {
  return analiseGetBudgetMeta(etapa).value;
}

function analiseToNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function analiseGetBudgetMeta(etapa) {
  if (!etapa || typeof etapa !== 'object') {
    return { value: 0, status: 'sem_campo', source: null, raw: null, label: 'Sem campo', detail: 'Nenhum campo de budget encontrado na etapa.' };
  }

  const candidates = [
    { key: 'budget_horas', label: 'budget_horas' },
    { key: 'budgetHoras', label: 'budgetHoras' },
    { key: 'horas_orcadas', label: 'horas_orcadas' },
    { key: 'horas_previstas', label: 'horas_previstas' },
    { key: 'horas_planejadas', label: 'horas_planejadas' },
    { key: 'orcamento_horas', label: 'orcamento_horas' },
  ];

  let firstExisting = null;
  for (const candidate of candidates) {
    if (!Object.prototype.hasOwnProperty.call(etapa, candidate.key)) continue;
    const raw = etapa[candidate.key];
    if (firstExisting === null) {
      firstExisting = { ...candidate, raw };
    }
    if (raw === null || raw === '') continue;
    const parsed = analiseToNumber(raw);
    if (parsed > 0) {
      return {
        value: parsed,
        status: 'carregado',
        source: candidate.key,
        raw,
        label: 'Carregado',
        detail: `${candidate.label}: ${parsed}`,
      };
    }
  }

  if (!firstExisting) {
    return { value: 0, status: 'sem_campo', source: null, raw: null, label: 'Sem campo', detail: 'Nenhum campo de budget encontrado na etapa.' };
  }

  if (firstExisting.raw === null || firstExisting.raw === '') {
    return { value: 0, status: 'vazio', source: firstExisting.key, raw: firstExisting.raw, label: 'Vazio', detail: `${firstExisting.label} existe, mas esta vazio.` };
  }

  const parsed = analiseToNumber(firstExisting.raw);
  if (parsed === 0) {
    return { value: 0, status: 'zero', source: firstExisting.key, raw: firstExisting.raw, label: 'Zero', detail: `${firstExisting.label} esta preenchido com zero.` };
  }

  return { value: 0, status: 'invalido', source: firstExisting.key, raw: firstExisting.raw, label: 'Invalido', detail: `${firstExisting.label} nao pode ser convertido para numero.` };
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
    throw new Error('Faixa de atenção inválida.');
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
      <span class="analise-inline-chip atencao">Atenção</span> entre ${atencaoMin}% e ${saudavelMin}%<br>
      <span class="analise-inline-chip saudavel">Saudável</span> acima de ${saudavelMin}%
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
    toast(`Configuração salva: risco abaixo de ${next.margem_threshold}%.`);
  } catch (error) {
    toast(error.message || 'Não foi possível salvar a configuração.');
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
    panel.innerHTML = analiseEmptyTemplate('Nenhum projeto elegível foi encontrado para a análise.');
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
  const produtosComPrevisao = produtos.filter((item) => item.previsao?.margemProjetadaPct !== null);
  const margemProjetadaMedia = produtosComPrevisao.length
    ? produtosComPrevisao.reduce((sum, item) => sum + Number(item.previsao?.margemProjetadaPct || 0), 0) / produtosComPrevisao.length
    : null;

  panel.innerHTML = `
    ${analiseWarningsHtml()}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Projetos na leitura', String(produtos.length), produtos.length === produtosBase.length ? 'Base completa elegível' : `${produtosBase.length} elegíveis no total`)}
      ${analiseKpiCard('Horas lançadas', fmtH(horasTotal), 'Soma de horas com produto associado')}
      ${analiseKpiCard('Custo total', analiseFmtMoney(custoTotal), 'HH + custos lançados')}
      ${analiseKpiCardSemantic('Margem ponderada', analiseFmtPct(margemPonderada), 'Baseada em valor contratado conhecido', analiseMargemKpiCls(margemPonderada))}
      ${analiseKpiCardSemantic('Margem projetada média', analiseFmtPct(margemProjetadaMedia), 'Heurística inicial baseada em budget e estágio', analiseMargemKpiCls(margemProjetadaMedia))}
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Risco projetado</div>
        ${analiseGraficoRiscoProjetado(produtos)}
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

  const comBudget = etapas.filter((item) => analiseGetBudgetHoras(item.etapa) > 0);
  const acimaBudget = comBudget.filter((item) => Number(item.utilizacaoBudget || 0) > 100);
  const etapasEfetivas = etapas.filter((item) => item.efetividade?.score != null);
  const etapasEfSaudavel = etapasEfetivas.filter((item) => (item.efetividade?.score || 0) >= 75);
  const etapasEfAtencao = etapasEfetivas.filter((item) => {
    const score = item.efetividade?.score;
    return score != null && score >= 50 && score < 75;
  });
  const etapasEfCritica = etapasEfetivas.filter((item) => (item.efetividade?.score || 0) < 50);
  const rowsProjeto = analiseAgruparEtapasAtivasPorProjeto(etapas);
  const projetosEmRisco = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'risco');
  const projetosAtencao = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'atencao');
  const projetosSaudavel = rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'saudavel');

  panel.innerHTML = `
    ${analiseSemaforoCompacto([
      { key: 'risco', label: 'Risco', count: projetosEmRisco.length },
      { key: 'atencao', label: 'Atenção', count: projetosAtencao.length },
      { key: 'saudavel', label: 'Saudável', count: projetosSaudavel.length },
    ])}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Etapas ativas', String(etapas.length), 'Em andamento ou em revisão')}
      ${analiseKpiCard('Com budget', String(comBudget.length), 'Etapas com budget carregado')}
      ${analiseKpiCard('Acima do budget', String(acimaBudget.length), 'Utilizacao acima de 100%')}
      ${analiseKpiCard('Projetos em execução', String(rowsProjeto.length), 'Com pelo menos uma etapa ativa')}
      ${analiseKpiCard('Risco projetado', String(projetosEmRisco.length), `${projetosAtencao.length} em atenção pela projeção atual`)}
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
            { value: 'em_revisao', label: STATUS_ETAPA.em_revisao?.label || 'Em revisão' },
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
    panel.innerHTML = analiseLoadingTemplate('Carregando histórico de encerrados...');
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
      ${analiseKpiCard('Custo encerrado', analiseFmtMoney(encerrados.reduce((sum, item) => sum + item.custoTotal, 0)), 'HH + custos lançados')}
      ${analiseKpiCard('Margem média', analiseFmtPct(margemMedia), 'Média simples da margem percentual')}
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
        <div class="analise-visual-title">Histórico de margem</div>
        ${analiseGraficoMargemHistorica(encerrados)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Margem por núcleo</div>
        ${analiseGraficoMargemPorNucleo(encerrados)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Custo encerrado por núcleo</div>
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
    title: 'Aba reservada para eficiência por pessoa',
    copy: `A base atual já conhece ${G.todosUsuarios.length} usuários ativos e ${ANALISE._horas.length} lançamentos de horas. A leitura por pessoa entra quando a camada financeira e operacional estiver estabilizada.`,
    cards: [
      ['Usuários ativos', String(G.todosUsuarios.length)],
      ['Lançamentos', String(ANALISE._horas.length)],
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
    { value: 'risco_desc', label: 'Maior risco projetado' },
    { value: 'risco_asc', label: 'Menor risco projetado' },
    { value: 'margem_proj_asc', label: 'Menor margem projetada' },
    { value: 'margem_proj_desc', label: 'Maior margem projetada' },
    { value: 'delta_proj_desc', label: 'Maior queda projetada' },
    { value: 'nome', label: 'Nome do projeto' },
    { value: 'horas_desc', label: 'Mais horas' },
    { value: 'custo_desc', label: 'Maior custo' },
    { value: 'margem_asc', label: 'Menor margem' },
    { value: 'margem_desc', label: 'Maior margem' },
  ];
}

function analiseDesenvolvimentoOrderOptions() {
  return [
    { value: 'risco_desc', label: 'Maior risco projetado' },
    { value: 'risco_asc', label: 'Menor risco projetado' },
    { value: 'margem_proj_asc', label: 'Menor margem projetada' },
    { value: 'margem_proj_desc', label: 'Maior margem projetada' },
    { value: 'delta_proj_desc', label: 'Maior queda projetada' },
    { value: 'budget_desc', label: 'Maior uso de budget' },
    { value: 'horas_desc', label: 'Mais horas' },
    { value: 'nome', label: 'Nome do projeto' },
  ];
}

function analiseRiscoOptions(includeIncerto = true) {
  const base = [{ value: '', label: 'Todos' }];
  const items = [
    { value: 'risco', label: 'Em risco' },
    { value: 'atencao', label: 'Atenção' },
    { value: 'saudavel', label: 'Saudável' },
  ];
  if (includeIncerto) {
    items.push({ value: 'incerto', label: 'Incerto' });
  }
  return base.concat(items);
}

function analiseRiscoRank(riscoKey) {
  if (riscoKey === 'risco') return 4;
  if (riscoKey === 'atencao') return 3;
  if (riscoKey === 'incerto') return 2;
  if (riscoKey === 'saudavel') return 1;
  return 0;
}

function analiseDeltaMargemProjetada(item) {
  const atual = Number(item?.margemPct);
  const projetada = Number(item?.previsao?.margemProjetadaPct);
  if (!Number.isFinite(atual) || !Number.isFinite(projetada)) return null;
  return atual - projetada;
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
  if (ordem === 'risco_desc') return analiseRiscoRank(b.previsao?.riscoKey) - analiseRiscoRank(a.previsao?.riscoKey);
  if (ordem === 'risco_asc') return analiseRiscoRank(a.previsao?.riscoKey) - analiseRiscoRank(b.previsao?.riscoKey);
  if (ordem === 'margem_proj_asc') return analiseSortNullLastAsc(a.previsao?.margemProjetadaPct, b.previsao?.margemProjetadaPct);
  if (ordem === 'margem_proj_desc') return analiseSortNullLastDesc(a.previsao?.margemProjetadaPct, b.previsao?.margemProjetadaPct);
  if (ordem === 'delta_proj_desc') return analiseSortNullLastDesc(analiseDeltaMargemProjetada(a), analiseDeltaMargemProjetada(b));
  if (ordem === 'horas_desc') return Number(b.horasTotais || 0) - Number(a.horasTotais || 0);
  if (ordem === 'custo_desc') return Number(b.custoTotal || 0) - Number(a.custoTotal || 0);
  if (ordem === 'margem_asc') return analiseSortNullLastAsc(a.margemPct, b.margemPct);
  if (ordem === 'margem_desc') return analiseSortNullLastDesc(a.margemPct, b.margemPct);
  return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
}

function analiseOrdenarProjetosDesenvolvimento(a, b, ordem) {
  const prevA = a.produtoRegistro?.previsao || {};
  const prevB = b.produtoRegistro?.previsao || {};
  const budgetPctA = a.budgetHoras > 0 ? (a.horasTotais / a.budgetHoras) * 100 : null;
  const budgetPctB = b.budgetHoras > 0 ? (b.horasTotais / b.budgetHoras) * 100 : null;
  const deltaA = analiseDeltaMargemProjetada(a.produtoRegistro);
  const deltaB = analiseDeltaMargemProjetada(b.produtoRegistro);

  if (ordem === 'risco_desc') return analiseRiscoRank(prevB.riscoKey) - analiseRiscoRank(prevA.riscoKey);
  if (ordem === 'risco_asc') return analiseRiscoRank(prevA.riscoKey) - analiseRiscoRank(prevB.riscoKey);
  if (ordem === 'margem_proj_asc') return analiseSortNullLastAsc(prevA.margemProjetadaPct, prevB.margemProjetadaPct);
  if (ordem === 'margem_proj_desc') return analiseSortNullLastDesc(prevA.margemProjetadaPct, prevB.margemProjetadaPct);
  if (ordem === 'delta_proj_desc') return analiseSortNullLastDesc(deltaA, deltaB);
  if (ordem === 'budget_desc') return analiseSortNullLastDesc(budgetPctA, budgetPctB);
  if (ordem === 'horas_desc') return Number(b.horasTotais || 0) - Number(a.horasTotais || 0);
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

function analiseDerivarPrevisaoProduto(registro) {
  const etapas = registro.etapasDados || [];
  const contratado = Number(registro.produto?.valor_contratado || 0);
  const taxaProjeto = registro.horasTotais > 0 ? registro.custoHH / registro.horasTotais : 0;
  const taxaFallback = taxaProjeto > 0 ? taxaProjeto : analiseTaxaHoraFallback();

  let custoHHProjetado = 0;
  let etapasComBudget = 0;
  let etapasSemBudget = 0;
  let etapasEstouradas = 0;

  etapas.forEach((etapaItem) => {
    const budgetMeta = etapaItem.budgetMeta || analiseGetBudgetMeta(etapaItem.etapa);
    const horasReais = Number(etapaItem.horasTotais || 0);
    const status = etapaItem.etapa?.status || 'nao_iniciada';
    let horasProjetadas = horasReais;

    if (budgetMeta.status === 'carregado') {
      etapasComBudget += 1;
      const budget = budgetMeta.value;
      if (horasReais > budget) etapasEstouradas += 1;

      if (status === 'concluida') horasProjetadas = Math.max(horasReais, budget);
      else if (status === 'em_andamento') horasProjetadas = Math.max(horasReais * 1.12, budget);
      else if (status === 'em_revisao') horasProjetadas = Math.max(horasReais * 1.08, budget);
      else if (status === 'nao_iniciada') horasProjetadas = budget;
      else if (status === 'pausada') horasProjetadas = Math.max(horasReais, budget * 0.5);
    } else {
      etapasSemBudget += 1;
      if (status === 'concluida') horasProjetadas = horasReais;
      else if (status === 'em_andamento') horasProjetadas = horasReais * 1.2;
      else if (status === 'em_revisao') horasProjetadas = horasReais * 1.1;
      else horasProjetadas = horasReais;
    }

    custoHHProjetado += horasProjetadas * (taxaProjeto > 0 && horasReais > 0 ? etapaItem.custoHH / horasReais : taxaFallback);
  });

  const custoProjetado = custoHHProjetado + Number(registro.custosLancados || 0);
  const margemProjetada = contratado > 0 ? contratado - custoProjetado : null;
  const margemProjetadaPct = contratado > 0 ? (margemProjetada / contratado) * 100 : null;
  const coberturaBudget = etapas.length > 0 ? etapasComBudget / etapas.length : 0;
  const confiancaLabel = coberturaBudget >= 0.8 ? 'Alta' : coberturaBudget >= 0.45 ? 'Média' : 'Baixa';
  const riscoAtual = analiseClassificarMargem(margemProjetadaPct);
  const riscoKey = margemProjetadaPct === null
    ? 'incerto'
    : margemProjetadaPct < analiseGetConfig().margem_threshold
      ? 'risco'
      : margemProjetadaPct < analiseGetConfig().margem_threshold + analiseGetConfig().margem_atencao
        ? 'atencao'
        : 'saudavel';

  return {
    custoProjetado,
    margemProjetada,
    margemProjetadaPct,
    coberturaBudget,
    etapasComBudget,
    etapasSemBudget,
    etapasEstouradas,
    confiancaLabel,
    riscoKey,
    riscoLabel: riscoKey === 'risco' ? 'Risco projetado' : riscoKey === 'atencao' ? 'Atenção projetada' : riscoKey === 'saudavel' ? 'Saudável projetado' : 'Incerteza alta',
    riscoCss: riscoAtual.cls,
  };
}

function analiseTaxaHoraFallback() {
  const projetos = Object.values(ANALISE._dadosPorProduto || {});
  const horas = projetos.reduce((sum, item) => sum + Number(item.horasTotais || 0), 0);
  const custoHH = projetos.reduce((sum, item) => sum + Number(item.custoHH || 0), 0);
  return horas > 0 ? custoHH / horas : 0;
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
  if (faseKey === 'revisao') return 'Em revisão';
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
        produtoRegistro: item.produtoRegistro,
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
    const budgetHoras = analiseGetBudgetHoras(item.etapa);
    if (budgetHoras > 0) {
      byProduto[produtoId].budgetHoras += budgetHoras;
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
                <div class="analise-table-sub">${_escN(row.etapas.map((item) => item.etapa?.nome || `Etapa ${item.etapa?.ordem || ''}`).join(' | '))}</div>
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
                <div class="analise-table-sub">${_escN(`${NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D'} | ${item.produtoRegistro?.statusResumo?.faseLabel || 'Fila'}`)}</div>
              </td>
              <td>${_escN(item.etapa?.nome || `Etapa ${item.etapa?.ordem || 'N/D'}`)}</td>
              <td>${analiseStatusEtapaBadge(item.etapa?.status)}</td>
              <td>${_escN(fmtH(item.horasTotais))}</td>
              <td>${analiseBudgetCell(item.budgetMeta || analiseGetBudgetMeta(item.etapa))}</td>
              <td>${analiseBudgetBadge(item.utilizacaoBudget, item.budgetMeta || analiseGetBudgetMeta(item.etapa))}</td>
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
        const budgetMeta = etapaItem.budgetMeta || analiseGetBudgetMeta(etapaItem.etapa);
        const budget = budgetMeta.value;
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
              <span class="analise-chip ${classe}">${budget > 0 ? _escN(analiseFmtPct(uso)) : _escN(budgetMeta.label)}</span>
            </div>
            <div class="analise-budget-bar">
              <div class="analise-budget-fill ${classe}" style="width:${largura}%"></div>
            </div>
            <div class="analise-budget-meta">
              <span>${_escN(fmtH(etapaItem.horasTotais))} consumidas</span>
              <span>${budget > 0 ? _escN(fmtH(budget)) + ' de budget' : _escN(budgetMeta.detail || 'budget nao definido')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function analiseProdutosMargemNucleo(produtos) {
  return (produtos || []).filter((item) => {
    const etapas = item.etapasDados || [];
    const temHorasConcluidas = etapas.some((etapaItem) =>
      etapaItem.etapa?.status === 'concluida' && Number(etapaItem.horasTotais || 0) > 0
    );
    return item.statusResumo?.statusKey === 'encerrado'
      && Number(item.horasTotais || 0) > 0
      && temHorasConcluidas
      && Number(item.produto?.valor_contratado || 0) > 0;
  });
}

function analiseGraficoMargemPorNucleo(produtos) {
  const base = analiseProdutosMargemNucleo(produtos);
  if (!base.length) {
    return '<div class="empty-note">Sem projetos encerrados com horas concluídas para compor a margem por núcleo.</div>';
  }

  const rows = Object.entries(
    base.reduce((acc, item) => {
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
    <div class="analise-chart-copy">Base formada apenas por projetos encerrados com horas vinculadas a etapas concluídas.</div>
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Margem por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        const pct = Math.max(0, Math.min(100, Number(row.margemPct || 0)));
        const margem = Number(row.margemPct || 0);
        const cor = margem < 10
          ? 'var(--terracota)'
          : margem < 20
            ? 'var(--ouro)'
            : margem < 30
              ? 'var(--azul)'
              : 'var(--verde)';
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 12}" width="${maxWidth}" height="14" rx="7" fill="var(--off)"></rect>
          <rect x="102" y="${y - 12}" width="${(maxWidth * pct) / 100}" height="14" rx="7" fill="${cor}"></rect>
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
  return analiseGraficoDistribuicaoSimples(counts, 'Leitura do portfólio por status canônico.');
}

function analiseGraficoContratoVsCusto(contratadoTotal, custoTotal) {
  if (Number(contratadoTotal || 0) <= 0) {
    return '<div class="empty-note">Sem base contratual suficiente para comparar contrato e custo.</div>';
  }
  const pct = Math.max(0, Math.min(100, (Number(custoTotal || 0) / Number(contratadoTotal || 1)) * 100));
  return `
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
    { label: STATUS_ETAPA.em_revisao?.label || 'Em revisão', count: etapas.filter((item) => item.etapa?.status === 'em_revisao').length, color: '#D19931' },
  ];
  return analiseGraficoDistribuicaoSimples(counts, 'Separação das etapas ativas entre produção e revisão.');
}

function analiseGraficoResumoBudgetAtivo(etapas) {
  const comBudget = etapas.filter((item) => analiseGetBudgetHoras(item.etapa) > 0);
  if (!comBudget.length) {
    return '<div class="empty-note">Nenhuma etapa ativa tem budget carregado.</div>';
  }
  const faixas = [
    { label: 'Saudável', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) < 85).length, color: '#45865D' },
    { label: 'Atenção', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) >= 85 && Number(item.utilizacaoBudget || 0) <= 100).length, color: '#D19931' },
    { label: 'Estourado', count: comBudget.filter((item) => Number(item.utilizacaoBudget || 0) > 100).length, color: '#C36247' },
  ];
  return analiseGraficoDistribuicaoSimples(faixas, 'Panorama rapido do uso do budget nas etapas em curso.');
}

function analiseGraficoCargaNucleoAtivo(etapas) {
  if (!etapas.length) {
    return '<div class="empty-note">Sem etapas ativas para compor a carga por núcleo.</div>';
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
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Carga ativa por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 12}" width="210" height="14" rx="7" fill="var(--off)"></rect>
          <rect x="102" y="${y - 12}" width="${(210 * row.horas) / maxHoras}" height="14" rx="7" fill="${NUCLEO_COR[row.key]?.dot || 'var(--grafite)'}"></rect>
          <text x="312" y="${y}" text-anchor="end" class="svg-value">${_escN(fmtH(row.horas))}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function analiseGraficoMargemHistorica(encerrados) {
  if (!(encerrados || []).length) {
    return '<div class="empty-note">Sem projetos encerrados para formar a série histórica.</div>';
  }

  const rows = encerrados
    .slice(0, 8)
    .sort((a, b) => (b.concluidoEm?.getTime() || 0) - (a.concluidoEm?.getTime() || 0));
  const maxPct = Math.max(...rows.map((item) => Math.abs(Number(item.margemPct || 0))), 1);
  const axisX = 172;
  const chartWidth = 112;
  const chartHeight = 42 + rows.length * 28;

  return `
    <svg class="analise-svg-chart" viewBox="0 0 320 ${chartHeight}" aria-label="Histórico de margem dos encerrados">
      <line x1="${axisX}" y1="18" x2="${axisX}" y2="${chartHeight - 10}" stroke="var(--cinza2)" stroke-width="1"></line>
      ${rows.map((item, index) => {
        const value = Number(item.margemPct || 0);
        const width = (chartWidth * Math.abs(value)) / maxPct;
        const y = 30 + index * 28;
        const x = value >= 0 ? axisX : axisX - width;
        const cor = value < 20 ? 'var(--terracota)' : value < 25 ? 'var(--ouro)' : 'var(--verde)';
        return `
          <text x="16" y="${y + 4}" class="svg-label">${_escN((item.concluidoEm || new Date()).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }))}</text>
          <rect x="${x}" y="${y - 8}" width="${width}" height="14" rx="7" fill="${cor}"></rect>
          <text x="${value >= 0 ? Math.min(304, axisX + width + 6) : Math.max(76, axisX - width - 6)}" y="${y + 4}" text-anchor="${value >= 0 ? 'start' : 'end'}" class="svg-value">${_escN(analiseFmtPct(value))}</text>
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
    <svg class="analise-svg-chart" viewBox="0 0 320 ${60 + rows.length * 24}" aria-label="Custo por nucleo">
      ${rows.map((row, index) => {
        const y = 28 + index * 24;
        return `
          <text x="16" y="${y}" class="svg-label">${_escN(row.label)}</text>
          <rect x="102" y="${y - 12}" width="210" height="14" rx="7" fill="var(--off)"></rect>
          <rect x="102" y="${y - 12}" width="${(210 * row.custo) / max}" height="14" rx="7" fill="${NUCLEO_COR[row.key]?.dot || 'var(--grafite)'}"></rect>
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

function analiseGraficoRiscoProjetado(produtos) {
  const rows = [
    { key: 'risco', label: 'Risco', color: '#C36247' },
    { key: 'atencao', label: 'Atenção', color: '#D19931' },
    { key: 'saudavel', label: 'Saudável', color: '#45865D' },
    { key: 'incerto', label: 'Incerteza', color: '#8E8E8E' },
  ].map((row) => ({
    ...row,
    count: (produtos || []).filter((item) => (item.previsao?.riscoKey || 'incerto') === row.key).length,
  }));

  const coberturaAlta = (produtos || []).filter((item) => Number(item.previsao?.coberturaBudget || 0) >= 0.8).length;
  return `
    ${analiseGraficoDistribuicaoSimples(rows, '')}
    <div class="analise-budget-meta" style="margin-top:10px">
      <span>${_escN(String(coberturaAlta))} projeto(s) com cobertura de budget alta</span>
      <span>${_escN(String(Math.max(0, (produtos || []).length - coberturaAlta)))} com previsão mais heurística</span>
    </div>
  `;
}

function analiseGraficoSemaforoProjetos(rowsProjeto) {
  if (!(rowsProjeto || []).length) {
    return '<div class="empty-note">Nenhum projeto ativo suficiente para compor o semáforo.</div>';
  }

  const grupos = [
    { key: 'risco', label: 'Risco', color: '#C36247', fill: 'var(--terracota-soft)' },
    { key: 'atencao', label: 'Atenção', color: '#D19931', fill: 'var(--ouro-soft)' },
    { key: 'saudavel', label: 'Saudável', color: '#45865D', fill: 'var(--verde-soft)' },
  ].map((item) => ({
    ...item,
    count: rowsProjeto.filter((row) => row.produtoRegistro?.previsao?.riscoKey === item.key).length,
  }));

  const topRisco = rowsProjeto
    .filter((row) => row.produtoRegistro?.previsao?.riscoKey === 'risco')
    .slice(0, 3)
    .map((row) => row.produto?.nome || 'Projeto sem nome');

  return `
    <svg class="analise-svg-chart" viewBox="0 0 320 150" aria-label="Semáforo de risco dos projetos ativos">
      ${grupos.map((grupo, index) => {
        const x = 24 + index * 96;
        return `
          <circle cx="${x + 36}" cy="54" r="24" fill="${grupo.fill}" stroke="${grupo.color}" stroke-width="3"></circle>
          <text x="${x + 36}" y="59" text-anchor="middle" class="svg-value">${grupo.count}</text>
          <text x="${x + 36}" y="94" text-anchor="middle" class="svg-label">${_escN(grupo.label)}</text>
        `;
      }).join('')}
      <text x="16" y="126" class="svg-label">Projetos ativos no foco imediato</text>
      <text x="304" y="126" text-anchor="end" class="svg-value">${_escN(String(rowsProjeto.length))}</text>
    </svg>
    <div class="analise-budget-meta" style="margin-top:10px">
      <span>${topRisco.length ? _escN(`Prioridade: ${topRisco.join(' | ')}`) : 'Sem projetos em risco alto nesta leitura.'}</span>
    </div>
  `;
}

function analiseGraficoProjecaoProjeto(item) {
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
      <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(previsao.riscoLabel || 'Sem previsão')}</span>
      <span>${_escN(`${previsao.etapasEstouradas || 0} etapa(s) acima do budget | confiança ${previsao.confiancaLabel || 'Baixa'}`)}</span>
    </div>
  `;
}

function analiseRiscoChipClass(riscoKey) {
  if (riscoKey === 'risco') return 'analise-chip analise-chip-risk';
  if (riscoKey === 'atencao') return 'analise-chip analise-chip-warn';
  if (riscoKey === 'saudavel') return 'analise-chip analise-chip-ok';
  return 'analise-chip analise-chip-muted';
}

function analiseCompetenciaResumoEtapa(etapaId) {
  const rows = (ANALISE._competenciaRows || []).filter((row) => String(row.etapa_id || '') === String(etapaId || ''));
  const acumulado = rows.reduce((sum, row) => sum + Number(row.percentual || 0), 0);
  return {
    acumulado,
    saldo: Math.max(0, 100 - acumulado),
  };
}

function analisePrazoResumoEtapa(etapa) {
  if (!etapa?.data_liberacao) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  const lib = String(etapa.data_liberacao || '').slice(0, 10);
  const prev = String(etapa.data_estimada || '').slice(0, 10) || null;
  const conc = String(etapa.data_conclusao || '').slice(0, 10) || null;
  const diff = (a, b) => {
    if (!a || !b) return null;
    const ini = new Date(`${a}T12:00:00`);
    const fim = new Date(`${b}T12:00:00`);
    return Math.round((fim - ini) / 86400000);
  };
  const diasPrev = prev ? diff(lib, prev) : null;
  const diasReal = conc ? diff(lib, conc) : null;
  const atrasoConcluido = diasPrev != null && diasReal != null ? (diasReal - diasPrev) : null;
  const atrasoAtual = prev ? diff(prev, hoje) : null;
  return {
    atrasoConcluido,
    atrasoAtual,
    emAtrasoHoje: atrasoAtual != null && atrasoAtual > 0 && etapa.status !== 'concluida',
  };
}

function analiseClassificarEfetividade(score) {
  if (score == null) return { label: 'N/D', chipCls: 'analise-chip analise-chip-muted', toneCls: '' };
  if (score >= 75) return { label: 'Saudavel', chipCls: 'analise-chip analise-chip-ok', toneCls: 'kpi-saudavel' };
  if (score >= 50) return { label: 'Atencao', chipCls: 'analise-chip analise-chip-warn', toneCls: 'kpi-atencao' };
  return { label: 'Critica', chipCls: 'analise-chip analise-chip-risk', toneCls: 'kpi-risco' };
}

function analiseEfetividadeBadge(efetividade) {
  if (!efetividade || efetividade.score == null) {
    return `<span class="analise-chip analise-chip-muted">N/D</span>`;
  }
  return `<span class="${efetividade.chipCls}">${_escN(`${efetividade.label} · ${efetividade.score}/100`)}</span>`;
}

function analiseCalcularEfetividadeEtapa(registro) {
  const etapa = registro?.etapa;
  if (!etapa || etapa.status === 'nao_iniciada') {
    return { score: null, ...analiseClassificarEfetividade(null), motivos: ['Etapa ainda nao iniciada.'] };
  }

  let score = 100;
  const motivos = [];
  const prazo = analisePrazoResumoEtapa(etapa);
  const resultado = registro?.margem;
  const utilPct = Number(registro?.utilizacaoBudget);
  const compResumo = analiseCompetenciaResumoEtapa(etapa.id);
  const riscoCompetencia = compResumo.acumulado >= 100 && Number(registro?.custoTotal || 0) > 1000;

  if (resultado != null) {
    if (resultado < 0) {
      score -= 28;
      motivos.push('Saldo negativo na etapa.');
    } else if (resultado === 0) {
      score -= 10;
      motivos.push('Saldo zerado, sem folga.');
    }
  }

  if (Number.isFinite(utilPct)) {
    if (utilPct > 120) {
      score -= 30;
      motivos.push('Uso acima de 120% do budget.');
    } else if (utilPct > 100) {
      score -= 18;
      motivos.push('Uso acima do budget.');
    } else if (utilPct >= 85) {
      score -= 8;
      motivos.push('Uso perto do limite do budget.');
    }
  }

  if (prazo?.atrasoConcluido != null) {
    if (prazo.atrasoConcluido > 15) {
      score -= 22;
      motivos.push('Etapa concluida com atraso alto.');
    } else if (prazo.atrasoConcluido > 0) {
      score -= 12;
      motivos.push('Etapa concluida com atraso.');
    }
  } else if (prazo?.emAtrasoHoje) {
    if (prazo.atrasoAtual > 15) {
      score -= 22;
      motivos.push('Etapa ativa com atraso alto.');
    } else if (prazo.atrasoAtual > 0) {
      score -= 12;
      motivos.push('Etapa ativa em atraso.');
    }
  }

  if (etapa.status === 'concluida' && compResumo.acumulado < 100) {
    score -= 14;
    motivos.push('Concluida sem 100% de competencia.');
  } else if (Number(registro?.horasTotais || 0) > 0 && compResumo.acumulado === 0) {
    score -= 12;
    motivos.push('Horas lancadas sem competencia registrada.');
  }

  if (riscoCompetencia) {
    score -= 24;
    motivos.push('Risco de competencia ativo.');
  }

  if (!motivos.length) {
    motivos.push('Leitura estavel com base em budget, saldo, prazo e competencia.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    ...analiseClassificarEfetividade(score),
    motivos,
    compResumo,
    riscoCompetencia,
  };
}

function analiseBudgetBadge(utilizacaoBudget, temBudget) {
  const budgetMeta = typeof temBudget === 'object' ? temBudget : null;
  const hasBudget = budgetMeta ? budgetMeta.status === 'carregado' : !!temBudget;
  if (!hasBudget) {
    const label = budgetMeta ? budgetMeta.label : 'N/D';
    return `<span class="analise-chip analise-chip-muted">${_escN(label)}</span>`;
  }
  const pct = Number(utilizacaoBudget || 0);
  const cls = pct > 100 ? 'analise-chip-risk' : pct >= 85 ? 'analise-chip-warn' : 'analise-chip-ok';
  return `<span class="analise-chip ${cls}">${_escN(analiseFmtPct(pct))}</span>`;
}

function analiseBudgetCell(budgetMeta) {
  if (!budgetMeta || budgetMeta.status !== 'carregado') {
    const label = budgetMeta?.label || 'N/D';
    const detail = budgetMeta?.source ? `Campo ${budgetMeta.source}` : 'Sem origem detectada';
    return `
      <div class="analise-table-main">${_escN(label)}</div>
      <div class="analise-table-sub">${_escN(detail)}</div>
    `;
  }
  return `
    <div class="analise-table-main">${_escN(fmtH(budgetMeta.value))}</div>
    <div class="analise-table-sub">${_escN(budgetMeta.source || 'budget')}</div>
  `;
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

function analiseKpiCardSemantic(label, value, sub, colorCls) {
  return `
    <div class="analise-kpi">
      <div class="analise-kpi-label">${_escN(label)}</div>
      <div class="analise-kpi-val${colorCls ? ` ${colorCls}` : ''}">${_escN(value)}</div>
      <div class="analise-kpi-sub">${_escN(sub)}</div>
    </div>
  `;
}

function analiseMargemKpiCls(margemPct) {
  const cls = analiseClassificarMargem(margemPct).cls;
  if (cls === 'margem-risco') return 'kpi-risco';
  if (cls === 'margem-atencao') return 'kpi-atencao';
  if (cls === 'margem-saudavel') return 'kpi-saudavel';
  return '';
}

function analiseSemaforoCompacto(grupos) {
  if (!(grupos || []).some((g) => g.count > 0)) return '';
  return `
    <div class="analise-semaforo-compacto">
      ${grupos.map((g) => `
        <div class="analise-semaforo-item semaforo-${_escN(g.key)}">
          <span class="analise-semaforo-num">${_escN(String(g.count))}</span>
          <span class="analise-semaforo-lbl">${_escN(g.label)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function analiseWarningsHtml() {
  const usuarios = ANALISE._avisos.usuariosSemVH || [];
  const etapasSemBudget = Number(ANALISE._avisos.etapasSemBudget || 0);
  const budgetDiagnostico = ANALISE._avisos.budgetDiagnostico || {};
  const chunks = [];

  if (usuarios.length) {
    const nomes = usuarios.slice(0, 5).map((usuario) => usuario.nome || `#${usuario.id}`).join(', ');
    const extra = usuarios.length > 5 ? ` e mais ${usuarios.length - 5}` : '';
    chunks.push(`
      <div class="analise-warning">
        <strong>Aviso de custo:</strong> ${usuarios.length} usuario(s) com horas lancadas ainda nao possuem valor/hora vigente. O custo de HH desses casos esta zerado. ${_escN(nomes + extra)}.
      </div>
    `);
  }

  if (etapasSemBudget > 0) {
    const parts = [
      budgetDiagnostico.sem_campo ? `${budgetDiagnostico.sem_campo} sem campo` : null,
      budgetDiagnostico.vazio ? `${budgetDiagnostico.vazio} vazia(s)` : null,
      budgetDiagnostico.zero ? `${budgetDiagnostico.zero} zerada(s)` : null,
      budgetDiagnostico.invalido ? `${budgetDiagnostico.invalido} invalida(s)` : null,
    ].filter(Boolean).join(', ');
    chunks.push(`
      <div class="analise-warning">
        <strong>Aviso de budget:</strong> ${etapasSemBudget} etapa(s) ainda nao possuem budget utilizavel. ${_escN(parts)}. Isso reduz a leitura de utilizacao e risco operacional.
      </div>
    `);
  }

  if (!chunks.length) return '';
  return `<div class="analise-warning-stack">${chunks.join('')}</div>`;
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
    return { cls: 'margem-atencao', label: 'Atenção' };
  }
  return { cls: 'margem-saudavel', label: 'Saudável' };
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
      <div class="analise-state-title">Não foi possível carregar a análise.</div>
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

// ─── Nav helpers ────────────────────────────────────────────────────────────

function toggleNavDropdown() {
  document.getElementById('nav-dropdown')?.classList.toggle('open');
}

function toggleFeedbackPop(ev) {
  if (ev) ev.stopPropagation();
  document.getElementById('nav-feedback-pop')?.classList.toggle('open');
}

function fecharFeedbackPop() {
  document.getElementById('nav-feedback-pop')?.classList.remove('open');
}

function analiseSetFeedbackStatus(msg) {
  const el = document.getElementById('tool-feedback-status');
  if (el) el.textContent = msg;
}

async function enviarFeedbackAnalise() {
  const tipo = document.getElementById('tool-feedback-type')?.value || 'problema';
  const msg = (document.getElementById('tool-feedback-message')?.value || '').trim();
  if (!msg) {
    analiseSetFeedbackStatus('Escreva uma mensagem antes de enviar.');
    return;
  }
  const sb = window.sb;
  if (!sb) {
    analiseSetFeedbackStatus('Sem conexão com o banco de dados.');
    return;
  }
  const usuario = G.usuario || {};
  const { error } = await sb.from('plataforma_feedback').insert({
    tipo,
    mensagem: msg,
    origem: 'analise',
    usuario_id: usuario.id || null,
    usuario_nome: usuario.nome || null,
  });
  if (error) {
    analiseSetFeedbackStatus('Erro ao enviar. Tente novamente.');
    return;
  }
  analiseSetFeedbackStatus('Enviado com sucesso! Obrigado.');
  const msgEl = document.getElementById('tool-feedback-message');
  if (msgEl) msgEl.value = '';
  setTimeout(fecharFeedbackPop, 1800);
}

// ─── EXP Room ────────────────────────────────────────────────────────────────

let _analiseExpRoomInterval = null;

async function analiseCheckExpRoomStatus() {
  const btn = document.getElementById('exp-room-btn');
  if (!btn) return;
  try {
    const sb = window.sb;
    if (!sb) return;
    const { data } = await sb
      .from('exp_config')
      .select('value')
      .eq('key', 'exp_room_active')
      .single();
    const active = data?.value === 'true' || data?.value === true;
    btn.classList.toggle('active', active);
    btn.title = active ? 'EXP Room — Reunião em andamento' : 'EXP Room — Reunião online';
  } catch {
    /* silencioso */
  }
}

async function analiseRegistrarExpRoomClick(userId, userName) {
  try {
    const sb = window.sb;
    if (!sb || !userId) return;
    await sb.from('exp_room_presenca').upsert(
      { usuario_id: userId, usuario_nome: userName || null, ultimo_acesso: new Date().toISOString() },
      { onConflict: 'usuario_id' }
    );
  } catch {
    /* silencioso */
  }
}

function analiseInitExpRoom(userId, userName) {
  const btn = document.getElementById('exp-room-btn');
  if (!btn) return;
  analiseCheckExpRoomStatus();
  _analiseExpRoomInterval = setInterval(analiseCheckExpRoomStatus, 60000);
  btn.addEventListener('click', () => {
    analiseRegistrarExpRoomClick(userId, userName);
  });
}

// Overrides de estabilizacao da base do modulo
analiseInitExpRoom = function analiseInitExpRoomStable() {};

analiseRenderShell = function analiseRenderShellStable(usuario) {
  const subtitle = document.getElementById('analise-user-context');
  const firstName = usuario?.apelido || String(usuario?.nome || '').split(' ')[0] || 'usuario';
  if (subtitle) {
    subtitle.textContent = `Módulo independente com carga analítica própria. Sessão autenticada pronta para ${firstName}.`;
  }

  const configBtn = document.getElementById('analise-btn-config');
  if (configBtn) {
    configBtn.hidden = !analisePodeConfigurarMargem(usuario?.role);
  }

  const platformBtn = document.getElementById('user-menu-platform');
  if (platformBtn) {
    platformBtn.hidden = !usuario?.is_platform_manager;
  }
};

analiseBindEventosBase = function analiseBindEventosBaseStable() {
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

  document.addEventListener('click', (event) => {
    const userPill = document.getElementById('user-pill-wrap');
    if (userPill && !userPill.contains(event.target)) {
      document.getElementById('user-dropdown')?.classList.remove('open');
    }
  });
};

var _analiseRenderAbaAtivaBase = analiseRenderAbaAtiva;
analiseRenderAbaAtiva = function analiseRenderAbaAtivaStable() {
  _analiseRenderAbaAtivaBase();

  if (ANALISE._erro || ANALISE._carregando) return;

  const subtitleEl = document.getElementById('analise-user-context');
  if (!subtitleEl || !ANALISE._produtos.length) return;

  const totalHoras = Object.values(ANALISE._dadosPorProduto).reduce((sum, item) => sum + Number(item.horasTotais || 0), 0);
  const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  subtitleEl.textContent = `${ANALISE._produtos.length} projetos · ${fmtH(totalHoras)} lançadas · Atualizado às ${hhmm}`;
};

analiseRenderProjetoDetalhe = function analiseRenderProjetoDetalheStable() {
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

  host.innerHTML = `
    <div class="analise-modal-card">
      <div class="analise-modal-head">
        <div>
          <div class="analise-state-kicker">Leitura isolada</div>
          <h2 class="analise-drill-title" id="analise-modal-title">${_escN(item.produto?.nome || 'Projeto sem nome')}</h2>
          <div class="analise-drill-sub">${_escN(cliente)} | ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')} | ${_escN(item.statusResumo?.statusLabel || 'N/D')}</div>
        </div>
        <button type="button" class="btn sm" data-modal-close="1">Fechar</button>
      </div>
      <div class="analise-kpis-row">
        ${analiseKpiCard('Horas totais', fmtH(item.horasTotais), `${concluidas}/${etapas.length} etapas concluídas`)}
        ${analiseKpiCard('Custo total', analiseFmtMoney(item.custoTotal), 'HH + custos lançados')}
        ${analiseKpiCard('Margem', analiseFmtPct(item.margemPct), analiseFmtMoney(item.margem, item.margem === null))}
        ${analiseKpiCard('Budget consolidado', budgetHoras > 0 ? fmtH(budgetHoras) : 'N/D', budgetHoras > 0 ? `Uso atual ${analiseFmtPct(budgetUtil)}` : 'Nenhuma etapa com budget carregado')}
        ${analiseKpiCard('Margem projetada', analiseFmtPct(previsao.margemProjetadaPct), analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}
      </div>
      <div class="analise-drill-meta">
        <span class="analise-chip analise-chip-muted">Fase: ${_escN(item.statusResumo?.faseLabel || 'N/D')}</span>
        <span class="analise-chip analise-chip-muted">Encerrado em: ${_escN(encerradoEm)}</span>
        <span class="${margemInfo.cls}">${_escN(margemInfo.label)}</span>
        <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(previsao.riscoLabel || 'Sem previsão')}</span>
        <span class="analise-chip analise-chip-muted">Confiança: ${_escN(previsao.confiancaLabel || 'Baixa')}</span>
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
};

function analiseRiscoBadgeHtml(previsao) {
  const riscoKey = previsao?.riscoKey || 'incerto';
  const riscoLabel = riscoKey === 'risco'
    ? 'Em risco'
    : riscoKey === 'atencao'
      ? 'Atenção'
      : riscoKey === 'saudavel'
        ? 'Saudável'
        : 'Incerto';
  return `<span class="${analiseRiscoChipClass(riscoKey)}">${_escN(riscoLabel)}</span>`;
}

function analiseDeltaToneClass(delta) {
  if (delta === null || typeof delta === 'undefined' || Number.isNaN(Number(delta))) return 'analise-delta-neutral';
  if (Number(delta) >= 5) return 'analise-delta-risk';
  if (Number(delta) > 0) return 'analise-delta-warn';
  return 'analise-delta-ok';
}

function analiseRowToneClass(riscoKey) {
  if (riscoKey === 'risco') return 'analise-row-risk';
  if (riscoKey === 'atencao') return 'analise-row-warn';
  if (riscoKey === 'saudavel') return 'analise-row-ok';
  return '';
}

function analiseListaPrioridadesProjeto(registros, somenteAtivos = false) {
  const items = (registros || [])
    .filter(Boolean)
    .filter((item) => !somenteAtivos || item.statusResumo?.statusKey === 'ativo')
    .sort((a, b) => analiseOrdenarProdutosAcumulado(a, b, 'risco_desc'))
    .slice(0, 6);

  if (!items.length) {
    return '<div class="empty-note">Nenhum projeto entrou na priorização desta leitura.</div>';
  }

  return `
    <div class="analise-priority-grid">
      ${items.map((item) => {
        const previsao = item.previsao || {};
        const delta = analiseDeltaMargemProjetada(item);
        const cliente = item.produto?.oportunidades?.clientes?.nome || 'Cliente não identificado';
        return `
          <article class="analise-priority-card ${analiseRowToneClass(previsao.riscoKey)}">
            <div class="analise-priority-head">
              <div>
                <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
                <div class="analise-table-sub">${_escN(cliente)} · ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')}</div>
              </div>
              ${analiseRiscoBadgeHtml(previsao)}
            </div>
            <div class="analise-priority-metrics">
              <div>
                <span class="analise-priority-label">Margem projetada</span>
                <strong>${_escN(analiseFmtPct(previsao.margemProjetadaPct))}</strong>
              </div>
              <div>
                <span class="analise-priority-label">Queda projetada</span>
                <strong class="${analiseDeltaToneClass(delta)}">${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</strong>
              </div>
              <div>
                <span class="analise-priority-label">Confiança</span>
                <strong>${_escN(previsao.confiancaLabel || 'Baixa')}</strong>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

analiseLinhaProduto = function analiseLinhaProdutoEnhanced(item) {
  const classeMargem = analiseClassificarMargem(item.margemPct);
  const statusLabel = analiseProdutoStatusLabel(item);
  const faseLabel = item.statusResumo?.faseLabel;
  const previsao = item.previsao || {};
  const delta = analiseDeltaMargemProjetada(item);

  return `
    <tr class="analise-row-link ${analiseRowToneClass(previsao.riscoKey)}" data-produto-id="${_escN(item.produto?.id || '')}">
      <td>
        <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
        <div class="analise-table-sub">${_escN(item.produto?.oportunidades?.clientes?.nome || '')}</div>
      </td>
      <td>${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')}</td>
      <td>
        <div class="analise-table-main">${_escN(statusLabel)}</div>
        <div class="analise-table-sub">${_escN(faseLabel || 'N/D')}</div>
      </td>
      <td>
        <div class="analise-table-main">${analiseRiscoBadgeHtml(previsao)}</div>
        <div class="analise-table-sub">Confiança ${_escN(previsao.confiancaLabel || 'Baixa')}</div>
      </td>
      <td>
        <div class="analise-table-main">${_escN(analiseFmtPct(previsao.margemProjetadaPct))}</div>
        <div class="analise-table-sub">${_escN(analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}</div>
      </td>
      <td>
        <div class="analise-table-main ${analiseDeltaToneClass(delta)}">${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</div>
        <div class="analise-table-sub">Atual ${_escN(analiseFmtPct(item.margemPct))}</div>
      </td>
      <td>${_escN(fmtH(item.horasTotais))}</td>
      <td>${_escN(analiseFmtMoney(item.custoTotal))}</td>
      <td>${_escN(analiseFmtMoney(item.produto?.valor_contratado || 0, item.produto?.valor_contratado ? false : true))}</td>
      <td><span class="${classeMargem.cls}">${_escN(analiseFmtPct(item.margemPct))}</span></td>
    </tr>
  `;
};

analiseTabelaDesenvolvimentoProjeto = function analiseTabelaDesenvolvimentoProjetoEnhanced(rows) {
  if (!rows.length) {
    return analiseEmptyTemplate('Nenhum projeto em desenvolvimento atende aos filtros atuais.');
  }

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Risco proj.</th>
          <th>Margem proj.</th>
          <th>Delta proj.</th>
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
          const previsao = row.produtoRegistro?.previsao || {};
          const delta = analiseDeltaMargemProjetada(row.produtoRegistro);
          return `
            <tr class="analise-row-link ${analiseRowToneClass(previsao.riscoKey)}" data-produto-id="${_escN(row.produto?.id || '')}">
              <td>
                <div class="analise-table-main">${_escN(row.produto?.nome || 'Projeto sem nome')}</div>
                <div class="analise-table-sub">${_escN(`${NUCLEO_COR[row.produto?.nucleo]?.label || 'N/D'} · ${row.etapas.length} etapa(s)`)} </div>
              </td>
              <td>
                <div class="analise-table-main">${analiseRiscoBadgeHtml(previsao)}</div>
                <div class="analise-table-sub">Confiança ${_escN(previsao.confiancaLabel || 'Baixa')}</div>
              </td>
              <td>
                <div class="analise-table-main">${_escN(analiseFmtPct(previsao.margemProjetadaPct))}</div>
                <div class="analise-table-sub">${_escN(analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}</div>
              </td>
              <td>
                <div class="analise-table-main ${analiseDeltaToneClass(delta)}">${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</div>
                <div class="analise-table-sub">vs. atual</div>
              </td>
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
};

analiseTabelaDesenvolvimentoEtapa = function analiseTabelaDesenvolvimentoEtapaEnhanced(rows) {
  if (!rows.length) {
    return analiseEmptyTemplate('Nenhuma etapa ativa atende aos filtros atuais.');
  }

  const ordem = ANALISE._filtros.desenvolvimento?.ordem || 'risco_desc';
  const sortedRows = [...rows].sort((a, b) => {
    const prevA = a.produtoRegistro || {};
    const prevB = b.produtoRegistro || {};
    if (ordem === 'nome') {
      return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
    }
    return analiseOrdenarProjetosDesenvolvimento(
      {
        produto: a.produto,
        produtoRegistro: prevA,
        horasTotais: a.horasTotais,
        budgetHoras: analiseGetBudgetHoras(a.etapa),
      },
      {
        produto: b.produto,
        produtoRegistro: prevB,
        horasTotais: b.horasTotais,
        budgetHoras: analiseGetBudgetHoras(b.etapa),
      },
      ordem
    );
  });

  return `
    <table class="analise-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Etapa</th>
          <th>Efetividade</th>
          <th>Risco proj.</th>
          <th>Status</th>
          <th>Horas</th>
          <th>Budget</th>
          <th>Uso budget</th>
          <th>Custo etapa</th>
        </tr>
      </thead>
      <tbody>
        ${sortedRows.map((item) => {
          const previsao = item.produtoRegistro?.previsao || {};
          return `
            <tr class="analise-row-link ${analiseRowToneClass(previsao.riscoKey)}" data-produto-id="${_escN(item.produto?.id || '')}">
              <td>
                <div class="analise-table-main">${_escN(item.produto?.nome || 'Projeto sem nome')}</div>
                <div class="analise-table-sub">${_escN(`${NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D'} · margem proj. ${analiseFmtPct(previsao.margemProjetadaPct)}`)}</div>
              </td>
              <td>${_escN(item.etapa?.nome || `Etapa ${item.etapa?.ordem || 'N/D'}`)}</td>
              <td>${analiseEfetividadeBadge(item.efetividade)}</td>
              <td>${analiseRiscoBadgeHtml(previsao)}</td>
              <td>${analiseStatusEtapaBadge(item.etapa?.status)}</td>
              <td>${_escN(fmtH(item.horasTotais))}</td>
              <td>${analiseBudgetCell(item.budgetMeta || analiseGetBudgetMeta(item.etapa))}</td>
              <td>${analiseBudgetBadge(item.utilizacaoBudget, item.budgetMeta || analiseGetBudgetMeta(item.etapa))}</td>
              <td>${_escN(analiseFmtMoney(item.custoTotal))}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
};

analiseRenderAcumulado = function analiseRenderAcumuladoEnhanced() {
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

  panel.innerHTML = `
    ${analiseWarningsHtml()}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Projetos na leitura', String(produtos.length), produtos.length === produtosBase.length ? 'Base completa elegível' : `${produtosBase.length} elegíveis no total`)}
      ${analiseKpiCard('Horas lançadas', fmtH(horasTotal), 'Soma de horas com produto associado')}
      ${analiseKpiCard('Custo total', analiseFmtMoney(custoTotal), 'HH + custos lançados')}
      ${analiseKpiCardSemantic('Margem ponderada', analiseFmtPct(margemPonderada), 'Baseada em valor contratado conhecido', analiseMargemKpiCls(margemPonderada))}
      ${analiseKpiCardSemantic('Margem projetada média', analiseFmtPct(margemProjetadaMedia), 'Heurística inicial baseada em budget e estágio', analiseMargemKpiCls(margemProjetadaMedia))}
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Margem por núcleo</div>
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Risco projetado</div>
        ${analiseGraficoRiscoProjetado(produtos)}
      </section>
      <section class="analise-visual-card analise-visual-card-wide">
        <div class="analise-visual-title">Prioridades da leitura</div>
        ${analiseListaPrioridadesProjeto(produtos)}
      </section>
    </div>
    <div class="analise-state-grid">
      ${analiseResumoNucleos(produtos)}
    </div>
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

analiseRenderDesenvolvimento = function analiseRenderDesenvolvimentoEnhanced() {
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

  panel.innerHTML = `
    ${analiseSemaforoCompacto([
      { key: 'risco', label: 'Risco', count: projetosEmRisco.length },
      { key: 'atencao', label: 'Atenção', count: projetosAtencao.length },
      { key: 'saudavel', label: 'Saudável', count: projetosSaudavel.length },
    ])}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Etapas ativas', String(etapas.length), 'Em andamento ou em revisão')}
      ${analiseKpiCard('Com budget', String(comBudget.length), 'Etapas com budget carregado')}
      ${analiseKpiCard('Acima do budget', String(acimaBudget.length), 'Utilização acima de 100%')}
      ${analiseKpiCard('Projetos em execução', String(rowsProjeto.length), 'Com pelo menos uma etapa ativa')}
      ${analiseKpiCard('Risco projetado', String(projetosEmRisco.length), `${projetosAtencao.length} em atenção pela projeção atual`)}
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Etapas ativas por status</div>
        ${analiseGraficoStatusEtapasAtivas(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Uso de budget ativo</div>
        ${analiseGraficoResumoBudgetAtivo(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Carga por núcleo</div>
        ${analiseGraficoCargaNucleoAtivo(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Semáforo de risco ativo</div>
        ${analiseGraficoSemaforoProjetos(rowsProjeto)}
      </section>
      <section class="analise-visual-card analise-visual-card-wide">
        <div class="analise-visual-title">Projetos que pedem atenção</div>
        ${analiseListaPrioridadesProjeto(rowsProjeto.map((row) => row.produtoRegistro).filter(Boolean), true)}
      </section>
    </div>
    <div class="analise-table-wrap">
      ${filtro.agrupamento === 'etapa'
        ? analiseTabelaDesenvolvimentoEtapa(etapas)
        : analiseTabelaDesenvolvimentoProjeto(rowsProjeto)}
    </div>
  `;
};

var _analiseRenderAbaAtivaStableBase = analiseRenderAbaAtiva;
analiseRenderAbaAtiva = function analiseRenderAbaAtivaFinal() {
  _analiseRenderAbaAtivaStableBase();

  if (ANALISE._erro || ANALISE._carregando) return;

  const subtitleEl = document.getElementById('analise-user-context');
  if (!subtitleEl || !ANALISE._produtos.length) return;

  const totalHoras = Object.values(ANALISE._dadosPorProduto).reduce((sum, item) => sum + Number(item.horasTotais || 0), 0);
  const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  subtitleEl.textContent = `${ANALISE._produtos.length} projetos · ${fmtH(totalHoras)} lançadas · Atualizado às ${hhmm}`;
};

analiseRenderProjetoDetalhe = function analiseRenderProjetoDetalheFinal() {
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

  host.innerHTML = `
    <div class="analise-modal-card">
      <div class="analise-modal-head">
        <div>
          <div class="analise-state-kicker">Leitura isolada</div>
          <h2 class="analise-drill-title" id="analise-modal-title">${_escN(item.produto?.nome || 'Projeto sem nome')}</h2>
          <div class="analise-drill-sub">${_escN(cliente)} | ${_escN(NUCLEO_COR[item.produto?.nucleo]?.label || 'N/D')} | ${_escN(item.statusResumo?.statusLabel || 'N/D')}</div>
        </div>
        <button type="button" class="btn sm" data-modal-close="1">Fechar</button>
      </div>
      <div class="analise-kpis-row">
        ${analiseKpiCard('Horas totais', fmtH(item.horasTotais), `${concluidas}/${etapas.length} etapas concluídas`)}
        ${analiseKpiCard('Custo total', analiseFmtMoney(item.custoTotal), 'HH + custos lançados')}
        ${analiseKpiCard('Margem atual', analiseFmtPct(item.margemPct), analiseFmtMoney(item.margem, item.margem === null))}
        ${analiseKpiCard('Budget consolidado', budgetHoras > 0 ? fmtH(budgetHoras) : 'N/D', budgetHoras > 0 ? `Uso atual ${analiseFmtPct(budgetUtil)}` : 'Nenhuma etapa com budget carregado')}
        ${analiseKpiCard('Margem projetada', analiseFmtPct(previsao.margemProjetadaPct), analiseFmtMoney(previsao.margemProjetada, previsao.margemProjetada === null))}
      </div>
      <div class="analise-drill-meta">
        <span class="analise-chip analise-chip-muted">Fase: ${_escN(item.statusResumo?.faseLabel || 'N/D')}</span>
        <span class="analise-chip analise-chip-muted">Encerrado em: ${_escN(encerradoEm)}</span>
        <span class="${margemInfo.cls}">${_escN(margemInfo.label)}</span>
        <span class="${analiseRiscoChipClass(previsao.riscoKey)}">${_escN(previsao.riscoLabel || 'Sem previsão')}</span>
        <span class="analise-chip analise-chip-muted">Confiança: ${_escN(previsao.confiancaLabel || 'Baixa')}</span>
        <span class="analise-chip analise-chip-muted">Queda proj.: ${_escN(delta === null ? 'N/D' : analiseFmtPct(delta))}</span>
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
};

analiseRenderAcumulado = function analiseRenderAcumuladoClean() {
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

  panel.innerHTML = `
    ${analiseWarningsHtml()}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Projetos na leitura', String(produtos.length), produtos.length === produtosBase.length ? 'Base completa elegível' : `${produtosBase.length} elegíveis no total`)}
      ${analiseKpiCard('Horas lançadas', fmtH(horasTotal), 'Soma de horas com produto associado')}
      ${analiseKpiCard('Custo total', analiseFmtMoney(custoTotal), 'HH + custos lançados')}
      ${analiseKpiCardSemantic('Margem ponderada', analiseFmtPct(margemPonderada), 'Baseada em valor contratado conhecido', analiseMargemKpiCls(margemPonderada))}
      ${analiseKpiCardSemantic('Margem projetada média', analiseFmtPct(margemProjetadaMedia), 'Heurística inicial baseada em budget e estágio', analiseMargemKpiCls(margemProjetadaMedia))}
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Margem por núcleo</div>
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Risco projetado</div>
        ${analiseGraficoRiscoProjetado(produtos)}
      </section>
      <section class="analise-visual-card analise-visual-card-wide">
        <div class="analise-visual-title">Prioridades da leitura</div>
        ${analiseListaPrioridadesProjeto(produtos)}
      </section>
    </div>
    <div class="analise-state-grid">
      ${analiseResumoNucleos(produtos)}
    </div>
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

analiseRenderDesenvolvimento = function analiseRenderDesenvolvimentoClean() {
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

  panel.innerHTML = `
    ${analiseSemaforoCompacto([
      { key: 'risco', label: 'Risco', count: projetosEmRisco.length },
      { key: 'atencao', label: 'Atenção', count: projetosAtencao.length },
      { key: 'saudavel', label: 'Saudável', count: projetosSaudavel.length },
    ])}
    <div class="analise-kpis-row">
      ${analiseKpiCard('Etapas ativas', String(etapas.length), 'Em andamento ou em revisão')}
      ${analiseKpiCard('Com budget', String(comBudget.length), 'Etapas com budget carregado')}
      ${analiseKpiCard('Acima do budget', String(acimaBudget.length), 'Utilização acima de 100%')}
      ${analiseKpiCard('Projetos em execução', String(rowsProjeto.length), 'Com pelo menos uma etapa ativa')}
      ${analiseKpiCard('Risco projetado', String(projetosEmRisco.length), `${projetosAtencao.length} em atenção pela projeção atual`)}
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
      <section class="analise-visual-card">
        <div class="analise-visual-title">Etapas ativas por status</div>
        ${analiseGraficoStatusEtapasAtivas(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Uso de budget ativo</div>
        ${analiseGraficoResumoBudgetAtivo(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Carga por núcleo</div>
        ${analiseGraficoCargaNucleoAtivo(etapas)}
      </section>
      <section class="analise-visual-card">
        <div class="analise-visual-title">Semáforo de risco ativo</div>
        ${analiseGraficoSemaforoProjetos(rowsProjeto)}
      </section>
      <section class="analise-visual-card analise-visual-card-wide">
        <div class="analise-visual-title">Projetos que pedem atenção</div>
        ${analiseListaPrioridadesProjeto(rowsProjeto.map((row) => row.produtoRegistro).filter(Boolean), true)}
      </section>
    </div>
    <div class="analise-table-wrap">
      ${filtro.agrupamento === 'etapa'
        ? analiseTabelaDesenvolvimentoEtapa(etapas)
        : analiseTabelaDesenvolvimentoProjeto(rowsProjeto)}
    </div>
  `;
};

analiseRenderAbaAtiva = function analiseRenderAbaAtivaUltraFinal() {
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

  if (ANALISE._erro || ANALISE._carregando) return;

  const subtitleEl = document.getElementById('analise-user-context');
  if (!subtitleEl || !ANALISE._produtos.length) return;

  const totalHoras = Object.values(ANALISE._dadosPorProduto).reduce((sum, item) => sum + Number(item.horasTotais || 0), 0);
  const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  subtitleEl.textContent = `${ANALISE._produtos.length} projetos · ${fmtH(totalHoras)} lançadas · Atualizado às ${hhmm}`;
};
