/* ═══════════════════════════════════════════════════════════════════
   EXP · CHAT FULLPAGE  —  chat-fullpage.js  v2.0
   Layout page-full com sidebar, nav de módulos, temas de cor,
   bandeirinha pessoal, toggles unread/flagged, avatares empilhados.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */
  var SB_URL     = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var STATUS_KEY = 'exp_chat_status';
  var SOUND_KEY  = 'exp_chat_sound';
  var COLOR_KEY  = 'exp_chat_color';
  var FLAGS_KEY   = 'exp_chat_flags';
  var PINS_KEY    = 'exp_chat_pins';
  var PINNED_KEY  = 'exp_chat_pinned';
  var BRAND_AVATAR_COLORS = ['#1D6A4A','#1D4FA0','#C4831A','#B84C3A','#6D7D8A','#4A72B5','#7A9E7E'];
  var TEMP_MEDIA_BUCKET   = 'gestao-anexos-temp';
  var CHAT_IMAGE_SENTINEL = '[print]';
  var CHAT_MEDIA_LIMITS   = { largura_max_px:1280, tamanho_max_kb:500, qualidade_upload:0.76, qualidade_fallback:0.70 };

  /* ── Estado ──────────────────────────────────────────────────────── */
  var sb, user;
  var presenceCh = null, msgCh = null;
  var messages          = [];
  var isLoading         = false;
  var scrolledToEnd     = true;
  var currentChannel    = null;
  var currentLabel      = '';
  var channelLastReadAt = {};   // channel → ISO antes de marcar lido
  var loadRequestSeq    = 0;
  var teamMembers       = [];
  var allMembers        = [];
  var projectThreads    = [];
  var projectThreadMeta = {};
  var projectSectionCollapsed = true;
  var pendingMessageSeq = 0;
  var reactionLocks     = {};
  var chatMediaConfig   = null;
  var mediaViewerState  = null;
  var messageMediaMap   = {};
  var failedStoragePaths= {};
  var mediaRequestSeq   = 0;
  var mediaUploadBusy   = false;
  var composerStatusTimer = null;
  var selectedMembers   = [];
  var channelUnread     = {};
  var onlinePresence    = {};
  var userStatus        = localStorage.getItem(STATUS_KEY) || 'online';
  var soundEnabled      = localStorage.getItem(SOUND_KEY) !== 'false';
  var chatColor         = localStorage.getItem(COLOR_KEY) || 'verde';
  var flaggedMessages   = loadFlags();
  var pinnedProjects    = loadPins();
  var pinnedChannels    = (function(){ try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY)||'[]')); } catch(e){ return new Set(); } }());
  var _realtimeDropped  = false;
  var ctxMenuChannel    = null;
  var pinPopOpen        = false;
  var filterQuery       = '';
  var showOnlyUnread    = false;
  var showOnlyFlagged   = false;
  var statusPopOpen     = false;
  var mvZoom            = 1;
  /* busca dentro da conversa */
  var inSearchOpen      = false;
  var inSearchQuery     = '';
  var inSearchResults   = [];  // índices em messages[]
  var inSearchCurrent   = 0;

  function loadFlags() {
    try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveFlags() { localStorage.setItem(FLAGS_KEY, JSON.stringify(flaggedMessages)); }
  function isMessageFlagged(id) { return flaggedMessages.indexOf(String(id)) !== -1; }
  function toggleFlag(id) {
    id = String(id);
    var idx = flaggedMessages.indexOf(id);
    if (idx === -1) flaggedMessages.push(id); else flaggedMessages.splice(idx, 1);
    saveFlags();
  }

  /* ── Pins ── */
  function loadPins() {
    try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]'); } catch(e) { return []; }
  }
  function savePins() { localStorage.setItem(PINS_KEY, JSON.stringify(pinnedProjects)); }
  function isPinned(channel) { return pinnedProjects.indexOf(channel) !== -1; }
  function pinChannel(channel) {
    if (!isPinned(channel)) { pinnedProjects.push(channel); savePins(); }
  }
  function unpinChannel(channel) {
    var idx = pinnedProjects.indexOf(channel);
    if (idx !== -1) { pinnedProjects.splice(idx, 1); savePins(); }
  }
  function togglePin(channel) {
    isPinned(channel) ? unpinChannel(channel) : pinChannel(channel);
  }

  /* ── Pin: DMs fixadas pelo usuário ── */
  function toggleDmPin(channel) {
    if (pinnedChannels.has(channel)) pinnedChannels.delete(channel);
    else pinnedChannels.add(channel);
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(pinnedChannels))); } catch(e) {}
    renderConvList();
  }

  /* ── Som seletivo por canal ── */
  function _shouldPlaySound(ch) {
    if (!soundEnabled) return false;
    if (userStatus === 'foco') return false;
    if (ch === 'general') return true;
    if (ch === 'socios' && isSocioLikeRole(user.role)) return true;
    if (isDynamicChannel(ch) && channelHasUser(ch, user.auth_id)) return true;
    if (pinnedChannels.has(ch)) return true;
    if (isPinned(ch)) return true;
    return false;
  }

  /* ── Pin: canal atual (botão no header) ── */
  function togglePinCurrent() {
    if (!currentChannel || !isProjectChannel(currentChannel)) return;
    togglePin(currentChannel);
    updateHeaderPinBtn();
    updateSidebarPinBtn();
    renderConvList();
  }

  /* Sincroniza estado visual do botão no header do chat */
  function updateHeaderPinBtn() {
    var btn = document.getElementById('fp-hdr-pin-btn');
    if (!btn) return;
    var isProj = currentChannel && isProjectChannel(currentChannel);
    btn.style.display = isProj ? '' : 'none';
    btn.classList.toggle('pin-active', isProj && isPinned(currentChannel));
    btn.title = isProj && isPinned(currentChannel) ? 'Desafixar projeto' : 'Fixar projeto';
  }

  /* Sincroniza estado visual do botão na toolbar do sidebar */
  function updateSidebarPinBtn() {
    var btn = document.getElementById('fp-pin-btn');
    if (!btn) return;
    btn.classList.toggle('pin-active', pinnedProjects.length > 0);
  }

  /* ── Popdown de fixar projetos (toolbar) ── */
  function openPinPop(event) {
    event.stopPropagation();
    var pop = document.getElementById('fp-pin-pop');
    if (!pop) return;
    if (pinPopOpen) { closePinPop(); return; }
    pinPopOpen = true;

    /* Posicionar abaixo do botão */
    var btn = document.getElementById('fp-pin-btn');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      pop.style.top  = (rect.bottom + 6) + 'px';
      pop.style.left = Math.max(8, rect.left - 200 + rect.width) + 'px';
    }
    pop.style.display = 'flex';
    renderPinPop();

    setTimeout(function() {
      function handler(e) {
        var p = document.getElementById('fp-pin-pop');
        var b = document.getElementById('fp-pin-btn');
        if (!p) return;
        if (!p.contains(e.target) && !(b && b.contains(e.target))) {
          closePinPop();
          document.removeEventListener('click', handler);
        }
      }
      document.addEventListener('click', handler);
    }, 0);
  }

  function closePinPop() {
    pinPopOpen = false;
    var pop = document.getElementById('fp-pin-pop');
    if (pop) pop.style.display = 'none';
  }

  function renderPinPop() {
    var $list = document.getElementById('fp-pin-pop-list');
    if (!$list) return;
    var threads = projectThreads || [];
    if (!threads.length) {
      $list.innerHTML = '<div id="fp-pin-pop-empty">Nenhum projeto disponível.</div>';
      return;
    }
    var sorted = threads.slice().sort(function(a, b) {
      var la = (a.title || 'Projeto').toLowerCase();
      var lb = (b.title || 'Projeto').toLowerCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    $list.innerHTML = sorted.map(function(t) {
      var ch  = 'project:' + t.id;
      var on  = isPinned(ch);
      var meta = projectThreadMeta[ch];
      var label = (meta && meta.label) || t.title || 'Projeto';
      var cor   = (meta && meta.cor) || brandColorForKey(ch + ':' + label);
      var ini   = (meta && meta.iniciais) || initialsFromLabel(label, 'PRJ');
      var r16 = parseInt((cor.slice(1,3)||'1D'),16);
      var g16 = parseInt((cor.slice(3,5)||'6A'),16);
      var b16 = parseInt((cor.slice(5,7)||'4A'),16);
      var pbg = 'rgba('+r16+','+g16+','+b16+',.15)';
      var avHtml = '<div style="width:26px;height:26px;border-radius:7px;background:'+escHtml(pbg)+';color:'+escHtml(cor)+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">'+escHtml(ini)+'</div>';
      return '<div class="fp-pin-pop-item" onclick="fpChat.pinPopToggle(\''+escHtml(ch)+'\')">' +
        avHtml +
        '<span class="fp-pin-pop-label">'+escHtml(label)+'</span>' +
        '<div class="fp-pin-pop-check'+(on?' on':'')+'" id="fp-ppc-'+escHtml(ch.replace(/:/g,'-'))+'"></div>' +
        '</div>';
    }).join('');
  }

  function pinPopToggle(channel) {
    togglePin(channel);
    renderPinPop();
    updateSidebarPinBtn();
    updateHeaderPinBtn();
    renderConvList();
  }

  /* ── Menu de contexto (botão direito em item de projeto) ── */
  function openCtxMenu(event, channel) {
    if (!isProjectChannel(channel)) return;
    event.preventDefault();
    event.stopPropagation();
    ctxMenuChannel = channel;

    var $ctx = document.getElementById('fp-ctx-menu');
    var $lbl = document.getElementById('fp-ctx-pin-label');
    if (!$ctx) return;
    if ($lbl) $lbl.textContent = isPinned(channel) ? 'Desafixar projeto' : 'Fixar projeto';

    /* Posicionar no cursor */
    var x = event.clientX, y = event.clientY;
    $ctx.style.display = 'flex';
    var w = $ctx.offsetWidth || 170, h = $ctx.offsetHeight || 48;
    $ctx.style.left = Math.min(x, window.innerWidth  - w - 8) + 'px';
    $ctx.style.top  = Math.min(y, window.innerHeight - h - 8) + 'px';

    setTimeout(function() {
      function handler(e) {
        var ctx = document.getElementById('fp-ctx-menu');
        if (!ctx || !ctx.contains(e.target)) { closeCtxMenu(); document.removeEventListener('click', handler); }
      }
      document.addEventListener('click', handler);
    }, 0);
  }

  function closeCtxMenu() {
    ctxMenuChannel = null;
    var $ctx = document.getElementById('fp-ctx-menu');
    if ($ctx) $ctx.style.display = 'none';
  }

  function ctxTogglePin() {
    if (!ctxMenuChannel) return;
    togglePin(ctxMenuChannel);
    closeCtxMenu();
    updateSidebarPinBtn();
    updateHeaderPinBtn();
    renderConvList();
  }

  /* ── DOM refs ────────────────────────────────────────────────────── */
  var $msgs, $input;

  /* ═══════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════ */
  function init() {
    var raw = sessionStorage.getItem('exp_usuario');
    if (!raw) { window.addEventListener('exp:session-ready', onSessionReady, { once:true }); return; }
    try { user = JSON.parse(raw); } catch(e) { return; }
    if (!user || !user.nome) return;
    if (!user.app_user_id && typeof user.id !== 'undefined') user.app_user_id = user.id;
    if (!user.apelido) user.apelido = (user.nome||'').split(' ')[0]||'';

    sb = (typeof window.sb !== 'undefined' && window.sb)
      ? window.sb
      : supabase.createClient(SB_URL, SB_KEY);
    window.sb = sb; // expõe para o AppNotif (shared/app-notif.js)

    sb.auth.getSession().then(function(r) {
      if (!r.data || !r.data.session) return;
      user.auth_id = r.data.session.user.id;
      mount();
    });
  }

  function onSessionReady(ev) {
    if (ev && ev.detail) { user = ev.detail; if (!user.apelido) user.apelido = (user.nome||'').split(' ')[0]||''; }
    init();
  }

  function mount() {
    var $loading = document.getElementById('fp-loading');
    var $app     = document.getElementById('fp-app');
    if ($loading) $loading.style.display = 'none';
    if ($app)     $app.style.display     = 'flex';

    $msgs  = document.getElementById('fp-messages');
    $input = document.getElementById('fp-input');

    /* Nome no popover de status */
    var $sn = document.getElementById('fp-sopt-name');
    if ($sn) $sn.textContent = firstName(user.nome);

    /* Módulos societários na nav */
    if (isSocioLikeRole(user.role)) {
      document.querySelectorAll('.fp-nav-soc').forEach(function(el) { el.style.display='flex'; });
      var sep = document.getElementById('fp-nav-sep-soc');
      if (sep) sep.style.display = 'block';
    }

    /* Aplicar cor atual */
    syncColorUI();

    applyStatus(userStatus, false);
    setupPresence();
    fetchAllUnread();
    subscribeIncoming();
    startPolling();
    loadTeamMembers();
    initNotif();
    initExpRoom();
    preloadTasksCount();
    applyViewPrefs();
    updateSidebarPinBtn();

    /* Scroll tracking */
    if ($msgs) $msgs.addEventListener('scroll', function() {
      scrolledToEnd = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 48;
    });

    /* Fechar status pop clicando fora */
    document.addEventListener('click', function(e) {
      if (statusPopOpen) {
        var pop = document.getElementById('fp-status-pop');
        var btn = document.getElementById('fp-status-btn');
        if (pop && !pop.contains(e.target) && btn && !btn.contains(e.target)) closeStatusPop();
      }
      /* Fechar notif panel — gerenciado pelo AppNotif via outside-click */
    });

    /* Colar imagem */
    document.addEventListener('paste', function(event) {
      if (!currentChannel || mediaUploadBusy) return;
      var items = Array.from((event.clipboardData && event.clipboardData.items)||[])
        .filter(function(i){ return /^image\/(png|jpeg|webp)$/i.test(i.type||''); });
      if (!items.length) return;
      event.preventDefault();
      items.reduce(function(chain, item) {
        return chain.then(function() { var f=item.getAsFile(); return f ? sendMediaFile(f) : null; });
      }, Promise.resolve());
    });

    /* Fechar media viewer clicando no overlay */
    document.addEventListener('click', function(e) {
      var v = document.getElementById('fp-media-viewer');
      var c = v && v.querySelector('.fp-mv-card');
      if (!v || v.style.display !== 'flex') return;
      if (e.target && e.target.closest && e.target.closest('.fp-media-thumb')) return;
      if (c && c.contains(e.target)) return;
      closeMediaViewer();
    });

    /* Clique no print com ferramenta de marcador ativa */
    var $mvCanvas = document.getElementById('fp-mv-canvas');
    if ($mvCanvas) $mvCanvas.addEventListener('click', mvCanvasClick);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        /* fechar overlay do projeto primeiro */
        var $proj = document.getElementById('fp-proj-overlay');
        if ($proj && $proj.style.display === 'flex') { e.preventDefault(); closeProjectOverlay(); return; }
        if (mediaViewerState) { e.preventDefault(); closeMediaViewer(); return; }
        if (inSearchOpen) { e.preventDefault(); closeInSearch(); return; }
        closeCtxMenu();
        closePinPop();
      }
      if (!mediaViewerState) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); mvPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); mvNext(); }
    });

    /* Fechar overlay do projeto clicando no backdrop */
    var $projOverlay = document.getElementById('fp-proj-overlay');
    if ($projOverlay) {
      $projOverlay.addEventListener('click', function(e) {
        if (e.target === $projOverlay) closeProjectOverlay();
      });
    }

    window.addEventListener('beforeunload', function() { if (presenceCh) presenceCh.untrack(); });

    /* Reconecta o realtime ao voltar para a aba SOMENTE se o canal não estiver ativo */
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState !== 'visible') return;
      var state = msgCh && msgCh.state;
      if (state !== 'joined' && state !== 'joining') subscribeIncoming();
    });

    renderConvList();
  }

  /* ═══════════════════════════════════════════════════════════════════
     COR DE TEMA
  ═══════════════════════════════════════════════════════════════════ */
  function setColor(color) {
    chatColor = color;
    localStorage.setItem(COLOR_KEY, color);
    document.documentElement.setAttribute('data-chat-color', color);
    syncColorUI();
  }

  function syncColorUI() {
    /* atualizar bolinha ativa */
    var $activeDot = document.getElementById('fp-color-active-dot');
    var colorMap = { verde:'#1D6A4A', azul:'#1D4FA0', ouro:'#C4831A', terracota:'#B84C3A' };
    if ($activeDot) $activeDot.style.background = colorMap[chatColor] || colorMap.verde;

    /* marcar no popover */
    document.querySelectorAll('.fp-color-pop-dot').forEach(function(dot) {
      dot.classList.toggle('active', dot.getAttribute('data-color') === chatColor);
    });
  }

  /* ── Visualização: cor, tom de fonte, tamanho, mono ── */
  var FONT_SCALES  = [0.90, 0.95, 1.00, 1.05, 1.10];
  var FONT_LABELS  = ['90%', '95%', '100%', '105%', '110%'];
  var fontSizeIdx = parseInt(localStorage.getItem('exp_chat_font_size') || '2', 10); // default: 100%

  /* Tons de texto — escala de cinza com maior amplitude entre opções */
  var TONES_LIGHT = ['#AAA', '#777', '#333', '#000'];   /* muito claro → preto */
  var TONES_DARK  = ['#555', '#8C8A85', '#C8C3BA', '#F0EDE6']; /* muito escuro → quase branco */
  var fontToneIdx = parseInt(localStorage.getItem('exp_chat_font_tone') || '1', 10);
  var _monoMode   = localStorage.getItem('exp_chat_mono') === '1';

  /* Tons de preview da sidebar — um passo mais claro que o texto de mensagem */
  var TONES_PREVIEW_LIGHT = ['#CCC', '#AAA', '#777', '#444'];
  var TONES_PREVIEW_DARK  = ['#3A3836', '#555', '#8C8A85', '#B4AEA4'];

  function applyViewPrefs() {
    var idx  = Math.max(0, Math.min(fontSizeIdx, FONT_SCALES.length - 1));
    var scale = FONT_SCALES[idx];
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var tone        = dark ? TONES_DARK[fontToneIdx]         : TONES_LIGHT[fontToneIdx];
    var tonePreview = dark ? TONES_PREVIEW_DARK[fontToneIdx] : TONES_PREVIEW_LIGHT[fontToneIdx];

    /* Escala somente as fontes (não os ícones nem a dimensão dos cards) */
    document.body.style.zoom = '';
    document.documentElement.style.setProperty('--fp-fz', String(scale));
    document.documentElement.style.setProperty('--fp-lists-scale', String(scale));

    /* Cor de mensagem — scoped ao container de mensagens */
    var $msgs = document.getElementById('fp-messages');
    if ($msgs) {
      $msgs.style.setProperty('--fp-msg-color', tone);
    }

    /* Aplicar nos previews da sidebar via CSS custom property no root */
    document.documentElement.style.setProperty('--fp-preview-color', tonePreview);
    document.documentElement.style.setProperty('--fp-conv-name-color', tone);
    document.documentElement.style.setProperty('--fp-lists-tone', tone);

    /* atualizar stepper de tamanho */
    var $lbl = document.getElementById('fp-fz-label');
    if ($lbl) $lbl.textContent = FONT_LABELS[idx];
    var $minus = document.getElementById('fp-fz-minus');
    var $plus  = document.getElementById('fp-fz-plus');
    if ($minus) $minus.disabled = (idx <= 0);
    if ($plus)  $plus.disabled  = (idx >= FONT_SCALES.length - 1);
    /* atualizar tom dots */
    var $dots = document.querySelectorAll('.fp-tone-dot');
    $dots.forEach(function(d, i) { d.classList.toggle('active', i === fontToneIdx); });
    /* mono mode */
    document.documentElement.setAttribute('data-chat-mono', _monoMode ? '1' : '0');
    var $mb = document.getElementById('fp-mono-btn');
    if ($mb) $mb.classList.toggle('active', _monoMode);
  }

  function toggleMonoMode(e) {
    if (e) e.stopPropagation();
    _monoMode = !_monoMode;
    localStorage.setItem('exp_chat_mono', _monoMode ? '1' : '0');
    applyViewPrefs();
  }

  function setFontScale(idx) {
    fontSizeIdx = Math.max(0, Math.min(idx, FONT_SCALES.length - 1));
    localStorage.setItem('exp_chat_font_size', String(fontSizeIdx));
    applyViewPrefs();
  }

  function stepFont(delta, e) {
    if (e) e.stopPropagation();
    setFontScale(fontSizeIdx + delta);
  }

  function setFontTone(idx) {
    fontToneIdx = idx;
    localStorage.setItem('exp_chat_font_tone', String(idx));
    applyViewPrefs();
  }

  var viewPickerOpen = false;
  function toggleViewPicker(event) {
    event.stopPropagation();
    var $pop = document.getElementById('fp-view-pop');
    if (!$pop) return;
    viewPickerOpen = !viewPickerOpen;
    $pop.style.display = viewPickerOpen ? 'flex' : 'none';
    if (viewPickerOpen) {
      /* Renderizar tone dots */
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var tones = dark ? TONES_DARK : TONES_LIGHT;
      var $td = document.getElementById('fp-tone-dots');
      if ($td) {
        $td.innerHTML = tones.map(function(c, i) {
          return '<div class="fp-tone-dot' + (i === fontToneIdx ? ' active' : '') + '" ' +
            'style="background:' + c + '" onclick="event.stopPropagation();fpChat.setFontTone(' + i + ')"></div>';
        }).join('');
      }
      applyViewPrefs();
      setTimeout(function() {
        function handler(e) {
          var t = document.getElementById('fp-view-trigger');
          if (!t || !t.contains(e.target)) {
            viewPickerOpen = false;
            $pop.style.display = 'none';
            document.removeEventListener('click', handler);
          }
        }
        document.addEventListener('click', handler);
      }, 0);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATUS
  ═══════════════════════════════════════════════════════════════════ */
  var STATUS_LABELS = { online:'Online', foco:'Foco', ausente:'Ausente' };

  function applyStatus(status, broadcast) {
    if (typeof broadcast === 'undefined') broadcast = true;
    userStatus = status;
    localStorage.setItem(STATUS_KEY, status);
    var dot = document.getElementById('fp-status-dot');
    if (dot) dot.className = 'fp-status-dot ' + status;
    document.querySelectorAll('#fp-status-pop .fp-sopt').forEach(function(o){
      o.classList.toggle('active', o.getAttribute('data-status') === status);
    });
    if (broadcast && presenceCh) presenceCh.track(presencePayload(status));
  }

  function toggleStatusPop() { statusPopOpen ? closeStatusPop() : openStatusPop(); }
  function openStatusPop() {
    var pop = document.getElementById('fp-status-pop');
    if (!pop) return;
    statusPopOpen = true; pop.style.display = 'flex';
  }
  function closeStatusPop() {
    var pop = document.getElementById('fp-status-pop');
    if (!pop) return;
    statusPopOpen = false; pop.style.display = 'none';
  }
  function setStatus(s) { applyStatus(s, true); closeStatusPop(); }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    var btn = document.getElementById('fp-sound-btn');
    if (btn) btn.innerHTML = soundEnabled
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }

  /* ═══════════════════════════════════════════════════════════════════
     TOGGLES
  ═══════════════════════════════════════════════════════════════════ */
  function toggleUnreads() {
    showOnlyUnread = !showOnlyUnread;
    if (showOnlyUnread) showOnlyFlagged = false;
    var bu = document.getElementById('fp-toggle-unread');
    var bf = document.getElementById('fp-toggle-flagged');
    if (bu) bu.classList.toggle('active', showOnlyUnread);
    if (bf) bf.classList.remove('active');
    renderConvList();
  }

  function toggleFlagged() {
    showOnlyFlagged = !showOnlyFlagged;
    if (showOnlyFlagged) showOnlyUnread = false;
    var bu = document.getElementById('fp-toggle-unread');
    var bf = document.getElementById('fp-toggle-flagged');
    if (bf) bf.classList.toggle('active', showOnlyFlagged);
    if (bu) bu.classList.remove('active');
    renderConvList();

    /* Se ativou e há conversa aberta: rolar até a primeira mensagem sinalizada */
    if (showOnlyFlagged && currentChannel && messages.length) {
      renderMessages();
      setTimeout(function() {
        var firstFlagged = messages.find(function(m){ return isMessageFlagged(m.id); });
        if (!firstFlagged) return;
        var el = $msgs && $msgs.querySelector('[data-id="' + CSS.escape(String(firstFlagged.id)) + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     LISTA DE CONVERSAS
  ═══════════════════════════════════════════════════════════════════ */
  function renderConvList() {
    var $list = document.getElementById('fp-conv-list');
    if (!$list) return;

    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72*60*60*1000).toISOString();
    var q     = (filterQuery||'').toLowerCase().trim();

    Promise.all([
      sb.from('chat_messages')
        .select('channel,sender_name,sender_iniciais,sender_cor,content,created_at,sender_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      fetchProjectHomeItems(uid)
    ]).then(function(res) {
      var msgs         = (res[0].data||[]);
      var projectItems = res[1]||[];

      /* DMs */
      var seen={}, dmList=[];
      msgs.forEach(function(m) {
        if (!isDynamicChannel(m.channel) || !channelHasUser(m.channel, uid)) return;
        if (!seen[m.channel]) { seen[m.channel]=true; dmList.push(m); }
      });

      /* Filtro por toggle */
      if (showOnlyFlagged) {
        var flaggedChannels = {};
        flaggedMessages.forEach(function(id) {
          var msg = messages.find(function(m){ return String(m.id)===id; });
          if (msg && msg.channel) flaggedChannels[msg.channel] = true;
        });
        dmList = dmList.filter(function(m){ return flaggedChannels[m.channel]; });
        projectItems = projectItems.filter(function(i){ return flaggedChannels[i.channel]; });
      }
      if (showOnlyUnread) {
        dmList = dmList.filter(function(m){ return (channelUnread[m.channel]||0) > 0; });
        projectItems = projectItems.filter(function(i){ return (channelUnread[i.channel]||i.unread||0) > 0; });
      }

      var html = '';

      /* ── Canais fixos ── */
      var genShow = !q || 'geral'.indexOf(q)!==-1;
      var socShow = isSocioLikeRole(user.role) && (!q || 'sócios'.indexOf(q)!==-1 || 'socios'.indexOf(q)!==-1);

      if (genShow && !(showOnlyUnread && !(channelUnread['general']||0)) && !(showOnlyFlagged)) {
        html += buildConvItemHtml('general', 'geral', '#', null, null, 'Toda a equipe',
          msgs.find(function(m){return m.channel==='general';}),
          channelUnread['general']||0, 'hash-verde');
      }
      if (socShow && !(showOnlyUnread && !(channelUnread['socios']||0)) && !(showOnlyFlagged)) {
        html += buildConvItemHtml('socios', 'sócios', '#', null, null, 'Canal privado',
          msgs.find(function(m){return m.channel==='socios';}),
          channelUnread['socios']||0, 'hash-ouro');
      }

      /* ── Projetos fixados (sempre visíveis, acima dos demais) ── */
      var sortedP = projectItems.slice().sort(function(a,b){
        var ud = (b.unread||0)-(a.unread||0);
        if (ud) return ud;
        return new Date(b.lastCreatedAt||0)-new Date(a.lastCreatedAt||0);
      });
      var projFiltered = sortedP.filter(function(i){ return !q || i.label.toLowerCase().indexOf(q)!==-1; });
      /* projectItems já vem pré-filtrado pelos toggles (showOnlyFlagged / showOnlyUnread) */
      var pinnedFiltered   = projFiltered.filter(function(i){ return isPinned(i.channel); });
      var unpinnedFiltered = projFiltered.filter(function(i){ return !isPinned(i.channel); });

      if (pinnedFiltered.length) {
        if (!q && !showOnlyUnread && !showOnlyFlagged)
          html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Fixados</button>';
        pinnedFiltered.forEach(function(item) {
          html += buildConvItemHtml(item.channel, item.label, item.iniciais, null, item.cor,
            item.preview, null, channelUnread[item.channel]||item.unread||0, '', '', null, true);
        });
      }

      /* ── DMs / Grupos ── */
      var dmFiltered = dmList.filter(function(dm){
        if (!q) return true;
        return getConversationMeta(dm,uid).label.toLowerCase().indexOf(q)!==-1;
      });
      var pinnedDms   = dmFiltered.filter(function(dm){ return pinnedChannels.has(dm.channel); });
      var regularDms  = dmFiltered.filter(function(dm){ return !pinnedChannels.has(dm.channel); });

      function buildDmRow(dm) {
        var meta = getConversationMeta(dm, uid);
        var dmU  = channelUnread[dm.channel]||0;
        var pStatus = 'offline';
        if (dm.channel.startsWith('dm:')) {
          var parts = dm.channel.replace('dm:','').split(':');
          var oUid  = parts.find(function(p){ return p!==uid; });
          var pres  = oUid ? onlinePresence[oUid] : null;
          if (pres) pStatus = pres.status;
        }
        var isPinnedDm  = pinnedChannels.has(dm.channel);
        var chanJson    = dm.channel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        var pinBtn      = '<button class="fp-dm-pin-btn' + (isPinnedDm ? ' is-pinned' : '') + '" ' +
          'title="' + (isPinnedDm ? 'Desafixar' : 'Fixar conversa') + '" ' +
          'onclick="event.stopPropagation();fpChat.toggleDmPin(\'' + chanJson + '\')">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="' + (isPinnedDm ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2a6 6 0 0 0-3-5.2V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5.8A6 6 0 0 0 5 15v2z"/></svg>' +
          '</button>';
        var baseHtml = buildConvItemHtml(dm.channel, meta.label, meta.iniciais, meta.avatarUrl, meta.cor,
          dm.content, dm, dmU, '', pStatus, meta.members);
        /* Injeta o botão de pin antes do fechamento do item */
        return baseHtml.replace('</div>', pinBtn + '</div>');
      }

      if (dmFiltered.length) {
        if (pinnedDms.length && !q && !showOnlyUnread && !showOnlyFlagged)
          html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Fixados</button>';
        pinnedDms.forEach(function(dm){ html += buildDmRow(dm); });

        if (regularDms.length) {
          if (!q && !showOnlyUnread && !showOnlyFlagged)
            html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Mensagens diretas</button>';
          regularDms.forEach(function(dm){ html += buildDmRow(dm); });
        }
      }

      /* ── Projetos (não fixados) ── */
      if (unpinnedFiltered.length) {
        if (!q && !showOnlyUnread && !showOnlyFlagged) {
          html += '<button class="fp-section-hdr" onclick="fpChat.toggleProjectSection()">' +
            '<span>Projetos</span>' +
            '<span>' + (projectSectionCollapsed?'▶':'▾') + '</span>' +
            '</button>';
        }
        var toShow = (q||showOnlyUnread||showOnlyFlagged) ? unpinnedFiltered :
          (projectSectionCollapsed
            ? unpinnedFiltered.filter(function(i){return (channelUnread[i.channel]||i.unread||0)>0;}).slice(0,4)
            : unpinnedFiltered);
        toShow.forEach(function(item) {
          html += buildConvItemHtml(item.channel, item.label, item.iniciais, null, item.cor,
            item.preview, null, channelUnread[item.channel]||item.unread||0, '', '', null, false);
        });
      }

      if (!html) html = '<div class="fp-empty" style="padding:20px;text-align:center;font-size:11px">Nenhuma conversa encontrada.</div>';
      $list.innerHTML = html;
      setActiveConvItem(currentChannel);
    });
  }

  function buildConvItemHtml(channel, label, iniciais, avatarUrl, cor, previewText, lastMsg, unread, avVariant, presenceStatus, members, pinned) {
    var chanJson = channel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var labelEsc = escHtml(label);
    var isUnread = unread > 0;
    var preview  = compactPreviewText(typeof previewText === 'object' && previewText && previewText.content
      ? previewText.content : String(previewText||''), 80, '');
    var ts = '';
    if (lastMsg && lastMsg.created_at) {
      ts = fmtConvTs(new Date(lastMsg.created_at));
    }

    /* Avatar */
    var avHtml;
    if (avVariant === 'hash-verde') {
      avHtml = '<div class="fp-conv-av-wrap"><div class="fp-av-hash" style="background:rgba(29,106,74,.15);color:#1D6A4A">#</div></div>';
    } else if (avVariant === 'hash-ouro') {
      avHtml = '<div class="fp-conv-av-wrap"><div class="fp-av-hash" style="background:rgba(196,131,26,.15);color:#C4831A">#</div></div>';
    } else if (channel.startsWith('group:') && members && members.length >= 2) {
      /* Avatares empilhados */
      var stackClass = members.length >= 3 ? 'fp-av-stack trio' : 'fp-av-stack';
      var stackHtml = '<div class="fp-conv-av-wrap"><div class="' + stackClass + '">';
      members.slice(0, 3).forEach(function(m) {
        if (m.avatar_url) {
          stackHtml += '<img class="fp-av-s" src="' + escHtml(m.avatar_url) + '" alt="" style="object-fit:cover">';
        } else {
          var mc = m.cor || '#1D6A4A';
          var mi = m.iniciais || (m.nome||'').substring(0,2).toUpperCase();
          stackHtml += '<div class="fp-av-s" style="background:' + escHtml(mc) + '">' + escHtml(mi) + '</div>';
        }
      });
      stackHtml += '</div></div>';
      avHtml = stackHtml;
    } else if (isProjectChannel(channel)) {
      /* quadrado arredondado — mesma estrutura do #geral e #socios */
      var pc  = cor || '#1D6A4A';
      var pr16 = parseInt(pc.slice(1,3)||'1D',16);
      var pg16 = parseInt(pc.slice(3,5)||'6A',16);
      var pb16 = parseInt(pc.slice(5,7)||'4A',16);
      var pbg  = 'rgba('+pr16+','+pg16+','+pb16+',.15)';
      avHtml = '<div class="fp-conv-av-wrap">' +
        '<div class="fp-av-hash" style="background:' + pbg + ';color:' + escHtml(pc) + ';font-size:10px">' + escHtml(iniciais||'?') + '</div>' +
        '</div>';
    } else if (avatarUrl) {
      avHtml = '<div class="fp-conv-av-wrap"><img class="fp-av-img" src="' + escHtml(avatarUrl) + '" alt="">' +
        (presenceStatus ? '<span class="fp-presence-dot-sm ' + presenceStatus + '"></span>' : '') +
        '</div>';
    } else {
      var c = cor || '#1D6A4A';
      var ini = iniciais || '?';
      avHtml = '<div class="fp-conv-av-wrap">' +
        '<div class="fp-av-circle" style="background:' + escHtml(c) + '">' + escHtml(ini) + '</div>' +
        (presenceStatus ? '<span class="fp-presence-dot-sm ' + presenceStatus + '"></span>' : '') +
        '</div>';
    }

    var isProj = isProjectChannel(channel);
    var ctxAttr = isProj
      ? ' oncontextmenu="fpChat.openCtxMenu(event,\'' + chanJson + '\')"'
      : '';
    var pinIco = pinned
      ? '<div class="fp-conv-pin-ico"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg></div>'
      : '';

    return '<div class="fp-conv-item' + (isUnread?' unread':'') + '" data-channel="' + escHtml(channel) + '" onclick="fpChat.openChannel(\'' + chanJson + '\',\'' + labelEsc + '\')"' + ctxAttr + '>' +
      avHtml +
      '<div class="fp-conv-body">' +
        '<div class="fp-conv-top">' +
          '<span class="fp-conv-name">' + labelEsc + '</span>' +
          (ts ? '<span class="fp-conv-ts">' + escHtml(ts) + '</span>' : '') +
        '</div>' +
        '<div class="fp-conv-preview">' + escHtml(preview) + '</div>' +
      '</div>' +
      pinIco +
      (unread > 0 ? '<div class="fp-conv-badge">' + unread + '</div>' : '') +
      '</div>';
  }

  function fmtConvTs(dt) {
    var now   = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var msgD  = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    var diffD = Math.round((today - msgD) / 86400000);
    if (diffD === 0) return fmtTime(dt);
    if (diffD === 1) return 'Ontem';
    if (diffD < 7)   return dt.toLocaleDateString('pt-BR',{weekday:'short'});
    return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  }

  function setActiveConvItem(channel) {
    document.querySelectorAll('#fp-conv-list .fp-conv-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-channel') === channel);
    });
  }

  var filterTimer = null;
  function filterConvs(value) {
    filterQuery = String(value||'');
    if (filterTimer) clearTimeout(filterTimer);
    /* Para queries curtas, renderiza imediatamente (filtro local) */
    if (filterQuery.length < 2) { renderConvList(); return; }
    /* Para queries mais longas, debounce + busca no banco */
    filterTimer = setTimeout(function() { renderConvListWithSearch(filterQuery); }, 350);
  }

  function renderConvListWithSearch(q) {
    /* Primeiro renderiza o filtro local (instantâneo) */
    renderConvList();
    if (!q || q.length < 2) return;

    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72*60*60*1000).toISOString();
    var $list = document.getElementById('fp-conv-list');

    /* Busca mensagens contendo o termo */
    sb.from('chat_messages')
      .select('channel,sender_name,content,created_at,sender_id,sender_iniciais,sender_cor')
      .ilike('content', '%' + q + '%')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(function(r) {
        if (filterQuery !== q) return; /* query mudou enquanto esperava */
        var msgs = r.data || [];
        if (!msgs.length) return;

        /* Deduplica por canal, filtra canais que o user pode ver */
        var seen = {};
        var results = [];
        msgs.forEach(function(m) {
          if (seen[m.channel]) return;
          seen[m.channel] = true;
          var ch = m.channel;
          /* Verificar acesso: general, projetos (todos), socios (se sócio), ou canal com uid */
          if (ch !== 'general' && !isProjectChannel(ch) && !(ch === 'socios' && isSocioLikeRole(user.role)) && ch.indexOf(uid) === -1) return;
          results.push(m);
        });

        if (!results.length) return;

        /* Adicionar seção de resultados ao final */
        var extra = '<div class="fp-task-section" style="margin-top:8px">Nas mensagens</div>';
        results.forEach(function(m) {
          var meta    = isDynamicChannel(m.channel) ? getConversationMeta(m, uid) : { label: m.channel === 'general' ? '# geral' : '# sócios', iniciais: '#', cor: '#1D6A4A', avatarUrl: null };
          var chanJson = m.channel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          var labelEsc = escHtml(meta.label);
          var snippet  = String(m.content||'').replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'), function(match){ return '<mark style="background:rgba(0,0,0,.12);border-radius:2px;padding:0 1px">'+escHtml(match)+'</mark>'; });
          var snipSafe = escHtml(String(m.content||'')).replace(new RegExp(escHtml(q),'gi'), function(match){ return '<mark style="background:rgba(0,0,0,.12);border-radius:2px;padding:0 1px">'+match+'</mark>'; });

          extra += '<div class="fp-conv-item" data-channel="'+escHtml(m.channel)+'" onclick="fpChat.openChannel(\''+chanJson+'\',\''+labelEsc+'\')">'+
            '<div class="fp-conv-av-wrap"><div class="fp-av-circle" style="background:'+escHtml(meta.cor||'#1D6A4A')+'">'+escHtml(meta.iniciais||'?')+'</div></div>'+
            '<div class="fp-conv-body">'+
              '<div class="fp-conv-top"><span class="fp-conv-name">'+labelEsc+'</span></div>'+
              '<div class="fp-conv-preview" style="-webkit-line-clamp:2">'+snipSafe+'</div>'+
            '</div>'+
            '</div>';
        });

        /* Adicionar ao final do list atual */
        if ($list) $list.innerHTML += extra;
        setActiveConvItem(currentChannel);
      }).catch(function() {});
  }
  function toggleProjectSection() { projectSectionCollapsed = !projectSectionCollapsed; renderConvList(); }

  /* ═══════════════════════════════════════════════════════════════════
     ABRIR CANAL
  ═══════════════════════════════════════════════════════════════════ */
  function openChannel(channel, displayName) {
    closeMediaViewer();
    clearMessageMediaCache();
    setComposerStatus('','',false);

    /* Guardar último last_read_at ANTES de marcar como lido */
    getChannelLastRead(channel).then(function(ts) {
      channelLastReadAt[channel] = ts;
    });

    currentChannel = channel;
    currentLabel   = displayName || getChannelLabel(channel);

    var $hdrTitle = document.getElementById('fp-hdr-title');
    var $hdrAv    = document.getElementById('fp-hdr-av');
    if ($hdrTitle) $hdrTitle.textContent = currentLabel;
    if ($hdrAv)   $hdrAv.innerHTML = buildChannelHeaderAv(channel);

    var $ph = document.getElementById('fp-placeholder');
    var $ca = document.getElementById('fp-chat-area');
    if ($ph) $ph.style.display = 'none';
    if ($ca) $ca.style.display = 'flex';

    updateChannelSubtitle();
    updateHeaderPinBtn();
    messages = [];
    loadMessages();
    markRead();
    setActiveConvItem(channel);
    renderConvList();
    setTimeout(function(){ if ($input) $input.focus(); }, 80);
  }

  function getChannelLastRead(channel) {
    if (isProjectChannel(channel)) {
      var tid = projectThreadIdFromChannel(channel);
      return sb.from('chat_thread_reads')
        .select('last_read_at').eq('user_auth_id', user.auth_id).eq('thread_id', tid)
        .maybeSingle()
        .then(function(r){ return r.data ? r.data.last_read_at : null; })
        .catch(function(){ return null; });
    }
    return sb.from('chat_read_status')
      .select('last_read_at').eq('user_id', user.auth_id).eq('channel', channel)
      .maybeSingle()
      .then(function(r){ return r.data ? r.data.last_read_at : null; })
      .catch(function(){ return null; });
  }

  function buildChannelHeaderAv(channel) {
    if (channel==='general') return '<div style="width:34px;height:34px;border-radius:9px;background:var(--ca-bg);color:var(--ca);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">#</div>';
    if (channel==='socios')  return '<div style="width:34px;height:34px;border-radius:9px;background:#FBF3E8;color:#C4831A;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">#</div>';
    if (channel.startsWith('dm:')) {
      var parts = channel.replace('dm:','').split(':');
      var oUid  = parts.find(function(p){return p!==user.auth_id;});
      var mem   = oUid ? allMembers.find(function(m){return m.auth_id===oUid;}) : null;
      if (mem) {
        if (mem.avatar_url) return '<img style="width:34px;height:34px;border-radius:50%;object-fit:cover" src="'+escHtml(mem.avatar_url)+'" alt="">';
        return '<div style="width:34px;height:34px;border-radius:50%;background:'+escHtml(mem.cor||'#1D6A4A')+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;font-family:\'DM Mono\',monospace">' + escHtml((mem.iniciais||(mem.nome||'').substring(0,2)).toUpperCase()) + '</div>';
      }
    }
    if (isProjectChannel(channel) && projectThreadMeta[channel]) {
      var meta = projectThreadMeta[channel];
      return '<div style="width:34px;height:34px;border-radius:9px;background:'+escHtml(meta.cor||'#1D6A4A')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:\'DM Mono\',monospace">' + escHtml(meta.iniciais||'P') + '</div>';
    }
    var ini2 = initialsFromLabel(currentLabel,'GP');
    var cor2 = brandColorForKey(channel);
    return '<div style="width:34px;height:34px;border-radius:9px;background:'+escHtml(cor2)+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:\'DM Mono\',monospace">' + escHtml(ini2) + '</div>';
  }

  function updateChannelSubtitle() {
    var $sub = document.getElementById('fp-hdr-sub');
    var $dot = document.getElementById('fp-hdr-status-dot');
    if (!$sub) return;

    if (currentChannel && currentChannel.startsWith('dm:')) {
      /* DM: dot sobreposto ao avatar + texto de status abaixo do nome */
      var parts = currentChannel.replace('dm:','').split(':');
      var oUid  = parts.find(function(p){return p!==user.auth_id;});
      var pres  = oUid ? onlinePresence[oUid] : null;
      var st    = pres ? pres.status : 'offline';
      var stLab = {online:'Online', foco:'Foco', ausente:'Ausente', offline:'Offline'};
      if ($dot) $dot.className = 'fp-hdr-status-dot ' + st;
      $sub.className = 'fp-hdr-sub visible';
      $sub.textContent = stLab[st] || st;

    } else if (currentChannel && currentChannel.startsWith('group:')) {
      if ($dot) $dot.className = 'fp-hdr-status-dot'; /* oculto */
      var uids   = currentChannel.replace('group:','').split(':');
      var onlineN = uids.filter(function(u){return onlinePresence[u];}).length;
      $sub.className = 'fp-hdr-sub visible';
      $sub.textContent = onlineN + ' de ' + uids.length + ' online';

    } else if (isProjectChannel(currentChannel)) {
      if ($dot) $dot.className = 'fp-hdr-status-dot';
      $sub.className = 'fp-hdr-sub visible';
      $sub.textContent = 'Chat do projeto';

    } else {
      if ($dot) $dot.className = 'fp-hdr-status-dot';
      $sub.className = 'fp-hdr-sub';
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     NOVO DM
  ═══════════════════════════════════════════════════════════════════ */
  function openNewDM(event) {
    selectedMembers = [];
    var $panel = document.getElementById('fp-members-panel');
    var $btn   = document.getElementById('fp-new-dm-btn');
    if (!$panel) return;

    /* Posicionar à direita do botão */
    $panel.style.display = 'flex';
    var btn  = (event && event.currentTarget) || $btn;
    if (btn) {
      var rect     = btn.getBoundingClientRect();
      var panelH   = $panel.offsetHeight || 380;
      /* um pouco acima do botão */
      var topPos   = Math.max(16, Math.min(rect.top - 40, window.innerHeight - panelH - 16));
      $panel.style.top  = topPos + 'px';
      $panel.style.left = (rect.right + 8) + 'px';
    }
    renderMembersModal();

    /* Fechar clicando fora — ignora alvos que saíram do DOM (re-render) */
    setTimeout(function() {
      function handler(e) {
        /* Se o alvo já não está no documento (DOM substituído por re-render), ignorar */
        if (!document.body.contains(e.target)) return;
        var p = document.getElementById('fp-members-panel');
        var b = document.getElementById('fp-new-dm-btn');
        if (!p) return;
        if (!p.contains(e.target) && !(b && b.contains(e.target))) {
          closeNewDM();
          document.removeEventListener('click', handler);
        }
      }
      document.addEventListener('click', handler);
    }, 0);
  }

  function closeNewDM() {
    selectedMembers = [];
    var $p = document.getElementById('fp-members-panel');
    if ($p) $p.style.display = 'none';
  }
  function renderMembersModal() {
    var $list = document.getElementById('fp-members-list');
    if (!$list) return;
    if (!teamMembers.length) { $list.innerHTML='<div class="fp-empty" style="padding:20px;text-align:center;font-size:11px">Carregando...</div>'; return; }
    var roleLabel = { socio:'Sócio', socio_adm:'Sócio administrador', socio_admin:'Sócio administrador', coordenador:'Coordenador', colaborador:'Colaborador' };
    var html = '';
    teamMembers.forEach(function(m) {
      var cor = m.cor||'#1D6A4A';
      var ini = m.iniciais||(m.nome||'').substring(0,2).toUpperCase();
      var sel = selectedMembers.findIndex(function(s){return s.auth_id===m.auth_id;})!==-1;
      var pres = onlinePresence[m.auth_id];
      var ps   = pres ? pres.status : 'offline';
      var pl   = {online:'Online',foco:'Foco',ausente:'Ausente',offline:'Offline'};
      var normalizedRole = typeof window.normalizeExpRole === 'function' ? window.normalizeExpRole(m.role) : (m.role||'').toLowerCase();
      var roleT= roleLabel[normalizedRole] || roleLabel[(m.role||'').toLowerCase()] || '';
      html += '<div class="fp-member-item'+(sel?' sel':'')+'" onclick="fpChat.toggleMember(\''+m.auth_id+'\')">'+
        '<div class="fp-member-check'+(sel?' sel':'')+'"></div>'+
        '<div style="position:relative;flex-shrink:0">'+
          (m.avatar_url
            ? '<img style="width:32px;height:32px;border-radius:50%;object-fit:cover" src="'+escHtml(m.avatar_url)+'" alt="">'
            : '<div style="width:32px;height:32px;border-radius:50%;background:'+escHtml(cor)+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;font-family:\'DM Mono\',monospace">'+escHtml(ini)+'</div>')+
          '<span class="fp-presence-dot-sm '+ps+'" style="position:absolute;bottom:-1px;right:-1px"></span>'+
        '</div>'+
        '<div>'+
          '<div class="fp-member-name">'+escHtml(m.nome)+'</div>'+
          '<div class="fp-member-role">'+escHtml(pl[ps])+' · '+escHtml(roleT)+'</div>'+
        '</div>'+
        '</div>';
    });
    $list.innerHTML = html;
    var n = selectedMembers.length;
    var $info = document.getElementById('fp-members-info');
    if ($info) $info.textContent = n===0?'Selecione um ou mais membros': n===1?'1 pessoa selecionada': n+' pessoas selecionadas';
  }
  function toggleMember(authId) {
    var idx = selectedMembers.findIndex(function(m){return m.auth_id===authId;});
    if (idx===-1) { var mem=teamMembers.find(function(m){return m.auth_id===authId;}); if(mem) selectedMembers.push(mem); }
    else selectedMembers.splice(idx,1);
    renderMembersModal();
  }
  function confirmNewDM() {
    if (!selectedMembers.length) return;
    var ch, label;
    if (selectedMembers.length===1) {
      var m=selectedMembers[0]; ch=dmChannel(user.auth_id,m.auth_id); label=firstName(m.nome);
    } else {
      var allUids=[user.auth_id].concat(selectedMembers.map(function(m){return m.auth_id;})).sort();
      ch='group:'+allUids.join(':');
      label=selectedMembers.map(function(m){return firstName(m.nome);}).join(', ');
    }
    closeNewDM();
    openChannel(ch, label);
  }
  function dmChannel(u1,u2){ return 'dm:'+[u1,u2].sort().join(':'); }

  /* ═══════════════════════════════════════════════════════════════════
     PRESENCE
  ═══════════════════════════════════════════════════════════════════ */
  function setupPresence() {
    presenceCh = sb.channel('exp:chat:presence');
    presenceCh
      .on('presence',{event:'sync'}, function() {
        var state = presenceCh.presenceState();
        onlinePresence = {};
        Object.keys(state).forEach(function(k){
          state[k].forEach(function(p){ if(p.user_id) onlinePresence[p.user_id]=p; });
        });
        updateChannelSubtitle();
        renderConvList();
      })
      .subscribe(function(s){ if(s==='SUBSCRIBED') presenceCh.track(presencePayload(userStatus)); });
  }
  function presencePayload(status) {
    return { user_id:user.auth_id, nome:user.nome, iniciais:user.iniciais||(user.nome||'').substring(0,2).toUpperCase(), cor:user.cor||'#1D6A4A', status:status };
  }

  /* ═══════════════════════════════════════════════════════════════════
     REALTIME
  ═══════════════════════════════════════════════════════════════════ */
  function subscribeIncoming() {
    if (msgCh) { sb.removeChannel(msgCh); msgCh=null; }
    msgCh = sb.channel('exp:chatfp:v2')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'}, function(payload){
        var msg=payload.new, ch=msg.channel, uid=user.auth_id;
        var isSocios = ch==='socios' && isSocioLikeRole(user.role);
        if (ch!=='general' && !isSocios && ch.indexOf(uid)===-1) return;
        if (_wasSeen(msg.id)) return;
        _markSeen(msg.id);
        var isActive=(currentChannel===ch), isOwn=(msg.sender_id===uid);
        console.log('[EXP ChatFP] msg recebida', { ch, uid, sender_id: msg.sender_id, isOwn, isActive, soundEnabled, userStatus, visibility: document.visibilityState });
        if (isActive) {
          upsertMessage(msg); renderMessages();
          if (scrolledToEnd) scrollBottom(); else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch]=(channelUnread[ch]||0)+1;
          updatePageTitle(); renderConvList();
          if (_shouldPlaySound(ch)) playNotificationSound(); _sendChatPush(msg);
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_messages'}, function(payload){
        var up=payload.new; if(up.channel!==currentChannel) return;
        upsertMessage(up); renderMessages();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_thread_messages'}, function(payload){
        var raw=payload.new;
        if (_wasSeen('t:'+raw.id)) return;
        _markSeen('t:'+raw.id);
        var msg=normalizeProjectMessage(raw), ch=msg.channel;
        if (!projectThreadMeta[ch]) projectThreadMeta[ch]=buildProjectThreadMeta(raw.thread_id,null,raw.content,raw.created_at,raw.sender_auth_id);
        updateProjectThreadSnapshot(raw.thread_id,raw.content,raw.created_at,raw.sender_auth_id);
        var isActive=(currentChannel===ch), isOwn=(raw.sender_auth_id===user.auth_id);
        if (isActive) {
          upsertMessage(msg); renderMessages();
          if (scrolledToEnd) scrollBottom(); else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch]=(channelUnread[ch]||0)+1;
          updatePageTitle(); renderConvList();
          if (_shouldPlaySound(ch)) playNotificationSound(); _sendChatPush(msg);
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_thread_messages'}, function(payload){
        var up=normalizeProjectMessage(payload.new);
        updateProjectThreadSnapshot(payload.new.thread_id,payload.new.content,payload.new.created_at,payload.new.sender_auth_id);
        if (up.channel!==currentChannel) return;
        upsertMessage(up); renderMessages();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'gestao_anexos_temporarios'}, function(p){ handleChatTempMediaRealtime(p.new); })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'gestao_anexos_temporarios'}, function(p){ handleChatTempMediaRealtime(p.new); })
      .subscribe(function(status, err) {
        console.log('[EXP ChatFP] realtime status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('[EXP ChatFP] realtime conectado ✓');
          /* Após uma queda, busca o que chegou enquanto estava offline */
          if (_realtimeDropped) {
            _realtimeDropped = false;
            console.log('[EXP ChatFP] recuperando mensagens perdidas...');
            fetchAllUnread();
            renderConvList();
            if (currentChannel) loadMessages();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          _realtimeDropped = true;
          if (status !== 'CLOSED') {
            console.warn('[EXP ChatFP] reconectando em 4s...');
            setTimeout(function () {
              var s = msgCh && msgCh.state;
              if (s !== 'joined' && s !== 'joining') subscribeIncoming();
            }, 4000);
          }
        }
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     POLLING FALLBACK — pega mensagens perdidas quando o realtime cai.
     Timer num Web Worker (não sofre throttling de aba em background);
     dedup por id evita som/push duplicado com o realtime.
  ═══════════════════════════════════════════════════════════════════ */
  var POLL_INTERVAL_MS = 30000;
  var _lastPollTs = new Date().toISOString();
  var _seenMsgIds = {};
  function _markSeen(id) { if (id != null) _seenMsgIds[String(id)] = true; }
  function _wasSeen(id)  { return id != null && !!_seenMsgIds[String(id)]; }

  function _processMissedMessage(msg) {
    var ch  = msg.channel;
    var uid = user.auth_id;
    var isSocios = ch === 'socios' && isSocioLikeRole(user.role);
    if (ch !== 'general' && !isSocios && ch.indexOf(uid) === -1) return;
    if (msg.sender_id === uid) return;
    console.log('[EXP ChatFP] msg recuperada via polling', { ch: ch, id: msg.id });

    if (currentChannel === ch) {
      upsertMessage(msg); renderMessages();
      if (scrolledToEnd) scrollBottom(); else showNewMsgToast();
      markRead();
      return;
    }
    channelUnread[ch] = (channelUnread[ch] || 0) + 1;
    updatePageTitle(); renderConvList();
    if (_shouldPlaySound(ch)) playNotificationSound();
    _sendChatPush(msg);
  }

  function _pollMissed() {
    if (!sb || !user || !user.auth_id) return;
    var since = _lastPollTs;
    Promise.all([
      sb.from('chat_messages').select('*').gt('created_at', since).order('created_at'),
      sb.from('chat_thread_messages').select('*').gt('created_at', since).order('created_at')
    ]).then(function (res) {
      (res[0].data || []).forEach(function (m) {
        if (m.created_at > _lastPollTs) _lastPollTs = m.created_at;
        if (_wasSeen(m.id)) return;
        _markSeen(m.id);
        _processMissedMessage(m);
      });
      (res[1].data || []).forEach(function (raw) {
        if (raw.created_at > _lastPollTs) _lastPollTs = raw.created_at;
        if (_wasSeen('t:' + raw.id)) return;
        _markSeen('t:' + raw.id);
        updateProjectThreadSnapshot(raw.thread_id, raw.content, raw.created_at, raw.sender_auth_id);
        var m = normalizeProjectMessage(raw);
        m.sender_id = raw.sender_auth_id;
        _processMissedMessage(m);
      });
    }).catch(function () {});
  }

  function startPolling() {
    try {
      /* Timer num Web Worker: não sofre throttling de aba em background */
      var blob = new Blob(['setInterval(function(){postMessage(1)},' + POLL_INTERVAL_MS + ')'], { type: 'text/javascript' });
      var w = new Worker(URL.createObjectURL(blob));
      w.onmessage = _pollMissed;
    } catch (e) {
      setInterval(_pollMissed, POLL_INTERVAL_MS);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CARREGAR MENSAGENS
  ═══════════════════════════════════════════════════════════════════ */
  function loadMessages() {
    if (isLoading) return;
    var channel=currentChannel, seq=++loadRequestSeq;
    isLoading=true; showLoading();
    if (isProjectChannel(channel)) {
      sb.from('chat_thread_messages').select('*').eq('thread_id',projectThreadIdFromChannel(channel))
        .order('created_at',{ascending:false}).limit(200)
        .then(function(r){
          if (seq!==loadRequestSeq||channel!==currentChannel) return;
          isLoading=false;
          if (r.error){showError();return;}
          messages=(r.data||[]).slice().reverse().map(normalizeProjectMessage);
          clearMessageMediaCache(); renderMessages(); loadCurrentMessageMedia(); scrollBottom();
        });
      return;
    }
    var since=new Date(Date.now()-72*60*60*1000).toISOString();
    sb.from('chat_messages').select('*').eq('channel',channel).gte('created_at',since)
      .order('created_at',{ascending:true})
      .then(function(r){
        if (seq!==loadRequestSeq||channel!==currentChannel) return;
        isLoading=false;
        if (r.error){showError();return;}
        messages=r.data||[];
        clearMessageMediaCache(); renderMessages(); loadCurrentMessageMedia(); scrollBottom();
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     NÃO LIDAS
  ═══════════════════════════════════════════════════════════════════ */
  function fetchAllUnread() {
    var uid=user.auth_id, since=new Date(Date.now()-72*60*60*1000).toISOString();
    fetchProjectUnreadMap(uid).then(function(pu){
      Object.keys(pu||{}).forEach(function(k){ channelUnread[k]=pu[k]; });
      updatePageTitle(); renderConvList();
    });
    sb.from('chat_read_status').select('channel,last_read_at').eq('user_id',uid)
      .then(function(r){
        if(r.error) return;
        var readMap={};
        (r.data||[]).forEach(function(row){ readMap[row.channel]=row.last_read_at; });
        var fixedCh=['general'];
        if(isSocioLikeRole(user.role)) fixedCh.push('socios');
        fixedCh.forEach(function(ch){
          var lr=readMap[ch]||since;
          sb.from('chat_messages').select('*',{count:'exact',head:true}).eq('channel',ch).gt('created_at',lr).neq('sender_id',uid)
            .then(function(r2){ if(r2.count) channelUnread[ch]=r2.count; updatePageTitle(); });
        });
        sb.from('chat_messages').select('channel,sender_id,created_at').gte('created_at',since).order('created_at',{ascending:false})
          .then(function(r2){
            if(r2.error) return;
            var preserved={};
            Object.keys(channelUnread).forEach(function(k){ if(isProjectChannel(k)) preserved[k]=channelUnread[k]; });
            var next={};
            (r2.data||[]).forEach(function(msg){
              if(msg.sender_id===uid) return;
              var lr=readMap[msg.channel]||since;
              if(msg.created_at>lr) next[msg.channel]=(next[msg.channel]||0)+1;
            });
            channelUnread=next;
            Object.keys(preserved).forEach(function(k){ channelUnread[k]=preserved[k]; });
            updatePageTitle(); renderConvList();
          });
      });
  }

  function markRead() {
    var channel=currentChannel;
    if (isProjectChannel(channel)) {
      sb.from('chat_thread_reads').upsert({ user_auth_id:user.auth_id, thread_id:projectThreadIdFromChannel(channel), last_read_at:new Date().toISOString() })
        .then(function(r){ if(r.error) return; channelUnread[channel]=0; if(projectThreadMeta[channel]) projectThreadMeta[channel].unread=0; updatePageTitle(); renderConvList(); });
      return;
    }
    sb.from('chat_read_status').upsert({ user_id:user.auth_id, channel:channel, last_read_at:new Date().toISOString() })
      .then(function(r){ if(r.error) return; channelUnread[channel]=0; updatePageTitle(); renderConvList(); });
  }

  function updatePageTitle() {
    var total=Object.keys(channelUnread).reduce(function(a,k){return a+(channelUnread[k]||0);},0);
    document.title = total>0 ? '('+total+') EXP · Chat' : 'EXP · Chat';
  }

  /* ═══════════════════════════════════════════════════════════════════
     ENVIAR
  ═══════════════════════════════════════════════════════════════════ */
  function send() {
    if (!$input||!currentChannel) return;
    var content=$input.value.trim(); if(!content) return;
    $input.value=''; $input.style.height='auto';
    var pm=buildPendingMessage(content);
    upsertMessage(pm); renderMessages(); scrollBottom();
    if (isProjectChannel(currentChannel)) {
      sb.from('chat_thread_messages').insert({ thread_id:currentChannel.replace('project:',''), sender_auth_id:user.auth_id, content:content })
        .select('*').single().then(function(r){
          if(r.error){ removeMessageById(pm.id); renderMessages(); $input.value=content; return; }
          upsertMessage(normalizeProjectMessage(r.data)); renderMessages();
        });
      return;
    }
    sb.from('chat_messages').insert({
      channel:currentChannel, sender_id:user.auth_id, sender_name:user.nome,
      sender_iniciais:user.iniciais||(user.nome||'').substring(0,2).toUpperCase(),
      sender_cor:user.cor||'#1D6A4A', content:content
    }).select('*').single().then(function(r){
      if(r.error){ removeMessageById(pm.id); renderMessages(); $input.value=content; return; }
      upsertMessage(r.data); renderMessages();
    });
  }
  function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }
  function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

  /* ═══════════════════════════════════════════════════════════════════
     REAÇÕES
  ═══════════════════════════════════════════════════════════════════ */
  function react(msgId, type) {
    var msg=messages.find(function(m){return m.id===msgId;}); if(!msg) return;
    var isPrj=isProjectChannel(msg.channel);
    var lockKey=msgId+'|'+type; if(reactionLocks[lockKey]) return;
    var uid=user.auth_id, rx=normalizeReactions(msg.reactions);
    var arr=(rx[type]||[]).slice();
    var idx=arr.indexOf(uid); if(idx===-1) arr.push(uid); else arr.splice(idx,1);
    msg.reactions=Object.assign({},rx,{[type]:arr});
    renderMessages();
    reactionLocks[lockKey]=true;
    sb.rpc(isPrj?'chat_thread_toggle_reaction':'chat_toggle_reaction', {p_message_id:msgId,p_reaction:type})
      .then(function(r){
        if(r.error){ msg.reactions=rx; renderMessages(); return; }
        var upd=Array.isArray(r.data)?r.data[0]:r.data;
        if(upd&&upd.id) upsertMessage(isPrj?normalizeProjectMessage(upd):upd);
        renderMessages();
      })
      .finally(function(){ delete reactionLocks[lockKey]; });
  }

  function flagMessage(msgId) {
    toggleFlag(msgId);
    renderMessages();
    if (showOnlyFlagged) renderConvList();
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER MENSAGENS — estilo Slack (flat, sem bolhas)
  ═══════════════════════════════════════════════════════════════════ */
  function renderMessages() {
    if (!$msgs) return;

    /* Sinalizadas: mostra TODA a conversa (contexto), não filtra.
       A mensagem sinalizada vira um marco visual na linha do tempo. */
    var toRender = messages;

    if (!toRender.length) {
      $msgs.innerHTML = '<div class="fp-empty"><div class="fp-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>Nenhuma mensagem ainda.</div>';
      return;
    }

    var uid = user.auth_id;
    var lastReadAt = channelLastReadAt[currentChannel] || null;
    var html = '';
    var prevSender=null, prevTime=null, lastDate=null;

    toRender.forEach(function(msg) {
      var msgIdx   = messages.indexOf(msg);
      var isOwn    = msg.sender_id===uid;
      var dt       = new Date(msg.created_at);
      var dateStr  = dt.toDateString();
      var isFlagged = isMessageFlagged(msg.id);
      /* Não lida: criada DEPOIS do last_read_at anterior */
      var isUnread = !isOwn && lastReadAt && msg.created_at > lastReadAt;
      /* Busca interna: é o resultado atualmente focado? */
      var isCurrentResult = inSearchQuery && inSearchResults.length > 0 && inSearchResults[inSearchCurrent] === msgIdx;
      var isAnyResult     = inSearchQuery && inSearchResults.indexOf(msgIdx) !== -1;

      if (dateStr!==lastDate) {
        lastDate=dateStr;
        html += '<div class="fp-date-sep">'+fmtDateSep(dt)+'</div>';
        prevSender=null;
      }

      var gap     = prevTime ? (dt-prevTime) : Infinity;
      var grouped = msg.sender_id===prevSender && gap < 5*60*1000;

      var iniciais= msg.sender_iniciais||(msg.sender_name||'??').substring(0,2).toUpperCase();
      var cor     = msg.sender_cor||'#1D6A4A';
      var fn      = firstName(msg.sender_name||'');
      var memb    = allMembers.find(function(m){return m.auth_id===msg.sender_id;});
      var avatar  = memb ? memb.avatar_url : null;

      var media       = getMessageMedia(msg);
      var imageOnly   = isImageOnlySentinel(msg.content);
      var hasText     = !!String(msg.content||'').trim() && !imageOnly;
      var showExpired = imageOnly && !media && isChatMediaExpired(msg);
      var showMediaPending = imageOnly && !media && !showExpired;
      var showFailed  = !!msg.failed;
      var showLoadFailed = !!(media&&media.failed_load);

      var rx     = normalizeReactions(msg.reactions);
      var likeArr= rx.like||[], loveArr=rx.love||[];
      var liked  = likeArr.indexOf(uid)!==-1, loved=loveArr.indexOf(uid)!==-1;
      var likeN  = likeArr.length, loveN=loveArr.length;

      /* Classe do bloco */
      var blockClass = 'fp-msg-block';
      if (isOwn)           blockClass += ' own';
      if (grouped)         blockClass += ' grouped';
      if (isFlagged)       blockClass += ' flagged';
      else if (isUnread)   blockClass += ' unread';
      if (isCurrentResult) blockClass += ' search-current';
      else if (isAnyResult) blockClass += ' search-match';

      /* Avatar */
      var avHtml = avatar
        ? '<div class="fp-msg-av"><img src="'+escHtml(avatar)+'" alt=""></div>'
        : '<div class="fp-msg-av" style="background:'+escHtml(cor)+'">'+escHtml(iniciais)+'</div>';

      html += '<div class="'+blockClass+'" data-id="'+escHtml(String(msg.id))+'">';

      /* Coluna do avatar */
      html += avHtml;

      /* Conteúdo */
      html += '<div class="fp-msg-content">';

      /* Header (nome + hora) apenas no primeiro do bloco */
      if (!grouped) {
        html += '<div class="fp-msg-header">' +
          '<span class="fp-msg-name">' + escHtml(fn) + '</span>' +
          '<span class="fp-msg-ts">' + fmtTime(dt) + '</span>' +
          '</div>';
      }

      /* Texto */
      if (hasText) {
        var textHtml = fpLinkify(escHtml(msg.content).replace(/\n/g,'<br>'));
        if (inSearchQuery) textHtml = highlightText(textHtml, inSearchQuery, isCurrentResult);
        html += '<div class="fp-msg-text">'+textHtml+'</div>';
      }

      /* Mídia */
      if (media && media.objectUrl) {
        html += '<div class="fp-media-thumb" onclick="fpChat.openMediaViewer(\''+escHtml(mediaKeyForMessage(msg))+'\')">' +
          '<img src="'+escHtml(media.objectUrl)+'" alt="Print"></div>';
      } else if (media && media.pending) {
        html += '<div class="fp-media-thumb" style="padding:14px;font-size:11px;color:#999">Enviando print…</div>';
      } else if (showLoadFailed) {
        html += '<button type="button" style="margin-top:4px;font-size:11px;color:#B84C3A;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline" onclick="fpChat.retryMediaIssue(\''+escHtml(String(msg.id))+'\')">Falha ao carregar print. Clique para tentar de novo.</button>';
      } else if (showExpired) {
        html += '<div class="fp-media-expired">Print expirado</div>';
      } else if (showMediaPending) {
        html += '<div class="fp-media-thumb" style="padding:14px;font-size:11px;color:#999">Carregando print…</div>';
      }
      if (showFailed) {
        html += '<button type="button" style="margin-top:4px;font-size:11px;color:#B84C3A;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline" onclick="fpChat.retryMediaIssue(\''+escHtml(String(msg.id))+'\')">Falha no envio. Clique para tentar de novo.</button>';
      }

      /* Reações inline */
      if (likeN>0||loveN>0) {
        html += '<div class="fp-msg-reactions">';
        if (likeN>0) html += '<button class="fp-rxn-btn like'+(liked?' active':'')+'" onclick="fpChat.react(\''+escHtml(String(msg.id))+'\',\'like\')" title="Curtir">👍 <span class="fp-rxn-count">'+likeN+'</span></button>';
        if (loveN>0) html += '<button class="fp-rxn-btn heart'+(loved?' active':'')+'" onclick="fpChat.react(\''+escHtml(String(msg.id))+'\',\'love\')" title="Amei">❤️ <span class="fp-rxn-count">'+loveN+'</span></button>';
        html += '</div>';
      }

      html += '</div>'; /* /fp-msg-content */

      /* Botões de ação (hover) */
      html += '<div class="fp-msg-actions">' +
        '<button class="fp-action-btn like" onclick="fpChat.react(\''+escHtml(String(msg.id))+'\',\'like\')" title="Curtir">'+icoLike()+'</button>' +
        '<button class="fp-action-btn heart" onclick="fpChat.react(\''+escHtml(String(msg.id))+'\',\'love\')" title="Amei">'+icoHeart()+'</button>' +
        '<button class="fp-action-btn'+(isFlagged?' flag-active':'')+'" onclick="fpChat.flagMessage(\''+escHtml(String(msg.id))+'\')" title="Sinalizar">'+icoFlag()+'</button>' +
        '</div>';

      html += '</div>'; /* /fp-msg-block */

      prevSender=msg.sender_id; prevTime=dt;
    });

    $msgs.innerHTML = html;
  }

  function fpLinkify(html) {
    return html.replace(/(https?:\/\/[^\s&"<>]+)/g, function(url) {
      return '<a href="'+url+'" target="_blank" rel="noopener noreferrer" class="fp-link">'+url+'</a>';
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDIA
  ═══════════════════════════════════════════════════════════════════ */
  function pickMedia() {
    if (mediaUploadBusy) return;
    var input=document.getElementById('fp-media-input'); if(!input) return;
    input.value='';
    if (typeof input.showPicker==='function') input.showPicker(); else input.click();
  }
  async function handleMediaInput(input) {
    var f=input&&input.files?input.files[0]:null; if(!f) return;
    try { await sendMediaFile(f); } finally { input.value=''; }
  }
  function mediaRpcContent(c){ return isImageOnlySentinel(c)?'':String(c||''); }

  async function sendMediaFile(file) {
    if (!currentChannel||mediaUploadBusy) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type||'')) { setComposerStatus('Use apenas PNG, JPG ou WEBP.','warn',true); return; }
    mediaUploadBusy=true;
    var content=($input?($input.value||'').trim():'');
    if ($input){ $input.value=''; $input.style.height='auto'; }
    var optimized=null, previewUrl=null, pendingMsg=null;
    var contextType=isProjectChannel(currentChannel)?'chat_thread_message':'chat_message';
    var messageId=newUuid();
    try {
      setComposerStatus('Otimizando print...','',true);
      var cfg=await loadChatMediaConfig();
      optimized=await optimizeChatMediaImage(file,cfg);
      previewUrl=URL.createObjectURL(optimized.blob);
      pendingMsg=buildPendingMessage(content||CHAT_IMAGE_SENTINEL,{
        id:messageId,
        temp_media:{objectUrl:previewUrl,mime_type:optimized.mimeType,arquivo_ext:optimized.ext,
          width_px:optimized.width,height_px:optimized.height,expires_at:addDaysIso(7),
          pending:true,failed:false,failed_load:false,blob:optimized.blob}
      });
      upsertMessage(pendingMsg);
      assignMessageMedia(contextType,messageId,{
        storage_path:null,objectUrl:previewUrl,mime_type:optimized.mimeType,
        arquivo_ext:optimized.ext,width_px:optimized.width,height_px:optimized.height,
        pending:true,failed:false,failed_load:false,blob:optimized.blob,expires_at:addDaysIso(7)
      });
      renderMessages(); scrollBottom();
      await persistPreparedMedia({blob:optimized.blob,mimeType:optimized.mimeType,ext:optimized.ext,
        width:optimized.width,height:optimized.height,objectUrl:previewUrl},
        mediaRpcContent(content||CHAT_IMAGE_SENTINEL),contextType,pendingMsg);
    } catch(err) {
      var failMsg=describeChatMediaError(err);
      if (pendingMsg&&pendingMsg.id){ pendingMsg.pending=false; pendingMsg.failed=true; pendingMsg.error_message=failMsg; upsertMessage(pendingMsg); }
      if (previewUrl) assignMessageMedia(contextType,pendingMsg?pendingMsg.id:messageId,{
        storage_path:null,objectUrl:previewUrl,mime_type:optimized&&optimized.mimeType||null,
        arquivo_ext:optimized&&optimized.ext||null,pending:false,failed:true,failed_load:false,
        blob:optimized&&optimized.blob||null,expires_at:addDaysIso(7)
      });
      setComposerStatus('Falha: '+failMsg,'warn',true); renderMessages();
    } finally { mediaUploadBusy=false; }
  }

  async function persistPreparedMedia(prepared,content,contextType,pendingMsg) {
    if (!prepared||!prepared.blob) throw new Error('Print não disponível.');
    var storagePath='', uploaded=false;
    var previewUrl=prepared.objectUrl||(pendingMsg&&pendingMsg.temp_media&&pendingMsg.temp_media.objectUrl)||null;
    var targetChannel=pendingMsg&&pendingMsg.channel?pendingMsg.channel:currentChannel;
    var targetThreadId=pendingMsg&&pendingMsg.thread_id?pendingMsg.thread_id:projectThreadIdFromChannel(currentChannel);
    try {
      storagePath=buildChatMediaPath(contextType,prepared.ext);
      setComposerStatus('Enviando print...','',true);
      var upRes=await sb.storage.from(TEMP_MEDIA_BUCKET).upload(storagePath,prepared.blob,{contentType:prepared.mimeType,upsert:false});
      if (upRes.error) throw upRes.error;
      uploaded=true;
      var rpcName=contextType==='chat_thread_message'?'send_chat_thread_message_with_temp_media':'send_chat_message_with_temp_media';
      var rpcPayload=contextType==='chat_thread_message'
        ?{p_thread_id:targetThreadId,p_content:content,p_storage_path:storagePath,p_mime_type:prepared.mimeType,p_arquivo_ext:prepared.ext,p_size_bytes:prepared.blob.size,p_width_px:prepared.width,p_height_px:prepared.height}
        :{p_channel:targetChannel,p_content:content,p_storage_path:storagePath,p_mime_type:prepared.mimeType,p_arquivo_ext:prepared.ext,p_size_bytes:prepared.blob.size,p_width_px:prepared.width,p_height_px:prepared.height};
      var rpcRes=await sb.rpc(rpcName,rpcPayload);
      if (rpcRes.error) throw rpcRes.error;
      var saved=Array.isArray(rpcRes.data)?rpcRes.data[0]:rpcRes.data;
      if (!saved||!saved.id) throw new Error('Mensagem não retornou do servidor.');
      upsertMessage(contextType==='chat_thread_message'?normalizeProjectMessage(saved):saved);
      assignMessageMedia(contextType,saved.id,{storage_path:storagePath,objectUrl:previewUrl,mime_type:prepared.mimeType,arquivo_ext:prepared.ext,width_px:prepared.width,height_px:prepared.height,pending:false,failed:false,failed_load:false,blob:null,expires_at:addDaysIso(7)},pendingMsg?pendingMsg.id:null);
      renderMessages();
      setComposerStatus('Print enviado. Expira em 7 dias.','ok',false);
    } catch(err) {
      if (uploaded&&storagePath) try{ await sb.storage.from(TEMP_MEDIA_BUCKET).remove([storagePath]); }catch(e){}
      throw err;
    }
  }

  function retryMediaIssue(id) {
    var msg=messages.find(function(m){return m.id===id;});
    var media=msg?getMessageMedia(msg):null;
    if (msg&&msg.failed) { retryMediaMessage(id); return; }
    if (media&&media.failed_load) retryMediaLoad(id);
  }
  async function retryMediaMessage(id) {
    if (mediaUploadBusy) return;
    var msg=messages.find(function(m){return m.id===id;}), media=msg?getMessageMedia(msg):null;
    if (!msg||!media||!media.blob){ setComposerStatus('Print não disponível para reenvio.','warn',true); return; }
    var ct=mediaContextTypeForMessage(msg); mediaUploadBusy=true;
    try {
      msg.pending=true; msg.failed=false; delete msg.error_message;
      assignMessageMedia(ct,msg.id,Object.assign({},media,{pending:true,failed:false,failed_load:false}));
      renderMessages();
      await persistPreparedMedia({blob:media.blob,mimeType:media.mime_type||'image/webp',ext:media.arquivo_ext||'webp',width:media.width_px||null,height:media.height_px||null,objectUrl:media.objectUrl||null},mediaRpcContent(msg.content),ct,msg);
    } catch(err) {
      msg.pending=false; msg.failed=true; msg.error_message=describeChatMediaError(err);
      assignMessageMedia(ct,msg.id,Object.assign({},media,{pending:false,failed:true,failed_load:false}));
      setComposerStatus('Falha ao reenviar.','warn',true); renderMessages();
    } finally { mediaUploadBusy=false; }
  }
  async function retryMediaLoad(id) {
    var msg=messages.find(function(m){return m.id===id;}); if(!msg||String(msg.id||'').indexOf('pending:')===0) return;
    var ct=mediaContextTypeForMessage(msg), cm=getMessageMedia(msg)||{};
    assignMessageMedia(ct,msg.id,Object.assign({},cm,{pending:true,failed_load:false})); renderMessages();
    try {
      var mr=await sb.from('gestao_anexos_temporarios').select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at,marcadores').eq('contexto_tipo',ct).eq('contexto_id',msg.id).is('removido_em',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(1).maybeSingle();
      if (mr.error||!mr.data) throw mr.error||new Error('Print não encontrado.');
      var down=await sb.storage.from(TEMP_MEDIA_BUCKET).download(mr.data.storage_path);
      if (down.error||!down.data) throw down.error||new Error('Falha ao carregar.');
      delete failedStoragePaths[mr.data.storage_path];
      assignMessageMedia(ct,msg.id,Object.assign({},mr.data,{objectUrl:URL.createObjectURL(down.data),pending:false,failed:false,failed_load:false,blob:cm.blob||null}));
      renderMessages();
    } catch(err) {
      assignMessageMedia(ct,msg.id,Object.assign({},cm,{pending:false,failed_load:true}));
      setComposerStatus('Falha ao carregar print.','warn',true); renderMessages();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDIA VIEWER
  ═══════════════════════════════════════════════════════════════════ */
  function openMediaViewer(mediaKey) {
    var keys=getMediaViewerGalleryKeys();
    var idx=keys.indexOf(mediaKey); if(idx===-1&&keys.length) idx=0;
    mediaViewerState={keys:keys,idx:idx}; mvZoom=1;
    renderMediaViewer();
    document.getElementById('fp-media-viewer').style.display='flex';
  }
  function renderMediaViewer() {
    if (!mediaViewerState) return;
    var keys=mediaViewerState.keys, idx=mediaViewerState.idx;
    var msg=getMessageByMediaKey(keys[idx]);
    var media=msg?getMessageMedia(msg):null;
    var $img=document.getElementById('fp-mv-img'), $empty=document.getElementById('fp-mv-empty');
    var $title=document.getElementById('fp-mv-title'), $meta=document.getElementById('fp-mv-meta');
    var $count=document.getElementById('fp-mv-count'), $prev=document.getElementById('fp-mv-prev'), $next=document.getElementById('fp-mv-next');
    var $zoom=document.getElementById('fp-mv-zoom-label');
    if ($count) $count.textContent=(idx+1)+'/'+keys.length;
    if ($prev)  $prev.disabled=(idx===0);
    if ($next)  $next.disabled=(idx===keys.length-1);
    if ($zoom)  $zoom.textContent=Math.round(mvZoom*100)+'%';
    if ($title) $title.textContent=msg?firstName(msg.sender_name||'')+' · print':'Print do chat';
    if ($meta&&msg&&msg.created_at) { var dt=new Date(msg.created_at); $meta.textContent=dt.toLocaleDateString('pt-BR')+' · '+fmtTime(dt); }
    var $canvas=document.getElementById('fp-mv-canvas');
    if (media&&media.objectUrl&&$img) {
      $img.src=media.objectUrl;
      if ($canvas) $canvas.style.display='block';
      /* Zoom por largura: a imagem cresce de verdade e o stage (overflow:auto) ganha scroll */
      if (mvZoom === 1) {
        $img.style.width=''; $img.style.maxWidth=''; $img.style.maxHeight='';
      } else {
        /* o canvas embrulha a imagem, então o % precisa vir do stage (pai) em px */
        var stageW = $canvas && $canvas.parentNode ? $canvas.parentNode.clientWidth - 32 : 0;
        $img.style.maxWidth='none'; $img.style.maxHeight='none';
        $img.style.width=Math.round(mvZoom*stageW)+'px';
      }
      if ($empty) $empty.style.display='none';
      renderMvMarkers();
    } else {
      if ($canvas) $canvas.style.display='none';
      if ($img) $img.src='';
      if ($empty){ $empty.style.display='block'; $empty.textContent='Imagem não disponível'; }
    }
  }
  function closeMediaViewer() {
    mediaViewerState=null; mvZoom=1; mvSelectTool(null);
    document.getElementById('fp-media-viewer').style.display='none';
    var $canvas=document.getElementById('fp-mv-canvas'); if($canvas) $canvas.style.display='none';
    var $img=document.getElementById('fp-mv-img'); if($img) $img.src='';
  }
  function mvPrev(){ if(mediaViewerState&&mediaViewerState.idx>0){ mediaViewerState.idx--; mvZoom=1; renderMediaViewer(); } }
  function mvNext(){ if(mediaViewerState&&mediaViewerState.idx<mediaViewerState.keys.length-1){ mediaViewerState.idx++; mvZoom=1; renderMediaViewer(); } }
  function mvZoomIn()   { mvZoom=Math.min(mvZoom+0.25,4); renderMediaViewer(); }
  function mvZoomOut()  { mvZoom=Math.max(mvZoom-0.25,0.25); renderMediaViewer(); }
  function mvZoomReset(){ mvZoom=1; renderMediaViewer(); }
  function getMediaViewerGalleryKeys(){ return messages.map(function(m){ var md=getMessageMedia(m); return md&&md.objectUrl?mediaKeyForMessage(m):null; }).filter(Boolean); }
  function getMessageByMediaKey(k){ return messages.find(function(m){ return mediaKeyForMessage(m)===k; })||null; }

  /* ═══════════════════════════════════════════════════════════════════
     MARCADORES SOBRE O PRINT
     Salvos na coluna `marcadores` (jsonb) de gestao_anexos_temporarios:
     vivem e morrem com a imagem. Posições em % — acompanham o zoom.
  ═══════════════════════════════════════════════════════════════════ */
  var mvTool = null;
  var MV_MARK_SVGS = {
    seta:          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>',
    seta_verde:    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>',
    alerta:        '<svg width="26" height="26" viewBox="0 0 24 24" fill="#FBF3E8" stroke="#C4831A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    x:             '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B84C3A" stroke-width="3" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
    circulo:       '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>',
    circulo_verde: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>'
  };

  function mvSelectTool(tool) {
    mvTool = (mvTool === tool) ? null : tool;
    ['seta','seta_verde','alerta','x','circulo','circulo_verde'].forEach(function (t) {
      var btn = document.getElementById('fp-mv-tool-' + t);
      if (btn) btn.classList.toggle('active', mvTool === t);
    });
    var $canvas = document.getElementById('fp-mv-canvas');
    if ($canvas) $canvas.classList.toggle('tool-active', !!mvTool);
  }

  function _mvCurrentMedia() {
    if (!mediaViewerState) return null;
    var msg = getMessageByMediaKey(mediaViewerState.keys[mediaViewerState.idx]);
    return msg ? { msg: msg, media: getMessageMedia(msg) } : null;
  }

  function renderMvMarkers() {
    var $marks = document.getElementById('fp-mv-marks');
    if (!$marks) return;
    var cur = _mvCurrentMedia();
    var list = (cur && cur.media && cur.media.marcadores) || [];
    $marks.innerHTML = list.map(function (mk) {
      var svg = MV_MARK_SVGS[mk.t] || '';
      var own = mk.uid === user.auth_id;
      return '<div class="fp-mark" style="left:' + Number(mk.x) + '%;top:' + Number(mk.y) + '%"' +
        (own ? ' ondblclick="fpChat.mvRemoveMark(\'' + escHtml(String(mk.id)) + '\')" title="Clique duplo para remover"' : '') + '>' +
        svg +
        '<span class="fp-mark-ini">' + escHtml(mk.ini || '?') + '</span>' +
        '</div>';
    }).join('');
  }

  function mvCanvasClick(e) {
    if (!mvTool || !mediaViewerState) return;
    var $img = document.getElementById('fp-mv-img');
    if (!$img || !$img.src) return;
    var cur = _mvCurrentMedia();
    if (!cur || !cur.media) return;
    var r = $img.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width)  * 100;
    var y = ((e.clientY - r.top)  / r.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    var mk = {
      id:  newUuid(),
      t:   mvTool,
      x:   Math.round(x * 100) / 100,
      y:   Math.round(y * 100) / 100,
      ini: user.iniciais || (user.nome || '').substring(0, 2).toUpperCase(),
      uid: user.auth_id,
      ts:  new Date().toISOString()
    };
    cur.media.marcadores = (cur.media.marcadores || []).concat([mk]);
    renderMvMarkers();
    _saveMvMarkers(cur.msg, cur.media.marcadores);
  }

  function mvRemoveMark(markId) {
    var cur = _mvCurrentMedia();
    if (!cur || !cur.media) return;
    cur.media.marcadores = (cur.media.marcadores || []).filter(function (mk) {
      return !(String(mk.id) === String(markId) && mk.uid === user.auth_id);
    });
    renderMvMarkers();
    _saveMvMarkers(cur.msg, cur.media.marcadores);
  }

  function _saveMvMarkers(msg, marcadores) {
    var ct = mediaContextTypeForMessage(msg);
    sb.from('gestao_anexos_temporarios')
      .update({ marcadores: marcadores })
      .eq('contexto_tipo', ct)
      .eq('contexto_id', msg.id)
      .is('removido_em', null)
      .then(function (r) {
        if (r.error) console.warn('[EXP ChatFP] falha ao salvar marcadores:', r.error.message);
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════════════════════════ */
  function showLoading(){ if(!$msgs) return; $msgs.innerHTML='<div class="fp-loading"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>'; }
  function showError()  { if(!$msgs) return; $msgs.innerHTML='<div class="fp-empty">Erro ao carregar.<br>Tente novamente.</div>'; }
  function scrollBottom(){ if($msgs){ $msgs.scrollTop=$msgs.scrollHeight; scrolledToEnd=true; } }
  function showNewMsgToast(){
    var old=document.getElementById('fp-new-msg-toast'); if(old) old.remove();
    var t=document.createElement('div'); t.id='fp-new-msg-toast'; t.className='fp-new-msg-toast'; t.textContent='↓ Nova mensagem';
    t.onclick=function(){ scrollBottom(); t.remove(); };
    var area=document.getElementById('fp-chat-area'); if(area) area.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); },4000);
  }
  function setComposerStatus(msg,tone,sticky){
    var el=document.getElementById('fp-composer-status'); if(!el) return;
    if(composerStatusTimer){ clearTimeout(composerStatusTimer); composerStatusTimer=null; }
    if(!msg){ el.style.display='none'; el.textContent=''; el.className=''; return; }
    el.textContent=msg; el.className=tone?tone:''; el.style.display='block';
    if(!sticky){ composerStatusTimer=setTimeout(function(){ el.style.display='none'; el.textContent=''; el.className=''; composerStatusTimer=null; },4200); }
  }

  /* ═══════════════════════════════════════════════════════════════════
     SOM + PUSH
  ═══════════════════════════════════════════════════════════════════ */
  var _audioCtx = null;
  function _getAudioCtx() {
    if (_audioCtx && _audioCtx.state !== 'closed') return _audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  }
  document.addEventListener('click', function () { _getAudioCtx(); }, { once: true });

  function playNotificationSound(){
    if(!soundEnabled) return;
    try {
      var ctx = _getAudioCtx();
      if (!ctx) return;
      function _play() {
        [{f:1046.5,t:0,d:0.18},{f:1318.5,t:0.13,d:0.22}].forEach(function(n){
          var osc=ctx.createOscillator(), gain=ctx.createGain();
          osc.type='sine'; osc.frequency.value=n.f;
          gain.gain.setValueAtTime(0,ctx.currentTime+n.t);
          gain.gain.linearRampToValueAtTime(0.07,ctx.currentTime+n.t+0.02);
          gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+n.t+n.d);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(ctx.currentTime+n.t); osc.stop(ctx.currentTime+n.t+n.d+0.02);
        });
      }
      if (ctx.state === 'suspended') ctx.resume().then(_play);
      else _play();
    } catch(e){}
  }
  function _sendChatPush(msg){
    if(userStatus==='foco') return;
    var ch=msg.channel, uid=user.auth_id;
    var isDM=ch.startsWith('dm:')||ch.startsWith('group:');
    var isGeneral=ch==='general';
    var isSocios=ch==='socios'&&isSocioLikeRole(user.role);
    if(!(isDM&&ch.includes(uid))&&!isProjectChannel(ch)&&!isGeneral&&!isSocios) return;
    var appUserId=user.app_user_id||user.id; if(!appUserId) return;
    var sender=(msg.sender_name||'').split(' ')[0];
    var title=isProjectChannel(ch)?sender+' atualizou um projeto'
      :isDM?sender+' enviou uma mensagem'
      :isGeneral?sender+' no #geral'
      :sender+' no #sócios';
    var body=(msg.content||'').length>80?msg.content.substring(0,80)+'...':msg.content;
    var tag='exp-chat-'+ch;
    var icon='/files/assets/icon-192.png';
    if(document.visibilityState==='visible'&&Notification.permission==='granted'){
      try{ new Notification(title,{body:body,icon:icon,tag:tag,silent:true}); }catch(e){}
    }
    console.log('[EXP ChatFP Push] enviando para usuario_id:', appUserId, '| user.id:', user.id, '| user.app_user_id:', user.app_user_id);
    sb.functions.invoke('send-push',{body:{usuario_id:appUserId,title:title,body:body,url:window.location.href,tag:tag}})
      .then(function(r){ console.log('[EXP ChatFP Push] resposta edge function:', r.data, r.error||''); })
      .catch(function(e){ console.warn('[EXP ChatFP Push] erro:', e); });
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEMBROS / PROJETOS
  ═══════════════════════════════════════════════════════════════════ */
  function loadTeamMembers(){
    sb.from('usuarios').select('id,auth_id,nome,iniciais,cor,role,avatar_url').order('nome')
      .then(function(r){
        var all=r.data||[];
        allMembers=all;
        teamMembers=all.filter(function(m){ return m.auth_id!==user.auth_id&&m.id!==user.id; });
        renderConvList();
      });
  }

  function fetchProjectHomeItems(uid){
    /* Otimizado: 3 queries fixas independente do nº de projetos
       (era 2N queries paralelas — 40+ requests com 20 projetos) */
    return sb.from('chat_threads')
      .select('id,title,produto_id,last_message_at')
      .eq('type','project').is('archived_at',null)
      .order('last_message_at',{ascending:false,nullsFirst:false})
      .then(function(r){
        if(r.error||!r.data||!r.data.length){ projectThreadMeta={}; projectThreads=[]; return []; }
        projectThreads = r.data;
        var ids = projectThreads.map(function(t){ return t.id; });

        /* Query 2 + 3 em paralelo */
        return Promise.all([
          /* Última mensagem de cada thread: pega as N mais recentes e filtra client-side */
          sb.from('chat_thread_messages')
            .select('thread_id,content,created_at,sender_auth_id')
            .in('thread_id', ids)
            .order('created_at',{ascending:false})
            .limit(ids.length * 3),   /* margem para ter pelo menos 1 por thread */

          /* Reads do usuário para todos os threads de uma vez */
          sb.from('chat_thread_reads')
            .select('thread_id,last_read_at')
            .eq('user_auth_id', uid)
            .in('thread_id', ids),

          /* Todas as mensagens não lidas (sender != uid) para todos os threads */
          sb.from('chat_thread_messages')
            .select('thread_id,created_at,sender_auth_id')
            .in('thread_id', ids)
            .neq('sender_auth_id', uid)
            .order('created_at',{ascending:false})
            .limit(500)
        ]).then(function(parts){
          /* Última mensagem por thread (client-side) */
          var lastMsgMap = {};
          (parts[0].data||[]).forEach(function(m){
            if (!lastMsgMap[m.thread_id]) lastMsgMap[m.thread_id] = m;
          });

          /* Read map */
          var readMap = {};
          (parts[1].data||[]).forEach(function(row){ readMap[row.thread_id] = row.last_read_at; });

          /* Contar não lidas por thread (client-side) */
          var unreadMap = {};
          (parts[2].data||[]).forEach(function(m){
            var lr = readMap[m.thread_id] || null;
            if (!lr || m.created_at > lr) {
              unreadMap[m.thread_id] = (unreadMap[m.thread_id]||0) + 1;
            }
          });

          return projectThreads.map(function(thread){
            var last  = lastMsgMap[thread.id] || null;
            var unread = unreadMap[thread.id] || 0;
            var meta = buildProjectThreadMeta(
              thread.id, thread.title,
              last ? last.content : 'Chat do projeto',
              last ? last.created_at : thread.last_message_at,
              last ? last.sender_auth_id : null
            );
            meta.unread = unread;
            projectThreadMeta[meta.channel] = meta;
            return meta;
          });
        });
      }).catch(function(){ return []; });
  }

  function fetchProjectUnreadMap(uid){
    return fetchProjectHomeItems(uid).then(function(items){
      var unread={};
      (items||[]).forEach(function(item){ if(item.unread) unread[item.channel]=item.unread; });
      return unread;
    }).catch(function(){ return {}; });
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDIA UTILS
  ═══════════════════════════════════════════════════════════════════ */
  function loadCurrentMessageMedia(){
    if(!messages.length) return Promise.resolve();
    var ct=isProjectChannel(currentChannel)?'chat_thread_message':'chat_message';
    var ids=messages.map(function(m){return m.id;}).filter(function(id){return !!id&&String(id).indexOf('pending:')!==0;});
    if(!ids.length) return Promise.resolve();
    var seq=++mediaRequestSeq;
    return sb.from('gestao_anexos_temporarios').select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at,marcadores').eq('contexto_tipo',ct).in('contexto_id',ids).is('removido_em',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true})
      .then(function(r){
        if(seq!==mediaRequestSeq||r.error) return;
        return Promise.all((r.data||[]).map(function(row){
          if(!row.storage_path||failedStoragePaths[row.storage_path])
            return {messageId:row.contexto_id,media:Object.assign({},row,{objectUrl:null,pending:false,failed_load:true})};
          return sb.storage.from(TEMP_MEDIA_BUCKET).download(row.storage_path).then(function(down){
            if(down.error||!down.data){ failedStoragePaths[row.storage_path]=true; return {messageId:row.contexto_id,media:Object.assign({},row,{objectUrl:null,pending:false,failed_load:true})}; }
            return {messageId:row.contexto_id,media:Object.assign({},row,{objectUrl:URL.createObjectURL(down.data),pending:false})};
          });
        })).then(function(items){
          if(seq!==mediaRequestSeq) return;
          (items||[]).filter(Boolean).forEach(function(item){ assignMessageMedia(ct,item.messageId,item.media); });
          if(currentChannel) renderMessages();
        });
      });
  }
  function handleChatTempMediaRealtime(row){
    if(!row||row.removido_em||!currentChannel) return;
    var et=isProjectChannel(currentChannel)?'chat_thread_message':'chat_message';
    if(String(row.contexto_tipo||'').toLowerCase()!==et) return;
    if(!messages.some(function(m){return m.id===row.contexto_id;})) return;
    var _exKey=mediaKeyFor(et,row.contexto_id), _ex=messageMediaMap[_exKey];
    if(_ex){
      /* mídia já carregada: sincroniza apenas os marcadores */
      if(JSON.stringify(_ex.marcadores||[])!==JSON.stringify(row.marcadores||[])){
        _ex.marcadores=row.marcadores||[];
        if(mediaViewerState&&mediaViewerState.keys[mediaViewerState.idx]===_exKey) renderMvMarkers();
      }
      return;
    }
    if(!row.storage_path||failedStoragePaths[row.storage_path]){
      assignMessageMedia(et,row.contexto_id,Object.assign({},row,{objectUrl:null,pending:false,failed_load:true}));
      renderMessages(); return;
    }
    sb.storage.from(TEMP_MEDIA_BUCKET).download(row.storage_path).then(function(down){
      if(down.error||!down.data){ failedStoragePaths[row.storage_path]=true; assignMessageMedia(et,row.contexto_id,Object.assign({},row,{objectUrl:null,pending:false,failed_load:true})); }
      else assignMessageMedia(et,row.contexto_id,Object.assign({},row,{objectUrl:URL.createObjectURL(down.data),pending:false,failed_load:false}));
      renderMessages();
    });
  }
  function loadChatMediaConfig(){
    if(chatMediaConfig) return Promise.resolve(chatMediaConfig);
    var fb={largura_max_px:CHAT_MEDIA_LIMITS.largura_max_px,tamanho_max_kb:CHAT_MEDIA_LIMITS.tamanho_max_kb,qualidade_upload:CHAT_MEDIA_LIMITS.qualidade_upload};
    return sb.from('plataforma_midia_temporaria_config').select('largura_max_px,tamanho_max_kb,qualidade_upload').eq('id',true).maybeSingle()
      .then(function(r){ chatMediaConfig=Object.assign({},fb,r.data||{}); return chatMediaConfig; })
      .catch(function(){ chatMediaConfig=fb; return chatMediaConfig; });
  }
  function optimizeChatMediaImage(file,cfg){
    return loadImageForChatMedia(file).then(function(img){
      var q=Number(cfg&&cfg.qualidade_upload||CHAT_MEDIA_LIMITS.qualidade_upload);
      var wmax=Number(cfg&&cfg.largura_max_px||CHAT_MEDIA_LIMITS.largura_max_px);
      var maxB=Number(cfg&&cfg.tamanho_max_kb||CHAT_MEDIA_LIMITS.tamanho_max_kb)*1024;
      return rasterizeChatMedia(img,wmax,q,'image/webp')
        .then(function(r){ if(!r.blob) return rasterizeChatMedia(img,wmax,q,'image/jpeg'); return r; })
        .then(function(r){ if(!r.blob) throw new Error('Não foi possível preparar o print.'); if(r.blob.size>maxB) return rasterizeChatMedia(img,Math.min(wmax,1120),Math.min(q,CHAT_MEDIA_LIMITS.qualidade_fallback),'image/jpeg'); return r; })
        .then(function(r){ if(!r.blob||r.blob.size>maxB) throw new Error('Print muito pesado.'); return {blob:r.blob,width:r.width,height:r.height,mimeType:r.mimeType,ext:r.mimeType==='image/webp'?'webp':'jpg'}; });
    });
  }
  function loadImageForChatMedia(file){ return new Promise(function(res,rej){ var img=new Image(),url=URL.createObjectURL(file); img.onload=function(){URL.revokeObjectURL(url);res(img);}; img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('Arquivo inválido.'));}; img.src=url; }); }
  function rasterizeChatMedia(img,wmax,q,mime){ return new Promise(function(res){ var r=img.width>wmax?(wmax/img.width):1,w=Math.max(1,Math.round(img.width*r)),h=Math.max(1,Math.round(img.height*r)),c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); c.toBlob(function(b){ res({blob:b,width:w,height:h,mimeType:b?mime:null}); },mime,q); }); }
  function buildChatMediaPath(ct,ext){ var dt=new Date(); return ct+'/'+user.auth_id+'/'+dt.getFullYear()+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+newUuid()+'.'+ext; }
  function mediaContextTypeForMessage(msg){ return isProjectChannel(msg&&msg.channel)?'chat_thread_message':'chat_message'; }
  function mediaKeyFor(type,id){ return String(type||'')+':'+String(id||''); }
  function mediaKeyForMessage(msg){ return mediaKeyFor(mediaContextTypeForMessage(msg),msg&&msg.id); }
  function assignMessageMedia(ct,mid,media,prevId){
    if(!mid||!media) return;
    if(prevId&&prevId!==mid) delete messageMediaMap[mediaKeyFor(ct,prevId)];
    var key=mediaKeyFor(ct,mid), prev=messageMediaMap[key];
    if(prev&&prev.objectUrl&&prev.objectUrl!==media.objectUrl&&String(prev.objectUrl).indexOf('blob:')===0) URL.revokeObjectURL(prev.objectUrl);
    messageMediaMap[key]=Object.assign({},media);
    var msg=messages.find(function(m){return m.id===mid||(prevId&&m.id===prevId);});
    if(msg) msg.temp_media=Object.assign({},media);
  }
  function clearMessageMediaCache(){
    Object.keys(messageMediaMap).forEach(function(k){ var m=messageMediaMap[k]; if(m&&m.objectUrl&&String(m.objectUrl).indexOf('blob:')===0) URL.revokeObjectURL(m.objectUrl); });
    messageMediaMap={};
    messages.forEach(function(m){ if(m&&m.temp_media&&m.temp_media.objectUrl&&String(m.temp_media.objectUrl).indexOf('blob:')===0) URL.revokeObjectURL(m.temp_media.objectUrl); delete m.temp_media; });
  }
  function getMessageMedia(msg){ if(!msg) return null; return messageMediaMap[mediaKeyForMessage(msg)]||msg.temp_media||null; }
  function describeChatMediaError(err){ var raw=String(err&&(err.message||err.details||err.code)||'Falha.'); var lo=raw.toLowerCase(); if(lo.indexOf('send_chat')!==-1&&lo.indexOf('with_temp_media')!==-1) return 'Função de prints não aplicada no banco.'; if(lo.indexOf('row-level security')!==-1||lo.indexOf('access denied')!==-1) return 'Sem permissão de armazenamento.'; if(lo.indexOf('bucket')!==-1||lo.indexOf('storage')!==-1) return 'Falha no storage.'; return raw; }

  /* ═══════════════════════════════════════════════════════════════════
     UTILS
  ═══════════════════════════════════════════════════════════════════ */
  function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function firstName(n){ return n?n.split(' ')[0]:''; }
  function fmtTime(d){ return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
  function fmtDateSep(d){
    var today=new Date(), yest=new Date(today); yest.setDate(yest.getDate()-1);
    if(d.toDateString()===today.toDateString()) return 'Hoje';
    if(d.toDateString()===yest.toDateString())  return 'Ontem';
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'});
  }
  function isSocioLikeRole(r){
    if (typeof window.isSocioRole === 'function') return window.isSocioRole(r);
    var normalized = (r||'').toLowerCase().trim();
    if (normalized === 'socio_adm') normalized = 'socio_admin';
    return ['socio','socio_admin'].indexOf(normalized)!==-1;
  }
  function isDynamicChannel(ch){ return !!ch&&(ch.indexOf('dm:')===0||ch.indexOf('group:')===0); }
  function isProjectChannel(ch){ return !!ch&&ch.indexOf('project:')===0; }
  function projectThreadIdFromChannel(ch){ return String(ch||'').replace('project:',''); }
  function channelHasUser(ch,uid){ if(!isDynamicChannel(ch)||!uid) return false; return ch.replace(/^dm:|^group:/,'').split(':').indexOf(uid)!==-1; }
  function getChannelLabel(ch){
    if(ch==='general') return '# geral';
    if(ch==='socios')  return '# sócios';
    if(isProjectChannel(ch)&&projectThreadMeta[ch]) return projectThreadMeta[ch].label;
    return currentLabel||ch;
  }
  function brandColorForKey(key){ var s=String(key||'exp'),h=0; for(var i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i); return BRAND_AVATAR_COLORS[Math.abs(h)%BRAND_AVATAR_COLORS.length]; }
  function initialsFromLabel(label,fb){
    var base=String(label||'').trim(); if(!base) return fb||'GP';
    if(base.indexOf('-')!==-1){ var head=base.split('-')[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase(); if(head) return head.slice(0,3); }
    var tokens=base.split(/\s+/).filter(Boolean), ini=tokens.slice(0,2).map(function(t){return t.charAt(0).toUpperCase();}).join('');
    if(ini.length>=2) return ini.slice(0,3);
    return base.replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,3)||(fb||'GP');
  }
  function getConversationMeta(msg, uid) {
    var ch=msg.channel;
    if (ch.startsWith('dm:')) {
      var parts=ch.replace('dm:','').split(':'), oUid=parts.find(function(p){return p!==uid;});
      var mem=oUid?allMembers.find(function(m){return m.auth_id===oUid;}):null;
      if (mem) return {label:firstName(mem.nome),iniciais:mem.iniciais||(mem.nome||'').substring(0,2).toUpperCase(),cor:mem.cor||'#1D6A4A',avatarUrl:mem.avatar_url||null,members:null};
    }
    if (ch.startsWith('group:')) {
      var uids=ch.replace('group:','').split(':');
      var others=uids.filter(function(u){return u!==uid;});
      var mems=others.map(function(u){ return allMembers.find(function(m){return m.auth_id===u;})||null; }).filter(Boolean);
      var names=mems.map(function(m){return firstName(m.nome);});
      return {label:names.join(', '),iniciais:'GP',cor:brandColorForKey(ch),avatarUrl:null,members:mems};
    }
    return {label:msg.sender_name||ch,iniciais:msg.sender_iniciais||(msg.sender_name||'??').substring(0,2).toUpperCase(),cor:msg.sender_cor||'#1D6A4A',avatarUrl:null,members:null};
  }
  function compactPreviewText(text,maxLen,fb){
    var raw=String(text||'').trim(); if(isImageOnlySentinel(raw)) return 'Print anexado';
    var c=raw.replace(/\n/g,' '); if(!c) return fb||'';
    return c.length>maxLen?c.substring(0,maxLen)+'…':c;
  }
  function normalizeProjectMessage(msg){ return {id:msg.id,channel:'project:'+msg.thread_id,thread_id:msg.thread_id,sender_id:msg.sender_auth_id,sender_name:msg.sender_nome,sender_iniciais:msg.sender_iniciais,sender_cor:msg.sender_cor,content:msg.content,created_at:msg.created_at,reactions:normalizeReactions(msg.reactions)}; }
  function buildProjectThreadMeta(tid,title,preview,createdAt,senderAuthId){
    var ch='project:'+tid, label=title||(projectThreadMeta[ch]&&projectThreadMeta[ch].label)||'Projeto';
    return {threadId:tid,channel:ch,label:label,iniciais:initialsFromLabel(label,'PRJ'),cor:brandColorForKey(ch+':'+label),preview:preview||'Chat do projeto',lastCreatedAt:createdAt||null,lastSenderId:senderAuthId||null,unread:projectThreadMeta[ch]?(projectThreadMeta[ch].unread||0):0};
  }
  function updateProjectThreadSnapshot(tid,preview,createdAt,senderAuthId){
    var ch='project:'+tid, meta=projectThreadMeta[ch]||buildProjectThreadMeta(tid,null,preview,createdAt,senderAuthId);
    meta.preview=preview||meta.preview; meta.lastCreatedAt=createdAt||meta.lastCreatedAt; meta.lastSenderId=senderAuthId||meta.lastSenderId;
    projectThreadMeta[ch]=meta;
  }
  function normalizeReactionList(v){ if(Array.isArray(v)) return v.filter(Boolean).map(function(i){return String(i);}); if(typeof v==='string'&&v) return [v]; return []; }
  function normalizeReactions(r){ var b=r&&typeof r==='object'&&!Array.isArray(r)?r:{}; return {like:normalizeReactionList(b.like),love:normalizeReactionList(b.love)}; }
  function buildPendingMessage(content,extra){ pendingMessageSeq++; return Object.assign({id:'pending:'+pendingMessageSeq,channel:currentChannel,thread_id:isProjectChannel(currentChannel)?projectThreadIdFromChannel(currentChannel):null,sender_id:user.auth_id,sender_name:user.nome,sender_iniciais:user.iniciais||(user.nome||'').substring(0,2).toUpperCase(),sender_cor:user.cor||'#1D6A4A',content:content,created_at:new Date().toISOString(),reactions:normalizeReactions(null),pending:true},extra||{}); }
  function isMatchingPendingMessage(e,n){ if(!e||!e.pending||!n) return false; return e.channel===n.channel&&e.sender_id===n.sender_id&&e.content===n.content; }
  function compareMessages(a,b){ return new Date(a.created_at||0)-new Date(b.created_at||0); }
  function upsertMessage(nextMsg){
    if(!nextMsg||!nextMsg.id) return;
    var nm=Object.assign({},nextMsg,{reactions:normalizeReactions(nextMsg.reactions)});
    var idx=messages.findIndex(function(m){return m.id===nextMsg.id;});
    if(idx===-1) idx=messages.findIndex(function(m){return isMatchingPendingMessage(m,nm);});
    if(idx!==-1) messages[idx]=Object.assign({},messages[idx],nm,{pending:false}); else messages.push(nm);
    messages.sort(compareMessages);
  }
  function removeMessageById(id){ messages=messages.filter(function(m){return m.id!==id;}); }
  function newUuid(){ if(window.crypto&&typeof window.crypto.randomUUID==='function') return window.crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }
  function addDaysIso(d){ var dt=new Date(); dt.setDate(dt.getDate()+d); return dt.toISOString(); }
  function isImageOnlySentinel(c){ return String(c||'').trim()===CHAT_IMAGE_SENTINEL; }
  function isChatMediaExpired(msg){ if(!msg||!msg.created_at) return false; return Date.now()-new Date(msg.created_at).getTime()>(7*24*60*60*1000); }

  /* ═══════════════════════════════════════════════════════════════════
     BUSCA DENTRO DA CONVERSA
  ═══════════════════════════════════════════════════════════════════ */
  function toggleInSearch(event) {
    inSearchOpen ? closeInSearch() : openInSearch(event);
  }

  function openInSearch(event) {
    if (!currentChannel) return;
    inSearchOpen = true;
    var $bar = document.getElementById('fp-in-search-bar');
    var $btn = document.getElementById('fp-in-search-btn');
    if (!$bar) return;

    $bar.classList.add('open');
    if ($btn) $btn.style.background = 'rgba(0,0,0,.12)';

    /* Posicionar à esquerda do botão, alinhado verticalmente */
    var btn  = (event && event.currentTarget) || $btn;
    if (btn) {
      var rect    = btn.getBoundingClientRect();
      var barW    = $bar.offsetWidth || 320;
      $bar.style.top  = (rect.top + (rect.height - 42) / 2) + 'px';
      $bar.style.left = Math.max(8, rect.left - barW - 8) + 'px';
    }

    setTimeout(function() {
      var inp = document.getElementById('fp-in-search-input');
      if (inp) inp.focus();
    }, 60);
  }

  function closeInSearch() {
    inSearchOpen    = false;
    inSearchQuery   = '';
    inSearchResults = [];
    inSearchCurrent = 0;
    var $bar = document.getElementById('fp-in-search-bar');
    var $inp = document.getElementById('fp-in-search-input');
    var $btn = document.getElementById('fp-in-search-btn');
    if ($bar) { $bar.classList.remove('open'); $bar.style.top=''; $bar.style.left=''; }
    if ($inp) $inp.value = '';
    if ($btn) $btn.style.background = '';
    renderMessages();
  }

  function inSearchInput(value) {
    inSearchQuery   = (value || '').trim();
    inSearchCurrent = 0;
    runInSearch();
  }

  function inSearchKey(e) {
    if (e.key === 'Enter') { e.shiftKey ? inSearchPrev() : inSearchNext(); }
    if (e.key === 'Escape') { e.preventDefault(); closeInSearch(); }
  }

  function runInSearch() {
    var q = inSearchQuery.toLowerCase();
    inSearchResults = [];
    if (q) {
      messages.forEach(function(msg, idx) {
        var text = String(msg.content || '').toLowerCase();
        if (text.indexOf(q) !== -1) inSearchResults.push(idx);
      });
    }
    renderMessages();
    updateInSearchCount();
    if (inSearchResults.length > 0) scrollToSearchResult(inSearchResults[inSearchCurrent]);
  }

  function inSearchNext() {
    if (!inSearchResults.length) return;
    inSearchCurrent = (inSearchCurrent + 1) % inSearchResults.length;
    updateInSearchCount();
    renderMessages();
    scrollToSearchResult(inSearchResults[inSearchCurrent]);
  }

  function inSearchPrev() {
    if (!inSearchResults.length) return;
    inSearchCurrent = (inSearchCurrent - 1 + inSearchResults.length) % inSearchResults.length;
    updateInSearchCount();
    renderMessages();
    scrollToSearchResult(inSearchResults[inSearchCurrent]);
  }

  function updateInSearchCount() {
    var $count = document.getElementById('fp-in-search-count');
    if (!$count) return;
    if (!inSearchQuery) { $count.textContent = ''; $count.className = 'fp-in-search-count'; return; }
    if (!inSearchResults.length) {
      $count.textContent = 'Sem resultados';
      $count.className = 'fp-in-search-count';
    } else {
      $count.textContent = (inSearchCurrent + 1) + ' de ' + inSearchResults.length;
      $count.className = 'fp-in-search-count found';
    }
  }

  function scrollToSearchResult(msgIdx) {
    if (msgIdx === undefined || msgIdx === null) return;
    var msg = messages[msgIdx];
    if (!msg) return;
    setTimeout(function() {
      var el = $msgs && $msgs.querySelector('[data-id="' + CSS.escape(String(msg.id)) + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  }

  /* Injetar highlights no texto de uma mensagem */
  function highlightText(rawHtml, query, isCurrent) {
    if (!query) return rawHtml;
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var cls = isCurrent ? 'fp-search-highlight current' : 'fp-search-highlight';
    return rawHtml.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark class="' + cls + '">$1</mark>');
  }

  /* ── SVG icons ── */
  function icoLike(){ return '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>'; }
  function icoHeart(){ return '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'; }
  function icoFlag(){ return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>'; }

  /* ═══════════════════════════════════════════════════════════════════
     API PÚBLICA
  ═══════════════════════════════════════════════════════════════════ */
  window.fpChat = {
    openChannel, filterConvs, toggleProjectSection,
    toggleStatusPop, setStatus, toggleSound, toggleDmPin,
    setColor, toggleViewPicker, setFontScale, stepFont, setFontTone, toggleMonoMode,
    toggleUnreads, toggleFlagged,
    openNewDM, closeNewDM, toggleMember, confirmNewDM,
    send, handleKey, autoResize,
    pickMedia, handleMediaInput, retryMediaIssue,
    react, flagMessage,
    openMediaViewer, closeMediaViewer, mvPrev, mvNext, mvZoomIn, mvZoomOut, mvZoomReset,
    mvSelectTool, mvRemoveMark,
    /* fixar projetos */
    togglePinCurrent, openPinPop, closePinPop, pinPopToggle,
    openCtxMenu, closeCtxMenu, ctxTogglePin,
    /* busca dentro da conversa */
    toggleInSearch, closeInSearch, inSearchInput, inSearchKey, inSearchNext, inSearchPrev,
    /* tarefas / listas */
    toggleTasksPanel, checkTask, addTask, openAssignDrop, taskDescInput, toggleDelegadas, _assignTo: window._assignTo,
    switchListsTab, selectCkByIndex, fpToggleCkItem, fpAddCkItem, fpAddCkItemBlur,
    get _listsActiveTab() { return _listsActiveTab; },
    /* prioridade */
    checkPrio,
    /* calendário hover */
    showCalBanner, hideCalBanner,
    /* comercial hover */
    showCrmBanner, hideCrmBanner,
    /* apoio — painel de busca */
    toggleApoioPanel, closeApoioPanel, apoioSearchInput, apoioClear,
    /* contatos — painel de busca */
    toggleContatosPanel, closeContatosPanel, contatosSearchInput, contatosClear,
    /* prioridade / projeto */
    togglePrioPanel, openPrioPanel, closePrioPanel, checkPrioPanel,
    showPrioBanner, hidePrioBanner, openProjectOverlay, closeProjectOverlay,
    /* notificações */
    toggleNotifPanel, encerrarNotif,
    /* EXP Room */
    roomClick
  };

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL DE TAREFAS
  ═══════════════════════════════════════════════════════════════════ */
  var tasksPanelOpen      = false;
  var tasksCache          = [];
  var delegadasCache      = [];
  var delegadasExpanded   = false;

  function updateTasksBadge(count) {
    var $badge = document.getElementById('fp-tasks-badge');
    if (!$badge) return;
    if (count > 0) {
      $badge.textContent = count;
      $badge.style.display = 'flex';
    } else {
      $badge.style.display = 'none';
    }
    /* atualiza também o contador no cabeçalho do painel */
    var $hdrCount = document.getElementById('fp-tasks-panel-count');
    if ($hdrCount) $hdrCount.textContent = count ? count + (count === 1 ? ' tarefa' : ' tarefas') : '';
  }

  /* Pré-carrega contagem de tarefas pendentes ao inicializar */
  function preloadTasksCount() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    sb.from('tarefas_livres')
      .select('id', { count: 'exact', head: true })
      .or('usuario_id.eq.' + uid + ',atribuido_para.eq.' + uid)
      .eq('concluida', false)
      .then(function(r) { if (r.count) updateTasksBadge(r.count); });
  }

  /* Fecha qualquer painel expansível sem esconder a sidebar */
  function _closeExpPanel() {
    if (tasksPanelOpen) {
      tasksPanelOpen = false;
      var $t = document.getElementById('fp-tasks-panel');
      var $b = document.getElementById('fp-nav-tasks');
      if ($t) $t.style.display = 'none';
      if ($b) $b.classList.remove('active');
    }
    if (prioPanelOpen) {
      prioPanelOpen = false;
      var $p  = document.getElementById('fp-prio-panel');
      var $bp = document.getElementById('fp-nav-prio');
      if ($p)  $p.style.display = 'none';
      if ($bp) $bp.classList.remove('active');
    }
  }

  function toggleTasksPanel() {
    var wasOpen = tasksPanelOpen;
    _closeExpPanel();               /* fecha qualquer painel aberto */
    if (wasOpen) return;            /* era eu → apenas fecha */
    tasksPanelOpen = true;
    var $tasks = document.getElementById('fp-tasks-panel');
    var $btn   = document.getElementById('fp-nav-tasks');
    if ($tasks) $tasks.style.display = 'flex';
    if ($btn)   $btn.classList.add('active');
    loadTasks();
  }

  function loadTasks() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    var $list = document.getElementById('fp-tasks-list');
    if ($list) $list.innerHTML = '<div class="fp-loading" style="padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';

    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    var cutoffISO = cutoff.toISOString();

    Promise.all([
      sb.from('tarefas_livres').select('*').eq('usuario_id', uid).is('atribuido_para', null).eq('concluida', false),
      sb.from('tarefas_livres').select('*').eq('atribuido_para', uid).eq('concluida', false),
      /* Atribuídas por mim para outros */
      sb.from('tarefas_livres').select('*').eq('criado_por', uid).not('atribuido_para', 'is', null)
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

      tasksCache     = todas;
      delegadasCache = delegadas;
      renderTasks(todas, delegadas);
      updateTasksBadge(todas.length);
    }).catch(function() {
      var $list = document.getElementById('fp-tasks-list');
      if ($list) $list.innerHTML = '<div class="fp-empty" style="padding:20px;text-align:center">Erro ao carregar tarefas.</div>';
    });
  }

  function renderTasks(tasks, delegadas) {
    var $list = document.getElementById('fp-tasks-list');
    if (!$list) return;
    delegadas = delegadas || delegadasCache || [];

    var hoje = new Date().toISOString().split('T')[0];

    function taskPrazoHtml(t) {
      if (!t.data_limite) return '';
      var vencida = t.data_limite < hoje;
      var ehHoje  = t.data_limite === hoje;
      var cls = vencida ? 'vencida' : ehHoje ? 'hoje' : '';
      var dt  = new Date(t.data_limite + 'T12:00:00');
      var dtFmt = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
      return '<span class="fp-task-prazo ' + cls + '">' + escHtml(dtFmt) + (vencida?' ⚠':'') + '</span>';
    }

    function tipoHtml(t) {
      return t.tipo ? '<span style="font-size:9px;color:#bbb;text-transform:capitalize">' + escHtml(t.tipo) + '</span>' : '';
    }

    var html = '';

    /* ── Pendentes ── */
    if (!tasks.length) {
      html += '<div class="fp-empty" style="padding:20px;text-align:center;font-size:11px">Nenhuma tarefa pendente ✓</div>';
    } else {
      html += '<div class="fp-task-section">Pendentes — ' + tasks.length + '</div>';
      tasks.forEach(function(t) {
        html += '<div class="fp-task-item">' +
          '<div class="fp-task-check" onclick="fpChat.checkTask(event,\'' + escHtml(String(t.id)) + '\')" title="Concluir"></div>' +
          '<div class="fp-task-body">' +
            '<div class="fp-task-desc">' + escHtml(t.descricao || '(sem descrição)') + '</div>' +
            '<div class="fp-task-meta">' + taskPrazoHtml(t) + tipoHtml(t) + '</div>' +
          '</div>' +
          '</div>';
      });
    }

    /* ── Atribuídas (recolhível) ── */
    if (delegadas.length) {
      var pendD    = delegadas.filter(function(t){ return !t.concluida; });
      var conclD   = delegadas.filter(function(t){ return  t.concluida; });
      var labelBtn = delegadasExpanded ? '▾ Atribuídas — ' + delegadas.length : '▶ Ver atribuídas (' + delegadas.length + ')';

      html += '<button class="fp-task-section fp-delegadas-toggle" onclick="fpChat.toggleDelegadas()" style="cursor:pointer;width:100%;text-align:left;border:none;background:none;font-family:Raleway,sans-serif">' +
        labelBtn + '</button>';

      if (delegadasExpanded) {
        delegadas.forEach(function(t) {
          var para = allMembers.find(function(m){ return m.id === t.atribuido_para || m.auth_id === t.atribuido_para; });
          var paraNome = para ? firstName(para.nome) : '?';
          var paraCor  = para ? (para.cor || '#888') : '#888';
          var paraIni  = para ? (para.iniciais || paraNome.substring(0,2).toUpperCase()) : '?';

          var statusHtml = t.concluida
            ? '<span style="font-size:9px;font-weight:600;color:#2D9E6B;background:#EAF5EE;padding:1px 6px;border-radius:4px">Concluída</span>'
            : '<span style="font-size:9px;font-weight:600;color:#888;background:var(--off,#F7F6F3);padding:1px 6px;border-radius:4px;border:1px solid var(--cinza2,#ECEAE4)">Pendente</span>';

          html += '<div class="fp-task-item fp-task-delegada' + (t.concluida?' fp-task-done':'') + '">' +
            /* avatar de quem recebeu */
            '<div style="width:20px;height:20px;border-radius:50%;background:' + escHtml(paraCor) + ';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:\'DM Mono\',monospace">' + escHtml(paraIni) + '</div>' +
            '<div class="fp-task-body">' +
              '<div class="fp-task-desc">' + escHtml(t.descricao || '(sem descrição)') + '</div>' +
              '<div class="fp-task-meta">' +
                '<span style="font-size:10px;color:#888">para ' + escHtml(paraNome) + '</span>' +
                taskPrazoHtml(t) +
                statusHtml +
              '</div>' +
            '</div>' +
            '</div>';
        });
      }
    }

    $list.innerHTML = html;
  }

  function toggleDelegadas() {
    delegadasExpanded = !delegadasExpanded;
    renderTasks(tasksCache, delegadasCache);
  }

  function taskDescInput(el) {
    /* auto-resize do textarea */
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  function addTask() {
    var desc  = (document.getElementById('fp-task-desc')  || {}).value  || '';
    var tipo  = (document.getElementById('fp-task-tipo')  || {}).value  || '';
    var data  = (document.getElementById('fp-task-data')  || {}).value  || null;
    desc = desc.trim();
    if (!desc) { document.getElementById('fp-task-desc').focus(); return; }
    var uid = user.id || user.app_user_id;
    sb.from('tarefas_livres').insert({
      usuario_id: uid, criado_por: uid, descricao: desc, tipo: tipo || null, data_limite: data || null
    }).then(function(r) {
      if (r.error) return;
      document.getElementById('fp-task-desc').value = '';
      document.getElementById('fp-task-data').value = '';
      loadTasks();
    });
  }

  function openAssignDrop(btn) {
    /* remove dropdown existente */
    var ex = document.getElementById('fp-assign-drop');
    if (ex) { ex.remove(); return; }

    var outros = teamMembers.filter(function(m) { return m.id !== (user.id || user.app_user_id); });
    var drop = document.createElement('div');
    drop.id = 'fp-assign-drop';
    var _dark    = document.documentElement.getAttribute('data-theme') === 'dark';
    var _dropBg  = _dark ? '#2A2926' : '#fff';
    var _dropBdr = _dark ? 'rgba(255,255,255,.1)' : '#ECEAE4';
    var _dropTxt = _dark ? '#F0EDE6' : '#111110';
    var _hoverBg = _dark ? '#3A3936' : '#F7F6F3';
    drop.style.cssText = 'position:fixed;z-index:700;background:' + _dropBg + ';border:1px solid ' + _dropBdr + ';border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.22);padding:4px 0;min-width:160px;font-family:Raleway,sans-serif;color:' + _dropTxt;

    if (!outros.length) {
      drop.innerHTML = '<div style="padding:7px 12px;font-size:11px;color:#aaa">Nenhum membro</div>';
    } else {
      drop.innerHTML = outros.map(function(u, i) {
        var nome = (u.apelido || (u.nome||'').split(' ')[0]);
        var cor  = u.cor || '#888';
        var ini  = u.iniciais || (u.nome||'').substring(0,2).toUpperCase();
        return '<div data-i="'+i+'" style="padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:7px;color:' + _dropTxt + '" ' +
          'onmouseenter="this.style.background=\'' + _hoverBg + '\'" onmouseleave="this.style.background=\'\'" ' +
          'onclick="fpChat._assignTo('+i+')">' +
          '<span style="width:20px;height:20px;border-radius:50%;background:'+escHtml(cor)+';color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+escHtml(ini)+'</span>' +
          escHtml(nome) + '</div>';
      }).join('');
    }

    document.body.appendChild(drop);
    var rect   = btn.getBoundingClientRect();
    var dropH  = drop.offsetHeight;
    var topPos = rect.top - dropH - 6;
    drop.style.left = rect.left + 'px';
    drop.style.top  = (topPos >= 8 ? topPos : rect.bottom + 4) + 'px';

    /* store refs for the onclick */
    window._fpAssignOthers = outros;
    setTimeout(function() {
      function handler(e) {
        if (!drop.contains(e.target) && e.target !== btn) {
          drop.remove(); delete window._fpAssignOthers;
          document.removeEventListener('click', handler);
        }
      }
      document.addEventListener('click', handler);
    }, 0);
  }

  window._assignTo = function(i) {
    var ex = document.getElementById('fp-assign-drop');
    if (ex) ex.remove();
    var u = (window._fpAssignOthers || [])[i];
    delete window._fpAssignOthers;
    if (!u) return;
    var desc = (document.getElementById('fp-task-desc') || {}).value || '';
    var tipo = (document.getElementById('fp-task-tipo') || {}).value || '';
    var data = (document.getElementById('fp-task-data') || {}).value || null;
    desc = desc.trim();
    if (!desc) { document.getElementById('fp-task-desc').focus(); return; }
    var meuid = user.id || user.app_user_id;
    sb.from('tarefas_livres').insert({
      usuario_id: u.id, atribuido_para: u.id, criado_por: meuid,
      descricao: desc, tipo: tipo || null, data_limite: data || null
    }).then(function(r) {
      if (r.error) return;
      document.getElementById('fp-task-desc').value = '';
      document.getElementById('fp-task-data').value = '';
      loadTasks();
    });
  };

  /* expor para o HTML inline */
  window.fpChat = window.fpChat || {};
  window.fpChat._assignTo = window._assignTo;

  function checkTask(event, taskId) {
    event.stopPropagation();
    var btn = event.currentTarget;
    btn.classList.add('done');
    sb.from('tarefas_livres').update({ concluida: true }).eq('id', taskId)
      .then(function(r) {
        if (r.error) { btn.classList.remove('done'); return; }
        tasksCache = tasksCache.filter(function(t) { return String(t.id) !== String(taskId); });
        setTimeout(function() { renderTasks(tasksCache); }, 400);
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL DE LISTAS — abas: Tarefas / Ck. Abertos / Ck. Etapa / Revisão
  ═══════════════════════════════════════════════════════════════════ */
  var _listsActiveTab = 'tarefas';
  var _ckAbertosAll   = [];
  var _ckEtapaAll     = [];
  var _ckRevisaoAll   = [];

  var _ckLabelFns = {};

  function switchListsTab(tab) {
    _listsActiveTab = tab;
    document.querySelectorAll('.fp-lists-tab').forEach(function(el) {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    var $list   = document.getElementById('fp-tasks-list');
    var $form   = document.getElementById('fp-task-form');
    var $ckView = document.getElementById('fp-ck-view');
    var $count  = document.getElementById('fp-tasks-panel-count');
    if ($count) $count.style.display = tab === 'tarefas' ? '' : 'none';
    if (tab === 'tarefas') {
      if ($list)   $list.style.display = '';
      if ($form)   $form.style.display = '';
      if ($ckView) $ckView.style.display = 'none';
      loadTasks();
    } else {
      if ($list)   $list.style.display = 'none';
      if ($form)   $form.style.display = 'none';
      if ($ckView) $ckView.style.display = 'flex';
      _loadCkTab(tab);
    }
  }

  function _loadCkTab(tab) {
    var $items = document.getElementById('fp-ck-items');
    var $sel   = document.getElementById('fp-ck-select');
    if ($items) $items.innerHTML = '<div class="fp-loading" style="padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';
    if ($sel)   $sel.innerHTML   = '<option value="">— carregando… —</option>';
    var uid = user.id || user.app_user_id;
    if (tab === 'abertos')  _loadCkAbertos(uid);
    else if (tab === 'etapa')   _loadCkEtapa(uid);
    else if (tab === 'revisao') _loadCkRevisao(uid);
  }

  function _ckShowErr(msg) {
    var $w = document.getElementById('fp-ck-selector');
    var $i = document.getElementById('fp-ck-items');
    if ($w) $w.innerHTML = '<div style="font-size:10px;color:#B84C3A;padding:4px 0">Erro: ' + escHtml(msg) + '</div>';
    if ($i) $i.innerHTML = '';
  }

  function _loadCkAbertos(uid) {
    sb.from('checklist_tarefa')
      .select('id,titulo,status,produto_id,criado_por,editores_ids,checklist_tarefa_item(id,texto,secao,ordem,concluido,concluido_por_nome,concluido_em),produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome)))')
      .eq('status', 'aberto')
      .then(function(r) {
        if (r.error) { _ckShowErr(r.error.message); return; }
        var all = (r.data || []).filter(function(cl) {
          return cl.criado_por === uid || (Array.isArray(cl.editores_ids) && cl.editores_ids.indexOf(uid) > -1);
        });
        _ckAbertosAll = all;
        _renderCkSelector('abertos', all, function(cl) {
          var p = cl.produtos || {}, o = p.oportunidades || {};
          return ((o.clientes && o.clientes.nome) ? o.clientes.nome + ' | ' : '') + (o.projeto || p.nome || 'Projeto') + ' — ' + (cl.titulo || '');
        });
      });
  }

  function _loadCkEtapa(uid) {
    sb.from('etapa_desenvolvedores')
      .select('etapa_id,etapas(id,nome,produto_id,produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome))))')
      .eq('usuario_id', uid)
      .then(function(devR) {
        if (devR.error) { _ckShowErr(devR.error.message); return; }
        var etapaIds = (devR.data || []).map(function(d){ return d.etapa_id; });
        if (!etapaIds.length) { _renderCkSelector('etapa', [], function(){ return ''; }); return; }
        var etapaMap = {};
        (devR.data || []).forEach(function(d){ if (d.etapas) etapaMap[d.etapa_id] = d.etapas; });
        sb.from('checklist_etapa_exec')
          .select('id,preset_id,etapa_id,checklist_etapa_preset!preset_id(nome),checklist_etapa_exec_item(id,texto,secao,secao_id,ordem,concluido,concluido_por_nome,concluido_em)')
          .in('etapa_id', etapaIds)
          .then(function(r) {
            if (r.error) { _ckShowErr(r.error.message); return; }
            var execList = (r.data || []).map(function(exec) {
              var etapa = etapaMap[exec.etapa_id] || {};
              var prod  = etapa.produtos || {}, opp = prod.oportunidades || {};
              exec._etapaNome   = etapa.nome || '';
              exec._prodNome    = (opp.projeto || prod.nome) || '';
              exec._clienteNome = (opp.clientes && opp.clientes.nome) || '';
              exec._coordId     = prod.coordenador_id || null;
              exec.checklist_etapa_exec_secao = [];
              return exec;
            });
            var execIds = execList.map(function(e){ return e.id; });
            sb.from('checklist_etapa_exec_secao')
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
    sb.from('etapa_desenvolvedores')
      .select('etapa_id,etapas(id,nome,produto_id,produtos(nome,coordenador_id,oportunidades(projeto,clientes(nome))))')
      .eq('usuario_id', uid)
      .then(function(devR) {
        if (devR.error) { _ckShowErr(devR.error.message); return; }
        var etapaIds = (devR.data || []).map(function(d){ return d.etapa_id; });
        if (!etapaIds.length) { _renderCkSelector('revisao', [], function(){ return ''; }); return; }
        var etapaMap = {};
        (devR.data || []).forEach(function(d){ if (d.etapas) etapaMap[d.etapa_id] = d.etapas; });
        sb.from('revisoes')
          .select('id,etapa_id,created_at,pranchas(id,nome,ordem,tarefas_revisao(id,descricao,concluida,created_at))')
          .in('etapa_id', etapaIds)
          .order('created_at')
          .then(function(r) {
            if (r.error) { _ckShowErr(r.error.message); return; }
            var contadores = {};
            var items = (r.data || []).map(function(rev) {
              contadores[rev.etapa_id] = (contadores[rev.etapa_id] || 0) + 1;
              var etapa = etapaMap[rev.etapa_id] || {};
              var prod  = etapa.produtos || {}, opp = prod.oportunidades || {};
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
    // Ordena: pendentes primeiro, concluídos por último
    var pending = items.filter(function(it, i){ it._idx = i; return !_ckIsDone(tipo, it); });
    var done    = items.filter(function(it, i){ it._idx = i; return  _ckIsDone(tipo, it); });
    var sorted  = pending.concat(done);
    var opts = '<option value="">— selecionar —</option>' + sorted.map(function(it) {
      var lbl = escHtml(labelFn(it));
      var cls = _ckIsDone(tipo, it) ? ' class="fp-ck-opt-done"' : '';
      return '<option value="' + it._idx + '"' + cls + '>' + lbl + '</option>';
    }).join('');
    $wrap.innerHTML = '<select class="fp-ck-select" id="fp-ck-select" onchange="fpChat.selectCkByIndex(\'' + tipo + '\',this.value)">' + opts + '</select>';
    if ($items) $items.innerHTML = '';
    /* Restaura última seleção ou auto-seleciona se só houver um */
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

  function selectCkByIndex(tipo, idx) {
    var $wrap  = document.getElementById('fp-ck-selector');
    var $items = document.getElementById('fp-ck-items');
    var $foot  = document.getElementById('fp-ck-footer');
    if (!$items) return;
    if (idx === '' || idx === null || idx === undefined) {
      localStorage.removeItem('exp_ck_last_' + tipo);
      $items.innerHTML = '';
      if ($foot) { $foot.innerHTML = ''; $foot.style.display = 'none'; }
      _renderCkSelector(tipo, tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll, _ckLabelFns[tipo] || function(){ return ''; });
      return;
    }
    var list = tipo === 'abertos' ? _ckAbertosAll : tipo === 'etapa' ? _ckEtapaAll : _ckRevisaoAll;
    var ck   = list[parseInt(idx)];
    if (!ck) return;
    localStorage.setItem('exp_ck_last_' + tipo, String(ck.id));
    var d = _ckGetDetail(tipo, ck);
    var projLine  = escHtml(d.cliente ? d.cliente + ' | ' + d.proj : d.proj);
    var etapaLine = d.etapa ? '<div class="fp-ck-sel-sub">' + escHtml(d.etapa) + '</div>' : '';
    var nomeLine  = d.nome  ? '<div class="fp-ck-sel-sub">' + escHtml(d.nome)  + '</div>' : '';
    if ($wrap) $wrap.innerHTML =
      '<div class="fp-ck-sel-title">' +
        '<div class="fp-ck-sel-info">' +
          '<div class="fp-ck-sel-proj">' + projLine + '</div>' +
          etapaLine + nomeLine +
        '</div>' +
        '<button class="fp-ck-sel-back" onclick="fpChat.selectCkByIndex(\'' + tipo + '\',\'\')" title="Trocar">↩ trocar</button>' +
      '</div>';
    _renderCkItems(tipo, ck);
  }


  function _renderCkItems(tipo, ck) {
    var $items = document.getElementById('fp-ck-items');
    if (!$items) return;
    var html = '';

    if (tipo === 'abertos') {
      var its = (ck.checklist_tarefa_item || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      // Detecta se há seções
      var hasSec = its.some(function(it){ return !!it.secao; });
      if (!hasSec) {
        // Lista plana — add row único no fim
        its.forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
        html += _fpCkAddRow(tipo, ck.id, '');
      } else {
        // Itens sem seção primeiro
        its.filter(function(it){ return !it.secao; }).forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
        // Agrupa seções em ordem de aparição
        var seenSecs = []; var secGroups = {};
        its.forEach(function(it) {
          if (!it.secao) return;
          if (seenSecs.indexOf(it.secao) === -1) seenSecs.push(it.secao);
          if (!secGroups[it.secao]) secGroups[it.secao] = [];
          secGroups[it.secao].push(it);
        });
        seenSecs.forEach(function(sec) {
          html += '<div><div class="fp-ck-secao">' + escHtml(sec) + '</div>';
          secGroups[sec].forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
          html += _fpCkAddRow(tipo, ck.id, sec);
          html += '</div>';
        });
      }
      $items.innerHTML = html;
      _renderCkFooter(tipo, ck);

    } else if (tipo === 'etapa') {
      var its    = (ck.checklist_etapa_exec_item || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      var secoes = (ck.checklist_etapa_exec_secao || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      if (secoes.length) {
        its.filter(function(it){ return !it.secao_id; }).forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
        secoes.forEach(function(s) {
          html += '<div><div class="fp-ck-secao">' + escHtml(s.titulo) + '</div>';
          its.filter(function(it){ return it.secao_id === s.id; }).forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
          html += _fpCkAddRow(tipo, ck.id, s.titulo);
          html += '</div>';
        });
      } else {
        its.forEach(function(it){ html += _fpCkItemHtml(it, tipo, ck.id); });
        html += _fpCkAddRow(tipo, ck.id, '');
      }
      $items.innerHTML = html;
      _renderCkFooter(tipo, ck);

    } else if (tipo === 'revisao') {
      var pranchas = (ck.pranchas || []).slice().sort(function(a,b){ return a.ordem-b.ordem; });
      pranchas.forEach(function(pr) {
        html += '<div class="fp-ck-secao">' + escHtml(pr.nome || '') + '</div>';
        (pr.tarefas_revisao || []).forEach(function(t){ html += _fpCkItemHtml(t, tipo, ck.id); });
      });
      $items.innerHTML = html;
      _renderCkFooter(tipo, ck);
    }
  }

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
        var sitems = its.filter(function(i){ return i.secao_id === sid; });
        return sitems.length > 0 && sitems.every(function(i){ return i.concluido; });
      }).length;
    } else {
      var pranchas = (ck.pranchas || []);
      its = pranchas.reduce(function(a,p){ return a.concat(p.tarefas_revisao||[]); }, []);
      tasksTotal = its.length; tasksDone = its.filter(function(t){ return t.concluida; }).length;
      secs = pranchas.map(function(p){ return p.id; });
      secsDone = pranchas.filter(function(p){ return (p.tarefas_revisao||[]).length > 0 && (p.tarefas_revisao||[]).every(function(t){ return t.concluida; }); }).length;
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
      var m = allMembers.find(function(u){ return u.id === d.coordId; });
      if (m) coords.push(m);
    }
    if (ck._subcoordId) {
      var m2 = allMembers.find(function(u){ return u.id === ck._subcoordId; });
      if (m2) coords.push(m2);
    }
    var coordsHtml = coords.length
      ? '<div class="fp-ck-coords">' + coords.map(function(u) {
          var ini = u.iniciais || (u.nome||'').substring(0,2).toUpperCase();
          var cor = u.cor || '#888';
          return '<div class="fp-ck-coord-av" style="background:' + escHtml(cor) + '" title="' + escHtml(u.nome||'') + '">' + escHtml(ini) + '</div>';
        }).join('') + '</div>'
      : '';

    $foot.innerHTML =
      (s.secsTotal > 0 ? '<div class="fp-ck-bar-row">' +
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


  function _fpCkItemHtml(it, tipo, ckId) {
    var checked = tipo === 'revisao' ? it.concluida : it.concluido;
    var id  = escHtml(String(it.id));
    var cid = escHtml(String(ckId));
    var txt = escHtml(it.descricao || it.texto || '');
    return '<div class="fp-ck-item" id="fp-ck-it-' + id + '">' +
      '<input type="checkbox" class="fp-ck-cb"' + (checked ? ' checked' : '') +
      ' onchange="fpChat.fpToggleCkItem(\'' + tipo + '\',\'' + id + '\',this.checked,\'' + cid + '\')">' +
      '<span class="fp-ck-txt' + (checked ? ' done' : '') + '">' + txt + '</span>' +
      '</div>';
  }

  function _fpCkAddRow(tipo, ckId, secao) {
    var cid      = escHtml(String(ckId));
    var secAttr  = secao ? ' data-secao="' + escHtml(String(secao)) + '"' : '';
    return '<div class="fp-ck-add">' +
      '<div class="fp-ck-cb-mock"></div>' +
      '<input class="fp-ck-add-inp" type="text" placeholder="+ Novo item…"' +
      secAttr +
      ' onkeydown="if(event.key===\'Enter\'){fpChat.fpAddCkItem(\'' + tipo + '\',\'' + cid + '\',this)}"' +
      ' onblur="fpChat.fpAddCkItemBlur(\'' + tipo + '\',\'' + cid + '\',this)">' +
      '</div>';
  }

  function fpToggleCkItem(tipo, itemId, checked, ckId) {
    var now = new Date().toISOString();
    var uid = user.id || user.app_user_id;
    var tbl = tipo === 'abertos' ? 'checklist_tarefa_item' : tipo === 'etapa' ? 'checklist_etapa_exec_item' : 'tarefas_revisao';
    var upd = tipo === 'revisao'
      ? { concluida: checked }
      : { concluido: checked, concluido_por: checked ? uid : null, concluido_por_nome: checked ? (user.nome||'') : null, concluido_em: checked ? now : null };
    sb.from(tbl).update(upd).eq('id', itemId).then(function(r) {
      if (r.error) return;
      // update local cache
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
      // update DOM item
      var $span = document.querySelector('#fp-ck-it-' + itemId + ' .fp-ck-txt');
      if ($span) $span.className = 'fp-ck-txt' + (checked ? ' done' : '');
      // update footer bars
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
    sb.from(tbl).insert(payload).select().single()
      .then(function(r) {
        if (r.error || !r.data) return;
        if (!ck[field]) ck[field] = [];
        ck[field].push(r.data);
        // Insere o item antes do add-row da MESMA seção
        var $addRow = inp.closest('.fp-ck-add');
        if ($addRow) {
          var tmp = document.createElement('div');
          tmp.innerHTML = _fpCkItemHtml(r.data, tipo, ckId);
          $addRow.parentNode.insertBefore(tmp.firstChild, $addRow);
        }
        _renderCkFooter(tipo, ck);
        setTimeout(function(){ inp.focus(); }, 20);
      });
  }

  function fpAddCkItemBlur(tipo, ckId, inp) {
    if ((inp.value||'').trim()) fpAddCkItem(tipo, ckId, inp);
  }

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL COMPLETO DE PRIORIDADES (click no ⭐)
  ═══════════════════════════════════════════════════════════════════ */
  var prioPanelOpen   = false;
  var allPrioData     = null;   /* cache de todas as prioridades */
  var allPrioLoaded   = false;

  function togglePrioPanel() {
    hidePrioBanner();
    var wasOpen = prioPanelOpen;
    _closeExpPanel();               /* fecha qualquer painel aberto */
    if (wasOpen) return;            /* era eu → apenas fecha */
    prioPanelOpen = true;
    var $panel = document.getElementById('fp-prio-panel');
    var $btn   = document.getElementById('fp-nav-prio');
    if ($panel) $panel.style.display = 'flex';
    if ($btn)   $btn.classList.add('active');
    if (!allPrioLoaded) fetchAllPrioridades();
    else renderPrioPanel();
  }

  /* mantida por compatibilidade com o botão × do painel */
  function openPrioPanel()  { if (!prioPanelOpen) togglePrioPanel(); }
  function closePrioPanel() { if (prioPanelOpen)  togglePrioPanel(); }

  function fetchAllPrioridades() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    var $list = document.getElementById('fp-prio-panel-list');
    if ($list) $list.innerHTML = '<div class="fp-loading" style="padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';

    sb.from('prioridades_usuario')
      .select('id,produto_id,prazo_texto,ordem,comentario,concluida,concluida_em,produtos(id,nome,oportunidades(projeto,cidade,clientes(nome,uf)),etapas(nome,status,ordem))')
      .eq('usuario_id', uid).order('ordem')
      .then(function(r) {
        allPrioLoaded = true;
        allPrioData   = r.data || [];
        renderPrioPanel();
      })
      .catch(function() {
        allPrioLoaded = true;
        allPrioData   = [];
        renderPrioPanel();
      });
  }

  function renderPrioPanel() {
    var $list  = document.getElementById('fp-prio-panel-list');
    var $count = document.getElementById('fp-prio-panel-count');
    if (!$list) return;

    /* pendentes primeiro (por ordem), concluídas por último (por data de conclusão) */
    var raw = (allPrioData || []).slice();
    raw.sort(function(a, b) {
      if (!!a.concluida !== !!b.concluida) return a.concluida ? 1 : -1;
      if (!a.concluida) return (a.ordem || 99) - (b.ordem || 99);
      return (b.concluida_em || '').localeCompare(a.concluida_em || '');
    });
    var items = raw;
    var pendentes = items.filter(function(p){ return !p.concluida; }).length;
    if ($count) $count.textContent = pendentes ? pendentes + ' em aberto' : 'todas concluídas';

    if (!items.length) {
      $list.innerHTML = '<div style="padding:28px 16px;text-align:center;font-size:11px;color:var(--cinza,#D0CFC9)">Nenhuma prioridade definida ✓</div>';
      return;
    }

    var hoje = new Date(); hoje.setHours(0,0,0,0);
    var html = '';

    items.forEach(function(pr) {
      var prod = pr.produtos || {};
      var opp  = prod.oportunidades || {};
      var cli  = opp.clientes || {};
      var titulo   = [cli.nome, opp.projeto].filter(Boolean).join(' | ') || prod.nome || 'Projeto';
      var cidadeUf = [opp.cidade, cli.uf].filter(Boolean).join('/');
      var etapas   = (prod.etapas || []).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
      var etapa    = etapas.find(function(e){ return e.status==='em_andamento'; }) || etapas.find(function(e){ return e.status!=='concluida'; });
      var ord      = Math.min(pr.ordem || 1, 6);
      var numCls   = NUM_CLS[ord] || 'p6';

      var estadoCard = '';
      var chipHtml   = '';
      if (pr.prazo_texto) {
        var pdt = new Date(pr.prazo_texto + 'T12:00:00'); pdt.setHours(0,0,0,0);
        var dtFmt = pdt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
        if (pdt < hoje)        estadoCard = 'atrasada';
        else if (+pdt===+hoje) estadoCard = 'hoje';
        chipHtml = '<div class="fp-pp-chips"><span class="fp-pp-chip ' + estadoCard + '">📅 ' + escHtml(dtFmt) + '</span></div>';
      }

      var concluida = !!pr.concluida;
      /* concluídas: sem cor de estado, apenas cinza */
      if (concluida) { estadoCard = ''; chipHtml = ''; }
      var produtoId = escHtml(String(pr.produto_id || ''));
      var prioId    = escHtml(String(pr.id));

      html += '<div class="fp-pp-card ' + estadoCard + (concluida ? ' fp-pp-done' : '') + '" onclick="fpChat.openProjectOverlay(\'' + produtoId + '\')">' +
        '<div class="fp-pp-info">' +
          '<div class="fp-pp-nome">' + escHtml(titulo) + '</div>' +
          (cidadeUf  ? '<div class="fp-pp-cidade">' + escHtml(cidadeUf) + '</div>' : '') +
          (etapa     ? '<div class="fp-pp-etapa">↳ ' + escHtml(etapa.nome||'') + '</div>' : '') +
          (prod.nome && prod.nome !== titulo ? '<div class="fp-pp-prod">' + escHtml(prod.nome) + '</div>' : '') +
          (pr.comentario ? '<div class="fp-pp-coment">' + escHtml(pr.comentario) + '</div>' : '') +
          chipHtml +
        '</div>' +
        '<button class="fp-pp-check" onclick="event.stopPropagation();fpChat.checkPrioPanel(\'' + prioId + '\')" title="Concluída">✓</button>' +
        '</div>';
    });

    $list.innerHTML = html;
  }

  function checkPrioPanel(prioId) {
    sb.from('prioridades_usuario')
      .update({ concluida: true, concluida_em: new Date().toISOString() })
      .eq('id', prioId)
      .then(function(r) {
        if (r.error) return;
        allPrioData   = (allPrioData || []).filter(function(p){ return String(p.id) !== String(prioId); });
        prioLoaded    = false;   /* invalida o cache do banner */
        prioData      = null;
        renderPrioPanel();
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     HOVER BANNER — CALENDÁRIO (próximos 3 eventos)
  ═══════════════════════════════════════════════════════════════════ */
  var calBannerTimer  = null;
  var calData         = null;
  var calLoaded       = false;
  var calLoadedAt     = 0;      /* timestamp da última busca — recarrega após 5 min */

  function _positionBanner($banner, $btn) {
    var rect    = $btn.getBoundingClientRect();
    var bannerH = $banner.offsetHeight || 200;
    var topPos  = Math.max(16, Math.min(rect.top, window.innerHeight - bannerH - 16));
    $banner.style.top  = topPos + 'px';
    $banner.style.left = (rect.right + 8) + 'px';
  }

  function showCalBanner(event) {
    if (calBannerTimer) { clearTimeout(calBannerTimer); calBannerTimer = null; }
    var $b = document.getElementById('fp-cal-banner');
    var $btn = (event && event.currentTarget) || document.getElementById('fp-nav-cal');
    if (!$b || !$btn) return;
    $b.style.display = 'block';
    _positionBanner($b, $btn);
    var stale = (Date.now() - calLoadedAt) > 5 * 60 * 1000;  /* 5 min */
    if (!calLoaded || stale) fetchCalEvents();
    else renderCalBanner();
  }
  function hideCalBanner() {
    calBannerTimer = setTimeout(function() {
      var $b = document.getElementById('fp-cal-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }
  function fetchCalEvents() {
    /* user_id na tabela é o ID interno (usuarios.id), não o auth_id */
    var internalId = user.app_user_id || user.id;
    /* início de hoje (meia-noite local) em ISO — para não perder eventos que já começaram */
    var today = new Date(); today.setHours(0,0,0,0);
    var todayISO = today.toISOString();
    sb.from('calendar_events')
      .select('id,titulo,tipo,inicio,fim,dia_inteiro,meet_link,scope')
      .gte('fim', todayISO)         /* mostra eventos que ainda não terminaram hoje */
      .or('scope.eq.todos,user_id.eq.' + internalId)
      .order('inicio').limit(5)
      .then(function(r) { calLoaded = true; calLoadedAt = Date.now(); calData = r.data || []; renderCalBanner(); })
      .catch(function()  { calLoaded = true; calLoadedAt = Date.now(); calData = [];            renderCalBanner(); });
  }
  function renderCalBanner() {
    var $body = document.getElementById('fp-cal-banner-body');
    var $sub  = document.getElementById('fp-cal-banner-sub');
    if (!$body) return;
    var items = calData || [];
    if ($sub) $sub.textContent = items.length ? 'próximos ' + items.length : '';
    if (!items.length) {
      $body.innerHTML = '<div style="padding:20px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhum evento próximo 🎉</div>';
      return;
    }
    /* paleta por tipo */
    var tipoCor = { reuniao:'#1D4FA0', visita:'#1D6A4A', prazo:'#B84C3A', entrega:'#C4831A' };
    var html = '';
    items.forEach(function(ev) {
      var cor  = tipoCor[(ev.tipo||'').toLowerCase()] || '#6D7D8A';
      var dt   = new Date(ev.inicio);
      var dFmt = dt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
      var hFmt = ev.dia_inteiro ? 'dia inteiro' : dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      var meet = ev.meet_link ? '<a class="fp-cal-meet" href="' + escHtml(ev.meet_link) + '" target="_blank" rel="noopener">▶ Meet</a>' : '';
      html += '<div class="fp-cal-item">' +
        '<div class="fp-cal-dot" style="background:' + escHtml(cor) + '"></div>' +
        '<div class="fp-cal-info">' +
          '<div class="fp-cal-titulo">' + escHtml(ev.titulo || '—') + '</div>' +
          '<div class="fp-cal-meta">' +
            '<span>' + escHtml(dFmt) + ' · ' + escHtml(hFmt) + '</span>' +
            meet +
          '</div>' +
        '</div>' +
        '</div>';
    });
    $body.innerHTML = html;
    /* reposicionar depois de renderizar (altura mudou) */
    var $banner = document.getElementById('fp-cal-banner');
    var $btn    = document.getElementById('fp-nav-cal');
    if ($banner && $btn) _positionBanner($banner, $btn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     HOVER BANNER — COMERCIAL (5 follow-ups em aberto)
  ═══════════════════════════════════════════════════════════════════ */
  var crmBannerTimer = null;
  var crmData        = null;
  var crmLoaded      = false;

  var crmEncerrados = null;   /* produtos fechados/negados últimos 7 dias */

  function showCrmBanner(event) {
    if (crmBannerTimer) { clearTimeout(crmBannerTimer); crmBannerTimer = null; }
    var $b   = document.getElementById('fp-crm-banner');
    var $btn = (event && event.currentTarget) || document.getElementById('fp-nav-crm');
    if (!$b || !$btn) return;
    $b.style.display = 'block';
    _positionBanner($b, $btn);
    $btn.classList.add('active');
    if (!crmLoaded) fetchCrmData();
    else renderCrmBanner();
  }
  function hideCrmBanner() {
    crmBannerTimer = setTimeout(function() {
      var $b   = document.getElementById('fp-crm-banner');
      var $btn = document.getElementById('fp-nav-crm');
      if ($b) $b.style.display = 'none';
      if ($btn) $btn.classList.remove('active');
    }, 220);
  }

  function fetchCrmData() {
    var cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var hoje    = new Date().toISOString().split('T')[0];

    Promise.all([
      /* Seção 1: produtos fechados/negados nos últimos 7 dias */
      sb.from('produtos')
        .select('id,nome,status,valor_fechado,valor_proposto,data_fechamento,updated_at,oportunidades(projeto,clientes(nome))')
        .in('status', ['fechado', 'negado'])
        .or('data_fechamento.gte.' + cutoff7 + ',and(status.eq.negado,updated_at.gte.' + cutoff7 + ')')
        .order('updated_at', { ascending: false })
        .limit(5),
      /* Seção 2: próximos follow-ups */
      sb.from('followups_produto')
        .select('id,next_date,obs,produto_id,produtos(nome,oportunidades(projeto,clientes(nome)))')
        .not('next_date', 'is', null)
        .gte('next_date', hoje)
        .order('next_date', { ascending: true })
        .limit(5)
    ]).then(function(res) {
      crmLoaded     = true;
      crmEncerrados = res[0].data || [];
      crmData       = res[1].data || [];
      renderCrmBanner();
    }).catch(function() {
      crmLoaded     = true;
      crmEncerrados = [];
      crmData       = [];
      renderCrmBanner();
    });
  }

  function renderCrmBanner() {
    var $body = document.getElementById('fp-crm-banner-body');
    var $sub  = document.getElementById('fp-crm-banner-sub');
    if (!$body) return;

    var enc  = crmEncerrados || [];
    var fups = crmData || [];
    var total = enc.length + fups.length;
    if ($sub) $sub.textContent = total ? total + (total === 1 ? ' item' : ' itens') : '';

    var html = '';

    /* ── Seção 1: Fechamentos e negações ── */
    if (enc.length) {
      html += '<div class="fp-crm-sec-hdr">Últimos 7 dias</div>';
      enc.forEach(function(p) {
        var opp     = p.oportunidades || {};
        var cli     = opp.clientes || {};
        var cliente = escHtml(cli.nome || '—');
        var projeto = escHtml(opp.projeto || p.nome || '—');
        var isFech  = (p.status === 'fechado');
        var cls     = isFech ? 'fechado' : 'negado';
        var valor   = isFech ? (+p.valor_fechado || +p.valor_proposto || 0)
                             : (+p.valor_proposto || 0);
        var valFmt  = valor ? 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
        html += '<div class="fp-crm-fech-item ' + cls + '">' +
          '<div class="fp-crm-fech-info">' +
            '<div class="fp-crm-fech-cliente">' + cliente + '</div>' +
            '<div class="fp-crm-fech-opp">' + projeto + '</div>' +
          '</div>' +
          '<div class="fp-crm-fech-valor">' + escHtml(valFmt) + '</div>' +
          '</div>';
      });
    }

    /* ── Seção 2: Próximos follow-ups ── */
    if (fups.length) {
      html += '<div class="fp-crm-sec-hdr">Próximos follow-ups</div>';
      var hoje = new Date().toISOString().split('T')[0];
      fups.forEach(function(fu) {
        var prod    = fu.produtos || {};
        var opp     = prod.oportunidades || {};
        var cli     = opp.clientes || {};
        var cliente = escHtml(cli.nome || '—');
        var projeto = escHtml(opp.projeto || prod.nome || '—');
        var dt      = fu.next_date || '';
        var cls     = dt < hoje ? 'atrasado' : dt === hoje ? 'hoje' : '';
        var dtParts = dt ? dt.split('-') : [];
        var dtFmt   = dtParts.length === 3
          ? dtParts[2] + '/' + dtParts[1] + '/' + dtParts[0].slice(2)
          : '—';
        html += '<div class="fp-fu-item ' + cls + '">' +
          '<div class="fp-fu-info">' +
            '<div class="fp-fu-cliente">' + cliente + '</div>' +
            '<div class="fp-fu-proj">' + projeto + '</div>' +
          '</div>' +
          '<div class="fp-fu-date">' + escHtml(dtFmt) + '</div>' +
          '</div>';
      });
    }

    if (!html) {
      html = '<div style="padding:20px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhuma atualização recente ✓</div>';
    }

    $body.innerHTML = html;
    /* reposicionar após altura mudar */
    var $banner = document.getElementById('fp-crm-banner');
    var $btn    = document.getElementById('fp-nav-crm');
    if ($banner && $btn) _positionBanner($banner, $btn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL DE BUSCA — APOIO
  ═══════════════════════════════════════════════════════════════════ */
  var apoioPanelOpen   = false;
  var apoioSearchTimer = null;

  function toggleApoioPanel(event) {
    if (apoioPanelOpen) closeApoioPanel();
    else                openApoioPanel(event);
  }

  function openApoioPanel(event) {
    apoioPanelOpen = true;
    var $p   = document.getElementById('fp-apoio-panel');
    var $btn = (event && event.currentTarget) || document.getElementById('fp-nav-apoio');
    if (!$p || !$btn) return;
    $p.style.display = 'flex';
    _positionBanner($p, $btn);
    setTimeout(function() {
      var $inp = document.getElementById('fp-apoio-input');
      if ($inp) $inp.focus();
    }, 50);
    setTimeout(function() {
      document.addEventListener('click', _apoioOutsideClick);
      document.addEventListener('keydown', _apoioKeyClose);
    }, 10);
  }

  function closeApoioPanel() {
    apoioPanelOpen = false;
    var $p = document.getElementById('fp-apoio-panel');
    if ($p) $p.style.display = 'none';
    document.removeEventListener('click', _apoioOutsideClick);
    document.removeEventListener('keydown', _apoioKeyClose);
  }

  function _apoioOutsideClick(e) {
    var $p   = document.getElementById('fp-apoio-panel');
    var $btn = document.getElementById('fp-nav-apoio');
    var $wrap = document.getElementById('fp-nav-apoio-wrap');
    if ($p && !$p.contains(e.target) && $wrap && !$wrap.contains(e.target)) {
      closeApoioPanel();
    }
  }

  function _apoioKeyClose(e) {
    if (e.key === 'Escape') closeApoioPanel();
  }

  function apoioSearchInput(q) {
    var $clr = document.getElementById('fp-apoio-clear');
    if ($clr) $clr.style.display = q ? 'flex' : 'none';
    if (apoioSearchTimer) clearTimeout(apoioSearchTimer);
    if (!q.trim()) {
      var $body = document.getElementById('fp-apoio-body');
      if ($body) $body.innerHTML = '<div class="fp-apoio-empty">Digite para buscar no módulo de Apoio</div>';
      var $sub = document.getElementById('fp-apoio-hdr-sub');
      if ($sub) $sub.textContent = '';
      return;
    }
    apoioSearchTimer = setTimeout(function() { _doApoioSearch(q.trim()); }, 280);
  }

  function apoioClear() {
    var $inp = document.getElementById('fp-apoio-input');
    if ($inp) { $inp.value = ''; $inp.focus(); }
    apoioSearchInput('');
  }

  function _doApoioSearch(q) {
    var $body = document.getElementById('fp-apoio-body');
    if (!$body) return;
    $body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';
    var like = '%' + q + '%';
    Promise.all([
      sb.from('apoio_normas').select('id,codigo,titulo,area').or('titulo.ilike.' + like + ',codigo.ilike.' + like).limit(4),
      sb.from('apoio_vegetacao_especie').select('id,nome_popular,nome_cientifico,grupo').ilike('nome_popular', like).limit(4),
      sb.from('apoio_indicacoes').select('id,titulo,autor').ilike('titulo', like).limit(3),
      sb.from('apoio_subtemas_custom').select('id,nome,tema_slug').ilike('nome', like).limit(3),
      sb.from('cadastros_plataformas').select('id,nome,numero').ilike('nome', like).limit(3)
    ]).then(function(res) {
      _renderApoioResults(res[0].data||[], res[1].data||[], res[2].data||[], res[3].data||[], res[4].data||[], q);
    }).catch(function() {
      if ($body) $body.innerHTML = '<div class="fp-apoio-empty">Erro ao buscar. Tente novamente.</div>';
    });
  }

  function _renderApoioResults(normas, vegetacao, indicacoes, subtemas, cadastros, q) {
    var $body = document.getElementById('fp-apoio-body');
    var $sub  = document.getElementById('fp-apoio-hdr-sub');
    if (!$body) return;
    var total = normas.length + vegetacao.length + indicacoes.length + subtemas.length + cadastros.length;
    if ($sub) $sub.textContent = total ? total + ' resultado' + (total !== 1 ? 's' : '') : '';
    if (!total) {
      $body.innerHTML = '<div class="fp-apoio-empty">Nenhum resultado para<br>"' + escHtml(q) + '"</div>';
      return;
    }
    var html = '';
    if (normas.length) {
      html += '<div class="fp-apoio-group-hdr">Normas Técnicas</div>';
      normas.forEach(function(n) {
        var label = n.codigo ? n.codigo + ' — ' + n.titulo : n.titulo;
        html += '<a href="apoio.html?tema=apoio&sub=normas-tecnicas" class="fp-apoio-result">' +
          '<div class="fp-apoio-result-dot" style="background:#1D4FA0"></div>' +
          '<div class="fp-apoio-result-info">' +
            '<div class="fp-apoio-result-title">' + escHtml(label) + '</div>' +
            '<div class="fp-apoio-result-sub">' + escHtml(n.area || '') + '</div>' +
          '</div></a>';
      });
    }
    if (vegetacao.length) {
      html += '<div class="fp-apoio-group-hdr">Vegetação</div>';
      vegetacao.forEach(function(v) {
        html += '<a href="apoio.html?tema=vegetacao" class="fp-apoio-result">' +
          '<div class="fp-apoio-result-dot" style="background:#1D6A4A"></div>' +
          '<div class="fp-apoio-result-info">' +
            '<div class="fp-apoio-result-title">' + escHtml(v.nome_popular) + '</div>' +
            '<div class="fp-apoio-result-sub">' + escHtml(v.nome_cientifico || v.grupo || '') + '</div>' +
          '</div></a>';
      });
    }
    if (indicacoes.length) {
      html += '<div class="fp-apoio-group-hdr">Indicações</div>';
      indicacoes.forEach(function(i) {
        html += '<a href="apoio.html?tema=apoio&sub=indicacoes-conteudo" class="fp-apoio-result">' +
          '<div class="fp-apoio-result-dot" style="background:#C4831A"></div>' +
          '<div class="fp-apoio-result-info">' +
            '<div class="fp-apoio-result-title">' + escHtml(i.titulo) + '</div>' +
            '<div class="fp-apoio-result-sub">' + escHtml(i.autor || '') + '</div>' +
          '</div></a>';
      });
    }
    if (subtemas.length) {
      html += '<div class="fp-apoio-group-hdr">Conhecimento</div>';
      subtemas.forEach(function(s) {
        html += '<a href="apoio.html?tema=apoio" class="fp-apoio-result">' +
          '<div class="fp-apoio-result-dot" style="background:#3E7858"></div>' +
          '<div class="fp-apoio-result-info">' +
            '<div class="fp-apoio-result-title">' + escHtml(s.nome) + '</div>' +
            '<div class="fp-apoio-result-sub">' + escHtml(s.tema_slug || '') + '</div>' +
          '</div></a>';
      });
    }
    if (cadastros.length) {
      html += '<div class="fp-apoio-group-hdr">Cadastros</div>';
      cadastros.forEach(function(c) {
        html += '<a href="apoio.html?tema=cadastros-senhas" class="fp-apoio-result">' +
          '<div class="fp-apoio-result-dot" style="background:#6D7D8A"></div>' +
          '<div class="fp-apoio-result-info">' +
            '<div class="fp-apoio-result-title">' + escHtml(c.nome) + '</div>' +
            '<div class="fp-apoio-result-sub">' + escHtml(c.numero ? '#' + c.numero : '') + '</div>' +
          '</div></a>';
      });
    }
    $body.innerHTML = html;
    /* reposicionar após altura mudar */
    var $panel = document.getElementById('fp-apoio-panel');
    var $btn   = document.getElementById('fp-nav-apoio');
    if ($panel && $btn) _positionBanner($panel, $btn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL DE BUSCA — CONTATOS
  ═══════════════════════════════════════════════════════════════════ */
  var contatosPanelOpen   = false;
  var contatosSearchTimer = null;

  /* Cores por tipo de contato */
  var CONTATO_TIPO_COR = {
    'fornecedor':  '#1D4FA0',
    'prestador':   '#1D6A4A',
    'parceiro':    '#C4831A',
    'cliente':     '#B84C3A',
    'outro':       '#6D7D8A'
  };
  function _contatoTipoCor(tipo) {
    if (!tipo) return '#6D7D8A';
    return CONTATO_TIPO_COR[(tipo+'').toLowerCase()] || '#6D7D8A';
  }

  function toggleContatosPanel(event) {
    if (contatosPanelOpen) closeContatosPanel();
    else                   openContatosPanel(event);
  }

  function openContatosPanel(event) {
    contatosPanelOpen = true;
    var $p   = document.getElementById('fp-contatos-panel');
    var $btn = (event && event.currentTarget) || document.getElementById('fp-nav-contatos');
    if (!$p || !$btn) return;
    $p.style.display = 'flex';
    _positionBanner($p, $btn);
    setTimeout(function() {
      var $inp = document.getElementById('fp-contatos-input');
      if ($inp) $inp.focus();
    }, 50);
    setTimeout(function() {
      document.addEventListener('click', _contatosOutsideClick);
      document.addEventListener('keydown', _contatosKeyClose);
    }, 10);
  }

  function closeContatosPanel() {
    contatosPanelOpen = false;
    var $p = document.getElementById('fp-contatos-panel');
    if ($p) $p.style.display = 'none';
    document.removeEventListener('click', _contatosOutsideClick);
    document.removeEventListener('keydown', _contatosKeyClose);
  }

  function _contatosOutsideClick(e) {
    var $p    = document.getElementById('fp-contatos-panel');
    var $wrap = document.getElementById('fp-nav-contatos-wrap');
    if ($p && !$p.contains(e.target) && $wrap && !$wrap.contains(e.target)) {
      closeContatosPanel();
    }
  }
  function _contatosKeyClose(e) { if (e.key === 'Escape') closeContatosPanel(); }

  function contatosSearchInput(q) {
    var $clr = document.getElementById('fp-contatos-clear');
    if ($clr) $clr.style.display = q ? 'flex' : 'none';
    if (contatosSearchTimer) clearTimeout(contatosSearchTimer);
    if (!q.trim()) {
      var $body = document.getElementById('fp-contatos-body');
      if ($body) $body.innerHTML = '<div class="fp-apoio-empty">Digite para buscar contatos</div>';
      var $sub = document.getElementById('fp-contatos-hdr-sub');
      if ($sub) $sub.textContent = '';
      return;
    }
    contatosSearchTimer = setTimeout(function() { _doContatosSearch(q.trim()); }, 280);
  }

  function contatosClear() {
    var $inp = document.getElementById('fp-contatos-input');
    if ($inp) { $inp.value = ''; $inp.focus(); }
    contatosSearchInput('');
  }

  function _doContatosSearch(q) {
    var $body = document.getElementById('fp-contatos-body');
    if (!$body) return;
    $body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';
    var like = '%' + q + '%';
    sb.from('exp_contatos')
      .select('id,nome,empresa,tipo_produto,cidade,estado,telefone,email,tipo')
      .eq('desativado', false)
      .or('nome.ilike.' + like + ',empresa.ilike.' + like + ',tipo_produto.ilike.' + like + ',cidade.ilike.' + like)
      .order('nome')
      .limit(10)
      .then(function(res) {
        _renderContatosResults(res.data || [], q);
      })
      .catch(function() {
        if ($body) $body.innerHTML = '<div class="fp-apoio-empty">Erro ao buscar. Tente novamente.</div>';
      });
  }

  function _renderContatosResults(contatos, q) {
    var $body = document.getElementById('fp-contatos-body');
    var $sub  = document.getElementById('fp-contatos-hdr-sub');
    if (!$body) return;
    var total = contatos.length;
    if ($sub) $sub.textContent = total ? total + ' resultado' + (total !== 1 ? 's' : '') : '';
    if (!total) {
      $body.innerHTML = '<div class="fp-apoio-empty">Nenhum resultado para<br>"' + escHtml(q) + '"</div>';
      return;
    }
    var html = '';
    contatos.forEach(function(c) {
      var cor = _contatoTipoCor(c.tipo);
      /* linha 1: empresa · tipo */
      var sub1Parts = [];
      if (c.empresa) sub1Parts.push(escHtml(c.empresa));
      if (c.tipo)    sub1Parts.push('<span class="fp-contatos-result-tag">' + escHtml(c.tipo) + '</span>');
      /* linha 2: cidade/estado · telefone */
      var meta = [];
      var loc = [c.cidade, c.estado].filter(Boolean).join('/');
      if (loc)       meta.push(escHtml(loc));
      if (c.telefone) meta.push(escHtml(c.telefone));
      if (c.tipo_produto) meta.push(escHtml(c.tipo_produto));
      /* link: abre contatos.html com busca pré-preenchida pelo nome */
      var href = 'contatos.html?q=' + encodeURIComponent(c.nome);
      html += '<a href="' + href + '" class="fp-contatos-result">' +
        '<div class="fp-contatos-result-dot" style="background:' + cor + '"></div>' +
        '<div class="fp-contatos-result-info">' +
          '<div class="fp-contatos-result-name">' + escHtml(c.nome) + '</div>' +
          (sub1Parts.length ? '<div class="fp-contatos-result-sub">' + sub1Parts.join('&ensp;·&ensp;') + '</div>' : '') +
          (meta.length ? '<div class="fp-contatos-result-meta">' + meta.join('&ensp;·&ensp;') + '</div>' : '') +
        '</div>' +
        '</a>';
    });
    $body.innerHTML = html;
    /* reposicionar após altura mudar */
    var $panel = document.getElementById('fp-contatos-panel');
    var $btn   = document.getElementById('fp-nav-contatos');
    if ($panel && $btn) _positionBanner($panel, $btn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     BANNER DE PRIORIDADE — estilo prio-card do dashboard
  ═══════════════════════════════════════════════════════════════════ */
  var prioData        = null;
  var prioBannerTimer = null;
  var prioLoaded      = false;
  var NUM_CLS         = ['','p1','p2','p3','p4','p5','p6'];

  function showPrioBanner() {
    if (prioBannerTimer) { clearTimeout(prioBannerTimer); prioBannerTimer = null; }
    var $banner = document.getElementById('fp-prio-banner');
    var $btn    = document.getElementById('fp-nav-prio');
    if (!$banner || !$btn) return;
    $banner.style.display = 'block';  /* precisa estar visível para medir */
    var rect      = $btn.getBoundingClientRect();
    var bannerH   = $banner.offsetHeight || 240;
    /* alinha o fundo do banner ao fundo do botão, não saindo da tela */
    var bottomPos = rect.bottom;
    var topPos    = Math.max(16, bottomPos - bannerH);
    $banner.style.top  = topPos + 'px';
    $banner.style.left = (rect.right + 8) + 'px';
    if (!prioLoaded) fetchPrioridade();
    else renderPrioBanner();
  }

  function hidePrioBanner() {
    prioBannerTimer = setTimeout(function() {
      var $b = document.getElementById('fp-prio-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }

  function fetchPrioridade() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    sb.from('prioridades_usuario')
      .select('id,produto_id,prazo_texto,ordem,comentario,produtos(id,nome,oportunidades(projeto,cidade,clientes(nome,uf)),etapas(nome,status,ordem))')
      .eq('usuario_id', uid).eq('concluida', false).order('ordem').limit(1).maybeSingle()
      .then(function(r) { prioLoaded=true; prioData=r.data||null; renderPrioBanner(); })
      .catch(function()  { prioLoaded=true; renderPrioBanner(); });
  }

  function renderPrioBanner() {
    var $inner = document.getElementById('fp-prio-banner-inner');
    if (!$inner) return;

    if (!prioData) {
      $inner.innerHTML =
        '<div class="fp-prio-hdr">Minha prioridade</div>' +
        '<div class="fp-notif-empty">Nenhuma prioridade definida.</div>';
      return;
    }

    var pr   = prioData;
    var prod = pr.produtos || {};
    var opp  = prod.oportunidades || {};
    var cli  = opp.clientes || {};
    var titulo   = [cli.nome, opp.projeto].filter(Boolean).join(' | ') || prod.nome || 'Projeto';
    var cidadeUf = [opp.cidade, cli.uf].filter(Boolean).join('/');
    var etapas   = (prod.etapas || []).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
    var etapa    = etapas.find(function(e){ return e.status==='em_andamento'; }) || etapas.find(function(e){ return e.status!=='concluida'; });
    var ord      = pr.ordem || 1;
    var numCls   = NUM_CLS[Math.min(ord, 6)] || 'p6';

    /* Estado */
    var estadoCard = '';
    var prazoChipHtml = '';
    if (pr.prazo_texto) {
      var hoje = new Date(); hoje.setHours(0,0,0,0);
      var pdt  = new Date(pr.prazo_texto + 'T12:00:00'); pdt.setHours(0,0,0,0);
      var dtFmt = pdt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
      if (pdt < hoje)        estadoCard = 'atrasada';
      else if (+pdt===+hoje) estadoCard = 'hoje';
      prazoChipHtml = '<div><span class="fp-prio-prazo-chip ' + estadoCard + '">📅 ' + escHtml(dtFmt) + '</span></div>';
    }

    /* cor do header acompanha o estado — monocromático */
    var hdrStyle = estadoCard === 'atrasada'
      ? 'background:#F5E0DD;color:#B84C3A;border-bottom:1px solid rgba(184,76,58,.2)'
      : estadoCard === 'hoje'
        ? 'background:#FBF3E8;color:#C4831A;border-bottom:1px solid rgba(196,131,26,.2)'
        : 'background:#EAF0FB;color:#1D4FA0;border-bottom:1px solid rgba(29,79,160,.2)';

    $inner.innerHTML =
      '<div class="fp-prio-hdr" style="' + hdrStyle + '">Minha prioridade</div>' +
      '<div class="fp-prio-card ' + estadoCard + '">' +
        '<div class="fp-prio-info">' +
          '<div class="fp-prio-nome">' + escHtml(titulo) + '</div>' +
          (cidadeUf ? '<div class="fp-prio-cidade">' + escHtml(cidadeUf) + '</div>' : '') +
          (etapa    ? '<div class="fp-prio-etapa">↳ ' + escHtml(etapa.nome||'') + '</div>' : '') +
          (prod.nome? '<div class="fp-prio-prod">' + escHtml(prod.nome) + '</div>' : '') +
          prazoChipHtml +
          (pr.comentario ? '<div style="font-size:10px;margin-top:4px;font-style:italic;opacity:.75">' + escHtml(pr.comentario) + '</div>' : '') +
        '</div>' +
        '<button class="fp-prio-check" onclick="event.stopPropagation();fpChat.checkPrio(\'' + escHtml(String(pr.id)) + '\')" title="Marcar como concluída">✓</button>' +
      '</div>' +
      '';
  }

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICAÇÕES — delegado ao AppNotif global (shared/app-notif.js)
  ═══════════════════════════════════════════════════════════════════ */

  function initNotif() {
    AppNotif.init({ userId: user.id || user.app_user_id }).then(function() {
      /* Tarefas gerenciadas localmente no painel — remove do sininho */
      AppNotif.setComputedSection('tarefas', { label: 'Tarefas', items: [] });
    }).catch(function() {
      AppNotif.setComputedSection('tarefas', { label: 'Tarefas', items: [] });
    });
  }

  function toggleNotifPanel() {
    var $panel = document.getElementById('notif-panel');
    var $btn   = document.getElementById('fp-nav-bell');
    if (!$panel || !$btn) return;
    var willOpen = $panel.style.display === 'none' || !$panel.style.display;
    _appNotifToggle();
    if (willOpen) {
      $panel.style.display = 'flex'; // override block→flex para layout do chat
      var rect   = $btn.getBoundingClientRect();
      var panelH = $panel.offsetHeight || 360;
      $panel.style.top  = Math.max(16, rect.bottom - panelH) + 'px';
      $panel.style.left = (rect.right + 8) + 'px';
      $btn.classList.add('active');
    } else {
      $btn.classList.remove('active');
    }
  }

  function encerrarNotif(id) {
    AppNotif._encerrarNotif(id);
  }

  // ── código legado removido — mantido temporariamente para referência ──
  function checkPrio(prioId) {
    sb.from('prioridades_usuario')
      .update({ concluida: true, concluida_em: new Date().toISOString() })
      .eq('id', prioId)
      .then(function(r) {
        if (r.error) return;
        prioLoaded = false;  /* força refetch na próxima vez */
        prioData   = null;
        var $b = document.getElementById('fp-prio-banner');
        if ($b) $b.style.display = 'none';
      });
  }

  function openProjectOverlay(produtoId) {
    hidePrioBanner();
    if (!produtoId) return;

    var $overlay = document.getElementById('fp-proj-overlay');
    if (!$overlay) return;
    $overlay.style.display = 'flex';

    /* re-busca os elementos a cada abertura (overlay pode ter sido re-renderizado) */
    function $el(id) { return document.getElementById(id); }
    $el('fp-proj-card-label') && ($el('fp-proj-card-label').textContent = 'Carregando…');
    $el('fp-proj-card-sub')   && ($el('fp-proj-card-sub').textContent   = '');
    $el('fp-proj-card-body')  && ($el('fp-proj-card-body').innerHTML    =
      '<div class="fp-loading" style="padding:32px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>');

    sb.from('produtos')
      .select('id,nome,status,oportunidades(projeto,cidade,area_total,tipologia,clientes(nome,uf)),etapas(nome,status,ordem)')
      .eq('id', produtoId)
      .maybeSingle()                       /* não lança erro se não encontrar */
      .then(function(r) {
        var body = $el('fp-proj-card-body');
        var lbl  = $el('fp-proj-card-label');
        var sub  = $el('fp-proj-card-sub');

        if (r.error || !r.data) {
          if (body) body.innerHTML = '<div class="fp-empty" style="padding:20px;text-align:center;font-size:12px;color:#aaa">Projeto não encontrado.</div>';
          return;
        }
        var prod = r.data;

        /* oportunidades pode ser objeto (belongsTo) ou array[0] (hasMany) */
        var opp = Array.isArray(prod.oportunidades)
          ? (prod.oportunidades[0] || {})
          : (prod.oportunidades || {});
        var cli = (Array.isArray(opp.clientes) ? opp.clientes[0] : opp.clientes) || {};

        var titulo = [cli.nome, opp.projeto].filter(Boolean).join(' · ') || prod.nome || 'Projeto';
        if (lbl) lbl.textContent = titulo;
        if (sub) sub.textContent = prod.nome || '';

        var etapas = (prod.etapas || []).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
        var etapaAtual = etapas.find(function(e){ return e.status==='em_andamento'; });
        var etapasHtml = etapas.map(function(e) {
          var isAtual = e.status === 'em_andamento';
          var style = isAtual ? 'background:var(--ca-bg);color:var(--ca);border-color:var(--ca)' : '';
          return '<span class="fp-etapa-pill" style="' + style + '">' + escHtml(e.nome||'') + '</span>';
        }).join('');

        var rows = [
          ['Cliente',      cli.nome || '—'],
          ['Projeto',      opp.projeto || prod.nome || '—'],
          ['Cidade',       [opp.cidade, cli.uf].filter(Boolean).join('/') || '—'],
          ['Tipologia',    opp.tipologia || '—'],
          ['Área',         opp.area_total ? opp.area_total + ' m²' : '—'],
          ['Etapa atual',  etapaAtual ? etapaAtual.nome : '—'],
        ];

        var rowsHtml = rows.map(function(row) {
          return '<div class="fp-proj-row">' +
            '<div class="fp-proj-row-lbl">' + escHtml(row[0]) + '</div>' +
            '<div class="fp-proj-row-val">' + escHtml(String(row[1])) + '</div>' +
            '</div>';
        }).join('');

        if (body) body.innerHTML =
          (etapasHtml ? '<div style="margin-bottom:14px">' + etapasHtml + '</div>' : '') +
          rowsHtml;
      })
      .catch(function(err) {
        var body = $el('fp-proj-card-body');
        if (body) body.innerHTML = '<div class="fp-empty" style="padding:20px;text-align:center;font-size:12px;color:#aaa">Erro ao carregar projeto.</div>';
      });
  }

  function closeProjectOverlay() {
    var $overlay = document.getElementById('fp-proj-overlay');
    if ($overlay) $overlay.style.display = 'none';
  }

  /* ═══════════════════════════════════════════════════════════════════
     EXP ROOM PRESENCE
  ═══════════════════════════════════════════════════════════════════ */
  var ROOM_BLINK_SECS = 120;   /* segundos que o ícone fica piscando após um clique */
  var _roomBlinkTimer = null;  /* timer local para parar o blink no próprio dispositivo */

  function initExpRoom() {
    checkRoomStatus();
    setInterval(checkRoomStatus, 15000);  /* atualiza a cada 15s para precisão dos 120s */
  }

  function checkRoomStatus() {
    sb.from('exp_config')
      .select('updated_at,value')
      .eq('key', 'exp_room_active')
      .maybeSingle()
      .then(function(r) {
        var btn = document.getElementById('fp-room-btn');
        if (!btn) return;
        var data = r.data;
        if (data && data.updated_at) {
          var secs = (Date.now() - new Date(data.updated_at).getTime()) / 1000;
          if (secs <= ROOM_BLINK_SECS) {
            btn.classList.add('active');
            var quem   = (data.value && data.value !== 'true') ? data.value : 'Alguém';
            var quando = secs < 60 ? 'agora mesmo' : 'há ' + Math.floor(secs / 60) + ' min';
            btn.setAttribute('data-tooltip', quem + ' · ' + quando);
            return;
          }
        }
        btn.classList.remove('active');
        btn.removeAttribute('data-tooltip');
      }).catch(function() {});
  }

  function roomClick() {
    var uid  = user.id || user.app_user_id;
    var nome = (user.nome || '').split(' ')[0] || 'Alguém';
    /* Registrar no banco */
    sb.from('exp_config').upsert({
      key: 'exp_room_active',
      value: nome,
      updated_at: new Date().toISOString(),
      updated_by: String(uid || '')
    }, { onConflict: 'key' }).then(function() {
      var btn = document.getElementById('fp-room-btn');
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('data-tooltip', nome + ' · agora mesmo');
      }
      /* parar o blink localmente após 120 s, sem esperar o próximo poll */
      if (_roomBlinkTimer) clearTimeout(_roomBlinkTimer);
      _roomBlinkTimer = setTimeout(function() {
        var b = document.getElementById('fp-room-btn');
        if (b) { b.classList.remove('active'); b.removeAttribute('data-tooltip'); }
        _roomBlinkTimer = null;
      }, ROOM_BLINK_SECS * 1000);
    }).catch(function() {});
  }

  /* toggleTheme — troca o tema e re-aplica o tom de fonte para a paleta oposta */
  window.toggleTheme = function() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('exp-theme', next);
    applyViewPrefs(); /* mantém o índice de tom mas recalcula a cor para o novo tema */
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
