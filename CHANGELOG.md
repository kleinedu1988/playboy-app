# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze se řídí [sémantickým verzováním](https://semver.org/lang/cs/): do verze 1.0.0 zvyšuje MINOR každá změna,
která mění schéma databáze nebo formát exportu, PATCH jen opravy. Verze v repozitáři jsou označené značkami
`vX.Y.Z`. Plán dalších verzí je v [ROADMAP.md](ROADMAP.md).

## [0.31.0] – 2026-10-15

### Přidáno
- Rychlé výsledky pod hledáním: při psaní se pod polem ukážou modelky, články a čísla. Články se hledají
  i v textu (bez ohledu na diakritiku), u každého je úryvek s růžově zvýrazněnou shodou. Šipky vybírají,
  Enter otevře, Esc výsledky zavře. Článek se otevře v čísle rovnou na svém místě.
- Prohlížeč stran: skeny článku se otevřou na celé okno jako rozevřený časopis (dvojstrana se stínem
  u hřbetu, článek od liché strany začíná vpravo) nebo po jedné straně. Dole pás náhledů, listování
  šipkami nebo klikem na stranu, klávesy 1 a 2 přepínají rozložení (zapamatuje se).
- Články modelky: v profilu je poslední blok vlevo „Články“ (rozhovor, 20 otázek…) s rubrikou, číslem
  a stranou; klik otevře číslo na tomto článku.

## [0.30.3] – 2026-10-15

### Změněno
- Stránka čísla: články jdou pod sebou jedna za druhým podle stran (jako alba v galerii modelky), za nimi
  pictorialy. Tlačítka „předchozí / další“ a samostatný režim „Alba čísla“ jsou pryč, prostě se roluje.
- Obsah vlevo zvýrazňuje článek, který právě čteš, a ukazatel přečteného ho sleduje při rolování; levý panel
  se sám posune, aby zvýrazněná položka byla vidět. Klik na položku obsahu na článek doroluje.
- Každý článek má u rubriky vlastní „✎ upravit“.

### Opraveno
- Druhý odstavec článku už neobtéká velké úvodní písmeno perexu.

## [0.30.2] – 2026-10-15

### Změněno
- Stránka čísla: levá a pravá část se rolují nezávisle. Levý panel stojí na celou výšku okna a roluje si svůj
  obsah sám; kolečko u jeho konce už nepřejde na článek vpravo.
- Ukazatel přečteného: u čteného článku v obsahu se pod názvem plní tenká růžová čára podle toho, kolik
  článku už je odrolováno.
- V úzkém okně (pod 760 px), kde je levý panel nad obsahem, je nad článkem tenký proužek s obsahem čísla
  (čtený článek zvýrazněný) a ukazatelem přečteného; zůstává nahoře celou dobu čtení.

## [0.30.1] – 2026-10-15

### Změněno
- Centerfold čísla je v levém panelu pod údaji čísla (s modelkou a textem alba), vpravo zůstávají pictorialy.
  Klik na centerfold v obsahu na něj v panelu sjede, klik na plakát ho otevře v prohlížeči.

## [0.30.0] – 2026-10-15

Číslo časopisu jako magazín: obsah a články s textem. Schéma databáze: úprava č. 9 (tabulka článků). Formát
exportu: verze 7 (starší verze 1–6 se dál načtou).

### Přidáno
- **Obsah čísla** v levém panelu stránky čísla: články podle stran (číslo strany, rubrika drobnými růžovými
  kapitálkami, název), za nimi centerfold a pictorialy čísla. Levý panel při rolování zůstává na místě
  a obsah se v něm posouvá. Pod obsahem zkrácené údaje čísla (cover, centerfold, pictorialy, fotky, kdo je na
  obálce, stav).
- **Čtení článku** v pravé části: rubrika, strana a druh textu, velký nadpis, autor a modelka (odkaz na
  profil), první odstavec jako perex s růžovým iniciálem, citáty („> “) s růžovou čarou, zvýrazněné otázky
  („PLAYBOY:“), náhledy skenů stran (otevřou se v prohlížeči fotek) a odkazy na předchozí a další článek.
  „Alba čísla“ vrátí centerfold a pictorialy; při čtení je cover v panelu menší.
- Okno **Nový článek / Upravit článek** (styl okna Doplnit modelku): rubrika s nabídkou obvyklých (Úvodník,
  Playboy Interview, 20 otázek, Článek, Povídka, Móda, Humor, Advisor, Pictorial, Centerfold) i vlastních,
  autor, strana, název, modelka ze sbírky, druh textu (přepis, shrnutí), text a odkazy na skeny z Disku;
  mazání článku s potvrzením.
- Články v exportu a importu u vydání (klíč `clanky`); článek se v čísle pozná podle názvu, prázdný údaj
  ponechá stávající, „-“ ho smaže. Popis v EXPORT.md a vzor-exportu.yaml.

### Změněno
- Přidávání do čísla jako pilulka **+ Cover | + Centerfold | + Pictorial** pod názvem čísla.

## [0.19.2] – 2026-10-15

### Změněno
- Přehled, **Souhrn**: místo karet jeden panel s pokrokem sbírky po položkách (Modelky s titulní fotkou,
  s centerfoldem, s hodnocením, Alba s textem a s vydáním, Vydání s coverem a s centerfoldem): pruh, „19 z 22“
  a pilulka „doplnit 3“ (hotové „hotovo“). Klik na řádek otevře část, kde se doplňuje.
- Přehled, **Ke kontrole**: místo tabulky seznam s kulatou fotkou, jménem, popisem problému a tlačítkem
  **Opravit** (album s jednou fotkou otevře profil, ostatní formulář modelky); klik na řádek otevře profil.

## [0.19.1] – 2026-10-15

### Změněno
- Okno **Doplnit modelku**: bez fotky v hlavičce. Titulní fotka se místo odkazu vybírá kliknutím z fotek modelky
  v galerii (vybraná má růžový rámeček); modelka bez fotek nabídne „Přidat fotky / album…“.
- **Upravit modelku** má stejné rozložení a vzhled jako okno Doplnit modelku: růžový rámeček, části (Základní
  údaje, Vzhled a míry, Zařazení a poznámky) pod sebou s růžovými nadpisy místo záložek, bez křížku – zavírá se
  tlačítkem Zrušit. Odkaz z Přehledu posune formulář rovnou na příslušnou část.

## [0.19.0] – 2026-10-15

Nový vzhled celého programu (řada 0.18.x) završený oknem pro doplňování modelek. Schéma databáze ani formát
exportu se nemění.

### Přidáno
- Okno **Doplnit modelku**: v Přehledu (část Modelky) klik na kartu modelky otevře plovoucí okno s růžovým
  rámečkem. V hlavičce fotka, jméno a pruh vyplněnosti; pod ní jen to, co modelce chybí: odkaz na titulní fotku,
  chybějící pole základních údajů, vzhledu a zařazení (stejná pole a nabídky jako ve formuláři modelky),
  hodnocení srdíčky, vydání alb bez vydání, tlačítka pro přidání centerfoldu a pro text alb. U každého bloku
  „netýká se“. Dole **Zrušit**, **Otevřít profil**, **Uložit a další →** (uloží a otevře další modelku v pořadí
  Přehledu) a **Uložit**. Klik na konkrétní údaj na kartě otevírá formulář jako dřív.

### Změněno
- Dialogová okna v jednotném stylu: plovoucí panel se zaoblenými rohy, nadpis tenkými kapitálkami, tlačítka jako
  pilulky (hlavní akce plná růžová, ostatní s tenkým okrajem), pole se zaoblenými rohy.
- **Co je nového** a nápověda: nadpisy verzí a kapitol tenkými kapitálkami s růžovou linkou, podnadpisy
  (Přidáno, Změněno) drobnými růžovými kapitálkami, „Zavřít“ jako pilulka.
- Fotka na kartičce modelky v Přehledu má zaoblené rohy i vpravo.

## [0.18.14] – 2026-10-15

### Změněno
- Přehled, část **Modelky**: místo tabulky kartičky ve dvou sloupcích. Fotka vyplní celou levou stranu karty
  (jako karty v galerii), jméno je tenkými kapitálkami, pod ním pruh vyplněnosti s procenty a výčet toho, co
  chybí („Základní údaje 3 z 4“, „Centerfold ✕“). Klik na údaj ho nabídne doplnit, pravým tlačítkem jde označit
  „netýká se“, klik jinam na kartu otevře profil.
- Svítící tečky u chybějících údajů jsou pryč, v tabulce Vydání je „chybí“ zase jen růžovým textem.

## [0.18.13] – 2026-10-15

### Změněno
- Přehled má nové rozložení jako profil modelky: vlevo plovoucí panel **Sbírka** s čísly (modelky, alba, fotky,
  se srdíčky, covery, vydání), menu částí **Souhrn, Modelky, Vydání, Ročníky, Ke kontrole** s počty (kde něco
  chybí, růžově) a pruhy „Modelky s úplnými údaji“ a „Vydání s coverem i centerfoldem“. Vpravo je vždy jen
  zvolená část; poslední zvolená se pamatuje.
- Nová část **Souhrn** s kartami toho, co zbývá doplnit (bez titulní fotky, bez centerfoldu, bez hodnocení,
  alba bez textu a vydání, vydání bez coveru a centerfoldu, ke kontrole); klik na kartu otevře příslušnou část.
  Připravené místo pro grafy.
- Nadpisy částí tenkými kapitálkami s růžovou linkou, tabulky v plovoucích panelech, u chybějícího údaje
  zářící růžová tečka; jména modelek v tabulce na jeden řádek.

## [0.18.12] – 2026-10-15

### Změněno
- Lišta alb (v profilu) a jmen (v Nejlepších) je plovoucí pilulka; zvolená položka má tenký růžový rámeček
  s podbarvením. Horní hrana lišty lícuje s levým panelem a při rolování pod ní neprosvítá obsah.
- Nadpisy alb jsou tenkými kapitálkami s růžovou linkou, která se ztrácí (jako nadpisy v levém panelu).
- Fotky v albech mají zaoblené rohy a jemný stín, mezi alby je víc místa.

## [0.18.11] – 2026-10-15

### Změněno
- Levý panel profilu modelky, stránky čísla a fotografa je jeden plovoucí panel se stínem. Fotka (titulní,
  centerfold nebo cover) vyplní horní část až k okrajům a dole končí zaoblenými rohy. V levém horním rohu je
  růžová páska s prvním číslem („PLAYMATE · BŘE 95“, u čísla „LED 96“). Jméno je tenkými kapitálkami na střed,
  srdíčka pod ním. Tlačítka (Upravit, Přidat fotky, Upravit číslo) jsou v jedné pilulce s dělicí čarou.
  Údaje už nejsou v rámečku, nadpisy bloků jsou růžové s linkou, která se ztrácí.

## [0.18.10] – 2026-10-15

### Změněno
- Zvolená záložka (Modelky, Čísla, Centerfoldy) má místo krátké čárky růžovou linku přes celé slovo, která se
  na koncích ztrácí a jemně září. Na profilu a stránce čísla je linka tlumená, bez záře.

## [0.18.9] – 2026-10-15

### Změněno
- Otevření nabídky volby už panel ani volbu nezvýrazňuje (jako před 0.18.8). Růžový rámeček s podbarvením
  zůstává jen u zapnutého filtru.

## [0.18.8] – 2026-10-15

### Změněno
- Panel voleb pod hledáním reaguje jako hledání: dokud je otevřená nabídka některé volby, má celý panel tenký
  růžový rámeček. Zapnutý filtr i právě vybíraná volba mají tenký růžový rámeček a růžové podbarvení.

## [0.18.7] – 2026-10-15

### Změněno
- Pole hledání má vzhled panelu voleb pod ním: zaoblená pilulka s okrajem a stínem, růžová lupa.

### Přidáno
- **Ctrl+F** skočí do hledání a označí jeho text (mimo otevřené okno, prohlížeč fotek a zamčený program).
  Vpravo v poli je nápověda „Ctrl F“; při psaní ji nahradí tlačítko **✕**, které hledání smaže.

## [0.18.6] – 2026-10-15

### Změněno
- Nové rozložení hlavní lišty: vlevo záložky **Modelky, Čísla, Centerfoldy**; uprostřed přesně pod hledáním
  panel voleb přehledu (řazení, filtry); vpravo ikonová tlačítka **Kalendář, Nejlepší, Přehled** (zvolené
  podbarvené akcentem, název v nápovědě), za čárou **+** a **⋯**.
- Počet položek („22 modelek“, „78 fotek“) už v liště není, ukáže ho nápověda zvolené záložky nebo ikony.

## [0.18.5] – 2026-10-15

### Změněno
- Záložka **Covery** je nahrazená záložkou **Čísla**: galerie všech čísel časopisu, ke kterým je ve sbírce
  cover, centerfold nebo pictorial, po ročnících s počtem „11 z 12“. Každé číslo vypadá jako výtisk se stínem
  a růžovou páskou měsíce („BŘE 95“, u speciálu „SPECIÁL 95“), pod ním jméno playmate. Číslo bez coveru ukazuje
  ztlumený náhled se štítkem „bez coveru“; štítky „výtisk“ a „sháním“ podle označení čísla. Chybějící číslo
  označené „sháním“ nebo „mám výtisk“ je přerušovaná dlaždice „Ve sbírce chybí“.
- V horní liště volby **Edice** (sdílená s kalendářem) a **Zobrazit** (vše, s coverem, bez coveru, chybějící).
  Klik na číslo otevře jeho stránku; pravé tlačítko nabízí cover (zobrazit, upravit, smazat, nebo přidat)
  a označení čísla (mám výtisk, sháním, nezajímá mě).

Beze změny schématu databáze a formátu exportu.

## [0.18.4] – 2026-10-15

### Změněno
- Volby přehledu v horní liště (Řazení, Srdíčka, Výběr, Edice, Spustit slideshow) jsou v jednom zaobleném
  plovoucím panelu s dělicími čarami. Hodnota je tučně, šipka ▾ v barvě akcentu; zapnutý filtr srdíček je
  podbarvený a jeho hodnota v akcentu; „Spustit slideshow“ je v akcentu jako akce. Počet zůstává vedle panelu.
- Tlačítka **✎ Upravit** a **+ Přidat fotky** pod jménem modelky mají vzhled samostatných voleb (tmavá karta
  s tenkým okrajem) místo plovoucího panelu z 0.18.3.

## [0.18.3] – 2026-10-15

### Změněno
- Tlačítka pod jménem modelky mají nový vzhled plovoucího panelu (jako lišta prohlížeče fotek): jeden zaoblený
  panel, tlačítka **✎ Upravit** a **+ Přidat fotky** oddělená tenkou čarou, ikony v barvě akcentu. Styl je
  připravený jako společný (`.plovouci-skupina`, `.plovouci-tlacitko`) a postupně do něj přejdou další prvky.

## [0.18.2] – 2026-10-14

### Změněno
- Tlačítka **Upravit modelku** a **+ Přidat fotky / album** jsou v profilu pod jménem modelky v levém panelu,
  u údajů, které upravují. Nadpis „Alba a fotogalerie“ nad alby je pryč, lišta alb začíná hned nahoře.

### Opraveno
- V úzkém okně (pod 760 px) profil modelky přetékal vpravo za okraj okna kvůli široké liště alb.

## [0.18.1] – 2026-10-14

### Změněno
- Údaje v levém panelu profilu modelky jsou v jedné kartě rozdělené do bloků **Playboy** (vydání, role a obálky
  jako štítky), **Osobní** (narození s věkem v prvním vydání, úmrtí, národnost) a **Vzhled** (mřížka ve dvou
  sloupcích). Tetování a piercing se ukážou jen jako štítek, když je odpověď „ano“; prázdné bloky se skryjí.

## [0.18.0] – 2026-10-14

Poslední úprava schématu před alfou podle rozhodnutí z auditu. Schéma databáze: úprava č. 8. Formát exportu:
verze 6 (starší verze 1–5 se dál načtou).

### Přidáno
- Datum úmrtí u modelky: ve formuláři vedle data narození, v profilu i s věkem, v exportu jako `umrti_datum`.
- U čísla časopisu jde do „Na obálce“ napsat i jméno, které ve sbírce není; uloží se jako text (v exportu
  `na_obalce`). Jméno modelky ze sbírky se dál propojí s jejím profilem.
- Import: hodnota `-` údaj smaže (text, čísla, ano/ne, titulní fotku, text a fotografa alba, údaje čísla).
- Import: překlep v klíči (`narodnot:`) se opraví na nejbližší známý klíč, neznámý klíč se přeskočí; obojí
  se po importu vypíše s číslem řádku.

### Změněno
- Data narození a úmrtí smí být neúplná: `RRRR`, `RRRR-MM` nebo `RRRR-MM-DD`. Formulář má místo kalendáře
  textové pole a jiný tvar (nebo úmrtí před narozením) nepustí; v profilu se neúplné datum ukáže jako
  „srpen 1950“ nebo „1950“. Import datum v jiném tvaru ohlásí a stávající ponechá.
- Soubor s jedinou modelkou a chybným údajem (např. text místo čísla) import odmítne s hláškou, co je špatně.

## [0.17.16] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Pole hledání je v horním řádku okna přesně uprostřed šířky okna; v užším okně se zúží, v nejužším zmizí.
  Hlavní lišta pod ním má celé místo pro záložky, volby a akce.

## [0.17.15] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není tlačítko „← Modelky“; zpět vede Esc nebo Alt+šipka vlevo, do jiného přehledu
  záložky. Šipky na předchozí a další modelku v profilu zůstávají.

## [0.17.14] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není ani ikona programu; zůstávají jen tlačítka okna (a v profilu cesta zpět).

### Opraveno
- Zamčený program (s heslem) od verze 0.17.0 ukazoval v hlavičce záložky přehledů, volby, + a ⋯. Před
  odemčením jsou zase vidět jen tlačítka okna.

## [0.17.13] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- V horním řádku okna už není název programu, zůstala jen ikona (a v profilu cesta zpět).

## [0.17.12] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Prohlížeč fotek: ovládání (panel nástrojů, lišta alb, šipky, popisek, zavření) je vidět po otevření
  a po pohybu myší a asi po 2,5 s nečinnosti zmizí; nad ovládáním zůstává, dokud tam je myš. Listování
  klávesami ho neukazuje.
- Fotka v prohlížeči sahá od horního po spodní okraj okna (nebo od kraje ke kraji); ovládání leží přes ni.

## [0.17.11] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Opraveno
- Galerie modelek se nemusela vykreslit: pruh se jménem na každé kartě rozmazával pozadí a se stovkami
  karet najednou to WebKitGTK nezvládl. Pruh má teď obyčejné poloprůhledné pozadí.

## [0.17.10] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Na kartě modelky je jméno vidět pořád (průhledný pruh přes spodek fotky). Srdíčka jsou vidět pořád
  u hodnocené modelky, u nehodnocené jen po najetí myší. Centerfoldy a covery mají popisek dál jen po najetí.

## [0.17.9] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Opraveno
- Při přibližování výřezu titulní fotky kolečkem myši mohl panel výřezu zmizet pod přiblíženou fotkou.
  Panel teď leží nad fotkou v samostatné vrstvě; kolečko přibližuje i nad panelem a stránka se přitom
  neposouvá.

## [0.17.8] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Srdíčka na kartě modelky se ukážou jen po najetí myší (nebo při výběru klávesnicí), i u hodnocené modelky;
  bez myši je na kartě jen fotka.

## [0.17.7] – 2026-10-14

Schéma databáze ani formát exportu se nemění.

### Změněno
- Jméno na kartě modelky, centerfoldu a coveru je zase pruh přes celou šířku dole, teď ale průhledný přes
  fotku a jen po najetí myší.
- Ovládání výřezu titulní fotky má dva řádky: nahoře posuvník přiblížení přes celou šířku, pod ním tlačítka.

## [0.17.6] – 2026-10-14

Fotky přes celé karty. Schéma databáze ani formát exportu se nemění.

### Změněno
- Karty modelek, centerfoldů a coverů ukazují jen fotku přes celou kartu. Jméno (u centerfoldu a coveru
  i vydání) je v plovoucím panelu vlevo dole a objeví se po najetí myší nebo při výběru klávesnicí.
- Srdíčka na kartě modelky jsou v levém horním rohu.

## [0.17.5] – 2026-10-14

Plovoucí panely na fotkách a v dialozích. Schéma databáze ani formát exportu se nemění.

### Změněno
- Úprava výřezu titulní fotky má ovládání v plovoucím panelu přímo na fotce karty (posuvník přiblížení,
  výchozí výřez, zrušit, uložit); jméno modelky pod fotkou zůstává vidět.
- Srdíčka a tlačítko ⋯ na dlaždici fotky a na kartě modelky jsou malé plovoucí panely v rozích fotky,
  čitelné i na světlé fotce.
- Dialogová okna mají stejný povrch, okraj a stín jako plovoucí panely; pozadí za nimi je méně tmavé
  a křížek se po najetí myší podbarví. Rozložení oken se nemění.

## [0.17.4] – 2026-10-14

Plovoucí panely i mimo prohlížeč. Schéma databáze ani formát exportu se nemění.

### Změněno
- Lišta pro vybrané fotky je plovoucí panel s ikonami (přesunout do alba, přidat do výběru, vybrat vše,
  odebrat, zrušit výběr); srdíčka jsou obrys a po najetí myší se vyplní až po to pod kurzorem.
- Nabídky (⋯, pravé tlačítko, volby v liště) a oznámení mají stejný povrch jako panely v prohlížeči;
  položka nabídky se po najetí jen jemně podbarví, mazání zůstává červené.

## [0.17.3] – 2026-10-14

Prohlížeč fotek s plovoucími panely. Schéma databáze ani formát exportu se nemění.

### Změněno
- Nástroje prohlížeče jsou v plovoucím panelu nahoře uprostřed (srdíčka, rozložení, otočení, lupa,
  zamíchání, slideshow, ⋯) s ikonami a oddělenými skupinami; popisek a počítadlo jsou nenápadně vlevo
  nahoře, Zavřít vpravo.
- Lišta alb dole je plovoucí panel uprostřed, jen tak široký, jak je potřeba.
- Šipky na předchozí a další fotku jsou nenápadné, po najetí myší mají kulaté podbarvení. Průběh slideshow
  je tenká čára nahoře.

## [0.17.2] – 2026-10-14

Čistší vzhled štítků. Schéma databáze ani formát exportu se nemění.

### Změněno
- Štítky v celém programu (alba v profilu, jména v Nejlepších, stránka vydání, lišta alb v prohlížeči, vydání
  v údajích modelky) mají vzhled rejstříku: bez rámečků, tlumený text, jemné podbarvení po najetí myší;
  zvolený má růžové podbarvení a tučný text. Lišty alb nemají dělicí čáru, šipky jsou bez kroužků.
  Rozložení se nemění.

## [0.17.1] – 2026-10-14

Volby přehledu v horní liště. Schéma databáze ani formát exportu se nemění.

### Změněno
- Řazení, Srdíčka, Výběr a Edice jsou rozbalovací tlačítka přímo v horní liště za záložkami, i s počtem
  (22 modelek); nad obsahem už žádný samostatný řádek není. V Nejlepších je v liště i Spustit slideshow
  a přejmenování a smazání výběru je v nabídce Výběr. V užším okně ubude počet a popisky voleb.

## [0.17.0] – 2026-10-14

Nová navigace ve stylu Fotek ve Windows. Schéma databáze ani formát exportu se nemění.

### Změněno
- Hlavička okna má dva řádky: nahoře název programu, cesta zpět z profilu nebo vydání a tlačítka okna; pod ním
  hlavní lišta se záložkami přehledů (podtržená je zvolená), hledáním s lupou uprostřed a akcemi + a ⋯.
- Záložky přehledů zůstávají vidět i v profilu modelky a na stránce vydání, jinam se jde jedním klikem.
- Volby přehledu jsou rozbalovací tlačítka nad obsahem: Řazení ▾, Srdíčka ▾, Výběr ▾, Edice ▾ místo řad štítků.
- Rejstřík (písmena, roky, měsíce) se ukáže u pravého okraje jen při rolování nebo po najetí myší k okraji;
  jinak obsah zabírá celou šířku okna.

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
