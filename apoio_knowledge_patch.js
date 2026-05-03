(function(){
  const oldCarregarDados = carregarDados;
  const oldSalvarModal = salvarModal;
  const oldFecharModal = fecharModal;

  const DEFAULT_SECOES = [
    {
      slug: 'cultura-identidade',
      grupo: 'cultura',
      subgrupo: null,
      ordem: 1,
      titulo: 'Identidade EXP',
      resumo: 'Propósito, direção e a forma como a equipe se reconhece no trabalho.',
      corpo: `## Propósito
Conectar lugares com pessoas através de experiências.

## Missão
Conceber projetos que geram identidade por meio da experiência nos espaços coletivos do ecossistema imobiliário.

## Visão
Ser referência em paisagismo e urbanismo no cenário nacional.

## Valores
- Responsabilidade com resultado, processo e impacto das decisões.
- Curiosidade como motor de aprendizado e melhoria contínua.
- Senso coletivo para fortalecer a equipe e o escritório.
- Transparência nas relações, feedbacks e alinhamentos.`
    },
    {
      slug: 'cultura-comunicacao',
      grupo: 'cultura',
      subgrupo: null,
      ordem: 2,
      titulo: 'Tom de Voz e Comunicação',
      resumo: 'Diretrizes práticas para comunicação interna e externa.',
      corpo: `## Como a EXP fala
Clareza técnica e calor humano. Somos diretos sem ser frios e acessíveis sem perder profundidade.

## Comunicação interna
- Dúvidas devem ser trazidas cedo.
- O alinhamento importante precisa ser documentado.
- O que aprendemos em um projeto deve fortalecer os próximos.

## Comunicação com clientes
- Responder com agilidade.
- Deixar claros prazo, escopo e próximos passos.
- Se uma resposta não estiver confirmada, registrar que será verificada antes de assumir algo.`
    },
    {
      slug: 'organizacao-padronizacao-tonalidades',
      grupo: 'organizacao',
      subgrupo: 'padronizacao-tonalidades',
      ordem: 1,
      titulo: 'Padronização de Tonalidades',
      resumo: 'Guia base para pesos visuais, contraste e leitura técnica das pranchas.',
      corpo: `## Objetivo
Padronizar a leitura gráfica dos arquivos BIM e das pranchas emitidas pela EXP para que a informação técnica seja consistente em todas as entregas.

## Princípios gerais
- O contraste deve reforçar hierarquia, não decorar a prancha.
- Elementos principais sempre precisam ter leitura imediata.
- Informações de apoio devem aparecer com menor peso visual.
- A mesma categoria gráfica deve manter o mesmo comportamento ao longo de todo o projeto.

## Estrutura tonal recomendada
- Tom 100%: corte, informação principal e elementos de referência crítica.
- Tom 70%: contornos secundários e componentes relevantes sem protagonismo.
- Tom 40%: projeções, mobiliário de apoio e informação complementar.
- Tom 15%: fundos, referências auxiliares e elementos de contexto.

## Regras de aplicação
- Evitar múltiplos cinzas muito próximos entre si.
- Revisar impressão e PDF para confirmar legibilidade real.
- Nas revisões, qualquer exceção deve ser combinada com a coordenação BIM.`
    },
    {
      slug: 'organizacao-bim',
      grupo: 'organizacao',
      subgrupo: 'organizacao-bim',
      ordem: 2,
      titulo: 'Organização BIM',
      resumo: 'Estrutura para modelos, famílias, parâmetros e limpeza dos arquivos.',
      corpo: `## Estrutura esperada
- Modelos organizados por disciplina e etapa.
- Templates e famílias validadas pelo escritório.
- Parâmetros compartilhados com nomenclatura consistente.

## Boas práticas
- Manter nomes claros e padronizados.
- Evitar famílias duplicadas com pequenas variações de nome.
- Limpar vistas, folhas e elementos temporários antes das emissões.

## Em construção
Registrar aqui os padrões oficiais de worksets, templates, view templates, famílias e parâmetros compartilhados.`
    },
    {
      slug: 'organizacao-pastas',
      grupo: 'organizacao',
      subgrupo: 'organizacao-pastas',
      ordem: 3,
      titulo: 'Organização de Pastas',
      resumo: 'Estrutura de diretórios e convenções de armazenamento do escritório.',
      corpo: `## Estrutura mínima
- 00_Entrada
- 01_Base
- 02_Projeto
- 03_Compatibilização
- 04_Entrega
- 05_Histórico

## Regras
- O nome das pastas deve ser estável ao longo do projeto.
- Arquivos finais não devem ficar misturados com estudos temporários.
- Todo histórico relevante precisa permanecer rastreável.`
    },
    {
      slug: 'conhecimento-teoria-urbana',
      grupo: 'conhecimento',
      subgrupo: 'teoria-urbana',
      ordem: 1,
      titulo: 'Teoria Urbana',
      resumo: 'Base conceitual para repertório, análise e tomada de decisão em urbanismo.',
      corpo: `## Escopo
Espaço para registrar referências, conceitos e critérios recorrentes usados nos projetos de urbanismo da EXP.

## Sugestões de conteúdo
- Estrutura urbana e hierarquia viária.
- Espaço público e permanência.
- Interface entre paisagem, mobilidade e uso do solo.
- Centralidades, transições e bordas.`
    },
    {
      slug: 'conhecimento-normas-acessibilidade',
      grupo: 'conhecimento',
      subgrupo: 'normas-acessibilidade',
      ordem: 2,
      titulo: 'Normas Técnicas · Acessibilidade',
      resumo: 'Checklist vivo para consulta rápida em projetos e revisões.',
      corpo: `## Escopo
Reunir critérios recorrentes de acessibilidade para apoiar concepção, detalhamento e revisão.

## Registrar aqui
- Circulações e áreas de manobra.
- Rampas, escadas e corrimãos.
- Sinalização tátil e visual.
- Sanitários e áreas de uso comum.`
    },
    {
      slug: 'conhecimento-normas-piscinas',
      grupo: 'conhecimento',
      subgrupo: 'normas-piscinas',
      ordem: 3,
      titulo: 'Normas Técnicas · Piscinas',
      resumo: 'Critérios de segurança, acessos, entorno e coordenação de projeto.',
      corpo: `## Escopo
Consolidar exigências e cuidados técnicos recorrentes para áreas de piscina.

## Registrar aqui
- Faixas de circulação.
- Drenagem e acabamentos do entorno.
- Equipamentos e casa de máquinas.
- Barreiras, guarda-corpos e sinalização.`
    },
    {
      slug: 'conhecimento-normas-playgrounds',
      grupo: 'conhecimento',
      subgrupo: 'normas-playgrounds',
      ordem: 4,
      titulo: 'Normas Técnicas · Playgrounds',
      resumo: 'Critérios de segurança, implantação e escolha de equipamentos.',
      corpo: `## Escopo
Concentrar critérios mínimos para especificação e revisão de playgrounds.

## Registrar aqui
- Faixas etárias e setorização.
- Áreas de amortecimento.
- Distâncias de segurança e circulação.
- Acessibilidade e integração com o entorno.`
    },
    {
      slug: 'conhecimento-indicacoes-conteudo',
      grupo: 'conhecimento',
      subgrupo: 'indicacoes-conteudo',
      ordem: 5,
      titulo: 'Indicações de Conteúdo',
      resumo: 'Espaço para livros, artigos, perfis, cursos e referências úteis para a equipe.',
      corpo: `## Como usar
Registrar indicações com contexto curto: por que vale a pena, para quem serve e em qual tipo de projeto ajuda.

## Sugestões de categorias
- Livros
- Artigos e papers
- Perfis e escritórios
- Cursos e aulas
- Referências visuais`
    },
    {
      slug: 'conhecimento-vegetacao-intro',
      grupo: 'conhecimento',
      subgrupo: 'vegetacao',
      ordem: 6,
      titulo: 'Banco Vegetal EXP',
      resumo: 'Catálogo vivo para consulta, cadastro e curadoria de espécies.',
      corpo: `## Objetivo
Transformar o catálogo vegetal da EXP em uma base pesquisável e continuamente alimentada pela equipe.

## Como usar
- Buscar por nome popular ou científico.
- Filtrar por grupo, tipo, insolação, porte e altura estimada.
- Cadastrar novas espécies diretamente no banco.

## Regra de operação
Toda nova espécie deve entrar com o máximo de informação possível para que o banco seja útil nas consultas futuras.`
    }
  ];

  const ORG_SUBTEMAS = [
    { key: 'padronizacao-tonalidades', label: 'Padronização de Tonalidades', slug: 'organizacao-padronizacao-tonalidades' },
    { key: 'organizacao-bim', label: 'Organização BIM', slug: 'organizacao-bim' },
    { key: 'organizacao-pastas', label: 'Organização de Pastas', slug: 'organizacao-pastas' }
  ];

  const CONHECIMENTO_SUBTEMAS = [
    { key: 'vegetacao', label: 'Vegetação' },
    { key: 'teoria-urbana', label: 'Teoria Urbana' },
    { key: 'normas-tecnicas', label: 'Normas Técnicas' },
    { key: 'indicacoes-conteudo', label: 'Indicações de Conteúdo' }
  ];

  const NORMA_SUBTEMAS = [
    { key: 'acessibilidade', label: 'Acessibilidade', slug: 'conhecimento-normas-acessibilidade' },
    { key: 'piscinas', label: 'Piscinas', slug: 'conhecimento-normas-piscinas' },
    { key: 'playgrounds', label: 'Playgrounds', slug: 'conhecimento-normas-playgrounds' }
  ];

  Object.assign(G, {
    temaAtivo: 'cultura',
    subtemaOrg: 'padronizacao-tonalidades',
    subtemaConhecimento: 'vegetacao',
    subtemaNorma: 'acessibilidade',
    apoioSecoes: [],
    apoioTables: { conteudo: false, vegetacao: false },
    vegetacaoSpecies: [],
    vegFilters: { busca: '', grupo: '', tipo: '', insolacao: '', porte: '', altura: '' }
  });

  function canEditApoio() {
    return Boolean(G.usuario);
  }

  function syncSidebar() {
    document.querySelectorAll('.sb-theme-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tema === G.temaAtivo);
    });
  }

  function jsStr(value) {
    return JSON.stringify(String(value || ''));
  }

  function getDefaultSection(slug) {
    return DEFAULT_SECOES.find(secao => secao.slug === slug);
  }

  function getSection(slug) {
    const base = getDefaultSection(slug) || { slug, titulo: 'Nova seção', resumo: '', corpo: '', grupo: '', subgrupo: '', ordem: 999 };
    const saved = G.apoioSecoes.find(secao => secao.slug === slug);
    if(!saved) return { ...base };
    return { ...base, ...saved, resumo: saved.resumo ?? base.resumo, corpo: saved.corpo ?? base.corpo };
  }

  function upsertSectionLocal(section) {
    const idx = G.apoioSecoes.findIndex(item => item.slug === section.slug);
    if(idx === -1) G.apoioSecoes.push(section);
    else G.apoioSecoes[idx] = { ...G.apoioSecoes[idx], ...section };
  }

  function setModalSize(size) {
    const modal = document.getElementById('modal-edit');
    if(!modal) return;
    if(size) modal.dataset.size = size;
    else delete modal.dataset.size;
  }

  function abrirModalSized(titulo, bodyHtml, ctx, size) {
    setModalSize(size);
    abrirModal(titulo, bodyHtml, ctx);
  }

  fecharModal = function() {
    setModalSize('');
    oldFecharModal();
  };

  function renderEditButton(slug, label) {
    if(!canEditApoio()) return '';
    return `<button class="btn sm" onclick="abrirEditSecao(${jsStr(slug)})">${escHtml(label || 'Editar')}</button>`;
  }

  function parseRichBody(text) {
    const source = String(text || '').replace(/\r/g, '').trim();
    if(!source) return `<div class="knowledge-empty">Sem conteúdo ainda. Use o botão de edição para preencher esta seção.</div>`;
    const lines = source.split('\n');
    const blocks = [];
    let paragraph = [];
    let list = [];

    const flushParagraph = () => {
      if(!paragraph.length) return;
      blocks.push(`<p>${escHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if(!list.length) return;
      blocks.push(`<ul>${list.map(item => `<li>${escHtml(item)}</li>`).join('')}</ul>`);
      list = [];
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if(!trimmed) {
        flushParagraph();
        flushList();
        return;
      }
      if(trimmed.startsWith('## ')) {
        flushParagraph();
        flushList();
        blocks.push(`<h3>${escHtml(trimmed.slice(3))}</h3>`);
        return;
      }
      if(trimmed.startsWith('- ')) {
        flushParagraph();
        list.push(trimmed.slice(2));
        return;
      }
      flushList();
      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    return `<div class="rich-body">${blocks.join('')}</div>`;
  }

  function renderStaticSection(slug) {
    const secao = getSection(slug);
    return `
      <section class="secao-shell" id="${escAttr(slug)}">
        <div class="secao-shell-header">
          <div>
            <div class="secao-shell-title">${escHtml(secao.titulo || 'Seção')}</div>
            ${secao.resumo ? `<div class="secao-shell-sub">${escHtml(secao.resumo)}</div>` : ''}
          </div>
          <div class="secao-shell-actions">
            ${renderEditButton(slug)}
          </div>
        </div>
        ${parseRichBody(secao.corpo)}
      </section>`;
  }

  function renderContentHeader(title, subtitle) {
    return `
      <div class="content-hdr">
        <div class="content-hdr-left">
          <div class="content-title">${escHtml(title)}</div>
          <div class="content-sub">${escHtml(subtitle)}</div>
        </div>
      </div>`;
  }

  async function carregarApoioExtra() {
    const [conteudoRes, vegetacaoRes] = await Promise.all([
      sb.from('apoio_conteudo_secao').select('*').order('ordem').order('slug'),
      sb.from('apoio_vegetacao_especie').select('*').order('grupo').order('nome_popular')
    ]);

    if(conteudoRes.error) {
      G.apoioTables.conteudo = false;
      if(conteudoRes.error.code !== '42P01') console.warn('Falha ao carregar apoio_conteudo_secao', conteudoRes.error);
      G.apoioSecoes = [];
    } else {
      G.apoioTables.conteudo = true;
      G.apoioSecoes = conteudoRes.data || [];
    }

    if(vegetacaoRes.error) {
      G.apoioTables.vegetacao = false;
      if(vegetacaoRes.error.code !== '42P01') console.warn('Falha ao carregar apoio_vegetacao_especie', vegetacaoRes.error);
      G.vegetacaoSpecies = [];
    } else {
      G.apoioTables.vegetacao = true;
      G.vegetacaoSpecies = (vegetacaoRes.data || []).map(normalizeSpecies);
    }
  }

  carregarDados = async function() {
    await oldCarregarDados();
    await carregarApoioExtra();
    syncSidebar();
  };

  renderTema = function() {
    const el = document.getElementById('apoio-content');
    syncSidebar();
    if(G.temaAtivo === 'projetos') renderProjetos(el);
    else if(G.temaAtivo === 'organizacao') renderOrganizacao(el);
    else if(G.temaAtivo === 'conhecimento') renderConhecimento(el);
    else renderCultura(el);
  };

  renderCultura = function(el) {
    el.innerHTML = [
      renderContentHeader('Cultura', 'Direção, identidade e comunicação da EXP'),
      renderStaticSection('cultura-identidade'),
      renderStaticSection('cultura-comunicacao')
    ].join('');
  };

  window.setSubtemaOrg = function(sub) {
    G.subtemaOrg = sub;
    const wrap = document.getElementById('subtema-content');
    if(wrap) wrap.innerHTML = renderOrganizacaoSubtema();
    document.querySelectorAll('.knowledge-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.sub === sub);
    });
  };

  function renderOrganizacaoSubtema() {
    const item = ORG_SUBTEMAS.find(subtema => subtema.key === G.subtemaOrg) || ORG_SUBTEMAS[0];
    const referencias = {
      'padronizacao-tonalidades': {
        title: 'Referência',
        text: 'Conteúdo inicial estruturado a partir do documento interno de padronização tonal. O texto pode ser refinado pela equipe diretamente no módulo.'
      },
      'organizacao-bim': {
        title: 'Próximo passo',
        text: 'Definir template oficial, nomenclatura de famílias, worksets, parâmetros compartilhados e checklist de limpeza antes de emissão.'
      },
      'organizacao-pastas': {
        title: 'Próximo passo',
        text: 'Registrar a árvore de pastas por tipologia de projeto, responsáveis por manutenção e regra para histórico de entregas.'
      }
    };
    const referencia = referencias[item.key];
    return `
      ${referencia ? `
        <div class="knowledge-callout">
          <div class="knowledge-callout-title">${escHtml(referencia.title)}</div>
          <div class="knowledge-callout-text">${escHtml(referencia.text)}</div>
        </div>` : ''}
      ${renderStaticSection(item.slug)}`;
  }

  renderOrganizacao = function(el) {
    el.innerHTML = `
      ${renderContentHeader('Organização Interna', 'Procedimentos, organização BIM e estrutura interna do escritório')}
      <div class="knowledge-subtabs">
        ${ORG_SUBTEMAS.map(sub => `
          <div class="knowledge-subtab${G.subtemaOrg === sub.key ? ' active' : ''}" data-sub="${sub.key}" onclick="setSubtemaOrg('${sub.key}')">
            ${escHtml(sub.label)}
          </div>`).join('')}
      </div>
      <div id="subtema-content">${renderOrganizacaoSubtema()}</div>`;
  };

  window.setSubtemaConhecimento = function(sub) {
    G.subtemaConhecimento = sub;
    const wrap = document.getElementById('subtema-content');
    if(wrap) wrap.innerHTML = renderConhecimentoSubtema();
    document.querySelectorAll('.knowledge-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.sub === sub);
    });
  };

  window.setSubtemaNorma = function(sub) {
    G.subtemaNorma = sub;
    const wrap = document.getElementById('norma-content');
    if(wrap) wrap.innerHTML = renderStaticSection(`conhecimento-normas-${sub}`);
    document.querySelectorAll('.norma-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.norma === sub);
    });
  };

  function renderConhecimentoSubtema() {
    if(G.subtemaConhecimento === 'vegetacao') return renderVegetacaoDb();
    if(G.subtemaConhecimento === 'teoria-urbana') return renderStaticSection('conhecimento-teoria-urbana');
    if(G.subtemaConhecimento === 'indicacoes-conteudo') return renderStaticSection('conhecimento-indicacoes-conteudo');
    return `
      <div class="norma-tabs">
        ${NORMA_SUBTEMAS.map(sub => `
          <button class="norma-tab${G.subtemaNorma === sub.key ? ' active' : ''}" data-norma="${sub.key}" onclick="setSubtemaNorma('${sub.key}')">
            ${escHtml(sub.label)}
          </button>`).join('')}
      </div>
      <div id="norma-content">${renderStaticSection(`conhecimento-normas-${G.subtemaNorma}`)}</div>`;
  }

  renderConhecimento = function(el) {
    el.innerHTML = `
      ${renderContentHeader('Conhecimento', 'Referências técnicas, banco vegetal e curadoria viva da equipe')}
      <div class="knowledge-subtabs">
        ${CONHECIMENTO_SUBTEMAS.map(sub => `
          <div class="knowledge-subtab${G.subtemaConhecimento === sub.key ? ' active' : ''}" data-sub="${sub.key}" onclick="setSubtemaConhecimento('${sub.key}')">
            ${escHtml(sub.label)}
          </div>`).join('')}
      </div>
      <div id="subtema-content">${renderConhecimentoSubtema()}</div>`;
  };

  function normalizeText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function parseRangeCm(text) {
    const raw = String(text || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
    if(!raw) return { min: null, max: null };
    const unitMatches = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(cm|m)\b/g)];
    if(unitMatches.length) {
      const values = unitMatches.map(match => {
        const value = parseFloat(match[1].replace(',', '.'));
        return match[2] === 'm' ? value * 100 : value;
      }).filter(value => Number.isFinite(value));
      if(values.length) return { min: Math.min(...values), max: Math.max(...values) };
    }
    const numbers = [...raw.matchAll(/(\d+(?:[.,]\d+)?)/g)]
      .map(match => parseFloat(match[1].replace(',', '.')))
      .filter(value => Number.isFinite(value));
    if(!numbers.length) return { min: null, max: null };
    const factor = raw.includes('cm') ? 1 : raw.includes('m') ? 100 : 1;
    const values = numbers.map(value => value * factor);
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  function inferPorte(row) {
    const range = parseRangeCm(row.porte_final || row.porte_inicial || '');
    const ref = range.max || range.min;
    const grupo = normalizeText(row.grupo);
    if(!ref) return '';
    if(grupo.includes('arborea')) {
      if(ref <= 600) return 'pequeno';
      if(ref <= 1200) return 'medio';
      return 'grande';
    }
    if(ref <= 60) return 'baixo';
    if(ref <= 180) return 'pequeno';
    if(ref <= 500) return 'medio';
    return 'grande';
  }

  function normalizeSpecies(row) {
    const porteRange = parseRangeCm(row.porte_final || row.porte_inicial || '');
    return {
      ...row,
      _porteMin: porteRange.min,
      _porteMax: porteRange.max,
      _porteCategoria: inferPorte(row)
    };
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean).map(value => String(value).trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function speciesType(row) {
    return row.tipo_vegetacao || row.familia || '';
  }

  function speciesHeight(row) {
    return row.porte_final || row.porte_inicial || '';
  }

  function matchesAltura(row, target) {
    const number = parseFloat(String(target || '').replace(',', '.'));
    if(!Number.isFinite(number)) return true;
    const min = row._porteMin;
    const max = row._porteMax;
    if(min == null && max == null) return true;
    if(min != null && max != null && number >= (min - 20) && number <= (max + 20)) return true;
    const ref = max || min;
    return Math.abs(ref - number) <= Math.max(20, ref * 0.25);
  }

  function filteredSpecies() {
    const filtros = G.vegFilters;
    return G.vegetacaoSpecies.filter(row => {
      const haystack = normalizeText([
        row.nome_popular,
        row.nome_cientifico,
        row.tipo_vegetacao,
        row.familia,
        row.bioma,
        row.insolacao,
        row.atratividade,
        row.pragas_alertas
      ].join(' '));
      if(filtros.busca && !haystack.includes(normalizeText(filtros.busca))) return false;
      if(filtros.grupo && normalizeText(row.grupo) !== normalizeText(filtros.grupo)) return false;
      if(filtros.tipo && normalizeText(speciesType(row)) !== normalizeText(filtros.tipo)) return false;
      if(filtros.insolacao && !normalizeText(row.insolacao).includes(normalizeText(filtros.insolacao))) return false;
      if(filtros.porte && row._porteCategoria !== filtros.porte) return false;
      if(filtros.altura && !matchesAltura(row, filtros.altura)) return false;
      return true;
    });
  }

  function renderVegetacaoDb() {
    const intro = renderStaticSection('conhecimento-vegetacao-intro');
    if(!G.apoioTables.vegetacao) {
      return `
        ${intro}
        <div class="knowledge-callout">
          <div class="knowledge-callout-title">Banco vegetal ainda não configurado</div>
          <div class="knowledge-callout-text">A interface já está pronta, mas a tabela do Supabase ainda precisa ser criada e alimentada. Use o SQL deste pacote para ativar o banco vegetal.</div>
        </div>`;
    }

    const especies = filteredSpecies();
    const tipos = uniqueSorted(G.vegetacaoSpecies.map(speciesType));

    return `
      ${intro}
      <div class="veg-toolbar">
        <div class="veg-toolbar-main">
          <div class="secao-shell-tag">Banco vivo</div>
          <div class="veg-count">${especies.length} espécie${especies.length !== 1 ? 's' : ''} na consulta atual</div>
        </div>
        <div class="veg-toolbar-main">
          <button class="btn sm" onclick="limparVegFiltros()">Limpar filtros</button>
          <button class="btn verde sm" onclick="abrirNovaEspecie()">+ Nova espécie</button>
        </div>
      </div>

      <div class="veg-filter-grid">
        <div class="veg-filter">
          <label>Busca</label>
          <input type="text" id="veg-filter-busca" value="${escAttr(G.vegFilters.busca)}" placeholder="Nome, bioma, insolação..." oninput="updateVegFilter('busca', this.value)">
        </div>
        <div class="veg-filter">
          <label>Grupo</label>
          <select onchange="updateVegFilter('grupo', this.value)">
            <option value="">Todos</option>
            <option value="arbustivas"${G.vegFilters.grupo === 'arbustivas' ? ' selected' : ''}>Arbustivas</option>
            <option value="arbóreas"${G.vegFilters.grupo === 'arbóreas' ? ' selected' : ''}>Arbóreas</option>
          </select>
        </div>
        <div class="veg-filter">
          <label>Tipo / família</label>
          <select onchange="updateVegFilter('tipo', this.value)">
            <option value="">Todos</option>
            ${tipos.map(tipo => `<option value="${escAttr(tipo)}"${G.vegFilters.tipo === tipo ? ' selected' : ''}>${escHtml(tipo)}</option>`).join('')}
          </select>
        </div>
        <div class="veg-filter">
          <label>Insolação</label>
          <select onchange="updateVegFilter('insolacao', this.value)">
            <option value="">Todas</option>
            <option value="sol pleno"${G.vegFilters.insolacao === 'sol pleno' ? ' selected' : ''}>Sol pleno</option>
            <option value="meia sombra"${G.vegFilters.insolacao === 'meia sombra' ? ' selected' : ''}>Meia sombra</option>
            <option value="sombra"${G.vegFilters.insolacao === 'sombra' ? ' selected' : ''}>Sombra</option>
          </select>
        </div>
        <div class="veg-filter">
          <label>Porte estimado</label>
          <select onchange="updateVegFilter('porte', this.value)">
            <option value="">Todos</option>
            <option value="baixo"${G.vegFilters.porte === 'baixo' ? ' selected' : ''}>Baixo</option>
            <option value="pequeno"${G.vegFilters.porte === 'pequeno' ? ' selected' : ''}>Pequeno</option>
            <option value="medio"${G.vegFilters.porte === 'medio' ? ' selected' : ''}>Médio</option>
            <option value="grande"${G.vegFilters.porte === 'grande' ? ' selected' : ''}>Grande</option>
          </select>
        </div>
        <div class="veg-filter">
          <label>Altura esperada (cm)</label>
          <input type="number" min="0" step="1" value="${escAttr(G.vegFilters.altura)}" placeholder="Ex.: 50" oninput="updateVegFilter('altura', this.value)">
        </div>
      </div>

      <div class="veg-table-wrap">
        <table class="veg-table">
          <thead>
            <tr>
              <th>Espécie</th>
              <th>Grupo</th>
              <th>Tipo / família</th>
              <th>Porte final</th>
              <th>Insolação</th>
              <th>Bioma / origem</th>
              <th>Atratividade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${especies.length ? especies.map(row => `
              <tr>
                <td>
                  <span class="veg-main-name">${escHtml(row.nome_popular || 'Sem nome')}</span>
                  ${row.nome_cientifico ? `<span class="veg-sci-name">${escHtml(row.nome_cientifico)}</span>` : ''}
                </td>
                <td>
                  <div class="veg-pills">
                    ${row.grupo ? `<span class="veg-pill">${escHtml(row.grupo)}</span>` : ''}
                    ${row._porteCategoria ? `<span class="veg-pill">porte ${escHtml(row._porteCategoria)}</span>` : ''}
                  </div>
                </td>
                <td>${escHtml(speciesType(row) || '—')}</td>
                <td>${escHtml(speciesHeight(row) || '—')}</td>
                <td>${escHtml(row.insolacao || '—')}</td>
                <td>${escHtml([row.bioma, row.origem].filter(Boolean).join(' · ') || '—')}</td>
                <td>${escHtml(row.atratividade || row.fauna || '—')}</td>
                <td><div class="veg-actions"><button class="btn sm" onclick="editarEspecie(${jsStr(row.id)})">Editar</button></div></td>
              </tr>`).join('') : `
              <tr>
                <td colspan="8"><div class="knowledge-empty">Nenhuma espécie encontrada com os filtros atuais.</div></td>
              </tr>`}
          </tbody>
        </table>
      </div>`;
  }

  window.updateVegFilter = function(key, value) {
    G.vegFilters[key] = value;
    const wrap = document.getElementById('subtema-content');
    if(wrap) {
      wrap.innerHTML = renderConhecimentoSubtema();
      if(key === 'busca') {
        const el = document.getElementById('veg-filter-busca');
        if(el) { el.focus(); el.setSelectionRange(value.length, value.length); }
      }
    }
  };

  window.limparVegFiltros = function() {
    G.vegFilters = { busca: '', grupo: '', tipo: '', insolacao: '', porte: '', altura: '' };
    const wrap = document.getElementById('subtema-content');
    if(wrap) wrap.innerHTML = renderConhecimentoSubtema();
  };

  function buildSectionForm(secao) {
    return `
      <div class="knowledge-form-grid">
        <div class="full">
          <label>Título</label>
          <input type="text" id="apoio-secao-titulo" value="${escAttr(secao.titulo || '')}">
        </div>
        <div class="full">
          <label>Resumo</label>
          <input type="text" id="apoio-secao-resumo" value="${escAttr(secao.resumo || '')}" placeholder="Resumo curto da seção">
        </div>
        <div class="full">
          <label>Conteúdo</label>
          <textarea id="apoio-secao-corpo" rows="14" placeholder="Use ## para subtítulos e - para listas.">${escAttr(secao.corpo || '')}</textarea>
        </div>
      </div>`;
  }

  function buildSpeciesForm(row) {
    const especie = row || {};
    const value = key => escAttr(especie[key] || '');
    return `
      <div class="knowledge-form-grid">
        <div>
          <label>Grupo</label>
          <select id="veg-grupo">
            <option value="arbustivas"${especie.grupo === 'arbustivas' ? ' selected' : ''}>Arbustivas</option>
            <option value="arbóreas"${especie.grupo === 'arbóreas' ? ' selected' : ''}>Arbóreas</option>
          </select>
        </div>
        <div>
          <label>Nome popular</label>
          <input type="text" id="veg-nome-popular" value="${value('nome_popular')}" placeholder="Ex: Ipê-amarelo">
        </div>
        <div>
          <label>Nome científico</label>
          <input type="text" id="veg-nome-cientifico" value="${value('nome_cientifico')}" placeholder="Ex: Handroanthus albus">
        </div>
        <div>
          <label>Família</label>
          <input type="text" id="veg-familia" value="${value('familia')}" placeholder="Ex: Bignoniaceae">
        </div>
        <div>
          <label>Tipo de vegetação</label>
          <input type="text" id="veg-tipo-vegetacao" value="${value('tipo_vegetacao')}" placeholder="Ex: Caducifólia">
        </div>
        <div>
          <label>Prioridade</label>
          <input type="text" id="veg-prioridade" value="${value('prioridade')}" placeholder="alta / média / baixa">
        </div>
        <div>
          <label>Comestível</label>
          <input type="text" id="veg-comestivel" value="${value('comestivel')}" placeholder="sim / não">
        </div>
        <div>
          <label>Frutos comestíveis</label>
          <input type="text" id="veg-frutos-comestiveis" value="${value('frutos_comestiveis')}" placeholder="Ex: Vagens, polpa adocicada">
        </div>
        <div>
          <label>Uso urbano</label>
          <input type="text" id="veg-urbano" value="${value('urbano')}" placeholder="sim / não">
        </div>
        <div>
          <label>Arborização urbana</label>
          <input type="text" id="veg-arborizacao-urbana" value="${value('arborizacao_urbana')}" placeholder="sim / não">
        </div>
        <div>
          <label>Origem</label>
          <input type="text" id="veg-origem" value="${value('origem')}" placeholder="Ex: Brasil">
        </div>
        <div>
          <label>Bioma</label>
          <input type="text" id="veg-bioma" value="${value('bioma')}" placeholder="Ex: Cerrado">
        </div>
        <div>
          <label>Insolação</label>
          <input type="text" id="veg-insolacao" value="${value('insolacao')}" placeholder="sol pleno / meia sombra / sombra">
        </div>
        <div>
          <label>Atratividade</label>
          <input type="text" id="veg-atratividade" value="${value('atratividade')}" placeholder="Ex: Abelhas, beija-flores">
        </div>
        <div>
          <label>Fauna</label>
          <input type="text" id="veg-fauna" value="${value('fauna')}" placeholder="Ex: Aves, mamíferos">
        </div>
        <div>
          <label>Floração / cor</label>
          <input type="text" id="veg-floracao-cor" value="${value('floracao_cor')}" placeholder="Ex: Amarela">
        </div>
        <div>
          <label>Época</label>
          <input type="text" id="veg-epoca" value="${value('epoca')}" placeholder="Ex: Jul–Set">
        </div>
        <div>
          <label>Porte inicial (m árv. | cm árb.)</label>
          <input type="text" id="veg-porte-inicial" value="${value('porte_inicial')}" placeholder="Ex: 2,5m ou 40cm">
        </div>
        <div>
          <label>Porte final (m árv. | cm árb.)</label>
          <input type="text" id="veg-porte-final" value="${value('porte_final')}" placeholder="Ex: 12m ou 1,5m">
        </div>
        <div>
          <label>Diâmetro da copa (m árv. | cm árb.)</label>
          <input type="text" id="veg-diametro-copa" value="${value('diametro_copa')}" placeholder="Ex: 8m ou 60cm">
        </div>
        <div>
          <label>DCP (cm)</label>
          <input type="text" id="veg-dcp" value="${value('dcp')}" placeholder="Ex: 35">
        </div>
        <div>
          <label>DAP (cm)</label>
          <input type="text" id="veg-dap" value="${value('dap')}" placeholder="Ex: 15">
        </div>
        <div>
          <label>Crescimento</label>
          <input type="text" id="veg-crescimento" value="${value('crescimento')}" placeholder="lento / médio / rápido">
        </div>
        <div>
          <label>Espaçamento (cm)</label>
          <input type="text" id="veg-espacamento" value="${value('espacamento')}" placeholder="Ex: 150">
        </div>
        <div>
          <label>Mudas / m²</label>
          <input type="text" id="veg-mudas-m2" value="${value('mudas_m2')}" placeholder="Ex: 4">
        </div>
        <div>
          <label>Tipo de solo</label>
          <input type="text" id="veg-tipo-solo" value="${value('tipo_solo')}" placeholder="Ex: Bem drenado, arenoso">
        </div>
        <div>
          <label>Irrigação</label>
          <input type="text" id="veg-irrigacao" value="${value('irrigacao')}" placeholder="baixa / média / alta">
        </div>
        <div>
          <label>Folhagem</label>
          <input type="text" id="veg-folhagem" value="${value('folhagem')}" placeholder="Ex: Perene">
        </div>
        <div>
          <label>Unidade de compra</label>
          <input type="text" id="veg-unidade-compra" value="${value('unidade_compra')}" placeholder="Ex: unidade / saco">
        </div>
        <div>
          <label>Valor base</label>
          <input type="text" id="veg-valor-base" value="${value('valor_base')}" placeholder="Ex: 45.00">
        </div>
        <div class="full">
          <label>Pragas, alertas ou curiosidades</label>
          <textarea id="veg-pragas-alertas" rows="4">${escAttr(especie.pragas_alertas || '')}</textarea>
        </div>
        <div class="full">
          <label>Observações</label>
          <textarea id="veg-observacoes" rows="4">${escAttr(especie.observacoes || '')}</textarea>
        </div>
      </div>`;
  }

  window.abrirEditSecao = function(slug) {
    const secao = getSection(slug);
    abrirModalSized(`Editar seção · ${secao.titulo}`, buildSectionForm(secao), { tipo: 'apoio-secao', slug }, 'medium');
  };

  window.abrirNovaEspecie = function() {
    abrirModalSized('Nova espécie', buildSpeciesForm({ grupo: 'arbustivas' }), { tipo: 'apoio-especie', id: null }, 'wide');
  };

  window.editarEspecie = function(id) {
    const especie = G.vegetacaoSpecies.find(item => item.id === id);
    if(!especie) return;
    abrirModalSized(`Editar espécie · ${especie.nome_popular}`, buildSpeciesForm(especie), { tipo: 'apoio-especie', id }, 'wide');
  };

  function readSectionPayload(slug) {
    const base = getSection(slug);
    return {
      slug,
      grupo: base.grupo,
      subgrupo: base.subgrupo,
      ordem: base.ordem,
      titulo: document.getElementById('apoio-secao-titulo').value.trim() || base.titulo,
      resumo: document.getElementById('apoio-secao-resumo').value.trim(),
      corpo: document.getElementById('apoio-secao-corpo').value.trim(),
      updated_at: new Date().toISOString(),
      updated_by: G.usuario?.id || null
    };
  }

  function readSpeciesPayload(id) {
    return {
      ...(id ? { id } : {}),
      grupo: document.getElementById('veg-grupo').value,
      nome_popular: document.getElementById('veg-nome-popular').value.trim(),
      nome_cientifico: document.getElementById('veg-nome-cientifico').value.trim(),
      familia: document.getElementById('veg-familia').value.trim(),
      tipo_vegetacao: document.getElementById('veg-tipo-vegetacao').value.trim(),
      prioridade: document.getElementById('veg-prioridade').value.trim(),
      comestivel: document.getElementById('veg-comestivel').value.trim(),
      frutos_comestiveis: document.getElementById('veg-frutos-comestiveis').value.trim(),
      urbano: document.getElementById('veg-urbano').value.trim(),
      arborizacao_urbana: document.getElementById('veg-arborizacao-urbana').value.trim(),
      origem: document.getElementById('veg-origem').value.trim(),
      bioma: document.getElementById('veg-bioma').value.trim(),
      insolacao: document.getElementById('veg-insolacao').value.trim(),
      atratividade: document.getElementById('veg-atratividade').value.trim(),
      fauna: document.getElementById('veg-fauna').value.trim(),
      floracao_cor: document.getElementById('veg-floracao-cor').value.trim(),
      epoca: document.getElementById('veg-epoca').value.trim(),
      porte_inicial: document.getElementById('veg-porte-inicial').value.trim(),
      porte_final: document.getElementById('veg-porte-final').value.trim(),
      diametro_copa: document.getElementById('veg-diametro-copa').value.trim(),
      dcp: document.getElementById('veg-dcp').value.trim(),
      dap: document.getElementById('veg-dap').value.trim(),
      crescimento: document.getElementById('veg-crescimento').value.trim(),
      espacamento: document.getElementById('veg-espacamento').value.trim(),
      mudas_m2: document.getElementById('veg-mudas-m2').value.trim(),
      tipo_solo: document.getElementById('veg-tipo-solo').value.trim(),
      irrigacao: document.getElementById('veg-irrigacao').value.trim(),
      folhagem: document.getElementById('veg-folhagem').value.trim(),
      unidade_compra: document.getElementById('veg-unidade-compra').value.trim(),
      valor_base: document.getElementById('veg-valor-base').value.trim(),
      pragas_alertas: document.getElementById('veg-pragas-alertas').value.trim(),
      observacoes: document.getElementById('veg-observacoes').value.trim(),
      updated_at: new Date().toISOString(),
      atualizado_por: G.usuario?.id || null,
      criado_por: G.usuario?.id || null
    };
  }

  function upsertSpeciesLocal(species) {
    const normalized = normalizeSpecies(species);
    const idx = G.vegetacaoSpecies.findIndex(item => item.id === species.id);
    if(idx === -1) G.vegetacaoSpecies.unshift(normalized);
    else G.vegetacaoSpecies[idx] = normalized;
  }

  salvarModal = async function() {
    const ctx = G.modalCtx;
    if(!ctx) return;
    if(ctx.tipo !== 'apoio-secao' && ctx.tipo !== 'apoio-especie') return oldSalvarModal();

    const btn = document.getElementById('modal-salvar-btn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      if(ctx.tipo === 'apoio-secao') {
        if(!G.apoioTables.conteudo) throw new Error('A tabela apoio_conteudo_secao ainda não existe no Supabase.');
        const payload = readSectionPayload(ctx.slug);
        const { data, error } = await sb.from('apoio_conteudo_secao')
          .upsert(payload, { onConflict: 'slug' })
          .select()
          .single();
        if(error) throw error;
        upsertSectionLocal(data || payload);
      }

      if(ctx.tipo === 'apoio-especie') {
        if(!G.apoioTables.vegetacao) throw new Error('A tabela apoio_vegetacao_especie ainda não existe no Supabase.');
        const payload = readSpeciesPayload(ctx.id);
        if(!payload.nome_popular) throw new Error('Informe ao menos o nome popular da espécie.');
        if(ctx.id) {
          const { data, error } = await sb.from('apoio_vegetacao_especie')
            .update(payload)
            .eq('id', ctx.id)
            .select()
            .single();
          if(error) throw error;
          upsertSpeciesLocal(data || payload);
        } else {
          const { data, error } = await sb.from('apoio_vegetacao_especie')
            .insert(payload)
            .select()
            .single();
          if(error) throw error;
          upsertSpeciesLocal(data || payload);
        }
      }

      fecharModal();
      renderTema();
    } catch(err) {
      alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  };

  window.abrirSubtemaConhecimento = function(sub, norma) {
    G.temaAtivo = 'conhecimento';
    G.subtemaConhecimento = sub;
    if(norma) G.subtemaNorma = norma;
    renderTema();
  };

  window.abrirBuscaVegetacao = function(term) {
    G.temaAtivo = 'conhecimento';
    G.subtemaConhecimento = 'vegetacao';
    G.vegFilters.busca = term;
    renderTema();
  };

  let _buscarTimerPatch = null;
  buscarDebounce = function(query) {
    clearTimeout(_buscarTimerPatch);
    _buscarTimerPatch = setTimeout(() => buscar(query), 180);
  };

  function pushProjectSearchResults(resultados, q) {
    G.tipos.forEach(t => {
      if(normalizeText(t.nome).includes(q) || normalizeText(t.descricao).includes(q)) {
        resultados.push({ path: `Projetos · ${labelArea(t.area)}`, titulo: t.nome, snippet: snip(t.descricao, q), action: `setTema('projetos');setArea('${t.area}')` });
      }
    });
    G.etapas.forEach(e => {
      const tipo = G.tipos.find(t => t.id === e.tipo_id);
      if(normalizeText(e.nome).includes(q) || normalizeText(e.descricao).includes(q)) {
        resultados.push({ path: `${tipo?.nome || ''}`, titulo: e.nome, snippet: snip(e.descricao, q), action: `setTema('projetos');setArea('${tipo?.area || 'paisagismo'}')` });
      }
    });
    G.entregaveis.forEach(ent => {
      const etapa = G.etapas.find(e => e.id === ent.etapa_id);
      const tipo = G.tipos.find(t => t.id === etapa?.tipo_id);
      if(normalizeText(ent.nome).includes(q) || normalizeText(ent.descricao).includes(q)) {
        resultados.push({ path: `${tipo?.nome || ''} · ${etapa?.nome || ''}`, titulo: ent.nome, snippet: snip(ent.descricao, q), action: `setTema('projetos');setArea('${tipo?.area || 'paisagismo'}')` });
      }
    });
    G.checklists.forEach(c => {
      if(normalizeText(c.texto).includes(q)) {
        const ent = G.entregaveis.find(e => e.id === c.entregavel_id);
        const etapa = G.etapas.find(e => e.id === ent?.etapa_id);
        const tipo = G.tipos.find(t => t.id === etapa?.tipo_id);
        resultados.push({ path: `${tipo?.nome || ''} · ${etapa?.nome || ''} · ${ent?.nome || ''}`, titulo: c.texto, snippet: '', action: `setTema('projetos');setArea('${tipo?.area || 'paisagismo'}')` });
      }
    });
  }

  function pushContentSearchResults(resultados, q) {
    DEFAULT_SECOES.forEach(secao => {
      const merged = getSection(secao.slug);
      const source = normalizeText([merged.titulo, merged.resumo, merged.corpo].join(' '));
      if(!source.includes(q)) return;
      let action = `setTema('cultura')`;
      let path = 'Cultura';
      if(merged.grupo === 'organizacao') {
        action = `setTema('organizacao');setSubtemaOrg('${merged.subgrupo}')`;
        path = 'Organização Interna';
      }
      if(merged.grupo === 'conhecimento') {
        if(merged.subgrupo === 'vegetacao') action = `abrirSubtemaConhecimento('vegetacao')`;
        else if(merged.subgrupo && merged.subgrupo.startsWith('normas-')) action = `abrirSubtemaConhecimento('normas-tecnicas','${merged.subgrupo.replace('normas-', '')}')`;
        else action = `abrirSubtemaConhecimento('${merged.subgrupo}')`;
        path = 'Conhecimento';
      }
      resultados.push({ path, titulo: merged.titulo, snippet: snip(merged.corpo, q), action });
    });
  }

  function pushSpeciesSearchResults(resultados, q) {
    G.vegetacaoSpecies.forEach(item => {
      const source = normalizeText([item.nome_popular, item.nome_cientifico, item.tipo_vegetacao, item.familia, item.bioma, item.insolacao].join(' '));
      if(!source.includes(q)) return;
      resultados.push({
        path: 'Conhecimento · Vegetação',
        titulo: item.nome_popular || 'Espécie',
        snippet: [item.nome_cientifico, item.insolacao, item.bioma].filter(Boolean).join(' · '),
        action: `abrirBuscaVegetacao(${jsStr(item.nome_popular || item.nome_cientifico || '')})`
      });
    });
  }

  buscar = function(query) {
    const el = document.getElementById('apoio-content');
    if(!query || query.trim().length < 2) {
      renderTema();
      return;
    }
    const q = normalizeText(query);
    const resultados = [];
    pushProjectSearchResults(resultados, q);
    pushContentSearchResults(resultados, q);
    pushSpeciesSearchResults(resultados, q);

    if(resultados.length === 0) {
      el.innerHTML = `<div class="search-empty">Nenhum resultado para "${escHtml(query)}".</div>`;
      return;
    }

    el.innerHTML = `
      <div class="content-hdr">
        <div class="content-hdr-left">
          <div class="content-title">Resultados para "${escHtml(query)}"</div>
          <div class="content-sub">${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="content-hdr-actions">
          <button class="btn sm" onclick="document.getElementById('sb-search-input').value='';renderTema()">Limpar</button>
        </div>
      </div>
      <div class="search-results-wrap">
        <div class="search-results-hdr">${resultados.length} ocorrência${resultados.length !== 1 ? 's' : ''}</div>
        ${resultados.map(r => `
          <div class="search-result-item" onclick="${r.action}">
            <div class="sr-path">${escHtml(r.path)}</div>
            <div class="sr-titulo">${escHtml(r.titulo)}</div>
            ${r.snippet ? `<div class="sr-snippet">${escHtml(r.snippet)}</div>` : ''}
          </div>`).join('')}
      </div>`;
  };

  syncSidebar();
})();
