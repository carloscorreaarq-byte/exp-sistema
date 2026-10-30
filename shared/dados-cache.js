/* ════════════════════════════════════════════════════════════════════
   EXP · Reaproveitar dados ao trocar de página — shared/dados-cache.js
   ────────────────────────────────────────────────────────────────────
   Guarda por até 5 minutos, nesta aba (sessionStorage), os dados básicos
   que a Gestão baixa ao abrir. Sai sozinho ao fechar a aba.

   Os dados são descartados quando:
   • alguém grava, nesta aba e em qualquer módulo, numa das tabelas abaixo;
   • a página é recarregada (F5 / Cmd+R sempre busca tudo de novo);
   • passam os 5 minutos, ou a tela de login é aberta.
   O que outra pessoa ou outra aba alterou pode demorar até 5 minutos para
   aparecer (ou até recarregar a página).

   Carregar logo depois de privacidade.js, antes do cliente do Supabase
   (acompanha as gravações pelo fetch).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PREFIXO = 'exp_dc1:';
  var VALIDADE_MS = 5 * 60 * 1000;
  var TABELAS = /\/rest\/v1\/(produtos|etapas|etapa_desenvolvedores|oportunidades|clientes|exp_proposals|usuarios|horas_lancadas|fin_plano_contas)(\?|$)/;

  function limpar() {
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(PREFIXO) === 0) sessionStorage.removeItem(k);
      }
    } catch (e) {}
  }

  /* Modo privacidade entra na chave: os dados guardados trazem o papel já rebaixado ou não */
  function chave(nome, uid) {
    var priv = '';
    try { priv = localStorage.getItem('exp_privacidade') === '1' ? 'p' : 'n'; } catch (e) {}
    return PREFIXO + (uid || '') + ':' + priv + ':' + nome;
  }

  function ler(nome, uid) {
    if (!uid) return null;
    try {
      var k = chave(nome, uid);
      var bruto = sessionStorage.getItem(k);
      if (!bruto) return null;
      var o = JSON.parse(bruto);
      if (!o || Date.now() - o.t > VALIDADE_MS) { sessionStorage.removeItem(k); return null; }
      return o.d;
    } catch (e) { return null; }
  }

  function gravar(nome, uid, dados) {
    if (!uid) return;
    try {
      sessionStorage.setItem(chave(nome, uid), JSON.stringify({ t: Date.now(), d: dados }));
    } catch (e) { limpar(); }   // sem espaço: segue sem guardar
  }

  /* Tela de login e recarga da página: começa do zero */
  var recarregou = false;
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    recarregou = !!(nav && nav.type === 'reload');
  } catch (e) {}
  if (recarregou || /(^|\/)(index\.html)?$/i.test(location.pathname)) limpar();

  /* Gravação em tabela guardada: descarta na hora e de novo ao terminar */
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var metodo = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var p = _fetch.apply(this, arguments);
      if (metodo === 'GET' || metodo === 'HEAD' || !TABELAS.test(url)) return p;
      limpar();
      return p.then(function (r) { limpar(); return r; }, function (e) { limpar(); throw e; });
    };
  }

  window.ExpCache = { ler: ler, gravar: gravar, limpar: limpar };
})();
