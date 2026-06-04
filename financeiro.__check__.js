// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   SUPABASE INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SB_URL = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
const sb = supabase.createClient(SB_URL, SB_KEY);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   ESTADO GLOBAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const G = {
  usuario: null,
  isSocio: false,
  planoContas: [],
  contasBancarias: [],
  ativos: [],
  lancamentos: [],
  parcelas: [],
  fechamentos: [],
  _mesesFechados: new Set(),
  _gerandoPrevisoes: false,
};

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','MarÃ§o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_ABR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const NUCLEO_MAP = {
  PAIS:   { label: 'Paisagismo',   cls: 'b-pai',   dot: '#45865D' },
  URB:    { label: 'Urbanismo',    cls: 'b-urb',   dot: '#5280CA' },
  CONSUL: { label: 'Consultorias', cls: 'b-consul', dot: '#C36247' },
  ESP:    { label: 'Especiais',    cls: 'b-esp',   dot: '#D19931' },
};

const TIPO_PARCELA_MAP = {
  start:          { label: 'Start',          cls: 'dot-start',   cor: 'var(--azul)' },
  liberacao:      { label: 'LiberaÃ§Ã£o',      cls: 'dot-lib',     cor: 'var(--ouro)' },
  entrega_parcial:{ label: 'Entrega Parcial',cls: 'dot-parcial', cor: 'var(--consul)' },
  conclusao:      { label: 'ConclusÃ£o',      cls: 'dot-conc',    cor: 'var(--verde)' },
  mensalidade:    { label: 'Mensalidade',    cls: 'dot-mensal',  cor: 'var(--fin)' },
  avulso:         { label: 'Avulso',         cls: 'b-gr',        cor: '#888' },
};

const SIT_LANC = {
  previsto:            { label: 'Previsto',             cls: 'b-gr'   },
  entregue:            { label: 'Entregue',             cls: 'b-az'   },
  a_emitir:            { label: 'A Emitir',             cls: 'b-am'   },
  aguardando_pagamento:{ label: 'Aguardando',           cls: 'b-consul'},
  pago:                { label: 'Pago',                 cls: 'b-vd'   },
  a_pagar:             { label: 'A Pagar',              cls: 'b-am'   },
  cancelado:           { label: 'Cancelado',            cls: 'b-tc'   },
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function moeda(v, semSinal=false) {
  if (v === null || v === undefined || v === '') return 'â€”';
  const n = parseFloat(v);
  if (isNaN(n)) return 'â€”';
  const fmt = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Math.abs(n));
  if (semSinal) return fmt;
  return n < 0 ? `(${fmt})` : fmt;
}
function fmtData(d) {
  if (!d) return 'â€”';
  const [y,m,dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${y}`;
}
function fmtMesAno(d) {
  if (!d) return 'â€”';
  const dt = new Date(d + 'T12:00:00');
  return MESES[dt.getMonth()] + '/' + dt.getFullYear();
}
function diasDesde(d) {
  if (!d) return 0;
  const dt = new Date(d + 'T12:00:00');
  return Math.floor((new Date() - dt) / 86400000);
}
function toast(msg, tipo='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (tipo ? ' ' + tipo : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 3000);
}
function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function fecharModal(id) { document.getElementById(id).classList.remove('open'); }
function navTab(tab) {
  document.querySelectorAll('.ntab[data-tab]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.ntab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + tab);
  if (pg) { pg.classList.add('active'); onTabChange(tab); }
}
function nucleoBadge(n) {
  const m = NUCLEO_MAP[n];
  if (!m) return `<span class="badge b-gr">${_finEsc(n||'â€”')}</span>`;
  return `<span class="badge ${m.cls}">${_finEsc(m.label)}</span>`;
}
const _finEsc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const _finAttr = s => _finEsc(s).replace(/'/g,'&#39;');
const _finSq  = s => "'" + String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'";
function origemLancBadge(l) {
  const origem = l?.origem || l?.origem_modulo || '';
  if (!origem) return '';
  const mapa = {
    manual: { label: 'Manual', cls: 'b-gr' },
    crm: { label: 'CRM', cls: 'b-az' },
    recorrente: { label: 'Recorrente', cls: 'b-am' },
    reembolso: { label: 'Reembolso', cls: 'b-consul' },
    banco_horas: { label: 'Horas adicionais', cls: 'b-vd' },
    pagamento_extraordinario: { label: 'Horas adicionais', cls: 'b-vd' },
  };
  const meta = mapa[origem] || { label: origem, cls: 'b-gr' };
  return `<span class="badge ${meta.cls}" style="font-size:8px">${_finEsc(meta.label)}</span>`;
}
function sitBadge(s) {
  const m = SIT_LANC[s];
  if (!m) return `<span class="badge b-gr">${_finEsc(s||'â€”')}</span>`;
  return `<span class="badge ${m.cls}">${_finEsc(m.label)}</span>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   NAV / UI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('exp-theme', isDark ? '' : 'dark');
}
function toggleNavDropdown() {
  document.getElementById('nav-dropdown').classList.toggle('open');
}
function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('open');
}
function toggleToolFeedbackPopover(e) {
  e?.stopPropagation();
  document.getElementById('nav-feedback-pop').classList.toggle('open');
}
function fecharToolFeedbackPopover() {
  document.getElementById('nav-feedback-pop').classList.remove('open');
}
async function enviarToolFeedback() {
  const tipo = document.getElementById('tool-feedback-type')?.value || 'problema';
  const mensagem = document.getElementById('tool-feedback-message')?.value?.trim();
  const statusEl = document.getElementById('tool-feedback-status');
  if (!mensagem) { if(statusEl) statusEl.textContent = 'Escreva uma mensagem antes de enviar.'; return; }
  if(statusEl) statusEl.textContent = 'Enviandoâ€¦';
  try {
    const { error } = await sb.from('platform_feedback').insert({
      tipo, mensagem, modulo: 'financeiro', usuario_id: G.usuario?.id, usuario_nome: G.usuario?.nome
    });
    if (error) throw error;
    if(statusEl) statusEl.textContent = 'Enviado! Obrigado pelo registro.';
    document.getElementById('tool-feedback-message').value = '';
    setTimeout(fecharToolFeedbackPopover, 1800);
  } catch(err) {
    if(statusEl) statusEl.textContent = 'Erro ao enviar: ' + (err.message || 'tente novamente.');
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   NOTIFICAÃ‡Ã•ES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) carregarNotificacoes();
  // fechar ao clicar fora
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function fecharNotif(e) {
        if (!document.getElementById('notif-wrap').contains(e.target)) {
          panel.classList.remove('open');
          document.removeEventListener('click', fecharNotif);
        }
      });
    }, 0);
  }
}

async function carregarNotificacoes() {
  const list = document.getElementById('notif-list');
  if (list) list.innerHTML = '<div class="notif-empty">Carregandoâ€¦</div>';

  const hoje = new Date().toISOString().split('T')[0];
  const em7d  = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
  const em3d  = new Date(Date.now() + 3  * 86400000).toISOString().split('T')[0];

  const [
    { data: rascunhos },
    { data: nfEmitir },
    { data: cobVencidas },
    { data: cobVencendo },
    { data: despVencidas },
    { data: despVencendo },
  ] = await Promise.all([
    // 1. Rascunhos aguardando ativaÃ§Ã£o (do CRM ou manual)
    sb.from('fin_ativos')
      .select('id,cliente_nome,nucleo,criado_por,created_at')
      .eq('situacao_financeira', 'rascunho')
      .order('created_at', { ascending: false })
      .limit(20),

    // 2. Parcelas com NF a emitir (inclui entregue = etapa concluÃ­da sem NF)
    sb.from('fin_parcelas')
      .select('id,ativo_id,descricao,valor,data_prevista_cobranca,situacao,fin_ativos!inner(cliente_nome,num_legado)')
      .in('situacao', ['entregue', 'a_emitir'])
      .order('data_prevista_cobranca')
      .limit(20),

    // 3. CobranÃ§as VENCIDAS (aguardando pagamento e data jÃ¡ passou)
    sb.from('fin_parcelas')
      .select('id,ativo_id,descricao,valor,data_vencimento,fin_ativos!inner(cliente_nome,num_legado)')
      .eq('situacao', 'aguardando_pagamento')
      .lt('data_vencimento', hoje)
      .order('data_vencimento')
      .limit(20),

    // 4. CobranÃ§as vencendo nos prÃ³ximos 7 dias
    sb.from('fin_parcelas')
      .select('id,ativo_id,descricao,valor,data_vencimento,fin_ativos!inner(cliente_nome,num_legado)')
      .eq('situacao', 'aguardando_pagamento')
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', em7d)
      .order('data_vencimento')
      .limit(20),

    // 5. Despesas/lanÃ§amentos VENCIDOS (a_pagar com data passada)
    sb.from('fin_lancamentos')
      .select('id,observacao,valor,data_vencimento')
      .eq('situacao', 'a_pagar')
      .lt('data_vencimento', hoje)
      .order('data_vencimento')
      .limit(20),

    // 6. Despesas vencendo em 3 dias
    sb.from('fin_lancamentos')
      .select('id,observacao,valor,data_vencimento')
      .eq('situacao', 'a_pagar')
      .gte('data_vencimento', hoje)
      .lte('data_vencimento', em3d)
      .order('data_vencimento')
      .limit(10),
  ]);

  const grupos = [];
  let totalUrgente = 0;

  // â”€â”€ Grupo: Novos projetos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (rascunhos?.length) {
    const crmRasc = rascunhos.filter(r => r.criado_por === 'crm');
    const manRasc = rascunhos.filter(r => r.criado_por !== 'crm');
    const itens = [];
    if (crmRasc.length) {
      totalUrgente += crmRasc.length;
      itens.push(...crmRasc.map(r => ({
        urgente: true, aba: 'projetos',
        icon: 'ðŸ†•',
        texto: `${r.cliente_nome || 'Novo projeto'} Â· ${r.nucleo || ''}`,
        sub: `Rascunho criado pelo CRM Â· ${fmtData(r.created_at?.split('T')[0])}`,
      })));
    }
    if (manRasc.length) {
      itens.push(...manRasc.map(r => ({
        urgente: false, aba: 'projetos',
        icon: 'ðŸ“',
        texto: `${r.cliente_nome || 'Projeto sem nome'} Â· ${r.nucleo || ''}`,
        sub: `Rascunho aguardando ativaÃ§Ã£o Â· ${fmtData(r.created_at?.split('T')[0])}`,
      })));
    }
    grupos.push({ label: 'Novos Projetos', itens });
  }

  // â”€â”€ Grupo: NF a emitir (entregue = etapa concluÃ­da, a_emitir = aguardando emissÃ£o)
  if (nfEmitir?.length) {
    totalUrgente += nfEmitir.length;
    grupos.push({
      label: 'EmissÃ£o de Nota Fiscal',
      itens: nfEmitir.map(p => ({
        urgente: true, aba: 'cobranca',
        icon: p.situacao === 'entregue' ? 'âœ…' : 'ðŸ§¾',
        texto: `${p.fin_ativos?.cliente_nome || 'â€”'} Â· ${p.descricao || 'Parcela'}`,
        sub: p.situacao === 'entregue'
          ? 'Etapa concluÃ­da Â· aguardando emissÃ£o da NF'
          : `NF a emitir${p.data_prevista_cobranca ? ' Â· ' + fmtData(p.data_prevista_cobranca) : ''}`,
        val: p.valor ? moeda(p.valor, true) : null,
      })),
    });
  }

  // â”€â”€ Grupo: CobranÃ§as vencidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (cobVencidas?.length) {
    totalUrgente += cobVencidas.length;
    grupos.push({
      label: 'CobranÃ§as Vencidas',
      itens: cobVencidas.map(p => {
        const dias = Math.floor((new Date() - new Date(p.data_vencimento + 'T12:00:00')) / 86400000);
        return {
          urgente: true, aba: 'cobranca',
          icon: 'ðŸ”´',
          texto: `${p.fin_ativos?.cliente_nome || 'â€”'} Â· ${p.descricao || 'Parcela'}`,
          sub: `Venceu hÃ¡ ${dias} dia${dias !== 1 ? 's' : ''} Â· ${fmtData(p.data_vencimento)}`,
          val: p.valor ? moeda(p.valor, true) : null,
        };
      }),
    });
  }

  // â”€â”€ Grupo: CobranÃ§as vencendo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (cobVencendo?.length) {
    grupos.push({
      label: 'CobranÃ§as a Vencer (7 dias)',
      itens: cobVencendo.map(p => {
        const dias = Math.ceil((new Date(p.data_vencimento + 'T12:00:00') - new Date()) / 86400000);
        return {
          urgente: false, aba: 'cobranca',
          icon: 'â°',
          texto: `${p.fin_ativos?.cliente_nome || 'â€”'} Â· ${p.descricao || 'Parcela'}`,
          sub: `Vence ${dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias !== 1 ? 's' : '')} Â· ${fmtData(p.data_vencimento)}`,
          val: p.valor ? moeda(p.valor, true) : null,
        };
      }),
    });
  }

  // â”€â”€ Grupo: Despesas vencidas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (despVencidas?.length) {
    totalUrgente += despVencidas.length;
    grupos.push({
      label: 'Despesas Vencidas',
      itens: despVencidas.map(l => {
        const dias = Math.floor((new Date() - new Date(l.data_vencimento + 'T12:00:00')) / 86400000);
        return {
          urgente: true, aba: 'lancamentos',
          icon: 'ðŸ’¸',
          texto: l.observacao || 'Despesa sem descriÃ§Ã£o',
          sub: `Venceu hÃ¡ ${dias} dia${dias !== 1 ? 's' : ''} Â· ${fmtData(l.data_vencimento)}`,
          val: l.valor ? moeda(l.valor, true) : null,
        };
      }),
    });
  }

  // â”€â”€ Grupo: Despesas vencendo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (despVencendo?.length) {
    grupos.push({
      label: 'Despesas a Pagar (3 dias)',
      itens: despVencendo.map(l => {
        const dias = Math.ceil((new Date(l.data_vencimento + 'T12:00:00') - new Date()) / 86400000);
        return {
          urgente: false, aba: 'lancamentos',
          icon: 'ðŸ“…',
          texto: l.observacao || 'Despesa sem descriÃ§Ã£o',
          sub: `Vence ${dias === 0 ? 'hoje' : 'em ' + dias + ' dia' + (dias !== 1 ? 's' : '')}`,
          val: l.valor ? moeda(l.valor, true) : null,
        };
      }),
    });
  }

  // â”€â”€ Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = totalUrgente > 99 ? '99+' : totalUrgente;
    badge.style.display = totalUrgente > 0 ? '' : 'none';
  }

  // â”€â”€ Renderizar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!list) return;
  if (!grupos.length) {
    list.innerHTML = '<div class="notif-empty">âœ“ Tudo em dia â€” nenhuma pendÃªncia</div>';
    return;
  }

  list.innerHTML = grupos.map(g => `
    <div class="notif-group-label">${g.label}</div>
    ${g.itens.map((item, idx) => `
      <div class="notif-item${item.urgente ? ' notif-urgente' : ''}" data-aba="${item.aba}">
        <div class="notif-icon">${item.icon}</div>
        <div class="notif-body">
          <div class="notif-texto">${item.texto}</div>
          <div class="notif-sub">${item.sub}</div>
          ${item.val ? `<div class="notif-val">${item.val}</div>` : ''}
        </div>
      </div>
    `).join('')}
  `).join('');

  list.querySelectorAll('.notif-item[data-aba]').forEach(el => {
    el.addEventListener('click', () => {
      irParaAba(el.dataset.aba);
      document.getElementById('notif-panel').classList.remove('open');
    });
  });
}

function irParaAba(tab) {
  document.querySelectorAll('.ntab[data-tab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.ntab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const pg = document.getElementById('page-' + tab);
  if (pg) { pg.classList.add('active'); onTabChange(tab); }
}
document.addEventListener('click', e => {
  if (!e.target.closest('#nav-mod-wrap')) document.getElementById('nav-dropdown')?.classList.remove('open');
  if (!e.target.closest('#user-pill-wrap')) document.getElementById('user-dropdown')?.classList.remove('open');
  if (!e.target.closest('#feedback-icon-wrap')) document.getElementById('nav-feedback-pop')?.classList.remove('open');
});
function initConnDot() {
  const dot = document.getElementById('conn-dot');
  const upd = () => { dot.className = 'conn-dot ' + (navigator.onLine ? 'online' : 'offline'); };
  upd(); window.addEventListener('online', upd); window.addEventListener('offline', upd);
}
function initNavDropdown(role) {
  if (['socio', 'socio_adm', 'socio_admin'].includes((role || '').toLowerCase())) {
    document.querySelectorAll('.nd-soc').forEach(el => el.style.display = '');
    const platBtn = document.getElementById('user-menu-platform');
    if (platBtn) platBtn.style.display = '';
  }
  initConnDot();
}
function canAccessFinanceiroRole(role) {
  return ['socio', 'socio_adm', 'socio_admin'].includes((role || '').toLowerCase());
}
async function sair() {
  await sb.auth.signOut();
  sessionStorage.removeItem('exp_usuario');
  window.location.href = 'index.html';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   SUB-ABAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setProjTab(tab) {
  document.querySelectorAll('[data-ptab]').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-ptab="${tab}"]`)?.classList.add('active');
  ['fila','ativos','concluidos'].forEach(t => {
    const el = document.getElementById('ptab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'ativos') carregarAtivos();
  if (tab === 'concluidos') carregarConcluidos();
  if (tab === 'fila') carregarFila();
}
function setConfigTab(tab) {
  document.querySelectorAll('[data-ctab]').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-ctab="${tab}"]`)?.classList.add('active');
  ['plano','contas','fechamento'].forEach(t => {
    const el = document.getElementById('ctab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'plano')     renderPlano();
  if (tab === 'contas')    renderContas();
  if (tab === 'fechamento') renderFechamentos();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   ON TAB CHANGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function onTabChange(tab) {
  if (tab === 'dashboard')    carregarDashboard();
  if (tab === 'projetos')     carregarFila();
  if (tab === 'cobranca')     carregarPipeline();
  if (tab === 'lancamentos')  carregarLancamentos();
  if (tab === 'conciliacao')  { /* selecione conta */ }
  if (tab === 'config')       { renderPlano(); }
  if (tab === 'planejamento') carregarPlanejamento();
  if (tab === 'dre')          carregarDRE();
  if (tab === 'analise')      carregarAnalise();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   ANÃLISE DE MARGENS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const G_analise = {
  ano:    new Date().getFullYear(),
  tab:    'nucleo',
  dados:  null,   // array de lancamentos do ano
  ativos: [],     // array de fin_ativos para lookup
};

const NUCLEOS_ANALISE = [
  { key: 'URB',    label: 'Urbanismo',    cor: 'var(--urb)',    bg: 'var(--urb-bg)'    },
  { key: 'PAIS',   label: 'Paisagismo',   cor: 'var(--pai)',    bg: 'var(--pai-bg)'    },
  { key: 'CONSUL', label: 'Consultorias', cor: 'var(--consul)', bg: 'var(--consul-bg)' },
  { key: 'ESP',    label: 'Especiais',    cor: 'var(--esp)',    bg: 'var(--esp-bg)'    },
];

function initAnaliseAno() {
  const sel = document.getElementById('analise-ano');
  if (!sel) return;
  const cur = new Date().getFullYear();
  sel.innerHTML = '';
  for (let y = cur; y >= cur - 4; y--) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === G_analise.ano) o.selected = true;
    sel.appendChild(o);
  }
}

function onAnaliseAnoChange() {
  G_analise.ano = parseInt(document.getElementById('analise-ano')?.value || new Date().getFullYear());
  carregarAnalise();
}

function setAnaliseTab(tab) {
  G_analise.tab = tab;
  document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-atab="${tab}"]`)?.classList.add('active');
  document.getElementById('atab-nucleo').style.display  = tab === 'nucleo'  ? '' : 'none';
  document.getElementById('atab-projeto').style.display = tab === 'projeto' ? '' : 'none';
  if (tab === 'nucleo')  renderNucleoMargens();
  if (tab === 'projeto') renderProjetoMargens();
}

async function carregarAnalise() {
  const ano = G_analise.ano;
  const ini = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  // LanÃ§amentos do ano com plano de contas
  const { data: lancs } = await sb.from('fin_lancamentos')
    .select('id, valor, tipo, data_competencia, situacao, ativo_id, fin_plano_contas(grupo, subconta, tipo, aparece_dre, nucleo_crm)')
    .gte('data_competencia', ini)
    .lte('data_competencia', fim)
    .in('situacao', ['pago', 'aprovado', 'pendente']);

  // Ativos para lookup de nome
  if (!G_analise.ativos.length) {
    const { data: ativs } = await sb.from('fin_ativos').select('id, nome, nucleo_crm').order('nome');
    G_analise.ativos = ativs || [];
  }

  G_analise.dados = lancs || [];

  if (G_analise.tab === 'nucleo')  renderNucleoMargens();
  if (G_analise.tab === 'projeto') renderProjetoMargens();
}

function renderNucleoMargens() {
  const dados = G_analise.dados || [];
  const ano   = G_analise.ano;
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Agregar por nÃºcleo
  const agg = {}; // { nucleo: { rec: 0, custo: 0, mes: [12 zeros rec, 12 zeros custo] } }
  NUCLEOS_ANALISE.forEach(n => {
    agg[n.key] = { rec: 0, custo: 0, mesRec: Array(12).fill(0), mesCusto: Array(12).fill(0) };
  });

  const totalRec = { val: 0, mes: Array(12).fill(0) };

  dados.forEach(l => {
    const pc = l.fin_plano_contas;
    if (!pc || !pc.aparece_dre) return;
    const mes = new Date(l.data_competencia).getMonth(); // 0-11
    const nucleo = pc.nucleo_crm;
    const val = l.valor || 0;

    if (pc.tipo === 'receita' && nucleo && agg[nucleo]) {
      agg[nucleo].rec += val;
      agg[nucleo].mesRec[mes] += val;
      totalRec.val += val;
      totalRec.mes[mes] += val;
    }
    // Custos diretos = despesas com nucleo_crm definido (nÃ£o nulo = nÃ£o Ã© overhead)
    if (pc.tipo === 'despesa' && nucleo && agg[nucleo]) {
      agg[nucleo].custo += val;
      agg[nucleo].mesCusto[mes] += val;
    }
  });

  // Cards
  const grid = document.getElementById('analise-cards');
  if (grid) {
    grid.innerHTML = NUCLEOS_ANALISE.map(n => {
      const d = agg[n.key];
      const margem = d.rec - d.custo;
      const pctMargem = d.rec > 0 ? (margem / d.rec * 100) : 0;
      const share = totalRec.val > 0 ? (d.rec / totalRec.val * 100) : 0;
      const barW = Math.max(0, Math.min(100, pctMargem));
      const barCor = pctMargem >= 40 ? 'var(--verde)' : pctMargem >= 20 ? 'var(--ouro)' : 'var(--terracota)';
      return `
      <div class="analise-card" style="--ac:${n.cor}">
        <div class="analise-card-nucleo">${n.label}</div>
        <div class="analise-card-val" style="color:${n.cor}">${moeda(d.rec)}</div>
        <div class="analise-card-lbl">Receita ${ano} Â· ${share.toFixed(1)}% do total</div>
        <div class="analise-card-sub">
          <div class="analise-card-row">
            <span class="albl">Custos diretos</span>
            <span class="aval" style="color:var(--terracota)">(${moeda(d.custo)})</span>
          </div>
          <div class="analise-card-row">
            <span class="albl">Margem bruta</span>
            <span class="aval" style="color:${barCor}">${moeda(margem)}</span>
          </div>
          <div class="analise-card-row">
            <span class="albl">% Margem</span>
            <span class="aval" style="color:${barCor}">${pctMargem.toFixed(1)}%</span>
          </div>
        </div>
        <div class="analise-barra"><div class="analise-barra-fill" style="width:${barW}%;background:${barCor}"></div></div>
      </div>`;
    }).join('');
  }

  // Tabela mensal
  const tbl = document.getElementById('analise-mes-tbl');
  if (!tbl) return;

  // CabeÃ§alho
  tbl.querySelector('thead tr').innerHTML = '<th>NÃºcleo</th>' +
    MESES.map((m, i) => `<th style="text-align:right">${m}</th>`).join('') +
    '<th style="text-align:right">Total</th>';

  // Corpo: 1 linha por nÃºcleo (receita), depois margem %
  const tbody = tbl.querySelector('tbody');
  let html = '';
  NUCLEOS_ANALISE.forEach(n => {
    const d = agg[n.key];
    const hasData = d.rec > 0 || d.custo > 0;
    if (!hasData) return;
    const margem = d.rec - d.custo;
    const pctMargem = d.rec > 0 ? (margem / d.rec * 100) : 0;
    html += `
    <tr>
      <td style="color:${n.cor};font-weight:700">${n.label}</td>
      ${d.mesRec.map(v => `<td style="text-align:right">${v > 0 ? moeda(v) : '<span style="color:#ccc">â€”</span>'}</td>`).join('')}
      <td style="text-align:right;font-weight:700">${moeda(d.rec)}</td>
    </tr>
    <tr style="background:var(--cinza2)">
      <td style="color:#999;font-size:10px;padding-left:20px">â†³ Margem %</td>
      ${d.mesRec.map((rec, i) => {
        const mg = rec > 0 ? ((rec - d.mesCusto[i]) / rec * 100) : null;
        if (mg === null) return '<td style="text-align:right;color:#ccc;font-size:10px">â€”</td>';
        const c = mg >= 40 ? 'var(--verde)' : mg >= 20 ? 'var(--ouro)' : 'var(--terracota)';
        return `<td style="text-align:right;font-size:10px;color:${c}">${mg.toFixed(1)}%</td>`;
      }).join('')}
      <td style="text-align:right;font-size:10px;color:${pctMargem >= 40 ? 'var(--verde)' : pctMargem >= 20 ? 'var(--ouro)' : 'var(--terracota)'};font-weight:700">${pctMargem.toFixed(1)}%</td>
    </tr>`;
  });
  // Total geral
  html += `
  <tr class="an-total-row">
    <td>Total Geral</td>
    ${totalRec.mes.map(v => `<td style="text-align:right">${v > 0 ? moeda(v) : 'â€”'}</td>`).join('')}
    <td style="text-align:right">${moeda(totalRec.val)}</td>
  </tr>`;
  tbody.innerHTML = html;
}

function renderProjetoMargens() {
  const dados = G_analise.dados || [];
  const ativos = G_analise.ativos;

  // Agregar por ativo_id
  const byAtivo = {}; // { ativo_id: { rec, custo, nucleo } }

  dados.forEach(l => {
    const pc = l.fin_plano_contas;
    if (!pc || !pc.aparece_dre) return;
    const aid = l.ativo_id || '__sem_ativo__';
    if (!byAtivo[aid]) byAtivo[aid] = { rec: 0, custo: 0, nucleo: pc.nucleo_crm };
    if (pc.tipo === 'receita') byAtivo[aid].rec   += l.valor || 0;
    if (pc.tipo === 'despesa') byAtivo[aid].custo += l.valor || 0;
  });

  // Ordenar por receita desc
  const rows = Object.entries(byAtivo)
    .map(([aid, d]) => {
      const ativo = ativos.find(a => a.id === aid);
      const nome  = ativo ? ativo.nome : (aid === '__sem_ativo__' ? 'Sem projeto vinculado' : `Ativo ${aid.slice(0,6)}`);
      const nucleo = d.nucleo || ativo?.nucleo_crm || 'â€”';
      const margem = d.rec - d.custo;
      const pct    = d.rec > 0 ? (margem / d.rec * 100) : null;
      return { nome, nucleo, rec: d.rec, custo: d.custo, margem, pct };
    })
    .filter(r => r.rec > 0 || r.custo > 0)
    .sort((a, b) => b.rec - a.rec);

  const body = document.getElementById('analise-proj-body');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#999;padding:30px">Nenhum dado encontrado para ${G_analise.ano}</td></tr>`;
    return;
  }

  const maxRec = Math.max(...rows.map(r => r.rec));

  body.innerHTML = rows.map(r => {
    const nucDef = NUCLEOS_ANALISE.find(n => n.key === r.nucleo);
    const nucCor = nucDef ? nucDef.cor : '#999';
    const nucLbl = nucDef ? nucDef.label : r.nucleo;
    const pctStr = r.pct !== null ? r.pct.toFixed(1) + '%' : 'â€”';
    const pctCor = r.pct !== null ? (r.pct >= 40 ? 'var(--verde)' : r.pct >= 20 ? 'var(--ouro)' : 'var(--terracota)') : '#ccc';
    const barW   = maxRec > 0 ? Math.max(2, (r.rec / maxRec) * 80) : 0;
    return `
    <tr>
      <td>
        <div style="font-weight:600;font-size:12px">${r.nome}</div>
        <div style="height:3px;background:var(--cinza2);border-radius:2px;margin-top:5px;width:90%">
          <div style="height:3px;background:${nucCor};border-radius:2px;width:${barW}%"></div>
        </div>
      </td>
      <td class="r"><span style="font-size:10px;font-weight:700;color:${nucCor}">${nucLbl}</span></td>
      <td class="r">${moeda(r.rec)}</td>
      <td class="r" style="color:var(--terracota)">(${moeda(r.custo)})</td>
      <td class="r" style="color:${r.margem >= 0 ? 'var(--verde)' : 'var(--terracota)'}">${moeda(r.margem)}</td>
      <td class="r">
        <div class="analise-mg-wrap">
          <div class="analise-mg-bar" style="width:${r.pct !== null ? Math.max(3, r.pct * 0.6) : 0}px;background:${pctCor}"></div>
          <span style="color:${pctCor};font-weight:700">${pctStr}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   CARREGAR DADOS BASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function carregarPlanoContas() {
  const { data } = await sb.from('fin_plano_contas')
    .select('*').eq('ativo', true).order('ordem');
  G.planoContas = data || [];
  // popular selects
  const selects = ['lanc-plano', 'sub-grupo'];
  const planOpt = G.planoContas.map(pc =>
    `<option value="${_finAttr(pc.id)}">${_finEsc(pc.grupo)} Â· ${_finEsc(pc.subconta)}</option>`
  ).join('');
  ['lanc-plano','rec-plano'].forEach(sid => {
    const el = document.getElementById(sid);
    if (el) el.innerHTML = '<option value="">Selecioneâ€¦</option>' + planOpt;
  });
  // grupo filter
  const gps = [...new Set(G.planoContas.map(p => p.grupo))];
  const gpSel = document.getElementById('lanc-grupo');
  if (gpSel) gpSel.innerHTML = '<option value="">Todos os grupos</option>' +
    gps.map(g => `<option value="${_finAttr(g)}">${_finEsc((g || '').replace(/_/g,' '))}</option>`).join('');
}

async function carregarContasBancarias() {
  const { data } = await sb.from('fin_contas_bancarias')
    .select('*').eq('ativo', true).order('ordem');
  G.contasBancarias = data || [];
  const opts = G.contasBancarias.map(c => `<option value="${_finAttr(c.id)}">${_finEsc(c.nome)}</option>`).join('');
  const blank = '<option value="">Selecioneâ€¦</option>';
  ['lanc-conta-bancaria','concil-conta','rec-conta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = blank + opts;
  });
  const filtSel = document.getElementById('lanc-conta');
  if (filtSel) filtSel.innerHTML = '<option value="">Todas as contas</option>' + opts;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initDashSelects() {
  const mes = document.getElementById('dash-mes');
  const ano = document.getElementById('dash-ano');
  if (!mes) return;
  mes.innerHTML = MESES_FULL.map((m, i) => `<option value="${_finAttr(i+1)}">${_finEsc(m)}</option>`).join('');
  const now = new Date();
  mes.value = now.getMonth() + 1;
  for (let y = now.getFullYear(); y >= 2024; y--) {
    ano.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

async function carregarDashboard() {
  const mes = parseInt(document.getElementById('dash-mes')?.value || new Date().getMonth() + 1);
  const ano = parseInt(document.getElementById('dash-ano')?.value || new Date().getFullYear());
  const mmaaaa = String(mes).padStart(2,'0') + String(ano);

  // MÃªs anterior
  const mesPrev = mes === 1 ? 12 : mes - 1;
  const anoPrev = mes === 1 ? ano - 1 : ano;
  const mmaaaaPrev = String(mesPrev).padStart(2,'0') + String(anoPrev);

  // YTD: Jan atÃ© o mÃªs selecionado (inclusive)
  const ytdMeses = [];
  for (let m = 1; m <= mes; m++) ytdMeses.push(String(m).padStart(2,'0') + String(ano));

  document.getElementById('dash-periodo').textContent = `${MESES_FULL[mes-1]} de ${ano}`;

  // â”€â”€ Queries em paralelo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [
    { data: recMes },
    { data: despMes },
    { data: recPrev },
    { data: despPrev },
    { data: recYTD },
    { data: despYTD },
    { data: recNucleo },
    { data: aRec },
    { count: pendentes },
  ] = await Promise.all([
    // Receita mÃªs atual (pago + aprovado)
    sb.from('fin_lancamentos').select('valor, fin_plano_contas(nucleo_crm)')
      .eq('mes_ano_competencia', mmaaaa).eq('tipo','receita')
      .in('situacao',['pago','aprovado']),
    // Despesa mÃªs atual
    sb.from('fin_lancamentos').select('valor')
      .eq('mes_ano_competencia', mmaaaa).eq('tipo','despesa')
      .in('situacao',['pago','aprovado']),
    // Receita mÃªs anterior
    sb.from('fin_lancamentos').select('valor')
      .eq('mes_ano_competencia', mmaaaaPrev).eq('tipo','receita')
      .in('situacao',['pago','aprovado']),
    // Despesa mÃªs anterior
    sb.from('fin_lancamentos').select('valor')
      .eq('mes_ano_competencia', mmaaaaPrev).eq('tipo','despesa')
      .in('situacao',['pago','aprovado']),
    // Receita YTD
    sb.from('fin_lancamentos').select('valor')
      .in('mes_ano_competencia', ytdMeses).eq('tipo','receita')
      .in('situacao',['pago','aprovado']),
    // Despesa YTD
    sb.from('fin_lancamentos').select('valor')
      .in('mes_ano_competencia', ytdMeses).eq('tipo','despesa')
      .in('situacao',['pago','aprovado']),
    // Receita por nucleo (mÃªs atual â€” join jÃ¡ feito acima, reutiliza recMes)
    Promise.resolve({ data: null }),
    // A receber
    sb.from('fin_lancamentos').select('valor')
      .eq('situacao','aguardando_pagamento').eq('tipo','receita'),
    // NFs pendentes
    sb.from('fin_parcelas').select('id',{count:'exact',head:true})
      .in('situacao',['entregue','a_emitir']),
  ]);

  // â”€â”€ Totais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sum = arr => (arr||[]).reduce((s,r) => s + Math.abs(parseFloat(r.valor||0)), 0);

  const totalRec  = sum(recMes);
  const totalDesp = sum(despMes);
  const totalRecP = sum(recPrev);
  const totalDespP= sum(despPrev);
  const totalYTDRec  = sum(recYTD);
  const totalYTDDesp = sum(despYTD);
  const totalARec = sum(aRec);

  const resultado  = totalRec - totalDesp;
  const resultadoP = totalRecP - totalDespP;
  const margem     = totalRec > 0 ? (resultado / totalRec * 100) : null;
  const margemP    = totalRecP > 0 ? (resultadoP / totalRecP * 100) : null;
  const ytdRes     = totalYTDRec - totalYTDDesp;
  const mesesDecorridos = mes; // Jan=1
  const projecao   = mesesDecorridos > 0 ? (ytdRes / mesesDecorridos) * 12 : 0;

  // â”€â”€ Helper: delta badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const deltaBadge = (atual, anterior, pct = false, inverter = false) => {
    if (!anterior) return '<span class="kpi-delta-neu">â€” sem dado anterior</span>';
    const diff = atual - anterior;
    const pctDiff = anterior !== 0 ? (diff / Math.abs(anterior) * 100) : null;
    const positivo = inverter ? diff < 0 : diff > 0;
    const cls = diff === 0 ? 'kpi-delta-neu' : positivo ? 'kpi-delta-pos' : 'kpi-delta-neg';
    const seta = diff === 0 ? 'â†’' : diff > 0 ? 'â†‘' : 'â†“';
    const label = pct
      ? `${seta} ${Math.abs(diff).toFixed(1)}pp vs ${MESES_ABR[mesPrev-1]}`
      : `${seta} ${moeda(Math.abs(diff))} vs ${MESES_ABR[mesPrev-1]}${pctDiff !== null ? ` (${Math.abs(pctDiff).toFixed(0)}%)` : ''}`;
    return `<span class="${cls}">${label}</span>`;
  };

  // â”€â”€ Preencher KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.getElementById('kpi-receita').textContent = moeda(totalRec, true);
  document.getElementById('kpi-receita-delta').innerHTML = deltaBadge(totalRec, totalRecP);
  document.getElementById('kpi-receita-bar').style.width =
    totalRecP > 0 ? Math.min(100, (totalRec / Math.max(totalRec, totalRecP) * 100)) + '%' : '60%';

  document.getElementById('kpi-despesas').textContent = moeda(totalDesp, true);
  document.getElementById('kpi-despesas-delta').innerHTML = deltaBadge(totalDesp, totalDespP, false, true);

  const resEl = document.getElementById('kpi-resultado');
  resEl.textContent = (resultado >= 0 ? '' : '-') + moeda(Math.abs(resultado), true);
  resEl.style.color = resultado >= 0 ? 'var(--verde)' : 'var(--terracota)';
  document.getElementById('kpi-resultado-delta').innerHTML = deltaBadge(resultado, resultadoP);

  const margemEl = document.getElementById('kpi-margem');
  if (margem !== null) {
    margemEl.textContent = margem.toFixed(1) + '%';
    margemEl.style.color = margem >= 40 ? 'var(--verde)' : margem >= 20 ? 'var(--ouro)' : 'var(--terracota)';
    document.getElementById('kpi-margem-bar').style.width = Math.max(0, Math.min(100, margem)) + '%';
    document.getElementById('kpi-margem-bar').style.background =
      margem >= 40 ? 'var(--verde)' : margem >= 20 ? 'var(--ouro)' : 'var(--terracota)';
    document.getElementById('kpi-margem-delta').innerHTML =
      margemP !== null ? deltaBadge(margem, margemP, true) : '<span class="kpi-delta-neu">â€” sem dado anterior</span>';
  } else {
    margemEl.textContent = 'â€”';
    margemEl.style.color = '';
  }

  const acumEl = document.getElementById('kpi-acumulado');
  acumEl.textContent = (ytdRes >= 0 ? '' : '-') + moeda(Math.abs(ytdRes), true);
  acumEl.style.color = ytdRes >= 0 ? 'var(--verde)' : 'var(--terracota)';
  document.getElementById('kpi-acumulado-sub').textContent =
    `Jan â†’ ${MESES_ABR[mes-1]} Â· ${mes} ${mes === 1 ? 'mÃªs' : 'meses'}`;

  const projEl = document.getElementById('kpi-projecao');
  projEl.textContent = (projecao >= 0 ? '' : '-') + moeda(Math.abs(projecao), true);
  projEl.style.color = projecao >= 0 ? 'var(--verde)' : 'var(--terracota)';
  document.getElementById('kpi-projecao-sub').textContent =
    `mÃ©dia mensal Ã— 12 Â· base: ${mes} ${mes === 1 ? 'mÃªs' : 'meses'}`;

  document.getElementById('kpi-a-receber').textContent = moeda(totalARec, true);
  document.getElementById('kpi-pendentes').textContent = pendentes || 0;

  // â”€â”€ Receita por nÃºcleo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const NC_DEF = [
    { key:'URB',    label:'Urbanismo',    cor:'var(--urb)'    },
    { key:'PAIS',   label:'Paisagismo',   cor:'var(--pai)'    },
    { key:'CONSUL', label:'Consultorias', cor:'var(--consul)' },
    { key:'ESP',    label:'Especiais',    cor:'var(--esp)'    },
  ];
  const byNucleo = {};
  NC_DEF.forEach(n => byNucleo[n.key] = 0);
  (recMes||[]).forEach(l => {
    const nc = l.fin_plano_contas?.nucleo_crm;
    if (nc && byNucleo[nc] !== undefined) byNucleo[nc] += Math.abs(parseFloat(l.valor||0));
  });
  const maxNC = Math.max(1, ...Object.values(byNucleo));
  document.getElementById('dash-nucleos').innerHTML = NC_DEF.map(n => {
    const v = byNucleo[n.key];
    const pct = totalRec > 0 ? (v / totalRec * 100).toFixed(1) : '0.0';
    const barW = Math.max(0, (v / maxNC) * 100).toFixed(1);
    return `
    <div class="dash-nc-card" style="--ac:${n.cor}">
      <div class="dash-nc-lbl">${n.label}</div>
      <div class="dash-nc-val" style="color:${n.cor}">${moeda(v, true)}</div>
      <div class="dash-nc-sub">${pct}% da receita do mÃªs</div>
      <div class="dash-nc-bar"><div class="dash-nc-bar-fill" style="width:${barW}%;background:${n.cor}"></div></div>
    </div>`;
  }).join('');

  // â”€â”€ GrÃ¡ficos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await renderDashCharts(mes, ano, totalRec, byNucleo, NC_DEF);

  carregarAlertas();
  carregarEtapasRecentes();
}

// â”€â”€ InstÃ¢ncias dos charts (destruir antes de recriar) â”€â”€â”€â”€â”€â”€â”€â”€
let _chartQuad = null;
let _chartNucleo = null;

async function renderDashCharts(mes, ano, totalRecMes, byNucleo, NC_DEF) {
  // Quadrimestre: Ãºltimos 4 meses atÃ© o selecionado (inclusive)
  const quadMeses = [];
  const quadLabels = [];
  for (let i = 3; i >= 0; i--) {
    let m = mes - i;
    let a = ano;
    if (m <= 0) { m += 12; a -= 1; }
    quadMeses.push(String(m).padStart(2,'0') + String(a));
    quadLabels.push(MESES_ABR[m - 1] + (a !== ano ? ' ' + a : ''));
  }

  document.getElementById('chart-quad-label').textContent =
    quadLabels[0] + ' â†’ ' + quadLabels[3];
  document.getElementById('chart-nucleo-label').textContent =
    MESES_FULL[mes - 1] + ' de ' + ano;

  // Buscar receita e despesa do quadrimestre
  const [{ data: qRec }, { data: qDesp }] = await Promise.all([
    sb.from('fin_lancamentos').select('valor, mes_ano_competencia')
      .in('mes_ano_competencia', quadMeses).eq('tipo','receita')
      .in('situacao',['pago','aprovado']),
    sb.from('fin_lancamentos').select('valor, mes_ano_competencia')
      .in('mes_ano_competencia', quadMeses).eq('tipo','despesa')
      .in('situacao',['pago','aprovado']),
  ]);

  const sumBy = (arr, key) => {
    const acc = {};
    quadMeses.forEach(k => acc[k] = 0);
    (arr||[]).forEach(r => { if (acc[r[key]] !== undefined) acc[r[key]] += Math.abs(parseFloat(r.valor||0)); });
    return quadMeses.map(k => acc[k]);
  };

  const recVals  = sumBy(qRec,  'mes_ano_competencia');
  const despVals = sumBy(qDesp, 'mes_ano_competencia');
  const resVals  = recVals.map((r, i) => r - despVals[i]);

  // Cores do design system via CSS variables (resolvidas do :root)
  const cssProp = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const cRoxo   = cssProp('--roxo')    || '#6B4FA0';
  const cCinza  = cssProp('--cinza2')  || '#ECEAE4';
  const cVerde  = cssProp('--verde')   || '#2D9E6B';
  const cTc     = cssProp('--terracota') || '#C0584D';
  const cText   = cssProp('--grafite') || '#2a2a2a';

  // â”€â”€ Chart 1: Quadrimestre (barras agrupadas + linha resultado) â”€â”€
  if (_chartQuad) _chartQuad.destroy();
  const ctx1 = document.getElementById('chart-quad').getContext('2d');
  _chartQuad = new Chart(ctx1, {
    data: {
      labels: quadLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Receita',
          data: recVals,
          backgroundColor: cRoxo + '99',
          borderColor: cRoxo,
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'bar',
          label: 'Despesas',
          data: despVals,
          backgroundColor: cCinza,
          borderColor: '#ccc',
          borderWidth: 1,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: 'Resultado',
          data: resVals,
          borderColor: resVals.every(v => v >= 0) ? cVerde : cTc,
          backgroundColor: 'transparent',
          pointBackgroundColor: resVals.map(v => v >= 0 ? cVerde : cTc),
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.3,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: cText, font: { family: 'Raleway', size: 10 }, boxWidth: 10, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' +
              (ctx.raw < 0 ? '-' : '') + 'R$ ' + Math.abs(ctx.raw).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
          },
        },
      },
      scales: {
        x: { ticks: { color: '#999', font: { size: 10 } }, grid: { display: false } },
        y: {
          ticks: {
            color: '#999',
            font: { size: 9 },
            callback: v => 'R$ ' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0)+'k' : v),
          },
          grid: { color: '#f0f0f0' },
        },
      },
    },
  });

  // â”€â”€ Chart 2: Receita por nÃºcleo (donut) â”€â”€
  if (_chartNucleo) _chartNucleo.destroy();
  const ncLabels = NC_DEF.map(n => n.label);
  const ncVals   = NC_DEF.map(n => byNucleo[n.key] || 0);
  const ncCores  = NC_DEF.map(n => {
    // resolve var(--xxx) â†’ valor real
    const m = n.cor.match(/var\((--[^)]+)\)/);
    return m ? cssProp(m[1]) : n.cor;
  });

  const ctx2 = document.getElementById('chart-nucleo').getContext('2d');
  _chartNucleo = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ncLabels,
      datasets: [{
        data: ncVals,
        backgroundColor: ncCores.map(c => c + 'CC'),
        borderColor: ncCores,
        borderWidth: 1.5,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: cText, font: { family: 'Raleway', size: 10 }, boxWidth: 10, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
              return ' ' + ctx.label + ': R$ ' + ctx.raw.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
}

async function carregarAlertas() {
  const el = document.getElementById('dash-alertas');
  const hoje = new Date().toISOString().split('T')[0];

  const [{ data: nfPend }, { data: cobVenc }] = await Promise.all([
    // NF pendente: etapas concluÃ­das (entregue) e marcadas para emitir (a_emitir)
    sb.from('fin_parcelas')
      .select('id, tipo, situacao, descricao, valor, ativo_id, fin_ativos(cliente_nome, num_legado)')
      .in('situacao', ['entregue', 'a_emitir'])
      .order('data_prevista_cobranca').limit(8),
    // CobranÃ§as vencidas
    sb.from('fin_parcelas')
      .select('id, tipo, descricao, valor, data_vencimento, fin_ativos(cliente_nome, num_legado)')
      .eq('situacao', 'aguardando_pagamento')
      .lt('data_vencimento', hoje)
      .order('data_vencimento').limit(5),
  ]);

  const itens = [];

  (cobVenc || []).forEach(p => {
    const dias = Math.floor((new Date() - new Date(p.data_vencimento + 'T12:00:00')) / 86400000);
    itens.push({ urgente: true, icon: 'ðŸ”´', cor: 'var(--terracota)',
      cliente: p.fin_ativos?.cliente_nome, num: p.fin_ativos?.num_legado,
      desc: `${TIPO_PARCELA_MAP[p.tipo]?.label || p.tipo} Â· Venceu hÃ¡ ${dias}d`,
      valor: p.valor, id: p.id, acao: 'pgto',
    });
  });

  (nfPend || []).forEach(p => {
    itens.push({ urgente: true, icon: p.situacao === 'entregue' ? 'âœ…' : 'ðŸ§¾', cor: 'var(--ouro)',
      cliente: p.fin_ativos?.cliente_nome, num: p.fin_ativos?.num_legado,
      desc: p.situacao === 'entregue' ? 'Etapa concluÃ­da Â· emitir NF' : 'NF a emitir',
      valor: p.valor, id: p.id, acao: 'nf',
    });
  });

  if (!itens.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#bbb;font-size:11px">Sem pendÃªncias urgentes âœ“</div>';
    return;
  }

  el.innerHTML = itens.map(i => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cinza2)">
      <span style="font-size:14px">${i.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_finEsc(i.cliente || 'â€”')} <span style="font-size:10px;color:#888;font-weight:400">${_finEsc(i.num || '')}</span>
        </div>
        <div style="font-size:10px;color:#888">${_finEsc(i.desc)}</div>
      </div>
      <div style="font-size:13px;font-weight:700;color:${i.cor};flex-shrink:0">${moeda(i.valor)}</div>
      <button class="btn btn-sec btn-xs" onclick="navTab('cobranca')">${i.acao === 'pgto' ? 'Confirmar' : 'Emitir'}</button>
    </div>`).join('');
}

async function carregarEtapasRecentes() {
  const el = document.getElementById('dash-etapas-recentes');
  const { data } = await sb.from('fin_etapas')
    .select('id, descricao, data_entrega_realizada, situacao, fin_ativos(cliente_nome, num_legado)')
    .eq('situacao', 'alertado')
    .order('data_entrega_realizada', { ascending: false }).limit(8);

  if (!data || data.length === 0) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#bbb;font-size:11px">Nenhuma etapa recÃ©m-concluÃ­da</div>';
    return;
  }
  el.innerHTML = data.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cinza2)">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${_finEsc(e.fin_ativos?.cliente_nome||'â€”')}</div>
        <div style="font-size:10px;color:#888">${_finEsc(e.descricao || '')} Â· concluÃ­da ${fmtData(e.data_entrega_realizada)}</div>
      </div>
      <span class="badge b-am">Alerta</span>
    </div>`).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PROJETOS â€” FILA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function carregarFila() {
  const el = document.getElementById('lista-fila');
  el.innerHTML = '<div style="padding:20px;text-align:center;color:#bbb;font-size:11px">Carregandoâ€¦</div>';
  const { data } = await sb.from('fin_ativos')
    .select('*').eq('situacao_financeira', 'rascunho')
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">ðŸ“‹</div>
      <div class="empty-state-title">Nenhum produto aguardando</div>
      <div>Produtos fechados no CRM aparecem aqui automaticamente</div>
    </div>`;
    return;
  }
  el.innerHTML = data.map(a => {
    const viaCRM = a.criado_por === 'crm';
    const ativoIdJs = _finSq(a.id);
    const clienteDisp = _finEsc(a.cliente_nome || '');
    const descDisp = _finEsc(a.descricao || '');
    const legadoDisp = _finEsc(a.num_legado || '');
    const propCodeDisp = _finEsc(a.prop_code || '');
    return `<div class="ativo-card" onclick="abrirAtivo(${ativoIdJs})">
      <div class="ativo-card-hd">
        ${nucleoBadge(a.nucleo)}
        <span class="ativo-card-title">${clienteDisp}</span>
        <span class="badge b-am">Rascunho</span>
        ${viaCRM ? `<span class="badge" style="background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;font-size:8px">â†‘ CRM</span>` : ''}
        <button class="btn btn-pri btn-sm" onclick="event.stopPropagation();finalizarRascunho(${ativoIdJs})" style="margin-left:auto">Finalizar â†’</button>
      </div>
      ${a.descricao ? `<div style="font-size:11px;color:#666;padding:4px 0 2px">${descDisp}</div>` : ''}
      <div class="ativo-card-meta">
        ${a.num_legado ? `<span>ðŸ“ ${legadoDisp}</span>` : ''}
        ${a.prop_code  ? `<span>ðŸ§® ${propCodeDisp}</span>`  : ''}
        ${a.data_contrato ? `<span>ðŸ“… ${fmtData(a.data_contrato)}</span>` : ''}
        ${viaCRM ? `<span title="Criado automaticamente pelo fechamento no CRM">âš¡ Fechado no CRM</span>` : ''}
      </div>
      <div class="ativo-card-footer">
        <div>
          <div class="ativo-valor">${moeda(a.valor_total)}</div>
          <div class="ativo-valor-sub">total cliente</div>
        </div>
        ${a.valor_efetivo_exp ? `<div>
          <div class="ativo-valor" style="color:var(--fin)">${moeda(a.valor_efetivo_exp)}</div>
          <div class="ativo-valor-sub">efetivo EXP</div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PROJETOS â€” ATIVOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function carregarAtivos() {
  const { data } = await sb.from('fin_ativos')
    .select('*').eq('situacao_financeira', 'ativo')
    .order('created_at', { ascending: false });
  G.ativos = data || [];
  filtrarAtivos();
}
function filtrarAtivos() {
  const q = (document.getElementById('filtro-ativos-q')?.value||'').toLowerCase();
  const nucleo = document.getElementById('filtro-ativos-nucleo')?.value;
  const modal = document.getElementById('filtro-ativos-modal')?.value;
  const lista = G.ativos.filter(a =>
    (!q || a.cliente_nome?.toLowerCase().includes(q) || a.num_legado?.toLowerCase().includes(q)) &&
    (!nucleo || a.nucleo === nucleo) &&
    (!modal || a.modalidade_cobranca === modal)
  );
  const el = document.getElementById('lista-ativos');
  if (!lista.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhum projeto ativo</div></div>'; return; }
  el.innerHTML = lista.map(a => ativoCardHTML(a, 'ativo')).join('');
}
async function carregarConcluidos() {
  const { data } = await sb.from('fin_ativos')
    .select('*').eq('situacao_financeira', 'concluido')
    .order('updated_at', { ascending: false });
  const el = document.getElementById('lista-concluidos');
  if (!data?.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhum concluÃ­do</div></div>'; return; }
  el.innerHTML = data.map(a => ativoCardHTML(a, 'concluido')).join('');
}
function filtrarConcluidos() { /* TODO: filtro local */ }

function ativoCardHTML(a, sit) {
  const sitMap = { ativo:'b-vd', concluido:'b-az', rascunho:'b-am', cancelado:'b-tc' };
  const sitLabel = { ativo:'Ativo', concluido:'ConcluÃ­do', rascunho:'Rascunho', cancelado:'Cancelado' };
  const ativoIdJs = _finSq(a.id);
  const clienteDisp = _finEsc(a.cliente_nome || '');
  const legadoDisp = _finEsc(a.num_legado || '');
  const propCodeDisp = _finEsc(a.prop_code || '');
  return `<div class="ativo-card" onclick="abrirAtivo(${ativoIdJs})">
    <div class="ativo-card-hd">
      ${nucleoBadge(a.nucleo)}
      <span class="ativo-card-title">${clienteDisp}</span>
      <span class="badge ${sitMap[sit]||'b-gr'}">${sitLabel[sit]||sit}</span>
      ${a.modalidade_cobranca === 'mensal' ? '<span class="badge b-roxo">Mensal</span>' : ''}
    </div>
    <div class="ativo-card-meta">
      ${a.num_legado ? `<span>ðŸ“ ${legadoDisp}</span>` : ''}
      ${a.prop_code  ? `<span>ðŸ§® ${propCodeDisp}</span>`  : ''}
      <span>ðŸ“… ${fmtData(a.data_contrato)}</span>
    </div>
    <div class="ativo-card-footer">
      <div><div class="ativo-valor">${moeda(a.valor_total)}</div><div class="ativo-valor-sub">total cliente</div></div>
      ${a.valor_efetivo_exp ? `<div><div class="ativo-valor" style="color:var(--fin)">${moeda(a.valor_efetivo_exp)}</div><div class="ativo-valor-sub">efetivo EXP</div></div>` : ''}
    </div>
  </div>`;
}

function abrirAtivo(id) { toast('Detalhes do ativo em breveâ€¦'); }
function abrirModalNovoAtivo() { toast('Cadastro manual em breveâ€¦'); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   COBRANÃ‡A â€” SUB-TABS + AGING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setCobTab(tab) {
  document.querySelectorAll('[data-cobtab]').forEach(b => {
    b.classList.toggle('active', b.dataset.cobtab === tab);
    if (b.dataset.cobtab === 'pipeline') b.style.borderBottomColor = tab === 'pipeline' ? 'var(--fin)' : '';
    if (b.dataset.cobtab === 'aging')    b.style.borderBottomColor = tab === 'aging'    ? 'var(--fin)' : '';
  });
  document.getElementById('cob-tab-pipeline').style.display = tab === 'pipeline' ? '' : 'none';
  document.getElementById('cob-tab-aging').style.display    = tab === 'aging'    ? '' : 'none';
  document.getElementById('cob-filtros-pipeline').style.display = tab === 'pipeline' ? '' : 'none';
  if (tab === 'aging') renderAging();
}

function renderAging() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Parcelas aguardando pagamento com vencimento definido
  const aguardando = (G.parcelas || []).filter(p =>
    p.situacao === 'aguardando_pagamento' && p.data_vencimento
  );

  // Classifica cada parcela
  const com = aguardando.map(p => {
    const dtVenc = new Date(p.data_vencimento + 'T12:00:00');
    const diff   = Math.floor((hoje - dtVenc) / 86400000); // positivo = atrasado
    return { ...p, diff };
  }).sort((a, b) => b.diff - a.diff); // mais atrasado primeiro

  const vencer  = com.filter(p => p.diff <= 0);   // nÃ£o vencido (diff negativo = futuro)
  const d30     = com.filter(p => p.diff > 0  && p.diff <= 30);
  const d60     = com.filter(p => p.diff > 30 && p.diff <= 60);
  const d90     = com.filter(p => p.diff > 60 && p.diff <= 90);
  const dmax    = com.filter(p => p.diff > 90);

  const soma = arr => arr.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

  // Resumo
  const buckets = [
    { key: 'ok',  arr: vencer, cls: '' },
    { key: '30',  arr: d30,    cls: 'd30' },
    { key: '60',  arr: d60,    cls: 'd60' },
    { key: '90',  arr: d90,    cls: 'd90' },
    { key: 'max', arr: dmax,   cls: 'dmax' },
  ];
  buckets.forEach(({ key, arr }) => {
    const v = soma(arr);
    document.getElementById(`ag-val-${key}`).textContent = v > 0 ? moeda(v) : 'â€”';
    document.getElementById(`ag-cnt-${key}`).textContent = `${arr.length} parcela${arr.length !== 1 ? 's' : ''}`;
  });

  // Lista (apenas vencidas)
  const vencidas = com.filter(p => p.diff > 0);
  const el = document.getElementById('aging-lista');

  if (!vencidas.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">âœ…</div>
        <div class="empty-state-title">Nenhuma parcela em atraso</div>
        <div class="empty-state-sub">Todos os recebÃ­veis estÃ£o dentro do prazo</div>
      </div>`;
    return;
  }

  el.innerHTML = vencidas.map(p => {
    const nc  = NUCLEO_MAP[p.fin_ativos?.nucleo] || {};
    const tp  = TIPO_PARCELA_MAP[p.tipo] || { label: p.tipo };
    const cls = p.diff <= 30 ? 'd30' : p.diff <= 60 ? 'd60' : p.diff <= 90 ? 'd90' : 'dmax';
    const parcelaIdJs = _finSq(p.id);
    const clienteDisp = _finEsc(p.fin_ativos?.cliente_nome || 'â€”');
    const nucleoLabelDisp = _finEsc(nc.label || '');
    const legadoDisp = _finEsc(p.fin_ativos?.num_legado || '');
    const tipoDisp = _finEsc(tp.label || '');
    const descDisp = _finEsc(p.descricao || '');
    return `
    <div class="aging-row">
      <div class="aging-row-dias ${cls}">${p.diff}d atraso</div>
      <div class="aging-row-info">
        <div class="aging-row-cliente">${clienteDisp}
          ${nc.cls ? `<span class="badge ${nc.cls}" style="font-size:8px;margin-left:4px">${nucleoLabelDisp}</span>` : ''}
        </div>
        <div class="aging-row-detalhe">
          ${legadoDisp} Â· ${tipoDisp}
          ${p.descricao ? ' Â· ' + descDisp : ''}
          Â· Venceu ${fmtData(p.data_vencimento)}
        </div>
      </div>
      <div class="aging-row-val">${moeda(p.valor)}</div>
      <div class="aging-row-btn">
        <button class="btn btn-pri btn-xs" onclick="confirmarPagamento(${parcelaIdJs})">Confirmar pgto</button>
      </div>
    </div>`;
  }).join('') + `
  <div style="padding:12px 0;font-size:11px;font-weight:700;color:var(--terracota);text-align:right">
    Total em atraso: ${moeda(soma(vencidas))}
    <span style="color:#aaa;font-weight:400;margin-left:8px">${vencidas.length} parcela${vencidas.length !== 1 ? 's' : ''}</span>
  </div>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PIPELINE DE COBRANÃ‡A
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function carregarPipeline() {
  const nucleo = document.getElementById('cob-filtro-nucleo')?.value;
  const tipo   = document.getElementById('cob-filtro-tipo')?.value;

  let q = sb.from('fin_parcelas')
    .select('*, fin_ativos(cliente_nome, num_legado, nucleo)')
    .in('situacao', ['entregue','a_emitir','aguardando_pagamento','pago'])
    .order('data_prevista_cobranca');

  const { data: all } = await q;
  G.parcelas = all || [];

  const filtradas = G.parcelas.filter(p =>
    (!tipo || p.tipo === tipo) &&
    (!nucleo || p.fin_ativos?.nucleo === nucleo)
  );

  const cols = {
    emitir:     filtradas.filter(p => ['entregue','a_emitir'].includes(p.situacao)),
    aguardando: filtradas.filter(p => p.situacao === 'aguardando_pagamento'),
    pago:       filtradas.filter(p => p.situacao === 'pago'),
  };

  document.getElementById('cnt-emitir').textContent     = cols.emitir.length;
  document.getElementById('cnt-aguardando').textContent  = cols.aguardando.length;
  document.getElementById('cnt-pago').textContent        = cols.pago.length;

  renderColuna('col-emitir', cols.emitir, 'emitir');
  renderColuna('col-aguardando', cols.aguardando, 'aguardando');
  renderColuna('col-pago', cols.pago, 'pago');
}

function renderColuna(elId, parcelas, colTipo) {
  const el = document.getElementById(elId);
  if (!parcelas.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#bbb;font-size:11px">Nenhuma parcela</div>';
    return;
  }
  el.innerHTML = parcelas.map(p => kanbanCard(p, colTipo)).join('');
}

function kanbanCard(p, colTipo) {
  const tp  = TIPO_PARCELA_MAP[p.tipo] || { label: p.tipo, cls: 'b-gr', cor: '#888' };
  const nc  = NUCLEO_MAP[p.fin_ativos?.nucleo] || {};
  const dias = diasDesde(p.data_prevista_cobranca);
  const vencido = dias > 0 && colTipo !== 'pago';
  const parcelaIdJs = _finSq(p.id);
  const tipoDisp = _finEsc(tp.label || p.tipo || '');
  const nucleoLabelDisp = _finEsc(nc.label || '');
  const clienteDisp = _finEsc(p.fin_ativos?.cliente_nome || 'â€”');
  const legadoDisp = _finEsc(p.fin_ativos?.num_legado || '');
  const descDisp = _finEsc(p.descricao || '');

  let footerBtn = '';
  if (colTipo === 'emitir') {
    footerBtn = `<button class="btn btn-pri btn-xs" onclick="event.stopPropagation();emitirParcela(${parcelaIdJs})">Emitir NF</button>`;
  } else if (colTipo === 'aguardando') {
    footerBtn = `<button class="btn btn-sec btn-xs" onclick="event.stopPropagation();confirmarPagamento(${parcelaIdJs})">Confirmar pgto</button>`;
  }

  return `<div class="kanban-card" onclick="abrirParcelaModal(${parcelaIdJs})">
    <div class="kc-tipo">
      <span class="tipo-dot ${tp.cls}" style="background:${tp.cor}"></span>
      ${tipoDisp}
      ${nc.cls ? `Â· <span class="badge ${nc.cls}" style="padding:1px 5px">${nucleoLabelDisp}</span>` : ''}
    </div>
    <div class="kc-cliente">${clienteDisp}</div>
    <div class="kc-projeto">${legadoDisp} ${p.descricao ? 'Â· ' + descDisp : ''}</div>
    <div class="kc-valor">${moeda(p.valor)}</div>
    <div class="kc-meta">
      ${colTipo === 'emitir' ? `Previsto: ${fmtData(p.data_prevista_cobranca)}` : ''}
      ${colTipo === 'aguardando' ? `Vence: ${fmtData(p.data_vencimento)||'â€”'}` : ''}
      ${colTipo === 'pago' ? `Pago em: ${fmtData(p.data_pagamento)}` : ''}
      ${vencido ? `<span style="color:var(--terracota);font-weight:700"> Â· ${dias}d atrasado</span>` : ''}
    </div>
    <div class="kc-footer">${footerBtn}<span style="font-size:9px;color:#bbb">#${p.id.slice(-6)}</span></div>
  </div>`;
}

async function emitirParcela(id) {
  const nf = prompt('NÃºmero da NF (deixe em branco se ainda nÃ£o tem):');
  const { error } = await sb.from('fin_parcelas').update({
    situacao: 'aguardando_pagamento',
    numero_nf: nf || null,
    data_emissao_nf: new Date().toISOString().split('T')[0],
  }).eq('id', id);
  if (error) { toast('Erro ao emitir parcela', 'erro'); return; }
  toast('Parcela marcada como emitida âœ“', 'ok');
  carregarPipeline();
}

let G_pgtoId = null;

function confirmarPagamento(id) {
  const p = (G.parcelas || []).find(x => x.id === id);
  G_pgtoId = id;

  document.getElementById('pgto-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('pgto-obs').value  = '';
  document.getElementById('pgto-cliente-label').textContent =
    p?.fin_ativos?.cliente_nome || 'Cliente';
  document.getElementById('pgto-valor-label').textContent =
    p ? moeda(p.valor) : 'â€”';
  document.getElementById('pgto-desc-label').textContent =
    [p?.fin_ativos?.num_legado, p?.descricao].filter(Boolean).join(' Â· ') || 'â€”';

  // Preencher contas bancÃ¡rias
  const sel = document.getElementById('pgto-conta');
  sel.innerHTML = '<option value="">Sem vÃ­nculo de conta</option>' +
    (G.contasBancarias || []).map(c =>
      `<option value="${_finAttr(c.id)}">${_finEsc(c.nome)}</option>`
    ).join('');

  abrirModal('modal-confirmar-pgto');
}

async function salvarConfirmacaoPgto() {
  if (!G_pgtoId) return;
  const data     = document.getElementById('pgto-data').value;
  const contaId  = document.getElementById('pgto-conta').value || null;
  const obs      = document.getElementById('pgto-obs').value.trim() || null;
  if (!data) { toast('Informe a data de pagamento', 'erro'); return; }

  const p = (G.parcelas || []).find(x => x.id === G_pgtoId);

  // 1. Atualiza fin_parcelas
  const { error: errParcela } = await sb.from('fin_parcelas').update({
    situacao: 'pago',
    data_pagamento: data,
    conta_bancaria_id: contaId,
  }).eq('id', G_pgtoId);
  if (errParcela) { toast('Erro: ' + errParcela.message, 'erro'); return; }

  // 2. Baixa em fin_lancamentos â€” tenta atualizar lanÃ§amento existente ligado Ã  parcela
  const { data: lancExist } = await sb.from('fin_lancamentos')
    .select('id').eq('parcela_id', G_pgtoId).limit(1);

  if (lancExist?.length) {
    await sb.from('fin_lancamentos').update({
      situacao: 'pago',
      data_pagamento: data,
      conta_bancaria_id: contaId,
      ...(obs ? { observacao: obs } : {}),
    }).eq('id', lancExist[0].id);
  } else if (p) {
    // Cria o lanÃ§amento de receita se nÃ£o existia
    const pcId = p.plano_contas_id ||
      (G.planoContas.find(pc => pc.grupo === 'Receita Bruta' &&
        (p.fin_ativos?.nucleo ? pc.nucleo_crm === p.fin_ativos.nucleo : true)))?.id || null;
    await sb.from('fin_lancamentos').insert({
      data_competencia: data,
      data_pagamento:   data,
      fornecedor_cliente: p.fin_ativos?.cliente_nome || null,
      observacao: obs || [p.fin_ativos?.num_legado, p.descricao].filter(Boolean).join(' Â· ') || 'Pagamento recebido',
      valor: p.valor,
      tipo: 'receita',
      situacao: 'pago',
      origem: 'crm',
      parcela_id: G_pgtoId,
      ativo_id: p.ativo_id || null,
      plano_contas_id: pcId,
      conta_bancaria_id: contaId,
      criado_por_id: G.usuario?.id || null,
      criado_por_nome: G.usuario?.nome || null,
    });
  }

  toast('Pagamento confirmado e baixa realizada âœ“', 'ok');
  fecharModal('modal-confirmar-pgto');
  G_pgtoId = null;
  carregarPipeline();
  if (document.getElementById('page-dre')?.classList.contains('active')) carregarDRE();
}

function abrirParcelaModal(id) {
  const p = G.parcelas.find(x => x.id === id);
  if (!p) return;
  const tp = TIPO_PARCELA_MAP[p.tipo] || {};
  const parcelaIdJs = _finSq(p.id);
  const tituloDisp = _finEsc(tp.label || p.tipo || '');
  const clienteDisp = _finEsc(p.fin_ativos?.cliente_nome || 'â€”');
  const legadoDisp = _finEsc(p.fin_ativos?.num_legado || 'â€”');
  const descDisp = _finEsc(p.descricao || '');
  document.getElementById('modal-parcela-titulo').textContent =
    `${tp.label || p.tipo} Â· ${p.fin_ativos?.cliente_nome || 'â€”'}`;
  document.getElementById('modal-parcela-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="font-size:9px;font-weight:700;color:#888">CLIENTE</div><div style="font-size:13px;font-weight:600">${clienteDisp}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">PROJETO</div><div>${legadoDisp}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">TIPO</div><div>${tituloDisp}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">SITUAÃ‡ÃƒO</div><div>${sitBadge(p.situacao)}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">VALOR</div><div style="font-size:18px;font-weight:700">${moeda(p.valor)}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">%</div><div>${p.percentual ? p.percentual + '%' : 'â€”'}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">PREV. COBRANÃ‡A</div><div>${fmtData(p.data_prevista_cobranca)}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">NF</div><div>${p.numero_nf||'â€”'}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">EMISSÃƒO NF</div><div>${fmtData(p.data_emissao_nf)}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:#888">VENCIMENTO</div><div>${fmtData(p.data_vencimento)}</div></div>
      ${p.data_pagamento ? `<div><div style="font-size:9px;font-weight:700;color:#888">PAGO EM</div><div style="color:var(--verde);font-weight:700">${fmtData(p.data_pagamento)}</div></div>` : ''}
    </div>
  `;
  let btns = `<button class="btn btn-sec" onclick="fecharModal('modal-parcela')">Fechar</button>`;
  if (p.situacao === 'entregue' || p.situacao === 'a_emitir')
    btns += `<button class="btn btn-pri" onclick="fecharModal('modal-parcela');emitirParcela(${parcelaIdJs})">Emitir NF</button>`;
  if (p.situacao === 'aguardando_pagamento')
    btns += `<button class="btn btn-pri" style="background:var(--verde)" onclick="fecharModal('modal-parcela');confirmarPagamento(${parcelaIdJs})">Confirmar pagamento</button>`;
  document.getElementById('modal-parcela-footer').innerHTML = btns;
  abrirModal('modal-parcela');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   LANÃ‡AMENTOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function carregarLancamentos() {
  const { data } = await sb.from('fin_lancamentos')
    .select('*').order('data_competencia', { ascending: false }).limit(200);
  G.lancamentos = data || [];
  // popular select de mÃªs
  const meses = [...new Set(G.lancamentos.map(l => l.mes_ano_competencia).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('lanc-mes');
  if (sel) sel.innerHTML = '<option value="">Todos os meses</option>' +
    meses.map(m => `<option value="${_finAttr(m)}">${_finEsc(m.slice(0,2) + '/' + m.slice(2))}</option>`).join('');
  filtrarLancamentos();
}

function filtrarLancamentos() {
  const q    = (document.getElementById('lanc-q')?.value||'').toLowerCase();
  const mes  = document.getElementById('lanc-mes')?.value;
  const sit  = document.getElementById('lanc-situacao')?.value;
  const tipo = document.getElementById('lanc-tipo')?.value;
  const grp  = document.getElementById('lanc-grupo')?.value;
  const ct   = document.getElementById('lanc-conta')?.value;

  const lista = G.lancamentos.filter(l =>
    (!q   || (l.observacao||'').toLowerCase().includes(q) || (l.fornecedor_cliente||'').toLowerCase().includes(q) || (l.nf||'').toLowerCase().includes(q)) &&
    (!mes  || l.mes_ano_competencia === mes) &&
    (!sit  || l.situacao === sit) &&
    (!tipo || l.tipo === tipo) &&
    (!grp  || l.grupo === grp) &&
    (!ct   || l.conta_bancaria_id === ct)
  );

  let entrada = 0, saida = 0;
  lista.forEach(l => {
    if (l.entrada) entrada += parseFloat(l.entrada);
    if (l.saida)   saida   += parseFloat(l.saida);
  });
  const saldo = entrada - saida;

  document.getElementById('lanc-total-entrada').textContent = moeda(entrada, true);
  document.getElementById('lanc-total-saida').textContent   = moeda(saida, true);
  const sEl = document.getElementById('lanc-total-saldo');
  sEl.textContent = moeda(Math.abs(saldo), true);
  sEl.style.color = saldo >= 0 ? 'var(--verde)' : 'var(--terracota)';
  document.getElementById('lanc-total-count').textContent = lista.length;

  const tbody = document.getElementById('lanc-tbody');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="tbl-empty">Nenhum lanÃ§amento encontrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(l => {
    const mesAno = l.mes_ano_competencia || '';
    const bloq   = G._mesesFechados.has(mesAno);
    const lancIdJs = _finSq(l.id);
    const principalDisp = _finEsc(l.fornecedor_cliente||l.observacao||'â€”');
    const obsDisp = _finEsc(l.observacao||'');
    const subcontaDisp = _finEsc(l.subconta||l.grupo||'â€”');
    const nfDisp = _finEsc(l.nf||'â€”');
    return `
    <tr${bloq ? ' style="opacity:.75"' : ''}>
      <td>${fmtMesAno(l.data_competencia)}${bloq ? ' <span title="MÃªs fechado" style="font-size:10px">ðŸ”’</span>' : ''}</td>
      <td>${fmtData(l.data_prevista) || fmtData(l.data_pagamento)}</td>
      <td>
        <div style="font-weight:500">${principalDisp}</div>
        ${origemLancBadge(l)}
        ${l.observacao && l.fornecedor_cliente ? `<div style="font-size:10px;color:#888">${obsDisp}</div>` : ''}
      </td>
      <td style="font-size:10px;color:#888">${subcontaDisp}</td>
      <td>${sitBadge(l.situacao)}</td>
      <td style="font-size:10px">${nfDisp}</td>
      <td style="text-align:right;font-weight:600;color:var(--verde)">${l.entrada ? moeda(l.entrada,true) : ''}</td>
      <td style="text-align:right;font-weight:600;color:var(--terracota)">${l.saida ? moeda(l.saida,true) : ''}</td>
      <td>${bloq
        ? '<span title="MÃªs fechado â€” ediÃ§Ã£o bloqueada" style="font-size:14px;cursor:default">ðŸ”’</span>'
        : `<button class="btn btn-ghost btn-xs" onclick="editarLancamento(${lancIdJs})">âœ</button>`
      }</td>
    </tr>`;
  }).join('');
}

let _lancEditId = null;
let _lancOrigemMode = 'manual';

function abrirModalLancamento(id) {
  _lancOrigemMode = 'manual';
  _lancEditId = id || null;
  document.getElementById('modal-lanc-titulo').textContent = id ? 'Editar LanÃ§amento' : 'Novo LanÃ§amento';

  // Limpar campos
  ['lanc-competencia','lanc-prevista','lanc-pagamento','lanc-descricao',
   'lanc-nf','lanc-valor','lanc-conta-bancaria','lanc-forma','lanc-origem-ref'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });
  const banner = document.getElementById('lanc-origem-banner');
  if (banner) { banner.style.display = 'none'; banner.textContent = ''; }
  const refRow = document.getElementById('lanc-ref-row');
  if (refRow) refRow.style.display = 'none';
  const sit = document.getElementById('lanc-situacao-form');
  if (sit) sit.value = 'previsto';
  const plano = document.getElementById('lanc-plano');
  if (plano) plano.value = '';

  // Preencher campos se estiver editando
  if (id) {
    const l = G.lancamentos.find(x => x.id === id);
    if (l) {
      _lancOrigemMode = l.origem === 'pagamento_extraordinario' ? 'pagamento_extraordinario' : 'manual';
      if (document.getElementById('lanc-competencia')) document.getElementById('lanc-competencia').value = l.data_competencia || '';
      if (document.getElementById('lanc-prevista'))    document.getElementById('lanc-prevista').value    = l.data_prevista   || '';
      if (document.getElementById('lanc-pagamento'))   document.getElementById('lanc-pagamento').value   = l.data_pagamento  || '';
      if (document.getElementById('lanc-descricao'))   document.getElementById('lanc-descricao').value   = l.fornecedor_cliente || l.observacao || '';
      if (document.getElementById('lanc-nf'))          document.getElementById('lanc-nf').value          = l.nf || '';
      if (document.getElementById('lanc-valor'))       document.getElementById('lanc-valor').value       = l.valor || '';
      if (document.getElementById('lanc-plano'))       document.getElementById('lanc-plano').value       = l.plano_contas_id || '';
      if (document.getElementById('lanc-conta-bancaria')) document.getElementById('lanc-conta-bancaria').value = l.conta_bancaria_id || '';
      if (document.getElementById('lanc-forma'))       document.getElementById('lanc-forma').value       = l.forma_pagamento || '';
      if (document.getElementById('lanc-situacao-form')) document.getElementById('lanc-situacao-form').value = l.situacao || 'previsto';
      if (document.getElementById('lanc-origem-ref')) document.getElementById('lanc-origem-ref').value = l.origem_id || '';
      if (_lancOrigemMode === 'pagamento_extraordinario') {
        document.getElementById('modal-lanc-titulo').textContent = 'Editar Pagamento ExtraordinÃ¡rio';
        if (banner) {
          banner.style.display = 'block';
          banner.textContent = 'Este lanÃ§amento estÃ¡ marcado como pagamento extraordinÃ¡rio de horas adicionais.';
        }
        if (refRow) refRow.style.display = '';
      }
    }
  }

  abrirModal('modal-lancamento');
}
function abrirModalPagamentoExtraordinario() {
  abrirModalLancamento();
  _lancOrigemMode = 'pagamento_extraordinario';
  document.getElementById('modal-lanc-titulo').textContent = 'Novo Pagamento ExtraordinÃ¡rio';
  const banner = document.getElementById('lanc-origem-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'Use esta entrada apenas para horas adicionais jÃ¡ aprovadas para pagamento. Registre a saÃ­da com valor negativo.';
  }
  const refRow = document.getElementById('lanc-ref-row');
  if (refRow) refRow.style.display = '';
  const sit = document.getElementById('lanc-situacao-form');
  if (sit) sit.value = 'a_pagar';
  const desc = document.getElementById('lanc-descricao');
  if (desc) desc.placeholder = 'Ex: Pagamento extraordinÃ¡rio de horas adicionais - Colaborador X';
}
function editarLancamento(id) { abrirModalLancamento(id); }

async function salvarLancamento() {
  const competencia = document.getElementById('lanc-competencia').value;
  const descricao   = document.getElementById('lanc-descricao').value;
  const valor       = parseFloat(document.getElementById('lanc-valor').value);
  const plano       = document.getElementById('lanc-plano').value;
  if (!competencia || !descricao || isNaN(valor) || !plano) {
    toast('Preencha os campos obrigatÃ³rios', 'erro'); return;
  }
  // Bloquear mÃªs fechado
  const [y, m] = competencia.split('-');
  const mesAnoKey = m + y;
  if (G._mesesFechados.has(mesAnoKey)) {
    toast('Este mÃªs estÃ¡ fechado. Reabra-o antes de editar.', 'erro'); return;
  }
  const payload = {
    data_competencia:   competencia,
    data_prevista:      document.getElementById('lanc-prevista').value || null,
    data_pagamento:     document.getElementById('lanc-pagamento').value || null,
    fornecedor_cliente: descricao,
    nf:                 document.getElementById('lanc-nf').value || null,
    valor,
    plano_contas_id:    plano,
    conta_bancaria_id:  document.getElementById('lanc-conta-bancaria').value || null,
    forma_pagamento:    document.getElementById('lanc-forma').value || null,
    situacao:           document.getElementById('lanc-situacao-form').value,
  };
  const origemRef = document.getElementById('lanc-origem-ref')?.value?.trim() || null;
  if (origemRef) payload.origem_id = origemRef;
  if (_lancOrigemMode === 'pagamento_extraordinario') {
    payload.observacao = 'Pagamento extraordinario de horas adicionais';
  }
  let error;
  if (_lancEditId) {
    ({ error } = await sb.from('fin_lancamentos').update(payload).eq('id', _lancEditId));
  } else {
    payload.origem = _lancOrigemMode === 'pagamento_extraordinario' ? 'pagamento_extraordinario' : 'manual';
    payload.criado_por_id   = G.usuario.id;
    payload.criado_por_nome = G.usuario.nome;
    ({ error } = await sb.from('fin_lancamentos').insert(payload));
  }
  if (error) { toast('Erro ao salvar: ' + error.message, 'erro'); return; }
  toast(_lancEditId ? 'LanÃ§amento atualizado âœ“' : 'LanÃ§amento salvo âœ“', 'ok');
  _lancEditId = null;
  fecharModal('modal-lancamento');
  carregarLancamentos();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   CONCILIAÃ‡ÃƒO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function abrirImportExtrato() { toast('ImportaÃ§Ã£o de extrato em breveâ€¦'); }
function carregarConciliacao() { /* TODO */ }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   FECHAMENTO MENSAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function carregarFechamentos() {
  const { data } = await sb.from('fin_fechamentos')
    .select('*').order('ano', { ascending: false }).order('mes', { ascending: false });
  G.fechamentos = data || [];
  G._mesesFechados = new Set(G.fechamentos.map(f => f.mes_ano));
}

function renderFechamentos() {
  const el = document.getElementById('fech-lista');
  if (!el) return;

  // Gerar lista de meses desde Jan/2026 atÃ© mÃªs atual
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const meses = [];
  for (let ano = 2026; ano <= anoAtual; ano++) {
    const fim = (ano === anoAtual) ? mesAtual : 12;
    for (let mes = 1; mes <= fim; mes++) {
      meses.push({ ano, mes });
    }
  }
  meses.reverse(); // mais recente primeiro

  if (!meses.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhum mÃªs disponÃ­vel</div></div>';
    return;
  }

  el.innerHTML = meses.map(({ ano, mes }) => {
    const key  = String(mes).padStart(2,'0') + ano;
    const fech = G.fechamentos.find(f => f.mes_ano === key);
    const isAtual = (ano === anoAtual && mes === mesAtual);
    const nomeMes = MESES_FULL[mes - 1] + ' ' + ano;
    const nomeMesDisp = _finEsc(nomeMes);

    if (fech) {
      const snapItens = [
        { lbl: 'Rec. Bruta',   val: fech.snap_receita_bruta },
        { lbl: 'Rec. LÃ­quida', val: fech.snap_receita_liq },
        { lbl: 'Lucro Bruto',  val: fech.snap_lucro_bruto },
        { lbl: 'Res. Op.',     val: fech.snap_resultado_op },
        { lbl: 'Res. LÃ­quido', val: fech.snap_resultado_liq },
        { lbl: 'Margem LÃ­q.',  val: fech.snap_margem_liq, pct: true },
      ].map(s => `
        <div class="fech-snap-item">
          <div class="fech-snap-lbl">${s.lbl}</div>
          <div class="fech-snap-val" style="color:${s.pct ? (s.val>=0?'var(--verde)':'var(--terracota)') : (s.val>=0?'var(--grafite)':'var(--terracota)')}">${
            s.pct ? (s.val != null ? s.val.toFixed(1)+'%' : 'â€”') : moeda(s.val, true)
          }</div>
        </div>`).join('');

      const fechadoPor = fech.fechado_por_nome ? ` Â· por ${_finEsc(fech.fechado_por_nome)}` : '';
      const fechadoEm  = fech.created_at ? ' Â· ' + fmtData(fech.created_at.slice(0,10)) : '';
      const notasDisp = _finEsc(fech.notas || '');

      return `
      <div class="fech-row fechado">
        <span class="fech-lock">ðŸ”’</span>
        <div class="fech-mes">${nomeMesDisp}</div>
        <div class="fech-snap">${snapItens}</div>
        <div class="fech-meta">Fechado${fechadoPor}${fechadoEm}${fech.notas ? '<br><em>' + notasDisp + '</em>' : ''}</div>
        <div class="fech-actions">
          ${G.isSocio ? `<button class="btn btn-ghost btn-xs" onclick="reabrirMes(${_finSq(fech.id)},${_finSq(nomeMes)})">Reabrir</button>` : ''}
        </div>
      </div>`;
    } else {
      return `
      <div class="fech-row${isAtual ? ' atual' : ''}">
        <span class="fech-lock" style="opacity:.3">ðŸ”“</span>
        <div class="fech-mes">${nomeMesDisp}${isAtual ? ' <span style="font-size:9px;color:var(--azul);font-weight:400">atual</span>' : ''}</div>
        <div class="fech-snap" style="color:#aaa;font-size:11px;align-items:center">MÃªs em aberto</div>
        <div class="fech-meta"></div>
        <div class="fech-actions">
          ${G.isSocio ? `<button class="btn btn-pri btn-sm" onclick="abrirFecharMes(${ano},${mes})">Fechar mÃªs</button>` : ''}
        </div>
      </div>`;
    }
  }).join('');
}

// Calcula snapshot DRE para um mÃªs especÃ­fico (retorna objeto snap)
async function calcSnapMes(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const fim    = new Date(ano, mes, 0); // Ãºltimo dia do mÃªs
  const fimStr = `${ano}-${String(mes).padStart(2,'0')}-${String(fim.getDate()).padStart(2,'0')}`;

  const { data } = await sb.from('fin_lancamentos')
    .select('valor, situacao, tipo, grupo, fin_plano_contas(grupo, subconta, tipo, aparece_dre)')
    .gte('data_competencia', inicio)
    .lte('data_competencia', fimStr)
    .neq('situacao', 'cancelado')
    .not('plano_contas_id', 'is', null);

  const lancs = data || [];
  // Agregar por grupo (apenas aparece_dre)
  const porGrupo = {};
  for (const l of lancs) {
    const pc = l.fin_plano_contas;
    if (!pc || !pc.aparece_dre) continue;
    const g = pc.grupo;
    if (!porGrupo[g]) porGrupo[g] = 0;
    porGrupo[g] += parseFloat(l.valor) || 0;
  }
  const get = (...grps) => grps.reduce((s, g) => s + (porGrupo[g] || 0), 0);

  const recBruta  = get('Receita Bruta', 'Receita Financeira');
  const deducoes  = get('DeduÃ§Ãµes');
  const recLiq    = recBruta - deducoes;
  const custos    = get('Custos Diretos', 'Custo de Venda');
  const lucroBruto = recLiq - custos;
  const despOp    = get('Despesas com Pessoal','Despesas Administrativas','Despesas com OperaÃ§Ã£o','Despesas com Marketing','Outras Despesas');
  const resOp     = lucroBruto - despOp;
  const despFin   = get('Investimentos','Despesa Financeira','DepreciaÃ§Ã£o','CAPEX');
  const resLiq    = resOp - despFin;
  const margemLiq = recLiq > 0 ? (resLiq / recLiq * 100) : 0;

  const totalEntradas = lancs.filter(l => l.tipo === 'receita').reduce((s, l) => s + (parseFloat(l.valor)||0), 0);
  const totalDespesas = lancs.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (parseFloat(l.valor)||0), 0);

  return {
    snap_receita_bruta:  Math.round(recBruta  * 100) / 100,
    snap_receita_liq:    Math.round(recLiq    * 100) / 100,
    snap_lucro_bruto:    Math.round(lucroBruto* 100) / 100,
    snap_resultado_op:   Math.round(resOp     * 100) / 100,
    snap_resultado_liq:  Math.round(resLiq    * 100) / 100,
    snap_margem_liq:     Math.round(margemLiq * 100) / 100,
    snap_total_entradas: Math.round(totalEntradas * 100) / 100,
    snap_total_despesas: Math.round(totalDespesas * 100) / 100,
  };
}

let G_fechMes = null; // contexto do mÃªs sendo fechado

async function abrirFecharMes(ano, mes) {
  if (!G.isSocio) return;
  const nomeMes = MESES_FULL[mes - 1] + ' ' + ano;
  document.getElementById('fech-modal-titulo').textContent = `Fechar ${nomeMes}`;
  document.getElementById('fech-modal-desc').textContent = `Calculando resultado de ${nomeMes}â€¦`;
  document.getElementById('fech-preview-dre').innerHTML = '<div style="text-align:center;color:#aaa;padding:20px">Carregandoâ€¦</div>';
  document.getElementById('fech-notas').value = '';
  document.getElementById('fech-btn-confirmar').disabled = true;
  abrirModal('modal-fechar-mes');

  const snap = await calcSnapMes(ano, mes);
  G_fechMes = { ano, mes, snap, nomeMes };

  document.getElementById('fech-modal-desc').textContent =
    `Ao fechar ${nomeMes}, todos os lanÃ§amentos do perÃ­odo ficam bloqueados. O snapshot abaixo Ã© salvo para histÃ³rico.`;

  const linhas = [
    ['Receita Bruta',         snap.snap_receita_bruta,  false],
    ['Receita LÃ­quida',       snap.snap_receita_liq,    false],
    ['Lucro Bruto',           snap.snap_lucro_bruto,    false],
    ['Resultado Operacional', snap.snap_resultado_op,   false],
    ['Resultado LÃ­quido',     snap.snap_resultado_liq,  false],
    ['Margem LÃ­quida',        snap.snap_margem_liq,     true ],
    ['Total Entradas',        snap.snap_total_entradas, false],
    ['Total Despesas',        snap.snap_total_despesas, false],
  ];

  document.getElementById('fech-preview-dre').innerHTML = linhas.map(([lbl, val, pct], i) => `
    <div class="fech-preview-row${i >= linhas.length - 3 ? ' total' : ''}">
      <span class="fech-preview-lbl">${lbl}</span>
      <span class="fech-preview-val" style="color:${val >= 0 ? 'var(--verde)' : 'var(--terracota)'}">
        ${pct ? val.toFixed(1) + '%' : moeda(val, true)}
      </span>
    </div>`).join('');

  document.getElementById('fech-btn-confirmar').disabled = false;
}

async function confirmarFecharMes() {
  if (!G_fechMes || !G.isSocio) return;
  const { ano, mes, snap, nomeMes } = G_fechMes;
  const notas = document.getElementById('fech-notas').value.trim() || null;
  const key   = String(mes).padStart(2,'0') + ano;

  const payload = {
    ano,
    mes,
    mes_ano: key,
    fechado_por_id:   G.usuario.id,
    fechado_por_nome: G.usuario.nome,
    notas,
    ...snap,
  };

  const btn = document.getElementById('fech-btn-confirmar');
  btn.disabled = true;
  btn.textContent = 'Fechandoâ€¦';

  const { error } = await sb.from('fin_fechamentos').insert(payload);
  if (error) {
    toast('Erro ao fechar: ' + error.message, 'erro');
    btn.disabled = false;
    btn.textContent = 'ðŸ”’ Fechar MÃªs';
    return;
  }

  toast(`${nomeMes} fechado âœ“`, 'ok');
  fecharModal('modal-fechar-mes');
  await carregarFechamentos();
  renderFechamentos();
  G_fechMes = null;
}

async function reabrirMes(id, nomeMes) {
  if (!G.isSocio) return;
  if (!confirm(`Reabrir ${nomeMes}?\n\nO mÃªs voltarÃ¡ a ser editÃ¡vel e o snapshot serÃ¡ removido.`)) return;

  const { error } = await sb.from('fin_fechamentos').delete().eq('id', id);
  if (error) { toast('Erro ao reabrir: ' + error.message, 'erro'); return; }

  toast(`${nomeMes} reaberto âœ“`, 'ok');
  await carregarFechamentos();
  renderFechamentos();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   CONFIG â€” PLANO DE CONTAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderPlano() {
  const q    = (document.getElementById('pc-q')?.value||'').toLowerCase();
  const tipo = document.getElementById('pc-tipo')?.value;
  const dados = G.planoContas.filter(p =>
    (!q    || p.subconta.toLowerCase().includes(q) || p.grupo.toLowerCase().includes(q)) &&
    (!tipo || p.tipo === tipo)
  );
  // agrupar por grupo
  const grupos = {};
  dados.forEach(p => {
    if (!grupos[p.grupo]) grupos[p.grupo] = [];
    grupos[p.grupo].push(p);
  });
  const el = document.getElementById('pc-lista');
  if (!Object.keys(grupos).length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhuma subconta encontrada</div></div>';
    return;
  }
  el.innerHTML = Object.entries(grupos).map(([grp, items]) => `
    <div class="pc-grupo">
      <div class="pc-grupo-hd" onclick="toggleGrupo(${_finSq(grp)})">
        <span class="pc-grupo-label">${_finEsc(grp.replace(/_/g,' '))}</span>
        <span class="pc-grupo-count">${items.length} subconta${items.length>1?'s':''}</span>
        <span style="color:#888;font-size:10px">â–¾</span>
      </div>
      <div class="pc-grupo-body open" id="grp-${grp.replace(/[^a-z0-9]/gi,'-')}">
        ${items.map(p => `
          <div class="pc-item">
            <span class="pc-item-nome">${_finEsc(p.subconta)}</span>
            <span class="badge ${p.tipo==='receita'?'b-vd':p.tipo==='despesa'?'b-tc':'b-gr'}">${_finEsc(p.tipo)}</span>
            ${p.nucleo_crm ? `<span class="badge b-az" style="font-size:8px">${_finEsc(p.nucleo_crm)}</span>` : ''}
            ${G.isSocio ? `<button class="btn btn-ghost btn-xs" onclick="editarSubconta(${_finSq(p.id)})">âœ</button>` : ''}
          </div>`).join('')}
      </div>
    </div>`).join('');
}
function toggleGrupo(grp) {
  const id = 'grp-' + grp.replace(/[^a-z0-9]/gi,'-');
  document.getElementById(id)?.classList.toggle('open');
}
function filtrarPlano() { renderPlano(); }

let _subEditId = null;

function abrirModalSubconta(id) {
  _subEditId = id || null;
  document.getElementById('modal-sub-titulo').textContent = id ? 'Editar Subconta' : 'Nova Subconta';

  // Limpar campos
  ['sub-nome','sub-nucleo'].forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
  ['sub-grupo','sub-tipo'].forEach(fid => { const el = document.getElementById(fid); if (el) el.value = el.options[0]?.value || ''; });
  const dre = document.getElementById('sub-dre'); if (dre) dre.value = 'true';
  const dfc = document.getElementById('sub-dfc'); if (dfc) dfc.value = 'false';

  // Preencher se editando
  if (id) {
    const s = G.planoContas.find(x => x.id === id);
    if (s) {
      if (document.getElementById('sub-nome'))   document.getElementById('sub-nome').value   = s.subconta || '';
      if (document.getElementById('sub-grupo'))  document.getElementById('sub-grupo').value  = s.grupo    || '';
      if (document.getElementById('sub-tipo'))   document.getElementById('sub-tipo').value   = s.tipo     || '';
      if (document.getElementById('sub-dre'))    document.getElementById('sub-dre').value    = String(s.aparece_dre ?? true);
      if (document.getElementById('sub-dfc'))    document.getElementById('sub-dfc').value    = String(s.aparece_dfc ?? false);
      if (document.getElementById('sub-nucleo')) document.getElementById('sub-nucleo').value = s.nucleo_crm || '';
    }
  }

  abrirModal('modal-subconta');
}
function editarSubconta(id) { abrirModalSubconta(id); }

async function salvarSubconta() {
  const nome  = document.getElementById('sub-nome').value.trim();
  const grupo = document.getElementById('sub-grupo').value;
  const tipo  = document.getElementById('sub-tipo').value;
  if (!nome || !grupo) { toast('Preencha nome e grupo', 'erro'); return; }
  const payload = {
    grupo, subconta: nome, tipo,
    aparece_dre:   document.getElementById('sub-dre').value === 'true',
    aparece_dfc:   document.getElementById('sub-dfc').value === 'true',
    nucleo_crm:    document.getElementById('sub-nucleo').value || null,
    origem_modulo: _subEditId ? undefined : 'manual',
    ativo: true,
  };
  if (!_subEditId) payload.origem_modulo = 'manual';
  let error;
  if (_subEditId) {
    ({ error } = await sb.from('fin_plano_contas').update(payload).eq('id', _subEditId));
  } else {
    ({ error } = await sb.from('fin_plano_contas').insert(payload));
  }
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast(_subEditId ? 'Subconta atualizada âœ“' : 'Subconta criada âœ“', 'ok');
  _subEditId = null;
  fecharModal('modal-subconta');
  await carregarPlanoContas();
  renderPlano();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   CONFIG â€” CONTAS BANCÃRIAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderContas() {
  const el = document.getElementById('contas-lista');
  const ICON = { corrente:'ðŸ¦', aplicacao:'ðŸ“ˆ', investimento:'ðŸ’°' };
  if (!G.contasBancarias.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhuma conta cadastrada</div></div>';
    return;
  }
  el.innerHTML = G.contasBancarias.map(c => `
    <div class="conta-card">
      <div class="conta-icon">${ICON[c.tipo]||'ðŸ¦'}</div>
      <div class="conta-info">
        <div class="conta-nome">${_finEsc(c.nome)}</div>
        <div class="conta-meta">${_finEsc(c.banco||'')} Â· ${_finEsc(c.tipo)}</div>
      </div>
      <div class="conta-saldo">
        <div class="conta-saldo-val">${moeda(c.saldo_inicial, true)}</div>
        <div class="conta-saldo-lbl">saldo inicial</div>
      </div>
      ${G.isSocio ? `<button class="btn btn-ghost btn-sm" onclick="editarConta(${_finSq(c.id)})">âœ</button>` : ''}
    </div>`).join('');
}

let _contaEditId = null;

function abrirModalConta(id) {
  _contaEditId = id || null;
  document.getElementById('modal-conta-titulo').textContent = id ? 'Editar Conta' : 'Nova Conta BancÃ¡ria';

  // Limpar campos
  ['conta-nome','conta-banco','conta-agencia','conta-numero','conta-saldo-ini','conta-data-saldo']
    .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
  const tp = document.getElementById('conta-tipo'); if (tp) tp.value = 'corrente';

  // Preencher se editando
  if (id) {
    const c = G.contasBancarias.find(x => x.id === id);
    if (c) {
      if (document.getElementById('conta-nome'))       document.getElementById('conta-nome').value       = c.nome    || '';
      if (document.getElementById('conta-tipo'))       document.getElementById('conta-tipo').value       = c.tipo    || 'corrente';
      if (document.getElementById('conta-banco'))      document.getElementById('conta-banco').value      = c.banco   || '';
      if (document.getElementById('conta-agencia'))   document.getElementById('conta-agencia').value   = c.agencia || '';
      if (document.getElementById('conta-numero'))    document.getElementById('conta-numero').value    = c.conta   || '';
      if (document.getElementById('conta-saldo-ini')) document.getElementById('conta-saldo-ini').value = c.saldo_inicial ?? '';
      if (document.getElementById('conta-data-saldo')) document.getElementById('conta-data-saldo').value = c.data_saldo_inicial || '';
    }
  }

  abrirModal('modal-conta');
}
function editarConta(id) { abrirModalConta(id); }

async function salvarConta() {
  const nome = document.getElementById('conta-nome').value.trim();
  const tipo = document.getElementById('conta-tipo').value;
  if (!nome) { toast('Informe o nome da conta', 'erro'); return; }
  const payload = {
    nome, tipo,
    banco:              document.getElementById('conta-banco').value    || null,
    agencia:            document.getElementById('conta-agencia').value  || null,
    conta:              document.getElementById('conta-numero').value   || null,
    saldo_inicial:      parseFloat(document.getElementById('conta-saldo-ini').value)  || 0,
    data_saldo_inicial: document.getElementById('conta-data-saldo').value || null,
    ativo: true,
  };
  let error;
  if (_contaEditId) {
    ({ error } = await sb.from('fin_contas_bancarias').update(payload).eq('id', _contaEditId));
  } else {
    ({ error } = await sb.from('fin_contas_bancarias').insert(payload));
  }
  if (error) { toast('Erro: ' + error.message, 'erro'); return; }
  toast(_contaEditId ? 'Conta atualizada âœ“' : 'Conta criada âœ“', 'ok');
  _contaEditId = null;
  fecharModal('modal-conta');
  await carregarContasBancarias();
  renderContas();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   FINALIZAR RASCUNHO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let G_ativoEdit = null; // ativo sendo finalizado

function finExtrairPayloadObs(rawObs) {
  const texto = String(rawObs || '');
  const match = texto.match(/\[ENTIDADE_COBRANCA\]([\s\S]*?)\[\/ENTIDADE_COBRANCA\]/);
  if (!match) return { entidade: null, obsLivre: texto.trim() || '' };
  let entidade = null;
  try { entidade = JSON.parse(match[1]); } catch (_) { entidade = null; }
  const obsLivre = texto.replace(match[0], '').trim();
  return { entidade, obsLivre };
}

function finMontarObsComEntidade(obsLivre, entidade) {
  const payload = entidade && Object.values(entidade).some(v => String(v || '').trim())
    ? `[ENTIDADE_COBRANCA]${JSON.stringify(entidade)}[/ENTIDADE_COBRANCA]`
    : '';
  return [payload, String(obsLivre || '').trim()].filter(Boolean).join('\n');
}

function finSetEntidadeCobrancaFields(entidade) {
  const data = entidade || {};
  document.getElementById('fin-cob-nome').value = data.nome || '';
  document.getElementById('fin-cob-fantasia').value = data.nome_fantasia || '';
  document.getElementById('fin-cob-cnpj').value = data.cnpj || '';
  document.getElementById('fin-cob-cep').value = data.cep || '';
  document.getElementById('fin-cob-endereco').value = data.endereco || '';
  document.getElementById('fin-cob-responsavel').value = data.responsavel || '';
  document.getElementById('fin-cob-email').value = data.email || '';
  document.getElementById('fin-cob-contato').value = data.contato || '';
}

function finGetEntidadeCobrancaFields() {
  return {
    nome: document.getElementById('fin-cob-nome').value.trim() || null,
    nome_fantasia: document.getElementById('fin-cob-fantasia').value.trim() || null,
    cnpj: document.getElementById('fin-cob-cnpj').value.trim() || null,
    cep: document.getElementById('fin-cob-cep').value.trim() || null,
    endereco: document.getElementById('fin-cob-endereco').value.trim() || null,
    responsavel: document.getElementById('fin-cob-responsavel').value.trim() || null,
    email: document.getElementById('fin-cob-email').value.trim() || null,
    contato: document.getElementById('fin-cob-contato').value.trim() || null
  };
}

async function finalizarRascunho(id) {
  // Carregar ativo completo com etapas e repasses
  const { data: ativo } = await sb.from('fin_ativos').select('*').eq('id', id).single();
  if (!ativo) { toast('Ativo nÃ£o encontrado', 'erro'); return; }

  const { data: etapas } = await sb.from('fin_etapas')
    .select('*, fin_parcelas(*)').eq('ativo_id', id).order('ordem');
  const { data: repasses } = await sb.from('fin_repasses').select('*').eq('ativo_id', id);

  G_ativoEdit = { ...ativo, etapas: etapas || [], repasses: repasses || [] };

  // Preencher header
  document.getElementById('fin-titulo').textContent = `Finalizar: ${ativo.cliente_nome}`;
  const subtit = [ativo.num_legado, ativo.prop_code].filter(Boolean).join(' Â· ');
  document.getElementById('fin-subtitulo').textContent = subtit || ativo.descricao || 'Revise e confirme os dados antes de ativar';
  document.getElementById('fin-cliente').textContent = ativo.cliente_nome;
  document.getElementById('fin-num-legado').textContent = ativo.descricao || ativo.num_legado || ativo.prop_code || 'â€”';
  document.getElementById('fin-nucleo-badge').innerHTML = nucleoBadge(ativo.nucleo);
  document.getElementById('fin-valor-total').textContent = moeda(ativo.valor_total);
  document.getElementById('fin-valor-efetivo').textContent = moeda(ativo.valor_efetivo_exp);

  // Modalidade
  const mod = ativo.modalidade_cobranca || 'etapas';
  document.querySelectorAll('input[name="fin-modalidade"]').forEach(el => {
    el.checked = el.value === mod;
  });
  onModalidadeChange();

  // Start
  const temStart = ativo.tem_start || false;
  document.getElementById('fin-tem-start').checked = temStart;
  if (temStart) {
    document.getElementById('fin-start-fields').style.display = '';
    document.getElementById('fin-start-valor').value = ativo.valor_start || '';
    document.getElementById('fin-start-pct').value = ativo.percentual_start || '';
    document.getElementById('fin-start-data').value = ativo.data_prevista_start || '';
  }

  // Mensal
  if (mod === 'mensal') {
    document.getElementById('fin-mensal-valor').value = ativo.valor_mensal || '';
    document.getElementById('fin-mensal-dia').value = ativo.dia_vencimento || '';
    document.getElementById('fin-mensal-inicio').value = ativo.data_inicio_mensal || '';
    document.getElementById('fin-mensal-fim').value = ativo.data_fim_mensal || '';
  }

  // Data contrato / obs
  const obsPayload = finExtrairPayloadObs(ativo.obs || '');
  document.getElementById('fin-data-contrato').value = ativo.data_contrato || '';
  document.getElementById('fin-obs').value = obsPayload.obsLivre || '';
  finSetEntidadeCobrancaFields(obsPayload.entidade);

  // Renderizar etapas
  renderEtapasFinalizacao();
  renderRepassesFinalizacao();

  // Banner CRM
  const crmBanner = document.getElementById('fin-crm-banner');
  if (crmBanner) crmBanner.style.display = ativo.criado_por === 'crm' ? '' : 'none';

  document.getElementById('fin-validacao').style.display = 'none';
  abrirModal('modal-finalizar');
}

function onModalidadeChange() {
  const mod = document.querySelector('input[name="fin-modalidade"]:checked')?.value;
  document.getElementById('fin-mensal-fields').style.display = mod === 'mensal' ? '' : 'none';
  document.getElementById('fin-etapas-section').style.display = mod === 'etapas' ? '' : 'none';
}

function onStartChange() {
  const checked = document.getElementById('fin-tem-start').checked;
  document.getElementById('fin-start-fields').style.display = checked ? '' : 'none';
}

function recalcPercentualStart() {
  const total = G_ativoEdit?.valor_total;
  const val = parseFloat(document.getElementById('fin-start-valor').value);
  if (total && !isNaN(val)) {
    document.getElementById('fin-start-pct').value = ((val / total) * 100).toFixed(2);
  }
  atualizarSomaCheck();
}

function recalcValorStart() {
  const total = G_ativoEdit?.valor_total;
  const pct = parseFloat(document.getElementById('fin-start-pct').value);
  if (total && !isNaN(pct)) {
    document.getElementById('fin-start-valor').value = ((pct / 100) * total).toFixed(2);
  }
  atualizarSomaCheck();
}

function renderEtapasFinalizacao() {
  const el = document.getElementById('fin-etapas-lista');
  const etapas = G_ativoEdit?.etapas || [];

  if (!etapas.length) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:#bbb;font-size:11px;border:1px dashed var(--cinza);border-radius:8px">
      Nenhuma etapa prÃ©-preenchida. Adicione etapas manualmente.
    </div>`;
    return;
  }

  el.innerHTML = etapas.map((e, ei) => {
    const parcelas = e.fin_parcelas || [];
    const etapaDescDisp = _finEsc(e.descricao || '');
    return `<div style="border:1px solid var(--cinza);border-radius:8px;margin-bottom:10px;overflow:hidden" id="etapa-blk-${ei}">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--off)">
        <div style="flex:1">
          <input type="text" value="${_finAttr(e.descricao || '')}" style="font-weight:700;font-size:12px;border:none;background:none;padding:0;outline:none;width:100%"
            onchange="G_ativoEdit.etapas[${ei}].descricao=this.value">
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:#888">Total:</span>
          <input type="number" value="${_finAttr(e.percentual_total ?? 0)}" step="0.01" style="width:60px;font-size:12px;font-weight:700;text-align:right;border:1px solid var(--cinza);border-radius:4px;padding:3px 6px"
            onchange="G_ativoEdit.etapas[${ei}].percentual_total=parseFloat(this.value);atualizarSomaCheck()">
          <span style="font-size:11px;color:#888">%</span>
          <span style="font-size:11px;font-weight:600" id="etapa-val-${ei}">${moeda((e.percentual_total/100)*(G_ativoEdit?.valor_total||0), true)}</span>
        </div>
        <button class="btn btn-ghost btn-xs" onclick="adicionarParcela(${ei})">+ Parcela</button>
      </div>
      <div style="padding:10px 14px" id="parcelas-blk-${ei}">
        ${parcelas.map((p, pi) => parcelaFormHTML(ei, pi, p)).join('')}
        ${!parcelas.length ? `<div style="font-size:10px;color:#bbb;padding:4px 0">Nenhuma parcela â€” clique em "+ Parcela" para adicionar</div>` : ''}
      </div>
    </div>`;
  }).join('');
  atualizarSomaCheck();
}

function parcelaFormHTML(ei, pi, p) {
  const tipos = ['conclusao','liberacao','entrega_parcial','avulso'];
  const tipoOpts = tipos.map(t => `<option value="${_finAttr(t)}" ${p.tipo===t?'selected':''}>${_finEsc(TIPO_PARCELA_MAP[t]?.label||t)}</option>`).join('');
  const descDisp = _finAttr(p.descricao||'');
  return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--cinza2)" id="parcela-row-${ei}-${pi}">
    <select onchange="G_ativoEdit.etapas[${ei}].fin_parcelas[${pi}].tipo=this.value" style="font-size:11px;padding:4px 6px;border:1px solid var(--cinza);border-radius:4px">
      ${tipoOpts}
    </select>
    <input type="text" value="${descDisp}" placeholder="DescriÃ§Ã£o (opcional)"
      style="flex:1;font-size:11px" onchange="G_ativoEdit.etapas[${ei}].fin_parcelas[${pi}].descricao=this.value">
    <input type="number" value="${_finAttr(p.percentual ?? '')}" step="0.01" placeholder="%" style="width:60px;font-size:11px"
      onchange="G_ativoEdit.etapas[${ei}].fin_parcelas[${pi}].percentual=parseFloat(this.value);atualizarSomaCheck()">
    <span style="font-size:10px;color:#888">%</span>
    <input type="date" value="${_finAttr(p.data_prevista_cobranca || '')}" style="font-size:11px;width:130px"
      onchange="G_ativoEdit.etapas[${ei}].fin_parcelas[${pi}].data_prevista_cobranca=this.value">
    <button class="btn btn-ghost btn-xs" style="color:var(--terracota)" onclick="removerParcela(${ei},${pi})">âœ•</button>
  </div>`;
}

function adicionarEtapaManual() {
  if (!G_ativoEdit) return;
  G_ativoEdit.etapas.push({
    descricao: 'Nova etapa', percentual_total: 0, valor_total: 0,
    situacao: 'pendente', ordem: G_ativoEdit.etapas.length,
    fin_parcelas: []
  });
  renderEtapasFinalizacao();
}

function adicionarParcela(ei) {
  if (!G_ativoEdit?.etapas[ei]) return;
  if (!G_ativoEdit.etapas[ei].fin_parcelas) G_ativoEdit.etapas[ei].fin_parcelas = [];
  G_ativoEdit.etapas[ei].fin_parcelas.push({
    tipo: 'conclusao', descricao: '', percentual: 0, data_prevista_cobranca: '', situacao: 'previsto'
  });
  renderEtapasFinalizacao();
}

function removerParcela(ei, pi) {
  G_ativoEdit.etapas[ei].fin_parcelas.splice(pi, 1);
  renderEtapasFinalizacao();
}

function atualizarSomaCheck() {
  let soma = 0;
  // start
  if (document.getElementById('fin-tem-start')?.checked) {
    soma += parseFloat(document.getElementById('fin-start-pct')?.value || 0);
  }
  // etapas (parcelas)
  (G_ativoEdit?.etapas || []).forEach(e => {
    (e.fin_parcelas || []).forEach(p => { soma += parseFloat(p.percentual || 0); });
  });
  const el = document.getElementById('fin-soma-check');
  if (el) {
    el.textContent = soma.toFixed(1) + '%';
    el.style.color = Math.abs(soma - 100) < 0.1 ? 'var(--verde)' : 'var(--terracota)';
  }
}

function renderRepassesFinalizacao() {
  const el = document.getElementById('fin-repasses-lista');
  const rep = G_ativoEdit?.repasses || [];
  if (!rep.length) { el.innerHTML = '<div style="font-size:11px;color:#bbb;padding:4px 0">Nenhum repasse</div>'; return; }
  el.innerHTML = rep.map((r, ri) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--cinza2)">
      <div style="flex:1;font-size:12px;font-weight:600">${_finEsc(r.beneficiario_nome || '')}</div>
      <div style="font-size:12px">${r.tipo === 'percentual' ? r.percentual + '%' : moeda(r.valor)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--terracota)">${moeda(r.valor)}</div>
      <span class="badge b-am">Pendente</span>
    </div>`).join('');
}

function adicionarRepasse() { toast('Adicionar repasse manual em breveâ€¦'); }

async function confirmarAtivo() {
  if (!G_ativoEdit) return;
  const mod = document.querySelector('input[name="fin-modalidade"]:checked')?.value || 'etapas';
  const temStart = document.getElementById('fin-tem-start').checked;

  // Mapear plano_contas de receita pelo nÃºcleo do ativo
  const pcReceita = G.planoContas.find(pc =>
    pc.grupo === 'RECEITA_BRUTA' && pc.nucleo_crm === G_ativoEdit.nucleo
  ) || G.planoContas.find(pc => pc.grupo === 'RECEITA_BRUTA');
  const pcReceitaId = pcReceita?.id || null;

  // Mapear plano_contas de custos para subcontrataÃ§Ãµes e repasses
  const pcSub = G.planoContas.find(pc =>
    pc.grupo === 'CUSTO_DE_VENDA' && pc.subconta?.toLowerCase().includes('subcontrat')
  );
  const pcRep = G.planoContas.find(pc =>
    pc.grupo === 'CUSTO_DE_VENDA' && pc.subconta?.toLowerCase().includes('repasse')
  );

  // Validar soma (modalidade etapas)
  if (mod === 'etapas') {
    let soma = temStart ? parseFloat(document.getElementById('fin-start-pct')?.value || 0) : 0;
    (G_ativoEdit.etapas || []).forEach(e =>
      (e.fin_parcelas || []).forEach(p => { soma += parseFloat(p.percentual || 0); }));
    if (Math.abs(soma - 100) > 0.5) {
      const el = document.getElementById('fin-validacao');
      el.style.display = '';
      el.textContent = `âš  A soma das parcelas Ã© ${soma.toFixed(1)}%. Deve ser 100% para confirmar.`;
      return;
    }
  }

  // Atualizar ativo
  const obsLivre = document.getElementById('fin-obs').value || null;
  const entidadeCobranca = finGetEntidadeCobrancaFields();
  const updateAtivo = {
    situacao_financeira: 'ativo',
    modalidade_cobranca: mod,
    tem_start: temStart,
    valor_start: temStart ? parseFloat(document.getElementById('fin-start-valor').value) || null : null,
    percentual_start: temStart ? parseFloat(document.getElementById('fin-start-pct').value) || null : null,
    data_prevista_start: temStart ? document.getElementById('fin-start-data').value || null : null,
    valor_mensal: mod === 'mensal' ? parseFloat(document.getElementById('fin-mensal-valor').value) || null : null,
    dia_vencimento: mod === 'mensal' ? parseInt(document.getElementById('fin-mensal-dia').value) || null : null,
    data_inicio_mensal: mod === 'mensal' ? document.getElementById('fin-mensal-inicio').value || null : null,
    data_fim_mensal: mod === 'mensal' ? document.getElementById('fin-mensal-fim').value || null : null,
    data_contrato: document.getElementById('fin-data-contrato').value || null,
    obs: finMontarObsComEntidade(obsLivre, entidadeCobranca) || null,
  };

  const { error: errAtivo } = await sb.from('fin_ativos').update(updateAtivo).eq('id', G_ativoEdit.id);
  if (errAtivo) { toast('Erro ao atualizar ativo: ' + errAtivo.message, 'erro'); return; }

  // Criar/atualizar etapas e parcelas (modalidade etapas)
  if (mod === 'etapas') {
    for (const [ei, etapa] of (G_ativoEdit.etapas || []).entries()) {
      let etapaId = etapa.id;
      const etapaPayload = {
        ativo_id: G_ativoEdit.id,
        descricao: etapa.descricao,
        percentual_total: etapa.percentual_total || 0,
        valor_total: ((etapa.percentual_total || 0) / 100) * (G_ativoEdit.valor_total || 0),
        situacao: 'pendente', ordem: ei,
        etapa_gestao_id: etapa.etapa_gestao_id || null,
      };
      if (!etapaId) {
        const { data: ne } = await sb.from('fin_etapas').insert(etapaPayload).select().single();
        etapaId = ne?.id;
      } else {
        await sb.from('fin_etapas').update(etapaPayload).eq('id', etapaId);
        // remover parcelas antigas desta etapa para recriar
        await sb.from('fin_parcelas').delete().eq('etapa_id', etapaId);
      }
      // Criar parcelas
      for (const [pi, parcela] of (etapa.fin_parcelas || []).entries()) {
        if (!parcela.percentual) continue;
        await sb.from('fin_parcelas').insert({
          ativo_id: G_ativoEdit.id,
          etapa_id: etapaId,
          tipo: parcela.tipo || 'conclusao',
          descricao: parcela.descricao || null,
          percentual: parcela.percentual,
          valor: (parcela.percentual / 100) * (G_ativoEdit.valor_total || 0),
          data_prevista_cobranca: parcela.data_prevista_cobranca || null,
          situacao: 'previsto', ordem: pi,
          plano_contas_id: pcReceitaId,
        });
      }
    }

    // Criar parcela de start (etapa_id null)
    if (temStart) {
      await sb.from('fin_parcelas').delete().eq('ativo_id', G_ativoEdit.id).eq('tipo', 'start');
      await sb.from('fin_parcelas').insert({
        ativo_id: G_ativoEdit.id,
        etapa_id: null,
        tipo: 'start',
        descricao: 'Sinal inicial',
        percentual: parseFloat(document.getElementById('fin-start-pct').value) || 0,
        valor: parseFloat(document.getElementById('fin-start-valor').value) || 0,
        data_prevista_cobranca: document.getElementById('fin-start-data').value || null,
        situacao: 'previsto', ordem: 0,
        plano_contas_id: pcReceitaId,
      });
    }
  }

  // Modalidade mensal: criar parcelas mensais
  if (mod === 'mensal') {
    const vMensal = parseFloat(document.getElementById('fin-mensal-valor').value) || 0;
    const dia     = parseInt(document.getElementById('fin-mensal-dia').value) || 10;
    const inicio  = document.getElementById('fin-mensal-inicio').value;
    const fim     = document.getElementById('fin-mensal-fim').value;
    if (inicio && vMensal) {
      await sb.from('fin_parcelas').delete().eq('ativo_id', G_ativoEdit.id).eq('tipo', 'mensalidade');
      const dtInicio = new Date(inicio + 'T12:00:00');
      const dtFim    = fim ? new Date(fim + 'T12:00:00') : new Date(dtInicio.getFullYear() + 2, dtInicio.getMonth(), 1);
      let dt = new Date(dtInicio);
      let ordem = 0;
      while (dt <= dtFim) {
        const ano = dt.getFullYear(), mes = dt.getMonth();
        const dtCob = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        await sb.from('fin_parcelas').insert({
          ativo_id: G_ativoEdit.id, etapa_id: null,
          tipo: 'mensalidade',
          descricao: MESES[mes] + '/' + ano,
          valor: vMensal, percentual: null,
          data_prevista_cobranca: dtCob,
          situacao: 'previsto', ordem: ordem++,
          plano_contas_id: pcReceitaId,
        });
        dt = new Date(ano, mes + 1, 1);
      }
    }
  }

  // Criar fin_lancamentos para subcontrataÃ§Ãµes e repasses (custos do projeto)
  const hoje = new Date().toISOString().split('T')[0];
  const [{ data: subs }, { data: repsAtivo }] = await Promise.all([
    sb.from('fin_subcontratacoes').select('*').eq('ativo_id', G_ativoEdit.id),
    sb.from('fin_repasses').select('*').eq('ativo_id', G_ativoEdit.id),
  ]);

  if (subs?.length && pcSub) {
    for (const sub of subs) {
      if (!sub.custo_cotado) continue;
      const { data: exist } = await sb.from('fin_lancamentos').select('id')
        .eq('subcontratacao_id', sub.id).limit(1);
      if (exist?.length) continue;
      await sb.from('fin_lancamentos').insert({
        data_competencia: hoje,
        observacao: `SubcontrataÃ§Ã£o: ${sub.servico || sub.empresa || 'ServiÃ§o ext.'}`,
        fornecedor_cliente: sub.empresa || null,
        valor: sub.custo_cotado,
        tipo: 'despesa',
        situacao: 'previsto',
        origem: 'crm',
        ativo_id: G_ativoEdit.id,
        subcontratacao_id: sub.id,
        plano_contas_id: pcSub.id,
        criado_por_id: G.usuario?.id || null,
      });
    }
  }

  if (repsAtivo?.length && pcRep) {
    for (const rep of repsAtivo) {
      if (!rep.valor) continue;
      const { data: exist } = await sb.from('fin_lancamentos').select('id')
        .eq('repasse_id', rep.id).limit(1);
      if (exist?.length) continue;
      await sb.from('fin_lancamentos').insert({
        data_competencia: hoje,
        observacao: `Repasse: ${rep.obs || 'Parceiro/Indicador'}`,
        valor: rep.valor,
        tipo: 'despesa',
        situacao: 'previsto',
        origem: 'crm',
        ativo_id: G_ativoEdit.id,
        repasse_id: rep.id,
        plano_contas_id: pcRep.id,
        criado_por_id: G.usuario?.id || null,
      });
    }
  }

  toast('Projeto ativado com sucesso! âœ“', 'ok');
  fecharModal('modal-finalizar');
  carregarFila();
  carregarAtivos();
  carregarDashboard();
}

async function excluirRascunho() {
  if (!G_ativoEdit) return;
  if (!confirm(`Excluir rascunho de "${G_ativoEdit.cliente_nome}"? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`)) return;
  await sb.from('fin_ativos').update({ situacao_financeira: 'cancelado' }).eq('id', G_ativoEdit.id);
  toast('Rascunho excluÃ­do', '');
  fecharModal('modal-finalizar');
  carregarFila();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   DRE â€” Demonstrativo de Resultado do ExercÃ­cio
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const G_dre = {
  ano:    new Date().getFullYear(),
  modo:   'anual',   // 'anual' | 'quad'
  tipo:   'real',    // 'real' | 'proj' | 'ambos'
  nucleo: '',        // '' | 'URB' | 'PAIS' | 'CONSUL' | 'ESP'
  dados:  null,      // lancamentos raw do ano
};

// Estrutura oficial do DRE desta empresa
const DRE_ESTRUTURA = [
  { t: 'secao',    label: 'RECEITAS' },
  { t: 'grupo',    key: 'Receita Bruta',             label: 'Receita Bruta',             sinal: +1 },
  { t: 'grupo',    key: 'Receita Financeira',         label: 'Receita Financeira',        sinal: +1 },
  { t: 'grupo',    key: 'DeduÃ§Ãµes',                   label: '(âˆ’) DeduÃ§Ãµes da Receita',   sinal: -1 },
  { t: 'subtotal', key: 'rec_liq',   label: 'Receita LÃ­quida',      linha: true },
  { t: 'secao',    label: 'CUSTOS' },
  { t: 'grupo',    key: 'Custos Diretos',             label: '(âˆ’) Custos Diretos',        sinal: -1 },
  { t: 'grupo',    key: 'Custo de Venda',             label: '(âˆ’) Custo de Venda',        sinal: -1 },
  { t: 'subtotal', key: 'lucro_bruto', label: 'Lucro Bruto',        linha: true },
  { t: 'margem',   key: 'mg_bruta',   label: 'Margem Bruta' },
  { t: 'secao',    label: 'DESPESAS OPERACIONAIS' },
  { t: 'grupo',    key: 'Despesas com Pessoal',       label: '(âˆ’) Pessoal',               sinal: -1 },
  { t: 'grupo',    key: 'Despesas Administrativas',   label: '(âˆ’) Administrativas',       sinal: -1 },
  { t: 'grupo',    key: 'Despesas com OperaÃ§Ã£o',      label: '(âˆ’) OperaÃ§Ã£o',              sinal: -1 },
  { t: 'grupo',    key: 'Despesas com Marketing',     label: '(âˆ’) Marketing',             sinal: -1 },
  { t: 'grupo',    key: 'Outras Despesas',            label: '(âˆ’) Outras',                sinal: -1 },
  { t: 'subtotal', key: 'res_op',    label: 'Resultado Operacional', linha: true },
  { t: 'margem',   key: 'mg_op',     label: 'Margem Operacional' },
  { t: 'secao',    label: 'ABAIXO DA LINHA' },
  { t: 'grupo',    key: 'Investimentos',              label: '(âˆ’) Investimentos',         sinal: -1 },
  { t: 'grupo',    key: 'Despesa Financeira',         label: '(âˆ’) Desp. Financeiras',     sinal: -1 },
  { t: 'grupo',    key: 'DepreciaÃ§Ã£o',                label: '(âˆ’) DepreciaÃ§Ã£o',           sinal: -1 },
  { t: 'grupo',    key: 'CAPEX',                      label: '(âˆ’) CAPEX',                 sinal: -1 },
  { t: 'subtotal', key: 'res_liq',  label: 'RESULTADO LÃQUIDO',    linha: true, destaque: true },
  { t: 'margem',   key: 'mg_liq',   label: 'Margem Efetiva',        destaque: true },
];

// Mapeamento de subtotais: quais grupos somam para cada chave
const DRE_SUBTOTAIS = {
  rec_liq:    { grupos_pos: ['Receita Bruta','Receita Financeira'], grupos_neg: ['DeduÃ§Ãµes'] },
  lucro_bruto:{ base: 'rec_liq',     grupos_neg: ['Custos Diretos','Custo de Venda'] },
  res_op:     { base: 'lucro_bruto', grupos_neg: ['Despesas com Pessoal','Despesas Administrativas','Despesas com OperaÃ§Ã£o','Despesas com Marketing','Outras Despesas'] },
  res_liq:    { base: 'res_op',      grupos_neg: ['Investimentos','Despesa Financeira','DepreciaÃ§Ã£o','CAPEX'] },
  // margens
  mg_bruta:   { numerador: 'lucro_bruto', denominador: 'rec_liq' },
  mg_op:      { numerador: 'res_op',      denominador: 'rec_liq' },
  mg_liq:     { numerador: 'res_liq',     denominador: 'rec_liq' },
};

function initDreAno() {
  const ano = new Date().getFullYear();
  const sel = document.getElementById('dre-ano');
  if (!sel) return;
  sel.innerHTML = '';
  for (let y = ano - 3; y <= ano + 1; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === ano) o.selected = true;
    sel.appendChild(o);
  }
  G_dre.ano = ano;
}

function onDreChange() {
  G_dre.ano = parseInt(document.getElementById('dre-ano').value);
  carregarDRE();
}

function setDreModo(modo) {
  G_dre.modo = modo;
  document.getElementById('dre-modo-anual').classList.toggle('active', modo === 'anual');
  document.getElementById('dre-modo-quad').classList.toggle('active',  modo === 'quad');
  renderDRE();
}

function setDreTipo(tipo) {
  G_dre.tipo = tipo;
  ['real','proj','ambos'].forEach(t => {
    document.getElementById('dre-tipo-' + t).classList.toggle('active', t === tipo);
  });
  renderDRE();
}

function onDreNucleoChange() {
  G_dre.nucleo = document.getElementById('dre-nucleo')?.value || '';
  renderDRE();
}

async function carregarDRE() {
  const container = document.getElementById('dre-container');
  if (container) container.innerHTML = '<div class="empty-state">Carregandoâ€¦</div>';

  const ano = G_dre.ano;
  const { data, error } = await sb.from('fin_lancamentos')
    .select('data_competencia, valor, situacao, tipo, plano_contas_id, grupo, subconta, fornecedor_cliente, observacao, nf, fin_plano_contas(grupo, subconta, tipo, aparece_dre, nucleo_crm)')
    .gte('data_competencia', `${ano}-01-01`)
    .lte('data_competencia', `${ano}-12-31`)
    .neq('situacao', 'cancelado')
    .not('plano_contas_id', 'is', null);

  if (error) { if (container) container.innerHTML = `<div class="empty-state">Erro: ${error.message}</div>`; return; }
  G_dre.dados = data || [];
  renderDRE();
}

// Agrega lanÃ§amentos por grupo e por periodo (mÃªs 1-12 ou quadrimestre 1-3)
function agregarDRE(lancamentos, modo) {
  // retorna: { porGrupo: { 'RECEITA_BRUTA': { 1: {real,proj}, 2: ... }, ... }, porSubconta: { ... } }
  const porGrupo = {};
  const porSubconta = {};

  for (const l of lancamentos) {
    if (!l.data_competencia) continue;
    const pc = l.fin_plano_contas;
    if (!pc || !pc.aparece_dre) continue;

    const grupoKey  = pc.grupo;
    const subKey    = `${pc.grupo}||${pc.subconta}`;
    const val       = parseFloat(l.valor) || 0;
    const isReal    = l.situacao === 'pago';

    // Determina o perÃ­odo
    const d = new Date(l.data_competencia + 'T12:00:00');
    const mes = d.getMonth() + 1; // 1-12
    const periodo = modo === 'quad' ? QUAD.findIndex(q => q.meses.includes(mes)) + 1 : mes;
    if (periodo <= 0) continue;

    if (!porGrupo[grupoKey]) porGrupo[grupoKey] = {};
    if (!porGrupo[grupoKey][periodo]) porGrupo[grupoKey][periodo] = { real: 0, proj: 0 };
    if (isReal) porGrupo[grupoKey][periodo].real += val;
    porGrupo[grupoKey][periodo].proj += val;

    if (!porSubconta[subKey]) porSubconta[subKey] = { grupo: grupoKey, subconta: pc.subconta };
    if (!porSubconta[subKey][periodo]) porSubconta[subKey][periodo] = { real: 0, proj: 0 };
    if (isReal) porSubconta[subKey][periodo].real += val;
    porSubconta[subKey][periodo].proj += val;
  }
  return { porGrupo, porSubconta };
}

function calcSubtotaisDRE(porGrupo, periodos) {
  // Retorna { [chaveSubtotal]: { [periodo]: val, total: val } } para real e proj
  const result = {};

  const get = (grupoKey, p, campo) => (porGrupo[grupoKey]?.[p]?.[campo] || 0);

  for (const [key, def] of Object.entries(DRE_SUBTOTAIS)) {
    if (def.numerador) continue; // margens calculadas depois
    result[key] = {};
    let totalReal = 0, totalProj = 0;

    for (const p of periodos) {
      let real = 0, proj = 0;
      if (def.base) {
        real += result[def.base]?.[p]?.real || 0;
        proj += result[def.base]?.[p]?.proj || 0;
      }
      if (def.grupos_pos) {
        def.grupos_pos.forEach(g => { real += get(g, p, 'real'); proj += get(g, p, 'proj'); });
      }
      if (def.grupos_neg) {
        def.grupos_neg.forEach(g => { real -= get(g, p, 'real'); proj -= get(g, p, 'proj'); });
      }
      result[key][p] = { real, proj };
      totalReal += real;
      totalProj += proj;
    }
    result[key].total = { real: totalReal, proj: totalProj };
  }

  // Margens
  for (const [key, def] of Object.entries(DRE_SUBTOTAIS)) {
    if (!def.numerador) continue;
    result[key] = {};
    for (const p of [...periodos, 'total']) {
      const num  = result[def.numerador]?.[p]?.real  || 0;
      const numP = result[def.numerador]?.[p]?.proj  || 0;
      const den  = result[def.denominador]?.[p]?.real || 0;
      const denP = result[def.denominador]?.[p]?.proj || 0;
      result[key][p] = {
        real: den  > 0 ? (num  / den)  * 100 : null,
        proj: denP > 0 ? (numP / denP) * 100 : null,
      };
    }
  }

  return result;
}

// Tabela de lookup para drill-down: cada row/cell do DRE empurra um item aqui
let G_dreItems = [];

function dreDD(idx) {
  const item = G_dreItems[idx];
  if (!item || !G_dre.dados) return;

  const modo    = G_dre.modo;
  const ano     = G_dre.ano;
  const periodo = item.periodo ?? null;

  // RÃ³tulo do perÃ­odo
  let periodoLabel = `${ano} Â· Ano todo`;
  if (periodo !== null) {
    if (modo === 'anual') periodoLabel = MESES_FULL[periodo - 1] + ' Â· ' + ano;
    else periodoLabel = `Q${periodo} Â· ${QUAD[periodo - 1]?.label} Â· ${ano}`;
  }

  // Filtrar lanÃ§amentos
  const dados = (G_dre.dados || []).filter(l => {
    const pc = l.fin_plano_contas;
    if (!pc || !pc.aparece_dre) return false;
    if (item.tipo === 'grupo'    && pc.grupo !== item.key) return false;
    if (item.tipo === 'subconta' && (pc.grupo !== item.grupoKey || pc.subconta !== item.key)) return false;
    if (periodo !== null) {
      const mes = new Date(l.data_competencia + 'T12:00:00').getMonth() + 1;
      if (modo === 'anual' && mes !== periodo) return false;
      if (modo === 'quad'  && !QUAD[periodo - 1]?.meses.includes(mes)) return false;
    }
    return true;
  }).sort((a, b) => b.data_competencia.localeCompare(a.data_competencia));

  // TÃ­tulo
  const estrutItem = DRE_ESTRUTURA.find(d => d.t === 'grupo' && d.key === (item.grupoKey || item.key));
  const tituloBase = item.tipo === 'subconta'
    ? item.key
    : (estrutItem?.label?.replace(/^\(âˆ’\) /, '') || item.key);

  document.getElementById('drd-titulo').textContent = tituloBase;
  document.getElementById('drd-sub').textContent    = `${periodoLabel} Â· ${dados.length} lanÃ§amento${dados.length !== 1 ? 's' : ''}`;

  const total = dados.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0) * item.sinal;

  const tbRows = dados.length
    ? dados.map(l => {
        const v = parseFloat(l.valor) * item.sinal;
        const principalDisp = _finEsc(l.fornecedor_cliente || l.observacao || 'â€”');
        const obsDisp = _finEsc(l.observacao || '');
        const subcontaDisp = _finEsc(l.subconta || l.grupo || 'â€”');
        const nfDisp = _finEsc(l.nf || 'â€”');
        return `<tr>
          <td style="color:#888;font-size:11px;white-space:nowrap">${fmtData(l.data_competencia)}</td>
          <td>
            <div style="font-weight:500">${principalDisp}</div>
            ${origemLancBadge(l)}
            ${l.observacao && l.fornecedor_cliente ? `<div style="font-size:10px;color:#aaa">${obsDisp}</div>` : ''}
          </td>
          <td style="font-size:10px;color:#888">${subcontaDisp}</td>
          <td>${sitBadge(l.situacao)}</td>
          <td style="font-size:10px;color:#aaa">${nfDisp}</td>
          <td style="text-align:right;font-weight:600;white-space:nowrap;color:${v >= 0 ? 'var(--verde)' : 'var(--terracota)'}">${moeda(v)}</td>
        </tr>`;
      }).join('') + `
      <tr class="dd-total">
        <td colspan="5">Total (${dados.length} lanÃ§amento${dados.length !== 1 ? 's' : ''})</td>
        <td style="text-align:right;color:${total >= 0 ? 'var(--verde)' : 'var(--terracota)'}">${moeda(total)}</td>
      </tr>`
    : '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:28px 0">Nenhum lanÃ§amento no perÃ­odo</td></tr>';

  document.getElementById('drd-tabela').innerHTML = `
    <thead>
      <tr>
        <th style="min-width:90px">Data</th>
        <th>DescriÃ§Ã£o / Cliente</th>
        <th>Subconta</th>
        <th>SituaÃ§Ã£o</th>
        <th>NF</th>
        <th style="text-align:right;min-width:110px">Valor</th>
      </tr>
    </thead>
    <tbody>${tbRows}</tbody>`;

  abrirModal('modal-dre-drill');
}

function renderDRE() {
  const container = document.getElementById('dre-container');
  if (!container) return;
  if (!G_dre.dados) { container.innerHTML = '<div class="empty-state">Carregandoâ€¦</div>'; return; }

  const modo     = G_dre.modo;
  const tipo     = G_dre.tipo;     // 'real' | 'proj' | 'ambos'
  const detalhar = document.getElementById('dre-detalhar')?.checked || false;
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  // Definir colunas
  let colunas = []; // { key: periodoNum, label: string, isAtual: bool }
  if (modo === 'anual') {
    colunas = MESES.map((l, i) => ({
      key: i + 1, label: l,
      isAtual: G_dre.ano === anoAtual && i + 1 === mesAtual,
    }));
  } else {
    colunas = QUAD.map((q, i) => ({
      key: i + 1, label: `Q${i+1} Â· ${q.label}`,
      isAtual: G_dre.ano === anoAtual && quadAtual() === i,
    }));
  }
  const periodos = colunas.map(c => c.key);
  const nucleo   = G_dre.nucleo || '';

  // Filtro por nÃºcleo: mantÃ©m lanÃ§amentos do nÃºcleo selecionado E despesas (nucleo_crm nulo)
  const dadosFiltrados = nucleo
    ? G_dre.dados.filter(l => {
        const nc = l.fin_plano_contas?.nucleo_crm;
        return !nc || nc === nucleo;
      })
    : G_dre.dados;

  const { porGrupo, porSubconta } = agregarDRE(dadosFiltrados, modo);
  const subtotais = calcSubtotaisDRE(porGrupo, periodos);

  // Calcula totais de cada grupo
  const grupoTotal = {};
  for (const [gk, perMap] of Object.entries(porGrupo)) {
    let real = 0, proj = 0;
    for (const p of periodos) { real += perMap[p]?.real || 0; proj += perMap[p]?.proj || 0; }
    grupoTotal[gk] = { real, proj };
  }

  // Helper: formata cÃ©lula de valor DRE
  const dreV = (val, isMargem) => {
    if (val === null || val === undefined) return '<span style="color:#ddd">â€”</span>';
    if (isMargem) {
      const cl = val >= 0 ? 'dre-positivo' : 'dre-negativo';
      return `<span class="${cl}">${val.toFixed(1)}%</span>`;
    }
    if (val === 0) return '<span style="color:#ccc">â€”</span>';
    const cl = val >= 0 ? 'dre-positivo' : 'dre-negativo';
    return `<span class="${cl}">${moeda(val)}</span>`;
  };

  // Helper: cÃ©lula com real+proj quando tipo='ambos'
  const dreCell = (periodoData, isMargem = false) => {
    if (!periodoData) return '<span style="color:#ddd">â€”</span>';
    if (tipo === 'real')  return dreV(periodoData.real, isMargem);
    if (tipo === 'proj')  return dreV(periodoData.proj, isMargem);
    // ambos
    const rH = dreV(periodoData.real, isMargem);
    const pVal = periodoData.proj;
    const diff = isMargem ? null : (typeof pVal === 'number' ? pVal - (periodoData.real || 0) : null);
    const pH = diff !== null && Math.abs(diff) > 1
      ? `<span class="dre-proj" style="margin-left:4px">(+${moeda(Math.abs(diff))} prev.)</span>`
      : '';
    return rH + pH;
  };

  // Helper: cÃ©lula de desvio (real - orÃ§ado), com sinal favorÃ¡vel dependendo do tipo do item
  const dreDesvio = (realVal, projVal, sinal) => {
    if (realVal === null || realVal === undefined || projVal === null || projVal === undefined) {
      return '<span class="dre-desvio-zero">â€”</span>';
    }
    const desvio = (realVal - projVal) * sinal; // positivo = melhor que o orÃ§ado
    if (Math.abs(desvio) < 1) return '<span class="dre-desvio-zero">â€”</span>';
    const cls  = desvio > 0 ? 'dre-desvio-pos' : 'dre-desvio-neg';
    const suf  = projVal !== 0 ? ` <span style="font-size:9px;opacity:.7">(${((desvio / Math.abs(projVal)) * 100).toFixed(1)}%)</span>` : '';
    return `<span class="${cls}">${desvio > 0 ? '+' : ''}${moeda(Math.abs(desvio))}${suf}</span>`;
  };

  const mostrarDesvio = tipo === 'ambos';

  // Construir tabela
  const thCols = colunas.map(c =>
    `<th class="${c.isAtual ? 'col-atual' : ''}">${c.label}</th>`
  ).join('') + '<th class="col-total">Real</th>'
    + (mostrarDesvio ? '<th class="col-total" style="min-width:80px">OrÃ§ado</th><th class="col-desvio">Desvio</th>' : '');

  let rows = '';
  G_dreItems = []; // reset do lookup para drill-down

  for (const item of DRE_ESTRUTURA) {
    const nCols = colunas.length + 2 + (mostrarDesvio ? 2 : 0);
    if (item.t === 'secao') {
      rows += `<tr class="dre-secao"><td colspan="${nCols}">${item.label}</td></tr>`;
      continue;
    }

    if (item.t === 'grupo') {
      const gData   = porGrupo[item.key];
      const gTot    = grupoTotal[item.key];
      const hasData = gTot && (gTot.real > 0 || gTot.proj > 0);

      // Registra item de drill (ano inteiro) para o label e coluna total
      const ddIdx = G_dreItems.length;
      G_dreItems.push({ tipo: 'grupo', key: item.key, sinal: item.sinal });

      // CÃ©lulas por perÃ­odo â€” cada uma tem seu prÃ³prio item de drill
      const tdCols = colunas.map(c => {
        const ddColIdx = G_dreItems.length;
        G_dreItems.push({ tipo: 'grupo', key: item.key, sinal: item.sinal, periodo: c.key });
        const d   = gData?.[c.key];
        const val = d ? { real: d.real * item.sinal, proj: d.proj * item.sinal } : null;
        return `<td class="dre-cell-click" onclick="dreDD(${ddColIdx})">${dreCell(val)}</td>`;
      }).join('');

      const totVal = gTot ? { real: gTot.real * item.sinal, proj: gTot.proj * item.sinal } : null;
      const desvioCell = mostrarDesvio && totVal
        ? `<td class="col-total" style="text-align:right">${dreV(totVal.proj)}</td><td class="col-desvio" style="text-align:right">${dreDesvio(totVal.real, totVal.proj, 1)}</td>`
        : '';
      rows += `<tr${!hasData ? ' style="opacity:.4"' : ''}>
        <td class="dre-label-click" style="padding-left:20px" onclick="dreDD(${ddIdx})">${item.label}<span class="dre-dd-hint">â†—</span></td>
        ${tdCols}
        <td class="col-total dre-cell-click" onclick="dreDD(${ddIdx})">${dreV(totVal?.real)}</td>
        ${desvioCell}
      </tr>`;

      // Subcontas (se detalhar)
      if (detalhar && hasData) {
        const subs = Object.values(porSubconta).filter(s => s.grupo === item.key);
        for (const sub of subs) {
          const ddSubIdx = G_dreItems.length;
          G_dreItems.push({ tipo: 'subconta', key: sub.subconta, grupoKey: item.key, sinal: item.sinal });

          const subTdCols = colunas.map(c => {
            const ddSubColIdx = G_dreItems.length;
            G_dreItems.push({ tipo: 'subconta', key: sub.subconta, grupoKey: item.key, sinal: item.sinal, periodo: c.key });
            const d   = sub[c.key];
            const val = d ? { real: d.real * item.sinal, proj: d.proj * item.sinal } : null;
            return `<td class="dre-cell-click" onclick="dreDD(${ddSubColIdx})">${dreCell(val)}</td>`;
          }).join('');

          let subTotReal = 0, subTotProj = 0;
          for (const p of periodos) { subTotReal += sub[p]?.real || 0; subTotProj += sub[p]?.proj || 0; }
          const subTot = { real: subTotReal * item.sinal, proj: subTotProj * item.sinal };
          const subDesvio = mostrarDesvio
            ? `<td class="col-total" style="text-align:right">${dreV(subTot.proj)}</td><td class="col-desvio" style="text-align:right">${dreDesvio(subTot.real, subTot.proj, 1)}</td>`
            : '';
          rows += `<tr style="font-size:10px;color:#666">
            <td class="dre-label-click" style="padding-left:36px" onclick="dreDD(${ddSubIdx})">${_finEsc(sub.subconta)}<span class="dre-dd-hint">â†—</span></td>
            ${subTdCols}
            <td class="col-total dre-cell-click" onclick="dreDD(${ddSubIdx})">${dreV(subTot.real)}</td>
            ${subDesvio}
          </tr>`;
        }
      }
      continue;
    }

    if (item.t === 'subtotal') {
      const tot = subtotais[item.key]?.total;
      const tdCols = colunas.map(c => {
        const d = subtotais[item.key]?.[c.key];
        return `<td>${dreCell(d)}</td>`;
      }).join('');
      const subDesvio = mostrarDesvio && tot
        ? `<td class="col-total">${dreV(tot.proj)}</td><td class="col-desvio" style="text-align:right">${dreDesvio(tot.real, tot.proj, 1)}</td>`
        : '';
      rows += `<tr class="dre-subtotal${item.destaque ? ' dre-destaque' : ''}">
        <td>${item.label}</td>
        ${tdCols}
        <td class="col-total">${dreV(tot?.real)}</td>
        ${subDesvio}
      </tr>`;
      continue;
    }

    if (item.t === 'margem') {
      const tot = subtotais[item.key]?.total;
      const tdCols = colunas.map(c => {
        const d = subtotais[item.key]?.[c.key];
        return `<td>${dreCell(d, true)}</td>`;
      }).join('');
      const mgDesvio = mostrarDesvio && tot
        ? `<td class="col-total">${dreV(tot.proj, true)}</td><td class="col-desvio" style="text-align:right">${
            (tot.real !== null && tot.proj !== null)
              ? `<span class="${(tot.real - tot.proj) >= 0 ? 'dre-desvio-pos' : 'dre-desvio-neg'}">${((tot.real - tot.proj) >= 0 ? '+' : '')}${(tot.real - tot.proj).toFixed(1)}pp</span>`
              : '<span class="dre-desvio-zero">â€”</span>'
          }</td>`
        : '';
      rows += `<tr class="dre-margem${item.destaque ? ' dre-destaque' : ''}">
        <td style="padding-left:${item.destaque ? 0 : 12}px">${item.label}</td>
        ${tdCols}
        <td class="col-total">${dreV(tot?.real, true)}</td>
        ${mgDesvio}
      </tr>`;
      continue;
    }
  }

  const nucleoLabel = nucleo ? ` Â· ${NUCLEO_MAP[nucleo]?.label || nucleo}` : '';
  const tipoLabel   = tipo === 'real' ? 'Realizado' : tipo === 'proj' ? 'Projetado' : 'Realizado vs OrÃ§ado';
  container.innerHTML = `
    <table class="dre-tbl">
      <thead><tr>
        <th>${G_dre.ano}${nucleoLabel} Â· ${tipoLabel}</th>
        ${thCols}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function exportarDRE() {
  if (!G_dre.dados) { toast('Carregue o DRE antes de exportar', 'erro'); return; }

  const modo    = G_dre.modo;
  const tipo    = G_dre.tipo;
  const nucleo  = G_dre.nucleo;
  const ano     = G_dre.ano;

  const dadosFiltrados = nucleo
    ? G_dre.dados.filter(l => { const nc = l.fin_plano_contas?.nucleo_crm; return !nc || nc === nucleo; })
    : G_dre.dados;

  const colunas = modo === 'anual'
    ? MESES.map((l, i) => ({ key: i + 1, label: l }))
    : QUAD.map((q, i) => ({ key: i + 1, label: `Q${i+1}` }));
  const periodos = colunas.map(c => c.key);

  const { porGrupo } = agregarDRE(dadosFiltrados, modo);
  const subtotais    = calcSubtotaisDRE(porGrupo, periodos);

  const grupoTotal = {};
  for (const [gk, perMap] of Object.entries(porGrupo)) {
    let real = 0, proj = 0;
    for (const p of periodos) { real += perMap[p]?.real || 0; proj += perMap[p]?.proj || 0; }
    grupoTotal[gk] = { real, proj };
  }

  const campo = tipo === 'proj' ? 'proj' : 'real';
  const fmtNum = v => (v === null || v === undefined) ? '' : v.toFixed(2).replace('.', ',');

  const cabec = ['Indicador', ...colunas.map(c => c.label), 'Total'];
  const linhas = [cabec];

  for (const item of DRE_ESTRUTURA) {
    if (item.t === 'secao') {
      linhas.push([item.label]);
      continue;
    }
    if (item.t === 'grupo') {
      const gData = porGrupo[item.key];
      const gTot  = grupoTotal[item.key];
      const vals  = colunas.map(c => fmtNum((gData?.[c.key]?.[campo] || 0) * item.sinal));
      const tot   = fmtNum((gTot?.[campo] || 0) * item.sinal);
      linhas.push([item.label, ...vals, tot]);
      continue;
    }
    if (item.t === 'subtotal') {
      const vals = colunas.map(c => fmtNum(subtotais[item.key]?.[c.key]?.[campo]));
      const tot  = fmtNum(subtotais[item.key]?.total?.[campo]);
      linhas.push([item.label, ...vals, tot]);
      continue;
    }
    if (item.t === 'margem') {
      const vals = colunas.map(c => {
        const v = subtotais[item.key]?.[c.key]?.[campo];
        return v != null ? v.toFixed(1).replace('.', ',') + '%' : '';
      });
      const tot = subtotais[item.key]?.total?.[campo];
      linhas.push([item.label, ...vals, tot != null ? tot.toFixed(1).replace('.', ',') + '%' : '']);
      continue;
    }
  }

  const csv = linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['ï»¿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ncLabel = nucleo ? `_${nucleo}` : '';
  const tipoLabel = tipo === 'real' ? 'Realizado' : tipo === 'proj' ? 'Projetado' : 'Comparativo';
  a.href = url;
  a.download = `DRE_${ano}${ncLabel}_${tipoLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('DRE exportado âœ“', 'ok');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//   PLANEJAMENTO FINANCEIRO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const G_plan = {
  ano: new Date().getFullYear(),
  tab: 'mes',
  view: 'simples',
  dados: null,
  recorrentes: [],
};

// Quadrimestres fixos
const QUAD = [
  { label: 'Jan â€“ Abr', meses: [1,2,3,4] },
  { label: 'Mai â€“ Ago', meses: [5,6,7,8] },
  { label: 'Set â€“ Dez', meses: [9,10,11,12] },
];

function quadAtual() {
  const m = new Date().getMonth() + 1;
  return QUAD.findIndex(q => q.meses.includes(m));
}

function initPlanAno() {
  const ano = new Date().getFullYear();
  const sel = document.getElementById('plan-ano');
  if (!sel) return;
  sel.innerHTML = '';
  for (let y = ano - 2; y <= ano + 3; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === ano) o.selected = true;
    sel.appendChild(o);
  }
  G_plan.ano = ano;
}

async function onPlanAnoChange() {
  G_plan.ano = parseInt(document.getElementById('plan-ano').value);
  await carregarPlanejamento();
}

function setPlanTab(tab) {
  G_plan.tab = tab;
  document.querySelectorAll('[data-ptab]').forEach(b => {
    b.classList.toggle('active', b.dataset.ptab === tab);
  });
  ['mes','quad','proj','rec'].forEach(t => {
    const el = document.getElementById('ptab-' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  if (!G_plan.dados && tab !== 'rec') return;
  if (tab === 'mes')  renderMesAMes();
  if (tab === 'quad') renderQuadrimestre();
  if (tab === 'proj') renderProjecao();
  if (tab === 'rec')  renderRecorrentes();
}

function setPlanView(v) {
  G_plan.view = v;
  const s = document.getElementById('plan-view-simples');
  const c = document.getElementById('plan-view-categ');
  if (s) { s.style.borderColor = v === 'simples' ? 'var(--fin)' : ''; s.style.color = v === 'simples' ? 'var(--fin)' : ''; }
  if (c) { c.style.borderColor = v === 'categ'   ? 'var(--fin)' : ''; c.style.color = v === 'categ'   ? 'var(--fin)' : ''; }
  renderMesAMes();
}

async function carregarPlanejamento() {
  const ano = G_plan.ano;
  const inicio = `${ano}-01-01`;
  const fim    = `${ano}-12-31`;

  const [{ data: lancs }, { data: recs }] = await Promise.all([
    sb.from('fin_lancamentos')
      .select('*, fin_plano_contas(grupo, subconta)')
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim)
      .order('data_vencimento'),
    sb.from('fin_lancamentos_recorrentes')
      .select('*, fin_plano_contas(grupo, subconta)')
      .eq('ativo', true)
      .order('created_at'),
  ]);

  G_plan.dados = lancs || [];
  G_plan.recorrentes = recs || [];

  if (G_plan.tab === 'mes')  renderMesAMes();
  else if (G_plan.tab === 'quad') renderQuadrimestre();
  else if (G_plan.tab === 'proj') renderProjecao();
  else if (G_plan.tab === 'rec')  renderRecorrentes();
}

async function gerarLancamentosPrevistos() {
  if (G._gerandoPrevisoes) return; // previne execuÃ§Ã£o concorrente
  G._gerandoPrevisoes = true;
  try {
  const { data: recs } = await sb.from('fin_lancamentos_recorrentes').select('*').eq('ativo', true);
  if (!recs || !recs.length) { G._gerandoPrevisoes = false; return; }

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  for (const rec of recs) {
    for (let i = 0; i < 6; i++) {
      let m = mesAtual + i;
      let a = anoAtual;
      if (m > 12) { m -= 12; a += 1; }

      let deveGerar = false;
      if (rec.tipo_recorrencia === 'fixo_mensal') {
        deveGerar = !rec.data_fim || new Date(rec.data_fim) >= new Date(a, m - 1, 1);
      } else if (rec.tipo_recorrencia === 'sazonal') {
        deveGerar = (rec.meses_do_ano || []).includes(m);
      } else if (rec.tipo_recorrencia === 'parcelado') {
        deveGerar = (rec.parcelas_geradas || 0) < (rec.total_parcelas || 0);
      }
      if (!deveGerar) continue;

      // Verificar duplicata usando origem_id (texto, sempre disponÃ­vel no schema)
      // formato: "recorrente:{uuid}:{YYYY-MM}"
      const mesStr  = String(m).padStart(2, '0');
      const origemId = `recorrente:${rec.id}:${a}-${mesStr}`;

      const { data: exist } = await sb.from('fin_lancamentos')
        .select('id')
        .eq('origem', 'recorrente')
        .eq('origem_id', origemId)
        .limit(1);
      if (exist && exist.length > 0) continue;

      const dia = Math.min(rec.dia_vencimento || 10, 28);
      const dataVenc = `${a}-${mesStr}-${String(dia).padStart(2, '0')}`;
      const nParcela = rec.tipo_recorrencia === 'parcelado'
        ? ` (${(rec.parcelas_geradas || 0) + 1}/${rec.total_parcelas})`
        : '';

      const { error: insErr } = await sb.from('fin_lancamentos').insert({
        observacao: rec.descricao + nParcela,
        valor: rec.valor,
        tipo: 'despesa',
        situacao: 'previsto',
        origem: 'recorrente',
        origem_id: origemId,
        data_competencia: dataVenc,
        data_vencimento: dataVenc,
        plano_contas_id: rec.plano_contas_id || null,
        conta_bancaria_id: rec.conta_bancaria_id || null,
        criado_por_id: G.usuario?.id || null,
      });
      if (insErr) console.error('gerarLancamentosPrevistos insert:', insErr.message);

      if (rec.tipo_recorrencia === 'parcelado') {
        const pg = (rec.parcelas_geradas || 0) + 1;
        await sb.from('fin_lancamentos_recorrentes').update({ parcelas_geradas: pg }).eq('id', rec.id);
        rec.parcelas_geradas = pg;
      }
    }
  }
  } finally {
    G._gerandoPrevisoes = false;
  }
}

function agregarPorMes(lancamentos) {
  const result = {};
  for (let m = 1; m <= 12; m++) {
    result[m] = { receita_real: 0, receita_prev: 0, despesa_real: 0, despesa_prev: 0, categorias: {} };
  }
  for (const l of lancamentos) {
    const d = new Date(l.data_vencimento + 'T12:00:00');
    const m = d.getMonth() + 1;
    if (!result[m]) continue;
    const pago = l.situacao === 'pago';
    const val = parseFloat(l.valor) || 0;
    const grupo = l.fin_plano_contas?.grupo || l.grupo || 'Outros';

    if (!result[m].categorias[grupo]) result[m].categorias[grupo] = { real: 0, prev: 0 };

    if (l.tipo === 'receita') {
      if (pago) result[m].receita_real += val;
      else result[m].receita_prev += val;
    } else {
      // despesa ou neutro
      if (pago) { result[m].despesa_real += val; result[m].categorias[grupo].real += val; }
      else       { result[m].despesa_prev += val; result[m].categorias[grupo].prev += val; }
    }
  }
  return result;
}

function fmtPct(v) {
  if (!isFinite(v)) return 'â€”';
  return v.toFixed(1) + '%';
}

function planValCell(real, prev) {
  const hasReal = real > 0;
  const hasPrev = prev > 0;
  if (!hasReal && !hasPrev) return '<span style="color:#ccc">â€”</span>';
  let h = '';
  if (hasReal) h += `<span class="plan-val-real">${moeda(real, true)}</span>`;
  if (hasPrev) h += `<span class="plan-val-prev">${moeda(prev, true)}</span>`;
  return h;
}

function renderMesAMes() {
  const container = document.getElementById('plan-mes-container');
  if (!container) return;
  if (!G_plan.dados) { container.innerHTML = '<div class="empty-state">Carregandoâ€¦</div>'; return; }

  const por_mes = agregarPorMes(G_plan.dados);
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const isAnoAtual = G_plan.ano === anoAtual;

  const thMeses = MESES.map((l, i) =>
    `<th class="${isAnoAtual && i+1 === mesAtual ? 'mes-atual' : ''}">${l}</th>`
  ).join('');

  const rowCells = (fn) => [...Array(12)].map((_, i) => `<td>${fn(por_mes[i+1], i+1)}</td>`).join('');

  let html = `<table class="plan-tbl"><thead><tr><th>Categoria</th>${thMeses}</tr></thead><tbody>`;

  if (G_plan.view === 'simples') {
    html += `<tr class="row-hdr"><td colspan="13">RECEITAS</td></tr>`;
    html += `<tr><td>Total Receita</td>${rowCells(m => planValCell(m.receita_real, m.receita_prev))}</tr>`;
    html += `<tr class="row-hdr"><td colspan="13">DESPESAS</td></tr>`;
    html += `<tr><td>Total Despesa</td>${rowCells(m => planValCell(m.despesa_real, m.despesa_prev))}</tr>`;
  } else {
    // Categorizado
    const grupos = [...new Set(Object.values(por_mes).flatMap(m => Object.keys(m.categorias)))].sort();
    html += `<tr class="row-hdr"><td colspan="13">RECEITAS</td></tr>`;
    html += `<tr><td>Total Receita</td>${rowCells(m => planValCell(m.receita_real, m.receita_prev))}</tr>`;
    html += `<tr class="row-hdr"><td colspan="13">DESPESAS</td></tr>`;
    grupos.forEach(g => {
      html += `<tr><td style="padding-left:20px;font-size:11px;color:#555">${g.replace(/_/g,' ')}</td>
        ${rowCells(m => {
          const c = m.categorias[g] || { real:0, prev:0 };
          return c.real > 0 || c.prev > 0 ? planValCell(c.real, c.prev) : '<span style="color:#ddd">Â·</span>';
        })}</tr>`;
    });
  }

  // Totals + margins
  html += `<tr class="row-total"><td>Total Despesa</td>${rowCells(m => planValCell(m.despesa_real, m.despesa_prev))}</tr>`;
  html += `<tr class="row-total"><td>Resultado</td>${rowCells(m => {
    const res = (m.receita_real + m.receita_prev) - (m.despesa_real + m.despesa_prev);
    const hasData = (m.receita_real + m.receita_prev + m.despesa_real + m.despesa_prev) > 0;
    return hasData ? `<span class="${res >= 0 ? 'positivo' : 'negativo'}">${moeda(res)}</span>` : '<span style="color:#ccc">â€”</span>';
  })}</tr>`;
  html += `<tr class="row-margem"><td>Margem Efetiva</td>${rowCells(m => {
    const rec  = m.receita_real + m.receita_prev;
    const desp = m.despesa_real + m.despesa_prev;
    if (rec <= 0) return '<span style="color:#ccc">â€”</span>';
    const mg = ((rec - desp) / rec) * 100;
    return `<span class="${mg >= 0 ? 'positivo' : 'negativo'}">${fmtPct(mg)}</span>`;
  })}</tr>`;

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderQuadrimestre() {
  const container = document.getElementById('plan-quad-container');
  if (!container) return;
  if (!G_plan.dados) { container.innerHTML = '<div class="empty-state">Carregandoâ€¦</div>'; return; }

  const por_mes  = agregarPorMes(G_plan.dados);
  const qAtual   = G_plan.ano === new Date().getFullYear() ? quadAtual() : -1;

  let html = '<div class="quad-grid">';
  QUAD.forEach((q, qi) => {
    let rr = 0, rp = 0, dr = 0, dp = 0;
    q.meses.forEach(m => { rr += por_mes[m].receita_real; rp += por_mes[m].receita_prev; dr += por_mes[m].despesa_real; dp += por_mes[m].despesa_prev; });
    const receita  = rr + rp;
    const despesa  = dr + dp;
    const resultado = receita - despesa;
    const mgEf = receita > 0 ? ((receita - despesa) / receita) * 100 : null;
    const isAtual = qi === qAtual;

    html += `<div class="quad-card${isAtual ? ' atual' : ''}">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${isAtual ? 'var(--fin)' : '#888'};margin-bottom:8px">
        Q${qi+1} Â· ${q.label}${isAtual ? ' <span style="background:var(--fin);color:#fff;padding:1px 6px;border-radius:10px;font-size:8px">atual</span>' : ''}
      </div>
      <div class="quad-metric">
        <div style="font-size:10px;color:#888;margin-bottom:2px">Receita</div>
        <div style="font-size:19px;font-weight:700;color:var(--verde)">${receita > 0 ? moeda(receita, true) : 'â€”'}</div>
        ${rp > 0 ? `<div style="font-size:10px;color:#aaa;margin-top:1px"><span class="plan-val-prev" style="font-size:10px">${moeda(rp, true)} prev.</span></div>` : ''}
      </div>
      <div class="quad-metric">
        <div style="font-size:10px;color:#888;margin-bottom:2px">Despesas</div>
        <div style="font-size:19px;font-weight:700;color:var(--terracota)">${despesa > 0 ? moeda(despesa, true) : 'â€”'}</div>
        ${dp > 0 ? `<div style="font-size:10px;color:#aaa;margin-top:1px"><span class="plan-val-prev" style="font-size:10px">${moeda(dp, true)} prev.</span></div>` : ''}
      </div>
      <div style="border-top:1.5px solid var(--cinza);padding-top:12px;margin-top:4px;margin-bottom:12px">
        <div style="font-size:10px;color:#888;margin-bottom:2px">Resultado</div>
        <div style="font-size:22px;font-weight:700;color:${resultado >= 0 ? 'var(--verde)' : 'var(--terracota)'}">${moeda(resultado)}</div>
      </div>
      <div class="quad-margens">
        <div class="quad-margem-item">
          <div style="font-size:9px;color:#888;margin-bottom:2px">Margem Efetiva</div>
          <div class="quad-margem-val ${mgEf !== null ? (mgEf >= 0 ? 'positivo' : 'negativo') : ''}">${mgEf !== null ? fmtPct(mgEf) : 'â€”'}</div>
        </div>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderProjecao() {
  const container = document.getElementById('plan-proj-container');
  if (!container) return;
  if (!G_plan.dados) { container.innerHTML = '<div class="empty-state">Carregandoâ€¦</div>'; return; }

  const por_mes  = agregarPorMes(G_plan.dados);
  const hoje     = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const anoPlano = G_plan.ano;

  let html = '';
  for (let m = 1; m <= 12; m++) {
    const md = por_mes[m];
    const isFuturo = anoPlano > anoAtual || (anoPlano === anoAtual && m > mesAtual);
    const isAtual  = anoPlano === anoAtual && m === mesAtual;
    const receita  = md.receita_real + md.receita_prev;
    const despesa  = md.despesa_real + md.despesa_prev;
    const resultado = receita - despesa;
    const mg = receita > 0 ? ((receita - despesa) / receita) * 100 : null;

    html += `<div class="proj-card${isAtual ? ' atual' : ''}">
      <div class="proj-mes">${MESES[m-1]}${isAtual ? ' <span style="font-size:8px;background:var(--fin);color:#fff;padding:1px 5px;border-radius:8px;vertical-align:middle">atual</span>' : ''}</div>
      <div class="proj-metricas">
        <div>
          <div style="font-size:9px;color:#888">Receita</div>
          <div style="font-weight:600;font-size:12px;color:var(--verde)">${receita > 0 ? moeda(receita, true) : 'â€”'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#888">Despesa</div>
          <div style="font-weight:600;font-size:12px;color:var(--terracota)">${despesa > 0 ? moeda(despesa, true) : 'â€”'}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#888">Margem</div>
          <div style="font-weight:700;font-size:13px;color:${mg !== null ? (mg >= 0 ? 'var(--verde)' : 'var(--terracota)') : '#ccc'}">${mg !== null ? fmtPct(mg) : 'â€”'}</div>
        </div>
      </div>
      ${isFuturo ? '<div style="font-size:9px;color:#9B8DC0;margin-top:6px;text-align:center">â–¸ projeÃ§Ã£o</div>' : ''}
    </div>`;
  }
  container.innerHTML = html;
}

function renderRecorrentes() {
  const container = document.getElementById('plan-rec-list');
  if (!container) return;
  const recs = G_plan.recorrentes;
  if (!recs || !recs.length) {
    container.innerHTML = '<div class="empty-state">Nenhuma despesa recorrente cadastrada. Crie templates de despesas fixas, sazonais ou parceladas.</div>';
    return;
  }

  const tipoLabel = { fixo_mensal: 'Fixo mensal', sazonal: 'Sazonal', parcelado: 'Parcelado' };
  const tipoClass = { fixo_mensal: 'fixo', sazonal: 'sazonal', parcelado: 'parcel' };

  container.innerHTML = recs.map(r => {
    let meta = '';
    if (r.tipo_recorrencia === 'sazonal' && r.meses_do_ano?.length) {
      meta = r.meses_do_ano.map(m => MESES[m-1]).join(', ');
    } else if (r.tipo_recorrencia === 'parcelado') {
      meta = `${r.parcelas_geradas || 0}/${r.total_parcelas || '?'} parcelas geradas`;
    } else {
      meta = r.dia_vencimento ? `Todo dia ${r.dia_vencimento}` : 'Todo mÃªs';
    }
    const plano = r.fin_plano_contas ? `${r.fin_plano_contas.grupo} Â· ${r.fin_plano_contas.subconta}` : '';

    return `<div class="rec-item">
      <div class="rec-info">
        <div class="rec-nome">${r.descricao}</div>
        <div class="rec-meta">${[plano, meta, r.obs].filter(Boolean).join(' Â· ')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
        <div style="font-weight:700;font-size:14px">${moeda(r.valor, true)}</div>
        <span class="rec-tipo ${tipoClass[r.tipo_recorrencia] || ''}">${tipoLabel[r.tipo_recorrencia] || r.tipo_recorrencia}</span>
        <button class="btn btn-sm" onclick="abrirModalRecorrente('${r.id}')">Editar</button>
        <button class="btn btn-sm" onclick="excluirRecorrente('${r.id}')" style="color:var(--terracota);border-color:var(--terracota)">Excluir</button>
      </div>
    </div>`;
  }).join('');
}

let _recEditId = null;

function abrirModalRecorrente(id = null) {
  _recEditId = id || null;
  document.getElementById('rec-modal-title').textContent = id ? 'Editar Recorrente' : 'Nova Despesa Recorrente';

  ['rec-desc','rec-valor','rec-dia','rec-inicio','rec-fim','rec-obs','rec-total-parcelas'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });
  document.getElementById('rec-tipo-sel').value = 'fixo_mensal';
  document.querySelectorAll('.rec-mes-chk').forEach(c => c.checked = false);
  onRecTipoChange();

  if (id) {
    const r = G_plan.recorrentes.find(x => x.id === id);
    if (r) {
      document.getElementById('rec-desc').value  = r.descricao || '';
      document.getElementById('rec-valor').value = r.valor || '';
      document.getElementById('rec-dia').value   = r.dia_vencimento || '';
      document.getElementById('rec-inicio').value = r.data_inicio || '';
      document.getElementById('rec-fim').value   = r.data_fim || '';
      document.getElementById('rec-obs').value   = r.obs || '';
      document.getElementById('rec-tipo-sel').value = r.tipo_recorrencia || 'fixo_mensal';
      if (r.total_parcelas) document.getElementById('rec-total-parcelas').value = r.total_parcelas;
      if (r.meses_do_ano) {
        document.querySelectorAll('.rec-mes-chk').forEach(c => {
          c.checked = r.meses_do_ano.includes(parseInt(c.value));
        });
      }
      const recPlano = document.getElementById('rec-plano');
      const recConta = document.getElementById('rec-conta');
      if (recPlano && r.plano_contas_id) recPlano.value = r.plano_contas_id;
      if (recConta && r.conta_bancaria_id) recConta.value = r.conta_bancaria_id;
      onRecTipoChange();
    }
  }
  document.getElementById('modal-recorrente').classList.add('open');
}

function onRecTipoChange() {
  const tipo = document.getElementById('rec-tipo-sel').value;
  document.getElementById('rec-meses-wrap').style.display   = tipo === 'sazonal'    ? '' : 'none';
  document.getElementById('rec-parcelas-wrap').style.display = tipo === 'parcelado' ? '' : 'none';
}

async function salvarRecorrente() {
  const desc   = document.getElementById('rec-desc').value.trim();
  const valor  = parseFloat(document.getElementById('rec-valor').value);
  const tipo   = document.getElementById('rec-tipo-sel').value;
  const dia    = parseInt(document.getElementById('rec-dia').value) || null;
  const inicio = document.getElementById('rec-inicio').value;
  const fim    = document.getElementById('rec-fim').value || null;
  const obs    = document.getElementById('rec-obs').value.trim() || null;
  const planoId = document.getElementById('rec-plano')?.value || null;
  const contaId = document.getElementById('rec-conta')?.value || null;

  if (!desc || isNaN(valor) || valor <= 0 || !inicio) {
    toast('Preencha descriÃ§Ã£o, valor e data inÃ­cio'); return;
  }

  let meses = null;
  if (tipo === 'sazonal') {
    meses = [...document.querySelectorAll('.rec-mes-chk:checked')].map(c => parseInt(c.value));
    if (!meses.length) { toast('Selecione ao menos um mÃªs'); return; }
  }

  let totalParcelas = null;
  if (tipo === 'parcelado') {
    totalParcelas = parseInt(document.getElementById('rec-total-parcelas').value);
    if (!totalParcelas || totalParcelas < 2) { toast('Informe o total de parcelas (mÃ­n. 2)'); return; }
  }

  const payload = {
    descricao: desc, valor, tipo_recorrencia: tipo,
    dia_vencimento: dia, data_inicio: inicio, data_fim: fim, obs,
    plano_contas_id: planoId || null, conta_bancaria_id: contaId || null,
    meses_do_ano: meses, total_parcelas: totalParcelas, ativo: true,
  };

  const btn = document.getElementById('rec-save-btn');
  btn.disabled = true; btn.textContent = 'Salvandoâ€¦';

  let error;
  if (_recEditId) {
    ({ error } = await sb.from('fin_lancamentos_recorrentes').update(payload).eq('id', _recEditId));
  } else {
    payload.criado_por_id = G.usuario?.id || null;
    ({ error } = await sb.from('fin_lancamentos_recorrentes').insert(payload));
  }

  btn.disabled = false; btn.textContent = 'Salvar';
  if (error) { toast('Erro: ' + error.message); return; }

  document.getElementById('modal-recorrente').classList.remove('open');
  toast(_recEditId ? 'Recorrente atualizada âœ“' : 'Recorrente criada âœ“');
  await carregarPlanejamento();
}

async function excluirRecorrente(id) {
  if (!confirm('Excluir esta recorrente? LanÃ§amentos futuros com situaÃ§Ã£o "previsto" serÃ£o removidos.')) return;
  const hoje = new Date().toISOString().split('T')[0];
  // Apagar lanÃ§amentos futuros "previsto" vinculados via origem_id
  await sb.from('fin_lancamentos').delete()
    .eq('origem', 'recorrente')
    .like('origem_id', `recorrente:${id}:%`)
    .eq('situacao', 'previsto')
    .gte('data_vencimento', hoje);
  // Desativar o template
  await sb.from('fin_lancamentos_recorrentes').delete().eq('id', id);
  toast('Recorrente excluÃ­da');
  await carregarPlanejamento();
}

async function forcarAtualizarPrevisoes() {
  toast('Atualizando previsÃµesâ€¦');
  await gerarLancamentosPrevistos();
  await carregarPlanejamento();
  toast('âœ“ PrevisÃµes atualizadas');
}

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: usr } = await sb.from('usuarios')
    .select('*').eq('auth_id', session.user.id).single();
  if (!usr) { window.location.href = 'index.html'; return; }
  if (!canAccessFinanceiroRole(usr.role)) {
    alert('O mÃ³dulo financeiro estÃ¡ disponÃ­vel apenas para sÃ³cios e sÃ³cios administradores.');
    window.location.href = 'app.html';
    return;
  }
  G.usuario = usr;
  G.isSocio = ['socio', 'socio_admin'].includes((usr.role || '').toLowerCase());

  // Nav â€” user chip
  const av = document.getElementById('nav-av');
  if (av) {
    if (usr.avatar_url) {
      av.classList.add('has-avatar');
      av.innerHTML = `<img src="${usr.avatar_url}" alt="${usr.iniciais||''}">`;
    } else {
      av.textContent = usr.iniciais || (usr.nome||'').slice(0,2).toUpperCase();
      av.style.background = usr.cor || '#6B4FA0';
      av.style.color = '#fff';
    }
  }
  const nomePartes = (usr.nome||'').trim().split(/\s+/).filter(Boolean);
  document.getElementById('nav-nome').textContent = nomePartes.length <= 2 ? (nomePartes.join(' ')||'â€”') : nomePartes[0]+' '+nomePartes[nomePartes.length-1];
  const roleMap = { socio:'SÃ³cio', socio_admin:'SÃ³cio', colaborador:'Colaborador', estagiario:'EstagiÃ¡rio', externo:'Externo' };
  const navRole = document.getElementById('nav-role');
  if (navRole) navRole.textContent = roleMap[(usr.role||'').toLowerCase()] || usr.role || '';
  initNavDropdown(usr.role);

  // SÃ³cios: mostrar aba Config, AnÃ¡lise e elementos socio-only
  if (G.isSocio) {
    document.querySelectorAll('.socio-only').forEach(el => el.style.display = '');
    document.getElementById('ntab-config').style.display  = '';
    document.getElementById('ntab-analise').style.display = '';
  }

  // Carregar dados base
  await Promise.all([carregarPlanoContas(), carregarContasBancarias(), carregarFechamentos()]);

  // Init dashboard selects
  initDashSelects();

  // Init planejamento ano selector
  initPlanAno();

  // Init DRE ano selector
  initDreAno();

  // Init AnÃ¡lise ano selector
  initAnaliseAno();

  // NavegaÃ§Ã£o principal
  document.querySelectorAll('.ntab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.ntab[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + tab)?.classList.add('active');
      onTabChange(tab);
    });
  });

  // Fechar modais com Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
    }
  });
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });

  // Mostrar app
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = '';

  // Carregar dashboard inicial
  carregarDashboard();

  // Gerar previsÃµes recorrentes 1x por sessÃ£o (silencioso)
  gerarLancamentosPrevistos().catch(e => console.warn('gerarLancamentosPrevistos:', e));

  // Carregar notificaÃ§Ãµes e renovar a cada 5 minutos
  carregarNotificacoes();
  setInterval(carregarNotificacoes, 5 * 60 * 1000);
}

init();

async function abrirLembretePopup() {
  let pop = document.getElementById('popup-lembrete');
  if (pop) { pop.remove(); return; }
  const _me = (() => { try { return JSON.parse(sessionStorage.getItem('exp_usuario') || '{}'); } catch(e) { return {}; } })();
  const { data: usuarios } = await sb.from('usuarios').select('id,nome').eq('ativo', true).order('nome');
  const _ls = 'font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#999;display:block;margin-bottom:4px';
  const _fs = 'width:100%;border:1px solid var(--cinza,#D0CFC9);border-radius:6px;padding:7px 10px;font-size:12px;font-family:var(--font-ui);outline:none;box-sizing:border-box';
  const _bs = 'padding:6px 16px;border:1px solid var(--cinza,#D0CFC9);border-radius:6px;font-size:12px;cursor:pointer;background:var(--branco,#fff);font-family:var(--font-ui)';
  const opts = (usuarios || []).filter(u => u.id !== _me.id).map(u =>
    `<option value="${u.id}">${(u.nome||'').split(' ')[0]}</option>`
  ).join('');
  pop = document.createElement('div');
  pop.id = 'popup-lembrete';
  pop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  pop.innerHTML = `
    <div style="background:var(--branco,#fff);border-radius:10px;padding:24px 28px;max-width:380px;width:95%;box-shadow:0 8px 32px rgba(0,0,0,.18)">
      <div style="font-size:14px;font-weight:700;margin-bottom:16px">Enviar lembrete para a equipe</div>
      <label style="${_ls}">Para</label>
      <select id="lemb-para" style="${_fs};margin-bottom:10px">
        <option value="todos">Toda a equipe</option>
        ${opts}
      </select>
      <label style="${_ls}">Mensagem</label>
      <textarea id="lemb-msg" rows="3" placeholder="Ex: Lembrete de preencher o reembolso mensal atÃ© sexta-feira." style="${_fs};resize:vertical;margin-bottom:16px"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="document.getElementById('popup-lembrete').remove()" style="${_bs}">Cancelar</button>
        <button onclick="_enviarLembrete()" style="${_bs};background:var(--ouro,#C4831A);color:#fff;border-color:var(--ouro,#C4831A);font-weight:600">Enviar lembrete</button>
      </div>
    </div>`;
  pop.addEventListener('click', e => { if (e.target === pop) pop.remove(); });
  document.body.appendChild(pop);
}
async function _enviarLembrete() {
  const msg = document.getElementById('lemb-msg')?.value.trim();
  const para = document.getElementById('lemb-para')?.value;
  if (!msg) return;
  const btn = document.querySelector('#popup-lembrete button:last-child');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviandoâ€¦'; }
  const _me = (() => { try { return JSON.parse(sessionStorage.getItem('exp_usuario') || '{}'); } catch(e) { return {}; } })();
  const { data: usuarios } = await sb.from('usuarios').select('id,nome').eq('ativo', true);
  const targets = para === 'todos'
    ? (usuarios || []).filter(u => u.id !== _me.id)
    : [(usuarios || []).find(u => u.id === para)].filter(Boolean);
  for (const u of targets) {
    await sb.from('notificacoes').insert({
      usuario_id: u.id, tipo: 'lembrete',
      titulo: `Lembrete de ${(_me.nome||'').split(' ')[0]}`,
      corpo: msg, link_tipo: 'lembrete',
      modulo: location.pathname.split('/').pop().replace('.html',''),
      criado_por: _me.id, criado_por_nome: _me.nome,
      created_at: new Date().toISOString(),
    }).catch(() => {});
  }
  document.getElementById('popup-lembrete')?.remove();
}
