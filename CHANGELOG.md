# Changelog

Všechny podstatné změny programu Pinup Katalog. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar X.XX.XXX (MAJOR.MINOR.PATCH s pevnou šířkou, např. 0.02.003) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md).
Historie do 1.53.0 (program se jmenoval Playboy Database) je v
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md).

## [0.02.023] – 2026-11-10

### Přidáno
- **Hero Kalendáře** (jako Profily a Statistiky): nahoře ročník zvolené řady s obálkou čísla, počtem čísel
  („9 z 12 čísel“), úplností (kompletní, cover, centerfold, pictorial) a chybějícími měsíci. Napřed ročník, jehož
  číslo z tohoto měsíce je ve sbírce („Listopad 1990 vyšlo před 36 lety – centerfold …“). Akce Otevřít číslo /
  ročník, Ukázat v kalendáři, Doplnit chybějící a Další ročník ↻. Při hledání se neukazuje (`lib/hero-kalendare.js`).

## [0.02.022] – 2026-11-10

### Opraveno
- **Vkus u jiných časopisů:** centerfold Penthouse už model vkusu nepočítá jako „Playmate měsíce“; vlastností je
  titul časopisu (věta „byla Pet of the Month“). Obálka jiného časopisu už není „byla na obálce Playboye“.

### Změněno
- **Zbylé texty podle časopisu:** Údržba („Pet bez data narození“, „Číslo nemá Pet – přidej jí centerfold“),
  bublina odkazu `[[…]]`, titulek Jako časopis u čísla jiného časopisu, popis tlačítka a nápověda (tituly jiných
  časopisů; funkce Wikipedie označené jako jen pro Playboy).
- Seznam zbylých výskytů „Playmate“ a „Playboy“ s důvodem: `docs/VYSKYTY-PLAYMATE.md`.

## [0.02.021] – 2026-11-10

### Přidáno
- **Síň slávy podle časopisu:** v liště pohledů volba „Všechny časopisy / Playboy / Penthouse / …“ (jen když má
  sbírka modelky aspoň dvou časopisů; pamatuje se). Zúží Top 10, Legendy, Odznaky, Rekordy, Kroniku i pořadí
  Sezóny na modelky s číslem nebo obálkou daného časopisu; místa zůstávají celková.

### Změněno
- **Rok ve sbírce** počítá dokončené ročníky všech časopisů („Ročník 1985 Penthouse US je celý“), dřív jen Playboy.

## [0.02.020] – 2026-11-10

### Změněno
- **Statistiky a Postřehy podle časopisu:** když jsou ve sbírce čísla jiného časopisu, texty grafů v čase
  a Postřehy říkají „rok prvního výskytu v Playboyi“ místo „v časopise“ (Statistiky počítají zatím jen Playboy,
  filtr časopisu je 0.02.045). Se samotným Playboyem beze změny.
- Mapa sbírky obarvená kategorií má barvu „Titul jiného časopisu“ (Pet of the Month, Honey of the Month…);
  dřív takové modelky byly šedé bez položky v legendě. Rozložení Kategorie už tituly ukazuje podle časopisu.

## [0.02.019] – 2026-11-10

### Přidáno
- **Hledání podle časopisu:** `casopis:penthouse` (i `casopis:ph`, `casopis:playboy`, `casopis:pb`) v hledání
  modelek (Go, `TextCasopisu`), na stěně Centerfoldů, v Kalendáři a Obálkách; funguje s negací
  (`-casopis:penthouse`), s ostatními podmínkami a v chytrých výběrech.
- Zkratky `pb`, `ph`, `hu` a slova `penthouse`, `hustler` se v chytrém hledání převedou na čip „Časopis: …“
  (`ph 80. léta`); samotné „playboy“ zůstává hledaným textem. Našeptávač nabízí `casopis:` a po něm časopisy
  s počtem modelek.

## [0.02.018] – 2026-11-10

### Změněno
- **Stěna Centerfoldů podle časopisu:** volba v liště se jmenuje „Časopis“ a nabízí Playboy (výchozí, jako dřív
  „vše“), Playboy US a CZ, Penthouse, Penthouse US a UK, Hustler, další časopisy z tabulky a Všechny časopisy
  (`moznostiSteny` a `naSteneCenterfoldu` ve `format.js`). Stěna Penthouse ukáže jen Pet of the Month.

## [0.02.017] – 2026-11-10

### Přidáno
- **Mapa čísel pro každý časopis:** Sbírka › Mapa čísel má kartu „Penthouse US · archiv dat“ (a další řady
  z tabulky časopisů), jakmile sbírka má číslo té řady: úplnost od prvního čísla řady (Penthouse US 1969–2018),
  kompletní / částečné / chybí, měsíce mimo řadu prázdné. Americká edice Playboye používá stejnou kartu beze změny.
- ⋯ › Vzhled › Karty Mapy čísel: mapy jiných časopisů jde skrýt a posouvat; nová řada se zařadí za americkou edici.

## [0.02.016] – 2026-11-10

### Změněno
- **Kalendář a Obálky podle časopisu:** volba v liště se jmenuje „Časopis a edice“ a nabízí všechny řady z tabulky
  časopisů (Playboy US, Playboy CZ, Penthouse US, Penthouse UK, Hustler US…); zvolená se pamatuje jako dřív
  edice. Kalendář Penthouse ukáže zadaná čísla, chybějící měsíce s + a „nevyšlo“ podle řady Penthouse.
- Nové album, cover a rychlé přidání nabídnou časopis zobrazený v Kalendáři, dokud se neuloží jiný.
- Prázdný stav: „Penthouse US: zatím žádné číslo“.

## [0.02.015] – 2026-11-10

### Přidáno
- **Řady čísel Penthouse a Hustleru** v `lib/rady-cisel.js` (z Wikipedie, odkaz u každé řady): Penthouse US
  09/1969–2018, Penthouse UK 03/1965–1999, Hustler od 07/1974. Ročník Penthouse ukáže měsíce před prvním číslem
  jako „nevyšlo“ a „X z Y čísel“ počítá podle řady.
- Konce řad jsou zapsané spíš později: Penthouse US měl od 2009 jen 11 a od 2017 10 čísel ročně a v letech
  2019–2023 vycházel jednou za dva měsíce; které měsíce chyběly, zdroj neuvádí, proto se v ročníku mohou ukázat
  jako chybějící. Konec britské edice zdroj uvádí jednou 1998, jednou 1999.

## [0.02.014] – 2026-11-10

### Změněno
- **Řady čísel jako data:** od kdy do kdy edice vycházela a která čísla nevyšla je v `lib/rady-cisel.js` podle
  řady (`US`, `CZ`, později `PH/US`…), s poznámkou zdroje. `cisloNevyslo` a `ciselRocniku` z něj čtou; Playboy se
  chová přesně jako dřív (test na každý měsíc 1950–2030 v obou edicích). `NEVYSLA_CISLA` zaniklo, nevyšlá čísla
  jsou u řady.
- ROADMAP: etapa 0.02 pokračuje. Kroky dřívější etapy 0.03 (řady čísel Penthouse a Hustleru, Kalendář, Mapa čísel,
  stěna a hledání podle časopisu) jsou 0.02.014–0.02.019, další etapy se posunuly o jedno číslo (Pojmy podle
  časopisu jsou 0.03, Dotažení a beta 0.08). Odkazy „0.03“ ve starších záznamech níže míří na původní číslování.

## [0.02.013] – 2026-11-10

### Přidáno
- **Správa časopisů** (⋯ › Časopisy…, `app/sprava-casopisu.js`): seznam časopisů s barvou, edicemi a tituly;
  nový časopis (název, zkratka, barva, edice, titul modelky měsíce a roku), úprava a smazání. Nový časopis je hned
  ve volbě „Časopis a edice“.
- Backend `UlozitCasopis` a `SmazatCasopis` (`casopisy.go`): zkratka se po založení nemění; edici, která má
  ve sbírce čísla, nejde ubrat; smazat jde jen časopis bez čísel; Playboy smazat nejde a jeho edice (US, CZ)
  zůstávají pevné, název a tituly jdou změnit.

## [0.02.012] – 2026-11-10

### Změněno
- **Kategorie podle časopisu:** „Playmate měsíce“ a „Playmate roku“ se odvozují jen z čísel Playboye. Centerfold
  nebo pictorial modelky měsíce Penthouse dá kategorii **Pet of the Month**, pictorial modelky roku **Pet of the
  Year** s rokem (Hustler: Honey of the Month / Year). Názvy jsou z tabulky časopisů (snímek sbírky,
  `titulyJinde` u modelky).
- Hledání `kategorie:"pet of the month"` (v Go i v rozhraní), fasety galerie, Statistiky podle kategorie
  a výběr kategorií v úpravě modelky znají tituly jiných časopisů; řadí se hned za tituly Playboye.
- Modelka jen z Penthouse už není „Playmate měsíce“ (ani z pictorialu Pet of the Month, omezení z 0.02.011).
  `kategorieKZobrazeni` z 0.02.010 nahradily přímo odvozené kategorie.

## [0.02.011] – 2026-11-10

### Změněno
- **Typy alb podle časopisu:** okno alba nabízí u Penthouse „Pet of the Month“ a „Pet of the Year“, u Hustleru
  „Honey of the Month / Year“, u Playboye jako dřív „Playmate of the Month / Year“. Popisky se překreslí při změně
  „Časopis a edice“ i při předvyplnění čísla. Uložený typ alba zůstává stejný (role modelky měsíce / roku), takže
  export, hledání i starší data platí dál (`popisDruhuCasopisu` ve `format.js`).
- Popis alba v profilu a v náhledu okna: „Pictorial Pet of the Month“ u čísla Penthouse.

## [0.02.010] – 2026-11-10

### Změněno
- **Titul podle časopisu v profilu:** modelka s centerfoldem Penthouse má v kategoriích **Pet of the Month** místo
  „Playmate měsíce“ (Hustler: Honey of the Month); modelka z Playboye i Penthouse má obě. Páska čísla v pruhu
  profilu: „Pet · Zář 85 · PH“; „Playmate“ jen u čísla Playboye (`kategorieKZobrazeni` ve `format.js`).
- Bublina čísla (najetí na štítek čísla) a režim Jako časopis píšou titul časopisu čísla.
- Ručně zapsaná kategorie „Playmate měsíce“ zůstává. Hledání a filtry kategorií se upraví v 0.02.012.

## [0.02.009] – 2026-11-10

### Přidáno
- **Tituly modelky podle časopisu:** `titulCasopisu(klic, druh)` a `titulCisla(vydani, druh)` ve `format.js`
  vrátí titul měsíce, roku nebo krátký titul z tabulky časopisů – Playboy: Playmate měsíce / roku (Playmate),
  Penthouse: Pet of the Month / Year (Pet), Hustler: Honey of the Month / Year (Honey). Časopis bez titulu dostane
  „Modelka měsíce / roku“. Rozhraní je začne používat od 0.02.010 (`test/tituly.test.js`).

### Změněno
- ROADMAP: tituly (profil, typy alb, kategorie a filtry) předřazené z etapy 0.04 jako 0.02.010–0.02.012,
  správa časopisů se posunula na 0.02.013.

## [0.02.008] – 2026-11-10

### Přidáno
- **Export verze 14:** nový oddíl `casopisy` (klíč, název, barva, edice, tituly modelky měsíce a roku, pořadí)
  a čísla jiných časopisů s `@` u alb, coverů a vydání (`1985-09@PH`, `1986-03-UK@PH`). Import časopisy načte jako
  první (`export_casopisy.go`), aby prošla alba jejich čísel. Časopis podle klíče založí nebo upraví,
  edice jen přidává a chybný klíč, barvu či edici ohlásí.
- EXPORT.md: oddíl Časopis a řádek historie formátu; vzor-exportu.yaml s Penthouse.

### Změněno
- Starší export (verze 13 a nižší, i z Playboy Database) se načte jako dřív: čísla bez `@` jsou Playboy.
  Starší program soubor verze 14 odmítne celý („z novější verze programu“).

## [0.02.007] – 2026-11-10

### Změněno
- **Pohledy Playboye beze změny:** čísla jiných časopisů se neukážou na stěně Centerfoldů (ani ve volbě „vše“),
  v kapesním katalogu, v dokončených ročnících Roku ve sbírce ani ve Statistikách (desetiletí, první výskyt
  modelky). Kalendář, Obálky, Mapa čísel, sousední čísla a speciály je vynechávají už podle řady (`US`/`CZ`).
  Nové `jeCisloPlayboye` a `naSteneCenterfoldu` ve `format.js`; pohledy podle časopisu přijdou v 0.03.

### Testy
- `test/playboy-pohledy.test.js` (pohled po pohledu) a `TestDesetiletiJenPlayboy`.

## [0.02.006] – 2026-11-10

### Přidáno
- **Rychlé přidání modelky** (Ctrl+Shift+N) má volbu „Časopis a edice“ jako okno alba; pamatuje si ji
  a odhad národnosti počítá z modelek téhož časopisu („% modelek Penthouse“).
- **Stránka čísla a ročníku jiného časopisu** z profilu modelky: nadpis ročníku, drobeček „Ročník 1985 · Penthouse“
  a nabídka ročníku s názvem časopisu. Kalendář a Mapa čísel jiné časopisy zatím neukazují (0.03).

## [0.02.005] – 2026-11-10

### Přidáno
- **Volba „Časopis a edice“** v okně alba a coveru (dřív „Edice“): Playboy US, Playboy CZ, Penthouse US,
  Penthouse UK, Hustler US – podle tabulky časopisů (`app/rady.js`, `moznostiRad` ve `format.js`). Poprvé tak jde
  zadat číslo jiného časopisu, např. centerfold Penthouse 09/1985 (Pet of the Month). Speciály fungují i pro jiné
  časopisy. Nové album nebo cover nabídne naposledy uložený časopis a edici.

### Změněno
- Pictorial jde přiřadit k číslu jiného časopisu jen s časopisem a edicí z tabulky (`SetVydaniAlba`).
- Třetí sloupec řádku „měsíc · rok · edice“ je širší, aby se vešel název časopisu.

## [0.02.004] – 2026-11-10

### Přidáno
- **Názvy čísel jiných časopisů:** rozhraní si načítá tabulku časopisů spolu s názvy speciálů a číslo se jmenuje
  „Září 1985 · Penthouse“, „Březen 1986 · Penthouse UK“, ročník „1985 · Hustler“; páska čísla zkratkou
  „Zář 85 · PH“. Nové `nazevCasopisu` a `nazevRady` (`Penthouse UK`) ve `format.js`; skupina čísla v Údržbě
  má podtitulek s názvem časopisu. Čísla Playboye se jmenují přesně jako dřív (test).
- **Hledání** `rok:1985-09@PH` najde jen Penthouse 09/1985; `rok:1985-09` dál všechna čísla toho měsíce.

## [0.02.003] – 2026-11-10

### Přidáno
- **Tabulka časopisů** (úprava schématu databáze č. 17, `casopisy.go`): zkratka (klíč v čísle), název, barva,
  edice (země vydání, první výchozí), názvy „modelky měsíce“ a „modelky roku“ a pořadí. Předvyplněné jsou
  **Playboy** (PB; US, CZ; Playmate), **Penthouse** (PH; US, UK; Pet of the Month / of the Year) a **Hustler**
  (HU; US; Honey of the Month / of the Year). `GetCasopisy` pro rozhraní.

### Změněno
- Centerfold, cover a speciál jiného časopisu projdou jen s časopisem a edicí z tabulky (`znamaRada`; např.
  Hustler UK ne).

### Přechod
- Databáze se při prvním spuštění upraví (úprava č. 17, jen nová tabulka); předtím se sama uloží záloha
  „Před úpravou“. Starší verze programu novou databázi otevře jen pro čtení.

## [0.02.002] – 2026-11-10

### Přidáno
- **Klíč čísla s časopisem i v rozhraní** (`frontend/src/lib/format.js`): `rozlozitVydani` vrací navíc `zeme`
  a `casopis` a pole `edice` je řada (`PH/US`), `slozitVydani` z řady složí klíč zpátky (`1985-09@PH`),
  nové `radaVydani` a `rozlozitRadu`. Název čísla jiného časopisu zatím se zkratkou („Září 1985 · PH“, plné názvy
  přijdou v 0.02.004); čísla Playboye se jmenují stejně jako dřív.
- **Odkazy na číslo jiného časopisu** v textech: `[[09/1985@PH]]`, `[[09/1985 UK@PH]]`, `[[1985-09@PH]]` (rozhraní
  i „Zmiňováno v…“ v `zminky.go`).

## [0.02.001] – 2026-11-10

### Přidáno
- **Klíč čísla s časopisem** (první krok etapy U, zatím jen v jádru programu, v okně se nic nemění): číslo jiného
  časopisu než Playboy má na konci zkratku časopisu – `1985-09@PH` (Penthouse 09/1985), `1986-03-UK@PH`
  (Penthouse UK), `1985-S01@HU` (speciál Hustleru). Bez přípony je to Playboy, takže stávající data platí beze změny.
- Rozklad čísla (`hledani.RozdelitCasopis`, `RadaKlice`, `sbirka.CastiVydani`, `uceni.CastiVydani`,
  `EdicePodleVydani`) vrací u jiného časopisu **řadu** `PH/US`; pohledy podle edice Playboye (US, CZ) tak čísla
  jiných časopisů samy vynechají. Stránka ročníku `1985@PH` ukáže jen Penthouse, `1985` jen Playboy.
- Ukládání centerfoldů a coverů a zakládání speciálů přijme řadu jiného časopisu; `@PB` se nepíše a neprojde.

## [0.01.001] – 2026-11-10

### Změněno
- Verze se v programu a v changelogu píšou s pevnou šířkou **X.XX.XXX** (0.01.001, 0.02.000, 1.00.000): MINOR
  vždy dvěma, PATCH třemi číslicemi. V `verze.go`, `wails.json` a `package.json` zůstává zápis bez nul (0.1.1),
  protože jiný npm ani Wails nepřijmou; převod dělá `zobrazitVerzi`.

## [0.01.000] – 2026-11-10

### Změněno
- **Playboy Database je teď Pinup Katalog** a číslování verzí začíná znovu od 0.1.0. Modelky zůstávají v centru,
  v dalších verzích přibudou další časopisy (Penthouse, Hustler…) – plán je v ROADMAP.md, etapa U.
- Všechny funkce Playboy Database 1.53.0 zůstávají beze změny.

### Přechod
- Při prvním spuštění se data přesunou z `~/.local/share/playboy-app` do `~/.local/share/pinup-katalog` a mezipaměť
  z `~/.cache/playboy-app` do `~/.cache/pinup-katalog` – sbírka, zálohy, hodnocení i nastavení okna zůstanou.
  Když ještě běží stará verze, přesun počká na další spuštění.
- `./instalovat.sh` nainstaluje program jako `pinup-katalog` a starý program odebere z nabídky aplikací.
- Kontrola nové verze nepovažuje starou řadu 1.x za novější; export má v názvu a hlavičce Pinup Katalog.
