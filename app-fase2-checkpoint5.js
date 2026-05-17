(function () {
  const signupClient = window.supabase.createClient(
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
  let pendingAvatarUserId = null;
  let meusDadosDirty = false;
  let plataformaDirty = false;

  function currentSessionUsuario() {
    try {
      return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null');
    } catch {
      return null;
    }
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

  function toggleEmpresaFields() {
    const disabled = !!document.getElementById('md-vinculo-exp')?.checked;
    [
      'md-razao-social','md-nome-fantasia','md-cnpj','md-data-inscricao','md-regime-tributario',
      'md-emp-logradouro','md-emp-numero','md-emp-complemento','md-emp-cep','md-emp-bairro',
      'md-emp-municipio','md-emp-uf','md-email-empresarial','md-telefone-empresarial'
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
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

  function roleLabel(role) {
    if (role === 'socio_admin') return 'Sócio administrador';
    if (role === 'socio') return 'Sócio';
    if (role === 'colaborador') return 'Colaborador';
    return role || 'sem role';
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
    document.getElementById('meus-dados-hero-resumo').textContent = roleLabel(usuario.role) + ' · ' + (usuario.email_login || usuario.email || 'sem email institucional registrado');
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
      setMeusDadosStatus('Sessão do usuário indisponível para carregar "Meus dados".');
      return;
    }

    const usuario = await window.fetchCurrentUsuario(sessionUser.auth_id);
    if (!usuario) {
      setMeusDadosStatus('Não foi possível carregar a identidade base do usuário.');
      return;
    }

    const [pessoais, profissionais, empresariais, bancarios] = await Promise.all([
      window.sb.from('usuarios_dados_pessoais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_profissionais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_empresariais').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle(),
      window.sb.from('usuarios_dados_bancarios').select('*').eq('usuario_id', sessionUser.app_user_id).maybeSingle()
    ]);

    if (pessoais.error) {
      setMeusDadosStatus('Falha ao carregar os dados pessoais do usuário.');
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
      setMeusDadosStatus('Sessão inválida para salvar os dados.');
      return;
    }

    setMeusDadosStatus('Salvando dados...');

    const nomeCompleto = document.getElementById('md-nome-completo').value.trim();
    const apelido = document.getElementById('md-apelido').value.trim();
    const usuarioPayload = {
      nome: nomeCompleto || null,
      apelido: apelido || null,
      iniciais: initialsFromNome(nomeCompleto || apelido || sessionUser.nome || '')
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

    const { error: userError } = await window.sb.from('usuarios').update(usuarioPayload).eq('id', sessionUser.app_user_id);
    if (userError) {
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

    const usuarioAtualizado = await window.fetchCurrentUsuario(sessionUser.auth_id);
    if (usuarioAtualizado) {
      const payload = window.buildExpUsuarioPayload(sessionUser.auth_id, usuarioAtualizado);
      sessionStorage.setItem('exp_usuario', JSON.stringify(payload));
      window.renderShellIdentity(usuarioAtualizado);
      window.publishSessionReady(payload);
      fillMeusDadosForm(usuarioAtualizado, dadosPessoaisPayload, dadosProfissionaisPayload, dadosEmpresariaisPayload, dadosBancariosPayload);
    }

    setMeusDadosDirty(false);
    setMeusDadosStatus('Dados salvos com sucesso.');
  };

  function buildPlatformUserAvatar(user) {
    return user.avatar_url
      ? '<img src="' + user.avatar_url + '" alt="' + (user.nome || 'Avatar') + '">'
      : (user.iniciais || initialsFromNome(user.nome));
  }

  function renderPlatformUsersList(users) {
    const wrap = document.getElementById('platform-users-list');
    if (!wrap) return;
    if (!users.length) {
      wrap.innerHTML = '<div class="platform-empty">Nenhum usuário encontrado.</div>';
      return;
    }
    wrap.innerHTML = users.map((user) => {
      const current = currentSessionUsuario()?.app_user_id === user.id;
      return '<div class="platform-user-row">'
        + '<div class="platform-user-avatar" style="background:' + (user.cor || '#888') + '">' + buildPlatformUserAvatar(user) + '</div>'
        + '<div class="platform-user-copy"><strong>' + (user.nome || '-') + '</strong><span>' + (user.email_login || user.email || 'sem login institucional') + '<br>' + (user.apelido || '-') + ' · ' + roleLabel(user.role) + '</span></div>'
        + '<div class="platform-user-meta">Status: ' + (user.status_acesso || (user.ativo ? 'ativo' : 'inativo')) + '<br>Platform manager: ' + (user.is_platform_manager ? 'sim' : 'nao') + '</div>'
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
        + '<div class="platform-user-actions"><label class="shell-check"><input type="checkbox"' + (user.is_platform_manager ? ' checked' : '') + ' onchange="salvarPlatformManager(\'' + user.id + '\', this.checked)"> Gestor</label><button type="button" class="shell-btn" onclick="subirAvatarPlataforma(\'' + user.id + '\')">Avatar</button>' + (current ? '<span class="platform-user-meta">usuário atual</span>' : '') + '</div>'
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
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Role atualizada.');
  };

  window.salvarStatusPlatform = async function salvarStatusPlatform(userId, status) {
    const patch = {
      status_acesso: status,
      ativo: status === 'ativo',
      inativado_em: status === 'inativo' ? new Date().toISOString() : null,
      bloqueado_em: status === 'bloqueado' ? new Date().toISOString() : null
    };
    const { error } = await window.sb.from('usuarios').update(patch).eq('id', userId);
    if (error) { setPlataformaStatus('Nao foi possivel atualizar o status.'); return; }
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
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Capability de plataforma atualizada.');
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
    if (!sessionUser?.is_platform_manager) {
      setPlataformaStatus('Este painel exige capability de plataforma.');
      return;
    }
    bindShellDirtyGuards();
    document.getElementById('plataforma-overlay')?.classList.add('open');
    setPlataformaDirty(false);
    renderPlatformPalette();
    setPlataformaStatus('Carregando painel de usuarios...');
    await carregarUsuariosPlataforma();
  };

  window.abrirGestaoPlataformaStub = function abrirGestaoPlataformaStub() {
    return window.abrirGestaoPlataforma();
  };

  window.criarNovoUsuarioPlataforma = async function criarNovoUsuarioPlataforma() {
    const sessionUser = currentSessionUsuario();
    if (!sessionUser?.is_platform_manager) {
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
      ativo: true
    };

    const { data: existingUser } = await window.sb.from('usuarios').select('id').eq('auth_id', authId).maybeSingle();
    if (existingUser?.id) {
      const { error: updateError } = await window.sb.from('usuarios').update(upsertPayload).eq('id', existingUser.id);
      if (updateError) {
        setPlataformaStatus('Usuário Auth criado, mas nao foi possivel concluir o cadastro institucional.');
        return;
      }
    } else {
      const { error: insertError } = await window.sb.from('usuarios').insert(upsertPayload);
      if (insertError) {
        setPlataformaStatus('Usuário Auth criado, mas nao foi possivel criar a linha institucional em usuarios.');
        return;
      }
    }

    document.getElementById('gp-nome').value = '';
    document.getElementById('gp-email-login').value = '';
    document.getElementById('gp-senha').value = '';
    document.getElementById('gp-role').value = 'colaborador';
    document.getElementById('gp-platform-manager').checked = false;
    window.selectPlatformColor(platformColors[0]);
    setPlataformaDirty(false);
    await carregarUsuariosPlataforma();
    setPlataformaStatus('Novo usuario criado com sucesso.');
  };

  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'md-vinculo-exp') toggleEmpresaFields();
  });
})();
