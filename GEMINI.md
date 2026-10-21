# Pravidla projektu Playboy Database

## Autonomie a schvalování změn
- **Úpravy prováděj přímo a autonomně bez nutnosti předchozího potvrzení uživatelem.** Uživatel výslovně udělil souhlas k provádění změn kódu, oprav a vylepšení rovnou.
- Není třeba se ptát na povolení ani čekat na odsouhlasení dílčích kroků; po zadání požadavku přímo navrhni a realizuj řešení.

## Verzování
- **Každá úprava kódu a chování aplikace musí být verzována.**
- Při každé úpravě zvedni verzi (PATCH pro opravy/vylepšení bez změny schématu DB či exportu) v:
  - `verze.go` (`const Verze`)
  - `wails.json` (`info.productVersion`)
  - `frontend/package.json` (`version`)
  - `frontend/package-lock.json` (`version`)
  - `frontend/package.json.md5`
  - `CHANGELOG.md` (přidat záznam s datem ve formátu `YYYY-MM-DD`)
- Změny vždy commituj do gitu s věcnou commit message.

## Beta (řada 0.90.x)
- Program je v betě: opravují se jen chyby; funkce a texty se nemění (nové nápady patří do `ROADMAP.md` po 1.0.0).
- **Neměnit schéma databáze (úprava č. 11) ani formát exportu (verze 7).** Hlídá to test `TestZmrazeniAlfy`;
  jeho úprava je vědomé rozhodnutí uživatele, ne součást opravy.
- Chyby z bety se zapisují do `PLAN.md`, plán do `ROADMAP.md`.

## Kvalita kódu a testování
- Po každé úpravě vždy ověř:
  - `go test ./...`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run typy`
  - `npm --prefix frontend run build`
- Všechny testy a typová kontrola musí projít bez chyb.
- Zachovávej existující komentáře, architekturu a konvence projektu.
