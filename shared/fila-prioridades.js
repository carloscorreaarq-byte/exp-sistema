/* ════════════════════════════════════════════════════════════════════
   EXP · Fila de prioridades — shared/fila-prioridades.js
   ────────────────────────────────────────────────────────────────────
   Cada pessoa trabalha numa prioridade por vez. Cada prioridade tem uma
   previsão em MEIO-PERÍODOS (2 por dia útil, 10 numa semana cheia). A fila
   calcula início e fim de cada uma, em sequência:
     • a 1ª começa em `inicio_fila` (quando virou a atual) ou agora;
     • as seguintes começam no meio-período livre seguinte ao fim da anterior;
     • nunca antes da Liberação (`data_inicio`), se houver;
     • pula fim de semana, feriados (gerais e locais) e ausências/banco
       (créditos de shared/horas-creditos.js);
     • se a atual passou do fim previsto sem ser concluída, ela "escorrega":
       as próximas passam a contar a partir de agora.
   Usado por gestao.html (Fluxo de trabalho) e app.html (hub). Expõe window.ExpFila.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDia(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); }
  function agora() { var n = new Date(); return { d: isoLocal(n), p: n.getHours() >= 13 ? 1 : 0 }; }
  function proximo(s) { return s.p === 0 ? { d: s.d, p: 1 } : { d: addDia(s.d, 1), p: 0 }; }
  function antes(a, b) { return a.d < b.d || (a.d === b.d && a.p < b.p); }

  /* [manhã livre, tarde livre] num dia, considerando fim de semana e créditos */
  function livres(iso, cred) {
    var w = new Date(iso + 'T12:00:00').getDay();
    if (w === 0 || w === 6) return [false, false];
    var c = cred && cred.porDia && cred.porDia[iso];
    if (!c) return [true, true];
    if (c.feriado || c.frac >= 1) return [false, false];
    var m = true, t = true, diaH = (cred && cred.diaH) || 8;
    (c.itens || []).forEach(function (it) {
      if (it.tipo === 'compensacao_bh') return;
      if (it.inicioH >= 13) t = false; else m = false;
    });
    var comp = Number(c.compH || 0);
    if (comp >= diaH * 0.99) { m = false; t = false; }
    else if (comp >= diaH / 2 - 0.01) { if (m) m = false; else t = false; }
    return [m, t];
  }
  function primeiroLivre(s, cred) {
    for (var i = 0; i < 1000; i++) { if (livres(s.d, cred)[s.p]) return s; s = proximo(s); }
    return s;
  }

  /* itens: prioridades PENDENTES na ordem da fila (sem radar).
     Retorna { [id]: { ini, fim, blocos, atual, atrasada, semPrevisao } } */
  function calcular(itens, cred) {
    var hoje = agora(), cursor = hoje, out = {};
    (itens || []).forEach(function (it, idx) {
      var n = Math.max(0, Math.round(Number(it.blocos_previstos || 0)));
      var ini = cursor;
      if (idx === 0 && it.inicio_fila) ini = { d: String(it.inicio_fila).slice(0, 10), p: 0 };
      if (it.data_inicio) {
        var lib = { d: String(it.data_inicio).slice(0, 10), p: 0 };
        if (antes(ini, lib)) ini = lib;
      }
      ini = primeiroLivre(ini, cred);
      if (!n) { out[it.id] = { ini: ini, fim: null, blocos: 0, atual: idx === 0, atrasada: false, semPrevisao: true }; return; }
      var s = ini, fim = ini;
      for (var k = 1; k < n; k++) { s = primeiroLivre(proximo(s), cred); fim = s; }
      var atrasada = antes(fim, hoje) && !(fim.d === hoje.d && fim.p === hoje.p);
      out[it.id] = { ini: ini, fim: fim, blocos: n, atual: idx === 0, atrasada: atrasada, semPrevisao: false };
      var prox = proximo(fim);
      cursor = antes(prox, hoje) ? hoje : prox;
    });
    return out;
  }

  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function fmt(s, comPeriodo) {
    if (!s) return '';
    var d = new Date(s.d + 'T12:00:00');
    var txt = DIAS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    return comPeriodo === false ? txt : txt + (s.p === 0 ? ' manhã' : ' tarde');
  }
  /* "seg 03/11 manhã → qua 05/11 tarde" */
  function faixa(r) {
    if (!r) return '';
    if (r.semPrevisao) return 'a partir de ' + fmt(r.ini);
    return fmt(r.ini) + ' → ' + fmt(r.fim);
  }
  /* Créditos de um intervalo amplo para a fila (de 30 dias atrás a 1 ano à frente) */
  function carregarCreditos(sb, usuarioId, nucleoId) {
    if (!window.ExpHorasCredito) return Promise.resolve(null);
    var hoje = isoLocal(new Date());
    return window.ExpHorasCredito.carregar(sb, usuarioId, addDia(hoje, -60), addDia(hoje, 365), { nucleoId: nucleoId })
      .then(function (c) { return c; }, function () { return null; });
  }

  window.ExpFila = { calcular: calcular, fmt: fmt, faixa: faixa, carregarCreditos: carregarCreditos, hoje: function () { return isoLocal(new Date()); } };
})();
