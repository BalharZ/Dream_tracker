# Demo data — dočasně vypnuto

Demo / ukázková data jsou **záměrně vypnutá**, dokud se nedořeší tutorial /
onboarding jako celek. Až se to vyřeší, tato verze se smaže a demo se udělá
znovu, líp.

## Co je vypnuté

- **Seeding při registraci** — `src/hooks/use-auth.tsx`: volání
  `seedDemoData(...)` je zakomentované a import `seedDemoData` / `DemoPreset`
  taky. Nový účet tedy začíná prázdný.
- **Výběr „For him / For her"** — `src/pages/auth-page.tsx`: přepínač pohlaví
  z registrace odstraněn (žádné komplikace s pohlavím).
- **Banner „Delete demo data"** — `src/pages/home-page.tsx`: `<DeleteDemoBanner />`
  se už na dashboardu nerendruje.

## Co zůstalo v kódu (nedotčené, pro budoucí použití)

- `src/lib/seed-demo-data.ts` — seeding logika.
- `src/lib/delete-demo-data.ts` — mazání demo řádků.
- `src/components/demo/delete-demo-banner.tsx` — banner komponenta.

## Data v databázi

Existující `is_demo = true` řádky v Supabase **zůstávají** (nemazaly se). Pokud
je chceš odstranit ručně, dá se použít `deleteDemoData(userId)` z
`src/lib/delete-demo-data.ts`.

## Jak demo zase zapnout

1. V `src/hooks/use-auth.tsx` odkomentovat import a volání `seedDemoData(...)`
   (a vrátit `preset` do `RegisterData`).
2. V `src/pages/auth-page.tsx` vrátit výběr presetu (nebo udělat nově bez pohlaví).
3. V `src/pages/home-page.tsx` vrátit `<DeleteDemoBanner />`.
