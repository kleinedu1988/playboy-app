# Strojové učení v Údržbě

Údržba se učí ze dvou věcí: ze **sbírky samotné** (co je vyplněné u ostatních modelek) a z **rozhodnutí
uživatele** (co přijal, odmítl, opravil nebo označil „V pořádku“). Z toho vznikají dvě služby:

- **Návrhy doplnění** chybějících údajů (`navrhy.go`) s jistotou, zdrojem a českým důvodem;
- **Kontrola** údajů, které vypadají jako překlep (`kontrola.go`, `kontrola_uceni.go`).

Vše běží na počítači bez sítě a bez knihoven, deterministicky (stejná data = stejné výsledky ve stejném pořadí)
a bez změny schématu sbírky (úprava č. 12) i formátu exportu (verze 8). Nic se nezapisuje do sbírky samo,
jen po přijetí návrhu.

| Soubor | Co v něm je |
|---|---|
| `uceni_modely.go` | sdílené statistické nástroje: klíč textu, Jaro–Winkler, naučené sjednocení zápisů, podíl s předpokladem (Beta), log-šance a spojení zdrojů, četnosti při podmínce, profil postavy, robustní odhad, Choleského inverze, regrese s ověřením vynecháním jedné, k nejbližších sousedů |
| `navrhy.go` | zdroje návrhů, výběr a spojení zdrojů, přijetí a odmítnutí |
| `kontrola.go`, `kontrola_uceni.go` | pravidla kontroly, naučené rozsahy, neobvyklé kombinace, podobná jména, prahy |
| `uceni.go` | databáze učení: deník rozhodnutí, odmítnuté hodnoty, zápisy z oprav, kalibrace, prahy kontroly, mezipaměť, přehled a zapomenutí |

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

- **Zapomenout** (`ZapomenoutUceni`): databáze učení se nejdřív zazálohuje do složky záloh jako
  `uceni-RRRR-MM-DD-HHMMSS.mmm.db` (zůstává posledních 5; mezi zálohami sbírky se neukazují) a pak vyprázdní.
  Stejné je smazat soubor `playboy-uceni.db`. Zapomene se jen naučené z rozhodnutí; sbírka se nemění. Klíče
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
| `ZapomenoutUceni() bool` | záloha a vyprázdnění databáze učení |
| `SetNetykaSe`, `SetNetykaSeAlba` | „V pořádku“ / „Znovu kontrolovat“ u nálezu se navíc zapíše do deníku se zdrojem pravidla |
| `Prehled.navrhu`, `Prehled.podezrele` | počet neodmítnutých návrhů a nálezy kontroly |

`NavrhDoplneni`: `modelkaId`, `jmeno`, `album` + `typ` (jen u alba), `pole`, `popis`, `hodnota` (přesně v tvaru,
v jakém se uloží), `jistota` (0–1, po kalibraci), `duvod`, `klic` (`nv-<pole>`), `inputId`, `odmitnuto`,
`zdroj` (stabilní klíč nejsilnějšího zdroje) a `zdrojPopis` (česky všechny zdroje hodnoty, např.
„místo narození + edice“).

`PodezrelyUdaj` má navíc `zdroj`: stabilní klíč pravidla (viz níže); klíč `ok-…` se nemění.

`StavUceni`: `soubor` (prázdný = jen v paměti), `velikost`, `udalosti`, `prijato`, `odmitnuto`, `opraveno`,
`naposledy`, `zdroje` – pro každý zdroj `zdroj`, `popis`, `navrhu` (současné neodmítnuté návrhy, které zdroj
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

## Mezipaměť a výkon

Návrhy i nálezy se ukládají (v paměti a v tabulce `mezipamet`) s **otiskem sbírky**: FNV-64a ze všech údajů,
ze kterých se počítají (modelky včetně odvozených vydání a „netýká se“, alba včetně počtu fotek a součtu jejich
čísel), z dnešního data, verze výpočtu a čísla poslední události deníku. Jakákoli změna dat nebo nové rozhodnutí
otisk změní, takže jiná invalidace není potřeba. Přehled tak při opakovaném otevření jen načte modelky a alba
(alba jedním dotazem pro seznamy, kontrolu i návrhy), spočítá otisk a vezme hotový výsledek; po spuštění
programu z mezipaměti v souboru.

Po změně dat se kontrola a návrhy počítají souběžně a mezipaměť se do souboru zapisuje na pozadí.

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
