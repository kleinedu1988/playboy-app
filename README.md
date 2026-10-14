# Playboy Database

Desktopová aplikace (Wails v2: Go + Vanilla JS) pro osobní katalog modelek, alb, centerfoldů
a coverů časopisů. Fotky se neukládají do aplikace, načítají se z Google Disku podle odkazu.

## Spuštění

```
wails dev      # vývoj s automatickým obnovením
wails build    # výsledný program v build/bin/playboy-app
go test ./...  # testy backendu (nepotřebují síť)
cd frontend && npm test  # testy čistých funkcí rozhraní (frontend/src/lib) a obalu backendu
cd frontend && npm run typy  # kontrola typů (TypeScript nad JS s JSDoc, typy backendu z wailsjs)
```

Značka `webkit2_41`, kterou vyžaduje Fedora, je nastavená ve `wails.json`.

## Verze

Program se verzuje podle sémantického verzování; seznam změn je v `CHANGELOG.md`, verze se ukazuje
v nabídce ⋯. Do 1.0.0 zvyšuje MINOR každá změna schématu databáze nebo formátu exportu.

Vydání verze:

1. v `verze.go` odstranit příponu `-dev` (nebo nastavit novou verzi), stejné číslo dát do
   `wails.json` (`info.productVersion`) a `frontend/package.json` (`version`),
2. v `CHANGELOG.md` nahradit „nevydáno“ datem,
3. `go test ./...` (test hlídá, že verze souhlasí), commit a značka `git tag -a vX.Y.Z`,
4. po vydání zvednout verzi na další s příponou `-dev` a v changelogu založit oddíl „nevydáno“.

## Kde jsou data

| Co | Kde |
|---|---|
| Databáze | `~/.local/share/playboy-app/playboy.db` |
| Zálohy: denní při spuštění (7 denních a 4 týdenní) a před mazáním a importem (20 od každého druhu) | `~/.local/share/playboy-app/zalohy/` |
| Velikost a stav okna při posledním zavření | `~/.local/share/playboy-app/okno.json` |
| Mezipaměť obrázků | `~/.cache/<název programu>/WebKitCache` |

Soubory na Disku musí být sdílené „kdokoli s odkazem", aplikace se k Disku nepřihlašuje.

## Struktura

- `app.go` – databáze a veškerá logika (modelky, fotky, alba, covery, zálohy, kontrola odkazů)
- `export.go` – export a import sbírky v YAML; formát popisuje `EXPORT.md`
- `schema.go` – úprava č. 6 (album jako záznam) a uzavřené výčty s kontrolou vstupu
- `vydani.go` – údaje čísel časopisu a výběry
- `nastaveni.go` – zapamatování okna, zámek heslem, přehled sbírky
- `instance.go` – zámek jediné instance
- `frontend/src/main.js` – start: načte moduly, zaregistruje obsluhu událostí v pevném pořadí, spustí program
- `frontend/src/app/` – moduly rozhraní po pohledech a oknech (galerie, profil, prohlížeč, kalendář, přehled,
  formuláře…). Sdílený stav je jeden objekt v `stav.js`; backend se volá jen přes `backend.js`, který po každém
  zápisu ohlásí změnu (`udalosti.js`) a mezipaměti pohledů a seznam modelek (`mezipamet.js`) se zahodí na jednom
  místě. Akce s fotkou skládá `akce-fotky.js`, ovládání klávesnicí `klavesnice.js`.
- `frontend/src/sablona.js` – kostra okna (HTML)
- `frontend/src/ui/` – sdílené prvky rozhraní: oznámení, lišta částí, kontextová nabídka
- `frontend/src/lib/` – čisté funkce rozhraní (texty, alba), které jdou testovat bez okna
- `alba.go` – sdílená alba, přesuny a slučování, vrácení odebraných fotek
- `main.go` – okno aplikace
- `frontend/src/style.css` – vzhled

Změny schématu databáze jsou očíslované úpravy v `migrace` (`app.go`); databáze si číslo poslední
provedené pamatuje v `PRAGMA user_version` a před čekajícími úpravami se uloží záloha. Každá úprava běží
v transakci spolu se zápisem čísla, takže se buď provede celá, nebo vůbec. Nová úprava se přidává na konec
seznamu, hotové se nemění; test `TestPrechodZeVsechSchemat` ověřuje přechod z každého staršího schématu.

Od schématu 6 fotky (`fotky`) odkazují na album (`alba`), které nese vydání, spojení plakátu, text,
fotografa a „netýká se“; cover je album bez modelky. Cizí klíče jsou zapnuté. Pohled `fotografie`
skládá obojí do dřívější podoby pro čtení; zapisuje se přímo do tabulek.

## Heslo

Program jde zamknout heslem (pravé tlačítko na volném místě galerie → „Nastavit heslo…"). Zámek chrání
rozhraní; soubor databáze šifrovaný není a fotky zůstávají na Disku sdílené odkazem.

Zapomenuté heslo se zruší smazáním jeho otisku z databáze:

```
sqlite3 ~/.local/share/playboy-app/playboy.db "DELETE FROM nastaveni WHERE klic = 'heslo'"
```

## Obnovení ze zálohy

Tlačítko ⋯ v hlavičce → „Obnovit ze zálohy…". Před obnovením se uloží současný stav jako záloha
„Před obnovením", takže jde vrátit i obnovení; heslo zůstává současné.

## Edice

Vydání je uložené jako `RRRR-MM` (nebo jen `RRRR` u pictorialu), výchozí edice US bez přípony,
ostatní s příponou: `2009-11-CZ`. Edice se volí ve formuláři alba a coveru; kalendář ukazuje vždy jednu.

## Cílené hledání

Do hledání modelek jde psát i `pole:hodnota`, např. `vlasy:blond`, `fotograf:"arny freytag"`, `rok:1975`
(rok vydání), `narozena:1990`, `edice:CZ`, `tag:`, `role:`, `narodnost:`, `oci:`, `misto:`. Slova se kombinují.

## Prohlížení

- **Nejlepší** (přepínač v hlavičce): fotky s 3, 4 nebo 5 srdíčky napříč sbírkou.
- **Ročník**: klik na rok v kalendáři; všechna čísla roku po měsících.
- **Fotograf**: klik na „Foto:“ u alba; všechna jeho alba.
- **Prohlížeč fotek**: šipky listují, nahoru/dolů skáčou mezi alby, mezerník spouští slideshow, S míchá pořadí,
  F rozkládá plakát, R otáčí, 1–5 hodnotí, Esc zavírá. Interval slideshow je v nabídce ⋯.
- **Akce s fotkou** (do výběru, profil, Disk, odkaz, odebrat): tlačítko ⋯ na dlaždici a v prohlížeči, pravé
  tlačítko nebo klávesa nabídky.
- **Výběr více fotek** v profilu, na stránce vydání, ročníku, fotografa a v Nejlepších: Ctrl/Shift + klik,
  Ctrl+A vybere vše, Delete vybrané odebere (s možností vrátit), Esc výběr zruší.
- **Klávesnice**: Tab prochází karty a dlaždice, Enter otevírá, v nabídce fungují šipky; okna drží fokus uvnitř.

## Čísla časopisu a výběry

- **Údaje čísla**: na stránce vydání „Upravit číslo…“ (poznámka, modelka z obálky, stav sháním / nezajímá mě);
  stav jde nastavit i pravým tlačítkem na políčku kalendáře.
- **Výběry**: v profilu vybrat fotky (Ctrl/Shift + klik) → „Do výběru…“, nebo pravým tlačítkem na fotce;
  výběry se prohlížejí v přehledu Nejlepší.
