# Playboy Database

Desktopová aplikace (Wails v2: Go + Vanilla JS) pro osobní katalog modelek, alb, centerfoldů,
coverů a čísel časopisu Playboy. Fotky se neukládají do aplikace, načítají se z Google Disku podle odkazu.

**Stav: beta (řada 0.90.x).** Program je použitelný na skutečné sbírce. Funkce, texty, schéma databáze (úprava
č. 11) a formát exportu (verze 7) jsou zmrazené; do vydání 1.0.0 přibývají jen opravy chyb. Plán dalších verzí je v [ROADMAP.md](ROADMAP.md),
změny v [CHANGELOG.md](CHANGELOG.md), formát exportu v [EXPORT.md](EXPORT.md).

## Co program umí

- **Modelky:** karty s titulní fotkou a srdíčky, profil s údaji (osobní, vzhled a míry, zařazení), alba
  a centerfoldy, články modelky. Kategorie (Playmate měsíce a roku, Cyber Girl, Coed, Muse, Celebrita, Modelka
  obálky, Jen ve speciálu, Creator). Řazení, filtry (srdíčka, edice, kategorie) a rejstřík písmen nebo roků.
- **Alba a fotky:** pictorialy, centerfoldy (i spojené plakáty z více stránek), sdílená alba více modelek,
  text alba, fotograf. Prohlížeč fotek se slideshow, lupou a hodnocením 1–5 srdíček; výběr více fotek,
  odebrání s možností vrátit, vlastní výběry fotek.
- **Čísla časopisu:** edice US a CZ, speciály, kalendář po rocích a měsících, stránka čísla s obsahem
  (články podle stran, centerfold, pictorialy), čtení článků a skenů stran jako rozevřeného časopisu,
  stránka ročníku a fotografa. Stav čísla **mám výtisk**, **sháním** (jen česká edice, sbírá se fyzicky)
  a **nezajímá mě**.
- **Centerfoldy** jako stěna plakátů, **Nejlepší** fotky napříč sbírkou podle srdíček.
- **Přehled:** hlavní čísla, mapa výtisků české edice a mapa úplnosti dat americké edice; **Údržba** (jedna
  fronta úkolů – co doplnit a opravit, s „Uložit a další“); **Sháním CZ** (seznam ke zkopírování);
  **Statistiky**: graf z rozvinutého seznamu (modelky, věk, míry, BMI a podíly jako blond vlasy či tetování podle roku prvního výskytu v časopise s křivkou; rozložení kategorií, národností…) a vedle něj modelky výběru; výběr roku, období nebo hodnoty platí pro všechny grafy.
- **Hledání:** rychlé výsledky (modelky, články i podle textu, čísla), cílené hledání `pole:hodnota`,
  rozsahy, vylučování a tolerance překlepů; stejně ve všech přehledech.
- **Data:** export a import v YAML (i Markdown), denní zálohy a obnovení, zámek heslem.
- Nápověda a přehled klávesových zkratek přímo v programu: klávesa `?` nebo ⋯ → Nápověda.

## Známá omezení

- Fotky zůstávají na Google Disku: musí být sdílené „kdokoli s odkazem“ a bez připojení k internetu se
  nenačtou (údaje sbírky jsou dostupné i bez připojení).
- Zámek heslem chrání jen rozhraní programu; soubor databáze šifrovaný není.
- Program je ověřený na Fedoře (GNOME, WebKitGTK 4.1); jiné distribuce nejspíš fungují, ale vyzkoušené nejsou.
- Jeden uživatel, jeden počítač: sbírka se nesynchronizuje, na jiný počítač se přenáší zkopírováním složky dat.

## Spuštění a vývoj

```
wails dev                    # vývoj s automatickým obnovením
wails build                  # výsledný program v build/bin/playboy-app
go test ./...                # testy backendu (nepotřebují síť)
cd frontend && npm test      # testy čistých funkcí rozhraní (frontend/src/lib) a obalu backendu
cd frontend && npm run typy  # kontrola typů (TypeScript nad JS s JSDoc, typy backendu z wailsjs)
```

Značka `webkit2_41`, kterou vyžaduje Fedora, je nastavená ve `wails.json`. Doporučené Go je 1.26.10 nebo
novější (opravy bezpečnosti standardní knihovny, `toolchain` v `go.mod`); na Fedoře `sudo dnf upgrade golang`.
Wails zůstává na verzi 2.16.0, se kterou je program ověřený na Fedoře.

## Instalace a aktualizace

**Poprvé na čisté Fedoře** (Fedora 44 nebo novější kvůli Go 1.26; verzi ukáže `go version`):

```
sudo dnf install git golang nodejs npm gcc pkgconf-pkg-config gtk3-devel webkit2gtk4.1-devel
go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
git clone https://github.com/kleinedu1988/playboy-app.git
cd playboy-app
./instalovat.sh
```

Wails se nainstaluje do `~/go/bin`; `instalovat.sh` ho tam najde i bez úpravy `PATH`. Když něco chybí,
skript vypíše, co doinstalovat. Program se pak spouští z nabídky aplikací.

**Aktualizace a další možnosti** (ve složce `playboy-app`):

```
git pull                         # stáhne nejnovější verzi
./instalovat.sh                  # sestaví program a nainstaluje ho do nabídky aplikací (i aktualizace)
./instalovat.sh --bez-sestaveni  # nainstaluje už sestavený build/bin/playboy-app
./instalovat.sh --odinstalovat   # odebere program; data a zálohy zůstanou
```

Instaluje se jen do domovské složky, bez sudo: program do `~/.local/bin/playboy-app`, ikona do
`~/.local/share/icons/hicolor/` (256x256 a 512x512), položka „Playboy Database“ do `~/.local/share/applications/`.
Databáze se při prvním startu nové verze sama upraví (před úpravou se uloží záloha). Po aktualizaci se
jednou ukáže okno „Co je nového“.

**Přenos na jiný počítač:** program zavřít (při zavření se deník změn zapíše do databáze a soubory `-wal` a `-shm` zmizí), zkopírovat celou složku `~/.local/share/playboy-app` (databáze,
zálohy, stav okna) na stejné místo na novém počítači a tam program nainstalovat. Heslo, pokud je nastavené,
platí dál. Mezipaměť obrázků se nepřenáší, vytvoří se znovu.

## Kde jsou data

| Co | Kde |
|---|---|
| Databáze (za běhu programu i deník změn `playboy.db-wal` a `playboy.db-shm`) | `~/.local/share/playboy-app/playboy.db` |
| Zálohy: denní při spuštění (7 denních a 4 týdenní) a před každou hromadnou změnou (20 od každého druhu) | `~/.local/share/playboy-app/zalohy/` |
| Velikost a stav okna při posledním zavření | `~/.local/share/playboy-app/okno.json` |
| Mezipaměť obrázků | `~/.cache/<název programu>/WebKitCache` |

Soubory na Disku musí být sdílené „kdokoli s odkazem“, aplikace se k Disku nepřihlašuje.

## Zálohy, obnovení a heslo

Zálohy vznikají samy (viz tabulka). Obnovení: ⋯ v hlavičce → „Obnovit ze zálohy…“. Před obnovením se uloží
současný stav jako záloha „Před obnovením“, takže jde vrátit i obnovení; heslo zůstává současné.

Heslo se nastaví v ⋯ → „Nastavit heslo…“. Zámek chrání rozhraní; soubor databáze šifrovaný není a fotky
zůstávají na Disku sdílené odkazem. Zapomenuté heslo se zruší smazáním jeho otisku z databáze:

```
sqlite3 ~/.local/share/playboy-app/playboy.db "DELETE FROM nastaveni WHERE klic = 'heslo'"
```

## Čísla a edice

Vydání je uložené jako `RRRR-MM` (nebo jen `RRRR` u pictorialu k ročníku), výchozí edice US bez přípony,
ostatní s příponou: `2009-11-CZ`. Edice se volí ve formuláři alba a coveru; kalendář ukazuje vždy jednu.

**Speciály** (Playmate Review, Lingerie, Calendar…) jsou čísla mimo měsíční řadu: `RRRR-Snn`, tedy rok, `S`
a pořadí v roce (`1995-S01`, české `1995-S01-CZ`); název je uložený u čísla. Zakládají se ve formuláři alba
nebo coveru („Nový speciál…“) nebo pravým tlačítkem na nadpis roku v kalendáři; v kalendáři jsou jako štítky
pod měsíci roku, na stránce ročníku mají vlastní oddíl. Přejmenovat je jde v okně „Upravit číslo…“.

**Měsíční řady:** americká edice vycházela měsíčně od 12/1953 (první číslo s Marilyn Monroe) do 03/2020
(Spring 2020); od roku 2025 vychází jako ročenka a čtvrtletník a ta čísla se evidují jako speciály. Česká edice
začíná číslem 07/2011. Měsíce mimo řadu a jednotlivá čísla, která nevyšla (březen 1955), se v kalendáři, ročníku
ani v mapách Přehledu nepočítají jako chybějící. Pravidla jsou v `RADY_EDIC` a `NEVYSLA_CISLA`
(`frontend/src/lib/format.js`).

## Cílené hledání

Více slov zužuje výběr. Cíleně `pole:hodnota`: `jmeno`, `vlasy`, `oci`, `narodnost`, `etnicita`, `misto`,
`tag`, `role`, `fotograf`, `rok` (rok vydání), `vydani`, `narozena`, `umrti`, `edice`, `prsa`, `ochlupeni`,
`poznamka`, `vyska`, `vaha`, `miry`, `hodnoceni`, `tetovani`, `piercing`, `obalka`. Víceslovná hodnota do
uvozovek (`fotograf:"arny freytag"`), rozsahy a porovnání (`rok:1970..1979`, `vyska:>175`), vyloučení
pomlčkou (`-vlasy:blond`).

## Verze a vydání

Program se verzuje podle sémantického verzování; verze se ukazuje v nabídce ⋯. Do 1.0.0 zvyšuje MINOR
každá změna schématu databáze nebo formátu exportu, PATCH ostatní změny. Alfa má řadu 0.5x: MINOR pro větší zásah do programu (třeba změnu ukládání), PATCH pro opravy.

Vydání verze:

1. stejné číslo do `verze.go`, `wails.json` (`info.productVersion`), `frontend/package.json`
   a `frontend/package-lock.json` (`version`), znovu spočítat `frontend/package.json.md5`,
2. v `CHANGELOG.md` nový oddíl `## [X.Y.Z] – RRRR-MM-DD`,
3. `go test ./...` (test hlídá, že verze souhlasí a má oddíl v changelogu), testy a typy frontendu,
4. commit; u milníků (alfa, beta, 1.0.0) i značka `git tag -a vX.Y.Z`.

Novinky z `CHANGELOG.md` se při sestavení vloží do programu (okno „Co je nového“), proto se changelog píše
pro uživatele.

## Struktura

- `main.go` – okno aplikace; `instance.go` – zámek jediné instance
- `app.go` – databáze, migrace a hlavní logika (modelky, fotky, alba, covery, zálohy, kontrola odkazů)
- `schema.go` – album jako záznam (úprava č. 6) a uzavřené výčty s kontrolou vstupu
- `alba.go` – sdílená alba, přesuny a slučování, vrácení odebraných fotek
- `vydani.go` – údaje čísel časopisu, speciály a výběry
- `udaje.go` – kontrola a úprava údajů modelek (data narození a úmrtí, „na obálce“)
- `kontrola.go` – Kontrola v Údržbě: pravidla pro údaje, které vypadají jako překlep, a „V pořádku“
- `kontrola_uceni.go` – učení Kontroly ze sbírky: naučené rozsahy, neobvyklé kombinace údajů, podobná jména
- `clanky.go` – články, skeny stran a fulltextové hledání (SQLite FTS5)
- `statistiky.go`, `vyvoj.go` – statistiky a vývoj modelek v čase
- `nastaveni.go` – zapamatování okna, zámek heslem, přehled sbírky
- `export.go` – export a import sbírky v YAML; formát popisuje `EXPORT.md`, vzor je `vzor-exportu.yaml`
- `build/appicon.png` – ikona programu (1024 px, průhledné rohy); `build/windows/icon.ico` je z ní zmenšená
- `frontend/src/main.js` – start: načte moduly, zaregistruje obsluhu událostí v pevném pořadí, spustí program
- `frontend/src/app/` – moduly rozhraní po pohledech a oknech (galerie, profil, prohlížeč, kalendář, přehled,
  formuláře…). Sdílený stav je jeden objekt v `stav.js`; backend se volá jen přes `backend.js`, který po každém
  zápisu ohlásí změnu (`udalosti.js`) a mezipaměti pohledů a seznam modelek (`mezipamet.js`) se zahodí na jednom
  místě. Kontextové nabídky skládá `nabidky.js` (akce s fotkou `akce-fotky.js`), ovládání klávesnicí `klavesnice.js`.
- `frontend/src/sablona.js` – kostra okna (HTML) včetně nápovědy
- `frontend/src/ui/` – sdílené prvky rozhraní: oznámení, kontextová nabídka, lišta voleb, prázdné stavy, kostry
- `frontend/src/lib/` – čisté funkce rozhraní (texty, hledání, alba, changelog), které jdou testovat bez okna
- `frontend/src/style.css` – vzhled

Změny schématu databáze jsou očíslované úpravy v `migrace` (`app.go`); databáze si číslo poslední
provedené pamatuje v `PRAGMA user_version` a před čekajícími úpravami se uloží záloha. Každá úprava běží
v transakci spolu se zápisem čísla, takže se buď provede celá, nebo vůbec. Nová úprava se přidává na konec
seznamu, hotové se nemění; test `TestPrechodZeVsechSchemat` ověřuje přechod z každého staršího schématu,
`TestPrechodZeStarychVerzi` převezme databáze a exporty, které vytvořily skutečné starší verze programu
(`testdata/stare-verze`, 0.4 až 0.33), a porovná obsah, a `TestZmrazeniAlfy` hlídá, že v alfě nepřibude úprava
schématu ani nová verze exportu.

Od schématu 6 fotky (`fotky`) odkazují na album (`alba`), které nese vydání, spojení plakátu, text,
fotografa a „netýká se“; cover je album bez modelky. Cizí klíče jsou zapnuté. Pohled `fotografie`
skládá obojí do dřívější podoby pro čtení; zapisuje se přímo do tabulek.

## Licence

Zdrojový kód je pod licencí [MIT](LICENSE). Vznikl za pomoci AI asistentů pod vedením autora. Licence se
týká jen kódu: ochranná známka Playboy patří svému vlastníkovi (projekt s ním není spojený) a fotky, skeny
a další obsah sbírky nejsou součástí programu.
