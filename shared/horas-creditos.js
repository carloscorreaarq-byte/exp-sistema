/* ════════════════════════════════════════════════════════════════════
   EXP · Horas creditadas (feriados e ausências) — shared/horas-creditos.js
   ────────────────────────────────────────────────────────────────────
   Dias marcados no calendário como feriado/recesso ou como ausência
   remunerada da pessoa contam como horas trabalhadas (jornada/5 por dia útil — 8h numa
   jornada de 40h; meio período = metade) no balanço semanal e mensal.
   Compensações do banco de horas (banco_horas_compensacoes) também creditam
   as horas consumidas naquele dia.

   Usado por apontamentos.html (semana + banco mensal) e gestao.html
   (Horas › semana). Expõe window.ExpHorasCredito.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TIPOS_FERIADO  = ['feriado', 'recesso', 'feriado_local'];
  /* Só ausências remuneradas creditam horas. Ausência NÃO remunerada (ausencia_nrem)
     não conta como hora trabalhada. Aniversário é folga remunerada. */
  var TIPOS_AUSENCIA = ['ausencia_rem', 'ausencia_aniv'];
  var LABEL = {
    feriado: 'Feriado', recesso: 'Recesso', feriado_local: 'Feriado local',
    ausencia_rem: 'Ausência remunerada', ausencia_nrem: 'Ausência', ausencia_aniv: 'Aniversário',
    compensacao_bh: 'Compensação (banco de horas)'
  };
  var COR = '#C0392B';

  function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function eachDay(startIso, endIso, fn) {
    var cur = new Date(startIso + 'T12:00:00'), end = new Date(endIso + 'T12:00:00');
    while (cur <= end) { fn(isoLocal(cur), cur.getDay()); cur.setDate(cur.getDate() + 1); }
  }
  /* O calendário grava manhã às 09h, tarde às 14h e dia todo às 12h */
  function periodoDe(ev) {
    var h = String(ev.inicio || '').slice(11, 13);
    return h === '09' ? 'manha' : (h === '14' ? 'tarde' : 'todo');
  }
  /* Mesma regra de visibilidade do calendario.html */
  function eventoDoUsuario(ev, usuarioId, nucleoId) {
    if (ev.tipo === 'feriado' || ev.tipo === 'recesso') {
      return ev.scope === 'todos' || !ev.scope ||
        (ev.scope === 'nucleo' && (!ev.nucleo_id || String(ev.nucleo_id) === String(nucleoId || ''))) ||
        ev.user_id === usuarioId;
    }
    if (ev.tipo === 'feriado_local') return ev.user_id === usuarioId || ev.criado_por === usuarioId;
    if (ev.tipo === 'ausencia_aniv') return ev.user_id === usuarioId;
    return ev.scope === 'todos' || ev.user_id === usuarioId;
  }

  /* Monta { 'YYYY-MM-DD': { horas, itens:[{label, horas, inicioH}] } } só para dias úteis */
  function calcular(eventos, compensacoes, jornadaSemanalH, startIso, endIso) {
    var diaH = (Number(jornadaSemanalH) || 40) / 5;
    var porDia = {};
    function slot(iso) { return porDia[iso] || (porDia[iso] = { horas: 0, frac: 0, feriado: false, itens: [] }); }

    (eventos || []).forEach(function (ev) {
      var ini = String(ev.inicio || '').slice(0, 10), fim = String(ev.fim || ev.inicio || '').slice(0, 10);
      if (!ini || fim < startIso || ini > endIso) return;
      var ehFeriado = TIPOS_FERIADO.indexOf(ev.tipo) !== -1;
      var periodo = ehFeriado ? 'todo' : periodoDe(ev);
      var frac = periodo === 'todo' ? 1 : 0.5;
      eachDay(ini < startIso ? startIso : ini, fim > endIso ? endIso : fim, function (iso, dow) {
        if (dow === 0 || dow === 6) return;
        var d = slot(iso);
        if (d.feriado) return;                       /* feriado já cobre o dia inteiro */
        if (ehFeriado) { d.feriado = true; d.frac = 1; d.itens = []; }
        else d.frac = Math.min(1, d.frac + frac);
        d.itens.push({ label: ev.titulo || LABEL[ev.tipo] || 'Ausência', tipo: ev.tipo, horas: diaH * frac, inicioH: periodo === 'tarde' ? 13 : 8 });
      });
    });

    (compensacoes || []).forEach(function (c) {
      var iso = String(c.data_uso || '').slice(0, 10);
      if (!iso || iso < startIso || iso > endIso) return;
      var dow = new Date(iso + 'T12:00:00').getDay();
      if (dow === 0 || dow === 6) return;
      var d = slot(iso);
      if (d.feriado) return;
      var h = Number(c.horas_consumidas || 0);
      if (h <= 0) return;
      d.compH = (d.compH || 0) + h;
      d.itens.push({ label: LABEL.compensacao_bh, tipo: 'compensacao_bh', horas: h, inicioH: 8 });
    });

    Object.keys(porDia).forEach(function (iso) {
      var d = porDia[iso];
      d.horas = Math.min(diaH, d.frac * diaH + (d.compH || 0));
      /* Ajusta o último item se a soma passou da jornada do dia */
      var soma = d.itens.reduce(function (s, it) { return s + it.horas; }, 0);
      if (soma > d.horas && d.itens.length) d.itens[d.itens.length - 1].horas -= (soma - d.horas);
      d.itens = d.itens.filter(function (it) { return it.horas > 0.01; });
    });
    return { porDia: porDia, diaH: diaH, jornadaSemanalH: Number(jornadaSemanalH) || 40 };
  }

  /* Busca eventos, compensações e jornada da pessoa e calcula os créditos do intervalo.
     usuarioId = usuarios.id. Falhas em tabelas opcionais resultam em zero crédito. */
  function carregar(sb, usuarioId, startIso, endIso, opts) {
    opts = opts || {};
    var safe = function (p) { return p.then(function (r) { return r; }, function (e) { return { data: null, error: e }; }); };
    return Promise.all([
      safe(sb.from('calendar_events').select('tipo,titulo,inicio,fim,scope,nucleo_id,user_id,criado_por')
        .in('tipo', TIPOS_FERIADO.concat(TIPOS_AUSENCIA))
        .lte('inicio', endIso + 'T23:59:59').gte('fim', startIso + 'T00:00:00')),
      safe(sb.from('banco_horas_compensacoes').select('data_uso,horas_consumidas')
        .eq('usuario_id', usuarioId).gte('data_uso', startIso).lte('data_uso', endIso)),
      opts.jornadaSemanalH != null
        ? Promise.resolve({ data: { jornada_semanal_h: opts.jornadaSemanalH } })
        : safe(sb.from('usuarios_jornada').select('jornada_semanal_h').eq('usuario_id', usuarioId).maybeSingle())
    ]).then(function (res) {
      if (res[0].error) console.warn('[ExpHorasCredito] calendar_events:', res[0].error.message || res[0].error);
      if (res[1].error) console.warn('[ExpHorasCredito] banco_horas_compensacoes:', res[1].error.message || res[1].error);
      var eventos = (res[0].data || []).filter(function (ev) { return eventoDoUsuario(ev, usuarioId, opts.nucleoId); });
      var jornada = Number(res[2].data && res[2].data.jornada_semanal_h) || 40;
      return calcular(eventos, res[1].data || [], jornada, startIso, endIso);
    });
  }

  function total(creditos, startIso, endIso) {
    if (!creditos) return 0;
    return Object.keys(creditos.porDia).reduce(function (s, iso) {
      return (iso >= startIso && iso <= endIso) ? s + creditos.porDia[iso].horas : s;
    }, 0);
  }

  window.ExpHorasCredito = { carregar: carregar, calcular: calcular, total: total, COR: COR, LABEL: LABEL };
})();
