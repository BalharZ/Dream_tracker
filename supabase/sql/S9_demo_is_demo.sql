-- S9 — Demo presety muž/žena + smazání dema
-- Vlož celé do Supabase SQL editoru a spusť (SQL Editor → New query → Run).
-- Skript je idempotentní — lze pustit opakovaně bez újmy.

-- 1) Přidat příznak is_demo (default false) do všech čtyř tabulek
alter table public.dreams  add column if not exists is_demo boolean not null default false;
alter table public.goals   add column if not exists is_demo boolean not null default false;
alter table public.habits  add column if not exists is_demo boolean not null default false;
alter table public.rewards add column if not exists is_demo boolean not null default false;

-- 2) Zpětně označit staré demo řádky (původní seed z registrace).
--    Poznají se podle demo obrázků ve Storage (cesta obsahuje /images/demo-…),
--    které do appky nejde vložit jinak než seedem.
update public.dreams  set is_demo = true where image like '%/images/demo-%' and is_demo = false;
update public.goals   set is_demo = true where image like '%/images/demo-%' and is_demo = false;
update public.habits  set is_demo = true where image like '%/images/demo-%' and is_demo = false;
update public.rewards set is_demo = true where image like '%/images/demo-%' and is_demo = false;
