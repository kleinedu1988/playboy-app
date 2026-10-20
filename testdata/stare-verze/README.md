# Databáze a exporty starších verzí

Test `TestPrechodZeStarychVerzi` (`prechod_test.go`) z nich ověřuje, že současná verze převezme data ze všech
dřívějších schémat databáze a formátů exportu beze ztráty.

Každá složka je jedna starší verze programu (0.4.0 až 0.33.0, u každé změny schématu nebo exportu jedna):

- `playboy.db` – databáze, kterou vytvořila ta verze svými vlastními funkcemi (modelky se všemi údaji, alba
  s texty a fotografy, centerfold jako spojený plakát, srdíčka, pořadí a otočení fotek, covery, sdílené album,
  „netýká se“, stav a údaje čísla, výběr, speciál, článek – podle toho, co verze uměla),
- `export.yaml` – export téže sbírky ve formátu té verze,
- `snimek.json` – obsah sbírky, jak ho ta verze vracela rozhraní (modelky, fotky, covery, výběry, stavy čísel…).

Soubory vznikly spuštěním generátoru dat v pracovních kopiích starých verzí z gitu (20. 10. 2026). Nemění se;
nová verze s novým schématem nebo exportem přidá další složku.
