# Changelog

Všechny podstatné změny programu Pinup Katalog. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar X.XX.XXX (MAJOR.MINOR.PATCH s pevnou šířkou, např. 0.02.003) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md).
Historie do 1.53.0 (program se jmenoval Playboy Database) je v
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md).

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
