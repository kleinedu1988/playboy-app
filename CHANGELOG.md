# Changelog

Všechny podstatné změny programu Pinup Katalog. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze mají tvar X.XX.XXX (MAJOR.MINOR.PATCH s pevnou šířkou, např. 0.02.003) podle oddílu „Pravidlo verzování“
v [ROADMAP.md](ROADMAP.md).
Historie do 1.53.0 (program se jmenoval Playboy Database) je v
[docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md](docs/archiv/CHANGELOG-PLAYBOY-DATABASE.md).

## [0.02.041] – 2026-11-11

### Opraveno
- **Profil › nadtitulek:** zalomený řádek už nezačíná „·“ (oddělovač drží u předchozí položky) – např. Jenna Sativa
  při šířce okna 1280 px.
- **Průvodní texty alb a poznámky:** nadpisy `####` až `######` (texty z webu, Allison Parks „#### NATURAL WONDER“)
  se vykreslí jako malý nadpis, ne jako text s mřížkami.

### Ověřeno
- Profily Buffy Tyler, Ulla Lindstrom, Jenna Sativa, Ali Rose a Allison Parks (záhlaví, štítky, pásky čísel,
  alba, panel Údaje s blokem Časopisy) ve skrytém WebKitGTK při 1280 a 1920 px: nic nepřetéká za okno ani se
  neuseká (kromě pásu alb, který se posouvá šipkou).

### Pro vývoj
- `snimky_rozhrani_test.go` (`go test -tags snimky`) a `nastroje/snimky/`: snímky obrazovek programu nad kopií
  sbírky s měřením přetékajících prvků, pro další kroky ladění.

## [0.02.040] – 2026-11-11

### Přidáno
- **Proč modelka nemá odhad srdíček:** profil nehodnocené modelky bez odhadu ukáže tlumený štítek „bez odhadu ·
  čeká na galerii / na analýzu fotek / málo údajů / nejistý odhad / model se učí“ s vysvětlením v nápovědě.
- **Hodnocení › souhrn odhadů:** pod větou o modelu vkusu „Odhad srdíček má N nehodnocených modelek · čeká na
  galerii: … · čeká na analýzu fotek: …“.

### Ověřeno
- Na kopii sbírky (i s analýzou obsahu): odhad má 179 nehodnocených modelek, 63 čeká na galerii, 2 na analýzu
  fotek. Číslo 56 „bez odhadu“ z 0.02.037 vzniklo jen tím, že kopie neměla složku analýzy obsahu.

## [0.02.039] – 2026-11-11

### Přidáno
- **Údržba › návrh čísla alba z údajů modelky:** pictorial bez čísla dostane jediné číslo z textového vydání
  a vystoupení modelky, i s časopisem (Heide Mann „1970-10@PH“). Datum z názvu alba převezme časopis z údajů;
  rok v názvu, který k číslu nesedí, návrh vylučuje.
- **Návrh typu alba** i pro „Pet / Honey of the Month / Year“ a „Playmates of the Month“ v názvu, a z titulu
  zapsaného jen v Roli (PMOTM, Penthouse Pet, Hustler Honey), když je to její jediný pictorial.
- **Vrátit po hromadném přijetí návrhů:** oznámení nabídne Vrátit; čísla, data a fotografové alb se vyprázdní,
  typ alba se vrátí na Pictorial, údaje modelek také (mezitím ručně změněné zůstanou).

### Změněno
- Návrh „Playmate roku“ do Role se už nedělá (tituly se od 0.02.038 berou jen z alb). Hodnota návrhu typu alba je
  popsaná obecně („Pictorial modelky měsíce (Playmate / Pet / Honey of the Month)“).

## [0.02.038] – 2026-11-11

### Změněno
- **Tituly všude z galerií:** kategorie ve filtrech Galerie, hledání `kategorie:` a `role:`, Statistikách, Mapě
  sbírky, Údržbě, kolekcích Galerie a v modelu vkusu se berou stejně jako štítky profilu (0.02.034) – tituly
  z alb (centerfold, Playmate / Pet of the Month a Year, Cyber Girl, obálka, online album), z pole Role jen profese.
  Playboy Bunny zůstává profesí (povolání v klubu).
- Online album dává kategorii „Online“; výskyt „jen online“ jen z online alb, ne ze zápisu v Roli.

### Opraveno
- **Prázdné album Centerfold** (fotka ještě není nahraná) a pictorial pojmenovaný „Playmate of the Month …“,
  „Penthouse Pet of the Year …“ dávají titul. Na sbírce tak má titul 321 Playmate měsíce, které ho v profilu
  od 0.02.034 neměly (např. Allison Parks „Playboy 1965 · Playmate měsíce · Playmate roku 1966“).

## [0.02.037] – 2026-11-11

### Změněno
- **Kontrolní seznam po obrazovkách:** 213 neověřených bodů z `K-VYZKOUSENI.md` (verze 1.45–0.02.036) je shrnuto
  do 39 bodů podle obrazovek (Profil, Galerie, Čísla, Okno alba, Hodnocení, Údržba, Statistiky, Správa, Vzhled);
  podrobné body jsou v `docs/archiv/K-VYZKOUSENI-DO-0.02.036.md`.
- Ověřeno na kopii sbírky: přesun dat po přejmenování, tabulka časopisů, žádný falešný kandidát na sloučení, štítky
  vzorových modelek, platný model vkusu; body „Playboy jako dřív“ kryjí testy.
- Zjištěno pro další kroky: online alba Penthouse se počítají jako Playboy (Jenna Sativa), 56 nehodnocených modelek
  s fotkami bez odhadu, pseudonym u dvou modelek, nestálé výkonové testy.

## [0.02.036] – 2026-11-11

### Opraveno
- **Modelka jiného časopisu s albem bez čísla už není Playmate Playboye** (nahlášeno u Heide Mann): album bez čísla
  (import, starší zápisy) si vezme jednoznačné číslo z údajů modelky – textové vydání „1970-10“ a text vystoupení
  „Penthouse říjen 1970“ dají 1970-10@PH. Profil pak ukáže „Penthouse 1970 · Pet of the Month“. Číslo vybrané
  v okně alba má vždy přednost; do databáze se nic nezapisuje (album zůstává v Údržbě mezi alby bez vydání).
- Textové vydání bez časopisu dostane časopis i z textu vystoupení (dřív jen podle alb, 0.02.032).
- Další kroky ROADMAP posunuté o jedna (Označit stránky je 0.02.049).

## [0.02.035] – 2026-11-11

### Přidáno
- **Otevřít PDF čísla** (⋯ › Otevřít PDF čísla…): prohlížeč PDF v okně programu (pdf.js, načte se až při prvním
  otevření). Vlevo náhledy stran (kreslí se, až se ukážou), vpravo strana nebo dvoustrana jako v tištěném časopise
  (obálka sama, pak 2–3, 4–5…), lupa 50–400 %. Klávesy ←/→, PageUp/PageDown, Home/End, +/−, 0 přizpůsobit,
  D dvoustrana, Esc; Ctrl + kolečko lupa. Oznámení řekne, za kolik sekund se číslo otevřelo.
- Soubor vybraný v dialogu vydá Go jen pod náhodnou adresou `/pdf/<token>` (jiné soubory z disku okno nepřečte).
- Rozhodnutí před PDF krokem: stránky z PDF se budou exportovat jako obrázky pro Google Disk, fotky zůstávají
  odkazy na Disk (0.02.051).

### Závislosti
- `pdfjs-dist` 5.7.284 (rozhraní, jen v samostatném balíčku načteném při otevření PDF).

## [0.02.034] – 2026-11-11

### Změněno
- **Jednotná struktura štítků pod jménem pro všechny časopisy:** za každý časopis „Playboy 2000“ / „Penthouse 1969“
  (rok prvního vydání), pak role v časopise jen z galerií – Playmate měsíce / Pet of the Month / Honey of the Month
  (centerfold nebo pictorial s tím typem), modelka roku, obálka, jinak „Pictorial“; online alba Playboye „Cyber Girl …“
  (album Cyber Girl), jinak „Online“. Na konci profese z pole Role: vždy Modelka, pak Herečka, Zpěvačka,
  Pornoherečka… (anglické názvy česky, „Model“ = Modelka). Nadtitulek profilu má stejnou strukturu.
- Titulové zápisy v Roli (PMOTM, Penthouse Pet, Centerfold, Playboy Cybergirl…) se v profilu neukazují – titul musí
  vyplývat z galerie. V poli Role zůstávají, filtry a hledání kategorií je zatím berou dál.
- Blok v Údajích se jmenuje vždy „Časopisy“ (dřív u modelky jen z Playboye „Playboy“).
- Další kroky ROADMAP posunuté o jedna (Otevřít PDF je 0.02.035).

## [0.02.033] – 2026-11-11

### Přidáno
- **Sloučení modelek s rozdílem nanečisto a Vrátit:** před sloučením okno ukáže, co se změní – alba (přejde, nebo se
  sloučí se stejným albem), doplněné údaje, údaje, kde zůstane cílová hodnota, další jméno, srdíčka, porovnání,
  obálky a články. Po sloučení je v oznámení **Vrátit**: obě modelky zpět přesně jako předtím (i s ID, fotkami, tagy,
  výběry, srdíčky). Vrátit platí do zavření programu a odmítne, když u modelky mezitím přibylo album nebo fotka.
- Kandidát na sloučení v Údržbě má místo „Opravit“ tlačítko **Sloučit** (rovnou do starší modelky dvojice).
- Porovnání, zájem, historie srdíček zdrojové modelky přejdou na cílovou (dřív zůstala u smazané modelky);
  vzájemná porovnání obou modelek se odloží do Vrátit.
- Jméno zdrojové modelky jde do Dalších jmen s časopisem („Jane Doe @PH“), když vyšla jen v jiném časopise.

## [0.02.032] – 2026-11-11

### Opraveno
- **Modelka z jiného časopisu nedostane Playboy z importovaných údajů:** starší textové vydání (pole pictorial_vydani,
  typicky z importu) bez časopisu, které modelka mezi alby má jen u jiného časopisu („1969-11“ vedle alba Pet of the
  Month „1969-11@PH“), se bere jako číslo toho časopisu. Profil pak neukazuje „Playboy 1969“ a číslo dvakrát
  („Lis 69, Lis 69 · PH“). Po uložení modelky ve formuláři se oprava zapíše i do databáze.
- Další kroky ROADMAP posunuté o jedna (Sloučení je 0.02.033).

## [0.02.031] – 2026-11-11

### Opraveno
- **Odhad srdíček až po první galerii:** modelka dostane odhad (štítek „odhad“ v seznamu a profilu, pořadí
  oblíbenosti, „Mohlo by se ti líbit“) jen tehdy, když má fotky s hotovou analýzou obsahu (CLIP) nebo hodnocené
  fotky. Dosud stačily čtyři skupiny údajů (vlasy, desetiletí, kategorie…), takže odhad dostala i modelka bez
  jediné fotky. Model se dál učí na všech hodnocených modelkách a porovnáních, odhad jen neukáže předčasně.
- Další kroky ROADMAP posunuté o jedna (Sloučení je 0.02.033).

## [0.02.030] – 2026-11-11

### Přidáno
- **Vizuální podobnost u kandidátů na sloučení:** nález uvádí i důvody z fotek – „podobné fotky (88 %)“ (střed
  vektorů obsahu CLIP obou modelek, od 85 %) a „stejná fotka u obou“ / „skoro stejná fotka u obou“ (stejný soubor
  nebo otisky jako Údržba › Stejné fotky). Kandidáti jdou od nejsilnějších (víc důvodů, podobnější fotky).
  Kandidátem se dvojice stává dál jen podle jména a data narození.

## [0.02.029] – 2026-11-10

### Přidáno
- **Kandidáti na sloučení** v Údržbě › Ke kontrole (zdroj „kandidát na sloučení“): dvě modelky se stejným jménem
  nebo přezdívkou, jejichž data narození si neodporují („nejspíš tatáž modelka jako … – stejné datum narození,
  čísla z různých časopisů – sloučit?“). Jiné datum narození kandidáta vylučuje; bez data jen u různých časopisů.
  Takovou dvojici už nehlásí i „ok-jmeno“. Sloučení samo je 0.02.033.

### Opraveno
- Kontrola stejných jmen porovnávala přezdívky i s příponou časopisu („Jane Doe @PH“).

## [0.02.028] – 2026-11-10

### Opraveno
- Odkaz `[[Jane Doe]]` vede na modelku s přezdívkou „Jane Doe @PH“ (od 0.02.027 přípona časopisu porovnání
  rozbíjela).

### Změněno
- **Hledání podle přezdívek:** hledání, našeptávač, `[[odkazy]]` a filtry galerie berou přezdívky bez přípony
  časopisu (`@PH` se jako text nehledá). Našeptávač u modelky nalezené pod jiným jménem ukáže „jako Jane Doe
  (Penthouse) · …“, návrh odkazu „modelka · jako Jane Doe (Penthouse)“.
- Zásobník odkazů je u konkrétní modelky a jména nehledá; rozpoznání odkazů z webů časopisů je 0.02.056.

## [0.02.027] – 2026-11-10

### Přidáno
- **Přezdívky podle časopisu:** v poli Další jména jde ke jménu připsat časopis, pod kterým modelka vyšla jinak
  („Jane Doe @PH“). Při uložení se zápis sjednotí („jane doe@ph“ → „jane doe @PH“), v profilu se ukáže
  „také Jane Doe (Penthouse)“; je v exportu jako dosud (pole `dalsi_jmena`, beze změny schématu i formátu exportu).
- Porovnávání jmen (stejná modelka při přidání, kontrola podobných jmen, `[[odkazy]]`, Doplnit z webu, Ročník
  podle Wikipedie) bere přezdívku bez přípony časopisu.

## [0.02.026] – 2026-11-10

### Přidáno
- **Kariéra v profilu napříč časopisy:** modelka s číslem jiného časopisu má v záhlaví profilu místo kategorií
  souhrn s roky, časopisy podle prvního čísla („Pet of the Month 1985 · Playmate 1987 · Playmate roku 1989“;
  bez titulu „Obálka Hustler 1990“ nebo „Penthouse 1986“). Blok údajů se pak jmenuje „Časopisy“.
- Čísla jiného časopisu v pásce záhlaví (podtržení) a ve štítcích Vydání / Na obálce (lem) mají barvu časopisu ze
  Správy › Časopisy. Modelka jen z Playboye beze změny.

## [0.02.025] – 2026-11-10

### Přidáno
- **Hero stěny Centerfoldů** (jako Kalendář a Obálky): centerfold zvolené volby stěny (Playboy, Penthouse, Všechny
  časopisy…) – napřed čísla z tohoto měsíce dřívějších let (centerfold dne), pak nejlépe hodnocené – se jménem,
  titulem podle časopisu a číslem („Pet of the Month · Září 1985 · Penthouse“), srdíčky a fotografem. Akce Profil,
  Otevřít číslo a Další ↻. Otočené fotky hero vynechá; při hledání se neukazuje.

## [0.02.024] – 2026-11-10

### Přidáno
- **Hero Obálek** (jako Kalendář): obálka zvolené řady – napřed čísla z tohoto měsíce dřívějších let (výročí),
  pak nejlépe hodnocené obálky – s počtem obálek, kdo je na obálce (jinak centerfold čísla), srdíčky a počtem
  chybějících obálek v rozpracovaných ročnících. Akce Otevřít číslo, Bez obálky (přepne zobrazení na čísla bez
  coveru) a Další ↻ („3 z 120“). Při hledání se neukazuje (`lib/hero-obalek.js`).

## [0.02.023] – 2026-11-10

### Přidáno
- **Hero Kalendáře** (jako Profily a Statistiky): nahoře ročník zvolené řady s obálkou čísla, počtem čísel
  („9 z 12 čísel“), úplností (kompletní, cover, centerfold, pictorial) a chybějícími měsíci. Napřed ročník, jehož
  číslo z tohoto měsíce je ve sbírce („Listopad 1990 vyšlo před 36 lety – centerfold …“). Akce Otevřít číslo /
  ročník, Ukázat v kalendáři, Doplnit chybějící a Další ročník ↻. Při hledání se neukazuje (`lib/hero-kalendare.js`).

## [0.02.022] – 2026-11-10

### Opraveno
- **Vkus u jiných časopisů:** centerfold Penthouse už model vkusu nepočítá jako „Playmate měsíce“; vlastností je
  titul časopisu (věta „byla Pet of the Month“). Obálka jiného časopisu už není „byla na obálce Playboye“.

### Změněno
- **Zbylé texty podle časopisu:** Údržba („Pet bez data narození“, „Číslo nemá Pet – přidej jí centerfold“),
  bublina odkazu `[[…]]`, titulek Jako časopis u čísla jiného časopisu, popis tlačítka a nápověda (tituly jiných
  časopisů; funkce Wikipedie označené jako jen pro Playboy).
- Seznam zbylých výskytů „Playmate“ a „Playboy“ s důvodem: `docs/VYSKYTY-PLAYMATE.md`.

## [0.02.021] – 2026-11-10

### Přidáno
- **Síň slávy podle časopisu:** v liště pohledů volba „Všechny časopisy / Playboy / Penthouse / …“ (jen když má
  sbírka modelky aspoň dvou časopisů; pamatuje se). Zúží Top 10, Legendy, Odznaky, Rekordy, Kroniku i pořadí
  Sezóny na modelky s číslem nebo obálkou daného časopisu; místa zůstávají celková.

### Změněno
- **Rok ve sbírce** počítá dokončené ročníky všech časopisů („Ročník 1985 Penthouse US je celý“), dřív jen Playboy.

## [0.02.020] – 2026-11-10

### Změněno
- **Statistiky a Postřehy podle časopisu:** když jsou ve sbírce čísla jiného časopisu, texty grafů v čase
  a Postřehy říkají „rok prvního výskytu v Playboyi“ místo „v časopise“ (Statistiky počítají zatím jen Playboy,
  filtr časopisu je 0.02.061). Se samotným Playboyem beze změny.
- Mapa sbírky obarvená kategorií má barvu „Titul jiného časopisu“ (Pet of the Month, Honey of the Month…);
  dřív takové modelky byly šedé bez položky v legendě. Rozložení Kategorie už tituly ukazuje podle časopisu.

## [0.02.019] – 2026-11-10

### Přidáno
- **Hledání podle časopisu:** `casopis:penthouse` (i `casopis:ph`, `casopis:playboy`, `casopis:pb`) v hledání
  modelek (Go, `TextCasopisu`), na stěně Centerfoldů, v Kalendáři a Obálkách; funguje s negací
  (`-casopis:penthouse`), s ostatními podmínkami a v chytrých výběrech.
- Zkratky `pb`, `ph`, `hu` a slova `penthouse`, `hustler` se v chytrém hledání převedou na čip „Časopis: …“
  (`ph 80. léta`); samotné „playboy“ zůstává hledaným textem. Našeptávač nabízí `casopis:` a po něm časopisy
  s počtem modelek.

## [0.02.018] – 2026-11-10

### Změněno
- **Stěna Centerfoldů podle časopisu:** volba v liště se jmenuje „Časopis“ a nabízí Playboy (výchozí, jako dřív
  „vše“), Playboy US a CZ, Penthouse, Penthouse US a UK, Hustler, další časopisy z tabulky a Všechny časopisy
  (`moznostiSteny` a `naSteneCenterfoldu` ve `format.js`). Stěna Penthouse ukáže jen Pet of the Month.

## [0.02.017] – 2026-11-10

### Přidáno
- **Mapa čísel pro každý časopis:** Sbírka › Mapa čísel má kartu „Penthouse US · archiv dat“ (a další řady
  z tabulky časopisů), jakmile sbírka má číslo té řady: úplnost od prvního čísla řady (Penthouse US 1969–2018),
  kompletní / částečné / chybí, měsíce mimo řadu prázdné. Americká edice Playboye používá stejnou kartu beze změny.
- ⋯ › Vzhled › Karty Mapy čísel: mapy jiných časopisů jde skrýt a posouvat; nová řada se zařadí za americkou edici.

## [0.02.016] – 2026-11-10

### Změněno
- **Kalendář a Obálky podle časopisu:** volba v liště se jmenuje „Časopis a edice“ a nabízí všechny řady z tabulky
  časopisů (Playboy US, Playboy CZ, Penthouse US, Penthouse UK, Hustler US…); zvolená se pamatuje jako dřív
  edice. Kalendář Penthouse ukáže zadaná čísla, chybějící měsíce s + a „nevyšlo“ podle řady Penthouse.
- Nové album, cover a rychlé přidání nabídnou časopis zobrazený v Kalendáři, dokud se neuloží jiný.
- Prázdný stav: „Penthouse US: zatím žádné číslo“.

## [0.02.015] – 2026-11-10

### Přidáno
- **Řady čísel Penthouse a Hustleru** v `lib/rady-cisel.js` (z Wikipedie, odkaz u každé řady): Penthouse US
  09/1969–2018, Penthouse UK 03/1965–1999, Hustler od 07/1974. Ročník Penthouse ukáže měsíce před prvním číslem
  jako „nevyšlo“ a „X z Y čísel“ počítá podle řady.
- Konce řad jsou zapsané spíš později: Penthouse US měl od 2009 jen 11 a od 2017 10 čísel ročně a v letech
  2019–2023 vycházel jednou za dva měsíce; které měsíce chyběly, zdroj neuvádí, proto se v ročníku mohou ukázat
  jako chybějící. Konec britské edice zdroj uvádí jednou 1998, jednou 1999.

## [0.02.014] – 2026-11-10

### Změněno
- **Řady čísel jako data:** od kdy do kdy edice vycházela a která čísla nevyšla je v `lib/rady-cisel.js` podle
  řady (`US`, `CZ`, později `PH/US`…), s poznámkou zdroje. `cisloNevyslo` a `ciselRocniku` z něj čtou; Playboy se
  chová přesně jako dřív (test na každý měsíc 1950–2030 v obou edicích). `NEVYSLA_CISLA` zaniklo, nevyšlá čísla
  jsou u řady.
- ROADMAP: etapa 0.02 pokračuje. Kroky dřívější etapy 0.03 (řady čísel Penthouse a Hustleru, Kalendář, Mapa čísel,
  stěna a hledání podle časopisu) jsou 0.02.014–0.02.019, další etapy se posunuly o jedno číslo (Pojmy podle
  časopisu jsou 0.03, Dotažení a beta 0.08). Odkazy „0.03“ ve starších záznamech níže míří na původní číslování.

## [0.02.013] – 2026-11-10

### Přidáno
- **Správa časopisů** (⋯ › Časopisy…, `app/sprava-casopisu.js`): seznam časopisů s barvou, edicemi a tituly;
  nový časopis (název, zkratka, barva, edice, titul modelky měsíce a roku), úprava a smazání. Nový časopis je hned
  ve volbě „Časopis a edice“.
- Backend `UlozitCasopis` a `SmazatCasopis` (`casopisy.go`): zkratka se po založení nemění; edici, která má
  ve sbírce čísla, nejde ubrat; smazat jde jen časopis bez čísel; Playboy smazat nejde a jeho edice (US, CZ)
  zůstávají pevné, název a tituly jdou změnit.

## [0.02.012] – 2026-11-10

### Změněno
- **Kategorie podle časopisu:** „Playmate měsíce“ a „Playmate roku“ se odvozují jen z čísel Playboye. Centerfold
  nebo pictorial modelky měsíce Penthouse dá kategorii **Pet of the Month**, pictorial modelky roku **Pet of the
  Year** s rokem (Hustler: Honey of the Month / Year). Názvy jsou z tabulky časopisů (snímek sbírky,
  `titulyJinde` u modelky).
- Hledání `kategorie:"pet of the month"` (v Go i v rozhraní), fasety galerie, Statistiky podle kategorie
  a výběr kategorií v úpravě modelky znají tituly jiných časopisů; řadí se hned za tituly Playboye.
- Modelka jen z Penthouse už není „Playmate měsíce“ (ani z pictorialu Pet of the Month, omezení z 0.02.011).
  `kategorieKZobrazeni` z 0.02.010 nahradily přímo odvozené kategorie.

## [0.02.011] – 2026-11-10

### Změněno
- **Typy alb podle časopisu:** okno alba nabízí u Penthouse „Pet of the Month“ a „Pet of the Year“, u Hustleru
  „Honey of the Month / Year“, u Playboye jako dřív „Playmate of the Month / Year“. Popisky se překreslí při změně
  „Časopis a edice“ i při předvyplnění čísla. Uložený typ alba zůstává stejný (role modelky měsíce / roku), takže
  export, hledání i starší data platí dál (`popisDruhuCasopisu` ve `format.js`).
- Popis alba v profilu a v náhledu okna: „Pictorial Pet of the Month“ u čísla Penthouse.

## [0.02.010] – 2026-11-10

### Změněno
- **Titul podle časopisu v profilu:** modelka s centerfoldem Penthouse má v kategoriích **Pet of the Month** místo
  „Playmate měsíce“ (Hustler: Honey of the Month); modelka z Playboye i Penthouse má obě. Páska čísla v pruhu
  profilu: „Pet · Zář 85 · PH“; „Playmate“ jen u čísla Playboye (`kategorieKZobrazeni` ve `format.js`).
- Bublina čísla (najetí na štítek čísla) a režim Jako časopis píšou titul časopisu čísla.
- Ručně zapsaná kategorie „Playmate měsíce“ zůstává. Hledání a filtry kategorií se upraví v 0.02.012.

## [0.02.009] – 2026-11-10

### Přidáno
- **Tituly modelky podle časopisu:** `titulCasopisu(klic, druh)` a `titulCisla(vydani, druh)` ve `format.js`
  vrátí titul měsíce, roku nebo krátký titul z tabulky časopisů – Playboy: Playmate měsíce / roku (Playmate),
  Penthouse: Pet of the Month / Year (Pet), Hustler: Honey of the Month / Year (Honey). Časopis bez titulu dostane
  „Modelka měsíce / roku“. Rozhraní je začne používat od 0.02.010 (`test/tituly.test.js`).

### Změněno
- ROADMAP: tituly (profil, typy alb, kategorie a filtry) předřazené z etapy 0.04 jako 0.02.010–0.02.012,
  správa časopisů se posunula na 0.02.013.

## [0.02.008] – 2026-11-10

### Přidáno
- **Export verze 14:** nový oddíl `casopisy` (klíč, název, barva, edice, tituly modelky měsíce a roku, pořadí)
  a čísla jiných časopisů s `@` u alb, coverů a vydání (`1985-09@PH`, `1986-03-UK@PH`). Import časopisy načte jako
  první (`export_casopisy.go`), aby prošla alba jejich čísel. Časopis podle klíče založí nebo upraví,
  edice jen přidává a chybný klíč, barvu či edici ohlásí.
- EXPORT.md: oddíl Časopis a řádek historie formátu; vzor-exportu.yaml s Penthouse.

### Změněno
- Starší export (verze 13 a nižší, i z Playboy Database) se načte jako dřív: čísla bez `@` jsou Playboy.
  Starší program soubor verze 14 odmítne celý („z novější verze programu“).

## [0.02.007] – 2026-11-10

### Změněno
- **Pohledy Playboye beze změny:** čísla jiných časopisů se neukážou na stěně Centerfoldů (ani ve volbě „vše“),
  v kapesním katalogu, v dokončených ročnících Roku ve sbírce ani ve Statistikách (desetiletí, první výskyt
  modelky). Kalendář, Obálky, Mapa čísel, sousední čísla a speciály je vynechávají už podle řady (`US`/`CZ`).
  Nové `jeCisloPlayboye` a `naSteneCenterfoldu` ve `format.js`; pohledy podle časopisu přijdou v 0.03.

### Testy
- `test/playboy-pohledy.test.js` (pohled po pohledu) a `TestDesetiletiJenPlayboy`.

## [0.02.006] – 2026-11-10

### Přidáno
- **Rychlé přidání modelky** (Ctrl+Shift+N) má volbu „Časopis a edice“ jako okno alba; pamatuje si ji
  a odhad národnosti počítá z modelek téhož časopisu („% modelek Penthouse“).
- **Stránka čísla a ročníku jiného časopisu** z profilu modelky: nadpis ročníku, drobeček „Ročník 1985 · Penthouse“
  a nabídka ročníku s názvem časopisu. Kalendář a Mapa čísel jiné časopisy zatím neukazují (0.03).

## [0.02.005] – 2026-11-10

### Přidáno
- **Volba „Časopis a edice“** v okně alba a coveru (dřív „Edice“): Playboy US, Playboy CZ, Penthouse US,
  Penthouse UK, Hustler US – podle tabulky časopisů (`app/rady.js`, `moznostiRad` ve `format.js`). Poprvé tak jde
  zadat číslo jiného časopisu, např. centerfold Penthouse 09/1985 (Pet of the Month). Speciály fungují i pro jiné
  časopisy. Nové album nebo cover nabídne naposledy uložený časopis a edici.

### Změněno
- Pictorial jde přiřadit k číslu jiného časopisu jen s časopisem a edicí z tabulky (`SetVydaniAlba`).
- Třetí sloupec řádku „měsíc · rok · edice“ je širší, aby se vešel název časopisu.

## [0.02.004] – 2026-11-10

### Přidáno
- **Názvy čísel jiných časopisů:** rozhraní si načítá tabulku časopisů spolu s názvy speciálů a číslo se jmenuje
  „Září 1985 · Penthouse“, „Březen 1986 · Penthouse UK“, ročník „1985 · Hustler“; páska čísla zkratkou
  „Zář 85 · PH“. Nové `nazevCasopisu` a `nazevRady` (`Penthouse UK`) ve `format.js`; skupina čísla v Údržbě
  má podtitulek s názvem časopisu. Čísla Playboye se jmenují přesně jako dřív (test).
- **Hledání** `rok:1985-09@PH` najde jen Penthouse 09/1985; `rok:1985-09` dál všechna čísla toho měsíce.

## [0.02.003] – 2026-11-10

### Přidáno
- **Tabulka časopisů** (úprava schématu databáze č. 17, `casopisy.go`): zkratka (klíč v čísle), název, barva,
  edice (země vydání, první výchozí), názvy „modelky měsíce“ a „modelky roku“ a pořadí. Předvyplněné jsou
  **Playboy** (PB; US, CZ; Playmate), **Penthouse** (PH; US, UK; Pet of the Month / of the Year) a **Hustler**
  (HU; US; Honey of the Month / of the Year). `GetCasopisy` pro rozhraní.

### Změněno
- Centerfold, cover a speciál jiného časopisu projdou jen s časopisem a edicí z tabulky (`znamaRada`; např.
  Hustler UK ne).

### Přechod
- Databáze se při prvním spuštění upraví (úprava č. 17, jen nová tabulka); předtím se sama uloží záloha
  „Před úpravou“. Starší verze programu novou databázi otevře jen pro čtení.

## [0.02.002] – 2026-11-10

### Přidáno
- **Klíč čísla s časopisem i v rozhraní** (`frontend/src/lib/format.js`): `rozlozitVydani` vrací navíc `zeme`
  a `casopis` a pole `edice` je řada (`PH/US`), `slozitVydani` z řady složí klíč zpátky (`1985-09@PH`),
  nové `radaVydani` a `rozlozitRadu`. Název čísla jiného časopisu zatím se zkratkou („Září 1985 · PH“, plné názvy
  přijdou v 0.02.004); čísla Playboye se jmenují stejně jako dřív.
- **Odkazy na číslo jiného časopisu** v textech: `[[09/1985@PH]]`, `[[09/1985 UK@PH]]`, `[[1985-09@PH]]` (rozhraní
  i „Zmiňováno v…“ v `zminky.go`).

## [0.02.001] – 2026-11-10

### Přidáno
- **Klíč čísla s časopisem** (první krok etapy U, zatím jen v jádru programu, v okně se nic nemění): číslo jiného
  časopisu než Playboy má na konci zkratku časopisu – `1985-09@PH` (Penthouse 09/1985), `1986-03-UK@PH`
  (Penthouse UK), `1985-S01@HU` (speciál Hustleru). Bez přípony je to Playboy, takže stávající data platí beze změny.
- Rozklad čísla (`hledani.RozdelitCasopis`, `RadaKlice`, `sbirka.CastiVydani`, `uceni.CastiVydani`,
  `EdicePodleVydani`) vrací u jiného časopisu **řadu** `PH/US`; pohledy podle edice Playboye (US, CZ) tak čísla
  jiných časopisů samy vynechají. Stránka ročníku `1985@PH` ukáže jen Penthouse, `1985` jen Playboy.
- Ukládání centerfoldů a coverů a zakládání speciálů přijme řadu jiného časopisu; `@PB` se nepíše a neprojde.

## [0.01.001] – 2026-11-10

### Změněno
- Verze se v programu a v changelogu píšou s pevnou šířkou **X.XX.XXX** (0.01.001, 0.02.000, 1.00.000): MINOR
  vždy dvěma, PATCH třemi číslicemi. V `verze.go`, `wails.json` a `package.json` zůstává zápis bez nul (0.1.1),
  protože jiný npm ani Wails nepřijmou; převod dělá `zobrazitVerzi`.

## [0.01.000] – 2026-11-10

### Změněno
- **Playboy Database je teď Pinup Katalog** a číslování verzí začíná znovu od 0.1.0. Modelky zůstávají v centru,
  v dalších verzích přibudou další časopisy (Penthouse, Hustler…) – plán je v ROADMAP.md, etapa U.
- Všechny funkce Playboy Database 1.53.0 zůstávají beze změny.

### Přechod
- Při prvním spuštění se data přesunou z `~/.local/share/playboy-app` do `~/.local/share/pinup-katalog` a mezipaměť
  z `~/.cache/playboy-app` do `~/.cache/pinup-katalog` – sbírka, zálohy, hodnocení i nastavení okna zůstanou.
  Když ještě běží stará verze, přesun počká na další spuštění.
- `./instalovat.sh` nainstaluje program jako `pinup-katalog` a starý program odebere z nabídky aplikací.
- Kontrola nové verze nepovažuje starou řadu 1.x za novější; export má v názvu a hlavičce Pinup Katalog.
