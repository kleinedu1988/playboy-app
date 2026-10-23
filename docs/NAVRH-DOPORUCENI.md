# Návrh: „Mohlo by se ti líbit“ (1.17)

Stav k 23. 10. 2026 (po vydání 1.0.0). Rozpracování nového tématu: program se z hodnocení srdíčky naučí,
co se uživateli líbí, a nabídne nehodnocené modelky a fotky. Nic z toho není rozhodnuté; po potvrzení se
oddíl z konce dokumentu přenese do `ROADMAP.md`. Navazuje na „jako X“ (1.9, [NAVRH-HLEDANI.md](NAVRH-HLEDANI.md))
a „Podobné modelky“ (1.10, [NAVRH-NAPADY.md](NAVRH-NAPADY.md), nápad 3) – sdílí s nimi `podobnost.go`.

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Shrnutí

- **Učení jen z vlastních hodnocení, jen v počítači.** Jeden uživatel, žádná data jiných lidí → doporučování
  podle obsahu (údaje modelky a alba), ne kolaborativní filtrování. Žádný obsah obrázku, žádná síť.
- Doporučení: **hřebenová (ridge) regrese** odhadu srdíček v čistém Go s výpočtem v uzavřeném tvaru
  (Cholesky už je v `kontrola_uceni.go`), **kNN nad hodnocenými** pro začátek s málo hodnoceními a pro
  vysvětlení, smíchané podle počtu hodnocení. Zvlášť model modelek a model fotek.
- **Vysvětlení** z příspěvků vah („blond · 70. léta · fotograf Pompeo Posar“) a z nejbližších hodnocených
  („podobná Dorothy Stratten ♥5“).
- **Proti bublině:** z 10 doporučení 3 průzkumná (jiné období nebo vzhled, model si není jistý), výběr
  s penalizací podobnosti; pořadí deterministické pro daný den a data.
- **Aktivní učení:** „Ohodnoť další“ nabídne fotky a modelky, u kterých si model je nejméně jistý.
- **Malá neuronová síť jen volitelně a jen když vyhraje:** program ověří síť i jednoduchý model křížovou
  validací na datech uživatele a síť použije, jen když je průkazně lepší (oddíl 6). Obsah fotek (konvoluční síť)
  ne.
- **Bez změny schématu i exportu** (úprava č. 11, export 7 – resp. to, na čem bude 1.16): model se
  přepočítává z dat, v `nastaveni` je jen „Nezajímá mě“, volby a případně váhy sítě.

## Výchozí stav v kódu

| Co | Kde | Pro doporučování |
|---|---|---|
| Hodnocení modelky | `modelky.hodnoceni` (0 = nehodnoceno, 1–5), `SetHodnoceni(id, h)` v `app.go`; v JSON `Modelka.Hodnoceni` | cíl modelu modelek; pozn.: chybová hláška tam říká „hodnocení fotky“ (drobnost k opravě) |
| Hodnocení fotky | `fotky.hodnoceni`, `SetHodnoceniFotek(ids, h)` (u spojeného plakátu všechny stránky najednou) | cíl modelu fotek; plakát = jeden vzorek, ne N |
| Album | `alba (modelka_id, album, typ, vydani, spojit, popis, fotograf, netyka_se)`, `typyAlb` = Pictorial, Centerfold, Cover; cover nemá modelku | typ, fotograf, vydání, kamarádky z alba |
| Pořadí fotky | `fotky.poradi` (ruční, 0/NULL = neurčeno), `razeniFotek` | poloha v albu |
| Údaje modelky | `Modelka`: výška, váha, obvody, vlasy, oči, národnost, etnicita, `PrsaTyp`, `Ochlupeni`, `Tetovani`/`Piercing` (1/0/−1), `Role`, `Tags`, `Vydani`, `Centerfoldy`, `Obalky`, `PocetFotek`, `fotografoveAlb` | příznaky modelky |
| Robustní standardizace | `kontrola_uceni.go`: `priznakyModelky` (výška, váha, obvody, BMI, věk při 1. vydání), `robustniOdhad` (medián, σ pod/nad z kvartilů), `modelPostavy.zSkore`, `invertovatCholesky` | číselné příznaky a řešení soustavy bez knihovny |
| Podobnost | plánovaný `podobnost.go` (1.9.4 / 1.10): `vektorModelky`, `podobnostVektoru(a, b) (skore, duvody)`, `PodobneModelky` | kNN, diverzita, vysvětlení „podobná …“ |
| Nejlepší | `frontend/src/app/nejlepsi.js`: čipy ♥3+/♥4+/♥5 a vlastní výběry, mozaika po úrovních, `GetNejlepsiFotky`, `GetFotkyVyberu` | místo pro „Mohlo by se ti líbit“ |
| Řazení galerie | `RAZENI_GALERIE`, `seraditModelky`, `castGalerie` v `frontend/src/lib/format.js`; volba v `localStorage` | nové řazení „Odhad ♥“ |
| Profil | `frontend/src/app/profil.js` `otevritDetailModelky`, srdíčka modelky, alba | odhad u nehodnocené modelky |
| Nastavení | `nastaveni (klic, hodnota)`, `a.nastaveni()` / `a.ulozitNastaveni()`; v zálohách, ne v exportu | „Nezajímá mě“, volby |
| Volání backendu | `frontend/src/app/backend.js`: mimo `CTENI` ohlásí změnu dat a zahodí mezipaměti | `GetDoporuceni…` do `CTENI`; „Nezajímá mě“ mezi volání bez ohlášení (vzor z 1.9.1) |

## Společné zásady

- **Doporučení jen řadí a nabízí, nikdy nemění hodnocení** ani nic neskrývá v galerii (skryté „Nezajímá mě“
  jen ze sekce doporučení).
- **Nehodnocené ≠ nelíbí se.** Uživatel hodnotí hlavně to, co se mu líbí; učí se jen z hodnocených, nehodnocené
  nikdy nejsou záporný příklad.
- **Vždy s důvodem.** Každé doporučení má jednu řádku „protože …“; co neumí vysvětlit, nenabízí.
- **Deterministické:** stejná data + stejné datum = stejný výsledek (žádné `math/rand` bez semínka, pevné
  pořadí podle id, pevné rozdělení pro křížovou validaci).
- **Soukromí:** nic po síti, žádný obsah fotek, etnicita se nepoužívá (citlivé, nechceme ji ve vysvětleních).

---

## 1. Příznaky

### Možnosti

| | A: Ruční příznaky (one-hot, robustní z-skóre, množiny) | B: Jen podobnost z `podobnost.go` (bez vektoru) | C: Vektory z obrázků |
|---|---|---|---|
| Přesnost s málo hodnoceními | dobrá při silné regularizaci | dobrá (kNN) | – |
| Vysvětlitelnost | plná: váha × příznak = „blond“ | „podobná X“ | žádná |
| Výkon | ~150 čísel na modelku, ms | O(n²) párů, stále ms | velký model |
| Náročnost | M | S | L, odporuje „Nedělat“ |
| Testovatelnost | deterministická, jednotkové testy převodu | deterministická | špatná |

**Doporučení: A** a z B převzít jen kNN a diverzitu. C ne.

### Data a algoritmy – modelka (`priznakyDoporuceni(m, stat) []float64`)

| Skupina | Zdroj | Kódování | Počet |
|---|---|---|---|
| Postava | `priznakyModelky`: výška, váha, hrudník, pas, boky, BMI, věk při 1. vydání | `modelPostavy.zSkore`, oříznout na ±3; chybějící = 0 + příznak „chybí“ | 7 + 7 |
| Vlasy, oči | `VlasyBarva`, `OciBarva` po sjednocení synonym (1.9.0) | one-hot, hodnoty s ≥ 3 modelkami, ostatní „jiné“ | ~8 + ~5 |
| Prsa, ochlupení | `PrsaTyp`, `Ochlupeni` | one-hot jako výše | ~6 |
| Tetování, piercing | `Tetovani`, `Piercing` (1/0/−1) | +1 / −1 / 0 | 2 |
| Národnost | `Narodnost` | one-hot, nejčastějších 12 + „jiná“ | 13 |
| Období | rok 1. vydání (`prvniVydani`) | desetiletí one-hot (50.–20.) + (rok − 1990)/10 | ~9 |
| Kategorie | `Role` + odvozená Playmate měsíce z `Centerfoldy` (Go obdoba `kategorieModelky`, v `podobnost.go`) | multi-hot | ~8 |
| Fotografové | `fotografoveAlb` po `zjednodusit` | multi-hot, fotografové s ≥ 3 modelkami | ≤ 40 |
| Štítky | `Tags` | multi-hot, štítky s ≥ 3 modelkami | ≤ 40 |
| Sbírka | `PocetFotek`, počet `Centerfoldy`, `Obalky`, edice CZ | log(1 + n), 0/1 | 4 |

- Statistiky (`stat`: mediány, σ, slovníky hodnot) z celé sbírky, ne jen z hodnocených – stejné jako
  `naucitSe`, takže se počítají jednou pro kontrolu, podobnost i doporučení.
- Jméno, poznámka, odkazy, etnicita, datum úmrtí se nepoužívají.
- Vysvětlitelný název každého příznaku (`„blond“`, `„70. léta“`, `„fotograf Pompeo Posar“`, `„vyšší postava“`
  pro z > 0 / `„drobnější postava“` pro z < 0) je součást definice, ne dodatek.

### Data a algoritmy – fotka (`priznakyFotky(f, kontext) []float64`)

| Skupina | Zdroj | Kódování |
|---|---|---|
| Typ alba | `alba.typ` | one-hot Centerfold / Pictorial / Cover; `spojit` 0/1 |
| Fotograf | `alba.fotograf` | multi-hot jako u modelky (≥ 5 hodnocených fotek) |
| Modelka | `modelky.hodnoceni` | (h − průměr)/2 a příznak „nehodnocená“; u nehodnocené **odhad modelu modelek** (vrstvení) |
| Kamarádky z alba | průměr srdíček ostatních hodnocených fotek alba (**bez této fotky**), počet hodnocených | odchylka od průměru, log(1 + n); 0 + „chybí“ |
| Poloha | `poradi` (nebo pořadí podle `id`) / počet fotek v albu | 0–1, příznak „první fotka“, „poslední“ |
| Období | rok vydání alba (`vydani`), jinak 1. vydání modelky | desetiletí one-hot + spojité |
| Edice | přípona `-CZ` | 0/1 |
| Další modelky alba | `alba_modelky` | počet (0, 1, 2+) |

Obsah obrázku se nepoužívá (bez náhledů, bez otisků z 1.11). Cover bez modelky: „modelka“ = nejlépe hodnocená
modelka z obálky čísla, jinak chybí.

**Únik cíle:** průměr alba se počítá vždy bez hodnocené fotky (leave-one-out), jinak by model jen opisoval.
U plakátu (`spojit`) se všechny stránky berou jako jedna fotka.

### Uložení

Nic – příznaky se počítají z dat. Slovníky hodnot (`stat`) žijí v mezipaměti `App` vedle `naucitSe`.

### Rizika

Řídké údaje (u starších modelek chybí postava) → model se naučí „chybí = líbí/nelíbí“; příznak „chybí“ má
vlastní váhu, ale ve vysvětlení se nikdy neukáže. Synonyma vlasů bez 1.9.0 rozdělí „blond“/„blonde“ → závislost.

### Jak otestovat

`doporuceni_test.go`: převod vzorové modelky na vektor (pevná očekávaná čísla), chybějící údaje, oříznutí z,
min. četnost hodnot, leave-one-out u alba (fotka s ♥5 v albu jen s ní → příznak „chybí“).

---

## 2. Učení

### Možnosti

| | A: Hřebenová regrese na srdíčka | B: Logistická regrese „♥4+“ | C: kNN nad hodnocenými | D: Naivní Bayes |
|---|---|---|---|---|
| Jak | min ‖w·x − (h − h̄)‖² + λ‖w‖², řešení (XᵀX + λI)⁻¹Xᵀy přes Cholesky | gradientní sestup, L2 | vážený průměr srdíček 10 nejpodobnějších (`podobnostVektoru`) | P(♥4+ \| příznaky), Laplaceovo vyhlazení |
| S málo hodnoceními (10–30) | slabá, i se silným λ | slabá, nestabilní | **nejlepší** | dobrá, ale přehnaně jistá |
| Se stovkami hodnocení | **dobrá** | dobrá | průměrná (šum) | průměrná (nezávislost neplatí: BMI × váha) |
| Vysvětlitelnost | váhy × příznaky | váhy | „podobná X ♥5“ | poměry pravděpodobností |
| Nejistota (pro aktivní učení) | **zdarma**: xᵀ(XᵀX + λI)⁻¹x | přibližně (Laplace) | rozptyl sousedů | ne |
| Výkon | d ≈ 150: XᵀX za O(n·d²), řešení O(d³) – ms | iterace, desítky ms | O(n·m) | ms |
| Determinismus | přesný | závisí na počtu iterací | přesný | přesný |
| Náročnost | S–M (Cholesky existuje) | M | S (s `podobnost.go`) | S |

Ordinální regrese (prahy mezi 1–5) je přesnější teoreticky, ale pro jednoho uživatele s nerovnoměrným
hodnocením nepřinese tolik, aby vyvážila složitost – zůstává jako pozdější varianta.

### Doporučení

**A + C smíchané podle počtu hodnocení:** `odhad = α·ridge + (1 − α)·kNN`, α = n / (n + 40)
(n = počet hodnocených). B a D ne. Stejný postup pro modelky i fotky, jiné příznaky.

### Data a algoritmy

- **Cíl:** srdíčka mínus průměr uživatele (h − h̄); odhad se vrací jako h̄ + předpověď, oříznutá na 1–5.
- **Prahy (studený start):**

  | Hodnocených | Modelky | Fotky |
  |---|---|---|
  | < 10 nebo jen jedna úroveň srdíček | nic se nedoporučuje; jen „Ohodnoť další“ s různorodým výběrem | totéž |
  | 10–29 | jen kNN | kNN + průměr alba |
  | ≥ 30 | směs A + C | směs A + C |

- **Nerovnováha tříd:** váha vzorku = 1 / četnost jeho úrovně srdíček, strop 5×, normalizace na součet n;
  model se tak nenaučí jen „všechno je ♥4“. Hodnocení 0 se nikdy nepočítá jako 1.
- **Přeučení:** λ z mřížky {0,3; 1; 3; 10; 30; 100} 5násobnou křížovou validací (záhyb = `id mod 5`, tedy
  deterministický), vybere se nejmenší MAE; příznaky s < 3 výskyty mezi hodnocenými se vynechají;
  vyrovnávací člen (průměr) se nepenalizuje.
- **Model fotek:** trénuje se na hodnocených fotkách (tisíce); příznak „odhad modelky“ z modelu modelek.
  Rozpočet: 20 000 hodnocených × d = 80 → XᵀX ≈ 1,3·10⁸ operací, < 150 ms. Při víc než 50 000 hodnocených
  se trénuje na deterministickém vzorku (každá k-tá podle id).
- **Přepočet při změně:** `App` drží `verzeHodnoceni` (zvýší `SetHodnoceni`, `SetHodnoceniFotek`,
  `UpdateModelka`, úpravy alb, import, obnovení zálohy). `GetDoporuceni…` porovná verzi s mezipamětí a model
  případně přepočítá (líně, pod zámkem; souběžná volání čekají na jeden výpočet). Po hodnocení v prohlížeči
  se tedy nic nepočítá hned – až při dalším zobrazení doporučení.
- **Proti bublině (výběr 10 doporučení):**
  1. kandidáti = nehodnocení, nejsou v „Nezajímá mě“, odhad ≥ h̄;
  2. 7 míst: hladový výběr MMR – skóre = odhad − 0,3 × max podobnost k už vybraným (`podobnostVektoru`);
  3. 3 místa průzkum: z kandidátů s horní mezí odhad + 1·σ ≥ 4 z desetiletí nebo barvy vlasů, která v prvních
     sedmi chybí; označí se „Pro změnu“;
  4. pořadí ve skupinách se stejným skóre podle `hash(id, datum)` → jiný výběr každý den, ale opakovatelný.
- **Kód:** nový `doporuceni.go` (příznaky, učení, výběr, vysvětlení), `doporuceni_test.go`. Používá
  `naucitSe`, `invertovatCholesky`, `podobnost.go`. Rozhraní nic nepočítá.

### Uložení

Model se neukládá (přepočet < 200 ms je levnější než hlídat zastaralé váhy). Mezipaměť jen v paměti `App`.

### Rizika

- Málo hodnocení modelek (desítky) → ridge skoro nic neumí; směs to drží u kNN a UI ukazuje „zatím hádám“.
- Popularita: `PocetFotek` může převážit vkus (víc fotek = líp hodnocené) → test, že bez rozdílu ve vkusu
  nevyhrává jen počet fotek; v nejhorším příznak vypnout.
- Číselná stabilita: XᵀX + λI je kladně definitní pro λ > 0; Cholesky selže jen při NaN → test.

### Jak otestovat

Syntetická sbírka (`naplnitSbirku(n)` z 1.9 + zasazený vkus: ♥5 blond 70. let, ♥2 ostatní, šum ±1):
mezi prvními 10 doporučeními ≥ 8 blond 70. let (bez průzkumných); dvě volání dají totéž; při 9 hodnoceních nic;
po změně jednoho hodnocení se model přepočítá (verze), bez změny ne; 2 000 modelek < 50 ms, 64 000 fotek < 300 ms
(`vykon_test.go`).

---

## 3. Vysvětlení

### Možnosti

| | A: Příspěvky vah | B: Nejbližší hodnocení sousedé | C: Pravidla nad příznaky („máš rád blond“) |
|---|---|---|---|
| Věrnost modelu | přesná pro ridge | přesná pro kNN | jen přibližná |
| Srozumitelnost | „blond · 70. léta · Pompeo Posar“ | „podobná Dorothy Stratten ♥5“ | dobrá |
| S málo hodnoceními | nespolehlivé váhy | **funguje** | – |
| Náročnost | S | S | M |

### Doporučení

**A + B podle toho, která složka odhadu převažuje** (α ≥ 0,5 → A, jinak B); vždy nejvýš 3 důvody.

### Data a algoritmy

- Příspěvek příznaku j = wⱼ·(xⱼ − x̄ⱼ); bere se jen kladný, nad 0,1 srdíčka, bez příznaků „chybí“ a bez
  vyrovnávacího členu; seřadit sestupně, vzít 3, sloučit stejnou skupinu („70. léta“ + spojitý rok = jedno).
- Soused: nejpodobnější hodnocená ♥4+ s podobností ≥ 0,7 → „podobná Dorothy Stratten ♥5“ (klik otevře profil).
- U fotky typicky: „Centerfold · tvoje ♥5 modelka · album máš v průměru na ♥4,3“.
- Pro „Ohodnoť další“ jiný text: „nevím: blond, ale fotograf, kterého neznám“ (největší |příspěvek| se
  shodným i opačným znaménkem).
- Struktura: `Doporuceni{ID, Odhad, Jistota, Duvody []string, Soused *OdkazModelky, Pruzkum bool}`.

### Rizika a test

Riziko: důvod neodpovídá pořadí (dva skoro stejné odhady s jinými důvody) – přijatelné. Test: zasazený vkus
→ důvody u prvních 5 obsahují „blond“ nebo „70. léta“; nikdy se neukáže „chybí údaj“ ani etnicita.

---

## 4. UI

### Možnosti

| | A: Sekce v Nejlepších + řazení + odhad v profilu | B: Samostatný přehled „Doporučené“ | C: Jen řazení „Odhad ♥“ v galerii |
|---|---|---|---|
| Objevitelnost | dobrá (Nejlepší = místo hodnocení) | nejlepší, ale další položka v navigaci | slabá |
| Náročnost | M | M–L | S |
| Zásah do stávajícího | malý | nová navigace, zkratky, nápověda | žádný |

**Doporučení: A**, C jako první krok (jde vyzkoušet hned po modelu).

### Kde a jak

**Nejlepší → čip „Mohlo by se ti líbit“** (vedle ♥3+ / ♥4+ / ♥5 a výběrů):

```
[♥ 3+] [♥ 4+] [♥ 5] [✦ Mohlo by se ti líbit] [Výběr A 12]

Modelky                                                          Další →
[karta] Eva Příkladná    [karta] …        [karta] …   [karta] Pro změnu
 odhad ♥♥♥♥ · blond ·     podobná          …          80. léta · nevím
 70. léta · P. Posar      D. Stratten ♥5
                                    ⋯ → Ohodnotit… / Nezajímá mě / Proč?

Fotky (60)                                                       Další →
[mozaika nehodnocených fotek s nejvyšším odhadem, max. 3 z jednoho alba]

Pomoz mi tě poznat: ohodnoť 12 fotek, u kterých si nejsem jistý   [Začít]
```

- Klik na fotku otevře prohlížeč nad seznamem doporučených; klávesy 1–5 ohodnotí a fotka ze seznamu zmizí
  (při dalším načtení), 0 = „Nezajímá mě“.
- Stav „zatím hádám“ (10–29 hodnocení): nadpis „Zatím hádám podle N hodnocení“.
- Studený start: „Ohodnoť aspoň 10 modelek nebo fotek (máš 4). [Začít]“.

**Galerie → řazení „Odhad ♥“** (`RAZENI_GALERIE.odhad`): hodnocené podle skutečných srdíček, nehodnocené podle
odhadu, části lišty „♥♥♥♥♥“, „♥♥♥♥ (odhad)“…; na kartě nehodnocené modelky šedá srdíčka odhadu s titulkem
důvodu. Data: jedno volání `GetOdhadyModelek() map[int]Doporuceni` – `GetModelky` se nemění a nezpomalí.

**Profil nehodnocené modelky:** pod prázdnými srdíčky

```
♡♡♡♡♡   odhad ♥♥♥♥ (4,2) – blond · 70. léta · fotograf Pompeo Posar
```

U hodnocené nic (nebo jen v titulku „odhad by byl 3,1“ – kvůli ladění, volitelně).

**„Ohodnoť další“ (aktivní učení):** prohlížeč nad 12 položkami s největší nejistotou σ(x) = √(s²·xᵀA⁻¹x)
mezi nehodnocenými, nejvýš 2 z jednoho alba a 2 od jedné modelky; při studeném startu místo nejistoty
nejrozmanitější výběr (hladový k-střed nad vektory). Po každém hodnocení další; po 12 „Díky, odhad je teď
přesnější o X“ (rozdíl MAE z křížové validace před a po).

### Zpětná vazba „Nezajímá mě“ – kde uložit

| Varianta | Výhody | Nevýhody |
|---|---|---|
| **`nastaveni`, klíč `doporuceni_skryte`** (JSON `{verze:1, modelky:{id:datum}, fotky:{id:datum}}`) | bez schématu, v zálohách, vidí Go | ne v exportu (to je správně – používání, ne sbírka) |
| `netyka_se` modelky (`ok-…`) | už existuje | je to údaj sbírky a jde do exportu; míchá kontrolu dat s vkusem |
| `localStorage` | nejjednodušší | ztratí se s obnovením zálohy, Go ho nevidí |

**Doporučení: `nastaveni`.** Vazby `GetDoporuceniVolby()` / `SkrytDoporuceni(druh, id, skryt bool)`;
v `backend.js` mezi volání bez ohlášení změny dat (nevyvolá znovunačtení galerie). Smazaná modelka nebo fotka
se ze seznamu uklidí při dalším výpočtu. „Nezajímá mě“ jen skryje, model neovlivní (učit se z něj jako
ze slabého ♥2 je otázka na později – viz Rizika). ⋯ → Doporučení: vypnout celé téma, „Zobrazit skryté (N)“,
„Zapomenout skryté“.

### Rizika

- Mozaika Nejlepších je dnes po úrovních srdíček (`urovneVykresleni`); nová sekce má vlastní vykreslení, ne další
  úroveň – jinak se rozbije lišta částí.
- Šedá srdíčka odhadu se nesmí plést se skutečným hodnocením → jiná barva, titulek „odhad“, nejdou kliknout jako
  hodnocení (klik = skutečné hodnocení).

### Jak otestovat

`frontend/test`: `seraditModelky(…, 'odhad')` (hodnocené před odhadem stejné úrovně), `castGalerie` pro odhad,
HTML sekce v prázdném stavu a se studeným startem; `backend.test.js` hlídá, že `SkrytDoporuceni` neohlásí změnu
dat. Ručně: 12× „Ohodnoť další“ jen klávesnicí.

---

## 5. Vyhodnocení

### Možnosti

| | A: Křížová validace na vlastních hodnoceních | B: Sledovat, co uživatel z doporučení ohodnotí | C: Bez měření |
|---|---|---|---|
| Kdy je k dispozici | hned | po týdnech používání | – |
| Věrohodnost | dobrá (hodnocení nejsou náhodný vzorek) | nejlepší | – |
| Náročnost | S (stejný kód jako výběr λ) | S–M (záznam v `nastaveni`) | – |

**Doporučení: A hned, B jako levný doplněk** (počítadlo „doporučeno → ohodnoceno ♥4+“ v `nastaveni`,
klíč `doporuceni_uspesnost`).

### Metriky

| Metrika | Výpočet | Základ k porovnání |
|---|---|---|
| MAE | průměrná \|odhad − h\| na odložených | průměr uživatele (fotky: průměr alba bez fotky) |
| Spearmanovo ρ | pořadí odhadu vs. srdíček | 0 |
| precision@10 | podíl ♥4+ mezi 10 nejvýš odhadnutými odloženými (v každém záhybu) | podíl ♥4+ mezi hodnocenými |
| Rozmanitost | počet různých desetiletí a barev vlasů v 10 doporučeních | ≥ 3 desetiletí |
| Úspěšnost (B) | ohodnocená doporučení s ♥4+ / všechna ohodnocená doporučení | podíl ♥4+ celkově |

### Kritéria přijetí

- model modelek: MAE ≤ 0,9 × základ a precision@10 ≥ základ + 0,15 (při ≥ 30 hodnoceních);
- model fotek: MAE lepší než „průměr alba“ – jinak se pro fotky použije jen průměr alba a modelky
  (a UI to řekne: „fotky odhaduji podle alba“);
- na syntetické sbírce se zasazeným vkusem precision@10 ≥ 0,8;
- výsledky v ⋯ → Doporučení → „Jak dobře tě znám“: „Na tvých 214 hodnoceních se trefím v průměru o 0,7 ♥
  (náhodně o 1,1); z 10 nejlepších tipů máš 8 na ♥4+.“

### Rizika

Hodnocení nejsou náhodný vzorek (hodnotí se hlavně oblíbené) → metriky jsou optimistické; proto i B. Malá
data → kolísání metrik mezi záhyby, ukazovat zaokrouhleně a s počtem hodnocení.

---

## 6. Malá neuronová síť (volitelně)

**Co to dá:** zachytí kombinace, které lineární model nevidí (fotograf × období, typ alba × oblíbená modelka,
„vysoká, ale jen v 90. letech“). Stejné vstupy jako ridge, žádná nová data, žádná knihovna.

### Možnosti

| | A: Jen jednoduchý model (ridge + kNN) | B: Jen síť | C: **Dva modely, vyhraje lepší** |
|---|---|---|---|
| Přesnost s málo hodnoceními | dobrá | špatná (přeučení) | jako A |
| Přesnost s tisíci hodnocení | dobrá | možná o pár % lepší | lepší z obou |
| Vysvětlitelnost | plná | jen nepřímo | plná u A, nepřímá u sítě |
| Výkon učení | ms | sekundy | sekundy na pozadí, jen při změně |
| Náročnost | – | M–L | M–L |
| Testovatelnost | přesná | deterministická jen s pevným semínkem a jedním vláknem | jako B + test výběru |

**Doporučení: C**, jako samostatný poslední krok 1.17 a jen když metriky z 1.17.3 ukážou, že je na čem stavět
(dost hodnocených fotek). Pro modelky se síť skoro jistě neprosadí – ověřit, nečekat.

### Data a algoritmy

- **Architektura:** vstup = vektor příznaků z oddílu 1 (modelky d ≈ 150, fotky d ≈ 80; řídké – nenulových
  ~20–30) → 1 skrytá vrstva **16 neuronů** (mřížka 8 / 16 / 32), **tanh** (hladký, menší riziko mrtvých neuronů
  než ReLU u malých dat) → 1 výstup = odhad h − h̄ (stejný cíl, váhy tříd i ořez jako u ridge). Varianta
  „pravděpodobnost ♥4+“ (sigmoida, křížová entropie) jen pro precision@10 – nejdřív regrese.
- **Učení:** Adam (lr 0,01), L2 1e-3 (mřížka 1e-4 / 1e-3 / 1e-2), dávky po 64, nejvýš 300 epoch, **early
  stopping** na validační části (15 %, záhyb podle `id`), trpělivost 15 epoch, vrátí se nejlepší epocha.
  Inicializace Xavier z vlastního PCG (`math/rand/v2`) s **pevným semínkem** (hash definice příznaků), míchání
  dávek ze stejného generátoru, výpočet v jednom vlákně (pořadí sčítání) → stejná data = stejné váhy.
- **Kód:** `sit.go` (dopředný a zpětný průchod nad řídkými vstupy, Adam, ~200 řádků), `sit_test.go`. Řídké
  vstupy: první vrstva sčítá jen nenulové příznaky → ~10× rychlejší než hustý výpočet.
- **Doba učení** (Go, jedno jádro, odhad pro řídké vstupy, 1 konfigurace × 5 záhybů křížové validace):

  | Data | Na epochu | Učení (≈ 100–300 epoch) | Celé ověření (5 záhybů × 3 konfigurace) |
  |---|---|---|---|
  | 5 000 modelek (hodnocených zlomek) | < 5 ms | < 1 s | ~10 s |
  | 50 000 hodnocených fotek | ~30 ms | ~3–9 s | ~1–2 min |

  Proto **na pozadí** (gorutina s průběhem v ⋯ → Doporučení), jen ručně „Ověřit síť“ nebo když se od posledního
  učení změnilo ≥ 5 % hodnocení; do té doby platí jednoduchý model. Odhad jedné položky sítí ~1 µs.
- **Kolik hodnocení:** síť s 16 neurony má u modelek ~2 400 vah, u fotek ~1 300; i se silným L2 potřebuje
  zhruba ≥ 10 vzorků na „užitečný“ parametr. Odhad: **modelky prakticky nikdy** (sbírka má stovky hodnocených,
  ne tisíce), **fotky od ~3 000 hodnocených** s možným ziskem 3–8 % MAE oproti ridge. Pod 1 000 hodnocených
  se síť vůbec nezkouší.
- **„Dva modely, vyhraje lepší“:** na stejných 5 záhybech MAE ridge+kNN i sítě; síť vyhraje, jen když
  (1) průměrná MAE je nižší o ≥ 3 %, (2) je lepší v ≥ 4 z 5 záhybů a (3) precision@10 není horší. Jinak zůstane
  jednoduchý model. Výsledek je vidět v „Jak dobře tě znám“: „Síť: 0,64 ♥, jednoduchý model: 0,69 ♥ → používám síť“
  nebo „síť nepomohla (0,71 vs. 0,69)“.
- **Přeučení na malých datech:** hlavní riziko → práh 1 000 hodnocených, early stopping, L2, malá skrytá vrstva,
  pravidlo výše. Síť nikdy nedostane příznaky, které ridge vynechal (min. četnost).

### Vysvětlitelnost

- **Globálně:** permutační důležitost skupin příznaků (vlasy, období, fotograf…) na validační části – o kolik
  vzroste MAE po zamíchání skupiny (permutace z pevného semínka) → „Nejvíc tě ovlivňuje: fotograf, období, typ alba“.
- **U položky:** zakrytí skupin – odhad se přepočítá s každou skupinou nastavenou na „chybí“/průměr (~15 průchodů,
  µs); tři největší poklesy = důvody („blond · 70. léta · Pompeo Posar“), stejný tvar jako u ridge. Vedle toho
  vždy nejbližší hodnocený soused z kNN („podobná X ♥5“) – ten je srozumitelný bez ohledu na model.
- Důvod se ukáže jen, když pokles ≥ 0,1 ♥; jinak jen soused.

### Uložení

`nastaveni`, klíč `doporuceni_sit_fotky` (případně `…_modelky`): JSON `{verze:1, definice:"hash názvů příznaků",
verzeHodnoceni, h, lambda, mae, w1, b1, w2, b2}`, váhy jako float32 v base64. Velikost: fotky ~1 300 vah ≈ **7 kB**,
modelky ~2 400 vah ≈ **13 kB** (jako desetinná čísla v JSON ~4× víc – proto base64). Při jiné definici příznaků
(nový fotograf v slovníku, změna kódování) se váhy zahodí a síť se při příštím ověření naučí znovu. Uložené váhy
jen zrychlí start; zdrojem pravdy zůstávají hodnocení. Klíč není v exportu, je v zálohách.

### Obsah fotek (konvoluční síť na náhledech)

| Co by to stálo | Odhad |
|---|---|
| Data | pixely všech fotek → závisí na náhledech na disku z 1.5 (64 000 × ~40 kB ≈ 2,5 GB stáhnout a držet) |
| Učení od nuly | z tisíců hodnocení se vlastní konvoluční síť vkus nenaučí (potřebuje statisíce obrázků) |
| Hotový model | MobileNet / CLIP apod. 10–20 MB (CLIP víc) + cizí runtime (ONNX, cgo) – obojí je v „Nedělat“ |
| Výpočet v čistém Go | ~0,3 GFLOP na obrázek → 64 000 fotek hodiny na CPU; každá nová fotka znovu |
| Vysvětlitelnost | „podobá se fotkám, které máš rád“ – nic konkrétního |
| Zásady | blízko „rozpoznávání obličejů“ a „hledání podle obsahu fotky“ z „Nedělat“ |

**Doporučení: nedělat.** Údaje sbírky (fotograf, album, modelka, období) nesou většinu vkusu za zlomek ceny;
k obsahu fotek se vrátit, jen kdyby se změnil oddíl „Nedělat“.

### Rizika a jak otestovat

- Nedeterminismus (souběh, pořadí) → test: dvakrát naučit, váhy bit po bitu stejné.
- Pomalé ověření zablokuje rozhraní → jen na pozadí, zrušitelné, test, že `GetDoporuceni` během učení vrací
  jednoduchý model.
- Testy (`sit_test.go`): kontrola gradientu numericky; XOR-like zasazený vkus (♥5 jen blond **a** 70. léta
  nebo tmavé **a** 90. léta) – síť porazí ridge a pravidlo ji vybere; čistě lineární vkus – síť nevyhraje
  a zůstane ridge; pod 1 000 hodnocených se nezkouší; zahození vah při změně definice; rozpočet 50 000 fotek
  ověření < 2 min v `vykon_test.go` (přeskočí se s `-short`, jako dnešní zátěžový test).

---

## Uložení a vazby (souhrn, bez změny schématu)

| Klíč v `nastaveni` | Obsah | Velikost |
|---|---|---|
| `doporuceni_skryte` | „Nezajímá mě“: id modelek a fotek s datem | < 50 kB |
| `doporuceni_volby` | zapnuto, počet průzkumných míst, zobrazit odhad v profilu | < 1 kB |
| `doporuceni_uspesnost` | počítadla doporučeno / ohodnoceno / ♥4+ | < 1 kB |
| `doporuceni_sit_fotky` (`…_modelky`) | váhy malé sítě, jen když vyhrála (oddíl 6) | ~7 kB (~13 kB) |

| Vazba | Druh |
|---|---|
| `GetOdhadyModelek() map[int]Doporuceni` | čtení (`CTENI`) |
| `GetDoporuceni(druh string, n int) []Doporuceni` (`modelky` / `fotky`) | čtení |
| `GetKOhodnoceni(n int) []Doporuceni` | čtení |
| `GetVyhodnoceniDoporuceni() Vyhodnoceni` | čtení |
| `SkrytDoporuceni(druh string, id int, skryt bool) bool` | zápis bez ohlášení změny dat |

`TestZmrazeniAlfy` / test zmrazení se nemění; export neobsahuje nic z doporučení.

## Nedělat

- Obsah obrázku (konvoluční síť, hotový obrazový model a jeho runtime, barvy, otisky z 1.11 jako příznak vkusu),
  rozpoznávání obličejů.
- Neuronovou síť jako výchozí model nebo bez porovnání s jednoduchým modelem.
- Kolaborativní filtrování, sdílení hodnocení, cokoli po síti.
- Automatické hodnocení („doplnit odhadem“) – srdíčka dává jen uživatel.
- Učení z otevírání profilů (to dělá 1.9 pro hledání; míchat by znejasnilo vysvětlení).
- Etnicitu jako příznak.

---

## Cesta vývoje

Každá verze je malá (1–3 dny, 2–4 kroky), projde všemi testy a jde vyzkoušet sama; každý krok vyjde jako
PATCH (1.17.0, 1.17.1…). Pořadí: nejdřív model a měření (bez nich nejde ladit), pak nejviditelnější UI,
pak fotky, nakonec aktivní učení.

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 1.17.0 | Model modelek: `doporuceni.go` (příznaky, ridge + kNN, prahy studeného startu, váhy tříd, λ křížovou validací, `verzeHodnoceni`), `GetOdhadyModelek`, `GetVyhodnoceniDoporuceni`; řazení „Odhad ♥“ v galerii; testy se zasazeným vkusem a výkon | M–L | 1.10 (`podobnost.go`), 1.9.0 (synonyma vlasů) | ne |
| 1.17.1 | Mohlo by se ti líbit: čip v Nejlepších, 10 modelek s MMR a 3 průzkumnými, důvody (váhy / soused), „Nezajímá mě“ v `nastaveni` (volání bez ohlášení z 1.9.1), odhad v profilu | M | 1.17.0, 1.9.1 | ne |
| 1.17.2 | Fotky: příznaky alba s leave-one-out, model fotek s odhadem modelky, mozaika 60 fotek (max. 3 z alba), prohlížeč nad doporučenými, porovnání s „průměrem alba“ | M | 1.17.0 | ne |
| 1.17.3 | Ohodnoť další a vyhodnocení: nejistota z ridge, k-střed při studeném startu, „Pomoz mi tě poznat“ v prohlížeči, ⋯ → Doporučení („Jak dobře tě znám“, skryté, vypnout), počítadla úspěšnosti | M | 1.17.1, 1.17.2 | ne |
| 1.17.4 | Malá neuronová síť (volitelně): `sit.go` (1 skrytá vrstva, Adam, L2, early stopping, pevné semínko), ověření na pozadí, „dva modely, vyhraje lepší“, důvody zakrytím skupin, váhy v `nastaveni` | M–L | 1.17.3 + metriky ze skutečné sbírky (≥ 1 000 hodnocených fotek) | ne |

Krok 1.17.4 se dělá, jen když „Jak dobře tě znám“ po několika týdnech používání ukáže dost hodnocených fotek;
jinak se odloží a 1.17 je hotová po 1.17.3.

**Hotovo, když (celá 1.17):**

- na syntetické sbírce se zasazeným vkusem je ≥ 8 z 10 doporučených modelek „podle vkusu“ a každá má důvod;
- na skutečné sbírce model modelek splní MAE ≤ 0,9 × základ a precision@10 ≥ základ + 0,15, model fotek je lepší
  než průměr alba (jinak se vypne a UI to řekne);
- pod 10 hodnoceními se nic nedoporučuje a nabídne se „Ohodnoť další“;
- „Nezajímá mě“ přežije restart a obnovení zálohy a neovlivní galerii;
- stejná data a datum dají stejná doporučení; přepočet 2 000 modelek < 50 ms, 64 000 fotek < 300 ms;
- (1.17.4) síť se použije jen při průkazně lepší křížové validaci, jinak zůstane jednoduchý model;
- schéma ani export se nemění, nic nejde po síti; uživatel vyzkoušel téma na skutečné sbírce.

### K vložení do ROADMAP.md

Řádek do tabulky verzí v „Po 1.0.0“:

```
| 1.17 | Mohlo by se ti líbit – odhad srdíček z vlastních hodnocení, doporučené modelky a fotky, „Ohodnoť další“, volitelně malá neuronová síť | 1.10, 1.9.1 |
```

Oddíl:

```markdown
### 1.17 – Mohlo by se ti líbit

**Cíl:** program se z hodnocení srdíčky naučí vkus uživatele a nabídne nehodnocené modelky a fotky, každou
s důvodem. Jen z vlastních hodnocení a údajů sbírky (ne z obsahu fotek), vše v počítači. **Bez změny schématu
i exportu** – model se přepočítává z dat, „Nezajímá mě“ a volby jsou v `nastaveni`. Každý krok vyjde jako
samostatná verze (1.17.0–1.17.3, volitelně 1.17.4). Rozbor možností: [NAVRH-DOPORUCENI.md](docs/NAVRH-DOPORUCENI.md).

**Rozhodnutí:** hřebenová regrese odhadu srdíček v čistém Go (Cholesky z `kontrola_uceni.go`) smíchaná s kNN nad
hodnocenými podle jejich počtu; příznaky z údajů modelky a alba (robustní z-skóre, one-hot, fotografové, štítky);
podobnost a diverzita ze společného `podobnost.go`; nehodnocené nikdy nejsou záporný příklad.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Model modelek a řazení | `doporuceni.go`: příznaky, ridge + kNN, pod 10 hodnoceními nic, váhy úrovní srdíček, λ 5násobnou křížovou validací, přepočet po změně hodnocení; řazení „Odhad ♥“ v galerii; MAE a precision@10 na vlastních hodnoceních | M–L |
| 2 | Mohlo by se ti líbit | Čip v Nejlepších: 10 modelek (7 nejlepších s penalizací podobnosti + 3 „Pro změnu“), důvody „blond · 70. léta · fotograf Pompeo Posar“ nebo „podobná X ♥5“, „Nezajímá mě“ (v `nastaveni`), odhad v profilu nehodnocené modelky | M |
| 3 | Doporučené fotky | Příznaky fotky (typ alba, fotograf, hodnocení modelky, průměr alba bez fotky, poloha, období), mozaika 60 fotek (max. 3 z alba), prohlížeč s klávesami 1–5; když nepřekoná průměr alba, použije se ten | M |
| 4 | Ohodnoť další a vyhodnocení | 12 fotek a modelek, u kterých si model je nejméně jistý (při začátku nejrozmanitější), ⋯ → Doporučení: „Jak dobře tě znám“, skryté, vypnout | M |
| 5 | Malá neuronová síť (volitelně) | Jen při ≥ 1 000 hodnocených fotek podle metrik z kroku 4: perceptron s 1 skrytou vrstvou v čistém Go (pevné semínko, Adam, L2, early stopping), ověření na pozadí; použije se, jen když je v křížové validaci o ≥ 3 % lepší v ≥ 4 z 5 záhybů, jinak zůstane jednoduchý model; váhy (~7 kB) v `nastaveni` | M–L |

**Nedělá se:** obsah obrázku (konvoluční síť, hotové obrazové modely a jejich runtime), automatické hodnocení
odhadem, učení z otevírání profilů, etnicita jako příznak.

**Hotovo, když:** na syntetické sbírce je ≥ 8 z 10 doporučení podle zasazeného vkusu; na skutečné sbírce je odhad
modelek o ≥ 10 % přesnější (MAE) než průměr uživatele a každé doporučení má důvod; stejná data dají stejný výsledek;
přepočet 2 000 modelek < 50 ms a 64 000 fotek < 300 ms; schéma a export se nemění.
```


## Úprava podle skutečného používání (23. 10. 2026)

Uživatel hodnotí **všechny** modelky (i jedním srdíčkem), přidává je po letech (kolem 400 modelek, rok 1977,
desítky denně) a fotky hodnotí jen tehdy, když se mu vyloženě líbí. Z toho plyne:

- **Modelky:** nehodnocené k doporučení skoro nejsou. Odhad srdíček se použije jako **návrh u nově přidané
  modelky** (potvrdí se jedním klikem) a ke **kontrole soudržnosti** (modelky hodnocené jinak než podobné, posun
  měřítka v čase). Jedna srdíčka jsou cenné záporné příklady – regrese z oddílu 2 zůstává.
- **Fotky:** hodnocení je jen kladný signál; neohodnocená fotka neznamená „nelíbí se“. Místo regrese na srdíčka
  jde o učení z kladných a neoznačených příkladů: skóre podobnosti k označeným fotkám, neoznačené s nízkou vahou
  (nebo vážení podle odhadované pravděpodobnosti označení). Vyhodnocení: kolik z nabídnutých fotek si uživatel
  později označí proti náhodným fotkám stejných alb.
- **Období:** model se učí jen z let, která sbírka má. Období je příznak; odhad pro roky mimo rozsah sbírky se
  označí jako nejistý. Kontrola podle období (1.16) se proto vyplatí brzy.
- **Neuronová síť (oddíl 6):** teď ne. Při stovkách modelek a jen kladně označených fotkách se přeučí; znovu
  zvážit při tisících hodnocených modelek, s pravidlem „použije se, jen když průkazně vyhraje“.

Upravený oddíl 1.17 je v ROADMAP.md.
