# Zbylé výskyty „Playmate“ a „Playboy“ v textech (0.02.022)

Prošlo ručně 10. 11. 2026 (`git grep -n -E 'Playmate|Playboy'` v `frontend/src` a v Go mimo testy a komentáře).
Opravené v 0.02.022 jsou na konci. Ostatní zůstávají, protože jde opravdu o Playboy, nebo o vnitřní název.

## Zůstává – opravdu jen Playboy

| Kde | Proč |
|---|---|
| `casopisy.go` výchozí řádek tabulky, `hledani.go` název „Playboy“ | výchozí časopis a jeho tituly |
| `zdroje_udaju.go`, `rocnik_wikipedie.go`, `rocnik-wiki.js`, `vydani.js` (Playmate měsíce podle Wikipedie) | seznamy „List of Playboy Playmates“ na Wikipedii existují jen pro Playboy US; jiné časopisy jsou 0.02.058–0.02.062 |
| `internal/kontrola` (Playmate roku bez centerfoldu, název alba „Playmate of the Year“) | kontrola role Playmate roku, ta je jen z Playboye |
| `kapesni-katalog.js` (lib i app), `prehled-uvod.js` „Playboy CZ – sháním“ | pohledy jen pro Playboy (0.02.007); karta CZ je Playboy CZ |
| `clanky.js` rubrika „Playboy Interview“, `sablona.js` „Playmate Review“ v příkladech speciálů | skutečné názvy rubrik a speciálů Playboye |
| `galerie_kolekce.go` „Alba z webu Playboy“, kolekce Playmate roku | online alba Playboye a titul Playboye |
| `oblibenost_temata*.go` témata „Playmates měsíce / roku“ | témata podle kategorie, ta je od 0.02.012 jen z Playboye |
| `oblibenost_vkus_veta.go` „byla Playboy Bunny“, „byla na obálce Playboye“ | Bunny je role Playboye; „Modelka obálky“ ve vkusu je od 0.02.022 jen z obálky Playboye |
| `hledani-dotaz.js` `pmom`, `pmoy`, `pb` | zkratky titulů a časopisu Playboy |
| `ui/kategorie.js` bubliny odvozených kategorií, `uceni.js` druhy kontrol | popisují odvození Playmate z Playboye |
| `prejmenovani.go` „Playboy Database“, `zdroje_udaju.go` User-Agent | starý název programu |

## Zůstává – vnitřní názvy

`TypPMMesice` / `TypPMRoku` („Playmate měsíce“ / „Playmate roku“ jako typ alba v databázi), `PlaymatePodleWikipedie`,
`maTitulModelky` v Údržbě (= modelka s titulem z galerií, od 0.02.045), `mapa-sbirky.js` rysy kategorií. Typ alba je obecná role, popisek
se bere podle časopisu (`titulCisla`, `popisDruhuCasopisu`).

## Opraveno v 0.02.022

- Vkus (`oblibenost_vkus.go`): centerfold Penthouse už nedává kategorii „Playmate měsíce“, ale titul časopisu
  („byla Pet of the Month“); obálka jiného časopisu není „byla na obálce Playboye“.
- Údržba: „Pet bez data narození“, „Číslo nemá Pet – přidej jí centerfold“; popis filtru Vše bez „Playmate“.
- Bublina odkazu `[[…]]`: „Pet Září 1985 · Penthouse“, „Pet: jméno“ u čísla jiného časopisu.
- Jako časopis: titulek čísla jiného časopisu bez „Playboy ·“; tlačítko „obálka, centerfold, další modelky…“.
- Nápověda: tituly jiných časopisů u Kategorií, Čísel v profilu a Jako časopis; Doplnit z webu a Ročník podle
  Wikipedie označené jako jen pro Playboy.
