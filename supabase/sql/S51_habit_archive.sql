-- S51: archiv zvyků. Archivovaný zvyk zmizí z tabulky, dashboardu, widgetu
-- i připomínek, ale jeho historie (habit_progress) zůstává kvůli statistikám.
-- Spustit jednou v Supabase SQL editoru.

alter table public.habits
  add column if not exists archived_at timestamptz null;

-- Widget: archivované zvyky neukazovat (kopie RPC z S17 + podmínka archived_at).
create or replace function public.widget_get_today(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_today date := (now() at time zone 'Europe/Prague')::date;
  v_result jsonb;
begin
  select user_id into v_user from public.widget_tokens where token = p_token;
  if v_user is null then
    raise exception 'invalid widget token' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'target', h.target_value,
      'unit', h.unit,
      'value', coalesce(hp.value, 0),
      'done', h.target_value > 0 and coalesce(hp.value, 0) >= h.target_value
    ) order by h.name, h.id), '[]'::jsonb)
  into v_result
  from public.habits h
  left join public.habit_progress hp
    on hp.habit_id = h.id and hp.user_id = v_user and hp.date = v_today
  where h.user_id = v_user
    and h.archived_at is null;

  return v_result;
end;
$$;
