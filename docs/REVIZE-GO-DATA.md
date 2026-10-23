# Revize Go backendu – datová vrstva (23. 10. 2026, verze 0.99.5)

Rozsah: `schema.go` a úpravy schématu v `app.go`, otevření databáze, WAL, zálohy a obnovení, export a import
(`export.go`, `udaje.go`, `vydani.go`, články v exportu), `alba.go`, `nastaveni.go`, `statistiky.go`, `vyvoj.go`,
transakce, `a.chyba`, souběžná volání z Wails, cesty, práva souborů, výkon, testy. Kód se neměnil.

Ověření: `go vet ./...` bez nálezů, `go test ./...` prochází (5,3 s). Nálezy označené „ověřeno“ jsou potvrzené
jednorázovými testy v kopii repozitáře mimo projekt (scratchpad), ostatní rozborem kódu s odkazem na řádky.

## 1. Souhrn

Datová vrstva je celkově pečlivá: dotazy mají parametry (SQL injection jsem nenašel, jediné skládání řetězců
je `VACUUM INTO` se správným zdvojením apostrofů a jména sloupců z pevných seznamů), úpravy schématu běží
v transakci s kontrolou cizích klíčů, import je celý v jedné transakci a mazání je vždy až po záloze. Našel jsem
ale tři ověřené chyby, které můžou tiše poškodit data: **opakovaný import exportu se stejnojmennými modelkami
do jiné databáze pokaždé založí další kopie těchto modelek**, **obnovení zálohy, která mezitím zmizela, „úspěšně“
obnoví prázdnou sbírku** (`?mode=ro` bez `file:` modernc ignoruje a vytvoří prázdný soubor) a **sloučení modelek
odpojí články zdrojové modelky a zahodí její „netýká se“ a „V pořádku“**. K tomu je tu několik menších chyb
(tiše ignorované chyby zápisu, export, který se při dílčí chybě tváří jako úplný, prázdné album po nedostupných
odkazech) a rizika souběhu při obnovení zálohy. Všechny opravy pro betu jdou udělat bez změny schématu i exportu.

## 2. Nálezy

| # | Závažnost | Kde | Co je špatně a jak se projeví | Návrh opravy | Typ | Prac. | Jistota |
|---|---|---|---|---|---|---|---|
| 1 | chyba | `export.go:688–709` (`najit` v `importovatData`), `:739–748` | Modelka se stejným jménem jako jiná (má v exportu `cislo`) se při importu páruje jen podle čísla z *původní* databáze. Když se export načte do jiné databáze (přenos na jiný počítač podle README) a pak znovu (doplnění ze staršího exportu, opakovaný import), čísla nesedí, žádný kandidát se nespáruje a každá taková modelka se **založí znovu**. Test: 2× „Anna“ → import do prázdné DB: 2, druhý import: 4, třetí: 6 (hlášeno jako „nové modelky“, bez chyby). Totéž u ručního souboru bez `cislo`, když sbírka má jméno víckrát. | V `najit`: když existují *nespárované* kandidáty a nejde vybrat jednoznačně → nezakládat, ohlásit chybu a modelku přeskočit; zakládat jen když kandidáti nejsou, nebo jsou všichni už spárovaní v tomto importu. | **PATCH (beta teď)** | S | ověřeno |
| 2 | chyba | `app.go:412`, `app.go:445` (`SeznamZaloh`, `ObnovitZalohu`) | `sql.Open("sqlite", soubor+"?mode=ro")` – bez předpony `file:` modernc parametr `mode` ignoruje: spojení je pro zápis a **neexistující soubor vytvoří prázdný**. `quick_check` prázdného souboru vrátí „ok“, obnovení ho zkopíruje na `playboy.db`, `migrovat` založí prázdné schéma a `ObnovitZalohu` vrátí úspěch. Test: obnovení zálohy, která mezitím zmizela (smaže ji `uklidZaloh` po jiné záloze, např. smazání alba při otevřeném okně záloh) → sbírka má 0 modelek, ve složce záloh přibyla prázdná „poškozená“ záloha. Data jdou zachránit ze zálohy `pred-obnovenim`. | V `ObnovitZalohu` nejdřív `os.Stat(zaloha)` (neexistuje / není soubor / velikost 0 → „Záloha neexistuje“) a otevírat `"file:"+zaloha+"?mode=ro"`; totéž v `SeznamZaloh`. Volitelně ověřit, že záloha má tabulku `modelky`. | **PATCH (beta teď)** | S | ověřeno |
| 3 | chyba | `alba.go:342–462` (`SloucitModelky`), `clanky.go:21` | Sloučení modelek smaže zdrojovou modelku; `clanky.modelka_id` má `ON DELETE SET NULL`, takže **články zdrojové modelky ztratí vazbu** (v profilu cílové nejsou). `netyka_se` zdrojové modelky (včetně „V pořádku“ z Kontroly) se nepřenese. Test: článek u zdroje → po sloučení `modelka_id = 0`, `netyka_se` cíle prázdné. | V transakci před `DELETE FROM modelky`: `UPDATE clanky SET modelka_id = cil WHERE modelka_id = zdroj` a sloučit klíče `netyka_se` (`prepnoutKlic` pro každý klíč zdroje, zápis do cíle). | **PATCH (beta teď)** | S | ověřeno |
| 4 | chyba | `export.go:243, 271`, `export.go:958–964`, `vydani.go:261–293`, `clanky.go:606–609` | Kontrola úplnosti exportu hlídá jen počet modelek a fotek. Chyba čtení v `prazdnaAlba`, `GetStavyVydani`, `exportovatClanky`, `GetVybery`, `GetFotkyVyberu`, `dalsiModelkyAlb` se jen ohlásí (nebo zamlčí) a **soubor se uloží jako úspěšný export bez alb bez fotek, čísel, článků nebo výběrů**. Export je záloha přenášená na jiný počítač. | V `exportovat` pracovat na kopii aplikace se sběrem chyb (`exp := *a; exp.naChybu = func(z){…}`, jako `imp` v importu) a při jakékoli chybě vrátit error; `dalsiModelkyAlb` při chybě dotazu zavolat `a.chyba`. | **PATCH (beta teď)** | S | ověřeno čtením |
| 5 | chyba | `alba.go:615–655` (`PrejmenovatFotografa`), `alba.go:692–713` (`PrejmenovatTag`) | Zápisy po jednom bez transakce, chyba `Exec` se zahodí a vrácený počet „upravených“ zahrnuje i neuložené. Při zamčené databázi (běží import) se přejmenuje jen část a uživatel se to nedozví. | Obě smyčky přes `a.vTransakci(…)`; při chybě vrátit 0 a nahlásit. | **PATCH (beta teď)** | S | ověřeno čtením |
| 6 | chyba | `app.go:2540–2563` (`zkontrolovat`) | `defer tx.Commit()` a `tx.Exec` bez kontroly chyby: když zápis výsledků kontroly souborů selže (busy během importu), **„ověřeno“ a „nedostupné od“ se tiše neuloží**; denní dávka pak ověřuje pořád tytéž fotky a „Opakovaně nedostupné“ nevznikne. | Kontrolovat chyby `Exec`, na konci `if err := tx.Commit(); err != nil { a.chyba(…) }`; transakci otevírat až po `overitSoubory` (teď drží spojení po celou dobu síťové kontroly). | **PATCH (beta teď)** | S | ověřeno čtením |
| 7 | riziko | `app.go:2595–2622` (`AddBulkPhotos`) | Album se založí (`zajistitAlbum`) před ověřením souborů; když jsou všechny odkazy nedostupné, **zůstane prázdný řádek alba** (test: `Vlozeno 0, Nedostupne 1`, alb 1). `prazdnaAlba` ho pak vyexportuje jako album bez fotek a import ho založí znovu. | Na konci, když `Vlozeno == 0`, smazat album, pokud je `albumBezObsahu` (stejně jako `smazatPrazdnaAlba`, jen pro toto id). | **PATCH (beta teď)** | S | ověřeno |
| 8 | riziko | `app.go:2105–2128` (`UpdateCover`) | Tři zápisy bez transakce: přesun do alba jiného čísla proběhne, výměna souboru pak může selhat na `UNIQUE(album_id, drive_file_id)` (stejný soubor už v cílovém čísle je) – cover je přesunutý, ale s hláškou chyby a se starým obrázkem; prázdné nové album může zůstat. | Celé tělo v `a.vTransakci("úprava coveru", …)` se `zajistitAlbum(tx, …)`. | **PATCH (beta teď)** | S | ověřeno čtením |
| 9 | riziko | `app.go:437–530` (`ObnovitZalohu`), `app.go:752–761`, `app.go:850–853` | `a.db` se při obnovení zavře a vymění bez zámku; souběžná volání z okna (Wails volá paralelně, např. denní kontrola souborů, překreslení) dostanou „sql: database is closed“ (test: 1 209 chyb při pěti obnoveních se souběžným `GetModelky`) a jde o datový závod na poli `a.db`. Během `migrovat` po obnovení je `SetMaxOpenConns(1)` a `BEGIN` přes `Exec` – souběžný dotaz by běžel uvnitř transakce úpravy schématu. | `sync.RWMutex` kolem výměny spojení (výměna pod zápisovým zámkem, `a.db` číst přes getter), nebo obnovení jako „restart databáze“, během kterého backend vrací „probíhá obnovení“. | MINOR → **1.8 Zálohy a aktualizace** | M | ověřeno |
| 10 | riziko | `export.go:641–676` | Import drží `BEGIN IMMEDIATE` po celou dobu zápisu; zápisy z okna čekají `busy_timeout(5000)`. Naměřeno: import 5 000 modelek / 100 000 fotek do prázdné DB 5,4–6,4 s, z toho zápisová fáze ~3 s; souběžné uložení srdíček čekalo 2,9 s. Na pomalejším disku nebo větší sbírce překročí 5 s a uložení z okna selže („database is locked“). | Po 1.0: po dobu importu zablokovat úpravy v rozhraní, nebo zvednout `busy_timeout` hlavního spojení (např. na 30 s) a ukazovat průběh importu. | PATCH (po 1.0) | S | ověřeno měřením |
| 11 | riziko | `app.go:229–252` (`kopirovatSoubor`), `export.go:909–912` | Zápis přes dočasný soubor a přejmenování, ale bez `Sync()` souboru a složky. Po výpadku proudu hned po obnovení zálohy / převzetí databáze / exportu může (podle souborového systému, Fedora má btrfs) zůstat prázdný nebo neúplný cílový soubor. | `vystup.Sync()` před `Close`, po `Rename` `Sync` na složce; v exportu totéž místo `os.WriteFile`. | PATCH (po 1.0) | S | pravděpodobné |
| 12 | zlepšení | `export.go:192–292` | Export není ze snímku: čte desítky tisíc dotazů po modelkách přes pool spojení; souběžný zápis z okna během exportu (5,7 s u 5 000 / 100 000) dá falešné „export není úplný“ nebo nesourodý soubor. Zároveň je pomalý: 2 dotazy na modelku (`dotazFotekModelky`, `prazdnaAlba`) + dotaz na každé prázdné album. | Export v jedné čtecí transakci na vlastním spojení (jako import) a fotky jedním dotazem seřazeným podle modelky; cíl pod 1 s. | MINOR → **1.8 Zálohy a aktualizace** (krok „spolehlivý a rychlý export“) | M | ověřeno měřením |
| 13 | zlepšení | `app.go:616–643` (`SetNetykaSe`, `SetNetykaSeAlba`) | Čtení a zápis seznamu klíčů ve dvou příkazech bez transakce; dvě souběžná volání (rychlé klikání „V pořádku“ u dvou nálezů jedné modelky) můžou jeden klíč ztratit. | Čtení i zápis ve `vTransakci` (nebo `BEGIN IMMEDIATE`). | PATCH (po 1.0) | S | pravděpodobné |
| 14 | zlepšení | `app_test.go`, `prechod_test.go` | Testy nepokrývají: opakovaný import se stejnými jmény do jiné DB (#1), obnovení neexistující zálohy (#2), články a `netyka_se` při `SloucitModelky` (#3), chybu čtení během exportu (#4), souběh volání při obnovení (#9). | Ke každé opravě test (viz oddíl 3); pro #9 test se `-race`. | spolu s opravami | S | ověřeno |

Prověřeno bez nálezu: parametry ve všech dotazech, `ObnovitZalohu` přijme jen jméno souboru ze složky záloh (žádná
cesta zvenku), práva 0700/0600 u složky dat, databáze a záloh, `rows.Close` (všechny `Query` mají `Close`/`defer`),
přechod ze všech schémat v transakci s `foreign_key_check`, zmrazení schématu 11 a exportu 7 (`TestZmrazeniAlfy`),
`GetModelky` 0,19 s a `GetPrehled` 0,66 s při 5 000 modelkách a 100 000 fotkách, záloha 0,09 s.

## 3. Opravy pro betu (PATCH teď)

**#1 Opakovaný import zakládá stejnojmenné modelky znovu** (`export.go`, `najit` v `importovatData`).
Nové pravidlo: (a) shoda `cislo` s ID nespárovaného kandidáta → ona; (b) kandidát žádný → založit; (c) jediný
kandidát a `cislo == 0` → on (beze změny); (d) jediný kandidát, `cislo != 0`, nespárovaný → on (teď `volne == 1 &&
kandidati == 1`, beze změny); (e) **všichni kandidáti už jsou spárovaní v tomto importu** → založit (první import
souboru se dvěma Annami do prázdné DB); (f) jinak (víc nespárovaných kandidátů, číslo nesedí) → nezakládat,
`vysledek.Chyby += "<jméno> [<cislo>]: ve sbírce je víc modelek tohoto jména a číslo nesedí, modelka přeskočena"`
a `continue`. Funkce `najit` tedy musí vracet tři stavy (nalezena / založit / nejednoznačné).
Test: dvě „Anna“ v DB A s ID 3 a 4 (předtím dvě jiné modelky), export, import do prázdné DB B (2 Anny), druhý
import téhož souboru → stále 2 Anny a v `Chyby` dvě hlášky; ruční soubor `- jmeno: Anna` do B → 2 Anny + hláška;
stávající `TestExportAImport` (export → import do téže DB) beze změny.

**#2 Obnovení neexistující zálohy obnoví prázdnou sbírku** (`app.go`, `ObnovitZalohu`, `SeznamZaloh`).
Na začátku `ObnovitZalohu` po kontrole jména: `info, err := os.Stat(zaloha); if err != nil || !info.Mode().IsRegular()
|| info.Size() == 0 { return "Záloha už neexistuje, databáze zůstala beze změny." }`. Otevírání záloh přes
`"file:"+zaloha+"?mode=ro"` (cesta je z `slozkaDat()`, `?` ani `#` v ní běžně nejsou; pro jistotu použít
`(&url.URL{Scheme: "file", Path: zaloha, RawQuery: "mode=ro"}).String()`), totéž v `SeznamZaloh`.
Test: `zalohovat("test")` (vznikne složka), `ObnovitZalohu("playboy-2026-01-01-120000.000-denni.db")` → vrátí
chybu, modelky zůstanou, ve složce záloh nepřibude soubor; druhý test, že zápis přes spojení se zálohou selže.

**#3 Sloučení modelek odpojí články a zahodí „netýká se“** (`alba.go`, `SloucitModelky`).
V transakci před `DELETE FROM modelky WHERE id = zdroj`: `UPDATE clanky SET modelka_id = ? WHERE modelka_id = ?`
(cíl, zdroj) a sloučení klíčů: pro každý klíč z `zdroj.NetykaSe` `cilovy = prepnoutKlic(cilovy, klic, true)`,
`UPDATE modelky SET netyka_se = NULLIF(?, '') WHERE id = cil`. Test: článek u zdroje a `SetNetykaSe(zdroj,
"titulni")` → po sloučení `GetClankyModelky(cil)` má 1 článek a `netyka_se` cíle obsahuje `titulni`.

**#4 Export se při dílčí chybě uloží jako úplný** (`export.go`, `exportovat`).
`exportovat` přejmenovat na vnitřní funkci volanou nad kopií `exp := *a` s `exp.naChybu = func(z string)
{ chyby = append(chyby, z) }`; po sestavení dat `if len(chyby) > 0 { return nil, fmt.Errorf("export není úplný: %s",
chyby[0]) }`. V `dalsiModelkyAlb` při chybě dotazu `a.chyba("načtení dalších modelek alb", err)`.
Test: v testu po naplnění DB `DROP TABLE vybery_fotky` (nebo přejmenovat `clanky`) → `exportovat` vrátí chybu.

**#5 Přejmenování fotografa a tagu bez transakce** (`alba.go`).
Zápisy obou funkcí do `a.vTransakci("přejmenování fotografa"/"přejmenování tagu", func(tx) …)`; když vrátí false,
vrátit 0. Test: drží-li jiné spojení `BEGIN IMMEDIATE` (s krátkým `busy_timeout` v testu), funkce vrátí 0
a v databázi se nic nezmění.

**#6 Kontrola souborů tiše zahodí výsledek** (`app.go`, `zkontrolovat`).
Nejdřív `stavy := overitSoubory(driveIDs)`, pak `tx, err := a.db.Begin()`, `defer tx.Rollback()`, u každého
`tx.Exec` při chybě `a.chyba("kontrola souborů", err); return vysledek`, na konci `tx.Commit()` s kontrolou.
Výsledek pro rozhraní (seznam nedostupných) se vrátí i při chybě zápisu. Test: podvržený `overitSoubor`
a zamčená databáze → `naChybu` dostane hlášku.

**#7 Prázdné album po nedostupných odkazech** (`app.go`, `AddBulkPhotos`).
Za smyčku: `if albumID != 0 && vysledek.Vlozeno == 0 { a.db.Exec("DELETE FROM alba WHERE id = ? AND "+albumBezObsahu,
albumID) }`. Album, které už existovalo s textem nebo dalšími modelkami, podmínka nesmaže. Test: modelka, odkaz
nedostupný → `SELECT COUNT(*) FROM alba` = 0; album s popisem a nedostupný odkaz → album zůstane.

**#8 Úprava coveru napůl** (`app.go`, `UpdateCover`).
Tělo po kontrole typu do `a.vTransakci("úprava coveru", func(tx dotazovac) error { albumID, err :=
zajistitAlbum(tx, 0, vydani, "Cover"); … tx.Exec(smazatPrazdnaAlba) })`. Test: cover 1990-01 se souborem A,
cover 1990-02 se souborem B; `UpdateCover(id A, "1990-02", odkaz B)` → vrátí false a cover A zůstane v 1990-01
se souborem A, album 1990-02 beze změny.

## 4. Seskupení do verzí

Podle pravidla „PATCH = jeden krok nebo oprava“ a „beta jen opravy chyb“. Každá oprava posouvá 14denní lhůtu
před 1.0.0 (ROADMAP, etapa 13, krok 1): při opravách do 23.–24. 10. zůstává 1.0.0 nejdřív 6.–7. 11. 2026.
Každá oprava se zapíše i do `PLAN.md` → „Chyby z bety“.

| Verze | Obsah | Nálezy |
|---|---|---|
| 0.99.6 | Import: stejnojmenné modelky se opakovaným importem nezakládají znovu | #1 (+ test #14) |
| 0.99.7 | Zálohy: obnovení zmizelé zálohy nic nezmění, zálohy se otevírají jen pro čtení | #2 (+ test) |
| 0.99.8 | Sloučení modelek přenese články a „netýká se“ / „V pořádku“ | #3 (+ test) |
| 0.99.9 | Export selže místo neúplného souboru | #4 (+ test) |
| 0.99.10 | Drobné opravy zápisu: přejmenování fotografa a tagu v transakci, uložení výsledku kontroly souborů, žádné prázdné album po nedostupných odkazech, úprava coveru celá nebo vůbec | #5, #6, #7, #8 (jedna verze „opravy zápisu“, nebo rozdělit do 0.99.10–0.99.13) |
| 1.0.x (PATCH po 1.0) | `busy_timeout`/průběh u importu, `Sync` při kopírování a exportu, `SetNetykaSe` v transakci | #10, #11, #13 |
| 1.8 Zálohy a aktualizace (MINOR) | Nový krok „Bezpečná výměna databáze a spolehlivý export“: zámek kolem výměny spojení při obnovení (test s `-race`), export ze snímku v jedné čtecí transakci a jedním dotazem na fotky (cíl < 1 s u 5 000 / 100 000) | #9, #12 |
| 1.9 Kvalita dat (MINOR, [schéma]) | Úkol v Údržbě „Prázdná alba“ (úklid řádků alb bez fotek a obsahu, které vznikly před opravou #7) – volitelně | navazuje na #7 |
