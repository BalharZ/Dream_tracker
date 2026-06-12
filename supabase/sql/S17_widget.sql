-- S17: Home-screen widget (Android) — widget tokens + RPC pro čtení/zápis bez přihlášení v appce
-- Widget běží mimo WebView (nemá Supabase session), proto se autentizuje dlouhodobým
-- náhodným tokenem (vygenerovaným v appce, uloženým v widget_tokens). RPC funkce jsou
-- SECURITY DEFINER: token ověří a pracují jen s daty vlastníka tokenu. Volají se přes
-- PostgREST (/rest/v1/rpc/...) s anon klíčem.

-- ===== A) Tabulka tokenů =====
create table if not exists public.widget_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.widget_tokens enable row level security;

drop policy if exists "Users manage own widget tokens" on public.widget_tokens;
create policy "Users manage own widget tokens" on public.widget_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== B) RPC: dnešní zvyky pro widget =====
-- Vrací [{id, name, target, unit, value, done}] pro vlastníka tokenu.
-- "Dnešek" se počítá v Europe/Prague (stejně jako push notifikace v S16).
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
  where h.user_id = v_user;

  return v_result;
end;
$$;

-- ===== C) RPC: splnit zvyk z widgetu =====
-- Nastaví dnešní hodnotu zvyku na target (stejně jako "✓" v TodayHabits):
-- upsert habit_progress + update habits.current_value. Kaskádový progres
-- goals/dreams dopočítá appka při příštím otevření (recomputeProgress na startu).
create or replace function public.widget_complete_habit(p_token text, p_habit_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_today date := (now() at time zone 'Europe/Prague')::date;
  v_target numeric;
begin
  select user_id into v_user from public.widget_tokens where token = p_token;
  if v_user is null then
    raise exception 'invalid widget token' using errcode = '28000';
  end if;

  select target_value into v_target
  from public.habits
  where id = p_habit_id and user_id = v_user;
  if v_target is null then
    raise exception 'habit not found' using errcode = 'P0002';
  end if;
  if v_target <= 0 then
    v_target := 1;
  end if;

  insert into public.habit_progress (habit_id, user_id, date, value)
  values (p_habit_id, v_user, v_today, v_target)
  on conflict (habit_id, user_id, date)
  do update set value = excluded.value;

  update public.habits set current_value = v_target where id = p_habit_id;

  return jsonb_build_object('ok', true, 'value', v_target);
end;
$$;

-- ===== D) Práva =====
-- RPC smí volat kdokoli s anon klíčem (ověření je uvnitř přes token).
revoke all on function public.widget_get_today(text) from public;
revoke all on function public.widget_complete_habit(text, bigint) from public;
grant execute on function public.widget_get_today(text) to anon, authenticated;
grant execute on function public.widget_complete_habit(text, bigint) to anon, authenticated;
