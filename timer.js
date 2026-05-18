/* ═══════════════════════════════════════════════════════════════════
   EXP · TIMER WIDGET — timer.js  v1.2
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
  var EXPAND_SECS = 180;

  /* Cores da plataforma */
  var OURO        = '#C49A27';
  var OURO_PULSE  = 'rgba(196,154,39,.55)';
  var GRAFITE     = '#141414';
  var CINZA       = '#D0CFC9';
  var OFF         = '#F7F6F3';
  var VERDE       = '#3E7858';

  var _sb, _tickInterval, _collapseTimer, _isHovering = false;
  var _allProds = null, _etapaCache = {}, _cachedUser = null, _recentItems = null;
  var _audioCtx = null, _tickCount = 0;

  /* ── Subtipos (espelha SUBTIPOS do gestao.html) ─────────────────── */
  var SUBTIPOS = {
    organizacao: ['Capacitação','Reunião Semanal','Feedback','Reunião Interna'],
    sociedade:   ['Marketing','Prospecção','Administrativo','Jurídico','Reunião Societária','Consultoria','RH e Pessoas','Gestão','Outros'],
  };

  /* ── isSocio check ───────────────────────────────────────────────── */
  function _isSocio() {
    var role = '';
    if (window.G && window.G.usuario) role = window.G.usuario.role || '';
    else if (_cachedUser) role = _cachedUser.role || '';
    return ['socio','socio_adm','socio_admin'].indexOf(role.toLowerCase()) >= 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════════════════════ */
  var CSS = [
    /* Widget container */
    '#exp-timer-widget{position:fixed;bottom:24px;left:24px;z-index:9999;font-family:"Raleway",sans-serif;user-select:none}',

    /* FAB */
    '#exp-timer-fab{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.22);border:none;outline:none;position:relative;transition:background .25s,transform .15s;color:#888;flex-shrink:0}',
    '#exp-timer-fab:hover{transform:scale(1.07)}',
    '#exp-timer-fab:active{transform:scale(.93)}',

    /* FAB: rodando — amarelo + pulse */
    '#exp-timer-fab.running{background:' + OURO + ';color:#fff}',
    '@keyframes exp-tmr-pulse{0%{box-shadow:0 0 0 0 ' + OURO_PULSE + '}70%{box-shadow:0 0 0 11px rgba(196,154,39,0)}100%{box-shadow:0 0 0 0 rgba(196,154,39,0)}}',
    '#exp-timer-fab.running{animation:exp-tmr-pulse 1.6s ease-out infinite}',
    '#exp-timer-fab.running:hover{animation:none}',

    /* FAB: pausado — amarelo sem pulse */
    '#exp-timer-fab.paused{background:' + OURO + ';color:#fff;animation:none}',

    /* Panel base */
    '.tmr-panel{position:absolute;bottom:50px;left:0;background:#fff;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,.13);border:1px solid ' + CINZA + ';padding:12px;display:none;flex-direction:column;gap:8px;min-width:220px;max-width:250px;animation:tmrIn .14s ease-out}',
    '.tmr-panel.open{display:flex}',
    '@keyframes tmrIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',

    /* Panel sizes */
    '#exp-timer-select{min-width:222px}',
    '#exp-timer-expanded{min-width:200px}',
    '#exp-timer-confirm{min-width:240px}',

    /* ── Selects — estilo fluxo-col-select ── */
    '.tmr-sel{width:100%;font-size:9px;border:1px solid ' + CINZA + ';border-radius:4px;padding:3px 5px;background:#fff;color:#333;outline:none;font-family:"Raleway",sans-serif;transition:border-color .15s}',
    '.tmr-sel:focus{border-color:' + OURO + '}',

    /* Labels */
    '.tmr-sel-lbl{font-size:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#bbb;margin-bottom:2px;margin-top:4px}',
    '#tmr-proj-block{display:flex;flex-direction:column;gap:2px}',
    '#tmr-proj-block>div{margin-top:4px}',
    '#tmr-proj-block>div:first-child{margin-top:0}',
    '.tmr-hdr{font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#aaa}',

    /* Hierarquia de exibição (estado 2 e confirmação) */
    '.tmr-info-wrap{display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.tmr-info-cli{font-size:8px;color:#aaa;font-weight:500;line-height:1.3;word-break:break-word}',
    '.tmr-info-opp{font-size:11px;font-weight:700;color:' + GRAFITE + ';line-height:1.3;word-break:break-word}',
    '.tmr-info-prd{font-size:9px;color:#666;line-height:1.3;word-break:break-word}',
    '.tmr-info-eta{font-size:9px;color:#888;font-style:italic;line-height:1.3;word-break:break-word}',

    /* Elapsed */
    '.tmr-elapsed{font-family:"DM Mono",monospace;font-size:24px;font-weight:600;color:' + GRAFITE + ';text-align:center;letter-spacing:1px;padding:2px 0}',

    /* ── Botões — estilo .btn da plataforma ── */
    '.tmr-btns{display:flex;gap:5px}',
    '.tmr-btn{flex:1;padding:5px 8px;border-radius:6px;border:1px solid ' + CINZA + ';font-family:"Raleway",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:border-color .12s,color .12s,background .12s;background:#fff;color:#888}',
    '.tmr-btn:hover{border-color:' + GRAFITE + ';color:' + GRAFITE + '}',
    '.tmr-btn-stop{background:' + GRAFITE + ';color:#fff;border-color:' + GRAFITE + '}',
    '.tmr-btn-stop:hover{opacity:.82;color:#fff}',

    /* Botão iniciar — neutro/cinza com hover amarelo */
    '.tmr-primary{width:100%;padding:5px 12px;border-radius:6px;border:1px solid ' + CINZA + ';background:#fff;color:' + GRAFITE + ';font-family:"Raleway",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:border-color .12s,background .12s,color .12s}',
    '.tmr-primary:hover{border-color:' + OURO + ';background:' + OURO + ';color:#fff}',

    /* Botão salvar — .btn.filled */
    '.tmr-dark{width:100%;padding:5px 12px;border-radius:6px;border:1px solid ' + GRAFITE + ';background:' + GRAFITE + ';color:#fff;font-family:"Raleway",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:opacity .12s}',
    '.tmr-dark:hover{opacity:.82}',
    '.tmr-dark:disabled{opacity:.38;cursor:not-allowed}',

    /* Botões secundários do confirm (Voltar + Descartar) */
    '.tmr-btn-cf-sec{flex:1;padding:5px 6px;border-radius:6px;border:1px solid ' + CINZA + ';background:#fff;font-family:"Raleway",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;color:#888;transition:border-color .12s,color .12s}',
    '.tmr-btn-cf-sec:hover{border-color:' + GRAFITE + ';color:' + GRAFITE + '}',

    /* Links */
    '.tmr-lnk{text-align:center;font-size:9px;color:#bbb;cursor:pointer;letter-spacing:.2px}',
    '.tmr-lnk:hover{color:#555}',
    '.tmr-lnk.back{color:#888}',
    '.tmr-lnk.back:hover{color:' + GRAFITE + '}',

    /* ── Recentes ── */
    '.tmr-recent-btn{width:100%;text-align:left;padding:4px 7px;border:1px solid ' + CINZA + ';border-radius:5px;background:' + OFF + ';font-family:"Raleway",sans-serif;font-size:9px;color:#555;cursor:pointer;transition:background .1s,border-color .1s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;display:block}',
    '.tmr-recent-btn:last-child{margin-bottom:0}',
    '.tmr-recent-btn:hover{background:' + CINZA + ';border-color:#bbb;color:' + GRAFITE + '}',
    '.tmr-divider{height:1px;background:' + CINZA + ';margin:2px 0}',

    /* ── Inputs confirmação ── */
    '.tmr-row{display:flex;gap:6px}',
    '.tmr-field{flex:1;display:flex;flex-direction:column;gap:2px}',
    '.tmr-input{width:100%;padding:4px 6px;border:1px solid ' + CINZA + ';border-radius:5px;font-family:"DM Mono",monospace;font-size:10px;color:' + GRAFITE + ';background:#fff;box-sizing:border-box;outline:none;transition:border-color .15s}',
    '.tmr-input:focus{border-color:' + OURO + '}',
    '.tmr-textarea{width:100%;padding:5px 6px;border:1px solid ' + CINZA + ';border-radius:5px;font-family:"Raleway",sans-serif;font-size:10px;color:' + GRAFITE + ';background:#fff;resize:none;box-sizing:border-box;outline:none;height:48px;transition:border-color .15s}',
    '.tmr-textarea:focus{border-color:' + OURO + '}',

    /* ── Toast ── */
    '#exp-timer-toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:' + GRAFITE + ';color:#fff;padding:8px 16px;border-radius:20px;font-size:11px;font-family:"Raleway",sans-serif;opacity:0;transition:opacity .25s;pointer-events:none;z-index:10002;white-space:nowrap}',
  ].join('');

  /* ═══════════════════════════════════════════════════════════════
     HTML
  ═══════════════════════════════════════════════════════════════ */
  var HTML = [
    '<div id="exp-timer-widget">',

    /* ── Painel de seleção ── */
    '<div id="exp-timer-select" class="tmr-panel">',
      '<div class="tmr-hdr">&#9201; Iniciar contagem</div>',

      /* Recentes */
      '<div id="tmr-recent-block" style="display:none">',
        '<div class="tmr-sel-lbl">Recentes</div>',
        '<div id="tmr-recent-list"></div>',
        '<div class="tmr-divider"></div>',
      '</div>',

      /* Tipo */
      '<div>',
        '<div class="tmr-sel-lbl">Tipo</div>',
        '<select class="tmr-sel" id="tmr-sel-tipo" onchange="_tmr.changeTipo()">',
          '<option value="projeto">Projeto</option>',
          '<option value="organizacao">Org. Interna</option>',
        '</select>',
      '</div>',

      /* Subcategoria (org / soc) */
      '<div id="tmr-sub-block" style="display:none">',
        '<div class="tmr-sel-lbl">Categoria</div>',
        '<select class="tmr-sel" id="tmr-sel-sub"></select>',
      '</div>',

      /* Cascata: projeto */
      '<div id="tmr-proj-block">',
        '<div>',
          '<div class="tmr-sel-lbl">Cliente</div>',
          '<select class="tmr-sel" id="tmr-sel-cli" onchange="_tmr.changeCli()">',
            '<option value="">Carregando&#8230;</option>',
          '</select>',
        '</div>',
        '<div id="tmr-opp-block" style="display:none">',
          '<div class="tmr-sel-lbl">Projeto / oportunidade</div>',
          '<select class="tmr-sel" id="tmr-sel-opp" onchange="_tmr.changeOpp()">',
            '<option value="">&#8212; selecionar &#8212;</option>',
          '</select>',
        '</div>',
        '<div id="tmr-prod-block" style="display:none">',
          '<div class="tmr-sel-lbl">Produto</div>',
          '<select class="tmr-sel" id="tmr-sel-prod" onchange="_tmr.changeProd()">',
            '<option value="">&#8212; selecionar &#8212;</option>',
          '</select>',
        '</div>',
        '<div id="tmr-etapa-block" style="display:none">',
          '<div class="tmr-sel-lbl">Etapa <span style="font-weight:400;text-transform:none">(opcional)</span></div>',
          '<select class="tmr-sel" id="tmr-sel-etapa">',
            '<option value="">&#8212; selecionar &#8212;</option>',
          '</select>',
        '</div>',
      '</div>',

      '<button class="tmr-primary" onclick="_tmr.start()">&#9654; Iniciar</button>',
      '<div class="tmr-lnk" onclick="_tmr.cancelSelect()">Cancelar</div>',
    '</div>',

    /* ── Painel expandido (ativo) ── */
    '<div id="exp-timer-expanded" class="tmr-panel">',
      '<div class="tmr-info-wrap">',
        '<div class="tmr-info-cli" id="tmr-info-cli"></div>',
        '<div class="tmr-info-opp" id="tmr-info-opp">&#8212;</div>',
        '<div class="tmr-info-prd" id="tmr-info-prd"></div>',
        '<div class="tmr-info-eta" id="tmr-info-eta"></div>',
      '</div>',
      '<div class="tmr-elapsed" id="tmr-elapsed">00:00</div>',
      '<div class="tmr-btns">',
        '<button class="tmr-btn" id="tmr-pause-btn" onclick="_tmr.togglePause()">&#9646;&#9646; Pausar</button>',
        '<button class="tmr-btn tmr-btn-stop" onclick="_tmr.openConfirm()">&#9646; Encerrar</button>',
      '</div>',
    '</div>',

    /* ── Painel de confirmação ── */
    '<div id="exp-timer-confirm" class="tmr-panel">',
      '<div class="tmr-hdr">Confirmar lan&#231;amento</div>',
      '<div class="tmr-info-wrap">',
        '<div class="tmr-info-cli" id="tmr-cf-cli"></div>',
        '<div class="tmr-info-opp" id="tmr-cf-opp">&#8212;</div>',
        '<div class="tmr-info-prd" id="tmr-cf-prd"></div>',
        '<div class="tmr-info-eta" id="tmr-cf-eta"></div>',
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
      '<div class="tmr-btns">',
        '<button class="tmr-btn-cf-sec" onclick="_tmr.backToExpanded()">&#8592; Voltar</button>',
        '<button class="tmr-btn-cf-sec" onclick="_tmr.descartar()">Descartar</button>',
      '</div>',
      '<button class="tmr-dark" id="tmr-save-btn" onclick="_tmr.salvar()">Salvar lan&#231;amento</button>',
    '</div>',

    /* ── FAB ── */
    '<button id="exp-timer-fab" title="Timer de horas">',
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    '</button>',

    '</div>',
    '<div id="exp-timer-toast"></div>',
  ].join('');

  /* ═══════════════════════════════════════════════════════════════
     Estado (localStorage)
     {
       running, originalStart, startedAt, pausedMs, pausedAt,
       tipo, subtipo, produtoId, etapaId,
       nomeProjeto, nomeEtapa   ← strings de exibição
     }
  ═══════════════════════════════════════════════════════════════ */
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
    if (state.running && state.startedAt) base += Date.now() - new Date(state.startedAt).getTime();
    return base;
  }
  function _fmtMs(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h > 0 ? _pad(h) + ':' : '') + _pad(m) + ':' + _pad(sec);
  }
  function _pad(n) { return String(n).padStart(2, '0'); }
  function _fmtTime(d)  { return _pad(d.getHours()) + ':' + _pad(d.getMinutes()); }
  function _fmtDate(d)  { return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate()); }
  function _trunc(s, n) { n = n || 34; return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || ''); }

  /* ═══════════════════════════════════════════════════════════════
     Supabase
  ═══════════════════════════════════════════════════════════════ */
  function _getSb() {
    if (_sb) return _sb;
    if (window.supabase) _sb = window.supabase.createClient(SB_URL, SB_KEY);
    return _sb;
  }

  /* ═══════════════════════════════════════════════════════════════
     Usuário  (async — tenta G.usuario, depois session)
  ═══════════════════════════════════════════════════════════════ */
  async function _getUser() {
    if (_cachedUser && _cachedUser.id) return _cachedUser;
    if (window.G && window.G.usuario && window.G.usuario.id) {
      _cachedUser = window.G.usuario;
      return _cachedUser;
    }
    var client = _getSb();
    if (!client) return null;
    try {
      var r = await client.auth.getSession();
      var session = r && r.data && r.data.session;
      if (!session) return null;
      var q = await client.from('usuarios').select('id, nome, role, iniciais, cor, auth_id')
        .eq('auth_id', session.user.id).maybeSingle();
      _cachedUser = q.data;
      return _cachedUser;
    } catch (e) { return null; }
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
    ['select','expanded','confirm'].forEach(function (id) {
      var el = document.getElementById('exp-timer-' + id);
      if (el) el.classList.toggle('open', id === name);
    });
  }
  function _hideAll() { _showPanel('__none__'); }

  /* ═══════════════════════════════════════════════════════════════
     Som: tic-tac sutil via Web Audio API
  ═══════════════════════════════════════════════════════════════ */
  function _getAudioCtx() {
    if (!_audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return _audioCtx;
  }

  function _playTick(isTock) {
    var ctx = _getAudioCtx();
    if (!ctx) return;
    try {
      /* Tom curto (25ms): frequências alternadas para tic / tac */
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      var freq = isTock ? 680 : 820;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.022);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.028);
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     Tick (cronômetro + som)
  ═══════════════════════════════════════════════════════════════ */
  function _startTick() {
    clearInterval(_tickInterval);
    var BURST_INTERVAL_MS = 20 * 60 * 1000; // a cada 20 minutos
    var BURST_DURATION_MS = 4 * 1000;        // durante 4 segundos
    _tickInterval = setInterval(function () {
      var state = _loadState();
      if (!state.running) { clearInterval(_tickInterval); return; }
      var ms = _elapsedMs(state);
      var el = document.getElementById('tmr-elapsed');
      if (el) el.textContent = _fmtMs(ms);
      // Toca tic-tac apenas nos primeiros 4s de cada marca de 20 min
      if (ms > 0) {
        var msIntoInterval = ms % BURST_INTERVAL_MS;
        if (msIntoInterval < BURST_DURATION_MS) {
          var beatIdx = Math.floor(msIntoInterval / 1000);
          _playTick(beatIdx % 2 === 1); // tic, tac, tic, tac
        }
      }
    }, 1000);
  }

  /* ═══════════════════════════════════════════════════════════════
     Auto-collapse State 2 → State 1
  ═══════════════════════════════════════════════════════════════ */
  function _scheduleCollapse() {
    clearTimeout(_collapseTimer);
    _collapseTimer = setTimeout(function () {
      if (_isHovering) { _scheduleCollapse(); return; }
      _hideAll();
    }, EXPAND_SECS * 1000);
  }

  /* ═══════════════════════════════════════════════════════════════
     FAB render
  ═══════════════════════════════════════════════════════════════ */
  function _renderFab() {
    var fab = document.getElementById('exp-timer-fab');
    if (!fab) return;
    var state = _loadState();
    fab.classList.remove('running', 'paused');
    if (state.running) fab.classList.add('running');
    else if (state.originalStart) fab.classList.add('paused');
  }

  /* ═══════════════════════════════════════════════════════════════
     Expanded panel render
  ═══════════════════════════════════════════════════════════════ */
  function _renderExpanded() {
    var state = _loadState();
    var _txt = function (id, v) { var el = document.getElementById(id); if (el) { el.textContent = v || ''; el.style.display = v ? '' : 'none'; } };
    _txt('tmr-info-cli', state.nomeCliente || '');
    _txt('tmr-info-opp', state.nomeOpp || state.nomeProjeto || '—');
    _txt('tmr-info-prd', state.nomeProduto || '');
    _txt('tmr-info-eta', state.nomeEtapa  || '');
    var el = document.getElementById('tmr-elapsed');
    if (el) el.textContent = _fmtMs(_elapsedMs(state));
    el = document.getElementById('tmr-pause-btn');
    if (el) el.innerHTML = state.running ? '&#9646;&#9646; Pausar' : '&#9654; Retomar';
    _showPanel('expanded');
  }

  /* ═══════════════════════════════════════════════════════════════
     Data — produtos ativos
  ═══════════════════════════════════════════════════════════════ */
  async function _getActiveProds() {
    /* ── reutiliza G._prodsGestao quando disponível ── */
    if (window.G && Array.isArray(window.G._prodsGestao) && window.G._prodsGestao.length) {
      return window.G._prodsGestao.filter(function (p) {
        return p.status === 'ativo' && p.em_gestao !== false;
      });
    }
    /* ── cache próprio ── */
    if (_allProds) return _allProds;
    var client = _getSb();
    if (!client) return [];
    var res = await client
      .from('produtos')
      .select('id, nome, subtipo, oportunidade_id, oportunidades(id, projeto, clientes(id, nome, cidade, uf))')
      .eq('status', 'ativo')
      .eq('em_gestao', true);
    _allProds = res.data || [];
    return _allProds;
  }

  async function _getEtapas(prodId) {
    if (_etapaCache[prodId]) return _etapaCache[prodId];
    /* ── reutiliza G.todasEtapas ── */
    if (window.G && Array.isArray(window.G.todasEtapas)) {
      var e = window.G.todasEtapas
        .filter(function (et) { return et.produto_id === prodId; })
        .slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      _etapaCache[prodId] = e;
      return e;
    }
    var client = _getSb();
    if (!client) return [];
    var res = await client.from('etapas').select('id, nome, ordem')
      .eq('produto_id', prodId).order('ordem');
    _etapaCache[prodId] = res.data || [];
    return _etapaCache[prodId];
  }

  /* ── Clientes únicos ── */
  function _getClientes(prods) {
    var map = {};
    prods.forEach(function (p) {
      var cli = (p.oportunidades && p.oportunidades.clientes) || {};
      if (cli.id && !map[cli.id]) {
        var label = _trunc(cli.nome || '(sem nome)', 36);
        if (cli.cidade) label += ' · ' + cli.cidade;
        map[cli.id] = { id: cli.id, label: label };
      }
    });
    return Object.values(map).sort(function (a, b) { return a.label.localeCompare(b.label, 'pt'); });
  }

  /* ── Oportunidades por cliente ── */
  function _getOpps(prods, cliId) {
    var map = {};
    prods.forEach(function (p) {
      var opp = p.oportunidades || {};
      var cli = opp.clientes || {};
      if (cli.id === cliId && opp.id && !map[opp.id]) {
        map[opp.id] = { id: opp.id, label: _trunc(opp.projeto || '(sem nome)', 36) };
      }
    });
    return Object.values(map);
  }

  /* ── Produtos por oportunidade ── */
  function _getProdsByOpp(prods, oppId) {
    return prods.filter(function (p) { return p.oportunidade_id === oppId; })
      .map(function (p) { return { id: p.id, label: _trunc(p.nome || p.subtipo || '(sem nome)', 36) }; });
  }

  /* ═══════════════════════════════════════════════════════════════
     Recentes — últimos 2 lançamentos distintos do usuário
  ═══════════════════════════════════════════════════════════════ */
  async function _loadRecent() {
    if (_recentItems !== null) return _recentItems;
    var user = await _getUser();
    if (!user || !user.id) { _recentItems = []; return []; }
    var client = _getSb();
    if (!client) { _recentItems = []; return []; }
    try {
      var res = await client.from('horas_lancadas')
        .select('tipo, subtipo, produto_id, etapa_id, produtos(nome, oportunidades(projeto)), etapas(nome)')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      var seen = new Set(), result = [];
      (res.data || []).forEach(function (r) {
        var key = (r.tipo || '') + '|' + (r.subtipo || '') + '|' + (r.produto_id || '') + '|' + (r.etapa_id || '');
        if (seen.has(key) || result.length >= 3) return;
        seen.add(key);
        /* Monta label legível */
        var lbl = '';
        if (r.tipo === 'projeto') {
          var opp = r.produtos && r.produtos.oportunidades && r.produtos.oportunidades.projeto;
          var prod = r.produtos && r.produtos.nome;
          lbl = _trunc(opp || prod || 'Projeto', 26);
          if (r.etapas && r.etapas.nome) lbl += ' · ' + _trunc(r.etapas.nome, 16);
        } else if (r.tipo === 'organizacao') {
          lbl = 'Org. Interna' + (r.subtipo ? ' · ' + _trunc(r.subtipo, 20) : '');
        } else if (r.tipo === 'sociedade') {
          lbl = 'Sociedade' + (r.subtipo ? ' · ' + _trunc(r.subtipo, 20) : '');
        } else {
          lbl = r.tipo || '—';
        }
        result.push({ tipo: r.tipo, subtipo: r.subtipo, produtoId: r.produto_id, etapaId: r.etapa_id, label: lbl });
      });
      _recentItems = result;
    } catch (e) { _recentItems = []; }
    return _recentItems;
  }

  /* Renderiza lista de recentes no painel */
  async function _renderRecent() {
    var items = await _loadRecent();
    var block = document.getElementById('tmr-recent-block');
    var list  = document.getElementById('tmr-recent-list');
    if (!block || !list || !items.length) { if (block) block.style.display = 'none'; return; }
    list.innerHTML = items.map(function (item, i) {
      return '<button class="tmr-recent-btn" onclick="_tmr.useRecent(' + i + ')">&#128337; ' + item.label + '</button>';
    }).join('');
    block.style.display = '';
  }

  /* ═══════════════════════════════════════════════════════════════
     Ações do widget (_tmr — chamadas via onclick no HTML)
  ═══════════════════════════════════════════════════════════════ */
  var _tmr = {

    /* ── Abre painel de seleção ── */
    openSelect: async function () {
      _showPanel('select');

      /* Mostra/oculta opção Sociedade conforme role */
      await _getUser(); // garante _cachedUser preenchido
      var tipoSel = document.getElementById('tmr-sel-tipo');
      if (tipoSel) {
        var hasSoc = !!tipoSel.querySelector('option[value="sociedade"]');
        if (_isSocio() && !hasSoc) {
          var opt = document.createElement('option');
          opt.value = 'sociedade'; opt.textContent = 'Sociedade';
          tipoSel.appendChild(opt);
        }
      }

      /* Recentes */
      _renderRecent();

      /* Inicializa cascata: carrega clientes */
      _tmr._loadClientes();
    },

    /* ── Carrega clientes no select ── */
    _loadClientes: async function () {
      var selCli = document.getElementById('tmr-sel-cli');
      if (!selCli) return;
      selCli.innerHTML = '<option value="">Carregando&#8230;</option>';
      var prods = await _getActiveProds();
      var clis  = _getClientes(prods);
      selCli.innerHTML = '<option value="">&#8212; selecionar cliente &#8212;</option>' +
        clis.map(function (c) { return '<option value="' + c.id + '">' + c.label + '</option>'; }).join('');
      /* Oculta downstream */
      ['tmr-opp-block','tmr-prod-block','tmr-etapa-block'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.style.display = 'none';
      });
    },

    /* ── Tipo mudou ── */
    changeTipo: function () {
      var tipo = (document.getElementById('tmr-sel-tipo') || {}).value || 'projeto';
      var subBlock  = document.getElementById('tmr-sub-block');
      var projBlock = document.getElementById('tmr-proj-block');
      var subSel    = document.getElementById('tmr-sel-sub');

      if (tipo !== 'projeto') {
        /* Mostra subcategoria, oculta cascata */
        if (subBlock)  subBlock.style.display = '';
        if (projBlock) projBlock.style.display = 'none';
        if (subSel) {
          var opts = (SUBTIPOS[tipo] || []);
          subSel.innerHTML = opts.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
        }
      } else {
        if (subBlock)  subBlock.style.display = 'none';
        if (projBlock) projBlock.style.display = '';
        _tmr._loadClientes();
      }
    },

    /* ── Cliente mudou → carrega oportunidades ── */
    changeCli: async function () {
      var cliId = (document.getElementById('tmr-sel-cli') || {}).value || '';
      var oppBlock  = document.getElementById('tmr-opp-block');
      var prodBlock = document.getElementById('tmr-prod-block');
      var etapaBlock= document.getElementById('tmr-etapa-block');
      if (oppBlock)   oppBlock.style.display   = 'none';
      if (prodBlock)  prodBlock.style.display  = 'none';
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!cliId) return;

      var prods = await _getActiveProds();
      var opps  = _getOpps(prods, cliId);
      var selOpp = document.getElementById('tmr-sel-opp');
      if (selOpp) {
        selOpp.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          opps.map(function (o) { return '<option value="' + o.id + '">' + o.label + '</option>'; }).join('');
      }
      if (oppBlock) oppBlock.style.display = '';
    },

    /* ── Oportunidade mudou → carrega produtos ── */
    changeOpp: async function () {
      var oppId = (document.getElementById('tmr-sel-opp') || {}).value || '';
      var prodBlock  = document.getElementById('tmr-prod-block');
      var etapaBlock = document.getElementById('tmr-etapa-block');
      if (prodBlock)  prodBlock.style.display  = 'none';
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!oppId) return;

      var prods = await _getActiveProds();
      var ps    = _getProdsByOpp(prods, oppId);
      var selProd = document.getElementById('tmr-sel-prod');
      if (selProd) {
        selProd.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          ps.map(function (p) { return '<option value="' + p.id + '">' + p.label + '</option>'; }).join('');
      }
      if (prodBlock) prodBlock.style.display = '';

      /* Se só 1 produto, seleciona automaticamente e carrega etapas */
      if (ps.length === 1 && selProd) {
        selProd.value = ps[0].id;
        _tmr.changeProd();
      }
    },

    /* ── Produto mudou → carrega etapas ── */
    changeProd: async function () {
      var prodId = (document.getElementById('tmr-sel-prod') || {}).value || '';
      var etapaBlock = document.getElementById('tmr-etapa-block');
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!prodId) return;

      var etapas   = await _getEtapas(prodId);
      var selEtapa = document.getElementById('tmr-sel-etapa');
      if (selEtapa) {
        selEtapa.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          etapas.map(function (e) { return '<option value="' + e.id + '">' + _trunc(e.nome, 36) + '</option>'; }).join('');
      }
      if (etapaBlock && etapas.length) etapaBlock.style.display = '';
    },

    /* ── Clique em item recente → preenche e inicia ── */
    useRecent: async function (idx) {
      var items = _recentItems || [];
      var item  = items[idx];
      if (!item) return;

      var now = new Date().toISOString();
      var nomeProjeto = item.label;
      var nomeEtapa   = '';

      var nomeCliente = '', nomeOpp = '', nomeProduto = '';

      if (item.tipo === 'projeto' && item.produtoId) {
        var prods   = await _getActiveProds();
        var prod    = prods.find(function (p) { return p.id === item.produtoId; });
        var opp     = prod && prod.oportunidades;
        var cli     = opp && opp.clientes;
        nomeCliente = cli  ? (cli.nome  || '') : '';
        nomeOpp     = opp  ? (opp.projeto || '') : '';
        nomeProduto = prod ? (prod.nome || prod.subtipo || '') : '';
        nomeProjeto = nomeOpp || nomeProduto;

        if (item.etapaId) {
          var ets = await _getEtapas(item.produtoId);
          var et  = ets.find(function (e) { return e.id === item.etapaId; });
          nomeEtapa = et ? et.nome : '';
        }
      } else if (item.tipo === 'organizacao') {
        nomeOpp     = 'Org. Interna';
        nomeProjeto = nomeOpp;
        nomeEtapa   = item.subtipo || '';
      } else if (item.tipo === 'sociedade') {
        nomeOpp     = 'Sociedade';
        nomeProjeto = nomeOpp;
        nomeEtapa   = item.subtipo || '';
      }

      var state = {
        running:       true,
        originalStart: now,
        startedAt:     now,
        pausedMs:      0,
        pausedAt:      null,
        tipo:          item.tipo,
        subtipo:       item.subtipo || null,
        produtoId:     item.produtoId || null,
        etapaId:       item.etapaId  || null,
        nomeCliente:   nomeCliente,
        nomeOpp:       nomeOpp,
        nomeProduto:   nomeProduto,
        nomeProjeto:   nomeProjeto,
        nomeEtapa:     nomeEtapa,
      };
      _saveState(state);
      _hideAll();
      _renderFab();
      _renderExpanded();
      _startTick();
      _scheduleCollapse();
    },

    /* ── Cancelar seleção ── */
    cancelSelect: function () { _hideAll(); },

    /* ── Iniciar timer ── */
    start: function () {
      var tipoSel  = document.getElementById('tmr-sel-tipo');
      var tipo     = tipoSel ? tipoSel.value : 'projeto';
      var now      = new Date().toISOString();
      var nomeProjeto = '', nomeEtapa = '', subtipo = null, produtoId = null, etapaId = null;

      if (tipo !== 'projeto') {
        /* Org / Sociedade */
        var subSel = document.getElementById('tmr-sel-sub');
        subtipo    = subSel ? (subSel.value || null) : null;
        var tipoLabel = tipo === 'organizacao' ? 'Org. Interna' : 'Sociedade';
        nomeProjeto   = tipoLabel + (subtipo ? ' · ' + subtipo : '');
      } else {
        /* Projeto: precisa pelo menos produto selecionado */
        var selProd  = document.getElementById('tmr-sel-prod');
        var selEtapa = document.getElementById('tmr-sel-etapa');
        var selOpp   = document.getElementById('tmr-sel-opp');
        var selCli   = document.getElementById('tmr-sel-cli');

        produtoId = selProd  ? (selProd.value  || null) : null;
        etapaId   = selEtapa ? (selEtapa.value || null) : null;

        if (!selCli || !selCli.value) { _toast('Selecione o cliente'); return; }
        if (!selOpp || !selOpp.value) { _toast('Selecione o projeto / oportunidade'); return; }
        if (!produtoId)               { _toast('Selecione o produto'); return; }

        /* Captura labels de cada nível */
        var cliTxt  = selCli  ? selCli.options[selCli.selectedIndex].text   : '';
        var oppTxt  = selOpp  ? selOpp.options[selOpp.selectedIndex].text   : '';
        var prodTxt = selProd ? selProd.options[selProd.selectedIndex].text  : '';
        var etaTxt  = (etapaId && selEtapa) ? selEtapa.options[selEtapa.selectedIndex].text : '';
        /* nomeCliente: só o nome (sem a cidade que o select inclui) */
        var nomeCliente = cliTxt.split(' · ')[0];
        var nomeOpp     = oppTxt;
        var nomeProduto = (prodTxt !== oppTxt) ? prodTxt : '';
        nomeProjeto     = nomeOpp;
        nomeEtapa       = etaTxt;
      }

      var state = {
        running:       true,
        originalStart: now,
        startedAt:     now,
        pausedMs:      0,
        pausedAt:      null,
        tipo:          tipo,
        subtipo:       subtipo,
        produtoId:     produtoId,
        etapaId:       etapaId,
        nomeCliente:   (tipo === 'projeto' ? nomeCliente : ''),
        nomeOpp:       (tipo === 'projeto' ? nomeOpp : (tipo === 'organizacao' ? 'Org. Interna' : 'Sociedade')),
        nomeProduto:   (tipo === 'projeto' ? nomeProduto : ''),
        nomeProjeto:   nomeProjeto,
        nomeEtapa:     (tipo === 'projeto' ? nomeEtapa : (subtipo || '')),
      };
      _saveState(state);
      _hideAll();
      _renderFab();
      _renderExpanded();
      _startTick();
      _scheduleCollapse();
    },

    /* ── Pausar / Retomar ── */
    togglePause: function () {
      var state = _loadState();
      if (!state.originalStart) return;
      if (state.running) {
        var elapsed    = Date.now() - new Date(state.startedAt).getTime();
        state.pausedMs  = (state.pausedMs || 0) + elapsed;
        state.running   = false;
        state.startedAt = null;
        state.pausedAt  = new Date().toISOString();
        clearInterval(_tickInterval); // para som + cronômetro
      } else {
        state.running   = true;
        state.startedAt = new Date().toISOString();
        state.pausedAt  = null;
        _tickCount      = 0;
        _startTick();
        _scheduleCollapse();
      }
      _saveState(state);
      _renderFab();
      _renderExpanded();
    },

    /* ── Encerrar → Confirmação ── */
    openConfirm: function () {
      clearTimeout(_collapseTimer);
      clearInterval(_tickInterval);
      var state = _loadState();
      /* Congela tempo */
      if (state.running && state.startedAt) {
        var elapsed    = Date.now() - new Date(state.startedAt).getTime();
        state.pausedMs  = (state.pausedMs || 0) + elapsed;
        state.running   = false;
        state.startedAt = null;
        state.pausedAt  = new Date().toISOString();
        _saveState(state);
        _renderFab();
      }
      var endDate   = state.pausedAt ? new Date(state.pausedAt) : new Date();
      var startDate = state.originalStart ? new Date(state.originalStart) : new Date(endDate.getTime() - (state.pausedMs || 0));

      /* Textos display — hierarquia */
      var _ctxt = function (id, v) { var el = document.getElementById(id); if (el) { el.textContent = v || ''; el.style.display = v ? '' : 'none'; } };
      _ctxt('tmr-cf-cli', state.nomeCliente || '');
      _ctxt('tmr-cf-opp', state.nomeOpp || state.nomeProjeto || '—');
      _ctxt('tmr-cf-prd', state.nomeProduto || '');
      _ctxt('tmr-cf-eta', state.nomeEtapa || state.subtipo || '');
      /* Inputs */
      var setVal = function (id, v) { var el = document.getElementById(id); if (el) el.value = v; };
      setVal('tmr-cf-data', _fmtDate(startDate));
      setVal('tmr-cf-ini',  _fmtTime(startDate));
      setVal('tmr-cf-fim',  _fmtTime(endDate));
      setVal('tmr-cf-desc', '');
      var btn = document.getElementById('tmr-save-btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
      _showPanel('confirm');
    },

    /* ── Volta ao expanded e retoma ── */
    backToExpanded: function () {
      var state = _loadState();
      if (!state.originalStart) return;
      if (!state.running) {
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

    /* ── Salvar lançamento ── */
    salvar: async function () {
      var btn = document.getElementById('tmr-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

      var user = await _getUser();
      if (!user || !user.id) {
        _toast('Sessão expirada. Recarregue a página.');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      var state   = _loadState();
      var dataISO = (document.getElementById('tmr-cf-data') || {}).value || '';
      var ini     = (document.getElementById('tmr-cf-ini')  || {}).value || '';
      var fim     = (document.getElementById('tmr-cf-fim')  || {}).value || '';
      var desc    = ((document.getElementById('tmr-cf-desc') || {}).value || '').trim();

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

      /* ── Calcula semana ──────────────────────────────────────── */
      var dateObj = new Date(dataISO + 'T12:00:00');
      var jsDay   = dateObj.getDay();
      var isoDia  = jsDay === 0 ? 7 : jsDay;                         // 1=Seg … 7=Dom
      var weekMon = new Date(dateObj);
      weekMon.setDate(dateObj.getDate() - (isoDia - 1));
      var weekSun = new Date(weekMon);
      weekSun.setDate(weekMon.getDate() + 6);
      var thursd  = new Date(dateObj);
      thursd.setDate(dateObj.getDate() + (4 - isoDia));
      var yrStart = new Date(thursd.getFullYear(), 0, 1);
      var semNum  = Math.ceil(((thursd - yrStart) / 86400000 + 1) / 7);
      var weekIni = _fmtDate(weekMon);
      var weekFim = _fmtDate(weekSun);

      /* ── Busca semana existente ── */
      var sfRes = await client.from('semanas').select('id, finalizada')
        .eq('usuario_id', user.id).eq('data_inicio', weekIni).maybeSingle();
      var semDb = sfRes.data;

      if (semDb && semDb.finalizada) {
        _toast('Semana já finalizada');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      /* ── Cria semana se não existir ── */
      if (!semDb) {
        var scRes = await client.from('semanas')
          .upsert({ usuario_id: user.id, ano: thursd.getFullYear(), semana: semNum, data_inicio: weekIni, data_fim: weekFim, finalizada: false }, { onConflict: 'usuario_id,ano,semana' })
          .select().single();
        if (scRes.error) {
          _toast('Erro na semana: ' + scRes.error.message);
          if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
          return;
        }
        semDb = scRes.data;
      }

      /* ── Insere lançamento ── */
      var lancRes = await client.from('horas_lancadas').insert({
        usuario_id:      user.id,
        semana_id:       semDb.id,
        data_lancamento: dataISO,
        dia_semana:      isoDia,
        hora_inicio:     ini,
        hora_fim:        fim,
        tipo:            state.tipo || 'projeto',
        subtipo:         state.subtipo || null,
        produto_id:      state.produtoId || null,
        etapa_id:        state.etapaId   || null,
        descricao:       desc || null,
      });

      if (lancRes.error) {
        _toast('Erro: ' + lancRes.error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      /* Sucesso */
      _clearState();
      _recentItems = null;  // invalida cache de recentes
      _hideAll();
      _renderFab();
      _toast('Horas registradas ✓');
      if (window.renderSemana) window.renderSemana();
    },

    /* ── Descartar ── */
    descartar: function () {
      clearInterval(_tickInterval);
      clearTimeout(_collapseTimer);
      _clearState();
      _hideAll();
      _renderFab();
      _toast('Timer descartado');
    },
  };

  window._tmr = _tmr;

  /* ═══════════════════════════════════════════════════════════════
     FAB click
  ═══════════════════════════════════════════════════════════════ */
  function _onFabClick() {
    var state      = _loadState();
    var active     = !!(state.running || state.originalStart);
    var expandedEl = document.getElementById('exp-timer-expanded');
    var selectEl   = document.getElementById('exp-timer-select');
    var confirmEl  = document.getElementById('exp-timer-confirm');

    if (active) {
      if (confirmEl && confirmEl.classList.contains('open')) return; // não fecha durante confirmação
      if (expandedEl && expandedEl.classList.contains('open')) {
        _hideAll();
        clearTimeout(_collapseTimer);
      } else {
        _renderExpanded();
        if (state.running) _scheduleCollapse();
      }
    } else {
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
    /* CSS */
    var styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    /* HTML */
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    /* FAB */
    var fab = document.getElementById('exp-timer-fab');
    if (fab) fab.addEventListener('click', _onFabClick);

    /* Hover: mantém expanded + reinicia collapse */
    var widget = document.getElementById('exp-timer-widget');
    if (widget) {
      widget.addEventListener('mouseenter', function () {
        _isHovering = true;
        clearTimeout(_collapseTimer);
        var state = _loadState();
        if (state.running || state.originalStart) {
          var expandedEl = document.getElementById('exp-timer-expanded');
          var confirmEl  = document.getElementById('exp-timer-confirm');
          var anyOpen = (expandedEl && expandedEl.classList.contains('open')) ||
                        (confirmEl  && confirmEl.classList.contains('open'));
          if (!anyOpen) _renderExpanded();
        }
      });
      widget.addEventListener('mouseleave', function () {
        _isHovering = false;
        var state = _loadState();
        if (state.running) _scheduleCollapse();
      });
    }

    /* Click fora: fecha seleção */
    document.addEventListener('click', function (e) {
      var w = document.getElementById('exp-timer-widget');
      if (w && w.contains(e.target)) return;
      var selectEl = document.getElementById('exp-timer-select');
      if (selectEl && selectEl.classList.contains('open')) _hideAll();
    });

    /* Render inicial */
    _renderFab();

    /* Retoma tick se estava rodando ao navegar */
    var state = _loadState();
    if (state.running && state.startedAt) {
      _startTick();
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
