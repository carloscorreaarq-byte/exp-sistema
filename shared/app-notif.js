// ══════════════════════════════════════════════════════════════
// EXP Platform — Sininho global unificado  (shared/app-notif.js)
// ══════════════════════════════════════════════════════════════
//
// USO EM CADA MÓDULO:
//   1. Inclua este script após app-shell.js
//   2. No DOMContentLoaded (ou após auth):
//        AppNotif.init();
//
// COMPUTED ALERTS (módulos sem tabela de notificações):
//   AppNotif.setComputedSection('comercial', {
//     label: 'Comercial',
//     items: [
//       { key: 'fu_abc', icon: '⏰', titulo: 'Sem follow-up 30d',
//         corpo: 'Cliente XYZ', onClick: fn, onDismiss: fn }
//     ]
//   });
//
// PARA MÓDULOS QUE INSEREM NA TABELA:
//   Sempre passe modulo: 'gestao' | 'sociedade' | 'comercial' | 'financeiro'
//   no insert do Supabase. O bell agrupa automaticamente.
//
// ══════════════════════════════════════════════════════════════

window.AppNotif = (() => {
  /* ── estado interno ──────────────────────────────────────── */
  let _notifs     = [];   // rows da tabela notificacoes
  let _tarefas    = [];   // tarefas livres ativas (gestao alimenta via setComputedSection)
  let _computed   = {};   // { [key]: { label, items[] } }
  let _sub        = null; // canal realtime
  let _userId     = null;
  let _panelOpen  = false;

  /* ── labels dos módulos ──────────────────────────────────── */
  const MODULE_LABELS = {
    gestao:     'Gestão',
    sociedade:  'Societário',
    comercial:  'Comercial',
    financeiro: 'Financeiro',
  };

  /* ── esc helper ──────────────────────────────────────────── */
  function _esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── formata data relativa ───────────────────────────────── */
  function _rel(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2)  return 'agora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 7)  return `${d}d`;
    return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  }

  /* ── badge ───────────────────────────────────────────────── */
  function _badgeTotal() {
    const unread   = _notifs.filter(n => !n.lido_em).length;
    const computed = Object.values(_computed)
      .reduce((acc, s) => acc + (s.items?.length ?? 0), 0);
    return unread + computed;
  }

  function _renderBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const total = _badgeTotal();
    badge.textContent  = total > 9 ? '9+' : total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }

  /* ── section header helper ───────────────────────────────── */
  function _secHd(label) {
    return `<div class="notif-sec-hd">${_esc(label)}</div>`;
  }

  /* ── renderiza um item da tabela notificacoes ────────────── */
  const TYPE_ICONS = {
    mencao:'@', tarefa:'✔', revisao_solicitada:'📋', revisao:'📋',
    prancha:'🖼', lembrete:'📢', fin_vencimento:'💰', fin_aprovacao:'✅',
  };

  function _itemHtml(n) {
    const nova  = !n.lido_em;
    const icon  = TYPE_ICONS[n.tipo] || '🔔';
    const ts    = _rel(n.created_at);
    const autor = n.criado_por_nome ? ` · ${_esc(n.criado_por_nome)}` : '';
    return `<div class="notif-item${nova ? ' nova' : ''}"
              onclick="AppNotif._abrirNotif('${_esc(n.id)}')"
              role="button" tabindex="0">
      <div class="notif-item-row">
        <span class="notif-icon">${icon}</span>
        <span class="notif-titulo">${_esc(n.titulo)}</span>
        <button class="notif-check-btn" title="Encerrar"
          onclick="event.stopPropagation();AppNotif._encerrarNotif('${_esc(n.id)}')">✓</button>
      </div>
      ${n.corpo ? `<div class="notif-corpo">${_esc(n.corpo)}</div>` : ''}
      <div class="notif-ts">${ts}${autor}</div>
    </div>`;
  }

  /* ── renderiza um item computed (CRM alertas, tarefas, etc.) */
  function _computedItemHtml(it, sectionKey) {
    const hasDismiss = typeof it.onDismiss === 'function';
    return `<div class="notif-item" onclick="AppNotif._computedClick('${sectionKey}','${_esc(it.key)}')"
              role="button" tabindex="0">
      <div class="notif-item-row">
        <span class="notif-icon">${it.icon || '⚡'}</span>
        <span class="notif-titulo">${_esc(it.titulo)}</span>
        ${hasDismiss
          ? `<button class="notif-check-btn" title="Dispensar"
               onclick="event.stopPropagation();AppNotif._dismissComputed('${sectionKey}','${_esc(it.key)}')">×</button>`
          : it.onAction
            ? `<button class="notif-check-btn" title="${_esc(it.onAction.label)}"
                 onclick="event.stopPropagation();AppNotif._actionComputed('${sectionKey}','${_esc(it.key)}')">${_esc(it.onAction.label)}</button>`
            : ''}
      </div>
      ${it.corpo ? `<div class="notif-corpo">${_esc(it.corpo)}</div>` : ''}
      ${it.ts    ? `<div class="notif-ts">${_rel(it.ts)}</div>` : ''}
    </div>`;
  }

  /* ── renderiza o painel completo ─────────────────────────── */
  function _renderPanel() {
    const lista = document.getElementById('notif-lista');
    if (!lista) return;

    const unread  = _notifs.filter(n => !n.lido_em);
    const lidas   = _notifs.filter(n =>  n.lido_em);

    // Agrupa as lidas por módulo
    const byModule = {};
    lidas.forEach(n => {
      const key = n.modulo || 'gestao';
      (byModule[key] = byModule[key] || []).push(n);
    });

    // Verifica se tem alguma coisa pra mostrar
    const hasComputed = Object.values(_computed).some(s => s.items?.length > 0);
    const empty = !unread.length && !lidas.length && !hasComputed;

    if (empty) {
      lista.innerHTML = `<div style="padding:20px;text-align:center;color:#bbb;font-size:11px">
        Nenhuma notificação pendente 🎉</div>`;
      return;
    }

    let html = '';

    // ── Seção 1: Não lidas ────────────────────────────────────
    if (unread.length) {
      html += _secHd(`Não lidas (${unread.length})`);
      html += unread.map(_itemHtml).join('');
    }

    // ── Seção 2+: Lidas, agrupadas por módulo ────────────────
    Object.entries(byModule).forEach(([moduleKey, items]) => {
      const label = MODULE_LABELS[moduleKey] || moduleKey;
      html += _secHd(label);
      html += items.map(_itemHtml).join('');
    });

    // ── Seções computed (CRM alertas, tarefas, etc.) ─────────
    Object.entries(_computed).forEach(([key, section]) => {
      if (!section.items?.length) return;
      html += _secHd(section.label || key);
      html += section.items.map(it => _computedItemHtml(it, key)).join('');
    });

    lista.innerHTML = html;
  }

  /* ── handlers chamados pelo HTML (via onclick string) ───────── */
  async function _abrirNotif(id) {
    const n = _notifs.find(x => x.id === id);
    if (!n) return;
    if (!n.lido_em) {
      n.lido_em = new Date().toISOString();
      window.sb?.from('notificacoes').update({ lido_em: n.lido_em }).eq('id', id);
      _renderBadge();
      _renderPanel();
    }
    // Fecha o painel
    close();
    // Dispara evento para o módulo tratar navegação específica
    window.dispatchEvent(new CustomEvent('exp:notif-open', { detail: n }));
  }

  async function _encerrarNotif(id) {
    await window.sb?.from('notificacoes')
      .update({ encerrado_em: new Date().toISOString() }).eq('id', id);
    _notifs = _notifs.filter(n => n.id !== id);
    _renderBadge();
    _renderPanel();
  }

  function _computedClick(sectionKey, itemKey) {
    const section = _computed[sectionKey];
    const item    = section?.items?.find(it => it.key === itemKey);
    if (item?.onClick) item.onClick();
    close();
  }

  function _dismissComputed(sectionKey, itemKey) {
    const section = _computed[sectionKey];
    const item    = section?.items?.find(it => it.key === itemKey);
    if (item?.onDismiss) item.onDismiss();
    // onDismiss deve chamar setComputedSection novamente com a lista atualizada
  }

  function _actionComputed(sectionKey, itemKey) {
    const section = _computed[sectionKey];
    const item    = section?.items?.find(it => it.key === itemKey);
    if (item?.onAction?.fn) item.onAction.fn();
  }

  /* ── fecha painel ao clicar fora ─────────────────────────── */
  function _bindOutsideClick() {
    document.addEventListener('click', e => {
      if (!_panelOpen) return;
      const wrap = document.getElementById('notif-wrap');
      if (wrap && !wrap.contains(e.target)) close();
    }, { capture: true });
  }

  /* ── toggle ──────────────────────────────────────────────── */
  function togglePanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    _panelOpen = !_panelOpen;
    panel.style.display = _panelOpen ? 'block' : 'none';
    if (_panelOpen) _renderPanel();
  }

  function close() {
    _panelOpen = false;
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
  }

  /* ── encerra todas ───────────────────────────────────────── */
  async function encerrarTodas() {
    if (!_userId) return;
    await window.sb?.from('notificacoes')
      .update({ encerrado_em: new Date().toISOString() })
      .eq('usuario_id', _userId)
      .is('encerrado_em', null);
    _notifs = [];
    _renderBadge();
    _renderPanel();
  }

  /* ── fetch inicial ───────────────────────────────────────── */
  async function _fetch(userId) {
    const { data } = await window.sb
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', userId)
      .is('encerrado_em', null)
      .order('created_at', { ascending: false })
      .limit(50);
    _notifs = data || [];
    _renderBadge();
    if (_panelOpen) _renderPanel();
  }

  /* ── realtime subscribe ──────────────────────────────────── */
  function _subscribe(userId) {
    try {
      _sub = window.sb
        .channel('exp-notif-global')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`
        }, payload => {
          _notifs.unshift(payload.new);
          if (_notifs.length > 50) _notifs = _notifs.slice(0, 50);
          _renderBadge();
          if (_panelOpen) _renderPanel();
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`
        }, payload => {
          const idx = _notifs.findIndex(n => n.id === payload.new.id);
          if (payload.new.encerrado_em) {
            if (idx >= 0) _notifs.splice(idx, 1);
          } else if (idx >= 0) {
            _notifs[idx] = payload.new;
          }
          _renderBadge();
          if (_panelOpen) _renderPanel();
        })
        .subscribe();
    } catch { /* realtime opcional */ }
  }

  /* ── API pública: setComputedSection ─────────────────────── */
  // Cada módulo chama isso para registrar alertas computados (sem persistência)
  // Exemplo: AppNotif.setComputedSection('comercial', { label: 'Comercial', items: [...] })
  function setComputedSection(key, { label, items = [] } = {}) {
    _computed[key] = { label: label || MODULE_LABELS[key] || key, items };
    _renderBadge();
    if (_panelOpen) _renderPanel();
  }

  /* ── API pública: init ───────────────────────────────────── */
  // userId opcional: passa diretamente quando o módulo já tem o user autenticado
  // (páginas sem app-shell.js, ex: gestao.html, sociedade.html)
  async function init({ userId } = {}) {
    async function _boot(uid) {
      _userId = uid;
      if (!_userId || !window.sb) return;
      await _fetch(_userId);
      _subscribe(_userId);
    }

    if (userId) {
      await _boot(userId);
    } else {
      // Tenta sessionStorage (app-shell.js salva como app_user_id)
      const cached = (() => {
        try { return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); } catch { return null; }
      })();
      const uid = cached?.app_user_id || cached?.id;
      if (uid) {
        await _boot(uid);
      } else {
        // Aguarda evento do app-shell.js
        window.addEventListener('exp:session-ready', e => {
          const u = e.detail;
          _boot(u?.app_user_id || u?.id);
        }, { once: true });
      }
    }

    // Bind fora-do-panel click
    _bindOutsideClick();

    // Expõe handlers no window (onclick inline nos HTMLs)
    window._appNotifToggle       = togglePanel;
    window._appNotifEncerrarTodas = encerrarTodas;
  }

  /* ── expõe handlers internos necessários pelos onclick ───── */
  return {
    init,
    setComputedSection,
    close,
    // internos (chamados pelos onclick inline gerados pelo render)
    _abrirNotif,
    _encerrarNotif,
    _computedClick,
    _dismissComputed,
    _actionComputed,
  };
})();
