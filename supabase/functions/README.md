# Edge Functions — nasazení (S16)

## send-habit-notifications

Posílá web push připomínky zvyků (obrázek snu + pozitivní/negativní motivace).

### 1. Nasazení funkce

Varianta A — Supabase Dashboard (bez CLI):
1. Dashboard → **Edge Functions** → **Deploy a new function** → „Via Editor".
2. Název: `send-habit-notifications`, vlož obsah `send-habit-notifications/index.ts`, Deploy.

Varianta B — CLI: `supabase functions deploy send-habit-notifications`.

### 2. Secrets

Dashboard → Edge Functions → **Secrets** (nebo `supabase secrets set`):

| Secret | Hodnota |
|---|---|
| `VAPID_KEYS` | JSON z `supabase/vapid-keys.secret.txt` (řádek `VAPID_KEYS=...`, bez prefixu) |
| `CONTACT_EMAIL` | e-mail majitele (pro VAPID kontakt) |
| `NOTIFY_TZ` | volitelné, default `Europe/Prague` |

Klíče byly vygenerovány skriptem `node scripts/generate-vapid-keys.mjs`
(public key je v `.env.local` jako `VITE_VAPID_PUBLIC_KEY` — na Vercelu je
potřeba ho přidat do Environment Variables stejně jako ostatní `VITE_*`).

### 3. Cron

Spustit **část B** z `supabase/sql/S16_push_notifications.sql` v SQL editoru
(nahradit `<ANON_KEY>` skutečným anon klíčem). Funkce pak běží každých 5 minut,
posílá max 1 připomínku na zvyk a den (`habits.last_notified_date`) a do 90
minut po nastaveném čase (catch-up okno).

### 4. Test

Ruční zavolání:

```
curl -X POST https://cqhggjhidxmtmnunhzjx.supabase.co/functions/v1/send-habit-notifications \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" -d "{}"
```

Odpověď `{"sent":N,"due":M,...}`. Pro okamžitý test nastav u zvyku čas o pár
minut zpět a vynuluj `last_notified_date`.
