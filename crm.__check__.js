const { createClient } = supabase;
const SUPABASE_URL      = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

// ═══ SCHEMA REAL DO BANCO ═══════════════════════════
// oportunidades: id, num_legado, cliente_id, projeto, cidade, uf,
//   resp_id (UUID→usuarios), pipeline_stage, origem, indicou,
//   destaque, obs, data_entrada, created_at, updated_at
// pipeline_stage valores: 'prospecção','enviada','negociacao','fechada','negada','cancelada'
//
// produtos: id, oportunidade_id, nucleo, subtipo, area,
//   valor_calculado, valor_proposto, valor_fechado, status,
//   prob, calc_id, data_envio, data_previsao, data_fechamento,
//   motivo_negativa, prob_retorno, cancel_note, obs, versao_atual,
//   created_at, updated_at
// status valores: 'prospecção','ativo','enviado','negociacao','fechado','negado','cancelado'
//
// clientes: id, nome, tipo, cidade, uf, obs, created_at
// usuarios: id, nome, iniciais, email, role, cor, viewer_only, auth_id
// followups_produto: tabela existe mas sem dados ainda
// contatos: id, cliente_id, nome, cargo, email, telefone

// ═══ ESTADO GLOBAL ══════════════════════════════════
let currentUser = null;
let _rtChannel  = null; // referência ao canal Realtime para cleanup
let allOps    = [];  // oportunidades enriquecidas
let allProds  = [];  // produtos (todas as opps)
// COM-5: alertas descartados persistidos em localStorage
let alertasDescartados = new Set(JSON.parse(localStorage.getItem('exp_alertas_ok') || '[]'));
let allClients= [];
let allUsers  = {};  // { uuid: {nome, iniciais, cor, viewer_only} }
let allContatos=[];
let allProposals=[];
let detailOppId = null;
let orcSortKey  = 'data_entrada';
let orcSortDir  = -1;
let alcMode     = 'op';
let origMode    = 'resumido';

// Mapa de pipeline_stage → label amigável
const STAGE_LABEL = {
  'prospecção':'Lead','prospeccao':'Lead',
  'enviada':'Orçamento ativo','ativo':'Orçamento ativo',
  'negociacao':'Negociação','negociação':'Negociação',
  'fechada':'Fechado','fechado':'Fechado',
  'negada':'Negado','negado':'Negado',
  'cancelada':'Cancelado','cancelado':'Cancelado',
  'perdida':'Perdida',
};
// Agrupamento para filtros kanban
const STAGE_GROUP = {
  'prospecção':'Lead','prospeccao':'Lead',
  'enviada':'Orçamento ativo','ativo':'Orçamento ativo',
  'negociacao':'Negociação','negociação':'Negociação',
  'fechada':'Fechado','fechado':'Fechado',
  'negada':'Negado','negado':'Negado',
  'cancelada':'Cancelado','cancelado':'Cancelado',
  'perdida':'Negado/Cancelado',
};
const NUCLEO_LABEL = {PAIS:'PAIS',URB:'URB',CONSUL:'CONS',ESP:'ESP'};
const NEG_CATEGORIAS_PADRAO = ['Preço','Prazo','Escopo','Concorrência','Orçamento interno','Projeto cancelado','Sem resposta'];
function normNegCat(cat){ return cat && NEG_CATEGORIAS_PADRAO.includes(cat) ? cat : 'Outros'; }
const NUCLEO_GRUPO = {PAIS:'Paisagismo',URB:'Urbanismo',CONSUL:'Consultorias',ESP:'Projetos Especiais'};
const SUBTIPO_LABEL = {
  PAIS_TERREO:'Térreo / Passeios',PAIS_CONDO:'Condominial / Ático',
  PAIS_FLOREIRA:'Floreiras',PAIS_STREET:'Streetscape',
  PAIS_ARB:'Arborização Viária',PAIS_PARQUE:'Parque / Espaço Público',
  PAIS_PARQUE_BAIXO:'Parque Baixo Impacto',PAIS_PF:'Residencial / PF',
  URB_CONCEITO:'Conceituação',URB_VIAB:'Est. Viabilidade',
  URB_MASTER:'Masterplan',URB_PROJETO:'Projeto Urbanístico',
  URB_DESM:'Desmembramento',URB_IMG:'Imagens',URB_CHARRETE:'Charrete',
  CONSUL_HORA:'Consultoria / Hora',CONSUL_MENSAL:'Consultoria / Mensal',
  ESP_LIVRE:'Proj. Especial',
};
const TIPO_BADGE = {
  Urbanismo:'b-urb',Paisagismo:'b-pai',Consultorias:'b-consul',
  'Projetos Especiais':'b-esp',
};
const ESTAGIO_BADGE = {
  'Prospecção':'b-az','Orçamento ativo':'b-am','Negociação':'b-am',
  'Fechado':'b-vd','Negado':'b-tc','Cancelado':'b-tc','Expirado':'b-exp','Perdida':'b-tc',
};
const ESTAGIO_BADGE_PROD = {
  'ativo':'b-am','negociacao':'b-am','negociação':'b-am',
  'fechado':'b-vd','negado':'b-tc','cancelado':'b-tc',
  'inativo':'b-gr','pausado':'b-gr',
};
// Cores canônicas para gráficos — fonte única de verdade
const CHART_CORES = {
  Urbanismo:      '#5280CA',
  Paisagismo:     '#45865D',
  Consultorias:   '#C36247',
  'Projetos Especiais': '#D19931',
  Total:          '#1D4FA0',
};

// ═══ UTILITÁRIOS ════════════════════════════════════
function fmt(v){if(!v&&v!==0)return'—';return'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtD(d){if(!d)return'—';try{const[y,m,dd]=(d.slice(0,10)).split('-');return`${dd}/${m}/${y}`;}catch{return d;}}
// Label legível de versão: 0 → 'Original', 1 → 'R1', 2 → 'R2' ...
function _verLabel(v){ return (v===0||v==null)?'Original':'R'+v; }
function diasDesde(d){if(!d)return null;return Math.floor((new Date()-new Date(d))/86400000);}
function escHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escAttr(v){return escHtml(v);}
function escJsStr(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n');}
function toast(m,dur=2800){const t=document.getElementById('toast');t.textContent=String(m??'');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function closeM(id){document.getElementById(id).classList.remove('open');}
function openM(id){document.getElementById(id).classList.add('open');}

// Normaliza stage para label amigável
function stageLabel(s){return STAGE_LABEL[s?.toLowerCase()]||s||'—';}
function stageGroup(s){
  const sl=(s||'').toLowerCase();
  if(['prospecção','prospeccao'].includes(sl))return'Lead';
  if(['enviada','ativo'].includes(sl))return'Orçamento ativo';
  if(['negociacao','negociação'].includes(sl))return'Negociação';
  if(['fechada','fechado'].includes(sl))return'Fechado';
  return'Negado/Cancelado';
}

function isExpiredProd(prod){
  if(!prod.data_envio)return false;
  if(!['ativo','negociacao','negociação'].includes((prod.status||'').toLowerCase()))return false;
  return diasDesde(prod.data_envio)>90;
}

// Retorna o "estágio efetivo" de uma oportunidade baseado nos produtos
function oppStageLabel(op){
  return stageLabel(op.pipeline_stage);
}

function tempClass(fus){
  if(!fus||!fus.length)return'none';
  const last=fus[fus.length-1];
  const d=diasDesde(last.data_contato||last.created_at);
  if(d===null)return'none';
  if(d<=30)return'hot';if(d<=60)return'warm';return'cold';
}

// Usuario por resp_id
function userById(uid){return allUsers[uid]||{nome:'—',iniciais:'?',cor:'#ccc',viewer_only:true};}
function userNome(uid){return userById(uid).nome.split(' ')[0];}

function tipoBadgeProd(nucleo){
  const grupo=NUCLEO_GRUPO[nucleo]||'';
  const cls=TIPO_BADGE[grupo]||'b-gr';
  return`<span class="badge ${cls}">${NUCLEO_LABEL[nucleo]||nucleo||'—'}</span>`;
}
function estagBadge(s){
  const lbl=stageLabel(s);
  return`<span class="badge ${ESTAGIO_BADGE[lbl]||'b-gr'}">${lbl}</span>`;
}
function estagBadgeProd(s){
  return`<span class="badge ${ESTAGIO_BADGE_PROD[(s||'').toLowerCase()]||'b-gr'}">${s||'—'}</span>`;
}
function respBadge(uid){
  const u=userById(uid);
  const cls={CC:'resp-cc',GB:'resp-gb',TC:'resp-tc',LA:'resp-la'}[u.iniciais]||'b-gr';
  return`<span class="badge ${cls}">${u.iniciais}</span>`;
}
function respAvatar(uid,sz=22){
  const u=userById(uid);
  return`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${u.cor}22;color:${u.cor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${u.iniciais}</div>`;
}
function probDots(p){
  p=+p||0;
  return[1,2,3,4,5].map(i=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:2px;background:${i<=p?'var(--ouro)':'var(--cinza)'}"></span>`).join('');
}
function origGroup(o){
  if(!o)return'—';const lo=o.toLowerCase();
  if(lo.startsWith('sócio')||lo.startsWith('socio'))return'Sócio';
  if(lo.startsWith('indica'))return'Indicação';
  if(lo.startsWith('parce'))return'Parceria';
  if(lo.startsWith('capta'))return'Captação';
  if(lo.startsWith('evento'))return'Evento';
  if(lo.startsWith('cliente'))return'Recorrente';
  return o;
}

let _origFechadas=[], _origAnoStr='';
let origValMode='rs';
function renderOrigensChart(fechadas, anoStr){
  _origFechadas=fechadas; _origAnoStr=anoStr;
  if(!document.getElementById('dash-origens'))return;
  const origMapRs={}, origMapQtd={};
  fechadas.forEach(op=>{
    const g = origMode==='completo' ? (op.origem||'—') : origGroup(op.origem);
    origMapQtd[g]=(origMapQtd[g]||0)+1;
    op._produtos.filter(p=>p.data_fechamento?.startsWith(anoStr)&&p.status==='fechado').forEach(p=>{
      origMapRs[g]=(origMapRs[g]||0)+(+p.valor_fechado||0);
    });
  });
  const map = origValMode==='qtd' ? origMapQtd : origMapRs;
  const maxO=Math.max(...Object.values(map),1);
  const barColor = origValMode==='qtd' ? 'var(--azul)' : 'var(--ouro)';
  document.getElementById('dash-origens').innerHTML=Object.entries(map)
    .sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">
        <span>${k}</span><span style="font-family:var(--font-mono);font-size:9px">${origValMode==='qtd'?v+' opp':fmt(v)}</span>
      </div>
      <div style="height:4px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(v/maxO*100)}%;background:${barColor}"></div></div>
    </div>`).join('')||'<div style="font-size:11px;color:#aaa">Sem dados</div>';
}
function toggleOrigMode(){
  origMode = origMode==='resumido' ? 'completo' : 'resumido';
  const btn = document.getElementById('orig-mode-btn');
  if(btn) btn.textContent = origMode==='resumido' ? 'Completo' : 'Resumido';
  renderOrigensChart(_origFechadas, _origAnoStr);
}
function toggleOrigValMode(){
  origValMode = origValMode==='rs' ? 'qtd' : 'rs';
  const btn = document.getElementById('orig-val-btn');
  if(btn) btn.textContent = origValMode==='rs' ? 'Qtd' : 'R$';
  renderOrigensChart(_origFechadas, _origAnoStr);
}

// ═══ VALOR DE PROPOSTAS (D2) ══════════════════════════
let vpNucleo='todos';
function setVpNucleo(btn, n){
  vpNucleo=n;
  document.querySelectorAll('.vp-f').forEach(b=>b.classList.add('ghost'));
  btn.classList.remove('ghost');
  renderValorPropostas();
}

function renderValorPropostas(){
  const el=document.getElementById('vp-body');
  if(!el)return;

  let ops=allOps;
  if(vpNucleo!=='todos')
    ops=allOps.filter(o=>
      o._produtos.some(p=>NUCLEO_GRUPO[p.nucleo]===vpNucleo)||
      o._proposal?.items?.some(it=>NUCLEO_GRUPO[it.nucleo]===vpNucleo)
    );

  const fechadas=ops.filter(o=>isFechada(o));
  const negadas=ops.filter(o=>isNegada(o));
  const ativas=ops.filter(o=>isAtiva(o));
  const encerradas=fechadas.length+negadas.length;
  const winRate=encerradas?Math.round(fechadas.length/encerradas*100):0;

  // Tempo médio
  const tempos=fechadas.filter(op=>oppDataFechamento(op)&&op.data_entrada)
    .map(op=>Math.round((new Date(oppDataFechamento(op))-new Date(op.data_entrada))/86400000));
  const mediaT=tempos.length?Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length):null;

  // Valores
  const vAtivo=ativas.reduce((s,op)=>s+oppValorProposto(op),0);
  const vTotal=ops.reduce((s,op)=>s+oppValorProposto(op),0);
  const vEfetivoFech=fechadas.reduce((s,op)=>s+oppValorEfetivo(op,true),0);
  const vMedioAtivo=ativas.length?vAtivo/ativas.length:0;
  const vMedioEfetivo=fechadas.length?vEfetivoFech/fechadas.length:0;
  const vArr=ativas.map(o=>oppValorProposto(o)).filter(v=>v>0);
  const vMin=vArr.length?Math.min(...vArr):0;
  const vMax=vArr.length?Math.max(...vArr):0;

  // D4 — recontratação
  const clientesFech={};
  fechadas.forEach(op=>{if(op.cliente_id)clientesFech[op.cliente_id]=(clientesFech[op.cliente_id]||0)+1;});
  const totalClientes=Object.keys(clientesFech).length;
  const recontr=Object.values(clientesFech).filter(n=>n>1).length;
  const txRecontr=totalClientes?Math.round(recontr/totalClientes*100):0;

  // D4 — indicação
  const indic=ops.filter(o=>(o.origem||'').toLowerCase().startsWith('indica')).length;
  const txIndic=ops.length?Math.round(indic/ops.length*100):0;

  // Origens: R$ = fechados, Qtd = todos os leads
  const origRs={}, origQtd={};
  ops.forEach(op=>{
    const g=origGroup(op.origem);
    origQtd[g]=(origQtd[g]||0)+1;
  });
  fechadas.forEach(op=>{
    const g=origGroup(op.origem);
    origRs[g]=(origRs[g]||0)+oppValorFechado(op);
  });
  const origKeys=[...new Set([...Object.keys(origRs),...Object.keys(origQtd)])];
  const origEntries=origKeys.map(k=>({k,rs:origRs[k]||0,qtd:origQtd[k]||0})).sort((a,b)=>b.qtd-a.qtd||b.rs-a.rs);
  const maxRs=Math.max(...origEntries.map(e=>e.rs),1);
  const maxQtd=Math.max(...origEntries.map(e=>e.qtd),1);

  // D5 — CLV histórico (usa allOps para mostrar histórico completo independente do filtro)
  const clvMap={};
  allOps.filter(o=>isFechada(o)).forEach(op=>{
    if(!op.cliente_id)return;
    if(!clvMap[op.cliente_id])clvMap[op.cliente_id]={nome:op._cliente?.nome||'—',val:0,count:0};
    clvMap[op.cliente_id].val+=oppValorFechado(op);
    clvMap[op.cliente_id].count+=1;
  });
  const topClientes=Object.values(clvMap).sort((a,b)=>b.val-a.val).slice(0,8);

  const wrColor=winRate>=50?'var(--verde)':winRate>=30?'var(--ouro)':'var(--terracota)';
  const rtColor=txRecontr>=30?'var(--verde)':txRecontr>=15?'var(--ouro)':'var(--terracota)';
  const tiColor=txIndic>=30?'var(--verde)':txIndic>=15?'var(--ouro)':'var(--grafite)';

  el.innerHTML=`
    <div class="vp-sec-title">Propostas</div>
    <div class="vp-grid" style="margin-bottom:4px">
      <div class="vp-metric">
        <div class="vp-metric-lbl">Ativas</div>
        <div class="vp-metric-val">${ativas.length}<span style="font-size:12px;font-weight:400;color:#aaa"> / ${ops.length}</span></div>
        <div class="vp-metric-sub">de ${ops.length} total histórico</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Win Rate</div>
        <div class="vp-metric-val" style="color:${wrColor}">${winRate}%</div>
        <div class="vp-metric-sub">${fechadas.length} fechadas · ${negadas.length} negadas</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Tempo médio fechamento</div>
        <div class="vp-metric-val sm">${mediaT?mediaT+' dias':'—'}</div>
        <div class="vp-metric-sub">${tempos.length} opp. com data completa</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Projetos fechados</div>
        <div class="vp-metric-val">${fechadas.length}</div>
        <div class="vp-metric-sub">${negadas.length} negadas · ${ativas.length} em aberto</div>
      </div>
    </div>

    <div class="vp-sec-title">Valores</div>
    <div class="vp-grid" style="margin-bottom:4px">
      <div class="vp-metric">
        <div class="vp-metric-lbl">Pipeline ativo</div>
        <div class="vp-metric-val sm">${fmt(vAtivo)}</div>
        <div class="vp-metric-sub">média ${fmt(vMedioAtivo)}</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Total histórico</div>
        <div class="vp-metric-val sm">${fmt(vTotal)}</div>
        <div class="vp-metric-sub">${ops.length} oportunidades</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Efetivo EXP (fechados)</div>
        <div class="vp-metric-val sm">${fmt(vEfetivoFech)}</div>
        <div class="vp-metric-sub">média ${fmt(vMedioEfetivo)}</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Mín · Máx (pipeline ativo)</div>
        <div class="vp-metric-val xs" style="display:flex;gap:8px;align-items:baseline;margin-top:2px">
          <span style="color:var(--terracota)">${vMin?fmt(vMin):'—'}</span>
          <span style="font-size:9px;color:#ccc">·</span>
          <span style="color:var(--verde)">${vMax?fmt(vMax):'—'}</span>
        </div>
        <div class="vp-metric-sub">${vArr.length} proposta${vArr.length!==1?'s':''} com valor</div>
      </div>
    </div>

    <div class="vp-sec-title">Relacionamento</div>
    <div class="vp-grid g2" style="margin-bottom:4px">
      <div class="vp-metric">
        <div class="vp-metric-lbl">Taxa de recontratação</div>
        <div class="vp-metric-val" style="color:${rtColor}">${txRecontr}%</div>
        <div class="vp-metric-sub">${recontr} de ${totalClientes} clientes c/ >1 fechamento</div>
      </div>
      <div class="vp-metric">
        <div class="vp-metric-lbl">Taxa de indicação</div>
        <div class="vp-metric-val" style="color:${tiColor}">${txIndic}%</div>
        <div class="vp-metric-sub">${indic} de ${ops.length} opp. via indicação</div>
      </div>
    </div>

    <div class="vp-sec-title">Origem dos leads</div>
    ${origEntries.length?`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:4px">
      <div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#bbb;margin-bottom:6px">Por valor R$ <span style="font-weight:400;text-transform:none">(fechados)</span></div>
        ${origEntries.map(({k,rs})=>`<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
            <span>${escHtml(k)}</span><span style="font-family:var(--font-mono);font-size:9px">${rs?fmt(rs):'—'}</span>
          </div>
          <div style="height:3px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(rs/maxRs*100)}%;background:var(--ouro)"></div></div>
        </div>`).join('')}
      </div>
      <div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#bbb;margin-bottom:6px">Por quantidade <span style="font-weight:400;text-transform:none">(todos os leads)</span></div>
        ${origEntries.map(({k,qtd})=>`<div style="margin-bottom:7px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
            <span>${escHtml(k)}</span><span style="font-family:var(--font-mono);font-size:9px">${qtd} opp.</span>
          </div>
          <div style="height:3px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(qtd/maxQtd*100)}%;background:var(--azul)"></div></div>
        </div>`).join('')}
      </div>
    </div>`:'<div style="font-size:11px;color:#aaa;margin-bottom:8px">Sem dados de origem registrados.</div>'}

    <div class="vp-sec-title">CLV histórico — top clientes</div>
    ${topClientes.length?`<div>${topClientes.map((c,i)=>`
      <div class="vp-clv-row">
        <div class="vp-clv-pos">${i+1}</div>
        <div class="vp-clv-name">${escHtml(c.nome)}</div>
        <div class="vp-clv-count">${c.count} proj.</div>
        <div class="vp-clv-val">${fmt(c.val)}</div>
      </div>`).join('')}</div>`:'<div style="font-size:11px;color:#aaa">Nenhum projeto fechado ainda.</div>'}
  `;
}

// ═══ INIT ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async()=>{
  const {data:{session}} = await sb.auth.getSession();
  if(!session){window.location.href='index.html';return;}

  const {data:u, error:uErr} = await sb.from('usuarios').select('*').eq('auth_id',session.user.id).maybeSingle();
  if(uErr) console.error('Erro ao carregar usuário:', uErr.message);
  if(!u || !canAccessCrmRole(u.role)){
    alert('O módulo comercial está disponível apenas para sócios e sócios administradores.');
    window.location.href='app.html';
    return;
  }
  currentUser = u||{nome:'Usuário',iniciais:'?',cor:'#888',viewer_only:true};
  sessionStorage.setItem('exp_usuario', JSON.stringify(currentUser));

  ExpNav.init({
    module: 'crm',
    onUserMenu: function() { window.location.href = 'app.html'; },
  });

  await carregarDados();
  renderDash();
  renderPipe();
  renderOrc();
  renderContatos();
  calcAlertas();
  // Bell global — também exibe alertas de follow-up no painel unificado
  AppNotif.init({ userId: currentUser.id });
  if(!currentUser?.viewer_only){
    document.getElementById('btn-nova-opp').style.display='inline-flex';
  }
  setTimeout(()=>showBoasVindas(), 600);

  // Infra — Realtime: atualiza CRM quando calc salva nova proposta
  if(_rtChannel) sb.removeChannel(_rtChannel);
  _rtChannel = sb.channel('exp_proposals_rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exp_proposals' }, async () => {
      await carregarDados();
      renderDash(); renderPipe(); renderOrc();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exp_proposals' }, async (payload) => {
      await carregarDados();
      renderDash(); renderPipe(); renderOrc();
      // Se o detalhe de uma opp vinculada estiver aberto, atualiza o painel
      // (inclui casos em que a nova revisão é de uma família vinculada)
      if (detailOppId) {
        const op = allOps.find(o=>o.id===detailOppId);
        if (op?.proposta_calc_id) {
          const linkedProp = allProposals.find(p=>p.proposal_id===op.proposta_calc_id);
          const linkedFroot = linkedProp ? (linkedProp.parent_id||linkedProp.proposal_id) : op.proposta_calc_id;
          const changedFroot = payload.new?.parent_id || payload.new?.proposal_id;
          if (changedFroot === linkedFroot || payload.new?.proposal_id === op.proposta_calc_id) {
            carregarInfoPropostaCalc(op.proposta_calc_id, detailOppId);
          }
        }
      }
    })
    .subscribe();
});

document.addEventListener('click', e => {
  // Fecha dropdown de cliente
  const dd=document.getElementById('opp-cliente-dropdown');
  const inp=document.getElementById('opp-cliente-text');
  if(dd&&dd.style.display!=='none'&&!dd.contains(e.target)&&e.target!==inp)dd.style.display='none';
});
function canAccessCrmRole(role) {
  return ['socio', 'socio_adm', 'socio_admin'].includes((role || '').toLowerCase());
}
async function sair() {
  await sb.auth.signOut();
  sessionStorage.removeItem('exp_usuario');
  window.location.href = 'index.html';
}

async function carregarDados(){
  const [opsRes, prodsRes, clientesRes, usersRes, contatosRes, fusRes, proposalsRes] = await Promise.all([
    sb.from('oportunidades').select('*').not('excluida','is',true).order('data_entrada',{ascending:false}),
    sb.from('produtos').select('*'),
    sb.from('clientes').select('*').order('nome'),
    sb.from('usuarios').select('*'),
    sb.from('contatos').select('*'),
    sb.from('followups_produto').select('*'),
    sb.from('exp_proposals').select('proposal_id,projeto,cliente,cidade,uf,total,status,version,parent_id,prop_code,items,subs,desps,repasse,despbit,updated_at').order('created_at',{ascending:false}).then(r => r.error ? sb.from('exp_proposals').select('proposal_id,projeto,cliente,cidade,uf,total,status,version,parent_id,items,subs,desps,repasse,updated_at').order('created_at',{ascending:false}) : r),
  ]);
  const _erros = [['oportunidades',opsRes],['produtos',prodsRes],['clientes',clientesRes],['usuarios',usersRes],['contatos',contatosRes],['followups_produto',fusRes],['exp_proposals',proposalsRes]];
  _erros.forEach(([nome,res])=>{ if(res.error) console.error(`carregarDados [${nome}]:`, res.error.message); });

  // Mapa de usuarios por id
  allUsers = {};
  (usersRes.data||[]).forEach(u=>{ allUsers[u.id]=u; });

  allClients   = clientesRes.data||[];
  allContatos  = contatosRes.data||[];
  allProds     = prodsRes.data||[];
  // Todas as propostas (sem filtro de status — inclui Original, R1, R2, etc.)
  const proposalsAll = proposalsRes.data||[];
  allProposals = proposalsAll;

  // Mapeia produtos por oportunidade_id
  const prodsMap={};
  const prodOppMap={};
  allProds.forEach(p=>{
    if(!prodsMap[p.oportunidade_id])prodsMap[p.oportunidade_id]=[];
    prodsMap[p.oportunidade_id].push(p);
    prodOppMap[p.id]=p.oportunidade_id;
  });

  // followups_produto e produto-cêntrica; normaliza para a UI por oportunidade
  const fusMap={};
  (fusRes.data||[]).forEach(f=>{
    const oppId=prodOppMap[f.produto_id];
    if(!oppId)return;
    if(!fusMap[oppId])fusMap[oppId]=[];
    fusMap[oppId].push({
      ...f,
      oportunidade_id: oppId,
      data_contato: f.data||null,
      observacao: f.obs||'',
      proximo_contato: f.next_date||null,
    });
  });
  Object.values(fusMap).forEach(arr=>arr.sort((a,b)=>(a.data_contato||a.created_at||'').localeCompare(b.data_contato||b.created_at||'')));

  // Mapeia clientes por id
  const clientMap={};
  allClients.forEach(c=>clientMap[c.id]=c);

  // Mapa proposal_id → proposal (todas as versões)
  const proposalMap={};
  proposalsAll.forEach(p=>{ proposalMap[p.proposal_id]=p; });

  allOps=(opsRes.data||[]).map(op=>({
    ...op,
    _cliente: clientMap[op.cliente_id]||null,
    _followups: fusMap[op.id]||[],
    _produtos: prodsMap[op.id]||[],
    _user: allUsers[op.resp_id]||null,
    _proposal: op.proposta_calc_id ? (proposalMap[op.proposta_calc_id]||null) : null,
  }));
}

// Helpers para trabalhar com oportunidades + produtos
function oppValorProposto(op){
  if(op._proposal?.items?.length)
    return op._proposal.items.reduce((s,it)=>s+(it.valorProposto!=null?+it.valorProposto:(+it.valorCalc||0)),0);
  return op._produtos.reduce((s,p)=>s+(+p.valor_proposto||0),0);
}
function oppValorFechado(op){
  // Produtos DB com valor_fechado têm prioridade absoluta
  const prodFech=op._produtos.filter(p=>+p.valor_fechado>0);
  if(prodFech.length) return prodFech.reduce((s,p)=>s+(+p.valor_fechado),0);
  // Opp calc-vinculada fechada: usa valor_fechado salvo na opp, senão total da proposta
  if(op._proposal?.items?.length && isFechada(op))
    return +op.valor_fechado||oppValorProposto(op);
  return 0;
}
// Valor efetivo EXP = valor que compete à EXP (exclui repasses, subcontratações e despesas)
// Se a opp tem proposta vinculada: usa `total` da proposta calculadora (já é o valor EXP líquido)
// Fallback: soma valor_calculado dos produtos (campo preenchido pela calc ao importar)
// Último fallback: igual ao valor_proposto (sem dedução — exibe sem asterisco)
function oppValorEfetivo(op, fechado=false){
  if(fechado){
    return op._produtos
      .filter(p=>p.status==='fechado')
      .reduce((s,p)=>s+(+p.valor_fechado||+p.valor_calculado||+p.valor_proposto||0),0);
  }
  if(op._proposal?.total) return +op._proposal.total;
  const comCalc = op._produtos.filter(p=>+p.valor_calculado>0);
  if(comCalc.length) return comCalc.reduce((s,p)=>s+(+p.valor_calculado||0),0);
  return oppValorProposto(op);
}
function oppTipo(op){
  if(op._proposal?.items?.length && !op._produtos.length){
    const top=op._proposal.items.slice().sort((a,b)=>(b.valorProposto||b.valorCalc||0)-(a.valorProposto||a.valorCalc||0))[0];
    return top?NUCLEO_GRUPO[top.nucleo]:null;
  }
  if(!op._produtos.length)return null;
  const p=op._produtos.slice().sort((a,b)=>(b.valor_proposto||0)-(a.valor_proposto||0))[0];
  return p?NUCLEO_GRUPO[p.nucleo]:null;
}
function oppDataFechamento(op){
  const fechados=op._produtos.filter(p=>p.data_fechamento);
  if(!fechados.length)return null;
  return fechados.slice().sort((a,b)=>b.data_fechamento.localeCompare(a.data_fechamento))[0].data_fechamento;
}
function isFechada(op){
  return ['fechada','fechado'].includes((op.pipeline_stage||'').toLowerCase());
}
function isNegada(op){
  return ['negada','negado','cancelada','cancelado','perdida'].includes((op.pipeline_stage||'').toLowerCase());
}
function isAtiva(op){
  const s=(op.pipeline_stage||'').toLowerCase();
  return['prospecção','prospeccao','enviada','ativo','negociacao','negociação'].includes(s);
}

function semFU30(op){
  const fus=op._followups||[];
  if(!fus.length)return true;
  const last=fus[fus.length-1];
  return diasDesde(last.data_contato||last.created_at)>30;
}
function isExpiredOp(op){
  return op._produtos.some(p=>isExpiredProd(p));
}

// ═══ DASHBOARD ══════════════════════════════════════
let chartMensal=null, chartTipo=null, dashTipoMode='nucleo';
function setDashTipoMode(m){dashTipoMode=m;renderDash();}

let dashFuMode='todos';
function setDashFuMode(m){
  dashFuMode=m;
  document.getElementById('dash-fu-btn-todos')?.classList.toggle('ghost',m!=='todos');
  document.getElementById('dash-fu-btn-meus')?.classList.toggle('ghost',m!=='meus');
  renderDashFu();
}
function renderDashFu(){
  const el=document.getElementById('dash-fu-list');
  if(!el)return;
  const today=new Date().toISOString().slice(0,10);
  const items=[];
  allOps.filter(o=>isAtiva(o)).forEach(op=>{
    if(dashFuMode==='meus'&&op.resp_id!==currentUser?.id)return;
    const fus=(op._followups||[]).filter(f=>f.proximo_contato);
    if(!fus.length)return;
    const fu=fus.reduce((a,b)=>a.proximo_contato>b.proximo_contato?a:b);
    items.push({op,fu,date:fu.proximo_contato});
  });
  items.sort((a,b)=>a.date.localeCompare(b.date));
  if(!items.length){
    el.innerHTML='<div class="empty-note">Nenhum follow-up agendado'+(dashFuMode==='meus'?' para você':'')+'.</div>';
    return;
  }
  const in3d=new Date();in3d.setDate(in3d.getDate()+3);
  const in3str=in3d.toISOString().slice(0,10);
  const MESES_ABR=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  el.innerHTML=items.map(({op,fu})=>{
    const past=fu.proximo_contato<today;
    const soon=!past&&fu.proximo_contato<=in3str;
    const cls=past?'fu-past':soon?'fu-soon':'';
    const dateCls=past?'fu-past':soon?'fu-soon':'';
    const parts=fu.proximo_contato.split('-');
    const obs=fu.observacao?(fu.observacao.length>65?fu.observacao.slice(0,65)+'…':fu.observacao):'';
    return`<div class="fu-item ${cls}" onclick="abrirDetail('${escJsStr(op.id)}')">
      <div class="fu-date ${dateCls}">
        <span class="fu-date-day">${parts[2]}</span>
        <span>${MESES_ABR[parseInt(parts[1])-1]}</span>
        ${past?'<span style="font-size:8px">⚠</span>':''}
      </div>
      <div class="fu-body">
        <div class="fu-client">${escHtml(op._cliente?.nome||'—')}</div>
        ${op.projeto?`<div class="fu-proj">${escHtml(op.projeto)}</div>`:''}
        ${obs?`<div class="fu-obs">${escHtml(obs)}</div>`:''}
      </div>
      <div class="fu-right">
        ${respBadge(op.resp_id)}
        ${tipoBadgeProd(op._produtos[0]?.nucleo)}
      </div>
    </div>`;
  }).join('');
}

function renderDash(){
  // oportunidades em destaque
  const destaques = allOps.filter(o=>o.destaque).slice(0,3);
  const deDiv = document.getElementById('dash-destaques');
  if(destaques.length){
    deDiv.style.display='block';
    const cols = destaques.length===1?'1fr':destaques.length===2?'1fr 1fr':'1fr 1fr 1fr';
    deDiv.innerHTML=`<div style="display:grid;grid-template-columns:${cols};gap:10px">`+
      destaques.map(o=>{
        const val=oppValorProposto(o);
        return`<div class="destaque-card" onclick="abrirDetail('${escJsStr(o.id)}')">
          <div class="destaque-card-lbl">★ Destaque</div>
          <div class="destaque-card-cliente">${escHtml(o._cliente?.nome||'—')}</div>
          ${o.projeto?`<div class="destaque-card-proj">${escHtml(o.projeto)}</div>`:''}
          <div class="destaque-card-footer">
            <div style="display:flex;align-items:center;gap:5px">${tipoBadgeProd(o._produtos[0]?.nucleo)}${estagBadge(o.pipeline_stage)}</div>
            <div style="display:flex;align-items:center;gap:6px">${respAvatar(o.resp_id,20)}${val?`<span class="destaque-card-valor">${fmt(val)}</span>`:''}</div>
          </div>
        </div>`;
      }).join('')+`</div>`;
  } else {
    deDiv.style.display='none';
  }

  // populate resp select dynamically (preserve selection)
  const respSel = document.getElementById('dash-resp');
  const respCurrent = respSel.value;
  respSel.innerHTML = '<option value="todos">Todos resp.</option>' +
    Object.values(allUsers).filter(u=>u.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
      .map(u=>`<option value="${escHtml(u.id)}"${u.id===respCurrent?' selected':''}>${escHtml(u.nome.split(' ')[0])}</option>`).join('');

  const respFil = respSel.value;
  const nucFil  = document.getElementById('dash-nucleo')?.value||'todos';
  const ano = new Date().getFullYear();
  const anoStr = String(ano);

  let ops = allOps;
  if(respFil!=='todos') ops = ops.filter(o=>o.resp_id===respFil);

  const fechadas = ops.filter(o=>isFechada(o));
  const ativas   = ops.filter(o=>isAtiva(o));

  // faturamento no ano = valor_fechado dos produtos fechados neste ano
  const fatAno = ops.reduce((sum,op)=>{
    return sum + op._produtos
      .filter(p=>p.data_fechamento&&p.data_fechamento.startsWith(anoStr)&&p.status==='fechado')
      .reduce((s,p)=>s+(+p.valor_fechado||0),0);
  },0);
  // valor efetivo faturado = usando helper por opp (deduz repasses/subs quando há proposta calc)
  const fatEfetivo = ops.filter(o=>isFechada(o)&&(oppDataFechamento(o)||'').startsWith(anoStr))
    .reduce((s,o)=>s+oppValorEfetivo(o,true),0);

  const vPipe = ativas.reduce((s,op)=>s+oppValorProposto(op),0);
  const vPipeEfetivo = ativas.reduce((s,op)=>s+oppValorEfetivo(op,false),0);
  const vPipeTotal = ops.reduce((s,op)=>s+oppValorProposto(op),0);
  const fatTotal = ops.reduce((sum,op)=>sum+op._produtos.filter(p=>p.status==='fechado').reduce((s,p)=>s+(+p.valor_fechado||0),0),0);

  // 2B — conversão correta: opps abertas em anoStr que têm ao menos 1 produto fechado
  const ops2026 = ops.filter(o=>(o.data_entrada||'').startsWith(anoStr));
  const fechadas2026 = ops2026.filter(o=>o._produtos.some(p=>p.status==='fechado'));
  const conv = ops2026.length ? Math.round(fechadas2026.length/ops2026.length*100) : 0;

  // sub-texto: contar produtos ativos nas oportunidades ativas
  const nProdsAtivos = ativas.reduce((s,op)=>s+op._produtos.filter(p=>['ativo','negociacao','negociação'].includes((p.status||'').toLowerCase())).length,0);

  document.getElementById('s-fat').textContent=fmt(fatAno);
  document.getElementById('s-fat-sub').innerHTML=`${fechadas.filter(o=>{
    const d=oppDataFechamento(o); return d&&d.startsWith(anoStr);
  }).length} projetos fechados em ${anoStr}<br><span style="font-size:9px;color:var(--verde)">Efetivo EXP: ${fmt(fatEfetivo)}</span><br><span style="font-size:9px;color:#aaa">Total acumulado: ${fmt(fatTotal)}</span>`;
  document.getElementById('s-pipe').textContent=fmt(vPipe);
  document.getElementById('s-pipe-sub').innerHTML=`${ativas.length} oportunidades ativas<br><span style="font-size:9px;color:var(--azul)">Efetivo EXP: ${fmt(vPipeEfetivo)}</span><br><span style="font-size:9px;color:#aaa">Total histórico: ${fmt(vPipeTotal)}</span>`;
  // D1: hierarquia ativo / total
  document.getElementById('s-ativas').innerHTML=`${ativas.length}<span style="font-size:14px;font-weight:400;color:#aaa"> / ${ops.length}</span>`;
  document.getElementById('s-ativas-sub').textContent=`ativas de ${ops.length} total · ${nProdsAtivos} produtos`;
  document.getElementById('s-conv').textContent=conv+'%';
  document.getElementById('s-conv-sub').textContent=`${fechadas2026.length} de ${ops2026.length} opp. abertas em ${anoStr}`;

  // 2E — gráfico mensal: por núcleo quando resp='todos', por usuário quando resp filtrado
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const uMap={};
  const nucMap={};
  ops.forEach(op=>{
    op._produtos.forEach(p=>{
      if(!p.data_fechamento||!p.data_fechamento.startsWith(anoStr))return;
      if(p.status!=='fechado')return;
      if(nucFil!=='todos'&&(NUCLEO_GRUPO[p.nucleo]||p.nucleo)!==nucFil)return;
      const m=parseInt(p.data_fechamento.slice(5,7))-1;
      if(m<0||m>11)return;
      const val=+p.valor_fechado||0;
      // por usuário
      const uid=op.resp_id;
      if(!uMap[uid])uMap[uid]=Array(12).fill(0);
      uMap[uid][m]+=val;
      // por núcleo
      const grp=NUCLEO_GRUPO[p.nucleo]||p.nucleo||'Outros';
      if(!nucMap[grp])nucMap[grp]=Array(12).fill(0);
      nucMap[grp][m]+=val;
    });
  });
  let datasets;
  if(respFil==='todos'){
    const nucOrdem=['Urbanismo','Paisagismo','Consultorias','Projetos Especiais'];
    const nucs = nucFil==='todos'
      ? nucOrdem.filter(n=>nucMap[n])
      : [nucFil].filter(n=>nucMap[n]);
    datasets = nucs.map(grp=>{
      const cor=CHART_CORES[grp]||'#aaa';
      return{label:grp,data:nucMap[grp],borderColor:cor,backgroundColor:cor+'18',borderWidth:2.5,pointRadius:4,pointHoverRadius:6,tension:.3,fill:false};
    });
    // Linha de soma total — sempre visível quando há mais de um núcleo
    if(nucFil==='todos' && datasets.length>0){
      const total=Array(12).fill(0);
      nucs.forEach(n=>nucMap[n].forEach((v,i)=>total[i]+=v));
      datasets.push({label:'Total',data:total,borderColor:CHART_CORES.Total,backgroundColor:'transparent',borderWidth:3,pointRadius:4,pointHoverRadius:6,tension:.3,fill:false,borderDash:[5,3]});
    }
    if(!datasets.length){
      const total=Array(12).fill(0);
      Object.values(nucMap).forEach(d=>d.forEach((v,i)=>total[i]+=v));
      datasets=[{label:`Total ${anoStr}`,data:total,borderColor:CHART_CORES.Total,backgroundColor:CHART_CORES.Total+'22',borderWidth:3,pointRadius:4,tension:.3,fill:false}];
    }
  } else {
    datasets=Object.entries(uMap).map(([uid,dados])=>{
      const u=allUsers[uid]||{};
      const cor=u.cor||'#aaa';
      return{label:u.nome?.split(' ')[0]||'?',data:dados,borderColor:cor,backgroundColor:cor+'18',borderWidth:2.5,pointRadius:4,pointHoverRadius:6,tension:.3,fill:false};
    });
  }
  if(chartMensal)chartMensal.destroy();
  const ctx1=document.getElementById('chart-mensal').getContext('2d');
  chartMensal=new Chart(ctx1,{type:'line',data:{labels:meses,datasets},options:{responsive:true,plugins:{legend:{labels:{font:{size:10},boxWidth:10,padding:8,usePointStyle:true}}},scales:{x:{ticks:{font:{size:9}},grid:{color:'rgba(0,0,0,.04)'}},y:{ticks:{font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k':v},grid:{color:'rgba(0,0,0,.04)'}}}}});

  // S4-02 — donut com toggle: por núcleo / pipeline stage / responsável
  // Atualiza estado visual dos botões
  ['nucleo','stage','resp'].forEach(m=>{
    const b=document.getElementById('dtm-'+m);
    if(b){b.className=m===dashTipoMode?'btn xs':'btn xs ghost';}
  });
  const tipoMap={};
  ops.forEach(op=>{
    op._produtos.forEach(p=>{
      if(p.status!=='fechado')return;
      if(!p.data_fechamento||!p.data_fechamento.startsWith(anoStr))return;
      let key;
      if(dashTipoMode==='nucleo'){
        key=NUCLEO_GRUPO[p.nucleo]||p.nucleo||'Outros';
      } else if(dashTipoMode==='stage'){
        key=STAGE_LABEL[op.pipeline_stage]||op.pipeline_stage||'—';
      } else {
        const u=allUsers[op.resp_id];
        key=u?u.nome.split(' ')[0]:'Sem resp.';
      }
      tipoMap[key]=(tipoMap[key]||0)+(+p.valor_fechado||0);
    });
  });
  // Cores: núcleo usa CHART_CORES, outros usam cor do usuário ou paleta fixa
  const STAGE_CORES={'Fechado Ganho':'#1D9E75','Negada':'#E53935','Perdida':'#FF7043','Cancelada':'#9E9E9E','Fechada':'#2563EB','Em negociação':'#F5A623','Enviada':'#8E44AD','Prospecção':'#607D8B'};
  const RESP_PALETA=['#5280CA','#45865D','#C36247','#D19931','#8E44AD','#607D8B','#E53935','#FF7043'];
  if(chartTipo)chartTipo.destroy();
  const ctx2=document.getElementById('chart-tipo').getContext('2d');
  const tLabels=Object.keys(tipoMap).sort((a,b)=>tipoMap[b]-tipoMap[a]);
  let tCores;
  if(dashTipoMode==='nucleo'){
    tCores=tLabels.map(l=>CHART_CORES[l]||'#aaa');
  } else if(dashTipoMode==='stage'){
    tCores=tLabels.map(l=>STAGE_CORES[l]||'#aaa');
  } else {
    // por responsável: usa cor do usuário
    tCores=tLabels.map((l,i)=>{
      const u=Object.values(allUsers).find(u=>u.nome.split(' ')[0]===l);
      return u?.cor||RESP_PALETA[i%RESP_PALETA.length];
    });
  }
  const total_tipo=Object.values(tipoMap).reduce((a,b)=>a+b,0)||1;
  chartTipo=new Chart(ctx2,{type:'doughnut',data:{labels:tLabels,datasets:[{
    data:tLabels.map(l=>tipoMap[l]),
    backgroundColor:tCores,
    borderWidth:1,borderColor:'#fff'
  }]},options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)} (${Math.round(ctx.parsed/total_tipo*100)}%)`}}}}});
  document.getElementById('chart-tipo-legenda').innerHTML=tLabels.length?tLabels.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
      <div style="width:8px;height:8px;border-radius:2px;background:${tCores[i]};flex-shrink:0"></div>
      <div style="font-size:9px;flex:1;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escAttr(l)}">${escHtml(l)}</div>
      <div style="font-size:9px;font-family:var(--font-mono);color:#555;font-weight:600">${fmt(tipoMap[l])}</div>
      <div style="font-size:9px;font-family:var(--font-mono);color:#999;min-width:28px;text-align:right">${Math.round(tipoMap[l]/total_tipo*100)}%</div>
    </div>`).join(''):'<div style="font-size:10px;color:#aaa;padding:4px 0">Sem fechamentos em '+anoStr+'</div>';
  const elTipoTitle=document.getElementById('chart-tipo-title');
  if(elTipoTitle)elTipoTitle.textContent=`Por tipo · ${anoStr}`;


  // fechamentos e negativas — 45 dias
  const cut=new Date();cut.setDate(cut.getDate()-45);
  const recFech=allOps.filter(o=>{
    if(!isFechada(o))return false;
    const d=oppDataFechamento(o)||o.updated_at;
    return d&&new Date(d)>=cut;
  }).sort((a,b)=>(oppDataFechamento(b)||b.updated_at||'').localeCompare(oppDataFechamento(a)||a.updated_at||''));
  const recNeg=allOps.filter(o=>{
    if(!isNegada(o))return false;
    const d=o.updated_at;
    return d&&new Date(d)>=cut;
  }).sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));

  const tblFech = `<table><thead><tr><th>Nº</th><th>Cliente</th><th>Núcleo</th><th>Resp.</th><th>Data</th><th>Valor</th></tr></thead><tbody>
    ${recFech.map(o=>`<tr class="click" onclick="abrirDetail('${escJsStr(o.id)}')">
      <td class="num-tag">${escHtml(o.num_legado||'—')}</td>
      <td><strong>${escHtml(o._cliente?.nome||'—')}</strong></td>
      <td>${tipoBadgeProd(o._produtos[0]?.nucleo)}</td>
      <td>${respBadge(o.resp_id)}</td>
      <td class="dtag">${fmtD(oppDataFechamento(o)||o.updated_at)}</td>
      <td style="font-weight:700;font-family:var(--font-mono)">${fmt(oppValorFechado(o))}</td>
    </tr>`).join('')}</tbody></table>`;
  const tblNeg = `<table><thead><tr><th>Nº</th><th>Cliente</th><th>Núcleo</th><th>Resp.</th><th>Data</th><th>Valor prop.</th></tr></thead><tbody>
    ${recNeg.map(o=>`<tr class="click" onclick="abrirDetail('${escJsStr(o.id)}')">
      <td class="num-tag">${escHtml(o.num_legado||'—')}</td>
      <td><strong>${escHtml(o._cliente?.nome||'—')}</strong></td>
      <td>${tipoBadgeProd(o._produtos[0]?.nucleo)}</td>
      <td>${respBadge(o.resp_id)}</td>
      <td class="dtag">${fmtD(o.updated_at)}</td>
      <td style="font-family:var(--font-mono);color:var(--terracota)">${fmt(oppValorProposto(o))}</td>
    </tr>`).join('')}</tbody></table>`;

  document.getElementById('dash-fechamentos').innerHTML=recFech.length?tblFech:`<div class="empty-note">Nenhum fechamento nos últimos 45 dias.</div>`;
  document.getElementById('dash-negativas').innerHTML=recNeg.length?tblNeg:`<div class="empty-note">Nenhuma negativa nos últimos 45 dias.</div>`;
  renderDashFu();
  renderValorPropostas();
}

// ═══ PIPELINE ═══════════════════════════════════════
function renderPipe(){
  const respFil=document.getElementById('pf-resp').value;
  const nucFil=document.getElementById('pf-nucleo').value;
  const ordemFil=document.getElementById('pf-ordem')?.value||'recentes';

  // 3B — função de ordenação aplicada a todos os grupos de cards
  function sortCards(arr){
    if(ordemFil==='valor')
      return arr.slice().sort((a,b)=>oppValorProposto(b)-oppValorProposto(a));
    if(ordemFil==='contato')
      return arr.slice().sort((a,b)=>{
        const last=op=>op._followups?.reduce((mx,f)=>f.data_contato>mx?f.data_contato:mx,op.data_entrada||'')||'';
        return last(b).localeCompare(last(a));
      });
    return arr.slice().sort((a,b)=>(b.data_entrada||'').localeCompare(a.data_entrada||''));
  }

  let ops=allOps;
  if(respFil!=='todos')ops=ops.filter(o=>userNome(o.resp_id)===respFil);
  if(nucFil!=='todos')ops=ops.filter(o=>o._produtos.some(p=>NUCLEO_GRUPO[p.nucleo]===nucFil));

  const cut45=new Date();cut45.setDate(cut45.getDate()-45);

  const prosp   = ops.filter(o=>['prospecção','prospeccao'].includes((o.pipeline_stage||'').toLowerCase()));
  const orcAtiv = ops.filter(o=>['enviada','ativo'].includes((o.pipeline_stage||'').toLowerCase()));
  const negoc   = ops.filter(o=>['negociacao','negociação'].includes((o.pipeline_stage||'').toLowerCase()));
  const fech    = ops.filter(o=>isFechada(o)&&(oppDataFechamento(o)||o.updated_at)&&new Date(oppDataFechamento(o)||o.updated_at)>=cut45);
  const negado  = ops.filter(o=>isNegada(o));

  const vOrc=orcAtiv.reduce((s,o)=>s+oppValorEfetivo(o),0);
  const vNeg=negoc.reduce((s,o)=>s+oppValorEfetivo(o),0);
  const vFech=fech.reduce((s,o)=>s+oppValorFechado(o),0);

  document.getElementById('k-cnt-p').textContent=prosp.length;
  document.getElementById('k-cnt-o').textContent=orcAtiv.length;
  document.getElementById('k-sum-o').textContent=fmt(vOrc);
  document.getElementById('k-cnt-neg').textContent=negoc.length;
  document.getElementById('k-sum-neg').textContent=fmt(vNeg);
  document.getElementById('k-cnt-f').textContent=fech.length;
  document.getElementById('k-sum-f').textContent=fmt(vFech);
  document.getElementById('k-cnt-neg2').textContent=negado.length;
  document.getElementById('pipe-total').textContent=`Pipeline: ${fmt(vOrc+vNeg)}`;

  function card(op){
    const vEff=oppValorEfetivo(op);
    const vFch=oppValorFechado(op);
    const tc=tempClass(op._followups);
    const exp=isExpiredOp(op);
    const dest=op.destaque&&!exp;
    const nucleos=[...new Set((op._proposal?.items?.length?op._proposal.items.map(i=>i.nucleo):op._produtos.map(p=>p.nucleo)))];
    const prop=op._proposal;
    const code=prop?.prop_code
      ? `EXP-${String(prop.prop_code).padStart(3,'0')}`
      : (op.num_legado||'—');
    const locStr=[op.cidade,op.uf].filter(Boolean).join('/');
    const neg=['negociacao','negociação'].includes((op.pipeline_stage||'').toLowerCase());
    const fech=isFechada(op);
    const cls=`pcard${exp?' pcard-exp':fech?' pcard-fech':neg?' pcard-neg':dest?' pcard-dest':''}`;
    return`<div class="${cls}" draggable="true" data-id="${op.id}" onclick="abrirDetail('${escJsStr(op.id)}')">
      <div class="pcard-top">
        <span class="pcard-code">${code}</span>
        <div style="display:flex;align-items:center;gap:4px">
          ${dest?'<span style="font-size:8px;color:#C4831A;font-weight:700">★</span>':''}
          <div class="temp ${tc}"></div>
        </div>
      </div>
      <div class="pcard-client">${escHtml(op._cliente?.nome||'—')}</div>
      ${op.projeto?`<div class="pcard-proj">${escHtml(op.projeto)}</div>`:''}
      ${locStr?`<div class="pcard-loc">${escHtml(locStr)}</div>`:''}
      <div class="pcard-meta">
        ${nucleos.map(n=>tipoBadgeProd(n)).join('')}
        ${respBadge(op.resp_id)}
        ${exp?'<span class="badge b-exp" style="font-size:7px">EXP</span>':''}
        <span class="pcard-val">${fmt(vFch||vEff)}</span>
      </div>
    </div>`;
  }

  const empty='<div style="font-size:10px;color:#aaa;padding:8px">—</div>';
  document.getElementById('k-prosp').innerHTML=sortCards(prosp).map(card).join('')||empty;
  document.getElementById('k-orc').innerHTML=sortCards(orcAtiv).map(card).join('')||empty;
  document.getElementById('k-negoc').innerHTML=sortCards(negoc).map(card).join('')||empty;
  document.getElementById('k-fech').innerHTML=sortCards(fech).map(card).join('')||empty;
  document.getElementById('k-neg').innerHTML=sortCards(negado).map(card).join('')||empty;
  setupPipelineDrag();
}

function setupPipelineDrag(){
  const STAGE_MAP={'k-prosp':'prospecção','k-orc':'enviada','k-negoc':'negociacao','k-fech':'fechada','k-neg':'negada'};
  let dragId=null, srcCol=null;

  document.querySelectorAll('.pcard[data-id]').forEach(el=>{
    el.addEventListener('dragstart',e=>{
      dragId=el.dataset.id;
      srcCol=el.closest('.kitems')?.id;
      e.dataTransfer.effectAllowed='move';
      setTimeout(()=>el.classList.add('dragging'),0);
    });
    el.addEventListener('dragend',()=>{
      el.classList.remove('dragging');
      document.querySelectorAll('.kitems').forEach(c=>c.classList.remove('drag-over'));
    });
  });

  Object.keys(STAGE_MAP).forEach(colId=>{
    const col=document.getElementById(colId);
    if(!col)return;
    col.addEventListener('dragover',e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave',e=>{
      if(!col.contains(e.relatedTarget))col.classList.remove('drag-over');
    });
    col.addEventListener('drop',async e=>{
      e.preventDefault();
      col.classList.remove('drag-over');
      if(!dragId||colId===srcCol)return;
      const id=dragId; dragId=null; srcCol=null;
      const newStage=STAGE_MAP[colId];
      if(newStage==='fechada'){
        // Abre modal de fechamento; carregarDados reseta posição visual do card
        await carregarDados(); renderPipe();
        abrirFechamento(id);
        return;
      }
      await sb.from('oportunidades').update({pipeline_stage:newStage,updated_at:new Date().toISOString()}).eq('id',id);
      await carregarDados();
      renderPipe(); renderOrc();
    });
  });
}

// ═══ ORÇAMENTOS ═════════════════════════════════════
function sortOrc(key){
  if(orcSortKey===key)orcSortDir*=-1;else{orcSortKey=key;orcSortDir=-1;}
  renderOrc();
}

function renderOrc(){
  const ano=document.getElementById('of-ano').value;
  const nucleo=document.getElementById('of-nucleo').value;
  const status=document.getElementById('of-status').value;
  const respFil=document.getElementById('of-resp').value;
  const q=document.getElementById('of-busca').value.toLowerCase();

  let ops=allOps;
  if(ano!=='todos')ops=ops.filter(o=>(o.data_entrada||'').startsWith(ano)||(oppDataFechamento(o)||'').startsWith(ano));
  if(nucleo!=='todos')ops=ops.filter(o=>o._produtos.some(p=>NUCLEO_GRUPO[p.nucleo]===nucleo));
  if(status!=='todos'){
    const slMap={'Prospecção':['prospecção','prospeccao'],'Orçamento ativo':['enviada','ativo'],'Negociação':['negociacao','negociação'],'Fechado':['fechada','fechado'],'Negado':['negada','negado','perdida'],'Cancelado':['cancelada','cancelado'],'Expirado':'exp'};
    const sl=slMap[status];
    if(sl==='exp')ops=ops.filter(o=>isExpiredOp(o));
    else if(sl)ops=ops.filter(o=>sl.includes((o.pipeline_stage||'').toLowerCase()));
  }
  if(respFil!=='todos')ops=ops.filter(o=>userNome(o.resp_id)===respFil);
  if(q)ops=ops.filter(o=>(o._cliente?.nome||'').toLowerCase().includes(q)||(o.num_legado||'').toLowerCase().includes(q)||(o.cidade||'').toLowerCase().includes(q));

  ops=ops.slice().sort((a,b)=>{
    let va=a[orcSortKey]||'', vb=b[orcSortKey]||'';
    if(orcSortKey==='valor_proposto'){va=oppValorProposto(a);vb=oppValorProposto(b);}
    if(orcSortKey==='valor_fechado'){va=oppValorFechado(a);vb=oppValorFechado(b);}
    if(typeof va==='string')return va.localeCompare(vb)*orcSortDir;
    return(va-vb)*orcSortDir;
  });

  const soma=ops.reduce((s,o)=>s+oppValorProposto(o),0);
  document.getElementById('orc-soma').textContent=fmt(soma);
  document.getElementById('orc-cnt').textContent=ops.length;

  if(!ops.length){document.getElementById('orc-body').innerHTML=`<tr><td colspan="14" class="empty-note">Nenhum resultado.</td></tr>`;return;}

  document.getElementById('orc-body').innerHTML=ops.map(o=>{
    const vProp=oppValorProposto(o);
    const vFch=oppValorFechado(o);
    const stLbl=stageLabel(o.pipeline_stage);
    const nucleos=[...new Set(o._produtos.map(p=>p.nucleo))];
    const tc=tempClass(o._followups);
    const exp=isExpiredOp(o);
    // 3F — data_envio e dias_envio do produto principal (maior valor)
    const prodPrincipal=o._produtos.slice().sort((a,b)=>(+b.valor_proposto||0)-(+a.valor_proposto||0))[0];
    const dataEnvio=prodPrincipal?.data_envio||null;
    const diasEnvio=dataEnvio?diasDesde(dataEnvio):null;
    const tempTooltip='Hot: contato <30d · Warm: 30-60d · Cold: >60d';
    const _orcNeg=['negociacao','negociação'].includes((o.pipeline_stage||'').toLowerCase());
    const _orcFech=isFechada(o);
    const _orcCls=exp?' expired':_orcFech?' orc-fech':(_orcNeg||o.destaque)?' orc-neg':'';
    return`<tr class="click${_orcCls}" onclick="abrirDetail('${escJsStr(o.id)}')">
      <td class="num-tag">${escHtml(o.num_legado||'—')}</td>
      <td><strong>${escHtml(o._cliente?.nome||'—')}</strong>${o.projeto?`<br><span style="font-size:9px;color:#888">${escHtml(o.projeto)}</span>`:''}</td>
      <td>${nucleos.map(n=>tipoBadgeProd(n)).join(' ')}</td>
      <td>${respBadge(o.resp_id)}</td>
      <td style="font-size:11px">${escHtml(o.cidade||'—')}${o.uf?'/'+escHtml(o.uf):''}</td>
      <td class="dtag">${fmtD(o.data_entrada)}</td>
      <td class="dtag">${fmtD(dataEnvio)}</td>
      <td style="font-weight:600;font-family:var(--font-mono)">${fmt(vProp)}</td>
      <td style="font-family:var(--font-mono);color:var(--azul);font-size:10px" title="Valor efetivo EXP (exclui repasses/subs)">${fmt(oppValorEfetivo(o,false))}</td>
      <td style="font-weight:600;font-family:var(--font-mono);color:${vFch?'var(--verde)':'inherit'}">${vFch?fmt(vFch):'—'}</td>
      <td style="white-space:nowrap">${probDots(prodPrincipal?.prob)}</td>
      <td class="dtag">${diasEnvio!==null?diasEnvio+' d':'—'}</td>
      <td>${estagBadge(o.pipeline_stage)}</td>
      <td title="${escAttr(tempTooltip)}"><div class="temp ${tc}" style="cursor:help"></div></td>
    </tr>`;
  }).join('');
}

// ═══ CONTATOS ═══════════════════════════════════════
function contactStatus(clienteId){
  const ops=allOps.filter(o=>o.cliente_id===clienteId);
  if(!ops.length)return'Prospecção';
  const dates=[...ops.map(o=>o.updated_at||o.data_entrada)].filter(Boolean).sort((a,b)=>b.localeCompare(a));
  if(!dates.length)return'Prospecção';
  const d=diasDesde(dates[0]);
  if(d<=90)return'Ativo';if(d<=360)return'Sem atividade';return'Inativo';
}
function statusDotColor(s){return{Ativo:'#1D6A4A','Sem atividade':'#C4831A',Inativo:'#B84C3A','Prospecção':'#aaa'}[s]||'#aaa';}

function renderContatos(){
  const q=document.getElementById('ct-busca').value.toLowerCase();
  const sf=document.getElementById('ct-status').value;

  let clientes=[...allClients];
  if(q)clientes=clientes.filter(c=>(c.nome||'').toLowerCase().includes(q)||(c.tipo==='pessoa_fisica'&&('pfi '+c.nome).toLowerCase().includes(q)));
  if(sf!=='todos')clientes=clientes.filter(c=>contactStatus(c.id)===sf);

  // PF vêm depois, ambos em ordem alfabética
  const pj=clientes.filter(c=>c.tipo!=='pessoa_fisica').sort((a,b)=>a.nome.localeCompare(b.nome));
  const pf=clientes.filter(c=>c.tipo==='pessoa_fisica').sort((a,b)=>a.nome.localeCompare(b.nome));
  clientes=[...pj,...pf];

  document.getElementById('ct-total').textContent=clientes.length+' clientes';

  if(!clientes.length){document.getElementById('contatos-list').innerHTML=`<div class="empty-note">Nenhuma empresa encontrada.</div>`;return;}

  const cards=[];
  clientes.forEach(c=>{
    const isPF=c.tipo==='pessoa_fisica';
    const contatos=allContatos.filter(x=>x.cliente_id===c.id);
    const opsC=allOps.filter(o=>o.cliente_id===c.id);
    const canEdit=!currentUser?.viewer_only;
    const contatosHtml=contatos.length?contatos.map(p=>`
      <div class="pessoa-row">
        <div style="flex:1"><div style="font-weight:500">${escHtml(p.nome||'â€”')}</div><div style="font-size:10px;color:#888">${escHtml(p.cargo||'')}</div></div>
        <div style="font-size:10px;color:#888;text-align:right">
          ${p.email?`<div>${escHtml(p.email)}</div>`:''}${p.telefone?`<div>${escHtml(p.telefone)}</div>`:''}
        </div>
      </div>`).join(''):'<div style="font-size:11px;color:#aaa;padding:8px 0">Nenhum contato cadastrado.</div>';

    if(isPF){
      // um card por oportunidade
      const opsList=opsC.length?opsC:[null];
      opsList.forEach((o,oi)=>{
        const cardId='ce-'+c.id.replace(/-/g,'')+'-'+oi;
        const proj=o?(o.projeto||o.cidade||o.num_legado||'Sem título'):'Sem proposta';
        const nomeExib=`<span style="font-size:9px;font-weight:700;color:#888;margin-right:4px;letter-spacing:.4px">PFI |</span>${escHtml(c.nome)}`;
        const stDot=o?estagBadge(o.pipeline_stage):'';
        cards.push(`<div class="cont-empresa">
          <div class="cont-hd" onclick="toggleContato('${cardId}')">
            <div>
              <div class="cont-nome">${nomeExib}</div>
              <div style="font-size:10px;color:#888;margin-top:2px">${proj}${o?` · ${stDot}`:''}</div>
            </div>
            <div class="cont-status">
              <div class="status-dot" style="background:${o?'#1D6A4A':'#aaa'}"></div>
              <span style="font-size:10px;color:#888">${o?'Com proposta':'Sem proposta'}</span>
            </div>
          </div>
          <div class="cont-body" id="${cardId}">
            ${canEdit?`<div style="padding:8px 0 6px;border-bottom:1px solid var(--cinza2)">
              <button class="btn sm" onclick="abrirNovoContato('${escJsStr(c.id)}')">+ Adicionar contato</button>
            </div>`:''}
            ${contatosHtml}
            ${o?`<div style="margin-top:8px;border-top:1px solid var(--cinza2);padding-top:8px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:8px" onclick="abrirDetail('${escJsStr(o.id)}')">
              <span class="num-tag">${escHtml(o.num_legado||'—')}</span>${tipoBadgeProd(o._produtos[0]?.nucleo)}
              <span style="flex:1;color:#888">${escHtml(o.projeto||o.cidade||'—')}</span>
              <span style="font-family:var(--font-mono)">${fmt(oppValorProposto(o))}</span>${estagBadge(o.pipeline_stage)}
            </div>`:''}
          </div>
        </div>`);
      });
    } else {
      const st=contactStatus(c.id);
      const id='ce-'+c.id.replace(/-/g,'');
      const siglaTag=c.sigla?`<span style="font-size:8px;font-weight:700;letter-spacing:.6px;background:var(--cinza2);color:#666;padding:1px 5px;border-radius:3px;margin-left:6px;font-family:var(--font-mono)">${escHtml(c.sigla)}</span>`:'';
      cards.push(`<div class="cont-empresa">
        <div class="cont-hd" onclick="toggleContato('${id}')">
          <div style="min-width:0;flex:1">
            <div class="cont-nome" style="display:flex;align-items:center;gap:0">${escHtml(c.nome)}${siglaTag}</div>
            <div style="font-size:10px;color:#888;margin-top:2px">${c.cidade||''}${c.uf?', '+c.uf:''} · ${opsC.length} proposta${opsC.length!==1?'s':''}</div>
          </div>
          <div class="cont-status">
            <div class="status-dot" style="background:${statusDotColor(st)}"></div>
            <span style="font-size:10px;color:#888">${st}</span>
          </div>
        </div>
        <div class="cont-body" id="${id}">
          ${canEdit?`<div style="padding:8px 0 6px;border-bottom:1px solid var(--cinza2);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <button class="btn sm" onclick="abrirNovoContato('${escJsStr(c.id)}')">+ Adicionar contato</button>
            <button class="btn sm" onclick="editarSiglaCliente(event,'${escJsStr(c.id)}','${escJsStr(c.sigla||'')}')">✎ Sigla${c.sigla?': '+escHtml(c.sigla):''}</button>
          </div>`:''}
          ${contatosHtml}
          ${opsC.length?`<div style="margin-top:8px;border-top:1px solid var(--cinza2);padding-top:8px">
            <div style="font-size:8px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#999;margin-bottom:6px">Propostas</div>
            ${opsC.slice(0,5).map(o=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:11px" onclick="abrirDetail('${escJsStr(o.id)}')">
              <span class="num-tag">${escHtml(o.num_legado||'—')}</span>${tipoBadgeProd(o._produtos[0]?.nucleo)}
              <span style="flex:1;color:#888">${escHtml(o.projeto||o.cidade||'—')}</span>
              <span style="font-family:var(--font-mono)">${fmt(oppValorProposto(o))}</span>${estagBadge(o.pipeline_stage)}
            </div>`).join('')}
          </div>`:''}
        </div>
      </div>`);
    }
  });
  document.getElementById('contatos-list').innerHTML=cards.join('');
}

function toggleContato(id){const el=document.getElementById(id);if(el)el.classList.toggle('open');}

function editarSiglaCliente(e, clienteId, siglaAtual){
  e.stopPropagation();
  const btn=e.currentTarget;
  if(btn.dataset.editing) return;
  btn.dataset.editing='1';
  const wrap=document.createElement('span');
  wrap.style.cssText='display:inline-flex;align-items:center;gap:4px;margin-left:4px';
  wrap.innerHTML=`<input id="sigla-inp-${clienteId.slice(0,8)}" type="text" value="${escAttr(siglaAtual)}" maxlength="6"
    placeholder="CPB" style="width:58px;padding:2px 6px;font-size:11px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;border:1px solid var(--grafite);border-radius:4px;font-family:var(--font-mono)">
    <button class="btn sm verde" style="padding:2px 8px">✓</button>
    <button class="btn sm" style="padding:2px 8px">✕</button>`;
  btn.insertAdjacentElement('afterend', wrap);
  btn.style.display='none';
  const inp=wrap.querySelector('input');
  inp.focus(); inp.select();
  const salvar=async()=>{
    const nova=inp.value.trim().toUpperCase()||null;
    const {error}=await sb.from('clientes').update({sigla:nova}).eq('id',clienteId);
    if(error){toast('Erro: '+error.message);return;}
    const c=allClients.find(x=>x.id===clienteId);
    if(c) c.sigla=nova;
    toast('Sigla '+(nova?`"${nova}" salva`:'removida'));
    renderContatos();
  };
  wrap.querySelectorAll('button')[0].onclick=salvar;
  wrap.querySelectorAll('button')[1].onclick=()=>{wrap.remove();btn.style.display='';delete btn.dataset.editing;};
  inp.onkeydown=ev=>{if(ev.key==='Enter')salvar();else if(ev.key==='Escape'){wrap.remove();btn.style.display='';delete btn.dataset.editing;}};
}

// ═══ DETALHE DA PROPOSTA — definido abaixo com botões de ação ════════

// ═══ FOLLOW-UP ══════════════════════════════════════
async function openFollowUpModal(){
  let op=allOps.find(o=>o.id===detailOppId);
  if(!op)return;
  if(!op._produtos.length && op._proposal?.items?.length){
    op = await garantirProdutosCalcMaterializados(op.id, 'follow-up');
    if(!op)return;
  }
  const fus=op._followups||[];
  if(fus.length>=5){toast('Limite de 5 follow-ups atingido.');return;}
  document.getElementById('fu-title').textContent=`Follow-up — ${op._cliente?.nome||''} (${op.num_legado||''})`;
  document.getElementById('fu-data').value=new Date().toISOString().slice(0,10);
  document.getElementById('fu-next').value='';
  document.getElementById('fu-obs').value='';
  document.getElementById('fu-hist').innerHTML=fus.length?
    `<div style="font-size:8px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#999;margin-bottom:6px">Histórico</div>`+
    fus.map(f=>`<div class="follow-row"><div style="min-width:75px;font-size:9px;font-weight:700;color:#999">${fmtD(f.data_contato)}</div><div style="flex:1">${escHtml(f.observacao||'—')}</div>${f.proximo_contato?`<div style="font-size:9px;color:var(--ouro)">→ ${fmtD(f.proximo_contato)}</div>`:''}</div>`).join(''):'';
  closeM('modal-detail');
  openM('modal-fu');
}

async function garantirProdutosCalcMaterializados(oppId, contexto='operação'){
  let op=allOps.find(o=>o.id===oppId);
  if(!op)return null;
  if(op._produtos.length || !op._proposal?.items?.length)return op;

  const payload=(op._proposal.items||[]).map((it, idx)=>({
    oportunidade_id: oppId,
    nucleo: it.nucleo || 'PAIS',
    subtipo: it.subK || null,
    area: it.area != null ? (+it.area || null) : null,
    valor_calculado: +it.valorCalc || 0,
    valor_proposto: it.valorProposto != null ? +it.valorProposto : (+it.valorCalc || 0),
    status: 'ativo',
    prob: ['negociacao','negociação'].includes((op.pipeline_stage||'').toLowerCase()) ? 4 : 3,
    calc_id: op.proposta_calc_id || null,
    obs: [it.subLabel, it.desc, it.id ? `ref ${it.id}` : '', `calc item ${idx+1}`].filter(Boolean).join(' · ') || null,
    updated_at: new Date().toISOString(),
  }));

  const {error}=await sb.from('produtos').insert(payload);
  if(error){toast(`Erro ao preparar ${contexto}: ${error.message}`);return null;}

  await carregarDados();
  op=allOps.find(o=>o.id===oppId)||null;
  if(op) toast('Itens da proposta da calculadora sincronizados no CRM para continuar a operação.');
  return op;
}

async function salvarFU(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  let op=allOps.find(o=>o.id===detailOppId);
  if(op && !op._produtos.length && op._proposal?.items?.length){
    op = await garantirProdutosCalcMaterializados(op.id, 'follow-up');
    if(!op)return;
  }
  const prodId=op?._produtos?.[0]?.id||null;
  const obs=document.getElementById('fu-obs').value.trim();
  if(!obs){toast('Informe a observação.');return;}
  if(!prodId){toast('Esta oportunidade ainda não possui produto vinculado para registrar follow-up.');return;}
  const {error}=await sb.from('followups_produto').insert({
    produto_id: prodId,
    data: document.getElementById('fu-data').value||null,
    next_date: document.getElementById('fu-next').value||null,
    obs: obs,
    criado_por: currentUser?.id||null,
  });
  if(error){toast('Erro ao salvar: '+error.message);return;}
  toast('Follow-up registrado!');
  closeM('modal-fu');
  await carregarDados();
  abrirDetail(detailOppId);
  calcAlertas();
}

// ═══ ALERTAS — integrados no bell global (AppNotif) ══════════
function calcAlertas(){
  // COM-5: monta lista completa, filtra descartados, limita a 50
  const todos=[];
  allOps.filter(o=>isAtiva(o)).forEach(o=>{
    if(isExpiredOp(o)) todos.push({key:'exp_'+o.id,tipo:'exp',op:o,msg:`${o.num_legado||''} ${o._cliente?.nome||''}`.trim()});
    else if(semFU30(o)) todos.push({key:'fu_'+o.id,tipo:'fu',op:o,msg:`${o.num_legado||''} ${o._cliente?.nome||''}`.trim()});
  });
  const ativos=todos.filter(a=>!alertasDescartados.has(a.key)).slice(0,50);

  // Alimenta o bell unificado
  if(typeof AppNotif !== 'undefined') {
    AppNotif.setComputedSection('comercial', {
      label: 'Comercial',
      items: ativos.map(a => ({
        key:      a.key,
        icon:     a.tipo === 'exp' ? '⚡' : '⏰',
        titulo:   a.tipo === 'exp' ? 'Proposta expirada' : 'Sem follow-up 30d',
        corpo:    a.msg,
        onClick:  () => { abrirDetail(a.op.id); },
        onDismiss: () => descartarAlerta(a.key),
      }))
    });
  }
}

function descartarAlerta(key){
  alertasDescartados.add(key);
  localStorage.setItem('exp_alertas_ok',JSON.stringify([...alertasDescartados]));
  calcAlertas(); // re-sincroniza seção "comercial" no AppNotif
}

function limparTodosAlertas(){
  allOps.filter(o=>isAtiva(o)).forEach(o=>{
    alertasDescartados.add('exp_'+o.id);
    alertasDescartados.add('fu_'+o.id);
  });
  localStorage.setItem('exp_alertas_ok',JSON.stringify([...alertasDescartados]));
  calcAlertas();
}

function toggleAlertas(){ _appNotifToggle?.(); }

// ═══ BOAS VINDAS ════════════════════════════════════
function showBoasVindas(){
  if(!currentUser)return;
  const nome=currentUser.nome?.split(' ')[0]||'';
  const hora=new Date().getHours();
  document.getElementById('bv-title').textContent=`${hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite'}, ${nome}!`;

  const cut45=new Date();cut45.setDate(cut45.getDate()-45);
  const rec45=allOps.filter(o=>(isFechada(o)||isNegada(o))&&(oppDataFechamento(o)||o.updated_at)&&new Date(oppDataFechamento(o)||o.updated_at)>=cut45);
  const vF45=rec45.filter(o=>isFechada(o)).reduce((s,o)=>s+oppValorFechado(o),0);

  let html='';
  if(!currentUser.viewer_only){
    const ativas=allOps.filter(o=>isAtiva(o)&&o.resp_id===currentUser.id);
    html+=`<div class="bv-section"><div class="bv-title">Suas oportunidades ativas</div>
      ${ativas.slice(0,5).map(o=>`<div class="bv-item">
        <span class="num-tag">${escHtml(o.num_legado||'—')} ${escHtml(o._cliente?.nome||'—')}</span>
        <span style="font-family:var(--font-mono)">${fmt(oppValorProposto(o))}</span>
      </div>`).join('')||'<div style="font-size:11px;color:#aaa">Nenhuma ativa.</div>'}
    </div>`;
  }
  html+=`<div class="bv-section"><div class="bv-title">Fechamentos e negativas — 45 dias</div>
    ${rec45.slice(0,6).map(o=>`<div class="bv-item">
      <span>${escHtml(o._cliente?.nome||'—')} <span class="badge ${isFechada(o)?'b-vd':'b-tc'}" style="font-size:7px">${stageLabel(o.pipeline_stage)}</span></span>
      <span style="font-family:var(--font-mono);color:${isFechada(o)?'var(--verde)':'var(--terracota)'}">${fmt(isFechada(o)?oppValorFechado(o):oppValorProposto(o))}</span>
    </div>`).join('')||'<div style="font-size:11px;color:#aaa">Nenhum no período.</div>'}
    <div class="bv-item" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--cinza2)">
      <span style="font-weight:600">Total fechado</span>
      <span style="font-family:var(--font-mono);font-weight:700;color:var(--verde)">${fmt(vF45)}</span>
    </div>
  </div>`;
  document.getElementById('bv-body').innerHTML=html;
  openM('modal-bv');
}

// ═══ NAV ════════════════════════════════════════════
function goTab(id, btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.crm-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='pipe')renderPipe();
  if(id==='orc')renderOrc();
  if(id==='contatos')renderContatos();
  if(id==='fechamentos')renderFechamentos();
  if(id==='negativas')renderNegativas();
  if(id==='alcance')renderAlcance();
  if(id==='relatorios')renderRelatorios();
}

// ═══════════════════════════════════════════════════
// NOVA / EDITAR OPORTUNIDADE — autocomplete cliente
// ═══════════════════════════════════════════════════

async function abrirNovaOpp(){
  if(currentUser?.viewer_only){toast('Sem permissão para criar.');return;}
  document.getElementById('opp-id').value='';
  document.getElementById('opp-cliente-id').value='';
  document.getElementById('opp-cliente-text').value='';
  document.getElementById('opp-cliente-selecionado').style.display='none';
  document.getElementById('opp-cliente-dropdown').style.display='none';
  document.getElementById('opp-modal-title').textContent='Nova Oportunidade';
  document.getElementById('opp-projeto').value='';
  document.getElementById('opp-cidade').value='';
  document.getElementById('opp-uf').value='';
  document.getElementById('opp-obs').value='';
  document.getElementById('opp-rc-nome').value='';
  document.getElementById('opp-rc-tel').value='';
  document.getElementById('opp-rc-email').value='';
  document.getElementById('opp-indicou').value='';
  document.getElementById('opp-evento').value='';
  document.getElementById('opp-data-entrada').value=new Date().toISOString().slice(0,10);
  document.getElementById('opp-stage').value='prospecção';
  document.getElementById('opp-origem').value='Captação';
  document.getElementById('opp-num-legado-wrap').style.display='none';
  document.getElementById('opp-num-legado').value='';
  document.getElementById('opp-indicou-wrap').style.display='none';
  document.getElementById('opp-evento-wrap').style.display='none';
  document.getElementById('opp-novo-cliente-wrap').style.display='none';
  document.getElementById('opp-destaque').checked=false;
  // Rebusca propostas frescas do Supabase antes de popular o dropdown
  await recarregarProposals();
  populateCalcDropdown('');
  if(currentUser?.id){
    const sel=document.getElementById('opp-resp');
    for(let opt of sel.options){if(opt.value===currentUser.id){opt.selected=true;break;}}
  }
  popularIndicouDatalist();
  openM('modal-opp');
}

function editarOpp(){
  const op=allOps.find(o=>o.id===detailOppId);
  if(!op)return;
  if(currentUser?.viewer_only){toast('Sem permissão para editar.');return;}
  document.getElementById('opp-id').value=op.id;
  document.getElementById('opp-modal-title').textContent='Editar Oportunidade';
  document.getElementById('opp-projeto').value=op.projeto||'';
  document.getElementById('opp-cidade').value=op.cidade||'';
  document.getElementById('opp-uf').value=op.uf||'';
  document.getElementById('opp-num-legado-wrap').style.display='grid';
  document.getElementById('opp-num-legado').value=op.num_legado||'';
  document.getElementById('opp-obs').value=op.obs||'';
  document.getElementById('opp-rc-nome').value=op.resp_cliente_nome||'';
  document.getElementById('opp-rc-tel').value=op.resp_cliente_tel||'';
  document.getElementById('opp-rc-email').value=op.resp_cliente_email||'';
  document.getElementById('opp-indicou').value=op.indicou||'';
  document.getElementById('opp-evento').value='';
  document.getElementById('opp-data-entrada').value=op.data_entrada||'';
  document.getElementById('opp-destaque').checked=!!op.destaque;
  populateCalcDropdown(op.proposta_calc_id||'');
  document.getElementById('opp-stage').value=op.pipeline_stage||'prospecção';
  document.getElementById('opp-novo-cliente-wrap').style.display='none';
  document.getElementById('opp-cliente-id').value=op.cliente_id||'';
  const cli=allClients.find(c=>c.id===op.cliente_id);
  document.getElementById('opp-cliente-text').value=cli?.nome||'';
  document.getElementById('opp-cliente-dropdown').style.display='none';
  if(cli){
    const sd=document.getElementById('opp-cliente-selecionado');
    sd.textContent='✓ '+cli.nome; sd.style.display='block';
  }else{
    document.getElementById('opp-cliente-selecionado').style.display='none';
  }
  const respSel=document.getElementById('opp-resp');
  for(let opt of respSel.options){if(opt.value===op.resp_id){opt.selected=true;break;}}
  const origSel=document.getElementById('opp-origem');
  let foundOrig=false;
  for(let opt of origSel.options){if(opt.value===op.origem){opt.selected=true;foundOrig=true;break;}}
  if(!foundOrig&&op.origem)origSel.value='Outro';
  onOrigemChange();
  if(op.origem==='Evento')document.getElementById('opp-evento').value=op.indicou||'';
  popularIndicouDatalist();
  closeM('modal-detail');
  openM('modal-opp');
}

// Autocomplete de cliente
function filtrarClientes(){
  const q=document.getElementById('opp-cliente-text').value.trim().toLowerCase();
  document.getElementById('opp-cliente-id').value='';
  document.getElementById('opp-cliente-selecionado').style.display='none';
  const dd=document.getElementById('opp-cliente-dropdown');
  if(!q){dd.style.display='none';return;}
  const matches=allClients.filter(c=>(c.nome||'').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){
    dd.innerHTML=`<div style="padding:8px 10px;font-size:11px;color:#aaa">Nenhum cliente encontrado.</div>
      <div style="padding:6px 10px;border-top:1px solid var(--cinza2);cursor:pointer;font-size:11px;color:var(--verde);font-weight:600" onmousedown="mostrarFormNovoCliente()">+ Criar novo cliente</div>`;
  } else {
    dd.innerHTML=matches.map(c=>`<div style="padding:7px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--cinza2)" onmousedown="selecionarCliente('${escJsStr(c.id)}','${escJsStr(c.nome)}')">${escHtml(c.nome)}</div>`).join('')+
      `<div style="padding:6px 10px;border-top:1px solid var(--cinza2);cursor:pointer;font-size:11px;color:var(--verde);font-weight:600" onmousedown="mostrarFormNovoCliente()">+ Criar novo cliente</div>`;
  }
  dd.style.display='block';
}

function selecionarCliente(id,nome){
  document.getElementById('opp-cliente-id').value=id;
  document.getElementById('opp-cliente-text').value=nome;
  document.getElementById('opp-cliente-dropdown').style.display='none';
  const sd=document.getElementById('opp-cliente-selecionado');
  sd.textContent='✓ '+nome; sd.style.display='block';
}

function mostrarFormNovoCliente(){
  document.getElementById('opp-cliente-dropdown').style.display='none';
  document.getElementById('nc-nome').value=document.getElementById('opp-cliente-text').value;
  document.getElementById('nc-cidade').value='';
  document.getElementById('nc-uf').value='';
  document.getElementById('nc-obs').value='';
  document.getElementById('opp-novo-cliente-wrap').style.display='block';
}

function cancelarNovoCliente(){
  document.getElementById('opp-novo-cliente-wrap').style.display='none';
  document.getElementById('nc-nome').value='';
}

function onClienteChange(){}

function onOrigemChange(){
  const v=document.getElementById('opp-origem').value;
  const isIndic=v.startsWith('Indicação');
  const isEvento=v==='Evento';
  document.getElementById('opp-indicou-wrap').style.display=isIndic?'block':'none';
  document.getElementById('opp-evento-wrap').style.display=isEvento?'block':'none';
  if(isIndic){
    document.getElementById('opp-indicou-label').textContent=v==='Indicação de sócio'?'Nome do sócio':'Quem indicou';
  }
}

function popularIndicouDatalist(){
  const nomes=[...new Set(allOps.map(o=>o.indicou).filter(Boolean))].sort();
  document.getElementById('indicou-list').innerHTML=nomes.map(n=>`<option value="${escAttr(n)}">`).join('');
}

async function criarNovoClienteInline(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const nome=document.getElementById('nc-nome').value.trim();
  if(!nome){toast('Nome do cliente é obrigatório.');return;}
  const payload={
    nome,
    sigla:document.getElementById('nc-sigla').value.trim().toUpperCase()||null,
    tipo:document.getElementById('nc-tipo').value||null,
    cidade:document.getElementById('nc-cidade').value.trim()||null,
    uf:document.getElementById('nc-uf').value||null,
    obs:document.getElementById('nc-obs').value.trim()||null,
  };
  const {data,error}=await sb.from('clientes').insert(payload).select().maybeSingle();
  if(error){toast('Erro ao criar cliente: '+error.message);return;}
  allClients.push(data);
  allClients.sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  selecionarCliente(data.id,data.nome);
  document.getElementById('opp-novo-cliente-wrap').style.display='none';
  toast('Cliente criado!');
}

// Gerar número sequencial 26O0001
async function gerarNumLegado(){
  const ano=String(new Date().getFullYear()).slice(-2);
  const prefix=`${ano}O`;
  const {data}=await sb.from('oportunidades').select('num_legado').ilike('num_legado',`${prefix}%`).order('num_legado',{ascending:false}).limit(1);
  let seq=1;
  if(data&&data.length){
    const last=data[0].num_legado||'';
    const n=parseInt(last.replace(prefix,''))||0;
    seq=n+1;
  }
  return`${prefix}${String(seq).padStart(4,'0')}`;
}

async function salvarOpp(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const id=document.getElementById('opp-id').value;
  const clienteId=document.getElementById('opp-cliente-id').value;
  if(!clienteId){toast('Selecione ou crie um cliente.');return;}

  const origem=document.getElementById('opp-origem').value;
  const isIndic=origem.startsWith('Indicação');
  const isEvento=origem==='Evento';
  let indicou=null;
  if(isIndic)indicou=document.getElementById('opp-indicou').value.trim()||null;
  if(isEvento)indicou=document.getElementById('opp-evento').value.trim()||null;

  // C6: validação de num_legado ao editar
  const numLegadoNovo = id ? document.getElementById('opp-num-legado').value.trim().toUpperCase() || null : null;
  if(id && numLegadoNovo){
    const {data:dup}=await sb.from('oportunidades').select('id').eq('num_legado',numLegadoNovo).neq('id',id).maybeSingle();
    if(dup){toast('Número legado já existe em outra oportunidade.');return;}
  }

  // COM-3: validação de vínculo único — uma proposta só pode estar ligada a uma oportunidade
  const calcIdSelecionado = document.getElementById('opp-calc-id').value.trim() || null;
  if (calcIdSelecionado) {
    const jaVinculada = allOps.find(o => o.proposta_calc_id === calcIdSelecionado && (!id || o.id !== id));
    if (jaVinculada) {
      toast(`Esta proposta já está vinculada à oportunidade ${jaVinculada.num_legado || '#'+jaVinculada.id}. Cada proposta pode ser vinculada a apenas uma oportunidade.`);
      return;
    }
  }

  const payload={
    cliente_id:clienteId,
    projeto:document.getElementById('opp-projeto').value.trim()||null,
    cidade:document.getElementById('opp-cidade').value.trim()||null,
    uf:document.getElementById('opp-uf').value||null,
    resp_id:document.getElementById('opp-resp').value,
    pipeline_stage:document.getElementById('opp-stage').value,
    origem,
    indicou,
    data_entrada:document.getElementById('opp-data-entrada').value||null,
    obs:document.getElementById('opp-obs').value.trim()||null,
    resp_cliente_nome:document.getElementById('opp-rc-nome').value.trim()||null,
    resp_cliente_tel:document.getElementById('opp-rc-tel').value.trim()||null,
    resp_cliente_email:document.getElementById('opp-rc-email').value.trim()||null,
    destaque:document.getElementById('opp-destaque').checked,
    proposta_calc_id:document.getElementById('opp-calc-id').value.trim()||null,
    updated_at:new Date().toISOString(),
  };
  if(id && numLegadoNovo) payload.num_legado=numLegadoNovo;

  let error, data;
  if(id){
    ({data,error}=await sb.from('oportunidades').update(payload).eq('id',id).select().maybeSingle());
  } else {
    payload.num_legado=await gerarNumLegado();
    ({data,error}=await sb.from('oportunidades').insert(payload).select().maybeSingle());
  }
  if(error){toast('Erro: '+error.message);return;}
  toast(id?'Oportunidade atualizada!':'Oportunidade criada! Nº '+(payload.num_legado||''));
  closeM('modal-opp');
  await carregarDados();
  renderDash();renderPipe();renderOrc();renderContatos();calcAlertas();
  if(data?.id)abrirDetail(data.id);
}

// ═══════════════════════════════════════════════════
// NOVO / EDITAR PRODUTO
// ═══════════════════════════════════════════════════

const SUBTIPOS_POR_NUCLEO={
  PAIS:['PAIS_TERREO','PAIS_CONDO','PAIS_FLOREIRA','PAIS_STREET','PAIS_ARB','PAIS_PARQUE','PAIS_PARQUE_BAIXO','PAIS_PF'],
  URB:['URB_CONCEITO','URB_VIAB','URB_MASTER','URB_PROJETO','URB_DESM','URB_IMG','URB_CHARRETE'],
  CONSUL:['CONSUL_HORA','CONSUL_MENSAL'],
  ESP:['ESP_LIVRE'],
};

function updateSubtipos(selectedVal){
  const nucleo=document.getElementById('prod-nucleo').value;
  const sel=document.getElementById('prod-subtipo');
  const subs=SUBTIPOS_POR_NUCLEO[nucleo]||[];
  sel.innerHTML=subs.map(s=>`<option value="${escAttr(s)}"${s===selectedVal?' selected':''}>${escHtml(SUBTIPO_LABEL[s]||s)}</option>`).join('');
}

function abrirNovoProd(oppId){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  document.getElementById('prod-id').value='';
  document.getElementById('prod-opp-id').value=oppId;
  document.getElementById('prod-modal-title').textContent='Novo Produto';
  document.getElementById('prod-nucleo').value='PAIS';
  updateSubtipos();
  document.getElementById('prod-valor').value='';
  document.getElementById('prod-area').value='';
  document.getElementById('prod-status').value='ativo';
  document.getElementById('prod-prob').value='3';
  document.getElementById('prod-data-envio').value='';
  document.getElementById('prod-data-prev').value='';
  document.getElementById('prod-obs').value='';
  // Fecha detail, abre prod; ao salvar volta ao detail
  closeM('modal-detail');
  openM('modal-prod');
}

function editarProd(prodId){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const p=allProds.find(x=>x.id===prodId);
  if(!p)return;
  document.getElementById('prod-id').value=p.id;
  document.getElementById('prod-opp-id').value=p.oportunidade_id;
  document.getElementById('prod-modal-title').textContent='Editar Produto';
  document.getElementById('prod-nucleo').value=p.nucleo||'PAIS';
  updateSubtipos(p.subtipo);
  document.getElementById('prod-valor').value=p.valor_proposto||'';
  document.getElementById('prod-area').value=p.area||'';
  document.getElementById('prod-status').value=p.status||'ativo';
  document.getElementById('prod-prob').value=p.prob||'3';
  document.getElementById('prod-data-envio').value=p.data_envio||'';
  document.getElementById('prod-data-prev').value=p.data_previsao||'';
  document.getElementById('prod-obs').value=p.obs||'';
  closeM('modal-detail');
  openM('modal-prod');
}

async function salvarProd(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const id=document.getElementById('prod-id').value;
  const oppId=document.getElementById('prod-opp-id').value;
  const payload={
    oportunidade_id:oppId,
    nucleo:document.getElementById('prod-nucleo').value,
    subtipo:document.getElementById('prod-subtipo').value,
    valor_proposto:parseFloat(document.getElementById('prod-valor').value)||null,
    area:parseFloat(document.getElementById('prod-area').value)||null,
    status:document.getElementById('prod-status').value,
    prob:parseInt(document.getElementById('prod-prob').value)||null,
    data_envio:document.getElementById('prod-data-envio').value||null,
    data_previsao:document.getElementById('prod-data-prev').value||null,
    obs:document.getElementById('prod-obs').value.trim()||null,
    updated_at:new Date().toISOString(),
  };
  let error;
  if(id){({error}=await sb.from('produtos').update(payload).eq('id',id));}
  else{
    ({error}=await sb.from('produtos').insert(payload));
    if(!error){
      // C8: ao adicionar produto, opp passa para "Orçamento ativo"
      const op=allOps.find(o=>o.id===oppId);
      if(op&&['prospecção','prospeccao'].includes((op.pipeline_stage||'').toLowerCase())){
        await sb.from('oportunidades').update({pipeline_stage:'enviada',updated_at:new Date().toISOString()}).eq('id',oppId);
      }
    }
  }
  if(error){toast('Erro: '+error.message);return;}
  toast(id?'Produto atualizado!':'Produto criado!');
  closeM('modal-prod');
  await carregarDados();
  renderDash();renderPipe();renderOrc();calcAlertas();
  abrirDetail(oppId);
}

// ═══════════════════════════════════════════════════
// AÇÕES DE ESTÁGIO / PRODUTO
// ═══════════════════════════════════════════════════

let _acaoTipo=null,_acaoOppId=null,_acaoProdId=null;

function abrirAcaoOpp(tipo){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  _acaoTipo=tipo;_acaoOppId=detailOppId;_acaoProdId=null;
  const titles={prospeccao:'← Voltar para Prospecção',enviada:'Marcar como Orçamento ativo',negociacao:'Mover para Negociação',negada:'Registrar Negativa'};
  document.getElementById('acao-title').textContent=titles[tipo]||'Confirmar';
  let html='';
  if(tipo==='negada'){
    html=`<div class="fgroup mb8"><label>Motivo da negativa *</label><textarea id="acao-motivo" style="min-height:60px" placeholder="Descreva o motivo..."></textarea></div>
    <div class="fgroup"><label>Probabilidade de retorno</label><select id="acao-prob-retorno"><option value="">—</option><option>Alta</option><option>Média</option><option>Baixa</option><option>Nenhuma</option></select></div>`;
    document.getElementById('acao-confirm-btn').className='btn tc';
  } else {
    html=`<p style="font-size:12px;color:#555;padding:4px 0">Confirmar mudança de estágio para <strong>${titles[tipo]}</strong>?</p>`;
    document.getElementById('acao-confirm-btn').className='btn verde';
  }
  document.getElementById('acao-body').innerHTML=html;
  openM('modal-acao');
}

function abrirAcaoProd(prodId,tipo){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  _acaoTipo='prod_'+tipo;_acaoProdId=prodId;_acaoOppId=detailOppId;
  const p=allProds.find(x=>x.id===prodId);
  const label=SUBTIPO_LABEL[p?.subtipo]||p?.subtipo||'Produto';
  if(tipo==='negociacao'){
    document.getElementById('acao-title').textContent='Mover para Negociação — '+label;
    document.getElementById('acao-body').innerHTML=`<p style="font-size:12px;color:#555;padding:4px 0">Confirmar mudança de estágio para <strong>Em negociação</strong>?</p>`;
    document.getElementById('acao-confirm-btn').className='btn verde';
  } else if(tipo==='fechado'){
    document.getElementById('acao-title').textContent='Fechar — '+label;
    document.getElementById('acao-body').innerHTML=`
      <div class="fg fg2 mb8">
        <div class="fgroup"><label>Valor fechado (R$) *</label><input type="number" id="acao-vf" step="100" min="0" value="${escAttr(p?.valor_proposto||'')}"></div>
        <div class="fgroup"><label>Data de fechamento *</label><input type="date" id="acao-df" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>`;
    document.getElementById('acao-confirm-btn').className='btn verde';
  } else if(tipo==='cancelado'){
    document.getElementById('acao-title').textContent='Cancelar — '+label;
    document.getElementById('acao-body').innerHTML=`
      <div class="fgroup mb8"><label>Motivo do cancelamento</label><textarea id="acao-cn" style="min-height:50px" placeholder="Opcional..."></textarea></div>`;
    document.getElementById('acao-confirm-btn').className='btn tc';
  } else {
    document.getElementById('acao-title').textContent='Negar — '+label;
    document.getElementById('acao-body').innerHTML=`
      <div class="fgroup mb8"><label>Categoria da negativa</label>
        <select id="acao-cat">
          <option value="">— Selecionar —</option>
          <option value="Preço / Honorários">Preço / Honorários altos</option>
          <option value="Concorrência">Concorrência (menor preço)</option>
          <option value="Prazo / Cronograma">Prazo ou cronograma</option>
          <option value="Decisão interna">Decisão interna (desistência)</option>
          <option value="Budget cancelado">Budget cancelado</option>
          <option value="Sem retorno">Inatividade / sem retorno</option>
          <option value="Escopo">Mudança de escopo</option>
          <option value="Outro">Outro</option>
        </select>
      </div>
      <div class="fgroup mb8"><label>Observação (opcional)</label><textarea id="acao-mn" style="min-height:50px" placeholder="Detalhes adicionais..."></textarea></div>
      <div class="fgroup"><label>Prob. de retorno</label><select id="acao-pr"><option value="">—</option><option>Alta</option><option>Média</option><option>Baixa</option><option>Nenhuma</option></select></div>`;
    document.getElementById('acao-confirm-btn').className='btn tc';
  }
  openM('modal-acao');
}

// C4: deriva estágio da opp a partir dos produtos após cada ação
async function autoUpdateOppStage(oppId){
  const {data:prods, error:pErr}=await sb.from('produtos').select('status').eq('oportunidade_id',oppId);
  if(pErr){ console.error('autoUpdateOppStage:', pErr.message); return; }
  if(!prods||!prods.length)return;
  const st=prods.map(p=>(p.status||'').toLowerCase());
  let newStage;
  if(st.some(s=>s==='fechado'))newStage='fechada';
  else if(st.every(s=>['negado','cancelado'].includes(s)))newStage='negada';
  else if(st.some(s=>s==='negociacao'||s==='negociação'))newStage='negociacao';
  else newStage='enviada';
  await sb.from('oportunidades').update({pipeline_stage:newStage,updated_at:new Date().toISOString()}).eq('id',oppId);
}

async function confirmarAcao(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  if(_acaoTipo==='prod_negociacao'){
    const {error}=await sb.from('produtos').update({status:'negociacao',updated_at:new Date().toISOString()}).eq('id',_acaoProdId);
    if(error){toast('Erro: '+error.message);return;}
    await autoUpdateOppStage(_acaoOppId);
    toast('Produto em negociação!');
  } else if(_acaoTipo==='prod_fechado'){
    const vf=parseFloat(document.getElementById('acao-vf')?.value)||null;
    const df=document.getElementById('acao-df')?.value||null;
    if(!vf){toast('Informe o valor fechado.');return;}
    const {error}=await sb.from('produtos').update({status:'fechado',valor_fechado:vf,data_fechamento:df,updated_at:new Date().toISOString()}).eq('id',_acaoProdId);
    if(error){toast('Erro: '+error.message);return;}
    await autoUpdateOppStage(_acaoOppId);
    toast('Produto fechado!');
    // C13: verifica subcontratações vinculadas à proposta calc
    verificarSubsAposFechamento(_acaoOppId, 'fechado');
  } else if(_acaoTipo==='prod_negado'){
    const mn=document.getElementById('acao-mn')?.value.trim()||null;
    const mc=document.getElementById('acao-cat')?.value||null;
    if(!mc&&!mn){toast('Selecione uma categoria ou informe o motivo.');return;}
    const pr=document.getElementById('acao-pr')?.value||null;
    const {error}=await sb.from('produtos').update({status:'negado',motivo_negativa:mn,motivo_categoria:mc,prob_retorno:pr,updated_at:new Date().toISOString()}).eq('id',_acaoProdId);
    if(error){toast('Erro: '+error.message);return;}
    await autoUpdateOppStage(_acaoOppId);
    toast('Produto marcado como negado.');
    // C13: subs caem automaticamente quando produto é negado
    verificarSubsAposFechamento(_acaoOppId, 'negado');
  } else if(_acaoTipo==='prod_cancelado'){
    const cn=document.getElementById('acao-cn')?.value.trim()||null;
    const {error}=await sb.from('produtos').update({status:'cancelado',cancel_note:cn,updated_at:new Date().toISOString()}).eq('id',_acaoProdId);
    if(error){toast('Erro: '+error.message);return;}
    await autoUpdateOppStage(_acaoOppId);
    toast('Produto cancelado.');
  } else {
    // ação no nível da oportunidade (apenas 'enviada' restante)
    const {error}=await sb.from('oportunidades').update({pipeline_stage:_acaoTipo,updated_at:new Date().toISOString()}).eq('id',_acaoOppId);
    if(error){toast('Erro: '+error.message);return;}
    toast('Oportunidade atualizada!');
  }
  closeM('modal-acao');
  await carregarDados();
  renderDash();renderPipe();renderOrc();calcAlertas();
  abrirDetail(_acaoOppId);
}

// ═══════════════════════════════════════════════════
// C13 — APROVAÇÃO DE SUBCONTRATAÇÕES
// ═══════════════════════════════════════════════════
let _subsParaAprovacao = [];   // cópia das subs com campo status_aprov
let _subsProposalId    = null; // proposal_id do exp_proposals a atualizar

async function verificarSubsAposFechamento(oppId, acao) {
  const op = allOps.find(o=>o.id===oppId);
  if (!op?.proposta_calc_id) return;
  try {
    const {data, error} = await sb.from('exp_proposals')
      .select('proposal_id, subs')
      .eq('proposal_id', op.proposta_calc_id)
      .maybeSingle();
    if (error || !data) return;
    const subs = data.subs || [];
    if (!subs.length) return;

    if (acao === 'negado') {
      // Produto negado → todas as subs caem automaticamente
      const updated = subs.map(s=>({...s, status_aprov:'negada'}));
      await sb.from('exp_proposals')
        .update({ subs: updated, updated_at: new Date().toISOString() })
        .eq('proposal_id', op.proposta_calc_id);
      toast('Subcontratações marcadas como negadas automaticamente.');
      return;
    }

    // Produto fechado → abre modal para aprovação manual
    _subsProposalId = op.proposta_calc_id;
    _subsParaAprovacao = subs.map(s=>({
      ...s,
      status_aprov: s.status_aprov || 'pendente'
    }));
    renderSubAprovacao();
    openM('modal-subs-aprov');
  } catch(e) {}
}

function renderSubAprovacao() {
  const el = document.getElementById('subs-aprov-list');
  if (!_subsParaAprovacao.length) { el.innerHTML='<div style="color:#aaa;font-size:11px">Nenhuma subcontratação.</div>'; return; }
  el.innerHTML = _subsParaAprovacao.map((s,i)=>{
    const st = s.status_aprov || 'pendente';
    const cor = st==='aprovada'?'var(--verde)':st==='negada'?'var(--terracota)':'#999';
    return `<div style="border:1px solid var(--cinza2);padding:9px 12px;margin-bottom:7px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:12px">${s.serv||'—'}</div>
          <div style="font-size:10px;color:#888">${s.emp||''}${s.data?' · '+s.data:''}</div>
        </div>
        <div style="font-family:var(--font-mono);font-weight:700;font-size:13px">${fmt(s.valComBit||0)}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center">
        <span style="font-size:9px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.5px;margin-right:4px">${st}</span>
        <button class="btn xs ${st==='aprovada'?'verde':'ghost'}" onclick="_subsParaAprovacao[${i}].status_aprov='aprovada';renderSubAprovacao()">✓ Aprovar</button>
        <button class="btn xs ${st==='negada'?'tc':'ghost'}" onclick="_subsParaAprovacao[${i}].status_aprov='negada';renderSubAprovacao()">✗ Negar</button>
      </div>
    </div>`;
  }).join('');
}

async function finalizarAprovacaoSubs() {
  if (!_subsProposalId) return;
  const {error} = await sb.from('exp_proposals')
    .update({ subs: _subsParaAprovacao, updated_at: new Date().toISOString() })
    .eq('proposal_id', _subsProposalId);
  if (error) { toast('Erro ao salvar: ' + error.message); return; }
  toast('Decisões sobre subcontratações registradas!');
  closeM('modal-subs-aprov');
  _subsParaAprovacao = []; _subsProposalId = null;
}

// ═══════════════════════════════════════════════════
// FASE 5 — FECHAMENTO UNIFICADO DE OPORTUNIDADE
// ═══════════════════════════════════════════════════

let _fechOppId = null;          // opp em processo de fechamento
let _fechCustos = [];           // opp_custos carregados para o fechamento

async function abrirFechamento(oppId) {
  if (currentUser?.viewer_only) { toast('Sem permissão.'); return; }
  let op = allOps.find(o => o.id === oppId);
  if (!op) return;
  if (!op._produtos.length && op._proposal?.items?.length) {
    op = await garantirProdutosCalcMaterializados(oppId, 'fechamento');
    if (!op) return;
  }
  _fechOppId = oppId;

  document.getElementById('fech-opp-title').textContent =
    `Fechar oportunidade — ${op.projeto || op._cliente?.nome || oppId}`;
  document.getElementById('fech-data').value = new Date().toISOString().slice(0, 10);

  // Carrega opp_custos desta oportunidade (subs/desps/repasse)
  const { data: custos, error: cErr } = await sb.from('opp_custos')
    .select('*')
    .eq('oportunidade_id', oppId)
    .order('tipo');
  if (cErr) console.warn('abrirFechamento custos:', cErr.message);
  _fechCustos = custos || [];

  // Renderiza os itens
  _renderFechItens(op);
  openM('modal-fechar-opp');
}

function _renderFechItens(op) {
  const wrap = document.getElementById('fech-itens-wrap');
  if (!wrap) return;
  let html = '';

  // ── Serviços via vínculo direto calc (sem produtos no DB) ──
  const _calcFechItens = !op._produtos.length && op._proposal?.items?.length
    ? op._proposal.items : null;
  if (_calcFechItens) {
    const totalProp = _calcFechItens.reduce((s,it)=>s+(it.valorProposto!=null?+it.valorProposto:(+it.valorCalc||0)),0);
    html += `<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-bottom:8px">Serviços (EXP.calc)</div>`;
    _calcFechItens.forEach(it => {
      const label = it.subLabel || SUBTIPO_LABEL?.[it.subK] || it.subK || 'Serviço';
      const val = it.valorProposto != null ? +it.valorProposto : (+it.valorCalc || 0);
      html += `<div style="border:1px solid var(--cinza2);padding:8px 10px;margin-bottom:6px;border-radius:3px;display:flex;align-items:center;gap:8px">
        ${tipoBadgeProd(it.nucleo || 'PAIS')}
        <span style="font-size:12px;font-weight:500;flex:1">${label}</span>
        <span style="font-size:11px;color:#888">Proposta: <strong>${fmt(val)}</strong></span>
      </div>`;
    });
    html += `<div style="border-top:1px solid var(--cinza2);margin-top:8px;padding-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:12px;color:#888">Total proposta: <strong>${fmt(totalProp)}</strong></span>
      <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
        <label style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#555;white-space:nowrap">Valor fechado (R$)</label>
        <input type="number" id="fch-vf-total" value="${escAttr(totalProp)}" min="0" step="100"
          style="font-size:12px;font-family:var(--font-mono);border:1px solid var(--azul);padding:4px 8px;width:140px;border-radius:4px;font-weight:700">
      </div>
    </div>`;
  }

  // ── Serviços (produtos DB) ──
  if (op._produtos.length) {
    html += `<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-bottom:8px">Serviços</div>`;
    op._produtos.forEach(p => {
      const label = SUBTIPO_LABEL[p.subtipo] || p.subtipo || 'Serviço';
      const valRef = p.valor_proposto || p.valor_calculado || 0;
      const isFech = p.status === 'fechado';
      const valFch = p.valor_fechado || valRef;
      const incl   = p.incluso_fechamento !== false;
      html += `<div class="fech-row" id="frow-p-${p.id}" onclick="_fechToggleCheckbox('p','${escJsStr(p.id)}',event)" style="border:1px solid var(--cinza2);padding:8px 10px;margin-bottom:6px;border-radius:3px;cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="checkbox" id="fch-incl-p-${p.id}" ${incl?'checked':''} onchange="_fechToggleRow('p','${escJsStr(p.id)}',this.checked)"
            style="width:15px;height:15px;cursor:pointer" title="Incluir no fechamento">
          ${tipoBadgeProd(p.nucleo)}
          <span style="font-size:12px;font-weight:500;flex:1">${escHtml(label)}</span>
          ${isFech ? `<span class="badge b-vd" style="font-size:9px">já fechado</span>` : ''}
          <span style="font-size:11px;color:#888">Proposta: <strong>${fmt(valRef)}</strong></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="frow-p-${p.id}-fields">
          <div class="fgroup" style="flex:1;min-width:120px;margin:0">
            <label style="font-size:9px">Valor fechado (R$)</label>
            <input type="number" id="fch-vf-p-${p.id}" value="${escAttr(valFch)}" min="0" step="100"
              style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;width:100%;font-family:var(--font-mono)">
          </div>
          <div class="fgroup" style="flex:2;min-width:160px;margin:0">
            <label style="font-size:9px">Observação (opcional)</label>
            <input type="text" id="fch-obs-p-${p.id}" value="${escAttr(p.obs||'')}"
              placeholder="Ex: desconto negociado, parcela 1..."
              style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;width:100%">
          </div>
        </div>
      </div>`;
    });
  }

  // ── Custos (opp_custos: subs, desps, repasse) ──
  const TIPO_LABEL = { subcontratacao: 'Subcontratação', despesa_indireta: 'Despesa', repasse: 'Repasse' };
  if (_fechCustos.length) {
    html += `<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin:12px 0 8px">Custos (subs / despesas / repasse)</div>`;
    _fechCustos.forEach(c => {
      const tipoLabel = TIPO_LABEL[c.tipo] || c.tipo;
      const valRef  = c.valor_calculado || 0;
      const valFch  = c.valor_fechado || valRef;
      const incl    = c.incluso_fechamento !== false;
      html += `<div class="fech-row" id="frow-c-${c.id}" onclick="_fechToggleCheckbox('c','${escJsStr(c.id)}',event)" style="border:1px solid var(--cinza2);padding:8px 10px;margin-bottom:6px;border-radius:3px;border-left:3px solid #ddd;cursor:pointer">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="checkbox" id="fch-incl-c-${c.id}" ${incl?'checked':''} onchange="_fechToggleRow('c','${escJsStr(c.id)}',this.checked)"
            style="width:15px;height:15px;cursor:pointer" title="Incluir no fechamento">
          <span style="font-size:9px;background:#f0f0f0;padding:1px 6px;border-radius:3px;color:#666;font-weight:600">${escHtml(tipoLabel)}</span>
          <span style="font-size:12px;font-weight:500;flex:1">${escHtml(c.descricao||'—')}</span>
          <span style="font-size:11px;color:#888">Calculado: <strong>${fmt(valRef)}</strong></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="frow-c-${c.id}-fields">
          <div class="fgroup" style="flex:1;min-width:120px;margin:0">
            <label style="font-size:9px">Valor fechado (R$)</label>
            <input type="number" id="fch-vf-c-${c.id}" value="${valFch}" min="0" step="100"
              style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;width:100%;font-family:var(--font-mono)">
          </div>
          <div class="fgroup" style="flex:2;min-width:160px;margin:0">
            <label style="font-size:9px">Observação (opcional)</label>
            <input type="text" id="fch-obs-c-${c.id}" value="${escAttr(c.obs_fechamento||'')}"
              placeholder="Ex: absorvida pelo cliente, cortada..."
              style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;width:100%">
          </div>
        </div>
      </div>`;
    });
  }

  if (!html) {
    html = `<div style="font-size:12px;color:#aaa;padding:20px 0;text-align:center">Nenhum item encontrado. Importe os dados da calculadora antes de fechar.</div>`;
  }

  wrap.innerHTML = html;
  // Aplica visual inicial para itens desmarcados
  op._produtos.forEach(p => { if (p.incluso_fechamento === false) _fechToggleRow('p', p.id, false); });
  _fechCustos.forEach(c => { if (c.incluso_fechamento === false) _fechToggleRow('c', c.id, false); });
}

// Atualiza visual da linha quando toggle incluso muda
function _fechToggleRow(tipo, id, checked) {
  const fields = document.getElementById(`frow-${tipo}-${id}-fields`);
  const row    = document.getElementById(`frow-${tipo}-${id}`);
  if (fields) fields.style.opacity = checked ? '1' : '0.35';
  if (row)    row.style.borderColor = checked ? 'var(--cinza2)' : '#f0b8b8';
}

function _fechToggleCheckbox(tipo, id, ev) {
  const tg = ev?.target;
  if (tg && ['INPUT','TEXTAREA','SELECT','BUTTON','LABEL','A'].includes(tg.tagName)) return;
  const cb = document.getElementById(`fch-incl-${tipo}-${id}`);
  if (!cb) return;
  cb.checked = !cb.checked;
  _fechToggleRow(tipo, id, cb.checked);
}

async function confirmarFechamento() {
  if (!_fechOppId) return;
  if (currentUser?.viewer_only) { toast('Sem permissão.'); return; }
  const op = allOps.find(o => o.id === _fechOppId);
  if (!op) return;

  const dataFech = document.getElementById('fech-data').value || new Date().toISOString().slice(0, 10);
  const erros = [];
  let algumFechado = false;
  const _produtosFechados = []; // coleta para integração financeira

  // ── Salva produtos ──
  for (const p of op._produtos) {
    const inclEl   = document.getElementById(`fch-incl-p-${p.id}`);
    const vfEl     = document.getElementById(`fch-vf-p-${p.id}`);
    const obsEl    = document.getElementById(`fch-obs-p-${p.id}`);
    if (!inclEl) continue;

    const incluso  = inclEl.checked;
    const vf       = parseFloat(vfEl?.value) || null;
    const obs      = obsEl?.value.trim() || null;

    if (incluso) {
      if (!vf) { erros.push(`Informe o valor fechado para "${SUBTIPO_LABEL[p.subtipo]||p.subtipo||'produto'}".`); continue; }
      const { error } = await sb.from('produtos').update({
        status:          'fechado',
        valor_fechado:   vf,
        data_fechamento: dataFech,
        obs:             obs || null,
        updated_at:      new Date().toISOString(),
      }).eq('id', p.id);
      if (error) erros.push('Erro ao salvar produto: ' + error.message);
      else { algumFechado = true; _produtosFechados.push({...p, valor_fechado: vf}); }
    } else {
      const { error } = await sb.from('produtos').update({
        status:          'negado',
        motivo_negativa: obs || 'Excluído do fechamento',
        updated_at:      new Date().toISOString(),
      }).eq('id', p.id);
      if (error) erros.push('Erro ao salvar produto: ' + error.message);
    }
  }

  // ── Salva opp_custos ──
  for (const c of _fechCustos) {
    const inclEl = document.getElementById(`fch-incl-c-${c.id}`);
    const vfEl   = document.getElementById(`fch-vf-c-${c.id}`);
    const obsEl  = document.getElementById(`fch-obs-c-${c.id}`);
    if (!inclEl) continue;

    const incluso = inclEl.checked;
    const vf      = parseFloat(vfEl?.value) || null;
    const obs     = obsEl?.value.trim() || null;

    const { error } = await sb.from('opp_custos').update({
      incluso_fechamento: incluso,
      valor_fechado:      incluso ? (vf || c.valor_calculado) : null,
      obs_fechamento:     obs,
      status:             incluso ? 'aprovada' : 'negada',
    }).eq('id', c.id);
    if (error) erros.push('Erro ao salvar custo: ' + error.message);
  }

  if (erros.length) { toast(erros[0]); return; }

  // Opp calc-vinculada sem produtos DB → salva valor e atualiza estágio
  if (op._proposal?.items?.length && !op._produtos.length) {
    const vfTotal = parseFloat(document.getElementById('fch-vf-total')?.value) || oppValorProposto(op);
    await sb.from('oportunidades').update({
      pipeline_stage: 'fechada',
      valor_fechado:  vfTotal,
      updated_at:     new Date().toISOString(),
    }).eq('id', _fechOppId);
    algumFechado = true;
  } else {
    await autoUpdateOppStage(_fechOppId);
  }

  // ── Integração com Financeiro ──
  let _finRascunhoCriado = false;
  if (algumFechado) {
    _finRascunhoCriado = await criarRascunhoFinanceiro(op, _produtosFechados, dataFech);
  }

  closeM('modal-fechar-opp');
  await carregarDados();
  renderDash(); renderPipe(); renderOrc(); calcAlertas();
  abrirDetail(_fechOppId);

  if (algumFechado) {
    const finMsg = _finRascunhoCriado
      ? ` · Rascunho criado em <a href="financeiro.html" style="color:#A78BFA">EXP.financeiro ↗</a>`
      : '';
    toast(`✓ Fechamento registrado em ${fmtD(dataFech)}!${finMsg}`, _finRascunhoCriado ? 5000 : 2800);
  } else {
    toast('Itens marcados como negados. Nenhum serviço fechado.');
  }
}

// ═══════════════════════════════════════════════════
// CRM → FINANCEIRO: cria rascunho ao fechar
// ═══════════════════════════════════════════════════
async function criarRascunhoFinanceiro(op, produtosFechados, dataFech) {
  try {
    const clienteNome = op._cliente?.nome
      || allClients.find(c => c.id === op.cliente_id)?.nome
      || 'Cliente';
    const _lp = op._proposal;
    const ativosIds = []; // {id, lp}

    // ── CASO 1: Proposta Calc vinculada (sem produtos individuais no DB) ──
    if (_lp?.items?.length && !op._produtos.length) {
      const vfTotal = parseFloat(document.getElementById('fch-vf-total')?.value) || +(_lp.total) || 0;
      // Núcleo principal = item de maior valor
      const primaryItem = _lp.items.slice().sort(
        (a, b) => (b.valorProposto || b.valorCalc || 0) - (a.valorProposto || a.valorCalc || 0)
      )[0];
      const propCode = _lp.prop_code ? `EXP-${String(_lp.prop_code).padStart(3, '0')}` : null;

      // Valor efetivo EXP = total cliente − repasse comercial − custo bruto de subcontratações
      const _repVal  = +(_lp.repasse?.valorRep) || 0;
      const _subsVal = (_lp.subs||[]).reduce((s,x) => s + (+(x.val)||0), 0);
      const _efetivo = (+(_lp.total)||0) - _repVal - _subsVal;

      const payload = {
        oportunidade_id:   op.id,
        cliente_id:        op.cliente_id || null,
        cliente_nome:      clienteNome,
        proposta_calc_id:  op.proposta_calc_id || null,
        prop_code:         propCode,
        nucleo:            primaryItem?.nucleo || null,
        descricao:         _lp.projeto || op.projeto || null,
        valor_total:       +(_lp.total) || vfTotal,
        valor_efetivo_exp: _efetivo > 0 ? _efetivo : null,
        valor_fechado_crm: vfTotal,
        data_contrato:     dataFech,
        situacao_financeira: 'rascunho',
        criado_por:        'crm',
        criado_por_id:     currentUser?.id || null,
      };
      const { data: ad, error: ae } = await sb.from('fin_ativos').insert(payload).select('id').single();
      if (ae) throw new Error(ae.message);
      ativosIds.push({ id: ad.id, lp: _lp });

    // ── CASO 2: Produtos individuais fechados ──
    } else if (produtosFechados.length) {
      for (const p of produtosFechados) {
        const descr = (SUBTIPO_LABEL?.[p.subtipo] || p.subtipo || 'Serviço')
          + (op.projeto ? ` — ${op.projeto}` : '');
        const payload = {
          produto_id:        p.id,
          oportunidade_id:   op.id,
          cliente_id:        op.cliente_id || null,
          cliente_nome:      clienteNome,
          proposta_calc_id:  op.proposta_calc_id || null,
          nucleo:            p.nucleo || null,
          descricao:         descr,
          valor_total:       p.valor_fechado,
          valor_fechado_crm: p.valor_fechado,
          data_contrato:     dataFech,
          situacao_financeira: 'rascunho',
          criado_por:        'crm',
          criado_por_id:     currentUser?.id || null,
        };
        const { data: ad, error: ae } = await sb.from('fin_ativos').insert(payload).select('id').single();
        if (ae) throw new Error(ae.message);
        ativosIds.push({ id: ad.id, lp: null });
      }
    }

    if (!ativosIds.length) return false;

    // ── Subcontratações e Repasse (apenas para ativos com proposta Calc) ──
    for (const { id: ativoId, lp } of ativosIds) {
      if (!lp) continue;

      // Subcontratações
      if (lp.subs?.length) {
        const subsPayload = lp.subs.map(s => {
          const valComBit = (+(s.val)||0) * (1 + (+(s.bit)||0) / 100);
          const ganhoExp  = valComBit * ((+(s.ret)||0) / 100);
          return {
            ativo_id:              ativoId,
            servico:               s.serv || 'Serviço',
            empresa:               s.emp  || null,
            custo_cotado:          +(s.val) || 0,
            bitributacao_pct:      +(s.bit) || 0,
            valor_cobrado_cliente: valComBit,
            retorno_exp_pct:       +(s.ret) || 0,
            ganho_exp:             ganhoExp,
          };
        });
        await sb.from('fin_subcontratacoes').insert(subsPayload);
      }

      // Repasse comercial
      const rep = lp.repasse;
      if (rep && (rep.nome || rep.valorRep)) {
        await sb.from('fin_repasses').insert({
          ativo_id:          ativoId,
          beneficiario_nome: rep.nome || 'Repasse',
          tipo:              rep.tipo === 'pct' ? 'percentual' : 'fixo',
          percentual:        rep.tipo === 'pct' ? +(rep.val) : null,
          valor:             +(rep.valorRep) || null,
          origem:            'calc',
          prop_code:         lp.prop_code ? `EXP-${String(lp.prop_code).padStart(3,'0')}` : null,
        });
      }
    }

    return true;
  } catch (e) {
    console.error('[EXP.fin] criarRascunhoFinanceiro:', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════
// CONTATOS — cadastrar contato
// ═══════════════════════════════════════════════════

function abrirNovoContato(clienteId){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  document.getElementById('contato-cliente-id').value=clienteId;
  document.getElementById('contato-nome').value='';
  document.getElementById('contato-cargo').value='';
  document.getElementById('contato-tel').value='';
  document.getElementById('contato-email').value='';
  const cli=allClients.find(c=>c.id===clienteId);
  document.getElementById('contato-modal-title').textContent=`Novo contato — ${cli?.nome||''}`;
  openM('modal-contato');
}

function normContatoKey(v){
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ');
}

function normContatoTelefone(v){
  return String(v || '').replace(/\D+/g,'');
}

function encontrarContatoClienteExistente(clienteId, nome, email, telefone){
  const cid = String(clienteId || '');
  if (!cid) return null;
  const nomeKey = normContatoKey(nome);
  const emailKey = normContatoKey(email);
  const telKey = normContatoTelefone(telefone);
  return allContatos.find(ct => {
    if (String(ct.cliente_id || '') !== cid) return false;
    const mesmoEmail = emailKey && normContatoKey(ct.email) === emailKey;
    const mesmoTel = telKey && normContatoTelefone(ct.telefone) === telKey;
    const mesmoNome = nomeKey && normContatoKey(ct.nome) === nomeKey;
    return mesmoEmail || mesmoTel || mesmoNome;
  }) || null;
}

async function salvarContato(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const nome=document.getElementById('contato-nome').value.trim();
  if(!nome){toast('Nome é obrigatório.');return;}
  const clienteId=document.getElementById('contato-cliente-id').value;
  const payload={
    cliente_id:clienteId,
    nome,
    cargo:document.getElementById('contato-cargo').value.trim()||null,
    telefone:document.getElementById('contato-tel').value.trim()||null,
    email:document.getElementById('contato-email').value.trim()||null,
  };
  // COM-2: usar .select() para detectar bloqueio silencioso de RLS
  const {data:ctData, error}=await sb.from('contatos').insert(payload).select('id');
  if(error){toast('Erro ao salvar contato: '+error.message);return;}
  if(!ctData||ctData.length===0){
    toast('Contato não foi salvo. Execute o SQL de permissões RLS na tabela contatos (ver SQL_RLS_SPRINT_A.sql).');
    return;
  }
  toast('Contato adicionado!');
  closeM('modal-contato');
  await carregarDados();
  renderContatos();
}

async function salvarRespClienteComoContato(){
  if(currentUser?.viewer_only){toast('Sem permissão.');return;}
  const clienteId = document.getElementById('opp-cliente-id').value;
  if(!clienteId){toast('Selecione um cliente antes de salvar o contato.');return;}

  const nome = document.getElementById('opp-rc-nome').value.trim();
  const telefone = document.getElementById('opp-rc-tel').value.trim();
  const email = document.getElementById('opp-rc-email').value.trim();

  if(!nome && !telefone && !email){
    toast('Preencha ao menos nome, telefone ou e-mail do responsável do cliente.');
    return;
  }
  if(!nome){
    toast('Informe o nome do responsável do cliente para salvar em contatos.');
    return;
  }

  const existente = encontrarContatoClienteExistente(clienteId, nome, email, telefone);
  if (existente) {
    const payload = {
      nome: existente.nome || nome,
      telefone: existente.telefone || telefone || null,
      email: existente.email || email || null
    };
    const { error } = await sb.from('contatos').update(payload).eq('id', existente.id);
    if (error) { toast('Erro ao atualizar contato existente: ' + error.message); return; }
    toast('Contato comercial reaproveitado e atualizado.');
  } else {
    const payload = {
      cliente_id: clienteId,
      nome,
      cargo: null,
      telefone: telefone || null,
      email: email || null
    };
    const { data: ctData, error } = await sb.from('contatos').insert(payload).select('id');
    if (error) { toast('Erro ao salvar contato: ' + error.message); return; }
    if (!ctData || ctData.length === 0) {
      toast('Contato não foi salvo. Verifique as permissões da tabela contatos.');
      return;
    }
    toast('Contato comercial criado a partir do responsável do orçamento.');
  }

  await carregarDados();
  renderContatos();
}

// ═══════════════════════════════════════════════════
// DETALHE — cabeçalho correto, sem "fechar oportunidade"
// ═══════════════════════════════════════════════════

function abrirDetail(oppId){
  const op=allOps.find(o=>o.id===oppId);
  if(!op)return;
  detailOppId=oppId;
  const canEdit=!currentUser?.viewer_only;
  document.getElementById('det-fu-btn').style.display=canEdit?'inline-flex':'none';
  document.getElementById('det-edit-btn').style.display=canEdit?'inline-flex':'none';
  // Cabeçalho: número · cliente · projeto
  const hdrParts=[op.num_legado,op._cliente?.nome,op.projeto].filter(Boolean);
  document.getElementById('det-title').textContent=hdrParts.join(' · ');

  const vProp=oppValorProposto(op);
  const vFch=oppValorFechado(op);
  const fus=op._followups||[];
  const u=userById(op.resp_id);
  const stage=(op.pipeline_stage||'').toLowerCase();
  const isOpen=isAtiva(op);

  let html='';

  // Barra de ações: mostra todos os 4 estágios exceto o atual
  if(canEdit && isOpen){
    const _pipeStages=[
      {key:'prospeccao',vals:['prospecção','prospeccao'],label:'← Lead'},
      {key:'enviada',vals:['enviada','ativo'],label:'Orçamento ativo'},
      {key:'negociacao',vals:['negociacao','negociação'],label:'Negociação'},
    ];
    html+=`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--cinza2)">
      <span style="font-size:9px;color:#bbb;font-weight:600;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap">Mover para:</span>`;
    _pipeStages.forEach(s=>{
      if(s.vals.includes(stage))return;
      html+=`<button class="btn sm" onclick="abrirAcaoOpp('${s.key}')">${s.label}</button>`;
    });
    if(op._produtos.length>0||op._proposal?.items?.length>0)
      html+=`<button class="btn sm verde" onclick="abrirFechamento('${escJsStr(oppId)}')">✓ Fechar oportunidade</button>`;
    html+=`</div>`;
  }

  html+=`<div class="ms"><div class="ms-title">Identificação</div>
    <div class="dr"><div class="dk">Número</div><div class="dv" style="font-family:var(--font-mono);font-weight:700">${escHtml(op.num_legado||'—')}</div></div>
    <div class="dr"><div class="dk">Responsável</div><div class="dv">${respBadge(op.resp_id)} ${escHtml(u.nome)}</div></div>
    <div class="dr"><div class="dk">Estágio</div><div class="dv">${estagBadge(op.pipeline_stage)}</div></div>
    ${op.proposta_calc_id?(()=>{
      const lp = allProposals.find(p=>p.proposal_id===op.proposta_calc_id);
      const codDisp = lp?.prop_code ? `EXP-${String(lp.prop_code).padStart(3,'0')}` : `#${op.proposta_calc_id}`;
      const verDisp = lp ? _verLabel(lp.version||0) : '';
      return `<div class="dr"><div class="dk">Proposta calc</div><div class="dv" style="font-family:var(--font-mono);font-size:11px">
        <span style="font-weight:700">${escHtml(codDisp)}</span>${verDisp?` <span style="color:var(--azul);font-weight:700">${escHtml(verDisp)}</span>`:''}
        <span id="det-calc-info-${oppId}" style="color:#aaa;font-size:10px;margin-left:6px">carregando...</span>
      </div></div>`;
    })():''}
  </div>`;

  html+=`<div class="ms"><div class="ms-title">Cliente e projeto</div>
    <div class="dr"><div class="dk">Cliente</div><div class="dv"><strong>${escHtml(op._cliente?.nome||'—')}</strong></div></div>
    ${op.projeto?`<div class="dr"><div class="dk">Projeto</div><div class="dv">${escHtml(op.projeto)}</div></div>`:''}
    <div class="dr"><div class="dk">Cidade</div><div class="dv">${escHtml(op.cidade||'—')}${op.uf?' / '+escHtml(op.uf):''}</div></div>
    ${op.origem?`<div class="dr"><div class="dk">Origem</div><div class="dv"><strong>${escHtml(op.origem)}</strong>${op.indicou?' — '+escHtml(op.indicou):''}</div></div>`:''}
    ${(op.resp_cliente_nome||op.resp_cliente_tel||op.resp_cliente_email)?`<div class="dr"><div class="dk">Resp. cliente</div><div class="dv" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${op.resp_cliente_nome?`<span style="font-weight:600">${escHtml(op.resp_cliente_nome)}</span>`:''}
      ${op.resp_cliente_tel?`<span style="font-family:var(--font-mono);font-size:10px">${escHtml(op.resp_cliente_tel)}</span>`:''}
      ${op.resp_cliente_email?`<a href="mailto:${escAttr(op.resp_cliente_email)}" style="font-size:10px;color:var(--azul)">${escHtml(op.resp_cliente_email)}</a>`:''}
    </div></div>`:''}
  </div>`;

  // Produtos / Serviços — vínculo direto com exp_proposals (sem copiar para tabela produtos)
  const _lp = op._proposal;
  const _calcItens = _lp?.items?.length ? _lp.items.map((it,idx)=>({
    _virtual: true,
    id: `calc-${op.proposta_calc_id}-${idx}`,
    nucleo: it.nucleo || 'PAIS',
    subtipo: it.subK || null,
    subLabel: it.subLabel || SUBTIPO_LABEL?.[it.subK] || it.subK || 'Serviço',
    valor_calculado: +it.valorCalc || 0,
    valor_proposto: it.valorProposto != null ? +it.valorProposto : (+it.valorCalc || 0),
  })) : null;
  const _useCalc = !!_calcItens;
  const _prodItems = _calcItens || op._produtos;

  const _calcUpdAt = _lp?.updated_at ? new Date(_lp.updated_at) : null;
  const _oppUpdAt  = op.updated_at   ? new Date(op.updated_at)  : null;
  const _calcNovo  = _calcUpdAt && _oppUpdAt && _calcUpdAt > _oppUpdAt;
  const _calcBadge = _useCalc
    ? `<span style="margin-left:4px;font-size:8px;padding:2px 6px;color:var(--verde);font-weight:600;white-space:nowrap" title="Atualizada ${_lp.updated_at?fmtD(_lp.updated_at):''}">⟳ calc vinculada${_calcNovo?` · <span style="color:var(--ouro)">atualizada</span>`:''}</span>`
    : (op.proposta_calc_id ? `<span style="margin-left:4px;font-size:8px;color:#aaa">calc vinculada</span>` : '');
  const _resetBtn = canEdit && op.proposta_calc_id
    ? `<button class="btn sm" style="margin-left:auto;font-size:8px;padding:2px 8px;color:#888;border-color:#ddd" onclick="resetVinculoCalc('${escJsStr(oppId)}')" title="Limpa produtos importados e reconecta com a calculadora">↺ Atualizar vínculo</button>`
    : '';
  const prodSecHdr=`<div class="ms-title" style="display:flex;align-items:center">Produtos / Serviços ${_calcBadge}${_resetBtn}</div>`;

  if(_prodItems.length){
    html+=`<div class="ms">${prodSecHdr}`;
    _prodItems.forEach(p=>{
      const subLabel=_useCalc?(p.subLabel||'—'):(SUBTIPO_LABEL[p.subtipo]||p.subtipo||'—');
      const pSt=(p.status||'').toLowerCase();
      let acaoBtns='';
      if(canEdit && !_useCalc){
        if(pSt==='ativo')
          acaoBtns=`<button class="btn sm" onclick="abrirAcaoProd('${escJsStr(p.id)}','negociacao')">→ Negociação</button><button class="btn sm tc" onclick="abrirAcaoProd('${escJsStr(p.id)}','negado')">✗ Negar</button>`;
        else if(pSt==='negociacao'||pSt==='negociação')
          acaoBtns=`<button class="btn sm verde" onclick="abrirAcaoProd('${escJsStr(p.id)}','fechado')">✓ Fechar</button><button class="btn sm tc" onclick="abrirAcaoProd('${escJsStr(p.id)}','negado')">✗ Negar</button>`;
        else if(pSt==='fechado')
          acaoBtns=`<button class="btn sm tc" onclick="abrirAcaoProd('${escJsStr(p.id)}','cancelado')">⊗ Cancelar</button>`;
      }
      html+=`<div style="border:1px solid var(--cinza2);padding:6px 10px;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          ${tipoBadgeProd(p.nucleo)}
          <span style="font-size:11px;font-weight:500">${escHtml(subLabel)}</span>
          ${!_useCalc?`<span style="margin-left:auto;display:flex;gap:5px;align-items:center">
            ${estagBadgeProd(p.status)}
            ${canEdit?`<button class="btn sm ghost" onclick="editarProd('${escJsStr(p.id)}')" style="padding:1px 6px" title="Editar">✎</button>`:''}
          </span>`:''}
        </div>
        <div style="display:flex;gap:14px;font-size:10px;color:#888;flex-wrap:wrap">
          ${p.valor_proposto?`<span>Proposta: <strong style="color:var(--grafite)">${fmt(p.valor_proposto)}</strong></span>`:''}
          ${!_useCalc&&p.valor_fechado?`<span>Fechado: <strong style="color:var(--verde)">${fmt(p.valor_fechado)}</strong></span>`:''}
          ${!_useCalc&&p.data_fechamento?`<span>Fech.: ${fmtD(p.data_fechamento)}</span>`:''}
          ${!_useCalc&&p.prob?`<span>${probDots(p.prob)}</span>`:''}
        </div>
        ${!_useCalc&&p.motivo_categoria?`<div style="margin-top:4px"><span class="badge b-tc">${normNegCat(p.motivo_categoria)}</span></div>`:''}
        ${!_useCalc&&p.motivo_negativa?`<div style="font-size:10px;color:#888;margin-top:2px">${escHtml(p.motivo_negativa)}</div>`:''}
        ${acaoBtns?`<div style="display:flex;gap:5px;margin-top:6px">${acaoBtns}</div>`:''}
      </div>`;
    });
    const _totalProp=_useCalc?_calcItens.reduce((s,p)=>s+(+p.valor_proposto||0),0):vProp;
    html+=`<div class="dr" style="margin-top:4px"><div class="dk">Total proposta</div><div class="dv" style="font-weight:700;font-family:var(--font-mono)">${fmt(_totalProp)}</div></div>`;
    if(!_useCalc&&vFch)html+=`<div class="dr"><div class="dk">Total fechado</div><div class="dv" style="font-weight:700;font-family:var(--font-mono);color:var(--verde)">${fmt(vFch)}</div></div>`;
    html+=`</div>`;
    // Custos vinculados (subs/desps/repasse) — inline, sem async
    if(_useCalc){
      const _subs=_lp.subs||[], _desps=_lp.desps||[], _rep=_lp.repasse||null;
      if(_subs.length||_desps.length||(_rep&&(_rep.nome||_rep.valorRep))){
        let ch=`<div class="ms"><div class="ms-title">Custos da proposta (EXP.calc)</div>`;
        if(_subs.length){
          ch+=`<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-bottom:6px">Subcontratações</div>`;
          _subs.forEach(s=>{
            const tot=(s.val||0)*(1+(s.bit||0)/100)*(1+(s.ret||0)/100);
            const aprov=s.status_aprov||'pendente';
            const apCor=aprov==='aprovada'?'var(--verde)':aprov==='negada'?'var(--terracota)':'var(--ouro)';
            ch+=`<div style="border:1px solid var(--cinza2);padding:5px 8px;margin-bottom:4px;font-size:10px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                <span style="font-weight:600">${s.serv||'—'}</span>
                ${s.emp?`<span style="color:#888">${s.emp}</span>`:''}
                <span style="margin-left:auto;font-size:9px;font-weight:700;color:${apCor};text-transform:uppercase">${aprov}</span>
              </div>
              <div style="display:flex;gap:12px;color:#888;flex-wrap:wrap">
                <span>Custo: <strong style="color:var(--grafite)">${fmt(s.val||0)}</strong></span>
                ${s.bit?`<span>Bitrib.: ${s.bit}%</span>`:''}
                ${s.ret?`<span>Ganho EXP: ${s.ret}%</span>`:''}
                <span style="margin-left:auto">Total: <strong style="color:var(--grafite)">${fmt(tot)}</strong></span>
              </div>
            </div>`;
          });
        }
        if(_desps.length){
          ch+=`<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-top:8px;margin-bottom:6px">Despesas Indiretas</div>`;
          _desps.forEach(d=>{
            ch+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--cinza2);font-size:10px">
              <span style="flex:1">${d.desc||'—'}</span>
              ${d.bit?`<span style="color:#888">Bit.: ${d.bit}%</span>`:''}
              <span style="font-family:var(--font-mono);font-weight:600">${fmt(d.valComBit||d.val||0)}</span>
            </div>`;
          });
        }
        if(_rep&&(_rep.nome||_rep.valorRep)){
          ch+=`<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#999;margin-top:8px;margin-bottom:6px">Repasse Comercial</div>
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:10px">
              <span style="flex:1"><strong>${_rep.nome||'—'}</strong>${_rep.tipo==='pct'?` · ${_rep.val}% sobre serviços`:' · valor fixo'}</span>
              <span style="font-family:var(--font-mono);font-weight:600">${fmt(_rep.valorRep||0)}</span>
            </div>`;
        }
        ch+=`</div>`;
        html+=ch;
      }
    }
  } else {
    html+=`<div class="ms">${prodSecHdr}
      <div style="font-size:11px;color:#aaa;padding:6px 0">Nenhum produto cadastrado.</div>
    </div>`;
  }

  // linha do tempo
  const eventos=[];
  if(op.data_entrada)eventos.push({d:op.data_entrada,lbl:'Entrada',cls:'az'});
  fus.forEach(f=>{if(f.data_contato)eventos.push({d:f.data_contato,lbl:`Follow-up${f.observacao?' — '+f.observacao.slice(0,60):''}`,cls:'',obs:f.proximo_contato?'Próximo: '+fmtD(f.proximo_contato):''});});
  const fd=oppDataFechamento(op);
  if(fd)eventos.push({d:fd,lbl:isFechada(op)?'Fechamento':'Negativa',cls:isFechada(op)?'verde':'tc'});
  eventos.sort((a,b)=>a.d.localeCompare(b.d));
  if(eventos.length){
    html+=`<div class="ms"><div class="ms-title">Linha do tempo</div><div class="timeline">`;
    eventos.forEach(e=>{html+=`<div class="tl-item"><div class="tl-dot ${e.cls}"></div><div class="tl-label">${fmtD(e.d)}</div><div class="tl-text">${escHtml(e.lbl)}</div>${e.obs?`<div class="tl-date">${escHtml(e.obs)}</div>`:''}</div>`;});
    html+=`</div></div>`;
  }


  if(op.obs)html+=`<div class="ms"><div class="ms-title">Observações</div><div style="font-size:11px;color:#555;padding:4px 0">${escHtml(op.obs)}</div></div>`;

  document.getElementById('det-body').innerHTML=html;
  openM('modal-detail');

  // C12: carrega info da proposta calc vinculada (async, não bloqueia abertura do modal)
  if (op.proposta_calc_id) carregarInfoPropostaCalc(op.proposta_calc_id, oppId);
}

// ═══ FECHAMENTOS ═════════════════════════════════════
let chartRelMensal = null;
function renderFechamentos(){
  const anoFil = document.getElementById('ff-ano')?.value||'todos';
  const anoStr = String(new Date().getFullYear());

  // populate resp select
  const rs = document.getElementById('ff-resp');
  if(rs){
    const cur = rs.value;
    rs.innerHTML = '<option value="todos">Todos resp.</option>' +
      Object.values(allUsers).filter(u=>u.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
        .map(u=>`<option value="${escHtml(u.id)}"${u.id===cur?' selected':''}>${escHtml(u.nome.split(' ')[0])}</option>`).join('');
  }
  const respFil = rs?.value||'todos';

  let ops = allOps.filter(o=>isFechada(o));
  if(anoFil!=='todos') ops = ops.filter(o=>(oppDataFechamento(o)||'').startsWith(anoFil));
  if(respFil!=='todos') ops = ops.filter(o=>o.resp_id===respFil);

  const fatTotal = ops.reduce((s,o)=>s+oppValorFechado(o),0);
  const fatEfetivo = ops.reduce((s,o)=>s+oppValorEfetivo(o,true),0);
  const qtd = ops.length;
  const ticket = qtd ? Math.round(fatEfetivo/qtd) : 0;
  const anoLabel = anoFil==='todos'?'total':anoFil;

  document.getElementById('fech-s-fat').textContent = fmt(fatTotal);
  document.getElementById('fech-s-fat-sub').textContent = `valor total fechado ${anoLabel}`;
  document.getElementById('fech-s-efetivo').textContent = fmt(fatEfetivo);
  document.getElementById('fech-s-efetivo-sub').textContent = `valor que compete à EXP`;
  document.getElementById('fech-s-qtd').textContent = qtd;
  document.getElementById('fech-s-qtd-sub').textContent = `oportunidades fechadas`;
  document.getElementById('fech-s-ticket').textContent = fmt(ticket);
  document.getElementById('fech-s-ticket-sub').textContent = `ticket médio efetivo EXP`;

  // Por tipo — valor efetivo + quantidade
  const tipoMap = {};
  ops.forEach(o=>{
    const t = oppTipo(o)||'Outros';
    if(!tipoMap[t]) tipoMap[t]={v:0,n:0};
    tipoMap[t].v += oppValorEfetivo(o,true);
    tipoMap[t].n++;
  });
  const totalEf = Object.values(tipoMap).reduce((s,x)=>s+x.v,0)||1;
  const tiposSorted = Object.entries(tipoMap).sort((a,b)=>b[1].v-a[1].v);
  document.getElementById('fech-por-tipo').innerHTML = tiposSorted.length
    ? tiposSorted.map(([t,{v,n}])=>`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span style="font-weight:500">${escHtml(t)}</span>
          <span style="font-family:var(--font-mono);font-size:10px">${fmt(v)} <span style="color:#aaa">(${Math.round(v/totalEf*100)}% · ${n} proj.)</span></span>
        </div>
        <div style="height:5px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(v/totalEf*100)}%;background:${CHART_CORES[t]||'var(--verde)'}"></div></div>
      </div>`).join('')
    : '<div class="empty-note">Sem fechamentos no período.</div>';

  // Por núcleo — contagem
  const nucMap = {};
  ops.forEach(o=>o._produtos.filter(p=>p.status==='fechado').forEach(p=>{
    const n = NUCLEO_GRUPO[p.nucleo]||p.nucleo||'Outros';
    nucMap[n] = (nucMap[n]||0)+1;
  }));
  const maxN = Math.max(...Object.values(nucMap),1);
  document.getElementById('fech-por-nucleo').innerHTML = Object.entries(nucMap).sort((a,b)=>b[1]-a[1])
    .map(([n,c])=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:11px;flex:1">${escHtml(n)}</div>
        <div style="width:80px;height:4px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(c/maxN*100)}%;background:${CHART_CORES[n]||'var(--verde)'}"></div></div>
        <div style="font-size:11px;font-weight:700;font-family:var(--font-mono);min-width:20px;text-align:right">${c}</div>
      </div>`).join('') || '<div class="empty-note">—</div>';

  // Lista
  document.getElementById('fech-lista-total').textContent = `${ops.length} fechamentos`;
  const sorted = ops.slice().sort((a,b)=>(oppDataFechamento(b)||'').localeCompare(oppDataFechamento(a)||''));
  document.getElementById('fech-body').innerHTML = sorted.length
    ? sorted.map(o=>`<tr class="click" onclick="abrirDetail('${escJsStr(o.id)}')">
        <td class="num-tag">${escHtml(o.num_legado||'—')}</td>
        <td><strong>${escHtml(o._cliente?.nome||'—')}</strong>${o.projeto?`<br><span style="font-size:9px;color:#888">${escHtml(o.projeto)}</span>`:''}</td>
        <td>${o._produtos.filter(p=>p.status==='fechado').map(p=>tipoBadgeProd(p.nucleo)).join(' ')}</td>
        <td>${respBadge(o.resp_id)}</td>
        <td style="font-size:11px">${escHtml(o.cidade||'—')}${o.uf?'/'+escHtml(o.uf):''}</td>
        <td class="dtag">${fmtD(oppDataFechamento(o))}</td>
        <td style="font-family:var(--font-mono);font-weight:600">${fmt(oppValorFechado(o))}</td>
        <td style="font-family:var(--font-mono);color:var(--azul)">${fmt(oppValorEfetivo(o,true))}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty-note">Sem fechamentos no período.</td></tr>';
}

// ═══ NEGATIVAS ════════════════════════════════════════
function renderNegativas(){
  const anoFil = document.getElementById('nf-ano')?.value||'todos';
  const rs = document.getElementById('nf-resp');
  if(rs){
    const cur = rs.value;
    rs.innerHTML = '<option value="todos">Todos resp.</option>' +
      Object.values(allUsers).filter(u=>u.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
        .map(u=>`<option value="${escHtml(u.id)}"${u.id===cur?' selected':''}>${escHtml(u.nome.split(' ')[0])}</option>`).join('');
  }
  const respFil = rs?.value||'todos';

  let ops = allOps.filter(o=>isNegada(o));
  if(anoFil!=='todos') ops = ops.filter(o=>(o.updated_at||'').startsWith(anoFil));
  if(respFil!=='todos') ops = ops.filter(o=>o.resp_id===respFil);

  const total = ops.length;
  const valorPerdido = ops.reduce((s,o)=>s+oppValorEfetivo(o,false),0);

  // categoria mais frequente
  const catMap = {};
  ops.forEach(o=>o._produtos.filter(p=>isNegada(o)&&p.motivo_categoria).forEach(p=>{
    const _cat=normNegCat(p.motivo_categoria);
    catMap[_cat]=(catMap[_cat]||0)+1;
  }));
  const catSorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const topCat = catSorted[0];

  // prob retorno
  const comRetorno = ops.filter(o=>o._produtos.some(p=>['Alta','Média'].includes(p.prob_retorno)));

  document.getElementById('neg-s-total').textContent = total;
  document.getElementById('neg-s-total-sub').textContent = anoFil==='todos'?'em todo o histórico':`em ${anoFil}`;
  document.getElementById('neg-s-valor').textContent = fmt(valorPerdido);
  document.getElementById('neg-s-valor-sub').textContent = 'valor efetivo EXP perdido';
  document.getElementById('neg-s-cat').textContent = topCat?topCat[0]:'—';
  document.getElementById('neg-s-cat-sub').textContent = topCat?`${topCat[1]} ocorrências`:'sem categorias registradas';
  document.getElementById('neg-s-ret').textContent = comRetorno.length;
  document.getElementById('neg-s-ret-sub').textContent = `opp. com chance de retorno`;

  // Por categoria
  const maxCat = catSorted[0]?.[1]||1;
  const catCores = ['#B84C3A','#C36247','#D19931','#5280CA','#45865D','#6B4FA0','#C4831A','#888'];
  document.getElementById('neg-por-cat').innerHTML = catSorted.length
    ? catSorted.map(([cat,n],i)=>`
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span>${escHtml(cat)}</span><span style="font-family:var(--font-mono);font-size:10px;font-weight:700">${n}</span>
        </div>
        <div style="height:4px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(n/maxCat*100)}%;background:${catCores[i%catCores.length]}"></div></div>
      </div>`).join('')
    : '<div style="font-size:11px;color:#aaa;padding:4px 0">Nenhuma categoria registrada ainda.<br>Categorize as negativas no fluxo de produto.</div>';

  // Por núcleo
  const nucNeg = {};
  ops.forEach(o=>o._produtos.filter(p=>p.status==='negado').forEach(p=>{
    const n = NUCLEO_GRUPO[p.nucleo]||p.nucleo||'Outros';
    nucNeg[n]=(nucNeg[n]||0)+1;
  }));
  const maxNuc = Math.max(...Object.values(nucNeg),1);
  document.getElementById('neg-por-nucleo').innerHTML = Object.entries(nucNeg).sort((a,b)=>b[1]-a[1])
    .map(([n,c])=>`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:11px;flex:1">${escHtml(n)}</div>
        <div style="width:80px;height:4px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(c/maxNuc*100)}%;background:var(--terracota)"></div></div>
        <div style="font-size:11px;font-weight:700;font-family:var(--font-mono);min-width:20px;text-align:right">${c}</div>
      </div>`).join('') || '<div class="empty-note">—</div>';

  // Lista
  document.getElementById('neg-lista-total').textContent = `${total} negativas`;
  const sorted = ops.slice().sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
  const prodNegado = o => o._produtos.find(p=>p.status==='negado')||o._produtos[0];
  document.getElementById('neg-body').innerHTML = sorted.length
    ? sorted.map(o=>{
        const p = prodNegado(o);
        return`<tr class="click" onclick="abrirDetail('${escJsStr(o.id)}')">
          <td class="num-tag">${escHtml(o.num_legado||'—')}</td>
          <td><strong>${escHtml(o._cliente?.nome||'—')}</strong></td>
          <td>${tipoBadgeProd(o._produtos[0]?.nucleo)}</td>
          <td>${respBadge(o.resp_id)}</td>
          <td class="dtag">${fmtD(o.updated_at)}</td>
          <td>${p?.motivo_categoria?`<span class="badge b-tc">${escHtml(normNegCat(p.motivo_categoria))}</span>`:'<span style="color:#aaa;font-size:10px">—</span>'}</td>
          <td style="font-size:10px;color:#888;max-width:180px;white-space:normal">${escHtml(p?.motivo_negativa||'—')}</td>
          <td>${p?.prob_retorno?`<span class="badge ${p.prob_retorno==='Alta'?'b-vd':p.prob_retorno==='Média'?'b-am':'b-gr'}">${escHtml(p.prob_retorno)}</span>`:'—'}</td>
          <td style="font-family:var(--font-mono);color:var(--terracota)">${fmt(oppValorEfetivo(o,false))}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" class="empty-note">Sem negativas no período.</td></tr>';
}

// ═══ ALCANCE ══════════════════════════════════════════
// ── coordenadas lat/lng de cidades brasileiras ───────────────────────
const CITY_COORDS = {
  'São Paulo':[-23.55,-46.63],'Campinas':[-22.90,-47.06],'Santos':[-23.96,-46.33],
  'São José dos Campos':[-23.22,-45.90],'Ribeirão Preto':[-21.17,-47.81],
  'Sorocaba':[-23.50,-47.45],'Bauru':[-22.32,-49.07],'Jundiaí':[-23.19,-46.89],
  'Piracicaba':[-22.73,-47.65],'Limeira':[-22.56,-47.40],'São Carlos':[-21.99,-47.89],
  'Franca':[-20.54,-47.40],'Marília':[-22.22,-49.95],'Araraquara':[-21.79,-48.17],
  'Presidente Prudente':[-22.12,-51.39],'São Bernardo do Campo':[-23.69,-46.56],
  'Guarulhos':[-23.46,-46.53],'Osasco':[-23.53,-46.79],'Santo André':[-23.66,-46.54],
  'Rio de Janeiro':[-22.91,-43.17],'Niterói':[-22.89,-43.10],'Nova Iguaçu':[-22.76,-43.45],
  'Petrópolis':[-22.51,-43.18],'Volta Redonda':[-22.52,-44.10],
  'Campos dos Goytacazes':[-21.76,-41.33],'Macaé':[-22.37,-41.79],
  'Angra dos Reis':[-23.01,-44.32],'Cabo Frio':[-22.89,-42.02],'Resende':[-22.47,-44.45],
  'Belo Horizonte':[-19.92,-43.94],'Uberlândia':[-18.92,-48.28],
  'Juiz de Fora':[-21.76,-43.35],'Montes Claros':[-16.73,-43.87],
  'Governador Valadares':[-18.85,-41.95],'Ipatinga':[-19.47,-42.54],
  'Contagem':[-19.93,-44.05],'Uberaba':[-19.75,-47.93],'Betim':[-19.97,-44.20],
  'Divinópolis':[-20.14,-44.89],'Sete Lagoas':[-19.46,-44.25],
  'Curitiba':[-25.43,-49.27],'Londrina':[-23.31,-51.16],'Maringá':[-23.42,-51.94],
  'Cascavel':[-24.96,-53.46],'Foz do Iguaçu':[-25.52,-54.58],'Ponta Grossa':[-25.10,-50.16],
  'São José dos Pinhais':[-25.54,-49.21],'Colombo':[-25.29,-49.22],
  'Florianópolis':[-27.59,-48.55],'Joinville':[-26.30,-48.85],'Blumenau':[-26.92,-49.07],
  'Chapecó':[-27.10,-52.62],'Criciúma':[-28.68,-49.37],'Itajaí':[-26.91,-48.67],
  'Balneário Camboriú':[-26.99,-48.63],'Jaraguá do Sul':[-26.49,-49.07],
  'Porto Alegre':[-30.03,-51.23],'Caxias do Sul':[-29.17,-51.17],
  'Pelotas':[-31.77,-52.34],'Santa Maria':[-29.69,-53.81],'Novo Hamburgo':[-29.69,-51.13],
  'Canoas':[-29.92,-51.18],'Gravataí':[-29.94,-50.99],'Viamão':[-30.08,-51.02],
  'Brasília':[-15.78,-47.93],
  'Goiânia':[-16.69,-49.26],'Aparecida de Goiânia':[-16.82,-49.24],'Anápolis':[-16.33,-48.95],
  'Campo Grande':[-20.44,-54.65],'Dourados':[-22.22,-54.81],'Três Lagoas':[-20.75,-51.69],
  'Cuiabá':[-15.60,-56.10],'Várzea Grande':[-15.65,-56.13],'Sinop':[-11.86,-55.51],
  'Rondonópolis':[-16.47,-54.64],
  'Salvador':[-12.97,-38.51],'Feira de Santana':[-12.27,-38.97],
  'Vitória da Conquista':[-14.87,-40.84],'Ilhéus':[-14.79,-39.04],
  'Porto Seguro':[-16.43,-39.08],'Camaçari':[-12.70,-38.33],'Lauro de Freitas':[-12.90,-38.33],
  'Aracaju':[-10.91,-37.07],'Maceió':[-9.67,-35.74],
  'Recife':[-8.05,-34.88],'Caruaru':[-8.28,-35.97],'Petrolina':[-9.39,-40.50],
  'Olinda':[-8.01,-34.85],'Jaboatão dos Guararapes':[-8.11,-35.01],'Caruaru':[-8.28,-35.97],
  'João Pessoa':[-7.12,-34.86],'Campina Grande':[-7.22,-35.88],
  'Natal':[-5.79,-35.21],'Mossoró':[-5.19,-37.34],
  'Fortaleza':[-3.72,-38.54],'Sobral':[-3.69,-40.35],'Juazeiro do Norte':[-7.21,-39.31],
  'Crato':[-7.23,-39.41],'Caucaia':[-3.74,-38.65],'Maracanaú':[-3.88,-38.63],
  'Teresina':[-5.09,-42.80],'Parnaíba':[-2.91,-41.77],
  'São Luís':[-2.53,-44.30],'Imperatriz':[-5.52,-47.49],
  'Belém':[-1.45,-48.50],'Santarém':[-2.44,-54.71],'Marabá':[-5.37,-49.12],
  'Castanhal':[-1.29,-47.93],'Ananindeua':[-1.37,-48.37],
  'Macapá':[0.03,-51.07],
  'Manaus':[-3.10,-60.03],'Parintins':[-2.63,-56.74],
  'Boa Vista':[2.82,-60.67],
  'Porto Velho':[-8.76,-63.90],'Ji-Paraná':[-10.88,-61.94],
  'Rio Branco':[-9.97,-67.81],
  'Palmas':[-10.24,-48.36],'Araguaína':[-7.19,-48.20],
  'Vitória':[-20.32,-40.34],'Vila Velha':[-20.34,-40.29],'Serra':[-20.13,-40.31],
  'Cariacica':[-20.26,-40.41],'Cachoeiro de Itapemirim':[-20.85,-41.11],
};
const UF_CENTROIDS = {
  'SP':[-22.0,-48.5],'RJ':[-22.5,-43.2],'MG':[-18.5,-44.5],'ES':[-19.6,-40.7],
  'PR':[-24.5,-51.5],'SC':[-27.3,-50.0],'RS':[-30.0,-53.0],
  'DF':[-15.78,-47.93],'GO':[-16.0,-49.5],'MS':[-20.5,-54.5],'MT':[-14.0,-56.0],
  'BA':[-12.5,-41.7],'SE':[-10.9,-37.4],'AL':[-9.7,-36.6],'PE':[-8.4,-37.8],
  'PB':[-7.2,-36.8],'RN':[-5.8,-36.5],'CE':[-5.2,-39.5],'PI':[-7.7,-42.7],
  'MA':[-5.0,-44.0],'PA':[-4.0,-52.0],'AP':[1.4,-51.8],'AM':[-4.5,-62.5],
  'RR':[2.0,-61.4],'RO':[-11.0,-63.0],'AC':[-9.0,-70.0],'TO':[-10.2,-48.3],
};

function _cityCoords(cidade, uf) {
  if (!cidade) return UF_CENTROIDS[uf] || null;
  const exact = CITY_COORDS[cidade];
  if (exact) return exact;
  const low = cidade.toLowerCase();
  const k = Object.keys(CITY_COORDS).find(c => c.toLowerCase() === low);
  if (k) return CITY_COORDS[k];
  return UF_CENTROIDS[uf] || null;
}

function _latlngToSvg(lat, lng) {
  const SVG_W=1427.75, SVG_H=1474.67;
  const LAT_MAX=5.27, LAT_MIN=-33.75, LNG_MIN=-73.98, LNG_MAX=-34.79;
  return [
    (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * SVG_W,
    (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * SVG_H,
  ];
}

function _initBrazilPath(){
  const el=document.getElementById('alc-br');
  if(!el||el.tagName.toLowerCase()==='path') return; // já convertido
  const pts=[
    [161,0],[166,19],[260,18],[280,48],[287,68],[305,87],[348,100],
    [415,115],[454,142],[460,159],[459,171],[450,192],[433,207],
    [415,234],[410,278],[396,327],[361,361],[349,363],[325,375],
    [299,394],[299,420],[293,433],[267,452],[242,499],[205,457],
    [198,449],[228,394],[226,397],[194,357],[190,312],[191,274],
    [158,241],[123,197],[105,206],[70,209],[1,194],[9,164],
    [47,123],[47,48],[76,41],[117,16]
  ];
  const N=pts.length, t=0.32;
  let d=`M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<N;i++){
    const p0=pts[(i-1+N)%N], p1=pts[i], p2=pts[(i+1)%N], p3=pts[(i+2)%N];
    const c1x=(p1[0]+(p2[0]-p0[0])*t).toFixed(1);
    const c1y=(p1[1]+(p2[1]-p0[1])*t).toFixed(1);
    const c2x=(p2[0]-(p3[0]-p1[0])*t).toFixed(1);
    const c2y=(p2[1]-(p3[1]-p1[1])*t).toFixed(1);
    d+=` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  d+='Z';
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('id','alc-br');
  path.setAttribute('d',d);
  path.setAttribute('fill','#e2e1db');
  path.setAttribute('stroke','#c4c2ba');
  path.setAttribute('stroke-width','2');
  path.setAttribute('stroke-linejoin','round');
  path.setAttribute('stroke-linecap','round');
  path.setAttribute('filter','url(#alc-sh)');
  el.parentNode.replaceChild(path,el);
}

function renderAlcance(){
  // sync dropdown with alcMode global
  const modoEl=document.getElementById('alc-modo');
  if(modoEl && modoEl.value!==alcMode) modoEl.value=alcMode;
  document.getElementById('alc-list-back').style.display='none';

  // init smooth map path once
  _initBrazilPath();

  // populate resp select
  const rs=document.getElementById('alc-resp');
  if(rs){
    const cur=rs.value;
    rs.innerHTML='<option value="todos">Todos resp.</option>'+
      Object.values(allUsers).filter(u=>u.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
        .map(u=>`<option value="${escHtml(u.id)}"${u.id===cur?' selected':''}>${escHtml(u.nome.split(' ')[0])}</option>`).join('');
  }
  const respFil=rs?.value||'todos';
  const anoFil=document.getElementById('alc-ano')?.value||'todos';

  let ops=[...allOps];
  if(alcMode==='op'){
    ops=ops.filter(o=>isAtiva(o));
  } else if(alcMode==='fech'){
    ops=ops.filter(o=>isFechada(o));
    if(anoFil!=='todos') ops=ops.filter(o=>(oppDataFechamento(o)||'').startsWith(anoFil));
  } else {
    // todos: ativas + fechadas
    ops=ops.filter(o=>isAtiva(o)||isFechada(o));
    if(anoFil!=='todos') ops=ops.filter(o=>
      (o.data_entrada||'').startsWith(anoFil)||(oppDataFechamento(o)||'').startsWith(anoFil));
  }
  if(respFil!=='todos') ops=ops.filter(o=>o.resp_id===respFil);

  const ativas=ops.filter(o=>isAtiva(o));
  const fechadas=ops.filter(o=>isFechada(o));
  const pipeVal=ativas.reduce((s,o)=>s+oppValorProposto(o),0);
  const fechVal=fechadas.reduce((s,o)=>s+oppValorFechado(o),0);
  document.getElementById('alc-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:2px">
      <div style="text-align:center;padding:8px 4px;background:var(--branco);border:1px solid var(--cinza);border-radius:6px">
        <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)">${ops.length}</div>
        <div style="font-size:9px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:.5px">oportunidades</div>
      </div>
      <div style="text-align:center;padding:8px 4px;background:var(--branco);border:1px solid var(--cinza);border-radius:6px">
        <div style="font-size:12px;font-weight:700;font-family:var(--font-mono)">${fmt(alcMode==='fech'?fechVal:pipeVal)}</div>
        <div style="font-size:9px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:.5px">${alcMode==='fech'?'valor fechado':'pipeline'}</div>
      </div>
    </div>`;

  // agrupar por cidade
  const groups={};
  ops.forEach(o=>{
    const key=(o.cidade||'').trim().toLowerCase()+'/'+(o.uf||'').toLowerCase();
    if(!groups[key]) groups[key]={cidade:o.cidade||'—',uf:o.uf||'',ops:[]};
    groups[key].ops.push(o);
  });

  _renderAlcanceMap(Object.values(groups));
  _renderAlcanceList(Object.values(groups).sort((a,b)=>
    (a.cidade||'').localeCompare(b.cidade||'','pt-BR')));
}

function _renderAlcanceMap(groupArr){
  const svg=document.getElementById('alc-svg');
  svg.querySelectorAll('.alc-dot').forEach(e=>e.remove());
  const tip=document.getElementById('alc-tip');

  // Ler tokens canônicos em runtime — adapta light/dark mode automaticamente
  const rs=getComputedStyle(document.documentElement);
  const COR_OP   = rs.getPropertyValue('--azul').trim();
  const COR_FECH = rs.getPropertyValue('--verde').trim();
  const COR_MIX  = rs.getPropertyValue('--cinza').trim();

  groupArr.forEach(g=>{
    const coords=_cityCoords(g.cidade,g.uf);
    if(!coords) return;
    const [x,y]=_latlngToSvg(coords[0],coords[1]);
    const cnt=g.ops.length;
    const r=Math.max(18,Math.min(18+cnt*8,60));

    let color;
    if(alcMode==='op') color=COR_OP;
    else if(alcMode==='fech') color=COR_FECH;
    else {
      const nFech=g.ops.filter(o=>isFechada(o)).length;
      const nAtiv=g.ops.filter(o=>isAtiva(o)).length;
      color=nFech>nAtiv?COR_FECH:nAtiv>nFech?COR_OP:COR_MIX;
    }

    const ns='http://www.w3.org/2000/svg';
    const glow=document.createElementNS(ns,'circle');
    glow.setAttribute('cx',x); glow.setAttribute('cy',y);
    glow.setAttribute('r',r+18); glow.setAttribute('fill',color);
    glow.setAttribute('fill-opacity','0.18'); glow.setAttribute('class','alc-dot');
    svg.appendChild(glow);

    const dot=document.createElementNS(ns,'circle');
    dot.setAttribute('cx',x); dot.setAttribute('cy',y);
    dot.setAttribute('r',r); dot.setAttribute('fill',color);
    dot.setAttribute('stroke','#fff'); dot.setAttribute('stroke-width','4');
    dot.setAttribute('class','alc-dot'); dot.style.cursor='pointer';

    dot.addEventListener('mouseenter',()=>{
      tip.style.display='block';
      tip.innerHTML=`<strong>${escHtml(g.cidade)}${g.uf?', '+escHtml(g.uf):''}</strong><br>${cnt} oportunidade${cnt!==1?'s':''}`;
    });
    dot.addEventListener('mousemove',e=>{
      tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-10)+'px';
    });
    dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
    dot.addEventListener('click',()=>_alcanceDrillCity(g));
    svg.appendChild(dot);

    if(cnt>1){
      const txt=document.createElementNS(ns,'text');
      txt.setAttribute('x',x); txt.setAttribute('y',y);
      txt.setAttribute('text-anchor','middle'); txt.setAttribute('dominant-baseline','central');
      txt.setAttribute('font-size',r<30?'18':'24'); txt.setAttribute('font-weight','700');
      txt.setAttribute('fill','#fff'); txt.setAttribute('class','alc-dot');
      txt.setAttribute('pointer-events','none'); txt.textContent=cnt;
      svg.appendChild(txt);
    }
  });
}

let _alcGroups = [];

function _renderAlcanceList(sorted){
  _alcGroups = sorted;
  document.getElementById('alc-list-hdr').textContent='Por cidade';
  document.getElementById('alc-list-back').style.display='none';
  document.getElementById('alc-list').innerHTML=sorted.length
    ? sorted.map((g,i)=>`
      <div class="alc-city-card" onclick="_alcanceDrillCity(_alcGroups[${i}])">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-weight:600;font-size:11px">${escHtml(g.cidade)}${g.uf?` <span style="color:#aaa;font-weight:400">· ${escHtml(g.uf)}</span>`:''}</div>
          <div style="font-size:10px;font-family:var(--font-mono);color:#888">${g.ops.length}</div>
        </div>
      </div>`).join('')
    : '<div class="empty-note">Sem dados com cidade cadastrada.</div>';
}

function _alcanceDrillCity(g){
  document.getElementById('alc-list-hdr').textContent=g.cidade+(g.uf?' · '+g.uf:'');
  document.getElementById('alc-list-back').style.display='block';
  document.getElementById('alc-list').innerHTML=g.ops.map(o=>`
    <div class="alc-city-card" onclick="abrirDetail('${escJsStr(o.id)}')">
      <div style="font-weight:600;font-size:11px;margin-bottom:2px">${escHtml(o._cliente?.nome||'—')}</div>
      <div style="font-size:10px;color:#888">${escHtml(o.projeto||'—')}</div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        ${estagBadge(o.pipeline_stage)}
        <span style="font-family:var(--font-mono);font-size:11px;font-weight:600">${fmt(alcMode==='fech'?oppValorFechado(o):oppValorProposto(o))}</span>
      </div>
    </div>`).join('');
}

// ═══ RELATÓRIOS ═══════════════════════════════════════
function renderRelatorios(){
  const anoFil = document.getElementById('rf-ano')?.value||String(new Date().getFullYear());
  const rs = document.getElementById('rf-resp');
  if(rs){
    const cur = rs.value;
    rs.innerHTML = '<option value="todos">Todos resp.</option>' +
      Object.values(allUsers).filter(u=>u.ativo!==false).sort((a,b)=>a.nome.localeCompare(b.nome))
        .map(u=>`<option value="${escHtml(u.id)}"${u.id===cur?' selected':''}>${escHtml(u.nome.split(' ')[0])}</option>`).join('');
  }
  const respFil = rs?.value||'todos';

  let ops = allOps;
  if(anoFil!=='todos') ops = ops.filter(o=>(o.data_entrada||'').startsWith(anoFil)||(oppDataFechamento(o)||'').startsWith(anoFil));
  if(respFil!=='todos') ops = ops.filter(o=>o.resp_id===respFil);

  const ativas   = ops.filter(o=>isAtiva(o));
  const fechadas  = ops.filter(o=>isFechada(o));
  const negadas   = ops.filter(o=>isNegada(o));
  const novas     = anoFil!=='todos' ? allOps.filter(o=>(o.data_entrada||'').startsWith(anoFil)&&(respFil==='todos'||o.resp_id===respFil)) : ops;

  const fatTotal   = fechadas.reduce((s,o)=>s+oppValorFechado(o),0);
  const fatEfetivo = fechadas.reduce((s,o)=>s+oppValorEfetivo(o,true),0);
  const pipeEfetivo= ativas.reduce((s,o)=>s+oppValorEfetivo(o,false),0);
  const perdidoEf  = negadas.reduce((s,o)=>s+oppValorEfetivo(o,false),0);
  const taxaConv   = novas.length ? Math.round(fechadas.filter(o=>novas.includes(o)).length/novas.length*100) : 0;
  const ticket     = fechadas.length ? Math.round(fatEfetivo/fechadas.length) : 0;

  document.getElementById('rel-resumo').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#999;margin-bottom:6px">Faturamento ${anoFil}</div>
        <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)">${fmt(fatTotal)}</div>
        <div style="font-size:11px;color:var(--azul);margin-top:2px">Efetivo EXP: <strong>${fmt(fatEfetivo)}</strong></div>
      </div>
      <div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#999;margin-bottom:6px">Pipeline efetivo</div>
        <div style="font-size:20px;font-weight:700;font-family:var(--font-mono)">${fmt(pipeEfetivo)}</div>
        <div style="font-size:11px;color:var(--terracota);margin-top:2px">Perdido: <strong>${fmt(perdidoEf)}</strong></div>
      </div>
      <div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#999;margin-bottom:6px">Indicadores</div>
        <div style="font-size:11px;margin-bottom:4px">Conversão: <strong style="font-family:var(--font-mono)">${taxaConv}%</strong> <span style="color:#aaa">(${fechadas.length}/${novas.length} opps)</span></div>
        <div style="font-size:11px;margin-bottom:4px">Ticket médio: <strong style="font-family:var(--font-mono)">${fmt(ticket)}</strong></div>
        <div style="font-size:11px">Novas opps: <strong>${novas.length}</strong> · Fechadas: <strong style="color:var(--verde)">${fechadas.length}</strong> · Negadas: <strong style="color:var(--terracota)">${negadas.length}</strong></div>
      </div>
    </div>`;

  // Por responsável
  const byResp={};
  fechadas.forEach(o=>{
    const uid=o.resp_id;
    if(!byResp[uid])byResp[uid]={fat:0,efetivo:0,n:0};
    byResp[uid].fat+=oppValorFechado(o);
    byResp[uid].efetivo+=oppValorEfetivo(o,true);
    byResp[uid].n++;
  });
  const respSorted=Object.entries(byResp).sort((a,b)=>b[1].efetivo-a[1].efetivo);
  const maxResp=respSorted[0]?.[1].efetivo||1;
  document.getElementById('rel-por-resp').innerHTML=respSorted.length
    ? respSorted.map(([uid,{fat,efetivo,n}])=>{
        const u=allUsers[uid]||{};
        return`<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="display:flex;align-items:center;gap:6px">${respAvatar(uid,18)}<strong>${escHtml(u.nome?.split(' ')[0]||'?')}</strong> <span style="color:#aaa">${n} proj.</span></span>
            <span style="font-family:var(--font-mono);font-size:10px;color:var(--azul)">${fmt(efetivo)}</span>
          </div>
          <div style="height:4px;background:var(--cinza2)"><div style="height:100%;width:${Math.round(efetivo/maxResp*100)}%;background:${u.cor||'var(--verde)'}"></div></div>
        </div>`;
      }).join('')
    : '<div class="empty-note">Sem fechamentos no período.</div>';

  // Eficiência: efetivo fechado / efetivo orçado (nesse período)
  const orcado = ops.filter(o=>!isFechada(o)||true).reduce((s,o)=>s+oppValorEfetivo(o,false),0);
  const eficiencia = orcado ? Math.round(fatEfetivo/orcado*100) : 0;
  const perdidoPct = orcado ? Math.round(perdidoEf/orcado*100) : 0;
  document.getElementById('rel-eficiencia').innerHTML=`
    <div style="margin-bottom:14px">
      <div style="font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#999;margin-bottom:6px">Efetivo orçado no período</div>
      <div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">${fmt(orcado)}</div>
    </div>
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="color:var(--verde)">Fechado</span><span style="font-family:var(--font-mono)">${fmt(fatEfetivo)} (${eficiencia}%)</span>
      </div>
      <div style="height:6px;background:var(--cinza2)"><div style="height:100%;width:${Math.min(eficiencia,100)}%;background:var(--verde)"></div></div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
        <span style="color:var(--terracota)">Perdido (negativas)</span><span style="font-family:var(--font-mono)">${fmt(perdidoEf)} (${perdidoPct}%)</span>
      </div>
      <div style="height:6px;background:var(--cinza2)"><div style="height:100%;width:${Math.min(perdidoPct,100)}%;background:var(--terracota)"></div></div>
    </div>`;

  // S4-03 — gráfico mensal: barras de Efetivo EXP + linha de novas opps
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const dadosMensal=Array(12).fill(0);
  const dadosNovas=Array(12).fill(0);
  const dadosNegadas=Array(12).fill(0);
  if(anoFil!=='todos'){
    // fechadas: efetivo EXP por mês de fechamento
    fechadas.forEach(o=>{
      const d=oppDataFechamento(o); if(!d||!d.startsWith(anoFil))return;
      const m=parseInt(d.slice(5,7))-1;
      if(m>=0&&m<12) dadosMensal[m]+=oppValorEfetivo(o,true);
    });
    // novas: por mês de entrada
    novas.forEach(o=>{
      const d=o.data_entrada; if(!d||!d.startsWith(anoFil))return;
      const m=parseInt(d.slice(5,7))-1;
      if(m>=0&&m<12) dadosNovas[m]++;
    });
    // negadas: por mês de updated_at
    negadas.forEach(o=>{
      const d=o.updated_at; if(!d||!d.startsWith(anoFil))return;
      const m=parseInt(d.slice(5,7))-1;
      if(m>=0&&m<12) dadosNegadas[m]++;
    });
  }
  if(chartRelMensal)chartRelMensal.destroy();
  const ctx=document.getElementById('chart-relatorio-mensal')?.getContext('2d');
  if(ctx){
    chartRelMensal=new Chart(ctx,{
      type:'bar',
      data:{labels:meses,datasets:[
        {label:'Efetivo EXP (R$)',data:dadosMensal,backgroundColor:CHART_CORES.Total+'88',borderColor:CHART_CORES.Total,borderWidth:1,yAxisID:'y'},
        {label:'Novas opps',data:dadosNovas,type:'line',borderColor:'#45865D',backgroundColor:'transparent',borderWidth:2,pointRadius:3,tension:.3,yAxisID:'y2'},
        {label:'Negadas',data:dadosNegadas,type:'line',borderColor:'#E53935',backgroundColor:'transparent',borderWidth:1.5,pointRadius:2,tension:.3,borderDash:[3,3],yAxisID:'y2'},
      ]},
      options:{responsive:true,plugins:{legend:{labels:{font:{size:9},boxWidth:10,padding:8}}},scales:{
        x:{ticks:{font:{size:9}}},
        y:{position:'left',ticks:{font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k':v}},
        y2:{position:'right',grid:{drawOnChartArea:false},ticks:{font:{size:9},stepSize:1,callback:v=>Number.isInteger(v)?v:''}},
      }}
    });
  }

  // ── R1/R2/R3: Tabela de métricas mensais por coorte ──────────────
  const relMensalEl=document.getElementById('rel-mensal-tabela');
  if(anoFil!=='todos'&&relMensalEl){
    const mesesNomes=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const hoje=new Date();
    const mesAtual=String(hoje.getFullYear())===anoFil?hoje.getMonth():13;

    function mainNucleoKey(op){
      const items=op._proposal?.items?.length?op._proposal.items:op._produtos;
      if(!items.length)return null;
      const best=items.reduce((b,p)=>{
        const v=(+p.valor_proposto||+p.valorProposto||+p.valorCalc||0);
        const bv=(+b.valor_proposto||+b.valorProposto||+b.valorCalc||0);
        return v>bv?p:b;
      },items[0]);
      const grp=NUCLEO_GRUPO[best.nucleo]||'';
      if(grp==='Paisagismo')return'PAIS';
      if(grp==='Urbanismo')return'URB';
      if(grp==='Consultorias')return'CONSUL';
      if(grp==='Projetos Especiais')return'ESP';
      return null;
    }

    let tot={n:0,PAIS:0,URB:0,CONSUL:0,ESP:0,fech:0,tickets:[]};
    let rows='';

    mesesNomes.forEach((lbl,m)=>{
      const novasM=novas.filter(o=>{
        const d=o.data_entrada||'';
        return d.startsWith(anoFil)&&parseInt(d.slice(5,7))-1===m;
      });
      const by={PAIS:0,URB:0,CONSUL:0,ESP:0};
      novasM.forEach(o=>{const k=mainNucleoKey(o);if(k&&by[k]!==undefined)by[k]++;});

      const fechM=fechadas.filter(o=>{
        const d=oppDataFechamento(o)||'';
        return d.startsWith(anoFil)&&parseInt(d.slice(5,7))-1===m;
      });

      const fC=novasM.filter(o=>isFechada(o)).length;
      const fA=novasM.filter(o=>isAtiva(o)).length;
      const wr=novasM.length?Math.round(fC/novasM.length*100):null;
      const vFechM=fechM.reduce((s,o)=>s+oppValorFechado(o),0);
      const tickM=fechM.length?Math.round(vFechM/fechM.length):null;

      tot.n+=novasM.length;tot.PAIS+=by.PAIS;tot.URB+=by.URB;
      tot.CONSUL+=by.CONSUL;tot.ESP+=by.ESP;tot.fech+=fechM.length;
      if(tickM)tot.tickets.push(tickM);

      if(novasM.length===0&&fechM.length===0&&m>mesAtual)return;
      const isCur=m===mesAtual;

      const wrCell=wr!==null
        ?`<span style="font-family:var(--font-mono);font-weight:700;color:${wr>=50?'var(--verde)':wr<25?'var(--terracota)':'var(--ouro)'}">${wr}%</span>${fA?`<sup style="font-size:8px;color:#bbb" title="${fA} ainda em aberto"> ~</sup>`:''}`
        :'—';

      rows+=`<tr${isCur?' style="background:var(--az-bg)"':''}>
        <td style="font-weight:${isCur?700:400};white-space:nowrap">${lbl}${isCur?' ◂':''}</td>
        <td style="font-family:var(--font-mono)">${novasM.length||'—'}</td>
        <td style="color:var(--verde)">${by.PAIS||'—'}</td>
        <td style="color:var(--urb)">${by.URB||'—'}</td>
        <td style="color:var(--consul)">${by.CONSUL||'—'}</td>
        <td style="color:var(--esp)">${by.ESP||'—'}</td>
        <td style="font-family:var(--font-mono)">${fechM.length||'—'}</td>
        <td>${wrCell}</td>
        <td style="font-family:var(--font-mono);font-size:10px">${tickM?fmt(tickM):'—'}</td>
      </tr>`;
    });

    const avgTick=tot.tickets.length?Math.round(tot.tickets.reduce((a,b)=>a+b,0)/tot.tickets.length):null;
    const totFechDasCoorte=fechadas.filter(o=>novas.some(n=>n.id===o.id)).length;
    const totWr=tot.n?Math.round(totFechDasCoorte/tot.n*100):null;

    relMensalEl.innerHTML=`<table id="rel-mensal-table">
      <thead><tr>
        <th>Mês</th>
        <th title="Oportunidades com data de entrada neste mês">Novas</th>
        <th style="color:var(--verde)" title="Paisagismo">PAI</th>
        <th style="color:var(--urb)" title="Urbanismo">URB</th>
        <th style="color:var(--consul)" title="Consultorias">CNS</th>
        <th style="color:var(--esp)" title="Projetos Especiais">ESP</th>
        <th title="Oportunidades fechadas neste mês (por data de fechamento)">Fechamentos</th>
        <th title="% das opps originadas no mês que foram fechadas (coorte)">Win Rate ⓘ</th>
        <th title="Valor médio das opps fechadas no mês">Ticket médio</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid var(--cinza);background:var(--off)">
        <td><strong>Total ${anoFil}</strong></td>
        <td style="font-family:var(--font-mono);font-weight:700">${tot.n||'—'}</td>
        <td style="color:var(--verde);font-weight:700">${tot.PAIS||'—'}</td>
        <td style="color:var(--urb);font-weight:700">${tot.URB||'—'}</td>
        <td style="color:var(--consul);font-weight:700">${tot.CONSUL||'—'}</td>
        <td style="color:var(--esp);font-weight:700">${tot.ESP||'—'}</td>
        <td style="font-family:var(--font-mono);font-weight:700">${tot.fech||'—'}</td>
        <td>${totWr!==null?`<span style="font-family:var(--font-mono);font-weight:700;color:${totWr>=50?'var(--verde)':totWr<25?'var(--terracota)':'var(--ouro)'}">${totWr}%</span>`:'—'}</td>
        <td style="font-family:var(--font-mono);font-weight:700">${avgTick?fmt(avgTick):'—'}</td>
      </tr></tfoot>
    </table>`;
  } else if(relMensalEl){
    relMensalEl.innerHTML='<div style="font-size:10px;color:#aaa;padding:12px 16px">Selecione um ano específico para ver a tabela mensal.</div>';
  }

  // ── R4: Origem dos leads do período ──────────────────────────────
  const origMap2={};
  novas.forEach(o=>{
    const grp=o.origem||'Não informado';
    if(!origMap2[grp])origMap2[grp]={n:0,v:0};
    origMap2[grp].n++;
    origMap2[grp].v+=oppValorProposto(o);
  });
  const origSorted2=Object.entries(origMap2).sort((a,b)=>b[1].n-a[1].n);
  const maxN2=origSorted2[0]?.[1].n||1;
  const relOrigEl=document.getElementById('rel-origens');
  const relOrigTitle=document.getElementById('rel-orig-title');
  if(relOrigTitle)relOrigTitle.textContent=`Origem dos leads${anoFil!=='todos'?' · '+anoFil:''}`;
  if(relOrigEl){
    relOrigEl.innerHTML=origSorted2.length
      ?origSorted2.map(([k,{n,v}])=>`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:10px;margin-bottom:3px">
            <span style="font-weight:600">${escHtml(k)}</span>
            <span style="font-family:var(--font-mono);color:#666">${n} opp${n!==1?'s':''}&nbsp;·&nbsp;${fmt(v)}</span>
          </div>
          <div style="height:5px;background:var(--cinza2);border-radius:2px">
            <div style="height:100%;width:${Math.round(n/maxN2*100)}%;background:var(--ouro);border-radius:2px"></div>
          </div>
        </div>`).join('')
      :'<div style="font-size:10px;color:#aaa">Sem dados para o período.</div>';
  }
}

// ═══ INTEGRAÇÃO CALC ═════════════════════════════════
async function recarregarProposals() {
  try {
    let r = await sb.from('exp_proposals').select('proposal_id,projeto,cliente,cidade,uf,total,status,version,parent_id,prop_code,items,subs,desps,repasse,despbit,updated_at,data_json').order('created_at',{ascending:false});
    if (r.error) r = await sb.from('exp_proposals').select('proposal_id,projeto,cliente,cidade,uf,total,status,version,parent_id,items,subs,desps,repasse,updated_at,data_json').order('created_at',{ascending:false});
    if (!r.error && r.data) {
      allProposals = r.data.map(p => {
        let parsed = {};
        try { parsed = p?.data_json ? JSON.parse(p.data_json) : {}; } catch(e) {}
        return {
          ...p,
          clienteId: parsed?.clienteId || parsed?.cliente_id || null
        };
      });
    }
  } catch(e) {}
}

function populateCalcDropdown(selectedId) {
  const sel = document.getElementById('opp-calc-id');
  if (!sel) return;
  const currentOppId = document.getElementById('opp-id').value;
  const selectedProposal = allProposals.find(p => p.proposal_id === selectedId);
  const selectedFamilyRoot = selectedProposal ? (selectedProposal.parent_id || selectedProposal.proposal_id) : selectedId;

  // Raízes de família já vinculadas a OUTRAS oportunidades
  const linkedFamilyRoots = new Set();
  allOps.filter(o => o.proposta_calc_id && o.id !== currentOppId).forEach(o => {
    const linkedProp = allProposals.find(p => p.proposal_id === o.proposta_calc_id);
    const froot = linkedProp ? (linkedProp.parent_id || linkedProp.proposal_id) : o.proposta_calc_id;
    linkedFamilyRoots.add(froot);
  });

  // Agrupa propostas por família
  const familyMap = {};
  allProposals.forEach(p => {
    const fid = p.parent_id || p.proposal_id;
    if (!familyMap[fid]) familyMap[fid] = [];
    familyMap[fid].push(p);
  });
  // Ordena cada família: versão mais alta primeiro
  const families = Object.values(familyMap).map(fam => {
    fam.sort((a,b) => (b.version||0) - (a.version||0));
    return fam;
  }).sort((a,b) => {
    // Finalizadas primeiro, depois por proposal_id desc
    const aFin = a[0].status === 'finalizada' ? 0 : 1;
    const bFin = b[0].status === 'finalizada' ? 0 : 1;
    if (aFin !== bFin) return aFin - bFin;
    return b[0].proposal_id > a[0].proposal_id ? 1 : -1;
  });

  const famFinalizadas = families.filter(f => f[0].status === 'finalizada');
  const famOutras      = families.filter(f => f[0].status !== 'finalizada');

  const opts = ['<option value="">— Nenhuma proposta vinculada —</option>'];

  const _renderFamily = fam => {
    const latest  = fam[0];
    const froot   = latest.parent_id || latest.proposal_id;
    const ocupada = linkedFamilyRoots.has(froot);
    if (ocupada && String(froot) !== String(selectedFamilyRoot || '')) return;
    const codStr  = latest.prop_code
      ? `EXP-${String(latest.prop_code).padStart(3,'0')}`
      : `#${latest.proposal_id}`;
    const famLbl  = [latest.projeto||'Sem título', latest.cliente||''].filter(Boolean).join(' · ');
    const finTag  = latest.status === 'finalizada' ? ' ✓' : '';

    if (fam.length === 1) {
      const p      = fam[0];
      const verLbl = _verLabel(p.version||0);
      const lbl    = `${codStr}${finTag} · ${famLbl} — ${fmt(+p.total)} [${verLbl}]`;
      const isSel  = p.proposal_id === selectedId ? ' selected' : '';
      opts.push(`<option value="${escAttr(p.proposal_id)}"${isSel}>${lbl}</option>`);
    } else {
      opts.push(`<option disabled style="color:#aaa;font-size:10px">— ${codStr}${finTag} · ${famLbl}</option>`);
      fam.forEach((p, i) => {
        const verLbl = _verLabel(p.version||0);
        const isSel  = p.proposal_id === selectedId ? ' selected' : '';
        const star   = i === 0 ? ' ★' : '';
        const lbl    = `    ${verLbl} — ${fmt(+p.total)}${star}`;
        opts.push(`<option value="${escAttr(p.proposal_id)}"${isSel}>${lbl}</option>`);
      });
    }
  };

  if (famFinalizadas.length) {
    opts.push(`<option disabled style="font-size:10px;color:#2d8a4e;font-weight:700">── Propostas finalizadas ──────────────</option>`);
    famFinalizadas.forEach(_renderFamily);
  }
  if (famOutras.length) {
    opts.push(`<option disabled style="font-size:10px;color:#aaa">── Em andamento ───────────────────────</option>`);
    famOutras.forEach(_renderFamily);
  }

  sel.innerHTML = opts.join('');

  // Se selectedId não está em allProposals, adiciona como "arquivada"
  if (selectedId && !allProposals.find(p => p.proposal_id === selectedId)) {
    const extra = document.createElement('option');
    extra.value = selectedId;
    extra.selected = true;
    extra.textContent = '#' + selectedId + ' (proposta arquivada)';
    sel.insertBefore(extra, sel.firstChild.nextSibling);
  }
  onCalcPropostaChange();
}

function onCalcPropostaChange() {
  const sel = document.getElementById('opp-calc-id');
  const wrap = document.getElementById('opp-calc-autofill-wrap');
  if (!wrap || !sel) return;
  const isNew = !document.getElementById('opp-id').value;
  wrap.style.display = sel.value && isNew ? 'block' : 'none';
}

function autofillFromProposta() {
  const calcId = document.getElementById('opp-calc-id').value;
  if (!calcId) return;
  const p = allProposals.find(x => x.proposal_id === calcId);
  if (!p) return;
  if (p.projeto) document.getElementById('opp-projeto').value = p.projeto;
  if (p.cidade) document.getElementById('opp-cidade').value = p.cidade;
  if (p.uf) document.getElementById('opp-uf').value = p.uf;
  if (p.cliente) {
    const match = p.clienteId
      ? allClients.find(c => String(c.id) === String(p.clienteId))
      : allClients.find(c => (c.nome||'').toLowerCase() === p.cliente.toLowerCase());
    if (match) {
      document.getElementById('opp-cliente-id').value = match.id;
      document.getElementById('opp-cliente-text').value = match.nome;
      const sd = document.getElementById('opp-cliente-selecionado');
      sd.textContent = '✓ ' + match.nome; sd.style.display = 'block';
    } else if (!document.getElementById('opp-cliente-text').value) {
      document.getElementById('opp-cliente-text').value = p.cliente;
    }
  }
  document.getElementById('opp-calc-autofill-wrap').style.display = 'none';
  const verLblAf = _verLabel(p.version||0);
  toast(`Dados da proposta aplicados! (${verLblAf})`);
}

// importarProdutosFromProposta removida — vinculação agora é direta (sem cópia para tabela produtos)
async function importarProdutosFromProposta(oppId, calcId) {
  toast('Vinculação direta ativa — os itens da calculadora aparecem automaticamente.');
}

async function resetVinculoCalc(oppId) {
  if (!confirm('Isso vai remover os produtos importados anteriormente e recarregar os dados direto da calculadora. Continuar?')) return;
  // Remove produtos e custos antigos que vieram de importação manual
  const [delProd, delCusto] = await Promise.all([
    sb.from('produtos').delete().eq('oportunidade_id', oppId),
    sb.from('opp_custos').delete().eq('oportunidade_id', oppId).not('calc_ref', 'is', null),
  ]);
  if (delProd.error) { toast('Erro ao limpar produtos: ' + delProd.error.message); return; }
  // Recarrega propostas e dados para ter os items frescos
  await recarregarProposals();
  await carregarDados();
  renderPipe(); renderOrc();
  abrirDetail(oppId);
  toast('Vínculo atualizado — itens agora vêm direto da calculadora.');
}


async function carregarInfoPropostaCalc(calcId, oppId) {
  const el = document.getElementById('det-calc-info-' + oppId);
  if (!el) return;
  try {
    const {data, error} = await sb.from('exp_proposals')
      .select('proposal_id, projeto, total, status, version, parent_id, updated_at')
      .eq('proposal_id', calcId)
      .maybeSingle();
    if (error || !data) {
      const mem = allProposals.find(p => p.proposal_id === calcId);
      if (mem) {
        el.textContent = `${mem.projeto || '—'} · ${fmt(mem.total)} · ${_verLabel(mem.version||0)}`;
        el.style.color = 'var(--ouro)';
        el.title = 'Abra a calculadora para sincronizar';
      } else {
        el.textContent = '(proposta não sincronizada — abra a calculadora)';
        el.style.color = '#aaa';
      }
      return;
    }
    el.textContent = `${data.projeto || '—'} · ${fmt(data.total)} · ${_verLabel(data.version||0)}`;
    el.style.color = 'var(--verde)';
    // Avisa se existe revisão mais nova na família
    if (allProposals.length) {
      const froot = data.parent_id || data.proposal_id;
      const maisRecente = allProposals
        .filter(p => (p.parent_id || p.proposal_id) === froot)
        .sort((a,b) => (b.version||0) - (a.version||0))[0];
      if (maisRecente && (maisRecente.version||0) > (data.version||0)) {
        el.innerHTML += ` <span style="font-size:9px;background:#fff3cd;color:#856404;padding:1px 5px;border-radius:3px;font-weight:700">↑ ${_verLabel(maisRecente.version)} disponível</span>`;
      }
    }
  } catch(e) { el.textContent = '(erro ao carregar)'; }
}

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
      <textarea id="lemb-msg" rows="3" placeholder="Ex: Lembrete de preencher o reembolso mensal até sexta-feira." style="${_fs};resize:vertical;margin-bottom:16px"></textarea>
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
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
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

