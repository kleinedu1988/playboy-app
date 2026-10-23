# Návrh: Vlastní malé neuronové sítě (Síť slov v 2.1, Mapa sbírky 2.5)

Stav k 23. 10. 2026 (po vydání 1.0.0). Rozpracování dvou malých sítí, na kterých se uživatel dohodl: **Síť slov**
pro převod české věty v hledání (doplněk 2.1 Chytré hledání II, [NAVRH-HLEDANI.md](NAVRH-HLEDANI.md)) a **Mapa sbírky**
(2.5, autoenkodér nad údaji modelek). Nic z toho není rozhodnuté; po potvrzení se texty z konce dokumentu
přenesou do `ROADMAP.md`. Navazuje na `kontrola_uceni.go`, plánovaný `podobnost.go` (2.2), Kontrolu 2.0
(verze 1.6, [NAVRH-KONTROLA2.md](NAVRH-KONTROLA2.md)) a oddíl 6 v [NAVRH-DOPORUCENI.md](NAVRH-DOPORUCENI.md).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Shrnutí

- **Vlastní sítě, žádná knihovna:** čisté Go (a u Sítě slov i čisté JS pro odhad), bez GPU, bez internetu,
  váhy v desítkách kB, učení v programu za sekundy na pozadí, pevné semínko → stejná data = stejné váhy.
- **Síť slov:** znaková síť nad hašovanými n-gramy (1–4 znaky) se skrytou vrstvou; každému slovu dotazu přiřadí
  pole a kanonickou hodnotu („blondýnky“ → `vlasy:blond`, „Němky“ → `narodnost:Německo`, „devadesátky“ →
  `rok:1990..1999`) i u tvarů, které nikde nejsou zapsané. **Učí se v Go, odhaduje v JS** (váhy ~60 kB),
  < 0,05 ms na slovo. Pravidla z `lib/veta.js` zůstávají pro čísla, rozsahy, rozsah negace a přesné shody;
  síť je **druhá vrstva** pro slova, kterým pravidla nerozumí. Data pro učení vygeneruje program sám
  z hodnot sbírky, vestavěných vzorů skloňování a šablon vět, takže malá sbírka nevadí.
- **Mapa sbírky:** autoenkodér nad údaji modelek (robustní z-skóre postavy z `kontrola_uceni.go`, one-hot
  vlasů, očí, národnosti, kategorie, období, fotografové, masky chybějících údajů). **2-D kód** = mapa ve
  Statistikách (body, barva podle údaje, klik → profil, laso → výběr Statistik), **8-D kód** = podobnost pro
  „Podobné modelky“, **chyba rekonstrukce** = druhý názor pro `ok-neobvykle` bez zdvojení nálezů.
- **Síť jen když vyhraje:** stejné pravidlo jako v 2.3. Síť slov se zapne, jen když na sadě neznámých tvarů
  porazí samotná pravidla; mapa začne PCA (bez sítě) a autoenkodér ji nahradí, jen když lépe zachová sousedy.
- **Bez změny schématu i exportu** (úprava č. 11, export 7): váhy a stav v tabulce `nastaveni`, základní
  váhy Sítě slov v programu (`//go:embed`).
- Pořadí: Síť slov jako kroky 2.1.2–2.1.4 (po kroku Česká věta II), Mapa sbírky 2.5.0–2.5.4. Společné jádro `sit.go`
  vytvoří ta, která přijde první; použije ho i volitelná síť v 2.3 (Mohlo by se ti líbit).

## Výchozí stav v kódu

| Kde | Co dělá | Pro sítě |
|---|---|---|
| `app.go` `GetModelky` → `nactiModelky` → `odpovidaHledani` | Hledání nad všemi modelkami, slova AND, čárka OR, `-`/`!`, `pole:hodnota` | Cíl převodu; síť dodá jen kanonické `pole:hodnota` |
| `app.go` `poleHledani` | Klíče `vlasy, oci, narodnost, kategorie, fotograf, rok, prsa, ochlupeni, tetovani, piercing, jmeno…` | Výstupní pole Sítě slov = podmnožina těchto klíčů |
| `app.go` `parsovatNumerickyFiltr` | `>`, `>=`, `<`, `<=`, `=`, `od..do` | Čísla a rozsahy dál jen pravidly, síť je nedělá |
| `app.go` `zjednodusit`, JS `bezDiakritiky` | Malá písmena bez diakritiky | Normalizace slova před n-gramy; obě strany musí dát stejný text (společné testovací případy) |
| `frontend/src/lib/format.js` `KATEGORIE` + `rozlozitKategorie` | Aliasy kategorií po normalizaci | Zdroj tvarů pro generátor (kategorie) |
| `frontend/src/app/naseptavac.js` | Hodnoty filtrů s počty, zpoždění 120 ms | Síť běží ve stejném okamžiku jako převod věty, ne při každém znaku našeptávače zvlášť |
| plánovaný `frontend/src/lib/veta.js` (2.1, Česká věta I a II) | Normalizace, stemming, slovník ukazatelů a hodnot sbírky, čísla, negace, pravidlo jména, `[{slova, klic, hodnota, negace, zdroj}]` | Síť se zapojí jako nový `zdroj:'sit'` |
| `kontrola_uceni.go` `priznakyModelky`, `robustniOdhad`, `modelPostavy.zSkore` | 7 údajů postavy, medián a σ pod/nad mediánem, z-skóre | Číselné vstupy mapy beze změny |
| `kontrola_uceni.go` `kontrolovatNeobvykle`, `podobnaPotvrzene` | `ok-neobvykle` z Mahalanobisovy vzdálenosti | Druhý názor autoenkodéru se slučuje sem |
| plánovaný `podobnost.go` (2.2) | Gowerova podobnost s důvody | 8-D kód jako doplněk, důvody dál z Gowera |
| `frontend/src/app/statistiky.js` | SVG grafy, `BARVA = '#d81b60'`, `data-tip` + bublina, výběr `filtry` společný všem grafům, seznam modelek vpravo | Mapa = nový graf, laso = nový klíč ve `filtry` |
| `nastaveni.go` `nastaveni` / `ulozitNastaveni` | `nastaveni (klic, hodnota)`, v zálohách, ne v exportu | Váhy obou sítí |

## Společné zásady

- **Síť nikdy nerozhoduje potichu.** Síť slov jen navrhne štítek, který je vidět a jde změnit; mapa jen ukazuje
  a řadí; druhý názor Kontroly jen přidá jistotu nebo slabý nález.
- **Jednoduchý model je měřítko.** Každá síť má srovnání bez sítě (pravidla, PCA, Gower, Mahalanobis) na
  stejných datech a použije se, jen když je průkazně lepší; výsledek srovnání je vidět v ⋯.
- **Deterministické:** vlastní PCG (`math/rand/v2`) s pevným semínkem z názvu a verze sítě, míchání dávek ze
  stejného generátoru, jedno vlákno (pevné pořadí sčítání), výpočet ve `float64`. Bitová shoda platí na
  stejném stroji; mezi architekturami (amd64 / arm64 kvůli slučování násobení a sčítání) jen do 1e-9, proto
  „zlaté“ testy porovnávají s tolerancí a nejpravděpodobnější štítek přesně.
- **Na pozadí a zrušitelně:** učení v gorutině, rozhraní mezitím používá staré váhy nebo zálohu bez sítě.
  V režimu jen pro čtení se učí jen do paměti, nic se nezapisuje.
- **Bez knihoven a bez nových závislostí:** žádné ONNX, cgo, GPU, předtrénované vektory slov ani jazykové modely.
- **Soukromí:** nic po síti, žádná etnicita ve vstupech, hodnocení srdíčky nejsou vstupem mapy (jen barvou).

### Společné jádro `sit.go`

Jeden malý soubor (~250 řádků) pro obě sítě i pro volitelnou síť v 2.3: husté vrstvy, řídký vstup první vrstvy (sčítají se
jen nenulové vstupy), `tanh`, softmax s křížovou entropií, sigmoida, MSE s maskou, Adam (β₁ 0,9, β₂ 0,999,
ε 1e-8), L2, early stopping s návratem nejlepší epochy, inicializace Xavier (husté) a U(−1/E, 1/E) (vnoření),
uložení vah (float32 nebo int8 s měřítkem po řádcích, base64). `sit_test.go`: numerická kontrola gradientu
každé vrstvy, XOR, dvakrát naučit = stejné váhy, uložení a načtení beze změny výstupu.

---

## 1. Síť slov (hledání, doplněk 2.1)

### Co to dá

| Slovo v dotazu | Pravidla Česká věta I–II | Se sítí |
|---|---|---|
| blondýnky, blondýna, blonďaté, plavovlásky | `blondyn` ~ `blond` ✓, `blondat` ✗, `plavovlask` ✗ | `vlasy:blond` (97 %) |
| Němky, Němek, Němkami | jen přes ruční slovník obyvatel | `narodnost:Německo` |
| Kanaďanky, Švédky, Brazilky | jen co je ve slovníku obyvatel | hodnota ze sbírky i bez ručního zápisu |
| devadesátky, devadesátých, sedmdesátkové | regulární výraz na tvary | `rok:1990..1999`, `rok:1970..1979` |
| tetované, tetovaná, potetovaná | `tetovan` ✓, `potetovan` ✗ | `tetovani:ano` |
| oholené, vyholená | `oholen` ✓, `vyholen` ✗ | `ochlupeni:oholene` |
| vyšších, menší, mladší | jen známé tvary | značka „porovnání“ pro pravidlo čísla |
| Freytagem, Freytagovy | předpona ✓ | `fotograf` → hodnota podobností jména ze sbírky |
| Stratten, Pamela | — | `jmeno` → zůstane text (nepřevádí se) |
| blondý (rozepsané slovo) | ✗ | `vlasy:blond` jen jako nabídka |

### Místo v převodu věty

```
dotaz → slova (normalizace, čísla, tečky)                      lib/veta.js
  1. pravidlo jména: celý dotaz = jméno modelky → konec, hledá se doslova
  2. pravidla: čísla a rozsahy, „mezi X a Y“, víceslovné spojení („česká edice“, „playmate roku“), výplň
  3. přesná shoda: slovník ukazatelů + hodnoty sbírky + potvrzená synonyma      zdroj 'slovnik'/'sbirka'
  4. Síť slov pro každé zbylé slovo (s kontextem sousedů)                        zdroj 'sit'
       jistota ≥ 0,85 a odstup ≥ 0,3 → štítek; 0,5–0,85 → nabídka „Myslíš…?“; jinak text
  5. lehký stemming z kroku Česká věta I jako záloha, když síť chybí (učí se, vypnutá) nebo neví
  6. pravidla dosahu: negace na další pojem, porovnání + číslo → pole:>N
→ štítky „Rozumím:“ + kanonický dotaz → dnešní hledání
```

- Síť **nikdy nepřebije** přesnou shodu ani pravidlo; čísla, jednopísmenná a dvoupísmenná slova nedostane.
- Štítky sítě „negace“ a „porovnání“ jen doplní seznam slov, na která pravidla reagují (neznámé tvary
  „vyšších“, „mladších“); dosah negace a směr porovnání určují dál pravidla.
- Ochrana jmen: slovo, které je v indexu jmen sbírky, síť převede jen s jistotou ≥ 0,97; jinak zůstane text.

### Možnosti

| | A: Hašované znakové n-gramy + malý perceptron | B: Znaková konvoluční síť | C: Malá rekurentní síť (GRU) |
|---|---|---|---|
| Jak | n-gramy 1–4 znaků s okraji `^…$`, haš do 2 048 košů, součet vnoření (24) → skrytá 32 `tanh` → softmax přes štítky; kontext = 2 haše souseda vlevo a vpravo s polovinou váhy | vnoření znaků (16), konvoluce šířky 2–4 (3 × 32 filtrů), max-pooling, hustá vrstva | vnoření znaků, GRU 32, poslední stav → softmax |
| Velikost | ~54 000 vah → int8 **~62 kB** | ~25 000 vah → ~100 kB float32 | ~5 000 vah → ~20 kB |
| Odhad na slovo (JS) | ~6 000 operací, **~10–20 µs** | ~60 000, ~0,1 ms | ~12 × 3 × 3 000, ~0,2 ms |
| Učení 40 000 příkladů (Go) | **~3–8 s** (řídký vstup) | ~30–60 s | ~1–2 min (zpětné šíření v čase) |
| Skloňování (předpona + koncovka) | přímo: n-gramy s okraji jsou kmen i koncovka | dobře | dobře, ale potřebuje víc dat |
| Kód Go + JS | nejmenší (~150 + ~60 řádků) | střední | největší, odhad v JS sekvenční |
| Vysvětlitelnost | n-gramy s největším příspěvkem („`^blond`, `ynk`“) | slabá | žádná |
| Determinismus | snadný | snadný | snadný, ale nejvíc operací |

**Doporučení: A.** České tvary se liší kmenem a koncovkou, což n-gramy s okraji zachytí přímo; řídký vstup
dává učení v sekundách a odhad v mikrosekundách, kód je nejmenší v obou jazycích. B a C by se vyplatily
u dlouhých slov nebo pořadí znaků na dálku, což dotazy nemají. Mřížka při ladění: koše 1 024 / 2 048 / 4 096,
vnoření 16 / 24 / 32, skrytá 24 / 32 / 48 – vybere se nejmenší, která splní kritéria.

### Vstup, výstup, velikost

- **Vstup:** slovo po `bezDiakritiky` + malá písmena, n-gramy 1–4 znaků z `^slovo$` (u slova o 10 znacích
  ~42), haš FNV-1a 32 bitů po **kódových bodech** (Go `range` přes runy, JS `codePointAt` a `Math.imul`) modulo
  počet košů; soused vlevo a vpravo: celé slovo a jeho poslední 3 znaky, haš s jinou solí, váha 0,5.
- **Výstup:** jeden softmax přes **štítky = pole:hodnota** (~100, nejvýš 160): vlasy (~7), oči (~6),
  národnost (~35 vestavěných + ze sbírky), kategorie (10 z `KATEGORIE`), desetiletí (50.–20. léta), tetování a
  piercing ano/ne, ochlupení (~4), prsa (~3) a zvláštní třídy `negace`, `porovnani:vic`, `porovnani:mene`,
  `porovnani:po`, `porovnani:pred`, `vypln`, `fotograf`, `jmeno`, `jine`. Jistota pole = součet
  pravděpodobností jeho štítků (pozná se pole i při nejisté hodnotě → štítek s volbou hodnoty).
- **Fotograf a jméno** síť jen pozná; hodnotu fotografa najde podobnost jmen (Jaro–Winkler ≥ 0,9 po odříznutí
  pádových koncovek `-em -a -ovi -ovy -ových`) nad seznamem fotografů sbírky, jméno modelky zůstane textem.
- **Velikost:** 2 048 × 24 + 24 × 32 + 32 × 110 ≈ 54 000 vah; int8 s měřítkem po řádcích ≈ 62 kB, v base64
  ≈ 83 kB (pod limitem 128 kB pro `hledani_*` z 2.0). Shoda int8 s float64: stejný štítek u ≥ 99,5 % slov.

### Kde běží

| | Učení i odhad v JS | **Učení v Go, odhad v JS** | Učení i odhad v Go |
|---|---|---|---|
| Odezva při psaní | bez volání | bez volání | volání Wails při každém stisku |
| Učení | sekundy v okně → Web Worker, horší testy | gorutina na pozadí, `go test` | stejně |
| Data (hodnoty sbírky, `nastaveni`) | přes vazby | přímo | přímo |
| Dvě implementace | ne | jen odhad (~60 řádků JS), hlídá zlatý test | ne |

**Doporučení: učení v Go, odhad v JS.** Převod věty je v JS (`lib/veta.js`) a musí běžet při psaní bez volání
backendu; učení patří tam, kde jsou data, testy a pozadí. Go má odhad také (potřebuje ho na validaci a
vyhodnocení). `testdata/sit-slov-zlate.json` (200 slov: indexy košů, nejlepší 3 štítky, pravděpodobnosti)
vytvoří Go a ověří `frontend/test/sit-slov.test.js` (stejný štítek, rozdíl pravděpodobnosti < 1e-6).

### Data pro učení (generátor `sit_slov_data.go`)

1. **Slovník hodnot:** z kódu (`sit_slov_zaklad.json`, `//go:embed`): ke každé kanonické hodnotě základní tvary
   a typ skloňování – `vlasy:blond`: blond, blondýna, blondýnka, blonďatá, plavovlasá, světlovlasá, blonde;
   `narodnost:Německo`: Němka, německá, Německo, German; `rok:1990..1999`: devadesátky, devadesátá léta,
   devadesátkový, 90s, nineties. K tomu hodnoty sbírky (`VlasyBarva`, `OciBarva`, `Narodnost`, `PrsaTyp`,
   `Ochlupeni` po synonymech z 2.0), aliasy `KATEGORIE` a fotografové z alb.
2. **Vzory skloňování** (~12 vzorů): přídavná jména (mladá: -á -é -ou -ých -ým -ými), ženská podstatná jména
   (žena, -ka: -ky -ek -kám -kách -kami, růže), přechýlení obyvatel (-ka → -ky -ek), zdrobněliny, předpony
   (po-, vy-, ne-). Každý tvar dostane štítek své hodnoty; `ne-` + binární údaj = opačná hodnota.
3. **Šum:** bez diakritiky (vždy), jeden překlep u 10 % (vynechání, prohození, zdvojení), **předpony
   rozepsaných slov** (≥ 4 znaky, váha 0,5) – kvůli odhadu při psaní.
4. **Šablony vět** (~40, „{vlasy} z {období} bez {binarni}“, „{narodnost} vyšší než {cislo}“, „fotil
   {fotograf}“) dávají kontext sousedů; jména modelek a fotografů ze sbírky, ~300 běžných českých slov jako
   `jine`, výplňová slova z kroku Česká věta I jako `vypln`.
5. **Opravy uživatele** („Vždy takto“ z kroku Česká věta II) jako příklady s váhou 3.
6. **Rozdělení:** validace nejsou náhodná slova, ale **celé tvary vynechané z učení** (u 20 % hodnot chybí
   např. všechny tvary 7. pádu) – měří se zobecnění na neznámé tvary, ne paměť. Váhy tříd tak, aby `jine`
   a `jmeno` nepřevážily. Velikost ~30 000–60 000 slov, vše z PCG se semínkem.

### Učení

Inicializace: vnoření U(−1/24, 1/24), husté vrstvy Xavier, semínko z `"sit-slov-v1"`. Adam, lr 0,01 (u vnoření
jen dotčené řádky), dávka 64, L2 1e-5 na husté vrstvy, vyhlazení štítků 0,05, nejvýš 30 epoch, early
stopping podle validační chyby s trpělivostí 3. Po učení **teplotní kalibrace**: jedno číslo T z mřížky
0,5–3 na validaci (očekávaná chyba kalibrace < 5 %), aby práh 0,85 znamenal skutečně ~85 %.

**Základní váhy v programu:** `sit_slov_zaklad.bin` (~62 kB, `//go:embed`) naučené jen z vestavěného slovníku.
Program tak rozumí hned po instalaci a i s prázdnou sbírkou. Vytváří se příkazem `go test -run
TestZakladSiteSlov -update`; test bez `-update` jen ověří, že soubor projde kritérii.

**Učení v programu** vždy startuje ze **základních vah** (ne z minule naučených), takže výsledek je funkcí
jen dat a verze generátoru. Nové štítky (nová národnost) dostanou nové řádky výstupní vrstvy s malými
počátečními vahami.

### Přeučení při změně sbírky a uložení

- **Otisk slovníku** = haš seřazených kanonických hodnot uzavřených polí, fotografů, oprav a verze generátoru;
  **jména modelek se nepočítají** (přibývají denně, síť je k ničemu nepotřebuje – jména řeší pravidlo jména
  a index jmen). Přidání 30 modelek se známými údaji tak nic nespustí.
- Jiný otisk → učení na pozadí 30 s po poslední změně dat; do té doby staré váhy a přesná shoda pro nové
  hodnoty. Pojistka: když nové váhy na vestavěné hodnoticí sadě klesnou o > 2 procentní body proti základním,
  zůstanou staré a ⋯ → Hledání to ukáže.
- `nastaveni`, klíč `hledani_sit_slov`: `{verze, generator, otisk, stitky[], kose, vnoreni, skryta, sul, T,
  vahy (int8 base64), meritka, metriky {presnostVal, neznameTvary}, datum}` ≈ 85 kB. Mimo export, v zálohách.
  Smazání = návrat k základním vahám. Vazba `GetSitSlov()` (čtení) pošle JS štítky a váhy při startu
  a po přeučení.

### Jistota a „Rozumím:“

```
[ blondýnky z devadesátek bez potetování                         × ]
  Rozumím:  [≈ vlasy: blond ▾] [≈ rok: 1990–1999 ▾] [tetování: ne ▾]   · 37 modelek
            Tab převést na dotaz · Ctrl+Enter hledat doslova
```

- Štítek ze sítě má znak **≈** a titulek „odhad podle tvaru slova ‚blondýnky‘ – jistota 96 %“; ostatní štítky
  vypadají jako v kroku Česká věta I. Najetí zvýrazní slovo věty.
- ▾ nabídne **tři nejpravděpodobnější významy** ze softmaxu („vlasy: blond 96 % · kategorie… 2 %“), Odebrat
  a „Vždy takto“ (uloží synonymum → příště přesná shoda bez ≈ a příklad pro učení).
- Nejistý odhad (0,5–0,85) se nepoužije, jen nabídne: „Myslíš: vlasy: blond? Tab“. Rozepsané poslední slovo
  dostane štítek až od 4 znaků a jistoty 0,85.
- ⋯ → Hledání → Síť slov: stav („naučeno 23. 10., 112 hodnot, neznámé tvary 91 %“), Přeučit, Vypnout,
  Zapomenout (zpět na základní váhy).

### Vyhodnocení a testy

- **Hodnoticí sada** `testdata/sit-slov-dotazy.json`, ručně psaná, **ne z generátoru**: 150 dotazů se štítkem
  u každého slova (40 vzhled, 25 národnost, 20 období, 15 kategorie, 15 binární údaje, 15 negace a porovnání,
  20 dotazů se jmény modelek a fotografů); polovina slov v tvarech, které generátor nezná.
- **Kritéria:** (1) známé tvary: pole i hodnota správně u ≥ 97 % obsahových slov; (2) neznámé tvary ≥ 88 %
  a o ≥ 10 procentních bodů lépe než samotný stemming z kroku Česká věta I – **jinak se síť nezapne**; (3) štítky použité
  bez dotazu (jistota ≥ 0,85) správně u ≥ 98 %; (4) 0 převedených jmen ze sady 20 jmen; (5) 50 vět z kroku Česká věta II
  se sítí ≥ 47 přesně a žádná, která prošla bez sítě, neselže; (6) odhad v JS < 0,05 ms na slovo (medián),
  < 1 ms na celou větu; (7) učení < 10 s pro sbírku 5 000 modelek (přeskočí se s `-short`).
- **Jednotkové testy:** generátor je deterministický a pokryje každý vzor; haš Go = JS (zlatý soubor);
  int8 vs float64 shoda ≥ 99,5 %; zahození vah při jiné verzi; nová národnost ve sbírce → po přeučení
  „Brazilky“ → `narodnost:Brazílie`; ochrana jmen (modelka „Kristina Blond“ celým jménem se nepřevede).

### Rizika

- **Síť se naučí generátor, ne češtinu:** hodnoticí sada je ruční a obsahuje tvary mimo generátor; opravy
  uživatele se stávají daty.
- **Přehnaná jistota u cizích slov a jmen:** kalibrace, třídy `jine`/`jmeno`, práh 0,97 pro slova z indexu jmen.
- **Rozchod Go a JS** (normalizace, haš): zlatý test a společné případy normalizace z 2.0.
- **Kolize hašů:** 2 048 košů na ~15 000 n-gramů; mřížka velikosti v testech, 4 096 košů jen když to pomůže.
- **Neprůhlednost** proti zásadě chytrého hledání: síť je jen druhá vrstva, každý štítek má ≈, jistotu a alternativy.

**Pracnost:** L celkem (rozdělené do tří kroků, viz Cesta vývoje). **Schéma/export:** beze změny.

---

## 2. Mapa sbírky (2.5)

### Co to dá

- Celá sbírka jako body na ploše: blízko = podobné údaje. Na první pohled období a „typy“ (drobné modelky
  60. let, vyšší blond 90. let, online kategorie po roce 2005), díry ve sbírce a neobvyklé modelky.
- Barva podle údaje (období, vlasy, národnost, kategorie, srdíčka, úplnost údajů), najetí = bublina, klik =
  profil, laso = výběr, který zúží ostatní grafy Statistik a seznam vpravo.
- 8-D kód pro „Podobné modelky“ i u neúplných údajů; chyba rekonstrukce jako druhý názor Kontroly.

### Možnosti

| | A: PCA nad stejnými příznaky | B: MDS nad Gowerovou vzdáleností | C: t-SNE / UMAP-like | D: **Autoenkodér** |
|---|---|---|---|---|
| Jak | 2 hlavní komponenty (mocninná metoda), chybějící = 0 po standardizaci | klasické MDS z matice n × n (landmark MDS pro velké n) | sousedské pravděpodobnosti, gradientní sestup | kodér d → 16 → 2, dekodér zpět, maska chyb |
| Smíšené typy a chybějící údaje | špatně (chybějící = průměr táhne do středu) | dobře (Gower je vynechá) | podle vzdálenosti | dobře (maska, učení s vynecháváním) |
| Nelinearita (období × postava) | ne | částečně | ano, nejlepší shluky | ano |
| Nová modelka | promítne se hned | přepočet nebo odhad | **přepočet celé mapy** | **kodér ji umístí hned** |
| Stabilita mezi dny | dobrá (znaménka os ošetřit) | dobrá | špatná (mapa „přeskakuje“) | dobrá s teplým startem a Procrustem |
| Výkon 5 000 | ms | n² = 25 mil. vzdáleností, ~200 MB → jen landmark | O(n²) nebo Barnes–Hut, složité | sekundy učení, µs na modelku |
| Chyba rekonstrukce, embedding | jen lineární | ne | ne | ano, obojí |
| Náročnost | S | M | L | M–L |
| Determinismus | úplný | úplný | jen se semínkem, citlivý | se semínkem |

**Kdy se síť vyplatí (upřímně):** při 400 modelkách a ~15 skutečných rozměrech dá PCA mapu podobnou
autoenkodéru – hlavně osu období a osu velikosti postavy. Autoenkodér má smysl kvůli (1) smíšeným a chybějícím
údajům (starší modelky mají málo měr), (2) okamžitému umístění nové modelky bez přepočtu, (3) jednomu modelu
pro mapu, podobnost i chybu rekonstrukce. **Doporučení:** nejdřív PCA (2.5.0) jako hotová mapa a měřítko,
autoenkodér (2.5.1) ji nahradí, jen když zachová sousedy o ≥ 0,05 lépe (viz Testy). t-SNE ne (nestabilní,
bez umístění nových bodů), MDS ne (nic nepřidá proti PCA nad Gowerem, při 5 000 drahé).

### Příznaky (`priznakyMapy(m, stat) (x, maska []float64)`, d ≈ 90)

| Skupina | Zdroj | Kódování | Počet | Váha ve ztrátě |
|---|---|---|---|---|
| Postava | `priznakyModelky` + `modelPostavy.zSkore` | z oříznuté na ±3, děleno 3; chybí = 0 | 7 | 3 (celkem) |
| Masky postavy | `ma[j]` | 1 = chybí (jen vstup, ne cíl) | 7 | – |
| Vlasy, oči | po synonymech z 2.0 | one-hot, hodnoty s ≥ 3 modelkami + „jiné“, chybí = samé nuly | ~8 + ~6 | 2, 1 |
| Národnost | `Narodnost` | one-hot 12 nejčastějších + „jiná“ | 13 | 1 |
| Období | rok `prvniVydani` | desetiletí one-hot + (rok − 1990)/20 | ~9 | 2 |
| Kategorie | `Role` + odvozené (jako `kategorieModelky`) | multi-hot | ~8 | 1,5 |
| Fotografové | `fotografoveAlb` po `zjednodusit` | multi-hot, ≥ 3 modelky, nejvýš 20 | ≤ 20 | 1,5 |
| Prsa, ochlupení, tetování, piercing | `PrsaTyp`, `Ochlupeni`, ±1/0 | one-hot / ±1 | ~9 | 0,5 |

Váhy skupin odpovídají vahám Gowerovy podobnosti v `podobnost.go`, takže mapa a „Podobné modelky“ mluví
o stejné podobnosti. Etnicita, jméno, poznámka a srdíčka nejsou vstupem. Definice příznaků má haš; při jiném
haši (nová barva vlasů) se váhy rozšíří (nové vstupy s nulovými vahami), ne zahodí.

### Architektura a učení

- **Dvě malé sítě se společným kódem:** mapa d → 16 → **2** → 16 → d (~3 000 vah) a kód podobnosti
  d → 32 → **8** → 32 → d (~6 300 vah; pod 1 000 modelek skrytá 16, ~3 100 vah). Skrytá `tanh`, kód lineární.
  Jedna síť s oběma kódy by 8-D vrstvu nenutila nést víc než 2-D – dvě sítě jsou jednodušší a testovatelné zvlášť.
- **Ztráta po skupinách:** MSE u postavy a období, softmax s křížovou entropií u one-hot skupin, sigmoida u
  multi-hot; počítá se **jen u vyplněných údajů**, vážená podle tabulky.
- **Učení s vynecháváním (denoising):** v každé epoše se 15 % vyplněných skupin na vstupu skryje (nuly + maska),
  cíl zůstane. Síť se tak naučí odhadnout údaj z ostatních – základ chyby rekonstrukce i podobnosti
  neúplných modelek. Modelky s údajem dál než 3,5 σ se do učení nepočítají (jako v `naucitPostavu`).
- Xavier, semínko z `"mapa-v1"`, Adam lr 0,005, dávka 32, L2 1e-4, studený start nejvýš 400 epoch, teplý 40,
  early stopping na 15 % (záhyb podle `id`), trpělivost 25.

### Stabilita mapy

1. **Pevné semínko:** stejná data a studený start = stejná mapa.
2. **Nová modelka hned:** kodér ji umístí bez učení (µs) – desítky denně přidaných modelek se na mapě objeví
   okamžitě a ostatní body se nehnou.
3. **Teplý start:** přeučení z uložených vah (40 epoch), jen když od minula přibylo ≥ 5 % modelek nebo se
   změnila definice příznaků, nejvýš jednou denně, na pozadí při otevření mapy.
4. **Procrustes:** nové souřadnice se zarovnají na staré (společné modelky podle `id`): posun, měřítko, otočení
   i zrcadlení v uzavřeném tvaru pro 2-D. Při prvním učení pevná orientace: starší období vlevo, vyšší postava
   nahoře (znaménka podle korelace).
5. **Měřítko obrazu:** 1.–99. percentil na ±1, aby jedna odlehlá modelka nesmrštila mapu.
6. **Míra posunu:** medián posunu starých bodů v % průměru mapy, ukázaný pod mapou; cíl < 3 % po přidání 30
   modelek. „Přepočítat od začátku“ = studený start (deterministický z dat).

Cena: s teplým startem závisí mapa i na minulém stavu – deterministická je vzhledem k (uloženým vahám, datům),
studený start vzhledem k datům samotným. Obojí se testuje.

### Výkon 400 → 5 000

| Část | 400 modelek | 5 000 modelek |
|---|---|---|
| Příznaky (Go) | < 2 ms | < 20 ms |
| PCA (Go) | < 1 ms | < 10 ms |
| Učení obou sítí, studený start | ~1–2 s | ~8–15 s |
| Učení, teplý start | ~0,2 s | ~1–3 s |
| Umístění modelek kodérem | < 1 ms | < 5 ms |
| Kresba (JS) | SVG, < 20 ms | nad 2 000 bodů canvas a mřížka košů pro najetí, < 50 ms |
| Laso (bod v mnohoúhelníku) | < 1 ms | < 5 ms |

### Podobné modelky (vztah k 2.2)

- Výchozí řazení zůstává **Gower z `podobnost.go`** (vysvětlitelné, důvody z příspěvků skupin).
- 8-D kód (kosinová podobnost) slouží (1) jako „Sousedé na mapě“ v bublině a profilu, (2) jako doplněk pro
  modelky s < 4 vyplněnými údaji, kde Gower říká „málo údajů“, (3) volitelně jako směs 0,7 Gower + 0,3 kód,
  jen když u 10 ručně vybraných modelek označí uživatel víc smysluplných z prvních 5 než u samotného Gowera.
  Důvody se vždy berou z Gowera.

### Druhý názor Kontroly (`ok-neobvykle` bez zdvojení)

**Skóre:** pro každý vyplněný údaj postavy se údaj skryje a síť ho odhadne z ostatních údajů, období a kategorie;
e = Σ (x̂ⱼ − xⱼ)² v z-skóre, převedeno na robustní z vůči celé sbírce (medián, MAD). Vysoké = „neobvyklé na
svou dobu a typ“; zároveň dává očekávanou hodnotu („čekal bych pas 58–64 cm“).

| Mahalanobis (`kontrolovatNeobvykle`) | Autoenkodér | Výsledek |
|---|---|---|
| nad mezí | vysoké | **jeden** nález `ok-neobvykle`, jistota (1.6) vyšší: „obě metody souhlasí“ |
| nad mezí | nízké | nález jako dnes |
| pod mezí | vysoké (z > 4 a nejvýš 0,5 % sbírky) | **slabý** nález `ok-neobvykle` (za odkazem „zobrazit i slabé“ z 1.6) s textem „neobvyklé na svou dobu a typ“ |
| pod mezí | nízké | nic |

- Jedna modelka = nejvýš jeden nález `ok-neobvykle`; `postavaMimoRozsahy` a `podobnaPotvrzene` platí pro oba
  zdroje; „V pořádku“ (stejný klíč) potvrdí oba. **Žádný nový klíč `ok-…`.**
- Pamatování nálezů z 1.6 si zapíše zdroj (`mahalanobis`/`sit`/`obe`); když mají nálezy jen ze sítě po
  ≥ 10 rozhodnutích přesnost < 30 %, přestanou se ukazovat (souhlas „obě metody“ zůstává).
- Bez 1.6 (jistota, slabé nálezy) se použije jen první řádek tabulky.

### UI

```
Statistiky   [ Mapa sbírky ▾ ]   Barva: [ Období ▾ ]   412 modelek · ⓘ Jak číst mapu
┌─────────────────────────────────────────────────────┐ ┌ Modelky výběru (23) ───┐
│              ·  ·· ·              ○ ○○              │ │ Jana Ukázková · 1976   │
│        ·· ·:·::·  ·  ·          ○○○○ ○             │ │ Eva Příkladná · 1979   │
│     · ·:::·::·:·  ·              ○○ ○  ◌            │ │ …                      │
│   ·  ·::·:·· ·      ╭ ─ ─ ─ ╮     ○                 │ │ Zobrazit všech 23      │
│        · ·          ╰ ─ laso ╯         ◉ ← vybraná  │ │                        │
└─────────────────────────────────────────────────────┘ └────────────────────────┘
 ■ 50. ■ 60. ■ 70. ■ 80. ■ 90. ■ 00. ■ 10.  ◌ málo údajů   (klik na legendu = výběr)
 Naučeno 23. 10. · autoenkodér (sousedé 0,61 vs PCA 0,52) · posun proti minule 1,8 % · Přepočítat od začátku
```

- Nový graf ve skupině „Rozložení“ v `GRAFY`; volba barvy jako ostatní volby grafu (pamatuje se v `localStorage`).
- Bublina (`data-tip`): jméno, rok, 3 hlavní údaje, „sousedé: X, Y“. Klik → `otevritDetailModelky`. Tažení =
  laso; výsledek je nový klíč `mapa` ve `filtry` („Výběr na mapě: 23 modelek“), takže zúží ostatní grafy a
  seznam vpravo; „Otevřít v galerii“ je u lasa nedostupné (množinu id dotaz neumí) s titulkem proč. Esc zruší.
- Výběr z jiných grafů: na mapě jasně body výběru, tlumeně ostatní – stejně jako dnešní grafy.
- V profilu „Na mapě →“ otevře mapu se zvýrazněnou modelkou a jejími sousedy.
- „Jak číst mapu“: osy nemají jednotky ani význam, blízko = podobné údaje, vzdálené shluky nejsou o nic „dál“
  než sousední; žádná čísla na osách, žádná mřížka.
- Klávesnice a přístupnost: seznam vpravo je textová obdoba, šipky v něm zvýrazní bod; Tab na graf, Enter otevře.

**Pravidla kresby (souladně s dnešními grafy):** tmavé pozadí, body r = 3 (nad 2 000 r = 2), průhlednost 0,75,
obrys při najetí; **akcent `#d81b60` jen pro výběr a zvýrazněnou modelku** (ne jako barva kategorie), ostatní
při výběru šedě tlumené. Období: sekvenční škála jednoho odstínu (starší tmavší, novější světlejší),
kategorické barvy nejvýš 6 + šedá „ostatní“, u vlasů přirozené odstíny (blond žlutá, hnědá hnědá, zrzavá
oranžová, černá světle šedá s obrysem – na tmavém pozadí by zmizela); srdíčka sekvenčně; chybějící údaj =
dutý kroužek. Barvy ověřit na barvoslepost (stačí rozlišení jasem). Animace přesunu po přeučení 300 ms,
při `prefers-reduced-motion` žádná.

### Uložení a vazby

| Co | Kde |
|---|---|
| `nastaveni` `mapa_sbirky` | `{verze, definice (haš příznaků), seminko, sit2, sit8 (float32 base64), procrustes {R, s, t}, metriky {sousede, sousedePCA, posun}, model:"pca"|"sit", datum}` ≈ 50 kB |
| `GetMapaSbirky() MapaSbirky` | čtení (`CTENI`): `[{id, x, y, chyba}]`, model, metriky, stav učení |
| `PrepocitatMapu(odZacatku bool) bool` | zápis **bez ohlášení změny dat** (vzor z 2.0) |

Souřadnice se neukládají – vždy se spočítají kodérem z uložených vah a transformace. Mimo export, v zálohách.

### Testy (`mapa_test.go`, `frontend/test/mapa.test.js`)

- **Umělá sbírka se třemi zasazenými skupinami** (1960 drobné tmavé, 1990 vyšší blond, 2010 online kategorie,
  pevné semínko): skupiny jdou od sebe (silueta ≥ 0,5) u PCA i sítě.
- **Zachování sousedů:** podíl 10 nejbližších na mapě, kteří jsou i mezi 10 nejbližšími podle Gowera;
  síť nahradí PCA, jen když je o ≥ 0,05 lepší na umělé i skutečné sbírce.
- **Chybějící údaje:** dvě modelky se stejnými vyplněnými údaji a jinou maskou jsou na mapě blízko (< 5 %
  průměru mapy) – mapa nesmí třídit podle úplnosti.
- **Stabilita:** přidání 30 modelek + teplý start → medián posunu < 3 %; Procrustes vrátí otočenou a zrcadlenou
  kopii přesně (< 1e-9); studený start dvakrát = stejné souřadnice.
- **Druhý názor:** 20 zasazených chyb (prohozený pas a boky, palce místo cm, překlep číslice) mezi 400
  modelkami – kombinace najde při stejném počtu nálezů o ≥ 10 % víc chyb než Mahalanobis sám, jinak se
  slabé nálezy ze sítě nevydají; žádná modelka nemá dva nálezy `ok-neobvykle`.
- **Výkon:** studený start 5 000 modelek < 20 s, teplý < 3 s (přeskočí se s `-short`); JS kresba a laso
  podle tabulky výkonu.

### Rizika

- **Přeučení na 400 modelkách:** malé sítě, L2, vynechávání, early stopping, srovnání s PCA.
- **Přehnaný výklad mapy** („tahle je nejvzdálenější = nejhorší“): text „Jak číst mapu“, žádné osy.
- **Mapa podle úplnosti údajů:** maska jen jako vstup, ztráta jen z vyplněných, test výše, barva „úplnost“.
- **Skákání mapy:** kodér pro nové, teplý start, Procrustes, měřená míra posunu.
- **Zdvojení nálezů v Kontrole:** jeden klíč, slučovací tabulka, přesnost podle zdroje.

**Pracnost:** L celkem (pět kroků). **Schéma/export:** beze změny.

---

## Uložení a vazby (souhrn, bez změny schématu)

| Klíč v `nastaveni` | Obsah | Velikost |
|---|---|---|
| `hledani_sit_slov` | váhy Sítě slov (int8), štítky, otisk slovníku, metriky | ~85 kB |
| `mapa_sbirky` | váhy obou autoenkodérů, Procrustes, metriky, zvolený model | ~50 kB |

Základní váhy Sítě slov `sit_slov_zaklad.bin` (~62 kB) v programu. `TestZmrazeniAlfy` se nemění: úprava
schématu č. 11, export verze 7; export neobsahuje nic ze sítí.

## Nedělat

- Knihovny strojového učení, ONNX, cgo, GPU, předtrénované vektory slov, jazykový model (API i místní).
- Síť jako jediný převod věty nebo bez srovnání s pravidly; síť pro čísla, rozsahy a dosah negace.
- Síť nad obsahem fotek; srdíčka nebo etnicitu jako vstup mapy; t-SNE (nestabilní mapa).
- Nové klíče `ok-…`, ukládání souřadnic mapy do dat modelek, množinu id v dotazu hledání.

---

## Cesta vývoje

Každá verze je malá (1–3 dny, 2–4 kroky), projde všemi testy a jde vyzkoušet sama; každý krok vyjde jako PATCH.

### a) Síť slov v 2.1 – Chytré hledání II (po kroku Česká věta II)

Kroky jdou hned za kroky Česká věta I (2.1.0) a II (2.1.1), Synonyma II se posunou na 2.1.5; potřebují hotový
`lib/veta.js`, slovník ze sbírky a sadu 50 vět jako měřítko. Kdyby ROADMAP řadil kroky 2.1 jinak, posunou se
jen čísla PATCH – jediná tvrdá závislost je Česká věta II.

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 2.1.2 | Síť slov I – jádro a měření: `sit.go` (pokud ještě není), `sit_slov.go` (n-gramy, haš, odhad, učení, kalibrace), generátor dat, `sit_slov_zaklad.bin`, ruční sada 150 dotazů; srovnání se stemmingem v testu (bez UI) | M–L | 2.1.1 (Česká věta II) | ne |
| 2.1.3 | Síť slov II – v hledání: odhad v JS (`lib/sit-slov.js`), zlatý test Go = JS, zapojení do `veta.js` jako `zdroj:'sit'`, prahy, ochrana jmen, štítky ≈ s jistotou a třemi významy, nabídka „Myslíš…?“ | M | 2.1.2 | ne |
| 2.1.4 | Síť slov III – učení v programu: otisk slovníku, přeučení na pozadí po změně hodnot, opravy „Vždy takto“ jako příklady, pojistka proti zhoršení, `hledani_sit_slov`, ⋯ → Hledání → Síť slov (stav, Přeučit, Vypnout, Zapomenout) | M | 2.1.3 | ne |

Krok 2.1.3 se vydá, jen když 2.1.2 ukáže na neznámých tvarech zisk ≥ 10 procentních bodů proti stemmingu;
jinak se síť odloží a 2.1 je hotová bez ní.

**Hotovo, když (Síť slov):** na ručních 150 dotazech ≥ 97 % známých a ≥ 88 % neznámých tvarů správně, použité
štítky správně u ≥ 98 %, žádné jméno se nepřevede; 50 vět z kroku Česká věta II se sítí ≥ 47 přesně; odhad < 0,05 ms na
slovo v JS; přeučení < 10 s na pozadí a nová národnost ve sbírce se po něm pozná ve skloňovaném tvaru; stejná
data dají stejné váhy; schéma ani export se nemění.

### b) 2.5 – Mapa sbírky

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 2.5.0 | Mapa PCA: `mapa.go` (`priznakyMapy` sdílené s `podobnost.go`, PCA mocninnou metodou, pevná orientace), `GetMapaSbirky`; graf „Mapa sbírky“ ve Statistikách (SVG, barva podle období/vlasů/národnosti/kategorie/srdíček/úplnosti, bublina, klik → profil), „Jak číst mapu“ | M–L | 2.2 (`podobnost.go`) | ne |
| 2.5.1 | Autoenkodér: `sit.go` (pokud ještě není), dvě sítě 2-D a 8-D s maskou a vynecháváním, učení na pozadí, pevné semínko, `mapa_sbirky`; zachování sousedů síť vs PCA, použije se lepší; stav v pruhu pod mapou | M–L | 2.5.0 | ne |
| 2.5.2 | Stabilita: nové modelky kodérem hned, teplý start při +5 % nebo nové definici, Procrustes, míra posunu, „Přepočítat od začátku“, animace přesunu | M | 2.5.1 | ne |
| 2.5.3 | Výběr na mapě: laso jako klíč `mapa` ve výběru Statistik, legenda jako výběr, tlumení podle výběru jiných grafů, „Na mapě →“ v profilu, canvas nad 2 000 bodů | M | 2.5.0 | ne |
| 2.5.4 | Podobnost a druhý názor: „Sousedé na mapě“ z 8-D kódu, doplněk Gowera pro neúplné modelky (směs jen když vyhraje), chyba rekonstrukce do `ok-neobvykle` podle slučovací tabulky, zdroj nálezu v pamatování 1.6 | M | 2.5.1, 1.6 (jistota, slabé nálezy) | ne |

Když 2.5.1 ukáže, že síť PCA nepřekoná, mapa zůstane na PCA, 2.5.2 se zjednoduší na pevnou orientaci
a 2.5.4 se odloží.

**Hotovo, když (2.5):** mapa 400 modelek se ukáže do 100 ms a zasazené skupiny umělé sbírky jsou oddělené;
autoenkodér se používá jen při zisku ≥ 0,05 v zachování sousedů proti PCA; po přidání 30 modelek se staré body
posunou o < 3 %; klik otevře profil a laso zúží ostatní grafy; žádná modelka nemá dva nálezy `ok-neobvykle`;
stejná data a studený start dají stejnou mapu; 5 000 modelek: učení < 20 s na pozadí, kresba < 50 ms;
schéma a export se nemění; uživatel vyzkoušel mapu na skutečné sbírce.

### K vložení do ROADMAP.md

Do tabulky kroků v oddílu 2.1 – Chytré hledání II (za Česká věta II, před Synonyma II, která se posunou na #6)
a místo odstavce „Doplněno (říjen 2026)“; rozsah verzí v úvodu oddílu upravit na „(2.1.0–2.1.5)“:

```markdown
| 3 | Síť slov I – jádro a měření | Malá znaková síť v čistém Go (hašované n-gramy 1–4 znaků, skrytá vrstva 32, softmax přes `pole:hodnota`), data generovaná z hodnot sbírky, vzorů skloňování a šablon vět, základní váhy v programu (~60 kB); ruční sada 150 dotazů, srovnání se stemmingem | M–L |
| 4 | Síť slov II – v hledání | Odhad v JS (< 0,05 ms na slovo) jako druhá vrstva `veta.js` po pravidlech a přesné shodě; štítek „≈“ s jistotou a třemi významy, pod prahem jen „Myslíš…?“, jména se nepřevádí; zlatý test Go = JS | M |
| 5 | Síť slov III – učení v programu | Přeučení na pozadí po změně hodnot sbírky (ne po nových jménech), opravy „Vždy takto“ jako příklady, pojistka proti zhoršení, váhy v `nastaveni`, ⋯ → Hledání → Síť slov | M |

**Doplněno (říjen 2026):** malá znaková neuronová síť pro slova, kterým pravidla nerozumí (pozná pole a hodnotu
i u neznámých tvarů: „blondýnky“ → vlasy:blond, „Němky“ → národnost, „devadesátky“ → rok:1990..1999). Pravidla
dál řeší čísla, rozsahy a negaci; síť se zapne, jen když na neznámých tvarech porazí stemming o ≥ 10 bodů.
Rozbor v [NAVRH-SITE.md](docs/NAVRH-SITE.md).
```

Doplnění „Hotovo, když“ v 2.1:

```markdown
Síť slov (kroky 3–5): z ručních 150 dotazů ≥ 88 % neznámých tvarů správně, použité štítky správně u ≥ 98 %,
50 vět ≥ 47 přesně, stejná data dají stejné váhy.
```

Řádek do tabulky verzí v „Po 1.0.0“ (náhrada stávajícího):

```markdown
| 2.5 | Mapa sbírky – malá neuronová síť (autoenkodér) nad údaji: mapa modelek ve Statistikách, sousedé a podobnost, druhý názor Kontroly | 2.2 (1.6 pro krok 5) |
```

Oddíl (za 2.4):

```markdown
### 2.5 – Mapa sbírky

**Cíl:** celá sbírka jako mapa – blízko jsou modelky s podobnými údaji, vidět jsou období, „typy“ a neobvyklé
modelky. Body s barvou podle údaje, bublina, klik otevře profil, laso zúží ostatní grafy Statistik. Z téže malé
sítě podobnost pro „Podobné modelky“ i u neúplných údajů a druhý názor pro kontrolu neobvyklých kombinací.
Vše v čistém Go, bez knihoven, učení na pozadí za sekundy s pevným semínkem. **Bez změny schématu i exportu** –
váhy v `nastaveni`. Každý krok vyjde jako samostatná verze (2.5.0–2.5.4). Rozbor možností:
[NAVRH-SITE.md](docs/NAVRH-SITE.md).

**Rozhodnutí:** nejdřív PCA jako hotová mapa a měřítko; autoenkodér (2-D kód pro mapu, 8-D pro podobnost,
maska chybějících údajů, učení s vynecháváním) ji nahradí, jen když lépe zachová sousedy; t-SNE ne (mapa by
přeskakovala). Nové modelky umístí kodér hned, přeučení s teplým startem a zarovnáním (Procrustes) nejvýš
denně. Podobnost dál vysvětluje Gower z `podobnost.go`; chyba rekonstrukce se slučuje do `ok-neobvykle`.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Mapa PCA | `mapa.go`: příznaky (z-skóre postavy z `kontrola_uceni.go`, one-hot vlasů, očí, národnosti, kategorie, období, fotografové, masky), PCA s pevnou orientací, `GetMapaSbirky`; graf „Mapa sbírky“ ve Statistikách s barvou podle údaje, bublinou, klikem na profil a „Jak číst mapu“ | M–L |
| 2 | Autoenkodér | Společné jádro `sit.go` (Adam, L2, early stopping, pevné semínko), sítě s 2-D a 8-D kódem, ztráta jen z vyplněných údajů, učení na pozadí, váhy (~50 kB) v `nastaveni`; použije se, jen když zachová sousedy o ≥ 0,05 lépe než PCA | M–L |
| 3 | Stabilita | Nové modelky kodérem hned, teplý start při +5 % modelek, zarovnání Procrustem, míra posunu pod mapou, „Přepočítat od začátku“ | M |
| 4 | Výběr na mapě | Laso jako výběr Statistik (zúží grafy a seznam), legenda jako výběr, „Na mapě →“ v profilu, canvas nad 2 000 bodů | M |
| 5 | Podobnost a druhý názor | „Sousedé na mapě“, 8-D kód jako doplněk Gowera u neúplných modelek; chyba rekonstrukce: souhlas zvýší jistotu `ok-neobvykle`, sama jen slabý nález, nikdy dva nálezy u jedné modelky | M |

**Nedělá se:** t-SNE, srdíčka nebo etnicita jako vstup, nové klíče `ok-…`, knihovny strojového učení, obsah fotek.

**Hotovo, když:** mapa 400 modelek se ukáže do 100 ms a zasazené skupiny umělé sbírky jsou oddělené; síť se
používá jen při průkazně lepším zachování sousedů než PCA; po přidání 30 modelek se staré body posunou o < 3 %;
žádná modelka nemá dva nálezy `ok-neobvykle`; stejná data dají stejnou mapu; 5 000 modelek: učení < 20 s na
pozadí, kresba < 50 ms; schéma zůstává na úpravě č. 11 a export na verzi 7.
```
