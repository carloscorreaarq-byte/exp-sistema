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
  var FLAGS_KEY  = 'exp_chat_flags';
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
    loadTeamMembers();
    initNotif();

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
      /* Fechar notif panel clicando fora */
      if (notifPanelOpen) {
        var np  = document.getElementById('fp-notif-panel');
        var nb  = document.getElementById('fp-nav-bell');
        if (np && !np.contains(e.target) && nb && !nb.contains(e.target)) {
          notifPanelOpen = false;
          np.style.display = 'none';
          nb.classList.remove('active');
        }
      }
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
      if (c && c.contains(e.target)) return;
      closeMediaViewer();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        /* fechar overlay do projeto primeiro */
        var $proj = document.getElementById('fp-proj-overlay');
        if ($proj && $proj.style.display === 'flex') { e.preventDefault(); closeProjectOverlay(); return; }
        if (mediaViewerState) { e.preventDefault(); closeMediaViewer(); return; }
        if (inSearchOpen) { e.preventDefault(); closeInSearch(); return; }
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

  var colorPickerOpen = false;
  function toggleColorPicker(event) {
    event.stopPropagation();
    var $pop = document.getElementById('fp-color-pop');
    if (!$pop) return;
    colorPickerOpen = !colorPickerOpen;
    $pop.style.display = colorPickerOpen ? 'flex' : 'none';
    if (colorPickerOpen) {
      setTimeout(function() {
        function handler(e) {
          var trigger = document.getElementById('fp-color-trigger');
          if (!trigger || !trigger.contains(e.target)) {
            colorPickerOpen = false;
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

      var hasFixed = (!showOnlyFlagged && !showOnlyUnread) ? (genShow || socShow) :
        (genShow && (channelUnread['general']||0)>0) || (socShow && (channelUnread['socios']||0)>0);

      if (genShow && !(showOnlyUnread && !(channelUnread['general']||0)) && !(showOnlyFlagged)) {
        html += buildConvItemHtml('general', '# geral', '#', null, null, 'Toda a equipe',
          msgs.find(function(m){return m.channel==='general';}),
          channelUnread['general']||0, 'hash-verde');
      }
      if (socShow && !(showOnlyUnread && !(channelUnread['socios']||0)) && !(showOnlyFlagged)) {
        html += buildConvItemHtml('socios', '# sócios', '#', null, null, 'Canal privado',
          msgs.find(function(m){return m.channel==='socios';}),
          channelUnread['socios']||0, 'hash-ouro');
      }

      /* ── DMs / Grupos ── */
      var dmFiltered = dmList.filter(function(dm){
        if (!q) return true;
        return getConversationMeta(dm,uid).label.toLowerCase().indexOf(q)!==-1;
      });
      if (dmFiltered.length) {
        if (!q && !showOnlyUnread && !showOnlyFlagged)
          html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Mensagens diretas</button>';
        dmFiltered.forEach(function(dm) {
          var meta = getConversationMeta(dm, uid);
          var dmU  = channelUnread[dm.channel]||0;
          var pStatus = 'offline';
          if (dm.channel.startsWith('dm:')) {
            var parts = dm.channel.replace('dm:','').split(':');
            var oUid  = parts.find(function(p){return p!==uid;});
            var pres  = oUid ? onlinePresence[oUid] : null;
            if (pres) pStatus = pres.status;
          }
          html += buildConvItemHtml(dm.channel, meta.label, meta.iniciais, meta.avatarUrl, meta.cor,
            dm.content, dm, dmU, '', pStatus, meta.members);
        });
      }

      /* ── Projetos ── */
      var sortedP = projectItems.slice().sort(function(a,b){
        var ud = (b.unread||0)-(a.unread||0);
        if (ud) return ud;
        return new Date(b.lastCreatedAt||0)-new Date(a.lastCreatedAt||0);
      });
      var projFiltered = sortedP.filter(function(i){ return !q || i.label.toLowerCase().indexOf(q)!==-1; });
      if (projFiltered.length) {
        if (!q && !showOnlyUnread && !showOnlyFlagged) {
          html += '<button class="fp-section-hdr" onclick="fpChat.toggleProjectSection()">' +
            '<span>Projetos</span>' +
            '<span>' + (projectSectionCollapsed?'▶':'▾') + '</span>' +
            '</button>';
        }
        var toShow = (q||showOnlyUnread||showOnlyFlagged) ? projFiltered :
          (projectSectionCollapsed
            ? projFiltered.filter(function(i){return (channelUnread[i.channel]||i.unread||0)>0;}).slice(0,4)
            : projFiltered);
        toShow.forEach(function(item) {
          html += buildConvItemHtml(item.channel, item.label, item.iniciais, null, item.cor,
            item.preview, null, channelUnread[item.channel]||item.unread||0, '');
        });
      }

      if (!html) html = '<div class="fp-empty" style="padding:20px;text-align:center;font-size:11px">Nenhuma conversa encontrada.</div>';
      $list.innerHTML = html;
      setActiveConvItem(currentChannel);
    });
  }

  function buildConvItemHtml(channel, label, iniciais, avatarUrl, cor, previewText, lastMsg, unread, avVariant, presenceStatus, members) {
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
      avHtml = '<div class="fp-conv-av-wrap"><div class="fp-av-hash" style="background:var(--ca-bg);color:var(--ca)">#</div></div>';
    } else if (avVariant === 'hash-ouro') {
      avHtml = '<div class="fp-conv-av-wrap"><div class="fp-av-hash" style="background:#FBF3E8;color:#C4831A">#</div></div>';
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
        '<div class="fp-av-hash" style="background:' + pbg + ';color:' + escHtml(pc) + '">' + escHtml(iniciais||'?') + '</div>' +
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

    return '<div class="fp-conv-item' + (isUnread?' unread':'') + '" data-channel="' + escHtml(channel) + '" onclick="fpChat.openChannel(\'' + chanJson + '\',\'' + labelEsc + '\')">' +
      avHtml +
      '<div class="fp-conv-body">' +
        '<div class="fp-conv-top">' +
          '<span class="fp-conv-name">' + labelEsc + '</span>' +
          (ts ? '<span class="fp-conv-ts">' + escHtml(ts) + '</span>' : '') +
        '</div>' +
        '<div class="fp-conv-preview">' + escHtml(preview) + '</div>' +
      '</div>' +
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

  function filterConvs(value) { filterQuery = String(value||''); renderConvList(); }
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
    if (!$sub) return;
    if (currentChannel && currentChannel.startsWith('dm:')) {
      var parts = currentChannel.replace('dm:','').split(':');
      var oUid  = parts.find(function(p){return p!==user.auth_id;});
      var pres  = oUid ? onlinePresence[oUid] : null;
      var st    = pres ? pres.status : 'offline';
      var lab   = {online:'Online',foco:'Foco',ausente:'Ausente',offline:'Offline'};
      $sub.style.display = 'flex';
      $sub.innerHTML = '<span class="fp-hdr-presence '+st+'"></span>' + escHtml(lab[st]||st);
    } else if (currentChannel && currentChannel.startsWith('group:')) {
      var uids   = currentChannel.replace('group:','').split(':');
      var online = uids.filter(function(u){return onlinePresence[u];}).length;
      $sub.style.display = 'flex';
      $sub.textContent = online + ' de ' + uids.length + ' online';
    } else if (isProjectChannel(currentChannel)) {
      $sub.style.display = 'flex'; $sub.textContent = 'Chat do projeto';
    } else {
      $sub.style.display = 'none';
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
      /* alinha o topo do popover com o topo do botão, sobe se sair da tela */
      var topPos   = Math.max(16, Math.min(rect.top, window.innerHeight - panelH - 16));
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
      var roleT= roleLabel[(m.role||'').toLowerCase()]||'';
      html += '<div class="fp-member-item" onclick="fpChat.toggleMember(\''+m.auth_id+'\')">'+
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
        var isActive=(currentChannel===ch), isOwn=(msg.sender_id===uid);
        if (isActive) {
          upsertMessage(msg); renderMessages();
          if (scrolledToEnd) scrollBottom(); else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch]=(channelUnread[ch]||0)+1;
          updatePageTitle(); renderConvList();
          playNotificationSound(); _sendChatPush(msg);
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'chat_messages'}, function(payload){
        var up=payload.new; if(up.channel!==currentChannel) return;
        upsertMessage(up); renderMessages();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_thread_messages'}, function(payload){
        var raw=payload.new, msg=normalizeProjectMessage(raw), ch=msg.channel;
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
          playNotificationSound(); _sendChatPush(msg);
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
      .subscribe();
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
      var mr=await sb.from('gestao_anexos_temporarios').select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at').eq('contexto_tipo',ct).eq('contexto_id',msg.id).is('removido_em',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(1).maybeSingle();
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
    if (media&&media.objectUrl&&$img) {
      $img.src=media.objectUrl; $img.style.display='block';
      $img.style.transform='scale('+mvZoom+')'; $img.style.transformOrigin='center center';
      if ($empty) $empty.style.display='none';
    } else {
      if ($img){ $img.style.display='none'; $img.src=''; }
      if ($empty){ $empty.style.display='block'; $empty.textContent='Imagem não disponível'; }
    }
  }
  function closeMediaViewer() {
    mediaViewerState=null; mvZoom=1;
    document.getElementById('fp-media-viewer').style.display='none';
    var $img=document.getElementById('fp-mv-img'); if($img){ $img.src=''; $img.style.display='none'; }
  }
  function mvPrev(){ if(mediaViewerState&&mediaViewerState.idx>0){ mediaViewerState.idx--; mvZoom=1; renderMediaViewer(); } }
  function mvNext(){ if(mediaViewerState&&mediaViewerState.idx<mediaViewerState.keys.length-1){ mediaViewerState.idx++; mvZoom=1; renderMediaViewer(); } }
  function mvZoomIn()   { mvZoom=Math.min(mvZoom+0.25,4); renderMediaViewer(); }
  function mvZoomOut()  { mvZoom=Math.max(mvZoom-0.25,0.25); renderMediaViewer(); }
  function mvZoomReset(){ mvZoom=1; renderMediaViewer(); }
  function getMediaViewerGalleryKeys(){ return messages.map(function(m){ var md=getMessageMedia(m); return md&&md.objectUrl?mediaKeyForMessage(m):null; }).filter(Boolean); }
  function getMessageByMediaKey(k){ return messages.find(function(m){ return mediaKeyForMessage(m)===k; })||null; }

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
  function playNotificationSound(){
    if(!soundEnabled) return;
    try {
      var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
      var ctx=new Ctx();
      [{f:1046.5,t:0,d:0.18},{f:1318.5,t:0.13,d:0.22}].forEach(function(n){
        var osc=ctx.createOscillator(), gain=ctx.createGain();
        osc.type='sine'; osc.frequency.value=n.f;
        gain.gain.setValueAtTime(0,ctx.currentTime+n.t);
        gain.gain.linearRampToValueAtTime(0.07,ctx.currentTime+n.t+0.02);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+n.t+n.d);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime+n.t); osc.stop(ctx.currentTime+n.t+n.d+0.02);
      });
    } catch(e){}
  }
  function _sendChatPush(msg){
    if(userStatus==='foco') return;
    var ch=msg.channel, uid=user.auth_id;
    if (!((ch.startsWith('dm:')||ch.startsWith('group:'))&&ch.includes(uid)) && !isProjectChannel(ch)) {
      var fn=(user.nome||'').split(' ')[0].toLowerCase();
      if (!(msg.content||'').toLowerCase().includes('@'+fn)) return;
    }
    var appUserId=user.app_user_id||user.id; if(!appUserId) return;
    var isDM=ch.startsWith('dm:')||ch.startsWith('group:');
    var sender=(msg.sender_name||'').split(' ')[0];
    var title=isProjectChannel(ch)?sender+' atualizou um projeto':(isDM?sender+' enviou uma mensagem':sender+' mencionou você');
    var body=(msg.content||'').length>80?msg.content.substring(0,80)+'...':msg.content;
    sb.functions.invoke('send-push',{body:{usuario_id:appUserId,title:title,body:body,url:window.location.href,tag:'exp-chat-'+ch}}).catch(function(){});
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
    return sb.from('gestao_anexos_temporarios').select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at').eq('contexto_tipo',ct).in('contexto_id',ids).is('removido_em',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true})
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
    if(messageMediaMap[mediaKeyFor(et,row.contexto_id)]) return;
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
  function isSocioLikeRole(r){ return ['socio','socio_adm','socio_admin'].indexOf((r||'').toLowerCase())!==-1; }
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
    toggleStatusPop, setStatus, toggleSound,
    setColor, toggleColorPicker,
    toggleUnreads, toggleFlagged,
    openNewDM, closeNewDM, toggleMember, confirmNewDM,
    send, handleKey, autoResize,
    pickMedia, handleMediaInput, retryMediaIssue,
    react, flagMessage,
    openMediaViewer, closeMediaViewer, mvPrev, mvNext, mvZoomIn, mvZoomOut, mvZoomReset,
    /* busca dentro da conversa */
    toggleInSearch, closeInSearch, inSearchInput, inSearchKey, inSearchNext, inSearchPrev,
    /* tarefas */
    toggleTasksPanel, checkTask, addTask, openAssignDrop, taskDescInput, _assignTo: window._assignTo,
    /* prioridade */
    checkPrio,
    /* prioridade / projeto */
    showPrioBanner, hidePrioBanner, openProjectOverlay, closeProjectOverlay,
    /* notificações */
    toggleNotifPanel, encerrarNotif
  };

  /* ═══════════════════════════════════════════════════════════════════
     PAINEL DE TAREFAS
  ═══════════════════════════════════════════════════════════════════ */
  var tasksPanelOpen = false;
  var tasksCache     = [];

  function toggleTasksPanel() {
    tasksPanelOpen = !tasksPanelOpen;
    var $sidebar = document.getElementById('fp-sidebar');
    var $tasks   = document.getElementById('fp-tasks-panel');
    var $btn     = document.getElementById('fp-nav-tasks');
    if ($sidebar) $sidebar.style.display = tasksPanelOpen ? 'none' : 'flex';
    if ($tasks)   $tasks.style.display   = tasksPanelOpen ? 'flex' : 'none';
    if ($btn)     $btn.classList.toggle('active', tasksPanelOpen);
    if (tasksPanelOpen) loadTasks();
  }

  function loadTasks() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    var $list = document.getElementById('fp-tasks-list');
    if ($list) $list.innerHTML = '<div class="fp-loading" style="padding:24px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';

    Promise.all([
      sb.from('tarefas_livres').select('*').eq('usuario_id', uid).is('atribuido_para', null).eq('concluida', false),
      sb.from('tarefas_livres').select('*').eq('atribuido_para', uid).eq('concluida', false)
    ]).then(function(res) {
      var proprias  = res[0].data || [];
      var recebidas = res[1].data || [];
      var todas = proprias.concat(recebidas.filter(function(r) {
        return !proprias.find(function(p) { return p.id === r.id; });
      }));
      todas.sort(function(a, b) {
        if (a.data_limite && b.data_limite) return a.data_limite.localeCompare(b.data_limite);
        if (a.data_limite) return -1;
        if (b.data_limite) return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
      tasksCache = todas;
      renderTasks(todas);
    }).catch(function() {
      var $list = document.getElementById('fp-tasks-list');
      if ($list) $list.innerHTML = '<div class="fp-empty" style="padding:20px;text-align:center">Erro ao carregar tarefas.</div>';
    });
  }

  function renderTasks(tasks) {
    var $list = document.getElementById('fp-tasks-list');
    if (!$list) return;
    if (!tasks.length) {
      $list.innerHTML = '<div class="fp-empty" style="padding:24px;text-align:center">Nenhuma tarefa pendente ✓</div>';
      return;
    }
    var hoje = new Date().toISOString().split('T')[0];
    var html = '<div class="fp-task-section">Pendentes — ' + tasks.length + '</div>';
    tasks.forEach(function(t) {
      var vencida = t.data_limite && t.data_limite < hoje;
      var ehHoje  = t.data_limite === hoje;
      var prazoHtml = '';
      if (t.data_limite) {
        var cls = vencida ? 'vencida' : ehHoje ? 'hoje' : '';
        var dt  = new Date(t.data_limite + 'T12:00:00');
        var dtFmt = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
        prazoHtml = '<span class="fp-task-prazo ' + cls + '">' + dtFmt + (vencida?' ⚠':'') + '</span>';
      }
      var tipoHtml = t.tipo ? '<span style="font-size:9px;color:#bbb;text-transform:capitalize">' + escHtml(t.tipo) + '</span>' : '';
      html += '<div class="fp-task-item">' +
        '<div class="fp-task-check" onclick="fpChat.checkTask(event,\'' + escHtml(String(t.id)) + '\')" title="Concluir"></div>' +
        '<div class="fp-task-body">' +
          '<div class="fp-task-desc">' + escHtml(t.descricao || '(sem descrição)') + '</div>' +
          '<div class="fp-task-meta">' + prazoHtml + tipoHtml + '</div>' +
        '</div>' +
        '</div>';
    });
    $list.innerHTML = html;
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
    drop.style.cssText = 'position:fixed;z-index:700;background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.16);padding:4px 0;min-width:160px;font-family:Raleway,sans-serif';

    if (!outros.length) {
      drop.innerHTML = '<div style="padding:7px 12px;font-size:11px;color:#aaa">Nenhum membro</div>';
    } else {
      drop.innerHTML = outros.map(function(u, i) {
        var nome = (u.apelido || (u.nome||'').split(' ')[0]);
        var cor  = u.cor || '#888';
        var ini  = u.iniciais || (u.nome||'').substring(0,2).toUpperCase();
        return '<div data-i="'+i+'" style="padding:6px 12px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:7px" ' +
          'onmouseenter="this.style.background=\'#F7F6F3\'" onmouseleave="this.style.background=\'\'" ' +
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
     NOTIFICAÇÕES
  ═══════════════════════════════════════════════════════════════════ */
  var notifCache     = [];
  var notifPanelOpen = false;

  function initNotif() {
    loadNotif();
    /* Realtime: novas notificações chegam */
    try {
      sb.channel('fp-notif-' + user.auth_id)
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'notificacoes',
          filter: 'usuario_id=eq.' + (user.id || user.app_user_id) }, function(payload) {
          notifCache.unshift(payload.new);
          if (notifCache.length > 20) notifCache = notifCache.slice(0, 20);
          updateNotifBadge();
          if (notifPanelOpen) renderNotifPanel();
        })
        .subscribe();
    } catch(e) {}
  }

  function loadNotif() {
    var uid = user.id || user.app_user_id;
    if (!uid) return;
    sb.from('notificacoes')
      .select('*').eq('usuario_id', uid).is('encerrado_em', null)
      .order('created_at', { ascending:false }).limit(20)
      .then(function(r) {
        notifCache = r.data || [];
        updateNotifBadge();
        if (notifPanelOpen) renderNotifPanel();
      });
  }

  function updateNotifBadge() {
    var novas = notifCache.filter(function(n){ return !n.lido_em; }).length;
    var $badge = document.getElementById('fp-notif-badge');
    if (!$badge) return;
    $badge.textContent  = novas > 9 ? '9+' : String(novas);
    $badge.style.display = novas > 0 ? 'flex' : 'none';
  }

  function toggleNotifPanel() {
    notifPanelOpen = !notifPanelOpen;
    var $panel = document.getElementById('fp-notif-panel');
    var $btn   = document.getElementById('fp-nav-bell');
    if (!$panel || !$btn) return;

    if (notifPanelOpen) {
      $panel.style.display = 'flex';
      var rect   = $btn.getBoundingClientRect();
      var panelH = $panel.offsetHeight || 360;
      /* alinha o fundo do painel ao fundo do botão, sobe para cima */
      var topPos = Math.max(16, rect.bottom - panelH);
      $panel.style.top  = topPos + 'px';
      $panel.style.left = (rect.right + 8) + 'px';
      renderNotifPanel();
      /* marcar como lidas */
      markNotifsRead();
    } else {
      $panel.style.display = 'none';
    }
    if ($btn) $btn.classList.toggle('active', notifPanelOpen);
  }

  function markNotifsRead() {
    var uid = user.id || user.app_user_id;
    var unread = notifCache.filter(function(n){ return !n.lido_em; });
    if (!unread.length) return;
    var ids = unread.map(function(n){ return n.id; });
    sb.from('notificacoes').update({ lido_em: new Date().toISOString() })
      .in('id', ids)
      .then(function() {
        notifCache.forEach(function(n){ if (!n.lido_em) n.lido_em = new Date().toISOString(); });
        updateNotifBadge();
      });
  }

  function renderNotifPanel() {
    var $lista = document.getElementById('fp-notif-lista');
    if (!$lista) return;

    if (!notifCache.length) {
      $lista.innerHTML = '<div class="fp-notif-empty">Nenhuma notificação pendente ✓</div>';
      return;
    }

    var icons = { mencao:'@', tarefa:'☑', revisao:'📋', prancha:'🖼', lembrete:'📢' };
    var html = '<div class="fp-notif-sec">Notificações (' + notifCache.length + ')</div>';
    html += notifCache.map(function(n) {
      var nova  = !n.lido_em;
      var dt    = new Date(n.created_at);
      var dtStr = dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' ' +
                  dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      var icon  = icons[n.tipo] || '🔔';
      return '<div class="fp-notif-item' + (nova?' nova':'') + '">' +
        '<span class="fp-notif-icon">' + icon + '</span>' +
        '<div class="fp-notif-body">' +
          '<div class="fp-notif-titulo">' + escHtml(n.titulo||'') + '</div>' +
          (n.corpo ? '<div class="fp-notif-corpo">' + escHtml(n.corpo) + '</div>' : '') +
          '<div class="fp-notif-ts">' + escHtml(dtStr) + (n.criado_por_nome ? ' · ' + escHtml(n.criado_por_nome) : '') + '</div>' +
        '</div>' +
        '<button class="fp-notif-enc" onclick="fpChat.encerrarNotif(\'' + escHtml(String(n.id)) + '\')" title="Encerrar">✓</button>' +
        '</div>';
    }).join('');

    $lista.innerHTML = html;
  }

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

  function encerrarNotif(id) {
    sb.from('notificacoes').update({ encerrado_em: new Date().toISOString() }).eq('id', id)
      .then(function() {
        notifCache = notifCache.filter(function(n){ return String(n.id) !== String(id); });
        updateNotifBadge();
        renderNotifPanel();
      });
  }

  function openProjectOverlay(produtoId) {
    hidePrioBanner();
    var $overlay = document.getElementById('fp-proj-overlay');
    var $body    = document.getElementById('fp-proj-card-body');
    var $lbl     = document.getElementById('fp-proj-card-label');
    var $sub     = document.getElementById('fp-proj-card-sub');
    if (!$overlay) return;
    $overlay.style.display = 'flex';
    if ($lbl)  $lbl.textContent  = 'Carregando…';
    if ($sub)  $sub.textContent  = '';
    if ($body) $body.innerHTML   = '<div class="fp-loading" style="padding:32px"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';

    sb.from('produtos')
      .select('id,nome,status,oportunidades(projeto,cidade,area_total,tipologia,clientes(nome,uf)),etapas(nome,status,ordem)')
      .eq('id', produtoId)
      .single()
      .then(function(r) {
        if (r.error || !r.data) {
          if ($body) $body.innerHTML = '<div class="fp-empty">Projeto não encontrado.</div>';
          return;
        }
        var prod = r.data;
        var opp  = prod.oportunidades || {};
        var cli  = opp.clientes || {};
        var titulo = [cli.nome, opp.projeto].filter(Boolean).join(' · ') || prod.nome;
        if ($lbl) $lbl.textContent = titulo;
        if ($sub) $sub.textContent = prod.nome || '';

        var etapas = (prod.etapas || []).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
        var etapaAtual = etapas.find(function(e){return e.status==='em_andamento';});
        var etapasHtml = etapas.map(function(e) {
          var isAtual = e.status === 'em_andamento';
          var style = isAtual ? 'background:var(--ca-bg);color:var(--ca);border-color:var(--ca)' : '';
          return '<span class="fp-etapa-pill" style="' + style + '">' + escHtml(e.nome||'') + '</span>';
        }).join('');

        var rows = [
          ['Cliente',  cli.nome || '—'],
          ['Projeto',  opp.projeto || prod.nome || '—'],
          ['Cidade',   [opp.cidade, cli.uf].filter(Boolean).join('/') || '—'],
          ['Tipologia',opp.tipologia || '—'],
          ['Área',     opp.area_total ? opp.area_total + ' m²' : '—'],
          ['Etapa atual', etapaAtual ? etapaAtual.nome : '—'],
        ];

        var rowsHtml = rows.map(function(r) {
          return '<div class="fp-proj-row">' +
            '<div class="fp-proj-row-lbl">' + escHtml(r[0]) + '</div>' +
            '<div class="fp-proj-row-val">' + escHtml(String(r[1])) + '</div>' +
            '</div>';
        }).join('');

        if ($body) $body.innerHTML =
          '<div style="margin-bottom:14px">' + etapasHtml + '</div>' +
          rowsHtml;
      }).catch(function() {
        if ($body) $body.innerHTML = '<div class="fp-empty">Erro ao carregar projeto.</div>';
      });
  }

  function closeProjectOverlay() {
    var $overlay = document.getElementById('fp-proj-overlay');
    if ($overlay) $overlay.style.display = 'none';
  }

  /* toggleTheme — mesmo padrão dos outros módulos */
  window.toggleTheme = function() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('exp-theme', next);
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
