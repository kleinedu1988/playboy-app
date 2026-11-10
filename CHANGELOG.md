# Changelog

Všechny podstatné změny programu Pinup Katalog. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar X.XX.XXX (MAJOR.MINOR.PATCH s pevnou šířkou, např. 0.02.003) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md).
Historie do 1.53.0 (program se jmenoval Playboy Database) je v
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md).

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
