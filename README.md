# Playboy Database

Desktopová aplikace (Wails v2: Go + Vanilla JS) pro osobní katalog modelek, alb, centerfoldů
a coverů časopisů. Fotky se neukládají do aplikace, načítají se z Google Disku podle odkazu.

## Spuštění

```
wails dev      # vývoj s automatickým obnovením
wails build    # výsledný program v build/bin/playboy-app
go test ./...  # testy backendu (nepotřebují síť)
cd frontend && npm test  # testy čistých funkcí rozhraní (frontend/src/lib)
```

Značka `webkit2_41`, kterou vyžaduje Fedora, je nastavená ve `wails.json`.

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
- `export.go` – export a import sbírky v YAML
- `nastaveni.go` – zapamatování okna, zámek heslem, přehled sbírky
- `instance.go` – zámek jediné instance
- `frontend/src/lib/` – čisté funkce rozhraní (texty, alba), které jdou testovat bez okna

Změny schématu databáze jsou očíslované úpravy v `migrace` (`app.go`); databáze si číslo poslední
provedené pamatuje v `PRAGMA user_version` a před každou čekající úpravou se uloží záloha. Nová úprava
se přidává na konec seznamu, hotové se nemění.
- `main.go` – okno aplikace
- `frontend/src/main.js`, `style.css` – celé rozhraní

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
