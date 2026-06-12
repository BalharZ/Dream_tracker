-- S13 — Shluky zvyků AND/OR + eskalace
-- Vlož celé do Supabase SQL editoru a spusť (SQL Editor → New query → Run).
-- Skript je idempotentní — lze pustit opakovaně bez újmy.

-- 1) OR skupiny podcviků
--    or_group: číslo OR skupiny v rámci zvyku; podcviky se stejným číslem
--    tvoří shluk, ze kterého stačí splnit jeden (5 kliků NEBO 5 dřepů).
--    NULL = podcvik je povinný samostatně (AND, chování z S12).
alter table public.habit_subitems add column if not exists or_group integer;

-- 2) Eskalace v čase — po escalation_days dnech se nabídne přidání cviku /
--    zpřísnění shluku; last_escalation_at je kotva intervalu (lazy, bez cronu).
alter table public.habits add column if not exists escalation_days integer;
alter table public.habits add column if not exists last_escalation_at date;
