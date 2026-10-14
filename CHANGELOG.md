# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze se řídí [sémantickým verzováním](https://semver.org/lang/cs/): do verze 1.0.0 zvyšuje MINOR každá změna,
která mění schéma databáze nebo formát exportu, PATCH jen opravy. Verze v repozitáři jsou označené značkami
`vX.Y.Z`. Plán dalších verzí je v [ROADMAP.md](ROADMAP.md).

## [0.16.1] – 2026-10-14

Méně nevyužitého místa v přehledech. Schéma databáze ani formát exportu se nemění.

### Změněno
- Svislá lišta vlevo je úzký rejstřík: jen písmeno, rok nebo měsíc (A, 1970, Bře 26) bez rámečků; celý název
  a počet jsou v nápovědě po najetí myší. Zabírá zhruba třetinu dřívější šířky.
- Nejlepší mají lištu jmen modelek zase vodorovně nahoře; celá jména se do úzkého pruhu nevejdou.
- Karty v galerii modelek vyplní celou šířku okna, vpravo nezůstává prázdný pruh.

## [0.16.0] – 2026-10-14

První fáze sjednocení rozhraní podle průchodu celým programem. Schéma databáze ani formát exportu se nemění.

### Změněno
- Horní lišta se vejde do každé šířky okna: postupně ubývá název programu, šířka přepínačů a jejich text
  (zkratky Mod, Cf…), v nejužším okně hledání. Tlačítka okna (Zavřít) zůstávají vždy vidět.
- Zvolený štítek a režim mají růžové podbarvení; najetí myší jen zvýrazní okraj, takže se obojí nedá splést.
- Svislá lišta přehledů má pevnou šířku: obsah začíná ve všech přehledech na stejném místě a neposkočí,
  když lišta zmizí (filtr srdíček, řazení stěny).
- Mazání je červené a v nabídkách vždy poslední za oddělovačem (modelka, album, cover, fotka, celá databáze).
  V potvrzovacím okně mazání a dalších nevratných akcí (sloučení modelek, obnovení ze zálohy) je výchozí
  volbou Zrušit, takže je Enter neprovede omylem.
- Pole hledání říká, co v daném přehledu hledá (modelku, jméno nebo vydání, rok…); v Přehledu je vypnuté.
- Srdíčka u fotky v profilu se změní na místě; album se podle nich seřadí až při dalším otevření, fotka tak
  neodskočí pod rukama a stránka zůstane, kde byla.
- Tlačítka a pole mají písmo okna. Růžový text má lepší kontrast, tlačítka v barvě akcentu jsou tmavší.

### Přidáno
- Zavření rozepsaného okna modelky, alba nebo coveru (Esc, křížek, Zrušit) se zeptá, zda změny zahodit.

## [0.15.0] – 2026-10-14

Jednotné volby v přehledech a svislá lišta pro skákání. Schéma databáze ani formát exportu se nemění.

### Změněno
- Řazení a filtr srdíček u Modelek jsou štítky nad kartami (abecedně, nově přidané, podle roku; ♥ 1+ až ♥ 5)
  jako volby u Centerfoldů a Nejlepších, ne tlačítka v horní liště. Klik na zvolený filtr srdíček ho zruší;
  vedle je počet zobrazených modelek.
- Lišta pro skákání v přehledech (písmena nebo měsíce u Modelek, desetiletí u Centerfoldů, ročníky coverů,
  kalendář, modelky v Nejlepších) je svislý sloupec vlevo, který při rolování zůstává na místě. Když se do
  okna nevejde, roluje se sám a má šipky nahoru a dolů. Lišta alb v profilu zůstává nahoře.

## [0.14.3] – 2026-10-14

Opravy nálezů auditu před alfou. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Data: import v režimu jen pro čtení (poškozená nebo novější databáze) už nezapisuje; sloučení modelek
  nesmaže album, kterému zůstal jen text; smazání modelky sloučí sdílené album se stejnojmenným albem další
  modelky místo smazání jeho fotek; obnovení nejstarší zálohy ji už nesmaže dřív, než se zkopíruje; po
  nezdařené úpravě obnovené zálohy přejde program do režimu jen pro čtení; export a import zachovají datum
  přidání coverů.
- Import ručně psaných souborů: řádek „Zdroj: …“ uvnitř neodsazené poznámky zůstane v poznámce; blok kódu
  jiného jazyka (json…) v Markdownu už nepřebere okolní text.
- Rozhraní: okna (Přidat do výběru…, formuláře) se z prohlížeče otevírají nad ním; profil po šipkách a Zpět
  ukazuje čerstvé údaje a formulář už nepřepíše dřívější úpravu; „Odebrat“ a Delete ve vlastním výběru
  odebírají jen z výběru; po uložení alba se obnoví i vydání a věk v hlavičce profilu; okno alba zůstane
  otevřené, když se neuloží žádná fotka; ⋯ na plakátu centerfoldu nabízí akce s fotkou; Esc zavře prohlížeč
  dřív než výběr pod ním; „Otevřít profil“ z prohlížeče prohlížeč zavře; klávesa nabídky v prohlížeči ukáže
  akce s fotkou; Alt+← a ? nefungují nad oknem, prohlížečem a zámkem; ročník nepočítá speciály mezi 12 čísel;
  rok s označeným číslem se v kalendáři nesbalí; zrušený „Nový speciál…“ vrátí původní měsíc; „Co je nového“
  rozliší předběžné verze (alpha, beta, rc).
- Výkon: profil modelky se načítá přes index alb (na sbírce 500 modelek a 20 000 fotek z 14–48 ms na 6 ms),
  export celé sbírky z 10,7 s na 2,2 s, import z 12,4 s na 4,6 s, převod staré databáze schématu 5 z 12 s
  na desetiny sekundy; hromadné zápisy (srdíčka, otočení, výběry) v jedné transakci.

## [0.14.2] – 2026-10-14

### Opraveno
- Import ručně psaných a převedených souborů (např. Markdown z Google Dokumentů): položka seznamu začínající
  odrážkou `*` nebo `+` místo pomlčky, víceřádkový text pod `|`, který ztratil odsazení, odsazení tabulátorem,
  dvojtečka uvnitř hodnoty a blok kódu v Markdownu bez označení `yaml` (i s `~~~`). Správně napsané soubory
  se čtou beze změny.

## [0.14.1] – 2026-10-14

Oprava chyby z verze 0.14.0. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Potvrzovací okno nešlo potvrdit: import souborů, smazání modelky, přidání modelky se jménem, které už ve
  sbírce je, smazání databáze a další dotazy ano/ne se po kliknutí na tlačítko neprovedly a okno zůstalo otevřené.

## [0.14.0] – 2026-10-14

Dokončení etapy 10 roadmapy: nápověda, novinky a úvod v programu. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Nápověda v programu: klávesa `?` nebo ⋯ → Nápověda. Klávesy prohlížeče, akce a výběr, cílené hledání,
  čísla časopisu a speciály, Přehled, import a zálohy.
- „Co je nového“: po aktualizaci se jednou ukáže, co přibylo od naposledy viděné verze; z nabídky ⋯ (položka
  Verze) posledních pět verzí. Text se bere z CHANGELOG.md při sestavení programu.
- Úvod prázdné sbírky: první kroky (sdílení na Disku, první modelka, import, heslo) s tlačítky.

### Změněno
- Číslování připravené na předběžné verze `1.0.0-alpha.N`, `1.0.0-beta.N` a `1.0.0-rc.N`.
- Smazání celé databáze se potvrzuje napsáním slova SMAZAT; okno řekne, kolik modelek se smaže a jak sbírku
  obnovit ze zálohy.

## [0.13.0] – 2026-10-14

První část etapy 10 roadmapy (příprava k vydání): rozhodnutí o řazení, výtiscích a speciálech a instalace.

### Přidáno
- Řazení galerie jedním tlačítkem vedle ♡: abecedně, naposledy přidané, podle roku prvního vydání; lišta nad
  galerií ukazuje podle řazení písmena, měsíce přidání nebo desetiletí. Volba se pamatuje.
- Stav čísla „mám výtisk“ vedle „sháním“ a „nezajímá mě“; v kalendáři zelený rámeček.
- Instalace do nabídky aplikací skriptem `instalovat.sh` (bez sudo, i aktualizace a odinstalace); v README
  postup přenosu dat na jiný počítač.
- Speciály (Playmate Review, Lingerie…): čísla mimo měsíční řadu s vlastním názvem, klíč `RRRR-Snn`
  (s edicí `RRRR-Snn-CZ`). Zakládají se v okně alba a coveru nebo z kalendáře, v kalendáři jsou štítky pod
  měsíci, ročník je zahrnuje, Přehled je mezi čísly bez centerfoldu nepočítá.

### Změněno
- Schéma databáze: úprava č. 7 (název speciálu u čísla). Formát exportu: verze 5 (`nazev` u vydání).

## [0.12.0] – 2026-10-14

Import více souborů a Markdownu (vydáno samostatně před zbytkem etapy 10). Schéma databáze se nemění, formát
exportu zůstává verze 4; import jen přijímá víc podob souboru.

### Přidáno
- Import více souborů najednou (jedna záloha, jedna transakce: buď vše, nebo nic). Kromě `.yaml` a `.yml`
  bere i `.md`: YAML z bloků ```yaml, z úvodní hlavičky mezi `---`, jinak celý soubor.
- Soubor může obsahovat jen jednu modelku s údaji přímo nahoře (bez `modelky:`), nebo seznam modelek.

### Opraveno
- Modelka uvedená v importu dvakrát (třeba ve dvou souborech) se doplní, nezaloží se podruhé a druhý výskyt
  nesmaže údaje z prvního.

## [0.11.0] – 2026-10-14

Etapa 9 roadmapy: rozhraní na dlouhou trať. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Tlačítko ⋯ na dlaždici fotky, na plakátu a v prohlížeči: přidat do výběru, otevřít profil, otevřít na Disku,
  kopírovat odkaz, odebrat. Do výběru jde fotka přidat odkudkoli, nejen z profilu.
- Výběr více fotek i na stránce vydání, ročníku a fotografa a v Nejlepších; Ctrl+A vybere vše, Delete vybrané
  odebere (s možností vrátit), tlačítko Vybrat vše.
- Ovládání klávesnicí: karty a dlaždice jdou zaměřit Tabem a otevřít Enterem, kontextová nabídka se ovládá
  šipkami, okna a prohlížeč drží fokus uvnitř a po zavření ho vrátí; klávesa nabídky ukáže akce u prvku.

### Změněno
- Rozhraní je rozdělené z jednoho souboru o 3 700 řádcích do modulů po pohledech; sdílený stav je na jednom
  místě a po každém zápisu do databáze se mezipaměti pohledů zahodí samy, takže žádný pohled neukáže stav před
  změnou. Seznam modelek se načítá jednou a sdílí.
- Kontrola typů rozhraní (`npm run typy`) včetně volání backendu.
- Nejlepší a stránky vydání se skládají bez hledání v poli u každé dlaždice; oddíly Nejlepších mimo obrazovku
  se nevykreslují.
- Sjednocené texty („Upravit modelku“ místo „Editovat“, „Přidat do výběru…“) a nápovědy, které zmiňovaly
  jen pravé tlačítko.

### Opraveno
- Počet fotek u alba s nula fotkami se psal „0 fotky“.

## [0.10.0] – 2026-10-14

Etapa 8 roadmapy: pevné schéma. Schéma databáze: úprava č. 6. Formát exportu: verze 4 (popis v [EXPORT.md](EXPORT.md)).
Vzhled programu se nemění.

### Změněno
- Album je samostatný záznam: fotky na něj odkazují, vydání a spojení plakátu jsou údaje alba. Text, fotograf,
  „netýká se“ i další modelky přežijí odebrání poslední fotky a vrátí se s novými fotkami; celé album maže
  jen Smazat album.
- Cover časopisu je album bez modelky (dřív zástupná modelka 0); databáze hlídá vazby cizími klíči.
- Vydání je uložené u všech typů alb a má index.
- Každá úprava schématu běží v transakci spolu s číslem schématu: nezdařená úprava se vrátí celá.
  Úprava č. 1 je zmrazená a chyby už nezamlčuje.
- Export verze 4: novější soubor se odmítne celý, modelky stejného jména se rozliší číslem, přibylo
  „netýká se“, datum přidání každé fotky, spojení a pořadí coverů a alba bez fotek.

### Opraveno
- Import do sbírky se dvěma modelkami stejného jména je už nesloučí.
- Backend kontroluje typ alba, název centerfoldu a coveru, edici a klíče „netýká se“ jedním pravidlem
  pro zadávání i import; dřív přijal i to, co import pak odmítl.
- Typ prsou a ochlupení z importu se uloží v tvaru z nabídky formuláře bez ohledu na velikost písmen
  („přírodní“ → „Přírodní“); dřív je formulář nepoznal a další uložení údaj smazalo. Hodnota mimo nabídku
  se ohlásí.

## [0.9.1] – 2026-10-14

Etapa 7 roadmapy: opravy chyb nalezených při ověření verze 0.9.0. Schéma databáze ani formát exportu se nemění.

### Opraveno
- Výkon velké sbírky: galerie, kalendář a Přehled už nepoužívají dotazy rostoucí se součinem modelek a fotek
  (na 500 modelkách a 20 000 fotkách galerie z 15,7 s na 0,09 s, kalendář z 8,2 s na 0,15 s, Přehled z 38 s
  na 0,4 s); výkonnostní test hlídá, že to tak zůstane.
- Import běží na vlastním spojení a při jakékoli chybě zápisu se celý vrátí; souběžné změny se do něj nepřimíchají.
  Obnovení ze zálohy nejdřív vymění soubor a staré spojení zavře až potom; adresa obrázků zůstává současná.
- Vrátit po odebrání fotky už nepřepíše jiné oznámení a vrátí i členství ve výběrech, další modelky alba
  a „netýká se“.
- „Netýká se“ u alba přežije uložení prázdného textu; v tabulce Vydání znamená stav „nezajímá mě“.
- Sloučení alb ponechá duplicitní fotce vyšší hodnocení a místo ve výběrech; sloučení modelek převede obálky
  a sloučí odkazy.
- Smazání hlavní modelky sdíleného alba ho předá další modelce; profil se po úpravě sdíleného alba překreslí,
  smazání sdíleného alba varuje.
- Alt + šipka vlevo už nelistuje modelkami, šipky nefungují při výběru fotek ani nad otevřenou nabídkou, Esc
  nezruší neviditelný výběr, klávesy prohlížeče neplatí při psaní do pole.
- Hledání z profilu nebo stránky vydání hledá modelky a Zpět vrací tam, odkud se hledalo.
- „Uložit a další“ prochází pevnou frontu modelek, kterým chybí právě daný údaj.
- Nad poškozenou databází nebo databází z novější verze běží program jen pro čtení.
- Kontrola dostupnosti nevyhladoví na trvale nedostupných fotkách a zapisuje v jedné transakci; ověřená fotka
  si při vložení uloží datum. Šablona adresy obrázků se před uložením ověří na fotce ze sbírky.
- Řazení a hledání s písmeny jako Ł, Ø, ß stejně v databázi i v rozhraní („Émilie“ už se neřadí za Z).
- Zastaralá odpověď už nepřepíše mezipaměť přehledu.

## [0.9.0] – 2026-10-14

Etapa 6 roadmapy: vydání a vazby. Schéma databáze: úprava č. 5. Formát exportu: verze 3.

### Přidáno
- Údaje čísla časopisu: poznámka, modelka z obálky a stav „sháním / nezajímá mě“ (Upravit číslo… na stránce
  vydání, pravé tlačítko v kalendáři). Kalendář chybějící čísla podle stavu zvýrazní nebo ztlumí,
  Přehled čísla „nezajímá mě“ nedoplňuje. Profil modelky ukazuje, na kterých obálkách je.
- Odkazy u modelky (Wikipedie a podobně), v profilu jako štítky s názvem webu.
- Vlastní výběry fotek napříč modelkami: „Do výběru…“ u vybraných fotek a v nabídce fotky, prohlížení
  a správa v přehledu Nejlepší.
- Export a import zahrnují údaje čísel, výběry a odkazy.

## [0.8.0] – 2026-10-14

Etapa 5 roadmapy: prohlížení napříč sbírkou. Schéma databáze ani formát exportu se nemění.

### Přidáno
- Přehled Nejlepší: fotky s 3, 4 nebo 5 srdíčky napříč sbírkou po modelkách, s lištou modelek a slideshow.
- Stránka ročníku: všechna čísla roku po měsících i pictorialy přiřazené jen k ročníku; otevírá se
  klikem na rok v kalendáři.
- Stránka fotografa: jeho alba napříč modelkami chronologicky; otevírá se klikem na „Foto:“ u alba.
- Stěna centerfoldů podle vydání jako časová osa s lištou desetiletí.
- Zamíchané pořadí v prohlížeči (tlačítko nebo klávesa S), nastavitelný interval slideshow, náhodná modelka.

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

[0.9.1]: v0.9.1
[0.9.0]: v0.9.0
[0.8.0]: v0.8.0
[0.7.0]: v0.7.0
[0.6.0]: v0.6.0
[0.5.0]: v0.5.0
[0.4.0]: v0.4.0
[0.3.0]: v0.3.0
[0.2.0]: v0.2.0
[0.1.0]: v0.1.0
