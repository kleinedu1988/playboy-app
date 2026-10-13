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
| Mezipaměť obrázků | `~/.cache/<název programu>/WebKitCache` |

Soubory na Disku musí být sdílené „kdokoli s odkazem", aplikace se k Disku nepřihlašuje.

## Struktura

- `app.go` – databáze a veškerá logika (modelky, fotky, alba, covery, zálohy, kontrola odkazů)
- `main.go` – okno aplikace
- `frontend/src/main.js`, `style.css` – celé rozhraní
