# Revize: testy, sestavení a instalace (23. 10. 2026, verze 0.99.5)

Rozsah: testy Go a frontendu, sestavení (Wails, Vite, závislosti), `instalovat.sh`, `wails.json`,
`package.json.md5`, pravidla vydání a přesnost README. Kód se neměnil.

## 1. Souhrn

Všechny kontroly prošly: `go vet ./...` bez nálezů, `go test ./... -count=1` prošlo (73 testů, 5,7 s, třikrát i
s `-shuffle=on`), `npm test` (25 testů), `npm run typy`, `npm run build`, `npm audit` (0 zranitelností),
`go mod verify` a `go mod tidy -diff` jsou čisté. **Pokrytí Go je 85,0 % příkazů** (3147 z 3701). Nejslabší jsou
`alba.go` (73,6 %), `vydani.go` (80,4 %) a `app.go` (82,0 %). Úplně bez testu je 17 funkcí, například
`OdebratModelkuZAlba`, `PrejmenovatVyber`, `OdebratZVyberu` a `GetTagy`. **Frontend má pokrytí 97,7 % řádků, ale
jen ve `src/lib`** (3 soubory). Žádný z 36 modulů `src/app` (statistiky.js, prehled.js…) testovaný není, protože
importují bez přípony a sahají na DOM. Opravdu ověřená slabina je mechanismus `package.json.md5` a
`package-lock.json`: test ho nehlídá a Wails pak u uživatele mění soubor, který je v gitu. Instalátor je
napsaný pečlivě (`set -euo pipefail`, uvozovky, instalace přes dočasný soubor, opakované spuštění nevadí). Má
jen drobné slabiny: neznámý přepínač, cestu v `Exec=` a chybějící kontrolu verze Go. CI ani souhrnný kontrolní
skript nejsou.

Co nešlo ověřit: `govulncheck` se nainstaluje, ale databáze zranitelností (vuln.go.dev) je z tohoto prostředí
zakázaná (403). `shellcheck` 0.11 (z pip) hlásí jen SC1111 na ř. 92, což je planý poplach: české uvozovky
uvnitř textu jsou tam záměrně. Na Fedoře se nesestavovalo (`wails` tu není).

## 2. Nálezy

| # | Závažnost | Kde | Co je špatně a jak se projeví | Návrh opravy | Typ | Prac. | Jistota |
|---|---|---|---|---|---|---|---|
| 1 | riziko | `app_test.go:1588–1631` (`TestVerzeSouhlasi`); `frontend/package.json.md5` | Test hlídá verzi ve `verze.go`, `wails.json`, `package.json` a v changelogu, ale **ne `package.json.md5` ani `version` v `package-lock.json`**, ačkoli ROADMAP ř. 37–39 a README ř. 140–141 je mezi hlídaná místa počítají. Když se md5 zapomene, `wails build` (v2.16.0, `pkg/commands/build/base.go:469–474`) soubor `package.json.md5` sám přepíše a spustí `npm install`. Ten může přepsat i `package-lock.json`. U uživatele tak vznikne změna ve sledovaném souboru a příští `git pull` může skončit chybou „Your local changes would be overwritten“. Dnes oba soubory souhlasí (ověřeno `md5sum`). | Do `TestVerzeSouhlasi` doplnit: md5 souboru `frontend/package.json` = obsah `package.json.md5`; `package-lock.json` má `"version"` = Verze (na dvou místech). | **PATCH (beta teď)** | S | vysoká |
| 2 | riziko | `wails.json:5` (`"frontend:install": "npm install"`) | `npm install` může při jiné verzi npm upravit `package-lock.json`, takže pracovní strom u uživatele přestane být čistý (viz č. 1). Naopak když se změní jen lock (aktualizace Vite) a `package.json` ne, Wails `npm install` přeskočí a zůstanou staré `node_modules`. | `"frontend:install": "npm ci"` (instaluje přesně podle locku a lock nemění). Pro aktualizaci jedním příkazem ještě `git status --porcelain` v instalátoru s varováním. | PATCH (po 1.0) → **1.8 Zálohy a aktualizace** | S | střední |
| 3 | riziko | `instalovat.sh:25`, `:32` | Neznámý nebo překlepnutý přepínač (`--odinstaluj`, `--help`, `-h`) se nehlásí. Skript program **sestaví a nainstaluje**, místo aby odinstaloval nebo vypsal nápovědu. | `case "${1:-}" in ""|--bez-sestaveni|--odinstalovat) ;; *) echo "Neznámý přepínač…" >&2; exit 2;; esac`, `--help` vypíše hlavičku. | **PATCH (beta teď)** | S | vysoká |
| 4 | zlepšení | `instalovat.sh:82` (`Exec=$BIN`) | Cesta v `Exec=` není v uvozovkách. Při domovské složce s mezerou (nebo s `%`) položka v nabídce program nespustí, protože specifikace Desktop Entry vyžaduje uvozovky. Na běžné Fedoře se to nestane. | `Exec="$BIN"` (případně nahradit `%` za `%%`). | **PATCH (beta teď)** | S | vysoká (chování), nízká (dopad) |
| 5 | riziko | `instalovat.sh:38–48`; `go.mod:3–5` | Instalátor kontroluje jen přítomnost `go`, ne jeho verzi. `go.mod` chce Go 1.26.0. Na Fedoře < 44 (nebo s `GOTOOLCHAIN=local`) skončí `wails build` chybou „go.mod requires go >= 1.26.0“ uprostřed sestavení, místo aby skript srozumitelně poradil (README ř. 55 to zmiňuje jen slovně). | Před sestavením porovnat `go env GOVERSION` s 1.26 a vypsat „Potřebuješ Go 1.26+ (Fedora 44+), `sudo dnf upgrade golang`“. | PATCH (po 1.0) → 1.8 | S | střední |
| 6 | zlepšení | `main.go:14` (`//go:embed all:frontend/dist`); README ř. 44 | Na čerstvém klonu `go test ./...` i `go vet` selžou (`pattern all:frontend/dist: no matching files found`), dokud neproběhne `npm run build` nebo `wails build`. Ověřeno v kopii bez `dist`. README uvádí `go test` jako samostatný krok. | V README napsat „nejdřív `cd frontend && npm install && npm run build`“; souhrnný skript (č. 9) to udělá sám. | **PATCH (beta teď)** (text README) | S | vysoká |
| 7 | zlepšení | README ř. 135–136 a 144; ROADMAP ř. 50; `verze.go:3` | Texty o vydání si odporují s novým pravidlem verzování. README: „Do 1.0.0 zvyšuje MINOR každá změna schématu…“ a „u milníků i značka `git tag -a`“. ROADMAP ř. 42: „Značky v gitu se nedělají“, ale tabulka na ř. 50: „1.0.0 … a značka“. `verze.go:3` odkazuje na oddíl „Číslování do 1.0.0“, který už neexistuje (je to „Pravidlo verzování“). | Sjednotit README „Verze a vydání“ s ROADMAP (odkaz na oddíl, bez značek), opravit komentář ve `verze.go` a ROADMAP ř. 50. | **PATCH (beta teď)** | S | vysoká |
| 8 | zlepšení | `frontend/test/` (jen `src/lib`); `src/app/*.js` (36 souborů, ~7 500 ř.) | Logika statistik (`radaVCase`, `hodnotaSloupce`, `krivka`, `kvantil`, `vekVLetech`, `krokOsy` ve `statistiky.js:100–200`), úkoly Přehledu (`ukolyModelky`, `prehled.js:79`) a `shanenaCisla`/`textShanim` (`prehled-uvod.js:152–186`) nejsou testované. Moduly `src/app` nejdou v Node načíst (import `./backend` bez přípony, DOM, wailsjs). `radaVCase` navíc používá `new Date()` (24 měsíců zpět). | Čisté výpočty přesunout do `src/lib/statistiky.js` (stav předávat parametrem, „dnes“ jako argument) a pokrýt testy; `prehled-uvod.js` testovat přímo, pokud jeho importy půjdou načíst. | **MINOR** → nové téma „1.x Kvalita kódu a testy“ (nebo PATCH po 1.0 krok po kroku) | M | vysoká |
| 9 | zlepšení | kořen repozitáře (chybí `.github/`, `zkontrolovat.sh`) | CI ani jeden příkaz „zkontroluj vše“ nejsou. Kroky z README ř. 140–144 se dělají ručně a `go vet`, `npm run build` ani kontrola md5 v nich nejsou. | Přidat `zkontrolovat.sh` (návrh níže). Volitelně ho spouštět z `instalovat.sh` před instalací (jen `go test -short`). | **PATCH (beta teď)** (skript, beze změny programu) | S | vysoká |
| 10 | zlepšení | `app_test.go:2709–2714` (3 s), `vykon_test.go:56–68` (2 s), `kontrola_uceni_test.go:288–295` (1 s) | Testy s limitem času podle hodin. Rezerva je dnes velká (naměřeno 46–132 ms proti 2 s, 91 ms proti 1 s), takže nejde o nestabilitu. Na pomalém nebo vytíženém stroji nebo s `-race` by ale mohly selhat. Test FTS na ř. 2709 se neskipuje ani s `-short`. | Ponechat. Případně limity násobit proměnnou prostředí nebo test na ř. 2709 také skipovat v `-short`. | PATCH (po 1.0) | S | střední |
| 11 | zlepšení | `alba.go:138`, `vydani.go:179`, `vydani.go:217`, `alba.go:658`, `app.go:2441`, `app.go:381` | 0 % pokrytí u funkcí, které rozhraní volá: `OdebratModelkuZAlba` (nabidky.js), `PrejmenovatVyber` (nejlepsi.js), `OdebratZVyberu` (vyber.js, nabidky.js), `GetTagy` (sprava.js), `OveritOdkaz` (navigace.js), `SlozkaZaloh`. `PrejmenovatVyber` navíc jako jediná nezapisuje chybu přes `a.chyba` (`vydani.go:184`). | Testy podle oddílu 3. `a.chyba` doplnit, až se bude sahat na výběry. | **PATCH (beta teď)** (testy) | S | vysoká |
| 12 | zlepšení | `app.go:445–453` (`ObnovitZalohu`) | Větev „Záloha je poškozená, databáze zůstala beze změny“ ani větve s neúspěšnou zálohou nebo migrací po obnovení nejsou pokryté. Jde o nejcitlivější operaci s daty (pokrytí funkce 66 %). | Test s poškozeným souborem zálohy se správným názvem: databáze beze změny, hláška, žádná záloha „pred-obnovenim“. | **PATCH (beta teď)** (test) | S | vysoká |
| 13 | zlepšení | `instalovat.sh:25–29` | Odinstalace nechává `~/.cache/playboy-app` (mezipaměť WebKitu, i stovky MB). Data správně zůstávají. | Smazat mezipaměť při `--odinstalovat` nebo to aspoň vypsat. | PATCH (po 1.0) → 1.8 | S | střední |
| 14 | zlepšení | `instalovat.sh:66–75` | Bez ImageMagicku (na Fedora Workstation ve výchozí instalaci není) se do adresářů 256×256 a 512×512 kopíruje ikona 1024×1024. GNOME ji zmenší, ale ikona v adresáři neodpovídá jeho velikosti a zbytečně zabírá místo. | Ikony 256/512 připravit předem v `build/` a jen je kopírovat. | PATCH (po 1.0) → 1.8 | S | vysoká |
| 15 | zlepšení | `go.mod:8–11` | Dostupné aktualizace: Wails 2.17.0 (v ROADMAP ř. 139 už je jako údržba), `modernc.org/sqlite` 1.61.0, nepřímé `labstack/echo` 4.16.2 a `modernc.org/libc` 1.79.0. `golang.org/x/*` jsou aktuální. Zranitelnosti nešlo ověřit (govulncheck bez přístupu k vuln.go.dev). | Po 1.0 jako údržba: `go get -u`, `govulncheck ./...` u uživatele, ověření na Fedoře. | PATCH (po 1.0) | S | vysoká |
| 16 | zlepšení | `frontend/wailsjs/go/main/App.js` | Vazby jsou dnes v souladu s Go (85 metod, ověřeno porovnáním). Test hlídá jen, že `backend.js` obaluje `App.js`, ne že `App.js` odpovídá Go. Zastaralé vazby po ručním zásahu by prošly testy i typy. | Go test, který porovná exportované metody `*App` (přes `reflect`) se seznamem v `App.js`. | PATCH (beta teď) (test) | S | vysoká |

Zkontrolováno bez nálezu: opakované spuštění instalátoru (přepíše binárku přes `.novy` a `mv`, mkdir -p, ikony
i položku znovu vytvoří), uvozovky u všech cest v `instalovat.sh`, `cd "$(dirname "$0")"`, chování `|| true`
u `obnovit_nabidku` pod `set -e`, balíčky pro Fedoru (`webkit2gtk4.1-devel`, `gtk3-devel`, `pkgconf-pkg-config`
odpovídají `pkg-config --exists webkit2gtk-4.1 gtk+-3.0`), `build:tags` ve `wails.json`, globální přepínače
v testech (`overitSoubor`, `poImportuModelky`) se vracejí přes `t.Cleanup` nebo `defer`. Testy záloh používají
pevné datum (`app_test.go:1161`, 31. 3. 2026), takže nezávisí na konci měsíce. `kontrola.go:91`, `:151`
porovnávají s `time.Now()`, ale testy nepoužívají data blízko dnešku. Žádný test neběží paralelně.

### Návrh `zkontrolovat.sh`

```bash
#!/bin/bash
# Všechny kontroly před vydáním: ./zkontrolovat.sh (rychle: ./zkontrolovat.sh --rychle)
set -euo pipefail
cd "$(dirname "$0")"
krok() { printf '\n== %s\n' "$*"; }

krok "Frontend: závislosti a sestavení (go:embed potřebuje frontend/dist)"
(cd frontend && { [ -d node_modules ] || npm ci; } && npm run build >/dev/null)
krok "Frontend: testy a typy"
(cd frontend && npm test && npm run typy)
krok "Kontrolní součet package.json"
[ "$(md5sum frontend/package.json | cut -d' ' -f1)" = "$(cat frontend/package.json.md5)" ] \
  || { echo "package.json.md5 neodpovídá – spočítej znovu" >&2; exit 1; }
krok "Go: vet a testy"
go vet ./...
if [ "${1:-}" = "--rychle" ]; then go test -short -count=1 ./...; else go test -count=1 ./...; fi
krok "Volitelné nástroje"
command -v shellcheck >/dev/null && shellcheck -e SC1111 instalovat.sh zkontrolovat.sh || echo "shellcheck není – přeskočeno"
command -v govulncheck >/dev/null && govulncheck ./... || echo "govulncheck není – přeskočeno"
krok "Pracovní strom"
git status --porcelain | grep -q . && echo "Pozor: necommitnuté změny" || echo "čistý"
echo; echo "Vše prošlo."
```

## 3. Chybějící testy podle priority (všechno PATCH)

1. **`TestVerzeSouhlasi` rozšířit** (`app_test.go:1588`): md5 souboru `package.json` = `package.json.md5`;
   `package-lock.json` má `version` na ř. 3 i v `packages[""]`. Nález 1.
2. **`ObnovitZalohu` s poškozenou zálohou** (`app.go:445–453`): soubor se správným názvem a nesmyslným obsahem →
   hláška „Záloha je poškozená“, data beze změny, nevznikne záloha `pred-obnovenim`. Dále neplatný název
   (`../x.db`) a záloha se starším schématem, kde proběhne migrace.
3. **Výběry** (`vydani.go:179`, `:217`): `PrejmenovatVyber` (prázdný nebo mezerový název → false, běžné
   přejmenování, neexistující id), `OdebratZVyberu` (odebrání části fotek, pořadí ostatních zůstane, odebrání
   fotky, která ve výběru není).
4. **`OdebratModelkuZAlba`** (`alba.go:138`): další modelka zmizí jen z daného alba, hlavní modelka a fotky
   zůstanou, neexistující album nic nesmaže.
5. **`GetTagy`** (`alba.go:658`): odstranění duplicit bez ohledu na diakritiku a velikost písmen („Blond“ a
   „blond“), mezery kolem čárek, prázdné tagy, prázdná sbírka → `[]` (ne `nil`, kvůli JSON).
6. **Sloučení a přesuny – chybové větve** (`alba.go:258–336`, `342–411`): `SloucitAlba` se stejným albem a
   s neexistujícím cílem, selhání zálohy (adresář záloh jen pro čtení) → nic se nezmění; `PresunoutFotky`
   s duplicitami v cíli a s neplatným klíčem alba; `SloucitModelky` s neplatnými id.
7. **`DeleteVse`** (`app.go:1958–1983`): selhání zálohy → nic se nesmaže.
8. **Vazby Go ↔ `App.js`**: reflexí seznam exportovaných metod `*App` = `export function` v
   `frontend/wailsjs/go/main/App.js` (nález 16).
9. **`OveritOdkaz`** (`app.go:2441`): text bez odkazu na Disk → `souborNedostupny`, odkaz → volá `overitSoubor`
   s prvním ID (náhradou, bez sítě). `overitSouborNaDisku` přes `httptest.Server` (200 a `image/*` → dostupný,
   200 a `text/html` → nedostupný, 429 a 5xx → neověřeno). Vyžaduje vyměnitelnou adresu.
10. **Frontend, po přesunu do `src/lib` (nález 8)**: `kvantil` (0, 0,25, 0,5, jedna hodnota), `hodnotaSloupce`
    (počet, podíl s prázdnou skupinou → null, medián), `krivka` (okno na krajích, méně než 3 modelky → null),
    `vekVLetech` (měsíc narození po měsíci vydání, nesmyslný věk → null), `krokOsy` (1, 7, 0), `radaVCase` pro
    měsíce s pevným „dnes“ 31. 1. a 29. 2. (přechod roku, konec měsíce); `shanenaCisla`/`textShanim`
    a `ukolyModelky`.
11. **`format.js` – nepokryté řádky** (85–86, 253–255, 410–415, 445–460, 497–502, 518–532): `obrazek`,
    pokračovací řádek odrážky v changelogu, váha v kg a librách, hledání s `-`/`!` a `klic:hodnota`, `poleFotky`,
    cílené hledání s neznámým klíčem.

## 4. Návrh rozdělení do vydání

| Verze | Obsah | Nálezy |
|---|---|---|
| **0.99.6** (beta, oprava) | Instalátor: neznámý přepínač → chyba a nápověda, `Exec="$BIN"`. README a ROADMAP sjednocené s pravidlem verzování (značky, MINOR), komentář ve `verze.go`, poznámka o `npm run build` před `go test`. `TestVerzeSouhlasi` hlídá md5 a `package-lock.json`. | 1, 3, 4, 6, 7 |
| **0.99.7** (beta, testy a skript) | `zkontrolovat.sh`; testy z oddílu 3, body 2–9 (bez změny chování programu). | 9, 11, 12, 16 |
| **1.0.x** (PATCH po 1.0, údržba) | Rezerva časových testů a `-short`; aktualizace závislostí (Wails 2.17.0, sqlite) s `govulncheck` a ověřením na Fedoře. | 10, 15 |
| **1.8 Zálohy a aktualizace** | `npm ci` místo `npm install`; kontrola verze Go a čistého pracovního stromu v instalátoru (navazuje na „aktualizace jedním příkazem“); úklid mezipaměti při odinstalaci; předpřipravené ikony 256 a 512. | 2, 5, 13, 14 |
| **nové téma 1.x „Kvalita kódu a testy“** (nebo po krocích jako PATCH) | Čisté výpočty Statistik a Přehledu do `src/lib` s testy (oddíl 3, body 10–11). | 8 |
