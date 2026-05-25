begin;

create schema if not exists private;

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

notify pgrst, 'reload schema';

commit;
