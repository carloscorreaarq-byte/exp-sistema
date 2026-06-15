// ================================================
// EXP Mobile Core v1.0
// Supabase client, auth, tema, nav, push, utils
// ================================================

const SUPABASE_URL      = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';

// Chave VAPID pública compartilhada com o desktop (app.html) e a Edge Function send-push.
// NÃO trocar sem regerar as inscrições existentes (quebra push de todos).
const VAPID_PUBLIC_KEY = 'BCRHUrgL16XzJCyEPvkujum8zkDiRpoLbpd5NRUmeeC8wRJM9GvMxxiNkoCRUWokj3JJmIl6ucciYUz_y-n7UK0';

// ── Supabase ─────────────────────────────────
let _sb = null;

function initSupabase() {
  if (_sb) return _sb;
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// Alias global para acesso rápido nos módulos
window.getSB = initSupabase;
function buildExpUsuarioPayload(authId, usuario) {
  const nome = (usuario && usuario.nome) || '';
  const appId = usuario && typeof usuario.id !== 'undefined' ? usuario.id : null;
  return {
    id: appId,                 // id do app (usuarios.id) — usado nas queries do hub/horas/push
    auth_id: authId || null,
    app_user_id: appId,
    nome,
    apelido: (usuario && usuario.apelido) || (nome ? nome.split(' ')[0] : ''),
    iniciais: (usuario && usuario.iniciais) || '',
    cor: (usuario && usuario.cor) || '#888',
    role: (usuario && usuario.role) || '',
    viewer_only: !!(usuario && usuario.viewer_only),
    is_platform_manager: !!(usuario && usuario.is_platform_manager),
    can_coordinate_projects: !!(usuario && usuario.can_coordinate_projects),
    termo_status: (usuario && usuario.termo_status) || null,
    termo_assinado_em: (usuario && usuario.termo_assinado_em) || null,
    termo_expira_em: (usuario && usuario.termo_expira_em) || null,
    status_acesso: (usuario && usuario.status_acesso) || null
  };
}

// ── Auth ──────────────────────────────────────
async function getUsuario() {
  const raw = sessionStorage.getItem('exp_usuario');
  if (raw) {
    try {
      const cached = JSON.parse(raw);
      // Backfill para payloads antigos (gravados sem `id`)
      if (cached && cached.id == null && cached.app_user_id != null) cached.id = cached.app_user_id;
      return cached;
    } catch { sessionStorage.removeItem('exp_usuario'); }
  }

  const sb = initSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, iniciais, role, cor, viewer_only')
    .eq('auth_id', session.user.id)
    .maybeSingle();

  if (error || !data) {
    // Sessão existe mas sem perfil — faz logout para quebrar o loop
    await sb.auth.signOut();
    return null;
  }

  const payload = buildExpUsuarioPayload(session.user.id, data);
  sessionStorage.setItem('exp_usuario', JSON.stringify(payload));
  return payload;
}

async function requireAuth(loginPath = './index.html') {
  const u = await getUsuario();
  if (!u) { window.location.href = loginPath; return null; }
  return u;
}

async function signOut() {
  const sb = initSupabase();
  await sb.auth.signOut();
  sessionStorage.removeItem('exp_usuario');
  window.location.href = './index.html';
}

function isSocio(u) {
  return ['socio', 'socio_adm', 'socio_admin'].includes((u?.role || '').toLowerCase());
}

function roleLabel(role) {
  return { socio: 'Sócio', socio_adm: 'Sócio Admin', socio_admin: 'Sócio Admin', coordenador: 'Coordenador', colaborador: 'Colaborador' }[role] ?? role;
}

// ── Tema ──────────────────────────────────────
function initTheme() {
  document.documentElement.setAttribute(
    'data-theme',
    localStorage.getItem('exp-theme') ?? 'dark'
  );
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('exp-theme', next);
  // Atualiza ícone do botão se existir
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = themeIcon(next);
}

function themeIcon(theme) {
  return theme === 'dark'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

// ── Bottom Nav ────────────────────────────────
function buildBottomNav(currentPage, socio = false) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  // v1 — nav enxuta: Início · Horas · Chat · Módulos
  const items = [
    { id: 'app',   href: './app.html',   label: 'Início', icon: icons.grid },
    { id: 'horas', href: './horas.html', label: 'Horas',  icon: icons.clock },
    { id: 'chat',  href: './chat.html',  label: 'Chat',   icon: icons.chat, badge: true },
  ];

  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="nav-item${it.id === currentPage ? ' active' : ''}" data-page="${it.id}">
      ${it.icon}
      <span>${it.label}</span>
      ${it.badge ? `<span class="nav-badge" id="chat-badge" style="display:none"></span>` : ''}
    </a>
  `).join('') + `
    <button class="nav-item" data-page="modulos" onclick="openModulesSheet()">
      ${MOD_ICONS.apps}
      <span>Módulos</span>
    </button>
  `;

  _injectModulesSheet();
  if (currentPage !== 'chat') _loadChatBadge();
}

// ── Menu de Módulos (preset; só os com navegação ficam liberados) ──
// Ícones espelham a plataforma (shared/exp-nav.js).
const MOD_ICONS = {
  apps:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  projetos:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  contatos:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  calendario:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  apoio:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  crm:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  financeiro:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  analise:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  pessoas:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  apontamentos:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  calc:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>`,
  sociedade: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  lock:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
};

const MODULES = [
  { icon: 'projetos',   label: 'Gestão',       desc: 'Projetos, tarefas, horas, custos', href: './gestao.html',   on: true },
  { icon: 'contatos',   label: 'Contatos',     desc: 'Diretório da equipe e clientes',   href: './contatos.html', on: true },
  { icon: 'calendario', label: 'Calendário',   desc: 'Agenda e eventos',                 on: false },
  { icon: 'apoio',      label: 'Apoio',        desc: 'Normas, vegetação, indicações',    on: false },
  { icon: 'crm',        label: 'Comercial',    desc: 'Funil e oportunidades',            on: false },
  { icon: 'financeiro', label: 'Financeiro',   desc: 'Receitas e despesas',              on: false },
  { icon: 'analise',    label: 'Análise',      desc: 'Indicadores e relatórios',         on: false },
  { icon: 'pessoas',    label: 'Pessoas',      desc: 'Clima e gestão de pessoas',        on: false },
  { icon: 'apontamentos',label:'Apontamentos', desc: 'Registros e apontamentos',         on: false },
  { icon: 'calc',       label: 'Calculadora',  desc: 'Simulações de proposta',           on: false },
  { icon: 'sociedade',  label: 'Sociedade',    desc: 'Área societária',                  on: false },
];

function _injectModulesSheet() {
  if (document.getElementById('modulos-sheet')) return;
  if (!document.getElementById('mod-style')) {
    const st = document.createElement('style');
    st.id = 'mod-style';
    st.textContent = `
      .mod-row{display:flex;align-items:center;gap:var(--gap-md);padding:12px var(--gap-md);background:var(--m-surface);border:1px solid color-mix(in srgb,var(--m-border) 22%,transparent);border-radius:var(--m-radius-card);margin-bottom:var(--gap-sm);box-shadow:var(--shadow-card);-webkit-tap-highlight-color:transparent;color:inherit}
      .mod-row.on:active{transform:scale(.98)}
      .mod-row.off{opacity:.55}
      .mod-ico{width:40px;height:40px;border-radius:var(--m-radius-card);display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--verde-soft);color:var(--verde)}
      .mod-row.off .mod-ico{background:color-mix(in srgb,var(--m-border) 18%,transparent);color:var(--m-text-3)}
      .mod-ico svg{width:20px;height:20px;stroke-width:1.8}
      .mod-txt{flex:1;min-width:0}
      .mod-name{font-size:var(--mt-body);font-weight:700}
      .mod-desc{font-size:var(--mt-caption);color:var(--m-text-3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mod-right{flex-shrink:0;color:var(--m-text-3)}
      .mod-right svg{width:16px;height:16px;stroke-width:2.2}
      .mod-soon{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--m-text-3);background:color-mix(in srgb,var(--m-border) 16%,transparent);padding:3px 8px;border-radius:var(--m-radius-pill)}
    `;
    document.head.appendChild(st);
  }
  const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>`;
  const rows = MODULES.map(m => {
    const inner = `
      <div class="mod-ico">${MOD_ICONS[m.icon]}</div>
      <div class="mod-txt"><div class="mod-name">${m.label}</div><div class="mod-desc">${m.desc}</div></div>
      ${m.on ? `<div class="mod-right">${chevron}</div>` : `<div class="mod-soon">Em breve</div>`}
    `;
    return m.on
      ? `<a class="mod-row on" href="${m.href}">${inner}</a>`
      : `<div class="mod-row off">${inner}</div>`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="sheet-overlay" id="modulos-overlay" onclick="closeSheet('modulos')"></div>
    <div class="sheet" id="modulos-sheet" style="max-height:86dvh">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Módulos</div>
      ${rows}
    </div>
  `;
  document.body.appendChild(wrap);
}

function openModulesSheet() { _injectModulesSheet(); openSheet('modulos'); }

async function _loadChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  try {
    const u = await getUsuario();
    if (!u) return;
    const sb = initSupabase();
    const uid = u.auth_id;

    // Canais fixos: 'general' para todos; 'socios' apenas para sócios
    const channels = ['general'];
    if (isSocio(u)) channels.push('socios');

    // Última leitura por canal (chat_read_status usa user_id = auth_id)
    const { data: reads } = await sb
      .from('chat_read_status')
      .select('channel, last_read_at')
      .eq('user_id', uid)
      .in('channel', channels);

    const readMap = {};
    (reads ?? []).forEach(r => { readMap[r.channel] = r.last_read_at; });

    const fallback = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    let total = 0;
    for (const ch of channels) {
      const since = readMap[ch] ?? fallback;
      const { count } = await sb
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel', ch)
        .neq('sender_id', uid)
        .gt('created_at', since);
      total += count ?? 0;
    }

    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.style.display = 'flex';
    }
  } catch { /* silencioso */ }
}

// ── Toast ─────────────────────────────────────
function showToast(msg, type = 'default', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  if (type === 'error') el.style.background = 'var(--critico)';
  if (type === 'success') el.style.borderLeft = '3px solid var(--verde)';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration + 200);
}

// ── Push Notifications ────────────────────────
// Salva a inscrição no banco (mesma tabela/colunas do desktop: conflito composto
// usuario_id,endpoint → suporta vários dispositivos por usuário).
async function _savePushSub(sub) {
  const u = await getUsuario();
  if (!u || !sub) return false;
  const sb = initSupabase();
  const { error } = await sb.from('push_subscriptions').upsert(
    { usuario_id: u.id, endpoint: sub.endpoint, subscription: JSON.stringify(sub), plataforma: 'mobile' },
    { onConflict: 'usuario_id,endpoint' }
  );
  if (error) { console.warn('[EXP Push] save', error); return false; }
  return true;
}

// Garante a inscrição SEM pedir permissão — só age se o usuário já concedeu antes.
// Use no carregamento das páginas para (re)salvar a inscrição do dispositivo.
async function ensurePushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!VAPID_PUBLIC_KEY) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _b64ToUint8(VAPID_PUBLIC_KEY),
      });
    }
    return await _savePushSub(sub);
  } catch (err) {
    console.warn('[EXP Push] ensure', err);
    return false;
  }
}

// Pede permissão explicitamente (chamar a partir de um gesto/botão contextual).
async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (!VAPID_PUBLIC_KEY) return false; // chave não configurada

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _b64ToUint8(VAPID_PUBLIC_KEY),
    });
    return await _savePushSub(sub);
  } catch (err) {
    console.error('[EXP Push]', err);
    return false;
  }
}

function _b64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Notificações + push (espelha gestao.html do desktop) ──────
// Dispara o push para UM destinatário via a Edge Function send-push.
function enviarPush(usuarioId, titulo, corpo, url, tag) {
  if (!usuarioId) return;
  return initSupabase().functions.invoke('send-push', {
    body: {
      usuario_id: usuarioId,
      title: titulo || 'EXP',
      body:  corpo  || '',
      url:   url    || location.href,
      tag:   tag    || 'exp-notif',
    },
  }).catch(e => console.warn('[EXP Push]', e));
}

// Cria a notificação no banco (sininho) E dispara o push. Nunca notifica a si mesmo.
// Mesmo contrato do desktop (gestao.html), para tarefas, menções, lembretes etc.
async function criarNotificacao(usuarioId, tipo, titulo, corpo, link = {}) {
  const u = await getUsuario();
  if (!usuarioId || !u || usuarioId === u.id) return;
  const sb = initSupabase();
  try {
    await sb.from('notificacoes').insert({
      usuario_id:      usuarioId,
      tipo,
      titulo:          titulo || '',
      corpo:           corpo  || null,
      link_tipo:       link.tipo       || null,
      link_produto_id: link.produto_id || null,
      link_etapa_id:   link.etapa_id   || null,
      link_entrada_id: link.entrada_id || null,
      link_revisao_id: link.revisao_id || null,
      modulo:          'mobile',
      criado_por:      u.id,
      criado_por_nome: u.nome,
      created_at:      new Date().toISOString(),
    });
    enviarPush(usuarioId, titulo, corpo);
  } catch (e) { console.warn('[EXP criarNotificacao]', e.message); }
}

// ── Service Worker ────────────────────────────
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.warn('[EXP SW]', err);
  }
}

// ── Formatação ────────────────────────────────
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDateFull(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function relativeDate(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return formatDate(iso);
}

// ── Sheet helpers ─────────────────────────────
function openSheet(id) {
  document.getElementById(id + '-overlay')?.classList.add('open');
  document.getElementById(id + '-sheet')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSheet(id) {
  document.getElementById(id + '-overlay')?.classList.remove('open');
  document.getElementById(id + '-sheet')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Avatar helpers ────────────────────────────
function setAvatar(el, usuario) {
  if (!el) return;
  el.textContent = usuario.iniciais ?? '??';
  el.style.background = usuario.cor ?? 'var(--verde)';
}

// ── Ícones SVG ────────────────────────────────
const icons = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  calc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h.01M8 14h2M12 14h2M16 14h2M8 18h2M12 18h2M16 18h2"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`,
  chevron_right: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevron_left: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  dollar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// ── Timer global de horas (iniciar/parar) ─────
// Componente compartilhado: aparece em todas as páginas (menos onde
// window.EXP_NO_TIMER = true). Estado persiste em localStorage e o
// lançamento é gravado em horas_lancadas ao parar (espelha o timer desktop).
const MTIMER_KEY = 'exp-mtimer';
let _mtmrTick = null;
let _mtmrProdutos = null;

function _mtmrLoad()  { try { return JSON.parse(localStorage.getItem(MTIMER_KEY)) || null; } catch { return null; } }
function _mtmrSave(s) { localStorage.setItem(MTIMER_KEY, JSON.stringify(s)); }
function _mtmrClear() { localStorage.removeItem(MTIMER_KEY); }

function _mtmrFmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// Semana ISO (ano/semana/seg/dom) — mesmo cálculo do timer desktop.
function _mtmrIsoWeek(dateObj) {
  const t = new Date(dateObj); t.setHours(12, 0, 0, 0);
  const isoDia = t.getDay() || 7;
  const ini = new Date(t); ini.setDate(t.getDate() - isoDia + 1);
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
  const thu = new Date(ini); thu.setDate(ini.getDate() + 3);
  const year = thu.getFullYear();
  const jan4 = new Date(year, 0, 4, 12, 0, 0, 0);
  const w1 = new Date(jan4); w1.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
  const week = Math.floor((ini - w1) / (7 * 24 * 3600 * 1000)) + 1;
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { isoDia, year, week, start: fmt(ini), end: fmt(fim) };
}

function mountTimer() {
  if (document.getElementById('mtmr-fab')) return;
  getUsuario().then(u => { if (!u) return; _mtmrInject(); _mtmrRender(); });
}

function _mtmrInject() {
  if (!document.getElementById('mtmr-style')) {
    const st = document.createElement('style');
    st.id = 'mtmr-style';
    st.textContent = `
      .mtmr-fab{position:fixed;right:var(--gap-md);bottom:calc(var(--nav-h) + var(--safe-b) + var(--gap-md));height:52px;min-width:52px;border-radius:26px;background:var(--verde);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;padding:0;box-shadow:0 4px 16px color-mix(in srgb,var(--verde) 35%,transparent);z-index:95;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform var(--m-transition)}
      .mtmr-fab:active{transform:scale(.95)}
      .mtmr-fab svg{width:24px;height:24px;stroke-width:2.2}
      .mtmr-fab-idle{display:flex;align-items:center;justify-content:center}
      .mtmr-fab-run{display:none;align-items:center;gap:8px;padding:0 16px 0 15px}
      .mtmr-fab.running{background:var(--critico);min-width:0}
      .mtmr-fab.running .mtmr-fab-idle{display:none}
      .mtmr-fab.running .mtmr-fab-run{display:flex}
      .mtmr-time{font-family:var(--font-mono);font-weight:700;font-size:15px;letter-spacing:.5px}
      .mtmr-dot{width:9px;height:9px;border-radius:50%;background:#fff;animation:mtmrPulse 1.3s infinite}
      @keyframes mtmrPulse{0%,100%{opacity:1}50%{opacity:.3}}
      .mtmr-row{display:flex;gap:var(--gap-sm)}.mtmr-row>*{flex:1}
    `;
    document.head.appendChild(st);
  }
  const wrap = document.createElement('div');
  wrap.id = 'mtmr-root';
  wrap.innerHTML = `
    <button id="mtmr-fab" class="mtmr-fab" onclick="_mtmrFabClick()" aria-label="Timer de horas">
      <span class="mtmr-fab-idle">${icons.clock}</span>
      <span class="mtmr-fab-run"><span class="mtmr-dot"></span><span class="mtmr-time" id="mtmr-time">00:00:00</span></span>
    </button>

    <div class="sheet-overlay" id="mtmr-start-overlay" onclick="closeSheet('mtmr-start')"></div>
    <div class="sheet" id="mtmr-start-sheet" style="max-height:88dvh">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Iniciar timer</div>

      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-input" id="mtmr-tipo" onchange="_mtmrOnTipo()">
          <option value="projeto">Projeto</option>
          <option value="organizacao">Organização Interna</option>
        </select>
      </div>

      <!-- Categoria (organização / sociedade) -->
      <div class="form-group" id="mtmr-sub-wrap" style="display:none;margin-top:var(--gap-md)">
        <label class="form-label">Categoria</label>
        <select class="form-input" id="mtmr-sub"></select>
      </div>

      <!-- Cascata de projeto: Cliente → Oportunidade → Produto → Etapa -->
      <div id="mtmr-proj-wrap">
        <div class="form-group" style="margin-top:var(--gap-md)">
          <label class="form-label">Cliente</label>
          <select class="form-input" id="mtmr-cli" onchange="_mtmrChangeCli()"><option value="">Selecionar cliente…</option></select>
        </div>
        <div class="form-group" id="mtmr-opp-wrap" style="display:none;margin-top:var(--gap-md)">
          <label class="form-label">Projeto / oportunidade</label>
          <select class="form-input" id="mtmr-opp" onchange="_mtmrChangeOpp()"><option value="">Selecionar…</option></select>
        </div>
        <div class="form-group" id="mtmr-prod-wrap" style="display:none;margin-top:var(--gap-md)">
          <label class="form-label">Produto</label>
          <select class="form-input" id="mtmr-prod" onchange="_mtmrChangeProd()"><option value="">Selecionar…</option></select>
        </div>
        <div class="form-group" id="mtmr-etapa-wrap" style="display:none;margin-top:var(--gap-md)">
          <label class="form-label">Etapa</label>
          <select class="form-input" id="mtmr-etapa"><option value="">Selecionar…</option></select>
        </div>
      </div>

      <div style="margin-top:var(--gap-lg);display:flex;gap:var(--gap-sm)">
        <button class="btn btn-secondary" onclick="closeSheet('mtmr-start')">Cancelar</button>
        <button class="btn btn-primary" style="flex:1" onclick="startTimer()">Iniciar</button>
      </div>
    </div>

    <div class="sheet-overlay" id="mtmr-stop-overlay" onclick="closeSheet('mtmr-stop')"></div>
    <div class="sheet" id="mtmr-stop-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Parar timer</div>
      <div id="mtmr-stop-label" style="font-size:var(--mt-caption);color:var(--m-text-2);margin-bottom:var(--gap-md)"></div>
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-input" id="mtmr-data">
      </div>
      <div class="mtmr-row" style="margin-top:var(--gap-md)">
        <div class="form-group"><label class="form-label">Início</label><input type="time" class="form-input" id="mtmr-ini"></div>
        <div class="form-group"><label class="form-label">Fim</label><input type="time" class="form-input" id="mtmr-fim"></div>
      </div>
      <div class="form-group" style="margin-top:var(--gap-md)">
        <label class="form-label">Descrição</label>
        <input type="text" class="form-input" id="mtmr-stop-desc" placeholder="O que foi feito…">
      </div>
      <div style="margin-top:var(--gap-lg);display:flex;gap:var(--gap-sm)">
        <button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="discardTimer()">Descartar</button>
        <button class="btn btn-secondary" onclick="closeSheet('mtmr-stop')">Continuar</button>
        <button class="btn btn-primary" style="flex:1" onclick="saveTimerEntry()">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

function _mtmrFabClick() {
  const s = _mtmrLoad();
  if (s && s.startedAt) openTimerStop(); else openTimerStart();
}

function _mtmrRender() {
  const fab = document.getElementById('mtmr-fab');
  if (!fab) return;
  const s = _mtmrLoad();
  if (s && s.startedAt) { fab.classList.add('running'); _mtmrUpdateTime(); _mtmrStartTick(); }
  else { fab.classList.remove('running'); _mtmrStopTick(); }
}
function _mtmrUpdateTime() {
  const s = _mtmrLoad(); if (!s) return;
  const el = document.getElementById('mtmr-time');
  if (el) el.textContent = _mtmrFmt(Date.now() - s.startedAt);
}
function _mtmrStartTick() { if (!_mtmrTick) _mtmrTick = setInterval(_mtmrUpdateTime, 1000); }
function _mtmrStopTick()  { if (_mtmrTick) { clearInterval(_mtmrTick); _mtmrTick = null; } }

// Subtipos espelham o gestao.html/timer.js
const MTIMER_SUBTIPOS = {
  organizacao: ['Capacitação', 'Reunião Semanal', 'Feedback', 'Reunião Interna'],
  sociedade:   ['Marketing', 'Prospecção', 'Administrativo', 'Jurídico', 'Reunião Societária', 'Consultoria', 'RH e Pessoas', 'Gestão', 'Outros'],
};

// Produtos com a cadeia oportunidade → cliente (igual ao timer desktop)
async function _mtmrLoadProdutos() {
  if (_mtmrProdutos) return _mtmrProdutos;
  const { data } = await initSupabase().from('produtos')
    .select('id, nome, subtipo, oportunidade_id, oportunidades(id, projeto, cidade, uf, clientes(id, nome, cidade, uf))')
    .eq('status', 'ativo').order('nome');
  _mtmrProdutos = data ?? [];
  return _mtmrProdutos;
}
function _mtmrClientes(prods) {
  const map = {};
  prods.forEach(p => {
    const c = (p.oportunidades && p.oportunidades.clientes) || {};
    if (c.id && !map[c.id]) { let l = c.nome || '(sem nome)'; if (c.cidade) l += ' · ' + c.cidade; map[c.id] = { id: c.id, label: l }; }
  });
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label, 'pt'));
}
function _mtmrOpps(prods, cliId) {
  const map = {};
  prods.forEach(p => {
    const o = p.oportunidades || {}, c = o.clientes || {};
    if (String(c.id) === String(cliId) && o.id && !map[o.id]) {
      let l = o.projeto || '(sem nome)'; if (o.cidade) l += ' · ' + o.cidade + (o.uf ? '/' + o.uf : '');
      map[o.id] = { id: o.id, label: l };
    }
  });
  return Object.values(map);
}
function _mtmrProdsByOpp(prods, oppId) {
  return prods.filter(p => String(p.oportunidade_id) === String(oppId))
    .map(p => ({ id: p.id, label: p.nome || p.subtipo || '(sem nome)' }));
}

async function openTimerStart() {
  const u = await getUsuario();
  const tipoSel = document.getElementById('mtmr-tipo');
  if (isSocio(u) && !tipoSel.querySelector('option[value="sociedade"]')) {
    const o = document.createElement('option'); o.value = 'sociedade'; o.textContent = 'Sociedade'; tipoSel.appendChild(o);
  }
  tipoSel.value = 'projeto';
  _mtmrOnTipo();

  const prods = await _mtmrLoadProdutos();
  const selCli = document.getElementById('mtmr-cli');
  selCli.innerHTML = '<option value="">Selecionar cliente…</option>';
  _mtmrClientes(prods).forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.label; selCli.appendChild(o); });
  ['mtmr-opp-wrap', 'mtmr-prod-wrap', 'mtmr-etapa-wrap'].forEach(id => document.getElementById(id).style.display = 'none');
  openSheet('mtmr-start');
}

function _mtmrOnTipo() {
  const t = document.getElementById('mtmr-tipo').value;
  const isProj = t === 'projeto';
  document.getElementById('mtmr-proj-wrap').style.display = isProj ? '' : 'none';
  const subWrap = document.getElementById('mtmr-sub-wrap');
  if (isProj) { subWrap.style.display = 'none'; }
  else {
    document.getElementById('mtmr-sub').innerHTML = (MTIMER_SUBTIPOS[t] || []).map(s => `<option value="${s}">${s}</option>`).join('');
    subWrap.style.display = '';
  }
}

async function _mtmrChangeCli() {
  const cliId = document.getElementById('mtmr-cli').value;
  const oppWrap = document.getElementById('mtmr-opp-wrap'), oppSel = document.getElementById('mtmr-opp');
  document.getElementById('mtmr-prod-wrap').style.display = 'none';
  document.getElementById('mtmr-etapa-wrap').style.display = 'none';
  if (!cliId) { oppWrap.style.display = 'none'; return; }
  const prods = await _mtmrLoadProdutos();
  oppSel.innerHTML = '<option value="">Selecionar…</option>';
  _mtmrOpps(prods, cliId).forEach(o => { const op = document.createElement('option'); op.value = o.id; op.textContent = o.label; oppSel.appendChild(op); });
  oppWrap.style.display = '';
}

async function _mtmrChangeOpp() {
  const oppId = document.getElementById('mtmr-opp').value;
  const prodWrap = document.getElementById('mtmr-prod-wrap'), prodSel = document.getElementById('mtmr-prod');
  document.getElementById('mtmr-etapa-wrap').style.display = 'none';
  if (!oppId) { prodWrap.style.display = 'none'; return; }
  const prods = await _mtmrLoadProdutos();
  prodSel.innerHTML = '<option value="">Selecionar…</option>';
  _mtmrProdsByOpp(prods, oppId).forEach(p => { const op = document.createElement('option'); op.value = p.id; op.textContent = p.label; prodSel.appendChild(op); });
  prodWrap.style.display = '';
}

async function _mtmrChangeProd() {
  const prodId = document.getElementById('mtmr-prod').value;
  const etWrap = document.getElementById('mtmr-etapa-wrap'), etSel = document.getElementById('mtmr-etapa');
  if (!prodId) { etWrap.style.display = 'none'; return; }
  const { data } = await initSupabase().from('etapas').select('id,nome,ordem').eq('produto_id', prodId).order('ordem');
  etSel.innerHTML = '<option value="">Selecionar…</option>';
  (data ?? []).forEach(e => { const op = document.createElement('option'); op.value = e.id; op.textContent = e.nome; etSel.appendChild(op); });
  etWrap.style.display = '';
}

function startTimer() {
  const tipo = document.getElementById('mtmr-tipo').value;
  if (tipo === 'projeto') {
    const prod = document.getElementById('mtmr-prod'), etapa = document.getElementById('mtmr-etapa');
    if (!prod.value)  { showToast('Selecione o produto', 'error'); return; }
    if (!etapa.value) { showToast('Selecione a etapa', 'error'); return; }
    _mtmrSave({
      startedAt: Date.now(), tipo: 'projeto', subtipo: null,
      produtoId: prod.value, produtoNome: prod.options[prod.selectedIndex]?.text || '',
      etapaId: etapa.value, etapaNome: etapa.options[etapa.selectedIndex]?.text || '',
    });
  } else {
    _mtmrSave({
      startedAt: Date.now(), tipo, subtipo: document.getElementById('mtmr-sub').value || null,
      produtoId: null, produtoNome: null, etapaId: null, etapaNome: null,
    });
  }
  closeSheet('mtmr-start');
  _mtmrRender();
  showToast('Timer iniciado', 'success');
}

function openTimerStop() {
  const s = _mtmrLoad(); if (!s) return;
  const start = new Date(s.startedAt), now = new Date();
  const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const iso  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  document.getElementById('mtmr-stop-label').textContent = s.tipo === 'projeto'
    ? `${s.produtoNome || 'Projeto'}${s.etapaNome ? ' · ' + s.etapaNome : ''}`
    : ((s.tipo === 'organizacao' ? 'Organização Interna' : 'Sociedade') + (s.subtipo ? ' · ' + s.subtipo : ''));
  document.getElementById('mtmr-data').value = iso(now);
  document.getElementById('mtmr-ini').value  = hhmm(start);
  document.getElementById('mtmr-fim').value  = hhmm(now);
  document.getElementById('mtmr-stop-desc').value = '';
  openSheet('mtmr-stop');
}

async function saveTimerEntry() {
  const s = _mtmrLoad(); if (!s) return;
  const u = await getUsuario(); if (!u) return;
  const dataISO = document.getElementById('mtmr-data').value;
  const ini = document.getElementById('mtmr-ini').value;
  const fim = document.getElementById('mtmr-fim').value;
  const desc = document.getElementById('mtmr-stop-desc').value.trim();
  if (!dataISO || !ini || !fim) { showToast('Preencha data, início e fim', 'error'); return; }
  if (fim <= ini) { showToast('Fim deve ser após o início', 'error'); return; }

  const sb = initSupabase();
  const wk = _mtmrIsoWeek(new Date(dataISO + 'T12:00:00'));

  let { data: sem } = await sb.from('semanas').select('id, finalizada')
    .eq('usuario_id', u.id).eq('data_inicio', wk.start).maybeSingle();
  if (sem && sem.finalizada) { showToast('Semana finalizada — bloqueada', 'error'); return; }
  if (!sem) {
    const r = await sb.from('semanas').upsert(
      { usuario_id: u.id, ano: wk.year, semana: wk.week, data_inicio: wk.start, data_fim: wk.end, finalizada: false },
      { onConflict: 'usuario_id,ano,semana' }
    ).select('id').single();
    if (r.error) { showToast('Erro na semana', 'error'); return; }
    sem = r.data;
  }

  const d = new Date(dataISO + 'T12:00:00');
  const { error } = await sb.from('horas_lancadas').insert({
    usuario_id:      u.id,
    semana_id:       sem.id,
    data_lancamento: dataISO,
    dia_semana:      d.getDay() === 0 ? 7 : d.getDay(),
    hora_inicio:     ini,
    hora_fim:        fim,
    tipo:            s.tipo,
    subtipo:         s.subtipo || null,
    produto_id:      s.tipo === 'projeto' ? s.produtoId : null,
    etapa_id:        s.tipo === 'projeto' ? s.etapaId : null,
    descricao:       desc || null,
  });
  if (error) { showToast('Erro ao salvar', 'error'); return; }

  _mtmrClear();
  closeSheet('mtmr-stop');
  _mtmrRender();
  showToast('Horas lançadas ✓', 'success');
  if (typeof window.loadSemana === 'function') { try { window.loadSemana(); } catch (_) {} }
}

function discardTimer() {
  _mtmrClear();
  closeSheet('mtmr-stop');
  _mtmrRender();
  showToast('Timer descartado');
}

// ── Init automático ───────────────────────────
initTheme();
registerSW();
document.addEventListener('DOMContentLoaded', () => { if (!window.EXP_NO_TIMER) mountTimer(); });
