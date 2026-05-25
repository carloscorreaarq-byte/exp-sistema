begin;

create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_exp_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select lower(coalesce(u.role::text, ''))
      from public.usuarios u
      where u.auth_id = auth.uid()
      limit 1
    ),
    'anonymous'
  );
$$;

create or replace function private.current_exp_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1
$$;

create or replace function private.current_exp_user_profile()
returns table (
  user_id uuid,
  nome text,
  iniciais text,
  cor text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.nome,
    coalesce(nullif(u.iniciais, ''), upper(left(coalesce(u.nome, '?'), 2))),
    coalesce(nullif(u.cor, ''), '#1D6A4A')
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1
$$;

create or replace function private.can_manage_gestao_domain_local()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.current_exp_role() in ('socio', 'socio_adm', 'socio_admin')
$$;

create or replace function private.can_access_project_chat(prod_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_has_native boolean := false;
  v_can boolean := false;
begin
  if auth.uid() is null or prod_id is null then
    return false;
  end if;

  select to_regprocedure('private.can_access_produto(uuid)') is not null
    into v_has_native;

  if v_has_native then
    execute 'select private.can_access_produto($1)'
      into v_can
      using prod_id;
    return coalesce(v_can, false);
  end if;

  return
    private.can_manage_gestao_domain_local()
    or exists (
      select 1
      from public.produtos p
      where p.id = prod_id
        and p.coordenador_id = private.current_exp_user_id()
    )
    or exists (
      select 1
      from public.etapas e
      join public.etapa_desenvolvedores ed on ed.etapa_id = e.id
      where e.produto_id = prod_id
        and ed.usuario_id = private.current_exp_user_id()
    );
end;
$$;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm', 'group', 'project')),
  title text,
  produto_id uuid references public.produtos(id) on delete cascade,
  created_by_auth_id uuid not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists chat_threads_project_unique_idx
  on public.chat_threads (produto_id)
  where type = 'project';

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_auth_id uuid not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_auth_id)
);

create table if not exists public.chat_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete cascade,
  sender_auth_id uuid not null,
  sender_nome text not null,
  sender_iniciais text,
  sender_cor text,
  content text not null check (char_length(btrim(content)) > 0),
  reactions jsonb not null default '{"like":[],"love":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  fts tsvector generated always as (
    to_tsvector('portuguese', coalesce(content, ''))
  ) stored
);

create table if not exists public.chat_thread_reads (
  user_auth_id uuid not null,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_auth_id, thread_id)
);

create index if not exists chat_thread_messages_thread_created_idx
  on public.chat_thread_messages (thread_id, created_at desc);

create index if not exists chat_thread_messages_produto_created_idx
  on public.chat_thread_messages (produto_id, created_at desc);

create index if not exists chat_thread_messages_fts_idx
  on public.chat_thread_messages using gin (fts);

create index if not exists chat_thread_reads_thread_idx
  on public.chat_thread_reads (thread_id, last_read_at desc);

alter table public.reg_entrada
  add column if not exists fts tsvector
  generated always as (
    to_tsvector(
      'portuguese',
      trim(
        both from
        coalesce(titulo, '') || ' ' ||
        coalesce(participantes, '') || ' ' ||
        coalesce(corpo, '')
      )
    )
  ) stored;

alter table public.reg_comentario
  add column if not exists fts tsvector
  generated always as (
    to_tsvector('portuguese', coalesce(texto, ''))
  ) stored;

create index if not exists reg_entrada_produto_created_idx
  on public.reg_entrada (produto_id, criado_em desc);

create index if not exists reg_entrada_fts_idx
  on public.reg_entrada using gin (fts);

create index if not exists reg_comentario_entrada_created_idx
  on public.reg_comentario (entrada_id, criado_em desc);

create index if not exists reg_comentario_fts_idx
  on public.reg_comentario using gin (fts);

create or replace function private.can_access_chat_thread(p_thread_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_type text;
  v_produto_id uuid;
begin
  if auth.uid() is null or p_thread_id is null then
    return false;
  end if;

  select t.type, t.produto_id
    into v_type, v_produto_id
  from public.chat_threads t
  where t.id = p_thread_id
    and t.archived_at is null;

  if not found then
    return false;
  end if;

  if v_type = 'project' then
    return private.can_access_project_chat(v_produto_id);
  end if;

  return exists (
    select 1
    from public.chat_thread_members m
    where m.thread_id = p_thread_id
      and m.user_auth_id = auth.uid()
  );
end;
$$;

create or replace function private.chat_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_produto_id uuid;
  v_profile record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not private.can_access_chat_thread(new.thread_id) then
    raise exception 'Access denied to thread' using errcode = '42501';
  end if;

  select t.produto_id
    into v_produto_id
  from public.chat_threads t
  where t.id = new.thread_id;

  select *
    into v_profile
  from private.current_exp_user_profile();

  if v_profile.user_id is null then
    raise exception 'User profile not found' using errcode = '42501';
  end if;

  new.produto_id := v_produto_id;
  new.sender_auth_id := auth.uid();
  new.sender_nome := v_profile.nome;
  new.sender_iniciais := v_profile.iniciais;
  new.sender_cor := v_profile.cor;
  new.updated_at := null;

  return new;
end;
$$;

create or replace function private.chat_message_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
     set last_message_at = new.created_at
   where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists chat_message_before_insert on public.chat_thread_messages;
create trigger chat_message_before_insert
before insert on public.chat_thread_messages
for each row
execute function private.chat_message_before_insert();

drop trigger if exists chat_message_after_insert on public.chat_thread_messages;
create trigger chat_message_after_insert
after insert on public.chat_thread_messages
for each row
execute function private.chat_message_after_write();

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_thread_messages enable row level security;
alter table public.chat_thread_reads enable row level security;

grant select on public.chat_threads to authenticated;
grant select on public.chat_thread_members to authenticated;
grant select, insert on public.chat_thread_messages to authenticated;
grant select, insert, update on public.chat_thread_reads to authenticated;

drop policy if exists chat_threads_select on public.chat_threads;
create policy chat_threads_select
on public.chat_threads
for select
to authenticated
using (private.can_access_chat_thread(id));

drop policy if exists chat_thread_members_select on public.chat_thread_members;
create policy chat_thread_members_select
on public.chat_thread_members
for select
to authenticated
using (private.can_access_chat_thread(thread_id));

drop policy if exists chat_thread_messages_select on public.chat_thread_messages;
create policy chat_thread_messages_select
on public.chat_thread_messages
for select
to authenticated
using (private.can_access_chat_thread(thread_id));

drop policy if exists chat_thread_messages_insert on public.chat_thread_messages;
create policy chat_thread_messages_insert
on public.chat_thread_messages
for insert
to authenticated
with check (
  private.can_access_chat_thread(thread_id)
  and sender_auth_id = auth.uid()
);

drop policy if exists chat_thread_reads_select on public.chat_thread_reads;
create policy chat_thread_reads_select
on public.chat_thread_reads
for select
to authenticated
using (
  user_auth_id = auth.uid()
  and private.can_access_chat_thread(thread_id)
);

drop policy if exists chat_thread_reads_insert on public.chat_thread_reads;
create policy chat_thread_reads_insert
on public.chat_thread_reads
for insert
to authenticated
with check (
  user_auth_id = auth.uid()
  and private.can_access_chat_thread(thread_id)
);

drop policy if exists chat_thread_reads_update on public.chat_thread_reads;
create policy chat_thread_reads_update
on public.chat_thread_reads
for update
to authenticated
using (
  user_auth_id = auth.uid()
  and private.can_access_chat_thread(thread_id)
)
with check (
  user_auth_id = auth.uid()
  and private.can_access_chat_thread(thread_id)
);

create or replace function private.project_chat_client_sigla(p_cliente text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
  v_parts text[];
  v_part text;
  v_sigla text := '';
begin
  v_clean := trim(coalesce(p_cliente, ''));
  if v_clean = '' then
    return 'PRJ';
  end if;

  v_parts := regexp_split_to_array(
    regexp_replace(lower(v_clean), '[^[:alnum:][:space:]]+', ' ', 'g'),
    '\s+'
  );

  foreach v_part in array v_parts loop
    continue when v_part is null or v_part = '' or v_part in ('de', 'da', 'do', 'das', 'dos', 'e');
    v_sigla := v_sigla || upper(left(v_part, 1));
    exit when char_length(v_sigla) >= 3;
  end loop;

  if char_length(v_sigla) < 2 then
    v_sigla := upper(left(regexp_replace(v_clean, '[^[:alnum:]]+', '', 'g'), 3));
  end if;

  return coalesce(nullif(left(v_sigla, 3), ''), 'PRJ');
end;
$$;

create or replace function private.project_chat_default_title(p_produto_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select
    private.project_chat_client_sigla(c.nome) || '-' ||
    coalesce(nullif(trim(o.projeto), ''), nullif(trim(p.nome), ''), 'Projeto')
  from public.produtos p
  left join public.oportunidades o on o.id = p.oportunidade_id
  left join public.clientes c on c.id = o.cliente_id
  where p.id = p_produto_id
  limit 1
$$;

create or replace function public.ensure_project_chat_thread(p_produto_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_thread_id uuid;
  v_title text;
begin
  if not private.can_access_project_chat(p_produto_id) then
    raise exception 'Access denied to product chat' using errcode = '42501';
  end if;

  select t.id
    into v_thread_id
  from public.chat_threads t
  where t.type = 'project'
    and t.produto_id = p_produto_id
  limit 1;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  v_title := coalesce(private.project_chat_default_title(p_produto_id), 'PRJ-Projeto');

  insert into public.chat_threads (
    type,
    title,
    produto_id,
    created_by_auth_id,
    last_message_at
  )
  values (
    'project',
    v_title,
    p_produto_id,
    auth.uid(),
    now()
  )
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

revoke all on function public.ensure_project_chat_thread(uuid) from public;
grant execute on function public.ensure_project_chat_thread(uuid) to authenticated;

create or replace function public.rename_project_chat_thread(
  p_produto_id uuid,
  p_title text
)
returns public.chat_threads
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_thread_id uuid;
  v_title text;
  v_thread public.chat_threads%rowtype;
begin
  if not private.can_access_project_chat(p_produto_id) then
    raise exception 'Access denied to project chat' using errcode = '42501';
  end if;

  v_thread_id := public.ensure_project_chat_thread(p_produto_id);
  v_title := nullif(trim(p_title), '');
  if v_title is null then
    v_title := coalesce(private.project_chat_default_title(p_produto_id), 'PRJ-Projeto');
  end if;

  update public.chat_threads
     set title = left(v_title, 120)
   where id = v_thread_id
   returning * into v_thread;

  return v_thread;
end;
$$;

revoke all on function public.rename_project_chat_thread(uuid, text) from public;
grant execute on function public.rename_project_chat_thread(uuid, text) to authenticated;

create or replace function public.chat_thread_toggle_reaction(
  p_message_id uuid,
  p_reaction text
)
returns public.chat_thread_messages
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid text := auth.uid()::text;
  v_msg public.chat_thread_messages%rowtype;
  v_values text[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_reaction not in ('like', 'love') then
    raise exception 'Invalid reaction' using errcode = '22023';
  end if;

  select *
    into v_msg
  from public.chat_thread_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;

  if not private.can_access_chat_thread(v_msg.thread_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  v_values := array(
    select value
    from jsonb_array_elements_text(coalesce(v_msg.reactions -> p_reaction, '[]'::jsonb)) as value
  );
  v_values := coalesce(v_values, array[]::text[]);

  if v_uid = any(v_values) then
    v_values := array_remove(v_values, v_uid);
  else
    v_values := array_append(v_values, v_uid);
  end if;

  update public.chat_thread_messages
     set reactions = jsonb_set(
       coalesce(v_msg.reactions, '{"like":[],"love":[]}'::jsonb),
       array[p_reaction],
       to_jsonb(coalesce(v_values, array[]::text[])),
       true
     ),
         updated_at = now()
   where id = p_message_id
   returning * into v_msg;

  return v_msg;
end;
$$;

revoke all on function public.chat_thread_toggle_reaction(uuid, text) from public;
grant execute on function public.chat_thread_toggle_reaction(uuid, text) to authenticated;

create or replace function public.project_history_feed(
  p_produto_id uuid,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  source_type text,
  source_id uuid,
  thread_id uuid,
  entry_id uuid,
  produto_id uuid,
  etapa_id uuid,
  event_at timestamptz,
  author_name text,
  title text,
  excerpt text
)
language sql
stable
security definer
set search_path = public, private
as $$
  with access_guard as (
    select private.can_access_project_chat(p_produto_id) as allowed
  ),
  feed as (
    select
      'chat'::text as source_type,
      m.id as source_id,
      m.thread_id,
      null::uuid as entry_id,
      m.produto_id,
      null::uuid as etapa_id,
      m.created_at as event_at,
      m.sender_nome as author_name,
      null::text as title,
      left(m.content, 240) as excerpt
    from public.chat_thread_messages m
    where m.produto_id = p_produto_id

    union all

    select
      'ata'::text as source_type,
      r.id as source_id,
      null::uuid as thread_id,
      r.id as entry_id,
      r.produto_id,
      r.etapa_id,
      r.criado_em as event_at,
      r.criado_por_nome as author_name,
      nullif(r.titulo, '') as title,
      left(coalesce(nullif(r.corpo, ''), nullif(r.participantes, ''), ''), 240) as excerpt
    from public.reg_entrada r
    where r.produto_id = p_produto_id

    union all

    select
      'ata_comentario'::text as source_type,
      c.id as source_id,
      null::uuid as thread_id,
      c.entrada_id as entry_id,
      r.produto_id,
      r.etapa_id,
      c.criado_em as event_at,
      c.autor_nome as author_name,
      nullif(r.titulo, '') as title,
      left(c.texto, 240) as excerpt
    from public.reg_comentario c
    join public.reg_entrada r on r.id = c.entrada_id
    where r.produto_id = p_produto_id
  )
  select
    f.source_type,
    f.source_id,
    f.thread_id,
    f.entry_id,
    f.produto_id,
    f.etapa_id,
    f.event_at,
    f.author_name,
    f.title,
    f.excerpt
  from feed f
  join access_guard g on g.allowed
  order by f.event_at desc, f.source_id desc
  limit greatest(coalesce(p_limit, 100), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.project_history_feed(uuid, int, int) from public;
grant execute on function public.project_history_feed(uuid, int, int) to authenticated;

create or replace function public.search_project_history(
  p_produto_id uuid,
  p_search text,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  source_type text,
  source_id uuid,
  thread_id uuid,
  entry_id uuid,
  produto_id uuid,
  etapa_id uuid,
  event_at timestamptz,
  author_name text,
  title text,
  excerpt text,
  rank real
)
language sql
stable
security definer
set search_path = public, private
as $$
  with access_guard as (
    select private.can_access_project_chat(p_produto_id) as allowed
  ),
  q as (
    select websearch_to_tsquery('portuguese', trim(p_search)) as query
    where nullif(trim(p_search), '') is not null
  ),
  results as (
    select
      'chat'::text as source_type,
      m.id as source_id,
      m.thread_id,
      null::uuid as entry_id,
      m.produto_id,
      null::uuid as etapa_id,
      m.created_at as event_at,
      m.sender_nome as author_name,
      null::text as title,
      left(m.content, 240) as excerpt,
      ts_rank(m.fts, q.query)::real as rank
    from public.chat_thread_messages m
    cross join q
    where m.produto_id = p_produto_id
      and m.fts @@ q.query

    union all

    select
      'ata'::text as source_type,
      r.id as source_id,
      null::uuid as thread_id,
      r.id as entry_id,
      r.produto_id,
      r.etapa_id,
      r.criado_em as event_at,
      r.criado_por_nome as author_name,
      nullif(r.titulo, '') as title,
      left(coalesce(nullif(r.corpo, ''), nullif(r.participantes, ''), ''), 240) as excerpt,
      ts_rank(r.fts, q.query)::real as rank
    from public.reg_entrada r
    cross join q
    where r.produto_id = p_produto_id
      and r.fts @@ q.query

    union all

    select
      'ata_comentario'::text as source_type,
      c.id as source_id,
      null::uuid as thread_id,
      c.entrada_id as entry_id,
      r.produto_id,
      r.etapa_id,
      c.criado_em as event_at,
      c.autor_nome as author_name,
      nullif(r.titulo, '') as title,
      left(c.texto, 240) as excerpt,
      ts_rank(c.fts, q.query)::real as rank
    from public.reg_comentario c
    join public.reg_entrada r on r.id = c.entrada_id
    cross join q
    where r.produto_id = p_produto_id
      and c.fts @@ q.query
  )
  select
    r.source_type,
    r.source_id,
    r.thread_id,
    r.entry_id,
    r.produto_id,
    r.etapa_id,
    r.event_at,
    r.author_name,
    r.title,
    r.excerpt,
    r.rank
  from results r
  join access_guard g on g.allowed
  order by r.rank desc, r.event_at desc, r.source_id desc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.search_project_history(uuid, text, int, int) from public;
grant execute on function public.search_project_history(uuid, text, int, int) to authenticated;

notify pgrst, 'reload schema';

commit;
