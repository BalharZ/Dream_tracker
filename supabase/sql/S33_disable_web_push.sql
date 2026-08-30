-- S33 — Vypnutí web pushe (jen nativní appka posílá připomínky)
-- Vlož do Supabase SQL editoru projektu Dream Tracker a spusť.
-- Idempotentní — lze pustit opakovaně bez újmy.
--
-- Web push (S16) způsoboval duplicitní / opožděné notifikace v prohlížeči
-- (Chrome doručoval frontu pushů dávkově, např. až po připojení telefonu) navíc
-- k notifikaci z nativní appky. Klient teď web push aktivně odhlašuje
-- (src/lib/push.ts + public/sw.js). Tímto se zastaví i serverová strana:
-- odplánuje se cron, který každých 5 min spouštěl Edge Function.

do $$ begin
  perform cron.unschedule('send-habit-notifications');
exception when others then null; end $$;

-- Kontrola: job už nesmí být v seznamu.
-- select jobid, jobname, active from cron.job;

-- Volitelně lze smazat i uložené browser subscriptions (klient je maže sám při
-- otevření, ale tímto se vyčistí i zařízení, která už appku neotevřou):
-- delete from public.push_subscriptions;

-- Edge Function `send-habit-notifications` lze ponechat nasazenou (bez cronu se
-- sama nespouští), nebo ji smazat v dashboardu (Edge Functions → delete).
