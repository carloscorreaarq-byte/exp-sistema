-- =====================================================================
-- EXP Chat - Production hotfix
-- Safe to run on databases that already executed phase 1 / phase 2.
-- It reapplies the hardened policies and installs the atomic reaction RPC.
-- =====================================================================

create schema if not exists private;

create or replace function private.chat_current_role()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select lower(coalesce(u.role::text, ''))
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1;
$$;

revoke all on function private.chat_current_role() from public;
grant execute on function private.chat_current_role() to authenticated;

create or replace function private.chat_channel_members(p_channel text)
returns text[]
language sql
immutable
as $$
  select case
    when p_channel like 'dm:%' then string_to_array(substring(p_channel from 4), ':')
    when p_channel like 'group:%' then string_to_array(substring(p_channel from 7), ':')
    else array[]::text[]
  end;
$$;

revoke all on function private.chat_channel_members(text) from public;
grant execute on function private.chat_channel_members(text) to authenticated;

create or replace function private.chat_can_access_channel(p_channel text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select auth.uid() is not null
    and (
      p_channel = 'general'
      or (
        p_channel = 'socios'
        and private.chat_current_role() in ('socio', 'socio_adm', 'socio_admin')
      )
      or (
        (p_channel like 'dm:%' or p_channel like 'group:%')
        and auth.uid()::text = any(private.chat_channel_members(p_channel))
      )
    );
$$;

revoke all on function private.chat_can_access_channel(text) from public;
grant execute on function private.chat_can_access_channel(text) to authenticated;

drop policy if exists "chat_msg_select" on public.chat_messages;
create policy "chat_msg_select"
on public.chat_messages
for select
using (private.chat_can_access_channel(channel));

drop policy if exists "chat_msg_insert" on public.chat_messages;
create policy "chat_msg_insert"
on public.chat_messages
for insert
with check (
  auth.uid() = sender_id
  and private.chat_can_access_channel(channel)
);

drop policy if exists "chat_msg_update" on public.chat_messages;

revoke update on public.chat_messages from anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_read_status to authenticated;

create or replace function public.chat_toggle_reaction(p_message_id uuid, p_reaction text)
returns public.chat_messages
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid text := auth.uid()::text;
  v_msg public.chat_messages%rowtype;
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
  from public.chat_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;

  if not private.chat_can_access_channel(v_msg.channel) then
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

  update public.chat_messages
  set reactions = jsonb_set(
    coalesce(v_msg.reactions, '{"like":[],"love":[]}'::jsonb),
    array[p_reaction],
    to_jsonb(coalesce(v_values, array[]::text[])),
    true
  )
  where id = p_message_id
  returning * into v_msg;

  return v_msg;
end;
$$;

revoke all on function public.chat_toggle_reaction(uuid, text) from public;
grant execute on function public.chat_toggle_reaction(uuid, text) to authenticated;

notify pgrst, 'reload schema';
