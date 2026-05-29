/* ══════════════════════════════════════════════════════════════
   EXP Platform — Nav lateral compartilhada  (shared/exp-nav.js)
   ──────────────────────────────────────────────────────────────
   USO:
     <link rel="stylesheet" href="shared/exp-nav.css">
     <script src="shared/exp-nav.js"></script>   (após supabase + app-notif)

     ExpNav.init({
       module:       'app',          // marca item ativo (ver MODULE_HREFS)
       onUserMenu:   fn,             // callback do avatar (opcional)
       onUserReady:  fn(user),       // chamado após sessão detectada (opcional)
     });

   Muda a lógica de notificações / adiciona ícone → propaga em todos os módulos.
   ══════════════════════════════════════════════════════════════ */

window.ExpNav = (() => {
  'use strict';

  /* ── Constantes ──────────────────────────────────────────── */
  const SOCIO_ROLES  = ['socio','socio_adm','socio_admin'];
  const ROOM_URL     = 'https://meet.google.com/mqe-cgge-maz';
  const ROOM_TIMEOUT = 5; /* minutos */

  /* mapa módulo → href do item ativo */
  const MODULE_HREFS = {
    app:        'app.html',
    gestao:     'gestao.html',
    apoio:      'apoio.html',
    contatos:   'contatos.html',
    chat:       'chat-fullpage.html',
    calendario: 'calendario.html',
    crm:        'crm.html',
    financeiro: 'financeiro.html',
    analise:    'analise.html',
    pessoas:    'pessoas.html',
    sociedade:  'sociedade.html',
    calc:       'calc.html',
  };

  /* ── Estado interno ──────────────────────────────────────── */
  let _user        = null;
  let _config      = {};
  let _roomTimer   = null;

  /* hover banners */
  let _calData = null, _calLoaded = false, _calTimer = null;
  let _crmData = null, _crmLoaded = false, _crmTimer = null;
  let _prioData = null, _prioLoaded = false, _prioTimer = null;

  /* ── Helpers ──────────────────────────────────────────────── */
  function _esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _isSocio(role) {
    return SOCIO_ROLES.includes((role || '').toLowerCase());
  }

  function _sb() { return window.sb || null; }

  function _positionBanner($banner, $btn) {
    if (!$banner || !$btn) return;
    var rect    = $btn.getBoundingClientRect();
    var bannerH = $banner.offsetHeight || 200;
    var topPos  = Math.max(16, Math.min(rect.top, window.innerHeight - bannerH - 16));
    $banner.style.top  = topPos + 'px';
    $banner.style.left = (rect.right + 8) + 'px';
  }

  /* ── HTML da nav ─────────────────────────────────────────── */
  function _buildNavHTML(module, role) {
    var activeHref = MODULE_HREFS[module] || '';
    var isSocio    = _isSocio(role);

    function item(href, titleAttr, svgPath, extra) {
      if (href && href === activeHref) return ''; /* oculta o módulo atual */
      var tag      = href ? 'a' : 'button';
      var hrefAttr = href ? ' href="' + href + '"' : '';
      return '<' + tag + hrefAttr + ' class="exp-nav-item" title="' + titleAttr + '"' + (extra || '') + '>' +
        svgPath + '</' + tag + '>';
    }

    /* SVGs — 18×18 stroke-only */
    var ico = {
      hub:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      projetos:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      chat:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      apoio:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      contatos:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      calendario:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      crm:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      financeiro:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      analise:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      pessoas:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      sociedade: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      calc:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>',
      room:      '<svg id="exp-room-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
      bell:      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
      star:      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    };

    var socSep   = isSocio ? '<div class="exp-nav-sep" id="exp-nav-sep-soc"></div>' : '';
    var socStyle = isSocio ? '' : ' style="display:none"';

    return `
<nav id="exp-nav">

  ${item('app.html',       'Hub',        ico.hub)}
  ${item('gestao.html',    'Projetos',   ico.projetos)}
  ${item('chat-fullpage.html', 'Chat',   ico.chat)}
  ${item('apoio.html',     'Apoio',      ico.apoio)}
  ${item('contatos.html',  'Contatos',   ico.contatos)}
  ${activeHref !== 'calendario.html' ? `<a href="calendario.html" class="exp-nav-item" title="Calendário"
     id="exp-nav-cal"
     onmouseenter="ExpNav.showCalBanner(event)" onmouseleave="ExpNav.hideCalBanner()">
    ${ico.calendario}
  </a>` : ''}

  <div class="exp-nav-sep" id="exp-nav-sep-soc"${isSocio?'':' style="display:none"'}></div>
  ${activeHref !== 'crm.html' ? `<a href="crm.html" class="exp-nav-item" title="Comercial"
     id="exp-nav-crm"${socStyle}
     onmouseenter="ExpNav.showCrmBanner(event)" onmouseleave="ExpNav.hideCrmBanner()">
    ${ico.crm}
  </a>` : ''}
  ${activeHref !== 'financeiro.html' ? `<a href="financeiro.html" class="exp-nav-item" title="Financeiro"${socStyle}>${ico.financeiro}</a>` : ''}
  ${activeHref !== 'analise.html'    ? `<a href="analise.html"    class="exp-nav-item" title="Análise"${socStyle}>${ico.analise}</a>`    : ''}
  ${activeHref !== 'pessoas.html'    ? `<a href="pessoas.html"    class="exp-nav-item" title="Pessoas"${socStyle}>${ico.pessoas}</a>`    : ''}
  ${activeHref !== 'sociedade.html'  ? `<a href="sociedade.html"  class="exp-nav-item" title="Sociedade"${socStyle}>${ico.sociedade}</a>` : ''}
  ${activeHref !== 'calc.html'       ? `<a href="calc.html"       class="exp-nav-item" title="Calculadora"${socStyle}>${ico.calc}</a>`   : ''}

  <div class="exp-nav-spacer"></div>
  <div class="exp-nav-sep"></div>

  <button id="exp-theme-toggle" onclick="ExpNav.toggleTheme()" title="Alternar tema"></button>

  <a id="exp-room-btn" href="${ROOM_URL}" target="_blank" rel="noopener"
     class="exp-nav-item" title="EXP Room" onclick="ExpNav.roomClick()">
    ${ico.room}
  </a>

  <button class="exp-nav-item" id="exp-nav-bell" title="Notificações"
          onclick="ExpNav.toggleNotifPanel()" style="position:relative">
    ${ico.bell}
    <span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;background:#B84C3A;color:#fff;font-size:8px;font-weight:700;font-family:'DM Mono',monospace;min-width:14px;height:14px;border-radius:7px;align-items:center;justify-content:center;padding:0 2px;border:1.5px solid #2A2926;line-height:1"></span>
  </button>

  <button class="exp-nav-item" id="exp-nav-prio" title="Minha prioridade"
          onmouseenter="ExpNav.showPrioBanner(event)" onmouseleave="ExpNav.hidePrioBanner()">
    ${ico.star}
  </button>

</nav>`;
  }

  /* ── HTML dos painéis flutuantes ─────────────────────────── */
  function _buildPanelsHTML() {
    return `
<!-- Banner: calendário -->
<div id="exp-cal-banner"
     onmouseenter="ExpNav.showCalBanner()" onmouseleave="ExpNav.hideCalBanner()">
  <div class="exp-hov-hdr">
    <span class="exp-hov-hdr-title">Próximos eventos</span>
    <span class="exp-hov-hdr-sub" id="exp-cal-banner-sub"></span>
  </div>
  <div id="exp-cal-banner-body"></div>
</div>

<!-- Banner: follow-ups -->
<div id="exp-crm-banner"
     onmouseenter="ExpNav.showCrmBanner()" onmouseleave="ExpNav.hideCrmBanner()">
  <div class="exp-hov-hdr">
    <span class="exp-hov-hdr-title">Follow-ups em aberto</span>
    <span class="exp-hov-hdr-sub" id="exp-crm-banner-sub"></span>
  </div>
  <div id="exp-crm-banner-body"></div>
</div>

<!-- Banner: prioridade -->
<div id="exp-prio-banner"
     onmouseenter="ExpNav.showPrioBanner()" onmouseleave="ExpNav.hidePrioBanner()">
  <div id="exp-prio-banner-inner"></div>
</div>

<!-- Painel de notificações -->
<div id="exp-notif-panel" style="display:none">
  <div class="exp-notif-head">
    <span class="exp-notif-head-title">Notificações</span>
    <button onclick="ExpNav.toggleNotifPanel()" title="Fechar"
      style="border:none;background:none;cursor:pointer;color:var(--cinza,#D0CFC9);display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;padding:0;transition:color .12s"
      onmouseenter="this.style.color='var(--grafite,#111110)'" onmouseleave="this.style.color='var(--cinza,#D0CFC9)'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
  </div>
  <div id="exp-notif-lista" id="notif-lista"></div>
</div>`;
  }

  /* ── Injeção no DOM ──────────────────────────────────────── */
  function _inject(module, role) {
    /* nav — inserida como primeiro filho do body */
    var navWrap = document.createElement('div');
    navWrap.innerHTML = _buildNavHTML(module, role).trim();
    var navEl = navWrap.firstElementChild;

    /* encontra o container principal (flex row) para inserir a nav */
    var container = document.getElementById('app-shell') ||
                    document.getElementById('app-wrap')  ||
                    document.querySelector('[id$="-app"]') ||
                    document.body;

    /* remove nav legada se existir */
    ['app-nav','fp-nav'].forEach(function(id) {
      var old = document.getElementById(id);
      if (old && old.parentNode) old.parentNode.removeChild(old);
    });

    /* insere a nav como primeiro filho do container */
    container.insertBefore(navEl, container.firstChild);

    /* painéis flutuantes — no body para evitar clipping */
    var panelWrap = document.createElement('div');
    panelWrap.innerHTML = _buildPanelsHTML().trim();
    while (panelWrap.firstChild) document.body.appendChild(panelWrap.firstChild);

    /* expõe #notif-lista com alias para compatibilidade com AppNotif */
    var lista = document.getElementById('exp-notif-lista');
    if (lista && !document.getElementById('notif-lista')) lista.id = 'notif-lista';
  }

  /* ── Avatar do usuário ───────────────────────────────────── */
  function _updateAvatar(user) {
    var $av = document.getElementById('exp-nav-user');
    if (!$av || !user) return;
    $av.title = user.nome || 'Minha conta';
    $av.style.background = user.cor || '#888';
    if (user.avatar_url) {
      $av.innerHTML = '<img src="' + _esc(user.avatar_url) + '" alt="">';
    } else {
      $av.textContent = (user.iniciais || (user.nome || '??').substring(0,2)).toUpperCase();
    }
    $av.onclick = _config.onUserMenu || function() {};
  }

  /* ── Tema ────────────────────────────────────────────────── */
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('exp-theme', next);
  }

  /* ── EXP Room ────────────────────────────────────────────── */
  function roomClick() {
    var sb = _sb(); if (!sb || !_user) return;
    var nome = (_user.nome || '').split(' ')[0] || 'Alguém';
    sb.from('exp_config').upsert({
      key: 'exp_room_active', value: nome,
      updated_at: new Date().toISOString(),
      updated_by: String(_user.app_user_id || _user.id || '')
    }, { onConflict: 'key' }).then(function() {
      var btn = document.getElementById('exp-room-btn');
      if (btn) { btn.classList.add('active'); btn.setAttribute('data-tooltip', nome + ' · agora mesmo'); }
    }).catch(function() {});
  }

  function _checkRoomStatus() {
    var sb = _sb(); if (!sb) return;
    sb.from('exp_config').select('updated_at,value').eq('key','exp_room_active').maybeSingle()
      .then(function(r) {
        var btn = document.getElementById('exp-room-btn');
        if (!btn) return;
        var d = r.data;
        if (d && d.updated_at) {
          var mins = (Date.now() - new Date(d.updated_at).getTime()) / 60000;
          if (mins <= ROOM_TIMEOUT) {
            btn.classList.add('active');
            var quem   = (d.value && d.value !== 'true') ? d.value : 'Alguém';
            var quando = mins < 1 ? 'agora mesmo' : 'há ' + Math.floor(mins) + ' min';
            btn.setAttribute('data-tooltip', quem + ' · ' + quando);
            return;
          }
        }
        btn.classList.remove('active');
        btn.removeAttribute('data-tooltip');
      }).catch(function() {});
  }

  /* ── Notificações ────────────────────────────────────────── */
  function toggleNotifPanel() {
    var $panel = document.getElementById('exp-notif-panel');
    var $btn   = document.getElementById('exp-nav-bell');
    if (!$panel) return;
    var willOpen = $panel.style.display === 'none' || !$panel.style.display;
    /* delega ao AppNotif para controle do estado interno */
    if (window._appNotifToggle) window._appNotifToggle();
    if (willOpen) {
      $panel.style.display = 'flex';
      var rect   = ($btn || {getBoundingClientRect:function(){return{right:80,bottom:400};}}).getBoundingClientRect();
      var panelH = $panel.offsetHeight || 360;
      $panel.style.top  = Math.max(16, rect.bottom - panelH) + 'px';
      $panel.style.left = (rect.right + 8) + 'px';
      if ($btn) $btn.classList.add('active');
    } else {
      if ($btn) $btn.classList.remove('active');
    }
  }

  /* outside click fecha o painel de notificações */
  function _bindNotifOutsideClick() {
    document.addEventListener('click', function(e) {
      var $panel = document.getElementById('exp-notif-panel');
      var $btn   = document.getElementById('exp-nav-bell');
      if (!$panel || $panel.style.display === 'none') return;
      if ($panel.contains(e.target)) return;
      if ($btn   && $btn.contains(e.target)) return;
      /* fecha */
      if (window._appNotifToggle) window._appNotifToggle();
      $panel.style.display = 'none';
      if ($btn) $btn.classList.remove('active');
    });
  }

  /* ── HOVER BANNER — CALENDÁRIO ───────────────────────────── */
  function showCalBanner(event) {
    if (_calTimer) { clearTimeout(_calTimer); _calTimer = null; }
    var $b   = document.getElementById('exp-cal-banner');
    var $btn = (event && event.currentTarget) || document.getElementById('exp-nav-cal');
    if (!$b) return;
    $b.style.display = 'block';
    _positionBanner($b, $btn);
    if (!_calLoaded) _fetchCalEvents();
    else _renderCalBanner();
  }

  function hideCalBanner() {
    _calTimer = setTimeout(function() {
      var $b = document.getElementById('exp-cal-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }

  function _fetchCalEvents() {
    var sb = _sb(); if (!sb || !_user) return;
    var uid = _user.auth_id || _user.app_user_id || _user.id;
    sb.from('calendar_events')
      .select('id,titulo,tipo,inicio,fim,dia_inteiro,meet_link')
      .gte('inicio', new Date().toISOString())
      .or('scope.eq.todos,user_id.eq.' + uid)
      .order('inicio').limit(3)
      .then(function(r) { _calLoaded = true; _calData = r.data || []; _renderCalBanner(); })
      .catch(function()  { _calLoaded = true; _calData = [];            _renderCalBanner(); });
  }

  function _renderCalBanner() {
    var $body = document.getElementById('exp-cal-banner-body');
    var $sub  = document.getElementById('exp-cal-banner-sub');
    if (!$body) return;
    var items = _calData || [];
    if ($sub) $sub.textContent = items.length ? 'próximos ' + items.length : '';
    if (!items.length) {
      $body.innerHTML = '<div style="padding:20px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhum evento próximo 🎉</div>';
      return;
    }
    var tipoCor = { reuniao:'#1D4FA0', visita:'#1D6A4A', prazo:'#B84C3A', entrega:'#C4831A' };
    var html = '';
    items.forEach(function(ev) {
      var cor  = tipoCor[(ev.tipo||'').toLowerCase()] || '#6D7D8A';
      var dt   = new Date(ev.inicio);
      var dFmt = dt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
      var hFmt = ev.dia_inteiro ? 'dia inteiro' : dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      var meet = ev.meet_link ? '<a class="exp-cal-meet" href="' + _esc(ev.meet_link) + '" target="_blank" rel="noopener">▶ Meet</a>' : '';
      html += '<div class="exp-cal-item">' +
        '<div class="exp-cal-dot" style="background:' + _esc(cor) + '"></div>' +
        '<div class="exp-cal-info">' +
          '<div class="exp-cal-titulo">' + _esc(ev.titulo||'—') + '</div>' +
          '<div class="exp-cal-meta"><span>' + _esc(dFmt) + ' · ' + _esc(hFmt) + '</span>' + meet + '</div>' +
        '</div></div>';
    });
    $body.innerHTML = html;
    var $b   = document.getElementById('exp-cal-banner');
    var $btn = document.getElementById('exp-nav-cal');
    if ($b && $btn) _positionBanner($b, $btn);
  }

  /* ── HOVER BANNER — COMERCIAL ────────────────────────────── */
  function showCrmBanner(event) {
    if (_crmTimer) { clearTimeout(_crmTimer); _crmTimer = null; }
    var $b   = document.getElementById('exp-crm-banner');
    var $btn = (event && event.currentTarget) || document.getElementById('exp-nav-crm');
    if (!$b) return;
    $b.style.display = 'block';
    _positionBanner($b, $btn);
    if (!_crmLoaded) _fetchCrmFollowups();
    else _renderCrmBanner();
  }

  function hideCrmBanner() {
    _crmTimer = setTimeout(function() {
      var $b = document.getElementById('exp-crm-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }

  function _fetchCrmFollowups() {
    var sb = _sb(); if (!sb) return;
    sb.from('followups_produto')
      .select('id,next_date,observacao,produto_id,produtos(nome,oportunidades(projeto,clientes(nome)))')
      .not('next_date','is',null)
      .order('next_date', { ascending: true }).limit(5)
      .then(function(r) { _crmLoaded = true; _crmData = r.data || []; _renderCrmBanner(); })
      .catch(function()  { _crmLoaded = true; _crmData = [];            _renderCrmBanner(); });
  }

  function _renderCrmBanner() {
    var $body = document.getElementById('exp-crm-banner-body');
    var $sub  = document.getElementById('exp-crm-banner-sub');
    if (!$body) return;
    var items = _crmData || [];
    if ($sub) $sub.textContent = items.length ? items.length + ' itens' : '';
    if (!items.length) {
      $body.innerHTML = '<div style="padding:20px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhum follow-up pendente ✓</div>';
      return;
    }
    var hoje = new Date().toISOString().split('T')[0];
    var html = '';
    items.forEach(function(fu) {
      var prod    = fu.produtos || {};
      var opp     = prod.oportunidades || {};
      var cli     = opp.clientes || {};
      var dt      = fu.next_date || '';
      var cls     = dt < hoje ? 'atrasado' : dt === hoje ? 'hoje' : '';
      var parts   = dt ? dt.split('-') : [];
      var dtFmt   = parts.length === 3 ? parts[2]+'/'+parts[1]+'/'+parts[0].slice(2) : '—';
      html += '<div class="exp-fu-item ' + cls + '">' +
        '<div class="exp-fu-info">' +
          '<div class="exp-fu-cliente">' + _esc(cli.nome||'—') + '</div>' +
          '<div class="exp-fu-proj">' + _esc(opp.projeto||prod.nome||'—') + '</div>' +
        '</div>' +
        '<div class="exp-fu-date">' + _esc(dtFmt) + '</div>' +
        '</div>';
    });
    $body.innerHTML = html;
    var $b   = document.getElementById('exp-crm-banner');
    var $btn = document.getElementById('exp-nav-crm');
    if ($b && $btn) _positionBanner($b, $btn);
  }

  /* ── HOVER BANNER — PRIORIDADE ───────────────────────────── */
  function showPrioBanner(event) {
    if (_prioTimer) { clearTimeout(_prioTimer); _prioTimer = null; }
    var $b   = document.getElementById('exp-prio-banner');
    var $btn = (event && event.currentTarget) || document.getElementById('exp-nav-prio');
    if (!$b) return;
    $b.style.display = 'block';
    _positionBanner($b, $btn);
    if (!_prioLoaded) _fetchPrioBanner();
    else _renderPrioBanner();
  }

  function hidePrioBanner() {
    _prioTimer = setTimeout(function() {
      var $b = document.getElementById('exp-prio-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }

  function _fetchPrioBanner() {
    var sb = _sb(); if (!sb || !_user) return;
    var uid = _user.app_user_id || _user.id;
    sb.from('prioridades_usuario')
      .select('id,produto_id,prazo_texto,ordem,comentario,produtos(id,nome,oportunidades(projeto,cidade,clientes(nome,uf)),etapas(nome,status,ordem))')
      .eq('usuario_id', uid).eq('concluida', false).order('ordem').limit(1).maybeSingle()
      .then(function(r) { _prioLoaded = true; _prioData = r.data || null; _renderPrioBanner(); })
      .catch(function()  { _prioLoaded = true; _renderPrioBanner(); });
  }

  function _renderPrioBanner() {
    var $inner = document.getElementById('exp-prio-banner-inner');
    if (!$inner) return;
    if (!_prioData) {
      $inner.innerHTML = '<div class="exp-prio-hdr" style="background:var(--off,#F7F6F3);color:#aaa">Minha prioridade</div>' +
        '<div style="padding:18px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhuma prioridade definida.</div>';
      return;
    }
    var pr  = _prioData;
    var prod = pr.produtos || {};
    var opp  = prod.oportunidades || {};
    var cli  = opp.clientes || {};
    var titulo   = [cli.nome, opp.projeto].filter(Boolean).join(' | ') || prod.nome || 'Projeto';
    var cidadeUf = [opp.cidade, cli.uf].filter(Boolean).join('/');
    var etapas   = (prod.etapas || []).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
    var etapa    = etapas.find(function(e){ return e.status==='em_andamento'; });
    var estado = '';
    var chipHtml = '';
    if (pr.prazo_texto) {
      var hoje = new Date(); hoje.setHours(0,0,0,0);
      var pdt  = new Date(pr.prazo_texto + 'T12:00:00'); pdt.setHours(0,0,0,0);
      var dtFmt = pdt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
      if (pdt < hoje) estado = 'atrasada'; else if (+pdt===+hoje) estado = 'hoje';
      chipHtml = '<div><span class="exp-prio-chip ' + estado + '">📅 ' + _esc(dtFmt) + '</span></div>';
    }
    var hdrStyle = estado === 'atrasada'
      ? 'background:#F5E0DD;color:#B84C3A;border-bottom:1px solid rgba(184,76,58,.2)'
      : estado === 'hoje'
        ? 'background:#FBF3E8;color:#C4831A;border-bottom:1px solid rgba(196,131,26,.2)'
        : 'background:#EAF0FB;color:#1D4FA0;border-bottom:1px solid rgba(29,79,160,.2)';
    $inner.innerHTML =
      '<div class="exp-prio-hdr" style="' + hdrStyle + '">Minha prioridade</div>' +
      '<div class="exp-prio-card ' + estado + '">' +
        '<div class="exp-prio-info">' +
          '<div class="exp-prio-nome">' + _esc(titulo) + '</div>' +
          (cidadeUf ? '<div class="exp-prio-cidade">' + _esc(cidadeUf) + '</div>' : '') +
          (etapa    ? '<div class="exp-prio-etapa">↳ ' + _esc(etapa.nome||'') + '</div>' : '') +
          chipHtml +
        '</div>' +
        '<button class="exp-prio-check" onclick="event.stopPropagation()" title="Ver detalhes">✓</button>' +
      '</div>';
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init(config) {
    _config = config || {};
    var module = _config.module || 'app';

    function _boot(user) {
      _user = user;
      var role = user.role || '';

      /* injeta nav + painéis no DOM */
      _inject(module, role);

      /* avatar */
      _updateAvatar(user);

      /* AppNotif */
      if (window.AppNotif) {
        AppNotif.init({ userId: user.id || user.app_user_id }).then(function() {
          /* remove seção de tarefas do sininho (gerenciada localmente) */
          AppNotif.setComputedSection('tarefas', { label: 'Tarefas', items: [] });
        }).catch(function() {
          AppNotif.setComputedSection('tarefas', { label: 'Tarefas', items: [] });
        });
      }

      /* outside click notif */
      _bindNotifOutsideClick();

      /* EXP Room */
      _checkRoomStatus();
      setInterval(_checkRoomStatus, 30000);

      /* callback do módulo */
      if (typeof _config.onUserReady === 'function') _config.onUserReady(user);
    }

    /* detecta sessão */
    var cached = (function() {
      try { return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); } catch { return null; }
    })();

    if (cached && (cached.nome || cached.app_user_id)) {
      _boot(cached);
    } else {
      window.addEventListener('exp:session-ready', function(e) {
        if (e.detail) _boot(e.detail);
      }, { once: true });
    }
  }

  /* ── API pública ─────────────────────────────────────────── */
  return {
    init,
    toggleTheme,
    toggleNotifPanel,
    roomClick,
    showCalBanner,  hideCalBanner,
    showCrmBanner,  hideCrmBanner,
    showPrioBanner, hidePrioBanner,
  };
})();
