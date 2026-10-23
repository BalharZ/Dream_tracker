# Northstar — design system

Jedno místo pravdy pro vzhled aplikace. Nové obrazovky a komponenty se drží těchto pravidel; když je potřeba něco nového, přidá se sem i do tokenů.

## Kde co žije
| Co | Soubor |
|----|--------|
| Barvy, radius (CSS proměnné / tokeny) | `src/index.css` (`:root`) |
| Napojení tokenů na Tailwind (`bg-gold`, `shadow-card`, `font-display`…) | `tailwind.config.ts` |
| Písmo (Plus Jakarta Sans, Google Fonts) | `index.html` |
| Základní komponenty (Button, Card, Dialog, Input…) | `src/components/ui/` |
| Rozvržení (sidebar, horní lišta, spodní navigace) | `src/components/layouts/main-layout.tsx` |

## Paleta (podle ikony)
| Token | Použití |
|-------|---------|
| `primary` — noční navy | hlavní tlačítka, aktivní stavy, text nadpisů |
| `gold` — severka | úspěch/odměna, aktivní položka menu, prstence pokroku, štítek „Achieved" |
| `sky` — stopa k hvězdě | doplňkové akcenty, grafy |
| `success` / `destructive` | splněno / smazat, chyba |
| `muted`, `secondary`, `accent` | plochy, hover, sekundární text |

Barvy se v kódu píšou **jen přes tokeny** (`bg-primary`, `text-gold`…), ne natvrdo (`bg-yellow-400`, `#FFD666`). Výjimka: grafy/SVG, kde je potřeba hodnota — tam `hsl(var(--gold))`.

## Tvary a hloubka
- Radius: karty a dialogy `rounded-2xl`, tlačítka a pole `rounded-xl`, štítky `rounded-full`.
- Stín: karty `shadow-card` (jemný), dialogy `shadow-elevated`.
- Písmo: vše Plus Jakarta Sans; nadpisy `h1–h3` mají automaticky `font-display tracking-tight`.

## Dialogy (pravidla)
Všechny dialogy jdou přes `DialogContent` z `src/components/ui/dialog.tsx`:
- **Křížek vždy vpravo nahoře**, nikdy se neposune mimo obrazovku (rám dialogu je max. výška obrazovky, posouvá se jen tělo).
- **Obsah se dá vždy scrollovat** — dialogům se nepřidává vlastní `max-h-*` ani `overflow-y-auto`.
- **Tlačítko Zpět** (Android / prohlížeč) zavře horní dialog místo opuštění stránky.
- `className` = rám (šířka `max-w-*`, výška, barvy), `bodyClassName` = tělo (padding, layout). Vlastní hlavička s pevnou lištou: `bodyClassName="flex h-full flex-col gap-0 overflow-hidden p-0"` a scrollovací `div` uvnitř (viz `habit-stats.tsx`).
- Bez křížku (animace, které se nesmí přerušit): `hideClose` / `DialogContentNoClose`.

## Tlačítka
`default` (navy) = hlavní akce na obrazovce, max. jedna. `gold` = oslavná/odměnová akce. `outline`/`ghost` = vedlejší. `destructive` = mazání.

## Mobil
- Obsah má boční okraj 16 px (`p-4`), od `sm` 24 px.
- Spodní navigace: aktivní položka má zlatou „pilulku" za ikonou.
- Vodorovně posuvné řady (karty snů) používají `-mx-4 px-4` + `snap-x`.
