# Návrh: Kontrola 2.0 (1.16)

Stav k 23. 10. 2026 (verze 0.99.2). Další krok kontroly údajů v Údržbě, která se od 0.99.2 učí ze sbírky
(`kontrola_uceni.go`). Nic z toho není rozhodnuté; po potvrzení se verze přenesou do `ROADMAP.md` (sekce
k vložení je na konci). Navazuje na 1.6 Kvalita dat; souvisí s 1.9 (podobnost modelek sdílená s kontrolou).

Pracnost: **S** do 2 hodin, **M** půl dne, **L** den a víc. **[schéma]** = mění databázi nebo export.

## Shrnutí

- **Postava podle období:** rozsahy i neobvyklé kombinace se počítají vůči modelkám ze stejné doby (klouzavé
  okno ±5 let podle prvního vydání, přitažené k celé sbírce, když je modelek z té doby málo). Pas 70 cm
  u playmate z roku 1962 se nahlásí, u playmate z roku 2008 ne.
- **Jistota a řazení:** každý nález dostane „pravděpodobnost chyby“ (síla odchylky × spolehlivost pravidla),
  Kontrola se podle ní řadí a ukazuje ji slovy („skoro jistě překlep“, „možná chyba“); slabé nálezy jdou skrýt.
- **Učení z oprav i z „V pořádku“:** program si pamatuje ukázané nálezy; zmizí-li nález, protože se změnil
  údaj, je to „opraveno“ (správný nález), „V pořádku“ je planý poplach. Z toho přesnost každého pravidla,
  opatrné ladění prahů v pevných mezích, věta „Kontrola se naučila: …“ a „Zapomenout naučené“.
- **Bez změny schématu i exportu:** období se dopočítá, jistota se počítá při kontrole, naučené počty jsou
  v tabulce `nastaveni` (v zálohách ano, v exportu ne – stejně jako učení hledání v 1.9).
- Pořadí: období → jistota → pamatování nálezů → ladění prahů → (volitelně) návrh opravy (1.16.0–1.16.4).

## Výchozí stav v kódu

| Kde | Co dělá | Pro 1.16 |
|---|---|---|
| `kontrola.go` `kontrolovatSbirku` | Pravidla modelek a alb, nálezy `PodezrelyUdaj` (`Klic` „ok-…“, `Pole`, `Album`, `NetykaSe`); skryté podle `obsahujeKlic(netyka_se, klic)` | Přibude jistota a vnitřní otisk nálezu; klíče `ok-…` se nemění |
| `kontrola.go` `kontrolovatData`, `kontrolovatPostavu` | Tvrdá pravidla (narození v budoucnosti, úmrtí před narozením…) a rozsahy `rozsahyKontroly`; `ok-miry` hlásí hrudník, pas i boky jedním nálezem | Tvrdá pravidla dostanou pevnou jistotu, rozsahy budou podle období |
| `kontrola_uceni.go` `naucitSe` → `naucitRozsah` | `robustniOdhad` (medián, σ zvlášť pod a nad mediánem z kvartilů, `kvantilUdaje`), medián ± `kRozsahu` (4,5) σ, `minPul`, meze `mezOd`/`mezDo`, `rozsiritPodlePotvrzenych` | Totéž v okně období; k se smí ladit |
| `kontrola_uceni.go` `naucitPostavu`, `kontrolovatNeobvykle` | Z-skóre (`zSkore`), kovariance po dvojicích bez modelek s \|z\| > 3,5, smrštění k diagonále (`presnost`, `invertovatCholesky`), mez `mezKombinace` (χ², α = 1e-5, Wilson–Hilferty), `podobnaPotvrzene` | Z-skóre vůči období, korelace z celé sbírky; d² dává sílu nálezu |
| `kontrola_uceni.go` `priznakyModelky` | 7 údajů včetně BMI a **věku při prvním vydání** | Věk už v kombinacích je; chybí jen doba |
| `kontrola_uceni.go` `kontrolovatPodobnaJmena`, `podobnostModelek` | Jaro–Winkler s trigramovým předvýběrem, ±0,03–0,05 za datum narození, první vydání, centerfoldy; práh `prahJmen` 0,95 | Skóre dává sílu; volitelně doba prvního vydání |
| `kontrola.go` `prvniVydani` | Nejstarší měsíční vydání bez speciálů (`vzorVydani` vč. přípony edice) | Rok období modelky |
| `vyvoj.go` `GetVyvojVCase`, `bodyVyvoje`, `kvantil` | Medián a kvartily postavy po desetiletích a pětiletích pro Statistiky (podle prvního centerfoldu v edici) | Ukazuje, že se postava v čase mění; graf jde použít k ověření |
| `nastaveni.go` `GetPrehled` | Při každém načtení Přehledu volá `kontrolovatSbirku` (5 000 modelek ≈ 80 ms) | Místo, kde se porovná s minule ukázanými nálezy |
| `nastaveni.go` `a.nastaveni` / `a.ulozitNastaveni` | Tabulka `nastaveni (klic, hodnota)` (`app.go`, `CREATE TABLE IF NOT EXISTS`) | Úložiště naučeného **bez změny schématu**; v režimu `jenProCteni` se nezapisuje |
| `app.go` `SetNetykaSe`, `SetNetykaSeAlba` | „V pořádku“ = klíč v `netyka_se` (jen klíče z `kliceKontrolyModelky` / `kliceKontrolyAlba`); jde do exportu, import neznámý klíč tiše zahodí | Nové klíče `ok-…` nezavádět (starší program by je ztratil) |
| `frontend/src/app/prehled.js` `htmlUdrzby` | Fronta řazená podle `vaha` (počet úkolů), řádek „ke kontrole“ = nálezy modelky jako štítky, ⋯ (`nabidkaRadku`) „V pořádku: …“ / „Znovu kontrolovat: …“, `oznacitNetykaSe` | Řazení a text jistoty, odkaz „zobrazit i slabé“, „Proč?“ v ⋯, souhrn naučeného |
| `kontrola_uceni_test.go` | `umelaSbirka(n)` s pevným semínkem, roky 1960–2009, testy učení, determinismu a rychlosti (5 000 modelek < 1 s) | Rozšířit o trend v čase a o simulované překlepy se známou pravdou |

## Společné zásady

- **Vysvětlitelnost:** každý nález umí říct proč (rozsah období, rozsah sbírky, jistota, co se pravidlo
  naučilo). Žádný model, který neumí vysvětlit své číslo.
- **Učení řadí a ladí, neskrývá potichu:** skrýt jde jen slabé nálezy za odkazem s počtem; tvrdá pravidla
  se nikdy nepotlačí. Prahy se ladí po malých krocích v pevných mezích.
- **Deterministické:** stejná sbírka a stejné naučené počty = stejné nálezy ve stejném pořadí
  (`TestUceniDeterministicke` platí dál).
- **Výkon:** celá kontrola 5 000 modelek do 120 ms (dnes ≈ 80 ms), učení bez nových knihoven.
- **Bez nových klíčů `ok-…`** a bez změny schématu i exportu.

---

## 1. Postava podle období

### Co to dá

Postava playmate se za 60 let změnila (v 60. letech užší pas a nižší postava, po roce 2000 vyšší a s širším
pasem; `GetVyvojVCase` to ukazuje ve Statistikách). Jeden rozsah pro celou sbírku je proto u starých modelek
příliš volný a u nových zbytečně přísný.

| Modelka | Dnes | Podle období |
|---|---|---|
| 1962, pas 70 cm | v rozsahu sbírky (např. 48–74) – nehlásí se | kolem roku 1962 obvykle 50–66 cm → nález (překlep 70 místo 60?) |
| 2008, výška 180 cm | v rozsahu | v rozsahu (po roce 2000 běžné) |
| 1958, váha 68 kg při výšce 163 | jen možná `ok-bmi` | kombinace nad mezí v dané době → `ok-neobvykle` s textem „kolem roku 1958“ |
| 2015, pas 66 cm | těsně u hranice | v rozsahu, nehlásí se |

### Možnosti

| | A: Desetiletí s přitažením ke sbírce | B: Klouzavé okno podle roku | C: Regrese údaje na rok |
|---|---|---|---|
| Jak | Skupiny po 10 letech; medián a σ skupiny se přitáhnou k celé sbírce podle počtu (empirický Bayes, váha w = n/(n+n₀)) | Pro každý rok r modelky z let r±5 (okno se rozšíří až na ±15, dokud nemá ≥ 40 hodnot), robustní odhad v okně, pak stejné přitažení | Robustní přímka nebo spline mediánu v závislosti na roce (Theil–Sen, kvantilová regrese), kontrola reziduí |
| Přesnost | dobrá, ale skok na hranici (1969 vs. 1970) | dobrá a plynulá; řídká období se samy opřou o sousední roky | dobrá u plynulého trendu, chybuje u zlomu (móda 80. let) a rozptyl musí mít zvláštní model |
| Vysvětlitelnost | „v 60. letech obvykle …“ | „kolem roku 1962 (1957–1967) obvykle …“ | „podle trendu by čekaná hodnota byla …“ – hůř uchopitelné |
| Výkon 5 000 | < 2 ms | 74 let × 7 údajů, řazení v okně < 10 ms (předem seřazené hodnoty po rocích) | Theil–Sen O(n²) ≈ 12 mil. dvojic, desítky ms; spline rychlý, ale složitý |
| Testovatelnost | snadná | snadná (umělá sbírka s trendem) | horší, víc parametrů |
| Schéma | ne | ne | ne |

Neobvyklé kombinace mají vlastní volbu: (i) zvláštní kovariance pro každé období – málo dat, nestabilní
inverze; (ii) **z-skóre vůči období, korelace z celé sbírky** – mění se hlavně střed a rozptyl, vztahy mezi
údaji (výška ↔ váha, pas ↔ boky) zůstávají; (iii) rok jako osmý údaj v Mahalanobisově vzdálenosti – zachytí
jen lineární posun středu, ne rozptyl.

### Doporučení

**B pro rozsahy a (ii) pro kombinace.** B je vlastně neparametrická regrese mediánu na rok (C bez předpokladu
tvaru) a s přitažením nepotřebuje zvláštní ošetření řídkých období. Text nálezu mluví o roce a rozsahu let.

### Data a algoritmy

1. **Rok modelky:** rok z `prvniVydani(m)`; bez měsíčního vydání rok prvního centerfoldu; bez obojího se
   modelka posuzuje vůči celé sbírce (dnešní chování). Rok se počítá jednou v `naucitSe` vedle `priznakyModelky`.
2. **Odhad po rocích** (`naucitObdobi(p priznak, hodnoty []hodnotaRoku)`): hodnoty seřazené podle roku; pro
   každý rok r od nejstaršího do nejnovějšího okno r±h (h = 5, rozšiřovat po 2 letech do 15, dokud n < 40);
   `robustniOdhad` v okně → med_r, sOd_r, sDo_r.
3. **Přitažení k celé sbírce:** w = n/(n + 40); med* = w·med_r + (1−w)·med_g; σ* = w·σ_r + (1−w)·σ_g, a nikdy
   méně než 0,7·σ_g ani než `minSigma` (malé okno nesmí rozsah zúžit na nesmysl). Rozsah = med* ± k·σ*,
   `minPul`, meze `mezOd`/`mezDo`, zaokrouhlení jako v `naucitRozsah`.
4. **Potvrzené hodnoty:** `rozsiritPodlePotvrzenych` pracuje v z-skóre vůči období (potvrzená šestnáctiletá
   z roku 1965 posune hranici i pro rok 1970), `krok` přepočtený na z.
5. **Kombinace:** `modelPostavy.zSkore(j, x)` dostane rok a použije med*/σ* daného roku; `naucitPostavu`
   počítá korelace ze z-skóre vůči období (tím zmizí falešná korelace „vyšší = novější“). Matice `presnost`,
   `mezKombinace` i `podobnaPotvrzene` beze změny.
6. **Věk při prvním vydání** jde stejnou cestou (průměrný věk playmate s lety rostl); dolní mez 18 let zůstává
   pevná pro všechna období.
7. **Pojistka proti záplavě:** nález z rozsahu období se hlásí, jen když je hodnota zároveň aspoň 3σ od
   mediánu celé sbírky nebo mimo rozsah období o víc než 2 jednotky; čísla doladit na skutečné sbírce (1.16.0).

### Uložení

Nic – vše se počítá při kontrole ze sbírky.

### UI

```
Jane Doe · ke kontrole
[ pas 70 cm – kolem roku 1962 (1957–1967) obvykle 50–66 cm, v celé sbírce 48–74 cm ]
[ neobvyklá kombinace údajů: váha 68 kg při výšce 163 cm (kolem roku 1958 obvykle 47–58 kg) ]
```

### Rizika

- Špatný rok: modelka, jejíž první vydání ve sbírce je pozdější retrospektiva nebo české číslo s archivními
  fotkami → porovná se s jinou dobou. Zmírnění: nejstarší vydání ze všech (už dělá `prvniVydani`), pojistka v bodě 7.
- Víc nálezů po aktualizaci (užší rozsahy starých období). Zmírnění: pojistka, měření před vydáním.
- Řídká období (50. léta, po roce 2020): přitažení je vrátí k celé sbírce, rozsah se nezúží.

### Jak otestovat

- `umelaSbirka` dostane volitelný trend (pas 56 + 0,15·(rok−1960), výška 165 + 0,1·(rok−1960)):
  pas 70 cm v roce 1962 se hlásí, v roce 2008 ne; výška 182 cm v roce 2008 ne, v roce 1961 ano.
- Sbírka bez trendu: nálezy stejné jako dnes (`TestUceniCisteSbirky`, `TestNeobvyklaKombinace` beze změny).
- Pět modelek z roku 1955 mezi 200 ostatními: rozsah pro rok 1955 se od celé sbírky liší nejvýš o 2 jednotky.
- `TestUceniRychlost`: 5 000 modelek, přírůstek proti dnešku ≤ 20 ms (benchmark `BenchmarkKontrolaModelek`).
- Skutečná sbírka: nálezů rozsahů a kombinací nejvýš 1,5× víc než před změnou; z 20 nově nahlášených
  je aspoň 14 skutečná chyba (posoudí uživatel).

---

## 2. Míra jistoty a řazení

### Co to dá

Dnes se fronta řadí podle počtu úkolů a nález „výška 17 cm“ stojí na stejné úrovni jako „pas těsně za
hranicí“. S jistotou jdou zjevné překlepy první a slabé nálezy nezdržují.

| Nález | Jistota | Text |
|---|---|---|
| výška 17 cm (z = −25) | 0,99 | skoro jistě překlep |
| datum narození v budoucnosti | 0,97 | skoro jistě chyba |
| podobné jméno 99 % + stejné datum narození | 0,9 | pravděpodobně dvakrát založená |
| pas 66 cm, 4,6 σ | 0,4 | možná chyba |
| neobvyklá kombinace těsně nad mezí | 0,2 | spíš v pořádku – skryté mezi slabými |

### Možnosti

| | A: Pevné stupně podle pravidla | B: Poměr šancí z vzácnosti hodnoty | C: Logistická regrese z rozhodnutí |
|---|---|---|---|
| Jak | Každé pravidlo má stupeň (tvrdé / měkké / slabé) | šance(chyba) = šance(pravidla) × (p₀/p)^β; p = jak vzácná je hodnota u modelu „v pořádku“, p₀ = vzácnost na prahu | Z příznaků (z, počet údajů, druh pravidla) a rozhodnutí uživatele se naučí váhy |
| Přesnost | hrubá, uvnitř pravidla neřadí | dobrá; s učením (3) i kalibrovaná | nejlepší po stovkách rozhodnutí, do té doby žádná |
| Vysvětlitelnost | plná | plná („6 σ od mediánu, pravidlo výška má z rozhodnutí přesnost 85 %“) | slabá (váhy) |
| Výkon | nula | pár operací na nález | nula při kontrole, učení zanedbatelné |
| Testovatelnost | snadná | snadná, monotónní funkce | potřebuje data |
| Schéma | ne | ne | ne |

### Doporučení

**B, pro tvrdá pravidla pevná jistota z A.** C nedává smysl při desítkách rozhodnutí za rok. Šance pravidla
(prior) v B je přesně to, co se v bodě 3 učí z rozhodnutí – obě části do sebe zapadají.

### Data a algoritmy

- `PodezrelyUdaj` dostane `Jistota float64` (`json:"jistota"`, 0–1) a vnitřní `sila` a `otisk` (`json:"-"`);
  funkce `pridat` v `kontrolovatModelky` dostane sílu jako další argument (`pridatSilou`).
- **Vzácnost p podle pravidla:**
  - rozsahy (`ok-vyska`, `ok-vaha`, `ok-bmi`, `ok-miry`, `ok-vek`): z = `zSkore` vůči období (bod 1),
    p = 2·T₅(−|z|) (Studentovo t s 5 stupni – skutečné chvosty jsou těžší než normální), p₀ = 2·T₅(−k);
    u `ok-miry` největší z ze tří obvodů (pas širší než boky = pevně p/p₀ = 20),
  - `ok-neobvykle`: d² z `presnost.vzdalenost` převedené Wilsonovou–Hilfertyho aproximací na normální z
    (opak výpočtu v `mezKombinace`), p₀ odpovídá α = 1e-5,
  - `ok-podobne-jmeno`: místo p rovnou poměr 2^((skóre − prahJmen)/0,01) – každé procento podobnosti
    nad prahem zdvojnásobí šance; skóre z `podobnostModelek` už obsahuje datum narození a vydání,
  - tvrdá pravidla (`ok-narozeni`, `ok-umrti`, `ok-vydani-alba`): pevně 0,97; `ok-jmeno`, `ok-cislo`,
    `ok-dvojice`, `ok-album`, `ok-pmoy`: jen šance pravidla (poměr 1).
- **Šance pravidla:** výchozí přesnost π₀ (rozsahy 0,6, `ok-vek` 0,5, `ok-neobvykle` 0,35, `ok-podobne-jmeno` 0,5,
  `ok-jmeno` 0,6, `ok-cislo` 0,6, `ok-dvojice` 0,7, `ok-album` 0,5, `ok-pmoy` 0,5; doladit v 1.16.0), po bodě 3
  střední hodnota Beta rozdělení z rozhodnutí. β = 0,5 (tlumí přehnanou jistotu daleko v chvostu).
- Jistota oříznutá na 0,02–0,99. Řádek fronty s více nálezy má jistotu nejsilnějšího.
- **Slova:** ≥ 0,9 „skoro jistě překlep“ (u údajů postavy a dat) / „skoro jistě chyba“; 0,65–0,9 „pravděpodobně
  chyba“; 0,35–0,65 „možná chyba“; < 0,35 „spíš v pořádku, ale stojí za pohled“.
- **Slabé nálezy:** pod prahem 0,15 (měkká pravidla) se ve výchozím stavu neukazují ani nepočítají do „Údaje
  ke kontrole“; odkaz „zobrazit i slabé (N)“. Volba se pamatuje v `localStorage` (pohodlí rozhraní).
- **Řazení:** ve filtru Kontrola podle jistoty sestupně; ve „Vše“ dostane řádek „ke kontrole“ váhu
  1 + 4·jistota, takže jistý překlep předběhne modelku, které chybí dva údaje.

### Uložení

Nic v databázi; jistota se počítá při kontrole. Volba „zobrazit i slabé“ v `localStorage`.

### UI

```
Údržba  co doplnit a opravit · 38 úkolů
[Vše 31] [Údaje 14] [Kontrola 9]
Seřazeno podle jistoty chyby · zobrazit i slabé (4) · zobrazit i „netýká se“
┌──────────────────────────────────────────────────────────────────────────┐
│ (o) Jane Doe       [výška 17 cm je mimo obvyklý rozsah sbírky 150–190 cm] │
│     ●●● skoro jistě překlep                             [Opravit]  [⋯]   │
│ (o) Mary Roe       [jméno „Mary Roe“ je skoro stejné jako u Mary Rowe …]  │
│     ●●○ pravděpodobně dvakrát založená                  [Opravit]  [⋯]   │
│ (o) Ann Poe        [pas 66 cm – kolem roku 1964 obvykle 50–65 cm]         │
│     ●○○ možná chyba                                     [Opravit]  [⋯]   │
└──────────────────────────────────────────────────────────────────────────┘
⋯ → V pořádku: pas 66 cm …  |  Proč je to podezřelé?  |  Otevřít profil
```

„Proč je to podezřelé?“ ukáže: hodnotu, rozsah období a sbírky (medián, počet modelek), z nebo podobnost,
jistotu a z čeho vzešla („pravidlo pas: z 12 rozhodnutí 10× opraveno“).

### Rizika

- Číslo budí dojem přesnosti; proto se ukazují slova a tečky, procenta jen v „Proč?“.
- Skrytí slabých může schovat skutečnou chybu → jen měkká pravidla, odkaz s počtem, práh nízký.
- Výchozí π₀ jsou odhad; do prvních rozhodnutí rozhoduje hlavně síla odchylky (to stačí na řazení).

### Jak otestovat

- Umělá sbírka se 40 vloženými překlepy se známou pravdou (chybějící nebo přidaná číslice, prohozené obvody,
  palce místo cm) a 20 skutečně neobvyklými modelkami: plocha pod ROC křivkou jistoty ≥ 0,9; mezi prvními 10
  nálezy aspoň 9 překlepů.
- Jistota je monotónní v z (test tabulkou hodnot) a tvrdá pravidla nikdy neskončí mezi slabými.
- Determinismus: stejné pořadí při pěti bězích.
- Skutečná sbírka: uživatel projde prvních 20 nálezů, aspoň 15 je skutečná chyba.

---

## 3. Učení z oprav i z „V pořádku“

### Co to dá

Dnes se kontrola učí jen z „V pořádku“ a jen lokálně (`rozsiritPodlePotvrzenych`, `podobnaPotvrzene`).
Neví, které pravidlo trefuje: když uživatel 10 z 11 nálezů výšky opraví, mohla by hlásit i menší odchylky;
když 7 z 9 „podobných jmen“ odmítne, měla by být přísnější.

### Možnosti

| | A: Počty jen z `netyka_se` | B: Snímek ukázaných nálezů v `nastaveni` | C: Deník změn údajů **[schéma]** |
|---|---|---|---|
| Jak | Plané poplachy = počet klíčů `ok-…` v `netyka_se`; opravy se nepočítají | Při každé kontrole se porovná s minulým snímkem; zmizelý nález se změněným otiskem údajů = opraveno, s „V pořádku“ = planý | Tabulka změn (kdo, co, kdy), opravy se dohledají přesně |
| Přesnost | jednostranná (zná jen plané poplachy), staré značky z doby před 1.16 zkreslují | dobrá; nejasné případy se nepočítají | nejlepší |
| Vysvětlitelnost | dobrá | dobrá („9 z 10 jsi opravil“) | dobrá |
| Výkon | nula | porovnání pár set nálezů, zápis jen při změně | zápis při každé úpravě |
| Testovatelnost | snadná | čistá funkce nad dvěma snímky | složitá |
| Schéma | ne | ne | ano – a deník změn je v Nedělat |

### Doporučení

**B.** Události (opraveno, v pořádku) se počítají od zavedení 1.16; starší značky v `netyka_se` dál fungují
jako dnes (skrývají a posouvají hranice), do přesnosti se nepočítají.

### Data a algoritmy

1. **Otisk nálezu:** FNV-32 z hodnot, které pravidlo čte: `ok-vyska` výška; `ok-vaha` váha; `ok-bmi` výška
   a váha; `ok-miry` tři obvody a míry; `ok-vek`, `ok-narozeni`, `ok-umrti` data a `prvniVydani`;
   `ok-neobvykle` všechny údaje z `priznakyModelky`; `ok-podobne-jmeno` a `ok-jmeno` jména a další jména
   **obou** modelek a datum narození; `ok-cislo` centerfoldy; `ok-pmoy` role a centerfoldy; nálezy alb název,
   typ, vydání a počet fotek.
2. **Snímek** `kontrola_nalezy` v `nastaveni` (JSON): klíč `modelka|ok-…|album|typ` → `{o: otisk, j: jistota,
   d: datum prvního ukázání}`; jen aktivní nálezy (bez „V pořádku“ a bez slabých).
3. **Porovnání** `porovnatNalezy(minule, ted, modelky)` (čistá funkce) v `GetPrehled` po `kontrolovatSbirku`,
   pod zámkem (dvě souběžná načtení), mimo režim `jenProCteni`:

   | Minule | Teď | Událost |
   |---|---|---|
   | aktivní | klíč je v `netyka_se` | **v pořádku** (planý poplach) |
   | aktivní | chybí, otisk se změnil | **opraveno** (správný nález) |
   | aktivní | chybí, otisk stejný | zmizel sám (posun rozsahů, úprava jiné modelky) – nepočítá se |
   | aktivní | modelka smazaná | u `ok-podobne-jmeno` a `ok-jmeno` opraveno (sloučení), jinak nic |
   | aktivní | aktivní, otisk jiný | nic, jen nový otisk (oprava nestačila) |
   | v pořádku | „Znovu kontrolovat“ | odečte jedno „v pořádku“ |

4. **Hromadné změny:** zmizí-li najednou víc než 15 nálezů se změněným otiskem, nebo proběhl-li od minula
   import či obnovení ze zálohy, porovnání se nepočítá, jen se uloží nový snímek.
5. **Počty** `kontrola_uceni` v `nastaveni` (JSON): pro každý klíč `{opraveno, vPoradku}` a posledních 100
   událostí (datum, klíč, modelka, druh) pro okno „Co se kontrola naučila“.
6. **Přesnost pravidla:** Beta(α₀ + opraveno, β₀ + v pořádku), α₀ = 4·π₀, β₀ = 4·(1−π₀) (π₀ z bodu 2);
   střední hodnota = šance pravidla v jistotě.
7. **Ladění prahů** (odvozuje se z počtů při každé kontrole, nic dalšího se neukládá): jen s aspoň 10 událostmi
   pravidla; dolní hranice 90% intervalu přesnosti > 0,75 → práh o krok mírnější (hlásí víc), horní hranice
   < 0,3 → o krok přísnější; každých dalších 10 událostí nejvýš jeden další krok.

   | Pravidlo | Dnes | Krok | Meze |
   |---|---|---|---|
   | rozsahy postavy a věku | k = 4,5 | 0,25 | 4,0–6,0 |
   | `ok-neobvykle` | α = 1e-5 | ×10 | 1e-4–1e-7 |
   | `ok-podobne-jmeno` | 0,95 | 0,01 | 0,93–0,98 |
   | tvrdá pravidla, `ok-cislo`, `ok-dvojice`, `ok-album`, `ok-jmeno` | – | neladí se | – |

   Parametry jdou do `naucitSe`/`kontrolovatModelky` jako struktura `ladeniKontroly` (výchozí = dnešní
   konstanty), takže testy volají čistou funkci.
8. **Oprava `ok-miry` (zpřesnění učení):** dnes „V pořádku“ potvrdí všechny tři obvody, i ty, které v rozsahu
   byly. Nově se za potvrzené berou jen obvody mimo rozsah spočítaný bez potvrzených hodnot – bez nového klíče.

### Uložení

`nastaveni`: `kontrola_nalezy` (snímek, při 300 nálezech ≈ 20 kB), `kontrola_uceni` (počty a události,
< 10 kB). Bez změny schématu i exportu; v zálohách ano. Po importu do nové databáze se učí znovu
(výchozí π₀). „Zapomenout naučené“ oba klíče smaže; značky „V pořádku“ zůstávají.

### UI

```
Kontrola se naučila (z 46 tvých rozhodnutí)                         [Podrobnosti…]
 · výška a váha: 11 z 12 nálezů jsi opravil → hlásí i menší odchylky (4,0 σ místo 4,5 σ)
 · podobná jména: 7 z 9 bylo v pořádku → hlásí až od podobnosti 97 %
```

Řádek je nad frontou jen ve filtru Kontrola a jen když se něco změnilo; zavírá se ×. Podrobnosti
(⋯ → Kontrola údajů…):

```
Pravidlo            Nálezů  Opraveno  V pořádku  Přesnost  Nastavení
Výška                   12        11          1     85 %   4,0 σ (výchozí 4,5)
Podobná jména            9         2          7     30 %   97 % (výchozí 95)
Neobvyklá kombinace      3         1          2      –     výchozí (málo rozhodnutí)
Naposledy: 22. 11. opraveno – Jane Doe, výška 17 → 170 cm
                                        [Zapomenout naučené]  [Zavřít]
```

### Rizika

- **Falešné „opraveno“:** úprava údaje z jiného důvodu (doplnění váhy u modelky s nálezem BMI). Otisk čte
  jen údaje pravidla a nález musí zmizet; zbytek šumu tlumí prior a minimum 10 událostí.
- **Zpětná vazba:** mírnější práh → víc nálezů → víc „V pořádku“ → přísnější práh. Kroky jsou malé, meze
  pevné, každých 10 událostí nejvýš krok – kmitání se zastaví nejpozději na mezi.
- **Záplava po zmírnění:** zmírnění o krok smí přidat nejvýš 20 % nálezů pravidla, jinak se neprovede.
- `GetPrehled` je v `CTENI` (neohlašuje změnu dat) a zápis do `nastaveni` změnu ohlásit nesmí – je to tak správně.

### Jak otestovat

- `porovnatNalezy`: tabulka případů výše jako tabulkový test (oprava, V pořádku, posun rozsahu, smazaná
  modelka, hromadný import, Znovu kontrolovat).
- Simulace: umělá sbírka s 40 překlepy a 20 skutečnými odlehlými hodnotami; „uživatel“ opravuje překlepy
  a skutečné označí „V pořádku“. Po 30 rozhodnutích: k výšky klesne, práh jmen u sbírky s mnoha podobnými
  pravými jmény stoupne, žádný parametr mimo meze, výsledek deterministický.
- Kalibrace: v pásmech jistoty s ≥ 20 rozhodnutími se podíl oprav liší od průměrné jistoty nejvýš o 0,15.
- „Zapomenout naučené“ vrátí přesně dnešní nálezy (porovnání s během bez `nastaveni`).
- Databáze otevřená jen pro čtení: kontrola proběhne, nic se nezapíše.

---

## 4. Další možná zlepšení (volitelné)

| # | Co | Co to dá | Jak | Prac. |
|---|---|---|---|---|
| a | **Návrh opravy** | „výška 17 cm → 170?“ jedním klikem s Vrátit; jistota ×5, když vzor vysvětlí hodnotu | Vzory: chybějící nebo přidaná číslice (17, 1700), prohozené číslice (107 → 170), desetinná čárka (1,70), palce a libry z importu (34-24-36, 115 lbs; převod jako `format.js`), prohozený pas a boky, měsíc a den v datu; kandidát musí padnout do rozsahu období | M |
| b | **Jména podle období** | Méně planých „podobných jmen“ u modelek 30 let od sebe | `podobnostModelek`: první vydání víc než 15 let od sebe a bez data narození −0,03, stejné desetiletí +0,02 | S |
| c | **Věk v kombinacích** | – | Už je: `prVek` je v `priznakyModelky` a v Mahalanobisově vzdálenosti; období (bod 1) je ten chybějící rozměr | – |
| d | **Mezipaměť učení** | Přehled se po „V pořádku“ načte rychleji | Výsledek `naucitSe` si pamatovat do další změny dat (počítadlo zápisů); `postavaMimoRozsahy` bez skládání textů | S |
| e | **Měření na skutečné sbírce** | Čísla pro π₀, pojistku a „Hotovo, když“ | Test spouštěný jen s proměnnou `PLAYBOY_DB` (kopie databáze): počty nálezů po pravidlech a obdobích před a po změně, nic se nezapisuje | S |
| f | Nová pravidla z 1.6 | Jednotné řazení | Fotograf zapsaný různě a cover bez modelky dostanou π₀ a sílu (skóre podobnosti) | S |

Nedoporučuji: zvláštní kovarianci pro každé období, knihovny strojového učení, nové klíče `ok-…`
(např. zvlášť `ok-pas`) – starší program by je při importu potichu zahodil.

---

## Cesta vývoje

Každá verze je 1–3 dny práce, 2–4 kroky, funguje sama o sobě a projde všemi testy; každý krok vychází jako
PATCH. 1.16 nezávisí na 1.7–1.15 a rozšiřuje 1.6 Kvalita dat: **jde ji vzít hned po 1.6** (ROADMAP: pořadí
verzí jde změnit; pak dostane číslo podle pořadí vydání). Z 1.6 je vhodné převzít jen nová pravidla do
jistoty (4f); závislost to není.

| Verze | Obsah | Prac. | Závisí na | [schéma]? |
|---|---|---|---|---|
| 1.16.0 | Postava podle období: měření na kopii sbírky (4e), odhad po rocích s přitažením, z-skóre kombinací vůči období, text „kolem roku …“ | M–L | – | ne |
| 1.16.1 | Jistota a řazení: `Jistota` v nálezu, slova a tečky, řazení Kontroly a váha ve „Vše“, slabé nálezy za odkazem, „Proč je to podezřelé?“ | M | 1.16.0 (z vůči období; jde i bez) | ne |
| 1.16.2 | Pamatování nálezů: otisk, snímek a porovnání v `GetPrehled`, počty v `nastaveni`, okno „Kontrola údajů…“ jen s čísly, oprava `ok-miry` | M | 1.16.1 | ne |
| 1.16.3 | Učení z rozhodnutí: Beta přesnost jako šance pravidla, ladění prahů v mezích, řádek „Kontrola se naučila“, Zapomenout naučené | M | 1.16.2 | ne |
| 1.16.4 | Volitelně: návrh opravy (4a), jména podle období (4b), mezipaměť učení (4d) | M | 1.16.1 | ne |

**Hotovo, když:**

- 1.16.0 – pas 70 cm v roce 1962 se hlásí a v roce 2008 ne; sbírka bez trendu má stejné nálezy jako dřív;
  na skutečné sbírce nejvýš 1,5× víc nálezů a z 20 nových aspoň 14 skutečných chyb; 5 000 modelek ≤ 100 ms.
- 1.16.1 – ROC ≥ 0,9 na umělé sbírce s překlepy; tvrdá pravidla nikdy mezi slabými; z prvních 20 nálezů
  skutečné sbírky aspoň 15 skutečná chyba.
- 1.16.2 – oprava údaje se započítá jako „opraveno“, „V pořádku“ jako planý poplach, posun rozsahu ani import
  se nepočítá (tabulkový test); databáze jen pro čtení se nezmění.
- 1.16.3 – simulace po 30 rozhodnutích posune prahy správným směrem a nikdy za meze; „Zapomenout naučené“
  vrátí výchozí nálezy; schéma zůstává na úpravě č. 11 (č. 12 po 1.6) a export na verzi 7 (8 po 1.6).
- 1.16.4 – „výška 17 cm“ nabídne 170 cm a Vrátit; u 20 vzorových překlepů je návrh správný aspoň v 18.

### Sekce k vložení do ROADMAP.md

```markdown
### 1.16 – Kontrola 2.0

**Cíl:** kontrola v Údržbě porovnává modelky se stejnou dobou, řadí nálezy podle jistoty chyby a učí se
z oprav i z „V pořádku“. **Bez změny schématu i exportu** – naučené počty jsou v tabulce `nastaveni`.
Každý krok vyjde jako samostatná verze (1.16.0–1.16.4). Rozbor možností: [NAVRH-KONTROLA2.md](docs/NAVRH-KONTROLA2.md).
Rozšiřuje 1.6 a nezávisí na 1.7–1.15, takže jde vzít hned po 1.6.

**Rozhodnutí:** klouzavé okno ±5 let podle prvního vydání přitažené k celé sbírce (ne desetiletí ani regrese);
jistota = šance pravidla × vzácnost hodnoty (ne naučený klasifikátor); opravy se poznají ze snímku ukázaných
nálezů v `nastaveni` (ne deník změn); prahy se ladí po malých krocích v pevných mezích, tvrdá pravidla nikdy.

| # | Co | Jak | Prac. |
|---|---|---|---|
| 1 | Postava podle období | Měření na kopii sbírky; medián a σ po rocích (okno ±5 až ±15 let, ≥ 40 hodnot), přitažení k celé sbírce w = n/(n+40), z-skóre kombinací vůči období s korelací z celé sbírky; text „kolem roku 1962 obvykle …“ | M–L |
| 2 | Jistota a řazení | `Jistota` v nálezu z vzácnosti hodnoty (t-rozdělení, χ², podobnost jmen) a přesnosti pravidla; „skoro jistě překlep“ / „možná chyba“; Kontrola řazená podle jistoty; slabé nálezy za odkazem; „Proč je to podezřelé?“ v ⋯ | M |
| 3 | Pamatování nálezů | Otisk údajů nálezu, snímek v `nastaveni`, porovnání v `GetPrehled`: zmizelý nález se změněným údajem = opraveno, „V pořádku“ = planý poplach, hromadné změny se nepočítají; okno ⋯ → Kontrola údajů… | M |
| 4 | Učení z rozhodnutí | Přesnost pravidla (Beta), ladění k (4,0–6,0), α kombinací a prahu jmen (0,93–0,98) po krocích; řádek „Kontrola se naučila: …“, Zapomenout naučené | M |
| 5 | Návrh opravy (volitelně) | Vzory překlepů (chybějící číslice, prohozené číslice, palce, libry, prohozené obvody) s kandidátem v rozsahu období, oprava jedním klikem s Vrátit; jména podle období | M |

**Nedělá se:** nové klíče `ok-…`, deník změn, knihovny strojového učení, skrývání tvrdých pravidel.

**Hotovo, když:** pas 70 cm v roce 1962 se hlásí a v roce 2008 ne; z prvních 20 nálezů skutečné sbírky je
aspoň 15 skutečná chyba; oprava se započítá jako „opraveno“ a import ne; po 30 simulovaných rozhodnutích
jsou prahy v mezích a „Zapomenout naučené“ vrátí výchozí stav; kontrola 5 000 modelek do 120 ms; schéma
ani export se nemění.
```

Řádek do tabulky verzí:

```
| 1.16 | Kontrola 2.0 – postava podle období, jistota a řazení nálezů, učení z oprav i „V pořádku“ | – (rozšiřuje 1.6, jde hned po ní) |
```
