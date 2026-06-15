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
  return {
    auth_id: authId || null,
    app_user_id: usuario && typeof usuario.id !== 'undefined' ? usuario.id : null,
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
    try { return JSON.parse(raw); } catch { sessionStorage.removeItem('exp_usuario'); }
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

  const items = [
    { id: 'app',      href: './app.html',      label: 'Início',   icon: icons.grid },
    { id: 'gestao',   href: './gestao.html',    label: 'Gestão',   icon: icons.clipboard },
    { id: 'contatos', href: './contatos.html',  label: 'Contatos', icon: icons.person },
    { id: 'chat',     href: './chat.html',      label: 'Chat',     icon: icons.chat, badge: true },
    ...(socio ? [{ id: 'calc', href: './calc.html', label: 'Calc', icon: icons.calc }] : []),
  ];

  nav.innerHTML = items.map(it => `
    <a href="${it.href}" class="nav-item${it.id === currentPage ? ' active' : ''}" data-page="${it.id}">
      ${it.icon}
      <span>${it.label}</span>
      ${it.badge ? `<span class="nav-badge" id="chat-badge" style="display:none"></span>` : ''}
    </a>
  `).join('');

  if (currentPage !== 'chat') _loadChatBadge();
}

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

// ── Init automático ───────────────────────────
initTheme();
registerSW();
