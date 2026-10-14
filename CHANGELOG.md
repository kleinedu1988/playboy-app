# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze se řídí [sémantickým verzováním](https://semver.org/lang/cs/): do verze 1.0.0 zvyšuje MINOR každá změna,
která mění schéma databáze nebo formát exportu, PATCH jen opravy. Verze v repozitáři jsou označené značkami
`vX.Y.Z`. Plán dalších verzí je v [ROADMAP.md](ROADMAP.md).

## [0.7.0] – 2026-10-14

Etapa 4 roadmapy: sbírka o stovkách modelek. Schéma databáze: úprava č. 4.

### Přidáno
- Zpět s historií: vrací tam, odkud se přišlo, i na stejné místo stránky; Alt + šipka vlevo.
- Lišta písmen A–Z nad galerií (od 20 modelek).
- Cílené hledání `pole:hodnota` (`vlasy:`, `fotograf:`, `rok:`, `narozena:`, `edice:`, `tag:`…).
- „Uložit a další“ ve formuláři modelky otevřeném z Přehledu.
- „Netýká se“ u chybějících údajů v Přehledu a přepínač pro zobrazení takto označených; stránkování tabulek.
- Šablona adresy obrázků v nastavení (⋯ → Adresa obrázků…).
- Verze programu v nabídce ⋯ a tento changelog.

### Změněno
- Kalendář sbaluje souvislé řady prázdných roků a načítá jeden řádek na vydání místo všech fotek.
- Kostra okna a sdílené prvky rozhraní jsou vyčleněné z `main.js` do `sablona.js` a `ui/`.

## [0.6.0] – 2026-10-14

Etapa 3 roadmapy: opravy bez mazání. Schéma databáze: úprava č. 3. Formát exportu: verze 2.

### Přidáno
- Album může patřit více modelkám; ukáže se v profilech všech.
- Přesun alba k jiné modelce, sloučení alb, sloučení duplicitních modelek.
- Výběr více fotek (Ctrl/Shift + klik): ohodnotit, přesunout do alba, odebrat.
- Tlačítko Vrátit po odebrání fotky.
- Otevřít fotku na Disku a kopírovat odkaz.
- Přejmenování fotografa nebo tagu v celé sbírce.

### Změněno
- Import běží v jedné transakci; při chybě se nezmění nic.
- Kontrola Disku si pamatuje stav u fotek, denně ověřuje dávku 300 nejdéle neověřených a odebrat nabízí
  jen opakovaně nedostupné fotky.

## [0.5.0] – 2026-10-14

Etapy 0–2 roadmapy. Schéma databáze: očíslované úpravy č. 1 a 2.

### Přidáno
- Denní záloha, obnovení ze zálohy z programu, zálohy rotované podle důvodu.
- Edice vydání (US a CZ, např. `2009-11-CZ`), přepínač edic v kalendáři.
- Přidávání ze stránky vydání a z prázdného políčka kalendáře, výběr modelky s našeptáváním
  a založením nové, „Uložit a přidat další album“.
- Převod amerických měr (5'7", 115 lbs, 34B-24-34), našeptávání fotografů z celé sbírky.
- Tlačítka + a ⋯ v hlavičce, Esc a Zrušit ve všech oknech, testy frontendu (`npm test`).

### Změněno
- Prohlížeč načítá obrázek podle velikosti okna, originál až pro lupu; menší náhledy, líné načítání plakátů.
- Hledání s prodlevou, bez ohledu na diakritiku jakéhokoli jazyka, zvlášť pro každý přehled.
- Stálé pořadí alb v profilu podle vydání.

### Opraveno
- Přidání fotek do existujícího alba mazalo jeho vydání.
- Dvojí kliknutí na Uložit vkládalo fotky nebo modelku dvakrát.
- Opožděná odpověď mohla při rychlém listování ukázat alba jiné modelky.
- Záloha se při chybě mohla tiše přeskočit; export mohl při chybě čtení zapsat prázdný soubor.
- Formulář modelky přepisoval prázdnou hodnotu, kterou nenabízel výběr.

### Zabezpečení
- Data, zálohy a export jsou čitelné jen pro vlastníka účtu; zámek jediné instance.

## [0.4.0] – 2026-10-14

### Přidáno
- Přehled sbírky: počty, tabulky toho, co chybí, ročníky, údaje ke kontrole.
- Zámek programu heslem.
- Zapamatování velikosti okna a posledního přehledu.
- Datum přidání u nových modelek a fotek.

## [0.3.0] – 2026-10-13

### Přidáno
- Ruční pořadí fotek v albu tažením, posun stránek spojeného plakátu.
- Export a import celé sbírky v YAML.

## [0.2.0] – 2026-10-13

### Přidáno
- Průvodní text a fotograf alba, hledání v textech alb.
- Lišty částí (alba v profilu, ročníky coverů, desetiletí kalendáře, alba v prohlížeči).
- Zkrácený náhled dlouhých alb, srdíčka u fotek, skok mezi alby v prohlížeči.
- Pictorial může patřit jen k ročníku bez měsíce.

### Změněno
- Přejmenování alba na název jiného alba téže modelky se odmítne (dřív se alba slila).

## [0.1.0] – 2026-10-13

První verze: katalog modelek s alby, centerfoldy a covery časopisů, fotky z Google Disku.

### Přidáno
- Galerie modelek s hledáním ve všech údajích, profil modelky s alby a prohlížečem fotek.
- Stěna centerfoldů, covery po ročnících, kalendář vydání a stránka vydání.
- Hodnocení modelek 1–5 srdíčky, rychlé přidání modelky jen jménem, formulář na záložkách.
- Zálohy před mazáním, kontrola dostupnosti souborů na Disku.

[0.7.0]: v0.7.0
[0.6.0]: v0.6.0
[0.5.0]: v0.5.0
[0.4.0]: v0.4.0
[0.3.0]: v0.3.0
[0.2.0]: v0.2.0
[0.1.0]: v0.1.0
