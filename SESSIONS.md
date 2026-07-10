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
- [x] S8  Jednotky — dědění z cíle + čas v minutách ✅
- [x] S9  (DB) Demo presety muž/žena + smazání dema ✅
- [x] S10 (DB) Poznámky ke zvykům ✅
- [x] S11 (DB) Více odměn jednoho typu na těžší zvyk ✅
- [x] S12 (DB) Snowball / postupně rostoucí zvyky + podcviky ✅
- [x] S13 (DB) Shluky zvyků AND/OR + eskalace ✅
- [x] S14 (compute) Celkový progres + upevnění zvyku (21 dní) ✅
- [x] S15 (DB) Kalendář + export do Google/Apple ✅
- [x] S16 (DB/infra) Push notifikace + čas u zvyku + obsah z snu ✅
- [x] S17 (native) Widget na plochu telefonu ✅
- [x] S18 (native) Appka loaduje živý web (auto-update) + tlačítko stažení APK ✅
- [x] S19 Reset hesla při loginu ✅
- [x] S20 (native) Notifikace v mobilní appce — lokální notifikace ✅

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

✅ **Hotovo (2026-06-11)** — nový `src/lib/units.ts` + úpravy `src/lib/progress.ts`, `src/pages/goals-page.tsx`, `src/components/habits/habit-form.tsx`:
1. **Helper jednotek `units.ts`:** detekce časových jednotek (hodiny/minuty, EN i CZ varianty: h/hr/hours/hod/hodiny…, min/minutes/minuty…), `timeAltUnit` (komplementární jednotka), `sameTimeUnit` a `conversionFactor` (min→h = 1/60, h→min = 60, jinak 1).
2. **Dědění jednotky u podcílů (goals-page):** pole „Unit" u podcíle odstraněno — místo něj se zobrazuje jednotka hlavního cíle (read-only, živě přes `form.watch("unit")`). Při uložení dostanou všechny podcíle `unit` hlavního cíle (update i insert). Stav podcílů už `unit` nedrží.
3. **Předvyplnění jednotky ve zvyku (habit-form):** při výběru cíle v selektoru se `unit` zvyku automaticky nastaví na jednotku cíle (jde dál přepsat; „no goal" jednotku nemění).
4. **Čas v minutách:** je-li jednotka napojeného cíle časová, místo textového pole se zobrazí přepínač dvou tlačítek — jednotka cíle vs. komplementární („hodiny" ↔ „minutes"). Při volbě odlišné jednotky se ukáže popisek „Entries are converted to {jednotka cíle} for goal progress (60 min = 1 h)".
5. **Správné sčítání (progress.ts):** příspěvek zvyku k cíli se před přičtením násobí `conversionFactor(habit.unit, goal.unit)` — zvyk v minutách na cíl v hodinách se počítá /60 (a obráceně ×60); nečasové jednotky beze změny.
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) běží bez chyb v server logu i konzoli, login se renderuje čistě. Funkční scénář (podcíl zdědí jednotku; zvyk na cíl „hodiny" zadávaný v minutách se správně sčítá) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

---
> **Níže potřebují SQL v Supabase (přístup přes Chrome extension). U každé session Claude nejdřív připraví SQL k vložení do Supabase SQL editoru, pak teprve kód.**

### S9 — (DB) Demo presety muž/žena + smazání dema
**Soubory:** `src/lib/seed-demo-data.ts`, registrační flow (`use-auth.tsx`/auth-page), `shared/schema.ts`
**DB:** přidat `is_demo boolean default false` do `dreams/goals/habits/rewards`.
**Pokrývá body:** bohatší demo presety (muž/žena: dům, postava, projekt, cvičení) s více sny/cíli; tlačítko „Smazat demo data" (maže jen `is_demo=true`).
**Ověření:** nový účet dostane bohaté demo; tlačítko smaže pouze demo a schová se.

✅ **Hotovo (2026-06-11)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S9_demo_is_demo.sql` — sloupec `is_demo` ověřen ve všech 4 tabulkách (`boolean`, default `false`); backfill označil stará demo data: 11 dreams, 11 goals, 11 habits, 36 rewards.
1. **Presety (`src/lib/seed-demo-data.ts`):** kompletní přepis na datově řízené presety `male`/`female` — každý 3 sny (dům/bydlení, postava/cvičení, vlastní projekt), každý sen s cílem a 1–2 zvyky, + 4 odměny s `habit_chances` na zvyky (~50 % no-reward na zvyk). Vše `is_demo: true`. Obrázky: stávající demo ze Storage + 8 ověřených Unsplash URL (všechny otestovány, že se načtou).
2. **Výběr presetu při registraci (`auth-page.tsx`, `use-auth.tsx`):** v registračním formuláři přepínač „Starter examples: For him / For her" (default For him) + popisek; `RegisterData` nese `preset` a předá ho `seedDemoData`.
3. **Smazání dema:** nový `src/lib/delete-demo-data.ts` (`hasDemoData`, `deleteDemoData` — maže v FK-safe pořadí: habit_progress demo zvyků → rewards → habits → goals → dreams, jen `is_demo=true`; pak `recomputeProgress`). Nový banner `src/components/demo/delete-demo-banner.tsx` na dashboardu (`home-page.tsx`) — zobrazí se jen když demo existuje, tlačítko „Delete demo data" s potvrzovacím AlertDialogem, po smazání invalidace queries → banner sám zmizí. Když sloupec `is_demo` ještě neexistuje, banner se prostě nezobrazí (žádný crash).
4. **`shared/schema.ts`:** `is_demo: boolean` přidán do `Dream`, `Goal`, `Habit`, `Reward`.
**Ověřeno:** `tsc --noEmit` bez chyb; v preview registrační formulář ukazuje přepínač a přepíná bez chyb v konzoli; všech 8 nových Unsplash obrázků reálně načteno (test v prohlížeči). Funkční scénář (registrace nového účtu → bohaté demo; smazání dema → zmizí jen demo + banner) vyžaduje nejdřív spustit SQL → k doověření majitelem.

### S10 — (DB) Poznámky ke zvykům
**Soubory:** `habit-form.tsx`, `habits-page.tsx`, `shared/schema.ts`
**DB:** `notes text` na `habits` (nebo tabulka `habit_notes`).
**Pokrývá body:** sekce poznámek u zvyku.
**Ověření:** poznámku lze uložit a zobrazit u zvyku.

✅ **Hotovo (2026-06-11)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S10_habit_notes.sql` — `alter table public.habits add column if not exists notes text;` (idempotentní); sloupec ověřen dotazem do `information_schema.columns` → `notes | text | nullable`.
1. **`shared/schema.ts`:** `notes: string | null` přidáno do typu `Habit`.
2. **`habit-form.tsx`:** nové pole „Notes" (Textarea, 3 řádky, volitelné) mezi Frequency/Color a sekcí Rewards; hodnota je v defaultValues i obou resetech (edit/nový) a ukládá se při insert i update (`trim()`, prázdno → `null`).
3. **`habits-page.tsx`:** v tabulce History se u zvyku s poznámkou zobrazí ikona lístečku (StickyNote) vedle názvu s tooltippem (plný text v `title`) — záměrně jen ikona, aby se nerozhodilo zarovnání řádků levého a pravého sloupce tabulky. Plný text poznámky se zobrazuje v dialogu zápisu progresu (`EditProgressDialog`) pod datem/targetem (rámeček, `whitespace-pre-line`).
**Ověřeno:** SQL spuštěno a sloupec potvrzen v DB; `tsc --noEmit` bez chyb; dev server (Vite) po reloadu renderuje login bez chyb v konzoli. Funkční scénář (uložit poznámku ve formuláři zvyku → ikona v tabulce + text v dialogu dne) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S11 — (DB) Více odměn jednoho typu na těžší zvyk
**Soubory:** `habit-form.tsx`, ruleta v `habits-page.tsx`, `shared/schema.ts`
**DB/Model:** k potvrzení — buď `quantity` v `habit_chances` JSON (bez schématu), nebo nové pole. (např. 5× 1 h hraní).
**Pokrývá body:** přiřadit více instancí jedné odměny náročnějšímu zvyku.
**Ověření:** zvyku jde nastavit více kusů jedné odměny a ruleta/claim to respektuje.

✅ **Hotovo (2026-06-12)** — **BEZ SQL**: zvolena varianta „quantity v `habit_chances` JSON" (sloupec je `text`, žádná změna schématu). Hodnota v JSON je nově buď číslo (stará data = šance v %, množství 1), nebo objekt `{ chance, quantity }`; při uložení s množstvím 1 se zapisuje zpět prosté číslo → plná zpětná kompatibilita (staré parsery `chances[habitId] !== undefined` v `habits-page`/`today-habits` fungují beze změny).
1. **Nový `src/lib/habit-chances.ts`:** helpery `parseHabitChances` (bezpečný parse), `getChance`, `getQuantity` (číslo → 1; objekt → `max(1, round(quantity))`), `makeChanceEntry` (quantity > 1 → objekt, jinak číslo).
2. **`shared/schema.ts`:** `HabitChances` rozšířen na `{ [habitId]: ChanceEntry }`, kde `ChanceEntry = number | { chance, quantity? }`.
3. **`habit-form.tsx`:** u každé vybrané odměny nový stepper **„Pieces per win" ×** (NumberStepper, min 1, max 99, default 1; jde vymazat během psaní, koerce na ≥1 při uložení). Při editaci zvyku se množství načte z JSON; při uložení se zapisuje přes `makeChanceEntry`. Odebrání odměny/zvyku z `habit_chances` beze změny (funguje pro obě podoby hodnoty).
4. **`reward-roulette.tsx`:** šance se čtou přes helpery (číslo i objekt); **claim připíše `available + quantity`** místo +1; karty rulety s množstvím > 1 mají oranžový badge „×N"; výherní hláška zní „You won 3× X!" (u 1 kusu beze změny „You won a X!").
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) renderuje login bez chyb v server logu i konzoli. Funkční scénář (nastavit zvyku odměnu s „Pieces per win" 5 → výhra v ruletě připíše 5 kusů do `available`/stash) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S12 — (DB) Snowball / postupně rostoucí zvyky + podcviky
**Soubory:** `shared/schema.ts`, `habit-form.tsx`, `habits-page.tsx`, nové komponenty
**DB:** typ zvyku (`snowball`), `base_target`, `step`, `interval_days` (např. 21 dní), a model „podcviků" (řádky pod hlavním zvykem — počet nebo fajfka).
**Pokrývá body:** minimální denní cíl, pozvolný růst (21 dní), možnost navýšit dřív; hlavní zvyk „Cvičení" s podřádky (kliky/dřepy/sedlehy).
**Ověření:** snowball zvyk roste podle pravidla; podcviky jdou vyplňovat jednotlivě.

✅ **Hotovo (2026-06-12)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S12_snowball_subitems.sql` — na `habits` přidány sloupce `habit_type` (default `'standard'`), `base_target`, `step_value`, `interval_days`, `last_increase_at`; nové tabulky `habit_subitems` (name, target, unit, position; FK na habits s cascade) a `habit_subitem_progress` (unique `subitem_id+user_id+date`) vč. indexů a RLS (`auth.uid() = user_id`). Ověřeno dotazem do `information_schema.columns` → 18 řádků (5+8+5) přesně dle očekávání.
1. **Model snowball:** `target_value` drží **aktuální** cíl; roste o `step_value` po každých `interval_days` od kotvy `last_increase_at` (fallback `created_at`). Růst se aplikuje **lazy** při načtení zvyků (`src/lib/snowball.ts` → `applySnowballGrowth`, volá se z `habits-page` i `today-habits`; kotva se posouvá po celých intervalech, takže kadence drží i při pozdním otevření appky; po zápisu se invaliduje query → nemůže cyklit). Žádný cron není potřeba.
2. **`habit-form.tsx`:** nový select „Habit Type" (Standard / Snowball). U snowballu místo Target Value pole **Start Target** + blok **Increase By (step)** a **Every (days)** (default 21, NumberStepper). Při vytvoření `target_value = base_target`, `last_increase_at = dnes`; při editaci existujícího snowballu se vyrostlý target nepřepisuje; přepnutí standard→snowball restartuje na base. U editovaného snowballu řádek „Current target: X" + tlačítko **„Increase now (+step)"** (= možnost navýšit dřív; navýší hned a restartuje interval, zavře dialog).
3. **Podcviky:** v habit-form sekce **Sub-exercises** — řádky název + target (NumberStepper; target 1 = fajfka) + X, „Add sub-exercise". Sync při uložení: update podle `id`, insert nových, delete odebraných.
4. **Plnění jednotlivě (`habits-page.tsx` → `EditProgressDialog`):** má-li zvyk podcviky, místo jednoho čísla se zobrazí seznam podcviků — fajfka (toggle 0/target) u targetu 1, stepper + fajfka u vyšších. Denní hodnota zvyku = **počet splněných podcviků** (jde stejným pipeline: upsert `habit_progress` → `current_value` → `recomputeProgress` → příp. ruleta). Doporučení: u zvyku s podcviky nastavit target = počet podcviků. Záhlaví dialogu ukazuje „Target: N sub-exercises" a u snowballu řádek „Snowball: +X every Y days".
5. **Indikace:** v History tabulce má snowball zvyk u targetu ikonku TrendingUp.
6. **`shared/schema.ts`:** `Habit` rozšířen o snowball pole; nové typy `HabitSubitem`, `HabitSubitemProgress`.
**Pozn.:** rychlé plnění na dashboardu (`TodayHabits`) u zvyků s podcviky dál zapisuje jen hlavní hodnotu (podcviky se plní v dialogu dne na Habits stránce) — případné rozšíření na dashboard je drobnost do některé další session.
**Ověřeno:** SQL spuštěno a schéma potvrzeno v DB (18 sloupců); `tsc --noEmit` bez chyb; dev server (Vite) po reloadu renderuje login bez chyb v server logu i konzoli. Funkční scénář (snowball zvyk po N dnech/“Increase now" zvýší target; podcviky jdou vyplnit jednotlivě a den se zapíše jako počet splněných) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S13 — (DB) Shluky zvyků AND/OR + eskalace
**Soubory:** `shared/schema.ts`, habit-form/habits-page, navazuje na S12
**DB:** model shluku (skupina podcviků s podmínkami OR/AND, eskalace v čase).
**Pokrývá body:** splnění shluku přes OR (5 kliků NEBO 5 dřepů), postupné přidávání cviků, kombinace 1×AND + 1×OR.
**Ověření:** shluk se vyhodnotí podle OR/AND; po čase se nabídne eskalace.

✅ **Hotovo (2026-06-12)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S13_subitem_groups_escalation.sql` — `habit_subitems.or_group` (integer) + `habits.escalation_days` (integer) a `habits.last_escalation_at` (date); všechny 3 sloupce ověřeny dotazem do `information_schema.columns` přímo po spuštění.
1. **Model shluků (`src/lib/habit-clusters.ts`):** podcvik má volitelné číslo **OR skupiny** (`or_group`); podcviky se stejným číslem tvoří shluk, ze kterého stačí splnit **jeden** (5 kliků NEBO 5 dřepů); podcviky bez skupiny jsou povinné samostatně (**AND**). Denní hodnota zvyku = počet splněných **jednotek** (jednotka = samostatný AND podcvik nebo celá OR skupina) → kombinace „1×AND + 1×OR" je prostě 1 řádek AND + 2 řádky ve skupině OR 1, target zvyku = 2. Helpery: `buildUnits`, `isUnitDone`, `countDoneUnits`, `escalationDue`, `snoozeEscalation`.
2. **`habit-form.tsx`:** u každého podcviku nový selektor **AND / OR 1 / OR 2 / OR 3** (ukládá se při insert/update, načítá při editaci); popisek pod seznamem vysvětluje vyhodnocení a doporučený target. Nové pole **„Offer escalation every (days)"** (NumberStepper, 0 = vypnuto) — při zapnutí se kotva (`last_escalation_at`) nastaví na dnešek. **Přidání nového podcviku ve chvíli splatné eskalace automaticky restartuje interval** (přidání cviku = provedená eskalace). Při splatné eskalaci se ve formuláři zobrazí oranžový banner s tlačítkem „Later" (odložení = restart intervalu).
3. **`habits-page.tsx` (`EditProgressDialog`):** podcviky se zobrazují po jednotkách — AND řádky samostatně, OR skupina v čárkovaném rámečku „OR group — complete any one" (zezelená po splnění libovolného člena). Hlavička „Target: N items" a počítadlo „Completed: X / N items" počítají jednotky (ne syrové podcviky). Při splatné eskalaci banner „Time to escalate…" s tlačítky **Later** (snooze) a **Escalate (edit habit)** (zavře dialog a otevře editaci zvyku). Eskalace je lazy (kontrola při otevření, žádný cron), vzor snowball z S12.
4. **`shared/schema.ts`:** `HabitSubitem.or_group`, `Habit.escalation_days` + `Habit.last_escalation_at`.
**Ověřeno:** SQL spuštěno a 3 sloupce potvrzeny v DB; `tsc --noEmit` bez chyb; dev server (Vite) renderuje login bez chyb v konzoli i server logu. Funkční scénář (zvyk s podcviky: 1×AND + 2×„OR 1" → den splněn při AND + libovolném z OR; po `escalation_days` dnech se v dialogu dne / editaci nabídne eskalace; „Later" odloží, přidání cviku restartuje interval) je za přihlášením + Supabase daty — k ručnímu doověření majitelem.

### S14 — (DB nebo compute) Celkový progres + upevnění zvyku (21 dní)
**Soubory:** `src/lib/progress.ts` (z S5), dashboard, habits-page
**Pokrývá body:** celkový progres napříč; „zvyk upevněn" po 21 dnech v řadě.
**Úkoly:** detekce série (streak) z `habit_progress`; indikátor upevnění; agregovaný progres. (Možná bez DB, jen výpočet.)
**Ověření:** 21 dní v řadě → zvyk označen jako upevněný; celkový progres sedí.

✅ **Hotovo (2026-06-12)** — **BEZ SQL** (čistý výpočet z existujících `habit_progress` řádků). Nový `src/lib/streaks.ts` + úpravy `src/pages/habits-page.tsx`, `src/pages/home-page.tsx`:
1. **`src/lib/streaks.ts`:** `CONSOLIDATION_DAYS = 21`; `computeStreak(habit, valuesByDate)` — počet po sobě jdoucích dní (konče dneškem; nedokončený dnešek sérii nepřeruší, jen se zatím nepočítá — začíná se od včerejška), kdy denní hodnota ≥ aktuální `target_value` (guard: target ≤ 0 → bere se 1); `isConsolidated(streak)` = streak ≥ 21. Tvrdý strop 3650 iterací. Streak je po dnech dle zadání („21 dní v řadě") — u weekly/monthly zvyků tedy upevnění prakticky nenastane, počítá se s daily.
2. **`habits-page.tsx` (History tabulka):** vedle názvu zvyku inline indikátor — **plamínek (Flame, oranžový) + počet dní** při běžící sérii, **medaile (Medal, zlatá) + počet** při upevnění (≥ 21); plný popis v `title` tooltipu. Záměrně jedna řádka (jako ikona poznámky z S10), aby se nerozhodilo zarovnání řádků levého a pravého sloupce.
3. **`home-page.tsx` (dashboard):** nová karta **„Overall Progress"** nahoře (pod demo bannerem) — progress bar + velké % = **průměr progress všech snů**; pod tím „Average across N dreams" a řádek s medailí „**X of Y habits consolidated (21+ days in a row)**" (stejný filtr zvyků jako na habits-page — zvyky s neexistujícím cílem se nepočítají). Přidány queries `habits` + `habit_progress_all` (jen `habit_id, date, value`).
**Ověřeno:** `tsc --noEmit` bez chyb; dev server (Vite) po HMR bez chyb v server logu, app se renderuje čistě (login). Funkční scénář (zvyk se sérií ukáže plamínek + počet; po 21 dnech v řadě medaili a započítá se do „consolidated" na dashboardu; celkový progres = průměr snů) je za přihlášením + Supabase daty — k ručnímu doověření majitelem.

### S15 — (DB) Kalendář + export do Google/Apple
**Soubory:** nová stránka kalendáře + route, `shared/schema.ts`
**DB:** tabulka `events`.
**Pokrývá body:** podstránka kalendáře (à la Google) s plány; tlačítko pro export události do Google/Apple kalendáře (nejjednodušší: generování `.ics`).
**Ověření:** událost jde vytvořit, zobrazit v kalendáři a vyexportovat (.ics / Google).

✅ **Hotovo (2026-06-12)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S15_events.sql` — tabulka `public.events` (id, user_id, title, description, date, start_time, end_time, created_at; `start_time` null = celodenní), index `(user_id, date)`, RLS „Users manage own events". Schéma ověřeno dotazem do `information_schema.columns` přímo po spuštění (8 sloupců přesně dle návrhu).
1. **`shared/schema.ts`:** nový typ `CalendarEvent`.
2. **`src/lib/ics.ts`:** export helpery — `buildIcs`/`downloadIcs` (RFC 5545 VCALENDAR, escaping, CRLF; celodenní `VALUE=DATE` s exkluzivním koncem, časované jako floating local time; chybějící konec = start + 1 h) a `googleCalendarUrl` (předvyplněný odkaz `calendar.google.com/render?action=TEMPLATE`).
3. **`src/pages/calendar-page.tsx`:** nová stránka — měsíční mřížka à la Google (pondělí první, 6 řádků, sousední měsíce ztlumené, dnešek zvýrazněný kroužkem; na desktopu až 2 chipy událostí + „+N more", na mobilu tečky), navigace ←/→/Today, klik na den vybere den a dole zobrazí seznam událostí. Dialog Nová/Editace události: titulek, datum, přepínač All-day, start/end čas, popis; validace (titulek, datum, čas u nečasované). U každé události tlačítka: **Google** (otevře předvyplněný Google Calendar), **.ics** (stáhne soubor pro Apple/Outlook), Edit, Delete; nahoře **„Export all"** (.ics se všemi událostmi).
4. **Route + navigace:** `/calendar` v `App.tsx`, položka „Calendar" (CalendarDays) v desktop sidebaru i mobilní spodní liště (`main-layout.tsx`).
**Ověřeno:** SQL spuštěno a schéma potvrzeno v DB; `tsc --noEmit` bez chyb; dev server (Vite) renderuje login bez chyb v konzoli i server logu. Funkční scénář (vytvořit událost → vidět ji v mřížce + v seznamu dne → stáhnout .ics / otevřít Google odkaz) je za přihlášením + Supabase daty — k ručnímu doověření majitelem dle kroků výše.

### S16 — (DB/infra) Push notifikace + čas u zvyku + obsah z snu
**Soubory:** service worker (PWA), `shared/schema.ts`, habit-form, Supabase Edge Function/cron
**DB/infra:** nastavení notifikací u zvyku (`notify bool`, `notify_time`), tabulka push subscriptions; web push (PWA) + odesílání přes Edge Function. (Nativně později přes Capacitor.)
**Pokrývá body:** notifikace do telefonu; u zvyku zapnutí + čas; notifikace ukáže obrázek snu + pozitivní i negativní motivaci.
**Ověření:** ve zvolený čas přijde push s obrázkem snu a motivací.

✅ **Hotovo (2026-06-12)** — **SQL + Edge Function + secrets + cron NASAZENO** (Claude přes Chrome extension přímo v Supabase dashboardu, projekt Dream Tracker):
1. **DB (`supabase/sql/S16_push_notifications.sql`, část A):** `habits.notify` (boolean, default false), `habits.notify_time` (time), `habits.last_notified_date` (date — dedup max 1 push/zvyk/den); nová tabulka `push_subscriptions` (user_id, endpoint **unique**, p256dh, auth) + index + RLS „Users manage own push subscriptions". Ověřeno dotazem do `information_schema.columns` (9 sloupců přesně dle návrhu).
2. **Edge Function `send-habit-notifications`** (`supabase/functions/send-habit-notifications/index.ts`, nasazena přes dashboard editor; návod v `supabase/functions/README.md`): běží každých 5 min přes **pg_cron + pg_net** (část B SQL — job `send-habit-notifications` aktivní). Vybere zvyky s notify=true, jejichž `notify_time` (Europe/Prague, env `NOTIFY_TZ`) právě uplynul (catch-up okno 90 min, dedup `last_notified_date`), dohledá zvyk → cíl → **sen** a pošle web push: titulek ⏰ + jméno zvyku, tělo ✨ pozitivní + ⚠️ negativní motivace (ze snu, fallback na motivace zvyku), velký obrázek = obrázek snu. Mrtvé subscriptions (404/410) maže. **Test: ruční POST vrátil 200 `{"sent":0,"checked":0}`.** Secrets nastaveny: `VAPID_KEYS` (vygenerováno `scripts/generate-vapid-keys.mjs`; lokální záloha `supabase/vapid-keys.secret.txt` je gitignored), `CONTACT_EMAIL`.
3. **Klient (PWA + push):** `public/sw.js` (push → showNotification s obrázkem; klik → otevře app), `public/manifest.webmanifest` + ikona `public/icons/icon-512.png` + meta/odkazy v `index.html` (kvůli iOS „Přidat na plochu"); `src/lib/push.ts` — `registerServiceWorker()` při startu (main.tsx) a `ensurePushSubscription()` (permission → subscribe s `VITE_VAPID_PUBLIC_KEY` → upsert do `push_subscriptions` dle endpointu). Public klíč přidán do `.env.local`.
4. **habit-form:** nový blok **„Reminder notification"** — checkbox + pole času (default 08:00, skryté při vypnutí). Zaškrtnutí rovnou subscribuje tento prohlížeč (gesto uživatele → permission prompt; toasty pro denied/unsupported/error). Uložení zapisuje `notify`/`notify_time`; změna času nebo (re)zapnutí nuluje `last_notified_date`, aby pozdější čas tentýž den ještě vystřelil.
5. **`shared/schema.ts`:** `Habit.notify/notify_time/last_notified_date` + nový typ `PushSubscriptionRow`.
6. **Bonus oprava `tsconfig.json`:** `include`/`paths` ukazovaly na neexistující `client/src` → `tsc` dosud nekontroloval nic ze `src/`. Opraveno na `src/**` — celý projekt nyní prochází strict checkem bez chyb.
**Zbývá ručně (1 krok):** přidat `VITE_VAPID_PUBLIC_KEY` (hodnota v `.env.local`) do Vercel → Environment Variables a redeploynout; bez toho se produkční web neumí subscribnout (lokálně funguje). Pak na telefonu: Android Chrome rovnou / iPhone nejdřív „Přidat na plochu" → otevřít zvyk → zapnout Reminder + čas → povolit notifikace.
**Ověřeno:** `tsc --noEmit` (nově celý `src/`) bez chyb; dev server — SW zaregistrovaný a aktivní, `manifest.webmanifest` i `sw.js` 200, konzole bez chyb; Edge Function odpovídá 200; cron job aktivní (`select jobname, schedule, active from cron.job`). Doručení reálného pushe ve zvolený čas je k doověření majitelem na telefonu dle kroků výše.

### S17 — (native) Widget na plochu telefonu
**Soubory:** Capacitor projekt + nativní Android widget
**Pokrývá body:** vyplnění zvyků z plochy bez otevření aplikace.
**Ověření:** widget na ploše umožní zapsat splnění zvyku.

✅ **Hotovo (2026-06-12)** — **SQL APLIKOVÁNO** (Claude přes Chrome extension přímo v Supabase SQL editoru, projekt Dream Tracker): `supabase/sql/S17_widget.sql` — tabulka `widget_tokens` (user_id PK → auth.users, token unique, RLS „Users manage own widget tokens") + dvě SECURITY DEFINER RPC funkce volatelné s anon klíčem: `widget_get_today(p_token)` (dnešní zvyky: id, name, target, unit, value, done; „dnešek" v Europe/Prague) a `widget_complete_habit(p_token, p_habit_id)` (nastaví dnešek na target: upsert `habit_progress` + update `habits.current_value` — stejný zápis jako „✓" v TodayHabits). Ověřeno reálným REST voláním: bogus token → 403 `{"code":"28000","message":"invalid widget token"}` (= funkce nasazené a anon je smí volat).
1. **Capacitor projekt (v6 — záměrně, sedí na JDK 17 + Android SDK platform 34 nainstalované na stroji; v7 chce Javu 21):** `capacitor.config.ts` (appId `com.dreamtracker.app`, webDir `dist`), `android/` vygenerován přes `npx cap add android`, web se bunduje do APK (žádná závislost na Vercel deploy). Závislosti: `@capacitor/core+android+preferences` + dev `@capacitor/cli`.
2. **JS most `src/lib/widget-sync.ts`:** po loginu na nativní platformě zajistí widget token (select/insert do `widget_tokens`, 32 náhodných bytů hex) a zapíše `{url, anonKey, token}` do Capacitor Preferences (SharedPreferences `CapacitorStorage`, klíč `widget_cfg`), odkud ho čte nativní widget. Navíc volá `recomputeProgress` — zápisy z widgetu se tak promítnou do goals/dreams při každém otevření appky. Logout config maže (widget pak ukazuje „přihlas se"). Zapojeno v `use-auth.tsx` (useEffect na user.id + logout onSuccess); v prohlížeči je vše no-op. `shared/schema.ts`: nový typ `WidgetToken`.
3. **Nativní widget (Java, `android/.../widget/`):** `HabitsWidgetProvider` (AppWidgetProvider) + `HabitsWidgetService` (RemoteViewsFactory; HTTP synchronně na binder threadu) + `WidgetApi` (čtení configu + PostgREST RPC přes HttpURLConnection) + layouty `widget_habits`/`widget_habit_item`, drawables (tmavé zaoblené pozadí, fialový kroužek / zelené ✓), `xml/widget_info.xml`, registrace v manifestu. Widget = ListView dnešních zvyků (název + „hodnota / target jednotka"), **tap na kroužek = splnit zvyk bez otevření appky** (broadcast → goAsync vlákno → `widget_complete_habit` → refresh listu), ⟳ = ruční refresh, tap na titulek/prázdný stav otevře appku, auto-update à 30 min. Pozn.: u zvyků s podcviky/snowball zapíše hlavní hodnotu = target (stejné chování jako rychlé „✓" na dashboardu).
4. **APK zbuildováno:** `android/app/build/outputs/apk/debug/app-debug.apk` (4,4 MB; gradle `assembleDebug` BUILD SUCCESSFUL, 108 tasků). Rebuild po změnách webu: `npm run build; npx cap sync android; cd android; .\gradlew.bat assembleDebug` (env: `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `JAVA_HOME=C:\Program Files\Microsoft\jdk-17`; `android/local.properties` s sdk.dir je vytvořen, gitignored).
**Ověřeno:** `tsc --noEmit` bez chyb; web dev server renderuje login čistě (konzole bez chyb — widget kód je v prohlížeči neaktivní); gradle build prošel; SQL aplikováno a obě RPC otestovány přes REST. **Instalace na telefon (ruční krok majitele):** přenést `app-debug.apk` do telefonu → povolit instalaci z neznámých zdrojů → nainstalovat → otevřít „Dream Tracker" a přihlásit se (tím se widgetu předá token) → dlouhý stisk na ploše → Widgety → Dream Tracker → přidat. Pak tap na kroužek u zvyku zapíše splnění dneška rovnou z plochy; ověř v appce/na webu, že se den zapsal a po otevření appky se přepočítá progres cíle/snu.

### S20 — (native) Notifikace v mobilní appce
**Soubory:** `src/lib/local-notifications.ts` (nový), `src/components/habits/habit-form.tsx`, `src/pages/habits-page.tsx`, `@capacitor/local-notifications`
**Pokrývá bod:** v Android appce (Capacitor WebView) šlo zapnutí připomínky do erroru „Subscription failed".
**Příčina:** web push (`src/lib/push.ts`) v Android WebView nefunguje — není push service, takže `pushManager.subscribe()` hodí výjimku. Web push v prohlížeči (S16) funguje dál beze změny.
**Řešení:** v nativní appce se místo web pushe plánují **lokální notifikace** na zařízení (`@capacitor/local-notifications`), bez Firebase.

✅ **Hotovo (2026-07-10)**:
1. **`src/lib/local-notifications.ts`:** `isNativeApp()` (Capacitor.isNativePlatform), `ensureNotificationPermission()` (Android 13+ POST_NOTIFICATIONS), `scheduleHabitReminder(habit)` (denní notifikace v `notify_time`, `schedule.on {hour,minute}` + `allowWhileIdle`, id = habit.id, tělo = ✨ pozitivní / ⚠️ negativní motivace), `cancelHabitReminder(id)`, `syncHabitReminders(habits)` (sladí naplánované s habity, které chtějí připomínku). V prohlížeči vše no-op.
2. **`habit-form.tsx`:** toggle „Reminder" v nativní appce žádá OS permission (místo web push); `createHabit.onSuccess` naplánuje/zruší připomínku dle `notify`/`notify_time`; `deleteHabit.onSuccess` ji zruší.
3. **`habits-page.tsx`:** `useEffect` volá `syncHabitReminders(habits)` při načtení (pokryje reinstalaci a úpravy z jiných zařízení).
4. **APK rebuildováno** (`gradlew assembleDebug`, plugin `@capacitor/local-notifications@6.1.3` zkompilován, manifest má POST_NOTIFICATIONS + RECEIVE_BOOT_COMPLETED) a zkopírováno do `public/DreamTracker.apk` — servíruje se přes tlačítko stažení.
5. **Oprava přesnosti (2. iterace):** notifikace nevystřelila včas, protože bez exact-alarm permission plugin (`setExactIfPossible`, LocalNotificationManager.java:380) na Androidu 12+ padá na `setAndAllowWhileIdle` = nepřesný alarm, který Doze odkládá. Do `android/app/src/main/AndroidManifest.xml` přidány `USE_EXACT_ALARM` (auto-granted, sideload APK mimo Play) + `SCHEDULE_EXACT_ALARM` (maxSdkVersion 32) → `canScheduleExactAlarms()` = true → `setExactAndAllowWhileIdle` střílí přesně na minutu. APK znovu rebuildováno.
**Ověřeno:** `tsc && vite build` bez chyb; gradle BUILD SUCCESSFUL; merged manifest obsahuje POST_NOTIFICATIONS + RECEIVE_BOOT_COMPLETED; web dev server renderuje čistě (nativní kód je v prohlížeči no-op). **Ruční krok majitele:** po deployi na Vercel znovu stáhnout a **přeinstalovat** APK (nový plugin je jen v nové APK), pak zvyk → Reminder + čas → povolit notifikace; ověřit, že v daný čas přijde notifikace.

---

## Poznámky k závislostem
- S14 staví na S5 (progres). S13 staví na S12 (snowball/podcviky). S16 a S17 jsou největší a vyžadují infra rozhodnutí (PWA web push vs. nativní Capacitor).
- Pořadí S1–S8 je doporučené (rychlé, vysoký dopad, bez DB), ale sessiony jsou víceméně nezávislé — pořadí lze měnit.
