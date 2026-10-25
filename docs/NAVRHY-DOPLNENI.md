# Návrhy doplnění chybějících údajů

Backend pro Údržbu (`navrhy.go`, testy `navrhy_test.go`): program navrhne hodnotu chybějícího údaje
modelky nebo alba s jistotou a českým zdůvodněním. Kombinuje pevná pravidla s jednoduchým, vysvětlitelným
učením z vlastní sbírky. Běží bez sítě, bez knihoven, deterministicky a bez změny schématu (úprava č. 12,
export 8). Nic se nezapisuje samo, jen po přijetí návrhu.

## Rozhraní

| Volání | Co dělá |
|---|---|
| `GetNavrhyDoplneni(vcetneOdmitnutych) []NavrhDoplneni` | návrhy seřazené od nejvyšší jistoty; odmítnuté jen na požádání (s `odmitnuto: true`) |
| `PrijmoutNavrh(n) bool` | zapíše hodnotu v transakci, **jen když je údaj stále prázdný** (jinak `false` a beze změny) |
| `PrijmoutNavrhy(n []) int` | hromadně: záloha „Před přijetím návrhů“ (`pred-prijetim-navrhu`), jedna transakce, vrací počet zapsaných |
| `OdmitnoutNavrh(n, odmitnout) bool` | klíč `nv-<pole>` do / z „netýká se“ modelky nebo alba |
| `Prehled.navrhu` | počet neodmítnutých návrhů pro odznak Údržby |

`NavrhDoplneni`: `modelkaId`, `jmeno`, `album` + `typ` (jen u alba), `pole`, `popis`, `hodnota` (přesně v tvaru,
v jakém se uloží), `jistota` (0–1), `duvod`, `klic` (`nv-<pole>`), `inputId` (pole formuláře modelky, u alba
prázdné), `odmitnuto`.

Údaje (`pole` → `inputId`): `narodnost` → `inputNarodnost`, `etnicita` → `inputEtnicita`, `vlasyBarva` →
`inputVlasy`, `ociBarva` → `inputOci`, `velikostPrsou` → `inputVelikost`, `obvodHrudnikCm` / `obvodPasCm` /
`obvodBokyCm` → `inputHrudnik` / `inputPas` / `inputBoky`, `role` → `inputRole`; u alba `vydaniAlba`,
`fotografAlba`, `datumAlba`.

Zvláštnosti zápisu: obvody se zapíšou jen v rozumných mezích (`priznaky` v `kontrola_uceni.go`) a se všemi třemi
obvody se složí i míry (jako při uložení formuláře). Kategorie (`role`) se k zapsaným **přidá** („Celebrita,
Playmate roku 1998“); „prázdná“ je, dokud modelka Playmate roku zapsanou nemá. Vydání alba jen u pictorialu
časopisu, datum jen u online alba (stejná pravidla jako `SetVydaniAlba` a `SetDatumAlba`).

## Zdroje návrhů

| Údaj | Zdroj | Příklad důvodu | Jistota |
|---|---|---|---|
| Národnost | místo narození: naučené ze sbírky + tabulka zemí (státy USA a zkratky „TX“, provincie Kanady, velká města, české i anglické názvy, drobný překlep přes Jaro–Winkler ≥ 0,94) | „místo narození Texas → USA (tabulka zemí; ve sbírce 12 z 12 modelek odtud)“, „místo narození Lhota → Slovensko (3 z 3 modelek sbírky narozených tamtéž)“ | Laplace (k + 1)/(n + 2), tabulka váží jako 8 modelek své země (bez dat 0,9); národnost, kterou sbírka ještě nemá, × 0,8 |
| Národnost | jen čísla jedné edice (typicky jen česká) | „vyšla jen v edici CZ; 34 z 37 takových modelek sbírky má národnost Česko“ | Laplace, aspoň 5 modelek a práh 0,8 |
| Etnicita | podle národnosti | „národnost Japonsko: 12 z 12 modelek sbírky má etnicitu asijská“ | Laplace, aspoň 8 modelek, práh 0,85, strop 0,9 |
| Barva vlasů, očí | podle etnicity + národnosti, jinak jen etnicity, jinak jen národnosti (nejkonkrétnější podmínka s dost modelkami, ne ta nejvýhodnější) | „etnicita asijská, národnost Japonsko: 36 z 36 modelek sbírky má barvu vlasů černá“ | Laplace, 10 / 15 modelek, práh 0,85, strop 0,9 |
| Obvody | text „míry“ v cm (90-60-90) nebo palcích (36-24-36, převod × 2,54) | „z měr 36-24-36 (palce): 24″ = 61 cm“ | cm 0,97, palce 0,9; nesouhlasí-li míry s vyplněnými obvody, nic |
| Velikost prsou | košíček v mírách (34C-24-35); číslo u košíčku je obvod pod prsy, hrudník se z něj nebere | „z měr 34C-24-35 převedeno na evropskou velikost jako ve sbírce (34C → 75C)“ | 0,95; převod na tvar sbírky (evropský, jen košíček) 0,8; evropská → americká se nepřevádí |
| Obvody | odhad lineární regresí z ostatních údajů postavy (výška, váha, další obvody; aspoň dva) | „odhad z údajů výška 170 cm, váha 50 kg, boky 90 cm podle 312 modelek sbírky (přesně ±1 cm u 41 %, ±2 cm u 63 %)“ | podíl ±1 cm, strop 0,6 – nikdy „jistý“; jen když ±2 cm sedí aspoň u 60 % a model má 40+ modelek |
| Kategorie | „Playmate of the Year 1998“, „Playmate roku 1998“, „PMOY 1998“ v poznámce, tagách, vystoupení nebo názvu alba | „poznámka uvádí Playmate roku 1998, první centerfold 1997“ | 0,92; bez centerfoldu 0,75; rok mimo první centerfold až +3 roky (kontrola `ok-pmoy`) nebo dva různé roky → nic |
| Vydání alba | datum v názvu pictorialu (červen 1995, June 1995, 06/1995, 1995-06, …; „CZ“ v názvu → `-CZ`) | „název alba „Playboy červen 1995“ obsahuje datum; ve sbírce sedí u 40 z 41 pictorialů s datem v názvu“ | předpoklad 0,85 o váze 6 modelek, upřesněný sbírkou |
| Vydání alba | číslo jediného centerfoldu, když má modelka jediný pictorial bez vydání a žádný v tom čísle (rok v názvu musí sedět) | „pictorial playmate vychází v čísle jejího centerfoldu (1997-05); ve sbírce sedí u 236 z 240 playmate s jedním centerfoldem“ | předpoklad 0,75 o váze 4 |
| Datum alba | datum v názvu online alba (i jen rok) | „název alba „Cyber Girl 2004-06-14“ obsahuje datum“ | předpoklad 0,85 (jen rok 0,6) o váze 6 |
| Fotograf alba | jiné album modelky ze stejného čísla (typicky centerfold) | „fotograf jejího alba ze stejného čísla 1997-05“ | předpoklad 0,8 o váze 4 |
| Fotograf alba | všechna ostatní alba modelky (aspoň 2) má jeden fotograf | „všechna její ostatní alba s fotografem (3) nafotil Stephen Wayda“ | předpoklad 0,5 o váze 2 – bez dat se nenabízí |

Hodnoty se píšou **zápisem sbírky**: hodnoty se seskupí podle zjednodušeného textu (bez diakritiky, velikosti
písmen a teček) a navrhne se nejčastější zápis skupiny. Národnost se navíc přes tabulku zemí sjednotí napříč
tvary („USA“, „Americká“, „American“ = jedna země) – když sbírka píše „Americká“, návrh zní „Americká“.

## Jistota

Jistota je odhad pravděpodobnosti, že je hodnota správně, a počítá se poctivě z dat sbírky:

- **Četnosti** (místo, etnicita, vzhled, edice): (k + 1)/(n + 2), kde k je počet modelek s navrženou hodnotou
  a n všech se stejnou podmínkou (Laplaceovo pravidlo). Jedna shodná modelka dá 0,67 a neprojde.
- **Pravidla** (název alba, centerfold, fotograf): (k + p·w)/(n + w). Pravidlo se nejdřív vyzkouší na albech,
  která údaj mají (vynechání jednoho: jako by údaj chyběl), k = kolikrát by trefilo, n = kolikrát by se
  použilo; p je předpoklad bez dat, w jeho váha. Nová sbírka tak dostane rozumný předpoklad, velká sbírka
  svou skutečnou úspěšnost.
- **Odhad obvodu**: podíl modelek, u nichž by zaokrouhlený odhad bez nich samých (leave-one-out přes diagonálu
  projekční matice) trefil skutečnost do ±1 cm, nejvýš 0,6. Regrese je robustní (po prvním odhadu se vynechají
  modelky s reziduem nad 3 robustní σ, typicky překlepy).
- **Prahy:** návrh pod 0,7 se nenabízí (odhad obvodu má vlastní podmínku ±2 cm u 60 %); vzhled a etnicita jen
  od 0,85, národnost podle edice od 0,8. Strop 0,99 pro všechno a 0,9 pro naučený vzhled.
- **Spor:** dva zdroje navrhují pro stejný údaj různé hodnoty a oba by skoro prošly → údaj se nenavrhuje.
- Doporučení pro rozhraní: ≥ 0,9 „skoro jistě“ (lze nabídnout „Přijmout vše“), 0,7–0,9 „pravděpodobně“,
  odhady obvodů zvlášť jako „odhad“ (nikdy hromadně).

## Co se program učí

- Ze sbírky při každém výpočtu (nic se neukládá): četnosti místo → národnost, edice → národnost, národnost →
  etnicita, (etnicita, národnost) → vlasy a oči, zápisy hodnot, úspěšnost pravidel alb, regrese obvodů.
- Z odmítnutí: odmítnutý návrh se uloží jako `nv-<pole>` v `netyka_se` (jako `ok-…` u kontroly) a nevrací se.
  Návrhy se stejným vzorem u ostatních modelek ztratí jistotu × 6/(6 + d), kde d je počet odmítnutí; vzor je
  údaj + zdroj + hodnota (u alb, měr a odhadů údaj + zdroj). Dvě odmítnutí „místo → USA“ tak sníží 0,9 na 0,675
  a takové návrhy zmizí; důvod návrhu to říká („podobný návrh odmítnut 1×“). Zrušení odmítnutí učení vrátí.

## Omezení

- Klíče `nv-…` jdou do exportu v `netyka_se`; program starší než tato verze je při importu tiše zahodí
  (stejně jako jiné neznámé klíče) – ztratí se jen odmítnutí.
- Odmítnutí platí pro údaj, ne pro hodnotu: odmítnutá národnost se u modelky nenavrhne ani s jinou hodnotou.
- Místo narození nerozhoduje o národnosti (narozené na americké základně v Německu); tabulku přehlasuje sbírka,
  jakmile má z místa pár modelek. Gruzie/Georgia a Československo/SSSR v tabulce nejsou (nejednoznačné).
- Místo narození, datum narození a další údaje bez opory ve sbírce se nenavrhují vůbec.
- Tvar velikosti prsou se pozná jen u tvaru „číslo + košíček“ nebo „košíček“; jiné zápisy se nepřevádějí.
- Výpočet je lineární (3000 modelek pod 0,1 s); volá se při každém načtení Přehledu kvůli počtu.
