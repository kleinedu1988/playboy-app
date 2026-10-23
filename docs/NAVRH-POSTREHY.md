# Návrh: Postřehy ve Statistikách (1.18)

Stav k 23. 10. 2026. Podklad k rozhodnutí; kód se podle něj začne psát až po 1.0.0. Po potvrzení se oddíl
z konce dokumentu přenese do `ROADMAP.md`.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Shrnutí

- **Postřeh** = krátká česká věta o sbírce, kterou program sám najde a která je **statisticky podložená**:
  „Od roku 1995 roste podíl silikonových prsou: z 10 % na 45 % v roce 2005.“, „Výběr má o 4 cm užší pas
  (60 vs 64 cm).“ Ukáže se nejvýš 5 postřehů, klik na postřeh ukáže odpovídající graf.
- Čtyři druhy: **trend** (Mann–Kendall / Cochran–Armitage + Theil–Sen), **zlom** (optimální rozdělení řady
  let s minimální délkou úseku), **výběr proti zbytku sbírky** (Mann–Whitney, Fisher, Benjamini–Hochberg)
  a **neobvyklý rok / souvislost** (robustní odchylka roku, Spearman).
- Doporučení: vše **v JS** v čistém modulu `frontend/src/lib/postrehy.js` nad daty, která Statistiky už mají
  (`vsechnyModelky()`, `GRAFY`, `filtry`); statistické funkce v `frontend/src/lib/statistika.js`. Žádné
  volání backendu, výpočet < 30 ms na 5 000 modelkách, přepočet při každé změně výběru.
- **Bez změny schématu i exportu**, bez nové závislosti, žádná síť. Schéma zůstává na úpravě č. 11, export na verzi 7.
- Cesta: trend → zlomy → výběr proti sbírce → panel s řazením → neobvyklé roky a souvislosti (1.18.0–1.18.4).

## Výchozí stav (co už je)

| Kde | Co dělá | Pro 1.18 |
|---|---|---|
| `frontend/src/app/statistiky.js` `GRAFY` | 22 grafů: počty (`cf`, `prib`), údaje (`vek`, `vyska`, `vaha`, `bmi`, `hrudnik`, `pas`, `boky`, `whr`), podíly (`blond`, `silikon`, `oholene`, `tetovani`, `piercing`), rozložení (`kat`, `nar`, `vlasy`, `oci`, `srd`, `vyskyt`, `fot`) s funkcemi `udaj(m)` / `podil(m)` | **Jediná definice příznaků**: postřehy berou tytéž funkce, nic se nepíše podruhé |
| `radaVCase`, `prvniVyskyt`, `vyskytyModelky` | Každá modelka jednou v roce prvního výskytu podle edice (Vše/US/CZ) a druhu (Vše/Centerfold/Obálka/Pictorial); věk = věk v tom čísle | Trendy a zlomy počítat ze stejných řad, aby věta souhlasila s grafem |
| `rozsahHodnot`, `kvantil`, `median` | Medián a prostřední polovina (IQR) sloupce | Úrovně úseků a hodnoty ve větách |
| `krivka` | Klouzavý průměr ±3 roky (±1 měsíc), u podílu a údaje jen z ≥ 3 modelek | Vizuálně „trend“ už je; chybí rozhodnutí, zda je skutečný |
| `filtry` (Map klíč → `{ test, popis, dotaz, od, do, hodnota }`), `vyhovuje(m, krome)` | Křížový výběr sdílený všemi grafy; graf ukazuje výběr jasně, celou sbírku tlumeně | Výběr pro srovnání = `data.modelky.filter(m => vyhovuje(m))`; testy jsou JS funkce, Go je neumí vyhodnotit |
| `souhrn` | „medián ve výběru **60 cm** (celkem 64 cm) · 212 modelek“ | Dnes bez rozhodnutí, zda je rozdíl skutečný; postřehy to doplní |
| `nastavitRozsah`, klik na pruh | Nastavení podmínky roku a hodnoty rozložení | Klik na postřeh použije tytéž cesty |
| `vyvoj.go` `GetVyvojVCase`, `kvantil` | Vývoj po desetiletích v Go (rozhraní ho už nepoužívá) | Zdroj ověřených kvantilů pro srovnávací test, ne pro výpočet |
| `kontrola_uceni.go` | `kvantilUdaje` (celá čísla jako interval ±0,5), `robustniOdhad` (medián a σ zvlášť pod a nad z kvartilů), Mahalanobis, prahy jako pojmenované konstanty | Vzor robustnosti a stylu parametrů; `kvantilUdaje` převzít do JS pro úzké údaje (pas) |
| `lib/format.js` `sklonovat`, `cislo` v `statistiky.js` | Skloňování, čísla `cs-CZ` | Texty postřehů |
| ROADMAP 1.4, krok 3 | Karta „Rekordy“ (nejmladší, nejvyšší…) | Rekordy jednotlivých modelek tam; postřehy řeší neobvyklé **roky** a skupiny |

## Společné zásady

- **Jen průkazné a podstatné:** postřeh se ukáže, když projde testem (po opravě na mnohonásobné testování)
  **a** zároveň má prakticky podstatnou velikost (např. ≥ 2 cm, ≥ 10 procentních bodů). Raději žádný postřeh než šum.
- **Popis, ne příčina:** věty říkají „mají“, „je víc“, „souvisí“, nikdy „protože“, „kvůli“, „způsobuje“.
- **Stejná čísla jako graf:** hodnoty ve větě jsou mediány a podíly počítané stejně jako v grafu
  (rok prvního výskytu, zvolená edice a druh výskytu, známé údaje).
- **Průhlednost:** každý postřeh má bublinu s podrobnostmi (počty, interval, test) a jde jedním klikem ukázat v grafu.
- **Deterministické:** žádná náhoda za běhu (permutační testy jen v testech s pevným semínkem), stejná data =
  stejné postřehy ve stejném pořadí.

---

## 1. Trendy v čase

**Co to dá:** u grafů v čase program řekne, zda údaj skutečně roste či klesá, kdy se to zlomilo a o kolik –
místo odhadu od oka z klouzavého průměru.

### Možnosti – trend

| | A: Mann–Kendall + Theil–Sen na ročních hodnotách | B: Test na úrovni modelek + Theil–Sen pro velikost | C: Regrese (lineární / logistická) |
|---|---|---|---|
| Jak | Roční mediány nebo podíly (jen roky s ≥ 5 modelkami), MK test a mediánový sklon párů | Kendallovo τ_b mezi rokem a hodnotou přes všechny modelky (údaje), Cochran–Armitage pro podíly; velikost změny Theil–Sen z ročních mediánů nebo z úrovní úseků | Přímka přes modelky, interval spolehlivosti sklonu |
| Statistická správnost | Rok s 3 modelkami váží jako rok se 100; roky nejsou nezávislé (autokorelace) → přehnaná jistota | Váží přirozeně počtem modelek; předpoklad nezávislých modelek je rozumný; robustní vůči odlehlým | Citlivá na odlehlé hodnoty a na tvar (vývoj není přímka) |
| Srozumitelnost | „roste“ | „roste“ | „o 0,3 cm za rok“ – svádí k extrapolaci |
| Výkon | ~70 bodů, zanedbatelné | τ_b přes Fenwickův strom O(n log n), CA O(počet let); < 2 ms na 5 000 | O(n) |
| Náročnost | S | M | S |
| Testovatelnost | Hodnoty z R/SciPy | Hodnoty z R/SciPy (`cor.test(method="kendall")`, `prop.trend.test`) | snadná |

**Doporučení: B.** Test na modelkách rozhoduje, **zda** trend je; velikost a věta se berou z úseků (viz zlomy),
protože vývoj ve sbírce bývá schodovitý, ne lineární. Theil–Sen (z ročních mediánů s n ≥ 5) se použije jen
pro bublinu („asi +1 cm za 10 let“).

### Možnosti – zlomy

| | A: Binární segmentace | B: Optimální rozdělení (PELT / úplné dynamické programování) s pokutou | C: Bayesovské online zlomy |
|---|---|---|---|
| Jak | Najdi nejlepší jeden zlom, opakuj v úsecích, dokud test projde | Minimalizace součtu nákladů úseků + β za každý zlom; minimální délka úseku | Pravděpodobnost zlomu v každém roce |
| Správnost | Hladová, mine blízké zlomy | Přesné optimum; β kalibrovat simulací | Dobrá, ale závisí na volbě priorů |
| Srozumitelnost | Dobrá | Dobrá („od roku 1995“) | Slabá („pravděpodobnost 0,7“) |
| Výkon | O(n log n) | ~70 let → O(n²) ≈ 2 500 úseků, bez prořezávání < 3 ms | O(n²) |
| Náročnost | S–M | M | L |
| Testovatelnost | Dobrá | Dobrá (deterministické, zasazené zlomy) | Horší |

**Doporučení: B** (úplné dynamické programování; PELT prořezávání je při ~70 letech zbytečné).

### Data a algoritmy

1. **Řada:** pro graf `def` a aktuální `edice` / `druhVyskytu` vzít `radaVCase(def)` (stejné položky jako graf),
   zúžené výběrem kromě podmínky roku (`vyhovuje(m, 'rok')`) – stejně jako graf ukazuje výběr.
2. **Podmínky použití:** aspoň 10 let s daty a 60 modelek se známým údajem; roky s < 5 modelkami se do
   ročních mediánů nepočítají (v testu na úrovni modelek ano).
3. **Trend:** údaje – Kendallovo τ_b (rok × hodnota, opravy na shody, normální aproximace); podíly –
   Cochran–Armitage (skóre = rok). Počty (`cf`) se netestují (závisí na tom, co uživatel nasbíral).
4. **Zlomy:** náklad úseku
   - podíl: záporná binomická věrohodnost z počtů ano/celkem (váha podle počtu modelek je v ní),
   - údaj: L1 odchylka od mediánu úseku přes jednotlivé modelky. Údaje jsou celá čísla (cm, kg, roky) nebo
     se zaokrouhlí do přihrádek (BMI 0,1, poměr pas : boky 0,01); kumulativní histogramy po letech → medián
     a náklad úseku v O(počet přihrádek), celkem < 300 000 operací.
   - pokuta β = c · ln(N) (N = modelek se známým údajem), c nakalibrovat simulací bez zlomu tak, aby falešný
     zlom vyšel nejvýš u 5 % řad; min. délka úseku **5 let a 30 modelek**, nejvýš **3 zlomy**.
   - každý nalezený zlom ověřit testem sousedních úseků (Mann–Whitney / Fisher) a zařadit do opravy BH
     (oddíl 2); neprůkazný zlom se zahodí a úseky se sloučí.
5. **Úrovně úseků:** medián úseku (údaj) nebo podíl úseku s intervalem – Wilsonův 95% interval pro podíl,
   interval mediánu z pořadových statistik (binomický, bez předpokladu rozdělení).
6. **Věta** se staví z úseků, ne z jednotlivých let: `Od roku {zlom} {roste/klesá} {co}: z {úroveň před}
   na {úroveň po}`; když je poslední úsek krátký nebo řídký, místo „v roce 2005“ období „v letech 2000–2005“.

### UI

Pod grafem v čase (místo nebo vedle `sp-napoveda`) jeden řádek, v grafu značky:

```
Silikonová prsa                                [Vše][Centerfold][Obálka][Pictorial]  [Vše][US][CZ]
 50 % ┤                                   ┆  ▇ ▇   ▇
      ┤                                   ┆▇ ▇▇▇ ▇ ▇▇  ──── úroveň úseku 45 %
 25 % ┤                                   ┆▇▇▇▇▇▇▇▇▇▇
      ┤ ──── 10 % ───────────────────────── ┆
  0 % ┼────────────────────────────────────┴───────────
       1970        1980        1990     1995    2000   2005
 ↗ Od roku 1995 průkazně roste podíl silikonových prsou: z 10 % na 45 % v letech 2000–2005.  ⓘ
```

- zlom = svislá čárkovaná čára v **barvě textu** (ne akcent), popisek roku nahoře; úroveň úseku = tenká
  vodorovná schodovitá čára přes celý úsek (styl `sp-krivka celek`, aby nesoupeřila se sloupci),
- roky s < 5 modelkami tlumeně (třída `tlum`, už existuje), v bublině sloupce „málo modelek – rok se nehodnotí“,
- ⓘ = bublina: „Úroveň 1970–1994: 10 % (8–13 %, 412 modelek). 2000–2005: 45 % (39–51 %, 260 modelek).
  Test trendu: Cochran–Armitage, p < 0,001. Zlom ověřen Fisherovým testem, po opravě p = 0,002.“

### Rizika

- **Úplnost údajů se mění v čase:** u starých ročníků chybí údaj častěji a jinak (např. silikon se uvádí, jen
  když je známý). Bublina vždy říká „známé u N z M modelek“; když se podíl známých mezi úseky liší o > 30 bodů,
  věta dostane dovětek „(u starších let je údaj známý jen u třetiny modelek)“.
- Podmínka „rok prvního výskytu“: modelka s pozdějším centerfoldem a dřívějším pictorialem patří do dřívějšího
  roku při druhu Vše – věta proto vždy říká druh, když není Vše („podle roku prvního centerfoldu“).
- Kalibrace β na jedné sbírce: simulace musí pokrýt malé (300) i velké (5 000) sbírky.

### Jak otestovat

- Statistické funkce: tabulka vstupů a výsledků spočtených v R/SciPy (`testdata/statistika-pripady.json`)
  s tolerancí 1e-6; čte ji `frontend/test/statistika.test.js`.
- Zasazený zlom: vygenerovaná sbírka (pevné semínko) se skokem podílu 10 % → 45 % v roce 1995 → zlom 1993–1997,
  úrovně ±5 bodů; řada bez změny → 0 zlomů v ≥ 95 % ze 200 simulací.
- Řídká data: 3 modelky v roce 1960 nesmí vytvořit zlom ani rekord.

---

## 2. Výběr proti sbírce

**Co to dá:** po kliknutí na „Češky“ nebo na období 1990–1999 program sám řekne, čím se výběr liší –
„Výběr má o 4 cm užší pas (60 vs 64 cm)“ – a zamlčí rozdíly, které jsou jen náhoda.

### Možnosti

| | A: Klasické testy + BH | B: Permutační testy | C: Bayesovské srovnání |
|---|---|---|---|
| Jak | Mediány: Mann–Whitney (normální aproximace s opravou na shody); podíly: Fisherův přesný test 2×2; kategorie: Fisher jedné hodnoty proti ostatním; Benjamini–Hochberg přes všechny testy výběru | Rozdíl mediánů / podílů proti 1 000 náhodným výběrům stejné velikosti | Aposteriorní pravděpodobnost rozdílu (beta-binomické, bootstrap mediánů) |
| Správnost | Dobrá, bez předpokladu normality; MW testuje posun rozdělení, ne přesně medián | Nejpřesnější pro rozdíl mediánů | Dobrá, ale volba priorů |
| Srozumitelnost | stejná (věta bez čísel testu) | stejná | „na 97 % užší“ – laik snadno přecení |
| Výkon | S předpočítaným pořadím celé sbírky O(n) na příznak: ~20 příznaků × 5 000 < 5 ms | 1 000 × 20 × 5 000 = 10⁸ operací → stovky ms, při každém kliku nepoužitelné | střední |
| Náročnost | M | S–M | L |
| Testovatelnost | Hodnoty z R/SciPy | Jen se semínkem, statisticky | Horší |

**Doporučení: A**, permutační test jen v testech jako kontrola, že MW s opravou na shody dává pro naše
data podobné závěry.

### Data a algoritmy

- **Srovnává se výběr se zbytkem sbírky**, ne s celou sbírkou (výběr je její část, test musí mít nezávislé
  skupiny). Ve větě se ale jako dnes v `souhrn` ukazuje hodnota celé sbírky („60 vs 64 cm“, kde 64 = celá sbírka)
  – je to srozumitelnější a rozdíl celkem/zbytek je u malého výběru zanedbatelný; v bublině obojí.
- **Příznaky:** všechny grafy `udaj` (9) a `podil` (5); z rozložení `kat`, `nar`, `vlasy`, `oci`, `srd`, `vyskyt`
  nejvýš 8 nejčastějších hodnot, každá jako podíl „tato hodnota / ostatní známé“. Celkem ~60 testů.
- **Vynechá se**, co výběr sám určuje: podmínka `vlasy` vyřadí `vlasy` i `blond`, `nar` národnosti, `srd`
  hodnocení atd. (tabulka `VYLOUCENE_PODMINKOU`). Podmínka roku nevyřazuje nic.
- **Minimální velikost:** ve výběru i ve zbytku aspoň 10 modelek se známým údajem; u podílů navíc aspoň
  5 „ano“ v obou skupinách dohromady; výběr menší než 10 modelek → žádné srovnání („Výběr je na postřehy
  příliš malý.“).
- **Předpočet po načtení dat** (jednou, < 20 ms): pro každý číselný příznak pole hodnot, seřazené pořadí
  (průměrné pořadí u shod) a oprava rozptylu na shody přes celou sbírku. Výběr = `Uint8Array` maska;
  součet pořadí výběru dá U ve zbytku přímo (pořadí ve sloučeném vzorku = pořadí v celé sbírce). Medián
  výběru projitím předem seřazeného pole s maskou O(n).
- **Fisher:** hypergeometrické pravděpodobnosti přes tabulku `ln n!` (předpočet do N), oboustranný test.
- **Velikost účinku a práh podstatnosti:**
  - údaj: rozdíl mediánů v jednotkách údaje + Cliffovo δ = 2U/(n₁n₂) − 1 (z U zadarmo); podstatné,
    když |δ| ≥ 0,2 **a** rozdíl mediánů ≥ práh údaje (výška 2 cm, váha 2 kg, obvody 2 cm, věk 1 rok,
    BMI 0,5, poměr pas : boky 0,02),
  - podíl: rozdíl v procentních bodech a Cohenovo h; podstatné, když |rozdíl| ≥ 10 bodů a |h| ≥ 0,2.
- **Mnohonásobné testování:** Benjamini–Hochberg přes všechny testy jednoho vyhodnocení (srovnání výběru,
  trendy a zlomy zobrazeného stavu), hladina q = 0,05. Postřeh = q ≤ 0,05 a podstatný rozdíl.
- **Doba jako zkreslení:** výběr „Češky“ je skoro celý po roce 2011 a liší se hlavně dobou. Volitelně (1.18.4)
  **přímá standardizace podle desetiletí**: očekávaná hodnota = podíl / medián sbírky převážený rozložením
  desetiletí ve výběru; když rozdíl po standardizaci zmizí, postřeh zní „Výběr má víc tetování (48 vs 22 %) –
  odpovídá to době, ze které je“, nebo se nezobrazí. Test po vrstvách: Cochran–Mantel–Haenszel (podíly),
  van Elteren (údaje).

### UI

```
Výběr:  [Národnosti: Česká ×]  [první výskyt 2011 – 2020 ×]  Zrušit výběr
┌ Postřehy ─────────────────────────────────────────────────────────────────┐
│ ≠  Výběr má o 4 cm užší pas (60 vs 64 cm).                              ⓘ │
│ ≠  Ve výběru je víc modelek s tetováním: 48 % (celkem 22 %).            ⓘ │
│ ≠  Výběr je o 3 roky mladší při prvním výskytu (21 vs 24 let).          ⓘ │
└───────────────────────────────────────────────────── 212 modelek ve výběru ┘
```

ⓘ: „Pas: medián výběru 60 cm (polovina 58–62), celé sbírky 64 cm (61–66), zbytku 64 cm. Známé u 180 z 212
modelek výběru. Mann–Whitney, po opravě na 58 testů p = 0,001; velikost rozdílu: střední (δ = −0,41).“

### Rizika

- Uživatel výběr skládá podle toho, co vidí v grafu („data snooping“) – postřehy jsou popis výběru, ne objev;
  proto žádné „objevili jsme“, jen „výběr má“.
- Velké výběry (polovina sbírky) dají průkazné i malé rozdíly → proto práh podstatnosti.
- Fotografové (`fot`) mají modelky z dohledání přes `GetModelky` až po načtení – do 1.18.4 se jako příznak nepoužijí.

### Jak otestovat

- Případy MW, Fisher, BH proti R (`wilcox.test(correct=TRUE, exact=FALSE)`, `fisher.test`, `p.adjust("BH")`).
- **Nulová simulace:** sbírka bez souvislostí (příznaky nezávislé na všem), 500 náhodných výběrů velikosti
  10–2 000 se semínkem → nějaký postřeh nejvýš u 5 % výběrů.
- **Zasazený rozdíl:** výběru 200 modelek se posune pas o 4 cm → postřeh „o 4 cm užší pas“ je první.
- Výběr podle vlasů neukáže postřeh o vlasech; výběr 9 modelek ukáže „příliš malý“.

---

## 3. Neobvyklé roky a souvislosti mezi údaji

**Co to dá:** „Rok 1993 vybočuje: modelky byly výrazně vyšší než okolní roky (178 vs 170 cm).“, „Vyšší modelky
mají delší boky… “ – zajímavosti, které v grafu snadno přehlédnu, s opatrností u příčin.

### Možnosti – neobvyklý rok

| | A: z-skóre roku proti celé řadě | B: Robustní odchylka od úrovně úseku | C: Reziduum od klouzavého mediánu |
|---|---|---|---|
| Jak | (medián roku − medián řady) / σ | Rok proti svému úseku ze zlomů: Mann–Whitney / Fisher rok × zbytek úseku, BH | Rok proti mediánu ±3 let |
| Správnost | Trend se splete s odchylkou | Zohlední trend i zlomy, test počítá s počtem modelek v roce | Dobrá, ale okno přes zlom zkreslí |
| Srozumitelnost | dobrá | dobrá („vybočuje z let 1985–1994“) | dobrá („proti okolním rokům“) |
| Výkon | O(n) | O(n), znovu použije úseky | O(n) |
| Náročnost | S | S (po zlomech) | S |

**Doporučení: B**, s podmínkou ≥ 8 modelek v roce a podstatným rozdílem (prahy z oddílu 2). Rekordy jednotlivých
modelek zůstávají v kartě „Rekordy“ z 1.4; postřeh může jen odkázat („Nejmladší v roce 1993: …“) – nedělat dvakrát.

### Možnosti – souvislosti (korelace)

| | A: Pearson | B: Spearman s očekávanými dvojicemi | C: Vzájemná informace |
|---|---|---|---|
| Správnost | citlivý na odlehlé hodnoty a nelinearitu | robustní, monotónní vztahy | obecná, ale nestabilní na malých vzorcích |
| Srozumitelnost | „r = 0,6“ | „čím vyšší, tím…“ | nesrozumitelná |
| Výkon | O(n) na dvojici | O(n log n), pořadí z předpočtu → O(n) | O(n) + přihrádky |

**Doporučení: B.** Dvojice z údajů `vyska, vaha, hrudnik, pas, boky, vek`, rok prvního výskytu a **hodnocení
(srdíčka)** – osobní postřeh „Výš hodnocené modelky mají menší poměr pas : boky“. Vyřadit odvozené dvojice
(BMI s výškou a váhou, poměr pas : boky s pasem a boky); **očekávané dvojice** (výška–váha, pas–boky) se
neukazují, jen když se ve výběru výrazně liší od sbírky. Postřeh, když |ρ| ≥ 0,3, ≥ 30 modelek s oběma údaji
a q ≤ 0,05 (do stejné opravy BH). Souvislost s rokem se neukazuje (to je trend z oddílu 1).

### UI

```
◆  Rok 1993 vybočuje: modelky byly vyšší než v letech 1985–1999 (178 vs 170 cm, 14 modelek).   ⓘ
∼  Výš hodnocené modelky mívají menší poměr pas : boky (souvislost, ne příčina).                 ⓘ
```

Neobvyklý rok v grafu: kroužek kolem bodu mediánu nebo obrys sloupce (barva textu, 1,5 px); bublina sloupce
dostane řádek „vybočuje z úseku 1985–1999“.

### Rizika

- Korelace s hodnocením odráží vkus uživatele i to, které modelky má lépe vyplněné – věta vždy „souvisí“, bublina
  „neznamená příčinu“.
- Neobvyklý rok často znamená chybu v datech (1993 vs 1983) – bublina nabídne „Zobrazit modelky roku“, kde chyba
  bývá vidět; kontrola dat zůstává v Údržbě.

### Jak otestovat

- Spearman proti R (`cor.test(method="spearman", exact=FALSE)`); zasazený vybočující rok najít, sousední ne;
  sbírka s výškou a váhou nezávislými → žádná souvislost v ≥ 95 % simulací.

---

## 4. Řazení, omezení a přepočet

### Možnosti – kde počítat

| | A: JS (čistý modul) | B: Go (`GetPostrehy(idVyberu, edice, druh)`) | C: Napůl (trendy Go, výběr JS) |
|---|---|---|---|
| Data | Už v paměti (`vsechnyModelky()`), testy výběru jsou JS funkce | Poslat ID výběru (5 000 čísel – v pořádku), ale **definice příznaků zdvojit** (`GRAFY` ↔ Go) | Zdvojení příznaků i logiky |
| Odezva | Bez volání, < 30 ms | + cesta přes Wails (~5–20 ms), čekání na odpověď při každém kliku | horší z obou |
| Testy | `node --test`, čistý modul | `go test`, `kontrola_uceni.go` jako vzor | oba |
| Riziko rozejití s grafem | žádné (stejné funkce) | střední | vysoké |

**Doporučení: A.** `frontend/src/lib/statistika.js` (testy a odhady, bez DOM) a `frontend/src/lib/postrehy.js`
(kandidáti, řazení, texty, bez DOM); `statistiky.js` jen předá data a vykreslí panel. Výkon je dán
předpočtem pořadí a histogramů; Web Worker až kdyby měření na 5 000 modelkách přesáhlo 30 ms.

### Řazení a omezení

- **Skóre** = síla × jistota:
  - síla = min(1, |δ| / 0,5) u údajů (Cliff), min(1, |h| / 0,8) u podílů (Cohen), u zlomu totéž mezi sousedními
    úseky, u souvislosti min(1, |ρ| / 0,6),
  - jistota = min(1, −log₁₀(q) / 4) (q = 0,0001 a méně → 1).
- **Nejvýš 5 postřehů**, nejvýš 2 stejného druhu; s výběrem mají přednost rozdíly výběru (uživatel se ptá na výběr),
  bez výběru trendy a zlomy všech grafů v čase.
- **Bez opakování:** skupiny příbuzných příznaků (`pas`, `whr`, `bmi` · `vyska`, `vaha`, `bmi` · `vlasy`, `blond`)
  – ze skupiny jen nejsilnější postřeh; jeden příznak nejvýš jednou (zlom vyhrává nad trendem téhož grafu).
- **Bez blikání:** postřeh, který byl vidět a je dál mezi prvními 7, zůstane na svém místě (hystereze).
- Panel bez postřehů se nezobrazí; s výběrem pod 10 modelek jeden šedý řádek „Výběr je na postřehy příliš malý.“

### Přepočet

- Po načtení dat (`nacistStatistiky`): předpočet příznaků, pořadí a histogramů po letech (< 50 ms, jednou).
- Při změně `filtry`, edice nebo druhu: přepočet po 150 ms klidu (tažení přes sloupce nepřepočítává, až puštění);
  mezipaměť trendů a zlomů podle klíče `edice|druh|podmínky kromě roku`.
- Rozpočet na 5 000 modelkách: přepočet výběru < 15 ms, trendy a zlomy všech 15 grafů < 30 ms (jen při změně
  klíče), vykreslení panelu < 5 ms. Měří `frontend/test/postrehy.test.js` na vygenerované sbírce.

### Klik na postřeh

Každý postřeh nese akci `{ graf, edice, druh, zvyraznit?, rok? }`:

| Druh | Klik |
|---|---|
| trend, zlom | přepne na graf příznaku se stejnou edicí a druhem, zlom a úrovně úseků zvýrazní; výběr nemění |
| rozdíl výběru (údaj, podíl) | přepne na graf příznaku – už dnes ukazuje výběr jasně a celou sbírku tlumeně |
| rozdíl výběru (hodnota rozložení) | přepne na graf rozložení, pruh hodnoty zvýrazní (bez přidání podmínky) |
| neobvyklý rok | přepne na graf a nastaví podmínku roku (`nastavitRozsah`) – seznam vpravo ukáže modelky toho roku |
| souvislost | přepne na graf prvního údaje; seznam vpravo seřazený podle druhého (jen zobrazení) |

Výběr uživatele se klikem nemění kromě neobvyklého roku (tam je to účel a jde vrátit Esc nebo × u čipu).
Panel je ovladatelný klávesnicí (Tab, Enter), postřehy jsou tlačítka s `aria-describedby` na podrobnosti.

---

## 5. Jak postřehy psát

### Pravidla textu

- **Bez žargonu v hlavní větě:** žádné p-hodnoty, „signifikantní“, „medián“, „korelace“. Medián = „typicky“
  nebo jen hodnota („60 vs 64 cm“); korelace = „souvisí“, „mívají“.
- **„Průkazně“** jen u postřehu, který prošel testem po opravě (tedy u všech zobrazených trendů); u rozdílů výběru
  se nepíše, protože neprůkazné se nezobrazí. Nikdy „pravděpodobně“, „asi“ v hlavní větě.
- **Čísla:** celé centimetry, kilogramy a roky, BMI na 1 desetinné místo, poměr na 2, podíly na celá procenta;
  `toLocaleString('cs-CZ')`; „vs“ mezi výběrem a celkem, „z … na …“ u změny v čase.
- **Skloňování** přes `sklonovat`; jména příznaků v šabloně jako dvojice tvarů (`{ nom: 'pas', rozdil: 'užší pas',
  opacne: 'širší pas' }`), aby nevznikaly věty „má o 4 cm menší obvod pasu“.
- **Období:** „od roku 1995“, „v letech 2000–2005“, „v 90. letech“ jen když úsek přesně sedí na desetiletí.
- **Druh výskytu a edice** ve větě, když nejsou Vše: „podle roku prvního centerfoldu v české edici“.
- **Opatrnost:** „souvisí“ u korelací vždy s dovětkem v bublině „neznamená příčinu“; u výběru „výběr má“,
  ne „Češky jsou“ (jde o sbírku uživatele, ne o populaci).

### Šablony (příklady)

| Druh | Šablona | Příklad |
|---|---|---|
| zlom (podíl) | Od roku {r} průkazně {roste/klesá} podíl {co}: z {a} % na {b} % v {období}. | Od roku 1995 průkazně roste podíl silikonových prsou: z 10 % na 45 % v letech 2000–2005. |
| trend bez zlomu | {Co} průkazně {roste/klesá}: z {a} v {období1} na {b} v {období2}. | Výška průkazně roste: ze 168 cm v 60. letech na 173 cm v letech 2010–2019. |
| rozdíl údaje | Výběr má o {d} {jednotka} {rozdíl} ({a} vs {b} {jednotka}). | Výběr má o 4 cm užší pas (60 vs 64 cm). |
| rozdíl podílu | Ve výběru je {víc/méně} modelek {s vlastností}: {a} % (celkem {b} %). | Ve výběru je víc modelek s tetováním: 48 % (celkem 22 %). |
| hodnota rozložení | Ve výběru je víc {hodnota mn. č.}: {a} % (celkem {b} %). | Ve výběru je víc blondýnek: 61 % (celkem 38 %). |
| neobvyklý rok | Rok {r} vybočuje: {co} {více/méně} než v letech {úsek} ({a} vs {b}, {n}). | viz oddíl 3 |
| souvislost | {Skupina} mívají {vlastnost} (souvislost, ne příčina). | Vyšší modelky mívají širší boky. |

### Bublina (podrobnosti)

Struktura vždy stejná: hodnoty obou skupin s prostřední polovinou nebo intervalem, počty se známým údajem,
název testu, p po opravě („po opravě na 58 testů p = 0,001“), slovní velikost rozdílu (malý / střední / velký
podle δ 0,15 / 0,33 / 0,47). Čísla s čárkou, žádné vědecké zápisy (p < 0,001 místo 1e-5).

### Soulad s grafy

- Žádná nová barva: akcent `#d81b60` zůstává datům; značky postřehů (zlom, úroveň úseku, kroužek roku) ve
  **barvě textu** a tlumené, aby graf zůstal čitelný; ve světlém i tmavém vzhledu přes stávající proměnné.
- Úrovně úseků doplňují, nenahrazují klouzavý průměr; legenda dostane položku „úroveň období“ jen když je zlom vidět.
- Ikony postřehů textové (↗ ↘ ≠ ◆ ∼), stejně velké písmo jako `sp-souhrn`; panel ve stylu `stat-karta`.
- Panel je mezi lištou s výběrem a grafem, sbalitelný (stav v `localStorage` jako `grafStatistik`).

---

## Co nedělat

- Jazykový model na psaní vět (API i místní) – šablony stačí a jsou testovatelné.
- Predikce do budoucna („v roce 2030 bude…“), extrapolace trendu.
- Postřehy o jednotlivých modelkách (to je Kontrola v Údržbě a Rekordy z 1.4).
- Zobrazování neprůkazných „náznaků“; p-hodnoty v hlavním textu.
- Ukládání postřehů do databáze nebo exportu.

---

## Cesta vývoje

Každá verze je malá (1–3 dny, 2–4 kroky), projde všemi testy a jde vyzkoušet sama; každý krok vyjde jako
PATCH. Pořadí: nejdřív samostatně užitečný trend u zobrazeného grafu, pak zlomy (potřebují úseky pro věty),
pak výběr (největší přínos), panel s řazením až nad všemi druhy, nakonec doplňky.

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 1.18.0 | Trend u grafu: `lib/statistika.js` I (pořadí se shodami, normální rozdělení, Kendallovo τ_b, Cochran–Armitage, Theil–Sen, Wilson), `testdata/statistika-pripady.json` z R/SciPy; věta pod grafem v čase s bublinou | M | – | ne |
| 1.18.1 | Zlomy: optimální rozdělení (binomický a L1 náklad, min. 5 let a 30 modelek, nejvýš 3), kalibrace pokuty simulací, ověření sousedních úseků; zlom a úrovně v grafu, věta „Od roku…“ | M–L | 1.18.0 | ne |
| 1.18.2 | Výběr proti sbírce: předpočet pořadí, Mann–Whitney, Fisher, Benjamini–Hochberg, Cliffovo δ a prahy podstatnosti, vyloučení podle podmínek; panel Postřehy s rozdíly výběru | M–L | 1.18.0 | ne |
| 1.18.3 | Panel napříč grafy: kandidáti ze všech grafů, skóre, omezení na 5, skupiny příbuzných příznaků, hystereze, klik na postřeh, klávesnice; měření na 5 000 modelkách | M | 1.18.1, 1.18.2 | ne |
| 1.18.4 | Neobvyklé roky a souvislosti: odchylka roku od úseku, Spearman s očekávanými dvojicemi a hodnocením; standardizace výběru podle desetiletí („odpovídá době“) | M | 1.18.3 | ne |

**Hotovo, když (celá 1.18):**

- na nulové simulované sbírce ukáže nějaký postřeh nejvýš 5 % z 500 náhodných výběrů a falešný zlom nejvýš 5 % řad;
- zasazený zlom (1995) a zasazený rozdíl výběru (pas −4 cm) se najdou jako první postřeh;
- všechny statistické funkce souhlasí s R/SciPy na sadě případů;
- přepočet po změně výběru trvá < 15 ms (trendy a zlomy < 30 ms) na 5 000 modelkách;
- každý postřeh jde kliknutím ukázat v grafu a bublina uvádí počty, test a p po opravě; hlavní věta neobsahuje
  p-hodnoty ani odborné výrazy;
- schéma zůstává na úpravě č. 11 a export na verzi 7; program nic neposílá po síti;
- uživatel vyzkoušel celé téma na skutečné sbírce.

### K vložení do ROADMAP.md

Řádek do tabulky verzí v „Po 1.0.0“:

```
| 1.18 | Postřehy ve Statistikách – trendy, zlomy, výběr proti sbírce, neobvyklé roky | – |
```

Oddíl:

```markdown
### 1.18 – Postřehy ve Statistikách

**Cíl:** Statistiky samy najdou a česky popíšou, co je ve sbírce průkazné – trend, zlom, čím se liší výběr –
a zamlčí náhodu. Nejvýš 5 postřehů nad grafem, klik ukáže odpovídající graf. Počítá se v rozhraní
(`lib/statistika.js`, `lib/postrehy.js`) ze stejných dat a definic jako grafy. **Bez změny schématu i exportu.**
Každý krok vyjde jako samostatná verze (1.18.0–1.18.4). Rozbor možností: [NAVRH-POSTREHY.md](docs/NAVRH-POSTREHY.md).

**Rozhodnutí:** neparametrické testy (Kendall, Cochran–Armitage, Mann–Whitney, Fisher, Spearman) s opravou
Benjamini–Hochberg a prahem podstatné velikosti; zlomy optimálním rozdělením s minimální délkou úseku 5 let;
výpočet v JS (testy výběru jsou funkce rozhraní), žádná p-hodnota v hlavní větě.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Trend u grafu | Statistické funkce s testy proti R/SciPy; věta pod grafem v čase („Výška průkazně roste: ze 168 na 173 cm“) s bublinou podrobností | M |
| 2 | Zlomy | Optimální rozdělení řady let (min. 5 let a 30 modelek, nejvýš 3 zlomy), pokuta kalibrovaná simulací; čárkovaná svislice a úrovně období v grafu, věta „Od roku 1995 roste…“ | M–L |
| 3 | Výběr proti sbírce | Mann–Whitney, Fisher, oprava BH, prahy podstatnosti (2 cm, 10 bodů), vyloučení příznaků určených výběrem, min. 10 modelek; panel „Výběr má o 4 cm užší pas (60 vs 64 cm)“ | M–L |
| 4 | Panel napříč grafy | Skóre síla × jistota, nejvýš 5, bez opakování příbuzných příznaků, bez blikání; klik přepne graf (u neobvyklého roku vybere rok); 5 000 modelek < 30 ms | M |
| 5 | Neobvyklé roky a souvislosti | Rok vybočující ze svého období, Spearman mezi údaji a s hodnocením („souvislost, ne příčina“), standardizace výběru podle desetiletí | M |

**Nedělá se:** jazykový model, předpovědi do budoucna, postřehy o jednotlivých modelkách, neprůkazné náznaky.

**Hotovo, když:** na nulové simulované sbírce ukáže postřeh nejvýš 5 % náhodných výběrů; zasazený zlom a rozdíl
se najdou jako první; statistické funkce souhlasí s R/SciPy; přepočet po změně výběru < 15 ms na 5 000 modelkách;
každý postřeh jde ukázat v grafu; schéma zůstává na úpravě č. 11 a export na verzi 7.
```
