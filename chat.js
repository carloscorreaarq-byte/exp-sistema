/* ═══════════════════════════════════════════════════════════════════
   EXP · CHAT WIDGET — chat.js  v2.0
   Fase 2: #geral · DMs · status redesign · som · links
   ─────────────────────────────────────────────────────────────────
   Incluir <script src="chat.js"></script> antes de </body>
   em todos os módulos. Requer @supabase/supabase-js@2 já carregado.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */
  var SB_URL     = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var STATUS_KEY = 'exp_chat_status';
  var SOUND_KEY  = 'exp_chat_sound';

  var STATUS_COLORS = {
    online:  '#1D6A4A',
    foco:    '#1D4FA0',
    ocupado: '#B84C3A',
    ausente: '#C4831A'
  };

  /* ── CSS embutido ────────────────────────────────────────────────── */
  var CSS_TEXT = [
    '#exp-chat-widget{position:fixed;bottom:24px;right:24px;z-index:10000;font-family:"Raleway",sans-serif}',
    /* ── Controls bar ── */
    '.chat-controls{display:flex;align-items:flex-end;gap:8px;justify-content:flex-end}',
    /* ── FAB toggle ── */
    '.chat-toggle{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:background .3s,transform .15s;user-select:none;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
    '.chat-toggle:hover{transform:scale(1.06)}.chat-toggle:active{transform:scale(.94)}',
    '.chat-badge{position:absolute;top:-5px;right:-5px;background:#B84C3A;color:#fff;font-size:9px;font-weight:700;font-family:"DM Mono",monospace;min-width:17px;height:17px;border-radius:9px;display:none;align-items:center;justify-content:center;padding:0 3px;border:2px solid var(--off,#F7F6F3)}',
    /* ── Person button (aparece quando aberto) ── */
    '.chat-person-btn{width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid #1D6A4A;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .3s,color .3s,box-shadow .15s;color:#1D6A4A;flex-shrink:0}',
    '.chat-person-btn:hover{box-shadow:0 2px 10px rgba(0,0,0,.14)}',
    /* ── Status indicator (aparece quando fechado) ── */
    '.chat-status-ind{display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 7px;background:rgba(255,255,255,.95);border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,.13);transition:box-shadow .15s;user-select:none;margin-bottom:5px;align-self:flex-end}',
    '.chat-status-ind:hover{box-shadow:0 2px 12px rgba(0,0,0,.2)}',
    '.chat-status-ind-dot{width:7px;height:7px;border-radius:50%;transition:background .3s}',
    '.chat-status-ind-dot.online{background:#2D9E6B}.chat-status-ind-dot.foco{background:#1D4FA0}',
    '.chat-status-ind-dot.ocupado{background:#B84C3A}.chat-status-ind-dot.ausente{background:#C4831A}',
    /* ── Status popover (flat — sem efeito 3D) ── */
    '.chat-status-pop{position:absolute;bottom:50px;right:50px;background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:5px;flex-direction:column;gap:1px;min-width:144px;z-index:10002}',
    '.chat-status-pop-hdr{font-size:10px;font-weight:600;color:var(--cinza,#D0CFC9);padding:4px 10px 6px;text-transform:uppercase;letter-spacing:.7px}',
    '.chat-sopt{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;border:none;background:none;cursor:pointer;font-family:"Raleway",sans-serif;font-size:12px;font-weight:500;width:100%;text-align:left;transition:background .1s;color:#111110}',
    '.chat-sopt:hover{background:var(--off,#F7F6F3)}.chat-sopt.active{background:var(--cinza2,#ECEAE4);font-weight:700}',
    '.chat-sopt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    /* ── Group confirm bar ── */
    '.chat-group-bar{padding:10px 12px;border-top:1px solid var(--cinza2,#ECEAE4);display:flex;align-items:center;justify-content:space-between;background:#fff;flex-shrink:0}',
    '.chat-group-info{font-size:11px;color:var(--cinza,#D0CFC9);font-weight:500}',
    '.chat-group-confirm{background:#111110;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-family:"Raleway",sans-serif;font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s}',
    '.chat-group-confirm:hover{opacity:.8}',
    /* ── Member checkbox ── */
    '.chat-member-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--cinza2,#ECEAE4);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .12s,border-color .12s}',
    '.chat-member-check.sel{background:#111110;border-color:#111110}',
    '.chat-member-check.sel::after{content:"";width:5px;height:5px;border-radius:50%;background:#fff}',
    /* ── Panel ── */
    '.chat-panel{position:absolute;bottom:58px;right:0;width:320px;height:490px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.14);display:none;flex-direction:column;overflow:hidden;animation:chatOpen .18s ease-out;border:1px solid var(--cinza2,#ECEAE4)}',
    '@keyframes chatOpen{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
    /* ── Views ── */
    '.chat-view{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}',
    /* ── Header ── */
    '.chat-header{padding:7px 11px;background:#111110;color:#fff;display:flex;align-items:center;gap:7px;flex-shrink:0}',
    '.chat-header-info{flex:1;min-width:0}',
    '.chat-header-title{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-header-sub{font-family:"DM Mono",monospace;font-size:9px;opacity:.65;margin-top:1px}',
    '.chat-header-acts{display:flex;align-items:center;gap:3px}',
    '.chat-icon-btn{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .12s}',
    '.chat-icon-btn:hover{background:rgba(255,255,255,.22)}',
    '.chat-close{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;transition:background .12s}',
    '.chat-close:hover{background:rgba(255,255,255,.22)}',
    '.chat-back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .12s;flex-shrink:0}',
    '.chat-back-btn:hover{background:rgba(255,255,255,.22)}',
    /* ── Conv list / member list ── */
    '.chat-conv-list,.chat-member-list{flex:1;overflow-y:auto;padding:6px}',
    '.chat-conv-list::-webkit-scrollbar,.chat-member-list::-webkit-scrollbar{width:3px}',
    '.chat-conv-list::-webkit-scrollbar-thumb,.chat-member-list::-webkit-scrollbar-thumb{background:var(--cinza,#D0CFC9);border-radius:2px}',
    '.chat-conv-item,.chat-member-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .1s}',
    '.chat-conv-item:hover,.chat-member-item:hover{background:var(--off,#F7F6F3)}',
    '.chat-conv-av-hash{width:28px;height:28px;border-radius:50%;background:var(--verde-bg,#EAF5EE);color:var(--verde,#1D6A4A);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.chat-conv-info{flex:1;min-width:0}',
    '.chat-conv-name{font-size:12px;font-weight:600;color:var(--preto,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-conv-preview{font-size:10px;color:var(--cinza,#D0CFC9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}',
    '.chat-conv-badge{background:#B84C3A;color:#fff;font-size:9px;font-weight:700;font-family:"DM Mono",monospace;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;flex-shrink:0}',
    /* ── Messages ── */
    '.chat-messages{flex:1;overflow-y:auto;padding:10px 10px 4px;display:flex;flex-direction:column;gap:0;scroll-behavior:smooth}',
    '.chat-messages::-webkit-scrollbar{width:3px}',
    '.chat-messages::-webkit-scrollbar-thumb{background:var(--cinza,#D0CFC9);border-radius:2px}',
    /* ── Empty / loading ── */
    '.chat-empty{text-align:center;color:var(--cinza,#D0CFC9);font-size:11px;line-height:1.7;margin:auto;padding:20px}',
    '.chat-empty-icon{font-size:22px;margin-bottom:6px;opacity:.5}',
    '.chat-loading{display:flex;align-items:center;justify-content:center;gap:5px;margin:auto;padding:20px}',
    '.chat-loading-dot{width:5px;height:5px;border-radius:50%;background:var(--cinza,#D0CFC9);animation:chatPulse 1.2s ease-in-out infinite}',
    '.chat-loading-dot:nth-child(2){animation-delay:.2s}.chat-loading-dot:nth-child(3){animation-delay:.4s}',
    '@keyframes chatPulse{0%,80%,100%{opacity:.2}40%{opacity:1}}',
    /* ── Date separator ── */
    '.chat-date-sep{display:flex;align-items:center;gap:7px;margin:8px 0 3px;color:var(--cinza,#D0CFC9);font-size:9px;font-family:"DM Mono",monospace;letter-spacing:.5px}',
    '.chat-date-sep::before,.chat-date-sep::after{content:"";flex:1;height:1px;background:var(--cinza2,#ECEAE4)}',
    /* ── Message bubble ── */
    '.chat-msg{display:flex;flex-direction:column;padding:2px 6px;border-radius:6px;transition:background .1s}',
    '.chat-msg:hover{background:var(--off,#F7F6F3)}',
    /* Alinhamento: recebidas à esq, enviadas à dir */
    '.chat-msg.own{align-items:flex-end}',
    '.chat-msg-meta{display:flex;align-items:center;gap:5px;margin-top:6px;margin-bottom:3px}',
    '.chat-msg.own .chat-msg-meta{flex-direction:row-reverse}',
    '.chat-av{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;flex-shrink:0;font-family:"DM Mono",monospace;letter-spacing:0}',
    '.chat-msg-name{font-weight:600;font-size:10px;color:var(--preto,#111110)}',
    '.chat-msg.own .chat-msg-name{color:var(--verde,#1D6A4A)}',
    '.chat-msg-time{font-family:"DM Mono",monospace;font-size:8px;color:var(--cinza,#D0CFC9)}',
    /* Bolhas: recv = off-white esq; sent = cinza2 dir */
    '.chat-msg-text{font-size:12px;line-height:1.5;word-break:break-word;padding:5px 9px;border-radius:10px;max-width:86%}',
    '.chat-msg-text.recv{background:var(--off,#F7F6F3);color:var(--preto,#111110);border-radius:2px 10px 10px 10px;align-self:flex-start}',
    '.chat-msg-text.sent{background:var(--cinza2,#ECEAE4);color:var(--preto,#111110);border-radius:10px 2px 10px 10px;align-self:flex-end}',
    /* Agrupadas: sem meta, recuadas */
    '.chat-msg-text.grouped.recv{margin-left:22px}',
    '.chat-msg-text.grouped.sent{margin-right:22px}',
    '.chat-msg-reactions.grouped.recv{margin-left:22px}',
    '.chat-msg-reactions.grouped.sent{margin-right:22px}',
    '.chat-link{color:var(--verde,#1D6A4A);text-decoration:underline;word-break:break-all}',
    '.chat-link:hover{color:var(--verde-l,#2D9E6B)}',
    /* ── Reactions ── */
    '.chat-msg-reactions{display:flex;gap:4px;margin-top:2px;opacity:0;transition:opacity .12s}',
    '.chat-msg.own .chat-msg-reactions{justify-content:flex-end}',
    '.chat-msg:hover .chat-msg-reactions,.chat-msg-reactions.has-reactions{opacity:1}',
    /* ── Status dot inline (presence) ── */
    '.chat-presence-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block}',
    '.chat-presence-dot.online{background:#2D9E6B}.chat-presence-dot.foco{background:#1D4FA0}',
    '.chat-presence-dot.ocupado{background:#B84C3A}.chat-presence-dot.ausente{background:#C4831A}',
    '.chat-presence-dot.offline{background:var(--cinza,#D0CFC9)}',
    '.chat-rbtn{background:var(--off,#F7F6F3);border:1px solid var(--cinza2,#ECEAE4);border-radius:10px;padding:1px 6px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background .1s,transform .08s;font-family:"Raleway",sans-serif;line-height:1.4}',
    '.chat-rbtn:hover{background:var(--verde-bg,#EAF5EE);border-color:var(--verde-l,#2D9E6B);transform:scale(1.05)}',
    '.chat-rbtn.active{background:var(--verde-bg,#EAF5EE);border-color:var(--verde,#1D6A4A)}',
    '.chat-rbtn-count{font-size:9px;font-family:"DM Mono",monospace;color:var(--verde,#1D6A4A)}',
    /* ── Input ── */
    '.chat-input-area{padding:8px 10px;border-top:1px solid var(--cinza2,#ECEAE4);display:flex;gap:7px;align-items:flex-end;background:#fff;flex-shrink:0}',
    '.chat-input{flex:1;border:1px solid var(--cinza2,#ECEAE4);border-radius:9px;padding:7px 11px;font-family:"Raleway",sans-serif;font-size:12px;resize:none;outline:none;max-height:80px;min-height:33px;color:var(--preto,#111110);background:var(--off,#F7F6F3);line-height:1.45;transition:border-color .15s,background .15s;overflow-y:auto}',
    '.chat-input::placeholder{color:var(--cinza,#D0CFC9)}',
    '.chat-input:focus{border-color:var(--verde,#1D6A4A);background:#fff}',
    '.chat-send{width:33px;height:33px;background:var(--verde,#1D6A4A);border:none;border-radius:9px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .08s}',
    '.chat-send:hover{background:var(--verde-l,#2D9E6B)}.chat-send:active{transform:scale(.93)}',
    /* ── Toast ── */
    '.chat-new-msg-toast{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:var(--verde,#1D6A4A);color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 10px rgba(29,106,74,.3);animation:chatToastIn .2s ease-out;z-index:10003}',
    '@keyframes chatToastIn{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
  ].join('\n');

  /* ══════════════════════════════════════════════════════════════════
     ESTADO
  ══════════════════════════════════════════════════════════════════ */
  var sb, user;
  var presenceCh = null, msgCh = null;
  var messages      = [];
  var isOpen        = false;
  var isLoading     = false;
  var scrolledToEnd = true;
  var statusPopOpen = false;
  var currentView    = 'home';      // 'home' | 'channel' | 'members'
  var currentChannel = 'general';
  var currentLabel   = '# geral';
  var teamMembers      = [];
  var selectedMembers  = [];        // membros selecionados no seletor de grupo
  var channelUnread    = {};        // { channel: count }
  var onlinePresence   = {};        // { auth_id: { status, nome, ... } }
  var userStatus     = localStorage.getItem(STATUS_KEY) || 'online';
  var soundEnabled   = localStorage.getItem(SOUND_KEY) !== 'false';

  /* ── DOM refs ─────────────────────────────────────────────────── */
  var $panel, $msgs, $input, $badge, $toggle;
  var $viewHome, $viewChan, $viewMembers;
  var $chanTitle, $personBtn, $statusInd, $statusPop;

  /* ══════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════ */
  function init() {
    var raw = sessionStorage.getItem('exp_usuario');
    if (!raw) return;
    try { user = JSON.parse(raw); } catch (e) { return; }
    if (!user || !user.nome) return;
    if (!user.auth_id) user.auth_id = user.id;

    sb = (typeof window.sb !== 'undefined' && window.sb)
      ? window.sb
      : supabase.createClient(SB_URL, SB_KEY);

    sb.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) return;
      mountWidget();
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     MOUNT
  ══════════════════════════════════════════════════════════════════ */
  function mountWidget() {
    if (document.getElementById('exp-chat-widget')) return;
    injectCSS();
    injectHTML();
    cacheRefs();
    applyStatus(userStatus, false);
    setupPresence();
    fetchAllUnread();
    subscribeIncoming();

    window.addEventListener('beforeunload', function () {
      if (presenceCh) presenceCh.untrack();
    });

    // Fechar popover ao clicar fora
    document.addEventListener('click', function (e) {
      if (!statusPopOpen) return;
      var pop    = document.getElementById('exp-chat-status-pop');
      var ind    = document.getElementById('exp-chat-status-ind');
      var person = document.getElementById('exp-chat-person-btn');
      if (!pop) return;
      if (pop.contains(e.target)) return;
      if (ind && ind.contains(e.target)) return;
      if (person && person.contains(e.target)) return;
      closeStatusPop();
    });
  }

  function cacheRefs() {
    $panel      = document.getElementById('exp-chat-panel');
    $msgs       = document.getElementById('exp-chat-msgs');
    $input      = document.getElementById('exp-chat-input');
    $badge      = document.getElementById('exp-chat-badge');
    $toggle     = document.getElementById('exp-chat-toggle');
    $viewHome   = document.getElementById('exp-chat-home');
    $viewChan   = document.getElementById('exp-chat-chan');
    $viewMembers= document.getElementById('exp-chat-members');
    $chanTitle  = document.getElementById('exp-chat-chan-title');
    $personBtn  = document.getElementById('exp-chat-person-btn');
    $statusInd  = document.getElementById('exp-chat-status-ind');
    $statusPop  = document.getElementById('exp-chat-status-pop');

    if ($msgs) {
      $msgs.addEventListener('scroll', function () {
        scrolledToEnd = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 40;
      });
    }
  }

  /* ── CSS ──────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('exp-chat-css')) return;
    var s = document.createElement('style');
    s.id = 'exp-chat-css';
    s.textContent = CSS_TEXT;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════════
     HTML
  ══════════════════════════════════════════════════════════════════ */
  function injectHTML() {
    var wrap = document.createElement('div');
    wrap.id = 'exp-chat-widget';
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap);
  }

  function buildHTML() {
    var fn = firstName(user.nome);
    return (
      /* ── Painel ── */
      '<div class="chat-panel" id="exp-chat-panel" style="display:none">' +

        /* View: Home (lista de conversas) */
        '<div class="chat-view" id="exp-chat-home">' +
          '<div class="chat-header">' +
            '<div class="chat-header-info"><div class="chat-header-title">Chat da equipe</div></div>' +
            '<div class="chat-header-acts">' +
              '<button class="chat-icon-btn" id="exp-chat-sound-btn" onclick="expChat.toggleSound()" title="Som de notificação">' + (soundEnabled ? icoSound() : icoSoundOff()) + '</button>' +
              '<button class="chat-icon-btn" onclick="expChat.startDM()" title="Nova mensagem">' + icoPencil() + '</button>' +
              '<button class="chat-close" onclick="expChat.close()">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="chat-conv-list" id="exp-chat-convlist"><div class="chat-loading">' + ldots() + '</div></div>' +
        '</div>' +

        /* View: Channel / DM */
        '<div class="chat-view" id="exp-chat-chan" style="display:none">' +
          '<div class="chat-header">' +
            '<button class="chat-back-btn" onclick="expChat.goHome()">' + icoBack() + '</button>' +
            '<div class="chat-header-info"><div class="chat-header-title" id="exp-chat-chan-title"># geral</div><div class="chat-header-sub" id="exp-chat-chan-sub" style="display:none"></div></div>' +
            '<button class="chat-close" onclick="expChat.close()">✕</button>' +
          '</div>' +
          '<div class="chat-messages" id="exp-chat-msgs"><div class="chat-loading">' + ldots() + '</div></div>' +
          '<div class="chat-input-area">' +
            '<textarea class="chat-input" id="exp-chat-input" placeholder="Mensagem…" rows="1"' +
              ' onkeydown="expChat.handleKey(event)" oninput="expChat.autoResize(this)"></textarea>' +
            '<button class="chat-send" onclick="expChat.send()" title="Enviar (Enter)">' + icoSend() + '</button>' +
          '</div>' +
        '</div>' +

        /* View: Seletor de membro (novo DM) */
        '<div class="chat-view" id="exp-chat-members" style="display:none">' +
          '<div class="chat-header">' +
            '<button class="chat-back-btn" onclick="expChat.goHome()">' + icoBack() + '</button>' +
            '<div class="chat-header-info"><div class="chat-header-title">Nova mensagem</div></div>' +
            '<button class="chat-close" onclick="expChat.close()">✕</button>' +
          '</div>' +
          '<div class="chat-member-list" id="exp-chat-memberlist"><div class="chat-loading">' + ldots() + '</div></div>' +
          '<div class="chat-group-bar" id="exp-chat-group-bar" style="display:none">' +
            '<span class="chat-group-info" id="exp-chat-group-info"></span>' +
            '<button class="chat-group-confirm" onclick="expChat.confirmGroup()">Abrir →</button>' +
          '</div>' +
        '</div>' +

      '</div>' + /* fim .chat-panel */

      /* ── Status popover ── */
      '<div class="chat-status-pop" id="exp-chat-status-pop" style="display:none">' +
        '<div class="chat-status-pop-hdr">' + escHtml(fn) + '</div>' +
        sopt('online',  'Online') +
        sopt('foco',    'Foco') +
        sopt('ocupado', 'Ocupado') +
        sopt('ausente', 'Ausente') +
      '</div>' +

      /* ── Controls (person btn + status ind + toggle) ── */
      '<div class="chat-controls">' +
        '<button class="chat-person-btn" id="exp-chat-person-btn" onclick="expChat.toggleStatusPop()" title="Meu status" style="display:none">' +
          icoPerson() +
        '</button>' +
        '<div class="chat-status-ind" id="exp-chat-status-ind" onclick="expChat.toggleStatusPop()" title="Status">' +
          '<div class="chat-status-ind-dot" id="exp-chat-ind-dot"></div>' +
          icoChevron() +
        '</div>' +
        '<div class="chat-toggle" id="exp-chat-toggle" onclick="expChat.toggle()">' +
          icoChat() +
          '<div class="chat-badge" id="exp-chat-badge"></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Helpers de markup ────────────────────────────────────────── */
  var SOPT_COLORS = { online:'#2D9E6B', foco:'#1D4FA0', ocupado:'#B84C3A', ausente:'#C4831A' };
  function sopt(val, label) {
    return '<button class="chat-sopt" data-status="' + val + '" onclick="expChat.setStatus(\'' + val + '\')">' +
      '<span class="chat-sopt-dot" style="background:' + SOPT_COLORS[val] + '"></span>' +
      '<span>' + label + '</span></button>';
  }
  function ldots() {
    return '<div class="chat-loading-dot"></div><div class="chat-loading-dot"></div><div class="chat-loading-dot"></div>';
  }

  /* ── SVG icons ────────────────────────────────────────────────── */
  function icoChat()    { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }
  function icoSend()    { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'; }
  function icoBack()    { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'; }
  function icoPerson()  { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
  function icoChevron() { return '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'; }
  function icoPencil()  { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'; }
  function icoSound()   { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'; }
  function icoSoundOff(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'; }

  /* ══════════════════════════════════════════════════════════════════
     STATUS
  ══════════════════════════════════════════════════════════════════ */
  function applyStatus(status, broadcast) {
    if (typeof broadcast === 'undefined') broadcast = true;
    userStatus = status;
    localStorage.setItem(STATUS_KEY, status);

    var color = STATUS_COLORS[status] || STATUS_COLORS.online;

    /* FAB: só cor chapada — sem shadow colorido */
    if ($toggle) {
      $toggle.style.background = color;
    }
    /* Dot no indicador de status */
    var dot = document.getElementById('exp-chat-ind-dot');
    if (dot) dot.className = 'chat-status-ind-dot ' + status;

    /* Person button: cor da borda */
    if ($personBtn) {
      $personBtn.style.borderColor = color;
      $personBtn.style.color       = color;
    }

    /* Popover: marcar opção ativa */
    if ($statusPop) {
      var opts = $statusPop.querySelectorAll('.chat-sopt');
      for (var i = 0; i < opts.length; i++) {
        opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === status);
      }
    }

    if (broadcast && presenceCh) presenceCh.track(presencePayload(status));
  }

  function toggleStatusPop() { statusPopOpen ? closeStatusPop() : openStatusPop(); }

  function openStatusPop() {
    if (!$statusPop) return;
    statusPopOpen = true;
    $statusPop.style.display = 'flex';
    var opts = $statusPop.querySelectorAll('.chat-sopt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === userStatus);
    }
  }

  function closeStatusPop() {
    if (!$statusPop) return;
    statusPopOpen = false;
    $statusPop.style.display = 'none';
  }

  /* ══════════════════════════════════════════════════════════════════
     ABRIR / FECHAR
  ══════════════════════════════════════════════════════════════════ */
  function toggle() { isOpen ? close() : open(); }

  function open() {
    if (!$panel) return;
    isOpen = true;
    $panel.style.display    = 'flex';
    if ($personBtn) $personBtn.style.display = 'flex';
    if ($statusInd) $statusInd.style.display = 'none';
    closeStatusPop();
    showView('home');
  }

  function close() {
    if (!$panel) return;
    isOpen = false;
    $panel.style.display    = 'none';
    if ($personBtn) $personBtn.style.display = 'none';
    if ($statusInd) $statusInd.style.display = 'flex';
    closeStatusPop();
  }

  /* ══════════════════════════════════════════════════════════════════
     VIEWS
  ══════════════════════════════════════════════════════════════════ */
  function showView(view) {
    currentView = view;
    var map = { home: $viewHome, channel: $viewChan, members: $viewMembers };
    Object.keys(map).forEach(function (k) {
      if (map[k]) map[k].style.display = k === view ? 'flex' : 'none';
    });
    if (view === 'home')    renderHome();
    if (view === 'members') renderMemberList();
  }

  /* ══════════════════════════════════════════════════════════════════
     HOME — lista de conversas
  ══════════════════════════════════════════════════════════════════ */
  function renderHome() {
    var $list = document.getElementById('exp-chat-convlist');
    if (!$list) return;

    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    sb.from('chat_messages')
      .select('channel,sender_name,sender_iniciais,sender_cor,content,created_at,sender_id')
      .like('channel', 'dm:%')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(function (r) {
        var msgs = r.data || [];

        /* Agrupar por canal, manter a mensagem mais recente */
        var seen = {};
        var dmList = [];
        msgs.forEach(function (m) {
          if (m.channel.indexOf(uid) === -1) return;
          if (!seen[m.channel]) { seen[m.channel] = true; dmList.push(m); }
        });

        var html = '';

        /* Linha #geral */
        var genU = channelUnread['general'] || 0;
        html += '<div class="chat-conv-item" onclick="expChat.openChannel(\'general\',\'# geral\')">' +
          '<div class="chat-conv-av-hash">#</div>' +
          '<div class="chat-conv-info"><div class="chat-conv-name">geral</div><div class="chat-conv-preview">Toda a equipe</div></div>' +
          (genU > 0 ? '<div class="chat-conv-badge">' + genU + '</div>' : '') +
          '</div>';

        /* Linha #sócios (apenas para role socio) */
        if (user.role === 'socio') {
          var socU = channelUnread['socios'] || 0;
          html += '<div class="chat-conv-item" onclick="expChat.openChannel(\'socios\',\'# sócios\')">' +
            '<div class="chat-conv-av-hash" style="background:var(--am-bg,#FBF3E8);color:var(--am,#C4831A)">#</div>' +
            '<div class="chat-conv-info"><div class="chat-conv-name">sócios</div><div class="chat-conv-preview">Canal privado</div></div>' +
            (socU > 0 ? '<div class="chat-conv-badge">' + socU + '</div>' : '') +
            '</div>';
        }

        /* Linhas de DMs */
        dmList.forEach(function (dm) {
          var isOwn = dm.sender_id === uid;
          var parts = dm.channel.replace('dm:', '').split(':');
          var otherUid = parts.find(function (p) { return p !== uid; }) || '';
          var member = teamMembers.find(function (m) { return m.auth_id === otherUid; });

          var name, iniciais, cor;
          if (!isOwn) {
            name = dm.sender_name; iniciais = dm.sender_iniciais || dm.sender_name.substring(0, 2).toUpperCase(); cor = dm.sender_cor || '#1D6A4A';
          } else if (member) {
            name = member.nome; iniciais = member.iniciais || member.nome.substring(0, 2).toUpperCase(); cor = member.cor || '#1D6A4A';
          } else {
            name = 'Colega'; iniciais = '??'; cor = '#1D6A4A';
          }

          var preview  = dm.content.length > 34 ? dm.content.substring(0, 34) + '…' : dm.content;
          var dmU      = channelUnread[dm.channel] || 0;
          var chanJson = dm.channel.replace(/'/g, "\\'");
          var nameEsc  = escHtml(firstName(name));

          html += '<div class="chat-conv-item" onclick="expChat.openChannel(\'' + chanJson + '\',\'' + nameEsc + '\')">' +
            '<div class="chat-av" style="background:' + cor + ';width:28px;height:28px;font-size:10px;flex-shrink:0">' + escHtml(iniciais) + '</div>' +
            '<div class="chat-conv-info">' +
              '<div class="chat-conv-name">' + nameEsc + '</div>' +
              '<div class="chat-conv-preview">' + escHtml(preview) + '</div>' +
            '</div>' +
            (dmU > 0 ? '<div class="chat-conv-badge">' + dmU + '</div>' : '') +
            '</div>';
        });

        $list.innerHTML = html;
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     ABRIR CANAL / DM
  ══════════════════════════════════════════════════════════════════ */
  function openChannel(channel, displayName) {
    currentChannel = channel;
    currentLabel   = displayName;
    if ($chanTitle) $chanTitle.textContent = displayName;
    messages = [];
    showView('channel');
    updateChannelStatus();
    loadMessages();
    markRead();
    setTimeout(function () { if ($input) $input.focus(); }, 120);
  }

  function goHome() { selectedMembers = []; showView('home'); }

  /* Atualiza o subtítulo do canal com status de presença */
  function updateChannelStatus() {
    var $sub = document.getElementById('exp-chat-chan-sub');
    if (!$sub) return;

    /* Para DMs: mostrar status da outra pessoa */
    if (currentChannel.startsWith('dm:')) {
      var parts   = currentChannel.replace('dm:', '').split(':');
      var otherUid = parts.find(function (p) { return p !== user.auth_id; });
      var pres    = otherUid ? onlinePresence[otherUid] : null;
      var sLabels = { online: 'Online', foco: 'Foco', ocupado: 'Ocupado', ausente: 'Ausente' };
      var status  = pres ? pres.status : 'offline';
      var label   = pres ? (sLabels[status] || status) : 'Offline';
      $sub.style.display = '';
      $sub.innerHTML = '<span class="chat-presence-dot ' + status + '" style="margin-right:4px;vertical-align:middle"></span>' + label;

    /* Para grupos: mostrar quantos estão online */
    } else if (currentChannel.startsWith('group:')) {
      var uids   = currentChannel.replace('group:', '').split(':');
      var online = uids.filter(function (uid) { return onlinePresence[uid]; }).length;
      $sub.style.display = '';
      $sub.innerHTML = online + ' de ' + uids.length + ' online';

    /* Canais fixos: ocultar subtítulo */
    } else {
      $sub.style.display = 'none';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     NOVO DM — seletor de membros
  ══════════════════════════════════════════════════════════════════ */
  function startDM() {
    showView('members');
    loadTeamMembers();
  }

  function loadTeamMembers() {
    sb.from('usuarios')
      .select('id,auth_id,nome,iniciais,cor,role')
      .order('nome')
      .then(function (r) {
        teamMembers = (r.data || []).filter(function (m) {
          return m.auth_id !== user.auth_id && m.id !== user.id;
        });
        renderMemberList();
      });
  }

  function renderMemberList() {
    var $list = document.getElementById('exp-chat-memberlist');
    if (!$list) return;
    if (!teamMembers.length) {
      $list.innerHTML = '<div class="chat-empty">Carregando equipe…</div>';
      return;
    }
    var roleLabel = { socio: 'Sócio', coordenador: 'Coordenador', colaborador: 'Colaborador' };
    var html = '';
    teamMembers.forEach(function (m) {
      var cor = m.cor || '#1D6A4A';
      var sel = selectedMembers.findIndex(function (s) { return s.auth_id === m.auth_id; }) !== -1;
      var pres    = onlinePresence[m.auth_id];
      var pStatus = pres ? pres.status : 'offline';
      var pLabels = { online: 'Online', foco: 'Foco', ocupado: 'Ocupado', ausente: 'Ausente', offline: 'Offline' };
      html += '<div class="chat-member-item" onclick="expChat.toggleMember(\'' + m.auth_id + '\')">' +
        '<div class="chat-member-check' + (sel ? ' sel' : '') + '"></div>' +
        '<div style="position:relative;flex-shrink:0">' +
          '<div class="chat-av" style="background:' + cor + ';width:28px;height:28px;font-size:10px">' + escHtml(m.iniciais || m.nome.substring(0, 2).toUpperCase()) + '</div>' +
          '<span class="chat-presence-dot ' + pStatus + '" style="position:absolute;bottom:-1px;right:-1px;border:1.5px solid #fff"></span>' +
        '</div>' +
        '<div class="chat-conv-info">' +
          '<div class="chat-conv-name">' + escHtml(m.nome) + '</div>' +
          '<div class="chat-conv-preview">' + pLabels[pStatus] + ' · ' + (roleLabel[m.role] || '') + '</div>' +
        '</div>' +
        '</div>';
    });
    $list.innerHTML = html;

    /* Barra de confirmação */
    var $bar  = document.getElementById('exp-chat-group-bar');
    var $info = document.getElementById('exp-chat-group-info');
    var n = selectedMembers.length;
    if ($bar) $bar.style.display = n > 0 ? 'flex' : 'none';
    if ($info) {
      if (n === 1) $info.textContent = '1 pessoa selecionada';
      else if (n > 1) $info.textContent = n + ' pessoas selecionadas';
    }
    var $btn = document.querySelector('.chat-group-confirm');
    if ($btn) $btn.textContent = n === 1 ? 'Mensagem direta →' : 'Criar grupo →';
  }

  function toggleMember(authId) {
    var idx = selectedMembers.findIndex(function (m) { return m.auth_id === authId; });
    if (idx === -1) {
      var member = teamMembers.find(function (m) { return m.auth_id === authId; });
      if (member) selectedMembers.push(member);
    } else {
      selectedMembers.splice(idx, 1);
    }
    renderMemberList();
  }

  function confirmGroup() {
    if (!selectedMembers.length) return;
    var ch, label;
    if (selectedMembers.length === 1) {
      /* DM 1:1 */
      var m = selectedMembers[0];
      ch    = dmChannel(user.auth_id, m.auth_id);
      label = firstName(m.nome);
    } else {
      /* Grupo: canal com todos os UIDs ordenados */
      var allUids = [user.auth_id].concat(selectedMembers.map(function (m) { return m.auth_id; })).sort();
      ch    = 'group:' + allUids.join(':');
      label = selectedMembers.map(function (m) { return firstName(m.nome); }).join(', ');
    }
    selectedMembers = [];
    openChannel(ch, label);
  }

  function dmChannel(uid1, uid2) {
    return 'dm:' + [uid1, uid2].sort().join(':');
  }

  /* ══════════════════════════════════════════════════════════════════
     PRESENCE
  ══════════════════════════════════════════════════════════════════ */
  function setupPresence() {
    presenceCh = sb.channel('exp:chat:presence');
    presenceCh
      .on('presence', { event: 'sync' }, function () {
        var state = presenceCh.presenceState();
        onlinePresence = {};
        Object.keys(state).forEach(function (key) {
          state[key].forEach(function (p) {
            if (p.user_id) onlinePresence[p.user_id] = p;
          });
        });
        // Atualizar UI se aberto
        if (isOpen) {
          if (currentView === 'members') renderMemberList();
          if (currentView === 'channel') updateChannelStatus();
        }
      })
      .subscribe(function (s) {
        if (s === 'SUBSCRIBED') presenceCh.track(presencePayload(userStatus));
      });
  }

  function presencePayload(status) {
    return {
      user_id:  user.auth_id,
      nome:     user.nome,
      iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      cor:      user.cor || '#1D6A4A',
      status:   status
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     REALTIME — receber mensagens
  ══════════════════════════════════════════════════════════════════ */
  function subscribeIncoming() {
    if (msgCh) { sb.removeChannel(msgCh); msgCh = null; }

    msgCh = sb.channel('exp:chat:incoming')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, function (payload) {
        var msg = payload.new;
        var ch  = msg.channel;
        var uid = user.auth_id;

        /* Ignorar canais que não envolvem o usuário */
        var isSocios = ch === 'socios' && user.role === 'socio';
        if (ch !== 'general' && !isSocios && ch.indexOf(uid) === -1) return;

        var isActive = isOpen && currentView === 'channel' && currentChannel === ch;
        var isOwn    = msg.sender_id === uid;

        if (isActive) {
          messages.push(msg);
          renderMessages();
          if (scrolledToEnd) scrollBottom();
          else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch] = (channelUnread[ch] || 0) + 1;
          updateBadge();
          if (isOpen && currentView === 'home') renderHome();
          playNotificationSound();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, function (payload) {
        var up = payload.new;
        if (up.channel !== currentChannel) return;
        var idx = messages.findIndex(function (m) { return m.id === up.id; });
        if (idx !== -1) { messages[idx] = up; if (isOpen && currentView === 'channel') renderMessages(); }
      })
      .subscribe();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARREGAR MENSAGENS
  ══════════════════════════════════════════════════════════════════ */
  function loadMessages() {
    if (isLoading) return;
    isLoading = true;
    showLoading();
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    sb.from('chat_messages')
      .select('*')
      .eq('channel', currentChannel)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(function (r) {
        isLoading = false;
        if (r.error) { showError(); return; }
        messages = r.data || [];
        renderMessages();
        scrollBottom();
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     NÃO LIDAS
  ══════════════════════════════════════════════════════════════════ */
  function fetchAllUnread() {
    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    sb.from('chat_read_status').select('channel,last_read_at').eq('user_id', uid)
      .then(function (r) {
        var readMap = {};
        (r.data || []).forEach(function (row) { readMap[row.channel] = row.last_read_at; });

        /* Contar não lidas por canal fixo */
        var fixedChannels = ['general'];
        if (user.role === 'socio') fixedChannels.push('socios');

        fixedChannels.forEach(function (ch) {
          var lastRead = readMap[ch] || since;
          sb.from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel', ch)
            .gt('created_at', lastRead)
            .neq('sender_id', uid)
            .then(function (r2) {
              if (r2.count) channelUnread[ch] = r2.count;
              updateBadge();
            });
        });
      });
  }

  function markRead() {
    sb.from('chat_read_status').upsert({
      user_id: user.auth_id, channel: currentChannel, last_read_at: new Date().toISOString()
    }).then(function () {
      channelUnread[currentChannel] = 0;
      updateBadge();
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ENVIAR
  ══════════════════════════════════════════════════════════════════ */
  function send() {
    if (!$input) return;
    var content = $input.value.trim();
    if (!content) return;
    $input.value = '';
    $input.style.height = 'auto';

    sb.from('chat_messages').insert({
      channel:         currentChannel,
      sender_id:       user.auth_id,
      sender_name:     user.nome,
      sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      sender_cor:      user.cor || '#1D6A4A',
      content:         content
    }).then(function (r) {
      if (r.error) {
        $input.value = content;
        console.warn('[EXP Chat] Erro ao enviar:', r.error.message);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     REACTIONS
  ══════════════════════════════════════════════════════════════════ */
  function toggleReaction(msgId, type) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg) return;
    var uid = user.auth_id;
    var rx  = msg.reactions || { like: [], love: [] };
    var arr = (rx[type] || []).slice();
    var idx = arr.indexOf(uid);
    if (idx === -1) arr.push(uid); else arr.splice(idx, 1);
    var upd = Object.assign({}, rx);
    upd[type] = arr;
    msg.reactions = upd;
    renderMessages();
    sb.from('chat_messages').update({ reactions: upd }).eq('id', msgId)
      .then(function (r) { if (r.error) { msg.reactions = rx; renderMessages(); } });
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER MENSAGENS
  ══════════════════════════════════════════════════════════════════ */
  function renderMessages() {
    if (!$msgs) return;
    if (!messages.length) {
      $msgs.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">💬</div>Nenhuma mensagem ainda.</div>';
      return;
    }
    var uid = user.auth_id;
    var html = '';
    var prevSender = null, prevTime = null, lastDate = null;

    messages.forEach(function (msg) {
      var isOwn   = msg.sender_id === uid;
      var dt      = new Date(msg.created_at);
      var dateStr = dt.toDateString();

      if (dateStr !== lastDate) {
        lastDate = dateStr;
        html += '<div class="chat-date-sep">' + fmtDateSep(dt) + '</div>';
        prevSender = null;
      }

      var gap     = prevTime ? (dt - prevTime) : Infinity;
      var grouped = msg.sender_id === prevSender && gap < 5 * 60 * 1000;
      var iniciais= msg.sender_iniciais || msg.sender_name.substring(0, 2).toUpperCase();
      var cor     = msg.sender_cor || '#1D6A4A';
      var fn      = firstName(msg.sender_name);

      var rx      = msg.reactions || { like: [], love: [] };
      var likeArr = rx.like  || [];
      var loveArr = rx.love  || [];
      var liked   = likeArr.indexOf(uid) !== -1;
      var loved   = loveArr.indexOf(uid) !== -1;
      var likeN   = likeArr.length;
      var loveN   = loveArr.length;
      var hasRxn  = likeN > 0 || loveN > 0;

      html += '<div class="chat-msg' + (isOwn ? ' own' : '') + '" data-id="' + msg.id + '">';

      if (!grouped) {
        html += '<div class="chat-msg-meta">' +
          '<div class="chat-av" style="background:' + cor + '">' + escHtml(iniciais) + '</div>' +
          '<span class="chat-msg-name">' + escHtml(fn) + '</span>' +
          '<span class="chat-msg-time">' + fmtTime(dt) + '</span>' +
          '</div>';
      }

      var side = isOwn ? 'sent' : 'recv';
      html += '<div class="chat-msg-text ' + side + (grouped ? ' grouped' : '') + '">' +
        linkify(escHtml(msg.content).replace(/\n/g, '<br>')) +
        '</div>';

      html += '<div class="chat-msg-reactions ' + side + (grouped ? ' grouped' : '') + (hasRxn ? ' has-reactions' : '') + '">' +
        '<button class="chat-rbtn' + (liked ? ' active' : '') + '" onclick="expChat.react(\'' + msg.id + '\',\'like\')" data-count="' + likeN + '">👍' + (likeN > 0 ? '<span class="chat-rbtn-count">' + likeN + '</span>' : '') + '</button>' +
        '<button class="chat-rbtn' + (loved ? ' active' : '') + '" onclick="expChat.react(\'' + msg.id + '\',\'love\')" data-count="' + loveN + '">❤️' + (loveN > 0 ? '<span class="chat-rbtn-count">' + loveN + '</span>' : '') + '</button>' +
        '</div>';

      html += '</div>';
      prevSender = msg.sender_id;
      prevTime   = dt;
    });

    $msgs.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════════
     LINKIFY — URLs viram hiperlinks
  ══════════════════════════════════════════════════════════════════ */
  function linkify(html) {
    return html.replace(/(https?:\/\/[^\s&"<>]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="chat-link">' + url + '</a>';
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     SOM DE NOTIFICAÇÃO (Web Audio API — sem arquivo externo)
  ══════════════════════════════════════════════════════════════════ */
  function playNotificationSound() {
    if (!soundEnabled) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      /* Dois tons suaves: C6 (1047 Hz) → E6 (1319 Hz) */
      [{ f: 1046.5, t: 0, d: 0.18 }, { f: 1318.5, t: 0.13, d: 0.22 }].forEach(function (n) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0, ctx.currentTime + n.t);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + n.t);
        osc.stop(ctx.currentTime + n.t + n.d + 0.02);
      });
    } catch (e) {}
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    var btn = document.getElementById('exp-chat-sound-btn');
    if (btn) btn.innerHTML = soundEnabled ? icoSound() : icoSoundOff();
  }

  /* ══════════════════════════════════════════════════════════════════
     UI HELPERS
  ══════════════════════════════════════════════════════════════════ */
  function updateBadge() {
    var total = Object.values ? Object.values(channelUnread).reduce(function (a, b) { return a + b; }, 0) :
      Object.keys(channelUnread).reduce(function (a, k) { return a + channelUnread[k]; }, 0);
    if (!$badge) return;
    if (total > 0) { $badge.textContent = total > 99 ? '99+' : String(total); $badge.style.display = 'flex'; }
    else $badge.style.display = 'none';
  }

  function scrollBottom() { if ($msgs) { $msgs.scrollTop = $msgs.scrollHeight; scrolledToEnd = true; } }

  function showLoading() { if ($msgs) $msgs.innerHTML = '<div class="chat-loading">' + ldots() + '</div>'; }
  function showError()   { if ($msgs) $msgs.innerHTML = '<div class="chat-empty">Erro ao carregar.<br>Tente novamente.</div>'; }

  function showNewMsgToast() {
    var old = document.getElementById('exp-chat-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'exp-chat-toast'; t.className = 'chat-new-msg-toast'; t.textContent = '↓ Nova mensagem';
    t.onclick = function () { scrollBottom(); t.remove(); };
    $panel.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }

  function fmtDateSep(d) {
    var today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yest.toDateString())  return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  function fmtTime(d) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function firstName(name) { return name ? name.split(' ')[0] : ''; }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function hexRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }

  function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 80) + 'px'; }
  function handleKey(e)   { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  /* ══════════════════════════════════════════════════════════════════
     API PÚBLICA
  ══════════════════════════════════════════════════════════════════ */
  window.expChat = {
    toggle:          toggle,
    open:            open,
    close:           close,
    send:            send,
    handleKey:       handleKey,
    autoResize:      autoResize,
    setStatus:       function (s) { applyStatus(s, true); closeStatusPop(); },
    toggleStatusPop: toggleStatusPop,
    react:           toggleReaction,
    openChannel:     openChannel,
    goHome:          goHome,
    startDM:         startDM,
    toggleMember:    toggleMember,
    confirmGroup:    confirmGroup,
    toggleSound:     toggleSound
  };

  /* ══════════════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════════════ */
  function boot() {
    if (typeof supabase === 'undefined') { setTimeout(boot, 200); return; }
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 50);

})();
