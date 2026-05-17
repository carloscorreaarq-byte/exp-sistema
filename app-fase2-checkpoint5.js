(function () {
  const signupClient = window.sbSignup || window.supabase.createClient(
    'https://pgnydwsjntaezdhkgvpu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhb3AiLCJyZWYiOiJwZ255ZHdzam50YWV6ZGhrZ3ZwdSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1MDg5NzEzLCJleHAiOjIwOTA2NjU3MTN9.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo',
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const platformColors = [
    '#45865D','#5280CA','#D19931','#C36247','#7A6E9E','#6A8C8C',
    '#8A7355','#9C7B8E','#6E818E','#8A8A56','#1D6A4A','#1D4FA0',
    '#B84C3A','#6B4FA0','#3E7858','#4A72B5','#C49A27','#B85638',
    '#4F6D7A','#6D8B74','#A35F52','#7E6BA8','#4F8C8C','#9A8447'
  ];

  let platformUsersCache = [];
  let platformTermosCache = {};
  let pendingAvatarUserId = null;
  let meusDadosDirty = false;
  let plataformaDirty = false;
  const TERM_VALIDITY_DAYS = 365;
  const DEFAULT_TERM_DEFINITION = {
    slug: 'termo_uso_protecao_dados_pessoais',
    titulo: 'TERMO DE USO E PROTEÃ‡ÃƒO DE DADOS PESSOAIS',
    versao_termo: '2026.01',
    compromisso_prioritario: 'O acesso Ã  plataforma EXP Ã© pessoal e intransferÃ­vel. O usuÃ¡rio deve proteger suas credenciais, utilizar a plataforma apenas para fins ligados Ã  prestaÃ§Ã£o de serviÃ§os Ã  EXP e comunicar imediatamente qualquer suspeita de acesso indevido ou incidente de seguranÃ§a.',
    conteudo_texto: `1. Das Partes
Este Termo Ã© firmado entre a EXP ("Empresa") e o usuÃ¡rio identificado no momento do aceite ("UsuÃ¡rio"), na condiÃ§Ã£o de prestador de serviÃ§os ou sÃ³cio autorizado, conforme relaÃ§Ã£o jurÃ­dica jÃ¡ estabelecida entre as partes em instrumento prÃ³prio.

Este Termo nÃ£o cria, altera ou implica qualquer vÃ­nculo empregatÃ­cio entre as partes, sendo celebrado exclusivamente para fins de regulamentaÃ§Ã£o do acesso e uso da plataforma.

2. Finalidade da Plataforma e do Tratamento de Dados
A plataforma EXP destina-se a:

Facilitar o acompanhamento colaborativo de processos em ambiente remoto;
Organizar o compartilhamento e acesso a informaÃ§Ãµes e fluxos de trabalho;
Simplificar registros operacionais e administrativos;
Apoiar a mensuraÃ§Ã£o de rentabilidade projetual de forma integrada.

O registro de histÃ³rico de ediÃ§Ãµes, visualizaÃ§Ãµes e interaÃ§Ãµes tem finalidade operacional e colaborativa, nÃ£o constituindo instrumento de controle individualizado de produÃ§Ã£o.

3. Dados Tratados e Base Legal (LGPD â€” Lei nÂº 13.709/2018)
A EXP trata dados pessoais do UsuÃ¡rio com base no legÃ­timo interesse e na execuÃ§Ã£o do contrato de prestaÃ§Ã£o de serviÃ§os, incluindo:

Dados de identificaÃ§Ã£o (nome, e-mail, funÃ§Ã£o);
Dados de acesso (registros de login, histÃ³rico de navegaÃ§Ã£o e ediÃ§Ãµes na plataforma);
Dados operacionais inseridos pelo UsuÃ¡rio no exercÃ­cio de suas atividades.

O UsuÃ¡rio, ao aceitar este Termo, autoriza expressamente o registro e armazenamento dessas informaÃ§Ãµes para as finalidades descritas acima.

Os dados serÃ£o retidos pelo prazo necessÃ¡rio ao cumprimento das finalidades descritas e por obrigaÃ§Ãµes legais subsequentes, sendo garantidos ao UsuÃ¡rio os direitos previstos no Art. 18 da LGPD (acesso, correÃ§Ã£o, eliminaÃ§Ã£o e portabilidade), mediante solicitaÃ§Ã£o formal Ã  Empresa.

4. SeguranÃ§a e Responsabilidades do UsuÃ¡rio
O UsuÃ¡rio declara ciÃªncia e concorda com as seguintes obrigaÃ§Ãµes:

a) Credenciais pessoais e intransferÃ­veis
O login e senha de acesso sÃ£o de uso exclusivamente pessoal. Ã‰ vedado o compartilhamento de credenciais com terceiros, independentemente do vÃ­nculo com a Empresa.

b) Acesso em dispositivos nÃ£o pessoais
O UsuÃ¡rio deve exercer cautela ao acessar a plataforma em dispositivos de uso compartilhado ou pÃºblico. Recomenda-se encerrar a sessÃ£o imediatamente apÃ³s o uso e nÃ£o salvar credenciais nesses ambientes.

c) NotificaÃ§Ã£o de incidentes
Caso o UsuÃ¡rio identifique ou suspeite de qualquer acesso nÃ£o autorizado Ã  sua conta ou brecha de seguranÃ§a, deverÃ¡ comunicar imediatamente a Empresa, colaborando para a investigaÃ§Ã£o e contenÃ§Ã£o do incidente.

d) Uso adequado
O acesso Ã  plataforma deve ocorrer exclusivamente para fins relacionados Ã  prestaÃ§Ã£o de serviÃ§os Ã  EXP. Qualquer uso para finalidade diversa Ã© vedado.

5. VigÃªncia e RenovaÃ§Ã£o
Este Termo tem vigÃªncia de 12 (doze) meses a partir da data de aceite, renovando-se automaticamente por igual perÃ­odo, salvo manifestaÃ§Ã£o contrÃ¡ria de qualquer das partes ou revogaÃ§Ã£o do acesso pela Empresa.

A EXP reserva-se o direito de atualizar os termos deste instrumento, notificando os usuÃ¡rios com antecedÃªncia mÃ­nima de 15 dias, sendo necessÃ¡rio novo aceite para continuidade do acesso.

6. Aceite
Ao clicar em "Li e aceito os termos", o UsuÃ¡rio declara:

Ter lido e compreendido integralmente este Termo;
Estar ciente de suas obrigaÃ§Ãµes de sigilo, seguranÃ§a e uso responsÃ¡vel;
Autorizar o tratamento de seus dados pessoais nos termos descritos;
Reconhecer que o acesso Ã  plataforma e seus recursos estÃ¡ vinculado Ã  manutenÃ§Ã£o da relaÃ§Ã£o de prestaÃ§Ã£o de serviÃ§os com a EXP.

EXP Â· Documento gerado automaticamente pela plataforma Â· Registro de aceite armazenado com data, hora e identificaÃ§Ã£o do usuÃ¡rio.`
  };
  let currentTermDefinition = { ...DEFAULT_TERM_DEFINITION };

  function currentSessionUsuario() {
    try {
      return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null');
    } catch {
      return null;
    }
  }

  function coalesceUsuarioIdentity(usuario, fallback) {
    const base = fallback || currentSessionUsuario() || {};
    const nome = usuario?.nome || base.nome || '';
    const apelido = usuario?.apelido || base.apelido || (nome ? nome.split(' ')[0] : '');
    return {
      ...base,
      ...(usuario || {}),
      nome,
      apelido,
      iniciais: usuario?.iniciais || base.iniciais || initialsFromNome(nome || apelido),
      cor: usuario?.cor || base.cor || '#888',
      email_login: usuario?.email_login || base.email_login || null,
      avatar_url: usuario?.avatar_url || base.avatar_url || null
    };
  }

  function initialsFromNome(nome) {
    return String(nome || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0] ? parte[0].toUpperCase() : '')
      .join('') || '--';
  }

  function setMeusDadosStatus(message) {
    const el = document.getElementById('meus-dados-status');
    if (el) el.textContent = message;
  }

  function setPlataformaStatus(message) {
    const el = document.getElementById('plataforma-status');
    if (el) el.textContent = message;
  }

  function formatPtDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR');
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function plusDaysIso(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  function setMeusDadosDirty(value) {
    meusDadosDirty = !!value;
  }

  function setPlataformaDirty(value) {
    plataformaDirty = !!value;
  }

  function bindShellDirtyGuards() {
    if (document.body.dataset.shellDirtyGuardsBound === '1') return;
    document.body.dataset.shellDirtyGuardsBound = '1';
    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id && target.id.startsWith('md-')) setMeusDadosDirty(true);
      if (target.id && target.id.startsWith('gp-')) setPlataformaDirty(true);
    });
    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id && target.id.startsWith('md-')) setMeusDadosDirty(true);
      if (target.id && target.id.startsWith('gp-')) setPlataformaDirty(true);
    });
  }

  async function registrarAuditoriaPlataforma(acao, usuarioAlvo, payloadResumido) {
    const current = currentSessionUsuario();
    if (!current?.app_user_id) return;
    await window.sb.from('usuarios_auditoria').insert({
      usuario_alvo: usuarioAlvo || null,
      acao,
      executado_por: current.app_user_id,
      payload_resumido: payloadResumido || null
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isTermTableMissing(error) {
    const message = String(error?.message || '');
    return /plataforma_termos/i.test(message) || /relation .*plataforma_termos/i.test(message);
  }

  async function fetchCurrentTermDefinition() {
    let data = null;
    let error = null;
    try {
      ({ data, error } = await window.sb
        .from('plataforma_termos')
        .select('*')
        .eq('slug', DEFAULT_TERM_DEFINITION.slug)
        .maybeSingle());
    } catch (caughtError) {
      error = caughtError;
    }
    if (error) {
      if (!isTermTableMissing(error)) {
        setPlataformaStatus('Nao foi possivel carregar a definicao gerenciavel do termo.');
      }
      currentTermDefinition = { ...DEFAULT_TERM_DEFINITION };
      return currentTermDefinition;
    }
    currentTermDefinition = {
      ...DEFAULT_TERM_DEFINITION,
      ...(data || {})
    };
    return currentTermDefinition;
  }

  function splitTermBlocks(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  function renderTermBlock(block) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    const titleLike = /^(?:\d+\.\s|[a-z]\)\s)/i.test(lines[0]);
    if (titleLike && lines.length > 1) {
      const heading = escapeHtml(lines[0]);
      const content = lines.slice(1).map((line) => '<p style="margin:0 0 8px">' + escapeHtml(line) + '</p>').join('');
      return '<section style="display:grid;gap:6px"><strong style="font-size:12px;color:#333">' + heading + '</strong><div>' + content + '</div></section>';
    }
    if (lines.length >= 2 && lines.every((line) => /;$/.test(line) || /:$/.test(lines[0]) || !/[.?!]$/.test(line))) {
      return '<ul style="padding-left:18px;display:grid;gap:6px">' + lines.map((line) => '<li>' + escapeHtml(line) + '</li>').join('') + '</ul>';
    }
    return lines.map((line) => '<p style="margin:0 0 8px">' + escapeHtml(line) + '</p>').join('');
  }

  async function fetchLatestTermo(usuarioId) {
    if (!usuarioId) return null;
    let data = null;
    let error = null;
    try {
      ({ data, error } = await window.sb
        .from('usuarios_termos_compromisso')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    } catch (caughtError) {
      error = caughtError;
    }
    if (error) return null;
    return data || null;
  }

  function normalizeTermoStatus(termo) {
    if (!termo) return {
      versao_termo: currentTermDefinition.versao_termo,
      status_termo: 'pending',
      assinado_em: null,
      expira_em: null
    };
    const now = Date.now();
    const expira = termo.expira_em ? new Date(termo.expira_em).getTime() : null;
    if (termo.status_termo === 'signed' && expira && expira < now) {
      return { ...termo, status_termo: 'expired' };
    }
    return termo;
  }

  async function ensureTermoRegistro(usuarioId) {
    if (!usuarioId) return normalizeTermoStatus(null);
    await fetchCurrentTermDefinition();
    const existing = normalizeTermoStatus(await fetchLatestTermo(usuarioId));
    if (existing && existing.id && existing.versao_termo === currentTermDefinition.versao_termo) return existing;
    const payload = {
      usuario_id: usuarioId,
      versao_termo: currentTermDefinition.versao_termo,
      status_termo: 'pending',
      assinado_em: null,
      expira_em: null,
      created_at: isoNow()
    };
    const { error } = await window.sb.from('usuarios_termos_compromisso').insert(payload);
    if (error) return normalizeTermoStatus(null);
    return normalizeTermoStatus(await fetchLatestTermo(usuarioId));
  }

  function attachTermToUsuario(usuario, termo) {
    const normalized = normalizeTermoStatus(termo);
    return {
      ...usuario,
      termo_status: normalized.status_termo || null,
      termo_assinado_em: normalized.assinado_em || null,
      termo_expira_em: normalized.expira_em || null,
      termo_versao: normalized.versao_termo || currentTermDefinition.versao_termo
    };
  }

  function syncSessionPayload(usuario) {
    if (!usuario?.auth_id) return;
    const payload = window.buildExpUsuarioPayload(usuario.auth_id, usuario);
    sessionStorage.setItem('exp_usuario', JSON.stringify(payload));
    window.renderShellIdentity(usuario);
    window.publishSessionReady(payload);
  }

  function ensureTermModal() {
    if (document.getElementById('termo-overlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = ''
      + '<div class="shell-modal-overlay" id="termo-overlay">'
      + '  <div class="shell-modal" role="dialog" aria-modal="true" aria-labelledby="termo-title">'
      + '    <div class="shell-modal-header">'
      + '      <div class="shell-modal-title">'
      + '        <strong id="termo-title">Termo de compromisso</strong>'
      + '        <span id="termo-subtitle">Leitura, aceite e validade do termo institucional.</span>'
      + '      </div>'
      + '      <button type="button" class="shell-modal-close" id="termo-close-top">&times;</button>'
      + '    </div>'
      + '    <div class="shell-modal-body">'
      + '      <div id="termo-status-copy" style="font-size:11px;color:#888;line-height:1.5">Carregando...</div>'
      + '      <div id="termo-prioritario" style="background:#1E1E1E;color:#f0f0f0;border-left:3px solid #D19931;border-radius:8px;padding:14px 16px;font-size:11px;line-height:1.65"></div>'
      + '      <div>'
      + '        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#bbb;margin-bottom:10px">Leitura completa do termo</div>'
      + '        <div id="termo-texto" style="display:grid;gap:10px;font-size:11px;line-height:1.65;color:#555;max-height:320px;overflow:auto;padding-right:6px"></div>'
      + '      </div>'
      + '    </div>'
      + '    <div class="shell-modal-footer">'
      + '      <div class="shell-status-text" id="termo-modal-status"></div>'
      + '      <div class="shell-actions">'
      + '        <span id="termo-sign-text" style="font-size:11px;color:#888;display:none">Termo jÃ¡ assinado</span>'
      + '        <button type="button" class="shell-btn" id="termo-close-bottom">Fechar</button>'
      + '        <button type="button" class="shell-btn primary" id="termo-sign-btn">Estou ciente e concordo com os termos acima</button>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(wrap.firstChild);
    document.getElementById('termo-overlay')?.addEventListener('click', (event) => {
      if (event.target.id === 'termo-overlay') return;
    });
    document.getElementById('termo-close-top')?.addEventListener('click', () => window.fecharTermoCompromisso());
    document.getElementById('termo-close-bottom')?.addEventListener('click', () => window.fecharTermoCompromisso());
    document.getElementById('termo-sign-btn')?.addEventListener('click', () => window.assinarTermoCompromisso());
  }

  function renderTermText() {
    const priority = document.getElementById('termo-prioritario');
    const wrap = document.getElementById('termo-texto');
    const title = document.getElementById('termo-title');
    if (!wrap) return;
    if (title) title.textContent = currentTermDefinition.titulo || DEFAULT_TERM_DEFINITION.titulo;
    if (priority) {
      priority.innerHTML = '<strong style="display:block;margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase;font-size:11px;color:#D19931">Compromisso PrioritÃ¡rio</strong>'
        + '<div>' + escapeHtml(currentTermDefinition.compromisso_prioritario || DEFAULT_TERM_DEFINITION.compromisso_prioritario).replace(/\n/g, '<br>') + '</div>';
    }
    wrap.innerHTML = splitTermBlocks(currentTermDefinition.conteudo_texto || DEFAULT_TERM_DEFINITION.conteudo_texto)
      .map(renderTermBlock)
      .join('');
  }

  function renderTermStatusCopy(termo) {
    const statusCopy = document.getElementById('termo-status-copy');
    const modalStatus = document.getElementById('termo-modal-status');
    const signBtn = document.getElementById('termo-sign-btn');
    if (!statusCopy || !modalStatus || !signBtn) return;
    const status = (termo?.status_termo || 'pending').toLowerCase();
    const assinadoEm = formatPtDate(termo?.assinado_em);
    const expiraEm = formatPtDate(termo?.expira_em);
    if (status === 'signed') {
      statusCopy.textContent = assinadoEm
        ? 'Termo assinado em ' + assinadoEm + (expiraEm ? ' Â· validade atÃ© ' + expiraEm : '.')
        : 'Termo registrado como assinado.';
      modalStatus.textContent = '';
      signBtn.style.display = 'none';
      const signText = document.getElementById('termo-sign-text');
      if (signText) signText.style.display = 'inline';
      return;
    }
    const signText = document.getElementById('termo-sign-text');
    if (signText) signText.style.display = 'none';
    signBtn.style.display = '';
    signBtn.disabled = false;
    signBtn.textContent = 'Estou ciente e concordo com os termos acima';

    if (status === 'expired') {
      statusCopy.textContent = expiraEm
        ? 'O termo venceu em ' + expiraEm + ' e precisa ser assinado novamente.'
        : 'O termo venceu e precisa ser assinado novamente.';
      modalStatus.textContent = '';
      return;
    }
    statusCopy.textContent = 'O termo ainda nÃ£o foi assinado para esta conta.';
    modalStatus.textContent = '';
  }

  async function syncCurrentTermState() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.app_user_id || !sessionUser?.auth_id || !window.fetchCurrentUsuario) return;
    try {
      const usuario = coalesceUsuarioIdentity(await window.fetchCurrentUsuario(sessionUser.auth_id), sessionUser);
      if (!usuario?.auth_id && sessionUser?.auth_id) usuario.auth_id = sessionUser.auth_id;
      syncSessionPayload(usuario);
    } catch {
      syncSessionPayload(coalesceUsuarioIdentity(null, sessionUser));
    }
  }

  function toggleEmpresaFields() {
    const hasVinculo = !!document.getElementById('md-vinculo-exp')?.checked;
    const wrap = document.getElementById('md-empresa-campos');
    if (wrap) wrap.classList.toggle('hidden', hasVinculo);
  }

  function renderPlatformPalette() {
    const wrap = document.getElementById('gp-palette');
    if (!wrap) return;
    wrap.innerHTML = platformColors.map((color, index) =>
      '<button type="button" class="platform-swatch' + (index === 0 ? ' sel' : '') + '" data-color="' + color + '" style="background:' + color + '" onclick="selectPlatformColor(\'' + color + '\')"></button>'
    ).join('');
    wrap.setAttribute('data-selected', platformColors[0]);
  }

  window.selectPlatformColor = function selectPlatformColor(color) {
    const wrap = document.getElementById('gp-palette');
    if (!wrap) return;
    wrap.setAttribute('data-selected', color);
    wrap.querySelectorAll('.platform-swatch').forEach((node) => {
      node.classList.toggle('sel', node.getAttribute('data-color') === color);
    });
  };

  function selectedPlatformColor() {
    return document.getElementById('gp-palette')?.getAttribute('data-selected') || platformColors[0];
  }

  window.switchPlatformTab = function switchPlatformTab(tab) {
    const isUsuarios = tab !== 'termo';
    document.getElementById('platform-panel-usuarios')?.toggleAttribute('hidden', !isUsuarios);
    document.getElementById('platform-panel-termo')?.toggleAttribute('hidden', isUsuarios);
    document.getElementById('platform-tab-usuarios')?.classList.toggle('active', isUsuarios);
    document.getElementById('platform-tab-termo')?.classList.toggle('active', !isUsuarios);
  };

  window.toggleNovoUsuarioPlataforma = function toggleNovoUsuarioPlataforma(forceOpen) {
    const panel = document.getElementById('platform-new-user');
    if (!panel) return;
    const next = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
    panel.classList.toggle('open', next);
  };

  function ensurePlatformTermEditor() {
    const grid = document.getElementById('platform-term-grid');
    if (!grid || document.getElementById('platform-term-card')) return;
    const card = document.createElement('div');
    card.className = 'platform-card';
    card.id = 'platform-term-card';
    card.innerHTML = ''
      + '<div class="platform-card-title">'
      + '  <div>'
      + '    <strong>Termo de uso e proteÃ§Ã£o de dados</strong>'
      + '    <span>Texto-base gerenciavel pela Gestao de plataforma.</span>'
      + '  </div>'
      + '</div>'
      + '<div class="meus-dados-grid">'
      + '  <div class="shell-field full">'
      + '    <label for="gp-term-title">Titulo do termo</label>'
      + '    <input id="gp-term-title" type="text" maxlength="220">'
      + '  </div>'
      + '  <div class="shell-field">'
      + '    <label for="gp-term-version">Versao do termo</label>'
      + '    <input id="gp-term-version" type="text" maxlength="40">'
      + '  </div>'
      + '  <div class="shell-field full">'
      + '    <label for="gp-term-priority">Compromisso Prioritario</label>'
      + '    <textarea id="gp-term-priority" rows="3"></textarea>'
      + '  </div>'
      + '  <div class="shell-field full">'
      + '    <label for="gp-term-content">Texto formal do termo</label>'
      + '    <textarea id="gp-term-content" rows="12"></textarea>'
      + '  </div>'
      + '</div>'
      + '<div class="platform-inline">'
      + '  <button type="button" class="shell-btn primary" onclick="salvarTermoPlataforma()">Salvar termo</button>'
      + '  <span class="shell-inline-note">Sempre que a versao mudar, o novo ciclo de aceite pode ser reiniciado administrativamente.</span>'
      + '</div>';
    grid.appendChild(card);
  }

  function fillTermEditor() {
    const title = document.getElementById('gp-term-title');
    const version = document.getElementById('gp-term-version');
    const priority = document.getElementById('gp-term-priority');
    const content = document.getElementById('gp-term-content');
    if (!title || !version || !priority || !content) return;
    title.value = currentTermDefinition.titulo || DEFAULT_TERM_DEFINITION.titulo;
    version.value = currentTermDefinition.versao_termo || DEFAULT_TERM_DEFINITION.versao_termo;
    priority.value = currentTermDefinition.compromisso_prioritario || DEFAULT_TERM_DEFINITION.compromisso_prioritario;
    content.value = currentTermDefinition.conteudo_texto || DEFAULT_TERM_DEFINITION.conteudo_texto;
  }

  function roleLabel(role) {
    if (role === 'socio_admin') return 'SÃ³cio administrador';
    if (role === 'socio') return 'SÃ³cio';
    if (role === 'colaborador') return 'Colaborador';
    return role || 'sem role';
  }

  function termStatusLabel(termo) {
    const status = String(termo?.status_termo || 'pending').toLowerCase();
    if (status === 'signed') {
      return termo?.expira_em
        ? 'Assinado Â· validade ate ' + (formatPtDate(termo.expira_em) || '-')
        : 'Assinado';
    }
    if (status === 'expired') return 'Vencido';
    return 'Pendente';
  }

  const baseFetchCurrentUsuario = window.fetchCurrentUsuario;
  if (typeof baseFetchCurrentUsuario === 'function') {
    window.fetchCurrentUsuario = async function fetchCurrentUsuarioWithTerm(authId) {
      const fallback = currentSessionUsuario();
      try {
        const usuario = await baseFetchCurrentUsuario(authId);
        if (!usuario) return coalesceUsuarioIdentity(null, fallback);
        const termo = await ensureTermoRegistro(usuario.id);
        return coalesceUsuarioIdentity(attachTermToUsuario(usuario, termo), fallback);
      } catch {
        try {
          const usuario = await baseFetchCurrentUsuario(authId);
          return coalesceUsuarioIdentity(usuario, fallback);
        } catch {
          return coalesceUsuarioIdentity(null, fallback);
        }
      }
    };
  }

  function fillMeusDadosForm(usuario, dados, profissionais, empresariais, bancarios) {
    dados = dados || {};
    profissionais = profissionais || {};
    empresariais = empresariais || {};
    bancarios = bancarios || {};

    document.getElementById('md-nome-completo').value = dados.nome_completo || usuario.nome || '';
    document.getElementById('md-apelido').value = usuario.apelido || (usuario.nome ? usuario.nome.split(' ')[0] : '');
    document.getElementById('md-email-login').value = usuario.email_login || usuario.email || '';
    document.getElementById('md-email-pessoal').value = dados.email_pessoal || '';
    document.getElementById('md-data-nascimento').value = dados.data_nascimento || '';
    document.getElementById('md-cidade-nascimento').value = dados.cidade_nascimento || '';
    document.getElementById('md-uf-nascimento').value = dados.uf_nascimento || '';
    document.getElementById('md-celular').value = dados.celular || '';
    document.getElementById('md-telefone-corporativo').value = dados.telefone_corporativo || '';
    document.getElementById('md-telefone-fixo').value = dados.telefone_fixo || '';
    document.getElementById('md-logradouro').value = dados.logradouro || '';
    document.getElementById('md-numero').value = dados.numero || '';
    document.getElementById('md-complemento').value = dados.complemento || '';
    document.getElementById('md-cep').value = dados.cep || '';
    document.getElementById('md-bairro').value = dados.bairro || '';
    document.getElementById('md-cidade').value = dados.cidade || '';
    document.getElementById('md-uf').value = dados.uf || '';
    document.getElementById('md-emergencia-nome').value = dados.emergencia_nome || '';
    document.getElementById('md-emergencia-relacao').value = dados.emergencia_relacao || '';
    document.getElementById('md-emergencia-telefone').value = dados.emergencia_telefone || '';
    document.getElementById('md-registro-cau').value = profissionais.registro_cau || '';
    document.getElementById('md-instituicao-formacao').value = profissionais.instituicao_formacao || '';
    document.getElementById('md-mes-ano-formacao').value = profissionais.mes_ano_formacao || '';
    document.getElementById('md-vinculo-exp').checked = !!empresariais.vinculo_exp;
    toggleEmpresaFields();
    document.getElementById('md-razao-social').value = empresariais.razao_social || '';
    document.getElementById('md-nome-fantasia').value = empresariais.nome_fantasia || '';
    document.getElementById('md-cnpj').value = empresariais.cnpj || '';
    document.getElementById('md-data-inscricao').value = empresariais.data_inscricao || '';
    document.getElementById('md-regime-tributario').value = empresariais.regime_tributario || '';
    document.getElementById('md-emp-logradouro').value = empresariais.logradouro || '';
    document.getElementById('md-emp-numero').value = empresariais.numero || '';
    document.getElementById('md-emp-complemento').value = empresariais.complemento || '';
    document.getElementById('md-emp-cep').value = empresariais.cep || '';
    document.getElementById('md-emp-bairro').value = empresariais.bairro || '';
    document.getElementById('md-emp-municipio').value = empresariais.municipio || '';
    document.getElementById('md-emp-uf').value = empresariais.uf || '';
    document.getElementById('md-email-empresarial').value = empresariais.email_empresarial || '';
    document.getElementById('md-telefone-empresarial').value = empresariais.telefone_empresarial || '';
    document.getElementById('md-banco').value = bancarios.banco || '';
    document.getElementById('md-agencia').value = bancarios.agencia || '';
    document.getElementById('md-conta').value = bancarios.conta || '';
    document.getElementById('md-tipo-conta').value = bancarios.tipo_conta || '';
    document.getElementById('md-titular').value = bancarios.titular || '';
    document.getElementById('md-documento-titular').value = bancarios.documento_titular || '';
    document.getElementById('md-chave-pix').value = bancarios.chave_pix || '';
    document.getElementById('md-tipo-chave-pix').value = bancarios.tipo_chave_pix || '';
    toggleEmpresaFields();

    const avatar = document.getElementById('meus-dados-avatar');
    avatar.style.background = usuario.cor || '#888';
    avatar.innerHTML = '';
    if (usuario.avatar_url) {
      const img = document.createElement('img');
      img.src = usuario.avatar_url;
      img.alt = usuario.nome || 'Avatar';
      avatar.appendChild(img);
    } else {
      avatar.textContent = usuario.iniciais || initialsFromNome(usuario.nome);
    }
    document.getElementById('meus-dados-hero-nome').textContent = dados.nome_completo || usuario.nome || '-';
    document.getElementById('meus-dados-hero-resumo').textContent = roleLabel(usuario.role) + ' Â· ' + (usuario.email_login || usuario.email || 'sem email institucional registrado');
  }

  window.abrirMeusDados = async function abrirMeusDados() {
    document.getElementById('user-dropdown')?.classList.remove('open');
    const overlay = document.getElementById('meus-dados-overlay');
    if (!overlay) return;
    bindShellDirtyGuards();
    overlay.classList.add('open');
    setMeusDadosDirty(false);
    setMeusDadosStatus('Carregando dados pessoais...');

    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.app_user_id || !sessionUser?.auth_id) {
      setMeusDadosStatus('SessÃ£o do usuÃ¡rio indisponÃ­vel para carregar "Meus dados".');
      return;
    }

    const usuario = await window.fetchCurrentUsuario(sessionUser.auth_id);
    if (!usuario) {
      setMeusDadosStatus('NÃ£o foi possÃ­vel carregar a identidade base do usuÃ¡rio.');
      return;
    }

    const [pessoais, profissionais, empresariais, bancarios] = await Promise.all([
      window.sb.from('usuarios_dados_pessoais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_profissionais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_empresariais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_bancarios').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle()
    ]);

    if (pessoais.error) {
      setMeusDadosStatus('Falha ao carregar os dados pessoais do usuÃ¡rio.');
      fillMeusDadosForm(usuario, {}, profissionais.data || {}, empresariais.data || {}, bancarios.data || {});
      return;
    }

    fillMeusDadosForm(usuario, pessoais.data || {}, profissionais.data || {}, empresariais.data || {}, bancarios.data || {});
    setMeusDadosDirty(false);
    setMeusDadosStatus('Dados carregados. A ficha base de "Meus dados" ja esta funcional.');
  };

  window.fecharMeusDados = function fecharMeusDados(event) {
    if (event && event.target && event.target.id === 'meus-dados-overlay') return;
    if (event && event.target && event.target.id !== 'meus-dados-overlay') return;
    if (meusDadosDirty && !window.confirm('Existem alteracoes nao salvas em "Meus dados". Deseja fechar e perder essas alteracoes?')) return;
    document.getElementById('meus-dados-overlay')?.classList.remove('open');
    setMeusDadosDirty(false);
  };

  async function saveUpsert(table, payload) {
    return window.sb.from(table).upsert(payload, { onConflict: 'usuario_id' });
  }

  window.salvarMeusDados = async function salvarMeusDados() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.app_user_id || !sessionUser?.auth_id) {
      setMeusDadosStatus('SessÃ£o invÃ¡lida para salvar os dados.');
      return;
    }

    setMeusDadosStatus('Salvando dados...');

    const nomeCompleto = document.getElementById('md-nome-completo').value.trim();
    const apelido = document.getElementById('md-apelido').value.trim();
    const nomeBase = nomeCompleto || sessionUser.nome || null;
    const apelidoBase = apelido || sessionUser.apelido || (nomeBase ? nomeBase.split(' ')[0] : null);
    const usuarioPayload = {
      nome: nomeBase,
      apelido: apelidoBase,
      iniciais: initialsFromNome(nomeBase || apelidoBase || '')
    };

    const dadosPessoaisPayload = {
      usuario_id: sessionUser.app_user_id,
      nome_completo: nomeCompleto || null,
      data_nascimento: document.getElementById('md-data-nascimento').value || null,
      cidade_nascimento: document.getElementById('md-cidade-nascimento').value.trim() || null,
      uf_nascimento: document.getElementById('md-uf-nascimento').value.trim().toUpperCase() || null,
      email_pessoal: document.getElementById('md-email-pessoal').value.trim() || null,
      celular: document.getElementById('md-celular').value.trim() || null,
      telefone_corporativo: document.getElementById('md-telefone-corporativo').value.trim() || null,
      telefone_fixo: document.getElementById('md-telefone-fixo').value.trim() || null,
      logradouro: document.getElementById('md-logradouro').value.trim() || null,
      numero: document.getElementById('md-numero').value.trim() || null,
      complemento: document.getElementById('md-complemento').value.trim() || null,
      cep: document.getElementById('md-cep').value.trim() || null,
      bairro: document.getElementById('md-bairro').value.trim() || null,
      cidade: document.getElementById('md-cidade').value.trim() || null,
      uf: document.getElementById('md-uf').value.trim().toUpperCase() || null,
      emergencia_nome: document.getElementById('md-emergencia-nome').value.trim() || null,
      emergencia_relacao: document.getElementById('md-emergencia-relacao').value.trim() || null,
      emergencia_telefone: document.getElementById('md-emergencia-telefone').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const dadosProfissionaisPayload = {
      usuario_id: sessionUser.app_user_id,
      registro_cau: document.getElementById('md-registro-cau').value.trim() || null,
      instituicao_formacao: document.getElementById('md-instituicao-formacao').value.trim() || null,
      mes_ano_formacao: document.getElementById('md-mes-ano-formacao').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const dadosEmpresariaisPayload = {
      usuario_id: sessionUser.app_user_id,
      vinculo_exp: !!document.getElementById('md-vinculo-exp').checked,
      razao_social: document.getElementById('md-razao-social').value.trim() || null,
      nome_fantasia: document.getElementById('md-nome-fantasia').value.trim() || null,
      cnpj: document.getElementById('md-cnpj').value.trim() || null,
      data_inscricao: document.getElementById('md-data-inscricao').value || null,
      regime_tributario: document.getElementById('md-regime-tributario').value || null,
      logradouro: document.getElementById('md-emp-logradouro').value.trim() || null,
      numero: document.getElementById('md-emp-numero').value.trim() || null,
      complemento: document.getElementById('md-emp-complemento').value.trim() || null,
      cep: document.getElementById('md-emp-cep').value.trim() || null,
      bairro: document.getElementById('md-emp-bairro').value.trim() || null,
      municipio: document.getElementById('md-emp-municipio').value.trim() || null,
      uf: document.getElementById('md-emp-uf').value.trim().toUpperCase() || null,
      email_empresarial: document.getElementById('md-email-empresarial').value.trim() || null,
      telefone_empresarial: document.getElementById('md-telefone-empresarial').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const dadosBancariosPayload = {
      usuario_id: sessionUser.app_user_id,
      banco: document.getElementById('md-banco').value.trim() || null,
      agencia: document.getElementById('md-agencia').value.trim() || null,
      conta: document.getElementById('md-conta').value.trim() || null,
      tipo_conta: document.getElementById('md-tipo-conta').value || null,
      titular: document.getElementById('md-titular').value.trim() || null,
      documento_titular: document.getElementById('md-documento-titular').value.trim() || null,
      chave_pix: document.getElementById('md-chave-pix').value.trim() || null,
      tipo_chave_pix: document.getElementById('md-tipo-chave-pix').value || null,
      updated_at: new Date().toISOString()
    };

    const { data: userRows, error: userError } = await window.sb
      .from('usuarios')
      .update(usuarioPayload)
      .eq('id', sessionUser.app_user_id)
      .select('id, apelido, nome');
    if (userError || !userRows || !userRows.length) {
      setMeusDadosStatus('Nao foi possivel salvar a identidade base do usuario.');
      return;
    }

    const [personalResult, professionalResult, businessResult, bankResult] = await Promise.all([
      saveUpsert('usuarios_dados_pessoais', dadosPessoaisPayload),
      saveUpsert('usuarios_dados_profissionais', dadosProfissionaisPayload),
      saveUpsert('usuarios_dados_empresariais', dadosEmpresariaisPayload),
      saveUpsert('usuarios_dados_bancarios', dadosBancariosPayload)
    ]);

    if (personalResult.error || professionalResult.error || businessResult.error || bankResult.error) {
      setMeusDadosStatus('Nao foi possivel salvar todos os blocos de "Meus dados".');
      return;
    }

    const usuarioAtualizado = coalesceUsuarioIdentity(await window.fetchCurrentUsuario(sessionUser.auth_id), {
      ...sessionUser,
      nome: usuarioPayload.nome,
      apelido: usuarioPayload.apelido,
      iniciais: usuarioPayload.iniciais
    });
    syncSessionPayload(usuarioAtualizado);
    fillMeusDadosForm(usuarioAtualizado, dadosPessoaisPayload, dadosProfissionaisPayload, dadosEmpresariaisPayload, dadosBancariosPayload);

    setMeusDadosDirty(false);
    setMeusDadosStatus('Dados salvos com sucesso.');
  };

  function buildPlatformUserAvatar(user) {
    return user.avatar_url
      ? '<img src="' + user.avatar_url + '" alt="' + (user.nome || 'Avatar') + '">'
      : (user.iniciais || initialsFromNome(user.nome));
  }

  async function carregarTermosUsuariosPlataforma(userIds) {
    platformTermosCache = {};
    if (!userIds || !userIds.length) return;
    let data = null;
    let error = null;
    try {
      ({ data, error } = await window.sb
        .from('usuarios_termos_compromisso')
        .select('id, usuario_id, versao_termo, status_termo, assinado_em, expira_em, created_at')
        .in('usuario_id', userIds)
        .order('created_at', { ascending: false }));
    } catch (caughtError) {
      error = caughtError;
    }
    if (error || !data) return;
    data.forEach((row) => {
      if (!platformTermosCache[row.usuario_id]) {
        platformTermosCache[row.usuario_id] = normalizeTermoStatus(row);
      }
    });
  }

  function renderPlatformUsersList(users) {
    const wrap = document.getElementById('platform-users-list');
    if (!wrap) return;
    if (!users.length) {
      wrap.innerHTML = '<div class="platform-empty">Nenhum usuÃ¡rio encontrado.</div>';
      return;
    }
    wrap.innerHTML = users.map((user) => {
      const current = currentSessionUsuario()?.app_user_id === user.id;
      const termo = platformTermosCache[user.id] || null;
      return '<div class="platform-user-row">'
        + '<div class="platform-user-avatar clickable" title="Alterar avatar" onclick="subirAvatarPlataforma(\'' + user.id + '\')" style="background:' + (user.cor || '#888') + '">' + buildPlatformUserAvatar(user) + '</div>'
        + '<div class="platform-user-copy"><strong>' + (user.nome || '-') + '</strong><span>' + (user.email_login || user.email || 'sem login institucional') + '<br>' + (user.apelido || '-') + ' Â· ' + roleLabel(user.role) + '</span></div>'
        + '<div class="platform-user-meta">Status: ' + (user.status_acesso || (user.ativo ? 'ativo' : 'inativo')) + '<br>Termo: ' + termStatusLabel(termo) + '<br>Platform manager: ' + (user.is_platform_manager ? 'sim' : 'nao') + '</div>'
        + '<div class="platform-inline">'
        + '<select id="platform-role-' + user.id + '" class="shell-btn" onchange="salvarRolePlatform(\'' + user.id + '\', this.value)">'
        + '<option value="colaborador"' + (user.role === 'colaborador' ? ' selected' : '') + '>Colaborador</option>'
        + '<option value="socio"' + (user.role === 'socio' ? ' selected' : '') + '>Socio</option>'
        + '<option value="socio_admin"' + (user.role === 'socio_admin' ? ' selected' : '') + '>Socio administrador</option>'
        + '</select>'
        + '<select id="platform-status-' + user.id + '" class="shell-btn" onchange="salvarStatusPlatform(\'' + user.id + '\', this.value)">'
        + '<option value="ativo"' + ((user.status_acesso || 'ativo') === 'ativo' ? ' selected' : '') + '>Ativo</option>'
        + '<option value="inativo"' + (user.status_acesso === 'inativo' ? ' selected' : '') + '>Inativo</option>'
        + '<option value="bloqueado"' + (user.status_acesso === 'bloqueado' ? ' selected' : '') + '>Bloqueado</option>'
        + '</select></div>'
        + '<div class="platform-user-actions"><label class="shell-check"><input type="checkbox"' + (user.is_platform_manager ? ' checked' : '') + ' onchange="salvarPlatformManager(\'' + user.id + '\', this.checked)"> Gestor</label>' + (current ? '<span class="platform-user-meta">usuÃ¡rio atual</span>' : '') + '</div>'
        + '<div class="platform-inline"><button type="button" class="shell-btn warn" onclick="resetarTermoPlataforma(\'' + user.id + '\')">Resetar termo</button></div>'
        + '</div>';
    }).join('');
  }

  async function carregarUsuariosPlataforma() {
    const wrap = document.getElementById('platform-users-list');
    if (wrap) wrap.innerHTML = '<div class="platform-empty">Carregando usuarios...</div>';
    const { data, error } = await window.sb
      .from('usuarios')
      .select('id, auth_id, nome, apelido, iniciais, cor, role, email, email_login, ativo, status_acesso, is_platform_manager, avatar_url')
      .order('nome', { ascending: true });
    if (error) {
      setPlataformaStatus('Nao foi possivel carregar a lista de usuarios.');
      if (wrap) wrap.innerHTML = '<div class="platform-empty">Falha ao carregar usuarios.</div>';
      return;
    }
    platformUsersCache = data || [];
    await carregarTermosUsuariosPlataforma(platformUsersCache.map((user) => user.id));
    renderPlatformUsersList(platformUsersCache);
    setPlataformaStatus('Lista de usuarios carregada.');
  }

  function ensureAvatarInput() {
    let input = document.getElementById('platform-avatar-input');
    if (input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'platform-avatar-input';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = () => window.processarAvatarPlataforma(input);
    document.body.appendChild(input);
    return input;
  }

  function comprimirImagem(file, maxDim) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const size = Math.min(img.width, img.height);
        const dim = Math.min(size, maxDim);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = dim;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, dim, dim);
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      };
      img.src = url;
    });
  }

  window.subirAvatarPlataforma = function subirAvatarPlataforma(userId) {
    pendingAvatarUserId = userId;
    const input = ensureAvatarInput();
    input.value = '';
    input.click();
  };

  window.processarAvatarPlataforma = async function processarAvatarPlataforma(input) {
    const file = input.files && input.files[0];
    const uid = pendingAvatarUserId;
    if (!file || !uid) return;
    setPlataformaStatus('Enviando avatar...');
    const blob = await comprimirImagem(file, 240);
    const path = uid + '.jpg';
    const { error: uploadError } = await window.sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) { setPlataformaStatus('Erro ao subir avatar.'); return; }
    const { data } = window.sb.storage.from('avatars').getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    const { error: updateError } = await window.sb.from('usuarios').update({ avatar_url: cleanUrl }).eq('id', uid);
    if (updateError) { setPlataformaStatus('Avatar enviado, mas nao foi possivel salvar a URL.'); return; }
    const current = currentSessionUsuario();
    if (current?.app_user_id === uid) {
      const usuarioAtualizado = await window.fetchCurrentUsuario(current.auth_id);
      if (usuarioAtualizado) {
        const payload = window.buildExpUsuarioPayload(current.auth_id, usuarioAtualizado);
        sessionStorage.setItem('exp_usuario', JSON.stringify(payload));
        window.renderShellIdentity(usuarioAtualizado);
        window.publishSessionReady(payload);
      }
    }
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Avatar atualizado.');
  };

  window.salvarRolePlatform = async function salvarRolePlatform(userId, role) {
    const payload = { role };
    if (role !== 'socio_admin') payload.is_platform_manager = false;
    const { error } = await window.sb.from('usuarios').update(payload).eq('id', userId);
    if (error) { setPlataformaStatus('Nao foi possivel atualizar o role.'); return; }
    await registrarAuditoriaPlataforma('usuario.role_atualizado', userId, { role });
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Role atualizada.');
  };

  window.salvarStatusPlatform = async function salvarStatusPlatform(userId, status) {
    const current = currentSessionUsuario();
    const patch = {
      status_acesso: status,
      ativo: status === 'ativo',
      inativado_em: status === 'inativo' ? isoNow() : null,
      inativado_por: status === 'inativo' ? current?.app_user_id || null : null,
      bloqueado_em: status === 'bloqueado' ? isoNow() : null,
      bloqueado_por: status === 'bloqueado' ? current?.app_user_id || null : null
    };
    const { error } = await window.sb.from('usuarios').update(patch).eq('id', userId);
    if (error) { setPlataformaStatus('Nao foi possivel atualizar o status.'); return; }
    await registrarAuditoriaPlataforma('usuario.status_atualizado', userId, { status });
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Status atualizado.');
  };

  window.salvarPlatformManager = async function salvarPlatformManager(userId, checked) {
    const target = platformUsersCache.find((user) => String(user.id) === String(userId));
    if (!target) return;
    if (checked && target.role !== 'socio_admin') {
      setPlataformaStatus('A capability de plataforma so pode ser atribuida a socio administrador.');
      await carregarUsuariosPlataforma();
      return;
    }
    const { error } = await window.sb.from('usuarios').update({ is_platform_manager: !!checked }).eq('id', userId);
    if (error) { setPlataformaStatus('Nao foi possivel atualizar a capability de plataforma.'); return; }
    await registrarAuditoriaPlataforma('usuario.platform_manager_atualizado', userId, { is_platform_manager: !!checked });
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Capability de plataforma atualizada.');
  };

  window.salvarTermoPlataforma = async function salvarTermoPlataforma() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.is_platform_manager && sessionUser?.role !== 'socio_admin') {
      setPlataformaStatus('A edicao do termo exige acesso administrativo de plataforma.');
      return;
    }
    const titulo = document.getElementById('gp-term-title')?.value.trim() || DEFAULT_TERM_DEFINITION.titulo;
    const versao = document.getElementById('gp-term-version')?.value.trim() || DEFAULT_TERM_DEFINITION.versao_termo;
    const compromisso = document.getElementById('gp-term-priority')?.value.trim() || DEFAULT_TERM_DEFINITION.compromisso_prioritario;
    const conteudo = document.getElementById('gp-term-content')?.value.trim() || DEFAULT_TERM_DEFINITION.conteudo_texto;
    setPlataformaStatus('Salvando definicao do termo...');
    const payload = {
      slug: DEFAULT_TERM_DEFINITION.slug,
      titulo,
      versao_termo: versao,
      compromisso_prioritario: compromisso,
      conteudo_texto: conteudo,
      ativo: true,
      updated_at: isoNow(),
      updated_by: sessionUser.app_user_id || null
    };
    const { error } = await window.sb
      .from('plataforma_termos')
      .upsert(payload, { onConflict: 'slug' });
    if (error) {
      setPlataformaStatus('Nao foi possivel salvar a definicao do termo. Rode o SQL da estrutura gerenciavel se necessario.');
      return;
    }
    currentTermDefinition = { ...currentTermDefinition, ...payload };
    await registrarAuditoriaPlataforma('termo.atualizado', null, { versao_termo: versao });
    renderTermText();
    setPlataformaDirty(false);
    setPlataformaStatus('Definicao do termo atualizada.');
  };

  window.resetarTermoPlataforma = async function resetarTermoPlataforma(userId) {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.is_platform_manager && sessionUser?.role !== 'socio_admin') {
      setPlataformaStatus('Este fluxo exige acesso administrativo de plataforma.');
      return;
    }
    setPlataformaStatus('Resetando ciclo do termo...');
    const termoAtual = await fetchLatestTermo(userId);
    const payload = {
      usuario_id: userId,
      versao_termo: currentTermDefinition.versao_termo,
      status_termo: 'pending',
      assinado_em: null,
      expira_em: null,
      resetado_em: isoNow(),
      resetado_por: sessionUser.app_user_id || null,
      motivo_reset: 'Reset administrativo pela Gestao de plataforma'
    };
    const { error } = termoAtual?.id
      ? await window.sb.from('usuarios_termos_compromisso').update(payload).eq('id', termoAtual.id)
      : await window.sb.from('usuarios_termos_compromisso').insert(payload);
    if (error) {
      setPlataformaStatus('Nao foi possivel resetar o termo deste usuario.');
      return;
    }
    await registrarAuditoriaPlataforma('termo.resetado', userId, { versao_termo: currentTermDefinition.versao_termo });
    if (String(currentSessionUsuario()?.app_user_id || '') === String(userId)) {
      await syncCurrentTermState();
    }
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Ciclo do termo resetado com sucesso.');
  };

  window.fecharGestaoPlataforma = function fecharGestaoPlataforma(event) {
    if (event && event.target && event.target.id === 'plataforma-overlay') return;
    if (event && event.target && event.target.id !== 'plataforma-overlay') return;
    if (plataformaDirty && !window.confirm('Existem dados nao salvos em "Gestao de plataforma". Deseja fechar e perder essas alteracoes?')) return;
    document.getElementById('plataforma-overlay')?.classList.remove('open');
    setPlataformaDirty(false);
  };

  window.abrirGestaoPlataforma = async function abrirGestaoPlataforma() {
    document.getElementById('user-dropdown')?.classList.remove('open');
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.is_platform_manager && sessionUser?.role !== 'socio_admin') {
      setPlataformaStatus('Este painel exige capability de plataforma.');
      return;
    }
    bindShellDirtyGuards();
    document.getElementById('plataforma-overlay')?.classList.add('open');
    setPlataformaDirty(false);
    window.switchPlatformTab('usuarios');
    window.toggleNovoUsuarioPlataforma(false);
    renderPlatformPalette();
    ensurePlatformTermEditor();
    await fetchCurrentTermDefinition();
    fillTermEditor();
    setPlataformaStatus('Carregando painel de usuarios...');
    await carregarUsuariosPlataforma();
  };

  window.abrirGestaoPlataformaStub = function abrirGestaoPlataformaStub() {
    return window.abrirGestaoPlataforma();
  };

  window.criarNovoUsuarioPlataforma = async function criarNovoUsuarioPlataforma() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.is_platform_manager && sessionUser?.role !== 'socio_admin') {
      setPlataformaStatus('Este fluxo exige capability de plataforma.');
      return;
    }
    const nome = document.getElementById('gp-nome').value.trim();
    const emailLogin = document.getElementById('gp-email-login').value.trim();
    const senha = document.getElementById('gp-senha').value.trim();
    const role = document.getElementById('gp-role').value;
    const isPlatformManager = !!document.getElementById('gp-platform-manager').checked;
    const cor = selectedPlatformColor();
    if (!nome || !emailLogin || !senha) {
      setPlataformaStatus('Preencha nome, login institucional e senha inicial.');
      return;
    }
    if (isPlatformManager && role !== 'socio_admin') {
      setPlataformaStatus('Gestor de plataforma deve ser socio administrador.');
      return;
    }
    setPlataformaStatus('Criando usuario...');
    const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({
      email: emailLogin,
      password: senha,
      options: { data: { nome } }
    });
    if (signUpError || !signUpData?.user?.id) {
      setPlataformaStatus('Nao foi possivel criar o usuario no Auth. O backend de criacao ainda pode precisar de ajuste.');
      return;
    }

    const authId = signUpData.user.id;
    const upsertPayload = {
      auth_id: authId,
      nome,
      apelido: nome.split(' ')[0] || null,
      iniciais: initialsFromNome(nome),
      cor,
      role,
      email: emailLogin,
      email_login: emailLogin,
      is_platform_manager: role === 'socio_admin' ? isPlatformManager : false,
      status_acesso: 'ativo',
      ativo: true,
      criado_por: sessionUser.app_user_id || null
    };

    const { data: existingUser } = await window.sb.from('usuarios').select('id').eq('auth_id', authId).maybeSingle();
    let targetUsuarioId = existingUser?.id || null;
    if (existingUser?.id) {
      const { error: updateError } = await window.sb.from('usuarios').update(upsertPayload).eq('id', existingUser.id);
      if (updateError) {
        setPlataformaStatus('UsuÃ¡rio Auth criado, mas nao foi possivel concluir o cadastro institucional.');
        return;
      }
    } else {
      const { data: insertedRows, error: insertError } = await window.sb.from('usuarios').insert(upsertPayload).select('id');
      if (insertError) {
        setPlataformaStatus('UsuÃ¡rio Auth criado, mas nao foi possivel criar a linha institucional em usuarios.');
        return;
      }
      targetUsuarioId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;
    }

    document.getElementById('gp-nome').value = '';
    document.getElementById('gp-email-login').value = '';
    document.getElementById('gp-senha').value = '';
    document.getElementById('gp-role').value = 'colaborador';
    document.getElementById('gp-platform-manager').checked = false;
    window.selectPlatformColor(platformColors[0]);
    await registrarAuditoriaPlataforma('usuario.criado', targetUsuarioId, { nome, email_login: emailLogin, role, is_platform_manager: upsertPayload.is_platform_manager });
    setPlataformaDirty(false);
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Novo usuario criado com sucesso.');
  };

  window.abrirTermoCompromisso = async function abrirTermoCompromisso() {
    ensureTermModal();
    await fetchCurrentTermDefinition();
    renderTermText();
    const overlay = document.getElementById('termo-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.app_user_id) {
      renderTermStatusCopy(null);
      return;
    }
    const termo = normalizeTermoStatus(await ensureTermoRegistro(sessionUser.app_user_id));
    renderTermStatusCopy(termo);
  };

  window.fecharTermoCompromisso = function fecharTermoCompromisso() {
    document.getElementById('termo-overlay')?.classList.remove('open');
  };

  window.assinarTermoCompromisso = async function assinarTermoCompromisso() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.app_user_id) return;
    const termoAtual = await ensureTermoRegistro(sessionUser.app_user_id);
    const payload = {
      usuario_id: sessionUser.app_user_id,
      versao_termo: currentTermDefinition.versao_termo,
      status_termo: 'signed',
      assinado_em: isoNow(),
      expira_em: plusDaysIso(TERM_VALIDITY_DAYS),
      resetado_em: null,
      resetado_por: null,
      motivo_reset: null
    };
    const { error } = termoAtual?.id
      ? await window.sb.from('usuarios_termos_compromisso').update(payload).eq('id', termoAtual.id)
      : await window.sb.from('usuarios_termos_compromisso').insert(payload);
    if (error) {
      document.getElementById('termo-modal-status').textContent = 'Nao foi possivel registrar a assinatura do termo.';
      return;
    }
    const termo = normalizeTermoStatus(await ensureTermoRegistro(sessionUser.app_user_id));
    renderTermStatusCopy(termo);
    await syncCurrentTermState();
  };

  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'md-vinculo-exp') toggleEmpresaFields();
  });

  document.getElementById('user-term-state')?.addEventListener('click', () => window.abrirTermoCompromisso());
  document.getElementById('term-chip')?.addEventListener('click', () => window.abrirTermoCompromisso());
  document.getElementById('user-term-state')?.setAttribute('title', 'Visualizar termo de compromisso');
  document.getElementById('term-chip')?.setAttribute('title', 'Visualizar termo de compromisso');

  const usuariosTab = document.querySelector('.socio-tab[data-panel="usuarios"]');
  if (usuariosTab) {
    usuariosTab.style.display = 'none';
  }

  syncCurrentTermState();
})();

