/* ════════════════════════════════════════════════════════════════════
   EXP · Modo privacidade — shared/privacidade.js
   ────────────────────────────────────────────────────────────────────
   Botão de olho ao lado do tema / problema / lembrete, só para sócios e
   sócios-administradores. Ligado, a plataforma mostra a visão de
   colaborador: o próprio cadastro chega às telas com o papel
   'colaborador', então módulos societários, custos e demais dados
   sensíveis ficam escondidos pelas mesmas regras que já valem para
   colaboradores. Útil ao compartilhar a tela.

   • Só muda o que a tela mostra: nada é gravado no banco e as
     permissões do servidor não mudam.
   • Colaborador nunca vê o botão; e, mesmo forçando a chave no
     navegador, o modo só rebaixa — nunca dá acesso a nada.
   • Precisa ser carregado logo depois do supabase-js, antes dos
     scripts da página (intercepta a leitura de `usuarios`).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'exp_privacidade';           // localStorage: '1' = ligado
  var KEY_SOCIO = 'exp_priv_socio';      // sessionStorage: '1' = o usuário logado é sócio de verdade
  var KEY_UID = 'exp_priv_uid';          // sessionStorage: usuarios.id do usuário logado

  function ler(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function gravar(st, k, v) { try { if (v == null) st.removeItem(k); else st.setItem(k, v); } catch (e) {} }

  var ativo = ler(localStorage, KEY) === '1';

  function ehSocio(role) {
    var r = String(role || '').toLowerCase().trim();
    return r === 'socio' || r === 'socio_adm' || r === 'socio_admin';
  }

  /* auth.users.id da sessão guardada pelo supabase-js (sb-<ref>-auth-token) */
  function authId() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(k)) {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          var u = v && (v.user || (v.currentSession && v.currentSession.user));
          if (u && u.id) return u.id;
        }
      }
    } catch (e) {}
    return null;
  }

  /* ── Leitura de `usuarios`: registra se o usuário é sócio e, com o modo ligado,
        entrega o próprio cadastro com papel de colaborador ── */
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var metodo = (init && init.method) || (input && input.method) || 'GET';
      var p = _fetch.apply(this, arguments);
      if (!/\/rest\/v1\/usuarios(\?|$)/.test(url) || String(metodo).toUpperCase() !== 'GET') return p;
      return p.then(function (res) {
        if (!res || !res.ok) return res;
        var aid = authId(), uid = ler(sessionStorage, KEY_UID);
        var porAuth = !!(aid && url.indexOf('auth_id=eq.' + aid) !== -1);
        return res.clone().text().then(function (txt) {
          var data;
          try { data = JSON.parse(txt); } catch (e) { return res; }
          var lista = Array.isArray(data) ? data : [data];
          var mudou = false;
          lista.forEach(function (r) {
            if (!r || typeof r !== 'object') return;
            var meu = porAuth || (aid && r.auth_id === aid) || (uid && r.id === uid);
            if (!meu) return;
            if (r.id && !uid) { uid = r.id; gravar(sessionStorage, KEY_UID, r.id); }
            if (!('role' in r)) return;
            if (ehSocio(r.role)) { gravar(sessionStorage, KEY_SOCIO, '1'); setTimeout(montar, 0); }
            else if (!r._role_real) gravar(sessionStorage, KEY_SOCIO, null);
            if (ativo && ehSocio(r.role)) {
              r._role_real = r.role;
              r.role = 'colaborador';
              if ('is_platform_manager' in r) r.is_platform_manager = false;
              mudou = true;
            }
          });
          if (!mudou) return res;
          var h = new Headers(res.headers);
          h.delete('content-length'); h.delete('content-encoding');
          return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: h });
        });
      });
    };
  }

  /* Cache do usuário de sessões anteriores: com o modo ligado, rebaixa também */
  if (ativo) {
    try {
      var c = JSON.parse(sessionStorage.getItem('exp_usuario') || 'null');
      if (c && ehSocio(c.role)) { c._role_real = c.role; c.role = 'colaborador'; sessionStorage.setItem('exp_usuario', JSON.stringify(c)); }
    } catch (e) {}
  }

  /* ── Botão do olho ── */
  var OLHO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OLHO_FECHADO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function podeVer() { return ativo || ler(sessionStorage, KEY_SOCIO) === '1'; }

  function alternar() {
    gravar(localStorage, KEY, ativo ? null : '1');
    gravar(sessionStorage, 'exp_usuario', null);   // relê o cadastro já com o novo modo
    window.location.reload();
  }

  function estilo() {
    if (document.getElementById('exp-priv-css')) return;
    var st = document.createElement('style');
    st.id = 'exp-priv-css';
    st.textContent =
      '.exp-priv-btn{display:inline-flex;align-items:center;justify-content:center;position:relative}' +
      '.exp-priv-btn.ativo{color:#E2B141 !important}' +
      '.exp-priv-btn.ativo::after{content:"";position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:#E2B141;box-shadow:0 0 0 1.5px var(--branco,#fff)}';
    document.head.appendChild(st);
  }

  /* Coloca o olho antes do botão de tema (o da barra compartilhada ou o próprio da página) */
  function montar() {
    if (!podeVer() || document.getElementById('exp-priv-btn')) return;
    var tema = document.getElementById('exp-tr-theme') ||
      document.querySelector('[onclick*="toggleTheme"]');
    if (!tema || !tema.parentNode) return;
    estilo();
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'exp-priv-btn';
    b.className = (tema.className || '') + ' exp-priv-btn' + (ativo ? ' ativo' : '');
    var s = tema.getAttribute('style'); if (s) b.setAttribute('style', s);
    b.title = ativo
      ? 'Modo privacidade ligado: você está vendo a visão de colaborador. Clique para voltar à visão de sócio.'
      : 'Modo privacidade: esconder dados societários e sensíveis (para compartilhar a tela)';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    b.innerHTML = ativo ? OLHO_FECHADO : OLHO;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); alternar(); });
    tema.parentNode.insertBefore(b, tema);
  }

  function iniciar() {
    montar();
    // A barra compartilhada e o cadastro chegam depois: tenta de novo quando o DOM muda
    var obs = new MutationObserver(function () { montar(); });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.ExpPrivacidade = { ativo: function () { return ativo; }, alternar: alternar };
})();
