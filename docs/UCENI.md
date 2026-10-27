# Strojové učení v Údržbě

Údržba se učí ze dvou věcí: ze **sbírky samotné** (co je vyplněné u ostatních modelek) a z **rozhodnutí
uživatele** (co přijal, odmítl, opravil nebo označil „V pořádku“). Z toho vznikají dvě služby:

- **Návrhy doplnění** chybějících údajů (`navrhy.go`) s jistotou, zdrojem a českým důvodem;
- **Kontrola** údajů, které vypadají jako překlep (`kontrola.go`, `kontrola_uceni.go`).

Vše běží na počítači bez sítě a bez knihoven, deterministicky (stejná data = stejné výsledky ve stejném pořadí).
Učení samo schéma sbírky nemění (hodnocení po polovinách srdíčka je úprava č. 13 sbírky, viz Oblíbenost níže).
Nic se nezapisuje do sbírky samo, jen po přijetí návrhu.

Třetí služba je **oblíbenost** (`oblibenost.go`, `oblibenost_fotky.go`, oddíly na konci): porovnání dvojic „Která se
ti líbí víc?“ s náhledy fotek z alb, skóre fotek modelky z hodnocení jejích alb, jemné pořadí modelek (Bradley–Terry
s předpokladem ze srdíček a skóre fotek, váha fotek naučená z porovnání) a model vkusu, který odhaduje hodnocení
nehodnocených modelek.

| Soubor | Co v něm je |
|---|---|
| `uceni_modely.go` | sdílené statistické nástroje: klíč textu, Jaro–Winkler, naučené sjednocení zápisů, podíl s předpokladem (Beta), log-šance a spojení zdrojů, četnosti při podmínce, profil postavy, robustní odhad, Choleského inverze, regrese s ověřením vynecháním jedné, k nejbližších sousedů |
| `navrhy.go` | zdroje návrhů, výběr a spojení zdrojů, přijetí a odmítnutí |
| `kontrola.go`, `kontrola_uceni.go` | pravidla kontroly, naučené rozsahy, neobvyklé kombinace, podobná jména, prahy |
| `uceni.go` | databáze učení: deník rozhodnutí, odmítnuté hodnoty, zápisy z oprav, kalibrace, prahy kontroly, mezipaměť, přehled a zapomenutí |
| `oblibenost.go` | porovnání dvojic, Bradley–Terry s předpokladem ze srdíček a skóre fotek, výběr dvojic (aktivní učení) |
| `oblibenost_vkus.go`, `oblibenost_vkus_stromy.go` | model vkusu: údaje modelek, hřebenová regrese a posilované stromy, ověření, skupiny podle bohatosti údajů, důvody, „Mohlo by se ti líbit“ |
| `oblibenost_fotky.go` | skóre fotek (album jako hlas, průměr nejlepších fotek, empirický Bayes), převod na stupnici srdíček, naučená váha fotek, náhledy alb pro porovnání |

## Soukromí a kde co je

- **Nic neopouští počítač.** Učení nepoužívá síť ani žádnou službu.
- **Sbírka** (`playboy.db` ve složce dat programu, na Linuxu `~/.local/share/playboy-app/`) obsahuje jen to, co
  obsahovala dřív: označení „V pořádku“ (`ok-…`) a odmítnuté návrhy (`nv-<pole>`) v „netýká se“ modelky
  nebo alba. Ta jdou do exportu i záloh jako dosud.
- **Databáze učení** je samostatný soubor vedle sbírky: `playboy-uceni.db` (název se odvodí z cesty sbírky,
  `…/playboy.db` → `…/playboy-uceni.db`). Má vlastní číslo schématu (`PRAGMA user_version`, úpravy
  `migraceUceni` v `uceni.go`) nezávislé na zmrazeném schématu sbírky. Vznikne sama při prvním použití
  (otevření Přehledu, Údržby, návrhů). Obsah:

| Tabulka | Co obsahuje |
|---|---|
| `udalosti` | deník: čas, druh (`prijato`, `odmitnuto`, `zpet`, `opraveno`, `v-poradku`, `znovu`, `nalez-opraveny`), modelka, album a typ, pole (u kontroly klíč `ok-…`), navržená a výsledná hodnota, zdroj (u spojených návrhů `misto+edice`), jistota zobrazená a jistota vzorce |
| `odmitnute` | odmítnuté hodnoty: modelka, album, typ, pole, klíč hodnoty (`*` = celý údaj), zápis, čas |
| `zapisy` | zápisy, na které uživatel návrh opravil (jen jiný tvar téže hodnoty) |
| `mezipamet` | poslední návrhy a nálezy s otiskem sbírky (JSON) |
| `stav` | čas posledního otevření (zkouška zápisu) |
| `porovnani` | (úprava č. 2) porovnání dvojic: čas, modelky `a` a `b`, `vysledek` (`a`, `b`, `remiza`), srdíčka obou v tu chvíli (`hodnoceni_a`, `hodnoceni_b`, po polovinách) |
| `zajem` | (úprava č. 3) zájem o modelky: čas, modelka, `druh` (`profil` = otevření profilu, `fotky` = prohlížení jejích fotek) a `sekund` prohlížení; starší dvou let se maže |
| `historie_oblibenosti` | (úprava č. 3) denní snímky oblíbenosti: `den`, modelka, `oblibenost`, `poradi`; po 60 dnech jen pondělní, po 400 dnech nic |

- **Zapomenout** (`ZapomenoutUceni`): databáze učení se nejdřív zazálohuje do složky záloh jako
  `uceni-RRRR-MM-DD-HHMMSS.mmm.db` (zůstává posledních 5; mezi zálohami sbírky se neukazují) a pak vyprázdní.
  Zapomene se jen naučené z rozhodnutí Údržby; sbírka se nemění. **Porovnání dvojic zůstanou** – jsou to
  výslovné soudy uživatele jako srdíčka, ne naučené z návrhů; smaže je zvlášť `ZapomenoutPorovnani` (se stejnou
  zálohou), a s nimi i zájem a historii oblíbenosti. Smazání souboru `playboy-uceni.db` zapomene obojí. Klíče
  `nv-…` ve sbírce zůstanou a bez záznamu v databázi učení znamenají odmítnutí celého údaje (jako ve starších
  verzích).
- **Když databáze učení nejde použít**, program funguje dál a sbírky se to nikdy netýká (varování jde do
  konzole): poškozený soubor se odloží jako `playboy-uceni.db.poskozena-…` a učení začne znovu; soubor jen pro
  čtení se načte do paměti (naučené platí, nová rozhodnutí do zavření programu); soubor z novější verze programu
  se nečte ani nemění a učení běží v paměti prázdné. Sbírka v paměti (nepodařené otevření) má učení také v paměti.

## Rozhraní

| Volání | Co dělá |
|---|---|
| `GetNavrhyDoplneni(vcetneOdmitnutych) []NavrhDoplneni` | návrhy seřazené od nejvyšší jistoty; odmítnuté jen na požádání (s `odmitnuto: true`) |
| `PrijmoutNavrh(n) bool` | zapíše hodnotu v transakci, **jen když je údaj stále prázdný**; přijetí se zapíše do deníku |
| `PrijmoutNavrhy(n []) int` | hromadně: záloha `pred-prijetim-navrhu`, jedna transakce, vrací počet zapsaných |
| `OdmitnoutNavrh(n, odmitnout) bool` | odmítne **navrženou hodnotu** (`n.hodnota`) – jiná hodnota téhož údaje se navrhnout může; ve sbírce zapíše i `nv-<pole>`; zrušení odmítnutí klíč smaže, až u údaje nezbude žádná odmítnutá hodnota. Bez hodnoty odmítá celý údaj |
| `ZaznamenatOpravu(modelkaId, pole, puvodniNavrh, novaHodnota) bool` | rozhraní volá, když uživatel navrženou hodnotu před uložením upravil |
| `GetStavUceni() StavUceni` | soubor, velikost, počty událostí (přijato, odmítnuto, opraveno), poslední událost a přehled zdrojů |
| `ZapomenoutUceni() bool` | záloha a vyprázdnění databáze učení (bez porovnání dvojic) |
| `SetNetykaSe`, `SetNetykaSeAlba` | „V pořádku“ / „Znovu kontrolovat“ u nálezu se navíc zapíše do deníku se zdrojem pravidla |
| `Prehled.navrhu`, `Prehled.podezrele` | počet neodmítnutých návrhů a nálezy kontroly |

`NavrhDoplneni`: `modelkaId`, `jmeno`, `album` + `typ` (jen u alba), `pole`, `popis`, `hodnota` (přesně v tvaru,
v jakém se uloží), `jistota` (0–1, po kalibraci), `duvod`, `klic` (`nv-<pole>`), `inputId`, `odmitnuto`,
`zdroj` (stabilní klíč nejsilnějšího zdroje) a `zdrojPopis` (česky všechny zdroje hodnoty, např.
„místo narození + edice“).

`PodezrelyUdaj` má navíc `zdroj`: stabilní klíč pravidla (viz níže); klíč `ok-…` se nemění.

`StavUceni`: `soubor` (prázdný = jen v paměti), `velikost`, `udalosti`, `prijato`, `odmitnuto`, `opraveno`,
`naposledy`, `porovnani` (počet porovnání dvojic), `zdroje` – pro každý zdroj `zdroj`, `popis`, `navrhu` (současné neodmítnuté návrhy, které zdroj
podporuje), `prijato`, `odmitnuto`, `presnost` (kalibrovaná úspěšnost 0–1) a `aktivni` (i nejsilnější návrh
zdroje ještě projde prahem).

Údaje (`pole` → `inputId`): `narodnost` → `inputNarodnost`, `etnicita` → `inputEtnicita`, `vlasyBarva` →
`inputVlasy`, `ociBarva` → `inputOci`, `velikostPrsou` → `inputVelikost`, `obvodHrudnikCm` / `obvodPasCm` /
`obvodBokyCm` → `inputHrudnik` / `inputPas` / `inputBoky`, `role` → `inputRole`; u alba `vydaniAlba`,
`fotografAlba`, `datumAlba`. Obvody se zapíšou jen v rozumných mezích a se všemi třemi obvody se složí i míry;
kategorie (`role`) se k zapsaným **přidá**; vydání alba jen u pictorialu časopisu, datum jen u online alba.

## Zdroje návrhů

| Zdroj (`zdroj`) | Popis | Údaj | Jak | Jistota zdroje |
|---|---|---|---|---|
| `misto` | místo narození | národnost | naučené ze sbírky (část místa → národnost) + tabulka zemí (státy USA a zkratky „TX“, provincie, města, české i anglické názvy, překlep přes Jaro–Winkler ≥ 0,94) | Laplace (k + 1)/(n + 2), tabulka váží jako 8 modelek; národnost, kterou sbírka nemá, × 0,8 |
| `edice` | edice | národnost | modelka jen v číslech jedné edice → nejčastější národnost takových modelek | Laplace, aspoň 5 modelek, práh 0,8 |
| `cetnost` | četnost ve sbírce | etnicita, vlasy, oči | etnicita podle národnosti; vlasy a oči podle etnicity + národnosti, jinak jen jedné (nejkonkrétnější podmínka s dost modelkami) | Laplace, 8 / 10 / 15 modelek, práh 0,85, strop 0,9 |
| `miry` | míry | obvody, velikost prsou | text „míry“ v cm nebo palcích, košíček (34C) → velikost v tvaru sbírky | cm 0,97, palce 0,9, velikost 0,95 (převod 0,8) |
| `regrese` | odhad z postavy | obvody | robustní lineární regrese z výšky, váhy a ostatních obvodů (aspoň dvou) | podíl trefy ±1 cm ověřený vynecháním jedné, strop 0,6; jen když ±2 cm sedí u 60 % |
| `podobne` | podobné modelky | obvody | k = 12 nejpodobnějších modelek (standardizované údaje postavy), vážený medián a rozptyl | trefa ±1 cm ověřená vynecháním jedné **pro stejnou kombinaci známých údajů**, snížená, když se sousedé shodují hůř než obvykle; strop 0,6 |
| `text` | poznámka | kategorie | „Playmate of the Year 1998“, „PMOY 1998“ v poznámce, tagách, vystoupení nebo názvu alba; rok musí sedět k centerfoldu | 0,92, bez centerfoldu 0,75 |
| `nazev` | název alba | vydání, datum alba | datum v názvu (červen 1995, June 1995, 06/1995, 2004-06-14…) | (k + p·w)/(n + w): předpoklad 0,85, váha 6, upřesněný sbírkou |
| `centerfold` | centerfold | vydání alba | jediný pictorial bez vydání → číslo jediného centerfoldu | předpoklad 0,75, váha 4 |
| `cislo` | fotograf čísla | fotograf alba | jiné album modelky ze stejného čísla | předpoklad 0,8, váha 4 |
| `modelka` | fotograf modelky | fotograf alba | všechna ostatní alba modelky (aspoň 2) má jeden fotograf | předpoklad 0,5, váha 2 |

Zdroje téže **rodiny** vycházejí ze stejných údajů a jako nezávislé se nespojují (`regrese` a `podobne` jsou
rodina „odhad“, `cislo` a `modelka` rodina „fotograf“).

**Zápis hodnot:** hodnoty se seskupí podle klíče (malá písmena bez diakritiky a teček; národnost přes tabulku
zemí, takže „USA“ = „Americká“) a navrhne se nejčastější zápis sbírky. **Naučené sjednocení zápisů**
(`slovnikHodnot`): vzácná varianta s překlepem se počítá k převládajícímu tvaru, když je jí podobná
(Jaro–Winkler ≥ 0,94), převládající tvar je aspoň 3× častější a kandidát je jediný („Phillipines“ 1× →
„Philippines“ 12×). Když uživatel návrh opravil jen na jiný zápis téže hodnoty (`ZaznamenatOpravu`), má jeho
zápis přednost u dalších návrhů.

## Jistota

Jistota je odhad pravděpodobnosti, že je hodnota správně. Vzniká ve čtyřech krocích:

1. **Zdroj sám** (tabulka výše). Četnosti: (k + 1)/(n + 2) (Laplaceovo pravidlo; jedna shodná modelka dá 0,67
   a neprojde). Pravidla: (k + p·w)/(n + w) – střední hodnota Beta rozdělení s předpokladem p o váze w;
   pravidlo se nejdřív vyzkouší na údajích, které vyplněné jsou, takže velká sbírka dostane svou skutečnou
   úspěšnost. Odhady obvodů: poctivé ověření vynecháním jedné modelky.
2. **Odmítnuté podobné návrhy** ve sbírce (stejný údaj, zdroj a u četností i hodnota): × 6/(6 + d). U zdrojů bez
   hodnoty ve vzoru se to při existující kalibraci nepočítá (byla by to tatáž informace dvakrát).
3. **Kalibrace** podle rozhodnutí uživatele (níže).
4. **Spojení zdrojů** téhož údaje naivním Bayesem v log-šancích:

   logit q = logit p₁ + Σ ρ·(logit pᵢ − logit π)

   p₁ je nejsilnější zdroj hodnoty, π předpoklad hodnoty bez zdrojů (podíl ve sbírce s vyhlazením
   (k + 1)/(n + K + 1)), ρ = 0,5 tlumí závislost zdrojů. Zdroj **jiné** hodnoty působí proti: hodnotě dává
   q = (1 − p)·π/(1 − π_jiné), tedy zbytek své jistoty rozdělený podle předpokladů. Jediný zdroj dá q = p₁;
   zdroj, který nic nového neříká (jeho hodnota má stejnou jistotu jako předpoklad), jistotu nezmění. Shodné
   odhady obvodů (`regrese` a `podobne` do ±1 cm) se spojí s ρ = 0,25 a stropem 0,6; liší-li se o 3 cm a víc,
   odhad se nenavrhuje.

**Prahy:** návrh pod 0,7 se nenabízí (odhady obvodů se ukazují od 0,3 jako „odhad“ a nikdy nepůsobí jistě);
strop 0,99. **Spor:** prošly-li by dvě různé neodmítnuté hodnoty (obě ≥ 0,63), údaj se nenavrhuje. Odmítnutá
hodnota se při zobrazení odmítnutých vrací vždy, aby šlo odmítnutí zrušit. Důvod návrhu jmenuje všechny zdroje
(„; zároveň …“), odmítnuté podobné návrhy a posun kalibrací („podle dosavadních rozhodnutí upraveno z 90 % na 76 %“).

Doporučení pro rozhraní: ≥ 0,9 „skoro jistě“ (lze nabídnout „Přijmout vše“), 0,7–0,9 „pravděpodobně“,
odhady obvodů zvlášť jako „odhad“ (nikdy hromadně).

## Kalibrace zdrojů

Každý zdroj slibuje jistotu p. Z deníku se pro zdroj sečte n rozhodnutí, z nich k přijatých, a průměrná
slíbená jistota p̄ (jistota vzorce v okamžiku návrhu, ne zobrazená – jinak by se kalibrace honila sama za sebou).
Každé rozhodnutí váží podle stáří 0,5^(dny/365). Skutečná úspěšnost je střední hodnota Beta rozdělení
s předpokladem, že vzorec má pravdu:

r = (k + w·p̄)/(n + w), w = 8

a jistota každého návrhu zdroje se posune v log-šancích: logit p' = logit p + (logit r − logit p̄).

- Málo rozhodnutí → r ≈ p̄ → posun ≈ 0. Bez rozhodnutí se jistota nemění vůbec.
- Zdroj, jehož návrhy uživatel stále odmítá, klesne pod práh a přestane se nabízet sám (`aktivni: false`);
  přijímaný zdroj jistotu získá. Posun zachová pořadí návrhů zdroje.
- O jednom návrhu platí poslední rozhodnutí; zrušené odmítnutí se nepočítá. Oprava jen zápisu je přijetí,
  oprava na jinou hodnotu odmítnutí. Návrh z více zdrojů se započítá každému z nich.
- Izotonická kalibrace po intervalech jistoty by potřebovala stovky rozhodnutí na zdroj; tolik jich sbírka
  stovek modelek nemá, proto jediný posun na zdroj.

## Kontrola

Pravidla a jejich zdroje (`PodezrelyUdaj.zdroj`):

| Klíč | Zdroje (pravidla) |
|---|---|
| `ok-jmeno` | `jmeno` – stejné jméno nebo pseudonym u dvou modelek |
| `ok-podobne-jmeno` | `podobne-jmeno` – skoro stejné jméno (Jaro–Winkler s trigramovým předvýběrem, upravené datem narození, prvním vydáním a centerfoldy) |
| `ok-narozeni` | `narozeni-budoucnost`, `narozeni-pred-1900`, `narozeni-po-vydani` |
| `ok-vek` | `vek` – věk při prvním vydání mimo rozsah |
| `ok-umrti` | `umrti-budoucnost`, `umrti-pred-narozenim`, `umrti-pred-vydanim` |
| `ok-vyska`, `ok-vaha`, `ok-bmi` | `vyska`, `vaha`, `bmi` – mimo rozsah |
| `ok-miry` | `miry` (obvod mimo rozsah), `miry-pas` (pas není užší než hrudník a boky) |
| `ok-neobvykle` | `neobvykle` – neobvyklá kombinace údajů postavy |
| `ok-pmoy` | `pmoy-bez-centerfoldu`, `pmoy-rok` |
| `ok-cislo`, `ok-dvojice` | `cislo` (dva centerfoldy v jednom čísle), `dvojice` (stejná fotka ve dvou albech) |
| `ok-album`, `ok-vydani-alba` | `album` (jedna fotka a podobný název), `vydani-alba` (vydání mimo roky časopisu) |

Co se kontrola učí ze sbírky:

1. **Rozsahy** výšky, váhy, BMI, obvodů a věku: medián ± k·σ (k = 4,5; σ zvlášť pod a nad mediánem z kvartilů,
   obdoba MAD), když je hodnot aspoň 30; jinak pevné meze. Nikdy za rozumné meze a aspoň minimální šířka.
2. **Neobvyklé kombinace**: Mahalanobisova vzdálenost standardizovaných údajů od středu sbírky (kovariance po
   dvojicích bez odlehlých modelek, smrštěná k diagonále) nad kvantilem χ² pro α = 1e-5.
3. **Podobná jména** s podporou dalších údajů.

Co se učí z rozhodnutí:

- **„V pořádku“ posune hranici:** leží-li aspoň 3 potvrzené hodnoty souvisle za hranicí rozsahu, hranice se
  k nim posune; neobvyklá kombinace podobná potvrzené se nehlásí. (Čte se z klíčů `ok-…` ve sbírce, funguje
  i bez databáze učení.)
- **Přesnost pravidla a prahy** (z databáze učení): nález, který zmizel, protože uživatel změnil údaje modelky
  (a ne označením „V pořádku“), se zapíše jako `nalez-opraveny` – byl to skutečný překlep. „V pořádku“ je planý
  poplach. Přesnost pravidla = (opraveno + 4)/(opraveno + V pořádku + 6), předpoklad dvě třetiny skutečných
  chyb. Klesne-li pod 0,5, pravidlo se zpřísní úměrně t = (0,5 − přesnost)/0,5: rozsah o až 1,5 σ (jen pro
  údaje toho pravidla), mez neobvyklé kombinace o až 0,75 v kvantilu N(0,1), práh podobnosti jmen o až 0,03.
  Prahy se jen zpřísňují – kontrola raději mlčí, než aby hlásila zbytečně.
  Změnu údajů modelky pozná otisk jen těch údajů, se kterými kontrola pracuje (srdíčka, titulní fotka, tagy ani
  poznámka se nepočítají). Po obnovení sbírky ze zálohy se zmizelé nálezy za opravené nepovažují (data vrátila
  záloha, ne uživatel); porovnává se až od dalšího výpočtu.

## Mezipaměť a výkon

Návrhy i nálezy se ukládají (v paměti a v tabulce `mezipamet`) s **otiskem sbírky**: FNV-64a ze všech údajů,
ze kterých se počítají (modelky včetně odvozených vydání a „netýká se“, alba včetně počtu fotek a součtu jejich
čísel), z dnešního data, verze výpočtu a čísla poslední události deníku. Jakákoli změna dat nebo nové rozhodnutí
otisk změní, takže jiná invalidace není potřeba. Přehled tak při opakovaném otevření jen načte modelky a alba
(alba jedním dotazem pro seznamy, kontrolu i návrhy), spočítá otisk a vezme hotový výsledek; po spuštění
programu z mezipaměti v souboru.

Po změně dat se kontrola a návrhy počítají souběžně a mezipaměť se do souboru zapisuje na pozadí. Každý z obou
výpočtů ale běží jen jednou najednou: Přehled volá `GetPrehled`, `GetNavrhyDoplneni` a `GetStavUceni` současně
a další volání počká na první a vezme si jeho výsledek, místo aby totéž počítalo potřetí.

Umělá sbírka 3000 modelek (`TestVykonUceni`, `go test -run TestVykonUceni -v`): `GetPrehled` dřív asi 500 ms
při každém otevření; nyní asi 150 ms při opakovaném otevření (z toho asi 90 ms načtení modelek), asi 420 ms po
změně dat (včetně odhadu podle sousedů, který dřív nebyl) a asi 300 ms po spuštění programu z mezipaměti v souboru.

## Omezení

- Místo narození nerozhoduje o národnosti (narozené na americké základně v Německu); tabulku přehlasuje sbírka,
  jakmile má z místa pár modelek. Gruzie/Georgia a Československo/SSSR v tabulce nejsou (nejednoznačné).
- Místo narození, datum narození a další údaje bez opory ve sbírce se nenavrhují vůbec.
- Tvar velikosti prsou se pozná jen u tvaru „číslo + košíček“ nebo „košíček“; jiné zápisy se nepřevádějí.
- Odmítnutí jedné hodnoty zná jen databáze učení: na jiném počítači (po importu) nebo po zapomenutí znamená
  klíč `nv-<pole>` odmítnutí celého údaje.
- Kalibrace i prahy kontroly potřebují rozhodnutí; u nové sbírky platí vzorce beze změny.

## Oblíbenost

Hodnocení modelky je od úpravy schématu č. 13 po **polovinách srdíčka** (0,5–5; 0 = nehodnoceno). Sbírka má nový
sloupec `modelky.hodnoceni_pul` (počet polovin 0–10), ze kterého program čte; do dosavadního `hodnoceni` dál
zapisuje celá srdíčka zaokrouhlená dolů, takže starší program databázi otevře jen pro čtení a 3½ ukáže jako 3.
Spouštěče drží oba sloupce v souladu. Fotky mají srdíčka dál celá. Export verze 9 zapisuje `hodnoceni: 3.5`
(celá bez `.0`), import přijme verze 1–9, celá i poloviny (i `3,5`) a jiné hodnoty odmítne s hláškou.

Srdíčka jsou hrubá: modelek se čtyřmi srdíčky bývají desítky. Jemné pořadí dávají **porovnání dvojic** („Která se
ti líbí víc?“, výsledek A, B nebo remíza). Ukládají se jen do databáze učení (tabulka `porovnani`), nikdy do
sbírky ani exportu.

| Volání | Co dělá |
|---|---|
| `GetDvojiceKPorovnani(pocet, okruh) []DvojicePorovnani` | dvojice `{a, b, duvod}` vybrané aktivním učením; `okruh`: `""` hodnocené (stejná a sousední úroveň), `"stejne"` jen stejná úroveň, `"nehodnocene"` nehodnocená proti hodnocené kotvě |
| `PorovnatModelky(a, b, vysledek) bool` | zapíše porovnání (`a`, `b`, `remiza`) se srdíčky obou v tu chvíli |
| `VratitPorovnani() bool` | smaže poslední porovnání (zpět) |
| `ZapomenoutPorovnani() bool` | záloha databáze učení a smazání všech porovnání, zájmu a historie oblíbenosti |
| `ZaznamenatZajem(id, druh, sekund) bool` | zájem o modelku: `druh` `"profil"` (stejná modelka nejvýš jednou za 10 minut) nebo `"fotky"` (`sekund` prohlížení, 3–1800); změnu dat neohlašuje |
| `GetPrehledOblibenosti() PrehledOblibenosti` | úvod Přehledu: `top` (10 nejoblíbenějších), `stoupaji` a `klesaji` (posun aspoň o 3 místa a 3 % délky pořadí, nejvýš 10), `dlouhoNevidene` (z horní třicítky ty, jejichž profil ani fotky jsi 30 dní neviděl; `dni` = −1 nikdy; až se zájem sleduje aspoň 30 dní), `trendDni`, `zajemDni`; položky `modelkaId`, `jmeno`, `hodnoceni`, `poradi`, `zmenaPoradi`, `dni` |
| `GetOblibenost() StavOblibenosti` | `porovnani`, `modelek`, `presnost` (přesnost modelu vkusu na ověření u modelek ze skupin, kde se odhad ukazuje, 0–1), `odhady` (model prošel ověřením), `vahaFotek` (váha skóre fotek v předpokladu 0–1), `vahaNaucena` (z porovnání, jinak výchozí 0,3), `porovnaniVahy` (porovnání, ze kterých se váha učí), `zlepseniFotek` (o kolik naučená váha zlepšila log-ztrátu předpovědi porovnání proti samotným srdíčkům na ověření; může být záporné), `poradi` – hodnocené a porovnávané modelky od nejoblíbenější: `modelkaId`, `jmeno`, `hodnoceni`, `sila`, `nejistota`, `poradi`, `porovnani`, `odhad`, `skoreFotek` (0 = žádná hodnocená fotka), `albFotek`, `fotekHodnocenych`, `duvod` („srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“, případně „fotky a porovnání ji staví výš než její srdíčka (síla 4,4)“ a odhad vkusu) |
| `GetMohloByTeLibit(pocet) []OblibenostModelky` | nehodnocené modelky s nejvyšším odhadem a důvodem (`odhad`, `duvod`; `sila` = nezaokrouhlený odhad, `nejistota` = chyba ověření u modelek s podobně bohatými údaji) |
| `GetNavrhSrdicek(id) NavrhSrdicek` | návrh srdíček nehodnocené z porovnání: `hodnoceni` (po polovinách, 0 = zatím nenavrhovat – méně než 3 porovnání, nejistota nad 0,6, už hodnocená), `porovnani`, `vyhry`, `nejistota` |
| `GetDuvodOdhadu(id) string` | důvod ukázaného odhadu nehodnocené modelky („Odhad 4 srdíčka: blond, 70. léta, Pompeo Posar; podobně jako Anna (4½) a Bára (4)“), jinak `""`; štítek „odhad“ si ho načte při prvním najetí myší |
| `GetNahledyModelek(ids, pocet) map[int][]NahledFotky` | náhledy fotek modelek pro porovnání (nejvýš `pocet`, 1–24; nejvýš 100 modelek): `id` fotky, `url` (šablona s `{velikost}`), `album`, `typ`, `hodnoceni` (srdíčka fotky), `rotace`; neznámá modelka nebo bez fotek má `[]` |
| `Modelka.oblibenost` | srdíčka upřesněná skóre fotek a porovnáním (nejvýš ±0,49: o půl srdíčka se pořadí přehodit může, o celé ne); nehodnocená porovnávaná má sílu z porovnání, ostatní 0 |
| `Modelka.poradi`, `zmenaPoradi`, `trendDni` | pořadí oblíbenosti od 1 (0 = mimo pořadí), o kolik míst výš než ve srovnávacím snímku (záporné = níž) a jeho stáří ve dnech (0 = trend zatím není) |
| `Modelka.odhadHodnoceni` | odhad modelu vkusu po polovinách jen u nehodnocené modelky ze skupiny údajů, kde odhad na ověření jasně překonal průměr, jinak 0 |

## Bradley–Terry

Každá modelka má skrytou sílu s na stupnici srdíček; P(víc se líbí i než j) = σ(k·(sᵢ − sⱼ)), k = 2 (o půl
srdíčka silnější vyhraje v 73 %). **Předpoklad** (oddíl Předpoklad a naučená váha fotek): hodnocená modelka
N(srdíčka, 0,25²), se skóre fotek N((1 − w)·srdíčka + w·F̂, σ²); nehodnocená se skóre fotek N(F̃, …), nehodnocená
porovnávaná bez fotek N(průměr srdíček sbírky, 1,25²). Porovnání sílu posunou dál; v `duvod` pak „porovnání
(fotky, fotky a porovnání) ji staví výš než její srdíčka“, když se síla od srdíček liší o víc než čtvrt srdíčka.
Remíza je půl výhry pro každou, porovnání váží podle stáří 0,5^(dny/365).

**Oblíbenost hodnocené modelky** = srdíčka + (s − srdíčka) oříznuté na ±0,49. Srdíčka jsou měkký předpoklad, ne
přihrádky: výborné fotky nebo porovnání posunou čtyřku nad modelku se 4½ srdíčka se slabými fotkami, ale nad
pětku ne (o celé srdíčko se pořadí nikdy nepřehodí; dřív ±0,24, tj. srdíčka jako tvrdé úrovně). Srdíčka mění
jen uživatel.

Odhad je maximum aposteriorní hustoty, počítané **iteracemi MM** po souřadnicích: zakřivení logistické funkce je
nejvýš k²/4, takže krok sᵢ += gᵢ/(Σ w·k²/4 + 1/σᵢ²) hodnotu nikdy nezhorší (Böhningova mez) a konverguje k jedinému
maximu (cíl je konkávní). **Nejistota** je Laplaceova aproximace z diagonály Fisherovy informace:
Var sᵢ ≈ 1/(1/σᵢ² + Σ w·k²·p(1 − p)). Modelka bez porovnání má sílu rovnou předpokladu. Na umělých datech
(30 modelek jedné úrovně, 1500 porovnání) odhad vrátí pořadí se Spearmanovým ρ ≥ 0,9 (`TestBradleyTerryNajdePoradi`).

## Skóre fotek

Fotky mají srdíčka 1–5 (0 = nehodnocená). Skóre fotek modelky F je odhad, jak se ti líbí její fotky, ze všech jejích
alb s hodnocenými fotkami (vlastních i těch, kde je další modelkou; centerfold, pictorial i online album váží
stejně – typ alba o kvalitě fotek nic neříká a dělit hlasy podle typu by malé skupiny zbytečně zašumělo).
Nehodnocené fotky a alba bez hodnocených fotek se nepočítají. Počty fotek podle srdíček v každém albu přicházejí
se snímkem sbírky (jeden dotaz se součty `SUM(hodnoceni = h)` po albech), skóre se počítá v paměti (3000 modelek
asi 1 ms).

Hierarchický normální model: fotka h ~ N(θₐ, σ_w²), album θₐ ~ N(φₘ, τₐ²), modelka φₘ ~ N(μ, τₘ²).

1. **Album = průměr jeho nejlepších fotek**, mₐ = průměr k nejlepších, k = min(5, n − ⌊n/4⌋). Slabší čtvrtina alba
   a fotky za pátou nejlepší výsledek nezhorší: album s pěti fotkami za 5 srdíček a třiceti za 3 je výborné album
   (mₐ = 5), uživatel ho tak vnímá a průměrné fotky navíc jsou jen výplň. Proč ne medián nebo průměr všech: obojí
   trestá album za to, že má víc fotek. Proč ne maximum: jedna dobrá fotka mezi slabými by album spasila; s k = 5
   má „1× pět, 7× dvě“ skóre 2,6. Ořez čtvrtiny drží malá alba stejně férová (4 fotky → 3 nejlepší).
2. **Album je jeden hlas.** Rozptyl mₐ kolem úrovně modelky je vₐ = σ_w²/kₐ + τₐ² (skóre stojí na kₐ fotkách), váha
   alba 1/vₐ tedy od šesti hodnocených fotek dál neroste: album se čtyřiceti fotkami za 3 a album se šesti za 5
   mají stejný hlas (modelka s alby 40× ♥3 + 6× ♥5 má stejné skóre jako 6× ♥3 + 40× ♥5; průměr fotek by dal 3,3
   proti 4,7). Album s jednou dvěma fotkami je jen částečný hlas, protože je nejisté.
3. **Smrštění k průměru sbírky** (empirický Bayes):

   F = φ̂ = (μ/τₘ² + Σₐ mₐ/vₐ) / (1/τₘ² + Σₐ 1/vₐ),   Var F = 1/(1/τₘ² + Σₐ 1/vₐ)

   Průměr sbírky μ váží jako 1/τₘ², tedy jako σ_w²/τₘ² fotek nebo zhruba (σ_w² + τₐ²)/τₘ² jednofotkových alb.
   Parametry se odhadnou ze sbírky momentovou metodou: σ_w² = rozptyl srdíček fotek uvnitř alb (sdružený, od 10
   stupňů volnosti, jinak 0,5), τₐ² = rozptyl skóre alb téže modelky minus průměrné σ_w²/k (jinak 0,1), μ = průměr
   modelek, τₘ² = rozptyl průměrů modelek minus jejich průměrná nejistota (od 10 modelek, jinak 0,3); dolní meze
   0,05, 0,02 a 0,05. Jedna fotka za 5 srdíček tak dá na umělé sbírce asi 4,2 (rozptyl 0,37), tři alba plná
   pětek 4,8 (rozptyl 0,10); jedna fotka za 1 srdíčko skončí pod průměrem, ale nad 1,5.

## Předpoklad a naučená váha fotek

**Převod na stupnici srdíček modelek.** Fotky se hodnotí jinak než modelky (třeba štědřeji a v užším rozsahu).
Pro hodnocenou modelku se skóre jen převede na stupnici srdíček posunem a natažením podle průměru a směrodatné
odchylky skóre a srdíček hodnocených modelek s fotkami: F̂ = H̄ + (F − F̄)·sd_H/sd_F (natažení 0,25–4, z méně
než 10 modelek jen posun průměrů). Kolik má F̂ vážit, převod neurčuje – to se učí z porovnání. Nehodnocená
modelka srdíčka nemá, její předpoklad je předpověď srdíček regresí na skóre: F̃ = α + β·F (β 0–3; skóre je
aposteriorní odhad, takže regrese na něj je kalibrovaná) s nejistotou r₀² + β²·Var F (r₀² = rozptyl reziduí
bez části z nejistoty skóre).

**Předpoklad síly** v Bradley–Terry:

| Modelka | Střed | Směrodatná odchylka |
|---|---|---|
| srdíčka i skóre fotek | (1 − w)·H + w·F̂ | √((1 − w)²·0,25² + w²·Var F̂), aspoň 0,2 |
| jen srdíčka | H | 0,25 |
| jen skóre fotek | F̃ | √(r₀² + β²·Var F), nejvýš 1,25 |
| nic, ale porovnávaná | průměr srdíček sbírky | 1,25 |

**Naučená váha w.** Pro w z mřížky 0; 0,05; … 1 se spočítá log-věrohodnost porovnání Σ t·log σ(±k·(μᵢ(w) − μⱼ(w)))
(t = váha podle stáří, remíza půl, srdíčka obou v okamžiku porovnání). Počítají se jen porovnání modelek se
**stejnými srdíčky**, kde aspoň jedna má skóre fotek: tam je rozdíl předpokladů přesně w·(F̂ᵢ − F̂ⱼ) a věrohodnost
měří, jak silně mají fotky modelky jedné úrovně rozlišit. U různých úrovní by váha zároveň zmenšovala rozdíl
srdíček, takže kdyby uživatel občas dal přednost modelce s méně srdíčky, vyšší váha by vypadala lépe, i když fotky
nic neříkají. Nejlepší ŵ se smrští k výchozí váze w₀ = 0,3:

w = (n·ŵ + n₀·w₀)/(n + n₀),

n = počet takových porovnání, n₀ ∈ {10, 40, 160} vybere **křížové ověření** na pěti částech (učí se na čtyřech,
log-ztráta na páté; při shodě silnější smrštění). Pod 10 porovnání platí w₀ (`vahaNaucena: false`). `zlepseniFotek`
= 1 − ztráta s naučenou vahou / ztráta jen ze srdíček (na týchž ověřovacích porovnáních). Chování na umělých datech
(`TestVahaFotekZPorovnani`, `TestVahaFotekVOblibenosti`): když porovnání sledují fotky, w dojde ke stropu 0,8 a log-ztráta
předpovědi klesne o 23–87 %; náhodné skóre fotek nebo porovnání proti fotkám dají w ≈ 0,01; 25 porovnání dá 0,8, osm 0,3.
Váha nemůže být záporná (fotky „naopak“ nedávají smysl, nejvýš se vypnou) a nepřekročí **0,8**: vlastní srdíčka modelky váží vždy aspoň pětinou, i když porovnání silně sledují fotky.

## Zájem a trend

Oblíbenost se nemá měnit jen tehdy, když porovnáváš. Program si proto všímá **zájmu** (`oblibenost_zajem.go`):
otevření profilu modelky (stejná modelka nejvýš jednou za 10 minut, i listování mezi profily) a času prohlížení
jejích fotek v prohlížeči (čas u jedné fotky nejvýš minuta, skryté okno se nepočítá; zapíše se při zavření
prohlížeče). Záznamy jdou jen do databáze učení (tabulka `zajem`).

- **Skóre zájmu** modelky Z = Σ 0,5^(dny/60) · h, kde h = 1 za otevření profilu a sekundy/120 za prohlížení fotek
  (dvě minuty fotek = jedno otevření). Poločas 60 dní: oblíbenost sleduje, o koho se zajímáš teď.
- **Míra zájmu** z = min(log(1 + Z) / ref, 2), ref = medián log(1 + Z) modelek se zájmem (aspoň log 2).
  Logaritmus a strop drží desítky otevření jedné modelky na uzdě.
- **Posun předpokladu** síly v Bradley–Terry o v·z (u modelek s předpokladem: hodnocené, s hodnocenými fotkami
  a porovnávané). Váhu v se program učí jako váhu fotek: z porovnání modelek se stejnými srdíčky, kde se zájem
  stran liší, mřížka 0–0,3 po 0,025 podle vážené log-ztráty (předpoklad stran se srdíčky a fotkami s naučenou
  vahou fotek), výsledek stažený k výchozí 0,1 jako by ji potvrdilo 20 porovnání. Pod 10 takových porovnání platí
  0,1 (`zajemNaucen: false`). Oblíbenost hodnocené modelky dál zůstává do ±0,49 od jejích srdíček: zájem přeskupí
  pořadí uvnitř úrovně, srdíčka nepřebije. Hrozí smyčka „řadím podle oblíbenosti → otevírám ty nahoře → víc
  zájmu“; proto je posun malý (výchozí nejvýš 0,2 srdíčka) a váhu určují porovnání, ne samotný zájem.
- Nové záznamy výsledek v paměti nezneplatní každý zvlášť (přepočet modelu vkusu stojí desítky ms): projeví se po
  každých 20 záznamech, po změně dat nebo druhý den. Důvod v pořadí ukáže „zájem: 8× profil, 14 min fotek za
  2 měsíce (+0,15)“.

**Historie a trend.** Po přepočtu modelu se zapíše snímek dnešní oblíbenosti a pořadí (`historie_oblibenosti`,
dnešní nejvýš jednou za hodinu). Trend je posun proti snímku z doby před 30 dny, dokud není, proti nejstaršímu aspoň
7 dní starému (`trendDni`); pořadí se pro srovnání počítá jen mezi modelkami, které jsou v obou snímcích, aby nově
ohodnocené modelky nevypadaly jako pád všech pod nimi. Úklid jednou denně: po 60 dnech zůstane pondělní snímek, po
400 dnech nic, záznamy zájmu starší dvou let se smažou.

**Kde se oblíbenost projeví:** galerie Podle srdíček a filtr srdíček (se stejnými srdíčky podle oblíbenosti),
pořadí a trend v profilu a šipka na kartě (posun aspoň o 3 místa), Nejlepší fotky a stěna centerfoldů Podle
srdíček (fotky se stejnými srdíčky podle oblíbenosti modelky), Údržba (význam modelky v prioritě počítá
s oblíbeností místo srdíček; řazení „oblíbené napřed“), Sháním CZ („Nejdřív sháněj“: čísla s nejoblíbenější
modelkou) a úvod Přehledu (Top 10, Stoupají, Dlouho jsi neviděl).

## Pásy fotek v porovnání

Porovnání podle jedné titulní fotky je nefér k modelkám s nevýraznou titulní fotkou a malé náhledy pod fotkou se
špatně prohlížely. Porovnávání proto ukazuje **dvě nezávislé galerie nad sebou** (`frontend/src/app/porovnani-pasy.js`)
přes výšku okna: nahoře jedna modelka, dole druhá, vlevo její titulní fotka se jménem, srdíčky a „♥ Tahle“, hned
vedle pás jejích fotek. Oblíbenost má pod hledáním dvě části – Porovnávání a Pořadí (s Mohlo by se ti líbit vedle) –
a u Porovnávání i okruh dvojic.

Každý pás je nejvýš 24 nejlepších fotek z `GetNahledyModelek`: alba se seřadí podle skóre (průměr nejlepších fotek,
alba bez hodnocených fotek nakonec, při shodě v pořadí přidání), fotky v albu podle srdíček a pak podle pořadí v albu
(ruční pořadí, jinak vložení). Napřed nejlepší fotka každého alba (při víc albech než místech nejlepších alb), zbylá
místa dostanou ostatní fotky podle srdíček (při shodě ta výš ve svém albu); vybrané se nakonec seřadí podle srdíček,
takže 1. fotka je nejlepší. Titulní fotka se neopakuje. Fotky se čtou jedním dotazem `album_id IN (…)` pro alba všech
žádaných modelek (alba modelek jsou ve snímku sbírky) a výsledek se pamatuje se snímkem (změna fotek nebo srdíček
snímek zneplatní). Rozhraní si seznamy fotek celé fronty dvojic načte jedním voláním dopředu a první fotky další
dvojice přednačte; dokud fotky nejsou, drží místo prázdné rámečky.

Ovládání: pás pod myší je aktivní (<kbd>Tab</kbd> ho přepne, druhý se ztlumí), kolečko a <kbd>←</kbd> /
<kbd>→</kbd> jím listují, <kbd>1</kbd>–<kbd>5</kbd> dá srdíčka zvýrazněné fotce (`SetHodnoceniFotek`), <kbd>0</kbd>
je zruší, klik otevře běžný prohlížeč fotek na té fotce mezi všemi fotkami modelky (pořadí alb jako v profilu, po zavření se pás té modelky načte znovu), „♥ Tahle“ nebo <kbd>Enter</kbd>
vybere modelku aktivního pásu, <kbd>↓</kbd>, mezerník nebo „Stejně“ remízu, <kbd>S</kbd> přeskočí, <kbd>Backspace</kbd>
vrátí poslední porovnání.

## Výběr dvojic

Aktivní učení: porovnání má smysl tam, kde je pořadí nejisté a kde na něm záleží – u stejné nebo sousední úrovně
srdíček. Kandidátky jsou ke každé hodnocené modelce nejbližší sousedé podle síly (10). Skóre dvojice je očekávaná
informace p(1 − p)·(Var sᵢ + Var sⱼ) krát váha úrovně (stejná 1, o půl srdíčka 0,7, o srdíčko 0,2, jinak nic; okruh
`stejne` jen stejná) krát váha modelky (bez titulní fotky i fotek 0,3; častá v posledních porovnáních se tlumí
1/(1 + 0,5·četnost), novější porovnání víc). Var s vychází z předpokladu, takže skóre fotek do výběru vstupuje
samo: modelka s nejistým skóre (málo alb a fotek) má širší předpoklad a dostane přednost před modelkou, o které
fotky říkají hodně. Vynechají se dvojice z posledních 200 porovnání a posledních 60
nabídnutých, modelka je v jednom výběru nejvýš jednou. Asi pětina dvojic je **průzkum** (náhodná dvojice stejné
nebo sousední úrovně); semínko je z počtu porovnání a volání, výsledek je opakovatelný. Pořadí A/B je náhodné.
Okruh `nehodnocene` páruje nehodnocenou modelku s kotvou, která má **přesně tolik srdíček, kolik vychází její
odhad** zaokrouhlený na polovinu srdíčka (stejné číslo, jaké ukazuje štítek „odhad“): odhad vkusu, jinak předpověď ze
skóre fotek, jinak průměr sbírky; jakmile je nehodnocená aspoň jednou porovnaná, její síla z porovnání. Výhra tak
posune další kotvu o úroveň výš, prohra níž – pár porovnání najde její úroveň jako půlení intervalu. Kotvy jsou
typické modelky té úrovně (síla nejblíž srdíčkům, nejvýš 10); když na té úrovni nikdo není, nejbližší úroveň (při shodě
vyšší). Důvod to říká: „Odhad podle vkusu: 3½ srdíčka – proti modelce s 3½ srdíčka: vyhraje-li, patří výš, prohraje-li,
níž“.

Po volbě v dvojici s nehodnocenou se rozhraní zeptá na `GetNavrhSrdicek(id)`: po aspoň 3 porovnáních a s nejistotou
síly nejvýš 0,6 srdíčka vrátí úroveň, na kterou modelka vychází (síla zaokrouhlená na polovinu srdíčka), a pod pásy se
nabídne „Nehodnocená Anna vychází po 4 porovnáních (výhry 2,5) na 3½ ♥ – Dát jí 3½ ♥ / Nechat“. Samé výhry (nebo
prohry) nad jednou úrovní návrh nedají – ví se jen „výš“, ne o kolik, a výběr dvojic nabídne kotvu o úroveň dál.
„Nechat“ návrh pro tu modelku do zavření programu nenabízí. Důvod dvojice stejné úrovně uvádí skóre fotek obou („Obě mají 4 srdíčka (fotky 4,6
a 4,1) …“).

## Model vkusu

Odhad srdíček nehodnocené modelky z jejích údajů (`oblibenost_vkus.go`), čistě v Go bez knihoven. Je to vážený
průměr dvou modelů, oba se učí na hodnocených modelkách a ověřují **křížovým ověřením** na 5 částech (rozdělení
podle čísla modelky, opakovatelné):

- **hřebenová (ridge) regrese** – hodnoty údajů jako 0/1: etnicita, národnost (sjednocená tabulkou zemí), vlasy, oči,
  typ prsou, košíček (A–D, DD+), ochlupení, tetování a piercing (ano/ne), desetiletí prvního výskytu, kategorie
  (i odvozené Playmate měsíce, Cyber Girl, Modelka obálky; rok na konci se zahodí, „Playmate roku 1998“ a „… 2003“
  jsou táž kategorie), fotografové alb; hodnota se počítá, když ji mají aspoň 3 hodnocené modelky (nejvýš 150
  nejčastějších). Číselné údaje (výška, váha, hrudník, pas, boky, BMI, poměr pas/boky, rok prvního výskytu, průměr
  srdíček fotek, skóre fotek) robustně standardizované (medián a 1,4826·MAD, oříznuté na ±3, chybějící = 0) a navíc
  po **pětinách** jako 0/1 („výška 165–169 cm“), takže regrese pozná i oblíbené rozmezí. λ ∈ {2; 8; 32; 128} vybere
  ověření; Gramova matice se sčítá po částech a soustavy se řeší Choleským rozkladem (části souběžně).
- **gradientně posilované mělké stromy** (`oblibenost_vkus_stromy.go`) – tytéž hodnoty údajů a číselné údaje v nejvýš
  16 koších po kvantilech; chybějící údaj jde v každém dělení tou stranou, která sedí lépe. Hloubka 3, krok 0,15,
  v listu aspoň 8 modelek, smrštění λ = 4, každý strom na náhodných 80 % modelek (pevné semínko). Počet stromů
  (nejvýš 80) vybere ověření, les na části přestane růst po 20 stromech bez zlepšení. Stromy zachytí souvislosti,
  které přímka nevidí: blond jen v jedné éře, oblíbený fotograf jen u některého typu.

**Váha stromů** v průměru z {0; ¼; ½; ¾; 1} se vybere podle chyby na ověření. **Cíl** jsou srdíčka upřesněná
porovnáním uvnitř úrovně (±0,24) z Bradley–Terry s předpokladem jen ze srdíček, ne oblíbenost se skóre fotek: fotky
jsou mezi údaji modelu (průměr srdíček fotek i skóre fotek, oddíl Skóre fotek), v cíli by se započítaly podruhé
a ověření by vycházelo lépe, než model je. Chyba ověření se měří proti samotným srdíčkům (odhad oříznutý na 0,5–5).

**Přesnost má přednost před úplností.** Modelky se rozdělí do šesti **skupin podle bohatosti údajů**: se srdíčky
fotek, nebo bez nich × méně než 5, 5–6, aspoň 7 skupin údajů. Odhad se ukáže (`odhadHodnoceni`, štítek „odhad“)
jen ve skupině, kde na ověření (aspoň 20 hodnocených, jinak spolu s chudšími skupinami téhož druhu, pak s celým
druhem) má chybu nejvýš 90 % chyby prostého průměru a přesnost (zaokrouhlený odhad do ± půl srdíčka) aspoň 0,5;
vždy jen od 30 hodnocených modelek a u modelky s aspoň 4 skupinami údajů. `presnost` v `GetOblibenost` a chyba jsou
z ověření ukázaných skupin. Na umělé sbírce (níže) jsou odhady modelek bez srdíček fotek a s málo údaji horší než
prostý průměr – dřív se ukazovaly všem.

**„Mohlo by se ti líbit“** je pořadí, ne přesná hodnota: z nehodnocených se ≥ 4 skupinami údajů a odhadem aspoň na
mediánu srdíček sbírky (aspoň 2,5) bere ty s nejvyšším odhadem, i ze skupin, kde se štítek neukazuje (vysoký odhad
tam na ověření sedí stejně často, jen jeho hodnota je méně jistá). Mlčí bez platného modelu a když vysoké odhady
na ověření sedí u méně než 60 % (při aspoň 5 takových); `nejistota` je chyba ověření ve skupině modelky.

**Důvod** („Odhad 4 srdíčka: blond, 70. léta, Pompeo Posar; podobně jako Anna (4½) a Bára (4)“): tři nejsilnější
příspěvky údajů ve směru odchylky od průměru (u regrese wⱼ·(xⱼ − x̄ⱼ), u stromů po cestě stromem rozdíl hodnoty
uzlu a potomka připadne údaji, podle kterého se dělilo – součet příspěvků a kořenů je přesně odhad; příspěvky
obou modelů vážené jako v průměru, rok a desetiletí jsou jeden údaj „70. léta“, průměr srdíček fotek a skóre fotek
jeden údaj o fotkách; jen údaje, které modelka má). Za středníkem dvě nejpodobnější hodnocené modelky se svými
srdíčky: ty, se kterými padne do stejného listu ve většině stromů (aspoň polovině).

**Vyhodnocení** (`TestVyhodnoceniVkusu`, `TestVyhodnoceniVariantVkusu`, `go test -run Vyhodnoceni -v`; při `-short` se
přeskočí): umělé sbírky s realistickým rozložením údajů a hodně prázdnými poli (vlasy chybí u 15 %, výška u 30 %,
míry u 50 %, typ prsou u 60 %, fotografové u 30 %…), simulovaný uživatel hodnotí nelineárně podle *skutečných*
údajů (i těch, které ve sbírce chybí): blond jen před rokem 1990, černé vlasy až od roku 2000, rozmezí výšky
165–173 cm, dva oblíbení a jeden neoblíbený fotograf, silikon, tetování, poměr pas/boky, vzácné národnosti, éra,
k tomu vlastní nevysvětlitelná složka σ = 0,55 a šum; pod 2 srdíčky dává většinou jedno srdíčko, většinou celá
srdíčka. Srdíčka fotek (u poloviny hodnocených a 12 % nehodnocených) souvisejí s vkusem. Každá modelka má „pravdu“
(hodnocení, které by jí uživatel dal); model se učí z hodnocených a měří na nehodnocených, které nikdy neviděl.
Strop: vkus ze skutečných údajů bez vlastní složky má s pravdou Spearmanovo ρ ≈ 0,61; s chybějícími údaji
a 8 000 hodnocenými dosáhnou stromy asi 0,46.

| Sbírka (semínek) | | dřív (jen regrese) | nyní |
|---|---|---|---|
| 400 modelek, 214 hodnocených (6) | MAE všech nehodnocených (průměr 0,709) | 0,691 | 0,680 |
| | Spearman ρ / precision@10 (pravda ≥ 4) | 0,265 / 0,60 | 0,300 / 0,63 |
| | model platný / pokrytí odhadů | 2 ze 6 / 0,33 | 6 ze 6 / 0,29 |
| | ukázané odhady: MAE / přesnost ± ½ (ověření tvrdí) | 0,716 / 0,61 (0,674 / 0,63) | 0,620 / 0,72 (0,605 / 0,68) |
| | tipy: běhů s tipy / precision@10 | 2 / 0,80 | 6 / 0,63 |
| 400 modelek, 69 hodnocených (6) | MAE (průměr 0,748) / ρ / precision@10 | 0,744 / 0,205 / 0,53 | 0,743 / 0,222 / 0,70 |
| | platný / pokrytí / ukázané MAE / přesnost | 4 ze 6 / 0,67 / 0,754 / 0,60 | 6 ze 6 / 0,28 / 0,671 / 0,62 |
| | tipy: běhů / precision@10 | 4 / 0,50 | 6 / 0,70 |
| 3000 modelek, 960 hodnocených (3) | MAE (průměr 0,704) / RMSE / ρ / precision@10 | 0,674 / 0,893 / 0,351 / 0,87 | 0,658 / 0,875 / 0,394 / 0,93 |
| | platný / pokrytí / ukázané MAE / přesnost (ověření tvrdí) | 2 ze 3 / 0,66 / 0,676 / 0,62 (0,65) | 3 ze 3 / 0,47 / 0,618 / 0,66 (0,69) |
| | tipy: běhů / precision@10 / sedí z tvrzených | 2 / 0,95 / 0,80 z 0,81 | 3 / 0,93 / 0,80 z 0,81 |
| 400 modelek, náhodný vkus i fotky (6) | model platný | 0 ze 6 | 0 ze 6 |

Pokrytí je podíl nehodnocených s ukázaným odhadem (průměr přes běhy, neplatný běh = 0). Porovnání variant na 12
semínkách (400) a 3 (3000): samotné stromy jsou na malých sbírkách horší než regrese (ρ 0,275 proti 0,303) a na
velké lepší (0,381 proti 0,373), průměr obou je nejlepší všude (0,310; 0,243; 0,394); pětiny číselných údajů zlepší
regresi (ρ 0,287 → 0,303, na 3000 0,348 → 0,373), sloupec „údaj chybí“ ani izotonický převod odhadu na srdíčka
nepomohly (převod zlepšil MAE, ale zhoršil pořadí a ověření pak přeceňovalo přesnost), porovnání dvojic jako
další signál nic nezměnilo (ρ ±0,002), údaj o fotkách jako skóre, průměr srdíček nebo obojí vyjde nastejno
(obojí je výchozí). Skupiny podle bohatosti sníží chybu ukázaných odhadů o 0,03–0,11 srdíčka za cenu menšího
pokrytí. Ověření tvrdí přesnost ukázaných odhadů s odchylkou do 0,05 (dřív podobně).

**Mezipaměť a výkon:** skóre fotek, váha fotek, BT i model vkusu se počítají najednou v paměti s otiskem (FNV-64a
z údajů všech modelek včetně srdíček fotek po albech a fotografů, počtu a posledního čísla porovnání a dnešního
data); GetModelky pak jen doplní čísla z map. Do souboru se výsledek neukládá (výpočet trvá desítky milisekund). Umělá sbírka 3000 modelek (1000
hodnocených, 500 porovnání, `TestVykonOblibenosti`): načtení modelek bez oblíbenosti asi 100 ms, GetModelky
z paměti asi 105 ms, první výpočet nebo po změně hodnocení asi 130–160 ms (BT + vkus asi 25 ms), výběr 10 dvojic
asi 120 ms (z toho většinu zabere načtení modelek). Se skóre fotek a učením váhy (`TestVykonNahleduASkore`):
`spocitatOblibenost` asi 50 ms (skóre fotek asi 1 ms; model vkusu se stromy asi 30 ms – části ověření regrese
i stromů a les ze všech hodnocených běží souběžně; dřív dvě varianty regrese a celkem 20–30 ms), `GetOblibenost`
z paměti asi 35 ms (dřív 10 ms; důvod odhadu ze stromů u 3000 modelek asi 17 ms), `GetNahledyModelek` pro 6
modelek bez paměti pod 1 ms, z paměti snímku desítky µs. Na realistické umělé sbírce (`TestVyhodnoceniVkusu`,
3000 modelek, 1000 hodnocených s 150 hodnotami údajů) trvá `spocitatOblibenost` dřív i nyní asi 45 ms, se 1800
hodnocenými asi 62 ms; GetModelky z paměti se nemění (asi 2 ms).
