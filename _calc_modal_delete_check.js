



  (function(){
    var saved = localStorage.getItem('exp-theme');
    var sys   = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(saved === 'dark' || (!saved && sys))
      document.documentElement.setAttribute('data-theme','dark');
  })();


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUBTIPOS COMPLETOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SUBS = {
  PAIS: {
    'Paisagismo de incorporaÃ§Ã£o': {
      'TÃ©rreo / Passeios':        { k:'PAIS_TERREO',  mode:'calc', coefBase:0.85, hint:'Coef. 0,8 a 1,0 conforme possibilidade de repetiÃ§Ã£o, complexidade e desnÃ­veis. MÃ­nimo R$ 17.280. CÃ¡lculo sobre mÂ².' },
      'Pavimento condominial / Ãtico': { k:'PAIS_CONDO', mode:'calc', coefBase:1.0, hint:'Coef. 0,9 a 1,3 conforme programa de necessidades, piscina e classe do empreendimento. MÃ­nimo R$ 24.000. CÃ¡lculo sobre mÂ².' },
      'Floreiras em fachadas':    { k:'PAIS_FLOREIRA', mode:'floreira', coefBase:null, hint:'Cobrado em mÃºltiplos de CUB (mÃ­n. 2 CUB). Selecione a quantidade de 0,25 em 0,25.' },
    },
    'Paisagismo urbano': {
      'ArborizaÃ§Ã£o viÃ¡ria':       { k:'PAIS_ARB',     mode:'calc', coefBase:0.085, hint:'Multiplicador fixo de 0,085 sobre a SuperfÃ­cie de ViÃ¡rio (SV). MÃ­nimo R$ 17.280. Informe a Ã¡rea de SV em mÂ². O coeficiente nÃ£o Ã© aplicado.' },
      'Streetscape':              { k:'PAIS_STREET',  mode:'calc', coefBase:0.2, hint:'Coef. 0,2 como base. MÃ­nimo R$ 17.280. CÃ¡lculo sobre mÂ².' },
      'EspaÃ§o pÃºblico â€” Parque / PraÃ§a': { k:'PAIS_PARQUE', mode:'calc', coefBase:0.5, hint:'Coef. 0,4 a 0,6 conforme complexidade. MÃ­nimo R$ 24.000. CÃ¡lculo sobre mÂ².' },
      'EspaÃ§o pÃºblico â€” Parque baixo impacto': { k:'PAIS_PARQUE_BAIXO', mode:'calc', coefBase:0.25, hint:'Coef. 0,25 (base). MÃ­nimo R$ 24.000. Parques de baixa intervenÃ§Ã£o. CÃ¡lculo sobre mÂ².' },
    },
    'Paisagismo residencial': {
      'TÃ©rreo / Passeios':        { k:'PAIS_RES_TERREO', mode:'calc', coefBase:0.9, hint:'Coef. 0,8 a 1,2. MÃ­nimo R$ 17.280. CÃ¡lculo sobre mÂ².' },
      'EspaÃ§o sobre laje':        { k:'PAIS_RES_LAJE',   mode:'calc', coefBase:1.0, hint:'Coef. 0,9 a 1,3 conforme complexidade. MÃ­nimo R$ 17.280. CÃ¡lculo sobre mÂ².' },
    },
  },
  URB: {
    'ConceituaÃ§Ã£o':               { k:'URB_CONCEITO', mode:'calc',    coefBase:3, hint:'Cobrado em mÃºltiplos de CUB: de 2 a 5 CUB. Informe no campo Coef. o nÃºmero de CUBs. NÃ£o vinculado a Ã¡rea.' },
    'Estudo de Viabilidade':      { k:'URB_VIAB',     mode:'calc',    coefBase:0.30, hint:'Coef. 0,25 a 0,40. MÃ­nimo R$ 15.000. CÃ¡lculo sobre ha.' },
    'Masterplan':                 { k:'URB_MASTER',   mode:'calc',    coefBase:1.0, hint:'Coef. 0,8 a 1,2. Bairro agrega valor. MÃ­nimo R$ 20.000. CÃ¡lculo sobre ha.' },
    'Projeto UrbanÃ­stico':        { k:'URB_PROJETO',  mode:'calc',    coefBase:0.7, hint:'Coef. 0,5 a 0,9. Bairro agrega valor. MÃ­nimo R$ 15.000. CÃ¡lculo sobre ha.' },
    'Desmembramento / UnificaÃ§Ã£o':{ k:'URB_DESM',     mode:'calc',    coefBase:0.10, hint:'Coef. 0,10. MÃ­nimo R$ 12.000. CÃ¡lculo sobre ha.' },
    'Imagens Renderizadas':       { k:'URB_IMG',      mode:'livre',   coefBase:null, hint:'Valor aberto â€” insira o valor final acordado. MÃ­nimo R$ 10.000.' },
    'Charrete Design':            { k:'URB_CHARRETE', mode:'livre',   coefBase:null, hint:'Valor fixo: R$ 30.000 a R$ 100.000. Insira o valor final acordado.' },
  },
  CONSUL: {
    'Por hora tÃ©cnica':           { k:'CONSUL_HORA',   mode:'consul', coefBase:null },
    'Retainer mensal':            { k:'CONSUL_MENSAL', mode:'consul', coefBase:null },
  },
  ESP: {
    'Projeto especial':           { k:'ESP_LIVRE', mode:'esp', coefBase:null },
  },
};

const NC  = { PAIS:'Paisagismo', URB:'Urbanismo', CONSUL:'Consultoria', ESP:'Proj. Especial' };
const NBADGE = { PAIS:'b-vd', URB:'b-az', CONSUL:'b-tc', ESP:'b-am' };
const NCOR  = { PAIS:'var(--verde)', URB:'var(--az)', CONSUL:'var(--tc)', ESP:'var(--am)' };

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ESTADO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let S = {
  cub: 3028.45, cubMes: '2026-03',
  cubHist: [{ val: 3028.45, mes: '2026-03', by: 'Sistema', at: '2026-03-20' }],
  fP: [
    { max:300,   mult:.03,   label:'A â€” atÃ© 300 mÂ²' },
    { max:800,   mult:.01,   label:'B â€” 301 a 800 mÂ²' },
    { max:5000,  mult:.004,  label:'C â€” 801 a 5.000 mÂ²' },
    { max:10000, mult:.003,  label:'D â€” 5.001 a 10.000 mÂ²' },
    { max:null,  mult:.0025, label:'E â€” acima de 10.000 mÂ²' },
  ],
  fU: [
    { max:5,    mult:.00015, label:'A â€” atÃ© 5 ha' },
    { max:20,   mult:.00013, label:'B â€” 5 a 20 ha' },
    { max:50,   mult:.00009, label:'C â€” 20 a 50 ha' },
    { max:100,  mult:.00006, label:'D â€” 50 a 100 ha' },
    { max:250,  mult:.00004, label:'E â€” 100 a 250 ha' },
    { max:null, mult:.00001, label:'F â€” acima de 250 ha' },
  ],
  mins: {
    PAIS_TERREO:17280, PAIS_CONDO:24000, PAIS_FLOREIRA:0,
    PAIS_ARB:17280, PAIS_STREET:17280, PAIS_PARQUE:24000, PAIS_PARQUE_BAIXO:24000,
    PAIS_RES_TERREO:17280, PAIS_RES_LAJE:17280,
    URB_CONCEITO:0, URB_VIAB:15000, URB_MASTER:20000,
    URB_PROJETO:15000, URB_DESM:12000, URB_IMG:10000, URB_CHARRETE:30000,
    CONSUL_HORA:0, CONSUL_MENSAL:0,
  },
  params: { diaria:680, gas:6.20, car:180 },
  etapas: {
    PAIS: { default: ['Briefing','Estudo Conceitual','Estudo Preliminar','Estudo Ajustado','Anteprojeto','Projeto Executivo','Liberado para Obra'] },
    URB:  { default: ['Briefing','Estudo Conceitual','Estudo Preliminar','Estudo Ajustado','Anteprojeto','Projeto Executivo','Liberado para Obra'] },
    CONSUL: { default: ['Briefing','AnÃ¡lise tÃ©cnica','Entrega'] },
    ESP:    { default: ['Briefing','DiagnÃ³stico','Diretrizes','RelatÃ³rio final'] },
  },
  distEtapas: {
    PAIS: { default: [5,15,20,15,20,20,5] },
    URB:  { default: [5,15,20,15,20,20,5] },
    CONSUL: { default: [10,50,40] },
    ESP:    { default: [10,30,40,20] },
  },
  proposals: [],
  clientes: [],
  cidades: [],
  crmClients: [],
  crmLinkedProposalRoots: [],
  calcParamsId: null,
  sbUrl: '',
  sbKey: '',
  propCodeSeq: 0,
  histSoAativas: false,
};

let cItems = [], cDesps = [], cSubs = [], cRepasse = null;
let currentNucleo = 'PAIS';
let evItemId = null;
let editEtapaNucleo = 'PAIS', editEtapaChave = 'default';
let dSeq = 1;
// ID da proposta sendo editada (revisÃ£o)
let editingProposalId = null;
// C12/K4 â€” link CRM
let linkedOppInfo  = null;   // { id, projeto, prods: [{nucleo, subtipo, status}] }
let lockedNucleos  = new Set(); // nucleos travados (prod fechado/negado)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORAGE LOCAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function save() {
  try { localStorage.setItem('exp_calc_v4', JSON.stringify({ S, cItems, cDesps, cSubs, cRepasse, editingProposalId })); } catch(e){}
}
function load() {
  try {
    const r = localStorage.getItem('exp_calc_v4');
    if (!r) return;
    const d = JSON.parse(r);
    if (d.S) {
      // CALC-3+4: merge profundo â€” preserva nucleos URB/CONSUL/ESP ausentes em dados antigos
      const defEtapas = S.etapas;
      const defDist   = S.distEtapas;
      S = { ...S, ...d.S };
      S.etapas     = { ...defEtapas,    ...(d.S.etapas     || {}) };
      S.distEtapas = { ...defDist,      ...(d.S.distEtapas || {}) };
    }
    if (d.cItems) cItems = d.cItems;
    if (d.cDesps) cDesps = d.cDesps;
    if (d.cSubs)  cSubs  = d.cSubs;
    if (d.cRepasse !== undefined) cRepasse = d.cRepasse;
    if (d.editingProposalId !== undefined) editingProposalId = d.editingProposalId;
    refreshProposalCaches();
  } catch(e) {}
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUPABASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function refreshProposalCaches() {
  const maxPropCode = S.proposals.reduce((max, p) => {
    const code = Number(p?.propCode);
    return Number.isFinite(code) ? Math.max(max, code) : max;
  }, 0);
  S.propCodeSeq = Math.max(Number(S.propCodeSeq) || 0, maxPropCode);
  S.proposals.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
  const allClientes = S.proposals.map(p => p?.cliente).filter(Boolean);
  const allCidades = S.proposals.map(p => p?.cidade).filter(Boolean);
  const crmClientes = (S.crmClients || []).map(c => c?.nome).filter(Boolean);
  const crmCidades = (S.crmClients || []).map(c => c?.cidade).filter(Boolean);
  S.clientes = [...new Set([...S.clientes, ...crmClientes, ...allClientes])].sort();
  S.cidades = [...new Set([...S.cidades, ...crmCidades, ...allCidades])].sort();
}

function normalizeProposalFromRow(row) {
  let parsed = {};
  try {
    parsed = row?.data_json ? JSON.parse(row.data_json) : {};
  } catch(e) {}

  const normalized = {
    ...parsed,
    id: row?.proposal_id ?? parsed.id ?? Date.now(),
    version: row?.version ?? parsed.version ?? 0,
    propCode: row?.prop_code ?? parsed.propCode ?? null,
    parentId: row?.parent_id ?? parsed.parentId ?? null,
    status: row?.status ?? parsed.status ?? 'ativa',
    cliente: row?.cliente ?? parsed.cliente ?? '',
    clienteId: parsed.clienteId ?? parsed.cliente_id ?? null,
    projeto: row?.projeto ?? parsed.projeto ?? '',
    resp: row?.resp ?? parsed.resp ?? '',
    cidade: row?.cidade ?? parsed.cidade ?? '',
    uf: row?.uf ?? parsed.uf ?? '',
    obs: row?.obs ?? parsed.obs ?? '',
    data: row?.data_proposta ?? parsed.data ?? '',
    mainNucleo: row?.main_nucleo ?? parsed.mainNucleo ?? '',
    total: row?.total ?? parsed.total ?? 0,
    createdAt: row?.created_at ?? parsed.createdAt ?? null,
    _sbUpdatedAt: row?.updated_at ?? parsed._sbUpdatedAt ?? null,
  };

  if ('items' in (row || {})) normalized.items = row.items ?? [];
  if ('desps' in (row || {})) normalized.desps = row.desps ?? [];
  if ('subs' in (row || {})) normalized.subs = row.subs ?? [];
  if ('repasse' in (row || {})) normalized.repasse = row.repasse ?? null;
  if ('despbit' in (row || {})) normalized.despBit = row.despbit ?? 0;

  return normalized;
}

function normTxt(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getClienteInput() {
  return document.getElementById('f-cliente');
}

function clearClienteSelectionMeta() {
  const inp = getClienteInput();
  if (inp) delete inp.dataset.clienteId;
}

function setClienteSelectionMeta(cliente) {
  const inp = getClienteInput();
  if (!inp) return;
  if (cliente?.id) inp.dataset.clienteId = cliente.id;
  else delete inp.dataset.clienteId;
}

function findSharedClientById(id) {
  if (!id) return null;
  return (S.crmClients || []).find(c => String(c.id) === String(id)) || null;
}

function findSharedClientByName(nome) {
  const alvo = normTxt(nome);
  if (!alvo) return null;
  return (S.crmClients || []).find(c => normTxt(c.nome) === alvo) || null;
}

async function ensureSharedClientForProposal(proposal) {
  if (!proposal?.cliente) return proposal;

  let shared = proposal.clienteId ? findSharedClientById(proposal.clienteId) : null;
  if (!shared) shared = findSharedClientByName(proposal.cliente);

  if (shared) {
    proposal.clienteId = shared.id;
    proposal.cliente = shared.nome || proposal.cliente;
    setClienteSelectionMeta(shared);
    return proposal;
  }

  if (!S.sbUrl || !S.sbKey) return proposal;

  try {
    const r = await fetch(S.sbUrl + '/rest/v1/clientes', {
      method: 'POST',
      headers: {
        ...getSBHeaders(),
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        nome: proposal.cliente
      })
    });
    if (!r.ok) {
      console.warn('Falha ao compartilhar cliente da proposta:', r.status, await r.text());
      return proposal;
    }
    const rows = await r.json();
    const created = Array.isArray(rows) ? rows[0] : rows;
    if (created?.id) {
      proposal.clienteId = created.id;
      proposal.cliente = created.nome || proposal.cliente;
      S.crmClients = [...(S.crmClients || []).filter(c => String(c.id) !== String(created.id)), created]
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      refreshProposalCaches();
      save();
      setClienteSelectionMeta(created);
    }
  } catch (e) {
    console.warn('Falha ao criar cliente institucional a partir da Calc:', e);
  }

  return proposal;
}

async function syncCalcProposalAlertsFromCRM() {
  if (!S.sbUrl || !S.sbKey) return;
  try {
    /* Usa token autenticado para passar pelo RLS da tabela oportunidades */
    const r = await fetch(
      S.sbUrl + '/rest/v1/oportunidades?select=proposta_calc_id&proposta_calc_id=not.is.null',
      { headers: getSBHeaders(true) }
    );
    if (!r.ok) return;
    const rows = await r.json();
    const linkedRoots = new Set();
    (rows || []).forEach(row => {
      const pid = String(row?.proposta_calc_id || '').trim();
      if (!pid) return;
      /* Tenta achar a proposta pelo id (UUID) ou pelo proposal_id salvo na famÃ­lia */
      const match = S.proposals.find(p =>
        String(p.id) === pid ||
        (p.parentId && String(p.parentId) === pid)
      );
      /* Raiz da famÃ­lia: parentId (se Ã© revisÃ£o) ou id (se Ã© original) */
      const root = match ? String(match.parentId || match.id) : pid;
      linkedRoots.add(root);
    });
    S.crmLinkedProposalRoots = [...linkedRoots];
    save();
  } catch (e) {}
}

function isProposalFamilyLinkedToCRM(proposal) {
  const fid = String(proposal?.parentId || proposal?.id || '');
  if (!fid) return false;
  return (S.crmLinkedProposalRoots || []).includes(fid);
}

function getProposalFamilyId(proposal) {
  return String(proposal?.parentId || proposal?.id || '');
}

async function fetchLatestCalcParamsRow() {
  if (!S.sbUrl || !S.sbKey) return null;
  const r = await fetch(`${S.sbUrl}/rest/v1/calc_params?select=*&order=updated_at.desc,id.desc&limit=1`, {
    headers: getSBHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return d?.[0] || null;
}

function getSBHeaders(withAuth) {
  /* Tenta usar o token de sessÃ£o do usuÃ¡rio logado na plataforma EXP.
     Isso permite acesso a tabelas com RLS que requerem autenticaÃ§Ã£o. */
  let token = S.sbKey;
  if (withAuth) {
    try {
      const sb = JSON.parse(
        localStorage.getItem('sb-pgnydwsjntaezdhkgvpu-auth-token') || '{}'
      );
      const at = sb?.access_token || sb?.currentSession?.access_token;
      if (at) token = at;
    } catch(e) {}
  }
  return {
    'Content-Type': 'application/json',
    'apikey': S.sbKey,
    'Authorization': 'Bearer ' + token,
    'Prefer': 'return=minimal'
  };
}

function saveSBConfig() {
  S.sbUrl = document.getElementById('sb-url').value.trim();
  S.sbKey = document.getElementById('sb-key').value.trim();
  save();
}

async function testSupabase() {
  const el = document.getElementById('sb-status');
  if (!S.sbUrl || !S.sbKey) { el.textContent='Preencha URL e Key antes de testar.'; el.style.color='var(--tc)'; return; }
  el.textContent = 'Testando...';
  el.style.color = '';
  try {
    const r = await fetch(S.sbUrl + '/rest/v1/exp_proposals?limit=1', { headers: getSBHeaders() });
    if (r.ok || r.status===200) {
      el.textContent = 'ConexÃ£o OK';
      el.style.color = 'var(--verde)';
      setSyncStatus('ok');
      return;
    }
    const txt = await r.text();
    el.textContent = `Erro ${r.status}: ${txt.slice(0,120)}`;
    el.style.color = 'var(--tc)';
    setSyncStatus('err');
    return;
  } catch(e) {
    el.textContent = `Falha de rede: ${e.message}`;
    el.style.color = 'var(--tc)';
    setSyncStatus('err');
    return;
  }
}

function setSyncStatus(st, msg) {
  const dot = document.getElementById('sync-dot');
  const lbl = document.getElementById('sync-lbl');
  if (!dot) return;
  dot.className = 'sync-dot ' + (st||'');
  lbl.textContent = msg || (st==='ok'?'nuvem':st==='err'?'erro sync':st==='sync'?'sincronizando':'local');
}

async function syncProposalToSupabase(proposal) {
  if (!S.sbUrl || !S.sbKey) return false;
  setSyncStatus('sync', 'salvando...');
  try {
    // Payload mÃ­nimo â€” colunas que existem desde a criaÃ§Ã£o da tabela
    const corePayload = {
      proposal_id: String(proposal.id),
      version:     proposal.version || 1,
      parent_id:   proposal.parentId ? String(proposal.parentId) : null,
      status:      proposal.status || 'ativa',
      cliente:     proposal.cliente || '',
      projeto:     proposal.projeto || '',
      cidade:      proposal.cidade || '',
      uf:          proposal.uf || '',
      total:       proposal.total || 0,
      data_json:   JSON.stringify(proposal),
      created_at:  proposal.createdAt || new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    };

    // Payload estendido â€” inclui colunas adicionadas via migration
    // AtenÃ§Ã£o: despbit em minÃºsculo para corresponder ao nome PostgreSQL (unquoted â†’ lowercase)
    const extPayload = {
      ...corePayload,
      resp:          proposal.resp        || '',
      obs:           proposal.obs         || '',
      data_proposta: proposal.data        || null,
      main_nucleo:   proposal.mainNucleo  || '',
      items:         proposal.items       || [],
      desps:         proposal.desps       || [],
      subs:          proposal.subs        || [],
      repasse:       proposal.repasse     || null,
      despbit:       proposal.despBit     ?? 0,
      prop_code:     proposal.propCode    || null,
    };

    const upsertUrl = S.sbUrl + '/rest/v1/exp_proposals?on_conflict=proposal_id';
    const upsertHeaders = { ...getSBHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' };

    const trySync = async (payload) => {
      const r = await fetch(upsertUrl, { method: 'POST', headers: upsertHeaders, body: JSON.stringify(payload) });
      return r;
    };

    // Tentativa 1: payload completo
    let payload = extPayload;
    let r = await trySync(payload);

    // Tentativa 2: se 400, loga o erro real e tenta sem prop_code
    if (!r.ok && (r.status === 400 || r.status === 422)) {
      const errText = await r.text();
      console.warn('Supabase sync 400 detalhe:', errText);
      const { prop_code, ...semPropCode } = payload;
      payload = semPropCode;
      r = await trySync(payload);
    }

    // Tentativa 3: fallback para payload mÃ­nimo (apenas colunas originais)
    if (!r.ok && (r.status === 400 || r.status === 422)) {
      const errText2 = r.bodyUsed ? '' : await r.text();
      if (errText2) console.warn('Supabase sync 400 fallback detalhe:', errText2);
      payload = corePayload;
      r = await trySync(payload);
    }

    if (r.ok || r.status === 201 || r.status === 200 || r.status === 204) {
      if (payload === corePayload) {
        console.warn('Supabase sync parcial: payload mÃ­nimo salvo, colunas estruturadas podem ter ficado defasadas.');
        setSyncStatus('err', 'sync parcial');
        return false;
      }
      proposal._sbUpdatedAt = payload.updated_at;
      setSyncStatus('ok', 'nuvem');
      return true;
    } else {
      const txt = r.bodyUsed ? '(sem detalhe)' : await r.text();
      console.warn('Supabase sync erro final:', r.status, txt);
      setSyncStatus('err', 'erro sync');
      return false;
    }
  } catch(e) {
    console.warn('Supabase sync exception:', e);
    setSyncStatus('err', 'sem rede');
    return false;
  }
}

async function loadProposalsFromSupabase() {
  if (!S.sbUrl || !S.sbKey) return;
  setSyncStatus('sync', 'buscando...');
  try {
    const r = await fetch(S.sbUrl + '/rest/v1/exp_proposals?order=created_at.desc&limit=500', { headers: getSBHeaders() });
    if (!r.ok) { setSyncStatus('err','erro sync'); return; }
    const rows = await r.json();
    // Merge: banco Ã© fonte primÃ¡ria â€” atualiza existentes e adiciona novos
    const localMap = new Map(S.proposals.map(p=>[String(p.id), p]));
    let changed = 0;
    rows.forEach(row => {
      try {
        // Usa colunas jsonb estruturadas se disponÃ­veis (K6), senÃ£o parse data_json
        const p = normalizeProposalFromRow(row);
        const existing = localMap.get(row.proposal_id);
        if (!existing) {
          S.proposals.push(p);
          localMap.set(row.proposal_id, p);
          changed++;
        } else if ((row.updated_at || '') > (existing._sbUpdatedAt || '')) {
          // Atualiza campos essenciais da proposta existente com dados do banco
          Object.assign(existing, p);
          changed++;
        }
      } catch(e){}
    });
    refreshProposalCaches();
    if (changed > 0) save();
    setSyncStatus('ok','nuvem');
    if (document.getElementById('tab-hist').classList.contains('active')) renderHist();
    // Sincroniza clientes e cidades com a tabela do CRM (silencioso)
    syncClientesFromCRM();
    syncCalcProposalAlertsFromCRM().then(() => {
      if (document.getElementById('tab-hist').classList.contains('active')) renderHist();
    });
  } catch(e) {
    setSyncStatus('err','sem rede');
  }
}

async function syncClientesFromCRM() {
  if (!S.sbUrl || !S.sbKey) return;
  try {
    const r = await fetch(S.sbUrl + '/rest/v1/clientes?select=id,nome,sigla,cidade,uf&order=nome', { headers: getSBHeaders() });
    if (!r.ok) return;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return;
    S.crmClients = rows.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    const nomescrm  = rows.map(c => c.nome).filter(Boolean);
    const cidadescrm = rows.map(c => c.cidade).filter(Boolean);
    const antesC = S.clientes.length, antesD = S.cidades.length;
    S.clientes = [...new Set([...S.clientes, ...nomescrm])].sort();
    S.cidades  = [...new Set([...S.cidades,  ...cidadescrm])].sort();
    if (S.clientes.length !== antesC || S.cidades.length !== antesD) save();
  } catch(e) {}
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// C12/K4 â€” STATUS DO CRM PARA PROPOSTA VINCULADA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function checkCRMLinkStatus(proposalId) {
  linkedOppInfo = null;
  lockedNucleos = new Set();
  if (!S.sbUrl || !S.sbKey || !proposalId) return;
  try {
    // Busca oportunidade vinculada a esta proposta
    const rOpp = await fetch(
      S.sbUrl + '/rest/v1/oportunidades?proposta_calc_id=eq.' + proposalId + '&limit=1',
      { headers: getSBHeaders() }
    );
    if (!rOpp.ok) return;
    const opps = await rOpp.json();
    if (!opps.length) return;
    const opp = opps[0];
    // Busca produtos desta oportunidade
    const rProd = await fetch(
      S.sbUrl + '/rest/v1/produtos?oportunidade_id=eq.' + opp.id + '&select=id,nucleo,subtipo,status',
      { headers: getSBHeaders() }
    );
    if (!rProd.ok) return;
    const prods = await rProd.json();
    linkedOppInfo = { id: opp.id, projeto: opp.projeto || 'â€”', prods };
    // Trava nÃºcleos cujos produtos estÃ£o em status final (fechado ou negado)
    prods.forEach(p => {
      const st = (p.status || '').toLowerCase();
      if (st === 'fechado' || st === 'negado') lockedNucleos.add(p.nucleo);
    });
  } catch(e) {}
}

async function atualizarStatusCRM() {
  if (!editingProposalId) return;
  const btn = document.getElementById('btn-check-crm');
  if (btn) { btn.textContent = 'âŸ³ verificando...'; btn.disabled = true; }
  await checkCRMLinkStatus(editingProposalId);
  calcResumo();
  if (btn) { btn.textContent = 'â†» Atualizar status'; btn.disabled = false; }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UTILS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const fmt = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtM = ym => { if(!ym)return'â€”'; const[y,m]=ym.split('-'); const ms=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return`${ms[+m-1]}/${y}`; };
const fmtD = d => d ? d.split('-').reverse().join('/') : 'â€”';
const escHtml = v => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const escAttr = escHtml;
const escJsStr = v => String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n');
const escRegex = v => String(v??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function showToast(m) { const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500); }
function showBlocked(m) { const t=document.getElementById('blocked');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500); }
function abrirPopupConfirm(titulo, mensagem, onConfirm, btnLabel = 'Excluir') {
  const existing = document.getElementById('popup-confirm-overlay');
  if (existing) existing.remove();
  const btnBg = btnLabel === 'Excluir' ? 'var(--terracota)' : 'var(--verde)';
  const popup = document.createElement('div');
  popup.id = 'popup-confirm-overlay';
  popup.style.cssText = 'position:fixed;inset:0;background:var(--overlay-bg);z-index:9999;display:flex;align-items:center;justify-content:center';
  popup.innerHTML = `<div style="background:var(--branco);border-radius:10px;padding:24px 28px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.18)">
    <div style="font-size:14px;font-weight:600;margin-bottom:8px">${titulo}</div>
    <div style="font-size:12px;color:#666;margin-bottom:20px;line-height:1.5">${mensagem}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="document.getElementById('popup-confirm-overlay').remove()" style="padding:6px 16px;border:1px solid var(--cinza);border-radius:6px;font-size:12px;cursor:pointer;background:var(--branco);font-family:var(--font-ui)">Cancelar</button>
      <button id="popup-confirm-btn" style="padding:6px 16px;border:none;border-radius:6px;font-size:12px;cursor:pointer;background:${btnBg};color:#fff;font-family:var(--font-ui);font-weight:600">${btnLabel}</button>
    </div></div>`;
  document.body.appendChild(popup);
  document.getElementById('popup-confirm-btn').onclick = async () => { popup.remove(); await onConfirm(); };
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
}
function closeM(id) { document.getElementById(id).classList.remove('open'); }
function openM(id)  { document.getElementById(id).classList.add('open'); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NAVEGAÃ‡ÃƒO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function goTab(t) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ntab').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  const activeTab = document.querySelector(`.ntab[data-tab="${t}"]`);
  if(activeTab) activeTab.classList.add('active');
  if(t==='hist'){ renderHist(); loadProposalsFromSupabase(); }
  if(t==='params') renderParams();
  if(t==='base') renderBase();
}

function renderBase() {
  // CUB
  document.getElementById('base-cub-val').textContent = S.cub ? fmt(S.cub) : 'â€”';
  document.getElementById('base-cub-mes').textContent = S.cubMes ? `ReferÃªncia: ${S.cubMes}` : 'Nenhum CUB cadastrado';

  // Faixas Paisagismo
  const faixaRow = (f,i,unid) => `<div style="display:grid;grid-template-columns:1fr 1fr 2fr 80px;gap:6px;padding:5px 0;border-bottom:1px solid var(--cinza2);font-size:11px;align-items:center">
    <span style="color:#888">${i===0?'atÃ©':f.min!=null?fmt(f.min):'â€”'} ${unid}</span>
    <span style="color:#888">${f.max!=null?fmt(f.max)+' '+unid:'sem limite'}</span>
    <span>${f.desc||''}</span>
    <span style="font-family:var(--font-mono);font-weight:600;text-align:right">Ã— ${f.mult}</span>
  </div>`;
  const hdrFaixa = `<div style="display:grid;grid-template-columns:1fr 1fr 2fr 80px;gap:6px;padding:3px 0;border-bottom:1px solid var(--cinza);font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#999">
    <div>De</div><div>AtÃ©</div><div>DescriÃ§Ã£o</div><div style="text-align:right">Mult.</div>
  </div>`;
  document.getElementById('base-faixas-pais').innerHTML = S.fP.length
    ? hdrFaixa + S.fP.map((f,i)=>faixaRow(f,i,'mÂ²')).join('') + `<div style="font-size:10px;color:#888;margin-top:6px">FÃ³rmula: Î£ (faixa Ã— mult Ã— CUB) Ã— coef Â· CUB atual: <strong>${S.cub?fmt(S.cub):'â€”'}</strong></div>`
    : '<div class="empty">Nenhuma faixa cadastrada</div>';
  document.getElementById('base-faixas-urb').innerHTML = S.fU.length
    ? hdrFaixa + S.fU.map((f,i)=>faixaRow(f,i,'ha')).join('') + `<div style="font-size:10px;color:#888;margin-top:6px">FÃ³rmula: Î£ (faixa Ã— mult Ã— CUB) Ã— coef Â· CUB atual: <strong>${S.cub?fmt(S.cub):'â€”'}</strong></div>`
    : '<div class="empty">Nenhuma faixa cadastrada</div>';

  // Repasse
  document.getElementById('base-repasse-info').innerHTML =
    `<span style="color:#555">Valor do repasse</span> = total_EXP Ã— pct%<br>
     <span style="font-size:10px;color:#888">Configurado individualmente em cada proposta. O repasse Ã© somado ao total e cobrado do cliente â€” o nome do indicador fica registrado na proposta.</span>`;

  // MÃ­nimos
  const NC2 = { PAIS_PLEN:'PAIS Pleno', PAIS_EXEC:'PAIS Exec.', PAIS_ARB:'PAIS Arb.', PAIS_FLOREIRA:'PAIS Floreira',
                 URB_PLEN:'URB Pleno', URB_EXEC:'URB Exec.', URB_CONCEITO:'URB Conceito' };
  const mins = Object.entries(S.mins||{}).filter(([,v])=>v>0);
  document.getElementById('base-mins').innerHTML = mins.length
    ? mins.map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--cinza2);font-size:11px">
        <span style="color:#555">${NC2[k]||k}</span>
        <span style="font-family:var(--font-mono);font-weight:600">${fmt(v)}</span>
      </div>`).join('')
    : '<div class="empty">Nenhum mÃ­nimo cadastrado</div>';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CUB
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function updateCubDisplay() {
  const v = S.cub ? fmt(S.cub) : 'â€”';
  document.getElementById('cub-val').textContent = v;
  document.getElementById('cub-mes').textContent = S.cub ? fmtM(S.cubMes) : 'NÃ£o cadastrado';
  // nav-cub removido (Sprint B)
}
function toggleCubEdit() {
  const e = document.getElementById('cub-edit');
  e.style.display = e.style.display==='none' ? 'block' : 'none';
}
function salvarCUB() {
  const v = parseFloat(document.getElementById('cub-inp').value);
  const m = document.getElementById('cub-mes-inp').value;
  if(!v||!m){ showBlocked('Informe valor e mÃªs'); return; }
  S.cub = v; S.cubMes = m;
  S.cubHist.unshift({ val:v, mes:m, by:'UsuÃ¡rio', at:new Date().toISOString().slice(0,10) });
  updateCubDisplay();
  document.getElementById('cub-edit').style.display = 'none';
  cItems.forEach(it=>{ if(it.mode==='calc'||it.mode==='floreira') it.valorCalc = calcIV(it); });
  calcResumo(); save(); saveParamsToSupabase(); showToast('CUB atualizado â€” proposta recalibrada');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTOCOMPLETE CLIENTE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function buscarCliente(q) {
  const list = document.getElementById('ac-list');
  if (!q || q.length < 2) { list.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const crmMatches = (S.crmClients || [])
    .filter(c => (c.nome || '').toLowerCase().includes(ql))
    .slice(0, 8);
  const fallback = S.clientes
    .filter(c => c.toLowerCase().includes(ql) && !crmMatches.some(cli => cli.nome === c))
    .slice(0, Math.max(0, 8 - crmMatches.length))
    .map(nome => ({ nome }));
  const matches = [...crmMatches, ...fallback];
  const hasExact = matches.some(c => (c.nome || '').toLowerCase() === ql);
  const rx = new RegExp(`(${escRegex(q)})`, 'gi');
  let html = matches.map(c => {
    const nome = c.nome || '';
    const hi = escHtml(nome).replace(rx, '<mark>$1</mark>');
    const loc = c.cidade ? ` <span style="color:#999">${escHtml(c.cidade)}${c.uf ? '/' + escHtml(c.uf) : ''}</span>` : '';
    if (c.id) {
      return `<div class="ac-item" onclick="selecionarClienteById('${escJsStr(c.id)}')">${hi}${loc}</div>`;
    }
    return `<div class="ac-item" onclick="selecionarCliente('${escJsStr(nome)}')">${hi}</div>`;
  }).join('');
  if (!hasExact) html += `<div class="ac-item ac-new" onclick="novoCliente('${escJsStr(q)}')">+ Criar "${escHtml(q)}"</div>`;
  list.innerHTML = html;
  list.classList.add('open');
}
function selecionarClienteById(id) {
  const cliente = findSharedClientById(id);
  if (!cliente) return;
  document.getElementById('f-cliente').value = cliente.nome || '';
  setClienteSelectionMeta(cliente);
  document.getElementById('ac-list').classList.remove('open');
}
function selecionarCliente(nome) {
  document.getElementById('f-cliente').value = nome;
  clearClienteSelectionMeta();
  document.getElementById('ac-list').classList.remove('open');
}
function novoCliente(nome) {
  if (!S.clientes.includes(nome)) { S.clientes.push(nome); S.clientes.sort(); }
  clearClienteSelectionMeta();
  selecionarCliente(nome);
  showToast(`Cliente "${nome}" serÃ¡ compartilhado ao salvar a proposta`);
}
function buscarCidade(q) {
  const list = document.getElementById('ac-cidade-list');
  if (!q || q.length < 2) { list.classList.remove('open'); return; }
  const ql = q.toLowerCase();
  const matches = S.cidades.filter(c => c.toLowerCase().includes(ql)).slice(0, 8);
  if (!matches.length) { list.classList.remove('open'); return; }
  const rx = new RegExp(`(${escRegex(q)})`, 'gi');
  list.innerHTML = matches.map(c => {
    const hi = escHtml(c).replace(rx, '<mark>$1</mark>');
    return `<div class="ac-item" onclick="selecionarCidade('${escJsStr(c)}')">${hi}</div>`;
  }).join('');
  list.classList.add('open');
}
function selecionarCidade(nome) {
  document.getElementById('f-cidade').value = nome;
  document.getElementById('ac-cidade-list').classList.remove('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.fgroup')) {
    document.getElementById('ac-list').classList.remove('open');
    document.getElementById('ac-cidade-list').classList.remove('open');
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NÃšCLEO E SUBTIPOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function selNucleo(n) {
  currentNucleo = n;
  ['PAIS','URB','CONSUL','ESP'].forEach(x => {
    const p = document.getElementById('pill-'+x);
    p.className = 'npill' + (x===n ? ` sel ${x.toLowerCase()}` : '');
  });
  buildSubSelects();
}

function buildSubSelects() {
  const n = currentNucleo;
  const data = SUBS[n];
  const s1 = document.getElementById('i-sub1');
  const s2 = document.getElementById('i-sub2');
  const g2 = document.getElementById('grupo-subtipo2');
  const l1 = document.getElementById('lbl-subtipo1');
  const gs = document.getElementById('grupo-subtipos');

  if (n === 'URB' || n === 'CONSUL' || n === 'ESP') {
    l1.textContent = 'Subtipo';
    s1.innerHTML = Object.keys(data).map(k=>`<option value="${escAttr(k)}">${escHtml(k)}</option>`).join('');
    g2.style.display = 'none';
    if (gs) gs.style.gridTemplateColumns = '1fr';
    updateItemForm();
  } else {
    l1.textContent = 'Tipo';
    s1.innerHTML = Object.keys(data).map(k=>`<option value="${escAttr(k)}">${escHtml(k)}</option>`).join('');
    g2.style.display = '';
    if (gs) gs.style.gridTemplateColumns = '1fr 1fr';
    updateSub2();
  }
}

function updateSub2() {
  const n = currentNucleo;
  if (n !== 'PAIS') { updateItemForm(); return; }
  const tipo = document.getElementById('i-sub1').value;
  const subs = SUBS.PAIS[tipo] || {};
  const s2 = document.getElementById('i-sub2');
  s2.innerHTML = Object.keys(subs).map(k=>`<option value="${escAttr(k)}">${escHtml(k)}</option>`).join('');
  updateItemForm();
}

function getSubInfo() {
  const n = currentNucleo;
  if (n === 'PAIS') {
    const tipo = document.getElementById('i-sub1').value;
    const sub  = document.getElementById('i-sub2').value;
    return SUBS.PAIS[tipo]?.[sub] || null;
  } else {
    const sub = document.getElementById('i-sub1').value;
    return SUBS[n]?.[sub] || null;
  }
}

function updateItemForm() {
  const si = getSubInfo();
  const mode = si?.mode || 'calc';

  const hEl = document.getElementById('i-hint');
  if (si?.hint) { hEl.textContent = si.hint; hEl.style.display = 'block'; }
  else hEl.style.display = 'none';

  ['f-calc','f-floreira','f-esp','f-consul','f-livre'].forEach(id=>document.getElementById(id).style.display='none');

  if (mode === 'calc') {
    document.getElementById('f-calc').style.display = 'block';
    const n = currentNucleo;
    const isConceito = si?.k === 'URB_CONCEITO';
    const isArb = si?.k === 'PAIS_ARB';
    document.getElementById('lbl-area').textContent = n==='URB' ? 'Ãrea (ha)' : 'Ãrea (mÂ²)';
    document.getElementById('grupo-coef').style.display = isArb ? 'none' : '';
    const coefEl = document.getElementById('i-coef');
    if (isConceito) {
      document.getElementById('lbl-coef').textContent = 'Qtd. CUB (2 a 10)';
      coefEl.min='2'; coefEl.max='10'; coefEl.step='0.5';
    } else {
      document.getElementById('lbl-coef').textContent = 'Coef. complexidade';
      coefEl.min='0'; coefEl.max='2'; coefEl.step='0.05';
    }
    if (si?.coefBase !== null && si?.coefBase !== undefined) coefEl.value = si.coefBase.toFixed(2);
    calcPrev();
  } else if (mode === 'floreira') {
    document.getElementById('f-floreira').style.display = 'block';
    calcPrev();
  } else if (mode === 'esp') {
    document.getElementById('f-esp').style.display = 'block';
  } else if (mode === 'consul') {
    document.getElementById('f-consul').style.display = 'block';
    calcConsulPrev();
  } else if (mode === 'livre') {
    document.getElementById('f-livre').style.display = 'block';
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ENGINE DE CÃLCULO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function calcBase(area, faixas) {
  let rem=area, tot=0, prev=0;
  for (const f of faixas) {
    const top = f.max===null ? Infinity : f.max;
    const chunk = Math.max(0, Math.min(rem, top-prev));
    tot += chunk * f.mult * S.cub;
    rem -= chunk; prev = top;
    if (rem <= 0) break;
  }
  return tot;
}

function calcIV(it) {
  if (!S.cub) return S.mins[it.subK]||0;
  const k=it.subK, area=+it.area||0, coef=+it.coef||0;
  let base=0;
  if (k==='PAIS_FLOREIRA') base = area * S.cub;
  else if (k==='PAIS_ARB') base = area * 0.085 * S.cub;
  else if (k==='URB_CONCEITO') base = coef * S.cub;
  else if (it.mode==='livre'||it.mode==='esp') base = +it.vFix||0;
  else if (it.mode==='consul') base = (+it.horaVal||0)*(+it.horas||0);
  else if (k.startsWith('PAIS')) base = calcBase(area, S.fP) * coef;
  else if (k.startsWith('URB'))  base = calcBase(area, S.fU) * coef;
  else base = +it.vFix||0;
  return Math.max(base, S.mins[k]||0);
}

function calcPrev() {
  const si = getSubInfo();
  if (!si) { ['i-prev','i-prev-fl'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='â€”';}); return; }
  const mode = si.mode;
  let v = 0;
  if (mode==='calc') {
    const a=+document.getElementById('i-area').value||0;
    const c=+document.getElementById('i-coef').value||0;
    v = calcIV({subK:si.k,area:a,coef:c,mode});
    document.getElementById('i-prev').textContent = v>0?fmt(v):'â€”';
  } else if (mode==='floreira') {
    const qty=+document.getElementById('i-cub-qty').value||0;
    v = calcIV({subK:si.k,area:qty,coef:0,mode});
    document.getElementById('i-prev-fl').textContent = v>0?fmt(v):'â€”';
  }
}

function calcConsulPrev() {
  const hv = +document.getElementById('i-consul-hora-val').value||0;
  const h  = +document.getElementById('i-consul-horas').value||0;
  document.getElementById('i-prev-consul').textContent = hv&&h ? fmt(hv*h) : 'â€”';
}

function stepCoef(d) {
  const el=document.getElementById('i-coef');
  const step=+el.step||0.05;
  let v=Math.round((+el.value+d*step)*1000)/1000;
  v=Math.max(+el.min,Math.min(+el.max,v));
  el.value=v.toFixed(2); calcPrev();
}
function stepCubQty(d) {
  const el=document.getElementById('i-cub-qty');
  let v=Math.round((+el.value+d*.25)*100)/100;
  v=Math.max(2,Math.min(20,v));
  el.value=v.toFixed(2); calcPrev();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADICIONAR ITEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function addItem() {
  if (!S.cub) { showBlocked('Cadastre o CUB antes de calcular'); return; }
  const si = getSubInfo();
  if (!si) return;
  const n    = currentNucleo;
  const mode = si.mode;

  let subLabel = '';
  if (n==='PAIS') {
    subLabel = document.getElementById('i-sub1').value + ' Â· ' + document.getElementById('i-sub2').value;
  } else {
    subLabel = document.getElementById('i-sub1').value;
  }

  let area=0, coef=0, vFix=0, desc='', horaVal=0, horas=0, tipoCobranca='total', id='';

  if (mode==='calc') {
    area = +document.getElementById('i-area').value||0;
    coef = +document.getElementById('i-coef').value||0;
    desc = document.getElementById('i-desc').value.trim();
  } else if (mode==='floreira') {
    area = +document.getElementById('i-cub-qty').value||0;
    desc = document.getElementById('i-desc-fl').value.trim();
  } else if (mode==='esp') {
    id   = document.getElementById('i-esp-id').value.trim();
    vFix = +document.getElementById('i-esp-val').value||0;
    if (!vFix) { showBlocked('Informe o valor'); return; }
  } else if (mode==='consul') {
    id          = document.getElementById('i-consul-id').value.trim();
    tipoCobranca= document.getElementById('i-consul-tipo').value;
    horas       = +document.getElementById('i-consul-horas').value||0;
    horaVal     = +document.getElementById('i-consul-hora-val').value||0;
    if (!horaVal) { showBlocked('Informe o valor por hora'); return; }
    vFix = horaVal * horas;
  } else if (mode==='livre') {
    id   = document.getElementById('i-livre-id').value.trim();
    vFix = +document.getElementById('i-livre-val').value||0;
    if (!vFix) { showBlocked('Informe o valor'); return; }
  }

  const valorCalc = calcIV({ subK:si.k, area, coef, vFix, mode, horaVal, horas });

  cItems.push({
    itemId:   Date.now(),
    nucleo:   n,
    subK:     si.k,
    subLabel,
    mode,
    desc, id, area, coef, vFix, horaVal, horas, tipoCobranca,
    valorCalc,
    valorProposto: null,
    editJust:null, editBy:null, editAt:null,
    cubSnap:  S.cub, cubMes: S.cubMes,
  });

  ['i-area','i-desc','i-desc-fl','i-esp-id','i-esp-val','i-livre-id','i-livre-val',
   'i-consul-id','i-consul-horas','i-consul-hora-val'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
  document.getElementById('i-cub-qty').value='2.00';
  calcPrev(); calcResumo(); updateCardBars(); save();
  showToast('Item adicionado');
}

function remItem(id) {
  const it = cItems.find(i=>i.itemId===id); if(!it)return;
  const label = it.subLabel || 'este item';
  abrirPopupConfirm('Remover item', `Remover "${label}" da proposta?`, () => {
    cItems = cItems.filter(i=>i.itemId!==id);
    calcResumo(); updateCardBars(); save();
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EDITAR VALOR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let _evBase = 0; // valor calculado base do item em ediÃ§Ã£o

function openEdit(id) {
  const it = cItems.find(i=>i.itemId===id); if(!it)return;
  evItemId = id;
  _evBase = (it.mode==='livre'||it.mode==='esp') ? (it.vFix||0) : it.valorCalc;
  document.getElementById('ev-calc').value = fmt(_evBase);
  document.getElementById('ev-novo').value = it.valorProposto!==null ? it.valorProposto : _evBase;
  document.getElementById('ev-just').value = it.editJust||'';
  document.getElementById('btn-restaurar').style.display = it.valorProposto!==null ? '' : 'none';
  _evRenderAtalhos(_evBase);
  _evPreview();
  openM('modal-edit');
}

function _evRenderAtalhos(base) {
  const wrap = document.getElementById('ev-atalhos');
  if (!wrap) return;
  // MÃºltiplos de R$20: 4 abaixo e 4 acima do valor calculado
  const step  = 20;
  const piso  = Math.floor(base / step) * step;
  const sugs  = [];
  for (let i = -4; i <= 4; i++) {
    const v = piso + i * step;
    if (v > 0 && v !== base) sugs.push(v);
  }
  wrap.innerHTML = sugs.map(v => {
    const diff  = v - base;
    const cor   = diff < 0 ? 'var(--tc)' : 'var(--verde)';
    const sinal = diff > 0 ? '+' : 'âˆ’';
    return `<button class="btn xs ghost" style="font-family:var(--font-mono);font-size:10px" onclick="_evAplicar(${v})">
      ${fmt(v)} <span style="color:${cor};font-size:9px">${sinal}${fmt(Math.abs(diff))}</span>
    </button>`;
  }).join('');
}

function _evAplicar(val) {
  document.getElementById('ev-novo').value = val;
  _evPreview();
}

function _evPreview() {
  const novo = +document.getElementById('ev-novo').value || 0;
  const diff = novo - _evBase;
  const el   = document.getElementById('ev-diff');
  if (!el) return;
  if (Math.abs(diff) < 0.01) { el.textContent = ''; return; }
  const cor   = diff < 0 ? 'var(--tc)' : 'var(--verde)';
  const sinal = diff > 0 ? '+' : '';
  const pct   = _evBase > 0 ? (diff/_evBase*100).toFixed(1) : 'â€”';
  el.innerHTML = `DiferenÃ§a: <strong style="color:${cor}">${sinal}${fmt(Math.abs(diff))} (${sinal}${pct}%)</strong>`;
}

function confirmEdit() {
  const novo = +document.getElementById('ev-novo').value;
  if (novo < 0) { showBlocked('Valor invÃ¡lido'); return; }
  const it = cItems.find(i=>i.itemId===evItemId); if(!it)return;
  const just = document.getElementById('ev-just').value.trim();
  if (Math.abs(novo - _evBase) < 0.01) {
    // Sem alteraÃ§Ã£o â€” restaura ao calculado
    it.valorProposto = null; it.editJust = null; it.editAt = null;
  } else {
    it.valorProposto = novo;
    it.editJust = just || null;
    it.editAt   = new Date().toLocaleDateString('pt-BR');
  }
  closeM('modal-edit'); calcResumo(); save();
  showToast('Valor atualizado');
}

function restaurarValor() {
  const it = cItems.find(i=>i.itemId===evItemId); if(!it)return;
  it.valorProposto = null; it.editJust = null; it.editAt = null;
  closeM('modal-edit'); calcResumo(); save();
  showToast('Valor restaurado');
}
function _restaurarDireto(id) {
  const it = cItems.find(i=>i.itemId===id); if(!it)return;
  abrirPopupConfirm('Restaurar valor', 'Restaurar o valor calculado original?', () => {
    it.valorProposto = null; it.editJust = null; it.editAt = null;
    calcResumo(); save();
    showToast('Valor restaurado');
  }, 'Restaurar');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REPASSE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleRepasse() {
  const f     = document.getElementById('repasse-form');
  const empty = document.getElementById('repasse-empty');
  const isOpen = f.style.display !== 'none';
  f.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) empty.style.display = 'none';
  else if (!cRepasse) empty.style.display = 'block';
}
function onRepTipoChange() {
  const t = document.getElementById('rep-tipo').value;
  document.getElementById('rep-val-lbl').textContent = t==='pct' ? 'Percentual (%)' : 'Valor (R$)';
  document.getElementById('rep-info').textContent = t==='pct'
    ? 'Incide sobre o valor dos serviÃ§os, nÃ£o sobre despesas ou subcontrataÃ§Ãµes.'
    : 'Valor fixo somado Ã  proposta.';
}
function confirmarRepasse() {
  const nome = document.getElementById('rep-nome').value.trim();
  const tipo = document.getElementById('rep-tipo').value;
  const val  = +document.getElementById('rep-val').value || 0;
  if (!nome) { showBlocked('Informe o nome do repasse'); return; }
  if (!val)  { showBlocked('Informe o valor do repasse'); return; }
  const totI = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc), 0);
  const valorRep = tipo==='pct' ? totI*val/100 : val;
  cRepasse = { nome, tipo, val, valorRep };
  document.getElementById('repasse-form').style.display = 'none';
  document.getElementById('repasse-empty').style.display = 'none';
  document.getElementById('repasse-preview').style.display = 'block';
  document.getElementById('rep-preview-nome').textContent = nome;
  document.getElementById('rep-preview-desc').textContent = tipo==='pct' ? `${val}% sobre serviÃ§os` : 'Valor fixo';
  document.getElementById('rep-preview-val').textContent = fmt(valorRep);
  updateCardBars(); calcResumo(); save();
  showToast('Repasse adicionado');
}
function editarRepasse() {
  if (!cRepasse) return;
  document.getElementById('rep-nome').value = cRepasse.nome;
  document.getElementById('rep-tipo').value = cRepasse.tipo;
  document.getElementById('rep-val').value  = cRepasse.val;
  onRepTipoChange();
  document.getElementById('repasse-preview').style.display = 'none';
  document.getElementById('repasse-empty').style.display   = 'none';
  document.getElementById('repasse-form').style.display    = 'block';
  cRepasse = null;
  updateCardBars(); calcResumo(); save();
  document.getElementById('card-repasse').scrollIntoView({behavior:'smooth', block:'start'});
}
function getRepasseCalc(totServicos) {
  if (!cRepasse) return null;
  const valorRep = cRepasse.tipo==='pct' ? totServicos*cRepasse.val/100 : cRepasse.val;
  return { ...cRepasse, valorRep };
}
function remRepasse() {
  cRepasse = null;
  document.getElementById('rep-nome').value = '';
  document.getElementById('rep-val').value  = '';
  document.getElementById('repasse-preview').style.display = 'none';
  document.getElementById('repasse-form').style.display    = 'none';
  document.getElementById('repasse-empty').style.display   = 'block';
  updateCardBars(); calcResumo(); save();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BARRAS LATERAIS DINÃ‚MICAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setCardBar(id, colorClass) {
  const el = document.getElementById(id);
  if (el) el.className = 'card ' + colorClass;
}
function updateCardBars() {
  const clienteFilled = (document.getElementById('f-cliente').value||'').trim().length > 0;
  const projetoFilled = (document.getElementById('f-projeto').value||'').trim().length > 0;
  setCardBar('card-id',       (clienteFilled && projetoFilled) ? 'verde'  : 'neutro');
  setCardBar('card-servicos', cItems.length  > 0               ? 'verde'  : 'neutro');
  setCardBar('card-subs',     cSubs.length   > 0               ? 'tc'     : 'neutro');
  setCardBar('card-repasse',  cRepasse !== null                 ? 'am'     : 'neutro');
  setCardBar('card-desps',    cDesps.some(d=>d.confirmada)      ? 'az'     : 'neutro');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PARÃ‚METROS â€” TOGGLE SUPABASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleSBConfig() {
  const body = document.getElementById('sb-config-body');
  const lbl  = document.getElementById('sb-toggle-lbl');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  lbl.textContent    = open ? 'â–¶ Expandir' : 'â–¼ Recolher';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HISTÃ“RICO â€” FILTRO APENAS ATIVAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleFiltroAtivas() {
  S.histSoAativas = !S.histSoAativas;
  const btn = document.getElementById('hf-btn-ativas');
  if (S.histSoAativas) {
    btn.style.background = 'var(--preto)'; btn.style.color = '#fff';
    btn.style.borderColor = 'var(--preto)';
  } else {
    btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
  }
  renderHist();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUBCONTRATAÃ‡Ã•ES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleSubForm() {
  const form = document.getElementById('sub-form');
  const empty = document.getElementById('sub-empty');
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : 'block';
  // se nÃ£o tem subs e formulÃ¡rio fechado, mostra empty state
  updateSubVisibility();
}

function updateSubVisibility() {
  const hasSubs = cSubs.length > 0;
  const formOpen = document.getElementById('sub-form').style.display !== 'none';
  document.getElementById('sub-list-wrap').style.display = hasSubs ? 'block' : 'none';
  document.getElementById('sub-empty').style.display = (!hasSubs && !formOpen) ? 'block' : 'none';
}

function addSubcontr() {
  const serv = document.getElementById('sc-serv').value.trim();
  const emp  = document.getElementById('sc-emp').value.trim();
  if (!serv) { showBlocked('Informe o serviÃ§o'); return; }
  const val  = +document.getElementById('sc-val').value||0;
  const bit  = +document.getElementById('sc-bit').value||0;
  const ret  = +document.getElementById('sc-ret').value||0;
  const data = document.getElementById('sc-data').value;
  const ganhoEXP  = val*ret/100;
  // valComBit = total ao cliente: X + bitributaÃ§Ã£o + ganho EXP (adicional sobre X)
  const valComBit = val*(1+bit/100+ret/100);
  cSubs.push({ id:Date.now(), serv, emp, data, val, bit, ret, valComBit, ganhoEXP });
  ['sc-serv','sc-emp','sc-val','sc-data'].forEach(id=>{ const e=document.getElementById(id); if(e)e.value=''; });
  document.getElementById('sc-bit').value='15';
  document.getElementById('sc-ret').value='20';
  document.getElementById('sub-form').style.display = 'none';
  renderSubList();
  updateSubVisibility();
  calcResumo(); updateCardBars(); save(); showToast('SubcontrataÃ§Ã£o adicionada');
}
function remSub(id) {
  const sc = cSubs.find(s=>s.id===id); if(!sc)return;
  abrirPopupConfirm('Remover subcontrataÃ§Ã£o', `Remover "${sc.serv||'sem nome'}"?`, () => {
    cSubs = cSubs.filter(s=>s.id!==id);
    renderSubList();
    updateSubVisibility();
    calcResumo(); updateCardBars(); save();
  });
}

function renderSubList() {
  const el = document.getElementById('sub-list');
  if (!cSubs.length) { el.innerHTML=''; return; }
  el.innerHTML = cSubs.map(_sc=>{
    const sc={..._sc, serv:escHtml(_sc.serv), emp:escHtml(_sc.emp||'')};
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--cinza2)">
      <div>
        <div style="font-size:12px;font-weight:600">${escHtml(sc.serv)}</div>
        <div style="font-size:10px;color:#888">${sc.emp}${sc.data?' Â· '+fmtD(sc.data):''}
          <span style="margin-left:6px;color:#bbb">bit.${sc.bit}% / ganho ${sc.ret}%</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div>
          <div style="font-size:11px;color:#888;text-decoration:line-through">${fmt(sc.val)}</div>
          <div style="font-size:13px;font-weight:700;color:var(--terracota);font-family:var(--font-mono)">${fmt(sc.valComBit)}</div>
        </div>
        <button class="btn xs danger" onclick="remSub(${sc.id})">âœ•</button>
      </div>
    </div>`;
  }).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DESPESAS INDIRETAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const DESP_CORES = { alim:'#1D9E75', carro:'#378ADD', translado:'#BA7517', passagem:'#D4537E', hotel:'#6B4FA0', horasTec:'#1D6A4A' };
const DESP_LABELS = { alim:'AlimentaÃ§Ã£o', carro:'Aluguel de carro', translado:'Translado local', passagem:'Passagem', hotel:'Hospedagem', horasTec:'Horas tÃ©cnicas (Ganho EXP)' };

function calcDesp(d) {
  if (d.tipo==='alim')      return (+d.diarias||0)*(+d.pessoas||1)*(+d.valorDiario||0);
  if (d.tipo==='carro')     return (+d.diarias||0)*(+d.valorDiaria||0)+(+d.km||0)/Math.max(+d.kml||10,.1)*(+d.vl||0);
  if (d.tipo==='translado') return +d.vt||0;
  if (d.tipo==='horasTec')  return (+d.dias||0)*(+d.horasDia||0)*(+d.valorHora||0);
  if (d.tipo==='passagem')  return +d.val||0;
  if (d.tipo==='hotel')     return (+d.diarias||0)*(+d.valorDiaria||0);
  return 0;
}
function getTotDesp() {
  // horasTec Ã© Ganho EXP â€” nÃ£o entra no total repassado ao cliente
  const raw = cDesps.filter(d=>d.confirmada&&d.tipo!=='horasTec').reduce((s,d)=>s+calcDesp(d),0);
  const bit = (+document.getElementById('desp-bit').value||0)/100;
  return raw*(1+bit);
}

function updateDespVisibility() {
  const hasDesps = cDesps.length > 0;
  document.getElementById('desp-list-wrap').style.display = hasDesps ? 'block' : 'none';
  document.getElementById('desp-bit-wrap').style.display  = hasDesps ? 'block' : 'none';
  document.getElementById('desp-empty').style.display     = hasDesps ? 'none' : 'block';
}

function addDesp(tipo) {
  const id = dSeq++;
  const base = { id, tipo, confirmada: false };
  if (tipo==='alim')     Object.assign(base,{diarias:1,pessoas:1,valorDiario:80,desc:''});
  if (tipo==='carro')    Object.assign(base,{diarias:1,valorDiaria:180,km:0,kml:10,vl:6.20,desc:''});
  if (tipo==='translado') Object.assign(base,{vt:0,desc:''});
  if (tipo==='passagem')  Object.assign(base,{orig:'',dest:'',meio:'aviao',val:0,desc:''});
  if (tipo==='hotel')     Object.assign(base,{cidade:'',diarias:1,valorDiaria:180,desc:''});
  if (tipo==='horasTec')  Object.assign(base,{dias:1,horasDia:8,valorHora:150,desc:''});
  cDesps.push(base);
  renderDesps();
  updateDespVisibility();
  calcResumo(); updateCardBars(); save();
}
function confirmarDesp(id) {
  const d = cDesps.find(d=>d.id===id); if(!d) return;
  d.confirmada = true;
  save();
  renderDesps();
  calcResumo(); updateCardBars();
}
function dupDesp(id) {
  const orig = cDesps.find(d=>d.id===id); if(!orig)return;
  const copia = { ...orig, id:dSeq++, confirmada: false };
  const idx = cDesps.findIndex(d=>d.id===id);
  cDesps.splice(idx+1,0,copia);
  renderDesps(); updateDespVisibility(); calcResumo(); save();
}
function remDesp(id) {
  const d = cDesps.find(d=>d.id===id); if(!d)return;
  const lbl = (d.desc||d.cidade||DESP_LABELS[d.tipo]||'despesa');
  abrirPopupConfirm('Remover despesa', `Remover "${lbl}"?`, () => {
    cDesps = cDesps.filter(d=>d.id!==id);
    renderDesps(); updateDespVisibility(); calcResumo(); updateCardBars(); save();
  });
}
function setDesp(id,field,val) {
  const d=cDesps.find(d=>d.id===id);
  if(d){ d[field]=val; d.confirmada=false; save(); }
}
function updateDespSubtotal(despId) {
  const d = cDesps.find(x=>x.id===despId); if(!d) return;
  const sub = document.getElementById('desp-sub-'+despId);
  if(sub) { sub.textContent = fmt(calcDesp(d)); sub.style.color = d.confirmada ? '' : '#bbb'; }
  const tot = document.getElementById('desp-total-display');
  if(tot) tot.textContent = fmt(getTotDesp());
}

function renderDesps() {
  const el = document.getElementById('desp-list');
  if (!cDesps.length) { el.innerHTML=''; return; }

  let html = '';
  cDesps.forEach((_d,i)=>{
    const d = {
      ..._d,
      desc: escHtml(_d.desc||''),
      cidade: escHtml(_d.cidade||''),
      orig: escHtml(_d.orig||''),
      dest: escHtml(_d.dest||''),
    };
    const cor = DESP_CORES[d.tipo];
    const lbl = DESP_LABELS[d.tipo];
    const sub = fmt(calcDesp(d));
    let body = '';

    if (d.tipo==='alim') {
      body=`<div class="fg fg3" style="margin-bottom:7px">
        <div class="fgroup"><label>NÂº de diÃ¡rias</label><input type="number" min="1" value="${escAttr(d.diarias||1)}"
          oninput="setDesp(${d.id},'diarias',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Pessoas por diÃ¡ria</label><input type="number" min="1" value="${escAttr(d.pessoas||1)}"
          oninput="setDesp(${d.id},'pessoas',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Valor diÃ¡rio/pessoa (R$)</label><input type="number" min="0" step="5" value="${escAttr(d.valorDiario||80)}"
          oninput="setDesp(${d.id},'valorDiario',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
      </div>
      <div class="fgroup"><label>DescriÃ§Ã£o</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: MissÃ£o Pelotas â€” 3 pessoas, 2 dias" oninput="setDesp(${d.id},'desc',this.value)"></div>`;
    }
    if (d.tipo==='carro') {
      body=`<div class="fg fg3" style="margin-bottom:7px">
        <div class="fgroup"><label>NÂº de diÃ¡rias</label><input type="number" min="1" value="${escAttr(d.diarias||1)}"
          oninput="setDesp(${d.id},'diarias',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Valor diÃ¡ria c/ seguro (R$)</label><input type="number" min="0" step="10" value="${escAttr(d.valorDiaria||180)}"
          oninput="setDesp(${d.id},'valorDiaria',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Km rodados</label><input type="number" min="0" value="${escAttr(d.km||0)}"
          oninput="setDesp(${d.id},'km',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
      </div>
      <div class="fg fg3 mb8">
        <div class="fgroup"><label>Consumo (km/l)</label><input type="number" min=".1" step=".5" value="${escAttr(d.kml||10)}"
          oninput="setDesp(${d.id},'kml',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Valor/litro (R$)</label><input type="number" min="0" step=".05" value="${escAttr(d.vl||6.20)}"
          oninput="setDesp(${d.id},'vl',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Trecho</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: Floripa â†’ Pelotas" oninput="setDesp(${d.id},'desc',this.value)"></div>
      </div>`;
    }
    if (d.tipo==='translado') {
      body=`<div class="fg fg2">
        <div class="fgroup"><label>Valor total estimado (R$)</label><input type="number" min="0" step="10" value="${escAttr(d.vt||0)}"
          oninput="setDesp(${d.id},'vt',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>DescriÃ§Ã£o / trecho</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: Ubers â€” SÃ£o Raimundo Nonato, 4 dias" oninput="setDesp(${d.id},'desc',this.value)"></div>
      </div>`;
    }
    if (d.tipo==='hotel') {
      body=`<div class="fg fg3" style="margin-bottom:7px">
        <div class="fgroup"><label>Cidade</label><input type="text" value="${escAttr(d.cidade||'')}" placeholder="Ex: SÃ£o Paulo" oninput="setDesp(${d.id},'cidade',this.value)"></div>
        <div class="fgroup"><label>NÂº de diÃ¡rias</label><input type="number" min="1" value="${escAttr(d.diarias||1)}"
          oninput="setDesp(${d.id},'diarias',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Valor/diÃ¡ria (R$)</label><input type="number" min="0" step="10" value="${escAttr(d.valorDiaria||180)}"
          oninput="setDesp(${d.id},'valorDiaria',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
      </div>
      <div class="fgroup"><label>DescriÃ§Ã£o</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: Hotel Centro â€” 3 noites" oninput="setDesp(${d.id},'desc',this.value)"></div>`;
    }
    if (d.tipo==='passagem') {
      body=`<div class="fg fg4 mb8">
        <div class="fgroup"><label>Origem</label><input type="text" value="${escAttr(d.orig||'')}" placeholder="Ex: FlorianÃ³polis" oninput="setDesp(${d.id},'orig',this.value)"></div>
        <div class="fgroup"><label>Destino</label><input type="text" value="${escAttr(d.dest||'')}" placeholder="Ex: Teresina" oninput="setDesp(${d.id},'dest',this.value)"></div>
        <div class="fgroup"><label>Meio</label>
          <select onchange="setDesp(${d.id},'meio',this.value)">
            <option value="${escAttr('aviao')}" ${d.meio==='aviao'?'selected':''}>AviÃ£o</option>
            <option value="${escAttr('onibus')}" ${d.meio==='onibus'?'selected':''}>Ã”nibus</option>
            <option value="${escAttr('trem')}" ${d.meio==='trem'?'selected':''}>Trem</option>
            <option value="${escAttr('outro')}" ${d.meio==='outro'?'selected':''}>Outro</option>
          </select>
        </div>
        <div class="fgroup"><label>Valor (R$)</label><input type="number" min="0" step="10" value="${escAttr(d.val||0)}"
          oninput="setDesp(${d.id},'val',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
      </div>
      <div class="fgroup"><label>ObservaÃ§Ã£o</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: Ida e volta Â· 2 pessoas" oninput="setDesp(${d.id},'desc',this.value)"></div>`;
    }
    if (d.tipo==='horasTec') {
      body=`<div style="font-size:9px;color:var(--verde);font-weight:600;margin-bottom:6px;letter-spacing:.3px">â†³ Valor entra como Ganho EXP (nÃ£o repassa ao cliente)</div>
      <div class="fg fg3" style="margin-bottom:7px">
        <div class="fgroup"><label>Dias</label><input type="number" min="1" value="${escAttr(d.dias||1)}"
          oninput="setDesp(${d.id},'dias',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Horas/dia</label><input type="number" min="0.5" step="0.5" value="${escAttr(d.horasDia||8)}"
          oninput="setDesp(${d.id},'horasDia',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
        <div class="fgroup"><label>Valor/hora (R$)</label><input type="number" min="0" step="10" value="${escAttr(d.valorHora||150)}"
          oninput="setDesp(${d.id},'valorHora',+this.value);updateDespSubtotal(${d.id})"
          onchange="calcResumo()"></div>
      </div>
      <div class="fgroup"><label>DescriÃ§Ã£o</label><input type="text" value="${escAttr(d.desc||'')}" placeholder="Ex: Consultoria tÃ©cnica â€” visita ao terreno" oninput="setDesp(${d.id},'desc',this.value)"></div>`;
    }

    const subColor = d.confirmada ? '' : 'color:#bbb';
    const okBtn = d.confirmada
      ? `<span style="font-size:9px;font-weight:600;color:var(--verde);letter-spacing:.5px">âœ“ confirmada</span>`
      : `<button class="btn xs" style="background:var(--verde);color:#fff;border-color:var(--verde)" onclick="confirmarDesp(${d.id})">âœ“ OK</button>`;
    html+=`<div class="bloco" style="border-left-color:${d.confirmada?cor:'#ccc'}">
      <div class="bloco-head">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:8px;height:8px;border-radius:50%;background:${d.confirmada?cor:'#ccc'};flex-shrink:0"></div>
          <span class="bloco-lbl" style="${d.confirmada?'':'color:#aaa'}">${lbl}</span>
        </div>
        <div class="bloco-acts">
          <span class="bloco-sub" id="desp-sub-${d.id}" style="${subColor}">${sub}</span>
          ${okBtn}
          <button class="btn xs ghost" onclick="dupDesp(${d.id})">+ Duplicar</button>
          <button class="btn xs danger" onclick="remDesp(${d.id})">âœ•</button>
        </div>
      </div>
      ${body}
    </div>`;
  });
  el.innerHTML = html;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RESUMO GERAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function calcResumo() {
  cItems.forEach(it=>{ if(it.mode==='calc'||it.mode==='floreira') it.valorCalc=calcIV(it); });

  const totI     = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
  const totICalc = cItems.reduce((s,i)=>s+i.valorCalc,0);
  const rep      = getRepasseCalc(totI);
  const totRep   = rep ? rep.valorRep : 0;

  // Atualiza preview do repasse com valor recalculado
  if (cRepasse) {
    document.getElementById('rep-preview-val').textContent = fmt(totRep);
  }

  const totSub   = cSubs.reduce((s,c)=>s+c.valComBit,0);
  const ganhoSubs= cSubs.reduce((s,c)=>s+c.ganhoEXP,0);
  const totDesp  = getTotDesp();
  const despDisplay = document.getElementById('desp-total-display');
  if (despDisplay) despDisplay.textContent = fmt(totDesp);

  const total    = totI + totRep + totSub + totDesp;
  const desconto = Math.max(0, totICalc-totI);

  document.getElementById('i-count').textContent = cItems.length+' item'+(cItems.length!==1?'s':'');
  updateCardBars();

  const body = document.getElementById('resumo-body');
  if (!cItems.length && !cSubs.length && !totDesp && !totRep) {
    body.innerHTML = '<div class="empty">Adicione serviÃ§os para ver o resumo</div>';
    return;
  }

  let html = '';

  // Banner de ediÃ§Ã£o ativa
  if (editingProposalId !== null) {
    const orig = S.proposals.find(p=>p.id===editingProposalId);
    if (orig) {
      const cod = orig.propCode ? `EXP-${String(orig.propCode).padStart(3,'0')}` : `#${orig.id}`;
      const projetoOrig = escHtml(orig.projeto||'');
      html += `<div style="background:var(--az-bg);border:1px solid var(--azul);padding:8px 11px;font-size:11px;color:var(--az);margin-bottom:10px">
        âœï¸ Revisando <strong>${cod}</strong> â€” ${projetoOrig}. Ao salvar, serÃ¡ criada versÃ£o <strong>${_verLabel((orig.version||0)+1)}</strong>.
      </div>`;
    }
  }

  // C12/K4 â€” banner de status CRM
  if (linkedOppInfo) {
    const allFinal = linkedOppInfo.prods.length > 0 &&
      linkedOppInfo.prods.every(p=>['fechado','negado','cancelado'].includes((p.status||'').toLowerCase()));
    const projetoVinculado = escHtml(linkedOppInfo.projeto||'');
    const lockBadges = linkedOppInfo.prods.map(p=>{
      const st=(p.status||'').toLowerCase();
      const cor = st==='fechado'?'var(--verde)':st==='negado'?'var(--terracota)':st==='cancelado'?'var(--cinza)':'var(--azul)';
      const corBg = st==='fechado'?'var(--verde-bg)':st==='negado'?'var(--tc-bg)':st==='cancelado'?'var(--cinza2)':'var(--az-bg)';
      return `<span style="font-size:9px;font-weight:600;color:${cor};background:${corBg};padding:2px 6px">${escHtml(p.nucleo||'')} Â· ${escHtml(p.status||'')}</span>`;
    }).join(' ');
    html += `<div style="background:var(--am-bg);border:1px solid var(--ouro);padding:8px 11px;font-size:11px;color:var(--ouro);margin-bottom:10px;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap">
      <div style="flex:1">ðŸ”— <strong>CRM vinculado:</strong> ${projetoVinculado}
        ${lockBadges?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${lockBadges}</div>`:''}
        ${allFinal?`<div style="margin-top:4px;font-weight:600;color:var(--terracota)">âš  Proposta inteiramente travada.</div>`:''}
      </div>
      <button id="btn-check-crm" class="btn xs ghost" onclick="atualizarStatusCRM()" style="white-space:nowrap;flex-shrink:0">â†» Atualizar</button>
    </div>`;
  }

  // GRUPOS POR NÃšCLEO (Produtos / ServiÃ§os EXP)
  ['PAIS','URB','CONSUL','ESP'].forEach(nuc=>{
    const its = cItems.filter(i=>i.nucleo===nuc);
    if (!its.length) return;
    const stot = its.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
    const cor  = NCOR[nuc];
    const isLocked = lockedNucleos.has(nuc);
    html+=`<div class="rg"${isLocked?' style="opacity:.65"':''}>
      <div class="rg-head">
        <div class="rg-stripe" style="background:${cor}"></div>
        <span class="rg-label">${NC[nuc]}</span>
        ${isLocked?`<span style="font-size:10px;color:var(--terracota);margin-left:6px">ðŸ”’ travado</span>`:''}
        <span class="rg-sub" style="color:${cor}">${fmt(stot)}</span>
      </div>
      ${its.map(it=>{
        const disp = it.valorProposto!==null?it.valorProposto:it.valorCalc;
        const isEd = it.valorProposto!==null;
        const subLabelDisp = escHtml(it.subLabel||'');
        const itemIdDisp = escHtml(it.id||'');
        const itemDescDisp = escHtml(it.desc||'');
        let detail='â€”';
        if(it.mode==='calc'){
          if(it.subK==='PAIS_ARB') detail=`${(+it.area).toLocaleString('pt-BR')} mÂ² SV`;
          else if(it.subK==='URB_CONCEITO') detail=`${(+it.coef).toFixed(2)} CUB`;
          else if(it.nucleo==='URB') detail=`${(+it.area).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha Â· coef. ${(+it.coef).toFixed(2)}`;
          else detail=`${(+it.area).toLocaleString('pt-BR')} mÂ² Â· coef. ${(+it.coef).toFixed(2)}`;
        } else if(it.mode==='floreira') detail=`${(+it.area).toFixed(2)} CUB`;
        else if(it.mode==='consul') detail=`${it.horas||0}h Â· ${it.tipoCobranca==='mensal'?'mensal':'total'}`;
        else detail='valor livre';
        return`<div class="rg-item">
          <div>
            <span class="badge ${NBADGE[nuc]}" style="font-size:8px">${subLabelDisp}</span>
            ${it.id?`<span style="font-size:10px;color:#888;margin-left:4px">${itemIdDisp}</span>`:''}
            ${it.desc?`<span style="font-size:10px;color:#888;margin-left:4px">${itemDescDisp}</span>`:''}
            ${isEd?`<span style="font-size:9px;color:var(--verde);margin-left:4px">âœ“ editado</span>`:''}
          </div>
          <div style="font-size:10px;color:#888">${detail}</div>
          <div style="font-size:9px;color:#aaa">CUB ${it.cubSnap?fmt(it.cubSnap):''}</div>
          <div>
            ${isEd?`<div style="font-size:9px;text-decoration:line-through;color:#bbb">${fmt(it.valorCalc)}</div>`:''}
            <div class="rg-val${isEd?' edited':''}">${fmt(disp)}</div>
          </div>
          <div style="display:flex;gap:3px">
            ${isLocked
              ? `<span style="font-size:10px;color:var(--terracota);padding:2px 5px">ðŸ”’</span>`
              : `<button class="btn xs ghost" onclick="openEdit(${it.itemId})" title="Ajustar valor">âœŽ</button>
                 ${isEd ? `<button class="btn xs ghost" style="color:var(--terracota)" onclick="event.stopPropagation();_restaurarDireto(${it.itemId})" title="Restaurar valor calculado">â†º</button>` : ''}
                 <button class="btn xs danger" onclick="remItem(${it.itemId})">âœ•</button>`
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;
  });

  // SUBCONTRATAÃ‡Ã•ES â€” com breakdown por sub
  if (cSubs.length) {
    html+=`<div class="rg">
      <div class="rg-head">
        <div class="rg-stripe" style="background:var(--terracota)"></div>
        <span class="rg-label">SubcontrataÃ§Ãµes</span>
        <span class="rg-sub" style="color:var(--terracota)">${fmt(totSub)}</span>
      </div>
      ${cSubs.map(_sc=>{
        const sc={..._sc, serv:escHtml(_sc.serv), emp:escHtml(_sc.emp||'')};
        const bitVal = sc.val*(sc.bit/100);
        return`<div style="border:1px solid var(--cinza);border-top:none;background:#fff;padding:8px 11px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="min-width:0;flex:1">
              <div style="font-size:11px;font-weight:600">${sc.serv}</div>
              <div style="font-size:10px;color:#888;margin-bottom:6px">${sc.emp}${sc.data?' Â· '+fmtD(sc.data):''}</div>
              <div style="display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:10px">
                <span style="color:#aaa">Custo cotado</span><span style="font-family:var(--font-mono)">${fmt(sc.val)}</span>
                <span style="color:var(--terracota)">+ Bitrib. est. ${sc.bit}%</span><span style="font-family:var(--font-mono);color:var(--terracota)">+ ${fmt(bitVal)}</span>
                <span style="color:#888;padding-top:2px">â†’ Pago ao contratado</span><span style="font-family:var(--font-mono);padding-top:2px">${fmt(sc.val+bitVal)}</span>
                <span style="color:var(--verde)">+ Ganho EXP ${sc.ret}%</span><span style="font-family:var(--font-mono);color:var(--verde);font-weight:600">+ ${fmt(sc.ganhoEXP)}</span>
                <span style="color:#555;font-weight:600;border-top:1px solid var(--cinza2);padding-top:3px">Total ao cliente</span><span style="font-family:var(--font-mono);font-weight:700;border-top:1px solid var(--cinza2);padding-top:3px">${fmt(sc.valComBit)}</span>
              </div>
            </div>
            <button class="btn xs danger" onclick="remSub(${sc.id})" style="flex-shrink:0;margin-top:2px">âœ•</button>
          </div>
        </div>`;
      }).join('')}
      ${ganhoSubs>0?`<div style="border:1px solid var(--cinza);border-top:none;background:var(--verde-bg);padding:5px 11px;display:flex;justify-content:space-between;font-size:10px">
        <span style="color:var(--verde);font-weight:600">Ganho EXP total s/ subcontrataÃ§Ãµes</span>
        <span style="font-weight:700;color:var(--verde);font-family:var(--font-mono)">${fmt(ganhoSubs)}</span>
      </div>`:''}
    </div>`;
  }

  // REPASSE
  if (rep) {
    const repNome = escHtml(rep.nome||'');
    html+=`<div class="rg">
      <div class="rg-head">
        <div class="rg-stripe" style="background:var(--ouro)"></div>
        <span class="rg-label">Repasse comercial</span>
        <span class="rg-sub" style="color:var(--ouro)">${fmt(totRep)}</span>
      </div>
      <div style="border:1px solid var(--cinza);border-top:none;background:#fff;padding:8px 11px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:11px;font-weight:600">${repNome}</div>
          <div style="font-size:10px;color:#888">${rep.tipo==='pct'?`${rep.val}% sobre serviÃ§os`:'Valor fixo'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="font-weight:700;color:var(--ouro);font-family:var(--font-mono);font-size:13px">${fmt(totRep)}</div>
          <button class="btn xs ghost" onclick="editarRepasse()">âœŽ</button>
          <button class="btn xs danger" onclick="remRepasse()">âœ•</button>
        </div>
      </div>
    </div>`;
  }

  // DESPESAS â€” com cada item + bitributaÃ§Ã£o total
  if (totDesp>0) {
    const rawDesp = cDesps.reduce((s,d)=>s+calcDesp(d),0);
    const bit     = +document.getElementById('desp-bit').value||0;
    const bitAmt  = rawDesp*(bit/100);
    const DLBL    = { alim:'AlimentaÃ§Ã£o', carro:'VeÃ­culo', translado:'Translado', hotel:'Hospedagem', passagem:'Passagem' };
    html+=`<div class="rg">
      <div class="rg-head">
        <div class="rg-stripe" style="background:#888"></div>
        <span class="rg-label">Despesas indiretas</span>
        <span class="rg-sub">${fmt(totDesp)}</span>
      </div>
      ${cDesps.map(_d=>{
        const d = {..._d, desc:escHtml(_d.desc||''), cidade:escHtml(_d.cidade||''), orig:escHtml(_d.orig||''), dest:escHtml(_d.dest||'')};
        const val  = calcDesp(d);
        const lbl  = escHtml(DLBL[d.tipo]||d.tipo);
        const desc = d.desc||d.cidade||'';
        const det  = d.tipo==='alim'?`${d.diarias||1}d Ã— ${d.pessoas||1}p`
          : d.tipo==='hotel'?`${d.diarias||1}d${d.cidade?' Â· '+d.cidade:''}`
          : d.tipo==='passagem'&&d.orig?`${d.orig}â†’${d.dest||''}`:'';
        return`<div style="border:1px solid var(--cinza);border-top:none;background:#fff;padding:6px 11px;display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div style="font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            <strong>${lbl}</strong>${desc?' â€” '+desc:''}
            ${det?`<span style="font-size:9px;color:#bbb;margin-left:4px">${det}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span style="font-weight:700;font-family:var(--font-mono);font-size:11px">${fmt(val)}</span>
            <button class="btn xs danger" onclick="remDesp(${d.id})">âœ•</button>
          </div>
        </div>`;
      }).join('')}
      ${bit>0?`<div style="border:1px solid var(--cinza);border-top:none;background:var(--off);padding:5px 11px;display:flex;justify-content:space-between;font-size:10px">
        <span style="color:#888">Bruto ${fmt(rawDesp)} + Bitrib. ${bit}% = ${fmt(bitAmt)}</span>
        <span style="font-weight:700;font-family:var(--font-mono)">${fmt(totDesp)}</span>
      </div>`:''}
    </div>`;
  }

  // TOTAL
  html+=`<div class="total-bar" style="margin-top:8px">
    <div class="total-lbl">Valor total da proposta</div>
    <div class="total-val">${fmt(total)}</div>
  </div>`;

  if (desconto>0.01) {
    html+=`<div class="desc-bar">
      <span style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--terracota)">â¬‡ Desconto aplicado</span>
      <span style="font-weight:700;color:var(--terracota)">${fmt(desconto)}</span>
    </div>`;
  }

  // GANHO EXP â€” box destacado
  const ganhoTec = cDesps.filter(d=>d.tipo==='horasTec'&&d.confirmada).reduce((s,d)=>s+calcDesp(d),0);
  const totalGanhoEXP = totI + ganhoSubs + ganhoTec;
  html+=`<div style="margin-top:8px;background:var(--verde-bg);border:1px solid var(--verde);padding:10px 13px">
    <div style="font-size:8px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--verde);margin-bottom:6px">Ganho EXP</div>
    <div style="font-size:11px;display:flex;justify-content:space-between;padding:2px 0">
      <span style="color:#444">ServiÃ§os EXP (produtos)</span>
      <span style="font-family:var(--font-mono);font-weight:600">${fmt(totI)}</span>
    </div>
    ${ganhoSubs>0?`<div style="font-size:11px;display:flex;justify-content:space-between;padding:2px 0">
      <span style="color:#444">Ganho s/ subcontrataÃ§Ãµes</span>
      <span style="font-family:var(--font-mono);font-weight:600">${fmt(ganhoSubs)}</span>
    </div>`:''}
    ${ganhoTec>0?`<div style="font-size:11px;display:flex;justify-content:space-between;padding:2px 0">
      <span style="color:#444">Horas tÃ©cnicas</span>
      <span style="font-family:var(--font-mono);font-weight:600">${fmt(ganhoTec)}</span>
    </div>`:''}
    <div style="font-size:12px;font-weight:700;display:flex;justify-content:space-between;padding:5px 0;margin-top:4px;border-top:1px solid #8FD0B0">
      <span style="color:var(--verde)">Total ganhos EXP</span>
      <span style="font-family:var(--font-mono);color:var(--verde)">${fmt(totalGanhoEXP)}</span>
    </div>
  </div>`;

  // DISTRIBUIÃ‡ÃƒO POR ETAPA
  if (cItems.length && totI>0) {
    const nMain  = cItems[0].nucleo;
    const subKey = cItems[0].subK;
    const ets    = S.etapas[nMain]?.[subKey] || S.etapas[nMain]?.default || [];
    const dists  = S.distEtapas[nMain]?.[subKey] || S.distEtapas[nMain]?.default || [];
    if (ets.length) {
      html+=`<div style="margin-top:12px;border-top:1px solid var(--cinza2);padding-top:10px">
        <div class="sec" style="color:#aaa">DistribuiÃ§Ã£o por etapa <span style="font-weight:400;font-size:9px">(serviÃ§os EXP)</span></div>
        ${ets.map((e,i)=>{
          const pct=dists[i]||0, val=totI*pct/100;
          return`<div style="display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px solid var(--cinza2);font-size:11px;color:#888">
            <div style="width:16px;height:16px;border-radius:50%;background:var(--cinza2);display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;flex-shrink:0">${i+1}</div>
            <span style="flex:1">${e}</span>
            <span>${pct}%</span>
            <span style="font-family:var(--font-mono);min-width:80px;text-align:right;color:#555">${fmt(val)}</span>
          </div>`;
        }).join('')}
        ${ganhoSubs>0?`<div style="display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px solid var(--cinza2);font-size:11px;color:var(--verde)">
          <div style="width:16px;flex-shrink:0"></div>
          <span style="flex:1">+ Ganho EXP s/ subcontrataÃ§Ãµes</span>
          <span style="font-family:var(--font-mono);color:var(--verde);font-weight:600">${fmt(ganhoSubs)}</span>
        </div>`:''}
      </div>`;
    }
  }

  // LOG DE EDIÃ‡Ã•ES
  const editados = cItems.filter(i=>i.editJust);
  if (editados.length) {
    html+=`<div style="margin-top:10px;background:var(--off);border:1px solid var(--cinza);padding:10px">
      <div class="sec">Registro de alteraÃ§Ãµes de valor</div>
      ${editados.map(it=>`<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:5px;padding:4px 0;border-bottom:1px solid var(--cinza2);font-size:10px">
        <div><strong>${it.subLabel}</strong>${it.id?' â€” '+it.id:''}<br><span style="color:#888;font-size:9px">${it.editJust}</span></div>
        <div style="text-align:right;text-decoration:line-through;color:#bbb">${fmt(it.valorCalc)}</div>
        <div style="text-align:right;color:var(--verde);font-weight:700">${fmt(it.valorProposto)}</div>
      </div>`).join('')}
    </div>`;
  }

  body.innerHTML = html;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SALVAR / LIMPAR / PDF
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Retorna label legÃ­vel de versÃ£o: 0 â†’ 'Original', 1 â†’ 'R1', 2 â†’ 'R2' ...
function _verLabel(v) { return (v === 0 || v == null) ? 'Original' : 'R' + v; }

async function salvarProposta() {
  const proj = document.getElementById('f-projeto').value.trim();
  if (!proj) { showBlocked('Informe o nome do projeto'); return; }
  if (!cItems.length) { showBlocked('Adicione ao menos um serviÃ§o'); return; }
  const totI  = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
  const rep   = getRepasseCalc(totI);
  const total = totI+(rep?rep.valorRep:0)+cSubs.reduce((s,c)=>s+c.valComBit,0)+getTotDesp();
  const ganhoSubsVal = cSubs.reduce((s,c)=>s+c.ganhoEXP,0);
  const ganhoTecVal  = cDesps.filter(d=>d.tipo==='horasTec'&&d.confirmada).reduce((s,d)=>s+calcDesp(d),0);
  const totalEfetivo = totI + ganhoSubsVal + ganhoTecVal;
  const nucs  = [...new Set(cItems.map(i=>i.nucleo))];

  let version  = 0;
  let propCode = null;
  let parentId = null;
  let status   = 'ativa';

  // Se estamos revisando uma proposta existente
  if (editingProposalId !== null) {
    const orig = S.proposals.find(p=>p.id===editingProposalId);
    if (orig) {
      version  = (orig.version || 0) + 1;
      propCode = orig.propCode || null;
      parentId = orig.parentId || orig.id;
      // A proposta original NÃƒO Ã© marcada como 'revisada' â€” permanece 'ativa'
    }
    editingProposalId = null;
  }

  // Nova proposta: gera propCode sequencial
  if (propCode === null) {
    refreshProposalCaches();
    S.propCodeSeq = (S.propCodeSeq||0) + 1;
    propCode = S.propCodeSeq;
  }

  const p = {
    id:          Date.now(),
    version,
    propCode,
    parentId,
    status,
    cliente:     document.getElementById('f-cliente').value.trim(),
    clienteId:   document.getElementById('f-cliente').dataset.clienteId || null,
    projeto:     proj,
    resp:        document.getElementById('f-resp').value,
    cidade:      document.getElementById('f-cidade').value.trim(),
    uf:          document.getElementById('f-uf').value,
    obs:         document.getElementById('f-obs').value.trim(),
    data:        document.getElementById('f-data').value,
    mainNucleo:  nucs.length>1?'MISTO':nucs[0],
    items:       [...cItems],
    subs:        [...cSubs],
    desps:       [...cDesps],
    repasse:     rep,
    despBit:     +(document.getElementById('desp-bit').value)||0,
    total,
    totalEfetivo,
    createdAt:   new Date().toISOString(),
    cubSnap:     S.cub,
    cubMes:      S.cubMes,
  };

  await ensureSharedClientForProposal(p);

  S.proposals.unshift(p);
  refreshProposalCaches();
  save();

  // Sincroniza com Supabase
  const synced = await syncProposalToSupabase(p);
  const syncMsg = synced ? ' Â· sincronizado na nuvem âœ“' : '';
  showToast('Proposta salva' + syncMsg);

  document.getElementById('sync-status-bar').textContent = synced
    ? 'Proposta registrada na nuvem â€” consultÃ¡vel por qualquer login da equipe.'
    : (S.sbUrl ? 'Salva localmente. Configure o Supabase para sincronizar.' : 'Salva localmente.');

  // Limpa formulÃ¡rio apÃ³s salvar
  cItems=[]; cDesps=[]; cSubs=[]; cRepasse=null; editingProposalId=null;
  linkedOppInfo=null; lockedNucleos=new Set();
  ['f-cliente','f-projeto','f-cidade','f-obs','f-uf'].forEach(id=>{
    const e=document.getElementById(id); if(e)e.value='';
  });
  clearClienteSelectionMeta();
  document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
  document.getElementById('repasse-form').style.display='none';
  document.getElementById('repasse-preview').style.display='none';
  document.getElementById('repasse-empty').style.display='block';
  document.getElementById('rep-nome').value='';
  document.getElementById('rep-val').value='';
  document.getElementById('sub-form').style.display='none';
  renderDesps(); renderSubList();
  updateDespVisibility(); updateSubVisibility();
  calcResumo(); updateCardBars();
  save();
}

function limpar() {
  cItems=[]; cDesps=[]; cSubs=[]; cRepasse=null; editingProposalId=null;
  linkedOppInfo=null; lockedNucleos=new Set();
  ['f-cliente','f-projeto','f-cidade','f-obs','f-uf'].forEach(id=>{
    const e=document.getElementById(id);if(e)e.value='';
  });
  clearClienteSelectionMeta();
  document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
  document.getElementById('repasse-form').style.display='none';
  document.getElementById('repasse-preview').style.display='none';
  document.getElementById('repasse-empty').style.display='block';
  document.getElementById('rep-nome').value='';
  document.getElementById('rep-val').value='';
  document.getElementById('sub-form').style.display='none';
  renderDesps(); renderSubList();
  updateDespVisibility(); updateSubVisibility();
  calcResumo(); updateCardBars();
  document.getElementById('sync-status-bar').textContent='';
  save();
  showToast('Calculadora limpa');
}

// â”€â”€ EXPORTAR PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sanitizeFilename(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
}

function exportarPDF() {
  if (!cItems.length && !cSubs.length) { showBlocked('Adicione serviÃ§os antes de exportar'); return; }

  const proj     = document.getElementById('f-projeto').value.trim() || 'Proposta';
  const cliente  = document.getElementById('f-cliente').value.trim() || 'â€”';
  const respEl   = document.getElementById('f-resp');
  const respNome = respEl ? respEl.options[respEl.selectedIndex]?.text || respEl.value : 'â€”';
  const dataVal  = document.getElementById('f-data').value;
  const data     = fmtD(dataVal);
  const cidade   = document.getElementById('f-cidade').value.trim();
  const uf       = document.getElementById('f-uf').value;
  const obs      = document.getElementById('f-obs').value.trim();

  // Tenta obter propCode/version da proposta em ediÃ§Ã£o ou usa defaults
  let propCode = null, version = 0;
  if (editingProposalId !== null) {
    const orig = S.proposals.find(p=>p.id===editingProposalId);
    if (orig) { propCode = orig.propCode; version = (orig.version||0)+1; }
  } else {
    // Busca pela proposta de maior versÃ£o com este projeto/cliente
    const matches = S.proposals.filter(p=>p.projeto===proj && p.cliente===cliente);
    const match = matches.sort((a,b)=>(b.version||0)-(a.version||0))[0];
    if (match) { propCode = match.propCode; version = match.version||0; }
  }
  const codStr  = propCode ? `EXP-${String(propCode).padStart(3,'0')}` : 'EXP-RASCUNHO';
  const versStr = _verLabel(version);

  const totI    = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
  const rep     = getRepasseCalc(totI);
  const totRep  = rep ? rep.valorRep : 0;
  const totSub  = cSubs.reduce((s,c)=>s+c.valComBit,0);
  const ganhoSubs = cSubs.reduce((s,c)=>s+c.ganhoEXP,0);
  const totDesp = getTotDesp();
  const rawDesp = cDesps.reduce((s,d)=>s+calcDesp(d),0);
  const bitDesp = +document.getElementById('desp-bit').value||0;
  const bitDespAmt = rawDesp*(bitDesp/100);
  const total   = totI + totRep + totSub + totDesp;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W=210, M=16, TW=W-M*2;
  let y = 0;

  const CL = { black:[17,17,16], gray:[160,160,158], lgray:[210,209,204],
               verde:[29,106,74], am:[196,131,26], tc:[184,76,58],
               az:[29,79,160], white:[255,255,255] };

  function chkPage(need=14) { if(y>285-need){doc.addPage();y=18;} }

  // â”€â”€ CABEÃ‡ALHO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.setFillColor(...CL.black); doc.rect(0,0,W,18,'F');
  doc.setTextColor(...CL.white);
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('EXP', M, 12);
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text('Proposta de HonorÃ¡rios', M+14, 12);
  doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text(`${codStr}  ${versStr}`, W-M, 12, {align:'right'});
  y = 26;

  // â”€â”€ NOME DO PROJETO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.setTextColor(...CL.black);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text(proj, M, y, {maxWidth:TW-40}); y+=8;

  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...CL.gray);
  const infoLine = `${cliente}   Â·   ${respNome}   Â·   ${cidade}${uf?' ('+uf+')':''}   Â·   ${data}`;
  doc.text(infoLine, M, y, {maxWidth:TW}); y+=5;

  if (obs) {
    doc.setFontSize(8); doc.setTextColor(...CL.gray);
    const obsLines = doc.splitTextToSize(obs, TW);
    doc.text(obsLines, M, y); y += obsLines.length*4+2;
  }
  doc.setDrawColor(...CL.lgray); doc.line(M, y, W-M, y); y+=6;

  // â”€â”€ PRODUTOS / SERVIÃ‡OS EXP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const NCOR_PDF = { PAIS:CL.verde, URB:CL.az, CONSUL:CL.tc, ESP:CL.am };
  ['PAIS','URB','CONSUL','ESP'].forEach(nuc=>{
    const its = cItems.filter(i=>i.nucleo===nuc);
    if (!its.length) return;
    const stot = its.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
    const cor  = NCOR_PDF[nuc]||CL.black;
    chkPage(10);
    doc.setFillColor(...cor); doc.rect(M,y-3,TW,7,'F');
    doc.setTextColor(...CL.white); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text(NC[nuc].toUpperCase(), M+3, y+1);
    doc.text(fmt(stot), W-M-2, y+1, {align:'right'});
    y+=8;

    its.forEach(it=>{
      chkPage(14);
      const disp = it.valorProposto!==null?it.valorProposto:it.valorCalc;
      const isEd = it.valorProposto!==null;
      let detail='';
      if(it.mode==='calc'){
        if(it.subK==='PAIS_ARB') detail=`${(+it.area).toLocaleString('pt-BR')} mÂ² SV`;
        else if(it.nucleo==='URB') detail=`${(+it.area).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha Â· coef. ${(+it.coef).toFixed(2)}`;
        else detail=`${(+it.area).toLocaleString('pt-BR')} mÂ² Â· coef. ${(+it.coef).toFixed(2)}`;
      } else if(it.mode==='floreira') detail=`${(+it.area).toFixed(2)} CUB`;
      else if(it.mode==='consul') detail=`${it.horas||0}h`;

      doc.setTextColor(...CL.black); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      const itemLabel = it.subLabel+(it.desc?' â€” '+it.desc:'')+(it.id?' / '+it.id:'');
      doc.text(itemLabel, M+3, y, {maxWidth:TW-30});
      doc.text(fmt(disp), W-M-2, y, {align:'right'});
      if (detail) {
        doc.setFont('helvetica','normal'); doc.setTextColor(...CL.gray); doc.setFontSize(7);
        doc.text(detail, M+3, y+4);
      }
      if (isEd && it.editJust) {
        doc.setFont('helvetica','italic'); doc.setTextColor(...CL.gray); doc.setFontSize(7);
        const justLines = doc.splitTextToSize(`Justif.: ${it.editJust} (calc. ${fmt(it.valorCalc)})`, TW-30);
        doc.text(justLines, M+3, y+(detail?8:4));
        y += justLines.length*3.5;
      }
      doc.setDrawColor(...CL.lgray); doc.line(M,y+(detail?8:5),W-M,y+(detail?8:5));
      y += detail ? 11 : 7;
    });
    y+=3;
  });

  // S5-01 â€” REPASSE (movido para antes de SubcontrataÃ§Ãµes)
  if (rep) {
    chkPage(10);
    doc.setFillColor(251,243,232); doc.rect(M,y-3,TW,7,'F');
    doc.setTextColor(...CL.am); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text('REPASSE COMERCIAL', M+3, y+1);
    doc.text(fmt(totRep), W-M-2, y+1, {align:'right'}); y+=9;
    doc.setTextColor(...CL.black); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text(`${rep.nome}  Â·  ${rep.tipo==='pct'?`${rep.val}% sobre serviÃ§os`:'Valor fixo'}`, M+3, y);
    doc.setFont('helvetica','bold'); doc.text(fmt(totRep), W-M-2, y, {align:'right'});
    doc.setDrawColor(...CL.lgray); doc.line(M,y+4,W-M,y+4); y+=8;
  }

  // S5-01+S5-02 â€” SUBCONTRATAÃ‡Ã•ES (layout corrigido: 2 linhas por item, sem overflow)
  if (cSubs.length) {
    chkPage(12);
    doc.setFillColor(251,240,238); doc.rect(M,y-3,TW,7,'F');
    doc.setTextColor(...CL.tc); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text('SUBCONTRATAÃ‡Ã•ES', M+3, y+1);
    doc.text(fmt(totSub), W-M-2, y+1, {align:'right'}); y+=9;

    cSubs.forEach(sc=>{
      chkPage(18);
      // Linha 1: serviÃ§o + total alinhado Ã  direita
      doc.setTextColor(...CL.black); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.text(sc.serv, M+3, y, {maxWidth: TW-35});
      doc.text(fmt(sc.valComBit), W-M-2, y, {align:'right'});
      // Linha 2: empresa Â· data
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...CL.gray);
      const infoSub = [sc.emp, sc.data ? fmtD(sc.data) : ''].filter(Boolean).join(' Â· ');
      if (infoSub) { doc.text(infoSub, M+3, y+4.5); }
      // Linha 3: breakdown custo + bitrib + ganho EXP
      doc.setFontSize(7);
      const breakdownParts = [`Custo: ${fmt(sc.val)}`];
      if (sc.bit > 0) breakdownParts.push(`+ Bitrib. ${sc.bit}%: ${fmt(sc.val * sc.bit / 100)}`);
      if (sc.ganhoEXP > 0) breakdownParts.push(`Â· Ganho EXP (${sc.ret}%): ${fmt(sc.ganhoEXP)}`);
      doc.setTextColor(...CL.gray);
      doc.text(breakdownParts.join('   '), M+3, y+9, {maxWidth: TW-6});
      doc.setDrawColor(...CL.lgray); doc.line(M, y+13, W-M, y+13); y+=16;
    });
    if (ganhoSubs>0) {
      doc.setTextColor(...CL.verde); doc.setFont('helvetica','bold'); doc.setFontSize(7);
      doc.text(`Ganho EXP total s/ subcontrataÃ§Ãµes: ${fmt(ganhoSubs)}`, M+3, y); y+=6;
    }
  }

  // S5-01+S5-03 â€” DESPESAS INDIRETAS (breakdown por item com fÃ³rmula de cÃ¡lculo)
  if (cDesps.length) {
    chkPage(12);
    doc.setFillColor(245,245,243); doc.rect(M,y-3,TW,7,'F');
    doc.setTextColor(...CL.gray); doc.setFont('helvetica','bold'); doc.setFontSize(8);
    doc.text('DESPESAS INDIRETAS', M+3, y+1);
    doc.text(fmt(totDesp), W-M-2, y+1, {align:'right'}); y+=9;

    const DLBL = { alim:'AlimentaÃ§Ã£o', carro:'VeÃ­culo', translado:'Translado', hotel:'Hospedagem', passagem:'Passagem', horasTec:'Horas tÃ©cnicas (interno)' };
    cDesps.filter(d=>d.confirmada).forEach(d=>{
      chkPage(12);
      const val = calcDesp(d);
      const lbl = DLBL[d.tipo] || d.tipo;
      const det = d.desc || d.cidade || '';
      // FÃ³rmula de cÃ¡lculo por tipo
      let formula = '';
      if (d.tipo==='alim' && (+d.diarias||0)>0)
        formula = `${d.diarias} diÃ¡rias Ã— ${d.pessoas||1} pessoa(s) Ã— ${fmt(d.valorDiario||0)}`;
      else if (d.tipo==='carro')
        formula = `${d.diarias||0}d Ã— ${fmt(d.valorDiaria||0)}${+d.km>0?' + '+d.km+'km':''}`;
      else if (d.tipo==='hotel' && (+d.diarias||0)>0)
        formula = `${d.diarias} diÃ¡rias Ã— ${fmt(d.valorDiaria||0)}`;
      else if (d.tipo==='horasTec' && (+d.dias||0)>0)
        formula = `${d.dias}d Ã— ${d.horasDia||0}h Ã— ${fmt(d.valorHora||0)}/h`;

      doc.setTextColor(...CL.black); doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text(lbl+(det?' â€” '+det:''), M+3, y, {maxWidth: TW-30});
      if (d.tipo !== 'horasTec') {
        doc.setFont('helvetica','bold');
        doc.text(fmt(val), W-M-2, y, {align:'right'});
      }
      if (formula) {
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...CL.gray);
        doc.text(formula, M+3, y+4.5);
      }
      doc.setDrawColor(...CL.lgray); doc.line(M, y+(formula?8:4), W-M, y+(formula?8:4));
      y += formula ? 11 : 7;
    });
    if (bitDesp>0) {
      doc.setTextColor(...CL.gray); doc.setFontSize(7);
      doc.text(`Bruto: ${fmt(rawDesp)}  +  BitributaÃ§Ã£o ${bitDesp}%: ${fmt(bitDespAmt)}  =  Total: ${fmt(totDesp)}`, M+3, y); y+=5;
    }
    y+=2;
  }

  // â”€â”€ TOTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  chkPage(16);
  y+=2;
  doc.setFillColor(...CL.black); doc.rect(M,y,TW,14,'F');
  doc.setTextColor(...CL.white); doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('VALOR TOTAL DA PROPOSTA', M+4, y+8);
  doc.setFontSize(14); doc.text(fmt(total), W-M-4, y+9, {align:'right'});
  y+=18;

  // S5-01 â€” DISTRIBUIÃ‡ÃƒO POR ETAPA (movida para antes do Ganho EXP)
  if (cItems.length && totI>0) {
    const nMain  = cItems[0].nucleo;
    const subKey = cItems[0].subK;
    const ets    = S.etapas[nMain]?.[subKey] || S.etapas[nMain]?.default || [];
    const dists  = S.distEtapas[nMain]?.[subKey] || S.distEtapas[nMain]?.default || [];
    if (ets.length) {
      chkPage(10+ets.length*6);
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...CL.gray);
      doc.text('DISTRIBUIÃ‡ÃƒO POR ETAPA  Â·  serviÃ§os EXP', M+2, y); y+=5;
      doc.setDrawColor(...CL.lgray); doc.line(M,y,W-M,y); y+=3;
      ets.forEach((e,i)=>{
        const pct=dists[i]||0, val=totI*pct/100;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...CL.gray);
        doc.text(`${i+1}. ${e}`, M+2, y);
        doc.text(`${pct}%`, M+90, y, {align:'right'});
        doc.text(fmt(val), W-M-2, y, {align:'right'});
        doc.setDrawColor(...CL.lgray); doc.line(M,y+2.5,W-M,y+2.5); y+=5;
      });
      y+=4;
    }
  }

  // â”€â”€ GANHO EXP (interno â€” sempre ao final) â”€â”€â”€â”€â”€â”€â”€â”€
  chkPage(18);
  doc.setFillColor(234,245,238); doc.rect(M,y,TW,ganhoSubs>0?16:11,'F');
  doc.setTextColor(...CL.verde); doc.setFont('helvetica','bold'); doc.setFontSize(7);
  doc.text('GANHO EXP', M+3, y+5);
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  doc.text(`ServiÃ§os EXP: ${fmt(totI)}`, M+3, y+10);
  if (ganhoSubs>0) {
    doc.text(`Ganho s/ subcontrataÃ§Ãµes: ${fmt(ganhoSubs)}`, M+3, y+14);
    doc.setFont('helvetica','bold');
    doc.text(`Total ganhos EXP: ${fmt(totI+ganhoSubs)}`, W-M-2, y+14, {align:'right'});
    y+=18;
  } else {
    doc.setFont('helvetica','bold'); doc.text(`Total ganhos EXP: ${fmt(totI)}`, W-M-2, y+10, {align:'right'});
    y+=14;
  }
  y+=6;

  // â”€â”€ RODAPÃ‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const dateStr   = new Date().toLocaleDateString('pt-BR');
  const yyyymmdd  = dataVal ? dataVal.replace(/-/g,'') : new Date().toISOString().slice(0,10).replace(/-/g,'');
  const pagesCount= doc.internal.getNumberOfPages();
  for (let i=1;i<=pagesCount;i++) {
    doc.setPage(i);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...CL.gray);
    doc.text(`EXP Arquitetura  Â·  ${codStr}  ${versStr}  Â·  Gerado em ${dateStr}`, M, 292);
    doc.text(`${i}/${pagesCount}`, W-M, 292, {align:'right'});
  }

  const fn = `EXP_${sanitizeFilename(cliente)}_${sanitizeFilename(proj)}_${codStr.replace('-','')}_${versStr}_${yyyymmdd}.pdf`;
  doc.save(fn);
  showToast('PDF exportado: ' + fn);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HISTÃ“RICO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function atualizarFiltroPeriodo() {
  const tipo = document.getElementById('hf-periodo').value;
  const sel  = document.getElementById('hf-periodo-val');
  sel.innerHTML = '';
  if (tipo === 'todos') { sel.style.display='none'; renderHist(); return; }
  sel.style.display = '';
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  if (tipo === 'ano') {
    const anos = [...new Set(S.proposals.map(p=>(p.data||'').slice(0,4)).filter(Boolean))].sort().reverse();
    if (!anos.includes(String(ano))) anos.unshift(String(ano));
    anos.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o); });
  } else if (tipo === 'semestre') {
    for (let a=ano; a>=ano-2; a--) {
      [2,1].forEach(s=>{ const o=document.createElement('option'); o.value=`${a}-S${s}`; o.textContent=`${a} â€” ${s}Âº semestre`; sel.appendChild(o); });
    }
    sel.value = `${ano}-S${hoje.getMonth()<6?1:2}`;
  } else if (tipo === 'trimestre') {
    for (let a=ano; a>=ano-1; a--) {
      [4,3,2,1].forEach(t=>{ const o=document.createElement('option'); o.value=`${a}-T${t}`; o.textContent=`${a} â€” ${t}Âº tri`; sel.appendChild(o); });
    }
    sel.value = `${ano}-T${Math.ceil((hoje.getMonth()+1)/3)}`;
  } else if (tipo === 'mes') {
    const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    for (let a=ano; a>=ano-1; a--) {
      for (let m=11; m>=0; m--) {
        const o=document.createElement('option'); o.value=`${a}-${String(m+1).padStart(2,'0')}`; o.textContent=`${meses[m]} ${a}`; sel.appendChild(o);
      }
    }
    sel.value = `${ano}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  }
  renderHist();
}

const RESP_LABEL={CC:'Carlos',GB:'Gabriela',TC:'Thayssa',LA:'LaÃ­s'};
window.RESP_LABEL=RESP_LABEL;

function renderHist() {
  const nucFil    = document.getElementById('hf-nucleo').value;
  const respFil   = document.getElementById('hf-resp').value;
  const crmFil    = (document.getElementById('hf-crm') || {}).value || 'todos';
  const q         = (document.getElementById('hf-search').value||'').toLowerCase();
  const tipo      = document.getElementById('hf-periodo').value;
  const periodoV  = document.getElementById('hf-periodo-val').value;

  // Filtra por nÃºcleo, responsÃ¡vel, busca e perÃ­odo â€” sem filtrar por status
  const fps = S.proposals.filter(p=>{
    if(nucFil!=='todos'&&p.mainNucleo!==nucFil&&p.mainNucleo!=='MISTO')return false;
    if(respFil!=='todos'&&p.resp!==respFil)return false;
    if(q&&!p.projeto.toLowerCase().includes(q)&&!(p.cliente||'').toLowerCase().includes(q))return false;
    if(tipo!=='todos' && periodoV) {
      const data = p.data||'';
      if(tipo==='ano' && data.slice(0,4)!==periodoV) return false;
      if(tipo==='semestre') {
        const [a,s]=periodoV.split('-S'); const m=parseInt(data.slice(5,7));
        if(data.slice(0,4)!==a) return false;
        if(s==='1'&&m>6) return false;
        if(s==='2'&&m<7) return false;
      }
      if(tipo==='trimestre') {
        const [a,t]=periodoV.split('-T'); const m=parseInt(data.slice(5,7));
        if(data.slice(0,4)!==a) return false;
        const tri=Math.ceil(m/3);
        if(String(tri)!==t) return false;
      }
      if(tipo==='mes' && data.slice(0,7)!==periodoV) return false;
    }
    return true;
  });

  // Agrupa por famÃ­lia (parentId ou prÃ³prio id)
  const familyMap = {};
  fps.forEach(p=>{
    const fid = p.parentId || p.id;
    if(!familyMap[fid]) familyMap[fid]=[];
    familyMap[fid].push(p);
  });

  // Ordena cada famÃ­lia: versÃ£o mais alta primeiro
  const sortedFamilies = Object.values(familyMap).map(fam=>{
    fam.sort((a,b)=>(b.version||0)-(a.version||0));
    return fam;
  // FamÃ­lias ordenadas pela data da proposta mais recente
  }).sort((a,b)=> (b[0].createdAt||b[0].data||'') > (a[0].createdAt||a[0].data||'') ? 1 : -1);

  // histSoAativas agora = "apenas Ãºltima versÃ£o por famÃ­lia"
  const rows = [];
  const familiesToRender = sortedFamilies.filter(fam => {
    if (crmFil === 'sem_vinculo') return !isProposalFamilyLinkedToCRM(fam[0]);
    return true;
  });
  familiesToRender.forEach(fam=>{
    if(S.histSoAativas){
      rows.push({ p: fam[0], isLatest: true, famSize: fam.length });
    } else {
      fam.forEach((p,i)=>rows.push({ p, isLatest: i===0, famSize: fam.length }));
    }
  });

  const RESP_LABEL=window.RESP_LABEL;

  document.getElementById('hist-body').innerHTML = rows.length
    ? rows.map(({p, isLatest, famSize})=>{
        const isFinalizada = p.status==='finalizada';
        // RevisÃµes antigas (nÃ£o latest) ficam em cinza claro â€” ainda clicÃ¡veis
        const rowStyle = (!isLatest) ? 'opacity:.55' : '';
        const cod = p.propCode
          ? `<span style="font-size:10px;font-family:var(--font-mono);font-weight:600">EXP-${String(p.propCode).padStart(3,'0')}</span>`
          : `<span style="font-size:9px;color:#aaa">#${p.id}</span>`;
        // Badge de versÃ£o: versÃ£o mais nova em azul, antigas em cinza
        const versBadge = isLatest
          ? `<span style="font-size:9px;color:var(--az);font-weight:700">${_verLabel(p.version||0)}</span>`
          : `<span style="font-size:9px;color:#aaa;font-weight:600">${_verLabel(p.version||0)}</span>`;
        const efetivo = p.totalEfetivo != null ? fmt(p.totalEfetivo) : `<span style="color:#bbb">â€”</span>`;
        // Status: finalizada = badge verde (pronta para CRM); revisada = badge laranja; ativa = sem badge
        const statusBadge = isFinalizada
          ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:var(--verde-bg);color:var(--verde);border:1px solid var(--verde);border-radius:4px;padding:2px 7px">âœ“ Finalizada</span>`
          : (p.status==='revisada' ? `<span class="badge-revisada">Revisada</span>` : '');
        // Indicador de famÃ­lia com mÃºltiplas versÃµes (apenas na latest)
        const famIndicator = (famSize > 1 && isLatest)
          ? `<span style="font-size:8px;background:var(--az-bg);color:var(--azul);padding:1px 5px;border-radius:3px;font-weight:700">${famSize}v</span>`
          : '';
        const clienteDisp = escHtml(p.cliente||'');
        const respDisp = escHtml(RESP_LABEL[p.resp]||p.resp||'');
        const semVinculoCRM = !isProposalFamilyLinkedToCRM(p);
        const crmBadge = semVinculoCRM ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:var(--tc-bg);color:var(--terracota);border:1px solid var(--terracota);border-radius:4px;padding:2px 7px">Sem CRM</span>` : '';
        const deleteBtn = semVinculoCRM
          ? `<button class="btn xs danger" onclick="event.stopPropagation();excluirProposta(${p.id})" title="Excluir proposta calculada">Excluir</button>`
          : `<button class="btn xs ghost" disabled title="Propostas vinculadas ao CRM nÃ£o podem ser excluÃ­das pela calculadora" style="opacity:.5;cursor:not-allowed">Vinculada</button>`;
        return `<tr class="click" style="${rowStyle}" onclick="abrirProposta(${p.id})">
          <td>${cod} ${famIndicator}</td>
          <td>${versBadge}</td>
          <td style="font-weight:500">${clienteDisp||'â€”'}</td>
          <td>${escHtml(p.projeto||'')}</td>
          <td><span class="badge ${NBADGE[p.mainNucleo]||'b-gr'}">${escHtml(NC[p.mainNucleo]||p.mainNucleo||'')}</span></td>
          <td>${respDisp||'â€”'}</td>
          <td style="font-size:10px">${escHtml(p.cidade||'')}${p.uf?' ('+escHtml(p.uf)+')':''}</td>
          <td style="font-size:10px">${fmtD(p.data)}</td>
          <td style="font-weight:700;font-family:var(--font-mono)">${fmt(p.total)}</td>
          <td style="font-weight:700;font-family:var(--font-mono);color:var(--verde)">${efetivo}</td>
          <td>${[statusBadge, crmBadge].filter(Boolean).join(' ')}</td>
          <td class="del-col">${deleteBtn}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="12" class="empty">Nenhuma proposta encontrada</td></tr>';

  // tfoot com totais â€” conta apenas latest por famÃ­lia para evitar dupla contagem
  const latestRows = rows.filter(r=>r.isLatest);
  const sumTotal    = latestRows.reduce((s,{p})=>s+(p.total||0),0);
  const sumEfetivo  = latestRows.filter(({p})=>p.totalEfetivo!=null).reduce((s,{p})=>s+(p.totalEfetivo||0),0);
  const hasEfetivo  = latestRows.some(({p})=>p.totalEfetivo!=null);
  const nFamilias   = latestRows.length;
  document.getElementById('hist-foot').innerHTML = rows.length
    ? `<tr style="border-top:2px solid var(--cinza)">
        <td colspan="8" style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#aaa;padding:6px 8px">${nFamilias} proposta${nFamilias!==1?'s':''}</td>
        <td style="font-weight:700;font-family:var(--font-mono);font-size:12px">${fmt(sumTotal)}</td>
        <td style="font-weight:700;font-family:var(--font-mono);font-size:12px;color:var(--verde)">${hasEfetivo?fmt(sumEfetivo):'â€”'}</td>
        <td></td>
        <td class="del-col"></td>
      </tr>`
    : '';
}

function abrirProposta(id) {
  const p = S.proposals.find(x=>x.id===id);
  if (!p) return;

  // Encontra versÃµes relacionadas
  const familyId = p.parentId || p.id;
  const family = S.proposals.filter(x=>(x.parentId===familyId||x.id===familyId)).sort((a,b)=>a.id-b.id);

  // Modal de detalhe
  const codDisp = p.propCode ? `EXP-${String(p.propCode).padStart(3,'0')}` : `#${p.id}`;
  document.getElementById('mhd-title').textContent = `${codDisp}  ${_verLabel(p.version||0)} â€” ${p.projeto}`;

  const body = document.getElementById('mhd-body');
  let html = '';

  // Info
  const clienteDetail = escHtml(p.cliente||'');
  const respDetail = escHtml(RESP_LABEL[p.resp]||p.resp||'');
  const cidadeDetail = escHtml(p.cidade||'');
  const ufDetail = escHtml(p.uf||'');
  html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">Cliente</div><div style="font-weight:600">${clienteDetail||'â€”'}</div></div>
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">ResponsÃ¡vel</div><div>${respDetail||'â€”'}</div></div>
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">Data</div><div>${fmtD(p.data)}</div></div>
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">Cidade</div><div>${cidadeDetail||'â€”'}${p.uf?' ('+ufDetail+')':''}</div></div>
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">Total</div><div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">${fmt(p.total)}</div></div>
    <div><div style="font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;font-weight:700">VersÃ£o</div><div><span style="font-weight:700;color:var(--az)">${_verLabel(p.version||0)}</span></div></div>
  </div>`;

  if (p.obs) {
    html += `<div style="background:var(--cinza2);padding:8px 11px;font-size:11px;color:#666;margin-bottom:12px">${escHtml(p.obs)}</div>`;
  }

  // Itens
  html += `<div class="sec">ServiÃ§os</div>`;
  (p.items||[]).forEach(it=>{
    const disp = it.valorProposto!==null?it.valorProposto:it.valorCalc;
    const subLabelDisp = escHtml(it.subLabel||'');
    const itemDescDisp = escHtml(it.desc||'');
    const itemIdDisp = escHtml(it.id||'');
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--cinza2);font-size:11px">
      <div>
        <span class="badge ${NBADGE[it.nucleo]}">${subLabelDisp}</span>
        ${it.desc?`<span style="color:#888;margin-left:5px">${itemDescDisp}</span>`:''}
        ${it.id?`<span style="color:#888;margin-left:5px">${itemIdDisp}</span>`:''}
      </div>
      <div style="font-weight:700;font-family:var(--font-mono)">${fmt(disp)}</div>
    </div>`;
  });

  // SubcontrataÃ§Ãµes
  if ((p.subs||[]).length) {
    html += `<div class="sec" style="margin-top:10px">SubcontrataÃ§Ãµes</div>`;
    p.subs.forEach(sc=>{
      const servDisp = escHtml(sc.serv||'');
      const empDisp = escHtml(sc.emp||'');
      html += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--cinza2);font-size:11px">
        <div>${servDisp} <span style="color:#888">Â· ${empDisp}</span></div>
        <div style="font-weight:700;color:var(--terracota)">${fmt(sc.valComBit)}</div>
      </div>`;
    });
  }

  // Total
  html += `<div style="background:var(--preto);color:#fff;padding:10px 13px;display:flex;justify-content:space-between;margin-top:12px">
    <span style="font-size:9px;font-weight:700;letter-spacing:1px;opacity:.6">VALOR TOTAL</span>
    <span style="font-size:16px;font-weight:700;font-family:var(--font-mono)">${fmt(p.total)}</span>
  </div>`;

  // HistÃ³rico de versÃµes da famÃ­lia
  if (family.length > 1) {
    html += `<div style="margin-top:14px"><div class="sec">VersÃµes desta proposta</div>`;
    family.forEach(v=>{
      const vc = v.propCode ? `EXP-${String(v.propCode).padStart(3,'0')}` : `#${v.id}`;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--cinza2);font-size:11px">
        <span style="font-family:var(--font-mono);font-size:10px;color:#aaa">${vc}</span>
        <span style="font-weight:700;color:var(--az)">${_verLabel(v.version||0)}</span>
        <span style="color:#888">${fmtD(v.data)}</span>
        <span style="flex:1"></span>
        <span style="font-family:var(--font-mono)">${fmt(v.total)}</span>
        <span>${v.status==='revisada'?'<span class="badge-revisada">Revisada</span>':v.status==='finalizada'?'<span class="badge-bloqueada">Finalizada</span>':'<span class="badge b-vd">Ativa</span>'}</span>
      </div>`;
    });
    html += `</div>`;
  }

  body.innerHTML = html;

  // Footer do modal
  const footer = document.getElementById('mhd-footer');
  footer.innerHTML = '';

  // PDF da proposta histÃ³rica
  const btnPdf = document.createElement('button');
  btnPdf.className = 'btn az sm';
  btnPdf.textContent = 'ðŸ“„ PDF';
  btnPdf.onclick = ()=>exportarPDFFromProposal(p);
  footer.appendChild(btnPdf);

  // BotÃ£o Finalizar / Reabrir proposta
  const _isFinalizada = p.status === 'finalizada';
  const btnFin = document.createElement('button');
  btnFin.className = _isFinalizada ? 'btn ghost sm' : 'btn verde sm';
  btnFin.style.cssText = _isFinalizada ? '' : 'font-weight:700';
  btnFin.textContent = _isFinalizada ? 'â†© Reabrir proposta' : 'âœ“ Finalizar proposta';
  btnFin.title = _isFinalizada
    ? 'Reabrir como ativa (remove da lista de finalizadas no CRM)'
    : 'Marcar como finalizada â€” ficarÃ¡ disponÃ­vel para vincular a uma oportunidade no CRM';
  btnFin.onclick = () => {
    const novoStatus = _isFinalizada ? 'ativa' : 'finalizada';
    const titulo = _isFinalizada ? 'Reabrir proposta' : 'Finalizar proposta';
    const msg = _isFinalizada
      ? 'Reabrir esta proposta como ativa?'
      : 'Finalizar esta proposta? Ela ficarÃ¡ marcada como "Finalizada" e poderÃ¡ ser vinculada a uma oportunidade no CRM.';
    const btnLabel = _isFinalizada ? 'Reabrir' : 'Finalizar';
    abrirPopupConfirm(titulo, msg, async () => {
      const idx = S.proposals.findIndex(x => x.id === p.id);
      if (idx !== -1) {
        S.proposals[idx].status = novoStatus;
        save();
        syncProposalToSupabase(S.proposals[idx]);
      }
      closeM('modal-hist-detail');
      renderHist();
    }, btnLabel);
  };
  footer.appendChild(btnFin);

  // SÃ³ permite revisar propostas nÃ£o-finalizadas
  if (p.status !== 'revisada' && p.status !== 'finalizada') {
    const btnRev = document.createElement('button');
    btnRev.className = 'btn am sm';
    btnRev.textContent = 'âœï¸ Criar revisÃ£o';
    btnRev.onclick = ()=>{
      closeM('modal-hist-detail');
      carregarPropostaParaRevisao(p);
    };
    footer.appendChild(btnRev);
  }

  openM('modal-hist-detail');
}

function carregarPropostaParaRevisao(p) {
  // Carrega os dados da proposta no formulÃ¡rio de cÃ¡lculo
  cItems  = JSON.parse(JSON.stringify(p.items||[]));
  cSubs   = JSON.parse(JSON.stringify(p.subs||[]));
  cDesps  = JSON.parse(JSON.stringify(p.desps||[])).map(d=>({confirmada:true,...d}));
  editingProposalId = p.id;

  document.getElementById('f-cliente').value = p.cliente||'';
  if (p.clienteId) document.getElementById('f-cliente').dataset.clienteId = p.clienteId;
  else clearClienteSelectionMeta();
  document.getElementById('f-projeto').value = p.projeto||'';
  document.getElementById('f-resp').value    = p.resp||'CC';
  document.getElementById('f-data').value    = p.data||new Date().toISOString().slice(0,10);
  document.getElementById('f-cidade').value  = p.cidade||'';
  document.getElementById('f-uf').value      = p.uf||'';
  document.getElementById('f-obs').value     = p.obs||'';

  if (p.repasse) {
    cRepasse = { ...p.repasse };
    const totI = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
    const valorRep = cRepasse.tipo==='pct' ? totI*cRepasse.val/100 : cRepasse.val;
    document.getElementById('rep-preview-nome').textContent = cRepasse.nome;
    document.getElementById('rep-preview-desc').textContent = cRepasse.tipo==='pct' ? `${cRepasse.val}% sobre serviÃ§os` : 'Valor fixo';
    document.getElementById('rep-preview-val').textContent  = fmt(valorRep);
    document.getElementById('repasse-preview').style.display = 'block';
    document.getElementById('repasse-empty').style.display   = 'none';
    document.getElementById('repasse-form').style.display    = 'none';
  } else {
    cRepasse = null;
    document.getElementById('repasse-preview').style.display = 'none';
    document.getElementById('repasse-empty').style.display   = 'block';
  }
  if (p.despBit !== undefined) {
    document.getElementById('desp-bit').value = p.despBit;
  }

  // ReconstrÃ³i lista de subs e desps
  renderSubList(); updateSubVisibility();
  renderDesps(); updateDespVisibility();
  calcResumo(); updateCardBars(); save();

  // C12/K4: verifica status CRM (async, atualiza resumo quando pronto)
  checkCRMLinkStatus(p.id).then(() => calcResumo());

  // Vai para aba calc
  goTab('calc');
  const nextVer = _verLabel((p.version||0)+1);
  showToast(`Proposta carregada â€” ao salvar serÃ¡ criada ${nextVer}`);
}

function exportarPDFFromProposal(p) {
  const origItems   = cItems, origSubs = cSubs, origDesps = cDesps, origRepasse = cRepasse;
  const origEditing = editingProposalId;
  const origFields  = ['f-cliente','f-projeto','f-resp','f-data','f-cidade','f-uf','f-obs'].map(id=>
    ({id, val:document.getElementById(id).value})
  );
  const origBit = document.getElementById('desp-bit').value;

  cItems = JSON.parse(JSON.stringify(p.items||[]));
  cSubs  = JSON.parse(JSON.stringify(p.subs||[]));
  cDesps = JSON.parse(JSON.stringify(p.desps||[])).map(d=>({confirmada:true,...d}));
  cRepasse = p.repasse ? { ...p.repasse } : null;
  editingProposalId = p.id; // para que exportarPDF use o propCode/version corretos
  document.getElementById('f-cliente').value = p.cliente||'';
  document.getElementById('f-projeto').value = p.projeto||'';
  document.getElementById('f-resp').value    = p.resp||'CC';
  document.getElementById('f-data').value    = p.data||'';
  document.getElementById('f-cidade').value  = p.cidade||'';
  document.getElementById('f-uf').value      = p.uf||'';
  document.getElementById('f-obs').value     = p.obs||'';
  if (p.despBit!==undefined) document.getElementById('desp-bit').value = p.despBit;

  try {
    exportarPDF();
  } finally {
    cItems = origItems; cSubs = origSubs; cDesps = origDesps; cRepasse = origRepasse;
    editingProposalId = origEditing;
    origFields.forEach(f=>{ document.getElementById(f.id).value = f.val; });
    document.getElementById('desp-bit').value = origBit;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PARÃ‚METROS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderParams() {
  const cubHistSafe = S.cubHist.map(h=>({ ...h, by:escHtml(h.by||''), at:escHtml(h.at?.slice(0,10)||'') }));
  document.getElementById('cub-hist-list').innerHTML = cubHistSafe.map(h=>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--cinza2);font-size:11px">
      <span style="color:#888">${fmtM(h.mes)}</span>
      <span style="font-family:var(--font-mono);font-weight:700;color:var(--ouro)">${fmt(h.val)}</span>
      <span style="color:#bbb;font-size:10px">${h.by} Â· ${h.at||''}</span>
    </div>`
  ).join('') || '<div class="empty">Nenhum registro</div>';

  // CALC-1+2: coluna "De" agora Ã© readonly (derivada da anterior), "AtÃ©" agora Ã© editÃ¡vel
  const fRow=(f,tipo,i)=>`<div style="display:grid;grid-template-columns:100px 100px 1fr 110px 22px;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--cinza2)">
    <input class="fgroup input" style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;font-family:var(--font-ui);background:var(--off);color:#888" type="text" value="${escAttr(i===0?'0':(S['f'+tipo][i-1]?.max===null?'âˆž':(S['f'+tipo][i-1]?.max??0)))}" placeholder="0" readonly tabindex="-1">
    <input class="fgroup input" style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;font-family:var(--font-ui)" type="number" value="${escAttr(f.max===null?'':(f.max||0))}" placeholder="âˆž" onchange="S.f${tipo}[${i}].max=this.value===''?null:parseFloat(this.value);renderParams()">
    <input class="fgroup input" style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;font-family:var(--font-ui)" type="text" value="${escAttr(f.label)}" onchange="S.f${tipo}[${i}].label=this.value">
    <input class="fgroup input" style="font-size:11px;border:1px solid var(--cinza);padding:4px 7px;font-family:var(--font-mono)" type="number" step="0.00001" value="${escAttr(f.mult)}" onchange="S.f${tipo}[${i}].mult=parseFloat(this.value)">
    <button class="btn xs danger" onclick="S.f${tipo}.splice(${i},1);renderParams()">âœ•</button>
  </div>`;
  document.getElementById('faixas-pais').innerHTML = S.fP.map((f,i)=>fRow(f,'P',i)).join('');
  document.getElementById('faixas-urb').innerHTML  = S.fU.map((f,i)=>fRow(f,'U',i)).join('');

  const allSubs = [];
  Object.entries(SUBS).forEach(([nuc,tipos])=>{
    if(nuc==='PAIS'){
      Object.entries(tipos).forEach(([tipo,subs])=>{
        Object.entries(subs).forEach(([sub,si])=>{ allSubs.push({nuc,tipo,sub,si}); });
      });
    } else {
      Object.entries(tipos).forEach(([sub,si])=>{ allSubs.push({nuc,tipo:null,sub,si}); });
    }
  });
  const allSubsSafe = allSubs.map(x=>({ ...x, tipo: x.tipo ? escHtml(x.tipo) : null, sub: escHtml(x.sub), nucDisp: escHtml(x.nuc) }));
  document.getElementById('mins-list').innerHTML = allSubsSafe
    .filter(x=>x.si.mode==='calc'||x.si.mode==='floreira')
    .map(x=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--cinza2)">
      <div>
        <span class="badge ${NBADGE[x.nuc]}">${x.nucDisp}</span>
        ${x.tipo?`<span style="font-size:10px;color:#888;margin-left:5px">${x.tipo} Â·</span>`:''}
        <span style="font-size:11px;margin-left:4px">${x.sub}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <input style="width:100px;font-size:11px;border:1px solid var(--cinza);padding:3px 7px;font-family:var(--font-mono);text-align:right" type="number" value="${escAttr(S.mins[x.si.k]||0)}" onchange="S.mins['${x.si.k}']=parseFloat(this.value)||0">
        <span style="font-size:10px;color:#888">mÃ­n.</span>
      </div>
    </div>`).join('');

  document.getElementById('p-diaria').value=S.params.diaria;
  document.getElementById('p-gas').value=S.params.gas;
  document.getElementById('p-car').value=S.params.car;

  // Carrega config Supabase
  if (S.sbUrl) document.getElementById('sb-url').value = S.sbUrl;
  if (S.sbKey) document.getElementById('sb-key').value = S.sbKey;

  renderEtapaNucleoTabs();
}

function addFaixa(tipo) {
  // CALC-2: inserir antes da Ãºltima faixa infinita, com "de" preenchido da anterior
  const arr = tipo==='P' ? S.fP : S.fU;
  const lastInfIdx = arr.findIndex(f => f.max === null);
  const insertIdx  = lastInfIdx >= 0 ? lastInfIdx : arr.length;
  const prevMax    = insertIdx > 0 ? (arr[insertIdx-1]?.max ?? 0) : 0;
  const novoMax    = prevMax > 0 ? Math.round(prevMax * 2) : 1000;
  arr.splice(insertIdx, 0, {
    max:  novoMax,
    mult: arr[insertIdx]?.mult || (tipo==='P' ? 0.001 : 0.00001),
    label: 'Nova faixa'
  });
  renderParams();
}

function saveParams() {
  S.params.diaria=+document.getElementById('p-diaria').value||680;
  S.params.gas   =+document.getElementById('p-gas').value||6.20;
  S.params.car   =+document.getElementById('p-car').value||180;
  save(); saveParamsToSupabase(); showToast('ParÃ¢metros salvos');
}

async function saveParamsToSupabase() {
  if (!S.sbUrl || !S.sbKey) return;
  setSyncStatus('sync', 'salvando...');
  const payload = {
    updated_at: new Date().toISOString(),
    cub: S.cub, cub_mes: S.cubMes, cub_hist: S.cubHist,
    fp: S.fP, fu: S.fU, mins: S.mins,
    etapas: S.etapas, dist_etapas: S.distEtapas, params: S.params,
  };
  try {
    const hdrs = { ...getSBHeaders() };
    let targetId = S.calcParamsId;
    if (!targetId) {
      const latestRow = await fetchLatestCalcParamsRow();
      targetId = latestRow?.id || null;
      if (targetId) S.calcParamsId = targetId;
    }
    if (targetId) {
      const r = await fetch(`${S.sbUrl}/rest/v1/calc_params?id=eq.${targetId}`, {
        method: 'PATCH', headers: hdrs, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
    } else {
      hdrs['Prefer'] = 'return=representation';
      const r = await fetch(`${S.sbUrl}/rest/v1/calc_params`, {
        method: 'POST', headers: hdrs, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      if (d?.[0]?.id) { S.calcParamsId = d[0].id; save(); }
    }
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('err', 'erro params');
    console.warn('saveParamsToSupabase:', e.message);
  }
}

async function loadParamsFromSupabase() {
  if (!S.sbUrl || !S.sbKey) return;
  try {
    const row = await fetchLatestCalcParamsRow();
    if (!row) return;
    S.calcParamsId = row.id;
    if (row.cub != null)         S.cub         = row.cub;
    if (row.cub_mes != null)     S.cubMes      = row.cub_mes;
    if (row.cub_hist != null)    S.cubHist     = row.cub_hist;
    if (row.fp != null)          S.fP          = row.fp;
    if (row.fu != null)          S.fU          = row.fu;
    if (row.mins != null)        S.mins        = row.mins;
    // CALC-3+4: merge profundo â€” preserva nucleos ausentes no registro do Supabase
    if (row.etapas != null)      S.etapas     = { ...S.etapas,     ...row.etapas };
    if (row.dist_etapas != null) S.distEtapas = { ...S.distEtapas, ...row.dist_etapas };
    if (row.params != null)      S.params      = row.params;
    save();
    updateCubDisplay();
    renderParams();
  } catch(e) {
    console.warn('loadParamsFromSupabase:', e.message);
  }
}

// â”€â”€ ETAPAS POR TIPO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderEtapaNucleoTabs() {
  selEtapaNucleo(editEtapaNucleo,
    document.querySelector('#etapa-nucleo-tabs button'));
}

function selEtapaNucleo(n, el) {
  editEtapaNucleo = n;
  document.querySelectorAll('#etapa-nucleo-tabs button').forEach(b=>{
    b.className='btn sm ghost';
  });
  if(el) el.className='btn sm filled';
  document.getElementById('etapa-nucleo-lbl').textContent = NC[n];

  const tipoGrp = document.getElementById('etapa-tipo-grp');
  const subGrp  = document.getElementById('etapa-sub-grp');
  const tipoSel = document.getElementById('etapa-tipo-sel');
  const subSel  = document.getElementById('etapa-sub-sel');

  if (n==='PAIS') {
    tipoGrp.style.display='';
    const tipos = Object.keys(SUBS.PAIS);
    tipoSel.innerHTML = tipos.map(t=>`<option value="${escAttr(t)}">${escHtml(t)}</option>`).join('');
    updateEtapaSubtipo();
  } else {
    tipoGrp.style.display='none';
    const subs = Object.keys(SUBS[n]||{});
    if (subs.length > 1) {
      subGrp.style.display='';
      subSel.innerHTML = ['(Geral)',...subs].map((s,i)=>`<option value="${escAttr(i===0?'default':SUBS[n][s].k)}">${escHtml(s)}</option>`).join('');
      editEtapaChave = subSel.value;
    } else {
      subGrp.style.display='none';
      editEtapaChave = 'default';
    }
    renderEtapasEditor();
  }
}

function updateEtapaSubtipo() {
  const n = editEtapaNucleo;
  if (n!=='PAIS') return;
  const tipo = document.getElementById('etapa-tipo-sel').value;
  const subs  = Object.keys(SUBS.PAIS[tipo]||{});
  const subGrp = document.getElementById('etapa-sub-grp');
  const subSel  = document.getElementById('etapa-sub-sel');
  if (subs.length>1) {
    subGrp.style.display='';
    subSel.innerHTML = ['(Todos os subtipos)',...subs].map((s,i)=>`<option value="${escAttr(i===0?'default':s)}">${escHtml(s)}</option>`).join('');
  } else {
    subGrp.style.display='none';
    editEtapaChave='default';
  }
  renderEtapasEditor();
}

function renderEtapasEditor() {
  const n   = editEtapaNucleo;
  const chave = editEtapaChave||'default';
  const ets   = S.etapas[n]?.[chave] || S.etapas[n]?.default || [];
  const dists = S.distEtapas[n]?.[chave] || S.distEtapas[n]?.default || [];
  const soma  = dists.reduce((s,d)=>s+d,0);

  let html = ets.map((e,i)=>`<div class="etapa-row">
    <input style="font-size:12px;border:1px solid var(--cinza);padding:4px 7px;font-family:var(--font-ui);width:100%" value="${escAttr(e)}" onchange="if(!S.etapas['${n}']['${chave}'])S.etapas['${n}']['${chave}']=[...S.etapas['${n}'].default];S.etapas['${n}']['${chave}'][${i}]=this.value">
    <div style="font-size:10px;color:#888;padding:4px 0">${NC[n]} / ${editEtapaChave!=='default'?editEtapaChave:'Geral'}</div>
    <div style="font-size:10px;color:#888;padding:4px 0">etapa ${i+1}</div>
    <div style="display:flex;align-items:center;gap:3px"><input style="width:50px;font-size:11px;border:1px solid var(--cinza);padding:4px 5px;font-family:var(--font-mono);text-align:center" type="number" value="${escAttr(dists[i]||0)}" onchange="if(!S.distEtapas['${n}']['${chave}'])S.distEtapas['${n}']['${chave}']=[...S.distEtapas['${n}'].default];S.distEtapas['${n}']['${chave}'][${i}]=parseInt(this.value)||0;renderEtapasEditor()"><span style="font-size:11px;color:#888">%</span></div>
    <button class="btn xs danger" onclick="S.etapas['${n}']['${chave}'].splice(${i},1);if(S.distEtapas['${n}']['${chave}'])S.distEtapas['${n}']['${chave}'].splice(${i},1);renderEtapasEditor()">âœ•</button>
  </div>`).join('');

  html+=`<div style="font-size:11px;color:${soma===100?'var(--verde)':'var(--tc)'};margin-top:6px;font-weight:500">Total: ${soma}% ${soma===100?'âœ“':'â† deve somar 100%'}</div>`;
  document.getElementById('etapas-editor').innerHTML=html;
}

function addEtapa() {
  const n=editEtapaNucleo, c=editEtapaChave||'default';
  if(!S.etapas[n][c]) S.etapas[n][c]=[...S.etapas[n].default];
  if(!S.distEtapas[n][c]) S.distEtapas[n][c]=[...S.distEtapas[n].default];
  S.etapas[n][c].push('Nova etapa');
  S.distEtapas[n][c].push(0);
  renderEtapasEditor();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NAV â€” Sprint B
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SUPABASE_URL_NAV     = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
const SUPABASE_ANON_KEY_NAV = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
const sbNav = supabase.createClient(SUPABASE_URL_NAV, SUPABASE_ANON_KEY_NAV);

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('exp-theme', next);
}
function toggleNavDropdown() {
  document.getElementById('nav-dropdown').classList.toggle('open');
}
function toggleUserMenu() {
  document.getElementById('user-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!document.getElementById('nav-mod-wrap')?.contains(e.target))
    document.getElementById('nav-dropdown')?.classList.remove('open');
  if (!document.getElementById('user-pill-wrap')?.contains(e.target))
    document.getElementById('user-dropdown')?.classList.remove('open');
  if (!document.getElementById('feedback-icon-wrap')?.contains(e.target))
    document.getElementById('nav-feedback-pop')?.classList.remove('open');
});
function toggleFeedbackPop(ev) {
  ev?.stopPropagation?.();
  document.getElementById('nav-feedback-pop')?.classList.toggle('open');
}
function fecharFeedbackPop() {
  document.getElementById('nav-feedback-pop')?.classList.remove('open');
}
function setFeedbackStatus(msg) {
  const el = document.getElementById('tool-feedback-status');
  if (el) el.textContent = msg;
}
async function enviarFeedback() {
  const u = JSON.parse(sessionStorage.getItem('exp_usuario') || '{}');
  if (!u?.id) { setFeedbackStatus('SessÃ£o indisponÃ­vel. FaÃ§a login para enviar feedback.'); return; }
  const tipo = document.getElementById('tool-feedback-type')?.value || 'problema';
  const mensagem = document.getElementById('tool-feedback-message')?.value?.trim() || '';
  if (!mensagem) { setFeedbackStatus('Descreva o problema ou a sugestÃ£o antes de enviar.'); return; }
  const tab = document.querySelector('.ntab.active')?.dataset?.tab || 'calc';
  setFeedbackStatus('Enviando...');
  const { error } = await sbNav.from('plataforma_feedback').insert({
    usuario_id: u.id,
    tipo,
    mensagem,
    status: 'novo',
    origem_modulo: 'Calc',
    url_origem: `calc.html#${tab}`,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  });
  if (error) { setFeedbackStatus('NÃ£o foi possÃ­vel enviar. Tente novamente.'); return; }
  document.getElementById('tool-feedback-message').value = '';
  setFeedbackStatus('Registro enviado para a GestÃ£o de plataforma.');
  showToast('Feedback enviado âœ“');
}
function normalizeRole(role) {
  if (typeof window.normalizeExpRole === 'function') return window.normalizeExpRole(role);
  const normalized = (role || '').toLowerCase().trim();
  return normalized === 'socio_adm' ? 'socio_admin' : normalized;
}
function initNavDropdown(role) {
  if (['socio','socio_admin'].includes(normalizeRole(role))) document.querySelectorAll('.nd-soc').forEach(el => el.style.display = '');
}
function canAccessCalcRole(role) {
  return ['socio','socio_admin'].includes(normalizeRole(role));
}
function buildExpUsuarioPayload(authId, usuario) {
  const nome = (usuario && usuario.nome) || '';
  return {
    auth_id: authId || null,
    app_user_id: usuario && typeof usuario.id !== 'undefined' ? usuario.id : null,
    nome,
    apelido: (usuario && usuario.apelido) || (nome ? nome.split(' ')[0] : ''),
    iniciais: (usuario && usuario.iniciais) || '',
    cor: (usuario && usuario.cor) || '#888',
    role: normalizeRole((usuario && usuario.role) || ''),
    viewer_only: !!(usuario && usuario.viewer_only),
    is_platform_manager: !!(usuario && usuario.is_platform_manager),
    can_coordinate_projects: !!(usuario && usuario.can_coordinate_projects),
    termo_status: (usuario && usuario.termo_status) || null,
    termo_assinado_em: (usuario && usuario.termo_assinado_em) || null,
    termo_expira_em: (usuario && usuario.termo_expira_em) || null,
    status_acesso: (usuario && usuario.status_acesso) || null
  };
}
async function sair() {
  await sbNav.auth.signOut();
  sessionStorage.removeItem('exp_usuario');
  window.location.href = 'index.html';
}
function initNavUserFromSession() {
  try {
    const u = JSON.parse(sessionStorage.getItem('exp_usuario') || '{}');
    const av = document.getElementById('nav-av');
    if (av) {
      if (u.avatar_url) {
        av.classList.add('has-avatar');
        av.innerHTML = `<img src="${u.avatar_url}" alt="${u.iniciais||''}">`;
      } else {
        av.textContent = u.iniciais || '?';
        av.style.cssText = `background:${u.cor||'#888'};color:#fff`;
      }
    }
    const nomeEl = document.getElementById('nav-nome');
    if (nomeEl) {
      const _np = (u.nome||'').trim().split(/\s+/).filter(Boolean);
      nomeEl.textContent = _np.length > 0
        ? (_np.length <= 2 ? _np.join(' ') : _np[0]+' '+_np[_np.length-1])
        : 'â€”';
    }
    const roleMap = { socio:'SÃ³cio', socio_adm:'SÃ³cio-administrador', socio_admin:'SÃ³cio-administrador', coordenador:'Coordenador', colaborador:'Colaborador' };
    const roleEl = document.getElementById('nav-role');
    if (roleEl) roleEl.textContent = u.role ? (roleMap[normalizeRole(u.role)] || roleMap[u.role] || u.role) : '';
    document.body.classList.toggle('can-delete', canAccessCalcRole(u.role));
    initNavDropdown(u.role);
    initExpRoom(u.app_user_id || u.id || u.auth_id, (u.nome||'').split(' ')[0]);
  } catch(e) { console.error('initNavUserFromSession:', e); }
}
// â”€â”€ EXP ROOM PRESENCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Requer: CREATE TABLE exp_config (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now(), updated_by text);
const EXP_ROOM_URL = 'https://meet.google.com/mqe-cgge-maz';
async function checkExpRoomStatus() {
  try {
    const { data } = await sbNav.from('exp_config').select('updated_at,value').eq('key','exp_room_active').maybeSingle();
    const btn = document.getElementById('exp-room-btn');
    if (!btn) return;
    if (data?.updated_at && (Date.now() - new Date(data.updated_at).getTime()) / 60000 <= 30) {
      btn.classList.add('active');
      const mins = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / 60000);
      const quem = (data.value && data.value !== 'true') ? data.value : 'AlguÃ©m';
      btn.setAttribute('data-tooltip', `${quem} Â· ${mins === 0 ? 'agora mesmo' : `hÃ¡ ${mins} min`}`);
    } else {
      btn.classList.remove('active');
      btn.removeAttribute('data-tooltip');
    }
  } catch(e) {}
}
async function registrarExpRoomClick(userId, userName) {
  try {
    await sbNav.from('exp_config').upsert({ key:'exp_room_active', value: userName||'true', updated_at: new Date().toISOString(), updated_by: userId||'' }, { onConflict:'key' });
  } catch(e) {}
}
function initExpRoom(userId, userName) {
  const btn = document.getElementById('exp-room-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    registrarExpRoomClick(userId, userName);
    btn.classList.add('active');
    btn.setAttribute('data-tooltip', `${userName||'VocÃª'} Â· agora mesmo`);
  });
  checkExpRoomStatus();
  setInterval(checkExpRoomStatus, 60000);
}
function initConnDot() {
  const dot = document.getElementById('conn-dot');
  if(!dot) return;
  const update = () => {
    dot.className = 'conn-dot ' + (navigator.onLine ? 'online' : 'offline');
    dot.title = navigator.onLine ? 'Conectado' : 'Sem conexÃ£o';
  };
  update();
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
}

function excluirProposta(id) {
  const proposal = S.proposals.find(p => p.id === id);
  if (!proposal) return;
  if (isProposalFamilyLinkedToCRM(proposal)) {
    showToast('Propostas vinculadas ao CRM nÃ£o podem ser excluÃ­das pela calculadora.');
    return;
  }
  const familyId = getProposalFamilyId(proposal);
  const family = S.proposals.filter(p => getProposalFamilyId(p) === familyId);
  const familySize = family.length;
  const confirmMsg = familySize > 1
    ? `Excluir permanentemente esta famÃ­lia de proposta, incluindo ${familySize} versÃµes? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`
    : 'Excluir esta proposta permanentemente? Esta aÃ§Ã£o nÃ£o pode ser desfeita.';
  abrirPopupConfirm('Excluir proposta', confirmMsg, async () => {
    try {
      if (S.sbUrl && S.sbKey) {
        const deleteFilter = familySize > 1
          ? `or=(proposal_id.eq.${encodeURIComponent(familyId)},parent_id.eq.${encodeURIComponent(familyId)})`
          : `proposal_id=eq.${encodeURIComponent(String(id))}`;
        const r = await fetch(S.sbUrl + '/rest/v1/exp_proposals?' + deleteFilter, {
          method: 'DELETE',
          headers: { ...getSBHeaders(true), 'Prefer': 'return=minimal' }
        });
        if (!r.ok && r.status !== 204) throw new Error('HTTP ' + r.status);
      }
      S.proposals = S.proposals.filter(p => getProposalFamilyId(p) !== familyId);
      S.crmLinkedProposalRoots = (S.crmLinkedProposalRoots || []).filter(root => String(root) !== familyId);
      save();
      renderHist();
      showToast(familySize > 1 ? 'FamÃ­lia de proposta excluÃ­da.' : 'Proposta excluÃ­da.');
    } catch(e) {
      showToast('Erro ao excluir: ' + e.message);
    }
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
load();

// Verifica sessÃ£o Supabase antes de mostrar qualquer conteÃºdo
document.body.style.visibility = 'hidden';
(async () => {
  try {
    const { data: { session } } = await sbNav.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    // Atualiza sessionStorage com dados frescos da sessÃ£o
    const { data: uDb } = await sbNav.from('usuarios').select('id, nome, iniciais, role, cor, viewer_only').eq('auth_id', session.user.id).maybeSingle();
    if (!uDb || !canAccessCalcRole(uDb.role)) {
      showToast('A calculadora estÃ¡ disponÃ­vel apenas para sÃ³cios e sÃ³cios administradores.');
      window.location.href = 'app.html';
      return;
    }
    if (uDb) sessionStorage.setItem('exp_usuario', JSON.stringify(buildExpUsuarioPayload(session.user.id, uDb)));
  } catch(e) {
    console.error('Erro na verificaÃ§Ã£o de sessÃ£o:', e);
    window.location.href = 'index.html';
    return;
  }
  document.body.style.visibility = '';
  _initCalc();
})();

function _initCalc() {
initNavUserFromSession();
initConnDot();
updateCubDisplay();
selNucleo('PAIS');
document.getElementById('f-data').value=new Date().toISOString().slice(0,10);
renderSubList(); updateSubVisibility();
renderDesps(); updateDespVisibility();

// Restaura visibilidade do repasse
if (cRepasse) {
  const totI = cItems.reduce((s,i)=>s+(i.valorProposto!==null?i.valorProposto:i.valorCalc),0);
  const valorRep = cRepasse.tipo==='pct' ? totI*cRepasse.val/100 : cRepasse.val;
  document.getElementById('rep-preview-nome').textContent = cRepasse.nome;
  document.getElementById('rep-preview-desc').textContent = cRepasse.tipo==='pct' ? `${cRepasse.val}% sobre serviÃ§os` : 'Valor fixo';
  document.getElementById('rep-preview-val').textContent  = fmt(valorRep);
  document.getElementById('repasse-preview').style.display = 'block';
  document.getElementById('repasse-empty').style.display   = 'none';
} else {
  document.getElementById('repasse-preview').style.display = 'none';
  document.getElementById('repasse-empty').style.display   = 'block';
}

calcResumo();
updateCardBars();

// Auto-configura Supabase com credenciais do sistema se nÃ£o configurado
if (!S.sbUrl) {
  S.sbUrl = SUPABASE_URL_NAV;
  S.sbKey = SUPABASE_ANON_KEY_NAV;
  save();
}

// Tenta sincronizar ao carregar se Supabase configurado
if (S.sbUrl && S.sbKey) {
  setSyncStatus('sync','conectando...');
  // Sobe propostas locais ainda nÃ£o sincronizadas, depois carrega do banco
  Promise.all([loadParamsFromSupabase(), loadProposalsFromSupabase()]).then(async () => {
    // Push backlog: propostas locais que nunca foram para o Supabase
    const pendentes = S.proposals.filter(p => !p._sbUpdatedAt);
    for (const p of pendentes) await syncProposalToSupabase(p);
    if (pendentes.length > 0) { save(); renderHist(); }
  });
} else {
  setSyncStatus('', 'local');
}

// Restaura estado de ediÃ§Ã£o ativa no banner
if (editingProposalId !== null) {
  calcResumo();
}

// Infra â€” polling de status CRM a cada 2 min quando revisando proposta vinculada
setInterval(async () => {
  if (editingProposalId !== null && S.sbUrl && S.sbKey) {
    const sizeBefore = lockedNucleos.size;
    await checkCRMLinkStatus(editingProposalId);
    // SÃ³ re-renderiza se algo mudou (evita piscar a tela)
    if (lockedNucleos.size !== sizeBefore || linkedOppInfo) calcResumo();
  }
}, 120000);
} // fim _initCalc

async function abrirLembretePopup() {
  let pop = document.getElementById('popup-lembrete');
  if (pop) { pop.remove(); return; }
  const _me = (() => { try { return JSON.parse(sessionStorage.getItem('exp_usuario') || '{}'); } catch(e) { return {}; } })();
  const { data: usuarios } = await sbNav.from('usuarios').select('id,nome').eq('ativo', true).order('nome');
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
  const { data: usuarios } = await sbNav.from('usuarios').select('id,nome').eq('ativo', true);
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





ExpNav.init({ module: 'calc' });

