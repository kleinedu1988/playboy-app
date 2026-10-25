# Strojové učení v Údržbě

Údržba se učí ze dvou věcí: ze **sbírky samotné** (co je vyplněné u ostatních modelek) a z **rozhodnutí
uživatele** (co přijal, odmítl, opravil nebo označil „V pořádku“). Z toho vznikají dvě služby:

- **Návrhy doplnění** chybějících údajů (`navrhy.go`) s jistotou, zdrojem a českým důvodem;
- **Kontrola** údajů, které vypadají jako překlep (`kontrola.go`, `kontrola_uceni.go`).

Vše běží na počítači bez sítě a bez knihoven, deterministicky (stejná data = stejné výsledky ve stejném pořadí).
Učení samo schéma sbírky nemění (hodnocení po polovinách srdíčka je úprava č. 13 sbírky, viz Oblíbenost níže).
Nic se nezapisuje do sbírky samo, jen po přijetí návrhu.

Třetí služba je **oblíbenost** (`oblibenost.go`, oddíly na konci): porovnání dvojic „Která se ti líbí víc?“,
jemné pořadí modelek (Bradley–Terry) a model vkusu, který odhaduje hodnocení nehodnocených modelek.

| Soubor | Co v něm je |
|---|---|
| `uceni_modely.go` | sdílené statistické nástroje: klíč textu, Jaro–Winkler, naučené sjednocení zápisů, podíl s předpokladem (Beta), log-šance a spojení zdrojů, četnosti při podmínce, profil postavy, robustní odhad, Choleského inverze, regrese s ověřením vynecháním jedné, k nejbližších sousedů |
| `navrhy.go` | zdroje návrhů, výběr a spojení zdrojů, přijetí a odmítnutí |
| `kontrola.go`, `kontrola_uceni.go` | pravidla kontroly, naučené rozsahy, neobvyklé kombinace, podobná jména, prahy |
| `uceni.go` | databáze učení: deník rozhodnutí, odmítnuté hodnoty, zápisy z oprav, kalibrace, prahy kontroly, mezipaměť, přehled a zapomenutí |
| `oblibenost.go` | porovnání dvojic, Bradley–Terry s předpokladem ze srdíček, výběr dvojic (aktivní učení), model vkusu a jeho ověření |

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

- **Zapomenout** (`ZapomenoutUceni`): databáze učení se nejdřív zazálohuje do složky záloh jako
  `uceni-RRRR-MM-DD-HHMMSS.mmm.db` (zůstává posledních 5; mezi zálohami sbírky se neukazují) a pak vyprázdní.
  Zapomene se jen naučené z rozhodnutí Údržby; sbírka se nemění. **Porovnání dvojic zůstanou** – jsou to
  výslovné soudy uživatele jako srdíčka, ne naučené z návrhů; smaže je zvlášť `ZapomenoutPorovnani` (se stejnou
  zálohou). Smazání souboru `playboy-uceni.db` zapomene obojí. Klíče
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
| `ZapomenoutPorovnani() bool` | záloha databáze učení a smazání všech porovnání |
| `GetOblibenost() StavOblibenosti` | `porovnani`, `modelek`, `presnost` (přesnost modelu vkusu na ověření, 0–1), `odhady` (model prošel ověřením), `poradi` – hodnocené a porovnávané modelky od nejoblíbenější: `modelkaId`, `jmeno`, `hodnoceni`, `sila`, `nejistota`, `poradi`, `porovnani`, `odhad`, `duvod` |
| `GetMohloByTeLibit(pocet) []OblibenostModelky` | nehodnocené modelky s nejvyšším jistým odhadem a důvodem (`odhad`, `duvod`; `sila` = nezaokrouhlený odhad, `nejistota` = chyba ověření) |
| `Modelka.oblibenost` | srdíčka upřesněná porovnáním uvnitř úrovně (nejvýš ±0,24, úrovně se nepřekrývají); nehodnocená porovnávaná má sílu z porovnání, ostatní 0 |
| `Modelka.odhadHodnoceni` | odhad modelu vkusu po polovinách jen u nehodnocené modelky s jistým odhadem, jinak 0 |

## Bradley–Terry

Každá modelka má skrytou sílu s na stupnici srdíček; P(víc se líbí i než j) = σ(k·(sᵢ − sⱼ)), k = 2 (o půl
srdíčka silnější vyhraje v 73 %). **Předpoklad ze srdíček:** hodnocená s ~ N(srdíčka, 0,25²), nehodnocená
porovnávaná N(průměr srdíček sbírky, 1,25²). Porovnání tak sílu posunou hlavně uvnitř úrovně, ale opakované
„překvapení“ ji posune i přes hranici (v `duvod` pak „porovnání ji staví výš než její srdíčka“; oblíbenost
zůstává v úrovni, srdíčka mění jen uživatel). Remíza je půl výhry pro každou, porovnání váží podle stáří
0,5^(dny/365).

Odhad je maximum aposteriorní hustoty, počítané **iteracemi MM** po souřadnicích: zakřivení logistické funkce je
nejvýš k²/4, takže krok sᵢ += gᵢ/(Σ w·k²/4 + 1/σᵢ²) hodnotu nikdy nezhorší (Böhningova mez) a konverguje k jedinému
maximu (cíl je konkávní). **Nejistota** je Laplaceova aproximace z diagonály Fisherovy informace:
Var sᵢ ≈ 1/(1/σᵢ² + Σ w·k²·p(1 − p)). Modelka bez porovnání má sílu rovnou předpokladu. Na umělých datech
(30 modelek jedné úrovně, 1500 porovnání) odhad vrátí pořadí se Spearmanovým ρ ≥ 0,9 (`TestBradleyTerryNajdePoradi`).

## Výběr dvojic

Aktivní učení: porovnání má smysl tam, kde je pořadí nejisté a kde na něm záleží – u stejné nebo sousední úrovně
srdíček. Kandidátky jsou ke každé hodnocené modelce nejbližší sousedé podle síly (10). Skóre dvojice je očekávaná
informace p(1 − p)·(Var sᵢ + Var sⱼ) krát váha úrovně (stejná 1, o půl srdíčka 0,7, o srdíčko 0,2, jinak nic; okruh
`stejne` jen stejná) krát váha modelky (bez titulní fotky i fotek 0,3; častá v posledních porovnáních se tlumí
1/(1 + 0,5·četnost), novější porovnání víc). Vynechají se dvojice z posledních 200 porovnání a posledních 60
nabídnutých, modelka je v jednom výběru nejvýš jednou. Asi pětina dvojic je **průzkum** (náhodná dvojice stejné
nebo sousední úrovně); semínko je z počtu porovnání a volání, výsledek je opakovatelný. Pořadí A/B je náhodné.
Okruh `nehodnocene` páruje nehodnocenou modelku s hodnocenými kotvami blízko jejího odhadu (vkus, jinak průměr).

## Model vkusu

Hřebenová (ridge) regrese oblíbenosti hodnocených modelek na jejich údaje, čistě v Go:

- hodnoty jako 0/1: etnicita, národnost (sjednocená tabulkou zemí), vlasy, oči, typ prsou, košíček (A–D, DD+),
  ochlupení, tetování a piercing (ano/ne), desetiletí prvního výskytu, kategorie (i odvozené: Playmate měsíce,
  Cyber Girl, Modelka obálky), fotografové alb; hodnota se počítá, když ji mají aspoň 3 hodnocené modelky (nejvýš
  150 nejčastějších);
- standardizovaně: výška, váha, hrudník, pas, boky, BMI a průměr srdíček jejích fotek (aspoň 2 hodnocené; silný
  signál); chybějící údaj = průměr.

λ ∈ {0,5; 2; 8; 32} se vybere **křížovým ověřením** na 5 částech (rozdělení podle čísla modelky). Gramova matice
se sčítá z řídkých řádků po částech, takže ověření jen odečítá části a řeší malé soustavy Choleským rozkladem.
Na ověření se měří průměrná odchylka od srdíček, táž chyba prostého průměru a **přesnost** = podíl modelek, u nichž
zaokrouhlený odhad trefí srdíčka ± půl srdíčka (`StavOblibenosti.presnost`, od 15 hodnocených).

**Přesnost má přednost před úplností:** odhady se ukazují jen při aspoň 30 hodnocených modelkách, chybě ověření
nejvýš 90 % chyby průměru a přesnosti aspoň 0,5; u modelky jen s aspoň 4 skupinami údajů. `GetMohloByTeLibit`
navíc bere jen odhady od mediánu srdíček sbírky (aspoň 2,5) a mlčí, když vysoké odhady na ověření sedí u méně
než 60 % (při aspoň 5 takových). **Důvod** jsou tři nejsilnější příspěvky wⱼ·(xⱼ − x̄ⱼ) ve směru odhadu („Odhad
4½ srdíčka: blond, 70. léta, Pompeo Posar“).

Umělá sbírka (200 hodnocených, hodnocení podle vlasů, desetiletí a fotografa se šumem σ = 0,3,
`TestModelVkusuOvereni`): chyba ověření 0,25 srdíčka proti 0,69 u průměru, přesnost 0,98, vysoké odhady sedí
v 90 z 96. Náhodné hodnocení ani 20 hodnocených ověřením neprojdou a nic se neodhaduje.

**Mezipaměť a výkon:** BT i model vkusu se počítají najednou v paměti s otiskem (FNV-64a z údajů všech modelek
včetně srdíček fotek a fotografů, počtu a posledního čísla porovnání a dnešního data); GetModelky pak jen doplní
čísla z map. Do souboru se výsledek neukládá (výpočet trvá desítky milisekund). Umělá sbírka 3000 modelek (1000
hodnocených, 500 porovnání, `TestVykonOblibenosti`): načtení modelek bez oblíbenosti asi 100 ms, GetModelky
z paměti asi 105 ms, první výpočet nebo po změně hodnocení asi 130–160 ms (BT + vkus asi 25 ms), výběr 10 dvojic
asi 120 ms (z toho většinu zabere načtení modelek).
