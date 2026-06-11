-- S10 — Poznámky ke zvykům
-- Vlož celé do Supabase SQL editoru a spusť (SQL Editor → New query → Run).
-- Skript je idempotentní — lze pustit opakovaně bez újmy.

alter table public.habits add column if not exists notes text;
