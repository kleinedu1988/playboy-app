# Revize Go backendu – logika (23. 10. 2026, verze 0.99.5)

Rozsah: hledání (`app.go` GetModelky, odpovidaHledani, poleHledani, parsovatNumerickyFiltr, Levenshtein,
zjednodusit; FTS5 v `clanky.go`), `kontrola.go` a `kontrola_uceni.go`, odkazy a kontrola souborů na Google Disku,
adresy obrázků, kalendář a vydání (`GetKalendar`, `GetVydani`, speciály, edice, soulad s `RADY_EDIC`), `main.go`,
`verze.go`, `instalovat.sh`. Kód se neměnil; ověřovalo se testy na kopii repozitáře mimo projekt.

`go vet ./...` bez nálezů, `go test -count=1 ./...` prošel (5,4 s).

## 1. Souhrn

Backend je v dobrém stavu: kontrola sbírky je deterministická, dobře pokrytá testy a rychlá; odkazy na Disk se
všude (vložení, úprava, import) ověřují regulárním výrazem, takže do adresy obrázku se nedostane nic cizího.
Našly se tři ověřené chyby opravitelné v betě bez změny schématu i exportu: cílené hledání `rok:`/`narozena:`
s hodnotou ve tvaru `RRRR-MM` se chápe jako rozsah `1..RRRR` (a stejné pravidlo ve frontendu rozbíjí
`vydani:RRRR-MM` v Číslech a Kalendáři), vložení smíšeného seznamu odkazů a holých ID tiše zahodí holá ID
a kontrola hlásí falešné „úmrtí před prvním vydáním“ u data úmrtí zapsaného jen rokem. Dále souběh při ověřování
nové šablony adresy obrázků a několik drobností pro období po 1.0 (sémantika `hodnoceni:<N`, prázdné pole v dotazu,
denní dávka kontroly souborů, kontrola řad edic v backendu).

## 2. Nálezy

| # | Závažnost | Kde | Co je špatně a jak se projeví | Návrh opravy | Typ | Prac. | Jistota |
|---|---|---|---|---|---|---|---|
| 1 | chyba | `app.go:1350-1354`, `app.go:1596-1600` | `parsovatNumerickyFiltr("1975-01")` vrátí rozsah `..` 1–1975 (`vzorRozsahCisel` bere `RRRR-MM` jako „od-do“). `rok:1975-01` tak najde **všechny** modelky s vydáním do roku 1975, `narozena:1975-03` všechny narozené do 1975. Uživatel přitom píše tvar, který zná z vydání. | U `rok` a `narozena` brát rozsah jen tehdy, když obě meze mají 4 číslice; jinak `ok = false`. Pro `rok:` s hodnotou `RRRR-MM…` navíc hledat jako předponu v poli `vydani` (`strings.HasPrefix` přes `m.Vydani`). | **PATCH (beta teď)** | S | ověřeno (test na kopii) |
| 2 | chyba (frontend, stejné pravidlo) | `frontend/src/lib/format.js:482-487` (`vyhovujeCislu`) | V cíleném poli se `^(\d+)\s*(?:\.\.\|-)\s*(\d+)$` bere jako rozsah a čísla se berou ze všech číslic textu. `vydani:1975-01` v Číslech, Kalendáři, stěně centerfoldů a Nejlepších odpovídá **každému** číslu (z „1980-05“ se vezme i 5 ∈ 1..1975). `rok:1975-01` totéž jako #1. Go hledání modelek `vydani:` nemá jako číselné, tam funguje správně. | Rozsah a porovnání jen u číselných polí (`rok`, `narozena`, `vyska`, `vaha`, `hodnoceni`, `srdicka`), u `rok`/`narozena` jen se 4 číslicemi v obou mezích – stejně jako oprava #1, aby frontend a backend souhlasily. Předat revizi frontendu. | **PATCH (beta teď)** | S | ověřeno (node) |
| 3 | chyba | `app.go:1026-1033` (`parseDriveIDs`) | Holá ID se hledají jen tehdy, když v textu není žádný odkaz. Vložení seznamu „odkaz + holá ID“ uloží jen fotky z odkazů; holá ID tiše zmizí – nepočítají se ani jako nedostupná, ani jako duplicitní (`AddBulkPhotos`, `VysledekVlozeni`). | Smyčku přes `strings.Fields` spouštět vždy (podmínku `len(ids) == 0` odstranit); `seen` duplicity ohlídá a token s `/` nebo `:` vzorem `vzorHolehoID` neprojde, takže z odkazů nic navíc nevznikne. | **PATCH (beta teď)** | S | ověřeno (test na kopii) |
| 4 | chyba (nízká) | `kontrola.go:175` (i `:173`) | Porovnání řetězců různé délky: úmrtí „1980“ a první vydání „1980-08“ → `"1980" < "1980-08"` → nález „datum úmrtí 1980 je před prvním vydáním“, i když může být po něm. Obdobně `umrti < narozeni` u úmrtí jen rokem ve stejném roce jako úplné narození. | Porovnávat na společnou přesnost: `umrti[:n] < prvni[:n]` s `n = min(len(umrti), 7)` (a stejně u narození). Nehlásit, když se kratší údaj s delším shoduje na své délce. | **PATCH (beta teď)** | S | ověřeno (test na kopii) |
| 5 | riziko | `app.go:563-567` (`SetSablonaObrazku`) | Pro ověření se nová šablona dočasně uloží do globální `sablonaObrazku` a ověření trvá až 20 s (`klientDisku`). Wails volá metody souběžně: když mezitím běží denní dávka (`sprava.js:160`, spouští se po startu) nebo načítání modelek/fotek, použije neověřenou šablonu. U chybné šablony dávka zapíše fotkám `nedostupne_od` a rozhraní dostane rozbité adresy. | `overitSouborNaDisku` rozdělit na `overitSouborSablonou(sablona, id)`; `SetSablonaObrazku` ověří vzorek s předanou šablonou a globální hodnotu změní až po úspěchu. Výměnná `overitSoubor` pro testy zůstane. | **PATCH (beta teď)** | S | pravděpodobné (souběh, odvozeno z kódu) |
| 6 | chyba (nízká) | `app.go:1307` (`vzorSlovaHledani`), stejně `format.js:432` | Pole s prázdnou hodnotou a mezerou „spolkne“ další slovo: `vlasy: tetovani:ano` → klíč `vlasy` s hodnotou `tetovani`, zbytek `:ano` → 0 výsledků. Stává se při psaní (pole zatím bez hodnoty, za ním další filtr). | Hodnotu za mezerou po dvojtečce nebrat, když za ní hned následuje `:` (dodatečná kontrola pozice shody; Go regexp nemá lookahead). Opravit souběžně v Go i JS. | PATCH (po 1.0) | S | ověřeno (test na kopii) |
| 7 | zlepšení | `app.go:1392-1396` | `hodnoceni:<2` nehodnocené modelky vynechá (`numOd > 0`), `hodnoceni:0..1` je zahrne, `-hodnoceni:>=2` taky. Nekonzistentní význam „bez hodnocení“. | Rozhodnout jedno pravidlo (např. nehodnocená jen při explicitní 0 v rozsahu) a zapsat do nápovědy; test na všechny tři tvary. | PATCH (po 1.0) | S | ověřeno |
| 8 | zlepšení | `app.go:2502-2507` | Komentář říká „nejdřív ty, které už nedostupné byly“, SQL ale řadí jen podle `overeno` (záměrně, viz changelog „nevyhladoví na trvale nedostupných“). Důsledek: fotka nedostupná dnes se denní dávkou ověří znovu až po projití celé sbírky (20 000 fotek / 300 ≈ 67 dní), teprve pak je „opakovaně“ a nabídne se k odebrání. | Do dávky přidat malý podíl (např. 30 z 300) fotek s `nedostupne_od < dnes`, které nebyly ověřeny dnes; opravit komentář. | MINOR → 1.6 Náhledy na disku (nebo 1.4 Google Disk II) | S | ověřeno |
| 9 | zlepšení | `app.go:2545-2560` | `zkontrolovat` ignoruje chyby `tx.Exec` i `tx.Commit` (v `defer`). Při zamčené databázi se výsledek kontroly ukáže, ale nezapíše a nikdo se to nedozví. | Chyby sbírat, `Commit` volat explicitně a hlásit `a.chyba("kontrola souborů", err)`. | PATCH (po 1.0) | S | ověřeno (čtení kódu) |
| 10 | zlepšení (výkon) | `clanky.go:338-345`, volá `naseptavac.js:201` | `HledatClanky` po FTS dotazu vždy spustí `hledatClankyZalozni` = načtení všech článků s celým textem a `zjednodusit` nad každým – a to na každý stisk klávesy v našeptávači (od 2 znaků). U stovek dlouhých přepisů roste odezva našeptávače lineárně s objemem textu. | Záložní průchod omezit na jména modelek a název (bez `text`) přes SQL, nebo ho spouštět jen při prázdném výsledku FTS; případně mezipaměť zjednodušených textů. | MINOR → 2.0 Chytré hledání I | M | pravděpodobné (nezměřeno) |
| 11 | zlepšení | `kontrola.go:98`; `RADY_EDIC` jen ve `format.js:13` | Backend řady edic nezná: kontrola `ok-vydani-alba` hlídá jen roky 1953–letos. Album nebo centerfold `2005-03-CZ` (CZ až od 2011-07), US `2022-05` (měsíční řada do 2020-03) nebo `1953-05` projde zápisem (`SetVydaniAlba`, `AddCover`, import) i kontrolou; v kalendáři pak číslo „mimo řadu“ visí bez možnosti ho označit. | Řady edic přenést do Go (jedna tabulka, test hlídá shodu s `format.js`) a přidat nález „číslo mimo řadu edice“ s klíčem `ok-vydani-alba`. | MINOR → 1.9 Kvalita dat (kontrola při zadávání) nebo 1.10 | M | ověřeno (čtení kódu) |
| 12 | zlepšení | `kontrola.go:164`, `statistiky.go:66-69` | `vekKVydani` vyžaduje měsíc narození; u modelek s narozením jen rokem se věk při prvním vydání nekontroluje a ani se z nich rozsah věku neučí (`priznakyModelky`). Překlep roku (1995 místo 1959) u nich zůstane nepovšimnut, pokud nenastane „narození po vydání“. | Pro rok bez měsíce počítat věk s tolerancí ±1 rok (nález jen když je mimo rozsah i v lepším případě). | MINOR → 1.10 Kontrola 2.0 | S | ověřeno (čtení kódu) |
| 13 | zlepšení (výkon) | `app.go:1011` | `parseDriveIDs` kompiluje regulární výraz při každém volání; `nactiModelky` ho volá pro každou modelku (`app.go:1174`) při každém hledání. | Výraz přesunout do proměnné balíčku vedle `vzorHolehoID`. | PATCH (po 1.0) | S | ověřeno |
| 14 | zlepšení (bezpečnost) | `app.go:553-557` | Šablona adresy obrázků přijme jakékoli schéma a hostitele (`http://`, `localhost`); ověření pak pošle požadavek tam. Jde o lokální aplikaci a vstup od uživatele, riziko je malé. | Vyžadovat `https://` a hostitele; jinak hláška „Šablona musí začínat https://“ (nový text → až po 1.0). | PATCH (po 1.0) | S | ověřeno |
| 15 | zlepšení (bezpečnost) | `frontend/index.html:7` | CSP obsahuje jen `script-src 'self'; object-src 'none'; base-uri 'none'` – chybí `default-src`, `connect-src`, `frame-src`, `form-action`. Obrázky musí zůstat volné kvůli vlastní šabloně, ostatní ne. | Doplnit `default-src 'self'; connect-src 'self'; frame-src 'none'; form-action 'none'; img-src * data: blob:; style-src 'self' 'unsafe-inline'` a ověřit na Fedoře (0.90.0 ověřovala, že okno není prázdné). | PATCH (po 1.0) | S | ověřeno (čtení), dopad pravděpodobný |

Prošlo bez nálezu: `zjednodusit` (diakritika, ł/ø/ß), klíče s diakritikou (`výška:`, `úmrtí:`), edice v `poleHledani`
(`1995-S01-CZ`, `2012-CZ`), `GetVydani` pro ročník a edici (GLOB nezachytí cizí edici), `rozlozitRocnik`, `jeSpecial`,
`GetKalendar` (náhled cover → centerfold → pictorial, alba bez fotek vynechána), `ZalozitSpecial`/`GetSpecialy`,
`overitKlicAlba`, ověření ID při importu (`export.go:359`), `overitSoubory` (souběh max. 8, pořadí výsledků),
Mahalanobis/Cholesky se smršťováním, deterministické pořadí nálezů podobných jmen, `idInstance`,
verze 2.16.0 shodná v `go.mod`, README a `instalovat.sh`.

## 3. Opravy pro betu (PATCH teď)

### #1 – `rok:`/`narozena:` s hodnotou `RRRR-MM` (0.99.6)
- **Oprava:** v `odpovidaHledani` (`app.go:1596`) rozšířit podmínku: pro `rok` a `narozena` platí číselný filtr jen
  když `op != ".."` a hodnota má aspoň 4 číslice, nebo `op == ".."` a obě meze mají právě 4 číslice (kontrola na
  textu hodnoty, např. regulárním výrazem `^\d{4}\s*(-|\.\.)\s*\d{4}$`). Jinak `ok = false` → textové hledání v poli.
  Pro `rok` s hodnotou `^\d{4}-` hledat v poli `vydani` (předpona), aby `rok:1975-01` našlo modelky čísla 1975-01.
- **Test:** do tabulkového testu hledání (`app_test.go` kolem ř. 2664) přidat `rok:1975-01` → jen modelka
  s vydáním 1975-01, `narozena:1975-03` → nic navíc (nikoli všechny narozené do 1975), `rok:1970-1979` dál rozsah.

### #2 – stejné pravidlo ve frontendu (0.99.6, spolu s #1)
- **Oprava:** `vyhovujeCislu` ve `format.js` volat jen pro číselná pole a u `rok`/`narozena` jen se čtyřmístnými
  mezemi; pro `vydani` vždy textová shoda. Změna nemění texty ani funkce, jen opravuje výsledek.
- **Test:** `frontend/test` – `vyhovujeHledani(['1980-05'], rozlozitDotaz('vydani:1975-01'), poleCisla('1980-05'))`
  musí být `false`, pro `'1975-01'` `true`; `rok:1975-01` u `1960-02` `false`.

### #3 – smíšený seznam odkazů a holých ID (0.99.7)
- **Oprava:** v `parseDriveIDs` odstranit podmínku `if len(ids) == 0` kolem smyčky přes `strings.Fields`.
  Holé ID musí být celé slovo vyhovující `^[a-zA-Z0-9_-]{25,}$`, takže z odkazu (obsahuje `/`, `:`, `?`) nic nevznikne
  a `seen` zabrání zdvojení. Komentář „Pokud uživatel vložil pouze jedno čisté ID“ upravit.
- **Test:** do tabulky v `app_test.go:60` přidat vstup „odkaz\nholéID\nholéID2“ → tři ID v pořadí; vstup
  „odkaz s ID X\nX“ → jedno ID; odkaz na složku + holé ID → jen holé ID.

### #4 – falešné „úmrtí před prvním vydáním“ (0.99.8)
- **Oprava:** v `kontrolovatData` (`kontrola.go:173-175`) porovnávat data na společnou délku:
  `n := min(len(umrti), len(prvni), 7)` a hlásit jen při `umrti[:n] < prvni[:n]`; u `umrti < narozeni` obdobně
  `n := min(len(umrti), len(narozeni))`. Stejný vzor má už řádek 160 (narození vs. vydání), kde problém nevzniká
  jen díky směru porovnání.
- **Test:** do `kontrola_test.go`: narození 1955-02-01, úmrtí „1980“, první vydání 1980-08 → žádný nález;
  úmrtí „1979“ → nález `ok-umrti`; narození „1960“, úmrtí „1960-05-01“ → žádný nález.

### #5 – ověřování šablony bez dočasné změny globální hodnoty (0.99.9)
- **Oprava:** `func overitSouborSablonou(sablona, driveID string) int` (obsah dnešní `overitSouborNaDisku`,
  adresa z předané šablony); `overitSouborNaDisku(id)` = `overitSouborSablonou(aktualni, id)`. Proměnnou pro testy
  udělat nad variantou se šablonou (`var overitSoubor = func(sablona, id string) int`), nebo přidat druhou
  vyměnitelnou proměnnou. `SetSablonaObrazku` pak nesahá na `sablonaObrazku` před úspěšným ověřením.
- **Test:** v testu šablony (`app_test.go:1572`) podvrhnout `overitSoubor`, který během ověřování zavolá
  `adresaObrazku("x")` a zkontroluje, že vrací ještě původní šablonu; spustit s `-race`.

## 4. Návrh rozdělení do vydání

**Beta 0.99.x (jen opravy, bez změny schématu, exportu, funkcí a textů):**

| Verze | Obsah |
|---|---|
| 0.99.6 | #1 + #2 – cílené hledání `rok:`/`narozena:`/`vydani:` s hodnotou `RRRR-MM` (Go i frontend jedním pravidlem) |
| 0.99.7 | #3 – smíšený seznam odkazů a holých ID se vloží celý |
| 0.99.8 | #4 – kontrola dat úmrtí zapsaných jen rokem |
| 0.99.9 | #5 – ověření šablony adresy obrázků bez souběhu |

Pokud by #5 před 1.0.0 (6. 11. 2026) nestihl ověření na Fedoře, může počkat jako první PATCH po 1.0.

**Po 1.0.0:**
- PATCH v nejbližším tématu (údržba): #6 prázdné pole v dotazu, #7 význam `hodnoceni:<N`, #9 chyby zápisu
  kontroly souborů, #13 regulární výraz jednou, #14 `https://` v šabloně, #15 úplnější CSP (s ověřením na Fedoře).
- **1.6 Náhledy na disku** (nebo 1.4 Google Disk II): #8 dřívější opakované ověření nedostupných fotek v denní dávce.
- **1.9 Kvalita dat:** #11 řady edic v backendu, kontrola „číslo mimo řadu edice“ při zadávání i v Údržbě.
- **1.10 Kontrola 2.0:** #12 věk při prvním vydání i u narození jen rokem.
- **2.0 Chytré hledání I:** #10 levnější záložní hledání článků v našeptávači.

**Mezery v testech** (doplnit spolu s opravami): hodnoty `RRRR-MM` v číselných polích (Go i JS), smíšený vstup
`parseDriveIDs`, data zapsaná jen rokem v `kontrolovatData`, souběh `SetSablonaObrazku`, chyba zápisu v `zkontrolovat`.
