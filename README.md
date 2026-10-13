# Playboy Database

Desktopová aplikace (Wails v2: Go + Vanilla JS) pro osobní katalog modelek, alb, centerfoldů
a coverů časopisů. Fotky se neukládají do aplikace, načítají se z Google Disku podle odkazu.

## Spuštění

```
wails dev      # vývoj s automatickým obnovením
wails build    # výsledný program v build/bin/playboy-app
go test ./...  # testy backendu (nepotřebují síť)
```

Značka `webkit2_41`, kterou vyžaduje Fedora, je nastavená ve `wails.json`.

## Kde jsou data

| Co | Kde |
|---|---|
| Databáze | `~/.local/share/playboy-app/playboy.db` |
| Zálohy před mazáním (posledních 20) | `~/.local/share/playboy-app/zalohy/` |
| Velikost a stav okna při posledním zavření | `~/.local/share/playboy-app/okno.json` |
| Mezipaměť obrázků | `~/.cache/<název programu>/WebKitCache` |

Soubory na Disku musí být sdílené „kdokoli s odkazem", aplikace se k Disku nepřihlašuje.

## Struktura

- `app.go` – databáze a veškerá logika (modelky, fotky, alba, covery, zálohy, kontrola odkazů)
- `export.go` – export a import sbírky v YAML
- `main.go` – okno aplikace
- `frontend/src/main.js`, `style.css` – celé rozhraní

## Heslo

Program jde zamknout heslem (pravé tlačítko na volném místě galerie → „Nastavit heslo…"). Zámek chrání
rozhraní; soubor databáze šifrovaný není a fotky zůstávají na Disku sdílené odkazem.

Zapomenuté heslo se zruší smazáním jeho otisku z databáze:

```
sqlite3 ~/.local/share/playboy-app/playboy.db "DELETE FROM nastaveni WHERE klic = 'heslo'"
```
