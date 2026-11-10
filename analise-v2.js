/* ════════════════════════════════════════════════════════════════════
   EXP · Análise (v2) — plano-nova-analise.md (10/11/2026)
   ────────────────────────────────────────────────────────────────────
   Acompanhar todos os projetos juntos, com as MESMAS contas do card
   Resultado do projeto (Gestão):
   • previsto  = % custo da etapa × valor contratado
   • realizado = horas × valor/hora vigente na data + custos diretos
   • margem e médias só do que já foi concluído (sem projeção)
   • cores: verde > 15%, amarelo 5–15%, terracota < 5%

   Abas: Projetos ativos · Etapas ativas · Histórico · Cadastro pendente
         · Por pessoa (só gestor da plataforma)
   Acesso: sócios e sócios-administradores.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Tipos padrão de etapa (classificação pelo nome, nada é gravado) ── */
  var TIPOS = [
    { key: 'start_briefing', label: 'Start + Briefing' },
    { key: 'ec',             label: 'Estudo conceitual' },
    { key: 'ep',             label: 'Estudo preliminar' },
    { key: 'ajustado',       label: 'Estudo ajustado' },
    { key: 'ap',             label: 'Anteprojeto' },
    { key: 'pre_exec',       label: 'Pré-executivo' },
    { key: 'exec',           label: 'Projeto executivo' },
    { key: 'det',            label: 'Detalhamento' },
    { key: 'lo',             label: 'Liberado obra' },
    { key: 'ajustes',        label: 'Ajustes remanescentes' },
  ];
  var TIPO_LABEL = {};
  TIPOS.forEach(function (t) { TIPO_LABEL[t.key] = t.label; });
  TIPO_LABEL.fora = 'Fora do padrão';

  function normNome(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* Devolve a chave do tipo padrão ou 'fora'. Etapas combinadas ("Briefing + EC") ficam fora. */
  function tipoEtapa(nome) {
    // "(A)", "(B+C)" são produtos do projeto, não etapas combinadas
    var n = normNome(String(nome || '').replace(/\([^)]*\)/g, ' '));
    if (!n) return 'fora';
    if (/^(start|kickoff)\s*\+\s*briefing$/.test(n)) return 'start_briefing';
    if (n.indexOf('+') !== -1) return 'fora';
    if (/^(start|briefing)\b/.test(n)) return 'start_briefing';
    if (/^ajustes? remanescentes?\b/.test(n)) return 'ajustes';
    if (/^liberad[oa]\b/.test(n) || /^lo\b/.test(n)) return 'lo';
    if (/^detalhamentos?\b/.test(n) || /^det\b/.test(n)) return 'det';
    if (/^pre[- ]?executivo\b/.test(n) || /^ppe\b/.test(n)) return 'pre_exec';
    if (/^projeto executivo\b/.test(n) || /^pe\d*\b/.test(n)) return 'exec';
    if (/^anteprojeto\b/.test(n) || /^ap\d*\b/.test(n)) return 'ap';
    if (/^estudo ajustado\b/.test(n) || /^ep2\b/.test(n) || /^ep\b.*\bajust/.test(n)) return 'ajustado';
    if (/^estudo preliminar\b/.test(n) || /^ep\d*\b/.test(n)) return 'ep';
    if (/^estudo conceitual\b/.test(n) || /^conceituacao\b/.test(n) || /^ec\d*\b/.test(n)) return 'ec';
    return 'fora';
  }

  /* ── Estado ── */
  var AV = {
    aba: 'projetos',
    carregando: false,
    erro: null,
    usuario: null,
    produtos: [], etapas: [], horas: [], custos: [], vh: {}, usuarios: [],
    dados: null,
    filtro: { projetos: null, etapas: null, cliente: '', agrupar: 'tipo', pessoaAno: '' },
  };
  window.AV = AV;

  var HOJE = new Date().toISOString().slice(0, 10);

  /* ── Utilitários ── */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fR(v) { return 'R$ ' + (typeof fmtNum === 'function' ? fmtNum(v || 0) : Math.round(v || 0).toLocaleString('pt-BR')); }
  function fPc(v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + '%'; }
  function fHrs(h) { return typeof fmtH === 'function' ? fmtH(h || 0) : (Math.round((h || 0) * 10) / 10) + 'h'; }
  function fD(iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
  function dias(a, b) { return Math.round((new Date(String(b).slice(0, 10) + 'T12:00:00') - new Date(String(a).slice(0, 10) + 'T12:00:00')) / 86400000); }
  function corMargem(m) { return m == null || isNaN(m) ? 'var(--txt-3)' : m > 15 ? 'var(--verde)' : m >= 5 ? 'var(--ouro)' : 'var(--terracota)'; }
  function corConsumo(u) { return u == null ? 'var(--txt-3)' : u > 100 ? 'var(--terracota)' : u >= 85 ? 'var(--ouro)' : 'var(--txt-2)'; }
  function horasDe(l) { return typeof diffHoras === 'function' ? diffHoras(l.hora_inicio, l.hora_fim) : 0; }
  function fixTxt(v) {
    if (!v) return v;
    return String(v).replace(/Ã§/g, 'ç').replace(/Ã£/g, 'ã').replace(/Ã©/g, 'é').replace(/Ã³/g, 'ó').replace(/Ã´/g, 'ô')
      .replace(/Ãµ/g, 'õ').replace(/Ã¢/g, 'â').replace(/Ã­/g, 'í').replace(/Ãº/g, 'ú').replace(/Ã¡/g, 'á').replace(/Ãª/g, 'ê');
  }
  function nomeUsuario(id) {
    var u = AV.usuarios.find(function (x) { return String(x.id) === String(id); });
    if (!u) return 'Usuário removido';
    var p = String(u.nome || '').trim().split(/\s+/);
    return p.length <= 2 ? p.join(' ') : p[0] + ' ' + p[p.length - 1];
  }

  /* Busca todas as linhas (o Supabase devolve no máximo 1.000 por consulta) */
  async function buscarTudo(tabela, colunas, ordem) {
    var sb = window.sb, out = [], de = 0, PASSO = 1000;
    for (;;) {
      var r = await sb.from(tabela).select(colunas).order(ordem || 'id', { ascending: true }).range(de, de + PASSO - 1);
      if (r.error) throw new Error('Falha ao carregar ' + tabela + ': ' + r.error.message);
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < PASSO) break;
      de += PASSO;
    }
    return out;
  }

  /* Valor/hora vigente na data (mesma regra da Gestão: no mesmo dia vale o último cadastrado) */
  function montarHistVH(rows) {
    var porUser = {};
    rows.slice().sort(function (a, b) {
      var d = String(b.data_vigencia || '').localeCompare(String(a.data_vigencia || ''));
      return d || String(b.created_at || b.id || '').localeCompare(String(a.created_at || a.id || ''));
    }).forEach(function (v) {
      (porUser[v.usuario_id] = porUser[v.usuario_id] || []).push({ data: String(v.data_vigencia || '').slice(0, 10), valor: Number(v.valor_hora) || 0 });
    });
    return porUser;
  }
  function vhNaData(uid, dataIso) {
    var lista = AV.vh[uid];
    if (!lista || !lista.length) return 0;
    var d = String(dataIso || '').slice(0, 10);
    var e = lista.find(function (x) { return x.data <= d; });
    return e ? e.valor : lista[lista.length - 1].valor;
  }

  /* ── Carga ── */
  async function carregar() {
    AV.carregando = true; AV.erro = null; render();
    try {
      var sb = window.sb;
      var res = await Promise.all([
        sb.from('produtos').select('*, oportunidades(projeto, clientes(nome))'),
        buscarTudo('etapas', 'id, produto_id, nome, ordem, status, percentual_custo, data_liberacao, data_estimada, data_conclusao'),
        buscarTudo('horas_lancadas', 'id, produto_id, etapa_id, usuario_id, hora_inicio, hora_fim, data_lancamento'),
        buscarTudo('lancamentos_custo', 'id, produto_id, etapa_id, valor'),
        buscarTudo('historico_valor_hora', '*', 'data_vigencia'),
        sb.from('usuarios').select('id, nome, ativo'),
      ]);
      if (res[0].error) throw new Error('Falha ao carregar produtos: ' + res[0].error.message);
      AV.produtos = (res[0].data || []).filter(function (p) { return p.em_gestao !== false; }).map(function (p) {
        var c = p.oportunidades && p.oportunidades.clientes;
        return Object.assign({}, p, { nome: fixTxt((p.oportunidades && p.oportunidades.projeto) || p.nome) || '(sem nome)', cliente: fixTxt(c && c.nome) || 'Sem cliente' });
      });
      AV.etapas = res[1]; AV.horas = res[2]; AV.custos = res[3];
      AV.vh = montarHistVH(res[4]);
      AV.usuarios = res[5].data || [];
      agregar();
      var sub = document.getElementById('analise-user-context');
      if (sub) {
        var hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        sub.textContent = AV.dados.ativos.length + ' projetos ativos · ' + AV.dados.etapasAtivas.length + ' etapas em andamento · Atualizado às ' + hhmm;
      }
    } catch (e) {
      AV.erro = e && e.message || 'Não foi possível carregar os dados.';
    }
    AV.carregando = false;
    render();
  }

  /* ── Agregação (mesmas contas do Resultado do projeto) ── */
  function agregar() {
    var prodPorId = {};
    AV.produtos.forEach(function (p) { prodPorId[p.id] = p; });

    var porEtapa = {}, semEtapa = {}, porPessoa = {};
    function pe(id) { return porEtapa[id] || (porEtapa[id] = { horas: 0, custoH: 0, custoL: 0, pessoas: {}, nLanc: 0 }); }
    var semVH = {};

    AV.horas.forEach(function (l) {
      if (!prodPorId[l.produto_id]) return;
      var h = horasDe(l);
      var vh = vhNaData(l.usuario_id, l.data_lancamento);
      if (!vh && l.usuario_id) semVH[l.usuario_id] = (semVH[l.usuario_id] || 0) + h;
      var c = h * vh;
      var pp = porPessoa[l.usuario_id] || (porPessoa[l.usuario_id] = { horas: 0, custo: 0, projetos: {}, porAno: {} });
      pp.horas += h; pp.custo += c; pp.projetos[l.produto_id] = true;
      var ano = String(l.data_lancamento || '').slice(0, 4) || '—';
      var pa = pp.porAno[ano] || (pp.porAno[ano] = { horas: 0, custo: 0, projetos: {} });
      pa.horas += h; pa.custo += c; pa.projetos[l.produto_id] = true;
      if (!l.etapa_id) { semEtapa[l.produto_id] = (semEtapa[l.produto_id] || 0) + c; return; }
      var d = pe(l.etapa_id);
      d.horas += h; d.custoH += c; d.nLanc++;
      var x = d.pessoas[l.usuario_id] || (d.pessoas[l.usuario_id] = { horas: 0, custo: 0 });
      x.horas += h; x.custo += c;
    });
    AV.custos.forEach(function (c) {
      if (!prodPorId[c.produto_id]) return;
      var v = Math.abs(parseFloat(c.valor) || 0);
      if (!c.etapa_id) { semEtapa[c.produto_id] = (semEtapa[c.produto_id] || 0) + v; return; }
      pe(c.etapa_id).custoL += v;
    });

    var etapasPorProd = {};
    AV.etapas.forEach(function (e) {
      var p = prodPorId[e.produto_id];
      if (!p) return;
      var valor = Number(p.valor_contratado) || 0;
      var pct = e.percentual_custo != null && e.percentual_custo !== '' ? parseFloat(e.percentual_custo) : null;
      var previsto = pct != null && valor > 0 ? (pct / 100) * valor : null;
      var d = porEtapa[e.id] || { horas: 0, custoH: 0, custoL: 0, pessoas: {}, nLanc: 0 };
      var realizado = d.custoH + d.custoL;
      var conc = e.status === 'concluida';
      var ativa = e.status === 'em_andamento' || e.status === 'em_revisao';
      var diasPrev = e.data_liberacao && e.data_estimada ? dias(e.data_liberacao, e.data_estimada) : null;
      var diasReal = e.data_liberacao && e.data_conclusao ? dias(e.data_liberacao, e.data_conclusao) : null;
      var atraso = null;
      if (conc && diasPrev != null && diasReal != null) atraso = diasReal - diasPrev;
      else if (!conc && e.data_estimada && e.status !== 'nao_iniciada') { var a = dias(e.data_estimada, HOJE); atraso = a > 0 ? a : 0; }
      var top = Object.keys(d.pessoas).sort(function (a, b) { return d.pessoas[b].horas - d.pessoas[a].horas; })[0];
      var reg = {
        etapa: e, produto: p, tipo: tipoEtapa(e.nome), pct: pct, previsto: previsto,
        horas: d.horas, custoH: d.custoH, custoL: d.custoL, realizado: realizado, nLanc: d.nLanc,
        saldo: previsto != null ? previsto - realizado : null,
        margem: previsto > 0 ? ((previsto - realizado) / previsto) * 100 : null,
        consumo: previsto > 0 ? (realizado / previsto) * 100 : null,
        conc: conc, ativa: ativa, atraso: atraso,
        diasLib: e.data_liberacao ? dias(e.data_liberacao, conc && e.data_conclusao ? e.data_conclusao : HOJE) : null,
        maisHoras: top ? nomeUsuario(top) : '',
      };
      (etapasPorProd[e.produto_id] = etapasPorProd[e.produto_id] || []).push(reg);
    });

    var projetos = AV.produtos.map(function (p) {
      var ets = (etapasPorProd[p.id] || []).sort(function (a, b) { return (Number(a.etapa.ordem) || 0) - (Number(b.etapa.ordem) || 0); });
      var concl = ets.filter(function (r) { return r.conc && r.previsto > 0; });
      var cp = concl.reduce(function (s, r) { return s + r.previsto; }, 0);
      var cr = concl.reduce(function (s, r) { return s + r.realizado; }, 0);
      var atual = ets.find(function (r) { return r.ativa; }) || ets.find(function (r) { return !r.conc && r.etapa.status !== 'nao_iniciada' && r.etapa.status !== 'pausada'; }) || null;
      var nConc = ets.filter(function (r) { return r.conc; }).length;
      var todasConc = ets.length > 0 && nConc === ets.length;
      var atrasado = ets.some(function (r) { return !r.conc && r.atraso > 0; });
      var margemAgora = cp > 0 ? ((cp - cr) / cp) * 100 : null;
      var estouro = !!(atual && atual.consumo > 100);
      return {
        produto: p, etapas: ets, atual: atual, nConc: nConc, todasConc: todasConc,
        margemAgora: margemAgora, saldoAgora: cp - cr, nConcComPrev: concl.length,
        realizado: ets.reduce(function (s, r) { return s + r.realizado; }, 0),
        previsto: ets.reduce(function (s, r) { return s + (r.previsto || 0); }, 0),
        atrasado: atrasado, estouro: estouro,
        problema: (margemAgora != null && margemAgora < 5) || estouro || atrasado,
        semEtapa: semEtapa[p.id] || 0,
      };
    });

    var ativos = projetos.filter(function (x) {
      var st = String(x.produto.status || 'ativo').toLowerCase();
      return st === 'ativo' && x.etapas.length && !x.todasConc;
    });
    var etapasAtivas = [];
    ativos.forEach(function (x) { x.etapas.forEach(function (r) { if (r.ativa) etapasAtivas.push(r); }); });

    /* Histórico: só etapas concluídas, de tipo padrão e com previsto (cadastro completo) */
    var historico = [];
    var foraExcluidas = 0, semPrevExcluidas = 0;
    projetos.forEach(function (x) {
      x.etapas.forEach(function (r) {
        if (!r.conc) return;
        if (r.tipo === 'fora') { foraExcluidas++; return; }
        if (!(r.previsto > 0)) { semPrevExcluidas++; return; }
        historico.push(r);
      });
    });
    var encerrados = projetos.filter(function (x) {
      return x.etapas.length && (x.todasConc || String(x.produto.status || '').toLowerCase() === 'encerrado');
    });

    /* Cadastro pendente */
    var pendentes = [];
    projetos.forEach(function (x) {
      var p = x.produto, m = [];
      if (!(Number(p.valor_contratado) > 0)) m.push('Sem valor contratado');
      if (!x.etapas.length) m.push('Sem etapas cadastradas');
      var semPct = x.etapas.filter(function (r) { return r.pct == null; }).length;
      if (semPct) m.push(semPct === x.etapas.length ? 'Nenhuma etapa com % custo' : semPct + (semPct === 1 ? ' etapa sem % custo' : ' etapas sem % custo'));
      else if (x.etapas.length) {
        var soma = x.etapas.reduce(function (s, r) { return s + (r.pct || 0); }, 0);
        if (Math.abs(soma - 100) > 0.5) m.push('% custo soma ' + String(Math.round(soma * 10) / 10).replace('.', ',') + '%');
      }
      var concSemData = x.etapas.filter(function (r) { return r.conc && !r.etapa.data_conclusao; }).length;
      if (concSemData) m.push(concSemData + (concSemData === 1 ? ' etapa concluída sem data de conclusão' : ' etapas concluídas sem data de conclusão'));
      var semDatas = x.etapas.filter(function (r) { return r.etapa.status !== 'nao_iniciada' && (!r.etapa.data_liberacao || !r.etapa.data_estimada); }).length;
      if (semDatas) m.push(semDatas + (semDatas === 1 ? ' etapa iniciada sem liberação ou previsão' : ' etapas iniciadas sem liberação ou previsão'));
      var concSemHoras = x.etapas.filter(function (r) { return r.conc && !r.nLanc; }).length;
      if (concSemHoras) m.push(concSemHoras + (concSemHoras === 1 ? ' etapa concluída sem horas lançadas' : ' etapas concluídas sem horas lançadas'));
      if (x.semEtapa > 0.009) m.push(fR(x.semEtapa) + ' em horas ou custos sem etapa');
      if (m.length) pendentes.push({ projeto: x, motivos: m });
    });
    var pessoasSemVH = Object.keys(semVH).map(function (id) { return { nome: nomeUsuario(id), horas: semVH[id] }; })
      .sort(function (a, b) { return b.horas - a.horas; });

    AV.dados = {
      projetos: projetos, ativos: ativos, etapasAtivas: etapasAtivas, historico: historico, encerrados: encerrados,
      foraExcluidas: foraExcluidas, semPrevExcluidas: semPrevExcluidas, pendentes: pendentes,
      pessoasSemVH: pessoasSemVH, porPessoa: porPessoa,
    };
  }

  /* ── Render ── */
  function podeVerPessoas() { return !!(AV.usuario && AV.usuario.is_platform_manager); }

  function abas() {
    var d = AV.dados;
    var lista = [
      ['projetos', 'Projetos ativos', d ? d.ativos.length : null],
      ['etapas', 'Etapas ativas', d ? d.etapasAtivas.length : null],
      ['historico', 'Histórico', null],
      ['cadastro', 'Cadastro pendente', d ? d.pendentes.length : null],
    ];
    if (podeVerPessoas()) lista.push(['pessoas', 'Por pessoa', null]);
    return lista.map(function (a) {
      return '<button class="analise-tab' + (AV.aba === a[0] ? ' active' : '') + '" type="button" onclick="AnaliseV2.aba(\'' + a[0] + '\')">' +
        a[1] + (a[2] != null ? ' <span class="av-tab-n">' + a[2] + '</span>' : '') + '</button>';
    }).join('');
  }

  function linkProjeto(id) { return 'AnaliseV2.abrir(\'' + String(id).replace(/'/g, "\\'") + '\')'; }

  function kpi(valor, rotulo, opts) {
    opts = opts || {};
    return '<div class="av-kpi' + (opts.on ? ' on' : '') + (opts.click ? ' clic' : '') + '"' + (opts.click ? ' onclick="' + opts.click + '"' : '') + '>' +
      '<b' + (opts.cor ? ' style="color:' + opts.cor + '"' : '') + '>' + valor + '</b><span>' + rotulo + '</span></div>';
  }

  function barra(pct, cor) {
    return '<div class="av-bar"><i style="width:' + Math.max(0, Math.min(pct || 0, 100)) + '%;background:' + cor + '"></i></div>';
  }

  function renderProjetos() {
    var d = AV.dados, f = AV.filtro.projetos;
    var L = d.ativos.filter(function (x) {
      return !f || (f === 'prob' ? x.problema : f === 'est' ? x.estouro : f === 'atr' ? x.atrasado : true);
    }).sort(function (a, b) {
      return (b.problema - a.problema) || ((a.margemAgora == null ? 999 : a.margemAgora) - (b.margemAgora == null ? 999 : b.margemAgora));
    });
    var tg = function (k) { return 'AnaliseV2.filtrar(\'projetos\',\'' + k + '\')'; };
    var html = '<div class="av-kpis">' +
      kpi(d.ativos.filter(function (x) { return x.problema; }).length, 'projetos com problema', { click: tg('prob'), on: f === 'prob', cor: 'var(--terracota)' }) +
      kpi(d.ativos.filter(function (x) { return x.estouro; }).length, 'com etapa atual estourada', { click: tg('est'), on: f === 'est' }) +
      kpi(d.ativos.filter(function (x) { return x.atrasado; }).length, 'com etapa atrasada', { click: tg('atr'), on: f === 'atr' }) +
      kpi(d.ativos.length, 'projetos ativos', { click: f ? tg(f) : '', on: false }) +
      '</div>';
    if (!L.length) return html + '<div class="av-vazio">Nenhum projeto nesta seleção.</div>';
    html += '<div class="av-card"><table class="av-tb">' +
      '<colgroup><col style="width:29%"><col style="width:22%"><col style="width:9%"><col style="width:14%"><col style="width:18%"><col style="width:8%"></colgroup>' +
      '<tr><th>Projeto</th><th>Etapa atual</th><th>Etapas</th><th class="n">Margem até agora</th><th>Consumo da etapa atual</th><th class="n">Sinais</th></tr>' +
      L.map(function (x) {
        var a = x.atual;
        var sin = [
          ['Margem', x.margemAgora != null && x.margemAgora < 5],
          ['Etapa estourada', x.estouro],
          ['Atraso', x.atrasado],
        ].map(function (s) { return '<i class="av-dot" title="' + s[0] + (s[1] ? ': atenção' : ': ok') + '" style="background:' + (s[1] ? 'var(--terracota)' : 'var(--cinza)') + '"></i>'; }).join('');
        return '<tr class="l" onclick="' + linkProjeto(x.produto.id) + '">' +
          '<td><b>' + esc(x.produto.nome) + '</b><em>' + esc(x.produto.cliente) + (x.produto.nucleo ? ' · ' + esc(x.produto.nucleo) : '') + '</em></td>' +
          '<td>' + (a ? esc(a.etapa.nome) + (a.atraso > 0 ? '<em class="ruim">' + a.atraso + ' dias de atraso</em>' : '') : '<em>Nenhuma em andamento</em>') + '</td>' +
          '<td class="mut">' + x.nConc + '/' + x.etapas.length + '</td>' +
          '<td class="n" style="color:' + corMargem(x.margemAgora) + '">' + (x.margemAgora != null ? fPc(x.margemAgora) : '—') + '</td>' +
          '<td>' + (a && a.consumo != null ? barra(a.consumo, corConsumo(a.consumo)) + '<em style="color:' + corConsumo(a.consumo) + '">' + Math.round(a.consumo) + '% do previsto</em>' : '<em>sem previsto</em>') + '</td>' +
          '<td class="n">' + sin + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="av-nota">Margem até agora considera só as etapas concluídas ("—" = nenhuma concluída com previsto). Projeto com problema: margem até agora abaixo de 5%, etapa atual acima de 100% do previsto ou etapa atrasada. Clique para abrir o projeto.</div>';
    return html;
  }

  function renderEtapas() {
    var d = AV.dados, f = AV.filtro.etapas;
    var E = d.etapasAtivas;
    var L = E.filter(function (r) {
      return !f || (f === 'est' ? r.consumo > 100 : f === 'lim' ? (r.consumo >= 85 && r.consumo <= 100) : f === 'atr' ? r.atraso > 0 : true);
    }).sort(function (a, b) { return (b.consumo == null ? -1 : b.consumo) - (a.consumo == null ? -1 : a.consumo); });
    var tg = function (k) { return 'AnaliseV2.filtrar(\'etapas\',\'' + k + '\')'; };
    var html = '<div class="av-kpis">' +
      kpi(E.filter(function (r) { return r.consumo > 100; }).length, 'acima do previsto', { click: tg('est'), on: f === 'est', cor: 'var(--terracota)' }) +
      kpi(E.filter(function (r) { return r.consumo >= 85 && r.consumo <= 100; }).length, 'perto do limite (85%+)', { click: tg('lim'), on: f === 'lim', cor: 'var(--ouro)' }) +
      kpi(E.filter(function (r) { return r.atraso > 0; }).length, 'atrasadas', { click: tg('atr'), on: f === 'atr' }) +
      kpi(E.length, 'etapas em andamento', { click: f ? tg(f) : '' }) +
      '</div>';
    if (!L.length) return html + '<div class="av-vazio">Nenhuma etapa nesta seleção.</div>';
    html += '<div class="av-card"><table class="av-tb">' +
      '<colgroup><col style="width:30%"><col style="width:12%"><col style="width:12%"><col style="width:20%"><col style="width:12%"><col style="width:14%"></colgroup>' +
      '<tr><th>Etapa · projeto</th><th class="n">Previsto</th><th class="n">Realizado</th><th>Consumo</th><th>Prazo</th><th>Mais horas</th></tr>' +
      L.map(function (r) {
        return '<tr class="l" onclick="' + linkProjeto(r.produto.id) + '">' +
          '<td><b>' + esc(r.etapa.nome) + '</b><em>' + esc(r.produto.nome) + '</em></td>' +
          '<td class="n">' + (r.previsto != null ? fR(r.previsto) : '—') + '</td>' +
          '<td class="n">' + fR(r.realizado) + '</td>' +
          '<td>' + (r.consumo != null ? barra(r.consumo, corConsumo(r.consumo)) + '<em style="color:' + corConsumo(r.consumo) + '">' + Math.round(r.consumo) + '%</em>' : '<em>sem previsto</em>') + '</td>' +
          '<td class="mut">' + (r.diasLib != null ? r.diasLib + ' dias' : '—') + (r.atraso > 0 ? '<em class="ruim">+' + r.atraso + ' de atraso</em>' : '') + '</td>' +
          '<td class="mut">' + esc(r.maisHoras || '—') + (r.horas ? '<em>' + fHrs(r.horas) + ' no total</em>' : '') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="av-nota">Etapa em andamento ainda não tem margem: a barra mostra quanto do previsto já foi gasto. Amarelo a partir de 85%, terracota acima de 100%.</div>';
    return html;
  }

  function renderHistorico() {
    var d = AV.dados, cli = AV.filtro.cliente, grp = AV.filtro.agrupar;
    var H = d.historico.filter(function (r) { return !cli || r.produto.cliente === cli; });
    var clientes = Array.from(new Set(d.historico.map(function (r) { return r.produto.cliente; }))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    var sp = H.reduce(function (s, r) { return s + r.previsto; }, 0);
    var sr = H.reduce(function (s, r) { return s + r.realizado; }, 0);
    var sh = H.reduce(function (s, r) { return s + r.horas; }, 0);
    var comAtraso = H.filter(function (r) { return r.atraso != null; });
    var atrMed = comAtraso.length ? comAtraso.reduce(function (s, r) { return s + Math.max(0, r.atraso); }, 0) / comAtraso.length : null;
    var m = sp > 0 ? ((sp - sr) / sp) * 100 : null;

    var g = {};
    H.forEach(function (r) {
      var k = grp === 'tipo' ? r.tipo : grp === 'nucleo' ? (r.produto.nucleo || 'Sem núcleo') : grp === 'ano' ? (String(r.etapa.data_conclusao || '').slice(0, 4) || 'Sem data') : r.produto.cliente;
      var x = g[k] || (g[k] = { pv: 0, r: 0, h: 0, n: 0, atr: 0, nAtr: 0 });
      x.pv += r.previsto; x.r += r.realizado; x.h += r.horas; x.n++;
      if (r.atraso != null) { x.atr += Math.max(0, r.atraso); x.nAtr++; }
    });
    var chaves = Object.keys(g);
    if (grp === 'tipo') chaves.sort(function (a, b) { return TIPOS.findIndex(function (t) { return t.key === a; }) - TIPOS.findIndex(function (t) { return t.key === b; }); });
    else if (grp === 'ano') chaves.sort(function (a, b) { return b.localeCompare(a); });
    else chaves.sort(function (a, b) { return ((g[a].pv - g[a].r) / g[a].pv) - ((g[b].pv - g[b].r) / g[b].pv); });
    var rot = { tipo: 'Tipo de etapa', nucleo: 'Núcleo', ano: 'Ano de conclusão', cliente: 'Cliente' };

    var html = '<div class="av-filtros">' +
      '<label class="av-lb">Cliente</label><select onchange="AnaliseV2.set(\'cliente\', this.value)"><option value="">Todos</option>' +
      clientes.map(function (c) { return '<option' + (c === cli ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<label class="av-lb">Agrupar por</label><select onchange="AnaliseV2.set(\'agrupar\', this.value)">' +
      Object.keys(rot).map(function (k) { return '<option value="' + k + '"' + (k === grp ? ' selected' : '') + '>' + rot[k] + '</option>'; }).join('') + '</select></div>';
    html += '<div class="av-kpis">' +
      kpi(m != null ? fPc(m) : '—', 'margem média ponderada', { cor: corMargem(m) }) +
      kpi(H.length, 'etapas concluídas analisadas') +
      kpi(fR(sr), 'realizado · ' + fHrs(sh)) +
      kpi(atrMed != null ? String(Math.round(atrMed * 10) / 10).replace('.', ',') + ' dias' : '—', 'atraso médio') +
      '</div>';
    if (!H.length) {
      html += '<div class="av-vazio">Nenhuma etapa concluída com cadastro completo' + (cli ? ' para este cliente' : '') + '.</div>';
    } else {
      html += '<div class="av-card"><table class="av-tb">' +
        '<colgroup><col style="width:28%"><col style="width:9%"><col style="width:15%"><col style="width:15%"><col style="width:10%"><col style="width:11%"><col style="width:12%"></colgroup>' +
        '<tr><th>' + rot[grp] + '</th><th class="n">Etapas</th><th class="n">Previsto</th><th class="n">Realizado</th><th class="n">Horas</th><th class="n">Margem</th><th class="n">Atraso médio</th></tr>' +
        chaves.map(function (k) {
          var x = g[k], mm = x.pv > 0 ? ((x.pv - x.r) / x.pv) * 100 : null;
          return '<tr><td><b>' + esc(grp === 'tipo' ? TIPO_LABEL[k] : k) + '</b></td><td class="n">' + x.n + '</td><td class="n">' + fR(x.pv) + '</td><td class="n">' + fR(x.r) + '</td>' +
            '<td class="n mut">' + fHrs(x.h) + '</td><td class="n" style="color:' + corMargem(mm) + '">' + (mm != null ? fPc(mm) : '—') + '</td>' +
            '<td class="n mut">' + (x.nAtr ? String(Math.round(x.atr / x.nAtr * 10) / 10).replace('.', ',') + ' dias' : '—') + '</td></tr>';
        }).join('') + '</table></div>';
    }
    var excl = [];
    if (d.foraExcluidas) excl.push(d.foraExcluidas + (d.foraExcluidas === 1 ? ' etapa concluída' : ' etapas concluídas') + ' fora do padrão (ex.: RRT, etapas combinadas)');
    if (d.semPrevExcluidas) excl.push(d.semPrevExcluidas + (d.semPrevExcluidas === 1 ? ' etapa concluída' : ' etapas concluídas') + ' sem previsto (veja Cadastro pendente)');
    html += '<div class="av-nota">Só etapas concluídas, de tipo padrão e com previsto. Margem ponderada = (soma do previsto − soma do realizado) ÷ soma do previsto.' +
      (excl.length ? ' Ficaram de fora: ' + excl.join('; ') + '.' : '') + '</div>';

    var enc = d.encerrados.filter(function (x) { return !cli || x.produto.cliente === cli; })
      .sort(function (a, b) { return (a.margemAgora == null ? 999 : a.margemAgora) - (b.margemAgora == null ? 999 : b.margemAgora); });
    html += '<div class="av-sec-hd"><span class="av-lb">Projetos encerrados</span><span class="mut">' + enc.length + '</span></div>';
    if (!enc.length) html += '<div class="av-vazio">Nenhum projeto encerrado' + (cli ? ' para este cliente' : '') + '.</div>';
    else html += '<div class="av-card"><table class="av-tb">' +
      '<colgroup><col style="width:34%"><col style="width:22%"><col style="width:15%"><col style="width:15%"><col style="width:14%"></colgroup>' +
      '<tr><th>Projeto</th><th>Cliente</th><th class="n">Previsto</th><th class="n">Realizado</th><th class="n">Margem final</th></tr>' +
      enc.map(function (x) {
        return '<tr class="l" onclick="' + linkProjeto(x.produto.id) + '"><td><b>' + esc(x.produto.nome) + '</b>' + (x.produto.nucleo ? '<em>' + esc(x.produto.nucleo) + '</em>' : '') + '</td>' +
          '<td class="mut">' + esc(x.produto.cliente) + '</td><td class="n">' + fR(x.previsto) + '</td><td class="n">' + fR(x.realizado) + '</td>' +
          '<td class="n" style="color:' + corMargem(x.margemAgora) + '">' + (x.margemAgora != null ? fPc(x.margemAgora) : '—') + '</td></tr>';
      }).join('') + '</table></div>';
    return html;
  }

  function renderCadastro() {
    var d = AV.dados;
    var P = d.pendentes.slice().sort(function (a, b) {
      var aa = AV.dados.ativos.indexOf(a.projeto) !== -1, bb = AV.dados.ativos.indexOf(b.projeto) !== -1;
      return (bb - aa) || (b.motivos.length - a.motivos.length) || a.projeto.produto.nome.localeCompare(b.projeto.produto.nome, 'pt-BR');
    });
    var html = '<div class="av-kpis">' +
      kpi(P.length, 'projetos com cadastro incompleto', { cor: P.length ? 'var(--terracota)' : '' }) +
      kpi(P.filter(function (x) { return AV.dados.ativos.indexOf(x.projeto) !== -1; }).length, 'deles estão ativos') +
      kpi(d.pessoasSemVH.length, 'pessoas sem valor/hora') +
      '</div>';
    if (d.pessoasSemVH.length) {
      html += '<div class="av-aviso">Horas lançadas por quem não tem valor/hora cadastrado entram com custo zero: ' +
        d.pessoasSemVH.map(function (p) { return '<b>' + esc(p.nome) + '</b> (' + fHrs(p.horas) + ')'; }).join(', ') +
        '. Cadastre em Pessoas › Valor/hora.</div>';
    }
    if (!P.length) return html + '<div class="av-vazio">Todos os projetos têm as informações necessárias para a análise.</div>';
    html += '<div class="av-card"><table class="av-tb">' +
      '<colgroup><col style="width:30%"><col><col style="width:96px"></colgroup>' +
      '<tr><th>Projeto</th><th>O que falta</th><th></th></tr>' +
      P.map(function (x) {
        var p = x.projeto.produto, ativo = AV.dados.ativos.indexOf(x.projeto) !== -1;
        return '<tr><td><b>' + esc(p.nome) + '</b><em>' + esc(p.cliente) + (ativo ? ' · ativo' : '') + '</em></td>' +
          '<td class="quebra">' + x.motivos.map(function (m) { return '<span class="av-chip">' + esc(m) + '</span>'; }).join('') + '</td>' +
          '<td class="n"><button class="btn sm" type="button" onclick="' + linkProjeto(p.id) + '">Corrigir</button></td></tr>';
      }).join('') + '</table></div>' +
      '<div class="av-nota">Projetos ativos primeiro. "Corrigir" abre o projeto na Gestão em outra aba; depois de ajustar, clique em Atualizar aqui.</div>';
    return html;
  }

  function renderPessoas() {
    if (!podeVerPessoas()) return '<div class="av-vazio">Visível só para o gestor da plataforma.</div>';
    var d = AV.dados, ano = AV.filtro.pessoaAno;
    var anos = {};
    Object.keys(d.porPessoa).forEach(function (id) { Object.keys(d.porPessoa[id].porAno).forEach(function (a) { anos[a] = true; }); });
    var rows = Object.keys(d.porPessoa).map(function (id) {
      var x = ano ? d.porPessoa[id].porAno[ano] : d.porPessoa[id];
      return x ? { nome: nomeUsuario(id), horas: x.horas, custo: x.custo, projetos: Object.keys(x.projetos).length } : null;
    }).filter(function (x) { return x && x.horas > 0; }).sort(function (a, b) { return b.custo - a.custo; });
    var tot = rows.reduce(function (s, r) { return s + r.custo; }, 0);
    var html = '<div class="av-filtros"><label class="av-lb">Ano</label><select onchange="AnaliseV2.set(\'pessoaAno\', this.value)"><option value="">Todos</option>' +
      Object.keys(anos).sort().reverse().map(function (a) { return '<option' + (a === ano ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div>';
    if (!rows.length) return html + '<div class="av-vazio">Sem horas lançadas no período.</div>';
    html += '<div class="av-card"><table class="av-tb">' +
      '<colgroup><col style="width:28%"><col style="width:13%"><col style="width:17%"><col style="width:12%"><col></colgroup>' +
      '<tr><th>Pessoa</th><th class="n">Horas</th><th class="n">Custo</th><th class="n">Projetos</th><th>Peso no custo</th></tr>' +
      rows.map(function (r) {
        return '<tr><td><b>' + esc(r.nome) + '</b></td><td class="n">' + fHrs(r.horas) + '</td><td class="n">' + fR(r.custo) + '</td><td class="n mut">' + r.projetos + '</td>' +
          '<td><div class="av-peso">' + barra(tot > 0 ? (r.custo / tot) * 100 : 0, 'var(--txt-2)') + '</div></td></tr>';
      }).join('') + '</table></div>' +
      '<div class="av-nota">Visível só para o gestor da plataforma. Todas as horas lançadas em projetos, com o valor/hora vigente na data de cada lançamento.</div>';
    return html;
  }

  function render() {
    var bar = document.getElementById('analise-tabs-bar');
    var box = document.getElementById('analise-panels');
    if (!bar || !box) return;
    bar.innerHTML = abas();
    if (AV.erro) { box.innerHTML = '<div class="av-aviso">' + esc(AV.erro) + '</div>'; return; }
    if (AV.carregando || !AV.dados) { box.innerHTML = '<div class="loading-state">Carregando projetos, horas e custos…</div>'; return; }
    if (AV.aba === 'pessoas' && !podeVerPessoas()) AV.aba = 'projetos';
    box.innerHTML = AV.aba === 'etapas' ? renderEtapas()
      : AV.aba === 'historico' ? renderHistorico()
      : AV.aba === 'cadastro' ? renderCadastro()
      : AV.aba === 'pessoas' ? renderPessoas()
      : renderProjetos();
  }

  /* ── API para os onclick ── */
  window.AnaliseV2 = {
    aba: function (a) { AV.aba = a; try { sessionStorage.setItem('exp_analise_aba', a); } catch (e) {} render(); },
    filtrar: function (aba, k) { AV.filtro[aba] = AV.filtro[aba] === k ? null : k; render(); },
    set: function (k, v) { AV.filtro[k] = v; render(); },
    abrir: function (id) { window.open('gestao.html?produto=' + encodeURIComponent(id) + '&aba=resultado', '_blank'); },
    recarregar: carregar,
    tipoEtapa: tipoEtapa,
    _agregar: agregar,
    _render: render,
  };

  /* ── Inicialização ── */
  async function iniciar() {
    window.G = window.G || {};
    try {
      var boot = await appShellInit();
      if (!boot) return;
      AV.usuario = boot.usuario || G.usuario;
      if (!isSocioRole((AV.usuario || {}).role)) { window.location.href = 'app.html'; return; }
      try { var a = sessionStorage.getItem('exp_analise_aba'); if (a) AV.aba = a; } catch (e) {}
      var loading = document.getElementById('shell-loading');
      var app = document.getElementById('conteudo');
      if (loading) loading.style.display = 'none';
      if (app) app.style.display = 'flex';
      if (typeof ExpNav !== 'undefined' && typeof ExpNav.init === 'function') ExpNav.init({ module: 'analise' });
      if (typeof listsPanel !== 'undefined') {
        listsPanel.mount({
          getSb: function () { return window.sb; },
          getUser: function () { try { return JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); } catch (e) { return null; } },
          getMembers: function () { return window._listsMembersCache || []; },
          escHtml: window.escHtml,
        });
      }
      document.getElementById('analise-btn-reload')?.addEventListener('click', carregar);
      await carregar();
    } catch (e) {
      AV.erro = e && e.message || 'Erro ao abrir a Análise.';
      var l2 = document.getElementById('shell-loading'), a2 = document.getElementById('conteudo');
      if (l2) l2.style.display = 'none';
      if (a2) a2.style.display = 'flex';
      render();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else queueMicrotask(iniciar);
})();
