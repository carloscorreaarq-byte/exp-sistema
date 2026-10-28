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
      if (it.fonte === 'banco') return;   /* compensação em horas do banco: tratada abaixo (compH) */
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
     concluidas (opcional): prioridades já concluídas (com concluida_em). Continuam na fila como
     concluídas, do início até o momento da conclusão — e a conclusão da última marca o início
     da próxima pendente.
     Retorna { [id]: { ini, fim, blocos, atual, atrasada, semPrevisao, concluida } } */
  function anterior(s) { return s.p === 1 ? { d: s.d, p: 0 } : { d: addDia(s.d, -1), p: 1 }; }
  function anteriorLivre(s, cred) {
    for (var i = 0; i < 1000; i++) { s = anterior(s); if (livres(s.d, cred)[s.p]) return s; }
    return s;
  }
  /* Meio-período em que algo foi concluído; "cedo" = na primeira metade do período */
  function slotDaConclusao(iso) {
    var d = new Date(iso), h = d.getHours() + d.getMinutes() / 60;
    var p = h >= 13 ? 1 : 0;
    return { s: { d: isoLocal(d), p: p }, cedo: p ? h < 15.5 : h < 10.5 };
  }
  function calcular(itens, cred, concluidas) {
    var hoje = agora(), cursor = hoje, out = {}, ancora = null;
    (concluidas || []).filter(function (c) { return c && c.concluida_em; })
      .sort(function (a, b) { return a.concluida_em < b.concluida_em ? -1 : 1; })
      .forEach(function (c) {
        var cs = slotDaConclusao(c.concluida_em);
        /* concluiu cedo no período: a concluída termina no período anterior e a próxima começa neste */
        var fim = cs.cedo ? anteriorLivre(cs.s, cred) : cs.s;
        var prox = cs.cedo ? cs.s : proximo(cs.s);
        var n = Math.max(1, Math.round(Number(c.blocos_previstos || 0)) || 1);
        var ini;
        if (c.inicio_fila) ini = primeiroLivre({ d: String(c.inicio_fila).slice(0, 10), p: 0 }, cred);
        else { ini = fim; for (var k = 1; k < n; k++) ini = anteriorLivre(ini, cred); }
        if (antes(fim, ini)) fim = ini;
        out[c.id] = { ini: ini, fim: fim, blocos: c.blocos_previstos || 0, atual: false, atrasada: false, semPrevisao: false, concluida: true, concluidaEm: c.concluida_em };
        ancora = prox;
      });
    (itens || []).forEach(function (it, idx) {
      var n = Math.max(0, Math.round(Number(it.blocos_previstos || 0)));
      var ini = cursor;
      if (idx === 0) {
        /* a 1ª pendente começa onde a última concluída terminou; senão, no início marcado (inicio_fila) */
        var marcado = it.inicio_fila ? { d: String(it.inicio_fila).slice(0, 10), p: 0 } : null;
        if (ancora && (!marcado || !antes(ancora, marcado))) {
          ini = ancora;
          /* prioridade criada depois da conclusão: não começa antes de existir */
          var criada = it.created_at ? slotDaConclusao(it.created_at).s : null;
          if (criada && antes(ini, criada)) ini = criada;
        }
        else if (marcado) ini = marcado;
      }
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
    return window.ExpHorasCredito.carregar(sb, usuarioId, addDia(hoje, -60), addDia(hoje, 365), { nucleoId: nucleoId, disponibilidade: true })
      .then(function (c) { return c; }, function () { return null; });
  }

  window.ExpFila = { calcular: calcular, fmt: fmt, faixa: faixa, carregarCreditos: carregarCreditos,
    livres: livres, proximo: proximo, anterior: anterior, antes: antes, addDia: addDia, primeiroLivre: primeiroLivre, agora: agora, isoLocal: isoLocal,
    hoje: function () { return isoLocal(new Date()); } };
})();
