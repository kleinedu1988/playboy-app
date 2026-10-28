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
s předpokladem ze srdíček nebo odhadu vkusu) a model vkusu, který odhaduje hodnocení
nehodnocených modelek.

| Soubor | Co v něm je |
|---|---|
| `uceni_modely.go` | sdílené statistické nástroje: klíč textu, Jaro–Winkler, naučené sjednocení zápisů, podíl s předpokladem (Beta), log-šance a spojení zdrojů, četnosti při podmínce, profil postavy, robustní odhad, Choleského inverze, regrese s ověřením vynecháním jedné, k nejbližších sousedů |
| `navrhy.go` | zdroje návrhů, výběr a spojení zdrojů, přijetí a odmítnutí |
| `kontrola.go`, `kontrola_uceni.go` | pravidla kontroly, naučené rozsahy, neobvyklé kombinace, podobná jména, prahy |
| `uceni.go` | databáze učení: deník rozhodnutí, odmítnuté hodnoty, zápisy z oprav, kalibrace, prahy kontroly, mezipaměť, přehled a zapomenutí |
| `oblibenost.go` | porovnání dvojic, Bradley–Terry s předpokladem ze srdíček, výběr dvojic (aktivní učení) |
| `oblibenost_vkus.go`, `oblibenost_vkus_stromy.go` | model vkusu: údaje modelek, hřebenová regrese a posilované stromy, ověření, skupiny podle bohatosti údajů, důvody, „Mohlo by se ti líbit“ |
| `oblibenost_fotky.go` | skóre fotek (album jako hlas, průměr nejlepších fotek, empirický Bayes), náhledy alb pro porovnání |

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
| `kronika_slavy` | (úprava č. 5) kronika síně slávy: `cas`, `porovnani_id` (poslední porovnání v době zápisu), modelka, `druh` (`zacatek`, `pocatek`, `vstup`, `vystup`, `obhajoba`, `jednicka`, `konec`), `misto`, `souperka`; nemaže se (jen vrácením porovnání a zapomenutím porovnání) |
| `prevzate_odhady` | (úprava č. 6) srdíčka daná přijetím odhadu vkusu v rychlém hodnocení: modelka, `hodnoceni` v tu chvíli, `cas` |
| `drzitelky_urovni` | (úprava č. 4) držitelky úrovní Top N pro obhajobu místa: `porovnani_id` (poslední porovnání, po kterém stav platí), modelka, `uroven`; řádek s modelkou 0 značí stav (i prázdný); drží se posledních 50 stavů, vrácení porovnání smaže stavy po něm |
| `historie_oblibenosti` | (úprava č. 3) denní snímky oblíbenosti: `den`, modelka, `oblibenost`, `poradi` (potvrzené; řádek s modelkou 0 a `poradi` 1 značí snímek s potvrzeným pořadím); po 60 dnech jen pondělní, po 400 dnech nic |

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
| `GetDvojiceKPorovnani(pocet, okruh) []DvojicePorovnani` | dvojice `{a, b, duvod, druh}` vybrané aktivním učením; `okruh`: `""` (rozhraní jiný nepoužívá) míchá hodnocené dvojice (stejná, sousední a o srdíčko vzdálená úroveň) s asi třetinou nehodnocených proti kotvě a souboji na hranicích top 10/20/50/100 (`druh: "souboj"`, jinak `""`), `"stejne"` jen stejná úroveň, `"nehodnocene"` jen nehodnocené proti kotvě |
| `PorovnatModelky(a, b, vysledek) bool` | zapíše porovnání (`a`, `b`, `remiza`) se srdíčky obou v tu chvíli |
| `VratitPorovnani() bool` | smaže poslední porovnání (zpět) |
| `ZapomenoutPorovnani() bool` | záloha databáze učení a smazání všech porovnání, zájmu, historie oblíbenosti, držitelek úrovní a kroniky síně slávy |
| `GetSoubojeModelky(id) []DvojicePorovnani` | „Rozhodnout teď“: série soubojů jedné modelky (oddíl Úrovně, Rozhodnout teď); prázdná, když nečeká ani neobhajuje, nebo ještě do souboje nesmí |
| `GetFrontaHodnoceni() []PolozkaHodnoceni` | fronta rychlého hodnocení (oddíl Rychlé hodnocení): `modelkaId`, `druh` (nova / nehodnocena / nesedi), `odhad` (0 = žádný), `nejistota`, `duvod`, u nesouladu `hodnoceni`, `navrh` a `nesoulad` |
| `SetHodnoceniOdhadem(id, hodnoceni) bool` | jako `SetHodnoceni`, navíc zapamatuje, že srdíčka jsou přijatý odhad vkusu (model vkusu se z nich neučí, dokud je nepotvrdí porovnání) |
| `GetSinSlavy() SinSlavy` | síň slávy (oddíl Síň slávy): `od` (začátek kroniky), `vitrina` (současná potvrzená top 10 podle místa), `legendy` (bývalé top 10, nejdéle v top 10 napřed), `rekordy` (`druh` nejdele / vlada / obhajoby / rychlost / navrat, `modelkaId`, `hodnota`, `odZacatku`, `cas`, `trva`), `kronika` (nejvýš 300 událostí od nejnovější: `cas`, `druh`, `modelkaId`, `misto`, `souperka`); modelka ve vitríně i legendách: `modelkaId`, `misto`, `vTop`, `od`, `do`, `odZacatku`, `dniTed`, `dniCelkem`, `dniNejdele`, `dniNaPrvnim`, `pobytu`, `obhajob`, `nejlepsiMisto` |
| `ZaznamenatZajem(id, druh, sekund) bool` | zájem o modelku: `druh` `"profil"` (stejná modelka nejvýš jednou za 10 minut) nebo `"fotky"` (`sekund` prohlížení, 3–1800); změnu dat neohlašuje |
| `GetPrehledOblibenosti() PrehledOblibenosti` | úvod Přehledu: `top` (jen potvrzené v top 10 – dokud jich není deset, méně, i žádná), `stoupaji` a `klesaji` (posun aspoň o 3 místa a 3 % délky pořadí, nejvýš 10), `dlouhoNevidene` (z horní třicítky ty, jejichž profil ani fotky jsi 30 dní neviděl; `dni` = −1 nikdy; až se zájem sleduje aspoň 30 dní), `trendDni`, `zajemDni`; položky `modelkaId`, `jmeno`, `hodnoceni`, `poradi` (potvrzené), `zmenaPoradi`, `dni`, `uroven` (potvrzená úroveň Top N, 0 = mimo top 100) |
| `GetOblibenost() StavOblibenosti` | `porovnani`, `modelek`, `presnost` (přesnost modelu vkusu na ověření u modelek ze skupin, kde se odhad ukazuje, 0–1), `odhady` (model prošel ověřením), `hodnocenych` (hodnocené modelky), `urovne` (Top 10, 20, 50, 100: `uroven`, prahy `potrebaPorovnani`, `maxNejistota`, `potrebaVyhry` a `potvrzenych`), `cekajicich` (modelky čekající na potvrzení úrovně), `poradi` – hodnocené a porovnávané modelky v potvrzeném pořadí: `modelkaId`, `jmeno`, `hodnoceni`, `sila`, `nejistota`, `poradi` (potvrzené), `mistoPodleSily` (bez prahů), `uroven` (10/20/50/100, 0 = mimo top 100), `ceka` (jen když by podle síly patřila výš, než má potvrzeno: `uroven`, `porovnani`/`potrebaPorovnani`, `nejistota`/`maxNejistota`, `potrebaVyhry`, `maVyhru`, `drzitelka` – splňuje prahy, ale místo obhajuje tahle modelka), `obhajoba` (držitelka, kterou silou předstihla jiná: `uroven`, `vyzyvatelka`), `porovnani`, `odhad`, `skoreFotek` (0 = žádná hodnocená fotka), `albFotek`, `fotekHodnocenych`, `jenOdhad` a `zdrojOdhadu` (nehodnocená neporovnaná jen odhadem podle vkusu, `"vkus"`), `duvod` („srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“, případně „porovnání ji staví výš než její srdíčka (síla 4,4)“ a odhad vkusu) |
| `GetMohloByTeLibit(pocet) []OblibenostModelky` | nehodnocené modelky s nejvyšším odhadem a důvodem (`odhad`, `duvod`; `sila` = nezaokrouhlený odhad, `nejistota` = chyba ověření u modelek s podobně bohatými údaji) |
| `GetNavrhSrdicek(id) NavrhSrdicek` | návrh srdíček – jediné místo, které je navrhuje: nehodnocené `hodnoceni` (úroveň síly po polovinách; 0 = zatím ne – méně než 3 porovnání nebo nejistota nad 0,6) s `porovnani`, `vyhry`, `nejistota`; hodnocené návrh z nesouladu se srdíčky (`nesoulad`, viz Nesoulad se srdíčky) |
| `GetDuvodOdhadu(id) string` | důvod ukázaného odhadu nehodnocené modelky („Odhad 4 srdíčka: blond, 70. léta, Pompeo Posar; podobně jako Anna (4½) a Bára (4)“), jinak `""`; štítek „odhad“ si ho načte při prvním najetí myší |
| `GetNahledyModelek(ids, pocet) map[int][]NahledFotky` | náhledy fotek modelek pro porovnání (nejvýš `pocet`, 1–24; nejvýš 100 modelek): `id` fotky, `url` (šablona s `{velikost}`), `album`, `typ`, `hodnoceni` (srdíčka fotky), `rotace`; neznámá modelka nebo bez fotek má `[]` |
| `Modelka.oblibenost` | srdíčka upřesněná porovnáním a zájmem (nejvýš ±0,49: o půl srdíčka se pořadí přehodit může, o celé ne); nehodnocená porovnávaná má sílu z porovnání, ostatní 0 |
| `Modelka.poradi`, `zmenaPoradi`, `trendDni` | potvrzené pořadí oblíbenosti od 1 (0 = mimo pořadí; oddíl Úrovně Top 10/20/50/100), o kolik míst výš než ve srovnávacím snímku (záporné = níž) a jeho stáří ve dnech (0 = trend zatím není) |
| `Modelka.urovenTop`, `cekaNaTop`, `obhajujeTop` | potvrzená úroveň Top N (10, 20, 50, 100; 0 = mimo top 100), úroveň, na jejíž potvrzení čeká (0 = nic), a úroveň, kterou obhajuje proti silnější vyzyvatelce (0 = nic) |
| `Modelka.odhadHodnoceni` | odhad modelu vkusu po polovinách jen u nehodnocené modelky ze skupiny údajů, kde odhad na ověření jasně překonal průměr, jinak 0 |

## Bradley–Terry

Každá modelka má skrytou sílu s na stupnici srdíček; P(víc se líbí i než j) = σ(k·(sᵢ − sⱼ)), k = 2 (o půl
srdíčka silnější vyhraje v 73 %). **Předpoklad** (oddíl Předpoklad síly): hodnocená modelka
N(srdíčka, 0,25²); nehodnocená s odhadem vkusu N(odhad, chyba ověření²), nehodnocená porovnávaná bez něj
N(průměr srdíček sbírky, 1,25²). Skóre fotek sílu neposouvá (oddíl Předpoklad síly).
Model vkusu se proto počítá před Bradley–Terry (učí se jen na srdíčkách upřesněných porovnáním a na údajích, na
výsledku Bradley–Terry nezávisí). Síla je tak jedno číslo, ze kterého berou pořadí, galerie, kotva v porovnání
i návrh srdíček. Porovnání sílu posunou dál; v `duvod` pak „porovnání
ji staví výš než její srdíčka“, když se síla od srdíček liší o víc než čtvrt srdíčka.
Remíza je půl výhry pro každou, porovnání váží podle stáří 0,5^(dny/365).

**Oblíbenost hodnocené modelky** = srdíčka + (s − srdíčka) oříznuté na ±0,49. Srdíčka jsou měkký předpoklad, ne
přihrádky: porovnání posunou čtyřku nad modelku se 4½ srdíčka, ale nad
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

## Předpoklad síly

**Srdíčka fotek jsou vůči modelce.** Říkají, jak dobrá je fotka té modelky, ne jak moc se ti líbí modelka: pět srdíček
u fotky jedničkové modelky je její nejlepší fotka, ne důvod ji posunout nad čtyřku. Skóre fotek proto sílu modelky
neposouvá, nedává návrh srdíček (oddíl Nesoulad se srdíčky) ani odhad nehodnocené modelky. Zůstává údajem v rozhraní
(„fotky 4,3“) a jedním z údajů modelu vkusu (oddíl Model vkusu), kde se váží podle toho, jak dobře předpovídá
srdíčka. Do 0.99.62 se skóre převádělo na stupnici srdíček a vážilo v předpokladu vahou naučenou z porovnání; mezi
modelkami se tím míchala srdíčka fotek různých modelek, jako by byla na jedné stupnici. Řazení fotek napříč modelkami
dělá hodnota fotky (srdíčka fotky × oblíbenost modelky ÷ 5, oddíl Zájem a trend).

**Předpoklad síly** v Bradley–Terry:

| Modelka | Střed | Směrodatná odchylka |
|---|---|---|
| hodnocená | H | 0,25 |
| nehodnocená s odhadem vkusu | odhad vkusu | chyba ověření ve skupině podle bohatosti údajů (jinak celková), 0,35–1,25 |
| nic, ale porovnávaná | průměr srdíček sbírky | 1,25 |

Bez porovnání je tak oblíbenost hodnocené modelky přesně její srdíčka (`TestFotkyNeposouvajiOblibenost`).
Nehodnocená neporovnaná s odhadem vkusu má oblíbenost rovnou odhadu a v Pořadí je označená jako odhad (`jenOdhad`,
`zdrojOdhadu` „vkus“); nehodnocená jen s hodnocenými fotkami v Pořadí není (`TestPoradiBezOdhaduZFotek`).

## Zájem a trend

Oblíbenost se nemá měnit jen tehdy, když porovnáváš. Program si proto všímá **zájmu** (`oblibenost_zajem.go`):
otevření profilu modelky (stejná modelka nejvýš jednou za 10 minut, i listování mezi profily) a času prohlížení
jejích fotek v prohlížeči (čas u jedné fotky nejvýš minuta, skryté okno se nepočítá; zapíše se při zavření
prohlížeče). Prohlížeč otevřený z Porovnávání nebo Rychlého hodnocení se nepočítá: fotky tam ukázal program, ne tvůj
zájem, a modelky, které program páruje často, by jinak sbíraly zájem jen proto (`prohlizetBezZajmu` v `zajem.js`). Záznamy jdou jen do databáze učení (tabulka `zajem`).

- **Skóre zájmu** modelky Z = Σ 0,5^(dny/60) · h, kde h = 1 za otevření profilu a sekundy/120 za prohlížení fotek
  (dvě minuty fotek = jedno otevření). Poločas 60 dní: oblíbenost sleduje, o koho se zajímáš teď.
- **Míra zájmu** z = min(log(1 + Z) / ref, 2), ref = medián log(1 + Z) modelek se zájmem (aspoň log 2).
  Logaritmus a strop drží desítky otevření jedné modelky na uzdě.
- **Posun předpokladu** síly v Bradley–Terry o v·z (u modelek s předpokladem: hodnocené, s odhadem vkusu
  a porovnávané). Váhu v se program učí z porovnání modelek se stejnými srdíčky, kde se zájem
  stran liší – u každého porovnání jen se zájmem z doby **před ním** (stejné váhy podle stáří k okamžiku porovnání,
  míra proti dnešnímu mediánu; `stavZajmu.skoreK`). Dnešní zájem by výsledek „předpověděl“ zpětně: otevřeš fotky
  modelky, vybereš ji, a zájem by vypadal užitečněji, než je (`TestVahaZajmuJenZajemPredPorovnanim`). Porovnání
  bez zájmu před ním se do učení nepočítají, mřížka 0–0,3 po 0,025 podle vážené log-ztráty (předpoklad stran ze srdíček), výsledek stažený k výchozí 0,1 jako by ji potvrdilo 20 porovnání. Pod 10 takových porovnání platí
  0,1 (`zajemNaucen: false`). Oblíbenost hodnocené modelky dál zůstává do ±0,49 od jejích srdíček: zájem přeskupí
  pořadí uvnitř úrovně, srdíčka nepřebije. Hrozí smyčka „řadím podle oblíbenosti → otevírám ty nahoře → víc
  zájmu“; proto je posun malý (výchozí nejvýš 0,2 srdíčka) a váhu určují porovnání, ne samotný zájem.
- Nové záznamy výsledek v paměti nezneplatní každý zvlášť (přepočet modelu vkusu stojí desítky ms): projeví se po
  každých 20 záznamech, po změně dat nebo druhý den. Důvod v pořadí ukáže „zájem: 8× profil, 14 min fotek za
  2 měsíce (+0,15)“.

**Historie a trend.** Po přepočtu modelu se zapíše snímek dnešní oblíbenosti a pořadí (`historie_oblibenosti`,
dnešní nejvýš jednou za hodinu). Trend je posun proti snímku z doby před 30 dny, dokud není, proti nejstaršímu aspoň
7 dní starému (`trendDni`); pořadí se pro srovnání počítá jen mezi modelkami, které jsou v obou snímcích, aby nově
ohodnocené modelky nevypadaly jako pád všech pod nimi. Pořadí ve snímku je potvrzené (s úrovněmi Top N), takže
vstup do top 10 je vzestup; snímek má značku (řádek s modelkou 0). Snímek ze starší verze značku nemá a srovnává se
podle oblíbenosti – jinak by po přechodu na úrovně vypadaly nepotvrzené oblíbené jako propad. Úklid jednou denně: po 60 dnech zůstane pondělní snímek, po
400 dnech nic, záznamy zájmu starší dvou let se smažou.

**Kde se oblíbenost projeví:** galerie Podle srdíček a filtr srdíček (se stejnými srdíčky podle oblíbenosti),
pořadí a trend v profilu a šipka na kartě (posun aspoň o 3 místa), Nejlepší fotky a stěna centerfoldů Podle
srdíček (podle hodnoty fotky = srdíčka fotky × oblíbenost modelky ÷ 5: srdíčka fotky říkají, jak dobrá je fotka té
modelky, takže pětisrdíčková fotka jedničkové modelky má hodnotu 1 a pětkové 5; Nejlepší mají oddíly po celých
hodnotách, `hodnotaFotky` v `lib/oblibenost.js`), Údržba (význam modelky v prioritě počítá
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


**Uspořádání stránky.** Nad pásy je hlavička: vlevo proč tahle dvojice (u souboje nebo ověření se štítkem „⚔ O postup
do Top 10“, „⚔ Ověření srdíček“), vpravo „Nesedí se srdíčky“ a dnešní počet porovnání. Pod pásy jen „⌫ Vrátit“,
„↓ Obě stejně“ a „S Přeskočit“; klávesy ukáže „⌨ Klávesy“ po najetí. Fotky v pásu jsou celé: pás má pevnou výšku
a každá fotka šířku podle svého poměru stran (do načtení 3 : 4), načítají se podle výšky pásu (`h400` atd., u otočených
o 90° podle šířky). Stejně se chová pás v rychlém hodnocení a alba v profilu modelky jsou mozaika se stejnou výškou
řad; poměry stran fotek si rozhraní pamatuje (`pomerFotky`), takže řady při dalším otevření neposkakují.
## Výběr dvojic

Aktivní učení: porovnání má smysl tam, kde je pořadí nejisté a kde na něm záleží – u stejné nebo sousední úrovně
srdíček. Kandidátky jsou ke každé hodnocené modelce nejbližší sousedé podle síly (10). Skóre dvojice je očekávaná
informace p(1 − p)·(Var sᵢ + Var sⱼ) krát váha úrovně (stejná 1, o půl srdíčka 0,7, o srdíčko 0,2, jinak nic; okruh
`stejne` jen stejná) krát váha modelky (bez titulní fotky i fotek 0,3; častá v posledních porovnáních se tlumí
1/(1 + 0,5·četnost), novější porovnání víc). Var s vychází z předpokladu: nejistá modelka (nehodnocená, s nejistým
odhadem vkusu) dostane přednost. Vynechají se dvojice z posledních 200 porovnání a posledních 60
nabídnutých, modelka je v jednom výběru nejvýš jednou. Asi pětina dvojic je **průzkum** (náhodná dvojice stejné
nebo sousední úrovně); semínko je z počtu porovnání a volání, výsledek je opakovatelný. Pořadí A/B je náhodné.
Výchozí výběr (`okruh ""`) nic přepínat nenechává: hodnocené dvojice a nehodnocené proti kotvě jsou dva seznamy
kandidátů a každá dvojice se bere z nehodnocených s pravděpodobností 0,33 (když jeden seznam dojde, z druhého).
Nehodnocené mají váhu podle toho, co o nich víme: rozpracovaná (už porovnaná, ale ještě bez návrhu srdíček) 2,5,
s odhadem vkusu 1, bez něj 0,35. Modelka s nesouladem se srdíčky (níž) má váhu 1,6, aby se
nesoulad dalšími porovnáními potvrdil nebo vyvrátil. Třetí seznam jsou **souboje na hranicích** top 10/20/50/100
(oddíl Úrovně Top 10/20/50/100): berou asi 30 % všech dvojic (z těch, které by jinak byly hodnocené).

Nehodnocenou modelku páruje výběr s kotvou, která má **přesně tolik srdíček, kolik vychází její
odhad** zaokrouhlený na polovinu srdíčka (stejné číslo, jaké ukazuje štítek „odhad“): odhad vkusu, jinak průměr
sbírky; jakmile je nehodnocená aspoň jednou porovnaná, její síla z porovnání. Výhra tak
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


**Proti opakování.** Program si pamatuje, jak ses v každé dvojici rozhodl (`vylouceneDvojice`): rozhodnutá dvojice
(jedna vede) se měsíc od posledního porovnání nenabízí, remíza nebo vyrovnaný stav (každá jednou vyhrála) se vrátí
jako rozstřel nejdřív za týden. Kdyby tím nebylo co porovnávat, platí pro všechny jen týdenní pauza. Přeskočená
dvojice se nenabízí, dokud je mezi 60 naposledy nabídnutými. Souboje a ověření srdíček navíc hlídají, aby se tatáž modelka neobjevovala pořád dokola: modelka
z posledních 12 porovnání nebo z 8 naposledy nabídnutých (ještě neporovnaných) dvojic je chvíli nedostane, ani jako
soupeřka (kromě souboje o obhajobu, ten rozhoduje). Modelka s nesouladem se ověřuje jen do 10 porovnání se stranou
nesouladu (podhodnocená s víc srdíčky, nadhodnocená s méně) – pak už důkazy má a rozhodnutí je na uživateli. Série
„Rozhodnout teď“ a „Ověřit porovnáním“ nedávno porovnané dvojice vynechá (čekající je dostane, jen když jiné
soupeřky nejsou) a rozhraní nezopakuje dvojici, která už čeká ve frontě. V simulaci (1500 porovnání) to snížilo
nejčastější výskyt jedné modelky z 84 dvojic na 27 a podíl dvojic s modelkou z posledních deseti z 13 % na 6 %;
přesnost pořadí se nezhoršila (P@10 0,78 proti dřívějším 0,77 na 16 semínkách).
## Nesoulad se srdíčky

`GetOblibenost().nesedi`: hodnocené modelky, kterým podle porovnání nesedí srdíčka. U každé se berou porovnání
s hodnocenými, které mají (dnes) jiná srdíčka; očekávaná výhra podle samotných srdíček je σ(2·(hᵢ − hⱼ)) (o půl
srdíčka silnější vyhraje v 73 %, o celé v 88 %). Rozdíl skutečných a očekávaných výher (vážený stářím porovnání) pod
−1,5 znamená, že modelka s víc srdíčky prohrává se slabšími – návrh o půl srdíčka méně (`smer: "mene"`); nad +1,5, že
s méně srdíčky vyhrává se silnějšími – o půl víc (`"vice"`). Jen s aspoň 3 takovými porovnáními. Položka: `modelkaId`,
`jmeno`, `hodnoceni`, `navrh`, `smer`, `porovnani` (s modelkami s méně, resp. víc srdíčky), `vysledky` (z nich
prohry, resp. výhry), `rozdil`. Tři prohry ze tří s modelkami o půl srdíčka slabšími dají rozdíl −2,2; dvě ze čtyř
−0,9 (nic).

Srdíčka fotek nesoulad nezakládají (jsou vůči modelce, oddíl Předpoklad síly; do 0.99.62 byla druhým zdrojem):
`zdroj` je vždy `"porovnani"` (`TestNesouladJenZPorovnani`). Řadí se podle síly nesouladu (|rozdíl|/1,5); v Pořadí se ukáže
prvních 8 a „Zobrazit všech“. V pásu porovnání je u jména skóre fotek („fotky 4,3“). V Pořadí je oddíl „Nesedí se srdíčky“ s „Dát jí 4 ♥“ a „Nechat“ (pamatuje se pro dané srdíčka a návrh),
v Porovnávání odkaz s počtem.


**Ověření porovnáním.** Ověřovací porovnání v běžném mixu jsou většinou se stejnou úrovní a o tom, jestli modelka
patří výš nebo níž, moc neřeknou. Proto modelka s nesouladem dostává ve výběru dvojic cíleně soupeřky z úrovně, kam
podle nesouladu patří (`souperkyOvereni`): úroveň návrhu a o půl srdíčka dál ve směru nesouladu (podhodnocená trojka
proti 3½ a čtyřkám, nadhodnocená proti 2½ a dvojkám), z každé úrovně ta silou nejbližší úrovni (typická zástupkyně).
Jdou ze seznamu soubojů (dvě na modelku, váha 2 × 0,45, druhá × 0,8), dvojice má `druh: "overeni"` a důvod „Ověření
srdíček: Anna má 3 srdíčka, ale porovnání ji staví výš – patří spíš na 3½ srdíčka? Soupeřka Bára (4 srdíčka)“; po
porovnání se pořadí hned přepočte. U nesouladu v Pořadí i v Hodnocení je „⚔ Ověřit porovnáním“: série čtyř takových
porovnání hned za sebou (`GetSoubojeModelky`, jako Rozhodnout teď). Po ní pruh řekne, jestli porovnání nesoulad
potvrdila („patří jí spíš 3½ ♥ místo 3 ♥“ s tlačítkem „Dát jí 3½ ♥“), nebo ne („3 ♥ jí sedí“).

## Úrovně Top 10/20/50/100

Do špičky oblíbenosti se modelka nedostane jen proto, že má hodně srdíček nebo vysoký odhad (`oblibenost_urovne.go`).
Každá úroveň má prahy; přísnější úroveň splňuje i prahy volnějších:

| Úroveň | Porovnání aspoň | Nejistota síly nejvýš | Navíc |
|---|---|---|---|
| Top 10 | 10 | 0,3 | aspoň jedna výhra nad modelkou potvrzenou v top 20 (remíza nestačí) |
| Top 20 | 6 | 0,4 | |
| Top 50 | 4 | 0,5 | |
| Top 100 | 2 | 0,6 | jen odhad (nehodnocená neporovnaná) nikdy |

Nejistota hodnocené modelky je díky předpokladu ze srdíček vždy pod 0,3, rozhoduje u ní počet porovnání (a výhra);
u nehodnocené se do top 100 čeká, až je její úroveň známá jako pro návrh srdíček (nejistota 0,6, oddíl Výběr
dvojic). Top 10 chce 10 porovnání místo původně navržených 8 – viz simulace níž.

**Potvrzené pořadí.** Oblíbenost (číslo) se nemění; mění se jen pořadí (`poradi`, ze kterého berou galerie, profil,
trend, historie, Přehled i výběr dvojic) a úroveň. Pořadí jen podle oblíbenosti je `mistoPodleSily`.

1. Splněná úroveň modelky je nejpřísnější, jejíž prahy splňuje. **Způsobilá** je pro ni, když je podle síly nejvýš
   na místě 2·N; jinak pro nejbližší volnější úroveň, kam okno sahá. Okno brání tomu, aby potvrzení vytáhlo slabší
   modelku z hloubky (dvacet hodně porovnávaných trojek nad nepotvrzené pětky); 2·N je nejvýš další hranice, takže
   modelka, která prahy své úrovně podle síly splňuje, v ní vždy zůstane.
2. Pořadí se plní místo po místě: na místo p jde nejsilnější zbývající modelka, která na ně smí (způsobilá pro top N
   smí na místa za předchozí hranicí, tedy top 10 od 1., top 20 od 11., top 50 od 21., top 100 od 51., ostatní od
   101.). Když nikdo takový nezbývá (úroveň nemá dost potvrzených), jde tam nejsilnější zbývající – nepotvrzená –
   a jen odhad až za všemi ostatními (za top 100 už podle síly). Modelka, která by podle síly byla 4., ale na top 10
   nemá, je tak 11. (s top 20 splněnou) nebo 21. (jen s top 50); bez porovnání se pořadí od oblíbenosti neliší.
   Výpočet je deterministický (síla, při shodě číslo modelky) a za O(n · úrovně).
3. Úroveň modelky (`uroven`, `Modelka.urovenTop`) je nejmenší N, kde je na místě ≤ N a je pro N způsobilá, jinak 0.
   Nepotvrzená na místě ≤ N má úroveň podle svých prahů (i 0).
4. Výhra pro top 10 závisí na potvrzené top 20, proto se pořadí počítá dvakrát: bez výher (do top 10 nikdo) → z něj
   potvrzená top 20 → znovu s výhrami.

**Čekání** (`ceka`, `Modelka.cekaNaTop`): modelka, která by podle síly patřila do vyšší úrovně, než má potvrzeno
(tedy nesplňuje její prahy), nese, kam by patřila a co jí chybí (`porovnani` z `potrebaPorovnani`, `nejistota`
proti `maxNejistota`, `potrebaVyhry` a `maVyhru`). `GetOblibenost` k tomu vrací `urovne` (prahy a počet potvrzených
v každé úrovni) a `cekajicich`. Přehled ukazuje v Top jen potvrzené v top 10 – dokud jich není deset, méně, i žádnou.

**Obhajoba** (top 10, 20 a 50): sestup je stejně těžký jako postup. Výpočet dostane držitelky z minulého výpočtu
(`drzitelky_urovni`, stav po posledním porovnání, které ještě platí) a po úrovních od top 10 porovná, kdo z úrovně
vypadl a kdo do ní nově přišel. Držitelka, která vypadla, ale prahy úrovně (bez výhry, tu už jednou splnila) a okno
2·N dál splňuje, místo obhájí proti nejslabší nové modelce v úrovni, která ji v posledním rozhodnutém vzájemném
porovnání neporazila (remíza se nepočítá). Ta je pro úroveň nezpůsobilá: čeká těsně pod hranicí s `ceka.drzitelka`,
držitelka nese `obhajoba` s vyzyvatelkou. Po každém kole se pořadí přepočítá a kolo se opakuje, dokud na uvolněné
místo přichází další silnější – všechny musí držitelku porazit (vyzyvatelkou v `obhajoba` je první). Bez souboje
držitelka místo ztratí, jen když prahy přestane splňovat nebo klesne silou pod místo 2·N. Nový stav držitelek se
zapíše po výpočtu (beze změny ne); vrácení porovnání smaže stavy po něm, takže se vrátí i obhajoba. Bez porovnání
ani držitelek se pořadí neliší od výpočtu bez obhajoby.

**Souboje ve výběru dvojic** (jen výchozí okruh): (o) vyzyvatelka proti držitelce, která místo obhajuje (váha 1,5
× váha úrovně, tedy před ostatními; důvod „Obhajoba top 10: Bára (10.) brání místo, Anna (11.) ji silou předstihla –
rozhodne jejich souboj“; vyzyvatelka pak nejde do (a)), (a) čekající proti poslední potvrzené v úrovni, kam by patřila
(tu by vytlačila; nejvýš tři soupeřky odspodu, když úroveň nemá nikoho potvrzeného, sousedky podle síly), (b) N.
proti N+1. místu, když se jejich oblíbenost liší nejvýš o 0,15. Do souboje nejde jen odhad ani nehodnocená, jejíž
úroveň ještě není známá (bez návrhu srdíček) – tu nejdřív porovnává kotva na úrovni odhadu, souboj o top 10 s modelkou,
kterou uživatel ani neohodnotil a jejíž síla je jen odhad, by porovnání plýtval. Skóre: váha úrovně (top 10 1, top 20
0,8, top 50 0,6, top 100 0,45) × váhy obou modelek (četnost v posledních porovnáních, nesoulad, fotka), u (a)
× 1/(1 + 0,01·místo podle síly) a 1; 0,8; 0,64 podle soupeřky (sousedka 0,8), u (b) × 0,8. Souboje jsou třetí seznam
kandidátů bez průzkumu; berou asi 30 % všech dvojic (z těch, které by jinak byly hodnocené; nehodnocené si svou
třetinu nechávají), dokud nějaké jsou – v praxi kolem 18 %. Dvojice má `druh: "souboj"` a důvod: „Souboj o top 10:
Bára (10.), nebo Anna (11.)? Silou jsou si blízko“, „Anna čeká na potvrzení do top 10 (5 z 10 porovnání, chybí výhra
nad top 20) – soupeřkou je Bára (10.), poslední potvrzená v top 10“ (jména v prvním pádě, cizí se skloňovat nedají).

**Rozhodnout teď** (`GetSoubojeModelky`, odkaz „⚔ Rozhodnout teď“ hned za štítkem čekání nebo obhajoby pod jménem modelky v Pořadí): místo čekání, až
se souboje náhodně objeví v mixu, dostane modelka sérii hned za sebou. Vyzyvatelka a držitelka mají jediný vzájemný
souboj. Čekající tolik soubojů, kolik jí chybí porovnání (při nejistotě nad prahem o dva víc), nejméně 2 a nejvýš 6:
potvrzené v úrovni, kam míří, odspodu (poslední potvrzená napřed); potřebuje-li výhru nad top 20 a úroveň nikoho
potvrzeného nemá, potvrzené v top 20; zbytek sousedky podle síly. Rozhraní dá sérii na začátek fronty Porovnávání
s pruhem „⚔ Rozhodnout teď: Anna o Top 10 · souboj 2 ze 4“ a ukazatelem postupu (Přeskočit i Vrátit fungují, Ukončit
vrátí běžný mix); po posledním souboji se pořadí přepočte a pruh řekne výsledek („postoupila do Top 10“, „zatím
nepostoupila – chybí …“, „obhájila“, „prohrála a vypadla“).

**Simulace** (`TestSimulaceUrovni`, bez `-short`; všechny varianty s `PLAYBOY_SIMULACE=vse`): 400 modelek, skutečná
síla t ~ N(3; 1) (0,3–5,4), 340 hodnocených se srdíčky = t + N(0; 0,3) zaokrouhlené na poloviny, uživatel odpovídá
podle Bradley–Terry se skutečnými silami na dvojice z `vybratDvojice` (po deseti, model se mezi dávkami přepočítá);
průměr 16 semínek. P@k = podíl skutečné top k mezi prvními k místy ukázaného pořadí; „falešné“ = potvrzené v top 10
mimo skutečnou top 10 (Top v Přehledu).

| Porovnání | P@10 dřív | P@10 teď | P@20 dřív | P@20 teď | P@50 dřív | P@50 teď | potvrzených top 10 | z nich falešných |
|---|---|---|---|---|---|---|---|---|
| 100 | 0,51 | 0,62 | 0,64 | 0,67 | 0,74 | 0,74 | 0 | – |
| 200 | 0,56 | 0,65 | 0,66 | 0,68 | 0,75 | 0,74 | 0,4 | 0,2 |
| 400 | 0,60 | 0,70 | 0,69 | 0,71 | 0,77 | 0,75 | 10 | 3,0 |
| 800 | 0,66 | 0,74 | 0,72 | 0,75 | 0,77 | 0,80 | 10 | 2,6 |
| 1500 | 0,69 | 0,76 | 0,75 | 0,78 | 0,81 | 0,82 | 10 | 2,4 |

Dřív = pořadí podle oblíbenosti bez soubojů (bez prahů prvních 10 obsahuje po 1500 porovnáních 3,1 falešné, teď
potvrzená top 10 2,4). Skutečná top 10 se potvrdí po mediánu 280 porovnání, do konce zůstanou nepotvrzené 1,8
(většinou správně – jsou si se sousedkami silou blízko). Ladění (po 1500 porovnáních):

| Varianta | P@10 | falešných v top 10 | medián potvrzení skutečné top 10 |
|---|---|---|---|
| prahy bez soubojů | 0,65 | – (potvrdí se 0,1) | 1470 |
| souboje 0,1 / 0,2 / **0,3** / 0,45 | 0,74 / 0,73 / **0,76** / 0,79 | 2,6 / 2,7 / **2,4** / 2,1 | 590 / 370 / **280** / 230 |
| navržené 8/6/4/2 | 0,72 | 2,8 | 210 |
| **10/6/4/2** | **0,76** | **2,4** | **280** |
| přísnější 12/8/5/3 | 0,81 | 1,9 | 340 |
| mírnější 6/4/3/2 | 0,75 | 2,5 | 160 |
| bez výhry nad top 20 | 0,75 | 2,5 | 280 |

Bez soubojů prahy škodí: špička se porovnává málo, takže se nikdo nepotvrdí a nedotažené mezery plní slabší.
Přísnější top 10 zpřesňuje, ale zpomaluje (10 porovnání je kompromis); víc soubojů pomáhá jen málo a bralo by dvojice
učení celé sbírky. Výhra nad top 20 v simulaci nic nemění (souboje stejně párují se špičkou), chrání ale před
modelkou, která nasbírá porovnání jen se slabšími (okruh „stejne“, kotvy nehodnocených).

Obhajoba (simulace předává držitelky z výpočtu do výpočtu; výpadek = modelka, která byla potvrzená v top 10 a po
dalším výpočtu není; 16 semínek, po 1500 porovnáních):

| Obhajoba | P@10 | P@20 | P@50 | falešných v top 10 | výpadků z top 10 | z nich skutečné top 10 | soubojů z dvojic |
|---|---|---|---|---|---|---|---|
| bez | 0,76 | 0,78 | 0,82 | 2,4 | 5,1 | 1,8 | 18 % |
| jen top 10 | 0,74 | 0,78 | 0,82 | 2,6 | 5,4 | 1,8 | 18 % |
| do top 20 | 0,76 | 0,77 | 0,82 | 2,4 | 5,2 | 1,2 | 18 % |
| **do top 50** | **0,77** | **0,77** | **0,82** | **2,3** | **5,1** | **1,2** | **18 %** |
| i top 100 | 0,76 | 0,77 | 0,76 | 2,4 | 4,4 | 1,0 | 30 % |

Do top 50 obhajoba o třetinu snižuje, jak často z top 10 vypadne modelka, která tam skutečně patří, a přesnost
nezhorší. Obhajoba i top 100 vytváří tolik soubojů, že zaberou celý jejich podíl a ubírají porovnání učení sbírky
(P@50 klesne o 6 bodů); obhajoba jen top 10 v simulaci nepomohla.

## Síň slávy

Kronika potvrzené top 10 (`oblibenost_slava.go`): kdo kdy vstoupil, vypadl, obhájil místo a kdo byl jedničkou.
Denní snímky historie se po čase mažou, proto má kronika vlastní trvalou tabulku `kronika_slavy`.

**Zápis.** Po každém přepočtu oblíbenosti se nová top 10 porovná s držitelkami uloženými v `drzitelky_urovni` (oddíl
Úrovně, obhajoba). Události:

| Druh | Kdy | `misto` | `souperka` |
|---|---|---|---|
| `zacatek` | první výpočet s touto verzí (modelka 0) | – | – |
| `pocatek` | v top 10 už byla, když kronika začala (dny jsou pak „aspoň“) | místo | – |
| `vstup` | potvrdila se v top 10 | místo | poslední porazená z porovnání od minulého stavu (přednost má ta, která zároveň vypadla) |
| `vystup` | z potvrzené top 10 vypadla | nové místo | poslední vítězka (přednost má ta, která vstoupila) |
| `obhajoba` | obhajovala top 10 a vyzyvatelku od minulého stavu porazila (poslední rozhodnuté vzájemné porovnání) | místo | vyzyvatelka |
| `jednicka` | nová jednička potvrzeného pořadí (i na začátku kroniky) | 1 | předchozí jednička |
| `konec` | jednička přestala být potvrzená v top 10 a nikdo ji nevystřídal | – | – |

Kdo obhajoval, se bere z minulého modelu v paměti (po spuštění programu první obhajoba chybí). Každá událost nese
poslední porovnání; vrácení porovnání smaže události po něm (a příští výpočet zapíše, co dál platí), zapomenutí
porovnání smaže celou kroniku. Simulace (`TestSimulaceUrovni`) skládá top 10 jen z událostí a hlídá, že po každém
výpočtu souhlasí s modelem; obhajoba top 10 je v ní vzácná (většina soubojů o obhajobu je o top 20 a 50).

**Výpočet** (`GetSinSlavy`): pobyty v top 10 (od `pocatek`/`vstup` do `vystup`, otevřený do teď)
dávají dny celkem, nejdelší a současný pobyt (po celých 24 hodinách); vlády jedničky (od `jednicka` do další
`jednicka` nebo `konec`) dny na prvním místě; nejlepší místo je nejmenší z událostí a současného. Rekordy: nejdéle
v top 10 celkem, nejdelší vláda jedničky, nejvíc obhajob, nejrychlejší postup (nejméně vlastních porovnání do
prvního vstupu – ne `pocatek`) a největší návrat (nejdelší pauza mimo top 10 před dalším vstupem); při shodě vyhrává
dřívější (u dnů celkem a obhajob nižší číslo modelky). Vitrína je současná potvrzená top 10, legendy bývalé top 10. Smazané modelky se vynechají.

**V rozhraní** (Oblíbenost › Síň slávy, `app/sin-slavy.js`, texty v `lib/slava.js`): karty modelek jako v galerii
Modelky – současná Top 10 v pořadí (první tři větší na stupních vítězů: 2. vlevo, 1. uprostřed nejvýš, 3. vpravo, každá na podstavci s číslem; místa 4–10 v jedné řadě přes celou šířku, karty se o ni dělí rovným dílem (v úzkém okně po čtyřech), místo vpravo nahoře, jednička s korunkou, pod jménem délka pobytu, obhajoby 🛡
a kolikátý pobyt, zlaté štítky 🏆 rekordů, podrobnosti v bublině), pod ní Legendy (vybledlé karty s nejlepším
místem, řady vyplněné rovnoměrně: nejvýš 7 v řadě, 8 → 4 + 4) a kronika jako jeden řádek s nejnovější událostí, po rozkliknutí celá po měsících (kdo byl v top 10 už na
začátku, je v jednom řádku).

## Model vkusu

Odhad srdíček nehodnocené modelky z jejích údajů (`oblibenost_vkus.go`), čistě v Go bez knihoven. Je to vážený
průměr dvou modelů, oba se učí na hodnocených modelkách a ověřují **křížovým ověřením** na 5 částech (rozdělení
podle čísla modelky, opakovatelné):

- **hřebenová (ridge) regrese** – hodnoty údajů jako 0/1: etnicita, národnost (sjednocená tabulkou zemí), vlasy, oči,
  typ prsou, košíček (A–D, DD+), ochlupení, tetování a piercing (ano/ne), desetiletí prvního výskytu, kategorie
  (i odvozené Playmate měsíce, Cyber Girl, Modelka obálky; rok na konci se zahodí, „Playmate roku 1998“ a „… 2003“
  jsou táž kategorie), fotografové alb; hodnota se počítá, když ji mají aspoň 3 hodnocené modelky (nejvýš 150
  nejčastějších). Číselné údaje (výška, váha, hrudník, pas, boky, BMI, poměr pas/boky, poměr hrudník/pas, věk při
  prvním vydání, rok prvního výskytu, průměr srdíček fotek, skóre fotek; poměr hrudník/pas a věk až od 60 hodnocených
  modelek s údajem) robustně standardizované (medián a 1,4826·MAD, oříznuté na ±3, chybějící = 0) a navíc
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

**Poměr hrudník/pas a věk při prvním vydání** (věk z data narození a prvního vydání, stejně jako v Údržbě, jen
14–60 let). Ověřeno na zkušebních sbírkách: zkušební sbírka má i datum narození (u 60 % modelek) a scénář, kde vkus
závisí i na věku (do 20 let +0,35, od 26 −0,35) a poměru hrudník/pas (od 1,5 +0,35;
`TestVyhodnoceniVkusuVekProporce`). Výsledek: kde na nich vkus závisí, pomáhají (3000 modelek ρ 0,407 → 0,425,
pokrytí 0,66 → 0,76, ukázané MAE 0,676 → 0,667; 400 modelek ρ 0,335 → 0,349), kde ne, nic nemění (3000: ρ 0,394 →
0,393). S 69 hodnocenými ale zhoršily (ρ 0,222 → 0,198, precision@10 0,70 → 0,62 – model se učil šum), proto se
berou až od 60 hodnocených modelek s údajem; pak je malá sbírka přesně jako dřív. U 400 modelek s 214 hodnocenými
ukáže model o něco méně odhadů (pokrytí 0,29 → 0,19), zato přesnějších (ukázané MAE 0,620 → 0,485, přesnost
0,72 → 0,76).

Pokrytí je podíl nehodnocených s ukázaným odhadem (průměr přes běhy, neplatný běh = 0). Porovnání variant na 12
semínkách (400) a 3 (3000): samotné stromy jsou na malých sbírkách horší než regrese (ρ 0,275 proti 0,303) a na
velké lepší (0,381 proti 0,373), průměr obou je nejlepší všude (0,310; 0,243; 0,394); pětiny číselných údajů zlepší
regresi (ρ 0,287 → 0,303, na 3000 0,348 → 0,373), sloupec „údaj chybí“ ani izotonický převod odhadu na srdíčka
nepomohly (převod zlepšil MAE, ale zhoršil pořadí a ověření pak přeceňovalo přesnost), porovnání dvojic jako
další signál nic nezměnilo (ρ ±0,002), údaj o fotkách jako skóre, průměr srdíček nebo obojí vyjde nastejno
(obojí je výchozí). Skupiny podle bohatosti sníží chybu ukázaných odhadů o 0,03–0,11 srdíčka za cenu menšího
pokrytí. Ověření tvrdí přesnost ukázaných odhadů s odchylkou do 0,05 (dřív podobně).

**Mezipaměť a výkon:** skóre fotek, BT i model vkusu se počítají najednou v paměti s otiskem (FNV-64a
z údajů všech modelek včetně srdíček fotek po albech a fotografů, počtu a posledního čísla porovnání a dnešního
data); GetModelky pak jen doplní čísla z map. Do souboru se výsledek neukládá (výpočet trvá desítky milisekund). Umělá sbírka 3000 modelek (1000
hodnocených, 500 porovnání, `TestVykonOblibenosti`): načtení modelek bez oblíbenosti asi 100 ms, GetModelky
z paměti asi 105 ms, první výpočet nebo po změně hodnocení asi 130–160 ms (BT + vkus asi 25 ms), výběr 10 dvojic
asi 120 ms (z toho většinu zabere načtení modelek). Se skóre fotek (`TestVykonNahleduASkore`):
`spocitatOblibenost` asi 50 ms (skóre fotek asi 1 ms; model vkusu se stromy asi 30 ms – části ověření regrese
i stromů a les ze všech hodnocených běží souběžně; dřív dvě varianty regrese a celkem 20–30 ms), `GetOblibenost`
z paměti asi 35 ms (dřív 10 ms; důvod odhadu ze stromů u 3000 modelek asi 17 ms), `GetNahledyModelek` pro 6
modelek bez paměti pod 1 ms, z paměti snímku desítky µs. Na realistické umělé sbírce (`TestVyhodnoceniVkusu`,
3000 modelek, 1000 hodnocených s 150 hodnotami údajů) trvá `spocitatOblibenost` dřív i nyní asi 45 ms, se 1800
hodnocenými asi 62 ms; GetModelky z paměti se nemění (asi 2 ms).

## Rychlé hodnocení

Pořadí je jen tak přesné, kolik modelek má srdíčka. Oblíbenost › Hodnocení (`app/rychle-hodnoceni.js`, úprava fronty
a klávesy v `lib/hodnoceni.js`, fronta v `oblibenost_hodnoceni.go`) ukazuje modelky jednu po druhé: vlevo velká
titulní fotka se jménem a srdíčky, vpravo pás jejích nejlepších fotek (`GetNahledyModelek`, klik otevře běžný
prohlížeč), pod ním odhad s důvodem nebo návrh. Enter odhad nebo návrh přijme, 1–5 dá srdíčka (podle polohy klávesy,
takže i v české klávesnici bez Shiftu), půlky klikem na srdíčka, N u nesouladu srdíčka nechá, S přeskočí, Backspace
vrátí poslední hodnocení.

**Fronta** (`GetFrontaHodnoceni`):

1. Nově přidané nehodnocené (posledních 14 dní, nejnovější napřed) – máš je čerstvě v hlavě a bez srdíček by v pořadí
   visely jako odhad.
2. Ostatní nehodnocené podle užitku pro pořadí: odhad + ½·nejistota. Nejistá „možná pětka“ může rozhodnout o top 10
   a model vkusu se na ní naučí nejvíc, jistá čtyřka méně. Odhad je síla z porovnání (už porovnávaná, nejistota
   z Bradley–Terry), odhad vkusu (nejistota = chyba ověření ve skupině bohatosti údajů), jinak průměr srdíček bez odhadu (nejistota 1,25). Bez fotek i titulky nakonec.
3. Hodnocené, kterým nesedí srdíčka (oddíl Nesoulad se srdíčky) – stejný návrh jako „Nesedí se srdíčky“ v Pořadí
   (odkaz „Projít v Hodnocení →“); „Nechat“ (N) se pamatuje společně s Pořadím.

Přeskočené si rozhraní pamatuje i po zavření (posledních 500) a dává je na konec fronty; ohodnocená z paměti zmizí.
Po každých pěti hodnoceních se odhady zbytku fronty obnoví (model vkusu se z nových srdíček hned učí), pořadí fronty
zůstává.

**Ochrana před ukotvením.** Číslo odhadu svádí dát přesně tolik, a model se pak učí sám ze sebe. Proto:

- nejistý odhad (nejistota nad 0,6) se ukáže až po 2 sekundách nebo po kliku na „Ukázat odhad“ (první Enter ho jen
  odkryje) – napřed rozhodnou fotky;
- Enter zapíše srdíčka přes `SetHodnoceniOdhadem`: databáze učení si v `prevzate_odhady` (úprava č. 6) pamatuje, že
  jsou jen přijatý odhad. Model vkusu se z takových srdíček neučí, dokud je nepotvrdí aspoň tři porovnání; změna
  srdíček (jiná hodnota než převzatá) z nich dělá zase běžná srdíčka.

**Porovnání jako učitel vkusu.** Nehodnocená modelka s aspoň třemi porovnáními a jistou silou (nejistota nejvýš 0,6,
jako pro návrh srdíček) jde do učení modelu vkusu se silou z porovnání (Bradley–Terry s předpokladem jen ze srdíček)
místo srdíček. Odhady se tak zlepšují i z porovnávání. Do ověření přesnosti ani mezi „podobné modelky“ v důvodu
odhadu se nepočítá – ty zůstávají srdíčkům, která jsi dal.
