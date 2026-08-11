# Naming – nápady a rozhodování

Status: **nerozhodnuto** (2026-08-11). Aktuální název zůstává „Dream Tracker".

## Proč měnit
„Dream Tracker" je zavádějící – „dream" si spousta lidí spojí se sny ze spánku.
Appka přitom proměňuje velké životní sny/cíle v každodenní návyky.

## Kandidáti

| Název | Poznámka |
|-------|----------|
| **Vision Tracker** | Původní návrh. Jasné, ale trochu generické/korporátní. |
| **Northstar** | Vodící hvězda – návyky míří k velkému cíli. Krátké, aspirativní, žádná spánková asociace. Můj tip. |
| **Momentum** | Každodenní malé kroky, co ženou k cíli. Energické, jedno slovo. |
| **Horizon** | Kam směřuješ. |

Vyřazeno (2026-08-11): ~~Summit~~, ~~Ascend~~.

## ASO / klíčové slovo v názvu (k rozhodnutí)

Otázka: má název obsahovat klíčové slovo, aby to lidi našli ve store?

Důležité rozlišení:
- **Název na ploše telefonu** (`app_name` v `strings.xml`) je **nezávislý** na názvu v obchodě.
- **Název listingu v Google Play** (max 30 znaků) je samostatné pole a Google ho silně
  indexuje pro vyhledávání.

Takže jde mít obojí: krátký brand na ikoně + keyword-rich titul ve store.
Např. na ploše `Northstar`, v Play `Northstar: Goals & Habits` nebo
`Northstar – Cíle a návyky`.

**ALE:** appka teď na Google Play **není** – distribuuje se jako vlastní APK přes
tlačítko „Download latest app". Dokud je to takhle, klíčové slovo v názvu pro
hledání **nic neřeší** (nikdo to ve store nehledá). ASO má smysl řešit až/pokud
půjdeme na Google Play.

Pokud na Play půjdeme:
- Cílíš CZ nebo global? CZ keywords („Cíle", „Návyky") vs. EN („Goals", „Habits").
- Silný signál je keyword v titulu + v krátkém a dlouhém popisu.

## Až padne rozhodnutí – co přejmenovat
- `android/app/src/main/res/values/strings.xml` → `app_name`, `title_activity_main`, `widget_empty`
- `capacitor.config.ts` → `appName`
- Ikona (viz níže) + případně splash
- Texty notifikací / onboardingu, kde padá „Dream Tracker"
