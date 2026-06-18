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
  var TIMER_KEY_PREFIX = TIMER_KEY + ':';
  var EXPAND_SECS = 15;

  /* Cores da plataforma */
  var OURO        = '#C49A27';
  var OURO_PULSE  = 'rgba(196,154,39,.55)';
  var GRAFITE     = '#141414';
  var CINZA       = '#D0CFC9';
  var OFF         = '#F7F6F3';
  var VERDE       = '#3E7858';

  var _sb, _tickInterval, _collapseTimer, _isHovering = false;
  var _allProds = null, _etapaCache = {}, _cachedUser = null, _recentItems = null;
  var _audioCtx = null;
  var _soundMuted       = localStorage.getItem('exp_tmr_sound_muted') === 'true';
  var _pushMuted        = localStorage.getItem('exp_tmr_push_muted')  === 'true';
  var _lastPushSentMark = 0;

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
    if (typeof window.isSocioRole === 'function') return window.isSocioRole(role);
    var normalized = (role || '').toLowerCase().trim();
    if (normalized === 'socio_adm') normalized = 'socio_admin';
    return ['socio','socio_admin'].indexOf(normalized) >= 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════════════════════ */
  var CSS = [
    /* Widget container */
    '#exp-timer-widget{position:fixed;bottom:24px;left:24px;z-index:9999;font-family:"Raleway",sans-serif;user-select:none}',

    /* FAB */
    '#exp-timer-fab{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.22);border:none;outline:none;position:relative;transition:background .25s,transform .15s;color:#888;flex-shrink:0}',
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
    '.tmr-btn-stop{background:' + CINZA + ';color:#555;border-color:#C0BFBA}',
    '.tmr-btn-stop:hover{background:#C0BFBA;border-color:#ABAAA5;color:#333;opacity:1}',

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
    '.tmr-input{width:100%;padding:4px 6px;border:1px solid ' + CINZA + ';border-radius:5px;font-family:"Raleway",sans-serif;font-size:10px;color:' + GRAFITE + ';background:#fff;box-sizing:border-box;outline:none;transition:border-color .15s}',
    '.tmr-input:focus{border-color:' + OURO + '}',
    '.tmr-textarea{width:100%;padding:5px 6px;border:1px solid ' + CINZA + ';border-radius:5px;font-family:"Raleway",sans-serif;font-size:10px;color:' + GRAFITE + ';background:#fff;resize:none;box-sizing:border-box;outline:none;height:48px;transition:border-color .15s}',
    '.tmr-textarea:focus{border-color:' + OURO + '}',

    /* ── Icon btns (som + push) ── */
    '.tmr-panel-top{display:flex;align-items:flex-start;gap:6px}',
    '.tmr-panel-top-hdr{font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#aaa;flex:1;min-width:0}',
    '.tmr-panel-top-btns{display:flex;gap:2px;flex-shrink:0}',
    '.tmr-icon-btn{background:none;border:none;padding:3px;cursor:pointer;color:#d0cfc9;line-height:1;border-radius:4px;transition:color .15s;display:flex;align-items:center}',
    '.tmr-icon-btn:hover{color:#888}',
    '.tmr-icon-btn.off{color:#c9a0a0}',

    /* ── Chips de sugestão de subtarefas ── */
    '.tmr-sub-chip{display:inline-flex;align-items:center;padding:3px 9px;border:1px solid ' + CINZA + ';border-radius:20px;background:' + OFF + ';font-family:"Raleway",sans-serif;font-size:9px;color:#666;cursor:pointer;transition:border-color .12s,color .12s,background .12s;white-space:nowrap;line-height:1.4}',
    '.tmr-sub-chip:hover{border-color:' + GRAFITE + ';color:' + GRAFITE + ';background:#EEECEA}',
    '[data-theme="dark"] .tmr-sub-chip{background:#141412;color:#888;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-sub-chip:hover{border-color:#C8C3BA;color:#F0EFEC;background:#2A2A28}',

    /* ── Confirm info view (clicável para editar) ── */
    '.tmr-cf-info-view{cursor:pointer;border-radius:5px;padding:2px 5px;margin:-2px -5px;transition:background .12s;position:relative}',
    '.tmr-cf-info-view:hover{background:' + OFF + '}',
    '.tmr-cf-info-view::after{content:"✎";position:absolute;top:2px;right:3px;font-size:8px;color:#ccc;line-height:1}',
    '.tmr-cf-info-view:hover::after{color:#999}',

    /* ── Toast ── */
    '#exp-timer-toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:' + GRAFITE + ';color:#fff;padding:8px 16px;border-radius:20px;font-size:11px;font-family:"Raleway",sans-serif;opacity:0;transition:opacity .25s;pointer-events:none;z-index:10002;white-space:nowrap}',

    /* ── Dark mode ─────────────────────────────────────────────────── */
    '[data-theme="dark"] #exp-timer-fab{background:#1C1C1A;color:#555}',
    '[data-theme="dark"] #exp-timer-fab.running{color:' + OURO + '}',
    '[data-theme="dark"] #exp-timer-fab.paused{color:' + OURO + '}',
    '[data-theme="dark"] .tmr-panel{background:#1C1C1A;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-hdr{color:#555}',
    '[data-theme="dark"] .tmr-panel-top-hdr{color:#555}',
    '[data-theme="dark"] .tmr-sel{background:#141412;color:#F0EFEC;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-sel-lbl{color:#555}',
    '[data-theme="dark"] .tmr-info-cli{color:#555}',
    '[data-theme="dark"] .tmr-info-opp{color:#F0EFEC}',
    '[data-theme="dark"] .tmr-info-prd{color:#999}',
    '[data-theme="dark"] .tmr-info-eta{color:#666}',
    '[data-theme="dark"] .tmr-elapsed{color:#F0EFEC}',
    '[data-theme="dark"] .tmr-btn{background:#1C1C1A;color:#777;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-btn:hover{border-color:#F0EFEC;color:#F0EFEC}',
    '[data-theme="dark"] .tmr-btn-stop{background:#2A2A28;color:#777;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-btn-stop:hover{background:#3E3E3C;border-color:#555;color:#ccc}',
    '[data-theme="dark"] .tmr-primary{background:#1C1C1A;color:#F0EFEC;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-primary:hover{border-color:' + OURO + ';background:' + OURO + ';color:#fff}',
    '[data-theme="dark"] .tmr-dark{background:#F0EFEC;color:#1C1C1A;border-color:#F0EFEC}',
    '[data-theme="dark"] .tmr-dark:hover{opacity:.85}',
    '[data-theme="dark"] .tmr-btn-cf-sec{background:#1C1C1A;color:#777;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-btn-cf-sec:hover{border-color:#F0EFEC;color:#F0EFEC}',
    '[data-theme="dark"] .tmr-lnk{color:#444}',
    '[data-theme="dark"] .tmr-lnk:hover{color:#999}',
    '[data-theme="dark"] .tmr-lnk.back{color:#555}',
    '[data-theme="dark"] .tmr-lnk.back:hover{color:#F0EFEC}',
    '[data-theme="dark"] .tmr-recent-btn{background:#141412;color:#999;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-recent-btn:hover{background:#2A2A28;border-color:#555;color:#F0EFEC}',
    '[data-theme="dark"] .tmr-divider{background:#3E3E3C}',
    '[data-theme="dark"] .tmr-input{background:#141412;color:#F0EFEC;border-color:#3E3E3C;color-scheme:dark}',
    '[data-theme="dark"] .tmr-input::placeholder{color:#444}',
    '[data-theme="dark"] .tmr-textarea{background:#141412;color:#F0EFEC;border-color:#3E3E3C}',
    '[data-theme="dark"] .tmr-textarea::placeholder{color:#444}',
    '[data-theme="dark"] .tmr-cf-info-view:hover{background:#2A2A28}',
    '[data-theme="dark"] .tmr-cf-info-view::after{color:#444}',
    '[data-theme="dark"] .tmr-cf-info-view:hover::after{color:#777}',
    '[data-theme="dark"] .tmr-icon-btn{color:#444}',
    '[data-theme="dark"] .tmr-icon-btn:hover{color:#999}',
    '[data-theme="dark"] .tmr-icon-btn.off{color:#7a4a4a}',
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
          '<div class="tmr-sel-lbl">Etapa</div>',
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
      '<div class="tmr-panel-top">',
        '<div class="tmr-info-wrap" style="flex:1;min-width:0">',
          '<div class="tmr-info-cli" id="tmr-info-cli"></div>',
          '<div class="tmr-info-opp" id="tmr-info-opp">&#8212;</div>',
          '<div class="tmr-info-prd" id="tmr-info-prd"></div>',
          '<div class="tmr-info-eta" id="tmr-info-eta"></div>',
        '</div>',
        '<div class="tmr-panel-top-btns" style="flex-shrink:0;align-self:flex-start">',
          '<button class="tmr-icon-btn" id="exp-tmr-sb" onclick="_tmr.toggleSound()" title="Silenciar tic-tac">',
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
          '</button>',
          '<button class="tmr-icon-btn" id="exp-tmr-pb" onclick="_tmr.togglePush()" title="Silenciar notificações push">',
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
          '</button>',
        '</div>',
      '</div>',
      '<div class="tmr-elapsed" id="tmr-elapsed">00:00</div>',
      '<div class="tmr-btns">',
        '<button class="tmr-btn" id="tmr-pause-btn" onclick="_tmr.togglePause()">&#9646;&#9646; Pausar</button>',
        '<button class="tmr-btn tmr-btn-stop" onclick="_tmr.openConfirm()">&#9646; Encerrar</button>',
      '</div>',
    '</div>',

    /* ── Painel de confirmação ── */
    '<div id="exp-timer-confirm" class="tmr-panel">',
      '<div class="tmr-panel-top">',
        '<span class="tmr-panel-top-hdr">Confirmar lan&#231;amento</span>',
        '<div class="tmr-panel-top-btns">',
          '<button class="tmr-icon-btn" id="exp-tmr-sb-cf" onclick="_tmr.toggleSound()" title="Silenciar tic-tac">',
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
          '</button>',
          '<button class="tmr-icon-btn" id="exp-tmr-pb-cf" onclick="_tmr.togglePush()" title="Silenciar notificações push">',
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
          '</button>',
        '</div>',
      '</div>',
      /* Modo exibição (clicável para editar) */
      '<div class="tmr-info-wrap tmr-cf-info-view" id="tmr-cf-view" onclick="_tmr.openCfEdit()" title="Clique para alterar projeto ou categoria">',
        '<div class="tmr-info-cli" id="tmr-cf-cli"></div>',
        '<div class="tmr-info-opp" id="tmr-cf-opp">&#8212;</div>',
        '<div class="tmr-info-prd" id="tmr-cf-prd"></div>',
        '<div class="tmr-info-eta" id="tmr-cf-eta"></div>',
      '</div>',
      /* Modo edição inline (inicialmente oculto) */
      '<div id="tmr-cf-edit" style="display:none;flex-direction:column;gap:4px">',
        '<div>',
          '<div class="tmr-sel-lbl">Tipo</div>',
          '<select class="tmr-sel" id="tmr-cfe-tipo" onchange="_tmr.changeTipoCfe()">',
            '<option value="projeto">Projeto</option>',
            '<option value="organizacao">Org. Interna</option>',
          '</select>',
        '</div>',
        '<div id="tmr-cfe-sub-block" style="display:none">',
          '<div class="tmr-sel-lbl">Categoria</div>',
          '<select class="tmr-sel" id="tmr-cfe-sub"></select>',
        '</div>',
        '<div id="tmr-cfe-proj-block">',
          '<div>',
            '<div class="tmr-sel-lbl">Cliente</div>',
            '<select class="tmr-sel" id="tmr-cfe-cli" onchange="_tmr.changeCliCfe()">',
              '<option value="">Carregando&#8230;</option>',
            '</select>',
          '</div>',
          '<div id="tmr-cfe-opp-block" style="display:none">',
            '<div class="tmr-sel-lbl">Projeto / oportunidade</div>',
            '<select class="tmr-sel" id="tmr-cfe-opp" onchange="_tmr.changeOppCfe()">',
              '<option value="">&#8212; selecionar &#8212;</option>',
            '</select>',
          '</div>',
          '<div id="tmr-cfe-prod-block" style="display:none">',
            '<div class="tmr-sel-lbl">Produto</div>',
            '<select class="tmr-sel" id="tmr-cfe-prod" onchange="_tmr.changeProdCfe()">',
              '<option value="">&#8212; selecionar &#8212;</option>',
            '</select>',
          '</div>',
          '<div id="tmr-cfe-etapa-block" style="display:none">',
            '<div class="tmr-sel-lbl">Etapa <span style="font-weight:400;text-transform:none">(opcional)</span></div>',
            '<select class="tmr-sel" id="tmr-cfe-etapa">',
              '<option value="">&#8212; selecionar &#8212;</option>',
            '</select>',
          '</div>',
        '</div>',
        '<div class="tmr-row" style="margin-top:2px">',
          '<button class="tmr-btn-cf-sec" onclick="_tmr.applyCfEdit()" style="flex:0 0 auto;padding:4px 10px">&#10003; Ok</button>',
          '<button class="tmr-btn-cf-sec" onclick="_tmr.cancelCfEdit()">Cancelar</button>',
        '</div>',
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
      '<div id="tmr-cf-subtarefas-wrap">',
        '<div class="tmr-sel-lbl">Subtarefas <span style="font-weight:400;text-transform:none;font-size:7px">(opcional)</span></div>',
        '<input type="text" class="tmr-input" id="tmr-cf-subtarefas" placeholder="Ex: lan&#231;amento, montagem&#8230;">',
        '<div id="tmr-cf-subtarefas-sugestoes" style="display:none;gap:5px;flex-wrap:wrap;margin-top:5px"></div>',
      '</div>',
      '<div>',
        '<div class="tmr-sel-lbl">Descri&#231;&#227;o <span style="font-weight:400;text-transform:none;font-size:7px">(opcional)</span></div>',
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
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
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
  function _stateKeyForUser(userId) { return userId ? (TIMER_KEY_PREFIX + userId) : null; }
  function _readStoredState(key) {
    if (!key) return {};
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (e) { return {}; }
  }
  function _migrateLegacyState(userId) {
    if (!userId) return;
    var scopedKey = _stateKeyForUser(userId);
    var scopedState = _readStoredState(scopedKey);
    if (scopedState && scopedState.originalStart) {
      localStorage.removeItem(TIMER_KEY);
      return;
    }
    var legacyState = _readStoredState(TIMER_KEY);
    if (!legacyState || !legacyState.originalStart) return;
    if (legacyState.ownerId && legacyState.ownerId !== userId) return;
    legacyState.ownerId = userId;
    localStorage.setItem(scopedKey, JSON.stringify(legacyState));
    localStorage.removeItem(TIMER_KEY);
  }
  function _currentStateKey() {
    return _cachedUser && _cachedUser.id ? _stateKeyForUser(_cachedUser.id) : null;
  }
  function _loadState() { return _readStoredState(_currentStateKey()); }
  function _saveState(s) {
    var key = _currentStateKey();
    if (!key) return;
    if (_cachedUser && _cachedUser.id) s.ownerId = _cachedUser.id;
    localStorage.setItem(key, JSON.stringify(s));
  }
  function _clearState() {
    var key = _currentStateKey();
    if (key) localStorage.removeItem(key);
  }

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
  function _escHtml(s) {
    if (s == null || s === '') return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _isTimeRangeValid(ini, fim) { return !!ini && !!fim && ini < fim; }
  function _parseSubtarefas(raw) {
    var seen = {};
    return String(raw || '')
      .split(/[\n,;]+/g)
      .map(function (item) { return item.trim(); })
      .filter(Boolean)
      .filter(function (item) {
        var key = item.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }
  function _splitSubtarefasHoras(totalHoras, items) {
    var totalMin = Math.round((Number(totalHoras) || 0) * 60);
    if (!items.length || totalMin <= 0) return [];
    var baseMin = Math.floor(totalMin / items.length);
    var rest = totalMin - (baseMin * items.length);
    return items.map(function (item, idx) {
      var mins = baseMin + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
      return {
        subtarefa: item,
        ordem: idx + 1,
        horas_alocadas: Number((mins / 60).toFixed(2))
      };
    });
  }
  function _isSubtarefasTableMissing(error) {
    var msg = String((error && error.message) || '').toLowerCase();
    return !!error && (error.code === '42P01' || msg.indexOf('horas_lancadas_subtarefas') >= 0 || msg.indexOf('does not exist') >= 0);
  }
  async function _saveTimerSubtarefas(client, hourId, raw, totalHoras, ctx) {
    if (!client || !hourId) return true;
    ctx = ctx || {};
    var items = _parseSubtarefas(raw);
    var delRes = await client.from('horas_lancadas_subtarefas').delete().eq('hora_lancada_id', String(hourId));
    if (delRes.error) {
      if (_isSubtarefasTableMissing(delRes.error)) {
        if (!_saveTimerSubtarefas._warned) {
          _saveTimerSubtarefas._warned = true;
          _toast('Subtarefas ainda indisponiveis: execute o SQL do DEV-21.');
        }
        return false;
      }
      throw delRes.error;
    }
    _loadTimerSubtarefasSuggestions._cache = {};
    if (!items.length) return true;
    var rows = _splitSubtarefasHoras(totalHoras, items).map(function (item) {
      return {
        hora_lancada_id: String(hourId),
        subtarefa: item.subtarefa,
        horas_alocadas: item.horas_alocadas,
        ordem: item.ordem,
        usuario_id: ctx.userId || null,
        produto_id: ctx.produtoId || null,
        etapa_id: ctx.etapaId || null,
        data_lancamento: ctx.dataISO || null
      };
    });
    var insRes = await client.from('horas_lancadas_subtarefas').insert(rows);
    if (insRes.error) {
      if (_isSubtarefasTableMissing(insRes.error)) {
        if (!_saveTimerSubtarefas._warned) {
          _saveTimerSubtarefas._warned = true;
          _toast('Subtarefas ainda indisponiveis: execute o SQL do DEV-21.');
        }
        return false;
      }
      throw insRes.error;
    }
    _loadTimerSubtarefasSuggestions._cache = {};
    return true;
  }
  async function _loadTimerSubtarefasSuggestions(client, ctx) {
    ctx = ctx || {};
    var produtoId = ctx.produtoId || null;
    var etapaId = ctx.etapaId || null;
    if (!produtoId && !etapaId) return [];
    _loadTimerSubtarefasSuggestions._cache = _loadTimerSubtarefasSuggestions._cache || {};
    var cacheKey = (etapaId || 'sem-etapa') + '|' + (produtoId || 'sem-produto');
    if (_loadTimerSubtarefasSuggestions._cache[cacheKey]) return _loadTimerSubtarefasSuggestions._cache[cacheKey];
    function mergeRows(rows, base) {
      var seen = {};
      base.forEach(function (item) { seen[_trunc(item, 300).toLowerCase()] = true; });
      (rows || []).forEach(function (row) {
        var nome = String((row && row.subtarefa) || '').trim();
        var key = nome.toLowerCase();
        if (!nome || seen[key]) return;
        seen[key] = true;
        base.push(nome);
      });
      return base;
    }
    async function pull(query) {
      var res = await query;
      if (res.error) {
        if (_isSubtarefasTableMissing(res.error)) return [];
        throw res.error;
      }
      return res.data || [];
    }
    var sugestoes = [];
    if (etapaId) {
      sugestoes = mergeRows(await pull(
        client.from('horas_lancadas_subtarefas')
          .select('subtarefa,created_at')
          .eq('etapa_id', etapaId)
          .order('created_at', { ascending: false })
          .limit(20)
      ), sugestoes);
    }
    if (produtoId && sugestoes.length < 8) {
      sugestoes = mergeRows(await pull(
        client.from('horas_lancadas_subtarefas')
          .select('subtarefa,created_at')
          .eq('produto_id', produtoId)
          .order('created_at', { ascending: false })
          .limit(20)
      ), sugestoes);
    }
    _loadTimerSubtarefasSuggestions._cache[cacheKey] = sugestoes.slice(0, 12);
    return _loadTimerSubtarefasSuggestions._cache[cacheKey];
  }
  function _applyTimerSubtarefasSuggestion(sugestao) {
    var input = document.getElementById('tmr-cf-subtarefas');
    if (!input) return;
    var raw = input.value || '';
    var match = raw.match(/^(.*?)([^,;\n]*)$/);
    var prefix = match ? match[1] : '';
    input.value = prefix + sugestao + ', ';
    input.focus();
  }
  async function _renderTimerSubtarefasSuggestions() {
    var wrap = document.getElementById('tmr-cf-subtarefas-sugestoes');
    var input = document.getElementById('tmr-cf-subtarefas');
    var state = _loadState();
    if (!wrap || !input || (state.tipo || 'projeto') !== 'projeto' || !state.produtoId) {
      if (wrap) { wrap.innerHTML = ''; wrap.style.display = 'none'; }
      return;
    }
    var client = _getSb();
    if (!client) return;
    var sugestoes = [];
    try {
      sugestoes = await _loadTimerSubtarefasSuggestions(client, { produtoId: state.produtoId, etapaId: state.etapaId || null });
    } catch (e) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    var termoAtual = String((input.value || '').split(/[,;\n]/).pop() || '').trim().toLowerCase();
    var usadas = {};
    _parseSubtarefas(input.value).forEach(function (item) { usadas[item.toLowerCase()] = true; });
    sugestoes = sugestoes.filter(function (item) { return !usadas[item.toLowerCase()]; });
    if (termoAtual) sugestoes = sugestoes.filter(function (item) { return item.toLowerCase().indexOf(termoAtual) >= 0; });
    sugestoes = sugestoes.slice(0, 8);
    if (!sugestoes.length) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'flex';
    wrap.innerHTML = sugestoes.map(function (item) {
      return '<button type="button" class="tmr-sub-chip" onclick="_tmr.applySubtarefa(' + JSON.stringify(item).replace(/"/g, '&quot;') + ')">' + _escHtml(item) + '</button>';
    }).join('');
  }
  function _getIsoWeekInfo(dateObj) {
    var target = new Date(dateObj);
    target.setHours(12, 0, 0, 0);
    var isoDia = target.getDay() || 7;
    var weekIni = new Date(target);
    weekIni.setDate(target.getDate() - isoDia + 1);
    var weekFim = new Date(weekIni);
    weekFim.setDate(weekIni.getDate() + 6);
    var weekThursday = new Date(weekIni);
    weekThursday.setDate(weekIni.getDate() + 3);
    var isoYear = weekThursday.getFullYear();
    var jan4 = new Date(isoYear, 0, 4, 12, 0, 0, 0);
    var jan4IsoDay = jan4.getDay() || 7;
    var week1Start = new Date(jan4);
    week1Start.setDate(jan4.getDate() - jan4IsoDay + 1);
    var weekNum = Math.floor((weekIni - week1Start) / (7 * 24 * 3600 * 1000)) + 1;
    return { isoDay: isoDia, year: isoYear, week: weekNum, start: weekIni, end: weekFim };
  }

  /* ═══════════════════════════════════════════════════════════════
     Supabase
  ═══════════════════════════════════════════════════════════════ */
  function _getSb() {
    if (_sb) return _sb;
    if (window.sb) { _sb = window.sb; return _sb; }
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
      _migrateLegacyState(_cachedUser.id);
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
      if (_cachedUser && _cachedUser.id) _migrateLegacyState(_cachedUser.id);
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
    var BURST_DURATION_MS = 6 * 1000;        // durante 6 segundos (3 tic-tac)
    /* Semeia com a marca atual para não disparar push ao recarregar/retomar no
       meio de um intervalo — só ao cruzar a próxima marca de 20 min. */
    _lastPushSentMark = Math.floor(_elapsedMs(_loadState()) / BURST_INTERVAL_MS);
    _tickInterval = setInterval(function () {
      var state = _loadState();
      if (!state.running) { clearInterval(_tickInterval); return; }
      var ms = _elapsedMs(state);
      var el = document.getElementById('tmr-elapsed');
      if (el) el.textContent = _fmtMs(ms);
      // Tic-tac + push a cada 20 min
      if (ms > 0) {
        var markNumber     = Math.floor(ms / BURST_INTERVAL_MS);
        var msIntoInterval = ms % BURST_INTERVAL_MS;
        // Som: primeiros 4s de cada marca
        if (msIntoInterval < BURST_DURATION_MS && !_soundMuted) {
          var beatIdx = Math.floor(msIntoInterval / 1000);
          _playTick(beatIdx % 2 === 1); // tic, tac, tic, tac
        }
        // Push: uma vez por marca. Dispara ao cruzar para uma marca nova em vez
        // de exigir os primeiros 5s — em aba de segundo plano o setInterval é
        // estrangulado (~1 tick/min) e a janela curta seria perdida.
        if (markNumber > 0 && markNumber > _lastPushSentMark) {
          _lastPushSentMark = markNumber;
          if (!_pushMuted) _sendTimerPush(state);
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
        return p.status === 'ativo' && p.em_gestao === true;
      });
    }
    /* ── cache próprio ── */
    if (_allProds) return _allProds;
    var client = _getSb();
    if (!client) return [];
    var res = await client
      .from('produtos')
      .select('id, nome, subtipo, oportunidade_id, oportunidades(id, projeto, cidade, uf, clientes(id, nome, cidade, uf))')
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
        .filter(function (et) { return String(et.produto_id) === String(prodId); })
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
      if (String(cli.id) === String(cliId) && opp.id && !map[opp.id]) {
        var label = _trunc(opp.projeto || '(sem nome)', 36);
        if (opp.cidade) label += ' · ' + opp.cidade + (opp.uf ? '/' + opp.uf : '');
        map[opp.id] = { id: opp.id, label: label };
      }
    });
    return Object.values(map);
  }

  /* ── Produtos por oportunidade ── */
  function _getProdsByOpp(prods, oppId) {
    return prods.filter(function (p) { return String(p.oportunidade_id) === String(oppId); })
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
        if (r.tipo === 'projeto' && (!r.produto_id || !r.etapa_id)) return;
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
      return '<button class="tmr-recent-btn" onclick="_tmr.useRecent(' + i + ')">&#128337; ' + _escHtml(item.label) + '</button>';
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
        clis.map(function (c) { return '<option value="' + c.id + '">' + _escHtml(c.label) + '</option>'; }).join('');
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
          opps.map(function (o) { return '<option value="' + o.id + '">' + _escHtml(o.label) + '</option>'; }).join('');
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
          ps.map(function (p) { return '<option value="' + p.id + '">' + _escHtml(p.label) + '</option>'; }).join('');
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
          etapas.map(function (e) { return '<option value="' + e.id + '">' + _escHtml(_trunc(e.nome, 36)) + '</option>'; }).join('');
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
        var prod    = prods.find(function (p) { return String(p.id) === String(item.produtoId); });
        var opp     = prod && prod.oportunidades;
        var cli     = opp && opp.clientes;
        nomeCliente = cli  ? (cli.nome  || '') : '';
        nomeOpp     = opp  ? (opp.projeto || '') : '';
        nomeProduto = prod ? (prod.nome || prod.subtipo || '') : '';
        nomeProjeto = nomeOpp || nomeProduto;

        if (item.etapaId) {
          var ets = await _getEtapas(item.produtoId);
          var et  = ets.find(function (e) { return String(e.id) === String(item.etapaId); });
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
        /* Projeto: precisa pelo menos produto e etapa */
        var selProd  = document.getElementById('tmr-sel-prod');
        var selEtapa = document.getElementById('tmr-sel-etapa');
        var selOpp   = document.getElementById('tmr-sel-opp');
        var selCli   = document.getElementById('tmr-sel-cli');

        produtoId = selProd  ? (selProd.value  || null) : null;
        etapaId   = selEtapa ? (selEtapa.value || null) : null;

        if (!selCli || !selCli.value) { _toast('Selecione o cliente'); return; }
        if (!selOpp || !selOpp.value) { _toast('Selecione o projeto / oportunidade'); return; }
        if (!produtoId)               { _toast('Selecione o produto'); return; }
        if (!etapaId)                 { _toast('Selecione a etapa'); return; }

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
      var cfView = document.getElementById('tmr-cf-view');
      var cfEdit = document.getElementById('tmr-cf-edit');
      if (cfView) cfView.style.display = '';
      if (cfEdit) cfEdit.style.display = 'none';
      /* Lembra se estava rodando para o "Voltar" só retomar nesse caso —
         uma pausa manual anterior ao Encerrar deve ser preservada. */
      state._resumeOnBack = !!state.running;
      /* Congela tempo */
      if (state.running && state.startedAt) {
        var elapsed    = Date.now() - new Date(state.startedAt).getTime();
        state.pausedMs  = (state.pausedMs || 0) + elapsed;
        state.running   = false;
        state.startedAt = null;
        state.pausedAt  = new Date().toISOString();
      }
      _saveState(state);
      _renderFab();
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
      setVal('tmr-cf-subtarefas', '');
      var subtWrap = document.getElementById('tmr-cf-subtarefas-wrap');
      if (subtWrap) subtWrap.style.display = ((state.tipo || 'projeto') === 'projeto') ? '' : 'none';
      var subtInput = document.getElementById('tmr-cf-subtarefas');
      if (subtInput) {
        subtInput.oninput = function () { _renderTimerSubtarefasSuggestions().catch(function () {}); };
        subtInput.onfocus = function () { _renderTimerSubtarefasSuggestions().catch(function () {}); };
      }
      var btn = document.getElementById('tmr-save-btn');
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
      _renderTimerSubtarefasSuggestions().catch(function () {});
      _showPanel('confirm');
    },

    /* ── Volta ao expanded ── */
    backToExpanded: function () {
      var state = _loadState();
      if (!state.originalStart) return;
      /* Só retoma se estava rodando ao abrir o confirm; se o usuário havia
         pausado manualmente, mantém pausado. */
      var resume = state._resumeOnBack !== false;
      delete state._resumeOnBack;
      if (resume && !state.running) {
        state.running   = true;
        state.startedAt = new Date().toISOString();
        state.pausedAt  = null;
        _saveState(state);
        _renderFab();
        _startTick();
        _scheduleCollapse();
      } else {
        _saveState(state);
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
      var subtarefas = ((document.getElementById('tmr-cf-subtarefas') || {}).value || '').trim();

      if (!dataISO || !ini || !fim) {
        _toast('Preencha data, início e fim');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }
      if (!_isTimeRangeValid(ini, fim)) {
        _toast('Hora fim deve ser maior que início');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }
      if ((state.tipo || 'projeto') === 'projeto' && !state.produtoId) {
        _toast('Selecione o produto');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }
      if ((state.tipo || 'projeto') === 'projeto' && !state.etapaId) {
        _toast('Selecione a etapa');
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
      var weekInfo = _getIsoWeekInfo(dateObj);
      var isoDia  = weekInfo.isoDay;
      var weekIni = _fmtDate(weekInfo.start);
      var weekFim = _fmtDate(weekInfo.end);

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
          .upsert({ usuario_id: user.id, ano: weekInfo.year, semana: weekInfo.week, data_inicio: weekIni, data_fim: weekFim, finalizada: false }, { onConflict: 'usuario_id,ano,semana' })
          .select().single();
        if (scRes.error) {
          _toast('Erro na semana: ' + scRes.error.message);
          if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
          return;
        }
        semDb = scRes.data;
      }

      var dupQuery = client.from('horas_lancadas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('data_lancamento', dataISO)
        .eq('hora_inicio', ini)
        .eq('hora_fim', fim)
        .eq('tipo', state.tipo || 'projeto');
      dupQuery = state.subtipo ? dupQuery.eq('subtipo', state.subtipo) : dupQuery.is('subtipo', null);
      dupQuery = state.produtoId ? dupQuery.eq('produto_id', state.produtoId) : dupQuery.is('produto_id', null);
      dupQuery = state.etapaId ? dupQuery.eq('etapa_id', state.etapaId) : dupQuery.is('etapa_id', null);
      var dupRes = await dupQuery.limit(1);
      if (dupRes.data && dupRes.data.length) {
        _toast('Já existe um lançamento idêntico neste horário');
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
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
      }).select('id').single();

      if (lancRes.error) {
        _toast('Erro: ' + lancRes.error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar lançamento'; }
        return;
      }

      var subtarefasOk = true;
      try {
        subtarefasOk = await _saveTimerSubtarefas(client, lancRes.data && lancRes.data.id, subtarefas, (new Date('2000-01-01T' + fim + ':00') - new Date('2000-01-01T' + ini + ':00')) / 3600000, {
          userId: user.id,
          produtoId: state.produtoId || null,
          etapaId: state.etapaId || null,
          dataISO: dataISO
        });
      } catch (subError) {
        _toast('Horas salvas, mas subtarefas falharam: ' + subError.message);
      }

      /* Sucesso */
      _clearState();
      _recentItems = null;  // invalida cache de recentes
      _hideAll();
      _renderFab();
      _toast(subtarefasOk ? 'Horas registradas ✓' : 'Horas registradas, mas subtarefas ainda nao estao disponiveis');
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

    /* ── Edição inline do projeto no confirm ── */
    openCfEdit: async function () {
      var view = document.getElementById('tmr-cf-view');
      var edit = document.getElementById('tmr-cf-edit');
      if (!view || !edit) return;
      view.style.display = 'none';
      edit.style.display = 'flex';

      try {
        var state = _loadState();
        var tipo  = state.tipo || 'projeto';

        /* Tipo select */
        var tipoSel = document.getElementById('tmr-cfe-tipo');
        if (tipoSel) {
          await _getUser();
          if (_isSocio() && !tipoSel.querySelector('option[value="sociedade"]')) {
            var opt = document.createElement('option');
            opt.value = 'sociedade'; opt.textContent = 'Sociedade';
            tipoSel.appendChild(opt);
          }
          tipoSel.value = tipo;
        }

        var subBlock  = document.getElementById('tmr-cfe-sub-block');
        var projBlock = document.getElementById('tmr-cfe-proj-block');

        if (tipo !== 'projeto') {
          if (subBlock)  subBlock.style.display  = '';
          if (projBlock) projBlock.style.display = 'none';
          var subSel = document.getElementById('tmr-cfe-sub');
          if (subSel) {
            var opts = SUBTIPOS[tipo] || [];
            subSel.innerHTML = opts.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
            if (state.subtipo) subSel.value = state.subtipo;
          }
          return;
        }

        if (subBlock)  subBlock.style.display  = 'none';
        if (projBlock) projBlock.style.display = '';

        var prods    = await _getActiveProds();
        var curProd  = state.produtoId ? prods.find(function (p) { return String(p.id) === String(state.produtoId); }) : null;
        var curOpp   = curProd ? curProd.oportunidades : null;
        var curCli   = curOpp ? curOpp.clientes : null;
        var curCliId = curCli ? String(curCli.id) : '';
        var curOppId = curOpp ? String(curOpp.id) : '';
        var curProdId = state.produtoId ? String(state.produtoId) : '';
        var curEtapaId = state.etapaId ? String(state.etapaId) : '';

        await _tmr._loadClientesCfe();

        var selCli = document.getElementById('tmr-cfe-cli');
        if (selCli && curCliId) {
          selCli.value = curCliId;
          if (selCli.value) await _tmr.changeCliCfe();
        }

        var selOpp = document.getElementById('tmr-cfe-opp');
        if (selOpp && curOppId) {
          selOpp.value = curOppId;
          if (selOpp.value) await _tmr.changeOppCfe();
        }

        var selProd = document.getElementById('tmr-cfe-prod');
        if (selProd && curProdId) {
          selProd.value = curProdId;
          if (selProd.value) await _tmr.changeProdCfe();
        }

        var selEtapa = document.getElementById('tmr-cfe-etapa');
        if (selEtapa && curEtapaId) selEtapa.value = curEtapaId;
      } catch (e) {
        console.warn('[EXP Timer] openCfEdit', e);
        _toast('Não foi possível carregar os campos para edição');
        _tmr.cancelCfEdit();
      }
    },

    cancelCfEdit: function () {
      var view = document.getElementById('tmr-cf-view');
      var edit = document.getElementById('tmr-cf-edit');
      if (view) view.style.display = '';
      if (edit) edit.style.display = 'none';
    },

    applyCfEdit: async function () {
      var tipoSel = document.getElementById('tmr-cfe-tipo');
      var tipo    = tipoSel ? tipoSel.value : 'projeto';
      var state   = _loadState();

      if (tipo !== 'projeto') {
        var subSel  = document.getElementById('tmr-cfe-sub');
        var subtipo = subSel ? (subSel.value || null) : null;
        var tipoLabel = tipo === 'organizacao' ? 'Org. Interna' : 'Sociedade';
        state.tipo       = tipo;
        state.subtipo    = subtipo;
        state.produtoId  = null;
        state.etapaId    = null;
        state.nomeCliente  = '';
        state.nomeOpp    = tipoLabel;
        state.nomeProduto  = '';
        state.nomeProjeto  = tipoLabel + (subtipo ? ' · ' + subtipo : '');
        state.nomeEtapa  = subtipo || '';
      } else {
        var selCli   = document.getElementById('tmr-cfe-cli');
        var selOpp   = document.getElementById('tmr-cfe-opp');
        var selProd  = document.getElementById('tmr-cfe-prod');
        var selEtapa = document.getElementById('tmr-cfe-etapa');
        var produtoId = selProd  ? (selProd.value  || null) : null;
        var etapaId   = selEtapa ? (selEtapa.value || null) : null;
        if (!selCli || !selCli.value)  { _toast('Selecione o cliente'); return; }
        if (!selOpp || !selOpp.value)  { _toast('Selecione o projeto / oportunidade'); return; }
        if (!produtoId)                { _toast('Selecione o produto'); return; }
        if (!etapaId)                  { _toast('Selecione a etapa'); return; }
        var cliTxt  = selCli.options[selCli.selectedIndex].text;
        var oppTxt  = selOpp.options[selOpp.selectedIndex].text;
        var prodTxt = selProd.options[selProd.selectedIndex].text;
        var etaTxt  = (etapaId && selEtapa) ? selEtapa.options[selEtapa.selectedIndex].text : '';
        state.tipo       = 'projeto';
        state.subtipo    = null;
        state.produtoId  = produtoId;
        state.etapaId    = etapaId;
        state.nomeCliente  = cliTxt.split(' · ')[0];
        state.nomeOpp    = oppTxt;
        state.nomeProduto  = (prodTxt !== oppTxt) ? prodTxt : '';
        state.nomeProjeto  = oppTxt;
        state.nomeEtapa  = etaTxt;
      }

      _saveState(state);

      /* Atualiza textos no confirm */
      var _ctxt = function (id, v) { var el = document.getElementById(id); if (el) { el.textContent = v || ''; el.style.display = v ? '' : 'none'; } };
      _ctxt('tmr-cf-cli', state.nomeCliente || '');
      _ctxt('tmr-cf-opp', state.nomeOpp || state.nomeProjeto || '—');
      _ctxt('tmr-cf-prd', state.nomeProduto || '');
      _ctxt('tmr-cf-eta', state.nomeEtapa || state.subtipo || '');
      /* Atualiza textos no painel expanded também */
      _ctxt('tmr-info-cli', state.nomeCliente || '');
      _ctxt('tmr-info-opp', state.nomeOpp || state.nomeProjeto || '—');
      _ctxt('tmr-info-prd', state.nomeProduto || '');
      _ctxt('tmr-info-eta', state.nomeEtapa || '');
      _renderTimerSubtarefasSuggestions().catch(function () {});

      _tmr.cancelCfEdit();
    },

    /* ── Cascata de selects no modo edição do confirm ── */
    changeTipoCfe: function () {
      var tipo      = (document.getElementById('tmr-cfe-tipo') || {}).value || 'projeto';
      var subBlock  = document.getElementById('tmr-cfe-sub-block');
      var projBlock = document.getElementById('tmr-cfe-proj-block');
      var subSel    = document.getElementById('tmr-cfe-sub');
      if (tipo !== 'projeto') {
        if (subBlock)  subBlock.style.display  = '';
        if (projBlock) projBlock.style.display = 'none';
        if (subSel) {
          var opts = SUBTIPOS[tipo] || [];
          subSel.innerHTML = opts.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
        }
      } else {
        if (subBlock)  subBlock.style.display  = 'none';
        if (projBlock) projBlock.style.display = '';
        _tmr._loadClientesCfe();
      }
    },

    _loadClientesCfe: async function () {
      var selCli = document.getElementById('tmr-cfe-cli');
      if (!selCli) return;
      selCli.innerHTML = '<option value="">Carregando&#8230;</option>';
      var prods = await _getActiveProds();
      var clis  = _getClientes(prods);
      selCli.innerHTML = '<option value="">&#8212; selecionar cliente &#8212;</option>' +
        clis.map(function (c) { return '<option value="' + c.id + '">' + _escHtml(c.label) + '</option>'; }).join('');
      ['tmr-cfe-opp-block','tmr-cfe-prod-block','tmr-cfe-etapa-block'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.style.display = 'none';
      });
    },

    changeCliCfe: async function () {
      var cliId      = (document.getElementById('tmr-cfe-cli')  || {}).value || '';
      var oppBlock   = document.getElementById('tmr-cfe-opp-block');
      var prodBlock  = document.getElementById('tmr-cfe-prod-block');
      var etapaBlock = document.getElementById('tmr-cfe-etapa-block');
      if (oppBlock)   oppBlock.style.display   = 'none';
      if (prodBlock)  prodBlock.style.display  = 'none';
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!cliId) return;
      var prods  = await _getActiveProds();
      var opps   = _getOpps(prods, cliId);
      var selOpp = document.getElementById('tmr-cfe-opp');
      if (selOpp) {
        selOpp.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          opps.map(function (o) { return '<option value="' + o.id + '">' + _escHtml(o.label) + '</option>'; }).join('');
      }
      if (oppBlock) oppBlock.style.display = '';
    },

    changeOppCfe: async function () {
      var oppId      = (document.getElementById('tmr-cfe-opp')  || {}).value || '';
      var prodBlock  = document.getElementById('tmr-cfe-prod-block');
      var etapaBlock = document.getElementById('tmr-cfe-etapa-block');
      if (prodBlock)  prodBlock.style.display  = 'none';
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!oppId) return;
      var prods   = await _getActiveProds();
      var ps      = _getProdsByOpp(prods, oppId);
      var selProd = document.getElementById('tmr-cfe-prod');
      if (selProd) {
        selProd.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          ps.map(function (p) { return '<option value="' + p.id + '">' + _escHtml(p.label) + '</option>'; }).join('');
      }
      if (prodBlock) prodBlock.style.display = '';
      if (ps.length === 1 && selProd) { selProd.value = ps[0].id; _tmr.changeProdCfe(); }
    },

    changeProdCfe: async function () {
      var prodId     = (document.getElementById('tmr-cfe-prod') || {}).value || '';
      var etapaBlock = document.getElementById('tmr-cfe-etapa-block');
      if (etapaBlock) etapaBlock.style.display = 'none';
      if (!prodId) return;
      var etapas   = await _getEtapas(prodId);
      var selEtapa = document.getElementById('tmr-cfe-etapa');
      if (selEtapa) {
        selEtapa.innerHTML = '<option value="">&#8212; selecionar &#8212;</option>' +
          etapas.map(function (e) { return '<option value="' + e.id + '">' + _escHtml(_trunc(e.nome, 36)) + '</option>'; }).join('');
      }
      if (etapaBlock && etapas.length) etapaBlock.style.display = '';
    },

    /* ── Clique num chip de subtarefa sugerida ── */
    applySubtarefa: function (sugestao) {
      _applyTimerSubtarefasSuggestion(sugestao);
      _renderTimerSubtarefasSuggestions().catch(function () {});
    },

    /* ── Toggles de alerta ── */
    toggleSound: function () {
      _soundMuted = !_soundMuted;
      localStorage.setItem('exp_tmr_sound_muted', String(_soundMuted));
      _updateAlertBtns();
    },
    togglePush: function () {
      _pushMuted = !_pushMuted;
      localStorage.setItem('exp_tmr_push_muted', String(_pushMuted));
      _updateAlertBtns();
    },
  };

  /* ── Atualiza visual dos botões de alerta ── */
  function _updateAlertBtns() {
    var icoSoundOn  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    var icoSoundOff = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    var icoPushOn   = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
    var icoPushOff  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    [['exp-tmr-sb', true], ['exp-tmr-sb-cf', true], ['exp-tmr-pb', false], ['exp-tmr-pb-cf', false]].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var isSound = pair[1];
      var muted   = isSound ? _soundMuted : _pushMuted;
      el.innerHTML = isSound ? (muted ? icoSoundOff : icoSoundOn) : (muted ? icoPushOff : icoPushOn);
      el.classList.toggle('off', muted);
      el.title = muted
        ? (isSound ? 'Ativar som tic-tac' : 'Ativar notificações de lembrete')
        : (isSound ? 'Silenciar som tic-tac' : 'Silenciar notificações de lembrete');
    });
  }

  /* ── Envia push de lembrete a cada 20 min ── */
  async function _sendTimerPush(state) {
    var usr = await _getUser();
    if (!usr || !usr.id) return;
    var client = _getSb();
    if (!client) return;
    var opp = state.nomeOpp || state.nomeProjeto || 'entrada ativa';
    client.functions.invoke('send-push', {
      body: {
        usuario_id: usr.id,
        title:      '⏱ Timer ativo',
        body:       'Você ainda está trabalhando em ' + opp + '?',
        url:        window.location.href,
        tag:        'exp-timer-reminder',
      }
    }).catch(function (e) { console.warn('[EXP Timer Push]', e); });
  }

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
  async function _init() {
    await _getUser();

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

    /* Aplica estado salvo dos botões de alerta */
    _updateAlertBtns();

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
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
