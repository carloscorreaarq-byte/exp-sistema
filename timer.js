/* ═══════════════════════════════════════════════════════════════════
   EXP · TIMER WIDGET — timer.js  v1.0
   Contagem de horas cross-módulo com seleção de projeto/etapa
   ─────────────────────────────────────────────────────────────────
   Incluir <script src="timer.js"></script> antes de </body>
   em todos os módulos. Requer @supabase/supabase-js@2 já carregado.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */
  var SB_URL      = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var TIMER_KEY   = 'exp_timer_state';
  var EXPAND_SECS = 180;  // segundos antes de minimizar automaticamente

  var _sb, _tickInterval, _collapseTimer, _isHovering = false;
  var _projCache = null, _etapaCache = {};

  /* ═══════════════════════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════════════════════ */
  var CSS = [
    /* Widget container — bottom-left, acima do chat */
    '#exp-timer-widget{position:fixed;bottom:24px;left:24px;z-index:9999;font-family:"Raleway",sans-serif;user-select:none}',

    /* FAB */
    '#exp-timer-fab{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.22);border:none;outline:none;position:relative;transition:background .25s,transform .15s;color:#555;flex-shrink:0}',
    '#exp-timer-fab:hover{transform:scale(1.07)}',
    '#exp-timer-fab:active{transform:scale(.93)}',

    /* Running state: yellow + pulse */
    '#exp-timer-fab.running{background:#F5C518;color:#111110}',
    '@keyframes exp-timer-pulse{0%{box-shadow:0 0 0 0 rgba(245,197,24,.65)}70%{box-shadow:0 0 0 11px rgba(245,197,24,0)}100%{box-shadow:0 0 0 0 rgba(245,197,24,0)}}',
    '#exp-timer-fab.running{animation:exp-timer-pulse 1.6s ease-out infinite}',
    '#exp-timer-fab.running:hover{animation:none;box-shadow:0 2px 10px rgba(0,0,0,.2)}',

    /* Paused state: yellow, no pulse */
    '#exp-timer-fab.paused{background:#F5C518;color:#111110;animation:none}',

    /* Panel base */
    '.tmr-panel{position:absolute;bottom:50px;left:0;background:#fff;border-radius:14px;box-shadow:0 6px 28px rgba(0,0,0,.14);border:1px solid #ECEAE4;padding:14px;display:none;flex-direction:column;gap:10px;min-width:230px;animation:tmrIn .14s ease-out}',
    '.tmr-panel.open{display:flex}',
    '@keyframes tmrIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',

    /* Panel: selection */
    '#exp-timer-select{min-width:240px}',

    /* Panel: expanded (active) */
    '#exp-timer-expanded{min-width:210px}',

    /* Panel: confirm */
    '#exp-timer-confirm{min-width:260px}',

    /* Headings & labels */
    '.tmr-hdr{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#aaa;padding-bottom:2px}',
    '.tmr-proj{font-size:11px;font-weight:700;color:#111110;line-height:1.3}',
    '.tmr-etapa{font-size:10px;color:#888;font-weight:500}',

    /* Elapsed display */
    '.tmr-elapsed{font-family:"DM Mono",monospace;font-size:26px;font-weight:600;color:#111110;text-align:center;letter-spacing:1px;padding:2px 0}',

    /* Buttons row */
    '.tmr-btns{display:flex;gap:6px}',
    '.tmr-btn{flex:1;padding:7px 6px;border-radius:9px;border:none;font-family:"Raleway",sans-serif;font-size:10px;font-weight:700;cursor:pointer;transition:opacity .15s;letter-spacing:.2px}',
    '.tmr-btn:hover{opacity:.78}',
    '.tmr-btn-pause{background:#ECEAE4;color:#111110}',
    '.tmr-btn-stop{background:#111110;color:#fff}',

    /* Selects */
    '.tmr-sel{width:100%;padding:7px 9px;border:1px solid #ECEAE4;border-radius:9px;font-family:"Raleway",sans-serif;font-size:11px;background:#fff;color:#111110;outline:none;box-sizing:border-box;transition:border-color .15s}',
    '.tmr-sel:focus{border-color:#F5C518}',
    '.tmr-sel-lbl{font-size:9px;font-weight:600;color:#aaa;letter-spacing:.4px;text-transform:uppercase;margin-bottom:3px}',

    /* Primary action */
    '.tmr-primary{width:100%;padding:9px;border-radius:10px;border:none;background:#F5C518;color:#111110;font-family:"Raleway",sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:opacity .15s}',
    '.tmr-primary:hover{opacity:.82}',

    /* Dark action */
    '.tmr-dark{width:100%;padding:9px;border-radius:10px;border:none;background:#111110;color:#fff;font-family:"Raleway",sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:opacity .15s}',
    '.tmr-dark:hover{opacity:.8}',
    '.tmr-dark:disabled{opacity:.4;cursor:not-allowed}',

    /* Links */
    '.tmr-lnk{text-align:center;font-size:10px;color:#bbb;cursor:pointer;padding-top:1px}',
    '.tmr-lnk:hover{color:#555}',

    /* Confirm inputs */
    '.tmr-row{display:flex;gap:8px}',
    '.tmr-field{flex:1;display:flex;flex-direction:column;gap:3px}',
    '.tmr-input{width:100%;padding:7px 8px;border:1px solid #ECEAE4;border-radius:8px;font-family:"DM Mono",monospace;font-size:11px;color:#111110;background:#fff;box-sizing:border-box;outline:none;transition:border-color .15s}',
    '.tmr-input:focus{border-color:#F5C518}',
    '.tmr-textarea{width:100%;padding:7px 8px;border:1px solid #ECEAE4;border-radius:8px;font-family:"Raleway",sans-serif;font-size:11px;color:#111110;background:#fff;resize:none;box-sizing:border-box;outline:none;height:54px;transition:border-color .15s}',
    '.tmr-textarea:focus{border-color:#F5C518}',

    /* Toast */
    '#exp-timer-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111110;color:#fff;padding:9px 18px;border-radius:20px;font-size:12px;font-family:"Raleway",sans-serif;opacity:0;transition:opacity .25s;pointer-events:none;z-index:10002;white-space:nowrap}',
  ].join('');

  /* ═══════════════════════════════════════════════════════════════
     HTML
  ═══════════════════════════════════════════════════════════════ */
  var HTML = [
    '<div id="exp-timer-widget">',

    /* ── Selection panel ── */
    '<div id="exp-timer-select" class="tmr-panel">',
      '<div class="tmr-hdr">&#9201; Iniciar contagem</div>',
      '<div>',
        '<div class="tmr-sel-lbl">Projeto</div>',
        '<select class="tmr-sel" id="tmr-sel-proj"><option value="">Carregando&#8230;</option></select>',
      '</div>',
      '<div>',
        '<div class="tmr-sel-lbl">Etapa <span style="font-weight:400">(opcional)</span></div>',
        '<select class="tmr-sel" id="tmr-sel-etapa"><option value="">&#8212; Etapa &#8212;</option></select>',
      '</div>',
      '<button class="tmr-primary" onclick="_tmr.start()">&#9654; Iniciar</button>',
      '<div class="tmr-lnk" onclick="_tmr.cancelSelect()">Cancelar</div>',
    '</div>',

    /* ── Expanded / active panel ── */
    '<div id="exp-timer-expanded" class="tmr-panel">',
      '<div>',
        '<div class="tmr-proj" id="tmr-proj-name">&#8212;</div>',
        '<div class="tmr-etapa" id="tmr-etapa-name"></div>',
      '</div>',
      '<div class="tmr-elapsed" id="tmr-elapsed">00:00</div>',
      '<div class="tmr-btns">',
        '<button class="tmr-btn tmr-btn-pause" id="tmr-pause-btn" onclick="_tmr.togglePause()">&#9646;&#9646; Pausar</button>',
        '<button class="tmr-btn tmr-btn-stop" onclick="_tmr.openConfirm()">&#9646; Encerrar</button>',
      '</div>',
    '</div>',

    /* ── Confirmation panel ── */
    '<div id="exp-timer-confirm" class="tmr-panel">',
      '<div class="tmr-hdr">Confirmar lan&#231;amento</div>',
      '<div>',
        '<div class="tmr-proj" id="tmr-cf-proj">&#8212;</div>',
        '<div class="tmr-etapa" id="tmr-cf-etapa"></div>',
      '</div>',
      '<div>',
        '<div class="tmr-sel-lbl">Data</div>',
        '<input type="date" class="tmr-input" id="tmr-cf-data">',
      '</div>',
      '<div class="tmr-row">',
        '<div class="tmr-field">',
          '<div class="tmr-sel-lbl">In&#237;cio</div>',
          '<input type="time" class="tmr-input" id="tmr-cf-ini">',
        '</div>',
        '<div class="tmr-field">',
          '<div class="tmr-sel-lbl">Fim</div>',
          '<input type="time" class="tmr-input" id="tmr-cf-fim">',
        '</div>',
      '</div>',
      '<div>',
        '<div class="tmr-sel-lbl">Descri&#231;&#227;o</div>',
        '<textarea class="tmr-textarea" id="tmr-cf-desc" placeholder="O que foi feito&#8230;"></textarea>',
      '</div>',
      '<button class="tmr-dark" id="tmr-save-btn" onclick="_tmr.salvar()">Salvar lan&#231;amento</button>',
      '<div class="tmr-lnk" onclick="_tmr.backToExpanded()" style="color:#888">&#8592; Voltar / Retomar</div>',
      '<div class="tmr-lnk" onclick="_tmr.descartar()">Descartar timer</div>',
    '</div>',

    /* ── FAB ── */
    '<button id="exp-timer-fab" title="Timer de horas">',
      _svgClock(),
    '</button>',

    '</div>',
    '<div id="exp-timer-toast"></div>',
  ].join('');

  function _svgClock() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  }

  /* ═══════════════════════════════════════════════════════════════
     Estado (localStorage)
  ═══════════════════════════════════════════════════════════════ */
  /*
    Shape:
    {
      running:         bool,
      originalStart:   ISO string  — timestamp real do início (nunca muda)
      startedAt:       ISO string|null — quando o segmento atual começou
      pausedMs:        number — ms acumulados em pausas anteriores
      pausedAt:        ISO string|null
      produtoId:       uuid|null
      etapaId:         uuid|null
      nomeProjeto:     string
      nomeEtapa:       string
    }
  */
  function _loadState() {
    try { return JSON.parse(localStorage.getItem(TIMER_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function _saveState(s) { localStorage.setItem(TIMER_KEY, JSON.stringify(s)); }
  function _clearState() { localStorage.removeItem(TIMER_KEY); }

  /* ═══════════════════════════════════════════════════════════════
     Tempo
  ═══════════════════════════════════════════════════════════════ */
  function _elapsedMs(state) {
    var base = state.pausedMs || 0;
    if (state.running && state.startedAt) {
      base += Date.now() - new Date(state.startedAt).getTime();
    }
    return base;
  }

  function _fmtMs(ms) {
    var s   = Math.floor(ms / 1000);
    var h   = Math.floor(s / 3600);
    var m   = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) {
      return pad(h) + ':' + pad(m) + ':' + pad(sec);
    }
    return pad(m) + ':' + pad(sec);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function _fmtTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function _fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ═══════════════════════════════════════════════════════════════
     Supabase
  ═══════════════════════════════════════════════════════════════ */
  function _getSb() {
    if (_sb) return _sb;
    if (window.supabase) {
      _sb = window.supabase.createClient(SB_URL, SB_KEY);
    }
    return _sb;
  }

  function _getUser() {
    // Aproveita G.usuario se disponível na página
    if (window.G && window.G.usuario) return window.G.usuario;
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════
     Toast
  ═══════════════════════════════════════════════════════════════ */
  function _toast(msg) {
    var el = document.getElementById('exp-timer-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2800);
  }

  /* ═══════════════════════════════════════════════════════════════
     Panels
  ═══════════════════════════════════════════════════════════════ */
  function _showPanel(name) {
    ['select', 'expanded', 'confirm'].forEach(function (id) {
      var el = document.getElementById('exp-timer-' + id);
      if (el) el.classList.toggle('open', id === name);
    });
  }

  function _hideAll() { _showPanel('__none__'); }

  /* ═══════════════════════════════════════════════════════════════
     Tick (atualiza elapsed display)
  ═══════════════════════════════════════════════════════════════ */
  function _startTick() {
    clearInterval(_tickInterval);
    _tickInterval = setInterval(function () {
      var state = _loadState();
      if (!state.running) { clearInterval(_tickInterval); return; }
      var el = document.getElementById('tmr-elapsed');
      if (el) el.textContent = _fmtMs(_elapsedMs(state));
    }, 1000);
  }

  /* ═══════════════════════════════════════════════════════════════
     Auto-collapse (State 2 → State 1 após EXPAND_SECS)
  ═══════════════════════════════════════════════════════════════ */
  function _scheduleCollapse() {
    clearTimeout(_collapseTimer);
    _collapseTimer = setTimeout(function () {
      if (_isHovering) {
        // Reagendar enquanto o mouse estiver sobre o widget
        _scheduleCollapse();
        return;
      }
      _hideAll();
    }, EXPAND_SECS * 1000);
  }

  /* ═══════════════════════════════════════════════════════════════
     Render FAB
  ═══════════════════════════════════════════════════════════════ */
  function _renderFab() {
    var fab = document.getElementById('exp-timer-fab');
    if (!fab) return;
    var state = _loadState();
    fab.classList.remove('running', 'paused');
    if (state.running) {
      fab.classList.add('running');
    } else if (state.pausedMs || state.originalStart) {
      fab.classList.add('paused');
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     Render expanded panel
  ═══════════════════════════════════════════════════════════════ */
  function _renderExpanded() {
    var state = _loadState();
    var el;

    el = document.getElementById('tmr-proj-name');
    if (el) el.textContent = state.nomeProjeto || '—';

    el = document.getElementById('tmr-etapa-name');
    if (el) el.textContent = state.nomeEtapa || '';

    el = document.getElementById('tmr-elapsed');
    if (el) el.textContent = _fmtMs(_elapsedMs(state));

    el = document.getElementById('tmr-pause-btn');
    if (el) el.innerHTML = state.running ? '&#9646;&#9646; Pausar' : '&#9654; Retomar';

    _showPanel('expanded');
  }

  /* ═══════════════════════════════════════════════════════════════
     Carrega projetos e etapas
  ═══════════════════════════════════════════════════════════════ */
  async function _loadProjetos() {
    if (_projCache) return _projCache;
    var client = _getSb();
    if (!client) return [];
    var res = await client
      .from('produtos')
      .select('id,nome,codigo,ativo')
      .eq('ativo', true)
      .order('nome');
    _projCache = res.data || [];
    return _projCache;
  }

  async function _loadEtapas(prodId) {
    if (_etapaCache[prodId]) return _etapaCache[prodId];
    var client = _getSb();
    if (!client) return [];
    var res = await client
      .from('etapas')
      .select('id,nome')
      .eq('produto_id', prodId)
      .order('nome');
    _etapaCache[prodId] = res.data || [];
    return _etapaCache[prodId];
  }

  /* ═══════════════════════════════════════════════════════════════
     Ações públicas (chamadas via _tmr.xxx() nos botões)
  ═══════════════════════════════════════════════════════════════ */
  var _tmr = {

    /* ── Abre painel de seleção ── */
    openSelect: async function () {
      _showPanel('select');
      var sel = document.getElementById('tmr-sel-proj');
      if (!sel) return;
      sel.innerHTML = '<option value="">Carregando&#8230;</option>';
      var projs = await _loadProjetos();
      sel.innerHTML = '<option value="">&#8212; Selecione o projeto &#8212;</option>' +
        projs.map(function (p) {
          var label = (p.codigo ? p.codigo + ' · ' : '') + p.nome;
          return '<option value="' + p.id + '">' + label + '</option>';
        }).join('');

      var selEtapa = document.getElementById('tmr-sel-etapa');
      selEtapa.innerHTML = '<option value="">&#8212; Etapa &#8212;</option>';

      sel.onchange = async function () {
        selEtapa.innerHTML = '<option value="">Carregando&#8230;</option>';
        if (!this.value) {
          selEtapa.innerHTML = '<option value="">&#8212; Etapa &#8212;</option>';
          return;
        }
        var etapas = await _loadEtapas(this.value);
        selEtapa.innerHTML = '<option value="">&#8212; Etapa (opcional) &#8212;</option>' +
          etapas.map(function (e) {
            return '<option value="' + e.id + '">' + e.nome + '</option>';
          }).join('');
      };
    },

    /* ── Cancela seleção sem iniciar ── */
    cancelSelect: function () { _hideAll(); },

    /* ── Inicia timer ── */
    start: function () {
      var projSel  = document.getElementById('tmr-sel-proj');
      var etapaSel = document.getElementById('tmr-sel-etapa');
      if (!projSel || !projSel.value) {
        _toast('Selecione um projeto para continuar');
        return;
      }
      var now = new Date().toISOString();
      var state = {
        running:       true,
        originalStart: now,
        startedAt:     now,
        pausedMs:      0,
        pausedAt:      null,
        produtoId:     projSel.value,
        etapaId:       (etapaSel && etapaSel.value) ? etapaSel.value : null,
        nomeProjeto:   projSel.options[projSel.selectedIndex].text,
        nomeEtapa:     (etapaSel && etapaSel.value) ? etapaSel.options[etapaSel.selectedIndex].text : '',
      };
      _saveState(state);
      _hideAll();
      _renderFab();
      _renderExpanded();
      _startTick();
      _scheduleCollapse();
    },

    /* ── Pausa / Retoma ── */
    togglePause: function () {
      var state = _loadState();
      if (!state.originalStart) return;

      if (state.running) {
        // Pausar: acumula ms
        var elapsed = Date.now() - new Date(state.startedAt).getTime();
        state.pausedMs  = (state.pausedMs || 0) + elapsed;
        state.running   = false;
        state.startedAt = null;
        state.pausedAt  = new Date().toISOString();
        clearInterval(_tickInterval);
      } else {
        // Retomar
        state.running   = true;
        state.startedAt = new Date().toISOString();
        state.pausedAt  = null;
        _startTick();
        _scheduleCollapse();
      }
      _saveState(state);
      _renderFab();
      _renderExpanded();
    },

    /* ── Encerrar → abre confirmação ── */
    openConfirm: function () {
      clearTimeout(_collapseTimer);
      clearInterval(_tickInterval);

      var state = _loadState();
      // Congela tempo se ainda estiver rodando
      if (state.running && state.startedAt) {
        var elapsed    = Date.now() - new Date(state.startedAt).getTime();
        state.pausedMs = (state.pausedMs || 0) + elapsed;
        state.running  = false;
        state.startedAt = null;
        state.pausedAt  = new Date().toISOString();
        _saveState(state);
        _renderFab();
      }

      var endDate   = state.pausedAt ? new Date(state.pausedAt) : new Date();
      var startDate = state.originalStart ? new Date(state.originalStart) : new Date(endDate.getTime() - (state.pausedMs || 0));

      var el;
      el = document.getElementById('tmr-cf-proj');
      if (el) el.textContent = state.nomeProjeto || '—';

      el = document.getElementById('tmr-cf-etapa');
      if (el) el.textContent = state.nomeEtapa || '—';

      el = document.getElementById('tmr-cf-data');
      if (el) el.value = _fmtDate(startDate);

      el = document.getElementById('tmr-cf-ini');
      if (el) el.value = _fmtTime(startDate);

      el = document.getElementById('tmr-cf-fim');
      if (el) el.value = _fmtTime(endDate);

      el = document.getElementById('tmr-cf-desc');
      if (el) el.value = '';

      el = document.getElementById('tmr-save-btn');
      if (el) { el.disabled = false; el.textContent = 'Salvar lançamento'; }

      _showPanel('confirm');
    },

    /* ── Volta ao painel expanded (retoma timer) ── */
    backToExpanded: function () {
      var state = _loadState();
      if (!state.originalStart) return;
      if (!state.running) {
        // Retoma automaticamente ao voltar
        state.running   = true;
        state.startedAt = new Date().toISOString();
        state.pausedAt  = null;
        _saveState(state);
        _renderFab();
        _startTick();
        _scheduleCollapse();
      }
      _renderExpanded();
    },

    /* ── Salva lançamento ── */
    salvar: async function () {
      var btn = document.getElementById('tmr-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

      var user = _getUser();
      if (!user || !user.id) {
        _toast('Usuário não encontrado. Faça login novamente.');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      var state   = _loadState();
      var dataISO = document.getElementById('tmr-cf-data').value;
      var ini     = document.getElementById('tmr-cf-ini').value;
      var fim     = document.getElementById('tmr-cf-fim').value;
      var desc    = (document.getElementById('tmr-cf-desc').value || '').trim();

      if (!dataISO || !ini || !fim) {
        _toast('Preencha data, início e fim');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      var client = _getSb();
      if (!client) {
        _toast('Supabase não disponível');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      // ── Semana (upsert) ──────────────────────────────────────────
      var dateObj  = new Date(dataISO + 'T12:00:00');
      var jsDay    = dateObj.getDay();           // 0=Dom ... 6=Sab
      var isoDia   = jsDay === 0 ? 7 : jsDay;   // 1=Seg ... 7=Dom

      // Início da semana (segunda-feira)
      var startOfWeek = new Date(dateObj);
      startOfWeek.setDate(dateObj.getDate() - (isoDia - 1));
      var endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Número ISO da semana
      var thursd   = new Date(dateObj);
      thursd.setDate(dateObj.getDate() + (4 - isoDia));
      var yearStart = new Date(thursd.getFullYear(), 0, 1);
      var semNum   = Math.ceil(((thursd - yearStart) / 86400000 + 1) / 7);

      var semPayload = {
        usuario_id: user.id,
        ano:        thursd.getFullYear(),
        semana:     semNum,
        ini:        _fmtDate(startOfWeek),
        fim:        _fmtDate(endOfWeek),
      };

      var semRes = await client
        .from('semanas')
        .upsert(semPayload, { onConflict: 'usuario_id,ano,semana' })
        .select()
        .single();

      if (semRes.error) {
        _toast('Erro na semana: ' + semRes.error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      // ── Lançamento ───────────────────────────────────────────────
      var lancPayload = {
        usuario_id:      user.id,
        semana_id:       semRes.data.id,
        data_lancamento: dataISO,
        dia_semana:      isoDia,
        hora_inicio:     ini,
        hora_fim:        fim,
        tipo:            'horas_projeto',
        produto_id:      state.produtoId || null,
        etapa_id:        state.etapaId   || null,
        descricao:       desc || null,
      };

      var lancRes = await client.from('horas_lancadas').insert(lancPayload);

      if (lancRes.error) {
        _toast('Erro ao salvar: ' + lancRes.error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      // Sucesso
      _clearState();
      _hideAll();
      _renderFab();
      _toast('Horas registradas ✓');

      // Atualiza a view de horas se estivermos no gestao.html
      if (window.renderSemana) window.renderSemana();
    },

    /* ── Descarta timer sem salvar ── */
    descartar: function () {
      clearInterval(_tickInterval);
      clearTimeout(_collapseTimer);
      _clearState();
      _hideAll();
      _renderFab();
      _toast('Timer descartado');
    },
  };

  // Expõe globalmente para os onclick do HTML
  window._tmr = _tmr;

  /* ═══════════════════════════════════════════════════════════════
     FAB click handler
  ═══════════════════════════════════════════════════════════════ */
  function _onFabClick() {
    var state    = _loadState();
    var active   = !!(state.running || state.originalStart);

    var expandedEl = document.getElementById('exp-timer-expanded');
    var selectEl   = document.getElementById('exp-timer-select');
    var confirmEl  = document.getElementById('exp-timer-confirm');

    if (active) {
      // Timer em andamento
      if (confirmEl && confirmEl.classList.contains('open')) {
        // Confirmar panel aberto — não fecha pelo FAB (usuário precisa escolher)
        return;
      }
      if (expandedEl && expandedEl.classList.contains('open')) {
        // Fecha expanded (minimiza para State 1)
        _hideAll();
        clearTimeout(_collapseTimer);
      } else {
        // Reabre expanded
        _renderExpanded();
        if (state.running) _scheduleCollapse();
      }
    } else {
      // Sem timer ativo
      if (selectEl && selectEl.classList.contains('open')) {
        _hideAll();
      } else {
        _tmr.openSelect();
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     Init
  ═══════════════════════════════════════════════════════════════ */
  function _init() {
    // Injeta CSS
    var styleEl      = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // Injeta HTML
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    // FAB click
    var fab = document.getElementById('exp-timer-fab');
    if (fab) fab.addEventListener('click', _onFabClick);

    // Hover: mantém expanded e reinicia collapse timer
    var widget = document.getElementById('exp-timer-widget');
    if (widget) {
      widget.addEventListener('mouseenter', function () {
        _isHovering = true;
        clearTimeout(_collapseTimer);
        var state = _loadState();
        if (state.running || state.originalStart) {
          var expandedEl = document.getElementById('exp-timer-expanded');
          var confirmEl  = document.getElementById('exp-timer-confirm');
          var isAnyOpen  = (expandedEl && expandedEl.classList.contains('open')) ||
                           (confirmEl  && confirmEl.classList.contains('open'));
          if (!isAnyOpen) _renderExpanded();
        }
      });

      widget.addEventListener('mouseleave', function () {
        _isHovering = false;
        var state = _loadState();
        if (state.running) _scheduleCollapse();
      });
    }

    // Click fora: fecha painel de seleção (mas não o confirm ou o expanded com timer ativo)
    document.addEventListener('click', function (e) {
      var w = document.getElementById('exp-timer-widget');
      if (w && w.contains(e.target)) return;
      var selectEl = document.getElementById('exp-timer-select');
      if (selectEl && selectEl.classList.contains('open')) {
        _hideAll();
      }
    });

    // Render inicial
    _renderFab();

    // Retoma tick se estava rodando quando saiu da página
    var state = _loadState();
    if (state.running && state.startedAt) {
      _startTick();
      // Mostra expanded brevemente ao voltar para uma página
      _renderExpanded();
      _scheduleCollapse();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
