/* ═══════════════════════════════════════════════════════════════════
   EXP · CHAT FULLPAGE  —  chat-fullpage.js
   Layout de página cheia: sidebar de conversas + área de chat
   Reusa toda a lógica de canal/mensagens do widget (chat.js)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────────── */
  var SB_URL     = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var STATUS_KEY = 'exp_chat_status';
  var SOUND_KEY  = 'exp_chat_sound';
  var STATUS_COLORS = { online: '#1D6A4A', foco: '#1D4FA0', ausente: '#C4831A' };
  var BRAND_AVATAR_COLORS = ['#1D6A4A', '#1D4FA0', '#C4831A', '#B84C3A', '#6D7D8A', '#4A72B5', '#7A9E7E'];
  var TEMP_MEDIA_BUCKET = 'gestao-anexos-temp';
  var CHAT_IMAGE_SENTINEL = '[print]';
  var CHAT_MEDIA_LIMITS = { largura_max_px: 1280, tamanho_max_kb: 500, qualidade_upload: 0.76, qualidade_fallback: 0.70 };

  /* ── Estado ──────────────────────────────────────────────────────── */
  var sb, user;
  var presenceCh = null, msgCh = null;
  var messages        = [];
  var isLoading       = false;
  var scrolledToEnd   = true;
  var currentChannel  = null;
  var currentLabel    = '';
  var loadRequestSeq  = 0;
  var teamMembers     = [];
  var allMembers      = [];
  var projectThreads  = [];
  var projectThreadMeta = {};
  var projectSectionCollapsed = true;
  var pendingMessageSeq = 0;
  var reactionLocks   = {};
  var chatMediaConfig = null;
  var mediaViewerState = null;
  var mediaObjectUrl  = null;
  var messageMediaMap = {};
  var failedStoragePaths = {};
  var mediaRequestSeq = 0;
  var mediaUploadBusy = false;
  var composerStatusTimer = null;
  var selectedMembers = [];
  var channelUnread   = {};
  var onlinePresence  = {};
  var userStatus      = localStorage.getItem(STATUS_KEY) || 'online';
  var soundEnabled    = localStorage.getItem(SOUND_KEY) !== 'false';
  var filterQuery     = '';
  var statusPopOpen   = false;
  var mvZoom          = 1;

  /* ── DOM refs ────────────────────────────────────────────────────── */
  var $msgs, $input;

  /* ═══════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════ */
  function init() {
    var raw = sessionStorage.getItem('exp_usuario');
    if (!raw) {
      window.addEventListener('exp:session-ready', onSessionReady, { once: true });
      return;
    }
    try { user = JSON.parse(raw); } catch (e) { return; }
    if (!user || !user.nome) return;
    if (!user.app_user_id && typeof user.id !== 'undefined') user.app_user_id = user.id;
    if (!user.apelido) user.apelido = (user.nome || '').split(' ')[0] || '';

    sb = (typeof window.sb !== 'undefined' && window.sb)
      ? window.sb
      : supabase.createClient(SB_URL, SB_KEY);

    sb.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) return;
      user.auth_id = r.data.session.user.id;
      mount();
    });
  }

  function onSessionReady(ev) {
    if (ev && ev.detail) {
      user = ev.detail;
      if (!user.apelido) user.apelido = (user.nome || '').split(' ')[0] || '';
    }
    init();
  }

  function mount() {
    var $loading = document.getElementById('fp-loading');
    var $topbar  = document.getElementById('fp-topbar');
    var $body    = document.getElementById('fp-body');
    if ($loading) $loading.style.display = 'none';
    if ($topbar)  $topbar.style.display  = 'flex';
    if ($body)    $body.style.display    = 'flex';

    $msgs  = document.getElementById('fp-messages');
    $input = document.getElementById('fp-input');

    /* Topbar: nome do usuário no popover */
    var $soptName = document.getElementById('fp-sopt-name');
    if ($soptName) $soptName.textContent = firstName(user.nome);

    /* Topbar: página de referência */
    var ref = document.referrer;
    if (ref) {
      try {
        var refPage = new URL(ref).pathname.split('/').filter(Boolean).pop() || 'index.html';
        var el = document.getElementById('fp-topbar-page');
        if (el) el.textContent = refPage;
      } catch (e) {}
    }

    applyStatus(userStatus, false);
    setupPresence();
    fetchAllUnread();
    subscribeIncoming();
    loadTeamMembers();

    /* Scroll tracking */
    if ($msgs) {
      $msgs.addEventListener('scroll', function () {
        scrolledToEnd = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 48;
      });
    }

    /* Fechar status popover ao clicar fora */
    document.addEventListener('click', function (e) {
      if (!statusPopOpen) return;
      var pop = document.getElementById('fp-status-pop');
      var btn = document.getElementById('fp-status-btn');
      if (!pop) return;
      if (pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      closeStatusPop();
    });

    /* Colar imagem no input */
    document.addEventListener('paste', function (event) {
      if (!currentChannel || mediaUploadBusy) return;
      var imageItems = Array.from((event.clipboardData && event.clipboardData.items) || [])
        .filter(function (item) { return /^image\/(png|jpeg|webp)$/i.test(item.type || ''); });
      if (!imageItems.length) return;
      event.preventDefault();
      imageItems.reduce(function (chain, item) {
        return chain.then(function () {
          var file = item.getAsFile();
          if (!file) return null;
          return sendMediaFile(file);
        });
      }, Promise.resolve());
    });

    /* Fechar media viewer ao clicar no overlay */
    document.addEventListener('click', function (e) {
      var viewer = document.getElementById('fp-media-viewer');
      var card = viewer ? viewer.querySelector('.fp-mv-card') : null;
      if (!viewer || viewer.style.display !== 'flex') return;
      if (card && card.contains(e.target)) return;
      closeMediaViewer();
    });

    /* Atalhos de teclado no viewer */
    document.addEventListener('keydown', function (event) {
      if (!mediaViewerState) return;
      if (event.key === 'Escape')      { event.preventDefault(); closeMediaViewer(); }
      else if (event.key === 'ArrowLeft')  { event.preventDefault(); mvPrev(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); mvNext(); }
    });

    window.addEventListener('beforeunload', function () {
      if (presenceCh) presenceCh.untrack();
    });

    /* Renderizar lista de conversas inicial */
    renderConvList();
  }

  /* ═══════════════════════════════════════════════════════════════════
     STATUS
  ═══════════════════════════════════════════════════════════════════ */
  var STATUS_LABELS = { online: 'Online', foco: 'Foco', ausente: 'Ausente' };

  function applyStatus(status, broadcast) {
    if (typeof broadcast === 'undefined') broadcast = true;
    userStatus = status;
    localStorage.setItem(STATUS_KEY, status);

    var dot   = document.getElementById('fp-status-dot');
    var label = document.getElementById('fp-status-label');
    if (dot)   { dot.className = 'fp-status-dot ' + status; }
    if (label) { label.textContent = STATUS_LABELS[status] || status; }

    /* Marcar opção ativa no popover */
    var opts = document.querySelectorAll('#fp-status-pop .fp-sopt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === status);
    }

    if (broadcast && presenceCh) presenceCh.track(presencePayload(status));
  }

  function toggleStatusPop() { statusPopOpen ? closeStatusPop() : openStatusPop(); }

  function openStatusPop() {
    var pop = document.getElementById('fp-status-pop');
    if (!pop) return;
    statusPopOpen = true;
    pop.style.display = 'flex';
    var opts = pop.querySelectorAll('.fp-sopt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === userStatus);
    }
  }

  function closeStatusPop() {
    var pop = document.getElementById('fp-status-pop');
    if (!pop) return;
    statusPopOpen = false;
    pop.style.display = 'none';
  }

  function setStatus(s) {
    applyStatus(s, true);
    closeStatusPop();
  }

  /* ═══════════════════════════════════════════════════════════════════
     NAVEGAÇÃO
  ═══════════════════════════════════════════════════════════════════ */
  function goBack() {
    if (document.referrer) window.history.back();
    else window.location.href = 'app.html';
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    var btn = document.getElementById('fp-sound-btn');
    if (btn) btn.innerHTML = soundEnabled ? icoSound() : icoSoundOff();
  }

  /* ═══════════════════════════════════════════════════════════════════
     LISTA DE CONVERSAS (SIDEBAR)
  ═══════════════════════════════════════════════════════════════════ */
  function renderConvList() {
    var $list = document.getElementById('fp-conv-list');
    if (!$list) return;

    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    var q     = (filterQuery || '').toLowerCase().trim();

    Promise.all([
      sb.from('chat_messages')
        .select('channel,sender_name,sender_iniciais,sender_cor,content,created_at,sender_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      fetchProjectHomeItems(uid)
    ]).then(function (res) {
      var msgs         = (res[0].data || []);
      var projectItems = res[1] || [];

      /* DMs e grupos dinâmicos: um item por canal, mensagem mais recente */
      var seen   = {};
      var dmList = [];
      msgs.forEach(function (m) {
        if (!isDynamicChannel(m.channel) || !channelHasUser(m.channel, uid)) return;
        if (!seen[m.channel]) { seen[m.channel] = true; dmList.push(m); }
      });

      var html = '';

      /* ── Canais fixos ── */
      var showFixed = !q || 'geral'.indexOf(q) !== -1 || 'socios'.indexOf(q) !== -1
        || 'sócios'.indexOf(q) !== -1 || 'geral'.indexOf(q) !== -1;
      if (!q) {
        html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Canais</button>';
      }

      var genU = channelUnread['general'] || 0;
      if (!q || 'geral'.indexOf(q) !== -1) {
        html += convItemHtml('general', '# geral', '#', null, '#1D6A4A',
          'Toda a equipe', genU,
          'background:var(--verde-bg,#EAF5EE);color:var(--verde,#1D6A4A);border-radius:9px');
      }

      if (isSocioLikeRole(user.role)) {
        var socU = channelUnread['socios'] || 0;
        var qOk  = !q || 'sócios'.indexOf(q) !== -1 || 'socios'.indexOf(q) !== -1;
        if (qOk) {
          html += convItemHtml('socios', '# sócios', '#', null, '#C4831A',
            'Canal privado', socU,
            'background:var(--am-bg,#FBF3E8);color:var(--am,#C4831A);border-radius:9px');
        }
      }

      /* ── DMs ── */
      var dmFiltered = dmList.filter(function (dm) {
        if (!q) return true;
        var meta = getConversationMeta(dm, uid);
        return meta.label.toLowerCase().indexOf(q) !== -1;
      });

      if (dmFiltered.length) {
        if (!q) html += '<button class="fp-section-hdr" style="cursor:default;pointer-events:none">Mensagens diretas</button>';
        dmFiltered.forEach(function (dm) {
          var meta    = getConversationMeta(dm, uid);
          var preview = compactPreviewText(dm.content, 38, 'Nova mensagem');
          var dmU     = channelUnread[dm.channel] || 0;

          /* presença do outro usuário */
          var pStatus = 'offline';
          if (dm.channel.startsWith('dm:')) {
            var parts    = dm.channel.replace('dm:', '').split(':');
            var otherUid = parts.find(function (p) { return p !== uid; });
            var pres     = otherUid ? onlinePresence[otherUid] : null;
            if (pres) pStatus = pres.status;
          }

          html += convItemHtml(dm.channel, meta.label, meta.iniciais, meta.avatarUrl, meta.cor,
            preview, dmU, '', pStatus);
        });
      }

      /* ── Projetos ── */
      var sortedProjects = (projectItems || []).slice().sort(function (a, b) {
        var ud = (b.unread || 0) - (a.unread || 0);
        if (ud) return ud;
        return new Date(b.lastCreatedAt || 0) - new Date(a.lastCreatedAt || 0);
      });
      var projFiltered = sortedProjects.filter(function (item) {
        if (!q) return true;
        return item.label.toLowerCase().indexOf(q) !== -1;
      });

      if (projFiltered.length) {
        if (!q) {
          html += '<button class="fp-section-hdr" onclick="fpChat.toggleProjectSection()">' +
            '<span>Projetos</span>' +
            '<span class="fp-section-chev">' + (projectSectionCollapsed ? '&#9656;' : '&#9662;') + '</span>' +
            '</button>';
        }
        var toShow = q ? projFiltered : (projectSectionCollapsed
          ? projFiltered.filter(function (i) { return (channelUnread[i.channel] || i.unread || 0) > 0; }).slice(0, 4)
          : projFiltered);
        toShow.forEach(function (item) {
          var unread  = channelUnread[item.channel] || item.unread || 0;
          var preview = compactPreviewText(item.preview || 'Chat do projeto', 38, 'Chat do projeto');
          html += convItemHtml(item.channel, item.label, item.iniciais, null, item.cor, preview, unread, '');
        });
      }

      if (!html) html = '<div class="fp-empty" style="text-align:center;padding:24px;font-size:11px;color:var(--cinza,#D0CFC9)">Nenhuma conversa encontrada.</div>';

      $list.innerHTML = html;

      /* Marcar item ativo */
      if (currentChannel) setActiveConvItem(currentChannel);
    });
  }

  function convItemHtml(channel, label, iniciais, avatarUrl, cor, preview, unread, avStyle, presenceStatus) {
    var chanJson = channel.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var labelEsc = escHtml(label);
    var avHtml   = avStyle
      ? '<div class="fp-av-hash" style="' + avStyle + '">' + escHtml(iniciais) + '</div>'
      : avCircleHtml(iniciais, avatarUrl, cor);

    var presenceDot = presenceStatus
      ? '<span class="fp-presence-dot ' + presenceStatus + '"></span>'
      : '';

    return '<div class="fp-conv-item" data-channel="' + escHtml(channel) + '" onclick="fpChat.openChannel(\'' + chanJson + '\',\'' + labelEsc + '\')">' +
      '<div style="position:relative;flex-shrink:0">' + avHtml + presenceDot + '</div>' +
      '<div class="fp-conv-info">' +
        '<div class="fp-conv-name">' + labelEsc + '</div>' +
        '<div class="fp-conv-preview">' + escHtml(preview) + '</div>' +
      '</div>' +
      (unread > 0 ? '<div class="fp-conv-badge">' + unread + '</div>' : '') +
      '</div>';
  }

  function avCircleHtml(iniciais, avatarUrl, cor) {
    if (avatarUrl) {
      return '<img class="fp-av-img" src="' + escHtml(avatarUrl) + '" alt="">';
    }
    return '<div class="fp-av-circle" style="background:' + escHtml(cor || '#1D6A4A') + '">' + escHtml(iniciais || '?') + '</div>';
  }

  function setActiveConvItem(channel) {
    var items = document.querySelectorAll('#fp-conv-list .fp-conv-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-channel') === channel);
    }
  }

  function filterConvs(value) {
    filterQuery = String(value || '');
    renderConvList();
  }

  function toggleProjectSection() {
    projectSectionCollapsed = !projectSectionCollapsed;
    renderConvList();
  }

  /* ═══════════════════════════════════════════════════════════════════
     ABRIR CANAL
  ═══════════════════════════════════════════════════════════════════ */
  function openChannel(channel, displayName) {
    closeMediaViewer();
    clearMessageMediaCache();
    setComposerStatus('', '', false);

    currentChannel = channel;
    currentLabel   = displayName || getChannelLabel(channel);

    /* Atualizar header */
    var $hdrTitle = document.getElementById('fp-chat-hdr-title');
    var $hdrSub   = document.getElementById('fp-chat-hdr-sub');
    var $hdrAv    = document.getElementById('fp-chat-hdr-av');
    if ($hdrTitle) $hdrTitle.textContent = currentLabel;
    if ($hdrAv) $hdrAv.innerHTML = buildChannelHeaderAv(channel);

    /* Mostrar área de chat */
    var $placeholder = document.getElementById('fp-placeholder');
    var $chatArea    = document.getElementById('fp-chat-area');
    if ($placeholder) $placeholder.style.display = 'none';
    if ($chatArea)    { $chatArea.style.display  = 'flex'; }

    updateChannelSubtitle();
    messages = [];
    loadMessages();
    markRead();

    /* Atualizar sidebar */
    setActiveConvItem(channel);
    renderConvList();

    setTimeout(function () { if ($input) $input.focus(); }, 80);
  }

  function buildChannelHeaderAv(channel) {
    if (channel === 'general') {
      return '<div class="fp-av-hash" style="background:var(--verde-bg,#EAF5EE);color:var(--verde,#1D6A4A);border-radius:9px;width:34px;height:34px;font-size:16px">#</div>';
    }
    if (channel === 'socios') {
      return '<div class="fp-av-hash" style="background:var(--am-bg,#FBF3E8);color:var(--am,#C4831A);border-radius:9px;width:34px;height:34px;font-size:16px">#</div>';
    }
    if (channel.startsWith('dm:')) {
      var parts    = channel.replace('dm:', '').split(':');
      var otherUid = parts.find(function (p) { return p !== user.auth_id; });
      var member   = otherUid ? allMembers.find(function (m) { return m.auth_id === otherUid; }) : null;
      if (member) {
        var cor = member.cor || '#1D6A4A';
        var ini = member.iniciais || (member.nome || '').substring(0, 2).toUpperCase();
        if (member.avatar_url) {
          return '<img class="fp-av-img" src="' + escHtml(member.avatar_url) + '" alt="" style="width:34px;height:34px">';
        }
        return '<div class="fp-av-circle" style="background:' + escHtml(cor) + ';width:34px;height:34px;font-size:12px">' + escHtml(ini) + '</div>';
      }
    }
    if (isProjectChannel(channel) && projectThreadMeta[channel]) {
      var meta = projectThreadMeta[channel];
      return '<div class="fp-av-circle" style="background:' + escHtml(meta.cor) + ';width:34px;height:34px;font-size:11px;border-radius:9px">' + escHtml(meta.iniciais) + '</div>';
    }
    var ini2 = initialsFromLabel(currentLabel, 'GP');
    var cor2  = brandColorForKey(channel);
    return '<div class="fp-av-circle" style="background:' + escHtml(cor2) + ';width:34px;height:34px;font-size:11px;border-radius:9px">' + escHtml(ini2) + '</div>';
  }

  function updateChannelSubtitle() {
    var $sub = document.getElementById('fp-chat-hdr-sub');
    if (!$sub) return;

    if (currentChannel && currentChannel.startsWith('dm:')) {
      var parts    = currentChannel.replace('dm:', '').split(':');
      var otherUid = parts.find(function (p) { return p !== user.auth_id; });
      var pres     = otherUid ? onlinePresence[otherUid] : null;
      var sLabels  = { online: 'Online', foco: 'Foco', ausente: 'Ausente' };
      var status   = pres ? pres.status : 'offline';
      var label    = pres ? (sLabels[status] || status) : 'Offline';
      $sub.style.display = 'flex';
      $sub.innerHTML = '<span class="fp-presence-dot ' + status + '" style="width:7px;height:7px;flex-shrink:0;display:inline-block"></span>' + escHtml(label);

    } else if (currentChannel && currentChannel.startsWith('group:')) {
      var uids   = currentChannel.replace('group:', '').split(':');
      var online = uids.filter(function (uid) { return onlinePresence[uid]; }).length;
      $sub.style.display = 'flex';
      $sub.textContent = online + ' de ' + uids.length + ' online';

    } else if (isProjectChannel(currentChannel)) {
      $sub.style.display = 'flex';
      $sub.textContent = 'Chat do projeto';

    } else {
      $sub.style.display = 'none';
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     NOVO DM / GRUPO
  ═══════════════════════════════════════════════════════════════════ */
  function openNewDM() {
    selectedMembers = [];
    var panel = document.getElementById('fp-members-panel');
    if (panel) panel.style.display = 'flex';
    renderMembersModal();
  }

  function closeNewDM() {
    selectedMembers = [];
    var panel = document.getElementById('fp-members-panel');
    if (panel) panel.style.display = 'none';
  }

  function renderMembersModal() {
    var $list = document.getElementById('fp-members-list');
    if (!$list) return;
    if (!teamMembers.length) {
      $list.innerHTML = '<div class="fp-empty" style="padding:20px;text-align:center;font-size:11px">Carregando equipe...</div>';
      return;
    }

    var roleLabel = {
      socio: 'Sócio', socio_adm: 'Sócio administrador',
      socio_admin: 'Sócio administrador',
      coordenador: 'Coordenador', colaborador: 'Colaborador'
    };

    var html = '';
    teamMembers.forEach(function (m) {
      var cor    = m.cor || '#1D6A4A';
      var ini    = m.iniciais || (m.nome || '').substring(0, 2).toUpperCase();
      var sel    = selectedMembers.findIndex(function (s) { return s.auth_id === m.auth_id; }) !== -1;
      var pres   = onlinePresence[m.auth_id];
      var pStat  = pres ? pres.status : 'offline';
      var pLab   = { online: 'Online', foco: 'Foco', ausente: 'Ausente', offline: 'Offline' };
      var roleT  = roleLabel[(m.role || '').toLowerCase()] || '';

      html += '<div class="fp-member-item" onclick="fpChat.toggleMember(\'' + m.auth_id + '\')">' +
        '<div class="fp-member-check' + (sel ? ' sel' : '') + '"></div>' +
        '<div style="position:relative;flex-shrink:0">' +
          (m.avatar_url
            ? '<img class="fp-av-img" src="' + escHtml(m.avatar_url) + '" alt="" style="width:32px;height:32px">'
            : '<div class="fp-av-circle" style="background:' + escHtml(cor) + ';width:32px;height:32px;font-size:11px">' + escHtml(ini) + '</div>') +
          '<span class="fp-presence-dot ' + pStat + '" style="position:absolute;bottom:-1px;right:-1px;border:1.5px solid #fff"></span>' +
        '</div>' +
        '<div class="fp-member-info">' +
          '<div class="fp-member-name">' + escHtml(m.nome) + '</div>' +
          '<div class="fp-member-role">' + escHtml(pLab[pStat]) + ' · ' + escHtml(roleT) + '</div>' +
        '</div>' +
        '</div>';
    });
    $list.innerHTML = html;

    var $info = document.getElementById('fp-members-info');
    var n = selectedMembers.length;
    if ($info) {
      if (n === 0) $info.textContent = 'Selecione um ou mais membros';
      else if (n === 1) $info.textContent = '1 pessoa selecionada';
      else $info.textContent = n + ' pessoas selecionadas';
    }
  }

  function toggleMember(authId) {
    var idx = selectedMembers.findIndex(function (m) { return m.auth_id === authId; });
    if (idx === -1) {
      var member = teamMembers.find(function (m) { return m.auth_id === authId; });
      if (member) selectedMembers.push(member);
    } else {
      selectedMembers.splice(idx, 1);
    }
    renderMembersModal();
  }

  function confirmNewDM() {
    if (!selectedMembers.length) return;
    var ch, label;
    if (selectedMembers.length === 1) {
      var m = selectedMembers[0];
      ch    = dmChannel(user.auth_id, m.auth_id);
      label = firstName(m.nome);
    } else {
      var allUids = [user.auth_id].concat(selectedMembers.map(function (m) { return m.auth_id; })).sort();
      ch    = 'group:' + allUids.join(':');
      label = selectedMembers.map(function (m) { return firstName(m.nome); }).join(', ');
    }
    closeNewDM();
    openChannel(ch, label);
  }

  function dmChannel(uid1, uid2) { return 'dm:' + [uid1, uid2].sort().join(':'); }

  /* ═══════════════════════════════════════════════════════════════════
     PRESENCE
  ═══════════════════════════════════════════════════════════════════ */
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
        updateChannelSubtitle();
        renderConvList();
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

  /* ═══════════════════════════════════════════════════════════════════
     REALTIME — receber mensagens
  ═══════════════════════════════════════════════════════════════════ */
  function subscribeIncoming() {
    if (msgCh) { sb.removeChannel(msgCh); msgCh = null; }

    msgCh = sb.channel('exp:chatfp:incoming')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, function (payload) {
        var msg = payload.new;
        var ch  = msg.channel;
        var uid = user.auth_id;

        var isSocios = ch === 'socios' && isSocioLikeRole(user.role);
        if (ch !== 'general' && !isSocios && ch.indexOf(uid) === -1) return;

        var isActive = (currentChannel === ch);
        var isOwn    = msg.sender_id === uid;

        if (isActive) {
          upsertMessage(msg);
          renderMessages();
          if (scrolledToEnd) scrollBottom();
          else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch] = (channelUnread[ch] || 0) + 1;
          updatePageTitle();
          renderConvList();
          playNotificationSound();
          _sendChatPush(msg);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, function (payload) {
        var up = payload.new;
        if (up.channel !== currentChannel) return;
        upsertMessage(up);
        renderMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_thread_messages' }, function (payload) {
        var raw = payload.new;
        var msg = normalizeProjectMessage(raw);
        var ch  = msg.channel;
        if (!projectThreadMeta[ch]) {
          projectThreadMeta[ch] = buildProjectThreadMeta(raw.thread_id, null, raw.content, raw.created_at, raw.sender_auth_id);
        }
        updateProjectThreadSnapshot(raw.thread_id, raw.content, raw.created_at, raw.sender_auth_id);

        var isActive = (currentChannel === ch);
        var isOwn    = raw.sender_auth_id === user.auth_id;

        if (isActive) {
          upsertMessage(msg);
          renderMessages();
          if (scrolledToEnd) scrollBottom();
          else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch] = (channelUnread[ch] || 0) + 1;
          updatePageTitle();
          renderConvList();
          playNotificationSound();
          _sendChatPush(msg);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_thread_messages' }, function (payload) {
        var up = normalizeProjectMessage(payload.new);
        updateProjectThreadSnapshot(payload.new.thread_id, payload.new.content, payload.new.created_at, payload.new.sender_auth_id);
        if (up.channel !== currentChannel) return;
        upsertMessage(up);
        renderMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gestao_anexos_temporarios' }, function (payload) {
        handleChatTempMediaRealtime(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gestao_anexos_temporarios' }, function (payload) {
        handleChatTempMediaRealtime(payload.new);
      })
      .subscribe();
  }

  /* ═══════════════════════════════════════════════════════════════════
     CARREGAR MENSAGENS
  ═══════════════════════════════════════════════════════════════════ */
  function loadMessages() {
    if (isLoading) return;
    var channel = currentChannel;
    var requestSeq = ++loadRequestSeq;
    isLoading = true;
    showLoading();

    if (isProjectChannel(channel)) {
      var threadId = projectThreadIdFromChannel(channel);
      sb.from('chat_thread_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(200)
        .then(function (r) {
          if (requestSeq !== loadRequestSeq || channel !== currentChannel) return;
          isLoading = false;
          if (r.error) { showError(); return; }
          messages = (r.data || []).slice().reverse().map(normalizeProjectMessage);
          clearMessageMediaCache();
          renderMessages();
          loadCurrentMessageMedia();
          scrollBottom();
        });
      return;
    }

    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    sb.from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(function (r) {
        if (requestSeq !== loadRequestSeq || channel !== currentChannel) return;
        isLoading = false;
        if (r.error) { showError(); return; }
        messages = r.data || [];
        clearMessageMediaCache();
        renderMessages();
        loadCurrentMessageMedia();
        scrollBottom();
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     NÃO LIDAS
  ═══════════════════════════════════════════════════════════════════ */
  function fetchAllUnread() {
    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    fetchProjectUnreadMap(uid).then(function (projectUnread) {
      Object.keys(projectUnread || {}).forEach(function (ch) {
        channelUnread[ch] = projectUnread[ch];
      });
      updatePageTitle();
      renderConvList();
    });

    sb.from('chat_read_status').select('channel,last_read_at').eq('user_id', uid)
      .then(function (r) {
        if (r.error) return;
        var readMap = {};
        (r.data || []).forEach(function (row) { readMap[row.channel] = row.last_read_at; });

        var fixedChannels = ['general'];
        if (isSocioLikeRole(user.role)) fixedChannels.push('socios');

        fixedChannels.forEach(function (ch) {
          var lastRead = readMap[ch] || since;
          sb.from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel', ch)
            .gt('created_at', lastRead)
            .neq('sender_id', uid)
            .then(function (r2) {
              if (r2.count) channelUnread[ch] = r2.count;
              updatePageTitle();
            });
        });

        sb.from('chat_messages')
          .select('channel,sender_id,created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .then(function (r2) {
            if (r2.error) return;
            var preserved = {};
            Object.keys(channelUnread).forEach(function (k) {
              if (isProjectChannel(k)) preserved[k] = channelUnread[k];
            });
            var next = {};
            (r2.data || []).forEach(function (msg) {
              if (msg.sender_id === uid) return;
              var lastRead = readMap[msg.channel] || since;
              if (msg.created_at > lastRead) next[msg.channel] = (next[msg.channel] || 0) + 1;
            });
            channelUnread = next;
            Object.keys(preserved).forEach(function (k) { channelUnread[k] = preserved[k]; });
            updatePageTitle();
            renderConvList();
          });
      });
  }

  function markRead() {
    var channel = currentChannel;
    if (isProjectChannel(channel)) {
      sb.from('chat_thread_reads').upsert({
        user_auth_id: user.auth_id,
        thread_id: projectThreadIdFromChannel(channel),
        last_read_at: new Date().toISOString()
      }).then(function (r) {
        if (r.error) return;
        channelUnread[channel] = 0;
        if (projectThreadMeta[channel]) projectThreadMeta[channel].unread = 0;
        updatePageTitle();
        renderConvList();
      });
      return;
    }
    sb.from('chat_read_status').upsert({
      user_id: user.auth_id, channel: channel, last_read_at: new Date().toISOString()
    }).then(function (r) {
      if (r.error) return;
      channelUnread[channel] = 0;
      updatePageTitle();
      renderConvList();
    });
  }

  function updatePageTitle() {
    var total = Object.keys(channelUnread).reduce(function (acc, k) { return acc + (channelUnread[k] || 0); }, 0);
    document.title = total > 0 ? '(' + total + ') EXP · Chat' : 'EXP · Chat';
  }

  /* ═══════════════════════════════════════════════════════════════════
     ENVIAR MENSAGEM
  ═══════════════════════════════════════════════════════════════════ */
  function send() {
    if (!$input || !currentChannel) return;
    var content = $input.value.trim();
    if (!content) return;
    $input.value = '';
    $input.style.height = 'auto';
    var pendingMsg = buildPendingMessage(content);
    upsertMessage(pendingMsg);
    renderMessages();
    scrollBottom();

    if (isProjectChannel(currentChannel)) {
      sb.from('chat_thread_messages').insert({
        thread_id:      currentChannel.replace('project:', ''),
        sender_auth_id: user.auth_id,
        content:        content
      }).select('*').single().then(function (r) {
        if (r.error) {
          removeMessageById(pendingMsg.id);
          renderMessages();
          $input.value = content;
          return;
        }
        upsertMessage(normalizeProjectMessage(r.data));
        renderMessages();
      });
      return;
    }

    sb.from('chat_messages').insert({
      channel:         currentChannel,
      sender_id:       user.auth_id,
      sender_name:     user.nome,
      sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      sender_cor:      user.cor || '#1D6A4A',
      content:         content
    }).select('*').single().then(function (r) {
      if (r.error) {
        removeMessageById(pendingMsg.id);
        renderMessages();
        $input.value = content;
        return;
      }
      upsertMessage(r.data);
      renderMessages();
    });
  }

  function handleKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  /* ═══════════════════════════════════════════════════════════════════
     MÍDIA
  ═══════════════════════════════════════════════════════════════════ */
  function pickMedia() {
    if (mediaUploadBusy) return;
    var input = document.getElementById('fp-media-input');
    if (!input) return;
    input.value = '';
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  async function handleMediaInput(input) {
    var file = input && input.files ? input.files[0] : null;
    if (!file) return;
    try { await sendMediaFile(file); }
    finally { input.value = ''; }
  }

  function mediaRpcContent(rawContent) {
    return isImageOnlySentinel(rawContent) ? '' : String(rawContent || '');
  }

  async function sendMediaFile(file) {
    if (!currentChannel || mediaUploadBusy) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
      setComposerStatus('Use apenas prints em PNG, JPG ou WEBP.', 'warn', true);
      return;
    }

    mediaUploadBusy = true;
    var content    = ($input ? ($input.value || '').trim() : '');
    if ($input) { $input.value = ''; $input.style.height = 'auto'; }

    var optimized = null, previewUrl = null, pendingMsg = null;
    var contextType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    var messageId   = newUuid();

    try {
      setComposerStatus('Otimizando print...', '', true);
      var cfg = await loadChatMediaConfig();
      optimized   = await optimizeChatMediaImage(file, cfg);
      previewUrl  = URL.createObjectURL(optimized.blob);
      pendingMsg  = buildPendingMessage(content || CHAT_IMAGE_SENTINEL, {
        id: messageId,
        temp_media: { objectUrl: previewUrl, mime_type: optimized.mimeType, arquivo_ext: optimized.ext,
          width_px: optimized.width, height_px: optimized.height, expires_at: addDaysIso(7),
          pending: true, failed: false, failed_load: false, blob: optimized.blob }
      });
      upsertMessage(pendingMsg);
      assignMessageMedia(contextType, messageId, {
        storage_path: null, objectUrl: previewUrl, mime_type: optimized.mimeType,
        arquivo_ext: optimized.ext, width_px: optimized.width, height_px: optimized.height,
        pending: true, failed: false, failed_load: false, blob: optimized.blob, expires_at: addDaysIso(7)
      });
      renderMessages();
      scrollBottom();
      await persistPreparedMedia({
        blob: optimized.blob, mimeType: optimized.mimeType, ext: optimized.ext,
        width: optimized.width, height: optimized.height, objectUrl: previewUrl
      }, mediaRpcContent(content || CHAT_IMAGE_SENTINEL), contextType, pendingMsg);
    } catch (error) {
      var failMsg = describeChatMediaError(error);
      if (pendingMsg && pendingMsg.id) {
        pendingMsg.pending = false; pendingMsg.failed = true;
        pendingMsg.error_message = failMsg;
        upsertMessage(pendingMsg);
      }
      if (previewUrl) {
        assignMessageMedia(contextType, pendingMsg ? pendingMsg.id : messageId, {
          storage_path: null, objectUrl: previewUrl,
          mime_type: optimized && optimized.mimeType || null,
          arquivo_ext: optimized && optimized.ext || null,
          pending: false, failed: true, failed_load: false,
          blob: optimized && optimized.blob || null, expires_at: addDaysIso(7)
        });
      }
      setComposerStatus('Falha ao enviar print: ' + failMsg, 'warn', true);
      renderMessages();
    } finally {
      mediaUploadBusy = false;
    }
  }

  async function persistPreparedMedia(prepared, content, contextType, pendingMsg) {
    if (!prepared || !prepared.blob) throw new Error('O print não está mais disponível.');
    var storagePath = '';
    var uploaded    = false;
    var previewUrl  = prepared.objectUrl || (pendingMsg && pendingMsg.temp_media && pendingMsg.temp_media.objectUrl) || null;
    var targetChannel  = pendingMsg && pendingMsg.channel  ? pendingMsg.channel  : currentChannel;
    var targetThreadId = pendingMsg && pendingMsg.thread_id ? pendingMsg.thread_id : projectThreadIdFromChannel(currentChannel);
    try {
      storagePath = buildChatMediaPath(contextType, prepared.ext);
      setComposerStatus('Enviando print...', '', true);
      var uploadRes = await sb.storage.from(TEMP_MEDIA_BUCKET).upload(storagePath, prepared.blob, {
        contentType: prepared.mimeType, upsert: false
      });
      if (uploadRes.error) throw uploadRes.error;
      uploaded = true;

      var rpcName = contextType === 'chat_thread_message'
        ? 'send_chat_thread_message_with_temp_media'
        : 'send_chat_message_with_temp_media';
      var rpcPayload = contextType === 'chat_thread_message'
        ? { p_thread_id: targetThreadId, p_content: content,
            p_storage_path: storagePath, p_mime_type: prepared.mimeType,
            p_arquivo_ext: prepared.ext, p_size_bytes: prepared.blob.size,
            p_width_px: prepared.width, p_height_px: prepared.height }
        : { p_channel: targetChannel, p_content: content,
            p_storage_path: storagePath, p_mime_type: prepared.mimeType,
            p_arquivo_ext: prepared.ext, p_size_bytes: prepared.blob.size,
            p_width_px: prepared.width, p_height_px: prepared.height };
      var rpcRes = await sb.rpc(rpcName, rpcPayload);
      if (rpcRes.error) throw rpcRes.error;
      var saved = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
      if (!saved || !saved.id) throw new Error('Mensagem com print não retornou do servidor.');

      upsertMessage(contextType === 'chat_thread_message' ? normalizeProjectMessage(saved) : saved);
      assignMessageMedia(contextType, saved.id, {
        storage_path: storagePath, objectUrl: previewUrl, mime_type: prepared.mimeType,
        arquivo_ext: prepared.ext, width_px: prepared.width, height_px: prepared.height,
        pending: false, failed: false, failed_load: false, blob: null, expires_at: addDaysIso(7)
      }, pendingMsg ? pendingMsg.id : null);
      renderMessages();
      setComposerStatus('Print enviado. Expira em 7 dias.', 'ok', false);
    } catch (err) {
      if (uploaded && storagePath) {
        try { await sb.storage.from(TEMP_MEDIA_BUCKET).remove([storagePath]); } catch (e) {}
      }
      throw err;
    }
  }

  function retryMediaIssue(messageId) {
    var msg = messages.find(function (item) { return item.id === messageId; });
    var media = msg ? getMessageMedia(msg) : null;
    if (msg && msg.failed) { retryMediaMessage(messageId); return; }
    if (media && media.failed_load) retryMediaLoad(messageId);
  }

  async function retryMediaMessage(messageId) {
    if (mediaUploadBusy) return;
    var msg   = messages.find(function (item) { return item.id === messageId; });
    var media = msg ? getMessageMedia(msg) : null;
    if (!msg || !media || !media.blob) {
      setComposerStatus('Print não disponível para reenvio. Cole novamente.', 'warn', true); return;
    }
    var contextType = mediaContextTypeForMessage(msg);
    mediaUploadBusy = true;
    try {
      msg.pending = true; msg.failed = false; delete msg.error_message;
      assignMessageMedia(contextType, msg.id, Object.assign({}, media, { pending: true, failed: false, failed_load: false }));
      renderMessages();
      await persistPreparedMedia({
        blob: media.blob, mimeType: media.mime_type || 'image/webp',
        ext: media.arquivo_ext || 'webp', width: media.width_px || null,
        height: media.height_px || null, objectUrl: media.objectUrl || null
      }, mediaRpcContent(msg.content), contextType, msg);
    } catch (err) {
      msg.pending = false; msg.failed = true; msg.error_message = describeChatMediaError(err);
      assignMessageMedia(contextType, msg.id, Object.assign({}, media, { pending: false, failed: true, failed_load: false }));
      setComposerStatus('Falha ao reenviar print.', 'warn', true);
      renderMessages();
    } finally { mediaUploadBusy = false; }
  }

  async function retryMediaLoad(messageId) {
    var msg = messages.find(function (item) { return item.id === messageId; });
    if (!msg || String(msg.id || '').indexOf('pending:') === 0) return;
    var contextType   = mediaContextTypeForMessage(msg);
    var currentMedia  = getMessageMedia(msg) || {};
    assignMessageMedia(contextType, msg.id, Object.assign({}, currentMedia, { pending: true, failed_load: false }));
    renderMessages();
    try {
      var metaRes = await sb.from('gestao_anexos_temporarios')
        .select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at')
        .eq('contexto_tipo', contextType).eq('contexto_id', msg.id)
        .is('removido_em', null).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (metaRes.error || !metaRes.data) throw metaRes.error || new Error('Print não encontrado.');
      var down = await sb.storage.from(TEMP_MEDIA_BUCKET).download(metaRes.data.storage_path);
      if (down.error || !down.data) throw down.error || new Error('Falha ao carregar.');
      delete failedStoragePaths[metaRes.data.storage_path];
      assignMessageMedia(contextType, msg.id, Object.assign({}, metaRes.data, {
        objectUrl: URL.createObjectURL(down.data), pending: false, failed: false, failed_load: false, blob: currentMedia.blob || null
      }));
      renderMessages();
    } catch (err) {
      assignMessageMedia(contextType, msg.id, Object.assign({}, currentMedia, { pending: false, failed_load: true }));
      setComposerStatus('Falha ao carregar print.', 'warn', true);
      renderMessages();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     REAÇÕES
  ═══════════════════════════════════════════════════════════════════ */
  function react(msgId, type) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg) return;
    var isProjectMsg = isProjectChannel(msg.channel);
    var lockKey = msgId + '|' + type;
    if (reactionLocks[lockKey]) return;
    var uid = user.auth_id;
    var rx  = normalizeReactions(msg.reactions);
    var arr = (rx[type] || []).slice();
    var idx = arr.indexOf(uid);
    if (idx === -1) arr.push(uid); else arr.splice(idx, 1);
    var upd = Object.assign({}, rx);
    upd[type] = arr;
    msg.reactions = upd;
    renderMessages();
    var rpcName = isProjectMsg ? 'chat_thread_toggle_reaction' : 'chat_toggle_reaction';
    reactionLocks[lockKey] = true;
    sb.rpc(rpcName, { p_message_id: msgId, p_reaction: type })
      .then(function (r) {
        if (r.error) {
          msg.reactions = rx;
          renderMessages();
          setComposerStatus('Não foi possível salvar a reação.', 'warn', true);
          return;
        }
        var updated = Array.isArray(r.data) ? r.data[0] : r.data;
        if (updated && updated.id) {
          upsertMessage(isProjectMsg ? normalizeProjectMessage(updated) : updated);
        }
        renderMessages();
      })
      .finally(function () { delete reactionLocks[lockKey]; });
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER MENSAGENS
  ═══════════════════════════════════════════════════════════════════ */
  function renderMessages() {
    if (!$msgs) return;
    if (!messages.length) {
      $msgs.innerHTML = '<div class="fp-empty"><div class="fp-empty-icon">' + icoEmpty() + '</div>Nenhuma mensagem ainda.</div>';
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
        html += '<div class="fp-date-sep">' + fmtDateSep(dt) + '</div>';
        prevSender = null;
      }

      var gap     = prevTime ? (dt - prevTime) : Infinity;
      var grouped = msg.sender_id === prevSender && gap < 5 * 60 * 1000;
      var iniciais= msg.sender_iniciais || (msg.sender_name || '??').substring(0, 2).toUpperCase();
      var cor     = msg.sender_cor || '#1D6A4A';
      var fn      = firstName(msg.sender_name || '');
      var msgMember = allMembers.find(function (m) { return m.auth_id === msg.sender_id; });
      var msgAvatar = msgMember ? msgMember.avatar_url : null;

      var media        = getMessageMedia(msg);
      var imageOnly    = isImageOnlySentinel(msg.content);
      var hasText      = !!String(msg.content || '').trim() && !imageOnly;
      var showExpired  = imageOnly && !media && isChatMediaExpired(msg);
      var showMediaLoading = imageOnly && !media && !showExpired;
      var showFailed   = !!msg.failed;
      var showLoadFailed = !!(media && media.failed_load);

      var rx      = normalizeReactions(msg.reactions);
      var likeArr = rx.like || [];
      var loveArr = rx.love || [];
      var liked   = likeArr.indexOf(uid) !== -1;
      var loved   = loveArr.indexOf(uid) !== -1;
      var likeN   = likeArr.length;
      var loveN   = loveArr.length;
      var hasRxn  = likeN > 0 || loveN > 0;
      var side    = isOwn ? 'sent' : 'recv';

      html += '<div class="fp-msg' + (isOwn ? ' own' : '') + '" data-id="' + escHtml(String(msg.id)) + '">';

      if (!grouped) {
        var avHtmlStr = msgAvatar
          ? '<img class="fp-av-sm" src="' + escHtml(msgAvatar) + '" alt="" style="border-radius:50%;width:20px;height:20px;object-fit:cover;flex-shrink:0">'
          : '<div class="fp-av-sm" style="background:' + escHtml(cor) + '">' + escHtml(iniciais) + '</div>';
        html += '<div class="fp-msg-meta">' +
          avHtmlStr +
          '<span class="fp-msg-name">' + escHtml(fn) + '</span>' +
          '<span class="fp-msg-time">' + fmtTime(dt) + '</span>' +
          '</div>';
      }

      /* Badge de reação */
      var badgeHtml = '';
      if (hasRxn) {
        badgeHtml = '<div class="fp-msg-rxn-badge">';
        if (likeN > 0) badgeHtml += '&#128077;' + (likeN > 1 ? '<span class="fp-msg-rxn-count">' + likeN + '</span>' : '');
        if (loveN > 0) badgeHtml += '&#10084;&#65039;' + (loveN > 1 ? '<span class="fp-msg-rxn-count">' + loveN + '</span>' : '');
        badgeHtml += '</div>';
      }

      /* Bolha + reações lado a lado */
      html += '<div class="fp-msg-bubble-row' + (hasRxn ? ' has-rxn' : '') + '">' +
        '<div class="fp-msg-bubble-wrap">' +
          '<div class="fp-msg-text ' + side + (hasText ? '' : ' media-only') + '">' +
            (hasText ? fpLinkify(escHtml(msg.content).replace(/\n/g, '<br>')) : '') +
          '</div>' +
          (media && media.objectUrl
            ? '<div class="fp-media-thumb" onclick="fpChat.openMediaViewer(\'' + escHtml(mediaKeyForMessage(msg)) + '\')">' +
                '<img src="' + escHtml(media.objectUrl) + '" alt="Print do chat"></div>'
            : media && media.pending
              ? '<div class="fp-media-thumb"><div style="display:flex;align-items:center;justify-content:center;min-height:88px;font-size:11px;font-weight:600;color:#666;background:linear-gradient(135deg,rgba(29,106,74,.08),rgba(196,131,26,.08))">Enviando print...</div></div>'
              : showLoadFailed
                ? '<button type="button" style="margin-top:6px;font-size:11px;font-weight:600;color:#B84C3A;background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline" onclick="fpChat.retryMediaIssue(\'' + escHtml(String(msg.id)) + '\')">Falha ao carregar print. Clique para tentar de novo.</button>'
                : showExpired
                  ? '<div class="fp-media-expired">Print expirado</div>'
                  : showMediaLoading
                    ? '<div class="fp-media-thumb"><div style="display:flex;align-items:center;justify-content:center;min-height:88px;font-size:11px;font-weight:600;color:#666">Carregando print...</div></div>'
                    : '') +
          (showFailed ? '<button type="button" style="margin-top:6px;font-size:11px;font-weight:600;color:#B84C3A;background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline" onclick="fpChat.retryMediaIssue(\'' + escHtml(String(msg.id)) + '\')">Falha no envio. Clique para tentar de novo.</button>' : '') +
          badgeHtml +
        '</div>' +
        '<div class="fp-msg-react-btns">' +
          '<button class="fp-rbtn like' + (liked ? ' active' : '') + '" onclick="fpChat.react(\'' + escHtml(String(msg.id)) + '\',\'like\')" title="Curtir">' + icoLike() + '</button>' +
          '<button class="fp-rbtn heart' + (loved ? ' active' : '') + '" onclick="fpChat.react(\'' + escHtml(String(msg.id)) + '\',\'love\')" title="Amei">' + icoHeart() + '</button>' +
        '</div>' +
      '</div>';

      html += '</div>';
      prevSender = msg.sender_id;
      prevTime   = dt;
    });

    $msgs.innerHTML = html;
  }

  function fpLinkify(html) {
    return html.replace(/(https?:\/\/[^\s&"<>]+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="fp-link">' + url + '</a>';
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDIA VIEWER
  ═══════════════════════════════════════════════════════════════════ */
  function openMediaViewer(mediaKey) {
    var keys = getMediaViewerGalleryKeys();
    var idx  = keys.indexOf(mediaKey);
    if (idx === -1 && keys.length) idx = 0;
    mediaViewerState = { keys: keys, idx: idx };
    mvZoom = 1;
    renderMediaViewer();
    var viewer = document.getElementById('fp-media-viewer');
    if (viewer) viewer.style.display = 'flex';
  }

  function renderMediaViewer() {
    if (!mediaViewerState) return;
    var state = mediaViewerState;
    var keys  = state.keys;
    var idx   = state.idx;
    var key   = keys[idx];
    var msg   = getMessageByMediaKey(key);
    var media = msg ? getMessageMedia(msg) : null;

    var $img   = document.getElementById('fp-mv-img');
    var $empty = document.getElementById('fp-mv-empty');
    var $title = document.getElementById('fp-mv-title');
    var $meta  = document.getElementById('fp-mv-meta');
    var $count = document.getElementById('fp-mv-count');
    var $prev  = document.getElementById('fp-mv-prev');
    var $next  = document.getElementById('fp-mv-next');
    var $zoom  = document.getElementById('fp-mv-zoom-label');

    if ($count) $count.textContent = (idx + 1) + '/' + keys.length;
    if ($prev)  $prev.disabled  = (idx === 0);
    if ($next)  $next.disabled  = (idx === keys.length - 1);
    if ($zoom)  $zoom.textContent = Math.round(mvZoom * 100) + '%';

    if ($title) $title.textContent = msg ? firstName(msg.sender_name || '') + ' · print' : 'Print do chat';
    if ($meta && msg) {
      var dt = msg.created_at ? new Date(msg.created_at) : null;
      $meta.textContent = dt ? dt.toLocaleDateString('pt-BR') + ' · ' + fmtTime(dt) : '';
    }

    if (media && media.objectUrl && $img) {
      $img.src = media.objectUrl;
      $img.style.display = 'block';
      $img.style.transform = 'scale(' + mvZoom + ')';
      $img.style.transformOrigin = 'center center';
      if ($empty) $empty.style.display = 'none';
    } else {
      if ($img) { $img.style.display = 'none'; $img.src = ''; }
      if ($empty) { $empty.style.display = 'block'; $empty.textContent = 'Imagem não disponível'; }
    }
  }

  function closeMediaViewer() {
    mediaViewerState = null;
    mvZoom = 1;
    var viewer = document.getElementById('fp-media-viewer');
    if (viewer) viewer.style.display = 'none';
    var $img = document.getElementById('fp-mv-img');
    if ($img) { $img.src = ''; $img.style.display = 'none'; }
  }

  function mvPrev() {
    if (!mediaViewerState) return;
    if (mediaViewerState.idx > 0) { mediaViewerState.idx--; mvZoom = 1; renderMediaViewer(); }
  }
  function mvNext() {
    if (!mediaViewerState) return;
    if (mediaViewerState.idx < mediaViewerState.keys.length - 1) { mediaViewerState.idx++; mvZoom = 1; renderMediaViewer(); }
  }
  function mvZoomIn()    { mvZoom = Math.min(mvZoom + 0.25, 4);  renderMediaViewer(); }
  function mvZoomOut()   { mvZoom = Math.max(mvZoom - 0.25, 0.25); renderMediaViewer(); }
  function mvZoomReset() { mvZoom = 1; renderMediaViewer(); }

  function getMediaViewerGalleryKeys() {
    return messages.map(function (msg) {
      var media = getMessageMedia(msg);
      return media && media.objectUrl ? mediaKeyForMessage(msg) : null;
    }).filter(Boolean);
  }

  function getMessageByMediaKey(mediaKey) {
    return messages.find(function (msg) { return mediaKeyForMessage(msg) === mediaKey; }) || null;
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI HELPERS
  ═══════════════════════════════════════════════════════════════════ */
  function showLoading() {
    if (!$msgs) return;
    $msgs.innerHTML = '<div class="fp-loading"><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div><div class="fp-loading-dot"></div></div>';
  }

  function showError() {
    if (!$msgs) return;
    $msgs.innerHTML = '<div class="fp-empty">Erro ao carregar.<br>Tente novamente.</div>';
  }

  function scrollBottom() {
    if ($msgs) { $msgs.scrollTop = $msgs.scrollHeight; scrolledToEnd = true; }
  }

  function showNewMsgToast() {
    var old = document.getElementById('fp-new-msg-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'fp-new-msg-toast'; t.className = 'fp-new-msg-toast'; t.textContent = '↓ Nova mensagem';
    t.onclick = function () { scrollBottom(); t.remove(); };
    var area = document.getElementById('fp-chat-area');
    if (area) area.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }

  function setComposerStatus(message, tone, sticky) {
    var el = document.getElementById('fp-composer-status');
    if (!el) return;
    if (composerStatusTimer) { clearTimeout(composerStatusTimer); composerStatusTimer = null; }
    if (!message) {
      el.style.display = 'none'; el.textContent = '';
      el.className = 'chat-composer-status'; return;
    }
    el.textContent = message;
    el.className = 'chat-composer-status' + (tone ? ' ' + tone : '');
    el.style.display = 'block';
    if (!sticky) {
      composerStatusTimer = setTimeout(function () {
        el.style.display = 'none'; el.textContent = '';
        el.className = 'chat-composer-status'; composerStatusTimer = null;
      }, 4200);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     SOM
  ═══════════════════════════════════════════════════════════════════ */
  function playNotificationSound() {
    if (!soundEnabled) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      [{ f: 1046.5, t: 0, d: 0.18 }, { f: 1318.5, t: 0.13, d: 0.22 }].forEach(function (n) {
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0, ctx.currentTime + n.t);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + n.t);
        osc.stop(ctx.currentTime + n.t + n.d + 0.02);
      });
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════════
     PUSH
  ═══════════════════════════════════════════════════════════════════ */
  function _shouldPush(msg) {
    if (userStatus === 'foco') return false;
    var ch = msg.channel, uid = user.auth_id;
    if ((ch.startsWith('dm:') || ch.startsWith('group:')) && ch.includes(uid)) return true;
    if (isProjectChannel(ch)) return true;
    var fn = (user.nome || '').split(' ')[0].toLowerCase();
    if ((msg.content || '').toLowerCase().includes('@' + fn)) return true;
    return false;
  }

  function _sendChatPush(msg) {
    if (!_shouldPush(msg)) return;
    var appUserId = user.app_user_id || user.id;
    if (!appUserId) return;
    var isDM   = msg.channel.startsWith('dm:') || msg.channel.startsWith('group:');
    var isPrj  = isProjectChannel(msg.channel);
    var sender = (msg.sender_name || '').split(' ')[0];
    var title  = isPrj ? sender + ' atualizou um projeto' : (isDM ? sender + ' enviou uma mensagem' : sender + ' mencionou você');
    var body   = (msg.content || '').length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
    sb.functions.invoke('send-push', {
      body: { usuario_id: appUserId, title: title, body: body, url: window.location.href, tag: 'exp-chat-' + msg.channel }
    }).catch(function () {});
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEMBROS / PROJETOS
  ═══════════════════════════════════════════════════════════════════ */
  function loadTeamMembers() {
    sb.from('usuarios')
      .select('id,auth_id,nome,iniciais,cor,role,avatar_url')
      .order('nome')
      .then(function (r) {
        var all = r.data || [];
        allMembers  = all;
        teamMembers = all.filter(function (m) { return m.auth_id !== user.auth_id && m.id !== user.id; });
        renderConvList();
      });
  }

  function fetchProjectHomeItems(uid) {
    return sb.from('chat_threads')
      .select('id,title,projeto_id,cliente_id,last_message_at,last_message_preview')
      .order('last_message_at', { ascending: false })
      .limit(50)
      .then(function (r) {
        if (r.error || !r.data) return [];
        var threads = r.data;
        return threads.map(function (th) {
          var ch    = 'project:' + th.id;
          var label = th.title || 'Projeto';
          var meta  = buildProjectThreadMeta(th.id, label, th.last_message_preview, th.last_message_at, null);
          meta.unread = channelUnread[ch] || 0;
          projectThreadMeta[ch] = meta;
          return {
            channel:       ch,
            label:         label,
            iniciais:      meta.iniciais,
            cor:           meta.cor,
            preview:       th.last_message_preview || 'Chat do projeto',
            lastCreatedAt: th.last_message_at,
            unread:        meta.unread
          };
        });
      }).catch(function () { return []; });
  }

  function fetchProjectUnreadMap(uid) {
    return sb.from('chat_thread_reads')
      .select('thread_id,last_read_at')
      .eq('user_auth_id', uid)
      .then(function (reads) {
        var readMap = {};
        ((reads && reads.data) || []).forEach(function (r) { readMap[r.thread_id] = r.last_read_at; });
        return sb.from('chat_thread_messages')
          .select('thread_id,created_at,sender_auth_id')
          .neq('sender_auth_id', uid)
          .order('created_at', { ascending: false })
          .then(function (msgs) {
            var counts = {};
            ((msgs && msgs.data) || []).forEach(function (m) {
              var lastRead = readMap[m.thread_id] || null;
              if (!lastRead || m.created_at > lastRead) {
                counts[m.thread_id] = (counts[m.thread_id] || 0) + 1;
              }
            });
            var result = {};
            Object.keys(counts).forEach(function (tid) {
              result['project:' + tid] = counts[tid];
            });
            return result;
          });
      }).catch(function () { return {}; });
  }

  /* ═══════════════════════════════════════════════════════════════════
     UTILS
  ═══════════════════════════════════════════════════════════════════ */
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function firstName(name) { return name ? name.split(' ')[0] : ''; }
  function fmtTime(d) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function fmtDateSep(d) {
    var today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yest.toDateString())  return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }
  function isSocioLikeRole(role) {
    return ['socio','socio_adm','socio_admin'].indexOf((role||'').toLowerCase()) !== -1;
  }
  function isDynamicChannel(ch) { return !!ch && (ch.indexOf('dm:') === 0 || ch.indexOf('group:') === 0); }
  function isProjectChannel(ch) { return !!ch && ch.indexOf('project:') === 0; }
  function projectThreadIdFromChannel(ch) { return String(ch || '').replace('project:', ''); }
  function channelHasUser(ch, uid) {
    if (!isDynamicChannel(ch) || !uid) return false;
    return ch.replace(/^dm:|^group:/, '').split(':').indexOf(uid) !== -1;
  }
  function getChannelLabel(ch) {
    if (ch === 'general') return '# geral';
    if (ch === 'socios')  return '# sócios';
    if (isProjectChannel(ch) && projectThreadMeta[ch]) return projectThreadMeta[ch].label;
    return currentLabel || ch;
  }
  function brandColorForKey(key) {
    var str = String(key || 'exp'), hash = 0;
    for (var i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return BRAND_AVATAR_COLORS[Math.abs(hash) % BRAND_AVATAR_COLORS.length];
  }
  function initialsFromLabel(label, fallback) {
    var base = String(label || '').trim();
    if (!base) return fallback || 'GP';
    if (base.indexOf('-') !== -1) {
      var head = base.split('-')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (head) return head.slice(0, 3);
    }
    var tokens = base.split(/\s+/).filter(Boolean);
    var ini = tokens.slice(0, 2).map(function (t) { return t.charAt(0).toUpperCase(); }).join('');
    if (ini.length >= 2) return ini.slice(0, 3);
    return base.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || (fallback || 'GP');
  }
  function getConversationMeta(msg, uid) {
    var ch = msg.channel;
    if (ch.startsWith('dm:')) {
      var parts    = ch.replace('dm:', '').split(':');
      var otherUid = parts.find(function (p) { return p !== uid; });
      var member   = otherUid ? allMembers.find(function (m) { return m.auth_id === otherUid; }) : null;
      if (member) {
        return {
          label:     firstName(member.nome),
          iniciais:  member.iniciais || (member.nome || '').substring(0, 2).toUpperCase(),
          cor:       member.cor || '#1D6A4A',
          avatarUrl: member.avatar_url || null
        };
      }
    }
    if (ch.startsWith('group:')) {
      var uids    = ch.replace('group:', '').split(':');
      var others  = uids.filter(function (u) { return u !== uid; });
      var names   = others.map(function (u) {
        var m = allMembers.find(function (mm) { return mm.auth_id === u; });
        return m ? firstName(m.nome) : '?';
      });
      return { label: names.join(', '), iniciais: 'GP', cor: brandColorForKey(ch), avatarUrl: null };
    }
    return {
      label:    msg.sender_name || ch,
      iniciais: msg.sender_iniciais || (msg.sender_name || '??').substring(0, 2).toUpperCase(),
      cor:      msg.sender_cor || '#1D6A4A',
      avatarUrl: null
    };
  }
  function compactPreviewText(text, maxLen, fallback) {
    var raw = String(text || '').trim();
    if (isImageOnlySentinel(raw)) return 'Print anexado';
    var cleaned = raw.replace(/\n/g, ' ');
    if (!cleaned) return fallback || '';
    return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '…' : cleaned;
  }
  function normalizeProjectMessage(msg) {
    return {
      id:              msg.id,
      channel:         'project:' + msg.thread_id,
      thread_id:       msg.thread_id,
      sender_id:       msg.sender_auth_id,
      sender_name:     msg.sender_nome,
      sender_iniciais: msg.sender_iniciais,
      sender_cor:      msg.sender_cor,
      content:         msg.content,
      created_at:      msg.created_at,
      reactions:       normalizeReactions(msg.reactions)
    };
  }
  function buildProjectThreadMeta(threadId, title, preview, createdAt, senderAuthId) {
    var channel = 'project:' + threadId;
    var label   = title || (projectThreadMeta[channel] && projectThreadMeta[channel].label) || 'Projeto';
    return {
      threadId: threadId, channel: channel, label: label,
      iniciais: initialsFromLabel(label, 'PRJ'),
      cor:      brandColorForKey(channel + ':' + label),
      preview:  preview || 'Chat do projeto',
      lastCreatedAt: createdAt || null, lastSenderId: senderAuthId || null,
      unread: projectThreadMeta[channel] ? (projectThreadMeta[channel].unread || 0) : 0
    };
  }
  function updateProjectThreadSnapshot(threadId, preview, createdAt, senderAuthId) {
    var ch   = 'project:' + threadId;
    var meta = projectThreadMeta[ch] || buildProjectThreadMeta(threadId, null, preview, createdAt, senderAuthId);
    meta.preview       = preview   || meta.preview;
    meta.lastCreatedAt = createdAt || meta.lastCreatedAt;
    meta.lastSenderId  = senderAuthId || meta.lastSenderId;
    projectThreadMeta[ch] = meta;
  }
  function normalizeReactionList(val) {
    if (Array.isArray(val)) return val.filter(Boolean).map(function (i) { return String(i); });
    if (typeof val === 'string' && val) return [val];
    return [];
  }
  function normalizeReactions(reactions) {
    var base = reactions && typeof reactions === 'object' && !Array.isArray(reactions) ? reactions : {};
    return { like: normalizeReactionList(base.like), love: normalizeReactionList(base.love) };
  }
  function buildPendingMessage(content, extra) {
    pendingMessageSeq += 1;
    return Object.assign({
      id:              'pending:' + pendingMessageSeq,
      channel:         currentChannel,
      thread_id:       isProjectChannel(currentChannel) ? projectThreadIdFromChannel(currentChannel) : null,
      sender_id:       user.auth_id,
      sender_name:     user.nome,
      sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      sender_cor:      user.cor || '#1D6A4A',
      content:         content,
      created_at:      new Date().toISOString(),
      reactions:       normalizeReactions(null),
      pending:         true
    }, extra || {});
  }
  function isMatchingPendingMessage(existing, nextMsg) {
    if (!existing || !existing.pending || !nextMsg) return false;
    return existing.channel === nextMsg.channel &&
      existing.sender_id === nextMsg.sender_id &&
      existing.content   === nextMsg.content;
  }
  function compareMessages(a, b) { return new Date(a.created_at || 0) - new Date(b.created_at || 0); }
  function upsertMessage(nextMsg) {
    if (!nextMsg || !nextMsg.id) return;
    var nm  = Object.assign({}, nextMsg, { reactions: normalizeReactions(nextMsg.reactions) });
    var idx = messages.findIndex(function (m) { return m.id === nextMsg.id; });
    if (idx === -1) idx = messages.findIndex(function (m) { return isMatchingPendingMessage(m, nm); });
    if (idx !== -1) messages[idx] = Object.assign({}, messages[idx], nm, { pending: false });
    else messages.push(nm);
    messages.sort(compareMessages);
  }
  function removeMessageById(id) { messages = messages.filter(function (m) { return m.id !== id; }); }
  function newUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function addDaysIso(days) { var dt = new Date(); dt.setDate(dt.getDate() + days); return dt.toISOString(); }
  function isImageOnlySentinel(content) { return String(content || '').trim() === CHAT_IMAGE_SENTINEL; }
  function isChatMediaExpired(msg) {
    if (!msg || !msg.created_at) return false;
    return Date.now() - new Date(msg.created_at).getTime() > (7 * 24 * 60 * 60 * 1000);
  }
  function mediaContextTypeForMessage(msg) {
    return isProjectChannel(msg && msg.channel) ? 'chat_thread_message' : 'chat_message';
  }
  function mediaKeyFor(type, id) { return String(type || '') + ':' + String(id || ''); }
  function mediaKeyForMessage(msg) { return mediaKeyFor(mediaContextTypeForMessage(msg), msg && msg.id); }
  function assignMessageMedia(contextType, messageId, media, previousMessageId) {
    if (!messageId || !media) return;
    if (previousMessageId && previousMessageId !== messageId) {
      delete messageMediaMap[mediaKeyFor(contextType, previousMessageId)];
    }
    var key = mediaKeyFor(contextType, messageId);
    var prev = messageMediaMap[key];
    if (prev && prev.objectUrl && prev.objectUrl !== media.objectUrl && String(prev.objectUrl).indexOf('blob:') === 0) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    messageMediaMap[key] = Object.assign({}, media);
    var msg = messages.find(function (item) { return item.id === messageId || item.id === previousMessageId; });
    if (msg) msg.temp_media = Object.assign({}, media);
  }
  function clearMessageMediaCache() {
    Object.keys(messageMediaMap).forEach(function (key) {
      var media = messageMediaMap[key];
      if (media && media.objectUrl && String(media.objectUrl).indexOf('blob:') === 0) URL.revokeObjectURL(media.objectUrl);
    });
    messageMediaMap = {};
    messages.forEach(function (msg) {
      if (msg && msg.temp_media && msg.temp_media.objectUrl && String(msg.temp_media.objectUrl).indexOf('blob:') === 0) {
        URL.revokeObjectURL(msg.temp_media.objectUrl);
      }
      if (msg) delete msg.temp_media;
    });
  }
  function getMessageMedia(msg) {
    if (!msg) return null;
    return messageMediaMap[mediaKeyForMessage(msg)] || msg.temp_media || null;
  }
  function loadChatMediaConfig() {
    if (chatMediaConfig) return Promise.resolve(chatMediaConfig);
    var fallback = {
      largura_max_px: CHAT_MEDIA_LIMITS.largura_max_px,
      tamanho_max_kb: CHAT_MEDIA_LIMITS.tamanho_max_kb,
      qualidade_upload: CHAT_MEDIA_LIMITS.qualidade_upload
    };
    return sb.from('plataforma_midia_temporaria_config')
      .select('largura_max_px,tamanho_max_kb,qualidade_upload')
      .eq('id', true).maybeSingle()
      .then(function (r) {
        chatMediaConfig = Object.assign({}, fallback, r.data || {});
        chatMediaConfig.largura_max_px  = Math.max(640, Math.min(Number(chatMediaConfig.largura_max_px  || fallback.largura_max_px),  CHAT_MEDIA_LIMITS.largura_max_px));
        chatMediaConfig.tamanho_max_kb  = Math.max(120, Math.min(Number(chatMediaConfig.tamanho_max_kb  || fallback.tamanho_max_kb),  CHAT_MEDIA_LIMITS.tamanho_max_kb));
        chatMediaConfig.qualidade_upload = Math.max(0.55, Math.min(Number(chatMediaConfig.qualidade_upload || fallback.qualidade_upload), CHAT_MEDIA_LIMITS.qualidade_upload));
        return chatMediaConfig;
      }).catch(function () { chatMediaConfig = fallback; return chatMediaConfig; });
  }
  function optimizeChatMediaImage(file, cfg) {
    return loadImageForChatMedia(file).then(function (img) {
      var quality  = Number(cfg && cfg.qualidade_upload || CHAT_MEDIA_LIMITS.qualidade_upload);
      var widthMax = Number(cfg && cfg.largura_max_px   || CHAT_MEDIA_LIMITS.largura_max_px);
      var maxBytes = Number(cfg && cfg.tamanho_max_kb   || CHAT_MEDIA_LIMITS.tamanho_max_kb) * 1024;
      return rasterizeChatMedia(img, widthMax, quality, 'image/webp')
        .then(function (r) { if (!r.blob) return rasterizeChatMedia(img, widthMax, quality, 'image/jpeg'); return r; })
        .then(function (r) {
          if (!r.blob) throw new Error('Não foi possível preparar o print.');
          if (r.blob.size > maxBytes) return rasterizeChatMedia(img, Math.min(widthMax, 1120), Math.min(quality, CHAT_MEDIA_LIMITS.qualidade_fallback), 'image/jpeg');
          return r;
        })
        .then(function (r) {
          if (!r.blob) throw new Error('Não foi possível comprimir o print.');
          if (r.blob.size > maxBytes) throw new Error('O print ficou pesado demais após compressão.');
          return { blob: r.blob, width: r.width, height: r.height, mimeType: r.mimeType, ext: r.mimeType === 'image/webp' ? 'webp' : 'jpg' };
        });
    });
  }
  function loadImageForChatMedia(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Arquivo inválido.')); };
      img.src = url;
    });
  }
  function rasterizeChatMedia(img, larguraMax, qualidade, mimeType) {
    return new Promise(function (resolve) {
      var ratio  = img.width > larguraMax ? (larguraMax / img.width) : 1;
      var w = Math.max(1, Math.round(img.width * ratio));
      var h = Math.max(1, Math.round(img.height * ratio));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function (blob) { resolve({ blob: blob, width: w, height: h, mimeType: blob ? mimeType : null }); }, mimeType, qualidade);
    });
  }
  function buildChatMediaPath(contextType, ext) {
    var dt = new Date();
    return contextType + '/' + user.auth_id + '/' + dt.getFullYear() + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + newUuid() + '.' + ext;
  }
  function describeChatMediaError(error) {
    var raw = String(error && (error.message || error.details || error.code) || 'Falha ao anexar print.');
    var lo  = raw.toLowerCase();
    if (lo.indexOf('send_chat') !== -1 && lo.indexOf('with_temp_media') !== -1) return 'A estrutura de prints ainda não está aplicada no banco.';
    if (lo.indexOf('row-level security') !== -1 || lo.indexOf('access denied') !== -1) return 'Seu usuário não conseguiu gravar este print.';
    if (lo.indexOf('bucket') !== -1 || lo.indexOf('storage') !== -1) return 'Não foi possível subir o print para o storage.';
    return raw;
  }
  function loadCurrentMessageMedia() {
    if (!messages.length) return Promise.resolve();
    var contextType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    var ids = messages.map(function (msg) { return msg.id; }).filter(function (id) {
      return !!id && String(id).indexOf('pending:') !== 0;
    });
    if (!ids.length) return Promise.resolve();
    var requestSeq = ++mediaRequestSeq;
    return sb.from('gestao_anexos_temporarios')
      .select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at')
      .eq('contexto_tipo', contextType).in('contexto_id', ids)
      .is('removido_em', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .then(function (r) {
        if (requestSeq !== mediaRequestSeq || r.error) return;
        return Promise.all((r.data || []).map(function (row) {
          if (!row.storage_path || failedStoragePaths[row.storage_path]) {
            return { key: mediaKeyFor(contextType, row.contexto_id), messageId: row.contexto_id, media: Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true }) };
          }
          return sb.storage.from(TEMP_MEDIA_BUCKET).download(row.storage_path).then(function (down) {
            if (down.error || !down.data) {
              failedStoragePaths[row.storage_path] = true;
              return { key: mediaKeyFor(contextType, row.contexto_id), messageId: row.contexto_id, media: Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true }) };
            }
            return { key: mediaKeyFor(contextType, row.contexto_id), messageId: row.contexto_id, media: Object.assign({}, row, { objectUrl: URL.createObjectURL(down.data), pending: false }) };
          });
        })).then(function (items) {
          if (requestSeq !== mediaRequestSeq) return;
          (items || []).filter(Boolean).forEach(function (item) { assignMessageMedia(contextType, item.messageId, item.media); });
          if (currentChannel) renderMessages();
        });
      });
  }
  function handleChatTempMediaRealtime(row) {
    if (!row || row.removido_em || !currentChannel) return;
    var expectedType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    if (String(row.contexto_tipo || '').toLowerCase() !== expectedType) return;
    if (!messages.some(function (msg) { return msg.id === row.contexto_id; })) return;
    if (messageMediaMap[mediaKeyFor(expectedType, row.contexto_id)]) return;
    if (!row.storage_path || failedStoragePaths[row.storage_path]) {
      assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true }));
      renderMessages(); return;
    }
    sb.storage.from(TEMP_MEDIA_BUCKET).download(row.storage_path).then(function (down) {
      if (down.error || !down.data) {
        failedStoragePaths[row.storage_path] = true;
        assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true }));
      } else {
        assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, { objectUrl: URL.createObjectURL(down.data), pending: false, failed_load: false }));
      }
      renderMessages();
    });
  }

  /* ── SVG icons ────────────────────────────────────────────────── */
  function icoSound()    { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'; }
  function icoSoundOff() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'; }
  function icoLike()     { return '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>'; }
  function icoHeart()    { return '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'; }
  function icoEmpty()    { return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }

  /* ═══════════════════════════════════════════════════════════════════
     API PÚBLICA
  ═══════════════════════════════════════════════════════════════════ */
  window.fpChat = {
    /* Nav */
    goBack:            goBack,
    /* Status */
    toggleStatusPop:   toggleStatusPop,
    setStatus:         setStatus,
    toggleSound:       toggleSound,
    /* Conversas */
    openChannel:       openChannel,
    filterConvs:       filterConvs,
    toggleProjectSection: toggleProjectSection,
    /* Novo DM */
    openNewDM:         openNewDM,
    closeNewDM:        closeNewDM,
    toggleMember:      toggleMember,
    confirmNewDM:      confirmNewDM,
    /* Mensagens */
    send:              send,
    handleKey:         handleKey,
    autoResize:        autoResize,
    /* Mídia */
    pickMedia:         pickMedia,
    handleMediaInput:  handleMediaInput,
    retryMediaIssue:   retryMediaIssue,
    /* Reações */
    react:             react,
    /* Media viewer */
    openMediaViewer:   openMediaViewer,
    closeMediaViewer:  closeMediaViewer,
    mvPrev:            mvPrev,
    mvNext:            mvNext,
    mvZoomIn:          mvZoomIn,
    mvZoomOut:         mvZoomOut,
    mvZoomReset:       mvZoomReset
  };

  /* ── Start ── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
