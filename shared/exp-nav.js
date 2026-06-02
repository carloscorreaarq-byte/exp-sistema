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
  let _calData = null, _calLoaded = false, _calTimer = null, _calLoadedAt = 0;
  let _crmData = null, _crmLoaded = false, _crmTimer = null, _crmEncerrados = null;
  let _prioData = null, _prioLoaded = false, _prioTimer = null;
  /* painéis flutuantes de busca */
  let _apoioPanelOpen = false, _apoioSearchTimer = null;
  let _contatosPanelOpen = false, _contatosSearchTimer = null;
  /* EXP Room */
  let _roomBlinkTimer = null;
  const ROOM_BLINK_SECS = 120;

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

  ${item('app.html',           'Hub',      ico.hub)}
  ${item('gestao.html',        'Projetos', ico.projetos)}
  ${item('chat-fullpage.html', 'Chat',     ico.chat)}

  ${activeHref !== 'apoio.html' ? `<div class="exp-nav-apoio-wrap" id="exp-nav-apoio-wrap">
    <a href="apoio.html" class="exp-apoio-go-btn" id="exp-apoio-go-btn" title="Abrir módulo Apoio">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <button class="exp-nav-item" id="exp-nav-apoio" onclick="ExpNav.toggleApoioPanel(event)" title="Apoio">
      ${ico.apoio}
    </button>
  </div>` : ''}

  ${activeHref !== 'contatos.html' ? `<div class="exp-nav-contatos-wrap" id="exp-nav-contatos-wrap">
    <a href="contatos.html" class="exp-contatos-go-btn" id="exp-contatos-go-btn" title="Abrir módulo Contatos">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </a>
    <button class="exp-nav-item" id="exp-nav-contatos" onclick="ExpNav.toggleContatosPanel(event)" title="Contatos">
      ${ico.contatos}
    </button>
  </div>` : ''}
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

<!-- Banner: comercial -->
<div id="exp-crm-banner"
     onmouseenter="ExpNav.showCrmBanner()" onmouseleave="ExpNav.hideCrmBanner()">
  <div class="exp-hov-hdr">
    <span class="exp-hov-hdr-title">Atualizações comerciais</span>
    <span class="exp-hov-hdr-sub" id="exp-crm-banner-sub"></span>
  </div>
  <div id="exp-crm-banner-body"></div>
</div>

<!-- Banner: prioridade -->
<div id="exp-prio-banner"
     onmouseenter="ExpNav.showPrioBanner()" onmouseleave="ExpNav.hidePrioBanner()">
  <div id="exp-prio-banner-inner"></div>
</div>

<!-- Painel de busca — Apoio -->
<div id="exp-apoio-panel">
  <div class="exp-hov-hdr">
    <span class="exp-hov-hdr-title">Apoio</span>
    <span class="exp-hov-hdr-sub" id="exp-apoio-hdr-sub"></span>
  </div>
  <div class="exp-apoio-search-row">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#aaa"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input class="exp-apoio-search-input" id="exp-apoio-input" type="text"
           placeholder="Buscar no módulo de Apoio…"
           oninput="ExpNav.apoioSearchInput(this.value)"
           onkeydown="if(event.key==='Escape')ExpNav.closeApoioPanel()"
           autocomplete="off" style="flex:1">
    <button class="exp-apoio-clear-btn" id="exp-apoio-clear"
            onclick="ExpNav.apoioClear()" title="Limpar" style="display:none">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div id="exp-apoio-body">
    <div class="exp-panel-empty">Digite para buscar no módulo de Apoio</div>
  </div>
  <div class="exp-panel-footer">
    <a href="apoio.html" class="exp-panel-full-link">
      Abrir módulo completo
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>
  </div>
</div>

<!-- Painel de busca — Contatos -->
<div id="exp-contatos-panel">
  <div class="exp-hov-hdr">
    <span class="exp-hov-hdr-title">Contatos</span>
    <span class="exp-hov-hdr-sub" id="exp-contatos-hdr-sub"></span>
  </div>
  <div class="exp-apoio-search-row">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#aaa"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input class="exp-apoio-search-input" id="exp-contatos-input" type="text"
           placeholder="Buscar por nome, empresa, produto…"
           oninput="ExpNav.contatosSearchInput(this.value)"
           onkeydown="if(event.key==='Escape')ExpNav.closeContatosPanel()"
           autocomplete="off" style="flex:1">
    <button class="exp-apoio-clear-btn" id="exp-contatos-clear"
            onclick="ExpNav.contatosClear()" title="Limpar" style="display:none">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div id="exp-contatos-body">
    <div class="exp-panel-empty">Digite para buscar contatos</div>
  </div>
  <div class="exp-panel-footer">
    <a href="contatos.html" class="exp-panel-full-link">
      Abrir módulo completo
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>
  </div>
</div>

<!-- Painel de notificações -->
<div id="exp-notif-panel" style="display:none">
  <div class="exp-notif-head">
    <span class="exp-notif-head-title">Notificações</span>
    <button onclick="ExpNav.toggleNotifPanel()" title="Fechar"
      style="border:none;background:none;cursor:pointer;color:var(--cinza,#D0CFC9);display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;padding:0;transition:color .12s"
      onmouseenter="this.style.color='var(--grafite,#111110)'" onmouseleave="this.style.color='var(--cinza,#D0CFC9)'">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
  </div>
  <div id="notif-lista"></div>
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
      /* apaga blink localmente após 120s exatos */
      if (_roomBlinkTimer) clearTimeout(_roomBlinkTimer);
      _roomBlinkTimer = setTimeout(function() {
        var b = document.getElementById('exp-room-btn');
        if (b) { b.classList.remove('active'); b.removeAttribute('data-tooltip'); }
        _roomBlinkTimer = null;
      }, ROOM_BLINK_SECS * 1000);
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
          var secs = (Date.now() - new Date(d.updated_at).getTime()) / 1000;
          if (secs <= ROOM_BLINK_SECS) {
            btn.classList.add('active');
            var quem   = (d.value && d.value !== 'true') ? d.value : 'Alguém';
            var quando = secs < 60 ? 'agora mesmo' : 'há ' + Math.floor(secs / 60) + ' min';
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
    var isOpen = $panel.style.display === 'flex';
    if (isOpen) {
      /* fechar */
      $panel.style.display = 'none';
      if ($btn) $btn.classList.remove('active');
      if (window._appNotifToggle) window._appNotifToggle();
    } else {
      /* abrir */
      if (window._appNotifToggle) window._appNotifToggle();
      $panel.style.display = 'flex';
      var rect   = ($btn || {getBoundingClientRect:function(){return{right:80,bottom:400};}}).getBoundingClientRect();
      var panelH = $panel.offsetHeight || 360;
      $panel.style.top  = Math.max(16, rect.bottom - panelH) + 'px';
      $panel.style.left = (rect.right + 8) + 'px';
      if ($btn) $btn.classList.add('active');
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
    var stale = (Date.now() - _calLoadedAt) > 5 * 60 * 1000;
    if (!_calLoaded || stale) _fetchCalEvents();
    else _renderCalBanner();
  }

  function hideCalBanner() {
    _calTimer = setTimeout(function() {
      var $b = document.getElementById('exp-cal-banner');
      if ($b) $b.style.display = 'none';
    }, 220);
  }

  function _fetchCalEvents() {
    var sb = _sb(); if (!sb) return;
    /* Se _user ainda não foi setado, tenta reler do sessionStorage */
    if (!_user) {
      try { var c = JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); if (c && (c.nome || c.app_user_id)) _user = c; } catch(e) {}
    }
    if (!_user) return;
    /* user_id na tabela é o ID interno (usuarios.id), não auth_id */
    var internalId = _user.app_user_id || _user.id;
    /* início de hoje (meia-noite local) para não perder eventos que já começaram */
    var today = new Date(); today.setHours(0,0,0,0);
    var todayISO = today.toISOString();
    /* scope 'nucleo' também é semi-global — inclui na exibição */
    sb.from('calendar_events')
      .select('id,titulo,tipo,inicio,fim,dia_inteiro,meet_link,scope')
      .gte('fim', todayISO)
      .or('scope.eq.todos,scope.eq.nucleo,user_id.eq.' + internalId)
      .order('inicio').limit(5)
      .then(function(r) {
        _calLoaded = true; _calLoadedAt = Date.now();
        if (r.error) { console.warn('[ExpNav] calendar_events query error:', r.error); _calData = []; }
        else { _calData = r.data || []; }
        _renderCalBanner();
      })
      .catch(function(e) {
        console.warn('[ExpNav] _fetchCalEvents failed:', e);
        _calLoaded = true; _calLoadedAt = Date.now(); _calData = []; _renderCalBanner();
      });
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
    if ($btn) $btn.classList.add('active');
    if (!_crmLoaded) _fetchCrmData();
    else _renderCrmBanner();
  }

  function hideCrmBanner() {
    _crmTimer = setTimeout(function() {
      var $b   = document.getElementById('exp-crm-banner');
      var $btn = document.getElementById('exp-nav-crm');
      if ($b) $b.style.display = 'none';
      if ($btn) $btn.classList.remove('active');
    }, 220);
  }

  function _fetchCrmData() {
    var sb = _sb(); if (!sb) return;
    var cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var hoje    = new Date().toISOString().split('T')[0];
    Promise.all([
      sb.from('produtos')
        .select('id,nome,status,valor_fechado,valor_proposto,data_fechamento,updated_at,oportunidades(projeto,clientes(nome))')
        .in('status', ['fechado','negado'])
        .or('data_fechamento.gte.' + cutoff7 + ',and(status.eq.negado,updated_at.gte.' + cutoff7 + ')')
        .order('updated_at', { ascending: false }).limit(5),
      sb.from('followups_produto')
        .select('id,next_date,observacao,produto_id,produtos(nome,oportunidades(projeto,clientes(nome)))')
        .not('next_date','is',null)
        .gte('next_date', hoje)
        .order('next_date', { ascending: true }).limit(5)
    ]).then(function(res) {
      _crmLoaded = true; _crmEncerrados = res[0].data || []; _crmData = res[1].data || [];
      _renderCrmBanner();
    }).catch(function() {
      _crmLoaded = true; _crmEncerrados = []; _crmData = []; _renderCrmBanner();
    });
  }

  function _renderCrmBanner() {
    var $body = document.getElementById('exp-crm-banner-body');
    var $sub  = document.getElementById('exp-crm-banner-sub');
    if (!$body) return;
    var enc  = _crmEncerrados || [];
    var fups = _crmData || [];
    var total = enc.length + fups.length;
    if ($sub) $sub.textContent = total ? total + (total === 1 ? ' item' : ' itens') : '';
    var html = '';

    if (enc.length) {
      html += '<div class="exp-crm-sec-hdr">Últimos 7 dias</div>';
      enc.forEach(function(p) {
        var opp     = p.oportunidades || {};
        var cli     = opp.clientes || {};
        var isFech  = p.status === 'fechado';
        var cls     = isFech ? 'fechado' : 'negado';
        var valor   = isFech ? (+p.valor_fechado || +p.valor_proposto || 0) : (+p.valor_proposto || 0);
        var valFmt  = valor ? 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 }) : '—';
        html += '<div class="exp-crm-fech-item ' + cls + '">' +
          '<div class="exp-fu-info">' +
            '<div class="exp-fu-cliente">' + _esc(cli.nome||'—') + '</div>' +
            '<div class="exp-fu-proj">' + _esc(opp.projeto||p.nome||'—') + '</div>' +
          '</div>' +
          '<div class="exp-crm-fech-valor">' + _esc(valFmt) + '</div>' +
          '</div>';
      });
    }

    if (fups.length) {
      html += '<div class="exp-crm-sec-hdr">Próximos follow-ups</div>';
      var hoje = new Date().toISOString().split('T')[0];
      fups.forEach(function(fu) {
        var prod = fu.produtos || {}, opp = prod.oportunidades || {}, cli = opp.clientes || {};
        var dt   = fu.next_date || '';
        var cls  = dt < hoje ? 'atrasado' : dt === hoje ? 'hoje' : '';
        var pts  = dt ? dt.split('-') : [];
        var dtFmt = pts.length === 3 ? pts[2]+'/'+pts[1]+'/'+pts[0].slice(2) : '—';
        html += '<div class="exp-fu-item ' + cls + '">' +
          '<div class="exp-fu-info">' +
            '<div class="exp-fu-cliente">' + _esc(cli.nome||'—') + '</div>' +
            '<div class="exp-fu-proj">' + _esc(opp.projeto||prod.nome||'—') + '</div>' +
          '</div>' +
          '<div class="exp-fu-date">' + _esc(dtFmt) + '</div>' +
          '</div>';
      });
    }

    if (!html) html = '<div style="padding:20px 14px;font-size:11px;color:var(--cinza,#D0CFC9);text-align:center">Nenhuma atualização recente ✓</div>';
    $body.innerHTML = html;
    var $b = document.getElementById('exp-crm-banner'), $btn = document.getElementById('exp-nav-crm');
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

  /* ── PAINEL APOIO ────────────────────────────────────────── */
  function toggleApoioPanel(event) {
    if (_apoioPanelOpen) closeApoioPanel(); else _openApoioPanel(event);
  }
  function _openApoioPanel(event) {
    _apoioPanelOpen = true;
    var $p   = document.getElementById('exp-apoio-panel');
    var $btn = (event && event.currentTarget) || document.getElementById('exp-nav-apoio');
    if (!$p || !$btn) return;
    $p.style.display = 'flex';
    _positionBanner($p, $btn);
    if ($btn) $btn.classList.add('active');
    setTimeout(function() { var $i = document.getElementById('exp-apoio-input'); if ($i) $i.focus(); }, 50);
    setTimeout(function() {
      document.addEventListener('click', _apoioOutside);
      document.addEventListener('keydown', _apoioKey);
    }, 10);
  }
  function closeApoioPanel() {
    _apoioPanelOpen = false;
    var $p = document.getElementById('exp-apoio-panel');
    if ($p) $p.style.display = 'none';
    var $btn = document.getElementById('exp-nav-apoio');
    if ($btn) $btn.classList.remove('active');
    document.removeEventListener('click', _apoioOutside);
    document.removeEventListener('keydown', _apoioKey);
  }
  function _apoioOutside(e) {
    var $p = document.getElementById('exp-apoio-panel'), $w = document.getElementById('exp-nav-apoio-wrap');
    if ($p && !$p.contains(e.target) && $w && !$w.contains(e.target)) closeApoioPanel();
  }
  function _apoioKey(e) { if (e.key === 'Escape') closeApoioPanel(); }

  function apoioSearchInput(q) {
    var $clr = document.getElementById('exp-apoio-clear');
    if ($clr) $clr.style.display = q ? 'flex' : 'none';
    if (_apoioSearchTimer) clearTimeout(_apoioSearchTimer);
    if (!q.trim()) {
      var $b = document.getElementById('exp-apoio-body');
      if ($b) $b.innerHTML = '<div class="exp-panel-empty">Digite para buscar no módulo de Apoio</div>';
      var $s = document.getElementById('exp-apoio-hdr-sub'); if ($s) $s.textContent = '';
      return;
    }
    _apoioSearchTimer = setTimeout(function() { _doApoioSearch(q.trim()); }, 280);
  }
  function apoioClear() {
    var $i = document.getElementById('exp-apoio-input');
    if ($i) { $i.value = ''; $i.focus(); }
    apoioSearchInput('');
  }
  function _doApoioSearch(q) {
    var sb = _sb(); if (!sb) return;
    var $b = document.getElementById('exp-apoio-body');
    if (!$b) return;
    $b.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:24px"><div class="exp-loading-dot"></div><div class="exp-loading-dot"></div><div class="exp-loading-dot"></div></div>';
    var like = '%' + q + '%';
    Promise.all([
      sb.from('apoio_normas').select('id,codigo,titulo,area').or('titulo.ilike.'+like+',codigo.ilike.'+like).limit(4),
      sb.from('apoio_vegetacao_especie').select('id,nome_popular,nome_cientifico,grupo').ilike('nome_popular',like).limit(4),
      sb.from('apoio_indicacoes').select('id,titulo,autor').ilike('titulo',like).limit(3),
      sb.from('apoio_subtemas_custom').select('id,nome,tema_slug').ilike('nome',like).limit(3)
    ]).then(function(res) {
      _renderApoioResults(res[0].data||[], res[1].data||[], res[2].data||[], res[3].data||[], q);
    }).catch(function() {
      var $b2 = document.getElementById('exp-apoio-body');
      if ($b2) $b2.innerHTML = '<div class="exp-panel-empty">Erro ao buscar. Tente novamente.</div>';
    });
  }
  function _renderApoioResults(normas, veg, ind, sub, q) {
    var $b   = document.getElementById('exp-apoio-body');
    var $sub = document.getElementById('exp-apoio-hdr-sub');
    if (!$b) return;
    var total = normas.length + veg.length + ind.length + sub.length;
    if ($sub) $sub.textContent = total ? total + ' resultado' + (total !== 1 ? 's' : '') : '';
    if (!total) { $b.innerHTML = '<div class="exp-panel-empty">Nenhum resultado para "' + _esc(q) + '"</div>'; return; }
    var html = '';
    if (normas.length) {
      html += '<div class="exp-panel-group-hdr">Normas Técnicas</div>';
      normas.forEach(function(n) {
        var label = n.codigo ? n.codigo + ' — ' + (n.titulo||'') : (n.titulo||'');
        html += '<a href="apoio.html?tema=apoio&sub=normas-tecnicas" class="exp-panel-result"><div class="exp-panel-dot" style="background:#1D4FA0"></div><div class="exp-panel-info"><div class="exp-panel-title">' + _esc(label) + '</div><div class="exp-panel-sub">' + _esc(n.area||'') + '</div></div></a>';
      });
    }
    if (veg.length) {
      html += '<div class="exp-panel-group-hdr">Vegetação</div>';
      veg.forEach(function(v) {
        html += '<a href="apoio.html?tema=vegetacao" class="exp-panel-result"><div class="exp-panel-dot" style="background:#1D6A4A"></div><div class="exp-panel-info"><div class="exp-panel-title">' + _esc(v.nome_popular) + '</div><div class="exp-panel-sub">' + _esc(v.nome_cientifico||v.grupo||'') + '</div></div></a>';
      });
    }
    if (ind.length) {
      html += '<div class="exp-panel-group-hdr">Indicações</div>';
      ind.forEach(function(i) {
        html += '<a href="apoio.html?tema=apoio&sub=indicacoes-conteudo" class="exp-panel-result"><div class="exp-panel-dot" style="background:#C4831A"></div><div class="exp-panel-info"><div class="exp-panel-title">' + _esc(i.titulo) + '</div><div class="exp-panel-sub">' + _esc(i.autor||'') + '</div></div></a>';
      });
    }
    if (sub.length) {
      html += '<div class="exp-panel-group-hdr">Conhecimento</div>';
      sub.forEach(function(s) {
        html += '<a href="apoio.html?tema=apoio" class="exp-panel-result"><div class="exp-panel-dot" style="background:#3E7858"></div><div class="exp-panel-info"><div class="exp-panel-title">' + _esc(s.nome) + '</div><div class="exp-panel-sub">' + _esc(s.tema_slug||'') + '</div></div></a>';
      });
    }
    $b.innerHTML = html;
    var $p = document.getElementById('exp-apoio-panel'), $btn = document.getElementById('exp-nav-apoio');
    if ($p && $btn) _positionBanner($p, $btn);
  }

  /* ── PAINEL CONTATOS ─────────────────────────────────────── */
  var _CONTATO_COR = { fornecedor:'#1D4FA0', prestador:'#1D6A4A', parceiro:'#C4831A', cliente:'#B84C3A', outro:'#6D7D8A' };
  function _contatoCor(tipo) { return _CONTATO_COR[(tipo||'').toLowerCase()] || '#6D7D8A'; }

  function toggleContatosPanel(event) {
    if (_contatosPanelOpen) closeContatosPanel(); else _openContatosPanel(event);
  }
  function _openContatosPanel(event) {
    _contatosPanelOpen = true;
    var $p   = document.getElementById('exp-contatos-panel');
    var $btn = (event && event.currentTarget) || document.getElementById('exp-nav-contatos');
    if (!$p || !$btn) return;
    $p.style.display = 'flex';
    _positionBanner($p, $btn);
    if ($btn) $btn.classList.add('active');
    setTimeout(function() { var $i = document.getElementById('exp-contatos-input'); if ($i) $i.focus(); }, 50);
    setTimeout(function() {
      document.addEventListener('click', _contatosOutside);
      document.addEventListener('keydown', _contatosKey);
    }, 10);
  }
  function closeContatosPanel() {
    _contatosPanelOpen = false;
    var $p = document.getElementById('exp-contatos-panel');
    if ($p) $p.style.display = 'none';
    var $btn = document.getElementById('exp-nav-contatos');
    if ($btn) $btn.classList.remove('active');
    document.removeEventListener('click', _contatosOutside);
    document.removeEventListener('keydown', _contatosKey);
  }
  function _contatosOutside(e) {
    var $p = document.getElementById('exp-contatos-panel'), $w = document.getElementById('exp-nav-contatos-wrap');
    if ($p && !$p.contains(e.target) && $w && !$w.contains(e.target)) closeContatosPanel();
  }
  function _contatosKey(e) { if (e.key === 'Escape') closeContatosPanel(); }

  function contatosSearchInput(q) {
    var $clr = document.getElementById('exp-contatos-clear');
    if ($clr) $clr.style.display = q ? 'flex' : 'none';
    if (_contatosSearchTimer) clearTimeout(_contatosSearchTimer);
    if (!q.trim()) {
      var $b = document.getElementById('exp-contatos-body');
      if ($b) $b.innerHTML = '<div class="exp-panel-empty">Digite para buscar contatos</div>';
      var $s = document.getElementById('exp-contatos-hdr-sub'); if ($s) $s.textContent = '';
      return;
    }
    _contatosSearchTimer = setTimeout(function() { _doContatosSearch(q.trim()); }, 280);
  }
  function contatosClear() {
    var $i = document.getElementById('exp-contatos-input');
    if ($i) { $i.value = ''; $i.focus(); }
    contatosSearchInput('');
  }
  function _doContatosSearch(q) {
    var sb = _sb(); if (!sb) return;
    var $b = document.getElementById('exp-contatos-body');
    if (!$b) return;
    $b.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:4px;padding:24px"><div class="exp-loading-dot"></div><div class="exp-loading-dot"></div><div class="exp-loading-dot"></div></div>';
    var like = '%' + q + '%';
    sb.from('exp_contatos')
      .select('id,nome,empresa,tipo_produto,cidade,estado,telefone,tipo')
      .eq('desativado', false)
      .or('nome.ilike.'+like+',empresa.ilike.'+like+',tipo_produto.ilike.'+like+',cidade.ilike.'+like)
      .order('nome').limit(10)
      .then(function(r) { _renderContatosResults(r.data||[], q); })
      .catch(function() {
        var $b2 = document.getElementById('exp-contatos-body');
        if ($b2) $b2.innerHTML = '<div class="exp-panel-empty">Erro ao buscar. Tente novamente.</div>';
      });
  }
  function _renderContatosResults(contatos, q) {
    var $b   = document.getElementById('exp-contatos-body');
    var $sub = document.getElementById('exp-contatos-hdr-sub');
    if (!$b) return;
    var total = contatos.length;
    if ($sub) $sub.textContent = total ? total + ' resultado' + (total !== 1 ? 's' : '') : '';
    if (!total) { $b.innerHTML = '<div class="exp-panel-empty">Nenhum resultado para "' + _esc(q) + '"</div>'; return; }
    var html = '';
    contatos.forEach(function(c) {
      var cor   = _contatoCor(c.tipo);
      var sub1  = [];
      if (c.empresa) sub1.push(_esc(c.empresa));
      if (c.tipo)    sub1.push('<span class="exp-contatos-tag">' + _esc(c.tipo) + '</span>');
      var meta  = [];
      var loc   = [c.cidade, c.estado].filter(Boolean).join('/');
      if (loc)          meta.push(_esc(loc));
      if (c.telefone)   meta.push(_esc(c.telefone));
      if (c.tipo_produto) meta.push(_esc(c.tipo_produto));
      html += '<a href="contatos.html?q=' + encodeURIComponent(c.nome) + '" class="exp-contatos-result">' +
        '<div class="exp-panel-dot" style="background:' + cor + ';margin-top:5px"></div>' +
        '<div class="exp-panel-info">' +
          '<div class="exp-panel-title">' + _esc(c.nome) + '</div>' +
          (sub1.length ? '<div class="exp-panel-sub">' + sub1.join('&ensp;·&ensp;') + '</div>' : '') +
          (meta.length ? '<div class="exp-contatos-meta">' + meta.join('&ensp;·&ensp;') + '</div>' : '') +
        '</div></a>';
    });
    $b.innerHTML = html;
    var $p = document.getElementById('exp-contatos-panel'), $btn = document.getElementById('exp-nav-contatos');
    if ($p && $btn) _positionBanner($p, $btn);
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
        AppNotif.init({ userId: user.id || user.app_user_id });
      }

      /* outside click notif */
      _bindNotifOutsideClick();

      /* EXP Room */
      _checkRoomStatus();
      setInterval(_checkRoomStatus, 15000);

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
    toggleApoioPanel,   closeApoioPanel,   apoioSearchInput,   apoioClear,
    toggleContatosPanel, closeContatosPanel, contatosSearchInput, contatosClear,
  };
})();
