# Dream Tracker — Work Plan (session po session)

> Tento soubor je řízený seznam úprav rozdělený na samostatné sessiony.
> **Jak na to:** v nové konverzaci řekni „načti SESSIONS.md a udělej další session".
> Claude odpracuje **právě jednu** session, dole u ní zapíše `✅ Hotovo (datum)` + krátkou
> poznámku co se udělalo, a skončí. Pak session smaž a pokračuj další.
>
> Pravidla: vždy jen 1 session za konverzaci. Po dokončení označit ✅ a doplnit, jak ověřit.
> Sessiony S1–S8 nepotřebují DB. S9–S17 potřebují SQL v Supabase (přístup dá majitel přes Chrome extension).

## Stav
- [x] S1  Cíle — kritické opravy formuláře ✅
- [x] S2  Zvyky — úklid formuláře, stepper čísel, default šance ✅
- [x] S3  Odměny — obrázky, zobrazení, řazení, výběr ✅
- [x] S4  Ruleta — zarovnání výhry na mobilu ✅
- [x] S5  Progres — kaskáda habit → goal → dream ✅
- [x] S6  Welcome + spodní mobilní navigace ✅
- [x] S7  Dashboard — rychlé plnění zvyků + rychlý výběr odměn ✅
- [ ] S8  Jednotky — dědění z cíle + čas v minutách
- [ ] S9  (DB) Demo presety muž/žena + smazání dema
- [ ] S10 (DB) Poznámky ke zvykům
- [ ] S11 (DB) Více odměn jednoho typu na těžší zvyk
- [ ] S12 (DB) Snowball / postupně rostoucí zvyky + podcviky
- [ ] S13 (DB) Shluky zvyků AND/OR + eskalace
- [ ] S14 (DB) Celkový progres + upevnění zvyku (21 dní)
- [ ] S15 (DB) Kalendář + export do Google/Apple
- [ ] S16 (DB/infra) Push notifikace + čas u zvyku + obsah z snu
- [ ] S17 (native) Widget na plochu telefonu

---

### S1 — Cíle: kritické opravy formuláře  (bez DB)
**Soubory:** `src/pages/goals-page.tsx`
**Pokrývá body:** editace cíle nesmí ztratit podcíle; nemazatelná čísla; pořadí podcílů; scroll; auto-součet final_count; umístění tlačítka.
**Úkoly:**
1. **Oprava ztráty úprav:** `createGoal` musí podcíle řešit i při editaci — existující podcíle `update` podle `id`, nové `insert`, odebrané `delete`. (Teď se v `else` větvi řeší jen u nového cíle.)
2. **Stabilní pořadí podcílů:** řadit podle `id` vzestupně (pořadí vytvoření) a při editaci nepřemazávat (viz bod 1), aby se pořadí neměnilo.
3. **Mazatelná čísla:** `final_count` (hlavní cíl i podcíle) držet jako `string | number` a povolit prázdno během psaní; validovat až `onBlur`/submit. Vzor: `EditProgressDialog` v `habits-page.tsx`.
4. **Scrollovatelný dialog:** na `DialogContent` cíle přidat `max-h-[90vh] overflow-y-auto` (jako habit-form).
5. **Auto-součet:** pokud existují podcíle, `final_count` hlavního cíle = součet `final_count` podcílů (read-only, počítané). Pole hlavního final_count se pak skryje/zamkne.
6. **Zobrazení součtu + tlačítko:** spočítaný final_count zobrazit dole pod seznamem podcílů; tlačítko „Add Subgoal" přesunout blíž k „Create/Update Goal" (dolů).
**Ověření:** založ cíl bez podcílů (final_count jde vymazat a přepsat); přidej 3 podcíle → final_count = jejich součet; ulož; znovu otevři edit, přidej podcíl, ulož → uloží se a pořadí zůstane; přidej hodně podcílů → dialog jde scrollovat.

✅ **Hotovo (2026-06-05)** — `src/pages/goals-page.tsx`:
1. `createGoal` nyní synchronizuje podcíle i při editaci — existující `update` podle `id`, nové `insert`, odebrané `delete` (předtím se řešily jen u nového cíle → editace je mazala).
2. Stabilní pořadí: podcíle se načítají i zobrazují seřazené podle `id` vzestupně; editace ids nepřepisuje.
3. Mazatelná čísla: `final_count` hlavního cíle i podcílů drženo jako `number | string`, povolené prázdno během psaní, koerce při submitu (vzor `EditProgressDialog`).
4. Dialog cíle má `max-h-[90vh] overflow-y-auto`.
5. Auto-součet: existují-li podcíle, hlavní `final_count` = součet podcílů (pole je read-only/disabled s popiskem „Auto-summed from subgoals").
6. Pod seznamem podcílů je řádek „Total (final count)"; tlačítko „Add Subgoal" přesunuto dolů (nad „Create/Update Goal").
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) se načte bez chyb v logu i konzoli. Funkční scénář (vytvoření/editace s podcíli, scroll) vyžaduje přihlášení + Supabase data — k ručnímu doověření majitelem dle kroků výše.

### S2 — Zvyky: úklid formuláře + stepper čísel + default šance  (bez DB)
**Soubory:** `src/components/habits/habit-form.tsx`, nový `src/components/ui/number-stepper.tsx`
**Pokrývá body:** odstranit duplicitní motivaci; lepší UI čísel (+/−); default 50 % no-reward; mazatelný target.
**Úkoly:**
1. **Odstranit** pole „What will you gain…" / „What will happen…" z habit-form (je to duplikace motivace ze snu).
2. **NumberStepper komponenta:** vstup s tlačítky − / + (a možností psát ručně, povolit prázdno). Použít pro `target_value` a pro pole „Chance %" u odměn.
3. **Mazatelný `target_value`:** ošetřit `parseFloat` tak, aby šlo vymazat (žádné `NaN`).
4. **Default rozložení šancí:** při výběru odměn nastavit no-reward ~50 % a zbylých ~50 % rovnoměrně rozdělit mezi vybrané odměny (přepočítat při přidání/odebrání).
**Ověření:** v habit-form už nejsou pole motivace; target jde vymazat; +/− mění hodnoty; po výběru 2 odměn je no-reward ~50 % a každá odměna ~25 %.

✅ **Hotovo (2026-06-05)** — nová `src/components/ui/number-stepper.tsx` + `src/components/habits/habit-form.tsx`:
1. Odstraněna pole „What will you gain…" / „What will happen…" (duplikace motivace ze snu). Hodnoty `positive/negative_motivation` zůstávají ve formuláři a při uložení se nepřemazávají (jen už nejsou editovatelná v UI).
2. Nová komponenta `NumberStepper` — input s tlačítky − / +, ruční psaní, povolené prázdno, volitelné `min/max/step` (klampuje na blur a u tlačítek), podpora desetinné čárky/tečky.
3. `target_value` používá `NumberStepper` (`min=0`); pole jde vymazat (drží `""`), při submitu se prázdno koercuje na `0` (žádné `NaN`).
4. Pole „Chance %" u odměn nahrazeno `NumberStepper` (`min=1`, `max=100−ostatní`, `step=5`). Default rozložení: při přidání/odebrání odměny se přepočítá `distributeChances` → no-reward ~50 % a zbylých ~50 % rovnoměrně mezi vybrané (2 odměny → 25/25, no-reward 50; 3 → 17/17/16).
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) naběhl bez chyb v server logu i konzoli. Funkční scénář (výběr odměn, stepper, mazání targetu) vyžaduje přihlášení + Supabase data — k ručnímu doověření majitelem dle kroků výše.

### S3 — Odměny: obrázky, zobrazení, řazení, výběr  (bez DB)
**Soubory:** `src/pages/rewards-page.tsx`, `src/components/habits/habit-form.tsx`, příp. drobně `src/pages/dreams-page.tsx`, `src/pages/goals-page.tsx`
**Pokrývá body:** upload + API hledání obrázků u odměn; mazací tlačítko URL; vytvoření odměny v zvyku; fill zobrazení obrázku; řazení dle množství; default „všechny" + filtr kategorií.
**Úkoly:**
1. **Obrázky u odměn:** v `AddRewardForm` nahradit/doplnit textové URL komponentou `ImageGallery` (Unsplash search + upload) — už existuje, jen ji připojit. Ponechat i ruční URL + tlačítko **X pro smazání URL**. (Stejné X tlačítko doplnit i u image polí v dream/goal formuláři.)
2. **Vytvoření odměny ve zvyku:** v selektoru odměn (habit-form) přidat „+ Vytvořit odměnu", aby šlo přidat odměnu bez odchodu na stránku Rewards.
3. **Fill zobrazení:** obrázky odměn zobrazovat tak, aby byl vidět celý obrázek; na mobilu 100 % šířky (RewardCard, stash, karty rulety). (Zvážit `object-contain` místo `bg-cover`/`object-cover`.)
4. **Řazení odměn:** na stránce Rewards řadit podle `available` sestupně, pak `created_at`.
5. **Výběr odměn:** ve výběru (habit-form i Browse) defaultně zobrazit **všechny** odměny; kategorie až jako volitelný filtr.
**Ověření:** u odměny jde nahrát/vyhledat obrázek i smazat URL; odměna jde vytvořit přímo ve zvyku; obrázek je vidět celý a na mobilu přes celou šířku; odměny s vyšším `available` jsou nahoře; výběr ukazuje rovnou všechny.

✅ **Hotovo (2026-06-05)** — `src/pages/rewards-page.tsx`, `src/components/habits/habit-form.tsx`, `src/pages/dreams-page.tsx`, `src/pages/stash-page.tsx`, `src/pages/habits-page.tsx`:
1. **Obrázky u odměn:** `AddRewardForm` má teď `ImageGallery` (Unsplash hledání + upload) přes ikonu obrázku, vedle ruční URL, + náhled (`object-contain`) a tlačítko **X** pro smazání URL. Stejné X tlačítko doplněno i u image pole v dream formuláři (goal formulář žádné image pole v UI nemá → vynecháno).
2. **Vytvoření odměny ve zvyku:** v selektoru odměn (habit-form) přidáno „Create new reward" — inline formulář (název + obrázek přes galerii/URL + X), po vytvoření se odměna uloží, query `rewards` se invaliduje a nová odměna se rovnou vybere (s přepočtem šancí).
3. **Fill zobrazení:** karty odměn (RewardCard, stash, karty rulety) zobrazují celý obrázek přes `object-contain` na `bg-muted` místo `bg-cover`/`object-cover`; na mobilu jsou karty plná šířka (grid 1 sloupec). Fallback ikona při chybějícím obrázku.
4. **Řazení odměn:** Rewards stránka řadí `available` sestupně, pak `created_at` sestupně.
5. **Výběr odměn:** Browse preset dialog defaultně ukazuje **všechny** odměny (napříč kategoriemi), kategorie je volitelný filtr („All categories"). Selektor ve zvyku už dřív ukazoval všechny vlastní odměny.
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) naběhl bez chyb v logu a app se renderuje (login). Funkční scénáře (upload obrázku, vytvoření odměny ve zvyku, řazení) vyžadují přihlášení + Supabase — k ručnímu doověření majitelem dle kroků výše.

### S4 — Ruleta: zarovnání výhry na mobilu  (bez DB)
**Soubory:** `src/pages/habits-page.tsx` (`RewardRoulette`, `getRewardStyles`)
**Pokrývá body:** na mobilu čára ukazuje jinou výhru, než se reálně vyhraje.
**Úkoly:** nahradit pevný `translateX(-5730px)` výpočtem podle skutečné šířky karty (`w` + `mx`) a šířky kontejneru: posun = `winningIndex * cardTotalWidth − (containerWidth/2) + cardWidth/2`, aby výherní karta (index 50) skončila přesně pod oranžovou čárou na všech velikostech. Měřit přes `ref`/`useEffect`.
**Ověření:** na mobilu i desktopu (preview_resize) skončí zvýrazněná karta přesně pod čárou a odpovídá vyhrané odměně.

✅ **Hotovo (2026-06-05)** — `src/pages/habits-page.tsx` (`RewardRoulette`, `getRewardStyles`):
- Pevný `translateX(-5730px)` (sedl jen na desktop ~660px) nahrazen hodnotou počítanou z reálných rozměrů. Přidány `containerRef` (overflow kontejner) a `winningCardRef` (karta s indexem 50) + `useLayoutEffect`, který měří `containerWidth` a střed výherní karty (`offsetLeft + offsetWidth/2`) a nastaví `targetTranslate = round(containerWidth/2 − cardCenter)`. Měření běží při otevření rulety i na `resize`.
- Oranžová čára je horizontálně uprostřed kontejneru (`justify-center`), takže střed výherní karty (index 50) skončí přesně pod ní na jakékoli šířce. `getRewardStyles` (spinning i finished) a statický fallback styl pásu používají `targetTranslate` místo `-5730`.
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) naběhl bez chyb v logu. Výpočet je založen na skutečně naměřené šířce karty/kontejneru, takže je responzivní; vizuální doladění (ruleta je za přihlášením + Supabase daty) k doověření majitelem dle kroků výše (mobil i desktop přes preview_resize).

### S5 — Progres: kaskáda habit → goal → dream  (bez DB)
**Soubory:** nový `src/lib/progress.ts`, `src/pages/habits-page.tsx`, příp. `goals-page.tsx`
**Pokrývá body:** progres se reálně nepočítá.
**Model (k potvrzení při session):** habit příspěvek = součet `habit_progress.value` (nebo počet splněných dní) vůči cíli; `goal.progress` = `min(100, naplněno / final_count * 100)`; cíl s podcíli = vážený průměr podcílů; `dream.progress` = průměr jeho kořenových cílů.
**Úkoly:** util `recomputeProgress(userId)`, který načte data, spočítá a zapíše `goals.progress` + `dreams.progress`. Volat po každém zápisu zvyku (`habits-page` `updateProgress.onSuccess`) a po relevantních mutacích.
**Ověření:** zadání hodnot ve zvyku zvýší % u napojeného cíle i snu na dashboardu i v detailu.

✅ **Hotovo (2026-06-05)** — nový `src/lib/progress.ts` + napojení v `src/pages/habits-page.tsx` a `src/pages/goals-page.tsx`:
1. **`recomputeProgress(userId)`** — načte `goals`, `habits`, `habit_progress`, `dreams` (paralelně), spočítá kaskádu a zapíše zpět `goals.progress` + `dreams.progress`. Model (potvrzený):
   - příspěvek zvyku = součet všech `habit_progress.value` daného zvyku;
   - **leaf cíl** (bez podcílů): `progress = min(100, naplněno / final_count * 100)`, kde naplněno = součet příspěvků zvyků napojených přes `goal_id`; guard na `final_count <= 0` → 0;
   - **cíl s podcíli**: vážený průměr podcílů vážený jejich `final_count` (fallback prostý průměr, když jsou váhy 0);
   - **sen**: průměr jeho kořenových cílů (`parent_goal_id === null` se shodným `dream_id`).
2. Zapisuje se jen tam, kde se zaokrouhlené % reálně změnilo (minimalizace round-tripů); hodnoty se ukládají zaokrouhlené a klampnuté na 0–100.
3. **Volání:** po každém zápisu zvyku (`updateProgress` mutationFn, po `current_value` update), a po relevantních mutacích cílů — `createGoal` (vytvoření/editace + sync podcílů, mění se `final_count`/struktura) a `deleteGoal`. Pak se invaliduje `goals`/`dreams`/`habits`.
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) běží bez chyb v server logu i konzoli (HMR by jinak hlásil chybu). Funkční scénář (zápis hodnoty zvedne % u cíle i snu) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S6 — Welcome + spodní mobilní navigace  (bez DB)
**Soubory:** `src/pages/home-page.tsx`, `src/components/layouts/main-layout.tsx`
**Pokrývá body:** uvítání jménem; spodní lišta s ikonami místo hamburgeru.
**Úkoly:**
1. Z uvítání odstranit jméno (obecné „Welcome back!").
2. Na mobilu přidat **spodní navigační lištu** s ikonami (Dashboard, Dreams, Goals, Rewards=dárek, Habits) a zrušit hamburger; na desktopu nechat sidebar.
**Ověření:** mobil ukazuje spodní lištu, přepínání funguje, hamburger pryč; desktop beze změny.

✅ **Hotovo (2026-06-05)** — `src/pages/home-page.tsx`, `src/components/layouts/main-layout.tsx`:
1. **Uvítání bez jména:** `Welcome, {displayName}!` → obecné „Welcome back!" (home-page).
2. **Spodní mobilní navigace:** odstraněn hamburger + `Sheet` (a state `isMobileOpen`/`useEffect`/import `Menu`,`Sheet*`). Na mobilu (`md:hidden`) přidány dva fixní prvky:
   - **horní lišta** (`fixed top-0`, h-14) s názvem „Dream Tracker" a ikonou Logout (hamburger tím nahrazen, logout zůstal dostupný);
   - **spodní lišta** (`fixed bottom-0`, `border-t`, `backdrop-blur`) s 5 ikonami+popisky (Dashboard, Dreams, Goals, Rewards=Gift, Habits), aktivní položka `text-primary`, `aria-current="page"`; respektuje `env(safe-area-inset-bottom)`.
   - Hlavní obsah dostal `pt-20 pb-24` na mobilu (`md:pt-6 md:pb-6`), aby ho lišty nepřekrývaly.
   - Desktop sidebar (`hidden md:flex`) beze změny.
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) renderuje login bez chyb a bez Vite error overlaye po reloadu. (Chybové logy v bufferu byly z mezistavu HMR během editace importů — finální modul je čistý.) Spodní lišta se renderuje až po přihlášení (`if (!user)`) → vizuální doověření na mobilu (přepínání, hamburger pryč, desktop beze změny) za přihlášením + Supabase k ručnímu ověření majitelem dle kroků výše.

### S7 — Dashboard: rychlé plnění zvyků + rychlý výběr odměn  (bez DB)
**Soubory:** `src/pages/home-page.tsx`, sdílená komponenta z habit gridu, příp. route pro `stash-page.tsx`
**Pokrývá body:** nahoře na dashboardu zvyky k okamžitému vyplnění (spouští ruletu); rychlý výběr odměn z dashboardu s mezikrokem (kolik vybrat, default 1, potvrdit); zpřístupnit stash.
**Úkoly:**
1. Vyčlenit z `habits-page` znovupoužitelnou tabulku/řádek zvyku a vložit na dashboard pro dnešní den (vyplnění spustí stejnou ruletu).
2. Mini-karty odměn (foto, název, počet, tlačítko „Vybrat") + dialog s počtem (default 1) a potvrzením.
3. Přidat route na `stash-page` (vyhrané odměny) do `App.tsx` + odkaz v navigaci.
**Ověření:** z dashboardu jde vyplnit dnešní zvyk i vybrat odměnu vč. počtu; stash je dostupný.

✅ **Hotovo (2026-06-09)** — nové `src/components/habits/reward-roulette.tsx`, `src/components/habits/today-habits.tsx`, `src/components/rewards/quick-rewards.tsx`; úpravy `src/pages/habits-page.tsx`, `src/pages/home-page.tsx`, `src/App.tsx`, `src/components/layouts/main-layout.tsx`:
1. **Znovupoužitelná ruleta:** `RewardRoulette` vyčleněna z `habits-page.tsx` do vlastního souboru `reward-roulette.tsx` (export) a importována zpět — habits-page i dashboard tak spouští **stejnou** ruletu (vč. claim odměny: `available + 1`, invalidace `rewards`/`stash`).
2. **Rychlé plnění zvyků na dashboardu:** nová `TodayHabits` — kompaktní seznam dnešních zvyků (NumberStepper + tlačítko „✓" = nastav na target). Zápis používá **stejný pipeline** jako habits-page (upsert `habit_progress` pro dnešek → `habits.current_value` → `recomputeProgress`), debounce 700 ms; po dosažení targetu a existenci napojené odměny se otevře ruleta. Filtr zvyků jako na habits-page (skryje zvyky s neexistujícím cílem).
3. **Rychlý výběr odměn:** nová `QuickRewards` — mini-karty zasloužených odměn (`available > 0`: obrázek, název, počet, „Select"). „Select" otevře dialog s počtem (NumberStepper, default 1, max = `available`, potvrzení), který sníží `available` o vybraný počet (invalidace `rewards`/`stash`) + toast. Odkaz „View stash".
4. **Stash zpřístupněn:** route `/stash` přidán do `App.tsx` a položka „Stash" (ikona Trophy) do navigace (desktop sidebar i mobilní spodní lišta).
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) po reloadu renderuje app bez chyb (login se zobrazí čistě, žádný runtime crash — `HabitsPage` se importuje eagerly, takže duplicitní deklarace by shodila celou app). Funkční scénáře (vyplnění zvyku z dashboardu spustí ruletu, výběr odměny s počtem, navigace do stashe) jsou za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S8 — Jednotky: dědění z cíle + čas v minutách  (bez DB)
**Soubory:** `src/pages/goals-page.tsx`, `src/components/habits/habit-form.tsx`, příp. helper jednotek
**Pokrývá body:** jednotka z cíle se propíše do podcílů; při tvorbě zvyku napojeného na cíl se jednotka přebere; je-li jednotka časová (hodiny), umožnit zvolit minuty (s převodem).
**Úkoly:** podcíle dědí `unit` z cíle; v habit-form při výběru cíle předvyplnit `unit`; u časových jednotek nabídnout přepínač hodiny/minuty a správně přepočítat vůči cíli.
**Ověření:** podcíl zdědí jednotku; zvyk napojený na cíl „hodiny" jde zadávat v minutách a sčítá se správně.

---
> **Níže potřebují SQL v Supabase (přístup přes Chrome extension). U každé session Claude nejdřív připraví SQL k vložení do Supabase SQL editoru, pak teprve kód.**

### S9 — (DB) Demo presety muž/žena + smazání dema
**Soubory:** `src/lib/seed-demo-data.ts`, registrační flow (`use-auth.tsx`/auth-page), `shared/schema.ts`
**DB:** přidat `is_demo boolean default false` do `dreams/goals/habits/rewards`.
**Pokrývá body:** bohatší demo presety (muž/žena: dům, postava, projekt, cvičení) s více sny/cíli; tlačítko „Smazat demo data" (maže jen `is_demo=true`).
**Ověření:** nový účet dostane bohaté demo; tlačítko smaže pouze demo a schová se.

### S10 — (DB) Poznámky ke zvykům
**Soubory:** `habit-form.tsx`, `habits-page.tsx`, `shared/schema.ts`
**DB:** `notes text` na `habits` (nebo tabulka `habit_notes`).
**Pokrývá body:** sekce poznámek u zvyku.
**Ověření:** poznámku lze uložit a zobrazit u zvyku.

### S11 — (DB) Více odměn jednoho typu na těžší zvyk
**Soubory:** `habit-form.tsx`, ruleta v `habits-page.tsx`, `shared/schema.ts`
**DB/Model:** k potvrzení — buď `quantity` v `habit_chances` JSON (bez schématu), nebo nové pole. (např. 5× 1 h hraní).
**Pokrývá body:** přiřadit více instancí jedné odměny náročnějšímu zvyku.
**Ověření:** zvyku jde nastavit více kusů jedné odměny a ruleta/claim to respektuje.

### S12 — (DB) Snowball / postupně rostoucí zvyky + podcviky
**Soubory:** `shared/schema.ts`, `habit-form.tsx`, `habits-page.tsx`, nové komponenty
**DB:** typ zvyku (`snowball`), `base_target`, `step`, `interval_days` (např. 21 dní), a model „podcviků" (řádky pod hlavním zvykem — počet nebo fajfka).
**Pokrývá body:** minimální denní cíl, pozvolný růst (21 dní), možnost navýšit dřív; hlavní zvyk „Cvičení" s podřádky (kliky/dřepy/sedlehy).
**Ověření:** snowball zvyk roste podle pravidla; podcviky jdou vyplňovat jednotlivě.

### S13 — (DB) Shluky zvyků AND/OR + eskalace
**Soubory:** `shared/schema.ts`, habit-form/habits-page, navazuje na S12
**DB:** model shluku (skupina podcviků s podmínkami OR/AND, eskalace v čase).
**Pokrývá body:** splnění shluku přes OR (5 kliků NEBO 5 dřepů), postupné přidávání cviků, kombinace 1×AND + 1×OR.
**Ověření:** shluk se vyhodnotí podle OR/AND; po čase se nabídne eskalace.

### S14 — (DB nebo compute) Celkový progres + upevnění zvyku (21 dní)
**Soubory:** `src/lib/progress.ts` (z S5), dashboard, habits-page
**Pokrývá body:** celkový progres napříč; „zvyk upevněn" po 21 dnech v řadě.
**Úkoly:** detekce série (streak) z `habit_progress`; indikátor upevnění; agregovaný progres. (Možná bez DB, jen výpočet.)
**Ověření:** 21 dní v řadě → zvyk označen jako upevněný; celkový progres sedí.

### S15 — (DB) Kalendář + export do Google/Apple
**Soubory:** nová stránka kalendáře + route, `shared/schema.ts`
**DB:** tabulka `events`.
**Pokrývá body:** podstránka kalendáře (à la Google) s plány; tlačítko pro export události do Google/Apple kalendáře (nejjednodušší: generování `.ics`).
**Ověření:** událost jde vytvořit, zobrazit v kalendáři a vyexportovat (.ics / Google).

### S16 — (DB/infra) Push notifikace + čas u zvyku + obsah z snu
**Soubory:** service worker (PWA), `shared/schema.ts`, habit-form, Supabase Edge Function/cron
**DB/infra:** nastavení notifikací u zvyku (`notify bool`, `notify_time`), tabulka push subscriptions; web push (PWA) + odesílání přes Edge Function. (Nativně později přes Capacitor.)
**Pokrývá body:** notifikace do telefonu; u zvyku zapnutí + čas; notifikace ukáže obrázek snu + pozitivní i negativní motivaci.
**Ověření:** ve zvolený čas přijde push s obrázkem snu a motivací.

### S17 — (native) Widget na plochu telefonu
**Soubory:** Capacitor projekt + nativní Android widget
**Pokrývá body:** vyplnění zvyků z plochy bez otevření aplikace.
**Ověření:** widget na ploše umožní zapsat splnění zvyku.

---

## Poznámky k závislostem
- S14 staví na S5 (progres). S13 staví na S12 (snowball/podcviky). S16 a S17 jsou největší a vyžadují infra rozhodnutí (PWA web push vs. nativní Capacitor).
- Pořadí S1–S8 je doporučené (rychlé, vysoký dopad, bez DB), ale sessiony jsou víceméně nezávislé — pořadí lze měnit.
