# Northstar — monetizace (Free / Pro)

> Rozhodnuto s majitelem 2026-10-30. Tento soubor je zdroj pravdy pro placenou verzi.
> **Postup práce:** úkoly jsou rozdělené do sessionů v `SESSIONS.md` (sekce „Monetizace a vyladění“).
> Majitel řekne „udělej S5x“, Claude odpracuje jednu session, odškrtne ji a skončí.

## 1. Rozhodnutí

- **Model:** hybrid. Free + Pro Lifetime (bez AI) + předplatné Pro + AI + AI add-on pro majitele Lifetime.
- **Trh:** první verze anglicky, překlady později.
- **Pořadí:**
  1. Vyladit aplikaci a rozdělit Free/Pro s testovacím přepínačem.
  2. Chat s tutoriálem (bez AI).
  3. Napojit AI (klíče dodá majitel).
  4. Platební brána.
  5. Bezpečnostní audit.
- **Žádná AI zdarma**, ani kredity. Free uživatel vidí jen video ukázku AI kouče v chatu.
- **Lifetime nikdy neobsahuje AI.** AI stojí peníze každý měsíc.
- **Vlastní garance vrácení peněz nebude.** Platí jen standard Google Play: žádost do 48 h přes Play,
  potom podle uvážení. Free verze slouží jako zkouška. V Terms uvést, že po využití AI se nevrací.
- **Limit Free 3 sny / 5 zvyků zůstává.** Pro má táhnout hloubka a hodnota, ne škrcení základu.

### Free vs Pro

| Oblast | Free | Pro |
|---|---|---|
| Sny / zvyky | 3 sny, 5 zvyků | neomezeně |
| Archiv zvyků | ✅ | ✅ |
| Týdenní zvyky (N× týdně) | ✅ | ✅ |
| Připomínky | základní + název a množství + záchrana série | motivační a chytré (víc denně, adaptivní čas, týdenní souhrn) |
| Stats | **Síla zvyku** + série; v tabulce historie 3 měsíce | celé Stats + neomezená historie + odhad dosažení cíle |
| Obrázky | vlastní upload / odkaz | AI generování, témata, ikony |
| Sync | ✅ | ✅ |
| Export | surový JSON (schovaný, GDPR) | Excel / PDF / automatická záloha / obnova |
| Chat | tutoriál (scénář bez AI) + video ukázka AI | AI kouč s měsíčním limitem |

## 2. Ceny a náklady

### Ceny (návrh)

| Plán | Cena | Obsah |
|---|---|---|
| Pro Lifetime | ceník $149, launch $99 | vše Pro bez AI |
| Pro + AI | $7.99 / měsíc, $59.99 / rok (7denní trial jen u roku) | vše Pro + AI |
| AI add-on (jen pro majitele Lifetime) | $4.99 / měsíc | AI kouč + AI obrázky |

### Co z ceny zbude

Ceny v EU jsou včetně DPH, kterou za nás odvádí Google (CZ 21 %). Google si bere 15 %.
Z každého dolaru zbude **≈ $0.70**.

| Plán | Uživatel platí | Nám zbude | AI náklad (max. při limitech) | Marže |
|---|---|---|---|---|
| Pro + AI měsíc | $7.99 | $5.61 | $1.10 | **$4.51 / měs.** |
| Pro + AI rok | $59.99 | $42.14 (= $3.51/měs.) | $1.10/měs. | **$2.41 / měs.** |
| AI add-on | $4.99 | $3.51 | $1.10 | **$2.41 / měs.** |
| Lifetime | $99 jednou | $69.55 jednou | $0 (bez AI) | ~$69 jednou |

**Jak vznikl AI náklad $1.10 / uživatel / měsíc (limity v kapitole 6 a 8):**
- Chat: 150 zpráv na Claude Haiku 5.5 ($0.10 / $0.50 za 1M tokenů), ~6 000 tokenů kontextu + 500 odpověď → **$0.13**
- Týdenní reflexe: 4× Sonnet 5.5 ($2 / $10), ~10 000 + 1 500 tokenů → **$0.14**
- Obrázky: 20 × ~$0.04 (Nano Banana) → **$0.80**. Při OpenAI medium ~$0.05 → $1.06.

**Proč stačí tak málo, když majitel platí za Clauda $25–30:** při programování se točí miliony tokenů
na nejsilnějším modelu. Kouč posílá krátké zprávy na Haiku, který je zhruba 40× levnější na token.
Bez limitů by to ale neplatilo, proto je limit povinný a vynucuje ho server.

### Fixní měsíční náklady

| Položka | Cena |
|---|---|
| Supabase Pro (DB, auth, storage 100 GB, Edge Functions; Free tier se uspává a má jen 1 GB storage) | $25 / měs. |
| Vercel Pro (Hobby zakazuje komerční použití) | $20 / měs. |
| Doména | ~$1 / měs. |
| RevenueCat | $0 do $2 500 měsíčních tržeb, pak 1 % |
| Google Play developer účet | $25 jednou |
| Dobití API (Anthropic min. ~$5, Google, OpenAI) | předplacené, čerpá se podle použití |
| **Celkem fixně** | **≈ $46 / měs.** |

**Bod zvratu:** ~10 předplatitelů Pro + AI měsíčně, nebo jeden Lifetime za 1,5 měsíce.

## 3. Síla zvyku (Free) — vzorec

Nahradí binární „upevnění po 21 dnech“ (`src/lib/streaks.ts`).
„21 dní“ je mýtus (Maltz, 60. léta). Lally et al. (2010): medián **66 dní**, rozpětí 18–254 dní.

Počítá se jen v plánovaných opakováních. Denně = každý den. „N× týdně“ = N opakování za týden.
Výpadky se u týdenních zvyků počítají až po skončení týdne.

- Splnění: `S ← S + (1 − S) · (1 − e^(−g/55))`, `g` = dní na jedno opakování (denně 1, 3× týdně 7/3, měsíčně 30)
- Částečné splnění: přírůstek × podíl splnění
- Výpadek: `S ← S · (1 − p)`, `p = min(12 %, 3 % · k) · (1 − 0.6 · S)`, `k` = výpadky za sebou

| Situace | Síla |
|---|---|
| 21 dní | 32 % „Foundation“ |
| 66 dní | 70 % „Automatic“ |
| 90 dní 3× týdně, 3 rozptýlené výpadky | 76 % |
| 180 dní | 96 % |
| 254 dní | 99 % „Unbreakable“ |
| rok denně, pak týden pauza | 73 % |
| rok denně, pak měsíc nic | 7 % |

**Štítky:** 0–24 Seed · 25–49 Forming · 50–69 Building · 70–89 Strong · 90–100 Unbreakable.

## 4. Týdenní zvyky (N× týdně)

- Frekvence: Daily / „N× per week“ (N 1–6) / Monthly. Ukládá se do `habits.frequency` jako `"3x per week"`
  (stejný formát už používají demo data), takže není potřeba měnit DB.
- V tabulce: splněný den v nedokončeném týdnu = barva zvyku na 50 %. Jakmile týden dosáhne N,
  všechny splněné dny toho týdne se přebarví na 100 %.
- Denní odměna (ruleta) běží dál po každém splnění.
- Po splnění N v týdnu: hláška „Week complete! 🎉“. Pokud zvyk nemá týdenní odměnu,
  nabídne „Add a weekly reward“.
- **Týdenní odměny:** v nastavení zvyku jen tehdy, když je frekvence týdenní, tlačítko „Add weekly reward“.
  Uloží se do `rewards.habit_chances` pod klíčem `"w<habitId>"`, takže není potřeba měnit DB.
  Šance si nastaví uživatel.

## 5. Stats paywall

- Síla zvyku zdarma nahoře. Skutečné grafy uživatele jsou pod ní rozmazané, s čitelnými názvy zvyků a nadpisy grafů,
  přes ně zámek a „Unlock Pro“.
- U každého grafu jedna věta, proč je cenný. Teasery „Your weakest day is ■■■■■“ a „Best streak ever: ■■ days“.
- Tabulka zvyků ve Free ukáže 3 měsíce zpět. „Load more history“ dál otevře paywall. Data se nemažou.

## 6. AI kouč (Pro + AI)

- **API:** Claude API na samostatném účtu majitele. Klíč pouze v Supabase Edge Function secrets.
- **Modely:** Haiku 5.5 na chat, Sonnet 5.5 na týdenní reflexi.
- **Umí ovládat aplikaci** přes nástroje: sny, cíle, zvyky (frekvence, snowball, obměny) a odměny.
  Před uložením vždy ukáže návrh k potvrzení.
- **Rozsah:** jen sny, cíle, zvyky, odměny a motivace. Jiná témata slušně odmítne.
- **Limit:** 150 zpráv a 4 reflexe měsíčně, počítadlo viditelné. Vynucuje server.
- **UI:** plovoucí ikona chatu (skrýt / minimalizovat), předvolby „Break down my dream“, „Plan my week“,
  „Why do I keep failing X?“, „What can AI do?“.

## 7. Chat s tutoriálem (Free, bez AI)

Stejná ikona chatu jako AI kouč. Ve Free nabízí:
1. Průvodce prvním nastavením: sen → cíl → první zvyk → odměna. Tlačítka, žádné psaní, nic negeneruje.
2. Odpovědi na „Jak fungují zvyky / sny / odměny / Síla zvyku“.
3. Video ukázku AI kouče a nabídku Pro + AI.

Nic nestojí a dá se použít i jako marketingový záznam.

## 8. AI obrázky (Pro + AI)

- Nano Banana jako hlavní, OpenAI gpt-image-2 jako záloha, když první odmítne. Limit 20/měsíc.
- **Tlačítko Nahlásit:** Google Play ho u generativní AI vyžaduje vždy, i když obrázek vidí jen autor.
  Slouží k nahlášení výstupu, který si uživatel nepřál (urážlivý, nevhodný). Hlášení nám pomáhá ladit filtry.
  Bude jako položka v menu „…“ u obrázku.
- Selfie odchází ke Googlu/OpenAI → musí to být v Privacy Policy. Blokovat generování cizích lidí.

## 9. Nákupy, Restore a databáze

- Po zaplacení pošle RevenueCat webhook do Supabase Edge Function a ta zapíše do tabulky
  `entitlements` (user_id, plan, expires_at). Aplikace čte Pro stav **z databáze podle účtu**.
  Přihlášení na jiném zařízení tedy Pro automaticky ukáže. To už funguje stejně jako ostatní data.
- „Restore Purchases“ je jen záchrana pro případ, kdy nákup v Google Play existuje, ale není spárovaný
  s účtem (koupě před přihlášením, jiný účet). Tlačítko patří do Nastavení → Plán.

## 10. Export

Účet → Data → „Export data“. Free dostane surový JSON (GDPR čl. 20 a čl. 12 odst. 5).
Vedle jsou zašedlé Pro možnosti (Excel, PDF report, automatická záloha, obnova).

## 11. Pokuty (finanční závazek) — výzkum, implementace až po rozhodnutí

**Proč ne přímo kartou:**
- Chargeback je zákonné právo držitele karty. Zakázat ho v podmínkách nejde.
  Podmínky pomohou jen jako důkaz ve sporu, poplatek 990 Kč (Comgate) zaplatíme stejně.
- Kredity, které by si uživatel mohl vybrat zpět na účet, jsou elektronické peníze.
  To vyžaduje licenci ČNB. Nevhodné.

**Doporučená varianta: Commitment Credits přes Google Play:**
1. Uživatel si koupí balíček kreditů jako spotřební nákup v Google Play (např. 500 Kč).
   Spory a karty řeší Google, my nemáme chargebacky ani uložené karty.
2. U zvyku zapne „Commitment“ a nastaví pokutu (např. 100 kreditů).
3. Nesplní zvyk → po 24 h se odečte 100 kreditů. Splní pozdě do 24 h → odečte se jen 30.
4. Kredity jdou použít jen v aplikaci (další závazky, měsíc Pro + AI). Nedají se vybrat → nejde o e-money.
5. Propadlé kredity jsou náš příjem (po DPH a 15 % Googlu).

Před implementací ověřit: Google Play policy, posouzení účetní (DPH), Terms (výslovný souhlas,
měsíční strop, e-mail před každým odečtením). Comgate / Paypercut / Stripe zůstávají jako záloha pro web.

## 12. Ochrana proti klonování

Úplně zabránit se tomu nedá, kód webu běží v prohlížeči. Dá se ale ztížit:
- AI prompty, limity, kontrola Pro a Pro výpočty běží na serveru (Edge Functions + RLS).
- Minifikace a obfuskace buildu, Play Integrity API v nativní appce.
- Ochranná známka „Northstar“ (ověřit kolizi). Hlavní obrana: značka, komunita a data uživatelů.

## 13. Checklist před spuštěním plateb

- [ ] Lifetime nemá přístup k AI (ověřeno na serveru, ne jen v UI)
- [ ] Měsíční limity AI vynucuje Edge Function, otestováno
- [ ] Limit útraty nastavený v Anthropic Console, Google AI Studio a OpenAI
- [ ] AI náklad na uživatele < 30 % čistého příjmu z AI plánu
- [ ] Nákupy otestované s license testery: koupě, zrušení, obnovení, vrácení, upgrade Lifetime → AI add-on
- [ ] Pro stav sedí mezi webem a Androidem, Restore Purchases funguje na druhém zařízení
- [ ] Tlačítko Nahlásit u AI obrázků
- [ ] Privacy Policy + Terms na veřejné URL, vyplněný Data safety formulář v Play Console
- [ ] Surový export dat funguje zdarma
- [ ] Bezpečnostní audit hotový
