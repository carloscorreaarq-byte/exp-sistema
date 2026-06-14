-- ══════════════════════════════════════════════════════════════════════════
--  EXP · SOCIEDADE — HAND-OFF DE SÓCIA
--  Rodar no Supabase antes de usar a aba "Hand-off" do módulo Sociedade.
--
--  Convenções espelhadas de soc_temas/soc_pautas/soc_projetos (sociedade.html)
--  e do RLS em revisao/sql-fix-sociedade-rls.sql:
--    - tabelas prefixo soc_handoff*
--    - id uuid default gen_random_uuid(), criado_por uuid -> auth.users
--    - created_at/updated_at timestamptz default now()
--    - RLS via private.can_access_sociedade()  (socio | socio_adm | socio_admin)
--
--  Status (kanban de acompanhamento), valores padronizados:
--    a_documentar -> documentado -> em_transferencia -> transferido -> validado
-- ══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Cabeçalho do processo de hand-off ──────────────────────────────────
create table if not exists soc_handoff (
  id          uuid primary key default gen_random_uuid(),
  socia_id    uuid references auth.users(id),      -- sócia que está saindo
  socia_nome  text,
  data_saida  date,
  status      text default 'em_andamento',         -- em_andamento | concluido
  observacao  text,
  criado_por  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 2. Contatos registrados no hand-off (espelho + roteamento) ────────────
--  destino = 'contatos'  -> gravado em exp_contatos (módulo Contatos), tipo parceiro/fornecedor
--  destino = 'crm'       -> gravado em contatos (área Contatos do módulo Comercial/CRM)
--  destino_ref_id guarda o id do registro criado no módulo de destino.
create table if not exists soc_handoff_contato (
  id             uuid primary key default gen_random_uuid(),
  handoff_id     uuid references soc_handoff(id) on delete cascade,
  destino        text not null,                    -- 'contatos' | 'crm'
  tipo           text,                             -- parceiro | fornecedor | comercial
  destino_ref_id uuid,                             -- id no exp_contatos ou contatos(CRM)
  nome           text not null,
  contexto       text,                             -- conhecimento tácito / origem da relação
  sucessor_id    uuid references auth.users(id),
  status         text default 'a_documentar',
  criado_por     uuid references auth.users(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── 3. Status de projetos (visão exclusiva societária) ────────────────────
--  cliente_id / oportunidade_id referenciam clientes / oportunidades (CRM).
--  Mantidos como uuid solto + snapshot do nome para resiliência (sem FK
--  cross-módulo, evitando acoplar o RLS da sociedade ao do CRM).
create table if not exists soc_handoff_projeto (
  id                 uuid primary key default gen_random_uuid(),
  handoff_id         uuid references soc_handoff(id) on delete cascade,
  cliente_id         uuid,
  cliente_nome       text,
  oportunidade_id    uuid,
  oportunidade_nome  text,
  status_texto       text,                          -- campo aberto: situação real
  arquivos_desc      text,                          -- arquivos de hand-off salvos (Drive + pasta handoff)
  contexto           text,                          -- conhecimento tácito
  sucessor_id        uuid references auth.users(id),
  visivel_societaria boolean default true,
  status             text default 'a_documentar',
  criado_por         uuid references auth.users(id),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ── 4. Itens genéricos de acompanhamento ──────────────────────────────────
--  Cobre senhas, arquivos, agendas, propostas, pipeline e pendências diversas
--  que entram no painel de Acompanhamento (kanban de status).
create table if not exists soc_handoff_item (
  id          uuid primary key default gen_random_uuid(),
  handoff_id  uuid references soc_handoff(id) on delete cascade,
  categoria   text not null,                        -- senha | arquivo | agenda | proposta | pipeline | processo | outro
  titulo      text not null,
  descricao   text,
  sucessor_id uuid references auth.users(id),
  criticidade text default 'media',                 -- alta | media | baixa
  prazo       date,
  status      text default 'a_documentar',
  criado_por  uuid references auth.users(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Índices de apoio (lookups por processo)
create index if not exists idx_soc_handoff_contato_hid on soc_handoff_contato(handoff_id);
create index if not exists idx_soc_handoff_projeto_hid on soc_handoff_projeto(handoff_id);
create index if not exists idx_soc_handoff_item_hid    on soc_handoff_item(handoff_id);

-- ── RLS — mesmo padrão das demais tabelas de sociedade ────────────────────
--  Reutiliza private.can_access_sociedade() já criada em sql-fix-sociedade-rls.sql.
do $$
declare
  tbl text;
  targets text[] := array[
    'soc_handoff',
    'soc_handoff_contato',
    'soc_handoff_projeto',
    'soc_handoff_item'
  ];
begin
  foreach tbl in array targets loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists "autenticados" on public.%I', tbl);
      execute format('drop policy if exists %I on public.%I', tbl || '_access_exp', tbl);
      execute format(
        'create policy %I on public.%I for all to authenticated using (private.can_access_sociedade()) with check (private.can_access_sociedade())',
        tbl || '_access_exp',
        tbl
      );
    end if;
  end loop;
end $$;

commit;

-- ── Seed opcional: criar o processo de hand-off da sócia que está saindo ──
--  Preencha socia_id (auth.users) e a data de saída e rode separadamente.
-- insert into soc_handoff (socia_nome, data_saida)
-- values ('Nome da Sócia', '2026-07-31');
