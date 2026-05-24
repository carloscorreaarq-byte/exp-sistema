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
  window.G = window.G || {};
  G.todosProdutos = G.todosProdutos || [];
  G.todasEtapas = G.todasEtapas || [];
  G.todosUsuarios = G.todosUsuarios || [];

  console.log('[analise] bootstrap iniciado');
  try {
    console.log('[analise] chamando appShellInit...');
    const boot = await appShellInit();
    console.log('[analise] appShellInit retornou:', boot);
    if (!boot) {
      console.warn('[analise] boot é null — sem sessão ou usuario nao encontrado');
      return;
    }
    console.log('[analise] validando acesso, role:', boot.usuario?.role);
    analiseValidarAcesso();
    console.log('[analise] acesso ok, renderizando shell');
    analiseRenderShell(boot.usuario);
    analiseBindEventosBase();
    analiseRenderConfig();
    analiseRenderAbaAtiva();
    document.getElementById('shell-loading').style.display = 'none';
    document.getElementById('shell-app').style.display = 'block';
    console.log('[analise] shell visivel, iniciando dados');
    await analiseInit();
  } catch (error) {
    console.error('[analise] erro no bootstrap:', error);
    document.getElementById('shell-loading').style.display = 'none';
    document.getElementById('shell-app').style.display = 'block';
    document.getElementById('anp-acumulado').innerHTML = `
      <div class="analise-state">
        <div class="analise-state-kicker">Falha</div>
        <div class="analise-state-title">Nao foi possivel iniciar o modulo.</div>
        <div class="analise-state-copy">${_escN(error?.message || 'Erro desconhecido ao montar a camada inicial do shell.')}</div>
      </div>
    `;
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
  subtitle.textContent = `Modulo independente em Sprint 1. Shell autenticado pronto para ${firstName}.`;

  const configBtn = document.getElementById('analise-btn-config');
  configBtn.hidden = String(usuario?.role || '').toLowerCase() !== 'socio_admin' &&
    String(usuario?.role || '').toLowerCase() !== 'socio_adm';
}

function analiseBindEventosBase() {
  document.getElementById('analise-tabs-bar')?.addEventListener('click', (event) => {
    const button = event.target.closest('.analise-tab');
    if (!button) return;
    analiseSwitchTab(button.dataset.aba);
  });

  document.getElementById('analise-btn-reload')?.addEventListener('click', async () => {
    ANALISE._ultimaCarga = null;
    toast('Estrutura base pronta. A carga real entra no Sprint 2.');
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
}

async function analiseInit(forceReload = false) {
  if (!forceReload && ANALISE._ultimaCarga) {
    analiseRenderAbaAtiva();
    return;
  }
  ANALISE._ultimaCarga = Date.now();
  analiseRenderAbaAtiva();
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
  if (ANALISE._abaAtiva === 'acumulado') return analiseRenderAcumulado();
  if (ANALISE._abaAtiva === 'desenvolvimento') return analiseRenderDesenvolvimento();
  if (ANALISE._abaAtiva === 'encerrados') return analiseRenderEncerrados();
  return analiseRenderPessoas();
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
  if (!isSocioRole(G.usuario?.role)) return;
  document.getElementById('analise-config-panel')?.classList.add('open');
}

function analiseSalvarConfig() {
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

function analiseRenderAcumulado() {
  document.getElementById('anp-acumulado').innerHTML = analisePlaceholderTemplate({
    kicker: 'Sprint 1',
    title: 'Aba base pronta para o Acumulado',
    copy: 'A estrutura independente do modulo ja esta no ar. No Sprint 2 entram a carga real de produtos, etapas, horas, custos e a primeira agregacao de dados para KPIs, cards e graficos.',
    cards: [
      ['Entry point', 'analise.html esta autenticado e separado de gestao.html.'],
      ['Shell', 'Nav, tema, conexao e identidade do usuario ja funcionam nesta pagina.'],
      ['Proximo passo', 'Carregar produtos, etapas, horas_lancadas, lancamentos_custo e historico_valor_hora.'],
    ],
  });
}

function analiseRenderDesenvolvimento() {
  document.getElementById('anp-desenvolvimento').innerHTML = analisePlaceholderTemplate({
    kicker: 'Sprint 1',
    title: 'Superficie operacional reservada',
    copy: 'Esta aba ja nasceu com a navegacao, a troca de painis e a configuracao de margem. No Sprint 2 e 4 entram os dados ativos, o budget por etapa e a edicao inline.',
    cards: [
      ['Budget', 'A persistencia de budget_horas entra junto com a carga real e o bind da tabela.'],
      ['Risco', 'A classificacao de margem sera conectada aos dados assim que a agregacao estiver pronta.'],
      ['Fluxo', 'WIP, aging e gargalos ficam para as releases posteriores.'],
    ],
  });
}

function analiseRenderEncerrados() {
  document.getElementById('anp-encerrados').innerHTML = analisePlaceholderTemplate({
    kicker: 'Sprint 1',
    title: 'Area de historico isolada e preparada',
    copy: 'A pagina ja esta pronta para receber a lista de encerrados, o grafico historico de margem e a analise isolada por projeto sem depender do modal ou das tabs de Gestao.',
    cards: [
      ['Lista', 'Projetos encerrados serao renderizados nesta superficie, nao em gestao.html.'],
      ['Isolada', 'A analise detalhada tera rota de estado propria dentro do modulo.'],
      ['Timeline', 'Previsto x realizado entra junto com os graficos do Sprint 5.'],
    ],
  });
}

function analiseRenderPessoas() {
  document.getElementById('anp-pessoas').innerHTML = analisePlaceholderTemplate({
    kicker: 'Backlog',
    title: 'Aba reservada para eficiencia por pessoa',
    copy: 'Esta aba fica propositalmente leve na v1.0. O objetivo agora e estabilizar a base do modulo e depois evoluir para utilizacao, carga simultanea e contribuicao por margem.',
    cards: [
      ['Escopo futuro', 'Horas, utilizacao, revisoes e carga por pessoa.'],
      ['Dependencia', 'Exige consolidar primeiro a camada financeira e preditiva.'],
    ],
  });
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
