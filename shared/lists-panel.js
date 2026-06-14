/*
  EXP · Painel de Listas — módulo compartilhado
  Usado por: chat-fullpage.html, app.html

  Uso:
    listsPanel.init({
      getSb      : () => window.sb,
      getUser    : () => ({ id, nome, iniciais, cor }),  // usuário atual
      getMembers : () => [...],                          // todos os membros para atribuição
      escHtml    : window.escHtml,                       // função de escape (opcional)
      onOpen     : fn,                                   // callback ao abrir (opcional)
      onClose    : fn,                                   // callback ao fechar (opcional)
    });
    listsPanel.toggle();
*/

(function(global) {
  'use strict';

  /* ── helpers internos ───────────────────────────────────── */
  var _cfg = null;

  function _sb()      { return _cfg.getSb(); }
  function _user()    { return _cfg.getUser(); }
  function _members() { return (_cfg.getMembers && _cfg.getMembers()) || []; }
  function _esc(s)    { return (_cfg.escHtml || _defaultEsc)(s); }
  function _defaultEsc(s) {
    return String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function _firstName(n) { return n ? n.split(' ')[0] : ''; }
  function _isSocio() {
    var u = _user() || {};
    var r = String(u.role || '').toLowerCase().trim();
    return r === 'socio' || r === 'socio_adm' || r === 'socio_admin';
  }
  function _fmtDateTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  var _PENCIL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

  /* ── estado do painel ───────────────────────────────────── */
  var _open            = false;
  var _listsActiveTab  = 'tarefas';
  var _tasksCache      = [];
  var _delegadasCache  = [];
  var _delegadasExpanded = false;
  var _recentesOpen      = false;
  var _ckAbertosAll    = [];
  var _ckEtapaAll      = [];
  var _ckRevisaoAll    = [];
  var _ckLabelFns      = {};

  /* ── init ───────────────────────────────────────────────── */
  function init(cfg) {
    _cfg = cfg;
  }

  /* ── toggle ─────────────────────────────────────────────── */
  function toggle() {
    var $panel = document.getElementById('fp-tasks-panel');
    var $btn   = document.getElementById('fp-nav-lists');
    if (!$panel || !_cfg) return;
    _open = !_open;
    $panel.style.display = _open ? 'flex' : 'none';
    if ($btn) $btn.classList.toggle('active', _open);
    if (_open) {
      if (_cfg.onOpen) _cfg.onOpen();
      _switchTab(_listsActiveTab, false);
    } else {
      if (_cfg.onClose) _cfg.onClose();
    }
  }

  /* ── tabs ───────────────────────────────────────────────── */
  function switchListsTab(tab) {
    _switchTab(tab, true);
  }

  function _switchTab(tab, saveActive) {
    if (saveActive) _listsActiveTab = tab;
    document.querySelectorAll('.fp-lists-tab').forEach(function(el) {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    var $list   = document.getElementById('fp-tasks-list');
    var $form   = document.getElementById('fp-task-form');
    var $ckView = document.getElementById('fp-ck-view');
    var $count  = document.getElementById('fp-tasks-panel-count');
    if ($count) $count.style.display = tab === 'tarefas' ? '' : 'none';
    if (tab === 'tarefas') {
      if ($list)   $list.style.display   = '';
      if ($form)   $form.style.display   = '';
      if ($ckView) $ckView.style.display = 'none';
      _loadTasks();
    } else {
      if ($list)   $list.style.display   = 'none';
      if ($form)   $form.style.display   = 'none';
      if ($ckView) $ckView.style.display = 'flex';
      /* limpa itens e footer do tab anterior antes de carregar o novo */
      var $ckItems = document.getElementById('fp-ck-items');
      var $foot    = document.getElementById('fp-ck-footer');
      if ($ckItems) $ckItems.innerHTML = '';
      if ($foot)  { $foot.innerHTML = ''; $foot.style.display = 'none'; }
      _loadCkTab(tab);
    }
  }

  /* ════════════════════════════════════════════════
     ABA TAREFAS
  ════════════════════════════════════════════════ */
  function _loadTasks() {
    var u   = _user();
    var uid = u && (u.id || u.app_user_id);
    if (!uid) return;
    _recentesOpen = false;
    var $list = document.getElementById('fp-tasks-list');
    if ($list) $list.innerHTML = _loadingHtml();

    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    var cutoffISO = cutoff.toISOString();

    Promise.all([
      _sb().from('tarefas_livres').select('*').eq('usuario_id', uid).is('atribuido_para', null).eq('concluida', false),
      _sb().from('tarefas_livres').select('*').eq('atribuido_para', uid).eq('concluida', false),
      _sb().from('tarefas_livres').select('*').eq('criado_por', uid).not('atribuido_para', 'is', null)
    ]).then(function(res) {
      var proprias  = res[0].data || [];
      var recebidas = res[1].data || [];
      var delegadas = (res[2].data || []).filter(function(t) {
        if (!t.atribuido_para || t.atribuido_para === uid) return false;
        if (!t.concluida) return true;
        return (t.updated_at || t.created_at || '') >= cutoffISO;
      });
      var todas = proprias.concat(recebidas.filter(function(r) {
        return !proprias.find(function(p) { return p.id === r.id; });
      }));
      var ordenar = function(a, b) {
        if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
        if (a.data_limite && b.data_limite) return a.data_limite.localeCompare(b.data_limite);
        if (a.data_limite) return -1;
        if (b.data_limite) return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
      };
      todas.sort(ordenar);
      delegadas.sort(ordenar);
      _tasksCache     = todas;
      _delegadasCache = delegadas;
      _renderTasks(todas, delegadas);
      _updateBadge(todas.length);
    }).catch(function() {
      var $l = document.getElementById('fp-tasks-list');
      if ($l) $l.innerHTML = '<div class="fp-ck-empty">Erro ao carregar tarefas.</div>';
    });
  }

  function _renderTasks(tasks, delegadas) {
    var $list = document.getElementById('fp-tasks-list');
    if (!$list) return;
    delegadas = delegadas || _delegadasCache || [];
    var hoje = new Date().toISOString().split('T')[0];

    function prazoHtml(t) {
      if (!t.data_limite) return '';
      var vencida = t.data_limite < hoje;
      var ehHoje  = t.data_limite === hoje;
      var cls = vencida ? 'vencida' : ehHoje ? 'hoje' : '';
      var dt  = new Date(t.data_limite + 'T12:00:00');
      var fmt = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
      return '<span class="fp-task-prazo ' + cls + '">' + _esc(fmt) + (vencida ? ' ⚠' : '') + '</span>';
    }
    function tipoHtml(t) {
      return t.tipo ? '<span style="font-size:9px;color:#bbb;text-transform:capitalize">' + _esc(t.tipo) + '</span>' : '';
    }

    var html = '<div class="fp-task-section fp-task-sec-head">' +
      '<span>Pendentes — ' + tasks.length + '</span>' +
      '<button class="fp-task-recentes-btn" onclick="listsPanel.toggleRecentes(event)" title="Ver realizadas recentemente e restaurar">↺ recentes</button>' +
      '</div>';
    if (!tasks.length) {
      html += '<div class="fp-ck-empty">Nenhuma tarefa pendente ✓</div>';
    } else {
      tasks.forEach(function(t) {
        var tid = _esc(String(t.id));
        html += '<div class="fp-task-item" id="fp-task-' + tid + '">' +
          '<div class="fp-task-check" onclick="listsPanel.checkTask(event,\'' + tid + '\')" title="Concluir"></div>' +
          '<div class="fp-task-body">' +
            '<div class="fp-task-desc">' + _esc(t.descricao || '(sem descrição)') + '</div>' +
            '<div class="fp-task-meta">' + prazoHtml(t) + tipoHtml(t) + '</div>' +
          '</div>' +
          '<button class="fp-task-edit" title="Editar tarefa" onclick="listsPanel.editTask(event,\'' + tid + '\')">' + _PENCIL + '</button>' +
          '</div>';
      });
    }

    if (delegadas.length) {
      var lbl = _delegadasExpanded ? '▾ Atribuídas — ' + delegadas.length : '▶ Ver atribuídas (' + delegadas.length + ')';
      html += '<button class="fp-task-section fp-delegadas-toggle" onclick="listsPanel.toggleDelegadas()" style="cursor:pointer;width:100%;text-align:left;border:none;background:none;font-family:inherit">' + lbl + '</button>';
      if (_delegadasExpanded) {
        delegadas.forEach(function(t) {
          var members = _members();
          var para    = members.find(function(m){ return m.id === t.atribuido_para || m.auth_id === t.atribuido_para; });
          var paraNome = para ? _firstName(para.nome) : '?';
          var paraCor  = para ? (para.cor || '#888') : '#888';
          var paraIni  = para ? (para.iniciais || paraNome.substring(0,2).toUpperCase()) : '?';
          var statusHtml = t.concluida
            ? '<span style="font-size:9px;font-weight:600;color:#2D9E6B;background:#EAF5EE;padding:1px 6px;border-radius:4px">Concluída</span>'
            : '<span style="font-size:9px;font-weight:600;color:#888;background:var(--off,#F7F6F3);padding:1px 6px;border-radius:4px;border:1px solid var(--cinza2,#ECEAE4)">Pendente</span>';
          html += '<div class="fp-task-item fp-task-delegada' + (t.concluida ? ' fp-task-done' : '') + '">' +
            '<div style="width:20px;height:20px;border-radius:50%;background:' + _esc(paraCor) + ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:\'DM Mono\',monospace">' + _esc(paraIni) + '</div>' +
            '<div class="fp-task-body">' +
              '<div class="fp-task-desc">' + _esc(t.descricao || '(sem descrição)') + '</div>' +
              '<div class="fp-task-meta"><span style="font-size:10px;color:#888">para ' + _esc(paraNome) + '</span>' + statusHtml + '</div>' +
            '</div></div>';
        });
      }
    }
    $list.innerHTML = html;
  }

  function toggleDelegadas() {
    _delegadasExpanded = !_delegadasExpanded;
    _renderTasks(_tasksCache, _delegadasCache);
  }

  function taskDescInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  function addTask() {
    var desc = ((document.getElementById('fp-task-desc') || {}).value || '').trim();
    var tipo = (document.getElementById('fp-task-tipo') || {}).value || '';
    var data = (document.getElementById('fp-task-data') || {}).value || null;
    if (!desc) { var el = document.getElementById('fp-task-desc'); if (el) el.focus(); return; }
    var u = _user(); var uid = u && (u.id || u.app_user_id);
    _sb().from('tarefas_livres').insert({
      usuario_id: uid, criado_por: uid, descricao: desc, tipo: tipo || null, data_limite: data || null
    }).then(function(r) {
      if (r.error) return;
      document.getElementById('fp-task-desc').value = '';
      document.getElementById('fp-task-data').value = '';
      _loadTasks();
    });
  }

  function checkTask(event, taskId) {
    event.stopPropagation();
    var btn = event.currentTarget;
    btn.classList.add('done');
    _sb().from('tarefas_livres').update({ concluida: true, concluida_em: new Date().toISOString() }).eq('id', taskId)
      .then(function(r) {
        if (r.error) { btn.classList.remove('done'); return; }
        _tasksCache = _tasksCache.filter(function(t) { return String(t.id) !== String(taskId); });
        setTimeout(function() { _renderTasks(_tasksCache); }, 400);
      });
  }

  /* ── editar tarefa própria (inline) ─────────────────────── */
  function editTask(event, taskId) {
    if (event) event.stopPropagation();
    var t = _tasksCache.find(function(x) { return String(x.id) === String(taskId); });
    if (!t) return;
    var row = document.getElementById('fp-task-' + taskId);
    if (!row) return;
    var body = row.querySelector('.fp-task-body');
    if (!body || body.querySelector('.fp-task-edit-desc')) return;
    row.classList.add('fp-task-editing');
    body.innerHTML =
      '<input class="fp-task-edit-desc" type="text" value="' + _esc(t.descricao || '') + '" placeholder="Descrição…">' +
      '<div class="fp-task-edit-row">' +
        '<input class="fp-task-edit-data" type="date" value="' + _esc(t.data_limite || '') + '">' +
        '<button class="fp-task-edit-save" onclick="listsPanel.saveTaskEdit(event,\'' + _esc(String(taskId)) + '\')">Salvar</button>' +
        '<button class="fp-task-edit-cancel" onclick="listsPanel.cancelTaskEdit(event)">Cancelar</button>' +
      '</div>';
    var di = body.querySelector('.fp-task-edit-desc');
    if (di) {
      di.focus(); di.setSelectionRange(di.value.length, di.value.length);
      di.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); saveTaskEdit(null, taskId); }
        else if (e.key === 'Escape') { cancelTaskEdit(null); }
      });
    }
  }

  function cancelTaskEdit(event) {
    if (event) event.stopPropagation();
    _renderTasks(_tasksCache);
  }

  function saveTaskEdit(event, taskId) {
    if (event) event.stopPropagation();
    var row = document.getElementById('fp-task-' + taskId);
    if (!row) return;
    var di = row.querySelector('.fp-task-edit-desc');
    var da = row.querySelector('.fp-task-edit-data');
    var desc = di ? (di.value || '').trim() : '';
    var data = da ? (da.value || null) : null;
    if (!desc) { if (di) di.focus(); return; }
    _sb().from('tarefas_livres').update({ descricao: desc, data_limite: data }).eq('id', taskId)
      .then(function(r) {
        if (r.error) return;
        var t = _tasksCache.find(function(x) { return String(x.id) === String(taskId); });
        if (t) { t.descricao = desc; t.data_limite = data; }
        _renderTasks(_tasksCache);
      });
  }

  /* ── realizadas recentemente + restaurar ────────────────── */
  function toggleRecentes(event) {
    if (event) event.stopPropagation();
    _recentesOpen = !_recentesOpen;
    if (_recentesOpen) _loadRecentes();
    else _renderTasks(_tasksCache);
  }

  function _loadRecentes() {
    var u = _user(); var uid = u && (u.id || u.app_user_id);
    if (!uid) return;
    var $list = document.getElementById('fp-tasks-list');
    if ($list) $list.innerHTML = _loadingHtml();
    _sb().from('tarefas_livres').select('*')
      .eq('usuario_id', uid).eq('concluida', true)
      .order('concluida_em', { ascending: false, nullsFirst: false })
      .limit(15)
      .then(function(r) {
        if (r.error) { if ($list) $list.innerHTML = '<div class="fp-ck-empty">Erro ao carregar realizadas.</div>'; return; }
        _renderRecentes(r.data || []);
      });
  }

  function _renderRecentes(items) {
    var $list = document.getElementById('fp-tasks-list');
    if (!$list) return;
    var html = '<button class="fp-task-section fp-delegadas-toggle" onclick="listsPanel.toggleRecentes(event)" ' +
      'style="cursor:pointer;width:100%;text-align:left;border:none;background:none;font-family:inherit">↩ Voltar às pendentes</button>' +
      '<div class="fp-task-section">Realizadas recentemente</div>';
    if (!items.length) {
      html += '<div class="fp-ck-empty">Nenhuma tarefa realizada.</div>';
    } else {
      items.forEach(function(t) {
        var tid = _esc(String(t.id));
        html += '<div class="fp-task-item fp-task-done">' +
          '<div class="fp-task-body">' +
            '<div class="fp-task-desc">' + _esc(t.descricao || '(sem descrição)') + '</div>' +
            '<div class="fp-task-meta">' + (t.concluida_em ? '<span style="font-size:9px;color:#bbb">' + _esc(_fmtDateTime(t.concluida_em)) + '</span>' : '') + '</div>' +
          '</div>' +
          '<button class="fp-task-restore" title="Restaurar para pendentes" onclick="listsPanel.restoreTask(event,\'' + tid + '\')">↺ restaurar</button>' +
          '</div>';
      });
    }
    $list.innerHTML = html;
  }

  function restoreTask(event, taskId) {
    if (event) event.stopPropagation();
    _sb().from('tarefas_livres').update({ concluida: false, concluida_em: null }).eq('id', taskId)
      .then(function(r) {
        if (r.error) return;
        _loadRecentes();
      });
  }

  function openAssignDrop(btn) {
    var ex = document.getElementById('fp-assign-drop');
    if (ex) { ex.remove(); return; }
    var u       = _user(); var uid = u && (u.id || u.app_user_id);
    var outros  = _members().filter(function(m) { return m.id !== uid; });
    var drop    = document.createElement('div');
    drop.id     = 'fp-assign-drop';
    var _dark    = document.documentElement.getAttribute('data-theme') === 'dark';
    var _dropBg  = _dark ? '#2A2926' : '#fff';
    var _dropBdr = _dark ? 'rgba(255,255,255,.1)' : '#ECEAE4';
    var _dropTxt = _dark ? '#F0EDE6' : '#111110';
    var _hoverBg = _dark ? '#3A3936' : '#F7F6F3';
    drop.style.cssText = 'position:fixed;z-index:700;background:' + _dropBg + ';border:1px solid ' + _dropBdr + ';border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.22);padding:4px 0;min-width:160px;font-family:Raleway,sans-serif;color:' + _dropTxt;
    if (!outros.length) {
      drop.innerHTML = '<div style="padding:7px 12px;font-size:11px;color:#aaa">Nenhum membro</div>';
    } else {
      drop.innerHTML = outros.map(function(m, i) {
        var nome = m.apelido || _firstName(m.nome || '');
        var cor  = m.cor || '#888';
        var ini  = m.iniciais || (m.nome || '').substring(0,2).toUpperCase();
        return '<div data-i="' + i + '" style="padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:7px;color:' + _dropTxt + '"' +
          ' onmouseenter="this.style.background=\'' + _hoverBg + '\'" onmouseleave="this.style.background=\'\'"' +
          ' onclick="listsPanel._doAssign(' + i + ')">' +
          '<span style="width:20px;height:20px;border-radius:50%;background:' + _esc(cor) + ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + _esc(ini) + '</span>' +
          _esc(nome) + '</div>';
      }).join('');
    }
    document.body.appendChild(drop);
    var rect   = btn.getBoundingClientRect();
    var dropH  = drop.offsetHeight;
    var topPos = rect.top - dropH - 6;
    drop.style.left = rect.left + 'px';
    drop.style.top  = (topPos >= 8 ? topPos : rect.bottom + 4) + 'px';
    window._listsAssignOthers = outros;
    setTimeout(function() {
      function hdl(e) {
        if (!drop.contains(e.target)) { drop.remove(); document.removeEventListener('click', hdl, true); }
      }
      document.addEventListener('click', hdl, true);
    }, 0);
  }

  function _doAssign(i) {
    var ex = document.getElementById('fp-assign-drop');
    if (ex) ex.remove();
    var m = (window._listsAssignOthers || [])[i];
    delete window._listsAssignOthers;
    if (!m) return;
    var desc = ((document.getElementById('fp-task-desc') || {}).value || '').trim();
    var tipo = (document.getElementById('fp-task-tipo') || {}).value || '';
    var data = (document.getElementById('fp-task-data') || {}).value || null;
    if (!desc) { var el = document.getElementById('fp-task-desc'); if (el) el.focus(); return; }
    var u = _user(); var meuid = u && (u.id || u.app_user_id);
    _sb().from('tarefas_livres').insert({
      usuario_id: m.id, atribuido_para: m.id, criado_por: meuid,
      descricao: desc, tipo: tipo || null, data_limite: data || null
    }).then(function(r) {
      if (r.error) return;
      document.getElementById('fp-task-desc').value = '';
      document.getElementById('fp-task-data').value = '';
      _loadTasks();
    });
  }

  function _updateBadge(n) {
    var $b = document.getElementById('fp-lists-badge');
    if (!$b) return;
    if (n > 0) { $b.textContent = n > 99 ? '99+' : n; $b.style.display = 'flex'; }
    else        { $b.style.display = 'none'; }
  }

  /* ════════════════════════════════════════════════
     ABAS CHECKLIST / GUIDELINE / REVISÃO
  ════════════════════════════════════════════════ */
  function _loadCkTab(tab) {
    var $items = document.getElementById('fp-ck-items');
    var $sel   = document.getElementById('fp-ck-select');
    if ($items) $items.innerHTML = _loadingHtml();
    if ($sel)   $sel.innerHTML   = '<option value="">— carregando… —</option>';
    var u = _user(); var uid = u && (u.id || u.app_user_id);
    if (!uid) return;
    if (tab === 'abertos')  _loadCkAbertos(uid);
    else if (tab === 'etapa')   _loadCkEtapa(uid);
    else if (tab === 'revisao') _loadCkRevisao(uid);
  }

  function _ckShowErr(msg) {
    var $w = document.getElementById('fp-ck-selector');
    var $i = document.getElementById('fp-ck-items');
    if ($w) $w.innerHTML = '<div style="font-size:10px;color:#B84C3A;padding:4px 0">Erro: ' + _esc(msg) + '</div>';
    if ($i) $i.innerHTML = '';
  }

  function _loadCkAbertos(uid) {
    _sb().from('checklist_tarefa')
      .select('id,titulo,status,produto_id,criado_por,editores_ids,checklist_tarefa_item(id,texto,secao,ordem,concluido,concluido_por_nome,concluido_em),produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome)))')
      .eq('status', 'aberto')
      .then(function(r) {
        if (r.error) { _ckShowErr(r.error.message); return; }
        var all = (r.data || []).filter(function(cl) {
          return cl.criado_por === uid || (Array.isArray(cl.editores_ids) && cl.editores_ids.indexOf(uid) > -1);
        });
        _ckAbertosAll = all;
        _renderCkSelector('abertos', all, function(cl) {
          return (cl.produtos && (cl.produtos.oportunidades && cl.produtos.oportunidades.projeto || cl.produtos.nome) || 'Projeto') + ' — ' + (cl.titulo || '');
        });
      });
  }

  function _loadCkEtapa(uid) {
    _sb().from('etapa_desenvolvedores')
      .select('etapa_id,etapas(id,nome,produto_id,produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome))))')
      .eq('usuario_id', uid)
      .then(function(devR) {
        if (devR.error) { _ckShowErr(devR.error.message); return; }
        var etapaIds = (devR.data || []).map(function(d){ return d.etapa_id; });
        if (!etapaIds.length) { _renderCkSelector('etapa', [], function(){ return ''; }); return; }
        var etapaMap = {};
        (devR.data || []).forEach(function(d){ if (d.etapas) etapaMap[d.etapa_id] = d.etapas; });
        _sb().from('checklist_etapa_exec')
          .select('id,preset_id,etapa_id,checklist_etapa_preset!preset_id(nome),checklist_etapa_exec_item(id,texto,secao,secao_id,ordem,concluido,concluido_por_nome,concluido_em)')
          .in('etapa_id', etapaIds)
          .then(function(r) {
            if (r.error) { _ckShowErr(r.error.message); return; }
            var execList = (r.data || []).map(function(exec) {
              var etapa = etapaMap[exec.etapa_id] || {};
              var prod  = etapa.produtos || {};
              var opp   = prod.oportunidades || {};
              exec._etapaNome   = etapa.nome || '';
              exec._prodNome    = (opp.projeto || prod.nome) || '';
              exec._clienteNome = (opp.clientes && opp.clientes.nome) || '';
              exec._coordId     = prod.coordenador_id || null;
              exec.checklist_etapa_exec_secao = [];
              return exec;
            });
            var execIds = execList.map(function(e){ return e.id; });
            _sb().from('checklist_etapa_exec_secao')
              .select('id,checklist_id,titulo,intro,ordem')
              .in('checklist_id', execIds)
              .then(function(secR) {
                if (!secR.error) {
                  var secMap = {};
                  (secR.data || []).forEach(function(s){
                    if (!secMap[s.checklist_id]) secMap[s.checklist_id] = [];
                    secMap[s.checklist_id].push(s);
                  });
                  execList.forEach(function(exec){
                    exec.checklist_etapa_exec_secao = secMap[exec.id] || [];
                  });
                }
                _ckEtapaAll = execList;
                _renderCkSelector('etapa', execList, function(exec) {
                  var base   = exec._prodNome ? exec._prodNome + ' — ' : '';
                  var preset = exec.checklist_etapa_preset && exec.checklist_etapa_preset.nome ? ' · ' + exec.checklist_etapa_preset.nome : '';
                  return base + (exec._etapaNome || '') + preset;
                });
              });
          });
      });
  }

  function _loadCkRevisao(uid) {
    _sb().from('etapa_desenvolvedores')
      .select('etapa_id,etapas(id,nome,produto_id,produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome))))')
      .eq('usuario_id', uid)
      .then(function(devR) {
        if (devR.error) { _ckShowErr(devR.error.message); return; }
        var etapaIds = (devR.data || []).map(function(d){ return d.etapa_id; });
        if (!etapaIds.length) { _renderCkSelector('revisao', [], function(){ return ''; }); return; }
        var etapaMap = {};
        (devR.data || []).forEach(function(d){ if (d.etapas) etapaMap[d.etapa_id] = d.etapas; });
        _sb().from('revisoes')
          .select('id,etapa_id,created_at,pranchas(id,nome,ordem,tarefas_revisao(id,descricao,concluida,created_at))')
          .in('etapa_id', etapaIds)
          .order('created_at')
          .then(function(r) {
            if (r.error) { _ckShowErr(r.error.message); return; }
            var contadores = {};
            var items = (r.data || []).map(function(rev) {
              contadores[rev.etapa_id] = (contadores[rev.etapa_id] || 0) + 1;
              var etapa = etapaMap[rev.etapa_id] || {};
              var prod  = etapa.produtos || {};
              var opp   = prod.oportunidades || {};
              rev._etapaNome   = etapa.nome || '';
              rev._prodNome    = (opp.projeto || prod.nome) || '';
              rev._clienteNome = (opp.clientes && opp.clientes.nome) || '';
              rev._coordId     = prod.coordenador_id || null;
              rev._num = contadores[rev.etapa_id];
              return rev;
            });
            _ckRevisaoAll = items;
            _renderCkSelector('revisao', items, function(rev) {
              var base = rev._prodNome ? rev._prodNome + ' — ' : '';
              return base + (rev._etapaNome || '') + ' · Rev. ' + rev._num;
            });
          });
      });
  }

  /* ── detalhe estruturado por tipo ───────────────────────── */
  function _ckGetDetail(tipo, ck) {
    if (tipo === 'abertos') {
      var p = ck.produtos || {}, o = p.oportunidades || {};
      return {
        cliente : (o.clientes && o.clientes.nome) || '',
        proj    : o.projeto || p.nome || '',
        etapa   : '',
        nome    : ck.titulo || '',
        coordId : p.coordenador_id || null,
      };
    }
    if (tipo === 'etapa') {
      return {
        cliente : ck._clienteNome || '',
        proj    : ck._prodNome    || '',
        etapa   : ck._etapaNome   || '',
        nome    : (ck.checklist_etapa_preset && ck.checklist_etapa_preset.nome) || '',
        coordId : ck._coordId || null,
      };
    }
    return {
      cliente : ck._clienteNome || '',
      proj    : ck._prodNome    || '',
      etapa   : ck._etapaNome   || '',
      nome    : 'Rev. ' + (ck._num || ''),
      coordId : ck._coordId || null,
    };
  }

  /* ── seletor ─────────────────────────────────────────────── */
  function _ckIsDone(tipo, ck) {
    var its;
    if (tipo === 'abertos') its = (ck.checklist_tarefa_item || []);
    else if (tipo === 'etapa') its = (ck.checklist_etapa_exec_item || []);
    else its = (ck.pranchas || []).reduce(function(a,p){ return a.concat(p.tarefas_revisao||[]); }, []);
    return its.length > 0 && its.every(function(i){ return i.concluido || i.concluida; });
  }

  function _renderCkSelector(tipo, items, labelFn) {
    _ckLabelFns[tipo] = labelFn;
    var $wrap  = document.getElementById('fp-ck-selector');
    var $items = document.getElementById('fp-ck-items');
    if (!$wrap) return;
    if (!items.length) {
      $wrap.innerHTML = '<div class="fp-ck-empty" style="padding:6px 0">Nenhum checklist encontrado.</div>';
      if ($items) $items.innerHTML = '';
      return;
    }
    var pending = items.filter(function(it, i){ it._idx = i; return !_ckIsDone(tipo, it); });
    var done    = items.filter(function(it, i){ it._idx = i; return  _ckIsDone(tipo, it); });
    var sorted  = pending.concat(done);
    var opts = '<option value="">— selecionar —</option>' + sorted.map(function(it) {
      var lbl = _esc(labelFn(it));
      var prefix = _ckIsDone(tipo, it) ? '✓ ' : '';
      var cls = _ckIsDone(tipo, it) ? ' class="fp-ck-opt-done"' : '';
      return '<option value="' + it._idx + '"' + cls + '>' + prefix + lbl + '</option>';
    }).join('');
    $wrap.innerHTML = '<select class="fp-ck-select" id="fp-ck-select" onchange="listsPanel.selectCkByIndex(\'' + tipo + '\',this.value)">' + opts + '</select>';
    if ($items) $items.innerHTML = '';
    /* Restaura última seleção */
    var lastId = localStorage.getItem('exp_ck_last_' + tipo);
    if (lastId) {
      var lastItem = items.find(function(it){ return String(it.id) === String(lastId); });
      if (lastItem && lastItem._idx !== undefined) {
        selectCkByIndex(tipo, String(lastItem._idx));
        return;
      }
    }
    if (items.length === 1) { selectCkByIndex(tipo, '0'); }
  }

  function selectCkByIndex(tipo, idx) {
    var $wrap  = document.getElementById('fp-ck-selector');
    var $items = document.getElementById('fp-ck-items');
    var $foot  = document.getElementById('fp-ck-footer');
    if (!$items) return;
    if (idx === '' || idx === null || idx === undefined) {
      localStorage.removeItem('exp_ck_last_' + tipo);
      $items.innerHTML = '';
      if ($foot) { $foot.innerHTML = ''; $foot.style.display = 'none'; }
      var list0 = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
      _renderCkSelector(tipo, list0, _ckLabelFns[tipo] || function(){ return ''; });
      return;
    }
    var list = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
    var ck   = list[parseInt(idx)];
    if (!ck) return;
    /* Salva última seleção */
    localStorage.setItem('exp_ck_last_' + tipo, String(ck.id));
    var d = _ckGetDetail(tipo, ck);
    var projLine  = _esc(d.cliente ? d.cliente + ' | ' + d.proj : d.proj);
    var etapaLine = d.etapa ? '<div class="fp-ck-sel-sub">' + _esc(d.etapa) + '</div>' : '';
    var nomeLine  = d.nome  ? '<div class="fp-ck-sel-sub">' + _esc(d.nome)  + '</div>' : '';
    if ($wrap) $wrap.innerHTML =
      '<div class="fp-ck-sel-title">' +
        '<div class="fp-ck-sel-info">' +
          '<div class="fp-ck-sel-proj">' + projLine + '</div>' +
          etapaLine + nomeLine +
        '</div>' +
        '<button class="fp-ck-sel-back" onclick="listsPanel.selectCkByIndex(\'' + tipo + '\',\'\')" title="Trocar">↩ trocar</button>' +
      '</div>';
    _renderCkItems(tipo, ck);
  }

  /* ── itens ───────────────────────────────────────────────── */
  function _renderCkItems(tipo, ck) {
    var $items = document.getElementById('fp-ck-items');
    if (!$items) return;
    var html = '';

    if (tipo === 'abertos') {
      var its = (ck.checklist_tarefa_item || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      var hasSec = its.some(function(it){ return !!it.secao; });
      if (!hasSec) {
        its.forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
        html += _ckAddRow(tipo, ck.id, '');
      } else {
        its.filter(function(it){ return !it.secao; }).forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
        var seenSecs = []; var secGroups = {};
        its.forEach(function(it) {
          if (!it.secao) return;
          if (seenSecs.indexOf(it.secao) === -1) seenSecs.push(it.secao);
          if (!secGroups[it.secao]) secGroups[it.secao] = [];
          secGroups[it.secao].push(it);
        });
        seenSecs.forEach(function(sec) {
          html += '<div><div class="fp-ck-secao">' + _esc(sec) + '</div>';
          secGroups[sec].forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
          html += _ckAddRow(tipo, ck.id, sec);
          html += '</div>';
        });
      }

    } else if (tipo === 'etapa') {
      var its2    = (ck.checklist_etapa_exec_item || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      var secoes  = (ck.checklist_etapa_exec_secao || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      if (secoes.length) {
        its2.filter(function(it){ return !it.secao_id; }).forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
        secoes.forEach(function(s) {
          html += '<div><div class="fp-ck-secao">' + _esc(s.titulo) + '</div>';
          its2.filter(function(it){ return it.secao_id === s.id; }).forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
          html += _ckAddRow(tipo, ck.id, s.titulo);
          html += '</div>';
        });
      } else {
        its2.forEach(function(it){ html += _ckItemHtml(it, tipo, ck.id); });
        html += _ckAddRow(tipo, ck.id, '');
      }

    } else if (tipo === 'revisao') {
      var pranchas = (ck.pranchas || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      pranchas.forEach(function(pr) {
        html += '<div class="fp-ck-secao">' + _esc(pr.nome || '') + '</div>';
        (pr.tarefas_revisao || []).forEach(function(t){ html += _ckItemHtml(t, tipo, ck.id); });
      });
    }

    $items.innerHTML = html;
    _renderCkFooter(tipo, ck);
  }

  function _ckItemHtml(it, tipo, ckId) {
    var checked = tipo === 'revisao' ? it.concluida : it.concluido;
    var id  = _esc(String(it.id));
    var cid = _esc(String(ckId));
    var txt = _esc(it.descricao || it.texto || '');
    var editBtn = _isSocio()
      ? '<button class="fp-ck-edit" title="Editar item" onclick="listsPanel.editCkItem(\'' + tipo + '\',\'' + id + '\',\'' + cid + '\')">' + _PENCIL + '</button>'
      : '';
    return '<div class="fp-ck-item" id="fp-ck-it-' + id + '">' +
      '<input type="checkbox" class="fp-ck-cb"' + (checked ? ' checked' : '') +
      ' onchange="listsPanel.fpToggleCkItem(\'' + tipo + '\',\'' + id + '\',this.checked,\'' + cid + '\')">' +
      '<span class="fp-ck-txt' + (checked ? ' done' : '') + '">' + txt + '</span>' +
      editBtn +
      '</div>';
  }

  /* ── editar item de checklist (apenas sócio) ────────────── */
  function _findCkItem(tipo, ckId, itemId) {
    var list = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
    var ck = list.find(function(c) { return String(c.id) === String(ckId); });
    if (!ck) return null;
    if (tipo === 'revisao') {
      var found = null;
      (ck.pranchas || []).forEach(function(pr) {
        (pr.tarefas_revisao || []).forEach(function(t) { if (String(t.id) === String(itemId)) found = t; });
      });
      return found;
    }
    var field = tipo === 'abertos' ? 'checklist_tarefa_item' : 'checklist_etapa_exec_item';
    return (ck[field] || []).find(function(x) { return String(x.id) === String(itemId); }) || null;
  }

  function editCkItem(tipo, itemId, ckId) {
    if (!_isSocio()) return;
    var it = _findCkItem(tipo, ckId, itemId);
    if (!it) return;
    var row = document.getElementById('fp-ck-it-' + itemId);
    if (!row) return;
    var span = row.querySelector('.fp-ck-txt');
    if (!span || row.querySelector('.fp-ck-edit-inp')) return;
    var cur = tipo === 'revisao' ? (it.descricao || '') : (it.texto || '');
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'fp-ck-edit-inp';
    inp.value = cur;
    span.style.display = 'none';
    span.parentNode.insertBefore(inp, span.nextSibling);
    inp.focus(); inp.setSelectionRange(cur.length, cur.length);
    var done = false;
    function cancel() {
      if (done) return; done = true;
      if (inp.parentNode) inp.parentNode.removeChild(inp);
      span.style.display = '';
    }
    function save() {
      if (done) return;
      var nv = (inp.value || '').trim();
      if (!nv || nv === cur) { cancel(); return; }
      done = true;
      var tbl = tipo === 'abertos' ? 'checklist_tarefa_item' : tipo === 'etapa' ? 'checklist_etapa_exec_item' : 'tarefas_revisao';
      var col = tipo === 'revisao' ? 'descricao' : 'texto';
      var upd = {}; upd[col] = nv;
      _sb().from(tbl).update(upd).eq('id', itemId).then(function(r) {
        if (!r.error) {
          if (tipo === 'revisao') it.descricao = nv; else it.texto = nv;
          span.textContent = nv;
        }
        if (inp.parentNode) inp.parentNode.removeChild(inp);
        span.style.display = '';
      });
    }
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { cancel(); }
    });
    inp.addEventListener('blur', save);
  }

  function _ckAddRow(tipo, ckId, secao) {
    var cid     = _esc(String(ckId));
    var secAttr = secao ? ' data-secao="' + _esc(String(secao)) + '"' : '';
    return '<div class="fp-ck-add">' +
      '<div class="fp-ck-cb-mock"></div>' +
      '<input class="fp-ck-add-inp" type="text" placeholder="+ Novo item…"' + secAttr +
      ' onkeydown="if(event.key===\'Enter\'){listsPanel.fpAddCkItem(\'' + tipo + '\',\'' + cid + '\',this)}"' +
      ' onblur="listsPanel.fpAddCkItemBlur(\'' + tipo + '\',\'' + cid + '\',this)">' +
      '</div>';
  }

  /* ── footer de progresso ─────────────────────────────────── */
  function _ckCalcStats(tipo, ck) {
    var its, secs, secsDone, tasksTotal, tasksDone;
    if (tipo === 'abertos') {
      its = (ck.checklist_tarefa_item || []);
      tasksTotal = its.length; tasksDone = its.filter(function(i){ return i.concluido; }).length;
      var secsMap = {};
      its.forEach(function(it){ var s = it.secao || '__sem__'; if (!secsMap[s]) secsMap[s] = []; secsMap[s].push(it); });
      secs = Object.keys(secsMap).filter(function(k){ return k !== '__sem__'; });
      secsDone = secs.filter(function(s){ return secsMap[s].every(function(i){ return i.concluido; }); }).length;
    } else if (tipo === 'etapa') {
      its = (ck.checklist_etapa_exec_item || []);
      tasksTotal = its.length; tasksDone = its.filter(function(i){ return i.concluido; }).length;
      var secoes = (ck.checklist_etapa_exec_secao || []);
      secs = secoes.map(function(s){ return s.id; });
      secsDone = secs.filter(function(sid){
        var si = its.filter(function(i){ return i.secao_id === sid; });
        return si.length > 0 && si.every(function(i){ return i.concluido; });
      }).length;
    } else {
      var pranchas = (ck.pranchas || []);
      its = pranchas.reduce(function(a,p){ return a.concat(p.tarefas_revisao||[]); }, []);
      tasksTotal = its.length; tasksDone = its.filter(function(t){ return t.concluida; }).length;
      secs = pranchas.map(function(p){ return p.id; });
      secsDone = pranchas.filter(function(p){
        return (p.tarefas_revisao||[]).length > 0 && (p.tarefas_revisao||[]).every(function(t){ return t.concluida; });
      }).length;
    }
    return { tasksTotal: tasksTotal, tasksDone: tasksDone, secsTotal: secs.length, secsDone: secsDone };
  }

  function _renderCkFooter(tipo, ck) {
    var $foot = document.getElementById('fp-ck-footer');
    if (!$foot) return;
    $foot.style.display = '';
    var s = _ckCalcStats(tipo, ck);
    var taskPct = s.tasksTotal ? Math.round(s.tasksDone / s.tasksTotal * 100) : 0;
    var secPct  = s.secsTotal  ? Math.round(s.secsDone  / s.secsTotal  * 100) : 0;

    /* coordenadores */
    var d = _ckGetDetail(tipo, ck);
    var coords = [];
    if (d.coordId) {
      var m = _members().find(function(u){ return u.id === d.coordId; });
      if (m) coords.push(m);
    }
    /* subcoordenador_id — suportado quando existir no dado */
    if (ck._subcoordId) {
      var m2 = _members().find(function(u){ return u.id === ck._subcoordId; });
      if (m2) coords.push(m2);
    }
    var coordsHtml = coords.length
      ? '<div class="fp-ck-coords">' + coords.map(function(u) {
          var ini = u.iniciais || (u.nome||'').substring(0,2).toUpperCase();
          var cor = u.cor || '#888';
          return '<div class="fp-ck-coord-av" style="background:' + _esc(cor) + '" title="' + _esc(u.nome||'') + '">' + _esc(ini) + '</div>';
        }).join('') + '</div>'
      : '';

    $foot.innerHTML =
      (s.secsTotal > 0 ?
        '<div class="fp-ck-bar-row">' +
          '<span class="fp-ck-bar-label">Seções</span>' +
          '<div class="fp-ck-bar"><div class="fp-ck-bar-fill" id="fp-ck-bar-sec" style="width:' + secPct + '%"></div></div>' +
          '<span class="fp-ck-bar-count" id="fp-ck-cnt-sec">' + s.secsDone + '/' + s.secsTotal + '</span>' +
        '</div>' : '') +
      '<div class="fp-ck-bar-row">' +
        '<span class="fp-ck-bar-label">Tarefas</span>' +
        '<div class="fp-ck-bar"><div class="fp-ck-bar-fill" id="fp-ck-bar-tasks" style="width:' + taskPct + '%"></div></div>' +
        '<span class="fp-ck-bar-count" id="fp-ck-cnt-tasks">' + s.tasksDone + '/' + s.tasksTotal + '</span>' +
      '</div>' +
      coordsHtml;
  }

  /* ── toggle e add de item ─────────────────────────────────── */
  function fpToggleCkItem(tipo, itemId, checked, ckId) {
    var now = new Date().toISOString();
    var u   = _user(); var uid = u && (u.id || u.app_user_id);
    var tbl = tipo === 'abertos' ? 'checklist_tarefa_item' : tipo === 'etapa' ? 'checklist_etapa_exec_item' : 'tarefas_revisao';
    var upd = tipo === 'revisao'
      ? { concluida: checked }
      : { concluido: checked, concluido_por: checked ? uid : null, concluido_por_nome: checked ? ((u && u.nome) || '') : null, concluido_em: checked ? now : null };
    _sb().from(tbl).update(upd).eq('id', itemId).then(function(r) {
      if (r.error) return;
      var list = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
      list.forEach(function(ck) {
        if (String(ck.id) !== String(ckId)) return;
        var field = tipo === 'abertos' ? 'checklist_tarefa_item' : tipo === 'etapa' ? 'checklist_etapa_exec_item' : null;
        if (field) {
          var it = (ck[field]||[]).find(function(x){ return String(x.id)===String(itemId); });
          if (it) it[tipo==='revisao'?'concluida':'concluido'] = checked;
        } else {
          (ck.pranchas||[]).forEach(function(pr){
            var t = (pr.tarefas_revisao||[]).find(function(x){ return String(x.id)===String(itemId); });
            if (t) t.concluida = checked;
          });
        }
      });
      var $span = document.querySelector('#fp-ck-it-' + itemId + ' .fp-ck-txt');
      if ($span) $span.className = 'fp-ck-txt' + (checked ? ' done' : '');
      var list2 = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
      var ck2   = list2.find(function(c){ return String(c.id)===String(ckId); });
      if (ck2) {
        var s = _ckCalcStats(tipo, ck2);
        var taskPct = s.tasksTotal ? Math.round(s.tasksDone / s.tasksTotal * 100) : 0;
        var secPct  = s.secsTotal  ? Math.round(s.secsDone  / s.secsTotal  * 100) : 0;
        var $bt = document.getElementById('fp-ck-bar-tasks'); if ($bt) $bt.style.width = taskPct + '%';
        var $ct = document.getElementById('fp-ck-cnt-tasks'); if ($ct) $ct.textContent = s.tasksDone + '/' + s.tasksTotal;
        var $bs = document.getElementById('fp-ck-bar-sec');   if ($bs) $bs.style.width = secPct + '%';
        var $cs = document.getElementById('fp-ck-cnt-sec');   if ($cs) $cs.textContent = s.secsDone + '/' + s.secsTotal;
      }
    });
  }

  function fpAddCkItem(tipo, ckId, inp) {
    var txt = (inp.value || '').trim();
    if (!txt) return;
    inp.value = '';
    var secao   = (inp.dataset && inp.dataset.secao)   || null;
    var secaoId = (inp.dataset && inp.dataset.secaoId) || null;
    var list  = tipo === 'abertos' ? _ckAbertosAll : _ckEtapaAll;
    var ck    = list.find(function(c){ return String(c.id) === String(ckId); });
    if (!ck) return;
    var tbl   = tipo === 'abertos' ? 'checklist_tarefa_item' : 'checklist_etapa_exec_item';
    var field = tbl;
    var ordem = (ck[field] || []).length;
    var payload = { checklist_id: ckId, texto: txt, ordem: ordem, concluido: false };
    if (tipo === 'abertos' && secao)   payload.secao    = secao;
    if (tipo === 'etapa'   && secaoId) payload.secao_id = secaoId;
    _sb().from(tbl).insert(payload).select().single()
      .then(function(r) {
        if (r.error || !r.data) return;
        if (!ck[field]) ck[field] = [];
        ck[field].push(r.data);
        var $addRow = inp.closest('.fp-ck-add');
        if ($addRow) {
          var tmp = document.createElement('div');
          tmp.innerHTML = _ckItemHtml(r.data, tipo, ckId);
          $addRow.parentNode.insertBefore(tmp.firstChild, $addRow);
        }
        _renderCkFooter(tipo, ck);
        setTimeout(function(){ inp.focus(); }, 20);
      });
  }

  function fpAddCkItemBlur(tipo, ckId, inp) {
    if ((inp.value||'').trim()) fpAddCkItem(tipo, ckId, inp);
  }

  /* ── helpers ─────────────────────────────────────────────── */
  function _loadingHtml() {
    return '<div style="display:flex;align-items:center;justify-content:center;gap:5px;padding:24px">' +
      '<div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div>' +
      '</div>';
  }

  /* ── API pública ─────────────────────────────────────────── */
  /* ── mount: init + injeta o botão na nav + pré-carrega membros ──
     Conveniência para módulos que adotam o Painel de Listas no lugar
     do antigo ícone de Tarefas da nav (calc, financeiro, crm, …). */
  function mount(cfg) {
    init(cfg);
    var nav = document.getElementById('exp-nav');
    if (nav && !document.getElementById('fp-nav-lists')) {
      var btn = document.createElement('button');
      btn.id        = 'fp-nav-lists';
      btn.className = 'exp-nav-item';
      btn.title     = 'Minhas listas';
      btn.style.cssText = 'position:relative';
      btn.innerHTML =
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>' +
          '<line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' +
        '</svg>' +
        '<span id="fp-lists-badge" style="display:none;position:absolute;top:4px;right:4px;background:var(--ca,#1D6A4A);color:#fff;font-size:8px;font-weight:700;font-family:\'DM Mono\',monospace;min-width:14px;height:14px;border-radius:7px;align-items:center;justify-content:center;padding:0 2px;border:1.5px solid #2A2926;line-height:1"></span>';
      btn.onclick = function() { toggle(); };
      /* fim da nav — mesmo lugar do antigo ícone de Tarefas (cluster de ferramentas) */
      nav.appendChild(btn);
    }
    /* pré-carrega membros para atribuição de tarefas */
    try {
      var sb = _sb();
      if (sb && !global._listsMembersCache) {
        sb.from('usuarios').select('id,nome,iniciais,cor,apelido').eq('ativo', true)
          .then(function(r) { global._listsMembersCache = r.data || []; });
      }
    } catch (e) {}
  }

  global.listsPanel = {
    init            : init,
    mount           : mount,
    toggle          : toggle,
    switchListsTab  : switchListsTab,
    selectCkByIndex : selectCkByIndex,
    fpToggleCkItem  : fpToggleCkItem,
    fpAddCkItem     : fpAddCkItem,
    fpAddCkItemBlur : fpAddCkItemBlur,
    addTask         : addTask,
    taskDescInput   : taskDescInput,
    checkTask       : checkTask,
    editTask        : editTask,
    saveTaskEdit    : saveTaskEdit,
    cancelTaskEdit  : cancelTaskEdit,
    toggleRecentes  : toggleRecentes,
    restoreTask     : restoreTask,
    editCkItem      : editCkItem,
    openAssignDrop  : openAssignDrop,
    _doAssign       : _doAssign,
    toggleDelegadas : toggleDelegadas,
    get _listsActiveTab() { return _listsActiveTab; }
  };

})(window);
