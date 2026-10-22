# Changelog

Všechny podstatné změny programu. Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/),
verze se řídí [sémantickým verzováním](https://semver.org/lang/cs/): do verze 1.0.0 zvyšuje MINOR každá změna,
která mění schéma databáze nebo formát exportu, PATCH ostatní změny. Milníky (0.9.0, alfa 0.50.0, beta,
1.0.0) jsou v repozitáři označené značkami `vX.Y.Z`. Plán dalších verzí je v [ROADMAP.md](ROADMAP.md).

Verze 0.20–0.29 nebyly vydány: po 0.19.2 následovala rovnou 0.30.0 se změnou schématu i exportu.

## [0.92.2] – 2026-10-22

### Vylepšeno
- **Statistiky jako skládaný výběr:** klik (nebo Enter) na sloupec či řádek grafu přidá podmínku výběru, další kliky ho zužují – třeba Celebrita, 70. léta a černé vlasy. V jednom grafu platí jedna hodnota; klik na jinou ji vymění, na tutéž ji zruší. Všechny grafy i čísla nahoře se přepočítají: tlumeně celá sbírka, jasně výběr (každý v měřítku svého největšího sloupce, aby byl tvar vidět i u malého výběru), u řádků „výběr / celkem“ a v číslech „z 2 000“ nebo „celkem 21“.
- **Lišta výběru** ukazuje podmínky jako štítky (křížek podmínku odebere), počet modelek, „Zrušit výběr“ a „Zobrazit modelky“ s jejich titulními fotkami; klik na fotku otevře profil a „Otevřít v galerii“ převede výběr na hledání, když ho jde hledáním vyjádřit (kategorie, národnost, vlasy, oči, hodnocení, fotograf). Esc zavře fotky, další Esc zruší výběr.
- **Grafy ve skupinách** Zařazení, Vzhled a původ a Sbírka, po třech v řadě (stránka je kratší); grafy bez údajů se nezobrazují a písmo v grafech je všude stejně velké. Fotografové se nově počítají v modelkách, aby šli kombinovat s ostatními podmínkami; místo čísla „Přibylo“ je nahoře průměrné hodnocení.

## [0.92.1] – 2026-10-22

### Vylepšeno
- **Přepracované Statistiky:** nahoře pět čísel (modelky, centerfoldy, věk, národnosti, přibylo za 30 dní) a nové grafy: kategorie, centerfoldy podle desetiletí rozdělené na edice US a CZ, barva vlasů a očí, hodnocení modelek a přibývání sbírky po měsících; zůstávají věk v době centerfoldu, národnosti, fotografové a vývoj v čase.
- **Klik na sloupec ukáže modelky:** klik (nebo Enter) na sloupec či řádek grafu rozbalí pod řadou grafů titulní fotky modelek, které do něj patří, s údajem k věci (např. měsíc centerfoldu nebo věk). Klik na modelku otevře profil, „Zobrazit v galerii“ je ukáže jako hledání (u kategorií, národností, barvy vlasů a očí, hodnocení a fotografů), Esc výběr zavře. Stejně funguje číslo „Přibylo“.

## [0.92.0] – 2026-10-22

### Změněno
- **Přehled bez levého panelu:** části Přehled, Údržba, Sháním CZ a Statistiky jsou v liště nahoře přes celou šířku (jako dřív jen v úzkém okně), takže obsah pod ní má celou šířku okna.

## [0.91.0] – 2026-10-22

### Přidáno
- **Kategorie modelek** podle rozdělení na Playboy.com: Playmate měsíce, Playmate roku (s rokem), Cyber Girl a Coed (týdne, měsíce, roku), Muse, Celebrita, Modelka obálky, Jen ve speciálu a Creator. Modelka může mít kategorií víc; volí se štítky v „Upravit modelku…“ (i v okně Doplnit) a jinou hodnotu jde dopsat jako vlastní kategorii.
- **Playmate měsíce a Modelku obálky program pozná sám** z centerfoldu a obálky ve sbírce, ručně se zadávat nemusí.
- Kategorie jsou v profilu, ve filtru galerie (Filtry → Kategorie, s počty), v našeptávači a v hledání `kategorie:` (např. `kategorie:"playmate roku"`, `-kategorie:celebrita`); Údržba hlásí chybějící kategorii jen tam, kde není zapsaná ani odvozená.

### Změněno
- Pole „Role“ se jmenuje „Kategorie“. Dosavadní hodnoty zůstávají: známé názvy (i anglické, např. Cybergirl of the Month 2005) se sjednotí, ostatní zůstanou jako vlastní kategorie. Databáze ani formát exportu se nemění.

### Opraveno
- Nápověda k hledání: přebytečná tečka v příkladu „obalka:1995“.

## [0.90.4] – 2026-10-21

### Opraveno
- **Testy na čistém klonu:** zkušební databáze starších verzí (`testdata/stare-verze/*/playboy.db`) nebyly v repozitáři, protože je vynechávalo pravidlo `*.db` v `.gitignore`; test přechodu ze starších verzí proto na čistém klonu selhal. Databáze jsou teď v repozitáři. Program se nemění.

## [0.90.3] – 2026-10-21

### Dokumentace
- **Číslování po 1.0.0:** téma z plánu zvyšuje druhé číslo (1.1, 1.2 … 1.10), každý hotový krok a oprava v tématu poslední číslo (1.3.0, 1.3.1, 1.3.2…), stejně jako v alfě. Program se nemění.

## [0.90.2] – 2026-10-21

### Dokumentace
- **Plán po 1.0.0 v menších krocích:** verze 1.1–1.4 rozdělené na osm menších verzí (1.1–1.8, každá 2–4 kroky a zhruba 1–3 dny práce) s přehledovou tabulkou a závislostmi; „mám PDF“ a hodnocení kolečkem myši v rezervě. Program se nemění.

## [0.90.1] – 2026-10-21

### Dokumentace
- **Plán po betě v `ROADMAP.md`:** pravidlo pro vydání 1.0.0 (14 dní používání bety bez nové chyby), způsob vydávání po 1.0.0 a podrobně rozpracované verze 1.1 (Google Disk v aplikaci), 1.2 (každodenní práce), 1.3 (velká sbírka, náhledy na disku) a 1.4 (editor textů). Program se nemění.

## [0.90.0] – 2026-10-21 – beta

První beta. Od této verze do 1.0.0 se opravují jen chyby: funkce, texty, schéma databáze (úprava č. 11)
a formát exportu (verze 7) jsou zmrazené. Opravy vycházejí jako 0.90.1, 0.90.2… Instalace na čistém účtu
Fedory, přenos dat, obnovení ze zálohy a práce bez připojení jsou ověřené podle testovacího scénáře
v `ROADMAP.md`.

### Co přinesla alfa (0.50–0.51)
- **Rychlost:** databáze v režimu WAL (ukládání zhruba 40× rychlejší), rychlejší Přehled, kalendář a statistiky, obrázky se při rychlém rolování načítají postupně; Nejlepší na sbírce s 2 000 modelkami 14,6 s → 0,4 s.
- **Edice:** americká měsíční řada 12/1953–03/2020, česká od 07/2011, nevydané číslo 03/1955; měsíce mimo řadu se v kalendáři, ročníku ani mapách nepočítají jako chybějící.
- **Ovládání:** jednotné kontextové nabídky, ovládání klávesnicí (mapy edic, Vývoj v čase, srdíčka 0–5), návrat na původní místo po Zpět, úprava pro úzké okno.
- **Spolehlivost:** bezpečné obnovení ze zálohy, ověřený přechod z databází a exportů deseti starších verzí, odolnost bez připojení („Nenačteno“, hlášky o výpadku a návratu připojení).
- **Zabezpečení a údržba:** revize zabezpečení, Content-Security-Policy, aktualizované závislosti, úklid kódu a stylů.
- **Texty a instalace:** kontrola všech textů, srozumitelné chybové hlášky, postup instalace na čistou Fedoru, nová ikona programu, známá omezení v README.

## [0.51.22] – 2026-10-20

### Přidáno
- **Známá omezení v README:** fotky jen z Disku a s připojením, heslo nešifruje databázi, ověřeno na Fedoře, jeden počítač.
- **Testovací scénář bety** v `ROADMAP.md`: kontrolní seznam pro instalaci na čistém účtu, přenos dat, obnovení ze zálohy a práci bez připojení.

## [0.51.21] – 2026-10-20

### Změněno
- **Nová ikona programu:** Pin-up dívka v kostkované košili a s šátkem ve vlasech v retro rámečku. Po `./instalovat.sh` se ukáže v nabídce aplikací i v okně (někdy až po odhlášení a přihlášení). Instalace teď ukládá ikonu ve velikostech 256 a 512 px a odstraní SVG ikonu, kterou instalovala předchozí verze.

## [0.51.20] – 2026-10-20

### Vylepšeno
- **Ikona i v okně:** Ikonu programu má i běžící okno (přepínání Alt+Tab, panel) a okno se spolehlivě spáruje s položkou v nabídce aplikací. V nabídce je ikona ostrá v každé velikosti a program jde najít i hledáním slov „katalog“, „sbírka“ nebo „časopis“.
- **Srozumitelné chybové hlášky:** Když se něco nepovede, hláška místo interního názvu funkce říká, co se dělo, třeba „Chyba (přesun fotek): …“.
- **Pojistka zabezpečení:** Okno programu spustí jen vlastní skripty programu (Content-Security-Policy).

### Opraveno
- Ročník a stránka Čísla počítají do „X z Y“ jen čísla, která v měsíční řadě edice mohla vyjít, stejně jako kalendář (dřív třeba „11 z 3“ u roku 2020).
- Souhrn v Údržbě: čtyřmístná čísla („2000 z 2000“) se nezalamují a pruhy začínají pod sebou.
- Přehled prázdné sbírky neukazuje „100 % s úplnými údaji“ u nula modelek.
- Drobnosti: „Přidat modelku…“ s trojtečkou jako ostatní položky, které otevírají okno; v okně Adresa obrázků je mezera mezi vysvětlením a polem.

## [0.51.19] – 2026-10-20

### Změněno
- **Nová ikona programu:** Místo výchozí ikony Wails má program vlastní ikonu ve svých barvách – obálku časopisu s růžovým záhlavím a srdíčkem na tmavém podkladu. Po `./instalovat.sh` se ukáže v nabídce aplikací (někdy až po odhlášení a přihlášení).

## [0.51.18] – 2026-10-20

### Vylepšeno
- **Instalace na čistou Fedoru:** README má postup od prázdného systému (balíčky, Wails, stažení programu). Když chybí Wails, Go, npm nebo knihovny WebKitGTK, `instalovat.sh` vypíše, co přesně doinstalovat, místo nejasné chyby.

### Opraveno
- Sestavení už nemění soubory v repozitáři (vygenerované vazby na backend), takže další `git pull` neskončí hláškou o místních změnách.
- Po spuštění se kolem seznamu modelek a stěny centerfoldů neukazuje modrý rámeček fokusu.

## [0.51.17] – 2026-10-20

### Opraveno
- **Texty:** Opravené překlepy a skloňování („sháněná čísla“, „alba“, počet modelek ve Vývoji v čase, hlášky importu a Přehledu) a uvozovky.
- **Zastaralé popisy:** Nápověda a hlášky odpovídají současnému chování: co import maže (jen údaj s hodnotou „-“), tvar vydání s příponou edice, stav výtisku jen u české edice, zálohy před každou hromadnou změnou, nabídka ⋯ u fotky, tlačítko „Uložit a další“ a nápověda k hledání.

### Změněno
- **Jednotné názvy:** „Otevřít číslo“ místo „Otevřít vydání“, „Přidat fotky nebo album…“, „Desetiletí“ v našeptávači, „Sháním CZ“ v Přehledu. Položky nabídek, které otevírají okno, končí trojtečkou. Texty oslovují jednotně tykáním.

## [0.51.16] – 2026-10-20

### Vylepšeno
- **„Co je nového“ po větší aktualizaci:** Když od naposledy viděné verze přibylo víc verzí, jsou celé vidět jen tři nejnovější a starší změny jsou ve sbaleném oddílu „Starší změny – N verzí“, který jde rozbalit.

## [0.51.15] – 2026-10-20

### Změněno
- Úklid před betou: odstraněno 61 nepoužívaných pravidel stylů (staré karty Údržby, dřívější tabulky statistik a Přehledu), nepoužívané funkce a soubor `build/README.md` ze šablony Wails. Vzhled se nemění (snímky všech pohledů před a po úklidu jsou stejné).

## [0.51.14] – 2026-10-20

### Změněno
- **Aktualizované knihovny:** opravné verze knihoven Go pro síť, systém, text a šifrování (golang.org/x/net, sys, text, crypto) a několika dalších. Sestavení používá Go 1.26.10 s opravami bezpečnosti standardní knihovny (na Fedoře s balíčkovým Go stačí `sudo dnf upgrade golang`). Kontrola typů běží na TypeScriptu 5.9. Rozhraní za běhu žádnou knihovnu z npm nepoužívá a `npm audit` nenašel nic. Wails zůstává na ověřené verzi 2.16.0.

## [0.51.13] – 2026-10-20

### Vylepšeno
- **Bez připojení k internetu:** Fotka, která se nenačetla, ukazuje zástupný obrázek „Nenačteno“ místo „Bez fotky“ (ten zůstává pro modelku, která titulní fotku nemá). Výpadek připojení program ohlásí a po jeho návratu se nenačtené fotky načtou samy, bez obnovování stránky.

## [0.51.12] – 2026-10-20

### Opraveno (revize zabezpečení)
- Revize zabezpečení nenašla žádnou zranitelnost: zkouška s útočným textem ve všech údajích (jména, texty alb, články, odkazy, názvy výběrů…) v žádném okně nic nespustila, z odkazů modelky se otevírají jen adresy https, heslo je uložené jen jako otisk (PBKDF2 se solí) a dotazy do databáze dostávají hodnoty jako parametry.
- Drobnosti z revize: nápověda prázdného políčka v kalendáři je ošetřená stejně jako ostatní a výřez titulní fotky s neplatnou hodnotou z ručně psaného importu („.nan“) se nastaví na výchozí.

## [0.51.11] – 2026-10-20

### Opraveno
- Záloha, která se nedokončila (například na plném disku), už nezůstane ve složce záloh jako nedokončený soubor, který by se v seznamu tvářil jako záloha.

## [0.51.10] – 2026-10-20

### Vylepšeno (úzké okno a klávesnice)
- **Přehled v úzkém okně** (do 900 px): levý panel Sbírka je řádek částí nad obsahem, ne sloupec s prázdným místem pod sebou.
- **Mapy edic klávesnicí:** Do každé mapy vede jeden Tab, šipky se pohybují po měsících (←→) a rocích (↑↓) a přeskakují měsíce, které nevyšly; Home a End skočí na první a poslední číslo, Enter číslo otevře, klávesa nabídky (Shift+F10) nabídne jeho stav.
- **Vývoj v čase klávesnicí:** Řádky tabulky jdou zaměřit Tabem, Enter ukáže graf a fokus zůstane na řádku.
- **Fokus při přechodech:** Po otevření profilu nebo čísla klávesnicí jde další Tab rovnou do něj; Zpět vrátí fokus na kartu nebo dlaždici, ze které se odešlo.
- **Srdíčka klávesami:** Zaměřené kartě modelky nebo dlaždici fotky dají klávesy 1–5 srdíčka, 0 je zruší. Srdíčka na kartách a dlaždicích už Tab neprochází (každá karta měla pět zastávek navíc), stejně jako svislý rejstřík písmen a roků u okraje.

## [0.51.9] – 2026-10-20

### Vylepšeno (zátěžová zkouška: 2 000 modelek, 64 000 fotek)
- **Nejlepší s desítkami tisíc fotek:** Mozaika se vykresluje po úrovních srdíček a po dávkách 300 fotek; další dávka se přidá sama, když se konec úrovně blíží k oknu. Skok na úroveň v liště ukáže její začátek hned. Při rolování nahoru se konec předchozí úrovně sám nedoplňuje (obsah by poskočil), je tam tlačítko „Zobrazit další fotky (N)“. S 28 000 fotkami se Nejlepší dřív vykreslovaly 14,6 s a okno na 13,5 s zamrzlo; teď 0,4 s. Ctrl+A vybere vykreslené fotky.
- **Karty Modelek a plakáty na stěně Centerfoldů** se mimo okno nevykreslují: 2 000 karet se ukáže za 0,3 s místo 1 s, stěna za 0,4 s místo 0,9 s a obojí plynuleji roluje. Vzhled a efekty při najetí myší zůstávají stejné.
- Přehled s velkou sbírkou se otevře za 0,4 s (dřív 2,6 s, zdržovaly ho prvky Nejlepších, které zůstávaly ve stránce).

## [0.51.8] – 2026-10-20

### Změněno
- **Měsíční řady edic:** Program zná, kdy která edice vycházela jako měsíčník. Americká od 12/1953 (první číslo s Marilyn Monroe) do 03/2020 (Spring 2020, poslední pravidelné číslo); čísla od roku 2025 (ročenka, čtvrtletník) se evidují jako speciály. Česká od 07/2011. Měsíce mimo řadu se v kalendáři a na stránce ročníku ukazují jako „nevyšlo“ a nepočítají se jako chybějící; počet „x z N“ u roku odpovídá skutečnému počtu čísel (1953: 1, 2020: 3).
- **Mapa americké edice** v Přehledu ukazuje celou měsíční řadu 1953–2020, ne jen roky, ze kterých máš čísla, a „Čísla US“ počítají z čísel, která opravdu vyšla.

## [0.51.7] – 2026-10-20

### Opraveno
- **Březen 1955 (US) nevyšel:** Americké číslo z března 1955 se už neukazuje jako chybějící. V kalendáři a na stránce ročníku je místo něj tlumené políčko „nevyšlo“, na které nejde kliknout, v mapě americké edice prázdné místo, které se nepočítá mezi chybějící čísla. Ročník 1955 má 11 čísel („x z 11“ v kalendáři, na stránce Čísla i ročníku).

## [0.51.6] – 2026-10-20

### Opraveno
- **Mapa české edice začíná prvním číslem 07/2011** místo roku 1991. Měsíce roku 2011 před prvním číslem jsou v mapě prázdné, nedají se otevřít ani označit a nepočítají se mezi chybějící čísla; „Výtisky CZ“ tak počítají jen čísla, která opravdu vyšla. Pokud by sbírka obsahovala české číslo z dřívější doby, mapa začne od něj.

## [0.51.5] – 2026-10-20

### Opraveno (revize změn od verze 0.33.17 – rozhraní)
- **Titulní fotka ze sdíleného alba:** „Nastavit jako titulní fotku“ v profilu další modelky sdíleného alba (i v prohlížeči otevřeném z profilu) nastavovala titulní fotku hlavní modelce alba. Teď ji dostane modelka, jejíž profil je otevřený.
- **Ročník:** Pravé tlačítko na měsíci na stránce ročníku ukazovalo nabídku celého ročníku a „Upravit číslo…“ otevřelo úpravu roku. Teď je to nabídka toho čísla; „Upravit číslo…“ se na stránce ročníku a fotografa nenabízí.
- **Nabídka čísla** se neotevře, když mezitím přejdeš jinam (dřív mohla po načtení dat vyskočit nad jiným přehledem); na stránce Čísla se už kvůli ní znovu nenačítá kalendář. U americké edice jde zrušit dříve nastavený stav „mám výtisk“ nebo „sháním“.
- **Volné místo v profilu** už nenabízí „Upravit výřez titulní fotky“ – upravovala se neviditelná karta v galerii (výřez zůstává na kartě modelky).
- **Údržba:**
  - Pravé tlačítko na „Doplňovat postupně“ nabízelo „netýká se“ pro první modelku fronty.
  - „Netýká se“ u čísla, které máš („mám výtisk“) nebo sháníš, by ten stav přepsalo na „nezajímá mě“; teď se stav nemění a program to oznámí.
  - Počet u filtru „Vše“ nepočítá modelky, kterým zbývají jen úkoly „netýká se“.
  - Po kliknutí na filtr zůstane na filtru fokus klávesnice.
  - Odkazy z úvodu do Údržby začínají zase od prvních 60 řádků.
- **Vývoj v čase:** Při rychlém přepnutí US/CZ se už nevykreslí starší odpověď pod nadpisem jiné edice.
- Fotka, která se nenačetla, se při rolování znovu nestahuje.

## [0.51.4] – 2026-10-20

### Opraveno (revize změn od verze 0.33.17 – databáze)
- **Obnovení ze zálohy v režimu jen pro čtení:** Když program běžel jen pro čtení (poškozená databáze) a po pádu zůstal vedle databáze deník změn, obnovení ze zálohy se pokaždé odmítlo a navíc databázi otevřelo znovu pro zápis. Teď se deník přenese zvláštním spojením a záloha se obnoví; když obnovení selže, databáze se vrátí do původního režimu včetně „jen pro čtení“.
- **Obnovení během importu** se odmítne, místo aby smazalo deník, do kterého import právě zapisuje.
- **Bez režimu WAL** (souborový systém, který ho neumí) se databáze otevře s plně bezpečným zápisem na disk.

## [0.51.3] – 2026-10-20

### Opraveno
- **Postupné načítání i v Nejlepších a v profilu:** Mozaika Nejlepších a fotky v albech profilu modelky se načítají stejně jako karty Modelek, stěna centerfoldů a Čísla: fotky se začnou stahovat asi dvě obrazovky dopředu a ty, které odrolují dřív, než se načetly, se zruší. Mozaika Nejlepších si poměr stran fotky zjistí, až se fotka opravdu načte.

## [0.51.2] – 2026-10-20

### Opraveno
- **Prázdné plakáty a obálky při rychlém rolování Centerfoldů a Čísel:** Stěna centerfoldů a stránka Čísla používají stejné postupné načítání jako karty Modelek (0.51.1): fotky se začnou stahovat asi dvě obrazovky dopředu a ty, které odrolují dřív, než se načetly, se zruší. V měření se simulovaně pomalou sítí se stěna centerfoldů po rychlém rolování zaplnila za 0,7 s místo 2,5 s.

## [0.51.1] – 2026-10-19

### Opraveno
- **Prázdné karty při rychlém rolování Modelek:** Fotky na kartách se teď načítají vlastním postupným načítáním: začínají asi dvě obrazovky před zobrazenou částí, a když karta odroluje dřív, než se fotka načetla, její stahování se zruší. Fotky na obrazovce tak nečekají ve frontě za desítkami fotek, které už jsou pryč. V měření se simulovaně pomalou sítí se karty po rychlém rolování zaplnily za 0,7 s místo 3,6 s a stáhlo se čtvrtinové množství fotek.

## [0.51.0] – 2026-10-19

### Vylepšeno
- **Rychlejší ukládání:** Databáze běží v režimu WAL – změny se připisují do deníku vedle databáze (`playboy.db-wal`) a na disk se srovnají najednou. Uložení srdíčka nebo údaje už nečeká na zápis na disk (v měření zhruba 40× rychleji) a čtení se zápisem se navzájem neblokují, ani když běží kontrola souborů na pozadí. Při prvním spuštění se databáze do režimu přepne sama; uložená data přežijí i pád programu.
- **Rychlejší Přehled, kalendář a statistiky:** Kalendář, Přehled a seznam vydání modelek se počítají po albech místo po jednotlivých fotkách (desetkrát méně řádků) a seznam tagů pro našeptávání čte jen tagy. Na sbírce o 500 modelkách a 20 000 fotkách: kalendář 51 → 9 ms, Přehled 133 → 60 ms, statistiky 48 → 11 ms, tagy 44 → 0,1 ms, načtení modelek 48 → 26 ms. Výsledky jsou stejné jako dřív.

### Opraveno
- Obnovení ze zálohy nejdřív uzavře databázi a přenese deník změn, aby se do obnovené databáze nic ze staré nepřimíchalo.

## [0.50.1] – 2026-10-19

### Přidáno
- Licence: zdrojový kód je pod licencí MIT (soubor `LICENSE`, oddíl Licence v README). Ochranná známka Playboy ani fotky a obsah sbírky pod licenci nespadají.

## [0.50.0] – 2026-10-18 – alfa

První alfa. Program je použitelný na skutečné sbírce; od této verze do 1.0.0 přibývají jen opravy
a doladění rozhraní. Schéma databáze (úprava č. 11) a formát exportu (verze 7) jsou zmrazené: databáze
ani exportované soubory se už do vydané verze nezmění. Chyby z alfy se opravují ve verzích 0.50.1, 0.50.2…

### Co alfa obsahuje
- **Modelky, alba a fotky:** profil s údaji a centerfoldy, sdílená alba, spojené plakáty, prohlížeč fotek se
  slideshow, lupou a srdíčky, výběr více fotek, vlastní výběry, odebrání s možností vrátit.
- **Čísla časopisu:** edice US a CZ, speciály, kalendář, stránka čísla s obsahem podle stran, články a skeny
  stran, ročníky a fotografové; výtisky české edice (mám výtisk, sháním).
- **Přehled:** mapy edic, Údržba jako fronta úkolů, Sháním CZ, Statistiky a vývoj modelek v čase.
- **Hledání:** rychlé výsledky, cílené hledání, rozsahy, vylučování, překlepy a fulltext v textech.
- **Data:** export a import YAML a Markdownu, denní zálohy a obnovení, zámek heslem, instalace do nabídky
  aplikací.

### Změněno
- Test hlídá zmrazení schématu databáze a formátu exportu.
- README, ROADMAP, PLAN a popis exportu odpovídají alfě: co program umí, číslování alfa 0.50.x, beta 0.90.x
  a 1.0.0, plán po vydání.

## [0.34.7] – 2026-10-18

### Změněno
- Kontextové nabídky mají jedna pravidla: otevřít → upravit → přidat → uspořádat → smazat (vždy poslední). Z nabídek obsahu zmizely Zpět, Obnovit a Zkontrolovat soubory (zůstávají v hlavním ⋯) i položky, které jsou tlačítkem hned vedle.
- Fotka v albu nabízí jen akce fotky. Akce alba jsou pod ⋯ v hlavičce alba, pravým tlačítkem mimo fotky nebo položkou „Album …“ v nabídce fotky. Z nabídky alba zmizely Otevřít vydání a Upravit modelku.
- Číslo časopisu má všude stejnou nabídku (kalendář, Čísla, mapa v Přehledu, ročník, prázdné políčko). Nahoře je název čísla, přidat se nabízí jen to, co číslu chybí, a Upravit číslo… je všude. Současný stav čísla má ✓ a druhý klik ho zruší; „Zrušit označení“ zmizelo.
- Nový speciál a pictorial k ročníku jsou v nabídce na nadpisu roku v kalendáři.
- Karta modelky nabízí i Otevřít profil a Sloučit s jinou modelkou…
- Volné místo v profilu nabízí slideshow modelky, výřez titulní fotky, sloučení a smazání. Volné místo na stránce čísla nabízí slideshow a Upravit číslo…
- Nastavit jako titulní fotku jde z každé fotky modelky (i v prohlížeči, v Nejlepších a na stěně centerfoldů).
- Oddíl „Údržba“ v hlavním ⋯ se jmenuje „Soubory a mezipaměť“, aby se nepletl s Údržbou v Přehledu.

## [0.34.6] – 2026-10-18

### Změněno
- Údržba je jedna fronta úkolů místo záložek Souhrn, Modelky, Čísla a Ke kontrole. Modelky, čísla i údaje ke kontrole jsou v jednom seznamu, seřazené podle toho, kolik toho chybí. Nahoře je stručný souhrn pokroku a filtry s počty (Titulní fotka, Centerfold, Hodnocení, Údaje, Texty alb, Vydání alb, Cover čísla, Centerfold čísla, Kontrola).
- Na řádku jsou štítky toho, co chybí. Klik na štítek otevře právě ten údaj, „Doplnit“ otevře první z nich. „Doplňovat postupně“ prochází modelky s „Uložit a další“.
- Pod ⋯ na řádku je „netýká se“ pro každý úkol, okno „Doplnit modelku“ se vším, co jí chybí, a profil.
- Řádky „Co zbývá doplnit“ na úvodu otevřou Údržbu rovnou s filtrem na danou položku.

## [0.34.5] – 2026-10-18

### Vylepšeno
- **Vývoj v čase – BMI a poměr pas : boky:** Dva odvozené řádky (s popiskem „odvozeno“): BMI z výšky a váhy a poměr pasu a boků (na dvě desetinná místa); počítají se jen u modelek, které mají oba údaje.
- **Vývoj v čase – úplnost dat:** Nový sloupec **Úplnost** u každého údaje: pruh a procento modelek s centerfoldem v edici, které údaj mají. Odkaz **doplnit N →** otevře formulář první modelky, které údaj chybí, rovnou v daném poli, a tlačítkem **Uložit a další** projde všechny ostatní.

## [0.34.4] – 2026-10-18

### Přidáno
- **Vývoj v čase ve Statistikách:** Tabulka údajů po desetiletích podle roku centerfoldu modelky – medián věku v době centerfoldu, výšky, váhy, hrudníku, pasu a boků a podíl blond vlasů, oholeného ochlupení, silikonových prsou, tetování a piercingu. Pod každou hodnotou je počet modelek se známým údajem; období s méně než pěti modelkami je tlumené. Sytost buňky ukazuje, kde je hodnota v řádku nejvyšší. Klik na řádek ukáže pod tabulkou graf: u číselných údajů čáru mediánu po pětiletích s pásmem prostřední poloviny modelek, u podílů sloupce po desetiletích rozdělené na sto procent; po najetí myší bublina s hodnotou. Přepínač US/CZ vybere edici (výchozí US). Barva vlasů z volného textu se řadí do skupin Blond, Hnědé, Černé, Zrzavé a Jiné.

## [0.34.3] – 2026-10-18

### Vylepšeno
- **Úvod Přehledu:** Pod mapami edic je celý seznam **Co zbývá doplnit** s pruhy a tlačítky „doplnit“ (místo karty se třemi úkoly), dva grafy – **Výtisky CZ po letech** a **Centerfoldy podle desetiletí** (s bublinou po najetí myší) – a naposledy přidané modelky v jednom řádku.

## [0.34.2] – 2026-10-18

### Vylepšeno
- **Nový Přehled:** Levý panel má čtyři části místo šesti: **Přehled**, **Údržba**, **Sháním CZ** a **Statistiky**.
  - **Přehled (úvod):** hlavní čísla (modelky, alba, čísla US, výtisky CZ), mapa **české edice** jako sbírky výtisků od roku 1991 (mám výtisk, sháním, nezajímá mě, chybí) a mapa **americké edice** jako archivu dat (kompletní číslo má cover, centerfold i pictorial, částečné jen něco z toho). Políčko je jedno číslo: klik ho otevře, prázdné nabídne přidání, pravým tlačítkem se nastaví stav. Dole tři nejdůležitější úkoly k doplnění a naposledy přidané modelky.
  - **Údržba:** dosavadní Souhrn, Modelky, Vydání a Ke kontrole pod jednou položkou se záložkami nahoře.
  - **Sháním CZ:** shánená čísla české edice po letech s poznámkou; klik nabídne „Mám výtisk“ nebo „Už nesháním“, **Kopírovat seznam** dá seznam do schránky jako text.
  - Část Ročníky je nahrazená mapami.
- **Výtisky jen u české edice:** „Mám výtisk“ a „Sháním“ se nabízejí jen u čísel české edice (v kalendáři, na stránce čísla, v okně Upravit číslo); americká edice nabízí jen „Nezajímá mě“. Už nastavený stav u amerického čísla zůstává.

## [0.34.1] – 2026-10-17

### Změněno
- **Nadpisy zpět v písmu aplikace:** Patkové písmo Bodoni Moda z verze 0.34.0 je odstraněné; jména modelek, názvy čísel, alba a roky mají opět původní střídmý vzhled. Vložené soubory písma jsou z aplikace odebrané.

## [0.34.0] – 2026-10-17

### Vylepšeno
- **Patkové písmo nadpisů jako v časopise:** Jména modelek (na kartách, na stěně centerfoldů, v profilu), názvy čísel a fotografů, nadpisy alb, názvy článků, roky v Číslech, Kalendáři a na stěně a velké nadpisy oken jsou v kontrastním písmu Bodoni Moda; roky kurzívou. Drobné popisky, tlačítka a běžný text zůstávají v písmu aplikace. Písmo je vložené přímo do aplikace (licence SIL Open Font License), takže funguje bez internetu, a má plnou češtinu.

## [0.33.18] – 2026-10-17

### Opraveno
- **Poblikávání okna při načítání karet a kontextové nabídky:** Ve WebKitGTK prvek s animací průhlednosti dostane na dobu animace vlastní vrstvu a po jejím skončení se vrací do stránky; na některých grafikách přitom obsah na okamžik zmizí. Fotky na kartách se proto znovu ukazují hned (bez plynulého objevení z verze 0.33.14), obrysy při načítání a prázdné stavy jsou bez úvodní animace a nabídky, panel Filtry, výsledky hledání a přehled zkratek zůstávají ve vlastní vrstvě trvale, takže se po animaci otevření už nepřepínají.

## [0.33.17] – 2026-10-17

### Opraveno (revize změn od verze 0.32.3)
- **Stejné hledání ve všech přehledech:** Centerfoldy, Nejlepší, Čísla, Kalendář i rychlé výsledky teď rozumí cíleným slovům stejně jako hledání modelek: `rok:1970-1979`, `rok:>=1990`, `hodnoceni:>=4`, `fotograf:`, `jmeno:`, vylučování `-1975`. Dřív stěna centerfoldů cílené pole ignorovala (`-tag:x` vyřadilo vše s písmenem x) a Kalendář syntaxi neznal vůbec. Údaj, který přehled nemá (vlasy u centerfoldů), hledání neomezuje.
- **Překlepy jen tam, kde dávají smysl:** Tolerance překlepů se už neuplatní u čísel (`1975` nenajde 1976) ani u vylučovaných slov (`-anna` nevyloučí Anju); u cíleného jména (`-jmeno:Pamella`) zůstává.
- **Rychlé výsledky:** vylučovaná slova platí i tam (`anna -novakova`), Esc zavře výsledky i tehdy, když hledání ještě nedoběhlo, hodnota s mezerou se vloží v uvozovkách (`role:"playmate měsíce"`) a u nabídek hodnot už není dvakrát počet („1 1 modelka“).
- **Hledání modelek:** `tetovani:no` a `piercing:no` už nenajdou všechny, `rok:197` najde celá sedmdesátá léta, obrácený rozsah `rok:1979-1970` funguje a rozepsaná čárka (`jmeno:anna,`) nevymaže výsledky.
- **Hledání v textech:** Úprava schématu č. 11 přestaví fulltextový index: hromadná úprava tisíců alb trvala sekundy (každá změna procházela celý index), teď zlomek sekundy. Slovo „clanek“ už nenajde všechny články, slova s pomlčkou (`jean-luc`) se najdou, alba bez popisu se indexují stejně ve starých i nových databázích, článek se najde i podle jména připojené modelky a vylučované slovo (`monte -anderson`) článek vyřadí.
- **Zrušit filtry** ruší filtry jen v přehledu, kde se začalo; rychlé přepnutí na jiný přehled už nesmaže jeho filtry. Panel Filtry jde ovládat klávesnicí (fokus na zvolené volbě, Tab zůstává v panelu). Hláška u filtru srdíček spolu s dalším filtrem je „Nic nenalezeno“ a v Nejlepších se při zvoleném výběru neukazuje nesmyslné „Srdíčka: vše“.
- **Přehled zkratek** opravdu zastaví klávesy pod sebou (Enter neklikne na tlačítko za panelem, šipky nelistují čtečkou, Esc nezavře zároveň panel Filtry), Tab zůstává v panelu a po zavření se fokus vrátí.
- Rejstřík u pravého okraje v nejužším okně nepřekrývá řádek voleb; skleněné panely mají rozmazání i ve starších verzích WebKitGTK; plynulé objevování fotek nezávisí na podpoře vlastnosti `loading`.

## [0.33.16] – 2026-10-17

### Opraveno
- **Hlavička v úzkém okně:** Lišta voleb pod hledáním se pod šířkou zhruba 750 px překrývala s ikonami vpravo. Teď se postupně zhušťuje: pod 860 px zmizí počet položek (zůstává v popisku záložky), pod 760 px slovo Filtry (zůstane ikona s odznakem) a pod 620 px jde lišta voleb na vlastní řádek pod záložky, kde se počet zase ukáže. V nejužším okně (pod 400 px) se ikony vpravo přiblíží, aby se vešly vedle záložek.

## [0.33.15] – 2026-10-17

### Vylepšeno
- **Přehled klávesových zkratek:** Klávesa `?` kdekoli otevře skleněný panel se všemi zkratkami po částech (Kdekoli, Výsledky hledání, Profil modelky, Výběr fotek, Prohlížeč fotek, Čtečka stran). Funguje i v prohlížeči fotek a ve čtečce stran; jejich část je pak první a zvýrazněná. Zavře se klávesou `?`, `Esc` nebo klikem vedle; tlačítko **Celá nápověda** otevře podrobnou nápovědu. V nabídce ⋯ přibyla položka **Klávesové zkratky (?)**, nápověda zůstává pod položkou Nápověda.

## [0.33.14] – 2026-10-17

### Vylepšeno
- **Načítání bez prázdné plochy:** Při prvním otevření Modelek, Centerfoldů, Čísel, Kalendáře a Nejlepších jsou místo prázdné plochy šedé obrysy karet s jemnou vlnou; v profilu jiné modelky se místo alb předchozí modelky do načtení ukážou obrysy alb.
- **Fotky se plynule objeví:** Náhledy na kartách a dlaždicích se po načtení plynule zviditelní místo postupného vykreslování po řádcích; už jednou načtená fotka (například po změně filtru) se ukáže hned. Při zapnutém omezení pohybu v systému se vlna i přechod vynechají.

## [0.33.13] – 2026-10-17

### Vylepšeno
- **Prázdné stavy ve všech přehledech** mají stejný vzhled jako profil bez alb: vějíř skleněných karet s ikonou podle situace, tenký nadpis, krátké vysvětlení a tlačítko, kde dává smysl.
  - **Nic nenalezeno** (Modelky, Centerfoldy, Čísla, Kalendář, Nejlepší): lupa a tlačítko **Zrušit hledání a filtry**, které smaže hledaný text a vypne všechny zapnuté filtry.
  - **Modelky podle srdíček** (žádná s ♥ N+, vše ohodnoceno): srdce a stejné tlačítko pro zrušení filtrů.
  - **Prázdná sbírka nebo edice** (Centerfoldy, Čísla, Kalendář): tlačítko **+ Přidat…** otevře nabídku přidání; u modelek tlačítko **+ Přidat modelku**.
  - **Nejlepší:** prázdný výběr (hvězda) a žádné fotky s daným počtem srdíček (srdce).
  - **Stránka čísla** bez alb a **fotograf** bez alb.

## [0.33.12] – 2026-10-17

### Vylepšeno
- **Profil modelky bez alb** místo holé věty ukazuje vějíř tří skleněných karet (přední s růžovým nádechem a ikonou fotky), tenký nadpis „Zatím žádná alba“ (nebo „Žádná další alba“, když má modelka jen centerfoldy), krátké vysvětlení a růžové tlačítko **+ Přidat fotky**, které otevře okno přidání alba. Prázdný stav je připravený i pro další stránky (`ui/prazdno.js`).

## [0.33.11] – 2026-10-17

### Vylepšeno
- Posuvníky v celém programu jsou tenký průsvitný proužek bez dráhy a šipek; po najetí myší zesílí a zesvětlí, při tažení zrůžoví. Boční panel čísla a pás náhledů ve čtečce stran už neukazují systémový šedý posuvník.

## [0.33.10] – 2026-10-17

### Vylepšeno
- Růžový rámeček mají i okna **Přidat cover / Upravit cover**, **Číslo časopisu** a **Nová modelka**, stejně jako ostatní okna, která něco mění (album, modelka, Doplnit modelku, článek).

## [0.33.9] – 2026-10-17

### Vylepšeno
- Nabídky, panel Filtry a výsledky hledání se otevírají krátkým zjemněním a zvětšením z 98 % místo okamžitého naskočení. Při zapnutém omezení pohybu v systému se animace vynechá.

## [0.33.8] – 2026-10-17

### Vylepšeno
- Skleněný vzhled i u zbývajících plovoucích prvků: oznámení dole (s možností Vrátit), bublina u grafů ve Statistikách a panel úpravy výřezu na dlaždici mají stejné průsvitné rozmazané pozadí jako nabídky, panel Filtry a výsledky hledání.

### Opraveno
- Velmi krátký pruh v žebříčku Statistik (fotograf nebo národnost s malým počtem) se vykreslil s chybou; teď je z něj zaoblený konec.

## [0.33.7] – 2026-10-17

### Vylepšeno
- Rychlé výsledky pod hledáním mají průsvitné skleněné pozadí jako nabídky a panel Filtry; stránka pod nimi dál ztmavne.

## [0.33.6] – 2026-10-17

### Opraveno
- Panel **Filtry** se otevírá uprostřed pod lištou voleb (pod hledáním), ne pod tlačítkem Filtry.

## [0.33.5] – 2026-10-17

### Vylepšeno
- **Přehlednější lišta voleb pod hledáním:** Místo řady tlačítek „Srdíčka: vše ▾ · Edice: vše ▾ · Role: vše ▾“ je v liště jen řazení (ikona ⇅ a hodnota), tlačítko **Filtry** s odznakem počtu zapnutých filtrů a zapnuté filtry jako malé štítky s ×. Filtry otevřou průsvitný panel se všemi filtry jako řádky pilulek, počtem nalezených položek a volbou **Zrušit filtry**; panel zůstává otevřený, dokud se nezavře klikem mimo nebo Esc. Lišta má stejnou šířku bez ohledu na počet filtrů, na užším okně se štítky skryjí a zůstane odznak.
- Povinné volby (edice u Čísel a Kalendáře, srdíčka v Nejlepších) zůstávají rozbalovacími tlačítky. **Výběr** v Nejlepších ukazuje bez zvoleného výběru jen „Výběr ▾“ místo „Výběr: —“ a slideshow spouští ikona ▶.

## [0.33.4] – 2026-10-17

### Vylepšeno
- **Rozšířené řazení a filtrování u Modelek a Centerfoldů:**
  - **Modelky:** V nabídce `Řazení` přibyly samostatné volby `Podle srdíček` a `Podle fotek` (včetně odpovídající levé lišty částí) a filtr `Srdíčka` při řazení `A–Z` již nečekaně neruší abecední pořadí. V nabídce `Srdíčka` přibyl filtr `Bez ♥` (nehodnocené modelky) a v liště voleb přibyly rychlé filtry `Edice` (`vše` | `US` | `CZ`) a `Role` (dynamicky podle rolí ve sbírce s počty modelek).
  - **Centerfoldy:** V nabídce `Řazení` přibyly volby `Od nejstarších`, `Od nejnovějších` (obě se seskupením po dekádách a časovou lištou) a `Podle srdíček`. V liště voleb přibyly filtry `Srdíčka` (`vše`, `♥ 1+` až `♥ 5`, `Bez ♥`) a `Edice` (`vše` | `US` | `CZ`).

## [0.33.3] – 2026-10-17

### Vylepšeno
- **Sjednocené zvýraznění aktivních filtrů (`.zapnuto`) a rychlé zrušení (`×`):**
  - Třídu `.zapnuto` (růžový rámeček a podbarvení) nyní dostávají všechny aktivní filtry v liště pod vyhledáváním, které nejsou ve výchozím stavu „vše“ — kromě `minHodnoceni` nově také `zobrazitCisla` (při volbě `s coverem`, `bez coveru` nebo `chybějící`) a vlastní `vyberId` v přehledu Nejlepší.
  - V nabídce `Výběr` v přehledu Nejlepší přibyla položka `Vše podle srdíček` pro přímý návrat z vlastního výběru.
  - Každý aktivní filtr v liště má přímo uvnitř tlačítka křížek `×` (`.volba-zrusit`), kterým (stejně jako `Shift+klikem` nebo prostředním tlačítkem myši) lze filtr okamžitě zrušit bez nutnosti otevírat rozbalovací nabídku.

## [0.33.2] – 2026-10-17

### Vylepšeno
- **Zobrazení počtu nalezených položek přímo v liště pod vyhledáváním (`#volbyPrehledu`):**
  - Na konci kapsle voleb pod vyhledáváním se nyní zobrazuje okamžité počítadlo položek (`.volby-pocet`, např. `48 modelek`, `38 čísel`, `24 centerfoldů`, `19 fotek`).
  - Doplněno předávání počtu zobrazených záznamů i pro stěnu centerfoldů (`nacistStenu`) a kalendář vydání (`nacistKalendar`), takže zpětná vazba při psaní do vyhledávání a přepínání filtrů funguje jednotně napříč všemi přehledy.

## [0.33.1] – 2026-10-17

### Vylepšeno
- **Tolerance mezery za dvojtečkou ve vyhledávání:**
  - Parser vyhledávání na backendu i frontendu (`rozlozitDotaz`) nyní toleruje mezeru za dvojtečkou u cílených filtrů — jak u prostých hodnot (`vlasy: blond`, `-vlasy: cerna`), tak u hodnot v uvozovkách (`fotograf: "arny freytag"`), relačních operátorů (`vyska: > 175`, `rok: >= 1990`) i vícenásobných hodnot oddělených čárkou (`vlasy: blond, zrzava`).
  - Samostatně rozepsaný klíč s dvojtečkou na konci dotazu (`vlasy:` nebo `vlasy: `) se při psaní ignoruje a nemaže výsledky galerie.
  - Našeptávač hodnot filtrů plynule nabízí možnosti i v případě, že uživatel za dvojtečkou napíše mezeru (`vlasy: `), a po výběru celý filtr sjednotí do tvaru `vlasy:blond `.

## [0.33.0] – 2026-10-17

### Přidáno
- **Našeptávání příkazů a tagů v hledání (Autocomplete syntaxe):**
  - Při napsání počátečních písmen (např. `v`, `t`, `r`) našeptávač automaticky nabídne relevantní příkazy (`vlasy:`, `vydani:`, `vyska:`, `vaha:`, `tag:`, `rok:`...).
  - Při psaní konkrétního filtru s dvojtečkou (např. `vlasy:`, `tag:`, `edice:`, `role:`, `narodnost:`, `oci:`, `tetovani:`) našeptávač dynamicky nabídne existující hodnoty z databáze s počty modelek (např. `vlasy:blond`, `vlasy:hnědá`, `tag:playmate`).
  - Vybrání položky kliknutím nebo klávesou Enter okamžitě doplní příkaz či hodnotu s mezerou do vyhledávacího pole.
- **Fuzzy matching (tolerance drobných překlepů):**
  - Implementace Levenshteinovy vzdálenosti (1–2 překlepy podle délky slova) pro jména modelek a fotografů.
  - Hledání toleruje překlepy jako `Pamella` místo Pamela nebo `Freitag` / `Fraetag` místo Freytag, a to jak v cílených filtrech (`jmeno:`, `fotograf:`), tak v obecném textovém hledání a našeptávači.
- **SQLite FTS5 fulltext pro články a texty alb:**
  - Vytvořena virtuální tabulka `texty_fts` (úprava schématu č. 10) využívající SQLite FTS5 s automatickým odstraněním diakritiky (`unicode61 remove_diacritics 2`) a relevančním skórováním BM25.
  - Automatická synchronizace článků i popisů alb přes databázové triggery při vložení, úpravě i smazání záznamů.
  - Nová backendová metoda `HledatTexty` pro bleskové full-textové prohledávání článků i alb s BM25 relevancí.

## [0.32.10] – 2026-10-17

### Přidáno
- Rozšíření syntaxe vyhledávání modelek, centerfoldů a vydání:
  - **Negace (vylučovací operátor `-` a `!`):** možnost vyloučit záznamy pomocí `-tag:playmate`, `-vlasy:cerna` nebo obecného textového vyloučení např. `-usa`.
  - **Numerická porovnání a rozsahy:** podpora relačních operátorů (`>`, `>=`, `<`, `<=`, `=`) a rozsahů (`..`, `-`) pro rok, výšku, váhu, datum narození a hodnocení/srdíčka (např. `rok:1970..1979`, `rok:1970-1979`, `rok:>=1980`, `vyska:>175`, `vyska:>=175`, `hodnoceni:>=4`, `srdicka:5`).
  - **Vícenásobné hodnoty (logické OR přes čárku):** možnost zadat více alternativ oddělených čárkou (např. `vlasy:blond,zrzava` pro nalezení blond NEBO zrzavých modelek, `edice:CZ,US`).
  - **Tolerance neuzavřených uvozovek:** rozepsaný dotaz s neuzavřenou uvozovkou (např. `fotograf:"arny`) automaticky doplní uzavření a nehledá doslovnou uvozovku v textu ani nemaže dosavadní výsledky při psaní.

## [0.32.9] – 2026-10-17

### Přidáno
- Rozšíření cíleného i obecného vyhledávání modelek v backendu:
  - nová pole pro cílené hledání: `vyska:`, `vaha:`, `miry:`, `hodnoceni:` / `srdicka:`, `tetovani:ano|ne`, `piercing:ano|ne`, `obalka:`, `umrti:`.
  - výška, váha, tetování, piercing, obálky a datum úmrtí se nyní prohledávají i v obecném textovém vyhledávání bez prefixu.
  - centerfoldy na stěně plakátů načítají fotografa a popis alba pro vyhledávání.

### Změněno
- Sjednocení logiky vyhledávání napříč všemi pohledy:
  - na stěně centerfoldů i stěně coverů a čísel se dotaz rozděluje na jednotlivá slova (logika AND) a prohledává modelky, vydání, fotografy i popisy.
  - v kalendáři vydání lze nyní vyhledávat nejen podle roku, ale i podle jména modelky, měsíce či speciálu daného roku.
  - v nejlepších fotkách funguje víceslovné vyhledávání i podle fotografa a vydání.
- Vylepšení rychlého našeptávače:
  - modelky se prohledávají nejen podle jména a pseudonymů, ale i podle role, národnosti, barvy vlasů, tagů a poznámky (se zachováním přednosti shody ve jméně).
  - pokud rychlý našeptávač nenajde žádné položky pro přímý skok, nezobrazuje velký blokující overlay překrývající stránku, ale tiše se zavře, aby uživatel viděl výsledky v galerii.
  - stisk Enter v poli hledání bez vybrané položky našeptávače pole opustí a zavře našeptávač pro okamžité procházení vyfiltrovaných karet.

## [0.32.8] – 2026-10-17

### Změněno
- Formulář alba (Přidat fotky / Upravit album) má růžový obvodový pruh se září, který jej vizuálně označuje jako měnící formulář (shodně s formulářem modelky).
- Svislé zarovnání polí ve formuláři: pole „Měsíc nebo speciál“ a „Rok vydání“ jsou v jedné rovině díky jednotnému spodnímu zarovnání popisků i při zalomení textu na dva řádky.
- Profil modelky: na titulní fotce se zobrazují štítky pro všechna čísla (rok i měsíc), ve kterých se modelka objevila (včetně edic a označení Playmate), s možností přímého prokliku do daného vydání.

## [0.32.7] – 2026-10-17

### Přidáno
- Do roadmapy přidána Etapa 15 (Pořádný editor a práce s textem):
  - plnohodnotný editor s nástrojovou lištou (tučné, kurzíva, nadpisy, odrážky, číslování, citace, kód)
  - živý náhled formátování (split-view nebo přepínač Úprava / Náhled)
  - klávesové zkratky (Ctrl+B, Ctrl+I, Ctrl+K, Tab pro odrážky)
  - šablony pro rozhovory a články (tlačítka mluvčích `PLAYBOY:` / `Jméno:`, perex)
  - zvětšení editoru na celé okno pro psaní a čtení dlouhých článků a povídek
  - sjednocení komponenty editoru pro články, alba i poznámky

## [0.32.6] – 2026-10-17

### Přidáno
- Podpora formátování textu pomocí Markdownu v popisech alb, textech článků a poznámkách modelky i čísla:
  - tučné písmo (`**text**`, `__text__`) a kurzíva (`*text*`, `_text_`), včetně kombinace (`***text***`)
  - odrážkové seznamy (`* položka`, `- položka`) a číslované seznamy (`1. položka`)
  - blokové citace (`> text`)
  - inline kód (`` `kód` ``) a přeškrtnutí (`~~text~~`)
  - nadpisy (`#`, `##`, `###`)
  - zachování perexu a zvýraznění mluvčího (`PLAYBOY:`) u článků

## [0.32.5] – 2026-10-17

### Změněno
- Stěna centerfoldů: karty mají jednotný rozměr v poměru 3:4 (jako galerie modelek).
  Plakát je celý vycentrovaný uvnitř rámu bez ořezu – formát na výšku vyplní výšku rámu,
  široký centerfold na šířku je vycentrovaný na tmavém podkladu pasparty.

## [0.32.4] – 2026-10-17

### Změněno
- Profil modelky: titulní fotka (a její výřez) zůstává vždy nahoře a centerfold ji už nenahrazuje.
  Centerfoldy se řadí dolů do levého panelu pod údaje modelky (s odkazem na vydání a textem alba),
  stejně jako je tomu na stránce čísla časopisu.

## [0.32.3] – 2026-10-15

### Změněno
- Stránka fotografa: alba a centerfoldy jako mřížka karet (jako ročník) – obálka alba s páskou vydání,
  u alb počet fotek, pod kartou jméno modelky a název alba; chronologicky. Nahoře filtr Vše · Centerfoldy ·
  Pictorialy a alba (jen když má fotograf obojí). Klik na kartu otevře album v prohlížeči fotek, pravé
  tlačítko nabídne profil modelky, výběr a další akce. Velké plakáty a řada štítků nad každým albem zmizely.

## [0.32.2] – 2026-10-15

### Změněno
- Stránka ročníku (klik na rok v Kalendáři) je přehled celého roku: 12 čísel jako karty – cover s páskou
  měsíce, v rohu náhled centerfoldu, pod kartou jméno playmate a co číslo obsahuje (cover · centerfold ·
  pictorialy), u výtisku štítek. Klik na kartu otevře číslo; chybějící měsíc má přerušovaný rámeček s plus
  a nabídne přidání a označení (sháním, mám výtisk). Pod tím speciály roku a alba celého ročníku. Vlevo
  panel s velkým tenkým rokem, proužkem „11 z 12“ a počty coverů, centerfoldů a pictorialů.
- Stránka fotografa má stejný levý panel: jméno velkými tenkými písmeny a počty alb, modelek a fotek.

## [0.32.1] – 2026-10-15

### Změněno
- Nabídky (pravé tlačítko, ⋯ vpravo nahoře, ⋯ u alba) v novém stylu: zaoblený průhledný panel, položky jako
  pilulky s růžovým zvýrazněním při najetí a skupiny s tenkým růžovým nadpisem (Fotka, Album, Modelky alba,
  Modelka; v ⋯ jméno modelky, Prohlížení, Údržba, Zálohy a data, Nastavení, Nápověda). Mazání zůstává červeně
  na konci. Dlouhá nabídka se v nízkém okně roluje.
- Lišta pro vybrané fotky (Ctrl+klik) je průhledná pilulka jako v prohlížeči fotek.

## [0.32.0] – 2026-10-15

### Přidáno
- Statistiky v Přehledu (nová položka v levém menu). Nahoře řádek velkých čísel s větou: počet centerfoldů
  a nejsilnější desetiletí, medián věku v době centerfoldu, nejčastější fotograf, počet národností a podíl
  té nejčastější. Pod ním karty s grafy: centerfoldy podle desetiletí, věk v době centerfoldu, nejčastější
  fotografové a národnosti (po osmi) a čísla ve sbírce podle edic US a CZ a desetiletí. Najetí myší na sloupec
  nebo řádek ukáže hodnotu. Věk se počítá jen u modelek se známým aspoň rokem a měsícem narození; fotografové
  se sjednocují bez ohledu na velikost písmen a diakritiku. Statistiky se počítají při prvním otevření oddílu.

## [0.31.6] – 2026-10-15

### Změněno
- Prohlížeč fotek: šipky ‹ › jsou na krajích horní pilulky (úplně vlevo a úplně vpravo), pořadí „3 / 22“
  zůstává vpravo vedle zavření.

## [0.31.5] – 2026-10-15

### Změněno
- Prohlížeč fotek: všechno ovládání v jedné průhledné pilulce nahoře přes celou šířku. Vlevo růžová páska
  vydání (BŘE 72), jméno velkými písmeny a odkud fotka je, uprostřed nástroje (srdíčka, rozložení,
  otočení, lupa, zamíchání, slideshow, ⋯), vpravo šipky ‹ › s pořadím „3 / 22“ a zavření. Šipky po
  stranách fotky zmizely. Panely prohlížeče jsou průhledné, fotka pod nimi rozostřeně prosvítá; lišta alb
  dole je pilulka ve stejném stylu.

## [0.31.4] – 2026-10-15

### Změněno
- Centerfoldy v novém stylu jako výstava tisků: každý plakát v lehkém tmavém rámu (pasparta), přes rám
  růžová páska vydání (jako v Číslech), pod rámem jméno velkými písmeny a vydání růžově – vidět pořád, ne
  až po najetí. Při řazení podle vydání jsou desetiletí oddíly s velkým tenkým nadpisem a růžovou linkou
  (jako roky v Kalendáři) a čtou se po řádcích.

## [0.31.3] – 2026-10-15

### Změněno
- Nejlepší už nejsou rozdělené po modelkách: jedna mozaika nejlepších fotek celé sbírky, řady stejné výšky,
  fotky v přirozeném poměru stran (neořezané na výšku), od nejvíce srdíček. Srdíčka jsou v rohu fotky, jméno
  modelky (odkaz na profil) a odkud fotka je se ukáže po najetí myší. Lišta nahoře skáče na úrovně srdíček.
  Vlastní výběry, prahy srdíček, slideshow a výběr více fotek fungují jako dřív.

## [0.31.2] – 2026-10-15

### Změněno
- Kalendář v novém stylu jako časová osa obálek: rok velkým tenkým číslem s růžovou linkou, měsíc jako
  růžová páska na obálce (jako v Číslech), výtisk jako štítek. Barevné tečky nahradily tři linky na spodní
  hraně obálky (cover, centerfold, pictorial; růžová = číslo ho má). Chybějící číslo má přerušovaný rámeček
  s růžovým plus; speciály a sbalené prázdné roky jsou pilulky.

## [0.31.1] – 2026-10-15

### Změněno
- Rychlé výsledky hledání mají pozadí jako okno „Co je nového“ (zaoblené, s hlubokým stínem) a stránka pod
  nimi ztmavne. Klik vedle výsledky zavře, nic pod nimi se přitom neotevře.

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
