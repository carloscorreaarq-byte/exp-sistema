// ══════════════════════════════════════════════════════════════
// EXP Platform — Sininho global unificado  (shared/app-notif.js)
// ══════════════════════════════════════════════════════════════
//
// USO EM CADA MÓDULO:
//   1. Inclua este script após o CDN do Supabase
//   2. No DOMContentLoaded (após auth):
//        AppNotif.init({ userId: G.usuario.id });
//
// O bell carrega automaticamente:
//   - Notificações da tabela `notificacoes` (todos os módulos)
//   - Tarefas ativas do usuário (tarefas_livres)
//   - Alertas CRM (oportunidades sem follow-up / propostas expiradas)
//
// Módulos com dados locais mais ricos podem sobrescrever:
//   AppNotif.setComputedSection('tarefas', { label, items })
//   AppNotif.setComputedSection('comercial', { label, items })
//
// Após mutações chamar:
//   AppNotif.refreshTarefas()    — gestao.html ao concluir tarefa
//   AppNotif.refreshCrmAlerts()  — crm.html ao dispensar alerta
//
// ══════════════════════════════════════════════════════════════

window.AppNotif = (() => {
  /* ── estado interno ──────────────────────────────────────── */
  let _notifs    = [];   // rows da tabela notificacoes
  let _computed  = {};   // { [key]: { label, items[] } }
  let _sub       = null;
  let _userId    = null;
  let _panelOpen = false;

  const _DISMISSED_KEY = 'exp_alertas_ok'; // compartilhado com crm.html

  /* ── labels dos módulos ──────────────────────────────────── */
  const MODULE_LABELS = {
    gestao:     'Gestão',
    sociedade:  'Societário',
    comercial:  'Comercial',
    financeiro: 'Financeiro',
  };

  /* ── helpers ─────────────────────────────────────────────── */
  function _esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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

  function _fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${String(y).slice(2)}`;
  }

  function _diasDesde(d) {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }

  function _getDismissed() {
    try { return new Set(JSON.parse(localStorage.getItem(_DISMISSED_KEY) || '[]')); }
    catch { return new Set(); }
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
    badge.textContent   = total > 9 ? '9+' : total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }

  /* ── render helpers ──────────────────────────────────────── */
  function _secHd(label) {
    return `<div class="notif-sec-hd">${_esc(label)}</div>`;
  }

  const TYPE_ICONS = {
    mencao:'@', tarefa:'✔', revisao_solicitada:'📋', revisao:'📋',
    checklist_atribuido:'☑', prancha:'🖼', lembrete:'📢',
    fin_vencimento:'💰', fin_aprovacao:'✅',
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

  function _computedItemHtml(it, sectionKey) {
    const hasDismiss = typeof it.onDismiss === 'function';
    const hasAction  = it.onAction && typeof it.onAction.fn === 'function';
    return `<div class="notif-item" onclick="AppNotif._computedClick('${sectionKey}','${_esc(it.key)}')"
              role="button" tabindex="0">
      <div class="notif-item-row">
        <span class="notif-icon">${it.icon || '⚡'}</span>
        <span class="notif-titulo">${it.titulo}</span>
        ${hasDismiss
          ? `<button class="notif-check-btn" title="Dispensar"
               onclick="event.stopPropagation();AppNotif._dismissComputed('${sectionKey}','${_esc(it.key)}')">×</button>`
          : hasAction
            ? `<button class="notif-check-btn" title="${_esc(it.onAction.label)}"
                 onclick="event.stopPropagation();AppNotif._actionComputed('${sectionKey}','${_esc(it.key)}')">${_esc(it.onAction.label)}</button>`
            : ''}
      </div>
      ${it.corpo ? `<div class="notif-corpo">${_esc(it.corpo)}</div>` : ''}
      ${it.ts    ? `<div class="notif-ts">${_rel(it.ts)}</div>` : ''}
    </div>`;
  }

  /* ── renderiza o painel ──────────────────────────────────── */
  function _renderPanel() {
    const lista = document.getElementById('notif-lista');
    if (!lista) return;

    const unread = _notifs.filter(n => !n.lido_em);
    const lidas  = _notifs.filter(n =>  n.lido_em);

    const byModule = {};
    lidas.forEach(n => {
      const key = n.modulo || 'gestao';
      (byModule[key] = byModule[key] || []).push(n);
    });

    const hasComputed = Object.values(_computed).some(s => s.items?.length > 0);
    const empty = !unread.length && !lidas.length && !hasComputed;

    if (empty) {
      lista.innerHTML = `<div style="padding:20px;text-align:center;color:#bbb;font-size:11px">
        Nenhuma notificação pendente 🎉</div>`;
      return;
    }

    let html = '';

    // 1. Não lidas (todas, de qualquer módulo)
    if (unread.length) {
      html += _secHd(`Não lidas (${unread.length})`);
      html += unread.map(_itemHtml).join('');
    }

    // 2. Lidas agrupadas por módulo
    Object.entries(byModule).forEach(([moduleKey, items]) => {
      html += _secHd(MODULE_LABELS[moduleKey] || moduleKey);
      html += items.map(_itemHtml).join('');
    });

    // 3. Seções computadas (tarefas, comercial, etc.)
    Object.entries(_computed).forEach(([key, section]) => {
      if (!section.items?.length) return;
      html += _secHd(section.label || MODULE_LABELS[key] || key);
      html += section.items.map(it => _computedItemHtml(it, key)).join('');
    });

    lista.innerHTML = html;
  }

  /* ── handlers (chamados pelos onclick inline) ────────────── */
  async function _abrirNotif(id) {
    const n = _notifs.find(x => x.id === id);
    if (!n) return;
    if (!n.lido_em) {
      n.lido_em = new Date().toISOString();
      window.sb?.from('notificacoes').update({ lido_em: n.lido_em }).eq('id', id);
      _renderBadge();
      _renderPanel();
    }
    close();
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
    const item = _computed[sectionKey]?.items?.find(it => it.key === itemKey);
    if (item?.onClick) item.onClick();
    close();
  }

  function _dismissComputed(sectionKey, itemKey) {
    const item = _computed[sectionKey]?.items?.find(it => it.key === itemKey);
    if (item?.onDismiss) item.onDismiss();
    // onDismiss atualiza localStorage + chama _dismissCrmAlert interno
  }

  function _actionComputed(sectionKey, itemKey) {
    const item = _computed[sectionKey]?.items?.find(it => it.key === itemKey);
    if (item?.onAction?.fn) item.onAction.fn();
  }

  /* ── dismiss de alerta CRM (global, sem depender do crm.html) */
  function _dismissCrmAlert(key) {
    const dismissed = _getDismissed();
    dismissed.add(key);
    localStorage.setItem(_DISMISSED_KEY, JSON.stringify([...dismissed]));
    if (_computed['comercial']) {
      _computed['comercial'].items = _computed['comercial'].items.filter(it => it.key !== key);
      _renderBadge();
      if (_panelOpen) _renderPanel();
    }
  }

  /* ── outside click ───────────────────────────────────────── */
  function _getPanel() {
    return document.getElementById('notif-panel') ||
           document.getElementById('exp-notif-panel');
  }

  function _bindOutsideClick() {
    document.addEventListener('click', e => {
      if (!_panelOpen) return;
      const wrap  = document.getElementById('notif-wrap');
      const panel = _getPanel();
      const bell  = document.getElementById('notif-bell-btn') ||
                    document.getElementById('fp-nav-bell')    ||
                    document.getElementById('exp-nav-bell');
      const inside = (wrap  && wrap.contains(e.target))  ||
                     (panel && panel.contains(e.target))  ||
                     (bell  && bell.contains(e.target));
      if (!inside) close();
    }, { capture: true });
  }

  /* ── toggle / close ──────────────────────────────────────── */
  function togglePanel() {
    _panelOpen = !_panelOpen;
    /* só controla display quando o painel local (#notif-panel) existe;
       para #exp-notif-panel o ExpNav gerencia o display */
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = _panelOpen ? 'block' : 'none';
    if (_panelOpen) _renderPanel();
  }

  function close() {
    _panelOpen = false;
    const panel = _getPanel();
    if (panel) panel.style.display = 'none';
  }

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

  /* ══════════════════════════════════════════════════════════
     COMPUTED SECTIONS — fetch global
  ══════════════════════════════════════════════════════════ */

  /* ── alertas CRM ─────────────────────────────────────────── */
  async function _fetchCrmAlerts() {
    const [opsRes, fusRes, prodsRes] = await Promise.all([
      window.sb.from('oportunidades')
        .select('id, num_legado, pipeline_stage, clientes(nome)')
        .in('pipeline_stage', ['prospecção','prospeccao','enviada','ativo','negociacao','negociação']),
      window.sb.from('followups_produto')
        .select('produto_id, data_contato, created_at')
        .order('data_contato', { ascending: false }),
      window.sb.from('produtos')
        .select('id, oportunidade_id, status, data_envio')
        .in('status', ['ativo','negociacao','negociação']),
    ]);

    const ops   = opsRes.data  || [];
    const fus   = fusRes.data  || [];
    const prods = prodsRes.data || [];

    // Índices
    const fusByProd  = {};
    fus.forEach(f => {
      (fusByProd[f.produto_id] = fusByProd[f.produto_id] || []).push(f);
    });
    const prodsByOp = {};
    prods.forEach(p => {
      (prodsByOp[p.oportunidade_id] = prodsByOp[p.oportunidade_id] || []).push(p);
    });

    const dismissed = _getDismissed();
    const items = [];

    ops.forEach(op => {
      const label    = `${op.num_legado || ''} ${op.clientes?.nome || ''}`.trim();
      const opProds  = prodsByOp[op.id] || [];
      const key_exp  = 'exp_' + op.id;
      const key_fu   = 'fu_'  + op.id;

      // Proposta expirada: produto enviado há >90 dias
      const isExpired = opProds.some(p =>
        p.data_envio && (_diasDesde(p.data_envio) ?? 0) > 90
      );

      if (isExpired && !dismissed.has(key_exp)) {
        items.push({
          key: key_exp, icon: '⚡', titulo: 'Proposta expirada', corpo: label,
          onClick:   () => window.location.href = 'crm.html',
          onDismiss: () => _dismissCrmAlert(key_exp),
        });
        return;
      }

      // Sem follow-up há >30 dias
      const opFus = opProds.flatMap(p => fusByProd[p.id] || []);
      const lastFu = opFus.reduce((max, f) => {
        const d = f.data_contato || f.created_at;
        return d > max ? d : max;
      }, '');
      const semFU30 = !lastFu || (_diasDesde(lastFu) ?? 0) > 30;

      if (semFU30 && !dismissed.has(key_fu)) {
        items.push({
          key: key_fu, icon: '⏰', titulo: 'Sem follow-up 30d', corpo: label,
          onClick:   () => window.location.href = 'crm.html',
          onDismiss: () => _dismissCrmAlert(key_fu),
        });
      }
    });

    _computed['comercial'] = { label: 'Comercial', items: items.slice(0, 50) };
  }

  /* ── carrega todas as seções computadas ──────────────────── */
  async function _fetchAllComputed(userId) {
    await Promise.allSettled([
      _fetchCrmAlerts(),
    ]);
    _renderBadge();
    if (_panelOpen) _renderPanel();
  }

  /* ── notificacoes da tabela ──────────────────────────────── */
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

  /* ── realtime ────────────────────────────────────────────── */
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

  /* ══════════════════════════════════════════════════════════
     API PÚBLICA
  ══════════════════════════════════════════════════════════ */

  // init({ userId }) — chamar após autenticação
  async function init({ userId } = {}) {
    async function _boot(uid) {
      _userId = uid;
      if (!_userId || !window.sb) return;
      // Notificações da tabela + seções computadas em paralelo
      await Promise.all([
        _fetch(_userId),
        _fetchAllComputed(_userId),
      ]);
      _subscribe(_userId);
    }

    if (userId) {
      await _boot(userId);
    } else {
      const cached = (() => {
        try { return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); } catch { return null; }
      })();
      const uid = cached?.app_user_id || cached?.id;
      if (uid) {
        await _boot(uid);
      } else {
        window.addEventListener('exp:session-ready', e => {
          const u = e.detail;
          _boot(u?.app_user_id || u?.id);
        }, { once: true });
      }
    }

    _bindOutsideClick();
    window._appNotifToggle        = togglePanel;
    window._appNotifEncerrarTodas = encerrarTodas;
  }

  // setComputedSection — módulo com dados locais mais ricos sobrescreve
  function setComputedSection(key, { label, items = [] } = {}) {
    _computed[key] = { label: label || MODULE_LABELS[key] || key, items };
    _renderBadge();
    if (_panelOpen) _renderPanel();
  }

  // refreshCrmAlerts — chamar após dispensar alerta (quando crm.html não gerencia)
  async function refreshCrmAlerts() {
    await _fetchCrmAlerts();
    _renderBadge();
    if (_panelOpen) _renderPanel();
  }

  return {
    init,
    setComputedSection,
    refreshCrmAlerts,
    close,
    _abrirNotif,
    _encerrarNotif,
    _computedClick,
    _dismissComputed,
    _actionComputed,
  };
})();
