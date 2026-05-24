(() => {
  const SUPABASE_URL = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';

  let shellLifecycleBound = false;
  let shellUiBound = false;
  const SHELL_TIMEOUT_MS = 25000;

  function ensureClients() {
    if (!window.supabase) {
      throw new Error('Supabase JS nao foi carregado.');
    }
    if (!window.sb) {
      window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    if (!window.sbSignup) {
      window.sbSignup = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'exp-signup-temp' },
      });
    }
    return window.sb;
  }

  function isSocioRole(role) {
    return ['socio', 'socio_adm', 'socio_admin'].includes(String(role || '').toLowerCase());
  }

  function isSocioAdminRole(role) {
    return ['socio_adm', 'socio_admin'].includes(String(role || '').toLowerCase());
  }

  function buildExpUsuarioPayload(authId, usuario) {
    const nome = usuario?.nome || '';
    return {
      auth_id: authId || null,
      app_user_id: typeof usuario?.id !== 'undefined' ? usuario.id : null,
      nome,
      apelido: usuario?.apelido || (nome ? nome.split(' ')[0] : ''),
      iniciais: usuario?.iniciais || '',
      cor: usuario?.cor || '#888',
      avatar_url: usuario?.avatar_url || null,
      email_login: usuario?.email_login || usuario?.email || null,
      role: usuario?.role || '',
      viewer_only: !!usuario?.viewer_only,
      is_platform_manager: !!usuario?.is_platform_manager,
      can_coordinate_projects: !!usuario?.can_coordinate_projects,
      termo_status: usuario?.termo_status || null,
      termo_assinado_em: usuario?.termo_assinado_em || null,
      termo_expira_em: usuario?.termo_expira_em || null,
      status_acesso: usuario?.status_acesso || null,
    };
  }

  function currentSessionUsuario() {
    try {
      return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null');
    } catch {
      return null;
    }
  }

  function redirectToLogin() {
    sessionStorage.removeItem('exp_usuario');
    window.location.href = 'index.html';
  }

  function applySessionUsuario(authId, usuario) {
    const payload = buildExpUsuarioPayload(authId, usuario);
    sessionStorage.setItem('exp_usuario', JSON.stringify(payload));
    window.G = window.G || {};
    window.G.usuario = usuario;
    renderShellIdentity(usuario);
    publishSessionReady(payload);
    return payload;
  }

  function tryUseCachedUsuario(expectedAuthId = null) {
    const cached = currentSessionUsuario();
    if (!cached) return null;
    if (expectedAuthId && cached.auth_id && cached.auth_id !== expectedAuthId) return null;
    const payload = applySessionUsuario(cached.auth_id || expectedAuthId || null, cached);
    return { session: null, usuario: cached, payload, fromCache: true };
  }

  function withTimeout(promise, message, timeoutMs = SHELL_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  async function fetchCurrentUsuario(authId) {
    const sb = ensureClients();
    const { data: usuario, error } = await withTimeout(
      sb
        .from('usuarios')
        .select('id, nome, iniciais, role, cor, viewer_only, apelido, email, email_login, avatar_url, is_platform_manager, can_coordinate_projects, status_acesso')
        .eq('auth_id', authId)
        .single(),
      'Tempo esgotado ao carregar o usuario da sessao.'
    );
    if (error) {
      throw new Error(error.message || 'Falha ao carregar o usuario autenticado.');
    }
    if (!usuario) return null;
    const termo = await fetchLatestTermo(usuario.id);
    const usuarioComTermo = attachTermToUsuario(usuario, termo);
    return {
      ...usuarioComTermo,
      apelido: usuarioComTermo.apelido || null,
      email_login: usuarioComTermo.email_login || usuarioComTermo.email || null,
      avatar_url: usuarioComTermo.avatar_url || null,
      is_platform_manager: !!usuarioComTermo.is_platform_manager,
      can_coordinate_projects: !!usuarioComTermo.can_coordinate_projects,
      termo_status: usuarioComTermo.termo_status || null,
      termo_assinado_em: usuarioComTermo.termo_assinado_em || null,
      termo_expira_em: usuarioComTermo.termo_expira_em || null,
      status_acesso: usuarioComTermo.status_acesso || null,
    };
  }

  async function fetchLatestTermo(usuarioId) {
    if (!usuarioId) return null;
    try {
      const sb = ensureClients();
      const { data } = await sb
        .from('usuarios_termos_compromisso')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }

  function normalizeTermoStatus(termo) {
    if (!termo) {
      return {
        status_termo: null,
        assinado_em: null,
        expira_em: null,
      };
    }
    const expiresAt = termo.expira_em ? new Date(termo.expira_em).getTime() : null;
    if (termo.status_termo === 'signed' && expiresAt && expiresAt < Date.now()) {
      return { ...termo, status_termo: 'expired' };
    }
    return termo;
  }

  function attachTermToUsuario(usuario, termo) {
    const normalized = normalizeTermoStatus(termo);
    return {
      ...usuario,
      termo_status: normalized.status_termo || null,
      termo_assinado_em: normalized.assinado_em || null,
      termo_expira_em: normalized.expira_em || null,
    };
  }

  function publishSessionReady(payload) {
    window.dispatchEvent(new CustomEvent('exp:session-ready', { detail: payload }));
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('exp-theme', next);
  }

  function toggleUserMenu() {
    document.getElementById('user-dropdown')?.classList.toggle('open');
  }

  function bindShellUi() {
    if (shellUiBound) return;
    shellUiBound = true;
    document.addEventListener('click', (event) => {
      const wrap = document.querySelector('.user-pill-wrap');
      if (wrap && !wrap.contains(event.target)) {
        document.getElementById('user-dropdown')?.classList.remove('open');
      }
    });
  }

  function initConnDot() {
    const dot = document.getElementById('conn-dot');
    if (!dot) return;
    const update = () => {
      dot.className = 'conn-dot ' + (navigator.onLine ? 'online' : 'offline');
      dot.title = navigator.onLine ? 'Conectado' : 'Sem conexao';
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  }

  function renderShellIdentity(usuario) {
    const avatar = document.getElementById('user-av');
    if (avatar) {
      avatar.classList.toggle('has-avatar', !!usuario?.avatar_url);
      avatar.style.background = usuario?.cor || '#888';
      avatar.innerHTML = '';
      if (usuario?.avatar_url) {
        const img = document.createElement('img');
        img.src = usuario.avatar_url;
        img.alt = usuario.nome || 'Avatar';
        avatar.appendChild(img);
      } else {
        avatar.textContent = usuario?.iniciais || '';
      }
    }

    const nomeEl = document.getElementById('user-nome');
    if (nomeEl) {
      const parts = String(usuario?.nome || '').trim().split(/\s+/).filter(Boolean);
      nomeEl.textContent = parts.length <= 2
        ? (parts.join(' ') || '—')
        : `${parts[0]} ${parts[parts.length - 1]}`;
    }

    const cargoEl = document.getElementById('user-cargo');
    if (cargoEl) {
      cargoEl.textContent = window.EXP_ROLES_LABEL?.[usuario?.role] || usuario?.role || '—';
    }
  }

  async function bootstrapAuthenticatedShell() {
    const sb = ensureClients();
    try {
      const { data: { session } } = await withTimeout(
        sb.auth.getSession(),
        'Tempo esgotado ao validar a sessao atual.'
      );
      if (!session) {
        const cachedNoSession = tryUseCachedUsuario();
        if (cachedNoSession) return cachedNoSession;
        redirectToLogin();
        return null;
      }

      try {
        const usuario = await fetchCurrentUsuario(session.user.id);
        if (!usuario) {
          const cachedMissingUser = tryUseCachedUsuario(session.user.id);
          if (cachedMissingUser) return cachedMissingUser;
          await sb.auth.signOut();
          redirectToLogin();
          return null;
        }

        const payload = applySessionUsuario(session.user.id, usuario);
        return { session, usuario, payload };
      } catch (error) {
        const cachedTimedOut = tryUseCachedUsuario(session.user.id);
        if (cachedTimedOut) return cachedTimedOut;
        throw error;
      }
    } catch (error) {
      const cached = tryUseCachedUsuario();
      if (cached) return cached;
      throw error;
    }
  }

  function bindSessionLifecycle() {
    if (shellLifecycleBound) return;
    shellLifecycleBound = true;
    const sb = ensureClients();
    sb.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_OUT' || !session) {
          redirectToLogin();
          return;
        }
        if (!['TOKEN_REFRESHED', 'SIGNED_IN', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
          return;
        }
        const usuario = await fetchCurrentUsuario(session.user.id);
        if (!usuario) {
          const cachedMissingUser = tryUseCachedUsuario(session.user.id);
          if (cachedMissingUser) return;
          await sb.auth.signOut();
          redirectToLogin();
          return;
        }
        applySessionUsuario(session.user.id, usuario);
      } catch (error) {
        const cached = tryUseCachedUsuario(session?.user?.id || null);
        if (cached) return;
        console.warn('Falha ao atualizar sessao compartilhada.', error);
      }
    });
  }

  async function appShellInit() {
    ensureClients();
    bindShellUi();
    initConnDot();
    bindSessionLifecycle();
    return bootstrapAuthenticatedShell();
  }

  async function sair() {
    const sb = ensureClients();
    await sb.auth.signOut();
    sessionStorage.removeItem('exp_usuario');
    window.location.href = 'index.html';
  }

  window.SUPABASE_URL = window.SUPABASE_URL || SUPABASE_URL;
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  window.isSocioRole = window.isSocioRole || isSocioRole;
  window.isSocioAdminRole = window.isSocioAdminRole || isSocioAdminRole;
  window.buildExpUsuarioPayload = window.buildExpUsuarioPayload || buildExpUsuarioPayload;
  window.currentSessionUsuario = window.currentSessionUsuario || currentSessionUsuario;
  window.redirectToLogin = window.redirectToLogin || redirectToLogin;
  window.fetchCurrentUsuario = window.fetchCurrentUsuario || fetchCurrentUsuario;
  window.renderShellIdentity = window.renderShellIdentity || renderShellIdentity;
  window.bootstrapAuthenticatedShell = window.bootstrapAuthenticatedShell || bootstrapAuthenticatedShell;
  window.appShellInit = window.appShellInit || appShellInit;
  window.toggleTheme = window.toggleTheme || toggleTheme;
  window.toggleUserMenu = window.toggleUserMenu || toggleUserMenu;
  window.publishSessionReady = window.publishSessionReady || publishSessionReady;
  window.sair = window.sair || sair;
})();
